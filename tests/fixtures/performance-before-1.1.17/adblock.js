(function(){
  'use strict';
  if(!/(^|\.)facebook\.com$/i.test(location.hostname))return;
  if(window.__marketOnlyAdSweep){window.__marketOnlyAdSweep();return;}
  const root=document.documentElement;
  const clean=s=>(s||'').replace(/[\u200b-\u200f\uFEFF]/g,'').replace(/\s+/g,' ').trim();
  const listing='a[href*="/marketplace/item/"]';
  const media='img,video,picture,iframe,[role="img"]';
  const parse=s=>{try{return new URL(s,location.href)}catch(_){return null}};
  const adLink=a=>{
    const u=parse(a.getAttribute('href'));if(!u||!/^https?:$/.test(u.protocol))return false;
    if(!/(^|\.)facebook\.com$/i.test(u.hostname))return true;
    return /^(?:l|lm)\.facebook\.com$/i.test(u.hostname)||/^\/(?:ads|ad_center|business\/ads)(?:\/|$)/.test(u.pathname);
  };
  const detail=()=>/^\/marketplace\/item\/[^/]+\/?$/.test(location.pathname);
  function detailAds(){
    const roots=new Set();
    // Listing pages use a labelled Ads carousel rather than browse-grid cards.
    // Stop before any seller content; only collapse the ad-only section.
    const protect=p=>p.matches('main,[role="main"],form')||p.querySelector('h1,form,input,textarea,select,'+listing)
      ||[...p.querySelectorAll('h2,h3,[role="heading"],span,div')].some(e=>/^(?:Seller['’]s description|Description|About this vehicle|Details|Seller information|Send seller a message)$/i.test(clean(e.textContent)));
    document.querySelectorAll('h2,h3,[role="heading"],div,span,[aria-label]').forEach(label=>{
      if(label.closest('form,[data-mo-detail-part="description"],[data-mo-detail-part="vehicle"],[data-mo-detail-part="message"]'))return;
      const raw=clean(label.getAttribute('aria-label')||label.textContent);
      // A literal word in a description is not a disclosure. Singular ad labels
      // on detail pages must be an accessible/semantic label or a heading.
      if(!/^Ads$/i.test(raw)&&!(label.matches('[aria-label],h2,h3,[role="heading"]')&&/^(Ad|Advertisement|Sponsored)$/i.test(raw)))return;
      if(/^Ads$/i.test(raw)&&!label.closest('h2,h3,[role="heading"],[aria-label="Ads"]')&&parseInt(getComputedStyle(label).fontWeight,10)<600)return;
      let ad=null;
      for(let p=label;p&&p!==document.body&&p!==root;p=p.parentElement){
        if(protect(p))break;
        if(p.querySelector(media)&&( /^Ads$/i.test(raw)||[...p.querySelectorAll('a[href]')].some(adLink)||p.querySelector('[role="link"]')))ad=p;
      }
      if(ad)roots.add(ad);
    });
    return [...roots].filter(e=>![...roots].some(other=>other!==e&&other.contains(e)));
  }
  function findAds(){
    if(detail())return detailAds();
    const roots=new Set();
    // Facebook uses plain divs, links and split spans for the disclosure.
    // Require an exact disclosure plus advertising media and a destination;
    // never classify a listing by its description or product name.
    document.querySelectorAll('div,span,a,[aria-label],iframe[title]').forEach(label=>{
      if(label.closest('[role="dialog"],form,[data-mo-card],'+listing))return;
      const raw=label.getAttribute('aria-label')||label.getAttribute('title')||label.textContent||'';
      if(raw.length>64||! /^(Ad|Advertisement|Sponsored)$/i.test(clean(raw)))return;
      let ad=null;
      for(let p=label,n=0;p&&p!==document.body&&p!==root&&n<14;p=p.parentElement,n++){
        if(p.matches('[role="main"],[role="dialog"],main')||p.querySelector(listing+',form,input,select,textarea,[role="status"],[role="progressbar"]'))break;
        const hasMedia=p.matches(media)||!!p.querySelector(media);
        const hasDestination=(p.matches('a[href]')&&adLink(p))||[...p.querySelectorAll('a[href]')].some(adLink)
          ||p.matches('[role="link"]')||!!p.querySelector('[role="link"]');
        if(hasMedia&&hasDestination)ad=p;
      }
      if(ad)roots.add(ad);
    });
    // Return outermost safe ad-only wrappers, so their padding and reserved
    // height disappear too. All original nodes remain available for restoration.
    return [...roots].filter(e=>![...roots].some(other=>other!==e&&other.contains(e)));
  }
  function allowed(){
    const p=location.pathname;
    if(!/^\/(marketplace(?:\/|$)|saved(?:\/|$))/.test(p))return false;
    if(/^\/marketplace\/(?:create|profile)(?:\/|$)/.test(p))return false;
    if(/^\/marketplace\/you(?:\/)?$/.test(p)||/^\/marketplace\/you\/(?!saved)/.test(p))return false;
    return !document.querySelector('input[type="password"],form[action*="login"]');
  }
  const style=document.createElement('style');style.id='marketonly-ad-hiding';
  style.textContent='html[data-mo-ads="hidden"] [data-mo-ad-hidden]{display:none!important}';
  (document.head||root).appendChild(style);
  let scheduled=false;
  function sweep(){
    scheduled=false;
    const active=window.__marketOnlyHideAds!==false&&allowed();
    if(active){if(root.getAttribute('data-mo-ads')!=='hidden')root.setAttribute('data-mo-ads','hidden');}
    else root.removeAttribute('data-mo-ads');
    const ads=new Set(allowed()?findAds():[]);
    document.querySelectorAll('[data-mo-ad-hidden]').forEach(e=>{if(!ads.has(e))e.removeAttribute('data-mo-ad-hidden');});
    for(const ad of ads)if(!ad.hasAttribute('data-mo-ad-hidden'))ad.setAttribute('data-mo-ad-hidden','');
    if(typeof window.__marketOnlyLayout==='function')window.__marketOnlyLayout();
  }
  function schedule(){if(!scheduled){scheduled=true;setTimeout(sweep,120);}}
  window.__marketOnlyFindAds=findAds;
  window.__marketOnlyAdSweep=sweep;
  addEventListener('popstate',schedule);
  new MutationObserver(schedule).observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','style','href','src','aria-label','title']});
  sweep();
})();
