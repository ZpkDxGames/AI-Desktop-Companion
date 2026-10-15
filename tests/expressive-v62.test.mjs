import test from 'node:test';
import assert from 'node:assert/strict';
import {ConversationReactionCoordinator,validateCue} from '../web/js/ai/reaction-coordinator.js';
import {parseReply,REACTIONS} from '../web/js/ai/local-conversation.js';
import {BehaviorController,ACTIONS,POSE_KEYS} from '../web/js/avatar/animation.js';
test('V6.2.3 coordinator rejects unknown labels including inherited object properties',()=>{
 const calls=[],c=new ConversationReactionCoordinator({request:a=>{calls.push(a);return true;}});c.configure({gestures:true});
 let id=0;for(const reaction of ['toString','constructor','__proto__','exec',{},[]]){
  c.event('request-start',{requestId:++id});c.event('answer',{requestId:id,reaction});
  assert.equal(c.lastAnswerReaction,'neutral');assert.equal(c.lastDecision.reason,'neutral_or_no_supported_reaction');
 }
 assert.deepEqual(calls,[]);
});
test('V6.2.3 finite diagnostics distinguish stale, expiry, manual priority and overlay replay',()=>{
 let now=0;const c=new ConversationReactionCoordinator({clock:()=>now,request:()=>true});c.configure({gestures:true});
 c.event('request-start',{requestId:1});c.event('manual');c.event('answer',{requestId:1,reaction:'agree'});
 assert.equal(c.lastDecision.reason,'manual_action_priority');
 c.event('request-start',{requestId:2,ttlMs:1000});now=1000;c.event('answer',{requestId:2,reaction:'agree'});
 assert.equal(c.lastDecision.reason,'request_expired');
 c.event('request-start',{requestId:3});c.event('cancel',{requestId:3});c.event('answer',{requestId:3,reaction:'agree'});
 assert.equal(c.lastDecision.reason,'request_cancelled_or_stale');
 for(let id=4;id<=60;id++){c.event('request-start',{requestId:id});c.event('answer',{requestId:id,reaction:'neutral'});}
 assert.equal(c.diagnostics.length,32);
 const overlay=new ConversationReactionCoordinator({clock:()=>now,request:()=>true});overlay.configure({gestures:true});
 const start={version:1,source:'fixture',seq:1,kind:'request-start',requestId:1,issuedAt:1000,ttlMs:120000};
 assert.ok(overlay.receive(start,1000));
 const answer={...start,seq:2,kind:'answer',reaction:'agree',ttlMs:5000};
 assert.ok(overlay.receive(answer,1000));assert.equal(overlay.lastAnswerReaction,'agree');
 assert.equal(overlay.crossWindowStatus,'cross_window_accepted');
 assert.equal(overlay.receive(answer,1000),false);assert.equal(overlay.crossWindowStatus,'cross_window_cue_rejected');
 assert.equal(overlay.receive({...answer,seq:3},6000),false);
});
test('V6.2.3 eligible repeated agreement starts twice without a neutral reply',()=>{
 let now=0;const calls=[],c=new ConversationReactionCoordinator({clock:()=>now,request:a=>{calls.push(a);return true;}});
 c.configure({gestures:true});
 for(const id of [1,2]){c.event('request-start',{requestId:id});c.event('answer',{requestId:id,reaction:'agree'});now=15000;}
 assert.deepEqual(calls,['nod','nod']);
});
test('V6.2.3 rejected dispatch has explicit reason and no accepted cue or cooldown',()=>{
 const c=new ConversationReactionCoordinator({clock:()=>0,request:()=>false});c.configure({gestures:true});
 c.event('request-start',{requestId:1});c.event('answer',{requestId:1,reaction:'agree'});
 assert.equal(c.lastAnswerReaction,'neutral');assert.equal(c.cooldowns.agree,undefined);
 assert.equal(c.lastDecision?.reason,'controller_rejected');
});
test('V6.2.3 repeats after bounded cooldown without neutral; running/disabled/rejected reasons',()=>{
 let now=0,running=false,accept=true;const calls=[];
 const c=new ConversationReactionCoordinator({clock:()=>now,playing:()=>running,request:a=>{if(accept)calls.push(a);return accept;}});
 c.configure({gestures:true});
 const answer=(id,time)=>{now=time;c.event('request-start',{requestId:id});c.event('answer',{requestId:id,reaction:'agree',modelReaction:'agree'});return c.lastDecision;};
 assert.equal(answer(1,0).reason,'accepted_and_started');
 running=true;assert.equal(answer(2,3000).reason,'already_playing');
 running=false;assert.equal(answer(3,8000).reason,'reaction_cooldown');
 assert.equal(answer(4,15000).reason,'accepted_and_started');assert.deepEqual(calls,['nod','nod']);
 now=30000;accept=false;assert.equal(answer(5,now).reason,'controller_rejected');
 accept=true;assert.equal(answer(6,now+1).reason,'accepted_and_started');
 c.configure({gestures:false});assert.equal(answer(7,50000).reason,'automatic_gestures_disabled');
 assert.equal(c.lastAnswerReaction,'neutral');assert.equal(c.lastDecision.requestId,7);
 assert.ok(!JSON.stringify(c.diagnostics).includes('reply'));
});

