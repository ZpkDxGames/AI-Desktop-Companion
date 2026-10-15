# V7.0 local image understanding — implementation record

Status: V7.0 development candidate under exact-head CI; no owner certification or V7.1 authorization. The delivered acceptance report and CI artifacts carry the final source SHA and outcomes.

Entry verified 2026-10-15: dev/v7-opt-in-local-vision = 93fb754b506e2b9154b67736060ec824ac627b89; main = 2cc29e89bc3ef85f54c14e70af00ce5f9164240e; PR #14 open, draft, unmerged. No concurrent changes discarded.

## Baseline audit and design

Read the staged handoff, architecture/roadmap, Rust text/model/cancellation transport, command registration, capabilities/CSP, conversation UI/session, reaction coordinator and Windows workflows. Existing text rejects images and has a fixed loopback/no-proxy/no-redirect transport, strict ChatMessage shape, one native inference slot, bounded responses and retention. Keep those validators intact.

Baseline npm ci + npm run check passed (full log in evidence/v7/baseline-check.txt). Native baseline could not run here: cargo is not installed. Windows CI is required; this is not a native pass.

Plan: add a narrow native prepare/clear/analyze lifecycle. Preparation accepts only bounded file bytes from a user selection (no paths/URLs), independently validates source type, dimensions, structure and decoder output on a blocking worker, applies EXIF orientation and strips metadata by re-encoding PNG, long edge 1600 and payload cap 5 MiB. Preview is exactly the canonical image stored by Rust. A single-use request token binds Analyze to those bytes; Analyze accepts no image bytes or arbitrary chat fields. Selection performs zero Ollama requests. One staged image, generation invalidation, explicit consent, native visible Workspace checks and shared text/vision inference slot prevent stale or overlapping requests.

Dependencies planned: image (PNG/JPEG only, no default codecs), base64 (strict standard encoding), rand for unguessable preparation tokens. No Tauri plugins, filesystem permission, network origin or capture API. Native close/minimize clears prepared state and cancels active inference even if WebView JavaScript is suspended. No changes to avatar geometry, renderer, animation controllers or frame pacing.

Tests first: local-vision-v7.test.mjs exercises consent, actual command payload shape, one-shot lifecycle, text overlap, replacement and cancellation, no browser image transport or history. Initial RED run is recorded before implementation.

## Implementation checkpoint

Implemented a volatile LocalVision owner sharing LocalConversation's active slot and native cancellation IDs. Added native PNG/JPEG decode/re-encode, exact canonical preview, single-use 256-bit token, strict dedicated request structs, bounded response schema, model locality/vision revalidation and native hidden/minimized cleanup. Browser image transport is disabled; deterministic browser fixtures explicitly fake native commands. UI integrates into the existing Conversation composer and existing reaction coordinator with content-free overlay cues. Text fallback, direct animation parsing and geometry/timing code stay unchanged.

180 JavaScript tests pass at this working checkpoint (174 baseline plus six V7 contract tests). Native tests include supported encodings, dimension/byte budgets, malformed/multi-image/unsupported sources, narrow schemas and presentational output validation. Native tests passed on the initial Windows CI checkpoint using image 0.25.8; the final candidate upgrades to current image 0.25.10 and adds further lifecycle/alpha tests, so exact-head native execution is pending. Browser layout tests exposed short-window control clipping; fixes and retest are in progress. This checkpoint is not the delivered exact-head candidate.

No new Tauri permissions, CSP origins, shell/filesystem/capture plugins, cloud endpoints or renderer loops. image 0.25.10 uses only PNG/JPEG; base64 0.22 and rand 0.8. License/advisory review and exact resolved lock pending CI.


## Source and color admission limits

