#!/usr/bin/env node
// Real-device, non-destructive checks. Does not navigate, type, or publish.
import http from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {performance} from 'node:perf_hooks';
import {execFileSync} from 'node:child_process';
import {root,assertDirectMode} from '../src/cli.mjs';
import {Runner} from '../src/driver.mjs';

const config=JSON.parse(await readFile(join(root,'.state/config.json'),'utf8'));
const runner=new Runner({port:config.port,token:(await readFile(join(root,'.state/token'),'utf8')).trim()});
const report={time:new Date().toISOString(),scope:'Physical-device preflight; no completed-app speed claim.',tests:[]};
async function check(name,expected,operation){
 const start=performance.now();
 try{const observed=await operation();report.tests.push({name,expected,observed,success:true,ms:performance.now()-start});}
 catch(error){report.tests.push({name,expected,success:false,error_class:error.code||error.name,ms:performance.now()-start});}
}
async function expectRefusal(path,body){
 try{await runner.call(path,body);throw new Error('Unexpected success');}
 catch(error){
  if(!/locked|Screen snapshot is stale/.test(error.message))throw error;
  return {refused:true,reason:/locked/.test(error.message)?'device_locked':'stale_snapshot',input_dispatched:false};
 }
}
try{
 assertDirectMode();
 await check('native_protocol','ready with Sprint protocol 1',async()=>{
  const s=await runner.call('/status');
  if(!s.ready||s.capabilities?.sprintProtocol!==1)throw new Error('Runner not ready');
  report.environment={os:s.os,runner:s.build};return {ready:true,sprint_protocol:1};
 });
 await check('authentication','unsigned request is refused',()=>new Promise((resolve,reject)=>{
  const req=http.get({host:'127.0.0.1',port:config.port,path:'/status',signal:AbortSignal.timeout(2000)},res=>{
   res.resume();res.on('end',()=>res.statusCode===401?resolve({http_status:401}):reject(new Error('Unsigned request accepted')));
  });req.on('error',reject);
 }));
 report.locked=await runner.call('/wda/locked');
 if(report.locked===true)await check('locked_observation','no screen content returned',()=>expectRefusal('/sprint/observe'));
 // A deliberately invalid snapshot cannot authorize a tap, locked or unlocked.
 await check('invalid_snapshot_input','input refused before dispatch',()=>expectRefusal('/sprint/act',{path:'/tap',body:{x:1,y:1},snapshot:'never-a-valid-snapshot',observe:false}));
 try{
  const {relayPid}=JSON.parse(await readFile(join(root,'.state/processes.json'),'utf8'));
  const rss=execFileSync('/bin/ps',['-o','rss=','-p',String(relayPid)],{encoding:'utf8'}).trim();
  report.resources={relay_rss_kib:Number(rss),measurement_process_rss_bytes:process.memoryUsage().rss,
   note:'One idle host sample, not device-runner memory or sustained workload CPU.'};
 }catch{report.resources={unavailable:true};}
 report.success=report.tests.every(t=>t.success);
}catch(error){report.success=false;report.error_class=error.code||error.name;}
finally{
 runner.close();await writeFile(join(root,'benchmarks/preflight.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));if(!report.success)process.exitCode=1;
}
