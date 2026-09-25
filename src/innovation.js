/** Open-ended design search over explicit physical and social primitives.
 * Names describe computed designs; discovery requires labor and costly trials.
 * All stochastic choices use the world's saved PRNG, never wall-clock time.
 */
import { appraise, techniqueFactor, practise } from './psyche.js';
import { customModifiers } from './culture.js';

const EFFECTS = ['food', 'gathering', 'crafting', 'healing', 'storage', 'trade', 'combat', 'learning'];
const DOCTRINE = ['solidarity', 'openness', 'authority', 'militancy', 'spirituality'];
const MATERIALS = ['food', 'wood', 'stone', 'ore'];
const DOMAINS = ['agriculture', 'extraction', 'manufacturing', 'medicine', 'logistics', 'warfare', 'belief'];
const METHODS = ['layering', 'binding', 'grinding', 'heating', 'channeling', 'sorting'];
const PRINCIPLES = ['retention', 'leverage', 'circulation', 'precision', 'coordination', 'preservation'];
const PRACTICES = ['shared vigils', 'seasonal gatherings', 'ancestor stories', 'public pledges', 'silent reflection', 'journey rituals'];
const SYMBOLS = ['River', 'Hearth', 'Sky', 'Seed', 'Stone', 'Path', 'Dawn', 'Tide'];
const primaryEffect = { agriculture: 'food', extraction: 'gathering', manufacturing: 'crafting', medicine: 'healing', logistics: 'trade', warfare: 'combat' };
const relevantSkill = { agriculture: 'farming', extraction: 'mining', manufacturing: 'crafting', medicine: 'medicine', logistics: 'leadership', warfare: 'crafting' };
const cache = new WeakMap();
const knowledgeCache = new WeakMap();
const clamp = (v, low = 0, high = 1) => Math.min(high, Math.max(low, v));
const blank = keys => Object.fromEntries(keys.map(key => [key, 0]));
const pick = (sim, list) => list[Math.floor(sim._random() * list.length)];
// JSON has only one zero; canonicalize tiny negative experimental effects so
// file checkpoints preserve the exact same state as in-memory checkpoints.
const round = n => Math.round(n * 1e6) / 1e6 || 0;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function knowledge(holder) {
  const ideas = holder.ideas || [];
  let known = knowledgeCache.get(holder);
  if (!known || known.array !== ideas || known.length > ideas.length) {
    known = { array: ideas, length: 0, set: new Set(), categorized: 0, registry: null, invention: [], belief: [] };
    knowledgeCache.set(holder, known);
  }
  while (known.length < ideas.length) known.set.add(ideas[known.length++]);
  return known;
}

/** Incremental membership lookup shared with the agent policy. */
export function knowsIdea(holder, id) { return knowledge(holder).set.has(id); }

function knownKind(sim, holder, kind) {
  const known = knowledge(holder), state = indexed(sim);
  if (known.registry !== state.registry) {
    known.registry = state.registry; known.categorized = 0; known.invention = []; known.belief = [];
  }
  while (known.categorized < known.array.length) {
    const idea = state.ideas.get(known.array[known.categorized++]);
    if (idea) known[idea.kind].push(idea);
  }
  return known[kind];
}

function indexed(sim) {
  const registry = sim.innovation?.discoveries || [];
  let item = cache.get(sim);
  if (!item || item.registry !== registry) {
    item = { registry, indexed: 0, ideas: new Map(), groups: new WeakMap() };
    cache.set(sim, item);
  }
  while (item.indexed < registry.length) {
    const idea = registry[item.indexed++];
    item.ideas.set(idea.id, idea);
  }
  return item;
}

export function initializeInnovation(sim) {
  sim.innovation = { nextId: 1, discoveries: [], trials: 0, failures: 0, successes: 0 };
  cache.delete(sim);
  return sim.innovation;
}

export function initializeAgentIdeas(agent) {
  agent.ideas = []; agent.convictions = {};
  return agent;
}

export function initializeGroupIdeas(group) {
  Object.assign(group.civilization, { ideas: [], doctrine: null, experiment: null });
  return group;
}

function ensure(sim, agent, group) {
  if (!sim.innovation) initializeInnovation(sim);
  if (agent && !agent.ideas) initializeAgentIdeas(agent);
  if (group && !group.civilization.ideas) initializeGroupIdeas(group);
}

function remember(sim, agent, type, text) {
  if (!agent.mind) return;
  agent.mind.memories.unshift({ day: sim.day, type, text });
  if (agent.mind.memories.length > 8) agent.mind.memories.length = 8;
}

// People carry only so many designs in mind, societies only so many in use; the oldest are forgotten.
export const PERSON_DESIGNS = 60, SOCIETY_DESIGNS = 150;
function forgetOldest(sim, holder, limit, keep = null) {
  const index = indexed(sim).ideas;
  let designs = holder.ideas.filter(id => index.get(id)?.kind === 'invention').length;
  if (designs <= limit) return;
  // A new array, so membership caches rebuild.
  holder.ideas = holder.ideas.filter(id => { if (designs > limit && id !== keep && index.get(id)?.kind === 'invention') { designs--; return false; } return true; });
}

