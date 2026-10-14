import {BoxGeometry,Group,Mesh,MeshBasicMaterial,InstancedMesh,Object3D,Color,Vector3,Quaternion,SRGBColorSpace} from 'three';
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
  square(0,0,7.1,3.5,0,outline);
  square(0,0,6.5,2.92,.12,ivory);
  square(-2.65,1.65,1.25,.82,0,outline);square(-2.65,1.65,.91,.49,.12,ivory);
  square(2.57,1.6,1.15,.81,0,outline);square(2.57,1.6,.86,.47,.12,ivory);
  square(-1.8,-2.55,1.15,.8,0,outline);square(-1.8,-2.55,.78,.52,.12,ivory);
  square(-3.3,-3.66,.65,.65,0,outline);square(-3.3,-3.66,.38,.38,.12,ivory);
  // Three small pixel dots instead of remote AI-generated text.
  for(const x of [-1.55,0,1.55])square(x,.06,.48,.48,.25,outline);
  this.bubble.visible=false;
  this.bubbleWeight=0;this.effectTime=0;this.anchor=new Vector3();this.viewRotation=new Quaternion();this.rootRotation=new Quaternion();
  this.bulb=new Group();root.add(this.bulb);this.bulb.visible=false;
  const yellow=new MeshBasicMaterial({color:0xf4cd62,depthTest:true});
  const filament=new MeshBasicMaterial({color:0xa87432,depthTest:true});this.materials.push(yellow,filament);
  const voxel=(x,y,w,h,depth,mat)=>{const m=new Mesh(geometry,mat);m.position.set(x,y,depth);m.scale.set(w,h,1);this.bulb.add(m);};
  voxel(0,1,3.6,3.8,0,outline);voxel(0,1,3.0,3.2,.14,yellow);
  voxel(0,1,1.1,1.5,.27,ivory);voxel(0,.1,.7,1,.3,filament);
  voxel(0,-1.4,1.8,.75,0,outline);voxel(0,-2.0,1.2,.5,0,outline);
  for(const [x,y,w,h] of [[0,4,.4,1],[-3,2,1,.4],[3,2,1,.4]])voxel(x,y,w,h,.05,yellow);

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
  const crumbGeometry=new BoxGeometry(.62,.54,.10),crumbMaterial=new MeshBasicMaterial({color:0xffffff});
  this.geometries.push(crumbGeometry);this.materials.push(crumbMaterial);
  this.crumbs=new InstancedMesh(crumbGeometry,crumbMaterial,16);this.crumbs.count=0;this.crumbs.frustumCulled=false;
  this.crumbs.instanceMatrix.setUsage(35048);root.add(this.crumbs);
  this.mouth=new Vector3();this.crumbColor=new Color();this.crumbSource=null;this.crumbTransform=new Object3D();
  for(let i=0;i<16;i++)this.crumbs.setColorAt(i,this.crumbColor);
  this.crumbs.instanceColor.needsUpdate=true;
 }
 setReducedMotion(enabled){this.reducedMotion=!!enabled;}
 update(action,elapsed,dt,presentation=null,itemPixels=null,cues=null,camera=null){
  const t=Number.isFinite(elapsed)?Math.max(0,elapsed):0;
  this.effectTime+=Number.isFinite(dt)?Math.max(0,dt):0;
  this.updateCrumbs(action,t,presentation,itemPixels);
  const think=cues?.thinking===true||action==='think';
  const target=think?1:0,step=Math.min(1,Math.max(0,dt||0)/.25);
  this.bubbleWeight+=Math.max(-step,Math.min(step,target-this.bubbleWeight));
  this.bubble.visible=this.bubbleWeight>.001;
  this.bubble.scale.setScalar(this.bubbleWeight*(this.reducedMotion?1:.98+.02*Math.sin(this.effectTime*2)));
  const age=cues?.bulbAge??Infinity;
  const enter=Math.min(1,Math.max(0,(age-.2)/.28)),exit=Math.min(1,Math.max(0,(2.1-age)/.35));
  const w=enter*enter*(3-2*enter)*exit*exit*(3-2*exit);
  this.bulb.visible=Number.isFinite(age)&&w>.001;
  this.bulb.scale.setScalar(w*(this.reducedMotion?1:1+.06*Math.sin(Math.min(1,enter)*Math.PI)));
  // Camera-facing voxel icons above/alongside the actual head, including sitting.
  // Quaternion/vector scratch objects are reused and occlusion remains depth-tested.
  if(this.bubble.visible||this.bulb.visible){
  const head=this.root.skin?.head;
  if(head){this.anchor.set(0,4,0);head.localToWorld(this.anchor);this.root.worldToLocal(this.anchor);}
  else this.anchor.set(0,12,0);
  if(camera){
   camera.getWorldQuaternion(this.viewRotation);this.root.getWorldQuaternion(this.rootRotation).invert();
   this.viewRotation.premultiply(this.rootRotation);
   this.bubble.quaternion.copy(this.viewRotation);this.bulb.quaternion.copy(this.viewRotation);
  }
  this.bubble.position.copy(this.anchor);
  this.bubble.position.y+=6.7+(this.reducedMotion?0:Math.sin(this.effectTime*1.6)*.10);
  this.bubble.position.x+=6.3;this.bubble.position.z+=2;
  this.bulb.position.copy(this.anchor);this.bulb.position.y+=7.8+.35*(1-enter);this.bulb.position.z+=2;
  }
  if(action!=='celebrate'||this.reducedMotion){
   this.particles.count=0;this.lastCount=0;return;
  }
  let n=0;
  const dummy=this.transform;
  for(let burst=0;burst<2;burst++){
   const age=t-(burst===0?.3:1.15);
   if(age<0||age>1.35)continue;
   const x=burst===0?-15.5:15.5,z=-9.5;
   if(age<.38){
    dummy.position.set(x,-2+age/.38*15,z);
    dummy.scale.set(1.12,2.05,.88);dummy.updateMatrix();
    this.particles.setMatrixAt(n++,dummy.matrix);
   }else{
    const progress=(age-.38)/.97,spread=5.4*Math.sin(Math.min(1,progress)*Math.PI*.72);
    for(let j=0;j<24;j++){
     const angle=j*Math.PI/12+burst*.32;
     const ring=j%3===0?1:.77;
     dummy.position.set(x+Math.cos(angle)*spread*ring,11+Math.sin(angle)*spread*ring-2.2*progress*progress,z-.4*Math.sin(angle));
     const size=.48*(1-progress)+.10;
     dummy.scale.setScalar(size/.46);dummy.updateMatrix();
     this.particles.setMatrixAt(n++,dummy.matrix);
    }
   }
  }
  this.particles.count=n;this.lastCount=n;
  if(n)this.particles.instanceMatrix.needsUpdate=true;
 }
 updateCrumbs(action,t,state,pixels){
  if((action!=='eat'&&state?.action!=='eat')||this.reducedMotion){this.crumbs.count=0;return;}
  if(state?.action==='eat')t=state.time;
  if(pixels&&this.crumbSource!==pixels){
   this.crumbSource=pixels;
   let start=0;
   for(let i=0;i<16;i++){
    let index=(start+Math.floor(pixels.length/4*(i+.35)/16))%(pixels.length/4);
    while(pixels[index*4+3]<128){index=(index+1)%(pixels.length/4);if(index===start)break;}
    this.crumbColor.setRGB(pixels[index*4]/255,pixels[index*4+1]/255,pixels[index*4+2]/255,SRGBColorSpace);
    this.crumbs.setColorAt(i,this.crumbColor);start=index;
   }
   this.crumbs.instanceColor.needsUpdate=true;
  }
  const head=this.root.skin?.head;
  this.mouth.set(0,1.55,5.8);
  if(head){head.localToWorld(this.mouth);this.root.worldToLocal(this.mouth);}else this.mouth.y=14;
  let count=0;const dummy=this.crumbTransform;
  for(let burst=0;burst<4;burst++){
   const start=burst<2?1.17+burst*.24:2.40+(burst-2)*.24;
   const age=t-start;if(age<0||age>.48)continue;
   for(let i=0;i<4;i++){
    const spread=(i-1.5)*.95;
    dummy.position.set(this.mouth.x+spread*age*4.0,this.mouth.y+(i%2?.9:.2)*age-40*age*age,this.mouth.z+.35+age*(2.4+i*.3));
    dummy.rotation.set(age*(i+1),age*(i-2),age*3);
    dummy.scale.setScalar((1-age/.48)*(state?.visibility??1));dummy.updateMatrix();
    this.crumbs.setMatrixAt(count++,dummy.matrix);
   }
  }
  this.crumbs.count=count;if(count)this.crumbs.instanceMatrix.needsUpdate=true;
 }
 dispose(){
  this.bubble.removeFromParent();this.bulb.removeFromParent();this.particles.removeFromParent();this.crumbs.removeFromParent();
  for(const geometry of this.geometries)geometry.dispose();
  for(const material of this.materials)material.dispose();
  this.geometries.length=0;this.materials.length=0;
 }
}
