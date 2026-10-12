import test from 'node:test';
import assert from 'node:assert/strict';
import {BehaviorController} from '../web/js/avatar/animation.js';

test('hot animation pose path reuses its owned transform buffer',()=>{
 const animator=new BehaviorController();
 const first=animator.pose();
 animator.update(1/60);
 const next=animator.pose();
 assert.strictEqual(first,next,'pose() should not allocate a new object on every animation frame');
 animator.request('wave');
 animator.update(1/60);
 assert.strictEqual(animator.pose(),first);
 assert.ok(Number.isFinite(first.armLZ));
});

test('cursor gaze updates mutate their existing coordinates rather than allocating an array',()=>{
 const animator=new BehaviorController();
 const original=animator.gaze;
 animator.setGaze(.5,-.5);
 assert.strictEqual(animator.gaze,original);
 assert.deepEqual(animator.gazeTarget,[.5,-.5]);
 assert.deepEqual(animator.gaze,[0,0]);
 animator.update(.05);
 assert.ok(animator.gaze[0]>.25&&animator.gaze[0]<.5);
 assert.ok(animator.gaze[1]<-.25&&animator.gaze[1]>-.5);
 assert.ok(animator.gazeMoving());
});

test('non-finite input deltas cannot poison the animation state',()=>{
 const animator=new BehaviorController();
 animator.update(NaN);
 animator.update(Infinity);
 assert.ok(Number.isFinite(animator.time));
 assert.ok(Number.isFinite(animator.elapsed));
});
