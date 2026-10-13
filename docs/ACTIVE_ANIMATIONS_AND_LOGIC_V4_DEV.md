# Active animation and logic snapshot — V4 development

This development snapshot supplements `ACTIVE_ANIMATIONS_AND_LOGIC_SUMMARY.md`.
Main remains the acceptance baseline. This branch is not a stable release.

## One motion authority

`BehaviorController.request()` arbitrates manual/automatic intent. `update()`
owns logical time, seat progression, discrete events, eye/blink deadlines and
prop recovery. `pose()` samples authored curves plus a closed-form critically
damped offset into the same reused buffer. It cannot advance time or events.
The old 170 ms fixed crossfade and prototype numerical spring integration are
removed. Future sampling takes explicit times and a scratch timeline, rather
than temporarily changing controller state.

`AvatarRig` applies chest motion about the original waist and coordinates the
head and shoulder anchors. It never reparents, replaces, subdivides or scales
the original skin meshes. Classic/Slim UVs and outer layers remain intact.
`AvatarRenderer` remains the only SkinViewer/Three.js scene owner and preserves
the existing opt-in face material, vanilla fallback and pupil/blink compositor.

`presentation` is a reused controller-owned prop clock. A manual interruption
changes the requested action immediately while the prior prop closes/lowers
and withdraws for 300 ms. New props wait for that recovery before appearing.
The renderer does not run an independent transition or behavior clock.
Held props counter-rotate the complete shoulder quaternion using cached scratch
objects, preserving authored mouth/tilt axes through chest, shoulder yaw and roll.
Continuous joint-local palm constraints maintain jacket clearance through
equip and interrupted recovery. The seat curve projects the unchanged leg-box
dimensions onto the standing sole plane throughout sit/stand.

## Activities

| Activity | V4 authored behavior |
| --- | --- |
| Idle | Mixed-frequency weight transfer, breath through joint motion, delayed chest/head attention; no mesh scaling |
| Walk | Passing-phase bob, hip balance, chest counter-yaw, alternating strides and inertial start/stop |
| Run | Stronger stride, lean, distinct flight bob and bounded head counter-motion |
| Wave | Preparatory raise, bounded overlapping arm/head acknowledgment, smooth lower |
| Sit | Floor-aligned pelvis/legs, phased sit/stand, continuous reversal and latest-intent queue |
| Jump | C1 root curve: crouch, push, flight apex, impact compression, recovery |
| Think | Contemplative head/hand overlap, subtle ponder motion, existing bounded bubble |
| Celebrate | Two asymmetric hops, staggered arm pumps, existing two behind-character bursts |
| Look | Brief small steps, head-leading chest scan and return |
| Read | Supported floor sitting, down-gaze, leather covers facing the reader, curled sheet, two turns ten seconds apart, close and stand recovery |
| Eat | Thin item sprites, direct vanilla PNG/JAR/ZIP import, deliberate bites, bounded texture-colored crumbs and finishing opacity fade |
| Drink | Block-shaped clear glass vessel, draining water volume with a level surface, neck-to-mouth tilt, empty bottle lowering/recovery |
| Inspect | Visual attention/lean only; no desktop sensing or native window awareness |
| Nod | Anticipatory lift, two decaying dips with subtle torso answer |
| Shrug | Coordinated arm lift, head tilt, small authored settle |
| Stretch | Preparatory reach, chest opening, quiet hold/tremor, bounded recovery |
| Bow | Waist/chest-leading bend, delayed head, balanced hold and rise |

Eating/drinking phase endpoints remain preserved. The owner-requested reading
follow-up extends reading to 26.4 seconds: enter/open, turns at 10.6 and 20.6,
close at 25.2, then the existing queued stand-up path. Read phase names remain
recognizable; phase indices and fixed-frame fixtures are migrated for two turns.
Reading uses the existing seat authority, with an 850 ms sit and 650 ms stand.
Manual gestures queue while rising; the book closes once without reappearing.
Timed actions still complete; walk/run/sit remain deliberate continuous actions.
Decision randomness remains seeded. Blink and saccade streams are independent
of decision RNG and use absolute deadlines to agree across refresh cadences.
Saccades never participate in the active-render wake predicate.

## Performance, accessibility and assets

The single runtime loop retains 60 FPS active and 20 FPS idle. The prototype's
uncapped display-refresh/30-idle default is rejected without owner-device
measurements. Idle micro-motion does not add RAFs or timers. Scene resources,
sheet vertex buffers, pose buffers and rig scratch transforms are cached.
Periodic percentile diagnostics remain bounded, outside the per-frame hot path.

OS reduced motion suppresses cosmetic drift/saccades, reduces large gesture
amplitude and disables existing fireworks. Core UI, prop manipulation, eyes,
manual blink and pointer response remain available. No graphics UI or native
permissions are added. The renderer keeps nearest-filter original fallback art.
Exact vanilla food art is read through explicitly selected PNGs, a Minecraft
client JAR or resource-pack ZIP; only allowlisted item entries are decoded.
Archives have size/entry/decompression/CRC limits and never extract to disk or
scan installations. `cake.png` maps to the legacy `cake_slice` settings key.
No proprietary texture files or private skin are committed/bundled. Reset
returns to the original fallback. Drinking replaces the obsolete flat potion
model with one cached glass/water rig; local water sprites tint its palette.

The existing AvatarEffects owner also renders at most 16 crumb instances.
Their colors come from selected food pixels; no effect timer or extra RAF is
introduced. Reduced motion suppresses crumbs as well as fireworks. The water
top stays horizontal during tilt using cached clipping planes and scratch
transforms. No mesh/material/texture is created as the fill drains.

## Validation and limits

The development suite includes all original tests, adapted candidate tests,
four pre-implementation red regressions and new cadence/velocity/purity/rig/
prop-contact checks. Real Chromium/WebGL checks cover Workspace/overlay,
fixed-head eye pixels, local texture import/reset and activity visibility.
`capture-motion.mjs`, `bench-motion.mjs` and `soak-motion.mjs` reproduce the
multi-angle gallery/clips, CPU comparison and ten-minute resource soak.

Software WebGL timing is CPU submission timing, not RTX GPU usage or measured
display presentation. The original rigid block arms have no elbow/wrist bones;
brief hand occlusion from the hand-side camera is physically expected during
mouth contact. The clips show the prop raise, sip/bite and lower phases as well
as contact. Native Windows/WebView2, owner-skin masked-face review, 100/150/200%
DPI and high-refresh presentation require owner acceptance. Inspect remains a
visual-only gesture. No merge into main is authorized.
