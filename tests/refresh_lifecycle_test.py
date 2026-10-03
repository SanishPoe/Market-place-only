"""Execute the real page-finished method body against a minimal WebView fake.
This tests the cache lifecycle regression, not Android threading/network behavior.
"""
from pathlib import Path
import subprocess, tempfile, sys, zipfile
base=Path(__file__).resolve().parents[1]
if len(sys.argv)>1:
    with zipfile.ZipFile(sys.argv[1]) as z:
        source=z.read('MarketOnly/app/src/main/java/au/sutto/marketonly/MainActivity.java').decode()
else:
    source=(base/'app/src/main/java/au/sutto/marketonly/MainActivity.java').read_text()
start=source.index('{',source.index('void onPageFinished('))
depth=1; end=start+1
while depth:
    depth+=(source[end]=='{')-(source[end]=='}');end+=1
body=source[start+1:end-1]
harness='''package au.sutto.marketonly;
public class RefreshLifecycleTest {
 static class WebSettings {static final int LOAD_DEFAULT=-1; int mode=2;
  void setCacheMode(int v){mode=v;} int getCacheMode(){return mode;}}
 static class WebView {String url=UrlRules.MARKET; WebSettings settings=new WebSettings();int scrolls=0;
  String getUrl(){return url;} WebSettings getSettings(){return settings;} void scrollTo(int x,int y){scrolls++;}}
 static class View {static final int INVISIBLE=4;void setVisibility(int v){}}
 static class CookieManager {static CookieManager getInstance(){return new CookieManager();}void flush(){}}
 WebView web=new WebView();View progress=new View();boolean refreshingExplore=true,pageFailed=false;int injected=0;
 boolean blockedFeed(String u){return false;}void returnToMarket(){}void inject(){injected++;}void clearError(){}
 void onPageFinished(WebView view,String url){BODY}
 static void check(boolean b,String m){if(!b)throw new AssertionError(m);}
 public static void main(String[] args){
  RefreshLifecycleTest t=new RefreshLifecycleTest();
  t.onPageFinished(t.web,UrlRules.MARKET);
  check(t.web.settings.mode==2,"Main page completion restored caching before late listing requests");
  check(t.web.scrolls==1,"Explore must return to top");
  t.onPageFinished(t.web,UrlRules.MARKET);
  check(t.web.settings.mode==2,"Repeated finish callback restored caching");
  check(t.web.scrolls==1,"Repeated callback scrolled page again");
  t.onPageFinished(t.web,"https://www.facebook.com/marketplace/item/1/");
  check(t.web.settings.mode==2,"Stale page completion restored caching");
  t.web.settings.mode=-1;t.refreshingExplore=false;
  t.onPageFinished(t.web,UrlRules.MARKET);
  check(t.web.settings.mode==-1,"Ordinary page completion changed normal cache mode");
  System.out.println("PASS: 4 actual page-finished lifecycle cases (WebView fake, not device acceptance)");
 }
}'''.replace('BODY',body)
with tempfile.TemporaryDirectory(prefix='marketonly-lifecycle-') as tmp:
    p=Path(tmp)/'RefreshLifecycleTest.java';p.write_text(harness)
    subprocess.run(['java','-m','jdk.compiler/com.sun.tools.javac.Main','-d',tmp,
        str(p),str(base/'app/src/main/java/au/sutto/marketonly/UrlRules.java')],check=True)
    subprocess.run(['java','-cp',tmp,'au.sutto.marketonly.RefreshLifecycleTest'],check=True)
