import test from 'node:test';
import assert from 'node:assert/strict';
import {createFaceComposition,composeEyePixel} from '../web/js/avatar/face-composition.js';
test('unsupported profiles always use vanilla face',()=>{
 assert.equal(createFaceComposition({supported:false}).supported,false);
 assert.equal(createFaceComposition(null).supported,false);
});
test('invalid eye cells, alpha and occlusion fail closed',()=>{
 const colors={lid:[10,10,10,255],white:[250,250,250,255],iris:[20,40,50,255],pupil:[10,20,40,255]};
 const background={top:[44,42,39,255],bottom:[250,250,250,255]};
 const original={supported:true,eyes:{left:[1,4],right:[5,4]},background:{left:background,right:background},
  colors,occlusion:{left:{top:[true,false],bottom:[false,false]},right:{top:[false,true],bottom:[false,false]}}};
 assert.equal(createFaceComposition(original).supported,true);
 assert.equal(createFaceComposition({...original,eyes:{...original.eyes,left:[-1,4]}}).supported,false);
 assert.equal(createFaceComposition({...original,occlusion:{...original.occlusion,left:{top:[true,true],bottom:[false,false]}}}).supported,false);
});
test('pixel motion bounds and gaze clamping are finite',()=>{
 const c={supported:true,eyes:{left:{neutralX:1.5,background:{top:[44,42,39,255],bottom:[255,255,255,255]},iris:[59,118,127,255],pupil:[32,94,104,255]}} ,
 colors:{white:[255,255,255,255],lid:[240,207,185,255]}};
 assert.deepEqual(composeEyePixel(c,'left',1.5,.5,{gazeX:NaN,gazeY:Infinity}),[59,118,127,255]);
 assert.deepEqual(composeEyePixel(c,'left',.5,.5,{gazeX:-99,gazeY:99}),[44,42,39,255]);
});
