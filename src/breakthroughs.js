/** Breakthroughs: technologies no one wrote down in advance.
 *
 * Once a society has a scholarly tradition, its researchers can push past the
 * known tree. A frontier project combines two things the society already
 * knows, from different fields, into something new: a named technology whose
 * field, depth, effects and side effects are drawn for that combination. Each
 * breakthrough can itself be combined again, so there is no last invention.
 * Deep combinations of machines and information automate work and speed up
 * research itself, a feedback that can run away where materials and power
 * allow; weapons breed arms races; some advances pollute or unsettle.
 * Everything random comes from the world's saved generator.
 */
import { TECHNOLOGIES } from './civilization.js';

export const FIELDS = Object.freeze(['machines', 'weapons', 'energy', 'medicine', 'agriculture', 'transport', 'information', 'materials', 'society']);
export const ADVANCE_KEYS = Object.freeze(['production', 'food', 'research', 'health', 'combat', 'trade', 'energy', 'automation', 'growth', 'pollution', 'unrest']);

// The field and depth of each written technology, as parents for combinations.
const TECH_FIELD = {
  stonecraft: 'materials', cultivation: 'agriculture', forestry: 'materials', hunting: 'weapons', herbalism: 'medicine', pottery: 'materials', fishing: 'transport', weaving: 'machines',
  irrigation: 'agriculture', metallurgy: 'materials', medicine: 'medicine', writing: 'information', brickmaking: 'materials', husbandry: 'agriculture', masonry: 'materials', commerce: 'society',
  philosophy: 'information', engineering: 'machines', astronomy: 'information', governance: 'society', navigation: 'transport', chemistry: 'materials', steam: 'energy', railways: 'transport',
  vaccination: 'medicine', electricity: 'energy', aviation: 'transport', computing: 'information', fission: 'energy', 'nuclear-weapons': 'weapons',
};
const ERA_DEPTH = { Industrial: 2, Modern: 3, Atomic: 4 };
const techDepth = id => ERA_DEPTH[TECHNOLOGIES.find(tech => tech.id === id)?.era] || 1;

// What each field does, per unit of strength.
const FIELD_EFFECTS = {
  machines: { production: .12, automation: .03 }, weapons: { combat: .22, unrest: .02 }, energy: { energy: .2, production: .05 },
  medicine: { health: .12, growth: .05 }, agriculture: { food: .18 }, transport: { trade: .2, production: .03 },
  information: { research: .2, trade: .04 }, materials: { production: .1, food: .03 }, society: { trade: .06, research: .06, unrest: -.04 },
};
// Side effects that may come with an advance.
const SIDE_EFFECTS = [{ pollution: .06 }, { unrest: .05 }, { health: -.04 }, { food: -.03 }, { combat: .06 }, { growth: -.04 }];

