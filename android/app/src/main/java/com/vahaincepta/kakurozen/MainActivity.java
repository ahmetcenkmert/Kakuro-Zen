package com.vahaincepta.kakurozen;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null) {
            WebSettings webSettings = webView.getSettings();
            webSettings.setBuiltInZoomControls(false);
            webSettings.setDisplayZoomControls(false);
            webSettings.setSupportZoom(false);
            webSettings.setTextZoom(100);

            webView.setBackgroundColor(Color.BLACK);
            webView.setVerticalScrollBarEnabled(false);
            webView.setHorizontalScrollBarEnabled(false);
            webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
            webView.setLongClickable(false);
            webView.setHapticFeedbackEnabled(false);
            webView.setOnLongClickListener(ignored -> true);
        }

        getWindow().setStatusBarColor(Color.BLACK);
        getWindow().setNavigationBarColor(Color.BLACK);
        getWindow().getDecorView().setBackgroundColor(Color.BLACK);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        View content = findViewById(android.R.id.content);
        ViewCompat.setOnApplyWindowInsetsListener(content, (view, windowInsets) -> {
            Insets bars = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return WindowInsetsCompat.CONSUMED;
        });
    }
}
