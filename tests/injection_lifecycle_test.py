"""Execute real native document visibility/injection bodies with renderer fakes.
Also execute their generated JS bundle to verify installer failure isolation.
"""
from pathlib import Path
import subprocess,tempfile
base=Path(__file__).resolve().parents[1]
source=(base/'app/src/main/java/au/sutto/marketonly/MainActivity.java').read_text()
def body(signature):
 start=source.index('{',source.index(signature));depth=1;end=start+1
 while depth:
  depth+=(source[end]=='{')-(source[end]=='}');end+=1
 return source[start+1:end-1]
h=r'''package au.sutto.marketonly;
import java.util.*;import java.util.function.Consumer;import java.nio.file.*;
public class InjectionLifecycleTest {
 static class View {static final int VISIBLE=0,INVISIBLE=4;int visibility=INVISIBLE;void setVisibility(int v){visibility=v;}}
 static class WebView extends View {String url=UrlRules.MARKET;int scrolls;String script;List<Consumer<String>> pending=new ArrayList<>();
  String getUrl(){return url;}void stopLoading(){}void scrollTo(int x,int y){scrolls++;}
  void evaluateJavascript(String js,Consumer<String> cb){script=js;if(cb!=null)pending.add(cb);}Consumer<String> callback(){return pending.remove(0);}}
 static class Prefs {boolean compact=true;boolean getBoolean(String k,boolean fallback){return "focused_layout".equals(k)?compact:fallback;}}
 static class JSONObject {static String quote(String s){return "\""+s+"\"";}}
 static class CookieManager {static CookieManager getInstance(){return new CookieManager();}void flush(){}}
 WebView web=new WebView(),refreshView;View progress=new View();Prefs prefs=new Prefs();Object smartScreen,fileCallback;
 boolean signingOut,documentCommitted=true,scriptsInjected,injectionPending,appResumed=true,refreshLoadIssued,refreshStarted,refreshingExplore,refreshRequestPending,pageFailed;
 long documentGeneration;int injectionAttempts;String refreshTarget,fileSourceUrl,lastGoodUrl;
 String guardScript=feature("focus"),adScript=feature("adverts"),mediaScript=feature("media"),pullScript=feature("pull_refresh"),listingToolsScript=feature("listing_tools"),layoutScript=feature("layout"),detailScript=feature("detail");
 static String feature(String name){return "window.calls.push('"+name+"');";}
 boolean isFinishing(){return false;}boolean isDestroyed(){return false;}boolean signedIn(){return true;}
 boolean blockedFeed(String u){return false;}void returnToMarket(){}void openMessenger(String u){}
 void clearError(){}void cancelFileSelection(){}void resetRefreshOnNavigation(String u){}void updateTabs(String u){}
 private void inject(){SHORT}
 private void inject(boolean reveal){INJECT}
 private String installFeature(String feature,String script){FEATURE}
 void onPageStarted(WebView view,String url){STARTED}
 void onPageCommitVisible(WebView view,String url){COMMIT}
 void onPageFinished(WebView view,String url){FINISH}
 void doUpdateVisitedHistory(WebView view,String url,boolean reload){HISTORY}
 static int checks;static void check(boolean b,String m){checks++;if(!b)throw new AssertionError(m);}
 public static void main(String[] args)throws Exception{
  InjectionLifecycleTest t=new InjectionLifecycleTest();t.onPageStarted(t.web,t.web.url);
  check(t.web.visibility==View.INVISIBLE&&!t.documentCommitted&&t.web.pending.isEmpty(),"new document hidden until committed and installed");
  t.onPageCommitVisible(t.web,t.web.url);check(t.web.visibility==View.INVISIBLE&&t.web.pending.size()==1,"commit waits for consolidated installer before reveal");
  check(t.web.script.contains("focus")&&t.web.script.contains("detail")&&t.web.script.contains("listing_tools"),"all features included in consolidated call");
  Files.write(Paths.get(args[0],"success.js"),t.web.script.getBytes(java.nio.charset.StandardCharsets.UTF_8));
  t.web.callback().accept("true");check(t.scriptsInjected&&t.web.visibility==View.VISIBLE,"successful install reveals styled page");
  t.onPageFinished(t.web,t.web.url);check(t.web.pending.isEmpty()&&t.injectionAttempts==1,"finish does not repeat installed assets");
  t.web.url="https://www.facebook.com/marketplace/search/?query=car";t.doUpdateVisitedHistory(t.web,t.web.url,false);
  check(t.web.visibility==View.VISIBLE&&t.web.pending.isEmpty(),"SPA updates preserve page visibility without reinstalling");
  WebView previous=t.web;t.web=new WebView();t.documentCommitted=false;t.scriptsInjected=false;t.injectionPending=false;
  t.onPageCommitVisible(previous,previous.url);check(t.web.pending.isEmpty(),"stale retained WebView commit is ignored");
  t.onPageStarted(t.web,t.web.url);t.onPageCommitVisible(t.web,t.web.url);Consumer<String> stale=t.web.callback();
  t.web.url="https://www.facebook.com/marketplace/item/2/";t.onPageStarted(t.web,t.web.url);stale.accept("true");
  check(!t.scriptsInjected&&t.web.visibility==View.INVISIBLE,"old injection completion cannot reveal a newer document");
  t.onPageFinished(t.web,"https://www.facebook.com/marketplace/item/1/");check(t.web.pending.isEmpty(),"old page finish cannot inject or reveal newer document");
  t.onPageCommitVisible(t.web,t.web.url);t.web.callback().accept("null");
  check(!t.scriptsInjected&&t.web.visibility==View.VISIBLE,"failed installer is not falsely marked successful and cannot hold page blank");
  t.onPageFinished(t.web,t.web.url);check(t.web.pending.size()==1&&t.injectionAttempts==2,"failed installer receives one bounded retry");
  t.web.callback().accept("false");t.inject(true);check(t.web.pending.isEmpty()&&t.injectionAttempts==2,"runtime failure cannot cause unbounded reinstall loop");
  t=new InjectionLifecycleTest();t.web.url="https://www.facebook.com/login/";t.onPageStarted(t.web,t.web.url);t.onPageCommitVisible(t.web,t.web.url);
  check(t.web.visibility==View.VISIBLE&&t.web.pending.isEmpty(),"Facebook login shows without Marketplace customization");
  t=new InjectionLifecycleTest();t.signingOut=true;t.inject(true);check(t.web.pending.isEmpty()&&t.web.visibility==View.INVISIBLE,"signout rejects renderer install and reveal");
  t=new InjectionLifecycleTest();t.smartScreen=new Object();t.inject();check(t.web.script.startsWith("(function(){window.__marketOnlyActive=false;"),"Smart overlay defers underlying observer work");
  t=new InjectionLifecycleTest();t.guardScript="throw new Error('fixture');";t.inject(true);
  Files.write(Paths.get(args[0],"failed.js"),t.web.script.getBytes(java.nio.charset.StandardCharsets.UTF_8));
  t=new InjectionLifecycleTest();t.prefs.compact=false;t.inject(true);check(!t.web.script.contains("calls.push('layout')")&&!t.web.script.contains("calls.push('detail')"),"compact toggle excludes both layout customizations");
  System.out.println("PASS: "+checks+" actual document injection/visibility checks (renderer fakes)");
 }
}'''
for key,signature in [('SHORT','private void inject()'),('INJECT','private void inject(boolean reveal)'),('FEATURE','private String installFeature('),('STARTED','void onPageStarted('),('COMMIT','void onPageCommitVisible('),('FINISH','void onPageFinished('),('HISTORY','void doUpdateVisitedHistory(')]:
 h=h.replace(key,body(signature))
