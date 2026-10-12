import test from 'node:test';
import assert from 'node:assert/strict';
import {detectFaceProfile} from '../web/js/avatar/face.js';
import {deriveFaceRig,pupilOffset,eyeActivity,eyeCenter} from '../web/js/avatar/face-rig-layout.js';

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
test('face profile tracks opaque second-layer hair for each upper/lower eye column',()=>{
 const f=detectFaceProfile(fixture());
 assert.equal(f.supported,true);
 assert.deepEqual(f.occlusion.left.top,[true,false]);
 assert.deepEqual(f.occlusion.right.top,[false,true]);
 assert.deepEqual(f.occlusion.left.bottom,[false,false]);
 assert.deepEqual(f.occlusion.right.bottom,[false,false]);
});
test('occlusion-aware gaze never detaches upper iris from lower pupil beneath hair',()=>{
 const rig=deriveFaceRig(detectFaceProfile(fixture()));
 assert.equal(rig.supported,true);
 const left=pupilOffset('left',0,rig.left);
 const right=pupilOffset('right',0,rig.right);
 assert.equal(left,.5);assert.equal(right,-.5);
 for(const gaze of [-1,-.8,0,.8,1]){
  assert.equal(pupilOffset('left',gaze,rig.left),left);
  assert.equal(pupilOffset('right',gaze,rig.right),right);
 }
});
test('neutral facial overlay is inactive so original face and hair are never repainted',()=>{
 const rig=deriveFaceRig(detectFaceProfile(fixture()));
 assert.equal(eyeActivity(0,0,rig),false);
 assert.equal(eyeActivity(1,0,rig),false);
 assert.equal(eyeActivity(-1,0,rig),false);
 assert.equal(eyeActivity(0,.5,rig),true);
 assert.equal(eyeActivity(0,1,rig),true);
});
test('eye layers are far enough in front of inner head to avoid z-fighting yet behind outer hair',()=>{
 for(const eye of [[1,4],[5,4]]){
  const z=eyeCenter(eye).z;
  assert.ok(z>=4.12 && z<4.3,`bad eye base depth ${z}`);
  assert.ok(z+.12<4.5);
 }
});
test('unblocked eye fixture retains sideways movement on both rows',()=>{
 const f=fixture(); paint(f,41,12,c(0,0,0,0));paint(f,46,12,c(0,0,0,0));
 const rig=deriveFaceRig(detectFaceProfile(f));
 assert.equal(pupilOffset('left',-1,rig.left),-.5);
 assert.equal(pupilOffset('right',1,rig.right),.5);
 assert.equal(eyeActivity(-1,0,rig),true);
});
