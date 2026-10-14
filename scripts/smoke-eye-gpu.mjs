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
 lib:{entry:resolve('web/js/engine/renderer.js'),formats:['es'],fileName:'renderer'}
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
 const info=await page.evaluate(async png=>{
  const {AvatarRenderer}=await import('/eye-probe/renderer.js');
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
  window.eyeProbe=renderer;
  return {supported:profile.supported,reason:profile.reason};
 },seed);
 if(!info.supported)throw Error('Synthetic skin marker not supported: '+info.reason);
 const capture=async(name,{enabled=true,gazeX=0,gazeY=0,blink=0,rotation=0}={})=>{
  await page.evaluate(p=>{
   const rig=window.eyeProbe;
   rig.setFacesEnabled(p.enabled);
   rig.render({},p);
  },{enabled,gazeX,gazeY,blink,rotation});
  return page.locator('#eye-canvas').screenshot({path:'smoke-artifacts/eye-only-'+name+'.png'});
 };
 const diff=async(a,b)=>page.evaluate(async([a64,b64])=>{
  const decode=async value=>{
   const im=new Image();im.src='data:image/png;base64,'+value;await im.decode();
   const c=document.createElement('canvas');c.width=im.width;c.height=im.height;
   const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(im,0,0);
   return ctx.getImageData(0,0,c.width,c.height);
  };
  const x=await decode(a64),y=await decode(b64);
  if(x.width!==y.width||x.height!==y.height)throw Error('Frame dimension drift');
  let changed=0;
  for(let i=0;i<x.data.length;i+=4)
   if(Math.abs(x.data[i]-y.data[i])+Math.abs(x.data[i+1]-y.data[i+1])+Math.abs(x.data[i+2]-y.data[i+2])>36)changed++;
  return changed;
 },[a.toString('base64'),b.toString('base64')]);

 const off=await capture('off',{enabled:false});
 const neutral=await capture('neutral');
 const left=await capture('left',{gazeX:-1});
 const right=await capture('right',{gazeX:1});
 const up=await capture('up',{gazeY:1});
 const down=await capture('down',{gazeY:-1});
 const half=await capture('half-blink',{blink:.5});
 const closed=await capture('closed',{blink:1});
 const offRight=await capture('off-right',{enabled:false,gazeX:1});
 const same=await diff(off,neutral);
 const horizontally=await diff(left,right);
 const vertically=await diff(up,down);
 const blink=await diff(neutral,closed);
 const disabled=await diff(off,offRight);
 if(same>4)throw Error('Neutral enabled/off fidelity changed '+same+' pixels on fixed head');
 if(disabled!==0)throw Error('Disabled face changed '+disabled+' pixels on fixed head');
 if(horizontally<8||vertically<8)throw Error('Pupils did not visibly move without head rotation: H='+horizontally+' V='+vertically);
 if(blink<8)throw Error('Native fixed-head blink invisible: '+blink);
 if(errors.length)throw Error('GPU probe errors: '+errors.join('; '));
 console.log('PASS GPU fixed-head eye pixel motion: H='+horizontally+', V='+vertically+', blink='+blink+', neutral-diff='+same+', disabled-diff='+disabled);
 await page.evaluate(()=>window.eyeProbe.dispose());
 await page.close();
}finally{
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}
