import {SkinViewer} from 'skinview3d';
import {Group,Mesh,PlaneGeometry,MeshStandardMaterial} from 'three';
import {detectFaceProfile} from '../avatar/face.js';
import {deriveFaceRig,pupilOffset,eyelidPose,eyeActivity} from '../avatar/face-rig-layout.js';
import {normalizeModelMode,toSkinViewModel,fromSkinViewModel} from '../avatar/model-policy.js';

const rgbHex=rgba=>((rgba?.[0]||0)<<16)|((rgba?.[1]||0)<<8)|(rgba?.[2]||0);

class FaceRig3D{
 constructor(head){
  this.head=head;
  this.root=new Group();
  this.root.name='zpkdx-face-rig';
  this.head.add(this.root);
  this.enabled=true;
  this.supported=false;
  this.eyes={};
  this.resources=[];
  this.lidState={};
  this.layout={supported:false};
  this.active=false;
 }
 clear(){
  this.root.clear();
  const disposed=new Set();
  for(const item of this.resources){
   if(item&&!disposed.has(item)){item.dispose?.();disposed.add(item);}
  }
  this.resources=[];
  this.eyes={};
  this.supported=false;
  this.layout={supported:false};
  this.active=false;
  this.root.visible=false;
 }
 setEnabled(enabled){
  this.enabled=!!enabled;
  this.root.visible=this.enabled&&this.supported&&this.active;
 }
 configure(profile){
  this.clear();
  const layout=deriveFaceRig(profile);
  if(!layout.supported){this.root.visible=false;return layout;}
  this.layout=layout;
  // These six to ten tiny static quads replace ONLY recognized eye cells.
  // White sclera must not cover the original dark hair in their upper row.
  const backgroundGeometry=new PlaneGeometry(2,1);
  const pixelGeometry=new PlaneGeometry(1,1);
  // skinview3d's canonical head is MeshStandardMaterial. Match its lighting
  // model so replacement background pixels do not form bright/dark rectangles.
  const material=color=>new MeshStandardMaterial({
   color:rgbHex(color),roughness:1,metalness:0,depthTest:true,depthWrite:true
  });
  const irisMaterial=material(layout.colors.iris);
  const pupilMaterial=material(layout.colors.pupil);
  const lidMaterial=material(layout.colors.lid);
  this.resources.push(backgroundGeometry,pixelGeometry,irisMaterial,pupilMaterial,lidMaterial);
  for(const side of ['left','right']){
   const group=new Group();
   group.name='eye-'+side;
   const {center,background}=layout[side];
   group.position.set(center.x,center.y,center.z);
   const topMaterial=material(background.top);
   const bottomMaterial=material(background.bottom);
   this.resources.push(topMaterial,bottomMaterial);
   const top=new Mesh(backgroundGeometry,topMaterial);
   top.position.set(0,.5,0);
   const bottom=new Mesh(backgroundGeometry,bottomMaterial);
   bottom.position.set(0,-.5,0);
   const iris=new Mesh(pixelGeometry,irisMaterial);
   const pupil=new Mesh(pixelGeometry,pupilMaterial);
   const neutral=pupilOffset(side,0);
   iris.position.set(neutral,.5,.04);
   pupil.position.set(neutral,-.5,.04);
   // Upper blink covers only the active iris pixel, never the original dark
   // hair in the neighboring cell. Full blink additionally closes lower row.
   const topLid=new Mesh(pixelGeometry,lidMaterial);
   topLid.position.set(neutral,.5,.08);
   topLid.visible=false;
   const bottomLid=new Mesh(backgroundGeometry,lidMaterial);
   bottomLid.position.set(0,-.5,.08);
   bottomLid.visible=false;
   group.add(top,bottom,iris,pupil,topLid,bottomLid);
   this.root.add(group);
   this.eyes[side]={group,iris,pupil,topLid,bottomLid,occlusion:layout[side].occlusion};
  }
  this.supported=true;
  // Never cover the original face with duplicate eye pixels at rest.
  // Only eye motion or eyelid closure should activate the micro geometry.
  this.active=false;
  this.root.visible=false;
  return layout;
 }
 update(gazeX,blink){
  if(!this.supported)return;
  this.active=eyeActivity(gazeX,blink,this.layout);
  this.root.visible=this.enabled&&this.active;
  if(!this.root.visible)return;
  const lid=eyelidPose(blink,this.lidState);
  for(const side of ['left','right']){
   const eye=this.eyes[side];
   const x=pupilOffset(side,gazeX,eye);
   eye.iris.position.x=x;
   eye.pupil.position.x=x;
   eye.iris.visible=lid.irisVisible;
   eye.pupil.visible=lid.pupilVisible;
   eye.topLid.position.x=x;
   eye.topLid.visible=lid.rows>=1;
   eye.bottomLid.visible=lid.rows>=2;
  }
 }
 dispose(){this.clear();this.head.remove(this.root);}
}

