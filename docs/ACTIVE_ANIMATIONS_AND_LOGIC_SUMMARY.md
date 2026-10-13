# AI Desktop Companion — Active Animation & Logic Reference

**Source snapshot:** V3 implementation promoted to `main` from `6dc129a5824fd2db0a6c44926d8fae548ddbb5ff` (2026-10-13).  
**Scope:** Implemented and wired functionality, as inspected in source. A browser CI pass does **not** certify final owner-skin/native Windows appearance or RTX 3050 performance.

## 1. Current application architecture

| Component | Source | Active responsibilities |
|---|---|---|
| `BehaviorController` | `web/js/avatar/animation.js` | Sole action/pose owner; priorities, action durations, interruption blending, sit-to-stand, deterministic idle scheduling, blink/gaze easing, item selection and authored one-shot event counters |
| Extra action choreography | `web/js/avatar/animation-handlers.js` | Pure procedural movement of arms, legs, head and torso for the nine extension gestures |
| Activity clocks | `web/js/avatar/activity-timelines.js` | Deterministic phased read/eat/drink/look/inspect/think/celebrate timelines; reusable `out` buffer for per-frame use |
| Canonical character renderer | `web/js/engine/renderer.js` | One `skinview3d` `SkinViewer` with Three.js; applies joint pose, facial material, cached props and effects; handles model/skin reload and resource disposal |
| Book, food and potion | `web/js/engine/avatar-props.js` | Renderer-owned joint-attached prop groups; book page hinge and pixel-textured pages; grip-local item motion; cached textures/geometries |
| Generated voxel items | `web/js/engine/item-models.js` | Distinct original sprite silhouettes, nearest-neighbor sRGB textures and alpha-contour extruded geometry for four foods and water potion |
| Opt-in local sprite importer | `web/js/engine/item-import.js` | User-selected PNG validation, locally stored data URLs, sprite decoding, fallback restoration; no background scanning |
| Effects | `web/js/engine/avatar-effects.js` | Thinking bubble and two local fireworks bursts via a bounded 48-instance pool; reduced-motion support |
| Facial compatibility | `web/js/avatar/face.js`, `face-composition.js`, `web/js/engine/eye-face-material.js`, `eye-shader.js` | Conservative original-skin eye-marker detection; opt-in shader-composited 2D iris/pupil motion and blinking on canonical head material; leaves body and hat layer intact |
| Render pacing | `web/js/runtime/frame-pacing.js` | Fixed-deadline active 60 FPS / reduced-idle 20 FPS scheduler |
| Workspace/overlay runtime | `web/js/main.js`, `web/index.html` | Settings, skin upload, controls, animation buttons, pointer-local look, saved preferences, native events, diagnostics and lifecycle recovery |
| Windows native shell | `src-tauri/src/lib.rs`, `src-tauri/capabilities/default.json` | Tray commands, open/hide Workspace, avatar drag, explicit click-through; restricted Tauri commands |

**Critical invariant:** One canonical skinview3d avatar, one `BehaviorController`, one browser animation/render loop. Do not introduce an overlapping model, duplicate handler or second renderer.

## 2. Registered and usable animations

All 17 registered actions are exposed through `ACTIONS` in `web/js/avatar/animation.js`. The Behavior page provides corresponding buttons.

| Action | Mode / Duration | Current effect or choreography |
|---|---|---|
| `idle` | Continuous | Soft head/arm/body breathing motion; occasional blinking and eased cursor gaze |
| `walk` | Continuous | Alternating arms/legs and root bob; in-place, not physical window travel |
| `run` | Continuous | Faster alternating limbs and bob; in-place |
| `wave` | 2.4 s | Raises/waves left arm, with head tilt |
| `sit` | Indefinite | 0.35 s sitting-down, seated pose, ~0.65 s standing-up before queued next action; **no chair, collision or desktop edge** |
| `jump` | 0.95 s | Arc-shaped root lift and airborne limb pose |
| `think` | 3.2 s | Thinking pose plus scene-space pixel thought bubble |
| `celebrate` | 2.6 s | Arms raised, repeated bounce and two small voxel firework sequences |
| `look` | 3.8 s | Head scanning and short reversible in-canvas steps |
| `read` | 11.7 s | Standing reading pose; open book, gaze, physical page rotation, closing sequence |
| `eat` | 4.8 s | Seeded food selection, right-arm raise, two bite/chew phases, scaled item consumption |
| `drink` | 4.4 s | Right-arm raise, stylized water-potion sip, tilt and lowering |
| `inspect` | 4.2 s | Local lean/head scan only; **no desktop-window observation or window-edge interaction** |
| `nod` | 1.45 s | Short repeated vertical head motion |
| `shrug` | 1.8 s | Both shoulders/arms and head tilt |
| `stretch` | 2.6 s | Raises both arms and adjusts head/body |
| `bow` | 1.9 s | Forward head inclination and small arm movement |

