/** Emitted app/native-boundary mock: real WebGL, UI and allowlisted event delivery. */
import {chromium} from 'playwright';import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';import {resolve,extname,sep} from 'node:path';import {once} from 'node:events';
const root=resolve('dist'),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'};
const server=createServer(async(req,res)=>{try{let path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!path.startsWith(root+sep))throw Error();res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream'}).end(await readFile(path));}catch{res.writeHead(404).end();}});
server.listen(0,'127.0.0.1');await once(server,'listening');await mkdir('smoke-artifacts',{recursive:true});let browser;
try{
 browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
 const context=await browser.newContext({viewport:{width:1120,height:780}});
 await context.addInitScript(()=>{
  const realFetch=fetch;window.__nativeCalls=[];window.__cueEvents=[];window.__listeners={};window.__scenario='success';
  window.fetch=(url,opts)=>{if(String(url).includes('11434'))throw Error('Native path regressed to fetch');return realFetch(url,opts);};
  window.__TAURI__={core:{invoke:async(cmd,args={})=>{
   window.__nativeCalls.push({cmd,args});
   if(cmd==='ollama_list_models')return ['qwen3.5:4b','llama3.2:3b'];
   if(cmd==='ollama_model_info')return {local:true,capabilities:args.model.startsWith('qwen')?['completion','vision','thinking']:['completion']};
   if(cmd==='ollama_cancel'){window.__reject?.('Local request cancelled');return true;}
   if(cmd==='ollama_chat'){
    if(window.__scenario==='delay')return new Promise((yes,no)=>{window.__resolve=yes;window.__reject=no;});
    if(window.__scenario==='fallback'&&args.model==='qwen3.5:4b')throw 'Ollama responded with HTTP 503';
    return JSON.stringify({reply:'Safe local answer <b>text only</b>',reaction:'insight'});
   }
   return null;
  }},event:{listen:async(name,fn)=>{window.__listeners[name]=fn;return ()=>delete window.__listeners[name];},emit:async()=>{},emitTo:async(target,name,payload)=>window.__cueEvents.push({target,name,payload})}};
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/index.html');
 await page.waitForFunction(()=>document.querySelector('#avatar-canvas').dataset.renderReady==='true');
 if(await page.evaluate(()=>__nativeCalls.some(c=>c.cmd.startsWith('ollama'))))throw Error('Startup queried Ollama');
 await page.locator('[data-nav="conversation"]').click();await page.locator('#ai-connect').click();
 await page.waitForFunction(()=>document.querySelector('#ai-model').value==='qwen3.5:4b');
 if(await page.locator('#ai-fallback').inputValue()!=='llama3.2:3b')throw Error('Wrong fallback default');
 await page.locator('#ai-gesture-enabled').check();await page.evaluate(()=>window.__scenario='delay');
 await page.locator('#chat-input').fill('Temporary private test prompt');await page.locator('#ai-send').click();
 await page.waitForFunction(()=>typeof __resolve==='function');
 await page.waitForTimeout(400);await page.screenshot({path:'smoke-artifacts/v62-chat-thinking.png'});
 const start=await page.evaluate(()=>__cueEvents.find(e=>e.payload.kind==='request-start'));
 if(!start||JSON.stringify(start).includes('private'))throw Error('Missing or private cross-window event');
 await page.locator('[data-nav="behavior"]').click();await page.locator('[data-action="wave"]').click();await page.locator('[data-nav="conversation"]').click();
 await page.evaluate(()=>__resolve(JSON.stringify({reply:'Manual priority preserved',reaction:'disagree'})));
 await page.waitForFunction(()=>document.querySelector('.from-model')?.textContent.includes('Manual priority'));
 if(await page.locator('#animation-status').textContent()==='SHAKE')throw Error('Reply interrupted manual wave');
 if(await page.evaluate(()=>__cueEvents.filter(e=>e.payload.kind==='answer').at(-1)?.payload.reaction)!=='neutral')throw Error('Manual suppression failed at overlay producer');
 await page.evaluate(()=>window.__scenario='fallback');
 await page.locator('#chat-input').fill('Fallback route test');await page.locator('#ai-send').click();
 await page.waitForFunction(()=>document.querySelector('#ai-route-status').textContent.includes('Fallback used · llama3.2:3b')&&!document.querySelector('#ai-send').disabled);
 if(await page.locator('.from-model b').count())throw Error('Reply HTML executed');
 await page.screenshot({path:'smoke-artifacts/v62-chat-fallback.png'});
 // Cancel and Clear terminate presentation immediately and retain no late reply.
 await page.evaluate(()=>window.__scenario='delay');await page.locator('#chat-input').fill('Cancel route test');await page.locator('#ai-send').click();
 await page.waitForFunction(()=>document.querySelector('#ai-stop').disabled===false);
 await page.locator('#ai-clear').click();await page.waitForFunction(()=>document.querySelector('#ai-send').disabled===false);
 if(await page.locator('.from-model').count())throw Error('Clear retained reply');
 // Overlay is a consumer: deliver the exact shaped start cue and settle twice.
 const overlay=await context.newPage();await overlay.setViewportSize({width:252,height:370});
 await overlay.goto('http://127.0.0.1:'+server.address().port+'/index.html?mode=overlay');
 await overlay.waitForFunction(()=>document.querySelector('#overlay-canvas').dataset.renderReady==='true');
 await overlay.evaluate(cue=>__listeners['zpkdx:reaction']({payload:{...cue.payload,issuedAt:Date.now()}}),start);
 await overlay.waitForTimeout(350);await overlay.screenshot({path:'smoke-artifacts/v62-overlay-request-event.png'});
 await overlay.evaluate(cue=>{const payload={...cue.payload,seq:100,kind:'cancel',issuedAt:Date.now(),ttlMs:5000};__listeners['zpkdx:reaction']({payload});__listeners['zpkdx:reaction']({payload});},start);
 await overlay.waitForTimeout(350);await overlay.screenshot({path:'smoke-artifacts/v62-overlay-cleared-event.png'});
 if(await overlay.evaluate(()=>__nativeCalls.some(c=>c.cmd.startsWith('ollama'))))throw Error('Overlay queried Ollama');
 // Preference layout and persistence; no text in settings.
 await page.locator('[data-nav="behavior"]').click();await page.locator('#sleepy-enabled').check();await page.locator('#quiet-threshold').selectOption('180');
 for(const size of [{width:840,height:650},{width:1120,height:780}]){await page.setViewportSize(size);if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2))throw Error('Overflow');}
 await page.screenshot({path:'smoke-artifacts/v62-expression-studio.png'});
 const saved=await page.evaluate(()=>localStorage.getItem('zpkdx-avatar-v0.1'));
 if(saved.includes('private')||saved.includes('Fallback route test'))throw Error('Prompt persisted');
 await page.reload();await page.waitForFunction(()=>document.querySelector('#avatar-canvas').dataset.renderReady==='true');
 await page.locator('[data-nav="behavior"]').click();if(!await page.locator('#sleepy-enabled').isChecked()||await page.locator('#quiet-threshold').inputValue()!=='180')throw Error('Preferences lost');
 const checkpoint=await page.evaluate(()=>Object.keys(__listeners).length);
 await page.evaluate(()=>(window.__lostContext=document.querySelector('#avatar-canvas').getContext('webgl2').getExtension('WEBGL_lose_context')).loseContext());
 await page.waitForTimeout(300);
 await page.evaluate(()=>window.__lostContext.restoreContext());
 await page.waitForFunction(()=>document.querySelector('#avatar-canvas').dataset.renderReady==='true'&&document.querySelector('#runtime-alert').hidden,{timeout:15000});
 if(await page.evaluate(()=>Object.keys(__listeners).length)!==checkpoint)throw Error('Listener leak on context restore');
 const evidence=await page.evaluate(()=>({commands:__nativeCalls.map(c=>c.cmd)}));
 await writeFile('smoke-artifacts/v62-native-ui-evidence.json',JSON.stringify({startupAfterReload:evidence,errors},null,2));
 if(errors.length)throw Error(errors.join('; '));console.log('PASS V6.2 emitted UI: native-only mock, Qwen/Llama capabilities, fallback, manual priority, clear/cancel, overlay cues, settings/privacy');
 await context.close();
}finally{await browser?.close();await new Promise(r=>server.close(r));}
