/** Wars with a history: why they start, how they are fought, how they end, what they leave.
 *
 * A war begins for a reason read from the situation between two societies:
 * contested land, hunger, coal or uranium between them, faith or ideology,
 * an old defeat to avenge, an overlord's ambition, a tributary's bid for
 * freedom, or a refusal to submit. The side with the stronger motive attacks,
 * with a war aim that follows from its cause. Allies and fellow members of a
 * country may join either side, so a local quarrel can widen into a great war.
 *
 * Fighting comes in campaigns separated by lulls, so a war can last years.
 * Battles shift a war score; casualties, hunger, time and a losing score wear
 * each side down against its resolve, which rises with martial culture, a
 * warlike government and what is at stake. When a side's weariness passes its
 * resolve it seeks terms: the stronger side imposes its aim (conquest, tribute,
 * reparations, independence, a friendly government), or an exhausted
 * stalemate ends in a white peace.
 *
 * While it lasts, a war puts economies on a war footing, mobilises soldiers,
 * burns fields, drives refugees to safer neighbours and shifts opinion. When
 * it ends, the victors grow prouder and more warlike, and the defeated either
 * turn against war or nurse a grievance that can start the next one. Losing
 * governments fall. All randomness comes from the world's saved generator.
 */
import { appraise, feel } from './psyche.js';
import { countryOf, rulingParty, partiesOf, AXES } from './polity.js';
import { industry } from './civilization.js';

const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const round = value => Math.round(value * 1e4) / 1e4 || 0;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const YEAR = 120;

/** Why wars start, and what the attacker then fights for. */
export const CAUSES = Object.freeze({
  territory: { label: 'Contested land', goal: 'land' },
  hunger: { label: 'Hunger and scarcity', goal: 'plunder' },
  resources: { label: 'Mineral wealth', goal: 'land' },
  faith: { label: 'Faith', goal: 'regime' },
  ideology: { label: 'Ideology', goal: 'regime' },
  revenge: { label: 'Revenge for an earlier war', goal: 'retribution' },
  conquest: { label: 'Imperial ambition', goal: 'conquest' },
  submission: { label: 'Refusal to submit', goal: 'tribute' },
  independence: { label: 'Independence', goal: 'independence' },
  trade: { label: 'Trade dispute', goal: 'reparations' },
  provocation: { label: 'Provocation', goal: 'reparations' },
  grievance: { label: 'Old grievances', goal: 'reparations' },
});
export const GOALS = Object.freeze({
  land: 'take the disputed land and make the enemy pay',
  plunder: 'seize food and stores',
  regime: 'impose its own ways and a friendly government',
  retribution: 'avenge its earlier defeat',
  conquest: 'conquer and rule',
  tribute: 'force submission and tribute',
  independence: 'win freedom from its overlord',
  reparations: 'extract reparations',
});
const ORDINALS = ['', 'Second ', 'Third ', 'Fourth ', 'Fifth ', 'Sixth ', 'Seventh ', 'Eighth ', 'Ninth ', 'Tenth '];
const ordinal = n => n < ORDINALS.length ? ORDINALS[n] : `${n + 1}th `;
const root = group => group.name.split(' ')[0];

export function wars(sim) { return sim.diplomacy?.wars || []; }
export function warById(sim, id) { return wars(sim).find(war => war.id === id) || null; }
export function warOf(sim, relation) { return relation?.warId ? warById(sim, relation.warId) : null; }
/** The ongoing wars a society is fighting, and which side it is on. */
export function warsOf(sim, group) {
  return wars(sim).filter(war => war.end === null && (war.attackers.includes(group.id) || war.defenders.includes(group.id)));
}
const sideOf = (war, id) => war.attackers.includes(id) ? 0 : war.defenders.includes(id) ? 1 : -1;

