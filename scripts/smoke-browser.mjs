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
let browser,failed=false;
await mkdir('smoke-artifacts',{recursive:true});
try {
  browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
  for (const mode of ['workshop','overlay']) {
    const context=await browser.newContext({viewport:{width:mode==='overlay'?252:1120,height:mode==='overlay'?370:780}});
    const page=await context.newPage();
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
      if(mode==='workshop')await page.waitForFunction(()=>document.querySelector('#animation-status')?.textContent?.toLowerCase()==='wave',null,{timeout:10000});
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
      }
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