const NOUNS = {
  machines: ['lathe', 'loom', 'press', 'turbine', 'assembly line', 'automaton', 'robot', 'assembler', 'nanofactory', 'self-replicating factory'],
  weapons: ['cannon', 'rifle', 'ironclad', 'machine gun', 'bomber', 'missile', 'drone swarm', 'railgun', 'laser battery', 'cyberweapon'],
  energy: ['dynamo', 'battery', 'turbine', 'hydroelectric dam', 'solar array', 'fuel cell', 'fusion reactor', 'orbital collector', 'antimatter trap', 'stellar engine'],
  medicine: ['anaesthetic', 'antiseptic', 'antibiotic', 'x-ray', 'transplant', 'gene therapy', 'regenerative medicine', 'longevity treatment', 'nanomedicine', 'mind upload'],
  agriculture: ['reaper', 'fertiliser works', 'hybrid seed', 'tractor', 'greenhouse', 'vertical farm', 'engineered crop', 'cultured meat', 'food synthesiser', 'terraforming'],
  transport: ['bicycle', 'motorcar', 'highway', 'jet', 'container ship', 'maglev', 'rocket', 'space elevator', 'orbital port', 'starship'],
  information: ['telegraph', 'telephone', 'radio', 'television', 'network', 'search engine', 'machine learning', 'artificial intelligence', 'general intelligence', 'superintelligence'],
  materials: ['steel', 'rubber', 'plastic', 'alloy', 'semiconductor', 'composite', 'graphene', 'smart material', 'metamaterial', 'programmable matter'],
  society: ['bank', 'stock exchange', 'public schools', 'welfare state', 'mass media', 'social insurance', 'social network', 'digital democracy', 'post-scarcity commons', 'global mind'],
};
// Some pairings of fields produce something neither could alone.
const HYBRIDS = {
  'information+machines': ['calculating engine', 'programmable loom', 'industrial robot', 'autonomous factory', 'artificial intelligence', 'self-improving AI', 'machine civilisation'],
  'information+weapons': ['codebreaking', 'radar', 'guided missile', 'autonomous drone', 'cyberwarfare', 'AI command'],
  'energy+weapons': ['explosive shell', 'flamethrower', 'thermobaric bomb', 'directed-energy weapon', 'fusion bomb'],
  'energy+transport': ['locomotive', 'electric tram', 'jet engine', 'electric car', 'fusion drive'],
  'information+medicine': ['medical records', 'diagnostic machine', 'genome sequencing', 'AI physician', 'brain interface'],
  'agriculture+machines': ['seed drill', 'combine harvester', 'automated farm', 'agricultural robot'],
  'information+society': ['printing press', 'newspaper', 'broadcast', 'internet', 'algorithmic governance'],
  'energy+machines': ['steam hammer', 'electric motor', 'power grid', 'smart grid', 'fusion foundry'],
  'materials+medicine': ['synthetic drug', 'prosthetic limb', 'artificial organ', 'nanobot'],
};
const MODIFIERS = ['Improved', 'Precision', 'Mass', 'Electric', 'Automatic', 'Integrated', 'Micro', 'Quantum', 'Neural', 'Autonomous', 'Planetary', 'Self-replicating'];
const roman = ['', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];
const round = value => Math.round(value * 1e4) / 1e4 || 0;
const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const pick = (sim, list) => list[Math.floor(sim._random() * list.length)];

export function initializeBreakthroughs(sim) {
  sim.breakthroughs = { nextId: 1, list: [] };
  return sim.breakthroughs;
}

const registryCache = new WeakMap();
function registry(sim) {
  let item = registryCache.get(sim);
  if (!item || item.list !== sim.breakthroughs.list || item.length !== sim.breakthroughs.list.length) {
    item = { list: sim.breakthroughs.list, length: sim.breakthroughs.list.length, byId: new Map(sim.breakthroughs.list.map(entry => [entry.id, entry])) };
    registryCache.set(sim, item);
  }
  return item.byId;
}
export function breakthroughById(sim, id) { return registry(sim).get(id); }

/** Everything a society can build on: its written technologies and its breakthroughs, with field and depth. */
function foundations(sim, group) {
  const civ = group.civilization, byId = registry(sim);
  return [
    ...civ.technologies.filter(id => TECH_FIELD[id]).map(id => ({ id, field: TECH_FIELD[id], depth: techDepth(id) })),
    ...(civ.breakthroughs || []).map(id => byId.get(id)).filter(Boolean).map(entry => ({ id: entry.id, field: entry.field, depth: entry.depth })),
  ];
}

/** Whether a society has the scholarly tradition to research beyond the known tree. */
export function canPushFrontier(group) {
  const known = group.civilization.technologies;
  return known.includes('writing') && known.includes('engineering');
}

