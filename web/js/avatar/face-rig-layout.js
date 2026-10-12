export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function eyeCenter(cell){
 if(!Array.isArray(cell)||cell.length!==2)throw new TypeError('Eye cell must be [x,y]');
 const x=Number(cell[0]),y=Number(cell[1]);
 if(!Number.isFinite(x)||!Number.isFinite(y))throw new TypeError('Eye coordinates must be finite');
 return {x:-4+x+1,y:8-y-1,z:4.015};
}

export function pupilOffset(side,gazeX){
 const gaze=clamp(Number.isFinite(gazeX)?gazeX:0,-1,1);
 const neutral=side==='left'?.45:-.45;
 return clamp(neutral+gaze*.55,-.48,.48);
}

export function eyelidPose(blink){
 const amount=clamp(Number.isFinite(blink)?blink:0,0,1);
 return {
  amount,
  visible:amount>.015,
  scaleY:Math.max(.001,amount),
  centerY:1-amount,
  pupilVisible:amount<.72
 };
}

export function deriveFaceRig(profile){
 if(!profile?.supported)return {supported:false};
 return {
  supported:true,
  style:profile.style,
  left:{center:eyeCenter(profile.eyes.left)},
  right:{center:eyeCenter(profile.eyes.right)},
  colors:profile.colors
 };
}
