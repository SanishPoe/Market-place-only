package au.sutto.marketonly;

import android.app.Dialog;
import android.content.Context;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.ValueCallback;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

/** An isolated, zoomable photo dialog. Closing it preserves the listing page. */
final class PhotoViewer extends Dialog {
    interface Navigator { void move(int direction,String current,ValueCallback<String> result); }
    private String photoUrl;
    private final String userAgent, template;
    private final Navigator navigator;
    private WebView image;
    private TextView status,title;
    private boolean failed,busy;
    PhotoViewer(Context context,String url,String agent,String html,Navigator navigation){
        super(context,android.R.style.Theme_Material_NoActionBar_Fullscreen);
        if(!UrlRules.photo(url))throw new IllegalArgumentException("Unsupported photo URL");
        photoUrl=url;userAgent=agent;template=html;navigator=navigation;
    }
    private int dp(int value){return Math.round(value*getContext().getResources().getDisplayMetrics().density);}
    private TextView control(String text,String description,View.OnClickListener action){
        TextView v=new TextView(getContext());v.setText(text);v.setTextColor(Color.WHITE);v.setTextSize(26);
        v.setGravity(Gravity.CENTER);v.setContentDescription(description);v.setFocusable(true);v.setOnClickListener(action);
        return v;
    }
    @Override protected void onCreate(Bundle state){
        super.onCreate(state);
        LinearLayout box=new LinearLayout(getContext());box.setOrientation(LinearLayout.VERTICAL);box.setBackgroundColor(Color.BLACK);
        box.setFitsSystemWindows(true);
        LinearLayout bar=new LinearLayout(getContext());bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.addView(control("×","Close photo",v->dismiss()),new LinearLayout.LayoutParams(dp(52),dp(52)));
        bar.addView(control("‹","Previous photo",v->move(-1)),new LinearLayout.LayoutParams(dp(44),dp(52)));
        title=new TextView(getContext());title.setText("Photo");title.setTextColor(Color.WHITE);title.setTextSize(15);title.setGravity(Gravity.CENTER);
        bar.addView(title,new LinearLayout.LayoutParams(0,-2,1));
        bar.addView(control("›","Next photo",v->move(1)),new LinearLayout.LayoutParams(dp(44),dp(52)));
        bar.addView(control("−","Zoom out",v->image.zoomOut()),new LinearLayout.LayoutParams(dp(44),dp(52)));
        bar.addView(control("+","Zoom in",v->image.zoomIn()),new LinearLayout.LayoutParams(dp(44),dp(52)));
        box.addView(bar,new LinearLayout.LayoutParams(-1,dp(52)));
        FrameLayout stage=new FrameLayout(getContext());image=new WebView(getContext());image.setBackgroundColor(Color.BLACK);
        // Only the bundled viewer script runs here. CSP blocks remote scripts,
        // frames and network requests except trusted photo sources. No JS bridge.
        WebSettings s=image.getSettings();s.setJavaScriptEnabled(true);s.setAllowFileAccess(false);s.setAllowContentAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);s.setSafeBrowsingEnabled(true);s.setUserAgentString(userAgent);
        s.setSupportZoom(true);s.setBuiltInZoomControls(true);s.setDisplayZoomControls(false);s.setUseWideViewPort(true);s.setLoadWithOverviewMode(true);
        stage.addView(image,new FrameLayout.LayoutParams(-1,-1));
        status=new TextView(getContext());status.setText("Loading photo…");status.setTextColor(Color.WHITE);status.setGravity(Gravity.CENTER);status.setTextSize(16);
        stage.addView(status,new FrameLayout.LayoutParams(-1,-1));box.addView(stage,new LinearLayout.LayoutParams(-1,0,1));setContentView(box);
        getWindow().setLayout(WindowManager.LayoutParams.MATCH_PARENT,WindowManager.LayoutParams.MATCH_PARENT);
        getWindow().setNavigationBarColor(Color.BLACK);
        image.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){
                Uri u=r.getUrl();
                if(r.isForMainFrame()&&"marketonly".equals(u.getScheme())&&"photo-step".equals(u.getHost())){
                    String direction=u.getQueryParameter("direction");
                    if("1".equals(direction)||"-1".equals(direction))move(Integer.parseInt(direction));
                }
                return true;
            }
            private void error(WebResourceRequest r){if(r.getUrl().toString().equals(photoUrl)){failed=true;status.setText("Couldn’t load this photo. Close it and try again.");status.setVisibility(View.VISIBLE);}}
            @Override public void onReceivedError(WebView v,WebResourceRequest r,WebResourceError e){error(r);}
            @Override public void onReceivedHttpError(WebView v,WebResourceRequest r,WebResourceResponse response){if(response.getStatusCode()>=400)error(r);}
            @Override public void onPageFinished(WebView v,String url){if(!failed)status.setVisibility(View.GONE);}
        });
        showPhoto(photoUrl);
    }
    private void showPhoto(String url){
        photoUrl=url;failed=false;title.setText("Photo");status.setText("Loading photo…");status.setVisibility(View.VISIBLE);
        image.loadDataWithBaseURL("https://www.facebook.com/",template.replace("__PHOTO_URL__",TextUtils.htmlEncode(photoUrl)),"text/html","UTF-8",null);
    }
    private void move(int direction){
        if(busy||image==null||!isShowing())return;
        busy=true;title.setText("Loading…");
        navigator.move(direction,photoUrl,url->{
            busy=false;if(image==null||!isShowing())return;
            if(UrlRules.photo(url)&&!photoUrl.equals(url))showPhoto(url);
            else {
                title.setText(direction>0?"No next photo":"No previous photo");
                image.postDelayed(()->{if(image!=null&&!busy)title.setText("Photo");},1500);
            }
        });
    }
    @Override public void dismiss(){
        super.dismiss();
        if(image!=null){image.stopLoading();((ViewGroup)image.getParent()).removeView(image);image.destroy();image=null;}
    }
}