`DURATION` also includes the timed gesture values above. `sit`, `idle`, `walk` and `run` do not have timed auto-completion.

### Authored activity phases

| Activity | Timeline landmarks |
|---|---|
| `read` | enter 0–0.65 s; open 0.65–1.5; readA 1.5–4.6; pageTurn 4.6–5.5; readB 5.5–10.7; close 10.7–11.7 |
| `eat` | equip 0–0.4; raise 0.4–1; bite1 1–1.55; chew1 1.55–2.15; bite2 2.15–2.7; chew2 2.7–3.45; finish 3.45–4.8 |
| `drink` | equip 0–0.4; raise 0.4–1; sip 1–2.4; swallow 2.4–3.2; lower 3.2–3.85; putAway 3.85–4.4 |
| `look` | start 0–0.55; explore 0.55–3.25; return 3.25–3.8 |
| `inspect` | lean 0–0.7; focus 0.7–3.5; recover 3.5–4.2 |
| `think` | consider 0–0.5; ponder 0.5–2.75; resolve 2.75–3.2 |
| `celebrate` | raise 0–0.3; fireworks 0.3–2.15; settle 2.15–2.6 |

## 3. Behavior logic

- **Idle frequency:** `off`, `calm` and `lively`. Calm schedules a candidate roughly every **36–64 seconds** of eligible idle simulation; Lively **14–26 seconds**. The default saved UI setting is Calm.
- **Auto action set:** `look`, `read`, `eat`, `drink`, `inspect`, `stretch`, `nod`. Selection is deterministic for a given controller seed via an LCG; normal runtime seeds the controller with current time.
- **Manual vs automatic:** Manual discrete gestures can interrupt active timed actions; lower-priority walking/running does not seize control of an ongoing higher-priority gesture. Requesting `idle` interrupts. Seated transitions retain one latest requested action while standing up.
- **Transitions:** `request()` captures the last visible pose; `pose()` interpolates to the next pose (normal action blend ~0.17 s). Sit/stand has separately authored transitions.
- **Clock protection:** `update(dt)` ignores nonfinite intervals and clamps each animation step to 50 ms; timed actions return to idle when complete. Hidden-window handling pauses frame driving and resets frame pacing on return.
- **Gaze:** Local pointer position from the app window only. Eye gaze eases faster than head gaze, with bounded horizontal and vertical targets; neither OS-global tracking nor screen capture occurs.
- **Blink:** Automatic procedural blink intervals plus a manual `Preview blink` control. Marker-compatible opt-in expressive eyes preserve original vanilla texture when disabled/unsupported.
- **Effects:** `AvatarEffects` owns a scene-space bubble and 48-slot instanced firework pool, with no new geometry per frame. The `prefers-reduced-motion` flag suppresses fireworks in the renderer.

## 4. Minecraft-style props and asset handling

**Available built-in item variants:** `apple`, `cooked_porkchop`, `golden_carrot`, `cake_slice`, `water_potion`. These are newly authored Minecraft-inspired pixel silhouettes, **not exact bundled Mojang textures**.

- `AvatarProps` mounts the book to the torso and food/potion to the canonical right-arm joint.
- The book has two independent covers, page blocks, textured page surfaces and a rotating page hinge. The final render is procedural Three.js geometry, **not imported glTF/Blockbench**.
- Food selection is deterministic per `eat` start and avoids repeating the immediately previous choice. Items move/scale according to bite phase.
- Local resource-pack PNG override is **opt-in**, from Studio. It accepts only recognized item filenames (including `potion.png` as an alias for `water_potion`), PNG content up to 160 KB, and square 16/32/64/128-pixel dimensions.
- The importer validates a PNG signature, decodes it without sending the file to a service, saves bounded data URLs in local settings and rebuilds the relevant sprite geometry once per import; the Reset button restores built-in fallback textures.
- No full resource-pack ZIP loader, item-model JSON interpreter, automatic Minecraft installation scan, imported 3D animations or remote asset download.

