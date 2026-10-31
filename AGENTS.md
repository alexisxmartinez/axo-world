# AGENTS.md, rules for any coding agent working in this repo

AXO World is Alexis Martinez's original interactive portfolio. A small robotic axolotl walks a circular stone causeway inspired by a lake city; each building is a project and opens a readable case study. Native WebGL and Canvas 2D, no libraries, dependency-free Node build.

## Commands
- Build: `bash build.sh` (writes AXO-World.html and dist/index.html)
- Test: `bash test.sh` (node --check on src files, then `node --test tests/*.test.mjs`, 46 tests at baseline)
- Optional real-browser check: `node tests/browser-qa.mjs` (needs Playwright and Chromium)
- Node 22 or newer. No npm install is needed.

## How work arrives
Work comes as a card with an id, a branch name, the files you may touch and acceptance lines.
1. One card, one branch, named `card/NNN-slug`. Never commit to main, never merge.
2. Touch only the files the card allows. Anything else needs a new card, say so in the PR.
3. Run `bash build.sh` and `bash test.sh` before opening the PR. Do not claim a pass you did not run.
4. Open a pull request using the template below. A different reviewer (another model or Alex) checks it. Your summary is not proof; the reviewer reruns the checks.

PR description template
```
Card: NNN, title
Changed: files and one line each
Acceptance: each acceptance line from the card, with how you verified it
Tests: before N, after N, all pass yes/no
Size: AXO-World.html in MB after build
Minutes spent:
Model:
Open questions:
```

## File ownership
- `styles.css` and `src/world.js` belong to Alex. Do not edit them unless the card lists them.
- Keep `build.sh` and `test.sh` as the entry points; verification tooling depends on them.

## Hard rules
- Identifier blocklist: `.githooks/pre-commit` holds a pattern of internal identifiers. Never add text that matches it, anywhere, including comments, commit messages and PR text. Enable it locally with `git config core.hooksPath .githooks`.
- The employer is never named in project copy. Figures are rounded to two significant figures and labeled as approved benefit values on an internal idea platform, not finance-booked. No organization-level totals.
- Culture: civilization and engineering yes (architecture, causeways, chinampas, calendars, market, the axolotl, poetry). Deities, ritual, warrior costume and real glyphs used as UI: no.
- Palette only: #231942, #5e548e, #9f86c0, #be95c4, #e0b1cb, plus one jade accent in illustrations. No blue, no gold.
- Reduced motion, keyboard navigation and the renderer fallback must keep working. Tests cover them; do not weaken a test to make it pass.
- The single built file stays under 1.2 MB.
- In build scripts, use function replacers with String.replace. A replacement string containing `$'` once truncated the whole page.

## Style of work
Small diffs, clear names, no new dependencies without a card that asks for one. If a card is ambiguous, ask in the PR instead of guessing.
