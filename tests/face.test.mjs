import test from 'node:test';
import assert from 'node:assert/strict';
import {detectFaceProfile} from '../web/js/avatar/face.js';
function paint(p,x,y,rgba){p.set(rgba,(y*64+x)*4);}
const skin=()=>{
 const a=new Uint8ClampedArray(64*64*4);
 const lid=[240,207,185,255],white=[255,255,255,255],iris=[59,118,127,255],dark=[32,94,104,255];
 for(let x=24;x<28;x++){paint(a,x,2,lid);paint(a,x,3,x===24||x===27?white:iris);paint(a,x,4,x===24||x===27?white:dark);}
 for(const x of [10,13]){paint(a,x,12,iris);paint(a,x,13,dark);}
 for(const x of [9,14])paint(a,x,13,white);
 return a;
};
test('detects the supplied symmetric eye-marker layout without manual coordinates',()=>{
 const info=detectFaceProfile(skin());
 assert.equal(info.supported,true);
 assert.deepEqual(info.eyes,{left:[1,4],right:[5,4]});
 assert.deepEqual(info.colors.pupil,[32,94,104,255]);
});
test('invalid, missing or ambiguous marker layouts fall back safely',()=>{
 assert.equal(detectFaceProfile(new Uint8ClampedArray(64*64*4)).supported,false);
 assert.equal(detectFaceProfile(new Uint8Array(7)).supported,false);
 const broken=skin();paint(broken,24,3,[0,0,0,0]);assert.equal(detectFaceProfile(broken).supported,false);
});
