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
    private static final String RETURNS_DASHBOARD = "https://returns.gst.gov.in/returns/auth/dashboard";
    private static final long TICK_MS = 2600L;
    private static final long HARD_TIMEOUT_MS = 165000L;

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
    private String cachedUa = "Mozilla/5.0";
    private String lastToken = "";

    public PhoneFetch(Activity act, Callback cb) {
        this.act = act;
        this.cb = cb;
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
                                + "s me 2B page nahi diya (portal slow / naya login chahiye). ☁️ Cloud mode try karein."));
            }
        }
    };

    // ============================ hidden webview ============================

    private void ensureWeb(ViewGroup host) {
        if (wv != null) return;
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
                h.removeCallbacks(tickRun);
                h.postDelayed(tickRun, 900);
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
        // screen par kuch na dikhe: 1dp, invisible, non-interactive
        v.setAlpha(0f);
        v.setVisibility(View.INVISIBLE);
        v.setClickable(false);
        v.setFocusable(false);
        ViewGroup.LayoutParams lp = new ViewGroup.LayoutParams(1, 1);
        host.addView(v, lp);
        wv = v;
    }

    // ============================ page tick loop ============================

    private final Runnable tickRun = new Runnable() {
        @Override
        public void run() {
            if (finished || wv == null) return;
            ticks++;
            wv.evaluateJavascript(buildTickScript(), value -> {
                String tok = value == null ? "" : value.replace("\"", "").trim();
                lastToken = tok;
                if (finished) return;
                if ("LOGIN".equals(tok)) {
                    deliver(reqId, err("login_required",
                            "Is client ka GST portal login phone par nahi hai (session khatam / login nahi hua). "
                                    + "Ek baar 🌐 Portal Login se login karein (captcha aap dalenge), uske baad phone mode background me chalega."));
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
                            "Phone mode: portal ne 2B card/DOWNLOAD nahi diya (aakhri page: " + lastToken + "). "
                                    + "☁️ Cloud mode try karein."));
                    return;
                }
                h.postDelayed(tickRun, TICK_MS);
            });
        }
    };

    /** Ek hi script har tick par page dekh kar sahi kadam uthati hai. */
    private String buildTickScript() {
        String js = "(function(){try{"
                + "var FY=" + JSONObject.quote(fyLabel) + ",MONF=" + JSONObject.quote(monFull)
                + ",MONS=" + JSONObject.quote(monShort) + ";"
                + "function vis(e){try{return !!(e&&e.offsetParent!==null);}catch(x){return false;}}"
                + "function txt(e){return ((e&&(e.innerText||e.textContent))||'')+' '+'';}"
                + "function flat(e){return txt(e).replace(/\\s+/g,' ').trim();}"
                + "var href=(location.href||'').toLowerCase();"
                + "var hasPw=!!document.querySelector('input[type=password]');"
                + "if(href.indexOf('/login')>=0||hasPw) return 'LOGIN';"
                + "var body=flat(document.body||document.documentElement);"
                + "if(/not\\s+generated/i.test(body)&&/2B/i.test(body)) return 'NOTGEN';"
                // ---- 2B card ka DOWNLOAD (search ke baad) ----
                + "var btns=[].slice.call(document.querySelectorAll('button,a,input[type=button]'));"
                + "for(var i=0;i<btns.length;i++){var b=btns[i];if(!vis(b))continue;"
                + "if(!/DOWNLOAD/i.test(flat(b)))continue;"
                + "var p=b.parentNode,hops=0,hit=false;"
                + "while(p&&hops<5){if(/GSTR-?2B/i.test(flat(p))){hit=true;break;}p=p.parentNode;hops++;}"
                + "if(hit){try{b.scrollIntoView({block:'center'});}catch(x){}b.click();return 'CLICKED';}}"
                // ---- dashboard: FY + Month select, phir SEARCH ----
                + "var sels=[].slice.call(document.querySelectorAll('select'));"
                + "if(sels.length){var fySet=false,monSet=false;"
                + "for(var s=0;s<sels.length;s++){var ops=[].slice.call(sels[s].options||[]);"
                + "for(var o=0;o<ops.length;o++){var ot=((ops[o].text||'')+'').toUpperCase();var otn=ot.replace(/\\s+/g,'');"
                + "if(!fySet&&FY&&otn.indexOf(FY.replace(/\\s+/g,''))>=0){sels[s].selectedIndex=o;"
                + "sels[s].dispatchEvent(new Event('change',{bubbles:true}));fySet=true;}"
                + "else if(!monSet&&((MONF&&ot.indexOf(MONF)>=0)||(MONS.length>=3&&ot.replace(/[^A-Z]/g,'').indexOf(MONS)>=0))){"
                + "sels[s].selectedIndex=o;sels[s].dispatchEvent(new Event('change',{bubbles:true}));monSet=true;}}}"
                + "if(fySet||monSet) return 'SETTING';"
                + "for(var k=0;k<btns.length;k++){var t=btns[k];if(!vis(t))continue;"
                + "if(/^SEARCH$/i.test(flat(t))){t.click();return 'SEARCHED';}}"
                + "return 'DASH';}"
                // ---- "RETURN DASHBOARD" / "RETURNS DASHBOARD" ----
                + "var all=[].slice.call(document.querySelectorAll('a,button,span,li,div'));"
                + "for(var m=0;m<all.length;m++){var e=all[m];if(!vis(e))continue;"
                + "var et=flat(e).toUpperCase();"
                + "if(et==='RETURN DASHBOARD'||et==='RETURNS DASHBOARD'||et==='RETURN DASHBOARD >'){"
                + "var c=(e.closest?e.closest('a,button'):null)||e;try{c.click();}catch(x){}return 'OPENING';}}"
                + "return 'NONE';"
                + "}catch(e){return 'NONE';}})()";
        return js;
    }

    // ============================ download ============================

    private void onClickedDownload(String url, String ua) {
        if (url == null || url.isEmpty()) return;
        String agent = (ua == null || ua.isEmpty()) ? cachedUa : ua;
        if (url.startsWith("blob:")) {
            readBlobChunk(0, new StringBuilder(), agent);
            return;
        }
        String cookie = "";
        try { cookie = CookieManager.getInstance().getCookie(url); } catch (Exception ignored) { }
        fetchUrl(url, agent, cookie);
    }

    /** Portal kai baar blobar URL deta hai -> JS se base64 chunks me padhte hain. */
    private void readBlobChunk(final int offset, final StringBuilder acc, final String ua) {
        if (finished || wv == null) return;
        final int CH = 200000;
        final int from = offset;
        wv.evaluateJavascript("(function(){try{var s=window.__cgBlobB64||'';return s.slice(" + from
                + "," + (from + CH) + ");}catch(e){return '';}})()", value -> {
            String chunk = unquote(value);
            if (chunk.isEmpty()) {
                if (acc.length() > 100) {
                    handleBytes(Base64.decode(acc.toString(), Base64.DEFAULT), ua);
                } else {
                    // blob abhi taiyar nahi -> thoda ruk kar dobara (max 15 baar)
                    if (offset == 0 && ticks < 60) {
                        h.postDelayed(() -> {
                            if (!finished) readBlobChunk(0, acc, ua);
                        }, 1500);
                    }
                }
                return;
            }
            acc.append(chunk);
            if (chunk.length() < CH) {
                handleBytes(Base64.decode(acc.toString(), Base64.DEFAULT), ua);
            } else {
                readBlobChunk(offset + CH, acc, ua);
            }
        });
    }

    private void fetchUrl(final String url, final String ua, final String cookie) {
        new Thread(() -> {
            try {
                final String agent = (ua == null || ua.isEmpty()) ? "Mozilla/5.0" : ua;
                String ck = cookie;
                HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                c.setRequestProperty("User-Agent", agent);
                if (ck != null && !ck.isEmpty()) c.setRequestProperty("Cookie", ck);
                c.setRequestProperty("Referer", "https://returns.gst.gov.in/");
                c.setConnectTimeout(30000);
                c.setReadTimeout(120000);
                c.setInstanceFollowRedirects(true);
                int code = c.getResponseCode();
                if (code != 200) {
                    deliver(reqId, err("download_failed", "Phone mode: 2B download HTTP " + code
                            + " — portal login/session check karein ya ☁️ Cloud mode use karein."));
                    return;
                }
                handleBytes(readAll(c.getInputStream()), agent);
            } catch (Exception e) {
                Log.w(TAG, "fetchUrl fail", e);
                deliver(reqId, err("download_failed",
                        "Phone mode: 2B file download nahi hui (" + e.getMessage() + "). ☁️ Cloud mode try karein."));
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
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        return out.toByteArray();
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