function learn(sim, agent, idea, conviction = .55) {
  if (knowsIdea(agent, idea.id)) return false;
  agent.ideas.push(idea.id);
  if (idea.kind === 'invention') forgetOldest(sim, agent, PERSON_DESIGNS, idea.id);
  if (idea.kind === 'belief') agent.convictions[idea.id] = clamp(conviction);
  if (agent.mind) {
    agent.mind.needs.stimulation = clamp(agent.mind.needs.stimulation - 10, 0, 100);
    agent.mind.needs.purpose = clamp(agent.mind.needs.purpose - 5, 0, 100);
  }
  remember(sim, agent, 'learning', `Learned ${idea.name.toLowerCase()}.`);
  return true;
}

function adopt(sim, group, idea) {
  if (knowsIdea(group.civilization, idea.id)) return;
  group.civilization.ideas.push(idea.id);
  if (idea.kind === 'invention') forgetOldest(sim, group.civilization, SOCIETY_DESIGNS, idea.id);
}

/**
 * Yearly: designs no one holds any more, and that nothing still refers to (a
 * running experiment, a remembered conversation, a later design's lineage in
 * use), are dropped from the registry. The world forgets what no one knows.
 */
function pruneRegistry(sim) {
  const held = new Set();
  for (const agent of sim.agents) for (const id of agent.ideas || []) held.add(id);
  for (const group of sim.groups) {
    for (const id of group.civilization?.ideas || []) held.add(id);
    if (group.civilization?.doctrine) held.add(group.civilization.doctrine);
    for (const id of group.civilization?.experiment?.hypothesis.parentIds || []) held.add(id);
  }
  for (const message of sim.civilization?.messages || []) if (message.ideaId) held.add(message.ideaId);
  const before = sim.innovation.discoveries.length;
  sim.innovation.discoveries = sim.innovation.discoveries.filter(idea => held.has(idea.id));
  if (sim.innovation.discoveries.length !== before) cache.delete(sim);
}

function weighted(sim, choices) {
  let remaining = sim._random() * choices.reduce((sum, item) => sum + item.weight, 0);
  for (const item of choices) { remaining -= item.weight; if (remaining <= 0) return item.value; }
  return choices[choices.length - 1].value;
}

function resources(group, key) {
  return key === 'food' || key === 'wood' ? group[key] : group.civilization.stock[key];
}

function canPay(group, cost) { return MATERIALS.every(key => resources(group, key) >= cost[key]); }
function pay(group, cost) {
  for (const key of MATERIALS) {
    if (key === 'food' || key === 'wood') group[key] -= cost[key];
    else group.civilization.stock[key] -= cost[key];
  }
}

function costFor(recipe, generation) {
  const cost = blank(MATERIALS), complexity = 1 + Math.log1p(generation) * .2;
  cost.food = round(.09 + recipe.intensity * .09 * complexity);
  for (const material of recipe.materials) cost[material] = round(cost[material] + (.1 + recipe.intensity * .2) * complexity);
  return cost;
}

function describeDesign(design) {
  const improves = EFFECTS.filter(key => design.effects[key] > .015);
  const burdens = EFFECTS.filter(key => design.effects[key] < -.015);
  return `${design.recipe.method[0].toUpperCase()}${design.recipe.method.slice(1)} ${design.recipe.materials.join(' and ')} to explore ${design.recipe.principle}; intensity ${design.recipe.intensity.toFixed(2)}. Intended gains: ${improves.join(', ') || 'none yet'}. Tradeoffs: ${burdens.join(', ') || 'experimental uncertainty'}.`;
}

