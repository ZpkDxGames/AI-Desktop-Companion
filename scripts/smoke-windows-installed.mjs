/** Windows CI only: actual installed WebView2 + Rust bridge, deterministic loopback Ollama fixture.
 * Does not claim real model inference or owner GPU measurements.
 */
import {chromium} from 'playwright';import {createServer} from 'node:http';import {once} from 'node:events';
import {mkdir,writeFile} from 'node:fs/promises';
const requests=[];let scenario='success',active=0,maxActive=0,cancelled=0,reply='I have an idea that might help.',reaction='insight',resident=null;
const latencySamples=[];
const server=createServer(async(req,res)=>{
 let text='';for await(const chunk of req){text+=chunk;if(text.length>128*1024){res.writeHead(413).end();return;}}
 const data=text?JSON.parse(text):{};requests.push({path:req.url,model:data.model||null,keepAlive:data.keep_alive??null});
 const json=(value,status=200)=>res.writeHead(status,{'Content-Type':'application/json'}).end(JSON.stringify(value));
 if(req.url==='/api/tags')return json({models:[{name:'qwen3.5:4b'},{name:'llama3.2:3b'}]});
 if(req.url==='/api/show')return json({capabilities:data.model==='qwen3.5:4b'?['completion','vision','thinking']:['completion']});
 if(req.url==='/api/generate'){
  if(data.keep_alive!==0||data.prompt||data.messages) return json({},400);
  resident=null;return json({done:true,done_reason:'unload'});
 }
 if(req.url==='/api/chat'){
  if(data.stream!==false||![0,30,60].includes(data.keep_alive)||data.options?.num_ctx!==4096||data.tools||data.messages?.some(m=>m.images))return json({},400);
  if(scenario==='fallback'&&data.model==='qwen3.5:4b')return json({},503);
  if(scenario==='delay'){
   active++;maxActive=Math.max(maxActive,active);let ended=false;
   const timer=setTimeout(()=>{if(!ended)json({message:{content:'{"reply":"Delayed","reaction":"agree"}'}});},30000);
   res.on('close',()=>{if(!ended){ended=true;active--;cancelled++;clearTimeout(timer);}});return;
  }
  if(resident&&resident!==data.model)return json({error:'Previous retained model not released'},409);
  const cold=resident!==data.model,loadMs=cold?180:5;
  await new Promise(r=>setTimeout(r,loadMs+20));resident=data.keep_alive?data.model:null;
  return json({load_duration:loadMs*1e6,eval_duration:20e6,message:{content:JSON.stringify({reply,reaction})}});
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
 const retentionDenied=await workspace.evaluate(async()=>{try{
  await window.__TAURI__.core.invoke('ollama_chat',{model:'qwen3.5:4b',requestId:'invalid-retention',retentionSeconds:600,messages:[{role:'system',content:'Local fixture'},{role:'user',content:'Fixture'}]});return false;
 }catch{return true;}});
 if(!retentionDenied||requests.length)throw Error('Invalid retention escaped native validation');
 const received=[];
 await avatar.evaluate(async()=>{window.__testCues=[];window.__testCueOff=await window.__TAURI__.event.listen('zpkdx:reaction',e=>window.__testCues.push({kind:e.payload.kind,action:e.payload.action||null}));});
 await workspace.locator('[data-nav="behavior"]').click();await workspace.locator('#idle-mode').selectOption('off');
 await workspace.locator('[data-nav="conversation"]').click();
 for(const [text,action] of [['Can you walk?','walk'],['Show me how you run','run'],['Stop walking','idle'],['Can you shake your head?','shake'],['Stand still','idle']]){
  await workspace.locator('#chat-input').fill(text);await workspace.locator('#ai-send').click();
  await workspace.waitForFunction(a=>document.querySelector('#animation-status').textContent===a,action.toUpperCase());
  await avatar.waitForFunction(a=>window.__testCues.at(-1)?.action===a,action);
  received.push(action);
 }
 if(requests.length)throw Error('Installed offline avatar command contacted Ollama');
 await workspace.screenshot({path:'smoke-artifacts/v622-installed-offline-actions.png'});
 await avatar.screenshot({path:'smoke-artifacts/v622-installed-overlay-idle.png'});
 await avatar.evaluate(()=>window.__testCueOff());
 await workspace.locator('#ai-connect').click();
 await workspace.waitForFunction(()=>document.querySelector('#ai-model').value==='qwen3.5:4b');
 await workspace.locator('#chat-input').fill('Installed bridge fixture');await workspace.locator('#ai-send').click();
 await workspace.waitForFunction(()=>Array.from(document.querySelectorAll('.from-model')).some(n=>n.textContent.includes('I have an idea')));
 // Content-free installed reaction evidence, including repeated agreement with no neutral answer.
 await workspace.locator('.conversation-options summary').click();await workspace.locator('#ai-gesture-enabled').check();
 await workspace.locator('#ai-retention').selectOption('30');await workspace.locator('.conversation-options summary').click();
 const reactionMatrix=[];
 const turn=async(name,text,intent,action,reason)=>{
  scenario='success';reply=text;reaction=intent;
  await workspace.locator('#chat-input').fill('Installed reaction fixture');await workspace.locator('#ai-send').click();
  await workspace.waitForFunction(()=>document.querySelector('#ai-stop').disabled);
  const d=await workspace.locator('#ai-route-status').evaluate(n=>({...n.dataset}));
  if(d.reason!==reason||d.appliedReaction!==(action||reason==='effect_only'?intent:'neutral'))throw Error('Native reaction decision '+JSON.stringify(d));
  if(action)await avatar.waitForFunction(r=>document.querySelector('#overlay-canvas').dataset.appliedReaction===r,intent);
  if(action)await workspace.waitForFunction(a=>document.querySelector('#animation-status').textContent===a,action.toUpperCase());
  await workspace.waitForTimeout(220);
  await workspace.locator('#avatar-canvas').screenshot({path:'smoke-artifacts/v623-installed-'+name+'.png'});
  await avatar.locator('#overlay-canvas').screenshot({path:'smoke-artifacts/v623-installed-overlay-'+name+'.png'});
  reactionMatrix.push({name,...d});await workspace.waitForTimeout(3000);
 };
 await turn('nod-first',"You're absolutely correct.",'agree','nod','accepted_and_started');
 await workspace.waitForTimeout(9000);
 await turn('nod-repeat',"That makes sense, yes.",'agree','nod','accepted_and_started');
 await turn('shake','I disagree.','disagree','shake','accepted_and_started');
 await turn('shrug',"I'm not sure.",'uncertain','shrug','accepted_and_started');
 await turn('lightbulb','I have an idea that might help.','insight',null,'effect_only');
 await workspace.locator('.conversation-options summary').click();await workspace.locator('#ai-gesture-enabled').uncheck();await workspace.locator('.conversation-options summary').click();
 await turn('disabled',"That's right.",'agree',null,'automatic_gestures_disabled');
 // Five measured synthetic complete-response samples per mode, never described as model inference.
 for(const mode of [0,30,60]){
  await workspace.locator('.conversation-options summary').click();await workspace.locator('#ai-retention').selectOption(String(mode));await workspace.locator('.conversation-options summary').click();
  resident=null;
  for(let sample=1;sample<=5;sample++){
   await workspace.locator('#chat-input').fill('Installed latency fixture');await workspace.locator('#ai-send').click();
   await workspace.waitForFunction(()=>document.querySelector('#ai-stop').disabled);
   latencySamples.push({mode,sample,...await workspace.locator('#ai-route-status').evaluate(n=>({completeResponseMs:Number(n.dataset.completeResponseMs),loadMs:Number(n.dataset.loadMs),generationMs:Number(n.dataset.generationMs)}))});
  }
 }
 await writeFile('smoke-artifacts/v623-installed-reaction-matrix.json',JSON.stringify(reactionMatrix,null,2));
 await writeFile('smoke-artifacts/v623-installed-latency.json',JSON.stringify({environment:'Deterministic localhost fixture simulating 180/5ms load +20ms generation; NOT real model/GPU benchmark',latencySamples},null,2));
 scenario='fallback';await workspace.locator('#chat-input').fill('Installed fallback fixture');await workspace.locator('#ai-send').click();
 await workspace.waitForFunction(()=>document.querySelector('#ai-route-status').textContent.includes('Fallback used · llama3.2:3b')&&document.querySelector('#ai-stop').disabled);
 await workspace.screenshot({path:'smoke-artifacts/v62-installed-native-fallback.png'});
 scenario='delay';await workspace.locator('#chat-input').fill('Installed cancellation fixture');await workspace.locator('#ai-send').click();
 const began=Date.now();while(active===0&&Date.now()-began<10000)await new Promise(r=>setTimeout(r,100));
 if(active!==1)throw Error('Native delayed request missing');
 await workspace.locator('#ai-stop').click();await workspace.waitForFunction(()=>document.querySelector('#ai-stop').disabled);
 const cancelledAt=Date.now();while(active&&Date.now()-cancelledAt<5000)await new Promise(r=>setTimeout(r,100));
 if(active||!cancelled)throw Error('Native cancellation did not close the loopback request');
 if(maxActive!==1)throw Error('Overlapping native inference');
 await workspace.locator('#ai-clear').click();if(await workspace.locator('.from-model').count())throw Error('Native Clear retained reply');
 await workspace.locator('[data-nav="behavior"]').click();await workspace.locator('[data-action="shake"]').click();
 await workspace.waitForFunction(()=>document.querySelector('#animation-status').textContent==='SHAKE');
 await workspace.screenshot({path:'smoke-artifacts/v62-installed-native-shake.png'});
 await writeFile('smoke-artifacts/v62-installed-native.json',JSON.stringify({environment:'Windows-2022 installed NSIS / WebView2 / software GPU; fake localhost Ollama only',requests,maxActive,cancelled,offlineActions:received,overlayCommandDenied:denied,actualModels:'NOT RUN',ownerGPU:'NOT RUN'},null,2));
 console.log('PASS installed Windows NSIS/WebView2 actual native bridge: startup, workspace, metadata, text, fallback, targeted cancellation, overlay command denial, manual shake');
}catch(error){
 await writeFile('smoke-artifacts/native-failure.txt',String(error.stack||error));
 for(const [i,p] of (browser?.contexts().flatMap(c=>c.pages())||[]).entries())await p.screenshot({path:'smoke-artifacts/native-failure-'+i+'.png'}).catch(()=>{});
 throw error;
}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
