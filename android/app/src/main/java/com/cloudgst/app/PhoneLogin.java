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

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * 📱 Phone mode ka login — cloud bridge jaisa, par phone par hi.
 *
 * Chhupe (invisible) WebView me GST portal ka login page khulta hai, captcha ki IMAGE app ko
 * bheji jati hai (aap app me hi captcha dalkar Login dabate hain), phir OTP (agar portal maange),
 * aur login hone ke baad session (cookies) phone me hi reh jata hai — usi se 2B fetch hota hai.
 *
 * Entry points (MainActivity bridge se):
 *   start(user, pass)        -> {ok, captchaBase64} | {ok:false, code, error}
 *   submitCaptcha(captcha)   -> {ok, otpRequired|loggedIn} | {code:"captcha_wrong", captchaBase64}
 *   submitOtp(otp)           -> {ok, loggedIn} | {ok:false, code, error}
 */
public class PhoneLogin {

    public interface Callback {
        void done(String payloadJson);
    }

    private static final String TAG = "PhoneLogin";
    private static final String LOGIN_URL = "https://services.gst.gov.in/services/login";
    private static final long PREFLIGHT_TIMEOUT_MS = 15000L;

    private final Activity act;
    private final Callback cb;
    private final Handler h = new Handler(Looper.getMainLooper());

    private WebView wv;
    private String username = "";
    private String password = "";
    private String captchaSrc = "";
    private int tries = 0;
    private int clicks = 0;
    private int phase = 0;                 // 0 = idle, 1 = captcha dhoondh rahe, 2 = submit ke baad
    private boolean finished = false;
    private boolean otpMode = false;
    private volatile String stage = "idle";
    private boolean manual = false;

    private static final int PHASE_IDLE = 0;
    private static final int PHASE_FIND_CAPTCHA = 1;
    private static final int PHASE_AFTER_SUBMIT = 2;

    public PhoneLogin(Activity act, Callback cb) {
        this.act = act;
        this.cb = cb;
    }

    // ======================= start =======================

    /** Chhupa WebView (overlay me dikhane ke liye). */
    public WebView web() {
        return wv;
    }

    /** App ko progress dikhane / debug ke liye (screen par status). */
    public String stage() {
        return stage == null ? "" : stage;
    }

