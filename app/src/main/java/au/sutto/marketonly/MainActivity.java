package au.sutto.marketonly;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Message;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.webkit.CookieManager;
import android.webkit.ServiceWorkerController;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.PopupMenu;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONObject;
import org.json.JSONArray;

public final class MainActivity extends Activity {
    private static final String MESSENGER_PACKAGE = "com.facebook.orca";
    private static final int FILE_PICKER = 901;
    private static final int BLUE = 0xFF65AEFF;
    private static final int BG = 0xFF242526, FG = 0xFFE4E6EB;
    private WebView web;
    private LinearLayout root;
    private FrameLayout content;
    private TextView pageTitle, exploreTab, sellTab, savedTab, moreTab, smartTab;
    private Button priceButton;
    private ListingStore listingStore;
    private SmartUi smartUi;
    private View smartScreen;
    private boolean appResumed;
    private final java.util.ArrayList<BrowsePage> browsePages = new java.util.ArrayList<>();
    private static final class BrowsePage {
        WebView view; View panel; String query;
        BrowsePage(WebView v, View p, String q) { view=v;panel=p;query=q; }
    }
    private ToolbarIcon backIcon;
    private LinearLayout searchRow;
    private EditText searchInput;
    private ProgressBar progress;
    private View errorView, fullScreenView;
    private WebChromeClient.CustomViewCallback fullScreenCallback;
    private ValueCallback<Uri[]> fileCallback;
    private WebView fileSource;
    private String fileSourceUrl;
    private boolean signingOut;
    private SharedPreferences prefs;
    private String mobileAgent, desktopAgent, guardScript, layoutScript, detailScript, adScript, mediaScript;
    private String pullScript, listingToolsScript, refreshSnapshotScript;
    private PhotoViewer photoViewer;
    private String lastGoodUrl = UrlRules.MARKET;
    private boolean pageFailed;
    private boolean documentCommitted, scriptsInjected, injectionPending, visualRevealPending;
    private long documentGeneration;
    private String documentStartUrl;
    private int injectionAttempts;
    private final java.util.IdentityHashMap<WebView, Runnable> popupExpiry = new java.util.IdentityHashMap<>();
    private long lastMessengerLaunch;
    private long redirectWindowStart;
    private int redirectCount;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        prefs = getSharedPreferences("marketonly", MODE_PRIVATE);
        listingStore = new ListingStore(prefs);
        buildUi();
        configureWebView();
        Intent incomingIntent = getIntent();
        String incoming = incomingListing(incomingIntent);
        if (incoming != null) load(incoming);
        else if (state == null || web.restoreState(state) == null) load(UrlRules.MARKET);
        if (incoming == null && incomingIntent != null && (Intent.ACTION_VIEW.equals(incomingIntent.getAction()) || Intent.ACTION_SEND.equals(incomingIntent.getAction())))
            toast("Use a direct facebook.com/marketplace link to open that listing here.");
        setIntent(new Intent(Intent.ACTION_MAIN));
        smartUi = new SmartUi(this, listingStore, prefs, new SmartUi.Host() {
            public void openListing(String url) { openRetained(url); }
            public void search(String words) { openRetained("https://www.facebook.com/marketplace/search/?query="+Uri.encode(words)); }
            public void location() { closeSmart(); pageAction("location"); }
            public void close() { closeSmart(); }
        });
        content.postDelayed(catalogueTick, 2500);
    }

    private int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }
    private TextView text(String value, int size, int color) {
        TextView t = new TextView(this); t.setText(value); t.setTextSize(size); t.setTextColor(color); return t;
    }
    private Button button(String label, View.OnClickListener listener) {
        Button b = new Button(this); b.setText(label); b.setAllCaps(false); b.setTextSize(14);
        b.setTextColor(BLUE); b.setMinWidth(0); b.setMinimumWidth(0); b.setOnClickListener(listener);
        b.setBackground(pill(false)); b.setPadding(dp(16),dp(8),dp(16),dp(8));
        return b;
    }
    private RippleDrawable pill(boolean selected) {
        GradientDrawable shape=new GradientDrawable(); shape.setCornerRadius(dp(28));
        shape.setColor(selected ? 0xFF263F57 : Color.TRANSPARENT);
        GradientDrawable mask=new GradientDrawable();mask.setColor(Color.WHITE);mask.setCornerRadius(dp(28));
        return new RippleDrawable(ColorStateList.valueOf(0x20FFFFFF),shape,mask);
    }
    private TextView tab(String label, View.OnClickListener action) {
        TextView t=text(label,16,FG);t.setTypeface(null,Typeface.BOLD);t.setGravity(Gravity.CENTER);
        t.setPadding(dp(5),0,dp(5),0);t.setBackground(pill(false));t.setOnClickListener(action);t.setFocusable(true);
        t.setSingleLine(true);t.setAutoSizeTextTypeUniformWithConfiguration(12,16,1,android.util.TypedValue.COMPLEX_UNIT_SP);
        t.setContentDescription(label);return t;
    }
    private void selectTab(TextView tab, boolean active) {
        tab.setTextColor(active ? BLUE : FG);tab.setSelected(active);tab.setBackground(pill(active));
    }
    private ToolbarIcon icon(int type, String label, View.OnClickListener click) {
        return new ToolbarIcon(this,type,label,click);
    }
    private void buildUi() {
        root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(BG);
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            } else v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets;
        });
        LinearLayout header = new LinearLayout(this); header.setGravity(Gravity.CENTER_VERTICAL);
        header.setPadding(dp(12), 0, dp(4), 0);
        backIcon=icon(ToolbarIcon.BACK,"Back to previous page",v->navigateBack());
        backIcon.setVisibility(View.GONE);header.addView(backIcon,new LinearLayout.LayoutParams(dp(36),dp(44)));
        pageTitle = text("Marketplace", 26, FG); pageTitle.setTypeface(null, Typeface.BOLD);
        pageTitle.setGravity(Gravity.CENTER_VERTICAL);
        pageTitle.setIncludeFontPadding(false);
        pageTitle.setSingleLine(true);pageTitle.setAutoSizeTextTypeUniformWithConfiguration(18,26,1,android.util.TypedValue.COMPLEX_UNIT_SP);
        header.addView(pageTitle,new LinearLayout.LayoutParams(0,dp(48),1));
        header.addView(icon(ToolbarIcon.MESSAGE,"Open Messenger",v->openMessenger(null)),new LinearLayout.LayoutParams(dp(44),dp(44)));
        header.addView(icon(ToolbarIcon.SEARCH,"Search Marketplace",v->toggleSearch()),new LinearLayout.LayoutParams(dp(44),dp(44)));
        header.addView(icon(ToolbarIcon.MORE,"Marketplace options",v->showMenu(v)),new LinearLayout.LayoutParams(dp(44),dp(44)));
        root.addView(header,new LinearLayout.LayoutParams(-1,dp(50)));
        LinearLayout tabs=new LinearLayout(this);tabs.setGravity(Gravity.CENTER_VERTICAL);tabs.setPadding(dp(6),0,dp(6),dp(2));
        sellTab=tab("Sell",v->load("https://www.facebook.com/marketplace/create/item/"));
        exploreTab=tab("Explore",v->refreshExplore());
        savedTab=tab("Saved",v->load(UrlRules.SAVED));
        smartTab=tab("Smart",v->showSmart());
        moreTab=tab("More ⌄",v->showMarketplaceMenu(v));
        tabs.addView(sellTab,new LinearLayout.LayoutParams(0,dp(44),0.8f));
        tabs.addView(exploreTab,new LinearLayout.LayoutParams(0,dp(44),1.2f));
        tabs.addView(smartTab,new LinearLayout.LayoutParams(0,dp(44),1.0f));
        tabs.addView(savedTab,new LinearLayout.LayoutParams(0,dp(44),1.0f));
        tabs.addView(moreTab,new LinearLayout.LayoutParams(0,dp(44),1.0f));
        View separator=new View(this);separator.setBackgroundColor(0xFF626466);
        LinearLayout.LayoutParams divider=new LinearLayout.LayoutParams(dp(1),dp(22));divider.setMargins(dp(6),0,dp(4),0);tabs.addView(separator,divider);
        tabs.addView(icon(ToolbarIcon.LOCATION,"Change Marketplace location",v->pageAction("location")),new LinearLayout.LayoutParams(dp(42),dp(44)));
        root.addView(tabs,new LinearLayout.LayoutParams(-1,dp(46)));
        priceButton=button("Check Price",v->checkPrice());priceButton.setVisibility(View.GONE);
        root.addView(priceButton,new LinearLayout.LayoutParams(-1,dp(44)));
        searchRow=new LinearLayout(this);searchRow.setGravity(Gravity.CENTER_VERTICAL);searchRow.setPadding(dp(12),0,dp(8),dp(8));searchRow.setVisibility(View.GONE);
        searchInput=new EditText(this);searchInput.setTextColor(FG);searchInput.setHintTextColor(0xFFB0B3B8);searchInput.setTextSize(16);
        searchInput.setHint("Search Marketplace");searchInput.setSingleLine(true);searchInput.setImeOptions(EditorInfo.IME_ACTION_SEARCH);
        searchInput.setPadding(dp(15),0,dp(15),0);
        GradientDrawable searchBg=new GradientDrawable();searchBg.setColor(0xFF3A3B3C);searchBg.setCornerRadius(dp(24));searchInput.setBackground(searchBg);
        searchInput.setOnEditorActionListener((v,action,event)->{if(action==EditorInfo.IME_ACTION_SEARCH){submitSearch();return true;}return false;});
        searchRow.addView(searchInput,new LinearLayout.LayoutParams(0,dp(44),1));
        searchRow.addView(icon(ToolbarIcon.SEARCH,"Run search",v->submitSearch()),new LinearLayout.LayoutParams(dp(44),dp(44)));
        searchRow.addView(icon(ToolbarIcon.CLOSE,"Close search",v->hideSearch()),new LinearLayout.LayoutParams(dp(44),dp(44)));root.addView(searchRow);
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);progress.setProgressTintList(ColorStateList.valueOf(BLUE));progress.setProgressBackgroundTintList(ColorStateList.valueOf(BG));
        root.addView(progress, new LinearLayout.LayoutParams(-1, dp(2)));
        content = new FrameLayout(this);
        web = new WebView(this); content.addView(web, new FrameLayout.LayoutParams(-1,-1));
        root.addView(content, new LinearLayout.LayoutParams(-1,0,1));
        selectTab(exploreTab,true);
        setContentView(root);
    }
    private void toggleSearch(){
        if(smartScreen!=null){closeSmart();}
        if(searchRow.getVisibility()==View.VISIBLE){hideSearch();return;}
        searchRow.setVisibility(View.VISIBLE);searchInput.requestFocus();
        ((InputMethodManager)getSystemService(INPUT_METHOD_SERVICE)).showSoftInput(searchInput,InputMethodManager.SHOW_IMPLICIT);
    }
    private void hideSearch(){searchRow.setVisibility(View.GONE);((InputMethodManager)getSystemService(INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(searchInput.getWindowToken(),0);}
    private void submitSearch(){
        String query=searchInput.getText().toString().trim();if(query.isEmpty())return;
        hideSearch();load("https://www.facebook.com/marketplace/search/?query="+Uri.encode(query));
    }
    private void pageAction(String action){
        if(!UrlRules.facebook(web.getUrl()))return;
        web.evaluateJavascript("window.__marketOnlyAction ? window.__marketOnlyAction("+JSONObject.quote(action)+") : false",result->{
            if(!"true".equals(result)){
                toast("Facebook's filters are shown on the page. Choose your location there.");
            }
        });
    }
    private void showMarketplaceMenu(View anchor){
        PopupMenu p=new PopupMenu(this,anchor);
        p.getMenu().add(0,1,0,"Saved items");p.getMenu().add(0,2,1,"Saved collections");
        p.getMenu().add(0,3,2,"Categories and filters");p.getMenu().add(0,4,3,"Your Marketplace profile");
        p.setOnMenuItemClickListener(item->{
            switch(item.getItemId()){
                case 1:load(UrlRules.SAVED);break;case 2:load(UrlRules.COLLECTIONS);break;
                case 3:pageAction("controls");break;case 4:load("https://www.facebook.com/marketplace/you/");break;
            }return true;
        });p.show();
    }

    private void configureWebView() {
        documentStartUrl = null;
        ++documentGeneration; documentCommitted = false; scriptsInjected = false; injectionPending = false; visualRevealPending = false; injectionAttempts = 0;
        WebSettings s = web.getSettings();
        mobileAgent = WebSettings.getDefaultUserAgent(this).replace("; wv", "").replace("Version/4.0 ", "");
        Matcher version = Pattern.compile("Chrome/([0-9.]+)").matcher(mobileAgent);
        String chrome = version.find() ? version.group(1) : "120.0.0.0";
        desktopAgent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/" + chrome + " Safari/537.36";
        s.setUserAgentString(prefs.getBoolean("desktop", true) ? desktopAgent : mobileAgent);
        s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false); s.setAllowContentAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setSafeBrowsingEnabled(true);
        s.setJavaScriptCanOpenWindowsAutomatically(false); s.setSupportMultipleWindows(true);
        s.setMediaPlaybackRequiresUserGesture(true); s.setGeolocationEnabled(false);
        s.setSupportZoom(true); s.setBuiltInZoomControls(true); s.setDisplayZoomControls(false);
        s.setUseWideViewPort(true); s.setLoadWithOverviewMode(true);
        s.setTextZoom(100);web.setBackgroundColor(BG);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);
        web.setWebViewClient(new BrowserClient());
        web.setWebChromeClient(new BrowserChrome());
        web.setDownloadListener((url, agent, disposition, mime, length) -> openExternal(url));
        guardScript = readAsset("focus.js");
        adScript = readAsset("adblock.js");
        mediaScript = readAsset("media.js");
        pullScript = readAsset("pull-refresh.js");
        listingToolsScript = readAsset("listing-tools.js");
        refreshSnapshotScript = readAsset("refresh-snapshot.js");
        layoutScript = "window.__marketOnlyCss="+JSONObject.quote(readAsset("marketplace.css"))+";\n"+readAsset("marketplace.js");
        detailScript = readAsset("detail.js");
    }
    private String readAsset(String name) {
        try (InputStream in = getAssets().open(name); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] b = new byte[4096]; int n; while ((n = in.read(b)) != -1) out.write(b,0,n);
            return out.toString("UTF-8");
        } catch (Exception e) { return ""; }
    }
    private boolean isRefreshBrowse(String url) {
        if (!UrlRules.marketplace(url)) return false;
        String path = UrlRules.path(url);
        if (path.matches("/marketplace/(item|create|profile|inbox|messages|selling|buying)(/.*)?")) return false;
        return !path.matches("/marketplace/you(/.*)?") || path.matches("/marketplace/you/saved/?");
    }
    private boolean refreshingExplore;
    private long refreshGeneration;
    private String refreshTarget, refreshSourceUrl;
    private WebView refreshView;
    private JSONArray refreshBefore = new JSONArray();
    private JSONObject refreshReport = new JSONObject();
    private boolean refreshStarted, refreshRequestPending, refreshLoadIssued, refreshCacheBypass;
    private final java.util.ArrayList<Runnable> refreshTasks = new java.util.ArrayList<>();
    // Bypass cache through the initial listing requests, then allow normal cached
    // images/scripts again. Never wipe the resource cache or the login for refresh.
    private static final int REFRESH_WINDOW_MS = 20000;
    private void cacheMode(int mode) {
        web.getSettings().setCacheMode(mode);
        ServiceWorkerController.getInstance().getServiceWorkerWebSettings().setCacheMode(mode);
    }
    private void releaseRefreshCache() {
        if (refreshCacheBypass) {
            if (refreshView != null) refreshView.getSettings().setCacheMode(WebSettings.LOAD_DEFAULT);
            ServiceWorkerController.getInstance().getServiceWorkerWebSettings().setCacheMode(WebSettings.LOAD_DEFAULT);
            refreshCacheBypass = false;
            try { refreshReport.put("networkOnly", false); } catch (Exception ignored) {}
        }
    }
    private void cancelRefreshWork() {
        ++refreshGeneration;
        if (refreshView != null) for (Runnable task : refreshTasks) refreshView.removeCallbacks(task);
        refreshTasks.clear();
        releaseRefreshCache();
        refreshView = null; refreshTarget = null; refreshSourceUrl = null;
        refreshStarted = false; refreshRequestPending = false; refreshLoadIssued = false;
        refreshingExplore = false;
    }
    private void refreshExplore() {
        String current = web.getUrl();
        // Re-selecting Explore on a search/location/category results page refreshes
        // the exact route. Explore from Sell, Saved or a listing still opens home.
        String path = UrlRules.path(current);
        boolean results = UrlRules.marketplace(current) && !UrlRules.listing(current)
                && !path.startsWith("/marketplace/create") && !path.startsWith("/marketplace/you")
                && !path.startsWith("/marketplace/profile");
        refreshPage(results ? current : UrlRules.MARKET, true);
    }
    private void refreshPage(String target, boolean returnToTop) {
        if (signingOut || !UrlRules.facebook(target)) return;
        if (refreshRequestPending && refreshView == web && target.equals(refreshTarget)) return;
        cancelFileSelection(); cancelRefreshWork();
        final long generation = refreshGeneration;
        final WebView source = web;
        refreshView = source; refreshTarget = target; refreshSourceUrl = source.getUrl();
        refreshRequestPending = true;
        closeSmart(); hideSearch(); clearError();
        // A busy or navigating renderer must not hold refresh indefinitely while
        // the optional before-snapshot waits for evaluateJavascript's callback.
        Runnable fallback = () -> startRefresh(generation, source, returnToTop, new JSONArray());
        refreshTasks.add(fallback); source.postDelayed(fallback, 500);
        source.evaluateJavascript(refreshSnapshotScript, value -> {
            if (!refreshCurrent(generation, source) || refreshLoadIssued) return;
            source.removeCallbacks(fallback); refreshTasks.remove(fallback);
            startRefresh(generation, source, returnToTop, parseSnapshot(value));
        });
    }
    private boolean refreshCurrent(long generation, WebView source) {
        return generation == refreshGeneration && source == web && source == refreshView
                && !isFinishing() && !isDestroyed() && !signingOut;
    }
    private void startRefresh(long generation, WebView source, boolean returnToTop, JSONArray before) {
        if (!refreshCurrent(generation, source) || refreshLoadIssued) return;
        if (!java.util.Objects.equals(refreshSourceUrl, source.getUrl())) {
            cancelRefreshWork();
            try { refreshReport.put("status", "navigated_away"); } catch (Exception ignored) {}
            return;
        }
        refreshLoadIssued = true;
        refreshBefore = before; refreshReport = new JSONObject();
        try {
            refreshReport.put("status", "loading");
            refreshReport.put("beforeCount", refreshBefore.length());
            refreshReport.put("networkOnly", true);
            refreshReport.put("cacheBypassLimitMs", REFRESH_WINDOW_MS);
            refreshReport.put("desktop", prefs.getBoolean("desktop", true));
        } catch (Exception ignored) {}
        refreshingExplore = returnToTop;
        source.stopLoading(); cacheMode(WebSettings.LOAD_NO_CACHE); refreshCacheBypass = true;
        lastGoodUrl = refreshTarget;
        source.setVisibility(View.VISIBLE); progress.setVisibility(View.VISIBLE);
        if (refreshTarget.equals(source.getUrl())) source.reload();
        else source.loadUrl(refreshTarget);
        for (int delay : new int[]{2500, 7000, 15000}) {
            final int elapsed = delay;
            Runnable sample = () -> sampleRefresh(generation, elapsed);
            refreshTasks.add(sample); source.postDelayed(sample, delay);
        }
        Runnable release = () -> {
            if (!refreshCurrent(generation, source)) return;
            releaseRefreshCache(); refreshRequestPending = false;
            try { refreshReport.put("cacheWindowComplete", true); } catch (Exception ignored) {}
        };
        refreshTasks.add(release); source.postDelayed(release, REFRESH_WINDOW_MS);
    }
    private JSONArray parseSnapshot(String value) {
        try { return new JSONArray(value); } catch (Exception ignored) { return new JSONArray(); }
    }
    private void sampleRefresh(long generation, int elapsed) {
        final WebView source = refreshView;
        if (!refreshCurrent(generation, source) || !refreshStarted
                || !java.util.Objects.equals(refreshTarget, source.getUrl())) return;
        source.evaluateJavascript(refreshSnapshotScript, value -> {
            if (!refreshCurrent(generation, source)
                    || !java.util.Objects.equals(refreshTarget, source.getUrl())) return;
            JSONArray after = parseSnapshot(value);
            java.util.HashSet<String> beforeIds = new java.util.HashSet<>();
            for (int i = 0; i < refreshBefore.length(); i++) beforeIds.add(refreshBefore.optString(i));
            int added = 0;
            for (int i = 0; i < after.length(); i++) if (!beforeIds.contains(after.optString(i))) added++;
            try {
                refreshReport.put("status", pageFailed ? "page_error" : "sampled");
                refreshReport.put("sampleAfterMs", elapsed);
                refreshReport.put("afterCount", after.length());
                refreshReport.put("newInSample", added);
                refreshReport.put("sameOrder", refreshBefore.toString().equals(after.toString()));
                refreshReport.put("mainPageStarted", refreshStarted);
                refreshReport.put("viewCacheMode", source.getSettings().getCacheMode());
                refreshReport.put("workerCacheMode", ServiceWorkerController.getInstance().getServiceWorkerWebSettings().getCacheMode());
                refreshReport.put("note", "DOM sample only; Facebook controls which recommendations return.");
            } catch (Exception ignored) {}
        });
    }
    private void copyRefreshReport() {
        android.content.ClipboardManager clipboard = (android.content.ClipboardManager)getSystemService(CLIPBOARD_SERVICE);
        clipboard.setPrimaryClip(android.content.ClipData.newPlainText("MarketOnly refresh report", refreshReport.toString()));
        toast("Refresh report copied. Paste it into this chat.");
    }
    private void load(String target) {
        if (signingOut || !UrlRules.facebook(target)) return;
        cancelFileSelection(); cancelRefreshWork();
        cacheMode(WebSettings.LOAD_DEFAULT);
        hideSearch();
        closeSmart();
        clearError(); lastGoodUrl = target; web.setVisibility(View.VISIBLE); web.loadUrl(target);
    }
    private void resetRefreshOnNavigation(String url) {
        if (refreshTarget != null && url != null && !url.equals(refreshTarget)) {
            cancelRefreshWork();
            try { refreshReport.put("status", "navigated_away"); } catch (Exception ignored) {}
        }
    }
    private boolean signedIn() {
        String c = CookieManager.getInstance().getCookie("https://www.facebook.com");
        return c != null && Pattern.compile("(?:^|;\\s*)c_user=").matcher(c).find();
    }
    private boolean blockedFeed(String url) {
        return UrlRules.feed(url) && (!UrlRules.home(url) || signedIn());
    }
    private void returnToMarket() {
        web.setVisibility(View.INVISIBLE);
        long now = android.os.SystemClock.elapsedRealtime();
        if (now - redirectWindowStart > 15000) { redirectWindowStart = now; redirectCount = 0; }
        if (++redirectCount > 5) {
            web.stopLoading();
            showError("Facebook keeps redirecting away from Marketplace. Check that this account has Marketplace access, or switch Desktop website in More and retry.");
            return;
        }
        web.post(() -> { if (!isFinishing()) load(UrlRules.MARKET); });
    }
    private void inject() { inject(false); }
    private void inject(boolean reveal) {
        final WebView source = web;
        final long generation = documentGeneration;
        String current = source.getUrl();
        if (signingOut || !documentCommitted) return;
        if (!UrlRules.facebook(current) || UrlRules.authentication(current)
                || (UrlRules.home(current) && !signedIn())) {
            if (reveal) source.setVisibility(View.VISIBLE);
            return;
        }
        if (scriptsInjected) {
            if (reveal) revealDocument(source, generation);
            return;
        }
        if (injectionPending) return;
        if (injectionAttempts >= 2) { if (reveal) revealDocument(source, generation); return; }
        injectionPending = true; injectionAttempts++;
        // One renderer call installs all page features before revealing the new
        // document. SPA history keeps the existing page and observer installers.
        String script = "(function(){window.__marketOnlyActive="+(appResumed && smartScreen == null)+";"
                +"if(window.__marketOnlyNativeInjected){window.dispatchEvent(new Event('marketonly:activity'));return true;}"
                +"var failures=[];\n"
                +installFeature("focus", guardScript)
                +"window.__marketOnlyHideAds="+prefs.getBoolean("hide_ads",true)+";\n"
                +installFeature("adverts", adScript)+installFeature("media", mediaScript)
                +installFeature("pull_refresh", pullScript)+installFeature("listing_tools", listingToolsScript)
                +(prefs.getBoolean("focused_layout",true) ? installFeature("layout", layoutScript)+installFeature("detail", detailScript) : "")
                +"window.__marketOnlyInstallErrors=failures;window.__marketOnlyNativeInjected=failures.length===0;"
                +"window.dispatchEvent(new Event('marketonly:activity'));return window.__marketOnlyNativeInjected;})();";
        source.evaluateJavascript(script, value -> {
            if (source != web || generation != documentGeneration || isFinishing() || isDestroyed() || signingOut) return;
            injectionPending = false; scriptsInjected = "true".equals(value);
            revealDocument(source, generation);
        });
    }

    private void revealDocument(WebView source, long generation) {
        if (source != web || generation != documentGeneration || signingOut || isFinishing() || isDestroyed()
                || source.getVisibility() == View.VISIBLE || visualRevealPending) return;
        visualRevealPending = true;
        // JavaScript completion precedes compositor updates. Reveal only after
        // Android confirms the styled/ad-filtered document can be drawn.
        source.postVisualStateCallback(generation, new WebView.VisualStateCallback() {
            @Override public void onComplete(long requestId) {
                if (source != web || generation != documentGeneration || signingOut || isFinishing() || isDestroyed()) return;
                visualRevealPending = false; source.setVisibility(View.VISIBLE);
            }
        });
    }
    private String installFeature(String feature, String script) {
        return "try{\n"+script+"\n;}catch(e){if(failures.indexOf("+JSONObject.quote(feature)+")<0)failures.push("+JSONObject.quote(feature)+");}\n";
    }
    private void closePopup(WebView popup) {
        Runnable expiry = popupExpiry.remove(popup);
        if (expiry == null) return;
        popup.removeCallbacks(expiry); popup.stopLoading(); popup.destroy();
    }
    private void closePopups() {
        for (WebView popup : new java.util.ArrayList<>(popupExpiry.keySet())) closePopup(popup);
    }

    /** Routes only trusted Facebook pages internally; arbitrary app intents are never executed. */
    private boolean route(String raw, boolean gesture) {
        if (signingOut || raw == null || raw.length() > 16000) return true;
        Uri u = Uri.parse(raw);
        String scheme = u.getScheme();
        if ("marketonly".equals(scheme)) {
            if (!UrlRules.facebook(web.getUrl())) return true;
            if ("refresh".equals(u.getHost()) && isRefreshBrowse(web.getUrl())) {
                refreshPage(web.getUrl(), false); return true;
            }
            String target = u.getQueryParameter("url");
            if ("listing".equals(u.getHost())) {
                String canonical=ExternalLinks.fromUrl(target);
                if(UrlRules.listing(canonical)) openRetained(canonical);
                return true;
            }
            if ("message".equals(u.getHost()) && UrlRules.messenger(target)) openMessenger(target);
            if ("photo".equals(u.getHost()) && UrlRules.listing(web.getUrl()) && UrlRules.photo(target)) {
                if(photoViewer==null||!photoViewer.isShowing()){
                    photoViewer=new PhotoViewer(this,target,web.getSettings().getUserAgentString(),readAsset("photo-viewer.html"),this::movePhoto);photoViewer.show();
                }
            }
            return true;
        }
        if ("intent".equals(scheme)) {
            try {
                Intent parsed = Intent.parseUri(raw, Intent.URI_INTENT_SCHEME);
                String data = parsed.getDataString();
                if (MESSENGER_PACKAGE.equals(parsed.getPackage()) && data != null
                    && UrlRules.messenger(data)) { openMessenger(data); return true; }
                String fallback = parsed.getStringExtra("browser_fallback_url");
                if (UrlRules.facebook(fallback)) { web.post(() -> load(fallback)); return true; }
                if (UrlRules.messenger(fallback)) { openMessenger(fallback); return true; }
            } catch (Exception ignored) {}
            toast("That app link is not supported. Use the Marketplace controls above."); return true;
        }
        if ("http".equals(scheme) && UrlRules.domain(u.getHost(), "facebook.com")) {
            String secure = u.buildUpon().scheme("https").build().toString();
            web.post(() -> load(secure)); return true;
        }
        if (UrlRules.messenger(raw)) { openMessenger(raw); return true; }
        if (UrlRules.facebook(raw)) {
            if ("l.facebook.com".equalsIgnoreCase(u.getHost()) || "lm.facebook.com".equalsIgnoreCase(u.getHost())) {
                String destination = u.getQueryParameter("u");
                if (destination != null && !destination.equals(raw)) {
                    if (UrlRules.facebook(destination)) web.post(() -> load(destination));
                    else if (gesture) openExternal(destination);
                }
                return true;
            }
            if (blockedFeed(raw)) { returnToMarket(); return true; }
            if (gesture && UrlRules.listing(raw) && !raw.equals(web.getUrl())) { openRetained(raw); return true; }
            return false;
        }
        if ("fb".equals(scheme)) {
            String href = u.getQueryParameter("href");
            if (UrlRules.facebook(href)) { web.post(() -> load(href)); return true; }
            if ("marketplace".equals(u.getHost())) { web.post(() -> load(UrlRules.MARKET)); return true; }
            toast("Tap Explore for Marketplace, or More for Saved items."); return true;
        }
        if (gesture && ("https".equals(scheme) || "mailto".equals(scheme) || "tel".equals(scheme))) openExternal(raw);
        return true;
    }
    private void movePhoto(int direction,String current,ValueCallback<String> result){
        final String listing=web.getUrl();
        if(!UrlRules.listing(listing)){result.onReceiveValue(null);return;}
        String script="window.__marketOnlyMovePhoto ? window.__marketOnlyMovePhoto("+direction+","+JSONObject.quote(current)+") : null";
        web.evaluateJavascript(script,value->readPhotoResult(listing,value,0,result));
    }
    private void readPhotoResult(String listing,String value,int attempts,ValueCallback<String> result){
        if(isFinishing()||!listing.equals(web.getUrl())||photoViewer==null||!photoViewer.isShowing()){result.onReceiveValue(null);return;}
        try{
            JSONObject state=new JSONObject(value);
            String url=state.optString("url");
            if("ready".equals(state.optString("status"))&&UrlRules.photo(url)){result.onReceiveValue(url);return;}
            if("pending".equals(state.optString("status"))&&attempts<24){
                web.postDelayed(()->{
                    if(isFinishing()||!listing.equals(web.getUrl())||photoViewer==null||!photoViewer.isShowing()){result.onReceiveValue(null);return;}
                    web.evaluateJavascript("window.__marketOnlyPhotoState ? window.__marketOnlyPhotoState() : null",next->readPhotoResult(listing,next,attempts+1,result));
                },220);
                return;
            }
        }catch(Exception ignored){}
        result.onReceiveValue(null);
    }
    private class BrowserClient extends WebViewClient {
        @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest r) {
            if(view!=web)return r.isForMainFrame();
            return r.isForMainFrame() && route(r.getUrl().toString(), r.hasGesture());
        }
        @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) {
            if(view!=web || signingOut)return;
            if (fileCallback != null && !java.util.Objects.equals(fileSourceUrl, url)) cancelFileSelection();
            documentStartUrl = url;
            ++documentGeneration; documentCommitted = false; scriptsInjected = false; injectionPending = false; visualRevealPending = false; injectionAttempts = 0;
            view.setVisibility(View.INVISIBLE);
            pageFailed = false; progress.setVisibility(View.VISIBLE);
            if (url != null && url.equals(refreshTarget)) refreshStarted = true;
            if (blockedFeed(url)) { view.stopLoading(); returnToMarket(); return; }
            if (UrlRules.messenger(url)) { view.stopLoading(); openMessenger(url); returnToMarket(); return; }
            if (UrlRules.facebook(url)) lastGoodUrl = url;
            resetRefreshOnNavigation(url);
            updateTabs(url);
        }
        @Override public void onPageCommitVisible(WebView view, String url) {
            if(view!=web || signingOut || url == null
                    || (!url.equals(view.getUrl()) && !url.equals(documentStartUrl)))return;
            if (blockedFeed(url)) { returnToMarket(); return; }
            documentCommitted = true; inject(true);
        }
        @Override public void onPageFinished(WebView view, String url) {
            if(view!=web || signingOut || url == null
                    || (!url.equals(view.getUrl()) && !url.equals(documentStartUrl)))return;
            if (refreshLoadIssued && refreshView == view && !refreshStarted) return;
            if (refreshLoadIssued && refreshView == view && url.equals(refreshTarget)) {
                if (refreshingExplore && UrlRules.marketplace(url) && !UrlRules.listing(url)) view.scrollTo(0, 0);
                refreshingExplore = false; refreshRequestPending = false;
                // Late listing fetches still bypass cache until the bounded window ends.
            }
            if (blockedFeed(url)) { returnToMarket(); return; }
            documentCommitted = true; inject(true); progress.setVisibility(View.INVISIBLE); CookieManager.getInstance().flush();
            if (!pageFailed) clearError();
        }
        @Override public void doUpdateVisitedHistory(WebView view, String url, boolean reload) {
            if(view!=web || signingOut)return;
            if (fileCallback != null && !java.util.Objects.equals(fileSourceUrl, url)) cancelFileSelection();
            if (blockedFeed(url)) { returnToMarket(); return; }
            if(UrlRules.facebook(url))lastGoodUrl=url;
            resetRefreshOnNavigation(url);
            updateTabs(url); inject();
        }
        @Override public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
            if (v==web && r.isForMainFrame()) showError("The page could not load. Check your connection, then tap Retry.");
        }
        @Override public void onReceivedHttpError(WebView v, WebResourceRequest r, WebResourceResponse response) {
            if (v==web && r.isForMainFrame() && response.getStatusCode() >= 400)
                showError("Facebook could not open this page. Retry, or use More to switch desktop view or open Saved collections.");
        }
        @Override public void onReceivedSslError(WebView v, android.webkit.SslErrorHandler handler, android.net.http.SslError error) {
            handler.cancel(); if(v!=web)return; showError("The secure connection could not be verified. Check your phone's date and connection, then retry.");
        }
        @Override public boolean onRenderProcessGone(WebView v, android.webkit.RenderProcessGoneDetail detail) {
            if(v!=web){browsePages.removeIf(p->p.view==v);content.removeView(v);v.destroy();return true;}
            cancelFileSelection(); cancelRefreshWork();
            content.removeView(v); v.destroy();
            web = new WebView(MainActivity.this); content.addView(web, 0, new FrameLayout.LayoutParams(-1,-1));
            configureWebView(); cacheMode(WebSettings.LOAD_DEFAULT);showError("The browser stopped. Tap Retry to reopen this page."); return true;
        }
    }
    private class BrowserChrome extends WebChromeClient {
        @Override public void onProgressChanged(WebView v, int value) { if(v==web)progress.setProgress(value); }
        @Override public boolean onCreateWindow(WebView v, boolean dialog, boolean userGesture, Message result) {
            if (v!=web || signingOut || !userGesture) return false;
            WebView popup = new WebView(MainActivity.this);
            Runnable expiry = () -> closePopup(popup);
            popupExpiry.put(popup, expiry); popup.postDelayed(expiry, 30000);
            popup.setWebViewClient(new WebViewClient() {
                private boolean handled;
                private boolean handle(String url) {
                    if (handled || !popupExpiry.containsKey(popup)) return true;
                    handled = true;
                    if (!route(url, true) && UrlRules.facebook(url)) load(url);
                    popup.post(() -> closePopup(popup)); return true;
                }
                @Override public boolean shouldOverrideUrlLoading(WebView w, WebResourceRequest r) { return handle(r.getUrl().toString()); }
                @Override public void onPageStarted(WebView w, String url, android.graphics.Bitmap icon) {
                    if (!"about:blank".equals(url)) { w.stopLoading(); handle(url); }
                }
            });
            ((WebView.WebViewTransport) result.obj).setWebView(popup); result.sendToTarget(); return true;
        }
        @Override public boolean onShowFileChooser(WebView w, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (w != web || signingOut || !UrlRules.facebook(w.getUrl())) { callback.onReceiveValue(null); return true; }
            cancelFileSelection();
            fileCallback = callback; fileSource = w; fileSourceUrl = w.getUrl();
            Intent pick = new Intent(Intent.ACTION_OPEN_DOCUMENT); pick.addCategory(Intent.CATEGORY_OPENABLE);
            pick.setType("*/*");
            String[] accept = params.getAcceptTypes();
            if (accept != null && accept.length > 0 && !accept[0].isEmpty()) pick.putExtra(Intent.EXTRA_MIME_TYPES, accept);
            pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
            try { startActivityForResult(pick, FILE_PICKER); }
            catch (ActivityNotFoundException e) { cancelFileSelection(); toast("No file picker is available."); }
            return true;
        }
        @Override public void onPermissionRequest(android.webkit.PermissionRequest request) { request.deny(); }
        @Override public void onShowCustomView(View view, CustomViewCallback callback) {
            if (signingOut) { callback.onCustomViewHidden(); return; }
            if (fullScreenView != null) { callback.onCustomViewHidden(); return; }
            fullScreenView = view; fullScreenCallback = callback;
            content.addView(view, new FrameLayout.LayoutParams(-1,-1)); web.setVisibility(View.GONE);
        }
        @Override public void onHideCustomView() { closeFullscreen(); }
    }
    private void closeFullscreen() {
        if (fullScreenView == null) return;
        content.removeView(fullScreenView); fullScreenView = null; web.setVisibility(View.VISIBLE);
        if (fullScreenCallback != null) fullScreenCallback.onCustomViewHidden(); fullScreenCallback = null;
    }
    private void openMessenger(String target) {
        long now = android.os.SystemClock.elapsedRealtime();
        if (now - lastMessengerLaunch < 1000) return; lastMessengerLaunch = now;
        CookieManager.getInstance().flush();
        if (target != null && UrlRules.messenger(target)) {
            String converted = UrlRules.messengerWeb(target);
            Intent exact = new Intent(Intent.ACTION_VIEW, Uri.parse(converted));
            exact.addCategory(Intent.CATEGORY_BROWSABLE); exact.setPackage(MESSENGER_PACKAGE);
            try { startActivity(exact); return; } catch (ActivityNotFoundException ignored) {}
            // The exact URI remains intact when falling back; no recipient is guessed.
            if (UrlRules.https(converted) && !UrlRules.facebook(converted)) {
                try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(converted))); return; }
                catch (ActivityNotFoundException ignored) {}
            }
        }
        Intent launch = getPackageManager().getLaunchIntentForPackage(MESSENGER_PACKAGE);
        if (launch != null) {
            startActivity(launch);
            if (target != null) toast("Messenger opened. Select the seller's Marketplace chat.");
        } else new AlertDialog.Builder(this).setTitle("Messenger is not installed")
            .setMessage("Install Messenger to open your Marketplace conversations there.")
            .setPositiveButton("Get Messenger", (d,w) -> openExternal("https://play.google.com/store/apps/details?id=com.facebook.orca"))
            .setNegativeButton("Close", null).show();
    }
    private void openExternal(String target) {
        if (target == null) return;
        String scheme = Uri.parse(target).getScheme();
        if (!"https".equals(scheme) && !"mailto".equals(scheme) && !"tel".equals(scheme)) return;
        try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(target)).addCategory(Intent.CATEGORY_BROWSABLE)); }
        catch (ActivityNotFoundException e) { toast("No app is available to open this link."); }
    }
    private void openInBrowser(String target) {
        if (target == null || !"https".equals(Uri.parse(target).getScheme())) return;
        Intent browserQuery = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_APP_BROWSER);
        java.util.ArrayList<Intent> choices = new java.util.ArrayList<>();
        java.util.HashSet<String> packages = new java.util.HashSet<>();
        for (android.content.pm.ResolveInfo info : getPackageManager().queryIntentActivities(browserQuery, 0)) {
            if (info.activityInfo == null) continue;
            String name = info.activityInfo.packageName;
            if (name == null || name.equals(getPackageName()) || !packages.add(name)) continue;
            Intent choice = new Intent(Intent.ACTION_VIEW, Uri.parse(target))
                .addCategory(Intent.CATEGORY_BROWSABLE).setPackage(name);
            if (choice.resolveActivity(getPackageManager()) != null) choices.add(choice);
        }
        if (choices.isEmpty()) { toast("No web browser is available to open this page."); return; }
        Intent launch = choices.get(0);
        if (choices.size() > 1) {
            Intent chooser = Intent.createChooser(launch, "Open page in browser");
            chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, choices.subList(1, choices.size()).toArray(new Intent[0]));
            launch = chooser;
        }
        try { startActivity(launch); }
        catch (ActivityNotFoundException e) { toast("No web browser is available to open this page."); }
    }
    private void showMenu(View anchor) {
        PopupMenu menu = new PopupMenu(this, anchor);
        menu.getMenu().add(0,1,0,"Refresh");
        menu.getMenu().add(0,2,1,"Saved collections");
        menu.getMenu().add(0,3,2,"Desktop website").setCheckable(true).setChecked(prefs.getBoolean("desktop",true));
        menu.getMenu().add(0,4,3,"Share this listing");
        menu.getMenu().add(0,5,4,"Open this page in browser");
        menu.getMenu().add(0,6,5,"About / help");
        menu.getMenu().add(0,7,6,"Sign out of MarketOnly");
        menu.getMenu().add(0,8,0,"Saved items");
        menu.getMenu().add(0,9,5,"Compact Marketplace layout").setCheckable(true).setChecked(prefs.getBoolean("focused_layout",true));
        menu.getMenu().add(0,10,4,"Hide adverts").setCheckable(true).setChecked(prefs.getBoolean("hide_ads",true));
        menu.getMenu().add(0,11,5,"Copy layout report");
        menu.getMenu().add(0,12,6,"Copy refresh report");
        menu.getMenu().add(0,13,2,"Open listing links here");
        menu.getMenu().add(0,14,0,"Smart Search");
        menu.getMenu().add(0,15,0,"Check Price").setVisible(UrlRules.listing(web.getUrl()));
        menu.setOnMenuItemClickListener(item -> {
            switch(item.getItemId()) {
                case 1: refreshPage(lastGoodUrl, false); break;
                case 2: load(UrlRules.COLLECTIONS); break;
                case 3:
                    boolean desktop = !prefs.getBoolean("desktop",true); prefs.edit().putBoolean("desktop",desktop).apply();
                    web.getSettings().setUserAgentString(desktop ? desktopAgent : mobileAgent); load(lastGoodUrl); break;
                case 4:
                    Intent share = new Intent(Intent.ACTION_SEND); share.setType("text/plain"); share.putExtra(Intent.EXTRA_TEXT,lastGoodUrl);
                    startActivity(Intent.createChooser(share,"Share listing")); break;
                case 5: openInBrowser(lastGoodUrl); break;
                case 6: showAbout(); break;
                case 8: load(UrlRules.SAVED);break;
                case 9:
                    prefs.edit().putBoolean("focused_layout",!prefs.getBoolean("focused_layout",true)).apply();load(lastGoodUrl);break;
                case 10:
                    prefs.edit().putBoolean("hide_ads",!prefs.getBoolean("hide_ads",true)).apply();load(lastGoodUrl);break;
                case 11: copyLayoutReport();break;
                case 12: copyRefreshReport();break;
                case 13: showLinkSetup();break;
                case 14: showSmart();break;
                case 15: checkPrice();break;
                case 7: new AlertDialog.Builder(this).setTitle("Sign out?").setMessage("This clears this app's Facebook session. Your saved listings stay in your Facebook account.")
                    .setNegativeButton("Cancel", null).setPositiveButton("Sign out", (d,w) -> {
                        beginSignOut();
                    }).show(); break;
            } return true;
        }); menu.show();
    }
    private void copyLayoutReport() {
        if(!UrlRules.facebook(web.getUrl()))return;
        web.evaluateJavascript("window.__marketOnlyLayoutReport ? window.__marketOnlyLayoutReport() : null",result->{
            try {
                Object value=new org.json.JSONTokener(result).nextValue();
                if(!(value instanceof String)||((String)value).length()>50000){toast("Turn on Compact Marketplace layout, then try again.");return;}
                android.content.ClipboardManager clipboard=(android.content.ClipboardManager)getSystemService(CLIPBOARD_SERVICE);
                clipboard.setPrimaryClip(android.content.ClipData.newPlainText("MarketOnly layout report",(String)value));
                toast("Layout report copied. Paste it into this chat.");
            }catch(Exception ignored){toast("Couldn't copy the layout report. Refresh and try again.");}
        });
    }
    private void showAbout() {
        new AlertDialog.Builder(this).setTitle("MarketOnly 1.1.18")
            .setMessage("An independent app displaying Facebook Marketplace. Not affiliated with Meta.\n\nThe dark layout, compact header and two-column listing grid are designed to match Marketplace on your phone. Listings and account actions still use Facebook's website.\n\nSaved opens your Marketplace saves directly. More → Saved collections opens Facebook collections. Search and Messenger are in the header. The pin opens Facebook's location controls when available.\n\nHide adverts is on by default. You can switch it off in the top-right menu. It hides recognised ad cards from browsing pages.\n\nIf a page layout looks wrong, Copy layout report copies sizes and layout settings for troubleshooting, without account details, page text or listing URLs. Compact Marketplace layout and Desktop website can also be switched in the menu.\n\nMessenger links open Messenger. When Facebook provides only a web composer, use it, then tap the Messenger icon.\n\nFeed, Reels and Watch navigation is blocked inside this app. External apps are outside the blocker.\n\nYour Facebook session stays on this phone. There is no separate server or analytics SDK. Use Android's file picker for photos and set location manually.")
            .setPositiveButton("OK", null).show();
    }
    private void updateTabs(String url) {
        boolean saved = url != null && (url.contains("/saved") || url.contains("/collections"));
        boolean selling = url != null && url.contains("/marketplace/create");
        boolean detail = url != null && (url.contains("/marketplace/item/") || url.contains("/marketplace/profile/"));
        if(smartScreen!=null){pageTitle.setText("Smart Search");backIcon.setVisibility(View.VISIBLE);priceButton.setVisibility(View.GONE);selectTab(smartTab,true);selectTab(exploreTab,false);selectTab(savedTab,false);selectTab(sellTab,false);selectTab(moreTab,false);return;}
        selectTab(smartTab,false);priceButton.setVisibility(UrlRules.listing(url)?View.VISIBLE:View.GONE);
        if(url!=null&&UrlRules.path(url).equals("/marketplace/search/")){String q=Uri.parse(url).getQueryParameter("query");if(q!=null)searchInput.setText(q);}
        pageTitle.setText(UrlRules.authentication(url)?"Facebook sign-in":saved?"Saved":selling?"Sell":"Marketplace");
        backIcon.setVisibility(saved||selling||detail||!browsePages.isEmpty()?View.VISIBLE:View.GONE);
        selectTab(exploreTab,!saved&&!selling);selectTab(sellTab,selling);selectTab(savedTab,saved);selectTab(moreTab,false);
    }
    private void showError(String message) {
        pageFailed = true; refreshRequestPending = false; releaseRefreshCache();
        try { if (refreshTarget != null) refreshReport.put("status", "page_error"); } catch (Exception ignored) {}
        progress.setVisibility(View.INVISIBLE); clearError();
        LinearLayout box = new LinearLayout(this); box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER); box.setPadding(dp(26),dp(24),dp(26),dp(24)); box.setBackgroundColor(BG);
        TextView heading = text("Let's reopen that page",22,FG); heading.setTypeface(null,Typeface.BOLD); box.addView(heading);
        TextView body = text(message,16,0xFFB0B3B8); body.setPadding(0,dp(16),0,dp(20)); box.addView(body);
        box.addView(button("Retry", v -> load(lastGoodUrl)));
        box.addView(button("Back to Marketplace", v -> load(UrlRules.MARKET)));
        errorView = box; content.addView(box,new FrameLayout.LayoutParams(-1,-1));
    }
    private void clearError() { if (errorView != null) { content.removeView(errorView); errorView = null; } }
    private void toast(String text) { Toast.makeText(this,text,Toast.LENGTH_LONG).show(); }
    private String incomingListing(Intent intent) {
        if (intent == null) return null;
        if (Intent.ACTION_VIEW.equals(intent.getAction())) return ExternalLinks.fromUrl(intent.getDataString());
        if (Intent.ACTION_SEND.equals(intent.getAction())) {
            CharSequence text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
            return ExternalLinks.fromText(text == null ? null : text.toString());
        }
        return null;
    }
    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        String link = incomingListing(intent);
        if (link != null) {
            if (photoViewer != null) photoViewer.dismiss();
            if (fullScreenView != null) closeFullscreen();
            load(link);
        } else if (Intent.ACTION_VIEW.equals(intent.getAction()) || Intent.ACTION_SEND.equals(intent.getAction())) {
            toast("Use a direct facebook.com/marketplace link to open that listing here.");
        }
        setIntent(new Intent(Intent.ACTION_MAIN));
    }
    private void showLinkSetup() {
        new AlertDialog.Builder(this).setTitle("Open Marketplace links here")
            .setMessage("Tap MarketOnly settings, enable Open supported links, then select the Facebook addresses under Supported web addresses or Add links.\n\nIf Facebook still takes over, open Facebook settings below and turn off its Open supported links. That also affects other Facebook links.\n\nAn app using its own link viewer may need Share → MarketOnly. Direct Marketplace links are supported; shortened share links may need the original listing URL.")
            .setPositiveButton("MarketOnly settings", (d,w) -> openLinkSettings(getPackageName()))
            .setNeutralButton("Facebook settings", (d,w) -> openLinkSettings("com.facebook.katana"))
            .setNegativeButton("Close", null).show();
    }
    private void openLinkSettings(String packageName) {
        Uri app = Uri.parse("package:" + packageName);
        if (Build.VERSION.SDK_INT >= 31) {
            try { startActivity(new Intent(android.provider.Settings.ACTION_APP_OPEN_BY_DEFAULT_SETTINGS, app)); return; }
            catch (ActivityNotFoundException ignored) {}
        }
        try { startActivity(new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, app)); }
        catch (ActivityNotFoundException ignored) { toast("Open Android Settings → Apps → MarketOnly → Set as default."); }
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request,result,data);
        if (request != FILE_PICKER || fileCallback == null) return;
        if (signingOut || fileSource != web || !java.util.Objects.equals(fileSourceUrl, web.getUrl())) {
            cancelFileSelection(); return;
        }
        Uri[] uris = null;
        if (result == RESULT_OK && data != null) {
            if (data.getClipData() != null) { uris = new Uri[data.getClipData().getItemCount()]; for (int i=0;i<uris.length;i++) uris[i]=data.getClipData().getItemAt(i).getUri(); }
            else if (data.getData() != null) uris = new Uri[]{data.getData()};
        }
        ValueCallback<Uri[]> callback = fileCallback;
        fileCallback = null; fileSource = null; fileSourceUrl = null;
        callback.onReceiveValue(uris);
    }
    private void navigateBack() {
        if (photoViewer != null && photoViewer.isShowing()) { photoViewer.dismiss(); return; }
        if (fullScreenView != null) { closeFullscreen(); return; }
        if (smartScreen != null) { closeSmart(); return; }
        if (searchRow.getVisibility()==View.VISIBLE) { hideSearch(); return; }
        clearError();
        if (!browsePages.isEmpty()) { restoreRetained(); return; }
        if (web.canGoBack()) { web.goBack(); return; }
        if(UrlRules.listing(web.getUrl())) { load(UrlRules.MARKET); return; }
        super.onBackPressed();
    }
    @Override public void onBackPressed() { navigateBack(); }
    private final Runnable catalogueTick = new Runnable() {
        @Override public void run() {
            if(isFinishing())return;
            if(appResumed && smartScreen==null) captureListings(null);
            content.postDelayed(this,3000);
        }
    };
    private void captureListings(Runnable after) {
        if (signingOut) return;
        final WebView source=web;final String url=source.getUrl();
        if(!UrlRules.marketplace(url)){if(after!=null)after.run();return;}
        source.evaluateJavascript("window.__moListingSnapshot ? window.__moListingSnapshot() : []", result->{
            if(source!=web||!java.util.Objects.equals(url,web.getUrl())||isFinishing()||signingOut)return;
            listingStore.ingest(result);if(UrlRules.listing(url))listingStore.viewed(url);
            if(after!=null)after.run();
        });
    }
    private void showSmart() {
        captureListings(()->{
            closeSmart();hideSearch();smartScreen=smartUi.searchPanel();content.addView(smartScreen,new FrameLayout.LayoutParams(-1,-1));setWebActive(web, false);updateTabs(web.getUrl());
        });
    }
    private void closeSmart() {
        if(smartScreen!=null){content.removeView(smartScreen);smartScreen=null;setWebActive(web, appResumed && !signingOut);updateTabs(web.getUrl());}
    }
    private void checkPrice() {
        if(!UrlRules.listing(web.getUrl()))return;
        captureListings(()->smartUi.checkPrice(web.getUrl()));
    }
    private void openRetained(String target) {
        if(signingOut || !UrlRules.marketplace(target))return;
        captureListings(()->{
            cancelFileSelection(); cancelRefreshWork();
            if(smartUi!=null)smartUi.dismiss();
            if(photoViewer!=null)photoViewer.dismiss();
            if(fullScreenView!=null)closeFullscreen();
            if(browsePages.size()>=4){BrowsePage old=browsePages.remove(1);content.removeView(old.view);old.view.destroy();}
            browsePages.add(new BrowsePage(web,smartScreen,searchInput.getText().toString()));
            if(smartScreen!=null){content.removeView(smartScreen);smartScreen=null;}
            web.setLayoutParams(new FrameLayout.LayoutParams(-1,Math.max(1,web.getHeight())));
            setWebActive(web, false);web.onPause();web.setVisibility(View.INVISIBLE);
            web=new WebView(this);content.addView(web,new FrameLayout.LayoutParams(-1,-1));configureWebView();
            listingStore.viewed(target);load(target);
        });
    }
    private void restoreRetained() {
        cancelFileSelection(); cancelRefreshWork();
        web.stopLoading();content.removeView(web);web.destroy();
        BrowsePage page=browsePages.remove(browsePages.size()-1);web=page.view;smartScreen=page.panel;
        searchInput.setText(page.query);web.setLayoutParams(new FrameLayout.LayoutParams(-1,-1));web.setVisibility(View.VISIBLE);web.onResume();setWebActive(web, appResumed && smartScreen == null);
        lastGoodUrl=web.getUrl()==null?UrlRules.MARKET:web.getUrl();clearError();progress.setVisibility(View.INVISIBLE);
        if(smartScreen!=null){content.addView(smartScreen,new FrameLayout.LayoutParams(-1,-1));Object refresh=smartScreen.getTag();if(refresh instanceof Runnable)((Runnable)refresh).run();}
        documentStartUrl = web.getUrl();
        ++documentGeneration; documentCommitted = true; scriptsInjected = false; injectionPending = false; visualRevealPending = false; injectionAttempts = 0; inject();
        updateTabs(lastGoodUrl);
    }
    private void discardRetained(){for(BrowsePage page:browsePages){content.removeView(page.view);page.view.destroy();}browsePages.clear();}
    private void resetSignedOutBrowser() {
        // Replacing the WebView rejects late snapshots via captureListings' source
        // identity check and removes the old account's live DOM/back stack.
        cancelRefreshWork();
        if(smartUi!=null)smartUi.dismiss();
        if(photoViewer!=null)photoViewer.dismiss();
        if(fullScreenView!=null)closeFullscreen();
        closeSmart();discardRetained();listingStore.clear();
        cancelFileSelection();
        WebView old=web;
        old.stopLoading();old.clearCache(true);old.clearHistory();
        content.removeView(old);
        web=new WebView(this);
        content.addView(web,0,new FrameLayout.LayoutParams(-1,-1));
        configureWebView();cacheMode(WebSettings.LOAD_DEFAULT);
        old.destroy();
        signingOut = false;
        load(UrlRules.MARKET);
    }
    @Override protected void onSaveInstanceState(Bundle state) { super.onSaveInstanceState(state); web.saveState(state); }
    private void setWebActive(WebView target, boolean active) {
        if (target != null) target.evaluateJavascript("window.__marketOnlyActive="+active+";window.dispatchEvent(new Event('marketonly:activity'));", null);
    }
    private void cancelFileSelection() {
        ValueCallback<Uri[]> callback = fileCallback;
        fileCallback = null; fileSource = null; fileSourceUrl = null;
        if (callback != null) callback.onReceiveValue(null);
    }
    private void beginSignOut() {
        if (signingOut) return;
        signingOut = true;
        closePopups(); cancelFileSelection(); cancelRefreshWork();
        if (smartUi != null) smartUi.dismiss();
        if (photoViewer != null) photoViewer.dismiss();
        if (fullScreenView != null) closeFullscreen();
        closeSmart(); discardRetained();
        WebView old = web;
        setWebActive(old, false); old.stopLoading(); content.removeView(old); old.destroy();
        // An unloaded placeholder prevents the signed-out renderer from making
        // requests or restoring cookies while Android clears the cookie store.
        web = new WebView(this); web.setBackgroundColor(BG);
        content.addView(web, 0, new FrameLayout.LayoutParams(-1,-1));
        CookieManager.getInstance().removeAllCookies(ok -> {
            if (isFinishing() || isDestroyed()) return;
            CookieManager.getInstance().flush(); android.webkit.WebStorage.getInstance().deleteAllData();
            resetSignedOutBrowser();
        });
    }
    @Override protected void onPause() { super.onPause(); appResumed=false;setWebActive(web, false);web.onPause(); CookieManager.getInstance().flush(); }
    @Override protected void onResume() { super.onResume();appResumed=true; if (web != null) {web.onResume();setWebActive(web, !signingOut && smartScreen == null);} }
    @Override protected void onDestroy() {
        content.removeCallbacks(catalogueTick);closePopups();cancelFileSelection();cancelRefreshWork();if(smartUi!=null)smartUi.dismiss();discardRetained();
        if(photoViewer!=null)photoViewer.dismiss();
        if (web != null) { content.removeView(web); web.destroy(); }
        super.onDestroy();
    }
}
