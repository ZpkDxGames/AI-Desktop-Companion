import test from 'node:test';
import assert from 'node:assert/strict';
import {FramePacer} from '../web/js/runtime/frame-pacing.js';
import {BehaviorController} from '../web/js/avatar/animation.js';

test('60 FPS active cap on high-refresh 120 Hz screens',()=>{
 const pacer=new FramePacer();
 let frames=0;
 for(let i=0;i<=240;i++)if(pacer.ready(i*1000/120,true))frames++;
 assert.ok(frames>=59&&frames<=62,`active 120 Hz gate drew ${frames} frames, expected ~60`);
});

test('idle redraw cadence is reduced and renderer can reset cleanly after being hidden',()=>{
 const pacer=new FramePacer();
 let frames=0;
 for(let i=0;i<=240;i++)if(pacer.ready(i*1000/120,false))frames++;
 assert.ok(frames>=19&&frames<=22,`idle gate drew ${frames} frames`);
 pacer.reset();
 assert.equal(pacer.ready(5000,true),true);
});

test('frame limiter bounds missed deadlines without burst catchup',()=>{
 const pacer=new FramePacer();
 assert.equal(pacer.ready(0,true),true);
 assert.equal(pacer.ready(1,true),false);
 assert.equal(pacer.ready(2000,true),true);
 assert.equal(pacer.ready(2000.1,true),false);
});

test('blink closes, holds and opens rather than starting instantly closed',()=>{
 const animator=new BehaviorController();
 animator.triggerBlink();
 assert.ok(animator.blink<=.01);
 animator.update(.04);
 assert.ok(animator.blink>.2&&animator.blink<1);
 animator.update(.05);
 assert.ok(animator.blink>.85);
 animator.update(.18);
 assert.equal(animator.blink,0);
});

test('animation transitions start at previous visible pose and do not snap to neutral',()=>{
 const animator=new BehaviorController();
 animator.request('sit');
 for(let i=0;i<12;i++){animator.update(.02);animator.pose();}
 const before={...animator.pose()};
 animator.request('wave');
 const after=animator.pose();
 for(const key of ['legRX','legLX','armRX','armLX','rootY','headY']){
  assert.ok(Math.abs(before[key]-after[key])<.00001,`${key} snapped on interruption`);
 }
});
