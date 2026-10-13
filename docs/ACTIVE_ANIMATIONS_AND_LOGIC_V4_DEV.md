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
| Read | Two palm-supported cover corners, down-gaze, distinct page front/back, cached sheet curl, close/recovery |
| Eat | Four original food silhouettes, separate bite contacts, lowered chewing holds, continuous consumption |
| Drink | Closed volumetric blue-water silhouette, stable grip, neck-to-mouth tilt, swallow/lower/recovery |
| Inspect | Visual attention/lean only; no desktop sensing or native window awareness |
| Nod | Anticipatory lift, two decaying dips with subtle torso answer |
| Shrug | Coordinated arm lift, head tilt, small authored settle |
| Stretch | Preparatory reach, chest opening, quiet hold/tremor, bounded recovery |
| Bow | Waist/chest-leading bend, delayed head, balanced hold and rise |

Read/eat/drink phase names, endpoints and event thresholds are preserved.
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
permissions are added. The renderer keeps nearest-filter original fallback
art and explicit validated local PNG imports; no proprietary textures or
private skin are committed or redistributed.

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
