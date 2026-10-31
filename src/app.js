import { World } from './world.js';
import { Cosmos } from './cosmos.js';
import { ProjectArtifacts } from './project-artifacts.js';

const $ = (selector) => document.querySelector(selector);
const panel = $('#content-panel');
const panelBody = $('#panel-body');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const state = { world: null, night: false, paused: reducedMotion.matches, sound: false, panel: '', lastFocus: null, roaming: false, activeProject: '', currentStop: '', scrollProgress: 0, chapter: 0, scanProgress: 1, route: { kind: 'home', hash: '#home' }, preview: '', currentLocation: { status: 'intro', text: 'Exploring the lake city' } };
let toastTimer;
let audio;
let notesTimer;
let cosmos = null;
let workFilter = 'all';
let workQuery = '';
let previewTimer;
let previewPinned = false;
let routeReady = false;
let routeApplying = false;
let routeWriteSuppressed = 0;
let suppressedCloseEvents = 0;
let lastWorldMotion = null;
let lastCosmosMotion = null;
let lastRouteToken = '';
let modalReturn = null;
let routeSequence = 0;
const routeSnapshots = new Map();
let routeSnapshotTimer;
let pendingSnapshotKey = '';
let lastSnapshotSerialization = -Infinity;
const routeSession = `axo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const storage = {
  get(key, fallback = '') { try { return localStorage.getItem(`axo.${key}`) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(`axo.${key}`, value); return true; } catch { return false; } }
};

function toast(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').classList.add('show');
  toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 4200);
}

class LakeAudio {
  constructor() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) throw new Error('Web Audio unavailable');
    this.context = new Audio();
    this.master = this.context.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.context.destination);
    this.layers = [130.81, 196, 261.63].map((frequency, index) => {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.value = .025 / (index + 1);
      oscillator.connect(gain).connect(this.master);
      oscillator.start();
      return oscillator;
    });
    const lfo = this.context.createOscillator();
    const depth = this.context.createGain();
    lfo.frequency.value = .12;
    depth.gain.value = 1.5;
    lfo.connect(depth).connect(this.layers[1].frequency);
    lfo.start();
  }
  async enable(enabled) {
    await this.context.resume();
    this.master.gain.setTargetAtTime(enabled ? .65 : 0, this.context.currentTime, .25);
  }
  tune(tone) {
    const base = { dawn: 130.81, rain: 146.83, dusk: 110 }[tone] || 130.81;
    this.layers.forEach((oscillator, index) => oscillator.frequency.setTargetAtTime(base * [1, 1.5, 2][index], this.context.currentTime, .4));
  }
  chime() {
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(523.25, this.context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(1046.5, this.context.currentTime + .2);
    gain.gain.setValueAtTime(.035, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.0001, this.context.currentTime + .7);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(); oscillator.stop(this.context.currentTime + .7);
  }
}

async function toggleSound() {
  try {
    audio ||= new LakeAudio();
    const next = !state.sound;
    await audio.enable(next);
    state.sound = next;
    $('#sound-toggle').setAttribute('aria-pressed', String(next));
    $('#sound-toggle span').textContent = next ? 'Sound on' : 'Sound off';
    $('#sound-toggle svg').innerHTML = next
      ? '<path d="M4 9v6h4l5 4V5L8 9Zm13-1q5 4 0 8m3-11q8 7 0 14"/>'
      : '<path d="M4 9v6h4l5 4V5L8 9Zm13 0 4 6m0-6-4 6"/>';
    const radioButton = $('#radio-toggle');
    if (radioButton) radioButton.textContent = next ? 'Pause the lake ↗' : 'Listen to the lake ↗';
    toast(next ? 'A soft, imaginary soundtrack for the lake.' : 'Back to a little peace and quiet.');
  } catch { toast('This browser cannot play the lake soundtrack.'); }
}

function syncMotion() {
  const enabled = !state.paused && !document.hidden;
  if (state.world && lastWorldMotion !== enabled) { state.world.setMotion(enabled); lastWorldMotion = enabled; }
  if (cosmos && lastCosmosMotion !== enabled) { cosmos.setMotion(enabled); lastCosmosMotion = enabled; }
  $('#motion-toggle').setAttribute('aria-pressed', String(state.paused));
  $('#motion-toggle').setAttribute('aria-label', state.paused ? 'Resume animation' : 'Pause animation');
  $('#motion-toggle span').textContent = state.paused ? '▷' : 'Ⅱ';
  syncRoaming();
}

function syncReading() {
  document.documentElement.dataset.reading = String(panel.open);
  state.world?.setReading?.(panel.open);
  cosmos?.setReading?.(panel.open);
}

function toggleTheme() {
  state.night = !state.night;
  document.documentElement.dataset.theme = state.night ? 'night' : 'day';
  document.querySelector('meta[name=theme-color]').content = state.night ? '#080715' : '#100b1d';
  state.world?.setTheme(state.night ? 'night' : 'day');
  $('#theme-toggle').setAttribute('aria-pressed', String(state.night));
  $('#theme-toggle').setAttribute('aria-label', state.night ? 'Switch to day' : 'Switch to night');
  $('#time-label').textContent = state.night ? 'moonlit city' : 'sunlit city';
  storage.set('theme', state.night ? 'night' : 'day');
}

const projects = Object.freeze({
  retail: {
    number: '01', title: 'Virtual Retail Assistant', short: 'Virtual Retail', icon: '✧', category: 'AI product · Retail experience',
    intro: 'A helpful AI companion for the people helping customers.',
    story: 'Led the product work for an AI assistant designed to augment more than 180 retail associates. The experience combines embedded guardrails, a CSAT feedback loop, and a one-tap handoff to a human.',
    role: 'Product vision, backlog priorities, user needs, and acceptance criteria; partnering with engineering and specialists on delivery.',
    facts: [['~$3.2M', 'Business case'], ['180+', 'Associates in scope']],
    outcome: 'A ~$3.2M business case, with customer feedback and human handoff built into the experience.',
    skills: ['AI product strategy', 'Human handoff', 'Customer experience'], source: 'Career summary provided by Alexis.',
    illustration: { alt: 'A market stall under a stone arcade at dusk: a glowing tablet on a carved counter, a holographic speech bubble above it, canoes with lanterns on the canal behind.', caption: 'Illustration. Not a screenshot.' },
  },
  rxp: {
    number: '02', title: 'Agentic Content Studio', short: 'Content Studio', icon: '⌘', category: 'Agentic AI · Enterprise production',
    intro: 'An AI agent that turns product data into e-commerce content, inside enterprise security.',
    leadWords: ['video', 'image', 'copy', 'SEO'],
    story: 'Product owner for an agentic application that generates e-commerce product content, starting with video for a print product line, from existing product data. An open workflow engine orchestrates the agent in managed containers, behind a React front end and a Node API with token validation and role checks, with PostgreSQL and vector search, private networking and enterprise single sign-on.',
    role: 'Product ownership from the architecture proposal through security, privacy and vendor-risk review toward production: requirements, trade-off decisions, and the compliance path.',
    facts: [['$250K', 'Cost savings · approved benefit', { count: 250, prefix: '$', suffix: 'K' }], ['$2.5M', 'Revenue uplift · approved benefit', { count: 2.5, prefix: '$', suffix: 'M', decimals: 1 }], ['16', 'Security requirements in the architecture review', { count: 16 }], ['3', 'Assessments: security, privacy, vendor risk', { count: 3 }]],
    outcome: 'An approved benefit case of $250K savings and $2.5M revenue uplift, and an architecture that went through a 16-requirement security review, a privacy impact assessment and a vendor risk assessment.',
    skills: ['Agentic orchestration', 'Security & governance review', 'Privacy by design', 'n8n · Azure · PostgreSQL'], source: 'CV-reported benefit case and FY26 delivery records.',
    illustration: { alt: 'A stepped pyramid workshop beside a canal, its terraces lined with glass chambers that turn cubes of product data into glowing media cards.', caption: 'Illustration. Not a screenshot.' },
  },
  slides: {
    number: '03', title: 'Automated Quote Generation', short: 'Quote Works', icon: '▤', category: 'Unattended automation · Production',
    intro: 'A robot that builds service-renewal quotes overnight, so sellers start the day ahead.',
    leadWords: ['overnight', 'unattended', 'by queue', 'at 21:00'],
    story: 'Two cooperating robots on the enterprise RPA framework: a dispatcher that enqueues the night\'s approved renewal opportunities at 21:00, and a performer that works the queue one item at a time, fetching the source file, running the entitlement and pricing lookup, building the quote, filing it in the shared library and writing the link and status back to the tracker. A cloud flow refreshes the queue every five hours from the trackers the business has marked ready, so the business decides scope without a developer touching anything.',
    role: 'Product owner: scope and benefit case, the ready-to-process control so the business owns what is in scope, UAT acceptance, and the move-to-production package with the automation operations team. One developer on my squad built it.',
    facts: [['1,200', 'Renewal opportunities per quarter', { count: 1200 }], ['93%', 'Of processing time was the external lookup', { count: 93, suffix: '%' }], ['50 / 50', 'Validation items processed, zero errors', { count: 50, suffix: ' / 50' }], ['33', 'Work items closed at go-live', { count: 33 }]],
    outcome: 'Live in production since late August 2026 on a nightly schedule. Volume came in above the approved case; the business asked for more scope and the quote data now feeds other teams.',
    skills: ['Unattended RPA', 'Queue-driven design', 'Production operations', 'Benefit cases'], source: 'Delivery documentation and go-live approval, September 2026.',
    illustration: { alt: 'A stone press house on a causeway: a carved mechanism with a sun-disc wheel turns loose paper slips into a neat stack of sealed tablets, a ceremonial bell above it.', caption: 'Illustration. Not a screenshot.' },
  },
  playbooks: {
    number: '04', title: 'Mission Control', short: 'Mission Control', icon: '≡', category: 'Copilot agent · People and initiatives',
    intro: 'A Teams agent that knows who can help, and what the organisation is working on.',
    leadWords: ['help', 'pair', 'review', 'unblock'],
    story: 'A Copilot Studio agent over two data domains. People profiles: role, team, capacity, availability, how someone likes to help (consulting, pairing, code review) and skills rated 1 to 5. An initiative inventory: 53 initiatives with status, delivery team, expected delivery and the skills they need. Four guided actions: create or edit my profile, find who can help me, see an initiative, update an initiative. "Find who can help" ranks people with a reason for each suggestion, drafts the brief, and sends the introduction with the requester in copy.',
    role: 'Product owner: the proposal, the data model for both domains, the guided actions, and the stories; one developer built it. Pilot on my own squad first, then the wider organisation.',
    facts: [['53', 'Initiatives tracked in the inventory', { count: 53 }], ['41', 'On track at the October 2026 cut', { count: 41 }], ['1 to 5', 'Skill levels, per person, per skill'], ['~$22K', 'Yearly run-rate case, projected', { count: 22, prefix: '~$', suffix: 'K' }]],
    outcome: 'First epic delivered (14 stories, 34 points) as a working prototype on dummy data; first real user registered in October 2026. The benefit case is projected until the production phase ships.',
    skills: ['Copilot Studio', 'Matching and ranking', 'Data modelling', 'Org design'], source: 'Proposal, user guide and initiative inventory, September to October 2026.',
    illustration: { alt: 'An observatory terrace at night with a circular floor projection like a sun stone, pins and small flags connected by arcs of light, the lake city below.', caption: 'Illustration. Not a screenshot.' },
  },
  adoption: {
    number: '05', title: 'AI on the Rise', short: 'Adoption Lab', icon: '⌁', category: 'Analytics · AI adoption',
    intro: 'Making adoption data tell a story leaders can act on.',
    leadWords: ['act on', 'argue with', 'rank by', 'trust'],
    story: 'A Power BI tracker for AI-literacy completion across the Guadalajara site: completion rate against an 85 percent goal, a podium and standings by organisation, a race timeline of cumulative completions, biggest movers against a February baseline, and drill paths down to manager level. The model was rebuilt on the way: about 90 measures reduced to 37, rankings moved from fragile measures to precomputed columns so deltas are stable at refresh time, and three course versions deduplicated into one exam.',
    role: 'Built the model and the pages myself, with the report owner as partner on the data; shaped the pages around the questions site leaders were actually asking.',
    facts: [['85%', 'Completion goal for the first literacy level', { count: 85, suffix: '%' }], ['37', 'Measures after the cleanup, from about 90', { count: 37 }], ['24', 'Projects my squad shipped this fiscal year', { count: 24 }], ['17%', 'Of the organisation\'s delivery came from this site', { count: 17, suffix: '%' }]],
    outcome: 'Recognised in August 2026 for turning adoption data into a clear, useful story. Used in site leadership reviews.',
    skills: ['Power BI and DAX', 'Data storytelling', 'Model design', 'AI enablement'], source: 'Report build notes and FY26 recognition review, 2026.',
    illustration: { alt: 'Terraced garden platforms rising across the lake like bars of a chart, lanterns on each terrace, a stone causeway along their tops and a sighting tube in the foreground.', caption: 'Illustration. Not a screenshot.' },
  },
  learning: {
    number: '06', title: 'Three-Year Market Planning', short: 'Planning Bot', icon: '✳', category: 'Agentic AI · Future of work',
    intro: 'One governed data spine, a global data pack, 19 regenerated playbooks and an analyst agent, built as product owner and builder.',
    leadWords: ['governed', 'sourced', 'audited', 'shared'],
    story: 'Three-year market planning used to be a manual cycle: analysts rebuilt country packs by hand four times a year and leaders waited for them. The platform replaces that with three solutions on one governed data layer. A Power BI data pack (27 pages: market size by category and segment, growth, competitive share, IT spend for 47 countries, macro from public actuals and forecasts for 38 countries, financial baselines, six segment views, row-level security). A scripted pipeline that regenerates the 19 EMEA cluster playbooks from a 14-source registry with audits for the formula hazards that used to hide in the spreadsheets. And a Copilot analyst agent grounded on the same data, with 50 planning prompts classified up front: 9 live, 8 partial, 13 planned, 20 that need a source that does not exist yet.',
    role: 'Product owner and builder. I wrote the benefit case and the stories, and I built the data pack and the playbook pipeline myself with an AI pair; two developers own the governed layer and the production agent.',
    facts: [['$2.1M', 'Approved recurring benefit, lands next quarter', { count: 2.1, prefix: '$', suffix: 'M', decimals: 1 }], ['26,312', 'Hours per year the case rests on', { count: 26312 }], ['1.66M', 'Rows in the market model', { count: 1.66, suffix: 'M', decimals: 2 }], ['19', 'Cluster playbooks regenerated every cycle', { count: 19 }]],
    outcome: 'Data pack published and in test market by market; the first playbook approved by the business owner and three more in validation before the remaining fifteen; agent in build with a working mockup carrying the leadership demo.',
    skills: ['Agentic AI', 'Power BI and DAX', 'Data engineering', 'Benefit cases', 'PO and builder'], source: 'Approval form, benefit model, onboarding and reconciliation notes, August to October 2026.',
    illustration: { alt: 'A round stone planning table in a roofed hall, a map of soft tiles with three glowing tokens, a stack of folded books with a beam of light rising from the top one.', caption: 'Illustration. Not a screenshot.' },
  }
});

const caseDetails = Object.freeze({
  retail: {
    filter: ['ai'], scope: 'Retail associate experience', status: 'Business case', evidence: 'CV-reported business case',
    problem: 'Retail associates need useful answers at the moment a customer asks a question. An assistant also needs to know when a person should take over.',
    contributions: ['Turn associate needs into product vision and a prioritized backlog.', 'Define user stories and acceptance criteria with engineering and specialists.', 'Make feedback, guardrails, and human handoff part of the product experience.'],
    steps: [['Understand the need', 'An associate brings a customer question into the experience.'], ['Assist with guardrails', 'The assistant supports the interaction within defined product boundaries.'], ['Keep people in control', 'CSAT feedback and a one-tap human handoff close the loop.']],
    decision: 'Design the handoff as a product feature.', rationale: 'An AI experience earns trust when feedback and the route to a human are easy to find.',
    takeaway: 'A product case that pairs commercial opportunity with the experience of the people using it.',
    boundary: 'The ~$3.2M figure is a business case, not a claim of realized revenue. The 180+ figure describes associates in scope.'
  },
  rxp: {
    filter: ['ai', 'automation'], scope: 'Agentic content generation for e-commerce', status: 'In delivery · production path', evidence: 'Approved benefit case · security review record', diagram: 'agentic-studio',
    problem: 'Product pages need fresh video, images and copy for thousands of SKUs, and producing them by hand does not scale. An AI agent can draft them, but only if the application survives enterprise security review: identity, data boundaries, secrets, and what happens to personal data before anything reaches an external model.',
    contributions: ['Owned the product from the architecture proposal through security review, including the decisions on single sign-on, role-based access, private endpoints and secrets management.', 'Drove the privacy path: detect-and-redact for personal data before any external AI call, and crypto-shredding for data that must be unrecoverable at rest, because encryption cannot protect text that an external model has to read in the clear.', 'Ran the vendor risk and privacy impact assessments for the workflow engine, and kept delivery moving when the review clock reset and the design had to be re-declared.'],
    steps: [['Sign in through enterprise identity', 'An employee opens the app; single sign-on and role checks decide what they can do.'], ['Request content', 'The React UI calls the Node API through a private entry point; nothing is reachable from the public internet.'], ['Orchestrate the agent', 'The API hands the job to the workflow engine, which plans the steps and gathers product data.'], ['Call external AI, safely', 'Personal data is redacted first; then LLM and video or image generation APIs produce drafts.'], ['Store, review, publish', 'Drafts and assets land in private storage and the database; reviewers approve before anything goes live.']],
    decision: 'Treat the security review as part of the product, not a gate at the end.', rationale: 'The model was the easy part. Identity, data boundaries and review evidence decided whether the application could ship, so they were designed in from the first architecture diagram.',
    takeaway: 'An agentic product that is also an enterprise product: orchestration and governance, shown end to end.',
    boundary: 'Benefit figures are approved values from the internal idea platform, not finance-booked results. The architecture shown is a simplified, genericized version of the reviewed design.'
  },
  slides: {
    filter: ['automation'], scope: 'Service-renewal quoting for a retention sales team', status: 'Live · nightly schedule', evidence: 'Delivery records and written go-live approval', diagram: 'quote-robot',
    problem: 'Every renewal opportunity needs a quote before a seller can talk to the customer. Building one meant reading the tracker, looking up entitlement and pricing in a separate portal, assembling the document, filing it, and writing the link and status back. About 1,200 opportunities a quarter, peaking exactly when sellers should be with customers, and the external lookup alone took 93 percent of the time and ran slowest during business hours.',
    contributions: ['Scoped it as a queue-driven production line rather than a script: every item individually tracked, retried and logged, with a nightly window chosen because the external portal is fastest outside business hours.', 'Put the business in control of scope through a ready-to-process flag on their own trackers, refreshed every five hours, so a region can be paused without a developer.', 'Carried the production package: design documents, code review, support guide, UAT sign-off, and a validation list built as a 1:1 replica of a real tracker across 9 countries and 29 resellers.'],
    steps: [['Business marks what to quote', 'Trackers stay as they are; a flag says which opportunities are ready.'], ['Queue refreshes every five hours', 'A cloud flow reads the approved trackers and keeps the work list current.'], ['Dispatcher wakes at 21:00', 'One work item per opportunity goes into the production queue.'], ['Performer works the queue', 'Source file, lookup, quote document, filed in the library, link and status written back; a 50-item batch takes about 5.3 hours.'], ['Morning: quotes are waiting', 'A run summary goes out; the team opens the tracker and the work is done.']],
    decision: 'Run at night, by queue, not by clock.', rationale: 'The slow part was an external dependency that is faster when nobody is using it. A queue means volume changes the finish time, never the outcome, and operations can see what happened to every single item.',
    takeaway: 'Automation that took the copying and left the judgement with the seller.',
    boundary: 'Figures come from the delivery documentation: 1,200 opportunities a quarter, a 1,568-row tracker at validation, 50 of 50 items in both the test and production validation runs. No hours-saved figure is claimed here beyond the approved benefit case, which is not yet measured in production.'
  },
  playbooks: {
    filter: ['ai'], scope: 'People profiles and an initiative inventory for one organisation', status: 'Prototype delivered · first real user', evidence: 'Proposal, user guide, inventory snapshot', diagram: 'mission-control',
    problem: 'An organisation moving toward shared moonshot efforts had neither a current picture of who could do what, nor one inventory of what was in flight. Finding the right person meant asking around; finding an initiative meant knowing where it was written down.',
    contributions: ['Designed the two data domains and the survey that fills them: identity, seniority, team, languages, tool proficiency, skills, capacity, availability and quality signals on one side; initiatives, personas, status and links to the idea platform and the backlog on the other.', 'Defined the four guided actions and the ranking rule: rank people, do not just filter them, using quality signals on top of relevance, capacity and availability, and always say why.', 'Chose the platform for governance reasons: already approved by security, inside the same tenant as the form and the store, so the pilot could start with my own squad.'],
    steps: [['Fill a profile', 'Role, team, capacity, availability, how you like to help, skills rated 1 to 5, initiatives.'], ['Ask for help', 'Say whether the idea is registered, pick the initiative or the skills, choose consulting, pairing or code review.'], ['Read ranked suggestions', 'Each person comes with a reason; "recommended" marks the stronger match.'], ['Send a brief', 'Describe what you tried and where it failed; the agent drafts the message and sends it with you in copy.'], ['Keep the inventory honest', 'See or update an initiative without leaving the chat; a moonshot flag routes to the committee in a later version.']],
    decision: 'Rank, explain, and let the human send.', rationale: 'A match without a reason is a guess, and an introduction nobody reviewed is spam. The agent proposes; the person decides.',
    takeaway: 'A small agent that makes an organisation legible to itself.',
    boundary: 'The run-rate case (about 20 requests a week at 35 minutes each) is projected and accrues only after the production phase ships. The first epic delivered a prototype on dummy data; the inventory snapshot of 53 initiatives is from October 2026.'
  },
  adoption: {
    filter: ['ai', 'data'], scope: 'Site leadership audience', status: 'In use · recognised August 2026', evidence: 'Build notes and FY26 recognition review', diagram: 'adoption-tracker', widgets: ['footprint'],
    problem: 'A completion number on its own does not tell leaders where progress is happening, who is moving, or where an opportunity needs attention. The original report also had a fragile model: ranking measures that failed when the filter context was ambiguous, and three versions of the same exam counted three times.',
    contributions: ['Rebuilt the model: about 90 measures down to 37 in clean display folders, rankings precomputed in a calculated table so deltas against the baseline are stable, and the exam versions deduplicated by person.', 'Designed the pages around leadership questions: a toggle between completion rate and weighted contribution, a podium and standings, a race timeline, biggest movers, and drill titles that follow the path.', 'Declared the data gaps instead of hiding them: badges, days to complete and not-started counts wait on sources that do not exist yet.'],
    steps: [['Start with the questions', 'Where are we against the goal, who is moving, where do we push?'], ['Fix the model first', 'Stable rankings and clean measures before any visual.'], ['Make progress visible', 'Rate against an 85 percent goal, standings, movers, cumulative race.'], ['Drill where it matters', 'Organisation, then team, then manager, with the breadcrumb following.'], ['Say what is missing', 'An open-data-issues table with severity, owned by someone.']],
    decision: 'Precompute the rankings.', rationale: 'A ranking that changes with the filter context is not a ranking anyone can act on. Computing it at refresh time made the deltas trustworthy and the page fast.',
    takeaway: 'Analytics designed around an audience and the decisions it has to make.',
    boundary: 'The 85 percent goal and the measure counts come from the build. The site footprint figures (24 squad projects, 17 percent of delivery) are approved benefit values on an internal idea platform as of October 2026, not finance-booked results.'
  },
  learning: {
    filter: ['ai', 'data', 'automation'], scope: 'Global market planning, four cycles a year', status: 'In delivery · benefit lands next quarter', evidence: 'Approval form and benefit model', diagram: 'planning-platform', widgets: ['adaptive-card', 'coverage', 'benefit'],
    builder: 'As the product owner I wrote the benefit case, the approval package and the stories, and I run the testing market by market with the planning leads. As the builder I made the Power BI data pack (model, DAX, the EMEA hub with 19 cluster chips, row-level security roles) and the playbook pipeline: the source registry, the rebuild recipe, the extraction scripts and the audits that catch hard-coded plugs and broken shared formulas, working with an AI pair the whole way. Two developers own what has to outlive me: the governed data layer and the production agent. The n8n mockup of the agent that carried the leadership demo was mine too.',
    problem: 'Planning packs were rebuilt by hand, country by country, four times a year, from a dozen sources with different grains, segment rules and currencies. Leaders spent hours per cycle requesting and interpreting them. The numbers could disagree with each other because nobody owned the rule that said where a figure came from.',
    contributions: ['Set the rules before the tools: one source per number, four named customer segments with the mid-market rollout decided once, respect row-level security everywhere, and an agent that says what it does not know rather than inventing win-loss or pipeline figures.', 'Built the global data pack and the scripted playbook pipeline myself: 1.66 million rows across six categories, a 14-source registry with an owner per source, a rebuild recipe per cluster with audits for the hazards that lived inside the old spreadsheets.', 'Classified all 50 planning prompts before anyone built the agent, so release one promises 9 answers it can source and names the owner of the data for the 20 it cannot.'],
    steps: [['Register every source', 'Fourteen named sources, one owner each, one rule for how each feeds the model.'], ['Build the governed layer', 'A Dataverse spine the dashboard, the playbooks and the agent all read, so they cannot disagree.'], ['Regenerate the playbooks', 'A recipe per cluster rebuilds the workbook from the sources and audits it; the first cluster approved, three in validation, then the rest.'], ['Publish the data pack', 'Twenty-seven pages with row-level security, tested market by market with real planning leads.'], ['Ground the agent', 'Every answer cites its source view and cycle; partial answers name the gap and the owner.']],
    decision: 'One source per number, and the agent may never disagree with the dashboard.', rationale: 'Planning fails on trust before it fails on tooling. Grounding all three solutions on one governed layer is slower to start and the only thing that survives a leadership review.',
    takeaway: 'The future-of-work shape of product ownership: own the problem, build the first version with an AI pair, hand the durable parts to engineers.',
    boundary: 'The $2.1M is labor productivity at an approved $80 per hour: 6,400 hours from the global solutions and 19,912 from regenerating 19 playbooks each cycle. It is an approved benefit value on an internal idea platform and lands in the next fiscal quarter; nothing is realised yet. Revenue enhancement is held out of the total. One-time build about 635 developer hours; run cost about $22K a year.'
  }
});

const shortlist = (() => {
  try { const saved = JSON.parse(storage.get('shortlist', '[]')); return Array.isArray(saved) ? [...new Set(saved)].filter(id => typeof id === 'string' && Object.hasOwn(projects, id)).slice(0, 3) : []; }
  catch { return []; }
})();
// ---------------------------------------------------------------------------
// Showcase components: word swap, rolling numbers, interactive architecture.
// Original code for this portfolio; no library, degrades to static text.
// ---------------------------------------------------------------------------
function illustrationMarkup(id, p) {
  const stored = document.querySelector(`[data-illustration="${id}"]`);
  if (!stored || !p.illustration) return '';
  const src = stored.getAttribute('src'), placeholder = stored.getAttribute('data-placeholder') || '';
  return `<figure class="case-illustration"${placeholder ? ` style="background-image:url('${placeholder}')"` : ''}><img src="${escapeHTML(src)}" width="1600" height="900" alt="${escapeHTML(p.illustration.alt)}" loading="lazy" decoding="async"><figcaption>${escapeHTML(p.illustration.caption)}</figcaption></figure>`;
}
function leadMarkup(p) {
  if (!p.leadWords?.length) return p.intro;
  const [first] = p.leadWords;
  const pattern = new RegExp(`\\b${first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
  if (!pattern.test(p.intro)) return p.intro;
  return p.intro.replace(pattern, `<span class="word-swap" data-words="${escapeHTML(p.leadWords.join('|'))}">${escapeHTML(first)}</span>`);
}
function countAttributes(roll) {
  if (!roll || typeof roll.count !== 'number') return '';
  return ` data-count="${roll.count}"${roll.prefix ? ` data-prefix="${escapeHTML(roll.prefix)}"` : ''}${roll.suffix ? ` data-suffix="${escapeHTML(roll.suffix)}"` : ''}${roll.decimals ? ` data-decimals="${roll.decimals}"` : ''}`;
}
function formatCount(el, value) {
  const decimals = Number(el.dataset.decimals || 0);
  const number = decimals ? value.toFixed(decimals) : Math.round(value).toLocaleString('en-US');
  return `${el.dataset.prefix || ''}${number}${el.dataset.suffix || ''}`;
}
function animateCount(el) {
  const target = Number(el.dataset.count), started = performance.now(), duration = 900;
  const tick = (now) => {
    const k = Math.min(1, (now - started) / duration), eased = 1 - Math.pow(1 - k, 3);
    el.textContent = formatCount(el, target * eased);
    if (k < 1) requestAnimationFrame(tick); else el.dataset.counted = 'true';
  };
  requestAnimationFrame(tick);
}
function mountCounters(scrollRoot) {
  const counters = [...document.querySelectorAll('[data-count]')].filter(el => !el.dataset.counted);
  if (!counters.length) return;
  const finish = (el) => { el.dataset.counted = 'true'; el.textContent = formatCount(el, Number(el.dataset.count)); };
  if (reducedMotion.matches || typeof IntersectionObserver === 'undefined') { counters.forEach(finish); return; }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => { if (!entry.isIntersecting) return; observer.unobserve(entry.target); animateCount(entry.target); });
  }, { root: scrollRoot || null, threshold: .35 });
  counters.forEach(el => { el.dataset.counted = 'pending'; el.textContent = formatCount(el, 0); observer.observe(el); });
}
function mountWordSwaps() {
  document.querySelectorAll('.word-swap').forEach(el => {
    if (el.dataset.live) return;
    const words = (el.dataset.words || el.textContent || '').split('|').map(word => word.trim()).filter(Boolean);
    if (!words.length) return;
    el.dataset.live = 'true';
    el.setAttribute('aria-label', words.join(' / '));
    el.innerHTML = `${words.map(word => `<span class="word-swap-measure" aria-hidden="true">${escapeHTML(word)}</span>`).join('')}<span class="word-swap-current" aria-hidden="true">${escapeHTML(words[0])}</span>`;
    if (words.length < 2 || reducedMotion.matches || typeof setInterval === 'undefined') return;
    let index = 0, timer = 0, paused = false;
    const step = () => {
      if (!el.isConnected) { clearInterval(timer); return; }
      if (paused || document.hidden) return;
      index = (index + 1) % words.length;
      const current = el.querySelector?.('.word-swap-current:not(.is-leaving)');
      const next = document.createElement('span');
      next.className = 'word-swap-current is-entering'; next.setAttribute('aria-hidden', 'true'); next.textContent = words[index];
      el.append(next);
      if (current) { current.classList.add('is-leaving'); setTimeout(() => current.remove(), 460); }
      requestAnimationFrame(() => requestAnimationFrame(() => next.classList.remove('is-entering')));
    };
    el.addEventListener('mouseenter', () => { paused = true; }); el.addEventListener('mouseleave', () => { paused = false; });
    el.addEventListener('focusin', () => { paused = true; }); el.addEventListener('focusout', () => { paused = false; });
    timer = setInterval(step, 2100);
  });
}

