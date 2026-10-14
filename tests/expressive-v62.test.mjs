import test from 'node:test';
import assert from 'node:assert/strict';
import {ConversationReactionCoordinator,validateCue} from '../web/js/ai/reaction-coordinator.js';
import {parseReply,REACTIONS} from '../web/js/ai/local-conversation.js';
import {BehaviorController,ACTIONS,POSE_KEYS} from '../web/js/avatar/animation.js';

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
