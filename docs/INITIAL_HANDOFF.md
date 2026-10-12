# Initial handoff — v0.1.0-alpha.1 (2026-10-12)

## Scope delivered

A self-contained WebGL2 Minecraft-style 3D avatar studio, with 12 cuboid layers, Steve/Slim rig modes, local skin import, non-destructive calibrated eye overlays, eight animation states, head/mouse tracking, idle render throttling, and a Tauri 2 Windows desktop shell with tray controls and explicit whole-window click-through.

## Engineering status

- `npm run check`: **PASS** (18 tests).
- Node HTTP server `/`: **HTTP 200** in this environment.
- Browser visual rendering: **not verified** (managed browser blocked local navigation).
- Windows Rust/Tauri build: **not verified** (no compiler/toolchain available).
- Native click-through recovery: **implemented** via tray; **not Windows-certified**.
- Per-pixel hit testing: **not implemented**.
- Actual user skin: **not included**; reference avatar image and deliberately approximate sample skin are included separately.

## Next agent instruction

Do not claim this is a complete AI assistant or Windows-certified release. Before adding model/OS features, conduct a Windows 11 WebView2 smoke test, correct any UV/rendering and API build errors, add shape-aware hit testing, and integrate the actual 64×64 ZpkDxGames skin. Follow `docs/PROJECT_CHARTER.md` and `docs/RELEASE_GATES.md`. Preserve the no-background-inference design until avatar stability is verified.
