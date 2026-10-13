import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createVoxelFood} from '../web/js/engine/voxel-foods.js';
import {FALLBACK_ITEMS} from '../web/js/engine/item-models.js';
import {surfaceSignature,tintPixels} from './helpers/voxel-surface.mjs';
const reference=JSON.parse(readFileSync(new URL('./fixtures/voxel-food-surface-bb2727b.json',import.meta.url)));
test('food meshes preserve every original colored exterior face cell with default and imported colors',()=>{
 for(const [key,expected] of Object.entries(reference.surfaces)){
  const [id,art]=key.split('/'),model=createVoxelFood(id,art==='default'?FALLBACK_ITEMS[id]:tintPixels());
  try{const actual=surfaceSignature(id,model.geometry);assert.equal(actual.cells,expected.cells,key);assert.equal(actual.sha256,expected.sha256,key);}finally{model.dispose();}
 }
});
test('solid foods merge matching flat faces to reduce the triangle budget by at least 30 percent',()=>{
 for(const id of Object.keys(FALLBACK_ITEMS)){
  const expected=reference.surfaces[id+'/default'];if(!expected)continue;
  const model=createVoxelFood(id,FALLBACK_ITEMS[id]);
  try{assert.ok(model.geometry.attributes.position.count/3<=expected.triangles*.7,id+' retains unnecessarily split coplanar faces');assert.equal(model.group.children.length,1);}finally{model.dispose();}
 }
});