node=r'''const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const dir=process.argv[1];let events=0;const c={calls:[],Event:function(){},dispatchEvent(){events++}};c.window=c;
const failed=fs.readFileSync(dir+'/failed.js','utf8'),success=fs.readFileSync(dir+'/success.js','utf8');
assert.equal(vm.runInNewContext(failed,c),false);
assert.deepEqual(Array.from(c.__marketOnlyInstallErrors),['focus']);assert(!c.__marketOnlyNativeInjected);
assert.deepEqual(Array.from(c.calls),['adverts','media','pull_refresh','listing_tools','layout','detail']);
c.calls=[];assert.equal(vm.runInNewContext(success,c),true);assert(c.__marketOnlyNativeInjected);
assert.deepEqual(Array.from(c.__marketOnlyInstallErrors),[]);
assert.deepEqual(Array.from(c.calls),['focus','adverts','media','pull_refresh','listing_tools','layout','detail']);
const calls=c.calls.length;assert.equal(vm.runInNewContext(success,c),true);assert.equal(c.calls.length,calls);assert.equal(events,3);
console.log('PASS: actual native generated bundle isolates failing installer, recovers transient errors, installs every feature and skips duplicate work');'''
with tempfile.TemporaryDirectory(prefix='marketonly-injection-') as tmp:
 p=Path(tmp)/'InjectionLifecycleTest.java';p.write_text(h)
 subprocess.run(['java','-m','jdk.compiler/com.sun.tools.javac.Main','-d',tmp,str(p),str(base/'app/src/main/java/au/sutto/marketonly/UrlRules.java')],check=True)
 subprocess.run(['java','-cp',tmp,'au.sutto.marketonly.InjectionLifecycleTest',tmp],check=True)
 subprocess.run(['node','-e',node,tmp],check=True)
