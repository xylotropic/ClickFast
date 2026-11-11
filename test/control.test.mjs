import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createHash,createHmac} from 'node:crypto';
import {Runner,Controller,authorization,select} from '../src/driver.mjs';
import {compact,tools,serve,ensureMuted} from '../src/cli.mjs';
import {PassThrough} from 'node:stream';
const token='a'.repeat(64);
const screen=()=>({snapshot:'snapshot-1',app:'test.app',width:400,height:800,elements:[{kind:'Button',label:'Search',ref:'native-id',enabled:true,rect:{x:10,y:10,width:50,height:50}}]});

test('HMAC matches the pinned native runner canonical format',()=>{
 const body=Buffer.from('{"x":3}');const hash=createHash('sha256').update(body).digest('hex');
 const expected=createHmac('sha256',token).update(`ipu-runner-v1\nPOST\n/tap\n123\n0123456789abcdef\n${hash}`).digest('hex');
 assert.equal(authorization(token,'POST','/tap',body,123,'0123456789abcdef'),`IPU-HMAC-SHA256 ts=123, nonce=0123456789abcdef, sig=${expected}`);
});
test('runner transport signs real HTTP requests and does not replay ambiguous mutations',async()=>{
 let calls=0,seen;
 const server=http.createServer((request,response)=>{calls++;seen=request.headers.authorization;request.socket.destroy();});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const runner=new Runner({token,port:server.address().port});
 try{
  await assert.rejects(runner.call('/tap',{x:1,y:2}),e=>e.outcome==='unknown');
  assert.equal(calls,1);assert.match(seen,/^IPU-HMAC-SHA256/);
 }finally{runner.close();await new Promise(r=>server.close(r));}
});
test('unique selector refuses duplicate controls rather than choosing the first',()=>{
 const s=screen();s.elements.push({...s.elements[0],ref:'other'});
 assert.throws(()=>select(s,{label:'Search'},{actionable:true}),/found 2/);
});
test('one observation supplies registered handle, avoiding a second full tree lookup',async()=>{
 const calls=[];const runner={call:async(path,body)=>{calls.push({path,body});if(path==='/sprint/observe')return screen();return null;}};
 const controller=new Controller(runner);const snapshot=await controller.observe();
 const result=await controller.execute([{op:'tap',ref:snapshot.elements[0].ref,snapshot:snapshot.snapshot,observe:false}]);
 assert.equal(result.ok,true);assert.equal(calls.length,2);
 assert.equal(calls[1].body.path,'/element/native-id/click');
 assert.equal(calls[1].body.snapshot,'snapshot-1');
 assert.equal(calls[1].body.observe,false);
 assert.ok(!JSON.stringify(compact(snapshot)).includes('native-id'));
});
test('stale ref is rejected before any input dispatch',async()=>{
 const calls=[];const c=new Controller({call:async(path)=>{calls.push(path);return screen();}});
 await c.observe();const result=await c.execute([{op:'tap',ref:'old',snapshot:'old'}]);
 assert.equal(result.ok,false);assert.equal(calls.length,1);assert.match(result.error,/Stale/);
});
test('batch stops after an unknown input outcome and does not execute the next step',async()=>{
 let calls=0;
 const c=new Controller({call:async()=>{calls++;const e=new Error('lost response');e.outcome='unknown';throw e;}});
 const result=await c.execute([{op:'home'},{op:'launch',bundle:'test.app'}]);
 assert.equal(result.ok,false);assert.equal(result.failed_step,0);assert.equal(result.outcome,'unknown');assert.equal(calls,1);
});
test('required-state wait accepts the first correct observation without double settling',async()=>{
 let calls=0;const c=new Controller({call:async()=>{calls++;return screen();}});
 await c.wait({app:'test.app',selector:{label:'Search'}});assert.equal(calls,1);
});
test('cancelled execution never dispatches input',async()=>{
 const stop=new AbortController();stop.abort();let calls=0;
 const c=new Controller({call:async()=>{calls++;}});
 const result=await c.execute([{op:'home'}],{signal:stop.signal});assert.equal(result.ok,false);assert.equal(calls,0);
});
test('unknown operations are rejected before executing earlier valid steps',async()=>{
 let calls=0;const c=new Controller({call:async()=>{calls++;}});
 await assert.rejects(c.execute([{op:'home'},{op:'bad'}]),/Invalid operation/);assert.equal(calls,0);
});
test('real MCP framing advertises only three small tools and rejects unknown methods',async()=>{
 const input=new PassThrough(),output=new PassThrough();const messages=[];
 output.on('data',data=>messages.push(...data.toString().trim().split('\n').map(JSON.parse)));
 await serve({runner:{close(){}}},input,output);
 input.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2024-11-05'}})+'\n');
 input.write(JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/list'})+'\n');
 input.write(JSON.stringify({jsonrpc:'2.0',id:3,method:'invented'})+'\n');
 await new Promise(r=>setTimeout(r,10));input.end();
 assert.equal(messages[0].result.serverInfo.name,'operator');
 assert.deepEqual(messages[1].result.tools.map(t=>t.name),tools.map(t=>t.name));
 assert.equal(tools.length,3);assert.ok(Buffer.byteLength(JSON.stringify(tools))<6000);
 assert.equal(messages[2].error.code,-32601);
});
test('real HTTP waits accept fractional remaining deadlines',async()=>{
 const server=http.createServer((request,response)=>{response.setHeader('Content-Type','application/json');response.end(JSON.stringify({value:screen()}));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const runner=new Runner({token,port:server.address().port});
 try{const result=await new Controller(runner).wait({app:'test.app'},{timeout:500});assert.equal(result.app,'test.app');}
 finally{runner.close();await new Promise(r=>server.close(r));}
});
test('a newly appearing target uses its new snapshot handle, without another locator query',async()=>{
 let reads=0,dispatch;
 const runner={call:async(path,body)=>{
  if(path==='/sprint/observe'){reads++;const s=screen();if(reads===1)s.elements=[];else s.snapshot='new-screen';return s;}
  dispatch=body;return null;
 }};
 const c=new Controller(runner);await c.observe();const result=await c.execute([{op:'tap',selector:{kind:'Button',label:'Search'},observe:false}]);
 assert.equal(result.ok,true);assert.equal(reads,2);assert.equal(dispatch.snapshot,'new-screen');
 assert.equal(dispatch.path,'/element/native-id/click');
});
test('action observations normalize new handles before the next dependent action',async()=>{
 const calls=[];
 const c=new Controller({call:async(path,body)=>{
  calls.push({path,body});const next=screen();next.snapshot=`snapshot-${calls.length}`;return next;
 }});
 const first=await c.observe();
 let result=await c.execute([{op:'tap',ref:first.elements[0].ref,snapshot:first.snapshot}]);
 assert.equal(result.ok,true);assert.match(c.current.elements[0].ref,/:0$/);
 assert.equal(c.current.elements[0].native_ref,'native-id');
 const second=c.current;
 result=await c.execute([{op:'tap',ref:second.elements[0].ref,snapshot:second.snapshot,observe:false}]);
 assert.equal(result.ok,true);assert.equal(calls[2].body.path,'/element/native-id/click');
 assert.equal(calls[2].body.snapshot,second.snapshot);
});
test('coordinate input carries its screen snapshot to the device for app revalidation',async()=>{
 let dispatched;
 const c=new Controller({call:async(path,body)=>{if(path==='/sprint/observe')return screen();dispatched=body;return null;}});
 const s=await c.observe();
 const result=await c.execute([{op:'tap_point',x:20,y:20,snapshot:s.snapshot,observe:false}]);
 assert.equal(result.ok,true);assert.equal(dispatched.snapshot,s.snapshot);
});
test('pixel observation skips AX and supplies the context for a guarded coordinate tap',async()=>{
 const calls=[];const frame={...screen(),mode:'pixels',elements:[]};
 const c=new Controller({call:async(path,body)=>{calls.push({path,body});return path==='/sprint/frame'?frame:null;}});
 const s=await c.observe({pixelsOnly:true});
 const r=await c.execute([{op:'tap_point',x:20,y:30,snapshot:s.snapshot,observe:false}]);
 assert.equal(r.ok,true);assert.equal(calls.length,2);assert.equal(calls[0].path,'/sprint/frame');
 assert.equal(calls[1].body.snapshot,s.snapshot);
 assert.ok(!calls.some(x=>x.path==='/sprint/observe'));
});
test('queued MCP cancellation is honored before the second task can dispatch',async()=>{
 const input=new PassThrough(),output=new PassThrough();let release,calls=0;
 const hold=new Promise(resolve=>{release=resolve;});const messages=[];
 output.on('data',data=>messages.push(...data.toString().trim().split('\n').map(JSON.parse)));
 const controller={runner:{call:async()=>({media_volume:0}),close(){}},execute:async()=>{calls++;await hold;return {ok:true,completed:[],timings:[],observation:null};}};
 await serve(controller,input,output);
 for(const id of [1,2])input.write(JSON.stringify({jsonrpc:'2.0',id,method:'tools/call',params:{name:'sprint_execute',arguments:{steps:[{op:'home'}]}}})+'\n');
 await new Promise(r=>setTimeout(r,5));
 input.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/cancelled',params:{requestId:2}})+'\n');
 release();await new Promise(r=>setTimeout(r,25));input.end();
 assert.equal(calls,1);assert.equal(messages.find(m=>m.id===2).error.code,-32800);
});
test('a failed postcondition invalidates handles and recovery must obtain fresh context',async()=>{
 let reads=0,dispatch;
 const c=new Controller({call:async(path,body)=>{
  if(path==='/sprint/observe'){reads++;const s=screen();s.snapshot=`revision-${reads}`;return s;}
  dispatch=body;return null;
 }});
 const failed=await c.execute([{op:'wait',expect:{selector:{label:'Missing'}},timeout_ms:1}]);
 assert.equal(failed.ok,false);assert.equal(c.current,null);assert.equal(failed.observation.stale,true);
 const seenReads=reads;
 const recovered=await c.execute([{op:'tap',selector:{label:'Search'},observe:false}]);
 assert.equal(recovered.ok,true);assert.equal(reads,seenReads+1);assert.equal(dispatch.snapshot,`revision-${reads}`);
});
test('an interrupted observation does not retain the previous screen context',async()=>{
 let reads=0;
 const c=new Controller({call:async()=>{if(++reads===1)return screen();throw new Error('read interrupted');}});
 await c.observe();await assert.rejects(c.observe(),/read interrupted/);assert.equal(c.current,null);
});

test('native delivery receipts distinguish unsent input from applied input with a failed read',async()=>{
 let delivery='not_sent';
 const server=http.createServer((request,response)=>{response.statusCode=409;response.setHeader('X-Sprint-Delivery',delivery);response.end(JSON.stringify({value:{error:'screen_changed',message:'fresh observation required'}}));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const runner=new Runner({token,port:server.address().port});
 try {for(const expected of ['not_sent','applied','unknown']){delivery=expected;await assert.rejects(runner.call('/sprint/act',{}),e=>e.outcome===expected);}}
 finally {runner.close();await new Promise(r=>server.close(r));}
});

test('navigation projection reduces model payload while keeping full native text available',()=>{
 const full=screen();full.elements.push({kind:'StaticText',label:'Readable content'});
 const nav=compact(full,{view:'navigation'});
 assert.equal(nav.elements.length,1);assert.equal(full.elements.length,2);
 assert.equal(compact(full).elements[1].label,'Readable content');
 assert.equal(nav.elements[0].ref,'native-id');
});

test('phone control verifies zero media volume and sends only the needed volume-down events',async()=>{
 let volume=0.5;const paths=[];const runner={call:async(path,body)=>{paths.push(path);if(path==='/sprint/audio')return {media_volume:volume};assert.equal(body.name,'volumeDown');volume-=0.25;}};
 const muted=await ensureMuted(runner);assert.equal(muted.muted,true);assert.equal(volume,0);assert.equal(paths.filter(x=>x==='/wda/pressButton').length,2);
 paths.length=0;await ensureMuted(runner);assert.deepEqual(paths,['/sprint/audio']);
});
test('unverifiable media mute prevents app control',async()=>{
 await assert.rejects(ensureMuted({call:async()=>({})}),/not verified/);
 let presses=0;await assert.rejects(ensureMuted({call:async(path)=>{if(path==='/sprint/audio')return {media_volume:1};presses++;}}),/not verified/);assert.equal(presses,16);
});

test('bounded local-loop execution accepts fractional remaining time',async()=>{
 const c=new Controller({call:async()=>null});const r=await c.execute([{op:'home',observe:false}],{timeout:1234.56});assert.equal(r.ok,true);
});
