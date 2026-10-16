import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validate,rateLimit} from '../api/quote.js';
const fields=()=>({phone:['010-0000-0000'],consent:['yes'],region:['시흥시 정왕동'],service:['정기청소']});
for(const [name,change] of [['missing phone',f=>delete f.phone],['bad phone',f=>f.phone=['123']],['no consent',f=>delete f.consent],['honeypot filled',f=>f.website=['spam']]])test(name,()=>{const f=fields();change(f);assert.throws(()=>validate(f,[]));});
test('more than 3 photos',()=>assert.throws(()=>validate(fields(),Array(4).fill(Buffer.from('x')))));
test('valid multi-service',()=>{const f=fields();f.service.push('에어컨');assert.equal(validate(f,[])('phone'),'010-0000-0000');});
test('five per hour and expiry',()=>{for(let i=0;i<5;i++)rateLimit('test',100);assert.throws(()=>rateLimit('test',101),e=>e.status===429);rateLimit('test',3600101);});
import handler from '../api/quote.js';
import sharp from 'sharp';
import {Readable} from 'node:stream';
test('multipart handler sends single photo and albums to specified topic',async()=>{
 const originalFetch=globalThis.fetch;
 Object.assign(process.env,{BARUM_TG_TOKEN:'test-only',BARUM_TG_CHAT:'-1',BARUM_TG_THREAD:'7'});
 const photo=await sharp({create:{width:8,height:8,channels:3,background:'#12365e'}}).jpeg().toBuffer();
 try{
 for(const count of [1,2,3]){
  const calls=[];
  globalThis.fetch=async(url,options)=>{calls.push({method:url.split('/').pop(),body:options.body});return {ok:true,json:async()=>({ok:true,result:{message_id:42,chat:{id:-1},message_thread_id:7}})};};
  const data=new FormData();for(const [key,values] of Object.entries(fields()))for(const v of values)data.append(key,v);
  for(let i=0;i<count;i++)data.append('photos',new Blob([photo],{type:'image/jpeg'}),'test.jpg');
  const request=new Request('http://localhost',{method:'POST',body:data});
  const req=Readable.from([Buffer.from(await request.arrayBuffer())]);req.headers={'content-type':request.headers.get('content-type')};req.method='POST';req.socket={remoteAddress:'integration'+count};
  const res={setHeader(){},status(s){this.code=s;return this;},json(v){this.body=v;return this;}};
  await handler(req,res);assert.equal(res.code,200);assert.deepEqual(calls.map(c=>c.method),['sendMessage',count===1?'sendPhoto':'sendMediaGroup']);assert.equal(JSON.parse(calls[0].body).message_thread_id,7);assert.equal(calls[1].body.get('message_thread_id'),'7');
 }
 }finally{globalThis.fetch=originalFetch;for(const key of ['BARUM_TG_TOKEN','BARUM_TG_CHAT','BARUM_TG_THREAD'])delete process.env[key];}
});
