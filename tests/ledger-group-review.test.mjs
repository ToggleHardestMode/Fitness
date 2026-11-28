import test from 'node:test';
import assert from 'node:assert/strict';
import {sameReviewGroup,expandGroupReview} from '../preview-v101/ledger-group-review.js';
const row={date:'2026-01-01',workout:'Synthetic',exercise:'Press',exercise_index:'1',set:'2',kg:'10',reps:'8'};
const anchor={sourceId:'source',record:2,row};
const decision={sourceId:'source',row:2,uiAction:'match',completed:true,sessionId:'session',occurrenceId:'occ',
  setId:'anchor',kind:'working',loadEvidence:'recorded',repsEvidence:'recorded'};
const peer=(overrides={})=>({sourceId:'source',record:3,row:{...row,set:'3',...overrides}});
test('explicit group expansion preserves existing set IDs and does not mutate decisions',()=>{
  const occurrence={sets:[{number:3,id:'existing-set'}]};
  const output=expandGroupReview(decision,anchor,[peer()],occurrence);
  assert.equal(output.length,2);assert.equal(output[1].setId,'existing-set');
  assert.equal(output[1].row,3);assert.equal(output[1].loadEvidence,'recorded');
  assert.equal(decision.setId,'anchor');
  assert.equal(expandGroupReview(decision,anchor,[]).length,1);
});
test('different source, source slot, evidence, completion and duplicate ordinals cannot be grouped',()=>{
  for(const p of [{...peer(),sourceId:'different'},peer({exercise_index:'2'}),
    peer({load_evidence:'planned'}),peer({completed:'false'}),peer({date:'2026-01-02'})]){
    assert.equal(sameReviewGroup(anchor,p),false);
    assert.throws(()=>expandGroupReview(decision,anchor,[p]),/source group/);
  }
  assert.throws(()=>expandGroupReview(decision,anchor,[peer({set:'2'})]),/Repeated/);
  assert.throws(()=>expandGroupReview(decision,anchor,[peer({set_id:'explicit'})]),/Stable-ID/);
});
test('grouped corrections or skips are refused; new occurrences retain explicit definition',()=>{
  for(const action of ['correct','skip'])assert.throws(()=>expandGroupReview({...decision,action},anchor,[peer()]),/individually/);
  const newExercise={id:'new',name:'Synthetic',muscle:null};
  const output=expandGroupReview({...decision,uiAction:'new',newExercise},anchor,[peer()]);
  assert.deepEqual(output[1].newExercise,newExercise);
  assert.equal(output[1].setId,JSON.stringify(['review-set','occ',3]));
});