function propose(sim, agent, group) {
  const beliefs = agent.mind.beliefs, values = agent.mind.values;
  const warring = sim.diplomacy?.relations.some(relation => relation.status === 'war' && (relation.a === group.id || relation.b === group.id));
  // What a society thinks worth improving follows its culture as well as its problems.
  const norms = group.civilization.culture?.norms || {};
  const domain = weighted(sim, [
    { value: 'agriculture', weight: 1.8 + (1 - beliefs.abundance) * 3 + values.security + (norms.collectivism || 0) * .5 },
    { value: 'extraction', weight: .7 + (group.wood < 3 ? 1.2 : 0) + agent.skills.mining / 50 + (norms.expansion || 0) * .6 },
    { value: 'manufacturing', weight: .8 + agent.skills.crafting / 40 + (norms.innovation || 0) * .6 },
    { value: 'medicine', weight: .6 + values.care + (agent.health < 85 ? 1 : 0) + (norms.piety || 0) * .4 + (sim.weather?.plagueUntil > sim.day ? 2 : 0) },
    { value: 'logistics', weight: .6 + agent.skills.leadership / 60 + values.belonging + (norms.mercantile || 0) * 1.5 },
    { value: 'warfare', weight: .2 + (warring ? 3 : 0) + (1 - beliefs.trust) * .5 + (norms.martial || 0) * 1.5 },
  ]);
  const all = indexed(sim).ideas;
  const known = [...new Set([...agent.ideas, ...group.civilization.ideas])].map(id => all.get(id)).filter(idea => idea?.kind === 'invention');
  const relatives = known.filter(idea => idea.domain === domain);
  const parents = [];
  if (known.length && sim._random() < .86) parents.push(pick(sim, relatives.length ? relatives : known));
  if (known.length > 1 && sim._random() < .48) {
    const second = pick(sim, known.filter(idea => idea.id !== parents[0]?.id));
    if (second) parents.push(second);
  }
  const generation = parents.length ? Math.max(...parents.map(idea => idea.generation)) + 1 : 0;
  const available = MATERIALS.filter(key => resources(group, key) > .15 || key === 'wood' || key === 'food');
  const materials = [pick(sim, available)];
  if (sim._random() < .65) materials.push(pick(sim, available.filter(key => key !== materials[0])));
  const method = sim._random() < .45 && parents.length ? pick(sim, parents).recipe.method : pick(sim, METHODS);
  const principle = sim._random() < .45 && parents.length ? pick(sim, parents).recipe.principle : pick(sim, PRINCIPLES);
  const intensity = round(.35 + sim._random() * 1.25 + Math.log1p(generation) * .1);
  const recipe = { materials, method, principle, intensity };
  // Every primitive contributes to a continuous, multi-objective design vector.
  // Recombination preserves measured parental characteristics, with mutations.
  const effects = blank(EFFECTS);
  for (const key of EFFECTS) {
    const inherited = parents.length ? parents.reduce((sum, parent) => sum + parent.effects[key], 0) / parents.length : 0;
    effects[key] = inherited * .34 + (sim._random() - .5) * .055 * intensity;
  }
  const domainSkill = agent.skills[relevantSkill[domain]] || 0;
  effects[primaryEffect[domain]] += (.1 + sim._random() * .12 + domainSkill * .001) * Math.sqrt(intensity);
  const materialEffect = { food: 'healing', wood: 'gathering', stone: 'crafting', ore: 'combat' };
  for (const material of materials) effects[materialEffect[material]] += .025 * intensity;
  const principleEffect = { retention: 'storage', leverage: 'gathering', circulation: 'food', precision: 'crafting', coordination: 'learning', preservation: 'healing' };
  effects[principleEffect[principle]] += .055 * intensity;
  const methodBurden = { layering: 'gathering', binding: 'crafting', grinding: 'storage', heating: 'food', channeling: 'combat', sorting: 'trade' };
  effects[methodBurden[method]] -= (.06 + sim._random() * .07) * intensity;
  // An additional real opportunity cost prevents designs being free upgrades.
  const burden = pick(sim, EFFECTS.filter(key => key !== primaryEffect[domain]));
  effects[burden] -= .055 * intensity;
  for (const key of EFFECTS) effects[key] = round(effects[key]);
  const draft = {
    kind: 'invention', name: `${materials.map(material => material[0].toUpperCase() + material.slice(1)).join('–')} ${method} ${principle} ${sim.innovation.nextId}`,
    description: '', parentIds: parents.map(idea => idea.id), generation, domain, recipe, effects, doctrine: null, cost: costFor(recipe, generation),
  };
  draft.description = describeDesign(draft);
  return { hypothesis: draft, progress: 0, required: 12 + intensity * 14 + Math.log1p(generation) * 8, contributors: [], attempts: 0 };
}

function register(sim, agent, group, draft, evidence) {
  const idea = { id: `idea-${sim.innovation.nextId++}`, ...draft, createdDay: sim.day, founderId: agent.id, originGroupId: group.id, evidence };
  sim.innovation.discoveries.push(idea);
  indexed(sim);
  adopt(sim, group, idea);
  learn(sim, agent, idea, .85);
  return idea;
}

