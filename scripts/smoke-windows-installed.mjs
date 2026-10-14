/** Windows CI only: actual installed WebView2 + Rust bridge, deterministic loopback Ollama fixture.
 * Does not claim real model inference or owner GPU measurements.
 */
import {chromium} from 'playwright';import {createServer} from 'node:http';import {once} from 'node:events';
import {mkdir,writeFile} from 'node:fs/promises';
const requests=[];let scenario='success',active=0,maxActive=0,cancelled=0;
const server=createServer(async(req,res)=>{
 let text='';for await(const chunk of req){text+=chunk;if(text.length>128*1024){res.writeHead(413).end();return;}}
 const data=text?JSON.parse(text):{};requests.push({path:req.url,model:data.model||null});
 const json=(value,status=200)=>res.writeHead(status,{'Content-Type':'application/json'}).end(JSON.stringify(value));
 if(req.url==='/api/tags')return json({models:[{name:'qwen3.5:4b'},{name:'llama3.2:3b'}]});
 if(req.url==='/api/show')return json({capabilities:data.model==='qwen3.5:4b'?['completion','vision','thinking']:['completion']});
 if(req.url==='/api/chat'){
  if(data.stream!==false||data.keep_alive!==0||data.options?.num_ctx!==4096||data.tools||data.messages?.some(m=>m.images))return json({},400);
  if(scenario==='fallback'&&data.model==='qwen3.5:4b')return json({},503);
  if(scenario==='delay'){
   active++;maxActive=Math.max(maxActive,active);let ended=false;
   const timer=setTimeout(()=>{if(!ended)json({message:{content:'{"reply":"Delayed","reaction":"agree"}'}});},30000);
   res.on('close',()=>{if(!ended){ended=true;active--;cancelled++;clearTimeout(timer);}});return;
  }
  return json({message:{content:JSON.stringify({reply:'Installed native bridge response',reaction:'insight'})}});
 }
 return json({},404);
});
server.listen(11434,'127.0.0.1');await once(server,'listening');await mkdir('smoke-artifacts',{recursive:true});
let browser;
try{
 const deadline=Date.now()+45000;
 while(!browser&&Date.now()<deadline){try{browser=await chromium.connectOverCDP('http://127.0.0.1:9222');}catch{await new Promise(r=>setTimeout(r,500));}}
 if(!browser)throw Error('Installed WebView2 CDP endpoint unavailable');
 const pages=()=>browser.contexts().flatMap(c=>c.pages());
 let avatar,workspace;
 for(let i=0;i<60;i++){
  avatar=pages().find(p=>p.url().includes('mode=overlay'));
  if(avatar)break;await new Promise(r=>setTimeout(r,250));
 }
 if(!avatar){await writeFile('smoke-artifacts/native-targets.json',JSON.stringify(pages().map(p=>p.url())));throw Error('Installed overlay target missing');}
 await avatar.waitForFunction(()=>window.__TAURI__?.core?.invoke);
 await avatar.evaluate(()=>window.__TAURI__.core.invoke('open_workshop'));
 // Hidden WebView2 targets may be deferred; URLs may canonicalize index.html to /.
 for(let i=0;i<80;i++){
  workspace=pages().find(p=>p!==avatar&&!p.url().includes('mode=overlay')&&p.url().includes('tauri.localhost'));
  if(workspace)break;await new Promise(r=>setTimeout(r,250));
 }
 if(!workspace){await writeFile('smoke-artifacts/native-targets.json',JSON.stringify(pages().map(p=>p.url())));throw Error('Installed Workspace target missing after explicit show');}
 await workspace.waitForFunction(()=>document.querySelector('#avatar-canvas')?.dataset.renderReady==='true',null,{timeout:20000});
 if(requests.length)throw Error('Installed app contacted Ollama before explicit Connect');
 // Assert the native window-label boundary itself, not a mocked invoke function.
 const denied=await avatar.evaluate(async()=>{try{await window.__TAURI__.core.invoke('ollama_list_models');return false;}catch{return true;}});
 if(!denied)throw Error('Overlay was allowed to query Ollama');
 await workspace.locator('[data-nav="conversation"]').click();await workspace.locator('#ai-connect').click();
 await workspace.waitForFunction(()=>document.querySelector('#ai-model').value==='qwen3.5:4b');
 await workspace.locator('#chat-input').fill('Installed bridge fixture');await workspace.locator('#ai-send').click();
 await workspace.waitForFunction(()=>document.querySelector('.from-model')?.textContent.includes('Installed native bridge response'));
 scenario='fallback';await workspace.locator('#chat-input').fill('Installed fallback fixture');await workspace.locator('#ai-send').click();
 await workspace.waitForFunction(()=>document.querySelector('#ai-route-status').textContent.includes('Fallback used · llama3.2:3b')&&!document.querySelector('#ai-send').disabled);
 await workspace.screenshot({path:'smoke-artifacts/v62-installed-native-fallback.png'});
 scenario='delay';await workspace.locator('#chat-input').fill('Installed cancellation fixture');await workspace.locator('#ai-send').click();
 const began=Date.now();while(active===0&&Date.now()-began<10000)await new Promise(r=>setTimeout(r,100));
 if(active!==1)throw Error('Native delayed request missing');
 await workspace.locator('#ai-stop').click();await workspace.waitForFunction(()=>!document.querySelector('#ai-send').disabled);
 const cancelledAt=Date.now();while(active&&Date.now()-cancelledAt<5000)await new Promise(r=>setTimeout(r,100));
 if(active||!cancelled)throw Error('Native cancellation did not close the loopback request');
 if(maxActive!==1)throw Error('Overlapping native inference');
 await workspace.locator('#ai-clear').click();if(await workspace.locator('.from-model').count())throw Error('Native Clear retained reply');
 await workspace.locator('[data-nav="behavior"]').click();await workspace.locator('[data-action="shake"]').click();
 await workspace.waitForFunction(()=>document.querySelector('#animation-status').textContent==='SHAKE');
 await workspace.screenshot({path:'smoke-artifacts/v62-installed-native-shake.png'});
 await writeFile('smoke-artifacts/v62-installed-native.json',JSON.stringify({environment:'Windows-2022 installed NSIS / WebView2 / software GPU; fake localhost Ollama only',requests,maxActive,cancelled,overlayCommandDenied:denied,actualModels:'NOT RUN',ownerGPU:'NOT RUN'},null,2));
 console.log('PASS installed Windows NSIS/WebView2 actual native bridge: startup, workspace, metadata, text, fallback, targeted cancellation, overlay command denial, manual shake');
}catch(error){
 await writeFile('smoke-artifacts/native-failure.txt',String(error.stack||error));
 for(const [i,p] of (browser?.contexts().flatMap(c=>c.pages())||[]).entries())await p.screenshot({path:'smoke-artifacts/native-failure-'+i+'.png'}).catch(()=>{});
 throw error;
}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
