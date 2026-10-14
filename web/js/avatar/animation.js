import {EXTRA_ANIMATIONS,applyExtraAnimation} from './animation-handlers.js';
import {sampleTimeline} from './activity-timelines.js';
import {FOOD_VARIANTS} from './prop-manifest.js';
import {smootherstep,easeInOutBack,clamp01,applyLifeLayer,LIFE_WEIGHT,jumpHeight,arcPulse} from './motion-polish.js';
export const ACTIONS=Object.freeze(['idle','walk','run','wave','sit','jump','think','celebrate',...Object.keys(EXTRA_ANIMATIONS)]);
export const PRIORITY=Object.freeze({idle:0,walk:1,run:1,sit:2,think:2,wave:3,jump:3,celebrate:3,...Object.fromEntries(Object.entries(EXTRA_ANIMATIONS).map(([id,spec])=>[id,spec.priority]))});
export const DURATION=Object.freeze({wave:2.4,jump:.95,think:3.2,celebrate:2.6,...Object.fromEntries(Object.entries(EXTRA_ANIMATIONS).map(([id,spec])=>[id,spec.duration]))});
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
export const mix=(a,b,t)=>a+(b-a)*t;
export const IDLE_MODES=Object.freeze(['off','calm','lively']);
const IDLE_WINDOWS=Object.freeze({calm:[36,64],lively:[14,26]});
const AUTO_ACTIONS=Object.freeze(['look','read','eat','drink','inspect','stretch','nod']);
/** Every channel the renderer consumes. Order matches SPRING below. */
export const POSE_KEYS=Object.freeze(['headX','headY','headZ','bodyX','bodyY','bodyZ','armRX','armLX','armRZ','armLZ','legRX','legLX','legRZ','legLZ','rootY','rootX','rootZ','rootYaw','breath']);
/** Critical transition decay per channel; follow-through is authored explicitly
 * so a residual spring cannot drive hands or items through the face. */
const SPRING=Object.freeze({
 headX:[16,1],headY:[16,1],headZ:[16,1],
 bodyX:[16,1],bodyY:[16,1],bodyZ:[16,1],
 armRX:[18,1],armLX:[18,1],armRZ:[18,1],armLZ:[18,1],
 legRX:[20,1],legLX:[20,1],legRZ:[20,1],legLZ:[20,1],
 rootY:[20,1],rootX:[18,1],rootZ:[18,1],rootYaw:[16,1],breath:[12,1]
});
const OMEGA=POSE_KEYS.map(k=>SPRING[k][0]);
const LOOKAHEAD=1/10000;
const blank=()=>Object.fromEntries(POSE_KEYS.map(k=>[k,0]));
/** Sole action/idle owner. All trajectories and one-shot events advance in update().
 *
 * Pose = authored raw pose (a pure function of controller time) + a decaying
 * "inertialization" offset. When the action changes the offset is set so the visible
 * pose AND its velocity are continuous, then a damped spring bleeds it to zero.
 * Unlike a fixed cross-fade this never stops limbs dead mid-swing and never snaps.
 */
