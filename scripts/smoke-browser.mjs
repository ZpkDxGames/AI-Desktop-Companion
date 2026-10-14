/**
 * Production-only runtime smoke gate.
 * Run AFTER "npm run build:web": verifies the actual emitted assets in Chromium,
 * with clean browser storage and both app URLs (Workshop and overlay).
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, normalize, sep } from 'node:path';
import { once } from 'node:events';

const root = resolve('dist');
const contentTypes = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.ico':'image/x-icon', '.svg':'image/svg+xml' };
const server = createServer(async(req,res)=>{
  try {
    const url = new URL(req.url,'http://localhost');
    const resource = decodeURIComponent(url.pathname);
    const path = resolve(root, '.'+resource);
    if (path !== root && !path.startsWith(root+sep)) {res.writeHead(403).end();return;}
    const data = await readFile(path===root?resolve(root,'index.html'):path);
    res.writeHead(200,{'Content-Type':contentTypes[extname(path)]||'application/octet-stream','Cache-Control':'no-store'}).end(data);
  } catch { res.writeHead(404).end('not found'); }
});
server.listen(0,'127.0.0.1');await once(server,'listening');
const port=server.address().port;

async function facePixelGate(page,mode,surface){
 const seed=(await readFile(resolve('web/assets/sample-skin.png'))).toString('base64');
 const skin=await page.evaluate(async png=>{
  const image=new Image();image.src='data:image/png;base64,'+png;await image.decode();
  const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
  const data=ctx.getImageData(0,0,64,64);
  const put=(x,y,color)=>data.data.set(color,(y*64+x)*4);
  const hair=[44,42,39,255],white=[255,255,255,255],iris=[59,118,127,255],
    pupil=[32,94,104,255],lid=[240,207,185,255],transparent=[0,0,0,0];
  for(let x=24;x<28;x++){
   put(x,2,lid);put(x,3,x===24||x===27?white:iris);
   put(x,4,x===24||x===27?white:pupil);
  }
  put(9,12,hair);put(10,12,iris);put(13,12,iris);put(14,12,hair);
  put(9,13,white);put(10,13,pupil);put(13,13,pupil);put(14,13,white);
  put(41,12,hair);put(42,12,transparent);put(45,12,transparent);put(46,12,hair);
  for(const x of [41,42,45,46])put(x,13,transparent);
  ctx.putImageData(data,0,0);return canvas.toDataURL('image/png');
 },seed);
 if(mode==='workshop'){
  await page.locator('#skin-upload').setInputFiles({name:'synthetic-eye-test.png',
    mimeType:'image/png',buffer:Buffer.from(skin.split(',')[1],'base64')});
  await page.waitForFunction(()=>document.querySelector('#face-marker-status')?.dataset.supported==='true',null,{timeout:10000});
  await page.evaluate(()=>{const e=document.querySelector('#expressions-enabled');e.checked=true;e.dispatchEvent(new Event('change',{bubbles:true}));});
 }else{
  await page.evaluate(skin=>localStorage.setItem('zpkdx-avatar-v0.1',JSON.stringify({
   modelMode:'auto',scale:100,follow:true,expressions:true,skin,skinName:'Synthetic eye fixture'
  })),skin);
  await page.reload({waitUntil:'load'});
  await page.waitForFunction(()=>document.querySelector('#overlay-canvas')?.dataset.renderReady==='true',null,{timeout:12000});
 }
 // Screenshot differences are measured on actual rendered WebGL canvas pixels,
 // not controller state or transforms. Head-only motion is rejected separately
 // by unit-level composed iris+pupil displacement gates.
 const size=page.viewportSize(),locations={
  left:{x:16,y:Math.round(size.height*.48)},
  right:{x:size.width-16,y:Math.round(size.height*.48)},
  up:{x:Math.round(size.width*.5),y:16},
  down:{x:Math.round(size.width*.5),y:size.height-16}
 };
 const shots={};
 for(const [direction,point] of Object.entries(locations)){
  await page.mouse.move(point.x,point.y);
  await page.waitForTimeout(650);
  shots[direction]=await surface.screenshot({path:'smoke-artifacts/face-'+mode+'-'+direction+'.png'});
 }
 const pixelChanges=async(a,b)=>page.evaluate(async ([one,two])=>{
  const load=async input=>{
   const image=new Image();image.src='data:image/png;base64,'+input;await image.decode();
   const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
   const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
   return ctx.getImageData(0,0,canvas.width,canvas.height);
  };
  const x=await load(one),y=await load(two);
  if(x.width!==y.width||x.height!==y.height)throw new Error('Eye screenshot size changed unexpectedly');
  let changed=0;
  for(let i=0;i<x.data.length;i+=4){
   if(Math.abs(x.data[i]-y.data[i])+Math.abs(x.data[i+1]-y.data[i+1])+Math.abs(x.data[i+2]-y.data[i+2])>36)changed++;
  }
  return changed;
 },[a.toString('base64'),b.toString('base64')]);
 const horizontal=await pixelChanges(shots.left,shots.right);
 const vertical=await pixelChanges(shots.up,shots.down);
 if(horizontal<8||vertical<8)
  throw new Error('Rendered two-axis gaze had insufficient pixel changes: h='+horizontal+', v='+vertical);
 if(mode==='workshop'){
  await page.mouse.move(size.width-16,Math.round(size.height*.48));
  await page.evaluate(()=>{const e=document.querySelector('#expressions-enabled');e.checked=false;e.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.waitForTimeout(120);
  const off=await surface.screenshot({path:'smoke-artifacts/face-extreme-off.png'});
  await page.evaluate(()=>{const e=document.querySelector('#expressions-enabled');e.checked=true;e.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.waitForTimeout(120);
  const on=await surface.screenshot({path:'smoke-artifacts/face-extreme-on.png'});
  const delta=await pixelChanges(off,on);
  if(delta<3)throw new Error('Enabling eye shader produced no observable image difference');
  const bounds=await surface.boundingBox();
  await page.mouse.move(bounds.x+bounds.width*.5,bounds.y+bounds.height*.27);
  await page.waitForTimeout(700);
  await page.evaluate(()=>{const e=document.querySelector('#expressions-enabled');e.checked=false;e.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.waitForTimeout(120);
  await surface.screenshot({path:'smoke-artifacts/face-neutral-off.png'});
  await page.evaluate(()=>{const e=document.querySelector('#expressions-enabled');e.checked=true;e.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.waitForTimeout(120);
  await surface.screenshot({path:'smoke-artifacts/face-neutral-on.png'});
  await page.locator('[data-nav="studio"]').click();
  await page.locator('#blink-now').click();
  await page.waitForTimeout(80);
  await surface.screenshot({path:'smoke-artifacts/face-blink.png'});
  console.log('PASS synthetic eye shader pixel gate: horizontal='+horizontal+', vertical='+vertical+', enabledDelta='+delta);
 }else console.log('PASS overlay synthetic eyes rendered movement: horizontal='+horizontal+', vertical='+vertical);
}

let browser,failed=false;
await mkdir('smoke-artifacts',{recursive:true});
try {
  browser=await chromium.launch({headless:true,executablePath:process.env.COMPANION_CHROMIUM_PATH||undefined,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
  for (const mode of ['workshop','overlay']) {
    const context=await browser.newContext({viewport:{width:mode==='overlay'?252:1120,height:mode==='overlay'?370:780}});
    const page=await context.newPage();
    if(mode==='workshop'){
      // Deterministic provider mock at fetch boundary, avoiding runner-dependent
      // browser Private-Network-Access/CORS policy. Native CORS remains an owner gate.
      await page.addInitScript(()=>{
        const original=window.fetch.bind(window);
        window.__v6LocalCalls=[];
        window.fetch=(url,options={})=>{
          const target=typeof url==='string'?url:url?.url;
          if(!target?.startsWith('http://127.0.0.1:11434/'))
            return original(url,options);
          window.__v6LocalCalls.push({url:target,method:options.method});
          const body=target.endsWith('/api/tags')
            ?JSON.stringify({models:[{name:'llama3.2:3b'}]})
            :target.endsWith('/api/show')?JSON.stringify({capabilities:['completion']})
            :JSON.stringify({message:{role:'assistant',content:JSON.stringify({reply:'<b>Safe local conversation</b>',gesture:'nod'})}});
          return Promise.resolve(new Response(body,{status:200,headers:{'Content-Type':'application/json'}}));
        };
      });
    }
    const errors=[];
    page.on('pageerror',error=>errors.push('pageerror: '+error.message));
    page.on('console',message=>{if(message.type()==='error')errors.push('console: '+message.text());});
    page.on('response',response=>{if(response.status()>=400)errors.push(response.status()+' '+response.url());});
    const url='http://127.0.0.1:'+port+'/index.html'+(mode==='overlay'?'?mode=overlay':'');
    let checkpoint='navigation';
    try {
      await page.goto(url,{waitUntil:'load'});
      checkpoint='first rendered frame';
      await page.waitForFunction(()=>{
        const canvas=document.querySelector(document.body.classList.contains('mode-overlay')?'#overlay-canvas':'#avatar-canvas');
        return canvas && canvas.width>2 && canvas.height>2 && canvas.getAttribute('data-render-ready')==='true';
      },null,{timeout:10000});
      await page.waitForTimeout(900);
      if(mode==='workshop'){
        checkpoint='Workspace navigation';
        await page.locator('[data-nav="behavior"]').click();
        await page.waitForFunction(()=>document.querySelector('[data-page="behavior"]')?.hidden===false,null,{timeout:10000});
        await page.locator('[data-nav="overview"]').click();
        await page.waitForFunction(()=>document.querySelector('[data-page="overview"]')?.hidden===false,null,{timeout:10000});
      }
      const surface=page.locator(mode==='overlay'?'#overlay-canvas':'#avatar-canvas');
      checkpoint='initial avatar screenshot';
      const before=await surface.screenshot();
      checkpoint='Wave event';
      await page.locator(mode==='overlay'?'#overlay-wave':'[data-quick="wave"]').click();
      if(mode==='workshop')await page.waitForFunction(()=>document.querySelector('[data-action="wave"]')?.classList.contains('active'),null,{timeout:10000});
      await page.waitForTimeout(450);
      checkpoint='animated avatar screenshot';
      const after=await surface.screenshot();
      if(before.equals(after))throw new Error('Canvas pixels did not change during Wave animation');
      const stage=await page.locator('#runtime-stage').innerText();
      if(stage!=='RUNNING')throw new Error('Renderer did not enter RUNNING: '+stage);
      if(mode==='workshop') {
        const status=await page.locator('#graphics-status').innerText();
        if(!status.includes('skinview3d'))throw new Error('Unexpected renderer status: '+status);
        await page.locator('[data-nav="studio"]').click();
        const png=await readFile(resolve('web/assets/sample-skin.png'));
        checkpoint='skin import';
        await page.locator('#skin-upload').setInputFiles({name:'recovery-test-skin.png',mimeType:'image/png',buffer:png});
        await page.waitForFunction(()=>document.querySelector('#current-skin-label')?.textContent==='RECOVERY-TEST-SKIN.PNG',null,{timeout:12000});
        checkpoint='skin persistence reload';
        await page.reload({waitUntil:'load'});
        await page.waitForFunction(()=>document.querySelector('#current-skin-label')?.textContent==='RECOVERY-TEST-SKIN.PNG'&&document.querySelector('#avatar-canvas')?.dataset.renderReady==='true',null,{timeout:12000});
        checkpoint='responsive Workspace';
        for(const viewport of [{width:840,height:650},{width:1120,height:780}]){
          await page.setViewportSize(viewport);
          const clipped=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
          if(clipped)throw new Error('Horizontal page overflow at '+viewport.width+'×'+viewport.height);
        }
        checkpoint='daily activity controls and persistence';
        await page.locator('[data-nav="behavior"]').click();
        checkpoint='V5 local personality settings';
        await page.locator('#personality-style').selectOption('curious');
        await page.locator('#personality-enabled').uncheck();
        if(!((await page.locator('#behavior-personality-status').innerText()).includes('Classic')))
          throw new Error('Disabling V5 should restore seeded V4 behavior');
        await page.reload({waitUntil:'load'});
        await page.waitForFunction(()=>document.querySelector('#avatar-canvas')?.dataset.renderReady==='true',null,{timeout:12000});
        await page.locator('[data-nav="behavior"]').click();
        if(await page.locator('#personality-style').inputValue()!=='curious')
          throw new Error('Personality preference did not persist');
        if(await page.locator('#personality-enabled').isChecked())
          throw new Error('Disabling local personality did not persist');
        await page.locator('#personality-enabled').check();
        if(!((await page.locator('#behavior-personality-status').innerText()).includes('curious')))
          throw new Error('Enabling local style did not activate V5');
        await page.screenshot({path:'smoke-artifacts/v5-personality-behavior-settings.png'});
        checkpoint='V6 opt-in local conversation';
        await page.locator('[data-nav="conversation"]').click();
        if(await page.evaluate(()=>window.__v6LocalCalls.length)!==0)throw new Error('V6 must not contact local model before Connect');
        // Commands are local user instructions, independent of AI provider availability.
        await page.locator('#chat-input').fill('Can you shake your head?');
        if(await page.locator('#ai-send').isDisabled())throw new Error('Offline manual avatar command was incorrectly disabled');
        await page.locator('#ai-send').click();
        await page.waitForFunction(()=>Array.from(document.querySelectorAll('.chat-message.from-model')).some(n=>n.textContent?.includes('Okay — shaking my head.')),null,{timeout:9000});
        if(await page.evaluate(()=>window.__v6LocalCalls.length)!==0)throw new Error('Offline direct command contacted Ollama');
        await page.locator('#ai-clear').click();
        await page.locator('#ai-connect').click();
        await page.waitForFunction(()=>document.querySelector('#ai-model')?.value==='llama3.2:3b',null,{timeout:9000});
        if(await page.locator('#ai-send').isDisabled())throw new Error('V6 Send disabled after manual Connect');
        await page.locator('#chat-input').fill('Hello from a local-only test');
        await page.locator('#ai-send').click();
        await page.waitForFunction(()=>document.querySelector('.chat-message.from-model')?.textContent?.includes('Safe local conversation'),null,{timeout:9000});
        if(await page.locator('.chat-message.from-model b').count()!==0)
          throw new Error('HTML from local model was interpreted as markup');
        if(await page.evaluate(()=>window.__v6LocalCalls.length)!==3)throw new Error('V6 expected exactly one model list, one capability request and one chat request');
        await page.screenshot({path:'smoke-artifacts/v6-local-conversation.png'});
        checkpoint='V6.2.1 native-free direct command in production bundle';
        // The explicit action runs without inference even when model-suggested gestures are off.
        await page.locator('#ai-gesture-enabled').uncheck();
        await page.locator('#chat-input').fill('Can you shake your head?');
        await page.locator('#ai-send').click();
        await page.waitForFunction(()=>Array.from(document.querySelectorAll('.chat-message.from-model')).some(n=>n.textContent?.includes('Okay — shaking my head.')),null,{timeout:9000});
        if(await page.evaluate(()=>window.__v6LocalCalls.length)!==3)
          throw new Error('Explicit head-shake command unexpectedly contacted Ollama');
        if(!(await page.locator('#ai-route-status').innerText()).includes('no AI inference'))
          throw new Error('Direct animation route did not identify the local-only action');
        await page.screenshot({path:'smoke-artifacts/v621-direct-head-shake.png'});
        console.log('PASS V6.2.1 direct avatar command without model inference');
        await page.locator('#ai-clear').click();
        if(await page.locator('.chat-message.from-model').count()!==0)
          throw new Error('Local chat clear did not remove conversation');
        await page.reload({waitUntil:'load'});
        await page.waitForFunction(()=>document.querySelector('#avatar-canvas')?.dataset.renderReady==='true',null,{timeout:12000});
        await page.locator('[data-nav="conversation"]').click();
        if(await page.locator('#ai-connection-status').innerText()!=='Disconnected (on-demand only)')
          throw new Error('V6 must not reconnect or infer in background after reload');
        if(await page.locator('.chat-message.from-model').count()!==0)
          throw new Error('V6 should not persist personal conversation history');
        console.log('PASS V6 explicit loopback-only connection, untrusted reply text and ephemeral history');
        checkpoint='daily activity controls and persistence';
        await page.locator('[data-nav="behavior"]').click();
        await page.locator('#idle-mode').selectOption('off');
        await page.reload({waitUntil:'load'});
        await page.waitForFunction(()=>document.querySelector('#avatar-canvas')?.dataset.renderReady==='true',null,{timeout:12000});
        await page.locator('[data-nav="behavior"]').click();
        if(await page.locator('#idle-mode').inputValue()!=='off')throw new Error('Idle frequency did not survive reload');
        for(const action of ['read','eat','drink','look','inspect']){
          // One browser task for cancel + select avoids cross-process
          // automation delays that could let short gestures expire between
          // separate Playwright clicks on stressed software WebGL runners.
          await page.evaluate(name=>{
            document.querySelector('[data-action="idle"]').click();
            const chosen=document.querySelector('[data-action="'+name+'"]');
            chosen.click();
            if(!chosen.classList.contains('active'))
              throw new Error('Gesture was not accepted by the UI: '+name);
          },action);
          // Selection highlights change synchronously, but software WebGL can
          // still be displaying the previous pose. Wait for a *rendered* action.
          await page.waitForFunction(name=>document.querySelector('#animation-status')?.textContent===name.toUpperCase(),action,{timeout:9000});
          await page.waitForTimeout(180);
          const capture=await surface.screenshot({path:'smoke-artifacts/activity-'+action+'-workspace.png'});

        }
        await page.locator('[data-action="idle"]').click();
        await page.locator('#idle-mode').selectOption('calm');
        console.log('PASS five daily activities, manual interruptions, UI state and persisted idle settings');
      }
      checkpoint='synthetic supported-face shader and rendered gaze pixel gate';
      await facePixelGate(page,mode,surface);
      if(errors.length)throw new Error('Browser errors: '+errors.join('; '));
      await page.screenshot({path:'smoke-artifacts/'+mode+'.png'});
      console.log('PASS '+mode+' production startup, non-static 3D wave and clean resources'+(mode==='workshop'?', skin import and reload':''));

    } catch(error) {
      failed=true;
      const status=await page.locator('#graphics-status').textContent().catch(()=>null);
      const probe=await page.evaluate(()=>{
        const c=document.querySelector(document.body.classList.contains('mode-overlay')?'#overlay-canvas':'#avatar-canvas');
        return {visibility:document.visibilityState,canvas:c&&{width:c.width,height:c.height,clientWidth:c.clientWidth,clientHeight:c.clientHeight,ready:c.dataset.renderReady},stage:document.querySelector('#runtime-stage')?.textContent,error:document.querySelector('#runtime-error')?.textContent,alertHidden:document.querySelector('#runtime-alert')?.hidden};
      }).catch(()=>null);
      await page.screenshot({path:'smoke-artifacts/'+mode+'.png'}).catch(()=>{});
      console.error('FAIL '+mode+' at '+checkpoint+': '+error.message+'; status='+status+'; errors='+JSON.stringify(errors)+'; probe='+JSON.stringify(probe));
    }
    await context.close();
  }
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
if(failed)process.exitCode=1;
