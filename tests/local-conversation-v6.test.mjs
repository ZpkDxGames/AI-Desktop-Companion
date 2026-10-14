import test from 'node:test';
import assert from 'node:assert/strict';
import {LocalConversation,OLLAMA_BASE,parseReply,validModelName,formatChatError} from '../web/js/ai/local-conversation.js';

const json=(data,status=200)=>({ok:status>=200&&status<300,status,headers:{get:()=>null},text:async()=>JSON.stringify(data)});
test('model names and gestures are strictly bounded',()=>{
 for(const model of ['llama3.2:3b','qwen2.5:1.5b','gemma3:4b'])assert.equal(validModelName(model),true);
 for(const model of ['', '../secret','http://example.com','some name','\n','x'.repeat(81)])assert.equal(validModelName(model),false);
 assert.deepEqual(parseReply('{"reply":"Hello","gesture":"wave"}'),{reply:'Hello',gesture:'wave'});
 assert.deepEqual(parseReply('{"reply":"Hello","gesture":"delete-files"}'),{reply:'Hello',gesture:null});
 assert.deepEqual(parseReply('{"reply":"Hi","gesture":"celebrate","tools":[{"name":"exec"}]}'),{reply:'Hi',gesture:'celebrate'});
});
test('provider is fixed to loopback with no request until explicitly requested',async()=>{
 const requests=[];
 const conn=new LocalConversation({fetchImpl:async(url,options)=>{requests.push({url,options});return json({models:[{name:'llama3.2:3b'},{name:'invalid name'},{name:'qwen2.5:1.5b'}]});}});
 assert.equal(OLLAMA_BASE,'http://127.0.0.1:11434');
 assert.equal(requests.length,0);
 assert.deepEqual(await conn.listModels(),['llama3.2:3b','qwen2.5:1.5b']);
 assert.equal(requests[0].url,OLLAMA_BASE+'/api/tags');
 assert.equal(requests[0].options.method,'GET');
});
test('user-initiated conversation sends only bounded local turns and permits no tools',async()=>{
 const captured=[];
 const conn=new LocalConversation({fetchImpl:async(url,options)=>{
   captured.push({url,options,body:JSON.parse(options.body)});
   return json({message:{role:'assistant',content:'{"reply":"Hello from local model.","gesture":"nod"}'}});
 }});
 const first=await conn.send('Hello',{model:'llama3.2:3b',gestures:true});
 assert.equal(first.reply,'Hello from local model.');
 assert.equal(first.gesture,'nod');
 assert.equal(captured[0].body.stream,false);
 assert.equal(captured[0].body.tools,undefined);
 assert.equal(captured[0].url,OLLAMA_BASE+'/api/chat');
 assert.equal(captured[0].body.messages[0].role,'system');
 assert.equal(captured[0].body.messages[1].role,'user');
 assert.equal(captured[0].body.messages[1].content,'Hello');
 for(let i=0;i<12;i++)await conn.send('Question '+i,{model:'llama3.2:3b'});
 assert.ok(conn.history.length<=12);
 assert.equal(conn.history.at(-1).role,'assistant');
 assert.equal(conn.history.some(m=>m.role==='system'),false);
 conn.clear();
 assert.deepEqual(conn.history,[]);
});
test('model text is never a valid host/tool instruction and gesture is optional',async()=>{
 const conn=new LocalConversation({fetchImpl:async()=>json({message:{content:'{"reply":"<script>alert(1)</script>","gesture":"wave"}'}})});
 const text=await conn.send('safe test',{model:'gemma3:4b',gestures:false});
 assert.equal(text.reply,'<script>alert(1)</script>');
 assert.equal(text.gesture,null);
 assert.equal(conn.history[1].content,'<script>alert(1)</script>');
});
test('network failure does not record the prompt or pretend reply was generated',async()=>{
 const conn=new LocalConversation({fetchImpl:async()=>{throw new TypeError('Failed to fetch');}});
 await assert.rejects(conn.send('Private prompt',{model:'llama3.2:3b'}),/local/i);
 assert.deepEqual(conn.history,[]);
 assert.match(formatChatError(new DOMException('cancel','AbortError')),/cancel/i);
});
test('response and user prompts are bounded, malformed models rejected before fetch',async()=>{
 let calls=0;
 const conn=new LocalConversation({fetchImpl:async()=>{calls++;return json({message:{content:'{"reply":"OK"}'}});}});
 await assert.rejects(conn.send('x'.repeat(2401),{model:'llama3.2'}),/length|short/i);
 await assert.rejects(conn.send('hello',{model:'http://remote/host'}),/model/i);
 assert.equal(calls,0);
 await conn.send('hello',{model:'llama3.2'});
 assert.equal(calls,1);
});
test('abort cancels in-flight work and prevents history commitment',async()=>{
 let reject;
 const conn=new LocalConversation({fetchImpl:async(_, {signal})=>new Promise((resolve,rej)=>{
  reject=rej;signal.addEventListener('abort',()=>rej(new DOMException('Aborted','AbortError')),{once:true});
 })});
 const pending=conn.send('Do not keep',{model:'llama3.2'});
 conn.cancel();
 await assert.rejects(pending,/abort/i);
 assert.deepEqual(conn.history,[]);
});
