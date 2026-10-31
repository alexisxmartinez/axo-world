# AXO — Cosmic Lake

An original portfolio set in a speculative lake city inspired by Tenochtitlan. AXO is an articulated pink-and-lilac robot axolotl with cyan eyes, circuit-like gill fins, a flexible tail and a project display on his chest. He walks in side profile over individual beveled stone blocks while the town turns beneath him, glances toward the selected building, then turns back to greet the visitor. Stars, flowers and canal water respond to interaction. Larger reading panels turn each project into a clear story of the problem, Alexis's contribution, the approach and its evidence.

The lake and raised basin use single, flat water surfaces, cooler sky reflections and softer currents. Interaction ripples change the surface shading instead of adding floating rings; the stone shoreline stays solid. Higher vertex precision removes the black depth seams between the water and its underlying volume.

## Open it

Double-click **AXO-World.html** in a modern desktop browser. The complete website is embedded in one file: geometry, styles, scripts and the fallback illustration. It works offline without an installation. Devices without WebGL receive an illustrated scene and can still open every case study.

**AXO-World-Source.zip** contains the editable project, source notes and verification scripts.

For development, use Node.js 22 or newer. No dependency installation is needed:

```bash
npm run dev
```

Open `http://localhost:4173`. The source version optionally loads web fonts, with system fallbacks. The standalone build uses system fonts and requests no runtime assets.

```bash
npm run build
npm test
npm run preview
```

Build refreshes `AXO-World.html` and `dist/index.html` with the same complete website. The single document keeps the **COSMIC LAKE** branding and is updated in place. Host `dist/index.html` on any static host to publish it. This delivery has not been published to a public domain.

## Explore

- Scroll to turn the town beneath AXO. He stays in the foreground and walks in side profile with alternating planted feet. Passing a project updates his chest symbol in either direction. When he settles at a building he glances toward it, then faces the visitor with a smile. His gill fins and tail move with him.
- The camera and AXO stay fixed. Drag or use the arrow buttons to turn the scenery manually. This offset persists during scrolling; choosing a destination restores its alignment behind AXO.
- The persistent project menu names all six buildings and stays available as the town turns. It uses a vertical dock on desktop and a two-by-three grid on smaller screens. The full labels above the buildings provide a second way to select a destination.
- Hover or focus a project to preview its purpose and highlight its building. The **Preview** button offers the same card on touch screens; **Visit** makes one intentional journey. Labels avoid the fixed banner and controls, while the named project menu stays available.
- Choose a building to jump to its chapter and turn the town to that destination along the shortest arc. Only the selected destination is announced. Manual scrolling interrupts the turn and restores normal scroll control.
- A fixed project banner shows the active title, summary, project number, Previous/Next buttons and **Read case study**. Its location line distinguishes **Heading to**, **At** and exploring between stops. Its introduction offers **Start exploring**. The full-viewport town stays visible throughout the scroll journey.
- Settling at Slide Studio flips a slide, Playbook Works turns a page, and Adoption Lab grows its rooftop chart. Preview highlights reuse the existing building geometry.
- Open **Living world** to wake a constellation, bloom the gardens or ripple the canals. Pointer movement reveals nearby stars and brushes flowers; a star tap makes a brief burst, and canal taps make expanding ripples. Controls provide the same explicit effects without requiring a precise pointer hit.
- **Meet the flowers** opens a source-linked guide to the five represented taxa. The garden has twelve plants with distinct dahlia, cosmos, tigridia and branch-mounted orchid forms, plus six waterlily pads with three blooms. Shapes reflect their botanical differences; colors follow the cosmic palette.
- Switch day/night lighting, pause ambient motion, meet AXO, or enable the optional synthesized soundtrack.
- **The work** offers searchable project cards and focus filters. Each case study has readable sections, a process map, an at-a-glance summary, Previous/Next navigation and source-qualified outcomes. Six original interactive illustrations explain decisions through sample scenarios, reporting, reconciliation, adoption data and learning. They use dummy content and are labeled illustrative; actual project screenshots were not supplied.
- Project links work within the same document: `AXO-World.html#work/retail` opens a case study and `AXO-World.html#place/slides` selects a town destination. Browser Back/Forward restores the prior case, reading position, town orientation and focus. Copying a link from a local file provides its project anchor.
- Save up to three projects in a local shortlist, compare their scope and contributions, and copy or download a brief. Shortlists stay in this browser; downloaded briefs retain the evidence qualifications.
- **The human** includes Alexis's career, education and skills. Copy combines the supplied CV and existing FY26 working context. Estimated business cases and CV-reported outcomes retain their attribution.
- Field notes remain available from **The work**. They save in this browser when storage is available; Download keeps a `.txt` copy. Notes are never sent to a server.
- Escape closes the native dialog and restores focus to its original control, including the live case-study button.
- Opening a reading panel suspends both animated layers, including an unfinished destination turn. Closing it resumes from the saved scene clock and preserves the visitor's motion preference.
- Reduced-motion preferences pause ambient animation initially and snap clicked destinations to their selected orientation. Explicit effects provide still feedback. Backgrounding the tab suspends the cosmic layer. Every project and the stars remain accessible without WebGL; the fallback illustration does not reproduce the town, flower or water animation.

