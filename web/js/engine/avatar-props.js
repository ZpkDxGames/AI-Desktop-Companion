import {BoxGeometry,Group,Mesh,MeshLambertMaterial} from 'three';
import {FOOD_VARIANTS} from '../avatar/prop-manifest.js';
import {sampleTimeline} from '../avatar/activity-timelines.js';
/** Cached Minecraft-inspired original voxel props on canonical skin joints. */
export class AvatarProps{
 constructor(skin){
  this.skin=skin;this.geometries=new Map();this.materials=new Map();
  this.levels={book:0,food:0,drink:0};this.state={};
  this.book=this.buildBook();this.food=this.buildFood();this.drink=this.buildDrink();
  skin.body.add(this.book);skin.rightArm.add(this.food,this.drink);
  this.book.visible=false;this.food.visible=false;this.drink.visible=false;
 }
 box(parent,color,width,height,depth,x=0,y=0,z=0){
  const key=width+','+height+','+depth;
  let geometry=this.geometries.get(key);
  if(!geometry){geometry=new BoxGeometry(width,height,depth);this.geometries.set(key,geometry);}
  let material=this.materials.get(color);
  if(!material){material=new MeshLambertMaterial({color});this.materials.set(color,material);}
  const mesh=new Mesh(geometry,material);
  mesh.position.set(x,y,z);parent.add(mesh);return mesh;
 }
 glyphs(parent,x,front=.38,color=0x69665b){
  // Original faux-pixel writing, not Mojang-font or imported copyrighted images.
  for(let line=0;line<5;line++){
   const width=line===4?1.0:1.65-(line%2)*.17;
   this.box(parent,color,width,.085,.025,x,(1.0-line*.36),front);
  }
 }
 buildBook(){
  const book=new Group();book.position.set(0,2.35,9.25);book.rotation.x=-.31;
  this.box(book,0x3b241b,.42,3.5,.65,0,0,-.14); // spine, direct child for lifecycle contract
  this.leftCover=new Group();this.rightCover=new Group();book.add(this.leftCover,this.rightCover);
  this.box(this.leftCover,0x28515a,2.5,3.48,.21,-1.24,0,-.12);
  this.box(this.rightCover,0x28515a,2.5,3.48,.21,1.24,0,-.12);
  this.box(this.leftCover,0xe4d9b6,2.24,3.13,.19,-1.19,0,.09);
  this.box(this.rightCover,0xe4d9b6,2.24,3.13,.19,1.19,0,.09);
  this.glyphs(this.leftCover,-1.19,.20);
  this.glyphs(this.rightCover,1.19,.20);
  this.turningPage=new Group();book.add(this.turningPage);
  this.turningPage.position.z=.25;
  this.box(this.turningPage,0xf5e8c3,2.14,3.08,.065,1.08,0,0);
  this.glyphs(this.turningPage,1.08,.045,0x70685c);
  this.box(book,0xd9b971,.18,3.25,.39,0,0,.08);
  return book;
 }
 buildFood(){
  const group=new Group();group.position.set(1.75,-7.65,-1.15);
  this.foodVariants=FOOD_VARIANTS.map(({id})=>{
   const root=new Group();root.userData.variant=id;group.add(root);
   if(id==='apple'){
    this.box(root,0xb73831,1.9,2.05,1.45,0,0,0);
    this.box(root,0xe4644b,1.16,.56,1.1,-.16,.59,.24);
    this.box(root,0x4d3521,.30,.58,.33,0,1.25,0);
    this.box(root,0x53864c,.75,.24,.54,.40,1.30,0);
   }else if(id==='cooked_porkchop'){
    this.box(root,0x7f492b,2.3,1.6,.62,0,0,0);
    this.box(root,0xb77543,1.8,1.2,.7,-.16,.13,.04);
    this.box(root,0xe2bd83,.69,.55,.78,1.06,-.55,.04);
    this.box(root,0xe1b88b,.46,.9,.75,1.24,-.46,.04);
   }else if(id==='golden_carrot'){
    this.box(root,0xe5a930,1.25,1.55,.73,0,-.1,0);
    this.box(root,0xf4cf51,.99,.9,.77,0,.43,.02);
    this.box(root,0xc58421,.65,.56,.59,0,-1.08,0);
    this.box(root,0x5a934c,.37,.72,.27,-.22,1.13,0);
    this.box(root,0x498545,.40,.65,.27,.24,1.1,0);
   }else{
    this.box(root,0xa86b3b,2.18,.54,1.33,0,-.68,0);
    this.box(root,0xe8c37c,2.14,.85,1.30,0,-.05,0);
    this.box(root,0xf2eadd,2.18,.43,1.39,0,.58,0);
    this.box(root,0xcc3f4b,.47,.25,.47,-.56,.9,.07);
    this.box(root,0xcc3f4b,.47,.25,.47,.62,.9,.07);
   }
   root.visible=false;return root;
  });
  return group;
 }
 buildDrink(){
  const group=new Group();group.position.set(1.75,-7.65,-1.15);
  this.box(group,0x748e9b,1.78,1.97,.88,0,-.2,0);
  this.box(group,0x289fdc,1.39,1.28,.94,0,-.46,.05); // water potion contents
  this.box(group,0x65c4ed,.48,1.08,1.0,-.37,-.39,.02);
  this.box(group,0xa6d4de,1.62,.23,1.05,0,.76,0);
  this.box(group,0xa5c2c6,.72,.65,.67,0,1.12,0);
  this.box(group,0x866547,1.07,.42,.96,0,1.56,0); // stopper
  this.box(group,0xd9edf0,.24,1.52,1.05,-.72,-.21,0);
  return group;
 }
 update(action,elapsed,dt,activity,variant='apple'){
  const state=activity||sampleTimeline(action,elapsed,this.state);
  const isRead=action==='read',isFood=action==='eat',isDrink=action==='drink';
  this.levels.book=isRead?state.visibility:0;
  this.levels.food=isFood?state.visibility:0;
  this.levels.drink=isDrink?state.visibility:0;
  this.book.visible=isRead&&state.visibility>.01;
  this.food.visible=isFood&&state.visibility>.01;
  this.drink.visible=isDrink&&state.visibility>.01;
  this.book.scale.setScalar(.92+.08*state.visibility);
  this.book.rotation.y=Math.sin(state.time*.59)*.025*(isRead?1:0);
  this.leftCover.rotation.y=(1-state.bookOpen)*1.48;
  this.rightCover.rotation.y=-(1-state.bookOpen)*1.48;
  this.turningPage.rotation.y=state.pageAngle;
  this.turningPage.visible=isRead&&state.bookOpen>.05;
  this.food.scale.setScalar((state.bite===0?1:state.bite===1?.78:.56)*(.85+.15*state.visibility));
  this.food.rotation.z=isFood?Math.sin(state.time*12)*.055:0;
  for(let i=0;i<this.foodVariants.length;i++)
   this.foodVariants[i].visible=isFood&&FOOD_VARIANTS[i].id===variant;
  this.drink.scale.setScalar(.85+.15*state.visibility);
  this.drink.rotation.x=-.08-state.bottleTilt;
 }
 dispose(){
  for(const group of [this.book,this.food,this.drink])group.removeFromParent();
  for(const geometry of this.geometries.values())geometry.dispose();
  for(const material of this.materials.values())material.dispose();
  this.geometries.clear();this.materials.clear();
 }
}
