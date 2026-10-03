/* Touch checks use the exact bundled fullscreen document, not an Android emulator. */
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('playwright');
const base=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(base,'app/src/main/assets/photo-viewer.html'),'utf8');
const image='<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="#668271"/></svg>';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.TEST_CHROME||chromium.executablePath(),args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:360,height:576},isMobile:true,hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>r.fulfill({status:200,contentType:r.request().resourceType()==='image'?'image/svg+xml':'text/html',body:r.request().resourceType()==='image'?image:html.replace('__PHOTO_URL__','https://scontent.example.fbcdn.net/full-photo.jpg')}));
 const session=await page.context().newCDPSession(page),results=[];
 async function reset(){await page.goto('https://www.facebook.com/_marketonly_viewer_fixture');await page.evaluate(()=>{window.steps=[];window.__marketOnlyPhotoStep=d=>window.steps.push(d)})}
 async function swipe(x1,y1,x2,y2){await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x1,y:y1}]});for(let i=1;i<=8;i++){await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x1+(x2-x1)*i/8,y:y1+(y2-y1)*i/8}]});await page.waitForTimeout(20)}await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(160)}
 async function test(name,fn){try{await reset();await fn();results.push({name,passed:true});console.log('PASS:',name)}catch(e){results.push({name,passed:false,error:e.message});console.error('FAIL:',name,e.message)}}
 await test('fullscreen photo fits inside the viewport without cropping',async()=>{assert(await page.locator('img').evaluate(e=>e.complete&&e.naturalWidth>0));assert.equal(await page.locator('img').evaluate(e=>getComputedStyle(e).objectFit),'contain');assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight),576)});
 await test('swiping left and right asks for next and previous photos once',async()=>{await swipe(290,270,80,280);await swipe(80,280,290,270);assert.deepEqual(await page.evaluate(()=>steps),[1,-1])});
 await test('vertical and short gestures do not switch photos',async()=>{await swipe(180,390,182,110);await swipe(180,260,205,264);assert.deepEqual(await page.evaluate(()=>steps),[])});
 await test('pinch zoom increases image scale without switching photos',async()=>{
   await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:0,x:150,y:270},{id:1,x:210,y:270}]});
   for(let i=1;i<=8;i++){await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:0,x:150-i*12,y:270},{id:1,x:210+i*12,y:270}]});await page.waitForTimeout(30)}
   await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(250);
   assert(await page.evaluate(()=>visualViewport.scale>1.2),'Pinch must actually zoom the image');assert.deepEqual(await page.evaluate(()=>steps),[]);
   await swipe(270,270,80,275);assert.deepEqual(await page.evaluate(()=>steps),[],'Zoomed panning must not switch photos');
 });
 await test('returning to normal zoom restores photo swiping',async()=>{await session.send('Emulation.setPageScaleFactor',{pageScaleFactor:2});await swipe(270,270,80,275);assert.deepEqual(await page.evaluate(()=>steps),[]);await session.send('Emulation.setPageScaleFactor',{pageScaleFactor:1});await swipe(270,270,80,275);assert.deepEqual(await page.evaluate(()=>steps),[1])});
 await test('cancelled touches never trigger navigation',async()=>{await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:270,y:270}]});await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:110,y:270}]});await session.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert.deepEqual(await page.evaluate(()=>steps),[])});
 await test('photo-only CSP blocks untrusted images and page navigation markup',async()=>{assert(html.includes("default-src 'none'"));assert(html.includes("form-action 'none'"));assert(!html.includes('http://'));assert.deepEqual(errors,[])});
 fs.writeFileSync(path.join(base,'test-output/viewer-results.json'),JSON.stringify({scope:'Exact photo-viewer HTML in Chromium with real touch events, including pinch. Android dialog and WebView-to-page navigation bridge are compiled but not run on a phone.',results},null,2));await browser.close();if(results.some(r=>!r.passed))process.exitCode=1;
})();
