import {resolveItemId} from './item-models.js';

const MAX_ARCHIVE=128*1024*1024,MAX_PNG=160*1024;
const crcTable=new Uint32Array(256);
for(let n=0;n<256;n++){let c=n;for(let i=0;i<8;i++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;crcTable[n]=c>>>0;}
const crc32=bytes=>{let crc=0xffffffff;for(const b of bytes)crc=crcTable[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;};
const decoder=new TextDecoder('utf-8',{fatal:true});
const itemPath=name=>{
 if(name.includes('..')||name.includes('\\')||name.startsWith('/'))return null;
 const lower=name.toLowerCase();
 const prefix=['assets/minecraft/textures/item/','textures/item/','textures/items/'].find(p=>lower.startsWith(p));
 const leaf=prefix?lower.slice(prefix.length):lower;
 if(leaf.includes('/'))return null;
 return resolveItemId(leaf);
};

/** Only the user's explicitly selected archive is read. No extraction to disk,
 * directory scanning, native permissions, game downloads or runtime network.
 */
export async function readItemArchive(file){
 if(!file||file.size<22||file.size>MAX_ARCHIVE)throw Error('Selected item archive must be at most 128 MB.');
 const tailStart=Math.max(0,file.size-65557),tail=new DataView(await file.slice(tailStart).arrayBuffer());
 let end=-1;
 for(let i=tail.byteLength-22;i>=0;i--)if(tail.getUint32(i,true)===0x06054b50&&i+22+tail.getUint16(i+20,true)===tail.byteLength){end=i;break;}
 if(end<0)throw Error('Invalid ZIP/JAR directory.');
 const count=tail.getUint16(end+10,true),size=tail.getUint32(end+12,true),offset=tail.getUint32(end+16,true);
 if(tail.getUint16(end+4,true)||tail.getUint16(end+6,true)||tail.getUint16(end+8,true)!==count||count>60000||size>16*1024*1024||offset+size>tailStart+end)
  throw Error('Multipart or oversized ZIP/JAR is unsupported.');
 const directory=new DataView(await file.slice(offset,offset+size).arrayBuffer()),entries=new Map();
 let cursor=0;
 for(let i=0;i<count;i++){
  if(cursor+46>size||directory.getUint32(cursor,true)!==0x02014b50)throw Error('Invalid ZIP/JAR entry.');
  const nameSize=directory.getUint16(cursor+28,true),extraSize=directory.getUint16(cursor+30,true),commentSize=directory.getUint16(cursor+32,true);
  const next=cursor+46+nameSize+extraSize+commentSize;if(next>size)throw Error('Invalid ZIP/JAR entry bounds.');
  const name=decoder.decode(new Uint8Array(directory.buffer,cursor+46,nameSize)),id=itemPath(name);
  if(id){
   if(entries.has(id))throw Error('Duplicate supported item texture: '+id);
   const flags=directory.getUint16(cursor+8,true),method=directory.getUint16(cursor+10,true),compressed=directory.getUint32(cursor+20,true),uncompressed=directory.getUint32(cursor+24,true),local=directory.getUint32(cursor+42,true);
   if((flags&1)||![0,8].includes(method)||!uncompressed||compressed>MAX_PNG||uncompressed>MAX_PNG||local+30+compressed>offset)
    throw Error('Unsupported or oversized item texture: '+name);
   entries.set(id,{name,method,compressed,uncompressed,local,crc:directory.getUint32(cursor+16,true)});
  }
  cursor=next;
 }
 if(!entries.size)throw Error('No supported Minecraft item textures found in the selected archive.');
 const files=[];
 for(const [id,entry] of entries){
  const header=new DataView(await file.slice(entry.local,entry.local+30).arrayBuffer());
  if(header.getUint32(0,true)!==0x04034b50)throw Error('Invalid local item entry.');
  const nameSize=header.getUint16(26,true),extraSize=header.getUint16(28,true),dataOffset=entry.local+30+nameSize+extraSize;
  if(dataOffset+entry.compressed>offset||header.getUint16(8,true)!==entry.method)throw Error('Invalid local item bounds.');
  const localName=decoder.decode(new Uint8Array(await file.slice(entry.local+30,entry.local+30+nameSize).arrayBuffer()));
  if(localName!==entry.name)throw Error('Mismatched local item path.');
  const blob=file.slice(dataOffset,dataOffset+entry.compressed);
  const reader=(entry.method===8?blob.stream().pipeThrough(new DecompressionStream('deflate-raw')):blob.stream()).getReader();
  const pixels=new Uint8Array(entry.uncompressed);let written=0;
  try{
   while(true){const {value,done}=await reader.read();if(done)break;
    if(written+value.length>pixels.length){await reader.cancel();throw Error('Expanded item exceeds declared size.');}
    pixels.set(value,written);written+=value.length;
   }
  }finally{reader.releaseLock();}
  if(written!==entry.uncompressed||crc32(pixels)!==entry.crc)throw Error('Corrupt item PNG in archive.');
  files.push(new File([pixels],id+'.png',{type:'image/png'}));
 }
 return files;
}
