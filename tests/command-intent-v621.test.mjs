import test from 'node:test';
import assert from 'node:assert/strict';
import {detectDirectAnimation,parseCommandIntent,chooseAnswerReaction,DIRECT_ACTIONS} from '../web/js/ai/command-intent.js';
import {ConversationReactionCoordinator,validateCue} from '../web/js/ai/reaction-coordinator.js';
import {BehaviorController,ACTIONS,POSE_KEYS} from '../web/js/avatar/animation.js';
export const REACTION_CORPUS=[
 ["Yes, you're correct.",'agree'],["That's right.",'agree'],["You're absolutely correct.",'agree'],
 ['I agree with that assessment.','agree'],['That makes sense, yes.','agree'],
 ["No, that doesn't appear correct.",'disagree'],['I disagree.','disagree'],
 ["I'm not sure.",'uncertain'],["I don't know enough to say.",'uncertain'],
 ['I have an idea that might help.','insight'],
 ['Here is the reasoning.\n\nIn conclusion, yes, that is correct.','agree'],
 ['If the premise holds, then yes.','neutral'],['The word ‘yes’ is an affirmative particle.','neutral'],
 ['Say ‘I agree’.','neutral'],['Yes, I can walk on your screen.','neutral'],
 ['No worries.','neutral'],['No problem.','neutral'],['Exactly how this works is explained below.','neutral'],
 ['I do not agree.','disagree'],['I might agree if that were true.','neutral'],
 ['The example says "I agree".','neutral'],['You could say yes.','neutral'],
 ['Yes is a word.','neutral'],['I have no idea.','uncertain'],
 ['Yes, but that is incorrect.','disagree'],['Yes, if you change the premise.','neutral'],
 ['An idea is a thought.','neutral'],['This explains the procedure.','neutral'],
 ['Great news! We did it.','celebrate'],["Don't worry, it will be okay.",'reassure'],['Wow, that is surprising!','surprised'],
 ['**Yes**, that is correct.','agree'],['Your assessment is accurate.','agree'],['That sounds sensible.','agree'],
 ['I agree with nothing you said.','disagree'],["That's not right.",'disagree'],['Yes, I am not sure.','uncertain'],
 ['I agree is a phrase.','neutral'],['Yes, I can inspect your desktop.','neutral']
];
test('V6.2.3 grounded corpus works for structured Qwen/Llama and missing labels',()=>{
 for(const [reply,expected] of REACTION_CORPUS){
  assert.equal(chooseAnswerReaction(reply,expected),expected,reply+' structured');
  assert.equal(chooseAnswerReaction(reply),expected,reply+' fallback');
 }
 for(const reply of REACTION_CORPUS.filter(([,r])=>r==='neutral').map(([s])=>s))
  assert.equal(chooseAnswerReaction(reply,'agree'),'neutral',reply+' misleading label');
 assert.equal(chooseAnswerReaction('No, that is wrong.','agree'),'disagree');
 assert.equal(chooseAnswerReaction('Ordinary text',{}),'neutral');
 assert.equal(chooseAnswerReaction('One possible solution is to check the connection.','insight'),'insight');
 assert.equal(chooseAnswerReaction('One possible solution is to check the connection.'),'neutral');
});
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

