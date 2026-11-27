package com.cloudgst.app;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.util.Log;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.Profile;
import androidx.webkit.ProfileStore;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * 📱 Phone mode 100% hidden login — Multi-Profile (5 parallel isolated tabs).
 * Har slot (0..4) apna alag WebView Profile ("gst_slot_N") aur alag CookieManager use karta hai,
 * isliye 5 clients ek saath login aur fetch kar sakte hain bina session clash ke.
 */
public class PhoneLogin {

    public interface Callback {
        void done(String requestId, String payloadJson);
    }

    private static final String TAG = "PhoneLogin";
    private static final String LOGIN_URL = "https://services.gst.gov.in/services/login";
    private static final long PREFLIGHT_TIMEOUT_MS = 15000L;

    private final Activity act;
    private final int slot;
    private final Callback cb;
    private final Handler h = new Handler(Looper.getMainLooper());

    private WebView wv;
    private String reqId = "";
    private String username = "";
    private String password = "";
    private String lastLoggedInUser = "";
    private String captchaSrc = "";
    private int tries = 0;
    private int clicks = 0;
    private int phase = 0;
    private boolean finished = false;
    private boolean awaitingUserInput = false;
    private boolean wrongCapPending = false;
    private boolean otpMode = false;
    private volatile String stage = "idle";

    private static final int PHASE_IDLE = 0;
    private static final int PHASE_FIND_CAPTCHA = 1;
    private static final int PHASE_AFTER_SUBMIT = 2;

    public PhoneLogin(Activity act, int slot, Callback cb) {
        this.act = act;
        this.slot = Math.max(0, slot);
        this.cb = cb;
    }

    public static String profileNameFor(int slot) {
        return "gst_slot_" + Math.max(0, slot);
    }

    public static boolean multiProfileSupported() {
        try {
            return WebViewFeature.isFeatureSupported(WebViewFeature.MULTI_PROFILE);
        } catch (Throwable t) {
            return false;
        }
    }

    public static CookieManager cookieManagerForSlot(int slot) {
        if (multiProfileSupported()) {
            try {
                Profile p = ProfileStore.getInstance().getOrCreateProfile(profileNameFor(slot));
                return p.getCookieManager();
            } catch (Throwable ignored) { }
        }
        return CookieManager.getInstance();
    }

    public WebView web() {
        return wv;
    }

    public String stage() {
        return stage == null ? "" : stage;
    }

    public void start(String id, String user, String pass, ViewGroup host) {
        stage = "start";
        this.reqId = id == null ? "" : id;
        final String newUser = user == null ? "" : user.trim();
        final boolean switchingClient = !lastLoggedInUser.isEmpty()
                && !newUser.isEmpty()
                && !lastLoggedInUser.equalsIgnoreCase(newUser);

        this.username = newUser;
        this.password = pass == null ? "" : pass;
        finished = false;
        awaitingUserInput = false;
        wrongCapPending = false;
        otpMode = false;
        tries = 0;
        clicks = 0;
        captchaSrc = "";
        phase = PHASE_FIND_CAPTCHA;
        h.removeCallbacks(tickRun);
        h.removeCallbacks(timeoutRun);
        ensureWeb(host);

        new Thread(() -> {
            stage = "preflight";
            String netErr = preflight(LOGIN_URL);
            h.post(() -> {
                if (finished) return;
                if (netErr != null) {
                    deliver(err("network", "Internet/DNS problem: portal ka server hi nahi mila (" + netErr
                            + "). Wi-Fi/mobile data check karein, phir try karein."));
                    return;
                }
                Runnable beginLoad = () -> {
                    if (finished || wv == null) return;
                    stage = "load:login";
                    wv.loadUrl(LOGIN_URL);
                    h.postDelayed(tickRun, 1400);
                };
                if (switchingClient) {
                    stage = "clear-session";
                    lastLoggedInUser = "";
                    try {
                        CookieManager cm = cookieManagerForSlot(slot);
                        cm.removeAllCookies(ignored -> {
                            try { cm.flush(); } catch (Throwable ignored2) { }
                            beginLoad.run();
                        });
                    } catch (Throwable t) {
                        beginLoad.run();
                    }
                } else {
                    beginLoad.run();
                }
            });
        }).start();
        h.postDelayed(timeoutRun, 150000);
    }

