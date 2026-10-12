import test from 'node:test';
import assert from 'node:assert/strict';
import { rigParts } from '../web/js/avatar/rig.js';
import { CAMERA, avatarRootMatrix, avatarViewProjection } from '../web/js/engine/camera.js';
import { BehaviorController, ACTIONS } from '../web/js/avatar/animation.js';
import { EXTRA_ANIMATIONS,applyExtraAnimation } from '../web/js/avatar/animation-handlers.js';
const point=(m,v)=>[0,1,2,3].map(r=>m[r]*v[0]+m[4+r]*v[1]+m[8+r]*v[2]+m[12+r]*v[3]);
test('both arm rigs rotate around the vanilla 22px shoulder hinge',()=>{
 for(const slim of [false,true])for(const part of rigParts(slim).filter(p=>p.id.toLowerCase().includes('arm')))assert.equal(part.pivot[1],22);
});
test('default camera is near-frontal, centers player and shows its entire body',()=>{
 assert.ok(Math.abs(CAMERA.eye[0]/CAMERA.eye[2])<.2);
 const vp=avatarViewProjection(1,1);
 for(const y of [0,16,32]){const p=point(vp,[0,y,0,1]);assert.ok(p.every(Number.isFinite));assert.ok(Math.abs(p[0])<.5);assert.ok(Math.abs(p[1])<.95);}
});
test('root matrix preserves ground positions with neutral pose',()=>{
 const c=new BehaviorController();const pose=c.pose();pose.rootY=0;pose.bodyZ=0;pose.rootX=0;pose.rootZ=0;
 const m=avatarRootMatrix(pose,-CAMERA.yaw);
 const heel=point(m,[0,0,0,1]);assert.ok(Math.abs(heel[0])<1e-12);assert.ok(Math.abs(heel[1])<1e-12);assert.ok(Math.abs(heel[2])<1e-12);
});
test('invalid camera inputs are rejected rather than propagated into WebGL uniforms',()=>{
 for(const [aspect,zoom] of [[0,1],[-1,1],[1,0],[NaN,1],[1,Infinity]])assert.throws(()=>avatarViewProjection(aspect,zoom));
});
test('trusted extra animations remain finite, time-bounded and independently addressable',()=>{
 for(const name of Object.keys(EXTRA_ANIMATIONS)){
  assert.ok(ACTIONS.includes(name));const c=new BehaviorController();assert.equal(c.request(name),true);
  for(let i=0;i<10;i++)c.update(.05);
  const pose=c.pose();assert.ok(Object.values(pose).every(Number.isFinite));
  for(let i=0;i<90;i++)c.update(.05);
  assert.equal(c.action,'idle',name);
 }
 assert.equal(applyExtraAnimation('untrusted',{},1),false);
});
