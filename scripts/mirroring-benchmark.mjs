// Loaded inside the authorized CUA REPL. All UI reads/actions use its supplied App handle.
// Filesystem access and Apple Vision process only screenshots already captured through CUA.
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
export const cases=[
 {id:'01-add',query:'7+8',expected:15},
 {id:'02-subtract',query:'48-19',expected:29},
 {id:'03-multiply',query:'6*7',expected:42},
 {id:'04-divide',query:'81/9',expected:9},
 {id:'05-decimal',query:'1.5+2.25',expected:3.75},
 {id:'06-percent',query:'50*10%',expected:5},
 {id:'07-parentheses',query:'(12+8)*3',expected:60},
 {id:'08-power',query:'2^8',expected:256},
 {id:'09-length',query:'8 km in miles',expected:4.97097,tolerance:0.002},
 {id:'10-temperature',query:'20 celsius in fahrenheit',expected:68},
];
const normalize=x=>String(x).toLowerCase().replace(/[\s|\u200e\u200f]/g,'').replace(/[×x]/g,'*').replace(/÷/g,'/').replace(/[−–]/g,'-');
export async function createSession({app,directory,ocrBinary,initialQuery='7+8'}){
 await mkdir(directory,{recursive:true});
 const harness=await readFile(new URL(import.meta.url));await writeFile(join(directory,'harness.mjs'),harness);
 const report={schema:1,harness_sha256:createHash('sha256').update(harness).digest('hex'),created_at:new Date().toISOString(),transport:'Apple iPhone Mirroring wireless, CUA App API',device:'Physical iPhone 16 Pro Max, iOS 26.5',scope:'Ten real Spotlight calculation/conversion tasks. This tests bulk text input and visible-result verification through Mirroring. It does not test Calculator app taps, JEV, cross-app completion, or the native XCTest transport.',audio:'Mac output mute verified on before session; no audio recording',timing:'Warm focused-field input through a fresh screenshot/OCR result check. Reset/selection and result hold are outside task timing; setup_ms and frame request/completion timestamps retained. No fixed UI-settle sleep.',runs:[]};
 let ownedQuery=initialQuery;
 const save=()=>writeFile(join(directory,'results.json'),JSON.stringify(report,null,2)+'\n');
 await save();
 async function capture(run,phase,epoch){
  const start=performance.now(),bytes=await app.getScreenshot({emit:false}),end=performance.now();
  const file=String(run.capture_index++).padStart(4,'0')+'.png';await writeFile(join(directory,run.id,file),bytes);
  const frame={file,phase,requested_ms:start-epoch,completed_ms:end-epoch,bytes:bytes.length};run.frames.push(frame);
  const ocrStart=performance.now();
  const lines=JSON.parse(execFileSync(ocrBinary,[join(directory,run.id,file)],{encoding:'utf8',timeout:5000}));
  frame.ocr_ms=performance.now()-ocrStart;
  await writeFile(join(directory,run.id,file+'.json'),JSON.stringify(lines));
  return {lines,frame};
 }
 function fieldMatches(lines,query){return lines.some(x=>x.y<.13&&normalize(x.text).replace(/^[qo]/,'').split('=')[0]===normalize(query));}
 function hasSearchBar(lines){return lines.some(x=>x.y<.13&&(/^q/i.test(x.text.trim())||normalize(x.text)==='search'||(x.y>.025&&x.y<.10&&x.x>.05&&x.x<.80)));}
 function ownedScreen(lines,query){return fieldMatches(lines,query)||(hasSearchBar(lines)&&lines.some(x=>x.y>.70&&x.y<.89&&normalize(x.text).split('=')[0]===normalize(query)));}
 function resultMatches(lines,task){
  return lines.some(x=>{if(x.y<.70||x.y>.89||x.confidence<.8)return false;
   const text=x.text.replace(/,/g,'').replace(/[−–]/g,'-');if(!/^\s*-?\d/.test(text))return false;
   // Only standalone result rows or unit-bearing conversion results count, never an equation.
   if(/[=+*/^%]/.test(text))return false;
   const n=Number(text.match(/-?\d+(?:\.\d+)?/)?.[0]);return Number.isFinite(n)&&Math.abs(n-task.expected)<=(task.tolerance??1e-9);
  });
 }
 async function menuCommand(label){
  const tree=await app.getAXState({emit:false,disableDiffing:true});
  const view=tree.match(/^\s*(\d+) View$/m);if(!view)throw Error('Mirroring View menu not observed');
  await app.click(Number(view[1]));
  const menu=await app.getAXState({emit:false,disableDiffing:true});
  const row=menu.split('\n').find(x=>x.includes(' '+label+', ID: menuAction:')&&!x.includes('(disabled)'));
  if(!row)throw Error('Mirroring navigation command unavailable');
  await app.click(Number(row.trim().match(/^\d+/)[0]));await app.getAXState({emit:false});
 }
 return {report,async run(task){
  const run={...task,started_at:new Date().toISOString(),frames:[],events:[],capture_index:0};report.runs.push(run);await mkdir(join(directory,task.id),{recursive:true});await save();
  let epoch=performance.now();
  try{
   const setupStart=performance.now();
   const initial=await capture(run,'before-reset',epoch);
   const home=lines=>lines.some(x=>normalize(x.text).replace(/^[qo]/,'')==='search'&&x.y>.13&&x.y<.30);
   if(!home(initial.lines)){
    if(!ownedScreen(initial.lines,ownedQuery))throw Error('Owned Search field not observed; no input sent');
    await menuCommand('Home Screen');
    const homeShot=await capture(run,'home-reset',epoch);
    if(!home(homeShot.lines))throw Error('Home reset not observed; stopped');
   }
   await menuCommand('Spotlight');
   let before=await capture(run,'search-ready',epoch);
   // Native Spotlight focuses/selects its field. Selection handles confuse OCR;
   // ownership was checked on the fresh pre-reset screen. Require the new field
   // here, then require an exact unselected query AND result after input.
   const focusDeadline=performance.now()+2000;
   while(!hasSearchBar(before.lines)&&performance.now()<focusDeadline)before=await capture(run,'search-ready-fresh',epoch);
   if(!hasSearchBar(before.lines))throw Error('Search field not observed; no input sent');
   run.setup_ms=performance.now()-setupStart;
   epoch=performance.now();run.timing_epoch_iso=new Date().toISOString();
   // Retain setup times separately. Timed capture timestamps are relative to this new epoch.
   run.setup_frames=run.frames;run.frames=[];
   const inputStart=performance.now();await app.typeText(task.query);run.input_ms=performance.now()-inputStart;
   run.events.push({kind:'text',text:task.query,at_ms:0,finished_ms:run.input_ms});
   ownedQuery=task.query;
   let state,deadline=performance.now()+10000;
   do{
    state=await capture(run,'verify',epoch);
    if(state.lines.some(x=>/iPhone in Use|Unable to Connect|Connection Interrupted/i.test(x.text)))throw Error('Phone takeover or connection loss; stopped');
    if(fieldMatches(state.lines,task.query)&&resultMatches(state.lines,task)){run.ok=true;run.first_matching_frame=run.frames.length-1;break;}
   }while(performance.now()<deadline);
   run.elapsed_ms=performance.now()-epoch;run.ok=run.ok===true;
   run.verification={query_observed:fieldMatches(state.lines,task.query),result_observed:resultMatches(state.lines,task),matched_card_rows:state.lines.filter(x=>x.y>.70&&x.y<.89).map(x=>({text:x.text,confidence:x.confidence}))};
   if(!run.ok)run.error='Expected query and result not both observed before deadline';
   // A three-second result hold is part of the recording, outside the measured task.
   const holdEnd=performance.now()+3000;
   while(performance.now()<holdEnd){await capture(run,'result-hold',epoch);}
  }catch(e){run.ok=false;run.error=e.message;}
  await writeFile(join(directory,task.id,'frames.json'),JSON.stringify(run.frames,null,2)+'\n');await save();
  return {id:run.id,query:run.query,ok:run.ok,elapsed_ms:run.elapsed_ms,input_ms:run.input_ms,setup_ms:run.setup_ms,error:run.error,verification:run.verification,frames:run.frames.length};
 },async finish(){report.finished_at=new Date().toISOString();await save();return report;}};
}