test('all presentational intents parse; unsafe metadata stays neutral',()=>{
 for(const reaction of REACTIONS)assert.equal(parseReply(JSON.stringify({reply:'Text',reaction})).reaction,reaction);
 for(const reaction of ['exec',{},null,42])assert.equal(parseReply(JSON.stringify({reply:'Text',reaction})).reaction,'neutral');
 assert.equal(parseReply('ordinary text').reaction,'neutral');
 assert.equal(parseReply('```json\n{"reply":"OK","reaction":"agree"}\n```').reaction,'agree');
 assert.equal(parseReply('{"reply":"Safe","reaction":"agree","tools":["shell"]}').reply,'Safe');
 assert.equal(parseReply('{"reply":"Legacy","gesture":"nod"}').gesture,'nod');
 assert.equal(parseReply('<think>hidden</think>Answer').reply,'Answer');
 assert.throws(()=>parseReply('x'.repeat(131073)),/size/);
});
test('request cues last through full inference, stale/duplicate replies and manual suppression',()=>{
 let now=0,actions=[];
 const c=new ConversationReactionCoordinator({clock:()=>now,request:a=>{actions.push(a);return true;}});
 c.configure({gestures:true,effects:true,sleepy:true,quietSeconds:120});
 c.event('request-start',{requestId:1});
 for(now of [100,3200,30000,119000])assert.equal(c.sample().thinking,true);
 assert.equal(c.event('answer',{requestId:0,reaction:'agree'}),false);
 c.event('answer',{requestId:1,reaction:'agree'});assert.deepEqual(actions,['nod']);
 c.event('answer',{requestId:1,reaction:'agree'});assert.equal(actions.length,1);
 c.event('request-start',{requestId:2});c.event('manual');
 c.event('answer',{requestId:2,reaction:'disagree'});assert.equal(actions.length,1);
 c.event('request-start',{requestId:3});c.event('cancel',{requestId:3});assert.equal(c.sample().thinking,false);
});
test('quiet clock is deterministic, bounded, awake on interaction and inactive when off/hidden',()=>{
 let now=0;const c=new ConversationReactionCoordinator({clock:()=>now});
 c.configure({sleepy:true,quietSeconds:120});
 now=60000;assert.equal(c.sample().drowsiness,0);
 now=300000;assert.ok(c.sample().drowsiness>0);
 now=3600000;assert.ok(c.sample().drowsiness<=.8);
 c.event('activity');now+=250;assert.ok(c.sample().drowsiness>0);now+=3000;assert.equal(c.sample().drowsiness,0);
 c.event('window-hidden');now+=3600000;assert.equal(c.sample().drowsiness,0);
 c.event('visibility-resume');assert.equal(c.sample().drowsiness,0);
 c.configure({sleepy:false});now+=3600000;assert.equal(c.sample().drowsiness,0);
});
test('small cues refuse raw data, invalid values and expiry, deduplicate per request',()=>{
 const cue={version:1,source:'session-1',seq:1,kind:'request-start',requestId:1,issuedAt:100,ttlMs:120000};
 assert.ok(validateCue(cue,101));
 for(const invalid of [{...cue,reply:'private'},{...cue,ttlMs:Infinity},{...cue,kind:'exec'},{...cue,issuedAt:999999}])assert.equal(validateCue(invalid,101),null);
 assert.equal(validateCue(cue,120101),null);
 const c=new ConversationReactionCoordinator({clock:()=>0});
 assert.equal(c.receive(cue,101),true);assert.equal(c.receive(cue,102),false);
});
test('shake is canonical and transition positions stay continuous for all finite channels',()=>{
 assert.ok(ACTIONS.includes('shake'));assert.equal(ACTIONS.filter(a=>a==='shake').length,1);
 for(const from of ['shake','think','shrug','read','sit','eat']){
  const c=new BehaviorController();c.request(from);for(let i=0;i<80;i++)c.update(1/60);
  const before={...c.pose()};c.request(from==='shake'?'idle':'shake');const after=c.pose();
  for(const key of POSE_KEYS){assert.ok(Number.isFinite(after[key]));assert.ok(Math.abs(after[key]-before[key])<.00001,from+' '+key);}
  for(let i=0;i<300;i++){c.update(1/60);for(const value of Object.values(c.pose()))assert.ok(Number.isFinite(value));}
 }
});

