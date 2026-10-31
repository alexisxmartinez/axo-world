#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/inspect-reference.sh list [CDP_ENDPOINT]
  bash scripts/inspect-reference.sh capture TARGET_ID [OUTPUT_DIR] [CDP_ENDPOINT]

Default endpoint: http://127.0.0.1:9222
Default output:   artifacts/reference-<UTC timestamp>

Start a dedicated Chrome-family browser with a remote-debugging port first.
Uses the official rea-agents npm package through npx; no global installation.
USAGE
}

mode="${1:-list}"
case "$mode" in
  -h|--help|help)
    usage
    exit 0
    ;;
  list)
    [[ $# -le 2 ]] || { usage >&2; exit 2; }
    endpoint="${2:-http://127.0.0.1:9222}"
    ;;
  capture)
    [[ $# -ge 2 && $# -le 4 && -n "$2" ]] || { usage >&2; exit 2; }
    target_id="$2"
    output_dir="${3:-artifacts/reference-$(date -u +%Y%m%dT%H%M%SZ)}"
    endpoint="${4:-http://127.0.0.1:9222}"
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac

command -v node >/dev/null 2>&1 || { echo 'Node.js is required.' >&2; exit 1; }
command -v npx >/dev/null 2>&1 || { echo 'npm/npx is required.' >&2; exit 1; }

# REA requires an explicit port and a literal loopback host. Reject credentials,
# paths, query strings, localhost aliases, and remotely reachable endpoints.
node --input-type=module - "$endpoint" <<'NODE'
const endpoint = process.argv[2];
const match = /^http:\/\/(?:127\.0\.0\.1|\[::1\]):([1-9][0-9]{0,4})$/.exec(endpoint);
if (!match || Number(match[1]) > 65535) {
  console.error('CDP_ENDPOINT must be http://127.0.0.1:PORT or http://[::1]:PORT.');
  process.exit(2);
}
const [major, minor] = process.versions.node.split('.').map(Number);
if (!((major === 22 && minor >= 19) || (major === 24 && minor >= 11) || major >= 26)) {
  console.error('REA requires Node.js 22.19+, 24.11+, or 26+.');
  process.exit(2);
}
NODE

if [[ "$mode" == list ]]; then
  exec npx --yes rea-agents@latest list-browser-targets "$endpoint" --json
fi

[[ -n "$output_dir" ]] || { echo 'OUTPUT_DIR must not be empty.' >&2; exit 2; }
mkdir -p -- "$output_dir"
for filename in targets.json page.json bundle.json screenshot.json; do
  [[ ! -e "$output_dir/$filename" ]] || {
    echo "Refusing to overwrite existing evidence: $output_dir/$filename" >&2
    exit 2
  }
done

# Every command is a standalone REA process, so retain each complete JSON result.
npx --yes rea-agents@latest list-browser-targets "$endpoint" --json \
  > "$output_dir/targets.json"
npx --yes rea-agents@latest inspect-web-page "$endpoint" "$target_id" \
  --observation-ms 1000 --json > "$output_dir/page.json"
npx --yes rea-agents@latest analyze-web-bundle "$endpoint" "$target_id" \
  --json > "$output_dir/bundle.json"
npx --yes rea-agents@latest capture-web-screenshot "$endpoint" "$target_id" \
  --json > "$output_dir/screenshot.json"

echo "REA evidence saved in $output_dir"
