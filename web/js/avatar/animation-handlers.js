/** Trusted local animation extensions. No remote scripts or dynamic code execution. */
export const EXTRA_ANIMATIONS = Object.freeze({
 look: Object.freeze({duration:3.8, priority:1}),
 read: Object.freeze({duration:8.0, priority:2}),
 eat: Object.freeze({duration:4.1, priority:2}),
 drink: Object.freeze({duration:3.8, priority:2}),
 inspect: Object.freeze({duration:4.2, priority:2}),
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
 if(name==='look'){
  pose.headY+=Math.sin(elapsed*1.13)*.32*w;
  pose.headX+=Math.sin(elapsed*.8)*.08*w;
 }
 if(name==='read'){
  pose.rootY-=3.55*w;pose.rootZ+=.7*w;
  pose.legRX=-1.34*w;pose.legLX=-1.34*w;
  pose.armRX=-1.08*w;pose.armLX=-1.08*w;
  pose.armRZ=.43*w;pose.armLZ=-.43*w;
  pose.headX=.22*w;pose.headY+=Math.sin(elapsed*1.2)*.025*w;
 }
 if(name==='eat'){
  pose.armRX=(-2.22+.11*Math.sin(elapsed*7))*w;
  pose.armRZ=.18*w;pose.headX=.06*w;pose.headZ=-.045*w;
 }
 if(name==='drink'){
  pose.armRX=-2.30*w;pose.armRZ=.16*w;pose.headX=-.14*w;
 }
 if(name==='inspect'){
  pose.armRX=-1.25*w;pose.armRZ=.19*w;
  pose.headX=.14*w;pose.headY+=.16*w;
 }
 if(name==='nod'){pose.headX=-.25*w +Math.sin(elapsed*10)*.13*w;}
 if(name==='shrug'){pose.armRZ=-.38*w;pose.armLZ=.38*w;pose.headZ=.1*w;}
 if(name==='stretch'){pose.armRX=-2.6*w;pose.armLX=-2.6*w;pose.rootY+=.35*w;pose.headX=-.09*w;}
 if(name==='bow'){pose.headX=.45*w;pose.armRX=.2*w;pose.armLX=.2*w;}
 return true;
}
