# Alpha.5 step 1 — Vanilla rig audit

## Fixed defects
1. All six faces of every cuboid used clockwise/inward triangle winding despite outward declared normals; the face micro-plane did as well. Reversed both triangle orders and enabled WebGL BACK-face culling with CCW front faces.
2. Arms previously rotated about their top-center, which produced incorrect movement and sleeves even though resting boundaries looked accurate. The original geometry bounds remain the same, but the proper hinge is now x=±5, y=22 and the local arm center is x=±1 (Classic) or ±0.5 (Slim), y=-4.

## Verified unchanged
- Head 8×8×8, body 8×12×4, legs 4×12×4 and arms 4×12×4 / 3×12×4.
- Body spans y=12..24, head 24..32, legs 0..12, arm meshes 12..24.
- Matching base and outer pivots, with +0.25 layer inflation per side (hat +0.5).
- Canonical Java 64×64 UV atlas positions for each part; no skin artwork changed.

## Tests and gate
- New rig geometry tests failed on the original inward faces, then passed after correction.
- Added shoulder-pivot expectations, and replaced an earlier test that mistakenly codified y=24 as the arm pivot.
- Local Node check: 37/37 tests passing.
- Windows/WebView2 visual verification remains pending. Managed Chromium in this environment blocks local navigation.
- Changes live on a separate draft branch based on the earlier alpha.4 draft. No merge into main.

## Next Alpha.5 milestones
Skin Classic/Slim format detection with manual override; head-attached 3D eye/eyelid geometry; Windows visual and performance tests.

Reference for shoulder hinge and inner cuboid offsets: bs-community/skinview3d player model implementation.