// Genericized architecture of the agentic content studio. Node ids double as
// the vocabulary for steps and governance gates; nothing here names a vendor
// beyond the open components the case study already states.
const diagrams = Object.freeze({
  'agentic-studio': {
    title: 'How the agentic content studio is put together', play: 'Play the request ▸', gates: 'Marked parts are the governance gates: identity, role checks, workload identity, key vault, and redaction before external AI.',
    caption: 'Simplified from the reviewed architecture. Hover or focus a part to read what it does; press a step to follow one request.',
    groups: [
      { id: 'vnet', x: 212, y: 24, w: 728, h: 492, label: 'Private virtual network · no public internet path', dashed: true },
      { id: 'entry', x: 230, y: 56, w: 160, h: 190, label: 'Private entry' },
      { id: 'k8s', x: 416, y: 56, w: 230, h: 190, label: 'Kubernetes namespace' },
      { id: 'managed', x: 672, y: 56, w: 250, h: 190, label: 'Managed services · private links' },
      { id: 'internal', x: 230, y: 292, w: 160, h: 118, label: 'Internal integrations' },
      { id: 'ai', x: 672, y: 292, w: 250, h: 210, label: 'External AI APIs · internet' }
    ],
    nodes: [
      { id: 'sso', x: 24, y: 70, w: 160, h: 58, title: 'Enterprise identity', sub: 'SSO · OIDC', gate: true, steps: [1], text: 'Every session starts with the company identity provider. No local accounts, no shared passwords.' },
      { id: 'browser', x: 24, y: 170, w: 160, h: 58, title: 'Employee browser', sub: 'React UI loads here', steps: [1, 2], text: 'The only client. Everything it reaches sits behind the private entry point.' },
      { id: 'gateway', x: 244, y: 84, w: 132, h: 44, title: 'Application gateway', sub: 'private, internal', steps: [2], text: 'Terminates TLS and keeps the app off the public internet.' },
      { id: 'lb', x: 244, y: 140, w: 132, h: 40, title: 'Internal load balancer', steps: [2], text: 'Routes into the cluster without a public IP.' },
      { id: 'ingress', x: 244, y: 192, w: 132, h: 40, title: 'Ingress', sub: 'UI and API routes', steps: [2], text: 'Two routes: the UI bundle and the API.' },
      { id: 'ui', x: 432, y: 86, w: 198, h: 48, title: 'React front end', sub: 'content requests, review queue', steps: [2], text: 'Where associates request content and reviewers approve drafts.' },
      { id: 'api', x: 432, y: 146, w: 198, h: 48, title: 'Node API', sub: 'JWT validation · role checks', gate: true, steps: [2, 3, 4], text: 'Validates the identity token on every call and applies role-based access before touching data.' },
      { id: 'identity', x: 432, y: 204, w: 198, h: 32, title: 'Workload identity · secrets', gate: true, steps: [3], text: 'Containers get their secrets from the vault at runtime; nothing lives in images or config files.' },
      { id: 'db', x: 686, y: 86, w: 108, h: 56, title: 'PostgreSQL', sub: 'with vector search', steps: [3, 5], text: 'Application data and embeddings. Personal data that must be unrecoverable is crypto-shredded, not just encrypted.' },
      { id: 'blob', x: 802, y: 86, w: 108, h: 56, title: 'Blob storage', sub: 'assets, drafts', steps: [3, 5], text: 'Generated video and image assets, kept private until approved.' },
      { id: 'vault', x: 686, y: 154, w: 108, h: 56, title: 'Key vault', sub: 'secrets, keys', gate: true, steps: [3], text: 'Single source for credentials to databases, storage and external APIs.' },
      { id: 'registry', x: 802, y: 154, w: 108, h: 56, title: 'Container registry', sub: 'image pull', steps: [], text: 'The cluster pulls signed images from a private registry.' },
      { id: 'n8n', x: 432, y: 318, w: 198, h: 66, title: 'Workflow engine (n8n)', sub: 'agent orchestration', steps: [4, 5], text: 'Plans the job: gather product data, draft, generate media, hand back for review. Open source, assessed for vendor risk.' },
      { id: 'dam', x: 244, y: 318, w: 132, h: 38, title: 'Digital asset library', steps: [4], text: 'Existing product imagery and brand assets the agent is allowed to use.' },
      { id: 'catalog', x: 244, y: 364, w: 132, h: 38, title: 'Product content pipeline', steps: [5], text: 'Where approved content is published to the storefront.' },
      { id: 'redact', x: 686, y: 318, w: 224, h: 40, title: 'Detect and redact personal data', gate: true, steps: [4], text: 'Runs before any external call. An external model has to read text in the clear, so the only protection is to remove what should not travel.' },
      { id: 'llm', x: 686, y: 372, w: 108, h: 52, title: 'LLM APIs', sub: 'copy, SEO', steps: [4], text: 'Frontier models for product copy and structured SEO fields.' },
      { id: 'media', x: 802, y: 372, w: 108, h: 52, title: 'Media generation', sub: 'video, image', steps: [4], text: 'Generates the first-draft media from product data and brand assets.' },
      { id: 'seo', x: 686, y: 436, w: 224, h: 44, title: 'Specialized APIs', sub: 'templating, SEO checks', steps: [4], text: 'Narrow services the agent calls after the draft exists.' },
      { id: 'logs', x: 244, y: 440, w: 132, h: 56, title: 'Logs and tracing', steps: [], text: 'Every agent run is traceable: who asked, what was called, what came back.' }
    ],
    edges: [
      { from: 'browser', to: 'sso', steps: [1], label: 'sign in' },
      { from: 'browser', to: 'gateway', steps: [2] },
      { from: 'gateway', to: 'lb', steps: [2] },
      { from: 'lb', to: 'ingress', steps: [2] },
      { from: 'ingress', to: 'ui', steps: [2] },
      { from: 'ingress', to: 'api', steps: [2] },
      { from: 'api', to: 'db', steps: [3] },
      { from: 'api', to: 'vault', steps: [3] },
      { from: 'api', to: 'n8n', steps: [4] },
      { from: 'n8n', to: 'dam', steps: [4] },
      { from: 'n8n', to: 'redact', steps: [4] },
      { from: 'redact', to: 'llm', steps: [4] },
      { from: 'redact', to: 'media', steps: [4] },
      { from: 'n8n', to: 'blob', steps: [5] },
      { from: 'n8n', to: 'db', steps: [5] },
      { from: 'n8n', to: 'catalog', steps: [5] },
      { from: 'n8n', to: 'logs', steps: [] }
    ],
    steps: ['Sign in through enterprise identity', 'Request content through the private entry', 'API reads data and secrets over private endpoints', 'Agent redacts, then calls external AI', 'Drafts are stored, reviewed and published']
  },
  'quote-robot': {
    title: 'How the overnight quoting line is put together', play: 'Play one night ▸', gates: 'Marked parts are the controls: the business decides scope with the ready flag, the queue tracks and retries every item, and the night window works around the slow external portal.',
    caption: 'Simplified from the delivery design. Hover or focus a part to read what it does; press a step to follow one night.',
    groups: [
      { id: 'biz', x: 24, y: 56, w: 200, h: 200, label: 'Business, during the day' },
      { id: 'feed', x: 250, y: 56, w: 180, h: 200, label: 'Feeder, every 5 hours' },
      { id: 'bots', x: 456, y: 24, w: 470, h: 232, label: 'Enterprise RPA framework · production control room', dashed: true },
      { id: 'out', x: 456, y: 292, w: 470, h: 210, label: 'What the seller finds in the morning' },
      { id: 'ext', x: 24, y: 292, w: 406, h: 210, label: 'Systems the performer visits' }
    ],
    nodes: [
      { id: 'tracker', x: 40, y: 84, w: 168, h: 54, title: 'Regional trackers', sub: '1,568 rows in one of them', steps: [1, 5], text: 'The team works renewals here as before. Nothing about their day changes.' },
      { id: 'flag', x: 40, y: 152, w: 168, h: 48, title: 'Ready-to-process flag', gate: true, steps: [1], text: 'The business, not the robot configuration, decides what is in scope. A region can be paused without a developer.' },
      { id: 'flow', x: 266, y: 100, w: 148, h: 54, title: 'Cloud flow', sub: 'refresh every 5 h', steps: [2], text: 'Reads only trackers marked ready, skips anything on hold or done, and rebuilds the work list.' },
      { id: 'list', x: 266, y: 176, w: 148, h: 44, title: 'Work list', steps: [2, 3], text: 'The night\'s candidates, one row per opportunity.' },
      { id: 'dispatcher', x: 474, y: 60, w: 150, h: 54, title: 'Dispatcher', sub: 'runs once, 21:00', steps: [3], text: 'Enqueues one work item per approved opportunity, then stops. It never does the work itself.' },
      { id: 'queue', x: 474, y: 136, w: 150, h: 48, title: 'Production queue', gate: true, steps: [3, 4], text: 'Every item is individually tracked, retried and logged. Volume changes the finish time, never the outcome.' },
      { id: 'performer', x: 660, y: 60, w: 246, h: 70, title: 'Performer', sub: 'triggered by the queue, not the clock', steps: [4], text: 'Takes one item at a time: source file, lookup, build, file, write back. A 50-item batch takes about 5.3 hours.' },
      { id: 'ops', x: 660, y: 156, w: 246, h: 48, title: 'Run log and summary email', steps: [5], text: 'Both error logs were empty on the 50 of 50 validation runs in test and in production.' },
      { id: 'source', x: 40, y: 320, w: 170, h: 48, title: 'Source data file', sub: 'attached to the opportunity', steps: [4], text: 'What the quote needs, as the team already stores it.' },
      { id: 'portal', x: 40, y: 384, w: 170, h: 54, title: 'Entitlement and pricing portal', gate: true, steps: [4], text: 'The slow part: 93 percent of processing time, and materially faster outside business hours. That is why the line runs at night.' },
      { id: 'doc', x: 236, y: 320, w: 178, h: 48, title: 'Quote document', steps: [4], text: 'Built from the template the sales team already uses.' },
      { id: 'lookup', x: 236, y: 384, w: 178, h: 54, title: 'Lookup result', sub: 'entitlement, price', steps: [4], text: 'Carried into the document and into the write-back.' },
      { id: 'library', x: 474, y: 320, w: 196, h: 54, title: 'Shared quote library', steps: [4, 5], text: 'One known place for every quote, across 9 countries and dozens of resellers.' },
      { id: 'writeback', x: 690, y: 320, w: 216, h: 54, title: 'Link and status on the row', steps: [4, 5], text: 'Opportunity created becomes quote created, with the link next to it.' },
      { id: 'seller', x: 474, y: 400, w: 432, h: 60, title: 'Seller opens the tracker', sub: 'the quote is already there', steps: [5], text: 'Time that used to go into assembling documents goes into the customer conversation.' }
    ],
    edges: [
      { from: 'tracker', to: 'flag', steps: [1] },
      { from: 'flag', to: 'flow', steps: [2], label: 'ready only' },
      { from: 'flow', to: 'list', steps: [2] },
      { from: 'list', to: 'dispatcher', steps: [3] },
      { from: 'dispatcher', to: 'queue', steps: [3] },
      { from: 'queue', to: 'performer', steps: [4] },
      { from: 'performer', to: 'source', steps: [4] },
      { from: 'performer', to: 'portal', steps: [4] },
      { from: 'portal', to: 'lookup', steps: [4] },
      { from: 'lookup', to: 'doc', steps: [4] },
      { from: 'doc', to: 'library', steps: [4] },
      { from: 'library', to: 'writeback', steps: [4] },
      { from: 'performer', to: 'ops', steps: [5] },
      { from: 'writeback', to: 'seller', steps: [5] }
    ],
    steps: ['The business marks what is ready to quote', 'The feeder refreshes the work list every five hours', 'The dispatcher enqueues the night at 21:00', 'The performer works the queue item by item', 'Quotes are filed, rows updated, summary sent']
  },
  'mission-control': {
    title: 'How Mission Control knows who can help', play: 'Play one request ▸', gates: 'Marked parts are the trust controls: profiles people fill themselves, quality signals on top of relevance, and a ranking that always gives a reason.',
    caption: 'Simplified from the proposal. Hover or focus a part to read what it does; press a step to follow one request.',
    groups: [
      { id: 'collect', x: 24, y: 56, w: 220, h: 200, label: 'Collection' },
      { id: 'sources', x: 24, y: 292, w: 220, h: 210, label: 'Enrichment sources' },
      { id: 'data', x: 270, y: 56, w: 220, h: 446, label: 'Data layer · tenant storage' },
      { id: 'agent', x: 516, y: 56, w: 200, h: 446, label: 'Copilot Studio agent' },
      { id: 'people', x: 742, y: 56, w: 184, h: 446, label: 'People' }
    ],
    nodes: [
      { id: 'staff', x: 40, y: 84, w: 188, h: 50, title: 'Staff', sub: 'everyone in the organisation', steps: [1], text: 'Pilot on my own squad first, then the wider organisation.' },
      { id: 'form', x: 40, y: 158, w: 188, h: 70, title: 'Profile form', sub: 'skills 1 to 5, capacity, availability', gate: true, steps: [1], text: 'Role, team, languages, tool proficiency, skills with levels, how you like to help, initiatives. A submitted list replaces the whole list, on purpose.' },
      { id: 'ideas', x: 40, y: 320, w: 188, h: 42, title: 'Idea platform', steps: [2], text: 'Registered ideas feed the initiative inventory.' },
      { id: 'backlog', x: 40, y: 372, w: 188, h: 42, title: 'Backlog and AI store', steps: [2], text: 'Links from each initiative to where the work lives.' },
      { id: 'ratings', x: 40, y: 424, w: 188, h: 50, title: 'Quality signals', sub: 'ratings, recommendations', gate: true, steps: [2, 3], text: 'The ranking uses quality on top of relevance, capacity and availability.' },
      { id: 'store', x: 286, y: 100, w: 188, h: 70, title: 'People profiles', sub: 'one row per person', steps: [1, 3], text: 'Who someone is and what they can do, kept current by the people themselves.' },
      { id: 'inventory', x: 286, y: 320, w: 188, h: 80, title: 'Initiative inventory', sub: '53 tracked · status, team, skills', steps: [2, 5], text: 'What is being worked on, mapped to personas, with a moonshot flag for the committee.' },
      { id: 'match', x: 532, y: 100, w: 168, h: 80, title: 'Matching and ranking', sub: 'rank, do not filter', gate: true, steps: [3], text: 'Every suggestion comes with a reason; "recommended" marks a stronger skill match.' },
      { id: 'actions', x: 532, y: 220, w: 168, h: 110, title: 'Four guided actions', sub: 'profile · find help · see · update', steps: [1, 2, 3, 5], text: 'Create or edit my profile, find who can help me, see an initiative status, update an initiative.' },
      { id: 'brief', x: 532, y: 370, w: 168, h: 70, title: 'Drafted brief', sub: 'what I tried, where it failed', steps: [4], text: 'The agent writes the introduction from the requester\'s description; the requester reviews it.' },
      { id: 'requester', x: 758, y: 100, w: 152, h: 60, title: 'Requester', sub: 'in Teams', steps: [3, 4], text: 'Says whether the idea is registered, picks the skills or the initiative, chooses consulting, pairing or code review.' },
      { id: 'helper', x: 758, y: 220, w: 152, h: 60, title: 'Suggested colleague', steps: [3, 4], text: 'Receives the brief by email with the requester in copy; replies go to the requester.' },
      { id: 'committee', x: 758, y: 370, w: 152, h: 70, title: 'Moonshot committee', sub: 'version 2', steps: [5], text: 'A flagged initiative routes here in the next version.' }
    ],
    edges: [
      { from: 'staff', to: 'form', steps: [1] },
      { from: 'form', to: 'store', steps: [1] },
      { from: 'ideas', to: 'inventory', steps: [2] },
      { from: 'backlog', to: 'inventory', steps: [2] },
      { from: 'ratings', to: 'store', steps: [2] },
      { from: 'store', to: 'match', steps: [3] },
      { from: 'inventory', to: 'actions', steps: [2, 5] },
      { from: 'requester', to: 'actions', steps: [3] },
      { from: 'actions', to: 'match', steps: [3] },
      { from: 'match', to: 'requester', steps: [3], label: 'ranked, with reasons' },
      { from: 'requester', to: 'brief', steps: [4] },
      { from: 'brief', to: 'helper', steps: [4], label: 'sent, requester in copy' },
      { from: 'inventory', to: 'committee', steps: [5] }
    ],
    steps: ['People fill and keep their profiles', 'Sources enrich the initiative inventory', 'A requester asks; the agent ranks and explains', 'The requester sends the drafted brief', 'Initiatives stay current; moonshots route onward']
  },
  'adoption-tracker': {
    title: 'How the adoption tracker is put together', play: 'Play one refresh ▸',
    caption: 'Simplified from the build notes. Hover or focus a part to read what it does; press a step to follow one refresh.',
    gates: 'Marked parts are the trust rules: one exam counted once per person, rankings computed at refresh rather than per filter, and data gaps declared on the page instead of hidden.',
    groups: [
      { id: 'src', x: 24, y: 24, w: 210, h: 478, label: 'Sources' },
      { id: 'model', x: 260, y: 24, w: 250, h: 478, label: 'Semantic model · 37 measures', dashed: true },
      { id: 'pages', x: 536, y: 24, w: 226, h: 478, label: 'Pages leaders use' },
      { id: 'people', x: 788, y: 24, w: 138, h: 478, label: 'Audience' }
    ],
    nodes: [
      { id: 'courses', x: 40, y: 56, w: 178, h: 60, title: 'Course completions', sub: 'SharePoint file, read directly', steps: [1], text: 'The raw completion rows the learning platform exports. Three course ids are the same first-level exam in three versions.' },
      { id: 'users', x: 40, y: 132, w: 178, h: 60, title: 'People master', sub: 'org, team, manager, site', steps: [1], text: 'Headcount by organisation and manager; the denominator for every rate on the report. Raw column names are unfriendly, so the model renames them once.' },
      { id: 'baseline', x: 40, y: 208, w: 178, h: 54, title: 'February baseline', sub: 'frozen snapshot', steps: [3], text: 'The point in time every "biggest mover" is measured against.' },
      { id: 'badges', x: 40, y: 290, w: 178, h: 54, title: 'Badges and assignments', sub: 'declared gap', steps: [5], text: 'Days to complete, not-started counts and badge data wait on sources that do not exist yet. The page says so.' },
      { id: 'refreshlog', x: 40, y: 360, w: 178, h: 54, title: 'Refresh history', sub: 'declared gap', steps: [5], text: 'A refresh log needs an automation flow that is not built yet; the Refresh Info table shows the last run instead.' },
      { id: 'dedup', x: 276, y: 56, w: 218, h: 60, title: 'Deduplicate the exam', sub: 'one pass per person', gate: true, steps: [1], text: 'Three course versions collapse into one completion per email, so nobody is counted three times.' },
      { id: 'core', x: 276, y: 132, w: 218, h: 70, title: 'Core measures', sub: 'completions, headcount, rate, pace', gate: true, steps: [2], text: 'Rate against the 85 percent goal and pace in percentage points, in clean display folders: Core, Time Intelligence, levels one to three, Manager, Weighted, Goal.' },
      { id: 'rankings', x: 276, y: 218, w: 218, h: 80, title: 'Rankings table', sub: 'computed at refresh', gate: true, steps: [3], text: 'Rank, weighted rank, rank in February and the delta are precomputed in a calculated table. Measure-based ranking failed when the filter context was ambiguous.' },
      { id: 'drill', x: 276, y: 314, w: 218, h: 60, title: 'Drill titles and breadcrumb', steps: [4], text: 'Titles follow the path: organisation, team, manager; a rate band colours the row.' },
      { id: 'issues', x: 276, y: 390, w: 218, h: 70, title: 'Open data issues', sub: 'severity high, medium, low', gate: true, steps: [5], text: 'A table of known gaps with an owner each, on the page, instead of a footnote nobody reads.' },
      { id: 'home', x: 552, y: 56, w: 194, h: 60, title: 'Completion vs goal', sub: 'rate and pace', steps: [2], text: 'Where the site stands against 85 percent, and how fast it is moving.' },
      { id: 'podium', x: 552, y: 132, w: 194, h: 70, title: 'Podium and standings', sub: 'rate or weighted toggle', steps: [3], text: 'A view toggle switches between completion rate and weighted contribution; the same standings table follows it.' },
      { id: 'race', x: 552, y: 218, w: 194, h: 60, title: 'Race timeline', sub: 'cumulative, top five', steps: [3], text: 'Cumulative completions over time for the five largest organisations by volume.' },
      { id: 'movers', x: 552, y: 294, w: 194, h: 60, title: 'Biggest movers', sub: 'arrows vs February', steps: [3], text: 'Who climbed and who slipped since the baseline, from the precomputed deltas.' },
      { id: 'detail', x: 552, y: 370, w: 194, h: 70, title: 'Drill pages', sub: 'organisation to manager', steps: [4], text: 'The same questions, one level down, with the breadcrumb keeping people oriented.' },
      { id: 'leaders', x: 804, y: 56, w: 106, h: 80, title: 'Site leaders', steps: [2, 3], text: 'Use it in leadership reviews to decide where to push.' },
      { id: 'managers', x: 804, y: 160, w: 106, h: 80, title: 'Managers', steps: [4], text: 'See their own team against the goal without asking for a report.' },
      { id: 'owner', x: 804, y: 264, w: 106, h: 90, title: 'Report owner', sub: 'publishes the model', steps: [1, 5], text: 'Owns the original report and the publishing; the rebuild was a partnership on the model.' },
      { id: 'sources', x: 804, y: 378, w: 106, h: 80, title: 'Source owners', steps: [5], text: 'Named on the open-issues table, so a gap has someone to ask.' }
    ],
    edges: [
      { from: 'courses', to: 'dedup', steps: [1] },
      { from: 'users', to: 'core', steps: [1, 2] },
      { from: 'dedup', to: 'core', steps: [2] },
      { from: 'core', to: 'rankings', steps: [3] },
      { from: 'baseline', to: 'rankings', steps: [3] },
      { from: 'rankings', to: 'drill', steps: [4] },
      { from: 'core', to: 'home', steps: [2] },
      { from: 'rankings', to: 'podium', steps: [3] },
      { from: 'rankings', to: 'race', steps: [3] },
      { from: 'rankings', to: 'movers', steps: [3] },
      { from: 'drill', to: 'detail', steps: [4] },
      { from: 'badges', to: 'issues', steps: [5] },
      { from: 'refreshlog', to: 'issues', steps: [5] },
      { from: 'home', to: 'leaders', steps: [2] },
      { from: 'podium', to: 'leaders', steps: [3] },
      { from: 'detail', to: 'managers', steps: [4] },
      { from: 'issues', to: 'sources', steps: [5] }
    ],
    steps: ['Load completions and people; count each exam once', 'Compute rate and pace against the 85 percent goal', 'Rank at refresh time; compare with the February baseline', 'Drill from organisation to manager with titles that follow', 'Declare the open data gaps with an owner each']
  },
  'planning-platform': {
    title: 'How the planning platform is put together', play: 'Play one cycle ▸', gates: 'Marked parts are the rules: a registry with one owner per source, four segments and row-level security, one spine for all three solutions, and audits on every rebuild.',
    caption: 'Simplified from the approved design. Hover or focus a part to read what it does; press a step to follow one planning cycle.',
    groups: [
      { id: 'src', x: 24, y: 24, w: 220, h: 478, label: 'Sources · 14 in the registry' },
      { id: 'gov', x: 270, y: 24, w: 200, h: 478, label: 'Governed layer', dashed: true },
      { id: 'sol', x: 496, y: 24, w: 240, h: 478, label: 'Three solutions, one spine' },
      { id: 'use', x: 762, y: 24, w: 164, h: 478, label: 'Planning leaders' }
    ],
    nodes: [
      { id: 'market', x: 40, y: 52, w: 188, h: 54, title: 'Market sizing cubes', sub: 'PC, print, services', steps: [1], text: 'Total addressable market by category, segment and country. 1.66 million rows across six categories.' },
      { id: 'share', x: 40, y: 118, w: 188, h: 48, title: 'Vendor share', sub: 'region level', steps: [1], text: 'Top vendors with quarter-on-quarter and year-on-year arrows. Country grain is a declared gap.' },
      { id: 'finance', x: 40, y: 178, w: 188, h: 54, title: 'Financial actuals and outlook', sub: 'authoritative product-line map', steps: [1, 3], text: 'The baseline the playbooks reconcile to, by product line and cluster.' },
      { id: 'gtm', x: 40, y: 244, w: 188, h: 48, title: 'Go-to-market baselines', steps: [1, 3], text: 'Units, revenue, supplies, services; the manual inputs each playbook used to copy by hand.' },
      { id: 'macro', x: 40, y: 304, w: 188, h: 54, title: 'Macro API', sub: 'public actuals and forecasts', steps: [1], text: 'GDP, FX and inflation for 38 countries; actual and forecast kept distinguishable on screen.' },
      { id: 'itspend', x: 40, y: 370, w: 188, h: 48, title: 'IT spend forecast', sub: '47 countries', steps: [1], text: 'Ribbon by technology group, per country.' },
      { id: 'orch', x: 40, y: 432, w: 188, h: 54, title: 'Orchestration (n8n)', sub: 'solution 3, fetch and draft', steps: [1], text: 'Scheduled extraction from the sources and auto-drafted reports once the governed layer is in place.' },
      { id: 'registry', x: 286, y: 60, w: 168, h: 70, title: 'Source registry', sub: 'one owner per source', gate: true, steps: [1], text: 'Fourteen rows, each signed off: which file, which owner, which tabs feed what. One source per number starts here.' },
      { id: 'rules', x: 286, y: 150, w: 168, h: 90, title: 'Rules', sub: 'four segments · RLS · one source', gate: true, steps: [2], text: 'Consumer, SMB, Enterprise, Public, mid-market rolled into Enterprise once; row-level security roles for admin, EMEA and global.' },
      { id: 'dataverse', x: 286, y: 262, w: 168, h: 80, title: 'Dataverse spine', sub: 'tables the three read from', gate: true, steps: [2, 4, 5], text: 'The middle tier the dashboard, the playbooks and the agent all read, so they cannot disagree. Gateway and service accounts, not personal credentials.' },
      { id: 'audits', x: 286, y: 364, w: 168, h: 90, title: 'Rebuild audits', sub: 'plugs, formulas, names', gate: true, steps: [3], text: 'Hard-coded plugs stripped, orphaned shared formulas and name residue caught, full recalculation forced on every rebuild.' },
      { id: 'pack', x: 512, y: 60, w: 208, h: 90, title: 'Power BI data pack', sub: '27 pages · 30 countries · 4 cycles', steps: [4], text: 'Market, money, motion: TAM, growth, competitive, macro, IT spend, financial baselines, six segment views, an EMEA hub with 19 cluster chips. Tested market by market with real planning leads.' },
      { id: 'playbooks', x: 512, y: 190, w: 208, h: 90, title: 'Playbook pipeline', sub: '19 clusters, regenerated per cycle', steps: [3], text: 'A recipe per cluster rebuilds the workbook from the registry and audits it. First cluster approved, three in validation, then the rest.' },
      { id: 'agent', x: 512, y: 320, w: 208, h: 90, title: 'Analyst agent', sub: '50 prompts · 9 live · 20 need a source', steps: [5], text: 'Grounded on the same spine; every answer cites its source view and cycle; it names the owner of the data it does not have.' },
      { id: 'challenge', x: 512, y: 430, w: 208, h: 50, title: 'Challenge layer', sub: 'weakest assumptions, downside case', steps: [5], text: 'Prompts that argue with the plan: assumptions versus evidence, challenge the narrative.' },
      { id: 'md', x: 778, y: 60, w: 132, h: 60, title: 'Managing directors', steps: [4, 5], text: 'Walk in before a review and get a sourced, challenge-aware answer.' },
      { id: 'cos', x: 778, y: 140, w: 132, h: 60, title: 'Chiefs of staff', steps: [4, 5], text: 'Self-serve views replace the requests that used to take hours per cycle.' },
      { id: 'planners', x: 778, y: 220, w: 132, h: 80, title: 'Planning teams', sub: 'EMEA owns the rules', steps: [3, 4], text: 'Business rules and reconciliation stay with the planning team; the pipeline reproduces them.' },
      { id: 'finance2', x: 778, y: 320, w: 132, h: 60, title: 'Finance partners', steps: [4], text: 'Baselines tie to the authoritative product-line map.' },
      { id: 'reviewer', x: 778, y: 400, w: 132, h: 80, title: 'Approval chain', sub: 'benefit at $80 per hour', steps: [2], text: 'Labor productivity, hard savings, 26,312 hours a year, revenue enhancement held out until evidence exists.' }
    ],
    edges: [
      { from: 'market', to: 'registry', steps: [1] },
      { from: 'share', to: 'registry', steps: [1] },
      { from: 'finance', to: 'registry', steps: [1] },
      { from: 'gtm', to: 'registry', steps: [1] },
      { from: 'macro', to: 'registry', steps: [1] },
      { from: 'itspend', to: 'registry', steps: [1] },
      { from: 'orch', to: 'registry', steps: [1] },
      { from: 'registry', to: 'rules', steps: [2] },
      { from: 'rules', to: 'dataverse', steps: [2] },
      { from: 'dataverse', to: 'audits', steps: [3] },
      { from: 'audits', to: 'playbooks', steps: [3] },
      { from: 'dataverse', to: 'pack', steps: [4] },
      { from: 'dataverse', to: 'agent', steps: [5] },
      { from: 'agent', to: 'challenge', steps: [5] },
      { from: 'pack', to: 'md', steps: [4] },
      { from: 'pack', to: 'cos', steps: [4] },
      { from: 'playbooks', to: 'planners', steps: [3] },
      { from: 'pack', to: 'finance2', steps: [4] },
      { from: 'agent', to: 'md', steps: [5], label: 'sourced answers' },
      { from: 'rules', to: 'reviewer', steps: [2] }
    ],
    steps: ['Register fourteen sources with one owner each', 'Set the rules and build the governed spine', 'Regenerate and audit the nineteen playbooks', 'Publish the data pack and test market by market', 'Ground the agent; answers cite source and cycle']
  }
});
function diagramMarkup(id, project = '') {
  const spec = diagrams[id];
  if (!spec) return '';
  const byId = Object.fromEntries(spec.nodes.map(node => [node.id, node]));
  const center = (node) => [node.x + node.w / 2, node.y + node.h / 2];
  const anchor = (a, b) => {
    // Leave the node border on the side that faces the other node.
    const [ax, ay] = center(a), [bx, by] = center(b);
    const dx = bx - ax, dy = by - ay;
    if (Math.abs(dx) * a.h > Math.abs(dy) * a.w) return [ax + Math.sign(dx) * a.w / 2, ay];
    return [ax, ay + Math.sign(dy) * a.h / 2];
  };
  const edges = spec.edges.map((edge, index) => {
    const a = byId[edge.from], b = byId[edge.to];
    const [x1, y1] = anchor(a, b), [x2, y2] = anchor(b, a);
    const midX = (x1 + x2) / 2;
    const d = Math.abs(y1 - y2) < 2 || Math.abs(x1 - x2) < 2 ? `M${x1},${y1} L${x2},${y2}` : `M${x1},${y1} L${midX},${y1} L${midX},${y2} L${x2},${y2}`;
    return `<path class="arch-edge" d="${d}" data-steps="${edge.steps.join(' ')}" data-edge="${index}" marker-end="url(#arch-arrow)"/>${edge.label ? `<text class="arch-edge-label" x="${(x1 + x2) / 2}" y="${Math.min(y1, y2) - 6}" text-anchor="middle">${escapeHTML(edge.label)}</text>` : ''}`;
  }).join('');
  const groups = spec.groups.map(group => `<g class="arch-group${group.dashed ? ' is-boundary' : ''}"><rect x="${group.x}" y="${group.y}" width="${group.w}" height="${group.h}" rx="10"/><text x="${group.x + 10}" y="${group.y + 16}">${escapeHTML(group.label)}</text></g>`).join('');
  const nodes = spec.nodes.map(node => `<g class="arch-node${node.gate ? ' is-gate' : ''}" data-node="${node.id}" data-steps="${node.steps.join(' ')}" tabindex="0" role="button" aria-label="${escapeHTML(node.title)}: ${escapeHTML(node.text)}"><rect x="${node.x}" y="${node.y}" width="${node.w}" height="${node.h}" rx="7"/><text x="${node.x + node.w / 2}" y="${node.y + (node.sub ? node.h / 2 - 3 : node.h / 2 + 4)}" text-anchor="middle" class="arch-title">${escapeHTML(node.title)}</text>${node.sub ? `<text x="${node.x + node.w / 2}" y="${node.y + node.h / 2 + 12}" text-anchor="middle" class="arch-sub">${escapeHTML(node.sub)}</text>` : ''}${node.gate ? `<circle class="arch-gate-mark" cx="${node.x + node.w - 9}" cy="${node.y + 9}" r="5"/>` : ''}</g>`).join('');
  const stepButtons = spec.steps.map((label, index) => `<li><button type="button" class="arch-step" data-arch-step="${index + 1}" aria-pressed="false"><span aria-hidden="true">0${index + 1}</span>${escapeHTML(label)}</button></li>`).join('');
  return `<figure class="arch-figure artifact-figure" data-diagram="${id}" data-artifact-project="${escapeHTML(project)}"><figcaption><strong>${escapeHTML(spec.title)}</strong><span>${escapeHTML(spec.caption)}</span></figcaption><div class="arch-controls"><button type="button" class="pill-button" data-arch-play>${escapeHTML(spec.play || 'Play ▸')}</button><button type="button" class="pill-button" data-arch-gates aria-pressed="false">Show governance gates</button></div><div class="arch-scroll"><svg class="arch-svg" viewBox="0 0 950 528" role="img" aria-label="Architecture diagram: ${escapeHTML(spec.title)}"><defs><marker id="arch-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z"/></marker></defs>${groups}${edges}${nodes}</svg></div><p class="arch-readout" aria-live="polite">Hover or focus any part of the diagram.</p><ol class="arch-steps">${stepButtons}</ol></figure>`;
}
function mountDiagrams(scrollRoot) {
  document.querySelectorAll('.arch-figure').forEach(figure => {
    if (figure.dataset.live) return;
    figure.dataset.live = 'true';
    const spec = diagrams[figure.dataset.diagram];
    const within = (selector) => figure.querySelectorAll ? [...figure.querySelectorAll(selector)] : [...document.querySelectorAll(selector)];
    const readout = within('.arch-readout')[0];
    const nodes = within('.arch-node');
    const parts = within('[data-steps]');
    const buttons = within('[data-arch-step]');
    let playTimer = 0;
    const describe = (node) => { const item = spec.nodes.find(entry => entry.id === node.dataset.node); if (item && readout) readout.textContent = `${item.title}: ${item.text}`; };
    const setStep = (step) => {
      figure.dataset.step = step ? String(step) : '';
      parts.forEach(part => part.classList.toggle('is-active', !!step && part.dataset.steps.split(' ').includes(String(step))));
      buttons.forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.archStep) === step)));
      if (step && readout) readout.textContent = `Step 0${step}: ${spec.steps[step - 1]}.`;
    };
    const play = () => {
      if (typeof clearInterval === 'function') clearInterval(playTimer);
      if (reducedMotion.matches || typeof setInterval === 'undefined') { setStep(spec.steps.length); return; }
      let step = 0;
      setStep(++step);
      playTimer = setInterval(() => { if (!figure.isConnected) { clearInterval(playTimer); return; } if (step >= spec.steps.length) { clearInterval(playTimer); return; } setStep(++step); }, 1300);
    };
    nodes.forEach(node => {
      node.addEventListener('mouseenter', () => describe(node));
      node.addEventListener('focus', () => describe(node));
      node.addEventListener('click', () => { describe(node); nodes.forEach(other => other.classList.toggle('is-selected', other === node)); });
      node.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); node.click(); } });
    });
    buttons.forEach(button => button.addEventListener('click', () => { if (typeof clearInterval === 'function') clearInterval(playTimer); setStep(Number(button.dataset.archStep)); }));
    within('[data-arch-play]')[0]?.addEventListener('click', play);
    within('[data-arch-gates]')[0]?.addEventListener('click', (event) => {
      const on = figure.classList.toggle('show-gates');
      event.currentTarget.setAttribute('aria-pressed', String(on));
      if (readout) readout.textContent = on ? (spec.gates || 'Marked parts are the controls.') : 'Hover or focus any part of the diagram.';
    });
    if (typeof IntersectionObserver !== 'undefined' && !reducedMotion.matches) {
      const observer = new IntersectionObserver((entries) => { if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); play(); } }, { root: scrollRoot || null, threshold: .3 });
      observer.observe(figure);
    } else setStep(spec.steps.length);
  });
}

