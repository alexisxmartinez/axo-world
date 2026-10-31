// Original portfolio illustrations. These explain product decisions; they are not
// production screenshots, source artifacts, or evidence of additional outcomes.
const definitions = Object.freeze({
  retail: { title: 'Where assistance meets a human decision', prompt: 'Try two sample questions to see why the handoff belongs in the product.' },
  rxp: { title: 'Make the path to production visible', prompt: 'Inspect the review work that connects a backlog to a release.' },
  slides: { title: 'From recurring inputs to a readable slide', prompt: 'Compile the dummy reporting inputs into a consistent presentation structure.' },
  playbooks: { title: 'Reconcile once. Repeat with confidence.', prompt: 'Choose an example market, then check whether its inputs are ready for a batch.' },
  adoption: { title: 'One trend. Two useful questions.', prompt: 'Switch the same dummy data between participant counts and participation rate.' },
  learning: { title: 'A small workflow you can reason through', prompt: 'Walk through a practice example and check each part as you understand it.' }
});

const initial = id => ({ mode: id === 'retail' ? 'routine' : id === 'rxp' ? 'all' : id === 'slides' ? 'inputs' : 'counts', market: 'a', checked: false, steps: 0 });
const states = new WeakMap();
const button = (id, action, label, selected = null) => `<button type="button" data-artifact-project="${id}" data-artifact-action="${action}"${selected === null ? '' : ` aria-pressed="${selected}"`}>${label}</button>`;
const arrow = '<span class="artifact-arrow" aria-hidden="true">→</span>';
const icon = (type) => {
  const paths = {
    question: '<path d="M5 5h22v16H14l-7 6v-6H5z"/><path d="M13 10a4 4 0 0 1 7 2c0 3-4 3-4 6m0 3v.1"/>',
    gate: '<path d="m16 3 12 5v8c0 7-12 13-12 13S4 23 4 16V8z"/><path d="m10 16 4 4 8-9"/>',
    person: '<circle cx="16" cy="10" r="5"/><path d="M6 28v-4a10 10 0 0 1 20 0v4"/>',
    source: '<path d="M5 4h22v24H5zM5 12h22M13 12v16m7-16v16M5 20h22"/>',
    slide: '<path d="M3 5h26v20H3zM10 30l6-5 6 5M8 11h16M8 16h8m-8 4h12"/>',
    check: '<path d="m5 16 7 7L27 8"/>'
  };
  return `<svg class="artifact-icon" viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[type] || paths.check}</svg>`;
};

function retail(state) {
  const handoff = state.mode === 'handoff';
  return `<div class="artifact-pipeline">
    <div class="artifact-card">${icon('question')}<span class="artifact-label">01 / Sample question</span><p class="artifact-quote">${handoff ? '“Can you override this warranty exception?”' : '“Where can I compare two printers?”'}</p></div>${arrow}
    <div class="artifact-card">${icon('gate')}<span class="artifact-label">02 / Product boundary</span><h4>${handoff ? 'A person needs to decide' : 'Use approved guidance'}</h4><p>${handoff ? 'An exception requires authority beyond an assistant’s answer.' : 'Help the associate find relevant product information.'}</p></div>${arrow}
    <div class="artifact-card artifact-card-accent">${icon(handoff ? 'person' : 'check')}<span class="artifact-label">03 / Conceptual response</span><h4>${handoff ? 'Offer a human handoff' : 'Keep the associate in control'}</h4><p>${handoff ? 'Carry the question into a human conversation, with a clear next step.' : 'Present useful guidance, invite feedback, and keep the handoff available.'}</p></div>
  </div><p class="artifact-note"><strong>Acceptance-criteria lens:</strong> ${handoff ? 'The route to a human should be easy to find when the assistant reaches its boundary.' : 'A useful answer needs an understandable source, a feedback path, and an available handoff.'}</p>`;
}

function rxp(state) {
  const reviewOnly = state.mode === 'review';
  const rows = [
    ['Design requirements', 'Define what the application needs to do', 'Design', false],
    ['Security review', 'Connect the design to review decisions', 'Review', true],
    ['Governance alignment', 'Resolve organizational delivery requirements', 'Review', true],
    ['Release readiness', 'Connect the accepted work to production delivery', 'Release', false]
  ].filter(row => !reviewOnly || row[3]);
  return `<div class="artifact-route" aria-label="Conceptual delivery path"><span>Backlog</span><i aria-hidden="true">→</i><span${reviewOnly ? ' class="artifact-route-active"' : ''}>Security + governance</span><i aria-hidden="true">→</i><span>Production</span></div>
    <div class="artifact-backlog"><div class="artifact-table-heading"><span>Illustrative work item</span><span>Stage</span></div>${rows.map(row => `<div class="artifact-backlog-row"><div><strong>${row[0]}</strong><p>${row[1]}</p></div><span class="artifact-badge">${row[2]}</span></div>`).join('')}</div>
    <p class="artifact-note"><strong>Product ownership lens:</strong> ${reviewOnly ? 'Review decisions are delivery dependencies. Making them visible helps keep the application’s path connected.' : 'The production milestone depends on requirements and review decisions as well as implementation.'}</p>`;
}

