import {BoxGeometry,PlaneGeometry,EdgesGeometry,Group,Mesh,LineSegments,MeshBasicMaterial,MeshLambertMaterial,LineBasicMaterial,DoubleSide,Plane,Vector3,Matrix4,Quaternion} from 'three';

/** Block-shaped glass vessel, cached water volume and gravity-level surface.
 * All resources and clipping planes are created once; fill changes only uniforms/transforms.
 */
export function createWaterBottle(){
 const group=new Group(),shell=new Group(),reservoir=new Group();group.add(shell,reservoir);
 const geometries=[],materials=[];
 const glass=new MeshBasicMaterial({color:0xb0d1dc,transparent:true,opacity:.22,depthWrite:false,side:DoubleSide});
 const outline=new LineBasicMaterial({color:0x9abacb,transparent:true,opacity:.85});
 const cork=new MeshLambertMaterial({color:0x8c5438});materials.push(glass,outline,cork);
 const block=(w,h,d,y,material,edges=false)=>{
  const g=new BoxGeometry(w,h,d);geometries.push(g);
  const m=new Mesh(g,material);m.position.y=y;shell.add(m);
  if(edges){const e=new EdgesGeometry(g);geometries.push(e);const line=new LineSegments(e,outline);line.position.y=y;shell.add(line);}
  return m;
 };
 block(3.6,3.3,2.8,-.6,glass,true);
 block(2.8,.55,2.3,1.28,glass,true);
 block(1.25,1.40,1.25,2.23,glass,true);
 block(1.46,.48,1.46,3.05,cork);
 // Narrow voxel glints make the clear vessel legible even against the skin.
 const glint=new MeshBasicMaterial({color:0xe3f6ff,transparent:true,opacity:.70,depthWrite:false});materials.push(glint);
 block(.16,2.3,.08,-.35,glint).position.set(-1.53,-.35,1.43);
 block(.14,.7,.08,.45,glint).position.set(1.48,.45,1.43);
 reservoir.position.y=-.6;
 const fillPlane=new Plane(new Vector3(0,-1,0),0);
 const localBoxPlanes=[new Plane(new Vector3(1,0,0),1.57),new Plane(new Vector3(-1,0,0),1.57),
  new Plane(new Vector3(0,1,0),1.47),new Plane(new Vector3(0,-1,0),1.47),
  new Plane(new Vector3(0,0,1),1.15),new Plane(new Vector3(0,0,-1),1.15)];
 const boxPlanes=localBoxPlanes.map(p=>p.clone());
 const water=new MeshLambertMaterial({color:0x385dc6,clippingPlanes:[fillPlane]});
 const top=new MeshBasicMaterial({color:0x527ee0,side:DoubleSide,clippingPlanes:boxPlanes});materials.push(water,top);
 const waterGeometry=new BoxGeometry(3.14,2.94,2.30),surfaceGeometry=new PlaneGeometry(8,8);geometries.push(waterGeometry,surfaceGeometry);
 const liquid=new Mesh(waterGeometry,water),surface=new Mesh(surfaceGeometry,top);reservoir.add(liquid,surface);
 const position=new Vector3(),inverse=new Matrix4(),worldRotation=new Quaternion(),upRotation=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),-Math.PI/2);
 let fill=1;
 return {group,shell,liquid,surface,geometries,materials,get fill(){return fill;},
  setPixels(pixels,width){
   // Imported water sprites tint the existing vessel; no new model per frame.
   let r=0,g=0,b=0,n=0;
   for(let y=Math.floor(width*.4);pixels&&y<width;y++)for(let x=0;x<width;x++){
    const i=(y*width+x)*4;
    if(pixels[i+3]>127&&pixels[i+2]>pixels[i]*1.15){r+=pixels[i];g+=pixels[i+1];b+=pixels[i+2];n++;}
   }
   if(n){water.color.setRGB(r/n/255,g/n/255,b/n/255);top.color.copy(water.color).lerp(glint.color,.18);}
   else{water.color.setHex(0x385dc6);top.color.setHex(0x527ee0);}
  },
  update(value){
   fill=Math.max(0,Math.min(1,Number.isFinite(value)?value:1));
   liquid.visible=surface.visible=fill>.002;if(!liquid.visible)return;
   reservoir.updateWorldMatrix(true,false);
   const matrix=reservoir.matrixWorld,e=matrix.elements;
   const extent=Math.abs(e[1])*1.57+Math.abs(e[5])*1.47+Math.abs(e[9])*1.15;
   position.setFromMatrixPosition(matrix);position.y+=extent*(2*fill-1);
   fillPlane.constant=position.y;
   inverse.copy(matrix).invert();surface.position.copy(position).applyMatrix4(inverse);
   reservoir.getWorldQuaternion(worldRotation);surface.quaternion.copy(worldRotation).invert().multiply(upRotation);
   for(let i=0;i<boxPlanes.length;i++)boxPlanes[i].copy(localBoxPlanes[i]).applyMatrix4(matrix);
  },
  dispose(){group.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();}
 };
}
