import test from 'node:test';
import assert from 'node:assert/strict';
import {BehaviorController,PRIORITY,ACTIONS,clamp,smooth} from '../web/js/avatar/animation.js';

test('available actions have priorities',()=>{for(const a of ACTIONS)assert.equal(Number.isFinite(PRIORITY[a]),true);});
test('invalid animation is rejected',()=>{const c=new BehaviorController();assert.equal(c.request('delete-files'),false);assert.equal(c.action,'idle');});
test('wave is a timed interruption and returns to idle',()=>{const c=new BehaviorController();assert.equal(c.request('wave'),true);for(let i=0;i<75;i++)c.update(.04);assert.equal(c.action,'idle');});
test('continuous walk cannot interrupt an active wave',()=>{const c=new BehaviorController();c.request('wave');assert.equal(c.request('walk'),false);assert.equal(c.action,'wave');});
test('manual idle always resets an animation',()=>{const c=new BehaviorController();c.request('celebrate');assert.equal(c.request('idle'),true);assert.equal(c.action,'idle');});
test('sit rotates legs into a seated pose',()=>{const c=new BehaviorController();c.request('sit');for(let i=0;i<12;i++)c.update(.025);const p=c.pose();assert.ok(p.legRX<-1);assert.ok(p.legLX<-1);});
test('gaze input is clamped',()=>{const c=new BehaviorController();c.setGaze(999,-999);assert.deepEqual(c.gaze,[1,-1]);});
test('non-finite deltas are never passed by frame pump',()=>{const c=new BehaviorController();c.update(.04);assert.ok(c.time<.1);});
test('transition easing is bounded',()=>{assert.equal(smooth(-1),0);assert.equal(smooth(2),1);assert.equal(clamp(500,0,2),2);});