The canonical image is 8-bit RGBA PNG, max long edge 1600, 4,000,000 source pixels, 5 MiB original/encoded output. PNG alpha and JPEG EXIF orientation are preserved. Animated/concatenated/trailing sources, unsupported formats, high-bit-depth and embedded ICC-profile inputs fail closed with a conversion instruction. ICC color conversion and HDR fidelity are not implemented; export an 8-bit sRGB PNG/JPEG without an embedded ICC profile. This prevents silent profile removal from changing the approved image's meaning. The full sanitized preview can be opened before consent. Preview tokens expire after two minutes; reselect after expiry. Decoder allocation budget is 64 MiB best effort in addition to independent strict byte/pixel limits; not an OS memory sandbox.

## Dependency review

No JavaScript dependencies added. image is pinned to 0.25.10, the current published release checked against docs.rs on 2026-10-15; PNG/JPEG only and default formats/rayon disabled. MIT OR Apache-2.0 image/base64/rand families use in-memory decode/encoding and randomness. Current image package RustSec listing shows historical 2019/2020 advisories, not proof of a full transitive audit. Final resolved Cargo.lock and a fresh cargo audit must be reviewed; do not describe this lookup as a complete security scan. References: https://docs.rs/crate/image/0.25.10 , https://rustsec.org/packages/image.html , https://docs.ollama.com/capabilities/vision , https://docs.ollama.com/api/chat .


## Final verification and owner checkpoint

The branch CI builds from the PR head SHA (not a synthetic merge commit). Source checks run 180 JavaScript tests and the production build, then startup, eye, activity, expressive, conversation and image privacy WebGL suites. Windows CI runs cargo tests, builds unsigned x64 NSIS, records BUILD_INFO/checksum and resolved lockfile, installs/launches the app, tests the actual Rust/WebView2 boundary against a deterministic local Ollama server, and uninstalls it. The fixture checks consent, invalid native inputs, overlay denial, image model revalidation, unsupported/remote/error paths, no fallback, 25 import/remove cycles, five image analyses at retention 0/30/60, subsequent text history isolation, and cancellation. The browser fixture explicitly simulates native transport; it is not native admission evidence. Native-dependency-audit independently resolves the lock, inventories licenses and runs cargo-audit 0.22.2 against current RustSec data. Final exact-head CI results must be checked before distributing the candidate.

No accepted avatar renderer, geometry, animation, effects, eyes or frame-pacing files changed. 60-active/20-idle policy remains unchanged. Existing expressive tests check 100 pooled effect transitions; object URL balance is tested separately and does not prove physical GPU memory reclamation. UI tests cover 360x600, 390x700, 700x600, 840x650, 1120x780 with 100/125/150% text, and separate browser DPR 1.25/1.5/2. In short windows image preview temporarily replaces transcript space; Analyze/Remove and the question composer remain available. PNG/JPEG filenames are not displayed, logged or sent.

Synthetic timing samples, JavaScript heap snapshots, displayed FPS and CPU render-call percentiles are diagnostic only. They are not NVIDIA GPU timing, real model latency, VRAM evidence or a stable-memory guarantee. Original/canonical raw Rust buffers are dropped and canonical buffers overwritten on release; base64/IPC/decoder/WebView copies use ordinary allocation lifetimes, not guaranteed forensic zeroization. No application image/history persistence is added; Ollama's own diagnostics, OS paging and external process behavior are outside this app's retention controls.

Owner acceptance required on Windows 11 / RTX 3050 8 GB / Ryzen 7 5700G / 32 GB: install the unsigned development candidate; connect to the existing local Ollama; verify current Qwen3.5:4b advertises completion+vision and no remote metadata; import a private non-sensitive PNG/JPEG, inspect full preview and approve once; check correct descriptions, actual response times, FPS/CPU/RAM/VRAM during inference; repeat five times at each retention policy; cancel/clear/minimize/close and confirm no late replies/effects; switch to Llama text and verify ordinary text fallback/direct gestures/skin/eyes/animations remain accepted. Keep private images off GitHub and do not upload screenshots containing private information.

Implemented: selected local image import, native sanitized preview, separate analysis consent, local vision routing, ephemeral answers, existing presentational cues. Deferred: V7.1 screen/window capture, any continuous desktop awareness, OCR background service, OS actions and all cloud providers. Do not merge PR #14 or advance to capture until the owner approves the separate milestone.
