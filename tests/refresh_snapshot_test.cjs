const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const script=fs.readFileSync(require('path').join(__dirname,'../app/src/main/assets/refresh-snapshot.js'),'utf8');
let links=[];
function card(id, options={}) {
  return {parentElement:options.parent||null,hidden:false,
    querySelector:()=>options.noPhoto?null:{},
    closest:()=>options.ad?{}:null,
    getAttribute:()=>options.href||'/marketplace/item/'+id+'/',
    getClientRects:()=>options.noRect?[]:[{}],display:options.display||'block'};
}
function sample(host='www.facebook.com') {
  return JSON.parse(JSON.stringify(vm.runInNewContext(script,{
    location:{hostname:host,href:'https://'+host+'/marketplace/'},URL,Set,
    document:{querySelectorAll:()=>links},
    getComputedStyle:p=>({display:p.display||'block',visibility:p.visibility||'visible'})
  })));
}
let cases=0;function test(name,fn){fn();cases++;console.log('PASS:',name)}
test('duplicate photo links do not inflate listing counts',()=>{links=[card(1),card(1),card(2)];assert.deepEqual(sample(),['1','2'])});
test('hidden old React tree and advertisements are excluded',()=>{links=[card(1,{parent:{display:'none'}}),card(2,{ad:true}),card(3)];assert.deepEqual(sample(),['3'])});
test('late replacement yields new IDs in actual DOM order',()=>{links=[card(3),card(1)];assert.deepEqual(sample(),['3','1']);links=[card(8),card(9)];assert.deepEqual(sample(),['8','9'])});
test('external lookalike URLs and unrelated images are excluded',()=>{links=[card(1,{href:'https://facebook.com.evil.test/marketplace/item/1/'}),card(2,{noPhoto:true}),card(3)];assert.deepEqual(sample(),['3'])});
test('empty and detached layouts are not treated as successful listing results',()=>{links=[card(1,{noRect:true})];assert.deepEqual(sample(),[])});
test('sample is bounded while preserving original order',()=>{links=Array.from({length:100},(_,i)=>card(i+1));assert.equal(sample().length,40);assert.equal(sample()[39],'40')});
test('untrusted pages do not expose listing data',()=>assert.deepEqual(sample('example.com'),[]));
console.log('PASS:',cases,'refresh snapshot fixtures; no live Facebook or Android test');
