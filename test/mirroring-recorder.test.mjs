import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createSession} from '../scripts/mirroring-general.mjs';

async function fixture(t){
 const dir=await mkdtemp(join(tmpdir(),'clickfast-mirror-'));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 const ocr=join(dir,'ocr');await writeFile(ocr,"#!/bin/sh\nprintf '[]'\n",{mode:0o700});
 const png=Buffer.alloc(24);png.write('PNG',1);png.writeUInt32BE(100,16);png.writeUInt32BE(200,20);
 let captures=0,inputs=0;
 const app={getAXState:async()=> '0 standard window iPhone Mirroring, Secondary Actions: Raise',performSecondaryAction:async()=>{},getScreenshot:async()=>{captures++;if(captures===2)throw Error('Screenshot unavailable');return png;},click:async()=>{inputs++;},pressKey:async()=>{inputs++;throw Error('input connection lost');}};
 const session=await createSession({app,directory:join(dir,'run'),ocrBinary:ocr,audioReceipt:{muted:true},taskManifest:[]});
 await session.start('real-capture-failure');await session.begin();
 return {session,inputs:()=>inputs};
}

test('a capture failure preserves the submitted input and requires a fresh observation',async t=>{
 const {session,inputs}=await fixture(t);
 await assert.rejects(session.click([50,60]),/Screenshot unavailable/);
 const run=session.report.runs[0];
 assert.equal(run.events.length,1);
 assert.equal(run.events[0].outcome,'submitted');
 assert.notEqual(run.input_uncertain,true);
 assert.equal(run.observation_required,true);
 assert.match(run.observation_error,/Screenshot unavailable/);
 await assert.rejects(session.click([60,70]),/fresh observation/);
 assert.equal(inputs(),1);
 await session.capture('recovery');await session.acknowledgeObservation();
 await session.click([60,70]);
 assert.equal(inputs(),2);
});

test('an input error still stops the trial with unknown delivery',async t=>{
 const {session,inputs}=await fixture(t);
 await assert.rejects(session.key('Return'),/input connection lost/);
 const run=session.report.runs[0];
 assert.equal(run.events.length,1);assert.equal(run.events[0].outcome,'unknown');assert.equal(run.input_uncertain,true);
 await assert.rejects(session.click([50,60]),/unknown delivery/);assert.equal(inputs(),1);
});