// Interactive widgets per case study. Dummy data where marked; original code.
const adaptiveCardScenarios = Object.freeze({
  behind: { question: 'Which markets are behind plan?', title: 'Markets behind plan · FY27 cycle 2', insight: 'Three of twelve markets trail the plan by more than 5 points; two of them share the same segment gap.', kind: 'bars', data: [['Market A', -8.2], ['Market B', -6.1], ['Market C', -5.4], ['Market D', -1.9], ['Market E', 2.3]], unit: 'pts vs plan', source: 'Governed view · market sizing cube · cycle 2' },
  changed: { question: 'What changed since last month?', title: 'Changes since the last refresh', insight: 'The macro forecast moved more than any market input; segment mix was stable.', kind: 'deltas', data: [['Macro forecast, FX', '+3.1%'], ['Market size, PC consumer', '-0.8%'], ['Vendor share, top 4', '+0.2 pts'], ['IT spend, services', '+1.4%'], ['Financial baseline', 'no change']], source: 'Governed view · refresh log · two cycles compared' },
  upside: { question: 'Where is the upside?', title: 'Upside against the current plan', insight: 'Growth concentrates in two segments; the plan assumes the historical mix, which is the weakest assumption in it.', kind: 'line', data: [['CY24', 100], ['CY25', 104], ['CY26', 109], ['CY27', 117], ['CY28', 126], ['CY29', 134]], unit: 'index, CY24 = 100', source: 'Governed view · growth CAGR by segment · plan years' }
});
function adaptiveCardChart(scenario) {
  const w = 320, h = 120;
  if (scenario.kind === 'bars') {
    const max = Math.max(...scenario.data.map(([, v]) => Math.abs(v)));
    const rowH = h / scenario.data.length;
    return `<svg viewBox="0 0 ${w} ${h}" class="ac-chart" role="img" aria-label="Bar chart, ${escapeHTML(scenario.unit)}">${scenario.data.map(([label, v], i) => { const y = i * rowH + 4, len = Math.abs(v) / max * 150, x = v < 0 ? 170 - len : 170; return `<text x="4" y="${y + rowH / 2 + 2}" class="ac-label">${escapeHTML(label)}</text><rect x="${x}" y="${y}" width="${len}" height="${rowH - 8}" rx="3" class="${v < 0 ? 'ac-neg' : 'ac-pos'}"/><text x="${v < 0 ? x - 4 : x + len + 4}" y="${y + rowH / 2 + 2}" class="ac-value" text-anchor="${v < 0 ? 'end' : 'start'}">${v > 0 ? '+' : ''}${v}</text>`; }).join('')}<line x1="170" y1="0" x2="170" y2="${h}" class="ac-axis"/></svg>`;
  }
  if (scenario.kind === 'deltas') return `<ul class="ac-deltas">${scenario.data.map(([label, v]) => `<li><span>${escapeHTML(label)}</span><strong class="${v.startsWith('-') ? 'is-neg' : v.startsWith('+') ? 'is-pos' : ''}">${escapeHTML(v)}</strong></li>`).join('')}</ul>`;
  const min = Math.min(...scenario.data.map(([, v]) => v)), max = Math.max(...scenario.data.map(([, v]) => v));
  const pts = scenario.data.map(([, v], i) => [20 + i * (w - 40) / (scenario.data.length - 1), h - 16 - (v - min) / (max - min || 1) * (h - 36)]);
  return `<svg viewBox="0 0 ${w} ${h}" class="ac-chart" role="img" aria-label="Line chart, ${escapeHTML(scenario.unit)}"><polyline points="${pts.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ')}" class="ac-line"/>${pts.map(([x, y], i) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" class="ac-dot"/><text x="${x.toFixed(1)}" y="${h - 2}" text-anchor="middle" class="ac-label">${escapeHTML(scenario.data[i][0])}</text>`).join('')}</svg>`;
}
function adaptiveCardMarkup(key) {
  const scenario = adaptiveCardScenarios[key];
  return `<div class="ac-card" data-scenario="${key}"><p class="ac-eyebrow">Planning assistant · adaptive card</p><h4>${escapeHTML(scenario.title)}</h4><p class="ac-insight">${escapeHTML(scenario.insight)}</p>${adaptiveCardChart(scenario)}<p class="ac-source">${escapeHTML(scenario.source)}${scenario.unit ? ` · ${escapeHTML(scenario.unit)}` : ''}</p><div class="ac-actions"><span>Open in the data pack</span><span>Draft a note</span></div></div>`;
}
const widgetMarkup = {
  'adaptive-card': () => `<figure class="widget widget-adaptive" data-widget="adaptive-card"><figcaption><strong>Ask the planning assistant</strong><span>Illustrative, dummy data. Each question re-renders the card the way the agent answers inside the chat, chart included.</span></figcaption><div class="ac-questions" role="group" aria-label="Sample questions">${Object.entries(adaptiveCardScenarios).map(([key, s], i) => `<button type="button" class="pill-button" data-ac-question="${key}" aria-pressed="${i === 0}">${escapeHTML(s.question)}</button>`).join('')}</div><div class="ac-stage" aria-live="polite">${adaptiveCardMarkup('behind')}</div></figure>`,
  coverage: () => { const rows = [['Live now', 9, 'answered from governed data in release one'], ['Partial', 8, 'answered with the missing input named'], ['Planned', 13, 'source exists, build queued'], ['Needs a new source', 20, 'the agent names the data and its owner']]; return `<figure class="widget widget-coverage" data-widget="coverage"><figcaption><strong>Fifty planning prompts, classified before the build</strong><span>What release one promises, and what it says it cannot do yet.</span></figcaption><ol class="coverage-rows">${rows.map(([label, n, note]) => `<li><span class="coverage-label">${label}</span><span class="coverage-bar"><i style="width:${(n / 50 * 100).toFixed(1)}%"></i></span><strong data-count="${n}">${n}</strong><small>${note}</small></li>`).join('')}</ol></figure>`; },
  benefit: () => `<figure class="widget widget-benefit" data-widget="benefit"><figcaption><strong>How the benefit case moves</strong><span>The approved case uses 30 countries, 4 cycles and 19 playbooks at $80 per hour. Drag to see what the assumptions do to it.</span></figcaption><div class="benefit-controls"><label>Countries per cycle <output id="benefit-countries-out">30</output><input type="range" id="benefit-countries" min="10" max="40" step="1" value="30"></label><label>Cycles per year <output id="benefit-cycles-out">4</output><input type="range" id="benefit-cycles" min="1" max="4" step="1" value="4"></label><label>Playbooks regenerated <output id="benefit-playbooks-out">19</output><input type="range" id="benefit-playbooks" min="0" max="19" step="1" value="19"></label></div><div class="benefit-readout"><div><strong id="benefit-hours">26,312</strong><span>hours a year</span></div><div><strong id="benefit-value">$2.1M</strong><span>at $80 per hour</span></div></div><p class="panel-footnote">Global solutions: 6,400 hours at the approved assumptions (30 countries, 4 cycles). Playbooks: 1,048 hours each per year across the cycles. Approved benefit value, not a realised figure.</p></figure>`,
  footprint: () => { const tiles = [['$1.6M', 'Cost savings approved, squad, this FY', { count: 1.6, prefix: '$', suffix: 'M', decimals: 1 }], ['$14M', 'Productivity value, squad, this FY', { count: 14, prefix: '$', suffix: 'M' }], ['33', 'Projects from the site, 17% of the org', { count: 33 }], ['55+', 'Builders and submitters on the platform', { count: 55, suffix: '+' }], ['11', 'AI projects in flight from the site', { count: 11 }], ['40', 'Ideas in the squad funnel', { count: 40 }]]; return `<figure class="widget widget-footprint" data-widget="footprint"><figcaption><strong>The site footprint behind the dashboard</strong><span>Approved benefit values on the internal idea platform, October 2026. Not finance-booked.</span></figcaption><div class="case-metrics footprint-grid">${tiles.map(([value, label, roll]) => `<div class="case-metric"><strong${countAttributes(roll)}>${value}</strong><span>${label}</span></div>`).join('')}</div></figure>`; }
};
function widgetsMarkup(list = []) { return list.map(key => widgetMarkup[key] ? widgetMarkup[key]() : '').join(''); }
function mountWidgets() {
  document.querySelectorAll('.widget').forEach(widget => {
    if (widget.dataset.live) return;
    widget.dataset.live = 'true';
    const within = (selector) => widget.querySelectorAll ? [...widget.querySelectorAll(selector)] : [...document.querySelectorAll(selector)];
    if (widget.dataset.widget === 'adaptive-card') {
      const stage = within('.ac-stage')[0];
      within('[data-ac-question]').forEach(button => button.addEventListener('click', () => {
        within('[data-ac-question]').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
        if (stage) { stage.innerHTML = adaptiveCardMarkup(button.dataset.acQuestion); stage.classList.remove('is-fresh'); requestAnimationFrame(() => stage.classList.add('is-fresh')); }
      }));
    }
    if (widget.dataset.widget === 'benefit') {
      const read = (id) => Number($(`#${id}`)?.value) || 0;
      const update = () => {
        const countries = read('benefit-countries'), cycles = read('benefit-cycles'), playbooks = read('benefit-playbooks');
        const globalHours = 6400 * (countries / 30) * (cycles / 4), playbookHours = 1048 * playbooks * (cycles / 4);
        const hours = Math.round(globalHours + playbookHours), value = hours * 80;
        const set = (id, text) => { const el = $(`#${id}`); if (el) el.textContent = text; };
        set('benefit-countries-out', String(countries)); set('benefit-cycles-out', String(cycles)); set('benefit-playbooks-out', String(playbooks));
        set('benefit-hours', hours.toLocaleString('en-US')); set('benefit-value', value >= 1e6 ? `$${(value / 1e6).toFixed(1)}M` : `$${Math.round(value / 1e3)}K`);
      };
      ['benefit-countries', 'benefit-cycles', 'benefit-playbooks'].forEach(id => $(`#${id}`)?.addEventListener('input', update));
      update();
    }
  });
}

