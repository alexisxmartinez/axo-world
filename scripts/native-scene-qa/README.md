# Optional native scene check

This developer check compiles AXO's actual GLSL and replays its actual geometry, uniforms, draw order, culling, blending, and depth state in a native offscreen OpenGL ES context. It does not launch a browser or load a web page. It verifies scene geometry and shaders; it cannot verify HTML/CSS, browser layout, navigation, accessibility, or browser WebGL compatibility.

Requires Node.js 22+, Python 3 with Pillow, Linux `libEGL.so.1`, and a surfaceless EGL/OpenGL ES implementation such as Mesa. These are optional local QA tools, with no production dependencies. Mesa is capped to OpenGL ES 2.0 for this process unless the caller sets `MESA_GLES_VERSION_OVERRIDE` explicitly.

From the project root:

```sh
node scripts/native-scene-qa/capture.cjs --out /tmp/axo-native-scene-qa
python scripts/native-scene-qa/render.py /tmp/axo-native-scene-qa
```

The capture evaluates only `src/world.js` with a recording GL object, then saves the real shader strings and buffer/draw packets. The native renderer compiles and links those shaders, uploads the buffers, draws at 2× resolution, downsamples, and reads the pixels. It checks GL errors and saves transparent and dark-background PNGs, detail crops, and a JSON report identifying the source hash and driver. Samples include the front at 0 and 4 seconds, a same-clock ripple comparison, and all six project stops. Rendering uses no external assets or network access.

Both commands default to the `axo-native-scene-qa` folder in the system temporary directory. Captures can be large; generated packets, images, and reports should stay outside the source tree. Keep screenshots labeled as native scene captures, rather than browser screenshots.

To inspect a historical scene module instead, supply `--source /absolute/path/world.js`. The source option can also isolate the bundled World module in a previously built AXO HTML file; no HTML or browser UI is executed.
