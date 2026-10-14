import {BufferGeometry,Color,Float32BufferAttribute,Group,LinearSRGBColorSpace,Mesh,MeshLambertMaterial} from 'three';
import {FALLBACK_ITEMS} from './item-models.js';

/** Original block-food profiles, authored from the owner's volumetric references.
 * One exterior-only colored mesh per item; no cubes hidden inside the food,
 * no per-frame construction, no proprietary game assets bundled.
 */
const PALETTES={
 apple:[0xb92728,0xe34132,0x831c25,0x704723,0x3c8624,0x68a734],
 cooked_porkchop:[0xac572b,0xd17e3d,0x713515,0xf1dcb4,0xd3b889,0xe29b55],
 golden_carrot:[0xe7a327,0xffcf54,0xa66c14,0x57691d,0x8b8c25,0xf2ba35],
 cake_slice:[0xe1e0c3,0xf6f2df,0xb88751,0x815128,0xb92832,0xe44e45]
};
// Cube-grid dimensions are deliberately different: apple body, curved cut of
// meat, tapered carrot with stalks and a frosted block cake.
const SHAPES={apple:[12,14,10,.34],cooked_porkchop:[16,12,5,.31],golden_carrot:[8,18,6,.30],cake_slice:[12,9,11,.34]};
function cell(id,x,y,z,w,h,d){
 if(id==='apple'){
  if(y<10){const inset=(y===0||y===9)?2:(y===1||y===8)?1:0;
   if(x<inset||x>=w-inset||z<inset||z>=d-inset)return -1;
   if(y===9&&x>=5&&x<=6&&z>=4&&z<=5)return -1;
   return (x<2||y<2)?2:0;
  }
  if(y<=12&&x===6&&z===5)return 3;
  if(y>=11&&y<=12&&x>=7&&x<=10&&z>=4&&z<=5)return x%2?4:5;
 }else if(id==='cooked_porkchop'){
  // Curved steak/chop with a recessed upper center and exposed bone tips.
  if(y>=2&&y<=9&&x>=1&&x<=14){
   const edge=x<3||x>12;
   const top=edge?9:7;
   if(y<=top&&z>=((y===2||edge)?1:0)&&z<d-((y===2||edge)?1:0))return y===2||x===1||x===14?2:0;
  }
  if(y<=3&&((x>=1&&x<=2)||(x>=13&&x<=14))&&z>=1&&z<=3)return 3;
  if(y>=8&&y<=10&&((x>=2&&x<=4)||(x>=11&&x<=13))&&z>=1&&z<=3)return 1;
 }else if(id==='golden_carrot'){
  if(y<13){const radius=Math.min(3,Math.floor(y/3));
   if(x>=3-radius&&x<=4+radius&&z>=Math.max(0,2-Math.floor(radius*.7))&&z<=Math.min(d-1,3+Math.floor(radius*.7)))return y%4===0?2:0;
  }else if(y<18){
   if((x===3||x===4)&&z>=2&&z<=3)return 3;
   if(y>=14&&((x===1&&z===2)||(x===6&&z===3)))return 4;
   if(y===14&&x>=1&&x<=6&&z===2)return 3;
  }
 }else if(id==='cake_slice'){
  if(y<7){
   if(y>=3+(x+z)%2)return 0;
   return y===0?3:2;
  }
  if(y===7&&((x>=2&&x<=3&&z>=2&&z<=3)||(x>=8&&x<=9&&z>=7&&z<=8)||(x>=5&&x<=6&&z>=4&&z<=5)))return 4;
 }
 return -1;
}
function paletteFromPixels(id,pixels){
 const defaults=PALETTES[id];const result=defaults.slice();
 if(pixels===FALLBACK_ITEMS[id])return result;
 // Optional local art supplies the dominant body palette. Distinct structural
// accents (leaf/bone/frosting/berries) keep their semantic material assignment.
 const buckets=new Map();
 for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>=128){
  const r=pixels[i],g=pixels[i+1],b=pixels[i+2];
  const eligible=id==='apple'?r>g*1.5&&r>b*1.2:id==='golden_carrot'?r>g&&g>b*1.7:id==='cooked_porkchop'?r>g*1.15&&g>b*1.1:r>180&&g>170&&b>140;
  if(!eligible)continue;const key=(r>>4)<<8|(g>>4)<<4|(b>>4);const v=buckets.get(key)||[0,0,0,0];v[0]+=r;v[1]+=g;v[2]+=b;v[3]++;buckets.set(key,v);
 }
 if(!buckets.size&&id!=='cake_slice')for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>=128){const key=(pixels[i]>>4)<<8|(pixels[i+1]>>4)<<4|(pixels[i+2]>>4),v=buckets.get(key)||[0,0,0,0];for(let n=0;n<3;n++)v[n]+=pixels[i+n];v[3]++;buckets.set(key,v);}
 const top=[...buckets.values()].sort((a,b)=>b[3]-a[3])[0];
 if(top){const rgb=top.slice(0,3).map(n=>Math.round(n/top[3]));result[0]=(rgb[0]<<16)|(rgb[1]<<8)|rgb[2];}
 return result;
}
export function createVoxelFood(id,pixels){
 if(!SHAPES[id])throw Error('Unknown 3D food profile');
 const [w,h,d,unit]=SHAPES[id],palette=paletteFromPixels(id,pixels),grid=new Int8Array(w*h*d);grid.fill(-1);
 const at=(x,y,z)=>x<0||x>=w||y<0||y>=h||z<0||z>=d?-1:grid[(y*d+z)*w+x];
 let voxels=0;for(let y=0;y<h;y++)for(let z=0;z<d;z++)for(let x=0;x<w;x++){const tag=cell(id,x,y,z,w,h,d);grid[(y*d+z)*w+x]=tag;if(tag>=0)voxels++;}
 const position=[],normal=[],color=[],c=new Color();
 const faces=[
  [-1,0,0,[[0,0,1],[0,1,1],[0,1,0],[0,0,0]]],
  [1,0,0,[[1,0,0],[1,1,0],[1,1,1],[1,0,1]]],
  [0,-1,0,[[0,0,0],[1,0,0],[1,0,1],[0,0,1]]],
  [0,1,0,[[0,1,1],[1,1,1],[1,1,0],[0,1,0]]],
  [0,0,-1,[[0,0,0],[0,1,0],[1,1,0],[1,0,0]]],
  [0,0,1,[[1,0,1],[1,1,1],[0,1,1],[0,0,1]]]
 ];
 const dimensions=[w,h,d],mask=new Int16Array(Math.max(w*h,w*d,h*d)),quads=[];
 // Merge only coplanar exterior cells with identical color and normal. Pixel
 // boundaries, steps, silhouette and every original surface cell stay intact;
 // flat regions need one rectangle rather than one rectangle per voxel.
 for(const [nx,ny,nz,points] of faces){
  const axis=nx?0:ny?1:2,uAxis=axis===0?1:0,vAxis=axis===2?1:2;
  const columns=dimensions[uAxis],rows=dimensions[vAxis],origin=[0,0,0],extent=[1,1,1];
  for(let slice=0;slice<dimensions[axis];slice++){
   mask.fill(0);
   for(let v=0;v<rows;v++)for(let u=0;u<columns;u++){
    origin[axis]=slice;origin[uAxis]=u;origin[vAxis]=v;
    const [x,y,z]=origin,tag=at(x,y,z);
    if(tag<0||at(x+nx,y+ny,z+nz)>=0)continue;
    const shade=tag===0?((Math.floor(x/2)+Math.floor(y/2)*3+Math.floor(z/2)*7)%9===0?1:(x+y+z)%11===0?2:0):0;
    mask[v*columns+u]=1+tag*3+shade;
   }
   for(let v=0;v<rows;v++)for(let u=0;u<columns;){
    const key=mask[v*columns+u];if(!key){u++;continue;}
    let width=1,height=1;
    while(u+width<columns&&mask[v*columns+u+width]===key)width++;
    row:while(v+height<rows){for(let n=0;n<width;n++)if(mask[(v+height)*columns+u+n]!==key)break row;height++;}
    for(let row=0;row<height;row++)mask.fill(0,(v+row)*columns+u,(v+row)*columns+u+width);
    origin[axis]=slice;origin[uAxis]=u;origin[vAxis]=v;
    extent[axis]=1;extent[uAxis]=width;extent[vAxis]=height;
    quads.push({normal:[nx,ny,nz],key,corners:points.map(q=>q.map((n,a)=>origin[a]+n*extent[a]))});
    u+=width;
   }
  }
 }
 // Every neighboring rectangle corner also splits the matching edge. Without
 // these shared boundary segments, a long edge beside a shorter one can leave
 // visible T-junction cracks in the real rasterizer. Interior flat cells stay
 // merged; no overlap, face inflation or additional material pass is needed.
 const lineKey=(p,axis)=>axis+':'+p[(axis+1)%3]+':'+p[(axis+2)%3],lines=new Map();
 for(const quad of quads)for(const p of quad.corners)for(let axis=0;axis<3;axis++){
  const key=lineKey(p,axis);if(!lines.has(key))lines.set(key,new Set());lines.get(key).add(p[axis]);
 }
 for(const [key,values] of lines)lines.set(key,[...values].sort((a,b)=>a-b));
 for(const quad of quads){
  const boundary=[];
  for(let edge=0;edge<4;edge++){
   const a=quad.corners[edge],b=quad.corners[(edge+1)%4],axis=a.findIndex((n,i)=>n!==b[i]);
   const values=lines.get(lineKey(a,axis)).filter(n=>n>=Math.min(a[axis],b[axis])&&n<=Math.max(a[axis],b[axis]));
   if(b[axis]<a[axis])values.reverse();
   for(let i=0;i<values.length-1;i++){const p=a.slice();p[axis]=values[i];boundary.push(p);}
  }
  const [nx,ny,nz]=quad.normal,normalAxis=nx?0:ny?1:2,axes=[0,1,2].filter(n=>n!==normalAxis),[u,v]=axes;
  const polygon=boundary.map((_,i)=>i),triangles=[];
  let area=0;for(let i=0;i<boundary.length;i++){const a=boundary[i],b=boundary[(i+1)%boundary.length];area+=a[u]*b[v]-b[u]*a[v];}
  const sign=Math.sign(area),cross=(a,b,p)=>sign*((b[u]-a[u])*(p[v]-a[v])-(b[v]-a[v])*(p[u]-a[u]));
  // Keep collinear boundary vertices: dropping them would recreate the seam.
  while(polygon.length>3){
   let found=false;
   for(let i=0;i<polygon.length;i++){
    const a=polygon[(i+polygon.length-1)%polygon.length],b=polygon[i],d=polygon[(i+1)%polygon.length];
    if(cross(boundary[a],boundary[b],boundary[d])<=0)continue;
    let blocked=false;for(const p of polygon){if(p===a||p===b||p===d)continue;const q=boundary[p];if(cross(boundary[a],boundary[b],q)>=0&&cross(boundary[b],boundary[d],q)>=0&&cross(boundary[d],boundary[a],q)>=0){blocked=true;break;}}
    if(blocked)continue;triangles.push(a,b,d);polygon.splice(i,1);found=true;break;
   }
   if(!found)throw Error('Food boundary cannot be triangulated');
  }
  triangles.push(...polygon);
  const tag=Math.floor((quad.key-1)/3),shade=[1,1.12,.90][(quad.key-1)%3];
   // skinview3d deliberately disables Three's global ColorManagement. Vertex
   // colors still enter the linear lighting pipeline, so decode our sRGB art
   // explicitly without changing that global setting (or skin/bottle colors).
   const hex=palette[tag];c.setRGB((hex>>16&255)/255,(hex>>8&255)/255,(hex&255)/255,LinearSRGBColorSpace).convertSRGBToLinear().multiplyScalar(shade);
  for(const i of triangles){const q=boundary[i];position.push((q[0]-w/2)*unit,(q[1]-h/2)*unit,(q[2]-d/2)*unit);normal.push(nx,ny,nz);color.push(c.r,c.g,c.b);}
 }
 const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(position,3));geometry.setAttribute('normal',new Float32BufferAttribute(normal,3));geometry.setAttribute('color',new Float32BufferAttribute(color,3));geometry.computeBoundingBox();geometry.computeBoundingSphere();
 const material=new MeshLambertMaterial({vertexColors:true,transparent:true,depthWrite:true});
 const mesh=new Mesh(geometry,material),group=new Group();group.add(mesh);group.userData.itemId=id;group.userData.voxelFood=true;group.userData.voxels=voxels;group.userData.displayWidth=w*unit;group.userData.halfDepth=d*unit/2;
 return {group,mesh,front:mesh,depth:mesh,pixels,materials:[material],geometry,dispose(){group.removeFromParent();geometry.dispose();material.dispose();}};
}
