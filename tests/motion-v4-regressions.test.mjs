import test from 'node:test';
import assert from 'node:assert/strict';
import {BehaviorController} from '../web/js/avatar/animation.js';

const advance=(c,seconds,dt=1/120)=>{
 for(let t=0;t<seconds-1e-9;t+=dt)c.update(Math.min(dt,seconds-t));
};
test('manual wave retrigger preserves the visible pose',()=>{
 const c=new BehaviorController({seed:42});advance(c,1);
 c.request('wave');advance(c,.7);const before={...c.pose()};
 c.request('wave');const after=c.pose();
 for(const key of Object.keys(before))assert.ok(Math.abs(before[key]-after[key])<1e-7,`${key} snapped`);
});
test('jump prepares its weight before leaving the ground',()=>{
 const c=new BehaviorController();c.request('jump');advance(c,.16);
 assert.ok(c.pose().rootY<-.5,'missing crouch anticipation');
});
test('bow involves the chest, rather than only the neck',()=>{
 const c=new BehaviorController();c.request('bow');advance(c,.8);
 assert.ok(c.pose().bodyX>.18,'missing waist/chest coordination');
});
test('walking rises at leg passing and settles at wide double support',()=>{
 const c=new BehaviorController();c.request('walk');advance(c,1);
 let pass=0,wide=0,np=0,nw=0;
 for(let i=0;i<360;i++){
  c.update(1/120);const p=c.pose(),spread=Math.abs(p.legRX-p.legLX);
  if(spread<.12){pass+=p.rootY;np++;}
  if(spread>1.1){wide+=p.rootY;nw++;}
 }
 assert.ok(np>5&&nw>5);assert.ok(pass/np>wide/nw,'bob has wrong footfall phase');
});
