/** Individual cognition, knowledge transmission, and labor-driven civilization.
 * All randomness comes from the simulation. No activity advances from time alone.
 */
import { attemptInnovation, reflectBelief, spreadIdeas, innovationEffects, knowsIdea } from './innovation.js';
import { tradeAccess, recordTrade } from './diplomacy.js';
import { keptShare, addWealth, standing } from './economy.js';
import { deliberate, recordReasoning, clearReasoning, reinforce, livePsyche, appraise, appreciate, attune, teachTechnique, converse, trustIn, techniqueFactor, knownExpert, rememberPlace, recallPlace, revisitPlace, practise, TECHNIQUES as PRACTICES } from './psyche.js';

export const SKILLS = Object.freeze(['foraging', 'farming', 'forestry', 'mining', 'crafting', 'scholarship', 'medicine', 'leadership']);
// Foundation techniques. `materials` are consumed by the demonstration that
// completes research; knowledge learned from others needs no demonstration.
export const TECHNOLOGIES = Object.freeze([
  { id: 'stonecraft', name: 'Stone tools', requires: [], cost: 65, materials: {}, description: 'Shape stone and wood into tools that improve gathering and enable workshops.' },
  { id: 'cultivation', name: 'Cultivation', requires: [], cost: 80, materials: {}, description: 'Establish farms. Skilled labor turns fertile land into a reliable food supply.' },
  { id: 'forestry', name: 'Woodworking', requires: [], cost: 85, materials: {}, description: 'Build lumbermills and process timber more efficiently.' },
  { id: 'hunting', name: 'Hunting', requires: [], cost: 70, materials: {}, description: 'Spears and snares: hunters take far more game, and hides for clothing and trade.' },
  { id: 'herbalism', name: 'Herbalism', requires: [], cost: 90, materials: { herbs: 1 }, description: 'Know which plants heal. Apothecaries prepare herbs into remedies.' },
  { id: 'pottery', name: 'Kilns & pottery', requires: ['stonecraft'], cost: 140, materials: { clay: 1 }, description: 'Fire clay into useful goods, and build granaries to reduce spoilage.' },
  { id: 'fishing', name: 'Fishing', requires: ['forestry'], cost: 110, materials: { fiber: 1 }, description: 'Nets and small boats: fisheries make shores and rivers a steady food source.' },
  { id: 'weaving', name: 'Weaving', requires: ['cultivation'], cost: 130, materials: { fiber: 2 }, description: 'Looms turn fiber into cloth that keeps people warm and trades well.' },
  { id: 'irrigation', name: 'Irrigation', requires: ['cultivation', 'pottery'], cost: 210, materials: { stone: 2 }, description: 'Improve farm yields and make cultivated food less vulnerable to drought.' },
  { id: 'metallurgy', name: 'Metallurgy', requires: ['stonecraft', 'pottery'], cost: 260, materials: { ore: 2 }, description: 'Smelt finite ore with wood fuel, then turn metal into more effective tools.' },
  { id: 'medicine', name: 'Herbal medicine', requires: ['cultivation'], cost: 180, materials: { herbs: 1 }, description: 'Clinics and trained healers help sick neighbors recover.' },
  { id: 'writing', name: 'Writing', requires: ['forestry'], cost: 200, materials: { fiber: 1 }, description: 'Schools preserve learned techniques and allow apprenticeship across generations.' },
  { id: 'brickmaking', name: 'Brickmaking', requires: ['pottery'], cost: 170, materials: { clay: 3 }, description: 'Kilns fire clay into bricks, the material of lasting towns.' },
  { id: 'husbandry', name: 'Animal husbandry', requires: ['hunting', 'cultivation'], cost: 220, materials: { food: 3 }, description: 'Pastures turn grass that people cannot eat into food and hides.' },
  { id: 'masonry', name: 'Masonry', requires: ['stonecraft', 'brickmaking'], cost: 240, materials: { stone: 3, bricks: 2 }, description: 'Dressed stone and mortar: walls and temples that stand for generations.' },
  { id: 'commerce', name: 'Commerce', requires: ['writing', 'pottery'], cost: 260, materials: { goods: 2 }, description: 'Markets, measures and credit: more trade in more kinds of goods.' },
  { id: 'philosophy', name: 'Philosophy', requires: ['writing'], cost: 280, materials: {}, description: 'Libraries gather ideas; reasoned argument speeds learning and reflection.' },
  { id: 'engineering', name: 'Engineering', requires: ['metallurgy', 'writing', 'irrigation'], cost: 420, materials: { metal: 2 }, description: 'Combine mechanical knowledge, irrigation, and written designs to improve industrial output.' },
  { id: 'astronomy', name: 'Astronomy', requires: ['writing', 'cultivation'], cost: 300, materials: { gems: 1 }, description: 'Observatories keep a calendar of seasons: better-timed harvests that weather droughts.' },
  { id: 'governance', name: 'Governance', requires: ['writing', 'masonry'], cost: 340, materials: { bricks: 2, cloth: 1 }, description: 'Halls, laws and councils: large societies stay cohesive and can organize colonies.' },
  { id: 'navigation', name: 'Navigation', requires: ['fishing', 'engineering'], cost: 420, materials: { cloth: 3, wood: 4 }, description: 'Sails and docks: richer fishing grounds and far longer trade routes.' },
]);
export const BUILDINGS = Object.freeze({
  farm: { name: 'Farm', technology: 'cultivation', cost: { wood: 2, stone: 1 } },
  workshop: { name: 'Workshop', technology: 'stonecraft', cost: { wood: 3, stone: 2 } },
  lumbermill: { name: 'Lumbermill', technology: 'forestry', cost: { wood: 4, stone: 2 } },
  kiln: { name: 'Kiln', technology: 'pottery', cost: { wood: 3, stone: 4 } },
  granary: { name: 'Granary', technology: 'pottery', cost: { wood: 4, stone: 3 } },
  forge: { name: 'Forge', technology: 'metallurgy', cost: { wood: 4, stone: 5, ore: 2 } },
  school: { name: 'School', technology: 'writing', cost: { wood: 4, stone: 3 } },
  clinic: { name: 'Clinic', technology: 'medicine', cost: { wood: 3, stone: 2 } },
  fishery: { name: 'Fishery', technology: 'fishing', cost: { wood: 4, fiber: 2 } },
  loom: { name: 'Loom house', technology: 'weaving', cost: { wood: 3, stone: 1 } },
  apothecary: { name: 'Apothecary', technology: 'herbalism', cost: { wood: 3, clay: 2 } },
  pasture: { name: 'Pasture', technology: 'husbandry', cost: { wood: 3, fiber: 2 } },
  market: { name: 'Market', technology: 'commerce', cost: { wood: 3, stone: 2, bricks: 4 } },
  library: { name: 'Library', technology: 'philosophy', cost: { wood: 3, bricks: 5, cloth: 2 } },
  temple: { name: 'Temple', technology: 'masonry', cost: { stone: 6, bricks: 4, gems: 1 } },
  walls: { name: 'Walls', technology: 'masonry', cost: { stone: 8, bricks: 4 } },
  observatory: { name: 'Observatory', technology: 'astronomy', cost: { stone: 4, bricks: 3, gems: 1 } },
  hall: { name: 'Hall', technology: 'governance', cost: { wood: 4, bricks: 6, cloth: 2 } },
  dock: { name: 'Dock', technology: 'navigation', cost: { wood: 6, cloth: 3 } },
});
// How each raw material is gathered: the action, the skill it trains, and what it looks like.
const GATHERING = {
  wood: { action: 'lumber', skill: 'forestry', verb: 'cutting timber' }, stone: { action: 'quarry', skill: 'mining', verb: 'quarrying stone' },
  ore: { action: 'mine', skill: 'mining', verb: 'mining ore' }, clay: { action: 'dig', skill: 'mining', verb: 'digging clay' },
  fiber: { action: 'reap', skill: 'foraging', verb: 'gathering fiber' }, herbs: { action: 'herb', skill: 'medicine', verb: 'gathering herbs' },
  gems: { action: 'prospect', skill: 'mining', verb: 'searching for gems' },
};
const MATERIAL_OF = Object.fromEntries(Object.entries(GATHERING).map(([material, entry]) => [entry.action, material]));
const techById = new Map(TECHNOLOGIES.map(tech => [tech.id, tech]));
const stockKeys = ['stone', 'ore', 'tools', 'metal', 'goods', 'clay', 'fiber', 'herbs', 'gems', 'hides', 'bricks', 'cloth', 'remedies'];
const productionKeys = ['food', 'wood', ...stockKeys];
export const DIET = Object.freeze(['wild', 'crops', 'game', 'fish', 'herd']);
const TRADE_GOODS = { tools: 2, cloth: 2, remedies: 3, goods: 1.5, metal: 3, bricks: 1, hides: 1, gems: 5 };
const valueKeys = ['security', 'belonging', 'autonomy', 'mastery', 'care'];
const roleNames = { foraging: 'Forager', farming: 'Farmer', forestry: 'Forester', mining: 'Miner', crafting: 'Artisan', scholarship: 'Scholar', medicine: 'Healer', leadership: 'Organiser' };
const allowedRoles = new Set(['Apprentice', 'Generalist', ...Object.values(roleNames)]);
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const practiceIds = new Set(PRACTICES.map(technique => technique.id));
// The outcome of the action just executed, read back by the learning step.
let outcome = null;
/** A worker keeps part of what they produce as private wealth; returns the amount kept. */
function keep(agent, group, amount) { const kept = keptShare(group, amount); addWealth(agent, kept); return kept; }
const blank = keys => Object.fromEntries(keys.map(key => [key, 0]));

export function initializeCivilization(sim) {
  sim.civilization = { conversations: 0, ideasShared: 0, researchCompleted: 0, goodsProduced: 0, tradeVolume: 0, messages: [] };
}

export function initializeMind(sim, agent, parents = null) {
  const values = {};
  for (const key of valueKeys) values[key] = parents?.every(parent => parent.mind)
    ? clamp((parents[0].mind.values[key] + parents[1].mind.values[key]) / 2 + (sim._random() - .5) * .3)
    : .25 + sim._random() * .7;
  agent.skills = Object.fromEntries(SKILLS.map(skill => [skill, agent.age < 5 ? 0 : 2 + sim._random() * 10]));
  agent.knowledge = [];
  agent.mind = {
    values, ambition: .2 + sim._random() * .75, patience: .2 + sim._random() * .75,
    riskTolerance: .15 + sim._random() * .8,
    needs: { purpose: 30, stimulation: 35 }, beliefs: { abundance: .5, trust: .5, opportunity: .5 },
    goal: agent.age < 14 ? 'Grow and learn from family' : 'Build a secure life', role: agent.age < 14 ? 'Apprentice' : 'Generalist',
    intention: 'Find food, companions, and a place to belong.',
    policy: { action: 'observe', reason: 'Getting to know this place.', scores: [], since: sim.day },
    memories: [], plan: { goal: 'Build a secure life', steps: ['Find food', 'Meet nearby people'], until: sim.day }, lastTalkDay: -1,
  };
  return agent;
}