export class AvatarRenderer{
 constructor(canvas,{overlay=false}={}){
  this.canvas=canvas;
  this.overlay=overlay;
  this.modelMode='auto';
  this.detectedModel='default';
  this.skin=null;
  this.facesEnabled=false;
  this.baseYaw=overlay?.08:.18;
  this.baseZoom=overlay?.64:.73;
  this.lastScale=0;
  this.viewer=new SkinViewer({
   canvas,
   width:2,
   height:2,
   background:null,
   model:'auto-detect',
   enableControls:false,
   renderPaused:true,
   fov:34,
   zoom:this.baseZoom,
   pixelRatio:'match-device'
  });
  this.viewer.globalLight.intensity=2.25;
  this.viewer.cameraLight.intensity=.85;
  this.viewer.controls.enabled=false;
  this.faceRig=new FaceRig3D(this.viewer.playerObject.skin.head);
  this.faceProfile={supported:false,reason:'no-skin'};
 }
 imagePixels(image){
  const canvas=document.createElement('canvas');
  canvas.width=64;canvas.height=64;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(image,0,0,64,64);
  return ctx.getImageData(0,0,64,64).data;
 }
 async setSkin(image,{model=this.modelMode}={}){
  this.skin=image;
  this.modelMode=normalizeModelMode(model);
  await this.viewer.loadSkin(image,{model:toSkinViewModel(this.modelMode)});
  this.detectedModel=this.viewer.playerObject.skin.modelType;
  this.faceProfile=detectFaceProfile(this.imagePixels(image));
  this.faceRig.configure(this.faceProfile);
  this.faceRig.setEnabled(this.facesEnabled);
  return {...this.faceProfile,modelType:fromSkinViewModel(this.detectedModel),modelMode:this.modelMode};
 }
 async setModelMode(mode){
  this.modelMode=normalizeModelMode(mode);
  if(this.skin)return this.setSkin(this.skin,{model:this.modelMode});
  return {supported:false,reason:'no-skin',modelType:fromSkinViewModel(this.detectedModel),modelMode:this.modelMode};
 }
 createRig(slim){return this.setModelMode(slim?'slim':'classic');}
 setFacesEnabled(enabled){this.facesEnabled=!!enabled;this.faceRig.setEnabled(this.facesEnabled);}
 resize(){
  // skinview3d.setSize writes inline canvas dimensions. Measuring that canvas
  // would permanently lock a new viewer to its 2x2 bootstrap size. The stable
  // layout container, never the renderer-owned drawing surface, is the authority.
  const bounds=this.canvas.parentElement?.getBoundingClientRect();
  const width=Math.max(2,Math.floor(bounds?.width||0));
  const height=Math.max(2,Math.floor((bounds?.height||0)-(this.overlay?52:0)));
  if(this.viewer.width!==width||this.viewer.height!==height)this.viewer.setSize(width,height);
 }
 render(pose,{scale=1,rotation=0,gazeX=0,blink=0}={}){
  if(!this.skin)return;
  this.resize();
  const player=this.viewer.playerObject;
  const skin=player.skin;
  skin.resetJoints();
  player.position.set(pose.rootX||0,pose.rootY||0,pose.rootZ||0);
  player.rotation.set(0,this.baseYaw+rotation,0);
  skin.head.rotation.set(pose.headX||0,pose.headY||0,pose.headZ||0);
  skin.body.rotation.set(0,0,pose.bodyZ||0);
  skin.rightArm.rotation.set(pose.armRX||0,0,pose.armRZ||0);
  skin.leftArm.rotation.set(pose.armLX||0,0,pose.armLZ||0);
  skin.rightLeg.rotation.set(pose.legRX||0,0,0);
  skin.leftLeg.rotation.set(pose.legLX||0,0,0);
  this.faceRig.update(gazeX,blink);
  const bounded=Math.max(.55,Math.min(1.5,Number.isFinite(scale)?scale:1));
  if(Math.abs(this.lastScale-bounded)>.001){
   this.lastScale=bounded;
   this.viewer.zoom=this.baseZoom*bounded;
  }
  this.viewer.render();
 }
 get modelType(){return fromSkinViewModel(this.detectedModel);}
 dispose(){this.faceRig.dispose();this.viewer.dispose();}
}
