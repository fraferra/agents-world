import { WorldView } from './world-view.js';
import { envelope, loadWorld, storeWorld, unwrap } from './storage.js';
import { TECHNOLOGIES, SKILLS, BUILDINGS } from './civilization.js';
import { innovationEffects } from './innovation.js';
import { TECHNIQUES, PERSONALITY, EMOTIONS, activityLabel } from './psyche.js';
import { ACTS } from './acts.js';
import { NORMS, TIERS } from './culture.js';
import { claimRadius, organisationalCapacity } from './expansion.js';
import { ECONOMIES, economyOf, gini } from './economy.js';
import { careLevel, diseaseLoad } from './lifecourse.js';
import { RESOURCE_INFO } from './resources.js';
import { CAUSES, GOALS } from './conflict.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const number = value => Math.round(value || 0).toLocaleString();
const color = value => /^#[0-9a-f]{6}$/i.test(value) ? value : '#81956a';
const DAYS = 120;
const techById = new Map(TECHNOLOGIES.map(technology => [technology.id, technology]));
const title = value => String(value ?? '').replace(/[_-]/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
const percent = value => Math.max(0, Math.min(100, Number(value) || 0));
const techName = id => techById.get(id)?.name || title(id);
const practiceById = new Map(TECHNIQUES.map(technique => [technique.id, technique]));
const signed = value => `${value >= 0 ? '+' : '−'}${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 1 })}`;
const PERSONALITY_LABELS = { openness: ['Conventional', 'Open to new ideas'], conscientiousness: ['Spontaneous', 'Diligent'], extraversion: ['Reserved', 'Outgoing'], agreeableness: ['Competitive', 'Agreeable'], neuroticism: ['Steady', 'Sensitive'] };
const EMOTION_SYMBOLS = { joy: '☀', pride: '✦', fear: '◔', anger: '✕', grief: '☂' };
const PLACE_NAMES = { food: 'foraging ground', wood: 'woodland', stone: 'stone deposit', ore: 'ore deposit', clay: 'clay bank', fiber: 'reed bed', herbs: 'herb patch', gems: 'gem seam', game: 'hunting ground', fish: 'fishing ground' };
function nearestRegion(point) {
  let best = null, closest = Infinity;
  for (const region of snapshot?.regions || []) { const d = Math.hypot(region.x - point.x, region.y - point.y); if (d < closest) { closest = d; best = region; } }
  return best;
}
const decimal = value => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 1 });
const paths = {
  people: '<circle cx="9" cy="7" r="3"/><path d="M3 20v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5v2"/>',
  village: '<path d="m2 12 6-5 6 5M4 11v9h8v-9M7 20v-5h2v5m4-12 4-4 5 5m-7 2v9h6V8M16 13h2"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  sprout: '<path d="M12 22V12m0 6C4 18 3 9 3 9s10-1 9 9Zm0-5C11 4 21 3 21 3s1 10-9 10Z"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5"/>',
  sliders: '<path d="M4 5h6m4 0h6M4 12h11m4 0h1M4 19h2m4 0h10M10 2v6m5 1v6M6 16v6"/>',
  pause: '<path d="M8 5v14M16 5v14" stroke-width="3"/>',
  play: '<path d="m7 4 14 8-14 8Z" fill="currentColor" stroke="none"/>',
  step: '<path d="m3 5 11 7-11 7Z"/><path d="M19 5v14"/>',
  rain: '<path d="M5 15a4 4 0 0 1-.5-8A6 6 0 0 1 16 5a5 5 0 0 1 2 10M8 18l-1 3m6-3-1 3m6-3-1 3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
  snow: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 2 3-2M9 20l3-2 3 2"/>',
  leaf: '<path d="M5 19c0-9 6-14 15-15-1 9-6 15-15 15Zm0 0 7-7"/>',
  plague: '<circle cx="12" cy="12" r="6"/><circle cx="10" cy="10.5" r="1.2"/><circle cx="14" cy="13.5" r="1"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  spark: '<path d="M12 2v6m0 8v6M2 12h6m8 0h6M5 5l4 4m6 6 4 4M5 19l4-4m6-6 4-4"/>',
  quake: '<path d="M2 12h4l2-5 3 10 3-12 3 9 2-2h3"/>',
  flame: '<path d="M12 22c4 0 7-3 7-7 0-5-5-7-5-12-3 2-4 5-4 7-1-1-2-2-2-4-2 2-3 5-3 9 0 4 3 7 7 7Z"/>',
  wave: '<path d="M2 9c3-3 5 3 8 0s5 3 8 0 4 0 4 0M2 15c3-3 5 3 8 0s5 3 8 0 4 0 4 0"/>',
  gem: '<path d="m6 3h12l4 6-10 12L2 9Z"/><path d="M2 9h20M9 3 7 9l5 12 5-12-2-6"/>',
};
function icon(name) { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.sprout}</svg>`; }
$$('[data-icon]').forEach(element => { element.innerHTML = icon(element.dataset.icon); });

let snapshot = null;
let running = true;
let speed = 1;
let ready = false;
let selectedId = null;
let following = false;
let tab = 'chronicle';
let peopleQuery = '';
let civilizationTab = 'inventions';
let civilizationSociety = 'all';
let ideasQuery = '';
let ideaPage = 0;
let lastSidebar = 0;
let lastChart = -1;
let saving = false;
let saveAgain = false;
let toastTimer;
let requestId = 0;
let lastSaveDay = -1;
const pending = new Map();
const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });

function request(type, payload) {
  const id = ++requestId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('The world took too long to respond.')); }, 30000);
    pending.set(id, { resolve, reject, timer });
    worker.postMessage({ id, type, payload });
  });
}

function toast(message, duration = 4500) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, duration);
}

function report(error) { console.error(error); toast(error.message || String(error), 7000); }
function act(fn) { return event => { try { Promise.resolve(fn(event)).catch(report); } catch (error) { report(error); } }; }
function calendar(day) { return `Year ${number(Math.floor(day / DAYS) + 1)} · Day ${day % DAYS + 1}`; }

const view = new WorldView($('#world-canvas'), {
  onSelect: id => selectAgent(id),
  onGround: point => {
    if (!snapshot?.player?.id) return false;
    order({ kind: 'move', x: point.x, y: point.y });
    return true;
  },
  onHover: agent => {
    const tooltip = $('#map-tooltip');
    tooltip.hidden = !agent;
    if (agent) tooltip.innerHTML = `<strong>${escape(agent.name)}</strong><br><span>${Math.floor(agent.age)} years old · ${escape(agent.action)}</span>${agent.psyche?.thought ? `<br><em>“${escape(agent.psyche.thought)}”</em>` : ''}`;
  },
});
$('#world-canvas').addEventListener('pointermove', event => {
  const box = event.currentTarget.getBoundingClientRect();
  const tooltip = $('#map-tooltip');
  const x = Math.min(box.width - 195, Math.max(0, event.clientX - box.left));
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${Math.max(75, event.clientY - box.top - 10)}px`;
});
$('#world-canvas').addEventListener('pointerleave', () => { $('#map-tooltip').hidden = true; });

// The page keeps one copy of the map and of the idea registry and updates them in
// place: tiles arrive as typed arrays every few seconds, ideas only when new.
let tileStore = [];
let ideaRegistry = [];
let advanceRegistry = [];
const TERRAIN_NAMES = ['water', 'grass', 'forest', 'sand', 'mountain'];
let tilesVersion = 0;
function absorb(next, packed) {
  if (packed) {
    tilesVersion++;
    if (packed.terrain) tileStore = Array.from({ length: packed.length }, (_, i) => ({ terrain: TERRAIN_NAMES[packed.terrain[i]], elevation: packed.elevation[i], fertility: packed.fertility[i] }));
    for (const [key, values] of Object.entries(packed.fields)) for (let i = 0; i < values.length; i++) tileStore[i][key] = values[i];
  }
  next.tiles = tileStore;
  next.tilesVersion = tilesVersion;
  const innovation = next.innovation;
  if (innovation.discoveriesFrom === 0) ideaRegistry = innovation.discoveries;
  else for (const idea of innovation.discoveries) ideaRegistry.push(idea);
  innovation.discoveries = ideaRegistry;
  const advancesSent = next.breakthroughs;
  if (advancesSent.from === 0) advanceRegistry = advancesSent.list;
  else for (const entry of advancesSent.list) advanceRegistry.push(entry);
  advancesSent.list = advanceRegistry;
  return next;
}

worker.onmessage = ({ data }) => {
  if (data.type === 'snapshot') {
    snapshot = absorb(data.snapshot, data.tiles);
    running = data.running;
    speed = data.speed;
    view.setSnapshot(snapshot);
    renderPlayer();
    render();
  } else if (data.type === 'fatal') {
    running = false;
    renderPlayback();
    toast(data.error, 12000);
  } else {
    const promise = pending.get(data.id);
    if (promise) {
      clearTimeout(promise.timer);
      pending.delete(data.id);
      data.ok ? promise.resolve(data.result) : promise.reject(new Error(data.error));
    }
  }
};
worker.onerror = event => {
  for (const { reject, timer } of pending.values()) { clearTimeout(timer); reject(new Error('The simulation worker could not start.')); }
  pending.clear();
  report(new Error(event.message || 'The simulation worker stopped. Reload to restore your saved world.'));
  $('#loading p').textContent = 'The world could not load. Try refreshing the page.';
};

function render() {
  const { stats, day, groups, agents } = snapshot;
  const seasonIndex = Math.floor(day % DAYS / 30);
  const season = ['Spring', 'Summer', 'Autumn', 'Winter'][seasonIndex];
  $('#world-calendar').innerHTML = `Year ${number(Math.floor(day / DAYS) + 1)} <span>· ${season}</span>`;
  $('#season-symbol').textContent = ['✳', '☀', '❧', '❄'][seasonIndex];
  $('#world-seed').textContent = `WORLD / ${snapshot.seed.toUpperCase()}`;
  $('#population').textContent = number(stats.population);
  $('#population-note').textContent = stats.population === 0 ? 'the world has fallen quiet' : `${number(stats.deaths)} lives remembered · resource limited`;
  $('#society-count').textContent = number(groups.length);
  $('#society-note').textContent = `${number(agents.filter(a => a.groupId !== null).length)} people belong`;
  $('#wellbeing').innerHTML = `${number(stats.happiness)}<small>%</small>`;
  $('#wellbeing-note').textContent = stats.happiness > 75 ? 'life is flourishing' : stats.happiness > 50 ? 'finding their balance' : stats.population ? 'needs under pressure' : 'no living individuals';
  $$('.wellbeing-dots i').forEach((dot, i) => { dot.style.background = stats.happiness > i * 20 ? '#a5b888' : '#e4e9d9'; });
  $('#births').textContent = number(stats.births);
  $('#generation-note').textContent = `generation ${number(stats.generation)}`;
  $('#world-extent').textContent = `${snapshot.width} × ${snapshot.height}`;
  $('#invention-count').textContent = number(stats.inventions);
  $('#belief-count').textContent = number(stats.beliefs);
  $('#technology-count').textContent = number(stats.technologies);
  $('#industry-count').textContent = number(stats.industries);
  $('#conversation-count').textContent = number(stats.conversations);
  $('#ideas-count').textContent = number(stats.ideasShared);
  $('#society-tab-count').textContent = groups.length;
  $('#day-badge').textContent = `DAY ${String(day + 1).padStart(3, '0')}`;
  const conditions = Object.entries(snapshot.conditions || {}).filter(([, days]) => days > 0);
  const badge = $('#condition-badge');
  badge.hidden = !conditions.length;
  badge.textContent = conditions.map(([name, days]) => `${{ rain: 'RAIN', drought: 'DROUGHT', winter: 'WINTER', plague: 'PLAGUE' }[name]} ${days}D`).join(' · ');
  const societySelect = $('#act-society'), societyKey = snapshot.groups.map(group => `${group.id}:${group.name}`).join(',');
  if (societySelect.dataset.groups !== societyKey && document.activeElement !== societySelect) {
    const current = societySelect.value;
    societySelect.innerHTML = '<option value="">Choose a society</option>' + [...snapshot.groups].sort((a, b) => b.members.length - a.members.length).map(group => `<option value="${group.id}">${escape(group.name)} · ${group.members.length}</option>`).join('');
    societySelect.value = snapshot.groups.some(group => String(group.id) === current) ? current : '';
    societySelect.dataset.groups = societyKey;
  }
  const regionSelect = $('#act-region'), regionKey = (snapshot.regions || []).map(region => region.id).join(',');
  if (regionSelect.dataset.regions !== regionKey && document.activeElement !== regionSelect) {
    const current = regionSelect.value;
    regionSelect.innerHTML = '<option value="">Let fate choose</option>' + (snapshot.regions || []).map(region => `<option value="${region.id}">${escape(region.name)}</option>`).join('');
    regionSelect.value = (snapshot.regions || []).some(region => String(region.id) === current) ? current : '';
    regionSelect.dataset.regions = regionKey;
  }
  renderPlayback();
  if (!running || performance.now() - lastSidebar > 650) {
    renderObservation();
    renderIndividual();
    renderCivilization();
    lastSidebar = performance.now();
  }
  if (lastChart !== (snapshot.history.at(-1)?.day ?? day)) {
    renderChart();
    lastChart = snapshot.history.at(-1)?.day ?? day;
  }
}

