package com.karismata.hansearch;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.ActivityNotFoundException;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
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
        setContentView(webView);
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
            return false;
        }

        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
        if (intent.resolveActivity(getPackageManager()) != null) {
            startActivity(intent);
            return true;
        }
        return false;
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
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