export function initializeSociety(group) {
  group.civilization = {
    technologies: [], research: {}, project: null, stock: blank(stockKeys),
    buildings: blank(Object.keys(BUILDINGS)), workforce: {}, production: blank(productionKeys), diet: blank(DIET), tradePartners: [], lastTradeDay: -1,
    neglect: {}, outbreakUntil: 0, immuneUntil: 0,
  };
  return group;
}

function remember(sim, agent, type, text) {
  const memories = agent.mind.memories;
  if (memories[0]?.text === text && sim.day - memories[0].day < 30) return;
  memories.unshift({ day: sim.day, type, text });
  if (memories.length > 8) memories.length = 8;
}

function experience(agent, skill, amount) {
  // Inherited talent changes how quickly practice turns into proficiency.
  const talent = agent.psyche?.talents[skill] ?? 1;
  agent.skills[skill] = clamp(agent.skills[skill] + amount * talent * (1 - agent.skills[skill] / 120), 0, 100);
  practise(agent, skill, amount);
}

function learn(sim, agent, id, source) {
  if (!techById.has(id) || agent.knowledge.includes(id)) return false;
  agent.knowledge.push(id);
  agent.mind.needs.stimulation = clamp(agent.mind.needs.stimulation - 14, 0, 100);
  agent.mind.needs.purpose = clamp(agent.mind.needs.purpose - 6, 0, 100);
  remember(sim, agent, 'learning', `Learned ${techById.get(id).name.toLowerCase()} ${source}.`);
  return true;
}

function adopt(sim, group, id, researcher = null, discovered = false) {
  const civilization = group.civilization, tech = techById.get(id);
  if (!tech || civilization.technologies.includes(id) || !tech.requires.every(key => civilization.technologies.includes(key))) return false;
  civilization.technologies.push(id);
  civilization.research[id] = tech.cost;
  const contributors = civilization.project?.technology === id ? civilization.project.contributors : [];
  for (const contributor of contributors) {
    const agent = sim._agentMap.get(contributor);
    if (agent) {
      learn(sim, agent, id, 'through shared experiments');
      if (discovered) appraise(sim, agent, 'discovery', { name: tech.name.toLowerCase(), activity: 'research' });
    }
  }
  if (researcher) learn(sim, researcher, id, discovered ? 'through experimentation' : 'from another community');
  if (civilization.project?.technology === id) civilization.project = null;
  if (discovered) sim.civilization.researchCompleted++;
  sim._event('technology', `${group.name} ${discovered ? 'develops' : 'adopts'} ${tech.name.toLowerCase()}. ${tech.description}`, { groupId: group.id, ...(researcher ? { agentId: researcher.id } : {}) });
  return true;
}

export const SURVEY_KEYS = Object.freeze(['food', 'wood', 'stone', 'ore', 'clay', 'fiber', 'herbs', 'game', 'fish', 'gems', 'fertility']);
/** What a society knows of the land around it: a survey retaken monthly or after a
 * move. It is part of the saved state, so restored worlds decide identically. */
export function surroundings(sim, group) {
  const civ = group.civilization, survey = civ.survey;
  if (survey && sim.day - survey.day < 30 && survey.x === group.x && survey.y === group.y) return survey.means;
  const means = Object.fromEntries(SURVEY_KEYS.map(key => [key, 0]));
  let land = 0;
  for (let dy = -12; dy <= 12; dy += 2) for (let dx = -12; dx <= 12; dx += 2) {
    const tile = sim._tile(group.x + dx, group.y + dy);
    if (tile.terrain === 'water') continue;
    land++;
    for (const resource of SURVEY_KEYS) means[resource] += tile[resource] || 0;
  }
  for (const resource of SURVEY_KEYS) means[resource] = Math.round(means[resource] / Math.max(1, land) * 1e4) / 1e4;
  civ.survey = { day: sim.day, x: group.x, y: group.y, means };
  return means;
}

/** Society-level answers shared by every member for the rest of the day. The cache
 * resets daily and saves happen between days, so restored worlds behave identically. */
function daily(sim, name, group, key, compute) {
  if (sim._daily?.day !== sim.day) sim._daily = { day: sim.day, maps: new Map() };
  let map = sim._daily.maps.get(name);
  if (!map) sim._daily.maps.set(name, map = new Map());
  const hit = map.get(group.id);
  if (hit && hit.key === key) return hit.value;
  const value = compute();
  map.set(group.id, { key, value });
  return value;
}
const builtCount = group => { let total = 0; for (const key in group.civilization.buildings) total += group.civilization.buildings[key]; return total; };

/** Stored amount of any material, whether kept as food, timber or society stock. */
export function have(group, key) { return key === 'food' ? group.food : key === 'wood' ? group.wood : group.civilization.stock[key] || 0; }
function affordable(group, cost) { return Object.entries(cost).every(([key, value]) => have(group, key) >= value); }
function spend(group, cost) {
  for (const [key, value] of Object.entries(cost)) {
    if (key === 'food') group.food -= value; else if (key === 'wood') group.wood -= value; else group.civilization.stock[key] -= value;
  }
}
/** Number of food sources beyond the first that each make up a meaningful share of recent meals. */
export function dietVariety(group) {
  const diet = group.civilization?.diet;
  if (!diet) return 0;
  const total = diet.wild + diet.crops + diet.game + diet.fish + diet.herd;
  if (total <= 1) return 0;
  let sources = 0;
  for (const source of DIET) if (diet[source] > total * .12) sources++;
  return Math.max(0, sources - 1);
}

/** Real effects of institutions a society has built. */
export function facilities(group) {
  const b = group.civilization.buildings;
  return {
    research: 1 + Math.min(2, b.library || 0) * .2, trade: 1 + Math.min(2, b.market || 0) * .3, fishing: (1 + Math.min(4, b.fishery || 0) * .3) * (b.dock ? 1.3 : 1),
    defense: 1 + Math.min(2, b.walls || 0) * .3, harvest: b.observatory ? 1.1 : 1, drought: b.observatory ? .15 : 0, cohesion: Math.min(2, (b.temple || 0) + (b.hall || 0)),
  };
}

function chooseProject(sim, group) {
  const civ = group.civilization;
  if (civ.project) return;
  // With nothing researchable, don't re-examine the whole tree for every member each day.
  const stamp = daily(sim, 'noProject', group, civ.technologies.length, () => ({ none: false }));
  if (stamp.none) return;
  const options = TECHNOLOGIES.filter(tech => !civ.technologies.includes(tech.id) && tech.requires.every(id => civ.technologies.includes(id)));
  if (!options.length) { stamp.none = true; return; }
  const people = group.members.map(id => sim._agentMap.get(id)).filter(Boolean);
  const mean = trait => people.reduce((sum, person) => sum + person.traits[trait], 0) / Math.max(1, people.length);
  const near = surroundings(sim, group), norms = civ.culture?.norms;
  // Societies pursue what their land offers, their problems demand, and their culture prizes.
  const scores = options.map(tech => {
    let score = 10 + sim._random() * 9 + (civ.research[tech.id] || 0) / tech.cost * 12;
    if (tech.id === 'cultivation') score += 9 + Math.max(0, 3 - group.food / Math.max(1, people.length)) * 5;
    if (tech.id === 'stonecraft') score += 10 + mean('curiosity') * 9;
    if (tech.id === 'forestry') score += group.wood < 3 ? 8 : 0;
    if (tech.id === 'medicine' || tech.id === 'herbalism') score += people.filter(agent => agent.health < 85).length * 3 + (sim.weather.plagueUntil > sim.day ? 12 : 0);
    if (tech.id === 'writing') score += mean('sociability') * 12;
    if (tech.id === 'hunting') score += near.game * 12;
    if (tech.id === 'fishing' || tech.id === 'navigation') score += near.fish * 40;
    if (tech.id === 'weaving') score += near.fiber * 10 + (sim.weather.winterUntil > sim.day ? 8 : 0);
    if (tech.id === 'brickmaking') score += near.clay * 14;
    if (tech.id === 'husbandry') score += near.fiber * 8 + near.game * 4;
    if (tech.id === 'commerce') score += civ.tradePartners.length * 4 + (norms?.mercantile || 0) * 10;
    if (tech.id === 'philosophy') score += mean('curiosity') * 6 + (norms?.innovation || 0) * 8;
    if (tech.id === 'astronomy') score += near.gems * 20 + (norms?.piety || 0) * 5;
    if (tech.id === 'governance') score += Math.max(0, people.length - 20) * .5 + (norms?.hierarchy || 0) * 8;
    if (tech.id === 'masonry') score += near.stone * 10 + (norms?.martial || 0) * 5;
    return { tech, score };
  }).sort((a, b) => b.score - a.score);
  const technology = scores[0].tech;
  civ.project = { technology: technology.id, progress: civ.research[technology.id] || 0, required: technology.cost, contributors: [] };
}

function setPolicy(sim, agent, action, reason, scores, steps) {
  const previous = agent.mind.policy.action;
  agent.mind.policy = { action, reason, scores: scores.slice(0, 5).map(option => ({ action: option.action, score: Math.round(option.score * 10) / 10 })), since: previous === action ? agent.mind.policy.since : sim.day };
  agent.mind.intention = reason;
  if (previous !== action || sim.day >= agent.mind.plan.until) {
    agent.mind.goal = ({ research: 'Understand and improve the world', invent: 'Develop and test a new design', reflect: 'Make sense of life together', study: 'Master a useful skill', teach: 'Pass knowledge to the next generation', farm: 'Create a dependable food supply', build: 'Give the community better tools', craft: 'Become a capable maker', smelt: 'Turn minerals into useful materials', lumber: 'Provision the settlement', quarry: 'Find materials for shared projects', mine: 'Find materials for shared projects', heal: 'Care for vulnerable neighbors', trade: 'Connect our community with others', survive: 'Secure food and rest', explore: 'Find new opportunities', socialize: 'Build lasting connections' })[action] || 'Build a secure life';
    agent.mind.plan = { goal: agent.mind.goal, steps: steps.slice(0, 4), until: sim.day + Math.round(5 + agent.mind.patience * 16) };
  }
}

function available(stock, group, material) { return have(group, material); }
/** The most pressing building this society can raise, by need, land and culture. */
function desiredBuilding(sim, group) {
  const civ = group.civilization, people = group.members.length, near = surroundings(sim, group), norms = civ.culture?.norms || {};
  const atWar = sim.diplomacy?.relations.some(relation => relation.status === 'war' && (relation.a === group.id || relation.b === group.id));
  const plague = sim.weather.plagueUntil > sim.day;
  const tier = civ.culture?.tier || 0;
  const plan = [
    ['farm', 100, Math.max(1, Math.ceil(people / 12))], ['workshop', 99, Math.max(1, Math.ceil(people / 25))],
    ['fishery', 97, near.fish > .05 ? Math.max(1, Math.ceil(people / 20)) : 0], ['pasture', 96, near.fiber > .15 ? Math.max(1, Math.ceil(people / 20)) : 0],
    ['lumbermill', 95, 1], ['kiln', 94, 1], ['granary', 93, 1], ['loom', 92, 1], ['school', 91, 1], ['forge', 90, 1],
    ['clinic', plague ? 101 : 89, 1], ['apothecary', plague ? 100 : 88, 1],
    ['market', 80 + (norms.mercantile || 0) * 12, 1 + (tier >= 2 ? 1 : 0)], ['library', 78 + (norms.innovation || 0) * 12, 1],
    ['temple', 76 + (norms.piety || 0) * 14, 1 + (tier >= 3 ? 1 : 0)], ['walls', atWar ? 98 : 70 + (norms.martial || 0) * 18, 1],
    ['hall', people > 30 ? 95 : 74 + (norms.hierarchy || 0) * 10, 1], ['observatory', 72, 1], ['dock', near.fish > .05 ? 75 : 0, near.fish > .05 ? 1 : 0],
  ];
  let best = null, priority = -Infinity;
  for (const [key, weight, target] of plan) {
    if (weight > priority && civ.technologies.includes(BUILDINGS[key].technology) && civ.buildings[key] < target && obtainable(group, BUILDINGS[key].cost, near)) { best = key; priority = weight; }
  }
  return best;
}

