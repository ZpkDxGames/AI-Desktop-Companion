import {EXTRA_ANIMATIONS,applyExtraAnimation} from './animation-handlers.js';
import {sampleTimeline} from './activity-timelines.js';
import {FOOD_VARIANTS} from './prop-manifest.js';
export const ACTIONS=Object.freeze(['idle','walk','run','wave','sit','jump','think','celebrate',...Object.keys(EXTRA_ANIMATIONS)]);
export const PRIORITY=Object.freeze({idle:0,walk:1,run:1,sit:2,think:2,wave:3,jump:3,celebrate:3,...Object.fromEntries(Object.entries(EXTRA_ANIMATIONS).map(([id,spec])=>[id,spec.priority]))});
export const DURATION=Object.freeze({wave:2.4,jump:.95,think:3.2,celebrate:2.6,...Object.fromEntries(Object.entries(EXTRA_ANIMATIONS).map(([id,spec])=>[id,spec.duration]))});
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
export const mix=(a,b,t)=>a+(b-a)*t;
export const IDLE_MODES=Object.freeze(['off','calm','lively']);
const IDLE_WINDOWS=Object.freeze({calm:[36,64],lively:[14,26]});
const AUTO_ACTIONS=Object.freeze(['look','read','eat','drink','inspect','stretch','nod']);
const POSE_KEYS=Object.freeze(['headX','headY','headZ','bodyX','bodyZ','armRX','armLX','armRZ','armLZ','legRX','legLX','rootY','rootX','rootZ']);
/** Sole action/idle owner. All trajectories and one-shot events advance in update(). */
export class BehaviorController{
 constructor({seed=0x5f3759df}={}){
  this.action='idle';this.elapsed=0;this.time=0;this.previous='idle';this.blendTime=0;
  this.gaze=[0,0];this.gazeTarget=[0,0];this.headGaze=[0,0];this.blink=0;this.nextBlink=3.3;
  this.mood='neutral';this.poseBuffer={headX:0,headY:0,headZ:0,bodyX:0,bodyZ:0,armRX:0,armLX:0,armRZ:0,armLZ:0,legRX:0,legLX:0,rootY:0,rootX:0,rootZ:0};
  this.transitionFrom={...this.poseBuffer};this.activity={};
  this.blinkElapsed=-1;this.source='system';this.idleMode='off';this.idleCountdown=Infinity;this.autoStarts=0;
  this.rngState=(Number.isFinite(seed)?seed:0x5f3759df)>>>0;
  this.sitPhase='standing';this.sitAmount=0;this.queuedAction=null;this.queuedSource='manual';
  this.foodVariant='apple';this.foodIndex=-1;this.eventMask=0;this.eventSerial=0;
 }
 nextRandom(){this.rngState=(Math.imul(this.rngState,1664525)+1013904223)>>>0;return this.rngState/4294967296;}
 resetIdleCountdown(){
  const bounds=IDLE_WINDOWS[this.idleMode];
  this.idleCountdown=bounds?bounds[0]+(bounds[1]-bounds[0])*this.nextRandom():Infinity;
 }
 setIdleMode(mode){
  if(!IDLE_MODES.includes(mode))return false;
  if(mode===this.idleMode)return true;
  this.idleMode=mode;
  if(mode==='off'&&this.source==='auto')this.request('idle',{source:'system'});
  this.resetIdleCountdown();
  return true;
 }
 begin(action,source){
  if(action!==this.action){
   const previousPose=this.pose();
   for(const key of POSE_KEYS)this.transitionFrom[key]=previousPose[key];
   this.previous=this.action;
  }
  this.action=action;this.source=source;this.elapsed=0;this.blendTime=0;this.eventMask=0;
  if(action==='eat'){
   let index=Math.floor(this.nextRandom()*FOOD_VARIANTS.length);
   if(index===this.foodIndex)index=(index+1)%FOOD_VARIANTS.length;
   this.foodIndex=index;this.foodVariant=FOOD_VARIANTS[index].id;
  }
  sampleTimeline(action,0,this.activity);
 }
 request(action,{source='manual'}={}){
  if(!ACTIONS.includes(action))return false;
  if(action==='sit'){
   if(this.sitPhase==='standing'&&action!==this.action && PRIORITY[action]<PRIORITY[this.action]&&DURATION[this.action])return false;
   if(this.sitPhase==='standing'){this.sitAmount=0;this.begin('sit',source);}
   else if(this.action!=='sit')this.begin('sit',source);
   this.queuedAction=null;this.sitPhase=this.sitAmount>=1?'seated':'sittingDown';
   if(source==='manual')this.resetIdleCountdown();
   return true;
  }
  if(this.sitPhase!=='standing'){
   // One latest intention is retained while rising, rather than dropped.
   if(source==='auto')return false;
   this.queuedAction=action;this.queuedSource=source;
   this.sitPhase='standingUp';
   this.resetIdleCountdown();
   return true;
  }
  if(action!=='idle'&&PRIORITY[action]<PRIORITY[this.action]&&DURATION[this.action])return false;
  if(action!==this.action||source==='manual'&&action!=='idle')this.begin(action,source);
  if(source==='manual'||action==='idle')this.resetIdleCountdown();
  return true;
 }
 triggerBlink(){this.blinkElapsed=0;this.blink=0;return true;}
 update(dt){
  dt=Number.isFinite(dt)?clamp(dt,0,.05):0;
  const eyeBlend=1-Math.exp(-dt*18),headBlend=1-Math.exp(-dt*5.5);
  for(let axis=0;axis<2;axis++){
   this.gaze[axis]+=(this.gazeTarget[axis]-this.gaze[axis])*eyeBlend;
   this.headGaze[axis]+=(this.gazeTarget[axis]-this.headGaze[axis])*headBlend;
  }
  this.time+=dt;
  const before=this.elapsed;
  this.elapsed+=dt;this.blendTime+=dt;
  if(this.time>=this.nextBlink&&this.blinkElapsed<0){
   this.triggerBlink();this.nextBlink=this.time+3+(Math.sin(this.time*23)*.5+.5)*2.8;
  }
  if(this.blinkElapsed>=0){
   this.blinkElapsed+=dt;
   const t=this.blinkElapsed;
   if(t<.075)this.blink=clamp(t/.075,0,1);
   else if(t<.11)this.blink=1;
   else if(t<.23)this.blink=clamp(1-(t-.11)/.12,0,1);
   else{this.blink=0;this.blinkElapsed=-1;}
  }
  if(this.sitPhase==='sittingDown'){
   this.sitAmount=clamp(this.sitAmount+dt/.35,0,1);
   if(this.sitAmount>=1)this.sitPhase='seated';
  }else if(this.sitPhase==='standingUp'){
   this.sitAmount=clamp(this.sitAmount-dt/.65,0,1);
   if(this.sitAmount<=0){
    this.sitPhase='standing';
    const next=this.queuedAction||'idle',source=this.queuedSource;
    this.queuedAction=null;this.begin(next,source);
   }
  }
  // Advance one-shot event counters only across thresholds, never from pose/render.
  if(this.action==='read'&&before<4.6&&this.elapsed>=4.6&&!(this.eventMask&1)){this.eventMask|=1;this.eventSerial++;}
  if(this.action==='celebrate'){
   if(before<.3&&this.elapsed>=.3&&!(this.eventMask&2)){this.eventMask|=2;this.eventSerial++;}
   if(before<1.15&&this.elapsed>=1.15&&!(this.eventMask&4)){this.eventMask|=4;this.eventSerial++;}
  }
  if(this.action==='eat'){
   if(before<1.55&&this.elapsed>=1.55&&!(this.eventMask&8)){this.eventMask|=8;this.eventSerial++;}
   if(before<2.7&&this.elapsed>=2.7&&!(this.eventMask&16)){this.eventMask|=16;this.eventSerial++;}
  }
  if(DURATION[this.action]&&this.elapsed>=DURATION[this.action]&&this.sitPhase==='standing')
   this.request('idle',{source:'system'});
  if(this.action==='idle'&&this.idleMode!=='off'&&dt>0){
   this.idleCountdown-=dt;
   if(this.idleCountdown<=0){
    const next=AUTO_ACTIONS[Math.floor(this.nextRandom()*AUTO_ACTIONS.length)];
    if(this.request(next,{source:'auto'}))this.autoStarts++;
    this.resetIdleCountdown();
   }
  }
 }
 setGaze(x,y){this.gazeTarget[0]=clamp(Number.isFinite(x)?x:0,-1,1);this.gazeTarget[1]=clamp(Number.isFinite(y)?y:0,-1,1);}
 gazeMoving(){return Math.abs(this.gaze[0]-this.gazeTarget[0])>.004||Math.abs(this.gaze[1]-this.gazeTarget[1])>.004||Math.abs(this.headGaze[0]-this.gazeTarget[0])>.004||Math.abs(this.headGaze[1]-this.gazeTarget[1])>.004;}
 pose(){
  const t=this.time,e=this.elapsed,a=this.action,p=this.poseBuffer;
  sampleTimeline(a,e,this.activity);
  p.headX=Math.sin(t*.65)*.035;p.headY=Math.sin(t*.48)*.08;p.headZ=Math.sin(t*.4)*.015;
  p.bodyX=0;p.bodyZ=Math.sin(t*.9)*.009;p.armRX=Math.sin(t*.9)*.03;p.armLX=-Math.sin(t*.9)*.03;
  p.armRZ=.04;p.armLZ=-.04;p.legRX=0;p.legLX=0;
  p.rootY=Math.sin(t*1.4)*.06;p.rootX=0;p.rootZ=0;
  if(a==='walk'||a==='run'){
   const speed=a==='run'?10:6.1,amplitude=a==='run'?.9:.60,sw=Math.sin(t*speed)*amplitude;
   p.armRX=sw;p.armLX=-sw;p.legRX=-sw;p.legLX=sw;p.rootY=Math.abs(Math.sin(t*speed))*.2;p.bodyZ=Math.sin(t*speed*.5)*.04;
  }
  if(a==='wave'){
   const raise=smooth(Math.min(e/.28,(DURATION.wave-e)/.35));
   p.armLZ=2.4*raise+Math.sin(e*13)*.24*raise;p.armLX=.15*raise;p.headZ=-.08*raise;
  }
  if(a==='sit'){
   const w=smooth(this.sitAmount);
   p.legRX=-1.42*w;p.legLX=-1.42*w;
   p.armRX=-.12*w;p.armLX=-.12*w;
   p.rootY=-4.8*w;p.rootZ=1*w;
   if(this.sitPhase==='seated')p.headY+=Math.sin(t*.55)*.028;
  }
  if(a==='jump'){
   const phase=clamp(e/DURATION.jump,0,1);
   p.rootY=Math.sin(Math.PI*phase)*4.4;p.legRX=-.32;p.legLX=.24;p.armRX=-.4;p.armLX=-.4;
  }
  if(a==='think'){
   const w=smooth(Math.min(e/.48,(DURATION.think-e)/.4));
   p.headZ=.13*w;p.headY+=.2*w;p.armRX=-.93*w;p.armRZ=-.18*w;
  }
  if(a==='celebrate'){
   const w=smooth(Math.min(e/.25,(DURATION.celebrate-e)/.37));
   p.armLX=-1.9*w;p.armRX=-1.9*w;p.rootY=Math.abs(Math.sin(e*8))*1.55*w;p.legRX=.2*w;p.legLX=-.2*w;
  }
  applyExtraAnimation(a,p,e,this.activity);
  p.headY+=this.headGaze[0]*.20;p.headX+=this.headGaze[1]*-.11;
  const fade=smooth(this.blendTime/.17);
  if(fade<1)for(const k of POSE_KEYS)p[k]=mix(this.transitionFrom[k],p[k],fade);
  return p;
 }
 expression(){return this.blink>.28?'blink':this.action==='think'?'thinking':'neutral';}
}
