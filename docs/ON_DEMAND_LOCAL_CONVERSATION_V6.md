# V6 — On-Demand Local Conversation

**Repository:** https://github.com/ZpkDxGames/AI-Desktop-Companion  
**Branch:** `dev/on-demand-local-conversation-v6`  
**PR:** https://github.com/ZpkDxGames/AI-Desktop-Companion/pull/12 (draft)  
**Foundation:** merged V4/V5 `main` SHA `e9e26be08e1dc975239fa409ccedbe5330578ce9`.

## Delivered in this milestone

The Conversation page now provides explicit **Connect to Ollama**, model selection, Send, Cancel reply, Clear session, and an optional existing-avatar gesture toggle. An independently installed Ollama server is required; no AI model is bundled, installed, started or contacted at app startup.

The model is reached **only** through `http://127.0.0.1:11434`: user-requested `GET /api/tags` and `POST /api/chat`. Structured local model results contain text and an optional suggestion from `wave`, `nod`, `think`, `celebrate`, `look`. Model text never executes tools. Gestures run only when the avatar is idle, the setting is enabled, and the existing BehaviorController accepts the requested action. Conversation does not install a competing animation controller.

## Privacy, performance and security

- No remote URL, credentials, external API provider, file access, shell execution, desktop/window observation, screenshots, microphone, tool calls or autonomous model invocation.
- A narrowly scoped CSP addition permits `http://127.0.0.1:11434` as a connection destination; **no additional Tauri native permissions**. This is an explicit local network capability, not a permission to connect anywhere.
- Models are enumerated only after Connect; no inference is made until Send. The app does not auto-connect on reload. Model content is always inserted into the DOM through `textContent`, never untrusted HTML.
- Chat is stored **only in memory**, capped at six recent user/assistant turns; text is erased by Clear and is never written into `localStorage`. Only a validated model name and the optional-gesture setting persist.
- Local request timeout (120 seconds), model list timeout (9 seconds), cancellation and size limits. Models are requested with a 30-second local keep-alive; the external Ollama process manages actual GPU resources.
- The original V4 motion rig, 17 actions, eyes, V5 personality policy, active/idle 60/20 FPS frame pacing, Workspace and overlay remain unchanged.

## Setup on the user's Windows computer

1. Install and run [Ollama](https://ollama.com/), and install a **local** chat model using its own command-line/application instructions. Example: `ollama pull llama3.2:3b` where available.
2. Verify `ollama list` contains the model and the server is bound to localhost. Do not expose Ollama with `OLLAMA_HOST=0.0.0.0`.
3. Open Companion → Conversation → Connect to Ollama → select model → Send.
4. On Windows, Tauri WebView2 may originate from `http://tauri.localhost`. If connection is blocked by CORS, configure **that specific origin** with Ollama's `OLLAMA_ORIGINS`, restart Ollama and retry. Do not use universal `*` origins.
5. Gestures are disabled by default. Uncheck local model gestures at any time; manual animation controls and V5 automatic idle behavior work without AI.

Official API reference: https://github.com/ollama/ollama/blob/main/docs/api.md .

## Test gates

- `npm run check`: all V4/V5 regression and V6 transport/schema/cancel/privacy tests.
- Browser production smoke uses a **mocked localhost endpoint** to verify no background access, manual connect, text-only untrusted response display, session clearing, and no automatic reconnect after reload.
- Windows NSIS CI exact-commit unsigned installer, checksum and native trial pending.
- **Not certified:** real Ollama model inference on the owner's RTX 3050 / Win11 WebView2, actual Windows CORS, native GPU/CPU memory impacts, long-context quality, final owner acceptance.

## Explicitly not implemented

Streaming output, voice, tool use, provider keys, cloud chat, semantic/vector memory, autonomous conversation initiation, desktop awareness, app/window edge interaction, browsing, external data or background monitoring. Future expansions require new authorization and their own privacy/latency/security acceptance.
