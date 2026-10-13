import test from 'node:test';
import assert from 'node:assert/strict';
import {SkinObject} from 'skinview3d';
import {Vector3,Matrix4,Quaternion} from 'three';
import {BehaviorController,ACTIONS,POSE_KEYS} from '../web/js/avatar/animation.js';
import {AvatarRig} from '../web/js/engine/avatar-rig.js';
import {AvatarProps} from '../web/js/engine/avatar-props.js';
import {FALLBACK_ITEMS} from '../web/js/engine/item-models.js';
const tick=(c,seconds,hz=60)=>{for(let t=0;t<seconds-1e-9;t+=1/hz)c.update(Math.min(1/hz,seconds-t));};
const snap=c=>({...c.pose()});

test('closed-form residual decay is identical under different dt partitions',()=>{
 const a=new BehaviorController(),b=new BehaviorController();
 for(const key of POSE_KEYS){a.offset[key]=b.offset[key]=.7;a.offsetVel[key]=b.offsetVel[key]=-2;}
 a.stepOffsets(1/30);b.stepOffsets(1/60);b.stepOffsets(1/60);
 for(const key of POSE_KEYS){assert.ok(Math.abs(a.offset[key]-b.offset[key])<1e-12);assert.ok(Math.abs(a.offsetVel[key]-b.offsetVel[key])<1e-12);}
});
test('pose sampling is idempotent and cannot advance activity, RNG, events or presentation',()=>{
 for(const action of ACTIONS){
  const c=new BehaviorController({seed:12});c.request(action);tick(c,.43);
  const snapshot=JSON.stringify([c.time,c.elapsed,c.activity,c.presentation,c.rngState,c.microState,c.blinkState,c.eventSerial,c.sitAmount]);
  const before=snap(c),buffer=c.pose();
  for(let i=0;i<100;i++){assert.strictEqual(c.pose(),buffer);assert.deepEqual(c.pose(),before);}
  assert.equal(JSON.stringify([c.time,c.elapsed,c.activity,c.presentation,c.rngState,c.microState,c.blinkState,c.eventSerial,c.sitAmount]),snapshot);
 }
});
test('zero and invalid dt leave all authoritative state untouched; long stalls are bounded',()=>{
 const a=new BehaviorController(),b=new BehaviorController();a.request('drink');b.request('drink');tick(a,1.3);tick(b,1.3);
 const before=JSON.stringify(a);
 for(const dt of [0,-1,NaN,Infinity,-Infinity])a.update(dt);
 assert.equal(JSON.stringify(a),before);
 a.update(5);b.update(.05);assert.deepEqual(snap(a),snap(b));assert.equal(a.time,b.time);
});
test('all action poses and transition decay agree at 30/60/120/144Hz and irregular cadence',()=>{
 for(const action of ACTIONS){
  const reference=new BehaviorController({seed:13});reference.request(action);tick(reference,.8,120);const expected=snap(reference);
  for(const hz of [30,60,144]){
   const c=new BehaviorController({seed:13});c.request(action);tick(c,.8,hz);
   for(const key of POSE_KEYS)assert.ok(Math.abs(c.pose()[key]-expected[key])<2e-5,`${action}/${hz}/${key}`);
  }
  const c=new BehaviorController({seed:13});c.request(action);let remaining=.8,i=0;
  while(remaining>1e-9){const dt=Math.min(remaining,[.01,.037,.023,.049][i++%4]);c.update(dt);remaining-=dt;}
  for(const key of POSE_KEYS)assert.ok(Math.abs(c.pose()[key]-expected[key])<2e-5,`${action}/irregular/${key}`);
 }
});
test('cosmetic clocks remain refresh-independent and never consume decision RNG',()=>{
 const a=new BehaviorController({seed:77}),b=new BehaviorController({seed:77});tick(a,90,30);tick(b,90,144);
 assert.equal(a.rngState,b.rngState);assert.equal(a.microState,b.microState);assert.equal(a.blinkState,b.blinkState);
 for(let i=0;i<2;i++)assert.ok(Math.abs(a.eyeGaze[i]-b.eyeGaze[i])<1e-7);
 assert.ok(Math.abs(a.blink-b.blink)<1e-7);assert.equal(a.gazeMoving(),false);
});
test('all accepted action pairs preserve position and measured incoming velocity, including seat reversals',()=>{
 for(const from of ACTIONS)for(const to of ACTIONS){
  const a=new BehaviorController({seed:42}),control=new BehaviorController({seed:42});
  a.request(from);control.request(from);tick(a,.43);tick(control,.43);
  const before=snap(a);control.update(1e-6);const forward=snap(control);
  if(!a.request(to))continue;
  for(const key of POSE_KEYS)assert.ok(Math.abs(a.pose()[key]-before[key])<1e-6,`${from}->${to}/${key} position`);
  a.update(1e-6);const after=snap(a);
  for(const key of POSE_KEYS)assert.ok(Math.abs((after[key]-forward[key])/1e-6)<.12,`${from}->${to}/${key} velocity`);
 }
 const c=new BehaviorController();c.request('sit');tick(c,.2);c.request('idle');tick(c,.1);const before=snap(c);c.request('sit');
 for(const key of POSE_KEYS)assert.ok(Math.abs(before[key]-c.pose()[key])<1e-6,`seat reversal/${key}`);
});
test('props retain a continuous controller-owned recovery during interruption and self-retrigger',()=>{
 for(const action of ['read','eat','drink'])for(const next of ['idle','wave','eat','drink',action]){
  const c=new BehaviorController();c.request(action);tick(c,action==='read'?5.05:1.45);const before={...c.presentation};
  c.request(next);assert.equal(c.presentation.action,before.action);assert.equal(c.presentation.visibility,before.visibility);
  assert.equal(c.presentation.pageAngle,before.pageAngle);
  tick(c,.16);assert.ok(c.presentation.visibility<before.visibility);assert.ok(c.presentation.exit>0);
  tick(c,.40);assert.equal(c.presentation.action,next);assert.equal(c.presentation.exit,0);
 }
});
test('reduced motion suppresses cosmetic life and fireworks intent without losing actions or pointer gaze',()=>{
 const a=new BehaviorController({seed:17}),b=new BehaviorController({seed:17});a.setReducedMotion(true);tick(a,3);tick(b,3);
 assert.equal(a.pose().breath,0);assert.ok(Math.abs(a.pose().rootX)<1e-8);
 a.setGaze(.8,-.4);tick(a,1);assert.ok(a.eyeGaze[0]>.79);
 a.request('jump');b.request('jump');tick(a,.5);tick(b,.5);assert.ok(a.pose().rootY<b.pose().rootY*.35);
 a.setReducedMotion(false);assert.ok(a.nextSaccade>a.time);
});
test('original geometry/UVs and upper-body attachments survive all poses, model changes and resets',()=>{
 const skin=new SkinObject(),rig=new AvatarRig();
 const geometry=skin.head.innerLayer.geometry,positions=geometry.getAttribute('position').array.slice(),uv=geometry.getAttribute('uv').array.slice();
 for(const mode of ['default','slim','default']){
  skin.modelType=mode;
  for(const action of ACTIONS){
   const c=new BehaviorController();c.request(action);tick(c,.6);rig.apply(skin,c.pose());
   const relative=new Vector3().copy(skin.head.position).sub(skin.body.position).applyQuaternion(rig.chest.clone().invert());
   assert.ok(relative.distanceTo(new Vector3(0,6,0))<1e-8,action+' neck detached');
   assert.deepEqual(skin.body.scale.toArray(),[1,1,1]);
  }
 }
 rig.apply(skin,{});assert.deepEqual(skin.head.position.toArray(),[0,0,0]);assert.deepEqual(skin.body.position.toArray(),[0,-6,0]);
 assert.strictEqual(skin.head.innerLayer.geometry,geometry);assert.deepEqual(geometry.getAttribute('position').array,positions);assert.deepEqual(geometry.getAttribute('uv').array,uv);
});
test('reading cover corners stay within palm support reach in Classic and Slim',()=>{
 for(const mode of ['default','slim']){
  const skin=new SkinObject();skin.modelType=mode;const rig=new AvatarRig(),props=new AvatarProps(skin),c=new BehaviorController();
  c.request('read');tick(c,2);rig.apply(skin,c.pose());props.update('read',c.elapsed,1/60,c.presentation);skin.updateMatrixWorld(true);
  for(const side of [-1,1]){
   const arm=side<0?skin.rightArm:skin.leftArm;
   const palm=new Vector3(side*(mode==='slim'?.5:1),-9.3,0).applyMatrix4(arm.matrixWorld);
   const corner=new Vector3(side*3.4,-2.1,0).applyMatrix4(props.book.matrixWorld);
   assert.ok(palm.distanceTo(corner)<2.05,mode+' book unsupported');
  }
  props.dispose();
 }
});
test('opaque food and bottle pixels avoid the original head and outer mask at mouth contact',()=>{
 for(const mode of ['default','slim'])for(const id of Object.keys(FALLBACK_ITEMS)){
  const skin=new SkinObject();skin.modelType=mode;const props=new AvatarProps(skin),rig=new AvatarRig(),c=new BehaviorController();
  const action=id==='water_potion'?'drink':'eat';c.request(action);tick(c,1.45);c.foodVariant=id;c.updatePresentation();
  rig.apply(skin,c.pose());props.update(action,c.elapsed,1/60,c.presentation,id);skin.updateMatrixWorld(true);
  const inverse=new Matrix4().copy(skin.head.matrixWorld).invert(),matrix=props.itemModels.get(id).group.matrixWorld,pixels=FALLBACK_ITEMS[id];
  for(let y=0;y<16;y++)for(let x=0;x<16;x++)if(pixels[(y*16+x)*4+3]>=128){
   const v=new Vector3((x+.5-8)*5.35/16,(8-y-.5)*5.35/16,0).applyMatrix4(matrix).applyMatrix4(inverse);
   const inside=Math.abs(v.x)<4.5&&v.y>-.5&&v.y<8.5&&Math.abs(v.z)<4.5;
   assert.equal(inside,false,`${mode}/${id}/${x},${y} facial clipping`);
  }
  props.dispose();
 }
});

test('the bottle neck keeps its intended pouring axis through shoulder yaw and roll',()=>{
 const skin=new SkinObject(),props=new AvatarProps(skin);
 for(const [x,y,z] of [[-2,.0,.4],[-1.4,.2,-.25],[-2.1,-.18,.32]]){
  skin.rightArm.rotation.set(x,y,z);props.update('drink',1.9,1/60);
  const world=new Quaternion().multiplyQuaternions(skin.rightArm.quaternion,props.drink.quaternion);
  const neck=new Vector3(0,1,0).applyQuaternion(world);
  assert.ok(neck.z<-.85&&neck.y<-.20&&Math.abs(neck.x)<.15,'bottle rotation used the wrong local axis');
 }
 props.dispose();
});
