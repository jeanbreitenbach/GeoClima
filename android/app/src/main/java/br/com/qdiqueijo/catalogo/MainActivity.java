package br.com.qdiqueijo.catalogo;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

public class MainActivity extends Activity {
    private static final String OFFLINE_URL = "file:///android_asset/www/index.html";
    private WebView web;
    private boolean usandoOffline = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);           // guarda a seleção de itens
        s.setAllowFileAccess(true);             // cópia offline
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setUserAgentString(s.getUserAgentString() + " QdiQueijoApp");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                return abrirFora(req.getUrl());
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
                // sem internet: abre a cópia do catálogo que vem dentro do app
                if (req.isForMainFrame() && !usandoOffline) {
                    usandoOffline = true;
                    view.loadUrl(OFFLINE_URL);
                    Toast.makeText(MainActivity.this, "Sem internet — mostrando catálogo salvo no app", Toast.LENGTH_LONG).show();
                }
            }
        });

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(BuildConfig.CATALOGO_URL);
    }

    /** Links do WhatsApp (e qualquer site externo) abrem fora do app. */
    private boolean abrirFora(Uri uri) {
        String url = uri.toString();
        boolean interno = url.startsWith(BuildConfig.CATALOGO_URL) || url.startsWith("file:///android_asset/");
        if (interno) return false;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "Instale o WhatsApp para enviar o pedido", Toast.LENGTH_LONG).show();
        }
        return true;
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        // voltar: fecha a janela aberta (produto/seleção); depois volta página; depois sai
        web.evaluateJavascript(
            "(function(){var d=document.querySelector('dialog[open]');if(d){d.close();return true}return false})()",
            fechou -> {
                if ("true".equals(fechou)) return;
                if (web.canGoBack()) web.goBack();
                else MainActivity.super.onBackPressed();
            });
    }
}
