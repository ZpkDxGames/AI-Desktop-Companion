import {SkinViewer} from 'skinview3d';
import {detectFaceProfile} from '../avatar/face.js';
import {EyeFaceMaterial} from './eye-face-material.js';
import {AvatarProps} from './avatar-props.js';
import {FALLBACK_ITEMS,ITEM_IDS} from './item-models.js';
import {decodeSavedItemPngs,sanitizeSavedItemTextures} from './item-import.js';
import {AvatarEffects} from './avatar-effects.js';
import {AvatarRig} from './avatar-rig.js';
import {normalizeModelMode,toSkinViewModel,fromSkinViewModel} from '../avatar/model-policy.js';

export class AvatarRenderer{
 constructor(canvas,{overlay=false}={}){
  this.canvas=canvas;
  this.overlay=overlay;
  this.modelMode='auto';
  this.detectedModel='default';
  this.skin=null;
  this.facesEnabled=false;
  this.localSpriteSources={};
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
  this.faceMaterial=new EyeFaceMaterial(this.viewer.playerObject.skin.head);
  this.props=new AvatarProps(this.viewer.playerObject.skin);
  this.rig=new AvatarRig();
  this.effects=new AvatarEffects(this.viewer.playerObject,{reducedMotion:typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches});
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
  if(this.props.skin!==this.viewer.playerObject.skin){
   this.props.dispose();this.props=new AvatarProps(this.viewer.playerObject.skin);
   await this.applyImportedItems();
  }
  const detected=(image.naturalWidth===64&&image.naturalHeight===64)
   ?detectFaceProfile(this.imagePixels(image))
   :{supported:false,reason:'legacy-or-non-64x64-skin'};
  const composed=this.faceMaterial.configure(detected,this.viewer.playerObject.skin.map);
  this.faceProfile=composed.supported?detected:{supported:false,reason:composed.reason};
  this.faceMaterial.setEnabled(this.facesEnabled);
  return {...this.faceProfile,modelType:fromSkinViewModel(this.detectedModel),modelMode:this.modelMode};
 }
 async setModelMode(mode){
  this.modelMode=normalizeModelMode(mode);
  if(this.skin)return this.setSkin(this.skin,{model:this.modelMode});
  return {supported:false,reason:'no-skin',modelType:fromSkinViewModel(this.detectedModel),modelMode:this.modelMode};
 }
 async applyImportedItems(){
  await decodeSavedItemPngs(this.localSpriteSources,(id,pixels,width)=>this.props.setItemPixels(id,pixels,width));
 }
 async setItemTextures(sources){
  this.localSpriteSources=sanitizeSavedItemTextures(sources);
  // Explicit user change or reset: replace each model once, never in the frame loop.
  for(const id of ITEM_IDS)this.props.setItemPixels(id,FALLBACK_ITEMS[id],16);
  await this.applyImportedItems();
  return Object.keys(this.localSpriteSources).length;
 }
 createRig(slim){return this.setModelMode(slim?'slim':'classic');}
 setFacesEnabled(enabled){this.facesEnabled=!!enabled;this.faceMaterial.setEnabled(this.facesEnabled);}
 resize(){
  // skinview3d.setSize writes inline canvas dimensions. Measuring that canvas
  // would permanently lock a new viewer to its 2x2 bootstrap size. The stable
  // layout container, never the renderer-owned drawing surface, is the authority.
  const bounds=this.canvas.parentElement?.getBoundingClientRect();
  const width=Math.max(2,Math.floor(bounds?.width||0));
  const height=Math.max(2,Math.floor((bounds?.height||0)-(this.overlay?52:0)));
  if(this.viewer.width!==width||this.viewer.height!==height)this.viewer.setSize(width,height);
 }
 render(pose,{scale=1,rotation=0,gazeX=0,gazeY=0,blink=0,action='idle',actionElapsed=0,dt=0,activity=null,presentation=null,foodVariant='apple'}={}){
  if(!this.skin)return;
  this.resize();
  const player=this.viewer.playerObject;
  const skin=player.skin;
  player.position.set(pose.rootX||0,pose.rootY||0,pose.rootZ||0);
  player.rotation.set(0,this.baseYaw+rotation+(pose.rootYaw||0),0);
  this.rig.apply(skin,pose);
  this.faceMaterial.update(gazeX,gazeY,blink);
  this.props.update(action,actionElapsed,dt,presentation||activity,presentation?.foodVariant||foodVariant);
  this.effects.update(action,actionElapsed,dt);
  const bounded=Math.max(.55,Math.min(1.5,Number.isFinite(scale)?scale:1));
  if(Math.abs(this.lastScale-bounded)>.001){
   this.lastScale=bounded;
   this.viewer.zoom=this.baseZoom*bounded;
  }
  this.viewer.render();
 }
 get modelType(){return fromSkinViewModel(this.detectedModel);}
 dispose(){this.effects.dispose();this.props.dispose();this.faceMaterial.dispose();this.viewer.dispose();}
}
