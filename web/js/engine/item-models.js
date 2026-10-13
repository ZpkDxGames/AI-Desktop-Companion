import {
 BufferGeometry,DataTexture,DoubleSide,Float32BufferAttribute,Group,Mesh,
 MeshBasicMaterial,MeshLambertMaterial,NearestFilter,RGBAFormat,SRGBColorSpace,UnsignedByteType
} from 'three';

/**
 * Original authored pixel art. These are NOT Mojang textures.
 * A user may replace them locally with image data from an authorized resource pack.
 * Data is generated once on module initialization; rendering never calls these routines.
 */
export const ITEM_IDS=Object.freeze(['apple','cooked_porkchop','golden_carrot','cake_slice','water_potion']);
const COLORS={
 red:'#b93b36',shine:'#e86752',shadow:'#7c242b',stem:'#76512d',leaf:'#69a753',
 pork:'#b97b4b',porkLight:'#e7b47e',porkDark:'#7b472f',bone:'#f3d5aa',
 gold:'#f1b92e',goldLight:'#ffe67a',goldDark:'#b78116',green:'#579544',
 cake:'#e6bb78',cakeDark:'#ab7046',frost:'#faf0d7',berry:'#c83e57',
 glass:'#97c6d9',glassDark:'#536b7c',water:'#269ed6',waterLight:'#6bd5f6',cork:'#926844'
};
const hex=s=>parseInt(s.slice(1),16);
const rasters={};
const pixel=(id)=>{const bytes=new Uint8Array(16*16*4);rasters[id]=bytes;return (x,y,color)=>{
 if(x<0||x>15||y<0||y>15)return;
 const n=(y*16+x)*4,c=hex(COLORS[color]||color);
 bytes[n]=c>>16;bytes[n+1]=(c>>8)&255;bytes[n+2]=c&255;bytes[n+3]=255;
};};
{
 const dot=pixel('apple');
 for(let y=3;y<=14;y++)for(let x=2;x<=13;x++){
  const center=7.5,dx=(x-center)/5.55,dy=(y-8.6)/5.65;
  if(dx*dx+dy*dy>1)continue;
  if(y===3&&(x===7||x===8))continue;
  if(y===14&&(x<6||x>9))continue;
  dot(x,y,x<=3||y>=12?'shadow':(x<=6&&y<=9?'shine':'red'));
 }
 for(let y=1;y<=3;y++)dot(8,y,'stem');
 for(let x=9;x<=12;x++)dot(x,2+(x>10?0:1),'leaf');
}
{
 const dot=pixel('cooked_porkchop');
 for(let y=3;y<=13;y++)for(let x=2;x<=13;x++){
  const dx=(x-7)/6.1,dy=(y-8)/5.8;
  if(dx*dx+dy*dy>1)continue;
  if(x>10&&y>10)continue;
  const edge=x<3||x>11||y<4||y>12;
  dot(x,y,edge?'porkDark':((x+y)%5<2?'porkLight':'pork'));
 }
 for(let y=9;y<=12;y++)for(let x=10;x<=14;x++){
  if((x===14&&(y===9||y===12))||(x===10&&y===12))continue;
  dot(x,y,((x+y)%3===0)?'porkDark':'bone');
 }
}
{
 const dot=pixel('golden_carrot');
 for(let y=3;y<=15;y++){
  const width=Math.max(.35,3.25-(y-3)*.22);
  const center=7.8-(y-4)*.12;
  for(let x=3;x<13;x++)if(Math.abs(x-center)<=width){
   dot(x,y,(x<center-1||y%4===2)?'goldDark':(x>center+.5?'goldLight':'gold'));
  }
 }
 for(let y=0;y<=4;y++){
  dot(7,y,'green');dot(9,y,'leaf');
  if(y===2||y===3){dot(5,y,'leaf');dot(10,y,'green');}
  if(y===1)dot(11,y,'leaf');
 }
}
{
 const dot=pixel('cake_slice');
 for(let y=4;y<=13;y++)for(let x=2;x<=13;x++){
  const width=(14-y)*.40+2.3;
  if(Math.abs(x-7.5)>width)continue;
  if(y>=12)dot(x,y,'cakeDark');
  else if(y<=6)dot(x,y,'frost');
  else dot(x,y,(x+y)%6===0?'cakeDark':'cake');
 }
 for(const [x,y] of [[4,4],[8,3],[11,4],[10,6]]){dot(x,y,'berry');dot(x,y+1,'berry');}
}
{
 const dot=pixel('water_potion');
 for(let y=0;y<=15;y++)for(let x=2;x<=13;x++){
  const within=y<=1?x>=7&&x<=9:
   y<=4?x>=6&&x<=10:
   y<=6?x>=4&&x<=12:
   y<=12?x>=3&&x<=13:
   y<=14?x>=4&&x<=12:false;
  if(!within)continue;
  if(y<=1)dot(x,y,'cork');
  else if(y<=4)dot(x,y,x===6||x===10?'glassDark':'glass');
  else if(x===3||x===13||(y>=13&&y<=14))dot(x,y,'glassDark');
  else if(y>=8&&y<=12)dot(x,y,x<=5||((x+y)%7===0)?'waterLight':'water');
  else dot(x,y,'glass');
 }
 for(const [x,y] of [[6,6],[9,5],[7,9],[10,11]])dot(x,y,'waterLight');
}
export const FALLBACK_ITEMS=Object.freeze(rasters);

