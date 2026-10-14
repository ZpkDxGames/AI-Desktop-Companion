import {sampleTimeline} from './activity-timelines.js';
import {smootherstep,easeOutBack,easeInOutBack,clamp01} from './motion-polish.js';
/** Retain the one BehaviorController and rig; handlers are pure pose samplers only. */
export const EXTRA_ANIMATIONS=Object.freeze({
 look:Object.freeze({duration:3.8,priority:1}),
 read:Object.freeze({duration:26.4,priority:2}),
 eat:Object.freeze({duration:4.8,priority:2}),
 drink:Object.freeze({duration:4.4,priority:2}),
 inspect:Object.freeze({duration:4.2,priority:2}),
 nod:Object.freeze({duration:1.45,priority:2}),
 shake:Object.freeze({duration:1.85,priority:2}),
 shrug:Object.freeze({duration:1.8,priority:2}),
 stretch:Object.freeze({duration:2.6,priority:2}),
 bow:Object.freeze({duration:1.9,priority:2})
});
const ease=smootherstep;
const pulse=(elapsed,duration,enter=.22,exit=.28)=>ease(Math.min(elapsed/enter,(duration-elapsed)/exit));
/** Reused activity state is provided by the controller; no per-frame objects.
 * Channels are ADDED to the controller's life layer (breathing, sway) instead of
 * replacing it, so the body never freezes while a gesture plays.
 */
