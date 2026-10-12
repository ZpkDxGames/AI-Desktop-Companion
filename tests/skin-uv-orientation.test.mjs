import test from 'node:test';
import assert from 'node:assert/strict';
import {AvatarRenderer} from '../web/js/engine/renderer.js';
import {rigParts,cuboidTriangles} from '../web/js/avatar/rig.js';

function fakeGl(){
 const calls=[];
 const gl={
  TEXTURE_2D:3553,UNPACK_FLIP_Y_WEBGL:37440,UNPACK_PREMULTIPLY_ALPHA_WEBGL:37441,
  TEXTURE_MIN_FILTER:10241,TEXTURE_MAG_FILTER:10240,TEXTURE_WRAP_S:10242,TEXTURE_WRAP_T:10243,
  NEAREST:9728,CLAMP_TO_EDGE:33071,RGBA:6408,UNSIGNED_BYTE:5121,
  bindTexture:(...a)=>calls.push(['bindTexture',...a]),pixelStorei:(...a)=>calls.push(['pixelStorei',...a]),
  texParameteri:()=>{},texImage2D:(...a)=>calls.push(['texImage2D',...a])
 };
 return {gl,calls};
}
test('real skin PNG upload flips top-origin rows into WebGL texture space',()=>{
 const {gl,calls}=fakeGl();
 AvatarRenderer.prototype.updateTexture.call({gl,texture:{},skin:{kind:'HTMLImageElement'}});
 assert.ok(calls.some(([name,property,value])=>name==='pixelStorei'&&property===gl.UNPACK_FLIP_Y_WEBGL&&value===true));
 assert.equal(calls.filter(([name])=>name==='texImage2D').length,1);
});
test('head-attached expression canvas uses same vertical orientation as skin',()=>{
 const {gl,calls}=fakeGl();
 const previous=globalThis.ImageData;
 globalThis.ImageData=class ImageData{constructor(data,w,h){this.data=data;this.width=w;this.height=h;}};
 try{
  const obj={gl,faceProfile:{supported:true,eyes:{left:[1,4],right:[5,4]},occluded:{},
   colors:{lid:[200,180,150,255],white:[255,255,255,255],iris:[20,80,100,255],pupil:[5,30,50,255]}},
   facesEnabled:true,lastFaceState:'',faceTexture:{},faceCanvas:{kind:'HTMLCanvasElement'},faceContext:{putImageData:()=>{}}};
  assert.equal(AvatarRenderer.prototype.uploadFace.call(obj,1,0),true);
  assert.ok(calls.some(([name,property,value])=>name==='pixelStorei'&&property===gl.UNPACK_FLIP_Y_WEBGL&&value===true));
 }finally{
  if(previous===undefined)delete globalThis.ImageData;else globalThis.ImageData=previous;
 }
});
function range(part,face){
 const data=cuboidTriangles(part),start=face*48,us=[],vs=[];
 for(let i=start;i<start+48;i+=8){us.push(data[i+3]*64);vs.push(data[i+4]*64);}
 return [Math.min(...us),Math.max(...us),Math.min(...vs),Math.max(...vs)].map(Math.round);
}
test('head and outfit front faces keep top-origin Java skin atlas rows',()=>{
 const parts=new Map(rigParts().map(p=>[p.id,p]));
 for(const [id,expected] of Object.entries({head:[8,16],headOuter:[8,16],body:[20,32],bodyOuter:[36,48],rightLegOuter:[36,48],leftLegOuter:[52,64]}))
  assert.deepEqual(range(parts.get(id),4).slice(2),expected,id);
});
test('both geometric X faces use the right atlas strips for both Classic and Slim layers',()=>{
 for(const slim of [false,true])for(const part of rigParts(slim)){
  const [u,v,w,h,d]=part.uv;
  assert.deepEqual(range(part,0),[u+w+d,u+w+2*d,v+d,v+d+h],part.id+' +X');
  assert.deepEqual(range(part,1),[u,u+d,v+d,v+d+h],part.id+' -X');
 }
});