# V7.0 local image understanding — implementation record

Status: implementation in progress; no owner certification or V7.1 authorization.

Entry verified 2026-10-15: dev/v7-opt-in-local-vision = 93fb754b506e2b9154b67736060ec824ac627b89; main = 2cc29e89bc3ef85f54c14e70af00ce5f9164240e; PR #14 open, draft, unmerged. No concurrent changes discarded.

## Baseline audit and design

Read the staged handoff, architecture/roadmap, Rust text/model/cancellation transport, command registration, capabilities/CSP, conversation UI/session, reaction coordinator and Windows workflows. Existing text rejects images and has a fixed loopback/no-proxy/no-redirect transport, strict ChatMessage shape, one native inference slot, bounded responses and retention. Keep those validators intact.

Baseline npm ci + npm run check passed (full log in evidence/v7/baseline-check.txt). Native baseline could not run here: cargo is not installed. Windows CI is required; this is not a native pass.

Plan: add a narrow native prepare/clear/analyze lifecycle. Preparation accepts only bounded file bytes from a user selection (no paths/URLs), independently validates source type, dimensions, structure and decoder output on a blocking worker, applies EXIF orientation and strips metadata by re-encoding PNG, long edge 1600 and payload cap 5 MiB. Preview is exactly the canonical image stored by Rust. A single-use request token binds Analyze to those bytes; Analyze accepts no image bytes or arbitrary chat fields. Selection performs zero Ollama requests. One staged image, generation invalidation, explicit consent, native visible Workspace checks and shared text/vision inference slot prevent stale or overlapping requests.

Dependencies planned: image (PNG/JPEG only, no default codecs), base64 (strict standard encoding), rand for unguessable preparation tokens. No Tauri plugins, filesystem permission, network origin or capture API. Native close/minimize clears prepared state and cancels active inference even if WebView JavaScript is suspended. No changes to avatar geometry, renderer, animation controllers or frame pacing.

Tests first: local-vision-v7.test.mjs exercises consent, actual command payload shape, one-shot lifecycle, text overlap, replacement and cancellation, no browser image transport or history. Initial RED run is recorded before implementation.

## Implementation checkpoint

Implemented a volatile LocalVision owner sharing LocalConversation's active slot and native cancellation IDs. Added native PNG/JPEG decode/re-encode, exact canonical preview, single-use 256-bit token, strict dedicated request structs, bounded response schema, model locality/vision revalidation and native hidden/minimized cleanup. Browser image transport is disabled; deterministic browser fixtures explicitly fake native commands. UI integrates into the existing Conversation composer and existing reaction coordinator with content-free overlay cues. Text fallback, direct animation parsing and geometry/timing code stay unchanged.

180 JavaScript tests pass at this working checkpoint (174 baseline plus six V7 contract tests). Native tests include supported encodings, dimension/byte budgets, malformed/multi-image/unsupported sources, narrow schemas and presentational output validation. Native execution is still pending Windows CI. Browser layout tests exposed short-window control clipping; fixes and retest are in progress. This checkpoint is not the delivered exact-head candidate.

No new Tauri permissions, CSP origins, shell/filesystem/capture plugins, cloud endpoints or renderer loops. image 0.25.8 uses only PNG/JPEG; base64 0.22 and rand 0.8. License/advisory review and exact resolved lock pending CI.
