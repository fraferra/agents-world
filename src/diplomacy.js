/** Local, resource-costed inter-society relations. Belief identity alone causes no war. */
import { innovationEffects } from './innovation.js';
import { appraise } from './psyche.js';
import { shareCustom } from './culture.js';
import { claimFriction } from './expansion.js';
import { startOutbreak, industry, contaminate } from './civilization.js';
import { addWealth } from './economy.js';
import { linkBetween, reachable } from './infrastructure.js';
import { advances } from './breakthroughs.js';
import { countryOf } from './polity.js';

const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const statuses = new Set(['neutral', 'trade', 'alliance', 'war', 'truce', 'tributary']);
export function initializeDiplomacy(sim) {
  sim.diplomacy = { relations: [], warsStarted: 0, warDeaths: 0, treaties: 0, raids: 0, nuclearStrikes: 0, subjugations: 0 };
}
/** The overlord a society pays tribute to, if any. */
export function overlordOf(sim, group) {
  const r = sim.diplomacy?.relations.find(r => r.status === 'tributary' && r.overlord !== group.id && (r.a === group.id || r.b === group.id));
  return r ? sim._groupMap.get(r.overlord) || null : null;
}
/** The societies that pay tribute to this one. */
export function tributariesOf(sim, group) {
  return (sim.diplomacy?.relations || []).filter(r => r.status === 'tributary' && r.overlord === group.id).map(r => sim._groupMap.get(r.a === group.id ? r.b : r.a)).filter(Boolean);
}
/** Whole warheads a society can launch. */
const warheads = group => Math.floor(group?.civilization?.stock.warheads || 0);
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
  // Roads, railways, sea and air routes carry traders along their whole length.
  if (linkBetween(sim, a, b)) return !r || r.tension < 78 || r.status === 'alliance';
  if (!reachable(sim, a, b)) return false;
  // Logistics (and docks) extend the range in which an actual trader can seek exchange.
  return distance(a, b) <= 22 * Math.sqrt(ea.trade * eb.trade) * (a.civilization?.buildings.dock || b.civilization?.buildings.dock ? 1.35 : 1) * Math.max(industry(a).reach, industry(b).reach)
    && (!r || r.tension < 78 || r.status === 'alliance');
}
/** A colony and its mother community begin as allies bound by kinship. */
export function establishKinship(sim, parent, colony) {
  const r = relation(sim, parent, colony, true);
  r.trust = .7; r.tension = 0; r.status = 'alliance'; r.since = sim.day; r.lastContact = sim.day;
  r.reason = `${colony.name} was founded by pioneers from ${parent.name}; kinship keeps them allied.`;
  sim.diplomacy.treaties++;
}

/** The standing relation between two societies, if they have met. */
export function relationBetween(sim, a, b) { return a && b && a.id !== b.id ? relation(sim, a, b) || null : null; }

/** Whether two societies are at war; marriages and visits stop between enemies. */
export function atWar(sim, a, b) { return !!a && !!b && a.id !== b.id && relation(sim, a, b)?.status === 'war'; }

