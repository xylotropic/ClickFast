import test from 'node:test';
import assert from 'node:assert/strict';
import {visibleResult,visibleContentChange} from '../scripts/benchmark-visual.mjs';
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
