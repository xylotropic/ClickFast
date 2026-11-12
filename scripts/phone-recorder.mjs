import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {performance} from 'node:perf_hooks';

export function phoneRecorder(camera,directory,{interval=200}={}){
 let epoch,stop=false,locked=false,loop,timer,wake;
 const frames=[];
 const stopLocked=start=>{
  locked=true;stop=true;
  frames.push({event:'recording_stopped_locked',requested_ms:start-epoch,completed_ms:performance.now()-epoch});
 };
 async function capture(){
  if(locked)return;
  const start=performance.now();
  try{
   if(await camera.call('/wda/locked')!==false){stopLocked(start);return;}
   const bytes=await camera.call('/screenshot?max_side=1000&format=jpeg&quality=0.75');
   // Discard a frame if the phone locked while its screenshot was in flight.
   if(await camera.call('/wda/locked')!==false){stopLocked(start);return;}
   const file=String(frames.length).padStart(4,'0')+'.jpg';
   await writeFile(join(directory,file),Buffer.from(bytes,'base64'));
   frames.push({file,requested_ms:start-epoch,completed_ms:performance.now()-epoch});
  }catch(error){frames.push({error:error.message,requested_ms:start-epoch,completed_ms:performance.now()-epoch});}
 }
 return {
  async start(){
   await mkdir(directory,{recursive:true,mode:0o700});epoch=performance.now();
   await capture();
   if(!frames[0]?.file)throw Error('Initial screen capture failed or phone locked');
   loop=(async()=>{while(!stop){await new Promise(resolve=>{wake=resolve;timer=setTimeout(resolve,interval);});if(!stop)await capture();}})();
   return epoch;
  },
  async end(){
   stop=true;clearTimeout(timer);wake?.();await loop;
   if(!locked)await capture();
   await writeFile(join(directory,'frames.json'),JSON.stringify(frames,null,2)+'\n');
   return {frames,stopped_reason:locked?'phone_locked':'finished'};
  }
 };
}
