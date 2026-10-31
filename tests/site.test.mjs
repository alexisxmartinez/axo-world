import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const source = await readFile(new URL('src/app.js', root), 'utf8');
const worldSource = await readFile(new URL('src/world.js', root), 'utf8');
const artifactSource = await readFile(new URL('src/project-artifacts.js', root), 'utf8');
const markup = await readFile(new URL('index.html', root), 'utf8');
const hash = (value) => createHash('sha256').update(value).digest('hex');

function ancestorIdsFor(id) {
  const stack = [];
  const voidTags = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
  for (const match of markup.matchAll(/<(\/?)([a-z][\w-]*)\b([^>]*)>/gi)) {
    const [, closing, tag, attributes] = match;
    if (closing) { while (stack.length) { if (stack.pop().tag === tag) break; } continue; }
    const elementId = attributes.match(/\bid=["']([^"']+)["']/)?.[1];
    if (elementId === id) return stack.map(item => item.id).filter(Boolean);
    if (!voidTags.has(tag) && !/\/\s*$/.test(attributes)) stack.push({ tag, id: elementId });
  }
  throw new Error(`Missing element ${id}`);
}

class Events {
  listeners = new Map();
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(callback);
  }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
  emit(type, event = {}) {
    const emitted = { type, target: this, ...event };
    for (const listener of [...(this.listeners.get(type) || [])]) listener(emitted);
    return emitted;
  }
}

