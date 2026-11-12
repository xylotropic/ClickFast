import test from 'node:test';
import assert from 'node:assert/strict';
import {deviceLauncher} from '../src/device-launch.mjs';

test('CoreDevice launch uses an explicit device and bundle without shell or termination',async()=>{
 let sent;
 const launch=deviceLauncher('00008140-001259EA217B001C',{exec:(file,args,options,done)=>{sent={file,args,options};done(null);}});
 await launch('com.example.app');
 assert.equal(sent.file,'xcrun');assert.deepEqual(sent.args,['devicectl','device','process','launch','--device','00008140-001259EA217B001C','com.example.app','--timeout','5','--quiet']);assert.ok(!sent.options.shell);
});
test('a cancelled launch sends no command and a lost completion is unknown, never retried',async()=>{
 let calls=0;const launch=deviceLauncher('00008140-001259EA217B001C',{exec:(_f,_a,_o,done)=>{calls++;done(Error('connection lost'));}});
 await assert.rejects(launch('com.example.app',{signal:AbortSignal.abort()}));assert.equal(calls,0);
 await assert.rejects(launch('com.example.app'),e=>e.outcome==='unknown');assert.equal(calls,1);
});
