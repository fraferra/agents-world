/** Culture that develops with society: shared norms drift with members, events
 * and institutions; customs emerge from what a society actually eats, makes,
 * builds and lives through; they strengthen with practice, spread through
 * contact, fade when their basis disappears, and are handed to colonies.
 * Societies grow from bands to cities and choose leaders whose own minds
 * colour collective decisions.
 */
export const NORMS = Object.freeze(['innovation', 'tradition', 'collectivism', 'hierarchy', 'martial', 'mercantile', 'piety', 'expansion']);
export const TIERS = Object.freeze(['Band', 'Village', 'Town', 'City', 'Metropolis']);
const NORM_LABELS = { innovation: 'Inventive', tradition: 'Traditional', collectivism: 'Communal', hierarchy: 'Hierarchical', martial: 'Martial', mercantile: 'Mercantile', piety: 'Devout', expansion: 'Expansionist' };
const EFFECT_KEYS = ['food', 'gathering', 'crafting', 'healing', 'storage', 'trade', 'combat', 'learning', 'cohesion'];
const MAX_CUSTOMS = 6, REGISTRY_LIMIT = 400;
const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const round = value => Math.round(value * 1e4) / 1e4 || 0;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function initializeGlobalCulture(sim) {
  sim.culture = { nextId: 1, customs: [], coloniesFounded: 0, customsBorn: 0, customsShared: 0 };
  return sim.culture;
}