## 5. Workspace, overlay and persistence

- **Workspace screens:** Overview, Avatar Studio, Behavior, Desktop World (placeholder), Conversation (placeholder), AI & Models (placeholder), Privacy, Activity (placeholder), Diagnostics, Settings.
- **Studio controls:** Import local 64×64 skin, select auto/classic/slim model, change scale, enable expressive eyes, enable pointer-follow, trigger blink, import/reset personal item sprites.
- **Behavior controls:** Select Off/Calm/Lively and trigger the 17 registered actions.
- **Overlay:** Floating transparent character canvas with Wave, Rest, Workspace; draggable avatar bar and explicit click-through command. System-tray menu can open Workspace, toggle click-through, wave or quit.
- **Persistence:** `localStorage` settings key `zpkdx-avatar-v0.1`; saves skin as a local data URL, model/scale/eye/cursor/idle settings and imported item textures. Tauri events synchronize settings between the Workspace and floating avatar.
- **Diagnostics:** Runtime stages/errors, renderer/model info, current action/source, FPS estimate, context-loss count and browser-side CPU render-call p50/p95/p99. These measurements **do not** establish GPU frame time or native-device performance.
- **Recovery:** Boot retry, context-loss/restoration path, skin reload and renderer-owned geometry/material/texture disposal.

## 6. Implemented native permissions vs future ideas

Currently active Tauri commands: `set_passthrough`, `begin_drag`, `open_workshop`. The desktop tray also emits a Wave event.

Not active: screenshots, OCR, microphone, window enumeration, desktop collision/edge sitting, native desktop object inspection, global cursor hooks, AI inference/provider, autonomous tool execution, recording or network image retrieval. The labels for future AI/Desktop pages are **UI placeholders**, not working capabilities.

## 7. Verification and outstanding acceptance

The exact V3 source commit `6dc129a5824fd2db0a6c44926d8fae548ddbb5ff` passed:
- **68 Node tests / 0 failures** and web build.
- Two successful independent [source/browser CI runs](https://github.com/ZpkDxGames/AI-Desktop-Companion/actions/runs/38335745069), including Workspace/overlay, fixed-head GPU eyes, activity props, and local-item import/reset pixel changes.
- [Unsigned Windows x64 NSIS workflow](https://github.com/ZpkDxGames/AI-Desktop-Companion/actions/runs/38335745062), with installer SHA-256 `959755b216ec4c447c162a1483f135e3d80b88af6603b83ce92f26ff0e9ae242`.

**Not established by those checks:** native Win11/WebView2 appearance on the owner's original skin, hat/mask occlusion at all angles, 100–200% DPI, exact vanilla item sprite parity, 10-minute runtime soak, RTX 3050 CPU/GPU/VRAM/fps percentiles, or final owner visual acceptance. No claim of production-grade release certification is made on those grounds.

## 8. Maintenance guide for future changes

1. Preserve the sole `BehaviorController` authority for action selection and phases.
2. Add pose choreography in `animation-handlers.js` / `activity-timelines.js`, never through a second render scheduler.
3. Add static 3D models as cacheable `AvatarProps` assets and dispose them on rebuild; never instantiate meshes in `update()`.
4. Use only explicitly authorized local image sources; do not bundle Mojang assets in public distributions.
5. Retain fixed-head eye pixel equivalence and Classic/Slim skin/hat occlusion gates.
6. Validate front/quarter/side item silhouettes and hand-to-mouth alignment, not merely prop-visible pixel counts.
7. Keep tests, the browser screenshot suite, and Windows installer linked to a precise source SHA.
8. Keep Inspect desktop-window awareness and AI permissions in separate, opt-in future milestones.

**Repository:** https://github.com/ZpkDxGames/AI-Desktop-Companion  
**Canonical branch after consolidation:** `main`.  
**Historical development and fidelity documents** describe milestone-specific status and should not override this active-feature inventory.
