/** Finite presentation policy, sampled by the existing frame. No content, timers or action queue. */
import {REACTIONS} from './local-conversation.js';
const ACTION=Object.freeze({agree:'nod',disagree:'shake',uncertain:'shrug',celebrate:'celebrate',reassure:'wave',surprised:'look'});
const KINDS=Object.freeze(['request-start','model-loading','answer','cancel','error','clear','model-change','window-hidden','window-closed','visibility-resume']);
const ease=x=>{x=Math.max(0,Math.min(1,x));return x*x*x*(x*(x*6-15)+10);};
export function validateCue(value,now=Date.now()){
 if(!value||typeof value!=='object'||Object.keys(value).some(k=>!['version','source','seq','kind','requestId','issuedAt','ttlMs','reaction'].includes(k)))return null;
 if(value.version!==1||typeof value.source!=='string'||!/^[-a-zA-Z0-9]{1,64}$/.test(value.source)||!KINDS.includes(value.kind))return null;
 if(!Number.isSafeInteger(value.seq)||value.seq<1||!Number.isSafeInteger(value.requestId)||value.requestId<0)return null;
 if(!Number.isFinite(value.issuedAt)||!Number.isFinite(value.ttlMs)||value.ttlMs<1||value.ttlMs>120000||value.issuedAt>now+2000||now>=value.issuedAt+value.ttlMs)return null;
 if(value.reaction!==undefined&&!REACTIONS.includes(value.reaction))return null;
 return value;
}
export class ConversationReactionCoordinator{
 constructor({clock=()=>performance.now(),request=()=>false}={}){
  this.clock=clock;this.request=request;this.state='idle';this.id=0;this.expires=0;this.suppressed=false;this.hidden=false;
  this.preferences={gestures:false,effects:true,sleepy:false,quietSeconds:120};
  this.lastActivity=clock();this.wakeAt=-Infinity;this.wakeFrom=0;this.previewUntil=0;this.previewBulbUntil=0;this.bulbAt=-Infinity;
  this.cooldowns=Object.create(null);this.lastReaction=null;this.lastCue=new Map();
  this.output={thinking:false,bulbAge:Infinity,drowsiness:0};
 }
 configure(p){
  if(this.preferences.sleepy&&!p.sleepy)this.activity();
  this.preferences={gestures:p.gestures===true,effects:p.effects!==false,sleepy:p.sleepy===true,
   quietSeconds:[90,120,180].includes(p.quietSeconds)?p.quietSeconds:120};
 }
 activity(){
  const now=this.clock();if(now-this.wakeAt>=1800){this.wakeFrom=this.sample().drowsiness;this.wakeAt=now;}this.lastActivity=now;this.previewUntil=0;
 }
 event(kind,{requestId=this.id,reaction='neutral',ttlMs=120000}={}){
  if(kind==='activity'){this.activity();return true;}
  if(kind==='manual'){this.activity();this.suppressed=true;this.bulbAt=-Infinity;return true;}
  if(kind==='request-start'){
   if(!Number.isSafeInteger(requestId)||requestId<=this.id)return false;
   this.activity();this.id=requestId;this.state='generating';this.expires=this.clock()+Math.min(120000,ttlMs);this.suppressed=false;this.bulbAt=-Infinity;return true;
  }
  if(kind==='model-loading')return requestId===this.id&&this.state==='generating';
  if(kind==='answer'||kind==='cancel'||kind==='error'){
   if(requestId!==this.id||this.state!=='generating')return false;
   this.state='idle';
   if(kind==='answer'&&!this.hidden&&!this.suppressed){
    const now=this.clock();
    if(REACTIONS.includes(reaction)&&now-(this.cooldowns[reaction]??-Infinity)>=12000&&reaction!==this.lastReaction){
     if(reaction==='insight'&&this.preferences.effects){this.bulbAt=now;this.cooldowns[reaction]=now;this.lastReaction=reaction;}
     else if(this.preferences.gestures&&ACTION[reaction]&&this.request(ACTION[reaction])){this.cooldowns[reaction]=now;this.lastReaction=reaction;}
    }else if(reaction==='neutral')this.lastReaction=null;
   }
   return true;
  }
  if(['clear','model-change','window-hidden','window-closed'].includes(kind)){
   this.state='idle';this.bulbAt=-Infinity;this.previewUntil=0;this.previewBulbUntil=0;
   if(kind.startsWith('window-'))this.hidden=true;
   this.activity();this.wakeFrom=0;return true;
  }
  if(kind==='visibility-resume'){this.activity();this.hidden=false;return true;}
  return false;
 }
 preview(kind){
  this.event('manual');const now=this.clock();
  if(kind==='bubble'){this.state='preview';this.expires=now+8000;}
  if(kind==='bulb'){this.bulbAt=now;this.previewBulbUntil=now+2100;}
  if(kind==='sleepy'){this.previewUntil=now+8000;this.wakeAt=now;}
 }
 receive(raw,wallNow=Date.now()){
  const cue=validateCue(raw,wallNow);if(!cue)return false;
  const previous=this.lastCue.get(cue.source)||0;if(cue.seq<=previous)return false;
  // One Workspace session owns the stream; reopening it may restart its IDs.
  if(this.remoteSource!==cue.source){if(this.lastCue.has(cue.source))return false;this.state='idle';this.id=0;this.remoteSource=cue.source;}
  this.lastCue.set(cue.source,cue.seq);if(this.lastCue.size>8)this.lastCue.delete(this.lastCue.keys().next().value);
  return this.event(cue.kind,{...cue,ttlMs:cue.issuedAt+cue.ttlMs-wallNow});
 }
 sample(){
  const now=this.clock(),p=this.preferences,o=this.output;
  if((this.state==='generating'||this.state==='preview')&&now>=this.expires)this.state='idle';
  o.thinking=!this.hidden&&(this.state==='preview'||p.effects&&this.state==='generating'&&!this.suppressed);
  o.bulbAge=!this.hidden&&(p.effects||now<this.previewBulbUntil)?(now-this.bulbAt)/1000:Infinity;
  if(o.bulbAge>2.1)o.bulbAge=Infinity;
  const quiet=(now-this.lastActivity)/1000;
  const sleepy=p.sleepy&&this.state==='idle'&&!this.hidden?.8*ease((quiet-p.quietSeconds)/240):0;
  const waking=this.wakeFrom*(1-ease((now-this.wakeAt)/1800));
  o.drowsiness=this.hidden?0:Math.max(sleepy,waking,now<this.previewUntil?.8*ease((now-this.wakeAt)/1500)*(1-ease((now-this.previewUntil+1800)/1800)):0);
  return o;
 }
 dispose(){this.event('window-closed');this.lastCue.clear();}
}
