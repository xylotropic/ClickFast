import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {phoneRecorder} from '../scripts/phone-recorder.mjs';

async function fixture(t,locks){
 const directory=await mkdtemp(join(tmpdir(),'clickfast-recorder-'));
 t.after(()=>rm(directory,{recursive:true,force:true}));let shots=0,calls=0;
 const camera={async call(path){if(path==='/wda/locked')return locks[calls++]??false;shots++;return Buffer.from('test frame').toString('base64');}};
 return {recorder:phoneRecorder(camera,directory,{interval:60000}),directory,shots:()=>shots};
}
test('recorder never captures a locked phone and never resumes after that lock',async t=>{
 const f=await fixture(t,[true,false]);await assert.rejects(f.recorder.start(),/phone locked/);
 assert.equal((await f.recorder.end()).stopped_reason,'phone_locked');assert.equal(f.shots(),0);
 assert.deepEqual(await readdir(f.directory),['frames.json']);
});
test('recorder discards a screenshot when the phone locks during capture',async t=>{
 const f=await fixture(t,[false,true]);await assert.rejects(f.recorder.start(),/phone locked/);
 const result=await f.recorder.end();assert.equal(f.shots(),1);assert.equal(result.frames.filter(x=>x.file).length,0);
 assert.deepEqual(await readdir(f.directory),['frames.json']);
});
test('recorder keeps timestamps and saves final footage without waiting for the frame interval',async t=>{
 const f=await fixture(t,[false,false,false,false]);const start=await f.recorder.start(),result=await f.recorder.end();
 assert.equal(result.stopped_reason,'finished');assert.equal(f.shots(),2);
 assert.ok(result.frames.every(x=>x.requested_ms>=0&&x.completed_ms>=x.requested_ms));
 assert.deepEqual(JSON.parse(await readFile(join(f.directory,'frames.json'),'utf8')),result.frames);assert.ok(start>0);
});
test('a checkpoint records the verified result before a later cleanup can remove it',async t=>{
 const f=await fixture(t,[]);await f.recorder.start();const frame=await f.recorder.checkpoint();
 assert.equal(frame.file,'0001.jpg');assert.equal(f.shots(),2);const result=await f.recorder.end();assert.equal(result.frames.length,3);
});
