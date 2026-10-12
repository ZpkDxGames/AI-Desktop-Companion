# ZpkDxGames Desktop Companion

**Phase 0 + v0.1 animation foundation — source preview / Windows integration alpha.**

**v0.1.0-alpha.2 renderer hotfix:** Fixes a malformed Z-axis rotation matrix that made the avatar invisible in both windows despite WebGL2 reporting ready. See [the regression report](docs/RENDER_FIX_ALPHA_2.md). The Windows executable still requires real-machine visual certification.

A 3D Minecraft-style desktop avatar powered by a small custom WebGL2 engine. It renders a pixel-perfect Java Edition skin, supports Classic and Slim arms, animates six articulated body parts, handles eye tracking and blinking through a user-calibrated per-skin profile, and optionally runs as a small always-on-top **Windows 11 Tauri 2** companion with tray controls.

This is **not yet an AI agent**. It does not inspect the screen, observe applications, execute actions, or run Ollama. Those are explicitly reserved for later opt-in milestones.

## Try the animation workshop (no install / no internet required)

From the project directory with Node 20+:

```powershell
npm run dev
```

Open <http://127.0.0.1:4173/> in Chrome/Edge. Node's built-in HTTP server serves the bundled HTML/CSS/JS; **no npm install is needed for the web preview.**

The preview starts with an **illustrative sample skin**, **not the user's original ZpkDxGames skin**. Use **Import PNG** to load the real 64×64 Java Edition PNG. Imported skins are processed locally and stored in local browser storage. They are not uploaded. Skin sizes other than 64×64 are rejected.

Select Classic/Steve or Slim/Alex arms, test Idle/Walk/Run/Wave/Sit/Jump/Think/Celebrate, drag to rotate, adjust scale, and enable eye expressions only after calibrating the two eye pixel coordinates.

## Build the Windows desktop app

Prerequisites on Windows 11:
- Microsoft C++ Build Tools with the **Desktop development with C++** workload
- Rust stable MSVC toolchain (`rustup`)
- WebView2 (typically present on Windows 11)
- Node.js 20+ and npm

From the repository directory:

```powershell
npm install
npm run tauri:dev
```

For an NSIS installer:

```powershell
npm run tauri:build
```

The installer normally appears under `src-tauri/target/release/bundle/nsis/` after a successful Windows build. We have **not built or tested an EXE here**; Rust and the Windows compiler are unavailable in this environment. The Rust/Tauri configuration needs Windows certification before considering this a working packaged release.

### Windows controls

The transparent, frameless avatar overlay starts in **interactive mode**. It can be dragged by its upper bar. The three bottom controls are Wave, Rest, and Setup (opens the larger workshop window). Its system tray menu offers **Open animation workshop**, **Toggle avatar click-through**, **Wave**, and **Quit**.

**Important:** Enabling click-through makes the **entire avatar window** ignore mouse input. Use the tray menu to disable it again. **Per-pixel/avatar-shaped hit testing is not implemented yet**. The alpha background does not automatically make the app click-through; this is an explicit remaining Windows usability gate.

## Feature status

| Capability | Status |
|---|---|
| GPU 3D renderer with classic vanilla proportions | Implemented (browser-level code) |
| 64×64 skin PNG import and validation | Implemented |
| Steve/Classic and Alex/Slim arms, outer layers | Implemented |
| Idle, walk, run, wave, sit, jump, think, celebrate | Implemented as procedural animations |
| Head tracking and per-skin pixel-aligned eye edits | Implemented; manual calibration needed |
| Frame-rate adaptation (active 60, idle ~18) | Implemented; not hardware-benchmarked |
| Tauri overlay, native drag, tray menu, global click-through | Native implementation written, **Windows verification pending** |
| Genuine cross-window collision physics / window sitting | Planned v0.2; preview `Sit` is a pose |
| Automatic window monitoring | Not implemented |
| AI/chat/Ollama | Not implemented (planned v0.3) |
| Screen viewing/vision | Not implemented (planned v0.4) |
| Agent actions | Not implemented (planned v0.5) |

## Engineering principles

- All vanilla movement is driven from one deterministic `BehaviorController`.
- The original imported skin image remains unmodified; expression textures are derived temporarily in a canvas.
- No remote script, CDN, telemetry, or API call.
- The native Rust shell exposes three tightly scoped commands: toggle whole-window click-through, drag the avatar window, open the workshop.
- Uploaded PNG texture size is capped at 2 MB, with magic-number and 64×64 validation.
- No OS process enumeration, accessibility grants, screenshot permissions, shell commands, or arbitrary file-system access.
- Per-user preview settings live in `localStorage` under `zpkdx-avatar-v0.1`. It can be cleared through browser storage controls.

## Tests

```powershell
npm run check
```

Tests use Node's built-in runner without dependencies. The current suite covers skin size/signature, UV geometry, Classic/Slim rigs, animation priorities/timeouts, gaze clamping, and matrix transformations. See `docs/RELEASE_GATES.md` for missing Windows/runtime acceptance tests.

## Repository map

```text
web/
  index.html, css/app.css
  js/engine/renderer.js, mat4.js    # minimal WebGL2 / 3D pipeline
  js/avatar/rig.js, animation.js    # vanilla cuboids, state machine
  js/avatar/eyes.js, skin.js        # facial texture and PNG validation
  js/main.js                        # independent workshop / overlay UI
  assets/sample-skin.png            # illustrative local sample
src-tauri/
  src/lib.rs                        # native tray/overlay commands
  tauri.conf.json, capabilities/    # desktop app configuration
assets/reference/ZpkDxGames-pfp.png # provided visual reference (not skin)
docs/PROJECT_CHARTER.md             # primary long-term product specification
docs/ANIMATION_SPEC.md
/docs/RELEASE_GATES.md
```

No claim is made that the provided profile picture can be converted accurately into the original 64×64 skin texture.

## GitHub repository

Development repository: <https://github.com/ZpkDxGames/AI-Desktop-Companion>.

This repository holds an **alpha source preview**, not a production or certified Windows desktop release. Clone normally with `git clone https://github.com/ZpkDxGames/AI-Desktop-Companion.git`.

A lightweight Windows GitHub Actions workflow (`.github/workflows/check.yml`) runs `npm run check` on pushes and pull requests. Native Tauri certification is not included in this workflow yet.
