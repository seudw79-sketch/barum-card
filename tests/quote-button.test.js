import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function load(file){
  const hook={};const ctx={URLSearchParams,window:{__BARUM_TEST__:hook},document:{querySelector:()=>null,querySelectorAll:()=>[]},fetch:()=>new Promise(()=>{}),navigator:{userAgent:''}};
  ctx.globalThis=ctx;vm.createContext(ctx);
  try{vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),ctx);}catch(e){/* files may stop early when the page has no #calc / form; the hook is set before that */}
  return hook;
}
const calc=load('calc.js'), quote=load('quote.js');
test('calc exposes quoteHref',()=>assert.equal(typeof calc.quoteHref,'function'));
test('aircon request link carries service, size and notes',()=>{
  const u=new URL(calc.quoteHref('aircon','벽걸이 2대','[바름클린 견적 문의] 에어컨 분해청소 / 벽걸이 2대 (예상 160,000원)'),'https://x.test');
  assert.equal(u.pathname,'/quote');assert.equal(u.searchParams.get('service'),'에어컨');assert.equal(u.searchParams.get('size'),'벽걸이 2대');assert.match(u.searchParams.get('notes'),/예상 160,000원/);
});
test('every tab maps to a form service value',()=>{for(const [tab,svc] of [['regular','정기청소'],['room','원룸청소'],['aircon','에어컨'],['window','외창'],['repair','작은집수리']])assert.equal(new URL(calc.quoteHref(tab,'',''),'https://x.test').searchParams.get('service'),svc);});
test('nothing selected still links to /quote with the service only (never a dead end)',()=>{assert.equal(calc.quoteHref('aircon','',''),'/quote?service=%EC%97%90%EC%96%B4%EC%BB%A8');});
test('unknown tab falls back to plain /quote',()=>assert.equal(calc.quoteHref('nope','a','b'),'/quote'));
test('length is clamped to the form limits',()=>{const u=new URL(calc.quoteHref('repair','가'.repeat(300),'나'.repeat(2000)),'https://x.test');assert.ok(u.searchParams.get('size').length<=100);assert.ok(u.searchParams.get('notes').length<=900);});
test('special characters survive the round trip',()=>{const n='a&b=c#d?e 50%';assert.equal(new URL(calc.quoteHref('room','',n),'https://x.test').searchParams.get('notes'),n);});
test('quote page parses and validates query params',()=>{
  assert.equal(typeof quote.parseQuery,'function');
  const p=quote.parseQuery('?service=%EC%97%90%EC%96%B4%EC%BB%A8&size=2%EB%8C%80&notes=hello');
  assert.deepEqual(Array.from(p.services),['에어컨']);assert.equal(p.size,'2대');assert.equal(p.notes,'hello');
});
test('quote page ignores unknown services and clamps lengths',()=>{
  const p=quote.parseQuery('?service=evil&service=%EC%99%B8%EC%B0%BD&size='+'x'.repeat(500)+'&notes='+'y'.repeat(3000));
  assert.deepEqual(Array.from(p.services),['외창']);assert.ok(p.size.length<=100);assert.ok(p.notes.length<=1000);
});
test('empty or missing query gives empty prefill',()=>{const p=quote.parseQuery('');assert.deepEqual(Array.from(p.services),[]);assert.equal(p.size,'');assert.equal(p.notes,'');});