/** Norms start from the founders' own dispositions; colonies inherit with drift. */
export function initializeCulture(sim, group, parent = null) {
  const norms = parent ? Object.fromEntries(NORMS.map(key => [key, round(clamp(parent.civilization.culture.norms[key] + (hashNoise(group.id, key) - .5) * .12))])) : baselineNorms(sim, group);
  group.civilization.culture = {
    norms, customs: parent ? parent.civilization.culture.customs.map(entry => ({ id: entry.id, strength: round(entry.strength * .8) })) : [],
    tier: 0, leaderId: null, leaderSince: sim.day, parentId: parent ? parent.id : null, founded: sim.day, lastColony: sim.day, lastCustom: sim.day, pressure: 0,
  };
  return group.civilization.culture;
}
// Deterministic small variation without consuming the random generator.
function hashNoise(id, key) {
  let h = 2166136261 ^ id;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

function members(sim, group) { return group.members.map(id => sim._agentMap.get(id)).filter(Boolean); }

function baselineNorms(sim, group) {
  const targets = memberTargets(sim, group, null);
  return Object.fromEntries(NORMS.map(key => [key, round(targets[key])]));
}

/** What the current members, their experiences and the society's situation pull each norm toward. */
function memberTargets(sim, group, effects) {
  const people = members(sim, group).filter(agent => agent.age >= 14);
  const n = Math.max(1, people.length);
  const mean = read => people.reduce((sum, agent) => sum + read(agent), 0) / n;
  const p = key => mean(agent => agent.psyche?.personality[key] ?? .5);
  const v = key => mean(agent => agent.mind.values[key]);
  const civ = group.civilization, culture = civ.culture;
  const doctrine = key => effects?.[key] ?? .5;
  const inquiry = people.filter(agent => ['research', 'invent', 'study'].includes(agent.mind.policy.action)).length / n;
  const hardship = people.filter(agent => agent.psyche?.episodes.some(episode => ['disaster', 'loss', 'omen', 'illness', 'war', 'hardship'].includes(episode.type) && sim.day - episode.day < 240)).length / n;
  const atWar = sim.diplomacy?.relations.some(relation => relation.status === 'war' && (relation.a === group.id || relation.b === group.id)) ? 1 : 0;
  const tenure = culture?.leaderId ? Math.min(1, (sim.day - culture.leaderSince) / 2400) : 0;
  // A metropolis is no more hierarchical than a city: industrial hierarchy is added below.
  const tier = Math.min(1, (culture?.tier || 0) / 3);
  // Industry loosens tradition and kinship obligations, sharpens class and commerce;
  // computers and science go with secularisation; the bomb militarises the state.
  const b = civ.buildings;
  const industrial = Math.min(1, ((b.factory || 0) + (b.railway || 0) + (b.powerplant || 0)) / 3), information = b.datacenter ? 1 : 0, armed = b.silo ? 1 : 0;
  return {
    innovation: clamp((p('openness') + mean(agent => agent.traits.curiosity)) / 2 * .7 + Math.min(1, inquiry * 3) * .3 + industrial * .08 + information * .1),
    tradition: clamp(p('conscientiousness') * .5 + Math.min(1, mean(agent => agent.age) / 60) * .3 + Math.min(1, (sim.day - (culture?.founded ?? sim.day)) / 3600) * .2 - industrial * .12 - information * .08),
    collectivism: clamp((mean(agent => agent.traits.cooperation) + v('belonging') + v('care')) / 3 - industrial * .08),
    hierarchy: clamp(doctrine('authority') * .5 + tier * .3 + tenure * .2 + industrial * .06),
    martial: clamp(doctrine('militancy') * .5 + atWar * .35 + mean(agent => agent.mind.riskTolerance) * .15 + armed * .1),
    mercantile: clamp(Math.min(1, civ.tradePartners.length / 4) * .4 + Math.min(1, (civ.buildings.market || 0)) * .2 + mean(agent => agent.mind.ambition) * .4 + industrial * .1),
    piety: clamp(doctrine('spirituality') * .6 + hardship * .4 - information * .12),
    expansion: clamp(mean(agent => agent.psyche?.expansion ?? .45) + (culture?.pressure ?? 0) * .3),
  };
}

// ——— customs ———

const DISHES = { wild: ['forest stew', 'berry cakes', 'foraged feasts'], crops: ['flatbread', 'harvest porridge', 'grain beer'], game: ['roast game', 'smoked venison', 'hunters’ feasts'], fish: ['smoked fish', 'salted fish', 'river feasts'], herd: ['cheese', 'milk and curds', 'herders’ stew'] };
const CRAFTS = { machines: ['machine works', { crafting: .08, gathering: .03 }], electronics: ['tinkerers’ circles', { learning: .08, crafting: .02 }], bricks: ['patterned brickwork', { crafting: .06, cohesion: .03 }], cloth: ['dyed weaving', { trade: .06, crafting: .03 }], goods: ['painted pottery', { crafting: .05, trade: .03 }], tools: ['toolmakers’ guild', { crafting: .06, gathering: .03 }], metal: ['bronze casting', { crafting: .07, combat: .03 }], gems: ['gem carving', { trade: .08 }] };
const RITES = {
  innovation: ['apprentice trials', { learning: .08 }], tradition: ['ancestor rites', { cohesion: .08, learning: -.02 }], collectivism: ['communal vows', { cohesion: .08, healing: .03 }],
  hierarchy: ['councils of elders', { cohesion: .05, storage: .03 }], martial: ['warrior initiations', { combat: .1 }], mercantile: ['market fairs', { trade: .1 }],
  piety: ['pilgrimages', { cohesion: .07, healing: .03 }], expansion: ['pathfinder rites', { gathering: .05 }],
};

function nearestRegion(sim, point) {
  let best = null, closest = Infinity;
  for (const region of sim.regions || []) { const d = distance(region, point); if (d < closest) { closest = d; best = region; } }
  return best;
}

/** The material and social facts a new custom could grow from, with its effects. */
function possibleCustoms(sim, group) {
  const civ = group.civilization, culture = civ.culture, options = [];
  const diet = civ.diet || {}, total = Object.values(diet).reduce((a, b) => a + b, 0);
  for (const [source, amount] of Object.entries(diet)) if (total > 10 && amount / total > .35) options.push({ kind: 'cuisine', basis: `cuisine:${source}`, noun: DISHES[source][Math.floor(hashNoise(group.id, source) * 3)], effects: { storage: .05, food: .03 } });
  for (const [material, [noun, effects]] of Object.entries(CRAFTS)) {
    const made = material === 'gems' ? civ.stock.gems * 10 : civ.production[material] || 0;
    if (made > 25) options.push({ kind: 'craft', basis: `craft:${material}`, noun, effects });
  }
  const people = members(sim, group);
  const hardship = people.filter(agent => agent.psyche?.episodes.some(episode => ['disaster', 'illness', 'omen'].includes(episode.type))).length / Math.max(1, people.length);
  if (hardship > .3) options.push({ kind: 'festival', basis: 'festival:remembrance', noun: 'day of remembrance', effects: { cohesion: .12, healing: .02 } });
  if (group.food / Math.max(1, group.members.length) > 2 && culture.tier >= 1) options.push({ kind: 'festival', basis: 'festival:harvest', noun: 'harvest festival', effects: { cohesion: .08, food: .02 } });
  if (sim.diplomacy?.relations.some(relation => relation.status === 'war' && (relation.a === group.id || relation.b === group.id))) options.push({ kind: 'festival', basis: 'festival:war', noun: 'warriors’ feast', effects: { combat: .06, cohesion: .03 } });
  const [norm, value] = Object.entries(culture.norms).sort((a, b) => b[1] - a[1])[0];
  if (value > .55) options.push({ kind: 'rite', basis: `rite:${norm}`, noun: RITES[norm][0], effects: RITES[norm][1] });
  const masonry = ['market', 'library', 'temple', 'hall', 'walls'].reduce((sum, key) => sum + (civ.buildings[key] || 0), 0);
  if ((civ.buildings.factory || 0) + (civ.buildings.railway || 0) >= 2) options.push({ kind: 'architecture', basis: 'architecture:iron', noun: 'iron-and-glass halls', effects: { storage: .05, trade: .04 } });
  else if (masonry >= 2) options.push({ kind: 'architecture', basis: 'architecture:brick', noun: 'brick courtyards', effects: { storage: .04, cohesion: .04 } });
  else if (culture.tier >= 1 && civ.buildings.lumbermill) options.push({ kind: 'architecture', basis: 'architecture:timber', noun: 'longhouses', effects: { storage: .03, cohesion: .03 } });
  return options;
}

function customBasisActive(sim, group, custom) {
  return possibleCustoms(sim, group).some(option => option.basis === custom.basis);
}

function registry(sim) {
  let item = registryIndex.get(sim);
  if (!item || item.list !== sim.culture.customs || item.length !== sim.culture.customs.length) {
    item = { list: sim.culture.customs, length: sim.culture.customs.length, byId: new Map(sim.culture.customs.map(custom => [custom.id, custom])) };
    registryIndex.set(sim, item);
  }
  return item.byId;
}
const registryIndex = new WeakMap();
export function customById(sim, id) { return registry(sim).get(id); }

function createCustom(sim, group, option) {
  const region = nearestRegion(sim, group);
  const custom = {
    id: `custom-${sim.culture.nextId++}`, name: `${region ? region.name.split(' ')[0] : group.name.split(' ')[0]} ${option.noun}`, kind: option.kind, basis: option.basis,
    originId: group.id, origin: group.name, day: sim.day, effects: Object.fromEntries(Object.entries(option.effects).map(([key, value]) => [key, round(value)])),
    description: describe(option),
  };
  sim.culture.customs.push(custom);
  sim.culture.customsBorn++;
  if (sim.culture.customs.length > REGISTRY_LIMIT) prune(sim);
  return custom;
}
function describe(option) {
  const effect = Object.entries(option.effects).map(([key, value]) => `${value > 0 ? '+' : '−'}${Math.round(Math.abs(value) * 100)}% ${key}`).join(', ');
  const origin = { cuisine: 'a cuisine grown from what the land feeds them', craft: 'a craft tradition grown from what they make most', festival: 'a festival born of shared experience', rite: 'a rite expressing what the community values', architecture: 'a building style from the materials they build with' }[option.kind];
  return `${origin[0].toUpperCase()}${origin.slice(1)} (${effect}).`;
}
/** Customs no living society practices are forgotten once the record is full. */
function prune(sim) {
  const held = new Set(sim.groups.flatMap(group => group.civilization.culture?.customs.map(entry => entry.id) || []));
  sim.culture.customs = sim.culture.customs.filter(custom => held.has(custom.id)).concat(sim.culture.customs.filter(custom => !held.has(custom.id)).slice(-(REGISTRY_LIMIT / 4)));
}

/** Aggregate custom effects as multipliers, cached by the customs array identity. */
const modifierCache = new WeakMap();
export function customModifiers(state, group) {
  const customs = group?.civilization?.culture?.customs;
  if (!customs?.length || !state.culture) return null;
  const cached = modifierCache.get(group);
  if (cached && cached.customs === customs && cached.registry === state.culture.customs) return cached.modifiers;
  const byId = new Map(state.culture.customs.map(custom => [custom.id, custom]));
  const modifiers = Object.fromEntries(EFFECT_KEYS.map(key => [key, 0]));
  for (const entry of customs) {
    const custom = byId.get(entry.id);
    if (custom) for (const [key, value] of Object.entries(custom.effects)) modifiers[key] += value * entry.strength;
  }
  modifierCache.set(group, { customs, registry: state.culture.customs, modifiers });
  return modifiers;
}

// ——— tiers and leaders ———

export function tierOf(group) {
  const civ = group.civilization, n = group.members.length;
  const built = Object.values(civ.buildings).reduce((a, b) => a + b, 0), known = civ.technologies;
  if (n >= 40 && built >= 20 && civ.buildings.factory > 0 && known.includes('railways')) return 4;
  if (n >= 24 && built >= 12 && known.includes('masonry') && known.includes('governance')) return 3;
  if (n >= 12 && built >= 6 && known.includes('writing')) return 2;
  if (n >= 6 && built >= 2) return 1;
  return 0;
}

function chooseLeader(sim, group) {
  const people = members(sim, group).filter(agent => agent.age >= 20);
  if (!people.length) return null;
  const standing = new Map(people.map(agent => [agent.id, 0]));
  // Standing is the trust others actually place in someone, not self-regard.
  for (const agent of people) for (const relation of agent._relations) if (standing.has(relation.id)) standing.set(relation.id, standing.get(relation.id) + (relation.trust ?? .42 + relation.strength * .2));
  let best = null, bestScore = -Infinity;
  for (const agent of people) {
    // Wealth confers standing too, more so where it is inherited and defended.
    const score = agent.skills.leadership * .5 + standing.get(agent.id) * 8 + Math.min(agent.age, 55) * .2 + (agent.psyche?.personality.extraversion ?? .5) * 10 + agent.mind.ambition * 10 + Math.log1p(agent.wealth || 0) * 3;
    if (score > bestScore) { bestScore = score; best = agent; }
  }
  return best;
}

/** A society's character: the norms in which it most exceeds the world's other societies. */
export function cultureLabel(group, sim = null) {
  const norms = group.civilization.culture?.norms;
  if (!norms) return null;
  const peers = sim?.groups.filter(other => other.civilization.culture) || [];
  const mean = key => peers.length > 1 ? peers.reduce((sum, other) => sum + other.civilization.culture.norms[key], 0) / peers.length : .5;
  const top = NORMS.map(key => [key, norms[key] - mean(key)]).filter(([, lead]) => lead > .02).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([key]) => NORM_LABELS[key]);
  return top.length ? top.join(' · ') : 'Pragmatic';
}

