import test from 'node:test';
import assert from 'node:assert/strict';
import {eyeCenter,pupilOffset,eyelidPose,deriveFaceRig} from '../web/js/avatar/face-rig-layout.js';

test('2x2 face cells map into the canonical 8x8 head front plane',()=>{
 assert.deepEqual(eyeCenter([1,4]),{x:-2,y:3,z:4.18});
 assert.deepEqual(eyeCenter([5,4]),{x:2,y:3,z:4.18});
});
test('pupil travel is bounded inside the 2x2 eye and keeps inward neutral gaze',()=>{
 assert.ok(pupilOffset('left',0)>0);
 assert.ok(pupilOffset('right',0)<0);
 assert.equal(pupilOffset('left',-99),-.5);
 assert.equal(pupilOffset('right',99),.5);
});
test('eyelid coverage descends smoothly from the top and eventually hides pupils',()=>{
 assert.equal(eyelidPose(0).visible,false);
 assert.equal(eyelidPose(.5).centerY,.5);
 assert.equal(eyelidPose(1).centerY,0);
 assert.equal(eyelidPose(1).pupilVisible,false);
});
test('unsupported skin profile produces no facial rig',()=>assert.deepEqual(deriveFaceRig({supported:false}),{supported:false}));
