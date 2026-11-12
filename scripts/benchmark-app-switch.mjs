// Compare the same app-only predicate with and without an AX tree read.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';import {performance} from 'node:perf_hooks';
import {Runner,Controller} from '../src/driver.mjs';import {deviceLauncher} from '../src/device-launch.mjs';
import {ensureMuted,assertDirectMode} from '../src/cli.mjs';import {phoneRecorder} from './phone-recorder.mjs';
const root=resolve(new URL('../',import.meta.url).pathname),config=JSON.parse(await readFile(join(root,'.state/config.json'),'utf8'));
const token=(await readFile(join(root,'.state/token'),'utf8')).trim();
const runner=new Runner({token}),camera=new Runner({token});
const ctl=new Controller(runner,{deviceLaunch:deviceLauncher(config.udid)});
const id=new Date().toISOString().replace(/[:.]/g,'-')+'-app-switch',directory=join(root,'benchmarks/private',id);
const apps=['com.apple.Preferences','com.apple.iBooks','com.atebits.Tweetie2','com.apple.mobiletimer'];
const report={id,kind:'Physical foreground-app predicate A/B; not a content-ready or general-task benchmark',method:'Alternating AX and frame-only postcondition checks on the same app launch and return Home. Both verify exact foreground bundles; neither claims the app content has finished loading. Every run starts on verified Home. Full elapsed time includes input and condition reads. Silent timestamped screenshots captured separately.',runs:[]};
await mkdir(directory,{recursive:true});const rec=phoneRecorder(camera,join(directory,'capture'),{interval:250});let recordingStarted=false;
try{
 assertDirectMode();await ensureMuted(runner);if(await runner.call('/wda/locked')!==false)throw Error('Phone locked');
 const home=await ctl.execute([{op:'home',observe:false}]);if(!home.ok)throw Error('Initial Home was not verified');await rec.start();recordingStarted=true;
 for(let repeat=0;repeat<2;repeat++)for(const bundle of apps)for(const mode of (repeat?['frame','ax']:['ax','frame'])){
  const t=performance.now(),result=await ctl.execute([{op:'launch',bundle,observe:mode==='ax'},{op:'home',observe:mode==='ax'}],{timeout:15000});
  const run={repeat,bundle,mode,ok:result.ok,elapsed_ms:performance.now()-t,timings:result.timings,error:result.error,outcome:result.outcome};
  report.runs.push(run);await rec.checkpoint();await writeFile(join(directory,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(run));
  if(!result.ok){const recovered=await ctl.execute([{op:'home',observe:false}]);if(!recovered.ok)throw Error('Home recovery failed; no further input');}
 }
}finally{if(recordingStarted)report.recording=await rec.end();report.audio=await runner.call('/sprint/audio').catch(()=>({unavailable:true}));await writeFile(join(directory,'results.json'),JSON.stringify(report,null,2));runner.close();camera.close()}
console.log('SAVED '+directory);
