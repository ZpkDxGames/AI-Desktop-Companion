# AI Desktop Companion V6.2.2 — implementation and acceptance report

Date: 2026-10-14. Candidate version: `0.1.0-alpha.6.2.2`.

Development branch: `dev/v6-2-expressive-dual-model-intelligence`.
Draft PR: https://github.com/ZpkDxGames/AI-Desktop-Companion/pull/13.

## Repository verification and scope

Before editing, Git and the GitHub connector independently confirmed development
HEAD `fd65cd81de1f69070989fdbc6c2ababfa42b81fa`, accepted main
`e73541b6cf067d0185d1f987720b9194d9b4c6b9`, and PR #13 open, draft, unmerged.
No branch replacement or force push was needed.

Changes are limited to the existing command parser, reaction coordinator, chat
bindings, local system prompt, Conversation HTML/CSS, relevant tests/scripts,
version metadata, and accurate Windows build provenance. The existing
`BehaviorController`, all avatar/engine modules, animation timelines, geometry,
eyes, props, physics, transitions, shaders, native Rust bridge and frame pacer
have no implementation changes. There is still one canonical controller and
one finite reaction coordinator per window, with no new rendering loop or AI
classification request.

## Traced defects and corrections

| Producer → consumer | Observed defect | Result |
| --- | --- | --- |
| Input → `command-intent` → `sendLocalChat` | Missing walk/run and stop families fell through to a text model | Anchored, bounded, allowlisted offline commands reach the real controller before inference |
| Controller → acknowledgment/cue | Locomotion can be rejected during a discrete action; seated requests can be queued | Only actual acceptance emits a direct cue; rejection is explicit; queued seat exit is acknowledged honestly |
| Pending chat → direct request | Disabled composer and busy guard prevented direct stop while waiting | Composer remains usable; explicit commands cancel the pending request and invalidate its generation; another text request cannot overlap |
| Request expiry → answer event | Expired replies could react before the frame sampler ran | Answer and loading handlers check expiry directly |
| Answer acceptance → floating avatar | Suggested reaction could be relayed despite Workspace rejection | Only an accepted reaction is relayed; refused, suppressed, repeated and disabled reactions are neutral |
| Reply opening → reaction hint | Quoted/conditional/capability text and words discussed as subjects could yield gestures | Narrow wording checks, validated labels and neutral fallback; no sentiment guessing or additional inference |
| Settings → history → composer | Parent panel and chat both scrolled; composer fell below a 600px viewport | Scoped flex layout with one message scroll owner and visible controls/composer |
| Append/eviction → history scroll | Every message forced the user to the bottom | Near-bottom following, eviction compensation and an accessible Latest messages button |
| Narrow navigation labels → page width | Absolutely positioned hidden labels expanded the page | Labels are contained by their existing navigation buttons |

Command parsing happens on explicit Send. Input events only update button state.
Ordinary offline text explains that Connect is needed; it does not invoke a
model, perform an action, or fabricate an answer. Connect is guarded against
concurrent catalog requests.

## Command contract

| Example | Behavior |
| --- | --- |
| Can you walk? / Walk for me / Show me how you walk / Start walking | Request canonical `walk`, offline |
| Can you run? / Show me how you run / Run in place / Start running | Request canonical `run`, offline |
| Stop walking / Stop running / Stop moving / Stand still / Stop the animation / Return to idle | Request existing `idle` stop/seat transition |
| Can you shake your head? / Please give me a nod / Can you wave? | Existing manual gestures, independent of the answer-gestures switch |
| Can you run a program? / Can you walk through the steps? / How do I walk in Minecraft? | Ordinary text; no avatar or OS action |
| Negated, quoted, compound, injected, unsupported or overlong command | No direct action; ordinary text route |

Walking/running retain the controller's existing continuous **in-place** policy.
They end with an explicit stop or an accepted existing interruption. Every
successful locomotion acknowledgment explains in-place movement and the stop
phrase. The command parser limit remains 160 characters; chat accepts at most
2400 characters. Unsupported multi-action choreography remains ordinary text.

## Deterministic event matrix

| Event | Guard / expected outcome |
| --- | --- |
| Accepted direct action | Controller accepts; truthful reply; one validated cue |
| Rejected continuous motion during a discrete gesture | `rejected-busy`; no successful acknowledgment or direct cue |
| Invalid, hidden or older direct request | Refused; no action |
| Repeated request ID / replayed cue sequence | Refused; no repeated gesture |
| Two submissions | Empty second submission does nothing; pending text inference remains single |
| New direct command during inference | Targeted cancellation and generation invalidation, then manual request |
| Answer while a manual action owns the avatar | Neutral presentation; no override |
| Primary model recoverable failure | One eligible local fallback, correctly labeled; no second concurrent inference |
| Cancel, Clear, model change, hidden/closed window, disposal | Late completion cannot produce an answer reaction; Clear removes ephemeral history |
| Expired or malformed cross-window cue | Validation refuses it before controller dispatch |
| Reduced motion / idle Off | Existing behavior policy and reduced-motion scale preserved |

## Validation performed locally

Baseline: `npm ci --no-audit --no-fund`, then `npm run check`: **160/160**
tests passed; production bundle built. Original production conversation smoke
also passed. New regressions were written and run before fixes: **five** failing
unit tests covered locomotion grammar, reply interpretation, controller outcome,
unsampled expiry and late/manual events. The emitted-app regression failed with
`Conversation composer below viewport` at 1024×600. An additional reply-wording
regression failed on `Yes is an affirmative word.` before its correction.

