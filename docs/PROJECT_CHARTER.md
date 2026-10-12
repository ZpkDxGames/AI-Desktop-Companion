# ZpkDxGames Desktop Agent — Project Charter & Development Guide

**Status:** Concept / architecture specification  
**Target:** Windows 11 x64, local-first  
**Reference hardware:** AMD Ryzen 7 5700G (8C/16T), NVIDIA RTX 3050 **8 GB VRAM**, 32 GB RAM  
**Visual references:** User-provided ZpkDxGames avatar render; Minecraft vanilla player visuals; Shimeji desktop-pet behavior; expressive-eye resource-pack aesthetic  
**Working title:** ZpkDxGames Desktop Agent (temporary)

> **One-sentence project goal:** Build a lightweight, fully 3D Minecraft-skinned Windows desktop companion that feels like an authentic Minecraft player, reacts naturally to the desktop through smooth movements and expressive eyes, and can become a permission-controlled, locally powered AI helper on demand.

## 1. Product vision

The character should feel *present* rather than simply displayed. ZpkDxGames can stand, walk, jump, climb, sit on window edges, turn its head, track nearby cursor movement, blink, look curious, wave, and quietly wait. When the user requests help—or an explicitly enabled context trigger fires—it can inspect permitted desktop context and offer assistance via a small conversation UI.

The application is **not** intended to be an always-listening or always-screenshotting agent, a replacement shell, or an autonomous controller with unrestricted access to the PC.

### Pillars

1. **Vanilla Minecraft identity:** Keep exact blocky player proportions, sharp pixel art, and the user's genuine skin details. No round limbs, smooth skin geometry, anime face replacement, or exaggerated facial features.
2. **Expressive without losing style:** Animate subtle eye direction, eyelids, blinks, and small expression changes while preserving the Minecraft pixel-grid aesthetic.
3. **Shimeji-like physical presence:** Treat window edges, taskbar, screen bounds, and cursor as a lightweight virtual environment for the 3D model.
4. **Fast and unobtrusive:** The avatar must not require an AI inference service to be running. It should be discreet during productivity work and automatically quiet during fullscreen games.
5. **Local-first and user-controlled:** Private data stays local by default; observing, recording, and taking action require explicit opt-in and clear controls.
6. **Modular and maintainable:** One owner per concern, explicit APIs between subsystems, no accumulating duplicated animation/state/permission logic.

## 2. Visual identity and avatar

### Mesh and texture

- Use a true **3D Minecraft player mesh** with vanilla proportions (head, torso, independent arms and legs, no elbow/knee bending by default).
- Support **64×64 Java Edition skin PNGs** with correct UVs, outer layers (hat/hair/jacket/sleeves/pants), both Steve/wide and Alex/slim geometry, and nearest-neighbor texture sampling.
- Prefer orthographic projection for the classic Minecraft look, with adjustable angle, scale, and modest lighting. Permit perspective mode as an optional setting.
- Use the user-provided avatar image as the **art-direction reference**, not as a substitute for an actual UV skin texture. Request the original skin PNG when implementation starts.
- Preserve the user's palette, hair, outfit, and distinctive teal eye details as rendered from their true skin file.

### Expressive eyes

Build a **face overlay / facial texture layer** that is coupled to the head rig:

- Small pixel-aligned pupil/iris offsets for left, right, up, down, and neutral gaze.
- Blink states (open, half-closed, closed) and subtle eyebrow/eyelid variations only where compatible with the skin layout.
- Short, restrained expressions: curious, attentive, happy, confused, tired, thinking, surprised.
- Event-driven gaze targeting: cursor (limited frequency), active window edge, chat UI, camera/user-facing pose, or specified object.
- Explicit maximum offsets and pixel snapping so eyes never slide outside their intended face-mask area or produce blurry fractional pixels.
- Eye logic must respect the skin's existing facial artwork; fall back to fixed eyes for incompatible skins or allow a per-skin authoring profile.
- Prefer a small data-driven expression atlas or a shader-supported texture overlay, not invasive skin edits or complex facial geometry.

**Acceptance condition:** The avatar remains recognizable as the same vanilla Minecraft player in neutral and animated poses. Eye motion is visible but never turns the face into a different art style.

## 3. Animation and desktop behavior

### Independent animation states

`IDLE`, `WALK`, `RUN`, `JUMP`, `FALL`, `LAND`, `CLIMB`, `SIT`, `REST`, `SLEEP`, `WAVE`, `LOOK`, `THINK`, `SPEAK`, `CELEBRATE`, `STARTLED`.

