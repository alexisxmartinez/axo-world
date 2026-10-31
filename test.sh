#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
node --check src/app.js
node --check src/world.js
node --check src/cosmos.js
node --check src/project-artifacts.js
node --test tests/*.test.mjs
