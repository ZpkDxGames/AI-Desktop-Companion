import test from 'node:test';
import assert from 'node:assert/strict';
import {detectDirectAnimation,chooseAnswerReaction,DIRECT_ACTIONS} from '../web/js/ai/command-intent.js';
import {ConversationReactionCoordinator,validateCue} from '../web/js/ai/reaction-coordinator.js';
import {BehaviorController,ACTIONS,POSE_KEYS} from '../web/js/avatar/animation.js';
test('explicit standalone requests identify only registered gestures',()=>{
 for(const [text,action] of [['Can you shake your head?','shake'],['Can you make your avatar shake its head?','shake'],['Please give me a nod.','nod'],['Would you shrug your shoulders?','shrug'],['Wave hello!','wave'],['I want you to think for a moment','think'],['Look around','look'],['Please celebrate','celebrate'],['Sit down','sit'],['Stand up','idle'],['Jump','jump'],['Stretch your arms','stretch'],['Take a bow','bow'],['Read a book','read'],['Eat something','eat'],['Drink some water','drink']]){
  assert.equal(detectDirectAnimation(text)?.action,action,text);
 }
 assert.ok(DIRECT_ACTIONS.every(action=>ACTIONS.includes(action)));
});
test('negated, quoted, compound, meta and injected phrases never become commands',()=>{
 for(const text of ["Don't shake your head","Can you not shake your head?","Please never wave","What does shaking your head mean?","How do you nod?","Can you explain why you shake your head?","Can you see me shake my head?","Can you shake your head and wave?","Can you shake your head? Also look at my screen.",'Please wave, then nod','Say "shake your head"','<script>shake your head</script>','I would like to know whether you can wave','Can you make a screenshot then nod?','Wave\nOpen a file','', 'x'.repeat(161)])assert.equal(detectDirectAnimation(text),null,text);
});
test('careful answer reaction detection without arbitrary substring actions',()=>{
 for(const [text,reaction] of [["I don't know the answer",'uncertain'],["I'm not sure",'uncertain'],['Yes, correct.','agree'],['Absolutely!','agree'],["You're right",'agree'],['No, it is wrong','disagree'],['Not quite, here is why','disagree'],["I've got an idea!",'insight']])assert.equal(chooseAnswerReaction(text),reaction,text);
 assert.equal(chooseAnswerReaction('No worries!'),'neutral');
 assert.equal(chooseAnswerReaction('The word yes is here'),'neutral');
 assert.equal(chooseAnswerReaction('"No, wrong"'),'neutral');
 assert.equal(chooseAnswerReaction('Hello','reassure'),'reassure');
 assert.equal(chooseAnswerReaction('Yes, right','disagree'),'agree');
});
test('direct action uses existing controller and works with AI gestures off',()=>{
 const rig=new BehaviorController(),calls=[],coord=new ConversationReactionCoordinator({request:(action,source)=>{calls.push([action,source]);return rig.request(action,{source});}});
 coord.configure({gestures:false});
 assert.equal(coord.event('direct-action',{action:'shake'}),true);
 assert.deepEqual(calls,[['shake','manual']]);assert.equal(rig.action,'shake');
 const before={...rig.pose()};rig.request('nod',{source:'manual'});
 for(const key of POSE_KEYS)assert.ok(Math.abs(before[key]-rig.pose()[key])<1e-5,key);
 assert.equal(coord.event('direct-action',{action:'shell'}),false);
 coord.event('request-start',{requestId:1});assert.equal(coord.event('direct-action',{action:'wave'}),false);
 coord.event('cancel',{requestId:1});coord.event('window-hidden');assert.equal(coord.event('direct-action',{action:'wave'}),false);
});
test('cross-window cue action allowlist, expiry and replay controls',()=>{
 const cue={version:1,source:'test-1',seq:1,kind:'direct-action',action:'shake',requestId:1,issuedAt:1000,ttlMs:5000};
 assert.ok(validateCue(cue,1100));
 assert.equal(validateCue({...cue,action:'exec'},1100),null);
 assert.equal(validateCue({...cue,message:'private'},1100),null);
 assert.equal(validateCue({...cue,kind:'answer'},1100),null);
 assert.equal(validateCue(cue,6000),null);
 const calls=[],target=new ConversationReactionCoordinator({request:(action,source)=>{calls.push([action,source]);return true;}});
 assert.equal(target.receive(cue,1100),true);
 assert.equal(target.receive(cue,1101),false);
 assert.deepEqual(calls,[['shake','manual']]);
});