export class BehaviorController{
 constructor({seed=0x5f3759df}={}){
  this.action='idle';this.elapsed=0;this.time=0;this.previous='idle';
  this.gaze=[0,0];this.gazeTarget=[0,0];this.headGaze=[0,0];this.blink=0;this.nextBlink=3.3;
  this.eyeGaze=[0,0];this.eyeJitter=[0,0];this.eyeJitterTarget=[0,0];this.nextSaccade=1.4;
  this.mood='neutral';this.poseBuffer=blank();
  this.offset=blank();this.offsetVel=blank();this.outVel=blank();
  this.scratchPrev=blank();this.scratchA=blank();this.scratchB=blank();
  this.activity={};this.sampleActivity={};this.reducedMotion=false;this.motionScale=1;
  this.blinkElapsed=-1;this.blinkStart=-1;this.source='system';this.idleMode='off';this.idleCountdown=Infinity;this.autoStarts=0;
  this.rngState=(Number.isFinite(seed)?seed:0x5f3759df)>>>0;
  // Separate stream for cosmetic micro-motion so it can never perturb seeded idle choices.
  this.microState=((Number.isFinite(seed)?seed:0x5f3759df)^0x9e3779b9)>>>0;
  this.blinkState=this.microState^0x85ebca6b;
  this.sitPhase='standing';this.sitAmount=0;this.queuedAction=null;this.queuedSource='manual';
  this.foodVariant='apple';this.foodIndex=-1;this.eventMask=0;this.eventSerial=0;
  this.behaviorPolicy=null;
  sampleTimeline('idle',0,this.activity);
  this.presentation={};this.recovery={};this.recoveryTime=Infinity;this.propDelay=0;this.propSuppressed=false;
  this.updatePresentation();
 }
 setBehaviorPolicy(policy){
  if(policy!==null&&(typeof policy?.choose!=='function'||typeof policy?.tick!=='function'||typeof policy?.noteAction!=='function'))return false;
  this.behaviorPolicy=policy;return true;
 }
 nextRandom(){this.rngState=(Math.imul(this.rngState,1664525)+1013904223)>>>0;return this.rngState/4294967296;}
 microRandom(){this.microState=(Math.imul(this.microState,1664525)+1013904223)>>>0;return this.microState/4294967296;}
 blinkRandom(){this.blinkState=(Math.imul(this.blinkState,1664525)+1013904223)>>>0;return this.blinkState/4294967296;}
 setReducedMotion(enabled){
  if(this.reducedMotion&&!enabled)this.nextSaccade=this.time+1.4;
  this.reducedMotion=!!enabled;
 }
 visibleVelocity(){
  this.rawPose(this.scratchA);this.rawPose(this.scratchB,this.time+LOOKAHEAD,this.elapsed+LOOKAHEAD,LOOKAHEAD);
  for(const key of POSE_KEYS)this.outVel[key]=(this.scratchB[key]-this.scratchA[key])/LOOKAHEAD+this.offsetVel[key];
 }
 captureMotion(){
  const visible=this.pose();
  for(const key of POSE_KEYS)this.scratchPrev[key]=visible[key];
  this.visibleVelocity();
 }
 reconcileOffsets(){
  this.rawPose(this.scratchA);
  this.rawPose(this.scratchB,this.time+LOOKAHEAD,this.elapsed+LOOKAHEAD,LOOKAHEAD);
  for(const key of POSE_KEYS){
   this.offset[key]=this.scratchPrev[key]-this.scratchA[key];
   this.offsetVel[key]=this.outVel[key]-(this.scratchB[key]-this.scratchA[key])/LOOKAHEAD;
  }
 }
 setSeatPhase(phase){
  if(phase===this.sitPhase)return;
  this.captureMotion();this.sitPhase=phase;this.reconcileOffsets();
 }
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
  // 1. Freeze what the viewer sees right now (position AND velocity).
  this.captureMotion();
  this.propDelay=this.recoveryTime<.3?.3:0;
  this.recoverProp();this.propSuppressed=false;
  if(action!==this.action)this.previous=this.action;
  this.action=action;this.source=source;this.elapsed=0;this.eventMask=0;
  this.behaviorPolicy?.noteAction(action,source,this.time);
  if(action==='eat'){
   let index=Math.floor(this.nextRandom()*FOOD_VARIANTS.length);
   if(index===this.foodIndex)index=(index+1)%FOOD_VARIANTS.length;
   this.foodIndex=index;this.foodVariant=FOOD_VARIANTS[index].id;
  }
  sampleTimeline(action,0,this.activity);
  this.reconcileOffsets();
  this.updatePresentation();
 }
 recoverProp(){
  const prop=this.presentation;
  if((prop.action==='read'||prop.action==='eat'||prop.action==='drink')&&prop.visibility>.01){
   for(const key in prop)this.recovery[key]=prop[key];
   this.recoveryTime=0;this.propDelay=.3;
  }
 }
 updatePresentation(){
  const p=this.presentation,old=this.recovery;
  if(this.recoveryTime<.3){
   const t=this.recoveryTime;
   for(const key in old)p[key]=old[key];
   p.time=old.time+t;
   p.exit=smootherstep(t/.3);
   p.visibility=old.visibility*(1-smootherstep((t-.10)/.20));
   p.bookOpen=old.bookOpen*(1-smootherstep((t-.11)/.19));
   p.pageAngle=old.pageAngle+(-Math.PI-old.pageAngle)*smootherstep(t/.11);
   p.bottleTilt=old.bottleTilt*(1-smootherstep(t/.22));
   p.mouthWeight=old.mouthWeight*(1-smootherstep(t/.25));
  }else{
   for(const key in this.activity)p[key]=this.activity[key];
   p.foodVariant=this.foodVariant;p.exit=0;
   if(this.propDelay)p.visibility*=smootherstep((this.elapsed-this.propDelay)/.22);
   if(this.propSuppressed)p.visibility=0;
  }
 }
 request(action,{source='manual'}={}){
  if(!ACTIONS.includes(action))return false;
  if(action==='read'){
   // The existing seat state owns reading entry, reversals and standing exits.
   if(source==='auto'&&this.sitPhase!=='standing')return false;
   if(source!=='manual'&&PRIORITY.read<PRIORITY[this.action]&&DURATION[this.action])return false;
   if(this.sitPhase==='standing')this.sitAmount=0;
   this.begin('read',source);this.queuedAction=null;
   this.setSeatPhase(this.sitAmount>=1?'seated':'sittingDown');
   if(source==='manual')this.resetIdleCountdown();return true;
  }
  if(action==='sit'){
   if(this.sitPhase==='standing'&&action!==this.action && PRIORITY[action]<PRIORITY[this.action]&&DURATION[this.action]&&source!=='manual')return false;
   if(this.sitPhase==='standing'){this.sitAmount=0;this.begin('sit',source);}
   else if(this.action!=='sit')this.begin('sit',source);
   this.queuedAction=null;this.setSeatPhase(this.sitAmount>=1?'seated':'sittingDown');
   if(source==='manual')this.resetIdleCountdown();
   return true;
  }
  if(this.sitPhase!=='standing'){
   // One latest intention is retained while rising, rather than dropped.
   if(source==='auto')return false;
   this.queuedAction=action;this.queuedSource=source;
   if(this.action==='read'&&!this.propSuppressed){this.recoverProp();this.propSuppressed=true;this.updatePresentation();}
   this.setSeatPhase('standingUp');
   this.resetIdleCountdown();
   return true;
  }
  // Manual discrete actions may preempt; low-priority continuous walking/running may not.
  if(action!=='idle'&&PRIORITY[action]<PRIORITY[this.action]&&DURATION[this.action]&&(source!=='manual'||action==='walk'||action==='run'))return false;
  if(action!==this.action||source==='manual'&&action!=='idle')this.begin(action,source);
  if(source==='manual'||action==='idle')this.resetIdleCountdown();
  return true;
 }
 triggerBlink(){this.blinkStart=this.time;this.blinkElapsed=0;this.blink=0;return true;}
 stepOffsets(dt){
  if(dt<=0)return;
  // Exact critically damped solution. No substeps, integration drift or overshoot.
  for(let i=0;i<POSE_KEYS.length;i++){
   const key=POSE_KEYS[i],w=OMEGA[i],x=this.offset[key],v=this.offsetVel[key];
   const b=v+w*x,decay=Math.exp(-w*dt);
   this.offset[key]=(x+b*dt)*decay;
   this.offsetVel[key]=(v-w*b*dt)*decay;
  }
 }
 update(dt){
  dt=Number.isFinite(dt)?clamp(dt,0,.05):0;
  if(dt===0)return; // No RNG, event, timeline, blink or transition work on zero/invalid ticks.
  this.stepOffsets(dt);
  this.recoveryTime+=dt;
  this.motionScale+=((this.reducedMotion?.25:1)-this.motionScale)*(1-Math.exp(-dt*12));
  const eyeBlend=1-Math.exp(-dt*18),headBlend=1-Math.exp(-dt*5.5);
  for(let axis=0;axis<2;axis++){
   this.gaze[axis]+=(this.gazeTarget[axis]-this.gaze[axis])*eyeBlend;
   this.headGaze[axis]+=(this.gazeTarget[axis]-this.headGaze[axis])*headBlend;
  }
  this.time+=dt;
  const before=this.elapsed;
  this.elapsed+=dt;
  if(this.time>=this.nextBlink&&this.blinkElapsed<0){
   const scheduled=this.nextBlink;
   this.triggerBlink();this.blinkStart=scheduled;
   this.nextBlink=scheduled+3+(Math.sin(scheduled*23)*.5+.5)*2.8;
  }
  if(this.blinkElapsed>=0){
   this.blinkElapsed=this.time-this.blinkStart;
   const t=this.blinkElapsed;
   if(t<.075)this.blink=clamp(t/.075,0,1);
   else if(t<.11)this.blink=1;
   else if(t<.23)this.blink=clamp(1-(t-.11)/.12,0,1);
   else{
    this.blink=0;this.blinkElapsed=-1;
    // Occasionally blink twice in quick succession, like real eyes do.
    if(this.blinkRandom()<.16)this.nextBlink=Math.min(this.nextBlink,this.blinkStart+.49);
   }
  }
  // Saccades: tiny fast eye darts so the gaze is never frozen between pointer moves.
  let saccadeDt=dt;
  if(this.time>=this.nextSaccade&&!this.reducedMotion){
   const until=Math.max(0,this.nextSaccade-(this.time-dt));
   const before=1-Math.exp(-until*32);
   for(let axis=0;axis<2;axis++)this.eyeJitter[axis]+=(this.eyeJitterTarget[axis]-this.eyeJitter[axis])*before;
   saccadeDt=this.time-this.nextSaccade;
   const wander=this.microRandom()<.3;
   this.eyeJitterTarget[0]=wander?0:(this.microRandom()-.5)*.14;
   this.eyeJitterTarget[1]=wander?0:(this.microRandom()-.5)*.09;
   this.nextSaccade+=.6+this.microRandom()*2.8;
  }
  const saccadeBlend=1-Math.exp(-saccadeDt*32);
  for(let axis=0;axis<2;axis++){
   this.eyeJitter[axis]+=(this.eyeJitterTarget[axis]-this.eyeJitter[axis])*saccadeBlend;
   const reading=this.action==='read'&&!this.propSuppressed;
   const activityAim=reading?(axis===0?Math.sin(this.elapsed*.48+.3)*.04:-.28):0;
   this.eyeGaze[axis]=clamp(this.gaze[axis]*(reading?.22:1)+(this.reducedMotion?0:this.eyeJitter[axis]*(reading?.5:1))+activityAim,-1,1);
  }
  if(this.sitPhase==='sittingDown'){
   this.sitAmount=clamp(this.sitAmount+dt/(this.action==='read'?.85:.35),0,1);
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
  if(this.action==='read'){
   if(before<10.6&&this.elapsed>=10.6&&!(this.eventMask&1)){this.eventMask|=1;this.eventSerial++;}
   if(before<20.6&&this.elapsed>=20.6&&!(this.eventMask&32)){this.eventMask|=32;this.eventSerial++;}
  }
  if(this.action==='celebrate'){
   if(before<.3&&this.elapsed>=.3&&!(this.eventMask&2)){this.eventMask|=2;this.eventSerial++;}
   if(before<1.15&&this.elapsed>=1.15&&!(this.eventMask&4)){this.eventMask|=4;this.eventSerial++;}
  }
  if(this.action==='eat'){
   if(before<1.55&&this.elapsed>=1.55&&!(this.eventMask&8)){this.eventMask|=8;this.eventSerial++;}
   if(before<2.7&&this.elapsed>=2.7&&!(this.eventMask&16)){this.eventMask|=16;this.eventSerial++;}
  }
  if(DURATION[this.action]&&this.elapsed>=DURATION[this.action]&&(this.sitPhase==='standing'||this.action==='read'&&this.sitPhase==='seated'))
   this.request('idle',{source:'system'});
  // V5 supplies decisions only: timing and requests still belong to this sole controller.
  this.behaviorPolicy?.tick(dt,this);
  if(this.action==='idle'&&this.idleMode!=='off'&&dt>0){
   this.idleCountdown-=dt;
   if(this.idleCountdown<=0){
    const next=this.behaviorPolicy?this.behaviorPolicy.choose(this):AUTO_ACTIONS[Math.floor(this.nextRandom()*AUTO_ACTIONS.length)];
    if(next&&this.request(next,{source:'auto'}))this.autoStarts++;
    this.resetIdleCountdown();
   }
  }
  sampleTimeline(this.action,this.elapsed,this.activity);
  this.updatePresentation();
 }
 setGaze(x,y){this.gazeTarget[0]=clamp(Number.isFinite(x)?x:0,-1,1);this.gazeTarget[1]=clamp(Number.isFinite(y)?y:0,-1,1);}
 gazeMoving(){return Math.abs(this.gaze[0]-this.gazeTarget[0])>.004||Math.abs(this.gaze[1]-this.gazeTarget[1])>.004||Math.abs(this.headGaze[0]-this.gazeTarget[0])>.004||Math.abs(this.headGaze[1]-this.gazeTarget[1])>.004;}
 /** Authored pose for the current action/time, written into `p`. Pure w.r.t. controller state. */
 rawPose(p,t=this.time,e=this.elapsed,lead=0){
  const a=this.action,activity=sampleTimeline(a,e,this.sampleActivity);
  applyLifeLayer(p,t,(LIFE_WEIGHT[a]??.3)*(this.reducedMotion?0:1));
  if(a==='walk'||a==='run'){
   const run=a==='run',speed=run?10:6.1,amplitude=run?.9:.60,th=t*speed;
   const s=Math.sin(th),hip=Math.sin(th+1.2);
   p.armRX=s*amplitude;p.armLX=-p.armRX;p.legRX=-s*amplitude;p.legLX=s*amplitude;
   // Walk: body is HIGHEST as the legs pass (cos^2) and lowest at double support. Run: highest in flight.
   p.rootY+=run?Math.abs(s)*.3:(.5+.5*Math.cos(2*th))*.17;
   p.rootX+=hip*(run?.2:.14);p.bodyZ+=-hip*(run?.05:.035);p.headZ+=hip*(run?.04:.03);
   p.bodyY+=-s*(run?.12:.06);p.bodyX+=run?.14:.03;
   p.headX+=Math.cos(2*th-.6)*(run?.05:.025)-(run?.1:0);
   p.armRZ+=run?.1:.03;p.armLZ-=run?.1:.03;
  }
  if(a==='wave'){
   const raise=easeInOutBack(clamp01(e/.4),.9)*smootherstep((DURATION.wave-e)/.4);
   const flap=Math.sin(e*13)*raise;
   p.armLZ+=2.4*raise+flap*.24;p.armLX+=.15*raise+Math.cos(e*13)*.06*raise;
   p.headZ+=-.08*raise-Math.sin(e*13-.9)*.012*raise;   // head answers the hand a beat later
   p.bodyZ+=.03*raise;p.rootX+=.1*raise;
  }
  if(a==='sit'||a==='read'){
   const rate=this.sitPhase==='sittingDown'?1/(a==='read'?.85:.35):this.sitPhase==='standingUp'?-1/.65:0;
   const w=smootherstep(this.sitAmount+rate*lead);
   p.armRX+=-.12*w;p.armLX+=-.12*w;
   // Floor sitting: pelvis and horizontal legs meet the standing foot plane.
   p.legRX=-1.56*w;p.legLX=-1.56*w;
   // Project the original 12.5 x 4.5 outer leg box onto the standing sole
   // plane. A linear hip drop sends the soles through the floor halfway down.
   const fold=1.56*w;
   p.rootY+=12.25*(Math.cos(fold)-1)+2.25*Math.sin(fold);p.rootZ+=.6*w;
   p.bodyX+=.12*Math.sin(w*Math.PI);p.headX-=.05*Math.sin(w*Math.PI);
   p.headY+=Math.sin(t*.55)*.028*w;
  }
  if(a==='jump'){
   const y=jumpHeight(e),crouch=Math.max(0,-y)/1.2;
   const air=smootherstep((e-.20)/.12)*(1-smootherstep((e-.68)/.12));
   const swing=arcPulse(e,.13,.87);
   p.rootY+=y;p.rootZ-=crouch*.35;
   p.bodyX+=crouch*.13-air*.045;p.headX+=crouch*.04-air*.08;
   p.legRX+=-Math.acos(clamp(1+Math.min(0,y)/12,0,1))-.3*air;
   p.legLX+=-Math.acos(clamp(1+Math.min(0,y)/12,0,1))+.22*air;
   p.armRX+=.25*crouch-1.15*swing;p.armLX+=.25*crouch-1.07*swing;
   p.armRZ-=.48*air;p.armLZ+=.48*air;
  }
  if(a==='think'){
   const w=smootherstep(Math.min(e/.5,(DURATION.think-e)/.4));
   p.headZ+=.13*w;p.headY+=.2*w;p.headX+=-.05*w;p.armRX+=-.93*w+(activity.phase==='ponder'?Math.sin(e*8.5)*.025*w:0);p.armRZ+=-.18*w;
  }
  if(a==='celebrate'){
   const w=smootherstep(Math.min(e/.38,(DURATION.celebrate-e)/.5));
   const hop=arcPulse(e,.17,.89),second=arcPulse(e,.96,1.88);
   p.armLX+=-1.9*w-.16*hop;p.armRX+=-1.86*w-.12*second;
   p.armRZ-=.24*w;p.armLZ+=.27*w;
   p.rootY+=hop*1.25+second*.72-.24*arcPulse(e,0,.22);
   p.bodyZ+=Math.sin(e*3)*.035*w;p.headX-=.12*w;
   p.legRX+=.12*hop;p.legLX-=.09*second;
  }
  applyExtraAnimation(a,p,e,activity);
  if(a!=='sit'&&a!=='read'&&a!=='eat'&&a!=='drink'){
   for(const key of POSE_KEYS)if(key!=='breath')p[key]*=this.motionScale;
  }
  const gx=this.gazeTarget[0]+(this.headGaze[0]-this.gazeTarget[0])*Math.exp(-lead*5.5);
  const gy=this.gazeTarget[1]+(this.headGaze[1]-this.gazeTarget[1])*Math.exp(-lead*5.5);
  const focus=a==='read'?.3:(a==='eat'||a==='drink')?.45:1;
  p.headY+=gx*.20*focus;p.headX+=gy*-.11*focus;
  p.bodyY+=gx*.035*focus;
  return p;
 }
 pose(){
  const p=this.rawPose(this.poseBuffer);
  for(const key of POSE_KEYS)p[key]+=this.offset[key];
  return p;
 }
 expression(){return this.blink>.28?'blink':this.action==='think'?'thinking':'neutral';}
}