/** One paid work action; no elapsed-time discovery and no finite design list. */
export function attemptInnovation(sim, agent, group) {
  if (!group?.civilization || !agent.mind || agent.age < 14 || agent.energy < 12) return false;
  ensure(sim, agent, group);
  if (distance(agent, group) > 7) {
    sim._move(agent, group); agent.action = 'joining the shared experiment'; return true;
  }
  const civ = group.civilization;
  if (!civ.experiment) civ.experiment = propose(sim, agent, group);
  const project = civ.experiment;
  if (!canPay(group, project.hypothesis.cost)) { agent.action = 'seeking experiment materials'; return false; }
  const peers = sim._neighbors(agent, 7).filter(other => other.groupId === group.id && ['invent', 'experiment', 'research'].includes(other.mind?.policy.action));
  const collaboration = 1 + Math.log1p(peers.length) * .13 * agent.traits.cooperation;
  const effort = (.25 + agent.skills.scholarship * .009 + agent.skills[relevantSkill[project.hypothesis.domain]] * .004) * collaboration * innovationEffects(sim, group).learning * techniqueFactor(agent, 'research');
  project.progress = Math.min(project.required, project.progress + effort);
  if (!project.contributors.includes(agent.id)) project.contributors.push(agent.id);
  agent.energy = Math.max(0, agent.energy - 2.8);
  agent.action = `testing ${project.hypothesis.name.toLowerCase()}`;
  agent.skills.scholarship = Math.min(100, agent.skills.scholarship + .19 * (1 - agent.skills.scholarship / 120));
  practise(agent, 'scholarship', .19);
  agent.mind.needs.stimulation = Math.max(0, agent.mind.needs.stimulation - .8);
  agent.mind.needs.purpose = Math.max(0, agent.mind.needs.purpose - .45);
  if (project.progress < project.required) return true;
  pay(group, project.hypothesis.cost);
  project.attempts++; sim.innovation.trials++;
  const skill = agent.skills.scholarship * .55 + agent.skills[relevantSkill[project.hypothesis.domain]] * .45;
  const chance = clamp(.28 + skill * .0045 + Math.min(.18, Math.log1p(peers.length) * .075) + Math.min(.2, project.attempts * .035) - project.hypothesis.recipe.intensity * .065, .12, .88);
  if (sim._random() < chance) {
    const quality = clamp(.35 + skill * .004 + sim._random() * .3);
    const draft = structuredClone(project.hypothesis);
    for (const key of EFFECTS) draft.effects[key] = round(draft.effects[key] * (draft.effects[key] >= 0 ? .6 + quality * .65 : 1.1 - quality * .2));
    draft.description = describeDesign(draft);
    const idea = register(sim, agent, group, draft, { trials: project.attempts, successes: 1, failures: project.attempts - 1, quality });
    for (const id of project.contributors) {
      const person = sim._agentMap.get(id);
      if (person?.groupId === group.id) { learn(sim, person, idea); appraise(sim, person, 'discovery', { name: idea.name.toLowerCase() }); }
    }
    sim.innovation.successes++;
    civ.experiment = null;
    sim._event('invention', `${group.name} demonstrates ${idea.name.toLowerCase()} after ${idea.evidence.trials} trial${idea.evidence.trials === 1 ? '' : 's'}. ${idea.description}`, { groupId: group.id, agentId: agent.id });
  } else {
    sim.innovation.failures++;
    remember(sim, agent, 'experiment', `${project.hypothesis.name} failed; its materials were consumed, and we revised the design.`);
    appraise(sim, agent, 'failure', { name: project.hypothesis.name.toLowerCase() });
    sim._event('experiment', `${group.name}'s ${project.hypothesis.name.toLowerCase()} fails a material test. The researchers revise its proportions.`, { groupId: group.id, agentId: agent.id });
    project.progress = 0;
    const draft = project.hypothesis;
    draft.recipe.intensity = round(Math.max(.1, draft.recipe.intensity * (.8 + sim._random() * .3)));
    for (const key of EFFECTS) draft.effects[key] = round(draft.effects[key] * (.88 + sim._random() * .2));
    draft.cost = costFor(draft.recipe, draft.generation);
    draft.description = describeDesign(draft);
  }
  return true;
}

function affinity(agent, doctrine) {
  const values = agent.mind.values, traits = agent.traits;
  const preferred = { solidarity: (values.care + values.belonging + traits.cooperation) / 3, openness: (values.autonomy + traits.curiosity) / 2, authority: (values.security + 1 - values.autonomy) / 2, militancy: (1 - values.care + agent.mind.riskTolerance) / 2, spirituality: (values.belonging + agent.mind.needs.purpose / 100) / 2 };
  return 1 - DOCTRINE.reduce((sum, key) => sum + Math.abs(preferred[key] - doctrine[key]), 0) / DOCTRINE.length;
}

