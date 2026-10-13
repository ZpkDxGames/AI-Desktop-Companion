# Motion Fidelity V4 development record

Base: `004731af0bfb3c734b285cd236aebef34a06fdc0`. Development branch: `dev/animation-motion-fidelity-v4`.

## M0: baseline and candidate review

Live main was fetched and matched the directive. Baseline: 68/68 unit tests,
syntax checks and production build passed; production Workspace/overlay browser,
fixed-head GPU eyes and fixed-pose GPU activities passed in Chromium/SwiftShader.
This is software WebGL evidence, not Windows/WebView2 or RTX 3050 certification.

Dependencies: Node 24.19 locally (CI Node 22), Vite 5.4.21, skinview3d 3.4.2,
Three.js 0.156.1, Tauri 2. The public synthetic sample skin is the capture input.
No private owner skin or native GPU session is available.

All 17 activities remain registered: idle, walk, run, wave, sit, jump, think,
celebrate, look, read, eat, drink, inspect, nod, shrug, stretch, bow.
The controller owns action arbitration and time; the sole main RAF/idle-timeout
loop updates it and invokes the paused SkinViewer explicitly. Native controls,
local item imports, face materials and bounded effects remain separate owners.

Candidate artifacts verified:

| Artifact | SHA-256 |
| --- | --- |
| ZIP | `0b8241ec8f7b7014862742e44b6756df5c82a7ac08b7e45877c3d8183f1a6c63` |
| patch | `4bb906c7e69b10eefaff82595c8e0a87f7aef8dd52ab3b57dd47578a76cc8249` |

`git apply --check` passed. All seven applied files equal the ZIP bytes.
The isolated candidate passes 83/83 tests with the pinned dependencies present.
It is a useful prototype, not evidence of visual acceptance.

Four new regression cases fail on the unchanged baseline: manual self-retrigger
snaps, jump lacks preparation, bow leaves the chest still, and walk bob peaks at
wide stride instead of passing. These red tests precede production edits.
`scripts/capture-motion.mjs` records all actions in Classic/Slim from front,
both quarter views and side, plus authored prop/jump detail frames and continuous
real-renderer clips. The baseline uses the exact original source bundle.

Source inspection also found that skinview3d's chest, head and arms are siblings.
Rotating only the chest disconnects the shoulders. Book support is beyond the
hand reach, and prop visibility goes directly to zero during interruption.
These require joint coordination and controlled prop recovery, not extra sway.

Candidate decisions to validate during implementation:

- Retain pure easing, quiet life motion, separate cosmetic randomness, extra
  pose channels and velocity-preserving transition intent.
- Replace numerical spring substeps and mutable future-time sampling with
  closed-form decay and explicit sampling buffers; measure cadence dependence.
- Coordinate chest/head/shoulder anchors around the existing waist. Preserve
  mesh geometry, UVs and all original outer layers; avoid chest scaling.
- Keep the measured 60 active / 20 idle policy. Reject automatic display-refresh
  rendering and 30 idle as new defaults without owner-device measurements.
- Reconstruct prop grips and exits inside the canonical renderer, preserving
  cached models, approved local sprites and disposal.

## Implemented milestone changes

M1 replaces the fixed crossfade and numerical prototype with exact critically
damped offsets preserving position and measured incoming velocity. Sampling is
idempotent, explicit-time and allocation-free in the authored hot path. Blink
and saccade deadlines agree across cadences without consuming decision RNG.
Quiet joint motion supplies breathing; original geometry is never chest-scaled.

M2 authors C1 jump preparation/impact, passing-phase walking, distinct running,
floor-aligned sitting, continuous seat reversals and full-body gestures. The
new rig coordinates original sibling joints about the waist so the neck and
shoulders remain attached. Timed actions, priorities and sit intent are retained.

M3 calibrates book cover corners against actual Classic/Slim palms, adds a
cached curled sheet with separate printed sides, separates bites from chewing,
keeps consumption continuous, and adds controlled bottle tilt and recovery.
Items have a closed extruded back and modest depth; water side tint comes from
the existing or imported sprite. No external game assets are introduced.
Controller-owned prop recovery preserves the old prop on interruption, then
closes/lowers it over 300 ms without delaying manual action acceptance.

The first visual refinement failed: inward grips obscured food/potion and hands
covered pages. Actual front/quarter/side captures exposed this despite green
unit tests. Grip locations, book height and item depth/closed backs were revised.
The existing GPU item visibility gates then passed without weaker thresholds.

M4 preserves 60/20 scheduling, bounds cached resources and adds reproducible
CPU/real-WebGL profiling plus a ten-minute wall-clock lifecycle soak. Tests
cover 30/60/120/144 Hz, irregular dt, invalid/stall ticks, all accepted action
pairs, seated reversals, original geometry/UVs, palm support and opaque prop
pixels outside the original head/outer-mask volume at authored contact.

M5 uses the existing exact-PR-head Windows NSIS workflow and leaves the PR draft.
Run artifacts record commit, CI run and SHA-256. Source and build acceptance
must be verified on that head before presenting its installer.

## Reproduction

```bash
npm ci --no-audit --no-fund
npm run check
npm install --no-save --no-package-lock playwright@1.56.1
npx playwright install chromium
node scripts/smoke-browser.mjs
node scripts/smoke-eye-gpu.mjs
node scripts/smoke-activity-gpu.mjs
node scripts/capture-motion.mjs ../motion-evidence/after --clips
node scripts/soak-motion.mjs ../motion-evidence/soak.json
# Point the benchmark at a clean original-base checkout:
node --expose-gc scripts/bench-motion.mjs ../motion-baseline ../motion-evidence/cpu.json
```

## Acceptance status and remaining owner checks

Implemented on the development branch; original and V4 automated tests and
software-WebGL visual/resource checks provide development evidence. Native
certification remains pending. Review the owner skin and masked/hat layers in
Classic/Slim, both surfaces, 100/150/200% DPI, context recovery, minimize/restore,
click-through/tray, startup and high-refresh display presentation. Collect actual
RTX 3050 GPU telemetry and WebView2 frame percentiles before changing FPS defaults.
Main must not be merged without explicit owner acceptance. The original block
rig has no elbow or wrist articulation; temporary hand-side occlusion during
mouth contact is a remaining rig constraint, not a claim of perfect visuals.
