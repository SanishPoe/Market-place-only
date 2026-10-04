/* Reproducible work-count comparison with the unmodified 1.1.17 assets.
   This measures DOM/style work, not device FPS or authenticated Facebook. */
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('playwright');
const base=path.resolve(__dirname,'..');
const assets=path.join(base,'app/src/main/assets');
const baseline=process.env.MARKETONLY_BASELINE_ASSETS||path.join(__dirname,'fixtures/performance-before-1.1.17');
const image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="240" height="240" fill="#587762"/></svg>');
function card(id,depth=20){
  let html=`<a id="listing-${id}" href="/marketplace/item/${id}/" onclick="event.preventDefault();window.opened=${id}"><div class="photo"><img src="${image}"></div><div class="caption"><span class="price">$100</span><span class="title">Listing ${id}</span><span class="place">Gold Coast, QLD</span></div><button onclick="event.preventDefault();event.stopPropagation();window.saved=${id}">Save</button></a>`;
  for(let i=0;i<depth;i++)html='<div>'+html+'</div>';
  return `<div class="cell">${html}</div>`;
}
function advert(){return `<div id="new-ad" style="min-height:350px"><a href="https://example.test/ad"><img src="${image}"></a><span>Sponsored</span></div>`;}
function fixture(virtual=false){
  const rows=Array.from({length:80},(_,i)=>`<div class="row" ${virtual?`style="position:absolute;left:0;right:0;height:300px;transform:translateY(${i*300}px)"`:''}>${card(i*2+1)}${card(i*2+2)}</div>`).join('');
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>
  body{margin:0;font:16px Arial;background:#242526;color:white}.row{display:flex}.cell{width:50%}.caption span{display:block}.photo{position:relative;padding-top:100%}.photo img{position:absolute;inset:0;width:100%;height:100%}a{color:inherit;text-decoration:none}button{padding:8px}
  ${virtual?'html,body{height:100%;overflow:hidden}main{height:100%;overflow:auto}#collection{position:relative;height:24000px}':''}
  </style></head><body><div id="network-status" role="status">Loading status</div><main role="main"><button aria-label="Change location">Gold Coast · 250 km</button><div id="collection">${rows}</div></main></body></html>`;
}
async function install(page,folder){
  await page.evaluate(css=>window.__marketOnlyCss=css,fs.readFileSync(path.join(folder,'marketplace.css'),'utf8'));
  for(const name of ['focus.js','adblock.js','media.js','marketplace.js','detail.js'])await page.evaluate(fs.readFileSync(path.join(folder,name),'utf8'));
  await page.waitForTimeout(450);
  await page.evaluate(()=>{
    window.__perf={selectors:0,styles:0,rects:0,walkers:0};
    for(const prototype of [Document.prototype,Element.prototype])for(const method of ['querySelector','querySelectorAll']){
      const original=prototype[method];prototype[method]=function(...args){window.__perf.selectors++;return original.apply(this,args);};
    }
    const style=window.getComputedStyle;window.getComputedStyle=function(...args){window.__perf.styles++;return style.apply(this,args);};
    const rect=Element.prototype.getBoundingClientRect;Element.prototype.getBoundingClientRect=function(...args){window.__perf.rects++;return rect.apply(this,args);};
    const walk=Document.prototype.createTreeWalker;Document.prototype.createTreeWalker=function(...args){window.__perf.walkers++;return walk.apply(this,args);};
    window.__fixture={status:document.getElementById('network-status'),collection:document.getElementById('collection'),anchor:document.getElementById('listing-50')};
    window.__resetWork=()=>Object.keys(window.__perf).forEach(k=>window.__perf[k]=0);
    window.__readWork=()=>({...window.__perf,total:Object.values(window.__perf).reduce((a,b)=>a+b,0)});
    window.__resetWork();
  });
}
async function nextPaint(page,read){
  // The task ends and MutationObserver runs before the next frame. This timer
  // registers our reader after the app's own frame callback is registered.
  return page.evaluate(read=>new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('First-paint reader did not run within five seconds')),5000);
    setTimeout(()=>requestAnimationFrame(()=>{try{const value=eval(read);clearTimeout(timeout);resolve(value);}catch(e){clearTimeout(timeout);reject(e);}}),0);
  }),read);
}
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.TEST_CHROME||chromium.executablePath(),args:['--no-sandbox']});
  const measurements={scope:'Controlled Chromium DOM fixtures with 160 cards nested 20 levels; no live Facebook, Android, FPS, or network benchmark.'};
  async function work(folder){
    const label=folder===assets?'after':'before',started=Date.now();
    const phase=name=>console.log(`PERF ${label}: ${name} (${Date.now()-started} ms)`);
    phase('opening fixture');
    const page=await browser.newPage({viewport:{width:384,height:760}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',r=>r.fulfill({status:200,contentType:'text/html',body:fixture()}));
    await page.goto('https://www.facebook.com/marketplace/');await install(page,folder);
    phase('installed');
    const result={};
    await page.evaluate(()=>{scrollTo(0,4500);window.__resetWork();});
    const scrollBefore=await page.evaluate(()=>scrollY);
    for(let i=0;i<5;i++){
      await page.evaluate(i=>{const e=window.__fixture.status;e.firstChild.nodeValue='Loading '+i;e.style.opacity=i%2?'0.9':'1';},i);
      await page.waitForTimeout(220);
    }
    result.unrelated=await page.evaluate(()=>window.__readWork());
    phase('unrelated mutations complete');
    assert.equal(await page.evaluate(()=>scrollY),scrollBefore,'Unrelated changes must not move the feed');
    await page.evaluate(()=>{window.__resetWork();for(let n=0;n<4;n++)window.__marketOnlyLayout();});
    result.repeated=await page.evaluate(()=>window.__readWork());
    phase('four repeated layouts complete');
    await page.evaluate(()=>window.__resetWork());
    for(let i=0;i<5;i++){
      await page.evaluate(i=>window.__fixture.anchor.querySelector('.title').style.color=i%2?'white':'silver',i);
      await page.waitForTimeout(220);
    }
    result.cardStyles=await page.evaluate(()=>window.__readWork());
    phase('card style mutations complete');
    await page.evaluate(()=>{window.__marketOnlyActive=false;dispatchEvent(new Event('marketonly:activity'));window.__resetWork();});
    for(let i=0;i<4;i++){
      await page.evaluate(i=>{window.__fixture.anchor.querySelector('.title').firstChild.nodeValue='Recycled listing '+i;},i);
      await page.waitForTimeout(220);
    }
    result.paused=await page.evaluate(()=>window.__readWork());
    phase('retained page updates complete');
    await page.evaluate(()=>{window.__marketOnlyActive=true;dispatchEvent(new Event('marketonly:activity'));});await page.waitForTimeout(300);
    result.resumedTitle=await page.locator('#listing-50 [data-mo-summary-title]').textContent();
    await page.evaluate(html=>{window.__fixture.collection.insertAdjacentHTML('afterbegin',html);},advert()+card(999));
    result.firstPaint=await nextPaint(page,`({adDisplay:getComputedStyle(document.getElementById('new-ad')).display,newCard:document.getElementById('listing-999').hasAttribute('data-mo-card')})`);
    phase('first paint read');
    await page.waitForTimeout(400);assert.deepEqual(errors,[]);
    await page.close();return result;
  }
  measurements.before=await work(baseline);measurements.after=await work(assets);
  fs.mkdirSync(path.join(base,'test-output'),{recursive:true});
  fs.writeFileSync(path.join(base,'test-output/performance-results.json'),JSON.stringify(measurements,null,2)+'\n');
  assert(measurements.before.unrelated.total>measurements.after.unrelated.total);
  assert.equal(measurements.after.unrelated.walkers,0,'A status update must not reparse listings');
  assert.equal(measurements.after.unrelated.total,0,'Unrelated status mutations must not sweep the feed');
  assert(measurements.before.repeated.walkers>measurements.after.repeated.walkers);
  assert.equal(measurements.after.repeated.walkers,0,'Unchanged captions must reuse their extraction');
  assert(measurements.before.cardStyles.total>measurements.after.cardStyles.total);
  assert(measurements.before.cardStyles.walkers>measurements.after.cardStyles.walkers);
  assert.equal(measurements.after.cardStyles.walkers,5,'Only the five changed cards must be reparsed');
  assert(measurements.before.paused.total>measurements.after.paused.total);
  // The fixture performs one selector per explicit title update; observer work
  // must contribute no additional DOM/style/geometry reads while retained.
  assert.deepEqual(measurements.after.paused,{selectors:4,styles:0,rects:0,walkers:0,total:4});
  assert.equal(measurements.after.resumedTitle,'$100 · Recycled listing 3');
  assert.equal(measurements.after.firstPaint.adDisplay,'none','New ads must be hidden before their first paint');
  assert.equal(measurements.after.firstPaint.newCard,true,'New listings must be styled before their first paint');
  console.log('PASS: unchanged captions, unrelated updates, retained pages and first paint improve actual work counts');
  const page=await browser.newPage({viewport:{width:384,height:760}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.fulfill({status:200,contentType:'text/html',body:fixture(true)}));
  await page.goto('https://www.facebook.com/marketplace/');
  const nativeGeometry=await page.evaluate(()=>{const m=document.querySelector('main'),c=document.querySelector('#collection');return {collectionHeight:c.getBoundingClientRect().height,leading:c.getBoundingClientRect().top-m.getBoundingClientRect().top,scrollHeight:m.scrollHeight};});
  await install(page,assets);
  await page.evaluate(()=>document.querySelector('main').scrollTop=4500);
  const geometry=()=>page.evaluate(()=>{const m=document.querySelector('main'),c=document.querySelector('#collection'),r=document.querySelectorAll('.row')[15];return {scrollTop:m.scrollTop,scrollHeight:m.scrollHeight,collectionHeight:c.getBoundingClientRect().height,leading:c.getBoundingClientRect().top-m.getBoundingClientRect().top+m.scrollTop,height:r.getBoundingClientRect().height,transform:getComputedStyle(r).transform,window:scrollY};});
  const before=await geometry();
  await page.evaluate(()=>{for(let n=0;n<4;n++)window.__marketOnlyLayout();});assert.deepEqual(await geometry(),before);
  assert.equal(before.height,300);assert.equal(before.window,0);assert.equal(before.scrollTop,4500);
  assert.equal(before.collectionHeight,nativeGeometry.collectionHeight);
  assert.equal(before.scrollHeight-before.leading,nativeGeometry.scrollHeight-nativeGeometry.leading,'Preserve native scrollable result height while allowing the compact location header');
  console.log('PASS: virtualised rows keep native heights, transforms, scroll owner and scroll position');
  await page.evaluate(()=>{
    const a=window.__fixture.anchor;a.querySelector('.price').firstChild.nodeValue='$225';a.querySelector('.title').firstChild.nodeValue='Updated title';a.querySelector('.place').firstChild.nodeValue='Brisbane, QLD';a.href='/marketplace/item/777/';
  });
  await page.waitForTimeout(200);
  assert.equal(await page.locator('#listing-50 [data-mo-summary-title]').textContent(),'$225 · Updated title');
  assert.equal(await page.locator('#listing-50 [data-mo-summary-location]').textContent(),'Brisbane, QLD');
  await page.evaluate(()=>{const ad=document.createElement('div');ad.innerHTML='<a href="https://example.test/ad"><img></a><span>Sponsored</span>';window.__fixture.collection.prepend(ad);window.__marketOnlyAdSweep();ad.id='recycled-ad';});
  assert.equal(await page.locator('#recycled-ad').isVisible(),false);
  await page.locator('#recycled-ad').evaluate((e,html)=>{e.innerHTML=html;window.__marketOnlyAdSweep();},card(1000));
  assert(await page.locator('#listing-1000').isVisible(),'A recycled advertisement must expose the real listing immediately');
  const withAd=await geometry();
  assert.equal(withAd.collectionHeight,nativeGeometry.collectionHeight,'An ad must not collapse the virtual collection spacer');
  assert.equal(withAd.scrollHeight-withAd.leading,nativeGeometry.scrollHeight-nativeGeometry.leading,'Preserve the native scrollable result height after ad recycling');
  console.log('PASS: reused React text, price, location, destination and ad wrappers remain current');
  await page.evaluate(()=>{history.pushState({},'', '/marketplace/create/item/');});await page.waitForTimeout(240);
  assert.equal(await page.locator('html').getAttribute('data-mo-page'),'detail');
  await page.evaluate(()=>{history.pushState({},'', '/marketplace/you/saved/');});await page.waitForTimeout(240);
  assert.equal(await page.locator('html').getAttribute('data-mo-page'),'browse');
  const savedCaptions=await page.locator('[data-mo-summary]').count();assert(savedCaptions>0);
  await page.evaluate(()=>{history.pushState({},'', '/marketplace/create/item/');});await page.waitForTimeout(240);
  assert.equal(await page.locator('[data-mo-summary]').count(),0);
  await page.evaluate(()=>{history.pushState({},'', '/marketplace/you/saved/');});await page.waitForTimeout(240);
  assert.equal(await page.locator('[data-mo-summary]').count(),savedCaptions,'Returning to the same browse URL must rebuild removed captions');
  assert.deepEqual(errors,[]);console.log('PASS: installed assets follow SPA Sell and Saved navigation without reinjection');
  measurements.virtualisation={native:nativeGeometry,before,after:await geometry()};
  fs.mkdirSync(path.join(base,'test-output'),{recursive:true});
  fs.writeFileSync(path.join(base,'test-output/performance-results.json'),JSON.stringify(measurements,null,2)+'\n');
  await page.close();await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