function mountShowcase(scrollRoot) {
  mountWordSwaps();
  mountWidgets();
  mountCounters(scrollRoot);
  mountDiagrams(scrollRoot);
}

const filterOptions = [['all', 'All projects'], ['ai', 'AI'], ['automation', 'Automation'], ['data', 'Data']];
const escapeHTML = (value) => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

function shortlistMarkup() {
  return `<div class="shortlist-heading"><div><p class="case-eyebrow">Your project shortlist</p><h3>Find the work that fits.</h3></div><span class="shortlist-count" data-shortlist-count>${shortlist.length} / 3 saved</span></div><p class="panel-description">Save up to three projects to compare their scope, my contribution, and the evidence behind the outcomes.</p><div class="shortlist-chips">${shortlist.length ? shortlist.map(id => `<span class="shortlist-chip">${projects[id].short}<button type="button" data-save-project="${id}" aria-label="Remove ${projects[id].title} from shortlist">×</button></span>`).join('') : '<span class="shortlist-empty">Use “Save project” on any card to start.</span>'}</div><div class="shortlist-actions"><button type="button" class="primary-button" id="compare-projects" ${shortlist.length < 2 ? 'disabled' : ''}>Compare selected <span aria-hidden="true">↗</span></button><button type="button" class="pill-button" id="download-shortlist" ${!shortlist.length ? 'disabled' : ''}>Download brief .txt</button></div>`;
}