/** What drove two societies to war, and who strikes first. */
export function casusBelli(sim, a, b, factors) {
  const { scarcity = 0, doctrinal = 0, friction = 0, stressA = 0, stressB = 0, powerA = 1, powerB = 1 } = factors;
  const norms = group => group.civilization.culture?.norms || {};
  const ambitionOf = group => Math.max(norms(group).expansion ?? .4, norms(group).martial ?? .4);
  const past = wars(sim).filter(war => war.end !== null && [war.attacker, war.defender].includes(a.id) && [war.attacker, war.defender].includes(b.id)).at(-1);
  const deposits = mineralsBetween(sim, a, b), needy = Math.max(industry(a).machines, industry(b).machines) > 0;
  const relation = sim.diplomacy.relations.find(r => r.a === Math.min(a.id, b.id) && r.b === Math.max(a.id, b.id));
  const faithGap = Math.abs((norms(a).piety ?? .4) - (norms(b).piety ?? .4));
  const motives = {
    territory: friction * 1.2 + .1,
    hunger: scarcity * 1.6,
    resources: deposits && needy ? .6 + deposits * .5 : 0,
    faith: doctrinal * faithGap * 3,
    ideology: doctrinal * (1 - faithGap) * 2 + (partiesOf(sim, a).length && partiesOf(sim, b).length ? .15 : 0),
    revenge: past && past.outcome?.winner ? .9 : 0,
    conquest: Math.max(ambitionOf(a), ambitionOf(b)) > .6 ? (Math.max(ambitionOf(a), ambitionOf(b)) - .5) * 2 * (Math.abs(powerA - powerB) / Math.max(1, powerA + powerB) + .3) : 0,
    trade: relation?.tradeTotal > 30 ? .35 : 0,
  };
  let cause = 'grievance', best = .15;
  for (const [key, value] of Object.entries(motives)) {
    const weighed = value * (.75 + sim._random() * .5);
    if (weighed > best) { best = weighed; cause = key; }
  }
  // The side with more to gain, or more to avenge, attacks.
  let attacker = a;
  if (cause === 'hunger') attacker = stressA >= stressB ? a : b;
  else if (cause === 'revenge') attacker = past.outcome.winner === 'attackers' ? (past.defender === a.id ? a : b) : (past.attacker === a.id ? a : b);
  else if (cause === 'conquest' || cause === 'territory') attacker = ambitionOf(a) * powerA >= ambitionOf(b) * powerB ? a : b;
  else if (cause === 'resources') attacker = industry(a).machines >= industry(b).machines ? a : b;
  else attacker = (norms(a).martial ?? .5) >= (norms(b).martial ?? .5) ? a : b;
  return { cause, attacker, defender: attacker === a ? b : a, mineral: deposits ? mineralName(sim, a, b) : null };
}

// Coal, uranium or ore in the land between two societies.
function mineralSamples(sim, a, b) {
  const samples = [];
  for (let t = .3; t <= .71; t += .2) {
    const x = Math.floor(a.x + (b.x - a.x) * t), y = Math.floor(a.y + (b.y - a.y) * t);
    const tile = sim.tiles?.[y * sim.width + x];
    if (tile && tile.terrain !== 'water') samples.push(tile);
  }
  return samples;
}
function mineralsBetween(sim, a, b) {
  return mineralSamples(sim, a, b).reduce((best, tile) => Math.max(best, tile.coal || 0, (tile.uranium || 0) * 1.5, (tile.ore || 0) * .6), 0);
}
function mineralName(sim, a, b) {
  const totals = { coal: 0, uranium: 0, iron: 0 };
  for (const tile of mineralSamples(sim, a, b)) { totals.coal += tile.coal || 0; totals.uranium += (tile.uranium || 0) * 1.5; totals.iron += (tile.ore || 0) * .6; }
  return Object.entries(totals).sort((x, y) => y[1] - x[1])[0][0];
}

function warName(sim, attacker, defender, cause, mineral, countries = [null, null]) {
  const pair = [attacker.id, defender.id];
  const earlier = wars(sim).filter(war => pair.includes(war.attacker) && pair.includes(war.defender)).length;
  const nth = ordinal(earlier);
  // A war between countries is named for them.
  const [ca, cd] = countries.map(id => countryById(sim, id));
  if (ca && cd && cause !== 'independence') {
    const between = wars(sim).filter(war => war.countries?.includes(ca.id) && war.countries?.includes(cd.id)).length;
    return `${ordinal(between)}War of the ${ca.name} and the ${cd.name}`;
  }
  const region = sim.regions?.length ? sim.regions.reduce((best, candidate) => distance(candidate, { x: (attacker.x + defender.x) / 2, y: (attacker.y + defender.y) / 2 }) < distance(best, { x: (attacker.x + defender.x) / 2, y: (attacker.y + defender.y) / 2 }) ? candidate : best, sim.regions[0]) : null;
  const pick = list => list[Math.floor(sim._random() * list.length)];
  switch (cause) {
    case 'independence': return `${nth}${root(attacker)} War of Independence`;
    case 'territory': return region && sim._random() < .6 ? `${nth}War of ${region.name}` : `${nth}${root(attacker)}–${root(defender)} Border War`;
    case 'resources': return `${nth}${mineral === 'uranium' ? 'Uranium' : mineral === 'iron' ? 'Iron' : 'Coal'} War${region ? ` of ${region.name}` : ''}`;
    case 'hunger': return `${nth}${pick(['Hunger', 'Famine', 'Granary'])} War of ${root(attacker)}`;
    case 'faith': return `${nth}${root(attacker)}–${root(defender)} ${pick(['War of Faith', 'Holy War', 'Crusade'])}`;
    case 'ideology': return `${nth}${root(attacker)}–${root(defender)} ${pick(['War of Ideas', 'Ideological War', 'Revolutionary War'])}`;
    case 'revenge': return `${nth}${root(attacker)}–${root(defender)} War`;
    case 'conquest': return `${nth}${root(attacker)} Invasion of ${root(defender)}`;
    case 'submission': return `${nth}War of ${root(defender)} Defiance`;
    case 'trade': return `${nth}${root(attacker)}–${root(defender)} Trade War`;
    default: return `${nth}${root(attacker)}–${root(defender)} War`;
  }
}

