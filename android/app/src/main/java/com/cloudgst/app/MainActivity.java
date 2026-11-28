package com.cloudgst.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.DownloadManager;
import android.content.ClipData;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.database.Cursor;
import android.graphics.Color;
import android.hardware.input.InputManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.util.Log;
import android.view.Gravity;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputConnection;
import android.view.inputmethod.InputMethodManager;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.MimeTypeMap;
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

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executor;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * CloudGST — Android wrapper (v6.0.0 — 5-Tab Parallel Multi-Profile Phone Mode).
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
    public static final String APP_VERSION = "android-" + BuildConfig.VERSION_NAME;

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
    private boolean bioUnlocked = false;
    private static final int MAX_SLOTS = 5;
    private final PhoneFetch[] phoneFetches = new PhoneFetch[MAX_SLOTS];
    private final PhoneLogin[] phoneLogins = new PhoneLogin[MAX_SLOTS];
    private final StringBuilder[] uploadBuffers = new StringBuilder[MAX_SLOTS];
    private final Map<String, String> phonePayloads = Collections.synchronizedMap(
            new LinkedHashMap<String, String>(64, 0.75f, false) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<String, String> eldest) {
                    return size() > 50;
                }
            });
    private SharedPreferences prefs;
    private InputManager inputManager;
    private InputManager.InputDeviceListener inputDeviceListener;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private volatile boolean externalKeyboardConnected = false;

    private static final int MAX_SHARE_BYTES = 20 * 1024 * 1024;
    private static final int MAX_SHARE_FILES = 10;
    private static final class PendingShareFile {
        final String name;
        final String mime;
        final int size;
        final String b64;
        PendingShareFile(String name, String mime, int size, String b64) {
            this.name = name;
            this.mime = mime;
            this.size = size;
            this.b64 = b64;
        }
    }
    private final List<PendingShareFile> pendingShares = new ArrayList<>();
    private volatile boolean pageFinished = false;

    /** Storage permission ke baad pending save (sirf Android 7/8 ke liye). */
    private String pendingName, pendingB64;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences(PREFS, MODE_PRIVATE);

        rootView = new FrameLayout(this);
        web = new WebView(this) {
            @Override
            public boolean onCheckIsTextEditor() {
                if (externalKeyboardConnected) return false;
                return super.onCheckIsTextEditor();
            }

            @Override
            public InputConnection onCreateInputConnection(EditorInfo outAttrs) {
                if (externalKeyboardConnected) return null;
                return super.onCreateInputConnection(outAttrs);
            }
        };
        rootView.addView(web, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            rootView.setOnApplyWindowInsetsListener((v, insets) -> {
                if (externalKeyboardConnected && insets != null && insets.isVisible(WindowInsets.Type.ime())) {
                    mainHandler.post(this::hideSoftKeyboard);
                }
                return v.onApplyWindowInsets(insets);
            });
        }

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
                pageFinished = true;
                view.evaluateJavascript(
                        "window.document.documentElement.classList.add('native-app');",
                        null);
                injectDownloadBridge(view);
                injectExternalKeyboardGuard(view);
                if (bioUnlocked) {
                    view.evaluateJavascript(
                            "(window.cloudGstNativeUnlocked&&window.cloudGstNativeUnlocked())", null);
                }
                notifyPendingShareToWeb();
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
        captureSharedIntent(getIntent());

        // ---- external physical/Bluetooth/USB keyboard detection -> suppress on-screen keyboard ----
        try {
            inputManager = (InputManager) getSystemService(Context.INPUT_SERVICE);
            if (inputManager != null) {
                inputDeviceListener = new InputManager.InputDeviceListener() {
                    @Override
                    public void onInputDeviceAdded(int deviceId) {
                        syncExternalKeyboardState();
                    }

                    @Override
                    public void onInputDeviceRemoved(int deviceId) {
                        syncExternalKeyboardState();
                    }

                    @Override
                    public void onInputDeviceChanged(int deviceId) {
                        syncExternalKeyboardState();
                    }
                };
                inputManager.registerInputDeviceListener(inputDeviceListener, new Handler(Looper.getMainLooper()));
            }
        } catch (Throwable t) {
            Log.w(TAG, "inputDeviceListener init fail", t);
        }
        syncExternalKeyboardState();
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

    // ================= external keyboard: hide on-screen soft keyboard =================

    private static boolean hasTypingKeys(InputDevice dev) {
        try {
            boolean[] has = dev.hasKeys(KeyEvent.KEYCODE_A, KeyEvent.KEYCODE_E, KeyEvent.KEYCODE_SPACE);
            return has != null && has.length == 3 && has[0] && has[1] && has[2];
        } catch (Throwable ignored) {
            return false;
        }
    }

    private static boolean isPhysicalKeyboardDevice(InputDevice dev) {
        if (dev == null || dev.isVirtual()) return false;
        int src = dev.getSources();
        if ((src & InputDevice.SOURCE_KEYBOARD) != InputDevice.SOURCE_KEYBOARD) return false;
        if (dev.getKeyboardType() == InputDevice.KEYBOARD_TYPE_ALPHABETIC) return true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && dev.isExternal() && hasTypingKeys(dev)) {
            return true;
        }
        return hasTypingKeys(dev);
    }

    private static boolean isTypingKeyCode(int keyCode) {
        return keyCode == KeyEvent.KEYCODE_SPACE
                || keyCode == KeyEvent.KEYCODE_ENTER
                || keyCode == KeyEvent.KEYCODE_NUMPAD_ENTER
                || keyCode == KeyEvent.KEYCODE_DEL
                || keyCode == KeyEvent.KEYCODE_TAB
                || (keyCode >= KeyEvent.KEYCODE_A && keyCode <= KeyEvent.KEYCODE_Z)
                || (keyCode >= KeyEvent.KEYCODE_0 && keyCode <= KeyEvent.KEYCODE_9)
                || (keyCode >= KeyEvent.KEYCODE_NUMPAD_0 && keyCode <= KeyEvent.KEYCODE_NUMPAD_9);
    }

    private boolean detectExternalKeyboard() {
        try {
            Configuration cfg = getResources().getConfiguration();
            if ((cfg.keyboard == Configuration.KEYBOARD_QWERTY
                    || cfg.keyboard == Configuration.KEYBOARD_12KEY)
                    && cfg.hardKeyboardHidden == Configuration.HARDKEYBOARDHIDDEN_NO) {
                return true;
            }
        } catch (Throwable ignored) { }
        try {
            for (int id : InputDevice.getDeviceIds()) {
                if (isPhysicalKeyboardDevice(InputDevice.getDevice(id))) {
                    return true;
                }
            }
        } catch (Throwable ignored) { }
        return false;
    }

    boolean isExternalKeyboardConnected() {
        return externalKeyboardConnected;
    }

    private void syncExternalKeyboardState() {
        final boolean detected = detectExternalKeyboard();
        externalKeyboardConnected = detected;
        runOnUiThread(() -> applyExternalKeyboardMode(detected));
    }

    private void applyExternalKeyboardMode(final boolean connected) {
        try {
            if (connected && lockView == null) {
                getWindow().addFlags(WindowManager.LayoutParams.FLAG_ALT_FOCUSABLE_IM);
                getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN
                        | WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
            } else {
                getWindow().clearFlags(WindowManager.LayoutParams.FLAG_ALT_FOCUSABLE_IM);
                getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_HIDDEN
                        | WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
            }
        } catch (Throwable ignored) { }
        try {
            InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
            if (imm != null && web != null) {
                imm.restartInput(web);
            }
        } catch (Throwable ignored) { }
        if (connected) {
            hideSoftKeyboard();
            mainHandler.postDelayed(this::hideSoftKeyboard, 120);
        }
        if (web != null) {
            try {
                web.evaluateJavascript(
                        "(function(){try{if(window.__cgExtKbChanged)window.__cgExtKbChanged("
                                + (connected ? "true" : "false") + ");}catch(e){}})()",
                        null);
            } catch (Throwable ignored) { }
        }
    }

    void hideSoftKeyboard() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                WindowInsetsController wic = getWindow().getInsetsController();
                if (wic != null) wic.hide(WindowInsets.Type.ime());
                if (web != null && web.getWindowInsetsController() != null) {
                    web.getWindowInsetsController().hide(WindowInsets.Type.ime());
                }
            }
        } catch (Throwable ignored) { }
        try {
            InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
            if (imm == null) return;
            View[] views = new View[] {
                    getCurrentFocus(),
                    web,
                    rootView,
                    getWindow() != null ? getWindow().getDecorView() : null
            };
            for (View v : views) {
                if (v != null && v.getWindowToken() != null) {
                    imm.hideSoftInputFromWindow(v.getWindowToken(), 0);
                }
            }
        } catch (Throwable ignored) { }
    }

    private void injectExternalKeyboardGuard(WebView view) {
        String js = "(function(){"
                + "if(window.__cgExtKbInit){"
                + "  try{if(window.__cgExtKbChanged&&window.CloudGSTNative&&CloudGSTNative.hasExternalKeyboard)"
                + "    window.__cgExtKbChanged(!!CloudGSTNative.hasExternalKeyboard());}catch(e){}"
                + "  return;}"
                + "window.__cgExtKbInit=1;"
                + "window.__cgExtKb=false;"
                + "function applyEl(el,on){"
                + "  if(!el||!el.tagName)return;"
                + "  var tg=el.tagName.toUpperCase();"
                + "  if(tg!=='INPUT'&&tg!=='TEXTAREA')return;"
                + "  var ty=(el.type||'text').toLowerCase();"
                + "  if(ty==='checkbox'||ty==='radio'||ty==='button'||ty==='submit'||ty==='file'||ty==='hidden')return;"
                + "  if(on){"
                + "    if(!el.hasAttribute('data-cg-im-saved'))el.setAttribute('data-cg-im-saved',el.getAttribute('inputmode')||'');"
                + "    el.setAttribute('inputmode','none');"
                + "  }else if(el.hasAttribute('data-cg-im-saved')){"
                + "    var orig=el.getAttribute('data-cg-im-saved');"
                + "    el.removeAttribute('data-cg-im-saved');"
                + "    if(orig)el.setAttribute('inputmode',orig);else el.removeAttribute('inputmode');"
                + "  }"
                + "}"
                + "function applyAll(on){try{document.querySelectorAll('input,textarea').forEach(function(el){applyEl(el,on);});}catch(e){}}"
                + "try{"
                + "  var origFocus=HTMLElement.prototype.focus;"
                + "  HTMLElement.prototype.focus=function(){"
                + "    try{if(window.__cgExtKb)applyEl(this,true);}catch(e){}"
                + "    var r=origFocus.apply(this,arguments);"
                + "    try{if(window.__cgExtKb&&window.CloudGSTNative&&CloudGSTNative.hideSoftKeyboard)CloudGSTNative.hideSoftKeyboard();}catch(e){}"
                + "    return r;"
                + "  };"
                + "}catch(e){}"
                + "window.__cgExtKbChanged=function(on){"
                + "  window.__cgExtKb=!!on;applyAll(window.__cgExtKb);"
                + "  if(window.__cgExtKb&&window.CloudGSTNative&&CloudGSTNative.hideSoftKeyboard){try{CloudGSTNative.hideSoftKeyboard();}catch(e){}}"
                + "};"
                + "document.addEventListener('pointerdown',function(ev){if(window.__cgExtKb)applyEl(ev.target,true);},true);"
                + "document.addEventListener('focusin',function(ev){"
                + "  if(!window.__cgExtKb)return;applyEl(ev.target,true);"
                + "  if(window.CloudGSTNative&&CloudGSTNative.hideSoftKeyboard){try{CloudGSTNative.hideSoftKeyboard();}catch(e){}}"
                + "},true);"
                + "try{"
                + "  var mo=new MutationObserver(function(muts){"
                + "    if(!window.__cgExtKb)return;"
                + "    muts.forEach(function(m){if(!m.addedNodes)return;m.addedNodes.forEach(function(n){"
                + "      if(n.nodeType!==1)return;applyEl(n,true);"
                + "      if(n.querySelectorAll)n.querySelectorAll('input,textarea').forEach(function(el){applyEl(el,true);});"
                + "    });});"
                + "  });"
                + "  if(document.body)mo.observe(document.body,{childList:true,subtree:true});"
                + "}catch(e){}"
                + "try{if(window.CloudGSTNative&&CloudGSTNative.hasExternalKeyboard)"
                + "  window.__cgExtKbChanged(!!CloudGSTNative.hasExternalKeyboard());}catch(e){}"
                + "})();";
        view.evaluateJavascript(js, null);
    }

    @Override
    protected void onResume() {
        super.onResume();
        syncExternalKeyboardState();
    }

    @Override
    public void onConfigurationChanged(@NonNull Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        syncExternalKeyboardState();
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        try {
            if (event != null && event.getAction() == KeyEvent.ACTION_DOWN) {
                InputDevice dev = event.getDevice();
                boolean fromPhysicalKb = isPhysicalKeyboardDevice(dev)
                        || (dev != null && !dev.isVirtual() && event.getDeviceId() > 0 && isTypingKeyCode(event.getKeyCode()));
                if (fromPhysicalKb) {
                    if (!externalKeyboardConnected) {
                        externalKeyboardConnected = true;
                        applyExternalKeyboardMode(true);
                    } else {
                        hideSoftKeyboard();
                    }
                }
            }
        } catch (Throwable ignored) { }
        return super.dispatchKeyEvent(event);
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

    /**
     * "fingerprint" = phone me fingerprint enrolled hai (best),
     * "device_pin"  = fingerprint nahi, par screen lock (PIN/pattern) set hai,
     * "none"        = phone me koi lock set nahi (lock option kaam nahi karega).
     */
    private String bioStatusText() {
        try {
            BiometricManager bm = BiometricManager.from(this);
            if (bm.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK)
                    == BiometricManager.BIOMETRIC_SUCCESS) return "fingerprint";
        } catch (Throwable t) {
            Log.w(TAG, "biometric check fail", t);
        }
        try {
            android.app.KeyguardManager km =
                    (android.app.KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (km != null && km.isDeviceSecure()) return "device_pin";
        } catch (Throwable t) {
            Log.w(TAG, "keyguard check fail", t);
        }
        return "none";
    }

    /** Android 7+ par fingerprint; na ho to device PIN/pattern — dono chalta hai. */
    private boolean biometricSupported() {
        return !"none".equals(bioStatusText());
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
            // Fail-closed: prompt fail hone par app khula na chhodein
            toastUi("Fingerprint/PIN prompt nahi khul paya — Unlock button se dobara try karein");
        }
    }

    private void unlockApp() {
        bioUnlocked = true;
        if (lockView != null && lockView.getParent() != null) {
            rootView.removeView(lockView);
        }
        lockView = null;
        if (web != null && appLoaded) {
            // app khud ka password popup na dikhaye (fingerprint hi unlock hai)
            web.evaluateJavascript(
                    "(window.cloudGstNativeUnlocked&&window.cloudGstNativeUnlocked())", null);
        }
        loadApp();
        syncExternalKeyboardState();
        notifyPendingShareToWeb();
    }

    // ================= incoming Android Share (WhatsApp / Files / Gallery -> CloudGST) =================

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        captureSharedIntent(intent);
    }

    @SuppressWarnings("deprecation")
    private void captureSharedIntent(final Intent intent) {
        if (intent == null) return;
        final String action = intent.getAction();
        if (!Intent.ACTION_SEND.equals(action) && !Intent.ACTION_SEND_MULTIPLE.equals(action)) return;

        final List<Uri> uris = new ArrayList<>();
        try {
            if (Intent.ACTION_SEND.equals(action)) {
                Uri u = Build.VERSION.SDK_INT >= 33
                        ? intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri.class)
                        : intent.getParcelableExtra(Intent.EXTRA_STREAM);
                if (u != null) uris.add(u);
            } else {
                ArrayList<Uri> list = Build.VERSION.SDK_INT >= 33
                        ? intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri.class)
                        : intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
                if (list != null) {
                    for (Uri u : list) {
                        if (u != null) uris.add(u);
                    }
                }
            }
            if (uris.isEmpty() && intent.getClipData() != null) {
                ClipData cd = intent.getClipData();
                for (int i = 0; i < cd.getItemCount(); i++) {
                    Uri u = cd.getItemAt(i).getUri();
                    if (u != null) uris.add(u);
                }
            }
        } catch (Throwable t) {
            Log.w(TAG, "captureSharedIntent parse fail", t);
        }
        if (uris.isEmpty()) return;

        final String fallbackMime = intent.getType();
        final List<Uri> limited = uris.size() > MAX_SHARE_FILES ? uris.subList(0, MAX_SHARE_FILES) : uris;
        // Read bytes immediately while temporary URI permission grant is valid (off UI thread)
        new Thread(() -> {
            final List<PendingShareFile> loaded = new ArrayList<>();
            int skippedLarge = 0;
            for (Uri u : limited) {
                try {
                    PendingShareFile pf = readSharedUri(u, fallbackMime);
                    if (pf != null) loaded.add(pf);
                    else skippedLarge++;
                } catch (Throwable t) {
                    Log.w(TAG, "readSharedUri fail: " + u, t);
                }
            }
            if (loaded.isEmpty()) {
                if (skippedLarge > 0) toastUi("⚠️ Shared file 20 MB se badi hai — upload nahi ho sakti.");
                else toastUi("⚠️ Shared file padh nahi paye.");
                return;
            }
            synchronized (pendingShares) {
                pendingShares.clear();
                pendingShares.addAll(loaded);
            }
            if (skippedLarge > 0) {
                toastUi("⚠️ " + skippedLarge + " file 20 MB se badi thi, skip kar di gayi.");
            }
            runOnUiThread(this::notifyPendingShareToWeb);
        }).start();
    }

    private PendingShareFile readSharedUri(Uri uri, String fallbackMime) throws Exception {
        String mime = null;
        try { mime = getContentResolver().getType(uri); } catch (Throwable ignored) { }
        if ((mime == null || mime.isEmpty() || "*/*".equals(mime)) && fallbackMime != null && !"*/*".equals(fallbackMime)) {
            mime = fallbackMime;
        }
        String name = null;
        try (Cursor c = getContentResolver().query(uri, new String[]{ OpenableColumns.DISPLAY_NAME }, null, null, null)) {
            if (c != null && c.moveToFirst()) {
                int idx = c.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (idx >= 0) name = c.getString(idx);
            }
        } catch (Throwable ignored) { }
        if (name == null || name.trim().isEmpty()) {
            String seg = uri.getLastPathSegment();
            name = (seg != null && !seg.trim().isEmpty()) ? seg.replaceAll(".*/", "") : ("Shared_" + System.currentTimeMillis());
        }
        name = name.trim();
        if (!name.contains(".") && mime != null) {
            String ext = MimeTypeMap.getSingleton().getExtensionFromMimeType(mime);
            if (ext != null && !ext.isEmpty()) name = name + "." + ext;
        }
        if (mime == null || mime.isEmpty()) {
            String lower = name.toLowerCase();
            if (lower.endsWith(".csv")) mime = "text/csv";
            else if (lower.endsWith(".xlsx")) mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            else if (lower.endsWith(".xls")) mime = "application/vnd.ms-excel";
            else mime = guessMime(name);
        }
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        int total = 0;
        byte[] buf = new byte[16384];
        try (InputStream in = getContentResolver().openInputStream(uri)) {
            if (in == null) return null;
            int n;
            while ((n = in.read(buf)) > 0) {
                total += n;
                if (total > MAX_SHARE_BYTES) return null;
                bos.write(buf, 0, n);
            }
        }
        byte[] data = bos.toByteArray();
        String b64 = Base64.encodeToString(data, Base64.NO_WRAP);
        return new PendingShareFile(name, mime, data.length, b64);
    }

    private void notifyPendingShareToWeb() {
        if (lockView != null || web == null || !pageFinished) return;
        boolean has;
        synchronized (pendingShares) {
            has = !pendingShares.isEmpty();
        }
        if (!has) return;
        web.evaluateJavascript(
                "(function(){try{if(window.cloudGstHandleSharedFiles)window.cloudGstHandleSharedFiles();}catch(e){}})()",
                null);
    }

    String getPendingShareMetaJson() {
        JSONArray arr = new JSONArray();
        synchronized (pendingShares) {
            for (int i = 0; i < pendingShares.size(); i++) {
                PendingShareFile f = pendingShares.get(i);
                try {
                    JSONObject o = new JSONObject();
                    o.put("idx", i);
                    o.put("name", f.name);
                    o.put("mime", f.mime);
                    o.put("size", f.size);
                    o.put("b64Len", f.b64.length());
                    arr.put(o);
                } catch (Exception ignored) { }
            }
        }
        return arr.toString();
    }

    String getPendingShareChunk(int idx, int offset, int len) {
        synchronized (pendingShares) {
            if (idx < 0 || idx >= pendingShares.size()) return "";
            String s = pendingShares.get(idx).b64;
            if (offset < 0 || offset >= s.length()) return "";
            int end = Math.min(s.length(), offset + Math.max(1, len));
            return s.substring(offset, end);
        }
    }

    void clearPendingShare() {
        synchronized (pendingShares) {
            pendingShares.clear();
        }
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
        try {
            if (inputManager != null && inputDeviceListener != null) {
                inputManager.unregisterInputDeviceListener(inputDeviceListener);
            }
        } catch (Exception ignored) { }
        try {
            for (int i = 0; i < MAX_SLOTS; i++) {
                if (phoneFetches[i] != null) phoneFetches[i].destroy();
                if (phoneLogins[i] != null) phoneLogins[i].destroy();
            }
        } catch (Exception ignored) { }
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
    // ================= Phone mode: 5-Tab Multi-Profile background (invisible) fetch =================

    int clampSlot(int slot) {
        int max = PhoneLogin.multiProfileSupported() ? MAX_SLOTS : 1;
        if (slot < 0) return 0;
        return Math.min(slot, max - 1);
    }

    String startPhoneFetchSlot(final int rawSlot, final String fyLabel, final String monLabel) {
        final int slot = clampSlot(rawSlot);
        final String id = "pf_" + slot + "_" + System.currentTimeMillis() + "_" + (int) (Math.random() * 9000 + 1000);
        final String fy = fyLabel == null ? "" : fyLabel;
        final String mon = monLabel == null ? "" : monLabel;
        runOnUiThread(() -> {
            try {
                if (phoneFetches[slot] == null) {
                    phoneFetches[slot] = new PhoneFetch(this, slot, (rid, payload) -> runOnUiThread(
                            () -> deliverPhonePayload(rid, payload)));
                }
                phoneFetches[slot].start(id, fy, mon, rootView);
            } catch (Throwable t) {
                Log.e(TAG, "phone fetch start fail slot=" + slot, t);
                deliverPhonePayload(id, "{\"ok\":false,\"source\":\"phone\",\"code\":\"start_failed\","
                        + "\"error\":\"Phone mode Tab " + (slot + 1) + " start nahi ho paya (" + String.valueOf(t.getMessage()) + ").\"}");
            }
        });
        return id;
    }

    void initPhoneUploadSlot(final int rawSlot) {
        final int slot = clampSlot(rawSlot);
        synchronized (uploadBuffers) {
            uploadBuffers[slot] = new StringBuilder(65536);
        }
    }

    void appendPhoneUploadSlot(final int rawSlot, final String chunk) {
        final int slot = clampSlot(rawSlot);
        if (chunk == null || chunk.isEmpty()) return;
        synchronized (uploadBuffers) {
            if (uploadBuffers[slot] == null) uploadBuffers[slot] = new StringBuilder(65536);
            // Cap upload JSON base64 buffer at 30MB to prevent OOM
            if (uploadBuffers[slot].length() + chunk.length() <= 30 * 1024 * 1024) {
                uploadBuffers[slot].append(chunk);
            }
        }
    }

    String startPhoneUploadGstr1Slot(final int rawSlot, final String fyLabel, final String monLabel, final String fileName) {
        final int slot = clampSlot(rawSlot);
        final String b64;
        synchronized (uploadBuffers) {
            b64 = uploadBuffers[slot] == null ? "" : uploadBuffers[slot].toString();
            uploadBuffers[slot] = null;
        }
        final String id = "pu_" + slot + "_" + System.currentTimeMillis() + "_" + (int) (Math.random() * 9000 + 1000);
        final String fy = fyLabel == null ? "" : fyLabel;
        final String mon = monLabel == null ? "" : monLabel;
        final String fname = fileName == null ? "GSTR1.json" : fileName;
        runOnUiThread(() -> {
            try {
                if (phoneFetches[slot] == null) {
                    phoneFetches[slot] = new PhoneFetch(this, slot, (rid, payload) -> runOnUiThread(
                            () -> deliverPhonePayload(rid, payload)));
                }
                phoneFetches[slot].startUploadGstr1(id, fy, mon, fname, b64, rootView);
            } catch (Throwable t) {
                Log.e(TAG, "phone upload start fail slot=" + slot, t);
                deliverPhonePayload(id, "{\"ok\":false,\"source\":\"phone\",\"code\":\"start_failed\","
                        + "\"error\":\"Phone mode GSTR-1 upload Tab " + (slot + 1) + " start nahi ho paya (" + String.valueOf(t.getMessage()) + ").\"}");
            }
        });
        return id;
    }

    void deliverPhonePayload(String id, String payload) {
        try {
            if (id == null || id.isEmpty()) return;
            phonePayloads.put(id, payload == null ? "" : payload);
            if (web == null) return;
            web.evaluateJavascript(
                    "(function(){try{if(window.gpPhoneFetchReady)window.gpPhoneFetchReady("
                            + org.json.JSONObject.quote(id) + ");}catch(e){}})()", null);
        } catch (Throwable t) {
            Log.e(TAG, "deliverPhonePayload fail", t);
        }
    }

    void startPhoneLoginSlot(final int rawSlot, final String id, final String user, final String pass) {
        final int slot = clampSlot(rawSlot);
        try {
            if (phoneLogins[slot] == null) {
                phoneLogins[slot] = new PhoneLogin(this, slot, (rid, payload) -> runOnUiThread(
                        () -> deliverPhonePayload(rid, payload)));
            }
            if (phoneLogins[slot].isBusy()) {
                deliverPhonePayload(id, "{\"ok\":false,\"source\":\"phone\",\"code\":\"busy\","
                        + "\"error\":\"Tab " + (slot + 1) + " par login pehle se chal raha hai.\"}");
                return;
            }
            phoneLogins[slot].start(id, user, pass, rootView);
        } catch (Throwable t) {
            Log.e(TAG, "phone login start fail slot=" + slot, t);
            deliverPhonePayload(id, "{\"ok\":false,\"source\":\"phone\",\"code\":\"start_failed\","
                    + "\"error\":\"Phone login start nahi ho paya.\"}");
        }
    }

    void phoneLoginSubmitCaptchaSlot(final int rawSlot, final String captcha) {
        final int slot = clampSlot(rawSlot);
        try {
            if (phoneLogins[slot] == null) return;
            phoneLogins[slot].submitCaptcha(captcha);
        } catch (Throwable t) {
            Log.e(TAG, "phone login captcha fail slot=" + slot, t);
        }
    }

    void phoneLoginSubmitOtpSlot(final int rawSlot, final String otp) {
        final int slot = clampSlot(rawSlot);
        try {
            if (phoneLogins[slot] == null) return;
            phoneLogins[slot].submitOtp(otp);
        } catch (Throwable t) {
            Log.e(TAG, "phone login otp fail slot=" + slot, t);
        }
    }

    void setLoginOverlayVisible(boolean show) {
        // 100% hidden phone mode: GST Portal screen/overlay kabhi screen par nahi khulega.
        try {
            for (int i = 0; i < MAX_SLOTS; i++) {
                if (phoneLogins[i] != null && phoneLogins[i].web() != null) {
                    WebView wv = phoneLogins[i].web();
                    wv.setAlpha(0f);
                    wv.setClickable(false);
                    wv.setFocusable(false);
                    wv.setFocusableInTouchMode(false);
                    if (wv.getParent() == null) {
                        rootView.addView(wv, 0, new FrameLayout.LayoutParams(
                                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                    }
                }
            }
        } catch (Throwable t) {
            Log.e(TAG, "login overlay hide fail", t);
        }
    }

    String phonePayloadFor(String id) {
        try {
            if (id == null || id.isEmpty()) return "";
            String v = phonePayloads.get(id);
            return v == null ? "" : v;
        } catch (Throwable t) {
            return "";
        }
    }

    void clearPhonePayload(String id) {
        try {
            if (id != null && !id.isEmpty()) phonePayloads.remove(id);
        } catch (Throwable ignored) { }
    }

    String phoneStage() {
        try {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < MAX_SLOTS; i++) {
                if (phoneLogins[i] != null && phoneLogins[i].isBusy()) {
                    if (sb.length() > 0) sb.append(" | ");
                    sb.append("T").append(i + 1).append(":login:").append(phoneLogins[i].stage());
                } else if (phoneFetches[i] != null && phoneFetches[i].isBusy()) {
                    if (sb.length() > 0) sb.append(" | ");
                    sb.append("T").append(i + 1).append(":fetch:").append(phoneFetches[i].stage());
                }
            }
            return sb.length() > 0 ? sb.toString() : "idle";
        } catch (Throwable ignored) {
            return "";
        }
    }

    String phonePayloadChunk(String id, int offset, int len) {
        try {
            if (id == null || id.isEmpty()) return "";
            String p = phonePayloads.get(id);
            if (p == null) return "";
            int L = Math.max(1, Math.min(len, 400000));
            if (offset < 0 || offset >= p.length()) return "";
            return p.substring(offset, Math.min(p.length(), offset + L));
        } catch (Throwable t) {
            return "";
        }
    }

    public static class NativeBridge {
        private final MainActivity act;

        NativeBridge(MainActivity a) {
            this.act = a;
        }

        @JavascriptInterface
        public String appVersion() {
            return APP_VERSION;
        }

        /**
         * Portal app ke andar khulta hai (ID/password bhare hue, captcha aap dalte hain).
         * fp = "102026" (MMYYYY), per = "October (2026-27)" -> PORTAL screen ka
         * "📄 GSTR-1" button us month ka Prepare Online page kholta hai.
         */
        @JavascriptInterface
        public void openPortal(final String username, final String password, final String gstin,
                               final String fp, final String per) {
            act.runOnUiThread(() -> {
                Intent i = new Intent(act, PortalLoginActivity.class);
                i.putExtra("u", username == null ? "" : username);
                i.putExtra("p", password == null ? "" : password);
                i.putExtra("g", gstin == null ? "" : gstin);
                i.putExtra("fp", fp == null ? "" : fp);
                i.putExtra("per", per == null ? "" : per);
                act.startActivity(i);
            });
        }

        @JavascriptInterface
        public boolean hasBiometric() {
            return act.biometricSupported();
        }

        /** "fingerprint" | "device_pin" | "none" — app isi se button ka text/message banati hai. */
        @JavascriptInterface
        public String bioStatus() {
            return act.bioStatusText();
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
                    act.bioUnlocked = false;
                    Toast.makeText(act, "Fingerprint lock OFF", Toast.LENGTH_SHORT).show();
                    return;
                }
                if (!act.biometricSupported()) {
                    Toast.makeText(act,
                            "Phone Settings → Security me pehle Fingerprint ya PIN set karein, phir try karein",
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

        /** Kitne parallel isolated tabs support hain (Multi-Profile par 5, warna 1). */
        @JavascriptInterface
        public int phoneMaxParallel() {
            return PhoneLogin.multiProfileSupported() ? MAX_SLOTS : 1;
        }

        @JavascriptInterface
        public String phoneLoginStartSlot(final int slot, final String user, final String pass) {
            final int s = act.clampSlot(slot);
            final String id = "pl_" + s + "_" + System.currentTimeMillis() + "_" + (int) (Math.random() * 9000 + 1000);
            act.runOnUiThread(() -> act.startPhoneLoginSlot(s, id, user, pass));
            return id;
        }

        @JavascriptInterface
        public void phoneLoginCaptchaSlot(final int slot, final String captcha) {
            act.runOnUiThread(() -> act.phoneLoginSubmitCaptchaSlot(slot, captcha));
        }

        @JavascriptInterface
        public void phoneLoginOtpSlot(final int slot, final String otp) {
            act.runOnUiThread(() -> act.phoneLoginSubmitOtpSlot(slot, otp));
        }

        @JavascriptInterface
        public String phoneFetch2bSlot(final int slot, final String fyLabel, final String monLabel) {
            try {
                return act.startPhoneFetchSlot(slot, fyLabel, monLabel);
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface
        public boolean phoneUploadAvailable() {
            return true;
        }

        @JavascriptInterface
        public boolean phoneUploadInit(final int slot) {
            try {
                act.initPhoneUploadSlot(slot);
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public boolean phoneUploadAppend(final int slot, final String b64Chunk) {
            try {
                act.appendPhoneUploadSlot(slot, b64Chunk);
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public String phoneUploadGstr1Slot(final int slot, final String fyLabel, final String monLabel, final String fileName) {
            try {
                return act.startPhoneUploadGstr1Slot(slot, fyLabel, monLabel, fileName);
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface
        public String phoneLoginStart(final String user, final String pass) {
            return phoneLoginStartSlot(0, user, pass);
        }

        @JavascriptInterface
        public void phoneLoginCaptcha(final String captcha) {
            phoneLoginCaptchaSlot(0, captcha);
        }

        @JavascriptInterface
        public void phoneLoginOtp(final String otp) {
            phoneLoginOtpSlot(0, otp);
        }

        @JavascriptInterface
        public boolean phoneLoginAvailable() {
            return true;
        }

        @JavascriptInterface
        public void phoneLoginVisible(final boolean show) {
            act.runOnUiThread(() -> act.setLoginOverlayVisible(show));
        }

        @JavascriptInterface
        public String phonePayloadFor(final String id) {
            return act.phonePayloadFor(id);
        }

        @JavascriptInterface
        public void clearPhonePayload(final String id) {
            act.clearPhonePayload(id);
        }

        @JavascriptInterface
        public String phoneStage() {
            return act.phoneStage();
        }

        @JavascriptInterface
        public String phoneFetch2b(final String fyLabel, final String monLabel) {
            return phoneFetch2bSlot(0, fyLabel, monLabel);
        }

        @JavascriptInterface
        public String phoneFetchChunk(final String id, final int offset, final int len) {
            return act.phonePayloadChunk(id, offset, len);
        }

        @JavascriptInterface
        public boolean phoneFetchAvailable() {
            return true;
        }

        @JavascriptInterface
        public boolean hasExternalKeyboard() {
            return act.isExternalKeyboardConnected();
        }

        @JavascriptInterface
        public void hideSoftKeyboard() {
            act.runOnUiThread(() -> act.hideSoftKeyboard());
        }

        @JavascriptInterface
        public String getPendingShareMeta() {
            return act.getPendingShareMetaJson();
        }

        @JavascriptInterface
        public String getPendingShareChunk(final int idx, final int offset, final int len) {
            return act.getPendingShareChunk(idx, offset, len);
        }

        @JavascriptInterface
        public void clearPendingShare() {
            act.clearPendingShare();
        }

        @JavascriptInterface
        public void toast(final String msg) {
            act.runOnUiThread(() -> Toast.makeText(act, msg == null ? "" : msg,
                    Toast.LENGTH_SHORT).show());
        }
    }
}
