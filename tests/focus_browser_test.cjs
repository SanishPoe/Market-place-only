/* Actual DOM mutation/restoration checks; no Facebook account is used. */
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{chromium}=require('playwright');
const base=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.TEST_CHROME||chromium.executablePath(),args:['--no-sandbox']});
 try {
  const page=await browser.newPage({viewport:{width:360,height:740}});const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<html><head></head><body><nav role="navigation" aria-label="Facebook">Feed nav</nav><a id="recycled" href="/reels/" style="display:inline-block;color:red">Listing</a></body></html>'}));
  await page.goto('https://www.facebook.com/marketplace/');
  await page.evaluate(fs.readFileSync(path.join(base,'app/src/main/assets/focus.js'),'utf8'));
  const link=page.locator('#recycled'),nav=page.locator('nav');
  assert(!await link.isVisible());assert(!await nav.isVisible());
  await link.evaluate(e=>e.href='/marketplace/item/42/');
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('#recycled')).display!=='none');
  assert.equal(await link.evaluate(e=>e.style.display),'inline-block');
  assert.equal(await link.evaluate(e=>getComputedStyle(e).color),'rgb(255, 0, 0)');
  await link.evaluate(e=>e.href='/watch/');
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('#recycled')).display==='none');
  await nav.evaluate(e=>e.setAttribute('aria-label','Marketplace filters'));
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('nav')).display!=='none');
  await link.evaluate(e=>e.href='/marketplace/item/43/');
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('#recycled')).display!=='none');
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(base,'test-output/focus-browser-results.json'),JSON.stringify({passed:true,scope:'Controlled browser DOM; no Facebook or Android login tested.'},null,2));
  console.log('PASS: href and navigation-role changes restore valid UI and preserve inline styles');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
