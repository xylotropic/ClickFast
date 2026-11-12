import test from 'node:test';
import assert from 'node:assert/strict';
import {visibleResult,visibleContentChange,waitForVisualChange} from '../scripts/benchmark-visual.mjs';
const line=(text,y=.5)=>({text,confidence:.99,x:.1,y,width:.8,height:.03});
test('a visual app result requires every marker, not one matching word',()=>{
 const predicate={min_lines:3,all:[['For You'],['Following'],['Profile']]};
 assert.equal(visibleResult([line('ForYou'),line('Following'),line('Profile')],predicate),true);
 assert.equal(visibleResult([line('For You'),line('Following'),line('Sign in')],predicate),false);
 assert.equal(visibleResult([],predicate),false);
});
test('a clock change alone cannot pass a feed scroll',()=>{
 const before=[line('12:24',.97),line('The same first post',.6),line('The same second post',.4)];
 const after=[line('12:25',.97),line('The same first post',.6),line('The same second post',.4)];
 assert.equal(visibleContentChange(before,after).verified,false);
});
test('loading and error overlays prevent a visual result even when navigation is visible',()=>{
 const lines=[line('For You'),line('Following'),line('Profile')];
 const predicate={any:[{all:[['For You'],['Profile']]}],none:['Loading your feed','Something went wrong']};
 assert.equal(visibleResult(lines,predicate),true);
 assert.equal(visibleResult([...lines,line('Loading your feed')],predicate),false);
 assert.equal(visibleResult([...lines,line('Something went wrong')],predicate),false);
});
test('replaced text alone cannot distinguish scrolling from video playback',()=>{
 const before=[line('The first post title',.6),line('The first post caption',.4)];
 const after=[line('Another post title',.6),line('Another post caption',.4)];
 assert.equal(visibleContentChange(before,after).verified,false);
 assert.equal(visibleContentChange([],after).verified,false);
});
test('a delivered scroll can render later; verification observes without repeating input',async()=>{
 const before=[line('The first post title',.6),line('The first post caption',.4)];
 let reads=0;
 const result=await waitForVisualChange(before,async()=>({frame:++reads,lines:reads<3?before:[line('The first post title',.8),line('The first post caption',.6)]}),{now:()=>reads,timeout:5});
 assert.equal(result.change.verified,true);assert.equal(reads,3);assert.equal(result.frame,3);
});
test('small OCR drift and one animated caption do not establish feed movement',()=>{
 const before=[line('Stable post title',.6),line('Stable post caption',.4),line('Video subtitle one',.5)];
 const after=[line('Stable post title',.601),line('Stable post caption',.399),line('Video subtitle two',.3)];
 assert.equal(visibleContentChange(before,after).verified,false);
});
test('two stable body rows moving together verify a scroll',()=>{
 const before=[line('Stable post title',.6),line('Stable post caption',.4)];
 const after=[line('Stable post title',.75),line('Stable post caption',.55)];
 assert.equal(visibleContentChange(before,after).verified,true);
 assert.equal(visibleContentChange(before,after).moved_anchors,2);
});
test('unchanged content reaches its deadline and remains a failure',async()=>{
 const lines=[line('The first post title',.6),line('The first post caption',.4)];let reads=0;
 const result=await waitForVisualChange(lines,async()=>({frame:++reads,lines}),{now:()=>reads,timeout:3});
 assert.equal(result.change.verified,false);assert.equal(reads,3);
});
