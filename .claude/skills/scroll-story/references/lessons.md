# Lessons

Newest at the bottom. Each line: date, what happened, what to do next time.

## 2026-11-25/26 — 夜のカフェテラス (cafe-terrace/)

- First version drew everything with code shapes on a 2D canvas, tap to advance. User: "nice but the painting is just shapes". → Code-drawn art reads as clip art. Use real artwork or AI-made images for anything meant to look painted.
- User preferred **scroll** over tap. → Default to scroll-driven; smooth the scroll value (`sp += (target - sp) * (1 - exp(-dt*4))`) so moves glide.
- Switching to the real painting and panning around it looked great, but the user said the story made no sense: "suddenly the sky, then suddenly a seat". → Write a continuous first-person story where each camera move has a cause. Never jump between parts of the image.
- User wanted to feel *inside* the world, turning and walking past people, not looking at a flat picture. → 2D pans aren't enough; the viewer wants depth and to look around.
- Projecting the real painting onto 3D geometry worked at the doorway but stretched and smeared once inside. User: "using the real painting in 3D looks weird; it doesn't have to be the real one". → Don't force a flat image into 3D. Keep the real artwork for the entry moment only, then switch to something made for 3D.
- A three.js town painted with code-generated brushstroke textures was liked ("いい感じ"), but people built from shapes and a cut-out portrait for the main character were rejected: "Van Gogh is just a cut-out; people are too geometric". → Characters are the hardest part. Code/Blender primitives give toy-like figures. Use AI-made characters (Meshy for 3D, or AI video so characters come for free).
- Research (2026-11): the mainstream way to make beautiful scroll sites is AI keyframes → Kling/Veo clip → frames → scroll scrub. The user's very first idea was this. → Start here by default.
- The user prefers free tools. → Name free tiers; avoid paid APIs unless asked.

## Harness tricks (this cloud environment)

- Many hosts are blocked. cdnjs is blocked for curl but loads fine in the published artifact; for local tests get libraries from npm (`npm pack three@0.128.0`) and `page.route()` the CDN URL to the local file in Playwright.
- Wikimedia images work in the "mikoto-site (Wikimedia images)" environment.
- Blender is available as a Python module: `python3 -m venv bl && ./bl/bin/pip install bpy`.
- Playwright WebGL: launch Chromium with `--use-gl=swiftshader --enable-webgl --ignore-gpu-blocklist`.
- GLSL: never call `smoothstep` with edge0 > edge1; it is undefined and some GPUs return nothing. Write `1. - smoothstep(a, b, x)`.
- Wrap the page in `<!doctype html>…<body>` only for local tests; the published file has no skeleton.

## 2026-11-26 Free 3D people with Blender + MakeHuman (MPFB2)
- Install MPFB2 from a git clone zipped as an extension: `bpy.ops.extensions.package_install_files(repo='user_default', enable_on_install=True)` then `addon_utils.enable('bl_ext.user_default.mpfb')`.
- Particle hair is invisible at scene scale unless `root_radius=1` and `radius_scale≈0.0007` (default 0.01 is huge/odd). Use the COLOR parametrization for hair color.
- Cycles CPU, 1280x720, 16 spp + OIDN ≈ 50 s/frame here; 240 frames ≈ 3.3 h. Background jobs stop at 2 h, so render in ranges (`START END`) and resume from the first missing frame; name outputs by frame number.
- Painterly post (structure-tensor strokes, fixed seed) + bloom over plain renders reads as "Van Gogh-like" and hides the CG look; fixed seed keeps flicker low.
- 240 WebP frames ≈ 15 MB; publish with `files` + `root` (≤255 files per publish).
- 2026-11-26 user: heavy oil strokes (r=14,7,3) looked 'too oily / too rough'. Use light strokes (r=6,3) blended ~45% over the sharp render + slight sharpen, WebP q90 (scripts/paint_frames.py).
- 2026-11-26 user asked "これだけ？". Cheap upgrades that need no re-render: browser-made sound (WebAudio wind/crickets/murmur/clinks + footsteps per stride, start behind a "音ありではじめる" button), speechSynthesis voices (ja-JP lines, fr-FR "Bonjour"), look-around by tilt/mouse (draw frames 8% oversized and pan), breathing lights (blurred bright-only copy added with 'lighter' + flicker), tap-to-talk using per-frame head positions projected from the Blender camera (scripts/project_people.py -> people.json).
- Wikimedia API rate-limits fast (429); fetch a few known files only, and don't loop searches.
- 2026-11-27 user: synthesized footsteps (fired every stride while scrolling) and syllable-gated noise 'murmur' sounded like ガタガタ noise — removed. Wind was liked. Keep synthesized sound to smooth beds (wind) plus rare soft accents.
