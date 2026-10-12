/**
 * Skin-native, non-destructive 2x2 facial adapter.
 * Recognizes a conservative Fresh Moves / Just Expressions-style 4x3 eye swatch
 * in the UNUSED 24..27 x 2..4 portion of a Java 64x64 skin.
 * It does not copy EMF models/rules and makes no claim to all supported styles.
 */
export const FACE_SIZE = 64;
export const FACE_RECT = Object.freeze({ x: 8, y: 8, width: 8, height: 8 });
export const MARKER_RECT = Object.freeze({ x: 24, y: 2, width: 4, height: 3 });

const pix = (pixels,x,y)=>{
  const offset=(y*64+x)*4;
  return Array.from(pixels.slice(offset,offset+4));
};
const rgbEqual=(a,b)=>a[3] > 0 && b[3] > 0 && a.slice(0,3).every((x,i)=>x===b[i]);
const visible=color=>color[3]>240;
const cloneRgb=color=>color.slice(0,4);

export function detectFaceProfile(pixels){
  if(!(pixels instanceof Uint8Array || pixels instanceof Uint8ClampedArray) || pixels.length!==64*64*4)
    return {supported:false, reason:'invalid-pixels'};
  const lids=Array.from({length:4},(_,i)=>pix(pixels,24+i,2));
  const top=Array.from({length:4},(_,i)=>pix(pixels,24+i,3));
  const bottom=Array.from({length:4},(_,i)=>pix(pixels,24+i,4));
  if (![...lids,...top,...bottom].every(visible))
    return {supported:false,reason:'no-eye-marker'};
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
    if(left[0]<0||right[0]+1>7)continue;
    const leftWhite=pix(pixels,8+left[0],8+y),rightWhite=pix(pixels,8+right[0]+1,8+y);
    if(!rgbEqual(leftWhite,bottom[0])||!rgbEqual(rightWhite,bottom[3]))continue;
    matches.push({left,right});
  }
  if(matches.length!==1)return {supported:false,reason:matches.length?'ambiguous-eye-position':'eye-position-not-matched'};
  return {
    supported:true,style:'symmetric-2x2-swatch',eyes:matches[0],
    marker:MARKER_RECT,
    occluded: Object.fromEntries(Object.entries(matches[0]).map(([side,[x,y]])=>[side, [
      [visible(pix(pixels,40+x,8+y)),visible(pix(pixels,40+x+1,8+y))],
      [visible(pix(pixels,40+x,8+y+1)),visible(pix(pixels,40+x+1,8+y+1))]
    ]])),
    colors:{lid:cloneRgb(lids[0]),white:cloneRgb(bottom[0]),iris:cloneRgb(top[1]),pupil:cloneRgb(bottom[1])}
  };
}

export function composeFacePixels(profile,{gazeX=0,blink=0}={}){
  const pixels=new Uint8ClampedArray(64*64*4);
  if(!profile?.supported)return pixels;
  const gx=Math.max(-1,Math.min(1,Number.isFinite(gazeX)?Math.round(gazeX):0));
  const closed=Number.isFinite(blink)&&blink>=.6;
  const half=Number.isFinite(blink)&&blink>=.25&&!closed;
  if(gx===0&&!closed&&!half)return pixels;
  const put=(x,y,color)=>{const i=((8+y)*64+(8+x))*4;pixels.set(color,i);};
  for(const [side,cell] of Object.entries(profile.eyes)){
    const [x,y]=cell;const set=(xx,yy,color)=>{if(!profile.occluded?.[side]?.[yy-y]?.[xx-x])put(xx,yy,color);};
    if(closed){for(let yy=0;yy<2;yy++)for(let xx=0;xx<2;xx++)set(x+xx,y+yy,profile.colors.lid);continue;}
    const pupilX=gx<0?0:gx>0?1:(side==='left'?1:0);
    for(let xx=0;xx<2;xx++){
      set(x+xx,y,half?profile.colors.lid:(xx===pupilX?profile.colors.iris:profile.colors.white));
      set(x+xx,y+1,half?profile.colors.lid:(xx===pupilX?profile.colors.pupil:profile.colors.white));
    }
  }
  return pixels;
}

export function facePlaneTriangles(depth=4.56){
  const p=[[-4,4,depth],[4,4,depth],[4,-4,depth],[-4,-4,depth]];
  const u=[[8/64,8/64],[16/64,8/64],[16/64,16/64],[8/64,16/64]];
  const result=[];
  // Match outward CCW winding of the vanilla head (+Z).
  for(const i of [0,2,1,0,3,2])result.push(...p[i],...u[i],0,0,1);
  return new Float32Array(result);
}
