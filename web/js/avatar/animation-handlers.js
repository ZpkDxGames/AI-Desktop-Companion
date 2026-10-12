/** Trusted local animation extensions. No remote scripts or dynamic code execution. */
export const EXTRA_ANIMATIONS = Object.freeze({
 nod: Object.freeze({duration:1.45, priority:2}),
 shrug: Object.freeze({duration:1.8, priority:2}),
 stretch: Object.freeze({duration:2.6, priority:2}),
 bow: Object.freeze({duration:1.9, priority:2})
});
const ease=(t)=>{ t=Math.max(0,Math.min(1,t));return t*t*(3-2*t); };
const pulse=(elapsed,duration,enter=.22,exit=.28)=>ease(Math.min(elapsed/enter,(duration-elapsed)/exit));
/** Operates on safe pose fields only. Handlers never touch DOM, windows or files. */
export function applyExtraAnimation(name,pose,elapsed){
 const config=EXTRA_ANIMATIONS[name];if(!config)return false;
 const w=pulse(elapsed,config.duration);
 if(name==='nod'){pose.headX=-.25*w +Math.sin(elapsed*10)*.13*w;}
 if(name==='shrug'){pose.armRZ=-.38*w;pose.armLZ=.38*w;pose.headZ=.1*w;}
 if(name==='stretch'){pose.armRX=-2.6*w;pose.armLX=-2.6*w;pose.rootY+=.35*w;pose.headX=-.09*w;}
 if(name==='bow'){pose.headX=.45*w;pose.armRX=.2*w;pose.armLX=.2*w;}
 return true;
}
