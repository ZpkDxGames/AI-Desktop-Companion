# Avatar fidelity & animation-frame pacing — renderer certification

**Status:** source/browser regression pass; the genuine Windows/WebView2 + RTX 3050 visual and performance gates are **not** yet certified. This branch builds on `dev/desktop-recovery-workspace-2026-10-12` without changing production `main`.

## Observed problem (2026-10-12)

- The user-provided Workspace screenshot shows noticeably improved vanilla player proportions and clothing layers, but experimental white eye tiles still differ from the source skin.
- The original local 64×64 skin's recognized eyes occupy a **2×2 pixel cell** each. The upper outer cell is **dark hair**, not white. The former experimental rig drew a white plane over all four pixels, changing original facial artwork.
- The screenshot reports **120 FPS** on the user's high-refresh display. Before this change, the active `requestAnimationFrame` loop had no enforced 60 FPS limit. That was an upper-bound defect, not evidence of stable 120 FPS during every workload.
- Earlier gesture transitions multiplied the new action pose from zero, producing visual snap through the neutral pose when interrupting sit/walk/wave. Blinks started fully closed and reopened in one short decay.

## Replacement / ownership

1. Retain exactly one `AvatarRenderer`, one `skinview3d` + Three.js viewer per visible window and one existing `BehaviorController` per surface. Do not restore obsolete custom UV mesh code.
2. `detectFaceProfile` reads (never changes) original PNG marker/pixel colors. It accepts only the already-supported symmetric two-eye pattern and reads per-eye upper background pixels and lower white pixels. If validation fails, the vanilla texture stays visible without 3D additions.
3. `FaceRig3D` replaces the opaque full-white 2×2 eye tile with two **static background pixel rows**, one 1×1 iris, one 1×1 pupil, and reusable micro-geometry for closed eyelids. Neutral iris/pupil exactly match the source PNG pixel columns. Gaze snaps to whole-pixel positions while subtle continuous head turns retain fluid motion.
4. The eyelid keeps the upper outer **hair pixel visible during a half blink**. A full blink closes the lower row as well. No whole-skin repaint, texture upload or geometry rebuild occurs per gaze/blink frame.
5. Facial quads use the same `MeshStandardMaterial` lighting model as upstream `skinview3d@3.4.2` so backgrounds receive the same scene illumination as head pixels. Head-attached planes stay behind the existing hat/hair outer mesh and are disposed when an imported skin changes.
6. `BehaviorController` owns blink phase (close → hold → open) and copies the previous visible pose to its reusable transition buffer. Interruption eases between real poses rather than fading limbs through rest.
7. A single `FramePacer` controls rendered frame deadlines: **60 FPS cap during interaction/gestures** and **20 FPS low-motion idle target**, with resets on hidden/recovered surfaces. This enforces a scheduling ceiling; actual delivered FPS/frame-time stability still require on-device measurement. The renderer still uses one animation callback owner and never starts AI inference.

## Test gates

- Red-first regression tests: `tests/face-native-fidelity.test.mjs` and `tests/frame-pacing-and-motion.test.mjs`.
- Unit checks cover pixel background parity, matching native pupil columns, snapped gaze/lids, reuse of eyelid state, unsupported skin fallback, 120Hz pacing, idle scheduling, blink shape, and uninterrupted animation pose continuity.
- Production-browser smoke verifies Workspace/overlay startup, non-static wave image, skin import/reload, and adaptive dimensions on Windows CI. It **does not** use or commit the real skin PNG.
- `npm ci && npm run check`; review the newest GitHub Actions run for results after every commit.

## Mandatory real Windows acceptance

Import the authentic ZpkDxGames skin into the new **unsigned dev installer** and capture:

- A: vanilla face, front and three-quarter, neutral expression.
- B: 3D eyes enabled, same camera pose with neutral gaze. The pupil colors/columns should reproduce A without enlarged white squares.
- C: gaze extreme left and right, half blink, full blink, and rotated head. Check zero duplicated pupil/iris or hair-depth glitches.
- D: idle, walk, jump, wave, sit→wave interruption. Check for snaps and motion continuity.
- E: compare overlay-only and Workspace-open actual FPS, frame-time p50/p95/p99, process CPU/RAM, GPU activity and VRAM on Windows 11 25H2 / RTX 3050 8 GB. Check 120/144Hz monitor and fullscreen-game coexistence; 60 FPS is a **target**, not a claimed measurement.

Do not merge to recovery/main or label stable until actual Windows screenshots and hardware measurements pass. More gestures (eating, reading, books/items) are **deliberately deferred**.

## Occluded pupil regression — follow-up correction

The owner’s first on-device screenshot of the 3D eye build revealed **split/fragmented upper irises and lower pupils** around the mask. Analysis of the genuine local 64×64 PNG confirmed that the outer head layer is **opaque at the adjacent upper-left eye pixel and adjacent upper-right eye pixel**, while both lower eye-row pixels are transparent on the outer layer. An unconditional one-pixel gaze shift therefore hid the upper iris behind hair but left the pupil visible below it. The old micro planes also sat only 0.018 units above the inner head, leaving little depth precision margin for eye textures.

### Corrective ownership and tradeoff

- Read the actual *outer head/hat layer* alpha from the standard Java skin UV x40–47 at the eye coordinates (offset +32 from the base head front). Each eye stores four booleans for upper/lower 2×2 cell occlusion.
- Validate that the existing iris column remains visible. Reject unsupported profiles rather than constructing geometry that will override the skin incorrectly.
- **Only allow a full one-pixel gaze shift when the destination column is visible in both upper and lower rows.** On the current ZpkDxGames skin, both outward columns are obscured by opaque upper hair, so this temporarily limits horizontal *pupil* displacement to preserve alignment. **Head gaze still tracks the cursor.** This is intentional conservative behavior, not a completed implementation of full expressive gaze through hair.
- **At neutral blink/gaze, suppress the entire facial micro-geometry**, leaving skinview3d to render the original imported PNG. This guarantees that idling cannot redraw or mismatch the native eye pixels.
- Move active micro layers forward from the head surface: base z=4.18, iris/pupil z=4.22, lids z=4.26, all still behind the hat front at z=4.5. Keep depth testing and skinview3d materials. This reduces coplanar depth artifacts.
- Regression: `tests/eye-occlusion.test.mjs` exercises asymmetric upper/lower hair masks, prevents split pupils, asserts neutral source preservation, enforces depth margins, and preserves full gaze for compatible unoccluded skins.
- Do not treat passing CI as proof that all face rotations or WebView2 rasterization are defect-free. Visual recheck on the reference machine is mandatory.

**Next acceptance:** install the new development artifact; with experimental facial eyes enabled, compare neutral face against eyes disabled and capture open, half-blink and fully closed face, from front and three-quarter views. Do not merge if any duplicated dark/cyan pixels or mask displacement remain.