/** Whether every material could be had: in store, gatherable nearby, or producible here. */
function obtainable(group, cost, near) {
  const civ = group.civilization;
  return Object.entries(cost).every(([key, value]) => {
    // Timber, stone and ore were always sought further afield when scarce nearby.
    if (have(group, key) >= value || ['food', 'wood', 'stone', 'ore'].includes(key)) return true;
    if (GATHERING[key]) return (near[key] || 0) > (key === 'gems' ? .005 : .02);
    if (key === 'bricks') return civ.technologies.includes('brickmaking') && civ.buildings.kiln > 0 && near.clay > .02;
    if (key === 'cloth') return civ.buildings.loom > 0 && near.fiber > .02;
    if (key === 'metal') return civ.buildings.forge > 0 && near.ore > .02;
    if (key === 'goods') return civ.buildings.kiln > 0;
    return false;
  });
}

function localResource(sim, agent, key) {
  const radius = Math.round((key === 'ore' || key === 'gems' ? 20 : key === 'fish' ? 16 : 12) * (key === 'wood' || key === 'fish' || key === 'game' ? 1 : techniqueFactor(agent, 'prospect')));
  let best = null, highest = 0;
  for (let index = 0; index < 38; index++) {
    const x = clamp(Math.floor(agent.x) + Math.floor(sim._random() * (radius * 2 + 1)) - radius, 0, sim.width - 1);
    const y = clamp(Math.floor(agent.y) + Math.floor(sim._random() * (radius * 2 + 1)) - radius, 0, sim.height - 1);
    const tile = sim.tiles[y * sim.width + x];
    if (tile.terrain === 'water') continue;
    const score = (tile[key] || 0) / (1 + Math.hypot(x - agent.x, y - agent.y) * .12);
    if (score > highest) { highest = score; best = { x: x + .5, y: y + .5 }; }
  }
  const here = sim._tile(agent.x, agent.y);
  if ((here[key] || 0) > highest) { highest = here[key] || 0; best = { x: agent.x, y: agent.y }; }
  // With nothing worthwhile in sight, head for a remembered deposit (found
  // personally or described by someone) rather than wander.
  if (highest < .12) {
    const place = recallPlace(agent, key, key === 'ore' || key === 'gems' ? 45 : 30);
    if (place) best = { x: place.x, y: place.y };
  }
  return best;
}

function gatherMaterial(sim, agent, group, material) {
  const resource = material === 'wood' ? 'wood' : material;
  const target = localResource(sim, agent, resource);
  if (!target) { agent.action = `prospecting for ${material}`; sim._move(agent, sim._landNear(agent.x + (sim._random() - .5) * 30, agent.y + (sim._random() - .5) * 30)); return; }
  sim._move(agent, target);
  const tile = sim._tile(agent.x, agent.y), civ = group.civilization;
  const skill = GATHERING[material].skill;
  const mill = material === 'wood' && civ.buildings.lumbermill ? 1.5 : 1;
  const technique = material === 'wood' ? techniqueFactor(agent, 'timber') : ['stone', 'ore', 'clay', 'gems'].includes(material) ? techniqueFactor(agent, 'extract') : 1;
  // Gems are scarce and slow to find; everything else yields a day's load.
  const base = material === 'gems' ? .05 + agent.skills[skill] * .001 : .17 + agent.skills[skill] * .003;
  const amount = Math.min(tile[resource] || 0, base * mill * technique * (civ.stock.tools > 0 ? 1.15 : 1) * innovationEffects(sim, group).gathering);
  tile[resource] = Math.max(0, (tile[resource] || 0) - amount);
  revisitPlace(sim, agent, resource, tile[resource] || 0);
  if (amount > .05) rememberPlace(sim, agent, resource, Math.floor(agent.x) + .5, Math.floor(agent.y) + .5, tile[resource] || 0);
  // Walking to a deposit is not a failed harvest; only judge the work on arrival.
  outcome = amount > .01 ? clamp(amount * 4, .2, 1) : distance(agent, target) < .5 ? -.4 : null;
  if (material === 'wood') group.wood += amount;
  else civ.stock[material] += amount;
  civ.production[material] += amount;
  agent.action = amount > .01 ? GATHERING[material].verb : `prospecting for ${material}`;
  agent.energy = clamp(agent.energy - 3.5, 0, 100);
  experience(agent, skill, .35);
}

/** Hunting and fishing take real animals from tiles; stocks regrow logistically. */
function harvestAnimals(sim, agent, group, kind) {
  const target = localResource(sim, agent, kind);
  if (!target) { agent.action = kind === 'fish' ? 'looking for fishing grounds' : 'tracking game'; sim._move(agent, sim._landNear(agent.x + (sim._random() - .5) * 24, agent.y + (sim._random() - .5) * 24)); return; }
  sim._move(agent, target);
  const tile = sim._tile(agent.x, agent.y), civ = group.civilization, known = civ.technologies;
  const skill = .2 + agent.skills.foraging * .004;
  const boost = kind === 'game' ? (known.includes('hunting') ? 1.9 : 1) * (civ.stock.tools > 0 ? 1.15 : 1) : (known.includes('fishing') ? 1.7 : 1) * facilities(group).fishing;
  const taken = Math.min(tile[kind] || 0, skill * boost * .5);
  tile[kind] = Math.max(0, (tile[kind] || 0) - taken);
  revisitPlace(sim, agent, kind, tile[kind] || 0);
  if (taken > .05) rememberPlace(sim, agent, kind, Math.floor(agent.x) + .5, Math.floor(agent.y) + .5, tile[kind] || 0);
  const food = taken * (kind === 'game' ? 2.1 : 2) * innovationEffects(sim, group).food;
  group.food += food - keep(agent, group, food); civ.production.food += food; civ.diet[kind] += food;
  if (kind === 'game') { const hides = taken * .1; civ.stock.hides += hides; civ.production.hides += hides; }
  // Hunting large animals carries a small risk of injury.
  if (kind === 'game' && sim._random() < .01 * (1.2 - agent.mind.riskTolerance)) agent.health = clamp(agent.health - 6 - sim._random() * 8, 0, 100);
  outcome = taken > .01 ? clamp(food, .2, 1) : distance(agent, target) < .5 ? -.4 : null;
  agent.action = taken > .01 ? (kind === 'game' ? 'hunting' : 'fishing') : kind === 'game' ? 'tracking game' : 'looking for fishing grounds';
  agent.energy = clamp(agent.energy - (kind === 'game' ? 4 : 3), 0, 100);
  experience(agent, 'foraging', .3);
}

/** A scouting journey: head for distant land, note what is there, then choose the next horizon. */
function scout(sim, agent, group) {
  const target = { x: agent._wanderX, y: agent._wanderY };
  if (Math.hypot(target.x - group.x, target.y - group.y) < 14 || distance(agent, target) < 1.5) {
    if (distance(agent, target) < 1.5) {
      // Survey the surroundings and remember the best of each resource.
      let noted = 0;
      for (const kind of ['food', 'wood', 'stone', 'ore', 'fish', 'game', 'clay', 'gems']) {
        let best = null, value = 0;
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
          const tile = sim._tile(agent.x + dx, agent.y + dy);
          if (tile.terrain !== 'water' && (tile[kind] || 0) > value) { value = tile[kind]; best = { x: Math.floor(agent.x + dx) + .5, y: Math.floor(agent.y + dy) + .5 }; }
        }
        if (best && value > .4) { rememberPlace(sim, agent, kind, best.x, best.y, value); noted++; }
      }
      outcome = noted ? .5 : .05;
    }
    const angle = sim._random() * Math.PI * 2, range = 18 + sim._random() * 22;
    const next = sim._landNear(group.x + Math.cos(angle) * range, group.y + Math.sin(angle) * range);
    agent._wanderX = next.x; agent._wanderY = next.y;
  }
  sim._move(agent, { x: agent._wanderX, y: agent._wanderY }, 1.15);
  agent.action = 'scouting distant land';
  agent.energy = clamp(agent.energy - 2.5, 0, 100);
  experience(agent, 'leadership', .05); experience(agent, 'foraging', .1);
}

/** Pasture animals graze grass fiber that people cannot eat, giving food and hides. */
function herd(sim, agent, group) {
  const civ = group.civilization, radius = 6 + Math.min(4, civ.buildings.pasture) * 2;
  let wanted = (.3 + agent.skills.farming * .004) * Math.min(4, civ.buildings.pasture), grazed = 0;
  // Herds graze outward from the settlement, nearest pasture first.
  for (let ring = 0; ring <= radius && wanted > 1e-9; ring++) {
    for (let dy = -ring; dy <= ring && wanted > 1e-9; dy++) for (let dx = -ring; dx <= ring && wanted > 1e-9; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
      const tile = sim._tile(group.x + dx, group.y + dy);
      if (tile.terrain !== 'grass' && tile.terrain !== 'sand') continue;
      const bite = Math.min(tile.fiber, wanted * .25); tile.fiber -= bite; wanted -= bite; grazed += bite;
    }
  }
  const food = grazed * 2.2 * innovationEffects(sim, group).food, hides = grazed * .05;
  group.food += food - keep(agent, group, food); civ.production.food += food; civ.diet.herd += food;
  civ.stock.hides += hides; civ.production.hides += hides;
  agent.action = 'tending herds'; agent.energy = clamp(agent.energy - 2.6, 0, 100);
  experience(agent, 'farming', .3);
  outcome = food > .05 ? clamp(food, .2, 1) : -.4;
}

