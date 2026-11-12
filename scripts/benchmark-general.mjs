#!/usr/bin/env node
// Reversible physical-phone intents. Fixture plans belong to this harness, never the runner.
import {readFile,writeFile,mkdir,appendFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';import {performance} from 'node:perf_hooks';import {createHash} from 'node:crypto';
import {Runner,Controller,matches} from '../src/driver.mjs';import {JevChooser,runLocalGoal} from '../src/jev.mjs';import {root,assertDirectMode,ensureMuted} from '../src/cli.mjs';
import {cleanupTask} from './benchmark-general-support.mjs';
import {phoneRecorder} from './phone-recorder.mjs';
import {deviceLauncher} from '../src/device-launch.mjs';
const tasksPath=process.argv[2];if(!tasksPath)throw Error('Supply a JSON benchmark task manifest');
const fixtures=JSON.parse(await readFile(tasksPath,'utf8'));const repeats=Number(process.argv[3]||1);if(!Number.isInteger(repeats)||repeats<1||repeats>5)throw Error('Repeat budget1–5 required');
const selection=process.argv[4]||'hybrid';if(!['hybrid','jev-only','paired'].includes(selection))throw Error('Choose hybrid, jev-only or paired');
const id=new Date().toISOString().replace(/[:.]/g,'-')+'-general';const pub=join(root,'benchmarks/runs',id),raw=join(root,'benchmarks/private',id);await mkdir(pub,{recursive:true});await mkdir(raw,{recursive:true,mode:0o700});
const c=JSON.parse(await readFile(join(root,'.state/config.json')));const token=(await readFile(join(root,'.state/token'),'utf8')).trim();const apiKey=(await readFile(join(root,'.state/jev-token'),'utf8')).trim();
const r=new Runner({port:c.port,token}),camera=new Runner({port:c.port,token,timeout:2500});const ctl=new Controller(r,{deviceLaunch:deviceLauncher(c.udid)});let active,epoch,requestIndex=0;
const report={schema:1,id,kind:'Physical iPhone general intents with live JEV',source_commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),source_dirty:Boolean(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim()),source_sha256:{},device:'iPhone16ProMax / iOS26.5 / USB',repeats,tasks:fixtures.tasks,method:'All phases use live JEV with unchanged0.9 gates. Known setup/reset is excluded and separately timed. Warm timer includes fresh observation, model decisions, native input and independent fresh AX verification. Screenshot recorder up to5fps uses a separate connection; all frame request/completion intervals retained. No audio. No failed input is replayed. Every attempt and recovery is retained. This is a bounded-intent benchmark, not a human or market-wide speed comparison.',runs:[]};
for(const file of ['src/jev.mjs','src/driver.mjs','src/device-launch.mjs','scripts/benchmark-general.mjs','scripts/benchmark-general-support.mjs','scripts/phone-recorder.mjs','vendor/iphone-use/runner/IPhoneUseRunner/IPhoneUseRunnerUITests/RunnerTests.swift','vendor/iphone-use/runner/IPhoneUseRunner/IPhoneUseRunnerUITests/IPURBridge.m','vendor/iphone-use/runner/IPhoneUseRunner/IPhoneUseRunnerUITests/RunnerElements.swift',tasksPath])report.source_sha256[file.replace(root+'/','')]=createHash('sha256').update(await readFile(file)).digest('hex');
const save=()=>writeFile(join(pub,'results.json'),JSON.stringify(report,null,2)+'\n');
report.schema=2;report.kind='Physical iPhone bounded intents';report.controller_mode=selection;
report.method='Identical fresh phone tasks, unchanged0.9 JEV gates. Hybrid admits a caller-specified exact destination app and empty field/literal directly, and uses JEV for navigation choices. App launches use CoreDevice. JEV-only sends every decision to JEV. Paired mode alternates AB/BA by task and repeat. Setup and cleanup are recorded but excluded from warm task time. recording_warm_start_ms locates that timer in the capture. Every result receives an independent fresh AX check and a result screenshot before cleanup; both are timed. Capture stops if the phone locks. All failures are retained; no failed mutation is replayed.';
const chooser=new JevChooser({apiKey,fetchImpl:async(url,args)=>{const index=requestIndex++,t=performance.now();const response=await fetch(url,args),body=await response.text();if(active)await writeFile(join(raw,active.name,`jev-${index}.json`),JSON.stringify({at_ms:t-epoch,ms:performance.now()-t,request:JSON.parse(args.body),response:body},null,2));return {ok:response.ok,status:response.status,text:async()=>body};}});
async function execute(steps){if(!steps?.length)return;const v=await ctl.execute(steps);if(!v.ok)throw Error(v.error);}
function verified(s,predicate){return (!predicate.app||predicate.app===s.app)&&(!predicate.selector||s.elements.some(x=>matches(x,predicate.selector)))&&(!predicate.absent||!s.elements.some(x=>matches(x,predicate.absent)));}
try{
 assertDirectMode();if(await r.call('/wda/locked')!==false)throw Error('Phone locked; no input sent');await ensureMuted(r);
 const trials=[];for(let repeat=0;repeat<repeats;repeat++)for(const [index,task] of fixtures.tasks.entries()){const modes=selection==='paired'?((index+repeat)%2?['jev-only','hybrid']:['hybrid','jev-only']):[selection];for(const mode of modes)trials.push({repeat:repeat+1,task,mode});}
 for(const {repeat,task,mode} of trials){
  assertDirectMode();if(await r.call('/wda/locked')!==false)throw Error('Phone locked between trials; no next trial started');
  const status=await r.call('/status');if(status.busy&&status.busyMs>1500)throw Error('An earlier native request still owns the input queue; no further trial started');
  const run={name:`${String(report.runs.length+1).padStart(2,'0')}-${task.id}-${mode}`,task:task.id,mode,repeat,started_at:new Date().toISOString(),phases:[]};report.runs.push(run);await save();let recorder;
  try{
   const setupStart=performance.now();await ensureMuted(r);recorder=phoneRecorder(camera,join(raw,run.name));epoch=await recorder.start();await execute(task.setup);
   for(const target of task.setup_targets||[]){const s=await ctl.observe();const rows=s.elements.filter(x=>x.ref&&matches(x,target.selector));if(!rows.length)throw Error('Required setup target missing');if(rows.length>1&&target.placement!=='bottom')throw Error('Ambiguous setup target');const row=target.placement==='bottom'?rows.sort((a,b)=>b.rect.y-a.rect.y)[0]:rows[0];await execute([{op:'tap',ref:row.ref,snapshot:s.snapshot}]);}
   if(task.reset_text){const s=await ctl.observe(),rows=s.elements.filter(x=>matches(x,task.reset_text.selector));if(rows.length>1||(!rows.length&&!task.reset_text.when_present))throw Error('Reset needs a unique current field');const field=rows[0];if(field&&field.value&&field.value!==field.placeholder){if(!task.reset_text.owned_values.includes(field.value))throw Error('Existing unrelated text preserved; setup stopped');await execute([{op:'tap',selector:task.reset_text.clear_selector||{kind:'Button',label:'Clear text'}}]);const until=performance.now()+2000;let empty=false;do{const n=(await ctl.observe()).elements.find(x=>matches(x,task.reset_text.selector));empty=n&&(!n.value||n.value===n.placeholder);if(empty)break;}while(performance.now()<until);if(!empty)throw Error('Owned search text did not clear');}}
   if(task.ready)await ctl.wait(task.ready,{timeout:5000});run.setup_ms=performance.now()-setupStart;
   const setup=await ctl.observe();await mkdir(join(raw,run.name),{recursive:true});await writeFile(join(raw,run.name,'setup.json'),JSON.stringify(setup));
   const warmStart=performance.now();run.recording_warm_start_ms=warmStart-epoch;active=run;const trace=r.trace.length;let phasesOK=true;
   let changeBefore;
   for(const [phaseIndex,phase] of task.phases.entries()){
    const result=await runLocalGoal(ctl,{external_ui_opt_in:true,visible_controls:true,max_actions:8,timeout_ms:15000,...phase,direct_text:mode==='hybrid',direct_launch:mode==='hybrid'},{chooser,onBeforeAction:({target,observation})=>{if(task.verify_change?.phase===phaseIndex&&target.operation==='swipe')changeBefore=structuredClone(observation);}});
    run.phases.push({goal:phase.goal,ok:result.ok,reason:result.reason,actions:result.actions,chooser_calls:result.chooser_calls,events:result.events,elapsed_ms:result.elapsed_ms,outcome:result.outcome});
    await writeFile(join(raw,run.name,`phase-${run.phases.length}.json`),JSON.stringify(result.observation));if(!result.ok){phasesOK=false;break;}
   }
   const verifyStart=performance.now();let final=await ctl.observe();const end=performance.now()+3000;
   while(phasesOK&&!verified(final,task.verify)&&performance.now()<end){await new Promise(a=>setTimeout(a,25));final=await ctl.observe();}
   if(task.verify_change){
    const content=s=>s?.elements.filter(row=>row.rect&&row.rect.y>60&&row.rect.y<s.height*.85&&row.rect.y+row.rect.height>100&&((['StaticText','Cell','Link'].includes(row.kind)&&(row.label||'').length>12)||/^@/.test(row.label||''))).map(row=>[row.kind,row.label,Math.round(row.rect.y/20)]);
    const before=content(changeBefore)||[],after=content(final)||[];run.content_change={before_rows:before.length,after_rows:after.length,verified:before.length>0&&after.length>0&&JSON.stringify(before)!==JSON.stringify(after)};
    await writeFile(join(raw,run.name,'before-scroll.json'),JSON.stringify(changeBefore||null));
   }
   run.verification_ms=performance.now()-verifyStart;run.verified=verified(final,task.verify)&&(!task.verify_change||run.content_change.verified);run.actions=run.phases.reduce((a,x)=>a+x.actions,0);run.ok=phasesOK&&run.verified&&run.actions>=(task.min_actions||1);if(phasesOK&&run.verified&&run.actions<(task.min_actions||1))run.error='Starting state was already complete; excluded as a control trial';run.result_frame=await recorder.checkpoint();run.elapsed_ms=performance.now()-warmStart;run.chooser_calls=run.phases.reduce((a,x)=>a+x.chooser_calls,0);run.requests=r.trace.slice(trace);run.native_inputs=run.requests.reduce((a,x)=>a+(x.input_count||0),0);await writeFile(join(raw,run.name,'final.json'),JSON.stringify(final));
  }catch(e){run.ok=false;run.error=e.message;run.outcome=e.outcome;}
  finally{active=null;run.task_ok=run.ok;if(task.cleanup){const t=performance.now();try{run.cleanup=await cleanupTask(ctl,task);run.cleanup_ms=performance.now()-t;}catch(e){run.cleanup_error=e.message;run.ok=false;}}if(recorder)run.recording=await recorder.end();try{run.audio=await r.call('/sprint/audio')}catch{}await save();await appendFile(join(pub,'journal.jsonl'),JSON.stringify(run)+'\n');console.log(JSON.stringify({task:task.id,mode,repeat:run.repeat,ok:run.ok,ms:run.elapsed_ms,error:run.error,reasons:run.phases.map(p=>p.reason),actions:run.actions,chooser_calls:run.chooser_calls}));}
 }
}catch(e){report.fatal_error=e.message;process.exitCode=1;}finally{r.close();camera.close();report.finished_at=new Date().toISOString();await save();console.log('SESSION '+id);}
