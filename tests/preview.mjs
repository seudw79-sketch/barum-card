import {chromium} from '@playwright/test';
import sharp from 'sharp';
import {mkdir,writeFile} from 'node:fs/promises';
const local=process.env.LOCAL_UI==='1';
const url=process.env.PREVIEW_URL;
const dir='/Users/sdw79/SDWjavis/청소업/견적신청/evidence';await mkdir(dir,{recursive:true});
await sharp({create:{width:2000,height:1000,channels:3,background:'#12365e'}}).jpeg().toFile(`${dir}/test-photo.jpg`);
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
if(local)await page.route('**/api/quote',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,mocked:true})}));
await page.goto(url+'/quote');await page.screenshot({path:`${dir}/form-mobile-full.png`,fullPage:true});await page.screenshot({path:`${dir}/form-mobile.png`});
if(await page.locator('h1').textContent()!=='견적 신청')throw Error('Preview inaccessible');
await page.locator('[name=service]').first().check();await page.locator('[name=region]').fill('시흥시 정왕동');await page.locator('[name=phone]').fill('010-0000-0000');await page.locator('[name=consent]').check();await page.locator('[name=notes]').fill('[테스트] 자비스 시험 접수 — 무시하세요');await page.locator('#photos').setInputFiles(`${dir}/test-photo.jpg`);
const receipt=page.waitForResponse(r=>r.url().endsWith('/api/quote')&&r.request().method()==='POST');await page.locator('button[type=submit]').click();const response=await receipt;const result=await response.json();console.log(local?'MOCKED_LOCAL_SUCCESS':'REAL_PREVIEW_SUBMISSION',response.status(),JSON.stringify(result));await writeFile(`${dir}/${local?"local-mock-receipt":"telegram-receipt"}.json`,JSON.stringify({status:response.status(),...result},null,2));
if(!result.ok)throw Error('Delivery failed');await page.locator('#success').waitFor({state:'visible'});await page.screenshot({path:`${dir}/success-mobile-full.png`,fullPage:true});await page.screenshot({path:`${dir}/success-mobile.png`});
await page.unroute('**/api/quote');await page.reload();await page.locator('[name=service]').first().check();await page.locator('[name=region]').fill('시흥시 정왕동');await page.locator('[name=phone]').fill('010-0000-0000');await page.locator('[name=consent]').check();
await page.route('**/api/quote',route=>route.fulfill({status:502,contentType:'application/json',body:'{"ok":false,"code":"delivery"}'}));await page.locator('button[type=submit]').click();await page.locator('#error').waitFor({state:'visible'});await page.screenshot({path:`${dir}/error-mobile-full.png`,fullPage:true});await page.screenshot({path:`${dir}/error-mobile.png`});
if(await page.locator('[name=phone]').inputValue()!=='010-0000-0000')throw Error('Lead lost');
console.log('ERROR_UI: simulated upstream failure; input retained, tel and sms available');
const results=[];
for(const name of ['missing phone','bad phone','no consent','honeypot filled','>3 photos']){
 const data=new FormData();for(const [k,v] of Object.entries({service:'정기청소',region:'시흥시 정왕동',phone:name==='missing phone'?'':name==='bad phone'?'123':'010-0000-0000',consent:name==='no consent'?'':'yes',website:name==='honeypot filled'?'spam':''}))data.append(k,v);
 if(name==='>3 photos')for(let i=0;i<4;i++)data.append('photos',new Blob([Buffer.from([255,216,255,217])],{type:'image/jpeg'}),'test.jpg');
 const raw=new Request(url+'/api/quote',{method:'POST',body:data});
 const r=await page.request.post(url+'/api/quote',{headers:{'content-type':raw.headers.get('content-type')},data:Buffer.from(await raw.arrayBuffer())});
 results.push({test:name,status:r.status(),body:await r.json()});if(r.status()!==400)throw Error('Validation failed '+name);
}
console.log(JSON.stringify(results,null,2));await writeFile(`${dir}/${local?"local-validation":"preview-validation"}.json`,JSON.stringify(results,null,2));
await browser.close();
