const steps=[...document.querySelectorAll('.step')];
const next=document.getElementById('nextBtn');
const prev=document.getElementById('prevBtn');
const submit=document.getElementById('submitBtn');
const bar=document.getElementById('progressBar');
const form=document.getElementById('applicationForm');
let i=0;

const stepNames=steps.map((s)=>s.querySelector('h2')?.textContent.replace(/^\d+\.\s*/,'')||'Aplicação');
const meta=document.createElement('div');
meta.className='form-progress-meta';
meta.innerHTML='<span id="stepLabel"></span><strong id="stepName"></strong>';
form?.prepend(meta);
const stepLabel=document.getElementById('stepLabel');
const stepName=document.getElementById('stepName');

steps.forEach((step)=>{
  const fields=[...step.querySelectorAll('.field')];
  fields.forEach((field,idx)=>{
    field.classList.add('question-block');
    if(idx===0) field.classList.add('question-first');
  });
});

const gargalos=document.getElementById('gargalos');
let gargaloCount=null;
if(gargalos){
  gargalos.classList.add('choice-grid');
  gargaloCount=document.createElement('div');
  gargaloCount.id='gargaloCount';
  gargaloCount.className='selection-counter';
  gargalos.parentElement.insertBefore(gargaloCount,gargalos);
}

function syncChoices(){
  document.querySelectorAll('.choice').forEach(label=>{
    const input=label.querySelector('input');
    label.classList.toggle('selected',!!input?.checked);
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
  steps.forEach((s,n)=>s.classList.toggle('active',n===i));
  prev.style.visibility=i===0?'hidden':'visible';
  next.style.display=i===steps.length-1?'none':'inline-flex';
  submit.style.display=i===steps.length-1?'inline-flex':'none';
  bar.style.width=((i+1)/steps.length*100)+'%';
  if(stepLabel) stepLabel.textContent=`Etapa ${i+1} de ${steps.length}`;
  if(stepName) stepName.textContent=stepNames[i];
  document.querySelectorAll('.field-error').forEach(el=>el.classList.remove('field-error'));
  window.scrollTo({top:0,behavior:'smooth'});
  syncChoices();
  updateGargalos();
}

function validStep(){
  const fields=[...steps[i].querySelectorAll('input,select,textarea')].filter(f=>!f.disabled);
  for(const f of fields){
    if(!f.checkValidity()){
      const field=f.closest('.field');
      field?.classList.add('field-error');
      field?.scrollIntoView({behavior:'smooth',block:'center'});
      setTimeout(()=>f.reportValidity(),250);
      return false;
    }
  }
  return true;
}

next?.addEventListener('click',()=>{if(validStep()&&i<steps.length-1){i++;show()}});
prev?.addEventListener('click',()=>{if(i>0){i--;show()}});

document.querySelectorAll('.choice input').forEach(input=>{
  input.addEventListener('change',()=>{
    syncChoices();
    updateGargalos();
    if(input.type==='radio'){
      const field=input.closest('.field');
      const nextField=field?.nextElementSibling;
      if(nextField?.classList.contains('field')){
        setTimeout(()=>nextField.scrollIntoView({behavior:'smooth',block:'start'}),180);
      }
    }
  });
});

form?.querySelectorAll('input,select,textarea').forEach(el=>{
  el.addEventListener('input',()=>el.closest('.field')?.classList.remove('field-error'));
  el.addEventListener('change',()=>el.closest('.field')?.classList.remove('field-error'));
});

show();