#!/usr/bin/env node
import {spawn,execFileSync} from 'node:child_process';
import {mkdir,writeFile,readFile,readdir,open} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import {root,assertDirectMode} from '../src/cli.mjs';
import {Runner} from '../src/driver.mjs';
const args=process.argv.slice(2);
assertDirectMode();
const arg=(name,fallback)=>{const i=args.indexOf(name);return i>=0?args[i+1]:fallback;};
const state=join(root,'.state');await mkdir(state,{recursive:true,mode:0o700});
const udid=arg('--udid'),team=arg('--team');
if(!udid||!team||!/^[a-z0-9-]+$/i.test(udid)||!/^[A-Z0-9]{10}$/.test(team))throw new Error('Usage: node scripts/setup.mjs --udid <phone UDID> --team <Apple team ID>');
const port=Number(arg('--port','8130'));
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid port');
async function run(program,argv,log){
  const fd=await open(join(state,log),'a',0o600);
  const child=spawn(program,argv,{stdio:['ignore',fd.fd,fd.fd]});await fd.close();
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
  if(code!==0)throw new Error(`${program} failed (${code}); inspect .state/${log}`);
}
const project=join(root,'vendor/iphone-use/runner/IPhoneUseRunner/IPhoneUseRunner.xcodeproj');
const derived=join(state,'derived');
console.log('Building the MIT runner with your Apple development team…');
await run('xcodebuild',['build-for-testing','-project',project,'-scheme','IPhoneUseRunner','-destination',`id=${udid}`,
  '-derivedDataPath',derived,'-allowProvisioningUpdates','-allowProvisioningDeviceRegistration',
  `DEVELOPMENT_TEAM=${team}`,'CODE_SIGN_STYLE=Automatic','CODE_SIGN_IDENTITY=Apple Development',
  'PRODUCT_BUNDLE_IDENTIFIER=io.github.xylotropic.iphone-sprint',
  'INFOPLIST_KEY_NSPhotoLibraryAddUsageDescription=Import a generated video for an explicitly requested posting test.'],'build.log');
const product=join(derived,'Build/Products');
// Xcode's generated UI-test host has its own Info.plist; target INFOPLIST_KEY values
// do not reach it. Give the host a modern launch screen (otherwise iOS uses a 320x480
// compatibility canvas), add the optional fixture purpose, and re-sign it
// using the exact identity and entitlements from this successful signed build.
{
 const app=join(product,'Debug-iphoneos/iPhoneUse-Runner.app');
 const entitlements=join(state,'runner-entitlements.plist');
 const original=execFileSync('/usr/bin/codesign',['-d','--entitlements',':-',app],{stdio:['ignore','pipe','pipe']});
 await writeFile(entitlements,original,{mode:0o600});
 const buildLog=await readFile(join(state,'build.log'),'utf8');
 const identity=[...buildLog.matchAll(/\/usr\/bin\/codesign --force --sign ([A-F0-9]{40}) /g)].at(-1)?.[1];
 if(!identity)throw new Error('Could not identify the successful build signing identity; no app was modified.');
 const patchInfo=`import plistlib,sys
p=sys.argv[1]
with open(p,'rb') as f: d=plistlib.load(f)
d['UILaunchScreen']={}
d['CFBundleDisplayName']='ClickFast'
if sys.argv[2]=='1': d['NSPhotoLibraryAddUsageDescription']='Import a generated video for an explicitly requested posting test.'
else: d.pop('NSPhotoLibraryAddUsageDescription',None)
with open(p,'wb') as f: plistlib.dump(d,f,fmt=plistlib.FMT_BINARY)
`;
 execFileSync('/usr/bin/python3',['-c',patchInfo,join(app,'Info.plist'),args.includes('--enable-media-import')?'1':'0'],{stdio:['ignore','pipe','pipe']});
 execFileSync('/usr/bin/codesign',['--force','--sign',identity,'--entitlements',entitlements,'--timestamp=none',app],{stdio:['ignore','pipe','pipe']});
 execFileSync('/usr/bin/codesign',['--verify','--deep','--strict',app],{stdio:['ignore','pipe','pipe']});
}
const xctestrun=(await readdir(product)).find(name=>name.endsWith('.xctestrun')&&name!=='Sprint.xctestrun');
if(!xctestrun)throw new Error('Build produced no xctestrun file');
let token;
try{token=(await readFile(join(state,'token'),'utf8')).trim();}
catch(error){if(error.code!=='ENOENT')throw error;token=randomBytes(32).toString('hex');await writeFile(join(state,'token'),token,{mode:0o600});}
// The generated launch plan is private. Never print its environment or commit it.
const launch=join(product,'Sprint.xctestrun');
const python=`import plistlib,sys,os
p=plistlib.load(open(sys.argv[1],'rb'))
def patch(v):
 if isinstance(v,dict):
  if 'TestBundlePath' in v:
   v.setdefault('EnvironmentVariables',{}).update({'IPU_RUNNER_TOKEN':sys.stdin.read().strip(),'IPU_RUNNER_PORT':'8100','IPU_RUNNER_MJPEG_PORT':'0','IPU_SPRINT_MEDIA_IMPORT':sys.argv[3]})
  for x in v.values(): patch(x)
 elif isinstance(v,list):
  for x in v: patch(x)
patch(p)
with open(sys.argv[2],'wb') as f: plistlib.dump(p,f)
os.chmod(sys.argv[2],0o600)
`;
execFileSync('/usr/bin/python3',['-c',python,join(product,xctestrun),launch,args.includes('--enable-media-import')?'1':'0'],{input:token,stdio:['pipe','pipe','pipe']});
await writeFile(join(state,'config.json'),JSON.stringify({udid,team,port})+'\n',{mode:0o600});
async function background(program,argv,log){
  const fd=await open(join(state,log),'a',0o600);
  const child=spawn(program,argv,{detached:true,stdio:['ignore',fd.fd,fd.fd]});
  const error=await new Promise(resolve=>{child.once('spawn',()=>resolve(null));child.once('error',resolve);});
  await fd.close();if(error)throw error;child.unref();return child.pid;
}
// Stop our previous authenticated runner, if present. Never take another runner's session.
const runner=new Runner({port,token,timeout:1000});
let live=false;
try{const status=await runner.call('/status');live=status.ready===true;}catch{}
if(live&&!args.includes('--restart')){console.log('Matching signed runner is already ready. Use --restart to load a rebuilt runner.');runner.close();process.exit(0);}
if(live){
 if(await runner.call('/wda/locked')!==false){
  runner.close();
  throw new Error('The rebuilt runner is ready to install, but the phone is locked. The existing runner was left running. Unlock the physical iPhone, then rerun with --restart.');
 }
 console.log('Shutting down our authenticated runner before loading the rebuilt one…');
 await runner.call('/shutdown',{});
 await new Promise(resolve=>setTimeout(resolve,1000));
}