function proposeBelief(sim, agent, group, parents) {
  const values = agent.mind.values, mind = agent.mind, traits = agent.traits;
  const stress = clamp(1 - group.food / Math.max(1, group.members.length * 1.5));
  const rememberedConflict = mind.memories.some(memory => /war|raid|attack|killed/i.test(memory.text)) ? .15 : 0;
  const baseline = {
    solidarity: (values.belonging + values.care + traits.cooperation) / 3,
    openness: (values.autonomy + traits.curiosity + mind.beliefs.trust) / 3,
    authority: (values.security + 1 - values.autonomy + mind.ambition) / 3,
    militancy: (mind.riskTolerance + 1 - values.care + stress * (1 - mind.beliefs.trust)) / 3 + rememberedConflict,
    spirituality: (values.belonging + mind.needs.purpose / 100 + sim._random()) / 3,
  };
  // New beliefs grow out of the society's existing culture as well as personal experience.
  const norms = group.civilization.culture?.norms;
  if (norms) {
    baseline.solidarity = baseline.solidarity * .7 + norms.collectivism * .3;
    baseline.openness = baseline.openness * .7 + (norms.innovation + norms.mercantile) / 2 * .3;
    baseline.authority = baseline.authority * .7 + (norms.hierarchy + norms.tradition) / 2 * .3;
    baseline.militancy = baseline.militancy * .7 + norms.martial * .3;
    baseline.spirituality = baseline.spirituality * .7 + norms.piety * .3;
  }
  const doctrine = {};
  for (const key of DOCTRINE) {
    const inherited = parents.length ? parents.reduce((sum, parent) => sum + parent.doctrine[key], 0) / parents.length : baseline[key];
    doctrine[key] = round(clamp(baseline[key] * .6 + inherited * .4 + (sim._random() - .5) * .5));
  }
  const effects = blank(EFFECTS);
  effects.food = round((doctrine.solidarity - .5) * .1 - doctrine.spirituality * .025);
  effects.gathering = round((1 - doctrine.authority) * .025 - doctrine.spirituality * .02);
  effects.crafting = round((doctrine.authority - .5) * .06);
  effects.healing = round((doctrine.solidarity - doctrine.militancy) * .09);
  effects.storage = round((doctrine.authority - .5) * .08);
  effects.trade = round((doctrine.openness - doctrine.militancy) * .2);
  effects.combat = round((doctrine.militancy + doctrine.solidarity - 1) * .15);
  effects.learning = round((doctrine.openness - doctrine.authority) * .17);
  const practice = pick(sim, PRACTICES), symbol = pick(sim, SYMBOLS);
  const generation = parents.length ? Math.max(...parents.map(idea => idea.generation)) + 1 : 0;
  const title = doctrine.spirituality > .6 ? 'Way' : doctrine.authority > .65 ? 'Order' : doctrine.openness > .6 ? 'Fellowship' : 'Covenant';
  return {
    kind: 'belief', name: `${symbol} ${title} ${sim.innovation.nextId}`, parentIds: parents.map(idea => idea.id), generation, domain: 'belief',
    description: `A tradition of ${practice}, shaped by ${agent.name}'s experiences. It values ${doctrine.solidarity > .6 ? 'shared obligation' : 'personal responsibility'}, ${doctrine.openness > .6 ? 'outside ideas' : 'continuity'}, and ${doctrine.militancy > .6 ? 'forceful defense' : 'restraint in conflict'}.`,
    recipe: { materials: ['food'], method: practice, principle: symbol.toLowerCase(), intensity: round(.2 + doctrine.spirituality * .8) }, effects, doctrine,
    cost: { food: .04, wood: 0, stone: 0, ore: 0 },
  };
}

/** Reflection is paid social labor. Social beliefs do not claim physical truth. */
export function reflectBelief(sim, agent, group) {
  if (!group?.civilization || !agent.mind || agent.age < 12 || agent.energy < 10 || group.food < .04) return false;
  ensure(sim, agent, group);
  if (distance(agent, group) > 8) { sim._move(agent, group); agent.action = 'joining a community gathering'; return true; }
  const known = knownKind(sim, agent, 'belief');
  const communal = knownKind(sim, group.civilization, 'belief').filter(idea => !knowsIdea(agent, idea.id));
  const purpose = agent.mind.needs.purpose;
  group.food -= .04; agent.energy = Math.max(0, agent.energy - 1.8);
  agent.social = clamp(agent.social + 2, 0, 100);
  agent.mind.needs.purpose = Math.max(0, purpose - 3);
  agent.mind.needs.stimulation = Math.max(0, agent.mind.needs.stimulation - 1);
  agent.skills.leadership = Math.min(100, agent.skills.leadership + .13 * (1 - agent.skills.leadership / 120));
  practise(agent, 'leadership', .13);
  agent.action = 'reflecting on shared values';
  if (communal.length && sim._random() < .7) {
    const idea = pick(sim, communal);
    learn(sim, agent, idea, .3 + affinity(agent, idea.doctrine) * .4);
    agent.action = `learning ${idea.name.toLowerCase()}`;
    return true;
  }
  for (const idea of known) {
    const attraction = affinity(agent, idea.doctrine);
    agent.convictions[idea.id] = clamp((agent.convictions[idea.id] || 0) * .995 + attraction * .007);
  }
  const chance = known.length ? .0015 * (.4 + agent.traits.curiosity) * (.5 + purpose / 100) : .045;
  if (sim._random() >= chance) return true;
  const parents = known.length ? [pick(sim, known)] : [];
  if (known.length > 1 && sim._random() < .45) parents.push(pick(sim, known.filter(idea => idea.id !== parents[0].id)));
  const draft = proposeBelief(sim, agent, group, parents);
  const idea = register(sim, agent, group, draft, { trials: 0, successes: 0, failures: 0, quality: 0 });
  sim._event('belief', `${agent.name} articulates ${idea.name}, a new shared tradition in ${group.name}. ${idea.description}`, { groupId: group.id, agentId: agent.id });
  return true;
}

