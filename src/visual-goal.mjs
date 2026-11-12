import {performance} from 'node:perf_hooks';
import {validVisualRow,matchingVisualRows,textMovement} from './visual-evidence.mjs';

const protectedLabel=/\b(post|publish|share|send|pay|buy|purchase|subscribe|delete|remove|accept|agree|allow|password|sign.?in|log.?in|confirm|order|book)\b/i;
const list=(v,max=32)=>Array.isArray(v)&&v.length<=max&&v.every(s=>typeof s==='string'&&s.trim().length>0&&s.length<=200);
const probability=p=>typeof p==='number'&&Number.isFinite(p)&&p>=0&&p<=1;
const sameGeometry=(a,b)=>a.app===b.app&&a.width===b.width&&a.height===b.height;
const rows=s=>(s.visual_rows||[]).filter(validVisualRow);
const matchesText=(s,label)=>matchingVisualRows(rows(s),label);
const box=r=>({x:r.x,y:1-r.y-r.height,width:r.width,height:r.height});
const stableBox=(a,b,s)=>Math.max(Math.abs(a.x-b.x)*s.width,Math.abs(a.y-b.y)*s.height,Math.abs(a.width-b.width)*s.width,Math.abs(a.height-b.height)*s.height)<=2;
export const wantsVisualGoal=o=>o?.visual_labels!==undefined||o?.until?.visual!==undefined||o?.visual_ready!==undefined||o?.scroll_directions!==undefined;

