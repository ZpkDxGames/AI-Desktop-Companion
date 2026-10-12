import test from 'node:test';
import assert from 'node:assert/strict';
import {detectFaceProfile} from '../web/js/avatar/face.js';
import {deriveFaceRig,pupilOffset,eyelidPose} from '../web/js/avatar/face-rig-layout.js';

const rgba=(r,g,b)=>[r,g,b,255];
function paint(bytes,x,y,color){bytes.set(color,(y*64+x)*4);}
function nativeEyeFixture(){
 const bytes=new Uint8ClampedArray(64*64*4);
 const dark=rgba(42,37,33),white=rgba(255,255,255),
       lid=rgba(240,207,185),iris=rgba(59,118,127),pupil=rgba(32,94,104);
 for(let x=24;x<28;x++){paint(bytes,x,2,lid);paint(bytes,x,3,x===24||x===27?white:iris);paint(bytes,x,4,x===24||x===27?white:pupil);}
 paint(bytes,9,12,dark);paint(bytes,10,12,iris);
 paint(bytes,13,12,iris);paint(bytes,14,12,dark);
 paint(bytes,9,13,white);paint(bytes,10,13,pupil);
 paint(bytes,13,13,pupil);paint(bytes,14,13,white);
 return bytes;
}

test('eye base patches retain authentic dark hair ABOVE eyes, not invented white sclera',()=>{
 const face=detectFaceProfile(nativeEyeFixture());
 assert.equal(face.supported,true);
 const rig=deriveFaceRig(face);
 assert.deepEqual(rig.left.background.top,[42,37,33,255]);
 assert.deepEqual(rig.right.background.top,[42,37,33,255]);
 assert.deepEqual(rig.left.background.bottom,[255,255,255,255]);
 assert.deepEqual(rig.right.background.bottom,[255,255,255,255]);
});

test('neutral pupils exactly reproduce the original skin pixel columns, gaze snaps to whole pixels',()=>{
 assert.equal(pupilOffset('left',0),.5);
 assert.equal(pupilOffset('right',0),-.5);
 for(const direction of [-1,-.7,-.1,0,.1,.7,1]){
  for(const side of ['left','right'])assert.ok([-.5,.5].includes(pupilOffset(side,direction)));
 }
 assert.equal(pupilOffset('left',-1),-.5);
 assert.equal(pupilOffset('right',1),.5);
});

test('two-pixel eyelids cover 0,1,2 integer rows without fractional blur',()=>{
 assert.equal(eyelidPose(0).rows,0);
 assert.equal(eyelidPose(.45).rows,1);
 assert.equal(eyelidPose(1).rows,2);
 assert.equal(eyelidPose(.45).centerY,.5);
 assert.equal(eyelidPose(1).centerY,0);
 assert.equal(eyelidPose(1).pupilVisible,false);
 assert.equal(eyelidPose(.45).irisVisible,false);
});

test('facial state can be updated without creating per-frame eyelid objects',()=>{
 const state={};
 assert.strictEqual(eyelidPose(.5,state),state);
 assert.strictEqual(eyelidPose(1,state),state);
 assert.equal(state.rows,2);
});

test('unsupported or missing per-eye background cannot replace the original face',()=>{
 assert.equal(deriveFaceRig({supported:true,eyes:{left:[1,4],right:[5,4]},colors:{}}).supported,false);
});