function slides(state) {
  const compiled = state.mode === 'compiled';
  return `<div class="artifact-slide-layout">
    <div class="artifact-inputs"><span class="artifact-label">Example inputs · dummy data</span><table class="artifact-data"><caption class="sr-only">Dummy reporting inputs for the illustration</caption><tbody><tr><th scope="row">Items reviewed</th><td>12</td></tr><tr><th scope="row">Teams represented</th><td>3</td></tr><tr><th scope="row">Open questions</th><td>2</td></tr></tbody></table><p>One recurring structure.<br>Clear inputs for the next cycle.</p></div>
    <div class="artifact-slide-preview"><svg viewBox="0 0 640 360" role="img" aria-labelledby="artifact-slides-title artifact-slides-desc"><title id="artifact-slides-title">${compiled ? 'Compiled example leadership slide' : 'Reporting structure before compilation'}</title><desc id="artifact-slides-desc">${compiled ? 'A sample weekly review slide organizing twelve reviewed items, three teams, and two open questions. All values are invented for illustration.' : 'A slide outline with space reserved for a headline, three summary values, and a decision prompt.'}</desc>
      <rect x="1" y="1" width="638" height="358" rx="12" fill="#ffffff" stroke="#d9cbdf"/>
      <rect x="1" y="1" width="10" height="358" rx="5" fill="#9f86c0"/>
      <text x="38" y="45" font-size="13" letter-spacing="2" fill="#5e548e">EXAMPLE / WEEKLY REVIEW</text>
      <text x="38" y="91" font-size="29" font-weight="700" fill="#231942">${compiled ? 'A clearer weekly review.' : 'A repeatable reporting structure.'}</text>
      ${[0, 1, 2].map((n) => `<rect x="${38 + n * 194}" y="122" width="176" height="106" rx="8" fill="${compiled ? ['#eee7f3', '#f2e6ef', '#eae7f2'][n] : '#f3f0f5'}"/><text x="${54 + n * 194}" y="173" font-size="35" font-weight="700" fill="#231942">${compiled ? ['12', '3', '2'][n] : '—'}</text><text x="${54 + n * 194}" y="204" font-size="14" fill="#5e548e">${compiled ? ['Items reviewed', 'Teams represented', 'Open questions'][n] : ['Summary value', 'Audience context', 'Decision signal'][n]}</text>`).join('')}
      <path d="M38 255h564" stroke="#d9cbdf"/>
      <text x="38" y="285" font-size="12" letter-spacing="1.4" fill="#5e548e">NEXT CONVERSATION</text>
      <text x="38" y="315" font-size="18" fill="#231942">${compiled ? 'Which open question needs an owner?' : 'A consistent place for the next decision.'}</text>
    </svg><div class="artifact-slide-summary"><span class="artifact-label">Example / weekly review</span><h4>${compiled ? 'A clearer weekly review.' : 'A repeatable reporting structure.'}</h4><div class="artifact-slide-stats">${[0, 1, 2].map(n => `<div><strong>${compiled ? ['12', '3', '2'][n] : '—'}</strong><span>${compiled ? ['Items reviewed', 'Teams represented', 'Open questions'][n] : ['Summary value', 'Audience context', 'Decision signal'][n]}</span></div>`).join('')}</div><p><strong>Next conversation:</strong> ${compiled ? 'Which open question needs an owner?' : 'A consistent place for the next decision.'}</p></div></div>
  </div><p class="artifact-note"><strong>Workflow lens:</strong> ${compiled ? 'The automation’s useful output is a dependable reporting structure that makes a leadership question easier to see.' : 'Use “Compile example” to see how the same inputs can populate a consistent slide.'}</p>`;
}

