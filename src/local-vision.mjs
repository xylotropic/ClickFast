import {execFile} from 'node:child_process';
import {mkdir,mkdtemp,readFile,writeFile,unlink,rmdir} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {validVisualRow} from './visual-evidence.mjs';
import {OcrWorker} from './ocr-worker.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export class PhoneVision {
 constructor(recognize){this.recognize=recognize;}
 async capture(controller,{signal}={}){
  const r=controller.runner,first=await controller.observe({pixelsOnly:true,signal});
  if(await r.call('/wda/locked',undefined,{signal})!==false)throw Error('Phone locked; no visual capture');
  const image=await r.call('/screenshot?max_side=1200&format=jpeg&quality=0.85',undefined,{signal});
  if(await r.call('/wda/locked',undefined,{signal})!==false)throw Error('Phone locked during capture; image discarded');
  const bytes=Buffer.from(typeof image==='string'?image:image?.data||'','base64');
  if(!bytes.length||bytes.length>16*1024*1024)throw Error('Visual capture is missing or exceeds limit');
  const rows=await this.recognize(bytes,{signal});
  if(!Array.isArray(rows)||rows.length>1000)throw Error('Invalid local OCR response');
  const current=await controller.observe({pixelsOnly:true,signal});
  if(current.app!==first.app||current.width!==first.width||current.height!==first.height)throw Error('App or geometry changed during visual capture; no input sent');
  if(![current.width,current.height].every(n=>Number.isFinite(n)&&n>0))throw Error('Visual screen geometry is unavailable');
  return {...current,visual_rows:rows.filter(validVisualRow)};
 }
}

// Compile explicitly with setup-vision.mjs. Runtime uses no packages or cloud OCR.
// Raw images live only in a private temporary directory until OCR completes.
export async function localVision(root,{persistent=true}={}){
 const state=join(root,'.state'),binary=join(state,'visual-ocr'),source=join(root,'scripts/visual-ocr.swift');
 let manifest;
 try{manifest=JSON.parse(await readFile(join(state,'visual-ocr.json'),'utf8'));}
 catch{throw Error('Run node scripts/setup-vision.mjs to enable local visual navigation');}
 if(manifest.source_sha256!==hash(await readFile(source))||manifest.binary_sha256!==hash(await readFile(binary)))throw Error('Local OCR build changed; rerun scripts/setup-vision.mjs');
 await mkdir(join(state,'visual-captures'),{recursive:true,mode:0o700});
 const worker=persistent?new OcrWorker(binary):null;
 const vision=new PhoneVision(async(bytes,{signal})=>{
  signal?.throwIfAborted();const directory=await mkdtemp(join(state,'visual-captures/frame-')),file=join(directory,'frame.jpg');
  try{
   await writeFile(file,bytes,{mode:0o600});
   if(worker)return await worker.recognize(file,{signal});
   const output=await new Promise((resolve,reject)=>execFile(binary,[file],{signal,timeout:5000,maxBuffer:1024*1024,encoding:'utf8'},(error,stdout)=>error?reject(Error('Local screenshot OCR failed')):resolve(stdout)));
   return JSON.parse(output);
  }finally{await unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e;});await rmdir(directory);}
 });
 vision.close=()=>worker?.close();
 Object.defineProperty(vision,'closed',{get:()=>worker?.closed||false});
 return vision;
}
