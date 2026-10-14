import test from 'node:test';import assert from 'node:assert/strict';
import {LocalConversation,sanitizeAiSettings} from '../web/js/ai/local-conversation.js';
const primary='qwen3.5:4b',fallback='llama3.2:3b';
const json=(data,status=200)=>({ok:status<400,status,headers:{get:()=>null},text:async()=>JSON.stringify(data)});
const good={message:{content:'{"reply":"Local answer","reaction":"insight"}'}};
test('defaults preserve owner model names, capabilities come from API not names',async()=>{
 assert.equal(sanitizeAiSettings({}).model,primary);assert.equal(sanitizeAiSettings({}).fallback,fallback);
 const c=new LocalConversation({fetchImpl:async(url,opts)=>url.endsWith('/show')?json({capabilities:['completion','vision']}):json({models:[{name:primary},{name:fallback}]})});
 assert.deepEqual((await c.inspectModels()).map(m=>m.capabilities),[['completion','vision'],['completion','vision']]);
});
test('primary recoverable failure retries once, commits one turn and advertises fallback',async()=>{
 const calls=[],status=[];const c=new LocalConversation({fetchImpl:async(_,opts)=>{const b=JSON.parse(opts.body);calls.push(b);return b.model===primary?json({},503):json(good);}});
 const result=await c.send('hello',{model:primary,fallback,installed:[primary,fallback],onStatus:s=>status.push(s)});
 assert.equal(result.model,fallback);assert.equal(result.fallbackUsed,true);assert.equal(result.reaction,'insight');
 assert.equal(c.history.length,2);assert.deepEqual(calls.map(b=>b.model),[primary,fallback]);
 assert.ok(calls.every(b=>b.keep_alive===0&&b.options.num_ctx===4096));assert.ok(status.some(s=>s.kind==='fallback'));
});
test('only Llama routes directly; neither installed makes zero inference requests',async()=>{
 let calls=0;const c=new LocalConversation({fetchImpl:async()=>{calls++;return json(good);}});
 assert.equal((await c.send('hi',{model:primary,fallback,installed:[fallback]})).fallbackUsed,true);
 await assert.rejects(c.send('hi',{model:primary,fallback,installed:[]}),/installed/);assert.equal(calls,1);
});
test('offline, malformed metadata, bad input and image trial never invoke text fallback',async()=>{
 for(const failure of ['offline','metadata','400','image']){
  let calls=0;const c=new LocalConversation({fetchImpl:async()=>{calls++;if(failure==='offline')throw new TypeError('offline');return failure==='400'?json({},400):json({message:{content:'{"reply":"Safe","reaction":"delete"}'}});}});
  if(failure==='metadata'){assert.equal((await c.send('hi',{model:primary,fallback,installed:[primary,fallback]})).reaction,'neutral');assert.equal(calls,1);}
  else {await assert.rejects(c.send('hi',{model:primary,fallback,installed:[primary,fallback],...(failure==='image'?{images:['private-image']}: {})}));assert.equal(calls,failure==='image'?0:1);}
 }
});
test('fallback failure is bounded; cancellation and stale completion never commit',async()=>{
 let count=0;const c=new LocalConversation({fetchImpl:async()=>{count++;return json({},503);}});
 await assert.rejects(c.send('hi',{model:primary,fallback,installed:[primary,fallback]}));assert.equal(count,2);assert.equal(c.history.length,0);
 let finish;const native=[];const d=new LocalConversation({nativeInvoke:(cmd,args)=>{native.push({cmd,args});if(cmd==='ollama_cancel')return Promise.resolve(true);return new Promise(r=>finish=r);}});
 const task=d.send('hi',{model:primary,fallback,installed:[primary,fallback]});d.clear();finish('{"reply":"Late","reaction":"agree"}');await assert.rejects(task,/abort/i);assert.equal(d.history.length,0);assert.equal(native.filter(c=>c.cmd==='ollama_chat').length,1);
});
test('remote aliases cannot route even when locally listed',async()=>{
 const c=new LocalConversation({fetchImpl:async()=>json({capabilities:['completion'],remote_model:'remote'})});
 c.listModels=async()=>[primary];assert.equal((await c.inspectModels())[0].local,false);
 await assert.rejects(c.send('hi',{model:primary,installed:[primary]}),/installed|local/);
});
