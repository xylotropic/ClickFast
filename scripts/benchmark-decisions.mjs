#!/usr/bin/env node
// Live chooser-only benchmark. Synthetic UI states; no phone control or phone latency claim.
import {readFile,writeFile,mkdir} from 'node:fs/promises';import {join} from 'node:path';import {performance} from 'node:perf_hooks';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
import {JevChooser} from '../src/jev.mjs';import {root} from '../src/cli.mjs';
const id=new Date().toISOString().replace(/[:.]/g,'-')+'-decisions',dir=join(root,'benchmarks/runs',id);await mkdir(dir,{recursive:true});
const key=(await readFile(root+'/.state/jev-token','utf8')).trim(),chooser=new JevChooser({apiKey:key});
const names=['Zero','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Add','Subtract','Multiply','Divide','Decimal','Percent','Equals','AllClear','Sign'];
const labels=['0','1','2','3','4','5','6','7','8','9','+','−','×','÷','.','%','=','AC','+/−'];
const controls=names.map((identifier,i)=>({ref:'fixture:'+i,kind:'Key',identifier,label:labels[i],enabled:true}));
const cases=[
 ['first-digit','Calculate 7 + 8 and press Equals.','0',[],'Seven'],
 ['operator','Calculate 7 + 8 and press Equals.','7',['Seven'],'Add'],
 ['second-operand','Calculate 7 + 8 and press Equals.','7',['Seven','Add'],'Eight'],
 ['equals','Calculate 7 + 8 and press Equals.','8',['Seven','Add','Eight'],'Equals'],
 ['multi-digit','Calculate 48 minus 19 and press Equals.','4',['Four'],'Eight'],
 ['decimal-point','Calculate 1.5 + 2.25 and press Equals.','1',['One'],'Decimal'],
 ['percent','Calculate 50 multiplied by 10 percent and press Equals.','10',['Five','Zero','Multiply','One','Zero'],'Percent'],
 ['chain','Calculate 12 plus 8, press Equals, then multiply that result by 3 and press Equals.','20',['One','Two','Add','Eight','Equals'],'Multiply'],
 ['clock-tab','Switch Clock from World Clock to Stopwatch. Only change tabs; do not start or edit anything.','World Clock',[],'Stopwatch'],
 ['settings-navigation','Open General in Settings. Do not change any setting.','Settings',[],'com.apple.settings.general'],
];
const report={schema:1,id,created_at:new Date().toISOString(),source_commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),harness_sha256:createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex'),scope:'Ten live TypeSafe/JEV API decisions on synthetic UI-state fixtures using observed iOS control vocabulary. No phone input, no screenshot/video, no task completion or real-device speed claim. One sample per state. Response gates use the controller threshold 0.9. Candidate order rotates to avoid a fixed target index.',trials:[]};
for(const [index,[name,goal,text,prior,expected]] of cases.entries()){
 let candidates=index<8?controls:index===8?['World Clock','Alarms','Stopwatch','Timers'].map(label=>({ref:label,kind:'Button',label,identifier:label,enabled:true})):[['General','com.apple.settings.general'],['Display & Brightness','com.apple.settings.display'],['Accessibility','com.apple.settings.accessibility']].map(([label,identifier])=>({ref:identifier,kind:'Button',label,identifier,enabled:true}));
 const offset=(index*7)%candidates.length;candidates=[...candidates.slice(offset),...candidates.slice(0,offset)];
 const observation={app:index<8?'com.apple.calculator':index===8?'com.apple.mobiletimer':'com.apple.Preferences',elements:[...candidates,{kind:'StaticText',label:text}]};
 const history=prior.map((identifier,step)=>({step,action:'tap',identifier,label:controls.find(x=>x.identifier===identifier)?.label}));
 const trial={name,fixture:{goal,observation,candidates,history},expected};const start=performance.now();
 try{const decision=await chooser.choose({...trial.fixture,signal:AbortSignal.timeout(10000)});trial.ms=performance.now()-start;trial.response=decision;trial.selected=/^a\d+$/.test(decision.choice)?candidates[Number(decision.choice.slice(1))]?.identifier:decision.choice;trial.correct=trial.selected===expected;trial.passed_gates=Math.min(decision.confidence,decision.selected_probability,decision.available)>=.9;trial.accepted_correct=trial.correct&&trial.passed_gates;}catch(e){trial.ms=performance.now()-start;trial.error=e.message;trial.accepted_correct=false;}
 report.trials.push(trial);await writeFile(join(dir,'results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({name,ms:trial.ms,selected:trial.selected,correct:trial.correct,gate:trial.passed_gates,error:trial.error}));
}
const median=xs=>{xs=xs.slice().sort((a,b)=>a-b);return xs.length%2?xs[(xs.length-1)/2]:(xs[xs.length/2-1]+xs[xs.length/2])/2};
report.summary={trials:report.trials.length,correct:report.trials.filter(x=>x.correct).length,accepted_correct:report.trials.filter(x=>x.accepted_correct).length,errors:report.trials.filter(x=>x.error).length,median_ms:median(report.trials.map(x=>x.ms)),min_ms:Math.min(...report.trials.map(x=>x.ms)),max_ms:Math.max(...report.trials.map(x=>x.ms)),models:[...new Set(report.trials.map(x=>x.response?.model).filter(Boolean))],input_tokens:report.trials.reduce((sum,x)=>sum+(x.response?.usage?.input_tokens||0),0),output_tokens:report.trials.reduce((sum,x)=>sum+(x.response?.usage?.output_tokens||0),0)};
report.finished_at=new Date().toISOString();await writeFile(join(dir,'results.json'),JSON.stringify(report,null,2)+'\n');
await writeFile(join(dir,'comparison.csv'),'case,ms,expected,selected,correct,passed_gates\n'+report.trials.map(x=>[x.name,x.ms,x.expected,x.selected,x.correct,x.passed_gates].join(',')).join('\n')+'\n');
console.log(JSON.stringify({session:id,summary:report.summary}));
