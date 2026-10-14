import {Euler,Quaternion,Vector3} from 'three';

/** Coordinate the original sibling skin joints around the waist. Does not
 * reparent, replace, scale or deform any Minecraft mesh or skin layer.
 * All scratch objects are allocated once per renderer, never per frame.
 */
export class AvatarRig{
 constructor(){this.chest=new Quaternion();this.euler=new Euler();this.anchor=new Vector3();}
 place(part,x,y,z){
  this.anchor.set(x,y,z).applyQuaternion(this.chest);this.anchor.y-=12;
  part.position.copy(this.anchor);part.quaternion.premultiply(this.chest);
 }
 apply(skin,pose){
  skin.resetJoints();
  this.chest.setFromEuler(this.euler.set(pose.bodyX||0,pose.bodyY||0,pose.bodyZ||0));
  skin.body.rotation.set(0,0,0);skin.body.scale.set(1,1,1);
  skin.head.rotation.set(pose.headX||0,pose.headY||0,pose.headZ||0);
  skin.rightArm.rotation.set(pose.armRX||0,0,pose.armRZ||0);
  skin.leftArm.rotation.set(pose.armLX||0,0,pose.armLZ||0);
  this.place(skin.body,0,6,0);this.place(skin.head,0,12,0);
  this.place(skin.rightArm,-5,10,0);this.place(skin.leftArm,5,10,0);
  skin.rightLeg.rotation.set(pose.legRX||0,0,pose.legRZ||0);
  skin.leftLeg.rotation.set(pose.legLX||0,0,pose.legLZ||0);
 }
}
