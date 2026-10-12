/** Bounded, privacy-preserving local runtime event journal. No skin data, prompts or screenshots. */
const STAGES = Object.freeze(['BOOT','ASSETS','RENDERER','SKIN_READY','RUNNING','ERROR']);
const safe = value => String(value ?? '').slice(0,300);
export class RuntimeJournal {
  constructor({limit=48,now=()=>Date.now()}={}) {
    this.limit=Math.max(4,Math.min(100,limit));this.now=now;
    this.stage='BOOT';this.events=[];this.failure=null;
    this.record('BOOT','Application initializing');
  }
  record(stage,message) {
    if(!STAGES.includes(stage))throw new Error('Unknown boot stage: '+stage);
    this.stage=stage;
    this.events.push({at:new Date(this.now()).toISOString(),stage,message:safe(message)});
    if(this.events.length>this.limit)this.events.splice(0,this.events.length-this.limit);
  }
  fail(error) {
    // Never include a skin data URL or other arbitrary user file content in diagnostics.
    const raw=safe(error?.message??error).replace(/data:image\/[^\s]+/gi,'[redacted asset]');
    this.failure={id:'BOOT-'+this.now().toString(36).toUpperCase(),message:raw};
    this.record('ERROR',this.failure.message);
    return this.failure;
  }
  report(details={}) {
    return JSON.stringify({
      application:'ZpkDxGames Desktop Companion',
      timestamp:new Date(this.now()).toISOString(),
      stage:this.stage,failure:this.failure,events:[...this.events],
      ...details
    },null,2);
  }
}