function renderWork() {
  return `<div class="work-heading"><p class="case-eyebrow">Six projects. One way of working.</p><h2 id="panel-title">From a useful idea<br><em>to something people use.</em></h2><p class="panel-description">Explore my work in product, AI, automation, and data. Open a case study for the problem, my contribution, the delivery approach, and the outcome.</p></div><div class="project-tools"><label class="project-search" for="project-search"><span>Find a project</span><input type="search" id="project-search" placeholder="Try governance, dashboards, teaching…" value="${escapeHTML(workQuery)}" autocomplete="off"></label><div class="project-filters" role="group" aria-label="Filter projects by focus">${filterOptions.map(([id, label]) => `<button type="button" class="pill-button" data-project-filter="${id}" aria-pressed="${workFilter === id}">${label}</button>`).join('')}</div><div class="project-results-row"><p id="project-results-count" class="project-results" role="status">6 projects</p><button type="button" class="back-button" id="reset-project-filters">Clear search & filters</button></div></div><div class="project-card-grid">${Object.entries(projects).map(([id, p]) => `<article class="project-card" data-project-card="${id}"><div class="project-card-heading"><span class="project-icon" aria-hidden="true">${p.icon}</span><span class="case-eyebrow">${p.number} / ${caseDetails[id].scope}</span></div><button type="button" class="project-item" data-project="${id}"><span class="project-name">${p.title}<small>${p.category}</small></span><span class="project-arrow" aria-hidden="true">↗</span></button><p>${p.intro}</p><div class="project-card-evidence"><strong>${p.facts[0][0]}</strong><span>${p.facts[0][1]}</span></div><div class="project-card-footer"><span class="project-status">${caseDetails[id].status}</span><button type="button" class="save-project" data-save-project="${id}" aria-pressed="${shortlist.includes(id)}">${shortlist.includes(id) ? 'Saved ✓' : 'Save project +'}</button></div></article>`).join('')}</div><section id="shortlist-tray" class="shortlist-tray" aria-label="Saved project shortlist">${shortlistMarkup()}</section><p class="panel-footnote">Professional work, summarized from my CV and recent recognition. Outcomes are labeled with their source and scope in each case study.</p><div class="demo-pills"><button class="pill-button" data-project="notes">Field notes ↗</button><button class="pill-button" data-project="radio">Lake radio ↗</button></div>`;
}

