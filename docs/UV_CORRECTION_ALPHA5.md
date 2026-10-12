# Alpha.5.2: fix Minecraft skin UV mapping

The user’s alpha.5.1 Windows screenshot still showed reversed mask, sleeves and clothes. The cause was not arm geometry.

**1. Texture upside-down:** PNG and facial canvas were uploaded with `UNPACK_FLIP_Y_WEBGL=false` despite the rig using Minecraft's top-origin UV layout. The user’s real skin at pixel (10,12) has turquoise iris RGBA (59,118,127,255); before correction the GPU sampled approximately (10,51), transparent. Set Y flip to true for both textures.

**2. Cube sides swapped:** Geometric +X was sampling the left atlas strip (u), -X the right strip (u+w+d). Swap them to match the established skinview3d Java player atlas: +X gets (u+w+d), -X gets u, for all parts and outer layers.

No skin bytes, custom asset files or facial markers were changed. Updated a prior test that had codified swapped side mapping; added four tests for both uploads, frontal atlas rows and all +X/-X side strips (Classic and Slim). All 41 source tests passed in the local audit.

**Windows gate:** verify face and mask, hat/hair, jacket, sleeves, legs, animations and eye blinking using the same uploaded PNG. Compilation is not visual certification; do not merge the draft PR without review.

Reference: https://github.com/bs-community/skinview3d/blob/master/src/model.ts
