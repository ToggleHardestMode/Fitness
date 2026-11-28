// Expand only explicitly selected rows from the same source group.
// No name-based exercise matching, automatic selection, grouped corrections or inferred evidence.
const fields=['date','workout','exercise','exercise_index','template_id','session_id','occurrence_id',
  'exercise_id','completed','kind','load_basis','rep_basis','load_evidence','reps_evidence'];
export function sameReviewGroup(a,b){
  return a.sourceId===b.sourceId&&fields.every(k=>(a.row[k]??'')===(b.row[k]??''));
}
export function expandGroupReview(decision,anchor,selected,occurrence=null){
  if(!selected.length)return [structuredClone(decision)];
  if(decision.action==='correct'||decision.action==='skip'||decision.completed!==true||
     !['match','new'].includes(decision.uiAction))
    throw Error('Group review supports only confirmed add/match decisions; review corrections and skips individually.');
  if(decision.sourceId!==anchor.sourceId||decision.row!==anchor.record)
    throw Error('Group review anchor does not match decision.');
  const records=new Set([anchor.record]),ordinals=new Set();
  const number=row=>{
    if(!/^\d+$/.test(row.set)||Number(row.set)<1||Number(row.set)>1000)
      throw Error('Invalid group set ordinal.');
    return Number(row.set);
  };
  ordinals.add(number(anchor.row));
  const result=[structuredClone(decision)];
  for(const item of selected){
    if(!sameReviewGroup(anchor,item)||records.has(item.record))
      throw Error('Group rows must share the same explicit source group.');
    records.add(item.record);
    const n=number(item.row);
    if(ordinals.has(n))throw Error('Repeated set ordinal; review individually.');
    ordinals.add(n);
    // Do not silently replace an explicitly supplied stable set ID.
    if(item.row.set_id)throw Error('Stable-ID rows must be reviewed individually.');
    const set=occurrence?.sets.find(s=>s.number===n);
    const d={...structuredClone(decision),sourceId:item.sourceId,row:item.record,
      setId:set?.id??JSON.stringify(['review-set',decision.occurrenceId,n])};
    result.push(d);
  }
  return result;
}