// ——— monthly evolution ———

/** Called daily; each society is revisited monthly on a staggered schedule. */
export function advanceCulture(sim, effectsOf, hooks = {}) {
  for (const group of sim.groups) {
    const culture = group.civilization.culture;
    if (!culture) continue;
    if (sim.day % 30 !== group.id % 30) continue;
    // Norms drift toward what members are and what the society lives through.
    const targets = memberTargets(sim, group, effectsOf(group));
    const leader = sim._agentMap.get(culture.leaderId);
    // Customs reinforce the norms they express, so cultures diverge instead of averaging out.
    const byId = registry(sim);
    for (const entry of culture.customs) {
      const basis = byId.get(entry.id)?.basis || '';
      const norm = basis.startsWith('rite:') ? basis.slice(5) : basis.startsWith('festival:war') ? 'martial' : basis.startsWith('festival:') ? 'piety' : basis.startsWith('craft:gems') || basis.startsWith('craft:cloth') ? 'mercantile' : basis.startsWith('craft:') ? 'innovation' : basis.startsWith('architecture:') ? 'tradition' : null;
      if (norm) targets[norm] = clamp(targets[norm] + .05 * entry.strength);
    }
    for (const key of NORMS) culture.norms[key] = round(clamp(culture.norms[key] + (targets[key] - culture.norms[key]) * .06));
    if (leader?.psyche) {
      // A long-serving leader's temperament rubs off on shared norms.
      culture.norms.innovation = round(clamp(culture.norms.innovation + (leader.psyche.personality.openness - .5) * .01 * culture.norms.hierarchy));
      culture.norms.expansion = round(clamp(culture.norms.expansion + ((leader.psyche.expansion ?? .4) - .5) * .015 * culture.norms.hierarchy));
    }
    const tier = tierOf(group);
    if (tier !== culture.tier) {
      const rising = tier > culture.tier;
      culture.tier = tier;
      sim._event('group', `${group.name} ${rising ? 'grows into' : 'declines to'} a ${TIERS[tier].toLowerCase()}.`, { groupId: group.id });
    }
    // Leadership: kept for life in hierarchical societies, rotated by merit in egalitarian ones.
    const leaderValid = leader && leader.groupId === group.id;
    const rotate = leaderValid && culture.norms.hierarchy < .45 && sim.day - culture.leaderSince > 480;
    if (!leaderValid || rotate) {
      const next = chooseLeader(sim, group);
      if (next && next.id !== culture.leaderId) {
        culture.leaderId = next.id; culture.leaderSince = sim.day;
        hooks.onLeader?.(next, group);
        if (group.members.length >= 6) sim._event('group', `${next.name} becomes the leader of ${group.name}${rotate ? ' as the council rotates' : ''}.`, { groupId: group.id, agentId: next.id });
      } else if (!next) culture.leaderId = null;
    }
    if (sim.day % 120 === group.id % 120 || sim.day - culture.lastCustom >= 120) evolveCustoms(sim, group, hooks);
  }
}

