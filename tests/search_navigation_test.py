"""Execute actual retained navigation methods against stateful WebView fakes.
Checks identity/state retention, not Android rendering or Facebook network behavior.
"""
from pathlib import Path
import subprocess,tempfile
base=Path(__file__).resolve().parents[1]
s=(base/'app/src/main/java/au/sutto/marketonly/MainActivity.java').read_text()
def body(name):
 start=s.index('{',s.index(name+'('));depth=1;end=start+1
 while depth:
  depth+=(s[end]=='{')-(s[end]=='}');end+=1
 return s[start+1:end-1]
# Method names also occur in earlier call sites; locate declarations explicitly.
def method(name):
 import re
 m=re.search(r'private void '+name+r'\(',s);start=s.index('{',m.start());depth=1;end=start+1
 while depth:
  depth+=(s[end]=='{')-(s[end]=='}');end+=1
 return s[start+1:end-1]
h='''package au.sutto.marketonly;
import java.util.*;
class BaseNavigation {int exits;public void onBackPressed(){exits++;}}
public class SearchNavigationTest extends BaseNavigation {
 static class View {static final int VISIBLE=0,INVISIBLE=4,GONE=8;int visibility=GONE;Object tag;void setVisibility(int v){visibility=v;}int getVisibility(){return visibility;}Object getTag(){return tag;}}
 static class WebView extends View {String url;int loads,backCalls;boolean paused,destroyed,history;int scroll=1400;String[] results={"1","2","3"};
  WebView(Object a){}String getUrl(){return url;}boolean canGoBack(){return history;}void goBack(){backCalls++;}void onPause(){paused=true;}void onResume(){paused=false;}void stopLoading(){}void destroy(){destroyed=true;}int getHeight(){return 600;}void setLayoutParams(Object o){} }
 static class FrameLayout {static class LayoutParams{LayoutParams(int x,int y){}}}
 static class Content {void addView(Object v,Object p){}void removeView(Object v){}}
 static class Input extends View {String value="Holden Cruze";String getText(){return value;}void setText(String s){value=s;}}
 static class Overlay {boolean showing;void dismiss(){showing=false;}boolean isShowing(){return showing;}}
 static class SmartUi {void dismiss(){}}
 static class ListingStore {void viewed(String u){}}
 static class BrowsePage {WebView view;View panel;String query;BrowsePage(WebView v,View p,String q){view=v;panel=p;query=q;}}
 WebView web=new WebView(this);View smartScreen,fullScreenView,progress=new View();Input searchInput=new Input(),searchRow=new Input();Overlay photoViewer;
 Content content=new Content();SmartUi smartUi;ListingStore listingStore=new ListingStore();ArrayList<BrowsePage> browsePages=new ArrayList<>();
 long refreshGeneration;String refreshTarget,lastGoodUrl;boolean refreshingExplore;
 void captureListings(Runnable r){if(r!=null)r.run();}void configureWebView(){}void clearError(){}void updateTabs(String u){}
 void closeSmart(){smartScreen=null;}void hideSearch(){searchRow.visibility=View.GONE;}void closeFullscreen(){fullScreenView=null;}
 void load(String u){web.url=u;web.loads++;}
 private void openRetained(String target){OPEN}
 private void restoreRetained(){RESTORE}
 private void navigateBack(){BACK}
 static void check(boolean b,String m){if(!b)throw new AssertionError(m);}
 public static void main(String[] args){
  SearchNavigationTest t=new SearchNavigationTest();WebView search=t.web;search.url="https://www.facebook.com/marketplace/search/?query=Holden%20Cruze&minPrice=1000";
  String url=search.url;String[] results=search.results;
  t.openRetained("https://www.facebook.com/marketplace/item/1/");WebView detail=t.web;
  check(t.browsePages.size()==1&&search.paused&&search.loads==0,"opening listing must keep original search alive");
  detail.history=true;t.navigateBack();
  check(t.web==search&&!search.destroyed&&detail.destroyed,"Back must restore same results WebView even if listing has internal history");
  check(url.equals(t.web.url)&&t.web.scroll==1400&&t.web.results==results&&t.web.loads==0,"query/filter URL, scroll and loaded results retained without reload");
  check(t.searchInput.value.equals("Holden Cruze"),"search text retained");
  View panel=new View();int[] rendered={0};panel.tag=(Runnable)()->rendered[0]++;t.smartScreen=panel;
  t.openRetained("https://www.facebook.com/marketplace/search/?query=BMW");t.navigateBack();
  check(t.smartScreen==panel&&rendered[0]==1,"Back restores Smart Search with new observed results");t.closeSmart();
  for(int i=0;i<8;i++)t.openRetained("https://www.facebook.com/marketplace/item/"+(i+10)+"/");
  check(t.browsePages.size()==4&&t.browsePages.get(0).view==search,"bounded deep navigation retains original search");
  while(!t.browsePages.isEmpty())t.navigateBack();check(t.web==search,"deep navigation returns to original search");
  t.photoViewer=new Overlay();t.photoViewer.showing=true;t.navigateBack();check(!t.photoViewer.showing&&t.web==search,"photo Back does not navigate page");
  t.searchRow.visibility=View.VISIBLE;t.navigateBack();check(t.searchRow.visibility==View.GONE&&t.web==search,"keyboard/search row Back preserves results");
  t.openRetained("https://evil.test/marketplace/item/1/");check(t.web==search&&t.browsePages.isEmpty(),"untrusted retained destination rejected");
  System.out.println("PASS: retained search/query/results/scroll, repeated links, nested pages, Smart panel and Back controls (stateful WebView fakes)");
 }
}'''.replace('OPEN',method('openRetained')).replace('RESTORE',method('restoreRetained')).replace('BACK',method('navigateBack'))
with tempfile.TemporaryDirectory(prefix='marketonly-navigation-') as tmp:
 p=Path(tmp)/'SearchNavigationTest.java';p.write_text(h)
 subprocess.run(['java','-m','jdk.compiler/com.sun.tools.javac.Main','-d',tmp,str(p),str(base/'app/src/main/java/au/sutto/marketonly/UrlRules.java')],check=True)
 subprocess.run(['java','-cp',tmp,'au.sutto.marketonly.SearchNavigationTest'],check=True)
