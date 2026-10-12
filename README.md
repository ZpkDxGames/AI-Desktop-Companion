# ZpkDxGames Desktop Companion

**Alpha.6 avatar viewer rebuild — Windows development preview.**

A local-first Windows 11 desktop companion using the user's Minecraft skin as a fully 3D character. Alpha.6 replaces the earlier custom WebGL player mesh with the established MIT-licensed **skinview3d 3.4.2 / Three.js** player model so Java 64×64 UVs, outer layers and Classic/Slim geometry have one canonical rendering path.

This is **not yet an AI agent**. Screen observation, Ollama, tool execution and proactive desktop actions remain disabled until the avatar/overlay foundation is visually certified.

## Alpha.6 renderer

- Canonical Minecraft Java skin model via skinview3d.
- Automatic Classic/Slim detection with manual override.
- Perspective camera, FXAA, nearest-neighbor textures and tuned local lighting.
- Existing local animation state machine drives skinview3d joints.
- Supported ZpkDxGames/Fresh-Moves-style symmetric eye markers create **separate 3D sclera, iris, pupil and eyelid planes** attached to the head.
- Facial micro-geometry sits above the base head and behind the normal hat/hair outer layer, so opaque hair naturally occludes it.
- Unsupported eye layouts preserve the original vanilla face.
- Workshop uses a polished studio background; desktop overlay remains transparent.

See [Alpha.6 Viewer Rebuild](docs/ALPHA6_VIEWER_REBUILD.md).

## Run the web studio

Prerequisites: Node.js 20+.

```powershell
npm install
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
npm install
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
| 3D skin-native eye/pupil/eyelid rig | Experimental; supported marker layout only |
| Cursor head/pupil tracking | Implemented |
| Transparent always-on-top Tauri overlay | Implemented; Windows visual certification required |
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

This runs Node unit tests and a production Vite bundle. GitHub Actions also compiles Windows NSIS preview installers on pull requests. A successful build is **not** a visual certification; the real skin must be checked in Windows WebView2 from front, quarter, sides and rear before Alpha.6 can merge.

## Repository map

```text
web/
  index.html
  css/app.css
  js/main.js
  js/engine/renderer.js          # skinview3d / Three.js adapter + 3D face rig
  js/avatar/animation.js
  js/avatar/animation-handlers.js
  js/avatar/face.js              # marker detection only
  js/avatar/face-rig-layout.js   # pure 3D eye geometry math
  js/avatar/model-policy.js      # auto/manual Classic/Slim policy
  js/avatar/skin.js              # local PNG validation
src-tauri/
  src/lib.rs
  tauri.conf.json
docs/
  ALPHA6_VIEWER_REBUILD.md
```

Development repository: <https://github.com/ZpkDxGames/AI-Desktop-Companion>.
