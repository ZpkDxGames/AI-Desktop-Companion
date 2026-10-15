import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {LocalVision,validateSource} from '../web/js/ai/local-vision.js';
import {LocalConversation} from '../web/js/ai/local-conversation.js';
const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64'));
const file=(bytes=png,type='image/png')=>({size:bytes.length,type,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)});
function fixture(){
 const calls=[],events=[],urls=[];let finish;
 const conversation=new LocalConversation({nativeInvoke:async(cmd,args)=>{
  calls.push({cmd,args});
  if(cmd==='vision_prepare')return {token:args.input.selectionId,width:1,height:1,bytes:png.length,base64:Buffer.from(png).toString('base64')};
  if(cmd==='vision_analyze')return new Promise(resolve=>finish=resolve);
  return true;
 }});
 const vision=new LocalVision({conversation,onState:s=>events.push(s),makeUrl:()=>{const u='blob:fixture-'+urls.length;urls.push(u);return u;},revokeUrl:u=>urls.splice(urls.indexOf(u),1)});
 return {vision,conversation,calls,events,urls,finish:()=>finish({content:'{"reply":"A synthetic image.","reaction":"insight"}'})};
}
test('selection only prepares native preview; explicit approval consumes it once; no history',async()=>{
 const f=fixture();await f.vision.select(file());
 assert.equal(f.vision.state,'preview');assert.equal(f.calls.filter(c=>c.cmd==='vision_analyze').length,0);
 await assert.rejects(f.vision.analyze('',{model:'qwen3.5:4b'}),/approval/i);
 const pending=f.vision.analyze('',{model:'qwen3.5:4b',approved:true});
 assert.equal(f.vision.state,'analyzing');assert.equal(f.conversation.pending!==null,true);
 const sent=f.calls.find(c=>c.cmd==='vision_analyze').args.input;
 assert.equal(sent.question,'Describe this image.');assert.equal(sent.token,f.calls[0].args.input.selectionId);
 assert.equal(Object.hasOwn(sent,'base64'),false);assert.equal(Object.hasOwn(sent,'messages'),false);
 await assert.rejects(f.conversation.send('hello'),/already/);
 f.finish();const result=await pending;assert.equal(result.reaction,'insight');
 assert.equal(f.vision.state,'idle');assert.equal(f.urls.length,0);assert.equal(f.vision.preview,null);assert.deepEqual(f.conversation.history,[]);
 await assert.rejects(f.vision.analyze('',{model:'qwen3.5:4b',approved:true}),/preview/i);
});
test('cancel, clear, replacement and late completion discard images and answers',async()=>{
 const f=fixture();await f.vision.select(file());const pending=f.vision.analyze('question',{model:'qwen3.5:4b',approved:true});
 f.vision.clear();f.finish();await assert.rejects(pending,/Abort|cancel/i);
 assert.equal(f.urls.length,0);assert.equal(f.vision.state,'idle');assert.equal(f.conversation.pending,null);
 assert.ok(f.calls.some(c=>c.cmd==='ollama_cancel'));assert.deepEqual(f.conversation.history,[]);
});
test('late prepare cannot replace a newer selection or escape cleanup',async()=>{
 const waits=[],revoked=[];const conversation=new LocalConversation({nativeInvoke:async(cmd,args)=>cmd==='vision_prepare'?new Promise(resolve=>waits.push(()=>resolve({token:args.input.selectionId,width:1,height:1,bytes:png.length,base64:Buffer.from(png).toString('base64')}))):true});
 const v=new LocalVision({conversation,makeUrl:()=> 'blob:latest',revokeUrl:u=>revoked.push(u)});
 const a=v.select(file());await new Promise(r=>setImmediate(r));const b=v.select(file());await new Promise(r=>setImmediate(r));
 waits[1]();await b;waits[0]();await a;assert.equal(v.state,'preview');v.clear();assert.deepEqual(revoked,['blob:latest']);
});
test('source budget, MIME/signature and header dimensions checked before native IPC',async()=>{
 assert.equal(validateSource(png,'image/png').width,1);
 for(const type of ['image/jpeg','image/gif','image/webp','image/svg+xml','text/html','application/pdf'])assert.throws(()=>validateSource(png,type));
 for(const bytes of [new Uint8Array(4),new Uint8Array(5*1024*1024+1)])assert.throws(()=>validateSource(bytes,'image/png'));
 const huge=png.slice();new DataView(huge.buffer).setUint32(16,999999);assert.throws(()=>validateSource(huge,'image/png'),/pixel|dimension/i);
 const f=fixture();await assert.rejects(f.vision.select(file(png,'text/html')));assert.equal(f.calls.some(c=>c.cmd==='vision_prepare'),false);
});
test('native-only image transport and text fallback remain separate',async()=>{
 let fetched=0;const conversation=new LocalConversation({fetchImpl:()=>fetched++});const v=new LocalVision({conversation});
 await assert.rejects(v.select(file()),/native|installed/i);assert.equal(fetched,0);
 await assert.rejects(conversation.send('hi',{images:['x']}),/text only|image/i);
});
test('no new renderer, persistent image data or screen capture commands',async()=>{
 const source=await readFile(new URL('../web/js/ai/local-vision.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/localStorage|indexedDB|console\.|fetch\(|BehaviorController|requestAnimationFrame|getDisplayMedia/);
 const native=await readFile(new URL('../src-tauri/src/lib.rs',import.meta.url),'utf8');assert.doesNotMatch(native,/capture_screen|getDisplayMedia|GraphicsCapturePicker/);
 assert.match(native,/vision_prepare/);assert.match(native,/vision_analyze/);
});
