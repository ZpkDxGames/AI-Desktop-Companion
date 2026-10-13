import {
 BoxGeometry,DataTexture,DoubleSide,FrontSide,BackSide,Group,Mesh,MeshBasicMaterial,Euler,Quaternion,
 MeshLambertMaterial,NearestFilter,PlaneGeometry,RGBAFormat,SRGBColorSpace,UnsignedByteType
} from 'three';
import {FOOD_VARIANTS} from '../avatar/prop-manifest.js';
import {sampleTimeline} from '../avatar/activity-timelines.js';
import {smootherstep} from '../avatar/motion-polish.js';
import {createExtrudedItem,FALLBACK_ITEMS,ITEM_IDS,validateSpritePixels} from './item-models.js';

/**
 * Canonical renderer-owned props. All artwork, hinges, joint anchors and
 * geometry are constructed on initialization or explicit local asset import.
 * Per-frame update mutates only existing transforms/visibility.
 */
export class AvatarProps{
 constructor(skin){
  this.skin=skin;
  this.geometries=new Map();this.materials=new Map();
  this.ownedTextures=[];this.itemModels=new Map();
  this.levels={book:0,food:0,drink:0};this.state={};
  this.gripEuler=new Euler();this.gripQuaternion=new Quaternion();
  this.book=this.buildBook();
  this.food=this.buildHeld('food');
  this.drink=this.buildHeld('drink');
  skin.body.add(this.book);
  skin.rightArm.add(this.food,this.drink);
  this.foodVariants=[];
  for(const {id} of FOOD_VARIANTS){
   const root=new Group();root.userData.variant=id;this.food.add(root);
   this.foodVariants.push(root);
   this.setItemPixels(id,FALLBACK_ITEMS[id],16);
  }
  this.drinkItem=new Group();this.drink.add(this.drinkItem);
  this.setItemPixels('water_potion',FALLBACK_ITEMS.water_potion,16);
  this.book.visible=false;this.food.visible=false;this.drink.visible=false;
 }
 box(parent,color,width,height,depth,x=0,y=0,z=0){
  const key=width+','+height+','+depth;
  let geometry=this.geometries.get(key);
  if(!geometry){geometry=new BoxGeometry(width,height,depth);this.geometries.set(key,geometry);}
  let material=this.materials.get(color);
  if(!material){material=new MeshLambertMaterial({color});this.materials.set(color,material);}
  const mesh=new Mesh(geometry,material);mesh.position.set(x,y,z);parent.add(mesh);
  return mesh;
 }
 pageTexture(seed){
  const width=32,height=48,pixels=new Uint8Array(width*height*4);
  const ink=(x,y,c)=>{const idx=(y*width+x)*4;pixels[idx]=c[0];pixels[idx+1]=c[1];pixels[idx+2]=c[2];pixels[idx+3]=255;};
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const border=x<2||x>29||y<2||y>45;
   let c=border?[0x9e,0x8b,0x66]:[0xf2,0xe6,0xc5];
   const lines=y>6&&y<40&&((y+seed)%7===0||(y+seed)%7===1);
   if(lines&&x>=5&&x<26-((y*3+seed)%9))c=[0x67,0x56,0x42];
   if(!border&&((x*19+y*11+seed*13)%47===0))c=[0xdd,0xc9,0xa7];
   ink(x,y,c);
  }
  const data=new Uint8Array(pixels.length);
  for(let y=0;y<height;y++)data.set(pixels.subarray((height-y-1)*width*4,(height-y)*width*4),y*width*4);
  const texture=new DataTexture(data,width,height,RGBAFormat,UnsignedByteType);
  texture.magFilter=NearestFilter;texture.minFilter=NearestFilter;
  texture.generateMipmaps=false;texture.colorSpace=SRGBColorSpace;texture.needsUpdate=true;
  this.ownedTextures.push(texture);return texture;
 }
 printPage(parent,x,seed,front=.27){
  const geometry=new PlaneGeometry(2.72,4.0);this.geometries.set('page-plane-'+seed,geometry);
  const material=new MeshBasicMaterial({map:this.pageTexture(seed),side:DoubleSide});
  this.materials.set('page-ink-'+seed,material);
  const page=new Mesh(geometry,material);page.position.set(x,0,front);
  parent.add(page);return page;
 }
 buildBook(){
  const book=new Group();
  book.position.set(0,1.70,8.65);
  book.userData.grip='two palms / lower cover corners';
  book.userData.displayWidth=7.5;
  this.box(book,0x65442e,.42,4.6,.67,0,0,-.14); // spine: direct child for regression tests
  this.leftCover=new Group();this.rightCover=new Group();
  book.add(this.leftCover,this.rightCover);
  const leafWidth=3.45,pageX=leafWidth*.5;
  this.box(this.leftCover,0x326069,leafWidth,4.65,.20,-pageX,0,-.15);
  this.box(this.rightCover,0x326069,leafWidth,4.65,.20,pageX,0,-.15);
  this.box(this.leftCover,0xe1d0ab,3.17,4.30,.20,-pageX,0,.065);
  this.box(this.rightCover,0xe1d0ab,3.17,4.30,.20,pageX,0,.065);
  this.printPage(this.leftCover,-pageX,2,.20);
  this.printPage(this.rightCover,pageX,8,.20);
  this.turningPage=new Group();
  this.turningPage.position.set(0,0,.30);
  book.add(this.turningPage);
  // One actual hinged sheet, with distinct front/back print and a small cached
  // curl. A second rigid page box would intersect the sheet during its turn.
  const sheet=new PlaneGeometry(3.09,4.20,8,1);sheet.translate(1.545,0,.056);
  this.geometries.set('turning-sheet',sheet);
  this.pagePositions=sheet.getAttribute('position');
  this.pageBase=new Float32Array(this.pagePositions.array);
  const face=new MeshBasicMaterial({map:this.pageTexture(17),side:FrontSide});
  const backTexture=this.pageTexture(23);backTexture.repeat.x=-1;backTexture.offset.x=1;
  const back=new MeshBasicMaterial({map:backTexture,side:BackSide});
  this.materials.set('sheet-front',face);this.materials.set('sheet-back',back);
  this.turningPage.add(new Mesh(sheet,face),new Mesh(sheet,back));
  // A thin exposed gilt binding frames the hinge without obscuring the page.
  this.box(book,0xcaa363,.14,4.24,.40,0,0,.045);
  return book;
 }
 buildHeld(kind){
  const group=new Group();
  // Calibrated on the canonical right-hand pivot; the arm supplies reach, the
  // local grip counter-rotates so the item remains legible to the camera.
  group.position.set(-1,-8.7,1.2);
  group.userData.grip='skin.rightArm/wrist';
  group.userData.kind=kind;
  return group;
 }
 setItemPixels(id,pixels,width=16){
  if(!ITEM_IDS.includes(id))throw Error('Unknown local item id');
  validateSpritePixels({width,height:width,data:pixels});
  const thickness=id==='water_potion'?1.4:id==='cake_slice'?1.1:id==='apple'?.85:.65;
  const model=createExtrudedItem(id,pixels,{width,pixelSize:5.35/width,depth:thickness});
  const parent=id==='water_potion'?this.drinkItem:this.foodVariants[FOOD_VARIANTS.findIndex(v=>v.id===id)];
  const old=this.itemModels.get(id);
  if(old)old.dispose();
  // Each sprite is vertically aligned to the actual hand grip, never to the
  // head or to an independent screen-space position.
  parent.add(model.group);
  model.group.position.set(.2,.15,.25);
  this.itemModels.set(id,model);
  return model;
 }
 orientHeld(group,pitch,yaw,roll){
  // Counter-rotate the full shoulder quaternion, rather than subtracting Euler
  // X angles through a rotated Z/Y basis. This preserves the actual bottle axis.
  this.gripQuaternion.setFromEuler(this.gripEuler.set(pitch,yaw,roll));
  group.quaternion.copy(this.skin.rightArm.quaternion).invert().multiply(this.gripQuaternion);
 }
 update(action,elapsed,dt,activity,variant='apple'){
  const state=activity||sampleTimeline(action,elapsed,this.state);
  action=state.action||action;
  const isRead=action==='read',isFood=action==='eat',isDrink=action==='drink';
  this.levels.book=isRead?state.visibility:0;
  this.levels.food=isFood?state.visibility:0;
  this.levels.drink=isDrink?state.visibility:0;
  this.book.visible=isRead&&state.visibility>.01;
  this.food.visible=isFood&&state.visibility>.01;
  this.drink.visible=isDrink&&state.visibility>.01;
  // Open book faces the viewer during a reading pose; tilt upward enough for
  // both page surfaces to be visible, without clipping the face.
  const visibility=state.visibility||0,exit=state.exit||0;
  this.book.scale.setScalar(Math.max(.001,1.04*visibility));
  this.book.position.set(0,1.70-exit*.4,8.65-exit*.6);
  this.book.rotation.x=-.16-.03*state.bookOpen+Math.sin(state.time*.47)*.007*(isRead?1:0);
  this.book.rotation.y=Math.sin(state.time*.64)*.028*(isRead?1:0);
  this.leftCover.rotation.y=(1-state.bookOpen)*1.30;
  this.rightCover.rotation.y=-(1-state.bookOpen)*1.30;
  this.turningPage.rotation.y=state.pageAngle;
  this.turningPage.visible=isRead&&state.bookOpen>.05;
  if(isRead){
   const curl=Math.sin(Math.abs(state.pageAngle))*.24;
   const points=this.pagePositions.array,base=this.pageBase;
   for(let i=0;i<points.length;i+=3)points[i+2]=base[i+2]+Math.sin(base[i]/3.09*Math.PI)*curl;
   this.pagePositions.needsUpdate=true;
  }
  // The inside face of both canonical hands is x=+1 in shoulder-local space.
  // The item overlaps that face as a grip while its silhouette remains exposed.
  const slim=this.skin.modelType==='slim';
  this.food.position.set(slim?2.25:2.40,-10.5,-.80);
  this.drink.position.set(slim?2.25:2.40,-10.5,-.05);
  const foodScale=.86*(1-(state.consume??(state.bite===0?0:state.bite===1?.20:.42)))*visibility;
  this.food.scale.setScalar(foodScale);
  // A counter-rotated hand grip keeps the thin item sprite facing outward;
  // body lean and shoulder pitch remain the sole action pose authority.
  const mouth=state.mouthWeight||0;
  this.orientHeld(this.food,-.24-1.62*mouth,.12,.12+.12*mouth);
  for(let i=0;i<this.foodVariants.length;i++){
   this.foodVariants[i].visible=isFood&&FOOD_VARIANTS[i].id===variant;
  }
  this.drink.scale.setScalar(1.30*visibility);
  this.orientHeld(this.drink,-.18-1.80*state.bottleTilt,.10,.05);
 }
 dispose(){
  for(const group of [this.book,this.food,this.drink])group.removeFromParent();
  for(const model of this.itemModels.values())model.dispose();
  this.itemModels.clear();
  for(const geometry of this.geometries.values())geometry.dispose();
  for(const material of this.materials.values())material.dispose();
  for(const texture of this.ownedTextures)texture.dispose();
  this.geometries.clear();this.materials.clear();this.ownedTextures.length=0;
 }
}
