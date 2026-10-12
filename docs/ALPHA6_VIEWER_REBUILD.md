# Alpha.6 — Avatar Viewer Rebuild

## Why the renderer was replaced
Repeated Windows screenshots showed that the custom procedural WebGL model remained visually unreliable: mask/clothing UVs, layer orientation and facial placement were difficult to certify even after local regression fixes. Alpha.6 stops layering patches onto that implementation.

The canonical player renderer now uses **skinview3d 3.4.2** (MIT), powered by Three.js. It supplies the established Java 64x64 UV atlas, correct base/outer layer materials, Classic/Slim support and automatic model detection.

Reference project: https://github.com/bs-community/skinview3d
License: MIT.

## Alpha.6 foundation
- Vite-bundled frontend instead of bare browser modules.
- Perspective SkinViewer with local transparent canvas, nearest-neighbor Minecraft skin textures, FXAA and tuned ambient/camera lighting.
- Auto-detect Classic/Slim by default; manual override remains available.
- Existing local BehaviorController drives the canonical skinview3d body joints.
- Existing ZpkDxGames marker detector is retained, but the old full-face repaint plane is not.
- Supported marker skins now receive **real 3D head-attached micro-geometry**:
  - 2x2 sclera plane per eye;
  - independent 1x1 iris + pupil planes;
  - separate eyelid plane that closes from top to bottom;
  - continuous bounded horizontal pupil travel;
  - all eye geometry sits above the base head but behind the normal 9x9 hat/hair layer so hair occludes it naturally.
- Unsupported marker layouts leave the canonical skin face unchanged.
- Desktop overlay uses the same canonical player renderer with transparent scene and tighter zoom.

## Code boundary
The old homegrown `rig.js`, `mat4.js`, and `camera.js` are no longer part of the production renderer. They are scheduled for deletion after this branch passes CI. The Alpha.5 rig/UV draft PR is superseded and should remain unmerged.

## Validation gates
1. `npm run check` installs/bundles skinview3d + Three and runs unit tests.
2. Windows Tauri/NSIS build must pass.
3. Real user skin must visually match Minecraft from front, quarter, sides and rear: mask, jacket, sleeves, trousers, hat/hair.
4. Auto-detected arm model must match; manual Classic/Slim override must not corrupt UVs.
5. 3D pupils and eyelids must remain behind opaque hat pixels and follow head rotation.
6. Workshop and transparent overlay must render the same skin/pose.
7. Only after Windows screenshot approval should the branch replace the previous draft and later merge into main.

No AI, screen capture or OS automation permissions are added in this milestone.