function evolveCustoms(sim, group, hooks) {
  const culture = group.civilization.culture;
  culture.lastCustom = sim.day;
  const library = group.civilization.buildings.library ? .5 : 1;
  const byId = registry(sim);
  // Practised customs strengthen; those whose basis is gone fade (slower with a library).
  let customs = culture.customs.map(entry => {
    const custom = byId.get(entry.id);
    const active = custom && customBasisActive(sim, group, custom);
    return { id: entry.id, strength: round(clamp(entry.strength + (active ? .15 : -.2 * library))) };
  }).filter(entry => {
    if (entry.strength >= .1) return true;
    const custom = byId.get(entry.id);
    if (custom && group.members.length >= 6) sim._event('group', `${group.name} lets the custom of ${custom.name} fade.`, { groupId: group.id });
    return false;
  });
  const held = new Set(customs.map(entry => byId.get(entry.id)?.basis));
  const options = possibleCustoms(sim, group).filter(option => !held.has(option.basis));
  if (options.length && customs.length < MAX_CUSTOMS && sim._random() < .25 + culture.tier * .1) {
    const option = options[Math.floor(sim._random() * options.length)];
    const custom = createCustom(sim, group, option);
    customs = [...customs, { id: custom.id, strength: .5 }];
    hooks.onCustom?.(custom, group);
    sim._event('belief', `${group.name} develops the custom of ${custom.name}: ${custom.description.charAt(0).toLowerCase()}${custom.description.slice(1)}`, { groupId: group.id });
  }
  culture.customs = customs;
}

