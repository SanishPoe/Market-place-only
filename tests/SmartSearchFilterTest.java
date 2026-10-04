package au.sutto.marketonly;

import java.util.*;

/** Exercises the public search contract without Android dependencies. */
public final class SmartSearchFilterTest {
    private static int checks;
    private static void check(boolean value,String message){checks++;if(!value)throw new AssertionError(message);}
    private static SmartSearch.Listing item(String title,String notes,double price,long seen){
        SmartSearch.Listing item=new SmartSearch.Listing();item.title=title;item.notes=notes;item.price=price;item.seen=seen;return item;
    }
    public static void main(String[] args){
        long now=System.currentTimeMillis();
        SmartSearch.Listing a=item("2014 Holden Cruze","Not a write off",4500,now);
        SmartSearch.Listing b=item("2013 Holden Cruze","Needs an engine",3000,now-1000);
        SmartSearch.Listing c=item("Holden Commodore","repairable write-off",2500,now-2000);
        SmartSearch.Listing d=item("2014 Holden Cruze","",-1,now-3000);
        List<SmartSearch.Listing> rows=Arrays.asList(a,b,c,d);
        SmartSearch.Query q=new SmartSearch.Query();q.words="Holden Cruze Cruze";
        check(SmartSearch.filter(rows,q,"Lowest price",now).equals(Arrays.asList(b,a,d)),"duplicate tokens preserve exact model matching and unknown-price sort");
        q.maxPrice=4000;
        check(SmartSearch.filter(rows,q,"Lowest price",now).equals(Arrays.asList(b)),"budget excludes above-budget and unknown prices");
        q.maxPrice=-1;q.excluded="engine, Commodore";
        check(SmartSearch.filter(rows,q,"Lowest price",now).equals(Arrays.asList(a,d)),"comma-separated exclusions search notes and title");
        q.excluded="";q.projects=true;
        check(SmartSearch.filter(rows,q,"Lowest price",now).equals(Arrays.asList(b)),"project phrases preserved");
        q.projects=false;q.words="cars";q.excludeWriteoffs=true;
        check(SmartSearch.filter(rows,q,"Lowest price",now).equals(Arrays.asList(b,a,d)),"generic car query and negated write-off handling preserved");
        q.excludeWriteoffs=false;a.viewed=true;q.unseen=true;
        check(SmartSearch.filter(rows,q,"Unseen first",now).equals(Arrays.asList(b,c,d)),"unseen and recency ordering");
        q.unseen=false;b.dismissed=true;d.seen=now-SmartSearch.MAX_AGE-1;
        check(SmartSearch.filter(rows,q,"Newest seen",now).equals(Arrays.asList(a,c)),"dismissed and expired rows excluded");
        check(rows.get(0)==a&&rows.get(1)==b&&rows.get(2)==c,"filter never reorders stored catalogue");
        check(SmartSearch.tokens("For Sale: Holden-CRUZE vehicles").equals(Arrays.asList("holden","cruze")),"token normalization unchanged");
        System.out.println("PASS: "+checks+" search-filter behavior checks");
    }
}
