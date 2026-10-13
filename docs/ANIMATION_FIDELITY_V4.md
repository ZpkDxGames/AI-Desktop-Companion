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

## Acceptance status

M0 baseline recorded. M1–M5 are in progress. No native certification or owner
acceptance is implied. Main must not be merged without explicit acceptance.