export function spreadIdeas(sim, speaker, listener, trust, deliberate = false) {
  ensure(sim, speaker, null); ensure(sim, listener, null);
  const index = indexed(sim).ideas;
  const missing = speaker.ideas.filter(id => !knowsIdea(listener, id)).map(id => index.get(id)).filter(Boolean);
  if (!missing.length) return null;
  const idea = pick(sim, missing);
  // Conformist transmission: a belief the listener's community already follows is easier to take up.
  const community = sim._groupMap?.get(listener.groupId)?.civilization;
  const conformity = idea.kind !== 'belief' || !community ? 1 : community.doctrine === idea.id ? 1.4 : community.ideas.includes(idea.id) ? 1.15 : .85;
  const compatibility = (idea.kind === 'belief' ? affinity(listener, idea.doctrine) : .65 + listener.traits.curiosity * .35) * conformity;
  if (sim._random() >= clamp(trust) * compatibility * (deliberate ? .95 : .65)) return null;
  learn(sim, listener, idea, .25 + compatibility * .45 * trust);
  const group = sim._groupMap.get(listener.groupId);
  if (group && distance(listener, group) < 12) { ensure(sim, null, group); adopt(sim, group, idea); }
  return { kind: idea.kind, ideaId: idea.id, text: `${speaker.name} shared ${idea.name.toLowerCase()}; ${listener.name} ${idea.kind === 'belief' ? 'considered its values and joined its practice' : 'learned the working design'}.` };
}

/** Pure with respect to world state; also accepts browser snapshots. */
/** Adopted designs and doctrine, then the society's living customs on top. */
export function innovationEffects(sim, group) {
  const base = ideaEffects(sim, group);
  const customs = group?.civilization?.culture?.customs;
  if (!customs?.length) return base;
  const cached = combined.get(group);
  if (cached && cached.base === base && cached.customs === customs) return cached.effects;
  const modifiers = customModifiers(sim, group);
  const effects = { ...base };
  if (modifiers) for (const key of EFFECTS) effects[key] = base[key] * (1 + Math.max(-.5, modifiers[key] || 0));
  Object.freeze(effects);
  combined.set(group, { base, customs, effects });
  return effects;
}
const combined = new WeakMap();

function ideaEffects(sim, group) {
  const civ = group?.civilization, state = indexed(sim);
  if (!civ?.ideas) return { ...Object.fromEntries(EFFECTS.map(key => [key, 1])), ...Object.fromEntries(DOCTRINE.map(key => [key, .5])) };
  const previous = state.groups.get(group);
  if (previous && previous.ideas === civ.ideas && previous.length === civ.ideas.length && previous.doctrine === civ.doctrine) return previous.effects;
  const reusable = previous?.ideas === civ.ideas && previous.length <= civ.ideas.length;
  const gains = reusable ? previous.gains : blank(EFFECTS), burdens = reusable ? previous.burdens : blank(EFFECTS);
  for (let position = reusable ? previous.length : 0; position < civ.ideas.length; position++) {
    const idea = state.ideas.get(civ.ideas[position]);
    if (!idea || idea.kind !== 'invention') continue;
    for (const key of EFFECTS) {
      if (idea.effects[key] >= 0) gains[key] += idea.effects[key];
      else burdens[key] -= idea.effects[key];
    }
  }
  const adopted = state.ideas.get(civ.doctrine);
  const effects = {};
  for (const key of EFFECTS) {
    const beliefEffect = adopted?.kind === 'belief' ? adopted.effects[key] : 0;
    // Both benefits and integration costs have diminishing returns. Making
    // costs grow as sqrt(n) against log(n) benefits would make every field
    // inevitably collapse as the archive grows, regardless of design quality.
    effects[key] = (1 + Math.log1p(gains[key]) * .7) / (1 + Math.log1p(burdens[key]) * .22) * Math.exp(beliefEffect);
  }
  for (const key of DOCTRINE) effects[key] = adopted?.doctrine?.[key] ?? .5;
  Object.freeze(effects);
  state.groups.set(group, { ideas: civ.ideas, length: civ.ideas.length, doctrine: civ.doctrine, gains, burdens, effects });
  return effects;
}