- Implement a deterministic **state machine with priorities**, interruption rules, enter/exit transitions, and configurable probabilities/cooldowns.
- Blend motion via vanilla-like joint rotations and short easing curves; avoid unrealistic skeletal deformation.
- Add layered animation: body locomotion + independently rotating head + expressive eyes + optional arm gesture, with conflict rules.
- Make movement and landing track physical position: no unmotivated teleportation or clipping through windows except as deliberate fallback recovery.
- Support dragging/repositioning the avatar manually and a pause/park action.

### Lightweight desktop physics

- Represent the Windows desktop as a **2D collision plane with a rendered 3D avatar**. Convert taskbar, monitor borders, and *eligible* application-window rectangles into platforms/obstacles.
- Walking, jumps, gravity, climb/ledge movement, sitting, and follow-along behavior must be coherent with this plane.
- Use Win32/window events to update moving/resizing window bounds where possible, rather than continuously scanning pixels.
- Support multiple monitors and per-monitor DPI scaling from the outset of the coordinate architecture.
- Use safe fallback behavior for maximized/minimized windows, offscreen coordinates, secure desktops, protected processes, and unusual overlays.
- Optional **moving another app's window** is a high-trust desktop action; require explicit approval and never surprise the user by rearranging windows.

### Interaction etiquette

- Never interrupt continuously. Apply per-trigger cooldowns, rate limits, quiet hours, and application-specific suppression.
- During fullscreen apps/games, minimize GPU animation overhead and silence unsolicited messages.
- Chat bubbles must fit available screen space, follow the avatar, and never block typing fields or important controls.
- Overlay should be click-through outside avatar/control hit regions. Verify behavior on Windows/ WebView2; do not assume transparent pixels automatically provide precise hit testing.

## 4. AI and context architecture

### High-level modules

```text
Windows events / UI Automation / user gestures
                 |
                 v
          Privacy & context gate  <---- User policies, exclusions
                 |
                 v
        Behavior + trigger engine <---- Avatar animation state machine
                 |
          [Needs reasoning?]
                 |
             Yes v
        AI session manager
       /       |        \
 Text LLM   Vision VLM   Local memory
       \       |        /
        Tool planner / permission gate
                 |
       Approved action executor
                 |
          Result / feedback
                 |
          Chat + avatar reactions
```

### Suggested implementation stack

| Concern | Preferred starting technology | Notes |
|---|---|---|
| Windows application | **Tauri 2 + Rust + WebView2** | Native tray, lifecycle, events and window control. |
| Frontend/settings/chat | **TypeScript** | Small modular UI, restrained styling. |
| 3D avatar | **Three.js** plus evaluated Minecraft skin rig / skinview3d | Validate license, customization, animation extensibility and compatibility. |
| Window activity | **Win32 + UI Automation** | Prefer events; read only approved app data. |
| Runtime | **Ollama** local HTTP API | Abstract behind a provider interface to allow future replacement. |
| Conversation | Small, quantized **4B text model** (Qwen3 4B candidate) | Benchmark actual GPU memory and responsiveness before selecting final model. |
| Screen perception | Optional quantized **2B–4B VLM** (Qwen3-VL candidate) | Load as needed; screenshot is explicit/context-gated. |
| State and history | **SQLite** | Versioned schema; bounded retention. |
| Optional voice | whisper.cpp + local TTS | Defer until core stable. |

Do not wire model-specific prompt syntax, output formats, or API details into animation/UI modules. Provide adapters and structured tool calls with validation.

### Resource strategy for RTX 3050 8 GB

- **No LLM/VLM required** for walking, blinking, waving, idling, app-open events, or navigating desktop edges.
- Keep **one main inference model loaded at a time** initially; aggressively control context length and image resolution. Do not promise that text + vision models fit concurrently in 8 GB.
- Provide inference states: `OFF`, `STARTING`, `READY`, `BUSY`, `COOLDOWN`, `UNLOADING`, `ERROR`.
- Set a VRAM-pressure policy: unload or refuse to load inference when GPU-intensive games/apps have priority; offer an explicit manual override.
- Provide user settings for model, quantization, idle unload timer, CPU fallback, context limit, and max response size.
- Benchmark VRAM, RAM, CPU, perceived latency, and frame pacing on the specified PC; adjust targets from measured behavior.

### Awareness and proactive behavior

