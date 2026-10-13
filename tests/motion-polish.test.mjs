import test from 'node:test';
import assert from 'node:assert/strict';
import {BehaviorController,ACTIONS,DURATION} from '../web/js/avatar/animation.js';
import {applyLifeLayer,drift,easeInOutBack,easeOutBack,smootherstep,LIFE_WEIGHT} from '../web/js/avatar/motion-polish.js';
import {FramePacer} from '../web/js/runtime/frame-pacing.js';

const KEYS=['headX','headY','headZ','bodyX','bodyY','bodyZ','armRX','armLX','armRZ','armLZ','legRX','legLX','legRZ','legLZ','rootY','rootX','rootZ','rootYaw','breath'];
const FRAME=1/60;
const run=(c,seconds,dt=FRAME,sink)=>{for(let i=0,n=Math.round(seconds/dt);i<n;i++){c.update(dt);const p=c.pose();if(sink)sink(p,i);}};
const snap=p=>Object.fromEntries(KEYS.map(k=>[k,p[k]]));
const settled=(seed=11)=>{const c=new BehaviorController({seed});run(c,1.3);return c;};

test('every pose channel is exposed, finite and defined for every action',()=>{
 for(const action of ACTIONS){
  const c=settled();c.request(action);
  run(c,(DURATION[action]||3)+.5,FRAME,p=>{for(const k of KEYS)assert.ok(Number.isFinite(p[k]),`${action}.${k}`);});
 }
});

test('changing action is position-continuous for every action pair, including re-triggering the same action',()=>{
 for(const from of ACTIONS){
  if(from==='sit')continue;
  for(const to of ACTIONS){
   if(to==='sit')continue;
   const c=settled();c.request(from);run(c,.7);
   const before=snap(c.pose());
   if(!c.request(to))continue;
   const after=c.pose();
   for(const k of KEYS)assert.ok(Math.abs(before[k]-after[k])<1e-6,`${from}->${to} snapped ${k}: ${before[k]} -> ${after[k]}`);
  }
 }
});

test('transitions are velocity-continuous: no acceleration spike larger than authored gestures produce',()=>{
 // Second difference per 60 Hz frame. A velocity snap of 8 rad/s would register as .13 here.
 // The previous cross-fade peaked at .12 on stretch->bow, so this must not regress past that.
 const rot=['headX','headY','headZ','bodyX','bodyY','bodyZ','armRX','armLX','armRZ','armLZ','legRX','legLX','legRZ','legLZ'];
 for(const [from,to] of [['wave','idle'],['walk','run'],['run','idle'],['idle','celebrate'],['think','nod'],['stretch','bow'],['look','read'],['idle','walk'],['jump','idle']]){
  const c=settled();c.request(from);run(c,.9);c.request(to);
  let p1=snap(c.pose()),p0=p1,worst=0,worstKey='';
  run(c,.6,FRAME,p=>{for(const k of rot){const d=Math.abs(p[k]-2*p1[k]+p0[k]);if(d>worst){worst=d;worstKey=k;}}p0=p1;p1=snap(p);});
  assert.ok(worst<.13,`${from}->${to} acceleration spike ${worst.toFixed(3)} rad/frame^2 on ${worstKey}`);
 }
});

test('transition offset relaxes to zero so authored poses are reached exactly',()=>{
 const c=settled();c.request('celebrate');run(c,1);c.request('idle');run(c,2);
 for(const k of KEYS)assert.ok(Math.abs(c.offset[k])<2e-3,`${k} offset ${c.offset[k]}`);
});

test('interrupted-in-flight actions stay finite and never leave residual offset',()=>{
 const c=settled(5);
 const order=['wave','jump','celebrate','walk','bow','think','stretch','run','idle'];
 for(let i=0;i<45;i++){c.request(order[i%order.length]);run(c,.11);for(const k of KEYS)assert.ok(Number.isFinite(c.pose()[k])&&Math.abs(c.pose()[k])<12);}
 c.request('idle');run(c,3);
 for(const k of KEYS)assert.ok(Math.abs(c.offset[k])<2e-3);
});

test('idle has continuous life: breathing, sway and head drift stay bounded and never loop exactly',()=>{
 const c=settled();
 const seen={breath:[1,0],rootX:[1,-1],headY:[1,-1]};
 const samples=[];
 run(c,90,FRAME,p=>{for(const k of Object.keys(seen)){seen[k][0]=Math.min(seen[k][0],p[k]);seen[k][1]=Math.max(seen[k][1],p[k]);}samples.push(p.headY);});
 assert.ok(seen.breath[1]-seen.breath[0]>.5,'chest must visibly breathe');
 assert.ok(seen.breath[0]>=-.01&&seen.breath[1]<=1.1);
 assert.ok(seen.rootX[1]-seen.rootX[0]>.1&&seen.rootX[1]-seen.rootX[0]<.6,'weight shift is noticeable but small');
 assert.ok(seen.headY[1]-seen.headY[0]>.05&&Math.max(Math.abs(seen.headY[0]),Math.abs(seen.headY[1]))<.2,'head drift bounded');
 // a pure periodic signal would repeat; compare the first and a later window.
 const a=samples.slice(0,600),b=samples.slice(1800,2400);
 const diff=a.reduce((s,v,i)=>s+Math.abs(v-b[i]),0)/a.length;
 assert.ok(diff>.004,'idle motion repeats too exactly');
});