// Caller-scoped, general text navigation. OCR stays local; JEV gets only matching
// supplied labels. No icon guesses, editable-field input, or saved app plans.
export async function runVisualGoal(controller,options,{vision,chooser,signal,onBeforeAction}={}){
 if(options.external_ui_opt_in!==true)throw Error('Visual JEV navigation requires external_ui_opt_in');
 const {goal,apps,visual_labels:labels,until}=options,predicate=until?.visual;
 if(typeof goal!=='string'||!goal.length||goal.length>2000||!Array.isArray(apps)||!apps.length||apps.length>16||apps.some(a=>typeof a!=='string'||!/^[\w.-]+$/.test(a)))throw Error('A bounded intent and app scope are required');
 if(!list(labels)||!list(predicate?.all,16)||!predicate.all.length||!apps.includes(until.app)||until.selector||until.absent||options.texts||options.allowed_selectors)throw Error('Visual mode requires exact labels and an app-scoped visual result; AX predicates and text entry cannot be substituted');
 if(predicate.none!==undefined&&!list(predicate.none,16)||predicate.moved!==undefined&&typeof predicate.moved!=='boolean')throw Error('Invalid visual result predicate');
 const ready=options.visual_ready;
 if(ready&&(!list(ready.all,16)||!ready.all.length||ready.none!==undefined&&!list(ready.none,16)))throw Error('Invalid visual readiness predicate');
 if(options.allow_home!==undefined&&typeof options.allow_home!=='boolean'||options.allow_home&&!apps.includes('com.apple.springboard'))throw Error('Home requires Springboard in the explicit scope');
 if(options.launch_apps&&(!Array.isArray(options.launch_apps)||options.launch_apps.length>16||options.launch_apps.some(a=>!apps.includes(a.bundle)||typeof a.label!=='string'||!a.label.length||a.label.length>100)))throw Error('Launch candidates must belong to the app scope');
 if(options.scroll_directions&&(!Array.isArray(options.scroll_directions)||options.scroll_directions.length>4||options.scroll_directions.some(d=>!['up','down','left','right'].includes(d))))throw Error('Invalid visual scroll directions');
 const max=options.max_actions??8,timeout=options.timeout_ms??30000,min=options.min_probability??.9;
 if(!Number.isInteger(max)||max<1||max>12||!Number.isInteger(timeout)||timeout<1||timeout>60000||!probability(min)||min<.9)throw Error('Invalid visual action, time or decision budget');
 const readyTimeout=options.readiness_timeout_ms??2000;
 if(!Number.isInteger(readyTimeout)||readyTimeout<0||readyTimeout>10000)throw Error('Invalid visual readiness deadline');
 if(!vision||!chooser)throw Error('Local vision and JEV must be configured');
 const stop=signal?AbortSignal.any([signal,AbortSignal.timeout(timeout)]):AbortSignal.timeout(timeout);
 const start=performance.now(),events=[],history=[];let calls=0,actions=0,observation,lastAction,moveBefore,movement;
 const result=(ok,reason,outcome='stopped')=>({ok,reason,outcome,actions,chooser_calls:calls,events,elapsed_ms:performance.now()-start,observation,...(movement?{visual_movement:movement}:{})});
 const capture=async()=>{
  stop.throwIfAborted();const s=await vision.capture(controller,{signal:stop});
  if(!apps.includes(s.app))throw Object.assign(Error('Visual app scope changed; no further input sent'),{outcome:'not_sent'});
  return s;
 };
 const done=s=>{
  if(s.app!==until.app||predicate.all.some(t=>matchesText(s,t).length===0)||[...(predicate.none||[]),...(ready?.none||[])].some(t=>matchesText(s,t).length>0))return false;
  if(until.after_action&&(!lastAction||Object.entries(until.after_action).some(([k,v])=>lastAction[k]!==v)))return false;
  if(predicate.moved){movement=moveBefore&&sameGeometry(moveBefore,s)?textMovement(rows(moveBefore),rows(s)):null;if(!movement?.verified)return false;}
  return true;
 };
 const relevantUnchanged=(a,b)=>sameGeometry(a,b)&&[...labels,...predicate.all,...(predicate.none||[])].every(t=>{
  const ordered=s=>matchesText(s,t).map(box).sort((a,b)=>a.y-b.y||a.x-b.x),before=ordered(a),after=ordered(b);
  return before.length===after.length&&before.every((r,i)=>stableBox(r,after[i],b));
 });
 const readyToAct=s=>s.app!==until.app||!ready||ready.all.every(t=>matchesText(s,t).length>0)&&!(ready.none||[]).some(t=>matchesText(s,t).length>0);
 try{
  observation=await capture();
  for(let step=0;step<=max;step++){
   if(done(observation))return result(true,'Visual completion predicate observed','verified');
   if(step===max)return result(false,'Visual action budget reached');
   if(!readyToAct(observation)){
    const deadline=performance.now()+readyTimeout;
    while(!readyToAct(observation)&&performance.now()<deadline)observation=await capture();
    if(done(observation))return result(true,'Visual completion predicate observed','verified');
    if(!readyToAct(observation))return result(false,'Required starting screen is not visible; no input sent','needs_observation');
   }
   const candidates=[];
   for(const label of new Set(labels)){
    if(protectedLabel.test(label))continue;
    const matched=matchesText(observation,label);
    if(matched.length===1)candidates.push({operation:'tap',kind:'VisibleText',label:matched[0].text,visual_row:matched[0]});
   }
   if(options.allow_home)candidates.push({operation:'home',kind:'SystemAction',label:'Home: close the current app or folder'});
   for(const direction of new Set(observation.app===until.app?options.scroll_directions||[]:[]))candidates.push({operation:'scroll',kind:'SystemAction',label:'Scroll '+direction,direction});
   for(const app of options.launch_apps||[])if(app.bundle!==observation.app)candidates.push({operation:'launch',kind:'Application',label:app.label,bundle:app.bundle});
   if(!candidates.length)return result(false,'No unique permitted visual target; no input sent','not_sent');
   const t=performance.now();calls++;
   const visible=[...new Set([...predicate.all,...(predicate.none||[]),...(ready?.all||[]),...(ready?.none||[])])].filter(t=>matchesText(observation,t).length>0);
   const choice=await chooser.choose({goal,observation:{...observation,visual_rows:undefined,jev_visible_text:visible},candidates,history,signal:stop});
   events.push({kind:'choice',ms:performance.now()-t,confidence:choice.confidence,selected_probability:choice.selected_probability,available:choice.available,candidate_count:candidates.length,model:choice.model});
   if(![choice.confidence,choice.selected_probability,choice.available].every(probability)||Math.min(choice.confidence,choice.selected_probability,choice.available)<min||!/^a\d+$/.test(choice.choice)||!candidates[Number(choice.choice.slice(1))])return result(false,'Visual JEV decision failed unchanged gates; no input sent','not_sent');
   const target=candidates[Number(choice.choice.slice(1))],fresh=await capture();
   if(!sameGeometry(observation,fresh))return result(false,'Visual app or geometry changed after choice; no input sent','not_sent');
   if(!readyToAct(fresh))return result(false,'Required starting screen changed after choice; no input sent','not_sent');
   let command;
   if(target.operation==='tap'){
    const current=matchesText(fresh,target.label);
    if(current.length!==1||!stableBox(box(target.visual_row),box(current[0]),fresh))return result(false,'Visual target changed or became ambiguous; no input sent','not_sent');
    const r=box(current[0]);command={op:'tap_point',snapshot:fresh.snapshot,x:(r.x+r.width/2)*fresh.width,y:(r.y+r.height/2)*fresh.height,observe:false};
   }else if(target.operation==='launch')command={op:'launch',bundle:target.bundle,observe:false};
   else if(target.operation==='home')command={op:'home',observe:false};
   else{
    const {width:w,height:h}=fresh,horizontal=['left','right'].includes(target.direction),reverse=['right','down'].includes(target.direction);
    command={op:'scroll',snapshot:fresh.snapshot,x1:w*(horizontal?(reverse?.30:.70):.5),y1:h*(horizontal?.5:(reverse?.40:.65)),x2:w*(horizontal?(reverse?.55:.45):.5),y2:h*(horizontal?.5:(reverse?.65:.40)),observe:false};moveBefore=fresh;
   }
   if(onBeforeAction)await onBeforeAction({target,observation:fresh});
   const sentAt=performance.now(),applied=await controller.execute([command],{signal:stop,timeout:Math.max(1,timeout-(performance.now()-start))});
   events.push({kind:'action',operation:target.operation,ms:performance.now()-sentAt,ok:applied.ok,outcome:applied.outcome});
   if(!applied.ok)return result(false,applied.error,applied.outcome||'unknown');
   actions++;lastAction={operation:target.operation,kind:target.kind,label:target.label};history.push({operation:target.operation,label:target.label,direction:target.direction});
   const deadline=performance.now()+(target.operation==='launch'?Math.max(2000,readyTimeout):2000),checkingMovement=predicate.moved&&target.operation==='scroll',terminal=step+1===max;
   do{
    observation=await capture();if(done(observation))return result(true,'Visual completion predicate observed','verified');
    if(!terminal&&(target.operation==='launch'||target.operation==='home'||!checkingMovement&&!relevantUnchanged(fresh,observation)))break;
   }while(performance.now()<deadline);
   if(checkingMovement)return result(false,'Required coherent content movement was not observed; gesture was not repeated','applied');
   if(target.operation!=='launch'&&target.operation!=='home'&&relevantUnchanged(fresh,observation))return result(false,'No relevant visual progress; input was not repeated','applied');
  }
 }catch(error){controller.current=null;return result(false,error.message,error.outcome||'unknown');}
}
