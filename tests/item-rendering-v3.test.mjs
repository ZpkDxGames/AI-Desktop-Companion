import test from 'node:test';
import assert from 'node:assert/strict';
import {Group} from 'three';
import {FALLBACK_ITEMS,resolveItemId,validateSpritePixels} from '../web/js/engine/item-models.js';
import {createVoxelFood} from '../web/js/engine/voxel-foods.js';
import {AvatarProps} from '../web/js/engine/avatar-props.js';
import {sampleTimeline} from '../web/js/avatar/activity-timelines.js';
import {BehaviorController} from '../web/js/avatar/animation.js';
import {sanitizeSavedItemTextures,isSafeItemDataUrl} from '../web/js/engine/item-import.js';

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
test('volumetric foods use cached pixel-colored exterior geometry with a 3D contour',()=>{
 const mesh=createVoxelFood('apple',FALLBACK_ITEMS.apple);
 assert.ok(mesh.depth.geometry.getAttribute('position').count>24);
 assert.ok(mesh.geometry.getAttribute('color').count>24);
 assert.equal(mesh.group.children.length,1,'one draw for the entire voxel surface');
 mesh.dispose();
});
test('prop rigs mount to existing skin joints; one-hand book has physical cover/page hinges',()=>{
 const skin={body:new Group(),rightArm:new Group(),leftArm:new Group()};
 const p=new AvatarProps(skin);
 assert.equal(p.book.parent,skin.leftArm);
 assert.equal(p.food.parent,skin.rightArm);
 assert.equal(p.drink.parent,skin.rightArm);
 assert.ok(p.book.userData.displayWidth>=6.8,'book should be readable at character preview scale');
 assert.ok(p.turningPage?.rotation);
 const state=sampleTimeline('read',11.1,{});
 p.update('read',11.1,.05,state);
 assert.ok(Math.abs(p.turningPage.rotation.y)>1);
 assert.equal(p.foodVariants.length,4);
 p.update('eat',1.9,.05,sampleTimeline('eat',1.9,{}),'apple');
 assert.ok(p.food.visible);
 p.update('idle',0,.05,sampleTimeline('idle',0,{}));
 assert.equal(p.food.visible,false);
 p.dispose();
 assert.equal(skin.body.children.length,0);
 assert.equal(skin.rightArm.children.length,0);
 assert.equal(skin.leftArm.children.length,0);
});

test('book uses supported floor posture and food/drink hands reach mouth without face-level overraise',()=>{
 const c=new BehaviorController();
 for(const action of ['read','eat','drink']){
  c.request('idle');c.request(action);
  for(let n=0;n<36;n++)c.update(.05);
  const p=c.pose();
  if(action==='read'){
   assert.ok(p.rootY<-9,'reading pelvis should reach the floor seat');
   assert.ok(p.legRX<-1.4,'seated legs should extend in front');
  }else{
   assert.ok(p.armRX< -1.3&&p.armRX> -2.05,'food and drink grip should align near mouth, not eyes');
  }
 }
});
test('locally persisted imports contain only bounded allowlisted data URLs',()=>{
 const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
 assert.ok(isSafeItemDataUrl(png));
 const safe=sanitizeSavedItemTextures({apple:png,water_potion:png,evil:png,golden_carrot:'https://example.org/pixel.png'});
 assert.deepEqual(Object.keys(safe).sort(),['apple','water_potion']);
 assert.equal(isSafeItemDataUrl('javascript:alert(1)'),false);
});
