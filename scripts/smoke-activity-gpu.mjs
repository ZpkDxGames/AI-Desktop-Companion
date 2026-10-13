/**
 * Deterministic, fixed-pose WebGL probe for book, food and drink.
 * Unlike end-to-end controls, no wall-clock animation can expire during PNG
 * capture. The test compares the exact same pose with/without its prop.
 */
import {build} from 'vite';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {once} from 'node:events';

await mkdir('smoke-artifacts',{recursive:true});
await writeFile('smoke-artifacts/activity-probe-entry.js',
  "export {AvatarRenderer} from '../web/js/engine/renderer.js';\nexport {BehaviorController} from '../web/js/avatar/animation.js';\nexport {readSelectedItemPngs} from '../web/js/engine/item-import.js';\n");
await build({configFile:false,root:process.cwd(),logLevel:'error',build:{
 target:'es2020',outDir:'dist/activity-probe',emptyOutDir:false,sourcemap:false,
 lib:{entry:resolve('smoke-artifacts/activity-probe-entry.js'),formats:['es'],fileName:'activity'}
}});
await writeFile('dist/activity-probe/probe.html',
 '<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0"><div style="width:500px;height:500px"><canvas id="activity-canvas"></canvas></div></body></html>');

const mime={'.html':'text/html','.js':'text/javascript','.png':'image/png'};
const root=resolve('dist');
const server=createServer(async(req,res)=>{
 try{
  const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!path.startsWith(root+sep)){res.writeHead(403).end();return;}
  const bytes=await readFile(path);
  res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-store'}).end(bytes);
 }catch{res.writeHead(404).end('not found');}
});
server.listen(0,'127.0.0.1');await once(server,'listening');

