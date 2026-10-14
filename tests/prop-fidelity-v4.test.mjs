import test from 'node:test';
import assert from 'node:assert/strict';
import {BehaviorController} from '../web/js/avatar/animation.js';
import {sampleTimeline} from '../web/js/avatar/activity-timelines.js';
import {AvatarProps} from '../web/js/engine/avatar-props.js';
import {SkinObject} from 'skinview3d';
import {AvatarRig} from '../web/js/engine/avatar-rig.js';
import {AvatarEffects} from '../web/js/engine/avatar-effects.js';
import {FALLBACK_ITEMS} from '../web/js/engine/item-models.js';
import {Matrix4,Vector3,Group} from 'three';
const tick=(c,t)=>{for(let n=0;n<Math.round(t*120);n++)c.update(1/120);};

test('reading settles into supported floor sitting and turns pages ten seconds apart',()=>{
 const c=new BehaviorController();c.request('read');tick(c,2);
 assert.equal(c.sitPhase,'seated');assert.ok(c.pose().rootY<-9);assert.ok(c.pose().legRX<-1.4);
 assert.equal(sampleTimeline('read',5,{}).phase,'readA');
 const a=sampleTimeline('read',11.1,{}),b=sampleTimeline('read',21.1,{});
 assert.equal(a.phase,'pageTurn');assert.equal(b.phase,'pageTurn');assert.ok(Math.abs(a.pageAngle-b.pageAngle)<1e-8);
 assert.ok(b.pageIndex>a.pageIndex);
});
test('reading pupils focus down on the pages while retaining a small pointer response',()=>{
 const c=new BehaviorController();c.request('read');tick(c,2);const neutral=c.eyeGaze[1];assert.ok(neutral<-.2);
 c.setGaze(.8,.8);tick(c,1);assert.ok(c.eyeGaze[1]>neutral&&c.eyeGaze[1]<0);assert.ok(c.eyeGaze[0]>.1);
});
test('food finishes by fading its sprite and bottle water drains monotonically during the sip',()=>{
 assert.equal(sampleTimeline('eat',4.65,{}).foodOpacity<.2,true);
 let last=1;
 for(let t=1;t<=3.2;t+=.01){const f=sampleTimeline('drink',t,{}).waterFill;assert.ok(Number.isFinite(f));assert.ok(f<=last+1e-8&&f>=0);last=f;}
 assert.ok(last<.001);
});
test('drink remains a cached volumetric vessel and foods have substantial side volume',()=>{
 const p=new AvatarProps(new SkinObject());
 assert.ok(p.bottle?.liquid);assert.ok(p.bottle?.surface);assert.ok(p.bottle?.shell);
 p.itemModels.get('apple').depth.geometry.computeBoundingBox();
 const box=p.itemModels.get('apple').depth.geometry.boundingBox;
 assert.ok(box.max.z-box.min.z>1.2);
 p.dispose();
});
test('volumetric bottle shell stays outside head/hat and jacket throughout sipping and interrupted recovery',()=>{
 for(const mode of ['default','slim'])for(const interrupt of [false,true]){
  const skin=new SkinObject();skin.modelType=mode;const props=new AvatarProps(skin),rig=new AvatarRig(),c=new BehaviorController();c.request('drink');
  for(let frame=0;frame<520;frame++){
   if(interrupt&&frame===180)c.request('idle');c.update(1/120);rig.apply(skin,c.pose());props.update(c.action,c.elapsed,1/120,c.presentation);skin.updateMatrixWorld(true);
   if(!props.drink.visible)continue;
   const head=new Matrix4().copy(skin.head.matrixWorld).invert(),body=new Matrix4().copy(skin.body.matrixWorld).invert();
   props.bottle.shell.traverse(node=>{if(!node.geometry)return;const a=node.geometry.attributes.position;
    for(let i=0;i<a.count;i++){
     const world=new Vector3().fromBufferAttribute(a,i).applyMatrix4(node.matrixWorld),h=world.clone().applyMatrix4(head),b=world.clone().applyMatrix4(body);
     assert.ok(!(Math.abs(h.x)<4.5&&h.y>-.5&&h.y<8.5&&Math.abs(h.z)<4.5),`head ${mode}/${frame}`);
     assert.ok(!(Math.abs(b.x)<4.25&&Math.abs(b.y)<6.25&&Math.abs(b.z)<2.25),`jacket ${mode}/${frame}`);
    }
   });
  }props.dispose();
 }
});
test('water surface stays level under tilt, drains to empty and keeps the same resources',()=>{
 const skin=new SkinObject(),props=new AvatarProps(skin),rig=new AvatarRig(),c=new BehaviorController();c.request('drink');const liquid=props.bottle.liquid,surface=props.bottle.surface,geometry=liquid.geometry;
 for(let n=0;n<300;n++){
  c.update(1/120);rig.apply(skin,c.pose());props.update(c.action,c.elapsed,1/120,c.presentation);skin.updateMatrixWorld(true);
  if(surface.visible){const normal=new Vector3(0,0,1).transformDirection(surface.matrixWorld);assert.ok(normal.y>.999999);}
  assert.strictEqual(props.bottle.liquid,liquid);assert.strictEqual(liquid.geometry,geometry);
 }
 assert.equal(props.bottle.fill,0);assert.equal(liquid.visible,false);props.dispose();
});
test('eating emits a bounded colored crumb pool, clears on idle and respects reduced motion',()=>{
 const root=new Group(),effects=new AvatarEffects(root),pool=effects.crumbs;
 for(let t=0;t<5;t+=1/120){effects.update('eat',t,1/120,sampleTimeline('eat',t,{}),FALLBACK_ITEMS.apple);assert.ok(pool.count<=16);assert.strictEqual(effects.crumbs,pool);}
 effects.update('eat',1.3,1/60,sampleTimeline('eat',1.3,{}),FALLBACK_ITEMS.apple);assert.ok(pool.count>0);assert.ok(pool.instanceColor);
 effects.setReducedMotion(true);effects.update('eat',1.3,1/60);assert.equal(pool.count,0);
 effects.setReducedMotion(false);effects.update('idle',0,1/60);assert.equal(pool.count,0);effects.dispose();assert.equal(root.children.length,0);
});
test('reading exit stands before the latest gesture, closes the book once and never reappears',()=>{
 const c=new BehaviorController();c.request('read');tick(c,11.1);const before={...c.pose()};c.request('wave');assert.equal(c.sitPhase,'standingUp');assert.deepEqual(c.pose(),before);
 tick(c,.35);assert.equal(c.presentation.visibility,0);c.request('bow');tick(c,.4);assert.equal(c.action,'bow');assert.equal(c.sitPhase,'standing');
 assert.equal(c.presentation.visibility,0);
 const done=new BehaviorController();done.request('read');tick(done,28);assert.equal(done.action,'idle');assert.equal(done.sitPhase,'standing');
});
