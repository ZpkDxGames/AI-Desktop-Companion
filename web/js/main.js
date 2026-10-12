import {AvatarRenderer} from './engine/renderer.js';
import {BehaviorController} from './avatar/animation.js';
import {decodeImage,loadSkin} from './avatar/skin.js';
import {normalizeModelMode,describeModel} from './avatar/model-policy.js';

const overlay=new URLSearchParams(location.search).get('mode')==='overlay';
if(overlay){document.documentElement.classList.add('overlay');document.body.classList.add('mode-overlay');document.getElementById('overlay-view').hidden=false;}
const $=id=>document.getElementById(id);
const native=!!window.__TAURI__?.core?.invoke;
const invoke=(command,args={})=>native?window.__TAURI__.core.invoke(command,args):Promise.resolve(null);
const DEFAULT={modelMode:'auto',scale:100,follow:true,expressions:true,skin:null,skinName:'Sample skin'};
const STORE='zpkdx-avatar-v0.1';

function stored(){
 try{
  const raw=JSON.parse(localStorage.getItem(STORE)||'null');
  if(!raw||typeof raw!=='object')return structuredClone(DEFAULT);
  const clean={...raw};
  if(!clean.modelMode&&typeof clean.slim==='boolean')clean.modelMode=clean.slim?'slim':'classic';
  delete clean.slim;delete clean.eyes;
  clean.modelMode=normalizeModelMode(clean.modelMode);
  return {...DEFAULT,...clean};
 }catch{return structuredClone(DEFAULT);}
}
const state=stored();
const controller=new BehaviorController();
let renderer=null,lastTime=0,renderT=0,renderCount=0,lastReport=performance.now();
let cursor=[0,0],tracking=false,dragging=false,rotStart=0,angle=0,forceBlinkUntil=0;
const canvas=$(overlay?'overlay-canvas':'avatar-canvas');
const toast=message=>{const node=$('toast');node.textContent=message;node.hidden=false;clearTimeout(toast.timeout);toast.timeout=setTimeout(()=>node.hidden=true,4100);};
const save=()=>{try{localStorage.setItem(STORE,JSON.stringify(state));if(native)window.__TAURI__?.event?.emit?.('zpkdx:settings-changed').catch(()=>{});}catch{toast('Settings could not be saved.');}};

