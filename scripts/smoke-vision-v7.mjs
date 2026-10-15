/** Production WebGL UI + explicit fake native provider. NOT Rust or real model certification. */
import {chromium} from 'playwright';import {createServer} from 'node:http';import {once} from 'node:events';
import {readFile,mkdir} from 'node:fs/promises';import {resolve,extname} from 'node:path';import {visionProbes} from './vision-probes.mjs';
const root=resolve('dist'),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'};
const server=createServer(async(req,res)=>{try{const path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!path.startsWith(root))throw Error();res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream'}).end(await readFile(path));}catch{res.writeHead(404).end();}});
server.listen(0,'127.0.0.1');await once(server,'listening');await mkdir('smoke-artifacts',{recursive:true});let browser;
try{
 browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
 const context=await browser.newContext();
 await context.addInitScript(()=>{
  window.__visionFixture={count:0,mode:'success',lastText:null,active:false};let token=null;
  const overlay=location.search.includes('overlay');
  window.__TAURI__={core:{invoke:async(cmd,args={})=>{
   const f=window.__visionFixture;
   if(overlay&&/^(vision_|ollama_)/.test(cmd))throw 'Workspace only';
   if(cmd==='ollama_list_models')return ['qwen3.5:4b','llama3.2:3b'];
   if(cmd==='ollama_model_info')return {local:true,capabilities:args.model.startsWith('qwen')?['completion','vision']:['completion']};
   if(cmd==='vision_clear'){token=null;return;}
   if(cmd==='ollama_cancel'){f.reject?.('Local request cancelled');f.active=false;return;}
   if(cmd==='vision_prepare'){
    const i=args.input;
    if(Object.keys(i).some(k=>!['selectionId','mime','base64'].includes(k))||i.mime!=='image/png'||!i.base64.startsWith('iVBOR'))throw 'Invalid source';
    token=i.selectionId;return {token,width:80,height:60,bytes:200,base64:i.base64};
   }
   if(cmd==='vision_analyze'){
    const i=args.input;if(i.token!==token||!token)throw 'Expired preview';token=null;
    if(['no-vision','remote'].includes(f.mode))throw 'Selected model has no verified local vision';f.count++;if(f.mode==='vision-error')throw 'Ollama HTTP 503';f.active=true;
    if(f.mode==='delay')return new Promise((resolve,reject)=>{f.reject=reject;});
    f.active=false;return {content:JSON.stringify({reply:'A synthetic image with green and dark shapes.',reaction:'insight'})};
   }
   if(cmd==='ollama_chat'){f.lastText=args.messages;return {content:'{"reply":"Fresh text response.","reaction":"neutral"}'};}
  }},event:{listen:async()=>()=>{},emit:async()=>{},emitTo:async()=>{}}};
 });
 const page=await context.newPage(),avatar=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url='http://127.0.0.1:'+server.address().port+'/index.html';await page.goto(url);await avatar.goto(url+'?mode=overlay');
 await page.waitForFunction(()=>document.querySelector('#avatar-canvas').dataset.renderReady==='true');
 await page.locator('[data-nav="conversation"]').click();await page.locator('#ai-connect').click();await page.waitForFunction(()=>document.querySelector('#ai-model').value==='qwen3.5:4b');
 await visionProbes(page,avatar,{
  environment:'Chromium software WebGL + FAKE native provider; no Rust/Ollama/hardware certification',
  countImages:()=>page.evaluate(()=>__visionFixture.count),mode:mode=>page.evaluate(mode=>__visionFixture.mode=mode,mode),
  waitImage:()=>page.waitForFunction(()=>__visionFixture.active),
  assertTextClean:async()=>{if(!await page.evaluate(()=>!JSON.stringify(__visionFixture.lastText).includes('synthetic')&&!__visionFixture.lastText.some(m=>m.images)))throw Error('Visual content leaked to text');}
 });
 for(const dpr of [1.25,1.5,2]){
  const dpiContext=await browser.newContext({viewport:{width:840,height:650},deviceScaleFactor:dpr});
  const dpiPage=await dpiContext.newPage();await dpiPage.goto(url);await dpiPage.locator('[data-nav="conversation"]').click();
  const r=await dpiPage.locator('#ai-clear').boundingBox();if(!r||r.y+r.height>650)throw Error('DPI composer clipped '+dpr);
  await dpiPage.screenshot({path:'smoke-artifacts/v7-dpr-'+dpr+'.png'});await dpiContext.close();
 }
 if(errors.length)throw Error(errors.join('\n'));console.log('PASS production V7 consent, preview, layouts, 25 cleanup cycles, routing and cancel (fake native)');
}catch(error){for(const p of (browser?.contexts().flatMap(c=>c.pages())||[]).filter(p=>!p.url().includes('overlay')))await p.screenshot({path:'smoke-artifacts/v7-browser-failure.png'}).catch(()=>{});throw error;}
finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
