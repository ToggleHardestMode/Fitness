import test from 'node:test';
import assert from 'node:assert/strict';
import {trainingAnalyticsPanel} from '../training-analytics-ui.js';
const base={templates:[{id:'u',name:'Upper',day:0,exercises:[{name:'Curl',muscle:'Arms',sets:2}]}],assignments:{0:'u'},logs:[]};
test('Shows prescribed sets separately from actually recorded sets',()=>{
 const html=trainingAnalyticsPanel(base,'2026-10-19','2026-10-21');
 assert.match(html,/Scheduled sets/);assert.match(html,/Recorded sets/);assert.match(html,/Arms \(combined\)/);
 assert.match(html,/0\/2 assigned/);assert.match(html,/not medical approval/);
});
test('Escapes category labels derived from untrusted template data',()=>{
 const altered=structuredClone(base);altered.templates[0].exercises[0].muscle='<img src=x onerror=alert(1)>';
 const html=trainingAnalyticsPanel(altered,'2026-10-19','2026-10-21');
 assert.doesNotMatch(html,/<img/);assert.match(html,/&lt;img/);
});
test('Never calls a PT Review day safe when no entries recorded',()=>{
 const altered=structuredClone(base);altered.templates[0].requiresClinicalReview=true;
 const html=trainingAnalyticsPanel(altered,'2026-10-19','2026-10-21');
 assert.match(html,/response unknown/);
});
test('PT workouts logged off-plan still display unknown recovery status',()=>{
 const altered=structuredClone(base);
 altered.templates[0].requiresClinicalReview=true;
 altered.assignments={};
 altered.logs=[{date:'2026-10-19',templateId:'u',exerciseIndex:0,set:1,reps:8,kg:5}];
 const html=trainingAnalyticsPanel(altered,'2026-10-19','2026-10-21');
 assert.match(html,/response unknown/);
});
test('general neurologic observations are considered without an assigned PT workout',()=>{
 const altered=structuredClone(base);
 altered.assignments={};
 altered.symptomLogs=[{date:'2026-10-20',timepoint:'after',templateId:null,exerciseIndex:null,
  side:'left',location:'foot',severity:4,tingling:true,numbness:false,functionChange:'new_weakness',notes:''}];
 const html=trainingAnalyticsPanel(altered,'2026-10-19','2026-10-21');
 assert.match(html,/medical review/);assert.match(html,/New\/worsening weakness/);
});