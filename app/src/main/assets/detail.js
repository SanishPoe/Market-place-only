(function(){
  'use strict';
  if(!/(^|\.)facebook\.com$/i.test(location.hostname))return;
  if(window.__marketOnlyDetailLayout){window.__marketOnlyDetailLayout();return;}
  const root=document.documentElement,clean=s=>(s||'').replace(/\s+/g,' ').trim();
  const attrs=['data-mo-detail-stack','data-mo-detail-pass','data-mo-detail-order','data-mo-detail-part','data-mo-detail-padding','data-mo-detail-margin','data-mo-detail-offset','data-mo-detail-spacer','data-mo-detail-fullframe','data-mo-detail-map','data-mo-detail-map-inset','data-mo-detail-inset','data-mo-detail-location-flow','data-mo-detail-location-label','data-mo-detail-divider'];
  const sourceStyles=new WeakMap();let seen,generatedUsed=null,scheduled=false;
  const active=()=>/^\/marketplace\/item\/[^/]+\/?$/.test(location.pathname)&&!document.querySelector('input[type="password"],form[action*="login"]');
  const shown=e=>getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden'&&e.getBoundingClientRect().width>0;
  const style=document.createElement('style');style.id='marketonly-detail';
  style.textContent=`html[data-mo-detail] [data-mo-detail-stack]{display:flex!important;flex-direction:column!important;align-items:stretch!important;gap:0!important}
html[data-mo-detail] [data-mo-detail-pass]{display:contents!important}
html[data-mo-detail] [data-mo-detail-generated-description]{font:600 18px/1.35 sans-serif!important;color:inherit!important;margin:0!important;padding:16px 16px 8px!important}
html[data-mo-detail] [data-mo-detail-order]{flex-shrink:0!important;min-width:0!important;box-sizing:border-box!important}
html[data-mo-detail] [data-mo-detail-map-inset]{margin-left:16px!important;margin-right:16px!important;width:calc(100% - 32px)!important;max-width:calc(100% - 32px)!important;box-sizing:border-box!important}
html[data-mo-detail] [data-mo-detail-location-flow]{position:static!important;height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;transform:none!important;line-height:1.4!important}
html[data-mo-detail] [data-mo-detail-location-label]{display:block!important;white-space:normal!important;overflow-wrap:break-word!important;padding-top:8px!important;padding-bottom:8px!important;margin-top:0!important;margin-bottom:0!important}
html[data-mo-detail] [data-mo-detail-divider]{position:static!important;transform:none!important;height:1px!important;min-height:1px!important;max-height:1px!important;flex:none!important;margin:8px 16px 0!important;box-sizing:border-box!important}
html[data-mo-detail] [data-mo-detail-padding]{padding-top:0!important}
html[data-mo-detail] [data-mo-detail-margin]{margin-top:0!important}
html[data-mo-detail] [data-mo-detail-offset]{top:0!important}
html[data-mo-detail] [data-mo-detail-spacer]{display:none!important}
html[data-mo-detail] [data-mo-detail-fullframe]{top:0!important;bottom:0!important;height:auto!important;max-height:none!important;min-height:0!important}
`+Array.from({length:96},(_,i)=>`html[data-mo-detail] [data-mo-detail-order="${i}"]{order:${i}!important}`).join('\n')+Array.from({length:33},(_,i)=>`html[data-mo-detail] [data-mo-detail-inset="${i}"]{padding-left:${i}px!important;padding-right:${i}px!important}`).join('\n');
  (document.head||root).appendChild(style);
  function mark(e,attr,value=''){
    seen.get(attr).add(e);if(e.getAttribute(attr)!==value)e.setAttribute(attr,value);
  }
  function source(e){return (e.getAttribute('class')||'')+'\n'+(e.getAttribute('style')||'');}
  function retained(e,attr){return e.hasAttribute(attr)&&sourceStyles.get(e)?.[attr]===source(e);}
  function trim(e,attr){mark(e,attr);const values=sourceStyles.get(e)||{};values[attr]=source(e);sourceStyles.set(e,values);}
  function labels(scope,pattern){
    const all=[...scope.querySelectorAll('h1,h2,h3,h4,[role="heading"],span,div,p,label,strong,b,dt')].filter(e=>{
      const text=clean(e.textContent);return text.length<90&&pattern.test(text)&&!e.closest('[contenteditable="true"],textarea,input,[data-mo-ad-hidden],[data-mo-detail-generated-description]');
    });
    return all.filter(e=>!all.some(other=>other!==e&&e.contains(other)));
  }
  function common(nodes){
    let p=nodes[0]?.parentElement;while(p&&!nodes.every(n=>p.contains(n)))p=p.parentElement;return p;
  }
  const after=(a,b)=>!!(a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING);
  function locationSection(scope,reference){
    const caption=labels(scope,/^(?:Location is approximate|.*[·.]\s*Location is approximate)$/i).find(e=>shown(e)&&after(reference,e));
    if(!caption)return {map:null,caption:null};
    // Facebook's map may be a CSS background, canvas, SVG or ordinary image.
    // Associate it with the actual approximate-location label, never a gallery.
    const renderers=[...scope.querySelectorAll('img,canvas,svg,iframe,[role="img"],div')].filter(e=>{
      if(!after(reference,e)||!after(e,caption)||e.contains(caption)||e.closest('form,[data-mo-ad-hidden],a[href*="/marketplace/item/"]'))return false;
      const r=e.getBoundingClientRect();if(r.width<Math.min(150,innerWidth*.45)||r.height<36||r.height>320||!shown(e))return false;
      return e.matches('img,canvas,svg,iframe,[role="img"]')||getComputedStyle(e).backgroundImage.includes('url(');
    });
    let map=renderers[renderers.length-1]||null;
    if(map){
      for(let p=map.parentElement;p&&p!==scope;p=p.parentElement){
        if(p.contains(caption)||p.contains(reference)||p.matches('main,form,[role="main"],[role="dialog"]')||p.querySelector('input,textarea,h1,h2,h3,[role="heading"]'))break;
        const w=document.createTreeWalker(p,NodeFilter.SHOW_TEXT);let extra=false;
        while(w.nextNode())if(!map.contains(w.currentNode)&&clean(w.currentNode.textContent)&&!/^i$/i.test(clean(w.currentNode.textContent))){extra=true;break;}
        if(extra||p.getBoundingClientRect().height>320)break;
        map=p;
      }
    }
    let row=caption;
    for(let p=row.parentElement;p&&p!==scope;p=p.parentElement){
      if(p.contains(reference)||(map&&p.contains(map))||p.matches('main,form,[role="main"],[role="dialog"]')||p.querySelector('input,textarea,h1,h2,h3,[role="heading"],img,canvas,svg,iframe')||clean(p.textContent).length>180||/Seller information|Send seller a message/i.test(p.textContent))break;
      row=p;
    }
    return {map,caption:row,label:caption};
  }
  function finishSpacing(ordered,location){
    // Flattened React layout wrappers no longer contribute their old padding.
    // Restore only the missing inset, without adding a second inset to sections
    // that already have it. Keep map internals/absolute controls unchanged.
    for(const u of ordered){
      const e=u.node;if(!['actions','description','vehicle','message','location'].includes(u.kind))continue;
      if(e===location.map){
        if(e.hasAttribute('data-mo-detail-map-inset')&&!retained(e,'data-mo-detail-map-inset'))e.removeAttribute('data-mo-detail-map-inset');
        if(e.getBoundingClientRect().left<15||retained(e,'data-mo-detail-map-inset'))trim(e,'data-mo-detail-map-inset');
        continue;
      }
      if(retained(e,'data-mo-detail-inset')){mark(e,'data-mo-detail-inset',e.getAttribute('data-mo-detail-inset'));continue;}
      if(e.hasAttribute('data-mo-detail-inset'))e.removeAttribute('data-mo-detail-inset');
      const walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let left=null;
      while(walker.nextNode()){
        const n=walker.currentNode,p=n.parentElement;
        if(!clean(n.textContent)||p.closest('[hidden],script,style,[data-mo-detail-map]'))continue;
        const r=document.createRange();r.selectNode(n);const rect=[...r.getClientRects()].find(x=>x.width>0&&x.height>0);
        if(rect){left=rect.left;break;}
      }
      if(left!==null&&left<15){
        const padding=Math.max(0,Math.min(32,Math.round(parseFloat(getComputedStyle(e).paddingLeft)+16-left)));
        mark(e,'data-mo-detail-inset',String(padding));
        const values=sourceStyles.get(e)||{};values['data-mo-detail-inset']=source(e);sourceStyles.set(e,values);
      }
    }
  }
  function descriptionText(scope,start,ends){
    // Use source order, not the positions produced by our CSS. Facebook often
    // keeps the heading and expandable text in entirely separate branches.
    const boundary=ends.filter(e=>e!==start&&!e.contains(start)&&after(start,e))
      .sort((a,b)=>after(a,b)?-1:1)[0];
    const parts=[],walker=document.createTreeWalker(scope,NodeFilter.SHOW_TEXT);
    while(walker.nextNode()){
      const n=walker.currentNode,e=n.parentElement;
      if(!clean(n.textContent)||start.contains(n)||!after(start,n)||(boundary&&!after(n,boundary)))continue;
      if(e.closest('script,style,template,form,input,textarea,[contenteditable],[role="status"],[role="alert"],[data-mo-ad-hidden],[data-mo-detail-generated-description]'))continue;
      parts.push(e);
    }
    return [...new Set(parts)];
  }
  function orderSections(scope){
    const description=labels(scope,/^(?:Seller['’]s description|Description)$/i).find(shown);
    const vehicle=labels(scope,/^(?:About this vehicle|Details)$/i).find(shown);
    const message=labels(scope,/^Send seller a message$/i).find(shown);
    if(!message||(!description&&!vehicle))return;
    const actions=[...scope.querySelectorAll('button,[role="button"],a[role="link"]')].filter(e=>/^(?:Save|Saved|Share)$/i.test(clean(e.getAttribute('aria-label')||e.textContent))&&!e.closest('form')&&after(e,description||vehicle));
    const location=locationSection(scope,description||vehicle);
    const endings=labels(scope,/^(?:About this vehicle|Details|Send seller a message|Seller information|Seller details|Location is approximate|.*[·.] Location is approximate)$/i);
    // A map is a boundary even when its caption is a later sibling. Small
    // decorative icons are not boundaries inside an ordinary description.
    scope.querySelectorAll('[role="img"],img,iframe,canvas').forEach(e=>{
      const r=e.getBoundingClientRect();if(shown(e)&&r.width>=80&&r.height>=40)endings.push(e);
    });
    endings.push(...actions,...[location.map,location.caption].filter(Boolean));
    let parts=[],facts=[];
    if(description)parts=descriptionText(scope,description,endings);
    else if(/^Details$/i.test(clean(vehicle.textContent))){
      // In the general-item template the description follows the condition /
      // specification rows and has no heading of its own. Identify those rows
      // before selecting the remaining text; never treat a fact as description.
      const fieldLabels=labels(scope,/^(?:Condition|Brand|Material|Size|Colour|Color|Dimensions|Model|Type|Style)$/i)
        .filter(e=>after(vehicle,e)&&!endings.some(b=>b!==vehicle&&after(vehicle,b)&&after(b,e)));
      for(const field of fieldLabels){
        let row=field;
        while(row.parentElement&&row.parentElement!==scope){
          const p=row.parentElement;
          if(p.contains(vehicle)||endings.some(b=>b!==vehicle&&p.contains(b)))break;
          row=p;
          if(clean(row.textContent)!==clean(field.textContent))break;
        }
        if(clean(row.textContent)!==clean(field.textContent))facts.push(row);
      }
      const start=facts.length?facts[facts.length-1]:vehicle;
      parts=descriptionText(scope,start,endings);
    }
    // Do not move a lone heading while the real text is still loading.
    if(!parts.some(e=>! /^(?:See more|See less)$/i.test(clean(e.textContent))))return;
    const targets=[description,vehicle,message,...parts,...facts,...actions,location.map,location.caption].filter(Boolean),host=common(targets);
    if(!host||host===document.body||host===root||host.matches('form,[contenteditable]'))return;
    const anchors=new Map([[message,'message']]);
    if(description)anchors.set(description,'description');
    parts.forEach(e=>anchors.set(e,'description'));
    if(vehicle)anchors.set(vehicle,'vehicle');facts.forEach(e=>anchors.set(e,'vehicle'));
    actions.forEach(e=>anchors.set(e,'actions'));
    if(location.map)anchors.set(location.map,'location');
    if(location.caption)anchors.set(location.caption,'location');
    // Keep gallery, map, seller details and notices out of the moved groups.
    host.querySelectorAll('h1,h2,h3,h4,[role="heading"],img[data-mo-enlarge],[role="alert"],[role="status"],[data-mo-ad-hidden],a[href*="/marketplace/item/"],img,[role="img"],iframe,canvas').forEach(e=>{
      if(e.hasAttribute('data-mo-detail-generated-description'))return;
      if(![...anchors.keys()].some(a=>e===a||e.contains(a)||a.contains(e)))anchors.set(e,'other');
    });
    for(const e of labels(host,/^(?:Ads|Sponsored|Seller information|Seller details|Location is approximate|.*[·.] Location is approximate)$/i)){
      if(!parts.some(p=>p===e||p.contains(e)||e.contains(p))&&!location.caption?.contains(e))anchors.set(e,'other');
    }
    // A message label and its form may be sibling branches. Treat both as one
    // section, without replacing or moving the real input or Send handler.
    for(const input of host.querySelectorAll('textarea,input:not([type="hidden"]),[contenteditable="true"]')){
      if(input.closest('form')?.querySelector('input[type="file"]'))continue;
      const label=clean(input.getAttribute('aria-label')||input.getAttribute('placeholder'));
      if(/message|available|seller/i.test(label)||input.closest('form')?.contains(message))anchors.set(input.closest('form')||input,'message');
    }
    host.querySelectorAll('hr,[role="separator"]').forEach(e=>{if(![...anchors.keys()].some(a=>a.contains(e)))anchors.set(e,'divider');});
    const units=[],pass=[];let safe=true;
    function project(e){
      if(e.matches('script,style,template,[data-mo-detail-generated-description]'))return;
      const kinds=new Set([...anchors].filter(([a])=>e===a||e.contains(a)).map(([,kind])=>kind));
      if(kinds.size<=1){units.push({node:e,kind:[...kinds][0]||null});return;}
      const s=getComputedStyle(e);
      if(e.matches('form,button,a,input,textarea,[contenteditable]')||['fixed','sticky','absolute'].includes(s.position)
        ||(/auto|scroll/.test(s.overflowY)&&e.scrollHeight>e.clientHeight+2)
        ||[...e.childNodes].some(n=>n.nodeType===3&&clean(n.textContent))){safe=false;return;}
      pass.push(e);[...e.children].forEach(project);
    }
    [...host.children].forEach(project);
    if(!safe||units.length>96||[...host.childNodes].some(n=>n.nodeType===3&&clean(n.textContent)))return;
    let previous='other';for(const unit of units){if(unit.kind)previous=unit.kind;else unit.kind=previous;}
    const wanted=['actions','description','vehicle','message','location'];
    const selected=units.filter(u=>wanted.includes(u.kind));
    if(!selected.some(u=>u.kind==='description')||!selected.some(u=>u.kind==='message'))return;
    const first=units.indexOf(selected[0]),ordered=units.filter(u=>!wanted.includes(u.kind));
    if(!description){
      let heading=host.querySelector('[data-mo-detail-generated-description]');
      if(!heading){heading=document.createElement('h2');heading.setAttribute('data-mo-detail-generated-description','');heading.textContent="Seller's description";host.appendChild(heading);}
      generatedUsed=heading;
      selected.unshift({node:heading,kind:'description'});
    }
    ordered.splice(first,0,...wanted.flatMap(kind=>selected.filter(u=>u.kind===kind)));
    mark(host,'data-mo-detail-stack');pass.forEach(e=>mark(e,'data-mo-detail-pass'));
    ordered.forEach((u,i)=>{mark(u.node,'data-mo-detail-order',String(i));mark(u.node,'data-mo-detail-part',u.kind);});
    if(location.map)mark(location.map,'data-mo-detail-map');
    if(location.caption){
      mark(location.caption,'data-mo-detail-location-label');
      const unit=ordered.find(u=>u.node===location.caption||u.node.contains(location.caption));
      for(let p=location.label;p&&p!==host;p=p.parentElement){
        if(location.map&&p.contains(location.map))break;
        mark(p,'data-mo-detail-location-flow');if(p===unit?.node)break;
      }
    }
    ordered.filter(u=>u.kind==='divider').forEach(u=>mark(u.node,'data-mo-detail-divider'));
    finishSpacing(ordered,location);
  }
  function hasContent(e){
    if(e.nodeType===3)return !!clean(e.textContent);
    if(e.nodeType!==1||e.matches('script,style,template,[data-mo-hide]'))return false;
    const s=getComputedStyle(e);if(s.display==='none'||s.visibility==='hidden')return false;
    if(e.matches('a,button,input,textarea,select,img,video,iframe,canvas,svg,[role="button"],[role="status"],[role="alert"],[role="progressbar"],[aria-busy="true"]'))return true;
    return [...e.childNodes].some(hasContent);
  }
  function compactPhotoTop(hero,scope){
    if(!hero)return;
    for(let branch=hero;branch&&branch!==document.body;branch=branch.parentElement){
      const parent=branch.parentElement;if(!parent||parent===root)break;
      const s=getComputedStyle(parent),r=parent.getBoundingClientRect(),top=parseFloat(s.top);
      if((['fixed','absolute'].includes(s.position)&&top>0&&top<=96&&r.width>=innerWidth*.9&&r.height>=innerHeight*.7&&parent.contains(scope))||retained(parent,'data-mo-detail-fullframe'))trim(parent,'data-mo-detail-fullframe');
      if((s.position==='relative'&&s.transform==='none'&&top>0&&top<=96)||retained(parent,'data-mo-detail-offset'))trim(parent,'data-mo-detail-offset');
      const padding=parseFloat(s.paddingTop),margin=parseFloat(s.marginTop);
      if((padding>=24&&padding<=160)||retained(parent,'data-mo-detail-padding'))trim(parent,'data-mo-detail-padding');
      if((margin>=24&&margin<=160)||retained(parent,'data-mo-detail-margin'))trim(parent,'data-mo-detail-margin');
      for(let prev=branch.previousElementSibling;prev;prev=prev.previousElementSibling){
        if(hasContent(prev))break;
        const h=prev.getBoundingClientRect().height;
        if((h>0&&h<=160&&prev.scrollHeight<=prev.clientHeight+1)||retained(prev,'data-mo-detail-spacer'))trim(prev,'data-mo-detail-spacer');
      }
    }
  }
  function sweep(){
    scheduled=false;generatedUsed=null;seen=new Map(attrs.map(a=>[a,new Set()]));
    if(active()){
      root.setAttribute('data-mo-detail','');
      const hero=[...document.querySelectorAll('img[data-mo-enlarge],main img,[role="main"] img,[role="dialog"] img')].find(e=>{
        const r=e.getBoundingClientRect();return r.width*r.height>=16000&&shown(e)&&!e.closest('form,[data-mo-ad-hidden],a[href*="/marketplace/item/"]')&&!/profile|avatar/i.test(e.alt||'')&&!getComputedStyle(e).filter.includes('blur');
      });
      const scope=hero?.closest('[role="dialog"],main,[role="main"]')||document.querySelector('main,[role="main"]')||document.body;
      orderSections(scope);compactPhotoTop(hero?.closest('[data-mo-detail-map]')?null:hero,scope);
    }else root.removeAttribute('data-mo-detail');
    document.querySelectorAll('[data-mo-detail-generated-description]').forEach(e=>{if(e!==generatedUsed)e.remove();});
    for(const attr of attrs)document.querySelectorAll('['+attr+']').forEach(e=>{if(!seen.get(attr).has(e))e.removeAttribute(attr);});
  }
  function schedule(){if(!scheduled){scheduled=true;setTimeout(sweep,160);}}
  window.__marketOnlyDetailLayout=sweep;
  new MutationObserver(schedule).observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','style','src','aria-label']});
  addEventListener('popstate',schedule);addEventListener('resize',schedule);document.addEventListener('load',schedule,true);
  sweep();
})();
