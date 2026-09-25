// Optional integration check using an already running Chromium DevTools port.
// Run with: node scripts/browser-check.mjs [debug-port] [app-url] [evolved-save.json]
import assert from 'node:assert/strict';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const port = Number(process.argv[2] || 9225);
const app = process.argv[3] || 'http://127.0.0.1:4173';
const output = '/tmp/common-ground-check';
await mkdir(output, { recursive: true });
const target = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
const pending = new Map();
const errors = [];
let id = 0;
socket.onmessage = ({ data }) => {
  const message = JSON.parse(data);
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
  const callback = pending.get(message.id);
  if (callback) { pending.delete(message.id); message.error ? callback.reject(new Error(message.error.message)) : callback.resolve(message.result); }
};
function call(method, params = {}) { return new Promise((resolve, reject) => { const n = ++id; pending.set(n, { resolve, reject }); socket.send(JSON.stringify({ id: n, method, params })); }); }
async function evaluate(expression) {
  const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(expression, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) { if (await evaluate(expression)) return; await delay(100); }
  throw new Error(`Timed out: ${expression}`);
}
async function click(selector) { await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`); }
const dayExpression = `Number(document.querySelector('#day-badge').textContent.replace(/\\D/g, ''))`;
const day = () => evaluate(dayExpression);
async function fileInput(path) {
  const { root } = await call('DOM.getDocument');
  const { nodeId } = await call('DOM.querySelector', { nodeId: root.nodeId, selector: '#import-file' });
  await call('DOM.setFileInputFiles', { nodeId, files: [path] });
}

try {
  await call('Page.enable');
  await call('Runtime.enable');
  await call('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: output });
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  await call('Page.navigate', { url: app });
  await until(`document.querySelector('#loading')?.hidden`);
  assert.ok(await evaluate(`Number(document.querySelector('#population').textContent) > 0`));
  await click('#play-btn');
  await until(`document.querySelector('#play-btn').getAttribute('aria-label') === 'Resume simulation'`);
  const pausedDay = await day();
  await delay(450);
  assert.equal(await day(), pausedDay, 'pause freezes simulation');
  await click('#step-btn');
  await until(`${dayExpression} === ${pausedDay + 1}`);
  await click('[data-speed="20"]');
  await click('#play-btn');
  await delay(1100);
  await click('#play-btn');
  assert.ok(await day() > pausedDay + 30, 'fast forward advances many days');
  console.log('PASS: load, pause, single step, fast-forward.');

  await click('[data-tab="individuals"]');
  await until(`document.querySelector('.people-row')`);
  await click('.people-row');
  await until(`document.querySelector('.person-title')`);
  assert.ok(await evaluate(`document.querySelectorAll('.need-row').length === 4`));
  assert.ok(await evaluate(`document.querySelector('.mind-goal')?.textContent.length > 10`), 'person has an internal goal');
  assert.ok(await evaluate(`document.querySelector('.mind-policy .policy-reason')?.textContent.length > 10`), 'decision has an explanation');
  assert.equal(await evaluate(`document.querySelectorAll('.skill-row').length`), 8, 'all learned skills are inspectable');
  assert.ok(await evaluate(`document.querySelector('.mind-values')?.textContent.includes('Security')`), 'individual values are inspectable');
  assert.ok(await evaluate(`document.querySelector('.mind-beliefs')?.textContent.includes('Trust')`), 'individual beliefs are inspectable');
  await click('#follow-btn');
  assert.equal(await evaluate(`document.querySelector('#follow-btn').textContent`), 'Follow this life ↗');
  await click('#follow-btn');
  assert.equal(await evaluate(`document.querySelector('#follow-btn').textContent`), 'Stop following');
  await click('[data-overlay="food"]');
  assert.equal(await evaluate(`document.querySelector('[data-overlay="food"]').getAttribute('aria-pressed')`), 'true');
  await click('#conditions-btn');
  await evaluate(`{const input=document.querySelector('#abundance');input.value='.5';input.dispatchEvent(new Event('input'));input.dispatchEvent(new Event('change'));}`);
  await click('[data-intervention="rain"]');
  await until(`document.querySelector('#toast').textContent.includes('Rain')`);
  await click('#conditions-dialog [data-close]');
  await click('[data-overlay="knowledge"]');
  assert.equal(await evaluate(`document.querySelector('[data-overlay="knowledge"]').getAttribute('aria-pressed')`), 'true');
  await click('[data-overlay="relations"]');
  assert.equal(await evaluate(`document.querySelector('[data-overlay="relations"]').getAttribute('aria-pressed')`), 'true');
  await click('[data-overlay="industry"]');
  assert.equal(await evaluate(`document.querySelector('[data-overlay="industry"]').getAttribute('aria-pressed')`), 'true');
  for (const panel of ['inventions', 'beliefs', 'relations']) {
    await click(`[data-civilization-tab="${panel}"]`);
    assert.equal(await evaluate(`document.querySelector('#civilization-tab-${panel}').getAttribute('aria-selected')`), 'true');
    assert.ok(await evaluate(`document.querySelector('#civilization-content').textContent.length > 30`), `${panel} shows real state or honest empty state`);
  }
  await click('[data-civilization-tab="knowledge"]');
  await until(`document.querySelectorAll('.technology-card').length > 3`);
  await click('[data-civilization-tab="industry"]');
  await until(`document.querySelector('#civilization-tab-industry').getAttribute('aria-selected') === 'true'`);
  assert.ok(await evaluate(`document.querySelector('#civilization-content').textContent.length > 30`), 'industry view shows model state');
  await click('[data-civilization-tab="knowledge"]');
  await click('[data-tab="conversations"]');
  assert.ok(await evaluate(`document.querySelector('#observation-content').textContent.length > 20`), 'voices view provides conversations or honest empty state');
  console.log('PASS: cognition, learned skills, follow, material/communication/relation overlays, inventions, beliefs, relations, foundations, industry and voices.');

  const testSeed = `browser-check-${Date.now()}`;
  await click('#new-btn');
  assert.equal(await evaluate(`document.querySelector('#founders-input').getAttribute('max')`), null, 'founder input has no numerical ceiling');
  await evaluate(`document.querySelector('#seed-input').value=${JSON.stringify(testSeed)};document.querySelector('#founders-input').value='24';document.querySelector('#world-size').value='large';document.querySelector('#new-form').requestSubmit()`);
  await until(`!document.querySelector('#new-dialog').open && document.querySelector('#world-seed').textContent.includes(${JSON.stringify(testSeed.toUpperCase())})`);
  await click('#play-btn');
  await until(`document.querySelector('#play-btn').getAttribute('aria-label') === 'Resume simulation'`);
  await click('#save-btn');
  await until(`document.querySelector('#toast').textContent.includes('exported')`);
  await delay(500);
  const files = await readdir(output);
  const saveFile = files.filter(file => file.startsWith(`common-ground-${testSeed}`) && file.endsWith('.json')).sort().at(-1);
  assert.ok(saveFile, 'world exported to JSON');
  const saved = JSON.parse(await readFile(join(output, saveFile), 'utf8'));
  assert.equal(saved.format, 'common-ground');
  assert.equal(saved.simulation.seed, testSeed);
  assert.equal(saved.simulation.version, 7);
  assert.equal(saved.simulation.width, 224);
  assert.equal(saved.simulation.height, 144);
  assert.equal(saved.simulation.config.size, 'large');
  assert.ok(!('maxPopulation' in saved.simulation.config), 'no population ceiling in exported config');
  assert.ok(saved.simulation.innovation && saved.simulation.diplomacy, 'generated knowledge and diplomacy survive export');
  assert.ok(saved.simulation.agents.every(agent => agent.mind && agent.skills && Array.isArray(agent.knowledge)), 'individual minds survive export');
  await call('Page.reload');
  await until(`document.querySelector('#loading')?.hidden && document.querySelector('#world-seed').textContent.includes(${JSON.stringify(testSeed.toUpperCase())})`);
  await fileInput(join(output, saveFile));
  await until(`document.querySelector('#toast').textContent.includes('World restored and paused')`);
  assert.equal(await day(), saved.simulation.day + 1, 'import restores exact day');
  assert.equal(await evaluate(`document.querySelector('#play-btn').getAttribute('aria-label')`), 'Resume simulation');
  const invalidPath = join(output, 'invalid.json');
  await writeFile(invalidPath, JSON.stringify({ format: 'common-ground', version: 1, simulation: {} }));
  await fileInput(invalidPath);
  await delay(300);
  assert.equal(await day(), saved.simulation.day + 1, 'malformed import does not change world');
  console.log('PASS: large world, version 7 JSON export, autosave reload, exact import, malformed save rejection.');

  // Exercise a real v1-shaped compact save through the user-facing importer.
  const legacy = await evaluate(`(async()=>{
    const {Simulation}=await import('./src/simulation.js');
    const simulation=new Simulation({seed:'browser-legacy-migration',size:'compact',population:24}).serialize();
    simulation.version=1;delete simulation.config.size;delete simulation.civilization;delete simulation.regions;delete simulation.innovation;delete simulation.diplomacy;simulation.config.maxPopulation=600;
    for(const agent of simulation.agents){delete agent.mind;delete agent.skills;delete agent.knowledge;delete agent.ideas;delete agent.convictions;}
    for(const group of simulation.groups)delete group.civilization;
    for(const tile of simulation.tiles){delete tile.fertility;delete tile.stone;delete tile.ore;delete tile.soil;}
    return {format:'common-ground',version:1,simulation};
  })()`);
  const legacyPath = join(output, 'legacy.json');
  await writeFile(legacyPath, JSON.stringify(legacy));
  await fileInput(legacyPath);
  await until(`document.querySelector('#world-seed').textContent.includes('BROWSER-LEGACY-MIGRATION')`);
  await click('[data-tab="individuals"]');
  await click('.people-row');
  await until(`document.querySelectorAll('.skill-row').length === 8`);
  assert.ok(await evaluate(`document.querySelector('.mind-goal')?.textContent.length > 10`), 'legacy agents receive a mind');
  assert.ok(await evaluate(`document.querySelector('.mind-convictions')?.textContent.includes('Convictions')`), 'legacy agents receive inspectable convictions');
  await fileInput(join(output, saveFile));
  await until(`document.querySelector('#world-seed').textContent.includes(${JSON.stringify(testSeed.toUpperCase())})`);
  await until(`document.querySelector('#toast').textContent.includes('World restored and paused')`);
  console.log('PASS: legacy world imports without resetting its seed or losing person inspection.');

  if (process.argv[4]) {
    const evolved = JSON.parse(await readFile(process.argv[4], 'utf8')).simulation;
    const inventions = evolved.innovation.discoveries.filter(idea => idea.kind === 'invention');
    const beliefs = evolved.innovation.discoveries.filter(idea => idea.kind === 'belief');
    assert.ok(inventions.length && beliefs.length && evolved.diplomacy.relations.length, 'evolved fixture contains real inventions, beliefs, and relations');
    await fileInput(process.argv[4]);
    await until(`document.querySelector('#world-seed').textContent.includes(${JSON.stringify(evolved.seed.toUpperCase())})`);
    await click('[data-civilization-tab="inventions"]');
    assert.ok(await evaluate(`document.querySelector('.idea-card.invention .recipe-line')?.textContent.length > 5`), 'generated design recipes are visible');
    assert.ok(await evaluate(`document.querySelector('.idea-card.invention .effect')`), 'quantitative invention effects are visible');
    assert.ok(await evaluate(`document.querySelector('.idea-card.invention .idea-lineage')`), 'design lineage is visible');
    await evaluate(`{const input=document.querySelector('#ideas-search');input.value=${JSON.stringify(inventions[0].id)};input.dispatchEvent(new Event('input',{bubbles:true}));input.blur();}`);
    assert.ok(await evaluate(`document.querySelector('[data-idea-id="${inventions[0].id}"]')`), 'historical designs can be found through search');
    await click('[data-civilization-tab="beliefs"]');
    assert.ok(await evaluate(`document.querySelector('.idea-card.belief .doctrine-grid meter')`), 'actual invented doctrine parameters are visible');
    await click('[data-civilization-tab="relations"]');
    assert.equal(await evaluate(`document.querySelectorAll('.relation-card').length`), evolved.diplomacy.relations.length, 'diplomacy shows actual recorded relations');
    await click('[data-overlay="relations"]');
    const believer = evolved.agents.find(agent => Object.keys(agent.convictions || {}).length);
    if (believer) {
      await click('[data-tab="individuals"]');
      await evaluate(`{const input=document.querySelector('#people-search');input.value=${JSON.stringify(believer.name)};input.dispatchEvent(new Event('input',{bubbles:true}));}`);
      await click(`[data-person="${believer.id}"]`);
      assert.ok(await evaluate(`document.querySelector('.conviction-row')`), 'personal convictions are inspectable');
    }
    await click('#reset-view');
    await click('[data-civilization-tab="inventions"]');
    await evaluate(`document.querySelector('#toast').hidden=true`);
    await delay(300);
    const developedShot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    await writeFile(join(output, 'developed-open-inventions.png'), Buffer.from(developedShot.data, 'base64'));
    console.log(`PASS: developed world with ${inventions.length} generated designs, ${beliefs.length} beliefs and ${evolved.diplomacy.relations.length} diplomatic relations; recipes, effects, search, lineage, doctrine and convictions.`);
  }

  await click('[data-overlay="natural"]');
  await click('[data-tab="chronicle"]');
  await click('#reset-view');
  await evaluate(`document.querySelector('#toast').hidden=true`);
  await delay(350);
  let screenshot = await call('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(output, 'desktop.png'), Buffer.from(screenshot.data, 'base64'));
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 1200, deviceScaleFactor: 1, mobile: true });
  await delay(400);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true, 'mobile has no horizontal overflow');
  for (const panel of ['inventions', 'beliefs', 'relations', 'knowledge', 'industry']) {
    await click(`[data-civilization-tab="${panel}"]`);
    assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true, `mobile ${panel} view has no horizontal overflow`);
  }
  await click('[data-civilization-tab="inventions"]');
  screenshot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  await writeFile(join(output, 'mobile.png'), Buffer.from(screenshot.data, 'base64'));
  assert.deepEqual(errors, [], 'no unhandled browser errors');
  console.log(`PASS: responsive layout, no unhandled browser errors. Screenshots: ${output}`);
} finally {
  await call('Page.close').catch(() => {});
  socket.close();
}
