# Just Expressions compatibility: development boundary

## Target
Implement a skin-native expressive face matching the user-selected [Just Expressions](https://modrinth.com/resourcepack/just-expressions) resource pack while preserving vanilla head proportions. Avoid manual eye coordinate/color controls.

## Verified upstream behavior
- Just Expressions works with Entity Model Features (EMF) and Entity Texture Features (ETF), not with simple texture recoloring.
- Compatible 64x64 skins encode **extra pixels** that identify eye style / eyelid and optional brow features; multiple layouts are supported.
- Modern Just Expressions v1.2+ uses separate face model geometry and animations (player_face.jpm), eyelids to mask the original eyes, and layered depth handling.
- The pack uses a **custom license**; do not vendor/copy its models, animation rules or textures without permission.

Source information:
- https://modrinth.com/resourcepack/just-expressions
- https://github.com/IthanMendoza/Fresh-Moves/wiki
- https://modrinth.com/resourcepack/just-expressions/version/uG9DhYsG

## Intended adapter pipeline
1. Read exact 64x64 PNG skin pixels into an immutable source buffer.
2. Detect Just Expressions style markers from the documented extra-pixel layout; recognize valid variants only.
3. Produce a compatibility descriptor for geometry, eyelids, eye whites, pupils, and optional brows; do not guess an eye location.
4. Generate separate near-head face meshes with correct UV coordinates and alpha/depth ordering. Preserve the base skin and outer/hat layer.
5. Drive discrete states (neutral, blink, gaze, expression) with smooth bone transforms; avoid re-uploading entire 64x64 textures unnecessarily.
6. Fall back to unmodified vanilla face for unknown or invalid markers (explicit diagnostics).
7. Test against real user skin and licensed reference examples with pixel-by-pixel and visual snapshots.

## Current blocker / acceptance gates
The original ZpkDxGames skin **64x64 PNG** is not in this repository. The profile-picture render cannot reliably reconstruct the source or extra-pixel markers. The installed Tauri application may have the skin in localStorage, which GitHub cannot access.

Until the skin is supplied, the **old manual-eye effect is not certified** and must not be described as Just Expressions compatible. Keep any changes to that renderer separated from camera/rig fixes.

Acceptance requires: exact marker/style detection on supplied PNG; blink/gaze in face region without deleting hair, hat or original eye details; frontal/side/head-turned screenshots; overlay parity; no unwanted transparency; no texture upload every idle frame; Windows 11 WebView2 verification.

## Animation extension policy
Additional animation definitions belong in a **trusted local registry** (see `web/js/avatar/animation-handlers.js`). Only pose channels and bounded time are exposed. Remote executable animation scripts or downloaded code are not allowed; any third-party motion data requires provenance and license review.
