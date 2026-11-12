// Import only inside an authorized CUA session. No UI driver outside the supplied App API.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
export const mathCases=[
{id:'01-add',query:'7+8',expected:'15',keys:['7','+','8','=']},
{id:'02-subtract',query:'48-19',expected:'29',keys:['4','8','-','1','9','=']},
{id:'03-multiply',query:'6*7',expected:'42',keys:['6','*','7','=']},
{id:'04-divide',query:'81/9',expected:'9',keys:['8','1','/','9','=']},
{id:'05-decimal',query:'1.5+2.25',expected:'3.75',keys:['1','.','5','+','2','.','2','5','=']},
{id:'06-percent',query:'50*10%',expected:'5',keys:['5','0','*','1','0','%','=']},
{id:'07-chain',query:'(12+8)*3',expected:'60',keys:['1','2','+','8','=','*','3','=']},
];
function dimensions(bytes){
 if(bytes.toString('ascii',1,4)==='PNG')return {width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
 if(bytes[0]!==255||bytes[1]!==216)throw Error('Capture image format unsupported');
 let i=2;while(i+9<bytes.length){if(bytes[i]!==255){i++;continue;}const marker=bytes[i+1];if(marker===217||marker===218)break;const length=bytes.readUInt16BE(i+2);if(length<2)break;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker))return {height:bytes.readUInt16BE(i+5),width:bytes.readUInt16BE(i+7)};i+=2+length;}throw Error('Capture dimensions unavailable');
}
const norm=s=>String(s).replace(/[\s\u200e\u200f,]/g,'').toLowerCase();
export async function createSession({app,directory,ocrBinary,audioCheck,zeroReference}){
 await mkdir(directory,{recursive:true});const source=await readFile(new URL(import.meta.url));await writeFile(join(directory,'harness.mjs'),source);
 const report={schema:1,started_at:new Date().toISOString(),mode:'plain Apple iPhone Mirroring through CUA',harness_sha256:createHash('sha256').update(source).digest('hex'),method:'Mouse input from the current screenshot. Calculator coordinates derive from freshly observed 7/6 anchors. Planned keypad inputs share that stable layout; native AX state read after each click. Screenshot and independent local OCR result check included. Setup and result hold excluded; all frames retained. This measures the automated Mirroring path, not a human speed baseline.',runs:[]};
 const save=()=>writeFile(join(directory,'results.json'),JSON.stringify(report,null,2)+'\n');let run,epoch;
 async function capture(phase,{ocr=true,region}={}){
  const started=performance.now(),bytes=Buffer.from(await app.getScreenshot({emit:false})),finished=performance.now();
  const frame={file:String(run.capture_index++).padStart(4,'0')+'.png',phase,requested_ms:started-epoch,completed_ms:finished-epoch,...dimensions(bytes)};
  const path=join(directory,run.id,frame.file);await writeFile(path,bytes);run.frames.push(frame);
  if(ocr){const t=performance.now();frame.lines=JSON.parse(execFileSync(ocrBinary,[path,...(region?[region]:[])],{encoding:'utf8',timeout:5000}));
   if(region){
    const crop=path+'.ocr.png';
    const prepare='from PIL import Image,ImageOps\nimport sys\nim=Image.open(sys.argv[1]).convert("RGB");w,h=im.size\nx,y,a,b=map(float,sys.argv[3].split(","))\nImageOps.invert(im.crop((int(x*w),int(y*h),int((x+a)*w),int((y+b)*h)))).save(sys.argv[2])';
    execFileSync('python3',['-c',prepare,path,crop,region]);
    const extra=execFileSync('/opt/homebrew/bin/tesseract',[crop,'stdout','--psm','6'],{encoding:'utf8',timeout:5000,stdio:['ignore','pipe','pipe']});
    frame.lines.push(...extra.trim().split('\n').filter(Boolean).map(text=>({text,source:'tesseract'})));
   }
   frame.ocr_ms=performance.now()-t;}
  if(frame.lines?.some(x=>/Connection Interrupted|iPhone in Use|Unable to Connect/i.test(x.text)))throw Error('Mirroring connection/takeover; stopped');
  return frame;
 }
 function layout(f){
  const unique=t=>{const rows=f.lines.filter(r=>r.text===t&&r.y>.15&&r.y<.50);if(rows.length!==1)throw Error('Current Calculator keypad anchor missing: '+t);return rows[0]};
  const seven=unique('7'),six=unique('6');
  const x=(r)=>(r.x+r.width/2)*f.width,y=(r)=>(1-r.y-r.height/2)*f.height;
  const left=x(seven),dx=(x(six)-left)/2,top=y(seven),dy=y(six)-top;
  if(dx<50||dy<50||Math.abs(dx-dy)>40)throw Error('Observed Calculator layout changed');
  const grid={'7':[0,0],'8':[1,0],'9':[2,0],'*':[3,0],'4':[0,1],'5':[1,1],'6':[2,1],'-':[3,1],'1':[0,2],'2':[1,2],'3':[2,2],'+':[3,2],'0':[1,3],'.':[2,3],'=':[3,3],'%':[2,-1],'/':[3,-1],clear:[1,-1]};
  return {point:key=>{if(!grid[key])throw Error('Unsupported benchmark key');const [a,b]=grid[key];return [left+a*dx,top+b*dy]},region:[.03,.20,.94,Math.max(.05,(top-1.55*dy)/f.height-.20)].join(',')};
 }
 async function click(point){const t=performance.now();await app.click(point);await app.getAXState({emit:false});run.events.push({kind:'click',point,at_ms:t-epoch,finished_ms:performance.now()-epoch});}
 async function start(id){run={id,frames:[],events:[],capture_index:0,started_at:new Date().toISOString()};report.runs.push(run);await mkdir(join(directory,id),{recursive:true});epoch=performance.now();if(audioCheck)await audioCheck();const tree=await app.getAXState({emit:false,disableDiffing:true});const win=tree.match(/^\s*(\d+) standard window .*Secondary Actions: Raise/m);if(win)await app.performSecondaryAction(Number(win[1]),'Raise');await save();return performance.now();}
 async function measure(fn){run.setup_ms=performance.now()-epoch;run.setup_frames=run.frames;run.frames=[];run.setup_events=run.events;run.events=[];epoch=performance.now();try{await fn();run.ok=true;}catch(e){run.ok=false;run.error=e.message;}run.elapsed_ms=performance.now()-epoch;await capture('verified-hold',{ocr:false});await save();return {id:run.id,ok:run.ok,elapsed_ms:run.elapsed_ms,error:run.error};}
 async function open(name){
  await app.pressKey('super+1');await app.getAXState({emit:false});await app.pressKey('super+3');await app.getAXState({emit:false});await app.typeText(name);await app.getAXState({emit:false});
  const f=await capture('app-search');const rows=f.lines.filter(r=>norm(r.text)===norm(name)&&r.y>.65&&r.y<.90);if(rows.length!==1)throw Error('A unique live app result was not observed');
  const r=rows[0];await click([(r.x+r.width/2)*f.width,(1-r.y-r.height/2)*f.height]);return await capture('opened-app');
 }
 function locate(f,label,{bottom=false}={}){const rows=f.lines.filter(r=>norm(r.text)===norm(label)&&(!bottom||r.y<.16));if(rows.length!==1)throw Error('Expected unique current label: '+label);const r=rows[0];return [(r.x+r.width/2)*f.width,(1-r.y-r.height/2-(bottom?.024:0))*f.height];}
 return {report,async math(task){
  await start(task.id);try{
   let f=await capture('before-reset');let l=layout(f);await click(l.point('clear'));f=await capture('after-entry-clear');l=layout(f);await click(l.point('clear'));f=await capture('ready');l=layout(f);
   let zeroVerified=false;const resetDeadline=performance.now()+3000;
   do{const zero=await capture('reset-verify',{region:l.region});zeroVerified=zero.lines.some(x=>norm(x.text)==='0');
    if(!zeroVerified&&zeroReference){
     // Compare only the result display against a real, visually verified zero
     // capture. Single-glyph OCR can return no text for this Calculator font.
     const compare='from PIL import Image,ImageChops,ImageStat\nimport sys\na,b=[Image.open(p).convert("RGB") for p in sys.argv[1:]]\nassert a.size==b.size\nw,h=a.size;box=(int(w*.60),int(h*.34),int(w*.96),int(h*.45))\nd=ImageStat.Stat(ImageChops.difference(a.crop(box),b.crop(box)))\nprint(max(d.rms))';
     zero.zero_reference_rms=Number(execFileSync('python3',['-c',compare,join(directory,run.id,zero.file),zeroReference],{encoding:'utf8'}));zeroVerified=zero.zero_reference_rms<4;
    }
   }while(!zeroVerified&&performance.now()<resetDeadline);
   if(!zeroVerified)throw Error('Calculator zero was not independently verified');
   return await measure(async()=>{
    for(const key of task.keys){await click(l.point(key));await capture('input',{ocr:false});}
    const deadline=performance.now()+5000;do{const result=await capture('verify',{region:l.region});if(result.lines.some(x=>norm(x.text)===task.expected)){run.expected=task.expected;run.query=task.query;run.verified=true;return;}}while(performance.now()<deadline);throw Error('Expected Calculator result not observed');
   });
  }catch(e){run.ok=false;run.error=e.message;await save();return {id:run.id,ok:false,error:e.message};}
 },async navigation({id,appName,startLabel,target,verify,alreadyOpen=false}){
  await start(id);try{let f=alreadyOpen?await capture('already-open-app'):await open(appName);if(startLabel){await click(locate(f,startLabel,{bottom:true}));const deadline=performance.now()+3000;let ready=false;do{f=await capture('navigation-ready');ready=f.lines.some(r=>startLabel==='Stopwatch'?norm(r.text)==='lap':norm(r.text)==='worldclock'&&r.y>.70);}while(!ready&&performance.now()<deadline);if(!ready)throw Error('Required starting tab was not observed');}
   if(appName==='Settings'){
    for(let i=0;i<8&&!f.lines.some(r=>norm(r.text)===norm(target)&&r.y>.10&&r.y<.8);i++){await app.scroll([f.width*.5,f.height*.55],'down',.10);await app.getAXState({emit:false});f=await capture('setup-scroll');}
   }
   const point=locate(f,target,{bottom:appName==='Clock'});
   return await measure(async()=>{await click(point);const deadline=performance.now()+5000;do{const seen=await capture('verify');if(seen.lines.some(r=>norm(r.text)===norm(verify)&&r.y>(appName==='Settings'?.80:verify==='World Clock'?.70:0))){run.verified=true;run.expected=verify;return;}}while(performance.now()<deadline);throw Error('Expected navigation result not observed');});
  }catch(e){run.ok=false;run.error=e.message;await save();return {id,ok:false,error:e.message};}
 },async finish(){report.finished_at=new Date().toISOString();await save();return report;}};
}
