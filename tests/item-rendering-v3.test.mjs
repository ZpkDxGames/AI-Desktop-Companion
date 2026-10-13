import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,NearestFilter} from 'three';
import {FALLBACK_ITEMS,resolveItemId,validateSpritePixels,createExtrudedItem} from '../web/js/engine/item-models.js';
import {AvatarProps} from '../web/js/engine/avatar-props.js';
import {sampleTimeline} from '../web/js/avatar/activity-timelines.js';

test('food and potion have original, distinct 16x16 pixel silhouettes, never generic cubes',()=>{
 const ids=['apple','cooked_porkchop','golden_carrot','cake_slice','water_potion'];
 const distinct=new Set();
 for(const id of ids){
  const pixels=FALLBACK_ITEMS[id];
  assert.ok(pixels instanceof Uint8Array, id);
  assert.equal(pixels.length,16*16*4);
  const occupied=Array.from({length:256},(_,i)=>pixels[i*4+3]>127?'1':'0').join('');
  assert.ok(occupied.includes('0')&&occupied.includes('1'),id);
  assert.ok(occupied.split('1').length>12,id+' lacks a contoured silhouette');
  distinct.add(occupied);
 }
 assert.equal(distinct.size,ids.length);
});
test('import whitelist rejects unrelated paths, oversize or invalid images',()=>{
 assert.equal(resolveItemId('apple.png'),'apple');
 assert.equal(resolveItemId('minecraft/assets/textures/item/cooked_porkchop.png'),'cooked_porkchop');
 assert.equal(resolveItemId('potion.png'),'water_potion');
 assert.equal(resolveItemId('package.json'),null);
 assert.equal(resolveItemId('../passwd.png'),null);
 const pixels=FALLBACK_ITEMS.apple;
 assert.equal(validateSpritePixels({width:16,height:16,data:pixels}),true);
 assert.throws(()=>validateSpritePixels({width:17,height:16,data:pixels}));
 assert.throws(()=>validateSpritePixels({width:2048,height:2048,data:pixels}));
});
test('pixel extrusions use cached nearest-filter alpha textures with a 3D contour',()=>{
 const mesh=createExtrudedItem('apple',FALLBACK_ITEMS.apple);
 assert.equal(mesh.texture.magFilter,NearestFilter);
 assert.equal(mesh.texture.minFilter,NearestFilter);
 assert.ok(mesh.depth.geometry.getAttribute('position').count>24);
 assert.ok(mesh.front.material.alphaTest>=.4);
 assert.ok(mesh.front.material.map===mesh.texture);
 mesh.dispose();
});
test('prop rigs mount to existing skin joints; enlarged book faces camera and has page hinge',()=>{
 const skin={body:new Group(),rightArm:new Group(),leftArm:new Group()};
 const p=new AvatarProps(skin);
 assert.equal(p.book.parent,skin.body);
 assert.equal(p.food.parent,skin.rightArm);
 assert.equal(p.drink.parent,skin.rightArm);
 assert.ok(p.book.userData.displayWidth>=6.8,'book should be readable at character preview scale');
 assert.ok(p.turningPage?.rotation);
 const state=sampleTimeline('read',5.05,{});
 p.update('read',5.05,.05,state);
 assert.ok(Math.abs(p.turningPage.rotation.y)>1);
 assert.equal(p.foodVariants.length,4);
 p.update('eat',1.9,.05,sampleTimeline('eat',1.9,{}),'apple');
 assert.ok(p.food.visible);
 p.update('idle',0,.05,sampleTimeline('idle',0,{}));
 assert.equal(p.food.visible,false);
 p.dispose();
 assert.equal(skin.body.children.length,0);
 assert.equal(skin.rightArm.children.length,0);
});
