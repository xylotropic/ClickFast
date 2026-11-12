import {execFile} from 'node:child_process';

// CoreDevice launches without XCTest's application-idle wait. No shell, retry,
// terminate-existing flag, or parsed diagnostic text. Controller verifies the UI.
export function deviceLauncher(udid,{exec=execFile}={}){
 if(typeof udid!=='string'||!/^[a-z0-9-]{8,64}$/i.test(udid))throw Error('An explicit device UDID is required');
 return async(bundle,{signal}={})=>{
  if(typeof bundle!=='string'||!/^[\w.-]+$/.test(bundle))throw Error('Invalid app bundle');
  signal?.throwIfAborted();
  await new Promise((resolve,reject)=>{
   exec('xcrun',['devicectl','device','process','launch','--device',udid,bundle,'--timeout','5','--quiet'],{signal,timeout:6000,maxBuffer:65536},error=>{
    if(error)reject(Object.assign(Error('CoreDevice launch did not confirm completion; inspect the current screen'),{outcome:'unknown'}));else resolve();
   });
  });
 };
}
