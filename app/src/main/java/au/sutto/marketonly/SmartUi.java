package au.sutto.marketonly;

import android.app.*;
import android.content.SharedPreferences;
import android.graphics.Typeface;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.text.InputType;
import android.view.*;
import android.widget.*;
import java.util.*;

/** Native local search and transparent, user-selected asking-price comparisons. */
public final class SmartUi {
    public interface Host {
        void openListing(String url);
        void search(String words);
        void location();
        void close();
    }
    private final Activity activity; private final ListingStore store; private final SharedPreferences prefs; private final Host host;
    private static final int FG=0xFFE4E6EB, MUTED=0xFFB0B3B8, BLUE=0xFF65AEFF;
    public SmartUi(Activity a,ListingStore s,SharedPreferences p,Host h){activity=a;store=s;prefs=p;host=h;}
    private int dp(int v){return Math.round(v*activity.getResources().getDisplayMetrics().density);}
    private LinearLayout column(){LinearLayout l=new LinearLayout(activity);l.setOrientation(LinearLayout.VERTICAL);return l;}
    private TextView text(String s,int size){TextView t=new TextView(activity);t.setText(s);t.setTextSize(size);t.setTextColor(FG);t.setPadding(0,dp(6),0,dp(6));return t;}
    private void note(LinearLayout box,String s){TextView t=text(s,14);t.setTextColor(MUTED);box.addView(t);}
    private void heading(LinearLayout box,String s){TextView t=text(s,22);t.setTypeface(null,Typeface.BOLD);box.addView(t);}
    private Button button(String label,Runnable action){Button b=new Button(activity);b.setText(label);b.setAllCaps(false);b.setTextColor(BLUE);b.setOnClickListener(v->action.run());return b;}
    private EditText input(LinearLayout box,String label,String value,boolean number){box.addView(text(label,15));EditText e=new EditText(activity);e.setTextColor(FG);e.setHintTextColor(MUTED);e.setTextSize(16);e.setSingleLine(true);e.setText(value);if(number)e.setInputType(InputType.TYPE_CLASS_NUMBER|InputType.TYPE_NUMBER_FLAG_DECIMAL);box.addView(e,new LinearLayout.LayoutParams(-1,dp(48)));return e;}
    private CheckBox check(LinearLayout box,String label,boolean on){CheckBox c=new CheckBox(activity);c.setText(label);c.setTextColor(FG);c.setChecked(on);box.addView(c);return c;}
    private double number(EditText e){try{double v=Double.parseDouble(e.getText().toString().replace(",",""));return Double.isFinite(v)&&v>=0?v:-1;}catch(Exception ignored){return -1;}}
    private LinearLayout card(){LinearLayout box=column();box.setPadding(dp(12),dp(8),dp(12),dp(8));GradientDrawable bg=new GradientDrawable();bg.setColor(0xFF303234);bg.setCornerRadius(dp(12));box.setBackground(bg);LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.setMargins(0,dp(6),0,dp(6));box.setLayoutParams(p);return box;}
    private String age(SmartSearch.Listing l){long days=Math.max(0,(System.currentTimeMillis()-l.seen)/86400000);return days==0?"Seen today":"Seen "+days+" days ago";}
    public View searchPanel(){
        ScrollView scroll=new ScrollView(activity);scroll.setBackgroundColor(0xFF242526);scroll.setFillViewport(true);
        LinearLayout box=column();box.setPadding(dp(16),dp(10),dp(16),dp(24));scroll.addView(box);
        heading(box,"Smart Search");
        note(box,"Search the listings loaded while you browse. Stored on this phone for up to 30 days; no background scanning.");
        EditText query=input(box,"What are you looking for?",prefs.getString("smart_query",""),false);query.setHint("Holden Cruze under $5000");
        EditText budget=input(box,"Maximum price (A$, optional)",prefs.getString("smart_budget",""),true);
        EditText exclude=input(box,"Exclude words (separate with commas)",prefs.getString("smart_exclude",""),false);exclude.setHint("wrecking, swap, wanted");
        CheckBox unseen=check(box,"Only listings I haven’t opened",prefs.getBoolean("smart_unseen",false));
        CheckBox projects=check(box,"Repair words mentioned",prefs.getBoolean("smart_projects",false));
        CheckBox writeoffs=check(box,"Hide listings mentioning write-offs",prefs.getBoolean("smart_writeoffs",true));
        note(box,"These checks use available listing text. Missing details are not proof of condition or write-off history.");
        Spinner order=new Spinner(activity);String[] orders={"Unseen first","Lowest price","Recently seen"};
        ArrayAdapter<String> adapter=new ArrayAdapter<String>(activity,android.R.layout.simple_spinner_item,orders){
            @Override public View getView(int p,View v,ViewGroup parent){TextView t=(TextView)super.getView(p,v,parent);t.setTextColor(FG);return t;}
        };adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);order.setAdapter(adapter);order.setSelection(Math.max(0,Arrays.asList(orders).indexOf(prefs.getString("smart_order",orders[0]))));box.addView(order,new LinearLayout.LayoutParams(-1,dp(48)));
        TextView status=text("",14);box.addView(status);
        LinearLayout results=column();
        final Runnable[] render=new Runnable[1];
        java.util.function.Supplier<SmartSearch.Query> read=()->{
            SmartSearch.Query q=SmartSearch.Query.parse(query.getText().toString());
            if(query.getText().toString().trim().isEmpty())q.words="";
            double limit=number(budget);if(limit>=0)q.maxPrice=limit;
            q.excluded=exclude.getText().toString();q.unseen=unseen.isChecked();q.projects|=projects.isChecked();q.excludeWriteoffs|=writeoffs.isChecked();
            prefs.edit().putString("smart_query",query.getText().toString()).putString("smart_budget",budget.getText().toString()).putString("smart_exclude",q.excluded).putBoolean("smart_unseen",q.unseen).putBoolean("smart_projects",projects.isChecked()).putBoolean("smart_writeoffs",writeoffs.isChecked()).putString("smart_order",order.getSelectedItem().toString()).apply();
            return q;
        };
        render[0]=()->{
            int y=scroll.getScrollY();SmartSearch.Query q=read.get();
            List<SmartSearch.Listing> found=SmartSearch.filter(store.all(),q,order.getSelectedItem().toString(),System.currentTimeMillis());
            String limits=q.maxPrice>=0?" · up to "+SmartSearch.money(q.maxPrice):"";
            status.setText(found.size()+" matches in "+store.all().size()+" loaded listings"+limits+(q.radiusKm>0?"\nSet "+q.radiusKm+" km using the location button below. Distance is not checked locally.":"\nFacebook’s location and radius control the source results. Distance is not checked locally."));
            results.removeAllViews();
            if(found.isEmpty())note(results,"No matching listings loaded yet. Tap Find more on Marketplace, browse the results, then use Back to return here.");
            int shown=0;for(SmartSearch.Listing l:found){if(shown++>=100)break;
                LinearLayout c=card();c.addView(text(SmartSearch.money(l.price)+" · "+l.title,17));
                note(c,(l.place.isEmpty()?"Location unavailable":l.place)+" · "+age(l)+(l.viewed?" · Opened":" · Unopened"));
                if(l.previousPrice>l.price&&l.price>=0)note(c,"Previously observed at "+SmartSearch.money(l.previousPrice));
                c.addView(button("Open listing",()->host.openListing(l.url)));
                c.addView(button("Hide from Smart Search",()->{store.dismiss(l);render[0].run();}));results.addView(c);
            }
            if(found.size()>100)note(results,"Showing the first 100 matches. Narrow the search to see the rest.");
            scroll.post(()->scroll.scrollTo(0,y));
        };
        box.addView(button("Filter loaded listings",render[0]));
        box.addView(button("Find more on Marketplace",()->{
            SmartSearch.Query q=read.get();
            if(q.radiusKm>0)Toast.makeText(activity,"Use the location pin to set "+q.radiusKm+" km on Facebook.",Toast.LENGTH_LONG).show();
            host.search(q.words.isEmpty()?"cars":q.words);
        }));
        box.addView(button("Change Facebook location / radius",host::location));
        box.addView(results);
        box.addView(button("Restore hidden listings",()->{store.restoreDismissed();render[0].run();}));
        box.addView(button("Clear local listing history",()->new AlertDialog.Builder(activity).setTitle("Clear local listing history?").setMessage("Removes Smart Search history, opened markers and price observations from this phone. Facebook saves are unchanged.").setNegativeButton("Cancel",null).setPositiveButton("Clear",(d,w)->{store.clear();render[0].run();}).show()));
        box.addView(button("Back to browsing",host::close));
        scroll.setTag(render[0]);render[0].run();return scroll;
    }
    public void checkPrice(String url){
        SmartSearch.Listing item=store.find(url);String title=item==null?"":item.title;
        ScrollView scroll=new ScrollView(activity);LinearLayout box=column();box.setPadding(dp(18),dp(8),dp(18),dp(20));scroll.addView(box);
        note(box,"Compare advertised asking prices from listings loaded on this phone. These are not sold prices or a vehicle valuation.");
        EditText query=input(box,"Comparable model / item",title,false);query.setHint("2014 Holden Cruze");
        EditText asking=input(box,"This listing’s asking price (A$)",item!=null&&item.price>=0?String.format(Locale.US,"%.0f",item.price):"",true);
        note(box,"Choose similar condition, kilometres and specification. With a year in your search, candidates must be within two years. Open examples to check their details.");
        LinearLayout options=column();TextView summary=text("Choose at least 3 comparable listings.",16);
        List<SmartSearch.Listing> selected=new ArrayList<>();final Runnable[] update=new Runnable[1];
        update[0]=()->{
            List<Double> prices=new ArrayList<>();for(SmartSearch.Listing l:selected)prices.add(l.price);double median=SmartSearch.median(prices);
            if(!Double.isFinite(median)){summary.setText(selected.size()+" selected. Choose at least 3 to show an asking-price comparison.");return;}
            double ask=number(asking);String diff="";if(ask>=0){double pct=(ask-median)/median*100;diff=String.format(Locale.US,"\nThis asking price is %.0f%% %s the sample median.",Math.abs(pct),pct>=0?"above":"below");}
            summary.setText(selected.size()+" selected asking prices\nRange: "+SmartSearch.money(Collections.min(prices))+" – "+SmartSearch.money(Collections.max(prices))+"\nMedian: "+SmartSearch.money(median)+diff+"\nSmall local sample; advertised prices, not confirmed sales.");
        };
        Runnable find=()->{
            selected.clear();options.removeAllViews();update[0].run();String words=query.getText().toString().trim();
            if(SmartSearch.tokens(words.replaceAll("\\b(?:19|20)\\d{2}\\b","")).isEmpty()){note(options,"Enter a model or item name to find relevant examples.");return;}
            List<SmartSearch.Listing> candidates=SmartSearch.comparables(store.all(),words,url,System.currentTimeMillis());
            if(candidates.isEmpty())note(options,"No comparable examples loaded yet. Find similar listings below, browse them, then return to this listing and tap Check Price again.");
            int shown=0;for(SmartSearch.Listing l:candidates){if(shown++>=40)break;
                CheckBox c=check(options,SmartSearch.money(l.price)+" · "+l.title+"\n"+(l.place.isEmpty()?"Location unavailable":l.place)+" · "+age(l),false);
                c.setOnCheckedChangeListener((b,on)->{if(on)selected.add(l);else selected.remove(l);update[0].run();});
                options.addView(button("View example",()->{priceDialog.dismiss();host.openListing(l.url);}));
            }
        };
        box.addView(button("Find loaded comparisons",find));box.addView(options);box.addView(summary);
        box.addView(button("Recalculate comparison",update[0]));
        box.addView(button("Find similar listings on Marketplace",()->{String words=query.getText().toString().trim();if(words.isEmpty()){query.setError("Enter a model or item name");return;}priceDialog.dismiss();host.search(words);}));
        heading(box,"Flip calculator");
        note(box,"Enter your own expected resale and costs. This estimates the margin before tax; it is not a profit guarantee. Include labour if you want to allow for your time.");
        EditText resale=input(box,"Expected resale (A$)","",true), repairs=input(box,"Parts / repairs (A$)","",true), other=input(box,"Other costs (transport, fees, labour, etc.)", "",true);
        TextView profit=text("",16);box.addView(profit);
        box.addView(button("Calculate estimated margin",()->{
            double a=number(asking),s=number(resale),r=number(repairs),o=number(other);
            if(a<0||s<0||r<0||o<0){profit.setText("Fill in all four amounts. Enter 0 where there is no cost.");return;}
            double margin=s-a-r-o;profit.setText((margin<0?"Estimated loss: ":"Estimated margin before tax: ")+SmartSearch.money(Math.abs(margin)));
        }));
        priceDialog=new AlertDialog.Builder(activity).setTitle("Check Price").setView(scroll).setPositiveButton("Close",null).create();priceDialog.show();find.run();
    }
    private AlertDialog priceDialog;
    public void dismiss(){if(priceDialog!=null)priceDialog.dismiss();}
}
