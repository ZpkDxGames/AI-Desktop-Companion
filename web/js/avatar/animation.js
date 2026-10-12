export const ACTIONS = Object.freeze(['idle','walk','run','wave','sit','jump','think','celebrate']);
export const PRIORITY = Object.freeze({idle:0,walk:1,run:1,sit:2,think:2,wave:3,jump:3,celebrate:3});
export const DURATION = Object.freeze({wave:2.4,jump:0.95,think:3.2,celebrate:1.7});
export const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
export const smooth = t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
export const mix=(a,b,t)=>a+(b-a)*t;
export class BehaviorController {
  constructor(){this.action='idle';this.elapsed=0;this.time=0;this.previous='idle';this.blendTime=0;this.gaze=[0,0];this.blink=0;this.nextBlink=3.3;this.mood='neutral';}
  request(action) {
    if(!ACTIONS.includes(action)) return false;
    if(action==='idle' || PRIORITY[action]>=PRIORITY[this.action] || !DURATION[this.action]){
      if(action!==this.action){this.previous=this.action;this.action=action;this.elapsed=0;this.blendTime=0;}
      return true;
    }
    return false;
  }
  update(dt){
    dt=clamp(dt,0,0.05);this.time+=dt;this.elapsed+=dt;this.blendTime+=dt;
    if(this.time>=this.nextBlink){this.nextBlink=this.time+3.0+(Math.sin(this.time*23)*.5+.5)*2.8;this.blink=1;}
    if(this.blink>0) this.blink=Math.max(0,this.blink-dt/0.14);
    if(DURATION[this.action] && this.elapsed>DURATION[this.action])this.request('idle');
  }
  setGaze(x,y){this.gaze=[clamp(x,-1,1),clamp(y,-1,1)];}
  pose(){
    const t=this.time,e=this.elapsed,a=this.action;
    const p={headX:Math.sin(t*.65)*.035,headY:Math.sin(t*.48)*.08,headZ:Math.sin(t*.4)*.015,bodyZ:Math.sin(t*.9)*.009,armRX:Math.sin(t*.9)*.03,armLX:-Math.sin(t*.9)*.03,armRZ:.04,armLZ:-.04,legRX:0,legLX:0,rootY:Math.sin(t*1.4)*.06,rootX:0,rootZ:0};
    if(a==='walk'||a==='run'){
      const speed=a==='run'?10:6.1,amplitude=a==='run'?.9:.60,sw=Math.sin(t*speed)*amplitude;
      p.armRX=sw;p.armLX=-sw;p.legRX=-sw;p.legLX=sw;p.rootY=Math.abs(Math.sin(t*speed))*0.2;p.bodyZ=Math.sin(t*speed*.5)*.04;
    }
    if(a==='wave'){
      const raise=smooth(Math.min(e/.28,(DURATION.wave-e)/.35));
      p.armLZ=2.4*raise;p.armLX=.15*raise;p.armLZ += Math.sin(e*13)*.24*raise;p.headZ=-.08*raise;
    }
    if(a==='sit'){p.legRX=-1.42;p.legLX=-1.42;p.armRX=-.12;p.armLX=-.12;p.rootY=-4.8;p.rootZ=1.0;}
    if(a==='jump'){const phase=clamp(e/DURATION.jump,0,1);p.rootY= Math.sin(Math.PI*phase)*4.4;p.legRX=-.32;p.legLX=.24;p.armRX=-.4;p.armLX=-.4;}
    if(a==='think'){p.headZ=.13;p.headY=.2;p.armRX=-.93;p.armRZ=-.18;}
    if(a==='celebrate'){p.armLX=-1.9;p.armRX=-1.9;p.rootY=Math.abs(Math.sin(e*9))*2;p.legRX=.2;p.legLX=-.2;}
    p.headY+=this.gaze[0]*.27;p.headX+=this.gaze[1]*-.15;
    const fade=smooth(this.blendTime/.17);
    // Neutral-pose interpolation is used for smooth entries; locomotion is continuous.
    if(fade<1){const keys=['armRX','armLX','armRZ','armLZ','legRX','legLX','rootY','rootX','rootZ'];for(const k of keys)p[k]*=fade;}
    return p;
  }
  expression(){return this.blink>.28?'blink':this.action==='think'?'thinking':'neutral';}
}
