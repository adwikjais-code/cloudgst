package com.cloudgst.app;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

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
 * Phone mode (bina cloud): phone par jo GST portal session pehle se login hai, usi se
 * GSTR-2B JSON download karta hai — sab kuch app ke andar, chhupe hue (invisible) WebView me.
 * Koi portal screen user ko nahi dikhti; app apni progress row me status dikhati hai.
 *
 * Flow: auth dashboard -> "RETURN DASHBOARD" -> FY + Month select -> SEARCH ->
 *       GSTR-2B card ka DOWNLOAD -> ZIP/JSON bytes -> base64 -> app JS (gpPhoneFetchReady).
 */
public class PhoneFetch {

    public interface Callback {
        /** requestId + payload JSON (string). UI thread par bulaya jata hai. */
        void done(String requestId, String payloadJson);
    }

    private static final String TAG = "PhoneFetch";
    private static final String AUTH_DASHBOARD = "https://services.gst.gov.in/services/auth/dashboard";
    private static final String RETURNS_DASHBOARD = "https://return.gst.gov.in/returns/auth/dashboard";
    private static final long TICK_MS = 2600L;
    private static final long HARD_TIMEOUT_MS = 165000L;
    private static final int MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024;

    private final Activity act;
    private final Callback cb;
    private final Handler h = new Handler(Looper.getMainLooper());

    private WebView wv;
    private String reqId = null;
    private String fyLabel = "";
    private String monFull = "";
    private String monShort = "";
    private int ticks = 0;
    private int searched = 0;
    private boolean clicked = false;
    private boolean finished = false;
    private boolean retriedDirect = false;
    private boolean netRetried = false;
    private String cachedUa = "Mozilla/5.0";
    private String lastToken = "";
    private volatile String stage = "idle";

    public PhoneFetch(Activity act, Callback cb) {
        this.act = act;
        this.cb = cb;
    }

    public String stage() {
        return stage == null ? "" : stage;
    }

    public boolean isBusy() {
        return reqId != null && !finished;
    }

    // ============================ start ============================