function peopleOf(sim, group) { return group.members.map(id => sim._agentMap.get(id)).filter(agent => agent && agent.health > 0); }

/**
 * Opens a war on a relation just turned to war. `attacker` strikes first for `cause`.
 * Allies and compatriots of each side may join. Returns the war.
 */
export function openWar(sim, relation, attacker, defender, cause = 'grievance', detail = {}) {
  const state = sim.diplomacy;
  state.wars ||= []; state.nextWar ||= 1;
  if (!CAUSES[cause]) cause = 'grievance';
  const countries = belligerentCountries(sim, attacker, defender);
  const war = {
    id: `war-${state.nextWar++}`, name: warName(sim, attacker, defender, cause, detail.mineral, countries), attacker: attacker.id, defender: defender.id, countries,
    attackers: [attacker.id], defenders: [defender.id], cause, goal: CAUSES[cause].goal, reason: detail.reason || CAUSES[cause].label,
    start: sim.day, end: null, phase: 'campaign', phaseUntil: sim.day + 30 + Math.floor(sim._random() * 50),
    score: 0, battles: 0, casualties: [0, 0], weariness: [0, 0], strength: [peopleOf(sim, attacker).length, peopleOf(sim, defender).length],
    front: { x: round((attacker.x + defender.x) / 2), y: round((attacker.y + defender.y) / 2) }, sites: [], refugees: 0, outcome: null,
    // Names are kept so the record still reads after a belligerent is conquered or gone.
    names: { [attacker.id]: attacker.name, [defender.id]: defender.name },
  };
  state.wars.push(war);
  relation.warId = war.id;
  sim._event('war', `${war.name}: ${attacker.name} goes to war with ${defender.name} to ${GOALS[war.goal]}. Cause: ${war.reason}`, { groupId: attacker.id });
  // Rally: at the start of a war people close ranks behind their own.
  for (const group of [attacker, defender]) for (const agent of peopleOf(sim, group)) { feel(agent, 'fear', .08); feel(agent, 'pride', .08); }
  widen(sim, war, detail.join);
  return war;
}

/** The countries a war is fought between (by ID), when its leaders belong to different ones. */
function belligerentCountries(sim, attacker, defender) {
  const a = countryOf(sim, attacker), d = countryOf(sim, defender);
  if (a && a === d) return [null, null];
  return [a?.id ?? null, d?.id ?? null];
}
const countryById = (sim, id) => (sim.polity?.countries || []).find(country => country.id === id) || null;
/** The distinct powers at war: each country counts once, as does each independent society. */
function powers(sim, war, side) {
  const country = countryById(sim, war.countries?.[side]);
  const list = side === 0 ? war.attackers : war.defenders;
  return (country ? 1 : 0) + list.filter(id => !country?.members.includes(id)).length;
}

/**
 * Who fights. A war between countries involves every settlement of both: all
 * members of each country join its side, including any that join the country
 * while the war lasts. Beyond them, allies with strong trust and tributaries
 * may be drawn in (at most three on a side). Every society on one side is then
 * at war with every society on the other, so fighting breaks out wherever they meet.
 */