function renderPlayback() {
  $('#play-btn').innerHTML = icon(running ? 'pause' : 'play');
  $('#play-btn').setAttribute('aria-label', running ? 'Pause simulation' : 'Resume simulation');
  $('#play-btn').title = `${running ? 'Pause' : 'Resume'} (Space)`;
  $('#live-badge').innerHTML = `<i></i> ${running ? 'WORLD IS LIVING' : 'A MOMENT OF STILLNESS'}`;
  $('#live-badge').classList.toggle('paused', !running);
  $('#playback-note').textContent = running ? (speed === 1 ? 'One day at a time' : `Up to ${4 * speed} days / second`) : 'Take a closer look';
  $$('[data-speed]').forEach(button => {
    const active = Number(button.dataset.speed) === speed;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

// Live regions retain focused controls so a refresh cannot interrupt keyboard use.
function liveMarkup(element, markup) {
  if (!element || element.innerHTML === markup) return;
  const active = document.activeElement;
  if (element.contains(active) && active !== element && active.matches('button, input, select, summary, a')) return;
  const scroll = element.scrollTop;
  element.innerHTML = markup;
  element.scrollTop = scroll;
}

const groupName = id => snapshot.groups.find(group => group.id === id)?.name || 'a vanished society';
const personName = id => snapshot.agents.find(agent => agent.id === id)?.name || 'someone now gone';
const AXIS_LABELS = { collectivism: ['Free market', 'Communal'], hierarchy: ['Egalitarian', 'Authority'], innovation: ['Tradition', 'Progress'], martial: ['Peaceful', 'Martial'], piety: ['Secular', 'Devout'], expansion: ['Homeland', 'Expansion'] };

/** Countries: their members, capital, government and people. */
function renderCountries(groups) {
  const content = $('#civilization-content'), countries = snapshot.polity?.countries || [];
  const ids = new Set(groups.map(group => group.id));
  const shown = civilizationSociety === 'all' ? countries : countries.filter(country => country.members.some(id => ids.has(id)));
  const unaligned = snapshot.groups.filter(group => !countries.some(country => country.members.includes(group.id))).length;
  $('#civilization-summary').textContent = `${number(countries.length)} ${countries.length === 1 ? 'country' : 'countries'} · ${number(unaligned)} independent societies`;
  liveMarkup(content, shown.length ? `<div class="idea-grid">${shown.map(country => {
    const members = country.members.map(id => snapshot.groups.find(group => group.id === id)).filter(Boolean);
    const people = members.reduce((sum, group) => sum + group.members.length, 0);
    const ruling = (snapshot.polity?.parties || []).find(party => party.groupId === country.capitalId && party.inPower);
    return `<article class="idea-card"><div class="idea-meta"><span><i class="society-dot" style="background:${color(country.color)}"></i> ${escape(title(country.government))}</span><span>since ${calendar(country.founded)}</span></div><h3>${escape(country.name)}</h3><p class="idea-description">Capital ${escape(groupName(country.capitalId))} · ${number(members.length)} societies · ${number(people)} people${ruling ? ` · governed by the ${escape(ruling.name)}` : ''}</p><p class="recipe-line">${members.map(group => escape(group.name)).join(' · ')}</p></article>`;
  }).join('')}</div>` : '<div class="empty-state idea-empty"><span>⚑</span>No countries yet.<br>Cities with colonies or allies, and overlords with tributaries, proclaim states.</div>');
}

/** Parties: ideology, support and who governs. */
function renderParties(groups) {
  const content = $('#civilization-content'), ids = new Set(groups.map(group => group.id));
  const parties = (snapshot.polity?.parties || []).filter(party => ids.has(party.groupId)).sort((a, b) => b.inPower - a.inPower || b.share - a.share);
  $('#civilization-summary').textContent = `${number(parties.length)} parties · ${number(snapshot.polity?.elections)} elections · ${number(snapshot.polity?.revolutions)} revolutions worldwide`;
  liveMarkup(content, parties.length ? `<div class="idea-grid">${parties.map(party => `<article class="idea-card"><div class="idea-meta"><span>${party.inPower ? '★ In government' : 'Opposition'}</span><span>${escape(groupName(party.groupId))}</span></div><h3>${escape(party.name)}</h3><p class="idea-description">Led by ${escape(personName(party.leaderId))} · ${number(party.share * 100)}% support · founded ${calendar(party.founded)}${party.wins ? ` · ${number(party.wins)} ${party.wins === 1 ? 'term' : 'terms'} in power` : ''}</p><div class="doctrine-grid">${Object.entries(party.ideology).map(([key, value]) => `<div><span>${escape(AXIS_LABELS[key][value >= .5 ? 1 : 0])}</span><meter min="0" max="1" value="${Number(value)}">${number(value * 100)}%</meter></div>`).join('')}</div></article>`).join('')}</div>` : '<div class="empty-state idea-empty"><span>☷</span>No parties yet.<br>Towns of a dozen or more people with governance or a hall organise politically.</div>');
}

/** Companies: sector, owner, reach, capital and results. */
function renderCompanies(groups) {
  const content = $('#civilization-content'), ids = new Set(groups.map(group => group.id));
  const companies = (snapshot.enterprise?.companies || []).filter(company => company.branches.some(id => ids.has(id))).sort((a, b) => b.capital - a.capital);
  $('#civilization-summary').textContent = `${number(companies.length)} companies · ${number(companies.filter(company => company.branches.length >= 3).length)} corporations · ${number(snapshot.enterprise?.founded)} founded and ${number(snapshot.enterprise?.failed)} wound up worldwide`;
  liveMarkup(content, companies.length ? `<div class="idea-grid">${companies.map(company => `<article class="idea-card"><div class="idea-meta"><span>${escape(title(company.sector))}${company.branches.length >= 3 ? ' · corporation' : ''}</span><span>since ${calendar(company.founded)}</span></div><h3>${escape(company.name)}</h3><p class="idea-description">Owned by ${escape(personName(company.ownerId))}${company.ownerId !== company.founderId ? ` · founded by ${escape(personName(company.founderId))}` : ''} · based in ${escape(groupName(company.homeId))}</p><p class="recipe-line">Operates in ${company.branches.map(id => escape(groupName(id))).join(' · ')}</p><dl class="relation-measures"><div><dt>Capital</dt><dd>${number(company.capital)}</dd></div><div><dt>Revenue</dt><dd>${number(company.revenue)}/yr</dd></div><div><dt>Profit</dt><dd>${number(company.profit)}/yr</dd></div><div><dt>Workers</dt><dd>${number(company.employees)}</dd></div></dl></article>`).join('')}</div>` : '<div class="empty-state idea-empty"><span>▤</span>No companies yet.<br>Once a society knows commerce, its ambitious and well-off found firms.</div>');
}

/** Conflicts: every recorded war, ongoing first, with its cause, aim, course and outcome. */
function renderConflicts(groups) {
  const content = $('#civilization-content'), ids = new Set(groups.map(group => group.id));
  const all = snapshot.diplomacy?.wars || [];
  const shown = (civilizationSociety === 'all' ? all : all.filter(war => [...war.attackers, ...war.defenders, war.attacker, war.defender].some(id => ids.has(id))))
    .slice().sort((a, b) => (a.end === null) === (b.end === null) ? (b.end ?? b.start) - (a.end ?? a.start) : a.end === null ? -1 : 1);
  const ongoing = all.filter(war => war.end === null);
  const deaths = all.reduce((sum, war) => sum + war.casualties[0] + war.casualties[1], 0), refugees = all.reduce((sum, war) => sum + war.refugees, 0);
  $('#civilization-summary').textContent = `${number(ongoing.length)} ${ongoing.length === 1 ? 'war' : 'wars'} under way · ${number(all.length - ongoing.length)} ended · ${number(deaths)} killed in recorded wars · ${number(refugees)} refugees`;
  const nameOf = (war, id) => snapshot.groups.find(group => group.id === id)?.name || war.names?.[id] || 'a vanished society';
  const colorOf = id => color(snapshot.groups.find(group => group.id === id)?.color);
  const side = (war, list) => list.map(id => `<span class="conflict-party"><i class="society-dot" style="background:${colorOf(id)}"></i>${escape(nameOf(war, id))}</span>`).join('');
  const years = war => ((war.end ?? snapshot.day) - war.start) / DAYS;
  const span = war => { const y = years(war); return y < 1 ? `${Math.max(1, Math.round(y * 12))} months` : `${y.toFixed(1)} years`; };
  const weary = (value, label) => `<div class="conflict-weariness"><span>${escape(label)}</span><span class="bar"><i style="width:${percent(Math.min(1.5, value) / 1.5 * 100)}%"></i></span></div>`;
  liveMarkup(content, `<div class="diplomacy-totals"><span><strong>${number(ongoing.length)}</strong> wars under way</span><span><strong>${number(snapshot.diplomacy?.warsStarted)}</strong> wars begun</span><span><strong>${number(snapshot.diplomacy?.warDeaths)}</strong> war deaths</span><span><strong>${number(refugees)}</strong> refugees</span></div>${shown.length ? `<div class="idea-grid">${shown.map(war => {
    const lead = war.score > 5 ? nameOf(war, war.attacker) : war.score < -5 ? nameOf(war, war.defender) : null;
    const balance = 50 + war.score / 2;
    return `<article class="idea-card conflict-card ${war.end === null ? 'ongoing' : 'ended'}"><div class="idea-meta"><span>${war.end === null ? `⚔ ${war.phase === 'campaign' ? 'Campaign under way' : 'Lull in the fighting'}` : `Ended · ${escape(title(war.outcome?.terms || ''))}`}</span><span>${calendar(war.start).replace(/ · Day.*/, '')}${war.end === null ? ' – now' : ` – ${calendar(war.end).replace(/ · Day.*/, '').replace('Year ', '')}`} · ${span(war)}</span></div>
      <h3>${escape(war.name)}</h3>
      <div class="conflict-sides"><div>${side(war, war.attackers.length ? war.attackers : [war.attacker])}</div><span class="versus">against</span><div>${side(war, war.defenders.length ? war.defenders : [war.defender])}</div></div>
      <p class="idea-description"><strong>Cause:</strong> ${escape(CAUSES[war.cause]?.label || title(war.cause))}. ${escape(war.reason)}<br><strong>Aim:</strong> ${escape(nameOf(war, war.attacker))} fights to ${escape(GOALS[war.goal] || war.goal)}.</p>
      <div class="conflict-balance" title="Balance of the war"><i style="width:${percent(balance)}%;background:${colorOf(war.attacker)}"></i><i style="width:${percent(100 - balance)}%;background:${colorOf(war.defender)}"></i></div>
      <p class="quiet-note">${lead ? `${escape(lead)} ${war.end === null ? 'has the upper hand' : 'had the upper hand'}` : 'Neither side has the advantage'} · ${number(war.battles)} battles · ${number(war.casualties[0])} and ${number(war.casualties[1])} dead${war.refugees ? ` · ${number(war.refugees)} refugees` : ''}</p>
      ${war.end === null ? `${weary(war.weariness[0], `${nameOf(war, war.attacker)} war-weariness`)}${weary(war.weariness[1], `${nameOf(war, war.defender)} war-weariness`)}` : `<p class="idea-description conflict-outcome">${escape(war.outcome?.text || '')}</p>`}
      <button class="text-button" data-focus="${Number(war.front.x)},${Number(war.front.y)}">${war.end === null ? 'See the front' : 'See the battlefield'} ↗</button>
    </article>`;
  }).join('')}</div>` : '<div class="empty-state idea-empty"><span>⚔</span>No wars recorded yet.<br>Wars begin over land, hunger, minerals, faith, ideology, revenge, ambition or independence.</div>'}`);
  $('#civilization-footnote').textContent = 'Wars are fought in campaigns separated by lulls. Battles shift the balance; losses, hunger and time wear each side down against its resolve, and the side that tires first seeks terms. Victory hardens a society; defeat can bring down its government, and a proud loser may seek revenge.';
}

/** Technologies no one wrote in advance: research at the frontier, then every breakthrough made. */
function renderBreakthroughs(groups) {
  const content = $('#civilization-content'), list = snapshot.breakthroughs?.list || [];
  const names = new Map([...TECHNOLOGIES.map(tech => [tech.id, tech.name]), ...list.map(entry => [entry.id, entry.name])]);
  const ids = new Set(groups.map(group => group.id));
  const held = new Map();
  for (const group of snapshot.groups) for (const id of group.civilization?.breakthroughs || []) held.set(id, (held.get(id) || 0) + 1);
  const shown = (civilizationSociety === 'all' ? list : list.filter(entry => ids.has(entry.originId) || groups.some(group => group.civilization?.breakthroughs?.includes(entry.id)))).slice().reverse();
  const frontier = groups.filter(group => group.civilization?.frontier);
  const deepest = list.reduce((max, entry) => Math.max(max, entry.depth), 0);
  $('#civilization-summary').textContent = `${number(list.length)} breakthroughs · deepest advance ${number(deepest)} · ${number(frontier.length)} ${frontier.length === 1 ? 'society' : 'societies'} at the frontier`;
  const effectLine = effects => Object.entries(effects).filter(([, value]) => Math.abs(value) >= .01).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).map(([key, value]) => `<span class="effect ${value < 0 ? 'negative' : ''}">${value > 0 ? '+' : '−'}${number(Math.abs(value) * 100)}% ${escape(key)}</span>`).join('');
  const progress = frontier.map(group => {
    const f = group.civilization.frontier, pct = percent(f.progress / Math.max(1, f.required) * 100);
    return `<article class="idea-card"><div class="idea-meta"><span>At the frontier · ${escape(title(f.field))} · depth ${number(f.depth)}</span><span>${escape(group.name)}</span></div><h3>${escape(f.name)}</h3><p class="recipe-line">From ${f.parents.map(id => escape(names.get(id) || id)).join(' + ')}</p><progress class="research-progress" value="${pct}" max="100">${pct}%</progress><p class="quiet-note">${pct >= 100 ? `Awaiting materials: ${Object.entries(f.cost).map(([key, value]) => `${decimal(value)} ${escape(key)}`).join(', ')}` : `${decimal(f.progress)} of ${number(f.required)} research`}</p><div class="effect-list">${effectLine(f.effects)}</div></article>`;
  }).join('');
  const made = shown.slice(0, 80).map(entry => `<article class="idea-card"><div class="idea-meta"><span>${escape(title(entry.field))} · depth ${number(entry.depth)}</span><span>${calendar(entry.day)}</span></div><h3>${escape(entry.name)}</h3><p class="recipe-line">From ${entry.parents.map(id => escape(names.get(id) || id)).join(' + ')}</p><p class="idea-description">${escape(entry.description)}</p><div class="effect-list">${effectLine(entry.effects)}</div><p class="quiet-note">First made by ${escape(entry.origin)} · held by ${number(held.get(entry.id) || 0)} ${held.get(entry.id) === 1 ? 'society' : 'societies'}</p></article>`).join('');
  liveMarkup(content, list.length || frontier.length ? `${progress ? `<p class="industry-label">Research at the frontier</p><div class="idea-grid">${progress}</div>` : ''}<p class="industry-label">Breakthroughs${shown.length > 80 ? ' · newest 80' : ''}</p><div class="idea-grid">${made || '<p class="quiet-note">None yet for this selection.</p>'}</div>` : '<div class="empty-state idea-empty"><span>✧</span>No breakthroughs yet.<br>Once a society has writing and engineering, its researchers push past the known technologies.</div>');
}

/** Annual output, output per person, the ten-year trend and a sparkline of the yearly record. */
function economyMarkup(group) {
  const economy = group.civilization?.economy;
  if (!economy || !economy.history.length || economy.output < 0) return '<p class="quiet-note">Output is measured once the society has worked for a year.</p>';
  const history = economy.history, decade = history.at(-11) ?? history[0], change = decade > 0 ? (economy.output / decade - 1) * 100 : 0;
  const max = Math.max(...history, 1), points = history.map((value, index) => `${history.length === 1 ? 50 : index / (history.length - 1) * 100},${28 - value / max * 26}`).join(' ');
  const years = Math.min(10, history.length - 1);
  return `<div class="economy-line"><div><strong>${number(economy.output)}</strong><span>a year · ${decimal(economy.output / Math.max(1, group.members.length))} per person${years ? ` · ${change >= 0 ? '▲' : '▼'} ${number(Math.abs(change))}% over ${number(years)} ${years === 1 ? 'year' : 'years'}` : ''}</span></div><svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-label="Yearly output"><polyline points="${points}" fill="none" stroke="${change >= 0 ? '#7f9d5f' : '#b27a5c'}" stroke-width="2" vector-effect="non-scaling-stroke"/></svg></div>`;
}

// ——— the person in your charge ———
const playerPanel = document.createElement('aside');
playerPanel.className = 'player-panel'; playerPanel.hidden = true; playerPanel.setAttribute('aria-label', 'The person in your charge');
$('#world-canvas').parentElement.append(playerPanel);
function order(payload) {
  return request('command', { type: 'order', ...payload }).then(message => { if (message) toast(message, 2500); }).catch(report);
}
let playerKey = '';
function renderPlayer() {
  const info = snapshot?.player, agent = info?.id ? snapshot.agents.find(person => person.id === info.id) : null;
  playerPanel.hidden = !agent;
  if (!agent) { playerKey = ''; return; }
  const group = snapshot.groups.find(entry => entry.id === agent.groupId);
  const orderText = info.order ? { move: 'travelling', work: `working (${info.order.action})`, forage: 'foraging', rest: 'resting', explore: 'exploring', talk: 'going to talk', court: 'courting', give: 'taking food', join: 'going to join a society' }[info.order.kind] : 'awaiting your direction';
  const bars = [['Health', agent.health], ['Fed', 100 - agent.hunger], ['Energy', agent.energy]].map(([name, value]) => `<div class="need-row"><span>${name}</span><span class="meter"><i style="width:${percent(value)}%;background:${value < 30 ? '#be9a79' : '#a4b581'}"></i></span><span>${number(value)}</span></div>`).join('');
  const key = JSON.stringify([info.work.map(entry => entry.label), info.nearby.map(person => [person.id, person.eligible]), info.societies.map(entry => entry.id), agent.groupId, info.canFoundCompany, info.canFoundParty]);
  if (key !== playerKey) {
    playerKey = key;
    playerPanel.innerHTML = `<div class="player-head"><strong class="player-name"></strong><button class="icon-btn" data-player-release aria-label="Release">×</button></div><p class="player-status"></p><div class="player-bars"></div>
      <p class="player-hint">Click the map to go there · arrow keys or WASD to move</p>
      <div class="player-actions"><button data-order="rest">Rest</button><button data-order="forage">Forage</button><button data-order="explore">Explore</button></div>
      ${info.work.length ? `<label class="player-label">Work<select data-work>${info.work.map(entry => `<option value="${escape(entry.action)}">${escape(entry.label)}</option>`).join('')}</select></label><button class="button secondary" data-order="work">Do this work</button>` : ''}
      <p class="player-label">People nearby</p><div class="player-people">${info.nearby.length ? info.nearby.map(person => `<div><span>${escape(person.name)} · ${number(person.age)}</span><span><button data-order="talk" data-target="${person.id}">Talk</button><button data-order="give" data-target="${person.id}">Give food</button>${person.eligible ? `<button data-order="court" data-target="${person.id}">Court</button>` : ''}</span></div>`).join('') : '<span class="quiet-note">No one within reach.</span>'}</div>
      <p class="player-label">Society</p><div class="player-actions">${agent.groupId ? '<button data-order="leave">Leave</button>' : ''}<button data-order="found-society">Found a society</button>${info.canFoundCompany ? '<button data-order="found-company">Found a company</button>' : ''}${info.canFoundParty ? '<button data-order="found-party">Found a party</button>' : ''}</div>
      ${info.societies.length ? `<div class="player-people">${info.societies.map(entry => `<div><span>${escape(entry.name)} · ${number(entry.members)}</span><button data-order="join" data-target="${entry.id}">Join</button></div>`).join('')}</div>` : ''}`;
  }
  playerPanel.querySelector('.player-name').textContent = `${agent.name} · ${agent.mind?.role || ''}`;
  playerPanel.querySelector('.player-status').textContent = `${Math.floor(agent.age)} years · ${group ? group.name : 'no society'} · ${orderText}`;
  playerPanel.querySelector('.player-bars').innerHTML = bars;
}
playerPanel.addEventListener('click', event => {
  if (event.target.closest('[data-player-release]')) { request('command', { type: 'release' }).then(toast).catch(report); return; }
  const button = event.target.closest('[data-order]');
  if (!button) return;
  const kind = button.dataset.order, target = button.dataset.target ? Number(button.dataset.target) : undefined;
  order({ kind, ...(target !== undefined ? { target } : {}), ...(kind === 'work' ? { action: playerPanel.querySelector('[data-work]').value } : {}) });
});
document.addEventListener('keydown', event => {
  if (!snapshot?.player?.id || event.target.closest?.('input, select, textarea') || event.metaKey || event.ctrlKey) return;
  const step = { ArrowUp: [0, -6], KeyW: [0, -6], ArrowDown: [0, 6], KeyS: [0, 6], ArrowLeft: [-6, 0], KeyA: [-6, 0], ArrowRight: [6, 0], KeyD: [6, 0] }[event.code];
  const agent = snapshot.agents.find(person => person.id === snapshot.player.id);
  if (!step || !agent) return;
  event.preventDefault();
  order({ kind: 'move', x: agent.x + step[0], y: agent.y + step[1] });
});

/** " · part of X · governed by Y" for a society row. */
function politicsMarkup(group) {
  const country = (snapshot.polity?.countries || []).find(entry => entry.members.includes(group.id));
  const ruling = (snapshot.polity?.parties || []).find(party => party.groupId === group.id && party.inPower);
  return `${country ? ` · ${country.capitalId === group.id ? 'capital of' : 'part of'} ${escape(country.name)}` : ''}${ruling ? ` · governed by the ${escape(ruling.name)}` : ''}`;
}

/** " · pays tribute to X" and/or " · rules N tributaries" for a society row. */
function tributeMarkup(group) {
  const relations = (snapshot.diplomacy?.relations || []).filter(relation => relation.status === 'tributary' && (relation.a === group.id || relation.b === group.id));
  const name = id => snapshot.groups.find(other => other.id === id)?.name || 'a vanished society';
  const overlord = relations.find(relation => relation.overlord !== group.id);
  const ruled = relations.filter(relation => relation.overlord === group.id).length;
  const wars = (snapshot.diplomacy?.wars || []).filter(war => war.end === null && (war.attackers.includes(group.id) || war.defenders.includes(group.id)));
  const fighting = wars.map(war => `<br><span class="war-note">⚔ ${escape(war.name)} · year ${Math.floor((snapshot.day - war.start) / DAYS) + 1} · ${war.attackers.includes(group.id) ? 'attacking' : 'defending'}</span>`).join('');
  return `${overlord ? ` · pays tribute to ${escape(name(overlord.overlord))}` : ''}${ruled ? ` · rules ${number(ruled)} ${ruled === 1 ? 'tributary' : 'tributaries'}${ruled >= 3 ? ' (empire)' : ''}` : ''}${fighting}`;
}

function researchMarkup(group) {
  const project = group.civilization?.project;
  if (!project) return '<span class="quiet-note">No active research project</span>';
  const progress = percent(project.progress / Math.max(1, project.required) * 100);
  return `<div class="research-label"><span>${escape(techName(project.technology))}</span><strong>${decimal(project.progress)} / ${number(project.required)}</strong></div><progress class="research-progress" value="${progress}" max="100" aria-label="${escape(techName(project.technology))} research in ${escape(group.name)}">${number(progress)}%</progress><span class="quiet-note">${number(project.contributors?.length)} contributors · ${number(progress)}% complete</span>`;
}

const effectLabels = { food: 'Food output', gathering: 'Gathering', crafting: 'Crafting', healing: 'Healing', storage: 'Preservation', trade: 'Trade', combat: 'Combat', learning: 'Learning' };
function effectMarkup(effects, multipliers = false) {
  const changes = Object.entries(effects || {}).filter(([key, value]) => key in effectLabels && Math.abs(value - (multipliers ? 1 : 0)) > .001);
  return `<div class="effect-list">${changes.length ? changes.map(([key, value]) => {
    const delta = multipliers ? value - 1 : value;
    return `<span class="effect ${delta < 0 ? 'cost' : 'benefit'}">${escape(effectLabels[key])}<strong>${multipliers ? `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}×` : `${delta > 0 ? '+' : ''}${decimal(delta * 100)}%`}</strong></span>`;
  }).join('') : '<span class="quiet-note">No measurable production modifiers</span>'}</div>`;
}

function doctrineMarkup(doctrine) {
  if (!doctrine) return '';
  return `<div class="doctrine-grid">${['solidarity', 'openness', 'authority', 'militancy', 'spirituality'].map(key => `<div><span>${escape(title(key))}</span><meter min="0" max="1" value="${Number(doctrine[key]) || 0}" aria-label="${escape(title(key))}">${number(doctrine[key] * 100)}%</meter><strong>${number(doctrine[key] * 100)}%</strong></div>`).join('')}</div>`;
}

function experimentMarkup(group) {
  const experiment = group.civilization?.experiment;
  if (!experiment) return '';
  const hypothesis = experiment.hypothesis;
  const progress = percent(experiment.progress / Math.max(1, experiment.required) * 100);
  return `<article class="experiment-card"><div class="idea-meta"><span>Experiment in progress</span><span>${escape(group.name)}</span></div><h3>${escape(hypothesis.name)}</h3><p>${escape(hypothesis.description)}</p><p class="recipe-line">${(hypothesis.recipe?.materials || []).map(title).map(escape).join(' + ')} · ${escape(title(hypothesis.recipe?.method))} · ${escape(title(hypothesis.recipe?.principle))}</p><progress class="research-progress" value="${progress}" max="100" aria-label="${escape(hypothesis.name)} experiment progress">${number(progress)}%</progress><div class="experiment-status"><span>${decimal(experiment.progress)} / ${decimal(experiment.required)} effort</span><span>${number(experiment.contributors?.length)} contributors · ${number(experiment.attempts)} tests</span></div><p class="quiet-note">Hypothesis awaiting evidence. Supplies and work do not guarantee success.</p></article>`;
}

function ideaCardsMarkup(kind, groups, people) {
  const registry = snapshot.innovation?.discoveries || [];
  const byId = new Map(registry.map(idea => [idea.id, idea]));
  const groupIds = new Set(groups.map(group => group.id));
  const adopted = new Set(groups.flatMap(group => group.civilization?.ideas || []));
  const query = ideasQuery.toLowerCase();
  const ideas = registry.filter(idea => idea.kind === kind && (civilizationSociety === 'all' || adopted.has(idea.id) || groupIds.has(idea.originGroupId)))
    .filter(idea => `${idea.name} ${idea.id} ${idea.domain} ${idea.description} ${idea.recipe?.method} ${idea.recipe?.principle}`.toLowerCase().includes(query)).sort((a, b) => b.createdDay - a.createdDay || b.generation - a.generation);
  const pageSize = 12;
  ideaPage = Math.min(ideaPage, Math.max(0, Math.ceil(ideas.length / pageSize) - 1));
  const holdings = new Map(), communities = new Map(), convictions = new Map();
  // Holder counts arrive per society rather than as every person's list of ideas.
  for (const [society, counts] of Object.entries(snapshot.ideaHolders || {})) {
    if (civilizationSociety !== 'all' && society !== civilizationSociety) continue;
    for (const [id, count] of Object.entries(counts)) holdings.set(id, (holdings.get(id) || 0) + count);
  }
  for (const person of people) {
    for (const [id, strength] of Object.entries(person.convictions || {})) if (strength > 0) convictions.set(id, (convictions.get(id) || 0) + 1);
  }
  for (const group of groups) for (const id of group.civilization?.ideas || []) communities.set(id, (communities.get(id) || 0) + 1);
  const cards = ideas.slice(ideaPage * pageSize, (ideaPage + 1) * pageSize).map(idea => {
    const origin = snapshot.groups.find(group => group.id === idea.originGroupId)?.name || `Former society #${idea.originGroupId}`;
    const inputs = Object.entries(idea.cost || {}).filter(([, value]) => value > 0).map(([material, value]) => `${decimal(value)} ${escape(material)}`).join(' · ');
    return `<article class="idea-card ${kind}" data-idea-id="${escape(idea.id)}"><div class="idea-meta"><span>${escape(title(idea.domain))} · Generation ${number(idea.generation)}</span><span>${calendar(idea.createdDay)}</span></div><h3>${escape(idea.name)}</h3><p class="idea-description">${escape(idea.description)}</p>${kind === 'belief' ? doctrineMarkup(idea.doctrine) : ''}<p class="industry-label">${kind === 'belief' ? 'Practice' : 'Design recipe'}</p><p class="recipe-line">${(idea.recipe?.materials || []).map(title).map(escape).join(' + ') || 'Shared experience'} · ${escape(title(idea.recipe?.method))}<br>${escape(title(idea.recipe?.principle))} · intensity ${decimal(idea.recipe?.intensity)}</p>${effectMarkup(idea.effects)}<p class="quiet-note">${kind === 'invention' ? `Evidence: ${number(idea.evidence?.successes)} successful / ${number(idea.evidence?.trials)} tests · ${number(idea.evidence?.failures)} failures · quality ${number(idea.evidence?.quality * 100)}%` : `${number(convictions.get(idea.id))} people hold a conviction in the observed population`}</p>${inputs ? `<p class="quiet-note">Test input recipe: ${inputs}</p>` : ''}<div class="idea-lineage"><span>Lineage</span><p>${idea.parentIds?.length ? idea.parentIds.map(id => escape(byId.get(id)?.name || id)).join(' + ') : 'An original combination'}</p></div><p class="idea-origin">Origin: ${escape(origin)} · Founder #${number(idea.founderId)}<br>${number(holdings.get(idea.id))} living people know it · ${number(communities.get(idea.id))} societies have adopted it</p></article>`;
  }).join('');
  return `<div class="idea-catalog-tools"><label for="ideas-search">Find ${kind === 'belief' ? 'a tradition' : 'a design'}</label><input type="search" id="ideas-search" value="${escape(ideasQuery)}" placeholder="Name, domain, or principle…" /><span>${number(ideas.length)} records</span></div>${cards ? `<div class="idea-grid">${cards}</div>` : `<div class="empty-state idea-empty"><span>${kind === 'belief' ? '◈' : '✧'}</span>${ideasQuery ? 'No matching ideas.' : kind === 'belief' ? 'Traditions grow from lived experience.<br>Beliefs will appear as people reflect and share them.' : 'An invention begins with a question.<br>Generated designs will appear when people test and develop their ideas.'}</div>`}${ideas.length > pageSize ? `<div class="idea-pagination"><button class="text-button" data-idea-page="${ideaPage - 1}" ${ideaPage === 0 ? 'disabled' : ''}>← Previous</button><span>${ideaPage + 1} / ${Math.ceil(ideas.length / pageSize)}</span><button class="text-button" data-idea-page="${ideaPage + 1}" ${(ideaPage + 1) * pageSize >= ideas.length ? 'disabled' : ''}>Next →</button></div>` : ''}`;
}

const NORM_NAMES = { innovation: 'Invention', tradition: 'Tradition', collectivism: 'Community', hierarchy: 'Hierarchy', martial: 'Martial spirit', mercantile: 'Trade', piety: 'Devotion', expansion: 'Expansion' };
const KIND_SYMBOLS = { cuisine: '❦', craft: '⚒', festival: '✦', rite: '◈', architecture: '⌂' };
function dietMarkup(diet) {
  const entries = Object.entries(diet || {}), total = entries.reduce((sum, [, value]) => sum + value, 0);
  if (total < 1) return '<span class="quiet-note">No recorded meals yet</span>';
  return `<div class="diet-bar">${entries.filter(([, value]) => value / total > .02).map(([source, value]) => `<i class="diet-${escape(source)}" style="width:${percent(value / total * 100)}%" title="${escape(title(source))} ${number(value / total * 100)}%"></i>`).join('')}</div><p class="diet-legend">${entries.filter(([, value]) => value / total > .02).sort((a, b) => b[1] - a[1]).map(([source, value]) => `<span><i class="diet-${escape(source)}"></i>${escape(title(source))} ${number(value / total * 100)}%</span>`).join('')}</p>`;
}
function renderCultures(groups) {
  const content = $('#civilization-content'), world = snapshot.culture || { customs: [] };
  const customs = new Map(world.customs.map(custom => [custom.id, custom]));
  const everyone = snapshot.groups.filter(group => group.civilization?.culture);
  const mean = key => everyone.reduce((sum, group) => sum + group.civilization.culture.norms[key], 0) / Math.max(1, everyone.length);
  const byId = new Map(snapshot.groups.map(group => [group.id, group]));
  const stats = snapshot.stats;
  $('#civilization-summary').textContent = `Mean age at death ${decimal(stats.meanAgeAtDeath)} · ${number(stats.childDeathShare * 100)}% of deaths are children · ${decimal(stats.completedFertility)} children per woman by 45 · wealth Gini ${decimal(stats.wealthGini * 100)}% · ${number(world.coloniesFounded)} colonies · ${number(world.customsBorn)} customs born`;
  liveMarkup(content, groups.length ? `<div class="culture-grid">${groups.filter(group => group.civilization?.culture).sort((a, b) => b.members.length - a.members.length).map(group => {
    const culture = group.civilization.culture, leader = snapshot.agents.find(agent => agent.id === culture.leaderId);
    const parent = culture.parentId ? byId.get(culture.parentId) : null;
    const colonies = snapshot.groups.filter(other => other.civilization?.culture?.parentId === group.id);
    const members = snapshot.agents.filter(agent => agent.groupId === group.id);
    const eager = members.filter(agent => agent.age >= 18 && agent.psyche?.expansion > .55).length;
    return `<article class="culture-card"><div class="industry-heading"><i class="society-dot" style="background:${color(group.color)}"></i><h3>${escape(group.name)}</h3><span class="tier-badge tier-${culture.tier}">${escape(TIERS[culture.tier])}</span></div>
      <p class="culture-character">${escape(group.culture)} · ${escape(ECONOMIES[economyOf(group)].label)} · ${number(group.members.length)} people</p>
      <p class="culture-lineage">${leader ? `Led by <button data-person="${leader.id}">${escape(leader.name)}</button> since ${calendar(culture.leaderSince)}` : 'No recognized leader'}${parent ? ` · Colony of ${escape(parent.name)}` : culture.parentId ? ' · Colony of a vanished society' : ''}${colonies.length ? ` · Colonies: ${colonies.map(other => escape(other.name)).join(', ')}` : ''}</p>
      <p class="industry-label">Shared norms · ▎ marks the world average</p>
      <div class="norm-list">${NORMS.map(key => `<div class="norm-row"><span>${NORM_NAMES[key]}</span><span class="norm-track"><i style="width:${percent(culture.norms[key] * 100)}%"></i><b style="left:${percent(mean(key) * 100)}%"></b></span><strong>${number(culture.norms[key] * 100)}</strong></div>`).join('')}</div>
      <p class="industry-label">Customs · strength</p>
      ${culture.customs.length ? `<div class="custom-list">${culture.customs.map(entry => { const custom = customs.get(entry.id); if (!custom) return ''; return `<div class="custom-row" title="${escape(custom.description)}"><span>${KIND_SYMBOLS[custom.kind] || '·'} ${escape(custom.name)}</span><span class="drive-meter"><i style="width:${percent(entry.strength * 100)}%"></i></span><small>${escape(title(custom.kind))}${custom.originId !== group.id ? ` · from ${escape(custom.origin)}` : ''}</small></div>`; }).join('')}</div>` : '<p class="quiet-note">No customs yet. They grow from what a society eats, makes, builds and lives through.</p>'}
      <p class="industry-label">Expansion</p>
      <div class="expansion-line"><span>Land pressure</span><span class="drive-meter"><i style="width:${percent((culture.pressure || 0) * 100)}%"></i></span><strong>${number((culture.pressure || 0) * 100)}%</strong></div>
      <p class="quiet-note">${number(eager)} adults eager to settle new land · claims about ${number(claimRadius(group))} tiles around the settlement</p>
      <p class="industry-label">Wealth, health and organisation</p>
      <div class="expansion-line"><span>Inequality</span><span class="drive-meter"><i style="width:${percent(gini(members.filter(agent => agent.age >= 16).map(agent => agent.wealth || 0)) * 100)}%"></i></span><strong>${number(gini(members.filter(agent => agent.age >= 16).map(agent => agent.wealth || 0)) * 100)}</strong></div>
      <div class="expansion-line"><span>Disease load</span><span class="drive-meter"><i style="width:${percent(diseaseLoad(group) * 100)}%"></i></span><strong>${number(diseaseLoad(group) * 100)}</strong></div>
      <p class="quiet-note">${group.civilization.outbreakUntil > snapshot.day ? '⚠ An epidemic is spreading here. ' : ''}Medical care ${number(careLevel(group) * 100)}% · can organise about ${number(organisationalCapacity(group))} people before splitting</p>
      <p class="industry-label">Diet</p>${dietMarkup(group.civilization.diet)}
    </article>`;
  }).join('')}</div>` : '<div class="empty-state industry-empty"><span>◈</span>Culture begins with a community.<br>When societies form, their norms, customs, leaders and colonies appear here.</div>');
  $('#civilization-footnote').textContent = 'Norms drift toward what members value and what the society lives through, and customs reinforce them. Customs strengthen with practice, fade when their basis disappears, and travel through trade and alliance. Leaders steer hierarchical societies; land pressure and expansionist norms send pioneers to found colonies.';
}

function renderGeneratedIdeas(groups, people) {
  const content = $('#civilization-content');
  if (civilizationTab === 'inventions') {
    const experiments = groups.filter(group => group.civilization?.experiment);
    $('#civilization-summary').textContent = `${number(experiments.length)} active experiments · ${number(snapshot.innovation?.trials)} tests · ${number(snapshot.innovation?.failures)} failures worldwide`;
    liveMarkup(content, `${experiments.length ? `<div class="experiment-grid" tabindex="0" aria-label="Active experiments">${experiments.map(experimentMarkup).join('')}</div>` : ''}${ideaCardsMarkup('invention', groups, people)}`);
    $('#civilization-footnote').textContent = 'Each design combines materials, methods, principles, and earlier ideas. Listed effects are that design’s contributions; adopted designs combine with diminishing returns and tradeoffs. The catalog can keep growing.';
  } else if (civilizationTab === 'beliefs') {
    const doctrines = groups.filter(group => group.civilization?.doctrine);
    const byId = new Map((snapshot.innovation?.discoveries || []).map(idea => [idea.id, idea]));
    $('#civilization-summary').textContent = `${number(doctrines.length)} societies have a shared doctrine · personal convictions can differ`;
    liveMarkup(content, `${doctrines.length ? `<div class="doctrine-societies" tabindex="0" aria-label="Society doctrines">${doctrines.map(group => `<article class="doctrine-card"><div class="industry-heading"><i class="society-dot" style="background:${color(group.color)}"></i><h3>${escape(group.name)}</h3></div><p class="doctrine-title">${escape(byId.get(group.civilization.doctrine)?.name || 'Shared tradition')}</p>${doctrineMarkup(innovationEffects(snapshot, group))}<p class="industry-label">Current effects of all adopted ideas</p>${effectMarkup(innovationEffects(snapshot, group), true)}</article>`).join('')}</div>` : ''}${ideaCardsMarkup('belief', groups, people)}`);
    $('#civilization-footnote').textContent = 'These are invented traditions. Solidarity, openness, authority, militancy, and spirituality vary independently. Beliefs can support peace, exchange, or conflict through their effects on people and societies.';
  } else {
    const groupIds = new Set(groups.map(group => group.id));
    const relations = (snapshot.diplomacy?.relations || []).filter(relation => groupIds.has(relation.a) || groupIds.has(relation.b)).sort((a, b) => b.tension - a.tension);
    const groupNames = new Map(snapshot.groups.map(group => [group.id, group.name]));
    $('#civilization-summary').textContent = `${number(snapshot.stats.wars)} wars · ${number(snapshot.stats.alliances)} alliances · ${number(snapshot.stats.tributaries)} tributaries · ${number(snapshot.stats.tradeRoutes)} trade routes · ${number(snapshot.stats.roads)} roads · ${number(snapshot.stats.railways)} railways · ${number(snapshot.stats.seaRoutes)} sea and ${number(snapshot.stats.airRoutes)} air routes worldwide${snapshot.stats.nuclearStrikes ? ` · ☢ ${number(snapshot.stats.nuclearStrikes)} nuclear ${snapshot.stats.nuclearStrikes === 1 ? 'strike' : 'strikes'}` : ''}`;
    liveMarkup(content, `<div class="diplomacy-totals"><span><strong>${number(snapshot.diplomacy?.warsStarted)}</strong> wars begun</span><span><strong>${number(snapshot.diplomacy?.treaties)}</strong> treaties</span><span><strong>${number(snapshot.diplomacy?.raids)}</strong> raids</span><span><strong>${number(snapshot.diplomacy?.warDeaths)}</strong> war deaths</span></div>${relations.length ? `<div class="relations-grid">${relations.map(relation => `<article class="relation-card ${escape(relation.status)}"><div class="relation-heading"><h3>${escape(groupNames.get(relation.a) || `Society #${relation.a}`)} <span>↔</span> ${escape(groupNames.get(relation.b) || `Society #${relation.b}`)}</h3><span class="relation-status">${relation.status === 'tributary' ? `Tributary of ${escape(groupNames.get(relation.overlord) || 'its overlord')}` : escape(title(relation.status))}</span></div><p>${escape(relation.reason)}</p><dl class="relation-measures"><div><dt>Trust</dt><dd>${relation.trust >= 0 ? '+' : ''}${number(relation.trust * 100)}%</dd></div><div><dt>Tension</dt><dd>${number(relation.tension)} / 100</dd></div><div><dt>Traded</dt><dd>${decimal(relation.tradeTotal)}</dd></div><div><dt>Casualties</dt><dd>${number(relation.casualties)}</dd></div></dl><p class="quiet-note">${escape(title(relation.status))} since ${calendar(relation.since)} · ${number(relation.warDays)} days of war · Last contact ${calendar(relation.lastContact)}</p></article>`).join('')}</div>` : '<div class="empty-state idea-empty"><span>⇄</span>Societies need to encounter each other.<br>Recorded contacts, trade, alliances, conflict, and truces will appear here.</div>'}`);
    $('#civilization-footnote').textContent = 'Relations develop from contact, resource pressure, doctrine, trust, and relative capabilities. War consumes food, damages people and buildings, and transfers supplies. Treaties and truces can end fighting.';
  }
}

function renderObservation() {
  if (!snapshot) return;
  const content = $('#observation-content');
  if (tab === 'chronicle') {
    const signature = `${snapshot.seed}:${snapshot.events[0]?.id}:${snapshot.events[0]?.text}`;
    if (content.firstElementChild && content.dataset.signature === signature && content.dataset.tab === tab) return;
    const symbols = { birth: '✳', death: '◌', group: '⌂', world: '❧', migration: '↗', technology: '✧', industry: '⚒', communication: '↔', trade: '⇄', invention: '✧', belief: '◈', experiment: '⚗', war: '⚔', peace: '❧', diplomacy: '⇄' };
    liveMarkup(content, snapshot.events.slice(0, 55).map(event => `<article class="event"><div class="event-icon ${escape(event.type)}">${symbols[event.type] || '·'}</div><div><p>${event.agentId && snapshot.agents.some(a => a.id === event.agentId) ? `<button data-person="${Number(event.agentId)}">${escape(event.text)}</button>` : escape(event.text)}</p><time>${calendar(event.day)}</time></div></article>`).join('') || '<div class="empty-state"><span>❧</span>A new world, full of possibility.<br>Its story is just beginning.</div>');
    // Do not cache a skipped update while someone is using a chronicle button.
    if (!content.contains(document.activeElement) || document.activeElement === content) content.dataset.signature = signature;
    $('#deck-footer-text').textContent = 'Small choices. Unscripted outcomes.';
  } else if (tab === 'societies') {
    liveMarkup(content, [...snapshot.groups].sort((a, b) => b.members.length - a.members.length).map(group => {
      const civilization = group.civilization;
      const doctrine = (snapshot.innovation?.discoveries || []).find(idea => idea.id === civilization?.doctrine);
      const buildings = Object.values(civilization?.buildings || {}).reduce((sum, count) => sum + count, 0);
      const culture = civilization?.culture, leader = snapshot.agents.find(agent => agent.id === culture?.leaderId);
      return `<article class="society-row"><div><i class="society-dot" style="background:${color(group.color)}"></i><h3>${escape(group.name)}</h3><span class="member-count">${culture ? `${escape(TIERS[culture.tier])} · ` : ''}${group.members.length} people</span></div><p>${escape(group.culture)}${leader ? ` · led by ${escape(leader.name)}` : ''}${culture?.parentId ? ` · colony of ${escape(snapshot.groups.find(other => other.id === culture.parentId)?.name || 'a vanished society')}` : ''}${tributeMarkup(group)}${politicsMarkup(group)}<br>${number(group.shelters)} shelters · ${number(group.food)} food · ${number(group.wood)} wood<br>${number(civilization?.technologies?.length)} foundations · ${number(civilization?.ideas?.length)} adopted ideas · ${number(buildings)} buildings${civilization?.economy?.history.length ? ` · output ${number(civilization.economy.output)} a year` : ''}${doctrine ? `<br>◈ ${escape(doctrine.name)}` : ''}</p><div class="society-research">${researchMarkup(group)}</div><div class="society-actions"><button class="text-button" data-person="${Number(group.members[0])}">Meet a member ↗</button><button class="text-button" data-society="${group.id}">Explore ideas ↗</button></div></article>`;
    }).join('') || '<div class="empty-state"><span>⌂</span>No societies yet.<br>Connections take time. Watch for people gathering and sharing.</div>');
    $('#deck-footer-text').textContent = `${number(snapshot.agents.filter(a => a.groupId === null).length)} independent individuals`;
  } else if (tab === 'conversations') {
    const messages = snapshot.civilization?.messages || [];
    const alive = new Set(snapshot.agents.map(agent => agent.id));
    const speaker = (id, name) => alive.has(id) ? `<button data-person="${Number(id)}">${escape(name)}</button>` : escape(name);
    liveMarkup(content, messages.map(message => `<article class="conversation-row ${escape(message.kind)}"><div class="conversation-meta"><span>${escape(title(message.kind))}</span><time>${calendar(message.day)}</time></div><p class="conversation-people">${speaker(message.speakerId, message.speaker)} <span>→</span> ${speaker(message.listenerId, message.listener)}</p><p class="conversation-text">${escape(message.text)}</p>${message.technology ? `<span class="knowledge-chip">${escape(techName(message.technology))}</span>` : ''}${message.ideaId ? `<span class="knowledge-chip">${escape(snapshot.innovation?.discoveries.find(idea => idea.id === message.ideaId)?.name || message.ideaId)}</span>` : ''}${message.techniqueId ? `<span class="knowledge-chip technique">⚑ ${escape(practiceById.get(message.techniqueId)?.name || message.techniqueId)}</span>` : ''}</article>`).join('') || '<div class="empty-state"><span>↔</span>Ideas begin with an encounter.<br>Actual exchanges of skills, knowledge, and resource information will appear here.</div>');
    $('#deck-footer-text').textContent = `${number(messages.length)} recent exchanges · symbolic communication`;
  } else {
    if (!$('#people-search')) {
      content.innerHTML = '<input class="people-search" id="people-search" type="search" placeholder="Find a person or role…" aria-label="Find a person or role" /><div id="people-list"></div>';
      $('#people-search').value = peopleQuery;
    }
    const query = peopleQuery.toLowerCase();
    const people = snapshot.agents.filter(a => `${a.name} ${a.mind?.role || ''}`.toLowerCase().includes(query)).sort((a, b) => a.id - b.id);
    liveMarkup($('#people-list'), people.slice(0, 100).map(agent => `<button class="people-row" data-person="${agent.id}"><span class="person-avatar">${escape(agent.name.charAt(0))}</span><span><strong>${escape(agent.name)}</strong><small>${escape(title(agent.mind?.role || 'Individual'))} · ${escape(agent.action)}</small></span><span class="age">${Math.floor(agent.age)}y</span></button>`).join('') || '<div class="empty-state">No individuals found.</div>');
    $('#deck-footer-text').textContent = people.length > 100 ? `Showing 100 of ${people.length}. Search to find anyone.` : `${number(people.length)} individual ${people.length === 1 ? 'story' : 'stories'}`;
  }
  content.dataset.tab = tab;
}

function renderCivilization() {
  if (!snapshot) return;
  const select = $('#civilization-society');
  const optionsKey = snapshot.groups.map(group => `${group.id}:${group.name}`).join('|');
  if (select.dataset.groups !== optionsKey && document.activeElement !== select) {
    select.innerHTML = '<option value="all">All societies</option>' + snapshot.groups.map(group => `<option value="${group.id}">${escape(group.name)}</option>`).join('');
    if (civilizationSociety !== 'all' && !snapshot.groups.some(group => String(group.id) === civilizationSociety)) civilizationSociety = 'all';
    select.value = civilizationSociety;
    select.dataset.groups = optionsKey;
  }
  const groups = civilizationSociety === 'all' ? snapshot.groups : snapshot.groups.filter(group => String(group.id) === civilizationSociety);
  const people = civilizationSociety === 'all' ? snapshot.agents : snapshot.agents.filter(agent => String(agent.groupId) === civilizationSociety);
  const content = $('#civilization-content');
  if (civilizationTab === 'cultures') { renderCultures(groups); return; }
  if (['inventions', 'beliefs', 'relations'].includes(civilizationTab)) {
    renderGeneratedIdeas(groups, people);
    return;
  }
  if (civilizationTab === 'breakthroughs') { renderBreakthroughs(groups); return; }
  if (civilizationTab === 'countries') { renderCountries(groups); return; }
  if (civilizationTab === 'conflicts') { renderConflicts(groups); return; }
  if (civilizationTab === 'parties') { renderParties(groups); return; }
  if (civilizationTab === 'companies') { renderCompanies(groups); return; }
  if (civilizationTab === 'knowledge') {
    const projects = groups.filter(group => group.civilization?.project);
    $('#civilization-summary').textContent = `${number(projects.length)} active ${projects.length === 1 ? 'project' : 'projects'} · ${number(snapshot.stats.researchCompleted)} discoveries completed worldwide`;
    liveMarkup(content, `<div class="technology-grid">${TECHNOLOGIES.map(tech => {
      const holders = people.filter(agent => agent.knowledge?.includes(tech.id));
      const communities = groups.filter(group => group.civilization?.technologies.includes(tech.id));
      const research = groups.map(group => ({ group, progress: group.civilization?.research?.[tech.id] || 0, active: group.civilization?.project?.technology === tech.id })).filter(entry => !entry.group.civilization?.technologies.includes(tech.id) && (entry.progress > 0 || entry.active)).sort((a, b) => b.progress - a.progress);
      const readyGroups = groups.filter(group => !group.civilization?.technologies.includes(tech.id) && tech.requires.every(id => group.civilization?.technologies.includes(id)));
      const known = holders.length > 0 || communities.length > 0;
      const state = known ? 'known' : research.length ? 'researching' : readyGroups.length ? 'available' : 'locked';
      const label = { known: 'Known', researching: 'In progress', available: 'Ready to study', locked: groups.length ? 'Prerequisites needed' : 'Awaiting a society' }[state];
      return `<article class="technology-card ${state}"><div class="technology-heading"><span class="technology-symbol" aria-hidden="true">${known ? '✧' : research.length ? '◌' : '·'}</span><h3>${escape(tech.name)}</h3><span class="technology-state">${tech.era ? `${escape(tech.era)} · ` : ''}${label}</span></div><p>${escape(tech.description)}</p><div class="prerequisite-list"><span>Requires</span> ${tech.requires.length ? tech.requires.map(id => `<span class="prerequisite ${groups.some(group => group.civilization?.technologies.includes(id)) ? 'met' : ''}">${escape(techName(id))}</span>`).join('') : '<span class="prerequisite met">No earlier discovery</span>'}</div>${Object.keys(tech.materials || {}).length ? `<p class="technology-materials">Demonstration uses ${Object.entries(tech.materials).map(([key, value]) => `${number(value)} ${escape(key)}`).join(', ')}</p>` : ''}<div class="technology-holders">${number(holders.length)} people know this · ${number(communities.length)} societies · ${number(tech.cost)} research effort</div>${research.slice(0, 3).map(({ group, progress, active }) => `<div class="technology-research"><div><span><i class="society-dot" style="background:${color(group.color)}"></i>${escape(group.name)}${active ? '' : ' · paused'}</span><strong>${number(percent(progress / tech.cost * 100))}%</strong></div><progress class="research-progress" max="${tech.cost}" value="${Math.min(tech.cost, progress)}" aria-label="${escape(tech.name)} progress in ${escape(group.name)}">${number(progress)} of ${number(tech.cost)}</progress></div>`).join('')}${research.length > 3 ? `<span class="quiet-note">${research.length - 3} more societies studying this idea</span>` : ''}</article>`;
    }).join('')}</div>`);
    $('#civilization-footnote').textContent = 'Known means held by living people or societies. Each society must meet its own prerequisites; select one to follow its work.';
  } else {
    const workers = groups.reduce((sum, group) => sum + Object.values(group.civilization?.workforce || {}).reduce((n, count) => n + count, 0), 0);
    $('#civilization-summary').textContent = `${number(workers)} people in recorded roles · ${number(snapshot.stats.tradeVolume)} resources traded worldwide`;
    liveMarkup(content, groups.length ? `<div class="industry-grid">${groups.map(group => {
      const civ = group.civilization;
      const stock = { food: group.food, wood: group.wood, ...civ?.stock };
      const buildings = Object.entries(civ?.buildings || {}).filter(([, count]) => count > 0);
      const roles = Object.entries(civ?.workforce || {}).filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1]);
      const production = Object.entries(civ?.production || {}).filter(([, amount]) => amount > 0);
      const partners = (civ?.tradePartners || []).map(id => snapshot.groups.find(other => other.id === id)?.name || `Society #${id}`);
      return `<article class="industry-card"><div class="industry-heading"><i class="society-dot" style="background:${color(group.color)}"></i><h3>${escape(group.name)}</h3><span>${group.members.length} people</span></div><p class="industry-label">Economic output</p>${economyMarkup(group)}<p class="industry-label">Productive buildings</p><div class="building-list">${buildings.length ? buildings.map(([id, count]) => `<span title="${escape(BUILDINGS[id]?.technology ? `Requires ${techName(BUILDINGS[id].technology)}` : '')}">${escape(BUILDINGS[id]?.name || title(id))}<strong>${number(count)}</strong></span>`).join('') : '<span class="quiet-note">No industries built yet. Discover techniques and gather materials.</span>'}</div><p class="industry-label">Available stocks</p><dl class="stock-grid">${Object.entries(stock).filter(([id, amount]) => amount >= .05 || ['food', 'wood', 'stone', 'tools'].includes(id)).map(([id, amount]) => `<div><dt title="${escape(RESOURCE_INFO[id]?.uses || "")}">${escape(title(id))}</dt><dd>${decimal(amount)}</dd></div>`).join('')}</dl><p class="industry-label">Workforce</p><div class="workforce-list">${roles.length ? roles.map(([role, count]) => `<span>${escape(title(role))}<strong>${number(count)}</strong></span>`).join('') : '<span class="quiet-note">No roles recorded yet</span>'}</div><p class="industry-label">Produced over this society’s lifetime</p><p class="production-line">${production.length ? production.map(([id, amount]) => `${number(amount)} ${escape(id)}`).join(' · ') : 'Production begins when people put their skills to work.'}</p><p class="industry-label">Where the food comes from</p>${dietMarkup(civ?.diet)}<p class="industry-label">Current effects of all adopted ideas and customs</p>${effectMarkup(innovationEffects(snapshot, group), true)}${partners.length ? `<p class="trade-line">Trading relationships: ${partners.map(escape).join(', ')}</p>` : ''}<div class="society-research">${researchMarkup(group)}</div><button class="text-button" data-society="${group.id}">Follow this society’s ideas ↗</button></article>`;
    }).join('')}</div>` : '<div class="empty-state industry-empty"><span>⚒</span>Industry begins with shared work.<br>When societies form, their buildings, materials, skills, and production appear here.</div>');
    $('#civilization-footnote').textContent = 'Stocks are available now. Production and trade are cumulative. Buildings require discoveries and materials; useful output requires work.';
  }
}

function selectAgent(id) {
  selectedId = id;
  // Only the inspected person's full mind and memories are sent from the worker.
  request('inspect', { id }).catch(report);
  following = false;
  view.setFollow(null);
  view.setSelected(id);
  renderIndividual();
}
const placeholder = $('#individual-panel').innerHTML;
function renderIndividual() {
  const panel = $('#individual-panel');
  if (selectedId === null) {
    if (!panel.querySelector('.individual-placeholder') || panel.querySelector('.inspector-heading')) panel.innerHTML = placeholder;
    return;
  }
  const agent = snapshot?.agents.find(person => person.id === selectedId);
  // Their full record arrives with the next update.
  if (agent?.lite) return;
  if (!agent) {
    if (!panel.querySelector('.remembered-life')) panel.innerHTML = '<div class="inspector-heading remembered-life"><span>A LIFE REMEMBERED</span><button class="icon-btn" data-dismiss-person aria-label="Close individual">×</button></div><div class="individual-placeholder"><p>A story has ended.</p><span>This individual is no longer living. Their influence continues through their family and society.</span></div>';
    following = false;
    view.setFollow(null);
    return;
  }
  const group = snapshot.groups.find(group => group.id === agent.groupId);
  const partner = snapshot.agents.find(person => person.id === agent.partnerId);
  const mind = agent.mind || {};
  const needs = [['Health', agent.health], ['Nourished', 100 - agent.hunger], ['Energy', agent.energy], ['Belonging', agent.social]];
  const traits = [agent.traits.cooperation > .6 ? 'Generous' : agent.traits.cooperation < .35 ? 'Self-reliant' : 'Pragmatic', agent.traits.curiosity > .6 ? 'Explorer' : agent.traits.curiosity < .35 ? 'Homebody' : 'Curious', agent.traits.sociability > .6 ? 'Sociable' : agent.traits.sociability < .35 ? 'Reserved' : 'Easygoing'];
  const parents = agent.parentIds.map(id => snapshot.agents.find(a => a.id === id)?.name || `Ancestor #${id}`);
  // Mount disclosure controls once per selected person, keeping focus and open state.
  if (panel.dataset.agentId !== String(selectedId) || !panel.querySelector('.inspector-body')) {
    panel.innerHTML = `<div class="inspector-heading"><span>AN INDIVIDUAL LIFE</span><button class="icon-btn" data-dismiss-person aria-label="Close individual">×</button></div><div class="inspector-body"><div class="person-title"></div><p class="activity"></p><blockquote class="mind-thought"></blockquote><div class="needs-list"></div><div class="traits"></div><div class="mind-goal"></div><details class="mind-section" open><summary>Inside this decision</summary><div class="mind-policy"></div></details><details class="mind-section"><summary>Temperament &amp; mood</summary><div class="mind-temperament"></div></details><details class="mind-section" open><summary>Skills, techniques &amp; discoveries</summary><div class="mind-skills"></div><div class="mind-techniques"></div><div class="mind-ideas"></div></details><details class="mind-section"><summary>Experience &amp; preferences</summary><div class="mind-experience"></div></details><details class="mind-section"><summary>People they know</summary><div class="mind-people"></div></details><details class="mind-section"><summary>Values, beliefs &amp; desires</summary><div class="mind-values"></div><div class="mind-beliefs"></div><div class="mind-convictions"></div></details><details class="mind-section"><summary>Memories</summary><div class="mind-memories"></div></details><div class="person-family"></div><button class="button secondary follow-button" id="follow-btn"></button><button class="button primary follow-button" id="possess-btn"></button></div>`;
    panel.dataset.agentId = String(selectedId);
  }
  const update = (selector, markup) => liveMarkup(panel.querySelector(selector), markup);
  update('.person-title', `<span class="person-avatar" style="color:${color(group?.color)}">${escape(agent.name.charAt(0))}</span><div><h3>${escape(agent.name)}</h3><p>${agent.sex ? `${title(agent.sex)} · ` : ''}${Math.floor(agent.age)} years · ${escape(group?.name || 'Independent')} · Gen ${agent.generation}</p><span class="person-role">${escape(title(mind.role || 'Individual'))}${group?.civilization?.culture?.leaderId === agent.id ? ` · Leader of ${escape(group.name)}` : ''}</span></div>`);
  update('.activity', `<i></i>${escape(agent.action)}`);
  const psyche = agent.psyche;
  update('.mind-thought', psyche?.thought ? `“${escape(psyche.thought)}”` : '');
  update('.needs-list', needs.map(([name, value]) => `<div class="need-row"><span>${name}</span><span class="meter"><i style="width:${percent(value)}%;background:${value < 30 ? '#be9a79' : '#a4b581'}"></i></span><span class="value">${number(value)}%</span></div>`).join(''));
  update('.traits', traits.map(trait => `<span>${trait}</span>`).join(''));
  const aspiration = psyche?.aspiration;
  update('.mind-goal', `${aspiration ? `<p class="inspector-label">Life aspiration${aspiration.achieved ? ` · ${number(aspiration.achieved)} achieved so far` : ''}</p><strong>${escape(aspiration.text)}</strong><div class="aspiration-progress"><span class="drive-meter"><i style="width:${percent(aspiration.progress * 100)}%"></i></span><span>${number(aspiration.progress * 100)}%</span></div><p class="quiet-note">Held since ${calendar(aspiration.since)} · it shapes which work feels worthwhile.</p>` : ''}<p class="inspector-label goal-label">Working toward now</p><strong>${escape(mind.goal || 'Meeting immediate needs')}</strong><p>${escape(mind.intention || '')}</p>${mind.plan?.steps?.length ? `<ol class="plan-steps">${mind.plan.steps.map(step => `<li>${escape(step)}</li>`).join('')}</ol><span class="quiet-note">Plan reconsidered by ${calendar(mind.plan.until)}</span>` : ''}`);
  const reasoning = psyche?.reasoning || [];
  const reasoned = new Set(reasoning.map(item => item.action));
  const others = (mind.policy?.scores || []).filter(choice => !reasoned.has(choice.action));
  update('.mind-policy', `<p class="policy-action">${escape(title(mind.policy?.action || agent.action))}</p><p class="policy-reason">${escape(mind.policy?.reason || 'Responding to immediate needs.')}</p>${reasoning.length ? `<p class="inspector-label">How the leading options were weighed</p>${reasoning.map(item => `<div class="reason-option ${item.action === mind.policy?.action ? 'chosen' : ''}"><div class="reason-head"><span>${escape(title(item.action))}${item.action === mind.policy?.action ? ' ✓' : ''}</span><strong>${decimal(item.score)}</strong></div><p class="reason-base">Circumstances ${decimal(item.base)}${item.factors.length ? ' · personal reasons' : ''}</p>${item.factors.length ? `<ul class="reason-factors">${item.factors.map(factor => `<li class="${factor.value >= 0 ? 'up' : 'down'}"><strong>${signed(factor.value)}</strong> ${escape(factor.label)}</li>`).join('')}</ul>` : ''}</div>`).join('')}` : ''}${others.length ? `<p class="inspector-label">${reasoning.length ? 'Other options' : 'Considered actions · utility score'}</p><div class="policy-scores">${others.map(choice => `<div class="policy-score ${choice.action === mind.policy.action ? 'chosen' : ''}"><span>${escape(title(choice.action))}${choice.action === mind.policy.action ? ' ✓' : ''}</span><strong>${decimal(choice.score)}</strong></div>`).join('')}</div>` : ''}<p class="quiet-note">Circumstances are needs, values and opportunities; personal reasons come from temperament, mood, memories, experience and life goals. Survival needs can override both.</p>`);
  update('.mind-skills', `<div class="skills-list">${[...SKILLS].sort((a, b) => (agent.skills?.[b] || 0) - (agent.skills?.[a] || 0)).map(skill => `<div class="skill-row"><span title="${psyche ? `Learns ${escape(skill)} at ${decimal(psyche.talents[skill])}× the usual pace` : ''}">${escape(title(skill))}${psyche?.talents[skill] >= 1.25 ? ' <b class="talent-mark" aria-label="natural talent">★</b>' : ''}</span><meter min="0" max="100" value="${percent(agent.skills?.[skill])}" aria-label="${escape(title(skill))} proficiency">${decimal(agent.skills?.[skill])}</meter><strong>${decimal(agent.skills?.[skill])}</strong></div>`).join('')}</div><p class="quiet-note">Proficiency out of 100 · ★ natural talent · skills fade slowly when not practised.</p><p class="inspector-label">Foundation techniques</p><div class="knowledge-chips">${agent.knowledge?.length ? agent.knowledge.map(id => `<span class="knowledge-chip" title="${escape(techById.get(id)?.description || '')}">${escape(techName(id))}</span>`).join('') : '<span class="quiet-note">No technologies learned yet</span>'}</div>`);
  update('.mind-techniques', `<p class="inspector-label">Practical techniques · ${number(psyche?.techniques.length)} of ${TECHNIQUES.length}</p>${psyche?.techniques.length ? `<div class="technique-list">${psyche.techniques.map(entry => { const technique = practiceById.get(entry.id); return `<div class="technique-row" title="${escape(technique?.description || '')}"><span>⚑ ${escape(technique?.name || entry.id)}</span><small>${entry.source === 'practice' ? 'worked out alone' : `taught by ${snapshot.agents.some(a => a.id === entry.teacherId) ? `<button data-person="${Number(entry.teacherId)}">${escape(entry.teacher)}</button>` : escape(entry.teacher)}`} · ${calendar(entry.day)}</small></div>`; }).join('')}</div>` : '<p class="quiet-note">No techniques yet. They come from sustained practice or a skilled teacher.</p>'}`);
  if (psyche) {
    const moods = EMOTIONS.map(emotion => [emotion, psyche.mood[emotion]]).sort((a, b) => b[1] - a[1]);
    const talents = Object.entries(psyche.talents).sort((a, b) => b[1] - a[1]);
    update('.mind-temperament', `<p class="inspector-label">Personality</p>${PERSONALITY.map(key => `<div class="trait-scale"><span>${PERSONALITY_LABELS[key][0]}</span><span class="scale-track"><i style="left:${percent(psyche.personality[key] * 100)}%"></i></span><span>${PERSONALITY_LABELS[key][1]}</span></div>`).join('')}<p class="inspector-label">Current feelings${moods[0][1] > .15 ? ` · mostly ${escape(moods[0][0])}` : ''}</p><div class="mood-grid">${moods.map(([emotion, value]) => `<span class="mood-chip ${value > .15 ? 'felt' : ''}"><b>${EMOTION_SYMBOLS[emotion]}</b>${escape(title(emotion))}<span class="drive-meter"><i style="width:${percent(value * 100)}%"></i></span></span>`).join('')}</div>${agent.attraction ? `<p class="quiet-note">Attracted to ${{ different: 'a different sex', same: 'the same sex', both: 'any sex' }[agent.attraction]}.</p>` : ''}<p class="inspector-label">Pioneering drive</p><div class="drive-row"><span>Drawn to new lands</span><span class="drive-meter"><i style="width:${percent((psyche.expansion || 0) * 100)}%"></i></span><strong>${number((psyche.expansion || 0) * 100)}%</strong></div><p class="inspector-label">Natural aptitudes</p><p class="talent-line">Quick to learn <strong>${talents.slice(0, 2).map(([skill]) => escape(skill)).join(' and ')}</strong>; slower at <strong>${escape(talents.at(-1)[0])}</strong>.</p><p class="quiet-note">Temperament is inherited with variation. Feelings rise with events, colour choices, spread in conversation and fade with time.</p>`);
    const liked = Object.entries(psyche.preferences).filter(([, value]) => Math.abs(value) >= .05).sort((a, b) => b[1] - a[1]);
    const record = Object.entries(psyche.expectations).sort((a, b) => b[1] - a[1]);
    const places = [...psyche.places].sort((a, b) => b.value - a.value);
    const life = psyche.record;
    update('.mind-experience', `<p class="inspector-label">Enjoys and dislikes</p>${liked.length ? `<div class="knowledge-chips">${liked.map(([action, value]) => `<span class="knowledge-chip ${value < 0 ? 'dislike' : ''}">${value < 0 ? '−' : '+'} ${escape(activityLabel(action))}</span>`).join('')}</div>` : '<p class="quiet-note">No settled tastes yet.</p>'}<p class="inspector-label">Track record · what experience says pays off</p>${record.length ? record.map(([action, value]) => `<div class="track-row"><span>${escape(title(activityLabel(action)))}</span><span class="track-bar"><i class="${value < 0 ? 'down' : 'up'}" style="${value < 0 ? `right:50%;width:${percent(-value * 50)}%` : `left:50%;width:${percent(value * 50)}%`}"></i></span><strong>${signed(value * 100)}</strong></div>`).join('') : '<p class="quiet-note">Untried. Curiosity will lead the way at first.</p>'}<p class="inspector-label">Places they remember</p>${places.length ? places.map(place => { const region = nearestRegion(place); return `<div class="place-row"><span>${place.value > .7 ? 'Rich' : 'Useful'} ${PLACE_NAMES[place.kind]}${region ? ` near ${escape(region.name)}` : ''}</span><small>${calendar(place.day)}</small></div>`; }).join('') : '<p class="quiet-note">No remembered places yet.</p>'}<p class="inspector-label">A life’s work</p><div class="value-grid">${[['Discoveries contributed', life.discovered], ['Lessons given', Math.floor(life.taught)], ['Health restored', life.healed], ['Buildings raised', life.built], ['Trades made', life.traded], ['Food provided', life.provided], ['Settlements founded', life.founded || 0], ['Private wealth', agent.wealth || 0]].map(([name, value]) => `<span>${name}<strong>${decimal(value)}</strong></span>`).join('')}</div>`);
  }
  const relations = [...(agent.relations || [])].sort((a, b) => b.strength - a.strength);
  update('.mind-people', relations.length ? `${relations.map(relation => { const other = snapshot.agents.find(a => a.id === relation.id); const trust = relation.trust ?? .42 + relation.strength * .2; return `<div class="relation-row"><div>${other ? `<button data-person="${other.id}">${escape(other.name)}</button>` : `Person #${relation.id}`}${other?.id === agent.partnerId ? ' <small>partner</small>' : agent.parentIds.includes(relation.id) ? ' <small>parent</small>' : agent.children.includes(relation.id) ? ' <small>child</small>' : ''}${relation.expertise ? `<small class="expertise">known for ${escape(relation.expertise)}</small>` : ''}</div><div class="relation-stats"><span title="Bond strength">♡ ${number(relation.strength * 100)}</span><span title="Personal trust">◎ ${number(trust * 100)}</span>${relation.favors ? `<span title="Favours received from them">⇠ ${decimal(relation.favors)}</span>` : ''}</div></div>`; }).join('')}<p class="quiet-note">♡ bond · ◎ trust (shaped by favours, lessons and gossip) · ⇠ favours received. Up to 12 people are remembered.</p>` : '<p class="quiet-note">No lasting relationships yet.</p>');
  const discovered = new Map((snapshot.innovation?.discoveries || []).map(idea => [idea.id, idea]));
  update('.mind-ideas', `<p class="inspector-label">Generated ideas known · ${number(agent.ideas?.length)}</p><div class="knowledge-chips" tabindex="0" aria-label="All generated ideas known by this person">${agent.ideas?.length ? agent.ideas.map(id => `<span class="knowledge-chip ${discovered.get(id)?.kind === 'belief' ? 'belief' : ''}" title="${escape(discovered.get(id)?.description || '')}">${discovered.get(id)?.kind === 'belief' ? '◈ ' : ''}${escape(discovered.get(id)?.name || id)}</span>`).join('') : '<span class="quiet-note">No generated ideas learned yet</span>'}</div>`);
  update('.mind-convictions', `<p class="inspector-label">Convictions in shared traditions</p>${Object.entries(agent.convictions || {}).length ? Object.entries(agent.convictions).sort((a, b) => b[1] - a[1]).map(([id, strength]) => `<div class="conviction-row"><span>${escape(discovered.get(id)?.name || id)}</span><strong>${number(strength * 100)}%</strong></div>`).join('') : '<p class="quiet-note">No shared tradition adopted yet</p>'}<p class="quiet-note">Conviction measures personal commitment, not truth or approval.</p>`);
  update('.mind-values', `<p class="inspector-label">Personal values · relative strength</p><div class="value-grid">${Object.entries(mind.values || {}).map(([name, value]) => `<span>${escape(title(name))}<strong>${number(value * 100)}%</strong></span>`).join('')}</div><div class="disposition-line">${[['Ambition', mind.ambition], ['Patience', mind.patience], ['Risk tolerance', mind.riskTolerance]].map(([name, value]) => `<span>${name}<strong>${number(value * 100)}%</strong></span>`).join('')}</div><p class="inspector-label">Unmet desires · higher means more pressing</p>${Object.entries(mind.needs || {}).map(([name, value]) => `<div class="drive-row"><span>${escape(title(name))}</span><span class="drive-meter"><i style="width:${percent(value)}%"></i></span><strong>${number(value)}%</strong></div>`).join('')}`);
  update('.mind-beliefs', `<p class="inspector-label">Beliefs about the world</p><div class="belief-grid">${Object.entries(mind.beliefs || {}).map(([name, value]) => `<span>${escape(title(name))}<strong>${number(value * 100)}%</strong></span>`).join('')}</div><p class="quiet-note">Personal estimates shaped by experience, not world facts.</p>`);
  const formative = [...(psyche?.episodes || [])].sort((a, b) => b.salience - a.salience);
  update('.mind-memories', `<p class="inspector-label">Formative memories · most vivid first</p>${formative.length ? formative.map(episode => `<article class="mind-memory episode ${episode.valence > .2 ? 'warm' : episode.valence < -.2 ? 'painful' : ''}"><p>${escape(episode.text)}</p><time>${calendar(episode.day)} · ${escape(title(episode.type))} · ${episode.salience > .6 ? 'vivid' : episode.salience > .3 ? 'clear' : 'fading'}</time></article>`).join('') : '<p class="quiet-note">Nothing has left a lasting mark yet.</p>'}<p class="inspector-label">Recent moments</p>${mind.memories?.length ? [...mind.memories].sort((a, b) => b.day - a.day).map(memory => `<article class="mind-memory"><p>${escape(memory.text)}</p><time>${calendar(memory.day)} · ${escape(title(memory.type))}</time></article>`).join('') : '<p class="quiet-note">A life just beginning. Memories will appear here.</p>'}`);
  update('.person-family', `${partner ? `Partner: ${escape(partner.name)}` : 'No current partner'} · ${agent.children.length} children<br>${number(agent.inventory.food)} food · ${number(agent.inventory.wood)} wood${parents.length ? `<br>Parents: ${parents.map(escape).join(', ')}` : '<br>A founding individual'}`);
  panel.querySelector('#follow-btn').textContent = following ? 'Stop following' : 'Follow this life ↗';
  const possess = panel.querySelector('#possess-btn');
  possess.textContent = snapshot.player?.id === agent.id ? 'Let them live on their own' : 'Take charge of this life';
  possess.hidden = agent.age < 12;
}

function renderChart() {
  const history = snapshot.history;
  $('#chart-empty').hidden = history.length > 1;
  const points = history.length ? history : [{ day: 0, population: snapshot.stats.population }];
  const max = Math.max(10, ...points.map(p => p.population)) * 1.12;
  const first = points[0].day;
  const last = Math.max(first + 1, points.at(-1).day);
  const coords = points.map(p => [((p.day - first) / (last - first)) * 866 + 2, 115 - (p.population / max) * 105]);
  const line = coords.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  $('#history-chart').innerHTML = `<defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#a9bd80" stop-opacity=".23"/><stop offset="100%" stop-color="#a9bd80" stop-opacity=".01"/></linearGradient></defs>${[30, 70, 115].map(y => `<path d="M0 ${y}H875" stroke="#e9eddf" stroke-width="1" stroke-dasharray="3 5"/>`).join('')}<text x="899" y="15" text-anchor="end" fill="#a6b196" font-size="10">${number(max)}</text><text x="899" y="119" text-anchor="end" fill="#a6b196" font-size="10">0</text>${coords.length > 1 ? `<path d="${line} L${coords.at(-1)[0]},118 L2,118 Z" fill="url(#chart-fill)"/><path d="${line}" fill="none" stroke="#8b9f6c" stroke-width="2" vector-effect="non-scaling-stroke"/><circle cx="${coords.at(-1)[0]}" cy="${coords.at(-1)[1]}" r="3" fill="#839964"/>` : ''}`;
  const recent = history.slice(-45);
  const low = Math.min(...recent.map(p => p.population));
  const high = Math.max(low + 10, ...recent.map(p => p.population));
  $('#population-spark').innerHTML = recent.length > 1 ? `<path d="${recent.map((p, i) => `${i ? 'L' : 'M'}${i / (recent.length - 1) * 99},${28 - ((p.population - low) / (high - low)) * 23}`).join(' ')}" fill="none" stroke="#aebd91" stroke-width="1.5"/>` : '';
  $('#chart-start').textContent = `Year ${number(Math.floor(first / DAYS) + 1)}`;
  $('#chart-end').textContent = `Year ${number(Math.floor(snapshot.day / DAYS) + 1)}`;
  $('#history-range').textContent = first > 0 ? 'RECENT HISTORY' : 'ALL TIME';
  $('#history-subtitle').textContent = `${number(snapshot.stats.births)} births · ${number(snapshot.stats.deaths)} deaths · ${number(snapshot.stats.food)} food available`;
}

async function saveLocal(force = false) {
  if (!ready || (!force && snapshot.day === lastSaveDay)) return;
  if (saving) { saveAgain = true; return; }
  saving = true;
  try {
    const state = await request('serialize');
    await storeWorld(envelope(state));
    lastSaveDay = state.day ?? snapshot.day;
    $('#save-status').innerHTML = '<i></i> Saved locally';
    $('#save-status').title = `Last saved ${new Date().toLocaleTimeString()}`;
  } catch (error) {
    $('#save-status').textContent = 'Export to keep this world';
    if (force) throw error;
  } finally {
    saving = false;
    if (saveAgain) { saveAgain = false; saveLocal(true).catch(report); }
  }
}

async function exportWorld(announce = true) {
  if (!ready) return;
  const state = await request('serialize');
  const blob = new Blob([JSON.stringify(envelope(state))], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `common-ground-${snapshot.seed.replace(/[^a-z0-9-]/gi, '-').slice(0, 40)}-day-${snapshot.day}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  if (announce) toast('World exported. Import this file any time to continue.');
}

$('#play-btn').addEventListener('click', act(() => ready && request('running', { running: !running })));
$('#step-btn').addEventListener('click', act(() => ready && request('step')));
$$('[data-speed]').forEach(button => button.addEventListener('click', act(() => request('speed', { speed: Number(button.dataset.speed) }))));
$$('[data-overlay]').forEach(button => button.addEventListener('click', () => {
  $$('[data-overlay]').forEach(other => { other.classList.toggle('active', other === button); other.setAttribute('aria-pressed', String(other === button)); });
  view.setOverlay(button.dataset.overlay);
  const legends = { natural: '<span><i class="legend-citizen"></i> Individual</span><span><i class="legend-forest"></i> Woodland</span><span><i style="background:#b0aa78"></i> Cleared</span><span><i style="background:#d2bf6e"></i> Fields</span><span><i style="background:#ded0a4"></i> Road</span><span><i style="background:#4b4a4c"></i> Railway</span><span><i style="background:#d6e8ec"></i> Sea route</span><span><i style="background:#eef0f4"></i> Air route</span><span><i style="background:#b2402e"></i> War front</span><span><i style="background:#42342a"></i> Battlefield</span><span><i style="background:#58804a"></i> Green belt</span><span><i style="background:#3a5478"></i> Solar field</span><span><i class="legend-water"></i> Water</span>', food: '<span><i style="background:#cbbd75"></i> Depleted</span><span><i style="background:#6cab79"></i> Abundant food</span>', societies: '<span><i class="legend-citizen"></i> Society influence</span><span>Colors identify groups</span>', knowledge: '<span><i style="background:#ccac60"></i> Ideas</span><span><i style="background:#7fa58a"></i> Teaching</span><span>Exchanges · last 45 days</span>', relations: '<span><i style="background:#b46f59"></i> War</span><span><i style="background:#91bda3"></i> Alliance</span><span><i style="background:#e2bb75"></i> Trade</span><span>◈ Belief tradition</span>', industry: '<span><i style="background:#bd875c"></i> Ore</span><span><i style="background:#d2d3c4"></i> Stone</span><span><i style="background:#c5b777"></i> Fertile soil</span><span><i style="background:#3a3836"></i> Coal</span><span><i style="background:#9fc25a"></i> Uranium</span>' };
  $('#map-legend').innerHTML = legends[button.dataset.overlay] || legends.natural;
}));
$('#zoom-in').addEventListener('click', () => view.zoomBy(1.35));
$('#zoom-out').addEventListener('click', () => view.zoomBy(1 / 1.35));
$('#reset-view').addEventListener('click', () => { following = false; view.setFollow(null); view.resetView(); renderIndividual(); });
$('#world-nav').addEventListener('click', () => { window.scrollTo({ top: 0, behavior: 'smooth' }); });
$('#save-btn').addEventListener('click', act(() => exportWorld()));
$('#guide-btn').addEventListener('click', () => $('#guide-dialog').showModal());
$('#conditions-btn').addEventListener('click', () => {
  if (!snapshot) return;
  $$('[data-condition]').forEach(input => {
    input.value = snapshot.config[input.dataset.condition];
    $(`#${input.dataset.condition}-output`).value = `${Number(input.value).toFixed(1)}×`;
  });
  $('#conditions-dialog').showModal();
});
$('#new-btn').addEventListener('click', () => {
  const seeds = ['fern', 'willow', 'meadow', 'cedar', 'clover', 'moss', 'hazel'];
  $('#seed-input').value = `${seeds[Math.floor(Math.random() * seeds.length)]}-${Math.floor(Math.random() * 900 + 100)}`;
  $('#new-dialog').showModal();
});
$$('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
$$('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) { const box = dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close(); } }));
$('#new-form').addEventListener('submit', act(async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('[type=submit]');
  button.disabled = true;
  try {
    const data = new FormData(form);
    const scenario = data.get('scenario');
    const config = { seed: data.get('seed').trim() || 'moss-17', size: data.get('size'), population: Number(data.get('population')), abundance: scenario === 'scarce' ? .45 : 1, cooperation: scenario === 'cooperative' ? 1.7 : 1, fertility: 1 };
    if (!Number.isSafeInteger(config.population) || config.population < 1) throw new Error('Enter a positive whole number of founding people.');
    await exportWorld(false);
    await request('init', { config });
    selectAgent(null);
    lastChart = -1;
    lastSidebar = 0;
    lastSaveDay = -1;
    $('#new-dialog').close();
    await saveLocal(true);
    toast('A new beginning. The previous world was exported.');
  } finally { button.disabled = false; }
}));
$$('[data-condition]').forEach(input => {
  input.addEventListener('input', () => { $(`#${input.dataset.condition}-output`).value = `${Number(input.value).toFixed(1)}×`; });
  input.addEventListener('change', act(async () => { await request('configure', { [input.dataset.condition]: Number(input.value) }); await saveLocal(true); }));
});
const actButton = entry => `<button class="button secondary act-button" data-intervention="${entry.id}" title="${escape(entry.description)}"><span>${icon(entry.icon)}</span><strong>${escape(entry.name)}</strong><small>${escape(entry.description)}</small></button>`;
$('#world-acts').innerHTML = ACTS.filter(entry => entry.scope === 'world').map(actButton).join('');
$('#region-acts').innerHTML = ACTS.filter(entry => entry.scope === 'region').map(actButton).join('');
$('#society-acts').innerHTML = ACTS.filter(entry => entry.scope === 'society').map(actButton).join('');
$$('[data-intervention]').forEach(button => button.addEventListener('click', act(async () => {
  const entry = ACTS.find(candidate => candidate.id === button.dataset.intervention);
  const chosen = $('#act-region').value;
  const region = (entry.scope === 'region' || entry.id === 'settle') && chosen ? Number(chosen) : null;
  const society = entry.scope === 'society' ? Number($('#act-society').value) || null : null;
  if (entry.scope === 'society' && !society) { toast('Choose a society first.'); return; }
  button.disabled = true;
  try {
    await request('intervene', { kind: entry.id, region, society });
    toast(`${entry.toast}${entry.scope === 'region' ? ` (${region ? (snapshot?.regions.find(candidate => candidate.id === region)?.name || 'chosen region') : 'fate chose the place'})` : entry.scope === 'society' ? ` (${escape(snapshot?.groups.find(group => group.id === society)?.name || 'the society')})` : ''}`);
    await saveLocal(true);
  } finally { button.disabled = false; }
})));
function activateObservation(button) {
  tab = button.dataset.tab;
  $$('[data-tab]').forEach(other => {
    other.classList.toggle('active', other === button);
    other.setAttribute('aria-selected', String(other === button));
    other.tabIndex = other === button ? 0 : -1;
  });
  const content = $('#observation-content');
  content.innerHTML = '';
  content.setAttribute('aria-labelledby', button.id);
  peopleQuery = '';
  renderObservation();
}
function activateCivilization(button) {
  civilizationTab = button.dataset.civilizationTab;
  ideasQuery = '';
  ideaPage = 0;
  if ($('#civilization-content').contains(document.activeElement)) document.activeElement.blur();
  $$('[data-civilization-tab]').forEach(other => {
    other.classList.toggle('active', other === button);
    other.setAttribute('aria-selected', String(other === button));
    other.tabIndex = other === button ? 0 : -1;
  });
  $('#civilization-content').setAttribute('aria-labelledby', button.id);
  renderCivilization();
}
function wireTabs(selector, activate) {
  const buttons = $$(selector);
  buttons.forEach((button, index) => {
    button.addEventListener('click', () => activate(button));
    button.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % buttons.length;
      else if (event.key === 'ArrowLeft') next = (index - 1 + buttons.length) % buttons.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = buttons.length - 1;
      else return;
      event.preventDefault();
      buttons[next].focus();
      activate(buttons[next]);
    });
  });
}
wireTabs('[data-tab]', activateObservation);
wireTabs('[data-civilization-tab]', activateCivilization);
$('#civilization-society').addEventListener('change', event => {
  civilizationSociety = event.target.value;
  ideaPage = 0;
  renderCivilization();
});
$('#civilization-content').addEventListener('input', event => {
  if (event.target.id !== 'ideas-search') return;
  ideasQuery = event.target.value;
  ideaPage = 0;
  const cursor = event.target.selectionStart;
  event.target.blur();
  renderCivilization();
  const input = $('#ideas-search');
  input.focus({ preventScroll: true });
  input.setSelectionRange(cursor, cursor);
});
$('#observation-content').addEventListener('input', event => { if (event.target.id === 'people-search') { peopleQuery = event.target.value; renderObservation(); } });
document.addEventListener('click', event => {
  const pageButton = event.target.closest('[data-idea-page]');
  if (pageButton) { ideaPage = Math.max(0, Number(pageButton.dataset.ideaPage)); pageButton.blur(); renderCivilization(); }
  const societyButton = event.target.closest('[data-society]');
  if (societyButton) {
    civilizationSociety = societyButton.dataset.society;
    $('#civilization-society').value = civilizationSociety;
    const knowledgeTab = $('[data-civilization-tab="inventions"]');
    knowledgeTab.focus({ preventScroll: true });
    activateCivilization(knowledgeTab);
    $('.civilization-panel').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'nearest' });
  }
  const focusButton = event.target.closest('[data-focus]');
  if (focusButton) {
    const [x, y] = focusButton.dataset.focus.split(',').map(Number);
    following = false; view.focusOn(x, y);
    $('#world-canvas').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  const personButton = event.target.closest('[data-person]');
  if (personButton) { selectAgent(Number(personButton.dataset.person)); view.setFollow(selectedId); following = true; renderIndividual(); }
  if (event.target.closest('[data-dismiss-person]')) selectAgent(null);
  if (event.target.closest('#meet-btn') && snapshot?.agents.length) {
    selectAgent(snapshot.agents[Math.floor(Math.random() * snapshot.agents.length)].id);
    following = true;
    view.setFollow(selectedId);
    renderIndividual();
  }
  if (event.target.closest('#follow-btn')) { following = !following; view.setFollow(following ? selectedId : null); renderIndividual(); }
  if (event.target.closest('#possess-btn')) {
    const releasing = snapshot.player?.id === selectedId;
    request('command', releasing ? { type: 'release' } : { type: 'possess', id: selectedId }).then(message => {
      toast(message);
      if (!releasing) { following = true; view.setFollow(selectedId); request('speed', { speed: 1 }).catch(report); }
    }).catch(report);
  }
});
document.addEventListener('keydown', act(async event => {
  if (event.code === 'Space' && !/INPUT|SELECT|TEXTAREA|BUTTON/.test(event.target.tagName) && !event.target.isContentEditable && !document.querySelector('dialog[open]')) {
    event.preventDefault();
    if (ready) await request('running', { running: !running });
  }
}));
$('#import-btn').addEventListener('click', () => $('#import-file').click());
$('#import-file').addEventListener('change', act(async event => {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  const state = unwrap(JSON.parse(await file.text()));
  await request('validate', { state });
  await exportWorld(false);
  await request('init', { state, running: false });
  selectedId = null;
  following = false;
  view.setFollow(null);
  view.setSelected(null);
  lastSaveDay = -1;
  lastChart = -1;
  lastSidebar = 0;
  render();
  await saveLocal(true);
  toast('World restored and paused. Press play to continue.');
}));
document.addEventListener('visibilitychange', () => {
  request('visible', { visible: !document.hidden }).catch(report);
  if (document.hidden) saveLocal().catch(report);
});
window.addEventListener('pagehide', () => { saveLocal().catch(() => {}); });

async function start() {
  let restored = false;
  let failedSave = false;
  for (const key of ['current', 'previous']) {
    try {
      const saved = await loadWorld(key);
      if (saved) {
        await request('init', { state: unwrap(saved) });
        restored = true;
        toast(key === 'previous' ? 'Recovered your previous autosave.' : 'Welcome back. Your world has been restored.');
        break;
      }
    } catch (error) { failedSave = true; console.warn('Could not restore local world:', error.message); }
  }
  if (!restored) {
    await request('init', { config: { seed: 'moss-17', size: 'vast', population: 150, abundance: 1, cooperation: 1, fertility: 1 } });
    if (failedSave) toast('Could not restore the local save. A new world is open; import an exported checkpoint to recover.');
  }
  ready = true;
  $('#loading').hidden = true;
  renderObservation();
  renderCivilization();
  renderChart();
  await saveLocal();
  setInterval(() => saveLocal().catch(report), 60000);
}
start().catch(error => { report(error); $('#loading p').textContent = `Unable to open the world: ${error.message}`; });