// Deliberately small DOM double: real application handlers run, including
// delegation, modal close/focus restoration, storage and preference changes.
// Browser layout and native dialog focus trapping need separate visual QA.
function makeDOM() {
  const document = new Events();
  const elements = [];
  class Element extends Events {
    constructor(tag = 'div', attrs = {}) {
      super(); this.tagName = tag; this.attributes = { ...attrs }; this.id = attrs.id || '';
      this.dataset = new Proxy({}, { set: (target, key, value) => { target[key] = String(value); this.attributes['data-' + key.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase())] = String(value); return true; }, deleteProperty: (target, key) => { delete target[key]; delete this.attributes['data-' + key.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase())]; return true; } }); this.style = {}; this.hidden = 'hidden' in attrs; this.disabled = 'disabled' in attrs;
      this.value = attrs.value || ''; this.textContent = ''; this.open = false; this.children = [];
      const classes = new Set((attrs.class || '').split(/\s+/).filter(Boolean));
      const syncClasses = () => this.attributes.class = [...classes].join(' ');
      this.classList = { add(...names) { names.forEach(name => classes.add(name)); syncClasses(); }, remove(...names) { names.forEach(name => classes.delete(name)); syncClasses(); }, contains(name) { return classes.has(name); }, toggle(name, force) { const active = force === undefined ? !classes.has(name) : !!force; active ? classes.add(name) : classes.delete(name); syncClasses(); return active; } };
      for (const [key, value] of Object.entries(attrs)) if (key.startsWith('data-')) this.dataset[key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
      if (attrs['data-scroll-project']) this.layout = { top: 900 * (['retail','rxp','slides','playbooks','adoption','learning'].indexOf(attrs['data-scroll-project']) + 1), height: 900, width: 1440 };
      elements.push(this);
    }
    setAttribute(key, value) { this.attributes[key] = String(value); if (key.startsWith('data-')) this.dataset[key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value; }
    removeAttribute(key) { delete this.attributes[key]; if (key.startsWith('data-')) delete this.dataset[key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())]; }
    getAttribute(key) { return this.attributes[key] ?? null; }
    hasAttribute(key) { return key in this.attributes; }
    closest(selector) { return matches(this, selector) ? this : this.parent?.closest(selector); }
    contains(node) { for (let item = node; item; item = item.parent) if (item === this) return true; return false; }
    matches(selector) { return matches(this, selector); }
    querySelectorAll(selector) { return select(selector).filter(element => element !== this && this.contains(element)); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    get isConnected() { return elements.includes(this) && (this === document.documentElement || document.documentElement?.contains(this)); }
    appendChild(child) { if (child.parent) child.parent.children = child.parent.children.filter(item => item !== child); child.parent = this; this.children.push(child); return child; }
    remove() { this.parent && (this.parent.children = this.parent.children.filter(child => child !== this)); for (let i = elements.length - 1; i >= 0; i--) if (this.contains(elements[i])) elements.splice(i, 1); this.parent = null; }
    focus() {
      const previous = document.activeElement;
      if (previous === this) return;
      previous?.emit('blur', { relatedTarget: this }); document.emit('focusout', { target: previous, relatedTarget: this });
      document.activeElement = this; this.emit('focus', { relatedTarget: previous }); document.emit('focusin', { target: this, relatedTarget: previous });
    }
    showModal() { this.open = true; }
    close() { this.open = false; const dispatch = () => this.emit('close'); if (document.queueDialogClose) document.queueDialogClose(dispatch); else dispatch(); }
    click() { if (this.disabled) return; this.emit('click'); for (let parent = this.parent; parent; parent = parent.parent) parent.emit('click', { target: this }); document.emit('click', { target: this }); }
    get offsetWidth() { return this.layout?.width ?? 120; }
    get offsetHeight() { return this.layout?.height ?? 32; }
    getBoundingClientRect() {
      const width = this.layout?.width ?? 640;
      const height = this.layout?.height ?? 640;
      const top = (this.layout?.top ?? 0) - (document.defaultView?.scrollY ?? 0);
      const left = this.layout?.left ?? 0;
      return { left, top, right: left + width, bottom: top + height, width, height };
    }
    scrollIntoView(options) {
      const top = (this.layout?.top ?? 0) - (options?.block === 'center' ? ((document.defaultView?.innerHeight ?? 900) - (this.layout?.height ?? 640)) / 2 : 0);
      document.defaultView?.scrollTo({ top, behavior: options?.behavior });
    }
    setPointerCapture() {}
    set innerHTML(html) {
      for (const child of [...this.children]) child.remove();
      this.children = parse(html, this);
      this.html = html;
    }
    get innerHTML() { return this.html || ''; }
  }
  function parse(html, parent = null) {
    const roots = [], stack = [], voidTags = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
    for (const [, closing, rawTag, attributes] of html.matchAll(/<(\/?)([a-z][\w-]*)\b([^>]*)>/gi)) {
      const tag = rawTag.toLowerCase();
      if (closing) { while (stack.length) if (stack.pop().tagName === tag) break; continue; }
      const attrs = {};
      for (const match of attributes.matchAll(/([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attrs[match[1]] = match[2] ?? match[3] ?? match[4] ?? '';
      const element = new Element(tag, attrs), container = stack.at(-1);
      element.parent = container || parent;
      if (container) container.children.push(element); else roots.push(element);
      if (!voidTags.has(tag) && !/\/\s*$/.test(attributes)) stack.push(element);
    }
    return roots;
  }
  function simple(element, selector) {
    if (!element) return false;
    if (selector === '*') return true;
    const structural = selector.replace(/\[[^\]]*\]/g, '');
    const tag = structural.match(/^[\w-]+/); if (tag && element.tagName !== tag[0]) return false;
    for (const [,id] of structural.matchAll(/#([\w-]+)/g)) if (element.id !== id) return false;
    for (const [,name] of structural.matchAll(/\.([\w-]+)/g)) if (!element.classList.contains(name)) return false;
    for (const [,name,value] of selector.matchAll(/\[([\w-]+)(?:=["']?([^\]"']+)["']?)?\]/g)) if (!element.hasAttribute(name) || value !== undefined && element.getAttribute(name) !== value) return false;
    return true;
  }
  function matches(element, selector) { return selector.split(',').some(option => {
    const parts = option.trim().replace(/\s*>\s*/g, ' > ').split(/\s+/); let cursor = element;
    if (!simple(cursor, parts.pop())) return false;
    while (parts.length) {
      const part = parts.pop();
      if (part === '>') { cursor = cursor.parent; if (!simple(cursor, parts.pop())) return false; }
      else { cursor = cursor.parent; while (cursor && !simple(cursor, part)) cursor = cursor.parent; if (!cursor) return false; }
    }
    return true;
  }); }
  function select(selector) { return elements.filter(element => matches(element, selector)); }
  parse(markup);
  document.documentElement = select('html')[0]; document.documentElement.dataset.theme = 'day';
  document.body = select('body')[0]; document.activeElement = document.body; document.hidden = false;
  document.querySelector = (selector) => select(selector)[0] || null;
  document.querySelectorAll = select;
  document.getElementById = (id) => select(`#${id}`)[0] || null;
  document.createElement = (tag) => new Element(tag);
  return { document, Element };
}

function appHarness({ reduced = false, storage = {}, webgl = true, blockedStorage = false, roundedScroll = false, hash: initialHash = '', baseURL = 'https://axo.example/AXO-World.html', queuedDialogClose = false } = {}) {
  const { document, Element } = makeDOM();
  const pendingDialogCloses = [];
  if (queuedDialogClose) document.queueDialogClose = callback => pendingDialogCloses.push(callback);
  const media = Object.assign(new Events(), { matches: reduced });
  const animationFrames = new Map(); let nextFrame = 0;
  const timers = new Map(); let timerId = 0, clock = 1000;
  const schedule = (callback, delay = 0) => { const id = ++timerId; timers.set(id, { callback, due: clock + Math.max(0, delay) }); return id; };
  const cancel = id => timers.delete(id);
  const effects = [];
  const requestAnimationFrame = (callback) => { animationFrames.set(++nextFrame, callback); return nextFrame; };
  const cancelAnimationFrame = (id) => animationFrames.delete(id);
  const window = Object.assign(new Events(), { matchMedia: () => media, innerHeight: 900, innerWidth: 1440, scrollY: 0,
    requestAnimationFrame, cancelAnimationFrame, setTimeout: schedule, clearTimeout: cancel, scrollCalls: [],
    scrollTo(options) { this.scrollCalls.push(options); effects.push(['page-scroll', options.top, options.behavior]); this.scrollY = roundedScroll ? Math.round(options.top || 0) : (options.top || 0); this.emit('scroll'); } });
  let currentURL = new URL(`${baseURL}${initialHash}`), historyIndex = 0;
  const historyEntries = [{ url: currentURL.href, state: null }], historyCalls = [], pendingHistory = [];
  const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const history = {
    get state() { return copy(historyEntries[historyIndex].state); }, get length() { return historyEntries.length; },
    scrollRestoration: 'auto',
    pushState(state, title, url) { currentURL = new URL(url || currentURL.href, currentURL); historyEntries.splice(++historyIndex); historyEntries.push({ url: currentURL.href, state: copy(state) }); historyCalls.push(['push', currentURL.hash]); },
    replaceState(state, title, url) { currentURL = new URL(url || currentURL.href, currentURL); historyEntries[historyIndex] = { url: currentURL.href, state: copy(state) }; historyCalls.push(['replace', currentURL.hash]); },
    go(delta = 0) {
      historyCalls.push(['go', delta]);
      const next = historyIndex + delta; if (next < 0 || next >= historyEntries.length || next === historyIndex) return;
      pendingHistory.push(() => { const previous = currentURL.href; historyIndex = next; currentURL = new URL(historyEntries[next].url); window.emit('popstate', { state: history.state }); if (previous !== currentURL.href) window.emit('hashchange', { oldURL: previous, newURL: currentURL.href }); });
    },
    back() { this.go(-1); }, forward() { this.go(1); }
  };
  const location = { get href() { return currentURL.href; }, get hash() { return currentURL.hash; }, get pathname() { return currentURL.pathname; }, get origin() { return currentURL.origin; },
    set hash(value) { const previous = currentURL.href; history.pushState(null, '', value); window.emit('hashchange', { oldURL: previous, newURL: currentURL.href }); } };
  window.history = history; window.location = location;
  document.defaultView = window;
  document.documentElement.scrollHeight = 7200;
  document.body.scrollHeight = 7200;
  const values = new Map(Object.entries(storage));
  class FakeWorld {
    constructor(options) { if (!webgl) throw new Error('No WebGL'); this.calls = []; this.options = options; this.points = []; this.width = 1440; this.journey = { progress: 0, worldRotation: 0, manualRotationOffset: 0, transitioning: false, destination: null }; this.arrival = { status: 'intro', currentProject: null, targetProject: null, lastPassedProject: null }; this.character = { projectId: null, display: 'intro', expression: 'friendly', settlePhase: 'visitor' }; FakeWorld.instance = this; }
    setMotion(value) { this.calls.push(['motion', value]); this.motion = value; }
    setReading(value) { this.calls.push(['reading', value]); this.reading = value; }
    setTheme(value) { this.calls.push(['theme', value]); }
    setView(value) { this.calls.push(['view', value]); }
    orbit(value) { this.calls.push(['orbit', value]); this.journey.worldRotation += value; this.journey.manualRotationOffset += value; }
    wave() { this.calls.push(['wave']); }
    bloomFlowers() { this.calls.push(['flowers']); }
    rippleWater() { this.calls.push(['water']); }
    travelTo(id) { this.calls.push(['travel', id]); return ['retail', 'rxp', 'slides', 'playbooks', 'adoption', 'learning'].includes(id); }
    setTravelEnabled(value) { this.calls.push(['travelEnabled', value]); }
    setScrollProgress(value) { this.calls.push(['scrollProgress', value]); effects.push(['world-scroll', value]); this.scrollProgress = value; this.journey.progress = value; if (!this.journey.transitioning) this.journey.worldRotation = -Math.PI * 2 * value + this.journey.manualRotationOffset; }
    beginDirectTravel(id, options) { this.calls.push(['direct', id, options]); effects.push(['direct', id, options?.animate]); this.journey.transitioning = !!options?.animate; this.journey.destination = id; this.arrival = { ...this.arrival, status: options?.animate ? 'travelling' : 'at', currentProject: options?.animate ? null : id, targetProject: id }; if (!options?.animate) this.character.projectId = id; return true; }
    getScrollState() { return { ...this.journey, progress: this.scrollProgress || 0, activeProject: '', walking: false, character: this.getCharacterState(), arrival: this.getArrivalState() }; }
    getCharacterState() { return { ...this.character, arrival: this.getArrivalState() }; }
    getArrivalState() { return { ...this.arrival }; }
    restoreJourney(snapshot) { this.calls.push(['restore', copy(snapshot)]); const saved = snapshot.journey || snapshot; this.journey = { ...saved, transitioning: false, destination: null }; this.scrollProgress = saved.progress || 0; this.character = copy(snapshot.character || saved.character || this.character); this.arrival = copy(saved.arrival || this.arrival); }
    highlightProject(id) { this.calls.push(['highlight', id]); this.highlighted = id; }
    settle(id) { this.journey.transitioning = false; this.journey.destination = null; this.arrival = { status: 'at', currentProject: id, targetProject: id, lastPassedProject: id }; this.character = { ...this.character, projectId: id, display: id }; this.options.onArrival?.(id); this.options.onFrame?.(this); }
    destroy() { this.destroyed = true; }
  }
  class FakeCosmos {
    constructor(canvas, options) { this.calls = []; this.options = options; FakeCosmos.instance = this; }
    setMotion(value) { this.calls.push(['motion', value]); }
    setReading(value) { this.calls.push(['reading', value]); this.reading = value; }
    pulse(...args) { this.calls.push(['pulse', ...args]); }
    destroy() { this.destroyed = true; }
    getState() { return { motion: this.calls.filter(call => call[0] === 'motion').at(-1)?.[1] ?? !this.options.reducedMotion, reading: !!this.reading }; }
  }
  const localStorage = {
    getItem(key) { if (blockedStorage) throw new Error('Storage denied'); return values.get(key) ?? null; },
    setItem(key, value) { if (blockedStorage) throw new Error('Storage denied'); values.set(key, String(value)); }
  };
  const downloads = [];
  class HarnessURL extends URL { static createObjectURL(blob) { downloads.push(blob); return 'blob:test'; } static revokeObjectURL() {} }
  const context = vm.createContext({ document, window, location, history, localStorage, World: FakeWorld, Cosmos: FakeCosmos, Blob, URL: HarnessURL, Element,
    requestAnimationFrame, cancelAnimationFrame, performance: { now: () => clock },
    setTimeout: schedule, clearTimeout: cancel, console: { info() {} } });
  vm.runInContext(artifactSource.replace(/^export\s+/gm, '') + '\nglobalThis.ProjectArtifacts = ProjectArtifacts;', context, { filename: 'project-artifacts.js' });
  vm.runInContext(source.replace(/^import .*;\s*$/gm, ''), context, { filename: 'app.js' });
  return { document, window, media, values, downloads, effects, historyCalls, historyEntries, artifacts: context.ProjectArtifacts, world: FakeWorld.instance, cosmos: FakeCosmos.instance,
    flushHistory() { let steps = 0; while (pendingHistory.length) { assert.ok(++steps < 12, 'history handlers must not create a popstate feedback loop'); pendingHistory.shift()(); } },
    flushDialogCloses() { let steps = 0; while (pendingDialogCloses.length) { assert.ok(++steps < 12); pendingDialogCloses.shift()(); } },
    lastCall: (name) => FakeWorld.instance?.calls.filter((call) => call[0] === name).at(-1),
    flushFrame() { const callbacks = [...animationFrames.values()]; animationFrames.clear(); callbacks.forEach(callback => callback(clock)); },
    advanceTime(milliseconds) { clock += milliseconds; let count = 0; while (true) { const due = [...timers].filter(([,timer]) => timer.due <= clock).sort((a,b) => a[1].due - b[1].due); if (!due.length) break; assert.ok(++count < 1000, 'timers must settle'); const [id,timer] = due[0]; timers.delete(id); timer.callback(); } },
    get: (id) => document.querySelector(`#${id}`),
    button(attrs) { const button = new Element('button', attrs); document.body.appendChild(button); return button; },
    state: () => window.AXO.getState() };
}

test('standalone build parses and fetches no runtime assets', async () => {
  execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: root });
  const output = await readFile(new URL('dist/index.html', root), 'utf8');
  const download = await readFile(new URL('AXO-World.html', root), 'utf8');
  assert.equal(output, download, 'download must match the tested build');
  const scripts = [...output.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1);
  assert.doesNotMatch(output, /(?:#|%23)(?:f38158|d46443|dcb468|f77b4f)\b/i, 'the delivered UI and illustration must not retain orange accents');
  for (const id of ['live-story', 'project-nav']) {
    assert.ok(!ancestorIdsFor(id).includes('world-stage') && !ancestorIdsFor(id).includes('scroll-story'),
      `${id} must stay outside the projected/clipped town container`);
  }
  const persistentLabels = ['Virtual Retail', 'Content Studio', 'Quote Works', 'Mission Control', 'Adoption Lab', 'Planning Bot'];
  ['retail','rxp','slides','playbooks','adoption','learning'].forEach((id, index) => {
    const button = markup.match(new RegExp(`<button[^>]*id="nav-${id}"[^>]*>([\\s\\S]*?)</button>`));
    assert.ok(button && button[1].replace(/<[^>]*>/g, ' ').includes(persistentLabels[index]),
      `${id} must have a complete persistent navigation label`);
  });
  const css = await readFile(new URL('src/styles.css', root), 'utf8');
  const cosmosSource = await readFile(new URL('src/cosmos.js', root), 'utf8');
  const scoped = (module, name) => `const { ${name} } = (() => {\n${module.replace(/^export\s+/gm, '')}\nreturn { ${name} };\n})();`;
  const expectedScript = scoped(worldSource, 'World') + '\n' + scoped(cosmosSource, 'Cosmos') + '\n' + scoped(artifactSource, 'ProjectArtifacts') + '\n' + source.replace(/^import\s+.*from\s+['"].*['"];?\s*$/gm, '');
  const styles = [...output.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)];
  assert.equal(styles.length, 1);
  assert.equal(hash(styles[0][1].trim()), hash(css.split('\n').filter(line => !line.trimStart().startsWith('@import ')).join('\n').trim()),
    'the delivered CSS fingerprint must match the current cosmic lake source');
  assert.equal(hash(scripts[0][1].trim()), hash(expectedScript.trim()),
    'the delivered script fingerprint must match the current app and renderer');
  const visibleCopy = output.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/g, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  assert.match(visibleCopy, /COSMIC LAKE/);
  assert.doesNotMatch(visibleCopy, /COSMIC LAKE\s*\/\s*V\d+/);
  assert.deepEqual([...output.matchAll(/data-fallback-building=["']([^"']+)["']/g)].map(match => match[1]).sort(),
    ['retail', 'rxp', 'slides', 'playbooks', 'adoption', 'learning'].sort(),
    'the delivered fallback must show the current six-building town');
  execFileSync(process.execPath, ['--check', '--input-type=module'], { input: scripts[0][1] });
  assert.doesNotMatch(output, /<script\b[^>]*\bsrc=/i);
  assert.doesNotMatch(output, /<link\b[^>]*\brel="stylesheet"/i);
  assert.doesNotMatch(output, /@import\b/i);
  assert.doesNotMatch(output, /\b(?:src|poster)=["']https?:/i);
  assert.doesNotMatch(output, /url\(["']?https?:/i);
  assert.doesNotMatch(scripts[0][1], /\b(?:import\s|fetch\s*\(|XMLHttpRequest|WebSocket)/);
});

// A small syntax reader for the delivered CSS, independent of the build's
// import removal. Quotes and parentheses protect semicolons in font/data URLs.
// This checks declared surface contrast; browser layout remains separate QA.
function cssRules(text) {
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, ''), rules = [];
  const delimiter = (input, start, stops) => {
    let quote = '', depth = 0;
    for (let i = start; i < input.length; i++) {
      const char = input[i];
      if (char === '\\') { i++; continue; }
      if (quote) { if (char === quote) quote = ''; continue; }
      if (char === '"' || char === "'") { quote = char; continue; }
      if (char === '(') depth++;
      else if (char === ')') depth--;
      else if (!depth && stops.includes(char)) return i;
    }
    return input.length;
  };
  const read = input => {
    let offset = 0;
    while (offset < input.length) {
      const start = offset; const open = delimiter(input, offset, '{;');
      const selector = input.slice(start, open).trim();
      if (!selector) break;
      assert.equal(input[open], '{', `unexpected CSS statement outside a rule: ${selector.slice(0, 60)}`);
      let cursor = open + 1, depth = 1;
      while (depth && cursor < input.length) {
        const next = delimiter(input, cursor, '{}');
        if (next === input.length) break;
        depth += input[next] === '{' ? 1 : -1; cursor = next + 1;
      }
      assert.equal(depth, 0, `unclosed CSS rule: ${selector}`);
      const body = input.slice(open + 1, cursor - 1);
      if (selector.startsWith('@')) read(body);
      else {
        const declarations = {}; let at = 0;
        while (at < body.length) {
          const end = delimiter(body, at, ';'), statement = body.slice(at, end).trim();
          const colon = delimiter(statement, 0, ':');
          if (statement) { assert.ok(colon < statement.length, `invalid declaration: ${statement}`); declarations[statement.slice(0, colon).trim()] = statement.slice(colon + 1).trim(); }
          at = end + 1;
        }
        rules.push({ selectors: selector.split(',').map(item => item.trim()), declarations });
      }
      offset = cursor;
    }
  };
  read(clean); return rules;
}

test('delivered CSS retains valid theme rules and readable selected controls and case-study surfaces', async t => {
  assert.throws(() => cssRules("450;500;550&display=swap');\n:root{--pink:#fff}"), /unexpected CSS statement outside a rule/,
    'the old font-import truncation must fail syntax verification');
  const output = await readFile(new URL('AXO-World.html', root), 'utf8');
  const css = output.match(/<style\b[^>]*>([\s\S]*?)<\/style>/)?.[1]; assert.ok(css);
  const rules = cssRules(css);
  const rootRules = rules.filter(rule => rule.selectors.includes(':root'));
  assert.ok(rootRules.length, 'the theme must parse as an actual :root rule, not an orphaned font URL tail');
  const tokens = Object.assign({}, ...rootRules.map(rule => rule.declarations));
  const resolve = value => value?.replace(/var\((--[\w-]+)(?:,\s*([^()]+))?\)/g, (_, name, fallback) => {
    assert.ok(tokens[name] || fallback, `unresolved theme token ${name}`); return resolve(tokens[name] || fallback);
  });
  const style = (...selectors) => {
    const values = {};
    for (const rule of rules) if (rule.selectors.some(selector => selectors.includes(selector))) Object.assign(values, rule.declarations);
    return Object.fromEntries(Object.entries(values).map(([name, value]) => [name, resolve(value)]));
  };
  const color = value => {
    assert.match(value || '', /^#[\da-f]{3,8}$/i, `expected a resolved solid color, got ${value}`);
    let hex = value.slice(1); if (hex.length < 5) hex = [...hex].map(char => char + char).join('');
    assert.ok(hex.length === 6 || hex.length === 8);
    return [0,2,4,6].map((offset, index) => index === 3 && hex.length === 6 ? 1 : parseInt(hex.slice(offset, offset + 2),16) / 255);
  };
  const ratio = (foreground, background) => {
    const luminance = rgb => rgb.slice(0,3).reduce((sum, channel, index) => sum + (channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4) * [.2126,.7152,.0722][index], 0);
    const f = color(foreground), b = color(background); assert.equal(b[3], 1, 'reading and selected control surfaces must be opaque');
    const composite = f.slice(0,3).map((channel,index) => channel * f[3] + b[index] * (1 - f[3]));
    const [light,dark] = [luminance(composite),luminance(b)].sort((a,b) => b-a); return (light + .05) / (dark + .05);
  };
  const ratios = [];
  const readable = (label, values, backdrop) => {
    const contrast = ratio(values.color, values['background-color'] || values.background || backdrop);
    assert.ok(contrast >= 4.5, `${label} needs 4.5:1 normal-text contrast; got ${contrast.toFixed(2)}:1`);
    ratios.push(`${label} ${contrast.toFixed(2)}:1`);
  };
  readable('live case-study button', style('#journey-detail'));
  readable('selected roof label', style('.world-tag', '.world-tag[data-current=true]', '.world-tag[aria-current=step]'));
  readable('selected project menu', style('#project-nav button', '#project-nav button[aria-current=step]', '#project-nav button[aria-current=true]', '#project-nav button[data-current=true]'));
  readable('selected project filter', style('.pill-button', '.pill-button[aria-pressed=true]', '.project-filters .pill-button', '.project-filters .pill-button[aria-pressed=true]'));
  readable('saved project button', style('.save-project', '.save-project[aria-pressed=true]'));
  const panel = style('.content-panel'), body = style('#panel-body');
  const paper = body['background-color'] || body.background || panel['background-color'] || panel.background;
  readable('case-study prose', style('.case-section p', '.case-section li'), paper);
  readable('case-study section heading', style('.content-panel h3', '.case-section h3'), paper);
  t.diagnostic(`Declared contrast: ${ratios.join('; ')}.`);
});

test('day/night, reduced motion, visibility and orbit controls affect the world', () => {
  const h = appHarness({ reduced: true, storage: { 'axo.theme': 'night' } });
  assert.equal(h.state().build, 'axo-world');
  assert.equal(h.state().night, true);
  assert.equal(h.state().paused, true);
  assert.equal(h.get('motion-toggle').getAttribute('aria-label'), 'Resume animation');
  assert.deepEqual(h.lastCall('motion'), ['motion', false]);
  assert.deepEqual(h.cosmos.calls.filter(call => call[0] === 'motion').at(-1), ['motion', false], 'reduced motion must also pause the star layer');
  h.get('motion-toggle').click();
  assert.equal(h.state().paused, false);
  assert.deepEqual(h.lastCall('motion'), ['motion', true]);
  h.document.hidden = true; h.document.emit('visibilitychange');
  assert.deepEqual(h.lastCall('motion'), ['motion', false]);
  assert.deepEqual(h.cosmos.calls.filter(call => call[0] === 'motion').at(-1), ['motion', false], 'backgrounding stops both rendering layers');
  assert.equal(h.state().paused, false, 'backgrounding must preserve the user preference');
  h.document.hidden = false; h.document.emit('visibilitychange');
  assert.deepEqual(h.lastCall('motion'), ['motion', true]);
  h.media.emit('change', { matches: true });
  assert.equal(h.state().paused, true);
  h.get('theme-toggle').click();
  assert.equal(h.state().night, false);
  assert.equal(h.values.get('axo.theme'), 'day');
  h.get('rotate-left').click(); h.get('rotate-right').click();
  assert.deepEqual(h.world.calls.slice(-2), [['orbit', -.3], ['orbit', .3]]);
});

test('modal workshop flow restores focus and notes are text, persisted and downloadable', async () => {
  const h = appHarness(); const opener = h.button({ 'data-panel': 'work' });
  opener.focus(); opener.click();
  assert.equal(h.get('content-panel').open, true);
  assert.equal(h.document.body.style.overflow, 'hidden');
  assert.equal(h.document.activeElement, h.get('close-panel'));
  h.button({ 'data-project': 'notes' }).click();
  const note = '<img src=x onerror=alert(1)>\nAn idea from the lake.';
  h.get('field-note').value = note; h.get('field-note').emit('input');
  assert.equal(h.values.get('axo.field-notes'), note);
  h.get('download-note').click();
  assert.equal(await h.downloads[0].text(), note);
  h.button({ 'data-back': '' }).click();
  h.button({ 'data-project': 'notes' }).click();
  assert.equal(h.get('field-note').value, note);
  h.get('close-panel').click();
  assert.equal(h.get('content-panel').open, false);
  assert.equal(h.document.body.style.overflow, '');
  assert.equal(h.document.activeElement, opener, 'close must return to the original navigation control');
  assert.equal(h.state().panel, '');
});

test('missing WebGL and denied storage preserve navigation, notes and theme controls', () => {
  const h = appHarness({ webgl: false, blockedStorage: true });
  assert.equal(h.state().renderer, 'illustration');
  assert.equal(h.get('world-canvas').hidden, true);
  assert.equal(h.get('world-fallback').hidden, false);
  assert.equal(h.get('rotate-left').disabled, true);
  h.get('theme-toggle').click(); assert.equal(h.state().night, true);
  h.button({ 'data-panel': 'work' }).click();
  h.button({ 'data-project': 'notes' }).click();
  h.get('field-note').value = 'Still editable'; h.get('field-note').emit('input');
  assert.equal(h.get('save-status').textContent, 'Use Download to keep this note');
  h.get('close-panel').click(); assert.equal(h.get('content-panel').open, false);
  h.get('sound-toggle').click();
  assert.equal(h.state().sound, false, 'unavailable audio must leave the button state truthful');
});

test('persistent project navigation survives offscreen labels and loss of the WebGL context', () => {
  const h = appHarness(); let prevented = false;
  const anchors = layoutChapters(h);
  assert.equal(h.get('live-story').hidden, false);
  assert.equal(h.get('journey-detail').hidden, false, 'the intro banner always offers a next action');
  h.world.options.onFrame({ points: [...projectIds, 'axo'].map(id => ({ id, position: [0,1,0] })),
    width: 640, height: 640, project: () => ({ x: -500, y: -500, visible: false }) });
  const labels = ['Virtual Retail', 'Content Studio', 'Quote Works', 'Mission Control', 'Adoption Lab', 'Planning Bot'];
  projectIds.forEach((id, index) => {
    const persistent = h.get(`nav-${id}`);
    assert.ok(persistent, `${id} needs a persistent project choice`);
    assert.equal(persistent.getAttribute('title'), `Visit ${labels[index]}`);
    assert.equal(h.get(`building-${id}`).style.visibility, 'hidden', 'the scenario must really hide projected labels');
    assert.equal(persistent.hidden, false);
    assert.notEqual(persistent.style.visibility, 'hidden', 'persistent navigation must be independent of projection');
  });
  h.get('world-canvas').emit('webglcontextlost', { preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(h.world.destroyed, true, 'context loss must release animation and event resources');
  assert.equal(h.state().renderer, 'illustration');
  const callsBefore = h.world.calls.length;
  projectIds.forEach((id, index) => {
    const persistent = h.get(`nav-${id}`);
    assert.equal(persistent.hidden, false);
    assert.notEqual(persistent.style.visibility, 'hidden');
    persistent.click();
    near(h.window.scrollY, anchors[index], `${id} stays reachable after context loss`);
    assert.equal(h.state().currentStop, id);
    assert.equal(h.get('journey-detail').hidden, false);
  });
  assert.equal(h.get('project-next').disabled, true, 'the last project has a clear navigation endpoint');
  h.get('project-prev').click();
  assert.equal(h.state().currentStop, 'adoption');
  h.get('project-next').click();
  assert.equal(h.state().currentStop, 'learning');
  h.document.hidden = false; h.document.emit('visibilitychange');
  h.get('theme-toggle').click(); h.get('hello-button').click();
  assert.equal(h.world.calls.length, callsBefore, 'fallback controls must not call a destroyed renderer');
  assert.equal(h.get('content-panel').open, true);
});

const projectIds = ['retail', 'rxp', 'slides', 'playbooks', 'adoption', 'learning'];

test('case studies open immediately without starting a timed journey', () => {
  const h = appHarness();
  for (const id of projectIds) {
    const destination = h.button({ 'data-project': id });
    destination.click();
    assert.equal(h.get('content-panel').open, true, `${id} must open without waiting for an animation`);
    assert.equal(h.state().activeProject, id);
    assert.equal(h.lastCall('travel'), undefined, 'reading a case study must not start autonomous movement');
    assert.equal(h.lastCall('direct'), undefined, 'reading a case study must not move AXO to another building');
    assert.ok(h.get('panel-body').innerHTML.length > 200, `${id} needs a readable case study`);
    h.get('close-panel').click();
  }
  h.window.AXO.visit('rxp');
  assert.equal(h.state().activeProject, 'rxp', 'the public navigation API opens the same case study');
});

test('all six case studies remain reachable without WebGL and while motion is reduced', () => {
  for (const options of [{ webgl: false }, { reduced: true }]) {
    const h = appHarness(options);
    for (const id of projectIds) {
      h.window.AXO.visit(id);
      assert.equal(h.state().activeProject, id);
      assert.equal(h.get('content-panel').open, true);
      const figure = h.get('panel-body').querySelector('figure.artifact-figure');
      assert.equal(figure?.dataset.artifactProject, id, 'every case needs its own inline illustration even without 3D');
      h.get('close-panel').click(); h.flushHistory();
    }
    if (options.reduced) {
      assert.equal(h.state().paused, true, 'opening case studies must respect reduced motion');
      assert.deepEqual(h.lastCall('motion'), ['motion', false]);
      layoutChapters(h);
      h.window.AXO.scrollToProject('learning');
      assert.equal(h.lastCall('direct')[1], 'learning');
      assert.equal(h.lastCall('direct')[2].animate, false, 'reduced motion must use an immediate destination');
      assert.equal(h.window.scrollCalls.at(-1).behavior, 'instant');
    }
  }
});

test('project lists and the live project banner restore focus after closing a case study', () => {
  const h = appHarness();
  const opener = h.button({ 'data-panel': 'work' });
  opener.focus(); opener.click();
  const card = h.button({ 'data-project': 'retail' });
  card.focus(); card.click();
  assert.equal(h.state().activeProject, 'retail');
  assert.equal(h.document.activeElement, h.get('close-panel'));
  h.get('close-panel').click();
  assert.equal(h.document.activeElement, opener,
    'focus must return to the external opener, because the modal project card was replaced');
  assert.equal(h.state().panel, '');
  const anchors = layoutChapters(h);
  scrollPage(h, anchors[2]);
  const caption = h.get('journey-detail');
  assert.equal(caption.hidden, false, 'selected project exposes the visible caption opener');
  assert.equal(h.get('journey-title').textContent, 'Automated Quote Generation');
  caption.focus(); caption.click();
  assert.equal(h.state().activeProject, 'slides');
  h.get('close-panel').click();
  assert.equal(h.document.activeElement, caption, 'native caption opener receives focus after reading');
});

function layoutChapters(h, { firstTop = 1000, gap = 1000, height = 800, viewportHeight = 900, viewportWidth = 1440, pageHeight = 7600 } = {}) {
  h.window.innerHeight = viewportHeight;
  h.window.innerWidth = viewportWidth;
  h.document.documentElement.scrollHeight = pageHeight;
  h.document.body.scrollHeight = pageHeight;
  const sections = projectIds.map((id, index) => {
    const section = h.get(`chapter-${id}`);
    assert.ok(section, `${id} needs a scroll chapter`);
    section.layout = { top: firstTop + index * gap, height, width: viewportWidth };
    return section;
  });
  h.window.emit('resize'); h.flushFrame();
  return sections.map(section => Math.max(0, Math.min(pageHeight - viewportHeight,
    section.layout.top + height / 2 - viewportHeight * .5)));
}

function scrollPage(h, top) {
  h.window.scrollTo({ top });
  h.flushFrame();
}

const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-6, `${message}: got ${actual}, expected ${expected}`);

test('page scroll uses physical chapter geometry, reaches each stop, and reverses consistently', () => {
  const h = appHarness();
  const anchors = layoutChapters(h);
  scrollPage(h, 0);
  near(h.state().scrollProgress, 0, 'page origin');
  for (let index = 0; index < anchors.length; index++) {
    scrollPage(h, anchors[index]);
    near(h.state().scrollProgress, (index + 1) / 6, `${projectIds[index]} page anchor`);
    near(h.lastCall('scrollProgress')[1], (index + 1) / 6, 'renderer progress must follow page geometry');
  }
  scrollPage(h, (anchors[0] + anchors[1]) / 2);
  near(h.state().scrollProgress, .25, 'reverse scrolling interpolates by chapter distance');
  const progress = h.state().scrollProgress;
  const calls = h.world.calls.filter(call => call[0] === 'scrollProgress').length;
  for (let count = 0; count < 20; count++) h.window.emit('scroll');
  h.flushFrame();
  near(h.state().scrollProgress, progress, 'events at rest must not increment the journey');
  assert.equal(h.world.calls.filter(call => call[0] === 'scrollProgress').length, calls,
    'unchanged scroll position must not repeatedly drive the renderer');
  scrollPage(h, h.document.documentElement.scrollHeight - h.window.innerHeight);
  near(h.state().scrollProgress, 1, 'page bottom');
});

test('scroll destinations and resize use recalculated desktop and mobile page anchors', () => {
  const h = appHarness();
  const desktop = layoutChapters(h);
  const effectStart = h.effects.length;
  h.window.AXO.scrollToProject('slides'); h.flushFrame();
  near(h.window.scrollY, desktop[2], 'project navigation scroll target');
  near(h.state().scrollProgress, .5, 'project navigation updates the actual page journey');
  assert.equal(h.get('content-panel').open, false, 'destination scrolling must not open a reading dialog');
  const effects = h.effects.slice(effectStart);
  const direct = effects.findIndex(effect => effect[0] === 'direct');
  const page = effects.findIndex(effect => effect[0] === 'page-scroll');
  assert.ok(direct >= 0 && direct < page, 'the direct destination override must be prepared before jumping the page');
  assert.deepEqual(effects[direct].slice(0, 3), ['direct', 'slides', true]);
  assert.equal(effects[page][2], 'instant', 'a clicked destination must skip intermediate page chapters');
  const destinationProgress = effects.slice(direct + 1).filter(effect => effect[0] === 'world-scroll').map(effect => effect[1]);
  assert.ok(destinationProgress.length > 0 && destinationProgress.every(progress => Math.abs(progress - .5) < 1e-6),
    'the page jump should send only the selected endpoint progress to the renderer');
  const mobile = layoutChapters(h, { viewportWidth: 390, viewportHeight: 844 });
  assert.notEqual(mobile[2], desktop[2], 'viewport resizing changes the chapter center anchor');
  assert.notEqual(h.state().scrollProgress, .5, 'resize must recalculate progress for the current page geometry');
  h.window.AXO.scrollToProject('slides'); h.flushFrame();
  near(h.window.scrollY, mobile[2], 'mobile navigation target');
  near(h.state().scrollProgress, .5, 'mobile chapter anchor');
  const calls = h.window.scrollCalls.length;
  h.window.AXO.scrollToProject('missing-project');
  assert.equal(h.window.scrollCalls.length, calls, 'invalid project must not move the page');
  const rounded = appHarness({ roundedScroll: true });
  const fractional = layoutChapters(rounded, { firstTop: 1000.37, gap: 1000.3, height: 800.21 });
  rounded.window.AXO.scrollToProject('rxp');
  assert.notEqual(rounded.window.scrollY, fractional[1], 'the harness emulates native fractional scroll rounding');
  near(rounded.state().scrollProgress, 1 / 3, 'rounded chapter anchor must retain the exact chosen endpoint');
  assert.equal(rounded.state().currentStop, 'rxp', 'fractional rounding must not activate the following building');
  near(rounded.lastCall('scrollProgress')[1], 1 / 3, 'the renderer receives the exact destination progress after rounding');
});

test('cold project links align the town, open the case and close safely within the same document', () => {
  for (const webgl of [true, false]) {
    const h = appHarness({ hash: '#work/slides', webgl });
    assert.equal(h.window.location.hash, '#work/slides'); assert.equal(h.state().activeProject, 'slides');
    assert.equal(h.get('content-panel').open, true); assert.equal(h.state().reading, true);
    assert.equal(h.cosmos.reading, true); assert.ok(h.get('panel-body').querySelector('figure.artifact-figure'));
    const step = h.get('panel-body').querySelector('[data-arch-step="2"]'); step.focus(); step.click();
    assert.match(h.get('panel-body').querySelector('.arch-readout').textContent, /Step 02/);
    assert.equal(h.document.activeElement, step);
    if (webgl) { assert.equal(h.world.reading, true); assert.deepEqual(h.lastCall('direct').slice(0,2), ['direct','slides']); assert.equal(h.lastCall('direct')[2].animate, false); }
    h.get('close-panel').click(); h.flushHistory();
    assert.equal(h.window.location.hash, '#place/slides'); assert.equal(h.get('content-panel').open, false);
    assert.equal(h.state().reading, false); assert.equal(h.cosmos.reading, false);
    assert.equal(h.historyCalls.some(call => call[0] === 'go'), false, 'closing a cold deep link must not leave the document');
  }
  const invalid = appHarness({ hash: '#work/__proto__' });
  assert.equal(invalid.window.location.hash, '#home'); assert.equal(invalid.get('content-panel').open, false);
  const local = appHarness({ hash: '#work/retail', baseURL: 'file:///portfolio/AXO-World.html' });
  local.document.querySelector('[data-copy-project-link=retail]').click();
  assert.equal(local.get('project-link-fallback').hidden, false);
  assert.equal(local.get('project-link-field').value, '#work/retail', 'a local project link must not expose a machine-specific file path');
  assert.equal(local.downloads.length, 0, 'copying a project anchor must not create a download');
  const flora = appHarness({ hash: '#flora' });
  assert.equal(flora.state().panel, 'flora'); assert.equal(flora.state().reading, true);
  for (const name of ['Dahlia scapigera','Cosmos atrosanguineus','Tigridia vanhouttei','Laelia speciosa','Nymphaea gracilis']) assert.ok(flora.get('panel-body').innerHTML.includes(name));
  assert.ok(flora.get('panel-body').querySelectorAll('a').length >= 5, 'the botanical guide must retain its source links');
});

test('Back and Forward restore nested case routes, exact town orientation and focus without history loops', () => {
  const h = appHarness({ hash: '#place/slides', queuedDialogClose: true });
  h.world.orbit(.187);
  const opener = h.get('journey-detail'); opener.focus();
  const before = { y: h.window.scrollY, rotation: h.world.getScrollState().worldRotation, offset: h.world.getScrollState().manualRotationOffset };
  opener.click(); assert.equal(h.window.location.hash, '#work/slides'); assert.equal(h.world.reading, true);
  h.get('content-panel').scrollTop = 267; h.get('content-panel').emit('scroll');
  h.window.AXO.visit('playbooks'); assert.equal(h.window.location.hash, '#work/playbooks');
  h.get('content-panel').scrollTop = 128; h.get('content-panel').emit('scroll');
  const length = h.window.history.length, calls = h.historyCalls.length;
  h.window.history.back(); h.flushHistory(); h.flushDialogCloses();
  assert.equal(h.state().activeProject, 'slides'); assert.equal(h.window.location.hash, '#work/slides');
  assert.equal(h.get('content-panel').open, true); assert.equal(h.world.reading, true, 'a queued native close from the old case must not blank the reopened one');
  assert.equal(h.get('content-panel').scrollTop, 267, 'Back restores the previous case-study reading position');
  assert.equal(h.window.history.length, length); assert.equal(h.historyCalls.slice(calls).some(call => call[0] === 'push'), false);
  h.window.history.forward(); h.flushHistory(); h.flushDialogCloses();
  assert.equal(h.state().activeProject, 'playbooks'); assert.equal(h.window.location.hash, '#work/playbooks');
  assert.equal(h.get('content-panel').scrollTop, 128, 'Forward restores the later case-study reading position');
  h.get('close-panel').click(); h.flushDialogCloses(); h.flushHistory();
  assert.equal(h.window.location.hash, '#place/slides'); assert.equal(h.get('content-panel').open, false);
  near(h.window.scrollY, before.y, 'return scroll position');
  near(h.world.getScrollState().worldRotation, before.rotation, 'return physical world rotation');
  near(h.world.getScrollState().manualRotationOffset, before.offset, 'return manual orientation offset');
  assert.equal(h.document.activeElement, opener); assert.equal(h.world.reading, false); assert.equal(h.state().paused, false);
  assert.equal(h.window.history.length, length, 'closing a nested case must traverse its entries rather than append another route');
  h.window.history.forward(); h.flushHistory(); h.flushDialogCloses(); assert.equal(h.state().activeProject, 'slides');
  const paused = appHarness({ reduced: true }); paused.window.AXO.visit('retail'); paused.get('close-panel').click(); paused.flushHistory();
  assert.equal(paused.state().paused, true); assert.deepEqual(paused.lastCall('motion'), ['motion', false]);
  const home = appHarness({ hash: '#place/playbooks' }); home.world.orbit(.263);
  const orientation = home.world.getScrollState().worldRotation, offset = home.world.getScrollState().manualRotationOffset;
  home.document.querySelector('a[href="#home"]').click(); assert.equal(home.window.location.hash, '#home');
  home.window.history.back(); home.flushHistory();
  assert.equal(home.window.location.hash, '#place/playbooks');
  near(home.world.getScrollState().worldRotation, orientation, 'Back from Home must restore the manual angle');
  near(home.world.getScrollState().manualRotationOffset, offset, 'Back from Home must restore the manual offset');
});

test('continuous input bounds history serialization while Back and Forward retain the latest cached snapshot', () => {
  const h = appHarness({ hash: '#place/slides' });
  const replacements = () => h.historyCalls.filter(call => call[0] === 'replace').length;
  const before = replacements();
  for (let step = 0; step < 200; step++) { h.world.orbit(.0001); h.world.options.onInteraction?.('orbit'); }
  for (let step = 1; step <= 30; step++) { h.window.scrollY += 3; h.window.emit('scroll'); }
  assert.ok(replacements() - before <= 2, 'a burst of scroll and orbit input must not serialize hundreds of history entries');
  h.advanceTime(1100);
  assert.ok(replacements() - before <= 3, 'idle serialization must remain bounded');
  const sustained = replacements();
  for (let burst = 0; burst < 4; burst++) {
    for (let step = 0; step < 20; step++) { h.world.orbit(.0001); h.world.options.onInteraction?.('orbit'); }
    h.advanceTime(250);
  }
  assert.ok(replacements() - sustained <= 2, 'regular input must respect the serialization rate cap, not only the idle debounce');
  h.advanceTime(1100);
  const orientation = h.world.getScrollState().worldRotation, baseHash = h.window.location.hash;
  near(h.window.history.state.axo.snapshot.journey.worldRotation, orientation, 'idle history should contain the latest actual orientation');
  h.window.AXO.visit('slides');
  const modalWrites = replacements();
  for (let top = 1; top <= 150; top++) { h.get('content-panel').scrollTop = top; h.get('content-panel').emit('scroll'); }
  assert.ok(replacements() - modalWrites <= 1, 'reading scroll must update the cache without serializing every event');
  h.window.history.back(); h.flushHistory();
  assert.equal(h.window.location.hash, baseHash); near(h.world.getScrollState().worldRotation, orientation, 'Back must retain the newest orientation');
  h.window.history.forward(); h.flushHistory();
  assert.equal(h.state().activeProject, 'slides'); assert.equal(h.get('content-panel').scrollTop, 150, 'Forward must restore a reading position cached before the idle timer fired');
  h.window.history.back(); h.flushHistory(); const length = h.window.history.length;
  h.advanceTime(10000);
  assert.equal(h.window.location.hash, baseHash, 'a stale timer must not replace a different active route');
  assert.equal(h.window.history.length, length); assert.equal(h.window.history.state.axo.hash, baseHash);
});

test('project previews respond to hover and focus while touch activation makes one intentional visit', () => {
  const h = appHarness(), pushes = () => h.historyCalls.filter(call => call[0] === 'push').length;
  const before = pushes();
  h.document.emit('pointerover', { target: h.get('nav-slides'), pointerType: 'mouse' });
  assert.equal(h.state().preview, 'slides'); assert.equal(h.get('project-preview').hidden, false);
  assert.equal(h.world.highlighted, 'slides'); assert.equal(pushes(), before);
  h.get('nav-playbooks').focus(); assert.equal(h.state().preview, 'playbooks');
  h.document.emit('pointerover', { target: h.get('nav-rxp'), pointerType: 'touch' });
  assert.equal(h.state().preview, 'playbooks', 'touch must not depend on hover');
  const direct = h.world.calls.filter(call => call[0] === 'direct').length;
  h.get('nav-rxp').click();
  assert.equal(h.world.calls.filter(call => call[0] === 'direct').length, direct + 1);
  assert.equal(h.window.location.hash, '#place/rxp'); assert.equal(pushes(), before + 1);
  assert.equal(h.get('project-preview').hidden, true);
  h.get('project-preview-toggle').click(); assert.equal(h.get('project-preview').hidden, false);
  assert.equal(h.get('preview-visit').dataset.destination, 'rxp');
  const visits = h.world.calls.filter(call => call[0] === 'direct').length;
  h.get('preview-visit').click(); assert.equal(h.world.calls.filter(call => call[0] === 'direct').length, visits + 1);
  h.get('project-preview-toggle').click(); h.document.emit('keydown', { key: 'Escape' });
  assert.equal(h.get('project-preview').hidden, true); assert.equal(h.document.activeElement, h.get('project-preview-toggle'));
});

test('location text follows physical arrival and projected labels avoid the banner without hiding persistent navigation', () => {
  const h = appHarness();
  h.world.arrival = { status: 'travelling', currentProject: null, targetProject: 'slides', lastPassedProject: 'rxp' };
  h.world.options.onFrame(h.world); assert.equal(h.get('axo-location').textContent, 'Heading to Quote Works');
  h.world.settle('slides'); assert.equal(h.get('axo-location').textContent, 'At Quote Works');
  h.world.arrival = { status: 'between', currentProject: null, targetProject: 'playbooks', lastPassedProject: 'slides' };
  h.world.options.onFrame(h.world); assert.equal(h.get('axo-location').textContent, 'Exploring the stone causeway');
  h.get('live-story').layout = { left: 400, top: 80, width: 620, height: 200 };
  h.get('project-nav').layout = { left: 1200, top: 300, width: 190, height: 300 };
  h.get('project-preview').layout = { left: 20, top: 500, width: 300, height: 200 };
  h.document.querySelector('.world-controls').layout = { left: 500, top: 820, width: 400, height: 60 };
  h.world.width = 1440; h.world.height = 900;
  h.world.points = [{ id: 'retail', position: [650,160] }, { id: 'rxp', position: [300,600] }];
  h.world.project = position => ({ x: position[0], y: position[1], visible: true });
  h.world.options.onFrame(h.world);
  assert.equal(h.get('building-retail').style.visibility, 'hidden'); assert.equal(h.get('building-retail').dataset.occluded, 'true');
  assert.equal(h.get('building-rxp').style.visibility, 'visible'); assert.equal(h.get('nav-retail').hidden, false);
  h.get('building-retail').focus(); h.world.options.onFrame(h.world);
  assert.equal(h.get('building-retail').style.visibility, 'visible', 'an active keyboard focus target must be retained');
  assert.ok(parseFloat(h.get('building-retail').style.top) - h.get('building-retail').offsetHeight > 286, 'the focused label must move below the banner');
});

test('an arrived destination label uses the first unobstructed position while other occluded labels stay hidden', () => {
  const h = appHarness();
  h.world.width = 1440; h.world.height = 900;
  h.world.points = [{ id: 'retail', position: [650,160] }, { id: 'rxp', position: [700,160] }, { id: 'slides', position: [300,600] }];
  h.world.project = position => ({ x: position[0], y: position[1], visible: true });
  assert.equal(h.window.AXO.scrollToProject('retail', { animate: false, route: false }), true);
  assert.equal(h.state().currentStop, 'retail');
  assert.equal(h.world.getArrivalState().currentProject, 'retail');
  const retail = h.get('building-retail'), other = h.get('building-rxp');
  assert.notEqual(h.document.activeElement, retail, 'arrival must protect the label without requiring keyboard focus');
  // The DOM double uses document coordinates; these obstacles occupy the same
  // viewport positions after direct travel as before scrolling.
  h.get('live-story').layout = { left: 400, top: h.window.scrollY + 80, width: 620, height: 200 };
  h.get('project-nav').layout = { left: 580, top: h.window.scrollY + 300, width: 160, height: 70 };
  h.document.querySelector('.world-controls').layout = { left: 500, top: h.window.scrollY + 820, width: 400, height: 60 };
  h.world.options.onFrame(h.world);
  assert.equal(retail.style.visibility, 'visible', 'the arrived destination label must remain visible behind an obstruction');
  assert.equal(retail.dataset.occluded, 'false');
  assert.equal(parseFloat(retail.style.left), 720, 'the first candidate below the banner is blocked by navigation, so use the next free candidate');
  assert.equal(parseFloat(retail.style.top), 522);
  const box = { left: parseFloat(retail.style.left) - retail.offsetWidth / 2, right: parseFloat(retail.style.left) + retail.offsetWidth / 2, top: parseFloat(retail.style.top) - retail.offsetHeight, bottom: parseFloat(retail.style.top) };
  for (const obstacle of [h.get('live-story'), h.get('project-nav'), h.document.querySelector('.world-controls')]) {
    const rect = obstacle.getBoundingClientRect();
    assert.ok(box.right <= rect.left - 6 || box.left >= rect.right + 6 || box.bottom <= rect.top - 6 || box.top >= rect.bottom + 6,
      `the destination label must clear ${obstacle.id || 'world controls'} with the normal margin`);
  }
  assert.equal(other.style.visibility, 'hidden', 'an occluded noncurrent label must retain the ordinary hiding behavior');
  assert.equal(other.dataset.occluded, 'true');
  assert.equal(h.get('building-slides').style.visibility, 'visible');
  assert.equal(parseFloat(h.get('building-slides').style.left), 300);
  assert.equal(parseFloat(h.get('building-slides').style.top), 588, 'an unobstructed noncurrent label keeps its projected position');
});

function rendererHarness() {
  const { document } = makeDOM(); const canvas = document.querySelector('#world-canvas');
  let nextId = 0; const frames = new Map(); const uploads = new Map(); const bound = new Map();
  const calls = { draws: 0, matrices: 0, deletes: 0, uniforms: new Map() };
  const constants = ['ARRAY_BUFFER','ELEMENT_ARRAY_BUFFER','STATIC_DRAW','VERTEX_SHADER','FRAGMENT_SHADER','COMPILE_STATUS','LINK_STATUS','COLOR_BUFFER_BIT','DEPTH_BUFFER_BIT','DEPTH_TEST','LEQUAL','CULL_FACE','BACK','FRONT','BLEND','SRC_ALPHA','ONE_MINUS_SRC_ALPHA','FLOAT','TRIANGLES','UNSIGNED_SHORT'];
  const gl = Object.fromEntries(constants.map((name, i) => [name, 1 << i]));
  for (const name of ['shaderSource','compileShader','attachShader','linkProgram','deleteShader','viewport','clearColor','clear','enable','disable','depthFunc','cullFace','useProgram','enableVertexAttribArray','vertexAttribPointer','blendFunc','depthMask']) gl[name] = () => {};
  for (const name of ['createShader','createProgram','createBuffer']) gl[name] = () => ({ id: ++nextId });
  gl.getShaderParameter = gl.getProgramParameter = () => true;
  gl.getAttribLocation = (_, name) => name; gl.getUniformLocation = (_, name) => name;
  gl.bindBuffer = (target, buffer) => bound.set(target, buffer);
  gl.bufferData = (target, data) => {
    assert.ok(data.length > 0); assert.ok([...data].every(Number.isFinite), 'geometry must contain finite values');
    uploads.set(bound.get(target), data);
  };
  for (const name of ['uniformMatrix4fv','uniformMatrix3fv']) gl[name] = (_, transpose, values) => {
    assert.equal(transpose, false); assert.ok(values.every(Number.isFinite), 'camera/model/normal matrices must be finite'); calls.matrices++;
  };
  for (const name of ['uniform3fv','uniform4fv']) gl[name] = (location, values) => {
    assert.ok(values.every(Number.isFinite)); calls.uniforms.set(location, [...values]);
  };
  gl.uniform1f = (_, value) => assert.ok(Number.isFinite(value));
  gl.drawElements = (_, count) => {
    const index = uploads.get(bound.get(gl.ELEMENT_ARRAY_BUFFER));
    assert.ok(index && count === index.length, 'each draw must address its uploaded index buffer'); calls.draws++;
  };
  gl.deleteBuffer = gl.deleteProgram = () => { calls.deletes++; };
  canvas.getContext = () => gl;
  const window = Object.assign(new Events(), { devicePixelRatio: 3 });
  let now = 1000;
  const context = vm.createContext({ document, window, console, performance: { now: () => now },
    requestAnimationFrame(callback) { frames.set(++nextId, callback); return nextId; },
    cancelAnimationFrame(id) { frames.delete(id); } });
  vm.runInContext(worldSource.replace('export class World', 'class World') + '\nglobalThis.World = World;', context);
  const interactions = [], arrivals = [], destinations = []; let clicks = 0;
  const world = new context.World({ canvas, onMascotClick: () => clicks++, onInteraction: (type) => interactions.push(type), onArrival: (id) => arrivals.push(id), onProjectClick: (id) => destinations.push(id) });
  const frame = (time) => { now = time; const queued = [...frames.values()]; frames.clear(); queued.forEach((callback) => callback(time)); };
  return { world, canvas, gl, frames, uploads, calls, document, window, interactions, arrivals, destinations, frame, clicks: () => clicks };
}

test('real renderer builds valid geometry and draws finite camera/model transforms', () => {
  const h = rendererHarness();
  assert.equal(h.canvas.width, 1280, 'pixel ratio is capped for high density displays');
  for (const geometry of h.world.geometries) {
    const positions = h.uploads.get(geometry.position); const normals = h.uploads.get(geometry.normal); const indices = h.uploads.get(geometry.index);
    assert.equal(positions.length, normals.length);
    assert.equal(indices.length % 3, 0);
    assert.ok([...indices].every((index) => index < positions.length / 3), 'triangles must address real vertices');
  }
  h.frame(1000); h.frame(1033);
  assert.ok(h.calls.draws > 100, 'a complete scene should be drawn');
  assert.ok(h.calls.matrices > h.calls.draws);
  const before = Array.from(h.world.vp), beforeRotation = h.world.island.r[1];
  h.world.orbit(.4); h.frame(1066);
  assert.notEqual(h.world.island.r[1], beforeRotation, 'manual rotation must turn the actual town root');
  assert.deepEqual(Array.from(h.world.vp), before, 'manual rotation keeps the rider camera fixed');
  h.world.setTheme('night'); h.frame(1099); assert.ok(h.world.night > 0);
  h.world.setMotion(false); const pausedAt = h.world.time;
  h.frame(1132); h.frame(1165); assert.equal(h.world.time, pausedAt, 'paused idle motion must stop accumulating time');
  const p = h.world.project([0, 1.3, 0]); assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
  h.world.destroy(); assert.equal(h.frames.size, 0); assert.ok(h.calls.deletes > 0);
});

test('real renderer distinguishes a tap, a drag and a cancelled gesture and removes listeners', () => {
  const h = rendererHarness();
  const pointer = (type, x, y, pointerType = 'mouse') => h.canvas.emit(type, { button: 0, pointerId: 1, clientX: x, clientY: y, pointerType });
  pointer('pointerdown', 10, 10); pointer('pointerup', 10, 10); assert.equal(h.clicks(), 0, 'empty canvas taps must not greet AXO');
  const actor = h.world.project([0, h.world.mascot.p[1] + .34, h.world.trackRadius]);
  pointer('pointerdown', actor.x, actor.y); pointer('pointerup', actor.x, actor.y); assert.equal(h.clicks(), 1);
  pointer('pointerdown', actor.x, actor.y, 'touch'); pointer('pointerup', actor.x, actor.y, 'touch');
  assert.equal(h.clicks(), 2, 'a touch tap must pick AXO at release without requiring a prior hover');
  const beforeTouchScroll = h.world.island.r[1];
  pointer('pointerdown', actor.x, actor.y, 'touch'); pointer('pointermove', actor.x, actor.y + 50, 'touch'); pointer('pointerup', actor.x, actor.y + 50, 'touch');
  assert.equal(h.clicks(), 2, 'a touch scroll must not activate AXO');
  near(h.world.island.r[1], beforeTouchScroll, 'vertical touch scrolling must not rotate the town');
  const rotation = h.world.island.r[1];
  pointer('pointerdown', 10, 10); pointer('pointermove', 60, 20); pointer('pointerup', 60, 20);
  assert.equal(h.clicks(), 2); assert.notEqual(h.world.island.r[1], rotation);
  pointer('pointerdown', 10, 10); pointer('pointercancel', 10, 10); assert.equal(h.clicks(), 2);
  h.world.destroy(); pointer('pointerdown', 10, 10); pointer('pointerup', 10, 10); assert.equal(h.clicks(), 2);
  assert.ok([...h.canvas.listeners.values()].every((listeners) => listeners.size === 0));
});

test('the radial town turns under a fixed small character while its camera stays still', () => {
  const h = rendererHarness();
  const points = projectIds.map(id => h.world.points.find(point => point.id === id));
  assert.ok(points.every(Boolean), 'every portfolio project needs a world hotspot');
  assert.equal(new Set(points.map(point => point.position.join(','))).size, projectIds.length);
  assert.ok(h.world.mascot.s.every(scale => scale < .4), 'AXO remains a small foreground character');
  assert.equal(h.world.bicycle, undefined, 'the town must not add a bicycle to AXO');
  assert.equal(h.world.bikeWheels, undefined);
  assert.ok(h.world.mascot.p[1] >= .63 && h.world.mascot.p[1] < .68, 'AXO stands at the promenade surface');
  assert.ok(h.world.legs.every(leg => Math.abs(leg.r[0]) < .35), 'the initial stance must not retain a cycling pose');
  const rider = [h.world.mascot.p[0], h.world.mascot.p[2]];
  const sample = (progress) => {
    h.world.setScrollProgress(progress);
    return { rotation: h.world.island.r[1], position: [h.world.mascot.p[0], h.world.mascot.p[2]],
      camera: Array.from(h.world.vp), landmark: Array.from(points[0].position) };
  };
  const start = sample(0), middle = sample(.5), end = sample(1);
  assert.notEqual(middle.rotation, start.rotation, 'scroll rotates the actual town root');
  assert.notEqual(end.rotation, middle.rotation);
  assert.deepEqual(middle.position, rider, 'AXO must stay fixed while the scenery turns');
  assert.deepEqual(end.position, rider);
  assert.deepEqual(middle.camera, start.camera, 'scroll must rotate the world instead of orbiting the camera');
  assert.deepEqual(end.camera, start.camera);
  assert.notDeepEqual(middle.landmark, start.landmark, 'project anchors must follow the rotating buildings');
  near(h.world.getScrollState().worldRotation, end.rotation, 'public state reports the town transform');
  h.world.destroy();
});

test('world rotation has no time drift and backward scrolling restores the same scene transform', () => {
  const h = rendererHarness();
  const rider = [h.world.mascot.p[0], h.world.mascot.p[2]];
  h.frame(1000);
  h.world.setScrollProgress(.37); const sample = h.world.island.r[1];
  const retail = h.world.points.find(point => point.id === 'retail');
  const landmark = [retail.position[0], retail.position[2]];
  for (let frame = 1; frame <= 80; frame++) h.frame(1000 + frame * 50);
  near(h.world.island.r[1], sample, 'elapsed animation must not spin the town');
  assert.deepEqual([h.world.mascot.p[0], h.world.mascot.p[2]], rider);
  h.world.setScrollProgress(.86); h.world.setScrollProgress(.37);
  near(h.world.island.r[1], sample, 'reverse scroll restores exact world rotation');
  assert.deepEqual([retail.position[0], retail.position[2]], landmark);
  const arrivals = h.arrivals.length;
  h.world.setScrollProgress(.37);
  assert.equal(h.arrivals.length, arrivals, 'unchanged progress must not repeat announcements');
  h.world.setMotion(false); h.world.setScrollProgress(.72);
  assert.notEqual(h.world.island.r[1], sample, 'explicit user scroll still controls scenery with ambient motion paused');
  const reducedRotation = h.world.island.r[1];
  h.frame(5050); h.frame(5100);
  near(h.world.island.r[1], reducedRotation, 'paused ambient motion keeps the sampled scene stable');
  assert.deepEqual([h.world.mascot.p[0], h.world.mascot.p[2]], rider);
  h.world.destroy();
});

test('six evenly spaced project buildings align behind AXO at their chapter stops', () => {
  const h = rendererHarness();
  assert.deepEqual(Array.from(h.world.scrollStops, stop => stop.id), projectIds);
  const buildings = projectIds.map(id => h.world.points.find(point => point.id === id));
  const radius = Math.hypot(buildings[0].position[0], buildings[0].position[2]);
  const angles = buildings.map(point => {
    near(Math.hypot(point.position[0], point.position[2]), radius, 'buildings share the same radial promenade');
    return Math.atan2(point.position[2], point.position[0]);
  }).sort((a, b) => a - b);
  for (let index = 0; index < angles.length; index++) {
    const next = index === 5 ? angles[0] + 2 * Math.PI : angles[index + 1];
    near(next - angles[index], Math.PI / 3, 'radial buildings are evenly spaced');
  }
  for (let index = 0; index < projectIds.length; index++) {
    const id = projectIds[index], progress = (index + 1) / 6;
    h.world.setScrollProgress(progress);
    const point = h.world.points.find(item => item.id === id);
    near(point.position[0], h.world.mascot.p[0], `${id} aligns horizontally behind AXO`);
    assert.ok(point.position[2] < h.world.mascot.p[2], `${id} belongs to the scenery behind the foreground rider`);
    const stop = h.world.getWorldStop(id);
    near(stop[0], h.world.mascot.p[0], `${id} promenade stop aligns with the foreground AXO`);
    near(stop[2], h.world.mascot.p[2], `${id} promenade stop reaches the foreground track position`);
    near(h.world.getScrollState().progress, progress, `${id} progress`);
  }
  h.world.setScrollProgress(10); near(h.world.getScrollState().progress, 1, 'page end clamps');
  h.world.setScrollProgress(-10); near(h.world.getScrollState().progress, 0, 'page start clamps');
  h.world.destroy();
});

test('manual controls turn the scenery while the camera and AXO remain anchored', () => {
  const h = rendererHarness();
  h.world.setScrollProgress(.28); const first = h.world.island.r[1];
  h.world.setScrollProgress(.74); const later = h.world.island.r[1];
  h.world.setScrollProgress(.28); h.frame(1000);
  const before = Array.from(h.world.vp), rider = [h.world.mascot.p[0], h.world.mascot.p[2]];
  h.world.orbit(.37);
  for (let frame = 1; frame <= 20; frame++) h.frame(1000 + frame * 50);
  near(h.world.island.r[1], first + .37, 'manual controls add a world rotation offset');
  assert.deepEqual(Array.from(h.world.vp), before, 'manual controls keep the camera fixed');
  assert.deepEqual([h.world.mascot.p[0], h.world.mascot.p[2]], rider);
  h.world.setScrollProgress(.74);
  near(h.world.island.r[1], later + .37, 'scroll preserves the manual scenery offset');
  assert.deepEqual(Array.from(h.world.vp), before);
  h.world.beginDirectTravel('learning', { animate: false });
  near(h.world.points.find(point => point.id === 'learning').position[0], h.world.mascot.p[0],
    'choosing a destination resets the manual offset so its building aligns with AXO');
  h.world.destroy();
});

test('clicked destination turns the world along the shortest arc and announces only that building', () => {
  const h = rendererHarness();
  h.frame(1000); h.world.setScrollProgress(.23);
  const rider = [h.world.mascot.p[0], h.world.mascot.p[2]];
  const before = h.world.island.r[1], camera = Array.from(h.world.vp); h.arrivals.length = 0;
  assert.equal(h.world.beginDirectTravel('learning', { animate: true }), true);
  near(h.world.getScrollState().progress, 1, 'selected destination owns the logical chapter immediately');
  assert.equal(h.world.getScrollState().transitioning, true);
  near(h.world.island.r[1], before, 'the destination turn begins at the current world angle');
  h.world.setScrollProgress(1); h.world.setScrollProgress(1 - .0001);
  assert.equal(h.world.getScrollState().transitioning, true, 'native fractional rounding preserves the direct turn');
  let previous = before, totalAngle = 0;
  for (let frame = 1; frame < 80 && h.world.getScrollState().transitioning; frame++) {
    h.frame(1000 + frame * 50);
    const rotation = h.world.island.r[1];
    totalAngle += Math.abs(Math.atan2(Math.sin(rotation - previous), Math.cos(rotation - previous)));
    previous = rotation;
    assert.deepEqual([h.world.mascot.p[0], h.world.mascot.p[2]], rider, 'AXO stays anchored during destination rotation');
    assert.deepEqual(Array.from(h.world.vp), camera, 'direct travel does not orbit the camera');
  }
  assert.equal(h.world.getScrollState().transitioning, false);
  assert.ok(totalAngle > .01 && totalAngle <= Math.PI + .00001, 'clicked travel uses one shortest world rotation');
  const selected = h.world.points.find(point => point.id === 'learning');
  near(selected.position[0], h.world.mascot.p[0], 'selected building finishes behind the foreground AXO');
  assert.deepEqual(h.arrivals, ['learning'], 'a click must not announce intervening chapters');
  h.frame(5100); h.frame(5150); assert.deepEqual(h.arrivals, ['learning']);
  h.world.destroy();
});

test('manual scroll interrupts destination rotation and reduced motion snaps the scenery to the selected stop', () => {
  const h = rendererHarness();
  h.frame(1000); h.world.setScrollProgress(.4); const expected = h.world.island.r[1];
  const rider = [h.world.mascot.p[0], h.world.mascot.p[2]];
  h.world.setScrollProgress(.2); h.world.beginDirectTravel('learning', { animate: true });
  h.frame(1050); h.frame(1100); h.world.setScrollProgress(.4);
  assert.equal(h.world.getScrollState().transitioning, false);
  near(h.world.island.r[1], expected, 'manual progress restores its deterministic world angle');
  const arrivals = h.arrivals.length;
  for (let frame = 3; frame < 75; frame++) h.frame(1000 + frame * 50);
  assert.equal(h.arrivals.length, arrivals, 'a cancelled turn must not emit a delayed arrival');
  h.world.setMotion(false); h.arrivals.length = 0;
  assert.equal(h.world.beginDirectTravel('rxp', { animate: true }), true);
  assert.equal(h.world.getScrollState().transitioning, false, 'reduced motion snaps to the selected orientation');
  near(h.world.points.find(point => point.id === 'rxp').position[0], h.world.mascot.p[0], 'reduced-motion target aligns behind AXO');
  assert.deepEqual([h.world.mascot.p[0], h.world.mascot.p[2]], rider);
  assert.deepEqual(h.arrivals, ['rxp']);
  h.world.destroy();
});

test('the promenade is built from separate beveled stone courses without old orange accents', () => {
  const h = rendererHarness();
  const hex = color => '#' + color.map(value => Math.round(value * 255).toString(16).padStart(2, '0')).join('');
  const materials = new Set();
  const collect = node => { if (node.color) materials.add(hex(node.color)); node.children.forEach(collect); };
  h.world.nodes.forEach(collect);
  for (const oldOrange of ['#f38158', '#d46443', '#dcb468', '#f77b4f']) assert.equal(materials.has(oldOrange), false);
  const pavers = h.world.roadBlocks.filter(block => block.kind === 'paver');
  assert.ok(pavers.length >= 150, 'the road must contain individual stones rather than one flat ribbon');
  const rows = new Map();
  for (const block of pavers) { if (!rows.has(block.row)) rows.set(block.row, []); rows.get(block.row).push(block); }
  assert.ok(rows.size >= 3, 'multiple stone courses should be visible');
  const starts = [...rows.values()].map(blocks => Math.min(...blocks.map(block => block.angle)));
  assert.ok(new Set(starts.map(angle => angle.toFixed(6))).size > 1, 'stone joints must be staggered between courses');
  const stone = pavers[0].node.g.source;
  const corners = new Set();
  for (let index = 0; index < stone.positions.length; index += 3) corners.add(Array.from(stone.positions.slice(index,index+3)).join(','));
  assert.ok(corners.size > 8, 'stone geometry must include bevels rather than plain box corners');
  assert.ok(Array.from(stone.normals).some(normal => Math.abs(normal) > .05 && Math.abs(normal) < .95),
    'beveled faces should carry sloping normals that catch the light');
  assert.ok(h.world.roadBlocks.some(block => block.kind === 'curb'), 'cut curb stones should define the canal edge');
  h.world.destroy();
});

test('project search and focus filters compose, clear correctly and keep search text inert', () => {
  const h = appHarness(); h.button({ 'data-panel': 'work' }).click();
  const visible = () => h.document.querySelectorAll('[data-project-card]').filter(card => !card.hidden).map(card => card.dataset.projectCard);
  assert.equal(visible().length, 6);
  h.document.querySelector('[data-project-filter=data]').click();
  assert.deepEqual(visible(), ['adoption', 'learning']);
  h.get('project-search').value = 'governance'; h.get('project-search').emit('input');
  assert.deepEqual(visible(), []);
  assert.match(h.get('project-results-count').textContent, /No projects match/);
  h.document.querySelector('[data-project-filter=automation]').click();
  assert.deepEqual(visible(), ['rxp'], 'text search and category filters should both apply');
  h.get('reset-project-filters').click();
  assert.equal(h.get('project-search').value, ''); assert.equal(visible().length, 6);
  h.get('project-search').value = '"><img src=x onerror=alert(1)>'; h.get('project-search').emit('input');
  h.button({ 'data-panel': 'work' }).click();
  assert.equal(h.document.querySelectorAll('img').filter(img => !img.hasAttribute('data-illustration')).length, 0, 'search text must not become executable markup when the list is rebuilt');
});

test('saved projects are sanitized, limited to three, persisted and compared with scoped downloadable evidence', async () => {
  const h = appHarness({ storage: { 'axo.shortlist': JSON.stringify(['__proto__','constructor','retail','retail','rxp','missing','slides','learning']) } });
  assert.deepEqual(Array.from(h.state().shortlist), ['retail','rxp','slides']);
  h.button({ 'data-panel': 'work' }).click();
  assert.equal(h.get('compare-projects').disabled, false);
  h.document.querySelector('[data-save-project=rxp]').click();
  h.document.querySelector('[data-save-project=learning]').click();
  h.document.querySelector('[data-save-project=rxp]').click();
  assert.deepEqual(Array.from(h.state().shortlist), ['retail','slides','learning'], 'a fourth project must not displace a saved choice');
  assert.deepEqual(JSON.parse(h.values.get('axo.shortlist')), ['retail','slides','learning']);
  h.get('compare-projects').click();
  assert.equal(h.state().panel, 'compare');
  assert.match(h.get('panel-body').innerHTML, /comparison-grid/);
  h.get('download-shortlist').click();
  const brief = await h.downloads.at(-1).text();
  assert.match(brief, /Virtual Retail Assistant/); assert.match(brief, /Automated Quote Generation/); assert.match(brief, /Three-Year Market Planning/);
  assert.match(brief, /business case/i); assert.match(brief, /not a claim of realized revenue/i);
  assert.match(brief, /nothing is realised yet/i);
  const restored = appHarness({ storage: Object.fromEntries(h.values) });
  assert.deepEqual(Array.from(restored.state().shortlist), ['retail','slides','learning']);
});

test('case-study section navigation, next project and brief fallback keep evidence readable and qualified', async () => {
  const h = appHarness(); h.window.AXO.visit('playbooks');
  for (const section of ['problem','contribution','approach','outcome']) {
    assert.ok(h.get(`case-${section}`), `case study needs a visible ${section} section`);
    h.document.querySelector(`[data-case-jump=${section}]`).click();
    assert.equal(h.document.activeElement, h.get(`case-${section}`), 'section navigation moves keyboard focus to its content');
  }
  h.document.querySelector('[data-brief=playbooks]').click();
  const brief = await h.downloads.at(-1).text();
  assert.match(brief, /20 requests a week at 35 minutes each/i);
  assert.match(brief, /prototype on dummy data/i); assert.match(brief, /53 initiatives/i);
  const next = h.document.querySelectorAll('button[aria-label]').find(button => button.getAttribute('aria-label').startsWith('Next case study:'));
  next.click(); assert.equal(h.state().activeProject, 'adoption');
  h.window.AXO.visit('retail');
  h.document.querySelector('[data-copy-brief=retail]').click();
  await Promise.resolve();
  assert.match(await h.downloads.at(-1).text(), /Virtual Retail Assistant/,
    'unavailable clipboard access must fall back to a useful downloadable brief');
});

test('original project illustrations explain decisions with safe controls and explicit dummy-data boundaries', () => {
  const h = appHarness(), host = h.get('panel-body');
  for (const id of projectIds) {
    host.innerHTML = h.artifacts.render(id);
    assert.equal(host.querySelectorAll('figure.artifact-figure').length, 1);
    assert.match(host.innerHTML, /Illustrative walkthrough/);
    assert.match(host.innerHTML, /not a production screenshot/);
    assert.ok(host.querySelector('.artifact-caption'));
  }
  host.innerHTML = h.artifacts.render('playbooks');
  const marketB = host.querySelector('[data-artifact-action=market-b]'); marketB.focus();
  assert.equal(h.artifacts.handle('market-b', 'playbooks', host), true);
  assert.equal(h.artifacts.handle('check', 'playbooks', host), true);
  assert.match(host.querySelector('.artifact-status').textContent, /hold the batch/);
  assert.match(host.querySelector('.artifact-canvas').innerHTML, /Missing/);
  assert.equal(h.document.activeElement, marketB); assert.equal(marketB.isConnected, true, 'changing the illustration must retain its focused control');
  h.artifacts.handle('market-a', 'playbooks', host); h.artifacts.handle('check', 'playbooks', host);
  assert.match(host.querySelector('.artifact-status').textContent, /review can continue/);
  host.innerHTML = h.artifacts.render('adoption');
  h.artifacts.handle('rate', 'adoption', host);
  const rate = host.querySelector('.artifact-canvas').innerHTML;
  assert.match(rate, /60%/); assert.match(rate, /24 out of 40/); assert.match(rate, /not actual adoption data/);
  assert.equal(host.querySelector('[data-artifact-action=rate]').getAttribute('aria-pressed'), 'true');
  h.artifacts.handle('counts', 'adoption', host);
  assert.match(host.querySelector('.artifact-canvas').innerHTML, /24 people/);
  const before = host.querySelector('.artifact-canvas').innerHTML;
  assert.equal(h.artifacts.handle('<script>', 'adoption', host), false);
  assert.equal(h.artifacts.handle('rate', '__proto__', host), false);
  assert.equal(host.querySelector('.artifact-canvas').innerHTML, before);
  assert.equal(h.artifacts.render('__proto__'), '');
});

async function cosmosHarness({ reduced = false } = {}) {
  const cosmicSource = await readFile(new URL('src/cosmos.js', root), 'utf8');
  const document = Object.assign(new Events(), { hidden: false });
  const window = Object.assign(new Events(), { innerWidth: 1200, innerHeight: 800, devicePixelRatio: 3 });
  let now = 1000, serial = 0;
  const frames = new Map(), timers = new Map();
  const calls = { arcs: 0, strokes: 0, clears: 0 };
  const finite = (values) => { for (const value of values) if (typeof value === 'number') assert.ok(Number.isFinite(value), 'cosmic drawing inputs must stay finite'); };
  const ctx = { globalAlpha: 1 };
  for (const name of ['setTransform','beginPath','fill','moveTo','lineTo']) ctx[name] = (...args) => finite(args);
  ctx.clearRect = (...args) => { finite(args); calls.clears++; };
  ctx.arc = (...args) => { finite(args); assert.ok(args[2] >= 0); calls.arcs++; };
  ctx.stroke = () => calls.strokes++;
  ctx.createLinearGradient = (...args) => { finite(args); return { addColorStop(offset) { assert.ok(offset >= 0 && offset <= 1); } }; };
  const canvas = Object.assign(new Events(), { style: {}, getContext: (type) => { assert.equal(type, '2d'); return ctx; } });
  const setTimeout = (callback, delay) => { const id = ++serial; timers.set(id, { callback, due: now + delay }); return id; };
  const clearTimeout = (id) => timers.delete(id);
  const context = vm.createContext({ window, document, console, performance: { now: () => now }, setTimeout, clearTimeout,
    requestAnimationFrame(callback) { const id = ++serial; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); } });
  vm.runInContext(cosmicSource.replace(/^export\s+/gm, '') + '\nglobalThis.Cosmos = Cosmos; globalThis.createStarMap = createStarMap;', context);
  const cosmos = new context.Cosmos(canvas, { reducedMotion: reduced });
  const frame = (stamp) => { now = stamp; const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(stamp)); };
  return { cosmos, canvas, document, window, frames, timers, calls, frame, createStarMap: context.createStarMap,
    flushTimers(milliseconds) { now += milliseconds; for (const [id, timer] of [...timers]) if (timer.due <= now) { timers.delete(id); timer.callback(); } } };
}

test('the real cosmic layer draws finite stars, caps density and keeps normalized constellations when resized', async () => {
  const h = await cosmosHarness();
  assert.deepEqual(h.createStarMap(1200,800), h.createStarMap(1200,800), 'star positions should be reproducible');
  assert.ok(h.createStarMap(20,20).length >= 90);
  assert.ok(h.createStarMap(10000,10000).length <= 225, 'large screens must not create unbounded star density');
  assert.ok(h.cosmos.stars.every(star => star.u >= 0 && star.u <= 1 && star.v >= 0 && star.v <= 1));
  assert.equal(h.canvas.width, 2400, 'cosmic layer caps pixel ratio at two');
  assert.equal(h.canvas.height, 1600);
  const normalized = h.cosmos.stars.slice(0, 50).map(star => [star.u,star.v]);
  h.window.innerWidth = 390; h.window.innerHeight = 844; h.window.emit('resize');
  assert.deepEqual(h.cosmos.stars.slice(0, 50).map(star => [star.u,star.v]), normalized);
  h.frame(1000); h.frame(1050);
  assert.ok(h.calls.arcs > h.cosmos.stars.length, 'the actual draw loop must render stars');
  h.cosmos.destroy();
});

test('star interactions respond to a tap while controls, drags and handled world clicks stay quiet', async () => {
  const h = await cosmosHarness(); h.frame(1000);
  const star = h.cosmos.position(h.cosmos.stars[0]);
  const target = { closest: () => null };
  const tap = (extra = {}, travel = 0) => {
    const event = { clientX: star.x, clientY: star.y, pointerId: 1, button: 0, target, ...extra };
    h.window.emit('pointerdown', event);
    h.window.emit('pointerup', { ...event, clientX: star.x + travel });
  };
  tap(); h.frame(1050);
  assert.equal(h.cosmos.getState().interactions, 1);
  assert.equal(h.cosmos.getState().bursts, 1);
  tap({}, 50); tap({ axoWorldHandled: true }); tap({ target: { closest: () => ({}) } });
  assert.equal(h.cosmos.getState().interactions, 1, 'other interactions must not trigger duplicate cosmic effects');
  for (let index = 0; index < 25; index++) h.cosmos.pulse(star.x, star.y);
  const state = h.cosmos.getState();
  assert.ok(state.bursts <= 4 && state.shootingStars <= 3 && state.particleCount <= 64);
  assert.equal(h.frames.size, 1, 'a burst of input should coalesce into one pending frame');
  for (let frame = 2; frame <= 45; frame++) h.frame(1000 + frame * 50);
  assert.equal(h.cosmos.getState().bursts, 0); assert.equal(h.cosmos.getState().shootingStars, 0);
  h.cosmos.destroy();
});

test('cosmic reduced motion, background visibility and destruction stop continuous work', async () => {
  const h = await cosmosHarness({ reduced: true }); h.frame(1000);
  assert.equal(h.frames.size, 0, 'reduced motion must have no perpetual animation frame');
  h.cosmos.pulse(); h.frame(1050);
  assert.equal(h.cosmos.getState().shootingStars, 0, 'explicit reduced-motion feedback remains spatially still');
  assert.equal(h.frames.size, 0);
  h.flushTimers(700); h.frame(1800);
  assert.equal(h.cosmos.getState().bursts, 0);
  h.cosmos.setMotion(true); assert.equal(h.frames.size, 1);
  h.document.hidden = true; h.document.emit('visibilitychange');
  assert.equal(h.frames.size, 0);
  const time = h.cosmos.time; h.frame(50000); assert.equal(h.cosmos.time, time);
  h.document.hidden = false; h.document.emit('visibilitychange'); h.frame(50050);
  assert.equal(h.cosmos.time, time, 'returning to a tab must not simulate its hidden duration');
  h.cosmos.destroy();
  assert.equal(h.frames.size, 0); assert.equal(h.timers.size, 0);
  assert.ok([...h.window.listeners.values(), ...h.document.listeners.values()].every(listeners => listeners.size === 0));
  const draws = h.calls.clears, interactions = h.cosmos.getState().interactions;
  h.window.emit('resize'); h.cosmos.pulse(); h.frame(50100);
  assert.equal(h.calls.clears, draws); assert.equal(h.cosmos.getState().interactions, interactions);
});

test('reading suspends the real cosmic loop and resumes without elapsed-time or preference changes', async () => {
  const h = await cosmosHarness(); h.frame(1000); h.frame(1050); h.cosmos.pulse();
  h.cosmos.setReading(true);
  const time = h.cosmos.time, draws = h.calls.clears;
  assert.equal(h.frames.size, 0); assert.equal(h.cosmos.getState().reading, true);
  h.frame(50000); assert.equal(h.cosmos.time, time); assert.equal(h.calls.clears, draws);
  assert.equal(h.cosmos.motion, true, 'reading must not replace the visitor motion preference');
  h.cosmos.setReading(false); h.frame(51000);
  near(h.cosmos.time, time, 'the first resumed cosmic frame must reset its clock');
  h.frame(51050); assert.ok(h.cosmos.time > time && h.cosmos.time - time <= .051);
  h.cosmos.setMotion(false); h.cosmos.setReading(true); h.cosmos.setReading(false); h.frame(52000);
  assert.equal(h.cosmos.motion, false); assert.equal(h.frames.size, 0);
  h.cosmos.destroy();
});

test('accessible effects controls reach the stars, gardens and water with truthful fallback states', () => {
  const h = appHarness();
  h.document.querySelector('[data-effect=stars]').click();
  h.document.querySelector('[data-effect=flowers]').click();
  h.document.querySelector('[data-effect=water]').click();
  assert.ok(h.cosmos.calls.some(call => call[0] === 'pulse'));
  assert.deepEqual(h.lastCall('flowers'), ['flowers']);
  assert.deepEqual(h.lastCall('water'), ['water']);
  const fallback = appHarness({ webgl: false });
  assert.equal(fallback.document.querySelector('[data-effect=flowers]').disabled, true);
  assert.equal(fallback.document.querySelector('[data-effect=water]').disabled, true);
  assert.equal(fallback.document.querySelector('[data-effect=stars]').disabled, false);
  fallback.document.querySelector('[data-effect=stars]').click();
  assert.ok(fallback.cosmos.calls.some(call => call[0] === 'pulse'), 'stars remain interactive without WebGL');
});

test('real flowers and water react to hits, propagate ripples and respect paused motion', () => {
  const h = rendererHarness(); h.frame(1000);
  const flower = h.world.getEnvironmentState().flowers.map(item => ({ ...item, screen: h.world.project(item.worldPosition) }))
    .find(item => item.screen.visible && h.world.pickEnvironment(item.screen.x,item.screen.y)?.type === 'flower');
  assert.ok(flower, 'the scene must expose a real reachable flower');
  const hover = h.world.interactAt(flower.screen.x,flower.screen.y,{hover:true});
  assert.equal(hover.type, 'flower');
  h.frame(1050); h.frame(1100);
  const hovered = h.world.getEnvironmentState().flowers.find(item => item.id === flower.id);
  assert.ok(hovered.bloom > flower.bloom, 'hover should change the actual flower petal pose');
  h.canvas.emit('pointerdown', { button:0,pointerId:1,clientX:flower.screen.x,clientY:flower.screen.y });
  const handled = h.canvas.emit('pointerup', { button:0,pointerId:1,clientX:flower.screen.x,clientY:flower.screen.y });
  assert.equal(handled.axoWorldHandled, true, 'a world hit must prevent a duplicate background-star tap');
  const state = h.world.getEnvironmentState();
  assert.ok(state.flowerInteractions >= 1 && state.activeRipples >= 1, 'flower interaction should reach nearby canal water');
  const initialRadius = Math.max(...state.ripples.map(ripple => ripple.radius));
  h.frame(1150); h.frame(1200); h.frame(1250);
  assert.ok(Math.max(...h.world.getEnvironmentState().ripples.map(ripple => ripple.radius)) > initialRadius,
    'ripple radius must expand over real animation frames');
  assert.ok(h.world.getEnvironmentState().flowTime > state.flowTime, 'canal flow should advance while motion is enabled');
  h.world.setMotion(false); const paused = h.world.getEnvironmentState();
  h.frame(1300); h.frame(1350);
  assert.equal(h.world.getEnvironmentState().flowTime, paused.flowTime);
  assert.equal(h.world.rippleWater(), true, 'paused motion still permits explicit static water feedback');
  h.frame(1400); h.frame(1450);
  assert.equal(h.world.getEnvironmentState().flowTime, paused.flowTime);
  h.world.destroy();
});

test('the Mexican garden has distinct cached flower forms and hit targets follow the moving crowns', () => {
  const h = rendererHarness(); h.frame(1000); let now = 1000;
  const garden = h.world.getGardenState();
  assert.equal(garden.species.length, 5); assert.equal(garden.terrestrialCount, 12);
  assert.equal(garden.waterlilyCount, 6); assert.equal(garden.bloomingWaterlilies, 3);
  assert.equal(new Set(garden.species.map(species => species.scientificName)).size, 5);
  assert.ok(garden.species.every(species => species.count > 0 && species.habitat && species.form && species.stylizedPalette));
  const forms = [...h.world.flowerForms.values()];
  assert.equal(forms.length, 5);
  assert.equal(new Set(forms.map(form => hash([...form.petals.source.positions].join(',')))).size, 5, 'the five forms must use different petal geometry');
  const terrestrial = [...new Set(h.world.flowers.map(flower => flower.speciesId))], reached = new Set();
  assert.equal(terrestrial.length, 4);
  const geometryCount = h.world.geometries.length;
  for (const progress of [0, .13, .29, .45, .62, .79, .95]) {
    h.world.setScrollProgress(progress); h.frame(now += 50);
    for (const flower of h.world.getEnvironmentState().flowers) {
      if (reached.has(flower.speciesId)) continue;
      const screen = h.world.project(flower.worldPosition);
      if (!screen.visible || h.world.pickEnvironment(screen.x,screen.y)?.id !== flower.id) continue;
      h.world.interactAt(screen.x,screen.y,{hover:true}); h.frame(now += 50); h.frame(now += 50);
      const moved = h.world.getEnvironmentState().flowers.find(item => item.id === flower.id);
      assert.ok(moved.bloom > flower.bloom);
      assert.notDeepEqual([...moved.worldPosition], [...flower.worldPosition], 'the exposed crown anchor must move with bending and bloom');
      const next = h.world.project(moved.worldPosition);
      assert.equal(h.world.pickEnvironment(next.x,next.y)?.id, flower.id, 'a moving crown must remain a valid hover/click target');
      reached.add(flower.speciesId);
    }
  }
  assert.equal(reached.size, terrestrial.length, 'each terrestrial flower form must be reachable in the turning town');
  assert.equal(h.world.geometries.length, geometryCount, 'flower reactions must reuse cached geometry');
  h.world.destroy();
});

test('lake and basin use upward surfaces with local, bounded shader ripples as the town turns', () => {
  const h = rendererHarness(); h.frame(1000);
  const surfaces = h.world.island.children.filter(node => node.water);
  assert.deepEqual([...surfaces].map(node => node.water).sort(), [1, 2], 'lake and basin must retain distinct shading regions after batching');
  for (const surface of surfaces) {
    const positions = h.uploads.get(surface.g.position), normals = h.uploads.get(surface.g.normal);
    const indices = h.uploads.get(surface.g.index);
    const level = surface.water === 1 ? h.world.waterLevel : h.world.basinWaterLevel;
    for (let vertex = 0; vertex < positions.length; vertex += 3) {
      near(positions[vertex + 1], level, 'only the top plane may use water shading');
      near(normals[vertex], 0, 'water normal x'); near(normals[vertex + 1], 1, 'water normal y'); near(normals[vertex + 2], 0, 'water normal z');
    }
    for (let triangle = 0; triangle < indices.length; triangle += 3) {
      const [a,b,c] = [...indices.slice(triangle, triangle + 3)].map(index => index * 3);
      const facing = (positions[b + 2] - positions[a + 2]) * (positions[c] - positions[a]) - (positions[b] - positions[a]) * (positions[c + 2] - positions[a + 2]);
      assert.ok(facing > 0, 'water triangles must face the camera above the surface');
    }
  }
  assert.equal(h.world.rippleWater([0, h.world.trackRadius]), false, 'the stone promenade must reject a water effect');
  assert.equal(h.world.rippleWater([3.1, 0]), false, 'the shore must bound water interactions');
  const geometryCount = h.world.geometries.length;
  let now = 1000;
  for (const progress of [0, .21, .62]) {
    h.world.setScrollProgress(progress); h.frame(now += 50);
    const worldPoint = [-.9, h.world.waterLevel + h.world.island.p[1], 2.70];
    const local = h.world.worldToLocal(worldPoint), screen = h.world.project(worldPoint);
    const hit = h.world.interactAt(screen.x, screen.y);
    assert.equal(hit?.type, 'water', 'a visible lake point must stay interactive after world rotation');
    near(hit.localPosition[0], local[0], 'rotated water hit local x');
    near(hit.localPosition[1], local[2], 'rotated water hit local z');
    h.frame(now += 50);
    near(h.calls.uniforms.get('uEnvironment')[1], h.world.island.r[1] % (Math.PI * 2), 'shader and picking must use the same town rotation');
  }
  for (let i = 0; i < 12; i++) assert.equal(h.world.rippleWater([Math.sin(i) * 2.87, Math.cos(i) * 2.87]), true);
  assert.equal(h.world.rippleWater([.4, 0]), true, 'the raised basin remains a separate interactive surface');
  h.frame(now += 50);
  const packed = h.calls.uniforms.get('uRipples[0]');
  assert.equal(packed.length, 32); assert.equal(h.world.getEnvironmentState().activeRipples, 8);
  for (let offset = 0; offset < packed.length; offset += 4) {
    assert.ok(packed[offset + 2] >= 0 && packed[offset + 2] <= 2.8);
    assert.ok(packed[offset + 3] > 0 && packed[offset + 3] <= 1);
  }
  assert.equal(h.world.geometries.length, geometryCount, 'water interactions must not allocate floating ring meshes');
  h.world.setMotion(false); h.frame(now += 50); const still = h.calls.uniforms.get('uRipples[0]');
  h.frame(now += 50); assert.deepEqual(h.calls.uniforms.get('uRipples[0]'), still, 'paused ripple surface inputs must remain still');
  h.world.setMotion(true);
  for (let step = 0; step < 64; step++) h.frame(now += 50);
  assert.equal(h.world.getEnvironmentState().activeRipples, 0);
  const expired = h.calls.uniforms.get('uRipples[0]');
  for (let offset = 0; offset < expired.length; offset += 4) assert.equal(expired[offset + 3], 0, 'expired ripples must stop affecting the surface');
  h.world.destroy();
});

test('AXO walks in side profile with alternating planted feet and glances toward the selected destination', () => {
  const h = rendererHarness(); h.frame(1000);
  assert.equal(h.world.getWalkState().mode, 'visitor');
  near(h.world.getWalkState().facing, 0, 'the introduction faces the visitor');
  let now = 1000;
  const stances = new Set(); let sawFootLift = false;
  for (let step = 0; step < 16; step++) {
    h.world.setScrollProgress(.03 + step * .002);
    h.frame(now += 50);
    const walk = h.world.getWalkState();
    stances.add(walk.plantedLeg);
    assert.ok(walk.footLift.every(Number.isFinite));
    assert.ok(Math.min(...walk.footLift) < .000001, 'one foot stays planted through each stride');
    assert.ok(Math.max(...walk.footLift) < .031, 'the swing foot clears the road without exaggerated lift');
    if (Math.max(...walk.footLift) > .005) sawFootLift = true;
  }
  const forward = h.world.getWalkState();
  assert.equal(forward.mode, 'travelling');
  near(forward.targetFacing, Math.PI / 2, 'forward walking uses a side profile');
  assert.ok(Math.abs(forward.facing - Math.PI / 2) < .05);
  assert.ok(forward.blend > .5 && forward.speed > 0);
  assert.equal(stances.size, 2); assert.equal(sawFootLift, true);
  assert.ok(h.world.legs[0].r[0] * h.world.arms[0].r[0] <= 0, 'opposite arm and leg swing should balance the stride');
  h.world.setScrollProgress(.058); h.frame(now += 50);
  near(h.world.getWalkState().targetFacing, -Math.PI / 2, 'reverse scroll reverses the travel profile');
  assert.ok(Math.abs(h.world.getWalkState().facing - forward.facing) < Math.PI / 2, 'facing changes should ease instead of snapping');
  h.world.beginDirectTravel('retail', { animate: true });
  for (let step = 0; step < 65 && h.world.getScrollState().transitioning; step++) h.frame(now += 50);
  assert.equal(h.world.getScrollState().transitioning, false);
  for (let step = 0; step < 16; step++) h.frame(now += 50);
  const arrived = h.world.getWalkState();
  assert.equal(arrived.mode, 'arrived'); assert.equal(arrived.arrivedProject, 'retail');
  assert.equal(arrived.settlePhase, 'glance');
  near(arrived.targetFacing, Math.PI, 'arrival turns AXO toward the building');
  assert.ok(Math.abs(Math.atan2(Math.sin(arrived.facing - Math.PI), Math.cos(arrived.facing - Math.PI))) < .03);
  assert.ok(arrived.blend < .001 && Math.max(...arrived.footLift) < .0001, 'arrival settles into a grounded standing pose');
  h.world.destroy();
});

test('the approved robot uses articulated fins and commits its chest display only at a settled destination', () => {
  const h = rendererHarness(); h.frame(1000); let now = 1000;
  const initial = h.world.getCharacterState();
  assert.equal(initial.projectId, null); assert.equal(initial.targetProject, null); assert.equal(initial.display, 'intro');
  assert.equal(initial.expression, 'friendly');
  assert.equal(h.world.gills.length, 6); assert.equal(h.world.elbows.length, 2);
  assert.equal(h.world.gills.filter(fin => fin.side === -1).length, 3);
  assert.equal(h.world.gills.filter(fin => fin.side === 1).length, 3);
  assert.ok(h.world.gills.every(fin => fin.children.some(node => node.g && node.alpha > 0 && node.alpha < 1)), 'each gill needs an actual translucent membrane');
  const palette = new Set(['#231942','#5e548e','#9f86c0','#be95c4','#e0b1cb','#8deafa']);
  const visit = node => {
    if (node.g) {
      const hex = '#' + [...node.color].map(channel => Math.round(channel * 255).toString(16).padStart(2,'0')).join('');
      assert.ok(palette.has(hex), `robot mesh color ${hex} is outside the approved shell/signal palette`);
    }
    node.children.forEach(visit);
  };
  visit(h.world.mascot);
  assert.ok(h.world.eyes.every(eye => eye.glow > .5 && eye.color[1] > eye.color[0] && eye.color[2] > eye.color[0]), 'both actual eye meshes should emit cyan light');
  const visibleDisplays = () => [...h.world.chestIcons].filter(([,node]) => node.visible).map(([id]) => id);
  assert.ok(projectIds.every(id => h.world.chestIcons.get(id)?.children.some(node => node.g)), 'each of the six destinations needs a prebuilt project glyph');
  assert.deepEqual(visibleDisplays(), [null]);
  h.world.beginDirectTravel('retail', { animate: false }); h.frame(now += 50);
  assert.equal(h.world.getCharacterState().projectId, 'retail'); assert.deepEqual(visibleDisplays(), ['retail']);
  h.arrivals.length = 0;
  h.world.beginDirectTravel('adoption', { animate: true });
  assert.equal(h.world.getCharacterState().targetProject, 'adoption');
  assert.equal(h.world.getCharacterState().projectId, 'retail', 'logical selection must not change the physical arrival display');
  let passedLearning = false;
  for (let step = 0; step < 65 && h.world.getScrollState().transitioning; step++) {
    h.frame(now += 50);
    passedLearning ||= Math.abs(Math.atan2(Math.sin(h.world.worldRotation), Math.cos(h.world.worldRotation))) < .15;
    if (h.world.getScrollState().transitioning) {
      assert.equal(h.world.getCharacterState().projectId, 'retail', 'passing an intermediate building must not commit its symbol');
      assert.deepEqual(visibleDisplays(), ['retail']);
    }
  }
  assert.ok(passedLearning, 'the exercised short arc must actually pass another building');
  assert.equal(h.world.getScrollState().transitioning, false);
  assert.deepEqual(h.arrivals, ['adoption']);
  assert.equal(h.world.getCharacterState().projectId, 'adoption'); assert.deepEqual(visibleDisplays(), ['adoption']);
  assert.equal(h.world.getCharacterState().settlePhase, 'glance');
  for (let step = 0; step < 44; step++) h.frame(now += 50);
  const greeted = h.world.getCharacterState();
  assert.equal(greeted.settlePhase, 'visitor'); assert.equal(greeted.expression, 'friendly');
  near(h.world.getWalkState().targetFacing, 0, 'the settled robot turns back toward the visitor');
  assert.ok(Math.abs(h.world.getWalkState().facing) < .03);
  assert.ok(greeted.gillFlex.some((value,index) => Math.abs(value - initial.gillFlex[index]) > .001), 'actual membrane roots flex over animation time');
  h.world.setMotion(false); h.world.beginDirectTravel('slides', { animate: true });
  const reduced = h.world.getCharacterState();
  assert.equal(h.world.getScrollState().transitioning, false); assert.equal(reduced.projectId, 'slides');
  assert.equal(reduced.settlePhase, 'visitor'); assert.equal(reduced.expression, 'friendly');
  near(h.world.getWalkState().facing, 0, 'reduced motion skips the glance and faces the visitor immediately');
  assert.deepEqual(visibleDisplays(), ['slides']);
  h.frame(now += 50); h.frame(now += 50);
  assert.deepEqual([...h.world.getCharacterState().gillFlex], [...reduced.gillFlex], 'paused fins must remain still');
  assert.deepEqual([...h.world.getCharacterState().tailRotation], [...reduced.tailRotation], 'paused tail must remain still');
  h.world.destroy();
});

test('scroll crossings update the chest in either direction while only settled stops announce an arrival', () => {
  const h = rendererHarness(); h.frame(1000); let now = 1000;
  assert.equal(h.world.getArrivalState().status, 'intro');
  h.world.setScrollProgress(.19); h.frame(now += 50);
  assert.equal(h.world.getCharacterState().projectId, 'retail');
  assert.equal(h.world.getArrivalState().lastPassedProject, 'retail');
  assert.equal(h.world.getArrivalState().status, 'travelling');
  assert.equal(h.world.getArrivalState().currentProject, null);
  assert.deepEqual(h.arrivals, [], 'passing a door while walking must not claim a settled arrival');
  for (let i = 0; i < 8; i++) h.frame(now += 50);
  assert.equal(h.world.getArrivalState().status, 'between');
  assert.equal(h.world.getArrivalState().targetProject, 'rxp');
  h.world.setScrollProgress(1 / 3); h.frame(now += 50);
  assert.notEqual(h.world.getArrivalState().status, 'at', 'alignment during a stride is not a settled stop');
  for (let i = 0; i < 8; i++) h.frame(now += 50);
  assert.equal(h.world.getArrivalState().status, 'at'); assert.equal(h.world.getArrivalState().currentProject, 'rxp');
  assert.deepEqual(h.arrivals, ['rxp']);
  for (let i = 0; i < 8; i++) h.frame(now += 50);
  assert.deepEqual(h.arrivals, ['rxp'], 'idle frames must not repeat the arrival');
  h.world.setScrollProgress(.14); h.frame(now += 50);
  assert.equal(h.world.getCharacterState().projectId, 'retail', 'reverse crossings must update the actual chest display');
  assert.equal(h.world.getArrivalState().lastPassedProject, 'retail');
  assert.equal(h.world.getArrivalState().currentProject, null);
  assert.deepEqual(h.arrivals, ['rxp']);
  const visible = [...h.world.chestIcons].filter(([,node]) => node.visible).map(([id]) => id);
  assert.deepEqual(visible, ['retail']);
  h.world.destroy();
});

test('reading freezes real scene work and resumes an interrupted turn without changing the motion preference', () => {
  const h = rendererHarness(); h.frame(1000);
  h.world.beginDirectTravel('adoption', { animate: true }); h.frame(1050); h.frame(1100);
  h.world.setReading(true);
  const frozen = { time: h.world.time, rotation: h.world.worldRotation, elapsed: h.world.directTravel.elapsed, draws: h.calls.draws,
    fins: [...h.world.getCharacterState().gillFlex] };
  h.frame(8000); h.frame(18000);
  assert.equal(h.world.time, frozen.time); assert.equal(h.world.worldRotation, frozen.rotation);
  assert.equal(h.world.directTravel.elapsed, frozen.elapsed); assert.equal(h.calls.draws, frozen.draws, 'reading must suppress draws rather than just hide the canvas');
  assert.deepEqual([...h.world.getCharacterState().gillFlex], frozen.fins); assert.equal(h.world.motion, true);
  h.world.setReading(false); h.frame(19000);
  near(h.world.time, frozen.time, 'the first resumed frame must not simulate reading time');
  near(h.world.directTravel.elapsed, frozen.elapsed, 'the interrupted destination turn must resume at its saved clock');
  h.frame(19050); assert.ok(h.world.time > frozen.time && h.world.time - frozen.time <= .051);
  assert.ok(h.world.directTravel.elapsed > frozen.elapsed);
  h.world.setMotion(false); h.world.setReading(true); h.frame(25000); h.world.setReading(false); h.frame(26000);
  assert.equal(h.world.motion, false, 'closing a case study must preserve a user pause');
  h.world.destroy();
});

test('journey restoration keeps exact manual orientation and character state without replaying arrival effects', () => {
  const h = rendererHarness(); h.frame(1000);
  h.world.beginDirectTravel('slides', { animate: false }); h.frame(1050);
  h.world.orbit(.187); h.frame(1100); h.frame(1300);
  const snapshot = JSON.parse(JSON.stringify(h.world.getJourneySnapshot()));
  const arrivals = h.arrivals.length, activations = h.world.getProjectEffectState('slides').activationCount;
  h.world.beginDirectTravel('learning', { animate: true }); h.frame(1350);
  assert.ok(h.world.restoreJourney(snapshot));
  near(h.world.worldRotation, snapshot.worldRotation, 'restored world rotation');
  near(h.world.manualRotationOffset, snapshot.manualRotationOffset, 'restored manual rotation offset');
  near(h.world.getScrollState().progress, snapshot.progress, 'restored page progress');
  near(h.world.getWalkState().facing, snapshot.walk.facing, 'restored character facing');
  assert.equal(h.world.getCharacterState().projectId, snapshot.character.projectId);
  assert.equal(h.world.getScrollState().transitioning, false);
  assert.equal(h.arrivals.length, arrivals); assert.equal(h.world.getProjectEffectState('slides').activationCount, activations);
  assert.equal(h.world.restoreJourney({ progress: .3, worldRotation: NaN, manualRotationOffset: 0 }), false);
  near(h.world.worldRotation, snapshot.worldRotation, 'invalid history snapshots must not corrupt the scene');
  h.world.beginDirectTravel('adoption', { animate: true }); h.frame(1350); h.frame(1400);
  const inTransit = JSON.parse(JSON.stringify(h.world.getJourneySnapshot()));
  assert.ok(inTransit.trip && inTransit.trip.elapsed > 0);
  h.world.beginDirectTravel('retail', { animate: true }); h.frame(1450);
  const beforeRestoreArrivals = h.arrivals.length;
  h.world.restoreJourney(inTransit);
  assert.equal(h.world.getScrollState().transitioning, true); assert.equal(h.world.getScrollState().destination, 'adoption');
  near(h.world.worldRotation, inTransit.worldRotation, 'history must restore the actual partial-turn angle');
  near(h.world.directTravel.elapsed, inTransit.trip.elapsed, 'history must preserve the remaining journey clock');
  assert.equal(h.world.getCharacterState().projectId, inTransit.character.projectId);
  assert.equal(h.arrivals.length, beforeRestoreArrivals);
  h.world.destroy();
});

test('settled buildings perform distinct real roof motions and previews reuse existing geometry', () => {
  const h = rendererHarness(); h.frame(1000); let now = 1000;
  const geometryCount = h.world.geometries.length;
  assert.equal(h.world.highlightProject('slides'), true); h.frame(now += 50);
  assert.equal(h.world.getProjectEffectState('slides').highlighted, true);
  assert.equal(h.world.projectEffects.get('slides').beacon.visible, true);
  assert.equal(h.world.highlightProject('missing'), false);
  h.world.highlightProject(null); h.world.beginDirectTravel('slides', { animate: false });
  for (let i = 0; i < 7; i++) h.frame(now += 50);
  assert.ok(Math.abs(h.world.projectEffects.get('slides').hinge.r[0]) > .1, 'Slide Studio must move its physical slide');
  const activations = h.world.getProjectEffectState('slides').activationCount;
  for (let i = 0; i < 5; i++) h.frame(now += 50);
  assert.equal(h.world.getProjectEffectState('slides').activationCount, activations);
  h.world.beginDirectTravel('playbooks', { animate: false });
  const leafStart = h.world.projectEffects.get('playbooks').leaf.r[2];
  for (let i = 0; i < 14; i++) h.frame(now += 50);
  assert.ok(h.world.projectEffects.get('playbooks').leaf.r[2] > leafStart + .2, 'Playbook Works must turn an actual page');
  h.world.beginDirectTravel('adoption', { animate: false });
  const bars = h.world.projectEffects.get('adoption').bars.map(bar => bar.node.s[1]);
  for (let i = 0; i < 25; i++) h.frame(now += 50);
  assert.ok(h.world.projectEffects.get('adoption').bars.every((bar,index) => bar.node.s[1] > bars[index]), 'Adoption Lab must grow actual chart bars');
  assert.equal(h.world.geometries.length, geometryCount, 'arrival and highlight feedback must not allocate meshes per event');
  assert.equal(h.world.getProjectEffectState().filter(effect => effect.settled).length, 1);
  h.world.destroy();
});

test('the scan introduction is scrubbed by the first stretch of scroll and gates the journey', () => {
  const h = appHarness();
  h.get('scan-stage').layout = { top: 0, height: 1350, width: 1440 };
  h.document.querySelectorAll('[data-scroll-project]').forEach(chapter => { chapter.layout.top += 1350; });
  h.document.documentElement.scrollHeight = 8550; h.document.body.scrollHeight = 8550;
  h.window.emit('resize');
  assert.equal(h.state().scanProgress, 0, 'the page starts with the scan at zero');
  assert.equal(h.get('scan-ui').hidden, false);
  h.window.scrollTo({ top: 405, behavior: 'instant' });
  assert.ok(Math.abs(h.state().scanProgress - .3) < .001, 'scroll inside the stretch maps linearly to scan progress');
  assert.equal(h.state().scrollProgress, 0, 'the journey does not start during the scan');
  assert.equal(h.get('scan-counter-value').textContent, '030');
  assert.equal(h.get('scan-card-who').hidden, false, 'the first card appears at 25 percent');
  assert.equal(h.get('scan-card-what').hidden, true);
  h.window.scrollTo({ top: 1350 * .6, behavior: 'instant' });
  assert.equal(h.get('scan-card-what').hidden, false, 'the second card appears at 55 percent');
  assert.equal(h.get('scan-card-how').hidden, true);
  h.window.scrollTo({ top: 1350, behavior: 'instant' });
  assert.equal(h.state().scanProgress, 1);
  assert.equal(h.get('scan-card-how').hidden, false, 'the third card appears at 85 percent');
  assert.equal(h.get('scan-ui').hidden, true, 'the overlay leaves once the scan completes');
  assert.equal(h.state().scrollProgress, 0, 'the journey begins exactly where the scan ends');
  h.window.scrollTo({ top: 0, behavior: 'instant' });
  assert.equal(h.state().scanProgress, 0, 'scrolling back reverses the scan');
  assert.equal(h.get('scan-card-who').hidden, true);
});

test('the scan stretch collapses under reduced motion so the journey starts immediately', () => {
  const h = appHarness({ reduced: true });
  h.get('scan-stage').layout = { top: 0, height: 1350, width: 1440 };
  h.document.querySelectorAll('[data-scroll-project]').forEach(chapter => { chapter.layout.top += 1350; });
  h.document.documentElement.scrollHeight = 8550; h.document.body.scrollHeight = 8550;
  h.window.emit('resize');
  assert.equal(h.state().scanProgress, 1, 'reduced motion shows AXO fully materialised');
  assert.equal(h.get('scan-ui').hidden, true);
  assert.equal(h.get('scan-card-how').hidden, false, 'all cards are shown at once');
  h.window.scrollTo({ top: 200, behavior: 'instant' });
  assert.ok(h.state().scrollProgress > 0, 'scrolling moves the journey with no scan offset');
});

test('direct travel from the index lands past the scan stretch', () => {
  const h = appHarness();
  h.get('scan-stage').layout = { top: 0, height: 1350, width: 1440 };
  h.document.querySelectorAll('[data-scroll-project]').forEach(chapter => { chapter.layout.top += 1350; });
  h.document.documentElement.scrollHeight = 8550; h.document.body.scrollHeight = 8550;
  h.window.emit('resize');
  h.window.AXO.scrollToProject('rxp');
  assert.ok(h.window.scrollY >= 1350, 'scrollToProject adds the scan length to the chapter anchor');
  assert.equal(h.state().scanProgress, 1);
  assert.equal(h.state().currentStop, 'rxp');
});
