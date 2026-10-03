package au.sutto.marketonly;

import android.content.SharedPreferences;
import java.util.*;
import org.json.*;

/** Bounded, on-device catalogue of listing summaries encountered by the user. */
public final class ListingStore {
    private final SharedPreferences prefs;
    private final LinkedHashMap<String,SmartSearch.Listing> items=new LinkedHashMap<>();
    public ListingStore(SharedPreferences prefs){this.prefs=prefs;try{
        JSONArray a=new JSONArray(prefs.getString("local_listings","[]"));
        for(int i=0;i<a.length();i++){JSONObject o=a.getJSONObject(i);SmartSearch.Listing l=parse(o);if(l==null)continue;
            l.seen=o.optLong("seen");l.viewed=o.optBoolean("viewed");l.dismissed=o.optBoolean("dismissed");l.previousPrice=o.optDouble("previousPrice",-1);items.put(l.url,l);}
    }catch(Exception ignored){}prune();}
    private SmartSearch.Listing parse(JSONObject o){
        String url=ExternalLinks.fromUrl(o.optString("url"));if(!UrlRules.listing(url))return null;
        // Only the listing identity is retained, never tracking parameters.
        url=url.split("\\?")[0].replaceAll("/+$","")+"/";
        SmartSearch.Listing l=new SmartSearch.Listing();l.url=url;l.title=clip(o.optString("title"),250);l.place=clip(o.optString("place"),100);l.notes=clip(o.optString("notes"),1200);
        l.price=o.optDouble("price",-1);if(!Double.isFinite(l.price)||l.price<0||l.price>1e9)l.price=-1;return l;
    }
    private String clip(String s,int max){return s.length()>max?s.substring(0,max):s;}
    public void ingest(String result){boolean dirty=false;try{
        JSONArray a=new JSONArray(result);for(int i=0;i<Math.min(a.length(),100);i++){
            SmartSearch.Listing incoming=parse(a.getJSONObject(i));if(incoming==null||incoming.title.isEmpty())continue;
            SmartSearch.Listing old=items.get(incoming.url);
            if(old!=null){incoming.viewed=old.viewed;incoming.dismissed=old.dismissed;incoming.previousPrice=old.previousPrice;
                if(incoming.price>=0&&old.price>=0&&incoming.price!=old.price)incoming.previousPrice=old.price;
                if(incoming.price<0)incoming.price=old.price;if(incoming.place.isEmpty())incoming.place=old.place;if(incoming.notes.isEmpty())incoming.notes=old.notes;
                if(old.title.equals(incoming.title)&&old.price==incoming.price&&old.place.equals(incoming.place)&&old.notes.equals(incoming.notes)&&System.currentTimeMillis()-old.seen<3600000)continue;}
            incoming.seen=System.currentTimeMillis();items.put(incoming.url,incoming);dirty=true;
        }
    }catch(Exception ignored){}if(dirty){prune();save();}}
    public SmartSearch.Listing find(String url){String canonical=ExternalLinks.fromUrl(url);return canonical==null?null:items.get(canonical.split("\\?")[0].replaceAll("/+$","")+"/");}
    public Collection<SmartSearch.Listing> all(){return new ArrayList<>(items.values());}
    public void viewed(String url){SmartSearch.Listing l=find(url);if(l!=null&&!l.viewed){l.viewed=true;save();}}
    public void dismiss(SmartSearch.Listing l){l.dismissed=true;save();}
    public void restoreDismissed(){for(SmartSearch.Listing l:items.values())l.dismissed=false;save();}
    public void clear(){items.clear();save();}
    private void prune(){long now=System.currentTimeMillis();items.values().removeIf(l->now-l.seen>SmartSearch.MAX_AGE);
        if(items.size()>400){List<SmartSearch.Listing> sorted=new ArrayList<>(items.values());sorted.sort((a,b)->Long.compare(a.seen,b.seen));for(int i=0;i<sorted.size()-400;i++)items.remove(sorted.get(i).url);}}
    private void save(){JSONArray array=new JSONArray();for(SmartSearch.Listing l:items.values())try{
        JSONObject o=new JSONObject();o.put("url",l.url);o.put("title",l.title);o.put("place",l.place);o.put("price",l.price);o.put("notes",l.notes);o.put("seen",l.seen);o.put("viewed",l.viewed);o.put("dismissed",l.dismissed);o.put("previousPrice",l.previousPrice);array.put(o);
    }catch(Exception ignored){}prefs.edit().putString("local_listings",array.toString()).apply();}
}
