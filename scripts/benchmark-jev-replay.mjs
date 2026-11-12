// Replay failed decisions from actual captured phone AX states. This is not a phone task run.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {JevChooser as CurrentChooser} from '../src/jev.mjs';
import {root} from '../src/cli.mjs';
const session=process.argv[2];if(!session)throw Error('Supply the recorded phone session id');
const reference='c7fd99ebd4fdd7440ea3f64a4a539e988a9d903e';
const referenceSource=execFileSync('git',['show',reference+':src/jev.mjs'],{cwd:root,encoding:'utf8'}).replace("from './driver.mjs'","from '../src/driver.mjs'");
await writeFile(join(root,'.state/jev-replay-before.mjs'),referenceSource);
const {JevChooser:BeforeChooser}=await import('../.state/jev-replay-before.mjs');
const apiKey=(await readFile(join(root,'.state/jev-token'),'utf8')).trim();
const before=new BeforeChooser({apiKey}),after=new CurrentChooser({apiKey});
const baseline=JSON.parse(await readFile(join(root,'benchmarks/runs',session,'results.json'),'utf8'));
const expected={'subtract':'Eight','divide':'Eight','decimal':'Two','percent':'Five','chain':'Two'};
const digest=b=>createHash('sha256').update(b).digest('hex');
const report={current_source_sha256:digest(await readFile(join(root,'src/jev.mjs'))),harness_sha256:digest(await readFile(new URL(import.meta.url))),schema:1,kind:'Live JEV replay of real phone AX captures; no phone input',reference_source:reference,phone_source_session:session,started_at:new Date().toISOString(),runs:[]};
const output=join(root,'benchmarks/runs',new Date().toISOString().replace(/[:.]/g,'-')+'-real-state-replay');await mkdir(output);
for(const [task,next] of Object.entries(expected)){
 const run=baseline.runs.find(r=>r.task===task&&r.mode==='jev');
 if(!run||run.ok)continue;
 const observation=JSON.parse(await readFile(join(root,'benchmarks/private',session,run.name+'-final.json'),'utf8'));
 const candidates=observation.elements.filter(r=>r.ref&&r.kind==='Key'&&r.identifier);
 const goal=baseline.tasks.find(t=>t.name===task).goal;
 const history=run.events.filter(e=>e.kind==='dispatch'&&e.ok).map((e,i)=>({step:i,action:'tap',label:e.target.label,identifier:e.target.identifier}));
 for(const [mode,chooser] of (report.runs.length%4? [['current',after],['before',before]]:[['before',before],['current',after]])){
  const t=performance.now();const choice=await chooser.choose({goal,observation,candidates,history,signal:AbortSignal.timeout(5000)});
  const selected=candidates[Number(choice.choice.slice(1))];
  const result={task,mode,elapsed_ms:performance.now()-t,expected_identifier:next,selected_identifier:selected?.identifier,...choice,correct:selected?.identifier===next,passes_gate:Math.min(choice.confidence,choice.selected_probability,choice.available)>=.9};report.runs.push(result);await writeFile(join(output,'results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(result));
 }
}
report.finished_at=new Date().toISOString();await writeFile(join(output,'results.json'),JSON.stringify(report,null,2)+'\n');console.log('REPORT '+output);
