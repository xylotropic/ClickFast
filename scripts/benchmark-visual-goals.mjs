#!/usr/bin/env node
// Caller-authored live visual intents. This never substitutes for the older AX task score.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {Runner,Controller} from '../src/driver.mjs';
import {JevChooser,runLocalGoal} from '../src/jev.mjs';
import {deviceLauncher} from '../src/device-launch.mjs';
import {localVision} from '../src/local-vision.mjs';
import {matchingVisualRows,textMovement} from '../src/visual-evidence.mjs';
import {root,assertDirectMode,ensureMuted} from '../src/cli.mjs';
import {phoneRecorder} from './phone-recorder.mjs';

const manifest=process.argv[2];if(!manifest)throw Error('Supply a manifest with distinct id and local_goal for each task');
const tasks=JSON.parse(await readFile(manifest,'utf8')).tasks;
if(!Array.isArray(tasks)||!tasks.length||tasks.length>30||new Set(tasks.map(t=>t.id)).size!==tasks.length||tasks.some(t=>typeof t.id!=='string'||!/^[-\w]{1,100}$/.test(t.id)||!t.local_goal?.until?.visual))throw Error('Distinct bounded visual tasks are required');
const config=JSON.parse(await readFile(join(root,'.state/config.json'),'utf8'));
const token=(await readFile(join(root,'.state/token'),'utf8')).trim(),apiKey=(await readFile(join(root,'.state/jev-token'),'utf8')).trim();
const runner=new Runner({port:config.port,token}),camera=new Runner({port:config.port,token});
const ctl=new Controller(runner,{deviceLaunch:deviceLauncher(config.udid)}),vision=await localVision(root);
const id=new Date().toISOString().replace(/[:.]/g,'-')+'-visual-general',directory=join(root,'benchmarks/runs',id),raw=join(root,'benchmarks/private',id);
await mkdir(directory,{recursive:true});await mkdir(raw,{recursive:true,mode:0o700});
const report={id,kind:'Live physical-phone visual intents',method:'Each task starts on verified Home. Warm timing includes local OCR, live JEV, guarded native input, and an independent fresh image check. Setup and cleanup remain separately timed. Original silent frames and raw model exchanges remain private. New visual predicates are a different task set; these do not replace AX-readiness results or establish a new Mirroring ratio.',source_sha256:{},runs:[]};
for(const f of ['src/driver.mjs','src/jev.mjs','src/visual-goal.mjs','src/visual-evidence.mjs','src/local-vision.mjs','src/ocr-worker.mjs','scripts/visual-ocr.swift','scripts/benchmark-visual-goals.mjs',manifest])report.source_sha256[f]=createHash('sha256').update(await readFile(f)).digest('hex');
const save=()=>writeFile(join(directory,'results.json'),JSON.stringify(report,null,2)+'\n');
let active,requestIndex=0;
const chooser=new JevChooser({apiKey,fetchImpl:async(url,args)=>{
 const t=performance.now(),response=await fetch(url,args),body=await response.text();
 if(active)await writeFile(join(raw,active.name,`jev-${requestIndex++}.json`),JSON.stringify({ms:performance.now()-t,request:JSON.parse(args.body),response:body}));
 return {ok:response.ok,status:response.status,text:async()=>body};
}});
try{
 assertDirectMode();if(await runner.call('/wda/locked')!==false)throw Error('Phone locked; no input sent');await ensureMuted(runner);
 for(const [i,task] of tasks.entries()){
  assertDirectMode();if(await runner.call('/wda/locked')!==false)throw Error('Phone locked; later tasks stopped');
  const run={task:task.id,name:`${String(i+1).padStart(2,'0')}-${task.id}`,mode:'local_visual_jev',started_at:new Date().toISOString()};report.runs.push(run);await save();
  const rec=phoneRecorder(camera,join(raw,run.name));let recordingStarted=false,start,beforeScroll;
  try{
   await ensureMuted(runner);const setup=performance.now();const epoch=await rec.start();recordingStarted=true;
   const home=await ctl.execute([{op:'home',observe:false}]);if(!home.ok)throw Error('Initial Home was not verified');run.setup_ms=performance.now()-setup;
   await runner.call('/wda/keepawake',{secs:120});start=performance.now();run.recording_warm_start_ms=start-epoch;active=run;
   const result=await runLocalGoal(ctl,task.local_goal,{chooser,vision,onBeforeAction:async({target,observation})=>{
    if(target.operation==='scroll'){beforeScroll=observation;const frame=await rec.checkpoint();run.before_scroll_frame=frame.file;}
   }});
   run.outcome=result.outcome;
   const fresh=await vision.capture(ctl),p=task.local_goal.until.visual;
   const markers=p.all.every(t=>matchingVisualRows(fresh.visual_rows,t).length>0)&&!(p.none||[]).some(t=>matchingVisualRows(fresh.visual_rows,t).length>0);
   if(p.moved)run.content_change=beforeScroll?textMovement(beforeScroll.visual_rows,fresh.visual_rows):{verified:false};
   run.verified=fresh.app===task.local_goal.until.app&&markers&&(!p.moved||run.content_change.verified);
   run.ok=result.ok&&run.verified&&result.actions>=(task.min_actions??1);
   run.actions=result.actions;run.chooser_calls=result.chooser_calls;run.events=result.events;run.reason=result.reason;run.outcome=result.outcome;run.result_frame=await rec.checkpoint();run.elapsed_ms=performance.now()-start;
   await writeFile(join(raw,run.name,'final.json'),JSON.stringify(fresh));
  }catch(error){run.ok=false;run.error=error.message;run.outcome=error.outcome||run.outcome||'unknown';if(start!==undefined)run.elapsed_ms=performance.now()-start;}
  finally{
   active=null;if(recordingStarted)run.recording=await rec.end();run.audio=await runner.call('/sprint/audio').catch(()=>({unavailable:true}));run.finished_at=new Date().toISOString();await save();
  }
  console.log(JSON.stringify({task:task.id,ok:run.ok,ms:run.elapsed_ms,reason:run.reason,error:run.error}));
  if(run.outcome==='unknown')throw Error('Unknown input outcome; no later trial or cleanup sent');
  const t=performance.now(),home=await ctl.execute([{op:'home',observe:false}]);run.cleanup_ms=performance.now()-t;run.cleanup_verified=home.ok;run.task_ok=run.ok;run.ok=run.ok&&home.ok;await save();if(!home.ok)throw Error('Cleanup Home failed; later trials stopped');
 }
}catch(error){report.fatal_error=error.message;process.exitCode=1;}
finally{vision.close();runner.close();camera.close();report.finished_at=new Date().toISOString();await save();console.log('SESSION '+id);}
