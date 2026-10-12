# Alpha.2: blank avatar / invalid Z-axis rotation

## Incident

The Windows NSIS installer launched successfully, the Animation Workshop reported WebGL2 READY and advanced its frame counter, but the 3D model was invisible in both the preview and the small desktop overlay. Importing a valid 64×64 skin did not change the symptom.

## Root cause and fix

`web/js/engine/mat4.js` defined `rotateZ()` as a **15-element array**, missing the zero in the third column of the 4×4 column-major rotation matrix. `multiply()` expected 16 elements; accessing the missing last element propagated `NaN` into every model matrix. The GPU cannot rasterize vertices with non-finite clip coordinates.

Alpha.2 restores the 16-element rotation matrix. No GPU driver change, model import change, Vercel deployment, or new graphics dependency is required.

## Regression verification

The four new `tests/render-matrices.test.mjs` cases cover matrix shape/finiteness, axis preservation, correct Z-axis rotation, and every vertex of all 12 meshes across all eight animation states and both Classic/Slim rigs. All four cases failed against the original alpha.1 code and passed after the correction. Total automated Node tests: **22**, up from 18.

## Windows re-test

1. Download and run the new **v0.1.0-alpha.2** Windows NSIS installer from the latest successful **Windows desktop build** GitHub Actions run, not the earlier alpha.1 installer.
2. Restart the companion if it was open. In the workshop, the preview should contain a full 3D avatar immediately, even with the sample skin.
3. Import the original 64×64 PNG, then test Classic and Slim and all animation buttons.
4. Confirm that the companion also appears in the smaller always-on-top overlay.
5. If blank remains: record whether a sample skin is visible, graphics status, frame counter, and any WebView2 console or GPU errors. Do not report the bug closed until both windows are visually confirmed on Windows.

The CI build validates compilation, **not** live Windows visual or performance behavior.
