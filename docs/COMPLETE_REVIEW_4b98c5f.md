# AI Desktop Companion V4 — complete final review

Exact implementation: 4b98c5f657c3c3f919f111f5269b5e77cbedae3d. Tree: 12c8c997cf0765b50df072cab6be00a2eb817e47. Optimization comparison: bb2727b85ca21d5205620fc571d2f63b9bbe67ce.
Source and draft PR: https://github.com/ZpkDxGames/AI-Desktop-Companion/pull/10 . Main remains 004731af0bfb3c734b285cd236aebef34a06fdc0, unmerged.

## Implementation and appearance

All 17 authored actions remain in one BehaviorController and the canonical skinview3d/Three.js renderer. Original skin geometry/UVs, expressive eyes, blink, cursor gaze, Workspace and floating overlay remain. Original prototype audit and adopted/rejected concepts are recorded in architecture/ANIMATION_FIDELITY_V4.md.

The avatar sits before lifting a closed brown/gold book in its left palm. Its free right hand opens the book, lowers to rest and rises for turns at 10.6 and 20.6 seconds. Cream pages face the avatar eyes; the book closes, lowers and the avatar stands continuously. Default solid 3D apple, cooked chop, golden carrot and frosted cake require no import. Deliberate bites, chewing, crumbs and finishing fade remain. Drinking is preserved as accepted. Optional local art changes body/pale-frost colors while retaining geometry and semantic accents; no proprietary game files or owner skin are bundled.

Matching flat food surfaces merge while shared boundary vertices prevent T-junction cracks. The first corner-only merge was rejected after actual WebGL exposed pinholes. The corrected GPU gate passes twelve views with zero small enclosed missing pixels. Spatial fingerprints preserve every original colored unit face, its normal and exact Float32 color, with default and imported palettes. Whole-triangle tests check face/hat and jacket clearance throughout bites and interrupted recovery in Classic and Slim. Food triangles fall from 1380/936/824/1220 to 434/280/398/416 (apple/chop/carrot/cake), a 52–70% reduction. Each food still uses one cached mesh and material, with no per-frame construction.

## Tests and exact installer

121/121 tests, production build and Workspace/overlay, eyes and activity GPU suites pass. Original cadence/determinism/C1 continuity, interruption, sole-plane, original geometry/UV and resource checks remain. New coverage includes colored surface equivalence, outward nondegenerate triangles, no overlap/missing area, whole-triangle collision and actual raster cracks. Existing visibility thresholds are retained.

Source/browser CI: https://github.com/ZpkDxGames/AI-Desktop-Companion/actions/runs/38478915867 — passed.
Windows build 84: https://github.com/ZpkDxGames/AI-Desktop-Companion/actions/runs/38478915912 — passed.
Installer: AI-Desktop-Companion-V4-4b98c5f-Windows-x64-setup.exe. SHA-256: d84fc83992d5755a31804b354dbc419e0b7625ea0d67ac7b4263832837bdfeb4. Size: 2,239,163 bytes.
BUILD_INFO identifies this exact source. The PE certificate table is empty: unsigned development NSIS installer. Its bootstrap is x86; the bundled app is Windows x64, as verified by bundle metadata and MSVC logs. Version remains 0.1.0-alpha.6.0; V4 names the animation milestone. The installer has not been run on the owner's PC.

## Actual-renderer evidence

Open index.html after extracting the entire ZIP. The complete review contains 174 PNGs/version, 21 previous and 63 final movies, 17 action comparisons, 21 whole-motion strips and 3 dense phase strips. All 17 activities and four interruption/stop/stand cases are present. Fixed poses show both model widths at front, ±45° and hand-side 90°. Final controllers sample 30/60/144 Hz and record each actual renderer frame at 30 fps authored time. All 84 movies decode every expected frame at 320×400 and satisfy recovery gates. The read includes 822 frames over 27.4 seconds. No generated or interpolated movie frames are used. This is reproducible motion evidence, not native presentation-FPS certification.

Sixteen paired reading/drinking actor images remain pixel-identical to the previous build. Other raster comparisons are in data/pixel-comparison.json; preserving geometric colored cells does not imply every antialiased edge pixel is identical. The previous-reference-review gallery preserves the 535993f→bb2727b book and solid-food redesign comparisons; those are historical source images, clearly labeled separately from this exact-source review.

The paired movies use the existing default base-face configuration. Seven extra exact-source clips enable the existing optional expressive-eye shader for reading, eating, drinking and four recovery cases. They show coordinated pupils and blinking without changing app defaults; the separate eye GPU suite verifies gaze/blink and neutral/disabled equality.

## Performance and resources

Fixed eating pose at 1.45 s, Classic, 320x400/DPR 1, crumbs suppressed. 30 warm-up + 120 measured frames; two sequential trials. Synchronous gl.finish plus one-pixel readPixels fence includes completed software WebGL work and readback overhead, not native GPU time or displayed FPS.
Backend: Chromium 141.0.7390.37 / ANGLE SwiftShader software WebGL. Conditions are identical and workloads run sequentially. The one-pixel readback forces completion and includes synchronization/readback overhead. Neither submission time nor this fenced total is native hardware GPU timing or display FPS. Timings vary between trials; no universal speedup is claimed. Raw CPU results cover all 17 controllers, with GC enabled, in data/cpu.json. Raw render submission and resource counts are in each capture manifest. The 60 active / 20 idle policy remains; changing it still requires device telemetry.

