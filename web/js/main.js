import {AvatarRenderer} from './engine/renderer.js';
import {readSelectedItemPngs,sanitizeSavedItemTextures} from './engine/item-import.js';
import sampleSkinUrl from '../assets/sample-skin.png';
import {RuntimeJournal} from './runtime/diagnostics.js';
import {FramePacer} from './runtime/frame-pacing.js';
import {BehaviorController} from './avatar/animation.js';
import {LocalBehaviorPolicy,sanitizeBehaviorPreferences} from './avatar/local-behavior-policy.js';
import {LocalConversation,sanitizeAiSettings,formatChatError,OLLAMA_BASE} from './ai/local-conversation.js';
import {decodeImage,loadSkin} from './avatar/skin.js';
import {normalizeModelMode,describeModel} from './avatar/model-policy.js';

const overlay=new URLSearchParams(location.search).get('mode')==='overlay';
if(overlay){document.documentElement.classList.add('overlay');document.body.classList.add('mode-overlay');document.getElementById('overlay-view').hidden=false;}
const $=id=>document.getElementById(id);
const native=!!window.__TAURI__?.core?.invoke;
const invoke=(command,args={})=>native?window.__TAURI__.core.invoke(command,args):Promise.resolve(null);
const DEFAULT={modelMode:'auto',scale:100,follow:true,expressions:false,idleMode:'calm',skin:null,skinName:'Sample skin',itemTextures:{},personality:{enabled:true,style:'balanced'},ai:{model:'',gestures:false}};
const STORE='zpkdx-avatar-v0.1';

function stored(){
 try{
  const raw=JSON.parse(localStorage.getItem(STORE)||'null');
  if(!raw||typeof raw!=='object')return structuredClone(DEFAULT);
  const clean={...raw};
  if(!clean.modelMode&&typeof clean.slim==='boolean')clean.modelMode=clean.slim?'slim':'classic';
  delete clean.slim;delete clean.eyes;
  clean.modelMode=normalizeModelMode(clean.modelMode);
  clean.itemTextures=sanitizeSavedItemTextures(clean.itemTextures);
  clean.personality=clean.personality===undefined?{...DEFAULT.personality}:sanitizeBehaviorPreferences(clean.personality);
  clean.ai=sanitizeAiSettings(clean.ai);
  clean.idleMode=['off','calm','lively'].includes(clean.idleMode)?clean.idleMode:DEFAULT.idleMode;
  return {...DEFAULT,...clean};
 }catch{return structuredClone(DEFAULT);}
}
const state=stored();
const seed=Date.now();
const controller=new BehaviorController({seed});
const personalityPolicy=new LocalBehaviorPolicy({seed,style:state.personality.style});
const conversation=new LocalConversation({nativeInvoke:native?invoke:null});
let aiConnected=false,chatBusy=false,conversationGeneration=0;
controller.setBehaviorPolicy(state.personality.enabled?personalityPolicy:null);
const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
controller.setReducedMotion(motionPreference.matches);
motionPreference.addEventListener('change',event=>{
 controller.setReducedMotion(event.matches);renderer?.effects.setReducedMotion(event.matches);wake();
});
controller.setIdleMode(state.idleMode);
const journal=new RuntimeJournal();
const framePacer=new FramePacer({activeFps:60,idleFps:20});
const sessionId=Math.random().toString(36).slice(2);
let bindingsReady=false,eventsReady=false,contextLost=false,starting=false,bootReady=false,shownAction=null;
let rafId=0,idleTimer=0,frameSamples=new Float32Array(120),sampleCount=0,sampleCursor=0,contextLosses=0;
let renderer=null,lastTime=0,renderT=0,renderCount=0,lastReport=performance.now();
let cursor=[0,0],tracking=false,dragging=false,rotStart=0,angle=0,lastPointerEvent=-Infinity;
let lastAttentionEvent=-Infinity;
const canvas=$(overlay?'overlay-canvas':'avatar-canvas');
const toast=message=>{const node=$('toast');node.textContent=message;node.hidden=false;clearTimeout(toast.timeout);toast.timeout=setTimeout(()=>node.hidden=true,4100);};
const save=()=>{try{
 localStorage.setItem(STORE,JSON.stringify(state));
 if(native)window.__TAURI__?.event?.emit?.('zpkdx:settings-changed',{source:sessionId}).catch(err=>journal.record(journal.stage,'Settings event failed: '+err));
}catch{toast('Settings could not be saved.');}};
const statusNode=id=>$(id);
const stage=(name,message)=>{journal.record(name,message);const node=statusNode('runtime-stage');if(node)node.textContent=name.replaceAll('_',' ');};
const report=()=>journal.report({mode:overlay?'overlay':'workspace',native,version:'0.1.0-alpha.6.0',contextLosses,
  graphics:renderer?'skinview3d / Three.js':'not initialized',pixelRatio:window.devicePixelRatio||1,
  modelMode:state.modelMode,customSkinPresent:!!state.skin,expressiveEyesEnabled:state.expressions,
  idleMode:state.idleMode,action:controller.action,actionSource:controller.source,autoStarts:controller.autoStarts,
  personalityEnabled:state.personality.enabled,personalityStyle:state.personality.style,
  behaviorTone:state.personality.enabled?personalityPolicy.mood:'classic',behaviorDecisions:personalityPolicy.decisions});
