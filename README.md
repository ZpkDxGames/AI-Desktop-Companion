# ZpkDxGames Desktop Companion

**Alpha.6 recovery + expressive eyes + idle behaviors — draft Windows development build, not a stable release.**

A local-first Windows 11 desktop companion using the user's Minecraft skin as a fully 3D character. The current recovery branch builds on Alpha.6, replacing its broken packaged startup and technical-preview Workshop. Alpha.6 previously replaced the earlier custom WebGL player mesh with the established MIT-licensed **skinview3d 3.4.2 / Three.js** player model so Java 64×64 UVs, outer layers and Classic/Slim geometry have one canonical rendering path.

This is **not yet an AI agent**. Screen observation, Ollama, tool execution and proactive desktop actions remain disabled until the avatar/overlay foundation is visually certified.

## Canonical renderer and Workspace

- Canonical Minecraft Java skin model via skinview3d.
- Automatic Classic/Slim detection with manual override.
- Perspective camera, FXAA, nearest-neighbor textures and tuned local lighting.
- Existing local animation state machine drives skinview3d joints.
- Supported eye markers use a **single head-only UV compositor** for two-axis pupil movement and blinking, with no separate eye meshes. The original skin artwork and outer hair/hat geometry are preserved.
- The owner has reported satisfactory expressive-eye behavior; native automated GPU performance certification is still pending.
- Unsupported eye layouts preserve the original vanilla face.
- The redesigned Workspace contains Overview, Avatar Studio, Behavior, Desktop World, Conversation, AI & Models, Privacy, Activity, Diagnostics and Settings. Unsupported features are labeled unavailable, not simulated. A single 3D preview remains canonical; desktop overlay stays transparent.

See [Alpha.6 Viewer Rebuild](docs/ALPHA6_VIEWER_REBUILD.md).

## Run the web studio

Prerequisites: Node.js 20+.

```powershell
npm ci
npm run dev
```

Open <http://127.0.0.1:4173/>. Imported skins stay on-device in local storage.

## Build the Windows desktop app

Prerequisites:
- Microsoft C++ Build Tools — Desktop development with C++
- Rust stable MSVC toolchain
- WebView2
- Node.js 20+ / npm

```powershell
npm ci
npm run check
npm run tauri:dev
```

Build NSIS:

```powershell
npm run tauri:build
```

## Current feature status

| Capability | Status |
|---|---|
| Canonical Java 64×64 skin / outer layers | Alpha.6 implemented through skinview3d |
| Classic/Slim auto-detection | Implemented |
| Manual Classic/Slim override | Implemented |
| Idle/walk/run/wave/sit/jump/think/celebrate | Implemented |
| Nod/shrug/stretch/bow | Implemented |
| 3D skin-native eye/pupil/eyelid rig | Experimental; off by default; visual parity unverified |
| Cursor head/pupil tracking | Implemented using native-UV composition |
| Companion Workspace responsive pages | Source implemented; browser-smoke tested; native Windows visuals pending |
| Timed reading/eating/drinking + procedural idle director | Development branch; configurable local frequency |\n| Transparent always-on-top Tauri overlay | Implemented; Windows visual certification required |
| Whole-window click-through | Implemented; tray recovery required |
| Per-pixel avatar hit testing | Planned |
| Desktop/window physics | Planned |
| Local AI / Ollama | Not implemented |
| Screen viewing / agent actions | Not implemented |

## Engineering boundaries

- `skinview3d` and `three` are bundled locally by Vite. No CDN/runtime network script is used.
- The original user's skin is **not committed** to this public repository.
- AI, screen capture, process enumeration, shell and accessibility permissions remain absent.
- `BehaviorController` remains deterministic and local.
- Alpha.5 custom mesh/UV drafts are superseded; the old homegrown `rig.js`, `mat4.js`, `camera.js` and associated tests have been removed from Alpha.6.
- Facial marker detection never edits the original PNG.

## Validation

```powershell
npm run check
```

This runs 24 Node unit tests and builds the production Vite bundle. The Windows-hosted Chromium smoke gate additionally checks both surfaces, animated-pixel changes, skin import/reload, Workspace navigation and no horizontal overflow at 840×650 and 1120×780. GitHub Actions also builds unsigned NSIS preview installers on pull requests.

**Passing browser CI does not prove an installed WebView2 window works.** Real Windows 11 / RTX 3050 performance, on-device transparency/tray/input, and authentic ZpkDxGames PNG front/side/back comparisons remain required before any production merge. See [current recovery gates](docs/RELEASE_GATES.md) and [draft PR #4](https://github.com/ZpkDxGames/AI-Desktop-Companion/pull/4).

## Repository map

```text
web/
  index.html
  css/app.css
  js/main.js
  js/engine/renderer.js          # skinview3d / Three.js adapter + UV facial shader\n  js/engine/avatar-props.js      # owned cached props on canonical joints
  js/avatar/animation.js
  js/avatar/animation-handlers.js
  js/avatar/face.js              # marker detection only
  js/avatar/animation-handlers.js # trusted local gesture + activity poses
  js/avatar/model-policy.js      # auto/manual Classic/Slim policy
  js/avatar/skin.js              # local PNG validation
src-tauri/
  src/lib.rs
  tauri.conf.json
docs/
  ALPHA6_VIEWER_REBUILD.md
```

Development repository: <https://github.com/ZpkDxGames/AI-Desktop-Companion>.