/** The advance a society's researchers set out to make: two known things from different fields, combined. */
export function proposeFrontier(sim, group) {
  const civ = group.civilization, base = foundations(sim, group);
  if (base.length < 2) return null;
  const norms = civ.culture?.norms || {};
  // Culture and circumstance steer which fields a society pushes.
  const atWar = sim.diplomacy?.relations.some(r => r.status === 'war' && (r.a === group.id || r.b === group.id));
  const lean = { weapons: (norms.martial || 0) * 2 + (atWar ? 1.5 : 0), information: (norms.innovation || 0) * 1.5, society: (norms.collectivism || 0) + (norms.hierarchy || 0) * .5,
    transport: (norms.mercantile || 0) * 1.5 + (norms.expansion || 0), medicine: (norms.collectivism || 0) * .8, agriculture: group.food < group.members.length ? 1.5 : .3, machines: .8, energy: .6, materials: .6 };
  const weight = entry => .4 + (lean[entry.field] || 0) + entry.depth * .35;
  const choose = list => {
    const total = list.reduce((sum, entry) => sum + weight(entry), 0);
    let roll = sim._random() * total;
    for (const entry of list) { roll -= weight(entry); if (roll <= 0) return entry; }
    return list.at(-1);
  };
  const first = choose(base);
  const others = base.filter(entry => entry.field !== first.field);
  if (!others.length) return null;
  const second = choose(others);
  const field = sim._random() < .6 ? (weight(first) >= weight(second) ? first.field : second.field) : pick(sim, [first.field, second.field]);
  const depth = Math.max(first.depth, second.depth) + 1;
  const pair = [first.field, second.field].sort().join('+');
  const hybrid = HYBRIDS[pair] && sim._random() < .6;
  // Vocabulary runs from early to far-future over depths 2 to 12, whatever the list's length.
  const pool = hybrid ? HYBRIDS[pair] : NOUNS[field], stage = (depth - 2 + sim._random() * 1.5 - .75) / 10;
  const noun = pool[Math.min(pool.length - 1, Math.max(0, Math.floor(stage * pool.length)))];
  const modifier = sim._random() < .3 ? `${MODIFIERS[Math.min(MODIFIERS.length - 1, Math.max(0, Math.floor(stage * MODIFIERS.length)))]} ` : '';
  let name = `${modifier}${noun}`.replace(/^./, char => char.toUpperCase());
  const taken = sim.breakthroughs.list.filter(entry => entry.name === name || entry.name.startsWith(`${name} `)).length;
  if (taken) name += roman[Math.min(roman.length - 1, taken)] || ` ${taken + 1}`;
  // Effects: the field's own, half the other parent's, scaled by depth and luck; sometimes a side effect.
  const strength = (0.6 + sim._random() * 0.8) * (1 + (depth - 2) * 0.18) * (sim._random() < .05 ? 3 : 1);
  const effects = Object.fromEntries(ADVANCE_KEYS.map(key => [key, 0]));
  for (const [key, value] of Object.entries(FIELD_EFFECTS[field])) effects[key] += value * strength;
  const other = field === first.field ? second.field : first.field;
  for (const [key, value] of Object.entries(FIELD_EFFECTS[other])) effects[key] += value * strength * .5;
  // Machines that think, and thinking that runs on machines, automate work and research itself.
  if (pair === 'information+machines' && depth >= 4) { effects.automation += .08 * strength * (depth - 3); effects.research += .06 * strength * (depth - 3); }
  const side = sim._random() < .35 ? pick(sim, SIDE_EFFECTS) : null;
  if (side) for (const [key, value] of Object.entries(side)) effects[key] += value * (1 + depth * .1);
  for (const key of ADVANCE_KEYS) effects[key] = round(effects[key]);
  const required = Math.round(260 * 1.32 ** depth);
  // Prototypes are built from what this society can actually make.
  const b = civ.buildings, poweredWorks = b.factory > 0 && (b.powerplant > 0 || b.reactor > 0);
  const cost = { [b.forge ? 'metal' : 'tools']: round(depth * .8), [b.kiln ? 'bricks' : 'goods']: round(depth * .4), ...(depth >= 4 && poweredWorks ? { electronics: round((depth - 3) * .6) } : {}) };
  return { name, field, depth, parents: [first.id, second.id], effects, cost, required, progress: 0, contributors: [], hybrid: !!hybrid };
}

function affordable(group, cost) { return Object.entries(cost).every(([key, value]) => (group.civilization.stock[key] || 0) >= value); }

/** Called when frontier research reaches its goal. Returns the breakthrough, or null while materials are short. */
export function completeFrontier(sim, group, agent) {
  const civ = group.civilization, frontier = civ.frontier;
  if (!frontier || frontier.progress < frontier.required || !affordable(group, frontier.cost)) return null;
  for (const [key, value] of Object.entries(frontier.cost)) civ.stock[key] -= value;
  const entry = { id: `advance-${sim.breakthroughs.nextId++}`, name: frontier.name, field: frontier.field, depth: frontier.depth, parents: [...frontier.parents], effects: { ...frontier.effects },
    description: describe(frontier), day: sim.day, originId: group.id, origin: group.name, inventorId: agent?.id ?? null };
  sim.breakthroughs.list.push(entry);
  civ.frontier = null;
  adoptBreakthrough(sim, group, entry);
  sim._event('invention', `${group.name} achieves a breakthrough: ${entry.name}. ${entry.description}`, { groupId: group.id, ...(agent ? { agentId: agent.id } : {}) });
  return entry;
}

