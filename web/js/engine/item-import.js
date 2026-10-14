import {ITEM_IDS,resolveItemId,validateSpritePixels} from './item-models.js';
import {readItemArchive} from './item-archive.js';
/**
 * Explicit user-selected PNGs only. Never scans the Minecraft installation,
 * starts a network request or uploads a personal texture. Explicitly selected
 * ZIP/JAR archives are read only for the same allowlisted item PNGs.
 * Limited source images are stored as data URLs in the existing local settings.
 */
const MAX_PNG_BYTES=160*1024;
const HEADER=[137,80,78,71,13,10,26,10];
export function isSafeItemDataUrl(value){
 return typeof value==='string'
  && /^data:image\/png;base64,[a-zA-Z0-9+/]+=*$/.test(value)
  && value.length<=MAX_PNG_BYTES*1.4;
}
export function sanitizeSavedItemTextures(candidate){
 const safe={};
 if(!candidate||typeof candidate!=='object'||Array.isArray(candidate))return safe;
 for(const id of ITEM_IDS)if(isSafeItemDataUrl(candidate[id]))safe[id]=candidate[id];
 return safe;
}
export async function readSelectedItemPngs(files){
 const sprites={};let count=0;
 const selected=[];
 for(const file of Array.from(files||[])){
  if(/\.(zip|jar)$/i.test(file.name))selected.push(...await readItemArchive(file));else selected.push(file);
 }
 for(const file of selected){
  const id=resolveItemId(file.name);
  if(!id)throw Error('Unknown item file: '+file.name+'. Expected apple, cooked_porkchop, golden_carrot, cake_slice or potion PNG.');
  if(file.size<=0||file.size>MAX_PNG_BYTES||file.type!=='image/png')
   throw Error('Item sprite must be an explicitly selected PNG at most 160 KB.');
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(!HEADER.every((n,i)=>bytes[i]===n))throw Error('Invalid PNG signature: '+file.name);
  const blob=new Blob([bytes],{type:'image/png'});
  const objectUrl=URL.createObjectURL(blob);
  try{
   const image=new Image();image.src=objectUrl;await image.decode();
   // Limit dimensions BEFORE allocating a canvas.
   if(![16,32,64,128].includes(image.naturalWidth)||image.naturalWidth!==image.naturalHeight)
    throw Error('Item sprite dimensions must be 16, 32, 64 or 128 pixels square.');
   const canvas=document.createElement('canvas');
   canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});
   ctx.imageSmoothingEnabled=false;ctx.drawImage(image,0,0);
   const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
   validateSpritePixels({width:canvas.width,height:canvas.height,data:pixels});
   sprites[id]=canvas.toDataURL('image/png');
   count++;
  }finally{URL.revokeObjectURL(objectUrl);}
 }
 return {sprites,count};
}
export async function decodeSavedItemPngs(sources,onSprite){
 const safe=sanitizeSavedItemTextures(sources);
 for(const id of ITEM_IDS){
  if(!safe[id])continue;
  const image=new Image();image.src=safe[id];
  try{
   await image.decode();
   const width=image.naturalWidth,height=image.naturalHeight;
   if(![16,32,64,128].includes(width)||width!==height)continue;
   const canvas=document.createElement('canvas');
   canvas.width=width;canvas.height=height;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});
   ctx.imageSmoothingEnabled=false;ctx.drawImage(image,0,0);
   const pixels=ctx.getImageData(0,0,width,height).data;
   validateSpritePixels({width,height,data:pixels});
   onSprite(id,pixels,width);
  }catch{/* Malformed/corrupt local imports fail back to author-owned sprites. */}
 }
}
