package com.cloudgst.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.hardware.biometrics.BiometricManager;
import android.hardware.biometrics.BiometricPrompt;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;

/**
 * CloudGST — Android wrapper.
 *  - App ka UI: assets/app/ (https://appassets.androidplatform.net se serve) => browser jaisa behaviour
 *  - Swipe-back / back gesture: JS (cloudGstHandleBack) se poochta hai -> modal, page, phir app band
 *  - Fingerprint lock: app khulte hi biometric (ya device PIN) — Settings me ON/OFF
 */
public class MainActivity extends Activity {

    public static final String APP_URL = "https://appassets.androidplatform.net/assets/app/index.html";
    private static final int REQ_FILE = 1001;
    private static final String PREFS = "cloudgst";
    private static final String PREF_BIO_LOCK = "bio_lock";

    private WebView web;
    private FrameLayout rootView;
    private View lockView;
    private ValueCallback<Uri[]> filePathCallback;
    private boolean appLoaded = false;
    private SharedPreferences prefs;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences(PREFS, MODE_PRIVATE);

        rootView = new FrameLayout(this);
        web = new WebView(this);
        rootView.addView(web, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportMultipleWindows(false);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                String host = u.getHost() == null ? "" : u.getHost();
                if (host.equals("appassets.androidplatform.net")) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, u));
                } catch (Exception ignored) { }
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                view.evaluateJavascript("window.document.documentElement.classList.add('native-app');", null);
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb,
                                             FileChooserParams params) {
                if (filePathCallback != null) filePathCallback.onReceiveValue(null);
                filePathCallback = cb;
                try {
                    startActivityForResult(params.createIntent(), REQ_FILE);
                    return true;
                } catch (Exception e) {
                    filePathCallback = null;
                    return false;
                }
            }
        });

        web.addJavascriptInterface(new NativeBridge(this), "CloudGSTNative");

        setContentView(rootView);

        // ---- back / swipe gesture (Android 13+ predictive back) ----
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,
                    new android.window.OnBackInvokedCallback() {
                        @Override
                        public void onBackInvoked() {
                            handleBack();
                        }
                    });
        }

        if (needsLock()) {
            showLockScreen();
        } else {
            loadApp();
        }
    }

    private void loadApp() {
        if (!appLoaded) {
            appLoaded = true;
            web.loadUrl(APP_URL);
        }
    }

    // ================= back handling =================

    @Override
    public void onBackPressed() {
        handleBack();
    }

    private void handleBack() {
        if (lockView != null && lockView.getParent() != null) {
            finish();                       // locked state me back = app band
            return;
        }
        if (web == null) {
            finish();
            return;
        }
        // pehle app (JS) se poochho: modal / pichhla page? -> wahi handle kare
        web.evaluateJavascript("(window.cloudGstHandleBack?window.cloudGstHandleBack():false)", value -> {
            boolean handledByJs = "true".equals(value);
            if (handledByJs) return;
            if (web.canGoBack()) web.goBack();
            else finish();
        });
    }

    // ================= fingerprint lock =================

    private boolean biometricSupported() {
        if (Build.VERSION.SDK_INT < 28) return false;
        try {
            BiometricManager bm = getSystemService(BiometricManager.class);
            if (bm == null) return false;
            int can = bm.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK
                    | BiometricManager.Authenticators.DEVICE_CREDENTIAL);
            return can == BiometricManager.BIOMETRIC_SUCCESS;
        } catch (Exception e) {
            return false;
        }
    }

    private boolean needsLock() {
        return biometricSupported() && prefs.getBoolean(PREF_BIO_LOCK, false);
    }

    private void showLockScreen() {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        box.setBackgroundColor(Color.parseColor("#0f172a"));
        box.setPadding(dp(24), dp(24), dp(24), dp(24));

        TextView icon = new TextView(this);
        icon.setText("🔒");
        icon.setTextSize(46f);
        icon.setGravity(Gravity.CENTER);
        box.addView(icon);

        TextView title = new TextView(this);
        title.setText("CloudGST");
        title.setTextColor(Color.WHITE);
        title.setTextSize(20f);
        title.setGravity(Gravity.CENTER);
        title.setPadding(0, dp(10), 0, dp(4));
        box.addView(title);

        TextView sub = new TextView(this);
        sub.setText("Fingerprint ya device PIN se kholein");
        sub.setTextColor(Color.parseColor("#94a3b8"));
        sub.setTextSize(12f);
        sub.setGravity(Gravity.CENTER);
        sub.setPadding(0, 0, 0, dp(22));
        box.addView(sub);

        Button unlock = new Button(this);
        unlock.setText("👆 Unlock");
        unlock.setTextColor(Color.parseColor("#06281a"));
        unlock.setBackgroundColor(Color.parseColor("#22c55e"));
        unlock.setPadding(dp(28), dp(10), dp(28), dp(10));
        unlock.setOnClickListener(v -> askBiometric(true));
        box.addView(unlock);

        Button quit = new Button(this);
        quit.setText("App band karein");
        quit.setTextColor(Color.parseColor("#cbd5e1"));
        quit.setBackgroundColor(Color.parseColor("#1e293b"));
        quit.setPadding(dp(20), dp(8), dp(20), dp(8));
        LinearLayout.LayoutParams qlp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        qlp.topMargin = dp(14);
        quit.setOnClickListener(v -> finish());
        box.addView(quit, qlp);

        lockView = box;
        rootView.addView(lockView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        askBiometric(false);
    }

    /** Biometric (biometric ya device PIN) — success par app khul jata hai. */
    private void askBiometric(final boolean fromButton) {
        if (!biometricSupported()) {
            unlockApp();
            return;
        }
        try {
            BiometricPrompt prompt = new BiometricPrompt.Builder(this)
                    .setTitle("CloudGST unlock")
                    .setSubtitle("Fingerprint / device PIN")
                    .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_WEAK
                            | BiometricManager.Authenticators.DEVICE_CREDENTIAL)
                    .build();
            prompt.authenticate(new CancellationSignal(), getMainExecutor(),
                    new BiometricPrompt.AuthenticationCallback() {
                        @Override
                        public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                            unlockApp();
                        }

                        @Override
                        public void onAuthenticationError(int errorCode, CharSequence errString) {
                            if (fromButton) {
                                Toast.makeText(MainActivity.this, "Unlock nahi hua — dobara try karein",
                                        Toast.LENGTH_SHORT).show();
                            }
                        }
                    });
        } catch (Exception e) {
            unlockApp();
        }
    }

    private void unlockApp() {
        if (lockView != null && lockView.getParent() != null) {
            rootView.removeView(lockView);
        }
        loadApp();
    }

    // ================= lifecycle / misc =================

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_FILE) {
            if (filePathCallback != null) {
                filePathCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
                filePathCallback = null;
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    /** JS se bulane wala bridge: window.CloudGSTNative.* */
    public static class NativeBridge {
        private final MainActivity act;

        NativeBridge(MainActivity a) {
            this.act = a;
        }

        @android.webkit.JavascriptInterface
        public String appVersion() {
            return "android-5.8.2";
        }

        @android.webkit.JavascriptInterface
        public void openPortal(final String username, final String password, final String gstin) {
            act.runOnUiThread(() -> {
                Intent i = new Intent(act, PortalLoginActivity.class);
                i.putExtra("u", username == null ? "" : username);
                i.putExtra("p", password == null ? "" : password);
                i.putExtra("g", gstin == null ? "" : gstin);
                act.startActivity(i);
            });
        }

        @android.webkit.JavascriptInterface
        public boolean hasBiometric() {
            return act.biometricSupported();
        }

        @android.webkit.JavascriptInterface
        public boolean isBioLockEnabled() {
            return act.prefs.getBoolean(PREF_BIO_LOCK, false);
        }

        @android.webkit.JavascriptInterface
        public void setBioLock(final boolean enable) {
            act.runOnUiThread(() -> {
                if (!enable) {
                    act.prefs.edit().putBoolean(PREF_BIO_LOCK, false).apply();
                    Toast.makeText(act, "Fingerprint lock OFF", Toast.LENGTH_SHORT).show();
                    return;
                }
                if (!act.biometricSupported()) {
                    Toast.makeText(act, "Is device me fingerprint/PIN set nahi hai",
                            Toast.LENGTH_LONG).show();
                    return;
                }
                act.prefs.edit().putBoolean(PREF_BIO_LOCK, true).apply();
                Toast.makeText(act, "Fingerprint lock ON — agli baar app khulte hi fingerprint lagega",
                        Toast.LENGTH_LONG).show();
            });
        }

        @android.webkit.JavascriptInterface
        public void toast(final String msg) {
            act.runOnUiThread(() -> Toast.makeText(act, msg == null ? "" : msg,
                    Toast.LENGTH_SHORT).show());
        }
    }
}
