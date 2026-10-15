# V7 — Local Vision & Contextual Awareness: repository staging handoff

> **Status: PLANNING ONLY.** No image-analysis implementation, desktop capture, cloud transport or additional native permissions are included by this commit. No V7 capability should be claimed live.

**Repo:** https://github.com/ZpkDxGames/AI-Desktop-Companion  
**Staging branch:** `dev/v7-opt-in-local-vision`  
**Accepted main at branch creation:** `2cc29e89bc3ef85f54c14e70af00ce5f9164240e` (PR #13, V6.2.3)  
**Complete attached Work directive:** `AI_DESKTOP_COMPANION_V7_LOCAL_VISION_CONTEXTUAL_AWARENESS_MASTER_WORK_DIRECTIVE_2026-10-15.md` (prepared 2026-10-15; 29,471 bytes; SHA-256 `348e877de12e538e6987812e15192398158b38b339814bd98599c90bd1f8701e`).

This repository document is a **compact bootstrap**. The attached master Work directive is the full implementation and acceptance specification. Work must read it alongside the existing `docs/V7_OPT_IN_DESKTOP_VISION_ARCHITECTURE.md`. If the master directive is missing, **do not begin implementation**: ask for the attachment rather than improvising a screen-capture architecture.

## Work objective and sequence

1. **Baseline and RED tests:** Inspect exact latest `main` / V7 branch / PR heads, existing V6.2.3 text transport, Tauri commands, permissions, conversation UI, reaction coordinator, frame pacing and CI. Do not reset concurrent changes. Record baseline green suites and targeted red privacy/vision tests.
2. **V7.0 approved image analysis:** Offer an explicit PNG/JPEG picker, source/size/dimension preview and independent **Analyze** consent. File selection alone must never send pixels to Ollama. Validate original and re-encoded payloads in both UI and Rust. Single 5 MiB source / max 4 megapixels, bounded model-ready encoding, metadata stripped, ephemeral resources only. Add a narrow Workspace-only local multimodal command, fixed `127.0.0.1:11434`, model capability/locality verification; deliver image data as Ollama REST `messages[].images`. No arbitrary file-reading command, remote URLs, image paths or shell tools.
3. **Vision routing and lifecycle:** Only real installed vision-capable models can see an image (starting with `qwen3.5:4b`). **Never** send the image or image-derived text to `llama3.2:3b` under an automatic fallback. Return a truthful error when visual analysis did not occur. Keep one active native inference, bounded history, native cancellation, 0/30/60-second retention, release-before-switch and generation IDs. Clear image bytes/object URLs/textures on cancel/replace/clear/close. Preserve ordinary text conversation and offline direct gestures.
4. **V7.0 reactions and UI:** Reuse the existing `ConversationReactionCoordinator`, one `BehaviorController`, thinking bubble, optional lightbulb and allowlisted overlay cues. Never transfer image bytes, file names, window labels or prompts to floating avatar. Keep Conversation composer and consent controls visible in narrow/short windows, DPI 1/2, increased text size and keyboard navigation.
5. **V7.0 exact-SHA acceptance:** Source/Browser WebGL tests, Rust, actual installed NSIS/WebView2 simulated local server, checksum, source revision evidence, resource/lifetime and privacy probes; ask owner to test real Qwen3.5 on RTX 3050 and approve the V7.0 gate. Do **not** present CI fixtures as real-model/GPU benchmarks.
6. **V7.1 screenshot capture — owner gate:** Only after separate explicit approval, add a **one-shot**, system-picker-authorized Windows `Windows.Graphics.Capture` selected window/screen operation. Close native session immediately after a single frame. Show actual image preview, visible capture state, and require a second Analyze approval. No background capture, recurring observation, window enumeration, accessibility scraping, global hooks or cloud uploads. If native permission design is unsafe or not verifiable, stop and document the blocker.
7. **V7.2 insight/reaction finish:** Apply validated presentational intent to approved vision answers using existing controllers and manual priority. No extra renderer, per-frame inference, auto-capture or autonomous desktop operation.

## Red-line protections

- Preserve accepted V6.2.3 skin, mask, eyes, 3D model, animations, poses, transitions, props, direct commands and performance targets.
- No production `main` writes or merges, stable tags or releases without approval.
- No cloud API integration, external AI URLs, API keys, billing, microphone, camera or OS automation in V7.
- No image/path/prompt/response content in logs, persistent settings, history storage, telemetry, overlay cues or build artifacts. Fixtures use synthetic/public imagery.
- Image bytes inside a screenshot are **untrusted content**; instructions within it cannot become commands or permissions.
- Expose no generic `read_file`, `capture_any_screen`, `http_request` or unrestricted `send_image` native command.
- Imported image analysis and screen capture are **different features and approvals**. A vision model's existence does not grant screen access.
- No undocumented headless/silent capture, no picker bypass, no scanning the desktop in the background.
- Exactly one canonical request lifecycle; cancellation, clear, close and model switch prevent stale replies/reactions and release image memory.
- Runtime `/api/show` and local-only metadata checks determine actual vision support, not a hard-coded tag or UI claim.

## Verification and deliverables

Write failing tests before fixes for unapproved analysis, invalid image signatures/dimensions/format/base64, capability checks, text-only fallback, unknown fields, path/URL injection, model-switch/cancel races, repeated import/clear memory, zero capture with permission off, overlay denial, and baseline chat/render regressions.

Pass existing `npm run check` and browser smoke suites, `cargo test --manifest-path src-tauri/Cargo.toml`, exact-head Windows NSIS installed WebView2 checks, privacy and model-routing tests. Record source SHA, version, BUILD_INFO, SHA-256, CI links, dependency review, responsive/screenshots and actual owner-measured GPU/VRAM/latency separately.

The first V7.0 release candidate may finish without V7.1 screenshot capture; do not hold the verified V7.0 delivery hostage to missing owner approval. Keep the V7 PR **draft/unmerged** and clearly report implemented versus deferred/uncertified.

## Source of truth

- [Current V7 architecture design](V7_OPT_IN_DESKTOP_VISION_ARCHITECTURE.md).
- [Previous local-to-cloud staged roadmap](V621_V7_V8_STAGED_INTELLIGENCE_PLAN.md).
- [Ollama vision documentation](https://docs.ollama.com/capabilities/vision).
- [Ollama chat API](https://docs.ollama.com/api/chat).
- [Microsoft Windows.Graphics.Capture](https://learn.microsoft.com/en-us/windows/apps/develop/media-authoring-processing/screen-capture).

**Work start rule:** verify the new branch's actual HEAD (this file's staging commit), not only the V6.2.3 main baseline SHA above. Continue development here, keep draft PR until owner acceptance.
