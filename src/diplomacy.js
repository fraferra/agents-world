/** Local, resource-costed inter-society relations. Belief identity alone causes no war. */
import { innovationEffects } from './innovation.js';
import { appraise } from './psyche.js';
import { shareCustom } from './culture.js';
import { claimFriction } from './expansion.js';
import { startOutbreak } from './civilization.js';

const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const statuses = new Set(['neutral', 'trade', 'alliance', 'war', 'truce']);
export function initializeDiplomacy(sim) {
  sim.diplomacy = { relations: [], warsStarted: 0, warDeaths: 0, treaties: 0, raids: 0 };
}
// Relations are indexed by pair; the index is rebuilt whenever the list is replaced.
const relationIndex = new WeakMap();
function relation(sim, a, b, create = false) {
  if (!sim.diplomacy) initializeDiplomacy(sim);
  const first = Math.min(a.id, b.id), second = Math.max(a.id, b.id), list = sim.diplomacy.relations;
  let index = relationIndex.get(sim);
  if (!index || index.list !== list || index.length !== list.length) {
    index = { list, length: list.length, pairs: new Map(list.map(r => [r.a * 1e6 + r.b, r])) };
    relationIndex.set(sim, index);
  }
  let found = index.pairs.get(first * 1e6 + second);
  if (!found && create) {
    found = { a: first, b: second, trust: 0, tension: 0, status: 'neutral', since: sim.day, lastContact: sim.day, warDays: 0, casualties: 0, tradeTotal: 0, reason: 'Neighboring communities have made contact.' };
    list.push(found);
    index.pairs.set(first * 1e6 + second, found); index.length = list.length;
  }
  return found;
}
export function tradeAccess(sim, a, b) {
  if (!a || !b || a.id === b.id) return false;
  const r = relation(sim, a, b);
  if (r?.status === 'war') return false;
  const ea = innovationEffects(sim, a), eb = innovationEffects(sim, b);
  // Logistics (and docks) extend the range in which an actual trader can seek exchange.
  return distance(a, b) <= 22 * Math.sqrt(ea.trade * eb.trade) * (a.civilization?.buildings.dock || b.civilization?.buildings.dock ? 1.35 : 1)
    && (!r || r.tension < 78 || r.status === 'alliance');
}
/** A colony and its mother community begin as allies bound by kinship. */
export function establishKinship(sim, parent, colony) {
  const r = relation(sim, parent, colony, true);
  r.trust = .7; r.tension = 0; r.status = 'alliance'; r.since = sim.day; r.lastContact = sim.day;
  r.reason = `${colony.name} was founded by pioneers from ${parent.name}; kinship keeps them allied.`;
  sim.diplomacy.treaties++;
}

