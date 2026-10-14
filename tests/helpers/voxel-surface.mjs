import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const grids={apple:[12,14,10,.34],cooked_porkchop:[16,12,5,.31],golden_carrot:[8,18,6,.30],cake_slice:[12,9,11,.34]};
// Rasterize each planar triangle onto its unit face cells. The sorted signature
// records spatial coverage, outward normal and exact Float32 color, regardless
// of how the same surface is triangulated.
export function surfaceSignature(id,geometry){
 const [w,h,d,unit]=grids[id],dimensions=[w,h,d],cells=new Set();
 const {position,normal,color}=geometry.attributes;
 assert.equal(position.count%3,0);let area=0;
 for(let i=0;i<position.count;i+=3){
  const n=[normal.getX(i),normal.getY(i),normal.getZ(i)],axis=n.findIndex(v=>Math.abs(v)===1);
  assert.ok(axis>=0);const low=[Infinity,Infinity,Infinity],high=[-Infinity,-Infinity,-Infinity];
  const vertices=[];
  for(let j=i;j<i+3;j++){const p=[];for(let a=0;a<3;a++){
   const v=[position.getX(j),position.getY(j),position.getZ(j)][a]/unit+dimensions[a]/2;
   assert.ok(Math.abs(v-Math.round(v))<1e-5,'surface stays on the original voxel grid');
   low[a]=Math.min(low[a],Math.round(v));high[a]=Math.max(high[a],Math.round(v));
   p.push(Math.round(v));
   assert.equal([normal.getX(j),normal.getY(j),normal.getZ(j)][a],n[a]);
   assert.equal([color.getX(j),color.getY(j),color.getZ(j)][a],[color.getX(i),color.getY(i),color.getZ(i)][a]);
  }vertices.push(p);}
  assert.equal(low[axis],high[axis]);
  const axes=[0,1,2].filter(a=>a!==axis),rgb=[color.getX(i),color.getY(i),color.getZ(i)].map(v=>v.toPrecision(9)).join(',');
  const [uAxis,vAxis]=axes,[a,b,c]=vertices,cross=(p,q,r)=>(q[uAxis]-p[uAxis])*(r[vAxis]-p[vAxis])-(q[vAxis]-p[vAxis])*(r[uAxis]-p[uAxis]);
  const signedArea=cross(a,b,c);assert.ok(signedArea*n[axis]*(axis===1?-1:1)>0,'outward, non-degenerate triangles');area+=Math.abs(signedArea)/2;
  const sign=Math.sign(signedArea);
  for(let u=low[uAxis];u<high[uAxis];u++)for(let v=low[vAxis];v<high[vAxis];v++){
   const p=[];p[uAxis]=u+Math.SQRT2/4;p[vAxis]=v+Math.sqrt(3)/4;
   if(sign*cross(a,b,p)<0||sign*cross(b,c,p)<0||sign*cross(c,a,p)<0)continue;
   const cell=[axis,n[axis],low[axis],u,v,rgb].join(':');assert.ok(!cells.has(cell),'duplicate exterior face');cells.add(cell);
  }
 }
 assert.equal(area,cells.size,'no missing or overlapping surface area');
 return {cells:cells.size,sha256:createHash('sha256').update([...cells].sort().join('\n')).digest('hex'),triangles:position.count/3};
}
export function tintPixels(){
 const pixels=new Uint8Array(16*16*4);for(let i=0;i<pixels.length;i+=4)pixels.set([210,155,60,255],i);return pixels;
}
