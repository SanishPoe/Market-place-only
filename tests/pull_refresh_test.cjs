const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const base=path.resolve(__dirname,'..'),script=fs.readFileSync(path.join(base,'app/src/main/assets/pull-refresh.js'),'utf8');
function fixture({pathname='/marketplace/',scroll=0,nested=0,control=false}={}) {
  const events={},root={appendChild(){},scrollTop:scroll};
  const parent={parentElement:root,scrollTop:nested,scrollHeight:900,clientHeight:600};
  const target={parentElement:parent,closest:()=>control?{}:null};
  const context={location:{hostname:'www.facebook.com',pathname,href:'https://www.facebook.com'+pathname},scrollY:scroll,
    Date:{now:()=>5000},document:{documentElement:root,scrollingElement:root,
      createElement:()=>({setAttribute(){},style:{}}),addEventListener:(name,fn)=>events[name]=fn},
    getComputedStyle:p=>({overflowY:p===parent?'auto':'visible'})};
  context.window=context;vm.runInNewContext(script,context);
  let prevented=0;
  function touch(name,x=100,y=100,count=1){events[name]({target,touches:Array.from({length:count},()=>({clientX:x,clientY:y})),cancelable:true,preventDefault(){prevented++}})}
  const pull=(dy=100,dx=0)=>{touch('touchstart');touch('touchmove',100+dx,100+dy);touch('touchend',0,0,0)};
  return {context,touch,pull,prevented:()=>prevented,refreshed:()=>context.location.href==='marketonly://refresh'};
}
const results=[];function test(name,fn){fn();results.push({name,passed:true});console.log('PASS:',name)}
test('long downward pull refreshes only on release',()=>{const f=fixture();f.touch('touchstart');f.touch('touchmove',100,200);assert(!f.refreshed());f.touch('touchend',0,0,0);assert(f.refreshed());assert.equal(f.prevented(),1)});
test('short pull keeps page and links',()=>{const f=fixture();f.pull(40);assert(!f.refreshed())});
test('normal scroll away from document top is never intercepted',()=>{const f=fixture({scroll:300});f.pull();assert(!f.refreshed());assert.equal(f.prevented(),0)});
test('nested results panel must also be at top',()=>{const f=fixture({nested:30});f.pull();assert(!f.refreshed());assert.equal(f.prevented(),0)});
test('nested results panel at top permits pull',()=>{const f=fixture({nested:0});f.pull();assert(f.refreshed())});
test('horizontal swipe remains with the page',()=>{const f=fixture();f.pull(25,100);assert(!f.refreshed());assert.equal(f.prevented(),0)});
test('pinch gesture cancels pull',()=>{const f=fixture();f.touch('touchstart');f.touch('touchmove',100,250,2);f.touch('touchend',0,0,0);assert(!f.refreshed());assert.equal(f.prevented(),0)});
test('listing photo viewer and Sell are excluded',()=>{for(const pathname of ['/marketplace/item/123/','/marketplace/create/item/']){const f=fixture({pathname});f.pull();assert(!f.refreshed());assert.equal(f.prevented(),0)}});
test('form controls and dialogs keep original touches',()=>{const f=fixture({control:true});f.pull();assert(!f.refreshed());assert.equal(f.prevented(),0)});
test('Saved and Search refresh without changing the route',()=>{for(const pathname of ['/marketplace/you/saved/','/marketplace/search/']){const f=fixture({pathname});f.pull();assert(f.refreshed())}});
test('pull retreat and touch cancellation do not refresh',()=>{let f=fixture();f.touch('touchstart');f.touch('touchmove',100,220);f.touch('touchmove',100,105);f.touch('touchend',0,0,0);assert(!f.refreshed());f=fixture();f.touch('touchstart');f.touch('touchmove',100,220);f.touch('touchcancel');f.touch('touchend',0,0,0);assert(!f.refreshed())});
test('navigation during gesture cancels refresh',()=>{const f=fixture();f.touch('touchstart');f.touch('touchmove',100,220);f.context.location.pathname='/marketplace/item/1/';f.touch('touchend',0,0,0);assert(!f.refreshed())});
fs.mkdirSync(path.join(base,'test-output'),{recursive:true});fs.writeFileSync(path.join(base,'test-output/pull-refresh-results.json'),JSON.stringify({scope:'DOM touch event fixtures; not Android device acceptance',results},null,2));
console.log('PASS:',results.length,'pull refresh gesture fixtures');
