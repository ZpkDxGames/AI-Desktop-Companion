import test from 'node:test';
import assert from 'node:assert/strict';
import {BehaviorController,ACTIONS} from '../web/js/avatar/animation.js';
import {LocalBehaviorPolicy,BEHAVIOR_STYLES,sanitizeBehaviorPreferences} from '../web/js/avatar/local-behavior-policy.js';

const step=(c,seconds)=>{for(let i=0;i<Math.ceil(seconds/.05);i++)c.update(.05);};
const setup=(seed=123,style='balanced')=>{
 const controller=new BehaviorController({seed});
 controller.setIdleMode('lively');
 const policy=new LocalBehaviorPolicy({seed,style});
 controller.setBehaviorPolicy(policy);
 return {controller,policy};
};

test('only bounded named personality styles and non-sensitive options persist',()=>{
 assert.deepEqual(Object.keys(BEHAVIOR_STYLES).sort(),['balanced','curious','playful','restful']);
 assert.deepEqual(sanitizeBehaviorPreferences({enabled:true,style:'curious',secret:'private',email:'x',location:'here'}),{enabled:true,style:'curious'});
 assert.deepEqual(sanitizeBehaviorPreferences({enabled:'yes',style:'unknown'}),{enabled:false,style:'balanced'});
});
test('policy shares controller clock and never owns a competing action loop',()=>{
 const {controller,policy}=setup();
 assert.strictEqual(controller.behaviorPolicy,policy);
 assert.equal(typeof policy.choose,'function');
 const original=controller.nextRandom.bind(controller);
 let calls=0;controller.nextRandom=()=>{calls++;return original();};
 step(controller,120);
 assert.ok(controller.autoStarts>1&&controller.autoStarts<9);
 assert.ok(calls<30,'policy should not consume controller RNG on every frame');
 assert.ok(policy.historyCount<=6);
 assert.ok(ACTIONS.includes(policy.lastChosen));
});
test('identical input and style produce identical timelines regardless of pose reads',()=>{
 const a=setup(782,'curious'),b=setup(782,'curious');
 for(let i=0;i<8000;i++){
  if(i===900){a.policy.noteInteraction('pointer',a.controller.time);b.policy.noteInteraction('pointer',b.controller.time);}
  a.controller.update(.05);b.controller.update(.05);
  if(i%3===0){a.controller.pose();a.controller.pose();}
  assert.equal(a.controller.action,b.controller.action);
  assert.equal(a.controller.autoStarts,b.controller.autoStarts);
  assert.equal(a.policy.mood,b.policy.mood);
 }
 assert.deepEqual(a.policy.history.slice(0,a.policy.historyCount),b.policy.history.slice(0,b.policy.historyCount));
});
test('every auto decision is valid and avoids immediate repetition',()=>{
 const {controller,policy}=setup(22,'playful');
 step(controller,900);
 assert.ok(policy.historyCount>=3);
 const recent=policy.history.slice(0,policy.historyCount);
 for(let i=1;i<recent.length;i++)assert.notEqual(recent[i],recent[i-1],'immediate repeat');
 assert.equal(policy.lastChosen,recent[recent.length-1]);
});
test('manual action, explicit seat, off and disabled settings remain authoritative',()=>{
 const {controller,policy}=setup(96);
 controller.request('sit');step(controller,100);
 assert.equal(controller.action,'sit');assert.equal(controller.autoStarts,0);
 controller.request('wave');step(controller,1);
 assert.equal(controller.action,'wave');
 controller.setIdleMode('off');step(controller,120);
 const before=controller.autoStarts;
 assert.equal(controller.action,'idle');
 assert.equal(controller.autoStarts,before);
 controller.setBehaviorPolicy(null);
 assert.equal(controller.behaviorPolicy,null);
 assert.equal(policy.lastChosen,null);
});
test('pointer attention uses only explicit in-window notification and decays without wakeups',()=>{
 const {controller,policy}=setup(49,'curious');
 assert.equal(policy.attention,0);
 policy.noteInteraction('pointer',controller.time);
 assert.equal(policy.attention,1);
 step(controller,12);
 assert.ok(policy.attention<1&&policy.attention>0);
 assert.equal(policy.pointerCount,1);
 step(controller,120);
 assert.ok(policy.attention<.1);
 assert.equal(policy.pointerCount,1);
});
test('profile changes are validated, recent action history bounded in long idle simulation',()=>{
 const {controller,policy}=setup(70);
 assert.equal(policy.setStyle('bad'),false);
 assert.equal(policy.setStyle('restful'),true);
 step(controller,1500);
 assert.equal(policy.style,'restful');
 assert.ok(policy.historyCount<=6);
 assert.ok(policy.decisions>4);
 assert.ok(policy.mood==='calm'||policy.mood==='focused'||policy.mood==='curious'||policy.mood==='playful');
});
test('null and nonfinite intervals never mutate attention, mood or selected action',()=>{
 const {controller,policy}=setup();
 policy.noteInteraction('pointer',0);
 const first=policy.attention,mood=policy.mood;
 controller.update(0);controller.update(NaN);controller.update(Infinity);
 assert.equal(policy.attention,first);assert.equal(policy.mood,mood);
 assert.equal(controller.autoStarts,0);
});
