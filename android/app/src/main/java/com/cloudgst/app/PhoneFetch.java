package com.cloudgst.app;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.util.Log;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * 📱 Phone mode 100% hidden background fetch (GSTR-2B + E-Commerce/TCS) — Multi-Profile (5 parallel slots).
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
        stage = "load";
        lastToken = "";
        lastDiag = null;
        ensureWeb(host);
        wv.loadUrl(AUTH_DASHBOARD);
        h.postDelayed(timeoutRun, HARD_TIMEOUT_MS);
    }

    private final Runnable timeoutRun = new Runnable() {
        @Override
        public void run() {
            if (finished) return;
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
                if (finished) return;
                onClickedDownload(url, userAgent);
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
            wv.evaluateJavascript(buildTickScript(), value -> {
                String raw = decodeJsString(value);
                String tok = raw;
                try {
                    JSONObject d = new JSONObject(raw);
                    tok = d.optString("t", "");
                    if (d.has("u") || d.has("b")) lastDiag = d;
                } catch (Exception e) {
                    tok = raw.replace("\"", "").trim();
                }
                lastToken = tok;
                stage = "poll:" + tok;
                if (finished) return;
                if (tok.startsWith("ERR:")) {
                    deliver(reqId, err("script_error",
                            "Phone mode: portal page par script error (" + tok.substring(4) + ")" + diagText()));
                    return;
                }
                if ("LOGIN".equals(tok)) {
                    deliver(reqId, err("login_required",
                            "Is client ka GST portal login expire ho gaya — dobara Re-Fetch dabayein."));
                    return;
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
                            "Phone mode: portal ne data nahi diya (aakhri: " + lastToken + ")" + diagText()));
                    return;
                }
                h.postDelayed(tickRun, TICK_MS);
            });
        }
    };

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