function playbooks(state) {
  const reconciled = state.market === 'a';
  const result = !state.checked ? 'Run the check to inspect the example.' : reconciled ? 'Example passes reconciliation. Ready for stakeholder review.' : 'Example held: the totals disagree and the missing context needs an owner.';
  return `<div class="artifact-reconciliation">
    <div><span class="artifact-label">Example market ${state.market.toUpperCase()} · dummy data</span><table class="artifact-data"><caption class="sr-only">Illustrative reconciliation checks</caption><thead><tr><th scope="col">Check</th><th scope="col">Input</th><th scope="col">Playbook</th></tr></thead><tbody><tr><th scope="row">Record total</th><td>12</td><td>${reconciled ? '12' : '10'}</td></tr><tr><th scope="row">Context note</th><td>Required</td><td>${reconciled ? 'Included' : 'Missing'}</td></tr><tr><th scope="row">Review owner</th><td>Required</td><td>Assigned</td></tr></tbody></table></div>
    <div class="artifact-check-result${state.checked ? reconciled ? ' artifact-result-ready' : ' artifact-result-held' : ''}">${icon(state.checked && reconciled ? 'check' : 'gate')}<span class="artifact-label">Batch readiness</span><h4>${!state.checked ? 'Check before repeating' : reconciled ? 'Review can continue' : 'Resolve the gap first'}</h4><p>${result}</p></div>
  </div><p class="artifact-note"><strong>Validation lens:</strong> A repeatable process needs a clear rule for when an output should pause.</p>`;
}

function adoption(state) {
  const percent = state.mode === 'rate';
  const values = percent ? [20, 30, 45, 60] : [8, 12, 18, 24];
  const maximum = percent ? 100 : 40;
  const points = values.map((value, index) => [100 + index * 166, 238 - value / maximum * 180]);
  const line = points.map(point => point.join(',')).join(' ');
  return `<div class="artifact-chart-header"><span class="artifact-label">Dummy data · ${percent ? 'participation rate' : 'participant count'}</span><span>Example eligible group: 40 people</span></div>
    <svg class="artifact-chart" viewBox="0 0 720 300" role="img" aria-labelledby="artifact-adoption-title artifact-adoption-desc"><title id="artifact-adoption-title">Illustrative ${percent ? 'participation rate' : 'participant count'} across four example periods</title><desc id="artifact-adoption-desc">Dummy values ${values.map(value => `${value}${percent ? ' percent' : ' people'}`).join(', ')}. This is not actual adoption data or a claim of project impact.</desc>
      ${[0, 1, 2, 3, 4].map(n => { const y = 238 - n * 45; return `<path d="M80 ${y}H650" stroke="#ded3e5" stroke-width="1"/><text x="62" y="${y + 5}" text-anchor="end" fill="#5e548e" font-size="13">${maximum / 4 * n}${percent ? '%' : ''}</text>`; }).join('')}
      <path d="M100 238 ${points.map(point => `L${point.join(' ')}`).join(' ')} L598 238Z" fill="#e0b1cb" fill-opacity=".48"/>
      <polyline points="${line}" fill="none" stroke="#5e548e" stroke-width="4" stroke-linejoin="round"/>
      ${points.map(([x, y], n) => `<circle cx="${x}" cy="${y}" r="6" fill="#231942" stroke="#ffffff" stroke-width="3"/><text x="${x}" y="${y - 16}" text-anchor="middle" fill="#231942" font-size="15" font-weight="700">${values[n]}${percent ? '%' : ''}</text><text x="${x}" y="267" text-anchor="middle" fill="#5e548e" font-size="13">Period ${n + 1}</text>`).join('')}
    </svg><table class="artifact-chart-data artifact-data"><caption>Example values · not actual adoption data</caption><thead><tr><th scope="col">Period</th><th scope="col">${percent ? 'Participation rate' : 'Participant count'}</th></tr></thead><tbody>${values.map((value, index) => `<tr><th scope="row">Period ${index + 1}</th><td><span class="artifact-value">${value}${percent ? '%' : ' people'}</span><span class="artifact-mini-bar" aria-hidden="true" style="width:${value / maximum * 100}%"></span></td></tr>`).join('')}</tbody></table><p class="artifact-note"><strong>Audience lens:</strong> ${percent ? 'Rate adds the denominator: 24 out of 40 people is 60%. It helps answer what share of an eligible group participated.' : 'A count answers how many people participated. To interpret progress, leaders also need the eligible audience and the time period.'}</p>`;
}

const practice = [
  ['Understand the request', 'Example: a colleague submits a request that needs review. Identify the input and the person who needs it.'],
  ['Build the smallest useful path', 'Trigger → check required fields → send the request to its reviewer. Keep the path understandable.'],
  ['Test the handoff and the gap', 'Try one complete request and one missing a required field. Check that a person can see what needs attention.']
];
function learning(state) {
  return `<ol class="artifact-practice">${practice.map(([title, description], index) => `<li class="artifact-practice-step${state.steps & 1 << index ? ' artifact-practice-complete' : ''}"><span class="artifact-step-number" aria-hidden="true">${state.steps & 1 << index ? '✓' : String(index + 1).padStart(2, '0')}</span><div><h4>${title}</h4><p>${description}</p></div></li>`).join('')}</ol><p class="artifact-note"><strong>Teaching lens:</strong> A small, testable example lets someone practice the reasoning as well as the tool.</p>`;
}

