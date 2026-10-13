/** Pure, allocation-free motion helpers shared by BehaviorController and the
 * action handlers. No state, no timers, no scene access: the controller stays
 * the sole owner of time, arbitration and pose state.
 */
export const clamp01=n=>n<0?0:n>1?1:n;
/** Quintic ease: zero velocity AND zero acceleration at both ends (no robotic "kick"). */
export const smootherstep=t=>{t=clamp01(t);return t*t*t*(t*(t*6-15)+10);};
export const easeInOutCubic=t=>{t=clamp01(t);return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;};
export const easeOutCubic=t=>{t=clamp01(t);return 1-Math.pow(1-t,3);};
/** Slight overshoot then settle: the "follow-through" feel on raised limbs. */
export const easeOutBack=(t,s=1.15)=>{t=clamp01(t);const u=t-1;return 1+u*u*((s+1)*u+s)};
/** Small dip before moving, small overshoot after: anticipation + follow-through. */
export const easeInOutBack=(t,s=.9)=>{
 t=clamp01(t);const c=s*1.525;
 return t<.5?(Math.pow(2*t,2)*((c+1)*2*t-c))/2:(Math.pow(2*t-2,2)*((c+1)*(t*2-2)+c)+2)/2;
};
/** Smooth quasi-random value in [-1,1]. Incommensurate sine sum: never visibly loops. */
export const drift=(t,seed=0)=>(Math.sin(t*.71+seed)+Math.sin(t*1.13+seed*1.7)*.6+Math.sin(t*1.93+seed*2.3)*.35)/1.95;

/** C1 authored root trajectory: preparation, push, flight, impact, recovery.
 * Tangents are in skin units/second, rather than frame units. No segment arrays
 * are constructed or searched in the frame path.
 */
const hermite=(t,a,b,x,y,v,w)=>{
 const duration=b-a,u=clamp01((t-a)/duration),u2=u*u,u3=u2*u;
 return (2*u3-3*u2+1)*x+(u3-2*u2+u)*duration*v+(-2*u3+3*u2)*y+(u3-u2)*duration*w;
};
export function jumpHeight(t){
 if(t<.18)return hermite(t,0,.18,0,-1.15,0,0);
 if(t<.26)return hermite(t,.18,.26,-1.15,.9,0,26);
 if(t<.50)return hermite(t,.26,.50,.9,4.2,26,0);
 if(t<.75)return hermite(t,.50,.75,4.2,0,0,-25);
 if(t<.82)return hermite(t,.75,.82,0,-1.2,-25,0);
 return hermite(t,.82,.95,-1.2,0,0,0);
}
export const arcPulse=(time,start,end)=>{
 const u=clamp01((time-start)/(end-start));
 return 16*u*u*(1-u)*(1-u);
};

/** How much of the always-on "life" layer each action keeps. Acting poses keep a
 * little so the body never freezes like a statue; locomotion/jumps keep almost none. */
export const LIFE_WEIGHT=Object.freeze({
 idle:1,sit:.65,think:.5,wave:.45,look:.3,read:.45,eat:.4,drink:.4,inspect:.3,
 nod:.5,shrug:.4,stretch:.2,bow:.25,walk:.12,run:.06,jump:0,celebrate:0
});

/** Writes the resting pose plus continuous micro-motion into every channel.
 * Layers (all non-periodic or slow so the loop is never noticeable):
 *  - breathing: chest depth, shoulders rise, head dips a hair on exhale
 *  - weight shift: slow sway of hips with the head counter-leveling (stabilised head)
 *  - gaze drift: head wanders a few degrees; torso follows a beat later (overlap)
 */
export function applyLifeLayer(p,t,w){
 const inhale=Math.sin(t*1.5)+.18*Math.sin(t*3);        // ~4.2 s cycle, slightly asymmetric
 const breath=(inhale*.45+.5)*w;                          // 0..~1
 const shift=drift(t*.22,1.3);                            // slow weight transfer, ±1
 const sway=shift*w;
 const lookX=drift(t*.45,4.1),lookY=drift(t*.37,7.7),lookZ=drift(t*.31,2.9);
 const lagY=drift(t*.37-.55,7.7);                         // torso copies head yaw 0.55 s later
 p.breath=breath;
 p.rootYaw=drift(t*.18,5.2)*.03*w;
 p.rootX=sway*.24;
 p.rootY=breath*.035+Math.abs(sway)*-.03;                 // sinks slightly when weight is loaded
 p.rootZ=0;
 p.bodyX=-breath*.012;
 p.bodyY=lagY*.05*w;
 p.bodyZ=sway*.045;                                       // shoulders lean away from the loaded hip
 p.headX=lookX*.035*w-breath*.01;
 p.headY=lookY*.08*w;
 p.headZ=lookZ*.015*w-sway*.02;                           // partial counter-tilt keeps the head near level
 p.armRX=-breath*.018+sway*.02;p.armLX=-breath*.018-sway*.02;
 p.armRZ=.04+breath*.012;p.armLZ=-.04-breath*.012;
 p.legRX=0;p.legLX=0;
 p.legRZ=-Math.max(0,sway)*.035;p.legLZ=Math.max(0,-sway)*.035;  // unloaded leg eases outward
 return p;
}
