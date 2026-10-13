# AI Desktop Companion V4 — reference refinement verification

Implementation bb2727b85ca21d5205620fc571d2f63b9bbe67ce, tree 5bfd0e5308519c48ca636be4cff5e8828fab6403. Previous comparison 535993fbc50f4a4c5a965d44f923fbfb23b688e0. Source: https://github.com/ZpkDxGames/AI-Desktop-Companion/pull/10 (draft). Main remains 004731af0bfb3c734b285cd236aebef34a06fdc0, unchanged.

The default installer includes solid 3D foods and the brown/gold book with cream parchment. Drinking is preserved as accepted.

## Exact Windows build

Source/browser CI: https://github.com/ZpkDxGames/AI-Desktop-Companion/actions/runs/38448616770
Windows build: https://github.com/ZpkDxGames/AI-Desktop-Companion/actions/runs/38448616801
Installer: AI-Desktop-Companion-V4-bb2727b-Windows-x64-setup.exe
SHA-256: 91a806c948d8b7669ff85f9e1794b18c05224591e9ef05279b78409eb527389e
Size: 2,237,372 bytes. Version 0.1.0-alpha.6.0; V4 names the motion milestone.

The PE certificate table is empty: unsigned development installer. NSIS uses an x86 bootstrap; the bundled application is Windows x64 as verified by the MSVC log and bundle filename. It was built from this exact tested implementation. It has not been installed on the owner's PC.

## Implemented behavior

Reading uses the existing BehaviorController seat authority. The avatar completes the 850 ms sit before equipping. The left palm lifts the closed book from 0.95–1.55 s; the right hand reaches from 1.45–1.9, opens the cover from 1.8–2.6 and rests by 3.25. Page assistance anticipates turns at 10.6 and 20.6 by 0.5 s, sweeps across the hinge and lowers afterward. The free hand closes the book; it lowers and the existing 650 ms stand returns to idle. Manual interruptions close once, stand and perform the latest queued request.

The book attaches to the actual left-arm/palm joint. An underside cover point determines its offset with full shoulder quaternion compensation. Brown pixel leather, gold corner clips, cream parchment, a hinged cover and cached curled sheet follow the supplied reference. Both page-face normals are tested against the avatar eye position. Head/pupils look down, with quiet scans and retained cursor response.

Eating replaces the active sprite extrusion with four original volumetric profiles: stepped apple with stem/leaf, curved cooked chop with bone ends, tapered golden carrot with stalks and frosted block cake with red topping. Exterior pixel faces merge into one mesh per item with flat normals and discrete colors. Food sRGB colors are explicitly decoded to linear vertices without altering the skinview3d global color configuration. Thickness-specific grips keep solids outside head/hat and jacket during bites/recovery.

Deliberate bites/chewing, bounded 16-instance crumbs and finishing opacity fade remain. Default 3D models need no import. Optional Avatar Studio JAR/ZIP/PNG imports customize body/pale-frost colors while preserving profiles and semantic accents. Archive size/path/decompression/CRC limits remain; no raw game texture, client JAR or private skin is bundled.

Drinking's vessel, fill, level surface, grip, tilt and lowering are unchanged. Eight actor PNG pairs—Classic/Slim × front, both 45° views and hand-side 90°—are pixel-identical to the accepted build. Bottle clearance and liquid-surface tests still pass.

## Verification

119 / 119 automated tests, production web build and all browser suites pass; exact-head CI agrees. Reference regressions cover solid volume, sit-before-equip, closed lift, opening assistance, free-hand rest, supporting-palm attachment, page assistance/return and eye-to-page facing. Every food surface vertex is checked through full bites and interrupted recovery for both models; every book cover/page vertex is checked through lift, open, read and close. Original geometry/UV, upper-body attachment, cadence agreement, action continuity, interruption and seat/sole-plane tests remain active.

Two-palm mounting and thin-depth assertions were migrated to the owner's one-hand/solid-volume requirements. Visibility thresholds remain; reading is sampled after its intentional sit/lift. Eyes fixed-head motion/blink gates pass with neutral/disabled difference zero. Workspace/overlay startup, dynamic wave, skin import/reload, daily activities and settings pass. Crumbs pass the unchanged GPU gate; browser JAR decoding selects only allowlisted synthetic fixtures.

