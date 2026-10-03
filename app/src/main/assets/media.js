(function(){
  'use strict';
  if(!/(^|\.)facebook\.com$/i.test(location.hostname))return;
  if(window.__marketOnlyMediaSweep){window.__marketOnlyMediaSweep();return;}
  const root=document.documentElement;
  const clean=s=>(s||'').replace(/\s+/g,' ').trim();
  const auth=()=>!!document.querySelector('input[type="password"],form[action*="login"]');
  const active=()=>/^\/(marketplace|saved)(?:\/|$)/.test(location.pathname)&&!auth();
  const detail=()=>/^\/marketplace\/item\/[^/]+\/?$/.test(location.pathname)&&!auth();
  const parse=s=>{try{return new URL(s,location.href)}catch(_){return null}};
  function imageUrl(img){
    const u=parse(img.currentSrc||img.src);
    return u&&u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')
      &&/(^|\.)(fbcdn\.net|fbsbx\.com|facebook\.com)$/i.test(u.hostname)?u.href:null;
  }
  function largePhoto(img){
    if(!detail()||!img||img.tagName!=='IMG'||img.closest('form,[data-mo-float-chat],[data-mo-detail-map]'))return false;
    const link=img.closest('a[href]'),u=link&&parse(link.getAttribute('href'));
    if(u&&/\/marketplace\/item\//.test(u.pathname)&&u.pathname.replace(/\/$/,'')!==location.pathname.replace(/\/$/,''))return false;
    if(/profile (?:picture|photo)|avatar|\bmap\b/i.test(img.alt||''))return false;
    const r=img.getBoundingClientRect(),s=getComputedStyle(img);
    return r.width>=32&&r.height>=32&&r.width*r.height>=16000&&Math.max(r.width,r.height)>=160
      &&s.visibility!=='hidden'&&s.display!=='none'&&!s.filter.includes('blur')&&!!imageUrl(img);
  }
  let chosenPhoto=null, chosenThumb=null, pending=null, touch=null, suppressClickUntil=0;
  const visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden'};
  const photoKey=img=>{const u=parse(imageUrl(img));return u?u.pathname.split('/').pop().replace(/_[nos](\.[a-z]+)$/i,'$1'):''};
  function mainPhoto(){
    if(pending?.key){
      const selected=[...document.querySelectorAll('img')].find(e=>largePhoto(e)&&photoKey(e)===pending.key);
      if(selected){chosenPhoto=selected;return selected;}
    }
    if(chosenPhoto?.isConnected&&largePhoto(chosenPhoto))return chosenPhoto;
    return [...document.querySelectorAll('img')].find(largePhoto)||null;
  }
  function gallery(img){
    if(!img)return null;
    const photoRect=img.getBoundingClientRect();let fallback=null;
    // Find the nearest gallery, never the seller form or a related listing.
    for(let scope=img.parentElement;scope&&scope!==document.body;scope=scope.parentElement){
      const thumbs=[...scope.querySelectorAll('img')].filter(e=>{
        if(e===img||e.closest('form')||!imageUrl(e)||/profile (?:picture|photo)|avatar/i.test(e.alt||''))return false;
        const link=e.closest('a[href]'),u=link&&parse(link.getAttribute('href'));
        if(u&&u.pathname!==location.pathname&&/\/marketplace\/item\//.test(u.pathname))return false;
        const r=e.getBoundingClientRect();
        return r.width>=20&&r.width<=112&&r.height>=20&&r.height<=112
          &&r.top>=photoRect.top&&r.top<=photoRect.bottom+150;
      }).map(e=>({img:e,control:e.closest('button,[role="button"],[role="tab"]')||e}));
      const unique=thumbs.filter((t,i)=>thumbs.findIndex(x=>x.control===t.control)===i);
      const arrows=[...scope.querySelectorAll('button,[role="button"]')].filter(e=>
        !e.closest('form')&&visible(e)&&/^(?:Next|Previous|Prev|Back)(?: (?:photo|image|picture))?$/i.test(clean(e.getAttribute('aria-label')||e.title)));
      if(unique.length>1)return {scope,thumbs:unique,arrows};
      if(!fallback&&arrows.length)fallback={scope,thumbs:unique,arrows};
      if(scope.matches('main,[role="main"],[role="dialog"]'))break;
    }
    return fallback;
  }
  function selectedIndex(g,img){
    let i=g.thumbs.findIndex(t=>photoKey(t.img)===photoKey(img));
    if(i<0)i=g.thumbs.findIndex(t=>t.control.getAttribute('aria-selected')==='true'||t.control.getAttribute('aria-current')==='true');
    if(i<0&&chosenThumb)i=g.thumbs.findIndex(t=>t.control===chosenThumb.control&&imageUrl(img)===chosenThumb.url);
    return i;
  }
  window.__marketOnlyPhotoState=function(){
    if(!pending)return {status:'idle'};
    if(!detail()||pending.path!==location.pathname){pending=null;return {status:'unavailable'};}
    const img=mainPhoto(),url=img&&imageUrl(img);
    if(url&&url!==pending.from&&img.complete&&img.naturalWidth>0){
      if(pending.control)chosenThumb={control:pending.control,url};
      pending=null;return {status:'ready',url};
    }
    if(Date.now()-pending.started>5000){pending=null;return {status:'unavailable'};}
    return {status:'pending'};
  };
  window.__marketOnlyMovePhoto=function(direction,from){
    if(!detail()||(direction!==1&&direction!==-1))return {status:'unavailable'};
    if(pending){const state=window.__marketOnlyPhotoState();if(state.status==='pending')return state;}
    const img=mainPhoto(),g=gallery(img);if(!img||!g)return {status:'unavailable'};
    const url=imageUrl(img);
    // Facebook may already have handled a native carousel gesture.
    if(from&&from!==url)return {status:'ready',url};
    const index=selectedIndex(g,img);let control;
    if(index>=0&&g.thumbs.length>1){
      const next=index+direction;if(next<0||next>=g.thumbs.length)return {status:'end'};
      control=g.thumbs[next].control;
    }else control=g.arrows.find(e=>(direction===1?/^Next/i:/^(Previous|Prev|Back)/i).test(clean(e.getAttribute('aria-label')||e.title)));
    if(!control||control.disabled||control.getAttribute('aria-disabled')==='true')return {status:'end'};
    const thumb=g.thumbs.find(t=>t.control===control);
    pending={from:url,path:location.pathname,started:Date.now(),control,key:thumb&&photoKey(thumb.img)};
    control.click();return window.__marketOnlyPhotoState();
  };
  function photoAt(target,x,y){
    if(!(target instanceof Element))return null;
    if(target.tagName==='IMG'&&largePhoto(target))return target;
    const control=target.closest('button,[role="button"]');
    if(control&&![...control.querySelectorAll('img')].some(largePhoto))return null;
    const surface=target.closest('[data-mo-swipe-surface]');
    if(surface){const photos=[...surface.querySelectorAll('img')].filter(largePhoto);if(photos.length===1)return photos[0];}
    for(let p=target;p&&p!==document.body&&!p.matches('main,[role="main"]');p=p.parentElement){
      const candidates=[...p.querySelectorAll('img')].filter(largePhoto).filter(e=>{const r=e.getBoundingClientRect();return x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom});
      if(candidates.length===1)return candidates[0];
      if(candidates.length>1)break;
    }
    return null;
  }
  function floatingChat(button){
    if(button.closest('form,[role="dialog"],[data-mo-card]'))return false;
    const label=clean(button.getAttribute('aria-label')||button.getAttribute('title')||button.textContent);
    if(!/^(?:New message|New chat|Create (?:a )?(?:new )?message|Compose(?: (?:a )?message)?|Chat|Messenger|Open (?:chat|Messenger))$/i.test(label))return false;
    let fixed=false;
    for(let p=button;p&&p!==document.body;p=p.parentElement){if(getComputedStyle(p).position==='fixed'){fixed=true;break;}}
    if(!fixed)return false;
    if(button.hasAttribute('data-mo-float-chat'))return true;
    const r=button.getBoundingClientRect();
    return r.width>=24&&r.width<=112&&r.height>=24&&r.height<=112
      &&r.right>=innerWidth-100&&r.bottom>=innerHeight-150;
  }
  const style=document.createElement('style');style.id='marketonly-media';
  style.textContent='[data-mo-float-chat]{display:none!important}[data-mo-enlarge]{cursor:zoom-in!important}[data-mo-swipe-surface]{touch-action:pan-y pinch-zoom!important}';
  (document.head||root).appendChild(style);
  let scheduled=false;
  function sweep(){
    scheduled=false;
    const hidden=new Set(),photos=new Set(),surfaces=new Set();
    if(active()){
      document.querySelectorAll('button,[role="button"],a[aria-label]').forEach(e=>{if(floatingChat(e))hidden.add(e)});
      if(detail())document.querySelectorAll('img').forEach(e=>{if(largePhoto(e))photos.add(e)});
      for(const img of photos){
        surfaces.add(img);
        for(let p=img.parentElement;p&&p!==document.body&&!p.matches('main,[role="main"]');p=p.parentElement){
          if(p.getBoundingClientRect().height>img.getBoundingClientRect().height+16)break;
          surfaces.add(p);
        }
      }
    }
    for(const [attr,nodes] of [['data-mo-float-chat',hidden],['data-mo-enlarge',photos],['data-mo-swipe-surface',surfaces]]){
      document.querySelectorAll('['+attr+']').forEach(e=>{if(!nodes.has(e))e.removeAttribute(attr)});
      for(const e of nodes)if(!e.hasAttribute(attr))e.setAttribute(attr,'');
    }
  }
  window.__marketOnlyOpenPhoto=function(url){location.href='marketonly://photo?url='+encodeURIComponent(url)};
  document.addEventListener('touchstart',event=>{
    if(event.touches.length!==1){touch=null;return;}
    const t=event.touches[0],img=photoAt(event.target,t.clientX,t.clientY);
    if(!img||(visualViewport&&visualViewport.scale>1.05)){touch=null;return;}
    chosenPhoto=img;touch={x:t.clientX,y:t.clientY,lastX:t.clientX,lastY:t.clientY,from:imageUrl(img),locked:false};
  },{capture:true,passive:true});
  document.addEventListener('touchmove',event=>{
    if(!touch)return;
    if(event.touches.length!==1||(visualViewport&&visualViewport.scale>1.05)){touch=null;return;}
    const t=event.touches[0];touch.lastX=t.clientX;touch.lastY=t.clientY;
    const dx=t.clientX-touch.x,dy=t.clientY-touch.y;
    if(!touch.locked&&Math.abs(dy)>12&&Math.abs(dy)>=Math.abs(dx)){touch=null;return;}
    if(Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)*1.4)touch.locked=true;
    if(touch.locked){event.preventDefault();event.stopImmediatePropagation();}
  },{capture:true,passive:false});
  document.addEventListener('touchend',event=>{
    const gesture=touch;touch=null;if(!gesture||!gesture.locked)return;
    event.preventDefault();event.stopImmediatePropagation();suppressClickUntil=Date.now()+450;
    const dx=gesture.lastX-gesture.x,dy=gesture.lastY-gesture.y;
    if(Math.abs(dx)>=40&&Math.abs(dx)>Math.abs(dy)*1.4){
      setTimeout(()=>window.__marketOnlyMovePhoto(dx<0?1:-1,gesture.from),100);
    }
  },{capture:true,passive:false});
  document.addEventListener('touchcancel',()=>{touch=null},{capture:true,passive:true});
  document.addEventListener('click',event=>{
    if(!detail()||event.button>0)return;
    if(event.isTrusted&&Date.now()<suppressClickUntil){event.preventDefault();event.stopImmediatePropagation();return;}
    let target=event.target instanceof Element?event.target:null;if(!target)return;
    const control=target.closest('button,[role="button"]');
    // Arrow buttons and thumbnail buttons keep Facebook's own gallery actions.
    if(control&&![...control.querySelectorAll('img')].some(largePhoto))return;
    const img=photoAt(target,event.clientX,event.clientY);
    if(!largePhoto(img))return;
    chosenPhoto=img;
    event.preventDefault();event.stopImmediatePropagation();window.__marketOnlyOpenPhoto(imageUrl(img));
  },true);
  function schedule(){if(!scheduled){scheduled=true;setTimeout(sweep,140)}}
  window.__marketOnlyMediaSweep=sweep;
  new MutationObserver(schedule).observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','aria-label','title','src','srcset','href','data-mo-detail-map']});
  addEventListener('resize',schedule);addEventListener('popstate',schedule);document.addEventListener('load',schedule,true);
  sweep();
})();
