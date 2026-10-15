# V6.2.3 development candidate — reaction fidelity and bounded local retention

## Authority and baseline

Owner directive dated 2026-10-14. Verified live development HEAD `2a130c93e20c2798f677418433d723a7a2e58808`, accepted main `e73541b6cf067d0185d1f987720b9194d9b4c6b9`, open draft PR #13 targeting main. Clean checkout; no AGENTS.md found. Main, branches, animation engine and renderer remain unchanged. Version is `0.1.0-alpha.6.2.3`. Use the exact installer BUILD_INFO and final external certification supplement for the final SHA and run links; this source document does not claim a yet-unfinished CI run passed.

Baseline: `npm ci --no-audit --no-fund`, `npm run check`: 167 tests passed, production bundle built. Test-first commit `12a7c23a4fee0ee0b6dcdc67b2185910e4709af1` (local red snapshot `1f0ece2`) intentionally adds failing regressions before fixes: natural structured agreement becomes neutral; repeated eligible agreement does not restart nod after 15 seconds; rejected dispatch has no reason; lifecycle reason trace absent; opt-in retention remains zero. Five failures / 29 tests in the red run. Controller rejection already did not poison cooldown; that invariant is preserved and tested, rather than misreported as a pre-existing bug.

## Producer-to-renderer fixes

- `command-intent.js`: inspect the complete 2,000-character bounded reply by speaker-stance clauses, with conservative quote, hypothetical, meta-language, negation and capability guards. Validate model labels; ground familiar natural endorsements, negative corrections, uncertainty, ideas and restrained social reactions. Textual contradiction corrects the hint. Supported insight candidates can survive without a narrow opening formula. This is deterministic English interpretation, not general semantic intelligence: unsupported phrasing can remain neutral. No new inference/classification call.
- `reaction-coordinator.js`: remove the persistent last-label latch. Keep the existing 12-second per-intent throttle and independently inspect whether the same controller action is still playing. A fresh answer can start another nod after cooldown without a neutral answer. Only accepted dispatch or actually started insight effect updates cooldown and applied intent. Explicit reaction allowlisting precedes action-map lookup, including inherited object-property negatives. Finite reason codes and a 32-entry session-only content-free trace distinguish classification from intentional suppression. No timer, queue or frame loop added.
- `main.js`: preserve manual priority and do not flatten its candidate to neutral before arbitration. Refuse automatic dispatch while the seat transition would defer it; manual seat behavior is unchanged. Relay only the applied intent. A neutral answer-completion cue still terminates the remote thinking bubble; it carries no rejected hint. Request/TTL/sequence allowlists and replay checks remain. DOM diagnostic attributes/title expose model/chosen/applied intent, reason, action and completion-to-dispatch time; overlay exposes reception and actual controller action without chat text. No gesture setting is enabled silently.
- `local-conversation.js` / `ollama.rs`: finite retention choices Off/30/60 seconds in both paths, completion wall time plus available Ollama load/generation durations. Native results return content and telemetry; legacy fixture strings remain supported by JS. Fixed loopback, no proxy/redirect, local metadata, role/byte limits, one native active slot and targeted cancellation stay intact. Before a retained-model replacement/fallback, unload the previous validated model via fixed `/api/generate` with no prompt and keep_alive 0, within the same cancellable request slot. Release failure blocks replacement; no second model is loaded by this flow until release succeeds.
- The existing UI gains only a retention selector inside Reply preferences and a content-free diagnostic title/attributes. No CSS, animation rig, eye, shader, skin, keyframe, duration, spring, prop, idle policy or frame scheduler changes.

## Retention choice and lifecycle

Default remains **Off**, because actual 8 GB RTX 3050 measurement is unavailable. **Short (30 seconds)** is the first owner trial; **Balanced (60 seconds)** permits a longer trial. These are opt-in, finite settings, not a claimed measured safe default or indefinite residency. The Ollama retention duration is server-owned; no per-message app expiry timer is needed.

Cancel, Clear, hidden/closed Workspace, timeout and model preference change stop/discard inference through existing cancellation/generation protection. They do not start a separate unloading/background request. The last retained model expires after its selected server idle retention; model change unloads it before the next selected-model inference. App shutdown likewise relies on that bounded expiry. Cancel still closes the inference HTTP task; residency and inference are distinct. If Ollama is offline, expiry/release depends on Ollama's behavior, not a fabricated app progress indicator. A previously retained model remains tracked through a cancelled Off attempt, so subsequent switching can still release it.

Ollama API documentation: https://github.com/ollama/ollama/blob/main/docs/api.md — keep_alive controls residency; an empty generation request with keep_alive 0 unloads a model. This operation contains no conversation input.

## Fixed labeled corpus comparison

