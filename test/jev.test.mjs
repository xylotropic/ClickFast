import test from 'node:test';import assert from 'node:assert/strict';
import {JevChooser,runLocalGoal} from '../src/jev.mjs';
import {performance} from 'node:perf_hooks';
const screen=(label='Next')=>({app:'test.app',snapshot:'s1',elements:[{ref:'s1:0',kind:'Button',label,enabled:true,rect:{x:0,y:0,width:50,height:50}}]});
const options={external_ui_opt_in:true,goal:'Open the editor',apps:['test.app'],allowed_selectors:[{kind:'Button',label:'Next'}],until:{selector:{label:'Editor'}}};
const decision={choice:'a0',confidence:1,selected_probability:1,available:1,model:'fixed-model',usage:{input_tokens:4,output_tokens:1}};
const body=choice=>({model:'fixed-model',answers:{next:{type:'choice',choice,confidence:1,probabilities:{a0:1}},available:{type:'noul',noul:1}},usage:{input_tokens:4,output_tokens:1}});
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
test('a labeled BackButton keeps its native back meaning in the chooser request',async()=>{
 let sent;const chooser=new JevChooser({apiKey:'test-key',fetchImpl:async(url,request)=>{sent=JSON.parse(request.body);return {ok:true,text:async()=>JSON.stringify(body('a0'))};}});
 const s=screen('Contacts');s.elements[0].identifier='BackButton';await chooser.choose({goal:'Go back',observation:s,candidates:s.elements,history:[]});
 assert.equal(sent.state.controls.a0.label,'Back to Contacts');assert.match(sent.questions.next.criteria.a0,/Back to Contacts/);
});
test('a backstage or playback identifier is not a navigation Back control',async()=>{
 for(const identifier of ['id.ui.backstage.comment_button','playbackButton']){
  let sent;const chooser=new JevChooser({apiKey:'test-key',fetchImpl:async(url,request)=>{sent=JSON.parse(request.body);return {ok:true,text:async()=>JSON.stringify(body('a0'))};}});
  const s=screen('Comment');s.elements[0].identifier=identifier;await chooser.choose({goal:'Inspect',observation:s,candidates:s.elements,history:[]});
  assert.equal(sent.state.controls.a0.label,'Comment');
 }
});
test('search navigation uses the observed prerequisite without typing into a detail view',async()=>{
 const c=fakeController();c.observe=async function(){return this.current={...screen('Contacts'),elements:[{...screen('Contacts').elements[0],identifier:'BackButton'},{ref:'empty',kind:'Cell',label:'',enabled:true}]};};
 const result=await runLocalGoal(c,{...options,allowed_selectors:undefined,visible_controls:true,until:{selector:{kind:'SearchField',label:'Search',value:'query'}}},{chooser:{choose:async({goal,candidates})=>{assert.match(goal,/navigation Back button to Contacts/);assert.equal(candidates.length,1);return {...decision,available:0};}}});
 assert.equal(result.ok,false);assert.equal(c.inputs,0);
});
test('search opens through a visible Search control before selecting a missing field',async()=>{
 const c=fakeController();c.observe=async function(){return this.current=screen('Search');};
 const result=await runLocalGoal(c,{...options,allowed_selectors:undefined,visible_controls:true,until:{selector:{kind:'SearchField',label:'Search',value:'query'}}},{chooser:{choose:async({goal})=>{assert.equal(goal,'Open search in the current app.');return {...decision,available:0};}}});
 assert.equal(result.ok,false);assert.equal(c.inputs,0);
});
test('local goal requires explicit external UI opt-in before observing or sending',async()=>{
 const c=fakeController();await assert.rejects(runLocalGoal(c,{...options,external_ui_opt_in:false},{chooser:{choose:async()=>decision}}),/opt_in/);assert.equal(c.current,null);assert.equal(c.inputs,0);
});
test('one bounded chooser action succeeds only after its independent predicate appears',async()=>{
 const c=fakeController();const result=await runLocalGoal(c,options,{chooser:{choose:async()=>decision}});
 assert.equal(result.ok,true);assert.equal(result.chooser_calls,1);assert.equal(c.inputs,1);assert.equal(result.outcome,'verified');
});
test('a loading screen with no controls is observed again before asking for a decision',async()=>{
 let reads=0;const c=fakeController();c.observe=async function(){reads++;return this.current=reads===1?{...screen(),elements:[{kind:'ActivityIndicator',label:'Loading'}]}:screen();};
 const result=await runLocalGoal(c,options,{chooser:{choose:async({observation})=>{assert.ok(observation.elements.some(x=>x.ref));return decision;}}});
 assert.equal(result.ok,true);assert.equal(result.chooser_calls,1);assert.equal(reads,2);assert.equal(c.inputs,1);
});
test('an empty transition tree cannot prove absence or prompt a speculative swipe',async()=>{
 let reads=0;const c=fakeController();c.observe=async function(){reads++;return this.current=reads===1?{...screen(),elements:[]}:screen();};
 const result=await runLocalGoal(c,{...options,until:{app:'test.app',absent:{label:'Preview'}}},{chooser:{choose:async()=>{throw Error('No action is needed after the transition settles');}}});
 assert.equal(result.ok,true);assert.equal(reads,2);assert.equal(c.inputs,0);
});
test('an unrelated clock update cannot prompt a second navigation tap before the requested field appears',async()=>{
 const field={kind:'SearchField',label:'Search',ref:'s2:field',value:'',enabled:true};let calls=0,reads=0;
 const c={current:null,inputs:[],async observe(){reads++;return this.current=reads===1?screen('Open search'):{...screen(),snapshot:'s2',bound_text:1,elements:[field]};},async execute(steps){this.inputs.push(steps[0]);this.current=steps[0].op==='tap'?{...screen('Open search'),elements:[...screen('Open search').elements,{kind:'StaticText',label:'12:01'}]}:{...this.current,elements:[{...field,value:'exact query'}]};return {ok:true};}};
 const result=await runLocalGoal(c,{external_ui_opt_in:true,goal:'Open search and enter the exact query',apps:['test.app'],visible_controls:true,texts:{query:'exact query'},until:{app:'test.app',selector:{kind:'SearchField',label:'Search',value:'exact query'}}},{chooser:{choose:async()=>{calls++;if(calls>1)throw Error('Second tap selected from the stale screen');return decision;}}});
 assert.equal(result.ok,true);assert.equal(calls,1);assert.deepEqual(c.inputs.map(x=>x.op),['tap','text']);
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
test('a native stale-snapshot refusal re-observes and re-decides with fresh refs',async()=>{
 let reads=0,attempts=0;const seen=[];
 const c={current:null,async observe(){reads++;return this.current={...screen(),snapshot:'s'+reads,elements:[{...screen().elements[0],ref:'s'+reads+':0'}]};},async execute(steps){seen.push(steps[0]);attempts++;if(attempts===1){this.current=null;return {ok:false,error:'Screen snapshot is stale; no input dispatched',outcome:'not_sent'};}this.current=screen('Editor');return {ok:true};}};
 const result=await runLocalGoal(c,options,{chooser:{choose:async()=>decision}});
 assert.equal(result.ok,true);assert.equal(reads,2);assert.equal(result.chooser_calls,2);
 assert.deepEqual(seen.map(s=>[s.snapshot,s.ref]),[['s1','s1:0'],['s2','s2:0']]);
 assert.equal(result.events.filter(x=>x.kind==='recovery').length,1);
});
test('stale recovery is bounded and never retries uncertain delivery or unrelated refusals',async()=>{
 for(const [outcome,error,expected] of [['not_sent','Screen snapshot is stale; no input dispatched',2],['unknown','Screen snapshot is stale; no input dispatched',1],['not_sent','Target changed; observe again',2],['unknown','Target changed; observe again',1],['not_sent','Target is covered; no input dispatched',1]]){
  const c=fakeController();c.execute=async function(){this.inputs++;this.current=null;return {ok:false,outcome,error};};
  const result=await runLocalGoal(c,options,{chooser:{choose:async()=>decision}});
  assert.equal(result.ok,false);assert.equal(c.inputs,expected);
 }
});
test('a moved target refused before input is observed again once with a fresh identity',async()=>{
 let reads=0;const c=fakeController();c.observe=async function(){reads++;return this.current=screen();};
 c.execute=async function(){this.inputs++;if(this.inputs===1){this.current=null;return {ok:false,error:'Target moved; observe again',outcome:'not_sent'};}this.current=screen('Editor');return {ok:true};};
 const result=await runLocalGoal(c,options,{chooser:{choose:async()=>decision}});
 assert.equal(result.ok,true);assert.equal(reads,2);assert.equal(c.inputs,2);
});
test('a changed target refused before input requires a fresh JEV choice, never replays the old ref',async()=>{
 let reads=0;const seen=[],chosen=[];
 const c={current:null,async observe(){reads++;return this.current={...screen(),snapshot:'s'+reads,elements:[{...screen().elements[0],ref:'fresh-'+reads}]};},async execute(steps){seen.push(steps[0]);if(seen.length===1){this.current=null;return {ok:false,error:'Target changed; observe again',outcome:'not_sent'};}this.current=screen('Editor');return {ok:true};}};
 const result=await runLocalGoal(c,options,{chooser:{choose:async({candidates})=>{chosen.push(candidates[0].ref);return decision;}}});
 assert.equal(result.ok,true);assert.deepEqual(chosen,['fresh-1','fresh-2']);
 assert.deepEqual(seen.map(s=>s.ref),['fresh-1','fresh-2']);assert.equal(reads,2);
});
test('the chooser selects only executable actions; abstention stays in its independent question',async()=>{
 let sent;const chooser=new JevChooser({apiKey:'test-key',fetchImpl:async(url,request)=>{sent=JSON.parse(request.body);const keys=Object.keys(sent.questions.next.criteria);return {ok:true,text:async()=>JSON.stringify({answers:{next:{type:'choice',choice:keys[0],confidence:1,probabilities:Object.fromEntries(keys.map((k,i)=>[k,i===0?1:0]))},available:{type:'noul',noul:1}}})};}});
 await chooser.choose({goal:'Enter two consecutive copies of a letter',observation:screen(),candidates:screen().elements,history:[]});
 assert.deepEqual(Object.keys(sent.questions.next.criteria),['a0']);
 assert.doesNotMatch(JSON.stringify(sent.questions.next),/do not repeat completed actions/);
});
test('visible-control scope includes app and folder icons without an app-specific selector list',async()=>{
 const c=fakeController();c.observe=async function(){const s=screen('Productivity');s.elements[0].kind='Icon';return this.current=s;};
 const result=await runLocalGoal(c,{...options,allowed_selectors:undefined,visible_controls:true},{chooser:{choose:async({candidates})=>{assert.equal(candidates[0].kind,'Icon');return decision;}}});
 assert.equal(result.ok,true);assert.equal(c.inputs,1);
});
test('an exact authorized literal can focus then type into the observed field',async()=>{
 const literal='Operator café 27 — punctuation!';const field={ref:'s1:0',kind:'SearchField',label:'Search',value:'',focused:false,enabled:true,rect:{x:0,y:0,width:200,height:50}};
 const c={current:null,steps:[],async observe(){return this.current={app:'test.app',snapshot:'s1',width:440,height:956,elements:[field]};},async execute(steps){this.steps.push(...steps);this.current={...this.current,elements:[{...field,focused:true,value:steps.some(s=>s.op==='text')?literal:''}]};return {ok:true};}};
 const result=await runLocalGoal(c,{...options,visible_controls:true,allowed_selectors:undefined,texts:{query:literal},until:{selector:{kind:'SearchField',value:literal}}},{chooser:{choose:async({candidates})=>{const i=candidates.findIndex(x=>x.operation==='text');assert.ok(i>=0);return {...decision,choice:'a'+i};}}});
 assert.equal(result.ok,true);assert.equal(c.steps.at(-1).op,'text');assert.equal(c.steps.at(-1).text,literal);
});
test('automatic text candidates never overwrite an existing unrelated draft',async()=>{
 const c=fakeController();c.observe=async function(){return this.current={...screen(),elements:[{...screen().elements[0],kind:'TextView',focused:true,value:'An existing private draft'}]};};
 const result=await runLocalGoal(c,{...options,visible_controls:true,allowed_selectors:undefined,texts:{query:'Operator test'}},{chooser:{choose:async({candidates})=>{assert.ok(!candidates.some(x=>x.operation==='text'));return {...decision,choice:'BLOCKED'};}}});
 assert.equal(result.ok,false);assert.equal(c.inputs,0);
});
test('duplicate AX projections of the same physical icon do not split the choice',async()=>{
 const {actionCandidates}=await import('../src/jev.mjs');const row={...screen().elements[0],kind:'Icon',native_ref:'native-alias'};
 const s={...screen(),elements:[row,{...row,ref:'s1:1',native_ref:'native-alias'}]};assert.equal(actionCandidates(s,{visible_controls:true}).length,1);
});
test('a read-only TextView whose value equals its label is not an empty editor',async()=>{
 const {actionCandidates}=await import('../src/jev.mjs');const s={...screen(),elements:[{...screen().elements[0],kind:'TextView',label:'A real document',value:'A real document',focused:false}]};
 assert.ok(!actionCandidates(s,{visible_controls:true,texts:{query:'Operator'}}).some(x=>x.operation==='text'));
});
test('an open folder is not a completed Home Screen goal; Home waits for dismissal',async()=>{
 const folder={kind:'TextField',label:'Productivity, Folder name'};
 const c={current:null,inputs:0,async observe(){return this.current={app:'com.apple.springboard',snapshot:'s1',elements:[folder]};},async execute(steps){this.inputs++;assert.deepEqual(steps[0].expect,{app:'com.apple.springboard',absent:folder});this.current={...this.current,elements:[{kind:'Button',label:'Search',ref:'search'}]};return {ok:true};}};
 const result=await runLocalGoal(c,{external_ui_opt_in:true,goal:'Close the folder',apps:['com.apple.springboard'],visible_controls:true,allow_home:true,until:{app:'com.apple.springboard',absent:folder}},{chooser:{choose:async()=>decision}});
 assert.equal(result.ok,true);assert.equal(c.inputs,1);assert.equal(result.chooser_calls,1);
});

const exactEntryOptions={external_ui_opt_in:true,goal:'Enter the exact query in Find',apps:['test.app'],visible_controls:true,texts:{query:'ClickFast café — 27!'},until:{selector:{kind:'SearchField',label:'Find',value:'ClickFast café — 27!'}}};
function exactEntryController(extra={}){
 const field={ref:'s1:field',native_ref:'native-field',kind:'SearchField',label:'Find',value:'',focused:false,enabled:true,rect:{x:0,y:0,width:200,height:50}};
 return {current:null,steps:[],async observe(){return this.current={app:'test.app',snapshot:'s1',width:440,height:956,bound_text:1,elements:[{ref:'s1:button',kind:'Button',label:'Search',enabled:true},field],...extra};},async execute(steps){this.steps.push(...steps);this.current={...this.current,elements:this.current.elements.map(x=>x.ref===field.ref?{...x,value:steps[0].text,focused:true}:x)};return {ok:true};}};
}
test('an exact field and literal use native admission without a speculative prerequisite',async()=>{
 const c=exactEntryController();let calls=0;const result=await runLocalGoal(c,exactEntryOptions,{chooser:{choose:async()=>{calls++;throw Error('A known field does not need a model decision');}}});
 assert.equal(result.ok,true);assert.equal(calls,0);assert.equal(result.chooser_calls,0);assert.deepEqual(c.steps,[{op:'text',ref:'s1:field',snapshot:'s1',text:exactEntryOptions.texts.query,app:'test.app'}]);
 assert.equal(result.events.find(x=>x.kind==='decision')?.source,'exact_field');
});
test('an unfocused field immediately after launch is observed after the opening transition',async()=>{
 const c=exactEntryController();c.lastLaunchAt=performance.now();let reads=0;const original=c.observe;
 c.observe=async function(){const s=await original.call(this);reads++;s.elements[1].ref='field-'+reads;return this.current=s;};
 c.execute=async function(steps){assert.equal(steps[0].ref,'field-2');this.steps.push(...steps);this.current.elements[1].value=steps[0].text;this.current.elements[1].focused=true;return {ok:true};};
 const result=await runLocalGoal(c,exactEntryOptions,{chooser:{choose:async()=>{throw Error('Exact entry needs no model choice');}}});
 assert.equal(result.ok,true);assert.equal(reads,2);assert.equal(c.steps.length,1);
});
test('an exact text shortcut requires the native capability and a complete observation',async()=>{
 for(const extra of [{bound_text:0},{truncated:true}]){
  const c=exactEntryController(extra);let calls=0;const result=await runLocalGoal(c,exactEntryOptions,{chooser:{choose:async()=>{calls++;return {...decision,choice:'BLOCKED'};}}});
  assert.equal(result.ok,false);assert.equal(calls,1);assert.equal(c.steps.length,0);
 }
});
test('an exact text shortcut cannot choose an empty field beside an ambiguous draft',async()=>{
 const c=exactEntryController();const observe=c.observe.bind(c);c.observe=async function(){const s=await observe();s.elements.push({...s.elements[1],ref:'s1:other',native_ref:'another-field',value:'An existing draft'});return s;};
 const result=await runLocalGoal(c,exactEntryOptions,{chooser:{choose:async()=>({...decision,choice:'BLOCKED'})}});
 assert.equal(result.ok,false);assert.equal(c.steps.length,0);
});
test('an exact text shortcut requires the supplied literal and no unmet extra submit condition',async()=>{
 for(const opt of [{texts:{query:'A different literal'}},{until:{...exactEntryOptions.until,after_action:{kind:'Button',label:'Search'}}},{until:{...exactEntryOptions.until,absent:{kind:'Keyboard'}}}]){
  const c=exactEntryController();let calls=0;const result=await runLocalGoal(c,{...exactEntryOptions,...opt},{chooser:{choose:async()=>{calls++;return {...decision,choice:'BLOCKED'};}}});assert.equal(result.ok,false);assert.equal(calls,1);assert.equal(c.steps.length,0);
 }
});
test('JEV-only comparisons can explicitly disable direct text admission',async()=>{
 const c=exactEntryController();let calls=0;const result=await runLocalGoal(c,{...exactEntryOptions,direct_text:false},{chooser:{choose:async()=>{calls++;return {...decision,choice:'BLOCKED'};}}});assert.equal(result.ok,false);assert.equal(calls,1);assert.equal(c.steps.length,0);
});
test('an exact text shortcut cannot infer the destination from a field shared across permitted apps',async()=>{
 const c=exactEntryController();let calls=0;
 const result=await runLocalGoal(c,{...exactEntryOptions,apps:['test.app','another.app']},{chooser:{choose:async()=>{calls++;return {...decision,choice:'BLOCKED'};}}});
 assert.equal(result.ok,false);assert.equal(calls,1);assert.equal(c.steps.length,0);
});
test('an explicit destination app permits exact text even when other apps are in scope',async()=>{
 const c=exactEntryController();let calls=0;
 const result=await runLocalGoal(c,{...exactEntryOptions,apps:['test.app','another.app'],until:{...exactEntryOptions.until,app:'test.app'}},{chooser:{choose:async()=>{calls++;return {...decision,choice:'BLOCKED'};}}});
 assert.equal(result.ok,true);assert.equal(calls,0);assert.equal(c.steps.length,1);
});
test('an explicit sole destination launches directly, then JEV handles navigation in that app',async()=>{
 const c={current:null,steps:[],async observe(){return this.current={...screen(),app:'com.apple.springboard'};},async execute(steps){this.steps.push(...steps);this.current={...screen('Editor'),app:'test.app'};return {ok:true};}};
 const result=await runLocalGoal(c,{...options,apps:['com.apple.springboard','test.app'],launch_apps:[{bundle:'test.app',label:'Test'}],until:{app:'test.app',selector:{label:'Editor'}}},{chooser:{choose:async()=>{throw Error('Explicit app launch needs no model choice');}}});
 assert.equal(result.ok,true);assert.deepEqual(c.steps,[{op:'launch',bundle:'test.app'}]);assert.equal(result.chooser_calls,0);
});
test('a newly launched pixel-only frame gets fresh AX before the next navigation decision',async()=>{
 let reads=0;const field={...screen().elements[0],kind:'SearchField',label:'Find',value:''};
 const c={current:null,async observe(){reads++;return this.current=reads===1?{...screen(),mode:'pixels',elements:[]}:{...screen(),elements:[{...field,value:'needle'}]};},async execute(){throw Error('No input is needed once the real result is visible');}};
 const result=await runLocalGoal(c,{...options,visible_controls:true,until:{selector:{kind:'SearchField',value:'needle'}}},{chooser:{choose:async()=>{throw Error('A transient empty frame is not a model decision');}}});
 assert.equal(result.ok,true);assert.equal(reads,2);assert.equal(result.chooser_calls,0);
});

test('an explicitly scoped visual intent rechecks the selected text before guarded input',async()=>{
 const row={text:'Next',confidence:.99,x:.2,y:.5,width:.2,height:.05};let captures=0;const inputs=[];
 const c={current:null,async observe(){return this.current={app:'test.app',snapshot:'s0',mode:'pixels',width:400,height:800,elements:[]};},async execute(steps){inputs.push(steps[0]);return {ok:true,completed:[0]};}};
 const vision={async capture(){captures++;return c.current={app:'test.app',snapshot:'s'+captures,mode:'pixels',width:400,height:800,elements:[],visual_rows:[captures>2?{...row,text:'Editor'}:row]};}};
 const result=await runLocalGoal(c,{external_ui_opt_in:true,goal:'Open the editor',apps:['test.app'],visual_labels:['Next'],until:{app:'test.app',visual:{all:['Editor']}}},{vision,chooser:{choose:async({candidates})=>{assert.deepEqual(candidates.map(x=>x.label),['Next']);return decision;}}});
 assert.equal(result.ok,true);assert.equal(inputs.length,1);assert.equal(inputs[0].op,'tap_point');assert.equal(inputs[0].snapshot,'s2');assert.equal(captures,3);
});
