"""Run actual incoming lifecycle bodies with intent/WebView fakes, plus manifest routing.
This does not emulate Android's chooser, domain approval, task stack or Messenger.
"""
from pathlib import Path
import subprocess, tempfile, xml.etree.ElementTree as ET
base=Path(__file__).resolve().parents[1]
source=(base/'app/src/main/java/au/sutto/marketonly/MainActivity.java').read_text()
def body(method):
 start=source.index('{',source.index(method)); end=start+1; depth=1
 while depth:
  depth+=(source[end]=='{')-(source[end]=='}'); end+=1
 return source[start+1:end-1]
harness='''package au.sutto.marketonly;
class IntentBase {
 static final int MODE_PRIVATE=0; Intent intent;
 void onCreate(Bundle b){} void onNewIntent(Intent i){}
 Object getSharedPreferences(String n,int mode){return null;}
 Intent getIntent(){return intent;} void setIntent(Intent i){intent=i;}
}
class Bundle {}
class Intent {
 static final String ACTION_MAIN="MAIN", ACTION_VIEW="VIEW", ACTION_SEND="SEND", EXTRA_TEXT="TEXT";
 String action,data;CharSequence text;
 Intent(String a){action=a;} String getAction(){return action;} String getDataString(){return data;}
 CharSequence getCharSequenceExtra(String n){return text;}
}
public class ExternalIntentTest extends IntentBase {
 static class ListingStore {ListingStore(Object p){}}
 static class SmartUi {interface Host {void openListing(String u);void search(String q);void location();void close();} SmartUi(Object a,Object s,Object p,Host h){}}
 static class Uri {static String encode(String s){return s;}}
 static class Content {void postDelayed(Runnable r,int delay){}}
 ListingStore listingStore;SmartUi smartUi;Content content=new Content();Runnable catalogueTick=()->{};
 void openRetained(String u){}void closeSmart(){}void pageAction(String a){}
 Object prefs; WebView web=new WebView(); Viewer photoViewer; Object fullScreenView;
 String loaded; int loads,toasts,closed;
 static class WebView { int restores;Object restoreState(Bundle b){restores++;return new Object();} }
 static class Viewer {int dismisses;void dismiss(){dismisses++;}}
 void buildUi(){}void configureWebView(){}void load(String u){loaded=u;loads++;}
 void toast(String t){toasts++;}void closeFullscreen(){closed++;fullScreenView=null;}
 public void onCreate(Bundle state){CREATE}
 private String incomingListing(Intent intent){INCOMING}
 protected void onNewIntent(Intent intent){NEW}
 static void check(boolean b,String m){if(!b)throw new AssertionError(m);}
 static Intent tap(String url){Intent i=new Intent(Intent.ACTION_VIEW);i.data=url;return i;}
 public static void main(String[] args){
  String one="https://www.facebook.com/marketplace/item/1/",two="https://www.facebook.com/marketplace/item/2/";
  ExternalIntentTest t=new ExternalIntentTest();t.intent=tap(one);t.onCreate(null);
  check(one.equals(t.loaded)&&t.loads==1,"cold launch lost selected listing");
  check(Intent.ACTION_MAIN.equals(t.intent.action),"cold input must be consumed before rotation");
  t.onCreate(new Bundle());check(t.loads==1&&t.web.restores==1,"rotation reopened old link");
  t.photoViewer=new Viewer();t.fullScreenView=new Object();t.onNewIntent(tap(two));
  check(two.equals(t.loaded)&&t.photoViewer.dismisses==1&&t.closed==1,"warm link must replace current listing and close overlays");
  t.onNewIntent(tap(one));check(one.equals(t.loaded)&&t.loads==3,"second warm link ignored");
  t.onNewIntent(tap("https://facebook.com/reels/1/"));
  check(t.loads==3&&t.toasts==1,"unsupported warm link must preserve current page and explain");
  Intent shared=new Intent(Intent.ACTION_SEND);shared.text=new StringBuilder("See "+two);
  t.onNewIntent(shared);check(two.equals(t.loaded)&&t.loads==4,"shared CharSequence not opened");
  ExternalIntentTest bad=new ExternalIntentTest();bad.intent=tap("https://evil.test/marketplace/item/1/");bad.onCreate(null);
  check(UrlRules.MARKET.equals(bad.loaded)&&bad.toasts==1,"unsupported cold link opened unexpected page or gave no feedback");
  ExternalIntentTest normal=new ExternalIntentTest();normal.intent=new Intent(Intent.ACTION_MAIN);normal.onCreate(null);
  check(UrlRules.MARKET.equals(normal.loaded)&&normal.toasts==0,"normal app launch changed");
  System.out.println("PASS: cold/warm links, rotation, overlays, shared CharSequence, invalid links and normal launch (lifecycle fakes)");
 }
}'''.replace('CREATE',body('void onCreate(')).replace('INCOMING',body('String incomingListing(')).replace('NEW',body('void onNewIntent('))
with tempfile.TemporaryDirectory(prefix='marketonly-intents-') as tmp:
 p=Path(tmp)/'ExternalIntentTest.java';p.write_text(harness)
 subprocess.run(['java','-m','jdk.compiler/com.sun.tools.javac.Main','-d',tmp,str(p),str(base/'app/src/main/java/au/sutto/marketonly/UrlRules.java'),str(base/'app/src/main/java/au/sutto/marketonly/ExternalLinks.java')],check=True)
 subprocess.run(['java','-cp',tmp,'au.sutto.marketonly.ExternalIntentTest'],check=True)
ns='{http://schemas.android.com/apk/res/android}'
root=ET.parse(base/'app/src/main/AndroidManifest.xml').getroot()
activity=root.find('application/activity'); assert activity.get(ns+'launchMode')=='singleTask'
filters=[f for f in activity.findall('intent-filter') if any(a.get(ns+'name')=='android.intent.action.VIEW' for a in f.findall('action'))]
assert len(filters)==1
f=filters[0]
assert {a.get(ns+'name') for a in f.findall('category')}=={'android.intent.category.DEFAULT','android.intent.category.BROWSABLE'}
def values(k): return {d.get(ns+k) for d in f.findall('data') if d.get(ns+k) is not None}
assert values('scheme')=={'http','https'}
assert values('host')=={'facebook.com','www.facebook.com','m.facebook.com','web.facebook.com','mbasic.facebook.com'}
assert values('path')=={'/marketplace'} and values('pathPrefix')=={'/marketplace/'}
assert not values('pathPattern') and not values('mimeType')
assert {p.get(ns+'name') for p in root.findall('uses-permission')}=={'android.permission.INTERNET'}
print('PASS: manifest scopes tapped links to Marketplace on five exact Facebook hosts; no added permissions')
