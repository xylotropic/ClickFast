// Load inside the authorized CUA REPL. All UI reads/actions use its supplied App handle.
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';

function dimensions(bytes){
 if(bytes.toString('ascii',1,4)==='PNG')return {width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
 let i=2;while(i+9<bytes.length){if(bytes[i]!==255){i++;continue;}const marker=bytes[i+1],length=bytes.readUInt16BE(i+2);if(length<2)break;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker))return {height:bytes.readUInt16BE(i+5),width:bytes.readUInt16BE(i+7)};i+=2+length;}throw Error('Capture dimensions unavailable');
}
const normalize=s=>String(s).normalize('NFC').replace(/[\u200e\u200f]/g,'').replace(/\s+/g,' ').trim();
export async function createSession({app,directory,ocrBinary,audioReceipt,taskManifest}){
 if(audioReceipt?.muted!==true)throw Error('A verified mute receipt is required before Mirroring input');
 await mkdir(directory,{recursive:true,mode:0o700});
 const source=await readFile(new URL(import.meta.url));await writeFile(join(directory,'harness.mjs'),source);
 const report={schema:2,mode:'ordinary Apple iPhone Mirroring through CUA',created_at:new Date().toISOString(),source_sha256:createHash('sha256').update(source).digest('hex'),audio:audioReceipt,tasks:taskManifest,method:'Real physical phone through the visible Mirroring window. All setup, inputs, independent screenshot/OCR checks and cleanup are recorded with elapsed timestamps. Timed trials start on a verified Home Screen. App opening, navigation, text, screenshots, result checks and recovery all stay inside the timer. Setup and cleanup are recorded separately. This compares control paths, not human performance or market-wide speed.',runs:[]};
 let run,epoch,warmStart,lastFrame;
 const save=()=>writeFile(join(directory,'results.json'),JSON.stringify(report,null,2)+'\n');
 async function capture(phase,{ocr=true}={}){
  if(!run)throw Error('Start a task before capture');
  const t=performance.now(),bytes=Buffer.from(await app.getScreenshot({emit:false}));
  const frame={file:String(run.frames.length).padStart(4,'0')+'.png',phase,requested_ms:t-epoch,completed_ms:performance.now()-epoch,...dimensions(bytes)};
  const path=join(directory,run.name,frame.file);await writeFile(path,bytes);run.frames.push(frame);
  if(ocr){const t=performance.now();frame.lines=JSON.parse(execFileSync(ocrBinary,[path],{encoding:'utf8',timeout:5000}));frame.ocr_ms=performance.now()-t;}
  lastFrame=frame;await save();
  if(frame.lines?.some(x=>/Connection Interrupted|iPhone in Use|Unable to Connect|iPhone Not Found/.test(x.text)))throw Error('Mirroring connection or owner takeover; no further input');
  return frame;
 }
 async function event(kind,fn,extra={}){
  if(!run)throw Error('Start a task before input');
  if(run.input_uncertain)throw Error('An earlier input has unknown delivery; inspect the screen before another action');
  const start=performance.now();try{await fn();await app.getAXState({emit:false});run.events.push({kind,...extra,at_ms:start-epoch,completed_ms:performance.now()-epoch,outcome:'submitted'});await save();return await capture(kind);}
  catch(error){run.events.push({kind,...extra,at_ms:start-epoch,completed_ms:performance.now()-epoch,outcome:'unknown',error:error.message});run.input_uncertain=true;run.uncertain_after_frame=lastFrame?.file;run.ok=false;run.error=error.message;await save();throw error;}
 }
 function point(text,{region,yOffset=0}={}){
  const f=lastFrame;if(!f?.lines)throw Error('A fresh OCR observation is required');
  const rows=f.lines.filter(x=>normalize(x.text)===normalize(text)&&(!region||region(x)));
  if(rows.length!==1)throw Error('Expected one currently visible label: '+text);
  const r=rows[0];return [(r.x+r.width/2)*f.width,(1-r.y-r.height/2)*f.height+yOffset];
 }
 return {report,capture,point,
  async start(task,{attempt=1}={}){if(run&&!run.finished_at)throw Error('Finish the prior task first');run={task,name:`${String(report.runs.length+1).padStart(2,'0')}-${task}`,attempt,started_at:new Date().toISOString(),frames:[],events:[],ok:false};report.runs.push(run);await mkdir(join(directory,run.name),{recursive:true});epoch=performance.now();warmStart=null;lastFrame=null;const tree=await app.getAXState({emit:false,disableDiffing:true});const win=tree.match(/^\s*(\d+) standard window .*Secondary Actions: Raise/m);if(!win)throw Error('Mirroring window is unavailable');await app.performSecondaryAction(Number(win[1]),'Raise');await app.getAXState({emit:false});await save();return await capture('setup-start');},
  async begin(){if(!lastFrame)throw Error('A verified starting screen is required');warmStart=performance.now();run.setup_ms=warmStart-epoch;run.recording_warm_start_ms=run.setup_ms;await save();},
  click:async p=>event('click',()=>app.click(p),{point:p}),
  key:async key=>event('key',()=>app.pressKey(key),{key}),
  type:async text=>event('text',()=>app.typeText(text),{characters:text.length}),
  scroll:async(p,direction,amount=.1)=>event('scroll',()=>app.scroll(p,direction,amount),{point:p,direction,amount}),
  async acknowledgeObservation(){if(!lastFrame||lastFrame.file===run.uncertain_after_frame)throw Error('Capture and inspect a fresh screen before recovering');(run.recoveries??=[]).push({frame:lastFrame.file,at_ms:performance.now()-epoch});run.input_uncertain=false;await save();},
  async verify(text,{predicate}={}){const deadline=performance.now()+3000;let frame,ok=false;do{frame=await capture('verify');ok=predicate?predicate(frame.lines,frame):frame.lines.some(x=>normalize(x.text)===normalize(text));if(ok)break;}while(performance.now()<deadline);run.verified=ok;run.verification={text:predicate?null:text,predicate:predicate?String(predicate):null,frame:frame.file};if(!ok)throw Error('Expected result was not independently observed');return frame;},
  async finish({ok,error}={}){if(!run)throw Error('No current task');if(warmStart!==null)run.elapsed_ms=performance.now()-warmStart;run.ok=ok===true&&run.verified===true&&run.events.length>0;if(error)run.error=error;run.finished_at=new Date().toISOString();run.total_ms=performance.now()-epoch;await save();return {task:run.task,ok:run.ok,ms:run.elapsed_ms,setup_ms:run.setup_ms,error:run.error};},
  async finishSession(){report.finished_at=new Date().toISOString();await save();return report;}
 };
}
