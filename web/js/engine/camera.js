/** Single source of truth for desktop camera and avatar root placement. */
import { chain, translation, rotateY, rotateZ, multiply, ortho, lookAt } from './mat4.js';

export const CAMERA = Object.freeze({ eye:[12,22,80], target:[0,16,0], halfHeight:19, yaw:0.06 });
export function avatarViewProjection(aspect, scale=1){
 if(!Number.isFinite(aspect)||aspect<=0||!Number.isFinite(scale)||scale<=0) throw new RangeError('Invalid camera aspect or scale');
 const h=CAMERA.halfHeight/scale;
 return multiply(ortho(-h*aspect,h*aspect,-h,h,-120,120),lookAt(CAMERA.eye,CAMERA.target));
}
export function avatarRootMatrix(pose, rotation=0){
 if(!Number.isFinite(rotation)) throw new RangeError('Invalid avatar rotation');
 return chain(translation(pose.rootX||0,pose.rootY||0,pose.rootZ||0),translation(0,16,0),rotateY(CAMERA.yaw+rotation),rotateZ(pose.bodyZ||0),translation(0,-16,0));
}
