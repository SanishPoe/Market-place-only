const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const base=path.resolve(__dirname,'..'),asset=fs.readFileSync(path.join(base,'app/src/main/assets/listing-tools.js'),'utf8');
const card=(id,content,attrs='')=>`<section class="card" ${attrs}><a href="/marketplace/item/${id}/?ref=test"><div class="photo"></div>${content}</a></section>`;
const template=content=>`<!doctype html><html><head><meta charset="utf-8"><style>body{font:16px Arial}.card{width:170px;display:inline-block;vertical-align:top}span{display:block}.photo{height:120px;background:#ddd}[data-mo-ad-hidden]{display:none}main{min-height:2500px}</style></head><body><main>${content}</main></body></html>`;
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.TEST_CHROME,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:360,height:628}});let html='';
 await page.route('**/*',r=>r.fulfill({contentType:'text/html',body:html}));
 const results=[];async function test(name,fn){await fn();results.push({name,passed:true});console.log('PASS:',name)}
 async function setup(content,url='https://www.facebook.com/marketplace/search/?query=Holden%20Cruze'){html=template(content);await page.goto(url);await page.evaluate(asset);}
 const snapshot=()=>page.evaluate(()=>window.__moListingSnapshot());
 await test('standard cards: current asking price, exact title, location, explicit repair words',async()=>{
  await setup(card(1,'<span>A$4,500</span><span>2014 Holden Cruze</span><span>Gold Coast, QLD</span>')+card(2,'<span>$900</span><s>$1,200</s><span>2009 Ford needs an engine</span><span>Brisbane, QLD</span>'));
  const rows=await snapshot();assert.equal(rows.length,2);assert.equal(rows[0].price,4500);assert.equal(rows[0].title,'2014 Holden Cruze');assert.equal(rows[0].url,'https://www.facebook.com/marketplace/item/1/');assert.equal(rows[1].price,900);assert.match(rows[1].notes,/needs an engine/);
 });
 await test('compact summaries and duplicate image/title links do not create duplicates',async()=>{
  await setup(card(3,'<div data-mo-summary><div data-mo-summary-title>$1,000 · 2019 Subaru Outback</div><div data-mo-summary-location>Murphys Creek, QLD</div></div>')+'<a href="/marketplace/item/3/">2019 Subaru Outback</a>');
  const rows=await snapshot();assert.equal(rows.length,1);assert.equal(rows[0].price,1000);assert.equal(rows[0].place,'Murphys Creek, QLD');
 });
 await test('hidden adverts, old crossed-out prices and foreign currency cannot become cheap comparisons',async()=>{
  await setup(card(4,'<span>$300</span><span>Advert</span>','data-mo-ad-hidden')+card(5,'<span>US$600</span><span>US car</span>')+card(6,'<s>$800</s><span>$700</span><span>Table</span>'));
  const rows=await snapshot();assert.equal(rows.length,1);assert.equal(rows[0].price,700);
 });
 await test('missing location stays unknown; Free remains zero',async()=>{
  await setup(card(7,'<span>Free</span><span>Old cabinet</span>'));const [row]=await snapshot();assert.equal(row.price,0);assert.equal(row.place,'');
 });
 await test('newly loaded and recycled listing data are read afresh',async()=>{
  await page.locator('main').evaluate((e,c)=>e.innerHTML=c,card(8,'<span>$99</span><span>New chair</span>'));const [row]=await snapshot();assert.equal(row.title,'New chair');assert.equal(row.url,'https://www.facebook.com/marketplace/item/8/');
 });
 await test('detail extraction uses listing heading and asking price, not message contents',async()=>{
  await setup('<section><h1>2014 Holden Cruze</h1><span>A$4,500</span><span>Listed 2 hours ago in Gold Coast, QLD</span></section><textarea>My private message $200</textarea><section>Seller information $1</section>','https://www.facebook.com/marketplace/item/1/');
  const [row]=await snapshot();assert.equal(row.title,'2014 Holden Cruze');assert.equal(row.price,4500);assert.equal(row.place,'Gold Coast, QLD');assert(!JSON.stringify(row).includes('private'));
 });
 await test('click intercept runs before SPA navigation; query and scrolled document remain intact',async()=>{
  await setup(card(9,'<span>$2,000</span><span>Car</span>'));
  await page.evaluate(()=>{history.pushState({saved:true},'',location.href);window.scrollTo(0,700);document.querySelector('a').addEventListener('click',e=>{e.preventDefault();history.replaceState({},'','/marketplace/item/9/');window.wasReplaced=true;});});
  const before=await page.url();await page.evaluate(()=>document.querySelector('a').dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:0})));
  assert.equal(page.url(),before);assert.equal(await page.evaluate(()=>!!window.wasReplaced),false);assert.equal(await page.evaluate(()=>scrollY),700);
 });
 await test('reinjection does not duplicate snapshot hooks or change listing DOM',async()=>{
  const before=await page.locator('main').innerHTML();await page.evaluate(asset);assert.equal(await page.locator('main').innerHTML(),before);assert.equal((await snapshot()).length,1);
 });
 await test('long feeds collect the newly reached cards beyond the initial hundred',async()=>{
  await setup(Array.from({length:160},(_,i)=>card(i+100,'<span>$500</span><span>Vehicle '+(i+100)+'</span>')).join(''));
  await page.locator('a[href*="/259/"]').scrollIntoViewIfNeeded();const rows=await snapshot();assert(rows.some(r=>r.url.endsWith('/259/')));assert(rows.length<100);
 });
 await test('title links split from photos and a query changed by Facebook remain supported',async()=>{
  await setup('<section><a href="/marketplace/item/42/"><div class="photo"></div></a><a href="/marketplace/item/42/"><span>$2,500</span><span>BMW 320d</span><span>Brisbane, QLD</span></a></section>');
  await page.evaluate(()=>history.replaceState({},'', '/marketplace/search/?query=BMW&sortBy=price_ascend'));
  const rows=await snapshot();assert.equal(rows.length,1);assert.equal(rows[0].title,'BMW 320d');assert.equal(rows[0].price,2500);
 });
 await test('non-Marketplace pages expose no catalogue',async()=>{
  await setup(card(1,'<span>$400</span><span>Private feed item</span>'),'https://www.facebook.com/login/');assert.deepEqual(await snapshot(),[]);
 });
 await browser.close();fs.writeFileSync(path.join(base,'test-output/listing-tools-results.json'),JSON.stringify({scope:'Controlled Chromium DOM and click fixtures; not Facebook or Android device acceptance',results},null,2));
})().catch(e=>{console.error(e);process.exit(1)});