function applyWorkFilters() {
  let count = 0;
  for (const card of document.querySelectorAll('[data-project-card]')) {
    const id = card.dataset.projectCard, p = projects[id], detail = caseDetails[id];
    const text = [p.title, p.category, p.intro, p.story, p.role, ...p.skills, detail.scope, detail.problem].join(' ').toLowerCase();
    const visible = (workFilter === 'all' || detail.filter.includes(workFilter)) && (!workQuery.trim() || text.includes(workQuery.trim().toLowerCase()));
    card.hidden = !visible;
    if (visible) count++;
  }
  const result = $('#project-results-count');
  if (result) result.textContent = count ? `${count} ${count === 1 ? 'project' : 'projects'}${workFilter !== 'all' ? ` · ${filterOptions.find(([id]) => id === workFilter)[1]}` : ''}` : 'No projects match. Try another term or choose All projects.';
  document.querySelectorAll('[data-project-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.projectFilter === workFilter)));
}

function syncShortlist() {
  const persisted = storage.set('shortlist', JSON.stringify(shortlist));
  document.querySelectorAll('[data-save-project]').forEach(button => {
    const saved = shortlist.includes(button.dataset.saveProject);
    if (button.getAttribute('aria-pressed') !== null && !button.getAttribute('aria-label')) { button.setAttribute('aria-pressed', String(saved)); button.textContent = saved ? 'Saved ✓' : 'Save project +'; }
  });
  const tray = $('#shortlist-tray');
  if (tray) tray.innerHTML = shortlistMarkup();
  return persisted;
}

function toggleShortlist(id) {
  if (!projects[id]) return;
  const index = shortlist.indexOf(id);
  if (index >= 0) { shortlist.splice(index, 1); toast(`${projects[id].short} removed from your shortlist.`); }
  else if (shortlist.length < 3) { shortlist.push(id); toast(`${projects[id].short} saved. ${shortlist.length} of 3 projects selected.`); }
  else { toast('Your shortlist holds three projects. Remove one to make room.'); return; }
  const persisted = syncShortlist();
  if (!persisted) toast('Your shortlist is ready for this visit. Download a brief to keep it.');
  if (state.panel === 'compare') { panelBody.innerHTML = renderComparison(); $('#close-panel').focus(); }
}

function renderComparison() {
  return `<div class="case-topline"><button type="button" class="back-button" data-back>← All projects</button><button type="button" class="pill-button" id="download-shortlist" ${!shortlist.length ? 'disabled' : ''}>Download selected brief .txt</button></div><h2 id="panel-title">A closer look<br><em>at the work that fits.</em></h2><p class="panel-description">Compare the scope, contribution, and evidence side by side. The figures below keep the same qualifications as the individual case studies.</p>${shortlist.length ? `<div class="comparison-grid">${shortlist.map(id => { const p = projects[id], d = caseDetails[id]; return `<article class="comparison-card"><p class="case-eyebrow">${p.number} / ${p.category}</p><h3>${p.title}</h3><div class="comparison-row"><h4>Scope</h4><p>${d.scope}</p></div><div class="comparison-row"><h4>My contribution</h4><p>${p.role}</p></div><div class="comparison-row"><h4>Outcome / evidence</h4><p>${p.outcome}</p><p class="evidence-note">${d.boundary}</p></div><div class="comparison-row"><h4>Strengths</h4><div class="skill-tags">${p.skills.map(skill => `<span>${skill}</span>`).join('')}</div></div><div class="demo-pills"><button type="button" class="primary-button" data-project="${id}">Open case study ↗</button><button type="button" class="save-project" data-save-project="${id}" aria-label="Remove ${p.title} from shortlist">Remove</button></div></article>`; }).join('')}</div>` : '<p class="project-outcome">Your shortlist is empty. Return to the projects and save the work you want to compare.</p>'}`;
}

function projectBrief(id) {
  const p = projects[id], d = caseDetails[id];
  return `${p.title}\n${p.category}\n\n${p.intro}\n\nSCOPE\n${d.scope}\nStatus: ${d.status}\n\nTHE PROBLEM\n${d.problem}\n\nMY CONTRIBUTION\n${d.contributions.map(item => `• ${item}`).join('\n')}\n\nDELIVERY APPROACH\n${d.steps.map(([title, text], index) => `${index + 1}. ${title}: ${text}`).join('\n')}\n\nOUTCOME\n${p.outcome}\n${p.facts.map(([value, label]) => `${value} — ${label}`).join('\n')}\n\nEVIDENCE & SCOPE\n${d.boundary}\nSource: ${p.source}\n\nAlexis Martinez · Product Owner / Product Manager\nblueavocato@gmail.com\nhttps://www.linkedin.com/in/alexis-martinez-g\n`;
}

function downloadText(text, filename) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function projectLink(id) {
  const href = String(window.location?.href || '');
  return /^https?:\/\//i.test(href) ? `${href.split('#')[0]}#work/${id}` : `#work/${id}`;
}

async function copyProjectLink(id) {
  const link = projectLink(id);
  try {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(link);
    toast(link.startsWith('#') ? 'Project anchor copied for this HTML file.' : 'Project link copied.');
  } catch {
    const fallback = $('#project-link-fallback'), field = $('#project-link-field');
    if (fallback) fallback.hidden = false;
    if (field) { field.value = link; field.focus(); field.select?.(); }
    toast(link.startsWith('#') ? 'Copy the selected project anchor. It opens this project in this HTML file.' : 'Copy the selected project link.');
  }
}

async function copyBrief(id) {
  try {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(projectBrief(id));
    toast('Project brief copied, including its source and outcome qualifications.');
  } catch { downloadText(projectBrief(id), `alexis-${id}-brief.txt`); toast('A text brief was downloaded. Clipboard access is unavailable here.'); }
}

const templates = {
  work: renderWork,
  compare: renderComparison,
  about: () => `<h2 id="panel-title">Hi, I'm Alexis.<br><em>I connect the dots.</em></h2>
    <p class="panel-description">A Product Owner and Product Manager based in Guadalajara, Mexico. I turn stakeholder needs into clear priorities, usable products, and automation that helps people do better work.</p>
    <div class="fact-grid"><div class="fact-card"><strong>115+</strong><span>Solutions delivered across the portfolio in my 2023–25 role</span></div><div class="fact-card"><strong>EN / ES</strong><span>Bilingual · open to relocation</span></div></div>
    <p class="panel-description">My work spans product vision and backlogs, user stories and acceptance criteria, Agile delivery, executive KPIs, and AI and automation. I work with engineers and specialists to define the what and why, then give the team room to shape the how.</p>
    <div class="career-timeline"><h3>The journey</h3><p><strong>Nov 2025–present · HP</strong><br>AI & Automation Product Owner · Commercial Organization, Americas</p><p><strong>Nov 2023–Nov 2025 · HP</strong><br>Product Owner / Automation Expert</p><p><strong>Apr 2021–Oct 2023 · HP</strong><br>Partner & Data Reporting Advisor</p><p><strong>Nov 2017–Apr 2021 · HP</strong><br>Account Operations Specialist</p><p><strong>Earlier</strong><br>HPE · Payroll Analyst / Tax Specialist, 2016–17<br>TTEC · Operations Team Lead, 2014–16</p></div>
    <h3>Engineering roots. A data mindset.</h3><p class="panel-description">M.S. Data Science (2022–2024) and B.S. Computer Systems Engineering (2018–2021), Utel Universidad.</p>
    <div class="skill-tags"><span>Product strategy</span><span>Agile / Scrum</span><span>SQL</span><span>Python</span><span>Power Platform</span><span>RPA</span><span>AI delivery</span></div>
    <p class="panel-description">Recent work also includes leadership dashboards, innovation coaching, and exploration of Command Center and Mission Control. I enjoy making complex systems feel approachable—this town is one expression of that.</p>
    <div class="demo-pills"><a class="pill-button" href="mailto:blueavocato@gmail.com">Say hello ↗</a><a class="pill-button" href="https://www.linkedin.com/in/alexis-martinez-g" target="_blank" rel="noopener noreferrer">LinkedIn ↗</a></div>
    <p class="panel-footnote">Career details from my CV, complemented by recent working context.</p>`,
  axo: () => `<h2 id="panel-title">Small robot.<br><em>Big curiosity.</em></h2>
    <p class="panel-description">Meet AXO: a robot axolotl exploring a lake city among the stars. Each workshop holds a chapter of my work.</p>
    <p class="panel-description">AXO walks in profile along the stone causeway while your scroll turns the lake city beneath him. At a project stop, he glances toward the building, then turns back to you with a smile and a new symbol on his chest. Scroll back up to retrace the journey, or choose a building to go straight to its chapter.</p>
    <button type="button" class="primary-button" id="wave-button">Give AXO a wave <span aria-hidden="true">↗</span></button>
    <p class="panel-footnote">Drag to orbit. The arrow buttons rotate the town. Scroll to guide AXO. The motion control pauses ambient animation; your scroll still sets the destination.</p>`,
  flora: () => `<p class="case-eyebrow">The lake-city field guide</p><h2 id="panel-title">Rooted in Mexico.</h2>
    <p class="panel-description">Five species endemic to Mexico give the gardens their own silhouettes, from delicate rays to sculptural orchid lips. Their colors are interpreted in this world’s pink, lilac, and amethyst palette.</p>
    <div class="flora-grid">
      <article class="flora-card"><span class="flora-number">01 / On the chinampas</span><h3><a href="https://efloramex.inecol.mx/cdm_dataportal/taxon/1f8b45cd-fe62-4b6b-99e8-2687c57b67d6" target="_blank" rel="noopener noreferrer"><em>Dahlia scapigera</em> ↗</a></h3><p class="flora-common">Wild dahlia</p><p>Seven to nine elongated rays give these open flowers their light, star-shaped outline.</p><small class="flora-range">Mexico · including the central highlands and Jalisco</small></article>
      <article class="flora-card"><span class="flora-number">02 / On the chinampas</span><h3><a href="https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:66736-2" target="_blank" rel="noopener noreferrer"><em>Cosmos atrosanguineus</em> ↗</a></h3><p class="flora-common">Chocolate cosmos</p><p>Eight dark rays frame a small center, creating a deeper, velvety note among the lighter blooms.</p><small class="flora-range">Mexico · San Luis Potosí to Hidalgo</small></article>
      <article class="flora-card"><span class="flora-number">03 / On the chinampas</span><h3><a href="https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:999530-1" target="_blank" rel="noopener noreferrer"><em>Tigridia vanhouttei</em> ↗</a></h3><p class="flora-common">Tiger flower</p><p>Three broad outer tepals surround a spotted cup, making this flower easy to distinguish from the many-rayed blooms.</p><small class="flora-range">Northeastern and central Mexico</small></article>
      <article class="flora-card"><span class="flora-number">04 / On a small branch</span><h3><a href="https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:134723-2" target="_blank" rel="noopener noreferrer"><em>Laelia speciosa</em> ↗</a></h3><p class="flora-common">Flor de mayo</p><p>A distinct orchid lip and spreading petals sit on a small branch mount, echoing this Mexican orchid’s epiphytic habit.</p><small class="flora-range">Mexico · a tree-dwelling orchid</small></article>
      <article class="flora-card"><span class="flora-number">05 / On the water</span><h3><a href="https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:171186-2" target="_blank" rel="noopener noreferrer"><em>Nymphaea gracilis</em> ↗</a></h3><p class="flora-common">Water lily</p><p>Layered, pointed petals rise above floating pads, bringing a different flower shape to the canals.</p><small class="flora-range">Mexico · Durango to México State and Oaxaca</small></article>
    </div><p class="panel-footnote">Scientific names link to botanical references from INECOL and Kew’s Plants of the World Online.</p>`,
  credits: () => `<h2 id="panel-title">Lake-city roots.<br><em>Cosmic possibilities.</em></h2>
    <p class="panel-description">An original speculative world inspired by Tenochtitlan: canals, chinampas, causeways, and stepped architecture, floating beneath pink stellar clouds.</p>
    <ul class="credits-list"><li>Original procedural 3D town and robot axolotl.</li><li>Explorable-world inspiration: <a href="https://www.joshuas.world/" target="_blank" rel="noopener noreferrer">Joshua's World ↗</a></li><li>Portfolio inspiration: <a href="https://www.yan-holtz.com/" target="_blank" rel="noopener noreferrer">Yan Holtz ↗</a></li><li>Project summaries: Alexis's CV and FY26 recognition review.</li></ul>
    <p class="panel-footnote">An artistic interpretation of a lake city. Optional sound, reduced-motion support, and an illustrated fallback. No analytics or tracking.</p>`,
};

function showPanel(name, focusOrigin = document.activeElement) {
  if (!templates[name]) return;
  if (!panel.open) state.lastFocus = focusOrigin;
  openModalRoute(name === 'work' ? '#work' : `#${name}`);
  state.panel = name;
  state.activeProject = '';
  $('#panel-category').textContent = { work: 'Project field guide', compare: 'Your selected projects', about: 'Meet Alexis', axo: 'Meet AXO', credits: 'A little context', flora: 'Mexico’s endemic flowers' }[name];
  panelBody.innerHTML = templates[name]();
  if (name === 'work') {
    applyWorkFilters();
    $('#project-search')?.addEventListener('input', event => { workQuery = event.target.value; applyWorkFilters(); });
  }
  panel.scrollTop = 0;
  if (!panel.open) {
    panel.showModal();
    document.body.style.overflow = 'hidden';
  }
  syncReading();
  rememberRouteSnapshot();
  // Keep the town orientation stable while reading a project or profile.
  $('#close-panel').focus();
}

function closePanel({ syncRoute = true } = {}) {
  if (panel.open) {
    if (!syncRoute) suppressedCloseEvents++;
    panel.close();
  }
}

function visitProject(name, focusOrigin = document.activeElement) {
  if (!Object.hasOwn(projects, name)) return;
  if (!panel.open) state.lastFocus = focusOrigin;
  openModalRoute(`#work/${name}`);
  state.activeProject = name;
  state.panel = 'project';
  showProject(name);
  if (!panel.open) {
    panel.showModal();
    document.body.style.overflow = 'hidden';
  }
  syncReading();
  rememberRouteSnapshot();
  $('#close-panel').focus();
}

function syncRoaming() {
  const label = $('#tour-label');
  if (label) label.textContent = `Scroll to explore · ${Math.round(state.scrollProgress * 100)}%`;
}

const projectOrder = Object.keys(projects);
let scrollAnchors = [];
let scanLength = 0;

function parseRoute(hash = window.location?.hash || '#home') {
  const value = String(hash || '#home').replace(/^#/, '');
  const parts = value.split('/');
  if ((parts[0] === 'place' || parts[0] === 'work') && parts.length === 2 && Object.hasOwn(projects, parts[1])) return { kind: parts[0], id: parts[1], hash: `#${parts[0]}/${parts[1]}` };
  if (value === 'work') return { kind: 'panel', id: 'work', hash: '#work' };
  if (['about', 'axo', 'credits', 'compare', 'radio', 'garden', 'notes', 'flora'].includes(value)) return { kind: 'panel', id: value, hash: `#${value}` };
  if (Object.hasOwn(projects, value)) return { kind: 'place', id: value, hash: `#place/${value}` };
  return { kind: 'home', hash: '#home' };
}

function rawRouteEntry() {
  try { const entry = window.history?.state?.axo; return entry && typeof entry === 'object' ? entry : null; }
  catch { return null; }
}

function routeEntry() {
  const entry = rawRouteEntry();
  return entry?.key ? routeSnapshots.get(entry.key) || entry : entry;
}

function cancelSnapshotPersistence() {
  clearTimeout(routeSnapshotTimer);
  routeSnapshotTimer = undefined;
  pendingSnapshotKey = '';
}

function flushSnapshotPersistence() {
  const key = pendingSnapshotKey;
  cancelSnapshotPersistence();
  // Traversal may already have changed the current entry. Its cached snapshot
  // remains available for Forward, but its timer must never overwrite this one.
  if (!key || rawRouteEntry()?.key !== key) return;
  const entry = routeSnapshots.get(key);
  if (!entry || typeof window.history?.replaceState !== 'function') return;
  try {
    window.history.replaceState({ axo: entry }, '', entry.hash);
    lastSnapshotSerialization = performance.now();
  } catch { /* Cache restoration still works in restrictive document viewers. */ }
}

function cacheRouteSnapshot(hash = state.route.hash) {
  if (!routeReady || routeApplying) return;
  const previous = routeEntry();
  if (!previous?.key) return;
  const route = parseRoute(hash);
  state.route = route;
  const entry = { ...previous, hash: route.hash, snapshot: captureJourneySnapshot() };
  routeSnapshots.set(entry.key, entry);
  pendingSnapshotKey = entry.key;
  clearTimeout(routeSnapshotTimer);
  // Wait for a short pause, and cap background serialization at one per second.
  // Exact restoration uses the cache immediately rather than waiting for this.
  const delay = Math.max(250, 1000 - (performance.now() - lastSnapshotSerialization));
  const key = entry.key;
  routeSnapshotTimer = setTimeout(() => { if (pendingSnapshotKey === key) flushSnapshotPersistence(); }, delay);
  lastRouteToken = `${route.hash}|${entry.key}`;
}

function captureJourneySnapshot() {
  return { scrollY: Number(window.scrollY) || 0, progress: state.scrollProgress, currentStop: state.currentStop, chapter: state.chapter,
    journey: state.world?.getScrollState?.() ?? null, character: state.world?.getCharacterState?.() ?? null,
    focusId: (!panel.open ? document.activeElement?.id : state.lastFocus?.id) || '', panelScrollTop: Number(panel.scrollTop) || 0 };
}

function writeRoute(hash, { replace = false, snapshot = captureJourneySnapshot(), metadata = {} } = {}) {
  flushSnapshotPersistence();
  const route = parseRoute(hash);
  state.route = route;
  const entry = { session: routeSession, key: `${routeSession}-${++routeSequence}`, hash: route.hash, snapshot, ...metadata };
  routeSnapshots.set(entry.key, entry);
  try {
    const method = replace ? 'replaceState' : 'pushState';
    if (typeof window.history?.[method] === 'function') window.history[method]({ axo: entry }, '', route.hash);
  } catch { /* The in-page experience still works in restrictive file viewers. */ }
  lastRouteToken = `${route.hash}|${entry.key}`;
  return entry;
}

function rememberRouteSnapshot() { cacheRouteSnapshot(); }

function openModalRoute(hash) {
  clearPreview();
  if (!routeReady || routeApplying) return;
  if (panel.open && state.route.hash === hash) { rememberRouteSnapshot(); return; }
  const previous = routeEntry();
  if (!panel.open) {
    const baseHash = state.route.kind === 'place' || state.route.kind === 'home' ? state.route.hash : (state.currentStop ? `#place/${state.currentStop}` : '#home');
    modalReturn = { hash: baseHash, snapshot: captureJourneySnapshot() };
  }
  rememberRouteSnapshot();
  writeRoute(hash, { metadata: { returnHash: modalReturn?.hash || '#home', returnSnapshot: modalReturn?.snapshot || captureJourneySnapshot(), dialogDepth: panel.open && previous?.session === routeSession ? (previous.dialogDepth || 0) + 1 : 1 } });
}

function restoreJourneySnapshot(snapshot) {
  if (!snapshot) return;
  routeWriteSuppressed++;
  try {
    window.scrollTo?.({ top: Math.max(0, Number(snapshot.scrollY) || 0), behavior: 'instant' });
    updateScrollJourney(true);
    if (snapshot.journey) {
      if (state.world?.restoreJourney) state.world.restoreJourney({ journey: snapshot.journey, character: snapshot.character });
      else if (state.world) {
        state.world.setScrollProgress(snapshot.progress || 0);
        const now = state.world.getScrollState?.();
        if (Number.isFinite(snapshot.journey.worldRotation) && Number.isFinite(now?.worldRotation)) state.world.orbit(snapshot.journey.worldRotation - now.worldRotation);
      }
    }
    if (Number.isFinite(snapshot.progress)) state.scrollProgress = Math.max(0, Math.min(1, snapshot.progress));
    if (!snapshot.currentStop || Object.hasOwn(projects, snapshot.currentStop)) state.currentStop = snapshot.currentStop || '';
    if (Number.isFinite(snapshot.chapter)) state.chapter = snapshot.chapter;
    updateJourneyCaption(state.currentStop);
    document.querySelectorAll('[data-destination]').forEach(button => { const active = button.dataset.destination === state.currentStop; button.setAttribute('data-current', String(active)); button.setAttribute('aria-current', active ? 'step' : 'false'); });
    const meter = $('#journey-progress'); if (meter) { meter.value = state.scrollProgress; meter.setAttribute('aria-valuenow', String(Math.round(state.scrollProgress * 100))); }
    syncRoaming(); syncFallbackJourney(state.scrollProgress); syncLocation();
  } finally { routeWriteSuppressed--; }
}

function closeModalRoute() {
  flushSnapshotPersistence();
  const entry = routeEntry();
  const returning = modalReturn || { hash: state.currentStop ? `#place/${state.currentStop}` : '#home', snapshot: captureJourneySnapshot() };
  if (entry?.session === routeSession && entry.dialogDepth > 0 && typeof window.history?.go === 'function') {
    state.route = parseRoute(returning.hash);
    window.history.go(-entry.dialogDepth);
  } else {
    restoreJourneySnapshot(returning.snapshot);
    writeRoute(returning.hash, { replace: true, snapshot: captureJourneySnapshot() });
    modalReturn = null;
  }
}

function applyRoute({ cold = false } = {}) {
  const raw = rawRouteEntry();
  // A cached entry can be newer than its serialized hash when the user presses
  // Back during a scroll burst. A genuine external hash still takes precedence.
  const ownedURL = raw?.hash === window.location?.hash;
  const entry = ownedURL && raw?.key ? routeSnapshots.get(raw.key) || raw : null;
  const route = parseRoute(!cold && entry ? entry.hash : window.location?.hash);
  const matching = entry?.hash === route.hash ? entry : null;
  const token = `${route.hash}|${matching?.key || ''}`;
  if (!cold && token === lastRouteToken) return;
  cancelSnapshotPersistence();
  routeApplying = true;
  try {
    clearPreview();
    if (panel.open) closePanel({ syncRoute: false });
    state.route = route;
    const snapshot = !cold ? matching?.snapshot : null;
    if (snapshot) restoreJourneySnapshot(snapshot);
    else if (route.kind === 'place' || route.kind === 'work') scrollToProject(route.id, { animate: false, route: false });
    else if (route.kind === 'home') {
      routeWriteSuppressed++;
      try {
        window.scrollTo?.({ top: 0, behavior: 'instant' }); updateScrollJourney(true);
        if (state.world?.restoreJourney) state.world.restoreJourney({ progress: 0, worldRotation: 0, manualRotationOffset: 0, arrival: { status: 'intro' } });
        else { const offset = state.world?.getScrollState?.().manualRotationOffset; if (Number.isFinite(offset) && offset) state.world?.orbit(-offset); }
      }
      finally { routeWriteSuppressed--; }
    }
    if (route.kind === 'work' || route.kind === 'panel') {
      const baseHash = (!cold ? matching?.returnHash : null) || ((route.kind === 'work' && route.id) ? `#place/${route.id}` : (state.currentStop ? `#place/${state.currentStop}` : '#home'));
      modalReturn = { hash: baseHash, snapshot: (!cold ? matching?.returnSnapshot : null) || captureJourneySnapshot() };
      const origin = document.getElementById(snapshot?.focusId || '') || $('#journey-detail');
      state.lastFocus = origin;
      if (route.kind === 'work') visitProject(route.id, origin);
      else if (['notes', 'garden', 'radio'].includes(route.id)) { showPanel('work', origin); showProject(route.id); }
      else showPanel(route.id, origin);
      panel.scrollTop = Number(snapshot?.panelScrollTop) || 0;
    } else {
      modalReturn = null;
      if (!cold) (document.getElementById(snapshot?.focusId || '') || (route.id ? $(`#nav-${route.id}`) : $('#explore-button')))?.focus({ preventScroll: true });
    }
    state.route = route;
    syncReading(); syncLocation();
    if (!matching || cold || window.location?.hash !== route.hash) {
      const entryMetadata = matching && !cold ? matching : (route.kind === 'work' || route.kind === 'panel' ? { returnHash: modalReturn?.hash, returnSnapshot: modalReturn?.snapshot, dialogDepth: 0 } : {});
      const snapshot = captureJourneySnapshot();
      const next = writeRoute(route.hash, { replace: true, snapshot, metadata: { ...entryMetadata, hash: route.hash, snapshot } });
      lastRouteToken = `${route.hash}|${next.key}`;
    } else lastRouteToken = token;
  } finally { routeApplying = false; }
}

function syncLocation(world = state.world) {
  const liveArrival = world?.getArrivalState?.();
  const journey = liveArrival ? null : world?.getScrollState?.();
  const arrival = liveArrival || journey?.arrival;
  let status = arrival?.status || 'intro', projectId = arrival?.currentProject || '', targetProject = arrival?.targetProject || '';
  if (!arrival && journey?.transitioning) { status = 'travelling'; targetProject = journey.destination || ''; }
  let text = status === 'at' && projects[projectId] ? `At ${projects[projectId].short}` : status === 'travelling' && projects[targetProject] ? `Heading to ${projects[targetProject].short}` : status === 'between' ? 'Exploring the stone causeway' : 'Exploring the lake city';
  if (!world && state.currentStop) { status = 'illustration'; text = `Exploring ${projects[state.currentStop].short}`; }
  const changed = state.currentLocation.status !== status || state.currentLocation.projectId !== projectId || state.currentLocation.targetProject !== targetProject;
  state.currentLocation = { status, projectId, targetProject, text };
  const location = $('#axo-location');
  if (location && location.textContent !== text) { location.textContent = text; location.dataset.locationStatus = status; }
  if (changed && status === 'at' && Object.hasOwn(projects, projectId) && routeReady && !routeApplying && !routeWriteSuppressed && !panel.open) cacheRouteSnapshot(`#place/${projectId}`);
}

function showPreview(id, { pinned = false } = {}) {
  if (!Object.hasOwn(projects, id) || panel.open) return;
  clearTimeout(previewTimer);
  state.preview = id; previewPinned ||= pinned;
  const preview = $('#project-preview');
  if (!preview) return;
  preview.hidden = false; preview.dataset.project = id;
  $('#preview-title').textContent = projects[id].title;
  $('#preview-summary').textContent = projects[id].intro;
  $('#preview-visit').dataset.destination = id;
  $('#preview-visit').textContent = `Visit ${projects[id].short} ↗`;
  $('#project-preview-toggle')?.setAttribute('aria-expanded', 'true');
  document.documentElement.dataset.preview = 'true';
  document.querySelectorAll('[data-destination]').forEach(button => button.dataset.preview = String(button.dataset.destination === id));
  state.world?.highlightProject?.(id);
  if (state.world) updateProjectedLabels(state.world);
}

function clearPreview() {
  clearTimeout(previewTimer); previewPinned = false; state.preview = '';
  const preview = $('#project-preview'); if (preview) preview.hidden = true;
  $('#project-preview-toggle')?.setAttribute('aria-expanded', 'false');
  document.documentElement.dataset.preview = 'false';
  document.querySelectorAll('[data-destination]').forEach(button => button.dataset.preview = 'false');
  state.world?.highlightProject?.(null);
  if (state.world) updateProjectedLabels(state.world);
}

function previewButton(target) { const button = target?.closest?.('button'); return button?.dataset.destination && button.id !== 'journey-detail' ? button : null; }
function previewHasFocus() {
  const button = document.activeElement;
  return !!previewButton(button) || button?.id === 'project-preview-toggle' || button?.id === 'preview-close';
}
function delayPreviewClose() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => { if (!previewPinned && !previewHasFocus()) clearPreview(); }, 180);
}