let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.COMPANION_CHROMIUM_PATH||undefined,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
 const page=await browser.newPage({viewport:{width:500,height:500}});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:'+server.address().port+'/activity-probe/probe.html');
 const seed=(await readFile('web/assets/sample-skin.png')).toString('base64');
 await page.evaluate(async base64=>{
   const {AvatarRenderer,BehaviorController,readSelectedItemPngs}=await import('/activity-probe/activity.js');
   const image=new Image();image.src='data:image/png;base64,'+base64;await image.decode();
   const renderer=new AvatarRenderer(document.getElementById('activity-canvas'));
   await renderer.setSkin(image);
   window.activityRenderer=renderer;
   window.activityController=new BehaviorController();
   window.BehaviorController=BehaviorController;window.readSelectedItemPngs=readSelectedItemPngs;
 },seed);
 const canvas=page.locator('#activity-canvas');
 const screenshot=async filename=>canvas.screenshot({path:'smoke-artifacts/activity-fixed-'+filename+'.png'});
 const diff=async(a,b)=>page.evaluate(async ([first,second])=>{
   const decode=async base64=>{
     const image=new Image();image.src='data:image/png;base64,'+base64;await image.decode();
     const c=document.createElement('canvas');c.width=image.width;c.height=image.height;
     const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
     return ctx.getImageData(0,0,c.width,c.height);
   };
   const a=await decode(first),b=await decode(second);
   if(a.width!==b.width||a.height!==b.height)throw Error('Prop frame sizes differ');
   let count=0;
   for(let i=0;i<a.data.length;i+=4)
     if(Math.abs(a.data[i]-b.data[i])+Math.abs(a.data[i+1]-b.data[i+1])+Math.abs(a.data[i+2]-b.data[i+2])>32)count++;
   return count;
 },[a.toString('base64'),b.toString('base64')]);

 for(const action of ['read','eat','drink']){
   await page.evaluate(name=>{
     const c=window.activityController=new window.BehaviorController();
     c.request(name);
     for(let i=0;i<(name==='read'?65:15);i++){c.update(.05);c.pose();}
     const renderer=window.activityRenderer;
     renderer.render(c.pose(),{action:name,actionElapsed:c.elapsed,dt:1});
     const prop=name==='read'?'book':name==='eat'?'food':'drink';
     if(!renderer.props[prop].visible)throw Error('Prop visibility off for '+name);
   },action);
   const withProp=await screenshot(action);
   await page.evaluate(name=>{
     const r=window.activityRenderer;
     r.props[name==='read'?'book':name==='eat'?'food':'drink'].visible=false;
     r.viewer.render();
   },action);
   const withoutProp=await screenshot(action+'-no-prop');
   const changed=await diff(withProp,withoutProp);
   if(changed<12)throw Error(action+' has invisible geometry in fixed-pose WebGL: '+changed+' changed pixels');
   console.log('PASS GPU prop visible '+action+': '+changed+' changed pixels with identical body/eye pose');
 }

 // Authored time, never wall-clock screenshot timing: saved real WebGL frames
 // represent every requested action for visual diff and manual review.
 const sequence=[
  ['read',.8,'read-enter'],['read',1.6,'read-closed-lift'],['read',2.25,'read-open'],['read',5,'read-calm'],
  ['read',10.7,'read-page-start'],['read',11.1,'read-page-half'],
  ['read',11.62,'read-page-complete'],['read',25.6,'read-exit'],
  ['sit',.13,'sit-down'],['sit',.8,'sit-seated'],['stand',.35,'sit-standing-up'],
  ['think',1.1,'think-bubble'],['celebrate',.43,'celebrate-flight'],
  ['celebrate',1.02,'celebrate-burst'],['celebrate',2.3,'celebrate-fade'],
  ['eat',1.45,'eat-apple','apple'],['eat',1.8,'eat-porkchop','cooked_porkchop'],
  ['eat',2.8,'eat-carrot','golden_carrot'],['eat',1.9,'eat-cake','cake_slice'],
  ['drink',1.1,'drink-raise'],['drink',1.9,'drink-sip'],
  ['look',.95,'look-steps'],['look',2.25,'look-scan'],
  ['inspect',1.5,'inspect-visual-preview'],
  ['read',11.1,'read-quarter-left',null,-.785],
  ['read',11.1,'read-quarter-right',null,.785],
  ['drink',1.9,'drink-quarter',null,.785],
  ['think',1.1,'think-quarter',null,-.785],
  ['look',1.6,'look-quarter',null,.785],
  ['sit',.8,'sit-quarter',null,.785],
  ['eat',1.45,'eat-apple-quarter','apple',.785]
 ];
 for(const [requested,seconds,label,variant,yaw] of sequence){
  await page.evaluate(({requested,seconds,variant,yaw})=>{
   const controller=new window.BehaviorController({seed:2026});
   if(requested==='stand'){
    controller.request('sit');
    for(let i=0;i<20;i++)controller.update(.05);
    controller.request('idle');
   }else controller.request(requested);
   for(let i=0;i<Math.round(seconds/.05);i++)controller.update(.05);
   if(variant)controller.foodVariant=variant;
   const renderer=window.activityRenderer;
   renderer.render(controller.pose(),{
    action:controller.action,actionElapsed:controller.elapsed,activity:controller.activity,
    foodVariant:controller.foodVariant,rotation:yaw||0,dt:.05
   });
  },{requested,seconds,variant,yaw});
  const frame=await screenshot(label);
  if(label.startsWith('eat-')||label==='drink-sip'){
   await page.evaluate(()=>{
    const renderer=window.activityRenderer;
    renderer.props.food.visible=false;renderer.props.drink.visible=false;
    renderer.viewer.render();
   });
   const bare=await screenshot(label+'-no-prop');
   const changed=await diff(frame,bare);
   if(changed<65)throw Error(label+' held item not sufficiently visible: '+changed+' changed pixels');
   console.log('PASS held prop pixel visibility '+label+': '+changed);
  }
  if(['think-bubble','celebrate-burst','celebrate-flight'].includes(label)){
   await page.evaluate(()=>{
    const renderer=window.activityRenderer;
    renderer.effects.bubble.visible=false;
    renderer.effects.particles.count=0;
    renderer.viewer.render();
   });
   const bare=await screenshot(label+'-no-effects');
   const changed=await diff(frame,bare);
   if(changed<10)throw Error(label+' GPU effect is invisible: '+changed+' changed pixels');
   console.log('PASS fixed-pose GPU '+label+': '+changed+' effect pixels');
  }
  if(label==='eat-apple'){
   await page.evaluate(()=>{const r=window.activityRenderer;r.props.food.visible=true;r.effects.crumbs.count=0;r.viewer.render();});
   const bare=await screenshot('eat-crumbs-off');
   const changed=await diff(frame,bare);
   if(changed<12)throw Error('Eating crumbs invisible in WebGL: '+changed);
   console.log('PASS fixed-pose GPU eating crumbs: '+changed+' effect pixels');
  }
 }

 // Confirm the user-controlled local texture can replace fallback without a second
 // renderer, and that reset fully restores the initial texture geometry.
 await page.evaluate(async()=>{
  const renderer=window.activityRenderer;
  const tex=document.createElement('canvas');tex.width=16;tex.height=16;
  const ctx=tex.getContext('2d');ctx.fillStyle='#00ff48';
  ctx.fillRect(3,3,10,10);ctx.clearRect(5,5,6,6);
  const count=await renderer.setItemTextures({apple:tex.toDataURL('image/png')});
  if(count!==1)throw Error('Local sprite import was not applied');
  if(!renderer.props.itemModels.get('apple').group.userData.voxelFood)throw Error('Imported colors lost the volumetric food profile');
  const c=window.activityController;c.request('idle');c.request('eat');
  for(let i=0;i<25;i++)c.update(.05);
  renderer.render(c.pose(),{action:'eat',actionElapsed:c.elapsed,foodVariant:'apple',activity:c.activity,dt:.05});
 });
 const importFrame=await screenshot('v3-local-apple-imported');
 // The same local-only path reads a selected client JAR; unrelated entries are ignored.
 const importedArchive=await page.evaluate(async base64=>{
  const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
  const result=await window.readSelectedItemPngs([new File([bytes],'client.jar',{type:'application/java-archive'})]);
  if(result.count!==2||Object.keys(result.sprites).sort().join(',')!=='apple,cake_slice')throw Error('JAR selected the wrong assets');
  await window.activityRenderer.setItemTextures(result.sprites);return result.count;
 },"UEsDBBQAAAAIAFWoTV3KdgpZXQAAAGEAAAAoAAAAYXNzZXRzL21pbmVjcmFmdC90ZXh0dXJlcy9pdGVtL2FwcGxlLnBuZ+sM8HPn5ZLiYmBg4PX0cAkC0gIgzMEGJOU//08EUhqeLo4hFXOSEyQyDnScEax88W2+hG/+k/KDXw0DXzUFMrvxSsiw8dgwMLxRZJGwVzbIBOph8HT1c1nnlNAEAFBLAwQUAAAACABVqE1dynYKWV0AAABhAAAAJwAAAGFzc2V0cy9taW5lY3JhZnQvdGV4dHVyZXMvaXRlbS9jYWtlLnBuZ+sM8HPn5ZLiYmBg4PX0cAkC0gIgzMEGJOU//08EUhqeLo4hFXOSEyQyDnScEax88W2+hG/+k/KDXw0DXzUFMrvxSsiw8dgwMLxRZJGwVzbIBOph8HT1c1nnlNAEAFBLAwQUAAAACABVqE1dKdxC+Q4AAAAMAAAAFwAAAGlycmVsZXZhbnQvcGFzc3dvcmQudHh0y8svUShOzUlNLklNAQBQSwECFAMUAAAACABVqE1dynYKWV0AAABhAAAAKAAAAAAAAAAAAAAAgAEAAAAAYXNzZXRzL21pbmVjcmFmdC90ZXh0dXJlcy9pdGVtL2FwcGxlLnBuZ1BLAQIUAxQAAAAIAFWoTV3KdgpZXQAAAGEAAAAnAAAAAAAAAAAAAACAAaMAAABhc3NldHMvbWluZWNyYWZ0L3RleHR1cmVzL2l0ZW0vY2FrZS5wbmdQSwECFAMUAAAACABVqE1dKdxC+Q4AAAAMAAAAFwAAAAAAAAAAAAAAgAFFAQAAaXJyZWxldmFudC9wYXNzd29yZC50eHRQSwUGAAAAAAMAAwDwAAAAiAEAAAAA");
 console.log('PASS browser local JAR decoding: '+importedArchive+' allowlisted PNGs; unrelated data excluded');
 await page.evaluate(async()=>{
  const renderer=window.activityRenderer;
  await renderer.setItemTextures({});
  renderer.viewer.render();
 });
 const fallbackFrame=await screenshot('v3-local-apple-restored');
 const importChanged=await diff(importFrame,fallbackFrame);
 if(importChanged<25)throw Error('Imported asset not visually distinct from fallback: '+importChanged);
 console.log('PASS local opt-in item asset pixel gate: '+importChanged+' changed pixels after restoring original geometry');
 // A merged flat face must not create a one-pixel crack at a T junction.
 // Inspect the actual production meshes, with their canonical material/light.
 const surfaces=await page.evaluate(()=>{
  const r=window.activityRenderer,canvas=r.canvas;canvas.parentElement.style.width='320px';canvas.parentElement.style.height='400px';r.resize();
  const cameraPosition=r.viewer.camera.position.clone(),cameraQuaternion=r.viewer.camera.quaternion.clone(),results=[];
  r.viewer.playerObject.visible=false;
  for(const id of ['apple','cooked_porkchop','golden_carrot','cake_slice']){
   const model=r.props.itemModels.get(id),object=model.group,parent=object.parent,position=object.position.clone(),quaternion=object.quaternion.clone(),scale=object.scale.clone(),visible=object.visible,opacity=model.materials.map(m=>m.opacity);
   r.viewer.scene.add(object);object.visible=true;object.position.set(0,0,0);object.scale.setScalar(1);for(const m of model.materials)m.opacity=1;
   for(const [view,yaw] of [['front',0],['quarter',-.7],['side',1.57]]){
    object.rotation.set(0,yaw,0);r.viewer.camera.position.set(0,3.5,14);r.viewer.camera.lookAt(0,0,0);r.viewer.camera.updateProjectionMatrix();r.viewer.renderer.render(r.viewer.scene,r.viewer.camera);
    const gl=r.viewer.renderer.getContext(),width=gl.drawingBufferWidth,height=gl.drawingBufferHeight,pixels=new Uint8Array(width*height*4),visited=new Uint8Array(width*height),queue=[];
    gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    const add=i=>{if(i>=0&&i<visited.length&&!visited[i]&&pixels[i*4+3]===0){visited[i]=1;queue.push(i);}};
    for(let x=0;x<width;x++){add(x);add((height-1)*width+x);}for(let y=0;y<height;y++){add(y*width);add(y*width+width-1);}
    for(let cursor=0;cursor<queue.length;cursor++){const i=queue[cursor];if(i%width)add(i-1);if(i%width<width-1)add(i+1);add(i-width);add(i+width);}
    let smallHoles=0;
    for(let i=0;i<visited.length;i++)if(!visited[i]&&pixels[i*4+3]===0){queue.length=0;add(i);for(let cursor=0;cursor<queue.length;cursor++){const n=queue[cursor];if(n%width)add(n-1);if(n%width<width-1)add(n+1);add(n-width);add(n+width);}if(queue.length<=3)smallHoles+=queue.length;}
    results.push({id,view,smallHoles});
   }
   parent.add(object);object.position.copy(position);object.quaternion.copy(quaternion);object.scale.copy(scale);object.visible=visible;model.materials.forEach((m,i)=>m.opacity=opacity[i]);
  }
  r.viewer.playerObject.visible=true;r.viewer.camera.position.copy(cameraPosition);r.viewer.camera.quaternion.copy(cameraQuaternion);return results;
 });
 for(const s of surfaces)if(s.smallHoles)throw Error(`Food surface crack: ${s.id}/${s.view} has ${s.smallHoles} enclosed missing pixels`);
 console.log('PASS solid food surfaces: 12 views with no enclosed pixel cracks');
 if(errors.length)throw Error('Activity GPU probe errors: '+errors.join('; '));
 await page.evaluate(()=>window.activityRenderer.dispose());
 await page.close();
}catch(error){console.error(error.stack||error);throw error;}finally{
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}
