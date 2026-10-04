"""Test the actual sign-out reset and listing callback bodies with stateful fakes."""
from pathlib import Path
import subprocess, tempfile
base = Path(__file__).resolve().parents[1]
source = (base/'app/src/main/java/au/sutto/marketonly/MainActivity.java').read_text()
def body(name):
    start=source.index('{',source.index(name));end=start+1;depth=1
    while depth:
        depth+=(source[end]=='{')-(source[end]=='}');end+=1
    return source[start+1:end-1]
harness='''package au.sutto.marketonly;
import java.util.function.Consumer;
public class SessionResetTest {
 static class WebView {
  String url=UrlRules.MARKET;boolean destroyed,stopped,historyCleared,cacheCleared,active=true;
  Consumer<String> pending;
  WebView(Object owner){}String getUrl(){return url;}
  void evaluateJavascript(String js,Consumer<String> callback){pending=callback;}
  void stopLoading(){stopped=true;}void clearCache(boolean disk){cacheCleared=disk;}
  void clearHistory(){historyCleared=true;}void destroy(){destroyed=true;}void setBackgroundColor(int v){}
 }
 static class WebSettings {static final int LOAD_DEFAULT=-1;}
 static class FrameLayout {static class LayoutParams {LayoutParams(int w,int h){}}}
 static class Content {WebView removed,added;
  void removeView(WebView v){removed=v;}void addView(WebView v,int i,FrameLayout.LayoutParams p){added=v;}}
 static class Overlay {boolean dismissed;void dismiss(){dismissed=true;}}
 static class Store {int ingests,clears;void ingest(String s){ingests++;}void viewed(String u){}void clear(){clears++;}}
 static class Uri {}interface ValueCallback<T>{void onReceiveValue(T value);}
 static class FileCallback implements ValueCallback<Uri[]> {boolean cancelled;public void onReceiveValue(Uri[] value){cancelled=value==null;}}
 static class CookieManager {static Consumer<Boolean> pending;static int removals,flushes;static CookieManager getInstance(){return new CookieManager();}void removeAllCookies(Consumer<Boolean> callback){pending=callback;removals++;}void flush(){flushes++;}}
 WebView web=new WebView(this);Content content=new Content();Store listingStore=new Store();
 Overlay smartUi=new Overlay(),photoViewer=new Overlay();Object fullScreenView=new Object();
 FileCallback fileCallback=new FileCallback();WebView fileSource;String fileSourceUrl;boolean signingOut;static final int BG=0;
 long refreshGeneration=10;String refreshTarget=UrlRules.MARKET;boolean refreshingExplore=true;
 int configured,cache,smartClosed,discarded;String loaded;
 boolean isFinishing(){return false;}boolean isDestroyed(){return false;}void configureWebView(){configured++;}
 void cacheMode(int mode){cache=mode;}void load(String url){loaded=url;web.url=url;}
 void cancelRefreshWork(){refreshGeneration++;refreshTarget=null;refreshingExplore=false;}
 void setWebActive(WebView target,boolean active){target.active=active;}void closePopups(){}
 void cancelFileSelection(){CANCELFILE}
 void beginSignOut(){BEGINSIGNOUT}
 void closeFullscreen(){fullScreenView=null;}void closeSmart(){smartClosed++;}void discardRetained(){discarded++;}
 void captureListings(Runnable after){CAPTURE}
 void resetSignedOutBrowser(){RESET}
 static void check(boolean value,String label){if(!value)throw new AssertionError(label);}
 public static void main(String[] args){
  SessionResetTest t=new SessionResetTest();WebView old=t.web;FileCallback picker=t.fileCallback;
  int[] after={0};t.captureListings(()->after[0]++);check(old.pending!=null,"snapshot is pending");
  t.resetSignedOutBrowser();
  check(t.web!=old&&old.destroyed&&old.stopped&&old.cacheCleared&&old.historyCleared,"old page and history removed");
  check(t.content.removed==old&&t.content.added==t.web&&t.configured==1,"new browser is attached and configured");
  check(t.listingStore.clears==1&&t.discarded==1,"stored and retained listings cleared");
  check(picker.cancelled&&t.fileCallback==null,"pending file selection cancelled");
  check(t.smartUi.dismissed&&t.photoViewer.dismissed&&t.fullScreenView==null,"account overlays dismissed");
  check(t.refreshGeneration==11&&t.refreshTarget==null&&!t.refreshingExplore&&t.cache==-1,"old refresh invalidated");
  check(UrlRules.MARKET.equals(t.loaded),"new browser opens Marketplace");
  old.pending.accept("old-account-listings");
  check(t.listingStore.ingests==0&&after[0]==0,"late old-account snapshot cannot refill cleared history or navigate");
  t.captureListings(()->after[0]++);t.web.pending.accept("new-account-listings");
  check(t.listingStore.ingests==1&&after[0]==1,"new browser snapshots still work");
  t=new SessionResetTest();old=t.web;t.captureListings(null);t.beginSignOut();
  check(t.signingOut&&old.destroyed&&old.stopped&&!old.active&&t.web!=old,"signout immediately destroys old renderer before cookies clear");
  check(t.loaded==null&&CookieManager.pending!=null,"placeholder browser stays unloaded until cookie removal returns");
  check(t.discarded==1&&t.fileCallback==null,"retained pages and picker removed before cookie removal");
  int removes=CookieManager.removals;t.beginSignOut();check(CookieManager.removals==removes,"duplicate signout cannot race another clear");
  old.pending.accept("old-account-live-page");check(t.listingStore.ingests==0,"snapshots cannot refill store while cookie clear is pending");
  CookieManager.pending.accept(true);check(!t.signingOut&&UrlRules.MARKET.equals(t.loaded)&&t.configured==1,"cookie completion opens a newly configured browser");
  check(android.webkit.WebStorage.clears==1,"signout clears website storage after cookie removal");
  System.out.println("PASS: sign-out resets browser/session UI and rejects old-account callbacks");
 }
}'''.replace('CAPTURE',body('private void captureListings(')).replace('RESET',body('private void resetSignedOutBrowser(')).replace('CANCELFILE',body('private void cancelFileSelection(')).replace('BEGINSIGNOUT',body('private void beginSignOut('))
with tempfile.TemporaryDirectory(prefix='marketonly-signout-') as tmp:
    test=Path(tmp)/'SessionResetTest.java';test.write_text(harness)
    storage=Path(tmp)/'WebStorage.java';storage.write_text('package android.webkit;public class WebStorage {public static int clears;public static WebStorage getInstance(){return new WebStorage();}public void deleteAllData(){clears++;}}')
    subprocess.run(['java','-m','jdk.compiler/com.sun.tools.javac.Main','-d',tmp,str(test),str(storage),
                    str(base/'app/src/main/java/au/sutto/marketonly/UrlRules.java')],check=True)
    subprocess.run(['java','-cp',tmp,'au.sutto.marketonly.SessionResetTest'],check=True)