test('drift() stays within [-1,1] and life layer keeps channels inside safe limits',()=>{
 for(let t=0;t<400;t+=.37){const d=drift(t,2.2);assert.ok(d>=-1&&d<=1);}
 const p={};
 for(let t=0;t<200;t+=.21){applyLifeLayer(p,t,1);for(const k of KEYS)if(k!=='breath')assert.ok(Number.isFinite(p[k])&&Math.abs(p[k])<.5,k);assert.ok(p.breath>=-.05&&p.breath<=1.1,'breath');}
 assert.ok(Object.keys(LIFE_WEIGHT).every(a=>ACTIONS.includes(a)),'LIFE_WEIGHT only names real actions');
 assert.ok(ACTIONS.every(a=>a in LIFE_WEIGHT),'every action has an explicit life weight');
});

test('easing helpers: endpoints exact, overshoot only where designed',()=>{
 for(const f of [smootherstep,easeOutBack,easeInOutBack]){assert.ok(Math.abs(f(0))<1e-9);assert.ok(Math.abs(f(1)-1)<1e-9);}
 let over=0;for(let t=0;t<=1;t+=.01)over=Math.max(over,easeOutBack(t));
 assert.ok(over>1.005&&over<1.15,'follow-through overshoot present but small');
 let dip=0;for(let t=0;t<=.4;t+=.01)dip=Math.min(dip,easeInOutBack(t));
 assert.ok(dip<-.005&&dip>-.1,'anticipation dip present but small');
 assert.equal(smootherstep(-1),0);assert.equal(smootherstep(2),1);
});

test('jump reads as crouch, push-off, parabolic flight and compressed landing',()=>{
 const c=settled();c.request('jump');
 const y=[];run(c,DURATION.jump+.05,FRAME,p=>y.push(p.rootY));
 const crouchEnd=Math.round(.2*60);
 assert.ok(Math.min(...y.slice(0,crouchEnd+2))<-1,'anticipation crouch before takeoff');
 assert.ok(Math.max(...y)>3.4&&Math.max(...y)<5.6,'peak height');
 const landing=y.slice(Math.round(.75*60),Math.round(.93*60));
 assert.ok(Math.min(...landing)<-.8,'landing compresses');
 for(let i=1;i<y.length;i++)assert.ok(Math.abs(y[i]-y[i-1])<1.25,`rootY stepped ${Math.abs(y[i]-y[i-1]).toFixed(2)} at frame ${i}`);
 assert.ok(Math.abs(y[y.length-1])<.6,'returns to ground');
});

test('walk bob is highest when the legs pass, not at full stride',()=>{
 const c=settled();c.request('walk');run(c,1.5);
 const rows=[];run(c,2,FRAME,p=>rows.push({y:p.rootY,spread:Math.abs(p.legRX-p.legLX)}));
 const lo=rows.filter(r=>r.spread<.12),hi=rows.filter(r=>r.spread>1.1);
 assert.ok(lo.length>3&&hi.length>3);
 const mean=a=>a.reduce((s,r)=>s+r.y,0)/a.length;
 assert.ok(mean(lo)>mean(hi),'body should be higher at passing than at double support');
});

test('micro-motion is deterministic per seed and never disturbs seeded idle scheduling',()=>{
 const a=new BehaviorController({seed:99}),b=new BehaviorController({seed:99});
 a.setIdleMode('lively');b.setIdleMode('lively');
 for(let i=0;i<1800;i++){a.update(.05);b.update(.05);assert.equal(a.action,b.action);assert.deepEqual(a.eyeGaze,b.eyeGaze);}
 assert.deepEqual(snap(a.pose()),snap(b.pose()));
});

test('saccades move the eyes slightly but never keep the renderer awake or leave [-1,1]',()=>{
 const c=settled();
 let moved=false;
 run(c,30,FRAME,()=>{
  assert.ok(Math.abs(c.eyeGaze[0])<=1&&Math.abs(c.eyeGaze[1])<=1);
  assert.ok(Math.abs(c.eyeGaze[0]-c.gaze[0])<.1&&Math.abs(c.eyeGaze[1]-c.gaze[1])<.07);
  if(Math.abs(c.eyeGaze[0]-c.gaze[0])>.004)moved=true;
  assert.equal(c.gazeMoving(),false,'saccades must not count as active gaze motion');
 });
 assert.ok(moved,'eyes should wander');
 c.setGaze(.9,-.5);run(c,1.2);
 assert.ok(c.eyeGaze[0]>.75&&c.eyeGaze[1]<-.4,'pointer tracking still dominates');
});

test('double blinks stay inside the normal blink envelope',()=>{
 const c=settled(21);let blinks=0,prev=0,max=0;
 run(c,120,FRAME,()=>{max=Math.max(max,c.blink);assert.ok(c.blink>=0&&c.blink<=1);if(prev===0&&c.blink>0)blinks++;prev=c.blink;});
 assert.equal(max,1);
 assert.ok(blinks>=14&&blinks<=60,`implausible blink count ${blinks}`);
});

test('FramePacer defaults remain 60/20 for existing callers',()=>{
 const pacer=new FramePacer();let n=0;
 for(let i=0;i<=144;i++)if(pacer.ready(i*1000/144,true))n++;
 assert.ok(n>=58&&n<=62);
});
