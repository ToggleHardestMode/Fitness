import test from 'node:test';
import assert from 'node:assert/strict';
import {symptomPanel} from '../symptom-ui.js';
import {addSymptomEntry} from '../symptom-journal.js';
const base={templates:[{id:'work-1',name:'Lower [PT Review]',exercises:[{name:'Squat'},{name:'Plank'}]}],logs:[],metrics:[],assignments:{}};
test('Journal form supports all timepoints, explicit entry, and no assumed zero',()=>{
 const html=symptomPanel('2026-10-21',base,'work-1');
 assert.match(html,/Next morning/);assert.match(html,/48-hour follow-up/);
 assert.match(html,/name="severity"[^>]+required|<input required class="field" name="severity"/);
 assert.match(html,/Status unknown—not symptom-free/);
 assert.doesNotMatch(html,/value="0" selected/);
});
test('User-controlled labels and notes are HTML escaped',()=>{
 const s=addSymptomEntry(base,{date:'2026-10-21',timepoint:'after',templateId:'work-1',exerciseIndex:0,side:'left',location:'calf',severity:5,tingling:true,numbness:false,functionChange:'none',notes:'<img src=x onerror=alert(1)>'},()=> 'entry');
 const html=symptomPanel('2026-10-21',s,'work-1');
 assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img src=x/);assert.match(html,/5\/10/);assert.match(html,/Squat/);
});