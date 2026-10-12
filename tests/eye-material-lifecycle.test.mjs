import test from 'node:test';
import assert from 'node:assert/strict';
import {MeshStandardMaterial,Texture} from 'three';
import {EyeFaceMaterial} from '../web/js/engine/eye-face-material.js';

const c=(r,g,b)=>[r,g,b,255];
const hair=c(44,42,39),white=c(255,255,255),iris=c(59,118,127),
 pupil=c(32,94,104),lid=c(240,207,185);
const profile={
 supported:true,eyes:{left:[1,4],right:[5,4]},
 background:{left:{top:hair,bottom:white},right:{top:hair,bottom:white}},
 occlusion:{left:{top:[true,false],bottom:[false,false]},right:{top:[false,true],bottom:[false,false]}},
 colors:{white,iris,pupil,lid}
};
function fixture(){
 const innerMaterial=new MeshStandardMaterial(),hatMaterial=new MeshStandardMaterial();
 const innerLayer={material:innerMaterial},outerLayer={material:hatMaterial};
 const adapter=new EyeFaceMaterial({innerLayer,outerLayer});
 return {innerMaterial,hatMaterial,innerLayer,outerLayer,adapter};
}

test('face shader clones only inner head material and never modifies hat/body ownership',()=>{
 const f=fixture();
 assert.notStrictEqual(f.innerLayer.material,f.innerMaterial);
 assert.strictEqual(f.outerLayer.material,f.hatMaterial);
 assert.strictEqual(f.adapter.original,f.innerMaterial);
 f.adapter.dispose();
 assert.strictEqual(f.innerLayer.material,f.innerMaterial);
 assert.strictEqual(f.outerLayer.material,f.hatMaterial);
});
test('one skin map per import, gaze/blink update reuses uniforms without shader recompilation',()=>{
 const f=fixture(),map=new Texture(),adapter=f.adapter;
 assert.equal(adapter.configure(profile,map).supported,true);
 adapter.setEnabled(true);
 const gaze=adapter.uniforms.faceGaze.value,material=adapter.material;
 const version=material.version;
 for(let i=0;i<2000;i++)adapter.update(Math.sin(i/100),Math.cos(i/100),i%2);
 assert.strictEqual(gaze,adapter.uniforms.faceGaze.value);
 assert.strictEqual(material.map,map);
 assert.equal(material.version,version,'per-frame material.needsUpdate/recompile is forbidden');
 assert.equal(adapter.uniforms.faceEnabled.value,1);
 adapter.dispose();
});
test('unsupported skin disables expressions without replacing face pixels',()=>{
 const f=fixture(),adapter=f.adapter;
 adapter.setEnabled(true);
 adapter.configure(profile,new Texture());
 assert.equal(adapter.uniforms.faceEnabled.value,1);
 adapter.configure({supported:false},new Texture());
 assert.equal(adapter.uniforms.faceEnabled.value,0);
 adapter.dispose();
});
test('head-only map shader includes both axes and not duplicate 3D eye geometry',()=>{
 const f=fixture(),shader={
  uniforms:{},
  fragmentShader:'#include <common>\nvoid main(){\n#include <map_fragment>\n}'
 };
 f.adapter.material.onBeforeCompile(shader);
 assert.match(shader.fragmentShader,/composeEyeCell/);
 assert.match(shader.fragmentShader,/faceGaze\.y/);
 assert.match(shader.fragmentShader,/vMapUv/);
 assert.strictEqual(shader.uniforms.faceGaze,f.adapter.uniforms.faceGaze);
 f.adapter.dispose();
});
