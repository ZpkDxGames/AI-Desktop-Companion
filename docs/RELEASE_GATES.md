# AI Desktop Companion — Active recovery gates (2026-10-12)

**Release decision: RECOVERY / DEVELOPMENT ONLY. Do not publish, tag stable or merge the draft PR.**

Authoritative specification: `AI_DESKTOP_COMPANION_MASTER_WORKSPACE_AND_RECOVERY_DIRECTIVE_2026-10-12.md` (provided by project owner). The previous alpha.2 material was obsolete and is superseded by this document.

## Evidence-based status matrix

| Gate | Status | Evidence / missing requirement |
|---|---|---|
| Production sample texture exists at emitted URL | PASS (browser) | Before: run [38306681867](https://github.com/ZpkDxGames/AI-Desktop-Companion/actions/runs/38306681867), two 404 requests per surface. After: [38307557615](https://github.com/ZpkDxGames/AI-Desktop-Companion/actions/runs/38307557615), none. |
| Nonzero, properly sized renderer in production browser | PASS (browser) | Before: [38307323554](https://github.com/ZpkDxGames/AI-Desktop-Companion/actions/runs/38307323554), 2×2 deadlock. Fixed by measuring parent viewport; [38307557615](https://github.com/ZpkDxGames/AI-Desktop-Companion/actions/runs/38307557615). |
| Unit/animation regression tests | PASS (CI) | 24 Node tests in [38307920882](https://github.com/ZpkDxGames/AI-Desktop-Companion/actions/runs/38307920882). |
| Production browser moving pixels + skin import/reload | PASS (browser) | [run 38308469848](https://github.com/ZpkDxGames/AI-Desktop-Companion/actions/runs/38308469848) verified non-static wave pixels, import and reload on both surfaces. |
| Deterministic Node dependency resolution | IMPLEMENTED; CI verify | `package-lock.json` committed, `npm ci` in both workflow jobs. |
| Clean Windows installer + native WebView2 startup | **NOT VERIFIED** | Production browser is not a Tauri/WebView2 installer. Need real interactive Windows run with cold storage. |
| User's authentic skin all-angle visual parity | **NOT VERIFIED** | Source 64×64 PNG and comparative screenshots required; sample PNG cannot certify identity. |
| Workspace design + full functional sections | SOURCE/BROWSER PASS; NATIVE NOT VERIFIED | [run 38309056656](https://github.com/ZpkDxGames/AI-Desktop-Companion/actions/runs/38309056656) checks navigation and 840×650/1120×780 horizontal overflow. Core Avatar/Behavior/Diagnostics controls operate; Desktop World/AI/Activity explicitly unsupported. |
| Overlay hit testing + desktop physics | **NOT IMPLEMENTED** | Whole-window passthrough only. |
| AI/vision and security permissions | **NOT IMPLEMENTED** | No local model execution or screen capture integrated, no permissions granted. |
| 60 FPS, p50/p95/p99 and CPU/GPU/VRAM on RTX 3050 | **NOT VERIFIED** | Render-call CPU cost is a diagnostic; not proof of GPU frame pacing. |
| Stable production release | **BLOCKED** | All hard gates and owner visual acceptance required. |

## Confirmed root causes (not conjectures)

1. **Packaged texture 404**: `web/js/main.js` attempted `decodeImage('./assets/sample-skin.png')` and repeated it on failure. Vite emits fingerprinted asset names, and both windows failed with 404/image-decode errors in Windows-hosted Chromium. Repair imports the asset through Vite as a dependency.
2. **2×2 renderer size deadlock**: `skinview3d` initialized a 2×2 drawing surface; `AvatarRenderer.resize()` measured its own inline-sized canvas, so it never grew. Repair derives size from stable parent viewport. Both surfaces later passed the browser startup smoke.
3. **Hot-path animation allocations / invalid deltas**: red-first tests exposed per-frame pose object and gaze array recreation and poisoning from nonfinite inputs. Controller now owns/reuses buffers and guards delta time.

## Recovery architecture changes

- Keep one canonical `skinview3d` + Three.js adapter. Do not restore an old manual mesh or duplicate animation state machine.
- Startup journal stages: BOOT, ASSETS, RENDERER, SKIN_READY, RUNNING, ERROR. Persistent error notice, Retry, and redacted copyable diagnostics.
- Preserve the imported PNG rather than repainting the whole face for each gaze sample. Default to **vanilla face** until actual eye/mask/hair screenshot parity is certified.
- Pause frame callbacks when document is hidden; 60 FPS active *target*, ~18 FPS low-motion idle scheduling, fixed-size frame-statistics ring, frame-specific blink wakeups. These are **architectural targets, not RTX benchmark results**.
- `npm ci` from committed lockfile; no duplicate renderer, no AI GPU allocation during avatar animation.

## Required next native certification on Windows 11 / RTX 3050 8 GB

1. Install the unsigned NSIS recovery build into a clean user profile. Record source commit, installer SHA-256, WebView2 version, OS build, graphics driver, process logs, and screenshot from the actual installed application.
2. With empty app storage, verify visible full-body avatar in overlay, open Workspace via tray, and establish actual WebView2 canvas draw, no missing assets, no errors. Close/reopen both windows, retry after forced WebGL context loss, and verify recovery.
3. Import the **original** 64×64 ZpkDxGames PNG locally. Compare front/left/right/back/quarter views, Classic vs Slim, mask, teal eyes, hair, outfit, all outer layers, neutral gaze and blink. Leave 3D eyes disabled where unsupported.
4. Test DPI 100/125/150/175/200%, workspace 840×650 and 1120×780, minimized/hidden/reopened states, tray click-through recovery, multi-monitor and fullscreen games.
5. Run repeated idle, wave, walk, jump, overlay only, Workspace only and both-window benchmarks. Record actual rendered FPS, p50/p95/p99 frame time, process CPU/RAM, GPU load and dedicated VRAM. Disclose collection method; compare before and after on identical workloads.
6. Preserve screenshots, non-sensitive logs and acceptance notes in the draft PR. Do not merge or claim performance targets passed without data.

## Work that must follow the native/skin gates

- R1: native skin geometry and expression parity; remove experimental facial defects before default-on.
- U1: extend the initial responsive Workspace shell and functional Avatar Studio/Behavior/Diagnostics pages; certify on actual Windows WebView2 at 100–200% DPI, test all controls, then complete the currently unavailable systems only when their native backends exist.
- B1: desktop presence, safe hit testing and event-driven 2.5D physics.
- A1/A2: optional local AI, vision and explicit consent-bound actions.
- S1: install/uninstall, provenance, resilience, performance gates and owner acceptance.

**Do not equate browser screenshots with native Windows screenshots, or CPU render-call timing with GPU FPS.**