export function advanceInnovation(sim) {
  if (!sim.innovation) initializeInnovation(sim);
  if (sim.day % 360 === 180) pruneRegistry(sim);
  const index = indexed(sim).ideas;
  for (const group of sim.groups) {
    ensure(sim, null, group);
    const civ = group.civilization;
    if (civ.experiment) civ.experiment.contributors = civ.experiment.contributors.filter(id => sim._agentMap.get(id)?.groupId === group.id);
    if (sim.day % 12 !== group.id % 12) continue;
    const support = new Map();
    for (const id of group.members) {
      const agent = sim._agentMap.get(id);
      if (!agent || agent.groupId !== group.id) continue;
      ensure(sim, agent, null);
      for (const [ideaId, strength] of Object.entries(agent.convictions)) {
        const idea = index.get(ideaId);
        if (idea?.kind !== 'belief') continue;
        support.set(ideaId, (support.get(ideaId) || 0) + strength);
      }
    }
    const winner = [...support].sort((a, b) => b[1] - a[1] || Number(a[0].slice(5)) - Number(b[0].slice(5)))[0];
    const next = winner && winner[1] >= Math.max(.6, group.members.length * .16) ? winner[0] : null;
    if (next !== civ.doctrine) {
      civ.doctrine = next;
      if (next) {
        const idea = index.get(next); adopt(sim, group, idea);
        sim._event('belief', `${group.name} adopts ${idea.name} as its prevailing tradition through its members' convictions.`, { groupId: group.id });
      }
    }
  }
}

export function innovationStats(sim) {
  const discoveries = sim.innovation?.discoveries || [];
  return { inventions: discoveries.filter(idea => idea.kind === 'invention').length, beliefs: discoveries.filter(idea => idea.kind === 'belief').length, experiments: sim.groups.filter(group => group.civilization?.experiment).length, failedExperiments: sim.innovation?.failures || 0 };
}

// Portable state validation: registry IDs and lineage are checked, not capped.
const invalid = field => { throw new Error(`Invalid innovation save: ${field}.`); };
function object(raw, field) { if (!raw || typeof raw !== 'object' || Array.isArray(raw)) invalid(field); return raw; }
function num(raw, field, min = 0, max = Number.MAX_SAFE_INTEGER, integer = false) { if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < min || raw > max || (integer && !Number.isSafeInteger(raw))) invalid(field); return raw; }
function str(raw, field, max = 500) { if (typeof raw !== 'string' || !raw.length || raw.length > max) invalid(field); return raw; }
function list(raw, field) { if (!Array.isArray(raw)) invalid(field); return raw; }
function dict(raw, keys, field, min, max) {
  object(raw, field);
  if (Object.keys(raw).length !== keys.length || Object.keys(raw).some(key => !keys.includes(key))) invalid(`${field} fields`);
  return Object.fromEntries(keys.map(key => [key, num(raw[key], `${field}.${key}`, min, max)]));
}
function unique(raw, field, validate) {
  const values = list(raw, field).map(validate);
  if (new Set(values).size !== values.length) invalid(`duplicate ${field}`);
  return values;
}
function ideaId(raw) { if (typeof raw !== 'string' || !/^idea-[1-9]\d*$/.test(raw) || !Number.isSafeInteger(Number(raw.slice(5)))) invalid('idea ID'); return raw; }
function draft(raw) {
  object(raw, 'design');
  if (!['invention', 'belief'].includes(raw.kind) || !DOMAINS.includes(raw.domain) || (raw.kind === 'belief') !== (raw.domain === 'belief')) invalid('design kind/domain');
  const recipe = object(raw.recipe, 'recipe');
  const materials = unique(recipe.materials, 'materials', key => { if (!MATERIALS.includes(key)) invalid('material'); return key; });
  if (!materials.length) invalid('empty recipe');
  const belief = raw.kind === 'belief';
  if (!(belief ? PRACTICES : METHODS).includes(recipe.method) || !(belief ? SYMBOLS.map(symbol => symbol.toLowerCase()) : PRINCIPLES).includes(recipe.principle)) invalid('recipe primitive');
  const doctrine = belief ? dict(raw.doctrine, DOCTRINE, 'doctrine', 0, 1) : null;
  if (!belief && raw.doctrine !== null) invalid('invention doctrine');
  const result = {
    kind: raw.kind, name: str(raw.name, 'name', 160), description: str(raw.description, 'description', 700),
    parentIds: unique(raw.parentIds, 'parents', ideaId), generation: num(raw.generation, 'generation', 0, Number.MAX_SAFE_INTEGER, true), domain: raw.domain,
    recipe: { materials, method: recipe.method, principle: recipe.principle, intensity: num(recipe.intensity, 'intensity', .01, 100) },
    effects: dict(raw.effects, EFFECTS, 'effects', -100, 100), doctrine, cost: dict(raw.cost, MATERIALS, 'cost', 0, Number.MAX_SAFE_INTEGER),
  };
  if (result.parentIds.length > 2) invalid('parent count');
  return result;
}
function lineage(value, registry, ownId = null) {
  // Parents are always older. Forgotten ancestors may be missing; those still known must fit.
  if (value.parentIds.some(id => typeof id !== 'string' || !/^idea-[1-9]\d*$/.test(id) || (ownId !== null && Number(id.slice(5)) >= ownId))) invalid('parent reference');
  const parents = value.parentIds.map(id => registry.get(id)).filter(Boolean);
  if (parents.some(parent => parent.kind !== value.kind)) invalid('parent reference');
  const deepest = parents.length ? Math.max(...parents.map(parent => parent.generation)) + 1 : 0;
  if (parents.length === value.parentIds.length ? value.generation !== deepest : value.generation < deepest) invalid('lineage generation');
}

