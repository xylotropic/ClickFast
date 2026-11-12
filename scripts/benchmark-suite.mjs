#!/usr/bin/env node
// Physical-device paired tasks. Credentials and raw captures stay in ignored private storage.
import {readFile,writeFile,mkdir,appendFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {Runner,Controller,matches} from '../src/driver.mjs';
import {JevChooser,runLocalGoal} from '../src/jev.mjs';
import {root,assertDirectMode,ensureMuted} from '../src/cli.mjs';
const id=new Date().toISOString().replace(/[:.]/g,'-');
const publicDir=join(root,'benchmarks/runs',id),privateDir=join(root,'benchmarks/private',id);
await mkdir(publicDir,{recursive:true});await mkdir(privateDir,{recursive:true,mode:0o700});
const config=JSON.parse(await readFile(root+'/.state/config.json','utf8'));
const token=(await readFile(root+'/.state/token','utf8')).trim();
const runner=new Runner({port:config.port,token}),camera=new Runner({port:config.port,token});
const modes=process.argv.includes('--ab-bursts')?['single_tap','burst']:['batch','jev'];
const defaultBursts=!process.argv.includes('--single-tap');
const scopedJev=process.argv.includes('--scoped-jev');
const ctl=new Controller(runner,{keyBursts:defaultBursts}),chooser=modes.includes('jev')?new JevChooser({apiKey:(await readFile(root+'/.state/jev-token','utf8')).trim()}):null;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const clean=s=>String(s??'').replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,'').trim();
const digitIds=['Zero','One','Two','Three','Four','Five','Six','Seven','Eight','Nine'];
const calc='com.apple.calculator',clock='com.apple.mobiletimer',settings='com.apple.Preferences';
const math=[
 ['add','7 + 8','15',['7','+','8','=']],
 ['subtract','48 − 19','29',['4','8','-','1','9','=']],
 ['multiply','6 × 7','42',['6','*','7','=']],
 ['divide','81 ÷ 9','9',['8','1','/','9','=']],
 ['decimal','1.5 + 2.25','3.75',['1','.','5','+','2','.','2','5','=']],
 ['percent','50 × 10%','5',['5','0','*','1','0','%','=']],
 ['chain','(12 + 8) × 3','60',['1','2','+','8','=','*','3','=']],
].map(([name,expression,expected,tokens])=>({name,expression,expected,tokens,app:calc,goal:name==='chain'?'Calculate 12 plus 8, press Equals, then multiply that result by 3 and press Equals. Finish with the displayed result 60.':`Calculate ${expression} in Calculator and press Equals. Finish with the displayed result ${expected}.`,until:{selector:{kind:'StaticText',label:'\u200e'+expected},after_action:{kind:'Key',identifier:'Equals'}}}));
const tasks=[...math,
 {name:'clock-stopwatch',app:clock,start:'World Clock',goal:'Switch Clock from World Clock to Stopwatch. Only change tabs; do not start, stop, reset, add or edit anything.',steps:[{kind:'Button',label:'Stopwatch'}],until:{selector:{kind:'Button',label:'Lap'}}},
 {name:'clock-world-clock',app:clock,start:'Stopwatch',goal:'Switch Clock from Stopwatch to World Clock. Only change tabs; do not add, remove or edit anything.',steps:[{kind:'Button',label:'World Clock'}],until:{selector:{kind:'NavigationBar',label:'World Clock'}}},
 {name:'settings-general',app:settings,goal:'Open General in Settings. Do not change any setting.',steps:[{kind:'Button',identifier:'com.apple.settings.general'}],until:{selector:{kind:'NavigationBar',label:'General'}}},
];
const manifest={schema:1,id,created_at:new Date().toISOString(),source_commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),harness_sha256:execFileSync('shasum',['-a','256',new URL(import.meta.url).pathname],{encoding:'utf8'}).trim().split(' ')[0],environment:{node:process.version,os:'iOS 26.5',device:'iPhone 16 Pro Max',transport:'USB',audio:'Media volume verified zero before each run'},method:{modes:['batch','jev'],order:'Alternated per task',repeats_per_mode_per_task:1,recording:'Native screenshots at at most 3 fps, 1000px long edge, JPEG quality 0.65. Separate HTTP connection/capture lane. No audio. Capture timestamps recorded; encoding happens after all measurements.',timing:'After reset and initial video frame: fresh observation, actions, independent fresh AX verification. Recording continues during both modes. Reset, launch, first camera frame and encoding excluded; setup duration recorded separately.',limits:'Ten different tasks, one pair each. No statistical per-task latency claim. Scripted batch is an execution floor with known steps, not a competing general planner. JEV must choose among current permitted keys/tabs. General cross-app reliability and end-to-end agent speed are not established.'},tasks:tasks.map(({tokens,steps,until,...t})=>({...t,expected_actions:tokens?.length||steps.length,verification:until})),runs:[]};
manifest.key_bursts_enabled=ctl.keyBursts;
manifest.jev_scope=scopedJev?'Unique keys required by this task; no ordering supplied to chooser':'All current Calculator keys';
manifest.method.modes=modes;
if(process.argv.includes('--ab-bursts'))manifest.method.limits='Paired numeric-burst on/off comparison through the same native runner and verifier. Known action sequences, not a planner comparison or a human benchmark. One pair per task; all failures retained.';
manifest.source_dirty=execFileSync('git',['status','--porcelain','--','src','scripts','vendor'],{cwd:root,encoding:'utf8'}).trim().length>0;
manifest.source_files_sha256={};
for(const file of ['src/driver.mjs','src/jev.mjs','src/cli.mjs','vendor/iphone-use/runner/IPhoneUseRunner/IPhoneUseRunnerUITests/RunnerTests.swift','vendor/iphone-use/runner/IPhoneUseRunner/IPhoneUseRunnerUITests/IPURBridge.m'])manifest.source_files_sha256[file]=createHash('sha256').update(await readFile(join(root,file))).digest('hex');
await writeFile(join(privateDir,'harness.mjs'),await readFile(new URL(import.meta.url)));
let active=null,runEpoch=0;
const originalAct=ctl.act.bind(ctl);
ctl.act=async function(step,options){
 const target=step.op==='tap'?(step.ref?this.current?.elements.find(x=>x.ref===step.ref):this.current?.elements.find(x=>step.selector&&matches(x,step.selector))):null;
 const event={kind:'dispatch',at_ms:performance.now()-runEpoch,op:step.op,target:target?{kind:target.kind,label:target.label,identifier:target.identifier}:step.selector};
 try{const r=await originalAct(step,options);event.ok=true;return r;}catch(e){event.ok=false;event.error=e.message;event.outcome=e.outcome;throw e;}finally{event.finished_ms=performance.now()-runEpoch;if(active)active.push(event);}
};
async function writeManifest(){await writeFile(join(publicDir,'results.json'),JSON.stringify(manifest,null,2)+'\n');}
async function waitUnlocked(){
 let notified=false;const end=Date.now()+300000;
 while(await runner.call('/wda/locked')!==false){if(!notified){console.log('WAITING_FOR_UNLOCK '+id);notified=true;}if(Date.now()>end)throw Error('Phone stayed locked; no test input sent');await sleep(500);}
}
async function exec(steps){const r=await ctl.execute(steps);if(!r.ok)throw Error(r.error);return r;}
async function setup(task){
 await waitUnlocked();assertDirectMode();await ensureMuted(runner);
 await exec([{op:'launch',bundle:task.app,expect:{app:task.app}}]);
 if(task.app===calc){
  let s=await ctl.observe();let clear=s.elements.find(r=>r.ref&&['Clear','AllClear'].includes(r.identifier));if(!clear)throw Error('No Calculator clear target');
  await exec([{op:'tap',selector:{identifier:clear.identifier}}]);s=await ctl.observe();
  // C clears the entry; AC clears pending operations. Re-observe before every input.
  const all=s.elements.find(r=>r.ref&&r.identifier==='AllClear');if(all)await exec([{op:'tap',selector:{identifier:'AllClear'}}]);
  s=await ctl.wait({app:calc,selector:{kind:'StaticText',label:'\u200e0'}});
  const ops={'+':['Add'],'-':['Subtract'],'*':['Multiply'],'/':['Divide'],'=':['Equals'],'.':['Decimal','DecimalSeparator'],'%':['Percent','Percentage']};
  task.steps=task.tokens.map(t=>{const ids=/^\d$/.test(t)?[digitIds[Number(t)]]:ops[t];let rows=s.elements.filter(x=>x.ref&&x.kind==='Key'&&(ids.includes(x.identifier)||x.label===t));if(rows.length!==1)throw Error(`Missing unique Calculator key ${t}; ids=${s.elements.filter(x=>x.kind==='Key').map(x=>x.identifier).join(',')}`);return {kind:'Key',identifier:rows[0].identifier};});
  task.allowed=s.elements.filter(x=>x.ref&&x.kind==='Key'&&x.identifier).map(x=>({kind:'Key',identifier:x.identifier}));
  if(scopedJev)task.allowed=task.allowed.filter(x=>task.steps.some(step=>step.identifier===x.identifier));
 }else if(task.app===clock){
  await exec([{op:'tap',selector:{kind:'Button',label:task.start}}]);
  await ctl.wait({selector:task.start==='Stopwatch'?{kind:'Button',label:'Lap'}:{kind:'NavigationBar',label:'World Clock'}});
  task.allowed=['World Clock','Alarms','Stopwatch','Timers'].map(label=>({kind:'Button',label}));
 }else{
  let s=await ctl.observe();for(let i=0;i<5&&!s.elements.some(x=>x.identifier==='com.apple.settings.general');i++){
   const back=s.elements.filter(x=>x.ref&&x.kind==='Button'&&['Settings','Back','General'].includes(x.label));if(back.length!==1)throw Error('Settings root reset requires an unambiguous back control');
   await exec([{op:'tap',selector:{kind:'Button',label:back[0].label}}]);s=await ctl.observe();
  }
  if(!s.elements.some(x=>x.identifier==='com.apple.settings.general'))throw Error('Settings root not observed');
  // A partially visible row is not an admitted tap target. Scroll explicitly
  // during setup; never weaken the native full-frame check to make a test pass.
  for(let i=0;i<6;i++){
   const row=s.elements.find(x=>x.identifier==='com.apple.settings.general');
   if(row&&row.rect.y>=0&&row.rect.y+row.rect.height<=s.height)break;
   await exec([{op:'swipe',x1:s.width*.5,y1:s.height*.75,x2:s.width*.5,y2:s.height*.60,duration_ms:200}]);s=await ctl.observe();
  }
  task.allowed=[...task.steps,{kind:'Button',identifier:'com.apple.settings.display'},{kind:'Button',identifier:'com.apple.settings.accessibility'}];
  let lastRect=null,stableSince=performance.now(),stable=false;
  const deadline=performance.now()+2500;
  while(performance.now()<deadline){
   s=await ctl.observe();const row=s.elements.find(x=>x.identifier==='com.apple.settings.general');
   const rect=row?.rect;
   if(!rect||rect.y<0||rect.y+rect.height>s.height)throw Error('General is not fully visible after setup scroll');
   if(!lastRect||['x','y','width','height'].some(k=>Math.abs(lastRect[k]-rect[k])>.1))stableSince=performance.now();
   else if(performance.now()-stableSince>=150){stable=true;break;}
   lastRect=rect;
  }
  if(!stable)throw Error('General target did not stabilize during setup');
 }
 await ensureMuted(runner);ctl.current=null;
}
function record(name){
 let stopping=false,frames=[],loop=null;const dir=join(privateDir,name);
 async function capture(){const started=performance.now();try{const bytes=await camera.call('/screenshot?max_side=1000&format=jpeg&quality=0.65');const finished=performance.now(),file=String(frames.length).padStart(4,'0')+'.jpg';const buffer=Buffer.from(bytes,'base64');await writeFile(join(dir,file),buffer);frames.push({file,bytes:buffer.length,requested_ms:started-runEpoch,completed_ms:finished-runEpoch,capture_ms:finished-started});}catch(e){frames.push({error:e.message,requested_ms:started-runEpoch,completed_ms:performance.now()-runEpoch});}}
 return {async start(){await mkdir(dir,{recursive:true});await capture();if(!frames[0].file||frames[0].bytes<1000)throw Error('Recorder did not capture a usable initial frame');const shift=performance.now()-runEpoch;for(const frame of frames){frame.requested_ms-=shift;frame.completed_ms-=shift;}runEpoch=performance.now();loop=(async()=>{while(!stopping){await sleep(333);if(!stopping)await capture();}})();},async stop(){stopping=true;await loop;await capture();await writeFile(join(dir,'frames.json'),JSON.stringify(frames,null,2));return {directory:name,frames,frame_count:frames.filter(x=>x.file).length};}};
}
try{
 assertDirectMode();await waitUnlocked();await ensureMuted(runner);await runner.call('/wda/keepawake',{secs:900});
 for(const [index,task] of tasks.entries())for(const mode of index%2?[...modes].reverse():modes){
  ctl.keyBursts=mode==='single_tap'?false:defaultBursts;
  const name=String(index+1).padStart(2,'0')+'-'+task.name+'-'+mode;const run={name,task:task.name,mode,ordinal:manifest.runs.length+1,started_at:new Date().toISOString(),events:[]};manifest.runs.push(run);await writeManifest();
  let recorder;
  try{
   const setupStart=performance.now();await setup(task);run.setup_ms=performance.now()-setupStart;console.log('RUN '+name);
   runEpoch=performance.now();recorder=record(name);await recorder.start();active=run.events;const traceStart=runner.trace.length;
   let result;
   if(mode!=='jev'){
    await ctl.observe();run.plan=task.steps;run.execution_started_ms=performance.now()-runEpoch;
    result=await ctl.execute(task.steps.map(selector=>({op:'tap',selector})));run.actions=result.completed.length;
    run.execution_timings=result.timings;run.uncertain_steps=result.uncertain_steps;
   }else{
    result=await runLocalGoal(ctl,{external_ui_opt_in:true,goal:task.goal,apps:[task.app],allowed_selectors:task.allowed,until:task.until,max_actions:12,timeout_ms:30000},{chooser});run.actions=result.actions;run.chooser_calls=result.chooser_calls;run.decisions=result.events;
   }
   run.execution_ok=result.ok;run.reason=result.reason||result.error;run.outcome=result.outcome;
   const verificationStart=performance.now();
   // Independent fresh read, even after JEV's own completion predicate.
   const observed=await ctl.observe();run.verified=observed.app===task.app&&observed.elements.some(r=>matches(r,task.until.selector));
   run.verification_ms=performance.now()-verificationStart;run.elapsed_ms=performance.now()-runEpoch;run.ok=result.ok&&run.verified;
   run.verification={app:observed.app,selector:task.until.selector,matched:run.verified};
   await writeFile(join(privateDir,name+'-final.json'),JSON.stringify(observed));
   run.requests=runner.trace.slice(traceStart).map(x=>({...x,path:x.path.startsWith('/element/')?'/element/:id/click':x.path}));
  }catch(error){run.ok=false;run.error=error.message;run.outcome=error.outcome||'stopped';if(!recorder){try{const s=await ctl.observe();await writeFile(join(privateDir,name+'-setup-failure.json'),JSON.stringify(s));if(s.app===calc)console.log('SETUP_CALC '+JSON.stringify(s.elements.filter(x=>['Key','StaticText'].includes(x.kind)).map(x=>({kind:x.kind,label:x.label,id:x.identifier}))));}catch{}throw error;}}
  finally{active=null;if(recorder)run.recording=await recorder.stop();try{run.audio_after=await runner.call('/sprint/audio');}catch{run.audio_after={unavailable:true};}await writeManifest();await appendFile(join(publicDir,'journal.jsonl'),JSON.stringify(run)+'\n');console.log(JSON.stringify({name,ok:run.ok,ms:run.elapsed_ms,error:run.error,reason:run.reason,actions:run.actions}));}
  // No failed input is replayed. The next named run gets a fresh, explicit reset.
 }
}catch(e){manifest.fatal_error=e.message;process.exitCode=1;}
finally{runner.close();camera.close();manifest.finished_at=new Date().toISOString();await writeManifest();console.log('SESSION '+publicDir);}