/** Contact through trade or alliance can carry a custom to another society. */
export function shareCustom(sim, from, to, chance) {
  const source = from.civilization.culture, target = to.civilization.culture;
  if (!source?.customs.length || !target || target.customs.length >= MAX_CUSTOMS) return null;
  const known = new Set(target.customs.map(entry => entry.id));
  const byId = registry(sim), heldBases = new Set(target.customs.map(entry => byId.get(entry.id)?.basis));
  const candidates = source.customs.filter(entry => !known.has(entry.id) && entry.strength >= .5 && !heldBases.has(byId.get(entry.id)?.basis));
  if (!candidates.length || sim._random() >= chance * (.5 + target.norms.innovation * .5) * (1.2 - target.norms.tradition * .6)) return null;
  const entry = candidates[Math.floor(sim._random() * candidates.length)];
  target.customs = [...target.customs, { id: entry.id, strength: .35 }];
  sim.culture.customsShared++;
  const custom = byId.get(entry.id);
  sim._event('belief', `${to.name} takes up the custom of ${custom.name} from ${from.name}.`, { groupId: to.id });
  return custom;
}

/** Culture's pull on a member's choices, as labelled score adjustments. */
export function culturalPull(sim, agent) {
  const group = sim._groupMap?.get(agent.groupId), culture = group?.civilization.culture;
  if (!culture) return null;
  const n = culture.norms, pull = {}, centred = key => (n[key] - .5) * 2;
  const add = (action, value, label) => { if (Math.abs(value) >= .25) (pull[action] ||= []).push({ value: round(value), label }); };
  for (const action of ['research', 'invent']) add(action, centred('innovation') * 5, centred('innovation') > 0 ? 'Our culture prizes invention' : 'Our culture distrusts novelty');
  add('invent', -Math.max(0, centred('tradition')) * 3, 'Tradition favours proven ways');
  add('reflect', Math.max(0, centred('tradition')) * 3 + centred('piety') * 6, 'Shared devotion');
  for (const action of ['build', 'farm', 'heal', 'teach']) add(action, centred('collectivism') * 4, centred('collectivism') > 0 ? 'Our people work for one another' : 'Each looks after their own');
  add('trade', centred('mercantile') * 6, centred('mercantile') > 0 ? 'A trading people' : 'Wary of outsiders');
  add('hunt', Math.max(0, centred('martial')) * 3, 'Martial pride');
  add('pioneer', centred('expansion') * 8, centred('expansion') > 0 ? 'Our people look to new lands' : 'Our people stay rooted');
  // In hierarchical societies the leader's own ambitions steer members' effort.
  const leader = sim._agentMap.get(culture.leaderId);
  if (leader && leader.id !== agent.id && leader.psyche?.aspiration && n.hierarchy > .4) pull.leader = { aspiration: leader.psyche.aspiration, weight: (n.hierarchy - .4) * 6, name: leader.name };
  return pull;
}