function syncUi(){
 if(overlay)return;
 $('model-type').value=state.modelMode;
 $('avatar-scale').value=state.scale;
 $('scale-value').textContent=state.scale+'%';
 $('follow-pointer').checked=state.follow;
 $('expressions-enabled').checked=state.expressions;
 $('current-skin-label').textContent=state.skinName.toUpperCase();
}
function updateStatus(result){
 if(overlay)return;
 const face=$('face-marker-status');
 face.textContent=result.supported?'3D eye rig ready · 2×2 markers':'Vanilla face · '+result.reason;
 face.dataset.supported=String(!!result.supported);
 $('model-status').textContent=describeModel(state.modelMode,result.modelType);
}
async function setSkin(image){
 const result=renderer.setSkin(image,{model:state.modelMode});
 renderer.setFacesEnabled(state.expressions);
 updateStatus(result);
 return result;
}
async function reloadFromStorage(){
 Object.assign(state,stored());
 try{
  const image=state.skin?await decodeImage(state.skin):await decodeImage('./assets/sample-skin.png');
  await setSkin(image);
 }catch{
  state.skin=null;state.skinName='Sample skin';
  await setSkin(await decodeImage('./assets/sample-skin.png'));
 }
 syncUi();
}
async function boot(){
 try{
  renderer=new AvatarRenderer(canvas,{overlay});
  await reloadFromStorage();
  if(!overlay){$('graphics-status').textContent='Three.js · skinview3d';connectWorkshop();}else connectOverlay();
  if(native&&window.__TAURI__?.event?.listen){
   window.__TAURI__.event.listen('zpkdx:settings-changed',()=>reloadFromStorage().catch(()=>{})).catch(()=>{});
   window.__TAURI__.event.listen('zpkdx:wave',()=>controller.request('wave')).catch(()=>{});
  }
  requestAnimationFrame(frame);
 }catch(e){
  console.error(e);
  if(!overlay)$('graphics-status').textContent='Unavailable';
  toast(e?.message||'Graphics initialization failed.');
 }
}
function connectWorkshop(){
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
 $('model-type').addEventListener('change',e=>{
  state.modelMode=normalizeModelMode(e.target.value);
  const result=renderer.setModelMode(state.modelMode);
  updateStatus(result);save();
 });
 $('avatar-scale').addEventListener('input',e=>{state.scale=Number(e.target.value);$('scale-value').textContent=state.scale+'%';save();});
 $('follow-pointer').addEventListener('change',e=>{state.follow=e.target.checked;save();});
 $('expressions-enabled').addEventListener('change',e=>{state.expressions=e.target.checked;renderer.setFacesEnabled(state.expressions);save();});
 $('blink-now').addEventListener('click',()=>{forceBlinkUntil=performance.now()+210;});
 $('action-row').addEventListener('click',e=>{const action=e.target.closest('[data-action]')?.dataset.action;if(!action)return;controller.request(action);setActiveAction(action);});
 attachPointer($('stage'));
}
function setActiveAction(action){if(overlay)return;for(const node of document.querySelectorAll('[data-action]'))node.classList.toggle('active',node.dataset.action===action);}
function attachPointer(element){
 element.addEventListener('pointermove',e=>{
  const b=element.getBoundingClientRect();
  cursor=[(e.clientX-b.left-b.width/2)/(b.width*.48),(b.height/2-(e.clientY-b.top))/(b.height*.45)].map(v=>Math.max(-1,Math.min(1,v)));
  tracking=true;
  if(dragging)angle=Math.max(-2,Math.min(2,rotStart+(e.clientX-(element.dragAnchor??e.clientX))*.012));
 });
 element.addEventListener('pointerleave',()=>{tracking=false;cursor=[0,0];});
 if(!overlay){
  element.addEventListener('pointerdown',e=>{if(e.button!==0)return;dragging=true;rotStart=angle;element.dragAnchor=e.clientX;element.setPointerCapture?.(e.pointerId);});
  element.addEventListener('pointerup',()=>dragging=false);
  element.addEventListener('pointercancel',()=>dragging=false);
 }
}
function connectOverlay(){
 attachPointer($('overlay-view'));
 $('overlay-wave').addEventListener('click',()=>controller.request('wave'));
 $('overlay-idle').addEventListener('click',()=>controller.request('idle'));
 $('overlay-pass').addEventListener('click',async()=>{try{await invoke('set_passthrough',{enabled:true});toast('Click-through on. Use the tray icon to restore interaction.');}catch(e){toast(String(e));}});
 $('overlay-settings').addEventListener('click',()=>invoke('open_workshop').catch(e=>toast(String(e))));
 document.querySelector('[data-drag]').addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;invoke('begin_drag').catch(()=>{});});
}
function frame(time){
 const dt=lastTime?Math.min((time-lastTime)/1000,.05):0;lastTime=time;
 controller.update(dt);renderT+=dt;
 const active=overlay?controller.action!=='idle':controller.action!=='idle'||dragging||tracking;
 const interval=active?1/60:1/18;
 if(renderT>=interval){
  renderT=0;
  controller.setGaze(state.follow&&tracking?cursor[0]:0,state.follow&&tracking?cursor[1]:0);
  const blink=controller.blink>0?controller.blink:performance.now()<forceBlinkUntil?1:0;
  renderer.render(controller.pose(),{scale:state.scale/100,rotation:angle,gazeX:controller.gaze[0],blink});
  renderCount++;
  if(!overlay){$('animation-status').textContent=controller.action.toUpperCase();if(controller.action==='idle')setActiveAction('idle');}
 }
 if(time-lastReport>=1250){
  const fps=Math.round(renderCount*1000/(time-lastReport));renderCount=0;lastReport=time;
  if(!overlay)$('render-fps').textContent=fps+' FPS';
 }
 if(document.hidden)setTimeout(()=>requestAnimationFrame(frame),450);else requestAnimationFrame(frame);
}
boot();
