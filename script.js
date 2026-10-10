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