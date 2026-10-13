# Idle Behavior & Daily Activities — development milestone (2026-10-12)

**Branch:** `dev/companion-behavior-and-idle-animations`  
**Base:** `c694fedec21bec3ba45467594bce6803b6d6836c` (PR #6).  
**Decision:** Draft only; no production merge or stable release from browser-only validation.

## Scope implemented

- Reuses the existing `BehaviorController` as the **sole** behavior director; no overlapping animation engine.
- Adds manually selectable **Read book, Eat, Drink, Look around, Inspect** poses with bounded durations and eased pose transitions.
- Adds a user-selectable automatic idle policy: **Off** (none), **Calm** (36–64 idle seconds), **Lively** (14–26 idle seconds). Scheduling is deterministic for a given seed; only executes while `action==='idle'`. Timers do not advance in hidden windows because the frame pump pauses.
- Auto actions enter through `request(action, {source:'auto'})` and obey the same transition and priority rules. Manual selection resets the countdown; selecting Idle preempts. Disabling autonomous mode interrupts an active auto action.
- Reuses the actual 3D eye gaze/blink while the character reads or eats; no facial mesh or UV changes.
- Attaches **cached geometry** for a blocky open book (body), apple-like food (right hand), and a bottle (right hand). One construction at renderer startup, no per-frame mesh allocation, explicit dispose on renderer shutdown.
- The Behavior Workspace exposes these actions and persistent frequency preferences for Workspace and overlay; diagnostics report active action/source and total local idle events.
- No desktop physics, screen observation, AI inference, model downloads, external assets, network calls or privileged native permissions.

## Regression gates

`npm test` covers seeded scheduling, opt-out, non-interruption of a manual persistent pose, manual preemption, blink/gaze coexistence, no nonfinite timer poisoning, cached prop ownership and cleanup, alongside the pre-existing facial/skin/overlay suites.

Windows-hosted browser CI tests a production Vite build and the separate fixed-head eye shader GPU gate. Windows NSIS packaging CI is required before offering an installer. Browser-pass is **not** WebView2 certification.

## Native acceptance still to perform

1. Import original skin in the unsigned Windows build and inspect book, apple, bottle, head/hair, arm poses and blink on frontal and quarter-angle views.
2. Leave the companion idle for 90–120 seconds in Calm mode; capture which activities were chosen and their smooth transitions. Verify manual gestures, idle cancel, opt-out, background/hide/resume and both application windows.
3. Run active/idle/render and CPU/GPU/VRAM diagnostics on the actual Windows 11 / RTX 3050 machine.
4. Verify skin reload, tray overlay, multiple DPI values and cold storage. Attach evidence to the draft PR before production merge.

## Constraints

No skin images are uploaded to CI or checked into the public repository. The owner can keep the original private. Experimental props have intentionally simple vanilla-inspired geometry; final styling should be based on on-device screenshots, not inferred visual certification.