document.addEventListener('pointerover', event => { if (event.pointerType === 'touch') return; const button = previewButton(event.target); if (button) showPreview(button.dataset.destination); });
document.addEventListener('pointerout', event => { if (event.pointerType !== 'touch' && previewButton(event.target) && !previewButton(event.relatedTarget)) delayPreviewClose(); });
$('#project-preview')?.addEventListener('pointerenter', () => clearTimeout(previewTimer));
$('#project-preview')?.addEventListener('pointerleave', delayPreviewClose);
document.addEventListener('focusin', event => { const button = previewButton(event.target); if (button) showPreview(button.dataset.destination); });
document.addEventListener('focusout', delayPreviewClose);
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.open && state.preview) { clearPreview(); $('#project-preview-toggle')?.focus({ preventScroll: true }); } });

function updateProjectedLabels(world) {
  if (!Array.isArray(world?.points) || typeof world.project !== 'function') return;
  const obstacles = ['#live-story', '#project-nav', '#project-preview', '.world-controls', '#world-discovery'].map(selector => $(selector)).filter(element => element && !element.hidden && (element.id !== 'world-discovery' || element.open)).map(element => element.getBoundingClientRect()).filter(rect => rect.width > 0 && rect.height > 0);
  const overlaps = (box) => obstacles.some(rect => box.left < rect.right + 6 && box.right > rect.left - 6 && box.top < rect.bottom + 6 && box.bottom > rect.top - 6);
  const tags = [['axo', '#mascot-button'], ...projectOrder.map(id => [id, `#building-${id}`])];
  for (const [id, selector] of tags) {
    const point = world.points.find(item => item.id === id), tag = $(selector);
    if (!point || !tag) continue;
    const projected = world.project(point.position), width = Number(tag.offsetWidth) || 150, height = Number(tag.offsetHeight) || 30;
    let x = Math.max(width / 2 + 8, Math.min(world.width - width / 2 - 8, projected.x));
    let y = Math.max(height + 8, Math.min(world.height - 8, projected.y - (id === 'axo' ? 22 : 12)));
    const box = () => ({ left: x - width / 2, right: x + width / 2, top: y - height, bottom: y });
    let occluded = id !== 'axo' && overlaps(box());
    const focused = document.activeElement === tag;
    if (focused && (occluded || !projected.visible)) {
      const candidates = [
        [x, ($('#live-story')?.getBoundingClientRect().bottom || 0) + height + 20],
        [world.width / 2, world.height * .58], [width / 2 + 10, world.height * .65], [world.width - width / 2 - 10, world.height * .65]
      ];
      for (const candidate of candidates) { x = Math.max(width / 2 + 8, Math.min(world.width - width / 2 - 8, candidate[0])); y = Math.max(height + 8, Math.min(world.height - 8, candidate[1])); if (!overlaps(box())) break; }
      occluded = false;
    }
    tag.classList.add('is-anchored');
    tag.style.left = `${x.toFixed(1)}px`; tag.style.top = `${y.toFixed(1)}px`; tag.style.right = 'auto';
    tag.style.visibility = (projected.visible && !occluded) || focused ? 'visible' : 'hidden';
    tag.dataset.occluded = String(occluded);
  }
}


function renderChapters() {
  const chapters = $('#scroll-chapters');
  if (!chapters) return;
  chapters.innerHTML = Object.entries(projects).map(([id, p]) => `<section class="scroll-chapter" id="chapter-${id}" data-scroll-project="${id}" aria-labelledby="chapter-title-${id}"><p class="chapter-kicker"><span class="chapter-index">${p.number} / 06</span>${p.category}</p><h2 id="chapter-title-${id}">${p.title}</h2><p class="chapter-summary">${p.intro}</p><div class="fact-grid">${p.facts.map(([value, label]) => `<div class="fact-card"><strong>${value}</strong><span>${label}</span></div>`).join('')}</div><div class="chapter-tags">${p.skills.map(skill => `<span>${skill}</span>`).join('')}</div><div class="chapter-actions"><button type="button" class="primary-button" data-project="${id}">Read case study <span aria-hidden="true">↗</span></button></div><p class="panel-footnote">${p.source}</p></section>`).join('');
}

function setScanProgress(progress) {
  const p = Math.max(0, Math.min(1, Number(progress) || 0));
  const changed = state.scanProgress !== p;
  state.scanProgress = p;
  state.world?.setScanProgress?.(p);
  const ui = $('#scan-ui');
  if (ui) { ui.hidden = p >= 1; ui.dataset.scanProgress = p.toFixed(3); }
  const counter = $('#scan-counter-value');
  if (counter) counter.textContent = String(Math.round(p * 100)).padStart(3, '0');
  const fill = $('#scan-progress-fill');
  if (fill) fill.style.width = `${(p * 100).toFixed(1)}%`;
  document.querySelectorAll('[data-scan-threshold]').forEach(card => { card.hidden = p < Number(card.dataset.scanThreshold); });
  const clip = $('#scan-clip-rect');
  if (clip) clip.setAttribute('height', String(Math.round(p * 80)));
  if (changed) syncScanOverlay(state.world);
}

function syncScanOverlay(world) {
  const ui = $('#scan-ui');
  if (!ui || ui.hidden || typeof world?.getScanState !== 'function') return;
  const scan = world.getScanState();
  const stacked = (Number(window.innerWidth) || 1440) < 700;
  if (stacked) {
    // Phones stack the cards under the project banner, clear of the index and controls.
    ui.style.setProperty('--scan-top', `${Math.max(0, scan.feet.y + 22).toFixed(0)}px`);
  }
  const bracket = $('#scan-bracket');
  if (bracket) {
    const width = Math.max(90, scan.halfWidth * 2 + 36);
    bracket.style.left = `${(scan.plane.x - width / 2).toFixed(1)}px`; bracket.style.top = `${(scan.plane.y - 12).toFixed(1)}px`; bracket.style.width = `${width.toFixed(1)}px`;
    bracket.style.visibility = scan.plane.visible && scan.active ? 'visible' : 'hidden';
  }
  const anchors = { who: scan.head, what: scan.chest, how: scan.hip };
  let lastBottom = -Infinity;
  for (const [key, anchor] of Object.entries(anchors)) {
    const card = $(`#scan-card-${key}`), line = $(`#scan-line-${key}`), dot = $(`#scan-dot-${key}`);
    if (!card) continue;
    if (stacked || card.hidden) { line?.setAttribute('d', ''); dot?.setAttribute('r', '0'); if (!stacked) { card.style.left = ''; card.style.top = ''; } continue; }
    const width = Number(card.offsetWidth) || 240, height = Number(card.offsetHeight) || 60;
    const gap = Math.max(70, scan.halfWidth * 1.6 + 40);
    const left = Math.max(12, anchor.x - gap - width);
    let top = Math.max(12, Math.min((world.height || 800) - height - 12, anchor.y - height / 2));
    if (top < lastBottom + 10) top = lastBottom + 10;
    lastBottom = top + height;
    card.style.left = `${left.toFixed(1)}px`; card.style.top = `${top.toFixed(1)}px`;
    const x1 = left + width, y1 = top + height / 2, x2 = anchor.x - scan.halfWidth * .55, y2 = anchor.y;
    line?.setAttribute('d', `M${x1.toFixed(1)},${y1.toFixed(1)} H${(x1 + (x2 - x1) * .45).toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)}`);
    dot?.setAttribute('cx', x2.toFixed(1)); dot?.setAttribute('cy', y2.toFixed(1)); dot?.setAttribute('r', '3');
  }
  const counter = $('#scan-counter');
  if (counter && !stacked) { counter.style.left = `${(scan.plane.x + scan.halfWidth + 34).toFixed(1)}px`; counter.style.top = `${(scan.plane.y - 14).toFixed(1)}px`; counter.style.transform = 'none'; }
}

function measureScrollJourney() {
  const viewport = Number(window.innerHeight) || 800;
  const focusLine = .5;
  const pageY = Number(window.scrollY) || 0;
  const maxScroll = Math.max(0, (Number(document.documentElement.scrollHeight) || viewport) - viewport);
  scrollAnchors = [0];
  // The scan stretch sits before the first chapter; the journey mapping starts after it.
  const stage = $('#scan-stage');
  scanLength = reducedMotion.matches ? 0 : Math.max(0, Number(stage?.offsetHeight) || 0);
  const chapters = [...document.querySelectorAll('[data-scroll-project]')];
  chapters.forEach((chapter) => {
    const rect = chapter.getBoundingClientRect();
    const center = rect.top + pageY + rect.height / 2;
    const anchor = Math.min(Math.max(0, maxScroll - scanLength), Math.max(0, center - viewport * focusLine - scanLength));
    scrollAnchors.push(Math.max(scrollAnchors.at(-1), anchor));
  });
  updateScrollJourney(true);
}

function updateScrollJourney(force = false) {
  if (scrollAnchors.length !== projectOrder.length + 1) return;
  const pageY = Math.max(0, Number(window.scrollY) || 0);
  setScanProgress(scanLength > 0 ? Math.min(1, pageY / scanLength) : 1);
  const y = Math.max(0, pageY - scanLength);
  let progress = y >= scrollAnchors.at(-1) && scrollAnchors.at(-1) > 0 ? 1 : 0;
  for (let i = 0; i < projectOrder.length; i++) {
    const start = scrollAnchors[i], end = scrollAnchors[i + 1];
    if (y <= end && end > start) {
      progress = (i + Math.max(0, Math.min(1, (y - start) / (end - start)))) / projectOrder.length;
      break;
    }
  }
  // Native scroll offsets may round fractional CSS pixels at a chapter anchor.
  const nearestStop = Math.round(progress * projectOrder.length) / projectOrder.length;
  if (Math.abs(progress - nearestStop) < .00025) progress = nearestStop;
  if (!force && Math.abs(progress - state.scrollProgress) < .000001) return;
  state.scrollProgress = progress;
  const chapterIndex = progress > 0 ? Math.min(5, Math.floor(progress * 6 - .000001)) : -1;
  state.chapter = chapterIndex + 1;
  const currentId = projectOrder[chapterIndex] || '';
  state.currentStop = currentId;
  updateJourneyCaption(currentId);
  state.world?.setScrollProgress(progress);
  document.querySelectorAll('[data-scroll-project]').forEach(chapter => chapter.setAttribute('data-active', String(chapter.dataset.scrollProject === currentId)));
  document.querySelectorAll('[data-destination]').forEach(button => {
    const active = button.dataset.destination === currentId;
    button.setAttribute('data-current', String(active));
    button.setAttribute('aria-current', active ? 'step' : 'false');
  });
  const meter = $('#journey-progress');
  if (meter) { meter.value = progress; meter.setAttribute('aria-valuenow', String(Math.round(progress * 100))); }
  syncFallbackJourney(progress);
  syncRoaming();
  syncLocation();
  if (routeReady && !routeApplying && !routeWriteSuppressed && !panel.open) {
    const hash = currentId ? `#place/${currentId}` : '#home';
    cacheRouteSnapshot(hash);
  }
}

let captionProject = null;
function updateJourneyCaption(id) {
  if (captionProject === id) return;
  captionProject = id;
  const p = projects[id];
  const title = $('#journey-title'), summary = $('#journey-summary');
  const category = $('#current-destination'), detail = $('#journey-detail');
  if (title) title.textContent = p ? p.title : 'Ideas, built into worlds.';
  if (summary) summary.textContent = p ? p.intro : "I'm Alexis. Explore my work in product, AI, and automation. Scroll to explore the town with AXO.";
  if (category) category.textContent = p ? `${p.number} / 06 · ${p.category}` : 'ALEXIS MARTINEZ · PRODUCT & AI';
  if (detail) {
    detail.hidden = false;
    if (p) { delete detail.dataset.destination; detail.dataset.project = id; detail.textContent = 'Read case study ↗'; }
    else { delete detail.dataset.project; detail.dataset.destination = projectOrder[0]; detail.textContent = 'Start exploring ↓'; }
  }
  const index = projectOrder.indexOf(id);
  const counter = $('#journey-counter');
  if (counter) counter.textContent = p ? `${p.number} / 06` : 'Explore 6 projects';
  const previous = $('#project-prev'), next = $('#project-next');
  if (previous) { previous.disabled = index <= 0; previous.title = index > 0 ? `Previous: ${projects[projectOrder[index - 1]].short}` : 'First project'; }
  if (next) { next.disabled = index === projectOrder.length - 1; next.title = index < projectOrder.length - 1 ? `Next: ${projects[projectOrder[index + 1]].short}` : 'Last project'; }
}

function scrollToProject(id, { animate = !state.paused && !reducedMotion.matches, route = true } = {}) {
  const index = projectOrder.indexOf(id);
  if (index < 0) return false;
  if (route && !routeApplying) rememberRouteSnapshot();
  if (panel.open) closePanel({ syncRoute: false });
  clearPreview();
  routeWriteSuppressed++;
  try {
    measureScrollJourney();
    // A building click chooses one destination; it must not scrub every chapter.
    state.world?.beginDirectTravel(id, { animate });
    window.scrollTo?.({ top: (scrollAnchors[index + 1] || 0) + scanLength, behavior: 'instant' });
    updateScrollJourney(true);
  } finally { routeWriteSuppressed--; }
  if (route && !routeApplying) {
    modalReturn = null;
    writeRoute(`#place/${id}`, { replace: state.route.hash === `#place/${id}`, snapshot: captureJourneySnapshot() });
  }
  syncLocation();
  return true;
}

function syncFallbackJourney(progress) {
  const axo = $('#fallback-axo');
  if (!axo) return;
  // The illustration preserves the foreground guide composition on devices without 3D.
  axo.setAttribute('transform', 'translate(385 437)');
}

