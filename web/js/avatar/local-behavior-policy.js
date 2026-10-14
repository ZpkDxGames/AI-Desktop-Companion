/** V5: deterministic, opt-in local policy for the EXISTING BehaviorController.
 *
 * No timers, DOM, window enumeration, AI inference, networking, or renderer access.
 * The controller owns clock, requests, priorities, transitions and action duration.
 * This module chooses only on its pre-existing idle-selection boundary.
 */
export const BEHAVIOR_STYLES=Object.freeze({
 balanced:Object.freeze({look:4,read:3,eat:2,drink:2,inspect:2,stretch:2,nod:2}),
 curious:Object.freeze({look:6,read:5,eat:1,drink:1,inspect:5,stretch:1,nod:2}),
 playful:Object.freeze({look:4,read:1,eat:3,drink:3,inspect:2,stretch:5,nod:4}),
 restful:Object.freeze({look:3,read:5,eat:2,drink:3,inspect:1,stretch:3,nod:2})
});
export const BEHAVIOR_ACTIONS=Object.freeze(['look','read','eat','drink','inspect','stretch','nod']);
const COOLDOWN=Object.freeze({look:22,read:75,eat:55,drink:50,inspect:35,stretch:40,nod:25});
const HISTORY_LIMIT=6;
const attentionDecay=1/48;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function sanitizeBehaviorPreferences(input){
 const style=typeof input?.style==='string'&&Object.hasOwn(BEHAVIOR_STYLES,input.style)?input.style:'balanced';
 return {enabled:input?.enabled===true,style};
}
export class LocalBehaviorPolicy{
 constructor({seed=0x17bface,style='balanced'}={}){
  this.state=((Number.isFinite(seed)?seed:0x17bface)>>>0)^0x6d2b79f5;
  this.style=Object.hasOwn(BEHAVIOR_STYLES,style)?style:'balanced';
  this.mood=this.style==='playful'?'playful':this.style==='curious'?'curious':'calm';
  this.attention=0;this.pointerCount=0;
  this.history=new Array(HISTORY_LIMIT).fill(null);this.historyCount=0;
  this.lastTriggered=Object.create(null);
  this.lastChosen=null;this.lastAction=null;this.lastActionTime=-Infinity;
  this.decisions=0;
 }
 random(){
  this.state=(Math.imul(this.state,1664525)+1013904223)>>>0;
  return this.state/4294967296;
 }
 setStyle(style){
  if(!Object.hasOwn(BEHAVIOR_STYLES,style))return false;
  this.style=style;
  this.updateMood();
  return true;
 }
 updateMood(controllerAction='idle'){
  if(controllerAction==='read'||controllerAction==='inspect')this.mood='focused';
  else if(this.attention>.55||this.style==='curious')this.mood='curious';
  else if(this.style==='playful')this.mood='playful';
  else this.mood='calm';
 }
 /** Only a direct local window interaction; not a global desktop signal. */
 noteInteraction(kind,time){
  if(kind!=='pointer'&&kind!=='manual')return false;
  if(!Number.isFinite(time))return false;
  if(kind==='pointer')this.pointerCount=Math.min(0x7fffffff,this.pointerCount+1);
  this.attention=1;this.updateMood();return true;
 }
 /** Action began successfully; no per-frame or persistent event log. */
 noteAction(action,source,time){
  if(action==='idle'||!Number.isFinite(time))return;
  this.lastAction=action;this.lastActionTime=time;
  if(source==='manual')this.noteInteraction('manual',time);
  if(source!=='auto')return;
  this.lastTriggered[action]=time;this.lastChosen=action;
  if(this.historyCount===HISTORY_LIMIT){
   // Fixed-size bounded history; shifting only at an action boundary.
   for(let i=1;i<HISTORY_LIMIT;i++)this.history[i-1]=this.history[i];
  }else this.historyCount++;
  this.history[this.historyCount-1]=action;
 }
 /** Called by the controller's existing update(dt) only, never an interval. */
 tick(dt,controller){
  if(!Number.isFinite(dt)||dt<=0)return;
  this.attention=clamp(this.attention-dt*attentionDecay,0,1);
  this.updateMood(controller?.action);
 }
 /** Controller calls this at its established idle boundary. */
 choose(controller){
  const time=controller?.time;
  if(!Number.isFinite(time)||controller.action!=='idle')return null;
  const profile=BEHAVIOR_STYLES[this.style];
  const previous=this.historyCount?this.history[this.historyCount-1]:null;
  const oldestCompanion=this.historyCount>1?this.history[this.historyCount-2]:null;
  let total=0;
  for(const action of BEHAVIOR_ACTIONS){
   if(action===previous)continue;
   if(time-(this.lastTriggered[action]??-Infinity)<COOLDOWN[action])continue;
   let weight=profile[action];
   // Only consider recent local interactions, with bounded effects.
   if(this.attention>.45&&(action==='look'||action==='inspect'||action==='nod'))weight*=1.35;
   if(previous==='read'&&action==='stretch')weight*=2.2;
   if(previous==='eat'&&action==='drink')weight*=2;
   if(previous==='look'&&action==='nod')weight*=1.65;
   if(action===oldestCompanion)weight*=.35;
   total+=weight;
  }
  if(total<=0){
   // Deterministic fallback cannot repeat the immediately previous action.
   for(const action of BEHAVIOR_ACTIONS)if(action!==previous){this.decisions++;return action;}
   return null;
  }
  let selection=this.random()*total;
  for(const action of BEHAVIOR_ACTIONS){
   if(action===previous||time-(this.lastTriggered[action]??-Infinity)<COOLDOWN[action])continue;
   let weight=profile[action];
   if(this.attention>.45&&(action==='look'||action==='inspect'||action==='nod'))weight*=1.35;
   if(previous==='read'&&action==='stretch')weight*=2.2;
   if(previous==='eat'&&action==='drink')weight*=2;
   if(previous==='look'&&action==='nod')weight*=1.65;
   if(action===oldestCompanion)weight*=.35;
   selection-=weight;
   if(selection<=0){this.decisions++;return action;}
  }
  this.decisions++;return BEHAVIOR_ACTIONS.find(action=>action!==previous)||null;
 }
}
