import test from 'node:test';
import assert from 'node:assert/strict';
import { identity, translation, rotateX, rotateY, rotateZ, chain, multiply, lookAt, ortho } from '../web/js/engine/mat4.js';
import { rigParts, cuboidTriangles } from '../web/js/avatar/rig.js';
import { BehaviorController, ACTIONS } from '../web/js/avatar/animation.js';

function point(matrix, vector) {
  return [0, 1, 2, 3].map(row =>
    matrix[row] * vector[0] + matrix[4 + row] * vector[1] +
    matrix[8 + row] * vector[2] + matrix[12 + row] * vector[3]);
}

function modelFor(part, pose, rotation = 0) {
  const root = chain(translation(0, pose.rootY, pose.rootZ), translation(0, 15, 0),
    rotateY(.18 + rotation), rotateZ(pose.bodyZ), translation(0, -15, 0));
  const id = part.part || part.id;
  let rot = identity();
  if (id === 'head') rot = chain(rotateY(pose.headY), rotateX(pose.headX), rotateZ(pose.headZ));
  if (id === 'rightArm') rot = chain(rotateZ(pose.armRZ), rotateX(pose.armRX));
  if (id === 'leftArm') rot = chain(rotateZ(pose.armLZ), rotateX(pose.armLX));
  if (id === 'rightLeg') rot = rotateX(pose.legRX);
  if (id === 'leftLeg') rot = rotateX(pose.legLX);
  return chain(root, translation(...part.pivot), rot, translation(...part.center));
}

test('fundamental 3D transforms are finite 4x4 column-major matrices', () => {
  for (const m of [identity(), translation(0, 1, 2), rotateX(0), rotateY(0), rotateZ(0),
    rotateX(.2), rotateY(-.8), rotateZ(.3), lookAt([40,23,70], [0,15.5,0]),
    ortho(-20,20,-20,20,-120,120)]) {
    assert.equal(m.length, 16, 'a 4x4 transform must have exactly 16 entries');
    assert.ok(m.every(Number.isFinite), 'matrix entries must be finite');
  }
});

test('rotations preserve origin, homogeneous w and basis lengths', () => {
  for (const rot of [rotateX(.2), rotateY(.8), rotateZ(1.1)]) {
    assert.deepEqual(point(rot, [0,0,0,1]).map(n => +n.toFixed(12)), [0,0,0,1]);
    for (const v of [[1,0,0,0], [0,1,0,0], [0,0,1,0]]) {
      const out = point(rot, v);
      assert.ok(out.every(Number.isFinite));
      assert.ok(Math.abs(Math.hypot(...out.slice(0,3)) - 1) < 1e-10);
      assert.equal(out[3], 0);
    }
  }
});

test('Z rotation maps X axis to Y at 90 degrees', () => {
  const x = point(rotateZ(Math.PI / 2), [1,0,0,1]);
  assert.ok(Math.abs(x[0]) < 1e-12);
  assert.ok(Math.abs(x[1] - 1) < 1e-12);
  assert.equal(x[2], 0);
  assert.equal(x[3], 1);
});

test('all animation states project finite visible geometry for both rigs', () => {
  const aspect = 800 / 600, halfHeight = 19;
  const vp = multiply(ortho(-halfHeight * aspect, halfHeight * aspect,
    -halfHeight, halfHeight, -120, 120), lookAt([40,23,70], [0,15.5,0]));
  for (const slim of [false, true]) for (const action of ACTIONS) {
    const controller = new BehaviorController();
    controller.request(action);
    for (let t = 0; t < 15; t++) controller.update(.025);
    const pose = controller.pose();
    for (const part of rigParts(slim)) {
      const mvp = multiply(vp, modelFor(part, pose));
      assert.equal(mvp.length, 16);
      assert.ok(mvp.every(Number.isFinite), 'invalid MVP: ' + action + '/' + part.id);
      const vertices = cuboidTriangles(part);
      for (let i = 0; i < vertices.length; i += 8) {
        const clip = point(mvp, [...vertices.slice(i, i + 3), 1]);
        assert.ok(clip.every(Number.isFinite), 'non-finite vertex: ' + action + '/' + part.id);
        assert.ok(Math.abs(clip[3] - 1) < 1e-10);
        assert.ok(clip.slice(0,3).every(n => Math.abs(n) < 1.2),
          'clipped avatar: ' + action + '/' + part.id + '/' + clip.join(','));
      }
    }
  }
});
