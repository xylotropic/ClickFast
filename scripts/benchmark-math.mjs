#!/usr/bin/env node
import {readFile,writeFile} from 'node:fs/promises';import {performance} from 'node:perf_hooks';
import {Runner,Controller} from '../src/driver.mjs';import {JevChooser,runLocalGoal} from '../src/jev.mjs';import {root,assertDirectMode,ensureMuted} from '../src/cli.mjs';
const config=JSON.parse(await readFile(root+'/.state/config.json','utf8'));
const runner=new Runner({port:config.port,token:(await readFile(root+'/.state/token','utf8')).trim()}),c=new Controller(runner);
const prior=JSON.parse(await readFile(root+'/benchmarks/calculator-task.json','utf8'));
const report={...prior,jev_attempts:[...(prior.jev_attempts||[]),...(prior.jev||[])],jev:[],jev_scope:'Live TypeSafe API, same four permitted current Calculator keys, fresh screen at every decision, independent result15 check. Selected screen text sent under explicit benchmark opt-in. No extra model used for generating text.'};
const chooser=new JevChooser({apiKey:(await readFile(root+'/.state/jev-token','utf8')).trim()});
try{
 assertDirectMode();await ensureMuted(runner);
 const launch=await c.execute([{op:'launch',bundle:'com.apple.calculator',expect:{app:'com.apple.calculator'}}]);if(!launch.ok)throw new Error(launch.error);
 await runner.call('/wda/keepawake',{secs:900});
 for(let round=0;round<3;round++){
  const s=await c.observe(),clear=s.elements.find(r=>r.ref&&['Clear','AllClear'].includes(r.identifier));if(!clear)throw new Error('Ambiguous reset');
  const reset=await c.execute([{op:'tap',selector:{identifier:clear.identifier},expect:{selector:{kind:'StaticText',label:'‎0'}}}]);if(!reset.ok)throw new Error(reset.error);
  const start=performance.now();const result=await runLocalGoal(c,{goal:'In Calculator, calculate 7 + 8. Tap 7, then Add, then8, then Equals, once each. The goal is reached only when the result15 is visibly displayed.',apps:['com.apple.calculator'],allowed_selectors:['Seven','Add','Eight','Equals'].map(identifier=>({kind:'Key',identifier})),until:{selector:{kind:'StaticText',label:'‎15'}},external_ui_opt_in:true,max_actions:4,timeout_ms:30000},{chooser});
  report.jev.push({round,ms:performance.now()-start,ok:result.ok,reason:result.reason,outcome:result.outcome,actions:result.actions,chooser_calls:result.chooser_calls,events:result.events});
  await writeFile(root+'/benchmarks/calculator-task.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.jev.at(-1)));
  if(!result.ok)break;
 }
}catch(error){report.jev_error=error.message;process.exitCode=1;}
finally{runner.close();await writeFile(root+'/benchmarks/calculator-task.json',JSON.stringify(report,null,2)+'\n');}