export function recordTrade(sim, a, b, volume) {
  if (!(volume > 0) || !Number.isFinite(volume) || !a || !b) return;
  const r = relation(sim, a, b, true);
  if (r.status === 'war') return;
  r.tradeTotal += volume; r.lastContact = sim.day;
  r.trust = clamp(r.trust + .025 + Math.min(volume, 10) * .002, -1, 1);
  r.tension = Math.max(0, r.tension - 2);
  // Traders carry customs home as well as goods.
  shareCustom(sim, b, a, .02); shareCustom(sim, a, b, .02);
  if (r.status === 'neutral' || r.status === 'truce') {
    r.status = 'trade'; r.since = sim.day; r.reason = 'Repeated exchange creates a shared interest in safe passage.';
    sim._event('diplomacy', `${a.name} and ${b.name} open a trade route.`, { groupId: a.id });
  }
}
function people(sim, group) {
  return group.members.map(id => sim._agentMap.get(id)).filter(a => a && a.health > 0);
}
function situation(sim, group, effects) {
  const members = people(sim, group), adults = members.filter(a => a.age >= 18 && a.health > 35);
  const mean = key => members.reduce((sum, a) => sum + a[key], 0) / Math.max(1, members.length);
  const hunger = mean('hunger') / 100;
  const stress = clamp(hunger * 1.6 + .3 * (1 - Math.min(1, group.food / Math.max(1, members.length * .4))));
  const supplies = clamp(group.food / Math.max(1, adults.length * .15), .2, 1);
  const tools = Math.min(.4, (group.civilization?.stock.tools || 0) / Math.max(1, adults.length) * .3);
  const walls = 1 + Math.min(2, group.civilization?.buildings.walls || 0) * .3;
  return { members, adults, stress, power: Math.sqrt(adults.length) * effects.combat * supplies * (1 + tools) * (.7 + effects.solidarity * .6) * walls };
}
function setStatus(sim, r, status, a, b, reason) {
  r.status = status; r.since = sim.day; r.reason = reason;
  if (status === 'war') { r.warDays = 0; sim.diplomacy.warsStarted++; }
  else if (status === 'alliance' || status === 'truce') sim.diplomacy.treaties++;
  const type = status === 'war' ? 'war' : status === 'truce' ? 'peace' : 'diplomacy';
  const verb = status === 'war' ? 'go to war' : status === 'truce' ? 'agree to a truce' : 'form an alliance';
  sim._event(type, `${a.name} and ${b.name} ${verb}. ${reason}`, { groupId: a.id });
}
function raid(sim, r, a, b, sa, sb) {
  if (!sa.adults.length || !sb.adults.length) return;
  const provisions = group => { const eaten = Math.min(group.food, Math.sqrt(group.members.length) * .08); group.food -= eaten; return eaten; };
  provisions(a); provisions(b);
  const totalPower = sa.power + sb.power;
  if (!totalPower) return;
  const aWins = sim._random() < sa.power / totalPower;
  const winner = aWins ? a : b, loser = aWins ? b : a;
  const attack = (defenders, opposingPower, ownPower, attacker) => {
    const count = Math.min(defenders.length, Math.max(1, Math.ceil(Math.sqrt(defenders.length) * .7)));
    const offset = Math.floor(sim._random() * defenders.length);
    for (let i = 0; i < count; i++) {
      const victim = defenders[(offset + i) % defenders.length];
      if (victim.health <= 0) continue;
      const damage = (6 + sim._random() * 16) * clamp(opposingPower / Math.max(.1, ownPower), .3, 2.5);
      victim.health = Math.max(0, victim.health - damage); victim.energy = Math.max(0, victim.energy - 8);
      victim.social = Math.max(0, victim.social - 3); victim.action = 'defending the community';
      if (victim.mind) {
        victim.mind.beliefs.trust = Math.max(0, victim.mind.beliefs.trust - .03);
        if (!victim.mind.memories.some(memory => memory.type === 'war' && sim.day - memory.day < 24)) {
          victim.mind.memories.unshift({ day: sim.day, type: 'war', text: 'A raid injured our people and consumed the community’s supplies.' });
          if (victim.mind.memories.length > 8) victim.mind.memories.length = 8;
        }
      }
      appraise(sim, victim, 'raid', { name: attacker.name });
      if (victim.health === 0) { victim._deathCause = 'war'; r.casualties++; sim.diplomacy.warDeaths++; }
    }
  };
  attack(sa.adults, sb.power, sa.power, b); attack(sb.adults, sa.power, sb.power, a);
  // Loot transfers existing resources. Campaign provisions and damage are losses.
  for (const key of ['food', 'wood']) {
    const loot = Math.min(loser[key], Math.sqrt(winner.members.length) * .15);
    loser[key] -= loot; winner[key] += loot;
  }
  for (const key of ['tools', 'metal', 'goods']) {
    const loot = Math.min(loser.civilization.stock[key], .3 + sim._random() * .5);
    loser.civilization.stock[key] -= loot; winner.civilization.stock[key] += loot;
  }
  if (sim._random() < .12) {
    const standing = Object.keys(loser.civilization.buildings).filter(key => loser.civilization.buildings[key] > 0);
    if (standing.length) loser.civilization.buildings[standing[Math.floor(sim._random() * standing.length)]]--;
  }
  sim.diplomacy.raids++; r.trust = Math.max(-1, r.trust - .06);
  r.reason = `Raiding damages health and infrastructure; ${winner.name} takes supplies from ${loser.name}.`;
  if (sim.diplomacy.raids % 6 === 1) sim._event('war', r.reason, { groupId: winner.id });
}