## Project buildings

| ID | Building | Work represented |
| --- | --- | --- |
| `retail` | Virtual Retail | Virtual Retail Assistant and human-centered AI product work |
| `rxp` | RXP | Enterprise application delivery and governance |
| `slides` | Slide Studio | CO Staff Slides and leadership reporting automation |
| `playbooks` | Playbook Works | EMEA playbook generation, reconciliation and validation |
| `adoption` | Adoption Lab | AI on the Rise dashboard and adoption storytelling |
| `learning` | Learning Dock | AI, Power Automate and Copilot learning and enablement |

See `docs/portfolio-sources.md` for source attribution, historical dates, financial-claim boundaries and publication choices.

## Project structure

| File | Purpose |
| --- | --- |
| `index.html` | Full-viewport ride scene, live project caption, building controls and fallback illustration |
| `src/styles.css` | Cinema layout, cosmic background, live caption and dark-to-pink purple palette |
| `src/world.js` | Native WebGL town, cut-stone causeway, natural gait, flower/water interactions and world rotation |
| `src/cosmos.js` | Canvas 2D star atlas, local constellations, bounded bursts and motion/visibility lifecycle |
| `src/project-artifacts.js` | Six original interactive illustrations with explicit sample-data boundaries |
| `src/app.js` | Project stories, hash routes/history, previews, filters, shortlist/compare/briefs, accessible effects and local notes |
| `scripts/build.mjs` | Bundles the dependency-free standalone HTML file |
| `scripts/server.mjs` | Local development/static preview server |
| `tests/site.test.mjs` | Automated behavior, route, geometry and build checks |
| `tests/browser-qa.mjs` | Optional real Chromium checks and desktop/mobile screenshots |
| `build.sh`, `test.sh` | Repository-owned entry points for factory runners |
| `docs/portfolio-sources.md` | Content evidence and claim boundaries |
| `docs/factory.md` | REA inspection and ESF/Machinist integration instructions |
| `docs/reference-audit.html` | Readable reference-site audit, evidence limits and original implementation blueprint |
| `docs/Claude-Reference-Handoff.txt` | Copyable prompt for gathering live reference behavior in an authorized browser |
| `scripts/inspect-reference.sh` | Optional REA evidence collection from a local Chrome session |

## Edit the portfolio and town

Edit page copy in `index.html` and case studies in the `projects` object in `src/app.js`. The about template contains the career and education details. The contents are static: adding a new project requires updating its building, point, travel stop and accessible navigation.

Edit the cosmic palette and reading layouts in `src/styles.css`, and the interactive starfield in `src/cosmos.js`. The town and character use original procedural geometry in `src/world.js`; `buildProject` defines the six building forms. `COLORS` controls the scene palette. The setting is a speculative artistic interpretation, not a historical reconstruction of Tenochtitlan.

