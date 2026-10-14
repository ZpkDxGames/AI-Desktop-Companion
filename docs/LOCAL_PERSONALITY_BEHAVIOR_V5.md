# V5 — Local Personality & Behavior Engine (development candidate)

**Foundation:** `dev/animation-motion-fidelity-v4` at `4b98c5f657c3c3f919f111f5269b5e77cbedae3d` (draft PR #10).  
**Development PR:** #11, `dev/local-personality-behavior-v5`.  
**Production:** `main` is unchanged. V4 original-skin/native Windows approval remains a separate gate.

## Purpose

Create a local-first, deterministic selection layer that makes the companion vary its existing actions with recognizable *styles*, modest attention responsiveness and short bounded history. The goal is coherent behavior, **not** claiming consciousness, emotions or an operational AI assistant.

### Architecture and boundaries

```
Workspace settings + window-local pointer
                |
     LocalBehaviorPolicy (pure local choices, bounded memory)
                |
 BehaviorController existing idle deadline / request() / pose()
                |
 Canonical skinview3d renderer + original V4 props, motion and eye shader
```

The controller remains the **single** owner of action scheduling, timing, priority, interrupt/recovery, idle frequency, pose and event counters. `LocalBehaviorPolicy` has no `setInterval`, timers, render loop, OS hooks, model loading, network connections, disk IO or Tauri permissions. Policy methods execute during the controller's already-running update or a direct user setting/pointer event.

- `BehaviorController.setBehaviorPolicy(policy|null)` installs/uninstalls a decision strategy.
- `LocalBehaviorPolicy.tick(dt,controller)` decays locally observed in-window attention at simulation time, derives a descriptive behavior *tone*, and does not schedule a new frame.
- `LocalBehaviorPolicy.choose(controller)` runs only when the controller was already about to select an automatic idle activity. It returns an existing registered action or null, never requests/renderers actions itself.
- `LocalBehaviorPolicy.noteAction(action,source,time)` records only a bounded six-action in-memory history and last activity timestamps. No persistent or historical user activity log.
- `LocalBehaviorPolicy.noteInteraction('pointer'|'manual',time)` is called for explicitly local input; in-window pointer notifications are throttled to once per two seconds. It does not know the active application, window titles, screen contents, real cursor position outside the app or calendar.
- `BEHAVIOR_STYLES`: Balanced (varied), Curious (look/read/inspect), Playful (stretch/nod/eat/look), Restful (read/drink/quiet gestures). These are weighted profiles, not model inferences.
- Recent action cooldowns and two-action repetition penalties reduce mechanical repetition; sequenced associations favor reading→stretch, eating→drink, and looking→nod when another decision boundary occurs.
- The action policy uses a separate seeded RNG and never consumes the controller's seeded `nextRandom()` on a per-render-frame basis.
- Turning **Local personality behavior** off removes the strategy and restores the previous V4 seeded auto-action picker. Setting **Automatic idle activities** to Off prevents *all* scheduled actions, even with personality enabled.
- Manual input, seated transition queues, interruptions and explicit user commands continue through V4 logic without policy preemption.
- Settings are sanitized and persisted solely as `{enabled:boolean,style:'balanced'|'curious'|'playful'|'restful'}` within the existing local settings key. No personal data, messages, screen content, history or emotions are stored. The state of in-memory behavior history is intentionally not persisted.

### User controls

Behavior page now contains an opt-in-like local personality checkbox (initially enabled for new profiles), a style selection dropdown and an explicit status label. This is not an AI toggle, and no AI backend is installed.

The Workspace and floating overlay share only the existing local preferences, not one synchronized policy history; they are separate rendering instances. A future single app-level coordinator may become worthwhile when the app gains real interactions, but **do not** add two concurrent schedulers to achieve it.

### Verification

Red-first `tests/local-behavior-policy-v5.test.mjs` covers:
- bounded style schema, refusal of unknown settings;
- installed strategy on one `BehaviorController` and no competing loop;
- seeded deterministic runs, `pose()` independence and RNG stream separation;
- recent-history capacity, cooldown/repetition and manual priorities;
- off/default-policy compatibility, pointer-only context and attention decay;
- large simulated sessions and malformed delta guard.

The production-built browser smoke checks style and enable persistence, status text, reload behavior, alongside pre-existing skin/eyes/Workspace/overlay tests. Other V4 unit, GPU and NSIS CI tests must remain green at the **same exact commit**.

### Future work (not shipped by V5)

An LLM, on-demand conversation intelligence, provider authentication, semantic long-term memory, screen observation, window/edge interaction, global input monitoring, notifications, voice, internet access, autonomous tool calls and personalization based on private OS/app activity. These require explicit opt-in, separate privacy/reliability designs and dedicated milestones. V5 is usable locally without a model or cloud service.

### Owner acceptance

Validate manual controls, idle Off/Calm/Lively, styles, no repeated actions for long periods, two concurrent windows, minimized/hidden behavior, ordinary and high-refresh displays, reduced-motion, original skin/eyes, and Windows native p50/p95/p99 CPU/GPU behavior. Automated Chromium and Windows compile results do **not** certify native GPU/skin acceptance.

**Do not merge PR #11 or release a stable V5 build until V4 acceptance and V5 review.**
