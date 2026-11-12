// Read actual captured phone frames. This never edits an image or dispatches input.
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
const normalize=s=>String(s).normalize('NFC').toLocaleLowerCase('en-US').replace(/\s+/g,'');
export function readVisualFrame(directory,frame,ocrBinary){
 if(!frame?.file)throw Error('A captured frame is required for visual verification');
 return JSON.parse(execFileSync(ocrBinary,[join(directory,frame.file)],{encoding:'utf8',timeout:5000}));
}
export function visibleResult(lines,predicate){
 const labels=lines.filter(x=>x.confidence>=.5).map(x=>normalize(x.text));
 return labels.length>=(predicate.min_lines||1)&&!(predicate.none||[]).some(text=>labels.some(label=>label.includes(normalize(text))))&&(!predicate.any||predicate.any.some(option=>visibleResult(lines,option)))&&(predicate.all||[]).every(alternatives=>alternatives.some(text=>labels.some(label=>label.includes(normalize(text)))));
}
export async function waitForVisualFrame(recorder,directory,predicate,ocrBinary,{timeout=3000}={}){
 const deadline=performance.now()+timeout;let frame,lines,verified;
 do{frame=await recorder.checkpoint();lines=readVisualFrame(directory,frame,ocrBinary);verified=visibleResult(lines,predicate);if(verified)break;}while(performance.now()<deadline);
 return {frame,lines,verified};
}
export function visibleContentChange(before,after){
 const content=lines=>lines.filter(x=>x.confidence>=.5&&x.text.trim().length>=8&&1-x.y-x.height/2>.16&&1-x.y-x.height/2<.88).map(x=>[normalize(x.text),1-x.y-x.height/2]);
 const a=content(before),b=content(after);
 // Playback, counters, subtitles and OCR noise can change while a feed stays put.
 // Require two unique readable anchors to move together, rather than accepting
 // any changed text. A full-page replacement without shared anchors needs vision.
 const unique=(rows,text)=>rows.filter(r=>r[0]===text).length===1;
 const shifts=a.filter(([text])=>unique(a,text)&&unique(b,text)).map(([text,y])=>({text,delta:b.find(r=>r[0]===text)[1]-y})).filter(r=>Math.abs(r.delta)>=.025);
 const coherent=shifts.find(anchor=>shifts.filter(r=>Math.sign(r.delta)===Math.sign(anchor.delta)&&Math.abs(r.delta-anchor.delta)<=.02).length>=2);
 return {before_rows:a.length,after_rows:b.length,moved_anchors:shifts.length,verified:Boolean(coherent),method:'At least two unique body-text anchors move together by at least 2.5% of the frame',...(!coherent?{reason:'No coherent text movement; changed video pixels or replaced text alone require visual review'}:{direction:coherent.delta>0?'down':'up'})};
}
// A delivery receipt precedes app rendering. Observe the result; never repeat the swipe.
export async function waitForVisualChange(before,readNext,{timeout=2000,now=()=>performance.now()}={}){
 const deadline=now()+timeout;let capture,change;
 do{capture=await readNext();change=visibleContentChange(before,capture.lines);if(change.verified)break;}while(now()<deadline);
 return {...capture,change};
}
