package com.cloudgst.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.DownloadManager;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.fragment.app.FragmentActivity;
import androidx.webkit.WebViewAssetLoader;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.concurrent.Executor;

/**
 * CloudGST — Android wrapper (v5.9.0).
 *  - UI: assets/app/ (https://appassets.androidplatform.net se serve) => browser jaisa behaviour
 *  - Swipe-back / back gesture: JS (cloudGstHandleBack) se poochta hai -> modal, page, phir app band
 *  - Fingerprint / Touch ID lock: Android 7 (API 24) se hi chalta hai (androidx.biometric),
 *    fingerprint na ho to device PIN/pattern bhi chalta hai — Settings me ON/OFF
 *  - Download: app ke JSON / PDF / CSV seedhe phone ke Downloads folder me (blob -> native save)
 *  - Share: WhatsApp / Gmail me seedha bhejne ke liye native share sheet
 *  - Splash + launcher icon: PDF letterhead wala hi J&A monogram
 */
public class MainActivity extends FragmentActivity {

    public static final String APP_URL = "https://appassets.androidplatform.net/assets/app/index.html";
    public static final String APP_VERSION = "android-5.9.1";

    private static final int REQ_FILE = 1001;
    private static final int REQ_STORAGE = 1002;
    private static final String PREFS = "cloudgst";
    private static final String PREF_BIO_LOCK = "bio_lock";
    private static final String TAG = "CloudGST";

    private WebView web;
    private FrameLayout rootView;
    private View lockView;
    private ValueCallback<Uri[]> filePathCallback;
    private boolean appLoaded = false;
    private SharedPreferences prefs;

