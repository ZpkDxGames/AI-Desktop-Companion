# Avatar animation contract — v0.1.0-alpha.3 development preview

## Geometry and framing
- Player body 8×12×4, head 8×8×8, Classic arms 4×12×4, Slim arms 3×12×4, legs 4×12×4.
- The shoulder pivot is **y=24** for base and outer arm layers; hips are **y=12**, neck **y=24**. No rounded or anatomically bending elbows/knees.
- Camera uses `web/js/engine/camera.js` as its single source of truth, near-frontal orthographic view, 32-pixel-tall avatar centered and fully visible.
- Authentic nearest-neighbor skin texture sampling; original 64×64 skin pixels preserved.
- Outer skin layers are inflated cubes; alpha transparency handled by discarding transparent texels.

## Animations
Base state machine: IDLE, WALK, RUN, WAVE, SIT, JUMP, THINK, CELEBRATE.

Supplementary trusted, local handlers in `web/js/avatar/animation-handlers.js`:
- **Nod:** short positive/negative head pitch movement (1.45 s).
- **Shrug:** subtle shoulder raise and head tilt (1.8 s).
- **Stretch:** arms reach upward, subtle torso lift (2.6 s).
- **Bow:** forward head tilt with relaxed arms (1.9 s).

The registry maps bounded action identifiers to duration, priority and constrained body-pose channels. It must not load arbitrary remote scripts or give animation code access to OS APIs. Integration of open-source animation assets/handlers in future milestones requires individual compatibility and license review.

Locomotion currently animates **in place**; real movement physics, gravity, window collision and climbing remain v0.2 goals. Higher priority actions interrupt lower priority ones, timed actions return to idle.

## Facial expression boundary (important)
The obsolete manual eye-coordinate/color painter has been **removed**. Imported original 64×64 skin pixels are rendered unchanged, and head tracking continues to work. The facial eyelid/iris/blink engine is temporarily inactive, not pack-compatible.

The desired adapter should read Just Expressions-style extra-pixel markers from the actual skin, model a separate facial geometry layer with safe depth / hat order, support compatible eyes/eyelids/brows, and fall back to original vanilla face when markers are absent or invalid. See [JUST_EXPRESSIONS_ADAPTER.md](JUST_EXPRESSIONS_ADAPTER.md). Do not pretend the old hand-positioned 1-pixel overlay is equivalent to the pack.

The actual user's 64×64 skin PNG is necessary to confirm the marker variant and validate compatibility; a rendered profile picture is not an adequate substitute.

## GPU policy
- Target 60 FPS active, ~18 FPS idle; these are frame pacing targets, **not measured benchmarks** on the RTX 3050.
- No AI inference or external model in v0.1 alpha.

## Windows behavior pending test
The native Tauri overlay is 252×370, frameless and always-on-top. The tray controls toggle **whole-window** mouse click-through. Avatar-shaped hit testing, multi-monitor/DPI, gaming coexistence and desktop physics are unfinished.
