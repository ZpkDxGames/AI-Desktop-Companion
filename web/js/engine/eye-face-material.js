import {Vector2,Vector3} from 'three';
import {createFaceComposition} from '../avatar/face-composition.js';
import {FACE_HEADER,FACE_MAP_FRAGMENT} from './eye-shader.js';

const v3=(c)=>new Vector3(c[0]/255,c[1]/255,c[2]/255);
const uniform=(value)=>({value});

/** Exactly one face material clone; never changes body or hat materials. */
export class EyeFaceMaterial{
 constructor(head){
  this.mesh=head.innerLayer;
  this.original=this.mesh.material;
  this.material=this.original.clone();
  this.mesh.material=this.material;
  this.supported=false;
  this.enabled=false;
  this.uniforms={
   faceEnabled:uniform(0),
   faceGaze:uniform(new Vector2()),
   faceBlink:uniform(0),
   eyeLeftCell:uniform(new Vector2()),
   eyeRightCell:uniform(new Vector2()),
   eyeTopLeft:uniform(new Vector3()),
   eyeBottomLeft:uniform(new Vector3()),
   eyeTopRight:uniform(new Vector3()),
   eyeBottomRight:uniform(new Vector3()),
   eyeWhite:uniform(new Vector3()),
   eyeIris:uniform(new Vector3()),
   eyePupil:uniform(new Vector3()),
   eyeLid:uniform(new Vector3())
  };
  this.material.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,this.uniforms);
   if(!shader.fragmentShader.includes('#include <map_fragment>'))
    throw new Error('Unsupported Three.js map shader: eye composition unavailable');
   shader.fragmentShader=shader.fragmentShader
    .replace('#include <common>','#include <common>\n'+FACE_HEADER)
    .replace('#include <map_fragment>',FACE_MAP_FRAGMENT);
  };
  this.material.customProgramCacheKey=()=> 'zpk-native-face-uv-v1';
 }
 setEnabled(enabled){this.enabled=!!enabled;this.uniforms.faceEnabled.value=this.enabled&&this.supported?1:0;}
 configure(profile,texture){
  const composition=createFaceComposition(profile);
  this.supported=composition.supported;
  // Skinview3d's shared base material gets its new map at loadSkin time;
  // this private head clone must bind exactly the same texture, once/import.
  if(this.material.map!==texture){this.material.map=texture;this.material.needsUpdate=true;}
  this.uniforms.faceGaze.value.set(0,0);
  this.uniforms.faceBlink.value=0;
  if(this.supported){
   const {eyes,colors}=composition,u=this.uniforms;
   u.eyeLeftCell.value.set(eyes.left.x,eyes.left.y);
   u.eyeRightCell.value.set(eyes.right.x,eyes.right.y);
   u.eyeTopLeft.value.copy(v3(eyes.left.background.top));
   u.eyeBottomLeft.value.copy(v3(eyes.left.background.bottom));
   u.eyeTopRight.value.copy(v3(eyes.right.background.top));
   u.eyeBottomRight.value.copy(v3(eyes.right.background.bottom));
   u.eyeWhite.value.copy(v3(colors.white));
   u.eyeIris.value.copy(v3(colors.iris));
   u.eyePupil.value.copy(v3(colors.pupil));
   u.eyeLid.value.copy(v3(colors.lid));
  }
  this.setEnabled(this.enabled);
  return composition;
 }
 update(gazeX,gazeY,blink){
  if(!this.enabled||!this.supported)return;
  this.uniforms.faceGaze.value.set(Number.isFinite(gazeX)?gazeX:0,Number.isFinite(gazeY)?gazeY:0);
  this.uniforms.faceBlink.value=Number.isFinite(blink)?blink:0;
 }
 dispose(){
  this.mesh.material=this.original;
  this.material.dispose();
  this.supported=false;
 }
}