/** Called before basic behavior. Basic survival retains absolute priority. */
export function considerCivilization(sim, agent, group) {
  const mind = agent.mind || initializeMind(sim, agent).mind;
  const youngChildren = agent.children.some(id => { const child = sim._agentMap.get(id); return child && child.age < 12; });
  const sharedMeals = group && distance(agent, group) < 9 ? Math.min(2, group.food / Math.max(1, group.members.length)) : 0;
  const foodSecurity = agent.inventory.food + sharedMeals;
  if (agent.age < 10 || agent.hunger > 26 || agent.energy < 43 || agent.health < 45 || foodSecurity < (youngChildren ? 1.65 : .85)) {
    const reason = agent.age < 10 ? 'Stay near family and learn from daily life.' : agent.hunger > 26 || foodSecurity < (youngChildren ? 1.65 : .85) ? (youngChildren ? 'Keep enough food to support the children.' : 'Food security matters more than long-term work right now.') : agent.energy < 43 ? 'Energy is too low for demanding work; attend to everyday needs.' : 'Recover health before returning to work.';
    setPolicy(sim, agent, 'survive', reason, [{ action: 'survive', score: 110 }], ['Meet immediate needs', 'Return to longer-term plans']);
    clearReasoning(agent);
    return false;
  }
  if (!group) {
    setPolicy(sim, agent, 'basic', 'Build an independent life through everyday needs, local relationships, and exploration.', [{ action: 'basic', score: 60 }], ['Meet daily needs', 'Find companions', 'Explore nearby resources']);
    clearReasoning(agent);
    return false;
  }
  const civ = group.civilization || initializeSociety(group).civilization;
  chooseProject(sim, group);
  const choices = [], stock = civ.stock, effects = innovationEffects(sim, group);
  const building = daily(sim, 'building', group, builtCount(group) * 64 + civ.technologies.length, () => desiredBuilding(sim, group));
  const near = surroundings(sim, group), members = group.members.length, known = civ.technologies;
  // Raw materials in short supply for anything the society is working toward.
  const shortfalls = new Map();
  const want = (cost, score, reason) => {
    for (const [key, value] of Object.entries(cost)) {
      if (!GATHERING[key] || have(group, key) >= value) continue;
      if ((shortfalls.get(key)?.score ?? -Infinity) < score) shortfalls.set(key, { score, reason });
    }
  };
  const nearHome = distance(agent, group) < 9;
  const add = (action, score, reason, steps, target = null) => {
    if (agent.mind.policy.action === action && sim.day < agent.mind.plan.until) score += 5 * mind.patience;
    choices.push({ action, score: score + sim._random() * 8, reason, steps, target });
  };
  add('basic', 20 + (100 - agent.social) * (.2 + mind.values.belonging * .18) + mind.values.autonomy * (7 + (1 - mind.beliefs.abundance) * 8), 'Make time for relationships, exploration, and everyday life.', ['Follow personal needs']);
  if (agent.age < 16) add('study', 48 + mind.values.mastery * 20, 'Learn useful techniques from experienced community members.', ['Find a mentor', 'Practice a useful skill']);
  const project = civ.project, projectTech = project && techById.get(project.technology);
  const awaiting = project && project.progress >= project.required && !affordable(group, projectTech.materials);
  if (awaiting) {
    if (!obtainable(group, projectTech.materials, near)) civ.project = null;
    else want(projectTech.materials, 45, `Demonstrating ${projectTech.name.toLowerCase()} needs real materials.`);
  }
  if (civ.project && !awaiting && agent.age >= 14) add('research', 20 + mind.values.mastery * 21 + agent.traits.curiosity * 15 + agent.skills.scholarship * .2 + mind.needs.stimulation * .15 + mind.ambition * 7 + mind.beliefs.opportunity * 4, `Help investigate ${techById.get(civ.project.technology).name.toLowerCase()} with the community.`, ['Join the shared investigation', 'Experiment and compare ideas', 'Share a working technique']);
  if (agent.age >= 14) {
    const experiment = civ.experiment;
    const trialCost = experiment?.hypothesis.cost;
    const ready = !trialCost || Object.entries(trialCost).every(([key, value]) => (key === 'food' ? group.food : available(stock, group, key)) >= value);
    if (ready) add('invent', (civ.project ? 17 : 23) + mind.values.mastery * 17 + agent.traits.curiosity * 16 + agent.skills.scholarship * .12 + mind.needs.stimulation * .15 + mind.riskTolerance * 6 + (experiment ? 8 * experiment.progress / experiment.required : 0), experiment ? `Test the community’s proposed ${experiment.hypothesis.name.toLowerCase()}.` : 'Combine available materials and existing ideas into an untested design.', ['Propose a design', 'Contribute labor and materials', 'Test, revise, and share the result']);
    else {
      if (group.wood < trialCost.wood) add('lumber', 48 + agent.skills.forestry * .12, 'The experiment needs timber for a real trial.', ['Gather timber', 'Supply the experiment']);
      if (stock.stone < trialCost.stone) add('quarry', 48 + agent.skills.mining * .12, 'The experiment needs stone for a real trial.', ['Find stone', 'Supply the experiment']);
      if (stock.ore < trialCost.ore) add('mine', 47 + agent.skills.mining * .12, 'The experiment needs ore for a real trial.', ['Find ore', 'Supply the experiment']);
    }
    add('reflect', 16 + mind.values.belonging * 13 + mind.values.care * 8 + agent.traits.sociability * 9 + mind.needs.purpose * .2 + effects.spirituality * 4, 'Discuss a shared practice and what the community ought to value.', ['Reflect on recent experiences', 'Discuss a shared belief', 'Build or question conviction']);
  }
  if (building && agent.age >= 14) {
    const cost = BUILDINGS[building].cost;
    if (Object.entries(cost).every(([key, value]) => available(stock, group, key) >= value)) add('build', 49 + mind.values.care * 15 + agent.skills.crafting * .12, `Use shared materials to build a ${BUILDINGS[building].name.toLowerCase()}.`, ['Gather at the settlement', 'Contribute the materials', 'Build shared infrastructure'], building);
    else {
      if (group.wood < (cost.wood || 0)) add('lumber', 43 + agent.skills.forestry * .14 + mind.values.care * 12, 'The shared building project needs timber.', ['Find woodland', 'Gather timber for the settlement']);
      if (stock.stone < (cost.stone || 0)) add('quarry', 42 + agent.skills.mining * .14 + mind.riskTolerance * 8, 'The shared building project needs stone.', ['Locate stone', 'Collect material for construction']);
      if (stock.ore < (cost.ore || 0)) add('mine', 41 + agent.skills.mining * .14 + mind.riskTolerance * 8, 'A forge needs ore for its first experiments.', ['Locate an ore deposit', 'Gather ore for the forge']);
      want(Object.fromEntries(Object.entries(cost).filter(([key]) => !['wood', 'stone', 'ore'].includes(key))), 42 + mind.values.care * 10, `The ${BUILDINGS[building].name.toLowerCase()} needs materials from the land.`);
    }
  }
  // Processed materials: bricks from the kiln, cloth from the loom, remedies from the apothecary.
  const buildingNeed = key => building ? Math.max(0, (BUILDINGS[building].cost[key] || 0) - stock[key]) : 0;
  const projectNeed = key => awaiting ? Math.max(0, (projectTech.materials[key] || 0) - stock[key]) : 0;
  if (agent.age >= 14 && civ.buildings.kiln && known.includes('brickmaking') && stock.bricks < Math.max(3, buildingNeed('bricks') + projectNeed('bricks') + 1)) {
    const urgent = buildingNeed('bricks') + projectNeed('bricks') > 0;
    if (stock.clay >= .4 && group.wood >= .3) add('bricks', (urgent ? 44 : 30) + agent.skills.crafting * .2 + mind.values.care * 8, 'Fire bricks for lasting buildings.', ['Reach the kiln', 'Shape and fire clay bricks']);
    else want(stock.clay < .4 ? { clay: .4 } : { wood: .3 }, urgent ? 43 : 29, 'The kiln needs clay and fuel for bricks.');
  }
  const winter = sim.weather.winterUntil > sim.day, plague = sim.weather.plagueUntil > sim.day;
  if (agent.age >= 14 && civ.buildings.loom && stock.cloth < Math.max(2, members * (winter ? .4 : .2), buildingNeed('cloth') + projectNeed('cloth'))) {
    if (stock.fiber >= .4) add('weave', (winter ? 46 : 32) + agent.skills.crafting * .2 + mind.values.care * 6, winter ? 'Cloth keeps people alive through the cold.' : 'Weave cloth for clothing, sails and trade.', ['Reach the loom', 'Spin and weave fiber']);
    else want({ fiber: .4 }, winter ? 45 : 31, 'The loom needs fiber.');
  }
  if (agent.age >= 14 && civ.buildings.apothecary && stock.remedies < Math.max(2, members * (plague ? .35 : .1))) {
    if (stock.herbs >= .3) add('remedy', (plague ? 52 : 31) + agent.skills.medicine * .25 + mind.values.care * 10, plague ? 'Remedies are needed against the plague.' : 'Prepare remedies for the sick.', ['Reach the apothecary', 'Prepare herbal remedies']);
    else want({ herbs: .3 }, plague ? 50 : 30, 'The apothecary needs fresh herbs.');
  }
  if (agent.age >= 14 && !civ.buildings.kiln && known.includes('pottery') && stock.clay < 2 && near.clay > .02) want({ clay: 2 }, 26, 'Clay will be needed for pottery.');
  for (const [material, { score, reason }] of shortfalls) {
    const { action, skill } = GATHERING[material];
    add(action, score + agent.skills[skill] * .14 + (material === 'gems' ? mind.riskTolerance * 6 : 0), reason, [`Find ${material}`, 'Bring it to the settlement'], material);
  }
  // A finite number of plots can be tended each day; otherwise farming crowds
  // every other occupation out of the policy even when there are surplus workers.
  if (sim._civilAssignments?.day !== sim.day) sim._civilAssignments = { day: sim.day, farms: new Map() };
  const farmWorkers = sim._civilAssignments.farms.get(group.id) || 0;
  if (civ.buildings.farm && farmWorkers < civ.buildings.farm * 4 && group.food < group.members.length * 2 && agent.age >= 12) add('farm', 27 + Math.max(0, 1.5 - group.food / Math.max(1, group.members.length)) * 14 + mind.values.security * 12 + agent.skills.farming * .22, 'A more dependable harvest will keep the community fed.', ['Reach the farms', 'Tend and harvest crops', 'Share the harvest']);
  // Food beyond farms: hunting and fishing draw on living stocks; herds graze inedible grass.
  if (agent.age >= 14 && group.food < members * 2) {
    const foodNeed = Math.max(0, 1.5 - group.food / Math.max(1, members)) * 14;
    const assigned = sim._civilAssignments.farms.get(`hunt:${group.id}`) || 0;
    if (near.game > .08 && assigned < 2 + members / 6) add('hunt', 4 + near.game * 20 + foodNeed + agent.skills.foraging * .08 + mind.riskTolerance * 8 + mind.values.security * 6 + (known.includes('hunting') ? 6 : 0), 'Hunt game to feed the community.', ['Track game', 'Bring back meat and hides']);
    if (near.fish > .02) add('fish', 6 + Math.min(.4, near.fish) * 35 + foodNeed + agent.skills.foraging * .08 + mind.patience * 6 + (known.includes('fishing') ? 8 : 0) + (civ.buildings.fishery ? 8 : 0), 'Fish the nearby waters.', ['Reach the fishing grounds', 'Bring back the catch']);
    if (civ.buildings.pasture) add('herd', 30 + foodNeed + agent.skills.farming * .2 + mind.values.security * 8, 'Tend the herds on the pasture.', ['Drive animals to grass', 'Bring back milk, meat and hides']);
  }
  if (civ.buildings.workshop && stock.tools < Math.max(4, group.members.length * .25)) {
    const toolNeed = 1 - stock.tools / Math.max(4, group.members.length * .25);
    if (group.wood >= .3 && (stock.stone >= .4 || stock.metal >= .2)) add('craft', 43 + toolNeed * 18 + agent.skills.crafting * .3 + mind.values.mastery * 12, 'Useful tools make everyone’s work more productive.', ['Bring materials to the workshop', 'Make and share tools']);
    else if (group.wood < 1) add('lumber', 46 + agent.skills.forestry * .1, 'The workshop needs wood for tool handles.', ['Find woodland', 'Supply timber']);
    else add('quarry', 44 + agent.skills.mining * .1, 'The workshop needs stone for new tools.', ['Find stone', 'Supply the workshop']);
  }
  if (civ.buildings.kiln && stock.goods < 12) {
    if (group.wood >= .25 && (stock.clay >= .2 || stock.stone >= .2)) add('pottery', 30 + agent.skills.crafting * .2 + mind.ambition * 10, 'Make durable household goods for the community.', ['Reach the kiln', 'Fire clay and stone-rich earth'], 'goods');
    else if (stock.stone < .2) add('quarry', 31 + agent.skills.mining * .12, 'The kiln needs fresh stone-rich earth.', ['Locate useful earth and stone', 'Supply the kiln']);
    else add('lumber', 31 + agent.skills.forestry * .12, 'The kiln needs wood fuel.', ['Collect wood fuel', 'Supply the kiln']);
  }
  if (civ.buildings.forge && stock.metal < 8) {
    if (stock.ore >= .35 && group.wood >= .45) add('smelt', 39 + agent.skills.crafting * .22 + mind.values.mastery * 12, 'Turn ore and fuel into useful metal.', ['Reach the forge', 'Smelt ore with wood fuel']);
    else if (stock.ore < .35) add('mine', 38 + agent.skills.mining * .2, 'The forge has run short of ore.', ['Seek an ore deposit', 'Supply the forge']);
    else add('lumber', 38 + agent.skills.forestry * .2, 'The forge needs wood fuel.', ['Collect fuel wood', 'Supply the forge']);
  }
  // People with a strong pioneering drive scout distant land; what they find guides colonies.
  const drive = agent.psyche?.expansion ?? 0;
  if (agent.age >= 16 && agent.age < 55 && drive > .5) add('pioneer', 6 + drive * 30 + (civ.culture?.pressure || 0) * 20, 'Scout distant land where our people could settle.', ['Travel beyond our lands', 'Remember good sites', 'Report back'], null);
  const neighbors = sim._neighbors(agent, 7);
  const student = neighbors.find(other => other.age >= 5 && (agent.knowledge.some(id => !other.knowledge.includes(id)) || (agent.ideas || []).some(id => !knowsIdea(other, id)) || SKILLS.some(skill => agent.skills[skill] - other.skills[skill] > 15)));
  if (student) add('teach', 26 + mind.values.care * 18 + agent.traits.sociability * 10 + mind.needs.purpose * .15, `Help ${student.name} learn a useful skill.`, ['Find a willing learner', 'Share an idea', 'Practice together'], student.id);
  if (civ.buildings.school && (civ.technologies.some(id => !agent.knowledge.includes(id)) || agent.skills.scholarship < 30)) add('study', 30 + mind.values.mastery * 16 + mind.needs.stimulation * .18, 'Study the community’s accumulated knowledge.', ['Visit the school', 'Study a shared technique', 'Practice it']);
  const patient = civ.technologies.includes('medicine') ? neighbors.filter(other => other.health < 80).sort((a, b) => a.health - b.health)[0] : null;
  if (patient) add('heal', 45 + (100 - patient.health) * .4 + mind.values.care * 15, `${patient.name} needs care and practical medical knowledge.`, ['Reach the patient', 'Provide care and food'], patient.id);
  const neighborGroup = daily(sim, 'partner', group, civ.lastTradeDay, () => sim.groups.find(other => other.id !== group.id && other.civilization && tradeAccess(sim, group, other) && exchangePair(group, other)) || null);
  const pair = neighborGroup && exchangePair(group, neighborGroup);
  if (pair && sim.day - civ.lastTradeDay >= Math.max(1, 12 / (effects.trade * techniqueFactor(agent, 'trade') * facilities(group).trade)) && agent.age >= 16) {
    const { seller, buyer, item } = pair;
    const foodNeed = clamp(1 - seller.food / Math.max(1, seller.members.length * 2));
    const goodNeed = clamp(1 - buyer.civilization.stock[item] / tradeTarget(buyer, item));
    add('trade', 46 + (foodNeed + goodNeed) * 8 + mind.ambition * 15 + agent.skills.leadership * .15, `Exchange ${item} for food with ${neighborGroup.name} to meet complementary needs.`, ['Visit the neighboring settlement', `Exchange ${item} and food`, 'Share useful knowledge'], neighborGroup.id);
  }
  // Personality, mood, memories, learned expectations and life goals reweigh
  // each option; the breakdown is kept so observers can see why.
  deliberate(sim, agent, choices);
  choices.sort((a, b) => b.score - a.score);
  const choice = choices[0];
  recordReasoning(sim, agent, choices);
  setPolicy(sim, agent, choice.action, choice.reason, choices, choice.steps);
  if (choice.action === 'basic') return false;
  if (['research', 'invent', 'reflect', 'study', 'build', 'farm', 'craft', 'pottery', 'smelt', 'bricks', 'weave', 'remedy', 'herd'].includes(choice.action) && !nearHome) {
    sim._move(agent, group); agent.action = `heading to ${choice.action === 'research' ? 'shared research' : 'work'}`;
    return true;
  }
  outcome = null;
  const handled = execute(sim, agent, group, choice);
  if (outcome !== null) reinforce(sim, agent, choice.action, outcome);
  if (handled === false) return false;
  if (choice.action === 'farm') sim._civilAssignments.farms.set(group.id, farmWorkers + 1);
  if (choice.action === 'hunt') sim._civilAssignments.farms.set(`hunt:${group.id}`, (sim._civilAssignments.farms.get(`hunt:${group.id}`) || 0) + 1);
  mind.needs.purpose = clamp(mind.needs.purpose - 1.6, 0, 100);
  mind.needs.stimulation = clamp(mind.needs.stimulation - (['research', 'invent', 'reflect', 'study', 'teach'].includes(choice.action) ? 3 : .5), 0, 100);
  return true;
}


