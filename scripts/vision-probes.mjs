/** Shared real UI probes. Transport is explicitly either a native mock or installed Rust. */
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
export async function visionProbes(page,avatar,control){
 const original=await page.evaluate(async()=>{
  const canvas=document.createElement('canvas');canvas.width=80;canvas.height=60;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#56b398';ctx.fillRect(0,0,80,60);ctx.fillStyle='#101e24';ctx.fillRect(12,12,20,20);
  return canvas.toDataURL('image/png').split(',')[1];
 });
 const bytes=Buffer.from(original,'base64'),file={name:'synthetic.png',mimeType:'image/png',buffer:bytes};
 const attach=async()=>{
  await page.locator('#image-file').setInputFiles(file);
  await page.waitForFunction(()=>!document.querySelector('#image-preview').hidden);
 };
 await page.locator('[data-nav="conversation"]').click();
 const before=await control.countImages();await attach();
 assert.equal(await control.countImages(),before,'Selection caused inference');
 assert.match(await page.locator('#image-consent').textContent(),/Not yet analyzed/);
 assert.equal(await page.locator('#ai-send').isDisabled(),true);
 // The emitted preview and approval controls must remain inside every requested viewport.
 const layouts=[];
 for(const [width,height] of [[360,600],[390,700],[700,600],[840,650],[1120,780]]){
  await page.setViewportSize({width,height});
  for(const scale of [1,1.25,1.5]){
   await page.evaluate(s=>{
    for(const n of document.querySelectorAll('.conversation-panel label,.conversation-panel p,.conversation-panel button,.conversation-panel select,.conversation-panel textarea,.conversation-panel summary,.conversation-panel h2,.conversation-panel span,.conversation-panel strong')){
     if(!n.dataset.baseFont)n.dataset.baseFont=parseFloat(getComputedStyle(n).fontSize);
     n.style.fontSize=Number(n.dataset.baseFont)*s+'px';
    }
   },scale);
   const layout=await page.evaluate(()=>{
    const rect=id=>{const r=document.getElementById(id).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width};};
    return {analyze:rect('image-analyze'),composer:rect('chat-input'),actions:rect('ai-clear'),overflow:document.documentElement.scrollWidth>innerWidth+1};
   });
   assert.ok(layout.analyze.y>=0&&layout.analyze.bottom<=height+1,'Analyze clipped '+JSON.stringify({width,height,scale,layout}));
   assert.ok(layout.actions.bottom<=height+1&&layout.composer.y>=0,'Composer clipped '+JSON.stringify({width,height,scale,layout}));
   assert.equal(layout.overflow,false,'Horizontal page overflow');layouts.push({width,height,scale,...layout});
  }
 }
 await page.evaluate(()=>{for(const n of document.querySelectorAll('[data-base-font]'))n.style.fontSize=n.dataset.baseFont+'px';});await page.setViewportSize({width:1120,height:780});
 await page.screenshot({path:'smoke-artifacts/v7-preview-local-consent.png'});
 await page.locator('#image-remove').click();assert.equal(await page.locator('#image-preview').isHidden(),true);
 assert.equal(await control.countImages(),before);
 // Repeated import/clear should have balanced object URL ownership.
 await page.evaluate(()=>{
  window.__v7Urls=new Set();const make=URL.createObjectURL.bind(URL),drop=URL.revokeObjectURL.bind(URL);
  URL.createObjectURL=b=>{const u=make(b);window.__v7Urls.add(u);return u;};URL.revokeObjectURL=u=>{window.__v7Urls.delete(u);drop(u);};
 });
 for(let i=0;i<25;i++){await attach();await page.locator('#image-remove').click();}
 assert.equal(await page.evaluate(()=>window.__v7Urls.size),0);assert.equal(await control.countImages(),before);
 // Text-only model cannot Analyze. Native boundary is checked independently below.
 await page.locator('#ai-model').selectOption('llama3.2:3b');await attach();
 assert.equal(await page.locator('#image-analyze').isDisabled(),true);
 await page.locator('#image-remove').click();await page.locator('#ai-model').selectOption('qwen3.5:4b');
 await control.mode('success');await attach();await page.locator('#chat-input').fill('Describe the synthetic shapes.');await page.locator('#image-analyze').click();
 await page.waitForFunction(()=>document.querySelector('#ai-stop').disabled&&document.querySelector('#ai-route-status').textContent.includes('Image answered'));
 assert.equal(await control.countImages(),before+1);assert.equal(await page.evaluate(()=>window.__v7Urls.size),0);
 await page.screenshot({path:'smoke-artifacts/v7-approved-answer.png'});
 // A subsequent ordinary text turn contains no image, visual question or visual answer history.
 await page.locator('#chat-input').fill('Fresh text only');await page.locator('#ai-send').click();await page.waitForFunction(()=>document.querySelector('#ai-stop').disabled);
 await control.assertTextClean();
 // Invalid native inputs never reach Ollama and overlay cannot prepare, clear or analyze.
 const nativeDenials=await page.evaluate(async original=>{
  const invoke=window.__TAURI__.core.invoke,denied=async(cmd,args)=>{try{await invoke(cmd,args);return false;}catch{return true;}};
  const prepare={selectionId:'v7-security',mime:'image/png',base64:original};
  const results=[];
  for(const input of [{...prepare,path:'private'},{...prepare,base64:'https://evil/image.png'},{...prepare,mime:'image/jpeg'},{...prepare,base64:'***'},{...prepare,images:['a','b']}])results.push(await denied('vision_prepare',{input}));
  for(const input of [{token:'missing',model:'qwen3.5:4b',question:'x',requestId:'v7-invalid',retentionSeconds:0},
   {token:'missing',model:'qwen:cloud',question:'x',requestId:'v7-invalid',retentionSeconds:0}])results.push(await denied('vision_analyze',{input}));
  return results;
 },original);
 assert.ok(nativeDenials.every(Boolean),'Invalid native shape escaped');
 const overlayDenials=await avatar.evaluate(async original=>{
  const results=[];
  for(const [cmd,args] of [['vision_prepare',{input:{selectionId:'v7-overlay',mime:'image/png',base64:original}}],['vision_clear',{selectionId:'v7-overlay'}],['vision_analyze',{input:{token:'missing',model:'qwen3.5:4b',question:'x',requestId:'v7-overlay',retentionSeconds:0}}]]){
   try{await window.__TAURI__.core.invoke(cmd,args);results.push(false);}catch{results.push(true);}
  }
  return results;
 },original);
 assert.ok(overlayDenials.every(Boolean),'Overlay accessed vision');
 // Revalidate model metadata at inference time; no auto fallback, no image chat request.
 await attach();await control.mode('no-vision');const unsupportedBefore=await control.countImages();
 await page.locator('#image-analyze').click();await page.waitForFunction(()=>document.querySelector('#ai-stop').disabled);
 assert.equal(await control.countImages(),unsupportedBefore);assert.equal(await page.locator('#image-preview').isHidden(),true);
 await control.mode('delay');await attach();await page.locator('#image-analyze').click();await control.waitImage();
 await page.locator('#ai-stop').click();await page.waitForFunction(()=>document.querySelector('#ai-stop').disabled);
 assert.equal(await page.locator('#image-preview').isHidden(),true);
 await control.mode('success');
 // Clear removes ephemeral image answers and selected pixels.
 await page.locator('#ai-clear').click();assert.equal(await page.locator('.from-model').count(),0);
 const persisted=await page.evaluate(()=>JSON.stringify({...localStorage}));assert.ok(!persisted.includes(original)&&!persisted.includes('synthetic shapes'));
 await writeFile('smoke-artifacts/v7-ui-privacy.json',JSON.stringify({environment:control.environment,layouts,selectionRequests:0,importClearCycles:25,livePreviewURLs:0,nativeDenials,overlayDenials,actualOwnerModel:'PENDING OWNER',ownerGPU:'PENDING OWNER'},null,2));
}
