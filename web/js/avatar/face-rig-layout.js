/** Pixel-aligned geometry policy for a recognized 2x2 Minecraft face cell.
 *  Neutral eye placement reproduces the exact source-skin iris and pupil columns.
 *  Only whole-pixel gaze movement is permitted; head rotation remains continuous.
 */
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const validColor=c=>Array.isArray(c)&&c.length===4&&c.every(v=>Number.isInteger(v)&&v>=0&&v<=255)&&c[3]>240;
export function eyeCenter(cell){
 if(!Array.isArray(cell)||cell.length!==2)throw new TypeError('Eye cell must be [x,y]');
 const x=Number(cell[0]),y=Number(cell[1]);
 if(!Number.isFinite(x)||!Number.isFinite(y))throw new TypeError('Eye coordinates must be finite');
 return {x:-4+x+1,y:8-y-1,z:4.018};
}
export function pupilOffset(side,gazeX){
 // Full eye is 2px wide. Centers at ±0.5 place 1px iris/pupil tiles exactly
 // over the native PNG pixels. Continuous subpixel shifts cause blurred art.
 const gaze=Number.isFinite(gazeX)?clamp(gazeX,-1,1):0;
 if(gaze<=-.35)return -.5;
 if(gaze>=.35)return .5;
 return side==='left'?.5:-.5;
}
export function eyelidPose(blink,target={}){
 const amount=Number.isFinite(blink)?clamp(blink,0,1):0;
 // Never display a fractional-width/height eyelid pixel.
 const rows=amount>=.75?2:amount>=.2?1:0;
 target.amount=amount;
 target.rows=rows;
 target.visible=rows>0;
 target.scaleY=rows/2;
 target.centerY=rows===1?.5:0;
 target.irisVisible=rows===0;
 target.pupilVisible=rows<2;
 return target;
}
export function deriveFaceRig(profile){
 if(!profile?.supported)return {supported:false};
 const {colors,background,eyes}=profile;
 if(!colors||!eyes||!background||!['lid','white','iris','pupil'].every(k=>validColor(colors[k]))||
    !['left','right'].every(side=>validColor(background[side]?.top)&&validColor(background[side]?.bottom)))
  return {supported:false,reason:'unsafe-eye-background'};
 return {
  supported:true,
  style:profile.style,
  left:{center:eyeCenter(eyes.left),background:background.left},
  right:{center:eyeCenter(eyes.right),background:background.right},
  colors
 };
}