function widen(sim, war, join) {
  const attacker = sim._groupMap.get(war.attacker), defender = sim._groupMap.get(war.defender);
  if (!attacker || !defender || !join) return;
  const joined = [];
  const enlist = (other, side, bond) => {
    war[side].push(other.id); war.names[other.id] = other.name;
    war.strength[side === 'attackers' ? 0 : 1] += peopleOf(sim, other).length;
    joined.push([other, side, bond]);
  };
  const taken = id => war.attackers.includes(id) || war.defenders.includes(id);
  // Whole countries go to war together.
  for (const [index, side] of [[0, 'attackers'], [1, 'defenders']]) {
    const country = countryById(sim, war.countries?.[index]);
    for (const id of country?.members || []) {
      const other = sim._groupMap.get(id);
      if (other && !taken(id)) enlist(other, side, `part of ${country.name}`);
    }
  }
  // Allies and tributaries may choose to join, if the enemy is within reach.
  const allies = side => war[side].filter(id => !countryById(sim, war.countries?.[side === 'attackers' ? 0 : 1])?.members.includes(id)).length - 1;
  const invited = [];
  for (const [leader, enemy, side] of [[defender, attacker, 'defenders'], [attacker, defender, 'attackers']]) {
    for (const other of sim.groups) {
      if (taken(other.id) || allies(side) >= 3 || countryOf(sim, other) && [war.countries?.[0], war.countries?.[1]].includes(countryOf(sim, other).id)) continue;
      const bond = join.relation(leader, other), hostile = join.relation(enemy, other);
      if (hostile && ['alliance', 'war', 'tributary'].includes(hostile.status)) continue;
      const allied = bond?.status === 'alliance' && bond.trust > .5;
      const vassal = bond?.status === 'tributary' && bond.overlord === leader.id;
      if (!(allied || vassal) || !join.contact(other, enemy) || peopleOf(sim, other).filter(agent => agent.age >= 18).length < 3) continue;
      const martial = other.civilization.culture?.norms.martial ?? .5;
      // Most stay out; a people defends its own more readily than it joins an attack.
      const odds = (vassal ? .4 : .2) * (side === 'defenders' ? 1.2 : .6) * (.5 + martial * .8);
      if (sim._random() < odds) invited.push([other, side, vassal ? `tributary of ${leader.name}` : `ally of ${leader.name}`]);
    }
  }
  for (const [other, side, bond] of invited) if (!taken(other.id) && allies(side) < 3) enlist(other, side, bond);
  engage(sim, war, join);
  // One line per joining society, not per pair of enemies.
  const byCountry = new Map();
  for (const [other, side, bond] of joined) {
    const key = bond.startsWith('part of ') ? bond : null;
    if (key) byCountry.set(key, [...(byCountry.get(key) || []), other]);
    else sim._event('war', `${other.name} joins ${war.name} as ${bond}.`, { groupId: other.id });
  }
  for (const [bond, members] of byCountry) sim._event('war', `${members.length === 1 ? members[0].name : `${members.length} settlements`} ${bond.replace('part of', 'of')} ${members.length === 1 ? 'is' : 'are'} drawn into ${war.name}.`, { groupId: members[0].id });
  const total = powers(sim, war, 0) + powers(sim, war, 1);
  if (total >= 5 && powers(sim, war, 0) >= 2 && powers(sim, war, 1) >= 2 && !/Great War/.test(war.name)) {
    const great = wars(sim).filter(other => /Great War/.test(other.name)).length;
    const old = war.name;
    war.name = `${ordinal(great)}Great War`;
    sim._event('war', `${old} widens into the ${war.name}: ${total} powers are now at war.`, { groupId: war.attacker });
  }
}

/** Every society on one side at war with every society on the other, unless already fighting another war. */
function engage(sim, war, join) {
  for (const a of war.attackers) for (const d of war.defenders) {
    const x = sim._groupMap.get(a), y = sim._groupMap.get(d);
    if (!x || !y) continue;
    const r = join.relation(x, y);
    if (r?.status === 'war') continue;
    join.declare(x, y, war, `${x.name} and ${y.name} are at war in ${war.name}.`, true);
  }
}

/**
 * When a side's leading settlement falls or empties in a war between countries,
 * the country fights on: leadership passes to its capital, or to its largest
 * remaining settlement. Returns whether the side still has a leader.
 */
export function succeed(sim, war, side, lost = null) {
  const index = side === 'attackers' ? 0 : 1, key = index === 0 ? 'attacker' : 'defender';
  if (!war.countries?.[index]) return false;
  const remaining = war[side].filter(id => id !== lost && sim._groupMap.get(id)?.members.length);
  if (!remaining.length) return false;
  const capital = countryById(sim, war.countries[index])?.capitalId;
  const next = remaining.includes(capital) ? capital : remaining.map(id => sim._groupMap.get(id)).sort((a, b) => b.members.length - a.members.length)[0].id;
  if (next === war[key]) return true;
  war[key] = next;
  war[side] = war[side].filter(id => id !== lost);
  sim._event('war', `${sim._groupMap.get(next).name} now leads its side in ${war.name}.`, { groupId: next });
  return true;
}

/** Monthly: settlements that have joined a belligerent country since the war began are drawn in. */
function mobilise(sim, war, join) {
  if (!war.countries?.[0] && !war.countries?.[1]) return;
  const before = war.attackers.length + war.defenders.length;
  const fresh = [];
  for (const [index, side] of [[0, 'attackers'], [1, 'defenders']]) {
    const country = countryById(sim, war.countries[index]);
    for (const id of country?.members || []) {
      const other = sim._groupMap.get(id);
      if (!other || war.attackers.includes(id) || war.defenders.includes(id)) continue;
      war[side].push(id); war.names[id] = other.name; war.strength[index] += peopleOf(sim, other).length;
      fresh.push([other, country]);
    }
  }
  if (war.attackers.length + war.defenders.length === before) return;
  engage(sim, war, join);
  for (const [other, country] of fresh) sim._event('war', `${other.name}, now part of ${country.name}, is drawn into ${war.name}.`, { groupId: other.id });
}

/** Whether armies are in the field today: most fighting happens in campaigns. */
export function fighting(sim, war) {
  return !war || war.phase === 'campaign' || sim._random() < .12;
}