export function harvestSoil(sim, group, wanted, efficiency = 1) {
  const farms = group.civilization.buildings.farm;
  if (!farms || wanted <= 0) return 0;
  const radius = Math.min(12, 3 + Math.ceil(Math.sqrt(farms) * 2));
  const key = `${Math.floor(group.x)}:${Math.floor(group.y)}:${radius}`;
  if (!sim._farmPlots) sim._farmPlots = new Map();
  let cached = sim._farmPlots.get(group.id);
  if (cached?.key !== key) {
    const plots = [];
    for (let y = Math.max(0, Math.floor(group.y) - radius); y <= Math.min(sim.height - 1, Math.floor(group.y) + radius); y++) {
      for (let x = Math.max(0, Math.floor(group.x) - radius); x <= Math.min(sim.width - 1, Math.floor(group.x) + radius); x++) {
        const index = y * sim.width + x, tile = sim.tiles[index];
        if (tile.terrain !== 'water' && tile.terrain !== 'mountain') plots.push(index);
      }
    }
    cached = { key, plots }; sim._farmPlots.set(group.id, cached);
  }
  let needed = wanted / (2 * efficiency), consumed = 0;
  const offset = Math.floor(sim._random() * cached.plots.length);
  for (let i = 0; i < cached.plots.length && needed > 1e-12; i++) {
    const tile = sim.tiles[cached.plots[(i + offset) % cached.plots.length]];
    const soil = tile.soil ?? tile.fertility;
    const used = Math.min(soil, needed); tile.soil = Math.max(0, soil - used);
    consumed += used; needed -= used;
  }
  return consumed * 2 * efficiency;
}

