import test from 'node:test';
import assert from 'node:assert/strict';
import {detectFaceProfile} from '../web/js/avatar/face.js';
import {createFaceComposition,composeEyePixel} from '../web/js/avatar/face-composition.js';

const c=(r,g,b,a=255)=>[r,g,b,a];
const paint=(bytes,x,y,color)=>bytes.set(color,(y*64+x)*4);
function fixture(){
 const bytes=new Uint8ClampedArray(64*64*4);
 const hair=c(44,42,39),iris=c(59,118,127),pupil=c(32,94,104),skin=c(240,207,185),white=c(255,255,255);
 for(let x=24;x<28;x++){
  paint(bytes,x,2,skin);paint(bytes,x,3,x===24||x===27?white:iris);
  paint(bytes,x,4,x===24||x===27?white:pupil);
 }
 for(const x of [9,14])paint(bytes,x,12,hair);
 for(const x of [10,13]){paint(bytes,x,12,iris);paint(bytes,x,13,pupil);}
 for(const x of [9,14])paint(bytes,x,13,white);
 // Realistic asymmetrical hat: upper outer eye columns are occluded by hair.
 paint(bytes,41,12,hair);paint(bytes,46,12,hair);
 return {bytes,hair,iris,pupil,white};
}
function centerOfColor(composition,side,color,gazeX,gazeY){
 let sx=0,sy=0,n=0;
 for(let iy=0;iy<80;iy++)for(let ix=0;ix<80;ix++){
  const x=ix/40,y=iy/40;
  const pixel=composeEyePixel(composition,side,x,y,{gazeX,gazeY,blink:0});
  if(color.slice(0,3).every((v,j)=>v===pixel[j])){sx+=x;sy+=y;n++;}
 }
 assert.ok(n>50,side+' eye color vanished');
 return [sx/n,sy/n];
}
test('2D pupil motion changes both eyes on upper-hair-occluded marker skin',()=>{
 const {bytes,iris,pupil}=fixture();
 const composition=createFaceComposition(detectFaceProfile(bytes));
 assert.equal(composition.supported,true);
 for(const side of ['left','right']){
  const left=centerOfColor(composition,side,pupil,-1,0);
  const right=centerOfColor(composition,side,pupil,1,0);
  const up=centerOfColor(composition,side,pupil,0,1);
  const down=centerOfColor(composition,side,pupil,0,-1);
  assert.ok(right[0]-left[0]>.25,side+' pupil does not visibly move horizontally');
  assert.ok(up[1]-down[1]<-.25,side+' pupil does not visibly move vertically');
  const irisLeft=centerOfColor(composition,side,iris,-1,0);
  const irisRight=centerOfColor(composition,side,iris,1,0);
  assert.ok(Math.abs((right[0]-left[0])-(irisRight[0]-irisLeft[0]))<.05,'pupil and iris must move together');
 }
});
test('neutral and disabled face colors remain source-native; hair background is never whitened',()=>{
 const {bytes,hair,iris,pupil,white}=fixture();
 const face=createFaceComposition(detectFaceProfile(bytes));
 for(const side of ['left','right']){
  const left=side==='left',outerX=left?.5:1.5,innerX=left?1.5:.5;
  assert.deepEqual(composeEyePixel(face,side,outerX,.5,{gazeX:1,gazeY:1,blink:0}),hair);
  assert.deepEqual(composeEyePixel(face,side,outerX,1.5,{gazeX:-1,gazeY:0,blink:0}),white);
  assert.deepEqual(composeEyePixel(face,side,innerX,.5,{gazeX:0,gazeY:0,blink:0}),iris);
  assert.deepEqual(composeEyePixel(face,side,innerX,1.5,{gazeX:0,gazeY:0,blink:0}),pupil);
  assert.deepEqual(composeEyePixel(face,side,innerX,.5,{enabled:false,gazeX:1,gazeY:1,blink:1}),iris);
 }
});
test('half and full blink obscure dynamic iris coherently and preserve unsupported fallback',()=>{
 const {bytes,iris,pupil}=fixture();
 const face=createFaceComposition(detectFaceProfile(bytes));
 const irisPos=composeEyePixel(face,'left',1.5,.5,{gazeX:0,gazeY:0,blink:.55});
 assert.notDeepEqual(irisPos,iris);
 assert.notDeepEqual(composeEyePixel(face,'left',1.5,1.5,{blink:1}),pupil);
 assert.equal(createFaceComposition({supported:false}).supported,false);
});