/** No paths, traversal or unknown resources: only explicitly named local PNGs. */
export function resolveItemId(name){
 if(typeof name!=='string'||name.includes('..')||name.includes('\\')||name.startsWith('/'))return null;
 const match=/(?:^|\/)\b(apple|cooked_porkchop|golden_carrot|cake_slice|water_potion|potion)\.png$/i.exec(name);
 if(!match)return null;
 return match[1].toLowerCase()==='potion'?'water_potion':match[1].toLowerCase();
}
export function validateSpritePixels({width,height,data}){
 if(!Number.isInteger(width)||width!==height||![16,32,64,128].includes(width))throw Error('Unsupported item texture dimensions');
 if(!data||data.length!==width*height*4)throw Error('Malformed item texture pixels');
 return true;
}
function spriteTexture(pixels,width){
 const ordered=new Uint8Array(pixels.length);
 for(let y=0;y<width;y++){
  const source=(width-y-1)*width*4;
  ordered.set(pixels.subarray(source,source+width*4),y*width*4);
 }
 const texture=new DataTexture(ordered,width,width,RGBAFormat,UnsignedByteType);
 texture.magFilter=NearestFilter;texture.minFilter=NearestFilter;
 texture.generateMipmaps=false;texture.colorSpace=SRGBColorSpace;
 texture.needsUpdate=true;return texture;
}
/** Build a real thin voxel silhouette: opaque front texture + extruded alpha contour sides. */
export function createExtrudedItem(id,pixels,{width=16,pixelSize=.235,depth=.31}={}){
 validateSpritePixels({width,height:width,data:pixels});
 const group=new Group();group.userData.itemId=id;
 const texture=spriteTexture(pixels,width);
 const length=width*pixelSize;
 const frontGeometry=new BufferGeometry();
 frontGeometry.setAttribute('position',new Float32BufferAttribute([
 -length/2,-length/2,depth/2, length/2,-length/2,depth/2,
 length/2,length/2,depth/2, -length/2,length/2,depth/2
 ],3));
 frontGeometry.setAttribute('uv',new Float32BufferAttribute([0,0,1,0,1,1,0,1],2));
 frontGeometry.setIndex([0,1,2,0,2,3]);
 frontGeometry.computeVertexNormals();
 const faceMaterial=new MeshBasicMaterial({map:texture,alphaTest:.5,transparent:false,side:DoubleSide});
 const front=new Mesh(frontGeometry,faceMaterial);
 group.add(front);
 const sideVertices=[],sideColors=[];
 const opaque=(x,y)=>x>=0&&x<width&&y>=0&&y<width&&pixels[(y*width+x)*4+3]>=128;
 const triangle=(a,b,c,d,color)=>{
  sideVertices.push(...a,...b,...c,...a,...c,...d);
  for(let n=0;n<6;n++)sideColors.push(...color);
 };
 const at=(x,y,z)=>[(x-width/2)*pixelSize,(width/2-y)*pixelSize,z];
 for(let y=0;y<width;y++)for(let x=0;x<width;x++){
  if(!opaque(x,y))continue;
  const offset=(y*width+x)*4;
  const sideColor=[pixels[offset]*.78/255,pixels[offset+1]*.78/255,pixels[offset+2]*.78/255];
  if(!opaque(x-1,y))triangle(at(x,y,depth/2),at(x,y+1,depth/2),at(x,y+1,-depth/2),at(x,y,-depth/2),sideColor);
  if(!opaque(x+1,y))triangle(at(x+1,y+1,depth/2),at(x+1,y,depth/2),at(x+1,y,-depth/2),at(x+1,y+1,-depth/2),sideColor);
  if(!opaque(x,y-1))triangle(at(x+1,y,depth/2),at(x,y,depth/2),at(x,y,-depth/2),at(x+1,y,-depth/2),sideColor);
  if(!opaque(x,y+1))triangle(at(x,y+1,depth/2),at(x+1,y+1,depth/2),at(x+1,y+1,-depth/2),at(x,y+1,-depth/2),sideColor);
 }
 const sideGeo=new BufferGeometry();
 sideGeo.setAttribute('position',new Float32BufferAttribute(sideVertices,3));
 sideGeo.setAttribute('color',new Float32BufferAttribute(sideColors,3));
 sideGeo.computeVertexNormals();
 const sideMaterial=new MeshLambertMaterial({color:0xffffff,vertexColors:true,side:DoubleSide});
 const depthMesh=new Mesh(sideGeo,sideMaterial);group.add(depthMesh);
 group.userData.displayWidth=length;
 return {group,front,depth:depthMesh,texture,dispose(){
  group.removeFromParent();frontGeometry.dispose();sideGeo.dispose();texture.dispose();
  faceMaterial.dispose();sideMaterial.dispose();
 }};
}
