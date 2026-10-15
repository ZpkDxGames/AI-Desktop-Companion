/** Fixed-head, real-WebGL facial pixels. No test hooks are shipped in the app. */
import {build} from 'vite';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {once} from 'node:events';

await mkdir('smoke-artifacts',{recursive:true});
await build({configFile:false,root:process.cwd(),logLevel:'error',build:{
 target:'es2020',outDir:'dist/eye-probe',emptyOutDir:false,sourcemap:false,
 lib:{entry:resolve('scripts/expressive-probe-entry.js'),formats:['es'],fileName:'renderer'}
}});
await writeFile('dist/eye-probe/probe.html',
 '<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0"><div style="width:500px;height:500px"><canvas id="eye-canvas"></canvas></div></body></html>');
const mime={'.html':'text/html','.js':'text/javascript','.png':'image/png'};
const root=resolve('dist');
const server=createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const path=resolve(root,'.'+pathname);
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
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 await page.goto('http://127.0.0.1:'+server.address().port+'/eye-probe/probe.html');
 const seed=(await readFile('web/assets/sample-skin.png')).toString('base64');
 const initialize=async png=>{
  const {AvatarRenderer,BehaviorController}=await import('/eye-probe/renderer.js');
  const source=new Image();source.src='data:image/png;base64,'+png;await source.decode();
  const tex=document.createElement('canvas');tex.width=64;tex.height=64;
  const ctx=tex.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0,64,64);
  const data=ctx.getImageData(0,0,64,64),set=(x,y,c)=>data.data.set(c,(y*64+x)*4);
  const hair=[44,42,39,255],white=[255,255,255,255],iris=[59,118,127,255],
    pupil=[32,94,104,255],lid=[240,207,185,255],clear=[0,0,0,0];
  for(let x=24;x<28;x++){
   set(x,2,lid);set(x,3,x===24||x===27?white:iris);
   set(x,4,x===24||x===27?white:pupil);
  }
  set(9,12,hair);set(10,12,iris);set(13,12,iris);set(14,12,hair);
  set(9,13,white);set(10,13,pupil);set(13,13,pupil);set(14,13,white);
  set(41,12,hair);set(42,12,clear);set(45,12,clear);set(46,12,hair);
  for(const x of [41,42,45,46])set(x,13,clear);
  ctx.putImageData(data,0,0);
  const image=new Image();image.src=tex.toDataURL('image/png');await image.decode();
  const renderer=new AvatarRenderer(document.getElementById('eye-canvas'));
  const profile=await renderer.setSkin(image);
  renderer.setFacesEnabled(true);
  renderer.render({}, {gazeX:0,gazeY:0,blink:0,rotation:0});
  window.eyeProbe=renderer;window.behaviorProbe=new BehaviorController();
  return {supported:profile.supported,reason:profile.reason};
 };
 const info=await page.evaluate(initialize,seed);
 if(!info.supported)throw Error('Synthetic skin marker not supported: '+info.reason);
 const captures=[];
 const scenes=[['neutral','idle',0,null],['agree','nod',.38,null],['uncertain','shrug',.7,null],['deny','shake',.5,null],
  ['thinking-30s','idle',30,{thinking:true}],['thinking-120s','idle',120,{thinking:true}],['insight','idle',.7,{bulbAge:.7}],
  ['sleepy','idle',0,{drowsiness:.8}],['wake','idle',0,{drowsiness:.3}],['reading-bubble','read',3,{thinking:true}]];
 for(const mode of ['workspace','overlay']){
  await page.setViewportSize(mode==='overlay'?{width:252,height:370}:{width:500,height:500});
  await page.evaluate(mode=>{
   const r=window.eyeProbe;r.overlay=mode==='overlay';r.baseZoom=r.overlay?.64:.73;r.viewer.zoom=r.baseZoom;
   const div=document.querySelector('div');div.style.width=innerWidth+'px';div.style.height=innerHeight+'px';
  },mode);
  for(const [name,action,elapsed,cues] of scenes){
   for(const [view,rotation] of (mode==='workspace'&&['deny','insight','sleepy','reading-bubble'].includes(name)?[['front',-.18],['quarter',.55],['side',1.15]]:[['front',-.18]])){
    const metrics=await page.evaluate(({action,elapsed,cues,rotation})=>{
     const c=window.behaviorProbe,r=window.eyeProbe;
     c.request('idle');c.request(action);for(let i=0;i<Math.ceil(Math.min(elapsed,4)*60);i++)c.update(1/60);
     c.setDrowsiness(cues?.drowsiness||0);
     for(let i=0;i<30;i++)r.render(c.pose(),{action,actionElapsed:elapsed,dt:1/60,rotation,blink:0,cues,presentation:c.presentation});
     return {memory:{...r.viewer.renderer.info.memory},bubble:r.effects.bubble.visible,bulb:r.effects.bulb.visible};
    },{action,elapsed,cues,rotation});
    if(cues?.thinking&&!metrics.bubble)throw Error('Lost long-request bubble');
    if(name==='insight'&&!metrics.bulb)throw Error('Missing bulb');
    const path='smoke-artifacts/v62-'+mode+'-'+name+'-'+view+'.png';
    await page.locator('#eye-canvas').screenshot({path});captures.push({path,...metrics});
   }
  }
 }
 const lifecycle=await page.evaluate(()=>{
  const r=window.eyeProbe,geo=r.effects.geometries.length,mat=r.effects.materials.length;
  for(let i=0;i<100;i++)r.render({}, {dt:.3,cues:{thinking:i%2===0,bulbAge:i%2===0?.6:Infinity}});
  for(let i=0;i<3;i++)r.render({}, {dt:.3,cues:{thinking:false,bulbAge:Infinity}});
  return {geo,mat,finalGeo:r.effects.geometries.length,finalMat:r.effects.materials.length,bubble:r.effects.bubble.visible,bulb:r.effects.bulb.visible};
 });
 if(lifecycle.geo!==lifecycle.finalGeo||lifecycle.mat!==lifecycle.finalMat||lifecycle.bubble||lifecycle.bulb)throw Error('Resource/effect lifecycle regression');
 for(const dpr of [1.5,2]){
  const context=await browser.newContext({viewport:{width:252,height:370},deviceScaleFactor:dpr});
  const high=await context.newPage();await high.goto('http://127.0.0.1:'+server.address().port+'/eye-probe/probe.html');
  await high.evaluate(initialize,seed);
  await high.evaluate(()=>{const r=window.eyeProbe;r.overlay=true;r.baseZoom=.64;r.viewer.zoom=.64;document.querySelector('div').style.cssText='width:252px;height:370px';
   for(let i=0;i<30;i++)r.render({}, {dt:1/60,cues:{thinking:true,drowsiness:.65}});
  });
  await high.locator('#eye-canvas').screenshot({path:'smoke-artifacts/v62-overlay-dpi-'+dpr+'.png'});
  await high.evaluate(()=>window.eyeProbe.dispose());await context.close();
 }
 await page.evaluate(()=>{const r=window.eyeProbe;r.effects.setReducedMotion(true);for(let i=0;i<30;i++)r.render({}, {dt:1/60,cues:{bulbAge:.7,drowsiness:.6}});});
 await page.locator('#eye-canvas').screenshot({path:'smoke-artifacts/v62-reduced-motion.png'});
 await writeFile('smoke-artifacts/v62-scene-metrics.json',JSON.stringify({captures,lifecycle},null,2));
 if(errors.length)throw Error('GPU probe errors: '+errors.join('; '));
 console.log('PASS V6.2 actual WebGL expression/effect scenes, long bubble and 100 pooled transitions');
 await page.evaluate(()=>window.eyeProbe.dispose());
 await page.close();
}finally{
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}
