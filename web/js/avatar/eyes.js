/** Pixel-level face edit. Never mutates the original imported skin image. */
export const DEFAULT_EYES={enabled:false,left:[2,3],right:[5,3],color:'#087c7c',base:'#c7b2a0',blink:'#574c40'};
export function validateEyes(p){
 const valid=(a)=>Array.isArray(a)&&a.length===2&&a.every(n=>Number.isInteger(n)&&n>=0&&n<8);
 return !!p&&valid(p.left)&&valid(p.right)&&typeof p.color==='string'&&typeof p.base==='string'&&typeof p.blink==='string';
}
export function gazeOffset(n){ return Math.max(-1,Math.min(1,Math.round(n))); }
export function drawEyeOverlay(ctx,profile,gazeX,gazeY,blink){
 if(!profile.enabled||!validateEyes(profile))return;
 const horizontal=gazeOffset(gazeX),vertical=gazeOffset(gazeY);
 for(const at of [profile.left,profile.right]){
   const [x,y]=at;
   // Coordinates are relative to head front UV (8,8); user manually calibrates for imported skins.
   ctx.fillStyle=profile.base;ctx.fillRect(8+x,8+y,1,2);
   if(blink){ctx.fillStyle=profile.blink;ctx.fillRect(8+x,8+y,1,1);continue;}
   ctx.fillStyle=profile.color;ctx.fillRect(8+Math.max(0,Math.min(7,x+horizontal)),8+Math.max(0,Math.min(7,y+vertical)),1,2);
 }
}
export function applyExpression(original,profile,gazeX,gazeY,blink){
 const out=document.createElement('canvas');out.width=64;out.height=64;
 const ctx=out.getContext('2d',{willReadFrequently:false});ctx.imageSmoothingEnabled=false;ctx.drawImage(original,0,0);
 drawEyeOverlay(ctx,profile,gazeX,gazeY,blink);return out;
}
