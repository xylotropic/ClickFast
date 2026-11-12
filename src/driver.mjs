import http from 'node:http';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { performance } from 'node:perf_hooks';
const numericOperators={Add:'Add',Subtract:'Subtract',Multiply:'Multiply',Divide:'Divide',Equals:'Equals',Decimal:'Point',Percent:'Percent'};

export function authorization(token, method, target, body, ts = Math.floor(Date.now()/1000), nonce = randomBytes(16).toString('hex')) {
  const digest = createHash('sha256').update(body).digest('hex');
  const message = `ipu-runner-v1\n${method}\n${target}\n${ts}\n${nonce}\n${digest}`;
  return `IPU-HMAC-SHA256 ts=${ts}, nonce=${nonce}, sig=${createHmac('sha256',token).update(message).digest('hex')}`;
}
export class Runner {
  constructor({port=8130, token, timeout=15000}={}) {
    if (!/^[a-f0-9]{32,128}$/.test(token || '')) throw new Error('A private runner token is required');
    if (!Number.isInteger(port) || port<1 || port>65535) throw new Error('Invalid loopback port');
    this.port=port; this.token=token; this.timeout=timeout;
    this.agent=new http.Agent({keepAlive:true,maxSockets:1});
    this.trace=[];
  }
  close(){this.agent.destroy();}
  async call(path, body, {signal, timeout=this.timeout}={}) {
    signal?.throwIfAborted();
    if(!Number.isFinite(timeout)||timeout<=0)throw new Error('Invalid request deadline');
    timeout=Math.max(1,Math.min(60000,Math.ceil(timeout)));
    const method=body===undefined?'GET':'POST';
    const bytes=body===undefined?Buffer.alloc(0):Buffer.from(JSON.stringify(body));
    const started=performance.now();
    return await new Promise((resolve,reject)=>{
      let dispatched=false;
      const request=http.request({host:'127.0.0.1',port:this.port,path,method,agent:this.agent,
        signal:signal?AbortSignal.any([signal,AbortSignal.timeout(timeout)]):AbortSignal.timeout(timeout),
        headers:{Authorization:authorization(this.token,method,path,bytes),'Content-Type':'application/json','Content-Length':bytes.length}}, response=>{
        const chunks=[];let length=0;
        response.on('data',chunk=>{length+=chunk.length;if(length>16*1024*1024)response.destroy(new Error('Runner response exceeds limit'));else chunks.push(chunk);});
        response.on('error',fail);
        response.on('end',()=>{
          try {
            const json=JSON.parse(Buffer.concat(chunks).toString('utf8'));
            const record={path,ms:performance.now()-started,runner_ms:Number(response.headers['x-ipu-ms'])||null,bytes:length,status:response.statusCode};
            const synthesis=Object.fromEntries(['orientation','build','wait','hold','calls'].filter(k=>response.headers['x-ipu-synth-'+k+(k==='calls'?'':'-ms')]!==undefined).map(k=>[k,Number(response.headers['x-ipu-synth-'+k+(k==='calls'?'':'-ms')])]));
            if(Object.keys(synthesis).length)record.synthesis=synthesis;
            if(response.headers['x-sprint-input-count']!==undefined)record.input_count=Number(response.headers['x-sprint-input-count']);
            this.trace.push(record);if(this.trace.length>500)this.trace.shift();
            if(response.statusCode>=400 || json.value?.error){
              const error=new Error(json.value?.message || `HTTP ${response.statusCode}`);
              error.code=json.value?.error||'runner_error';error.status=response.statusCode;
              const delivery=response.headers['x-sprint-delivery'];
              error.outcome=method==='POST'&&['not_sent','applied','unknown'].includes(delivery)?delivery:method==='POST'?'unknown':'read_failed';
              reject(error);
            } else resolve(json.value);
          }catch(error){fail(error);}
        });
      });
      function fail(error){error.outcome=method==='POST'&&dispatched?'unknown':'not_sent';reject(error);}
      request.on('error',fail);
      request.on('finish',()=>{dispatched=true;});
      request.end(bytes);
    });
  }
}
export function validateSelector(selector){
  if(!selector || typeof selector!=='object' || Array.isArray(selector) || !Object.keys(selector).length)throw new Error('A nonempty selector is required');
  for(const [key,value] of Object.entries(selector))if(!['label','kind','identifier','value'].includes(key)||typeof value!=='string'||value.length>1000)throw new Error('Invalid selector');
  return selector;
}
export function matches(row,selector){return Object.entries(selector).every(([k,v])=>row[k]===v);}
export function select(snapshot,selector,{actionable=false}={}){
  validateSelector(selector);
  const identities=new Set();
  const rows=snapshot.elements.filter(row=>{
    if(!matches(row,selector)||actionable&&(!row.ref||row.enabled===false))return false;
    const id=row.native_ref||row.ref;
    if(id&&identities.has(id))return false;
    if(id)identities.add(id);return true;
  });
  if(rows.length!==1)throw new Error(`Selector requires one ${actionable?'actionable ':''}match; found ${rows.length}`);
  return rows[0];
}
export class Controller {
  constructor(runner,{keyBursts=true,deviceLaunch}={}){this.runner=runner;this.current=null;this.keyBursts=keyBursts;this.deviceLaunch=deviceLaunch;}
  numericGroup(steps,index){
    if(!this.keyBursts||this.current?.key_burst!==1||this.current.elements.some(r=>r.kind==='SecureTextField'))return [];
    const targets=[];
    for(const step of steps.slice(index,index+8)){
      if(step.op!=='tap'||step.expect||step.observe===false||step.timeout_ms)break;
      let row;
      if(step.ref){if(step.snapshot!==this.current.snapshot)break;row=this.current.elements.find(r=>r.ref===step.ref);}
      else {if(!step.selector)break;const rows=this.current.elements.filter(r=>r.ref&&r.enabled!==false&&matches(r,step.selector));if(rows.length!==1)break;row=rows[0];}
      if(!row||row.kind!=='Key'||row.enabled===false||typeof row.label!=='string'||(!/^([0-9]|[+−\-×÷*/%=.,])$/.test(row.label.trim())&&numericOperators[row.identifier]!==row.label.trim()))break;
      targets.push(row);
    }
    return targets.length>=2?targets:[];
  }
  adopt(result) {
    if(!result || typeof result.snapshot!=='string'||!Array.isArray(result.elements))throw new Error('Runner returned an invalid observation');
    result.elements=result.elements.map((row,index)=>row.ref?{...row,native_ref:row.ref,ref:`${result.snapshot.slice(0,8)}:${index}`} : row);
    this.current=result;return result;
  }
  async observe(options={}) {
    const {pixelsOnly=false,...requestOptions}=options;
    // A timed-out device read can still finish and replace the native snapshot. Never
    // leave older handles usable while that request has an uncertain completion.
    this.current=null;
    try{return this.adopt(await this.runner.call(pixelsOnly?'/sprint/frame':'/sprint/observe',undefined,requestOptions));}
    catch(error){
      if(pixelsOnly||error.message!=='Accessibility is unavailable for this screen; use a pixel observation')throw error;
      return this.adopt({...await this.runner.call('/sprint/frame',undefined,requestOptions),ax_error:error.message});
    }
  }
  async wait(expect,{signal,timeout=5000}={}) {
    if(!expect||(!expect.app&&!expect.selector&&!expect.absent))throw new Error('Wait requires app or selector');
    if(expect.selector)validateSelector(expect.selector);
    if(expect.absent)validateSelector(expect.absent);
    const until=performance.now()+timeout;let last;
    do {
      signal?.throwIfAborted();
      last=await this.observe({signal,timeout:Math.max(1,until-performance.now())});
      if((!expect.app||last.app===expect.app)&&(!expect.selector||last.elements.some(row=>matches(row,expect.selector)))&&(!expect.absent||!last.elements.some(row=>matches(row,expect.absent))))return last;
      if(performance.now()<until)await new Promise(r=>setTimeout(r,25));
    }while(performance.now()<until);
    this.current=null;
    const error=new Error('Postcondition not observed before deadline');error.observation=last;throw error;
  }
  async act(step,{signal}={}) {
    let path,body={},snapshot;
    const required=step.expect||(step.op==='launch'?{app:step.bundle}:step.op==='home'?{app:'com.apple.springboard'}:null);
    switch(step.op){
      case 'tap': {
        const current=this.current || await this.observe({signal});
        let target;
        if(step.ref){
          if(!step.snapshot||step.snapshot!==current.snapshot)throw new Error('Stale snapshot; observe before using refs');
          target=current.elements.find(row=>row.ref===step.ref);
          if(!target)throw new Error('Unknown ref in current snapshot');
        }else {
          validateSelector(step.selector);
          if(!current.elements.some(row=>row.ref&&row.enabled!==false&&matches(row,step.selector))) {
            await this.wait({selector:step.selector},{signal,timeout:step.timeout_ms??5000});
          }
          target=select(this.current,step.selector,{actionable:true});
        }
        if(target.enabled===false)throw new Error('Disabled target');
        path=`/element/${encodeURIComponent(target.native_ref || target.ref)}/click`;snapshot=this.current.snapshot;break;
      }
      case 'tap_point': {
        if(!this.current||step.snapshot!==this.current.snapshot)throw new Error('Coordinate taps require the current snapshot');
        if(!Number.isFinite(step.x)||!Number.isFinite(step.y)||step.x<0||step.y<0||step.x>=this.current.width||step.y>=this.current.height)throw new Error('Point is outside the observed screen');
        path='/tap';body={x:step.x,y:step.y};snapshot=this.current.snapshot;break;
      }
      case 'launch':
        if(typeof step.bundle!=='string'||!/^[\w.-]+$/.test(step.bundle))throw new Error('Invalid app bundle');
        if(this.deviceLaunch){
          if(await this.runner.call('/wda/locked',undefined,{signal})!==false)throw Object.assign(new Error('Device is locked; no app launched'),{outcome:'not_sent'});
          this.current=null;
          await this.deviceLaunch(step.bundle,{signal});
          this.lastLaunchAt=performance.now();
          return await this.wait(required,{signal,timeout:step.timeout_ms??5000});
        }
        path='/launch';body={bundle:step.bundle};break;
      case 'home':path='/home';break;
      case 'text': {
        if(typeof step.text!=='string'||step.text.length>20000)throw new Error('Invalid text');
        if(step.ref){
          if(!this.current||step.snapshot!==this.current.snapshot)throw new Error('Text requires the current field snapshot');
          const target=this.current.elements.find(row=>row.ref===step.ref);
          if(!target||!['TextField','SearchField','TextView'].includes(target.kind))throw new Error('Text requires an observed nonsecure editable target');
          if(this.current.bound_text!==1)throw new Error('Install the runner with native field-bound text support');
          if(step.app&&this.current.app!==step.app)throw new Error('App changed before authorized text entry');
          path='/sprint/enter-text';body={id:target.native_ref||target.ref,text:step.text};snapshot=this.current.snapshot;break;
        }
        await this.observe({signal});
        if(step.app&&this.current.app!==step.app)throw new Error('App changed before authorized text entry');
        const fields=this.current.elements.filter(row=>row.focused&&['TextField','SearchField','TextView'].includes(row.kind));
        if(fields.length!==1)throw new Error('Text requires one observed focused nonsecure field');
        if(step.selector&&!matches(fields[0],step.selector))throw new Error('Focused field differs from the authorized text target');
        path='/type';body={text:step.text,frequency:250};snapshot=this.current.snapshot;break;
      }
      case 'key':
        if(!['\n','\b','\t','\u001b'].includes(step.key))throw new Error('Unsupported key');
        if(!this.current)await this.observe({signal});
        path='/wda/keys';body={value:[step.key]};snapshot=this.current.snapshot;break;
      case 'swipe':
        for(const k of ['x1','y1','x2','y2'])if(!Number.isFinite(step[k]))throw new Error('Invalid swipe');
        if(!this.current)await this.observe({signal});
        for(const k of ['x1','x2'])if(step[k]<0||step[k]>=this.current.width)throw new Error('Swipe outside screen');
        for(const k of ['y1','y2'])if(step[k]<0||step[k]>=this.current.height)throw new Error('Swipe outside screen');
        path='/swipe';body=Object.fromEntries(['x1','y1','x2','y2'].map(k=>[k,step[k]]));body.duration_ms=step.duration_ms??150;snapshot=this.current.snapshot;break;
      default:throw new Error(`Unsupported operation ${step.op}`);
    }
    this.current=null;
    let result;
    try{result=await this.runner.call('/sprint/act',{path,body,snapshot,observe:!required&&step.observe!==false},{signal});}
    catch(error){
      if(error.outcome!=='applied'||error.message!=='Accessibility is unavailable for this screen; use a pixel observation')throw error;
      // Input succeeded. Replace only its failed AX read; never dispatch the action again.
      try{result={...await this.runner.call('/sprint/frame',undefined,{signal}),ax_error:error.message};}
      catch(readError){readError.outcome='applied';throw readError;}
    }
    if(result?.snapshot)this.adopt(result);
    if(required)return await this.wait(required,{signal,timeout:step.timeout_ms??5000});
    return this.current || {applied:true,observation:'not_requested'};
  }
  async execute(steps,{signal,timeout=30000}={}) {
    if(!Number.isFinite(timeout)||timeout<=0)throw new Error('Invalid execution deadline');
    timeout=Math.max(1,Math.min(60000,Math.ceil(timeout)));
    if(!Array.isArray(steps)||steps.length<1||steps.length>24)throw new Error('Execute requires 1–24 steps');
    for(const step of steps){
      if(!step||!['tap','tap_point','launch','home','text','key','swipe','wait','observe'].includes(step.op))throw new Error('Invalid operation in batch');
      if(step.selector)validateSelector(step.selector);
      if(step.expect?.selector)validateSelector(step.expect.selector);
      if(step.expect?.absent)validateSelector(step.expect.absent);
      if(step.timeout_ms!==undefined&&(!Number.isInteger(step.timeout_ms)||step.timeout_ms<1||step.timeout_ms>15000))throw new Error('Invalid step deadline');
    }
    const stop=signal?AbortSignal.any([signal,AbortSignal.timeout(timeout)]):AbortSignal.timeout(timeout);
    const started=performance.now();const completed=[],timings=[];
    for(let index=0;index<steps.length;index++){
      const stepStarted=performance.now();
      let group=[];
      try{
        stop.throwIfAborted();const step=steps[index];
        if(!this.current&&step.op==='tap'&&steps.length-index>1)await this.observe({signal:stop});
        group=this.numericGroup(steps,index);
        if(group.length){
          const snapshot=this.current.snapshot;this.current=null;
          const result=await this.runner.call('/sprint/act',{path:'/sprint/key-burst',body:{ids:group.map(r=>r.native_ref||r.ref)},snapshot,observe:true},{signal:stop});
          this.adopt(result);
          const indexes=group.map((_,offset)=>index+offset);completed.push(...indexes);
          timings.push({step:index,op:'numeric_key_burst',steps:indexes,at_ms:stepStarted-started,ms:performance.now()-stepStarted,success:true});
          index+=group.length-1;continue;
        }
        if(step.op==='wait')await this.wait(step.expect,{signal:stop,timeout:step.timeout_ms??5000});
        else if(step.op==='observe')await this.observe({signal:stop});
        else await this.act(step,{signal:stop});
        completed.push(index);
        timings.push({step:index,op:step.op,ms:performance.now()-stepStarted,success:true});
      }catch(error){
        timings.push({step:index,op:steps[index].op,ms:performance.now()-stepStarted,success:false});
        const lastSeen=this.current||error.observation||null;
        this.current=null;
        return {ok:false,completed,timings,failed_step:index,error:error.message,outcome:error.outcome||'stopped',
          ...(group.length?{uncertain_steps:group.map((_,offset)=>index+offset)}:{}),
          observation:lastSeen?{...lastSeen,stale:true}:null,elapsed_ms:performance.now()-started};
      }
    }
    return {ok:true,completed,timings,observation:this.current,elapsed_ms:performance.now()-started};
  }
}
