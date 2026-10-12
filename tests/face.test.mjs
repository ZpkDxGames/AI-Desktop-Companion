import test from 'node:test';
import assert from 'node:assert/strict';
import {detectFaceProfile,composeFacePixels,facePlaneTriangles} from '../web/js/avatar/face.js';
function paint(p,x,y,rgba){p.set(rgba,(y*64+x)*4);}
function pixel(p,x,y){return Array.from(p.slice((y*64+x)*4,(y*64+x)*4+4));}
const skin=()=>{
 const a=new Uint8ClampedArray(64*64*4);
 const lid=[240,207,185,255], white=[255,255,255,255], iris=[59,118,127,255], dark=[32,94,104,255];
 for(let x=24;x<28;x++){paint(a,x,2,lid);paint(a,x,3,x===24||x===27?white:iris);paint(a,x,4,x===24||x===27?white:dark);}
 for(const x of [10,13]){paint(a,x,12,iris);paint(a,x,13,dark);}
 for(const x of [9,14])paint(a,x,13,white);
 return a;
};
test('detects 2x2 eye cells from skin marker and original pupils (not manually set)',()=>{
 const info=detectFaceProfile(skin());assert.equal(info.supported,true);
 assert.deepEqual(info.eyes,{left:[1,4],right:[5,4]});
 assert.deepEqual(info.colors.pupil,[32,94,104,255]);
});
test('unknown, invalid, or incomplete markers never become random eyes',()=>{
 assert.equal(detectFaceProfile(new Uint8ClampedArray(64*64*4)).supported,false);
 assert.equal(detectFaceProfile(new Uint8Array(7)).supported,false);
 const broken=skin();paint(broken,24,3,[0,0,0,0]);assert.equal(detectFaceProfile(broken).supported,false);
 const ambiguous=skin();paint(ambiguous,9,13,[0,0,0,0]);assert.equal(detectFaceProfile(ambiguous).supported,false);
});
test('neutral state leaves entire face overlay transparent',()=>{
 const p=composeFacePixels(detectFaceProfile(skin()));assert.equal(p.filter(Boolean).length,0);
});
test('gaze and blink generate bounded alpha mask using original marker colors',()=>{
 const profile=detectFaceProfile(skin());
 const moved=composeFacePixels(profile,{gazeX:-1});
 assert.deepEqual(pixel(moved,9,13),profile.colors.pupil);
 assert.deepEqual(pixel(moved,10,13),profile.colors.white);
 assert.equal(pixel(moved,12,13)[3],0);
 const blink=composeFacePixels(profile,{blink:1});
 for(const [x,y] of [[9,12],[10,12],[9,13],[10,13],[13,12],[14,12],[13,13],[14,13]])
 assert.deepEqual(pixel(blink,x,y),profile.colors.lid);
 assert.deepEqual(pixel(blink,8,8),[0,0,0,0]);
});
test('face quad uses exact vanilla head-front UV and projects above second layer',()=>{
 const geom=facePlaneTriangles();assert.equal(geom.length,48);
 for(let i=0;i<geom.length;i+=8){assert.ok(geom[i+2]>4.5);assert.ok(geom[i+3]>=8/64&&geom[i+3]<=16/64);assert.ok(geom[i+4]>=8/64&&geom[i+4]<=16/64);}
});
test('existing transparent/opaque hat textures are respected by the facial layer',()=>{
 const source=skin();paint(source,41,12,[12,23,34,255]);
 const info=detectFaceProfile(source);assert.equal(info.supported,true);
 const move=composeFacePixels(info,{gazeX:-1});
 assert.deepEqual(pixel(move,9,12),[0,0,0,0]);
 assert.deepEqual(pixel(move,9,13),info.colors.pupil);
});
