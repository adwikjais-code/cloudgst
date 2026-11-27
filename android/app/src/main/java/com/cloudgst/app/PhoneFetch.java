package com.cloudgst.app;

import android.app.Activity;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.util.Log;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * 📱 Phone mode 100% hidden background fetch (GSTR-2B + E-Commerce/TCS) & GSTR-1 JSON Upload
 * — Multi-Profile (5 parallel slots).
 * Har slot (0..4) apne hi WebView Profile ("gst_slot_N") ki isolated cookies use karta hai.
 */
public class PhoneFetch {

    public interface Callback {
        void done(String requestId, String payloadJson);
    }

    private static final String TAG = "PhoneFetch";
    private static final String AUTH_DASHBOARD = "https://services.gst.gov.in/services/auth/dashboard";
    private static final String RETURNS_DASHBOARD = "https://return.gst.gov.in/returns/auth/dashboard";
    private static final long TICK_MS = 2400L;
    private static final long HARD_TIMEOUT_MS = 165000L;
    private static final int MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024;

    private final Activity act;
    private final int slot;
    private final Callback cb;
    private final Handler h = new Handler(Looper.getMainLooper());

    private WebView wv;
    private String reqId = null;
    private String fyLabel = "";
    private String monFull = "";
    private String monShort = "";
    private int ticks = 0;
    private boolean clicked = false;
    private boolean finished = false;
    private boolean retriedDirect = false;
    private boolean netRetried = false;
    private String cachedUa = "Mozilla/5.0";
    private String lastToken = "";
    private volatile String stage = "idle";
    private JSONObject lastDiag = null;
    private boolean uploadMode = false;
    private String uploadFileName = "GSTR1.json";
    private String uploadJsonB64 = "";
    private File uploadTempFile = null;

    public PhoneFetch(Activity act, int slot, Callback cb) {
        this.act = act;
        this.slot = Math.max(0, slot);
        this.cb = cb;
    }

    public String stage() {
        return stage == null ? "" : stage;
    }

    public boolean isBusy() {
        return reqId != null && !finished;
    }

    public void start(String id, String fy, String mon, ViewGroup host) {
        if (isBusy()) {
            final String busyId = id;
            h.post(() -> {
                try {
                    if (cb != null) cb.done(busyId, err("busy", "Tab " + (slot + 1) + " par fetch pehle se chal raha hai."));
                } catch (Exception ignored) { }
            });
            return;
        }
        reqId = id;
        fyLabel = fy == null ? "" : fy.trim();
        String m = mon == null ? "" : mon.trim().toUpperCase(Locale.US);
        int cut = m.indexOf('(');
        if (cut > 0) m = m.substring(0, cut).trim();
        monFull = m;
        monShort = m.length() >= 3 ? m.substring(0, 3) : m;
        ticks = 0;
        clicked = false;
        finished = false;
        retriedDirect = false;
        netRetried = false;
        uploadMode = false;
        uploadFileName = "GSTR1.json";
        uploadJsonB64 = "";
        cleanupUploadTemp();
        stage = "load";
        lastToken = "";
        lastDiag = null;
        ensureWeb(host);
        wv.loadUrl(AUTH_DASHBOARD);
        h.postDelayed(timeoutRun, HARD_TIMEOUT_MS);
    }

    public void startUploadGstr1(String id, String fy, String mon, String fileName, String jsonBase64, ViewGroup host) {
        if (isBusy()) {
            final String busyId = id;
            h.post(() -> {
                try {
                    if (cb != null) cb.done(busyId, err("busy", "Tab " + (slot + 1) + " par kaam pehle se chal raha hai."));
                } catch (Exception ignored) { }
            });
            return;
        }
        if (jsonBase64 == null || jsonBase64.trim().isEmpty()) {
            final String emptyId = id;
            h.post(() -> {
                try {
                    if (cb != null) cb.done(emptyId, err("bad_json", "GSTR-1 JSON content missing hai."));
                } catch (Exception ignored) { }
            });
            return;
        }
        reqId = id;
        fyLabel = fy == null ? "" : fy.trim();
        String m = mon == null ? "" : mon.trim().toUpperCase(Locale.US);
        int cut = m.indexOf('(');
        if (cut > 0) m = m.substring(0, cut).trim();
        monFull = m;
        monShort = m.length() >= 3 ? m.substring(0, 3) : m;
        ticks = 0;
        clicked = false;
        finished = false;
        retriedDirect = false;
        netRetried = false;
        uploadMode = true;
        uploadFileName = sanitizeJsonName(fileName);
        uploadJsonB64 = jsonBase64.trim();
        cleanupUploadTemp();
        try {
            byte[] rawBytes = Base64.decode(uploadJsonB64, Base64.DEFAULT);
            File f = new File(act.getCacheDir(), "gstr1_s" + slot + "_" + System.currentTimeMillis() + "_" + uploadFileName);
            try (FileOutputStream fos = new FileOutputStream(f)) {
                fos.write(rawBytes);
            }
            uploadTempFile = f;
        } catch (Throwable t) {
            Log.w(TAG, "upload temp file write fail", t);
            uploadTempFile = null;
        }
        stage = "upload_load";
        lastToken = "";
        lastDiag = null;
        ensureWeb(host);
        wv.loadUrl(AUTH_DASHBOARD);
        h.postDelayed(timeoutRun, HARD_TIMEOUT_MS);
    }