Candidate validation:

| Command | Local result |
| --- | --- |
| `npm run check` | 166/166 tests pass, syntax checks and production build pass |
| `node scripts/smoke-browser.mjs` | Production Workspace/overlay, original skin reload, gaze pixels, activity controls and ephemeral/local chat pass |
| `node scripts/smoke-eye-gpu.mjs` | Fixed-head gaze/blink pixel gates pass |
| `node scripts/smoke-activity-gpu.mjs` | Held props, local item imports and solid food surface gates pass |
| `node scripts/smoke-expressive-gpu.mjs` | Existing WebGL effects and 100 pooled transitions pass |
| `node scripts/smoke-conversation-v62.mjs` | Offline commands, rejection/no cue, direct cancellation, fallback, model/manual priority, clear, safe text, overlay replay, bounded DOM and responsive checks pass |
| `cargo test --manifest-path src-tauri/Cargo.toml` | Local environment blocked: `cargo: command not found`; must be certified by the exact-SHA Windows job |

The layout evidence covers widths 360, 390, 480, 700, 800, 1024, 1280, 1440
at heights 600, 768, 900 (DPR 1); representative DPR 2 and reduced-motion
contexts; open preferences at short heights; long model labels; 125% actual
text enlargement; keyboard Send; long safely rendered text; 2400-character
input; history eviction and scroll preservation. The final matrix contains
39 checks, including repeated screenshot cases. Assertions check page width,
parent/page scrolling, composer visibility, message overflow and history space.

Desktop and short-height Conversation retain the live preview with its existing
resize behavior. At widths ≤700px, Conversation dedicates the viewport to chat;
other pages and the floating avatar retain their previews. On short desktop
windows, navigation can scroll independently; messages are not nested inside
a scrolling settings panel. Screenshots use synthetic test content and the
repository sample skin.

## Evidence and exact-head certification

The GitHub workflow checks out `github.event.pull_request.head.sha`, not a
synthetic merge commit. Windows `BUILD_INFO.txt` records that SHA, run ID,
ref and the version read from package metadata. `SHA256SUMS.txt` records the
installer hash. These records and the updated PR are the authoritative final
candidate/run mapping; a report cannot embed its own future commit hash.

Fresh exact-head workflow results and installed-app certification are required
before delivery and will be linked in PR #13 and the packaged acceptance record.
Do not treat earlier CI results as certification of a new commit.

Evidence paths uploaded by the workflows include:

- `v622-conversation-desktop.png`, `v622-conversation-short.png`,
  `v622-conversation-narrow.png`, `v622-conversation-preferences.png`.
- `v622-layout-matrix.json` and `v622-performance.json`.
- Existing original-skin, eye, activity and expressive GPU evidence.
- `v622-installed-offline-actions.png`, `v622-installed-overlay-idle.png`,
  `v62-installed-native.json` from the real installed NSIS/WebView2 fixture.

The installed Windows smoke uses a deterministic localhost Ollama fixture and
the real Rust bridge. It verifies offline walk/run/stop/head-shake, actual native
event delivery to the overlay, metadata, Qwen primary/Llama fallback, targeted
cancellation, overlay model-query denial and ephemeral Clear. It does **not**
run real Qwen or Llama weights or certify the owner's hardware.

## Performance and privacy limits

The existing 60 active / 20 idle pacing policy and its deterministic tests are
unchanged. The browser fixture records three idle/walk repetitions, CPU render
call p50/p95/p99, browser task-time deltas and JS heap observations. Software
WebGL timings and observed FPS depend strongly on the shared runner; they are
not GPU frame times or evidence of RTX 3050 performance. Raw measurements in
`v622-performance.json` are authoritative for each run.

No production listeners are added per message, DOM history stays bounded at
30 nodes, local model history stays bounded at 12 messages, and no extra AI
classification call, cloud endpoint, vision input, screenshot capture, OS tool,
file operation or desktop observation is introduced. Native Ollama remains
fixed to localhost. Qwen3.5 4B primary, Llama 3.2 3B fallback, capability checks,
native request cancellation, resource release and privacy boundaries remain.

Uncertified: the owner's Windows device was offline; real Qwen/Llama latency,
RTX 3050 GPU frame times, CPU/native-memory behavior, original owner skin,
Windows display scaling and subjective animation smoothness require owner
verification. No claim of stable/production certification is made.

## Owner verification after automated gates

1. Install the packaged unsigned x64 development candidate; open Conversation
   without connecting to Ollama.
2. Send **Can you walk?**, **Show me how you run**, **Stop walking**, and
   **Can you shake your head?**. Confirm in-place motion and truthful route
   status in Workspace and the floating avatar.
3. Start Wave, then request Walk immediately. If rejected, confirm that the
   reply says so. Send Stand still. Test Sit → Walk → Stop with the existing
   standing transitions.
4. Connect to Ollama and confirm Qwen3.5 4B primary / Llama 3.2 3B fallback.
   Send a text question, then Cancel or send Stop moving while waiting.
   Confirm no late reaction. Test Clear and optional answer gestures.
5. Resize to the native minimum and a short window, enlarge text, open Reply
   preferences, read older messages, and use Latest messages. Check the
   composer and keyboard focus. Check original skin/eyes and manual activities.

PR #13 must remain draft and unmerged. Production main is untouched. Cloud,
screen capture and V7 remain deferred. Owner acceptance and merge are separate
explicit decisions after automated certification and real-device checks.