const copyReport=async()=>{
 const text=report();
 try{await navigator.clipboard.writeText(text);toast('Diagnostics copied.');}
 catch{window.prompt('Copy this diagnostic report',text);}
};
function showFailure(error){
 const failure=journal.fail(error);
 const alert=statusNode('runtime-alert');
 if(alert){alert.hidden=false;statusNode('runtime-error').textContent=failure.id+': '+failure.message;}
 const status=statusNode('graphics-status');if(status)status.textContent='Unavailable';
 toast('Startup failed: '+failure.message);
}
function clearFailure(){
 const alert=statusNode('runtime-alert');if(alert)alert.hidden=true;
 journal.failure=null;
}
function wake(){
 if(document.hidden||contextLost||!renderer||!bootReady)return;
 clearTimeout(idleTimer);idleTimer=0;
 if(!rafId)rafId=requestAnimationFrame(frame);
}

function updateAiControls(){
 if(overlay)return;
 const model=$('ai-model'),connect=$('ai-connect'),send=$('ai-send'),stop=$('ai-stop');
 model.disabled=!aiConnected||chatBusy;
 connect.disabled=chatBusy;
 send.disabled=!aiConnected||chatBusy||!model.value;
 stop.disabled=!chatBusy;
 $('ai-gesture-enabled').checked=state.ai.gestures;
 $('ai-connection-status').textContent=chatBusy?'Responding locally…':aiConnected?'Local provider connected':'Disconnected (on-demand only)';
 const label=$('model-connection-badge');if(label)label.textContent=aiConnected?'LOCAL AI CONNECTED':'AI OPTIONAL';
}
function appendConversation(role,content){
 const root=$('chat-history');
 const article=document.createElement('div');
 article.className='chat-message '+(role==='user'?'from-user':role==='assistant'?'from-model':'from-system');
 const label=document.createElement('strong');
 label.textContent=role==='user'?'You':role==='assistant'?'Companion':'System';
 const text=document.createElement('p');text.textContent=content;
 article.append(label,text);root.append(article);
 while(root.children.length>30)root.firstElementChild.remove();
 root.scrollTop=root.scrollHeight;
}
async function connectLocalAi(){
 if(overlay||chatBusy)return;
 $('ai-connect').disabled=true;
 $('ai-connection-status').textContent='Checking local Ollama…';
 try{
  const models=await conversation.listModels();
  aiConnected=true;
  const chooser=$('ai-model');chooser.replaceChildren();
  for(const name of models){
   const option=document.createElement('option');
   option.value=name;option.textContent=name;chooser.append(option);
  }
  if(models.includes(state.ai.model))chooser.value=state.ai.model;
  else{state.ai.model=models[0]||'';save();}
  if(!models.length)appendConversation('system','Ollama is running but has no models. Install a local model first.');
  else appendConversation('system','Connected to local Ollama. Messages are sent only when you press Send.');
 }catch(error){
  aiConnected=false;
  $('ai-model').replaceChildren();
  appendConversation('system',formatChatError(error));
 }finally{updateAiControls();}
}
async function sendLocalChat(){
 if(overlay||!aiConnected||chatBusy)return;
 const field=$('chat-input'),input=field.value.trim(),model=$('ai-model').value;
 if(!input)return;
 if(input.length>2400){appendConversation('system','Message exceeds 2400 characters.');return;}
 const generation=++conversationGeneration;
 chatBusy=true;field.disabled=true;updateAiControls();
 appendConversation('user',input);field.value='';
 try{
  const response=await conversation.send(input,{model,gestures:state.ai.gestures});
  if(generation!==conversationGeneration)return;
  appendConversation('assistant',response.reply);
  // A model cannot command tools or take priority over an active manual activity.
  if(state.ai.gestures&&response.gesture&&controller.action==='idle'){
   controller.request(response.gesture,{source:'auto'});wake();
  }
 }catch(error){
  if(generation===conversationGeneration)appendConversation('system',formatChatError(error));
 }finally{
  if(generation===conversationGeneration){chatBusy=false;field.disabled=false;updateAiControls();field.focus();}
 }
}
function bindLocalChat(){
 if(overlay)return;
 $('ai-connect').addEventListener('click',connectLocalAi);
 $('ai-model').addEventListener('change',event=>{state.ai.model=event.target.value;conversation.clear();save();updateAiControls();});
 $('ai-gesture-enabled').addEventListener('change',event=>{state.ai.gestures=event.target.checked;save();});
 $('chat-send-form').addEventListener('submit',event=>{event.preventDefault();void sendLocalChat();});
 $('ai-stop').addEventListener('click',()=>conversation.cancel());
 $('ai-clear').addEventListener('click',()=>{
  conversationGeneration++;conversation.clear();chatBusy=false;
  $('chat-input').disabled=false;
  $('chat-history').replaceChildren();
  updateAiControls();
  appendConversation('system','Local conversation cleared from memory.');
 });
 $('ai-endpoint').textContent=OLLAMA_BASE;
 updateAiControls();
}
function syncUi(){
 if(overlay)return;
 $('model-type').value=state.modelMode;
 $('avatar-scale').value=state.scale;
 $('scale-value').textContent=state.scale+'%';
 $('follow-pointer').checked=state.follow;
 $('expressions-enabled').checked=state.expressions;
 $('idle-mode').value=state.idleMode;
 $('personality-enabled').checked=state.personality.enabled;
 $('personality-style').value=state.personality.style;
 updateBehaviorUi();
 updateAiControls();
 $('current-skin-label').textContent=state.skinName.toUpperCase();
 const itemLabel=$('custom-items-status');if(itemLabel)itemLabel.textContent=Object.keys(state.itemTextures||{}).length+' / 5 custom item sprites';
}
function updateBehaviorUi(){
 if(overlay)return;
 const label=$('behavior-personality-status');
 if(label)label.textContent=state.idleMode==='off'?'Automatic actions disabled':state.personality.enabled
   ?'Local rules · '+state.personality.style+' · '+personalityPolicy.mood
   :'Classic seeded activity selection';
}
function updateStatus(result){
 if(overlay)return;
 const face=$('face-marker-status');
 face.textContent=result.supported?'2D gaze + blink · native UV eyes':'Vanilla face · '+result.reason;
 face.dataset.supported=String(!!result.supported);
 $('model-status').textContent=describeModel(state.modelMode,result.modelType);
}
async function setSkin(image){
 const result=await renderer.setSkin(image,{model:state.modelMode});
 renderer.setFacesEnabled(state.expressions);
 updateStatus(result);
 return result;
}
async function reloadFromStorage(){
 Object.assign(state,stored());
 controller.setIdleMode(state.idleMode);
 personalityPolicy.setStyle(state.personality.style);
 controller.setBehaviorPolicy(state.personality.enabled?personalityPolicy:null);
 stage('ASSETS',state.skin?'Loading saved skin':'Loading bundled sample texture');
 let image;
 if(state.skin){
  try{image=await decodeImage(state.skin);}
  catch(error){
   journal.record('ASSETS','Saved skin failed to decode; restoring bundled sample');
   state.skin=null;state.skinName='Sample skin';
  }
 }
 if(!image)image=await decodeImage(sampleSkinUrl);
 const result=await setSkin(image);
 await renderer.setItemTextures(state.itemTextures);
 stage('SKIN_READY','Texture uploaded; model '+result.modelType);
 syncUi();
}
async function subscribeNative(){
 if(!native||!window.__TAURI__?.event?.listen||eventsReady)return;
 eventsReady=true;
 try{
  await window.__TAURI__.event.listen('zpkdx:settings-changed',event=>{
   if(event.payload?.source===sessionId)return;
   reloadFromStorage().then(wake).catch(showFailure);
  });
  await window.__TAURI__.event.listen('zpkdx:wave',()=>{
   controller.request('wave');wake();
  });
 }catch(error){journal.record(journal.stage,'Native events unavailable: '+error);}
}
function bindRecovery(){
 const retry=statusNode('runtime-retry');if(retry)retry.addEventListener('click',()=>boot());
 const copy=statusNode('runtime-copy');if(copy)copy.addEventListener('click',copyReport);
 const reportButton=statusNode('diagnostics-copy');
 if(reportButton)reportButton.addEventListener('click',copyReport);
 document.addEventListener('visibilitychange',()=>{
  if(document.hidden){clearTimeout(idleTimer);cancelAnimationFrame(rafId);idleTimer=0;rafId=0;lastTime=0;framePacer.reset();}
  else wake();
 });
 window.addEventListener('resize',wake,{passive:true});
 window.addEventListener('error',event=>journal.record(journal.stage,'Window error: '+(event.message||'unknown')));
 window.addEventListener('unhandledrejection',event=>journal.record(journal.stage,'Unhandled promise rejection: '+(event.reason?.message||'unknown')));
 canvas.addEventListener('webglcontextlost',event=>{
  event.preventDefault();contextLost=true;contextLosses++;
  clearTimeout(idleTimer);cancelAnimationFrame(rafId);idleTimer=0;rafId=0;
  showFailure(new Error('WebGL graphics context lost. Waiting for restoration.'));
 });
 canvas.addEventListener('webglcontextrestored',()=>{
  contextLost=false;
  boot().catch(showFailure);
 });
}
async function boot(){
 if(starting)return;
 starting=true;bootReady=false;clearTimeout(idleTimer);cancelAnimationFrame(rafId);
 rafId=0;idleTimer=0;lastTime=0;framePacer.reset();renderT=0;renderCount=0;lastReport=performance.now();
 try{
  clearFailure();
  stage('BOOT','Starting '+(overlay?'desktop overlay':'Workspace'));
  if(renderer){try{renderer.dispose();}catch(error){journal.record('BOOT','Previous graphics cleanup failed: '+error);}}
  renderer=null;
  stage('RENDERER','Initializing canonical Three.js and skinview3d renderer');
  renderer=new AvatarRenderer(canvas,{overlay});
  await reloadFromStorage();
  if(!bindingsReady){
   bindRecovery();
   if(!overlay)connectWorkshop();else connectOverlay();
   bindingsReady=true;
  }
  await subscribeNative();
  if(!overlay)statusNode('graphics-status').textContent='Three.js · skinview3d';
  bootReady=true;
  canvas.dataset.renderReady='false';
  wake();
 }catch(error){
  console.error(error);bootReady=false;showFailure(error);
 }finally{starting=false;}
}
const PAGES=Object.freeze({
 overview:['WORKSPACE / HOME','Overview','Character and runtime at a glance.'],
 studio:['CHARACTER / STUDIO','Avatar Studio','Skin identity, proportions and expressions.'],
 behavior:['MOTION / BEHAVIOR','Behavior & Animations','Test local animation poses and transitions.'],
 desktop:['ENVIRONMENT / DESKTOP','Desktop World','Native desktop geometry and interaction capabilities.'],
 conversation:['ASSISTANT / CHAT','Conversation','On-demand text chat with a user-installed local model.'],
 models:['ASSISTANT / MODELS','AI & Models','Connect manually to installed local Ollama models.'],
 privacy:['SECURITY / CONSENT','Privacy','Controls and present permission scope.'],
 activity:['HISTORY / ACTIVITY','Activity','Local activity and history availability.'],
 diagnostics:['SYSTEM / DIAGNOSTICS','Diagnostics','Actual runtime and renderer measurements.'],
 settings:['SYSTEM / PREFERENCES','Settings','Application preferences and build information.']
});
function showPage(page){
 if(overlay||!Object.hasOwn(PAGES,page))return;
 for(const node of document.querySelectorAll('[data-page]'))node.hidden=node.dataset.page!==page;
 for(const node of document.querySelectorAll('[data-nav]')){
  const current=node.dataset.nav===page;
  node.classList.toggle('selected',current);
  if(current)node.setAttribute('aria-current','page');else node.removeAttribute('aria-current');
 }
 const [eyebrow,title,subtitle]=PAGES[page];
 $('page-eyebrow').textContent=eyebrow;
 $('page-title').textContent=title;
 $('page-subtitle').textContent=subtitle;
 // Avoid stale scroll offsets hiding page headings after switching panels.
 document.querySelector('.settings')?.scrollTo({top:0,behavior:'instant'});
 wake();
}
function bindWorkspaceNavigation(){
 for(const node of document.querySelectorAll('[data-nav]')){
  node.title=node.textContent.trim();
  node.addEventListener('click',()=>showPage(node.dataset.nav));
 }
 document.querySelector('.workspace')?.addEventListener('click',event=>{
  const button=event.target.closest('[data-quick]');
  if(!button)return;
  switch(button.dataset.quick){
   case 'wave':if(controller.request('wave'))setActiveAction('wave');wake();break;
   case 'studio':showPage('studio');break;
   case 'reset-view':angle=0;cursor[0]=0;cursor[1]=0;tracking=false;wake();break;
   case 'reset-scale':state.scale=100;save();syncUi();wake();break;
  }
 });
 showPage('overview');
}
function connectWorkshop(){
 bindWorkspaceNavigation();
 bindLocalChat();
 $('item-sprite-import').addEventListener('change',async event=>{
  const files=event.target.files;if(!files?.length)return;
  try{
   const {sprites,count}=await readSelectedItemPngs(files);
   const updated={...state.itemTextures,...sprites};
   await renderer.setItemTextures(updated);
   state.itemTextures=updated;save();syncUi();wake();
   toast(count+' local item texture(s) imported. The files remain on this device.');
  }catch(error){toast(error.message||String(error));}
  finally{event.target.value='';}
 });
 $('item-sprite-reset').addEventListener('click',async()=>{
  await renderer.setItemTextures({});state.itemTextures={};save();syncUi();wake();
  toast('Restored original built-in item art.');
 });
 $('skin-upload').addEventListener('change',async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{
   const image=await loadSkin(file);
   const buffer=document.createElement('canvas');buffer.width=64;buffer.height=64;
   const ctx=buffer.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(image,0,0);
   state.skin=buffer.toDataURL('image/png');state.skinName=file.name;state.follow=true;
   const result=await setSkin(image);save();syncUi();
   toast((result.supported?'3D eye markers recognized. ':'Vanilla face preserved. ')+describeModel(state.modelMode,result.modelType)+'.');
  }catch(err){toast(err.message);}finally{e.target.value='';}
 });
 $('model-type').addEventListener('change',async e=>{
  state.modelMode=normalizeModelMode(e.target.value);
  try{const result=await renderer.setModelMode(state.modelMode);updateStatus(result);save();wake();}
  catch(error){showFailure(error);}
 });
 $('avatar-scale').addEventListener('input',e=>{state.scale=Number(e.target.value);$('scale-value').textContent=state.scale+'%';save();});
 $('follow-pointer').addEventListener('change',e=>{state.follow=e.target.checked;save();});
 $('expressions-enabled').addEventListener('change',e=>{state.expressions=e.target.checked;renderer.setFacesEnabled(state.expressions);save();wake();});
 $('blink-now').addEventListener('click',()=>{controller.triggerBlink();wake();});
 $('personality-enabled').addEventListener('change',event=>{
  state.personality.enabled=event.target.checked;
  controller.setBehaviorPolicy(state.personality.enabled?personalityPolicy:null);
  updateBehaviorUi();save();wake();
 });
 $('personality-style').addEventListener('change',event=>{
  if(!personalityPolicy.setStyle(event.target.value))return;
  state.personality.style=personalityPolicy.style;
  updateBehaviorUi();save();wake();
 });
 $('idle-mode').addEventListener('change',event=>{
  state.idleMode=event.target.value;
  if(!controller.setIdleMode(state.idleMode))return;
  updateBehaviorUi();save();wake();
 });
 $('action-row').addEventListener('click',e=>{
  const action=e.target.closest('[data-action]')?.dataset.action;
  if(!action)return;
  if(controller.request(action))setActiveAction(action);
  wake();
 });
 attachPointer($('stage'));
}
function setActiveAction(action){if(overlay||shownAction===action)return;shownAction=action;for(const node of document.querySelectorAll('[data-action]'))node.classList.toggle('active',node.dataset.action===action);}
function attachPointer(element){
 // Window-local only: Workspace panels also drive the eyes; never hook the
 // global Windows cursor. Origin is the projected upper-head area on canvas.
 const reset=()=>{
  tracking=false;cursor[0]=0;cursor[1]=0;lastPointerEvent=-Infinity;
  dragging=false;controller.setGaze(0,0);wake();
 };
 document.addEventListener('pointermove',event=>{
  const b=canvas.getBoundingClientRect();
  const headX=b.left+b.width*.5,headY=b.top+b.height*.27;
  cursor[0]=Math.max(-1,Math.min(1,(event.clientX-headX)/Math.max(180,b.width*.40)));
  cursor[1]=Math.max(-1,Math.min(1,(headY-event.clientY)/Math.max(150,b.height*.38)));
  tracking=true;lastPointerEvent=performance.now();
  if(state.personality.enabled&&lastPointerEvent-lastAttentionEvent>=2000){
   lastAttentionEvent=lastPointerEvent;personalityPolicy.noteInteraction('pointer',controller.time);
  }
  if(dragging)angle=Math.max(-2,Math.min(2,rotStart+(event.clientX-(element.dragAnchor??event.clientX))*.012));
  wake();
 },{passive:true});
 document.addEventListener('pointerleave',reset);
 window.addEventListener('blur',reset);
 if(!overlay){
  element.addEventListener('pointerdown',event=>{
   if(event.button!==0)return;
   dragging=true;rotStart=angle;element.dragAnchor=event.clientX;
   element.setPointerCapture?.(event.pointerId);wake();
  });
  element.addEventListener('pointerup',()=>{dragging=false;wake();});
  element.addEventListener('pointercancel',()=>{dragging=false;wake();});
 }
}
function connectOverlay(){
 attachPointer($('overlay-view'));
 $('overlay-wave').addEventListener('click',()=>{controller.request('wave');wake();});
 $('overlay-idle').addEventListener('click',()=>{controller.request('idle');wake();});
 $('overlay-pass').addEventListener('click',async()=>{try{await invoke('set_passthrough',{enabled:true});toast('Click-through on. Use the tray icon to restore interaction.');}catch(e){toast(String(e));}});
 $('overlay-settings').addEventListener('click',()=>invoke('open_workshop').catch(e=>toast(String(e))));
 document.querySelector('[data-drag]').addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;invoke('begin_drag').catch(()=>{});});
}
function frame(time){
 rafId=0;
 if(!bootReady||!renderer||document.hidden||contextLost){lastTime=0;return;}
 controller.setGaze(state.follow&&tracking?cursor[0]:0,state.follow&&tracking?cursor[1]:0);
 let active=controller.action!=='idle'||dragging||controller.gazeMoving()||controller.blinkElapsed>=0||(tracking&&time-lastPointerEvent<300);
 if(!framePacer.ready(time,active)){rafId=requestAnimationFrame(frame);return;}
 const dt=lastTime?Math.min((time-lastTime)/1000,.05):0;
 lastTime=time;
 try{
  controller.update(dt);
  active=active||controller.action!=='idle'||controller.blink>0||controller.gazeMoving();
  const blink=controller.blink;
  const started=performance.now();
  renderer.render(controller.pose(),{scale:state.scale/100,rotation:angle,gazeX:controller.eyeGaze[0],gazeY:controller.eyeGaze[1],blink,action:controller.action,actionElapsed:controller.elapsed,dt,activity:controller.activity,presentation:controller.presentation,foodVariant:controller.foodVariant});
  const cost=performance.now()-started;
  frameSamples[sampleCursor]=cost;
  sampleCursor=(sampleCursor+1)%frameSamples.length;
  sampleCount=Math.min(frameSamples.length,sampleCount+1);
  canvas.dataset.renderReady='true';
  if(journal.stage!=='RUNNING')stage('RUNNING','First graphics frame rendered');
  renderCount++;
  if(!overlay){statusNode('animation-status').textContent=controller.action.toUpperCase();setActiveAction(controller.action);}
  if(time-lastReport>=1250){
   updateBehaviorUi();
   const fps=Math.round(renderCount*1000/(time-lastReport));
   renderCount=0;lastReport=time;
   if(!overlay)statusNode('render-fps').textContent=fps+' FPS';
   const node=statusNode('frame-percentiles');
   if(node&&sampleCount){
    const values=Array.from(frameSamples.subarray(0,sampleCount)).sort((a,b)=>a-b);
    const percentile=p=>values[Math.min(values.length-1,Math.ceil(p*values.length)-1)].toFixed(2);
    node.textContent='Render call ms (CPU): p50 '+percentile(.5)+' / p95 '+percentile(.95)+' / p99 '+percentile(.99);
   }
  }
 }catch(error){
  console.error(error);bootReady=false;showFailure(error);return;
 }
 if(active)rafId=requestAnimationFrame(frame);
 else idleTimer=setTimeout(()=>{idleTimer=0;rafId=requestAnimationFrame(frame);},49);
}
boot();
