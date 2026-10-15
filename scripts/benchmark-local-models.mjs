/** Explicit owner tool: --real queries installed local models; --fixture measures only a simulation. */
import {LocalConversation,OLLAMA_BASE} from '../web/js/ai/local-conversation.js';
import {mkdir,writeFile} from 'node:fs/promises';
const real=process.argv.includes('--real'),fixture=process.argv.includes('--fixture');
if(real===fixture)throw Error('Choose --fixture or explicitly --real (local inference; no cloud).');
const models=['qwen3.5:4b','llama3.2:3b'];let resident=null,releases=0;
const fetchImpl=real?fetch:async(url,options)=>{
 const data=JSON.parse(options?.body||'{}');
 if(url.endsWith('/api/generate')){resident=null;releases++;return new Response('{}');}
 const loadMs=resident===data.model?5:180;
 await new Promise(r=>setTimeout(r,loadMs+20));resident=data.keep_alive?data.model:null;
 return new Response(JSON.stringify({load_duration:loadMs*1e6,eval_duration:20e6,
  message:{content:'{"reply":"Yes, that is correct.","reaction":"agree"}'}}));
};
const c=new LocalConversation({fetchImpl});
if(real){await c.inspectModels();if(models.some(m=>!c.catalog.some(v=>v.model===m&&v.status==='Installed')))throw Error('Install both supported local models first.');}
await mkdir('smoke-artifacts',{recursive:true});const samples=[];
for(const model of models)for(const retentionSeconds of [0,30,60]){
 // Explicit CLI benchmark reset isolates the first cold turn in every mode. No prompt or periodic job.
 await fetchImpl(OLLAMA_BASE+'/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,stream:false,keep_alive:0})});
 c.history.length=0;
 for(let sample=1;sample<=5;sample++){
  const out=await c.send('Is a diamond pickaxe used to mine obsidian?',{model,retentionSeconds});
  const entry={model,retentionSeconds,sample,...out.metrics};
  if(real){const response=await fetch(OLLAMA_BASE+'/api/ps');if(response.ok){const data=await response.json();entry.residency=(data.models||[]).slice(0,8).map(m=>({model:m.name,sizeBytes:m.size,sizeVRAMBytes:m.size_vram}));}}
  samples.push(entry);
 }
}
const summary=[];
for(const model of models)for(const mode of [0,30,60]){
 const rows=samples.filter(s=>s.model===model&&s.retentionSeconds===mode),timings=rows.map(s=>s.completeResponseMs).sort((a,b)=>a-b);
 summary.push({model,mode,count:rows.length,minMs:timings[0],medianMs:timings[2],p95Ms:timings[4],coldMs:rows[0].completeResponseMs,warmFollowupMs:rows.slice(1).map(s=>s.completeResponseMs)});
}
await writeFile('smoke-artifacts/v623-latency-'+(real?'real':'fixture')+'.json',JSON.stringify({
 environment:real?'Owner-run local Ollama; record device and Ollama version separately':'Deterministic simulation: 180/5ms load +20ms generation; NO real model/GPU certification',
 metric:'Complete-response wall time; non-streaming API has no first-token measurement',samples,summary,releases:real?null:releases,
 retentionDefault:'Off; RTX3050 safe default remains unmeasured',deviceFramePacing:'NOT MEASURED by this CLI'
},null,2));
console.log('PASS '+(real?'real local':'synthetic fixture')+' timing comparison: '+samples.length+' turns; no conversation content saved.');
