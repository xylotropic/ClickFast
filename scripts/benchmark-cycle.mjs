#!/usr/bin/env node
// Reversible physical-device A/B. Both modes read, select 7, and verify its displayed value.
// Setup/clear and model reasoning are outside the timer. No stored app routine is installed.
import {readFile,writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {root,assertDirectMode,compact} from '../src/cli.mjs';
import {Runner,Controller} from '../src/driver.mjs';
const config=JSON.parse(await readFile(root+'/.state/config.json','utf8'));
const runner=new Runner({port:config.port,token:(await readFile(root+'/.state/token','utf8')).trim()});
const ctl=new Controller(runner);
const report={time:new Date().toISOString(),task:'Fresh read, select 7, verify Calculator display',trials:[],scope:'Driver-only cycle on the same phone and backend. Excludes reset, model inference and launch. No Mirroring or general posting speed ratio.'};
const flatten=node=>[node,...(node.children||[]).flatMap(flatten)];
const isSeven=rows=>rows.some(r=>(r.kind==='StaticText'||r.type==='XCUIElementTypeStaticText')&&String(r.label).replace(/\u200e/g,'')==='7');
try {
 assertDirectMode();if(await runner.call('/wda/locked')!==false)throw new Error('Device locked');
 const ready=await ctl.execute([{op:'launch',bundle:'com.apple.calculator',expect:{app:'com.apple.calculator'}}]);if(!ready.ok)throw new Error(ready.error);
 for(let round=0;round<6;round++)for(const mode of round%2?['sprint','source_then_find']:['source_then_find','sprint']){
  const resetScreen=await ctl.observe();const resetKeys=resetScreen.elements.filter(r=>r.ref&&['Clear','AllClear'].includes(r.identifier));if(resetKeys.length!==1)throw new Error('Ambiguous clear key');const clear=await ctl.execute([{op:'tap',selector:{identifier:resetKeys[0].identifier},expect:{selector:{kind:'StaticText',label:'‎0'}}}]);if(!clear.ok)throw new Error(clear.error);
  const traceStart=runner.trace.length,start=performance.now();let rows;
  if(mode==='sprint'){
   const before=await ctl.observe();const candidates=before.elements.filter(r=>r.identifier==='Seven'&&r.ref);if(candidates.length!==1)throw new Error('Ambiguous target');
   const result=await ctl.execute([{op:'tap',ref:candidates[0].ref,snapshot:before.snapshot}]);if(!result.ok)throw new Error(result.error);
   rows=result.observation.elements;
   if(!isSeven(rows))rows=(await ctl.wait({selector:{kind:'StaticText',label:'‎7'}})).elements;
  }else{
   const before=flatten(await runner.call('/source'));if(before.filter(r=>r.rawIdentifier==='Seven').length!==1)throw new Error('Target not observed');
   const refs=await runner.call('/elements',{using:'accessibility id',value:'Seven'});if(refs.length!==1)throw new Error('Ambiguous locator');
   const id=refs[0]['element-6066-11e4-a52e-4f735466cecf']||refs[0].ELEMENT;if(!id)throw new Error('Missing native handle');
   await runner.call('/element/'+encodeURIComponent(id)+'/click',{});
   const end=performance.now()+5000;
   do {rows=flatten(await runner.call('/source'));if(isSeven(rows))break;}while(performance.now()<end);
  }
  const trial={round,mode,ms:performance.now()-start,success:isSeven(rows),requests:runner.trace.slice(traceStart).map(({path,ms,bytes})=>({path:path.startsWith('/element/')?'/element/:id/click':path,ms,bytes}))};
  report.trials.push(trial);if(!trial.success)throw new Error('Displayed value was incorrect; stopped without replay');
 }
 const sample=await ctl.observe();report.payload_bytes={reading:Buffer.byteLength(JSON.stringify(compact(sample))),navigation:Buffer.byteLength(JSON.stringify(compact(sample,{view:'navigation'})))};
 report.summary={};for(const mode of ['source_then_find','sprint']){const r=report.trials.filter(x=>x.mode===mode),a=r.map(x=>x.ms).sort((a,b)=>a-b);report.summary[mode]={count:r.length,successes:r.filter(x=>x.success).length,median_ms:(a[2]+a[3])/2};}
 report.reduction_fraction=1-report.summary.sprint.median_ms/report.summary.source_then_find.median_ms;
}catch(e){report.error=e.message;report.incomplete=true;process.exitCode=1;}
finally{runner.close();await writeFile(root+'/benchmarks/selection-cycle.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.summary||report));}
