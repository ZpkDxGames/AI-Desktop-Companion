import {deriveFaceRig,clamp} from './face-rig-layout.js';

export function createFaceComposition(profile){
 const layout=deriveFaceRig(profile);
 if(!layout.supported)return {supported:false,reason:layout.reason||profile?.reason||'unsupported'};
 const eye=(side)=>({
  x:8+profile.eyes[side][0],y:8+profile.eyes[side][1],
  neutralX:side==='left'?1.5:.5,
  background:profile.background[side],
  iris:profile.colors.iris,pupil:profile.colors.pupil
 });
 return {supported:true,eyes:{left:eye('left'),right:eye('right')},
  colors:profile.colors,occlusion:profile.occlusion};
}

export function composeEyePixel(face,side,x,y,{enabled=true,gazeX=0,gazeY=0,blink=0}={}){
 if(!face?.supported||!face.eyes[side]||!(x>=0&&x<2&&y>=0&&y<2))return null;
 const eye=face.eyes[side],outer=side==='left'?x<1:x>=1;
 const source=outer?(y<1?eye.background.top:eye.background.bottom):(y<1?eye.iris:eye.pupil);
 if(!enabled)return [...source];
 const gx=clamp(Number.isFinite(gazeX)?gazeX:0,-1,1);
 const gy=clamp(Number.isFinite(gazeY)?gazeY:0,-1,1);
 const lid=clamp(Number.isFinite(blink)?blink:0,0,1);
 if(Math.abs(gx)<.001&&Math.abs(gy)<.001&&lid<.2)return [...source];
 if(lid>=.75&&(y>=1||!outer))return [...face.colors.lid];
 if(lid>=.2&&y<1&&!outer)return [...face.colors.lid];
 if(outer)return [...source];
 const dx=x-eye.neutralX-gx*.36,dy=y+gy*.34;
 if(Math.abs(dx)<.48&&dy>=0&&dy<1)return [...eye.iris];
 if(Math.abs(dx)<.48&&dy>=1&&dy<2)return [...eye.pupil];
 return [...face.colors.white];
}