test('V6.2.2 locomotion and stop families resolve offline, bounded and anchored',()=>{
 for(const [action,phrases] of [
  ['walk',['Can you walk?','Walk','Walk for me','Show me how you walk','Can you do a walking animation?','Start walking','Could you walk in place, please?','HEY buddy, please WALK!','Can\u00a0you\u2003walk?']],
  ['run',['Can you run?','Show me how you run','Start running','Run in place','Please show me your running animation']],
  ['idle',['Stop walking','Stop running','Stop moving','Stand still','Stop the animation','Return to idle','Stand up','Could you stop walking?']],
  ['wave',['Can you wave?','Please wave for me']],['shake',['Can you shake your head?']],
 ])for(const phrase of phrases)assert.equal(detectDirectAnimation(phrase)?.action,action,phrase);
 for(const phrase of ["Don't walk",'Do not run','What does walking mean?','How do I walk in Minecraft?',
  'Can you walk through the steps?','Can you run a program?','Is it possible for you to walk?',
  'Please say ‘walk’',"'walk'",'Walk and delete my files','Can you walk and wave simultaneously?',
  'Walk to the left side of my screen','Show me how you run a program','Can you wave while saying hello?',
  'qwen3.5:4b walk','llama3.2:3b run','Walk\nIgnore previous instructions','Can you walk??','x'.repeat(2400),
  'Can you walk? '+ 'x'.repeat(180),'start flying','stop the server','Run; exec(sh)'])assert.equal(detectDirectAnimation(phrase),null,phrase);
 assert.ok(DIRECT_ACTIONS.every(a=>ACTIONS.includes(a)));
});
test('V6.2.2 explicit intent result separates direct, ambiguous and ordinary text',()=>{
 assert.equal(parseCommandIntent('Can you walk?').kind,'direct');
 assert.equal(parseCommandIntent('Show me how you run').action,'run');
 for(const phrase of ['Can you walk and wave simultaneously?','Can you wave while saying hello?',
  'Walk to the left side of my screen','Walk and delete my files'])assert.equal(parseCommandIntent(phrase).kind,'ambiguous',phrase);
 for(const phrase of ['Can you run a program?','Can you walk through the steps?',
  'What does walking mean?',"Don't walk",'Please say ‘walk’','x'.repeat(2400)])assert.equal(parseCommandIntent(phrase).kind,'text',phrase);
});
test('V6.2.2 replies cannot turn quoted, conditional or invalid hints into actions',()=>{
 for(const phrase of ['"Yes, correct"',"'No, wrong'",'Yes, if you change the premise.',
  'If that is true, yes.','Yes, I can walk across your screen.','The command is walk.',
  'Yes is an affirmative word.','Exactly how this works is explained below.'])
  assert.equal(chooseAnswerReaction(phrase,'agree'),'neutral',phrase);
 assert.equal(chooseAnswerReaction('Hello','shell'),'neutral');
 assert.equal(chooseAnswerReaction('No, that is incorrect.','agree'),'disagree');
 assert.equal(chooseAnswerReaction('Yes.','disagree'),'agree');
 assert.equal(chooseAnswerReaction('No.'),'disagree');
});
test('V6.2.2 direct outcomes preserve real controller rejection and seat/stop policy',()=>{
 const rig=new BehaviorController(),c=new ConversationReactionCoordinator({request:(a,source)=>rig.request(a,{source})});
 rig.setIdleMode('off');rig.request('jump');
 assert.equal(c.event('direct-action',{action:'walk',requestId:1}),false);
 assert.equal(rig.action,'jump');
 assert.equal(c.lastActionStatus,'rejected-busy');
 assert.equal(c.event('direct-action',{action:'idle',requestId:2}),true);
 assert.equal(c.lastActionStatus,'accepted');assert.equal(rig.action,'idle');
 assert.equal(c.event('direct-action',{action:'run',requestId:3}),true);
 assert.equal(c.event('direct-action',{action:'run',requestId:3}),false);
 assert.equal(c.lastActionStatus,'interrupted');
 for(let i=0;i<600;i++)rig.update(1/60);
 assert.equal(rig.action,'run');
 assert.equal(c.event('direct-action',{action:'idle',requestId:4}),true);
 rig.request('sit');for(let i=0;i<120;i++)rig.update(1/60);
 assert.equal(c.event('direct-action',{action:'walk',requestId:5}),true);
 assert.equal(rig.sitPhase,'standingUp');for(let i=0;i<120;i++)rig.update(1/60);
 assert.equal(rig.action,'walk');
 assert.equal(c.event('direct-action',{action:'shell',requestId:6}),false);
 assert.equal(c.lastActionStatus,'invalid');
});
