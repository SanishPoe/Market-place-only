"""Execute the actual popup and route method bodies with Android-shaped fakes.

This verifies routing decisions and popup ownership, not Android resolution,
WebView gesture attribution, popup transport plumbing or Facebook authentication.
"""
from pathlib import Path
import re
import subprocess
import tempfile

base = Path(__file__).resolve().parents[1]
source = (base / 'app/src/main/java/au/sutto/marketonly/MainActivity.java').read_text()


def body(signature):
    match = re.search(signature, source)
    if match is None:
        raise AssertionError('missing actual method: ' + signature)
    start = source.index('{', match.start())
    end, depth = start + 1, 1
    while depth:
        depth += (source[end] == '{') - (source[end] == '}')
        end += 1
    return source[start + 1:end - 1]


harness = r'''package au.sutto.marketonly;
import java.net.URI;
import java.net.URLDecoder;
import java.util.*;

class Activity {
 static final int RESULT_OK=-1;
 protected void onActivityResult(int request,int result,MainActivity.Intent data){}
}
public class MainActivity extends Activity {
 static class Uri {
  final String raw;
  Uri(String s){raw=s;}
  static Uri parse(String s){return new Uri(s);}
  URI parsed(){try{return new URI(raw);}catch(Exception e){return null;}}
  String getScheme(){URI u=parsed();return u==null?null:u.getScheme();}
  String getHost(){URI u=parsed();return u==null?null:u.getHost();}
  String getQueryParameter(String name){
   URI u=parsed();if(u==null||u.getRawQuery()==null)return null;
   for(String p:u.getRawQuery().split("&")){
    int n=p.indexOf('=');if(n<0)continue;
    try{if(name.equals(URLDecoder.decode(p.substring(0,n),"UTF-8")))return URLDecoder.decode(p.substring(n+1),"UTF-8");}
    catch(Exception ignored){}
   }return null;
  }
  Builder buildUpon(){return new Builder(raw);}
  public String toString(){return raw;}
  static class Builder {
   String raw;Builder(String s){raw=s;}
   Builder scheme(String s){raw=s+raw.substring(raw.indexOf(':'));return this;}
   Uri build(){return new Uri(raw);}
  }
 }
 static class Intent {
  static final int URI_INTENT_SCHEME=1;
  static final String ACTION_OPEN_DOCUMENT="OPEN_DOCUMENT",CATEGORY_OPENABLE="OPENABLE",EXTRA_MIME_TYPES="MIME_TYPES",EXTRA_ALLOW_MULTIPLE="MULTIPLE";
  static final String ACTION_MAIN="MAIN",ACTION_VIEW="VIEW",CATEGORY_APP_BROWSER="APP_BROWSER",CATEGORY_BROWSABLE="BROWSABLE",EXTRA_INITIAL_INTENTS="INITIAL_INTENTS";
  // Controlled parse results model Intent.parseUri's package/data/fallback API.
  // The fixture does not claim to verify the Android intent URI parser itself.
  static final Map<String,Intent> parsed=new HashMap<>();
  String pkg,data,fallback,action,type,category;Uri selected;ClipData clips;Intent chooserTarget;
  final Map<String,Object> extras=new HashMap<>();
  Intent(){}Intent(String a){action=a;}Intent(String a,Uri u){action=a;selected=u;}
  Intent addCategory(String c){category=c;return this;}Intent setType(String t){type=t;return this;}
  Intent putExtra(String k,Object v){extras.put(k,v);return this;}
  Intent setPackage(String p){pkg=p;return this;}Object resolveActivity(PackageManager pm){return pm.resolvable.contains(pkg)?new Object():null;}
  static Intent createChooser(Intent target,String title){Intent chooser=new Intent("CHOOSER");chooser.chooserTarget=target;return chooser;}
  Uri getData(){return selected;}ClipData getClipData(){return clips;}
  static Intent parseUri(String raw,int flags)throws Exception{
   Intent i=parsed.get(raw);if(i==null)throw new Exception("bad intent");return i;
  }
  String getPackage(){return pkg;}String getDataString(){return data;}
  String getStringExtra(String key){return "browser_fallback_url".equals(key)?fallback:null;}
 }
 static class ClipData {
  final Uri[] uris;ClipData(Uri... u){uris=u;}
  int getItemCount(){return uris.length;}Item getItemAt(int i){return new Item(uris[i]);}
  static class Item {final Uri uri;Item(Uri u){uri=u;}Uri getUri(){return uri;}}
 }
 static class ActivityNotFoundException extends RuntimeException {}
 static class PackageManager {
  final ArrayList<android.content.pm.ResolveInfo> browsers=new ArrayList<>();
  final Set<String> resolvable=new HashSet<>();int queries;Intent lastQuery;
  List<android.content.pm.ResolveInfo> queryIntentActivities(Intent q,int flags){queries++;lastQuery=q;return browsers;}
  void add(String pkg,boolean resolves){android.content.pm.ResolveInfo r=new android.content.pm.ResolveInfo();r.activityInfo=new android.content.pm.ResolveInfo.ActivityInfo();r.activityInfo.packageName=pkg;browsers.add(r);if(resolves)resolvable.add(pkg);}
 }
 static class WebResourceRequest {
  final Uri url;WebResourceRequest(String u){url=Uri.parse(u);}Uri getUrl(){return url;}
 }
 static class Message {Object obj;int sends;void sendToTarget(){sends++;}}
 static class WebViewClient {
  boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){return false;}
  void onPageStarted(WebView v,String u,android.graphics.Bitmap b){}
 }
 static class WebView {
  static final ArrayList<WebView> made=new ArrayList<>();
  String url=UrlRules.MARKET;boolean stopped,destroyed;WebViewClient client;
  final Map<Runnable,Integer> tasks=new IdentityHashMap<>();int destructions;
  WebView(Object context){made.add(this);}
  String getUrl(){return url;}void setWebViewClient(WebViewClient c){client=c;}
  void post(Runnable r){r.run();}void postDelayed(Runnable r,int delay){tasks.put(r,delay);}void removeCallbacks(Runnable r){tasks.remove(r);}
  void destroy(){destroyed=true;destructions++;}void stopLoading(){stopped=true;}
  static class WebViewTransport {WebView value;void setWebView(WebView v){value=v;}}
 }
 static class WebChromeClient {
  boolean onCreateWindow(WebView v,boolean d,boolean g,Message m){return false;}
  boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> cb,FileChooserParams params){return false;}
  static class FileChooserParams {
   static final int MODE_OPEN=0,MODE_OPEN_MULTIPLE=1;
   final String[] accept;final int mode;
   FileChooserParams(int m,String... a){mode=m;accept=a;}
   String[] getAcceptTypes(){return accept;}int getMode(){return mode;}
  }
 }
 interface ValueCallback<T>{void onReceiveValue(T value);}
 static class PhotoViewer {
  interface Navigator {void move(int direction,String current,ValueCallback<String> result);}
  boolean showing;PhotoViewer(Object c,String url,String ua,String html,Navigator n){}
  boolean isShowing(){return showing;}void show(){showing=true;}
 }
 static class Settings {String getUserAgentString(){return "fixture";}}
 // getSettings is needed only for the unrelated photo route branch.
 static class ActiveWebView extends WebView {
  ActiveWebView(Object c){super(c);}Settings getSettings(){return new Settings();}
 }
 static final String MESSENGER_PACKAGE="com.facebook.orca";
 static final int FILE_PICKER=901;
 ActiveWebView web=new ActiveWebView(this);PhotoViewer photoViewer;
 final IdentityHashMap<WebView,Runnable> popupExpiry=new IdentityHashMap<>();
 boolean signingOut,pickerUnavailable;
 ValueCallback<Uri[]> fileCallback;WebView fileSource;String fileSourceUrl;
 Intent picked;int pickerRequest;
 PackageManager packageManager=new PackageManager();Intent launched;boolean activityUnavailable;
 PackageManager getPackageManager(){return packageManager;}String getPackageName(){return "au.sutto.marketonly.dev";}
 void startActivity(Intent i){if(activityUnavailable)throw new ActivityNotFoundException();launched=i;}
 void startActivityForResult(Intent intent,int request){if(pickerUnavailable)throw new ActivityNotFoundException();picked=intent;pickerRequest=request;}
 String loaded,retained,messenger,external;int marketReturns,toasts;
 boolean isRefreshBrowse(String u){return UrlRules.marketplace(u)&&!UrlRules.listing(u);}
 void refreshPage(String u,boolean top){loaded=u;}
 boolean blockedFeed(String u){return UrlRules.feed(u);}
 void returnToMarket(){marketReturns++;}
 void load(String u){if(UrlRules.facebook(u))loaded=u;}
 void openRetained(String u){retained=u;}
 void openMessenger(String u){messenger=u;}
 void openExternal(String u){
  String s=Uri.parse(u).getScheme();
  if("https".equals(s)||"mailto".equals(s)||"tel".equals(s))external=u;
 }
 String readAsset(String name){return "";}
 void movePhoto(int d,String u,ValueCallback<String> cb){cb.onReceiveValue(null);}
 void toast(String text){toasts++;}
 private boolean route(String raw,boolean gesture){ROUTE}
 private void closePopup(WebView popup){CLOSE_POPUP}
 private void closePopups(){CLOSE_POPUPS}
 private void openInBrowser(String target){OPEN_BROWSER}
 private void cancelFileSelection(){CANCEL}
 @Override protected void onActivityResult(int request,int result,Intent data){RESULT}
 class BrowserChrome extends WebChromeClient {
  @Override public boolean onCreateWindow(WebView v,boolean dialog,boolean userGesture,Message result){POPUP}
  @Override public boolean onShowFileChooser(WebView w,ValueCallback<Uri[]> callback,FileChooserParams params){CHOOSER}
 }
 static class Selection implements ValueCallback<Uri[]> {
  int calls;Uri[] received;MainActivity owner;boolean sawCleared;
  Selection(MainActivity t){owner=t;}
  public void onReceiveValue(Uri[] value){calls++;received=value;sawCleared=owner.fileCallback==null&&owner.fileSource==null&&owner.fileSourceUrl==null;}
 }
 static int checks;
 static void check(boolean value,String message){checks++;if(!value)throw new AssertionError(message);}
 static Message message(){Message m=new Message();m.obj=new WebView.WebViewTransport();return m;}
 static WebView popup(MainActivity activity){
  Message m=message();boolean accepted=activity.new BrowserChrome().onCreateWindow(activity.web,false,true,m);
  check(accepted&&m.sends==1,"gesture popup must be transported exactly once");
  WebView p=((WebView.WebViewTransport)m.obj).value;
  check(p!=null&&p!=activity.web&&p.client!=null,"popup gets isolated client");
  check(activity.popupExpiry.containsKey(p)&&p.tasks.size()==1&&p.tasks.values().iterator().next()==30000,"popup has bounded tracked lifetime");return p;
 }
 static void navigate(WebView popup,String url){
  check(popup.client.shouldOverrideUrlLoading(popup,new WebResourceRequest(url)),"popup routes rather than rendering URL");
  check(popup.destroyed,"consumed popup destroyed");
 }
 public static void main(String[] args){
  MainActivity t=new MainActivity();BrowserChrome chrome=t.new BrowserChrome();
  Message idle=message();int count=WebView.made.size();
  check(!chrome.onCreateWindow(t.web,false,false,idle)&&idle.sends==0&&WebView.made.size()==count,"passive popup denied without allocating browser");
  WebView retained=new WebView(t);count=WebView.made.size();Message stale=message();
  check(!chrome.onCreateWindow(retained,false,true,stale)&&stale.sends==0&&WebView.made.size()==count,"inactive retained page cannot open popup");
  t.signingOut=true;Message exiting=message();count=WebView.made.size();
  check(!chrome.onCreateWindow(t.web,false,true,exiting)&&exiting.sends==0&&WebView.made.size()==count,"sign-out blocks popup allocation");t.signingOut=false;
  WebView empty=popup(t);empty.client.onPageStarted(empty,"about:blank",null);
  check(!empty.destroyed&&t.loaded==null,"popup bootstrap about:blank is inert");
  String listing="https://www.facebook.com/marketplace/item/17/";
  navigate(empty,listing);check(listing.equals(t.retained)&&t.loaded==null,"listing popup preserves retained navigation");
  check(t.popupExpiry.isEmpty()&&empty.tasks.isEmpty()&&empty.stopped&&empty.destructions==1,"handled popup releases ownership and timeout exactly once");
  t.retained=null;empty.client.shouldOverrideUrlLoading(empty,new WebResourceRequest("https://www.facebook.com/marketplace/item/99/"));
  check(t.retained==null&&empty.destructions==1,"duplicate popup callback cannot route again or destroy twice");
  t=new MainActivity();WebView expired=popup(t);Runnable expiry=t.popupExpiry.get(expired);expiry.run();
  check(expired.destroyed&&expired.stopped&&expired.tasks.isEmpty()&&t.popupExpiry.isEmpty(),"blank popup expiry destroys and unregisters browser");
  expired.client.onPageStarted(expired,listing,null);check(t.retained==null&&t.loaded==null&&expired.destructions==1,"expired popup callback cannot navigate");
  t=new MainActivity();WebView blankA=popup(t),blankB=popup(t);t.closePopups();
  check(blankA.destroyed&&blankB.destroyed&&blankA.tasks.isEmpty()&&blankB.tasks.isEmpty()&&t.popupExpiry.isEmpty(),"signout/destroy popup cleanup releases all tracked browsers");
  t.closePopups();check(blankA.destructions==1&&blankB.destructions==1,"repeated popup cleanup is idempotent");
  t=new MainActivity();navigate(popup(t),"https://www.facebook.com/login/?next=%2Fmarketplace%2F");
  check(t.loaded!=null&&t.loaded.contains("/login/")&&t.external==null,"Facebook login opens internally");
  t=new MainActivity();WebView started=popup(t);started.client.onPageStarted(started,listing,null);
  check(started.stopped&&started.destroyed&&listing.equals(t.retained),"page-start popup route stops popup load");
  t=new MainActivity();navigate(popup(t),"https://www.facebook.com/reels/17/");
  check(t.marketReturns==1&&t.retained==null&&t.loaded==null,"known feed popup redirected to Marketplace");
  t=new MainActivity();String thread="https://www.facebook.com/messages/t/123?ref=marketplace#last";navigate(popup(t),thread);
  check(thread.equals(t.messenger)&&t.loaded==null,"seller thread identity stays exact");
  t=new MainActivity();navigate(popup(t),"https://example.test/listing-info");
  check("https://example.test/listing-info".equals(t.external)&&t.loaded==null,"external HTTPS popup handed out of internal Facebook browser");
  for(String bad:new String[]{"javascript:alert(1)","file:///sdcard/private.txt","content://private/1","marketonly://photo?url=https%3A%2F%2Fevil.test%2Fphoto.jpg"}){
   t=new MainActivity();navigate(popup(t),bad);
   check(t.loaded==null&&t.retained==null&&t.external==null&&t.messenger==null,"unsafe/custom popup cannot load or launch: "+bad);
  }
  String raw="intent://attacker/#Intent;scheme=attacker;package=com.attacker;end";
  Intent attack=new Intent();attack.pkg="com.attacker";attack.data="attacker://secret";attack.fallback="https://evil.test/not-facebook";Intent.parsed.put(raw,attack);
  t=new MainActivity();navigate(popup(t),raw);
  check(t.external==null&&t.loaded==null&&t.messenger==null&&t.toasts==1,"raw attacker intent and external fallback never launched");
  String rawGood="intent://thread/#Intent;scheme=fb-messenger;package=com.facebook.orca;end";
  Intent good=new Intent();good.pkg=MESSENGER_PACKAGE;good.data="fb-messenger://thread/123";Intent.parsed.put(rawGood,good);
  t=new MainActivity();navigate(popup(t),rawGood);
  check(good.data.equals(t.messenger)&&t.external==null,"recognised Messenger data delegated without executing supplied intent");
  String rawFallback="intent://market/#Intent;S.browser_fallback_url=facebook;end";
  Intent fallback=new Intent();fallback.pkg="com.attacker";fallback.data="javascript:alert(1)";fallback.fallback=listing;Intent.parsed.put(rawFallback,fallback);
  t=new MainActivity();navigate(popup(t),rawFallback);
  check(listing.equals(t.loaded)&&t.external==null&&t.messenger==null,"trusted fallback admitted while attacker intent ignored");
  t=new MainActivity();navigate(popup(t),"https://facebook.com.evil.test/marketplace/item/17/");
  check(t.loaded==null&&t.retained==null&&t.external!=null,"lookalike Facebook popup never enters trusted browser");
  t=new MainActivity();Selection one=new Selection(t);WebChromeClient.FileChooserParams single=new WebChromeClient.FileChooserParams(0,"image/*");
  check(t.new BrowserChrome().onShowFileChooser(t.web,one,single),"active Facebook chooser handled");
  check(one.calls==0&&t.fileSource==t.web&&UrlRules.MARKET.equals(t.fileSourceUrl),"file picker captures renderer and URL ownership");
  check(t.pickerRequest==FILE_PICKER&&Intent.ACTION_OPEN_DOCUMENT.equals(t.picked.action)&&Intent.CATEGORY_OPENABLE.equals(t.picked.category),"system document picker requested");
  check("*/*".equals(t.picked.type)&&Arrays.equals((String[])t.picked.extras.get(Intent.EXTRA_MIME_TYPES),new String[]{"image/*"})&&Boolean.FALSE.equals(t.picked.extras.get(Intent.EXTRA_ALLOW_MULTIPLE)),"single photo type and mode forwarded");
  Intent result=new Intent();result.selected=Uri.parse("content://photos/1");t.onActivityResult(FILE_PICKER,RESULT_OK,result);
  check(one.calls==1&&one.received.length==1&&"content://photos/1".equals(one.received[0].toString())&&one.sawCleared,"selected photo returned after clearing ownership");
  t.onActivityResult(FILE_PICKER,RESULT_OK,result);check(one.calls==1,"duplicate activity result cannot reuse callback");
  t=new MainActivity();Selection old=new Selection(t),multiple=new Selection(t);
  t.new BrowserChrome().onShowFileChooser(t.web,old,single);
  t.new BrowserChrome().onShowFileChooser(t.web,multiple,new WebChromeClient.FileChooserParams(1,"image/*","video/*"));
  check(old.calls==1&&old.received==null&&old.sawCleared,"replacing picker cancels old callback after clearing fields");
  check(Boolean.TRUE.equals(t.picked.extras.get(Intent.EXTRA_ALLOW_MULTIPLE)),"multiple photo selection enabled");
  result=new Intent();result.clips=new ClipData(Uri.parse("content://photos/1"),Uri.parse("content://photos/2"));t.onActivityResult(FILE_PICKER,RESULT_OK,result);
  check(multiple.calls==1&&multiple.received.length==2&&"content://photos/2".equals(multiple.received[1].toString()),"all selected photos returned in order");
  t=new MainActivity();Selection pending=new Selection(t),inactive=new Selection(t);t.new BrowserChrome().onShowFileChooser(t.web,pending,single);
  t.new BrowserChrome().onShowFileChooser(new WebView(t),inactive,single);
  check(inactive.calls==1&&inactive.received==null&&pending.calls==0&&t.fileCallback==pending,"inactive browser denied without disrupting active picker");
  t=new MainActivity();t.web.url="https://evil.test/";Selection foreign=new Selection(t);t.new BrowserChrome().onShowFileChooser(t.web,foreign,single);
  check(foreign.calls==1&&foreign.received==null&&t.picked==null,"untrusted page cannot request native file picker");
  t=new MainActivity();t.signingOut=true;Selection loggedOut=new Selection(t);t.new BrowserChrome().onShowFileChooser(t.web,loggedOut,single);
  check(loggedOut.calls==1&&loggedOut.received==null&&t.picked==null,"signout blocks new file access");
  for(int change=0;change<3;change++){
   t=new MainActivity();Selection staleSelection=new Selection(t);t.new BrowserChrome().onShowFileChooser(t.web,staleSelection,single);
   if(change==0)t.web=new ActiveWebView(t);else if(change==1)t.web.url="https://www.facebook.com/marketplace/create/item/";else t.signingOut=true;
   result=new Intent();result.selected=Uri.parse("content://photos/private");t.onActivityResult(FILE_PICKER,RESULT_OK,result);
   check(staleSelection.calls==1&&staleSelection.received==null&&staleSelection.sawCleared,"stale picker result rejected for renderer/URL/session change "+change);
  }
  t=new MainActivity();Selection cancelled=new Selection(t);t.new BrowserChrome().onShowFileChooser(t.web,cancelled,single);t.onActivityResult(FILE_PICKER,0,null);
  check(cancelled.calls==1&&cancelled.received==null&&cancelled.sawCleared,"cancelled picker resolves once with no file access");
  t=new MainActivity();Selection unrelated=new Selection(t);t.new BrowserChrome().onShowFileChooser(t.web,unrelated,single);t.onActivityResult(999,RESULT_OK,result);
  check(unrelated.calls==0&&t.fileCallback==unrelated,"unrelated activity result preserves outstanding picker");
  t=new MainActivity();t.pickerUnavailable=true;Selection missing=new Selection(t);t.new BrowserChrome().onShowFileChooser(t.web,missing,single);
  check(missing.calls==1&&missing.received==null&&missing.sawCleared&&t.toasts==1,"missing picker cancels callback and gives feedback");
  for(String invalid:new String[]{null,"http://www.facebook.com/marketplace/","javascript:alert(1)","file:///private"}){
   t=new MainActivity();t.openInBrowser(invalid);check(t.packageManager.queries==0&&t.launched==null,"browser menu rejects non-HTTPS target");
  }
  t=new MainActivity();t.packageManager.add(t.getPackageName(),true);t.packageManager.add("com.browser.one",true);t.packageManager.add("com.browser.one",true);t.packageManager.add("com.unavailable.browser",false);
  t.openInBrowser(listing);
  check(Intent.ACTION_MAIN.equals(t.packageManager.lastQuery.action)&&Intent.CATEGORY_APP_BROWSER.equals(t.packageManager.lastQuery.category),"browser menu resolves only browser-category apps");
  check(t.launched!=null&&"com.browser.one".equals(t.launched.pkg)&&Intent.ACTION_VIEW.equals(t.launched.action)&&listing.equals(t.launched.selected.toString()),"one browser launches explicit package without re-entering MarketOnly");
  check(Intent.CATEGORY_BROWSABLE.equals(t.launched.category)&&t.toasts==0,"explicit browser launch preserves browsable listing URL");
  t=new MainActivity();t.packageManager.add("com.browser.one",true);t.packageManager.add("com.browser.two",true);t.packageManager.add(t.getPackageName(),true);t.openInBrowser(listing);
  check(t.launched!=null&&"CHOOSER".equals(t.launched.action)&&"com.browser.one".equals(t.launched.chooserTarget.pkg),"multiple browsers get browser-only chooser");
  Intent[] other=(Intent[])t.launched.extras.get(Intent.EXTRA_INITIAL_INTENTS);
  check(other.length==1&&"com.browser.two".equals(other[0].pkg)&&listing.equals(other[0].selected.toString()),"chooser alternatives exclude self and preserve exact listing");
  t=new MainActivity();t.packageManager.add(t.getPackageName(),true);t.packageManager.browsers.add(new android.content.pm.ResolveInfo());t.openInBrowser(listing);
  check(t.launched==null&&t.toasts==1,"no browser handler gives feedback without self fallback");
  t=new MainActivity();t.packageManager.add("com.browser.one",true);t.activityUnavailable=true;t.openInBrowser(listing);
  check(t.launched==null&&t.toasts==1,"browser removed before launch gives feedback");
  System.out.println("PASS: "+checks+" actual popup, route, browser-menu and photo-upload ownership decisions with Android-shaped fakes; Android parser, resolver, system picker and transport not emulated");
 }
}
'''.replace('ROUTE', body(r'private boolean route\(')).replace(
    'CLOSE_POPUP}', body(r'private void closePopup\(') + '}').replace(
    'CLOSE_POPUPS}', body(r'private void closePopups\(') + '}').replace(
    'POPUP', body(r'public boolean onCreateWindow\(')).replace(
    'CHOOSER}', body(r'public boolean onShowFileChooser\(') + '}').replace(
    'CANCEL', body(r'private void cancelFileSelection\(')).replace(
    'OPEN_BROWSER', body(r'private void openInBrowser\(')).replace(
    'RESULT}', body(r'protected void onActivityResult\(') + '}')

with tempfile.TemporaryDirectory(prefix='marketonly-popups-') as tmp:
    test = Path(tmp) / 'MainActivity.java'
    test.write_text(harness)
    bitmap = Path(tmp) / 'android/graphics/Bitmap.java'
    bitmap.parent.mkdir(parents=True)
    bitmap.write_text('package android.graphics;public class Bitmap {}')
    resolve_info = Path(tmp) / 'android/content/pm/ResolveInfo.java'
    resolve_info.parent.mkdir(parents=True)
    resolve_info.write_text('package android.content.pm;public class ResolveInfo {public ActivityInfo activityInfo;public static class ActivityInfo {public String packageName;}}')
    subprocess.run(['java', '-m', 'jdk.compiler/com.sun.tools.javac.Main', '-d', tmp,
                    str(test), str(bitmap), str(resolve_info), str(base / 'app/src/main/java/au/sutto/marketonly/UrlRules.java'),
                    str(base / 'app/src/main/java/au/sutto/marketonly/ExternalLinks.java')], check=True)
    subprocess.run(['java', '-cp', tmp, 'au.sutto.marketonly.MainActivity'], check=True)