export function applyExtraAnimation(name,pose,elapsed,activity){
 const config=EXTRA_ANIMATIONS[name];if(!config)return false;
 const w=pulse(elapsed,config.duration);
 const phase=activity?.phase;
 if(name==='look'){
  const walk=Math.sin(elapsed*5.2)*.30*w;
  pose.legRX=-walk;pose.legLX=walk;
  pose.armRX+=walk*.65;pose.armLX-=walk*.65;
  pose.rootX+=Math.sin(elapsed*1.65)*.35*w;
  pose.rootY+=Math.abs(Math.sin(elapsed*5.2))*.14*w;
  // Head leads, torso follows ~0.4 s later: reads as attention, not rotation.
  pose.headY+=Math.sin(elapsed*1.13)*.40*w;
  pose.bodyY+=Math.sin(elapsed*1.13-.45)*.12*w;
  pose.bodyZ+=Math.sin(elapsed*2.1)*.055*w;
  pose.headX+=Math.sin(elapsed*.78)*.09*w;
 }
 if(name==='read'){
  const hold=activity?.bookLift||0,assist=activity?.bookAssist||0;
  pose.armLX=-1.40*hold;pose.armLZ=-.12*hold;
  pose.armRX=-.45*hold-1.15*assist;pose.armRZ=.08*hold+.47*assist+.13*(activity?.bookHandSweep||0);
  pose.headX+=.52*hold;pose.headY+=.075*hold;pose.bodyX+=.035*hold;
  if(phase==='readA'||phase==='readB'){
   pose.headY+=Math.sin(elapsed*.48)*.040*hold;
   pose.headX+=Math.sin(elapsed*.36)*.009*hold;
  }
  if(phase==='pageTurn'){
   const turn=Math.sin(activity.phaseProgress*Math.PI);
   pose.armRX-=.035*turn*hold;pose.armRZ+=.025*turn*hold;
   pose.headY+=.020*turn*hold;
  }
 }
 if(name==='eat'){
  const chewing=(phase==='chew1'||phase==='chew2')?Math.sin(elapsed*12)*.045:0;
  const raise=ease((elapsed-.2)/.75)*(1-ease((elapsed-3.65)/.85));
  const contact=activity?.mouthWeight||0;
  pose.armRX=(-1.20-.82*contact)*raise*w+chewing*.12;
  pose.armRZ=(.28+.12*contact)*raise*w;
  pose.headX+=(.07+chewing*.8)*w;pose.headZ+=-.035*w;
  // Head dips toward the food on each bite (anticipation), then recoils.
  if(phase==='bite1'||phase==='bite2')pose.headX+=.06*Math.sin(activity.phaseProgress*Math.PI)*w;
 }
 if(name==='drink'){
  const raise=ease((elapsed-.25)/.8)*(1-ease((elapsed-3.15)/.78));
  const tilt=activity?.bottleTilt||0;
  pose.armRX=(-1.20-.82*(activity?.mouthWeight||0))*raise*w;
  pose.armRZ=(.27+.13*(activity?.mouthWeight||0))*raise*w;
  pose.headX+=(-.035-.11*tilt)*w;
  if(phase==='swallow')pose.headX+=.045*Math.sin(activity.phaseProgress*Math.PI)*w;
 }
 if(name==='inspect'){
  pose.bodyX+=.16*w;pose.armRX+=-1.03*w;pose.armLX+=-.42*w;
  pose.armRZ+=.11*w;pose.headX+=.18*w;
  pose.headY+=Math.sin(elapsed*.85)*.16*w;
  pose.bodyY+=Math.sin(elapsed*.85-.4)*.05*w;
  pose.headZ+=.075*w;
 }
 if(name==='nod'){
  // Two decaying dips with a tiny lift first (anticipation), torso answers softly.
  const decay=Math.exp(-elapsed*1.9),swing=Math.sin(elapsed*9.5);
  const lift=-.07*Math.sin(clamp01(elapsed/.16)*Math.PI);
  pose.headX+=(.30*decay*swing+lift)*w;
  pose.bodyX+=.03*decay*Math.sin(elapsed*9.5-.5)*w;
  pose.rootY-=.05*decay*Math.abs(swing)*w;
 }
 if(name==='shake'){
  // Small counterturn, two legible decaying swings, secondary roll and gradual recovery.
  const swing=Math.sin((elapsed-.14)*10.0),decay=Math.exp(-Math.max(0,elapsed-.14)*1.45);
  pose.headY+=.37*swing*decay*w;
  pose.headZ+=.035*Math.sin((elapsed-.14)*10-.45)*decay*w;
  pose.bodyY+=.034*Math.sin((elapsed-.14)*10-.7)*decay*w;
  pose.headX+=.025*w;
 }
 if(name==='shrug'){
  // Quick lift with overshoot, hold, ease down.
  const up=easeOutBack(clamp01(elapsed/.28),1.6)*ease((config.duration-elapsed)/.55);
  pose.armRZ+=-.38*up;pose.armLZ+=.38*up;
  pose.armRX+=-.1*up;pose.armLX+=-.1*up;
  pose.headZ+=.1*w;pose.headX+=-.04*up;pose.rootY+=.16*up;
 }
 if(name==='stretch'){
  const reach=easeInOutBack(clamp01(elapsed/.9),.7)*ease((config.duration-elapsed)/.7);
  const trembleGate=ease((elapsed-.9)/.3)*ease((config.duration-.7-elapsed)/.3);
  pose.armRX+=-2.6*reach+Math.sin(elapsed*24)*.018*trembleGate;
  pose.armLX+=-2.6*reach-Math.sin(elapsed*24)*.018*trembleGate;
  pose.armRZ+=.08*reach;pose.armLZ-=.08*reach;
  pose.rootY+=.12*reach;pose.bodyX+=-.1*reach;pose.headX+=-.14*reach;
 }
 if(name==='bow'){
  // Bow from the waist: torso leads, head follows, hold, rise slightly early.
  const down=easeInOutBack(clamp01(elapsed/.6),.5)*ease((config.duration-elapsed)/.6);
  const head=easeInOutBack(clamp01((elapsed-.1)/.6),.5)*ease((config.duration-elapsed-.1)/.6);
  pose.bodyX+=.3*down;pose.headX+=.42*head;
  pose.armRX+=.2*down;pose.armLX+=.2*down;pose.rootZ+=-.25*down;pose.rootY+=-.08*down;
 }
 return true;
}
