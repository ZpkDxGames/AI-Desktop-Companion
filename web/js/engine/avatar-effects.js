import {BoxGeometry,Group,Mesh,MeshBasicMaterial,InstancedMesh,Object3D,Color} from 'three';
/** Bounded voxel fireworks and scene-space pixel thought bubble. No timers or per-tick allocations. */
export class AvatarEffects{
 constructor(root,{reducedMotion=false}={}){
  this.root=root;this.reducedMotion=reducedMotion;this.capacity=48;this.geometries=[];this.materials=[];
  this.bubble=new Group();root.add(this.bubble);
  this.bubble.position.set(8.1,17.8,2.0);
  const geometry=new BoxGeometry(1,1,.18);this.geometries.push(geometry);
  const outline=new MeshBasicMaterial({color:0x39404a,depthTest:true});
  const ivory=new MeshBasicMaterial({color:0xf5f1df,depthTest:true});
  this.materials.push(outline,ivory);
  const square=(x,y,w,h,depth,mat)=>{
   const mesh=new Mesh(geometry,mat);
   mesh.position.set(x,y,depth);mesh.scale.set(w,h,1);this.bubble.add(mesh);
  };
  square(0,0,6.9,3.5,0,outline);
  square(0,0,6.35,3.0,.12,ivory);
  square(-1.8,-2.55,1.15,.8,0,outline);square(-1.8,-2.55,.78,.52,.12,ivory);
  square(-3.3,-3.66,.65,.65,0,outline);square(-3.3,-3.66,.38,.38,.12,ivory);
  // Three small pixel dots instead of remote AI-generated text.
  for(const x of [-1.55,0,1.55])square(x,.06,.48,.48,.25,outline);
  this.bubble.visible=false;
  const sparkGeo=new BoxGeometry(.46,.46,.18);this.geometries.push(sparkGeo);
  const sparkMat=new MeshBasicMaterial({color:0xffffff,vertexColors:false,depthTest:true});
  this.materials.push(sparkMat);
  this.particles=new InstancedMesh(sparkGeo,sparkMat,this.capacity);
  this.particles.instanceMatrix.setUsage(35048); // DynamicDrawUsage
  const palette=[new Color(0xffd35e),new Color(0x55b9ff),new Color(0xee82dc),new Color(0x83e69b)];
  for(let i=0;i<this.capacity;i++)this.particles.setColorAt(i,palette[(i+Math.floor(i/24))%palette.length]);
  if(this.particles.instanceColor)this.particles.instanceColor.needsUpdate=true;
  this.particles.count=0;this.particles.frustumCulled=false;root.add(this.particles);
  this.transform=new Object3D();this.lastCount=0;
 }
 setReducedMotion(enabled){this.reducedMotion=!!enabled;}
 update(action,elapsed,dt){
  const t=Number.isFinite(elapsed)?Math.max(0,elapsed):0;
  const think=action==='think';
  this.bubble.visible=think;
  if(think){
   const enter=Math.min(1,t/.32),exit=Math.min(1,(3.2-t)/.35);
   const w=Math.max(.01,Math.min(enter,exit));
   this.bubble.scale.setScalar((this.reducedMotion?1:.95+.05*Math.sin(t*2.2))*w);
   this.bubble.position.y=17.8+(this.reducedMotion?0:Math.sin(t*1.9)*.18);
  }
  if(action!=='celebrate'||this.reducedMotion){
   this.particles.count=0;this.lastCount=0;return;
  }
  let n=0;
  const dummy=this.transform;
  for(let burst=0;burst<2;burst++){
   const age=t-(burst===0?.3:1.15);
   if(age<0||age>1.35)continue;
   const x=burst===0?-10:10,z=-9.5;
   if(age<.38){
    dummy.position.set(x,-2+age/.38*15,z);
    dummy.scale.set(.65,1.45,.6);dummy.updateMatrix();
    this.particles.setMatrixAt(n++,dummy.matrix);
   }else{
    const progress=(age-.38)/.97,spread=3.6*Math.sin(Math.min(1,progress)*Math.PI*.72);
    for(let j=0;j<24;j++){
     const angle=j*Math.PI/12+burst*.32;
     const ring=j%3===0?1:.77;
     dummy.position.set(x+Math.cos(angle)*spread*ring,13+Math.sin(angle)*spread*ring-3*progress*progress,z-.4*Math.sin(angle));
     const size=.28*(1-progress)+.07;
     dummy.scale.setScalar(size/.46);dummy.updateMatrix();
     this.particles.setMatrixAt(n++,dummy.matrix);
    }
   }
  }
  this.particles.count=n;this.lastCount=n;
  if(n)this.particles.instanceMatrix.needsUpdate=true;
 }
 dispose(){
  this.bubble.removeFromParent();this.particles.removeFromParent();
  for(const geometry of this.geometries)geometry.dispose();
  for(const material of this.materials)material.dispose();
  this.geometries.length=0;this.materials.length=0;
 }
}
