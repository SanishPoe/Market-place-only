/* Scroll regression fixtures: no Facebook account or external requests. */
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('playwright');
const base=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(base,'app/src/main/assets/marketplace.css'),'utf8');
const layout=fs.readFileSync(path.join(base,'app/src/main/assets/marketplace.js'),'utf8');
const guard=fs.readFileSync(path.join(base,'app/src/main/assets/focus.js'),'utf8');
const image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#657965"/></svg>');
function fixture(kind){
  const nested=kind==='panel',detail=kind==='detail',dialog=kind==='dialog';
  // Fixed-height body + root horizontal clipping is a valid desktop page layout.
  // Forcing overflow-x:hidden onto body silently makes it another vertical scroller.
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">
  <style>html{height:100%;overflow-x:hidden}body{height:100%;margin:0;font:16px Arial}
  ${nested||dialog?'html,body{overflow:hidden}':''}
  main{${nested?'height:100%;overflow-y:auto;':''}}.items{display:flex;flex-wrap:wrap}.cell{width:100%}
  a{display:block;color:inherit}.photo{height:200px}.photo img{width:200px;height:200px}.caption span{display:block}
  .long{height:2800px;background:linear-gradient(#3a3b3c,#263f57)}button{padding:16px}
  [role=dialog]{position:fixed;inset:20px;background:#242526;color:white}.dialog-scroll{height:100%;overflow:auto}</style></head>
  <body><div role="banner">Facebook</div><main role="main">
  ${detail?'<article><div class="long">Listing description</div><button id="bottom" onclick="window.bottomClicked=true">Contact seller</button></article>':'<div class="items"></div>'}
  </main>${dialog?'<div role="dialog"><div class="dialog-scroll"><div class="long">Filters</div><button id="bottom" onclick="window.bottomClicked=true">Apply filters</button></div></div>':''}
  <script>
  window.loaded=0;window.scrollEvents=0;
  function appendBatch(){let html='';for(let n=0;n<6;n++){const id=++window.loaded;
    html+='<div class="cell"><a href="/marketplace/item/'+id+'/"><div class="photo"><img src="${image}"></div><div class="caption"><span>$'+id+'00</span><span>Listing '+id+'</span></div></a></div>';}
    document.querySelector('.items').insertAdjacentHTML('beforeend',html);
    if(window.loaded===30)document.querySelector('main').insertAdjacentHTML('beforeend','<button id="bottom" onclick="window.bottomClicked=true">End of loaded results</button>');}
  ${!detail&&!dialog?`appendBatch();
  const owner=${nested?'document.querySelector("main")':'document.scrollingElement'};
  ${nested?'owner':'window'}.addEventListener('scroll',()=>{
    window.scrollEvents++;
    if(owner.scrollTop+owner.clientHeight>=owner.scrollHeight-100&&window.loaded<30)appendBatch();
  });`:''}
  </script></body></html>`;
}
async function swipe(session,page){
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:180,y:580}]});
  for(let y=540;y>=180;y-=40){
    await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:180,y}]});
    await page.waitForTimeout(16);
  }
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
}
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.TEST_CHROME||chromium.executablePath(),args:['--no-sandbox']});
  const results=[];
  for(const test of [
    {name:'Explore loads five batches using the original window scroll listener',url:'/marketplace/',kind:'document'},
    {name:'Saved continues loading under touchscreen swipes',url:'/marketplace/you/saved/',kind:'document',touch:true},
    {name:'Search reaches the last result',url:'/marketplace/search/?query=car',kind:'document'},
    {name:'Nested panel keeps its original scroll owner and pagination',url:'/marketplace/',kind:'panel'},
    {name:'Listing description can scroll to its final action',url:'/marketplace/item/1/',kind:'detail',touch:true},
    {name:'Modal filters still scroll without unlocking the background',url:'/marketplace/',kind:'dialog'}
  ]){
    const page=await browser.newPage({viewport:{width:384,height:640},isMobile:true,hasTouch:true});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',r=>r.fulfill({status:200,contentType:'text/html',body:fixture(test.kind)}));
    try{
      await page.goto('https://www.facebook.com'+test.url);
      await page.evaluate(v=>{window.__marketOnlyCss=v},css);
      await page.evaluate(guard);await page.evaluate(fs.readFileSync(path.join(base,'app/src/main/assets/adblock.js'),'utf8'));await page.evaluate(fs.readFileSync(path.join(base,'app/src/main/assets/media.js'),'utf8'));await page.evaluate(layout);await page.evaluate(fs.readFileSync(path.join(base,'app/src/main/assets/detail.js'),'utf8'));await page.waitForTimeout(250);
      const session=await page.context().newCDPSession(page);
      await page.mouse.move(180,350);
      let reached=false;
      for(let i=0;i<24;i++){
        if(test.touch)await swipe(session,page);else await page.mouse.wheel(0,550);
        await page.waitForTimeout(200);
        reached=await page.evaluate(()=>{const e=document.querySelector('#bottom');if(!e)return false;
          const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;});
        if(reached)break;
      }
      const metrics=await page.evaluate(()=>({loaded:window.loaded,events:window.scrollEvents,window:scrollY,body:document.body.scrollTop,main:document.querySelector('main').scrollTop}));
      assert(reached,'Final action unreachable: '+JSON.stringify(metrics));
      if(test.kind==='document'||test.kind==='panel'){
        assert.equal(metrics.loaded,30);assert(metrics.events>0,'Original pagination listener must receive scrolls');
        if(test.kind==='document'){assert(metrics.window>0);assert.equal(metrics.body,0,'Do not create a second scroll owner');}
        else {assert(metrics.main>0);assert.equal(metrics.window,0);}
      }
      if(test.kind==='dialog')assert.equal(metrics.window,0,'Background should remain locked');
      // No auto-scrolling locator helper: use the button's actual on-screen position.
      const button=await page.locator('#bottom').boundingBox();
      await page.touchscreen.tap(button.x+button.width/2,button.y+button.height/2);
      assert(await page.evaluate(()=>window.bottomClicked));assert.deepEqual(errors,[]);
      results.push({name:test.name,passed:true});console.log('PASS:',test.name);
    }catch(e){results.push({name:test.name,passed:false,error:e.message});console.error('FAIL:',test.name,e.message);}
    await page.close();
  }
  await browser.close();
  fs.mkdirSync(path.join(base,'test-output'),{recursive:true});
  fs.writeFileSync(path.join(base,'test-output','scroll-results.json'),JSON.stringify({scope:'Controlled Chromium fixtures, including touch input. Not an Android or authenticated Facebook test.',results},null,2));
  if(results.some(r=>!r.passed))process.exitCode=1;
})();
