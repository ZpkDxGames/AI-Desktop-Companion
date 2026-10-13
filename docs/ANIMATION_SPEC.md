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

## Eyes and face
Supported skin markers drive two-axis gaze and blinking through the head-only native-UV material compositor. The source skin, hat/hair layer, body materials and skinview3d geometry remain unmodified. Unsupported faces keep the vanilla skin unchanged. See `EXPRESSIVE_EYES_UV_COMPOSITION.md`.

## Rendering policy
- Perspective SkinViewer, transparent WebGL scene.
- FXAA and nearest-neighbor skin texture sampling.
- Workshop: tuned ambient/camera light and CSS studio backdrop.
- Overlay: same player renderer on transparent window with tighter camera zoom.
- Target frame pacing remains ~60 FPS active and ~18 FPS passive; hardware measurements are still required.

## Safety and extension policy
Animation modules are local, reviewed code. Do not load executable animation handlers from URLs. External motion data or code requires provenance and license review before inclusion.


## Behavior director / daily actions (draft)

The existing `BehaviorController` is the only action arbiter; no second scheduler or motion state machine was added. It schedules `look`, `read`, `eat`, `drink`, `inspect`, `stretch` and `nod` only while idle, with seeded deterministic choice and bounded calm/lively countdowns. Manual activity requests override or defer automatic actions using the same priority and transition rules. Idle mode `off` is a hard stop for new automatic actions.

The canonical renderer owns an `AvatarProps` instance; it attaches prebuilt blocky book, food and drink meshes to the existing body joint group, adjacent to the procedural hand gestures. All geometries/materials are cached for the renderer's lifetime, updated in place and disposed when the renderer is destroyed. Props do not modify imported textures. This remains a development milestone; actual native Windows screenshots and performance gates are pending.
