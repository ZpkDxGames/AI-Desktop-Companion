/** Java Edition 64x64 skin layout; body is 8x12x4, head is 8x8x8. */
export function rigParts(slim=false){
 const arm=slim?3:4;
 return [
 {id:'body',uv:[16,16,8,12,4],size:[8,12,4],pivot:[0,24,0],center:[0,-6,0],layer:false},
 {id:'head',uv:[0,0,8,8,8],size:[8,8,8],pivot:[0,24,0],center:[0,4,0],layer:false},
 {id:'rightArm',uv:[40,16,arm,12,4],size:[arm,12,4],pivot:[-(4+arm/2),24,0],center:[0,-6,0],layer:false},
 {id:'leftArm',uv:[32,48,arm,12,4],size:[arm,12,4],pivot:[4+arm/2,24,0],center:[0,-6,0],layer:false},
 {id:'rightLeg',uv:[0,16,4,12,4],size:[4,12,4],pivot:[-2,12,0],center:[0,-6,0],layer:false},
 {id:'leftLeg',uv:[16,48,4,12,4],size:[4,12,4],pivot:[2,12,0],center:[0,-6,0],layer:false},
 {id:'bodyOuter',uv:[16,32,8,12,4],size:[8.5,12.5,4.5],pivot:[0,24,0],center:[0,-6,0],layer:true,part:'body'},
 {id:'headOuter',uv:[32,0,8,8,8],size:[9,9,9],pivot:[0,24,0],center:[0,4,0],layer:true,part:'head'},
 {id:'rightArmOuter',uv:[40,32,arm,12,4],size:[arm+.5,12.5,4.5],pivot:[-(4+arm/2),24,0],center:[0,-6,0],layer:true,part:'rightArm'},
 {id:'leftArmOuter',uv:[48,48,arm,12,4],size:[arm+.5,12.5,4.5],pivot:[4+arm/2,24,0],center:[0,-6,0],layer:true,part:'leftArm'},
 {id:'rightLegOuter',uv:[0,32,4,12,4],size:[4.5,12.5,4.5],pivot:[-2,12,0],center:[0,-6,0],layer:true,part:'rightLeg'},
 {id:'leftLegOuter',uv:[0,48,4,12,4],size:[4.5,12.5,4.5],pivot:[2,12,0],center:[0,-6,0],layer:true,part:'leftLeg'},
 ];
}
/** six faces in the official skin cross. Outputs interleaved xyz/uv/normal triangles. */
export function cuboidTriangles(part){
 const [w,h,d]=part.size,[u,v,tw,th,td]=part.uv;const x=w/2,y=h/2,z=d/2;
 const faces=[
 {rect:[u,v+td,td,th],norm:[1,0,0],p:[[x,y,z],[x,y,-z],[x,-y,-z],[x,-y,z]]},
 {rect:[u+td+tw,v+td,td,th],norm:[-1,0,0],p:[[-x,y,-z],[-x,y,z],[-x,-y,z],[-x,-y,-z]]},
 {rect:[u+td,v,tw,td],norm:[0,1,0],p:[[-x,y,-z],[x,y,-z],[x,y,z],[-x,y,z]]},
 {rect:[u+td+tw,v,tw,td],norm:[0,-1,0],p:[[-x,-y,z],[x,-y,z],[x,-y,-z],[-x,-y,-z]]},
 {rect:[u+td,v+td,tw,th],norm:[0,0,1],p:[[-x,y,z],[x,y,z],[x,-y,z],[-x,-y,z]]},
 {rect:[u+td+tw+td,v+td,tw,th],norm:[0,0,-1],p:[[x,y,-z],[-x,y,-z],[-x,-y,-z],[x,-y,-z]]}
 ];
 const out=[];
 for(const f of faces){const [a,b,c,e]=f.rect;const uv=[[a,b],[a+c,b],[a+c,b+e],[a,b+e]];for(const i of [0,1,2,0,2,3])out.push(...f.p[i],uv[i][0]/64,uv[i][1]/64,...f.norm);}
 return new Float32Array(out);
}