39 manually labeled English examples: 23 non-neutral targets and 16 neutral hard negatives. Micro counts exclude neutral from positive-label precision/recall; a wrong non-neutral label counts as both FP and FN for its respective labels. Baseline: TP 10, FP 5, FN 13, TN 14, precision 66.7%, recall 43.5%. Candidate: TP 23, FP 0, FN 0, TN 16, precision/recall 100% **on this fixed test corpus only**. Tests cover structured and neutral/missing hints, formatting, legacy metadata, contradictory labels and one additional structured-insight phrase. This is not evidence of 100% real Qwen/Llama language accuracy. False negatives on unrecognized language remain preferable to incidental gestures.

## Reaction verification matrix

| Case | Expected action / reason |
| --- | --- |
| Fresh agreement, enabled and idle | nod / accepted_and_started |
| Agreement while same action plays | none / already_playing |
| Agreement at 8 s after last accepted nod | none / reaction_cooldown |
| Agreement at 15 s, returned idle, no neutral answer | another nod / accepted_and_started |
| Disagreement, controller eligible | shake / accepted_and_started |
| Uncertainty, eligible | shrug / accepted_and_started |
| Idea, effects enabled | existing bulb / effect_only |
| Gesture toggle off | none / automatic_gestures_disabled; manual nod still works |
| Manual wave ownership/interruption | none / manual_action_priority |
| Controller refusal | none / controller_rejected; no cooldown, no accepted cue |
| Conditional, quote, invalid metadata, meta-language | none / neutral_or_no_supported_reaction |
| Cancel/stale/replayed answer | none / request_cancelled_or_stale or cross_window_cue_rejected |
| Expired reply | none / request_expired |
| Effects disabled | no bulb / effects_disabled |
| Hidden/closed window | no late action; lifecycle invalidated |
| Qwen failure → Llama | at most one final answer reaction; previous retained model released first |

Canonical WebGL smoke now sends real emitted-app conversation events, asserts controller dispatch, records three moving nod/shake/shrug frames and matching overlay semantics, repeats nod after cooldown, and verifies the disabled case. Existing fixed-pose pixel, original skin, eye, prop, expressive resource, reduced motion, layout, 125% text, DPI and motion tests remain. Installed Windows smoke uses the actual NSIS-installed WebView2 and Rust transport, validates finite retention rejection and switch release, repeated nod/shake/shrug/disabled delivery, one active inference and cancellation.

## Measurement and certification boundaries

`benchmark-local-models.mjs --fixture` measures 5 turns per model/mode (30 total) in a deterministic simulation (180 ms cold/5 ms warm load +20 ms generation). Installed smoke measures another 5 per mode through the native bridge. These validate request contracts and telemetry and must never be described as RTX/Qwen benchmarks. The non-streaming API measures complete-response latency; TTFB/first-token timing is not observed.

`node scripts/benchmark-local-models.mjs --real` is an explicit owner tool; it verifies both locally installed completion models, compares 0/30/60 for five turns each and records complete-response/load/generation timing plus Ollama model VRAM allocation when `/api/ps` supports it. It saves no prompt, answer or thinking content. It does not measure Nvidia frame pacing; record that separately on the owner device.

Local Linux source check passes. Local Chromium launch is blocked by environment socket permissions; Rust is unavailable locally. Full source/WebGL/native/installed Windows certification is delegated to the repository's existing exact-head CI jobs, not substituted with a label change or an old installer. Final supplement must report every final run status, installer digest and screenshots. If any gate fails or cannot run, keep PR draft and do not claim complete certification.

## Owner Windows 11 / RTX 3050 checklist

1. Install the exact unsigned development installer; check BUILD_INFO SHA and SHA256SUMS. Preserve your existing skin/settings. Verify accepted skin, eyes, props, transition smoothness and 60-active/20-idle policy.
2. Connect `qwen3.5:4b`. Enable Optional answer gestures manually. Ask an affirmative question and inspect the optional status tooltip if it does not nod. Repeat after at least 12 seconds and the prior animation finishing; no neutral response should be required.
3. Elicit real disagreement, genuine uncertainty and a useful idea; verify shake, shrug and lightbulb. Confirm quoted/hypothetical answers stay neutral. Verify the floating avatar follows accepted reactions.
4. Disable gestures, confirm no automatic nod/shake/shrug, then try `Can you nod?`. While a manual Wave owns the controller, verify a reply does not override it.
5. Compare Off to Short using five cold/follow-up turns each, then optional Balanced. Inspect `ollama ps`: no sustained app-created dual residency. Record Ollama version, model quantization, VRAM and frame pacing while inference is running. Revert to Off if pressure or pacing is unacceptable.
6. Switch Qwen → Llama → Qwen, test fallback/unavailability, cancel, Clear, hide/reopen and close the app. Verify targeted cancellation and no persistent bubble/stale reply; retained model expires within its server idle policy.
7. Verify 125%/150% Windows scaling, keyboard Send, focus, Latest messages and settings persistence. CI software WebGL cannot certify owner Nvidia GPU or display scaling.

PR #13 remains draft/unmerged. No production main update, cloud API, OS/screen capture or V7/V8 implementation. V7 consent-based local vision and V8 transport-neutral/cloud-primary migration remain later owner-approved roadmap work.
