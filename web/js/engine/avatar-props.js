import {BoxGeometry,Group,Mesh,MeshLambertMaterial} from 'three';
const PROP_KEYS=Object.freeze(['book','food','drink']);

/**
 * Owned static props attached to canonical skinview3d joints.
 * Build only once per renderer; no mesh/material allocations during frames.
 * These meshes never touch the skin texture or the head/face material.
 */
export class AvatarProps{
 constructor(skin){
  this.skin=skin;
  this.geometries=new Set();
  this.materials=new Set();
  this.levels={book:0,food:0,drink:0};
  this.book=this.buildBook();
  this.food=this.buildFood();
  this.drink=this.buildDrink();
  // Book is torso-local; held props follow the canonical right-arm joint.
  // The negative local Z offset places them in front as the arm raises.
  skin.body.add(this.book);
  skin.rightArm.add(this.food,this.drink);
  this.book.visible=false;this.food.visible=false;this.drink.visible=false;
 }
 box(parent,color,width,height,depth,x=0,y=0,z=0){
  const geometry=new BoxGeometry(width,height,depth);
  const material=new MeshLambertMaterial({color,transparent:false});
  this.geometries.add(geometry);this.materials.add(material);
  const mesh=new Mesh(geometry,material);
  mesh.position.set(x,y,z);
  parent.add(mesh);
  return mesh;
 }
 buildBook(){
  const group=new Group();
  group.position.set(0,-.6,7.0);
  // Two open covers, cream page blocks and central spine: intentional blocky style.
  this.box(group,0x203d42,2.38,3.28,.26,-1.15,0,0);
  this.box(group,0x203d42,2.38,3.28,.26,1.15,0,0);
  this.box(group,0xd8cfb2,2.07,2.91,.24,-1.15,0,.25);
  this.box(group,0xd8cfb2,2.07,2.91,.24,1.15,0,.25);
  this.box(group,0x13292d,.45,3.32,.47,0,0,.06);
  group.rotation.x=-.32;
  return group;
 }
 buildFood(){
  const group=new Group();
  group.position.set(1.9,-7.8,-1.05);
  this.box(group,0xba4e47,2.05,1.95,1.9);
  this.box(group,0x714a34,.34,.55,.3,0,1.0,0);
  this.box(group,0x638b57,.7,.18,.38,.45,1.14,0);
  return group;
 }
 buildDrink(){
  const group=new Group();
  group.position.set(1.9,-7.8,-1.05);
  this.box(group,0x6494a7,1.18,2.1,1.18,0,0,0);
  this.box(group,0xb1d5d4,1.26,.36,1.26,0,1.21,0);
  this.box(group,0x203b4b,1.35,.36,1.35,0,-.45,.61);
  return group;
 }
 update(action,elapsed,dt){
  const rate=Math.min(1,Math.max(0,Number.isFinite(dt)?dt:0)*13);
  const targetBook=action==='read'?1:0;
  const targetFood=action==='eat'?1:0;
  const targetDrink=action==='drink'?1:0;
  this.levels.book+=(targetBook-this.levels.book)*rate;
  this.levels.food+=(targetFood-this.levels.food)*rate;
  this.levels.drink+=(targetDrink-this.levels.drink)*rate;
  for(const key of PROP_KEYS){
   const group=this[key],level=this.levels[key];
   group.visible=level>.015;
   group.scale.setScalar(.80+.20*level);
  }
  // Small deterministic secondary motion with zero additional scene nodes.
  const t=Number.isFinite(elapsed)?elapsed:0;
  this.book.rotation.y=Math.sin(t*.78)*.045;
  this.food.rotation.z=Math.sin(t*7)*.08;
  this.drink.rotation.x=-.08+Math.sin(t*2.5)*.025;
 }
 dispose(){
  for(const group of [this.book,this.food,this.drink])group.removeFromParent();
  for(const geometry of this.geometries)geometry.dispose();
  for(const material of this.materials)material.dispose();
  this.geometries.clear();this.materials.clear();
 }
}
