/** Test-only observer of the production renderer's existing frame marker. No clock/rig/RAF changes. */
export async function armReactionFrames(page,{canvasId='avatar-canvas',action,statusId='animation-status',count=3,pixels=true}={}){
 await page.evaluate(({canvasId,action,statusId,count,pixels})=>{
  window.__reactionFrames?.observer?.disconnect();
  const canvas=document.getElementById(canvasId),record={frames:[],last:-Infinity,eligible:!!statusId};
  const observer=new MutationObserver(mutations=>{
   if(!statusId&&mutations.some(m=>m.attributeName==='data-controller-action')&&canvas.dataset.controllerAction===action)record.eligible=true;
   const actual=statusId?document.getElementById(statusId).textContent.toLowerCase():canvas.dataset.controllerAction;
   const now=performance.now();
   if(!record.eligible||!mutations.some(m=>m.attributeName==='data-render-ready')||actual!==action||now-record.last<150||record.frames.length>=count)return;
   record.last=now;record.frames.push({action:actual,at:now,...(pixels?{png:canvas.toDataURL('image/png')}:{})});
   if(record.frames.length===count)observer.disconnect();
  });
  record.observer=observer;window.__reactionFrames=record;
  observer.observe(canvas,{attributes:true,attributeFilter:['data-render-ready','data-controller-action']});
 },{canvasId,action,statusId,count,pixels});
}
export async function readReactionFrames(page,count=3){
 await page.waitForFunction(n=>window.__reactionFrames?.frames.length===n,count);
 return page.evaluate(()=>{window.__reactionFrames.observer.disconnect();return window.__reactionFrames.frames;});
}
