import {chain,translation,rotateX,rotateY,rotateZ,ortho,lookAt,multiply} from './mat4.js';
import {rigParts,cuboidTriangles} from '../avatar/rig.js';
import {applyExpression} from '../avatar/eyes.js';

const vs=`#version 300 es
precision highp float;
in vec3 a_position;in vec2 a_tex;in vec3 a_normal;
uniform mat4 u_model;uniform mat4 u_viewproj;
out vec2 v_tex;out vec3 v_normal;
void main(){gl_Position=u_viewproj*u_model*vec4(a_position,1.0);v_tex=a_tex;v_normal=mat3(u_model)*a_normal;}`;
const fs=`#version 300 es
precision highp float;
in vec2 v_tex;in vec3 v_normal;
uniform sampler2D u_skin;
out vec4 color;
void main(){vec4 pixel=texture(u_skin,v_tex);if(pixel.a<0.04) discard;
vec3 n=normalize(v_normal);float light=0.74+0.26*max(0.0,dot(n,normalize(vec3(-0.35,0.7,0.6))));
color=vec4(pixel.rgb*light,pixel.a);}`;
function shader(gl,type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
function program(gl){const p=gl.createProgram();gl.attachShader(p,shader(gl,gl.VERTEX_SHADER,vs));gl.attachShader(p,shader(gl,gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
export class AvatarRenderer {
 constructor(canvas){
  this.canvas=canvas;this.gl=canvas.getContext('webgl2',{alpha:true,antialias:true,depth:true,preserveDrawingBuffer:false,powerPreference:'low-power'});
  if(!this.gl)throw Error('WebGL2 is unavailable. Enable GPU acceleration in your browser/WebView2.');
  const gl=this.gl;this.program=program(gl);this.uModel=gl.getUniformLocation(this.program,'u_model');this.uVp=gl.getUniformLocation(this.program,'u_viewproj');
  this.aPos=gl.getAttribLocation(this.program,'a_position');this.aTex=gl.getAttribLocation(this.program,'a_tex');this.aNormal=gl.getAttribLocation(this.program,'a_normal');
  this.texture=gl.createTexture();this.slim=false;this.meshes=[];this.skin=null;this.profile=null;this.lastExpression='';this.angle=0.18;this.createRig(false);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.useProgram(this.program);
 }
 createRig(slim){
  const gl=this.gl;for(const m of this.meshes)gl.deleteBuffer(m.vbo);this.slim=slim;
  this.meshes=rigParts(slim).map(part=>{const data=cuboidTriangles(part),vbo=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);return {...part,vbo,count:data.length/8};});
 }
 setSkin(image,profile){this.skin=image;this.profile=profile;this.lastExpression='';this.updateTexture(0,0,false);}
 updateTexture(x,y,blink){if(!this.skin)return;const gl=this.gl;const signature=[this.profile?.enabled,x,y,blink].join('/');if(signature===this.lastExpression)return;this.lastExpression=signature;
 const source=this.profile?.enabled?applyExpression(this.skin,this.profile,x,y,blink):this.skin;
 gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
 }
 resize(){const gl=this.gl,rect=this.canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);const w=Math.max(2,Math.floor(rect.width*dpr)),h=Math.max(2,Math.floor(rect.height*dpr));if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}gl.viewport(0,0,w,h);}
 render(pose,{eyes=[0,0],blink=false,scale=1,rotation=0}={}){
  const gl=this.gl;this.resize();gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);if(!this.skin)return;
  this.updateTexture(Math.round(eyes[0]),Math.round(eyes[1]),blink);
  gl.useProgram(this.program);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.uniform1i(gl.getUniformLocation(this.program,'u_skin'),0);
  const aspect=this.canvas.width/this.canvas.height;const halfHeight=19/scale;const vp=multiply(ortho(-halfHeight*aspect,halfHeight*aspect,-halfHeight,halfHeight,-120,120),lookAt([40,23,70],[0,15.5,0]));
  gl.uniformMatrix4fv(this.uVp,false,new Float32Array(vp));
  const root=chain(translation(0,pose.rootY,pose.rootZ),translation(0,15,0),rotateY(this.angle+rotation),rotateZ(pose.bodyZ),translation(0,-15,0));
  for(const part of this.meshes){const id=part.part||part.id;
   let rot=chain();if(id==='head')rot=chain(rotateY(pose.headY),rotateX(pose.headX),rotateZ(pose.headZ));
   if(id==='rightArm')rot=chain(rotateZ(pose.armRZ),rotateX(pose.armRX));
   if(id==='leftArm')rot=chain(rotateZ(pose.armLZ),rotateX(pose.armLX));
   if(id==='rightLeg')rot=rotateX(pose.legRX);if(id==='leftLeg')rot=rotateX(pose.legLX);
   const model=chain(root,translation(...part.pivot),rot,translation(...part.center));
   gl.uniformMatrix4fv(this.uModel,false,new Float32Array(model));gl.bindBuffer(gl.ARRAY_BUFFER,part.vbo);
   for(const [attrib,count,offset] of [[this.aPos,3,0],[this.aTex,2,12],[this.aNormal,3,20]]){gl.enableVertexAttribArray(attrib);gl.vertexAttribPointer(attrib,count,gl.FLOAT,false,32,offset);}
   gl.drawArrays(gl.TRIANGLES,0,part.count);
  }
 }
 dispose(){const gl=this.gl;for(const m of this.meshes)gl.deleteBuffer(m.vbo);gl.deleteTexture(this.texture);gl.deleteProgram(this.program);}
}
