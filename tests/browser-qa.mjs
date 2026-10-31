// Optional real-browser QA. Install Playwright + its Chromium binary locally,
// run `npm run build`, then `node tests/browser-qa.mjs`.
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

let playwright;
try { playwright = await import('playwright'); }
catch {
  const modules = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES || '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules';
  playwright = await import(pathToFileURL(path.join(modules, 'playwright/index.mjs')).href);
}
const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'tmp/browser-qa');
await mkdir(output, { recursive: true });
const browser = await playwright.chromium.launch({
  headless: process.env.AXO_HEADED !== '1',
  ...(process.env.AXO_BROWSER_PATH ? { executablePath: process.env.AXO_BROWSER_PATH } : {}),
  args: ['--enable-webgl', '--ignore-gpu-blocklist', ...(process.env.AXO_SOFTWARE_GL === '1' ? ['--use-angle=swiftshader'] : [])]
});
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  const url = pathToFileURL(path.join(root, 'AXO-World.html')).href;
  await page.goto(url);
  await page.waitForFunction(() => window.AXO);
  await page.waitForTimeout(450);
  const renderer = await page.evaluate(() => window.AXO.getState().renderer);
  assert.equal(renderer, 'webgl', 'the browser QA run must exercise actual WebGL');
  assert.equal(await page.locator('.world-stage [data-destination]').count(), 6, 'all six buildings need controls');
  assert.equal(await page.locator('#project-nav [data-destination]').count(), 6, 'all six projects need persistent navigation');
  assert.equal(await page.locator('#live-story').isVisible(), true, 'the project banner must remain visible');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'desktop horizontal overflow');
  assert.equal(await page.evaluate(() => window.AXO.getState().build), 'axo-world');
  assert.equal(await page.locator('[data-scroll-project]').count(), 6);
  assert.equal(await page.locator('[data-fallback-building]').count(), 6);
  const startState = await page.evaluate(() => window.AXO.getState());
  assert.equal(startState.character?.display, 'intro');
  assert.equal(startState.character?.expression, 'friendly');
  const startAzimuth = startState.azimuth;
  const startRotation = startState.journey.worldRotation;
  const startRider = [startState.journey.position[0], startState.journey.position[2]];
  const startCanvas = await page.locator('#world-canvas').boundingBox();
  assert.ok(Math.abs(startCanvas.x + startCanvas.width / 2 - 720) <= 2, 'desktop town canvas must be centered in the viewport');
  assert.ok(Math.abs(startCanvas.y + startCanvas.height / 2 - 500) <= 2, 'desktop cinema fills the viewport vertically');
  await page.screenshot({ path: path.join(output, 'desktop-start.png') });
  await page.locator('#world-discovery > summary').click();
  const starInteractions = await page.evaluate(() => window.AXO.getState().cosmos.interactions);
  await page.locator('[data-effect=stars]').click();
  assert.equal(await page.evaluate(() => window.AXO.getState().cosmos.interactions), starInteractions + 1);
  await page.locator('[data-effect=flowers]').click();
  await page.locator('[data-effect=water]').click();
  await page.locator('#world-discovery > summary').click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(output, 'desktop-water-interaction.png') });
  await page.evaluate(() => window.AXO.scrollToProject('slides'));
  await page.waitForFunction(() => Math.abs(window.AXO.getState().scrollProgress - .5) < .002 && !window.AXO.getState().journey?.transitioning);
  assert.equal(await page.evaluate(() => window.AXO.getState().character?.projectId), 'slides', 'the robot chest must commit the physically reached project');
  await page.waitForFunction(() => window.AXO.getState().character?.settlePhase === 'visitor');
  assert.equal(await page.evaluate(() => window.AXO.getState().character?.expression), 'friendly');
  assert.equal(await page.locator('#axo-location').innerText(), 'At Slide Studio');
  const stage = await page.locator('#world-stage').boundingBox();
  assert.ok(stage.y >= 0 && stage.y < 100, 'desktop town must remain visible while chapters scroll');
  const middleCanvas = await page.locator('#world-canvas').boundingBox();
  assert.ok(Math.abs(middleCanvas.x + middleCanvas.width / 2 - 720) <= 2, 'desktop town remains horizontally centered');
  const middleState = await page.evaluate(() => window.AXO.getState());
  assert.equal(middleState.azimuth, startAzimuth, 'scroll leaves the camera fixed');
  assert.notEqual(middleState.journey.worldRotation, startRotation, 'scroll turns the town root');
  assert.deepEqual([middleState.journey.position[0], middleState.journey.position[2]], startRider, 'AXO remains anchored in the foreground');
  await page.screenshot({ path: path.join(output, 'desktop-middle.png') });
  await page.evaluate(() => window.AXO.scrollToProject('learning'));
  await page.waitForFunction(() => window.AXO.getState().scrollProgress > .998 && !window.AXO.getState().journey?.transitioning);
  for (const id of ['retail','rxp','slides','playbooks','adoption','learning']) {
    assert.equal(await page.locator(`#nav-${id}`).isVisible(), true, `${id} must remain visible when the world turns`);
  }
  assert.equal(await page.locator('#live-story').isVisible(), true);
  await page.screenshot({ path: path.join(output, 'desktop-end.png') });

  await page.locator('#nav-playbooks').hover();
  await page.locator('#project-preview').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#preview-visit').getAttribute('data-destination'), 'playbooks');
  const previewRoute = await page.evaluate(() => location.hash);
  await page.locator('#nav-rxp').focus();
  assert.equal(await page.locator('#preview-visit').getAttribute('data-destination'), 'rxp');
  assert.equal(await page.evaluate(() => location.hash), previewRoute, 'hover and keyboard previews must not navigate');
  await page.locator('#preview-close').click();

  await page.evaluate(() => window.AXO.scrollToProject('slides'));
  await page.waitForFunction(() => window.AXO.getState().currentLocation.status === 'at' && window.AXO.getState().currentLocation.projectId === 'slides');
  await page.locator('#rotate-right').click();
  const returnAngle = await page.evaluate(() => window.AXO.getState().journey.worldRotation);
  await page.locator('#journey-detail').click();
  await page.waitForFunction(() => location.hash === '#work/slides' && window.AXO.getState().reading);
  const frozen = await page.evaluate(() => ({ rotation: window.AXO.getState().journey.worldRotation, fins: window.AXO.getState().character.gillFlex }));
  await page.waitForTimeout(250);
  assert.deepEqual(await page.evaluate(() => ({ rotation: window.AXO.getState().journey.worldRotation, fins: window.AXO.getState().character.gillFlex })), frozen, 'reading must freeze the scene');
  assert.equal(await page.evaluate(() => window.AXO.getState().cosmos.framePending), false);
  await page.evaluate(() => history.back());
  await page.waitForFunction(() => location.hash === '#place/slides' && !window.AXO.getState().reading);
  assert.ok(Math.abs(await page.evaluate(() => window.AXO.getState().journey.worldRotation) - returnAngle) < 1e-6, 'Back preserves the manual orientation');
  assert.equal(await page.locator('#journey-detail').evaluate(element => element === document.activeElement), true);
  await page.evaluate(() => history.forward());
  await page.waitForFunction(() => location.hash === '#work/slides' && window.AXO.getState().reading);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => location.hash === '#place/slides' && !window.AXO.getState().reading);

  const collisions = await page.evaluate(() => {
    const banner = document.querySelector('#live-story').getBoundingClientRect();
    return [...document.querySelectorAll('.building-tag')].filter(element => getComputedStyle(element).visibility !== 'hidden').filter(element => {
      const rect = element.getBoundingClientRect(); return rect.left < banner.right && rect.right > banner.left && rect.top < banner.bottom && rect.bottom > banner.top;
    }).map(element => element.id);
  });
  assert.deepEqual(collisions, [], 'visible building labels must not overlap the banner');

  for (const id of ['retail', 'rxp', 'slides', 'playbooks', 'adoption', 'learning']) {
    await page.evaluate((project) => window.AXO.visit(project), id);
    await page.locator('#content-panel').waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => window.AXO.getState().activeProject), id);
    assert.ok((await page.locator('#panel-body').innerText()).trim().length > 100);
    for (const section of ['problem','contribution','approach','outcome']) assert.equal(await page.locator(`#case-${section}`).isVisible(), true);
    assert.equal(await page.locator('figure.artifact-figure').count(), 1);
    assert.match(await page.locator('.artifact-caption').innerText(), /Illustrative walkthrough.*not a production screenshot/);
    assert.ok(await page.locator('#case-problem > p:last-child').evaluate(element => parseFloat(getComputedStyle(element).fontSize)) >= 15, 'case-study body type must be readable');
    assert.equal(await page.locator('#content-panel').evaluate(element => element.scrollWidth > element.clientWidth + 1), false, 'case studies must not overflow horizontally');
    await page.keyboard.press('Escape');
    await page.locator('#content-panel').waitFor({ state: 'hidden' });
    await page.waitForFunction(() => !window.AXO.getState().reading && !location.hash.startsWith('#work/'));
  }
  await page.locator('[data-panel=work]').first().click();
  await page.locator('#project-search').fill('governance');
  assert.equal(await page.locator('[data-project-card]:visible').count(), 1);
  await page.locator('#reset-project-filters').click();
  await page.locator('[data-project-card=retail] [data-save-project=retail]').click();
  await page.locator('[data-project-card=rxp] [data-save-project=rxp]').click();
  await page.locator('#compare-projects').click();
  assert.equal(await page.locator('.comparison-card').count(), 2);
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#download-shortlist').click()]);
  assert.match(await readFile(await download.path(), 'utf8'), /business case/i);
  await page.screenshot({ path: path.join(output, 'desktop-compare.png') });
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'mobile horizontal overflow');
  await page.evaluate(() => window.AXO.scrollToProject('slides'));
  await page.waitForFunction(() => Math.abs(window.AXO.getState().scrollProgress - .5) < .002 && !window.AXO.getState().journey?.transitioning);
  const mobileStage = await page.locator('#world-stage').boundingBox();
  assert.ok(mobileStage.y >= -2 && mobileStage.y < 30, 'mobile town remains at the top of the viewport');
  const mobileCanvas = await page.locator('#world-canvas').boundingBox();
  assert.ok(Math.abs(mobileCanvas.x + mobileCanvas.width / 2 - 195) <= 2, 'mobile town canvas must be centered');
  await page.screenshot({ path: path.join(output, 'mobile-middle.png') });
  const caseStudy = page.locator('#journey-detail');
  assert.equal(await caseStudy.getAttribute('data-project'), 'slides', 'the live caption opens the selected project');
  await caseStudy.click();
  await page.locator('#content-panel').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#content-panel').evaluate(element => element.scrollWidth > element.clientWidth + 1), false);
  assert.ok(await page.locator('#case-problem > p:last-child').evaluate(element => parseFloat(getComputedStyle(element).fontSize)) >= 15);
  await page.screenshot({ path: path.join(output, 'mobile-case-study.png') });
  await page.keyboard.press('Escape');
  assert.equal(await caseStudy.evaluate(element => element === document.activeElement), true, 'native modal close must return focus');

  const deepPage = await context.newPage();
  deepPage.on('pageerror', error => errors.push(error.message));
  await deepPage.goto(`${url}#work/playbooks`);
  await deepPage.waitForFunction(() => window.AXO?.getState().activeProject === 'playbooks' && window.AXO.getState().reading);
  assert.equal(await deepPage.locator('figure.artifact-figure').count(), 1);
  await deepPage.keyboard.press('Escape');
  await deepPage.waitForFunction(() => location.hash === '#place/playbooks' && !window.AXO.getState().reading);
  assert.ok(deepPage.url().startsWith(url), 'closing a cold local link must remain in the same document');
  await deepPage.close();

  const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const touchPage = await touchContext.newPage();
  touchPage.on('pageerror', error => errors.push(error.message));
  await touchPage.goto(url); await touchPage.waitForFunction(() => window.AXO);
  const touchHistory = await touchPage.evaluate(() => history.length);
  await touchPage.tap('#nav-slides');
  await touchPage.waitForFunction(() => location.hash === '#place/slides' && window.AXO.getState().currentLocation.projectId === 'slides');
  assert.equal(await touchPage.evaluate(() => history.length), touchHistory + 1, 'one touch must create one destination visit');
  assert.equal(await touchPage.locator('#project-preview').isVisible(), false);
  await touchPage.tap('#project-preview-toggle');
  assert.equal(await touchPage.locator('#project-preview').isVisible(), true);
  assert.equal(await touchPage.locator('#preview-visit').getAttribute('data-destination'), 'slides');
  await touchContext.close();

  const fallback = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await fallback.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      return /webgl/i.test(type) ? null : original.call(this, type, ...args);
    };
  });
  const fallbackPage = await fallback.newPage();
  fallbackPage.on('pageerror', (error) => errors.push(error.message));
  await fallbackPage.goto(url);
  await fallbackPage.waitForFunction(() => window.AXO);
  assert.deepEqual(await fallbackPage.evaluate(() => {
    const s = window.AXO.getState(); return [s.renderer, s.paused];
  }), ['illustration', true]);
  assert.equal(await fallbackPage.locator('[data-effect=flowers]').isDisabled(), true);
  assert.equal(await fallbackPage.locator('[data-effect=water]').isDisabled(), true);
  assert.equal(await fallbackPage.locator('[data-effect=stars]').isDisabled(), false);
  for (const id of ['retail', 'rxp', 'slides', 'playbooks', 'adoption', 'learning']) {
    await fallbackPage.evaluate((project) => window.AXO.visit(project), id);
    await fallbackPage.locator('#content-panel').waitFor({ state: 'visible' });
    assert.equal(await fallbackPage.evaluate(() => window.AXO.getState().activeProject), id);
    await fallbackPage.keyboard.press('Escape');
  }
  await fallbackPage.evaluate(() => window.AXO.scrollToProject('slides'));
  await fallbackPage.waitForFunction(() => Math.abs(window.AXO.getState().scrollProgress - .5) < .002);
  for (const id of ['retail','rxp','slides','playbooks','adoption','learning']) {
    assert.equal(await fallbackPage.locator(`#nav-${id}`).isVisible(), true, `${id} stays available without WebGL`);
  }
  await fallbackPage.screenshot({ path: path.join(output, 'mobile-fallback.png') });
  assert.deepEqual(errors, [], 'application scripts must not throw in the real browser');
  console.log('Browser QA passed: stone lake city, natural AXO gait, interactive stars, readable project stories and shortlist, persistent navigation, direct destination turn, native scroll chapters, full-viewport desktop/mobile scene, WebGL, six projects, overflow, native modal focus, fallback and reduced motion.');
  console.log(`Review screenshots in ${output}`);
} finally { await browser.close(); }
