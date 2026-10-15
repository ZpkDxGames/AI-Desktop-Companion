/** Container-only CPU microbenchmark. Does not certify native RTX/WebView performance. */
import {performance} from 'node:perf_hooks';import {writeFile,mkdir} from 'node:fs/promises';import {Group} from 'three';
import {ConversationReactionCoordinator} from '../web/js/ai/reaction-coordinator.js';import {AvatarEffects} from '../web/js/engine/avatar-effects.js';
const c=new ConversationReactionCoordinator(),e=new AvatarEffects(new Group()),decision=[],effect=[];
c.configure({effects:true,sleepy:true,gestures:true});
for(let i=0;i<5500;i++){
 let start=performance.now();c.event('request-start',{requestId:i+1});c.sample();c.event('answer',{requestId:i+1,reaction:i%2?'agree':'uncertain'});const cost=performance.now()-start;
 start=performance.now();e.update('idle',0,1/60,null,null,{thinking:i%2===0,bulbAge:.7});const eCost=performance.now()-start;
 if(i>=500){decision.push(cost);effect.push(eCost);}
}
const stats=a=>{a.sort((x,y)=>x-y);return {p50:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],p99:a[Math.floor(a.length*.99)]};};
const result={environment:'Linux container / Node '+process.version+' / '+process.arch+'; CPU microbenchmark, no GPU',unit:'milliseconds',samples:5000,coordinator:stats(decision),effectUpdate:stats(effect),pool:{geometries:e.geometries.length,materials:e.materials.length},nativeWindows:'NOT RUN'};
e.dispose();await mkdir('smoke-artifacts',{recursive:true});await writeFile('smoke-artifacts/v62-container-cpu.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
