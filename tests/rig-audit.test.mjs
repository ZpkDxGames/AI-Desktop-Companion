import test from 'node:test';
import assert from 'node:assert/strict';
import {rigParts,cuboidTriangles} from '../web/js/avatar/rig.js';
import {facePlaneTriangles} from '../web/js/avatar/face.js';

const EPS=1e-5,axes=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
const dot=(a,b)=>a.reduce((s,n,i)=>s+n*b[i],0);
const near=(a,b)=>assert.ok(Math.abs(a-b)<EPS, 'expected '+a+' to equal '+b);
function triNormal(data,off){
 const a=data.slice(off,off+3),b=data.slice(off+8,off+11),c=data.slice(off+16,off+19);
 const u=b.map((n,i)=>n-a[i]),v=c.map((n,i)=>n-a[i]);
 return [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
}
const bounds=p=>p.size.map((v,i)=>[p.pivot[i]+p.center[i]-v/2,p.pivot[i]+p.center[i]+v/2]);

test('both triangles of all 6 faces of all 12 Classic/Slim skin layers point outward',()=>{
 for(const slim of [false,true])for(const part of rigParts(slim)){
  const data=cuboidTriangles(part);
  for(let face=0;face<6;face++)for(let triangle=0;triangle<2;triangle++){
   const off=(face*6+triangle*3)*8;
   assert.deepEqual(Array.from(data.slice(off+5,off+8)),axes[face],part.id);
   assert.ok(dot(triNormal(data,off),axes[face])>EPS,part.id+' face '+face+' triangle '+triangle);
  }
 }
});

test('base cuboid bounds and ground contact match 32-pixel vanilla Classic/Slim anatomy',()=>{
 for(const slim of [false,true]){
  const map=new Map(rigParts(slim).map(p=>[p.id,p]));
  const expected={
   body:[[-4,4],[12,24],[-2,2]],head:[[-4,4],[24,32],[-4,4]],
   rightArm:[[slim?-7:-8,-4],[12,24],[-2,2]],
   leftArm:[[4,slim?7:8],[12,24],[-2,2]],
   rightLeg:[[-4,0],[0,12],[-2,2]],leftLeg:[[0,4],[0,12],[-2,2]]
  };
  for(const [id,want] of Object.entries(expected)){
   const got=bounds(map.get(id));
   for(let axis=0;axis<3;axis++)for(let end=0;end<2;end++)near(got[axis][end],want[axis][end]);
  }
 }
});

test('hat, jacket, sleeves and trousers inflate symmetrically without drifting pivots',()=>{
 for(const slim of [false,true]){
  const map=new Map(rigParts(slim).map(p=>[p.id,p]));
  for(const id of ['body','head','rightArm','leftArm','rightLeg','leftLeg']){
   const base=map.get(id),outer=map.get(id+'Outer');
   const extra=id==='head'?.5:.25;
   assert.deepEqual(outer.pivot,base.pivot);assert.deepEqual(outer.center,base.center);
   assert.equal(outer.part,id);
   const a=bounds(base),b=bounds(outer);
   for(let axis=0;axis<3;axis++){
    near(b[axis][0],a[axis][0]-extra);
    near(b[axis][1],a[axis][1]+extra);
   }
  }
 }
});

test('official head and Classic/Slim arm skin atlas UV tiles remain intact',()=>{
 const uvRanges=part=>{
  const d=cuboidTriangles(part);
  return Array.from({length:6},(_,face)=>{
   const u=[],v=[];
   for(let i=face*48;i<(face+1)*48;i+=8){u.push(d[i+3]*64);v.push(d[i+4]*64);}
   return [Math.min(...u),Math.max(...u),Math.min(...v),Math.max(...v)].map(Math.round);
  });
 };
 assert.deepEqual(uvRanges(rigParts(false).find(p=>p.id==='head')),
 [[0,8,8,16],[16,24,8,16],[8,16,0,8],[16,24,0,8],[8,16,8,16],[24,32,8,16]]);
 for(const [slim,w] of [[false,4],[true,3]]){
  const p=new Map(rigParts(slim).map(part=>[part.id,part]));
  assert.deepEqual(uvRanges(p.get('rightArm'))[4],[44,44+w,20,32]);
  assert.deepEqual(uvRanges(p.get('leftArm'))[4],[36,36+w,52,64]);
  assert.deepEqual(uvRanges(p.get('rightArmOuter'))[4],[44,44+w,36,48]);
  assert.deepEqual(uvRanges(p.get('leftArmOuter'))[4],[52,52+w,52,64]);
 }
});

test('head-attached facial micro-plane also winds outward for back-face culling',()=>{
 const data=facePlaneTriangles();
 for(const offset of [0,24])assert.ok(dot(triNormal(data,offset),[0,0,1])>EPS);
});

test('rotation hinges use vanilla shoulder pivots without changing resting arm geometry',()=>{
 for(const slim of [false,true]){
  const parts=new Map(rigParts(slim).map(p=>[p.id,p]));
  for(const side of ['right','left']){
   const sign=side==='right'?-1:1;
   const inner=parts.get(side+'Arm'),outer=parts.get(side+'ArmOuter');
   assert.deepEqual(inner.pivot,[sign*5,22,0]);
   assert.deepEqual(inner.center,[sign*(slim?.5:1),-4,0]);
   assert.deepEqual(outer.pivot,inner.pivot);
   assert.deepEqual(outer.center,inner.center);
  }
 }
});