/** The conquered join the victors with everything they held; their buildings are lost. */
function conquer(sim, r, strong, weak) {
  const people = weak.members.map(id => sim._agentMap.get(id)).filter(Boolean);
  for (const agent of people) {
    sim._joinGroup(agent, strong);
    if (agent.age >= 10) appraise(sim, agent, 'departure', { text: `Our people were conquered by ${strong.name}.` });
  }
  strong.food += weak.food; strong.wood += weak.wood; weak.food = 0; weak.wood = 0;
  for (const key of Object.keys(weak.civilization.stock)) { strong.civilization.stock[key] += weak.civilization.stock[key]; weak.civilization.stock[key] = 0; }
  const culture = strong.civilization.culture;
  if (culture) {
    culture.norms.hierarchy = Math.round(Math.min(1, culture.norms.hierarchy + .08) * 1e4) / 1e4;
    culture.norms.martial = Math.round(Math.min(1, culture.norms.martial + .05) * 1e4) / 1e4;
  }
  r.status = 'truce'; r.since = sim.day; r.reason = `${strong.name} conquered ${weak.name} and absorbed its people.`;
  sim._event('war', `${strong.name} conquers ${weak.name}; ${people.length} people are absorbed into a larger polity.`, { groupId: strong.id });
}

export function advanceDiplomacy(sim) {
  if (!sim.diplomacy) initializeDiplomacy(sim);
  const live = new Set(sim.groups.map(g => g.id));
  sim.diplomacy.relations = sim.diplomacy.relations.filter(r => live.has(r.a) && live.has(r.b));
  // Contact discovery is staggered; no distant omniscient declarations of war.
  if (sim.day % 12 === 0) {
    for (let i = 0; i < sim.groups.length; i++) for (let j = i + 1; j < sim.groups.length; j++) {
      const a = sim.groups[i], b = sim.groups[j];
      const range = 25 * Math.sqrt(innovationEffects(sim, a).trade * innovationEffects(sim, b).trade);
      if (distance(a, b) <= range) relation(sim, a, b, true).lastContact = sim.day;
    }
  }
  const situations = new Map(), effects = new Map();
  const describe = group => {
    if (!effects.has(group.id)) effects.set(group.id, innovationEffects(sim, group));
    if (!situations.has(group.id)) situations.set(group.id, situation(sim, group, effects.get(group.id)));
    return [effects.get(group.id), situations.get(group.id)];
  };
  for (const r of sim.diplomacy.relations) {
    const a = sim._groupMap.get(r.a), b = sim._groupMap.get(r.b);
    if (!a || !b) continue;
    const [ea, sa] = describe(a), [eb, sb] = describe(b);
    const contact = distance(a, b) <= 25 * Math.sqrt(ea.trade * eb.trade);
    if (r.status === 'war') {
      r.warDays++;
      if (contact && sim.day % 6 === 0) raid(sim, r, a, b, sa, sb);
      // Circumscription (Carneiro 1970): an overwhelmed side that cannot hold out is conquered.
      if (contact && r.warDays > 30 && sim.day % 6 === 0) {
        const [strong, weak, ss, ws] = sa.power >= sb.power ? [a, b, sa, sb] : [b, a, sb, sa];
        if (ws.adults.length < ss.adults.length * .35 && weak.members.length <= strong.members.length * .6 && ws.power < ss.power * .4 && sim._random() < .1) {
          conquer(sim, r, strong, weak);
          continue;
        }
      }
      const exhaustion = (sa.stress + sb.stress) / 2;
      if (!contact || !sa.adults.length || !sb.adults.length || r.warDays > 100 + (ea.militancy + eb.militancy) * 100
        || (r.warDays > 24 && exhaustion > .75 && sim._random() < .05)) {
        r.tension = Math.min(r.tension, 45); r.trust = Math.max(r.trust, -.3);
        setStatus(sim, r, 'truce', a, b, !contact ? 'Migration has separated the communities.' : 'Losses, provisioning costs, and exhaustion outweigh further fighting.');
      }
      continue;
    }
    if (sim.day % 12 !== 0 || !contact) continue;
    // Contact carries epidemics between communities that are not yet immune.
    for (const [from, to] of [[a, b], [b, a]]) {
      if (from.civilization.outbreakUntil > sim.day && to.civilization.outbreakUntil <= sim.day && to.civilization.immuneUntil <= sim.day && (r.status === 'trade' || r.status === 'alliance') && sim._random() < .07) startOutbreak(sim, to, from);
    }
    // Allies visit and mingle; customs can travel between them.
    if (r.status === 'alliance') { shareCustom(sim, a, b, .02); shareCustom(sim, b, a, .02); }
    if (r.status === 'truce' && sim.day - r.since < 180) { r.tension = Math.max(0, r.tension - 1); continue; }
    if (r.status === 'truce') { r.status = 'neutral'; r.since = sim.day; }
    const scarcity = (sa.stress + sb.stress) / 2;
    const openness = (ea.openness + eb.openness) / 2;
    const militancy = (ea.militancy + eb.militancy) / 2;
    const doctrinalDistance = (Math.abs(ea.authority - eb.authority) + Math.abs(ea.spirituality - eb.spirituality) + Math.abs(ea.solidarity - eb.solidarity)) / 3;
    const competition = Math.max(0, 1 - distance(a, b) / 25);
    const opportunity = Math.abs(sa.power - sb.power) / Math.max(1, sa.power + sb.power);
    // Overlapping territorial claims breed rivalry, sharper between expansionist peoples.
    const pressure = scarcity * (2 + competition * 3) + doctrinalDistance * (1 - openness) * militancy * 4 + claimFriction(a, b) * 1.5
      + militancy * competition + opportunity * scarcity - openness * 1.3 - Math.max(0, r.trust) * 2 - (r.status === 'alliance' ? 2 : 0);
    r.tension = clamp(r.tension + pressure, 0, 100);
    r.trust = clamp(r.trust + .012 * (openness - scarcity) - doctrinalDistance * (1 - openness) * .009, -1, 1);
    if (r.tension > 68 && sa.adults.length >= 3 && sb.adults.length >= 3 && sim._random() < .03 + militancy * .12) {
      setStatus(sim, r, 'war', a, b, scarcity > .4 ? 'Competition for scarce provisions and accumulated grievances overcome restraint.' : 'Militant, closed doctrines and accumulated rivalry overcome restraint.');
    } else if (r.trust > .55 && r.tension < 20 && r.status !== 'alliance') {
      setStatus(sim, r, 'alliance', a, b, 'Trust, exchange, and openness support mutual cooperation.');
    } else if (r.status === 'alliance' && (r.trust < .1 || r.tension > 50)) {
      r.status = 'neutral'; r.since = sim.day; r.reason = 'Growing mistrust has dissolved the alliance.';
      sim._event('diplomacy', `${a.name} and ${b.name} end their alliance.`, { groupId: a.id });
    }
  }
}