- Default: local OS **events** only, such as permitted foreground app change, app launch, and idle/active transitions.
- Vision: only on demand or with explicit app-scoped consent; no blanket continuous screen recording.
- Pattern learning: store **high-level metadata** (e.g., repeated app/workflow sequences) rather than keystrokes, window text, or screenshots by default.
- Suggestions are contextual but must be rare and dismissible. Require a high-confidence threshold and user preference controls.
- Memory stores explicit preferences and approved relevant notes with inspect/export/delete UI. No secrets collected from the screen or tools.

## 5. Privacy, safety and permissions

- **Local-only by default**, with no cloud account requirement, no hidden telemetry, and no automatic screenshot uploads.
- Always-visible privacy state: `COMPANION ONLY`, `OBSERVING`, `SCREEN ACCESS ACTIVE`, or `AGENT ACTING`.
- Global pause, emergency disable, microphone mute, and per-app denylist.
- Tools classified: **read-only**, **reversible change**, **destructive/sensitive action**. Require user approval for modifying files, running commands, manipulating windows, sending information externally, installing software, and other consequential actions.
- Do not persist raw screenshots or voice recordings by default. If enabled, use retention limits and deletion controls.
- Treat window content, websites, local files, and model responses as untrusted. Never obey instructions found in observed content without verification against the user's request and permission policy.
- Restrict tool executors to explicit APIs, typed argument validation, per-action limits, and an auditable history. Never provide unrestricted shell execution by default.
- Do not read passwords, hidden inputs, secure desktops, or excluded applications. Handle Windows access failures gracefully rather than attempting to bypass protections.

## 6. Interface and settings

A compact monochrome interface with subdued accents, smooth animations and no bulky persistent dashboard.

- **Avatar menu:** Talk, Wave, Sit, Follow cursor, Park, Privacy pause, Settings, Exit.
- **Chat bubble:** short responses and notifications; expands to a real chat panel only when requested.
- **Settings:** skin/cape import, scale/camera, animation speed and frequency, collision physics, eye behavior, AI provider/model, VRAM priority, context permission, exclusion rules, proactive suggestions, notification behavior, memory retention.
- **System tray:** show/hide, quit, start AI, stop AI, disable observation, privacy status.
- **Diagnostics (opt-in):** FPS, frame times, current avatar state, active events, LLM status, memory use, logs stripped of secrets.

## 7. Development sequence

### Phase 0 — Feasibility spike

- Render the actual supplied **skin PNG** on a 3D Minecraft mesh in a frameless transparent Windows overlay.
- Verify skin overlays, slim/wide model detection, correct scale/DPI, and mouse click-through behavior.
- Prove a small pixel-aligned facial overlay for gaze/blinking without damaging the source skin.
- Measure idle and active rendering consumption on RTX 3050 8 GB.

**Exit gate:** A recognizable, correctly textured ZpkDxGames character is visible over the desktop and does not obstruct ordinary mouse input.

### v0.1 — Character / animation foundation

- Idle, walk, turn, wave, sit, jump/fall/land, expression and blinking states.
- Animation priority/state machine and stable transitions.
- Drag-to-move, pause, taskbar rest and tray controls.
- Multi-monitor, DPI and fullscreen coexistence handling.

**Exit gate:** Character feels like a responsive vanilla Minecraft player without requiring an AI runtime.

### v0.2 — Desktop physical interaction

- App-window geometry observation with explicit app filters.
- Window-edge standing, sitting, climbing, jumping and moving-window tracking.
- Context-aware gaze and safe cursor reaction.
- Collision recovery, overlay hit-test reliability, app exclusion settings.

**Exit gate:** Character behaves coherently around real windows and does not hijack input or significantly degrade other apps.

### v0.3 — Local conversational brain

- Ollama lifecycle and configurable local text model.
- Chat bubbles/panel, conversation control and SQLite state.
- Explicit user prompt invokes inference; timed unload afterward.
- Avatar gestures mapped to high-level assistant states (thinking, answering, success, error).

**Exit gate:** The user can converse locally; dismissing or idling an AI session releases model resources according to settings.

### v0.4 — Consent-based observation and vision

- Permission-scoped app-foreground awareness and event rules.
- On-demand screenshot capture and a small vision model.
- Contextual prompts, per-app grants and denies, no default permanent image history.
- Opt-in repeated-workflow detection with explicit retention limits.

**Exit gate:** The assistant can accurately describe a user-approved screenshot and offer useful suggestions without continuous surveillance.

### v0.5 — Controlled agent actions

