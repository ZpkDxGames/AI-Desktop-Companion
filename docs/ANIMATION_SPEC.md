# Alpha.6 animation and avatar contract

## Canonical player geometry
Player geometry, Java 64×64 texture mapping, outer layers and Classic/Slim model selection come from `skinview3d 3.4.2`. The project no longer maintains a parallel custom cuboid/UV implementation.

## Local pose controller
`BehaviorController` remains the authority for companion behavior. It emits bounded pose channels which Alpha.6 maps to the skinview3d joints:

- head pitch/yaw/roll
- body roll
- left/right arm pitch and roll
- left/right leg pitch
- root X/Y/Z
- whole-character yaw

Base actions: idle, walk, run, wave, sit, jump, think, celebrate.

Trusted supplementary handlers: nod, shrug, stretch, bow.

Locomotion is still in-place. Window collision, platform sitting, climbing and gravity are later desktop-physics milestones.

## Facial rig
A supported skin marker generates separate 3D eye geometry under the head group:
- 2×2 sclera planes;
- 1×1 iris and pupil planes;
- 2×2 eyelid planes;
- continuous bounded horizontal pupil travel;
- eyelid closure from top to bottom.

These parts follow the head transform automatically. They are placed in front of the 8×8 base head but behind the 9×9 hat layer, allowing normal hair pixels to occlude the eyes through depth testing.

Unknown/ambiguous markers: no added face geometry.

## Rendering policy
- Perspective SkinViewer, transparent WebGL scene.
- FXAA and nearest-neighbor skin texture sampling.
- Workshop: tuned ambient/camera light and CSS studio backdrop.
- Overlay: same player renderer on transparent window with tighter camera zoom.
- Target frame pacing remains ~60 FPS active and ~18 FPS passive; hardware measurements are still required.

## Safety and extension policy
Animation modules are local, reviewed code. Do not load executable animation handlers from URLs. External motion data or code requires provenance and license review before inclusion.