export function diplomacyStats(sim) {
  const state = sim.diplomacy;
  return { wars: state?.relations.filter(r => r.status === 'war').length || 0, alliances: state?.relations.filter(r => r.status === 'alliance').length || 0, tradeRoutes: state?.relations.filter(r => r.status === 'trade' || (r.status === 'alliance' && r.tradeTotal > 0)).length || 0, warDeaths: state?.warDeaths || 0 };
}

export function restoreDiplomacy(raw, sim) {
  const bad = field => { throw new Error(`Invalid diplomacy save: ${field}.`); };
  const number = (n, field, max = Number.MAX_SAFE_INTEGER, min = 0, integer = false) => {
    if (!Number.isFinite(n) || typeof n !== 'number' || n < min || n > max || (integer && !Number.isSafeInteger(n))) bad(field);
    return n;
  };
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.relations)) bad('state');
  const state = { relations: [] };
  for (const key of ['warsStarted', 'warDeaths', 'treaties', 'raids']) state[key] = number(raw[key], key, Number.MAX_SAFE_INTEGER, 0, true);
  const seen = new Set();
  for (const r of raw.relations) {
    if (!r || typeof r !== 'object') bad('relation');
    const a = number(r.a, 'group ID', sim.nextGroupId - 1, 1, true), b = number(r.b, 'group ID', sim.nextGroupId - 1, 1, true);
    if (a >= b || seen.has(`${a}:${b}`) || !statuses.has(r.status) || typeof r.reason !== 'string' || !r.reason.length || r.reason.length > 500) bad('relation identity');
    seen.add(`${a}:${b}`);
    state.relations.push({ a, b, trust: number(r.trust, 'trust', 1, -1), tension: number(r.tension, 'tension', 100), status: r.status,
      since: number(r.since, 'since', sim.day, 0, true), lastContact: number(r.lastContact, 'last contact', sim.day, 0, true), warDays: number(r.warDays, 'war days', sim.day, 0, true),
      casualties: number(r.casualties, 'casualties', state.warDeaths, 0, true), tradeTotal: number(r.tradeTotal, 'trade volume'), reason: r.reason });
  }
  if (state.relations.reduce((n, r) => n + r.casualties, 0) > state.warDeaths) bad('casualty accounting');
  return state;
}
