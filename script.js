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
/* Preserve Netlify Forms and send the same submission to Google Sheets API
   through a server-side Netlify Function (no webhook or browser credentials). */
form?.addEventListener('submit',async(event)=>{
  event.preventDefault();
  if(!form.reportValidity()) return;
  if(submit.disabled) return;
  submit.disabled=true;
  const label=submit.textContent;
  submit.textContent='ENVIANDO...';
  const fd=new FormData(form);
  const data={};
  for(const [key,value] of fd.entries()){
    if(key==='bot-field'||key==='form-name') continue;
    if(data[key]!==undefined){
      data[key]=Array.isArray(data[key])?[...data[key],value]:[data[key],value];
    }else data[key]=value;
  }
  const pendingKey='maphel_pending_submission';
  let id=sessionStorage.getItem(pendingKey);
  if(!id){id=crypto.randomUUID();sessionStorage.setItem(pendingKey,id);}
  try{
    // Netlify Forms is the primary intake and remains independent of Sheets.
    const formRes=await fetch('/',{
      method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams(fd).toString()
    });
    if(!formRes.ok) throw new Error('Falha ao salvar no Netlify Forms');
    const sheetsRes=await fetch('/.netlify/functions/maphel-sheets',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({id,form_name:'aplicacao-maphel',data,created_at:new Date().toISOString()})
    });
    if(!sheetsRes.ok) throw new Error('Falha ao sincronizar Google Sheets');
    sessionStorage.removeItem(pendingKey);
    window.location.assign(form.getAttribute('action')||'/obrigado/');
  }catch(error){
    console.error('Erro no envio da aplicação:',error);
    alert('Não foi possível concluir o envio. Por favor, tente novamente.');
    submit.disabled=false;
    submit.textContent=label;
  }
});
