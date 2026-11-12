import {matches} from '../src/driver.mjs';

// A failed setup must never turn cleanup into permission to erase the user's draft.
export async function cleanupTask(controller,task){
 if(!task.cleanup?.length)return {status:'not_needed'};
 const reset=task.reset_text;
 if(reset){
  const observation=await controller.observe();
  const rows=observation.elements.filter(row=>matches(row,reset.selector));
  if(rows.length!==1)return {status:'preserved',reason:'Cleanup field missing or ambiguous'};
  const field=rows[0];
  if(!field.value||field.value===field.placeholder)return {status:'already_empty'};
  if(!reset.owned_values.includes(field.value))return {status:'preserved',reason:'Unrelated text preserved'};
 }
 const result=await controller.execute(task.cleanup);
 if(!result.ok)throw Error(result.error||'Cleanup input failed');
 if(reset){
  const observation=await controller.observe();
  const rows=observation.elements.filter(row=>matches(row,reset.selector));
  if(rows.length!==1||rows[0].value&&rows[0].value!==rows[0].placeholder)throw Error('Cleanup did not verify an empty field');
 }
 return {status:'verified'};
}