| Food | Trial | Before completed p50 / p95 / p99 ms | Final completed p50 / p95 / p99 ms | Before → final triangles |
|---|---|---:|---:|---:|
| apple | 1 | 18.50 / 19.60 / 19.80 | 18.40 / 21.10 / 22.60 | 1380 → 434 |
| apple | 2 | 18.40 / 19.40 / 19.80 | 18.10 / 19.40 / 20.30 | 1380 → 434 |
| cooked_porkchop | 1 | 18.20 / 19.10 / 20.10 | 18.00 / 18.90 / 19.90 | 936 → 280 |
| cooked_porkchop | 2 | 18.10 / 19.10 / 19.90 | 17.90 / 18.70 / 19.40 | 936 → 280 |
| golden_carrot | 1 | 18.10 / 18.80 / 19.10 | 18.00 / 18.70 / 19.20 | 824 → 398 |
| golden_carrot | 2 | 17.90 / 18.50 / 19.00 | 17.90 / 18.70 / 20.50 | 824 → 398 |
| cake_slice | 1 | 18.20 / 18.90 / 19.60 | 17.90 / 20.10 / 29.40 | 1220 → 416 |
| cake_slice | 2 | 18.10 / 18.80 / 19.50 | 18.00 / 18.80 / 19.70 | 1220 → 416 |


Node.js CPU, 20-frame batches, 10,000 measured frames/action, GC before each action. Raw V3 labels mean the previous bb2727b source; V4 means this final source. Controller values are microseconds, not milliseconds.

| Action | Previous p50 / p95 / p99 µs | Final p50 / p95 / p99 µs |
|---|---:|---:|
| idle | 5.15 / 11.87 / 18.85 | 5.07 / 13.91 / 18.95 |
| walk | 4.46 / 13.26 / 19.79 | 4.44 / 12.25 / 18.12 |
| run | 4.44 / 7.19 / 9.36 | 4.48 / 11.15 / 12.64 |
| wave | 4.62 / 8.85 / 15.62 | 4.13 / 13.89 / 19.87 |
| sit | 4.97 / 11.11 / 16.65 | 3.85 / 11.28 / 13.41 |
| jump | 5.41 / 10.98 / 16.69 | 5.37 / 14.30 / 20.77 |
| think | 4.18 / 11.53 / 19.27 | 4.16 / 12.05 / 19.69 |
| celebrate | 4.26 / 15.91 / 23.60 | 4.24 / 14.19 / 20.77 |
| look | 4.22 / 7.80 / 10.99 | 4.21 / 7.16 / 9.17 |
| read | 4.17 / 18.78 / 27.15 | 5.75 / 16.91 / 27.49 |
| eat | 4.34 / 15.09 / 21.49 | 4.22 / 14.37 / 20.98 |
| drink | 3.93 / 12.93 / 19.24 | 3.79 / 11.13 / 18.91 |
| inspect | 4.30 / 9.15 / 13.65 | 4.22 / 9.48 / 13.55 |
| nod | 4.65 / 9.39 / 11.77 | 4.65 / 8.60 / 11.84 |
| shrug | 4.50 / 7.85 / 12.81 | 4.45 / 7.75 / 10.71 |
| stretch | 4.68 / 7.21 / 10.08 | 4.61 / 7.09 / 9.52 |
| bow | 4.54 / 7.47 / 9.87 | 4.46 / 7.07 / 9.45 |


Exact-source resource test ran 602.556 seconds after 100 skin/model/import/reset/dispose/reinitialize lifecycles and 60 timed action requests. Final counts: 37 geometries and 13 textures. Post-GC heap range: 215,352 bytes (22,713,644–22,928,996). Bounded pools and cached geometry/material ownership remain. This supports reuse over the measured interval; it is not indefinite leak proof or native GPU-memory certification.

## Native acceptance remaining

Implemented and automated-tested: yes. Actual-renderer images and decoded motion sequences: reviewed. Native owner hardware certified: no. Owner acceptance and merge: pending.

On the owner's Windows x64/Ryzen 7 5700G/RTX 3050 PC, use the private local skin import, then review Classic/Slim, Workspace/transparent overlay, 100/150/200% DPI and available refresh rates. Review complete read/open/turn/close, all four foods, sip/empty/lower, idle breathing and every gesture; interrupt pages/sips and sit→stand→wave. Confirm eyes/blink/cursor pupils, hat layers, drag/click-through/tray, minimize/restore and context recovery. Measure actual active/idle presentation FPS and frame percentiles, CPU, GPU and memory with native tools. Fixed Minecraft arms still temporarily occlude items from the hand-side 90° camera. Real desktop-window awareness for Inspect remains a future milestone.

Reproduction: npm ci; npm run check; isolated Playwright 1.56.1 plus browser; ffmpeg/ffprobe on PATH; scripts/capture-motion.mjs --prop-details --clips --clip-rates=30,60,144; scripts/bench-food-renderer.mjs <previous repository> <output.json>; node --expose-gc scripts/bench-motion.mjs <previous repository> <output.json>; scripts/soak-motion.mjs <output.json>. The app never calls the evidence-only completion/readback fences.