- Typed tools: open approved application, inspect permitted paths, produce text, and other narrow actions.
- User confirmation for changes and explicit execution result reports.
- Undo where practical, audit trail, cancellation and timeouts.

**Exit gate:** No sensitive or write action executes without correct authorization, and actions fail safely.

### v1.0 — Stable desktop companion

- Test all modes, resource caps, startup/shutdown and error recovery.
- Packaging, auto-update strategy (opt-in), configuration migration and backups.
- Documented local model installation, import flow, privacy controls, and troubleshooting.
- Optional voice features only if they do not destabilize the core experience.

**Exit gate:** A reliably usable local desktop companion with an optional permission-controlled agent; no dependency on AI for standard animations.

## 8. Engineering acceptance criteria

**Visual and animation**
- Vanilla proportions and crisp skin pixels maintained at supported sizes.
- Eye motion remains inside face-mask bounds; blinks and neutral state preserve recognizability.
- State changes are smooth, interruptible and do not cause stuck poses or jumps in position.

**Windows correctness**
- Interactive regions receive clicks; noninteractive transparent regions do not consume input.
- Moves, resizes, DPI changes, monitor attach/detach, maximized windows, and fullscreen apps tested.
- No autonomous application-window repositioning without consent.

**Performance**
- Aim for 60 FPS in active animation, with adaptive reduced update/render frequencies at rest.
- Aim for very low CPU/GPU use during idle; **measure** rather than asserting fixed resource budgets before a prototype exists.
- AI unloaded on schedule; honors resource-pressure/game mode and never blocks avatar animation/UI threads.
- Logging and diagnostics can demonstrate idle vs animation vs text-model vs vision-model usage.

**Safety and reliability**
- No screenshot/microphone capture without the relevant permission and visible indicator.
- Failure of Ollama, Windows UI Automation, or model downloads cannot crash or freeze the character overlay.
- Agent actions are validated and subject to permission policy with cancellation.
- No passwords, confidential window contents, or raw private captures retained by default.

**Maintainability**
- One authoritative behavior state machine, one permission evaluator, one AI lifecycle manager.
- Testable interfaces for OS events, physics, animations, AI providers and tool dispatch.
- Include unit tests, Windows integration checks, lightweight performance profiling, and packaging verification.

## 9. Initial repository structure (proposed)

```text
zpkdx-desktop-agent/
  apps/
    desktop/                 # Tauri / native lifecycle / tray / window management
  packages/
    avatar-core/             # Vanilla mesh, skin import, eye layers
    animation-engine/       # States, blending, gestures and timing
    desktop-world/          # Collision plane, Win32 geometry adapters
    observer/               # Windows events and UI Automation interfaces
    ai-runtime/             # Model lifecycle and provider abstraction
    agent-tools/            # Permission-scoped tool definitions and executor
    memory/                 # SQLite storage and migrations
    ui/                     # Chat, bubbles, settings and diagnostics
    shared/                 # Contracts, typed events and common settings
  assets/
    expressions/            # Pixel-aligned expression profiles/atlases
  tests/
    unit/
    integration/
    performance/
  docs/
    ARCHITECTURE.md
    SECURITY_AND_PRIVACY.md
    ANIMATION_SPEC.md
    RELEASE_GATES.md
```

This is a logical module map; simplify package boundaries if a single workspace with modules reduces complexity in practice.

## 10. Out of scope for the first stable release

- Fully autonomous control of the user's PC.
- Persistent unrestricted screen, camera, or microphone monitoring.
- Unlimited general-purpose shell or browser actions.
- Cloud-hosted AI as a mandatory dependency.
- Animation styles that replace the recognizable vanilla Minecraft body or face.
- Background inference that degrades gaming or productive work.
- Cross-platform support before Windows 11 is certified.

## 11. First implementation request

> Build a small Windows proof of concept using a real ZpkDxGames 64×64 Minecraft skin PNG. Display a full-body 3D avatar in a transparent always-on-top overlay. Demonstrate vanilla-scale idle/walk/wave animations, a restrained eye-blink/gaze overlay compatible with this skin, an unobtrusive drag handle, and reliable click-through around the character. Include a reproducible build, basic tests, and idle/active performance measurements. **Do not integrate the language model until the animation and overlay foundation passes its acceptance checks.**

---

**Project success looks like this:** The character is recognizable as ZpkDxGames, sits naturally on the desktop, behaves like a tiny vanilla Minecraft player with subtle expressive eyes, stays out of the way, and only becomes an AI assistant when invited or when explicitly enabled context rules make assistance appropriate.