/** Records a battle: the score moves toward the winner, the front moves toward the loser. */
export function recordBattle(sim, war, winner, loser, losses) {
  if (!war) return;
  war.battles++;
  const side = sideOf(war, winner.id);
  if (side < 0) return;
  war.score = round(clamp(war.score + (side === 0 ? 1 : -1) * (2 + sim._random() * 3), -100, 100));
  for (const [group, dead] of losses) { const s = sideOf(war, group.id); if (s >= 0) war.casualties[s] += dead; }
  // The front: where the loser's land meets the winner's advance.
  const x = round(loser.x + (winner.x - loser.x) * (.2 + sim._random() * .35)), y = round(loser.y + (winner.y - loser.y) * (.2 + sim._random() * .35));
  war.front = { x, y };
  if (war.battles % 3 === 1) {
    war.sites.push({ x, y, day: sim.day });
    if (war.sites.length > 8) war.sites.shift();
  }
  // Fields near the fighting are trampled and burned.
  const cx = Math.floor(x), cy = Math.floor(y);
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const tile = sim.tiles?.[(cy + dy) * sim.width + cx + dx];
    if (tile && tile.terrain !== 'water' && cx + dx >= 0 && cx + dx < sim.width) tile.food = round(tile.food * .7);
  }
}

/** How a society's people feel about a war they are in: rallying early, weary later. */
export function warMood(sim, group) {
  let rally = 0, weariness = 0, defeat = 0;
  for (const war of wars(sim)) {
    const side = sideOf(war, group.id);
    if (side < 0) continue;
    if (war.end === null) {
      rally = Math.max(rally, clamp(1 - (sim.day - war.start) / YEAR));
      weariness = Math.max(weariness, war.weariness[side]);
    } else if (sim.day - war.end < YEAR * 3 && war.outcome?.winner && war.outcome.winner !== (side === 0 ? 'attackers' : 'defenders')) defeat = Math.max(defeat, 1 - (sim.day - war.end) / (YEAR * 3));
  }
  return { rally, weariness: clamp(weariness), defeat };
}

/** A side's will to keep fighting. */
function resolve(sim, war, side) {
  const leader = sim._groupMap.get(side === 0 ? war.attacker : war.defender);
  if (!leader) return 0;
  const norms = leader.civilization.culture?.norms || {};
  const ruling = rulingParty(sim, leader);
  const stakes = war.goal === 'independence' ? .35 : side === 1 && ['conquest', 'tribute'].includes(war.goal) ? .3 : side === 0 && war.goal === 'conquest' ? .1 : 0;
  const government = ruling ? (ruling.ideology.martial - .5) * .5 : 0;
  const democratic = (norms.hierarchy ?? .5) < .55 && ruling ? -.08 : 0;
  return .5 + (norms.martial ?? .5) * .5 + stakes + government + democratic;
}

/**
 * Daily for each ongoing war: campaigns and lulls; monthly: weariness, the war
 * economy, refugees, and whether a side seeks peace.
 */
export function advanceWars(sim, hooks) {
  for (const war of wars(sim)) {
    if (war.end !== null) continue;
    const attacker = sim._groupMap.get(war.attacker), defender = sim._groupMap.get(war.defender);
    // Members lost to conquest, merger or collapse drop out.
    war.attackers = war.attackers.filter(id => sim._groupMap.has(id));
    war.defenders = war.defenders.filter(id => sim._groupMap.has(id));
    // A fallen leading settlement is succeeded when its country fights on.
    if ((!attacker && succeed(sim, war, 'attackers', war.attacker)) || (!defender && succeed(sim, war, 'defenders', war.defender))) continue;
    if (!attacker || !defender) {
      endWar(sim, war, !attacker && !defender ? null : attacker ? 'attackers' : 'defenders', 'collapse', attacker ? 'The defending society has ceased to exist.' : defender ? 'The attacking society has ceased to exist.' : 'Neither society survives.', hooks);
      continue;
    }
    if (sim.day >= war.phaseUntil) {
      const campaign = war.phase !== 'campaign';
      war.phase = campaign ? 'campaign' : 'lull';
      // Campaigns are shorter than the lulls between them; winter and harvest halt armies.
      war.phaseUntil = sim.day + (campaign ? 30 + Math.floor(sim._random() * 50) : 30 + Math.floor(sim._random() * 90));
      if (campaign && war.battles > 0 && sim._random() < .4) sim._event('war', `A new campaign opens in ${war.name}.`, { groupId: war.attacker });
    }
    if (sim.day % 30 !== Number(war.id.slice(4)) % 30) continue;
    mobilise(sim, war, hooks);
    const years = (sim.day - war.start) / YEAR;
    for (const side of [0, 1]) {
      const members = (side === 0 ? war.attackers : war.defenders).map(id => sim._groupMap.get(id)).filter(Boolean);
      const leader = side === 0 ? attacker : defender;
      const people = members.reduce((sum, group) => sum + group.members.length, 0);
      const hungry = peopleOf(sim, leader).filter(agent => agent.hunger > 45).length / Math.max(1, leader.members.length);
      const losing = Math.max(0, side === 0 ? -war.score : war.score) / 100;
      war.weariness[side] = round(clamp(years * .14 + war.casualties[side] / Math.max(4, war.strength[side]) * 2.2 + hungry * .5 + losing * .6 + Math.max(0, 1 - people / Math.max(1, war.strength[side])) * .5, 0, 3));
      for (const group of members) warEconomy(sim, group, war);
      refugees(sim, war, leader, losing, hooks);
    }
    // Peace: a side whose weariness passes its resolve seeks terms; an exhausted stalemate ends in a white peace.
    const willing = [0, 1].map(side => war.weariness[side] > resolve(sim, war, side));
    if (willing[0] || willing[1]) {
      if (sim._random() < .35) {
        const winner = war.score >= 25 ? 'attackers' : war.score <= -25 ? 'defenders' : willing[0] && !willing[1] && war.score < 10 ? 'defenders' : willing[1] && !willing[0] && war.score > -10 ? 'attackers' : null;
        settle(sim, war, winner, hooks);
      }
    }
  }
  // Only the most recent finished wars are kept, to bound the record.
  const finished = wars(sim).filter(war => war.end !== null);
  if (finished.length > 60) {
    const drop = new Set(finished.slice(0, finished.length - 60));
    sim.diplomacy.wars = wars(sim).filter(war => !drop.has(war));
  }
}

