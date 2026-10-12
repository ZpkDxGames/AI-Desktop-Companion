/** Fixed-deadline render scheduler.
 * Does not simulate motion or schedule timers: the one authoritative frame loop
 * owns all callbacks. Paces 120/144Hz monitors without rendering at monitor Hz.
 */
export class FramePacer {
 constructor({activeFps=60,idleFps=20,toleranceMs=.75}={}){
  this.activeInterval=1000/activeFps;
  this.idleInterval=1000/idleFps;
  this.toleranceMs=toleranceMs;
  this.nextDeadline=null;
  this.lastFrame=null;
  this.active=false;
 }
 reset(){this.nextDeadline=null;this.lastFrame=null;this.active=false;}
 ready(time,active=true){
  if(!Number.isFinite(time))return false;
  const interval=active?this.activeInterval:this.idleInterval;
  if(this.nextDeadline===null||time<this.lastFrame){
   this.lastFrame=time;
   this.nextDeadline=time+interval;
   this.active=active;
   return true;
  }
  if(active!==this.active){
   this.nextDeadline=this.lastFrame+interval;
   this.active=active;
  }
  if(time+this.toleranceMs<this.nextDeadline)return false;
  // Advance absolute deadlines rather than measuring an interval from the
  // displayed frame, preventing 120+Hz refresh jitter from accumulating.
  const late=Math.max(0,time-this.nextDeadline);
  this.nextDeadline+=interval*(1+Math.floor(late/interval));
  this.lastFrame=time;
  return true;
 }
}
