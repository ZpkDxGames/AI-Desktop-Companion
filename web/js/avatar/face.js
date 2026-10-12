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
 return {
  supported:true,
  style:'symmetric-2x2-swatch',
  eyes:matches[0],
  marker:MARKER_RECT,
  colors:{lid:clone(lids[0]),white:clone(bottom[0]),iris:clone(top[1]),pupil:clone(bottom[1])}
 };
}
