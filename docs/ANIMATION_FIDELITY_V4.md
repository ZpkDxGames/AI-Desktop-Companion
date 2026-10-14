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
A final sole-plane regression replaces linear seat lowering with the projected
original leg-box support curve, preventing floor penetration halfway through
sitting and standing. The full transition is sampled against the original sole
plane without changing leg geometry or the existing transition durations.

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
The final axis review also replaced Euler subtraction in held grips with cached
full-quaternion compensation. A neck-direction regression verifies that yaw
and roll cannot change the authored bottle pouring axis.
Full equip/recovery sampling reproduced jacket intersection with inward grips
while the arm was lowered. Continuous joint-local clearance constraints now
keep the prop on the outside/front of the lowered palm, approaching the mouth
grip only after the actual arm angle clears the torso. No independent prop
animation loop or per-frame object creation was introduced.

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

### Owner-reference prop follow-up

The owner then requested floor-seated calm reading, vanilla food presentation
and a glass bottle with draining liquid. This intentionally supersedes the
earlier standing reading pose and 11.7-second read fixture. Reading now lasts
26.4 seconds, sits over 850 ms, turns at 10.6 and 20.6, closes at 25.2 and uses
the existing 650 ms stand/queued-intent path. Book exit is suppressed after its
single recovery so it cannot reappear while standing.

The later owner references supersede the symmetric two-palm grip and thin food
sprites. Reading now completes sitting before the book equips (0.9 s), lifts a
closed book in the left palm (0.95–1.55), raises the right hand (1.45–1.9), opens
one hinged cover (1.8–2.6), and rests the free hand by 3.25. Page assistance
anticipates each turn by 0.5 s, follows across the hinge, and lowers afterward.
The book is mounted directly to skin.leftArm. Its local offset is solved from a
cover-underside support point and the actual palm; counter-rotation preserves
orientation through lift and recovery. Brown pixel leather, gold corner clips,
and blank cream parchment replace the printed/gilt-strip style. Open page
normals are checked against the avatar eye position so both pages face the
reader. Page textures
and the curled sheet remain cached. Original avatar proportions are retained.

Foods now use four original volumetric block profiles in voxel-foods.js: stepped
apple with stem/leaf, curved cooked chop with bone, tapered golden carrot with
stalks, and a frosted block cake with red topping. Each profile emits only its
exterior pixel faces into one mesh with flat normals and discrete vertex colors.
These are solid 3D food models, not camera-facing sprite slabs. The old extrusion
builder is removed, rather than retained as an alternate active path. Default
profiles/palettes ship in the app; no item import is required to see 3D foods.
Optional locally selected PNGs supply body/pale-frost palette colors while the
geometry and structural accents remain intact. Per-frame updates only change
transforms, visibility and fade opacity. Every food triangle is checked against
head/hat and jacket volumes through bites and interrupted recovery, so large
merged faces cannot cross those volumes between otherwise clear corners.

A bounded 16-instance pool in AvatarEffects uses selected food pixel colors for
crumbs. Deliberate bite/chew timing and the finishing opacity fade remain intact.
Depth testing is retained; reduced motion suppresses crumbs. Food geometry has
one draw call per selected item, with no interior faces or individual cube
objects. Matching coplanar exterior faces merge into rectangles while retaining
every original colored surface cell. Matching boundary vertices prevent cracks
where a long edge meets shorter faces; constrained triangulation retains those
vertices. Mesh triangles fall from 1,380 to 434 for apple, 936 to 280 for cooked
chop, 824 to 398 for carrot and 1,220 to 416 for cake. A spatial surface fingerprint from bb2727b verifies all cells, normals
and exact Float32 colors with default and imported palettes. sRGB food palette values are explicitly decoded to
linear vertex colors because the canonical skinview3d runtime disables global
Three ColorManagement; the global skin/bottle pipeline remains unchanged.
Import/reset/disposal remains owned by AvatarProps. The first corner-only merge
passed mathematical coverage tests but produced enclosed missing pixels in
actual software-WebGL images. The GPU regression reproduced that failure before
the fix and now requires zero small enclosed pixel cracks in twelve food views.

The flat potion extrusion is removed from active props, replaced with a cached
voxel glass vessel, water volume and level surface. World-horizontal clipping
planes keep the water top level while fill drains to zero. The whole bottle
shell is tested against head/hat and jacket volumes through full sipping and
interrupted recovery in Classic/Slim, in addition to real-renderer inspection.

Custom body/pale-frost colors can use the user's selected client JAR/resource-pack
ZIP or PNGs through the existing local importer; the authored surface patterns
and structural accents are retained. The bounded ZIP reader selects
only known item paths, limits expanded PNG sizes, checks CRC and does not
extract files, enumerate installations or use runtime network access. `cake.png`
aliases the legacy settings key. Reset restores the original 3D palette;
no game texture files are committed or bundled in the public installer.
Optional local-reference capture can use explicit vanilla PNGs, with raw source
assets excluded from deliverables. Default review captures use the included
authored palettes. This is not a claim of Mojang affiliation
or ownership of the imported art.

```bash
# Optional explicit local vanilla texture directory for reference capture:
node scripts/capture-motion.mjs ../prop-review --actions=read,eat,drink \
  --item-dir=/path/to/extracted/assets/minecraft/textures/item --clips
```

Implemented on the development branch; original and V4 automated tests and
software-WebGL visual/resource checks provide development evidence. Native
certification remains pending. Review the owner skin and masked/hat layers in
Classic/Slim, both surfaces, 100/150/200% DPI, context recovery, minimize/restore,
click-through/tray, startup and high-refresh display presentation. Collect actual
RTX 3050 GPU telemetry and WebView2 frame percentiles before changing FPS defaults.
The evidence-only `scripts/bench-food-renderer.mjs` compares fixed eating poses
for all four foods in two sequential trials. It records submission time and
completed software-WebGL work using synchronous `gl.finish()` and a one-pixel
readback fence, which are never called by the application. These measurements distinguish GPU queue variation
from item rendering cost; they do not certify native displayed FPS.

Main must not be merged without explicit owner acceptance. The original block
rig has no elbow or wrist articulation; temporary hand-side occlusion during
mouth contact is a remaining rig constraint, not a claim of perfect visuals.
