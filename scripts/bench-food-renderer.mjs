/** Matched fixed-pose food workload; gl.finish is evidence-only, never app code.
 * node scripts/bench-food-renderer.mjs <baseline-repository> <output.json>
 * Requires isolated Playwright 1.56.1 and its Chromium, like capture-motion.mjs.
 */
import {build} from 'vite';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {once} from 'node:events';
import {execFileSync} from 'node:child_process';
const repositories=[resolve(process.argv[2]),process.cwd()],out=resolve(process.argv[3]||'food-renderer.json');
const mime={'.html':'text/html','.js':'text/javascript','.png':'image/png'},sources=[];
for(const root of repositories){
 const directory=resolve(root,'dist/food-benchmark');await mkdir(directory,{recursive:true});
 await writeFile(resolve(root,'dist/food-benchmark-entry.js'),"export {AvatarRenderer} from '../web/js/engine/renderer.js';export {BehaviorController} from '../web/js/avatar/animation.js';");
 await build({configFile:false,root,logLevel:'error',build:{target:'es2020',outDir:directory,emptyOutDir:false,lib:{entry:resolve(root,'dist/food-benchmark-entry.js'),formats:['es'],fileName:'motion'}}});
 await writeFile(resolve(directory,'index.html'),'<!doctype html><html><body style="margin:0"><div style="width:320px;height:400px"><canvas></canvas></div></body></html>');
 sources.push({root,commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),dirty:!!execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim()});
}
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost'),match=/^\/([01])\/(.*)$/.exec(url.pathname);if(!match)throw Error('route');
 const root=resolve(repositories[+match[1]],'dist/food-benchmark'),file=resolve(root,match[2]||'index.html');if(!file.startsWith(root+sep))throw Error('path');
 res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'}).end(await readFile(file));
}catch{res.writeHead(404).end();}});server.listen(0,'127.0.0.1');await once(server,'listening');
let browser;
const result={method:'Fixed eating pose at 1.45 s, Classic, 320x400/DPR 1, crumbs suppressed. 30 warm-up + 120 measured frames; two sequential trials. Synchronous gl.finish plus one-pixel readPixels fence includes completed software WebGL work and readback overhead, not native GPU time or displayed FPS.',sources,cases:[]};
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.COMPANION_CHROMIUM_PATH||undefined,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});result.browser=browser.version();
 for(let trial=1;trial<=2;trial++)for(let source=0;source<2;source++){
  const page=await browser.newPage({viewport:{width:320,height:400},deviceScaleFactor:1}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/${source}/index.html`);
  await page.evaluate(async({source,skin})=>{
   window.mod=await import(`/${source}/motion.js`);const img=new Image();img.src='data:image/png;base64,'+skin;await img.decode();
   window.r=new mod.AvatarRenderer(document.querySelector('canvas'));await r.setSkin(img);r.baseYaw=0;
  },{source,skin:(await readFile(resolve(repositories[source],'web/assets/sample-skin.png'))).toString('base64')});
  for(const food of ['apple','cooked_porkchop','golden_carrot','cake_slice']){
   const sample=await page.evaluate(food=>{
    const c=new mod.BehaviorController({seed:2026});c.request('eat');for(let i=0;i<174;i++)c.update(1/120);c.foodVariant=food;c.updatePresentation();
    const pose=c.pose(),options={rotation:0,action:c.action,actionElapsed:c.elapsed,activity:c.activity,presentation:c.presentation,foodVariant:food,dt:1/60},gl=r.viewer.renderer.getContext();
    // Isolate the solid item cost; no moving crumb workload or queue carryover.
    r.effects.reducedMotion=true;gl.finish();const pixel=new Uint8Array(4),submit=[],complete=[];
    for(let i=0;i<150;i++){const start=performance.now();r.render(pose,options);const submitted=performance.now();gl.finish();gl.readPixels(160,200,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);if(i>=30){submit.push(submitted-start);complete.push(performance.now()-start);}if(gl.isContextLost())throw Error('Benchmark context lost');}
    if(!r.props.food.visible||!r.props.itemModels.get(food).group.visible||c.presentation.foodVariant!==food)throw Error('Benchmark did not render requested food');
    const quantiles=rows=>{rows.sort((a,b)=>a-b);return {p50:rows[Math.floor(rows.length*.5)],p95:rows[Math.floor(rows.length*.95)],p99:rows[Math.floor(rows.length*.99)]};};
    return {submissionMs:quantiles(submit),completedRenderMs:quantiles(complete),triangles:r.props.itemModels.get(food).geometry.attributes.position.count/3,visible:true};
   },food);result.cases.push({trial,source:source===0?'before':'after',food,...sample});console.log(JSON.stringify(result.cases.at(-1)));
  }
  if(errors.length)throw Error(errors.join('\n'));await page.evaluate(()=>r.dispose());await page.close();
 }
 await mkdir(resolve(out,'..'),{recursive:true});await writeFile(out,JSON.stringify(result,null,2)+'\n');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
