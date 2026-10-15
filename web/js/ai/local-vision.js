/** Volatile, explicit image consent owner. No inference on selection, no text fallback/history. */
import {parseReply,retentionPolicy,validModelName} from './local-conversation.js';
const MAX_BYTES=5*1024*1024,MAX_PIXELS=4_000_000;
const abort=()=>new DOMException('Image request cancelled','AbortError');
export function validateSource(bytes,type){
 if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>MAX_BYTES)throw Error('Image exceeds the 5 MiB source budget.');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let width=0,height=0;
 if(type==='image/png'&&bytes.length>=33&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)){
  if(view.getUint32(8)!==13||view.getUint32(12)!==0x49484452)throw Error('Invalid PNG header.');
  width=view.getUint32(16);height=view.getUint32(20);
 }else if(type==='image/jpeg'&&bytes.length>=4&&bytes[0]===255&&bytes[1]===216){
  let p=2;
  while(p+4<=bytes.length){
   if(bytes[p++]!==255)break;
   while(bytes[p]===255)p++;
   const marker=bytes[p++];if(marker===0xda||marker===0xd9)break;
   const length=view.getUint16(p);if(length<2||p+length>bytes.length)break;
   if([0xc0,0xc1,0xc2].includes(marker)&&length>=8){height=view.getUint16(p+3);width=view.getUint16(p+5);break;}
   p+=length;
  }
 }else throw Error('Choose one real PNG or JPEG image (matching file type).');
 if(!width||!height||width*height>MAX_PIXELS)throw Error('Image dimensions exceed the 4 megapixel budget or are invalid.');
 return {width,height};
}
function base64(bytes){let result='';for(let i=0;i<bytes.length;i+=16384)result+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(result);}
export class LocalVision{
 constructor({conversation,onState=()=>{},makeUrl=blob=>URL.createObjectURL(blob),revokeUrl=url=>URL.revokeObjectURL(url)}={}){
  this.conversation=conversation;this.onState=onState;this.makeUrl=makeUrl;this.revokeUrl=revokeUrl;
  this.state='idle';this.generation=0;this.preview=null;this.requestId=null;this.selectionId=null;
 }
 setState(state){this.state=state;this.onState(state);}
 dropPreview(){if(this.preview?.url)this.revokeUrl(this.preview.url);this.preview=null;}
 clear(){
  this.generation++;this.dropPreview();
  if(this.requestId)this.conversation.cancel();
  const selectionId=this.selectionId;this.selectionId=null;
  if(selectionId&&this.conversation.nativeInvoke)void Promise.resolve(this.conversation.nativeInvoke('vision_clear',{selectionId})).catch(()=>{});
  this.setState('cancelled');this.setState('idle');
 }
 async select(file){
  this.clear();const generation=this.generation;
  if(!this.conversation.nativeInvoke)throw Error('Image analysis requires the installed native Windows app.');
  if(!file||!['image/png','image/jpeg'].includes(file.type)||file.size<1||file.size>MAX_BYTES)throw Error('Choose one PNG/JPEG, at most 5 MiB.');
  this.setState('selecting');
  try{
   let bytes=new Uint8Array(await file.arrayBuffer());
   validateSource(bytes,file.type);
   if(generation!==this.generation){bytes.fill(0);return;}
   const selectionId='v7-'+crypto.randomUUID();this.selectionId=selectionId;
   const input={selectionId,mime:file.type,base64:base64(bytes)};bytes.fill(0);bytes=null;file=null;
   const prepared=await this.conversation.nativeInvoke('vision_prepare',{input});input.base64='';
   if(generation!==this.generation)return;
   if(!prepared||typeof prepared.token!=='string'||typeof prepared.base64!=='string'||prepared.base64.length>Math.ceil(MAX_BYTES/3)*4||!prepared.width||!prepared.height||prepared.width*prepared.height>MAX_PIXELS)throw Error('Invalid native image preview.');
   const decoded=Uint8Array.from(atob(prepared.base64),c=>c.charCodeAt(0));prepared.base64='';
   const url=this.makeUrl(new Blob([decoded],{type:'image/png'}));decoded.fill(0);
   this.preview={token:prepared.token,url,width:prepared.width,height:prepared.height,bytes:prepared.bytes};
   this.setState('preview');
  }catch(error){if(generation===this.generation){this.clear();this.setState('error');this.setState('idle');throw error;}}
 }
 async analyze(question,{model,approved=false,retentionSeconds=0,onStart=()=>{}}={}){
  if(approved!==true)throw Error('Explicit image analysis approval is required.');
  if(this.state!=='preview'||!this.preview)throw Error('Select and preview an image first.');
  if(this.conversation.pending)throw Error('Another local request is already running.');
  if(!validModelName(model))throw Error('Choose a supported local vision model.');
  if(typeof question!=='string'||question.length>2400)throw Error('Question exceeds 2400 characters.');
  const generation=this.generation,own=new AbortController(),requestId='v7-'+crypto.randomUUID();
  const input={token:this.preview.token,model,question:question.trim()||'Describe this image.',requestId,retentionSeconds:retentionPolicy(retentionSeconds)};
  this.requestId=requestId;this.conversation.pending=own;this.conversation.pendingId=requestId;
  const started=performance.now();let timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;this.clear();},120000);
  try{
   this.setState('authorized');this.setState('analyzing');onStart();
   const result=await this.conversation.nativeInvoke('vision_analyze',{input});
   if(own.signal.aborted||generation!==this.generation)throw abort();
   const parsed=parseReply(result?.content);
   this.setState('completed');
   return {...parsed,model,metrics:{loadMs:result.loadMs??null,generationMs:result.generationMs??null,completeResponseMs:performance.now()-started}};
  }catch(error){if(timedOut)throw new DOMException('Image analysis timed out','TimeoutError');if(own.signal.aborted||generation!==this.generation)throw abort();this.setState('error');throw error;}
  finally{
   clearTimeout(timer);
   if(this.requestId===requestId)this.requestId=null;
   if(this.conversation.pending===own){this.conversation.pending=null;this.conversation.pendingId=null;}
   if(generation===this.generation)this.clear();
  }
 }
}