function execute(sim, agent, group, choice) {
  const civ = group.civilization, stock = civ.stock, effects = innovationEffects(sim, group);
  const engineering = civ.technologies.includes('engineering') ? 1.35 : 1;
  switch (choice.action) {
    case 'invent': {
      const { successes, failures } = sim.innovation;
      const worked = attemptInnovation(sim, agent, group);
      if (worked) experience(agent, 'scholarship', .3 * effects.learning);
      outcome = sim.innovation.successes > successes ? 1 : sim.innovation.failures > failures ? -.6 : worked ? .1 : -.2;
      return worked;
    }
    case 'reflect': {
      const known = sim.innovation.discoveries.length;
      const worked = reflectBelief(sim, agent, group);
      if (worked) experience(agent, 'leadership', .18);
      outcome = sim.innovation.discoveries.length > known ? .6 : worked ? .2 : null;
      return worked;
    }
    case 'research': {
      const project = civ.project;
      if (!project) break;
      const activePeers = group.members.filter(id => { const peer = sim._agentMap.get(id); return peer && peer.id !== agent.id && peer.mind.policy.action === 'research' && distance(agent, peer) < 8; }).length;
      const cooperation = 1 + Math.min(4, activePeers) * .08 * sim.config.cooperation;
      // Larger, better-connected populations sustain faster innovation (the collective brain).
      const minds = 1 + .12 * Math.log1p(group.members.length / 5) + .04 * Math.min(5, civ.tradePartners.length);
      const effort = (.14 + agent.skills.scholarship * .006) * cooperation * (civ.buildings.school ? 1.3 : 1) * effects.learning * (.8 + effects.solidarity * .4) * techniqueFactor(agent, 'research') * facilities(group).research * minds;
      project.progress = Math.min(project.required, project.progress + effort);
      civ.research[project.technology] = project.progress;
      if (!project.contributors.includes(agent.id)) project.contributors.push(agent.id);
      agent.action = `researching ${techById.get(project.technology).name.toLowerCase()}`;
      experience(agent, 'scholarship', .3); agent.energy = clamp(agent.energy - 2.5, 0, 100);
      outcome = .15;
      if (project.progress >= project.required) {
        // The finished idea still needs a working demonstration with real materials.
        const materials = techById.get(project.technology).materials;
        if (affordable(group, materials)) { spend(group, materials); adopt(sim, group, project.technology, agent, true); outcome = 1; }
        else agent.action = `awaiting materials for ${techById.get(project.technology).name.toLowerCase()}`;
      }
      break;
    }
    case 'lumber': case 'quarry': case 'mine': case 'dig': case 'reap': case 'herb': case 'prospect': gatherMaterial(sim, agent, group, MATERIAL_OF[choice.action]); break;
    case 'hunt': harvestAnimals(sim, agent, group, 'game'); break;
    case 'pioneer': scout(sim, agent, group); break;
    case 'fish': harvestAnimals(sim, agent, group, 'fish'); break;
    case 'herd': herd(sim, agent, group); break;
    case 'bricks': {
      if (stock.clay < .4 || group.wood < .3) break;
      stock.clay -= .4; group.wood -= .3;
      const output = (.45 + agent.skills.crafting * .005) * engineering * effects.crafting;
      stock.bricks += output - keep(agent, group, output); civ.production.bricks += output; sim.civilization.goodsProduced += output;
      agent.action = 'firing bricks'; experience(agent, 'crafting', .35); agent.energy = clamp(agent.energy - 3.5, 0, 100); outcome = .45;
      break;
    }
    case 'weave': {
      if (stock.fiber < .4) break;
      stock.fiber -= .4;
      const output = (.3 + agent.skills.crafting * .004) * effects.crafting;
      stock.cloth += output - keep(agent, group, output); civ.production.cloth += output; sim.civilization.goodsProduced += output;
      agent.action = 'weaving cloth'; experience(agent, 'crafting', .3); agent.energy = clamp(agent.energy - 2.2, 0, 100); outcome = .4;
      break;
    }
    case 'remedy': {
      if (stock.herbs < .3) break;
      stock.herbs -= .3;
      const output = (.3 + agent.skills.medicine * .004) * effects.healing;
      stock.remedies += output - keep(agent, group, output); civ.production.remedies += output;
      agent.action = 'preparing remedies'; experience(agent, 'medicine', .35); agent.energy = clamp(agent.energy - 2, 0, 100); outcome = .45;
      break;
    }
    case 'build': {
      const building = BUILDINGS[choice.target];
      // Joinery lets a skilled builder raise the same structure with less timber.
      const cost = Object.fromEntries(Object.entries(building?.cost || {}).map(([key, value]) => [key, key === 'wood' ? value * techniqueFactor(agent, 'buildWood') : value]));
      if (!building || !Object.entries(cost).every(([key, value]) => available(stock, group, key) >= value)) break;
      for (const [key, amount] of Object.entries(cost)) { if (key === 'wood') group.wood -= amount; else stock[key] -= amount; }
      civ.buildings[choice.target]++;
      if (agent.psyche) agent.psyche.record.built++;
      outcome = .8;
      agent.action = `building a ${building.name.toLowerCase()}`;
      experience(agent, 'crafting', 2); experience(agent, 'leadership', .8);
      agent.energy = clamp(agent.energy - 10, 0, 100);
      remember(sim, agent, 'work', `Helped build a ${building.name.toLowerCase()} in ${group.name}.`);
      sim._event('industry', `${agent.name} builds a ${building.name.toLowerCase()} for ${group.name}.`, { agentId: agent.id, groupId: group.id });
      break;
    }
    case 'farm': {
      const fertility = sim._tile(group.x, group.y).fertility ?? .6;
      const drought = sim.weather.droughtUntil > sim.day;
      const irrigation = civ.technologies.includes('irrigation');
      const weather = drought ? Math.min(1, (irrigation ? .8 : .3) + facilities(group).drought) : 1;
      const efficiency = effects.food * (irrigation ? 1.4 : 1) * engineering * techniqueFactor(agent, 'soil') * facilities(group).harvest;
      const wanted = (.35 + agent.skills.farming * .01) * (.5 + fertility) * weather * efficiency * techniqueFactor(agent, 'farm');
      const output = harvestSoil(sim, group, Math.min(wanted, Math.max(0, group.members.length * 4 + 30 - group.food)), efficiency);
      group.food += output - keep(agent, group, output); civ.diet.crops += output;
      if (agent.psyche) agent.psyche.record.provided = Math.round((agent.psyche.record.provided + output) * 1e4) / 1e4;
      outcome = output > .05 ? clamp(output * 1.2, .1, 1) : -.5;
      civ.production.food += output;
      const personal = Math.min(.25, group.food, 5 - agent.inventory.food);
      group.food -= personal; agent.inventory.food += personal;
      experience(agent, 'farming', .4); agent.energy = clamp(agent.energy - 3.1, 0, 100); agent.action = 'tending the fields';
      break;
    }
    case 'craft': {
      const metal = stock.metal >= .2;
      if (group.wood < .3 || (!metal && stock.stone < .4)) break;
      group.wood -= .3;
      if (metal) stock.metal -= .2; else stock.stone -= .4;
      const output = (.4 + agent.skills.crafting * .008) * (metal ? 1.5 : 1) * engineering * effects.crafting * techniqueFactor(agent, 'tools');
      stock.tools += output - keep(agent, group, output); outcome = .5; civ.production.tools += output; sim.civilization.goodsProduced += output;
      agent.action = metal ? 'making metal tools' : 'making stone tools'; experience(agent, 'crafting', .4); agent.energy = clamp(agent.energy - 3.5, 0, 100);
      break;
    }
    case 'pottery': {
      if (group.wood < .25 || (stock.clay < .2 && stock.stone < .2)) break;
      group.wood -= .25;
      if (stock.clay >= .2) stock.clay -= .2; else stock.stone -= .2;
      const output = (.35 + agent.skills.crafting * .006) * engineering * effects.crafting;
      stock.goods += output - keep(agent, group, output); civ.production.goods += output; outcome = .4; sim.civilization.goodsProduced += output;
      agent.action = 'firing pottery'; experience(agent, 'crafting', .3); agent.energy = clamp(agent.energy - 3, 0, 100);
      break;
    }
    case 'smelt': {
      if (stock.ore < .35 || group.wood < .45) break;
      stock.ore -= .35; group.wood -= .45;
      const output = (.25 + agent.skills.crafting * .003) * engineering * effects.crafting * techniqueFactor(agent, 'metal');
      stock.metal += output - keep(agent, group, output); outcome = .5; civ.production.metal += output; sim.civilization.goodsProduced += output;
      agent.action = 'smelting ore'; experience(agent, 'crafting', .45); agent.energy = clamp(agent.energy - 4, 0, 100);
      break;
    }
    case 'study': {
      // Seek out someone known to be good at what this person wants to master;
      // otherwise learn from the most scholarly neighbour.
      const aspiration = agent.psyche?.aspiration;
      const expert = aspiration?.kind === 'mastery' ? knownExpert(sim, agent, aspiration.skill) : null;
      if (expert && distance(agent, expert) > 3) sim._move(agent, expert, .9);
      const teachers = group.members.map(id => sim._agentMap.get(id)).filter(other => other && other.id !== agent.id && distance(agent, other) < 10);
      const teacher = expert && distance(agent, expert) < 10 ? expert : teachers.sort((a, b) => b.skills.scholarship - a.skills.scholarship)[0];
      const heard = sim.civilization.messages[0];
      if (teacher && communicate(sim, teacher, agent, true)) outcome = sim.civilization.messages[0] !== heard && sim.civilization.messages[0].kind !== 'social' ? .6 : .1;
      if (civ.buildings.school) {
        const unknown = civ.technologies.find(id => !agent.knowledge.includes(id));
        if (unknown && sim._random() < (.12 + agent.skills.scholarship * .002) * facilities(group).research) { learn(sim, agent, unknown, 'at the community school'); outcome = .7; }
        experience(agent, 'scholarship', .3);
      }
      agent.action = teacher ? 'learning from a mentor' : civ.buildings.school ? 'studying written knowledge' : 'practicing useful skills';
      if (!teacher && !civ.buildings.school) experience(agent, 'foraging', .08);
      agent.energy = clamp(agent.energy - 1.5, 0, 100);
      break;
    }
    case 'teach': {
      const student = sim._agentMap.get(choice.target);
      if (!student) break;
      sim._move(agent, student, .65);
      if (distance(agent, student) < 3 && communicate(sim, agent, student, true)) outcome = sim.civilization.messages[0].kind === 'social' ? -.1 : .6;
      agent.action = 'teaching a neighbor'; experience(agent, 'leadership', .25); agent.energy = clamp(agent.energy - 1.3, 0, 100);
      break;
    }
    case 'heal': {
      const patient = sim._agentMap.get(choice.target);
      if (!patient) break;
      sim._move(agent, patient, .8);
      if (distance(agent, patient) < 3 && agent.inventory.food >= .1) {
        agent.inventory.food -= .1;
        const before = patient.health;
        // Prepared remedies make care markedly more effective while they last.
        const remedy = stock.remedies >= .05 ? 1.5 : 1;
        if (remedy > 1) stock.remedies -= .05;
        patient.health = clamp(patient.health + (.7 + agent.skills.medicine * .025 + (civ.buildings.clinic ? .6 : 0)) * effects.healing * techniqueFactor(agent, 'heal') * remedy, 0, 100);
        if (agent.psyche) agent.psyche.record.healed = Math.round((agent.psyche.record.healed + patient.health - before) * 1e4) / 1e4;
        if (patient.health > before) { appreciate(patient, agent); outcome = .5; }
        experience(agent, 'medicine', .5); agent.social = clamp(agent.social + 2, 0, 100);
      }
      agent.action = 'caring for a neighbor'; agent.energy = clamp(agent.energy - 2.3, 0, 100);
      break;
    }
    case 'trade': trade(sim, agent, group, sim._groupMap.get(choice.target)); break;
  }
}

/** How much of a good a society wants on hand before it will buy or sell. */
function tradeTarget(group, item) {
  const n = group.members.length;
  return { tools: Math.max(2, n * .12), cloth: Math.max(1, n * .15), remedies: Math.max(1, n * .08), goods: Math.max(2, n * .2), metal: 2, bricks: 3, hides: Math.max(1, n * .08), gems: 1 }[item];
}

function exchangePair(first, second) {
  // A buyer must actually need the good and have surplus food to pay; the seller
  // must hold a surplus and want food. This prevents meaningless back-and-forth
  // trades and unlimited stock accumulation.
  for (const item of Object.keys(TRADE_GOODS)) {
    for (const [seller, buyer] of [[first, second], [second, first]]) {
      const price = TRADE_GOODS[item];
      if (seller.civilization.stock[item] >= tradeTarget(seller, item) + 1 && buyer.civilization.stock[item] < tradeTarget(buyer, item)
        && buyer.food > Math.max(2, buyer.members.length) + price && seller.food < seller.members.length * 2) return { seller, buyer, item, price };
    }
  }
  return null;
}

function trade(sim, agent, home, destination) {
  if (!destination || !tradeAccess(sim, home, destination)) return;
  const logistics = innovationEffects(sim, home).trade * techniqueFactor(agent, 'trade') * facilities(home).trade;
  sim._move(agent, destination, 1.2 * Math.sqrt(logistics));
  agent.action = `visiting ${destination.name}`;
  if (distance(agent, destination) > 5 || sim.day - home.civilization.lastTradeDay < Math.max(1, 12 / logistics)) return;
  const homeCiv = home.civilization, awayCiv = destination.civilization;
  // A market on either side lets a visit settle a second exchange.
  const rounds = home.civilization.buildings.market || destination.civilization.buildings.market ? 2 : 1;
  const traded = [];
  let volume = 0;
  for (let round = 0; round < rounds; round++) {
    const exchange = exchangePair(home, destination);
    if (!exchange) break;
    const { seller, buyer, item, price } = exchange;
    seller.civilization.stock[item] -= 1; buyer.civilization.stock[item] += 1;
    buyer.food -= price; seller.food += price;
    volume += 1 + price; traded.push(item);
  }
  if (!volume) return;
  homeCiv.lastTradeDay = awayCiv.lastTradeDay = sim.day;
  if (!homeCiv.tradePartners.includes(destination.id)) homeCiv.tradePartners.push(destination.id);
  if (!awayCiv.tradePartners.includes(home.id)) awayCiv.tradePartners.push(home.id);
  sim.civilization.tradeVolume += volume;
  recordTrade(sim, home, destination, volume);
  experience(agent, 'leadership', 1.2); agent.action = `exchanging ${traded.join(' and ')}`;
  if (agent.psyche) agent.psyche.record.traded++;
  outcome = .9;
  const host = destination.members.map(id => sim._agentMap.get(id)).find(Boolean);
  if (host) communicate(sim, agent, host, true);
  remember(sim, agent, 'trade', `Traded ${traded.join(' and ')} for food with ${destination.name}.`);
  sim._event('trade', `${home.name} and ${destination.name} exchange ${traded.join(' and ')} for food through ${agent.name}.`, { agentId: agent.id, groupId: home.id });
}

