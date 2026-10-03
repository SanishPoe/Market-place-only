/* Controlled DOM fixtures, not a logged-in Facebook acceptance test. */
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('playwright');
const base=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(base,'app/src/main/assets/marketplace.css'),'utf8');
const js=fs.readFileSync(path.join(base,'app/src/main/assets/marketplace.js'),'utf8');
const image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="220"><rect width="320" height="220" fill="#6c8275"/><path d="M0 150L150 80L320 140V220H0Z" fill="#2d4538"/><rect x="60" y="85" width="200" height="70" rx="14" fill="#e2af62"/><rect x="95" y="57" width="115" height="60" rx="18" fill="#e2af62"/><path d="M111 66H195V98H100Z" fill="#3b5c66"/><circle cx="99" cy="160" r="22" fill="#262b2d"/><circle cx="225" cy="160" r="22" fill="#262b2d"/></svg>');
function card(id,price,title){return `<div class="cell" style="width:600px;padding:14px"><div style="width:580px"><a href="/marketplace/item/${id}/" style="display:block;position:relative" onclick="event.preventDefault();window.clickedListing='${id}'"><div class="photo" style="position:relative;padding-top:70%;width:100%"><div><img src="${image}" style="position:absolute;inset:0;width:100%;height:100%"></div></div><div class="caption"><span>${price}</span><div><span>${title}</span></div><span>Gold Coast, QLD</span></div><button onclick="event.preventDefault();event.stopPropagation();window.savedItem='${id}'">Save</button></a></div></div>`;}
function fixture(){return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;font:16px Arial} [role=banner]{height:60px;background:red} [role=main]{margin-left:260px;width:900px}.items{display:flex;flex-wrap:wrap}.caption{padding:12px}.caption span{display:block}.photo>div{position:absolute;inset:0}button{border:0;background:#3a3b3c;color:white;border-radius:18px;padding:8px 12px}a{color:black;text-decoration:none}</style></head><body><div role="banner"><a href="/">Home feed</a> Reels Notifications Menu</div><div role="main"><div role="search"><h1>Marketplace</h1><button onclick="window.locationClicked=true" aria-label="Change location">Gold Coast · 250 km</button><input placeholder="Search Marketplace"></div><div class="items">${card('1','$2,500','1982 Jeep Cherokee')}${card('2','$4,000','2016 Ford Falcon')}${card('3','$300','Engel 40L camp fridge')}${card('4','$900','2014 Mitsubishi sedan')}</div></div></body></html>`;}
async function style(page){await page.evaluate(v=>{window.__marketOnlyCss=v;window.__marketOnlyHideAds=false},css);await page.evaluate(fs.readFileSync(path.join(base,'app/src/main/assets/adblock.js'),'utf8'));await page.evaluate(fs.readFileSync(path.join(base,'app/src/main/assets/media.js'),'utf8'));await page.evaluate(js);await page.waitForTimeout(400);}
let count=0;
async function test(name,fn){await fn();count++;console.log('PASS:',name);}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.TEST_CHROME||chromium.executablePath(),headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:384,height:760},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>r.fulfill({status:200,contentType:'text/html',body:fixture()}));
 await page.goto('https://www.facebook.com/marketplace/');await style(page);
 await test('phone listing grid has two equal columns and square photos',async()=>{
  const rects=await page.locator('[data-mo-cell]').evaluateAll(els=>els.map(e=>({x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,w:e.getBoundingClientRect().width})));
  assert.equal(rects.length,4);assert(Math.abs(rects[0].w-190)<1);assert.equal(rects[0].y,rects[1].y);assert(rects[2].y>rects[0].y);assert.equal(rects[2].x,rects[0].x);
  const pic=await page.locator('[data-mo-photo]').first().boundingBox();assert(Math.abs(pic.width-pic.height)<1);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 });
 await test('global feed navigation is removed',async()=>assert.equal(await page.locator('[role=banner]').isVisible(),false));
 await test('original listing title and price remain accurate',async()=>assert.equal(await page.locator('[data-mo-summary-title]').first().textContent(),'$2,500 · 1982 Jeep Cherokee'));
 await test('listing action still uses the original live anchor',async()=>{await page.locator('[data-mo-summary]').first().click();assert.equal(await page.evaluate(()=>window.clickedListing),'1');});
 await test('original Save action remains usable',async()=>{await page.locator('button').filter({hasText:'Save'}).first().click();assert.equal(await page.evaluate(()=>window.savedItem),'1');});
 await test('location control routes to the actual page control',async()=>{assert(await page.evaluate(()=>window.__marketOnlyAction('location')));assert(await page.evaluate(()=>window.locationClicked));});
 await test('categories and filters can be restored',async()=>{assert(await page.evaluate(()=>window.__marketOnlyAction('controls')));assert(await page.locator('[role=search]').isVisible());await page.evaluate(()=>window.__marketOnlyAction('controls'));});
 await test('newly loaded listings adopt the grid',async()=>{
  await page.evaluate(html=>document.querySelector('.items').insertAdjacentHTML('beforeend',html),card('5','$850','Tools and equipment'));
  await page.waitForTimeout(400);assert.equal(await page.locator('[data-mo-cell]').count(),5);
  assert(Math.abs((await page.locator('[data-mo-cell]').last().boundingBox()).width-190)<1);
 });
 await test('320px screen keeps two columns without sideways scrolling',async()=>{
  await page.setViewportSize({width:320,height:740});await page.waitForTimeout(100);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert(Math.abs((await page.locator('[data-mo-cell]').first().boundingBox()).width-158)<1);
 });
 await test('reinjecting does not duplicate summary captions',async()=>{await page.evaluate(js);assert.equal(await page.locator('[data-mo-summary]').count(),5);});
 await test('details page retains original layout',async()=>{
  await page.goto('https://www.facebook.com/marketplace/item/1/');await style(page);
  assert.equal(await page.locator('html').getAttribute('data-mo-page'),'detail');assert.equal(await page.locator('[data-mo-grid]').count(),0);
 });
 await test('login and password forms remain untouched',async()=>{
  await page.goto('https://www.facebook.com/login/');await page.locator('body').evaluate(e=>e.insertAdjacentHTML('beforeend','<input type="password">'));await style(page);
  assert.equal(await page.locator('html').getAttribute('data-mo-page'),null);assert(await page.locator('input[type=password]').isVisible());
 });
 await test('saved items use the same two-column layout',async()=>{
  await page.goto('https://www.facebook.com/marketplace/you/saved/');await style(page);assert.equal(await page.locator('[data-mo-cell]').count(),4);
 });
 await test('no runtime JavaScript exceptions',async()=>assert.deepEqual(errors,[]));
 await page.setViewportSize({width:384,height:800});await page.goto('https://www.facebook.com/marketplace/');await style(page);
 // Visual fixture includes an HTML representation of the separately compiled native toolbar.
 await page.evaluate(()=>{
  const head=document.createElement('div');head.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;padding:0 12px;height:50px"><strong style="font:700 26px Arial">Marketplace</strong><span style="font:24px Arial">◉ ⌕ ⋯</span></div><div style="display:flex;align-items:center;justify-content:space-around;height:46px;font-weight:bold;font-size:16px"><span>Sell</span><span style="padding:12px 15px;background:#263f57;border-radius:28px;color:#65aeff">Explore</span><span>Saved</span><span>More ⌄</span><span>⌖</span></div>`;
  head.style.cssText='background:#242526;color:#e4e6eb';document.body.prepend(head);
 });
 const output=path.join(base,'test-output');fs.mkdirSync(output,{recursive:true});
 await page.screenshot({path:path.join(output,'layout-fixture.png')});
 fs.writeFileSync(path.join(output,'layout-results.json'),JSON.stringify({passed:count,scope:'Controlled browser fixtures only. Not a live Facebook or native Android runtime test.'},null,2));
 await browser.close();console.log(`PASS: ${count} browser layout checks`);
})().catch(e=>{console.error(e);process.exit(1)});
