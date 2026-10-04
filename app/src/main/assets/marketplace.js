(function () {
  'use strict';
  if (!/(^|\.)facebook\.com$/i.test(location.hostname)) return;
  if (window.__marketOnlyLayout) { window.__marketOnlyLayout(); return; }
  const root=document.documentElement;
  const parse=s=>{try{return new URL(s,location.href);}catch(_){return null;}};
  const itemId=a=>{const u=parse(a.getAttribute('href'));return u&&/(^|\.)facebook\.com$/.test(u.hostname)&&u.pathname.match(/^\/marketplace\/item\/([^/]+)/)?.[1];};
  const auth=()=>/^\/(login|checkpoint|two_step|recover|confirm|auth|security|device|dialog|reg|r\.php|consent)/.test(location.pathname)||!!document.querySelector('input[type="password"],form[action*="login"]');
  const price=s=>/^(?:(?:A|AU|US|NZ)?\$\s*[\d,.]+|Free)(?:\s|$)/i.test(s);
  const clean=s=>(s||'').replace(/\s+/g,' ').trim();
  let scheduled=false, frame=0, lastPath='', tracking=null, paused=false,captionGeneration=0,gridDirty=true,lastGridPath='';
  const dirtyCards=new Set();
  const captionCache=new WeakMap(), captionDirty=new WeakSet();
  const headerOffsetSources=new WeakMap();
  const layoutAttributes=['data-mo-grid','data-mo-cell','data-mo-chain','data-mo-frame','data-mo-card','data-mo-orphan','data-mo-photo','data-mo-image','data-mo-photo-layer','data-mo-ad','data-mo-ad-media','data-mo-ad-image','data-mo-ad-layer','data-mo-ad-row','data-mo-ad-single'];
  const style=document.createElement('style');style.id='marketonly-layout';style.textContent=window.__marketOnlyCss||'';(document.head||root).appendChild(style);
  function mark(el,name,value=''){
    if(!el)return;
    if(tracking){if(!tracking.has(name))tracking.set(name,new Set());tracking.get(name).add(el);}
    if(el.getAttribute(name)!==value)el.setAttribute(name,value);
  }
  function hide(el,type){if(el&&!el.closest('[role="dialog"]'))mark(el,'data-mo-hide',type);}
  function pathMode(){
    const p=location.pathname;
    if(!/^\/(marketplace(?:\/|$)|saved(?:\/|$))/.test(p))return '';
    if(/^\/marketplace\/(?:item|create|profile)(?:\/|$)/.test(p))return 'detail';
    if(/^\/marketplace\/you(?:\/)?$/.test(p)||/^\/marketplace\/you\/(?!saved)/.test(p))return 'detail';
    return 'browse';
  }
  function resetCaptions(){
    document.querySelectorAll('[data-mo-original-caption]').forEach(e=>e.removeAttribute('data-mo-original-caption'));
    document.querySelectorAll('[data-mo-summary]').forEach(e=>e.remove());
  }
  function restore(){root.removeAttribute('data-mo-page');resetCaptions();}
  function globalNavigation(){
    document.querySelectorAll('[role="banner"],#pagelet_bluebar,#mJewelNav,nav[aria-label="Facebook"],[role="navigation"][aria-label="Facebook"]').forEach(e=>{
      if(!e.querySelector('[role="main"],a[href*="/marketplace/item/"]'))hide(e,'global');
    });
    document.querySelectorAll('[role="navigation"],nav,header').forEach(e=>{
      if(e.closest('[role="main"],[role="dialog"]'))return;
      const links=[...e.querySelectorAll('a[href]')].map(a=>parse(a.getAttribute('href')));
      if(links.some(u=>u&&/^\/(?:home\.php|watch\/|reels?\/)?$/.test(u.pathname))&&!e.querySelector('a[href*="/marketplace/item/"]'))hide(e,'global');
    });
  }
  function tidyControls(){
    document.querySelectorAll('[data-mo-hide="toolbar"]').forEach(e=>{
      if(e.querySelector('a[href*="/marketplace/item/"]'))e.removeAttribute('data-mo-hide');
    });
    document.querySelectorAll('[role="complementary"]').forEach(e=>{if(!e.querySelector('a[href*="/marketplace/item/"]'))hide(e,'toolbar');});
    document.querySelectorAll('h1,h2,[role="heading"]').forEach(e=>{
      if(/^(Marketplace|Browse all|Today.?s picks|Your saved items)$/i.test(clean(e.textContent)))hide(e,'toolbar');
    });
    document.querySelectorAll('input[placeholder],input[aria-label]').forEach(input=>{
      if(!/^Search Marketplace$/i.test(input.getAttribute('placeholder')||input.getAttribute('aria-label')||'')||input.closest('[role="dialog"]'))return;
      let box=input;
      for(let n=0;n<5&&box.parentElement;n++){
        const p=box.parentElement;
        if(p===document.body||p.getAttribute('role')==='main'||p.querySelector('a[href*="/marketplace/item/"],[role="dialog"]'))break;
        if(p.getBoundingClientRect().height>210)break;
        box=p;
      }
      hide(box,'toolbar');
    });
    document.querySelectorAll('[role="button"],button,a[href]').forEach(button=>{
      if(button.closest('[role="dialog"],[data-mo-card],[data-mo-ad]')||(button.tagName==='A'&&itemId(button)))return;
      const label=clean(button.getAttribute('aria-label')||button.textContent);
      const u=button.hasAttribute('href')&&parse(button.getAttribute('href'));
      if(/^(Sell|Create new listing|All Categories|Categories|Your Marketplace profile)$/i.test(label)
        ||(u&&/(^|\.)facebook\.com$/.test(u.hostname)&&/^\/marketplace\/(?:you\/?$|create(?:\/|$))/.test(u.pathname)))hide(button,'toolbar');
    });
    // Hiding a button alone leaves fixed-height desktop toolbar shells behind.
    const empty=e=>{
      if(e.matches('[data-mo-hide]')||getComputedStyle(e).display==='none')return true;
      return !clean(e.textContent)&&!e.matches('a,button,input,select,textarea,img,video,iframe,[role="button"]')
        &&!e.querySelector('a,button,input,select,textarea,img,video,iframe,[role="button"]');
    };
    document.querySelectorAll('[data-mo-hide]').forEach(e=>{
      const type=e.getAttribute('data-mo-hide');
      for(let p=e.parentElement,n=0;p&&p!==document.body&&p!==root&&n<8;p=p.parentElement,n++){
        if(p.matches('[role="main"],[role="dialog"]')||p.querySelector('a[href*="/marketplace/item/"],[role="main"],[role="dialog"]'))break;
        if([...p.childNodes].some(c=>c.nodeType===3&&clean(c.textContent))||![...p.children].every(empty))break;
        hide(p,type);
      }
    });
    compactHeader();
  }
  function locationControls(){
    const first=document.querySelector('[data-mo-card]');
    const choices=[...document.querySelectorAll('button,[role="button"],[role="link"],a[href],span,div')].filter(e=>{
      if(e.closest('[role="dialog"],[data-mo-card],[data-mo-ad],[data-mo-cell]'))return false;
      if(e.tagName==='A'&&itemId(e))return false;
      const interactive=e.matches('button,[role="button"],[role="link"],a[href],[tabindex]');
      if(!interactive&&e.children.length)return false;
      if(first&&!(e.compareDocumentPosition(first)&Node.DOCUMENT_POSITION_FOLLOWING))return false;
      const label=clean(e.getAttribute('aria-label')||e.textContent);
      return /^(?:Change |Edit |Choose |Set )?(?:Marketplace )?location$/i.test(label)
        ||(/\b\d[\d,.]*\s*(?:km|miles)\b/i.test(label)&&label.length<100);
    });
    // Prefer the existing interactive wrapper over a second copy of its label.
    return choices.filter(e=>!choices.some(other=>other!==e&&other.contains(e)));
  }
  function compactHeader(){
    const attrs=['data-mo-location','data-mo-location-row','data-mo-top-frame','data-mo-top-offset','data-mo-spacer'];
    const seen=new Map(attrs.map(a=>[a,new Set()]));
    const tag=(e,a)=>{seen.get(a).add(e);mark(e,a);};
    function visibleText(e){
      if(e.nodeType===3)return e.textContent;
      if(e.nodeType!==1||e.matches('[data-mo-hide],script,style,template,svg,[aria-hidden="true"]')||getComputedStyle(e).display==='none')return '';
      return [...e.childNodes].map(visibleText).join(' ');
    }
    function visuallyEmpty(e){
      if(e.nodeType===3)return !clean(e.textContent);
      if(e.nodeType!==1||e.matches('[data-mo-hide],script,style,template'))return true;
      const style=getComputedStyle(e);
      if(style.display==='none'||style.visibility==='hidden')return true;
      if(e.matches('a,button,input,select,textarea,img,video,iframe,canvas,svg,[role="status"],[role="alert"],[role="progressbar"],[role="button"],[role="link"],[aria-busy="true"],[tabindex]'))return false;
      return [...e.childNodes].every(visuallyEmpty);
    }
    for(const control of locationControls()){
      tag(control,'data-mo-location');
      for(let p=control.parentElement,n=0;p&&p!==document.body&&p.getAttribute('role')!=='main'&&n<10;p=p.parentElement,n++){
        if(p.querySelector('[data-mo-card],[data-mo-ad],[role="dialog"]')||clean(visibleText(p))!==clean(visibleText(control)))break;
        tag(p,'data-mo-location-row');
      }
      // Remove only leading padding and truly empty header spacers on the path
      // to the location row. Never flatten result/virtualisation containers or
      // change height/overflow on the page's actual scrolling elements.
      for(let branch=control;branch&&branch!==document.body;branch=branch.parentElement){
        const parent=branch.parentElement;if(!parent||parent===root)break;
        tag(parent,'data-mo-top-frame');
        const source=(parent.getAttribute('class')||'')+'\n'+(parent.getAttribute('style')||'');
        if(parent.hasAttribute('data-mo-top-offset')&&headerOffsetSources.get(parent)!==source)parent.removeAttribute('data-mo-top-offset');
        const style=getComputedStyle(parent),offset=parseFloat(style.top);
        if(style.position==='relative'&&style.transform==='none'
          &&((offset>0&&offset<=96)||parent.hasAttribute('data-mo-top-offset'))){
          tag(parent,'data-mo-top-offset');headerOffsetSources.set(parent,source);
        }
        for(let e=branch.previousElementSibling;e;e=e.previousElementSibling){
          if(e.matches('[data-mo-hide]'))continue;
          if(!visuallyEmpty(e))continue;
          const h=parseFloat(getComputedStyle(e).height);
          if(Number.isFinite(h)&&h<=160)tag(e,'data-mo-spacer');
        }
      }
    }
    for(const attr of attrs)document.querySelectorAll('['+attr+']').forEach(e=>{if(!seen.get(attr).has(e))e.removeAttribute(attr);});
  }
  const contentTopAttrs=['data-mo-content-padding','data-mo-content-margin','data-mo-content-offset','data-mo-content-spacer'];
  function resetContentTop(){for(const attr of contentTopAttrs)document.querySelectorAll('['+attr+']').forEach(e=>e.removeAttribute(attr));}
  function compactPageTop(){
    // Sell/profile/detail pages, and Saved before a location row exists, also
    // reserve space for Facebook's removed header. Only trim leading space:
    // never change form fields, internal card margins or scroll-container sizes.
    const main=document.querySelector('main,[role="main"],#contentArea')||document.body;
    if(scrollY>4||main.scrollTop>4||document.querySelector('[role="dialog"],[aria-modal="true"]'))return;
    resetContentTop();
    function firstContent(e){
      if(e.nodeType===3)return clean(e.textContent)?e.parentElement:null;
      if(e.nodeType!==1||e.matches('script,style,template,[data-mo-hide]'))return null;
      const s=getComputedStyle(e);if(s.display==='none'||s.visibility==='hidden')return null;
      // Interactive controls, loading indicators and meaningful media are content.
      if(e.matches('a,button,input,select,textarea,img,video,iframe,canvas,svg,[role="button"],[role="link"],[role="status"],[role="alert"],[role="progressbar"],[aria-busy="true"]'))return e;
      for(const c of e.childNodes){const found=firstContent(c);if(found)return found;}
      return null;
    }
    let branch=firstContent(main);if(!branch)return;
    // Start at the content's parent, keeping its own heading/form/media styling.
    for(;branch&&branch!==document.body;branch=branch.parentElement){
      const parent=branch.parentElement;if(!parent||parent===root)break;
      const s=getComputedStyle(parent),padding=parseFloat(s.paddingTop),margin=parseFloat(s.marginTop),top=parseFloat(s.top);
      if(padding>=24&&padding<=160)mark(parent,'data-mo-content-padding');
      if(margin>=24&&margin<=160)mark(parent,'data-mo-content-margin');
      if(s.position==='relative'&&s.transform==='none'&&top>0&&top<=96)mark(parent,'data-mo-content-offset');
      for(let previous=branch.previousElementSibling;previous;previous=previous.previousElementSibling){
        if(firstContent(previous))break;
        const ps=getComputedStyle(previous),height=previous.getBoundingClientRect().height;
        if(height>0&&height<=160&&ps.position!=='fixed'&&previous.scrollHeight<=previous.clientHeight+1)mark(previous,'data-mo-content-spacer');
      }
    }
  }
  function caption(a,cell=a){
    // Most Facebook mutations are pagination/virtualisation updates elsewhere.
    // Reuse a caption until its own source changes; never cache a recycled card
    // by item ID because React can change its text without replacing the node.
    const cached=captionCache.get(a);
    if(cached&&cached.generation===captionGeneration&&cached.cell===cell&&cached.href===a.getAttribute('href')&&!captionDirty.has(a)
      &&cached.summary?.isConnected&&a.contains(cached.summary))return;
    captionDirty.delete(a);
    const texts=[],walker=document.createTreeWalker(cell,NodeFilter.SHOW_TEXT);
    while(walker.nextNode()){
      const node=walker.currentNode.parentElement,text=clean(walker.currentNode.textContent);
      if(!text||node.closest('[data-mo-photo],[data-mo-summary],[data-mo-ad],button,[role="button"],script,style'))continue;
      texts.push({node,text});
    }
    function crossedOut(node){
      for(let e=node;e&&e!==cell;e=e.parentElement){
        if(e.matches('s,del,strike')||getComputedStyle(e).textDecorationLine.includes('line-through'))return true;
      }
      return false;
    }
    const status=t=>/^(?:Just listed|Sponsored|Pending|Sold|Shipping|Delivery|Pick.?up)$/i.test(t);
    const p=texts.find(x=>price(x.text)&&!crossedOut(x.node));
    const title=p&&texts.slice(texts.indexOf(p)+1).find(x=>!price(x.text)&&!status(x.text));
    const remaining=title?texts.slice(texts.indexOf(title)+1).filter(x=>!price(x.text)&&!status(x.text)):[];
    const place=remaining.find(x=>x.text.length<=100&&/^[^,]+,\s*[^,]+$/.test(x.text))||(remaining.length===1&&remaining[0].text.length<=100?remaining[0]:null);
    if(!p||!title){
      cell.querySelectorAll('[data-mo-summary]').forEach(e=>e.remove());
      cell.querySelectorAll('[data-mo-original-caption]').forEach(e=>e.removeAttribute('data-mo-original-caption'));
      return;
    }
    let summary=a.querySelector('[data-mo-summary]');
    if(!summary){summary=document.createElement('div');summary.setAttribute('data-mo-summary','');a.appendChild(summary);}
    let line=summary.querySelector('[data-mo-summary-title]');
    if(!line){summary.textContent='';line=document.createElement('div');line.setAttribute('data-mo-summary-title','');summary.appendChild(line);}
    const value=p.text+' · '+title.text;if(line.textContent!==value)line.textContent=value;
    let locationLine=summary.querySelector('[data-mo-summary-location]');
    if(place){
      if(!locationLine){locationLine=document.createElement('div');locationLine.setAttribute('data-mo-summary-location','');summary.appendChild(locationLine);}
      if(locationLine.textContent!==place.text)locationLine.textContent=place.text;
    }else if(locationLine)locationLine.remove();
    const metadata=texts.filter(x=>! /^(Just listed|Sponsored|Pending|Sold)$/i.test(x.text));
    metadata.forEach(x=>mark(x.node,'data-mo-original-caption'));
    // Hide only caption branches with no interactive controls; keep the real listing anchor.
    for(const entry of metadata){
      let block=entry.node;
      while(block.parentElement&&block.parentElement!==a&&block.parentElement!==cell){
        const candidate=block.parentElement;
        if(candidate.querySelector('img,button,[role="button"],input,[data-mo-summary]')||/\b(?:Just listed|Sponsored|Pending|Sold)\b/i.test(candidate.textContent))break;
        block=candidate;
      }
      mark(block,'data-mo-original-caption');
    }
    captionCache.set(a,{cell,href:a.getAttribute('href'),summary,generation:captionGeneration});
  }
  function picture(a){
    const img=a.querySelector('img');if(!img)return;
    let box=img;
    while(box.parentElement&&box.parentElement!==a){
      const parent=box.parentElement;
      // An overlaid status badge belongs to the photo frame. Stopping at its
      // text leaves Facebook's outer half-width/ratio wrapper in place, so the
      // image is squeezed again inside our already half-width listing column.
      const text=clean(parent.textContent);
      if(parent.querySelectorAll('img').length!==1
        ||(text&&!/^(Just listed|Pending|Sold)$/i.test(text))
        ||parent.querySelector('button,[role="button"],input,select,textarea'))break;
      box=parent;
    }
    mark(box,'data-mo-photo');mark(img,'data-mo-image');
    for(let p=img.parentElement;p&&p!==box&&p!==a;p=p.parentElement)mark(p,'data-mo-photo-layer');
  }
  function compactAds(){
    const ads=new Set(window.__marketOnlyFindAds?window.__marketOnlyFindAds():[]);
    if(!window.__marketOnlyFindAds)document.querySelectorAll('span,a,div[aria-label]').forEach(label=>{
      if(label.children.length&&label.tagName!=='A'&&!label.hasAttribute('aria-label'))return;
      if(!/^(Ad|Sponsored)$/i.test(clean(label.getAttribute('aria-label')||label.textContent))||label.closest('[role="dialog"],[data-mo-card]'))return;
      let ad=null;
      for(let p=label,n=0;p&&p!==document.body&&p!==root&&n<10;p=p.parentElement,n++){
        if(p.matches('[role="main"],[role="dialog"]')||p.querySelector('a[href*="/marketplace/item/"],input,form'))break;
        if(p.querySelector('img,video'))ad=p;
      }
      if(ad)ads.add(ad);
    });
    for(const ad of ads){
      mark(ad,'data-mo-ad');
      const media=[...ad.querySelectorAll('img,video')].sort((a,b)=>{
        const area=e=>{const r=e.getBoundingClientRect();return r.width*r.height;};return area(b)-area(a);
      })[0];
      if(!media)continue;
      let box=media;
      while(box.parentElement&&box.parentElement!==ad){
        const parent=box.parentElement;
        if(clean(parent.textContent)||parent.querySelectorAll('img,video').length!==1||parent.querySelector('button,[role="button"]'))break;
        box=parent;
      }
      mark(box,'data-mo-ad-media');mark(media,'data-mo-ad-image');
      for(let p=media.parentElement;p&&p!==box&&p!==ad;p=p.parentElement)mark(p,'data-mo-ad-layer');
    }
    return ads;
  }
  function makeGrid(){
    tracking=new Map();
    const anchors=[...document.querySelectorAll('a[href*="/marketplace/item/"]')].filter(a=>a.querySelector('img')&&!a.closest('[role="dialog"]')&&itemId(a));
    const ids=new Map();
    function addTile(node,id){
      // Trace to the real content boundary, not an arbitrary wrapper count.
      // Facebook can nest a card deeper than 14 levels. Cutting off there
      // misses its existing column and applies orphan half-width inside it:
      // a 178px card becomes (178 - 4) / 2 = 87px on a 360px screen.
      for(let p=node;p&&p!==document.body&&p!==root;p=p.parentElement){
        if(!ids.has(p))ids.set(p,new Set());ids.get(p).add(id);
        if(p.matches('main,[role="main"]'))break;
      }
    }
    for(const a of anchors)addTile(a,itemId(a));
    // Style every real listing, including singleton batches after advertisements.
    for(const a of anchors){mark(a,'data-mo-card');picture(a);}
    const ads=compactAds();
    // Count an advertisement as a separate tile. Otherwise a wrapper containing
    // one ad + one listing looks like a single listing and gets squeezed into
    // half a row, stacking both on the left and hiding the ad's caption.
    for(const ad of ads)addTile(ad,ad);
    const groups=[];
    for(const [parent,set]of ids){
      if(set.size<2||parent.tagName==='A')continue;
      const branches=[...parent.children].filter(c=>ids.has(c)&&ids.get(c).size===1);
      // Nested result rows span both columns; direct listings and ads use one.
      if(!branches.length)continue;
      groups.push({parent,branches});
    }
    const covered=new Set(), adAncestors=new Map();
    for(const ad of ads)for(let p=ad;p&&p!==document.body;p=p.parentElement){if(!adAncestors.has(p))adAncestors.set(p,ad);}
    for(const{parent,branches}of groups){
      mark(parent,'data-mo-grid');
      const parentStyle=getComputedStyle(parent);
      // A virtualised collection's explicit height is its scroll spacer. An ad
      // beside absolute result rows must not turn that spacer into height:auto.
      const virtualChildren=[...parent.children].some(c=>ids.get(c)?.size>1&&/absolute|fixed/.test(getComputedStyle(c).position));
      if(!parent.matches('main,[role="main"]')&&!/auto|scroll/.test(parentStyle.overflowY)
        &&!/absolute|fixed/.test(parentStyle.position)&&!virtualChildren&&adAncestors.has(parent))mark(parent,'data-mo-ad-row');
      for(const cell of branches){
        mark(cell,'data-mo-cell');
        const ad=adAncestors.get(cell);
        if(ad){
          for(let chain=ad.parentElement;chain&&chain!==cell&&chain!==parent;chain=chain.parentElement)mark(chain,'data-mo-chain');
          continue;
        }
        const card=cell.matches('a[href*="/marketplace/item/"]')?cell:[...cell.querySelectorAll('a[href*="/marketplace/item/"]')].find(a=>a.querySelector('img'));
        if(!card)continue;mark(card,'data-mo-card');covered.add(card);
        for(let chain=card.parentElement;chain&&chain!==cell&&chain!==parent;chain=chain.parentElement)mark(chain,'data-mo-chain');
        caption(card,cell);
      }
      for(let frame=parent.parentElement,n=0;frame&&frame!==document.body&&n<7;frame=frame.parentElement,n++){
        mark(frame,'data-mo-frame');if(frame.getAttribute('role')==='main')break;
      }
    }
    if(root.getAttribute('data-mo-ads')==='hidden'){
      // Two consecutive ad rows can each leave one real listing. Pair those
      // rows without moving nodes or removing their measurable layout boxes.
      const singles=new Set(groups.map(g=>g.parent).filter(p=>tracking.get('data-mo-ad-row')?.has(p)
        &&[...(ids.get(p)||[])].filter(id=>typeof id==='string').length===1));
      for(const first of singles){
        const second=first.nextElementSibling,parent=first.parentElement;
        if(!second||!singles.has(second)||!parent||parent===document.body||parent.matches('main,[role="main"]'))continue;
        mark(parent,'data-mo-grid');
        mark(first,'data-mo-cell');mark(first,'data-mo-ad-single');
        mark(second,'data-mo-cell');mark(second,'data-mo-ad-single');
      }
    }
    for(const card of anchors){
      if(covered.has(card))continue;
      let cell=card;
      while(cell.parentElement&&cell.parentElement!==document.body){
        const p=cell.parentElement;
        if(p.matches('main,[role="main"],[role="dialog"]')||ids.get(p)?.size!==1||adAncestors.has(p))break;
        cell=p;
      }
      mark(cell,'data-mo-orphan');
      if(card!==cell)for(let chain=card.parentElement;chain&&chain!==cell;chain=chain.parentElement)mark(chain,'data-mo-chain');
      caption(card,cell);
    }
    // Facebook can recycle a singleton wrapper into a multi-item row. Remove
    // obsolete sizing marks without moving or replacing React-owned elements.
    for(const attr of layoutAttributes)document.querySelectorAll('['+attr+']').forEach(e=>{
      if(!tracking.get(attr)?.has(e))e.removeAttribute(attr);
    });
    tracking=null;
    return groups.length;
  }
  function sweep(){
    cancelAnimationFrame(frame);frame=0;scheduled=false;
    if(document.hidden||window.__marketOnlyActive===false){paused=true;return;}
    paused=false;
    const mode=pathMode();
    if(auth()||!mode){dirtyCards.clear();restore();resetContentTop();return;}
    if(lastPath!==location.pathname){gridDirty=true;root.removeAttribute('data-mo-controls');resetContentTop();lastPath=location.pathname;}
    mark(root,'data-mo-page',mode);
    globalNavigation();
    if(mode==='browse'){
      // Keep a phone-width viewport while requesting Facebook's full feature set.
      let viewport=document.querySelector('meta[name="viewport"]');
      if(!viewport){viewport=document.createElement('meta');viewport.name='viewport';(document.head||root).appendChild(viewport);}
      if(viewport.content!=='width=device-width, initial-scale=1')viewport.content='width=device-width, initial-scale=1';
      if(gridDirty||lastGridPath!==location.pathname){makeGrid();gridDirty=false;lastGridPath=location.pathname;}
      else for(const card of dirtyCards){const cached=captionCache.get(card);if(card.isConnected&&cached?.cell.isConnected)caption(card,cached.cell);}
      dirtyCards.clear();tidyControls();
    }else {dirtyCards.clear();resetCaptions();}
    if(!root.hasAttribute('data-mo-controls'))compactPageTop();
    else resetContentTop();
  }
  const generated=node=>{const e=node?.nodeType===1?node:node?.parentElement;return !!e?.closest('[data-mo-summary],[data-mo-detail-generated-description],style[id^="marketonly"]');};
  const withoutMotion=s=>(s||'').replace(/(?:^|;)\s*(?:transform|top|left)\s*:[^;]*(?=;|$)/gi,'').replace(/\s+/g,'');
  const motionOnly=r=>r.type==='attributes'&&r.attributeName==='style'&&r.target.closest('[data-mo-grid]')
    &&withoutMotion(r.oldValue)===withoutMotion(r.target.getAttribute('style'));
  function changed(records){
    if(document.hidden||window.__marketOnlyActive===false){captionGeneration++;gridDirty=true;paused=true;return;}
    const external=records.filter(r=>!generated(r.target)&&!(r.type==='childList'&&[...r.addedNodes,...r.removedNodes].length&&[...r.addedNodes,...r.removedNodes].every(generated))
      &&!motionOnly(r)&&!((r.type==='characterData'||r.type==='attributes')&&(r.target.nodeType===1?r.target:r.target.parentElement)?.closest('[role="status"],[role="progressbar"]')));
    if(!external.length)return;
    for(const r of external){
      const e=r.target.nodeType===1?r.target:r.target.parentElement;
      const card=e?.closest('a[href*="/marketplace/item/"]');if(card){captionDirty.add(card);dirtyCards.add(card);}
      // Captions may be siblings of the photo anchor inside a cell.
      const cell=e?.closest('[data-mo-cell],[data-mo-orphan]');
      if(cell)cell.querySelectorAll('a[href*="/marketplace/item/"]').forEach(a=>{captionDirty.add(a);dirtyCards.add(a);});
      // CSS/source changes on an ancestor can alter the current-price styling.
      if(e&&r.type==='attributes'&&!card&&!cell)e.querySelectorAll('a[href*="/marketplace/item/"]').forEach(a=>{captionDirty.add(a);dirtyCards.add(a);});
      if(r.type==='childList'||(r.type==='attributes'&&(r.attributeName==='href'||(!card&&!cell))))gridDirty=true;
    }
    schedule();
  }
  function schedule(){
    if(document.hidden||window.__marketOnlyActive===false){paused=true;return;}
    if(!scheduled){scheduled=true;frame=requestAnimationFrame(sweep);}
  }
  function activity(){if(document.hidden||window.__marketOnlyActive===false){cancelAnimationFrame(frame);frame=0;scheduled=false;paused=true;}else if(paused)schedule();}
  window.__marketOnlyLayout=function(full=true){if(full)gridDirty=true;sweep();};
  // User-initiated diagnostics: dimensions and CSS only. No page text, URLs,
  // listing IDs, photos, cookies, input values or account details are included.
  window.__marketOnlyLayoutReport=function(){
    if(auth())return JSON.stringify({page:'sign-in',diagnostics:'unavailable'});
    const round=n=>Math.round(n*10)/10;
    function describe(e){
      if(!e)return null;
      const r=e.getBoundingClientRect(),s=getComputedStyle(e);
      return {tag:e.tagName,children:e.children.length,rect:[r.x,r.y,r.width,r.height].map(round),
        layout:Object.fromEntries(['display','position','top','width','minWidth','maxWidth','gridTemplateColumns','height','minHeight','paddingTop','paddingBottom','marginTop','marginBottom','overflowY','flexBasis','flexGrow'].map(k=>[k,s[k]])),
        markers:[...e.attributes].filter(a=>a.name.startsWith('data-mo-')).map(a=>a.name)};
    }
    function chain(e,limit=7,previousLimit=2){const nodes=[];for(let n=0;e&&n<limit;e=e.parentElement,n++){
      const previous=[];for(let p=e.previousElementSibling;p&&previous.length<previousLimit;p=p.previousElementSibling)previous.push(describe(p));
      nodes.push({node:describe(e),previous});
    }return nodes;}
    function sizePath(img){
      const nodes=[];let lastWidth=-1,skipped=0;
      for(let e=img;e&&e!==root;e=e.parentElement){
        const width=e.getBoundingClientRect().width;
        if(Math.abs(width-lastWidth)>.5||e.matches('[data-mo-card],[data-mo-photo],[data-mo-orphan],[data-mo-cell],[data-mo-grid],main,[role="main"]')){
          nodes.push({node:describe(e),previous:[],skippedAncestors:skipped});lastWidth=width;skipped=0;
        }else skipped++;
      }
      return nodes.slice(0,12);
    }
    const smallListings=pathMode()==='browse'?[...document.querySelectorAll('[data-mo-card] img')].filter(img=>{
      const r=img.getBoundingClientRect();return r.width>0&&r.width<(innerWidth-4)*0.4;
    }).sort((a,b)=>{
      const visible=e=>{const r=e.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight?0:1;};return visible(a)-visible(b);
    }).slice(0,3).map(sizePath):[];
    return JSON.stringify({page:pathMode()||'other',viewport:[innerWidth,innerHeight,devicePixelRatio],scrollY:round(scrollY),
      document:describe(root),body:describe(document.body),location:chain(locationControls()[0]),firstListing:chain(document.querySelector('[data-mo-card]')),
      detailFrame:chain(document.querySelector('[data-mo-detail-fullframe]')),detailSections:[...document.querySelectorAll('[data-mo-detail-order]')].slice(0,16).map(describe),
      hideAds:root.getAttribute('data-mo-ads')==='hidden',adsDetected:document.querySelectorAll('[data-mo-ad-hidden]').length,smallListings},null,2);
  };
  window.__marketOnlyAction=function(action){
    if(auth())return false;
    if(action==='controls'){
      root.toggleAttribute('data-mo-controls');
      if(root.hasAttribute('data-mo-controls'))window.scrollTo({top:0,behavior:'smooth'});
      return true;
    }
    if(action==='location'){
      const target=locationControls()[0];
      if(target){target.click();return true;}
      root.setAttribute('data-mo-controls','');window.scrollTo({top:0,behavior:'smooth'});return false;
    }
    return false;
  };
  addEventListener('popstate',schedule);
  addEventListener('marketonly:navigation',schedule);
  addEventListener('marketonly:activity',activity);document.addEventListener('visibilitychange',activity);
  new MutationObserver(changed).observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeOldValue:true,attributeFilter:['class','style','href','src','aria-label']});
  sweep();
})();
