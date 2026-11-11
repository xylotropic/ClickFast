#!/usr/bin/env node
// Hardware timings only. No simulated delays or claims about unmeasured model speed.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {performance} from 'node:perf_hooks';
import {root,assertDirectMode} from '../src/cli.mjs';
import {Runner,Controller} from '../src/driver.mjs';
const config=JSON.parse(await readFile(join(root,'.state/config.json'),'utf8'));
const runner=new Runner({port:config.port,token:(await readFile(join(root,'.state/token'),'utf8')).trim()});
const controller=new Controller(runner);
const report={time:new Date().toISOString(),device:'physical iPhone',trials:[],scope:'Direct controller only; excludes model inference. No mirroring speedup inferred.'};
const median=rows=>{const a=rows.map(r=>r.ms).sort((a,b)=>a-b),i=Math.floor(a.length/2);return a.length%2?a[i]:(a[i-1]+a[i])/2;};
try{
 assertDirectMode();
 if(await runner.call('/wda/locked')!==false)throw new Error('Unlock the iPhone before benchmarking. No app actions were dispatched.');
 await runner.call('/wda/keepawake',{secs:900});
 const status=await runner.call('/status');
 if(status.capabilities?.sprintProtocol!==1)throw new Error('Rebuild/restart the Sprint runner first.');
 report.os=status.os;report.runner=status.build;
 // Repeated read-only comparisons alternate order to reduce warm-up/order bias.
 const initial=await controller.execute([{op:'launch',bundle:'com.apple.calculator',expect:{app:'com.apple.calculator'}}]);
 if(!initial.ok)throw new Error(`Initial app launch failed: ${initial.error}`);
 for(let round=0;round<10;round++){
  for(const mode of round%2?['one_pass','source']:['source','one_pass']){
   const start=performance.now();
   const value=mode==='one_pass'?await controller.observe():await runner.call('/source');
   if(mode==='one_pass'?!value.elements.length:!value.type)throw new Error('Invalid/empty read; no timing counted as a success.');
   report.trials.push({task:'observe_calculator',mode,round,ms:performance.now()-start,success:true});
  }
 }
 for(const bundle of ['com.apple.calculator','com.apple.mobiletimer','com.apple.Preferences']){
  for(let round=0;round<3;round++){
   const reset=await controller.execute([{op:'home',expect:{app:'com.apple.springboard'}}]);
   if(!reset.ok)throw new Error('Could not reset to Home; task comparison stopped.');
   const start=performance.now();
   const result=await controller.execute([{op:'launch',bundle,expect:{app:bundle}}]);
   report.trials.push({task:`open ${bundle}`,mode:'direct',round,ms:performance.now()-start,success:result.ok,error:result.ok?undefined:result.error});
   if(!result.ok)throw new Error('Task failed. Inspect phone state before continuing.');
  }
 }
 report.summary={};
 for(const task of new Set(report.trials.map(r=>r.task)))for(const mode of new Set(report.trials.filter(r=>r.task===task).map(r=>r.mode))){
  const rows=report.trials.filter(r=>r.task===task&&r.mode===mode);
  report.summary[`${task}/${mode}`]={count:rows.length,successes:rows.filter(r=>r.success).length,median_ms:rows.every(r=>r.success)?median(rows):null};
 }
 report.runner_calls=runner.trace;
}catch(error){report.error=error.message;report.incomplete=true;process.exitCode=1;}
finally{
 runner.close();await mkdir(join(root,'benchmarks'),{recursive:true});
 await writeFile(join(root,'benchmarks/direct.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report.summary||{error:report.error}));
}