    private static String sanitizeJsonName(String raw) {
        String n = raw == null ? "" : raw.trim().replaceAll("[^A-Za-z0-9._-]", "_");
        if (n.isEmpty()) n = "GSTR1.json";
        if (!n.toLowerCase(Locale.US).endsWith(".json")) n += ".json";
        if (n.length() > 80) n = n.substring(n.length() - 80);
        return n;
    }

    private void cleanupUploadTemp() {
        try {
            if (uploadTempFile != null && uploadTempFile.exists()) {
                //noinspection ResultOfMethodCallIgnored
                uploadTempFile.delete();
            }
        } catch (Throwable ignored) { }
        uploadTempFile = null;
    }

    private final Runnable timeoutRun = new Runnable() {
        @Override
        public void run() {
            if (finished) return;
            if (uploadMode) {
                if (clicked) {
                    deliver(reqId, err("upload_timeout",
                            "Phone mode: GSTR-1 JSON bhej di gayi par portal ka jawab nahi aaya. Portal par status check karein."));
                } else {
                    deliver(reqId, err("timeout",
                            "Phone mode: GSTR-1 upload page nahi khula (" + Math.round(HARD_TIMEOUT_MS / 1000)
                                    + "s)" + diagText() + "."));
                }
                return;
            }
            if (clicked) {
                deliver(reqId, err("download_timeout",
                        "Phone mode: download shuru hui par file nahi aayi. Dobara try karein."));
            } else {
                deliver(reqId, err("timeout",
                        "Phone mode: portal ne " + Math.round(HARD_TIMEOUT_MS / 1000)
                                + "s me page nahi diya" + diagText() + "."));
            }
        }
    };

    private void ensureWeb(ViewGroup host) {
        if (wv != null) {
            wv.setAlpha(0f);
            wv.setClickable(false);
            wv.setFocusable(false);
            return;
        }
        final WebView v = new WebView(act);
        if (PhoneLogin.multiProfileSupported()) {
            try {
                WebViewCompat.setProfile(v, PhoneLogin.profileNameFor(slot));
            } catch (Throwable t) {
                Log.w(TAG, "setProfile fail slot=" + slot, t);
            }
        }
        WebSettings s = v.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setUserAgentString(s.getUserAgentString().replace("; wv", ""));
        cachedUa = s.getUserAgentString();
        CookieManager cm = PhoneLogin.cookieManagerForSlot(slot);
        cm.setAcceptCookie(true);
        cm.setAcceptThirdPartyCookies(v, true);

        v.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                if (finished) return;
                injectBlobShim(view);
                h.removeCallbacks(tickRun);
                h.postDelayed(tickRun, 900);
            }

