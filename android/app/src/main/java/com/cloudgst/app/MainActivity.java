package com.cloudgst.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewAssetLoader;

/**
 * CloudGST — Android wrapper.
 * App ka poora UI (v5_8 single-file HTML) assets/app/ me hai aur https://appassets.androidplatform.net
 * se serve hota hai, taaki localStorage / clipboard / fetch sab browser jaisa chale.
 */
public class MainActivity extends Activity {

    public static final String APP_URL = "https://appassets.androidplatform.net/assets/app/index.html";
    private static final int REQ_FILE = 1001;

    private WebView web;
    private ValueCallback<Uri[]> filePathCallback;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        web = new WebView(this);
        setContentView(web, new ViewGroup.LayoutParams(
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
                // Drive / WhatsApp / GST portal jaise bahar ke links system browser me
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, u));
                } catch (Exception ignored) { }
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                // native bridge ka signal (JS se window.CloudGSTNative available hai)
                view.evaluateJavascript("window.document.documentElement.classList.add('native-app');", null);
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb,
                                             FileChooserParams params) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
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
        web.loadUrl(APP_URL);
    }

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
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    /** JS se bulane wala bridge: window.CloudGSTNative.* */
    public static class NativeBridge {
        private final MainActivity act;

        NativeBridge(MainActivity a) {
            this.act = a;
        }

        @android.webkit.JavascriptInterface
        public String appVersion() {
            return "android-5.8";
        }

        @android.webkit.JavascriptInterface
        public void openPortal(final String username, final String password, final String gstin) {
            act.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Intent i = new Intent(act, PortalLoginActivity.class);
                    i.putExtra("u", username == null ? "" : username);
                    i.putExtra("p", password == null ? "" : password);
                    i.putExtra("g", gstin == null ? "" : gstin);
                    act.startActivity(i);
                }
            });
        }

        @android.webkit.JavascriptInterface
        public void toast(final String msg) {
            act.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    android.widget.Toast.makeText(act, msg == null ? "" : msg,
                            android.widget.Toast.LENGTH_SHORT).show();
                }
            });
        }
    }
}
