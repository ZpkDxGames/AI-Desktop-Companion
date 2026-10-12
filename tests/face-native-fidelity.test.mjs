import test from 'node:test';
import assert from 'node:assert/strict';
import {detectFaceProfile} from '../web/js/avatar/face.js';
import {createFaceComposition,composeEyePixel} from '../web/js/avatar/face-composition.js';

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


test('native dark hair and white background remain original colors under eye motion',()=>{
 const profile=detectFaceProfile(nativeEyeFixture());
 const rig=createFaceComposition(profile);
 assert.equal(rig.supported,true);
 assert.deepEqual(rig.eyes.left.background.top,[42,37,33,255]);
 assert.deepEqual(rig.eyes.right.background.top,[42,37,33,255]);
 for(const side of ['left','right']){
  const outer=side==='left'?.5:1.5,inner=side==='left'?1.5:.5;
  assert.deepEqual(composeEyePixel(rig,side,outer,.5,{gazeX:-1,gazeY:1}),[42,37,33,255]);
  assert.deepEqual(composeEyePixel(rig,side,outer,1.5,{gazeX:1}),[255,255,255,255]);
  assert.deepEqual(composeEyePixel(rig,side,inner,.5),[59,118,127,255]);
  assert.deepEqual(composeEyePixel(rig,side,inner,1.5),[32,94,104,255]);
 }
});
test('disabled mode preserves original pixel even with active cursor/blink',()=>{
 const rig=createFaceComposition(detectFaceProfile(nativeEyeFixture()));
 assert.deepEqual(composeEyePixel(rig,'left',1.5,.5,{enabled:false,gazeX:1,gazeY:1,blink:1}),[59,118,127,255]);
});
test('blink masks recognized iris then pupil without affecting top outer hair',()=>{
 const rig=createFaceComposition(detectFaceProfile(nativeEyeFixture()));
 assert.deepEqual(composeEyePixel(rig,'left',1.5,.5,{blink:.5}),[240,207,185,255]);
 assert.deepEqual(composeEyePixel(rig,'left',1.5,1.5,{blink:1}),[240,207,185,255]);
 assert.deepEqual(composeEyePixel(rig,'left',.5,.5,{blink:1}),[42,37,33,255]);
});
test('unsupported background or invalid marker cannot animate the face',()=>{
 assert.equal(createFaceComposition({supported:false}).supported,false);
 assert.equal(createFaceComposition({supported:true,eyes:{left:[1,4],right:[5,4]},colors:{}}).supported,false);
});
