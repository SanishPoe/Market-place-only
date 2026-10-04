const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const script = fs.readFileSync(path.join(__dirname,'../app/src/main/assets/focus.js'),'utf8');
let cases=0;
function fixture(href, {password=false, links=[], dialogLinks=[]}={}) {
  const events={}; const redirects=[]; const timers=[];
  const location={href, hostname:new URL(href).hostname, pathname:new URL(href).pathname,
    replace(v){redirects.push(v)}};
  const anchors=links.map(value=>({href:value,attrs:{},style:{display:'',setProperty(k,v){this[k]=v}},
    getAttribute(name){return name==='href'?this.href:this.attrs[name]??null},
    hasAttribute(name){return name in this.attrs},setAttribute(name,value){this.attrs[name]=value},removeAttribute(name){delete this.attrs[name]}}));
  const document={documentElement:{style:{},appendChild(){}},head:{appendChild(){}},
    querySelector(){return password?{}:null},
    querySelectorAll(selector){
      if(selector==='a[href]')return anchors;
      if(selector==='[role="dialog"] a[href]')return dialogLinks.map(href=>({href}));
      return [];
    },createElement(){return{}}, addEventListener(k,fn){events[k]=fn}};
  const history={pushState(){},replaceState(){}};
  const context={location,document,history,URL,Date,encodeURIComponent,
    setTimeout(fn){timers.push(fn);return timers.length},clearTimeout(){},
    Event:class{constructor(type){this.type=type}},dispatchEvent(e){events[e.type]?.(e)},addEventListener(k,fn){events[k]=fn},
    MutationObserver:class{observe(){}}};
  context.window=context;vm.createContext(context);vm.runInContext(script,context);
  return {context,location,document,events,anchors,redirects,timers};
}
function test(label,fn){fn();cases++;console.log('PASS:',label)}
test('Facebook home redirects to Marketplace',()=>{
  const f=fixture('https://www.facebook.com/');assert.deepEqual(f.redirects,['https://www.facebook.com/marketplace/']);
});
test('login form is not hidden or redirected',()=>{
  const f=fixture('https://www.facebook.com/',{password:true});assert.equal(f.redirects.length,0);
});
test('checkpoint remains usable',()=>assert.equal(fixture('https://www.facebook.com/checkpoint/1').redirects.length,0));
test('Saved and Marketplace result links remain visible',()=>{
  const f=fixture('https://www.facebook.com/marketplace/',{links:['https://www.facebook.com/','https://www.facebook.com/reel/1','https://www.facebook.com/marketplace/item/99','https://www.facebook.com/saved/']});
  assert(f.anchors[0].hasAttribute('data-mo-focus-hidden'));assert(f.anchors[1].hasAttribute('data-mo-focus-hidden'));
  assert.equal(f.anchors[0].style.display,'');assert.equal(f.anchors[1].style.display,'');
  assert.equal(f.anchors[2].style.display,'');assert.equal(f.anchors[3].style.display,'');
});
test('a recycled feed anchor becomes visible when it becomes a listing',()=>{
  const f=fixture('https://www.facebook.com/marketplace/',{links:['https://www.facebook.com/reels/']});
  const a=f.anchors[0];assert(a.hasAttribute('data-mo-focus-hidden'));
  a.href='https://www.facebook.com/marketplace/item/88/';f.context.__marketOnlySweep();
  assert(!a.hasAttribute('data-mo-focus-hidden'));assert.equal(a.style.display,'');
  a.href='https://www.facebook.com/watch/';f.context.__marketOnlySweep();assert(a.hasAttribute('data-mo-focus-hidden'));
});
test('authentication restores focus-hidden nodes without changing their inline styles',()=>{
  const f=fixture('https://www.facebook.com/marketplace/',{links:['https://www.facebook.com/watch/']});
  const a=f.anchors[0];assert(a.hasAttribute('data-mo-focus-hidden'));
  f.location.pathname='/checkpoint/123';f.context.__marketOnlySweep();
  assert(!a.hasAttribute('data-mo-focus-hidden'));assert.equal(a.style.display,'');
});
test('SPA navigation to feed is blocked',()=>{
  const f=fixture('https://www.facebook.com/marketplace/'); f.context.history.pushState(null,'','/watch/');assert.equal(f.redirects.length,1);
});
test('allowed SPA navigation notifies other installed Marketplace features',()=>{
  const f=fixture('https://www.facebook.com/marketplace/');let notified=0;
  f.context.addEventListener('marketonly:navigation',()=>notified++);
  f.context.history.pushState(null,'','/marketplace/you/saved/');assert.equal(notified,1);
});
test('retained background views defer sweeps until activity resumes',()=>{
  const f=fixture('https://www.facebook.com/marketplace/',{links:['https://www.facebook.com/reels/']});
  const a=f.anchors[0];f.context.__marketOnlyActive=false;f.events['marketonly:activity']();
  a.href='https://www.facebook.com/marketplace/item/88/';f.context.__marketOnlySweep();
  assert(a.hasAttribute('data-mo-focus-hidden'));
  f.context.__marketOnlyActive=true;f.events['marketonly:activity']();f.context.__marketOnlySweep();
  assert(!a.hasAttribute('data-mo-focus-hidden'));
});
test('SPA Messenger thread keeps exact destination',()=>{
  const f=fixture('https://www.facebook.com/marketplace/'); f.context.history.pushState(null,'','/messages/t/123');
  assert.equal(new URL(f.location.href).searchParams.get('url'),'https://www.facebook.com/messages/t/123');
});
test('Messenger anchor click is routed without sending a message',()=>{
  const f=fixture('https://www.facebook.com/marketplace/item/1');let blocked=0;
  f.events.click({target:{closest(s){return s==='a[href]'?{href:'https://m.me/seller'}:null}},preventDefault(){blocked++},stopImmediatePropagation(){blocked++}});
  assert.equal(blocked,2);assert.equal(new URL(f.location.href).searchParams.get('url'),'https://m.me/seller');
});
test('unknown seller button keeps Facebook composer available',()=>{
  const f=fixture('https://www.facebook.com/marketplace/item/1');let blocked=0;
  f.events.click({target:{closest(s){return s==='a[href]'?null:{getAttribute(){return'Message seller'},textContent:''}}},preventDefault(){blocked++},stopImmediatePropagation(){blocked++}});
  assert.equal(blocked,0);assert.equal(f.location.href,'https://www.facebook.com/marketplace/item/1');
});
test('dialog thread routes only after explicit message action',()=>{
  const f=fixture('https://www.facebook.com/marketplace/item/1',{dialogLinks:['https://www.facebook.com/messages/t/999']});
  assert.equal(f.location.href,'https://www.facebook.com/marketplace/item/1');
  f.events.click({target:{closest(s){return s==='a[href]'?null:{getAttribute(){return'Message seller'},textContent:''}}},preventDefault(){},stopImmediatePropagation(){}});
  f.context.__marketOnlySweep();assert.equal(new URL(f.location.href).searchParams.get('url'),'https://www.facebook.com/messages/t/999');
});
test('unrelated sites are not modified',()=>assert.equal(fixture('https://facebook.com.evil.test/').context.__marketOnlyInstalled,undefined));
console.log(`PASS: ${cases} guard behaviour fixtures (not a live Facebook test)`);
