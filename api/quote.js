import Busboy from 'busboy';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
export const config = { api: { bodyParser: false } };
const buckets = new Map();
const services = ['정기청소','원룸청소','에어컨','외창','작은집수리','기타'];
const fail = (status, code) => Object.assign(new Error(code), {status, code});
export function validate(fields, photos) {
  const get = key => fields[key]?.[0]?.trim() || '';
  if (get('website')) throw fail(400, 'honeypot');
  if (!/^010[- ]?\d{4}[- ]?\d{4}$/.test(get('phone'))) throw fail(400, 'phone');
  if (get('consent') !== 'yes') throw fail(400, 'consent');
  if (photos.length > 3) throw fail(400, 'photos');
  if (photos.reduce((n,p)=>n+p.length,0) >= 4000000) throw fail(413, 'size');
  if (!get('region') || get('region').length > 100) throw fail(400, 'region');
  if (!(fields.service?.length) || fields.service.length > 6 || fields.service.some(s=>!services.includes(s))) throw fail(400, 'service');
  for (const [key, values] of Object.entries(fields)) {
    if (!['service','size','region','date','name','phone','notes','consent','website'].includes(key) || (key !== 'service' && values.length !== 1) || values.some(v=>v.length > (key==='notes'?1000:100))) throw fail(400,'fields');
  }
  return get;
}
export function rateLimit(ip, now=Date.now()) {
  for (const [key,b] of buckets) if (b.until<=now) buckets.delete(key);
  const key=createHash('sha256').update(ip).digest('hex');
  const bucket=buckets.get(key)||{count:0,until:now+3600000};
  if(bucket.count>=5 || buckets.size>=10000 && !buckets.has(key)) throw fail(429,'rate');
  bucket.count++; buckets.set(key,bucket);
}
async function parse(req) {
  return new Promise((resolve,reject)=>{
    const fields={},photos=[]; let invalid=false,total=0;
    let parser;
    try { parser=Busboy({headers:req.headers,limits:{files:3,fileSize:3999999,fields:15,fieldSize:4000,parts:18}}); } catch {return reject(fail(400,'multipart'));}
    parser.on('field',(key,value,info)=>{if(info.valueTruncated) invalid=true;(fields[key]??=[]).push(value);});
    parser.on('file',(key,stream,info)=>{
      const chunks=[];
      if(key!=='photos'||info.mimeType!=='image/jpeg') invalid=true;
      stream.on('limit',()=>{invalid=true;});
      stream.on('data',chunk=>{total+=chunk.length;if(total>=4000000) invalid=true; if(total<4000000) chunks.push(chunk);});
      stream.on('end',()=>photos.push(Buffer.concat(chunks)));
    });
    for(const event of ['filesLimit','fieldsLimit','partsLimit']) parser.on(event,()=>{invalid=true;});
    parser.on('error',()=>reject(fail(400,'multipart')));
    req.on('aborted',()=>reject(fail(400,'multipart')));
    parser.on('close',()=>invalid?reject(fail(400,'upload')):resolve({fields,photos}));
    req.pipe(parser);
  });
}
async function telegram(method, body, multipart=false) {
  const response=await fetch(`https://api.telegram.org/bot${process.env.BARUM_TG_TOKEN}/${method}`,{method:'POST',headers:multipart?undefined:{'Content-Type':'application/json'},body:multipart?body:JSON.stringify(body),signal:AbortSignal.timeout(18000)});
  const result=await response.json();
  if(!response.ok||!result.ok) throw fail(502,'delivery');
  const messages=Array.isArray(result.result)?result.result:[result.result];
  if(messages.some(m=>String(m.chat.id)!==process.env.BARUM_TG_CHAT || String(m.message_thread_id)!==process.env.BARUM_TG_THREAD)) throw fail(502,'topic');
  // Receipt metadata only; never log contact details, uploaded content or credentials.
  console.info(JSON.stringify({event:method,ok:true,message_ids:messages.map(m=>m.message_id),topic_verified:true}));
  return messages.map(m=>m.message_id);
}
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST') {res.setHeader('Allow','POST');return res.status(405).json({ok:false,code:'method'});}
  let delivered=false;
  try {
    if(Number(req.headers['content-length'])>4100000) throw fail(413,'size');
    const {fields,photos}=await parse(req);
    const get=validate(fields,photos);
    for(const photo of photos) {
      try {const meta=await sharp(photo,{limitInputPixels:2560000}).metadata();if(meta.format!=='jpeg'||meta.width>1600||meta.height>1600) throw Error();await sharp(photo).stats();}catch{throw fail(400,'photo');}
    }
    rateLimit(String(req.headers['x-vercel-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0]);
    if(!['BARUM_TG_TOKEN','BARUM_TG_CHAT','BARUM_TG_THREAD'].every(k=>process.env[k])) throw fail(503,'configuration');
    const phone='+82'+get('phone').replace(/[- ]/g,'').slice(1);
    const text=`새 견적 신청\n서비스: ${fields.service.join(', ')}\n평수·대수: ${get('size')||'미입력'}\n지역: ${get('region')}\n희망 날짜·시간: ${get('date')||'협의'}\n이름: ${get('name')||'미입력'}\n연락처: ${phone}\n요청사항: ${get('notes')||'없음'}\n사진: ${photos.length}장\n개인정보 수집·이용 동의: 확인 (상담 종료 후 3개월)`;
    const common={chat_id:process.env.BARUM_TG_CHAT,message_thread_id:Number(process.env.BARUM_TG_THREAD)};
    const ids=await telegram('sendMessage',{...common,text,entities:[{type:'phone_number',offset:text.indexOf(phone),length:phone.length}]}); delivered=true;
    if(photos.length){
      const data=new FormData(); for(const [k,v] of Object.entries(common)) data.append(k,String(v));
      data.append('reply_parameters',JSON.stringify({message_id:ids[0]}));
      photos.forEach((photo,i)=>data.append(photos.length===1?'photo':`photo${i}`,new Blob([photo],{type:'image/jpeg'}),`quote-${i+1}.jpg`));
      if(photos.length>1) data.append('media',JSON.stringify(photos.map((_,i)=>({type:'photo',media:`attach://photo${i}`}))));
      ids.push(...await telegram(photos.length===1?'sendPhoto':'sendMediaGroup',data,true));
    }
    return res.status(200).json({ok:true,receipt:{message_ids:ids,topic_verified:true}});
  } catch(error) {return res.status(error.status||502).json({ok:false,code:error.code||'delivery',partial:delivered});}
}
