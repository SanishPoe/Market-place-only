package au.sutto.marketonly;

import java.util.*;
import java.util.regex.*;

/** Local, deterministic search and asking-price maths. No remote AI or valuation claim. */
public final class SmartSearch {
    private SmartSearch() {}
    public static final long MAX_AGE = 30L * 24 * 60 * 60 * 1000;
    private static final Set<String> STOP_WORDS = new HashSet<>(Arrays.asList("a","an","the","for","sale","car","cars","vehicle","vehicles"));
    private static final Pattern PROJECT = Pattern.compile("(?i)\\b(not running|non[ -]?runner|won.t start|doesn.t (?:run|start)|blown|overheat(?:ing|s|ed)?|head gasket|mechanical (?:issue|problem)s?|needs? (?:an? )?(?:engine|repair|work)|engine (?:issue|problem)s?|project)\\b");
    private static final Pattern NOT_WRITEOFF = Pattern.compile("\\b(?:not (?:a |an? )?|never |no )(?:(?:repairable|statutory) )?(?:write[ -]?off|written off)\\b");
    private static final Pattern WRITEOFF = Pattern.compile("(?i)\\b(write[ -]?offs?|written off|wovr|wovi)\\b");
    public static class Listing {
        public String url="", title="", place="", notes="";
        public double price=-1, previousPrice=-1;
        public long seen;
        public boolean viewed, dismissed;
    }
    public static class Query {
        public String words="", excluded="";
        public double maxPrice=-1;
        public int radiusKm;
        public boolean unseen, projects, excludeWriteoffs;
        public static Query parse(String input) {
            Query q=new Query(); String s=input==null?"":input.trim();
            Matcher budget=Pattern.compile("(?i)\\b(?:under|below|up to|max(?:imum)?(?: price)?)\\s*(?:A(?:U)?\\s*)?\\$?\\s*([0-9][0-9,]*(?:\\.[0-9]+)?)\\s*(k)?\\b").matcher(s);
            if(budget.find()) { q.maxPrice=Double.parseDouble(budget.group(1).replace(",",""))*(budget.group(2)==null?1:1000);s=budget.replaceFirst(""); }
            Matcher radius=Pattern.compile("(?i)\\bwithin\\s+([0-9]{1,4})\\s*(?:km|kilometres?|kilometers?)\\b").matcher(s);
            if(radius.find()){q.radiusKm=Integer.parseInt(radius.group(1));s=radius.replaceFirst("");}
            if(s.matches("(?is).*\\b(?:project cars?|repair projects?)\\b.*")){q.projects=true;s=s.replaceAll("(?i)\\b(?:project cars?|repair projects?)\\b","cars");}
            if(s.matches("(?is).*\\b(?:no|exclude)\\s+write[ -]?offs?\\b.*")){q.excludeWriteoffs=true;s=s.replaceAll("(?i)\\b(?:no|exclude)\\s+write[ -]?offs?\\b","");}
            q.words=s.replaceAll("(?i)\\b(?:find me|show me|looking for|cheap)\\b","").replaceAll("\\s+"," ").trim();
            if(q.words.isEmpty())q.words="cars";
            return q;
        }
    }
    public static List<String> tokens(String s) {
        List<String> result=new ArrayList<>();
        for(String w:(s==null?"":s).toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+"," ").split(" +"))
            if(!w.isEmpty()&&!STOP_WORDS.contains(w))result.add(w);
        return result;
    }
    public static boolean project(String text) {
        return PROJECT.matcher(text).find();
    }
    public static boolean writeoff(String text) {
        String value=NOT_WRITEOFF.matcher(text.toLowerCase(Locale.ROOT)).replaceAll("");
        return WRITEOFF.matcher(value).find();
    }
    public static List<Listing> filter(Collection<Listing> listings, Query q, String order,long now) {
        List<Listing> result=new ArrayList<>();
        // Query work is shared by the whole catalogue rather than repeated per row.
        Set<String> required = new HashSet<>(tokens(q.words));
        String[] excluded = q.excluded.toLowerCase(Locale.ROOT).split(",");
        for(Listing l:listings){
            String text=(l.title+" "+l.notes).toLowerCase(Locale.ROOT);
            if(l.dismissed||now-l.seen>MAX_AGE||q.unseen&&l.viewed||q.maxPrice>=0&&(l.price<0||l.price>q.maxPrice))continue;
            boolean match=required.isEmpty()||new HashSet<>(tokens(text)).containsAll(required);
            for(String term:excluded)if(!term.trim().isEmpty()&&text.contains(term.trim()))match=false;
            if(!match||q.projects&&!project(text)||q.excludeWriteoffs&&writeoff(text))continue;
            result.add(l);
        }
        result.sort((a,b)->{
            if("Lowest price".equals(order))return Double.compare(a.price<0?Double.MAX_VALUE:a.price,b.price<0?Double.MAX_VALUE:b.price);
            if("Unseen first".equals(order)&&a.viewed!=b.viewed)return a.viewed?1:-1;
            return Long.compare(b.seen,a.seen);
        });
        return result;
    }
    public static List<Listing> comparables(Collection<Listing> listings,String query,String excludeUrl,long now){
        Query q=new Query();q.words=query.replaceAll("\\b(?:19|20)\\d{2}\\b","");
        List<Listing> out=filter(listings,q,"Lowest price",now);int year=year(query);
        out.removeIf(l->l.url.equals(excludeUrl)||l.price<=0||(year>0&&(year(l.title)==0||Math.abs(year(l.title)-year)>2)));
        return out;
    }
    private static int year(String text){Matcher m=Pattern.compile("\\b((?:19|20)\\d{2})\\b").matcher(text);return m.find()?Integer.parseInt(m.group(1)):0;}
    public static double median(List<Double> prices){
        if(prices.size()<3)return Double.NaN;
        List<Double> sorted=new ArrayList<>(prices);Collections.sort(sorted);int n=sorted.size();
        return n%2==1?sorted.get(n/2):(sorted.get(n/2-1)+sorted.get(n/2))/2;
    }
    public static String money(double value){return value<0||!Double.isFinite(value)?"Price unavailable":String.format(Locale.US,"A$%,.0f",value);}
}
