import test from 'node:test';
import assert from 'node:assert/strict';
import {detectFaceProfile} from '../web/js/avatar/face.js';
import {createFaceComposition,composeEyePixel} from '../web/js/avatar/face-composition.js';

const paint=(bytes,x,y,c)=>bytes.set(c,(y*64+x)*4);
const c=(r,g,b,a=255)=>[r,g,b,a];
function fixture(){
 const bytes=new Uint8ClampedArray(64*64*4);
 const hair=c(44,42,39),iris=c(59,118,127),pupil=c(32,94,104),skin=c(240,207,185),white=c(255,255,255);
 for(let x=24;x<28;x++){
  paint(bytes,x,2,skin);
  paint(bytes,x,3,x===24||x===27?white:iris);
  paint(bytes,x,4,x===24||x===27?white:pupil);
 }
 paint(bytes,9,12,hair);paint(bytes,10,12,iris);
 paint(bytes,13,12,iris);paint(bytes,14,12,hair);
 paint(bytes,9,13,white);paint(bytes,10,13,pupil);
 paint(bytes,13,13,pupil);paint(bytes,14,13,white);
 // Hat layer front UV is x40..47 for head pixels x8..15.
 // Opaque hair above outer eye whites covers x9 and x14.
 paint(bytes,41,12,hair);paint(bytes,42,12,c(0,0,0,0));
 paint(bytes,45,12,c(0,0,0,0));paint(bytes,46,12,hair);
 for(const x of [41,42,45,46])paint(bytes,x,13,c(0,0,0,0));
 return bytes;
}

test('outer hair transparency mask is recognized for top and lower eye rows',()=>{
 const f=detectFaceProfile(fixture());
 assert.equal(f.supported,true);
 assert.deepEqual(f.occlusion.left.top,[true,false]);
 assert.deepEqual(f.occlusion.right.top,[false,true]);
 assert.deepEqual(f.occlusion.left.bottom,[false,false]);
 assert.deepEqual(f.occlusion.right.bottom,[false,false]);
});
test('eye composition preserves upper hair while pupils move within exposed column',()=>{
 const face=createFaceComposition(detectFaceProfile(fixture()));
 assert.equal(face.supported,true);
 for(const side of ['left','right']){
  const outer=side==='left'?.5:1.5;
  for(const gx of [-1,0,1])for(const gy of [-1,0,1])
   assert.deepEqual(composeEyePixel(face,side,outer,.5,{gazeX:gx,gazeY:gy}),[44,42,39,255]);
 }
});
test('neutral and disabled gaze use source native face without extra overlays',()=>{
 const face=createFaceComposition(detectFaceProfile(fixture()));
 assert.deepEqual(composeEyePixel(face,'left',1.5,.5),[59,118,127,255]);
 assert.deepEqual(composeEyePixel(face,'right',.5,1.5),[32,94,104,255]);
 assert.deepEqual(composeEyePixel(face,'left',1.5,.5,{enabled:false,gazeX:-1,blink:1}),[59,118,127,255]);
});
test('eyes reject original iris occluded by nontransparent outer hat',()=>{
 const f=fixture();paint(f,42,12,c(44,42,39));
 assert.equal(createFaceComposition(detectFaceProfile(f)).supported,false);
});
test('gaze never alters pixels outside the recognized eye rectangle',()=>{
 const face=createFaceComposition(detectFaceProfile(fixture()));
 assert.equal(composeEyePixel(face,'left',-1,.5,{gazeX:1}),null);
 assert.equal(composeEyePixel(face,'right',1.5,2.5,{gazeY:-1}),null);
});
