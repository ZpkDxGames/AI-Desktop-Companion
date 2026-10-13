import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,ColorManagement,Matrix4,Vector3} from 'three';
import {SkinObject} from 'skinview3d';
import {AvatarProps} from '../web/js/engine/avatar-props.js';
import {AvatarRig} from '../web/js/engine/avatar-rig.js';
import {BehaviorController} from '../web/js/avatar/animation.js';
import {sampleTimeline} from '../web/js/avatar/activity-timelines.js';
import {createVoxelFood} from '../web/js/engine/voxel-foods.js';
import {FALLBACK_ITEMS} from '../web/js/engine/item-models.js';
const tick=(c,t)=>{for(let i=0;i<Math.round(t*120);i++)c.update(1/120);};
test('food palette is decoded to linear vertex colors even with canonical color management disabled',()=>{
 const enabled=ColorManagement.enabled;let a,b;
 try{ColorManagement.enabled=true;a=createVoxelFood('apple',FALLBACK_ITEMS.apple);ColorManagement.enabled=false;b=createVoxelFood('apple',FALLBACK_ITEMS.apple);
  assert.deepEqual(a.geometry.attributes.color.array,b.geometry.attributes.color.array);
  const colors=b.geometry.attributes.color.array;assert.ok(Array.from({length:colors.length/3},(_,i)=>i*3).some(i=>colors[i]>.3&&colors[i+1]<.05));
 }finally{ColorManagement.enabled=enabled;a?.dispose();b?.dispose();}
});
test('reference foods are solid volumes with distinct silhouettes, not shallow sprite slabs',()=>{
 const props=new AvatarProps(new SkinObject());const dimensions=[];
 for(const id of ['apple','cooked_porkchop','golden_carrot','cake_slice']){
  const model=props.itemModels.get(id),box=new Box3().setFromObject(model.group),size=box.getSize(new Vector3());
  assert.ok(size.z>1.2,id+' must have visible side volume');
  assert.ok(model.group.userData.voxelFood,id+' requires the authored 3D profile');
  dimensions.push(size.toArray().map(n=>n.toFixed(2)).join(','));
 }assert.equal(new Set(dimensions).size,4);props.dispose();
});
test('solid food surface avoids the head, hat and jacket during full bites and interrupted recovery',()=>{
 for(const mode of ['default','slim'])for(const id of ['apple','cooked_porkchop','golden_carrot','cake_slice'])for(const interrupt of [false,true]){
  const skin=new SkinObject();skin.modelType=mode;const props=new AvatarProps(skin),rig=new AvatarRig(),c=new BehaviorController();c.request('eat');c.foodVariant=id;
  const v=new Vector3(),toHead=new Matrix4(),toBody=new Matrix4(),matrix=new Matrix4();
  for(let frame=0;frame<330;frame++){
   if(interrupt&&frame===90)c.request('idle');c.update(1/60);rig.apply(skin,c.pose());props.update(c.action,c.elapsed,1/60,c.presentation,id);skin.updateMatrixWorld(true);
   if(!props.food.visible)continue;
   toHead.copy(skin.head.matrixWorld).invert();toBody.copy(skin.body.matrixWorld).invert();
   const model=props.itemModels.get(id),positions=model.geometry.attributes.position;matrix.multiplyMatrices(toHead,model.mesh.matrixWorld);
   for(let i=0;i<positions.count;i+=3){v.fromBufferAttribute(positions,i).applyMatrix4(matrix);assert.ok(!(Math.abs(v.x)<4.5&&v.y>-.5&&v.y<8.5&&Math.abs(v.z)<4.5),`head ${mode}/${id}/${frame}`);}
   matrix.multiplyMatrices(toBody,model.mesh.matrixWorld);
   for(let i=0;i<positions.count;i+=3){v.fromBufferAttribute(positions,i).applyMatrix4(matrix);assert.ok(!(Math.abs(v.x)<4.25&&Math.abs(v.y)<6.25&&Math.abs(v.z)<2.25),`jacket ${mode}/${id}/${frame}`);}
  }props.dispose();
 }
});
test('reading sits before equipping and raises the closed book before the free hand opens it',()=>{
 const s=sampleTimeline('read',.8,{});assert.equal(s.visibility,0);
 const raised=sampleTimeline('read',1.6,{});assert.ok(raised.bookLift>.9);assert.equal(raised.bookOpen,0);
 const open=sampleTimeline('read',2.25,{});assert.ok(open.bookAssist>.8);assert.ok(open.bookOpen>.1&&open.bookOpen<1);
 const quiet=sampleTimeline('read',5,{});assert.equal(quiet.bookAssist,0);
 assert.ok(sampleTimeline('read',11.1,{}).bookAssist>.9);
});
test('quiet reading supports the book with the left hand while the free right hand rests',()=>{
 const skin=new SkinObject(),props=new AvatarProps(skin),rig=new AvatarRig(),c=new BehaviorController();c.request('read');tick(c,5);
 const p=c.pose();assert.ok(p.armLX<-1.25);assert.ok(p.armRX>-.7);
 assert.strictEqual(props.book.parent,skin.leftArm);
 rig.apply(skin,p);props.update('read',c.elapsed,1/120,c.presentation);skin.updateMatrixWorld(true);
 const grip=new Vector3().fromArray(props.book.userData.supportPoint).applyMatrix4(props.book.matrixWorld);
 const palm=new Vector3().fromArray(props.book.userData.palmPoint).applyMatrix4(skin.leftArm.matrixWorld);
 assert.ok(grip.distanceTo(palm)<1e-6,'book must remain attached to the actual supporting palm');props.dispose();
});
test('page-turn hand arrives before the sheet and follows across the hinge, then returns to rest',()=>{
 const poses=[];for(const t of [10.5,11.1,11.6,12.3]){const c=new BehaviorController();c.request('read');tick(c,t);poses.push({...c.pose()});}
 assert.ok(poses[0].armRX<-1.3);assert.ok(poses[0].armRZ>poses[2].armRZ+.2);
 assert.ok(poses[3].armRX>-.7);
});
test('book cover/page surfaces avoid the face and jacket while lifting, opening and closing',()=>{
 for(const mode of ['default','slim']){
  const skin=new SkinObject();skin.modelType=mode;const props=new AvatarProps(skin),rig=new AvatarRig(),c=new BehaviorController();c.request('read');
  const v=new Vector3(),matrix=new Matrix4(),head=new Matrix4(),body=new Matrix4();
  for(let frame=0;frame<1584;frame++){
   c.update(1/60);rig.apply(skin,c.pose());props.update(c.action,c.elapsed,1/60,c.presentation);skin.updateMatrixWorld(true);if(!props.book.visible)continue;
   head.copy(skin.head.matrixWorld).invert();body.copy(skin.body.matrixWorld).invert();
   props.book.traverse(node=>{if(!node.geometry||!node.visible||node.parent===props.turningPage&&!props.turningPage.visible)return;const positions=node.geometry.attributes.position;
    matrix.multiplyMatrices(head,node.matrixWorld);for(let i=0;i<positions.count;i++){v.fromBufferAttribute(positions,i).applyMatrix4(matrix);assert.ok(!(Math.abs(v.x)<4.5&&v.y>-.5&&v.y<8.5&&Math.abs(v.z)<4.5),`book head ${mode}/${frame}`);}
    matrix.multiplyMatrices(body,node.matrixWorld);for(let i=0;i<positions.count;i++){v.fromBufferAttribute(positions,i).applyMatrix4(matrix);assert.ok(!(Math.abs(v.x)<4.25&&Math.abs(v.y)<6.25&&Math.abs(v.z)<2.25),`book jacket ${mode}/${frame}`);}
   });
  }props.dispose();
 }
});