/** A war footing: weapons and munitions are made and spent; the army must be fed. */
function warEconomy(sim, group, war) {
  const civ = group.civilization, adults = peopleOf(sim, group).filter(agent => agent.age >= 18);
  const soldiers = Math.ceil(adults.length * (.12 + (civ.culture?.norms.martial ?? .5) * .12));
  group.food = Math.max(0, group.food - soldiers * .6);
  for (const key of ['metal', 'tools', 'machines', 'goods']) civ.stock[key] = Math.max(0, civ.stock[key] - (civ.stock[key] || 0) * .04);
  // Industry turns to arms: the stock of machines becomes munitions.
  if (civ.buildings.factory && civ.stock.metal > 1) civ.stock.metal = Math.max(0, civ.stock.metal - .5);
  // Each month of war hardens attitudes a little.
  const norms = civ.culture?.norms;
  if (norms) norms.hierarchy = round(clamp(norms.hierarchy + .004));
  // Those who have lost family at the front grieve; those near it are afraid.
  const near = distance(group, war.front) < 12;
  if (near) for (const agent of adults) feel(agent, 'fear', .05);
}

/** Families on a losing side flee to a society at peace, if one is within reach. */
function refugees(sim, war, group, losing, hooks) {
  if (losing < .25 || sim._random() > losing) return;
  const host = sim.groups.filter(other => !war.attackers.includes(other.id) && !war.defenders.includes(other.id) && other.members.length >= 6 && hooks.contact(group, other))
    .sort((a, b) => distance(a, group) - distance(b, group))[0];
  if (!host) return;
  const families = peopleOf(sim, group).filter(agent => agent.age >= 18 && agent.children.length && (!agent.partnerId || sim._agentMap.get(agent.partnerId)?.groupId === group.id));
  const leaving = families.slice(0, Math.max(1, Math.ceil(families.length * losing * .08)));
  let count = 0;
  for (const agent of leaving) {
    if (agent.groupId !== group.id) continue;
    const before = host.members.length;
    sim._joinGroup(agent, host);
    const partner = sim._agentMap.get(agent.partnerId);
    if (partner && partner.groupId === group.id) sim._joinGroup(partner, host);
    for (const id of host.members.slice(before)) {
      const person = sim._agentMap.get(id);
      if (!person) continue;
      person.x = host.x + (sim._random() - .5) * 2; person.y = host.y + (sim._random() - .5) * 2;
      if (person.age >= 10) appraise(sim, person, 'exile', { text: `Fled ${war.name} and found refuge in ${host.name}.` });
    }
    count += host.members.length - before;
  }
  if (!count) return;
  war.refugees += count;
  sim._event('migration', `${count} refugees flee ${war.name} from ${group.name} to ${host.name}.`, { groupId: host.id });
}

