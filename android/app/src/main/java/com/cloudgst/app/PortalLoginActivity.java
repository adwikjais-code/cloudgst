package com.cloudgst.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;
import java.util.Locale;

/**
 * GST portal app ke andar: ID + password pehle se bhare hue, aapko sirf captcha dalna hai.
 * Login aap khud dabate hain (auto-submit jaan-boojh kar nahi hai — account lock ka risk zero rahe).
 */
public class PortalLoginActivity extends Activity {

    private static final String LOGIN_URL = "https://services.gst.gov.in/services/login";

    private WebView web;
    private String username = "";
    private String password = "";
    private final Handler handler = new Handler(Looper.getMainLooper());
    private int tries = 0;
    private boolean injected = false;

    // GSTR-1 Prepare Online shortcut ke liye
    private String periodFp = "";        // "102026" (MMYYYY)
    private String periodLabel = "";     // "October (2026-27)"
    private int prepTries = 0;
    private boolean prepBusy = false;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        username = getIntent().getStringExtra("u");
        password = getIntent().getStringExtra("p");
        if (username == null) username = "";
        if (password == null) password = "";
        periodFp = getIntent().getStringExtra("fp");
        periodLabel = getIntent().getStringExtra("per");
        if (periodFp == null) periodFp = "";
        if (periodLabel == null) periodLabel = "";

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.parseColor("#0f172a"));

        // ---- top bar ----
        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setPadding(dp(12), dp(10), dp(8), dp(10));
        bar.setBackgroundColor(Color.parseColor("#0f172a"));

        TextView title = new TextView(this);
        title.setText("GST Portal  •  captcha dalein, Login dabayein");
        title.setTextColor(Color.parseColor("#e2e8f0"));
        title.setTextSize(12f);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0,
                ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        bar.addView(title, lp);

        // ---- GSTR-1 / GSTR-3B Prepare Online shortcuts (login ke baad ek click) ----
        Button g1 = new Button(this);
        g1.setText("📄 GSTR-1");
        g1.setTextColor(Color.parseColor("#052e1b"));
        g1.setTextSize(10f);
        g1.setAllCaps(false);
        g1.setBackgroundColor(Color.parseColor("#22c55e"));
        g1.setPadding(dp(8), 0, dp(8), 0);
        g1.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                openPrepare("GSTR-1");
            }
        });
        LinearLayout.LayoutParams lp1 = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp1.rightMargin = dp(4);
        bar.addView(g1, lp1);

        Button g3 = new Button(this);
        g3.setText("📄 GSTR-3B");
        g3.setTextColor(Color.parseColor("#052236"));
        g3.setTextSize(10f);
        g3.setAllCaps(false);
        g3.setBackgroundColor(Color.parseColor("#38bdf8"));
        g3.setPadding(dp(8), 0, dp(8), 0);
        g3.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                openPrepare("GSTR-3B");
            }
        });
        LinearLayout.LayoutParams lp3 = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp3.rightMargin = dp(6);
        bar.addView(g3, lp3);

        Button close = new Button(this);
        close.setText("✕");
        close.setTextColor(Color.WHITE);
        close.setTextSize(14f);
        close.setBackgroundColor(Color.parseColor("#334155"));
        close.setPadding(dp(10), 0, dp(10), 0);
        close.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                finish();
            }
        });
        bar.addView(close, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        root.addView(bar, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        // ---- webview ----
        web = new WebView(this);
        root.addView(web, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
        s.setUserAgentString(s.getUserAgentString().replace("; wv", ""));
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                tries = 0;
                injected = false;
                fillLoginFields();
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                String host = u.getHost() == null ? "" : u.getHost().toLowerCase(Locale.US);
                String scheme = u.getScheme() == null ? "" : u.getScheme().toLowerCase(Locale.US);
                boolean isGstHost = ("https".equals(scheme) || "http".equals(scheme))
                        && (host.equals("gst.gov.in") || host.endsWith(".gst.gov.in"));
                if (isGstHost) return false;
                if (!"https".equals(scheme) && !"http".equals(scheme)) return true;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, u));
                } catch (Exception ignored) { }
                return true;
            }
        });

        web.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String disposition,
                                        String mime, long size) {
                try {
                    Uri u = url == null ? null : Uri.parse(url);
                    String scheme = u == null || u.getScheme() == null ? "" : u.getScheme().toLowerCase(Locale.US);
                    if (!"https".equals(scheme) && !"http".equals(scheme)) {
                        Toast.makeText(PortalLoginActivity.this, "Invalid download URI scheme",
                                Toast.LENGTH_SHORT).show();
                        return;
                    }
                    startActivity(new Intent(Intent.ACTION_VIEW, u));
                } catch (Exception e) {
                    Toast.makeText(PortalLoginActivity.this, "Download link khol nahi paye",
                            Toast.LENGTH_SHORT).show();
                }
            }
        });

        web.loadUrl(LOGIN_URL);
    }

    /** Login page ke fields dhoondh kar ID/password bharta hai; har 1.2s me 10 baar tak retry. */
    private void fillLoginFields() {
        if (web == null) return;
        final String js = buildFillScript();
        web.evaluateJavascript(js, value -> {
            boolean ok = value != null && value.startsWith("true");
            if (ok) {
                injected = true;
                Toast.makeText(PortalLoginActivity.this,
                        "ID/password bhar diye — ab sirf captcha dalein", Toast.LENGTH_SHORT).show();
                return;
            }
            if (tries < 10) {
                tries++;
                handler.postDelayed(new Runnable() {
                    @Override
                    public void run() {
                        fillLoginFields();
                    }
                }, 1200);
            }
        });
    }

    // ================= GSTR-1 / GSTR-3B "Prepare Online" shortcut =================

    private String prepTarget = "GSTR-1";

    /** Login ke baad: portal ke apne buttons dabakar us month ka <type> Prepare Online page kholta hai. */
    private void openPrepare(final String type) {
        if (web == null) return;
        String url = web.getUrl() == null ? "" : web.getUrl();
        if (url.contains("/login") || url.contains("services/login")) {
            Toast.makeText(this, "Pehle captcha dalein aur Login dabayein — phir yeh button chalega",
                    Toast.LENGTH_LONG).show();
            return;
        }
        if (prepBusy) return;
        prepTarget = (type == null || type.isEmpty()) ? "GSTR-1" : type;
        prepBusy = true;
        prepTries = 0;
        Toast.makeText(this, prepTarget + " Prepare Online khol rahe hain…", Toast.LENGTH_SHORT).show();
        stepPrepare();
    }

    private void stepPrepare() {
        if (web == null) { prepBusy = false; return; }
        final String type = prepTarget;
        web.evaluateJavascript(buildPrepareScript(type), value -> {
            String v = value == null ? "" : value;
            // evaluateJavascript result JSON-escaped aata hai -> seedha token dhoondho
            if (v.contains("DONE") && !v.contains("NONE")) {
                prepBusy = false;
                String lbl = periodLabel.isEmpty() ? "us month" : periodLabel;
                Toast.makeText(PortalLoginActivity.this,
                        "✅ " + type + " Prepare Online khul gaya — month " + lbl + " check karein",
                        Toast.LENGTH_LONG).show();
                return;
            }
            if (prepTries < 12) {
                prepTries++;
                handler.postDelayed(new Runnable() {
                    @Override
                    public void run() {
                        stepPrepare();
                    }
                }, 1600);
            } else {
                prepBusy = false;
                Toast.makeText(PortalLoginActivity.this,
                        "⚠️ Portal ne " + type + " page khud nahi khola — dashboard par Returns → " + type + " dabayein",
                        Toast.LENGTH_LONG).show();
            }
        });
    }


    /**
     * Portal ke DOM me text dhoondh kar uske button/link dabata hai (kuch submit nahi karta):
     * dashboard -> GSTR-1 / GSTR-3B -> PREPARE ONLINE, aur wahan us month ka period select karta hai.
     * Return token: "DONE" | "CLICKED:PREPARE" | "CLICKED:TILE" | "NONE"
     */
    private String buildPrepareScript(String type) {
        boolean is3b = type != null && type.toUpperCase().contains("3B");
        String mon = periodLabel == null ? "" : periodLabel.toUpperCase();
        int cut = mon.indexOf('(');           // "OCTOBER (2026-27)" -> "OCTOBER"
        if (cut > 0) mon = mon.substring(0, cut).trim();
        String monShort = mon.length() >= 3 ? mon.substring(0, 3) : mon;
        String jsMonAlts = "[" + JSONObject.quote(mon) + "," + JSONObject.quote(monShort) + "]";

        String reTile1 = is3b ? "^GSTR-?3B$" : "^GSTR-?1$";
        String reTile2 = is3b ? "GSTR-?3B" : "GSTR-?1";
        String reUrl   = is3b ? "(gstr-?3b|return3b)" : "gstr-?1";
        String reDone  = is3b ? "SAVE GSTR-?3B|TAX ON OUTWARD|3\\.1 " : "SAVE GSTR-?1|B2B INVOICES|GSTR-?1 SUMMARY";

        return "(function(){try{"
                + "var MON_ALTS=" + jsMonAlts + ";"
                + "var RE_TILE1=new RegExp(" + JSONObject.quote(reTile1) + ");"
                + "var RE_TILE2=new RegExp(" + JSONObject.quote(reTile2) + ");"
                + "var RE_URL=new RegExp(" + JSONObject.quote(reUrl) + ",'i');"
                + "var RE_DONE=new RegExp(" + JSONObject.quote(reDone) + ",'i');"
                + "function vis(el){try{return !!(el&&el.offsetParent!==null);}catch(e){return false;}}"
                + "function txt(el){return ((el.innerText||el.textContent||'')+'').replace(/\\s+/g,' ').trim().toUpperCase();}"
                + "function clickEl(el){var c=(el.closest?el.closest('a,button'):null);"
                + "if(!c&&el.querySelector){c=el.querySelector('a,button');}if(!c)c=el;"
                + "try{c.scrollIntoView({block:'center'});}catch(e){}c.click();return true;}"
                + "function scan(re,sel){var nodes=[].slice.call(document.querySelectorAll(sel));"
                + "for(var i=0;i<nodes.length;i++){var el=nodes[i];if(!vis(el))continue;var t=txt(el);"
                + "if(!t||t.length>80)continue;if(re.test(t))return el;}return null;}"
                + "function find(re){return scan(re,'a,button')||scan(re,'span,div,li,td,h1,h2,h3,h4,p');}"
                + "var href=(location.href||'').toLowerCase();"
                + "var bodyTxt=txt(document.body||document.documentElement);"
                + "if((RE_URL.test(href)&&!/dashboard/.test(href))||RE_DONE.test(bodyTxt)){"
                + "var sels=[].slice.call(document.querySelectorAll('select'));"
                + "for(var i=0;i<sels.length;i++){var s=sels[i];var ops=[].slice.call(s.options||[]);var hit=-1;"
                + "for(var j=0;j<ops.length;j++){var ot=((ops[j].text||'')+'').toUpperCase();"
                + "for(var a=0;a<MON_ALTS.length;a++){var m=MON_ALTS[a];"
                + "if(m&&m.length>=3&&ot.indexOf(m)>=0){hit=j;break;}}if(hit>=0)break;}"
                + "if(hit>=0){s.selectedIndex=hit;s.dispatchEvent(new Event('change',{bubbles:true}));}}"
                + "return 'DONE';}"
                + "var p=find(/PREPARE ONLINE/);if(p){clickEl(p);return 'CLICKED:PREPARE';}"
                + "var g=find(RE_TILE1)||find(RE_TILE2);if(g){clickEl(g);return 'CLICKED:TILE';}"
                + "return 'NONE';"
                + "}catch(e){return 'NONE';}})()";
    }

    /** Login page ke fields dhoondh kar ID/password bharta hai. */
    private String buildFillScript() {
        String u = JSONObject.quote(username);
        String p = JSONObject.quote(password);
        // NOTE: sirf bharta hai (submit nahi karta) — captcha aap dalenge.
        StringBuilder js = new StringBuilder();
        js.append("(function(){try{");
        js.append("var U=").append(u).append(",P=").append(p).append(";");
        js.append("function fill(el,v){if(!el)return false;if(el.value===v)return true;");
        js.append("var d=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value');");
        js.append("try{d.set.call(el,v);}catch(e){el.value=v;}");
        js.append("el.dispatchEvent(new Event('input',{bubbles:true}));");
        js.append("el.dispatchEvent(new Event('change',{bubbles:true}));");
        js.append("el.dispatchEvent(new KeyboardEvent('keyup',{bubbles:true}));");
        js.append("el.dispatchEvent(new Event('blur',{bubbles:true}));return true;}");
        js.append("function byId(ids){for(var i=0;i<ids.length;i++){var e=document.getElementById(ids[i]);");
        js.append("if(e&&e.offsetParent!==null)return e;}return null;}");
        js.append("var pass=byId(['user_pass','password','pwd','pass','userPassword_u'])");
        js.append("||document.querySelector('input[type=password]');");
        js.append("var user=byId(['username','user_name','userid','userID','login_name','userId'])");
        js.append("||document.querySelector('input[name*=user i],input[id*=user i]');");
        js.append("if(!user&&pass){var all=Array.prototype.slice.call(document.querySelectorAll('input'));");
        js.append("var idx=all.indexOf(pass);");
        js.append("for(var i=idx-1;i>=0;i--){var t=(all[i].type||'text');");
        js.append("if(t==='text'&&all[i].offsetParent!==null){user=all[i];break;}}}");
        js.append("var a=fill(user,U);var b=fill(pass,P);");
        js.append("return (a&&b)?'true':'false';");
        js.append("}catch(e){return 'false';}})()");
        return js.toString();
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
