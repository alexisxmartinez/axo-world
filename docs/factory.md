# REA and software-factory workflow

## What ran for this build

This website has a dependency-free Node.js build, a native WebGL town, and a Canvas 2D cosmic layer. Its implementation was **not executed under REA or ESF**. Their public documentation was inspected; repository downloads and CLI execution were blocked in the build environment. The workflow below is prepared for an environment with the required access.

## Inspect the reference with REA

[REA](https://github.com/morluto/rea) is an analysis CLI/MCP, not the website's rendering engine. Its [browser tools](https://github.com/morluto/rea/blob/main/docs/browser-observation.md) can capture a page, examine its scripts, and save evidence through an existing Chrome-family browser's loopback CDP endpoint.

1. Install a supported Node.js version and npm. The original repository inspection recorded Node 22.19+, 24.11+, or 26+ support; confirm the requirements of the REA version you pin before installing. This website itself supports Node 22 or newer. Linux static JavaScript analysis also needs procps-compatible `ps`.
2. Start a separate browser profile; adjust the executable name for your system:

   ```bash
   google-chrome --remote-debugging-port=9222 \
     --user-data-dir=/tmp/axo-reference-browser https://www.joshuas.world/
   ```

3. List its page targets, then supply the matching target ID:

   ```bash
   bash scripts/inspect-reference.sh list
   bash scripts/inspect-reference.sh capture TARGET_ID
   ```

The script uses the official `rea-agents` npm package through `npx`; it performs no global installation or agent setup. The first invocation may download the package. Capture mode saves target discovery, page inspection, static bundle analysis, and a screenshot artifact as JSON under `artifacts/`. Screenshot JSON contains its image payload. The script's final two arguments can select the output directory and a different literal loopback CDP endpoint:

```bash
bash scripts/inspect-reference.sh capture TARGET_ID artifacts/reference http://127.0.0.1:9222
```

Load the reference page before capture. REA's passive tools do not launch or navigate the browser, drive interactions, or recover unavailable source assets. Private browser-automation pipes cannot substitute for a reachable CDP discovery endpoint. Stop the dedicated browser when finished.

Use the findings to understand scene composition, movement, and navigation; keep the axolotl character and artwork original. The implementation runs independently of REA.

## Run future changes through ESF

[ESF](https://github.com/mitkox/esf) coordinates coding agents and verification inside CubeSandbox microVMs through Temporal. The original repository inspection recorded v0.6.2 as a release candidate; that snapshot is not a claim about the current upstream release. It requires an existing CubeSandbox deployment with a READY template, Temporal, a configured agent harness and credentials; the toolchain recorded in the original inspection was Go 1.27.2 and Node 26.12. Confirm the pinned release requirements rather than treating those versions as a current compatibility guarantee. These are factory requirements, separate from the website's Node 24 runtime.

On an appropriately provisioned host:

```bash
git clone https://github.com/mitkox/esf.git
cd esf
make build
./bin/factory init
```

Configure the actual Cube and Temporal services, repository allowlist, agent harness and verification profile in private `factory.toml`. Keep credentials and this configuration outside Git. Follow the [operator guide](https://github.com/mitkox/esf/blob/master/docs/operator-guide.md) and README for the exact configuration supported by your pinned ESF version; example endpoints are placeholders.

The default profile expects repository-owned `build.sh` and `test.sh`. This website supplies those entry points. The checks exercise real scene transforms and mesh materials, side-profile walking and destination facing, planar water and bounded surface ripples, cosmic interaction/lifecycle behavior, project navigation, saved-project briefs, reduced motion and renderer fallback. Configure the sandbox with Node.js 24.11+ and any browser needed by your chosen browser-verification profile. Then validate and start the worker:

```bash
./bin/factory config validate
./bin/factory doctor
./bin/factory worker
```

In another terminal, submit against a real published project repository and a full commit SHA:

```bash
./bin/factory run \
  --repo https://github.com/YOUR_ORG/YOUR_SITE \
  --rev FULL_COMMIT_SHA \
  --task "Implement the requested change; preserve the stone-block lake-city setting, cosmic interaction lifecycle, readable project pages, keyboard controls, reduced motion and fallback behavior; run build.sh and test.sh." \
  --agent YOUR_CONFIGURED_AGENT \
  --verification default
```

Review the resulting manifest, patch, checks and cleanup outcome with `factory describe run RUN_ID`, `factory status RUN_ID` and `factory logs RUN_ID`. An agent's completion message is not proof that verification passed. See ESF's [readiness review](https://github.com/mitkox/esf/blob/master/docs/production-readiness.md).

## Lighter local option

ESF retains its inherited Machinist CLI, buildable with `go build -trimpath -o bin/machinist ./cmd/machinist`. Its [task guide](https://github.com/mitkox/esf/blob/master/docs/task-guide.md) documents local repository registration, configured agent prompts, and separate server/worker processes. This path avoids the full CubeSandbox/Temporal factory and still requires an authenticated coding CLI.

The independent upstream [Machinist](https://github.com/owainlewis/machinist) also offers local agent jobs and a build/review pipeline. It is early-access software; pin the chosen version and follow that version's own configuration guide. Neither alternative has been installed or run for this build. REA, ESF and Machinist use MIT licenses for their own code; external tools retain their own terms.


## Current verification profile

Run repository checks before interpreting an agent's completion as a passing build:

```bash
bash build.sh
bash test.sh
```

The standalone output is `AXO-World.html`; `dist/index.html` contains the same current build. Build verification compares inline script/style fingerprints with the sources, parses the delivered theme rules independently and checks selected-control and reading-surface contrast. The `World`, `Cosmos` and `ProjectArtifacts` modules are scoped independently in the standalone file so their helper names cannot collide.

For a host with Playwright and Chromium already available, run the optional real-browser profile:

```bash
node tests/browser-qa.mjs
```

Set `AXO_BROWSER_PATH` to a compatible installed Chromium binary when needed. The runner verifies the actual browser layout and writes desktop/mobile screenshots for visual review. This environment did not have a browser executable, and its earlier Chromium download attempt was denied with HTTP 403. No browser screenshots or GPU output are claimed as verified here. Automated Node tests use DOM, Canvas and WebGL doubles; they validate application behavior and render inputs rather than browser pixels.