/** The terms of peace, imposed by the winner or agreed in exhaustion. */
function settle(sim, war, winner, hooks) {
  const attacker = sim._groupMap.get(war.attacker), defender = sim._groupMap.get(war.defender);
  const victor = winner === 'attackers' ? attacker : winner === 'defenders' ? defender : null;
  const vanquished = winner === 'attackers' ? defender : winner === 'defenders' ? attacker : null;
  if (!victor) return endWar(sim, war, null, 'white peace', 'Exhausted, both sides agree to peace on the old terms.', hooks);
  const relation = hooks.relation(attacker, defender);
  if (winner === 'attackers' && war.goal === 'independence') {
    return endWar(sim, war, winner, 'independence', `${attacker.name} wins its independence from ${defender.name}.`, hooks);
  }
  if (winner === 'defenders' && war.goal === 'independence') {
    endWar(sim, war, winner, 'restored', `The rising is crushed; ${attacker.name} is made to pay tribute to ${defender.name} again.`, hooks);
    hooks.subjugate(relation, defender, attacker, `Defeated in its war of independence, ${attacker.name} again pays tribute to ${defender.name}.`);
    return;
  }
  if (winner === 'attackers' && ['conquest', 'tribute'].includes(war.goal)) {
    if (vanquished.members.length < 10 || (war.goal === 'conquest' && vanquished.members.length < victor.members.length * .4)) {
      endWar(sim, war, winner, 'conquest', `${victor.name} conquers ${vanquished.name}.`, hooks);
      hooks.conquer(relation, victor, vanquished);
      return;
    }
    if (!hooks.overlordOf(vanquished) && !hooks.overlordOf(victor)) {
      endWar(sim, war, winner, 'tribute', `${vanquished.name} must pay tribute to ${victor.name}.`, hooks);
      hooks.subjugate(relation, victor, vanquished, `Defeated in ${war.name}, ${vanquished.name} must pay tribute to ${victor.name}.`);
      return;
    }
  }
  if (winner === 'attackers' && war.goal === 'regime') {
    impose(sim, victor, vanquished);
    return endWar(sim, war, winner, 'regime change', `${victor.name} imposes its ways on ${vanquished.name}, whose government falls.`, hooks);
  }
  // Otherwise the loser pays: food and stores, more when it started the war and lost.
  const share = winner === 'attackers' ? (war.goal === 'plunder' ? .25 : .15) : .12;
  // The whole losing side pays; its leader most.
  for (const id of winner === 'attackers' ? war.defenders : war.attackers) {
    const payer = sim._groupMap.get(id);
    if (!payer) continue;
    const part = payer === vanquished ? share : share / 2;
    const food = payer.food * part;
    payer.food -= food; victor.food += food;
    for (const key of ['tools', 'metal', 'goods', 'machines', 'electronics', 'coal']) {
      const paid = (payer.civilization.stock[key] || 0) * part;
      payer.civilization.stock[key] -= paid; victor.civilization.stock[key] += paid;
    }
  }
  const norms = vanquished.civilization.culture?.norms;
  if (norms && winner === 'attackers' && war.goal === 'land') norms.expansion = round(clamp(norms.expansion - .08));
  endWar(sim, war, winner, 'reparations', `${vanquished.name} pays reparations to ${victor.name}${war.goal === 'land' ? ' and gives up its claims' : ''}.`, hooks);
}

/** The victors impose their ways: the loser's norms move toward theirs and a friendly party takes power. */
function impose(sim, victor, vanquished) {
  const from = victor.civilization.culture?.norms, to = vanquished.civilization.culture;
  if (!from || !to) return;
  for (const key of AXES) if (to.norms[key] !== undefined && from[key] !== undefined) to.norms[key] = round(to.norms[key] + (from[key] - to.norms[key]) * .3);
  const parties = partiesOf(sim, vanquished);
  if (!parties.length) return;
  const gap = party => AXES.reduce((sum, key) => sum + (party.ideology[key] - (from[key] ?? .5)) ** 2, 0);
  const friendly = [...parties].sort((a, b) => gap(a) - gap(b))[0];
  for (const party of parties) party.inPower = party === friendly;
  friendly.since = sim.day;
  const leader = sim._agentMap.get(friendly.leaderId);
  if (leader?.groupId === vanquished.id) { to.leaderId = leader.id; to.leaderSince = sim.day; }
  sim._event('group', `Under ${victor.name}'s terms the ${friendly.name} now governs ${vanquished.name}.`, { groupId: vanquished.id });
}

/**
 * Ends a war: every relation in it goes to truce, and each side lives with the result.
 * Victory makes a people prouder and more warlike; defeat makes it turn from war,
 * unless it is proud enough to nurse a grievance. Defeated governments fall.
 */
export function endWar(sim, war, winner, terms, text, hooks) {
  if (war.end !== null) return;
  war.end = sim.day; war.phase = 'over';
  war.outcome = { winner, terms, text };
  for (const relation of sim.diplomacy.relations) {
    if (relation.warId !== war.id) continue;
    delete relation.warId;
    if (relation.status === 'war') {
      relation.tension = Math.min(relation.tension, 45); relation.trust = Math.max(relation.trust, -.3);
      relation.status = 'truce'; relation.since = sim.day; relation.reason = `${war.name} ended: ${text}`;
      sim.diplomacy.treaties++;
    }
  }
  const years = Math.max(1, Math.round((war.end - war.start) / YEAR));
  sim._event('peace', `${war.name} ends after ${years} ${years === 1 ? 'year' : 'years'} and ${war.casualties[0] + war.casualties[1]} deaths. ${text}`, { groupId: war.attacker });
  for (const side of [0, 1]) {
    const won = winner === (side === 0 ? 'attackers' : 'defenders'), lost = winner && !won;
    for (const id of side === 0 ? war.attackers : war.defenders) {
      const group = sim._groupMap.get(id);
      const culture = group?.civilization.culture;
      if (!culture) continue;
      const norms = culture.norms, weary = war.weariness[side];
      if (won) { norms.martial = round(clamp(norms.martial + .04)); norms.expansion = round(clamp(norms.expansion + .03)); norms.hierarchy = round(clamp(norms.hierarchy + .02)); }
      else if (lost && norms.martial > .6 && weary < 1.2) norms.martial = round(clamp(norms.martial + .03));
      else norms.martial = round(clamp(norms.martial - .05 - weary * .04));
      for (const agent of peopleOf(sim, group)) if (agent.age >= 10) appraise(sim, agent, won ? 'victory' : lost ? 'defeat' : 'peace', { text: `${war.name} ended: ${text}` });
      if (lost) hooks.onDefeat?.(group, war);
    }
  }
}