test('V6.2.2 expired replies are rejected even without sampling a frame',()=>{
 let now=0;const calls=[],c=new ConversationReactionCoordinator({clock:()=>now,request:a=>{calls.push(a);return true;}});
 c.configure({gestures:true,effects:true});c.event('request-start',{requestId:1,ttlMs:1000});now=1000;
 assert.equal(c.event('answer',{requestId:1,reaction:'agree'}),false);
 assert.deepEqual(calls,[]);assert.equal(c.sample().thinking,false);
});
test('V6.2.2 cancellation, model switch, hidden, close and new manual request invalidate late cues',()=>{
 for(const ending of ['cancel','clear','model-change','window-hidden','window-closed']){
  const calls=[],c=new ConversationReactionCoordinator({request:a=>{calls.push(a);return true;}});
  c.configure({gestures:true});c.event('request-start',{requestId:1});c.event(ending,{requestId:1});
  assert.equal(c.event('answer',{requestId:1,reaction:'disagree'}),false,ending);
  assert.deepEqual(calls,[]);assert.equal(c.sample().thinking,false);
 }
 const calls=[],c=new ConversationReactionCoordinator({request:a=>{calls.push(a);return true;}});
 c.event('request-start',{requestId:1});c.event('cancel',{requestId:1});
 assert.equal(c.event('direct-action',{action:'walk',requestId:2}),true);
 assert.equal(c.event('request-start',{requestId:1}),false);
 assert.equal(c.event('direct-action',{action:'run',requestId:1}),false);
 assert.equal(c.event('answer',{requestId:1,reaction:'agree'}),false);
 assert.deepEqual(calls,['walk']);c.dispose();
 assert.equal(c.event('request-start',{requestId:3}),false);
});
test('V6.2.2 only accepted answer reactions may be relayed to the overlay',()=>{
 let now=0,accepted=false;
 const c=new ConversationReactionCoordinator({clock:()=>now,request:()=>accepted});c.configure({gestures:true,effects:true});
 c.event('request-start',{requestId:1});c.event('answer',{requestId:1,reaction:'agree'});
 assert.equal(c.lastAnswerReaction,'neutral');
 accepted=true;c.event('request-start',{requestId:2});c.event('answer',{requestId:2,reaction:'agree'});
 assert.equal(c.lastAnswerReaction,'agree');
 c.event('request-start',{requestId:3});c.event('answer',{requestId:3,reaction:'agree'});
 assert.equal(c.lastAnswerReaction,'neutral');
 now=15000;c.event('request-start',{requestId:4});c.event('manual');c.event('answer',{requestId:4,reaction:'insight'});
 assert.equal(c.lastAnswerReaction,'neutral');assert.equal(c.sample().bulbAge,Infinity);
});
