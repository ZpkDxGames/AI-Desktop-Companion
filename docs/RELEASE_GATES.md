# Release gates — 2026-10-12 initial checkpoint

## What was validated in this environment
- [x] Source files generated, sample PNG exists, image reference preserved.
- [x] JavaScript source syntax checks.
- [x] Node unit test suite passes (18 tests).
- [x] Built-in Node preview HTTP server responds successfully with correct local Content-Type/CSP.
- [x] App source remains local/offline by default, with no cloud request code.

## What remains unverified
- [ ] **Browser visual integration:** the installed managed Chromium refuses local navigation (`ERR_BLOCKED_BY_ADMINISTRATOR`). No successful interactive WebGL2 rendering screenshot was obtained in this environment.
- [ ] **Rust compilation / Windows NSIS:** Rust/cargo/MSVC toolchain unavailable here.
- [ ] Overlay real Windows transparency, click-through and dragging on Windows 11 + WebView2.
- [ ] Tray show/hide, window dismissal and settings event delivery on Windows.
- [ ] Verify skin orientation and UV seams against the genuine ZpkDxGames PNG (not supplied).
- [ ] Test eye calibration on the genuine skin; avoid masking original facial details.
- [ ] Profile idle/active GPU memory and CPU/GPU usage on RTX 3050 8 GB.
- [ ] Multi-monitor, fractional DPI and fullscreen/game coexistence.
- [ ] Pixel-accurate hit testing instead of whole-window click-through.
- [ ] Window-surface platforms/collision — v0.2 scope.

## Windows acceptance checklist
1. Run `npm install`, `npm run tauri:dev` with the dependencies in README; record compiler version/build logs.
2. Check the actual avatar renders full-body and second layers correctly with real user 64×64 PNG; toggle Classic/Slim arms.
3. Test neutral/walk/wave/sit/jump (no clipping or crashes); calibrate eyes by matching the original pixel colors.
4. Move the 252×370 overlay using its bar and verify Windows stays responsive outside the overlay.
5. Enable whole-window click-through and verify clicks reach underlying app; recover via tray menu.
6. Open workshop from the tray and from Setup; import a skin, verify overlay updates.
7. Test monitor attach/detach, 100–200% scaling, fullscreen apps, taskbar placement, game running, and sleep/resume.
8. Capture idle and active FPS, GPU utilization, VRAM, process RAM, CPU use on reference PC; do not assume target met.
9. Stop/crash WebView2 and restart app; ensure no stuck tray icon or orphan process.
10. Only after verified Windows behavior, build and test installer/clean install/uninstall.

## Next engineering work
- Fix anything revealed by the Windows visual smoke test.
- Add a precise eye-grid editor with a 2D facial texture preview.
- Build robust per-pixel or shape-aware hit testing in the overlay, with a tray recovery path.
- v0.2: event-driven window bounds and collision engine with opt-in observation.
- v0.3+: local Ollama, permission gates, contextual suggestions and restricted tools.

**Release decision:** development preview only; not certified as a complete Windows release. No claim that AI or desktop window physics is already functional.
