import test from 'node:test';import assert from 'node:assert/strict';
import {Group} from 'three';
import {AvatarEffects} from '../web/js/engine/avatar-effects.js';
import {ConversationReactionCoordinator} from '../web/js/ai/reaction-coordinator.js';
import {BehaviorController,POSE_KEYS} from '../web/js/avatar/animation.js';

test('effect pools and disposal remain exact across 100 toggles',()=>{
 const root=new Group(),effects=new AvatarEffects(root);const geometryCount=effects.geometries.length,materialCount=effects.materials.length;
 let g=0,m=0;for(const item of effects.geometries)item.addEventListener('dispose',()=>g++);for(const item of effects.materials)item.addEventListener('dispose',()=>m++);
 for(let i=0;i<100;i++)effects.update('idle',i,.3,null,null,{thinking:i%2===0,bulbAge:i%2===0?.7:Infinity});
 effects.update('idle',0,.3,null,null,{thinking:false,bulbAge:Infinity});
 assert.equal(effects.bubble.visible,false);assert.equal(effects.bulb.visible,false);
 assert.equal(effects.geometries.length,geometryCount);assert.equal(effects.materials.length,materialCount);
 effects.dispose();assert.equal(g,geometryCount);assert.equal(m,materialCount);assert.equal(root.children.length,0);
});
test('manual previews work with effects off and frequent pointer activity does not hold sleepy lids shut',()=>{
 let now=0;const c=new ConversationReactionCoordinator({clock:()=>now});
 c.configure({effects:false,sleepy:true,quietSeconds:120});c.preview('bubble');assert.equal(c.sample().thinking,true);
 now=9000;assert.equal(c.sample().thinking,false);c.preview('bulb');now+=700;assert.ok(Number.isFinite(c.sample().bulbAge));
 now=600000;assert.equal(c.sample().drowsiness,.8);
 for(let i=0;i<200;i++){c.event('activity');now+=20;c.sample();}
 assert.equal(c.sample().drowsiness,0);
});
test('60-minute fake-clock state run, 50 replies and 100 cancellations stay bounded',()=>{
 let now=0,id=0,gestures=0;const c=new ConversationReactionCoordinator({clock:()=>now,request:()=>{gestures++;return true;}});
 c.configure({effects:true,sleepy:true,gestures:true});
 for(let i=0;i<72000;i++){
  now=i*50;
  if(i%1440===0){id++;c.event('request-start',{requestId:id});c.event('answer',{requestId:id,reaction:i%2880===0?'agree':'uncertain'});}
  const state=c.sample();assert.ok(state.drowsiness>=0&&state.drowsiness<=.8);
 }
 for(let i=0;i<100;i++){c.event('request-start',{requestId:++id});c.event('cancel',{requestId:id});}
 assert.equal(c.sample().thinking,false);assert.equal(c.lastCue.size,0);assert.ok(Object.keys(c.cooldowns).length<=9);assert.ok(gestures<=50);
});
test('shake interruption conserves numerical velocities as well as position',()=>{
 for(const [from,to] of [['shake','idle'],['think','nod'],['shrug','shake'],['eat','shake']]){
  const c=new BehaviorController();c.request(from);for(let i=0;i<24;i++)c.update(1/60);
  const position={...c.pose()};c.visibleVelocity();const velocity={...c.outVel};c.request(to);c.visibleVelocity();
  for(const key of POSE_KEYS){assert.ok(Math.abs(c.pose()[key]-position[key])<1e-6,key);assert.ok(Math.abs(c.outVel[key]-velocity[key])<.01,key);}
 }
});