export function restoreInnovation(raw, sim) {
  object(raw, 'registry');
  const state = {
    nextId: num(raw.nextId, 'next ID', 1, Number.MAX_SAFE_INTEGER, true), discoveries: [],
    trials: num(raw.trials, 'trials', 0, Number.MAX_SAFE_INTEGER, true), failures: num(raw.failures, 'failures', 0, Number.MAX_SAFE_INTEGER, true), successes: num(raw.successes, 'successes', 0, Number.MAX_SAFE_INTEGER, true),
  };
  const index = new Map();
  let previousDay = -1, previousId = 0;
  for (const value of list(raw.discoveries, 'discoveries')) {
    const id = ideaId(value.id), number = Number(id.slice(5));
    if (number <= previousId || number >= state.nextId) invalid('registry ordering');
    const design = draft(value);
    lineage(design, index, number);
    const e = object(value.evidence, 'evidence');
    const evidence = { trials: num(e.trials, 'evidence trials', 0, state.trials, true), successes: num(e.successes, 'evidence successes', 0, state.successes, true), failures: num(e.failures, 'evidence failures', 0, state.failures, true), quality: num(e.quality, 'quality', 0, 1) };
    if (evidence.trials !== evidence.successes + evidence.failures || (design.kind === 'invention' ? evidence.successes !== 1 : evidence.trials !== 0 || evidence.quality !== 0)) invalid('evidence accounting');
    const idea = { id, ...design, createdDay: num(value.createdDay, 'creation day', 0, sim.day, true), founderId: num(value.founderId, 'founder ID', 1, sim.nextAgentId - 1, true), originGroupId: num(value.originGroupId, 'origin society ID', 1, sim.nextGroupId - 1, true), evidence };
    if (idea.createdDay < previousDay || design.parentIds.some(parent => (index.get(parent)?.createdDay ?? -1) > idea.createdDay)) invalid('creation order');
    previousId = number; previousDay = idea.createdDay;
    state.discoveries.push(idea); index.set(id, idea);
  }
  // Forgotten designs leave the registry, so it may hold fewer inventions than were ever made.
  if (state.trials !== state.failures + state.successes || state.successes < state.discoveries.filter(idea => idea.kind === 'invention').length) invalid('trial accounting');
  if (previousId >= state.nextId) invalid('registry ID sequence');
  if (state.discoveries.reduce((sum, idea) => sum + idea.evidence.failures, 0) > state.failures) invalid('failure accounting');
  return state;
}

function refs(raw, field, sim) {
  const index = indexed(sim).ideas;
  return unique(raw, field, value => { ideaId(value); if (!index.has(value)) invalid(`${field} reference`); return value; });
}

export function restoreAgentIdeas(rawAgent, sim) {
  const ideas = refs(rawAgent.ideas, 'individual ideas', sim), convictions = {};
  for (const [id, strength] of Object.entries(object(rawAgent.convictions, 'convictions'))) {
    if (!ideas.includes(id) || indexed(sim).ideas.get(id)?.kind !== 'belief') invalid('conviction reference');
    convictions[id] = num(strength, 'conviction', 0, 1);
  }
  if (ideas.some(id => indexed(sim).ideas.get(id).kind === 'belief' && !Object.hasOwn(convictions, id))) invalid('missing conviction');
  return { ideas, convictions };
}

export function restoreGroupIdeas(rawGroup, sim) {
  const raw = object(rawGroup.civilization, 'society ideas'), ideas = refs(raw.ideas, 'society ideas', sim), index = indexed(sim).ideas;
  if (raw.doctrine !== null && (!ideas.includes(raw.doctrine) || index.get(raw.doctrine)?.kind !== 'belief')) invalid('society doctrine');
  let experiment = null;
  if (raw.experiment !== null) {
    const p = object(raw.experiment, 'experiment'), hypothesis = draft(p.hypothesis);
    if (hypothesis.kind !== 'invention') invalid('experimental hypothesis');
    lineage(hypothesis, index);
    const required = num(p.required, 'required labor', .01);
    experiment = { hypothesis, progress: num(p.progress, 'experiment progress', 0, required), required, contributors: unique(p.contributors, 'contributors', id => num(id, 'contributor ID', 1, sim.nextAgentId - 1, true)), attempts: num(p.attempts, 'attempts', 0, sim.innovation.failures, true) };
  }
  return { ideas, doctrine: raw.doctrine, experiment };
}
