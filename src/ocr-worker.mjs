import {spawn} from 'node:child_process';
import {StringDecoder} from 'node:string_decoder';

// One read in flight. IDs prevent a late/invalid response becoming the next frame.
// An interrupted worker is retired; input callers must inspect their own outcome.
export class OcrWorker {
 constructor(binary,args=['--worker']){this.binary=binary;this.args=args;this.closed=false;this.next=0;this.pending=null;this.child=null;this.buffer='';this.decoder=new StringDecoder('utf8');}
 start(){
  if(this.closed)throw Error('Local OCR worker is closed');
  if(this.child)return;
  const child=this.child=spawn(this.binary,this.args,{stdio:['pipe','pipe','ignore']});
  child.on('error',()=>this.fail('Local OCR worker could not start'));
  child.on('exit',()=>this.fail('Local OCR worker exited'));
  child.stdin.on('error',()=>this.fail('Local OCR input closed'));
  child.stdout.on('error',()=>this.fail('Local OCR output closed'));
  child.stdout.on('data',bytes=>{
   this.buffer+=this.decoder.write(bytes);if(this.buffer.length>1024*1024){this.fail('Local OCR response exceeds limit');return;}
   let newline;
   while((newline=this.buffer.indexOf('\n'))>=0){
    const line=this.buffer.slice(0,newline);this.buffer=this.buffer.slice(newline+1);
    try{
     const reply=JSON.parse(line),pending=this.pending;
     if(!pending||reply.id!==pending.id||(!reply.error&&!Array.isArray(reply.lines)))throw Error();
     if(reply.error){this.finish(Error('Local screenshot OCR failed'));}else this.finish(null,reply.lines);
    }catch{this.fail('Invalid or stale local OCR response');return;}
   }
  });
 }
 finish(error,rows){
  const pending=this.pending;if(!pending)return;this.pending=null;
  clearTimeout(pending.timer);pending.signal?.removeEventListener('abort',pending.abort);
  if(error)pending.reject(error);else pending.resolve(rows);
 }
 fail(message){this.finish(Error(message));this.close();}
 recognize(path,{signal,timeout=5000}={}){
  signal?.throwIfAborted();
  if(this.pending)return Promise.reject(Error('A local OCR read is already running'));
  if(typeof path!=='string'||path.length>4096||!Number.isInteger(timeout)||timeout<1||timeout>30000)return Promise.reject(Error('Invalid local OCR read'));
  this.start();const id=++this.next;
  return new Promise((resolve,reject)=>{
   const abort=()=>this.fail('Local OCR read interrupted');
   this.pending={id,resolve,reject,signal,abort,timer:setTimeout(()=>this.fail('Local OCR read timed out'),timeout)};
   signal?.addEventListener('abort',abort,{once:true});
   if(signal?.aborted){abort();return;}
   this.child.stdin.write(JSON.stringify({id,path})+'\n');
  });
 }
 close(){
  if(this.closed)return;this.closed=true;this.finish(Error('Local OCR worker closed'));
  this.child?.stdin.end();this.child?.kill('SIGTERM');
 }
}