function showProject(name) {
  if (projects[name]) {
    const p = projects[name];
    state.activeProject = name;
    state.panel = 'project';
    $('#panel-category').textContent = `${p.number} / ${p.category}`;
    const d = caseDetails[name], index = projectOrder.indexOf(name);
    panelBody.innerHTML = `<article class="case-study"><div class="case-topline"><button type="button" class="back-button" data-back>← All projects</button><nav class="case-nav" aria-label="Navigate case studies"><button type="button" class="pill-button" data-project="${projectOrder[(index + 5) % 6]}" aria-label="Previous case study: ${projects[projectOrder[(index + 5) % 6]].title}">← Previous</button><span>${p.number} / 06</span><button type="button" class="pill-button" data-project="${projectOrder[(index + 1) % 6]}" aria-label="Next case study: ${projects[projectOrder[(index + 1) % 6]].title}">Next →</button></nav></div><header class="case-hero">${illustrationMarkup(name, p)}<p class="case-eyebrow">${p.category}</p><h2 id="panel-title">${p.title}</h2><p class="case-lead">${leadMarkup(p)}</p><div class="case-actions"><button type="button" class="save-project" data-save-project="${name}" aria-pressed="${shortlist.includes(name)}">${shortlist.includes(name) ? 'Saved ✓' : 'Save project +'}</button><button type="button" class="pill-button" data-copy-project-link="${name}">Copy project link</button><button type="button" class="pill-button" data-copy-brief="${name}">Copy brief</button><button type="button" class="pill-button" data-brief="${name}">Download brief .txt</button></div><div class="project-link-fallback" id="project-link-fallback" hidden><label for="project-link-field">Project link</label><input id="project-link-field" type="text" readonly value="${escapeHTML(projectLink(name))}"><a href="#work/${name}">Open this project anchor ↗</a></div></header><div class="case-metrics">${p.facts.map(([value, label, roll]) => `<div class="case-metric"><strong${countAttributes(roll)}>${value}</strong><span>${label}</span></div>`).join('')}</div>${d.diagram ? '' : ProjectArtifacts.render(name)}<nav class="case-jumps" aria-label="In this case study"><button type="button" data-case-jump="problem">The problem</button><button type="button" data-case-jump="contribution">My contribution</button><button type="button" data-case-jump="approach">How it works</button><button type="button" data-case-jump="outcome">Outcome & evidence</button>${d.diagram ? '<button type="button" data-case-jump="diagram">Architecture</button>' : ''}${d.builder ? '<button type="button" data-case-jump="builder">PO and builder</button>' : ''}</nav>${d.diagram ? `<section class="case-section case-diagram" id="case-diagram" tabindex="-1"><p class="case-eyebrow">Interactive / How it is built</p>${diagramMarkup(d.diagram, name)}</section>` : ''}<div class="case-layout"><div class="case-main"><section class="case-section" id="case-problem" tabindex="-1"><p class="case-eyebrow">01 / The problem</p><h3>What needed to change?</h3><p>${d.problem}</p></section><section class="case-section" id="case-contribution" tabindex="-1"><p class="case-eyebrow">02 / My contribution</p><h3>Where I made the connection.</h3><ul class="case-contributions">${d.contributions.map(item => `<li>${item}</li>`).join('')}</ul></section><section class="case-section" id="case-approach" tabindex="-1"><p class="case-eyebrow">03 / How it works</p><h3>A path from need to use.</h3><p class="case-flow-caption">Portfolio interpretation · a simplified process map of the work.</p><ol class="case-flow">${d.steps.map(([title, text], step) => `<li><span class="case-step-number" aria-hidden="true">0${step + 1}</span><div><h4>${title}</h4><p>${text}</p></div></li>`).join('')}</ol><div class="case-decision"><h4>${d.decision}</h4><p>${d.rationale}</p></div></section>${d.builder ? `<section class="case-section" id="case-builder" tabindex="-1"><p class="case-eyebrow">Extra / Product owner and builder</p><h3>What I wrote, and what I built.</h3><p>${d.builder}</p></section>` : ''}${widgetsMarkup(d.widgets)}<section class="case-section" id="case-outcome" tabindex="-1"><p class="case-eyebrow">04 / Outcome & evidence</p><h3>${p.outcome}</h3><p>${d.takeaway}</p><div class="evidence-note"><strong>${d.evidence}</strong><p>${d.boundary}</p><span>Source: ${p.source}</span></div></section></div><aside class="case-sidebar" aria-label="Project at a glance"><div class="case-summary"><h3>At a glance</h3><dl><dt>My role</dt><dd>${p.role}</dd><dt>Scope</dt><dd>${d.scope}</dd><dt>Status / context</dt><dd>${d.status}</dd></dl><div class="skill-tags">${p.skills.map(skill => `<span>${skill}</span>`).join('')}</div><button type="button" class="primary-button" data-walk="${name}">Find it in the town <span aria-hidden="true">↗</span></button><p class="panel-footnote">Closes this case study and brings its building to AXO.</p></div></aside></div><footer class="case-outcome"><p>Want the key points for later?</p><div class="demo-pills"><button type="button" class="primary-button" data-brief="${name}">Download this project brief ↗</button><button type="button" class="pill-button" data-panel="work">Explore all six projects →</button></div></footer></article>`;
    panel.scrollTop = 0;
    mountShowcase(panel);
    return;
  }
  if (!['radio', 'garden', 'notes'].includes(name)) return;
  openModalRoute(`#${name}`);
  state.panel = name;
  state.activeProject = '';
  const back = '<button type="button" class="back-button" data-back>← Back to the workshop</button>';
  if (name === 'radio') {
    panelBody.innerHTML = `${back}<h2 id="panel-title">Tune into<br><em>the lake.</em></h2><p class="panel-description">A soft synthesised soundscape for an imaginary place. Pick a mood, then press play.</p><div class="demo-box"><label>Choose a moment</label><div class="demo-pills"><button class="pill-button" data-tone="dawn" aria-pressed="true">First light</button><button class="pill-button" data-tone="rain" aria-pressed="false">After rain</button><button class="pill-button" data-tone="dusk" aria-pressed="false">Blue hour</button></div></div><button type="button" class="primary-button" id="radio-toggle">${state.sound ? 'Pause the lake' : 'Listen to the lake'} ↗</button><p class="panel-footnote">Sound is generated on your device. Start quietly and make yourself comfortable.</p>`;
  } else if (name === 'garden') {
    panelBody.innerHTML = `${back}<h2 id="panel-title">An island.<br><em>Another perspective.</em></h2><p class="panel-description">Planted islands, connecting waterways, and little workshops. Turn this speculative city and watch its light change.</p><div class="demo-box"><label for="orbit-range">Turn the lake city</label><input id="orbit-range" type="range" min="-100" max="100" value="0"><div class="demo-pills"><button class="pill-button" id="garden-light">Change the light ☼</button><button class="pill-button" id="garden-wave">Wake up AXO ↗</button></div></div><p class="panel-footnote">Close this window to wander the full world. Two arrow buttons below the island also rotate it.</p>`;
    let previous = 0;
    $('#orbit-range').addEventListener('input', (event) => {
      const next = Number(event.target.value);
      state.world?.orbit((next - previous) * .02); previous = next;
    });
  } else if (name === 'notes') {
    panelBody.innerHTML = `${back}<h2 id="panel-title">Leave a little<br><em>room for ideas.</em></h2><p class="panel-description">A pocket notebook for the thought you don't want to lose. Just for you, in this browser.</p><label class="eyebrow" for="field-note">Your field notes</label><textarea class="note-editor" id="field-note" placeholder="What if…" maxlength="20000"></textarea><div class="readout"><span id="save-status" role="status">Local notebook</span><button class="pill-button" id="download-note">Download .txt ↗</button></div><p class="panel-footnote">Notes stay on this device and browser. Download a copy to keep it beyond a browser reset.</p>`;
    $('#field-note').value = storage.get('field-notes');
    $('#field-note').addEventListener('input', (event) => {
      clearTimeout(notesTimer);
      const saved = storage.set('field-notes', event.target.value);
      $('#save-status').textContent = saved ? 'Saved in this browser ✓' : 'Use Download to keep this note';
    });
  }
  $('#panel-category').textContent = 'An experiment from the workshop';
  panel.scrollTop = 0;
  rememberRouteSnapshot();
  $('[data-back]')?.focus();
}

document.addEventListener('click', (event) => {
  const anchor = event.target.closest?.('a');
  const href = anchor?.getAttribute('href');
  if (href?.startsWith('#')) {
    const route = parseRoute(href);
    if (route.hash === href || Object.hasOwn(projects, href.slice(1))) {
      event.preventDefault?.();
      if (route.kind === 'work') visitProject(route.id, anchor);
      else if (route.kind === 'place') scrollToProject(route.id);
      else if (route.kind === 'panel' && templates[route.id]) showPanel(route.id, anchor);
      else if (route.kind === 'home') {
        rememberRouteSnapshot();
        writeRoute('#home', { replace: state.route.hash === '#home', snapshot: null });
        lastRouteToken = ''; applyRoute();
      }
      return;
    }
  }
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.copyProjectLink && Object.hasOwn(projects, button.dataset.copyProjectLink)) { copyProjectLink(button.dataset.copyProjectLink); return; }
  if (button.dataset.artifactAction) { ProjectArtifacts.handle(button.dataset.artifactAction, button.dataset.artifactProject, panelBody); return; }
  if (button.id === 'project-preview-toggle') {
    if (state.preview && previewPinned) clearPreview();
    else showPreview(state.preview || state.currentStop || projectOrder[0], { pinned: true });
    return;
  }
  if (button.id === 'preview-close') { clearPreview(); $('#project-preview-toggle')?.focus({ preventScroll: true }); return; }
  if (button.dataset.previewProject) { showPreview(button.dataset.previewProject, { pinned: true }); return; }
  if (button.dataset.saveProject) { toggleShortlist(button.dataset.saveProject); return; }
  if (button.dataset.projectFilter) { workFilter = button.dataset.projectFilter; applyWorkFilters(); return; }
  if (button.id === 'reset-project-filters') { workFilter = 'all'; workQuery = ''; const input = $('#project-search'); if (input) { input.value = ''; input.focus(); } applyWorkFilters(); return; }
  if (button.dataset.caseJump) { const section = $(`#case-${button.dataset.caseJump}`); section?.scrollIntoView({ block: 'start', behavior: state.paused || reducedMotion.matches ? 'instant' : 'smooth' }); section?.focus({ preventScroll: true }); return; }
  if (button.dataset.brief && projects[button.dataset.brief]) { downloadText(projectBrief(button.dataset.brief), `alexis-${button.dataset.brief}-brief.txt`); toast('Project brief downloaded with source and outcome context.'); return; }
  if (button.dataset.copyBrief && projects[button.dataset.copyBrief]) { copyBrief(button.dataset.copyBrief); return; }
  if (button.id === 'compare-projects' && shortlist.length >= 2) { showPanel('compare', state.lastFocus || button); return; }
  if (button.id === 'download-shortlist' && shortlist.length) { downloadText(`ALEXIS MARTINEZ · SELECTED PROJECTS\n\n${shortlist.map(projectBrief).join('\n\n────────────────────────\n\n')}`, 'alexis-selected-projects.txt'); toast('Your selected project brief is ready.'); return; }
  if (button.dataset.effect) {
    if (button.dataset.effect === 'stars') { cosmos?.pulse(); toast('A small constellation, just for this moment. Move your pointer through the stars.'); }
    if (button.dataset.effect === 'flowers') { state.world?.bloomFlowers?.(); toast('The gardens answer. Brush the flowers with your pointer.'); }
    if (button.dataset.effect === 'water') { state.world?.rippleWater?.(); toast('A ripple travels across the canals. Tap the water to make another.'); }
    return;
  }
  if (button.dataset.panel) showPanel(button.dataset.panel, button);
  if (button.dataset.destination) scrollToProject(button.dataset.destination);
  else if (projects[button.dataset.project]) visitProject(button.dataset.project, button);
  else if (button.dataset.project) showProject(button.dataset.project);
  if (button.dataset.walk) scrollToProject(button.dataset.walk);
  if (button.hasAttribute('data-back')) showPanel('work', state.lastFocus);
  if (button.dataset.tone) {
    try { audio ||= new LakeAudio(); audio.tune(button.dataset.tone); }
    catch { toast('Audio is unavailable in this browser.'); }
    document.querySelectorAll('[data-tone]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
  }
  if (button.id === 'wave-button' || button.id === 'garden-wave') {
    closePanel(); state.world?.wave();
    if (state.sound) audio?.chime();
    toast('AXO says: welcome to the lake city. ✳');
  }
  if (button.id === 'radio-toggle') toggleSound();
  if (button.id === 'garden-light') toggleTheme();
  if (button.id === 'download-note') {
    downloadText($('#field-note').value, 'axo-field-notes.txt');
  }
});

$('#hello-button').addEventListener('click', () => showPanel('axo'));
$('#mascot-button').addEventListener('click', () => showPanel('axo'));
$('#explore-button').addEventListener('click', () => scrollToProject(projectOrder[0]));
$('#close-panel').addEventListener('click', closePanel);
panel.addEventListener('click', (event) => { if (event.target === panel) { const rect = panel.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closePanel(); } });
panel.addEventListener('scroll', () => { if (panel.open && routeReady && !routeApplying) rememberRouteSnapshot(); }, { passive: true });
panel.addEventListener('close', () => {
  const suppressed = suppressedCloseEvents > 0;
  if (suppressed) suppressedCloseEvents--;
  // A traversal can close and reopen the native dialog before its queued close event.
  if (panel.open) { syncReading(); return; }
  document.body.style.overflow = ''; state.panel = ''; state.activeProject = '';
  syncReading();
  state.lastFocus?.focus({ preventScroll: true });
  if (!suppressed && !routeApplying) closeModalRoute();
});
$('#theme-toggle').addEventListener('click', toggleTheme);
$('#sound-toggle').addEventListener('click', toggleSound);
$('#motion-toggle').addEventListener('click', () => { state.paused = !state.paused; syncMotion(); });
$('#project-prev')?.addEventListener('click', () => { const index = projectOrder.indexOf(state.currentStop); if (index > 0) scrollToProject(projectOrder[index - 1]); });
$('#project-next')?.addEventListener('click', () => { const index = projectOrder.indexOf(state.currentStop); if (index < projectOrder.length - 1) scrollToProject(projectOrder[index + 1]); });
$('#tour-toggle')?.addEventListener('click', () => { const index = Math.min(5, Math.floor(state.scrollProgress * 6 + .000001)); scrollToProject(projectOrder[index]); });
$('#rotate-left').addEventListener('click', () => state.world?.orbit(-.3));
$('#rotate-right').addEventListener('click', () => state.world?.orbit(.3));
document.addEventListener('visibilitychange', () => { syncMotion(); if (audio) audio.enable(state.sound && !document.hidden).catch(() => {}); });
reducedMotion.addEventListener('change', (event) => { state.paused = event.matches; syncMotion(); });

function showFallback() {
  // A lost context cannot be rendered again. Retire its loop and listeners so
  // returning to the tab does not restart work behind the illustration.
  state.world?.destroy();
  state.world = null;
  $('#world-canvas').hidden = true; $('#world-fallback').hidden = false;
  $('#rotate-left').disabled = true; $('#rotate-right').disabled = true;
  document.querySelectorAll('[data-effect]').forEach(button => {
    if (button.dataset.effect !== 'stars') { button.disabled = true; button.title = 'Available in the interactive 3D town'; }
  });
  document.querySelectorAll('[data-destination]').forEach(tag => {
    tag.classList.remove('is-anchored');
    for (const property of ['left', 'top', 'right', 'visibility']) tag.style[property] = '';
  });
  document.documentElement.dataset.renderer = 'illustration';
  syncFallbackJourney(state.scrollProgress);
}

try {
  const cosmosCanvas = $('#cosmos-canvas');
  if (cosmosCanvas) cosmos = new Cosmos(cosmosCanvas, { reducedMotion: state.paused });
} catch (error) { console.info('Cosmic background unavailable:', error.message); }

try {
  state.world = new World({ canvas: $('#world-canvas'),
    onFrame: (world) => { updateProjectedLabels(world); syncLocation(world); syncScanOverlay(world); },
    onInteraction: () => { if (routeReady && !routeApplying && !routeWriteSuppressed && !panel.open) rememberRouteSnapshot(); syncLocation(); },
    onProjectClick: (id) => scrollToProject(id),
    onArrival: () => syncLocation(),
    onMascotClick: () => { state.world?.wave(); if (state.sound) audio?.chime(); toast('Curious circuits, very friendly intentions. Hello from AXO!'); }
  });
  document.documentElement.dataset.renderer = 'webgl';
  $('#world-canvas').addEventListener('webglcontextlost', (event) => { event.preventDefault(); showFallback(); });
} catch (error) { console.info('AXO illustration fallback:', error.message); showFallback(); }

renderChapters();
window.addEventListener('scroll', () => updateScrollJourney(), { passive: true });
window.addEventListener('resize', measureScrollJourney);
window.addEventListener('load', measureScrollJourney);
measureScrollJourney();
if (typeof ResizeObserver !== 'undefined' && $('#scroll-chapters')) new ResizeObserver(measureScrollJourney).observe($('#scroll-chapters'));

if (storage.get('theme') === 'night') toggleTheme();
syncMotion();
syncRoaming();
routeReady = true;
try { if (window.history) window.history.scrollRestoration = 'manual'; } catch {}
applyRoute({ cold: true });
window.addEventListener('popstate', () => applyRoute());
window.addEventListener('hashchange', () => applyRoute());

mountShowcase(null);

window.AXO = Object.freeze({ visit: visitProject, scrollToProject, getState: () => ({ night: state.night, paused: state.paused, sound: state.sound, panel: state.panel, roaming: false, build: 'axo-world', scrollProgress: state.scrollProgress, scanProgress: state.scanProgress, chapter: state.chapter, activeProject: state.activeProject, currentStop: state.currentStop, azimuth: state.world?.azimuth ?? null, journey: state.world?.getScrollState?.() ?? null, character: state.world?.getCharacterState?.() ?? null, renderer: document.documentElement.dataset.renderer, shortlist: [...shortlist], route: { ...state.route }, currentLocation: { ...state.currentLocation }, preview: state.preview, reading: panel.open, cosmos: cosmos?.getState?.() ?? null }) });
