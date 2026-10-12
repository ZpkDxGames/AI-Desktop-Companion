/** Browser image import with strict size and byte checks. Files never leave the device. */
export async function loadSkin(file){
 if(!file || file.size>2*1024*1024)throw new Error('The skin file must be smaller than 2 MB.');
 if(file.type && file.type!=='image/png')throw new Error('Please select a PNG texture.');
 const signature=new Uint8Array(await file.slice(0,8).arrayBuffer());
 if(!isPngSignature(signature))throw new Error('The file does not contain a valid PNG signature.');
 const url=URL.createObjectURL(file);
 try{const image=await decodeImage(url);if(image.naturalWidth!==64||image.naturalHeight!==64)throw new Error('A modern Java Edition skin must be exactly 64 × 64 pixels.');return image;}
 finally{URL.revokeObjectURL(url);}
}
export function decodeImage(src){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('The image could not be decoded.'));im.src=src;});}
export function validateSkinDimensions(w,h){return w===64&&h===64;}

export function isPngSignature(bytes){return bytes.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);}
