import {smootherstep} from './motion-polish.js';
/** Deterministic, authored activity clock. Sampling never allocates when out is supplied. */
export const ACTIVITY_PHASES=Object.freeze({
 read:Object.freeze([['enter',.9],['raise',1.7],['open',2.6],['readA',10.6],['pageTurn',11.6],['readB',25.2],['close',26.4]]),
 eat:Object.freeze([['equip',.4],['raise',1],['bite1',1.55],['chew1',2.15],['bite2',2.7],['chew2',3.45],['finish',4.8]]),
 drink:Object.freeze([['equip',.4],['raise',1],['sip',2.4],['swallow',3.2],['lower',3.85],['putAway',4.4]]),
 look:Object.freeze([['start',.55],['explore',3.25],['return',3.8]]),
 inspect:Object.freeze([['lean',.7],['focus',3.5],['recover',4.2]]),
 think:Object.freeze([['consider',.5],['ponder',2.75],['resolve',3.2]]),
 celebrate:Object.freeze([['raise',.3],['fireworks',2.15],['settle',2.6]])
});
const clamp=(n,min=0,max=1)=>Math.min(max,Math.max(min,n));
const ease=n=>{n=clamp(n);return n*n*(3-2*n);};
export function sampleTimeline(action,elapsed,out={}){
 const phases=ACTIVITY_PHASES[action];
 const time=Number.isFinite(elapsed)?Math.max(0,elapsed):0;
 let index=0,start=0,end=0,phase='none';
 if(phases){
  for(;index<phases.length;index++){
   end=phases[index][1];
   if(time<end||index===phases.length-1)break;
   start=end;
  }
  phase=phases[index][0];
 }
 out.action=action;out.phase=phase;out.phaseIndex=phases?index:-1;
 out.phaseProgress=phases?clamp((time-start)/(end-start)):0;
 out.time=time;out.duration=phases?end:0;
 out.bookOpen=0;out.pageAngle=0;out.visibility=0;
 out.bite=0;out.bottleTilt=0;
 out.mouthWeight=0;out.consume=0;out.exit=0;
 out.pageIndex=0;out.foodOpacity=1;out.waterFill=1;
 out.bookLift=0;out.bookAssist=0;out.bookHandSweep=0;
 if(action==='read'){
  // Sit first; then calmly read. The two turns begin exactly ten seconds apart.
  out.visibility=smootherstep((time-.9)/.22)*(1-smootherstep((time-25.8)/.6));
  out.bookLift=smootherstep((time-.95)/.6)*(1-smootherstep((time-25.85)/.55));
  out.bookOpen=smootherstep((time-1.8)/.8)*(1-smootherstep((time-25.2)/1.0));
  out.bookAssist=smootherstep((time-1.45)/.45)*(1-smootherstep((time-2.65)/.6));
  out.bookAssist+=smootherstep((time-10.1)/.5)*(1-smootherstep((time-11.6)/.5));
  out.bookAssist+=smootherstep((time-20.1)/.5)*(1-smootherstep((time-21.6)/.5));
  out.bookAssist+=smootherstep((time-24.75)/.45)*(1-smootherstep((time-26.0)/.4));
  for(let turn=0;turn<2;turn++){
   const begin=10.6+turn*10;
   const reach=smootherstep((time-begin+.5)/.5)*(1-smootherstep((time-begin-1)/.5));
   out.bookHandSweep+=reach*Math.cos(Math.PI*smootherstep(time-begin));
  }
  if(time>=10.6&&time<25.2){
   const cycle=Math.floor((time-10.6)/10),age=time-10.6-cycle*10;
   out.pageIndex=cycle+(age>=1?1:0);
   if(age<1){out.phase='pageTurn';out.phaseIndex=4+cycle*2;out.phaseProgress=age;out.pageAngle=-Math.PI*smootherstep(age);}
   else{out.phase='readB';out.phaseIndex=5+cycle*2;out.phaseProgress=(age-1)/9;out.pageAngle=-Math.PI;}
  }else if(time>=25.2){out.phaseIndex=8;out.pageIndex=2;out.pageAngle=-Math.PI;}
 }
 if(action==='eat'){
  out.visibility=ease(time/.3)*ease((4.8-time)/.6);
  out.bite=time>=2.7?2:time>=1.55?1:0;
  // Separate deliberate contacts, with the food held lower during chewing.
  out.mouthWeight=smootherstep((time-.65)/.5)*(1-smootherstep((time-1.55)/.45))
   +smootherstep((time-2.15)/.38)*(1-smootherstep((time-2.75)/.45));
  out.foodOpacity=1-smootherstep((time-3.55)/1.05);
  out.consume=1-out.foodOpacity;
 }
 if(action==='drink'){
  out.visibility=ease(time/.3)*ease((4.4-time)/.45);
  out.bottleTilt=ease((time-1)/.42)*(1-ease((time-3.15)/.6))*.96;
  out.mouthWeight=smootherstep((time-.4)/.75)*(1-smootherstep((time-2.6)/.85));
  out.waterFill=1-smootherstep((time-1.25)/1.15);
 }
 return out;
}
