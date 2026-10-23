(function () {
function parseQuery(search) {
  const params=new URLSearchParams(search);
  const allowed=['정기청소','원룸청소','에어컨','외창','작은집수리','기타'];
  return {services:params.getAll('service').filter(s=>allowed.includes(s)),size:(params.get('size')||'').slice(0,100),notes:(params.get('notes')||'').slice(0,1000)};
}
if(window.__BARUM_TEST__)window.__BARUM_TEST__.parseQuery=parseQuery;
const form=document.querySelector('#quote-form');
if(!form)return;
const prefill=parseQuery(window.location.search);
form.querySelectorAll('[name=service]').forEach(input=>{input.checked=prefill.services.includes(input.value);});
form.elements.size.value=prefill.size;
form.elements.notes.value=prefill.notes;
const errorBox=document.querySelector('#error');
const button=form.querySelector('button[type=submit]');
function showError(message){document.querySelector('#error-text').textContent=message;errorBox.hidden=false;errorBox.focus({preventScroll:true});errorBox.scrollIntoView({block:'start'});}
function smsLink(){const values=new FormData(form);const body=`견적 문의\n서비스: ${values.getAll('service').join(', ')}\n지역: ${values.get('region')}\n평수·대수: ${values.get('size')}\n희망 일정: ${values.get('date')}\n요청사항: ${values.get('notes')}`;document.querySelectorAll('[data-sms]').forEach(a=>a.href='sms:01034275636'+(/iPhone|iPad|iPod/.test(navigator.userAgent)?'&':'?')+'body='+encodeURIComponent(body));}
form.addEventListener('input',smsLink);smsLink();
async function resize(file){
  const url=URL.createObjectURL(file);const img=new Image();
  try{img.src=url;await img.decode();const scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.8));if(!blob)throw Error();return blob;}finally{URL.revokeObjectURL(url);}
}
form.addEventListener('submit',async event=>{
  event.preventDefault();errorBox.hidden=true;
  const data=new FormData(form),files=[...document.querySelector('#photos').files];
  if(!/^010[- ]?\d{4}[- ]?\d{4}$/.test(String(data.get('phone')).trim())) return showError('연락처를 010-1234-5678 형식으로 적어주세요.');
  if(data.get('consent')!=='yes')return showError('개인정보 수집·이용에 동의해주세요.');
  if(!data.getAll('service').length)return showError('서비스를 하나 이상 선택해주세요.');
  if(!String(data.get('region')).trim())return showError('지역을 시·동까지 적어주세요.');
  if(files.length>3)return showError('사진은 최대 3장까지 보낼 수 있습니다.');
  button.disabled=true;button.textContent='사진 준비 중…';
  try{
    let total=0;
    for(const [i,file] of files.entries()){let blob;try{blob=await resize(file);}catch{return showError('사진을 읽지 못했습니다. JPEG 또는 PNG 사진으로 다시 선택해주세요.');}total+=blob.size;data.append('photos',blob,`quote-${i+1}.jpg`);}
    if(total>=4000000)return showError('사진 용량이 큽니다. 사진 수를 줄여 총 4MB 미만으로 보내주세요.');
    document.querySelector('#photo-status').textContent=files.length?`${files.length}장 · ${(total/1000000).toFixed(2)}MB 준비됨`:'';
    button.textContent='보내는 중…';
    const response=await fetch('/api/quote',{method:'POST',body:data,signal:AbortSignal.timeout(55000)});
    const result=await response.json();
    if(!response.ok||!result.ok){showError(result.partial?'신청 내용은 접수됐지만 사진 전송에 실패했습니다. 사진은 문자로 보내주세요.':result.code==='rate'?'신청 횟수가 많습니다. 전화나 문자로 문의해주세요.':'전송하지 못했습니다. 입력 내용은 그대로 남아 있습니다. 전화나 문자로 문의해주세요.');return;}
    form.hidden=true;document.querySelector('#success').hidden=false;document.querySelector('#success').focus();window.scrollTo(0,0);
  }catch{showError('접수 여부를 확인하지 못했습니다. 입력 내용은 그대로 남아 있습니다. 전화나 문자로 확인해주세요.');}
  finally{button.disabled=false;button.textContent='견적 신청 보내기';}
});

})();