            @Override
            public void onReceivedError(WebView view, android.webkit.WebResourceRequest req,
                                        android.webkit.WebResourceError errInfo) {
                if (req == null || !req.isForMainFrame()) return;
                final String desc = errInfo == null ? "" : (errInfo.getErrorCode() + " " + errInfo.getDescription());
                h.post(() -> {
                    if (finished) return;
                    if (!netRetried) {
                        netRetried = true;
                        if (wv != null) {
                            h.postDelayed(() -> {
                                if (wv != null && !finished) wv.loadUrl(AUTH_DASHBOARD);
                            }, 2500);
                        }
                        return;
                    }
                    deliver(reqId, err("network",
                            "Phone mode: portal ka server hi nahi mila (" + desc + "). Internet/DNS check karein." + diagText()));
                });
            }
        });
        v.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String disposition,
                                        String mime, long size) {
                if (finished || uploadMode) return;
                onClickedDownload(url, userAgent);
            }
        });
        v.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> filePathCallback,
                                             FileChooserParams fileChooserParams) {
                if (uploadMode && uploadTempFile != null && uploadTempFile.exists()) {
                    try {
                        filePathCallback.onReceiveValue(new Uri[]{ Uri.fromFile(uploadTempFile) });
                        return true;
                    } catch (Throwable ignored) { }
                }
                return false;
            }
        });
        v.setAlpha(0f);
        v.setClickable(false);
        v.setFocusable(false);
        v.setVerticalScrollBarEnabled(false);
        ViewGroup.LayoutParams lp = new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
        host.addView(v, 0, lp);
        wv = v;
    }

    private void injectBlobShim(WebView view) {
        if (view == null) return;
        String shim = "(function(){try{"
                + "if(window.__cgBlobShim)return;window.__cgBlobShim=1;"
                + "var map={};var origCreate=URL.createObjectURL;"
                + "URL.createObjectURL=function(b){var u=origCreate.call(URL,b);"
                + "try{if(b&&b.size){map[u]=b;var fr=new FileReader();"
                + "fr.onload=function(){window.__cgBlobB64=String(fr.result||'').split(',')[1]||'';};"
                + "fr.readAsDataURL(b);}}catch(e){}return u;};"
                + "var origClick=HTMLAnchorElement.prototype.click;"
                + "HTMLAnchorElement.prototype.click=function(){try{"
                + "var h=this.getAttribute('href')||'';"
                + "if(h.indexOf('blob:')===0){"
                + "if(map[h]){var fr=new FileReader();"
                + "fr.onload=function(){window.__cgBlobB64=String(fr.result||'').split(',')[1]||'';};"
                + "fr.readAsDataURL(map[h]);}"
                + "else if(window.fetch){fetch(h).then(function(r){return r.blob();}).then(function(b){"
                + "var fr=new FileReader();"
                + "fr.onload=function(){window.__cgBlobB64=String(fr.result||'').split(',')[1]||'';};"
                + "fr.readAsDataURL(b);}).catch(function(){});}"
                + "}}catch(e){}return origClick.call(this);};"
                + "}catch(e){}})()";
        view.evaluateJavascript(shim, null);
    }

    private final Runnable tickRun = new Runnable() {
        @Override
        public void run() {
            if (finished || wv == null) return;
            ticks++;
            wv.evaluateJavascript(uploadMode ? buildUploadTickScript() : buildTickScript(), value -> {
                String raw = decodeJsString(value);
                String tok = raw;
                JSONObject parsed = null;
                try {
                    JSONObject d = new JSONObject(raw);
                    parsed = d;
                    tok = d.optString("t", "");
                    if (d.has("u") || d.has("b")) lastDiag = d;
                } catch (Exception e) {
                    tok = raw.replace("\"", "").trim();
                }
                lastToken = tok;
                stage = (uploadMode ? "up:" : "poll:") + tok;
                if (finished) return;
                if (tok.startsWith("ERR:")) {
                    deliver(reqId, err("script_error",
                            "Phone mode: portal page par script error (" + tok.substring(4) + ")" + diagText()));
                    return;
                }
                if ("LOGIN".equals(tok)) {
                    deliver(reqId, err("login_required",
                            "Is client ka GST portal login expire ho gaya — dobara try karein."));
                    return;
                }
                if ("UP_ERR".equals(tok)) {
                    String msg = parsed == null ? "" : parsed.optString("msg", "");
                    deliver(reqId, err("upload_failed",
                            "Portal ne GSTR-1 upload me error diya: " + (msg.isEmpty() ? "Upload reject hua" : msg)));
                    return;
                }
                if ("UP_OK".equals(tok)) {
                    boolean verified = parsed != null && parsed.optBoolean("verified", false);
                    String alertText = parsed == null ? "" : parsed.optString("msg", "");
                    JSONArray rowArr = parsed == null ? null : parsed.optJSONArray("row");
                    JSONObject p = baseOk();
                    try {
                        p.put("uploaded", true);
                        p.put("verified", verified);
                        p.put("message", verified
                                ? "GSTR-1 JSON phone se portal par upload ho gayi (portal ne confirm kiya). Ab portal par summary check karke Submit & File (EVC/DSC) karein."
                                : "⚠️ GSTR-1 JSON portal ko bhej di gayi, par portal ki taraf se confirmation message padh nahi paya. Portal par upload status zaroor check karein.");
                        JSONObject ps = new JSONObject();
                        ps.put("alertText", alertText);
                        ps.put("latestRow", rowArr != null ? rowArr : new JSONArray());
                        p.put("portalStatus", ps);
                    } catch (Exception ignored) { }
                    deliver(reqId, p.toString());
                    return;
                }
                if ("UPLOADED_FILE".equals(tok)) {
                    clicked = true;
                }
                if ("NOTGEN".equals(tok)) {
                    JSONObject p = baseOk();
                    try {
                        p.put("notGenerated2b", true);
                        JSONObject g = new JSONObject();
                        g.put("summary", JSONObject.NULL);
                        p.put("gstr2b", g);
                        p.put("warnings", new JSONArray().put("GSTR-2B not generated this month"));
                    } catch (Exception ignored) { }
                    deliver(reqId, p.toString());
                    return;
                }
                if ("CLICKED".equals(tok)) clicked = true;
                if ("NONE".equals(tok) && ticks == 6 && !retriedDirect && !fyLabel.startsWith("TCS|")) {
                    retriedDirect = true;
                    if (wv != null) wv.loadUrl(RETURNS_DASHBOARD);
                }
                if (ticks >= 60) {
                    deliver(reqId, err("timeout",
                            "Phone mode: portal ne jawab nahi diya (aakhri: " + lastToken + ")" + diagText()));
                    return;
                }
                h.postDelayed(tickRun, TICK_MS);
            });
        }
    };

    /** Phone mode: GSTR-1 PREPARE OFFLINE JSON upload automation script. */
    private String buildUploadTickScript() {
        return "(function(){"
                + "var out=function(t,extra){var b='';try{b=String((document.body&&document.body.innerText)||'').replace(/\\s+/g,' ').trim().slice(0,140);}catch(x){}"
                + "var o={t:t,u:String(location.href||'').slice(0,120),b:b};"
                + "if(extra)for(var k in extra)o[k]=extra[k];return JSON.stringify(o);};"
                + "var vis=function(e){return !!(e&&e.offsetParent!==null);},"
                + "flat=function(e){return String((e&&(e.innerText||e.textContent))||'').replace(/\\s+/g,' ').trim();};"
                + "try{var FY=" + JSONObject.quote(fyLabel) + ",MONF=" + JSONObject.quote(monFull) + ",MONS=" + JSONObject.quote(monShort)
                + ",FNAME=" + JSONObject.quote(uploadFileName) + ",B64=" + JSONObject.quote(uploadJsonB64) + ";"
                + "var href=String(location.href||'').toLowerCase(),W=window,D=document,Q=(s,r)=>[...(r||D).querySelectorAll(s)],"
                + "F=flat,V=vis,O=out,cl=e=>(e.click(),O('OPENING')),fv=(a,r)=>a.find(e=>V(e)&&r.test(F(e))),sv;"
                + "if(href.includes('/login')||D.querySelector('[type=password]'))return O('LOGIN');"
                + "var B=F(D.body);"
                + "if(/access.?denied/i.test(href+B))return !W.__cA?(W.__cA=1,location='/services/auth/dashboard',O('OPENING')):O('LOGIN');"
                + "Q('.modal button').forEach(b=>V(b)&&/REMIND|SKIP|CLOSE/i.test(F(b))&&b.click());"
                // 1) Offline Upload page: input[type=file] present
                + "var fi=D.querySelector('input[type=\"file\"]');"
                + "if(fi){"
                + "  if(!W.__cgUpSent){"
                + "    var tr0=D.querySelector('table tbody tr');W.__cgUpPrevRow=tr0?F(tr0):'';"
                + "    var bin=atob(B64),bytes=new Uint8Array(bin.length);"
                + "    for(var i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);"
                + "    var file=new File([bytes],FNAME,{type:'application/json'});"
                + "    var dt=new DataTransfer();dt.items.add(file);fi.files=dt.files;"
                + "    fi.dispatchEvent(new Event('input',{bubbles:true}));"
                + "    fi.dispatchEvent(new Event('change',{bubbles:true}));"
                + "    W.__cgUpSent=1;W.__cgUpTicks=0;return O('UPLOADED_FILE');"
                + "  }"
                + "  W.__cgUpTicks=(W.__cgUpTicks||0)+1;"
                + "  if(W.__cgUpTicks<2)return O('UP_WAIT');"
                + "  var alerts=Q('.alert-success,.alert-info,.alert-danger,.err,.text-danger,.alert-warning').filter(V).map(F).filter(Boolean);"
                + "  var alertText=alerts.join(' | ');"
                + "  var tr=D.querySelector('table tbody tr');"
                + "  var rowArr=tr?[...tr.querySelectorAll('td')].map(F):[];"
                + "  var rowStr=tr?F(tr):'';"
                + "  var ERR_RE=/\\b(error|failed|invalid|unable|reject|corrupt|mismatch|not\\s+valid|already\\s+filed|cannot\\s+be\\s+uploaded|something\\s+went\\s+wrong)\\b/i;"
                + "  var OK_RE=/\\b(success|uploaded|processed|in\\s+progress|accepted|reference|received|queued)\\b/i;"
                + "  if(alertText&&ERR_RE.test(alertText))return O('UP_ERR',{msg:alertText,row:rowArr});"
                + "  var comb=alertText+' '+rowStr;"
                + "  if(OK_RE.test(comb)&&(alertText||(rowStr&&rowStr!==W.__cgUpPrevRow)))return O('UP_OK',{verified:true,msg:alertText,row:rowArr});"
                + "  if(W.__cgUpTicks>=8)return O('UP_OK',{verified:false,msg:alertText,row:rowArr});"
                + "  return O('UP_WAIT');"
                + "}"
                // 2) Returns Dashboard: GSTR-1 PREPARE OFFLINE button (skip GSTR-1A)
                + "var bs=Q('button,a'),al=Q('a,button,span,li');"
                + "for(var b of bs){if(!V(b))continue;var t=F(b);"
                + "  if(/PREPARE\\s+OFFLINE/i.test(t)){"
                + "    for(var p=b.parentNode,h=0;p&&h<6;p=p.parentNode,h++){"
                + "      var pt=F(p);if(pt.length>1200)break;"
                + "      if(/GSTR-?1(?!A)\\b/i.test(pt)&&!/GSTR-?1A/i.test(pt))return !W.__cgUpPo?(W.__cgUpPo=1,b.click(),O('OPENING')):O('DASH');"
                + "    }"
                + "  }"
                + "}"
                // 3) Select FY / Quarter / Month + SEARCH
                + "var P=ss=>{if(!ss.length)return '';var ch=0,qn=('APRMAYJUNJULAUGSEPOCTNOVDECJANFEBMAR'.indexOf(MONS)/9|0)+1,"
                + "qR=[0,/APR/,/JUL/,/OCT/,/JAN/],mR=MONS.length>2?new RegExp('(^|[^A-Z])'+MONS+'([^A-Z]|$)'):0;"
                + "ss.forEach(sl=>{var ops=sl.options,at=F(sl).toUpperCase(),iF=/20\\d{2}/.test(at),iQ=/QUARTER|APR.*JUN/.test(at);"
                + "for(var o=0;o<ops.length;o++){var ot=ops[o].text.toUpperCase().trim();if(/^$|SELECT/.test(ot))continue;"
                + "if((iF&&ot.includes(FY))||(iQ&&qn&&(ot.includes('QUARTER '+qn)||qR[qn].test(ot)))||(!iF&&!iQ&&(ot.includes(MONF)||(mR&&mR.test(ot))))){"
                + "if(sl.selectedIndex-o)sl.selectedIndex=o,sl.dispatchEvent(new Event('change',{bubbles:1})),ch=1;break;}}});"
                + "return ch?O('SETTING'):(sv=fv(bs,/^SEARCH$/i))?(sv.click(),O('SEARCHED')):O('DASH');};"
                + "if(href.includes('/returns')&&(sv=P(Q('select'))))return sv;"
                + "if(sv=D.querySelector('a[href*=\"/returns/auth/dash\"]'))return cl(sv);"
                + "return (sv=fv(al,/^RETURNS? DASHBOARD$/i)||fv(al,/^(RETURNS|SERVICES)$/i))?cl(sv):O('NONE');"
                + "}catch(e){return O('ERR:'+e);}})()";
    }

    private String diagText() {
        JSONObject d = lastDiag;
        if (d == null) return "";
        String u = d.optString("u", "");
        String b = d.optString("b", "");
        String out = "";
        if (!u.isEmpty()) out += " | page: " + u;
        if (!b.isEmpty()) out += " | text: " + b;
        return out.length() > 280 ? out.substring(0, 280) : out;
    }

    /** Exact proven GSTR-2B + v19_stable TCS script. */
    private String buildTickScript() {
        return "(function(){"
                + "var out=function(t){var b='';try{b=String((document.body&&document.body.innerText)||'').replace(/\\s+/g,' ').trim().slice(0,120);}catch(x){}"
                + "return JSON.stringify({t:t,u:String(location.href||'').slice(0,120),b:b});};"
                + "var vis=function(e){return !!(e&&e.offsetParent!==null);},"
                + "flat=function(e){return String((e&&(e.innerText||e.textContent))||'').replace(/\\s+/g,' ').trim();},"
                + "sendJ=function(o){if(window.__cTD)return out('CLICKED');window.__cTD=1;o.p='0'.repeat(120);"
                + "var j=JSON.stringify(o);window.__cgBlobB64=btoa(unescape(encodeURIComponent(j)));"
                + "location.href=URL.createObjectURL(new Blob([j],{type:'application/octet-stream'}));return out('CLICKED');};"
                + "try{var FY=" + JSONObject.quote(fyLabel) + ",MONF=" + JSONObject.quote(monFull) + ",MONS=" + JSONObject.quote(monShort) + ";"
                + "var href=String(location.href||'').toLowerCase(),W=window,D=document,Q=(s,r)=>[...(r||D).querySelectorAll(s)],"
                + "F=flat,V=vis,O=out,cl=e=>(e.click(),O('OPENING')),fv=(a,r)=>a.find(e=>V(e)&&r.test(F(e))),sv;"
                + "if(href.includes('/login')||D.querySelector('[type=password]'))return O('LOGIN');"
                + "var B=F(D.body);"
                + "if(/access.?denied/i.test(href+B))return !W.__cA?(W.__cA=1,location='/services/auth/dashboard',O('OPENING')):O('LOGIN');"
                + "Q('.modal button').forEach(b=>V(b)&&/REMIND|SKIP|CLOSE/i.test(F(b))&&b.click());"
                + "var bs=Q('button,a'),al=Q('a,button,span,li');"
                + "var P=ss=>{if(!ss.length)return '';var ch=0,qn=('APRMAYJUNJULAUGSEPOCTNOVDECJANFEBMAR'.indexOf(MONS)/9|0)+1,"
                + "qR=[0,/APR/,/JUL/,/OCT/,/JAN/],mR=MONS.length>2?new RegExp('(^|[^A-Z])'+MONS+'([^A-Z]|$)'):0;"
                + "ss.forEach(sl=>{var ops=sl.options,at=F(sl).toUpperCase(),iF=/20\\d{2}/.test(at),iQ=/QUARTER|APR.*JUN/.test(at);"
                + "for(var o=0;o<ops.length;o++){var ot=ops[o].text.toUpperCase().trim();if(/^$|SELECT/.test(ot))continue;"
                + "if((iF&&ot.includes(FY))||(iQ&&qn&&(ot.includes('QUARTER '+qn)||qR[qn].test(ot)))||(!iF&&!iQ&&(ot.includes(MONF)||(mR&&mR.test(ot))))){"
                + "if(sl.selectedIndex-o)sl.selectedIndex=o,sl.dispatchEvent(new Event('change',{bubbles:1})),ch=1;break;}}});"
                + "return ch?O('SETTING'):(sv=fv(bs,/^SEARCH$/i))?(sv.click(),O('SEARCHED')):O('DASH');};"
                // --- E-Commerce / TCS branch (exact v19_stable logic) ---
                + "if(FY.startsWith('TCS|')){FY=FY.slice(4);"
                + "var si=B.search(/TCS Credit Received - Summary/i),sb2=si<0?'':B.slice(si,si+1500),"
                + "hG=/\\d{2}[A-Z]{5}\\d{4}[A-Z]\\w{3}/i.test(sb2);"
                + "if(si>=0){"
                + "if(!hG&&(W.__w=(W.__w||0)+1)<5&&!/no record/i.test(sb2))return O('DASH');"
                + "return sendJ({__cgTcs:1,b:sb2,tables:Q('table').map(t=>({"
                + "head:Q('thead tr',t).map(r=>[...r.cells].map(c=>({t:F(c),cs:c.colSpan||1,rs:c.rowSpan||1}))),"
                + "body:Q('tbody tr',t).map(r=>[...r.cells].map(F))}))});}"
                + "var cr;if(sv=Q('div,span,p,h2,h3,h4,h5,a,button,li').find(e=>{if(V(e)&&/^TCS credit received$/i.test(F(e)))"
                + "for(var t,p=e,k=0;p&&k<5;p=p.parentNode,k++)if((t=F(p)).length<500&&/records/i.test(t)&&!/amend/i.test(t))return cr=p;})){"
                + "var m=(W.__m=(W.__m||0)+1)%3;"
                + "return cl(m==1?sv:m==2?cr:Q('*',cr).find(x=>/records/i.test(F(x))&&!x.children.length)||cr);}"
                + "if(/tdstcs|TDS and TCS/i.test(href+B)){if(sv=fv(bs,/PREPARE ONLINE|^VIEW\\b/i))return cl(sv);if(sv=P(Q('select')))return sv;}"
                + "return (sv=Q('a').find(a=>/TDS and TCS|tdstcs/i.test(F(a)+a.href))||fv(al,/^(RETURNS|SERVICES)$/i))?cl(sv):O('NONE');}"
                // --- GSTR-2B branch (exact proven working logic) ---
                + "if(/no record for gstr.?2b|gstr.?2b.*not .*generated/i.test(B)||(/(not\\s+generated|could\\s+not\\s+be\\s+generated)/i.test(B)&&/2B/i.test(B)))return O('NOTGEN');"
                + "for(var b of bs){if(!V(b))continue;var t=F(b);"
                + "if(/GENERATE JSON FILE TO DOWNLOAD/i.test(t))return !W.__cG?(W.__cG=1,b.click(),O('CLICKED')):O('DASH');"
                + "if(/DOWNLOAD/i.test(t))for(var p=b.parentNode,h=0;p&&h<5;p=p.parentNode,h++)if(/GSTR-?2B/i.test(F(p)))return b.click(),O('CLICKED');}"
                + "if(href.includes('/returns')&&(sv=P(Q('select'))))return sv;"
                + "if(sv=D.querySelector('a[href*=\"/returns/auth/dash\"]'))return cl(sv);"
                + "return (sv=fv(al,/^RETURNS? DASHBOARD$/i)||fv(al,/^(RETURNS|SERVICES)$/i))?cl(sv):O('NONE');"
                + "}catch(e){return O('ERR:'+e);}})()";
    }

    private void onClickedDownload(String url, String ua) {
        stage = "download";
        if (url == null || url.isEmpty()) return;
        String agent = (ua == null || ua.isEmpty()) ? cachedUa : ua;
        if (url.startsWith("blob:")) {
            readBlobChunk(0, new StringBuilder(), agent, 0);
            return;
        }
        String cookie = "";
        try { cookie = PhoneLogin.cookieManagerForSlot(slot).getCookie(url); } catch (Exception ignored) { }
        fetchUrl(url, agent, cookie);
    }

    private void readBlobChunk(final int offset, final StringBuilder acc, final String ua, final int retries) {
        if (finished || wv == null) return;
        final int CH = 200000;
        final int from = offset;
        wv.evaluateJavascript("(function(){try{var s=window.__cgBlobB64||'';return s.slice(" + from
                + "," + (from + CH) + ");}catch(e){return '';}})()", value -> {
            if (finished) return;
            String chunk = unquote(value);
            if (chunk.isEmpty()) {
                if (acc.length() > 100) {
                    handleBytes(Base64.decode(acc.toString(), Base64.DEFAULT), ua);
                } else if (offset == 0 && retries < 15) {
                    h.postDelayed(() -> {
                        if (!finished) readBlobChunk(0, acc, ua, retries + 1);
                    }, 1000);
                } else {
                    deliver(reqId, err("download_failed",
                            "Phone mode: portal blob download data padh nahi paye. Dobara try karein."));
                }
                return;
            }
            acc.append(chunk);
            if (chunk.length() < CH) {
                handleBytes(Base64.decode(acc.toString(), Base64.DEFAULT), ua);
            } else {
                readBlobChunk(offset + CH, acc, ua, retries);
            }
        });
    }

    private void fetchUrl(final String url, final String ua, final String cookie) {
        new Thread(() -> {
            HttpURLConnection c = null;
            try {
                final String agent = (ua == null || ua.isEmpty()) ? "Mozilla/5.0" : ua;
                c = (HttpURLConnection) new URL(url).openConnection();
                c.setRequestProperty("User-Agent", agent);
                if (cookie != null && !cookie.isEmpty()) c.setRequestProperty("Cookie", cookie);
                c.setRequestProperty("Referer", "https://return.gst.gov.in/");
                c.setConnectTimeout(30000);
                c.setReadTimeout(120000);
                c.setInstanceFollowRedirects(true);
                int code = c.getResponseCode();
                if (code != 200) {
                    deliver(reqId, err("download_failed", "Phone mode: 2B download HTTP " + code + " — dobara try karein."));
                    return;
                }
                byte[] bodyBytes;
                try (InputStream in = c.getInputStream()) {
                    bodyBytes = readAll(in);
                }
                handleBytes(bodyBytes, agent);
            } catch (Exception e) {
                Log.w(TAG, "fetchUrl fail", e);
                deliver(reqId, err("download_failed", "Phone mode: file download nahi hui (" + e.getMessage() + ")."));
            } finally {
                if (c != null) try { c.disconnect(); } catch (Exception ignored) { }
            }
        }).start();
    }

    private void handleBytes(byte[] bytes, String ua) {
        if (finished) return;
        try {
            String json = extractJson(bytes);
            if (json == null || json.length() < 40) {
                deliver(reqId, err("bad_file", "Phone mode: download me valid JSON nahi mila."));
                return;
            }
            JSONObject g = new JSONObject();
            g.put("jsonBase64", Base64.encodeToString(json.getBytes(StandardCharsets.UTF_8), Base64.NO_WRAP));
            g.put("fileName", "gstr2b.json");
            g.put("bytes", json.getBytes(StandardCharsets.UTF_8).length);
            JSONObject p = baseOk();
            p.put("gstr2b", g);
            p.put("warnings", new JSONArray());
            deliver(reqId, p.toString());
        } catch (Exception e) {
            deliver(reqId, err("parse_failed", "Phone mode: JSON khol nahi paye (" + e.getMessage() + ")."));
        }
    }

    private static String extractJson(byte[] bytes) throws Exception {
        if (bytes == null || bytes.length == 0) return null;
        boolean zip = bytes.length > 4 && bytes[0] == 0x50 && bytes[1] == 0x4B;
        if (!zip) {
            String t = new String(bytes, StandardCharsets.UTF_8).replace("\uFEFF", "").trim();
            if (t.startsWith("{") || t.startsWith("[")) return t;
            if (t.startsWith("<")) return null;
            return null;
        }
        try (ZipInputStream zis = new ZipInputStream(new java.io.ByteArrayInputStream(bytes))) {
            ZipEntry e;
            while ((e = zis.getNextEntry()) != null) {
                String name = e.getName() == null ? "" : e.getName().toLowerCase(Locale.US);
                if (name.endsWith(".json")) {
                    return new String(readAll(zis), StandardCharsets.UTF_8).replace("\uFEFF", "").trim();
                }
            }
        }
        return null;
    }

    private static byte[] readAll(InputStream in) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        int total = 0;
        while ((n = in.read(buf)) > 0) {
            total += n;
            if (total > MAX_DOWNLOAD_BYTES) {
                throw new Exception("File 25MB limit se badi hai");
            }
            out.write(buf, 0, n);
        }
        return out.toByteArray();
    }

    private static String decodeJsString(String v) {
        if (v == null || "null".equals(v) || v.isEmpty()) return "";
        try {
            return new JSONArray("[" + v + "]").getString(0);
        } catch (Exception e) {
            return unquote(v);
        }
    }

    private static String unquote(String v) {
        if (v == null || "null".equals(v)) return "";
        String s = v;
        if (s.length() >= 2 && s.startsWith("\"") && s.endsWith("\"")) s = s.substring(1, s.length() - 1);
        return s.replace("\\/", "/").replace("\\\"", "\"").replace("\\n", "\n").replace("\\r", "").replace("\\\\", "\\");
    }

    private JSONObject baseOk() {
        JSONObject p = new JSONObject();
        try {
            p.put("ok", true);
            p.put("source", "phone");
        } catch (Exception ignored) { }
        return p;
    }

    private String err(String code, String message) {
        JSONObject p = new JSONObject();
        try {
            p.put("ok", false);
            p.put("source", "phone");
            p.put("code", code);
            p.put("error", message);
        } catch (Exception ignored) { }
        return p.toString();
    }

    private void deliver(final String id, final String payload) {
        if (finished) return;
        finished = true;
        uploadJsonB64 = "";
        cleanupUploadTemp();
        h.removeCallbacks(tickRun);
        h.removeCallbacks(timeoutRun);
        final String rid = id == null ? reqId : id;
        h.post(() -> {
            try {
                if (cb != null) cb.done(rid, payload);
            } catch (Exception e) {
                Log.w(TAG, "callback fail", e);
            }
        });
    }

    public void destroy() {
        finished = true;
        uploadJsonB64 = "";
        cleanupUploadTemp();
        h.removeCallbacksAndMessages(null);
        if (wv != null) {
            try {
                ViewGroup parent = (ViewGroup) wv.getParent();
                if (parent != null) parent.removeView(wv);
                wv.destroy();
            } catch (Exception ignored) { }
            wv = null;
        }
    }
}