    public void start(String id, String user, String pass, ViewGroup host) {
        stage = "start";
        this.username = user == null ? "" : user.trim();
        this.password = pass == null ? "" : pass;
        finished = false;
        otpMode = false;
        tries = 0;
        captchaSrc = "";
        phase = PHASE_FIND_CAPTCHA;
        manual = false;
        ensureWeb(host);
        // Pehle network check — DNS/internet dikkat ho to saaf message mile
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
                stage = "load:login";
                if (wv != null) wv.loadUrl(LOGIN_URL);
                h.postDelayed(tickRun, 1200);
            });
        }).start();
        h.postDelayed(timeoutRun, 150000);
    }

    private static String preflight(String url) {
        try {
            HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout((int) PREFLIGHT_TIMEOUT_MS);
            c.setReadTimeout((int) PREFLIGHT_TIMEOUT_MS);
            c.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36");
            c.setInstanceFollowRedirects(true);
            c.getResponseCode();
            return null;
        } catch (Exception e) {
            String m = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
            return m.length() > 90 ? m.substring(0, 90) : m;
        }
    }

    /** Login page pehchana nahi gaya -> ek baar visible login (captcha/OTP user dalega), phir background. */
    private void deliverManualLogin(JSONObject d) {
        String info = "";
        if (d != null) {
            info = " | page: " + d.optString("u", "") + " | inputs: " + d.optInt("inputs", -1)
                    + " | imgs: " + d.optInt("imgs", -1) + (d.optString("b", "").isEmpty() ? "" : " | text: " + d.optString("b", ""));
        }
        deliver(err("manual_login",
                "Phone login: portal ka login page apne aap nahi pehchana gaya" + info
                        + " — ek baar login screen khol rahe hain (captcha/OTP aap dalenge), uske baad phone mode background me chalega."));
    }

    private final Runnable timeoutRun = new Runnable() {
        @Override
        public void run() {
            if (finished) return;
            deliver(err("timeout", "Phone login: portal ne 150s me jawab nahi diya. ☁️ Cloud mode try karein."));
        }
    };

    // ======================= hidden webview =======================

    private void ensureWeb(ViewGroup host) {
        if (wv != null) return;
        final WebView v = new WebView(act);
        WebSettings s = v.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setUserAgentString(s.getUserAgentString().replace("; wv", ""));
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(v, true);
        v.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                if (finished) return;
                h.removeCallbacks(tickRun);
                h.postDelayed(tickRun, 700);
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
        v.setClickable(false);
        v.setFocusable(false);
        v.setVerticalScrollBarEnabled(false);
        ViewGroup.LayoutParams lp = new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
        host.addView(v, 0, lp);   // app ke WebView ke peechhe — render hota hai, dikhta nahi
        wv = v;
    }

    // ======================= polling =======================

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
                    if (clicks < 2) { clicks++; stage = "click-login"; h.postDelayed(tickRun, 2500); }
                    else if (tries >= 12) { if (!manual) { manual = true; stage = "manual-wait"; } h.postDelayed(tickRun, 1800); }
                    else h.postDelayed(tickRun, 1800);
                    return;
                }
                if (d != null && d.optBoolean("nocap", false)) {
                    captchaSrc = "";
                    deliver(err("captcha_missing", "Login page par captcha image nahi mila (form mila). ☁️ Cloud mode try karein."));
                    return;
                }
                if ("WAIT".equals(t) && tries >= 12) {
                    // Page pehchana nahi gaya -> app ke andar hi portal dikha dete hain (alag screen nahi),
                    // user captcha/OTP dalega, phir wahi flow aage badhega.
                    if (!manual) { manual = true; stage = "manual-wait"; }
                    if (wv != null) { wv.setAlpha(1f); wv.setClickable(true); wv.setFocusable(true); }
                }
                if ("CAPTCHA".equals(t)) {
                    captchaSrc = d.optString("src", "");
                    grabCaptcha();
                    return;
                }
                if ("IN".equals(t)) {
                    deliver(ok("loggedIn"));
                    return;
                }
                if ("OTPREQ".equals(t)) {
                    otpMode = true;
                    deliver(ok("otpRequired"));
                    return;
                }
                if ("WRONGCAP".equals(t)) {
                    // captcha galat -> naya captcha bhejo
                    phase = PHASE_FIND_CAPTCHA;
                    tries = 0;
                    if (wv != null) wv.reload();
                    h.postDelayed(tickRun, 1500);
                    return;
                }
                if ("ERRMSG".equals(t)) {
                    deliver(err("login_failed",
                            "Portal ne login rok diya: " + d.optString("msg", "wajah pata nahi chali")));
                    return;
                }
                if (tries >= (manual ? 220 : 40)) {
                    deliver(err("login_timeout",
                            "Phone login: portal ne form/Dashboard hi nahi diya (aakhri: " + (raw.length() > 160 ? raw.substring(0, 160) : raw)
                                    + "). ☁️ Cloud mode try karein."));
                    return;
                }
                h.postDelayed(tickRun, 1600);
            });
        }
    };

    // ======================= captcha image =======================

    private void grabCaptcha() {
        stage = "captcha-image";
        final String src = captchaSrc == null ? "" : captchaSrc.trim();
        if (src.isEmpty()) {
            deliver(err("captcha_missing", "Login page par captcha nahi mila — ☁️ Cloud mode try karein."));
            return;
        }
        if (src.startsWith("data:")) {
            deliver(okCaptcha(src));
            return;
        }
        final String url = src.startsWith("http") ? src : "https://services.gst.gov.in" + (src.startsWith("/") ? "" : "/") + src;
        new Thread(() -> {
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                String ck = CookieManager.getInstance().getCookie(url);
                if (ck != null && !ck.isEmpty()) c.setRequestProperty("Cookie", ck);
                c.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36");
                c.setRequestProperty("Referer", LOGIN_URL);
                c.setConnectTimeout(15000);
                c.setReadTimeout(15000);
                int code = c.getResponseCode();
                if (code != 200) {
                    h.post(() -> deliver(err("captcha_failed", "Captcha image HTTP " + code + " — ☁️ Cloud mode try karein.")));
                    return;
                }
                byte[] b = readAll(c.getInputStream());
                String b64 = "data:image/png;base64," + Base64.encodeToString(b, Base64.NO_WRAP);
                h.post(() -> deliver(okCaptcha(b64)));
            } catch (Exception e) {
                h.post(() -> deliver(err("captcha_failed", "Captcha image nahi aa payi (" + e.getMessage() + ").")));
            }
        }).start();
    }

    // ======================= actions =======================

    public void submitCaptcha(String captcha) {
        stage = "submit-captcha";
        if (wv == null || finished) return;
        phase = PHASE_AFTER_SUBMIT;
        tries = 0;
        String js = "(function(){try{"
                + "function set(el,v){if(!el)return false;try{var d=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value');"
                + "d.set.call(el,v);}catch(e){el.value=v;}"
                + "el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return true;}"
                + "function byId(ids){for(var i=0;i<ids.length;i++){var e=document.getElementById(ids[i]);if(e)return e;}return null;}"
                + "var u=byId(['username','user_name','userid','login_name','userId'])||document.querySelector('input[name*=user i],input[id*=user i]');"
                + "var p=byId(['user_pass','password','pwd','userPassword_u'])||document.querySelector('input[type=password]');"
                + "var cp=byId(['captcha','captcha_code','captchacode','imgCaptchaText','captchaText'])"
                + "||document.querySelector('input[name*=captcha i],input[id*=captcha i]');"
                + "set(u," + JSONObject.quote(username) + ");set(p," + JSONObject.quote(password) + ");set(cp," + JSONObject.quote(captcha) + ");"
                + "var btns=[].slice.call(document.querySelectorAll('button,input[type=submit],a.btn'));"
                + "for(var i=0;i<btns.length;i++){var t=((btns[i].innerText||btns[i].value||'')+'').toUpperCase();"
                + "if(t.indexOf('LOGIN')>=0||t.indexOf('SIGN IN')>=0){btns[i].click();return 'CLICKED';}}"
                + "var f=p&&p.form;if(f&&f.submit){f.submit();return 'SUBMITTED';}"
                + "return 'NOTFOUND';}catch(e){return 'ERR';}})()";
        wv.evaluateJavascript(js, value -> {
            Log.i(TAG, "submitCaptcha -> " + value);
            if (wv != null) wv.reload();          // reload se session/cookie fresh, phir poll
            h.postDelayed(() -> { phase = PHASE_AFTER_SUBMIT; tries = 0; tickRun.run(); }, 2500);
        });
    }

    public void submitOtp(String otp) {
        stage = "submit-otp";
        if (wv == null || finished) return;
        phase = PHASE_AFTER_SUBMIT;
        tries = 0;
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
        wv.evaluateJavascript(js, value -> h.postDelayed(() -> { tries = 0; tickRun.run(); }, 2600));
    }

    // ======================= page scripts =======================

    private String buildFindCaptchaScript() {
        return "(function(){try{"
                + "function q(s){return !!document.querySelector(s);}"
                + "function vis(e){try{return !!(e&&(e.offsetParent!==null||(e.getClientRects&&e.getClientRects().length)));}catch(x){return false;}}"
                + "function txt(e){return String((e&&(e.innerText||e.textContent))||'').replace(/\\s+/g,' ').trim();}"
                + "var body=txt(document.body||document.documentElement);"
                + "var inputs=[].slice.call(document.querySelectorAll('input'));"
                + "var pw=null,user=null,capField=null;"
                + "for(var i=0;i<inputs.length;i++){var el=inputs[i];var sig=((el.type||'')+' '+(el.id||'')+' '+(el.name||'')+' '+(el.placeholder||'')).toLowerCase();"
                + "if(!capField&&/captcha/.test(sig)) capField=el;"
                + "else if(!pw&&((el.type||'')==='password'||/pass|pwd/.test(sig))) pw=el;"
                + "else if(!user&&/user|login|gstin|id/.test(sig)&&(el.type||'text')!=='hidden') user=el;}"
                + "var imgs=[].slice.call(document.querySelectorAll('img,canvas'));"
                + "var capSrc='';"
                + "for(var j=0;j<imgs.length;j++){var im=imgs[j];"
                + "if(im.tagName==='CANVAS'){try{capSrc=im.toDataURL('image/png');}catch(e){}if(capSrc)break;continue;}"
                + "var id=((im.id||'')+' '+(im.name||'')+' '+(im.className||'')+' '+(im.src||'')+' '+(im.alt||'')).toLowerCase();"
                + "if(/captcha/.test(id)&&im.src){capSrc=im.src;break;}}"
                + "if(!capSrc&&capField){var box=capField.closest?capField.closest('div,td,li,section,form'):null;if(box){var bi=[].slice.call(box.querySelectorAll('img,canvas'));"
                + "for(var k=0;k<bi.length;k++){var e2=bi[k];if(e2.tagName==='CANVAS'){try{capSrc=e2.toDataURL('image/png');}catch(e){}}else if(e2.src){capSrc=e2.src;}if(capSrc)break;}}}"
                + "if(pw&&capSrc) return JSON.stringify({t:'CAPTCHA',src:capSrc});"
                + "if(pw&&!capSrc) return JSON.stringify({t:'CAPTCHA',src:'',nocap:true});"
                + "if(!pw&&/dashboard|logout|sign out|return dashboard/i.test(body)) return JSON.stringify({t:'IN'});"
                // login page par ho par form na mile -> "LOGIN/PROCEED/CONTINUE" dabao
                + "var btns=[].slice.call(document.querySelectorAll('button,a,input[type=button],input[type=submit]'));"
                + "for(var m=0;m<btns.length;m++){var b=btns[m];if(!vis(b))continue;var bt=txt(b).toUpperCase();"
                + "if(/^(LOGIN|LOG IN|SIGN IN|PROCEED|CONTINUE|CLICK HERE)/.test(bt)){try{b.click();}catch(e){}return JSON.stringify({t:'CLICKLOGIN'});}}"
                + "return JSON.stringify({t:'WAIT',u:String(location.href||'').slice(0,120),inputs:inputs.length,imgs:imgs.length,"
                + "pw:!!pw,user:!!user,cap:!!capSrc,b:body.slice(0,120)});"
                + "}catch(e){return JSON.stringify({t:'ERR',m:String((e&&e.message)||e)});}})()";
    }

    private String buildAfterSubmitScript() {
        return "(function(){try{"
                + "var body=String(((document.body&&(document.body.innerText||document.body.textContent))||'')).replace(/\\s+/g,' ');"
                + "var otp=document.querySelector('input[name*=otp i],input[id*=otp i],input[placeholder*=OTP i]');"
                + "if(otp) return JSON.stringify({t:'OTPREQ'});"
                + "var hasPw=!!document.querySelector('input[type=password]');"
                + "if(!hasPw&&/dashboard|logout|sign out/i.test(body)) return JSON.stringify({t:'IN'});"
                + "if(/invalid\\s+captcha|wrong\\s+captcha|captcha.*(mismatch|incorrect|invalid)/i.test(body))"
                + "  return JSON.stringify({t:'WRONGCAP'});"
                + "if(/invalid\\s+(user\\s*id|username|password)|user\\s*id.*not\\s*(valid|exist)|incorrect\\s+password/i.test(body))"
                + "  return JSON.stringify({t:'ERRMSG',msg:body.slice(0,140)});"
                + "return JSON.stringify({t:'WAIT',u:String(location.href||'')});"
                + "}catch(e){return JSON.stringify({t:'WAIT'});}})()";
    }

    // ======================= helpers =======================

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

    private void deliver(final String payload) {
        if (finished) return;
        finished = true;
        stage = "done";
        h.removeCallbacks(tickRun);
        h.removeCallbacks(timeoutRun);
        h.post(() -> {
            try {
                if (cb != null) cb.done(payload);
            } catch (Exception e) {
                Log.w(TAG, "callback fail", e);
            }
        });
    }

    /** true = login chal raha hai (naya start rokne ke liye). */
    public boolean isBusy() {
        return !finished && wv != null && phase != PHASE_IDLE;
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
