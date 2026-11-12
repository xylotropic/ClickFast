#!/usr/bin/env node
// Saved physical images only. This is an OCR ablation, never a live phone score.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {root} from '../src/cli.mjs';
import {localVision} from '../src/local-vision.mjs';
const session=process.argv[2];if(!/^[\w.-]+$/.test(session||''))throw Error('Supply a recorded phone session ID');
const original=JSON.parse(await readFile(join(root,'benchmarks/runs',session,'results.json'),'utf8'));
const samples=original.runs.filter(r=>r.result_frame?.file).slice(0,8);
for(const task of ['x-open','x-scroll']){const r=original.runs.find(r=>r.task===task&&r.result_frame?.file);if(r&&!samples.includes(r))samples.push(r);}
if(samples.length!==10)throw Error('Ten distinct saved task frames are required');
const id=new Date().toISOString().replace(/[:.]/g,'-')+'-offline-ocr',out=join(root,'benchmarks/runs',id);
await mkdir(out,{recursive:true});const hash=b=>createHash('sha256').update(b).digest('hex');
const report={id,kind:'Offline OCR on ten saved physical-phone images; no live input or phone task success claim',source_session:session,method:'Alternate worker/process order across ten different recorded task images. Each pair reads identical bytes, with original cold startup retained. Compare normalized text and rounded word geometry without publishing recognized UI text. The worker is local Apple Vision, not an additional model API.',source_sha256:{},runs:[]};
for(const f of ['src/local-vision.mjs','src/ocr-worker.mjs','scripts/visual-ocr.swift','scripts/benchmark-ocr.mjs'])report.source_sha256[f]=hash(await readFile(join(root,f)));
const providers={process:await localVision(root,{persistent:false}),worker:await localVision(root,{persistent:true})};
const signature=rows=>hash(JSON.stringify(rows.map(r=>({text:r.text,rect:[r.x,r.y,r.width,r.height].map(n=>Number(n.toFixed(3))),words:r.words?.map(w=>({text:w.text,rect:[w.x,w.y,w.width,w.height].map(n=>Number(n.toFixed(3)))}))})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))));
try{
 for(const [i,sample] of samples.entries()){
  const image=await readFile(join(root,'benchmarks/private',session,sample.name,sample.result_frame.file));const signatures=[];
  for(const mode of (i%2?['worker','process']:['process','worker'])){
   const t=performance.now(),rows=await providers[mode].recognize(image,{}),ms=performance.now()-t,output=signature(rows);
   signatures.push(output);report.runs.push({task:sample.task,mode,ms,rows:rows.length,source_image_sha256:hash(image),output_sha256:output});
   console.log(JSON.stringify({task:sample.task,mode,ms,rows:rows.length}));
  }
  if(signatures[0]!==signatures[1])throw Error('OCR output differs between matched modes');
 }
 report.outputs_match=true;
}catch(error){report.error=error.message;throw error;}
finally{Object.values(providers).forEach(p=>p.close());await writeFile(join(out,'results.json'),JSON.stringify(report,null,2)+'\n');console.log('SESSION '+id);}
