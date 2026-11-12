#!/usr/bin/env node
// Reversible physical-phone intents. Fixture plans belong to this harness, never the runner.
import {readFile,writeFile,mkdir,appendFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';import {performance} from 'node:perf_hooks';import {createHash} from 'node:crypto';
import {Runner,Controller,matches} from '../src/driver.mjs';import {JevChooser,runLocalGoal} from '../src/jev.mjs';import {root,assertDirectMode,ensureMuted} from '../src/cli.mjs';
import {cleanupTask} from './benchmark-general-support.mjs';
import {phoneRecorder} from './phone-recorder.mjs';
import {deviceLauncher} from '../src/device-launch.mjs';
import {readVisualFrame,visibleResult,visibleContentChange,waitForVisualFrame,waitForVisualChange} from './benchmark-visual.mjs';
const tasksPath=process.argv[2];if(!tasksPath)throw Error('Supply a JSON benchmark task manifest');
const fixtures=JSON.parse(await readFile(tasksPath,'utf8'));const repeats=Number(process.argv[3]||1);if(!Number.isInteger(repeats)||repeats<1||repeats>5)throw Error('Repeat budget1–5 required');
const selection=process.argv[4]||'hybrid';if(!['hybrid','jev-only','paired'].includes(selection))throw Error('Choose hybrid, jev-only or paired');
const id=new Date().toISOString().replace(/[:.]/g,'-')+'-general';const pub=join(root,'benchmarks/runs',id),raw=join(root,'benchmarks/private',id);await mkdir(pub,{recursive:true});await mkdir(raw,{recursive:true,mode:0o700});
const c=JSON.parse(await readFile(join(root,'.state/config.json')));const token=(await readFile(join(root,'.state/token'),'utf8')).trim();const apiKey=(await readFile(join(root,'.state/jev-token'),'utf8')).trim();
const r=new Runner({port:c.port,token}),camera=new Runner({port:c.port,token,timeout:2500});const launchWait=Number(process.env.CLICKFAST_BENCH_LAUNCH_WAIT_MS||0);if(!Number.isInteger(launchWait)||launchWait<0||launchWait>1000)throw Error('Invalid launch wait experiment');const launchDevice=deviceLauncher(c.udid);const ctl=new Controller(r,{deviceLaunch:async(bundle,options)=>{await launchDevice(bundle,options);if(launchWait)await new Promise(resolve=>setTimeout(resolve,launchWait));}});let active,epoch,requestIndex=0;
const report={schema:1,id,kind:'Physical iPhone general intents with live JEV',source_commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),source_dirty:Boolean(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim()),source_sha256:{},device:'iPhone16ProMax / iOS26.5 / USB',repeats,tasks:fixtures.tasks,method:'All phases use live JEV with unchanged0.9 gates. Known setup/reset is excluded and separately timed. Warm timer includes fresh observation, model decisions, native input and independent fresh AX verification. Screenshot recorder up to5fps uses a separate connection; all frame request/completion intervals retained. No audio. No failed input is replayed. Every attempt and recovery is retained. This is a bounded-intent benchmark, not a human or market-wide speed comparison.',runs:[]};
for(const file of ['src/jev.mjs','src/driver.mjs','src/device-launch.mjs','scripts/benchmark-general.mjs','scripts/benchmark-general-support.mjs','scripts/benchmark-visual.mjs','scripts/mirror-ocr.swift','scripts/phone-recorder.mjs','vendor/iphone-use/runner/IPhoneUseRunner/IPhoneUseRunnerUITests/RunnerTests.swift','vendor/iphone-use/runner/IPhoneUseRunner/IPhoneUseRunnerUITests/IPURBridge.m','vendor/iphone-use/runner/IPhoneUseRunner/IPhoneUseRunnerUITests/RunnerElements.swift',tasksPath])report.source_sha256[file.replace(root+'/','')]=createHash('sha256').update(await readFile(file)).digest('hex');
const save=()=>writeFile(join(pub,'results.json'),JSON.stringify(report,null,2)+'\n');
report.launch_wait_experiment_ms=launchWait;report.schema=2;report.kind='Physical iPhone bounded intents';report.controller_mode=selection;
report.method='Real Home-to-result phone tasks, unchanged0.9 JEV gates. Hybrid admits exact caller-provided app, empty field/literal and swipe primitives directly, and uses JEV for navigation choices. A provided swipe is a test action through the general controller, not a saved product routine or a JEV decision. App launches use CoreDevice. Setup and cleanup are recorded separately. All task navigation, model choices, input, independent AX or specified screenshot/OCR checks and result captures are timed. Scroll checks compare text and positions in actual before/after frames. Capture stops on lock. All failures are retained; unknown input is never replayed. Match the same predicates and start states in Mirroring before comparing speed.';
const chooser=new JevChooser({apiKey,fetchImpl:async(url,args)=>{const index=requestIndex++,t=performance.now();const response=await fetch(url,args),body=await response.text();if(active)await writeFile(join(raw,active.name,`jev-${index}.json`),JSON.stringify({at_ms:t-epoch,ms:performance.now()-t,request:JSON.parse(args.body),response:body},null,2));return {ok:response.ok,status:response.status,text:async()=>body};}});
async function execute(steps){if(!steps?.length)return;const v=await ctl.execute(steps);if(!v.ok)throw Error(v.error);}
function verified(s,predicate){return (!predicate.app||predicate.app===s.app)&&(!predicate.selector||s.elements.some(x=>matches(x,predicate.selector)))&&(!predicate.absent||s.mode!=='pixels'&&!s.truncated&&s.elements.length>0&&!s.elements.some(x=>matches(x,predicate.absent)));}
try{
 assertDirectMode();if(await r.call('/wda/locked')!==false)throw Error('Phone locked; no input sent');await ensureMuted(r);
 const trials=[];for(let repeat=0;repeat<repeats;repeat++)for(const [index,task] of fixtures.tasks.entries()){const modes=selection==='paired'?((index+repeat)%2?['jev-only','hybrid']:['hybrid','jev-only']):[selection];for(const mode of modes)trials.push({repeat:repeat+1,task,mode});}
 for(const {repeat,task,mode} of trials){
  assertDirectMode();if(await r.call('/wda/locked')!==false)throw Error('Phone locked between trials; no next trial started');
  const status=await r.call('/status');if(status.busy&&status.busyMs>1500)throw Error('An earlier native request still owns the input queue; no further trial started');
  const run={name:`${String(report.runs.length+1).padStart(2,'0')}-${task.id}-${mode}`,task:task.id,mode,repeat,started_at:new Date().toISOString(),phases:[]};report.runs.push(run);await save();let recorder,warmStart;
  try{
   const setupStart=performance.now();await ensureMuted(r);recorder=phoneRecorder(camera,join(raw,run.name));epoch=await recorder.start();await execute(task.setup);
   if(task.reset_text&&task.verify.app)await execute([{op:'launch',bundle:task.verify.app}]);
   for(const target of task.setup_targets||[]){const s=await ctl.observe();const rows=s.elements.filter(x=>x.ref&&matches(x,target.selector));if(!rows.length)throw Error('Required setup target missing');if(rows.length>1&&target.placement!=='bottom')throw Error('Ambiguous setup target');const row=target.placement==='bottom'?rows.sort((a,b)=>b.rect.y-a.rect.y)[0]:rows[0];await execute([{op:'tap',ref:row.ref,snapshot:s.snapshot}]);}
   if(task.reset_text){const s=await ctl.observe(),rows=s.elements.filter(x=>matches(x,task.reset_text.selector));if(rows.length>1||(!rows.length&&!task.reset_text.when_present))throw Error('Reset needs a unique current field');const field=rows[0];if(field&&field.value&&field.value!==field.placeholder){if(!task.reset_text.owned_values.includes(field.value))throw Error('Existing unrelated text preserved; setup stopped');await execute([{op:'tap',selector:task.reset_text.clear_selector||{kind:'Button',label:'Clear text'}}]);const until=performance.now()+2000;let empty=false;do{const n=(await ctl.observe()).elements.find(x=>matches(x,task.reset_text.selector));empty=n&&(!n.value||n.value===n.placeholder);if(empty)break;}while(performance.now()<until);if(!empty)throw Error('Owned search text did not clear');}}
   if(task.reset_text)await execute([{op:'home'}]);
   if(task.ready)await ctl.wait(task.ready,{timeout:5000});run.setup_ms=performance.now()-setupStart;
   const setup=await ctl.observe();await mkdir(join(raw,run.name),{recursive:true});await writeFile(join(raw,run.name,'setup.json'),JSON.stringify(setup));
   warmStart=performance.now();run.recording_warm_start_ms=warmStart-epoch;active=run;const trace=r.trace.length;let phasesOK=true;
   let changeBefore,changeBeforeFrame;
   for(const [phaseIndex,phase] of task.phases.entries()){
    if(phase.visual_target){
     if(phase.external_ui_opt_in!==true)throw Error('Visual JEV choice requires external UI opt-in');
     const t=performance.now(),context=await ctl.observe({pixelsOnly:true});
     if(!phase.apps.includes(context.app))throw Error('Visual target app scope changed');
     const ready=await waitForVisualFrame(recorder,join(raw,run.name),{min_lines:3},join(root,'.state/phone-ocr'));
     if(phase.until_ocr&&visibleResult(ready.lines,phase.until_ocr)){run.phases.push({goal:phase.goal,ok:true,reason:'Required visual state is already visible',actions:0,chooser_calls:0,events:[],elapsed_ms:performance.now()-t});continue;}
     const target=phase.visual_target;
     const matching=lines=>lines.filter(x=>x.confidence>=.8&&x.text.toLocaleLowerCase().trim()===target.text.toLocaleLowerCase().trim()&&(!target.bottom||1-x.y-x.height/2>.85));
     let rows=matching(ready.lines);
     if(!rows.length&&!target.if_present){
      const deadline=performance.now()+3000;
      do{const frame=await recorder.checkpoint();const lines=readVisualFrame(join(raw,run.name),frame,join(root,'.state/phone-ocr'));if(phase.until_ocr&&visibleResult(lines,phase.until_ocr)){rows=[];ready.complete=true;break;}rows=matching(lines);}while(!rows.length&&performance.now()<deadline);
      if(ready.complete){run.phases.push({goal:phase.goal,ok:true,reason:'Required visual state appeared before input',actions:0,chooser_calls:0,events:[],elapsed_ms:performance.now()-t});continue;}
     }
     if(!rows.length&&target.if_present){run.phases.push({goal:phase.goal,ok:true,reason:'Optional visible target is absent; no input sent',actions:0,chooser_calls:0,events:[],elapsed_ms:performance.now()-t});continue;}
     if(rows.length!==1)throw Error('Visual target is missing or ambiguous');
     const choice=await chooser.choose({goal:phase.goal,observation:context,candidates:[{operation:'tap',kind:'VisibleText',label:rows[0].text}],history:[],signal:AbortSignal.timeout(5000)});
     if(choice.choice!=='a0'||Math.min(choice.confidence,choice.selected_probability,choice.available)<.9)throw Error('Visual target failed unchanged JEV gates; no input sent');
     const current=await ctl.observe({pixelsOnly:true});if(current.app!==context.app)throw Error('App changed after the visual choice; no input sent');
     const row=rows[0],applied=await ctl.execute([{op:'tap_point',snapshot:current.snapshot,x:(row.x+row.width/2)*current.width,y:(1-row.y-row.height/2)*current.height,observe:false}]);
     let ok=applied.ok;
     if(ok&&phase.until_ocr)ok=(await waitForVisualFrame(recorder,join(raw,run.name),phase.until_ocr,join(root,'.state/phone-ocr'))).verified;
     if(ok&&target.if_present){
      const deadline=performance.now()+3000;let remains=true;
      do{const frame=await recorder.checkpoint();remains=matching(readVisualFrame(join(raw,run.name),frame,join(root,'.state/phone-ocr'))).length>0;}while(remains&&performance.now()<deadline);
      ok=!remains;
     }
     run.phases.push({goal:phase.goal,source:'JEV choice from an observed text box',ok,reason:ok?'Visual target delivered and checked':applied.error||'Required visual result was not observed',actions:applied.completed.length,chooser_calls:1,events:[{kind:'choice',...choice},{kind:'action',operation:'tap_point',outcome:applied.outcome||'applied'}],elapsed_ms:performance.now()-t});
     if(!ok){phasesOK=false;break;}continue;
    }
    if(phase.action){
     if(phase.action.x_fraction!==undefined&&(!Number.isFinite(phase.action.x_fraction)||phase.action.x_fraction<.05||phase.action.x_fraction>.95))throw Error('Invalid swipe position');
     if(!['swipe','scroll'].includes(phase.action.op)||!['up','down','left','right'].includes(phase.action.direction)||phase.action.duration_ms!==undefined&&(!Number.isInteger(phase.action.duration_ms)||phase.action.duration_ms<100||phase.action.duration_ms>1000))throw Error('Unsupported provided benchmark action');
     let before=await ctl.observe({pixelsOnly:true});
     if(!phase.apps.includes(before.app)||before.app!==phase.until.app)throw Error('Provided swipe app scope changed');
     if(phase.action.distance_fraction!==undefined&&(!Number.isFinite(phase.action.distance_fraction)||phase.action.distance_fraction<.05||phase.action.distance_fraction>.65))throw Error('Invalid scroll distance');
     const prior=phase.precondition_ocr?await waitForVisualFrame(recorder,join(raw,run.name),phase.precondition_ocr,join(root,'.state/phone-ocr')):{frame:await recorder.checkpoint(),verified:true};
     if(!prior.verified)throw Error('Expected starting content is not visible; no swipe sent');
     const priorFrame=prior.frame;before=await ctl.observe({pixelsOnly:true});if(!phase.apps.includes(before.app)||before.app!==phase.until.app)throw Error('App changed during the visual check; no swipe sent');
     if(task.verify_change?.phase===phaseIndex){changeBefore=structuredClone(before);changeBeforeFrame=priorFrame;}
     const {width:w,height:h}=before,d=phase.action.direction,horizontal=['left','right'].includes(d),reverse=['right','down'].includes(d),t=performance.now();
     const applied=await ctl.execute([{op:phase.action.op,x1:horizontal?w*(reverse?.25:.75):w*(phase.action.x_fraction??.5),y1:horizontal?h*.5:h*(reverse?.30:.75),x2:horizontal?w*(reverse?.25+(phase.action.distance_fraction??.50):.75-(phase.action.distance_fraction??.50)):w*(phase.action.x_fraction??.5),y2:horizontal?h*.5:h*(reverse?.30+(phase.action.distance_fraction??.45):.75-(phase.action.distance_fraction??.45)),...(phase.action.op==='swipe'?{duration_ms:phase.action.duration_ms||150}:{}),observe:false}]);
     const final=await ctl.observe({pixelsOnly:true});
     const ok=applied.ok&&final.app===phase.until.app;
     run.phases.push({goal:phase.goal,source:'caller_provided_'+phase.action.op,ok,reason:ok?'Provided input delivered; independent visual check follows':applied.error,actions:applied.completed.length,chooser_calls:0,elapsed_ms:performance.now()-t,events:[{kind:'action',operation:phase.action.op,outcome:applied.outcome||'applied'}]});
     if(!ok){phasesOK=false;break;}
     continue;
    }
    const result=await runLocalGoal(ctl,{external_ui_opt_in:true,visible_controls:true,max_actions:8,timeout_ms:15000,...phase,direct_text:mode==='hybrid',direct_launch:mode==='hybrid'},{chooser,onBeforeAction:({target,observation})=>{if(task.verify_change?.phase===phaseIndex&&target.operation==='swipe')changeBefore=structuredClone(observation);}});
    run.phases.push({goal:phase.goal,ok:result.ok,reason:result.reason,actions:result.actions,chooser_calls:result.chooser_calls,events:result.events,elapsed_ms:result.elapsed_ms,outcome:result.outcome});
    await writeFile(join(raw,run.name,`phase-${run.phases.length}.json`),JSON.stringify(result.observation));if(!result.ok){phasesOK=false;break;}
   }
   const verifyStart=performance.now();let final=await ctl.observe({pixelsOnly:Boolean(task.verify_ocr)});const end=performance.now()+3000;
   const visualCheck=task.verify_ocr?await waitForVisualFrame(recorder,join(raw,run.name),task.verify_ocr,join(root,'.state/phone-ocr'),{timeout:phasesOK?(task.verify_timeout_ms||3000):0}):null;
   run.result_frame=visualCheck?.frame||await recorder.checkpoint();
   if(task.verify_ocr){run.visual_verification={frame:run.result_frame.file,predicate:task.verify_ocr,verified:visualCheck.verified};final=await ctl.observe({pixelsOnly:true});}
   const taskVerified=s=>verified(s,task.verify)&&(!task.require_controls||s.elements.some(row=>row.ref));
   while(phasesOK&&!task.verify_ocr&&!taskVerified(final)&&performance.now()<end){await new Promise(a=>setTimeout(a,25));final=await ctl.observe();}
   if(task.verify_change){
    const content=s=>s?.elements.filter(row=>row.rect&&row.rect.y>60&&row.rect.y<s.height*.85&&row.rect.y+row.rect.height>100&&((['StaticText','Cell','Link'].includes(row.kind)&&(row.label||'').length>12)||/^@/.test(row.label||''))).map(row=>[row.kind,row.label,Math.round(row.rect.y/20)]);
    const before=content(changeBefore)||[],after=content(final)||[];run.content_change={before_rows:before.length,after_rows:after.length,verified:before.length>0&&after.length>0&&JSON.stringify(before)!==JSON.stringify(after)};
    if(changeBeforeFrame){
     const beforeLines=readVisualFrame(join(raw,run.name),changeBeforeFrame,join(root,'.state/phone-ocr'));
     const observed=await waitForVisualChange(beforeLines,async()=>{const frame=await recorder.checkpoint();return {frame,lines:readVisualFrame(join(raw,run.name),frame,join(root,'.state/phone-ocr'))};});
     const afterLines=observed.lines;run.result_frame=observed.frame;
     run.content_change={...observed.change,method:observed.change.method,before_frame:changeBeforeFrame.file,after_frame:run.result_frame.file};
     await writeFile(join(raw,run.name,'scroll-ocr.json'),JSON.stringify({before:beforeLines,after:afterLines}));
    }
    await writeFile(join(raw,run.name,'before-scroll.json'),JSON.stringify(changeBefore||null));
   }
   run.verification_ms=performance.now()-verifyStart;run.verified=(task.verify_ocr?verified(final,task.verify)&&run.visual_verification.verified:taskVerified(final))&&(!task.verify_change||run.content_change.verified);run.actions=run.phases.reduce((a,x)=>a+x.actions,0);run.ok=phasesOK&&run.verified&&run.actions>=(task.min_actions||1);if(phasesOK&&run.verified&&run.actions<(task.min_actions||1))run.error='Starting state was already complete; excluded as a control trial';run.result_frame=await recorder.checkpoint();run.elapsed_ms=performance.now()-warmStart;run.chooser_calls=run.phases.reduce((a,x)=>a+x.chooser_calls,0);run.requests=r.trace.slice(trace);run.native_inputs=run.requests.reduce((a,x)=>a+(x.input_count||0),0);await writeFile(join(raw,run.name,'final.json'),JSON.stringify(final));
  }catch(e){run.ok=false;run.error=e.message;run.outcome=e.outcome;if(warmStart!==undefined)run.elapsed_ms=performance.now()-warmStart;}
  finally{active=null;run.task_ok=run.ok;if(task.cleanup){const t=performance.now();try{run.cleanup=await cleanupTask(ctl,task);run.cleanup_ms=performance.now()-t;}catch(e){run.cleanup_error=e.message;run.ok=false;}}if(recorder)run.recording=await recorder.end();try{run.audio=await r.call('/sprint/audio')}catch{}await save();await appendFile(join(pub,'journal.jsonl'),JSON.stringify(run)+'\n');console.log(JSON.stringify({task:task.id,mode,repeat:run.repeat,ok:run.ok,ms:run.elapsed_ms,error:run.error,reasons:run.phases.map(p=>p.reason),actions:run.actions,chooser_calls:run.chooser_calls}));}
 }
}catch(e){report.fatal_error=e.message;process.exitCode=1;}finally{r.close();camera.close();report.finished_at=new Date().toISOString();await save();console.log('SESSION '+id);}
