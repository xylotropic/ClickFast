import test from 'node:test';import assert from 'node:assert/strict';
import {OcrWorker} from '../src/ocr-worker.mjs';
const script=`const r=require('readline').createInterface({input:process.stdin});r.on('line',l=>{const q=JSON.parse(l);process.stdout.write(JSON.stringify({id:q.id,lines:[{text:q.path}]})+'\\n');});`;
test('one local worker correlates consecutive OCR reads',async t=>{
 const w=new OcrWorker(process.execPath,['-e',script]);t.after(()=>w.close());
 assert.deepEqual(await w.recognize('first'),[{text:'first'}]);const pid=w.child.pid;
 assert.deepEqual(await w.recognize('second'),[{text:'second'}]);assert.equal(w.child.pid,pid);
});
test('a stale OCR reply retires the worker rather than becoming the next frame',async t=>{
 const w=new OcrWorker(process.execPath,['-e',script.replace('id:q.id','id:q.id+1')]);t.after(()=>w.close());
 await assert.rejects(w.recognize('image'),/stale/);assert.equal(w.closed,true);
 await assert.rejects(async()=>w.recognize('next'),/closed/);
});
test('interrupting a slow OCR read rejects it and closes only its own worker',async t=>{
 const w=new OcrWorker(process.execPath,['-e',`process.stdin.resume();`]);t.after(()=>w.close());const abort=new AbortController();
 const read=w.recognize('image',{signal:abort.signal});abort.abort();
 await assert.rejects(read,/interrupted/);assert.equal(w.closed,true);assert.equal(w.pending,null);
});
test('OCR IPC preserves Unicode split across stream chunks',async t=>{
 const unicode=`process.stdin.once('data',b=>{const q=JSON.parse(b.toString()),v=Buffer.from(JSON.stringify({id:q.id,lines:[{text:'é東京'}]})+'\\n');const i=v.indexOf(Buffer.from('é'))+1;process.stdout.write(v.subarray(0,i));setTimeout(()=>process.stdout.write(v.subarray(i)),10);});`;
 const w=new OcrWorker(process.execPath,['-e',unicode]);t.after(()=>w.close());
 assert.deepEqual(await w.recognize('image'),[{text:'é東京'}]);
});
