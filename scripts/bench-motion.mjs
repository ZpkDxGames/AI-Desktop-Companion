/** CPU controller comparison; not GPU or display-present telemetry. */
import {performance} from 'node:perf_hooks';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {BehaviorController,ACTIONS} from '../web/js/avatar/animation.js';
const baseline=(await import(pathToFileURL(resolve(process.argv[2],'web/js/avatar/animation.js')))).BehaviorController;
const results={backend:'Node.js CPU, 20-frame batches, 10,000 measured frames/action, GC before each action',rows:[]};
for(const [version,Controller] of [['V3',baseline],['V4',BehaviorController]])for(const action of ACTIONS){
 const c=new Controller({seed:2026});c.request(action);
 for(let i=0;i<1000;i++){c.update(1/60);c.pose();if(c.action==='idle'&&action!=='idle')c.request(action);}
 global.gc?.();const heapBefore=process.memoryUsage().heapUsed,samples=[],cpuBefore=process.cpuUsage();
 for(let i=0;i<500;i++){
  const start=performance.now();
  for(let j=0;j<20;j++){c.update(1/60);c.pose();if(c.action==='idle'&&action!=='idle')c.request(action);}
  samples.push((performance.now()-start)/20);
 }
 const cpu=process.cpuUsage(cpuBefore);global.gc?.();const heapAfter=process.memoryUsage().heapUsed;
 samples.sort((a,b)=>a-b);
 results.rows.push({version,action,p50:samples[250],p95:samples[475],p99:samples[495],cpuTotalMs:(cpu.user+cpu.system)/1000,retainedHeapDelta:heapAfter-heapBefore});
}
await writeFile(resolve(process.argv[3]||'motion-benchmark.json'),JSON.stringify(results,null,2));
console.log('Measured controller CPU cost for all 17 actions in both versions.');
