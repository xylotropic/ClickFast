import test from 'node:test';import assert from 'node:assert/strict';
import {JevChooser,runLocalGoal} from '../src/jev.mjs';
const screen=(label='Next')=>({app:'test.app',snapshot:'s1',elements:[{ref:'s1:0',kind:'Button',label,enabled:true,rect:{x:0,y:0,width:50,height:50}}]});
const options={external_ui_opt_in:true,goal:'Open the editor',apps:['test.app'],allowed_selectors:[{kind:'Button',label:'Next'}],until:{selector:{label:'Editor'}}};
const decision={choice:'a0',confidence:1,selected_probability:1,available:1,model:'fixed-model',usage:{input_tokens:4,output_tokens:1}};
const body=choice=>({model:'fixed-model',answers:{next:{type:'choice',choice,confidence:1,probabilities:{a0:1,DONE:0,BLOCKED:0}},available:{type:'noul',noul:1}},usage:{input_tokens:4,output_tokens:1}});
const fakeController=()=>({current:null,inputs:0,async observe(){return this.current=screen();},async execute(){this.inputs++;this.current=screen('Editor');return {ok:true,observation:this.current};}});
test('JEV uses the primary API shape and sends only bounded candidate labels',async()=>{
 let sent;const chooser=new JevChooser({apiKey:'test-key',fetchImpl:async(url,request)=>{assert.equal(url,'https://api.typesafe.ai/v1/systemone');sent=JSON.parse(request.body);return {ok:true,text:async()=>JSON.stringify(body('a0'))};}});
 const s=screen();s.elements[0].value='private field value';
 const result=await chooser.choose({goal:'Open editor',observation:s,candidates:s.elements,history:[]});
 assert.equal(result.choice,'a0');assert.equal(sent.questions.available.type,'noul');assert.ok(!JSON.stringify(sent).includes('private field value'));
 assert.equal(sent.state.controls.a0.label,'Next');
});
test('a malformed or fabricated JEV action is refused',async()=>{
 const chooser=new JevChooser({apiKey:'test-key',fetchImpl:async()=>({ok:true,text:async()=>JSON.stringify(body('invented'))})});
 await assert.rejects(chooser.choose({goal:'Open',observation:screen(),candidates:screen().elements,history:[]}),/Malformed/);
});
test('local goal requires explicit external UI opt-in before observing or sending',async()=>{
 const c=fakeController();await assert.rejects(runLocalGoal(c,{...options,external_ui_opt_in:false},{chooser:{choose:async()=>decision}}),/opt_in/);assert.equal(c.current,null);assert.equal(c.inputs,0);
});
test('one bounded chooser action succeeds only after its independent predicate appears',async()=>{
 const c=fakeController();const result=await runLocalGoal(c,options,{chooser:{choose:async()=>decision}});
 assert.equal(result.ok,true);assert.equal(result.chooser_calls,1);assert.equal(c.inputs,1);assert.equal(result.outcome,'verified');
});
test('JEV DONE cannot substitute for a visible result',async()=>{
 const c=fakeController();const result=await runLocalGoal(c,options,{chooser:{choose:async()=>({...decision,choice:'DONE'})}});assert.equal(result.ok,false);assert.equal(c.inputs,0);
});
test('a matching intermediate value cannot finish before the required submit action',async()=>{
 const c=fakeController();c.observe=async function(){return this.current=screen('Next');};
 const result=await runLocalGoal(c,{...options,until:{selector:{label:'Next'},after_action:{label:'Equals'}}},{chooser:{choose:async()=>({...decision,choice:'DONE'})}});
 assert.equal(result.ok,false);assert.equal(result.chooser_calls,1);assert.equal(c.inputs,0);
});
test('completion can require both a submitted action and its visible result',async()=>{
 const c=fakeController();const result=await runLocalGoal(c,{...options,until:{selector:{label:'Editor'},after_action:{label:'Next'}}},{chooser:{choose:async()=>decision}});
 assert.equal(result.ok,true);assert.equal(c.inputs,1);
});
test('a low-confidence decision and protected publication target send no input',async()=>{
 const c=fakeController();let result=await runLocalGoal(c,options,{chooser:{choose:async()=>({...decision,available:0.5})}});assert.equal(result.ok,false);assert.equal(c.inputs,0);
 c.observe=async function(){return this.current=screen('Share');};
 result=await runLocalGoal(c,{...options,allowed_selectors:[{label:'Share'}]},{chooser:{choose:async()=>{throw new Error('must not request this action');}}});assert.equal(result.chooser_calls,0);assert.equal(c.inputs,0);
});
test('an uncertain native action is handed back once without replay',async()=>{
 const c=fakeController();c.execute=async function(){this.inputs++;this.current=null;return {ok:false,error:'lost response',outcome:'unknown'};};
 const result=await runLocalGoal(c,options,{chooser:{choose:async()=>decision}});assert.equal(result.outcome,'unknown');assert.equal(c.inputs,1);assert.equal(result.chooser_calls,1);
});