/** Structured messages enact the knowledge/skill transfer they describe. */
export function communicate(sim, speaker, listener, deliberate = false) {
  if (!speaker.mind || !listener.mind || distance(speaker, listener) > (deliberate ? 10 : 3.5)) return false;
  if (speaker.mind.lastTalkDay === sim.day || listener.mind.lastTalkDay === sim.day) return false;
  speaker.mind.lastTalkDay = listener.mind.lastTalkDay = sim.day;
  const civ = sim.civilization;
  civ.conversations++;
  let kind = 'social', technology, ideaId, techniqueId, about;
  let text = 'Shared company and strengthened their connection.';
  const relation = speaker._relations.find(r => r.id === listener.id);
  // The listener's personal trust in this speaker (built from past favours,
  // lessons and gossip) matters alongside familiarity and general outlook.
  const personal = listener.psyche ? (trustIn(listener, speaker.id) - .4) * .3 : 0;
  // Prestige bias: skilled, respected and prosperous speakers are more persuasive.
  let topSkill = 0;
  for (const skill of SKILLS) if (speaker.skills[skill] > topSkill) topSkill = speaker.skills[skill];
  const prestige = Math.min(.12, topSkill / 700) + (sim._groupMap.get(speaker.groupId)?.civilization.culture?.leaderId === speaker.id ? .06 : 0) + Math.min(.05, standing(speaker) / 80);
  const trust = clamp(.2 + (relation?.strength || 0) * .4 + speaker.traits.cooperation * sim.config.cooperation * .2 + listener.mind.beliefs.trust * .2 + personal + prestige);
  speaker.mind.beliefs.trust = clamp(speaker.mind.beliefs.trust * .98 + trust * .02);
  listener.mind.beliefs.trust = clamp(listener.mind.beliefs.trust * .98 + trust * .02);
  const missing = speaker.knowledge.find(id => !listener.knowledge.includes(id));
  const newIdea = spreadIdeas(sim, speaker, listener, trust, deliberate);
  if (newIdea) {
    kind = newIdea.kind; text = newIdea.text; ideaId = newIdea.ideaId; civ.ideasShared++;
    remember(sim, listener, 'learning', text);
  } else if (missing && sim._random() < trust * (deliberate ? .95 : .65)) {
    learn(sim, listener, missing, `from ${speaker.name}`);
    technology = missing; kind = 'idea'; civ.ideasShared++;
    text = `Explained ${techById.get(missing).name.toLowerCase()}; ${listener.name} learned the technique.`;
    const society = sim._groupMap.get(listener.groupId);
    if (society && distance(listener, society) < 12) adopt(sim, society, missing, listener);
  } else {
    const skill = [...SKILLS].sort((a, b) => (speaker.skills[b] - listener.skills[b]) - (speaker.skills[a] - listener.skills[a]))[0];
    const gap = speaker.skills[skill] - listener.skills[skill];
    const practice = teachTechnique(sim, speaker, listener, trust, deliberate);
    if (practice) {
      kind = practice.kind; text = practice.text; techniqueId = practice.techniqueId; civ.ideasShared++;
      remember(sim, listener, 'learning', `${speaker.name} taught me ${practice.name}.`);
    } else if (gap > 3 && sim._random() < trust * (deliberate ? 1 : .5)) {
      const amount = Math.min(1.3, gap * .045) * (deliberate ? 1.6 : 1) * techniqueFactor(speaker, 'teach');
      experience(listener, skill, amount); experience(speaker, 'leadership', .08);
      kind = 'teaching'; text = `Demonstrated ${skill}; ${listener.name} gained practical experience.`;
      remember(sim, listener, 'learning', `${speaker.name} helped me practice ${skill}.`);
      const bond = listener._relations.find(r => r.id === speaker.id);
      if (bond && speaker.skills[skill] >= 30) bond.expertise = skill;
    } else {
      // Otherwise people swap directions to known places, advice from experience, or gossip.
      const talk = converse(sim, speaker, listener, trust);
      if (talk) { kind = talk.kind; text = talk.text; about = talk.about; }
      else if (sim._random() < .35) {
        const before = listener.mind.beliefs.abundance;
        listener.mind.beliefs.abundance = clamp(before * .75 + speaker.mind.beliefs.abundance * .25);
        listener.mind.beliefs.opportunity = clamp(listener.mind.beliefs.opportunity * .85 + speaker.mind.beliefs.opportunity * .15);
        kind = 'resource'; text = speaker.mind.beliefs.abundance > .5 ? 'Reported promising food and materials nearby.' : 'Warned that local resources are becoming scarce.';
      }
    }
  }
  // Passing on knowledge counts fully toward a mentor's life record; a skill demonstration partly.
  if (['idea', 'invention', 'belief', 'teaching'].includes(kind)) {
    if (speaker.psyche) speaker.psyche.record.taught = Math.round((speaker.psyche.record.taught + (kind === 'teaching' ? .25 : 1)) * 1e4) / 1e4;
    appreciate(listener, speaker);
  }
  attune(speaker, listener);
  speaker.social = clamp(speaker.social + 2, 0, 100); listener.social = clamp(listener.social + 2, 0, 100);
  speaker.mind.needs.stimulation = clamp(speaker.mind.needs.stimulation - 1, 0, 100);
  listener.mind.needs.stimulation = clamp(listener.mind.needs.stimulation - 1, 0, 100);
  const message = { day: sim.day, speakerId: speaker.id, listenerId: listener.id, speaker: speaker.name, listener: listener.name, kind, text, ...(technology ? { technology } : {}), ...(ideaId ? { ideaId } : {}), ...(techniqueId ? { techniqueId } : {}), ...(about ? { about } : {}) };
  civ.messages.unshift(message);
  if (civ.messages.length > 80) civ.messages.length = 80;
  if (kind === 'idea') {
    remember(sim, speaker, 'teaching', `Shared ${techById.get(technology).name.toLowerCase()} with ${listener.name}.`);
    // Keep the world chronicle useful: individual conversations live in their own feed.
    if (civ.ideasShared % 12 === 1) sim._event('communication', `${speaker.name} shares ${techById.get(technology).name.toLowerCase()} with ${listener.name}.`, { agentId: listener.id, ...(listener.groupId ? { groupId: listener.groupId } : {}) });
  }
  return true;
}

export function observeAction(sim, agent) {
  const mind = agent.mind;
  livePsyche(sim, agent);
  mind.needs.purpose = clamp(mind.needs.purpose + .13 + mind.ambition * .08, 0, 100);
  mind.needs.stimulation = clamp(mind.needs.stimulation + .15 + agent.traits.curiosity * .12, 0, 100);
  const tile = sim._tile(agent.x, agent.y);
  mind.beliefs.abundance = clamp(mind.beliefs.abundance * .96 + clamp(tile.food + agent.inventory.food * .15) * .04);
  mind.beliefs.opportunity = clamp(mind.beliefs.opportunity * .99 + ((tile.stone || 0) + (tile.ore || 0) + (tile.fertility || 0)) / 3 * .01);
  if (agent.action === 'foraging') experience(agent, 'foraging', .16);
  else if (agent.action === 'gathering wood') experience(agent, 'forestry', .19);
  else if (agent.action === 'building shelter') experience(agent, 'crafting', .35);
  else if (['sharing food', 'helping a neighbor', 'caring for family'].includes(agent.action)) { experience(agent, 'leadership', .1); mind.needs.purpose = clamp(mind.needs.purpose - 1, 0, 100); }
  else if (agent.action === 'exploring') mind.needs.stimulation = clamp(mind.needs.stimulation - .6, 0, 100);
  if (sim.day % 30 === agent.id % 30) {
    const best = SKILLS.reduce((a, b) => agent.skills[a] >= agent.skills[b] ? a : b);
    mind.role = agent.age < 16 ? 'Apprentice' : agent.skills[best] < 20 ? 'Generalist' : roleNames[best];
    if (mind.beliefs.abundance < .25) remember(sim, agent, 'observation', 'Food is hard to find in this area.');
    else if (agent.skills[best] >= 35) remember(sim, agent, 'practice', `I am becoming more confident in ${best}.`);
  }
}

export function advanceCivilization(sim) {
  if (sim._farmPlots) for (const id of sim._farmPlots.keys()) if (!sim._groupMap.has(id)) sim._farmPlots.delete(id);
  for (const group of sim.groups) {
    const civ = group.civilization;
    if (!civ) { initializeSociety(group); continue; }
    // Equipment wears out; structures require human labor to exist in the first place.
    civ.stock.tools = Math.max(0, civ.stock.tools - group.members.length * .0009);
    civ.stock.goods *= .9998;
    civ.stock.hides *= .9985; civ.stock.herbs *= .999; civ.stock.remedies *= .9995;
    if (sim.day % 12 === 0) {
      // Diet records recent food sources: variety supports health and shapes cuisine.
      for (const source of DIET) civ.diet[source] = Math.round(civ.diet[source] * .9 * 1e4) / 1e4;
      civ.workforce = {};
      for (const id of group.members) {
        const agent = sim._agentMap.get(id);
        if (agent) civ.workforce[agent.mind.role] = (civ.workforce[agent.mind.role] || 0) + 1;
      }
      civ.tradePartners = civ.tradePartners.filter(id => sim._groupMap.has(id));
      if (civ.project) civ.project.contributors = civ.project.contributors.filter(id => sim._agentMap.has(id));
    }
    if (sim.day % 30 === (group.id + 20) % 30) { rememberTechnologies(sim, group); considerOutbreak(sim, group); }
  }
}

/**
 * The collective brain (Henrich 2004): a society keeps a technique only while
 * someone alive knows it. Unheld for a year, it is forgotten, unless writing and
 * a school or library preserve it or a working building still embodies it.
 * Loss runs leaf first, never undercutting knowledge that depends on it.
 */
function rememberTechnologies(sim, group) {
  const civ = group.civilization, holders = new Map(civ.technologies.map(id => [id, 0]));
  for (const id of group.members) for (const tech of sim._agentMap.get(id)?.knowledge || []) if (holders.has(tech)) holders.set(tech, holders.get(tech) + 1);
  const archived = civ.technologies.includes('writing') && (civ.buildings.school > 0 || civ.buildings.library > 0);
  for (const tech of [...civ.technologies]) {
    const embodied = Object.entries(BUILDINGS).some(([key, building]) => building.technology === tech && civ.buildings[key] > 0);
    const supports = civ.technologies.some(other => techById.get(other).requires.includes(tech));
    if (holders.get(tech) > 0 || archived || embodied || supports) { delete civ.neglect[tech]; continue; }
    civ.neglect[tech] = (civ.neglect[tech] || 0) + 30;
    if (civ.neglect[tech] < 360) continue;
    delete civ.neglect[tech];
    civ.technologies = civ.technologies.filter(id => id !== tech);
    civ.research[tech] = 0;
    sim._event('technology', `${group.name} has forgotten ${techById.get(tech).name.toLowerCase()}: no one left knew how, and nothing preserved it.`, { groupId: group.id });
  }
}