function describe(frontier) {
  const parts = Object.entries(frontier.effects).filter(([, value]) => Math.abs(value) >= .01).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .map(([key, value]) => `${value > 0 ? '+' : '−'}${Math.round(Math.abs(value) * 100)}% ${key}`);
  return `A ${frontier.field} advance of depth ${frontier.depth}${frontier.hybrid ? ', born of two fields' : ''} (${parts.join(', ')}).`;
}

/** A society takes up a breakthrough: its advances are summed, and weapons and automation shift its culture. */
export function adoptBreakthrough(sim, group, entry) {
  const civ = group.civilization;
  civ.breakthroughs ||= [];
  if (civ.breakthroughs.includes(entry.id)) return false;
  civ.breakthroughs.push(entry.id);
  civ.advances = sumAdvances(sim, civ.breakthroughs);
  const norms = civ.culture?.norms;
  if (norms && entry.field === 'weapons') norms.martial = round(clamp(norms.martial + .03));
  if (norms && entry.field === 'information') norms.innovation = round(clamp(norms.innovation + .02));
  return true;
}

export function sumAdvances(sim, ids) {
  const total = Object.fromEntries(ADVANCE_KEYS.map(key => [key, 0])), byId = registry(sim);
  for (const id of ids) {
    const entry = byId.get(id);
    if (entry) for (const key of ADVANCE_KEYS) total[key] += entry.effects[key] || 0;
  }
  // Diminishing returns: each field of advance saturates rather than compounding without end.
  for (const key of ADVANCE_KEYS) total[key] = round(key === 'pollution' || key === 'unrest' ? total[key] : Math.sign(total[key]) * Math.log1p(Math.abs(total[key]) * 1.5) / 1.5);
  return total;
}

const NO_ADVANCES = Object.freeze(Object.fromEntries(ADVANCE_KEYS.map(key => [key, 0])));
/** A society's summed advances (zero before any breakthrough). */
export function advances(group) { return group?.civilization?.advances || NO_ADVANCES; }

/**
 * Monthly: breakthroughs spread to trading partners, allies, tributaries and
 * kin whose own knowledge can take them up; automation produces without labour.
 */
export function advanceBreakthroughs(sim) {
  if (!sim.breakthroughs) initializeBreakthroughs(sim);
  const byId = registry(sim);
  for (const group of sim.groups) {
    const civ = group.civilization;
    if (!civ) continue;
    const fx = advances(group);
    // Automated works turn out goods and machines with no one at the bench.
    if (fx.automation > 0 && (civ.buildings.factory || civ.buildings.datacenter)) {
      const n = group.members.length, rate = fx.automation * (civ.buildings.powerplant || civ.buildings.reactor || fx.energy > .4 ? 1 : .3);
      for (const [key, per] of [['goods', .02], ['machines', .006], ['electronics', .003], ['tools', .008]]) { const made = n * rate * per; civ.stock[key] += made; civ.production[key] += made; }
    }
    if (sim.day % 30 !== (group.id + 7) % 30) continue;
    // Researchers waiting on materials improvise: each month the prototype needs less.
    const frontier = civ.frontier;
    if (frontier && frontier.progress >= frontier.required) {
      // Finished research is built as soon as the materials are there, credited to its last researcher.
      if (!completeFrontier(sim, group, sim._agentMap.get(frontier.contributors.at(-1)) || null)) for (const key of Object.keys(frontier.cost)) frontier.cost[key] = round(frontier.cost[key] * .9);
    }
    const known = new Set([...civ.technologies, ...(civ.breakthroughs || [])]);
    const openness = civ.culture?.norms.innovation ?? .5;
    for (const r of sim.diplomacy?.relations || []) {
      if (r.a !== group.id && r.b !== group.id || !['trade', 'alliance', 'tributary'].includes(r.status)) continue;
      const other = sim._groupMap.get(r.a === group.id ? r.b : r.a);
      for (const id of other?.civilization.breakthroughs || []) {
        const entry = byId.get(id);
        if (!entry || known.has(id) || !entry.parents.every(parent => known.has(parent))) continue;
        if (sim._random() < .08 * (.5 + openness)) {
          adoptBreakthrough(sim, group, entry); known.add(id);
          if (sim._random() < .3) sim._event('technology', `${group.name} takes up ${entry.name} from ${other.name}.`, { groupId: group.id });
          break;
        }
      }
    }
  }
}

