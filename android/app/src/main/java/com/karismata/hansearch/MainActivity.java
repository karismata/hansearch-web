package com.karismata.hansearch;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.ActivityNotFoundException;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Build;
import android.os.SystemClock;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.ValueCallback;
import android.widget.Toast;

import androidx.core.view.WindowCompat;

public class MainActivity extends Activity {
    private static final String HANSEARCH_HOST = "hansearch-web.pages.dev";
    private WebView webView;
    private static final int IMAGE_CHOOSER = 1001;
    private ValueCallback<Uri[]> imageSelection;
    private final BackPressGuard backGuard = new BackPressGuard();
    private boolean backInFlight;
    private int backRequest;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.WHITE);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setUserAgentString(
                webView.getSettings().getUserAgentString() + " HanSearchAndroidApp");
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return routeUrl(request.getUrl());
            }

            @Override
            @SuppressWarnings("deprecation")
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return routeUrl(Uri.parse(url));
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (imageSelection != null) imageSelection.onReceiveValue(null);
                imageSelection = callback;
                Intent picker = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                picker.addCategory(Intent.CATEGORY_OPENABLE);
                picker.setType("image/*");
                picker.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,
                        params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                picker.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try {
                    startActivityForResult(picker, IMAGE_CHOOSER);
                } catch (ActivityNotFoundException | SecurityException error) {
                    imageSelection.onReceiveValue(null);
                    imageSelection = null;
                    Toast.makeText(MainActivity.this, "사진 선택 앱을 열 수 없습니다.", Toast.LENGTH_LONG).show();
                }
                return true;
            }
        });
        // WebView cannot save APK responses itself. Use the system browser's
        // download handling, including links with an HTML download attribute.
        webView.setDownloadListener((url, userAgent, disposition, mimeType, length) -> {
            Uri uri = Uri.parse(url);
            String scheme = uri.getScheme();
            if ("https".equalsIgnoreCase(scheme) || "http".equalsIgnoreCase(scheme)) {
                openInBrowser(uri);
            } else {
                Toast.makeText(this, "이 파일은 휴대폰 브라우저에서 내려받아 주세요.", Toast.LENGTH_LONG).show();
            }
        });
        setContentView(webView);
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::handleAndroidBack);
        }
        webView.loadUrl("https://" + HANSEARCH_HOST);
    }

    @Override
    @SuppressWarnings("deprecation")
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != IMAGE_CHOOSER || imageSelection == null) return;
        ValueCallback<Uri[]> callback = imageSelection;
        imageSelection = null;
        Uri[] result = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
        if (result != null) {
            // Only accept provider-granted content URIs from the system picker.
            for (Uri uri : result) {
                if (uri == null || !"content".equalsIgnoreCase(uri.getScheme())) {
                    result = null;
                    break;
                }
            }
        }
        callback.onReceiveValue(result);
    }

    private boolean routeUrl(Uri uri) {
        String scheme = uri.getScheme();
        if (scheme == null || !(scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https"))) {
            return false;
        }
        if (HANSEARCH_HOST.equalsIgnoreCase(uri.getHost())) {
            if ("/downloads/HanSearch.apk".equalsIgnoreCase(uri.getPath())) {
                openInBrowser(uri);
                return true;
            }
            return false;
        }
        openInBrowser(uri);
        return true;
    }

    private void openInBrowser(Uri uri) {
        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
        intent.addCategory(Intent.CATEGORY_BROWSABLE);
        // Direct launch avoids package-visibility false negatives on Android 11+.
        try {
            startActivity(intent);
        } catch (ActivityNotFoundException | SecurityException error) {
            Toast.makeText(this, "크롬 또는 삼성 인터넷에서 링크를 열어 주세요.", Toast.LENGTH_LONG).show();
        }
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        handleAndroidBack();
    }

    private void handleAndroidBack() {
        if (webView == null || backInFlight) return;
        backInFlight = true;
        final int request = ++backRequest;
        webView.evaluateJavascript(
                "(function(){try{return typeof window.__hansearchHandleBack==='function'?"
                        + "window.__hansearchHandleBack():'unavailable';}catch(e){return 'unavailable';}})()",
                result -> {
                    if (request != backRequest || isFinishing()) return;
                    backInFlight = false;
                    if ("\"handled\"".equals(result)) {
                        backGuard.reset();
                    } else if ("\"busy\"".equals(result)) {
                        backGuard.reset();
                        Toast.makeText(this, "사진 업로드·저장이 끝난 뒤 다시 눌러 주세요.", Toast.LENGTH_SHORT).show();
                    } else if ("\"home\"".equals(result)) {
                        backAtHome();
                    } else {
                        backWithoutPageHandler();
                    }
                });
        webView.postDelayed(() -> {
            if (request != backRequest || !backInFlight || isFinishing()) return;
            backInFlight = false;
            ++backRequest;
            backWithoutPageHandler();
        }, 1500);
    }

    private void backWithoutPageHandler() {
        if (webView != null && webView.canGoBack()) {
            backGuard.reset();
            webView.goBack();
        } else {
            backAtHome();
        }
    }

    private void backAtHome() {
        if (backGuard.shouldExit(SystemClock.elapsedRealtime())) {
            finish();
        } else {
            Toast.makeText(this, "한 번 더 누르면 프로그램이 종료됩니다.", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    protected void onPause() {
        backGuard.reset();
        ++backRequest;
        backInFlight = false;
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (imageSelection != null) {
            imageSelection.onReceiveValue(null);
            imageSelection = null;
        }
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