/**
 * Epidemics arise where many people live settled lives close to animals and
 * trade widely (the first epidemiological transition); survivors are immune for
 * a while. Contact carries them to trading partners and allies.
 */
function considerOutbreak(sim, group) {
  const civ = group.civilization;
  if (civ.outbreakUntil > sim.day || civ.immuneUntil > sim.day) return;
  const built = Object.values(civ.buildings).reduce((a, b) => a + b, 0);
  const chance = .0012 * (group.members.length / 20) * (1 + (civ.buildings.pasture || 0) * .6) * (1 + Math.min(5, civ.tradePartners.length) * .15) * (built > 3 ? 1.5 : 1);
  if (sim._random() < chance) startOutbreak(sim, group, null);
}

export function startOutbreak(sim, group, source) {
  const civ = group.civilization;
  civ.outbreakUntil = sim.day + 60 + Math.floor(sim._random() * 30);
  civ.immuneUntil = civ.outbreakUntil + 480;
  for (const id of group.members) {
    const agent = sim._agentMap.get(id);
    if (agent?.age >= 6 && agent.psyche) { agent.psyche.mood.fear = Math.min(1, agent.psyche.mood.fear + .25); }
  }
  sim._event('world', source ? `An epidemic reaches ${group.name}, carried from ${source.name}.` : `An epidemic breaks out in ${group.name}.`, { groupId: group.id });
}

export function civilizationStats(sim) {
  const learned = new Set(sim.groups.flatMap(group => group.civilization?.technologies || []));
  for (const agent of sim.agents) for (const id of agent.knowledge || []) learned.add(id);
  const c = sim.civilization;
  return { technologies: learned.size, industries: sim.groups.reduce((sum, group) => sum + Object.values(group.civilization?.buildings || {}).reduce((a, b) => a + b, 0), 0), conversations: c.conversations, ideasShared: c.ideasShared, researchCompleted: c.researchCompleted, goodsProduced: c.goodsProduced, tradeVolume: c.tradeVolume };
}

// Strict, bounded schema readers for the engine's portable v2 state.
const invalid = field => { throw new Error(`Invalid civilization save: ${field}.`); };
function object(value, field) { if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(field); return value; }
function numeric(value, field, max = 1e15, min = 0, integer = false) { if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isSafeInteger(value))) invalid(field); return value; }
function text(value, field, max = 300) { if (typeof value !== 'string' || !value.length || value.length > max) invalid(field); return value; }
function list(value, field, max) { if (!Array.isArray(value) || value.length > max) invalid(field); return value; }
function numbers(value, keys, field, max = 100) { object(value, field); return Object.fromEntries(keys.map(key => [key, numeric(value[key], `${field}.${key}`, max)])); }
function technologies(value) { const ids = list(value, 'technologies', TECHNOLOGIES.length).map(id => { if (!techById.has(id)) invalid('technology ID'); return id; }); if (new Set(ids).size !== ids.length) invalid('duplicate technology'); return ids; }
function ids(value, field, max, upper) { const result = list(value, field, max).map(id => numeric(id, field, upper - 1, 1, true)); if (new Set(result).size !== result.length) invalid(`duplicate ${field}`); return result; }

export function restoreMind(rawAgent, sim) {
  const raw = object(rawAgent.mind, 'mind'), policy = object(raw.policy, 'policy'), plan = object(raw.plan, 'plan');
  if (!allowedRoles.has(raw.role)) invalid('individual role');
  const mind = {
    values: numbers(raw.values, valueKeys, 'values', 1), ambition: numeric(raw.ambition, 'ambition', 1), patience: numeric(raw.patience, 'patience', 1), riskTolerance: numeric(raw.riskTolerance, 'risk tolerance', 1),
    needs: numbers(raw.needs, ['purpose', 'stimulation'], 'mental needs'), beliefs: numbers(raw.beliefs, ['abundance', 'trust', 'opportunity'], 'beliefs', 1),
    goal: text(raw.goal, 'goal'), role: text(raw.role, 'role', 50), intention: text(raw.intention, 'intention'),
    policy: { action: text(policy.action, 'policy action', 50), reason: text(policy.reason, 'policy reason'), since: numeric(policy.since, 'policy day', sim.day, 0, true), scores: list(policy.scores, 'policy alternatives', 5).map(score => { object(score, 'policy alternative'); return { action: text(score.action, 'alternative action', 50), score: numeric(score.score, 'utility score', 1000, -1000) }; }) },
    memories: list(raw.memories, 'memories', 8).map(memory => { object(memory, 'memory'); return { day: numeric(memory.day, 'memory day', sim.day, 0, true), type: text(memory.type, 'memory type', 50), text: text(memory.text, 'memory text') }; }),
    plan: { goal: text(plan.goal, 'plan goal'), steps: list(plan.steps, 'plan steps', 4).map(step => text(step, 'plan step')), until: numeric(plan.until, 'plan horizon', sim.day + 30, 0, true) },
    lastTalkDay: numeric(raw.lastTalkDay, 'last conversation day', sim.day, -1, true),
  };
  return { mind, skills: numbers(rawAgent.skills, SKILLS, 'skills'), knowledge: technologies(rawAgent.knowledge) };
}

export function restoreSociety(rawGroup, sim) {
  const raw = object(rawGroup.civilization, 'society civilization');
  const known = technologies(raw.technologies);
  if (known.some(id => !techById.get(id).requires.every(key => known.includes(key)))) invalid('technology prerequisites');
  const research = {};
  for (const [id, progress] of Object.entries(object(raw.research, 'research'))) {
    if (!techById.has(id)) invalid('research technology');
    research[id] = numeric(progress, 'research progress', techById.get(id).cost);
  }
  let project = null;
  if (raw.project !== null) {
    const p = object(raw.project, 'research project'), technology = techById.get(p.technology);
    if (!technology || known.includes(technology.id) || !technology.requires.every(id => known.includes(id)) || p.required !== technology.cost) invalid('active research project');
    project = { technology: technology.id, progress: numeric(p.progress, 'project progress', technology.cost), required: technology.cost, contributors: ids(p.contributors, 'research contributors', Number.MAX_SAFE_INTEGER, sim.nextAgentId) };
    if ((research[technology.id] || 0) !== project.progress) invalid('project accounting');
  }
  // Saves before version 5 lack the newer materials and buildings; they start at zero.
  const legacy = (sim._restoreVersion || 5) < 5;
  const fill = (value, keys) => legacy ? { ...blank(keys), ...object(value, 'society record') } : value;
  const buildings = numbers(fill(raw.buildings, Object.keys(BUILDINGS)), Object.keys(BUILDINGS), 'buildings', Number.MAX_SAFE_INTEGER);
  for (const [id, count] of Object.entries(buildings)) if (!Number.isInteger(count) || (count && !known.includes(BUILDINGS[id].technology))) invalid('building prerequisite or count');
  const workforce = {};
  for (const [role, count] of Object.entries(object(raw.workforce, 'workforce'))) { if (!allowedRoles.has(role)) invalid('workforce role'); workforce[role] = numeric(count, 'workers', Number.MAX_SAFE_INTEGER, 0, true); }
  const diet = legacy && raw.diet === undefined ? blank(DIET) : numbers(raw.diet, DIET, 'diet', 1e15);
  const neglect = {};
  if (raw.neglect !== undefined) for (const [id, days] of Object.entries(object(raw.neglect, 'neglected techniques'))) { if (!known.includes(id)) invalid('neglected technique'); neglect[id] = numeric(days, 'neglect', 360, 0, true); }
  const outbreakUntil = raw.outbreakUntil === undefined ? 0 : numeric(raw.outbreakUntil, 'outbreak', sim.day + 90, 0, true);
  const immuneUntil = raw.immuneUntil === undefined ? 0 : numeric(raw.immuneUntil, 'immunity', sim.day + 600, 0, true);
  let survey;
  if (raw.survey !== undefined) {
    object(raw.survey, 'land survey');
    survey = { day: numeric(raw.survey.day, 'survey day', sim.day, 0, true), x: numeric(raw.survey.x, 'survey x', sim.width), y: numeric(raw.survey.y, 'survey y', sim.height), means: numbers(raw.survey.means, SURVEY_KEYS, 'survey', 1) };
  }
  return { technologies: known, research, project, stock: numbers(fill(raw.stock, stockKeys), stockKeys, 'stock', Number.MAX_SAFE_INTEGER), buildings, workforce, production: numbers(fill(raw.production, productionKeys), productionKeys, 'production', 1e15), diet, neglect, outbreakUntil, immuneUntil, ...(survey ? { survey } : {}), tradePartners: ids(raw.tradePartners, 'trade partners', Number.MAX_SAFE_INTEGER, sim.nextGroupId), lastTradeDay: numeric(raw.lastTradeDay, 'last trade day', sim.day, -1, true) };
}

export function restoreCivilization(raw, sim) {
  object(raw, 'civilization');
  const state = numbers(raw, ['conversations', 'ideasShared', 'researchCompleted', 'goodsProduced', 'tradeVolume'], 'civilization totals', 1e15);
  for (const key of ['conversations', 'ideasShared', 'researchCompleted']) if (!Number.isSafeInteger(state[key])) invalid('conversation or research count');
  if (state.ideasShared > state.conversations) invalid('idea accounting');
  state.messages = list(raw.messages, 'messages', 80).map(message => {
    object(message, 'message');
    if (!['idea', 'invention', 'belief', 'teaching', 'resource', 'social', 'trade', 'technique', 'advice', 'gossip'].includes(message.kind)) invalid('message kind');
    const next = { day: numeric(message.day, 'message day', sim.day, 0, true), speakerId: numeric(message.speakerId, 'speaker ID', sim.nextAgentId - 1, 1, true), listenerId: numeric(message.listenerId, 'listener ID', sim.nextAgentId - 1, 1, true), speaker: text(message.speaker, 'speaker', 80), listener: text(message.listener, 'listener', 80), kind: message.kind, text: text(message.text, 'message', 500) };
    if (next.speakerId === next.listenerId) invalid('self conversation');
    if (message.technology !== undefined) { if (!techById.has(message.technology)) invalid('message technology'); next.technology = message.technology; }
    if (message.techniqueId !== undefined) { if (!practiceIds.has(message.techniqueId)) invalid('message technique'); next.techniqueId = message.techniqueId; }
    if (message.about !== undefined) next.about = numeric(message.about, 'message subject', sim.nextAgentId - 1, 1, true);
    if (message.ideaId !== undefined) {
      if (!sim.innovation?.discoveries.some(idea => idea.id === message.ideaId)) invalid('message idea');
      next.ideaId = message.ideaId;
    }
    return next;
  });
  if (state.messages.some((message, index) => index > 0 && message.day > state.messages[index - 1].day)) invalid('message order');
  return state;
}