/** A legacy war (from before wars were recorded) gets a record when next seen. */
export function adoptWar(sim, relation, a, b) {
  const war = openWar(sim, relation, a, b, 'grievance', { reason: relation.reason });
  war.start = Math.max(0, sim.day - relation.warDays);
  return war;
}

// ——— strict restore ———
const PHASES = new Set(['campaign', 'lull', 'over']);
export function restoreWars(raw, sim) {
  const bad = field => { throw new Error(`Invalid war save: ${field}.`); };
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > 400) bad('list');
  const ids = new Set();
  const int = (value, field, min = 0, max = Number.MAX_SAFE_INTEGER) => (Number.isSafeInteger(value) && value >= min && value <= max ? value : bad(field));
  const num = (value, field, min, max) => (typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : bad(field));
  const text = (value, field, max = 300) => (typeof value === 'string' && value.length && value.length <= max ? value : bad(field));
  const group = (value, field) => int(value, field, 1, sim.nextGroupId - 1);
  const point = (value, field) => {
    if (!value || typeof value !== 'object') bad(field);
    return { x: num(value.x, field, -1, sim.width + 1), y: num(value.y, field, -1, sim.height + 1) };
  };
  const names = (value, members) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) bad('names');
    const entries = Object.entries(value);
    if (entries.length > 400 || entries.some(([id, name]) => !/^[1-9]\d*$/.test(id) || Number(id) >= sim.nextGroupId)) bad('names');
    return Object.fromEntries(entries.map(([id, name]) => [id, text(name, 'name', 80)]));
  };
  const countriesOf = value => {
    if (!Array.isArray(value) || value.length !== 2 || value.some(id => id !== null && !/^country-[1-9]\d*$/.test(id))) bad('countries');
    return [...value];
  };
  return raw.map(war => {
    if (!war || typeof war !== 'object' || !/^war-[1-9]\d*$/.test(war.id) || ids.has(war.id)) bad('ID');
    ids.add(war.id);
    if (!CAUSES[war.cause] || !GOALS[war.goal] || !PHASES.has(war.phase)) bad('cause, goal or phase');
    if (!Array.isArray(war.attackers) || !Array.isArray(war.defenders) || !Array.isArray(war.sites) || war.sites.length > 8) bad('sides');
    for (const pair of [war.casualties, war.weariness, war.strength]) if (!Array.isArray(pair) || pair.length !== 2) bad('pair');
    const end = war.end === null ? null : int(war.end, 'end', 0, sim.day);
    if ((end === null) !== (war.outcome === null) || (end === null) !== (war.phase !== 'over')) bad('outcome');
    let outcome = null;
    if (war.outcome !== null) {
      if (!war.outcome || typeof war.outcome !== 'object' || ![null, 'attackers', 'defenders'].includes(war.outcome.winner)) bad('outcome');
      outcome = { winner: war.outcome.winner, terms: text(war.outcome.terms, 'terms', 40), text: text(war.outcome.text, 'outcome text') };
    }
    return {
      id: war.id, name: text(war.name, 'name', 120), attacker: group(war.attacker, 'attacker'), defender: group(war.defender, 'defender'),
      attackers: war.attackers.map(id => group(id, 'attackers')), defenders: war.defenders.map(id => group(id, 'defenders')),
      cause: war.cause, goal: war.goal, reason: text(war.reason, 'reason', 500), start: int(war.start, 'start', 0, sim.day), end,
      phase: war.phase, phaseUntil: int(war.phaseUntil, 'phase end'), score: num(war.score, 'score', -100, 100), battles: int(war.battles, 'battles'),
      casualties: war.casualties.map(value => int(value, 'casualties')), weariness: war.weariness.map(value => num(value, 'weariness', 0, 3)), strength: war.strength.map(value => int(value, 'strength')),
      names: names(war.names, [...war.attackers, ...war.defenders]),
      countries: war.countries === undefined ? [null, null] : countriesOf(war.countries),
      front: point(war.front, 'front'), sites: war.sites.map(site => ({ ...point(site, 'site'), day: int(site.day, 'site day', 0, sim.day) })), refugees: int(war.refugees, 'refugees'), outcome,
    };
  });
}
