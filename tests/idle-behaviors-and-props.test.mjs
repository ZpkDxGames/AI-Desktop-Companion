import test from 'node:test';
import assert from 'node:assert/strict';
import {BehaviorController,ACTIONS,DURATION} from '../web/js/avatar/animation.js';
import {AvatarProps} from '../web/js/engine/avatar-props.js';
import {Group} from 'three';

const advance=(c,seconds)=>{
 for(let n=0;n<Math.ceil(seconds/.05);n++){c.update(.05);c.pose();}
};
test('new activity actions are registered and all props use bounded durations',()=>{
 for(const a of ['look','read','eat','drink','inspect']){
  assert.ok(ACTIONS.includes(a),a);
  assert.ok(DURATION[a]>2 && DURATION[a]<12,a);
 }
});
test('calm auto-idle is bounded and deterministic with a fixed seed',()=>{
 const a=new BehaviorController({seed:42}),b=new BehaviorController({seed:42});
 a.setIdleMode('calm');b.setIdleMode('calm');
 assert.ok(a.idleCountdown>=30&&a.idleCountdown<=70);
 for(let n=0;n<1600;n++){a.update(.05);b.update(.05);assert.equal(a.action,b.action);assert.equal(a.source,b.source);}
 assert.ok(a.autoStarts>0,'idle activity never started');
 assert.ok(a.autoStarts<3,'idle spammed too often');
});
test('auto idle never overrides explicit sit, walk or manual gestures',()=>{
 const c=new BehaviorController({seed:7});
 c.setIdleMode('lively');c.request('sit');advance(c,120);
 assert.equal(c.action,'sit');assert.equal(c.autoStarts,0);
 assert.equal(c.request('idle'),true);
 advance(c,35);
 assert.ok(c.autoStarts>0);
 c.request('wave');
 assert.equal(c.action,'wave');
 assert.equal(c.source,'manual');
 const beforeStop=c.autoStarts;
 c.setIdleMode('off');advance(c,90);
 assert.equal(c.autoStarts,beforeStop);
 assert.equal(c.action,'idle');
});
test('manual idle interrupts auto reading and clears its prop without breaking gaze or blink',()=>{
 const c=new BehaviorController({seed:3});
 c.setIdleMode('lively');
 for(let i=0;i<1200 && c.autoStarts===0;i++)c.update(.05);
 assert.ok(c.autoStarts>0);
 c.setGaze(.8,-.4);c.triggerBlink();
 assert.equal(c.request('idle'),true);
 assert.equal(c.action,'idle');assert.equal(c.source,'manual');
 c.update(.04);
 assert.ok(c.gaze[0]>0&&c.blink>0);
});
test('rate changes and nonfinite delta cannot create an idle action immediately',()=>{
 const c=new BehaviorController({seed:19});
 assert.equal(c.setIdleMode('invalid'),false);
 assert.equal(c.setIdleMode('calm'),true);
 c.update(NaN);c.update(Infinity);
 assert.ok(Number.isFinite(c.idleCountdown));
 assert.equal(c.autoStarts,0);
 c.setIdleMode('off');
 assert.equal(c.idleCountdown,Infinity);
});
test('props mount once to canonical skin parts, change visibility, and release owned resources',()=>{
 const skin={body:new Group(),rightArm:new Group(),leftArm:new Group()};
 const props=new AvatarProps(skin);
 assert.equal(skin.body.children.length,1);
 assert.equal(skin.rightArm.children.length,2);
 assert.strictEqual(props.food.parent,skin.rightArm);
 assert.strictEqual(props.drink.parent,skin.rightArm);
 const groups=[...skin.body.children,...skin.rightArm.children,...skin.leftArm.children];
 props.update('read',2,.05);
 assert.equal(props.book.visible,true);
 props.update('eat',1,.05);
 assert.equal(props.food.visible,true);
 props.update('idle',0,1);
 assert.equal(props.book.visible,false);
 assert.equal(props.food.visible,false);
 const geo=props.book.children.find(child=>child.geometry)?.geometry;
 props.dispose();
 assert.ok(groups.every(group=>!group.parent));
 assert.equal(geo?.getAttribute('position').count>0,true);
});

test('reading hands converge toward book; eating and drinking use inward arm roll',()=>{
 const read=new BehaviorController();read.request('read');advance(read,.6);
 assert.ok(read.pose().armRZ>.1,'right arm must turn inward while reading');
 assert.ok(read.pose().armLZ<-.1,'left arm must turn inward while reading');
 const eat=new BehaviorController();eat.request('eat');advance(eat,.6);
 assert.ok(eat.pose().armRZ>0,'eating right arm should turn inward');
 const drink=new BehaviorController();drink.request('drink');advance(drink,.6);
 assert.ok(drink.pose().armRZ>0,'drinking right arm should turn inward');
});
