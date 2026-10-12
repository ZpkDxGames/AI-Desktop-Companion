import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeModelMode,toSkinViewModel,fromSkinViewModel,describeModel} from '../web/js/avatar/model-policy.js';

test('model policy defaults unknown settings to auto detection',()=>{
 assert.equal(normalizeModelMode('garbage'),'auto');
 assert.equal(toSkinViewModel('auto'),'auto-detect');
});
test('manual Classic/Slim modes map to skinview3d model names',()=>{
 assert.equal(toSkinViewModel('classic'),'default');
 assert.equal(toSkinViewModel('slim'),'slim');
 assert.equal(fromSkinViewModel('default'),'classic');
 assert.equal(fromSkinViewModel('slim'),'slim');
});
test('UI status distinguishes automatic detection from manual override',()=>{
 assert.match(describeModel('auto','slim'),/Detected Slim/);
 assert.match(describeModel('classic','default'),/manual/);
});
