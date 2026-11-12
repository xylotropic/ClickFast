import test from 'node:test';
import assert from 'node:assert/strict';
import {Controller} from '../src/driver.mjs';
import {cleanupTask} from '../scripts/benchmark-general-support.mjs';

const task={reset_text:{selector:{kind:'SearchField',label:'Search'},owned_values:['ClickFast trial']},cleanup:[{op:'tap',selector:{kind:'Button',label:'Clear text'}}]};
function fixture(value,{ambiguous=false,clear=true}={}){
 let inputs=0;
 const screen=()=>({app:'test.app',snapshot:'s1',elements:[{kind:'SearchField',label:'Search',value},...(ambiguous?[{kind:'SearchField',label:'Search',value:'Other draft'}]:[]),{kind:'Button',label:'Clear text',ref:'clear',enabled:true}]});
 const runner={async call(path){if(path==='/sprint/observe')return screen();assert.equal(path,'/sprint/act');inputs++;if(clear)value='';return screen();}};
 return {controller:new Controller(runner),inputs:()=>inputs};
}
test('cleanup preserves unrelated text after a stopped setup',async()=>{
 const f=fixture('An unsaved personal draft');
 assert.equal((await cleanupTask(f.controller,task)).status,'preserved');assert.equal(f.inputs(),0);
});
test('cleanup clears only the known benchmark query and verifies the result',async()=>{
 const f=fixture('ClickFast trial');
 assert.equal((await cleanupTask(f.controller,task)).status,'verified');assert.equal(f.inputs(),1);
});
test('cleanup preserves ambiguous fields even when one contains the benchmark query',async()=>{
 const f=fixture('ClickFast trial',{ambiguous:true});
 assert.equal((await cleanupTask(f.controller,task)).status,'preserved');assert.equal(f.inputs(),0);
});
test('cleanup does not report an ineffective clear as verified',async()=>{
 const f=fixture('ClickFast trial',{clear:false});
 await assert.rejects(cleanupTask(f.controller,task),/did not verify/);assert.equal(f.inputs(),1);
});
