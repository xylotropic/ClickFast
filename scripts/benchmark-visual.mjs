// Read actual captured phone frames. This never edits an image or dispatches input.
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
const normalize=s=>String(s).normalize('NFC').toLocaleLowerCase('en-US').replace(/\s+/g,'');
export function readVisualFrame(directory,frame,ocrBinary){
 if(!frame?.file)throw Error('A captured frame is required for visual verification');
 return JSON.parse(execFileSync(ocrBinary,[join(directory,frame.file)],{encoding:'utf8',timeout:5000}));
}
export function visibleResult(lines,predicate){
 if(predicate.any)return predicate.any.some(option=>visibleResult(lines,option));
 const labels=lines.filter(x=>x.confidence>=.5).map(x=>normalize(x.text));
 return labels.length>=(predicate.min_lines||1)&&(predicate.all||[]).every(alternatives=>alternatives.some(text=>labels.some(label=>label.includes(normalize(text)))));
}
export async function waitForVisualFrame(recorder,directory,predicate,ocrBinary,{timeout=3000}={}){
 const deadline=performance.now()+timeout;let frame,lines,verified;
 do{frame=await recorder.checkpoint();lines=readVisualFrame(directory,frame,ocrBinary);verified=visibleResult(lines,predicate);if(verified)break;}while(performance.now()<deadline);
 return {frame,lines,verified};
}
export function visibleContentChange(before,after){
 const content=lines=>lines.filter(x=>x.confidence>=.5&&x.text.trim().length>=8&&1-x.y-x.height/2>.16&&1-x.y-x.height/2<.88).map(x=>[normalize(x.text),Math.round((1-x.y-x.height/2)*50)]);
 const a=content(before),b=content(after);
 return {before_rows:a.length,after_rows:b.length,verified:a.length>=2&&b.length>=2&&JSON.stringify(a)!==JSON.stringify(b)};
}
// A delivery receipt precedes app rendering. Observe the result; never repeat the swipe.
export async function waitForVisualChange(before,readNext,{timeout=2000,now=()=>performance.now()}={}){
 const deadline=now()+timeout;let capture,change;
 do{capture=await readNext();change=visibleContentChange(before,capture.lines);if(change.verified)break;}while(now()<deadline);
 return {...capture,change};
}