Logs are included. Vite renderer-bundle size notices remain warnings; builds succeed. No perfect-results or native-hardware certification is claimed.

## Actual-renderer review

Extract the ZIP and open index.html. There are 60 PNGs per version, 7 before clips, 21 after clips, 11 comparison sheets and 7 temporal filmstrips, plus browser smoke screenshots. Classic/Slim are shown at front, both 45° and one hand-side 90° view. Details include closed equip, opening, quiet reading, both page turns, closing, each food/fade and bottle states. Isolated props use each version's actual production geometry/materials and canonical lighting.

All 28 clips are decoded and match expected frame counts, 320 × 400 dimensions and final idle/standing/zero-prop state. The full read has 822 frames over 27.4 s, including both turns and complete stand-up. Interruption/stop/stand cases run four seconds. Before samples the controller at 60 Hz; after at 30/60/144. Each actual renderer PNG frame is read back and encoded at 30 fps authored time. There are no generated or interpolated frames. Context loss fails capture. This is reproducible motion evidence, not native presentation-FPS certification.

Default paired times: reading 5.0 s, eating 1.45 s, drinking 1.9 s. Closed-book isolates use the respective closed phase. Both columns use shipped defaults. The fixed Minecraft arms still temporarily occlude props from the hand-side 90° view. Owner original skin, native WebView2, actual pacing and hardware/DPI checks remain pending.

## Performance

Measurements run sequentially without concurrent capture/soak. Controller samples use 1,000 warm-up and 10,000 measured frames/action, 20-frame batches and GC before/after. Raw V3 means previous reference; V4 means this implementation.

| Action | Before p50 / p95 / p99 (µs) | After p50 / p95 / p99 (µs) |
|---|---:|---:|
| idle | 3.75 / 8.50 / 12.16 | 3.79 / 9.73 / 15.54 |
| walk | 3.46 / 9.60 / 11.77 | 3.44 / 10.34 / 13.90 |
| run | 3.42 / 6.00 / 7.85 | 3.42 / 5.54 / 7.36 |
| wave | 3.10 / 6.73 / 10.74 | 3.23 / 9.68 / 12.90 |
| sit | 3.76 / 7.50 / 11.89 | 2.99 / 7.96 / 13.45 |
| jump | 4.01 / 10.52 / 15.29 | 5.16 / 10.53 / 15.39 |
| think | 3.13 / 9.32 / 14.58 | 3.25 / 8.61 / 12.35 |
| celebrate | 3.22 / 10.19 / 14.57 | 3.29 / 9.73 / 14.14 |
| look | 3.15 / 6.58 / 8.97 | 3.21 / 6.23 / 7.49 |
| read | 3.21 / 9.94 / 15.62 | 4.44 / 12.82 / 23.27 |
| eat | 5.40 / 11.95 / 19.66 | 4.08 / 10.23 / 15.15 |
| drink | 2.84 / 8.16 / 12.81 | 3.02 / 7.58 / 13.09 |
| inspect | 3.11 / 7.74 / 12.12 | 3.32 / 5.35 / 7.80 |
| nod | 3.36 / 5.57 / 7.84 | 3.52 / 6.67 / 9.52 |
| shrug | 3.40 / 6.89 / 11.00 | 3.34 / 7.19 / 12.52 |
| stretch | 3.45 / 5.31 / 7.32 | 3.56 / 5.40 / 7.57 |
| bow | 3.35 / 6.45 / 9.36 | 3.47 / 5.51 / 7.91 |


Renderer: Chromium 141.0.7390.37 / ANGLE SwiftShader software WebGL, 320 × 400/DPR 1, sample skin, 60 warm-up plus 360 measured frames/action. Values time JS render submission and queue backpressure, not completed GPU frame time or display FPS. Two trials show variability; no universal speedup is claimed.

