import test from 'node:test';
import assert from 'node:assert/strict';
import {BehaviorController} from '../web/js/avatar/animation.js';
import {sampleTimeline} from '../web/js/avatar/activity-timelines.js';
import {AvatarProps} from '../web/js/engine/avatar-props.js';
import {AvatarEffects} from '../web/js/engine/avatar-effects.js';
import {Group} from 'three';

const tick=(controller,seconds)=>{for(let i=0;i<Math.ceil(seconds/.05);i++){controller.update(.05);controller.pose();}};
const skin=()=>({body:new Group(),rightArm:new Group(),leftArm:new Group(),head:new Group()});

test('reading phases include opening, a physical page flip and closing',()=>{
 const state={};
 assert.equal(sampleTimeline('read',.05,state).phase,'enter');
 assert.equal(sampleTimeline('read',1,state).phase,'open');
 const half=sampleTimeline('read',5.05,state);
 assert.equal(half.phase,'pageTurn');
 assert.ok(half.pageAngle<-.2 && half.pageAngle>-3,'page must rotate across book spine');
 assert.equal(sampleTimeline('read',11.4,state).phase,'close');
});
test('food variants are seeded, stable per action and from the required set',()=>{
 const a=new BehaviorController({seed:1234}),b=new BehaviorController({seed:1234});
 const allowed=['cooked_porkchop','apple','golden_carrot','cake_slice'];
 for(let n=0;n<25;n++){
  a.request('idle');b.request('idle');a.request('eat');b.request('eat');
  assert.ok(allowed.includes(a.foodVariant));
  assert.equal(a.foodVariant,b.foodVariant);
  const selected=a.foodVariant;tick(a,.6);assert.equal(a.foodVariant,selected);
 }
});
test('seated gestures request stand-up and execute latest intent without snapping',()=>{
 const c=new BehaviorController();
 c.request('sit');tick(c,1);
 assert.equal(c.sitPhase,'seated');
 assert.ok(c.pose().rootY< -3);
 assert.equal(c.request('wave'),true);
 assert.equal(c.sitPhase,'standingUp');
 tick(c,1);
 assert.equal(c.action,'wave');
 assert.ok(Math.abs(c.pose().rootY)<3);
});
test('book, food, drink props share the rig but use articulated cached geometry',()=>{
 const s=skin(),props=new AvatarProps(s);
 assert.ok(props.turningPage?.rotation,'book requires physical hinged page');
 assert.ok(props.foodVariants?.length===4,'all food variants are cached at construction');
 const first=props.turningPage;
 props.update('read',5.05,.05);
 assert.strictEqual(props.turningPage,first);
 assert.ok(Math.abs(first.rotation.y)>.2);
 props.update('idle',0,.05);
 assert.equal(props.book.visible,false);
 props.dispose();
});
test('effects use a bounded preallocated pool and never instantiate per update',()=>{
 const s=skin(),root=new Group(),effects=new AvatarEffects(root);
 assert.ok(effects.capacity<=64);
 const initial=effects.particles;
 for(let n=0;n<100;n++)effects.update('celebrate',.4+n*.001,.05);
 assert.strictEqual(effects.particles,initial);
 effects.update('idle',0,.05);
 assert.equal(effects.bubble.visible,false);
 effects.dispose();
 assert.equal(root.children.length,0);
});
