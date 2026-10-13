import test from 'node:test';
import assert from 'node:assert/strict';
import {BehaviorController,DURATION} from '../web/js/avatar/animation.js';
import {sampleTimeline} from '../web/js/avatar/activity-timelines.js';
import {AvatarProps} from '../web/js/engine/avatar-props.js';
import {AvatarEffects} from '../web/js/engine/avatar-effects.js';
import {Group} from 'three';

const step=(controller,seconds)=>{for(let t=0;t<seconds-.0001;t+=.05)controller.update(.05);};
test('phase sampling is deterministic and reuses provided buffer even for nonfinite time',()=>{
 const out={};
 for(const id of ['read','eat','drink','look','think','inspect','celebrate']){
  const total=DURATION[id];
  let lastIndex=-1;
  for(let i=0;i<Math.floor(total/.05);i++){
   const state=sampleTimeline(id,i*.05,out);
   assert.strictEqual(state,out);
   assert.ok(state.phaseIndex>=lastIndex);
   assert.ok(state.phaseProgress>=0&&state.phaseProgress<=1);
   lastIndex=state.phaseIndex;
  }
 }
 assert.equal(sampleTimeline('read',NaN,out).phase,'enter');
});
test('every seated interrupted transition reaches the queued request safely',()=>{
 for(const action of ['idle','wave','read','jump','look','eat','drink','inspect']){
  const c=new BehaviorController({seed:42});
  c.request('sit');step(c,.9);
  const previous=c.pose().rootY;
  assert.ok(previous<-4,action);
  assert.equal(c.request(action),true);
  step(c,.8);
  assert.equal(c.action,action);
  assert.equal(c.sitPhase,'standing');
  assert.equal(c.sitAmount,0);
 }
});
test('sitting interruption every 100ms never abandons latest intent',()=>{
 for(let t=0;t<=.8;t+=.1){
  const c=new BehaviorController();
  c.request('sit');step(c,t);
  c.request('wave');step(c,.8);
  assert.equal(c.action,'wave');
 }
});
test('one-shot event counters cannot repeat on zero frames or repeated pose()',()=>{
 const c=new BehaviorController();
 c.request('celebrate');step(c,.5);
 const serial=c.eventSerial;
 assert.equal(serial,1);
 for(let i=0;i<100;i++){c.pose();c.update(0);}
 assert.equal(c.eventSerial,serial);
 step(c,.8);assert.equal(c.eventSerial,serial+1);
});
test('reused renderer-owned geometries remain bounded across many activities',()=>{
 const skin={body:new Group(),rightArm:new Group(),leftArm:new Group()};
 const props=new AvatarProps(skin);const root=new Group();
 const effects=new AvatarEffects(root);
 const geos=props.geometries.size,mats=props.materials.size,pool=effects.particles;
 const buffer={};
 for(let i=0;i<100;i++){
  const act=i%3===0?'read':i%3===1?'eat':'drink';
  for(let n=0;n<100;n++){
   const elapsed=n*.05;
   const state=sampleTimeline(act,elapsed,buffer);
   props.update(act,elapsed,.05,state,'cooked_porkchop');
   effects.update(i%2?'celebrate':'think',elapsed,.05);
  }
 }
 assert.equal(props.geometries.size,geos);
 assert.equal(props.materials.size,mats);
 assert.strictEqual(effects.particles,pool);
 assert.ok(effects.lastCount<=effects.capacity);
 props.dispose();effects.dispose();assert.equal(root.children.length,0);
});

test('manual celebrate-to-look is a safe preemption; passive locomotion cannot steal a gesture',()=>{
 const c=new BehaviorController();
 c.request('celebrate');step(c,.65);
 assert.equal(c.request('walk'),false);
 assert.equal(c.request('look'),true);
 assert.equal(c.action,'look');
 assert.equal(c.eventMask,0);
 assert.ok(Math.abs(c.pose().rootX)<.5);
});
