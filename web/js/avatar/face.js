/**
 * Conservative skin-native eye marker detector.
 * It recognizes the 4x3 eye swatch used by the supplied skin and never
 * mutates the original 64x64 Java skin.
 */
export const MARKER_RECT=Object.freeze({x:24,y:2,width:4,height:3});
const pix=(pixels,x,y)=>{
 const offset=(y*64+x)*4;
 return Array.from(pixels.slice(offset,offset+4));
};
const rgbEqual=(a,b)=>a[3]>0&&b[3]>0&&a.slice(0,3).every((v,i)=>v===b[i]);
const visible=c=>c[3]>240;
const clone=c=>c.slice(0,4);

export function detectFaceProfile(pixels){
 if(!(pixels instanceof Uint8Array||pixels instanceof Uint8ClampedArray)||pixels.length!==64*64*4)
  return {supported:false,reason:'invalid-pixels'};
 const lids=Array.from({length:4},(_,i)=>pix(pixels,24+i,2));
 const top=Array.from({length:4},(_,i)=>pix(pixels,24+i,3));
 const bottom=Array.from({length:4},(_,i)=>pix(pixels,24+i,4));
 if(![...lids,...top,...bottom].every(visible))return {supported:false,reason:'no-eye-marker'};
 if(!rgbEqual(top[0],top[3])||!rgbEqual(bottom[0],bottom[3])||
    !rgbEqual(top[1],top[2])||!rgbEqual(bottom[1],bottom[2])||
    !lids.every(c=>rgbEqual(c,lids[0]))||
    rgbEqual(top[0],bottom[1])||rgbEqual(bottom[0],bottom[1]))
  return {supported:false,reason:'unrecognized-eye-marker'};
 const matches=[];
 for(let y=3;y<7;y++)for(let x=1;x<4;x++){
  const other=7-x;
  if(!rgbEqual(pix(pixels,8+x,8+y),bottom[1])||
     !rgbEqual(pix(pixels,8+other,8+y),bottom[2]))continue;
  if(!rgbEqual(pix(pixels,8+x,8+y-1),top[1])||
     !rgbEqual(pix(pixels,8+other,8+y-1),top[2]))continue;
  const left=[x-1,y-1],right=[other,y-1];
  const leftWhite=pix(pixels,8+left[0],8+y),rightWhite=pix(pixels,8+right[0]+1,8+y);
  if(!rgbEqual(leftWhite,bottom[0])||!rgbEqual(rightWhite,bottom[3]))continue;
  matches.push({left,right});
 }
 if(matches.length!==1)return {supported:false,reason:matches.length?'ambiguous-eye-position':'eye-position-not-matched'};
 const eyes=matches[0];
 // Outer/hat layer pixels are offset +32 in the standard Java Edition head UV
 // layout (front x8..15 maps to x40..47). Their alpha determines where a 3D
 // iris can actually be seen through hair; lower and upper rows may differ.
 const hairOccludes=(x,y)=>pixels[(y*64+x+32)*4+3]>15;
 const occlusion={};
 for(const side of ['left','right']){
  const [cx,cy]=eyes[side],x=8+cx,y=8+cy;
  occlusion[side]={
   top:[hairOccludes(x,y),hairOccludes(x+1,y)],
   bottom:[hairOccludes(x,y+1),hairOccludes(x+1,y+1)]
  };
 }
 // Reconstruct ONLY the recognized 2x2 eye cells. The untouched PNG remains the
 // source of truth; upper corners may be dark hair rather than white sclera.
 const leftTop=pix(pixels,8+eyes.left[0],8+eyes.left[1]);
 const rightTop=pix(pixels,8+eyes.right[0]+1,8+eyes.right[1]);
 const leftBottom=pix(pixels,8+eyes.left[0],8+eyes.left[1]+1);
 const rightBottom=pix(pixels,8+eyes.right[0]+1,8+eyes.right[1]+1);
 if(![leftTop,rightTop,leftBottom,rightBottom].every(visible)||
    !rgbEqual(leftBottom,bottom[0])||!rgbEqual(rightBottom,bottom[3])||
    rgbEqual(leftTop,top[1])||rgbEqual(rightTop,top[2]))
  return {supported:false,reason:'unsafe-eye-background'};
 return {
  supported:true,
  style:'symmetric-2x2-swatch',
  eyes,
  occlusion,
  background:{left:{top:clone(leftTop),bottom:clone(leftBottom)},right:{top:clone(rightTop),bottom:clone(rightBottom)}},
  marker:MARKER_RECT,
  colors:{lid:clone(lids[0]),white:clone(bottom[0]),iris:clone(top[1]),pupil:clone(bottom[1])}
 };
}
