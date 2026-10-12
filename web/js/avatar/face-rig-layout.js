/** Pixel-aligned geometry policy for a recognized 2x2 Minecraft face cell.
 *  Neutral eye placement reproduces the exact source-skin iris and pupil columns.
 *  Movement may only target pixels unobstructed by the genuine outer hair layer.
 */
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const validColor=c=>Array.isArray(c)&&c.length===4&&c.every(v=>Number.isInteger(v)&&v>=0&&v<=255)&&c[3]>240;
export function eyeCenter(cell){
 if(!Array.isArray(cell)||cell.length!==2)throw new TypeError('Eye cell must be [x,y]');
 const x=Number(cell[0]),y=Number(cell[1]);
 if(!Number.isFinite(x)||!Number.isFinite(y))throw new TypeError('Eye coordinates must be finite');
 return {x:-4+x+1,y:8-y-1,z:4.18};
}
export function pupilOffset(side,gazeX,eye=null){
 // Full eye is 2px wide. Centers at ±0.5 place 1px iris/pupil tiles exactly
 // over the native PNG pixels. Continuous subpixel shifts cause blurred art.
 const gaze=Number.isFinite(gazeX)?clamp(gazeX,-1,1):0;
 const neutral=side==='left'?.5:-.5;
 const proposed=gaze<=-.35?-.5:gaze>=.35?.5:neutral;
 if(!eye?.occlusion||proposed===neutral)return proposed;
 // A solid hat pixel would hide the iris but NOT necessarily the pupil
 // beneath it, producing a broken two-row eye. Move them together or not at all.
 const column=proposed<0?0:1;
 if(eye.occlusion.top[column]||eye.occlusion.bottom[column])return neutral;
 return proposed;
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
 const {colors,background,eyes,occlusion}=profile;
 if(!colors||!eyes||!background||!occlusion||
    !['lid','white','iris','pupil'].every(k=>validColor(colors[k]))||
    !['left','right'].every(side=>
      validColor(background[side]?.top)&&validColor(background[side]?.bottom)&&
      ['top','bottom'].every(row=>Array.isArray(occlusion[side]?.[row])&&
       occlusion[side][row].length===2&&occlusion[side][row].every(v=>typeof v==='boolean'))))
  return {supported:false,reason:'unsafe-eye-background'};
 if(occlusion.left.top[1]||occlusion.left.bottom[1]||
    occlusion.right.top[0]||occlusion.right.bottom[0])
  return {supported:false,reason:'occluded-original-iris'};
 return {
  supported:true,
  style:profile.style,
  left:{center:eyeCenter(eyes.left),background:background.left,occlusion:occlusion.left},
  right:{center:eyeCenter(eyes.right),background:background.right,occlusion:occlusion.right},
  colors
 };
}

/** True only when extra geometry is necessary. Neutral is the unaltered PNG,
 *  not an approximation with color-matched planes.
 */
export function eyeActivity(gazeX,blink,layout){
 if(!layout?.supported)return false;
 if(Number.isFinite(blink)&&blink>=.2)return true;
 return pupilOffset('left',gazeX,layout.left)!==pupilOffset('left',0,layout.left)||
        pupilOffset('right',gazeX,layout.right)!==pupilOffset('right',0,layout.right);
}
