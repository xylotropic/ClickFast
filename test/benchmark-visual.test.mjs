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
test('changed body content requires readable content on both sides',()=>{
 const before=[line('The first post title',.6),line('The first post caption',.4)];
 const after=[line('Another post title',.6),line('Another post caption',.4)];
 assert.equal(visibleContentChange(before,after).verified,true);
 assert.equal(visibleContentChange([],after).verified,false);
});
test('a delivered scroll can render later; verification observes without repeating input',async()=>{
 const before=[line('The first post title',.6),line('The first post caption',.4)];
 let reads=0;
 const result=await waitForVisualChange(before,async()=>({frame:++reads,lines:reads<3?before:[line('Another post title',.6),line('Another post caption',.4)]}),{now:()=>reads,timeout:5});
 assert.equal(result.change.verified,true);assert.equal(reads,3);assert.equal(result.frame,3);
});
test('unchanged content reaches its deadline and remains a failure',async()=>{
 const lines=[line('The first post title',.6),line('The first post caption',.4)];let reads=0;
 const result=await waitForVisualChange(lines,async()=>({frame:++reads,lines}),{now:()=>reads,timeout:3});
 assert.equal(result.change.verified,false);assert.equal(reads,3);
});
