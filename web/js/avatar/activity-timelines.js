/** Deterministic, authored activity clock. Sampling never allocates when out is supplied. */
export const ACTIVITY_PHASES=Object.freeze({
 read:Object.freeze([['enter',.65],['open',1.5],['readA',4.6],['pageTurn',5.5],['readB',10.7],['close',11.7]]),
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
 if(action==='read'){
  out.visibility=ease(time/.35)*ease((11.7-time)/.7);
  out.bookOpen=ease((time-.65)/.85)*(1-ease((time-10.7)/1));
  out.pageAngle=-Math.PI*ease((time-4.6)/.9);
 }
 if(action==='eat'){
  out.visibility=ease(time/.3)*ease((4.8-time)/.6);
  out.bite=time>=2.7?2:time>=1.55?1:0;
 }
 if(action==='drink'){
  out.visibility=ease(time/.3)*ease((4.4-time)/.45);
  out.bottleTilt=ease((time-1)/.42)*(1-ease((time-3.15)/.6))*.96;
 }
 return out;
}
