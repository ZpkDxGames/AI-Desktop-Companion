/** Emitted app/native-boundary mock: real WebGL, UI and allowlisted event delivery. */
import {chromium} from 'playwright';import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';import {resolve,extname,sep} from 'node:path';import {once} from 'node:events';
const root=resolve('dist'),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'};
const server=createServer(async(req,res)=>{try{let path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!path.startsWith(root+sep))throw Error();res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream'}).end(await readFile(path));}catch{res.writeHead(404).end();}});
server.listen(0,'127.0.0.1');await once(server,'listening');await mkdir('smoke-artifacts',{recursive:true});let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.COMPANION_CHROMIUM_PATH||undefined,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
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
    return JSON.stringify({reply:window.__reply||'Safe local answer <b>text only</b>',reaction:window.__reaction||'insight'});
   }
   return null;
  }},event:{listen:async(name,fn)=>{window.__listeners[name]=fn;return ()=>delete window.__listeners[name];},emit:async()=>{},emitTo:async(target,name,payload)=>window.__cueEvents.push({target,name,payload})}};
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/index.html');
 await page.waitForFunction(()=>document.querySelector('#avatar-canvas').dataset.renderReady==='true');
 if(await page.evaluate(()=>__nativeCalls.some(c=>c.cmd.startsWith('ollama'))))throw Error('Startup queried Ollama');
 await page.locator('[data-nav="conversation"]').click();
 // V6.2.2: the composer is in the viewport without scrolling its parent panel.
 await page.setViewportSize({width:1024,height:600});
 const baselineLayout=await page.locator('#ai-send').boundingBox();
 if(!baselineLayout||baselineLayout.y+baselineLayout.height>600)throw Error('Conversation composer below viewport');
 const direct=async(text,action)=>{
  await page.locator('#chat-input').fill(text);await page.locator('#ai-send').click();
  await page.waitForFunction(a=>document.querySelector('#animation-status').textContent===a,action.toUpperCase());
  if(!await page.locator('#ai-route-status').textContent().then(s=>s.includes('Local avatar action · no inference')))throw Error('Direct route mislabeled');
 };
 await direct('Can you walk?','walk');await direct('Show me how you run','run');await direct('Stop walking','idle');
 await direct('Can you shake your head?','shake');
 if(await page.evaluate(()=>__nativeCalls.some(c=>c.cmd.startsWith('ollama'))))throw Error('Offline action queried Ollama');
 await direct('Stop the animation','idle');
 await page.locator('#chat-input').fill('Can you run a program?');await page.locator('#ai-send').click();
 if(await page.evaluate(()=>__nativeCalls.some(c=>c.cmd.startsWith('ollama'))))throw Error('Offline text queried Ollama');
 if(!await page.locator('#ai-route-status').textContent().then(s=>s.includes('Text chat unavailable')))throw Error('Offline text did not explain connection');
 if(await page.locator('#animation-status').textContent()!=='IDLE')throw Error('Capability task triggered an action');
 // Rejection must produce no success wording or overlay action cue.
 await direct('Can you wave?','wave');
 const beforeRejected=await page.evaluate(()=>__cueEvents.filter(c=>c.payload.kind==='direct-action').length);
 await page.locator('#chat-input').fill('Start walking');await page.locator('#ai-send').click();
 if(!await page.locator('.from-model').last().textContent().then(s=>s.includes('could not start')))throw Error('Rejected action claimed success');
 if(await page.evaluate(()=>__cueEvents.filter(c=>c.payload.kind==='direct-action').length)!==beforeRejected)throw Error('Rejected action emitted cue');
 await direct('Stand still','idle');
 await page.setViewportSize({width:1120,height:780});await page.locator('#ai-connect').click();
 await page.waitForFunction(()=>document.querySelector('#ai-model').value==='qwen3.5:4b');
 if(await page.locator('#ai-fallback').inputValue()!=='llama3.2:3b')throw Error('Wrong fallback default');
 await page.locator('.conversation-options summary').click();await page.locator('#ai-gesture-enabled').check();await page.locator('.conversation-options summary').click();
 await page.evaluate(()=>window.__reply='Yes, that is correct.');
 await page.locator('#chat-input').fill('Can you walk and wave simultaneously?');await page.locator('#ai-send').click();
 await page.waitForFunction(()=>document.querySelector('#ai-stop').disabled);
 if(await page.evaluate(()=>__cueEvents.filter(e=>e.payload.kind==='answer').at(-1)?.payload.reaction)!=='neutral')throw Error('Ambiguous command produced a hidden answer gesture');
 await page.evaluate(()=>{window.__reply=null;window.__scenario='delay';});
 await page.locator('#chat-input').fill('Temporary private test prompt');await page.locator('#ai-send').click();
 await page.waitForFunction(()=>typeof __resolve==='function');
 await page.waitForTimeout(400);await page.screenshot({path:'smoke-artifacts/v62-chat-thinking.png'});
 const start=await page.evaluate(()=>__cueEvents.filter(e=>e.payload.kind==='request-start').at(-1));
 if(!start||JSON.stringify(start).includes('private'))throw Error('Missing or private cross-window event');
 await page.locator('[data-nav="behavior"]').click();await page.locator('[data-action="wave"]').click();await page.locator('[data-nav="conversation"]').click();
 await page.evaluate(()=>__resolve(JSON.stringify({reply:'Manual priority preserved',reaction:'disagree'})));
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('.from-model')).some(n=>n.textContent.includes('Manual priority')));
 if(await page.locator('#animation-status').textContent()==='SHAKE')throw Error('Reply interrupted manual wave');
 if(await page.evaluate(()=>__cueEvents.filter(e=>e.payload.kind==='answer').at(-1)?.payload.reaction)!=='neutral')throw Error('Manual suppression failed at overlay producer');
 await page.evaluate(()=>window.__scenario='fallback');
 await page.locator('#chat-input').fill('Fallback route test');await page.locator('#ai-send').click();
 await page.waitForFunction(()=>document.querySelector('#ai-route-status').textContent.includes('Fallback used · llama3.2:3b')&&document.querySelector('#ai-stop').disabled);
 if(await page.locator('.from-model b').count())throw Error('Reply HTML executed');
 await page.screenshot({path:'smoke-artifacts/v62-chat-fallback.png'});
 // Cancel and Clear terminate presentation immediately and retain no late reply.
 await page.evaluate(()=>window.__scenario='delay');await page.locator('#chat-input').fill('Cancel route test');await page.locator('#ai-send').click();
 await page.waitForFunction(()=>document.querySelector('#ai-stop').disabled===false);
 await page.locator('#ai-clear').click();await page.waitForFunction(()=>document.querySelector('#ai-stop').disabled===true);
 if(await page.locator('.from-model').count())throw Error('Clear retained reply');
 // A direct stop interrupts pending inference; the old reply may not reappear.
 await page.locator('#chat-input').fill('Pending cancellation fixture');await page.locator('#ai-send').click();
 await page.waitForFunction(()=>document.querySelector('#ai-stop').disabled===false);
 await direct('Stop moving','idle');
 await page.evaluate(()=>__resolve?.(JSON.stringify({reply:'STALE fixture reply',reaction:'celebrate'})));
 await page.waitForFunction(()=>document.querySelector('#ai-stop').disabled===true);
 if(await page.locator('#chat-history').textContent().then(t=>t.includes('STALE')))throw Error('Late reply after direct action');
 // Overlay is a consumer: deliver the exact shaped start cue and settle twice.
 const overlay=await context.newPage();await overlay.setViewportSize({width:252,height:370});
 await overlay.goto('http://127.0.0.1:'+server.address().port+'/index.html?mode=overlay');
 await overlay.waitForFunction(()=>document.querySelector('#overlay-canvas').dataset.renderReady==='true');
 await overlay.evaluate(cue=>__listeners['zpkdx:reaction']({payload:{...cue.payload,issuedAt:Date.now()}}),start);
 await overlay.waitForTimeout(350);await overlay.screenshot({path:'smoke-artifacts/v62-overlay-request-event.png'});
 await overlay.evaluate(cue=>{const payload={...cue.payload,seq:cue.payload.seq+1,kind:'cancel',issuedAt:Date.now(),ttlMs:5000};__listeners['zpkdx:reaction']({payload});__listeners['zpkdx:reaction']({payload});},start);
 await overlay.waitForTimeout(350);await overlay.screenshot({path:'smoke-artifacts/v62-overlay-cleared-event.png'});
 if(await overlay.evaluate(()=>__nativeCalls.some(c=>c.cmd.startsWith('ollama'))))throw Error('Overlay queried Ollama');
 // V6.2.3: model → grounded decision → real controller → rendered canvas → overlay.
 const reactionMatrix=[];
 const reactionTurn=async(name,reply,reaction,action,expected)=>{
  await page.evaluate(({reply,reaction})=>{window.__scenario='success';window.__reply=reply;window.__reaction=reaction;},{reply,reaction});
  const cueBegin=await page.evaluate(()=>__cueEvents.length);
  await page.locator('#chat-input').fill('Reaction verification fixture');await page.locator('#ai-send').click();
  await page.waitForFunction(()=>document.querySelector('#ai-stop').disabled);
  const decision=await page.locator('#ai-route-status').evaluate(n=>({...n.dataset}));
  if(decision.reason!==expected||decision.chosenReaction!==reaction)throw Error('Reaction decision mismatch '+JSON.stringify(decision));
  const events=await page.evaluate(i=>__cueEvents.slice(i),cueBegin);
  const remote=await overlay.locator('#overlay-canvas').evaluate(n=>({...n.dataset}));
  if(remote.appliedReaction!==decision.appliedReaction||action&&remote.controllerAction!==action)throw Error('Overlay reaction mismatch '+JSON.stringify({decision,remote,kinds:events.map(e=>e.payload.kind)}));
  for(const e of events)await overlay.evaluate(e=>__listeners['zpkdx:reaction']({payload:e.payload}),e);
  if(action){
   await overlay.waitForFunction(r=>document.querySelector('#overlay-canvas').dataset.appliedReaction===r,reaction);
   await page.waitForFunction(a=>document.querySelector('#animation-status').textContent===a,action.toUpperCase());
   const frames=[];
   for(let i=0;i<3;i++){
    await page.waitForTimeout(160);
    frames.push(await page.locator('#avatar-canvas').screenshot({path:`smoke-artifacts/v623-${name}-${i}.png`}));
    await overlay.locator('#overlay-canvas').screenshot({path:`smoke-artifacts/v623-overlay-${name}-${i}.png`});
   }
   if(frames[0].equals(frames[2]))throw Error('Rendered gesture canvas did not change');
  }else {await page.waitForTimeout(220);await page.screenshot({path:`smoke-artifacts/v623-${name}.png`});await overlay.locator('#overlay-canvas').screenshot({path:`smoke-artifacts/v623-overlay-${name}.png`});}
  reactionMatrix.push({name,...decision,overlayIntent:events.at(-1)?.payload.reaction});
  await page.waitForTimeout(3000);
 };
 await reactionTurn('nod-first',"You're absolutely correct.",'agree','nod','accepted_and_started');
 await page.waitForTimeout(9000);
 await reactionTurn('nod-repeat',"That makes sense, yes.",'agree','nod','accepted_and_started');
 await reactionTurn('shake','I disagree.','disagree','shake','accepted_and_started');
 await reactionTurn('shrug',"I don't know enough to say.",'uncertain','shrug','accepted_and_started');
 await reactionTurn('lightbulb','I have an idea that might help.','insight',null,'effect_only');
 await page.locator('.conversation-options summary').click();await page.locator('#ai-gesture-enabled').uncheck();await page.locator('.conversation-options summary').click();
 await reactionTurn('disabled',"That's right.",'agree',null,'automatic_gestures_disabled');
 if(await page.locator('#animation-status').textContent()==='NOD')throw Error('Disabled response animated');
 await writeFile('smoke-artifacts/v623-reaction-matrix.json',JSON.stringify(reactionMatrix,null,2));
 // Double submit performs one action; zero extra model calls.
 const doubleBefore=await page.evaluate(()=>({actions:__cueEvents.filter(e=>e.payload.kind==='direct-action').length,calls:__nativeCalls.filter(c=>c.cmd==='ollama_chat').length}));
 await page.locator('#chat-input').fill('Return to idle');
 await page.evaluate(()=>{document.querySelector('#chat-send-form').requestSubmit();document.querySelector('#chat-send-form').requestSubmit();});
 const doubleAfter=await page.evaluate(()=>({actions:__cueEvents.filter(e=>e.payload.kind==='direct-action').length,calls:__nativeCalls.filter(c=>c.cmd==='ollama_chat').length}));
 if(doubleAfter.actions!==doubleBefore.actions+1||doubleAfter.calls!==doubleBefore.calls)throw Error('Double submit duplicated action/inference');
 // Long, safely rendered reply; 2400-character input and bounded DOM history.
 await page.evaluate(()=>{window.__scenario='success';window.__reply='Long fixture https://example.invalid/'+ 'x'.repeat(1950);});
 await page.locator('#chat-input').fill('x'.repeat(2400));await page.locator('#ai-send').click();
 await page.waitForFunction(()=>document.querySelector('#ai-stop').disabled);
 for(let i=0;i<20;i++)await direct('Return to idle','idle');
 if(await page.locator('.chat-message').count()>30)throw Error('Unbounded message DOM');
 // Reading old messages must not jump on a reply, even while evicting the oldest item.
 await page.evaluate(()=>document.querySelector('#chat-history').scrollTop=180);
 const reading=await page.evaluate(()=>document.querySelector('#chat-history').scrollTop);
 await direct('Return to idle','idle');
 if(await page.evaluate(()=>{const h=document.querySelector('#chat-history');return h.scrollHeight-h.clientHeight-h.scrollTop<48;}))throw Error('Reply stole history scroll');
 if(!await page.locator('#chat-latest').isVisible())throw Error('Newest-message affordance missing');
 await page.locator('#chat-latest').click();
 if(await page.locator('#chat-latest').isVisible())throw Error('Newest-message affordance did not clear');
 const layouts=[];
 async function checkLayout(target,width,height,dpr,preferences=false){
  await target.setViewportSize({width,height});
  const result=await target.evaluate(()=>{
   const h=document.querySelector('#chat-history'),s=document.querySelector('.settings'),send=document.querySelector('#ai-send'),input=document.querySelector('#chat-input'),r=send.getBoundingClientRect();
   return {overflow:document.documentElement.scrollWidth>innerWidth+2,sendBottom:r.bottom,inputTop:input.getBoundingClientRect().top,
    panelScroll:s.scrollHeight>s.clientHeight+2,pageScroll:document.documentElement.scrollHeight>innerHeight+2,historyWidth:h.scrollWidth<=h.clientWidth+2,
    historyHeight:h.clientHeight,previewVisible:!!document.querySelector('#avatar-canvas').getBoundingClientRect().width};
  });
  if(result.overflow||result.sendBottom>height+1||result.inputTop<0||result.panelScroll||result.pageScroll||!result.historyWidth||result.historyHeight<48){
   await target.screenshot({path:'smoke-artifacts/v622-layout-failure.png'});
   const outside=await target.evaluate(()=>Array.from(document.querySelectorAll('body *')).filter(n=>{const r=n.getBoundingClientRect();return r.width&&r.right>innerWidth+2&&getComputedStyle(n).position!=='absolute';}).map(n=>n.id||n.className).slice(0,12));
   throw Error('Conversation layout failed '+JSON.stringify({width,height,dpr,preferences,...result,outside}));
  }
  layouts.push({width,height,dpr,preferences,...result});
 }
 for(const width of [360,390,480,700,800,1024,1280,1440])for(const height of [600,768,900])await checkLayout(page,width,height,1);
 for(const [width,height,label] of [[1280,900,'desktop'],[1024,600,'short'],[390,768,'narrow']]){
  await checkLayout(page,width,height,1);await page.screenshot({path:'smoke-artifacts/v622-conversation-'+label+'.png'});
 }
 await page.evaluate(()=>{document.querySelector('#ai-model').selectedOptions[0].textContent='local-'+ 'x'.repeat(74)+' · text';});
 for(const [width,height] of [[360,600],[800,600],[1440,900]])await checkLayout(page,width,height,1);
 await page.evaluate(()=>{document.querySelector('#ai-model').selectedOptions[0].textContent='qwen3.5:4b · text + vision capable';});
 await page.locator('.conversation-options summary').click();
 for(const [width,height] of [[360,600],[800,600],[1280,768]])await checkLayout(page,width,height,1,true);
 await page.screenshot({path:'smoke-artifacts/v622-conversation-preferences.png'});await page.locator('.conversation-options summary').click();
 // Enlarged text and keyboard-only Send, not CSS zoom pretending to be Windows display scaling.
 await page.setViewportSize({width:800,height:768});await page.evaluate(()=>{for(const n of document.querySelectorAll('.conversation-panel label,.conversation-panel p,.conversation-panel button,.conversation-panel select,.conversation-panel textarea,.conversation-panel summary,.conversation-panel h2,.conversation-panel span,.conversation-panel strong'))n.style.fontSize=parseFloat(getComputedStyle(n).fontSize)*1.25+'px';});
 await page.locator('#chat-input').fill('Stand still');await page.locator('#chat-input').focus();await page.keyboard.press('Tab');
 if(!await page.locator('#ai-send').evaluate(n=>n===document.activeElement))throw Error('Composer keyboard focus order');
 await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('#chat-input').value==='');
 await checkLayout(page,800,768,1);await page.evaluate(()=>{for(const n of document.querySelectorAll('.conversation-panel [style]'))n.style.removeProperty('font-size');});
 const scaled=await browser.newContext({viewport:{width:1024,height:768},deviceScaleFactor:2,reducedMotion:'reduce'});
 const scaledPage=await scaled.newPage();await scaledPage.goto('http://127.0.0.1:'+server.address().port+'/index.html');
 await scaledPage.waitForFunction(()=>document.querySelector('#avatar-canvas').dataset.renderReady==='true');await scaledPage.locator('[data-nav="conversation"]').click();
 for(const [width,height] of [[360,600],[390,768],[800,600],[1024,768],[1440,900]])await checkLayout(scaledPage,width,height,2);
 await scaled.close();
 await writeFile('smoke-artifacts/v622-layout-matrix.json',JSON.stringify({layouts,readingOffset:reading,textEnlargement:'125% panel; keyboard',windowsScaling:'NOT RUN on owner device'},null,2));
 await page.setViewportSize({width:1120,height:780});
 const metricsSession=await context.newCDPSession(page);await metricsSession.send('Performance.enable');
 const measurements=[];
 await page.locator('[data-nav="behavior"]').click();await page.locator('#idle-mode').selectOption('off');await page.locator('[data-nav="conversation"]').click();
 for(let run=1;run<=3;run++)for(const action of ['idle','walk']){
  await direct(action==='idle'?'Stand still':'Can you walk?',action);await page.waitForTimeout(3200);
  const before=await metricsSession.send('Performance.getMetrics');await page.waitForTimeout(1800);const after=await metricsSession.send('Performance.getMetrics');
  const metric=(data,name)=>data.metrics.find(m=>m.name===name)?.value;
  measurements.push({run,action,fps:await page.locator('#render-fps').textContent(),renderCpuPercentiles:await page.locator('#frame-percentiles').textContent(),
   jsHeapMiB:metric(after,'JSHeapUsedSize')/1048576,browserTaskSeconds:metric(after,'TaskDuration')-metric(before,'TaskDuration'),sampleWindowSeconds:1.8});
 }
 await direct('Stand still','idle');await metricsSession.detach();
 await writeFile('smoke-artifacts/v622-performance.json',JSON.stringify({environment:'Chromium software WebGL; render-call CPU costs, not GPU frame times',measurements,ownerRTX3050:'NOT RUN'},null,2));
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