    /** Storage permission ke baad pending save (sirf Android 7/8 ke liye). */
    private String pendingName, pendingB64;

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
        // Mobile me text bilkul desktop jaisa (UI na bigde)
        s.setTextZoom(100);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
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
                String scheme = u.getScheme() == null ? "" : u.getScheme();
                if (host.equals("appassets.androidplatform.net")) return false;
                if (scheme.startsWith("blob") || scheme.startsWith("data")) return true; // app ke andar hi handle
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, u));
                } catch (Exception ignored) {
                    toastUi("Is link ko kholne wala koi app nahi mila");
                }
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                view.evaluateJavascript(
                        "window.document.documentElement.classList.add('native-app');",
                        null);
                injectDownloadBridge(view);
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

        // http(s) downloads (jaise Drive se seedha file) -> android DownloadManager
        web.setDownloadListener((url, userAgent, contentDisposition, mimeType, len) -> {
            try {
                if (url != null && url.startsWith("data:")) {
                    int cut = url.indexOf(',');
                    String meta = url.substring(5, cut);
                    String name = contentDisposition == null || contentDisposition.isEmpty()
                            ? "CloudGST_" + System.currentTimeMillis()
                            : contentDisposition.replaceAll(".*filename=\"?([^\";]+)\"?.*", "$1");
                    String b64 = url.substring(cut + 1);
                    saveBase64Internal(name, b64, meta.contains("base64"));
                    return;
                }
                DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
                req.setMimeType(mimeType);
                req.addRequestHeader("User-Agent", userAgent);
                req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                req.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS,
                        android.webkit.URLUtil.guessFileName(url, contentDisposition, mimeType));
                DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                if (dm != null) dm.enqueue(req);
                toastUi("⏬ Download shuru — notification me progress dekhein");
            } catch (Exception e) {
                toastUi("❌ Download fail: " + e.getMessage());
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

    /**
     * blob:/data: download shim — app jab JSON/PDF/CSV banata hai to browser download ki jagah
     * file seedha phone ke Downloads folder me chali jati hai.
     */
    private void injectDownloadBridge(WebView view) {
        String js = "(function(){"
                + "if(window.__cgDlShim)return;window.__cgDlShim=1;"
                + "if(!window.CloudGSTNative||!window.CloudGSTNative.saveBase64)return;"
                + "var oc=HTMLAnchorElement.prototype.click;"
                + "HTMLAnchorElement.prototype.click=function(){"
                + "try{var h=this.getAttribute('href')||'';"
                + "if(h.indexOf('blob:')===0||h.indexOf('data:')===0){var self=this;"
                + "fetch(h).then(function(r){return r.blob();}).then(function(b){"
                + "var fr=new FileReader();fr.onload=function(){"
                + "var b64=String(fr.result).split(',')[1]||'';"
                + "var nm=self.getAttribute('download')||('CloudGST_'+Date.now());"
                + "try{CloudGSTNative.saveBase64(nm,b64);}catch(e){oc.call(self);}};"
                + "fr.readAsDataURL(b);}).catch(function(){oc.call(self);});return;}"
                + "}catch(e){}return oc.call(this);};"
                + "})();";
        view.evaluateJavascript(js, null);
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

    // ================= fingerprint / Touch ID lock =================

    /** Android 7+ par fingerprint; na ho to device PIN/pattern — dono chalta hai. */
    private boolean biometricSupported() {
        try {
            BiometricManager bm = BiometricManager.from(this);
            int ok = bm.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK);
            if (ok == BiometricManager.BIOMETRIC_SUCCESS) return true;
            // fingerprint nahi, lekin phone me PIN/pattern set hai -> wo bhi lock ke liye kaafi hai
            android.app.KeyguardManager km =
                    (android.app.KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            return km != null && km.isDeviceSecure();
        } catch (Throwable t) {
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
        box.setBackgroundColor(Color.parseColor("#12265C"));
        box.setPadding(dp(24), dp(24), dp(24), dp(24));

        ImageView logo = new ImageView(this);
        logo.setImageResource(R.drawable.splash_logo);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(dp(150), dp(150));
        logo.setLayoutParams(lp);
        box.addView(logo);

        TextView title = new TextView(this);
        title.setText("CloudGST");
        title.setTextColor(Color.WHITE);
        title.setTextSize(20f);
        title.setGravity(Gravity.CENTER);
        title.setPadding(0, dp(6), 0, dp(4));
        box.addView(title);

        TextView sub = new TextView(this);
        sub.setText("Fingerprint ya device PIN se kholein");
        sub.setTextColor(Color.parseColor("#C19A38"));
        sub.setTextSize(12f);
        sub.setGravity(Gravity.CENTER);
        sub.setPadding(0, 0, 0, dp(22));
        box.addView(sub);

        Button unlock = new Button(this);
        unlock.setText("👆 Unlock");
        unlock.setTextColor(Color.parseColor("#12265C"));
        unlock.setBackgroundColor(Color.parseColor("#C19A38"));
        unlock.setPadding(dp(28), dp(10), dp(28), dp(10));
        unlock.setOnClickListener(v -> askBiometric(true));
        box.addView(unlock);

        Button quit = new Button(this);
        quit.setText("App band karein");
        quit.setTextColor(Color.parseColor("#CBD5E1"));
        quit.setBackgroundColor(Color.parseColor("#1E293B"));
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

    /** Fingerprint (ya device PIN) — success par app khul jata hai. */
    private void askBiometric(final boolean fromButton) {
        if (!biometricSupported()) {
            unlockApp();
            return;
        }
        try {
            Executor exec = ContextCompat.getMainExecutor(this);
            BiometricPrompt prompt = new BiometricPrompt(this, exec,
                    new BiometricPrompt.AuthenticationCallback() {
                        @Override
                        public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                            unlockApp();
                        }

                        @Override
                        public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                            if (fromButton) {
                                toastUi("Unlock nahi hua — dobara try karein");
                            }
                        }
                    });

            BiometricPrompt.PromptInfo.Builder b = new BiometricPrompt.PromptInfo.Builder()
                    .setTitle("CloudGST unlock")
                    .setSubtitle("Fingerprint / device PIN");
            if (Build.VERSION.SDK_INT >= 30) {
                b.setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_WEAK
                        | BiometricManager.Authenticators.DEVICE_CREDENTIAL);
            } else {
                // Android 7-10: fingerprint + "Use PIN" fallback
                b.setDeviceCredentialAllowed(true);
            }
            prompt.authenticate(b.build());
        } catch (Throwable t) {
            Log.w(TAG, "biometric prompt fail", t);
            unlockApp();
        }
    }

    private void unlockApp() {
        if (lockView != null && lockView.getParent() != null) {
            rootView.removeView(lockView);
        }
        loadApp();
    }

    // ================= downloads =================

    private void toastUi(final String msg) {
        runOnUiThread(() -> Toast.makeText(MainActivity.this, msg, Toast.LENGTH_LONG).show());
    }

    private void saveBase64Internal(final String name, final String b64, boolean isBase64) {
        final String fileName = safeName(name);
        byte[] data;
        try {
            data = isBase64 ? Base64.decode(b64, Base64.DEFAULT) : b64.getBytes("UTF-8");
        } catch (Exception e) {
            toastUi("❌ File save nahi hui: " + e.getMessage());
            return;
        }
        saveBytes(fileName, data);
    }

    private String safeName(String name) {
        String n = name == null ? "" : name.trim();
        if (n.isEmpty()) n = "CloudGST_" + System.currentTimeMillis();
        n = n.replaceAll("[\\\\/:*?\"<>|]", "_");
        if (n.length() > 90) n = n.substring(n.length() - 90);
        return n;
    }

    private void saveBytes(String fileName, byte[] data) {
        if (Build.VERSION.SDK_INT >= 29) {
            try {
                ContentValues v = new ContentValues();
                v.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
                v.put(MediaStore.Downloads.MIME_TYPE, guessMime(fileName));
                v.put(MediaStore.Downloads.IS_PENDING, 1);
                Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                if (uri == null) throw new Exception("Downloads folder nahi mila");
                OutputStream os = getContentResolver().openOutputStream(uri);
                if (os == null) throw new Exception("file write nahi hui");
                os.write(data);
                os.close();
                v.clear();
                v.put(MediaStore.Downloads.IS_PENDING, 0);
                getContentResolver().update(uri, v, null, null);
                toastUi("✅ Saved in Downloads: " + fileName);
                return;
            } catch (Exception e) {
                Log.w(TAG, "mediastore save fail", e);
                // niche fallback
            }
        } else if (ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE)
                != PackageManager.PERMISSION_GRANTED) {
            pendingName = fileName;
            try { pendingB64 = Base64.encodeToString(data, Base64.NO_WRAP); } catch (Throwable ignored) { }
            requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, REQ_STORAGE);
            toastUi("Storage permission dein — file turant Downloads me save ho jayegi");
            return;
        }
        // fallback: purane Android / permission ke bina app ka apna Downloads folder
        try {
            File dir = Build.VERSION.SDK_INT >= 29
                    ? getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
                    : Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            if (dir == null) dir = getFilesDir();
            if (!dir.exists()) dir.mkdirs();
            File f = new File(dir, fileName);
            FileOutputStream fos = new FileOutputStream(f);
            fos.write(data);
            fos.close();
            toastUi("✅ Saved: " + f.getAbsolutePath());
        } catch (Exception e) {
            toastUi("❌ File save nahi hui: " + e.getMessage());
        }
    }

    private String guessMime(String name) {
        String n = name == null ? "" : name.toLowerCase();
        if (n.endsWith(".pdf")) return "application/pdf";
        if (n.endsWith(".json")) return "application/json";
        if (n.endsWith(".csv")) return "text/csv";
        if (n.endsWith(".png")) return "image/png";
        if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
        return "application/octet-stream";
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions,
                                           @NonNull int[] grantResults) {
        if (requestCode == REQ_STORAGE) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED
                    && pendingName != null && pendingB64 != null) {
                String n = pendingName, b = pendingB64;
                pendingName = null;
                pendingB64 = null;
                try {
                    saveBytes(n, Base64.decode(b, Base64.NO_WRAP));
                } catch (Exception e) {
                    toastUi("❌ File save nahi hui: " + e.getMessage());
                }
            }
            return;
        }
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
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

        @JavascriptInterface
        public String appVersion() {
            return APP_VERSION;
        }

        @JavascriptInterface
        public void openPortal(final String username, final String password, final String gstin) {
            act.runOnUiThread(() -> {
                Intent i = new Intent(act, PortalLoginActivity.class);
                i.putExtra("u", username == null ? "" : username);
                i.putExtra("p", password == null ? "" : password);
                i.putExtra("g", gstin == null ? "" : gstin);
                act.startActivity(i);
            });
        }

        @JavascriptInterface
        public boolean hasBiometric() {
            return act.biometricSupported();
        }

        @JavascriptInterface
        public boolean isBioLockEnabled() {
            return act.prefs.getBoolean(PREF_BIO_LOCK, false);
        }

        @JavascriptInterface
        public void setBioLock(final boolean enable) {
            act.runOnUiThread(() -> {
                if (!enable) {
                    act.prefs.edit().putBoolean(PREF_BIO_LOCK, false).apply();
                    Toast.makeText(act, "Fingerprint lock OFF", Toast.LENGTH_SHORT).show();
                    return;
                }
                if (!act.biometricSupported()) {
                    Toast.makeText(act, "Is phone me fingerprint/PIN set nahi hai",
                            Toast.LENGTH_LONG).show();
                    return;
                }
                act.prefs.edit().putBoolean(PREF_BIO_LOCK, true).apply();
                Toast.makeText(act, "Fingerprint lock ON — agli baar app khulte hi fingerprint/PIN lagega",
                        Toast.LENGTH_LONG).show();
            });
        }

        /** App ke JSON / PDF / CSV → phone ke Downloads folder me. */
        @JavascriptInterface
        public void saveBase64(final String name, final String b64) {
            if (b64 == null) return;
            act.saveBase64Internal(name, b64, true);
        }

        /** File bana kar seedha WhatsApp/Gmail me bhejne ke liye share sheet (PDF attach hokar jati hai). */
        @JavascriptInterface
        public void shareBase64(final String name, final String b64, final String text) {
            if (b64 == null) return;
            final String fileName = act.safeName(name);
            try {
                byte[] data = Base64.decode(b64, Base64.DEFAULT);
                File dir = new File(act.getCacheDir(), "share");
                if (!dir.exists()) dir.mkdirs();
                File f = new File(dir, fileName);
                FileOutputStream fos = new FileOutputStream(f);
                fos.write(data);
                fos.close();
                act.runOnUiThread(() -> {
                    try {
                        Uri uri = FileProvider.getUriForFile(act,
                                act.getPackageName() + ".fileprovider", f);
                        Intent i = new Intent(Intent.ACTION_SEND);
                        i.setType(act.guessMime(fileName));
                        i.putExtra(Intent.EXTRA_STREAM, uri);
                        if (text != null && !text.isEmpty()) i.putExtra(Intent.EXTRA_TEXT, text);
                        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        act.startActivity(Intent.createChooser(i, "Share"));
                    } catch (Exception e) {
                        Toast.makeText(act, "Share fail: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                    }
                });
            } catch (Exception e) {
                act.toastUi("❌ Share fail: " + e.getMessage());
            }
        }

        @JavascriptInterface
        public void shareText(final String text, final String title) {
            act.runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_SEND);
                i.setType("text/plain");
                i.putExtra(Intent.EXTRA_TEXT, text == null ? "" : text);
                if (title != null && !title.isEmpty()) i.putExtra(Intent.EXTRA_SUBJECT, title);
                act.startActivity(Intent.createChooser(i, title == null ? "Share" : title));
            });
        }

        @JavascriptInterface
        public void toast(final String msg) {
            act.runOnUiThread(() -> Toast.makeText(act, msg == null ? "" : msg,
                    Toast.LENGTH_SHORT).show());
        }
    }
}
