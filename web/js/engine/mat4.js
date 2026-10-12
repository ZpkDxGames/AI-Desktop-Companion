/** Column-major matrices. No runtime dependencies. */
export const identity = () => [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
export function multiply(a,b) { const out=new Array(16).fill(0); for(let c=0;c<4;c++) for(let r=0;r<4;r++) for(let k=0;k<4;k++) out[c*4+r] += a[k*4+r]*b[c*4+k]; return out; }
export function translation(x=0,y=0,z=0) { const m=identity(); m[12]=x;m[13]=y;m[14]=z;return m; }
export function scale(x=1,y=1,z=1) { const m=identity(); m[0]=x;m[5]=y;m[10]=z;return m; }
export function rotateX(t) {const c=Math.cos(t),s=Math.sin(t);return [1,0,0,0,0,c,s,0,0,-s,c,0,0,0,0,1];}
export function rotateY(t) {const c=Math.cos(t),s=Math.sin(t);return [c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1];}
export function rotateZ(t) {const c=Math.cos(t),s=Math.sin(t);return [c,s,0,0,-s,c,0,0,0,0,1,0,0,0,0,1];}
export function chain(...matrices) {return matrices.reduce((a,b)=>multiply(a,b),identity());}
export function ortho(left,right,bottom,top,near,far) { return [2/(right-left),0,0,0,0,2/(top-bottom),0,0,0,0,-2/(far-near),0,-(right+left)/(right-left),-(top+bottom)/(top-bottom),-(far+near)/(far-near),1]; }
const sub=(a,b)=>a.map((n,i)=>n-b[i]); const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0); const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]; const unit=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l);};
export function lookAt(eye,target,up=[0,1,0]) { const z=unit(sub(eye,target)),x=unit(cross(up,z)),y=cross(z,x); return [x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]; }