    public void start(String id, String fy, String mon, ViewGroup host) {
        if (isBusy()) {
            // chalta hua fetch kharab na ho — sirf is naye request ko jawab dein
            final String busyId = id;
            h.post(() -> {
                try {
                    if (cb != null) cb.done(busyId, err("busy", "Pehla phone fetch chal raha hai — uske khatam hone ka intezar karein."));
                } catch (Exception ignored) { }
            });
            return;
        }
        reqId = id;
        fyLabel = fy == null ? "" : fy.trim();
        String m = mon == null ? "" : mon.trim().toUpperCase(Locale.US);
        int cut = m.indexOf('(');                       // "OCTOBER (2026-27)" -> "OCTOBER"
        if (cut > 0) m = m.substring(0, cut).trim();
        monFull = m;
        monShort = m.length() >= 3 ? m.substring(0, 3) : m;
        ticks = 0;
        searched = 0;
        clicked = false;
        finished = false;
        retriedDirect = false;
        netRetried = false;
        stage = "load";
        lastToken = "";
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
                        "Phone mode: GSTR-2B download shuru hui par file nahi aayi. Dobara try karein ya ☁️ Cloud mode use karein."));
            } else {
                deliver(reqId, err("timeout",
                        "Phone mode: portal ne " + Math.round(HARD_TIMEOUT_MS / 1000)
                                + "s me 2B page nahi diya" + diagText() + ". ☁️ Cloud mode try karein."));
            }
        }
    };

    // ============================ hidden webview ============================

    private void ensureWeb(ViewGroup host) {
        if (wv != null) {
            wv.setAlpha(0f);
            wv.setClickable(false);
            wv.setFocusable(false);
            return;
        }
        final WebView v = new WebView(act);
        WebSettings s = v.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        // Playwright/desktop jaisa behaviour: "wv" hata do, warna portal mobile page deta hai
        s.setUserAgentString(s.getUserAgentString().replace("; wv", ""));
        cachedUa = s.getUserAgentString();
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(v, true);

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
                    if (!netRetried) {                 // ek baar dobara load
                        netRetried = true;
                        if (wv != null) { h.postDelayed(() -> { if (wv != null && !finished) wv.loadUrl(AUTH_DASHBOARD); }, 2500); }
                        return;
                    }
                    deliver(reqId, err("network",
                            "Phone mode: portal ka server hi nahi mila (" + desc + "). Internet/DNS check karein "
                                    + "ya ☁️ Cloud mode use karein." + diagText()));
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
        // Poora size + app ke WebView ke PEECHHE (index 0) + alpha=0 — 100% hidden render
        v.setAlpha(0f);
        v.setClickable(false);
        v.setFocusable(false);
        v.setVerticalScrollBarEnabled(false);
        ViewGroup.LayoutParams lp = new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
        host.addView(v, 0, lp);
        wv = v;
    }

    // ============================ page tick loop ============================

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
                            "Phone mode: portal page par script error (" + tok.substring(4) + ")" + diagText()
                                    + ". ☁️ Cloud mode try karein."));
                    return;
                }
                if ("LOGIN".equals(tok)) {
                    deliver(reqId, err("login_required",
                            "Is client ka GST portal login phone par nahi hai — ek baar login karein "
                                    + "(captcha + OTP aap dalenge), uske baad phone mode background me chalega."));
                    return;
                }
                if ("NOTGEN".equals(tok)) {
                    JSONObject p = baseOk();
                    try {
                        p.put("notGenerated2b", true);
                        JSONObject g = new JSONObject();
                        g.put("summary", JSONObject.NULL);
                        p.put("gstr2b", g);
                        p.put("warnings", new JSONArray().put("GSTR-2B is month generate nahi hui (portal: not generated)."));
                    } catch (Exception ignored) { }
                    deliver(reqId, p.toString());
                    return;
                }
                if ("CLICKED".equals(tok)) clicked = true;
                if ("SEARCHED".equals(tok)) searched++;
                if ("NONE".equals(tok) && ticks == 6 && !retriedDirect) {
                    // menu click kaam na kare to ek baar seedha returns dashboard
                    retriedDirect = true;
                    if (wv != null) wv.loadUrl(RETURNS_DASHBOARD);
                }
                if (ticks >= 60) {
                    deliver(reqId, err("timeout",
                            "Phone mode: portal ne 2B card/DOWNLOAD nahi diya (aakhri: " + lastToken + ")"
                                    + diagText() + ". ☁️ Cloud mode try karein."));
                    return;
                }
                h.postDelayed(tickRun, TICK_MS);
            });
        }
    };

    private JSONObject lastDiag = null;

    /** Diagnostic text (error message me) — page kya dikha raha tha, yeh pata chale. */
    private String diagText() {
        JSONObject d = lastDiag;
        if (d == null) return "";
        String u = d.optString("u", "");
        String ti = d.optString("ti", "");
        String b = d.optString("b", "");
        String out = "";
        if (!u.isEmpty()) out += " | page: " + u;
        if (!ti.isEmpty()) out += " | " + ti;
        if (!b.isEmpty()) out += " | text: " + b;
        return out.length() > 320 ? out.substring(0, 320) : out;
    }

    /**
     * Ek hi script har tick par page dekh kar sahi kadam uthati hai.
     * Har jawab JSON hota hai: {t:"TOKEN", u:url, ti:title, b:text, sels:n}
     * Helpers try ke BAAHAR hain — kabhi script error ho to bhi diagnostics milti rahe.
     * Token: LOGIN | NOTGEN | CLICKED | SETTING | SEARCHED | DASH | OPENING | NONE | ERR:<msg>
     */
    private String buildTickScript() {
        String js = "(function(){"
                + "var out=function(t){var b='';try{var el=document.body||document.documentElement;"
                + "b=String((el&&(el.innerText||el.textContent))||'').replace(/\\s+/g,' ').trim().slice(0,150);}catch(x){}"
                + "return JSON.stringify({t:t,u:String(location.href||'').slice(0,150),ti:String(document.title||'').slice(0,70),b:b,"
                + "sels:(document.querySelectorAll?document.querySelectorAll('select').length:0)});};"
                + "var vis=function(e){try{return !!(e&&(e.offsetParent!==null||(e.getClientRects&&e.getClientRects().length)));}catch(x){return false;}};"
                + "var txt=function(e){return ((e&&(e.innerText||e.textContent))||'')+'';};"
                + "var flat=function(e){return txt(e).replace(/\\s+/g,' ').trim();};"
                + "try{"
                + "var FY=" + JSONObject.quote(fyLabel) + ",MONF=" + JSONObject.quote(monFull)
                + ",MONS=" + JSONObject.quote(monShort) + ";"
                + "var href=String(location.href||'').toLowerCase();"
                + "if(href.indexOf('/login')>=0||document.querySelector('input[type=password]')) return out('LOGIN');"
                + "var body=flat(document.body||document.documentElement);"
                + "if(/(not\\s+generated|could\\s+not\\s+be\\s+generated)/i.test(body)&&/2B/i.test(body)) return out('NOTGEN');"
                // ---- 2B card ka DOWNLOAD ya gstr2b.gst.gov.in ka GENERATE JSON FILE TO DOWNLOAD ----
                + "var btns=[].slice.call(document.querySelectorAll('button,a,input[type=button]'));"
                + "for(var gi=0;gi<btns.length;gi++){var gb=btns[gi];if(!vis(gb))continue;"
                + "if(/GENERATE\\s+JSON\\s+FILE\\s+TO\\s+DOWNLOAD/i.test(flat(gb))){try{gb.scrollIntoView({block:'center'});}catch(x){}gb.click();return out('CLICKED');}}"
                + "for(var i=0;i<btns.length;i++){var b=btns[i];if(!vis(b))continue;"
                + "if(!/DOWNLOAD/i.test(flat(b)))continue;"
                + "var p=b.parentNode,hops=0,hit=false;"
                + "while(p&&hops<5){if(/GSTR-?2B/i.test(flat(p))){hit=true;break;}p=p.parentNode;hops++;}"
                + "if(hit){try{b.scrollIntoView({block:'center'});}catch(x){}b.click();return out('CLICKED');}}"
                // ---- dashboard: FY + Quarter + Month select (sirf jab selectedIndex badle), phir SEARCH ----
                + "var sels=[].slice.call(document.querySelectorAll('select'));"
                + "if(sels.length){var changed=false;"
                + "var qMap={APR:'1',MAY:'1',JUN:'1',JUL:'2',AUG:'2',SEP:'2',OCT:'3',NOV:'3',DEC:'3',JAN:'4',FEB:'4',MAR:'4'};"
                + "var qRng={1:/APR\\s*-\\s*JUN/i,2:/JUL\\s*-\\s*SEP/i,3:/OCT\\s*-\\s*DEC/i,4:/JAN\\s*-\\s*MAR/i};"
                + "var QNUM=qMap[MONS]||'';"
                + "var monRe=MONS.length>=3?new RegExp('(^|[^A-Z])'+MONS+'([^A-Z]|$)'):null;"
                + "for(var s=0;s<sels.length;s++){var ops=[].slice.call(sels[s].options||[]);"
                + "var allTxt=ops.map(function(op){return ((op.text||'')+'').toUpperCase().trim();}).join('|');"
                + "var isFy=/\\b20\\d{2}\\s*-\\s*\\d{2,4}\\b/.test(allTxt);"
                + "var isQ=/QUARTER\\s*[1-4]|\\bQ[1-4]\\b|APR\\s*-\\s*JUN|JUL\\s*-\\s*SEP|OCT\\s*-\\s*DEC|JAN\\s*-\\s*MAR/i.test(allTxt);"
                + "var isM=/JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER/.test(allTxt);"
                + "for(var o=0;o<ops.length;o++){var ot=((ops[o].text||'')+'').toUpperCase().trim();"
                + "if(!ot||/^SELECT/.test(ot))continue;"
                + "var otn=ot.replace(/\\s+/g,'');"
                + "var pick=false;"
                + "if(isFy&&FY&&otn.indexOf(FY.replace(/\\s+/g,''))>=0)pick=true;"
                + "else if(isQ&&QNUM&&(ot.indexOf('QUARTER '+QNUM)>=0||/\\bQ/.test(ot)&&ot.indexOf('Q'+QNUM)>=0||(qRng[QNUM]&&qRng[QNUM].test(ot))))pick=true;"
                + "else if((isM||(!isFy&&!isQ))&&((MONF&&ot.indexOf(MONF)>=0)||(monRe&&monRe.test(ot))))pick=true;"
                + "if(pick){if(sels[s].selectedIndex!==o){sels[s].selectedIndex=o;"
                + "sels[s].dispatchEvent(new Event('change',{bubbles:true}));changed=true;}break;}}}"
                + "if(changed) return out('SETTING');"
                + "for(var k=0;k<btns.length;k++){var t=btns[k];if(!vis(t))continue;"
                + "if(/^SEARCH$/i.test(flat(t))){t.click();return out('SEARCHED');}}"
                + "return out('DASH');}"
                // ---- "RETURN DASHBOARD" / "RETURNS DASHBOARD" ----
                + "var all=[].slice.call(document.querySelectorAll('a,button,span,li,div'));"
                + "for(var m=0;m<all.length;m++){var e=all[m];if(!vis(e))continue;"
                + "var et=flat(e).toUpperCase();"
                + "if(et==='RETURN DASHBOARD'||et==='RETURNS DASHBOARD'||et==='RETURN DASHBOARD >'){"
                + "var c=(e.closest?e.closest('a,button'):null)||e;try{c.click();}catch(x){}return out('OPENING');}}"
                + "return out('NONE');"
                + "}catch(e){return out('ERR:'+((e&&e.message)||e));}"
                + "})()";
        return js;
    }

    // ============================ download ============================

    private void injectBlobShim(WebView view) {
        if (view == null) return;
        String shim = "(function(){try{"
                + "if(window.__cgBlobShim)return;window.__cgBlobShim=1;"
                + "var map={};var origCreate=URL.createObjectURL;"
                + "URL.createObjectURL=function(b){var u=origCreate.call(URL,b);"
                + "try{if(b&&b.size){map[u]=b;var fr=new FileReader();fr.onload=function(){"
                + "window.__cgBlobB64=String(fr.result||'').split(',')[1]||'';};fr.readAsDataURL(b);}}catch(e){}"
                + "return u;};"
                + "var origClick=HTMLAnchorElement.prototype.click;"
                + "HTMLAnchorElement.prototype.click=function(){"
                + "try{var h=this.getAttribute('href')||'';if(h.indexOf('blob:')===0){"
                + "if(map[h]){var fr=new FileReader();fr.onload=function(){"
                + "window.__cgBlobB64=String(fr.result||'').split(',')[1]||'';};fr.readAsDataURL(map[h]);}"
                + "else if(window.fetch){fetch(h).then(function(r){return r.blob();}).then(function(b){"
                + "var fr=new FileReader();fr.onload=function(){window.__cgBlobB64=String(fr.result||'').split(',')[1]||'';};"
                + "fr.readAsDataURL(b);}).catch(function(){});}"
                + "}}catch(e){}return origClick.call(this);};"
                + "}catch(e){}})()";
        view.evaluateJavascript(shim, null);
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
        try { cookie = CookieManager.getInstance().getCookie(url); } catch (Exception ignored) { }
        fetchUrl(url, agent, cookie);
    }

    /** Portal kai baar blob URL deta hai -> injected shim ke __cgBlobB64 ko chunks me padhte hain. */
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
                            "Phone mode: portal blob download data padh nahi paye. Dobara try karein ya ☁️ Cloud mode use karein."));
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
                String ck = cookie;
                c = (HttpURLConnection) new URL(url).openConnection();
                c.setRequestProperty("User-Agent", agent);
                if (ck != null && !ck.isEmpty()) c.setRequestProperty("Cookie", ck);
                c.setRequestProperty("Referer", "https://return.gst.gov.in/");
                c.setConnectTimeout(30000);
                c.setReadTimeout(120000);
                c.setInstanceFollowRedirects(true);
                int code = c.getResponseCode();
                if (code != 200) {
                    deliver(reqId, err("download_failed", "Phone mode: 2B download HTTP " + code
                            + " — portal login/session check karein ya ☁️ Cloud mode use karein."));
                    return;
                }
                byte[] bodyBytes;
                try (InputStream in = c.getInputStream()) {
                    bodyBytes = readAll(in);
                }
                handleBytes(bodyBytes, agent);
            } catch (Exception e) {
                Log.w(TAG, "fetchUrl fail", e);
                deliver(reqId, err("download_failed",
                        "Phone mode: 2B file download nahi hui (" + e.getMessage() + "). ☁️ Cloud mode try karein."));
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
                deliver(reqId, err("bad_file",
                        "Phone mode: download me GSTR-2B JSON nahi mila (portal ne alag file di). ☁️ Cloud mode try karein."));
                return;
            }
            JSONObject g = new JSONObject();
            g.put("jsonBase64", Base64.encodeToString(json.getBytes(StandardCharsets.UTF_8), Base64.NO_WRAP));
            g.put("fileName", "gstr2b.json");
            g.put("bytes", json.getBytes(StandardCharsets.UTF_8).length);
            JSONObject p = baseOk();
            p.put("gstr2b", g);
            JSONObject tcs = new JSONObject();
            tcs.put("state", "skipped");
            tcs.put("message", "Phone mode: TCS data sirf ☁️ Cloud mode me aata hai.");
            p.put("tcs", tcs);
            p.put("warnings", new JSONArray().put("📱 Phone mode: GSTR-2B phone se fetch hui (cloud use nahi hua). TCS ke liye ☁️ Cloud."));
            deliver(reqId, p.toString());
        } catch (Exception e) {
            deliver(reqId, err("parse_failed", "Phone mode: 2B file khol nahi paye (" + e.getMessage() + ")."));
        }
    }

    private static String extractJson(byte[] bytes) throws Exception {
        if (bytes == null || bytes.length == 0) return null;
        boolean zip = bytes.length > 4 && bytes[0] == 0x50 && bytes[1] == 0x4B; // PK
        if (!zip) {
            String t = new String(bytes, StandardCharsets.UTF_8).replace("\uFEFF", "").trim();
            if (t.startsWith("{") || t.startsWith("[")) return t;
            if (t.startsWith("<")) return null; // HTML page (login/error)
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

    /** evaluateJavascript ka jawab ek JSON string hota hai — usse theek se decode karo. */
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

    // ============================ result ============================

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
