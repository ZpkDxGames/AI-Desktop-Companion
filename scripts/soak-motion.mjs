/** 10-minute wall-clock canonical WebGL lifecycle/resource soak. */
import {build} from 'vite';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {once} from 'node:events';
import {execFileSync} from 'node:child_process';
const out=resolve(process.argv[2]||'motion-soak.json'),root=resolve('dist');
await mkdir('dist/soak-probe',{recursive:true});
await writeFile('dist/soak-entry.js',"export {AvatarRenderer} from '../web/js/engine/renderer.js';export {BehaviorController,ACTIONS} from '../web/js/avatar/animation.js';");
await build({configFile:false,root:process.cwd(),logLevel:'error',build:{target:'es2020',outDir:'dist/soak-probe',emptyOutDir:false,lib:{entry:resolve('dist/soak-entry.js'),formats:['es'],fileName:'soak'}}});
await writeFile('dist/soak-probe/index.html','<!doctype html><html><body style="margin:0"><div style="width:252px;height:318px"><canvas id="avatar"></canvas></div></body></html>');
const mime={'.html':'text/html','.js':'text/javascript'};
const server=createServer(async(req,res)=>{try{
 const path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!path.startsWith(root+sep))throw Error('path');
 res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream'}).end(await readFile(path));
}catch{res.writeHead(404).end();}});server.listen(0,'127.0.0.1');await once(server,'listening');
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--js-flags=--expose-gc']});
 const page=await browser.newPage({viewport:{width:252,height:318}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port+'/soak-probe/index.html');
 await page.evaluate(async skin=>{
  window.mod=await import('/soak-probe/soak.js');window.skinImage=new Image();skinImage.src='data:image/png;base64,'+skin;await skinImage.decode();
  window.canvas=document.querySelector('canvas');window.r=new mod.AvatarRenderer(canvas);await r.setSkin(skinImage);
  window.c=new mod.BehaviorController({seed:2026});
  window.draw=()=>r.render(c.pose(),{action:c.action,actionElapsed:c.elapsed,activity:c.activity,presentation:c.presentation,foodVariant:c.foodVariant,dt:.05});
  window.counts=()=>({geometries:r.viewer.renderer.info.memory.geometries,textures:r.viewer.renderer.info.memory.textures,
   propGeometries:r.props.geometries.size,propMaterials:r.props.materials.size,items:r.props.itemModels.size,particleCapacity:r.effects.capacity});
  window.warm=()=>{
   for(const action of ['read','eat','drink','think','celebrate']){
    c.request('idle');c.request(action);for(let i=0;i<30;i++)c.update(.05);draw();
    if(action==='eat')for(const variant of ['apple','cooked_porkchop','golden_carrot','cake_slice']){c.foodVariant=variant;c.updatePresentation();draw();}
   }
   c.request('idle');for(let i=0;i<10;i++)c.update(.05);draw();
  };
  warm();window.samples=[];window.lifecycle=[];
 },(await readFile('web/assets/sample-skin.png')).toString('base64'));
 const session=await page.context().newCDPSession(page);await session.send('HeapProfiler.enable');
 // Explicit synthetic texture replace/reset and renderer dispose/reinitialize,
 // repeated 100 times. Never read private assets or request native permissions.
 const lifecycle=await page.evaluate(async()=>{
  const sprite=document.createElement('canvas');sprite.width=16;sprite.height=16;const ctx=sprite.getContext('2d');ctx.fillStyle='#37a5e7';ctx.fillRect(2,2,12,12);const source=sprite.toDataURL('image/png');
  for(let i=0;i<100;i++){
   await r.setItemTextures({apple:source,water_potion:source});draw();await r.setItemTextures({});
   await r.setModelMode(i%2?'slim':'classic');await r.setSkin(skinImage);draw();
   r.dispose();r=new mod.AvatarRenderer(canvas);await r.setSkin(skinImage);warm();
   if(i%10===0)lifecycle.push({iteration:i,...counts()});
  }
  return lifecycle;
 });
 const samples=[];const start=Date.now();let actionIndex=0;
 await page.evaluate(()=>{
  window.timer=setInterval(()=>{c.update(.05);draw();},50);
 });
 while(Date.now()-start<600000){
  await page.evaluate(index=>c.request(mod.ACTIONS[index%mod.ACTIONS.length]),actionIndex++);
  await new Promise(resolve=>setTimeout(resolve,10000));
  await session.send('HeapProfiler.collectGarbage');
  const heap=await session.send('Runtime.getHeapUsage'),resources=await page.evaluate(counts);
  samples.push({elapsedMs:Date.now()-start,usedHeap:heap.usedSize,totalHeap:heap.totalSize,...resources});
  if(samples.length%6===0)console.log(`Wall-clock soak: ${Math.round((Date.now()-start)/1000)} seconds, geometries=${resources.geometries}, textures=${resources.textures}`);
 }
 await page.evaluate(()=>{clearInterval(timer);r.dispose();});
 const reference=samples[0];
 for(const sample of [...lifecycle,...samples])for(const key of ['geometries','textures','propGeometries','propMaterials','items','particleCapacity'])
  if(sample[key]!==reference[key])throw Error(`Resource count grew: ${key}, ${sample[key]} != ${reference[key]}`);
 const tail=samples.slice(6),range=Math.max(...tail.map(x=>x.usedHeap))-Math.min(...tail.map(x=>x.usedHeap));
 if(range>8*1024*1024)throw Error('Retained heap range exceeded 8 MiB after warmup: '+range);
 if(errors.length)throw Error(errors.join('\n'));
 await writeFile(out,JSON.stringify({commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),backend:'Chromium ANGLE SwiftShader (software)',wallClockMs:Date.now()-start,
  lifecycleOperations:100,actionRequests:actionIndex,resourcesStable:true,retainedHeapRange:range,lifecycle,samples},null,2));
 console.log('PASS 10-minute wall-clock soak, 100 import/reset/renderer lifecycles, bounded resource counts and retained heap.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