/** Marriages bind communities: kin in each other's camps build trust and ease rivalry. */
export function recordMarriage(sim, a, b) {
  if (!a || !b || a.id === b.id) return;
  const r = relation(sim, a, b, true);
  r.lastContact = sim.day;
  r.trust = clamp(r.trust + .06, -1, 1);
  r.tension = Math.max(0, r.tension - 5);
  shareCustom(sim, a, b, .03); shareCustom(sim, b, a, .03);
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
  // Industrial armies: machine-made weapons, and railways that move troops and supplies.
  const modern = industry(group), arms = 1 + (modern.machines * .5) + (group.civilization?.stock.metal >= 2 && modern.machines ? .2 : 0) + (modern.reach > 1 ? .15 : 0);
  // Weapons breakthroughs multiply what a people can bring to a fight.
  const weapons = Math.max(.3, 1 + advances(group).combat * 2);
  return { members, adults, stress, power: Math.sqrt(adults.length) * effects.combat * supplies * (1 + tools) * (.7 + effects.solidarity * .6) * walls * arms * weapons };
}
function setStatus(sim, r, status, a, b, reason) {
  r.status = status; r.since = sim.day; r.reason = reason;
  delete r.overlord;
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

/**
 * A nuclear strike kills much of a society, levels its buildings and poisons the
 * land. A target that still holds warheads strikes back: mutual destruction.
 */
function nuclearStrike(sim, r, attacker, target, retaliation = false) {
  attacker.civilization.stock.warheads -= 1;
  sim.diplomacy.nuclearStrikes++;
  const people = target.members.map(id => sim._agentMap.get(id)).filter(a => a && a.health > 0);
  const share = .35 + sim._random() * .25;
  let killed = 0;
  for (const agent of people) {
    const near = Math.hypot(agent.x - target.x, agent.y - target.y) < 14;
    if (near && sim._random() < share) { agent.health = 0; agent._deathCause = 'nuclear war'; killed++; r.casualties++; sim.diplomacy.warDeaths++; }
    else {
      agent.health = Math.max(0, agent.health - (near ? 20 + sim._random() * 25 : 5));
      if (agent.health === 0) { agent._deathCause = 'radiation'; killed++; r.casualties++; sim.diplomacy.warDeaths++; }
      else if (agent.age >= 6) appraise(sim, agent, 'catastrophe', { text: `${attacker.name} destroyed our home with a nuclear weapon.` });
    }
  }
  for (const key of Object.keys(target.civilization.buildings)) target.civilization.buildings[key] = Math.floor(target.civilization.buildings[key] * (.2 + sim._random() * .2));
  target.food *= .3; target.wood *= .3; target.shelters = Math.floor(target.shelters * .25);
  contaminate(sim, target.x, target.y, 7, .15);
  // The whole world is shaken, and the attacker's own people are not untouched by it.
  for (const agent of sim.agents) if (agent.psyche && agent.health > 0 && agent.groupId !== target.id) agent.psyche.mood.fear = Math.min(1, agent.psyche.mood.fear + (agent.groupId === attacker.id ? .3 : .15));
  sim._event('war', `${attacker.name} ${retaliation ? 'retaliates with' : 'launches'} a nuclear strike on ${target.name}. ${killed} people die at once; the city is levelled and its land poisoned.`, { groupId: attacker.id });
  if (!retaliation && warheads(target) > 0 && target.members.length) nuclearStrike(sim, r, target, attacker, true);
}

/** A nuclear power losing a war, or led by a militant state, may use its arsenal. */
function considerNuclearStrike(sim, r, a, b, sa, sb, ea, eb) {
  for (const [side, other, own, enemy, effects] of [[a, b, sa, sb, ea], [b, a, sb, sa, eb]]) {
    if (warheads(side) < 1 || !other.members.length) continue;
    const losing = own.power < enemy.power * .7 || own.stress > .6;
    const martial = side.civilization.culture?.norms.martial ?? .5;
    // The taboo deepens with every use, and an armed enemy means certain retaliation.
    const restraint = (warheads(other) > 0 ? .25 : 1) / (1 + sim.diplomacy.nuclearStrikes * .5);
    if (sim._random() < (losing ? .05 : .005) * (.4 + martial + effects.militancy * .5) * restraint) {
      nuclearStrike(sim, r, side, other);
      r.tension = 40; r.trust = -1;
      setStatus(sim, r, 'truce', a, b, 'The horror of atomic war ends the fighting.');
      return true;
    }
  }
  return false;
}

/**
 * Subjugation: the defeated, or the intimidated, keep their people, culture and
 * buildings but pay tribute to an overlord. Tribute enriches the overlord's
 * store and its leader, and breeds resentment in the tributary.
 */
function subjugate(sim, r, overlord, vassal, reason) {
  r.status = 'tributary'; r.overlord = overlord.id; r.since = sim.day; r.warDays = 0; r.reason = reason;
  r.tension = Math.max(r.tension, 35); r.trust = Math.min(r.trust, -.2);
  sim.diplomacy.subjugations = (sim.diplomacy.subjugations || 0) + 1;
  const culture = overlord.civilization.culture;
  if (culture) {
    culture.norms.hierarchy = Math.round(Math.min(1, culture.norms.hierarchy + .05) * 1e4) / 1e4;
    culture.norms.martial = Math.round(Math.min(1, culture.norms.martial + .03) * 1e4) / 1e4;
  }
  for (const id of vassal.members) {
    const agent = sim._agentMap.get(id);
    if (agent?.age >= 10) appraise(sim, agent, 'departure', { text: `Our people now pay tribute to ${overlord.name}.` });
  }
  sim._event('war', `${vassal.name} becomes a tributary of ${overlord.name}. ${reason}`, { groupId: overlord.id });
  const count = tributariesOf(sim, overlord).length;
  if (count === 3) sim._event('group', `${overlord.name} now rules three tributaries: an empire is born.`, { groupId: overlord.id });
}

const TRIBUTE = ['tools', 'metal', 'goods', 'cloth', 'bricks', 'gems', 'remedies', 'hides', 'coal', 'machines', 'electronics'];
/** Monthly tribute: a share of the tributary's food and goods; the overlord's leader keeps a cut. */
function payTribute(sim, overlord, vassal) {
  const food = vassal.food * .06;
  vassal.food -= food; overlord.food += food;
  let value = food;
  for (const key of TRIBUTE) {
    const paid = (vassal.civilization.stock[key] || 0) * .08;
    vassal.civilization.stock[key] -= paid; overlord.civilization.stock[key] += paid; value += paid;
  }
  const leader = sim._agentMap.get(overlord.civilization.culture?.leaderId);
  if (leader && overlord.food > 0) {
    const cut = Math.min(overlord.food, food * (overlord.civilization.culture.norms.hierarchy ?? .3));
    overlord.food -= cut; addWealth(leader, cut);
  }
  return value;
}

/** Monthly life of a tributary relation: tribute, resentment, rebellion or annexation. Returns true if it ended. */
function tributaryMonth(sim, r, a, b, sa, sb, contact) {
  const [overlord, vassal, so, sv] = r.overlord === a.id ? [a, b, sa, sb] : [b, a, sb, sa];
  if (!contact) { setStatus(sim, r, 'neutral', a, b, `Distance has loosened ${overlord.name}'s hold; ${vassal.name} no longer pays tribute.`); return true; }
  payTribute(sim, overlord, vassal);
  r.lastContact = sim.day;
  // Tribute breeds resentment, faster where the tributary is martial and proud.
  const pride = vassal.civilization.culture?.norms.martial ?? .5;
  r.tension = clamp(r.tension + .4 + pride * .6, 0, 100);
  r.trust = clamp(r.trust - .005, -1, 1);
  // Rebellion: when the tributary has grown strong, or its overlord is busy with another war.
  const busy = sim.diplomacy.relations.some(other => other !== r && other.status === 'war' && (other.a === overlord.id || other.b === overlord.id));
  const odds = sv.power > so.power * .8 ? .3 : busy && sv.power > so.power * .45 ? .12 : sv.power > so.power * .6 ? .04 : 0;
  if (odds && sim._random() < odds * (.4 + r.tension / 100) * (.6 + pride)) {
    r.tension = Math.max(r.tension, 70);
    setStatus(sim, r, 'war', a, b, `${vassal.name} rises against its overlord ${overlord.name}.`);
    return true;
  }
  // After long, quiet rule a small, nearby tributary may be absorbed into its overlord.
  if (sim.day - r.since > 2400 && r.tension < 55 && vassal.members.length < overlord.members.length * .5 && distance(overlord, vassal) < 30 && sim._random() < .08) {
    annex(sim, r, overlord, vassal);
    return true;
  }
  return false;
}

/** Peaceful absorption of a long-ruled tributary: its people join the overlord with their stores. */
function annex(sim, r, overlord, vassal) {
  const people = vassal.members.map(id => sim._agentMap.get(id)).filter(Boolean);
  for (const agent of people) sim._joinGroup(agent, overlord);
  overlord.food += vassal.food; overlord.wood += vassal.wood; vassal.food = 0; vassal.wood = 0;
  for (const key of Object.keys(vassal.civilization.stock)) { overlord.civilization.stock[key] += vassal.civilization.stock[key]; vassal.civilization.stock[key] = 0; }
  setStatus(sim, r, 'truce', overlord, vassal, `${overlord.name} has absorbed its long-ruled tributary ${vassal.name}.`);
  sim._event('group', `${overlord.name} annexes ${vassal.name}; ${people.length} people become part of it.`, { groupId: overlord.id });
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
      const range = 25 * Math.sqrt(innovationEffects(sim, a).trade * innovationEffects(sim, b).trade) * Math.max(industry(a).reach, industry(b).reach);
      if (distance(a, b) <= range && reachable(sim, a, b)) relation(sim, a, b, true).lastContact = sim.day;
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
    const contact = !!linkBetween(sim, a, b) || (distance(a, b) <= 25 * Math.sqrt(ea.trade * eb.trade) * Math.max(industry(a).reach, industry(b).reach) && reachable(sim, a, b));
    if (r.status === 'war') {
      r.warDays++;
      if (contact && sim.day % 6 === 0) {
        if (considerNuclearStrike(sim, r, a, b, sa, sb, ea, eb)) continue;
        raid(sim, r, a, b, sa, sb);
      }
      // Circumscription (Carneiro 1970): an overwhelmed side that cannot hold out is conquered.
      if (contact && r.warDays > 30 && sim.day % 6 === 0) {
        const [strong, weak, ss, ws] = sa.power >= sb.power ? [a, b, sa, sb] : [b, a, sb, sa];
        if (ws.adults.length < ss.adults.length * .35 && weak.members.length <= strong.members.length * .6 && ws.power < ss.power * .4 && sim._random() < .1) {
          // Small peoples are absorbed; larger ones, or those already under another, are made to pay tribute.
          if (weak.members.length >= 8 && !overlordOf(sim, weak)) subjugate(sim, r, strong, weak, `Defeated in war, ${weak.name} must send part of its harvest and goods to ${strong.name}.`);
          else conquer(sim, r, strong, weak);
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
    if (r.status === 'tributary') {
      if (sim.day % 30 === (Math.max(r.a, r.b)) % 30) tributaryMonth(sim, r, a, b, sa, sb, contact);
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
    // Deterrence: two nuclear powers almost never choose war; a lone nuclear power is feared.
    const deterrence = warheads(a) > 0 && warheads(b) > 0 ? .08 : warheads(a) > 0 || warheads(b) > 0 ? .5 : 1;
    // Intimidation: an expansionist or martial power far stronger than a tense neighbour demands
    // submission. The weak submit unless their own pride or allies make them fight.
    const [strong, weak, ss, ws] = sa.power >= sb.power ? [a, b, sa, sb] : [b, a, sb, sa];
    const strongNorms = strong.civilization.culture?.norms, weakNorms = weak.civilization.culture?.norms;
    const ambition = strongNorms ? Math.max(strongNorms.expansion, strongNorms.martial) : .4;
    if (r.status !== 'alliance' && r.tension > 30 && ws.power < ss.power * .5 && ws.adults.length >= 3 && ambition > .5 && !overlordOf(sim, weak) && !overlordOf(sim, strong)
      && warheads(weak) < 1 && sim._random() < .04 * ambition * deterrence) {
      if (sim._random() < .75 - (weakNorms?.martial ?? .5) * .5) subjugate(sim, r, strong, weak, `Facing overwhelming strength, ${weak.name} submits and agrees to pay tribute.`);
      else setStatus(sim, r, 'war', a, b, `${weak.name} refuses to submit to ${strong.name}.`);
      continue;
    }
    // Fellow members of a country settle disputes without war.
    const compatriots = !!countryOf(sim, a) && countryOf(sim, a) === countryOf(sim, b);
    if (compatriots) r.tension = Math.min(r.tension, 60);
    if (!compatriots && r.tension > 68 && sa.adults.length >= 3 && sb.adults.length >= 3 && sim._random() < (.03 + militancy * .12) * deterrence) {
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
  return { nuclearStrikes: state?.nuclearStrikes || 0, tributaries: state?.relations.filter(r => r.status === 'tributary').length || 0, wars: state?.relations.filter(r => r.status === 'war').length || 0, alliances: state?.relations.filter(r => r.status === 'alliance').length || 0, tradeRoutes: state?.relations.filter(r => r.status === 'trade' || (r.status === 'alliance' && r.tradeTotal > 0)).length || 0, warDeaths: state?.warDeaths || 0 };
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
  state.nuclearStrikes = raw.nuclearStrikes === undefined ? 0 : number(raw.nuclearStrikes, 'nuclear strikes', Number.MAX_SAFE_INTEGER, 0, true);
  state.subjugations = raw.subjugations === undefined ? 0 : number(raw.subjugations, 'subjugations', Number.MAX_SAFE_INTEGER, 0, true);
  const seen = new Set();
  for (const r of raw.relations) {
    if (!r || typeof r !== 'object') bad('relation');
    const a = number(r.a, 'group ID', sim.nextGroupId - 1, 1, true), b = number(r.b, 'group ID', sim.nextGroupId - 1, 1, true);
    if (a >= b || seen.has(`${a}:${b}`) || !statuses.has(r.status) || typeof r.reason !== 'string' || !r.reason.length || r.reason.length > 500) bad('relation identity');
    seen.add(`${a}:${b}`);
    state.relations.push({ a, b, trust: number(r.trust, 'trust', 1, -1), tension: number(r.tension, 'tension', 100), status: r.status,
      since: number(r.since, 'since', sim.day, 0, true), lastContact: number(r.lastContact, 'last contact', sim.day, 0, true), warDays: number(r.warDays, 'war days', sim.day, 0, true),
      casualties: number(r.casualties, 'casualties', state.warDeaths, 0, true), tradeTotal: number(r.tradeTotal, 'trade volume'), reason: r.reason });
    if (r.status === 'tributary') {
      if (r.overlord !== a && r.overlord !== b) bad('overlord');
      state.relations.at(-1).overlord = r.overlord;
    } else if (r.overlord !== undefined) bad('overlord');
  }
  // A society pays tribute to one overlord at most.
  const vassals = state.relations.filter(r => r.status === 'tributary').map(r => r.overlord === r.a ? r.b : r.a);
  if (new Set(vassals).size !== vassals.length) bad('tributary with two overlords');
  if (state.relations.reduce((n, r) => n + r.casualties, 0) > state.warDeaths) bad('casualty accounting');
  return state;
}
