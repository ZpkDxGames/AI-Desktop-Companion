import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {resolve,extname,sep} from 'node:path';
if(!process.argv[2])throw Error('Pass the extracted review directory');
const root=resolve(process.argv[2]);
const mime={'.html':'text/html','.js':'text/javascript','.png':'image/png','.webm':'video/webm','.json':'application/json','.md':'text/plain'};
const server=createServer(async(req,res)=>{try{const p=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!p.startsWith(root+sep))throw Error('path');const bytes=await readFile(p);res.writeHead(200,{'Content-Type':mime[extname(p)]||'application/octet-stream','Content-Length':bytes.length}).end(bytes);}catch{res.writeHead(404).end();}});server.listen(0,'127.0.0.1');await once(server,'listening');
let browser;
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1100,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/index.html');
 const actions=await page.locator('#action option').evaluateAll(options=>options.map(o=>o.value));
 for(const action of actions)for(const rate of ['30','60','144']){
  await page.selectOption('#mode','motion');await page.selectOption('#action',action);await page.selectOption('#rate',rate);
  await page.waitForFunction(()=>['before','after'].every(v=>document.getElementById(v+'Video').readyState>=2&&document.getElementById(v+'Video').videoWidth===320));
 }
 for(const action of actions.slice(0,17))for(const model of ['classic','slim'])for(const view of ['front','left','right','side']){
  await page.selectOption('#action',action);await page.selectOption('#mode','pose');await page.selectOption('#model',model);await page.selectOption('#view',view);
  await page.waitForFunction(()=>['before','after'].every(v=>{const img=document.getElementById(v+'Image');return img.complete&&img.naturalWidth===320;}));
 }
 await page.selectOption('#action','read');await page.selectOption('#mode','motion');await page.selectOption('#rate','60');await page.selectOption('#speed','.5');await page.click('#play');
 await page.waitForFunction(()=>document.getElementById('afterVideo').currentTime>.25);if(!await page.evaluate(()=>document.getElementById('afterVideo').playbackRate===.5))throw Error('Speed control failed');
 await page.screenshot({path:root+'/gallery-preview.png'});if(errors.length)throw Error(errors.join('\n'));
 await writeFile(root+'/data/gallery-check.json',JSON.stringify({passed:true,pairedClipCases:63,pairedPoseCases:136,comparisons:17,browser:browser.version(),errors},null,2)+'\n');
 console.log('PASS gallery: 63 paired motion cases, 136 paired poses, playback and speed controls');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
