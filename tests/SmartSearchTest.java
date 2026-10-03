package au.sutto.marketonly;
import java.util.*;
import java.lang.reflect.Proxy;
import android.content.SharedPreferences;
public final class SmartSearchTest {
 static int checks;static void check(boolean ok,String m){checks++;if(!ok)throw new AssertionError(m);}
 static String row(int id,String title,String price){return "{\"url\":\"https://m.facebook.com/marketplace/item/"+id+"?ref=messenger\",\"title\":\""+title+"\",\"price\":"+price+",\"place\":\"Gold Coast, QLD\"}";}
 public static void main(String[] args){
  SmartSearch.Query q=SmartSearch.Query.parse("Find me Holden Cruze under $5k within 200 km no write-offs");
  check(q.words.equals("Holden Cruze")&&q.maxPrice==5000&&q.radiusKm==200&&q.excludeWriteoffs,"plain language budget/radius/exclusion");
  check(SmartSearch.Query.parse("project cars up to A$4,500").projects,"project intent");
  check(SmartSearch.Query.parse("BMW max 2500").maxPrice==2500,"unprefixed budget");
  Map<String,String> disk=new HashMap<>();
  SharedPreferences.Editor editor=(SharedPreferences.Editor)Proxy.newProxyInstance(SmartSearchTest.class.getClassLoader(),new Class[]{SharedPreferences.Editor.class},(p,m,a)->{if(m.getName().equals("putString")){disk.put((String)a[0],(String)a[1]);return p;}return null;});
  SharedPreferences prefs=(SharedPreferences)Proxy.newProxyInstance(SmartSearchTest.class.getClassLoader(),new Class[]{SharedPreferences.class},(p,m,a)->{if(m.getName().equals("getString"))return disk.getOrDefault((String)a[0],(String)a[1]);if(m.getName().equals("edit"))return editor;return null;});
  ListingStore store=new ListingStore(prefs);
  store.ingest("["+row(1,"2014 Holden Cruze","4500")+","+row(2,"2015 Holden Cruze","6000")+","+row(3,"2013 Holden Cruze","5000")+","+row(4,"2014 Holden Commodore","2000")+","+row(5,"2002 Holden Cruze","1000")+"]");
  check(store.all().size()==5,"ingest catalogue");
  check(store.find("https://www.facebook.com/marketplace/item/1/")!=null,"canonical identity");
  check(!store.find("https://facebook.com/marketplace/item/1").url.contains("?"),"tracking stripped");
  ListingStore reload=new ListingStore(prefs);check(reload.all().size()==5,"history survives reload");
  SmartSearch.Listing first=reload.find("https://facebook.com/marketplace/item/1/");reload.viewed(first.url);
  check(new ListingStore(prefs).find(first.url).viewed,"opened state persists");
  q=SmartSearch.Query.parse("Holden Cruze under $5000");q.unseen=true;
  List<SmartSearch.Listing> matches=SmartSearch.filter(reload.all(),q,"Lowest price",System.currentTimeMillis());
  check(matches.size()==2&&matches.get(0).price==1000,"budget, exact model and unseen filters");
  q.excluded="2002";check(SmartSearch.filter(reload.all(),q,"Lowest price",System.currentTimeMillis()).size()==1,"exclude words");
  reload.dismiss(first);check(new ListingStore(prefs).find(first.url).dismissed,"dismiss persisted");reload.restoreDismissed();check(!first.dismissed,"restore hidden");
  reload.ingest("["+row(1,"2014 Holden Cruze","3900")+"]");
  check(reload.find(first.url).price==3900&&reload.find(first.url).previousPrice==4500&&reload.find(first.url).viewed,"price change retains opened marker");
  check(SmartSearch.comparables(reload.all(),"2014 Holden Cruze",first.url,System.currentTimeMillis()).size()==2,"comparison excludes self, distant year and different model");
  check(Double.isNaN(SmartSearch.median(Arrays.asList(5000.0,7000.0))),"too few comparables no estimate");
  check(SmartSearch.median(Arrays.asList(4000.0,9000.0,5000.0))==5000,"median resists outlier");
  check(SmartSearch.median(Arrays.asList(4000.0,9000.0,5000.0,6000.0))==5500,"even sample median");
  check(SmartSearch.project("needs an engine")&&SmartSearch.project("overheating"),"repair phrases");
  check(SmartSearch.writeoff("repairable write-off")&&!SmartSearch.writeoff("never written off")&&!SmartSearch.writeoff("not a write off"),"explicit negated write-off descriptions");
  first=reload.find(first.url);first.seen=System.currentTimeMillis()-SmartSearch.MAX_AGE-1;
  q=new SmartSearch.Query();check(SmartSearch.filter(reload.all(),q,"Unseen first",System.currentTimeMillis()).size()==4,"stale listings excluded");
  reload.ingest("[{\"url\":\"https://evil.test/marketplace/item/9/\",\"title\":\"fake\",\"price\":1}]");check(reload.all().size()==5,"external URL rejected");
  reload.clear();check(new ListingStore(prefs).all().isEmpty(),"history clear persisted");
  StringBuilder batch=new StringBuilder("[");for(int i=0;i<100;i++){if(i>0)batch.append(',');batch.append(row(i+100,"Car", "1000"));}batch.append(']');
  for(int n=0;n<5;n++)reload.ingest(batch.toString().replace("item/1","item/"+(n+1)));
  check(reload.all().size()<=400,"bounded catalogue");
  System.out.println("PASS: "+checks+" Smart Search, price and persisted-catalogue checks");
 }
}