`World.setScrollProgress(progress)` accepts a clamped value from 0 to 1. It samples the town root's rotation; it does not move AXO around the map or orbit the camera. Six project stops occur at `(index + 1) / 6`. Project anchors are transformed with the town so their controls stay attached to the buildings. At each stop, the selected building lines up behind AXO and its promenade stop aligns with AXO's foreground position. `getWalkState()` exposes travel direction, eased facing, stride blend, planted-foot state and the glance/visitor phase. `getCharacterState()` exposes the settled chest project, expression, fin flex and tail pose; it is also available as `window.AXO.getState().character`. `getEnvironmentState()` exposes flower, ripple and flow state.

`getScrollState()` reports progress, world rotation, fixed character position and transition state. `getWorldStop(id)` returns a transformed promenade stop. `beginDirectTravel(id, { animate: true })` turns the town along the shortest arc to a selected project and emits only that destination's arrival. The matching instant page jump preserves the turn; different manual scroll progress cancels it. `travelTo(id)` remains a compatibility helper. Manual drag and arrow controls add a persistent world-rotation offset while retaining the fixed camera. Selecting a destination resets that offset so its building aligns with AXO.

`getArrivalState()` separates the current settled building from the next target and the last project passed. `getJourneySnapshot()` and `restoreJourney()` retain exact manual orientation, character state and a partially completed destination turn without replaying arrivals. `setReading()` temporarily suspends rendering while retaining the motion preference. `highlightProject()` controls preview feedback; `getProjectEffectState()` exposes the distinct settled-building moments.

The page computes progress from chapter document positions, heights and the viewport center. Resize recomputes the anchors. Hidden chapter spacers retain native scroll geometry; the visible scene uses one persistent project banner and a six-name project menu independent of projected scene labels. `window.AXO.scrollToProject(id)` selects a destination, `window.AXO.visit(id)` opens a detail dialog, and `window.AXO.getState()` reports page state.

The stonework and building accents use the requested palette: `#231942`, `#5e548e`, `#9f86c0`, `#be95c4`, and `#e0b1cb`.

Joshua's World and Yan Holtz supplied visual/interaction references; their proprietary art or implementation is not bundled.

## REA and the software factory

The requested REA and ESF repositories were inspected through their public documentation in the original build. GitHub downloads and npm access were blocked, so neither project was installed or executed here. This version uses a small native WebGL implementation with automated checks and parallel review. `docs/factory.md` and the inspection script provide a route to running REA and ESF or its lighter Machinist workflow on a suitable host.

## Useful review resources

