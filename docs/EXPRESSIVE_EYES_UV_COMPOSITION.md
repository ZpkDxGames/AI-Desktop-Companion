# Expressive Eyes: native-UV compositing (draft milestone R1–R4)

**Branch:** `dev/expressive-eyes-fresh-moves`  
**Base:** `630b723b6582c4fe0e53f4e33325ac6587fd5ff1`, PR #5  
**Review:** https://github.com/ZpkDxGames/AI-Desktop-Companion/pull/6  
**Production:** unchanged; DO NOT MERGE without WebView2 owner acceptance.

## Reproduced defect

The prior `FaceRig3D` drew standalone upper iris and lower pupil quads on
top of a static image. `pupilOffset` enforced no whole-pixel shifts into
outer-hair-occluded columns. For a 2x2 marked skin with opaque upper-hair
pixels, that restricted *both* iris and pupil to their original columns,
so mouse movement affected head yaw but not eye pixels. The frame loop
also passed only `gazeX` and pointer detection ended at `#stage`.

Red-first regression on new branch:
https://github.com/ZpkDxGames/AI-Desktop-Companion/actions/runs/38323976097

## Geometry and material ownership

skinview3d v3.4.2 uses the inner head surface as an 8x8 box (front UV
u8..15, v8..15 in 64x64 pixels) and the 9x9 second layer at u40..47.
The same base-material instance is used for the rest of the player.
We now clone **only** `head.innerLayer.material`. The original shared
material remains on the body and arms; the outer hat material is not
touched, preserving alpha masking, physical mesh depth, light response
and actual geometry at three-quarter and side camera angles.

The shader replaces colors within **two recognized 2x2 head-front cells**.
It reads pre-extracted native swatch colors and original outer-column
backgrounds (which can be dark hair) from the imported 64x64 PNG. The
source texture remains intact. For expressions OFF, one uniform disables
the shader and the original PNG draws without overlay geometry.

Eyes ease horizontally and vertically, with source-native neutral
appearance. Both iris and pupil use the same two-axis displacement
(+/-0.36 skin pixels horizontally, +/-0.34 vertically) within each exposed
eye column. Keeping each row within that column avoids the previous
split-eye artifact when adjacent upper hair is opaque. Blink uses the
existing close/hold/open timing, with a source-color lid on the
recognized iris column and, on full closure, lower eye cells.
These are **bounded, intentionally subpixel** motions, not whole-pixel
Fresh Moves texture atlas frames. Final perceived expressiveness must
be judged on the real 64x64 skin in the native app.

Implementation files:
- `web/js/avatar/face-composition.js` — conservative face validation,
  reference pixel compositor, and unsupported-skin fallback.
- `web/js/engine/eye-shader.js` — UV-local shader functions.
- `web/js/engine/eye-face-material.js` — sole graphics resource owner,
  clones/restores head material, binds uniforms and maps at skin import.
- `web/js/engine/renderer.js` — keeps original skinview3d + Three.js
  renderer, body geometry, camera and joint application.
- `web/js/avatar/animation.js` — smoothed current/target eyes and
  slower head follow.
- `web/js/main.js` — same Workspace/overlay with pointer events
  across the window, Y gaze, blur/leave reset and active render wake.

The former `FaceRig3D` quad implementation and obsolete
`face-rig-layout.js` were deleted, not layered.

## Test and image evidence

- New synthetic marker-and-hair fixture exercises both axes and moving
  iris/pupil displacement, neutral pixel parity, actual alpha occlusion,
  eyelid covers and unsupported cases.
- Existing animation, pacing, Workspace and overlay test suites remain.
  Old tests that explicitly asserted frozen pupils were replaced with
  composited-pixel movement assertions.
- Chromium smoke script exercises the emitted production bundle,
  produces separate eye-direction screenshots for Workspace and overlay
  and checks screenshot pixel differences. These are **synthetic**
  fixtures, not a substituted claim of original-skin acceptance.
- The original skin is not checked into public tests or GitHub artifacts.
- Real owner-supplied video could not be frame-inspected directly;
  behavioral similarity has not been visually certified.

For latest exact-sha CI and installer checks, see PR #6 Checks. The
Windows NSIS artifact is an **unsigned test build**, not a stable release.
GitHub Actions Windows Chromium is not WebView2 on your computer.

## Native Windows acceptance protocol (still required)

1. Download the **exact PR #6 head-SHA** installer artifact from GitHub
   Actions, verify the provided `SHA256SUMS.txt`, install on Windows 11.
2. Import original `zpk-skin.png` unchanged, enable expressive eyes,
   position camera frontal then +/-45 degrees, side and head pitch.
3. Capture same-size OFF and ON neutral PNGs, then move the pointer to
   window left/right/up/down (including non-stage Workspace panels).
   Confirm obvious motion of **both** pupils, not only the head.
4. While looking left/right and upward/downward, click Preview blink;
   capture partially closed, closed and reopened. Check upper hat hair,
   mask, scarf, no detached upper iris and no double static eyes.
5. Repeat with Workspace plus overlay, fresh app startup, skin reload,
   100/150/200% DPI, model mode switches, context restoration, minimize
   and return, game running and fullscreen as relevant.
6. Record a 10–15 s clip and full-resolution head close-ups. Report
   process CPU/RAM, GPU/VRAM and p50/p95/p99 rendered-frame time over
   active/idle intervals. Targets: active <=60 FPS cap, about 16.7 ms
   between 60 FPS frames; idle near 20 FPS. Do not infer performance
   from shader compilation or screenshot tests.

### Acceptance blockers

- Real 64x64 original-skin opacity/mask/face-angle comparisons need
  actual Windows WebView2 capture; only synthetic public fixtures exist.
- The reference video was not directly inspected frame by frame.
- RTX 3050 CPU/GPU/VRAM numbers and native installation verification
  are **not measured here**.
- If subpixel eye travel is insufficiently perceptible on the native
  render, tune the shader's **single coherent** exposed-column
  expression design and test again; do not reinstate the old quads
  or change the underlying skin.

No eating, book, idle props, AI inference, global mouse hooks or
production merges are authorized in this milestone.
