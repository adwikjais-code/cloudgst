package com.cloudgst.noc;

import android.annotation.SuppressLint;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.app.Activity;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.Charset;

/**
 * NOC Maker — BR NOC (शपथ पत्र) + NBR NOC (अनापत्ति प्रमाण पत्र) banane wali chhoti offline app.
 * Sab kuch app ke andar (assets/noc_generator.html) hai — internet ki zarurat nahi.
 */
public class MainActivity extends Activity {

    private WebView web;
    private long lastBackAt = 0L;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);

        web = new WebView(this);
        setContentView(web, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // draft auto-save (localStorage) chalega
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
        s.setTextZoom(100);
        s.setSupportZoom(true);

        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient());
        web.addJavascriptInterface(new Bridge(), "NOCBridge");
        web.loadUrl("file:///android_asset/noc_generator.html");
    }

    /** HTML se ye 3 kaam native tarike se hote hain: print/PDF, copy, .txt save. */
    private class Bridge {

        @JavascriptInterface
        public void printPage() {
            runOnUiThread(() -> {
                try {
                    PrintManager pm = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                    String job = "NOC-" + System.currentTimeMillis();
                    PrintDocumentAdapter adapter = web.createPrintDocumentAdapter(job);
                    PrintAttributes attrs = new PrintAttributes.Builder()
                            .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                            .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                            .build();
                    pm.print(job, adapter, attrs);
                } catch (Throwable t) {
                    toast("Print nahi khula: " + t.getMessage());
                }
            });
        }

        @JavascriptInterface
        public void copyText(final String text) {
            runOnUiThread(() -> {
                try {
                    ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                    cm.setPrimaryClip(ClipData.newPlainText("NOC", text));
                } catch (Throwable t) {
                    toast("Copy fail: " + t.getMessage());
                }
            });
        }

        /** @return jahan file save hui (message me dikhane ke liye) */
        @JavascriptInterface
        public String saveText(final String name, final String text) {
            try {
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues cv = new ContentValues();
                    cv.put(MediaStore.Downloads.DISPLAY_NAME, name);
                    cv.put(MediaStore.Downloads.MIME_TYPE, "text/plain");
                    cv.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                    Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                    if (uri == null) throw new RuntimeException("Downloads me jagah nahi mili");
                    try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                        if (os == null) throw new RuntimeException("file khul nahi payi");
                        os.write(text.getBytes(Charset.forName("UTF-8")));
                    }
                    return "Downloads/" + name;
                }
                // Android 9 aur purane: public Downloads me likhne ke liye permission chahiye hoti hai.
                File dir = null;
                if (checkSelfPermission(android.Manifest.permission.WRITE_EXTERNAL_STORAGE)
                        == android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                }
                if (dir == null || (!dir.exists() && !dir.mkdirs())) dir = getExternalFilesDir(null);
                File f = new File(dir, name);
                try (FileOutputStream fos = new FileOutputStream(f)) {
                    fos.write(text.getBytes(Charset.forName("UTF-8")));
                }
                return f.getAbsolutePath();
            } catch (Throwable t) {
                toast("Save fail: " + t.getMessage());
                return "";
            }
        }
    }

    private void toast(String m) {
        runOnUiThread(() -> Toast.makeText(this, m, Toast.LENGTH_SHORT).show());
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
            return;
        }
        long now = System.currentTimeMillis();
        if (now - lastBackAt < 2000) {
            super.onBackPressed();
        } else {
            lastBackAt = now;
            toast("बाहर निकलने के लिए BACK फिर दबाइए");
        }
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.loadUrl("about:blank");
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
