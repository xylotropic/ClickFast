import test from 'node:test';
import assert from 'node:assert/strict';
import {runLocalGoal,JevChooser} from '../src/jev.mjs';
import {PhoneVision} from '../src/local-vision.mjs';
const row=(text='Next',y=.5)=>({text,confidence:.99,x:.2,y,width:.2,height:.04});
const frame=(visual_rows=[row()],n=1)=>({app:'test.app',snapshot:'s'+n,mode:'pixels',width:400,height:800,elements:[],visual_rows});
const opts={external_ui_opt_in:true,goal:'Open the editor',apps:['test.app'],visual_labels:['Next'],until:{app:'test.app',visual:{all:['Editor']}}};
const decision={choice:'a0',confidence:1,selected_probability:1,available:1};
function harness(captures){
 let reads=0;const inputs=[];const c={current:null,async execute(steps){inputs.push(steps[0]);return {ok:true,completed:[0]};}};
 return {c,inputs,vision:{async capture(){const next=captures[Math.min(reads,captures.length-1)];reads++;return c.current={...next,snapshot:'s'+reads};}},chooser:{choose:async()=>decision}};
}
test('visual app or geometry changes between decision and input are refused',async()=>{
 for(const changed of [{app:'other.app'},{width:800,height:400}]){
  const h=harness([frame(),{...frame(),...changed}]);
  const r=await runLocalGoal(h.c,opts,h);assert.equal(r.ok,false);assert.equal(h.inputs.length,0);
 }
});
test('duplicate, missing, moved and low-confidence OCR targets never receive input',async()=>{
 for(const changed of [[],[row(),row()],[{...row(),x:.4}],[{...row(),confidence:.4}]]){
  const h=harness([frame(),frame(changed)]);
  const r=await runLocalGoal(h.c,opts,h);assert.equal(r.ok,false);assert.equal(h.inputs.length,0);
 }
});
test('ambiguous or protected labels are excluded before calling JEV',async()=>{
 for(const [labels,rows] of [[['Next'],[row(),row()]],[['Publish'],[row('Publish')]]]){
  const h=harness([frame(rows)]);let calls=0;h.chooser={choose:async()=>{calls++;return decision;}};
  const r=await runLocalGoal(h.c,{...opts,visual_labels:labels},h);
  assert.equal(r.ok,false);assert.equal(calls,0);assert.equal(h.inputs.length,0);
 }
});
test('visual confidence gates and malformed decisions cannot send input',async()=>{
 for(const bad of [{available:.89},{confidence:NaN},{selected_probability:0},{choice:'a99'}]){
  const h=harness([frame()]);h.chooser={choose:async()=>({...decision,...bad})};
  const r=await runLocalGoal(h.c,opts,h);assert.equal(r.ok,false);assert.equal(h.inputs.length,0);
 }
});
test('uncertain coordinate delivery stops without a second tap',async()=>{
 const h=harness([frame()]);h.c.execute=async steps=>{h.inputs.push(steps[0]);return {ok:false,error:'lost receipt',outcome:'unknown'};};
 const r=await runLocalGoal(h.c,opts,h);assert.equal(r.ok,false);assert.equal(r.outcome,'unknown');assert.equal(h.inputs.length,1);
});
test('visual mode cannot silently replace an AX selector or absence predicate',async()=>{
 for(const until of [{...opts.until,selector:{label:'Editor'}},{...opts.until,absent:{label:'Next'}}]){
  const h=harness([frame()]);await assert.rejects(runLocalGoal(h.c,{...opts,until},h),/cannot be substituted/);assert.equal(h.c.current,null);
 }
});
test('label text and movement are independently checked after one guarded scroll',async()=>{
 const before=frame([row('Header',.9),row('Stable first title',.6),row('Stable second title',.4)]);
 const after=frame([row('Header',.9),row('Stable first title',.8),row('Stable second title',.6)]);
 const h=harness([before,before,after]);
 const r=await runLocalGoal(h.c,{...opts,visual_labels:[],scroll_directions:['up'],until:{app:'test.app',visual:{all:['Header'],moved:true}}},h);
 assert.equal(r.ok,true);assert.equal(r.visual_movement.verified,true);assert.equal(h.inputs.length,1);assert.equal(h.inputs[0].op,'scroll');
});
test('launching an allowed app does not satisfy a pending movement predicate',async()=>{
 const home={...frame(),app:'com.apple.springboard'};
 const before=frame([row('Header',.9),row('Stable first title',.6),row('Stable second title',.4)]);
 const after=frame([row('Header',.9),row('Stable first title',.8),row('Stable second title',.6)]);
 const h=harness([home,home,before,before,after]);
 h.chooser={choose:async({candidates})=>({...decision,choice:'a'+candidates.findIndex(x=>x.operation===(h.inputs.length?'scroll':'launch'))})};
 const r=await runLocalGoal(h.c,{...opts,apps:['com.apple.springboard','test.app'],visual_labels:[],launch_apps:[{label:'Test',bundle:'test.app'}],scroll_directions:['up'],until:{app:'test.app',visual:{all:['Header'],moved:true}}},h);
 assert.equal(r.ok,true);assert.deepEqual(h.inputs.map(s=>s.op),['launch','scroll']);
});
test('OCR and screenshots are not added to the external JEV request',async()=>{
 let sent;const chooser=new JevChooser({apiKey:'test',fetchImpl:async(url,args)=>{sent=args.body;return {ok:true,text:async()=>JSON.stringify({answers:{next:{type:'choice',choice:'a0',confidence:1,probabilities:{a0:1}},available:{type:'noul',noul:1}}})};}});
 await chooser.choose({goal:'Open editor',observation:frame([row('private caption')]),candidates:[{kind:'VisibleText',label:'Next',visual_row:row('private caption')}],history:[]});
 assert.doesNotMatch(sent,/private caption|visual_row|image/);assert.match(sent,/Next/);
});
test('locked capture discards the image before local recognition',async()=>{
 let lock=0,recognized=0;
 const c={async observe(){return frame();},runner:{async call(path){if(path==='/wda/locked')return ++lock>1;if(path.startsWith('/screenshot'))return Buffer.from('jpg').toString('base64');}}};
 const vision=new PhoneVision(async()=>{recognized++;return [];});
 await assert.rejects(vision.capture(c),/locked during capture/);assert.equal(recognized,0);
});
test('capture rejects an app switch during OCR and invalid screen coordinates',async()=>{
 let reads=0;const c={async observe(){return {...frame(),app:++reads===1?'test.app':'other.app'};},runner:{async call(path){return path==='/wda/locked'?false:Buffer.from('jpg').toString('base64');}}};
 const vision=new PhoneVision(async()=>[row()]);await assert.rejects(vision.capture(c),/App or geometry changed/);
 const stable={...c,async observe(){return frame();}};
 const filtered=await new PhoneVision(async()=>[row(),{...row(),x:-1},{...row(),confidence:NaN}]).capture(stable);
 assert.equal(filtered.visual_rows.length,1);
});
test('changing video text cannot authorize a repeated tap when permitted controls stay unchanged',async()=>{
 let n=0;const h=harness([frame()]);h.vision={async capture(){return h.c.current=frame([row(),row('Changing subtitle '+n++,.3)],n);}};
 const r=await runLocalGoal(h.c,{...opts,timeout_ms:5000},h);
 assert.equal(r.ok,false);assert.equal(r.reason,'No relevant visual progress; input was not repeated');assert.equal(h.inputs.length,1);
});
test('an exact phrase uses recognized word boxes rather than an adjoining dropdown glyph',async()=>{
 const {matchingVisualRows}=await import('../src/visual-evidence.mjs');
 const words=[{...row('For'),x:.2,width:.06},{...row('you'),x:.27,width:.06},{...row('v'),x:.36,width:.03}];
 const line={...row('For you v'),width:.2,words};
 const matches=matchingVisualRows([line],'For You');
 assert.equal(matches.length,1);assert.equal(matches[0].text,'For you');assert.ok(matches[0].x+matches[0].width<.36);
 assert.equal(matchingVisualRows([{...row('Following'),words:[row('Following')]}],'Follow').length,0);
 assert.equal(matchingVisualRows([{...row('Next Next'),words:[row('Next'),{...row('Next'),x:.5}]}],'Next').length,2);
});
test('visual readiness is checked before inference and again before input',async()=>{
 const ready={all:['Starting page'],none:['Loading']};
 for(const frames of [[frame()],[frame([row(),row('Starting page',.8)]),frame([row(),row('Loading',.8)])]]){
  const h=harness(frames);const r=await runLocalGoal(h.c,{...opts,visual_ready:ready,readiness_timeout_ms:0},h);
  assert.equal(r.ok,false);assert.equal(h.inputs.length,0);
 }
});
test('visual-only options cannot be silently ignored by the AX loop',async()=>{
 for(const extra of [{visual_ready:{all:['Starting page']}},{scroll_directions:['up']}]){
  const h=harness([frame()]);await assert.rejects(runLocalGoal(h.c,{external_ui_opt_in:true,goal:'Open editor',apps:['test.app'],visible_controls:true,until:{app:'test.app',selector:{label:'Editor'}},...extra},h),/Visual mode requires/);assert.equal(h.c.current,null);
 }
});

test('visual readiness observes a loading transition before inference without sending input',async()=>{
 const readyFrame=frame([row(),row('Starting page',.8)]),h=harness([frame([row('Loading')]),readyFrame,readyFrame,frame([row('Editor')])]);
 let calls=0;h.chooser={choose:async({observation})=>{calls++;assert.ok(observation.jev_visible_text.includes('Starting page'));return decision;}};
 const r=await runLocalGoal(h.c,{...opts,visual_ready:{all:['Starting page'],none:['Loading']}},h);
 assert.equal(r.ok,true);assert.equal(calls,1);assert.equal(h.inputs.length,1);
});
test('the final permitted launch still waits for its visual result instead of returning at the app ACK',async()=>{
 const home={...frame(),app:'com.apple.springboard'},loading=frame([row('Loading')]),ready=frame([row('Editor')]);
 const h=harness([home,home,loading,ready]);
 const r=await runLocalGoal(h.c,{...opts,apps:['com.apple.springboard','test.app'],visual_labels:[],launch_apps:[{label:'Test',bundle:'test.app'}],max_actions:1},h);
 assert.equal(r.ok,true);assert.equal(h.inputs.length,1);assert.equal(h.inputs[0].op,'launch');
});
