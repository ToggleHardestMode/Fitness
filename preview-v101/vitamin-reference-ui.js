import {referencesFor,CONVERSION_LABELS,convertVitaminUnits} from './vitamin-units.js';
const byId=id=>document.getElementById(id);
function renderRefs(){
 const tbody=byId('vitamin-table-body');if(!tbody)return;
 const selected=byId('vitamin-standard').value;
 tbody.replaceChildren();
 for(const v of referencesFor(selected)){
   const row=document.createElement('tr');
   for(const value of [v.name,v.amount,v.provenance]){
     const cell=document.createElement(row.childNodes.length===0?'th':'td');
     cell.textContent=value;row.append(cell);
   }
   const note=document.createElement('td');note.textContent=v.note||'—';row.append(note);tbody.append(row);
 }
 const caption=byId('vitamin-standard-note');
 caption.textContent=selected==='sg'
   ? 'Singapore HealthHub RDA values where published; B5, biotin, E and K use international RDA/AI fallbacks. This is a population reference, not a prescription.'
   : 'North American DRIs (RDA/AI) for adult men 31–50; these are different reference levels, not converted Singapore RDAs.';
}
export function initVitaminReference(){
 const standard=byId('vitamin-standard'),method=byId('vitamin-method'),amount=byId('vitamin-input');
 if(!standard||!method||!amount)return;
 for(const [key,label] of Object.entries(CONVERSION_LABELS)){
   const option=document.createElement('option');option.value=key;option.textContent=label;method.append(option);
 }
 standard.addEventListener('change',renderRefs);renderRefs();
 const calculate=()=>{
   const target=byId('vitamin-result');
   try{
     if(!amount.value.trim())throw Error('Enter an amount first.');
     const raw=Number(amount.value);const result=convertVitaminUnits(raw,method.value);
     target.textContent='Result: '+Number(result.amount.toPrecision(8)).toLocaleString('en-SG',{maximumFractionDigits:7})+' '+result.unit;
   }catch(e){target.textContent=e.message;}
 };
 byId('vitamin-convert-form').addEventListener('submit',event=>{event.preventDefault();calculate();});
 method.addEventListener('change',()=>{byId('vitamin-result').textContent='Select Convert to calculate; form of vitamin matters.';});
}
if(typeof document!=='undefined')initVitaminReference();
