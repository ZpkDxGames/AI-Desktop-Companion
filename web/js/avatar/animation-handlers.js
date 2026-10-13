import {sampleTimeline} from './activity-timelines.js';
/** Retain the one BehaviorController and rig; handlers are pure pose samplers only. */
export const EXTRA_ANIMATIONS=Object.freeze({
 look:Object.freeze({duration:3.8,priority:1}),
 read:Object.freeze({duration:11.7,priority:2}),
 eat:Object.freeze({duration:4.8,priority:2}),
 drink:Object.freeze({duration:4.4,priority:2}),
 inspect:Object.freeze({duration:4.2,priority:2}),
 nod:Object.freeze({duration:1.45,priority:2}),
 shrug:Object.freeze({duration:1.8,priority:2}),
 stretch:Object.freeze({duration:2.6,priority:2}),
 bow:Object.freeze({duration:1.9,priority:2})
});
const ease=n=>{n=Math.min(1,Math.max(0,n));return n*n*(3-2*n);};
const pulse=(elapsed,duration,enter=.22,exit=.28)=>ease(Math.min(elapsed/enter,(duration-elapsed)/exit));
/** Reused activity state is provided by the controller; no per-frame objects. */
export function applyExtraAnimation(name,pose,elapsed,activity){
 const config=EXTRA_ANIMATIONS[name];if(!config)return false;
 const w=pulse(elapsed,config.duration);
 const phase=activity?.phase;
 if(name==='look'){
  const walk=Math.sin(elapsed*5.2)*.30*w;
  pose.legRX=-walk;pose.legLX=walk;
  pose.armRX=walk*.65;pose.armLX=-walk*.65;
  pose.rootX=Math.sin(elapsed*1.65)*.35*w;
  pose.rootY+=Math.abs(Math.sin(elapsed*5.2))*.14*w;
  pose.bodyZ=Math.sin(elapsed*2.1)*.055*w;
  pose.headY+=Math.sin(elapsed*1.13)*.40*w;
  pose.headX+=Math.sin(elapsed*.78)*.09*w;
 }
 if(name==='read'){
  pose.rootY-=3.35*w;pose.rootZ+=.68*w;
  pose.legRX=-1.29*w;pose.legLX=-1.29*w;
  pose.armRX=-1.05*w;pose.armLX=-1.05*w;
  pose.armRZ=.34*w;pose.armLZ=-.34*w;
  pose.headX=.25*w;
  if(phase==='readA'||phase==='readB'){
   pose.headY+=Math.sin(elapsed*.79)*.057*w;
   pose.headX+=Math.sin(elapsed*.53)*.016*w;
  }
  if(phase==='pageTurn')pose.armRX+=.12*Math.sin(activity.phaseProgress*Math.PI)*w;
 }
 if(name==='eat'){
  const chewing=(phase==='chew1'||phase==='chew2')?Math.sin(elapsed*12)*.045:0;
  const raise=ease((elapsed-.2)/.75)*(1-ease((elapsed-3.65)/.85));
  pose.armRX=-2.19*raise*w+chewing;
  pose.armRZ=.23*raise*w;
  pose.headX=(.07+chewing*.8)*w;pose.headZ=-.035*w;
 }
 if(name==='drink'){
  const raise=ease((elapsed-.25)/.8)*(1-ease((elapsed-3.15)/.78));
  pose.armRX=(-2.19-.18*(activity?.bottleTilt||0))*raise*w;
  pose.armRZ=.19*raise*w;
  pose.headX=(-.035-.11*(activity?.bottleTilt||0))*w;
 }
 if(name==='inspect'){
  pose.bodyX=.16*w;pose.armRX=-1.03*w;pose.armLX=-.42*w;
  pose.armRZ=.15*w;pose.headX=.18*w;
  pose.headY+=Math.sin(elapsed*.85)*.16*w;
  pose.headZ=.075*w;
 }
 if(name==='nod')pose.headX=-.25*w+Math.sin(elapsed*10)*.13*w;
 if(name==='shrug'){pose.armRZ=-.38*w;pose.armLZ=.38*w;pose.headZ=.1*w;}
 if(name==='stretch'){pose.armRX=-2.6*w;pose.armLX=-2.6*w;pose.rootY+=.35*w;pose.headX=-.09*w;}
 if(name==='bow'){pose.headX=.45*w;pose.armRX=.2*w;pose.armLX=.2*w;}
 return true;
}
