# Animation Fidelity V3 — native-style item silhouettes and hand-grip reconstruction

**Development milestone:** `dev/native-item-rig-fidelity-v3`, draft PR #9, based on exact V2 `4f5554683e3b23cc4c3de0a9a6cf3f1585beade6`. Do not merge to main or ship stable without owner visual approval.

## Why V2 looked wrong

- The book was a group of tiny box primitives attached to the torso, with page surfaces too small at screen scale; its resting pose used a floating, unsupported seated silhouette.
- Apple, carrot, porkchop and cake were recognizable only as assembled cubes, not textured inventory-item silhouettes.
- Drinking was depicted with another box approximation. Its arm pitch raised the held object up to eye level and the object tilted edge-on.
- Pixel-difference gates proved meshes were visible but could not certify correct proportions, hand alignment or item identity.

## V3 implementation

1. **Voxel item pipeline:** `web/js/engine/item-models.js` generates five original 16×16 alpha silhouettes, author-colored texture palettes, a nearest-filtered sRGB `DataTexture` per item and thin 3D alpha-boundary extrusion with source-colored edge surfaces. There is no proprietary Mojang art in git or builds.
2. **Explicit personal item sprites:** `item-import.js` only reads PNGs users select in Avatar Studio. Filenames are allowlisted (`apple.png`, `cooked_porkchop.png`, `golden_carrot.png`, `cake_slice.png`, `water_potion.png` or `potion.png`); valid source sizes are 16, 32, 64 or 128 pixels square and at most 160 KB. Signature, dimensions, alpha pixel count and data URL length are checked. ZIPs and background Minecraft-install scans are not supported. Saved image data remains inside the app's local settings, reloaded in Workspace/overlay; it is not transmitted remotely. Vanilla potion tint is source-dependent, so owners should import an already blue potion texture where necessary.
3. **Book:** enlarged spine, two opening covers, surface textures with independently authored abstract pixel glyphs, separate hinge turning page and page-shape geometry. Geometry is reused between frames, and the reading character remains standing until future physical seating exists.
4. **Food/drink choreography:** stabilized and offset canonical right-arm wrist grip, enlarged transparent pixel items with counter-rotation as shoulder pitches, lower mouth-height arm aim, separate bottle rolling/tilting on the same timeline. No second animation owner.
5. **One renderer:** `AvatarProps` remains owned by `AvatarRenderer`, and rebuild/disposal occurs only at startup, skin swap or an explicit user-selected asset change. No permanent second canvas/frame loop, new native permissions, desktop monitoring, external model host or resource-pack redistribution.

## Deterministic verification

Use:
```shell
npm ci --no-audit --no-fund
npm run check
npm install --no-save --no-package-lock playwright@1.56.1
npx playwright install chromium
node scripts/smoke-browser.mjs
node scripts/smoke-eye-gpu.mjs
node scripts/smoke-activity-gpu.mjs
```

`tests/item-rendering-v3.test.mjs` verifies item identities, pixel shape diversity, nearest-neighbor texture/material parameters, alpha-extruded contour, invalid import metadata, grip parenting, book width and clean disposal. The GPU smoke captures page-turn checkpoints, all four foods and potion, quarter-angle frames and identical-pose prop off/on comparisons; it also imports a synthetic user-selected PNG, verifies visible pixel differences, and restores fallback textures. Historical V2 screenshots are available in PR #8 to compare.

Retain V2 tests for fixed-head neutral face, blink, gaze, idle modes, interruption, sit-to-stand, 60 FPS active/20 FPS passive pacing, overlay/Workspace startup, and renderer recovery.

## Limitations / owner gates

- Built-in originals mimic Minecraft inventory art but do not claim exact vanilla parity; **exact** item identity requires opt-in user-provided authorized PNGs. There is no pack-ZIP importer or automatic tint/model JSON interpreter.
- A fully rigged Blockbench-authored glTF book with authored finger placement and independent page-paper flex is a possible later upgrade; current book is independently articulated within Three.js, not an imported glTF animation.
- Native Windows 11 WebView2 alpha, original owner 64×64 skin and hair/mask overlap, 100/150/200% DPI, Classic/Slim, CPU p50/p95/p99, GPU frame times and RTX 3050/8GB VRAM impact must be measured interactively. Synthetic/headless Windows CI screenshots cannot certify native hardware.
- No OS window geometry or screen observation is implemented. Inspect remains visual-only.
- Initial local item changes can create resource objects once per import; the animation `update()` path creates none of those. Full 10-minute soak and 100 import/reset cycle on Windows still require owner tests.

## Production protection

This remains a draft PR. The accepted V2 baseline is `dev/minecraft-animation-fidelity-v2` at `4f5554683e3b23cc4c3de0a9a6cf3f1585beade6`. Roll back by using that branch and installer. Do not merge V3 into V2 or main until the owner's visual comparison passes.
