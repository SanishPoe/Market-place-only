"""Run the actual browser-launch method with package-resolution fakes."""
from pathlib import Path
import subprocess, tempfile
root=Path(__file__).resolve().parents[1]
source=(root/'app/src/main/java/au/sutto/marketonly/MainActivity.java').read_text()
start=source.index('{',source.index('private void openInBrowser('))
end=start+1; depth=1
while depth:
    depth+=(source[end]=='{')-(source[end]=='}');end+=1
method=source[start+1:end-1]
harness=r'''package au.sutto.marketonly;
import java.util.*;
public class BrowserLaunchTest {
 static class Uri { String value; Uri(String s){value=s;} static Uri parse(String s){return new Uri(s);} String getScheme(){int i=value.indexOf(':');return i<0?null:value.substring(0,i);} }
 static class Intent {
  static final String ACTION_MAIN="main",CATEGORY_APP_BROWSER="browser",ACTION_VIEW="view",CATEGORY_BROWSABLE="browsable",EXTRA_INITIAL_INTENTS="initial";
  String action,category,pkg;Uri uri;Intent base;Intent[] initial;
  Intent(String a){action=a;}Intent(String a,Uri u){action=a;uri=u;}
  Intent addCategory(String c){category=c;return this;}Intent setPackage(String p){pkg=p;return this;}
  Object resolveActivity(Manager m){return m.viewers.contains(pkg)?pkg:null;}
  static Intent createChooser(Intent i,String title){Intent c=new Intent("chooser");c.base=i;return c;}
  Intent putExtra(String key,Intent[] i){initial=i;return this;}
 }
 static class ActivityNotFoundException extends RuntimeException {}
 static class Manager {
  ArrayList<android.content.pm.ResolveInfo> browsers=new ArrayList<>();Set<String> viewers=new HashSet<>();int queries;
  java.util.List<android.content.pm.ResolveInfo> queryIntentActivities(Intent i,int flags){if(!Intent.ACTION_MAIN.equals(i.action)||!Intent.CATEGORY_APP_BROWSER.equals(i.category))throw new AssertionError("browser-specific query required");queries++;return browsers;}
  void add(String pkg,boolean view){android.content.pm.ResolveInfo r=new android.content.pm.ResolveInfo();r.activityInfo=new android.content.pm.ActivityInfo();r.activityInfo.packageName=pkg;browsers.add(r);if(view)viewers.add(pkg);}
 }
 Manager manager=new Manager();Intent launched;int toasts;boolean missing;
 Manager getPackageManager(){return manager;}String getPackageName(){return "au.sutto.marketonly.tuned";}
 void startActivity(Intent i){if(missing)throw new ActivityNotFoundException();launched=i;}void toast(String s){toasts++;}
 void openInBrowser(String target){METHOD}
 static int checks;static void check(boolean b,String s){checks++;if(!b)throw new AssertionError(s);}
 static final String URL="https://www.facebook.com/marketplace/item/42/?ref=saved#photos";
 public static void main(String[] args){
  BrowserLaunchTest t=new BrowserLaunchTest();t.manager.add(t.getPackageName(),true);t.manager.add("chrome",true);t.manager.add("chrome",true);t.openInBrowser(URL);
  check(t.launched!=null&&"chrome".equals(t.launched.pkg),"explicit browser excludes self and duplicates");
  check(URL.equals(t.launched.uri.value)&&Intent.CATEGORY_BROWSABLE.equals(t.launched.category),"exact listing URL kept");
  t=new BrowserLaunchTest();t.manager.add("samsung",true);t.manager.add("firefox",true);t.manager.add("unavailable",false);t.manager.browsers.add(new android.content.pm.ResolveInfo());t.openInBrowser(URL);
  check("chooser".equals(t.launched.action)&&"samsung".equals(t.launched.base.pkg),"multiple browsers offered");
  check(t.launched.initial.length==1&&"firefox".equals(t.launched.initial[0].pkg),"unresolvable activities omitted");
  t=new BrowserLaunchTest();t.manager.add(t.getPackageName(),true);t.openInBrowser(URL);check(t.launched==null&&t.toasts==1,"no browser gives feedback instead of looping into app");
  t=new BrowserLaunchTest();t.manager.add("chrome",true);t.missing=true;t.openInBrowser(URL);check(t.launched==null&&t.toasts==1,"browser removal handled");
  for(String url:new String[]{null,"http://facebook.com/marketplace/","javascript:alert(1)","file:///private"}){t=new BrowserLaunchTest();t.openInBrowser(url);check(t.launched==null&&t.manager.queries==0,"unsafe scheme rejected");}
  System.out.println("PASS: "+checks+" actual browser-launch decisions; Android package visibility and browser resolution require device verification");
 }
}
'''.replace('METHOD',method)
with tempfile.TemporaryDirectory(prefix='marketonly-browser-launch-') as tmp:
    tmp=Path(tmp);p=tmp/'BrowserLaunchTest.java';p.write_text(harness)
    package=tmp/'android/content/pm';package.mkdir(parents=True)
    (package/'ResolveInfo.java').write_text('package android.content.pm;public class ResolveInfo {public ActivityInfo activityInfo;}')
    (package/'ActivityInfo.java').write_text('package android.content.pm;public class ActivityInfo {public String packageName;}')
    subprocess.run(['java','-m','jdk.compiler/com.sun.tools.javac.Main','-d',str(tmp),str(p),str(package/'ResolveInfo.java'),str(package/'ActivityInfo.java')],check=True)
    subprocess.run(['java','-cp',str(tmp),'au.sutto.marketonly.BrowserLaunchTest'],check=True)