export function breakthroughStats(sim) {
  const list = sim.breakthroughs?.list || [];
  return { breakthroughs: list.length, deepestAdvance: list.reduce((max, entry) => Math.max(max, entry.depth), 0) };
}

// ——— strict restore ———
const invalid = field => { throw new Error(`Invalid breakthrough save: ${field}.`); };
const num = (value, field, min = -10, max = 1e9) => (typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : invalid(field));
const text = (value, field, max = 200) => (typeof value === 'string' && value.length && value.length <= max ? value : invalid(field));
function effectsOf(raw, field) {
  if (!raw || typeof raw !== 'object') invalid(field);
  return Object.fromEntries(ADVANCE_KEYS.map(key => [key, num(raw[key] ?? 0, field, -10, 10)]));
}
function costOf(raw) {
  if (!raw || typeof raw !== 'object') invalid('cost');
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => { if (!['metal', 'bricks', 'electronics', 'tools', 'goods'].includes(key)) invalid('cost material'); return [key, num(value, 'cost', 0, 1e6)]; }));
}
const idPattern = /^advance-[1-9]\d*$/;

export function restoreBreakthroughs(raw, sim) {
  if (raw === undefined) return initializeBreakthroughs(sim);
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.list)) invalid('state');
  const nextId = num(raw.nextId, 'next ID', 1, Number.MAX_SAFE_INTEGER);
  const known = new Set(TECHNOLOGIES.map(tech => tech.id)), seen = new Set();
  const list = raw.list.map(entry => {
    if (!entry || typeof entry !== 'object' || !idPattern.test(entry.id) || Number(entry.id.slice(8)) >= nextId || seen.has(entry.id)) invalid('ID');
    if (!FIELDS.includes(entry.field) || !Array.isArray(entry.parents) || entry.parents.length !== 2) invalid('field or parents');
    for (const parent of entry.parents) if (!known.has(parent) && !seen.has(parent)) invalid('parent');
    seen.add(entry.id);
    return { id: entry.id, name: text(entry.name, 'name', 80), field: entry.field, depth: num(entry.depth, 'depth', 2, 1000), parents: [...entry.parents], effects: effectsOf(entry.effects, 'effects'),
      description: text(entry.description, 'description', 400), day: num(entry.day, 'day', 0, sim.day), originId: num(entry.originId, 'origin', 1, sim.nextGroupId - 1), origin: text(entry.origin, 'origin name', 80),
      inventorId: entry.inventorId === null ? null : num(entry.inventorId, 'inventor', 1, sim.nextAgentId - 1) };
  });
  return { nextId, list };
}

/** A society's breakthroughs and frontier project; advances are recomputed from the registry. */
export function restoreSocietyFrontier(raw, sim, known) {
  const ids = raw.breakthroughs === undefined ? [] : Array.isArray(raw.breakthroughs) ? raw.breakthroughs : invalid('society breakthroughs');
  const byId = registry(sim);
  if (ids.some(id => !byId.has(id)) || new Set(ids).size !== ids.length) invalid('society breakthrough');
  let frontier = null;
  if (raw.frontier !== undefined && raw.frontier !== null) {
    const f = raw.frontier;
    if (!f || typeof f !== 'object' || !FIELDS.includes(f.field) || !Array.isArray(f.parents) || f.parents.length !== 2 || !Array.isArray(f.contributors)) invalid('frontier');
    for (const parent of f.parents) if (!known.includes(parent) && !ids.includes(parent)) invalid('frontier parent');
    frontier = { name: text(f.name, 'frontier name', 80), field: f.field, depth: num(f.depth, 'frontier depth', 2, 1000), parents: [...f.parents], effects: effectsOf(f.effects, 'frontier effects'), cost: costOf(f.cost),
      required: num(f.required, 'frontier effort', 1, 1e12), progress: num(f.progress, 'frontier progress', 0, 1e12), contributors: f.contributors.map(id => num(id, 'contributor', 1, sim.nextAgentId - 1)), hybrid: f.hybrid === true };
  }
  return { breakthroughs: [...ids], frontier, ...(ids.length ? { advances: sumAdvances(sim, ids) } : {}) };
}
