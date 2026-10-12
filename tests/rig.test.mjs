import test from 'node:test';
import assert from 'node:assert/strict';
import {rigParts,cuboidTriangles} from '../web/js/avatar/rig.js';
import {validateSkinDimensions,isPngSignature} from '../web/js/avatar/skin.js';
import {validateEyes,gazeOffset,DEFAULT_EYES} from '../web/js/avatar/eyes.js';
import {identity,multiply,translation,scale,chain} from '../web/js/engine/mat4.js';

test('rig contains six base and six outer body parts',()=>{const p=rigParts();assert.equal(p.length,12);assert.equal(p.filter(p=>p.layer).length,6);});
test('classic and slim arm widths preserve correct model dimensions',()=>{assert.equal(rigParts(false).find(p=>p.id==='rightArm').size[0],4);assert.equal(rigParts(true).find(p=>p.id==='rightArm').size[0],3);});
test('head front has exact canonical Java Edition UV',()=>{const head=rigParts().find(p=>p.id==='head');assert.deepEqual(head.uv,[0,0,8,8,8]);});
test('each box has exactly 12 triangles and pixel-bounded texture UVs',()=>{for(const p of rigParts()){const v=cuboidTriangles(p);assert.equal(v.length,36*8);for(let i=0;i<v.length;i+=8){assert.ok(v[i+3]>=0&&v[i+3]<=1);assert.ok(v[i+4]>=0&&v[i+4]<=1);}}});
test('skin validator rejects legacy and oversized images',()=>{assert.equal(validateSkinDimensions(64,64),true);assert.equal(validateSkinDimensions(64,32),false);assert.equal(validateSkinDimensions(256,256),false);});
test('per-skin eyes require valid coordinates',()=>{assert.equal(validateEyes(DEFAULT_EYES),true);assert.equal(validateEyes({...DEFAULT_EYES,right:[12,-3]}),false);});
test('pixel eye offset clamps to one-pixel movement',()=>{assert.equal(gazeOffset(12),1);assert.equal(gazeOffset(-6),-1);assert.equal(gazeOffset(.2),0);});
test('matrix composition multiplies in column-major order',()=>{assert.deepEqual(multiply(identity(),translation(2,3,4)),translation(2,3,4));const m=chain(translation(5,0,0),scale(2,2,2));assert.equal(m[12],5);assert.equal(m[0],2);});

test('PNG signature checked before image decode',()=>{assert.equal(isPngSignature(Uint8Array.from([137,80,78,71,13,10,26,10])),true);assert.equal(isPngSignature(Uint8Array.from([0,1,2])),false);});
