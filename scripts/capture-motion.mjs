/** Real canonical-renderer evidence. Synthetic public sample skin, never owner certification.
 * npm install --no-save --no-package-lock playwright@1.56.1
 * node scripts/capture-motion.mjs <output-directory> [--clips]
 */
import {build} from 'vite';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {once} from 'node:events';
import {execFileSync} from 'node:child_process';

const out=resolve(process.argv[2]||'motion-evidence');
await mkdir(out,{recursive:true});await mkdir('dist/motion-probe',{recursive:true});
await writeFile('dist/motion-entry.js',"export {AvatarRenderer} from '../web/js/engine/renderer.js';export {BehaviorController,ACTIONS,DURATION} from '../web/js/avatar/animation.js';");
await build({configFile:false,root:process.cwd(),logLevel:'error',build:{target:'es2020',outDir:'dist/motion-probe',emptyOutDir:false,
 lib:{entry:resolve('dist/motion-entry.js'),formats:['es'],fileName:'motion'}}});
await writeFile('dist/motion-probe/index.html','<!doctype html><html><body style="margin:0;background:#162333"><div style="width:320px;height:400px"><canvas id="avatar"></canvas></div></body></html>');
const root=resolve('dist'),mime={'.html':'text/html','.js':'text/javascript','.png':'image/png'};
const server=createServer(async(req,res)=>{try{
 const path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
 if(!path.startsWith(root+sep))throw Error('path');
 res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream'}).end(await readFile(path));
}catch{res.writeHead(404).end();}});
server.listen(0,'127.0.0.1');await once(server,'listening');
let browser;
const manifest={commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),skin:'repository sample-skin.png (synthetic)',
 backend:'Chromium 141 / ANGLE SwiftShader (software WebGL)',viewport:[320,400],deviceScaleFactor:1,shots:[],clips:[],performance:[]};
try{
 browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
 const page=await browser.newPage({viewport:{width:320,height:400},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/motion-probe/index.html');
 await page.evaluate(async skin=>{
  const mod=await import('/motion-probe/motion.js');window.mod=mod;
  const img=new Image();img.src='data:image/png;base64,'+skin;await img.decode();
  window.r=new mod.AvatarRenderer(document.querySelector('canvas'));await r.setSkin(img);r.baseYaw=0;
  window.start=(action)=>{window.c=new mod.BehaviorController({seed:2026});c.request(action);};
  window.draw=(yaw=0)=>r.render(c.pose(),{rotation:yaw,action:c.action,actionElapsed:c.elapsed,activity:c.activity,
   foodVariant:c.foodVariant,gazeX:c.eyeGaze?.[0]??c.gaze[0],gazeY:c.eyeGaze?.[1]??c.gaze[1],blink:c.blink,dt:1/60});
  window.seek=(seconds)=>{for(let time=0;time<seconds-1e-9;time+=1/120)c.update(Math.min(1/120,seconds-time));};
 },(await readFile('web/assets/sample-skin.png')).toString('base64'));
 const times={idle:2,walk:1.3,run:1.3,wave:.9,sit:.8,jump:.46,think:1.1,celebrate:1.02,look:2.2,read:5.05,eat:1.45,drink:1.9,inspect:1.5,nod:.43,shrug:.6,stretch:1.2,bow:.8};
 const extras=[['read',.14,'read-enter'],['read',1.12,'read-open'],['read',4.7,'read-preturn'],['read',4.825,'read-page-25'],['read',5.05,'read-page-50'],['read',5.275,'read-page-75'],['read',5.6,'read-regrip'],['read',11.4,'read-close'],
  ['jump',.16,'jump-crouch'],['jump',.82,'jump-land'],['eat',1.8,'eat-porkchop','cooked_porkchop'],['eat',2.8,'eat-carrot','golden_carrot'],['eat',1.9,'eat-cake','cake_slice'],['drink',.7,'drink-raise'],['drink',3.6,'drink-lower']];
 for(const model of ['classic','slim']){
  await page.evaluate(model=>r.setModelMode(model),model);
  for(const [label,yaw] of [['front',0],['left',-.785398],['right',.785398],['side',1.570796]]){
   for(const [action,time] of Object.entries(times)){
    await page.evaluate(({action,time,yaw})=>{start(action);seek(time);draw(yaw);},{action,time,yaw});
    const file=`${model}-${label}-${action}.png`;
    await page.locator('canvas').screenshot({path:resolve(out,file)});
    manifest.shots.push({file,model,view:label,yaw,action,time});
   }
  }
 }
 await page.evaluate(()=>r.setModelMode('classic'));
 for(const [action,time,label,variant] of extras){
  await page.evaluate(({action,time,variant})=>{start(action);seek(time);if(variant)c.foodVariant=variant;draw();},{action,time,variant});
  const file=`detail-${label}.png`;await page.locator('canvas').screenshot({path:resolve(out,file)});
  manifest.shots.push({file,model:'classic',view:'front',action,time,variant});
 }
 for(const action of ['idle','walk','read','drink','celebrate']){
  const result=await page.evaluate(action=>{
   start(action);const update=[],render=[];
   for(let i=0;i<420;i++){
    let t=performance.now();c.update(1/60);const p=c.pose();const u=performance.now()-t;
    t=performance.now();r.render(p,{action:c.action,actionElapsed:c.elapsed,activity:c.activity,foodVariant:c.foodVariant,dt:1/60});
    if(i>=60){update.push(u);render.push(performance.now()-t);}
   }
   const quantile=rows=>{rows.sort((a,b)=>a-b);return {p50:rows[Math.floor(rows.length*.5)],p95:rows[Math.floor(rows.length*.95)],p99:rows[Math.floor(rows.length*.99)]};};
   return {updatePoseMs:quantile(update),renderSubmissionMs:quantile(render),drawCalls:r.viewer.renderer.info.render.calls,
    geometries:r.viewer.renderer.info.memory.geometries,textures:r.viewer.renderer.info.memory.textures};
  },action);manifest.performance.push({action,...result});
 }
 if(process.argv.includes('--clips')){
  await mkdir(resolve(out,'clips'),{recursive:true});
  for(const action of Object.keys(times)){
   console.log('Recording real-renderer clip: '+action);
   const data=await page.evaluate(async action=>{
    start(action);const canvas=document.querySelector('canvas'),stream=canvas.captureStream(0),track=stream.getVideoTracks()[0];
    const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:900000});
    const chunks=[];recorder.ondataavailable=e=>chunks.push(e.data);
    const done=new Promise(resolve=>recorder.onstop=resolve);recorder.start();
    const duration=(mod.DURATION[action]||3.2)+.6,frames=Math.ceil(duration*30);
    for(let i=0;i<frames;i++){c.update(1/60);c.update(1/60);draw(.35);track.requestFrame();await new Promise(resolve=>setTimeout(resolve,1000/30));}
    recorder.stop();await done;track.stop();
    const bytes=new Uint8Array(await new Blob(chunks).arrayBuffer());let text='';for(const b of bytes)text+=String.fromCharCode(b);
    return btoa(text);
   },action);
   const file=`clips/${action}.webm`;await writeFile(resolve(out,file),Buffer.from(data,'base64'));manifest.clips.push({file,action,simulationHz:60,recordingHz:30,yaw:.35});
  }
 }
 if(errors.length)throw Error(errors.join('\n'));await page.evaluate(()=>r.dispose());
 await writeFile(resolve(out,'manifest.json'),JSON.stringify(manifest,null,2));
 console.log(`Captured ${manifest.shots.length} canonical-renderer frames; ${manifest.clips.length} clips at ${out}`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