These resources were reviewed, without installation: [Impeccable](https://github.com/pbakaus/impeccable) for critique and typography across the immersive scene and reading panels; Anthropic's [webapp-testing](https://github.com/anthropics/skills/tree/main/skills/webapp-testing) for real-browser journeys and screenshot inspection; and [web-quality-skills](https://github.com/addyosmani/web-quality-skills) for measured performance and accessibility reviews. They can guide the next review on a host with browser access; they do not supply the missing browser executable or remove preview restrictions.

## Validation

Forty-three automated tests pass. They check the standalone build, current inline CSS/script fingerprints, identical document/distribution exports, all six project case studies, focus restoration, safe local notes and download, denied storage, reduced motion, day/night controls, WebGL fallback/context loss, valid geometry, finite transforms, camera controls, pointer gestures and cleanup.

A syntax regression rejects the malformed font-import tail that previously invalidated the standalone theme. Independent checks resolve the delivered CSS variables and require at least 4.5:1 declared contrast for selected controls, the live case-study button and case-study text over an opaque reading surface. This checks the exported style declarations; actual browser cascade and layout remain part of the optional browser profile.

Town checks cover the fixed camera/foreground position, deterministic and manual world turns, six radial destinations, shortest direct rotation, interruption, real beveled stone courses, side-profile gait, alternating planted feet and the building glance followed by a friendly visitor turn. Character checks inspect actual mesh colors, six translucent fin membranes, articulated elbows and cyan eyes. Forward/reverse scroll crossings update exactly one chest glyph; direct journeys retain the previous glyph until the chosen destination arrives. Settled notifications are deduplicated. Gesture checks include touch taps without hover and vertical touch drags. Environment checks exercise actual flower hit/hover reactions, expanding ripples, flowing-water time and motion pause. Canvas checks cover finite drawing inputs, responsive star density, bounded interaction effects, drag/control exclusions, reduced motion, visibility and cleanup.

Water regression checks verify upward planar lake/basin geometry, separate shading regions, local water picking after world rotation, dry-surface rejection, a bounded eight-ripple shader pool, paused inputs and expiry without new geometry allocation.

Garden checks verify five different cached petal geometries and the represented plant counts. Each garden flower type remains reachable as the town turns, and its picking anchor follows the actual moving crown through bloom and bending without allocating new geometry. The source-linked botanical guide also opens through a cold `#flora` link.

Project checks cover search/filter composition, inert search text, sanitized and persisted shortlists, the three-project limit, comparison, qualified downloadable briefs, clipboard fallback, section focus, the persistent menu and lost-WebGL navigation.

Routing checks cover cold case links, safe closing, nested Back/Forward without feedback loops, queued native close events, reading positions, focus and exact manual orientation. Bursts of scroll/orbit/reading input must keep history writes bounded, retain the latest cached state and prevent stale timers from replacing another route. They also check hover/focus previews, single-visit touch activation, physical location text and label/banner occlusion. Reading checks exercise the real world and star loops, suppress draws, preserve interrupted turns and reset elapsed clocks. Illustration checks cover keyboard focus stability, invalid actions, failed reconciliation and the sample adoption denominator. Building checks inspect actual slide/page/chart transforms and confirm feedback does not allocate geometry per interaction.

Native scene checks compiled and linked the production shaders in Mesa OpenGL ES 2.0 through surfaceless EGL, with zero GL errors. A thirteen-frame navigation/effects pass checked the physical roof moments and stronger flower/water feedback. The final botanical scene passed ten frames at 1707×770 with 1.5× supersampling and 243–245 draws per frame; context views and crops checked the distinct taxa. Earlier character passes covered forward/reverse strides, arrival and visitor poses at desktop/mobile sizes. These checks validate scene geometry and GLSL in a software renderer; they do not verify HTML/CSS or browser-specific behavior. The reusable scene tool is documented in `scripts/native-scene-qa/README.md` with its optional dependencies and commands.

The optional real-browser runner requires Playwright and a Chromium binary:

```bash
npm run build
node tests/browser-qa.mjs
```

It checks desktop/mobile overflow, centered full-viewport scene, fixed AXO/camera, rotating scenery, direct destination selection, chapter scroll destinations, actual WebGL startup, previews, physical location text, Back/Forward, reading suspension, banner occlusion, illustrative figures, search/shortlist/brief flows, star effects, native Escape/focus restoration, fallback and reduced motion. It writes viewport screenshots to `tmp/browser-qa/` for visual inspection. Set `AXO_BROWSER_PATH` to an existing compatible Chromium executable; `AXO_HEADED=1` opens a visible browser. Software GL is optional through `AXO_SOFTWARE_GL=1`, since forcing SwiftShader can make animation checks impractically slow.

Supplied real-browser findings for the preceding approximately 204 KB build reported 59–60 fps during scrolling and under 25 MB of JavaScript heap in Chrome on an NVIDIA RTX 1000 Ada at 1707×770 and DPR 1.5. Those observations apply to that tested build and desktop; phone performance remains unknown. The current changes have not been rerun in that browser.

Real-browser testing could not run in this environment: no browser executable was installed, and the Chromium download was blocked with HTTP 403. The cloud browser also refused local file previews. The Node tests use lightweight DOM, Canvas and GL doubles and do not verify GPU pixels, native dialog focus trapping, audio playback or responsive browser layout. The optional runner is included so those checks can be run on a host with Chromium available.
