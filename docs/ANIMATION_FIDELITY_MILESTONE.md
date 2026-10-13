# Minecraft animation fidelity v2 — development verification

**Scope:** draft PR #8, based on unchanged PR #7 development branch. No merge to main, Windows deployment or release tag.

## Implemented architecture

- Controller-only deterministic behavior arbitration, cached pose object, manual/auto priority and phase-index sampling; a single latest-intent slot for sit → stand → requested gesture.
- Read: authored enter/open/read/page-turn/read/close timing, two rotating covers, hinged page, pixel-inspired glyphs and original book color palette. The hinge traverses approximately 180°; it does not teleport a material.
- Think: one cached scene-space pixel thought cloud (two dots and three ellipsis squares), visible only for think, without AI activity or pointer interception.
- Celebrate: two authored rocket launch/burst/fade envelopes, 48 maximum instanced sparkle cubes, depth behind body, no sound or timer. Honors reduced-motion OS preference.
- Sit: animated 0.35-second seated entry and approximately 0.65-second stand-up; pending actions run after returning to baseline. No window-edge physics.
- Eat: cached original-geometry cooked porkchop, apple, golden carrot and stylized cake slice, deterministic seed selection per activity, two bite stages, articulated right-arm reach.
- Drink: glass-tinted block outline, blue water contents, stopper and bottle tilt coordinated with arm/neck.
- Look: small in-canvas reversible steps and head scanning; no OS window movement.
- Inspect: local pose-only lean/focus/recover. **Desktop awareness remains unimplemented, without new permissions.**

All props and particle resources belong to the single skinview3d/Three.js renderer lifecycle. No second avatar, animation director, render loop or global cursor input. The eye shader and user-supplied skin are not changed.

## Deterministic timeline reference

| Activity | Seconds | Key phases |
|---|---:|---|
| Read | 11.7 | enter 0–0.65, open 0.65–1.5, readA 1.5–4.6, pageTurn 4.6–5.5, readB 5.5–10.7, close 10.7–11.7 |
| Think | 3.2 | consider, ponder, resolve |
| Celebrate | 2.6 | raise, rockets at 0.3 and 1.15, settle |
| Sit | indefinite | standing, sittingDown 0.35, seated, standingUp 0.65, standing |
| Eat | 4.8 | equip, raise, bite1/chew1, bite2/chew2, finish |
| Drink | 4.4 | equip, raise, sip, swallow, lower, putAway |
| Look | 3.8 | start, explore, return |
| Inspect | 4.2 | lean, focus, recover |

## Test and screenshot reproduction

1. Run `npm ci --no-audit --no-fund` and `npm run check`.
2. Install Playwright 1.56.1 as an isolated no-save dependency and run `npx playwright install chromium`.
3. Run `node scripts/smoke-browser.mjs`, `node scripts/smoke-eye-gpu.mjs`, and `node scripts/smoke-activity-gpu.mjs`.
4. The activity smoke writes deterministic screenshots for all eight actions, book hinge checkpoints, variants, sit/stand and quarter views into `smoke-artifacts/activity-fixed-*.png`. The CI workflow uploads them for side-by-side visual review. Tests compare identical rendered poses with and without visible effects, not wall-clock action expiry.
5. Run 100-cycle render-resource test and red-first action tests in `tests/activity-fidelity.test.mjs` and `tests/activity-regressions.test.mjs`.

## Asset provenance and privacy

Fallback models are newly authored geometric approximations; no Mojang textures, copyrighted font, or owner skin are committed to the repository. Exact vanilla resource-pack textures are **not imported in this milestone**. If used later, require explicit opt-in, a local licensed source, validation and private caching. The visual prototype must not be described as exact vanilla sprites.

No Win32 window enumeration, screenshot capture, app monitoring, AI inference, new Tauri permissions or desktop-window edge detection. Future inspection requires separate user consent and architectural review.

## Rendering and performance gates

Preserved target: 60 FPS active, 20 FPS idle, one scheduler. Prop material and mesh construction occurs only at renderer initialization, not per frame. Maximum sparkle slots: 48, at most 2 authored bursts. Idle particles count is 0. Reduce-motion hides fireworks.

**Not certified from CI:** Windows 11 native WebView2 alpha, RTX 3050 GPU time, original 64×64 skin/mask, native 100–200% DPI, min/restore context, CPU/GPU p50/p95/p99, ten-minute idle soak, audio (intentionally absent). A Chromium screenshot cannot certify native FPS or actual user-skin appearance.

## Native acceptance and rollback

Check original skin privately, Classic/Slim, neutral and eye expressions, face/hat/mask occlusion, all eight action captures front/quarter/side, repeated interrupts, 100%/150%/200% DPI, overlay transparency/click-through and high-load games. Record process CPU/RAM/VRAM, CPU render frame p50/p95/p99 and GPU timings separately.

If a candidate is unacceptable, switch back to `dev/companion-behavior-and-idle-animations` head `5fbedbe779cce36cc04ba5b3d172777a3c9270d9`. The PR is draft, no old code or production commit is overwritten.
