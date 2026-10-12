# Skin-native facial adapter — v0.1.0-alpha.4

## Implemented: first compatible skin layout

User-provided **ZpkDxGames 64×64 palette PNG** was analyzed locally (the skin image is **not committed** to this public repository).

Observed source data:
- Extra eye swatch occupies **(24..27, 2..4)** in the otherwise unused head texture area.
- Swatch eyelid color: `#F0CFB9`.
- Sclera: `#FFFFFF`; iris: `#3B767F`; pupil: `#205E68`.
- Distinct matching iris and pupil pairs were found on the actual face, at **face-relative pupil coordinates (2,5) and (5,5)**.
- Derived 2x2 eye bounds: left `[1,4]` and right `[5,4]` (within 8x8 face).
- Outer hat/hair pixels are checked to avoid drawing facial pixels over opaque hat geometry.

These values are **observations of this one skin**, not hardcoded coordinates. The detector compares marker RGBA values to the imported base face and requires one unambiguous symmetric match.

Current implementation:
- `web/js/avatar/face.js`: conservative swatch detection, bounded pixel compositing, face quad geometry.
- `web/js/engine/renderer.js`: separate face plane attached to the animated head, independent alpha texture, changes uploaded only on new quantized gaze/blink states.
- `web/js/main.js`: user-facing detected-style status, enable/disable switch, automatic blink and optional Test blink button.
- `tests/face.test.mjs`: synthesized fixture reproducing marker colors and placement, without checking in the user's personal skin.

The original skin image remains unchanged. Neutral gaze uses a fully transparent overlay; unsupported or ambiguous layouts fall back to the unmodified vanilla face. The texture is 64x64 with a four-by-two-eye pixel mask, not an extra full-face repaint.

## Scope limitation: NOT full Just Expressions parity

Just Expressions 1.2.1 uses EMF custom player face geometry, additional supported eye types, animated eyelids/eyebrows, and its own model/rule structure. Our code is an **independent approximation** of the particular symmetric 2x2 marker format observed in this skin; it does not bundle, implement, or certify all EMF rules or formats.

Reference sources:
- https://modrinth.com/resourcepack/just-expressions
- https://github.com/IthanMendoza/Fresh-Moves/wiki
- https://github.com/IthanMendoza/Fresh-Moves/wiki/2x2-Eyes

**Licensing:** resource pack distributions have license terms which must be independently checked before copying any model, animation, asset or rule files. This branch does not copy third-party assets.

## Outstanding visual gates

1. Verify that the supplied palette PNG is imported correctly in Windows WebView2 and the UI displays `Eye markers recognized · 2×2 symmetrical`.
2. Test neutral / left / right / Test blink, walking, running, head turning and animated movement.
3. Compare screenshot closely to appearance of the same skin with Just Expressions enabled in Minecraft. Fine-tune eye placement, eyelid mask and projection order if needed.
4. Verify opaque hat pixels are never covered; inspect frontal/quarter/side profiles for z-fighting and incorrect head rotation.
5. Profile active and idle rendering on RTX 3050 8GB, with multi-monitor and fractional DPI.
6. Add a formally documented compatibility table and more marker types only after validating against upstream eye examples.

The user-provided PNG remains outside the public GitHub repository; no personal skin bytes are included in CI fixtures.
