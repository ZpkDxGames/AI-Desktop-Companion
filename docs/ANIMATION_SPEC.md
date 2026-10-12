# Phase 0 / v0.1 animation contract

## Geometry
- Body: 8×12×4; head: 8×8×8; arms: 4×12×4 Classic or 3×12×4 Slim; legs: 4×12×4.
- Arm/leg pivots are at the shoulders and hips; head pivots at the neck (no smooth elbow/knee bending).
- Second skin layers render at slightly inflated dimensions with transparent pixels discarded.
- Skin samples use nearest-neighbor interpolation. Default camera is orthographic.

## State machine
`IDLE`, `WALK`, `RUN`, `WAVE`, `SIT`, `JUMP`, `THINK`, `CELEBRATE`. Higher-priority actions interrupt lower-priority actions. Timed actions return to idle. Locomotion is currently **in place**; cross-window pathfinding and real physics belong to v0.2.

| Animation | Method | Approx. duration |
|---|---|---|
| Idle | Subtle independent head/breathing sway | Continuous |
| Walk | Sinusoidal opposing legs/arms | Continuous |
| Run | Faster and wider opposing limbs | Continuous |
| Wave | Raised arm oscillation | 2.4 s |
| Sit | Both legs rotate to seated pose | Continuous |
| Jump | Sinusoidal vertical trajectory | 0.95 s |
| Think | Head turn plus arm raise | 3.2 s |
| Celebrate | Arm raise and repeated hop | 1.7 s |

## Eye atlas / expression rules
The head's front face is skin pixels `x=8..15`, `y=8..15`. User profile eye coordinates are relative to this 8×8 face, integers 0–7. Each modeled iris has one pixel width, two pixels height. Blink suppresses the iris and draws an eyelid-colored pixel.

A non-destructive derived canvas is recomputed on only **gaze/blink state changes**, not per GPU frame. The original 64×64 bitmap is never edited. The default example coordinates are `[2,3]` and `[5,3]`.

**Caveat:** Skin artwork varies dramatically. A generic auto detector is not trustworthy. Imported skins therefore disable eyes by default until coordinates are set. For final release, build a 2D face-grid calibration UI with color sampling, eye masks, and a per-skin hash-based profile.

## Rendering and CPU/GPU policy
- Render WebGL2 with transparent framebuffer and depth test.
- Aim 60 FPS while actively animating, ~18 FPS idle. These are requested frame caps, not measurements on the user's RTX 3050.
- Browser throttling and refresh rates can affect actual FPS.
- Do not start or preload an LLM; future AI is a separate service.

## Real desktop overlay note
The native Tauri window is 252×370 in alpha mode, frameless and always on top. It supports **whole-window** click-through via the system tray. Avatar-specific hit regions, collision with app windows, multi-monitor/DPI certification, game suppression and fullscreen interaction policies are outstanding requirements.