// ——— strict restore ———

const invalid = field => { throw new Error(`Invalid culture save: ${field}.`); };
const object = (value, field) => { if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(field); return value; };
const num = (value, field, min = 0, max = 1, integer = false) => { if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isSafeInteger(value))) invalid(field); return value; };
const str = (value, field, max = 300) => { if (typeof value !== 'string' || !value.length || value.length > max) invalid(field); return value; };

export function restoreGlobalCulture(raw, sim) {
  object(raw, 'global culture');
  const state = { nextId: num(raw.nextId, 'next custom', 1, Number.MAX_SAFE_INTEGER, true), coloniesFounded: num(raw.coloniesFounded, 'colonies', 0, 1e12, true), customsBorn: num(raw.customsBorn, 'customs born', 0, 1e12, true), customsShared: num(raw.customsShared, 'customs shared', 0, 1e12, true) };
  if (!Array.isArray(raw.customs) || raw.customs.length > REGISTRY_LIMIT + 1) invalid('custom registry');
  const ids = new Set();
  state.customs = raw.customs.map(custom => {
    object(custom, 'custom');
    if (typeof custom.id !== 'string' || !/^custom-[1-9]\d*$/.test(custom.id) || Number(custom.id.slice(7)) >= state.nextId || ids.has(custom.id)) invalid('custom ID');
    ids.add(custom.id);
    if (!['cuisine', 'craft', 'festival', 'rite', 'architecture'].includes(custom.kind)) invalid('custom kind');
    const effects = {};
    for (const [key, value] of Object.entries(object(custom.effects, 'custom effects'))) { if (!EFFECT_KEYS.includes(key)) invalid('custom effect'); effects[key] = num(value, 'custom effect', -1, 1); }
    return { id: custom.id, name: str(custom.name, 'custom name', 120), kind: custom.kind, basis: str(custom.basis, 'custom basis', 60), originId: num(custom.originId, 'custom origin', 1, sim.nextGroupId - 1, true), origin: str(custom.origin, 'custom origin name', 80), day: num(custom.day, 'custom day', 0, sim.day, true), effects, description: str(custom.description, 'custom description', 400) };
  });
  return state;
}

export function restoreCulture(raw, sim, known) {
  const culture = object(raw, 'society culture');
  const norms = object(culture.norms, 'norms');
  const customs = Array.isArray(culture.customs) && culture.customs.length <= MAX_CUSTOMS + 1 ? culture.customs.map(entry => {
    object(entry, 'held custom');
    if (!known.has(entry.id)) invalid('held custom reference');
    return { id: entry.id, strength: num(entry.strength, 'custom strength') };
  }) : invalid('held customs');
  if (new Set(customs.map(entry => entry.id)).size !== customs.length) invalid('duplicate custom');
  const leaderId = culture.leaderId === null ? null : num(culture.leaderId, 'leader', 1, sim.nextAgentId - 1, true);
  const parentId = culture.parentId === null ? null : num(culture.parentId, 'parent society', 1, sim.nextGroupId - 1, true);
  return {
    norms: Object.fromEntries(NORMS.map(key => [key, num(norms[key], `norm ${key}`)])), customs, tier: num(culture.tier, 'tier', 0, TIERS.length - 1, true), leaderId, leaderSince: num(culture.leaderSince, 'leader since', 0, sim.day, true), parentId,
    founded: num(culture.founded, 'founding day', 0, sim.day, true), lastColony: num(culture.lastColony, 'last colony', 0, sim.day, true), lastCustom: num(culture.lastCustom, 'last custom', 0, sim.day, true),
    pressure: num(culture.pressure, 'land pressure'),
  };
}