| Action | Trial | Before p50 / p95 / p99 (ms) | After p50 / p95 / p99 (ms) | Calls before → after | Triangles before → after |
|---|---|---:|---:|---:|---:|
| idle | 1 | 0.50 / 27.80 / 38.10 | 0.40 / 30.10 / 37.90 | 19 → 19 | 217 → 217 |
| idle | 2 | 0.40 / 30.80 / 37.50 | 0.40 / 25.90 / 38.40 | 19 → 19 | 217 → 217 |
| walk | 1 | 12.90 / 25.70 / 27.30 | 12.90 / 25.90 / 27.70 | 19 → 19 | 217 → 217 |
| walk | 2 | 12.80 / 26.00 / 28.30 | 12.90 / 25.50 / 26.90 | 19 → 19 | 217 → 217 |
| read | 1 | 10.30 / 24.10 / 25.20 | 0.90 / 24.70 / 25.90 | 33 → 26 | 365 → 281 |
| read | 2 | 10.30 / 24.50 / 26.00 | 1.50 / 24.50 / 25.20 | 33 → 26 | 365 → 281 |
| eat | 1 | 12.40 / 24.70 / 26.20 | 0.60 / 25.80 / 38.00 | 25 → 20 | 457 → 1597 |
| eat | 2 | 12.40 / 20.60 / 26.20 | 0.70 / 26.10 / 37.60 | 25 → 20 | 457 → 1597 |
| drink | 1 | 13.00 / 24.70 / 26.70 | 13.00 / 25.30 / 26.70 | 31 → 31 | 325 → 325 |
| drink | 2 | 12.90 / 25.70 / 26.60 | 13.00 / 25.70 / 26.70 | 31 → 31 | 325 → 325 |
| celebrate | 1 | 12.80 / 25.70 / 27.70 | 12.90 / 25.10 / 26.50 | 20 → 20 | 505 → 505 |
| celebrate | 2 | 13.00 / 26.30 / 30.30 | 12.90 / 25.40 / 26.40 | 20 → 20 | 505 → 505 |


Solid foods add triangles and reduce draws. Mesh triangles: cooked chop 936, apple 1380, carrot 824, cake 1220. Texture-backed book covers remove trim meshes. Idle/walk and the original 60 active / 20 idle policy remain. Creation/disposal is owned by initialization and explicit import; no geometry/material/palette/matrix/particle object is created in per-frame updates.

### Final-source resource soak

Final bb2727b ran 602.059 s after 100 skin/model/import/reset/dispose/reinitialize lifecycles, with 60 timed action requests. Counts remain stable: 37 geometries, 13 textures; 6 prop geometries, 7 prop materials, 5 item models, 11 bottle geometries, 6 bottle materials. Pools: 48 fireworks, 16 crumbs. Post-GC heap 22,552,804–22,808,624 bytes; range 255,820. This bounded sample supports reuse; it is not indefinite leak proof or native GPU-memory certification.

## Architecture and reproduction

One BehaviorController and the canonical skinview3d/Three.js renderer remain, with original skin geometry/UVs, eyes/blink/cursor pupils, Workspace and overlay. Inspect desktop-window awareness remains a separate future milestone. The obsolete food extrusion builder is removed; existing prop/effect owners handle new assets. No second clock or renderer is introduced.

Source docs: docs/ANIMATION_FIDELITY_V4.md and docs/ACTIVE_ANIMATIONS_AND_LOGIC_V4_DEV.md. Main code: activity-timelines.js, animation-handlers.js, avatar-props.js, voxel-foods.js and reference-props-v4.test.mjs. water-bottle.js remains unchanged.

Evidence automation on a separate branch checks out this fixed implementation SHA and baseline, keeping PR #10 unchanged. Reproduce using npm ci / npm run check, isolated Playwright 1.56.1/browser, ffmpeg/ffprobe on PATH, and scripts/capture-motion.mjs --actions=read,eat,drink --prop-details --clips --clip-rates=30,60,144. Benchmark and soak helpers are checked in; raw game assets are unnecessary.

Owner acceptance still needs the original skin on Windows x64, Workspace/overlay interactions, tray/context behavior, 100/150/200% DPI and native GPU/display pacing. Main has not been merged.