runner.close();
let previous={};
try{previous=JSON.parse(await readFile(join(state,'processes.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
const alive=pid=>{try{process.kill(pid,0);return true;}catch{return false;}};
if(previous.testPid&&live){for(let i=0;i<40&&alive(previous.testPid);i++)await new Promise(resolve=>setTimeout(resolve,250));}
if(previous.testPid&&alive(previous.testPid))throw new Error('The existing Xcode test process is still alive. Inspect its log; do not launch a competing runner.');
let relayPid=previous.relayPid;
if(relayPid&&alive(relayPid)){
 const command=execFileSync('/bin/ps',['-ww','-o','args=','-p',String(relayPid)],{encoding:'utf8'});
 if(!command.includes('iproxy')||!command.includes(udid)||!command.includes(`${port}:8100`))throw new Error('Stored relay PID no longer belongs to this setup.');
}else{
 try{const listeners=execFileSync('/usr/sbin/lsof',['-nP',`-iTCP:${port}`,'-sTCP:LISTEN'],{encoding:'utf8'});if(listeners)throw new Error('The relay port is occupied.');}
 catch(error){if(error.status!==1)throw error;}
 relayPid=await background(arg('--iproxy','/opt/homebrew/bin/iproxy'),['-u',udid,'-s','127.0.0.1',`${port}:8100`],'relay.log');
}
const testPid=await background('xcodebuild',['test-without-building','-xctestrun',launch,'-destination',`id=${udid}`,
 '-only-testing:IPhoneUseRunnerUITests/RunnerTests/testServe','-test-timeouts-enabled','NO'],'runner.log');
await writeFile(join(state,'processes.json'),JSON.stringify({relayPid,testPid})+'\n',{mode:0o600});
console.log('Runner launch requested. Approve UI Automation on the iPhone if prompted.');
const probe=new Runner({port,token,timeout:1000});
try{
  for(let i=0;i<120;i++){
    try{const status=await probe.call('/status');if(status.ready){console.log('READY: signed native runner responds over USB.');process.exitCode=0;break;}}
    catch{}
    if(i===119){console.error('Runner not ready yet. Check .state/runner.log and on-phone prompts.');process.exitCode=1;}
    await new Promise(resolve=>setTimeout(resolve,500));
  }
}finally{probe.close();}
