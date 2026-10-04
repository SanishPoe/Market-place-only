"""Execute native refresh methods with controllable WebView callbacks and timers.
Checks request/state/cache behavior; cannot assert Facebook network responses.
"""
from pathlib import Path
import re, subprocess, tempfile
base = Path(__file__).resolve().parents[1]
source = (base/'app/src/main/java/au/sutto/marketonly/MainActivity.java').read_text()
def body(signature):
    start = source.index('{', source.index(signature)); depth = 1; end = start + 1
    while depth:
        depth += (source[end] == '{') - (source[end] == '}'); end += 1
    return source[start+1:end-1]
methods = ['cacheMode', 'releaseRefreshCache', 'cancelRefreshWork', 'refreshExplore',
           'refreshPage', 'refreshCurrent', 'startRefresh', 'parseSnapshot', 'sampleRefresh',
           'load', 'resetRefreshOnNavigation']
parts = []
for name in methods:
    match = re.search(r'    private (?:void|boolean|JSONArray) '+name+r'\([^\n]*\) \{', source)
    if not match: raise AssertionError(name)
    parts.append(source[match.start():source.index('{', match.start())+1] + body(match.group().strip()) + '}')
harness = r'''package au.sutto.marketonly;
import java.util.*;
import java.util.function.Consumer;
public class RefreshLifecycleTest {
 static class View {static final int VISIBLE=0,INVISIBLE=4;int visibility=VISIBLE;void setVisibility(int v){visibility=v;}}
 static class WebSettings {static final int LOAD_DEFAULT=-1,LOAD_NO_CACHE=2;int mode=-1;void setCacheMode(int v){mode=v;}int getCacheMode(){return mode;}}
 static class ServiceWorkerController {static final ServiceWorkerController instance=new ServiceWorkerController();WebSettings settings=new WebSettings();static ServiceWorkerController getInstance(){return instance;}WebSettings getServiceWorkerWebSettings(){return settings;}}
 static class WebView extends View {
  String url=UrlRules.MARKET;WebSettings settings=new WebSettings();int reloads,loads,scrolls,clears,stops;
  Map<Runnable,Integer> tasks=new LinkedHashMap<>();List<Consumer<String>> pending=new ArrayList<>();
  String getUrl(){return url;}WebSettings getSettings(){return settings;}
  void evaluateJavascript(String script,Consumer<String> cb){if(cb!=null)pending.add(cb);}
  void postDelayed(Runnable r,int delay){tasks.put(r,delay);}void removeCallbacks(Runnable r){tasks.remove(r);}
  Consumer<String> callback(){return pending.remove(0);}
  void timer(int delay){for(Runnable r:new ArrayList<>(tasks.keySet()))if(Objects.equals(tasks.get(r),delay)){tasks.remove(r);r.run();}}
  void reload(){reloads++;}void loadUrl(String u){url=u;loads++;}void stopLoading(){stops++;}
  void scrollTo(int x,int y){scrolls++;}void clearCache(boolean v){clears++;}
 }
 static class JSONArray {List<String> values=new ArrayList<>();JSONArray(){}JSONArray(String json){
  if(json==null||!json.trim().startsWith("["))throw new IllegalArgumentException();
  java.util.regex.Matcher m=java.util.regex.Pattern.compile("\"([^\"]*)\"").matcher(json);while(m.find())values.add(m.group(1));
 }int length(){return values.size();}String optString(int i){return values.get(i);}public String toString(){return values.toString();}}
 static class JSONObject {Map<String,Object> values=new HashMap<>();void put(String k,Object v){values.put(k,v);}Object get(String k){return values.get(k);}}
 static class CookieManager {static int flushes;static CookieManager getInstance(){return new CookieManager();}void flush(){flushes++;}}
 static class Prefs {boolean getBoolean(String key,boolean fallback){return fallback;}}
 WebView web=new WebView();View progress=new View();Prefs prefs=new Prefs();String refreshSnapshotScript="snapshot";
 boolean signingOut,finishing,destroyed,pageFailed,refreshingExplore,refreshStarted,refreshRequestPending,refreshLoadIssued,refreshCacheBypass;
 boolean documentCommitted,scriptsInjected,injectionPending,visualRevealPending;long documentGeneration,refreshGeneration;
 String refreshTarget,refreshSourceUrl,lastGoodUrl,fileSourceUrl,documentStartUrl;Object fileCallback;
 WebView refreshView;JSONArray refreshBefore=new JSONArray();JSONObject refreshReport=new JSONObject();
 final ArrayList<Runnable> refreshTasks=new ArrayList<>();static final int REFRESH_WINDOW_MS=20000;
 int injections,errorsCleared,fileCancels,injectionAttempts;
 boolean isFinishing(){return finishing;}boolean isDestroyed(){return destroyed;}
 void closeSmart(){}void hideSearch(){}void clearError(){errorsCleared++;}void cancelFileSelection(){fileCallback=null;fileCancels++;}
 boolean blockedFeed(String u){return false;}void returnToMarket(){}void openMessenger(String u){}void updateTabs(String u){}
 void inject(){injections++;}void inject(boolean reveal){injections++;}
 METHODS
 void onPageStarted(WebView view,String url){STARTED}
 void onPageFinished(WebView view,String url){FINISHED}
 static int checks;static void check(boolean b,String m){checks++;if(!b)throw new AssertionError(m);}
 static RefreshLifecycleTest fresh(){ServiceWorkerController.instance.settings.mode=-1;return new RefreshLifecycleTest();}
 static void complete(RefreshLifecycleTest t){t.web.callback().accept("[\"1\",\"2\"]");t.onPageStarted(t.web,t.web.url);t.onPageFinished(t.web,t.web.url);}
 public static void main(String[] args){
  RefreshLifecycleTest t=fresh();String query="https://www.facebook.com/marketplace/search/?query=Holden%20Cruze&minPrice=1000&radius=25&latitude=-27.47&longitude=153.02#results";
  t.web.url=query;t.refreshExplore();check(t.refreshRequestPending,"snapshot phase is pending");
  t.refreshExplore();check(t.web.pending.size()==1,"duplicate refresh during snapshot is ignored");
  complete(t);check(t.web.reloads==1&&t.web.loads==0&&t.web.url.equals(query),"refresh retains exact search/filter/location URL");
  check(t.web.clears==0,"resource cache is not destroyed on refresh");
  check(t.web.settings.mode==2&&ServiceWorkerController.instance.settings.mode==2,"view and worker bypass cache for initial requests");
  check(t.web.scrolls==1&&!t.refreshRequestPending,"Explore returns to top and completes only once");
  int injected=t.injections,cleared=t.errorsCleared;t.onPageFinished(t.web,UrlRules.MARKET);
  check(t.injections==injected&&t.errorsCleared==cleared,"old page completion cannot alter current page");
  t.onPageFinished(new WebView(),query);check(t.injections==injected,"old WebView completion is ignored");
  t.onPageFinished(t.web,query);check(t.web.scrolls==1&&t.web.settings.mode==2,"repeated finish does not rescroll or stop late-fetch bypass");
  t.web.timer(2500);t.web.callback().accept("[\"1\",\"2\"]");
  check(Integer.valueOf(0).equals(t.refreshReport.get("newInSample")),"unchanged Facebook recommendations reported honestly");
  check(Boolean.TRUE.equals(t.refreshReport.get("sameOrder")),"snapshot order correctly compared");
  t.web.timer(7000);t.web.callback().accept("[\"8\",\"1\"]");
  check(Integer.valueOf(1).equals(t.refreshReport.get("newInSample")),"new listing IDs measured without fabricating or shuffling listings");
  t.web.timer(20000);check(t.web.settings.mode==-1&&ServiceWorkerController.instance.settings.mode==-1,"both caches return to default after bounded window");
  check(Boolean.FALSE.equals(t.refreshReport.get("networkOnly")),"report shows bypass ended");
  for(String region:new String[]{"https://www.facebook.com/marketplace/brisbane/?radius=15","https://www.facebook.com/marketplace/category/vehicles/?maxPrice=20000"}){
   t=fresh();t.web.url=region;t.refreshExplore();complete(t);check(t.web.reloads==1&&t.web.url.equals(region),"regional/category Explore retains current filter URL");
  }
  for(String url:new String[]{UrlRules.SAVED,"https://www.facebook.com/marketplace/item/1/","https://www.facebook.com/marketplace/create/item/"}){
   t=fresh();t.web.url=url;t.refreshExplore();complete(t);check(t.web.url.equals(UrlRules.MARKET)&&t.web.loads==1,"Explore from a feature page still opens Marketplace home");
  }
  t=fresh();t.refreshPage(UrlRules.SAVED,false);Consumer<String> late=t.web.callback();t.web.timer(500);
  check(t.web.loads==1&&t.web.url.equals(UrlRules.SAVED),"missing snapshot callback cannot block refresh");late.accept("[\"9\"]");
  check(t.web.loads==1,"late before-snapshot after fallback cannot start a duplicate request");
  t.refreshPage(UrlRules.SAVED,false);check(t.web.pending.isEmpty(),"duplicate refresh during load ignored");
  t=fresh();t.refreshPage(UrlRules.MARKET,false);Consumer<String> old=t.web.callback();t.load(query);old.accept("[\"1\"]");
  check(t.web.reloads==0&&t.web.url.equals(query)&&t.web.tasks.isEmpty(),"navigation cancels snapshot callbacks and refresh timers");
  t=fresh();t.refreshPage(UrlRules.MARKET,false);t.web.url=query;t.web.timer(500);
  check(!t.refreshRequestPending&&t.web.reloads==0&&t.refreshTarget==null,"changed URL before snapshot does not leave refresh stuck pending");
  t=fresh();t.refreshPage(UrlRules.MARKET,false);complete(t);WebView former=t.web;t.cancelRefreshWork();t.web=new WebView();former.timer(20000);
  check(former.settings.mode==-1&&t.web.settings.mode==-1&&ServiceWorkerController.instance.settings.mode==-1,"retained/replaced WebView does not keep cache disabled");
  t=fresh();t.refreshPage(UrlRules.MARKET,false);complete(t);t.web.timer(2500);Consumer<String> stale=t.web.callback();t.load(query);stale.accept("[\"99\"]");
  check(t.refreshReport.get("afterCount")==null,"late after-snapshot cannot overwrite a new page's report");
  t=fresh();t.signingOut=true;t.refreshPage(UrlRules.MARKET,false);check(t.web.pending.isEmpty()&&t.web.reloads==0,"signout rejects new refresh");
  t=fresh();t.refreshPage(UrlRules.MARKET,false);Consumer<String> gone=t.web.callback();t.destroyed=true;gone.accept("[]");t.web.timer(500);
  check(t.web.reloads==0,"destroyed Activity cannot receive refresh callbacks");
  t=fresh();t.refreshPage("https://facebook.com.evil.test/marketplace/",false);check(t.web.pending.isEmpty(),"untrusted refresh targets rejected");
  System.out.println("PASS: "+checks+" actual native refresh lifecycle checks (WebView fakes, no live Facebook/network assertion)");
 }
}'''.replace('METHODS','\n'.join(parts)).replace('STARTED',body('void onPageStarted(')).replace('FINISHED',body('void onPageFinished('))
with tempfile.TemporaryDirectory(prefix='marketonly-refresh-') as tmp:
    p=Path(tmp)/'RefreshLifecycleTest.java';p.write_text(harness)
    subprocess.run(['java','-m','jdk.compiler/com.sun.tools.javac.Main','-d',tmp,str(p),str(base/'app/src/main/java/au/sutto/marketonly/UrlRules.java')],check=True)
    subprocess.run(['java','-cp',tmp,'au.sutto.marketonly.RefreshLifecycleTest'],check=True)