    private static String preflight(String url) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout((int) PREFLIGHT_TIMEOUT_MS);
            c.setReadTimeout((int) PREFLIGHT_TIMEOUT_MS);
            c.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36");
            c.setInstanceFollowRedirects(true);
            c.getResponseCode();
            return null;
        } catch (Exception e) {
            String m = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
            return m.length() > 90 ? m.substring(0, 90) : m;
        } finally {
            if (c != null) try { c.disconnect(); } catch (Exception ignored) { }
        }
    }

    private final Runnable timeoutRun = new Runnable() {
        @Override
        public void run() {
            if (finished) return;
            deliver(err("timeout", "Phone login (Tab " + (slot + 1) + "): portal ne 150s me jawab nahi diya. Dobara try karein."));
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
        if (multiProfileSupported()) {
            try {
                WebViewCompat.setProfile(v, profileNameFor(slot));
            } catch (Throwable t) {
                Log.w(TAG, "setProfile fail slot=" + slot, t);
            }
        }
        WebSettings s = v.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setUserAgentString(s.getUserAgentString().replace("; wv", ""));
        CookieManager cm = cookieManagerForSlot(slot);
        cm.setAcceptCookie(true);
        cm.setAcceptThirdPartyCookies(v, true);

        v.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                if (finished || awaitingUserInput) return;
                h.removeCallbacks(tickRun);
                h.postDelayed(tickRun, 900);
            }

            @Override
            public void onReceivedError(WebView view, android.webkit.WebResourceRequest req,
                                        android.webkit.WebResourceError errInfo) {
                if (req != null && req.isForMainFrame()) {
                    String d = errInfo == null ? "" : (errInfo.getErrorCode() + " " + errInfo.getDescription());
                    h.post(() -> deliver(err("network", "Portal page load nahi hua (" + d
                            + "). Internet/DNS check karein, phir try karein.")));
                }
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

    private final Runnable tickRun = new Runnable() {
        @Override
        public void run() {
            if (finished || wv == null) return;
            tries++;
            final String js = phase == PHASE_FIND_CAPTCHA ? buildFindCaptchaScript() : buildAfterSubmitScript();
            wv.evaluateJavascript(js, value -> {
                String raw = decodeJsString(value);
                if (finished) return;
                JSONObject d = null;
                try { d = new JSONObject(raw); } catch (Exception ignored) { }
                String t = d == null ? "" : d.optString("t", "");
                stage = "poll:" + (t.isEmpty() ? "wait" : t);

                if ("CLICKLOGIN".equals(t)) {
                    if (clicks < 2) {
                        clicks++;
                        stage = "click-login";
                        h.postDelayed(tickRun, 2500);
                    } else if (tries >= 25) {
                        deliver(err("login_timeout", "Portal login form nahi khula — dobara try karein."));
                    } else {
                        h.postDelayed(tickRun, 1800);
                    }
                    return;
                }
                if ("CAPWAIT".equals(t)) {
                    if (tries >= 18) {
                        deliver(err("captcha_missing", "Login page par captcha image load nahi hui — dobara Re-Fetch dabayein."));
                        return;
                    }
                    h.postDelayed(tickRun, 1400);
                    return;
                }
                if ("CAPTCHA".equals(t)) {
                    captchaSrc = d.optString("src", "");
                    grabCaptcha();
                    return;
                }
                if ("IN".equals(t)) {
                    lastLoggedInUser = username;
                    try { cookieManagerForSlot(slot).flush(); } catch (Throwable ignored) { }
                    deliver(ok("loggedIn"));
                    return;
                }
                if ("OTPREQ".equals(t)) {
                    otpMode = true;
                    emitStep(ok("otpRequired"));
                    return;
                }
                if ("WRONGCAP".equals(t)) {
                    wrongCapPending = true;
                    phase = PHASE_FIND_CAPTCHA;
                    tries = 0;
                    stage = "reload-captcha";
                    h.postDelayed(tickRun, 1200);
                    return;
                }
                if ("ERRMSG".equals(t)) {
                    deliver(err("login_failed",
                            "Portal ne login rok diya: " + d.optString("msg", "ID/password check karein")));
                    return;
                }
                if (wrongCapPending && tries >= 4) {
                    wrongCapPending = false;
                    if (wv != null) wv.loadUrl(LOGIN_URL);
                    h.postDelayed(tickRun, 1800);
                    return;
                }
                if (tries >= 45) {
                    deliver(err("login_timeout",
                            "Phone login: portal ne form/Dashboard nahi diya (aakhri: "
                                    + (raw.length() > 140 ? raw.substring(0, 140) : raw) + "). Dobara try karein."));
                    return;
                }
                h.postDelayed(tickRun, 1600);
            });
        }
    };

    private void grabCaptcha() {
        stage = "captcha-image";
        final String src = captchaSrc == null ? "" : captchaSrc.trim();
        if (src.isEmpty()) {
            deliver(err("captcha_missing", "Login page par captcha nahi mila — dobara Re-Fetch dabayein."));
            return;
        }
        if (src.startsWith("data:")) {
            if (wrongCapPending) {
                wrongCapPending = false;
                emitStep(errWithCaptcha("captcha_wrong", "Captcha galat tha — naya captcha daalein.", src));
            } else {
                emitStep(okCaptcha(src));
            }
            return;
        }
        final String url = src.startsWith("http") ? src : "https://services.gst.gov.in" + (src.startsWith("/") ? "" : "/") + src;
        String cookie = "";
        try { cookie = cookieManagerForSlot(slot).getCookie(url); } catch (Throwable ignored) { }
        final String ck = cookie;
        new Thread(() -> {
            HttpURLConnection c = null;
            try {
                c = (HttpURLConnection) new URL(url).openConnection();
                if (ck != null && !ck.isEmpty()) c.setRequestProperty("Cookie", ck);
                c.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36");
                c.setRequestProperty("Referer", LOGIN_URL);
                c.setConnectTimeout(15000);
                c.setReadTimeout(15000);
                int code = c.getResponseCode();
                if (code != 200) {
                    h.post(() -> deliver(err("captcha_failed", "Captcha image HTTP " + code + " — dobara try karein.")));
                    return;
                }
                byte[] b;
                try (InputStream in = c.getInputStream()) {
                    b = readAll(in);
                }
                String b64 = "data:image/png;base64," + Base64.encodeToString(b, Base64.NO_WRAP);
                h.post(() -> {
                    if (wrongCapPending) {
                        wrongCapPending = false;
                        emitStep(errWithCaptcha("captcha_wrong", "Captcha galat tha — naya captcha daalein.", b64));
                    } else {
                        emitStep(okCaptcha(b64));
                    }
                });
            } catch (Exception e) {
                h.post(() -> deliver(err("captcha_failed", "Captcha image nahi aa payi (" + e.getMessage() + ").")));
            } finally {
                if (c != null) try { c.disconnect(); } catch (Exception ignored) { }
            }
        }).start();
    }

    public void submitCaptcha(String captcha) {
        stage = "submit-captcha";
        if (wv == null || finished) return;
        awaitingUserInput = false;
        wrongCapPending = false;
        phase = PHASE_AFTER_SUBMIT;
        tries = 0;
        h.removeCallbacks(tickRun);
        h.removeCallbacks(timeoutRun);
        h.postDelayed(timeoutRun, 150000);

        String js = "(function(){try{"
                + "function set(el,v){if(!el)return false;try{var d=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value');"
                + "d.set.call(el,v);}catch(e){el.value=v;}"
                + "el.dispatchEvent(new Event('input',{bubbles:true}));"
                + "el.dispatchEvent(new Event('change',{bubbles:true}));"
                + "el.dispatchEvent(new Event('blur',{bubbles:true}));return true;}"
                + "function byId(ids){for(var i=0;i<ids.length;i++){var e=document.getElementById(ids[i]);if(e)return e;}return null;}"
                + "var u=byId(['username','user_name','userid','login_name','userId'])||document.querySelector('input[name*=user i],input[id*=user i]');"
                + "var p=byId(['user_pass','password','pwd','userPassword_u'])||document.querySelector('input[type=password]');"
                + "var cp=byId(['captcha','captcha_code','captchacode','imgCaptchaText','captchaText'])"
                + "||document.querySelector('input[name*=captcha i],input[id*=captcha i]');"
                + "set(u," + JSONObject.quote(username) + ");set(p," + JSONObject.quote(password) + ");set(cp," + JSONObject.quote(captcha) + ");"
                + "var btns=(p&&p.form?p.form:document).querySelectorAll('button[type=submit],input[type=submit]');"
                + "for(var i=0;i<btns.length;i++){if(/LOGIN|SIGN/i.test(btns[i].innerText||btns[i].value||'')){btns[i].click();return 'OK';}}"
                + "if(btns[0]){btns[0].click();return 'OK';}"
                + "var allBtns=[].slice.call(document.querySelectorAll('button,input[type=submit],a.btn'));"
                + "for(var j=0;j<allBtns.length;j++){if(/LOGIN|SIGN IN/i.test(allBtns[j].innerText||allBtns[j].value||'')){allBtns[j].click();return 'CLICKED';}}"
                + "var f=p&&p.form;if(f&&f.submit){f.submit();return 'SUBMITTED';}"
                + "return 'NOTFOUND';}catch(e){return 'ERR';}})()";
        wv.evaluateJavascript(js, value -> {
            Log.i(TAG, "slot=" + slot + " submitCaptcha -> " + value);
            h.postDelayed(() -> {
                if (!finished && !awaitingUserInput) {
                    phase = PHASE_AFTER_SUBMIT;
                    tries = 0;
                    tickRun.run();
                }
            }, 2200);
        });
    }

    public void submitOtp(String otp) {
        stage = "submit-otp";
        if (wv == null || finished) return;
        awaitingUserInput = false;
        phase = PHASE_AFTER_SUBMIT;
        tries = 0;
        h.removeCallbacks(tickRun);
        h.removeCallbacks(timeoutRun);
        h.postDelayed(timeoutRun, 150000);

        String js = "(function(){try{"
                + "var el=document.querySelector('input[name*=otp i],input[id*=otp i],input[type=tel]')"
                + "||document.querySelector('input[placeholder*=OTP i]');"
                + "if(!el) return 'NOFIELD';"
                + "try{var d=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value');d.set.call(el," + JSONObject.quote(otp) + ");}"
                + "catch(e){el.value=" + JSONObject.quote(otp) + ";}"
                + "el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));"
                + "var btns=[].slice.call(document.querySelectorAll('button,input[type=submit]'));"
                + "for(var i=0;i<btns.length;i++){var t=((btns[i].innerText||btns[i].value||'')+'').toUpperCase();"
                + "if(t.indexOf('VERIFY')>=0||t.indexOf('SUBMIT')>=0||t.indexOf('CONTINUE')>=0){btns[i].click();return 'CLICKED';}}"
                + "var f=el.form;if(f&&f.submit){f.submit();return 'SUBMITTED';}return 'NOTFOUND';}catch(e){return 'ERR';}})()";
        wv.evaluateJavascript(js, value -> h.postDelayed(() -> {
            if (!finished && !awaitingUserInput) {
                tries = 0;
                tickRun.run();
            }
        }, 2400));
    }

    private String buildFindCaptchaScript() {
        return "(function(){try{"
                + "function vis(e){return !!(e&&e.offsetParent!==null);}"
                + "var D=document,Q=function(s,r){return [].slice.call((r||D).querySelectorAll(s));},"
                + "T=function(e){return String((e&&(e.innerText||e.textContent))||'').replace(/\\s+/g,' ').trim();},"
                + "imgToDataUrl=function(m){try{if(!m)return '';if(m.tagName==='CANVAS')return m.toDataURL('image/png');"
                + "if(!m.complete||!m.naturalWidth)return '';var c=D.createElement('canvas');c.width=m.naturalWidth;c.height=m.naturalHeight;"
                + "c.getContext('2d').drawImage(m,0,0);return c.toDataURL('image/png');}catch(e){return (m&&m.src&&m.complete&&m.naturalWidth)?m.src:'';}},"
                + "F=function(e,v){try{e.focus();var d=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');"
                + "if(d&&d.set)d.set.call(e,v);else e.value=v;"
                + "['input','keyup','change','blur'].forEach(function(n){e.dispatchEvent(new Event(n,{bubbles:true}));});"
                + "try{if(window.angular){var s=angular.element(e).scope();if(s&&s.$apply)s.$apply();}}catch(a){}}catch(x){}};"
                + "var B=T(D.body||D.documentElement),pw=null,u=null,cf=null;"
                + "Q('input').forEach(function(e){var g=((e.type||'')+' '+(e.id||'')+' '+(e.name||'')+' '+(e.placeholder||'')).toLowerCase();"
                + "if(!cf&&/captcha/.test(g))cf=e;else if(!pw&&(e.type==='password'||/pass|pwd/.test(g)))pw=e;"
                + "else if(!u&&/user|login|gstin|id/.test(g)&&(e.type||'text')!=='hidden')u=e;});"
                + "var cs='',di=D.getElementById('imgCaptcha')||D.querySelector('img[src*=captcha i],img[id*=captcha i]');"
                + "if(di)cs=imgToDataUrl(di);"
                + "if(!cs){Q('img,canvas').some(function(m){var id=((m.id||'')+' '+(m.src||'')+' '+(m.className||'')).toLowerCase();"
                + "if(m.tagName==='CANVAS'||/captcha/.test(id)){cs=imgToDataUrl(m);return !!cs;}return false;});}"
                + "if(!cs&&cf){var bx=cf.closest&&cf.closest('div,td,li,section,form');if(bx)Q('img,canvas',bx).some(function(m){cs=imgToDataUrl(m);return !!cs;});}"
                + "if(pw&&cs)return JSON.stringify({t:'CAPTCHA',src:cs});"
                + "if(pw&&!cs){if(u&&!window.__cgCapTrig){window.__cgCapTrig=1;F(u,'gstuser');try{pw.focus();pw.click();}catch(e){}}return JSON.stringify({t:'CAPWAIT'});}"
                + "if(!pw&&/dashboard|logout|sign out|return dashboard/i.test(B))return JSON.stringify({t:'IN'});"
                + "var hit=Q('button,a,input[type=button],input[type=submit]').some(function(b){if(!vis(b))return false;"
                + "if(/^(LOGIN|LOG IN|SIGN IN|PROCEED|CONTINUE|CLICK HERE)/.test(T(b).toUpperCase())){try{b.click();}catch(e){}return true;}return false;});"
                + "if(hit)return JSON.stringify({t:'CLICKLOGIN'});"
                + "return JSON.stringify({t:'WAIT',u:String(location.href||'').slice(0,90),pw:!!pw,user:!!u,cap:!!cs});"
                + "}catch(e){return JSON.stringify({t:'ERR',m:String((e&&e.message)||e)});}})()";
    }

    private String buildAfterSubmitScript() {
        return "(function(){try{"
                + "var body=String(((document.body&&(document.body.innerText||document.body.textContent))||'')).replace(/\\s+/g,' ');"
                + "var otp=document.querySelector('input[name*=otp i],input[id*=otp i],input[placeholder*=OTP i]');"
                + "if(otp) return JSON.stringify({t:'OTPREQ'});"
                + "var hasPw=!!document.querySelector('input[type=password]');"
                + "if(!hasPw&&/dashboard|logout|sign out|return dashboard/i.test(body)) return JSON.stringify({t:'IN'});"
                + "if(/invalid\\s+captcha|wrong\\s+captcha|captcha.*(mismatch|incorrect|invalid)|enter\\s+valid\\s+characters/i.test(body))"
                + "  return JSON.stringify({t:'WRONGCAP'});"
                + "if(/invalid\\s+(user\\s*id|username|password)|user\\s*id.*not\\s*(valid|exist)|incorrect\\s+password|account\\s+locked/i.test(body))"
                + "  return JSON.stringify({t:'ERRMSG',msg:body.slice(0,140)});"
                + "return JSON.stringify({t:'WAIT',u:String(location.href||'')});"
                + "}catch(e){return JSON.stringify({t:'WAIT'});}})()";
    }

    private String ok(String kind) {
        JSONObject p = new JSONObject();
        try {
            p.put("ok", true);
            p.put("source", "phone");
            if ("loggedIn".equals(kind)) p.put("loggedIn", true);
            if ("otpRequired".equals(kind)) p.put("otpRequired", true);
        } catch (Exception ignored) { }
        return p.toString();
    }

    private String okCaptcha(String b64) {
        JSONObject p = new JSONObject();
        try {
            p.put("ok", true);
            p.put("source", "phone");
            p.put("stage", "captcha");
            p.put("captchaBase64", b64);
        } catch (Exception ignored) { }
        return p.toString();
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

    private String errWithCaptcha(String code, String message, String captchaB64) {
        JSONObject p = new JSONObject();
        try {
            p.put("ok", false);
            p.put("source", "phone");
            p.put("code", code);
            p.put("error", message);
            p.put("captchaBase64", captchaB64);
        } catch (Exception ignored) { }
        return p.toString();
    }

    private void emitStep(final String payload) {
        if (finished) return;
        awaitingUserInput = true;
        stage = "await-user";
        h.removeCallbacks(tickRun);
        h.removeCallbacks(timeoutRun);
        final String rid = reqId;
        h.post(() -> {
            try {
                if (cb != null) cb.done(rid, payload);
            } catch (Exception e) {
                Log.w(TAG, "callback fail", e);
            }
        });
    }

    private void deliver(final String payload) {
        if (finished) return;
        finished = true;
        awaitingUserInput = false;
        stage = "done";
        h.removeCallbacks(tickRun);
        h.removeCallbacks(timeoutRun);
        final String rid = reqId;
        h.post(() -> {
            try {
                if (cb != null) cb.done(rid, payload);
            } catch (Exception e) {
                Log.w(TAG, "callback fail", e);
            }
        });
    }

    public boolean isBusy() {
        return !finished && !awaitingUserInput && wv != null && phase != PHASE_IDLE;
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

    static String decodeJsString(String v) {
        if (v == null || "null".equals(v) || v.isEmpty()) return "";
        try {
            return new JSONArray("[" + v + "]").getString(0);
        } catch (Exception e) {
            return v;
        }
    }

    private static byte[] readAll(InputStream in) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        return out.toByteArray();
    }

    static String b64Text(String s) {
        return Base64.encodeToString(s.getBytes(StandardCharsets.UTF_8), Base64.NO_WRAP);
    }
}