const renderers = { retail, rxp, slides, playbooks, adoption, learning };
const controls = (id) => ({
  retail: button(id, 'routine', 'Product question', true) + button(id, 'handoff', 'Exception request', false),
  rxp: button(id, 'all', 'All delivery work', true) + button(id, 'review', 'Review dependencies', false),
  slides: button(id, 'inputs', 'Reporting structure', true) + button(id, 'compiled', 'Compile example', false),
  playbooks: button(id, 'market-a', 'Example market A', true) + button(id, 'market-b', 'Example market B', false) + button(id, 'check', 'Check batch readiness'),
  adoption: button(id, 'counts', 'Participant counts', true) + button(id, 'rate', 'Participation rate', false),
  learning: practice.map(([title], n) => button(id, `step-${n + 1}`, `${n + 1}. ${title}`, false)).join('')
}[id]);

function status(id, state) {
  if (id === 'retail') return state.mode === 'handoff' ? 'Exception example: offer a human handoff.' : 'Product-question example: guidance with feedback and an available handoff.';
  if (id === 'rxp') return state.mode === 'review' ? 'Showing two illustrative review dependencies.' : 'Showing all four illustrative delivery work items.';
  if (id === 'slides') return state.mode === 'compiled' ? 'Example compiled. Dummy values are organized into a slide with a decision prompt.' : 'Showing the reporting structure before compilation.';
  if (id === 'playbooks') return !state.checked ? `Example market ${state.market.toUpperCase()} selected. Run the readiness check.` : state.market === 'a' ? 'Example market A: inputs reconcile; stakeholder review can continue.' : 'Example market B: totals disagree and context is missing; hold the batch.';
  if (id === 'adoption') return state.mode === 'rate' ? 'Showing dummy rates: 20, 30, 45, and 60 percent of an example group of 40.' : 'Showing dummy counts: 8, 12, 18, and 24 people in an example group of 40.';
  const count = [1, 2, 4].filter(bit => state.steps & bit).length;
  return `${count} of 3 practice steps checked.${count === 3 ? ' You have reviewed the example from input to failure case.' : ' Check each step as you reason through the example.'}`;
}

export const ProjectArtifacts = Object.freeze({
  render(id) {
    if (!Object.hasOwn(definitions, id)) return '';
    const definition = definitions[id];
    return `<figure class="artifact-figure" data-artifact-project="${id}" aria-labelledby="artifact-${id}-heading"><figcaption class="artifact-caption">Illustrative walkthrough — not a production screenshot.</figcaption><div class="artifact-heading"><div><p class="artifact-kicker">Inside the work / interactive illustration</p><h3 id="artifact-${id}-heading">${definition.title}</h3></div></div><p class="artifact-prompt">${definition.prompt}</p><div class="artifact-controls" role="group" aria-label="Explore the ${id === 'rxp' ? 'RXP delivery' : id} illustration">${controls(id)}</div><div class="artifact-canvas">${renderers[id](initial(id))}</div><p class="artifact-status" role="status" aria-live="polite" aria-atomic="true">${status(id, initial(id))}</p></figure>`;
  },
  handle(action, id, rootElement) {
    if (!Object.hasOwn(definitions, id) || !rootElement?.querySelector) return false;
    const figure = rootElement.querySelector(`figure.artifact-figure[data-artifact-project="${id}"]`);
    if (!figure) return false;
    const state = states.get(figure) || initial(id);
    const modes = { retail: ['routine', 'handoff'], rxp: ['all', 'review'], slides: ['inputs', 'compiled'], adoption: ['counts', 'rate'] };
    if (modes[id]?.includes(action)) state.mode = action;
    else if (id === 'playbooks' && ['market-a', 'market-b'].includes(action)) { state.market = action.slice(-1); state.checked = false; }
    else if (id === 'playbooks' && action === 'check') state.checked = true;
    else if (id === 'learning' && /^step-[123]$/.test(action)) state.steps ^= 1 << (Number(action.slice(-1)) - 1);
    else return false;
    states.set(figure, state);
    figure.querySelector('.artifact-canvas').innerHTML = renderers[id](state);
    figure.querySelector('.artifact-status').textContent = status(id, state);
    figure.querySelectorAll('button[data-artifact-action][aria-pressed]').forEach(control => {
      const value = control.dataset.artifactAction;
      const pressed = id === 'playbooks' ? value === `market-${state.market}` : id === 'learning' ? Boolean(state.steps & 1 << (Number(value.slice(-1)) - 1)) : value === state.mode;
      control.setAttribute('aria-pressed', String(pressed));
    });
    return true;
  }
});
