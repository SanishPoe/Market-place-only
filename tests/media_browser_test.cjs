/* Controlled photo-gallery and floating-chat fixtures; native dialog is compiled separately. */
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('playwright');
const base=path.resolve(__dirname,'..'),asset=n=>fs.readFileSync(path.join(base,'app/src/main/assets',n),'utf8');
const source=n=>'https://scontent.example.fbcdn.net/photo-'+n+'.jpg?token=example';
const image='<svg xmlns="http://www.w3.org/2000/svg" width="400" height="800"><rect width="400" height="800" fill="#668271"/></svg>';
const fixture=`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#242526;color:white;font:16px Arial}#hero{position:relative;width:360px;height:320px;display:flex;justify-content:center}#main-photo{width:160px;height:320px;object-fit:contain}#thumbs{display:flex;gap:8px}#thumbs img{width:40px;height:40px}button{background:#3a3b3c;color:white;border:0;padding:6px}#chat-shell{position:fixed;right:16px;bottom:16px}#chat{width:48px;height:48px}#sell{position:fixed;bottom:16px;left:16px;width:48px;height:48px}#next{position:absolute;right:0;top:140px}#overlay{position:absolute;left:100px;top:0;width:160px;height:30px}#related{display:block;margin-top:20px}#related img{width:180px;height:180px}</style></head><body><main role="main"><div id="hero"><img id="main-photo" src="${source(1)}" alt="Listing photo"><span id="overlay"></span><button id="next" aria-label="Next photo" onclick="document.querySelector('#main-photo').src='${source(2)}';window.nextClicked=true">›</button></div><div id="thumbs"><button id="thumb-1" onclick="document.querySelector('#main-photo').src='${source(1)}';window.thumbnail=1"><img src="${source(1)}"></button><button id="thumb-2" onclick="document.querySelector('#main-photo').src='${source(2)}';window.thumbnail=2"><img src="${source(2)}"></button></div><h1>Vehicle listing</h1><form onsubmit="event.preventDefault();window.sent=true"><label>Send seller a message<input value="Hello"></label><button id="send" type="submit">Send</button><button type="button" id="inline-chat" aria-label="New message" onclick="window.inlineChat=true">Message seller</button></form><button id="save" onclick="window.saved=true">Save</button><a id="related" href="/marketplace/item/other/" onclick="event.preventDefault();window.related=true"><img src="${source(3)}">Another listing</a></main><div id="chat-shell"><button id="chat" aria-label="New message">Chat</button></div><button id="sell" aria-label="Create new listing" onclick="window.sell=true">Sell</button></body></html>`;
(async()=>{
const browser=await chromium.launch({executablePath:process.env.TEST_CHROME||chromium.executablePath(),args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:360,height:628},hasTouch:true,isMobile:true});page.setDefaultTimeout(1500);const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',r=>r.fulfill({status:200,contentType:r.request().resourceType()==='image'?'image/svg+xml':'text/html',body:r.request().resourceType()==='image'?image:fixture}));
async function open(url='/marketplace/item/1/',combined=false){await page.goto('https://www.facebook.com'+url);await page.evaluate(asset('focus.js'));await page.evaluate(asset('adblock.js'));await page.evaluate(asset('media.js'));if(combined){await page.evaluate(c=>window.__marketOnlyCss=c,asset('marketplace.css'));await page.evaluate(asset('marketplace.js'));await page.evaluate(asset('detail.js'))}await page.evaluate(()=>{window.photos=[];window.__marketOnlyOpenPhoto=url=>window.photos.push(url)});await page.waitForTimeout(350)}
const results=[];async function test(name,fn){try{await fn();results.push({name,passed:true});console.log('PASS:',name)}catch(e){results.push({name,passed:false,error:e.message});console.error('FAIL:',name,e.message)}}
const session=await page.context().newCDPSession(page);
async function swipe(x1,y1,x2,y2){
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x1,y:y1}]});
  for(let i=1;i<=8;i++){await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x1+(x2-x1)*i/8,y:y1+(y2-y1)*i/8}]});await page.waitForTimeout(18)}
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(500);
}
await open();
await test('only the floating chat launcher is hidden',async()=>{assert.equal(await page.locator('#chat').isVisible(),false);assert(await page.locator('#send').isVisible());assert(await page.locator('#inline-chat').isVisible());assert(await page.locator('#sell').isVisible())});
await test('tapping the main portrait photo requests its full image URL',async()=>{await page.locator('#main-photo').tap({position:{x:70,y:100}});assert.deepEqual(await page.evaluate(()=>window.photos),[source(1)])});
await test('thumbnail taps keep selecting photos without opening the large viewer',async()=>{await page.locator('#thumb-2 img').tap();assert.equal(await page.evaluate(()=>window.thumbnail),2);assert.equal(await page.evaluate(()=>window.photos.length),1);await page.locator('#main-photo').tap({position:{x:70,y:100}});assert.equal(await page.evaluate(()=>window.photos.at(-1)),source(2))});
await test('gallery arrow controls still select the next image',async()=>{await page.locator('#next').tap();assert(await page.evaluate(()=>window.nextClicked));assert.equal(await page.evaluate(()=>window.photos.length),2)});
await test('a transparent photo overlay also opens the correct image',async()=>{await page.locator('#overlay').tap();assert.equal(await page.evaluate(()=>window.photos.at(-1)),source(2));assert.equal(await page.evaluate(()=>window.photos.length),3)});
await test('seller message and Save actions are preserved',async()=>{await page.locator('#send').click();await page.locator('#save').click();assert(await page.evaluate(()=>window.sent&&window.saved));assert.equal(await page.evaluate(()=>window.photos.length),3)});
await test('related listing photos keep their listing navigation',async()=>{await page.locator('#related img').click();assert(await page.evaluate(()=>window.related));assert.equal(await page.evaluate(()=>window.photos.length),3)});
await test('reinjecting does not duplicate photo click handlers',async()=>{await page.evaluate(asset('media.js'));await page.locator('#main-photo').tap({position:{x:70,y:100}});assert.equal(await page.evaluate(()=>window.photos.length),4)});
await test('the narrow portrait proportions in the phone screenshot still enlarge',async()=>{for(const [w,h] of [[114,204],[102,182]]){const before=await page.evaluate(()=>window.photos.length);await page.locator('#main-photo').evaluate((e,size)=>{e.style.width=size[0]+'px';e.style.height=size[1]+'px'},[w,h]);await page.locator('#main-photo').tap({position:{x:40,y:100}});assert.equal(await page.evaluate(()=>window.photos.length),before+1)}});
await test('a recycled chat button becomes visible for a different action',async()=>{await page.locator('#chat').evaluate(e=>e.setAttribute('aria-label','Create new listing'));await page.waitForTimeout(300);assert(await page.locator('#chat').isVisible());await page.locator('#chat').evaluate(e=>e.setAttribute('aria-label','New message'));await page.waitForTimeout(300);assert.equal(await page.locator('#chat').isVisible(),false)});
await test('browse-page image taps keep opening listings',async()=>{await open('/marketplace/');await page.locator('#related img').click();assert(await page.evaluate(()=>window.related));assert.equal(await page.evaluate(()=>window.photos.length),0);assert.equal(await page.locator('#chat').isVisible(),false)});
await test('login pages are untouched',async()=>{await open('/login/');assert(await page.locator('#chat').isVisible());await page.locator('#main-photo').tap({position:{x:70,y:100}});assert.equal(await page.evaluate(()=>window.photos.length),0)});
await test('untrusted image hosts are not sent to the native viewer',async()=>{await open();await page.locator('#main-photo').evaluate(e=>e.src='https://example.test/untrusted.jpg');await page.waitForTimeout(200);await page.locator('#main-photo').tap({position:{x:70,y:100}});assert.equal(await page.evaluate(()=>window.photos.length),0)});
await test('full compact layout preserves gallery taps and floating-chat removal',async()=>{await open('/marketplace/item/1/',true);await page.locator('#thumb-2 img').tap();await page.locator('#main-photo').tap({position:{x:70,y:100}});assert.deepEqual(await page.evaluate(()=>window.photos),[source(2)]);assert.equal(await page.locator('#chat').isVisible(),false);assert.equal(await page.locator('[data-mo-grid]').count(),0)});
await test('normal photo swipes select next and previous without opening the viewer',async()=>{
  await open();await swipe(240,160,120,165);assert.equal(await page.locator('#main-photo').getAttribute('src'),source(2));assert.deepEqual(await page.evaluate(()=>window.photos),[]);
  await swipe(120,160,240,165);assert.equal(await page.locator('#main-photo').getAttribute('src'),source(1));assert.deepEqual(await page.evaluate(()=>window.photos),[]);
});
await test('swipes stop at the ends of the gallery and keep normal taps working',async()=>{
  await swipe(120,160,240,165);assert.equal(await page.locator('#main-photo').getAttribute('src'),source(1));
  await page.locator('#main-photo').tap({position:{x:70,y:100}});assert.deepEqual(await page.evaluate(()=>window.photos),[source(1)]);
});
await test('vertical drags on the normal photo still scroll the listing',async()=>{
  await open();await swipe(180,290,182,70);assert(await page.evaluate(()=>scrollY>25));assert.equal(await page.locator('#main-photo').getAttribute('src'),source(1));assert.deepEqual(await page.evaluate(()=>window.photos),[]);
});
await test('viewer navigation waits for the full photo after an asynchronous thumbnail click',async()=>{
  await open();await page.locator('#thumb-2').evaluate((e,url)=>{e.onclick=()=>setTimeout(()=>document.querySelector('#main-photo').src=url,180)},source(2));
  assert.equal((await page.evaluate(url=>window.__marketOnlyMovePhoto(1,url),source(1))).status,'pending');
  await page.waitForTimeout(250);assert.deepEqual(await page.evaluate(()=>window.__marketOnlyPhotoState()),{status:'ready',url:source(2)});
});
await test('a gallery that already advanced is not advanced a second time',async()=>{
  await open();await page.evaluate(url=>{const button=document.createElement('button');button.innerHTML='<img style="width:40px;height:40px" src="'+url+'">';button.onclick=()=>document.querySelector('#main-photo').src=url;document.querySelector('#thumbs').appendChild(button);document.querySelector('#hero').addEventListener('pointerup',()=>{document.querySelector('#thumb-2').click()})},source(3));
  await swipe(240,160,120,165);assert.equal(await page.locator('#main-photo').getAttribute('src'),source(2));
});
await test('panning a zoomed normal photo never changes the selected image',async()=>{
  await open();await session.send('Emulation.setPageScaleFactor',{pageScaleFactor:2});assert(await page.evaluate(()=>visualViewport.scale>1.5));
  await swipe(240,160,120,165);assert.equal(await page.locator('#main-photo').getAttribute('src'),source(1));assert.deepEqual(await page.evaluate(()=>window.photos),[]);
  await session.send('Emulation.setPageScaleFactor',{pageScaleFactor:1});
});
await test('a pinch gesture does not advance the normal gallery',async()=>{
  await open();await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:0,x:150,y:170},{id:1,x:200,y:170}]});
  for(let i=1;i<=5;i++){await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:0,x:150-i*8,y:170},{id:1,x:200+i*8,y:170}]});await page.waitForTimeout(20)}
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(250);
  assert.equal(await page.locator('#main-photo').getAttribute('src'),source(1));assert.deepEqual(await page.evaluate(()=>window.photos),[]);
  await session.send('Emulation.setPageScaleFactor',{pageScaleFactor:1});
});
await test('swiping across the blank margins around a portrait also advances',async()=>{
  await open();await swipe(320,180,40,180);assert.equal(await page.locator('#main-photo').getAttribute('src'),source(2));assert.deepEqual(await page.evaluate(()=>window.photos),[]);
});
await test('carousel slides retained in the DOM return the newly selected full image',async()=>{
  await open();await page.evaluate(url=>{
    const next=document.querySelector('#main-photo').cloneNode();next.id='second-slide';next.src=url;next.style.display='none';document.querySelector('#hero').append(next);
    document.querySelector('#thumb-2').onclick=()=>{document.querySelector('#main-photo').style.visibility='hidden';next.style.display='block'};
  },source(2));await page.waitForTimeout(100);
  const result=await page.evaluate(url=>window.__marketOnlyMovePhoto(1,url),source(1));
  assert.deepEqual(result,{status:'ready',url:source(2)});
});
await test('page settles without repeated mutation or script errors',async()=>{await page.waitForTimeout(400);const count=await page.evaluate(()=>new Promise(resolve=>{let n=0;const o=new MutationObserver(r=>n+=r.length);o.observe(document.body,{subtree:true,attributes:true,childList:true});setTimeout(()=>{o.disconnect();resolve(n)},400)}));assert.equal(count,0);assert.deepEqual(errors,[])});
await page.screenshot({path:path.join(base,'test-output/media-fixture.png'),fullPage:true});
fs.writeFileSync(path.join(base,'test-output/media-results.json'),JSON.stringify({scope:'Browser fixtures verify gallery controls and native photo requests. Actual Android dialog and pinch gestures need phone acceptance.',results},null,2));
await browser.close();if(results.some(r=>!r.passed))process.exitCode=1;
})();
