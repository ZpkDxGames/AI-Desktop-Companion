# V6.2.1 direct animations + staged V7/V8 AI strategy

Repository: https://github.com/ZpkDxGames/AI-Desktop-Companion
Draft PR: https://github.com/ZpkDxGames/AI-Desktop-Companion/pull/13
V6.2 baseline: 2379d9c29ef44001a7ee386aaf214b80fde9caef
Accepted main foundation: e73541b6cf067d0185d1f987720b9194d9b4c6b9

## V6.2.1 immediate correction
- No-network, conservative detection of short explicit gesture requests like "Can you shake your head?" Negations, quotations, meta-questions and compound requests fall back to normal chat. One complete phrase only.
- User-requested gestures count as manual commands and are not controlled by the optional *AI-suggested* gesture toggle. One existing BehaviorController continues to own animations and spring continuity.
- No Ollama inference for direct commands; these also work without connecting to the model. Static confirmation is shown only if the controller accepts the command.
- When Ollama does answer, carefully selected opening words can ground agreement, disagreement and uncertainty rather than trusting unreliable reaction labels entirely. Replies never execute tools.
- Native floating overlay receives allowlisted action IDs only; no prompt or raw response crosses the cue channel.
- Local Ollama stays fixed at 127.0.0.1:11434. No screenshot capture, cloud API, new permissions, or persistent conversation history.

## V7: explicit local desktop vision — deferred
1. User manually selects screenshot or window; show target and image preview, require consent *before* any analysis. No continuous capture, background observation or accessibility scraping.
2. Narrow native Tauri capture bridge with validated pixel dimensions, size, format and lifecycle. Screenshots stay volatile in memory and never become logs or saved files.
3. Route approved images only to capability-checked installed Ollama vision models (e.g. qwen3.5:4b). Llama 3.2 3B is text-only; never pretend it saw images.
4. Reuse request cancellation, thinking/lightbulb effects, the single BehaviorController and existing 60/20 FPS scheduling.
5. Certify real RTX 3050 8 GB GPU load and FPS, high-DPI/multi-monitor correctness, privacy, cancellation, model-unavailable paths and owner consent.

## V8: provider-independent backend and eventual cloud-first release — deferred
- Design a bounded AssistantProvider contract: capabilities, model catalog, text completion, approved image analysis, cancel, normalized errors. Separate model transport from reactions and avatar rendering.
- Keep Ollama available as offline/private fallback. Cloud defaults off until explicit user opt-in; never silently upload screens.
- Keys must be stored in Windows credential storage or secure backend, never in the WebView, localStorage or source repository. Audited HTTPS domains only.
- Enforce per-provider RPM, TPM, tokens, concurrency, image-size and user-configured advisory cost budgets; handle Retry-After and bounded backoff. Provider-side spending settings backstop costs. Avoid promises of perfect hard caps.
- Only select cloud providers/models later after benchmarking real price, capabilities, latency and data-handling policies.
- No deployment, cloud credentials, continuous monitoring, or API charges are authorized by this plan.

## Certification and release
Run unit/regression tests, production browser/WebGL checks, native Windows installer CI at exact commit and SHA-256. Check commands with actual owner skin and models. Keep PR #13 in draft; do not merge without the owner's explicit acceptance.
