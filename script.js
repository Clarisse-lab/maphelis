const sections=[...document.querySelectorAll('.step')];
const fields=[...document.querySelectorAll('.step .field')];
const next=document.getElementById('nextBtn');
const prev=document.getElementById('prevBtn');
const submit=document.getElementById('submitBtn');
const bar=document.getElementById('progressBar');
const form=document.getElementById('applicationForm');
let i=0;

const meta=document.createElement('div');
meta.className='form-progress-meta';
meta.innerHTML='<strong id="stepName"></strong>';
form?.prepend(meta);
const stepName=document.getElementById('stepName');

fields.forEach(field=>field.classList.add('question-block'));

const gargalos=document.getElementById('gargalos');
let gargaloCount=null;
if(gargalos){
  gargalos.classList.add('choice-grid');
  gargaloCount=document.createElement('div');
  gargaloCount.className='selection-counter';
  gargalos.parentElement.insertBefore(gargaloCount,gargalos);
}

function sectionName(field){
  return field.closest('.step')?.querySelector('h2')?.textContent.replace(/^\d+\.\s*/,'') || 'Aplicação';
}

function syncChoices(){
  document.querySelectorAll('.choice').forEach(label=>{
    label.classList.toggle('selected',!!label.querySelector('input')?.checked);
  });
}

function updateGargalos(){
  if(!gargalos) return;
  const boxes=[...gargalos.querySelectorAll('input[type=checkbox]')];
  const checked=boxes.filter(x=>x.checked);
  if(gargaloCount) gargaloCount.textContent=`${checked.length} de 3 selecionados`;
  const full=checked.length>=3;
  boxes.forEach(cb=>{
    const label=cb.closest('.choice');
    const disabled=full&&!cb.checked;
    cb.disabled=disabled;
    label?.classList.toggle('choice-disabled',disabled);
  });
  syncChoices();
}

function show(){
  fields.forEach((field,n)=>field.classList.toggle('question-current',n===i));
  sections.forEach(section=>{
    section.style.display=section.contains(fields[i])?'block':'none';
  });
  prev.style.visibility=i===0?'hidden':'visible';
  next.style.display=i===fields.length-1?'none':'inline-flex';
  submit.style.display=i===fields.length-1?'inline-flex':'none';
  bar.style.width=((i+1)/fields.length*100)+'%';
  if(stepName) stepName.textContent=sectionName(fields[i]);
  document.querySelectorAll('.field-error').forEach(el=>el.classList.remove('field-error'));
  syncChoices();
  updateGargalos();
  window.scrollTo({top:0,behavior:'smooth'});
}

function validCurrent(){
  const current=fields[i];
  const inputs=[...current.querySelectorAll('input,select,textarea')].filter(el=>!el.disabled);
  const requiredRadio=inputs.find(el=>el.type==='radio' && el.required);
  if(requiredRadio){
    const name=requiredRadio.name;
    if(!current.querySelector(`input[name="${name}"]:checked`)){
      current.classList.add('field-error');
      requiredRadio.reportValidity();
      return false;
    }
  }
  for(const el of inputs){
    if(!el.checkValidity()){
      current.classList.add('field-error');
      el.reportValidity();
      return false;
    }
  }
  return true;
}

next?.addEventListener('click',()=>{if(validCurrent()&&i<fields.length-1){i++;show()}});
prev?.addEventListener('click',()=>{if(i>0){i--;show()}});

document.querySelectorAll('.choice input').forEach(input=>{
  input.addEventListener('change',()=>{
    syncChoices();
    updateGargalos();
    input.closest('.field')?.classList.remove('field-error');
  });
});
form?.querySelectorAll('input,select,textarea').forEach(el=>{
  el.addEventListener('input',()=>el.closest('.field')?.classList.remove('field-error'));
  el.addEventListener('change',()=>el.closest('.field')?.classList.remove('field-error'));
});

show();
/* Independent delivery: one destination failing never prevents the other.
   A successful write to either destination completes the visitor journey.
   Failures are logged; automatic server-side replay is a separate improvement. */
form?.addEventListener('submit',async(event)=>{
  event.preventDefault();
  if(!form.reportValidity() || submit.disabled) return;
  submit.disabled=true;
  const originalLabel=submit.textContent;
  submit.textContent='ENVIANDO...';

  const fd=new FormData(form);
  const data={};
  for(const [key,value] of fd.entries()){
    if(key==='bot-field'||key==='form-name') continue;
    if(data[key]!==undefined) data[key]=Array.isArray(data[key])?[...data[key],value]:[data[key],value];
    else data[key]=value;
  }
  const pendingKey='maphel_pending_submission';
  let pending;
  try{pending=JSON.parse(sessionStorage.getItem(pendingKey)||'null')}catch(_){pending=null}
  if(!pending || !pending.id) pending={id:crypto.randomUUID(),netlifySaved:false,sheetsSaved:false};
  sessionStorage.setItem(pendingKey,JSON.stringify(pending));

  const netlifyRequest=pending.netlifySaved
    ? Promise.resolve('previously saved')
    : fetch('/formulario/',{
        method:'POST',
        headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body:new URLSearchParams(fd).toString()
      }).then(res=>{if(!res.ok) throw new Error('Netlify Forms HTTP '+res.status);return 'saved'});

  const sheetsRequest=pending.sheetsSaved
    ? Promise.resolve('previously saved')
    : fetch('/.netlify/functions/maphel-sheets',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({id:pending.id,form_name:'aplicacao-maphel',data,created_at:new Date().toISOString()})
      }).then(res=>{if(!res.ok) throw new Error('Google Sheets Function HTTP '+res.status);return 'saved'});

  const [netlifyResult,sheetsResult]=await Promise.allSettled([netlifyRequest,sheetsRequest]);
  if(netlifyResult.status==='fulfilled') pending.netlifySaved=true;
  else console.error('MAPHEL: falha no Netlify Forms:',netlifyResult.reason);
  if(sheetsResult.status==='fulfilled') pending.sheetsSaved=true;
  else console.error('MAPHEL: falha no Google Sheets:',sheetsResult.reason);

  if(pending.netlifySaved || pending.sheetsSaved){
    sessionStorage.removeItem(pendingKey);
    window.location.assign(form.getAttribute('action')||'/obrigado/');
    return;
  }

  sessionStorage.setItem(pendingKey,JSON.stringify(pending));
  alert('Não foi possível concluir o envio agora. Tente novamente em instantes.');
  submit.disabled=false;
  submit.textContent=originalLabel;
});
