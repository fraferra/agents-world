/** Individual cognition, knowledge transmission, and labor-driven civilization.
 * All randomness comes from the simulation. No activity advances from time alone.
 */
import { attemptInnovation, reflectBelief, spreadIdeas, innovationEffects, knowsIdea } from './innovation.js';
import { tradeAccess, recordTrade } from './diplomacy.js';
import { routeFactor, plannedRoute, seafaring } from './infrastructure.js';
import { advances, canPushFrontier, proposeFrontier, completeFrontier, restoreSocietyFrontier, fieldMastery } from './breakthroughs.js';
import { ownsCompany } from './enterprise.js';
import { leadsParty } from './polity.js';
import { keptShare, addWealth, standing } from './economy.js';
import { deliberate, recordReasoning, clearReasoning, reinforce, livePsyche, appraise, appreciate, attune, teachTechnique, converse, trustIn, techniqueFactor, knownExpert, rememberPlace, recallPlace, revisitPlace, practise, TECHNIQUES as PRACTICES } from './psyche.js';

// Research effort per person-day is multiplied by this: the tempo of technological history.
export const RESEARCH_PACE = 2.5;
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
  { id: 'navigation', name: 'Navigation', requires: ['fishing', 'engineering'], cost: 420, materials: { cloth: 3, wood: 4 }, description: 'Sails and ports: ships cross the open sea to islands and distant coasts, with richer fishing and far longer trade routes.' },
  // Industrial and modern eras. Each depends on finite coal or uranium and changes
  // how the society that holds it works, lives, divides its wealth and fights.
  { id: 'chemistry', name: 'Chemistry', era: 'Industrial', requires: ['philosophy', 'metallurgy'], cost: 480, materials: { herbs: 2, ore: 2, clay: 1 }, description: 'The systematic study of substances: fertilisers raise harvests by a quarter and remedies grow stronger.' },
  { id: 'steam', name: 'Steam engine', era: 'Industrial', requires: ['engineering', 'metallurgy'], cost: 560, materials: { metal: 4, coal: 3 }, description: 'Coal-fired engines drive factories. Machines multiply every worker’s output, but they burn finite coal, foul the air and concentrate wealth.' },
  { id: 'railways', name: 'Railways', era: 'Industrial', requires: ['steam', 'governance'], cost: 620, materials: { metal: 6, coal: 3, wood: 4 }, description: 'Iron roads carry goods and people far and fast: trade ranges grow by half and traders travel more often.' },
  { id: 'vaccination', name: 'Germ theory & vaccines', era: 'Industrial', requires: ['medicine', 'chemistry'], cost: 560, materials: { remedies: 3, metal: 1 }, description: 'Hospitals and vaccination: far fewer children die, and epidemics lose their grip.' },
  { id: 'electricity', name: 'Electricity', era: 'Modern', requires: ['steam', 'chemistry'], cost: 700, materials: { metal: 4, coal: 2 }, description: 'Power stations light and drive the whole settlement: a third more output from every workshop, and power for electronics.' },
  { id: 'aviation', name: 'Aviation', era: 'Modern', requires: ['electricity', 'engineering'], cost: 850, materials: { metal: 4, electronics: 1, coal: 2 }, description: 'Engines light enough to fly: airports join distant lands, and people and goods cross oceans in a day.' },
  { id: 'computing', name: 'Computers', era: 'Modern', requires: ['electricity', 'philosophy'], cost: 900, materials: { electronics: 3 }, description: 'Powered computer centres calculate, store and connect: research runs 60% faster and knowledge is never lost.' },
  { id: 'fission', name: 'Nuclear fission', era: 'Atomic', requires: ['electricity', 'computing'], cost: 1100, materials: { uranium: 2, electronics: 2 }, description: 'Reactors draw enormous clean power from a little uranium, with a small risk of catastrophic accident.' },
  { id: 'nuclear-weapons', name: 'Nuclear weapons', era: 'Atomic', requires: ['fission', 'governance'], cost: 1000, materials: { uranium: 3, electronics: 2, metal: 4 }, description: 'Missile silos hold warheads that deter attack, or annihilate a city and poison its land.' },
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
  dock: { name: 'Port', technology: 'navigation', cost: { wood: 6, cloth: 3 } },
  factory: { name: 'Factory', technology: 'steam', cost: { wood: 3, bricks: 6, metal: 4, coal: 2 } },
  railway: { name: 'Railway', technology: 'railways', cost: { wood: 6, metal: 6, coal: 2 } },
  hospital: { name: 'Hospital', technology: 'vaccination', cost: { bricks: 5, metal: 2, remedies: 2 } },
  powerplant: { name: 'Power station', technology: 'electricity', cost: { bricks: 6, metal: 5, coal: 3 } },
  datacenter: { name: 'Computer centre', technology: 'computing', cost: { bricks: 4, metal: 3, electronics: 4 } },
  reactor: { name: 'Nuclear reactor', technology: 'fission', cost: { bricks: 8, metal: 8, electronics: 3, uranium: 2 } },
  silo: { name: 'Missile silo', technology: 'nuclear-weapons', cost: { bricks: 6, metal: 8, electronics: 3 } },
  airport: { name: 'Airport', technology: 'aviation', cost: { bricks: 6, metal: 6, electronics: 2 } },
});
// How each raw material is gathered: the action, the skill it trains, and what it looks like.
const GATHERING = {
  wood: { action: 'lumber', skill: 'forestry', verb: 'cutting timber' }, stone: { action: 'quarry', skill: 'mining', verb: 'quarrying stone' },
  ore: { action: 'mine', skill: 'mining', verb: 'mining ore' }, clay: { action: 'dig', skill: 'mining', verb: 'digging clay' },
  fiber: { action: 'reap', skill: 'foraging', verb: 'gathering fiber' }, herbs: { action: 'herb', skill: 'medicine', verb: 'gathering herbs' },
  gems: { action: 'prospect', skill: 'mining', verb: 'searching for gems' },
  coal: { action: 'colliery', skill: 'mining', verb: 'mining coal' }, uranium: { action: 'uranium', skill: 'mining', verb: 'mining uranium' },
};
// Units of product per unit of deposit on a tile.
export const RICHNESS = Object.freeze({ coal: 6, ore: 2.5, stone: 2, uranium: 3 });
const MATERIAL_OF = Object.fromEntries(Object.entries(GATHERING).map(([material, entry]) => [entry.action, material]));
const techById = new Map(TECHNOLOGIES.map(tech => [tech.id, tech]));
const stockKeys = ['stone', 'ore', 'tools', 'metal', 'goods', 'clay', 'fiber', 'herbs', 'gems', 'hides', 'bricks', 'cloth', 'remedies', 'coal', 'uranium', 'machines', 'electronics', 'warheads'];
const productionKeys = ['food', 'wood', ...stockKeys];
export const DIET = Object.freeze(['wild', 'crops', 'game', 'fish', 'herd']);
const TRADE_GOODS = { tools: 2, cloth: 2, remedies: 3, goods: 1.5, metal: 3, bricks: 1, hides: 1, gems: 5, coal: 1, machines: 4, electronics: 5 };
const TRADE_ITEMS = Object.keys(TRADE_GOODS);
const valueKeys = ['security', 'belonging', 'autonomy', 'mastery', 'care'];
const roleNames = { foraging: 'Forager', farming: 'Farmer', forestry: 'Forester', mining: 'Miner', crafting: 'Artisan', scholarship: 'Scholar', medicine: 'Healer', leadership: 'Organiser' };
// Occupations of a modern society, which appear as its institutions do.
export const MODERN_ROLES = Object.freeze(['Doctor', 'Physician', 'Scientist', 'Programmer', 'Teacher', 'Engineer', 'Factory worker', 'Smith', 'Herder', 'Fisher', 'Sailor', 'Merchant', 'Official', 'Soldier', 'Politician', 'Entrepreneur', 'Pilot',
  // Occupations that only exist once a society's breakthroughs have created them.
  'Robotics engineer', 'Machine minder', 'AI researcher', 'Data scientist', 'Geneticist', 'Agronomist', 'Energy engineer', 'Materials scientist', 'Drone operator', 'Displaced worker']);
const allowedRoles = new Set(['Apprentice', 'Generalist', ...Object.values(roleNames), ...MODERN_ROLES]);

/**
 * What a person does for a living: their strongest skill, read through the
 * institutions of their society and what they actually spend their days on.
 * Party leaders are politicians and company owners entrepreneurs, whatever their skills.
 */
export function roleOf(sim, agent, group) {
  if (agent.age < 16) return 'Apprentice';
  if (leadsParty(sim, agent)) return 'Politician';
  if (ownsCompany(sim, agent)) return 'Entrepreneur';
  const b = group?.civilization?.buildings || {}, action = agent.mind.policy.action;
  const atWar = group && sim.diplomacy?.relations.some(r => r.status === 'war' && (r.a === group.id || r.b === group.id));
  const mastery = fieldMastery(sim, group);
  if (atWar && agent.age >= 18 && agent.age <= 45 && agent.mind.riskTolerance > .6) return mastery.weapons >= 6 ? 'Drone operator' : 'Soldier';
  if (agent._afloat) return b.airport ? 'Pilot' : 'Sailor';
  const best = SKILLS.reduce((x, y) => agent.skills[x] >= agent.skills[y] ? x : y);
  // Where machines do the routine work, the unskilled are displaced unless they tend the machines.
  const automation = advances(group).automation;
  if (agent.skills[best] < 20 && automation > .25) return (agent.id * 2654435761 >>> 0) % 100 < automation * 60 ? 'Displaced worker' : 'Machine minder';
  if (agent.skills[best] < 20) return action === 'trade' ? 'Merchant' : 'Generalist';
  // New specialisms open up with each field's breakthroughs; a person takes one that fits their skill.
  const pick = list => { const open = list.filter(([depth]) => depth); return open.length ? open[(agent.id * 40503 >>> 0) % open.length][1] : null; };
  const deep = { crafting: pick([[mastery.machines >= 5, 'Robotics engineer'], [mastery.materials >= 6, 'Materials scientist'], [mastery.energy >= 5, 'Energy engineer']]),
    scholarship: pick([[mastery.information >= 7, 'AI researcher'], [mastery.information >= 5, 'Data scientist']]), medicine: mastery.medicine >= 5 ? 'Geneticist' : null, farming: mastery.agriculture >= 5 ? 'Agronomist' : null }[best];
  // Only some of the skilled work at the frontier; the rest keep the older professions.
  if (deep && agent.skills[best] >= 40 && (agent.id * 2246822519 >>> 0) % 100 < 45) return deep;
  switch (best) {
    case 'medicine': return b.hospital ? 'Doctor' : b.clinic ? 'Physician' : 'Healer';
    case 'scholarship': return b.datacenter ? (agent.skills.scholarship >= 50 ? 'Scientist' : 'Programmer') : b.school && action === 'teach' ? 'Teacher' : 'Scholar';
    case 'crafting': return b.factory ? (agent.skills.crafting >= 50 ? 'Engineer' : 'Factory worker') : b.forge ? 'Smith' : 'Artisan';
    case 'farming': return (b.pasture || 0) > (b.farm || 0) ? 'Herder' : 'Farmer';
    case 'foraging': return action === 'fish' || b.fishery ? 'Fisher' : 'Forager';
    case 'leadership': return action === 'trade' ? 'Merchant' : b.hall ? 'Official' : 'Organiser';
    default: return roleNames[best];
  }
}
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
    neglect: {}, outbreakUntil: 0, immuneUntil: 0, breakthroughs: [], frontier: null,
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

export const SURVEY_KEYS = Object.freeze(['food', 'wood', 'stone', 'ore', 'clay', 'fiber', 'herbs', 'game', 'fish', 'gems', 'fertility', 'coal', 'uranium']);
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
  // Coal seams and uranium are prospected much farther afield, as far as miners will travel.
  let far = 0;
  const deep = { coal: 0, uranium: 0 };
  for (let dy = -30; dy <= 30; dy += 3) for (let dx = -30; dx <= 30; dx += 3) {
    const tile = sim._tile(group.x + dx, group.y + dy);
    if (tile.terrain === 'water') continue;
    far++; deep.coal += tile.coal || 0; deep.uranium += tile.uranium || 0;
  }
  for (const resource of SURVEY_KEYS) means[resource] = Math.round((resource in deep ? deep[resource] / Math.max(1, far) : means[resource] / Math.max(1, land)) * 1e4) / 1e4;
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
  const b = group.civilization.buildings, modern = industry(group), fx = advances(group);
  return {
    research: (1 + Math.min(2, b.library || 0) * .2) * modern.computing * (modern.powered ? 1.1 : 1) * (1 + fx.research), trade: (1 + Math.min(2, b.market || 0) * .3) * modern.reach * (1 + fx.trade),
    fishing: (1 + Math.min(4, b.fishery || 0) * .3) * (b.dock ? 1.3 : 1),
    defense: 1 + Math.min(2, b.walls || 0) * .3, harvest: (b.observatory ? 1.1 : 1) * modern.fertiliser * Math.max(.3, 1 + fx.food), drought: b.observatory ? .15 : 0, cohesion: Math.min(2, (b.temple || 0) + (b.hall || 0)),
  };
}

/** A power station runs while it has coal; a reactor while it has uranium. */
export function powered(group) {
  const b = group?.civilization?.buildings, stock = group?.civilization?.stock;
  if (!b) return false;
  // Enough energy breakthroughs (dams, solar, fusion) power a town without fuel.
  return (b.reactor > 0 && stock.uranium >= .01) || (b.powerplant > 0 && stock.coal >= .05) || ((b.powerplant > 0 || b.reactor > 0) && advances(group).energy >= .45);
}

/**
 * What industry does to a society's work. Machines multiply labor only while
 * there are enough of them for the workforce; electricity only while fuelled.
 * `smog` is the coal smoke its people breathe (see diseaseLoad in lifecourse.js).
 */
export function industry(group) {
  const civ = group?.civilization, b = civ?.buildings;
  if (!b || !(b.factory || b.railway || b.powerplant || b.reactor || b.datacenter || civ.technologies.includes('chemistry') || civ.breakthroughs?.length)) return IDLE;
  const power = powered(group), n = Math.max(1, group.members.length);
  const machines = b.factory ? Math.min(1, civ.stock.machines / Math.max(2, n * .12)) : 0;
  const coalPower = b.powerplant > 0 && !(b.reactor > 0 && civ.stock.uranium >= .01) && civ.stock.coal >= .05;
  return {
    powered: power, machines, mechanization: 1 + machines * .6, electric: power ? 1.3 : 1,
    fertiliser: civ.technologies.includes('chemistry') ? 1.6 : 1, computing: b.datacenter > 0 && power ? 1.6 : 1, reach: b.railway > 0 ? 1.5 : 1,
    // Clean energy breakthroughs (dams, solar, fusion) clear the smoke of coal and industry.
    smog: clamp((Math.min(4, b.factory || 0) * .12 + (coalPower ? Math.min(2, b.powerplant) * .18 : 0) + Math.min(2, b.railway || 0) * .04) * (1 - clamp(advances(group).energy * .6, 0, .8)) + advances(group).pollution),
  };
}
const IDLE = Object.freeze({ powered: false, machines: 0, mechanization: 1, electric: 1, fertiliser: 1, computing: 1, reach: 1, smog: 0 });

function chooseProject(sim, group) {
  const civ = group.civilization;
  if (civ.project) return;
  // With nothing researchable, don't re-examine the whole tree for every member each day.
  const stamp = daily(sim, 'noProject', group, civ.technologies.length, () => ({ none: false }));
  if (stamp.none) return;
  const near = surroundings(sim, group), norms = civ.culture?.norms;
  // A technology whose demonstration the land cannot supply is not taken up; otherwise a
  // finished idea is abandoned for want of materials and chosen again the next day.
  const options = TECHNOLOGIES.filter(tech => !civ.technologies.includes(tech.id) && tech.requires.every(id => civ.technologies.includes(id)) && obtainable(group, tech.materials, near));
  if (!options.length) { stamp.none = true; return; }
  const people = group.members.map(id => sim._agentMap.get(id)).filter(Boolean);
  const mean = trait => people.reduce((sum, person) => sum + person.traits[trait], 0) / Math.max(1, people.length);
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
    if (tech.id === 'chemistry') score += mean('curiosity') * 6 + near.herbs * 8;
    if (tech.id === 'steam') score += near.coal * 30 + (norms?.innovation || 0) * 6;
    if (tech.id === 'railways') score += civ.tradePartners.length * 3 + near.coal * 10 + (norms?.mercantile || 0) * 6;
    if (tech.id === 'vaccination') score += people.filter(agent => agent.age < 5).length * 1.5 + (civ.outbreakUntil > sim.day ? 14 : 0);
    if (tech.id === 'electricity') score += (civ.buildings.factory || 0) * 5;
    if (tech.id === 'aviation') score += civ.tradePartners.length * 2 + (norms?.expansion || 0) * 8;
    if (tech.id === 'computing') score += mean('curiosity') * 8 + (norms?.innovation || 0) * 10;
    if (tech.id === 'fission') score += near.uranium * 60 + (civ.stock.coal < 2 && civ.buildings.powerplant ? 8 : 0);
    if (tech.id === 'nuclear-weapons') {
      // Fear of an armed rival and a warlike culture drive the bomb; peaceful cultures hesitate.
      const armedRival = sim.diplomacy?.relations.some(r => (r.a === group.id || r.b === group.id) && r.tension > 40 && (sim._groupMap.get(r.a === group.id ? r.b : r.a)?.civilization.stock.warheads || 0) >= 1);
      score += (norms?.martial || 0) * 25 + (armedRival ? 20 : 0) + (sim.diplomacy?.relations.some(r => r.status === 'war' && (r.a === group.id || r.b === group.id)) ? 12 : 0) - (norms?.collectivism || 0) * 8;
    }
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
    agent.mind.goal = ({ research: 'Understand and improve the world', invent: 'Develop and test a new design', reflect: 'Make sense of life together', study: 'Master a useful skill', teach: 'Pass knowledge to the next generation', farm: 'Create a dependable food supply', build: 'Give the community better tools', craft: 'Become a capable maker', smelt: 'Turn minerals into useful materials', lumber: 'Provision the settlement', quarry: 'Find materials for shared projects', mine: 'Find materials for shared projects', heal: 'Care for vulnerable neighbors', trade: 'Connect our community with others', colliery: 'Fuel the engines of industry', uranium: 'Find materials for shared projects', manufacture: 'Mechanise our work', assemble: 'Build the machines of a new age', enrich: 'Arm our people against their rivals', survive: 'Secure food and rest', explore: 'Find new opportunities', socialize: 'Build lasting connections' })[action] || 'Build a secure life';
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
    ['hall', people > 30 ? 95 : 74 + (norms.hierarchy || 0) * 10, 1], ['observatory', 72, 1], ['dock', near.fish > .03 ? 93 : 0, near.fish > .03 ? 1 : 0],
    ['factory', 87, Math.max(1, Math.ceil(people / 40))], ['hospital', plague || civ.outbreakUntil > sim.day ? 102 : 90, 1 + (people > 60 ? 1 : 0)],
    ['powerplant', civ.buildings.reactor ? 0 : 86, civ.buildings.reactor ? 0 : 1], ['railway', (civ.buildings.factory ? 88 : 79) + (norms.mercantile || 0) * 8, 1],
    ['datacenter', 83 + (norms.innovation || 0) * 8, 1], ['reactor', 84 + (civ.stock.coal < 2 ? 10 : 0), 1],
    ['silo', atWar ? 97 : 55 + (norms.martial || 0) * 30 - (norms.collectivism || 0) * 10, 1],
    ['airport', 80 + (norms.mercantile || 0) * 8 + (norms.expansion || 0) * 6, 1],
  ];
  // A demonstration waiting on a processed good makes the building that produces it urgent.
  const urgent = new Set(Object.keys(awaitedMaterials(group)).map(key => PRODUCER[key]).filter(Boolean));
  if (awaitedMaterials(group).electronics && !civ.buildings.powerplant && !civ.buildings.reactor) urgent.add('powerplant');
  for (const entry of plan) if (urgent.has(entry[0])) { entry[1] = Math.max(entry[1], 99); entry[2] = Math.max(entry[2], 1); }
  let best = null, priority = -Infinity;
  for (const [key, weight, target] of plan) {
    if (weight > priority && civ.technologies.includes(BUILDINGS[key].technology) && civ.buildings[key] < target && obtainable(group, BUILDINGS[key].cost, near)) { best = key; priority = weight; }
  }
  return best;
}

// The building that turns raw materials into each processed good.
const PRODUCER = { bricks: 'kiln', goods: 'kiln', cloth: 'loom', metal: 'forge', remedies: 'apothecary', machines: 'factory', electronics: 'factory' };

/**
 * Whether every material could be had: in store, gatherable nearby, or producible
 * here. A producer the society knows how to build, and could build, counts too:
 * people plan for the forge a steam engine will need.
 */
function obtainable(group, cost, near, depth = 0) {
  const civ = group.civilization;
  const producer = key => civ.buildings[key] > 0 || (depth < 2 && civ.technologies.includes(BUILDINGS[key].technology) && obtainable(group, BUILDINGS[key].cost, near, depth + 1));
  return Object.entries(cost).every(([key, value]) => {
    // Timber, stone and ore were always sought further afield when scarce nearby.
    if (have(group, key) >= value || ['food', 'wood', 'stone', 'ore'].includes(key)) return true;
    if (GATHERING[key]) return (near[key] || 0) > (key === 'gems' ? .005 : key === 'uranium' ? .002 : key === 'coal' ? .01 : .02);
    if (key === 'bricks') return civ.technologies.includes('brickmaking') && producer('kiln') && near.clay > .02;
    if (key === 'cloth') return producer('loom') && near.fiber > .02;
    if (key === 'metal') return producer('forge') && near.ore > .02;
    if (key === 'goods') return producer('kiln');
    if (key === 'remedies') return producer('apothecary') && near.herbs > .02;
    if (key === 'machines') return producer('factory') && (civ.stock.coal >= 1 || near.coal > .01);
    if (key === 'electronics') return producer('factory') && civ.technologies.includes('electricity') && (civ.buildings.powerplant > 0 || civ.buildings.reactor > 0 || (depth < 2 && obtainable(group, BUILDINGS.powerplant.cost, near, depth + 1))) && (civ.stock.clay >= 1 || near.clay > .02);
    return false;
  });
}

/** Materials a finished idea is waiting on before it can be demonstrated. */
function awaitedMaterials(group) {
  const civ = group.civilization, project = civ.project;
  if (!project || project.progress < project.required) return {};
  return Object.fromEntries(Object.entries(techById.get(project.technology).materials).filter(([key, value]) => have(group, key) < value));
}

function localResource(sim, agent, key) {
  const radius = Math.round((key === 'coal' || key === 'uranium' ? 30 : key === 'ore' || key === 'gems' ? 20 : key === 'fish' ? 16 : 12) * (key === 'wood' || key === 'fish' || key === 'game' ? 1 : techniqueFactor(agent, 'prospect')));
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
    const place = recallPlace(agent, key, key === 'coal' || key === 'uranium' ? 60 : key === 'ore' || key === 'gems' ? 45 : 30);
    if (place) best = { x: place.x, y: place.y };
  }
  return best;
}

function gatherMaterial(sim, agent, group, material) {
  const resource = material === 'wood' ? 'wood' : material;
  const target = localResource(sim, agent, resource);
  if (!target) { agent.action = `prospecting for ${material}`; sim._move(agent, sim._landNear(agent.x + (sim._random() - .5) * 30, agent.y + (sim._random() - .5) * 30)); return; }
  sim._move(agent, target);
  // A day's work at a distant deposit is a day trip: the load comes from the deposit
  // itself, smaller the farther it lies; roads and railways shorten the journey.
  const civ = group.civilization, away = distance(agent, target);
  const tile = away > 1.5 ? sim._tile(target.x, target.y) : sim._tile(agent.x, agent.y);
  const journey = away > 1.5 ? 1 / (1 + away / (civ.buildings.railway ? 36 : civ.technologies.includes('masonry') ? 18 : 12)) : 1;
  const skill = GATHERING[material].skill;
  const mill = material === 'wood' && civ.buildings.lumbermill ? 1.5 : 1;
  const technique = material === 'wood' ? techniqueFactor(agent, 'timber') : ['stone', 'ore', 'clay', 'gems', 'coal', 'uranium'].includes(material) ? techniqueFactor(agent, 'extract') : 1;
  // Gems and uranium are scarce and slow to find; everything else yields a day's load.
  // Coal seams give bulk tonnage for a day's work.
  const base = material === 'gems' || material === 'uranium' ? .05 + agent.skills[skill] * .001 : material === 'coal' ? .42 + agent.skills[skill] * .006 : .17 + agent.skills[skill] * .003;
  // Steam pumps and powered drills: machines lift far more from mines and quarries.
  const machinery = ['stone', 'ore', 'coal', 'uranium', 'clay'].includes(material) ? industry(group).mechanization : 1;
  const amount = Math.min((tile[resource] || 0) * (RICHNESS[resource] || 1), base * mill * technique * machinery * journey * (civ.stock.tools > 0 ? 1.15 : 1) * innovationEffects(sim, group).gathering);
  // A unit of deposit yields several of product: seams and veins run deep.
  tile[resource] = Math.max(0, (tile[resource] || 0) - amount / (RICHNESS[resource] || 1));
  // Quarries, pits and mines scar the land where people dig.
  if (resource !== 'wood' && resource !== 'fiber' && resource !== 'herbs' && amount > 0) tile.worked = Math.min(1, (tile.worked || 0) + amount * .12);
  revisitPlace(sim, agent, resource, tile[resource] || 0);
  if (amount > .05) rememberPlace(sim, agent, resource, Math.floor(target.x) + .5, Math.floor(target.y) + .5, tile[resource] || 0);
  outcome = amount > .01 ? clamp(amount * 4, .2, 1) : -.4;
  // Deep mining is dangerous work: collapses, firedamp and dust.
  if ((material === 'coal' || material === 'uranium') && amount > .01 && sim._random() < .006) agent.health = clamp(agent.health - 6 - sim._random() * 10, 0, 100);
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
  // A destination near home is worth scouting only if it lies across the water.
  const lands = sim._landmasses(), landOf = point => lands.label[Math.floor(point.y) * sim.width + Math.floor(point.x)];
  const trivial = Math.hypot(target.x - group.x, target.y - group.y) < 14 && landOf(target) === landOf(group);
  if (trivial || distance(agent, target) < 1.5) {
    if (distance(agent, target) < 1.5) {
      // Survey the surroundings and remember the best of each resource.
      let noted = 0;
      for (const kind of ['food', 'wood', 'stone', 'ore', 'fish', 'game', 'clay', 'gems', 'coal', 'uranium']) {
        let best = null, value = 0;
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
          const tile = sim._tile(agent.x + dx, agent.y + dy);
          if (tile.terrain !== 'water' && (tile[kind] || 0) > value) { value = tile[kind]; best = { x: Math.floor(agent.x + dx) + .5, y: Math.floor(agent.y + dy) + .5 }; }
        }
        if (best && value > .4) { rememberPlace(sim, agent, kind, best.x, best.y, value); noted++; }
      }
      outcome = noted ? .5 : .05;
      // First landfall on land this society has never reached.
      const here = landOf(agent);
      const civ = group.civilization;
      civ.landsKnown ||= [lands.label[Math.floor(group.y) * sim.width + Math.floor(group.x)]];
      if (here >= 0 && !civ.landsKnown.includes(here)) {
        civ.landsKnown.push(here);
        const region = sim.regions.reduce((best, candidate) => Math.hypot(candidate.x - agent.x, candidate.y - agent.y) < Math.hypot(best.x - agent.x, best.y - agent.y) ? candidate : best, sim.regions[0]);
        sim._event('migration', `${agent.name} of ${group.name} makes landfall on unknown shores near ${region.name}.`, { agentId: agent.id, groupId: group.id });
        appraise(sim, agent, 'discovery', { name: `the shores of ${region.name}`, activity: 'pioneer' });
        outcome = 1;
      }
    }
    // With boats, scouts often sail out to land across the water within reach.
    const vessel = seafaring(group);
    const voyage = vessel.kind && sim._random() < .5 ? sim._voyageTarget(group, Math.min(vessel.reach, 120)) : null;
    const angle = sim._random() * Math.PI * 2, range = 20 + sim._random() * 45;
    const next = voyage || sim._landNear(group.x + Math.cos(angle) * range, group.y + Math.sin(angle) * range);
    agent._wanderX = next.x; agent._wanderY = next.y;
  }
  sim._move(agent, { x: agent._wanderX, y: agent._wanderY }, 1.15);
  agent.action = agent._afloat ? 'exploring by boat' : 'scouting distant land';
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

/**
 * Hunger that fields can answer. In a band that knows cultivation but has no farm,
 * a couple of the able hungry build the first one (or fetch its timber and stone);
 * in a farming band, the hungry fill the day's farming quota and keep up to half
 * their harvest for their household. Returns true if the day was spent so.
 */
function surviveByFarming(sim, agent, group, youngChildren) {
  const civ = group.civilization;
  if (!civ || agent.age < 14 || agent.energy < 30 || agent.health < 45 || agent.hunger > 60 || !civ.technologies.includes('cultivation')) return false;
  if (sim._civilAssignments?.day !== sim.day) sim._civilAssignments = { day: sim.day, farms: new Map() };
  const count = key => sim._civilAssignments.farms.get(key) || 0, bump = key => sim._civilAssignments.farms.set(key, count(key) + 1);
  const steps = ['Reach the fields', 'Grow food', 'Feed the family'];
  if (!civ.buildings.farm) {
    if (count(`first-farm:${group.id}`) >= 2) return false;
    bump(`first-farm:${group.id}`);
    const cost = BUILDINGS.farm.cost;
    setPolicy(sim, agent, 'build', 'Clear and plant a first field, so the band need not live off wild food.', [{ action: 'build', score: 100 }], steps);
    clearReasoning(agent);
    if (distance(agent, group) >= 9) { sim._move(agent, group); agent.action = 'heading home to plant a field'; return true; }
    outcome = null;
    if (group.wood >= cost.wood && civ.stock.stone >= cost.stone) execute(sim, agent, group, { action: 'build', target: 'farm' });
    else gatherMaterial(sim, agent, group, group.wood < cost.wood ? 'wood' : 'stone');
    return true;
  }
  const farmers = count(group.id);
  const farmYield = Math.max(.3, .6 * (civ.technologies.includes('irrigation') ? 1.4 : 1) * facilities(group).harvest * industry(group).mechanization);
  if (farmers >= Math.min(civ.buildings.farm * 4, Math.ceil(group.members.length * .23 / farmYield))) return false;
  setPolicy(sim, agent, 'farm', youngChildren ? 'Grow food to feed the children.' : 'Grow food for myself and the community.', [{ action: 'farm', score: 100 }], steps);
  clearReasoning(agent);
  sim._civilAssignments.farms.set(group.id, farmers + 1);
  if (distance(agent, group) >= 9) { sim._move(agent, group); agent.action = 'heading to the fields'; return true; }
  const store = group.food;
  outcome = null;
  execute(sim, agent, group, { action: 'farm', steps });
  // A hungry farmer keeps up to half of what they brought in.
  const harvested = Math.max(0, group.food - store), share = Math.min(harvested * .5, group.food, 5 - agent.inventory.food);
  if (share > 0) { group.food -= share; agent.inventory.food += share; }
  if (outcome !== null) reinforce(sim, agent, 'farm', outcome);
  return true;
}

const WORK_LABELS = { farm: 'Farm the fields', research: 'Research', invent: 'Experiment and invent', reflect: 'Reflect with others', study: 'Study', teach: 'Teach someone', build: 'Build', craft: 'Make tools',
  pottery: 'Fire pottery', smelt: 'Smelt metal', bricks: 'Fire bricks', weave: 'Weave cloth', remedy: 'Prepare remedies', herd: 'Tend herds', manufacture: 'Work the factory', assemble: 'Assemble electronics',
  heal: 'Care for the sick', trade: 'Trade with a neighbour', lumber: 'Cut timber', quarry: 'Quarry stone', mine: 'Mine ore', dig: 'Dig clay', reap: 'Gather fiber', herb: 'Gather herbs', prospect: 'Prospect for gems',
  colliery: 'Mine coal', uranium: 'Mine uranium', hunt: 'Hunt', fish: 'Fish', pioneer: 'Scout distant land' };

/**
 * The work open to a person in their society today, for someone directing them:
 * each entry names the action and, where it has one, what it acts on.
 */
export function availableWork(sim, agent, group) {
  if (!group?.civilization) return [];
  const civ = group.civilization, b = civ.buildings, known = civ.technologies, work = [];
  const offer = (action, target = null, detail = '') => work.push({ action, target, label: WORK_LABELS[action] + (detail ? ` (${detail})` : '') });
  if (b.farm) offer('farm');
  if (civ.project) offer('research', null, techById.get(civ.project.technology).name.toLowerCase());
  else if (civ.frontier) offer('research', null, civ.frontier.name.toLowerCase());
  offer('invent'); offer('reflect'); offer('study');
  const building = desiredBuilding(sim, group);
  if (building && Object.entries(BUILDINGS[building].cost).every(([key, value]) => have(group, key) >= value)) offer('build', building, BUILDINGS[building].name.toLowerCase());
  if (b.workshop) offer('craft'); if (b.kiln) offer('pottery'); if (b.forge) offer('smelt');
  if (b.kiln && known.includes('brickmaking')) offer('bricks'); if (b.loom) offer('weave'); if (b.apothecary) offer('remedy'); if (b.pasture) offer('herd');
  if (b.factory) offer('manufacture'); if (b.factory && known.includes('electricity')) offer('assemble');
  const neighbors = sim._neighbors(agent, 7);
  const patient = known.includes('medicine') ? neighbors.filter(other => other.health < 80).sort((x, y) => x.health - y.health)[0] : null;
  if (patient) offer('heal', patient.id, patient.name);
  const student = neighbors.find(other => other.age >= 5 && SKILLS.some(skill => agent.skills[skill] - other.skills[skill] > 10));
  if (student) offer('teach', student.id, student.name);
  const partner = sim.groups.find(other => other.id !== group.id && other.civilization && tradeAccess(sim, group, other) && exchangePair(group, other));
  if (partner) offer('trade', partner.id, partner.name);
  for (const [material, { action }] of Object.entries(GATHERING)) if (material !== 'uranium' || known.includes('fission')) if (material !== 'coal' || known.includes('steam')) offer(action);
  offer('hunt'); offer('fish'); offer('pioneer');
  return work;
}

/** Performs one day of the chosen work for a directed person. Returns false if it cannot be done. */
export function performWork(sim, agent, group, action, target = null) {
  const job = availableWork(sim, agent, group).find(entry => entry.action === action && (target === null || entry.target === target || entry.target === null));
  if (!job) return false;
  if (['research', 'invent', 'reflect', 'study', 'build', 'farm', 'craft', 'pottery', 'smelt', 'bricks', 'weave', 'remedy', 'herd', 'manufacture', 'assemble'].includes(action) && distance(agent, group) >= 9) {
    sim._move(agent, group); agent.action = 'heading to work'; return true;
  }
  if (action === 'pioneer') { scout(sim, agent, group); return true; }
  outcome = null;
  if (sim._civilAssignments?.day !== sim.day) sim._civilAssignments = { day: sim.day, farms: new Map() };
  execute(sim, agent, group, { action, target: job.target, steps: [] });
  if (outcome !== null) reinforce(sim, agent, action, outcome);
  if (action === 'farm') sim._civilAssignments.farms.set(group.id, (sim._civilAssignments.farms.get(group.id) || 0) + 1);
  agent.mind.policy = { action, reason: 'Directed from beyond.', scores: [], since: agent.mind.policy.action === action ? agent.mind.policy.since : sim.day };
  return true;
}

/** Called before basic behavior. Basic survival retains absolute priority. */
export function considerCivilization(sim, agent, group) {
  const mind = agent.mind || initializeMind(sim, agent).mind;
  const youngChildren = agent.children.some(id => { const child = sim._agentMap.get(id); return child && child.age < 12; });
  const sharedMeals = group && distance(agent, group) < 9 ? Math.min(2, group.food / Math.max(1, group.members.length)) : 0;
  // A household pools what it carries: a partner nearby shares the family's reserve.
  const partner = agent.partnerId ? sim._agentMap.get(agent.partnerId) : null;
  const foodSecurity = agent.inventory.food + sharedMeals + (partner && distance(agent, partner) < 8 ? partner.inventory.food * .5 : 0);
  if (agent.age < 10 || agent.hunger > 26 || agent.energy < 43 || agent.health < 45 || foodSecurity < (youngChildren ? 1.65 : .85)) {
    if (group && surviveByFarming(sim, agent, group, youngChildren)) return true;
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
  // Daily head-counts per society for work that only needs a few hands.
  if (sim._civilAssignments?.day !== sim.day) sim._civilAssignments = { day: sim.day, farms: new Map() };
  const assigned = kind => sim._civilAssignments.farms.get(`${kind}:${group.id}`) || 0;
  chooseProject(sim, group);
  const choices = [], stock = civ.stock, effects = innovationEffects(sim, group);
  const building = daily(sim, 'building', group, builtCount(group) * 64 + civ.technologies.length, () => desiredBuilding(sim, group));
  const near = surroundings(sim, group), members = group.members.length, known = civ.technologies, norms = civ.culture?.norms;
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
  // With the known tree exhausted, researchers push past it.
  if (!civ.project && agent.age >= 14 && canPushFrontier(group)) {
    civ.frontier ||= proposeFrontier(sim, group);
    const frontier = civ.frontier;
    if (frontier && frontier.progress < frontier.required) add('research', 20 + mind.values.mastery * 21 + agent.traits.curiosity * 15 + agent.skills.scholarship * .2 + mind.needs.stimulation * .15 + mind.ambition * 7, `Push past the known: work toward ${frontier.name.toLowerCase()}.`, ['Question what is known', 'Build and test prototypes', 'Share what works']);
  }
  if (civ.project && !awaiting && agent.age >= 14) add('research', 20 + mind.values.mastery * 21 + agent.traits.curiosity * 15 + agent.skills.scholarship * .2 + mind.needs.stimulation * .15 + mind.ambition * 7 + mind.beliefs.opportunity * 4, `Help investigate ${techById.get(civ.project.technology).name.toLowerCase()} with the community.`, ['Join the shared investigation', 'Experiment and compare ideas', 'Share a working technique']);
  if (agent.age >= 14) {
    const experiment = civ.experiment;
    const trialCost = experiment?.hypothesis.cost;
    const ready = !trialCost || Object.entries(trialCost).every(([key, value]) => (key === 'food' ? group.food : available(stock, group, key)) >= value);
    // Experiments need a few inventors, not the whole community.
    if (ready) { if (assigned('invent') < Math.max(2, group.members.length * .15)) add('invent', (civ.project ? 17 : 23) + mind.values.mastery * 17 + agent.traits.curiosity * 16 + agent.skills.scholarship * .12 + mind.needs.stimulation * .15 + mind.riskTolerance * 6 + (experiment ? 8 * experiment.progress / experiment.required : 0), experiment ? `Test the community’s proposed ${experiment.hypothesis.name.toLowerCase()}.` : 'Combine available materials and existing ideas into an untested design.', ['Propose a design', 'Contribute labor and materials', 'Test, revise, and share the result']); }
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
  // Stock a society is working toward: what the next building and demonstration both require.
  // The next road or railway line counts too, so smiths and miners work toward it.
  const route = daily(sim, 'route', group, civ.buildings.railway * 1000 + civ.tradePartners.length, () => plannedRoute(sim, group));
  const frontierDue = civ.frontier && civ.frontier.progress >= civ.frontier.required ? civ.frontier.cost : null;
  const required = key => (building ? BUILDINGS[building].cost[key] || 0 : 0) + (awaiting ? projectTech.materials[key] || 0 : 0) + (route?.cost[key] || 0) + (frontierDue?.[key] || 0);
  if (route) want(route.cost, 36, `Materials for the ${route.kind === 'rail' ? 'railway' : 'road'} to ${route.other.name}.`);
  // Work that supplies a demonstration the whole community is waiting on takes precedence.
  const awaited = awaitedMaterials(group), rush = key => awaited[key] ? 14 : 0;
  if (agent.age >= 14 && civ.buildings.kiln && known.includes('brickmaking') && stock.bricks < Math.max(3, required('bricks') + 1)) {
    const urgent = buildingNeed('bricks') + projectNeed('bricks') > 0;
    if (stock.clay >= .4 && group.wood >= .3) add('bricks', (urgent ? 44 : 30) + rush('bricks') + agent.skills.crafting * .2 + mind.values.care * 8, 'Fire bricks for lasting buildings.', ['Reach the kiln', 'Shape and fire clay bricks']);
    else want(stock.clay < .4 ? { clay: .4 } : { wood: .3 }, urgent ? 43 : 29, 'The kiln needs clay and fuel for bricks.');
  }
  const winter = sim.weather.winterUntil > sim.day, plague = sim.weather.plagueUntil > sim.day;
  if (agent.age >= 14 && civ.buildings.loom && stock.cloth < Math.max(2, members * (winter ? .4 : .2), buildingNeed('cloth') + projectNeed('cloth'))) {
    if (stock.fiber >= .4) add('weave', (winter ? 46 : 32) + rush('cloth') + agent.skills.crafting * .2 + mind.values.care * 6, winter ? 'Cloth keeps people alive through the cold.' : 'Weave cloth for clothing, sails and trade.', ['Reach the loom', 'Spin and weave fiber']);
    else want({ fiber: .4 }, (winter ? 45 : 31) + rush('cloth'), 'The loom needs fiber.');
  }
  if (agent.age >= 14 && civ.buildings.apothecary && stock.remedies < Math.max(2, members * (plague ? .35 : .1), required('remedies') + .5)) {
    if (stock.herbs >= .3) add('remedy', (plague ? 52 : 31) + rush('remedies') + agent.skills.medicine * .25 + mind.values.care * 10, plague ? 'Remedies are needed against the plague.' : 'Prepare remedies for the sick.', ['Reach the apothecary', 'Prepare herbal remedies']);
    else want({ herbs: .3 }, (plague ? 50 : 30) + rush('remedies'), 'The apothecary needs fresh herbs.');
  }
  if (agent.age >= 14 && !civ.buildings.kiln && known.includes('pottery') && stock.clay < 2 && near.clay > .02) want({ clay: 2 }, 26, 'Clay will be needed for pottery.');
  // A finite number of plots can be tended each day; otherwise farming crowds
  // every other occupation out of the policy even when there are surplus workers.
  if (sim._civilAssignments?.day !== sim.day) sim._civilAssignments = { day: sim.day, farms: new Map() };
  const farmWorkers = sim._civilAssignments.farms.get(group.id) || 0;
  // Farming duty: until enough hands are in the fields to feed everyone (at what a farm day
  // yields with this society's methods), the fields come before other work.
  const farmYield = Math.max(.3, .6 * (civ.technologies.includes('irrigation') ? 1.4 : 1) * facilities(group).harvest * industry(group).mechanization);
  const farmersNeeded = Math.min(civ.buildings.farm * 4, Math.ceil(members * .23 / farmYield));
  const duty = farmWorkers < farmersNeeded && group.food < members * 1.5 ? 30 : 0;
  if (civ.buildings.farm && farmWorkers < civ.buildings.farm * 4 && group.food < group.members.length * 2 && agent.age >= 12) add('farm', 27 + duty + Math.max(0, 1.5 - group.food / Math.max(1, group.members.length)) * 14 + mind.values.security * 12 + agent.skills.farming * .22, 'A more dependable harvest will keep the community fed.', ['Reach the farms', 'Tend and harvest crops', 'Share the harvest']);
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
    if (group.wood >= .3 && (stock.stone >= .4 || stock.metal - .2 >= required('metal'))) add('craft', 43 + toolNeed * 18 + agent.skills.crafting * .3 + mind.values.mastery * 12, 'Useful tools make everyone’s work more productive.', ['Bring materials to the workshop', 'Make and share tools'], required('metal'));
    else if (group.wood < 1) add('lumber', 46 + agent.skills.forestry * .1, 'The workshop needs wood for tool handles.', ['Find woodland', 'Supply timber']);
    else add('quarry', 44 + agent.skills.mining * .1, 'The workshop needs stone for new tools.', ['Find stone', 'Supply the workshop']);
  }
  if (civ.buildings.kiln && stock.goods < Math.max(12, members * .6)) {
    if (group.wood >= .25 && (stock.clay >= .2 || stock.stone >= .2)) add('pottery', 30 + rush('goods') + agent.skills.crafting * .2 + mind.ambition * 10, 'Make durable household goods for the community.', ['Reach the kiln', 'Fire clay and stone-rich earth'], 'goods');
    else if (stock.stone < .2) add('quarry', 31 + rush('goods') + agent.skills.mining * .12, 'The kiln needs fresh stone-rich earth.', ['Locate useful earth and stone', 'Supply the kiln']);
    else add('lumber', 31 + rush('goods') + agent.skills.forestry * .12, 'The kiln needs wood fuel.', ['Collect wood fuel', 'Supply the kiln']);
  }
  if (civ.buildings.forge && stock.metal < Math.max(8, members * .2, required('metal') + 1)) {
    if (stock.ore >= .35 && group.wood >= .45) add('smelt', 39 + rush('metal') + agent.skills.crafting * .22 + mind.values.mastery * 12, 'Turn ore and fuel into useful metal.', ['Reach the forge', 'Smelt ore with wood fuel']);
    else if (stock.ore < .35) add('mine', 38 + rush('metal') + agent.skills.mining * .2, 'The forge has run short of ore.', ['Seek an ore deposit', 'Supply the forge']);
    else add('lumber', 38 + rush('metal') + agent.skills.forestry * .2, 'The forge needs wood fuel.', ['Collect fuel wood', 'Supply the forge']);
  }
  // Industry: factories turn metal and coal into machines, and (with power) metal and
  // clay into electronics; power stations and reactors need a steady supply of fuel.
  const modern = industry(group);
  if (agent.age >= 14 && civ.buildings.factory && stock.machines < Math.max(3, members * .15)) {
    if (stock.metal >= .3 && stock.coal >= .3) add('manufacture', 40 + (1 - modern.machines) * 12 + agent.skills.crafting * .25 + mind.ambition * 8, 'Build machines that multiply everyone’s labor.', ['Reach the factory', 'Fire the engines', 'Build and share machines']);
    else want(stock.coal < .3 ? { coal: 2 } : { ore: 1 }, 50, stock.coal < .3 ? 'The factory engines need coal.' : 'The factory needs metal.');
  }
  if (agent.age >= 14 && civ.buildings.factory && known.includes('electricity') && modern.powered && stock.electronics < Math.max(1, required('electronics') + (civ.buildings.silo ? 1 : 0) + .5)) {
    if (stock.metal >= .2 && stock.clay >= .2) add('assemble', 38 + rush('electronics') + agent.skills.crafting * .2 + agent.skills.scholarship * .15 + mind.values.mastery * 8, 'Assemble electronics for computers and machines.', ['Reach the factory', 'Assemble circuits']);
    else want(stock.clay < .2 ? { clay: 1 } : { ore: 1 }, 37, 'Electronics need metal and refined clay.');
  }
  if (civ.buildings.powerplant && !civ.buildings.reactor && stock.coal < 4 + members * .05) want({ coal: 4 + members * .05 }, modern.powered ? 48 : 62 + (norms?.hierarchy || 0) * 20, modern.powered ? 'The power station is burning through its coal.' : 'The power station has gone dark for want of coal.');
  if (civ.buildings.reactor && stock.uranium < 1) want({ uranium: 1 }, 40, 'The reactor needs uranium fuel.');
  // How many warheads a society wants depends on how warlike it is and how threatened it feels.
  const threat = civ.buildings.silo && sim.diplomacy?.relations.some(r => (r.a === group.id || r.b === group.id) && (r.status === 'war' || r.tension > 50)) ? 2 : 0;
  const arsenal = civ.buildings.silo ? Math.round(1 + (norms?.martial || 0) * 5 + threat) : 0;
  if (agent.age >= 18 && civ.buildings.silo && modern.powered && stock.warheads < arsenal) {
    if (stock.uranium >= .5 && stock.electronics >= .2 && stock.metal >= .3) add('enrich', 30 + (norms?.martial || 0) * 20 + threat * 6 + agent.skills.scholarship * .15 - mind.values.care * 12, threat ? 'Our rivals threaten us; the arsenal must deter them.' : 'The state wants a nuclear deterrent.', ['Enrich uranium', 'Assemble a warhead']);
    else want(stock.uranium < .5 ? { uranium: 1 } : { ore: 1 }, 33 + threat * 4, 'Warheads need enriched uranium.');
  }
  // Pioneers and the restlessly curious scout distant land; what they find guides colonies.
  const drive = Math.max(agent.psyche?.expansion ?? 0, agent.traits.curiosity * .7 + mind.needs.stimulation / 100 * .3);
  if (agent.age >= 16 && agent.age < 55 && drive > .35 && assigned('pioneer') < Math.max(1, group.members.length * .08)) add('pioneer', 6 + drive * 30 + (civ.culture?.pressure || 0) * 20, 'Scout distant land where our people could settle.', ['Travel beyond our lands', 'Remember good sites', 'Report back'], null);
  const neighbors = sim._neighbors(agent, 7);
  // Someone who knows fewer ideas must lack at least one; only equals need a full comparison.
  const lacksIdea = other => (agent.ideas || []).length > (other.ideas || []).length || (agent.ideas || []).some(id => !knowsIdea(other, id));
  const student = neighbors.find(other => other.age >= 5 && (agent.knowledge.some(id => !other.knowledge.includes(id)) || lacksIdea(other) || SKILLS.some(skill => agent.skills[skill] - other.skills[skill] > 15)));
  if (student) add('teach', 26 + mind.values.care * 18 + agent.traits.sociability * 10 + mind.needs.purpose * .15, `Help ${student.name} learn a useful skill.`, ['Find a willing learner', 'Share an idea', 'Practice together'], student.id);
  if (civ.buildings.school && (civ.technologies.some(id => !agent.knowledge.includes(id)) || agent.skills.scholarship < 30)) add('study', 30 + mind.values.mastery * 16 + mind.needs.stimulation * .18, 'Study the community’s accumulated knowledge.', ['Visit the school', 'Study a shared technique', 'Practice it']);
  const patient = civ.technologies.includes('medicine') ? neighbors.filter(other => other.health < 80).sort((a, b) => a.health - b.health)[0] : null;
  if (patient) add('heal', 45 + (100 - patient.health) * .4 + mind.values.care * 15, `${patient.name} needs care and practical medical knowledge.`, ['Reach the patient', 'Provide care and food'], patient.id);
  // Whether there is anything to exchange is cheap to check; reachability and relations are not.
  const neighborGroup = daily(sim, 'partner', group, civ.lastTradeDay, () => sim.groups.find(other => other.id !== group.id && other.civilization && exchangePair(group, other) && tradeAccess(sim, group, other)) || null);
  const pair = neighborGroup && exchangePair(group, neighborGroup);
  // A couple of traders suffice; the rest of the community keeps working.
  const traders = sim._civilAssignments.farms.get(`trade:${group.id}`) || 0;
  if (pair && traders < 2 && sim.day - civ.lastTradeDay >= Math.max(1, 12 / (effects.trade * techniqueFactor(agent, 'trade') * facilities(group).trade * routeFactor(sim, group, neighborGroup))) && agent.age >= 16) {
    const { seller, buyer, item } = pair;
    const foodNeed = clamp(1 - seller.food / Math.max(1, seller.members.length * 2));
    const goodNeed = clamp(1 - buyer.civilization.stock[item] / tradeTarget(buyer, item));
    add('trade', 46 + (foodNeed + goodNeed) * 8 + mind.ambition * 15 + agent.skills.leadership * .15, `Exchange ${item} for food with ${neighborGroup.name} to meet complementary needs.`, ['Visit the neighboring settlement', `Exchange ${item} and food`, 'Share useful knowledge'], neighborGroup.id);
  }
  // Raw materials anything above is waiting on (buildings, demonstrations, fuel, routes).
  for (const [material, { score, reason }] of shortfalls) {
    const { action, skill } = GATHERING[material];
    add(action, score + agent.skills[skill] * .14 + (material === 'gems' ? mind.riskTolerance * 6 : 0), reason, [`Find ${material}`, 'Bring it to the settlement'], material);
  }
  // Personality, mood, memories, learned expectations and life goals reweigh
  // each option; the breakdown is kept so observers can see why.
  deliberate(sim, agent, choices);
  choices.sort((a, b) => b.score - a.score);
  const choice = choices[0];
  recordReasoning(sim, agent, choices);
  setPolicy(sim, agent, choice.action, choice.reason, choices, choice.steps);
  if (choice.action === 'basic') return false;
  if (['research', 'invent', 'reflect', 'study', 'build', 'farm', 'craft', 'pottery', 'smelt', 'bricks', 'weave', 'remedy', 'herd', 'manufacture', 'assemble', 'enrich'].includes(choice.action) && !nearHome) {
    sim._move(agent, group); agent.action = `heading to ${choice.action === 'research' ? 'shared research' : 'work'}`;
    return true;
  }
  outcome = null;
  const energyBefore = agent.energy;
  const handled = execute(sim, agent, group, choice);
  // Machines and electric power take the hardest labour off people's backs.
  const saving = industry(group);
  const relief = saving.mechanization * saving.electric * (1 + Math.max(0, advances(group).automation));
  if (agent.energy < energyBefore && relief > 1) agent.energy += (energyBefore - agent.energy) * (1 - 1 / relief);
  if (outcome !== null) reinforce(sim, agent, choice.action, outcome);
  if (handled === false) return false;
  if (choice.action === 'farm') sim._civilAssignments.farms.set(group.id, farmWorkers + 1);
  if (choice.action === 'hunt') sim._civilAssignments.farms.set(`hunt:${group.id}`, (sim._civilAssignments.farms.get(`hunt:${group.id}`) || 0) + 1);
  for (const kind of ['trade', 'invent', 'pioneer']) if (choice.action === kind) sim._civilAssignments.farms.set(`${kind}:${group.id}`, assigned(kind) + 1);
  mind.needs.purpose = clamp(mind.needs.purpose - 1.6, 0, 100);
  mind.needs.stimulation = clamp(mind.needs.stimulation - (['research', 'invent', 'reflect', 'study', 'teach'].includes(choice.action) ? 3 : .5), 0, 100);
  return true;
}


/** How far a society cultivates: more farms reach farther; tractors and railways farther still. */
export function farmRadius(group) {
  const b = group.civilization.buildings, modern = industry(group);
  return Math.min(12 + (modern.machines > .3 ? 4 : 0) + (b.railway > 0 ? 2 : 0), 3 + Math.ceil(Math.sqrt(b.farm) * 2));
}

export function harvestSoil(sim, group, wanted, efficiency = 1) {
  const farms = group.civilization.buildings.farm;
  if (!farms || wanted <= 0) return 0;
  const radius = farmRadius(group);
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
  const modern = industry(group);
  // Engineering, machines and electric power each multiply workshop output.
  const engineering = (civ.technologies.includes('engineering') ? 1.35 : 1) * modern.mechanization * modern.electric * Math.max(.3, 1 + advances(group).production);
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
      const project = civ.project, frontier = !project ? civ.frontier : null;
      if (!project && !frontier) break;
      const activePeers = group.members.filter(id => { const peer = sim._agentMap.get(id); return peer && peer.id !== agent.id && peer.mind.policy.action === 'research' && distance(agent, peer) < 8; }).length;
      const cooperation = 1 + Math.min(4, activePeers) * .08 * sim.config.cooperation;
      // Larger, better-connected populations sustain faster innovation (the collective brain).
      const minds = 1 + .12 * Math.log1p(group.members.length / 5) + .04 * Math.min(5, civ.tradePartners.length);
      const effort = RESEARCH_PACE * (.14 + agent.skills.scholarship * .006) * cooperation * (civ.buildings.school ? 1.3 : 1) * effects.learning * (.8 + effects.solidarity * .4) * techniqueFactor(agent, 'research') * facilities(group).research * minds;
      if (frontier) {
        // Beyond the known tree: the same work, toward something no one has made before.
        frontier.progress = Math.min(frontier.required, frontier.progress + effort);
        if (!frontier.contributors.includes(agent.id)) frontier.contributors.push(agent.id);
        agent.action = `researching ${frontier.name.toLowerCase()}`;
        experience(agent, 'scholarship', .3); agent.energy = clamp(agent.energy - 2.5, 0, 100);
        outcome = .15;
        if (frontier.progress >= frontier.required) {
          const made = completeFrontier(sim, group, agent);
          if (made) { outcome = 1; if (agent.psyche) appraise(sim, agent, 'discovery', { name: made.name.toLowerCase(), activity: 'research' }); }
          else agent.action = `awaiting materials for ${frontier.name.toLowerCase()}`;
        }
        break;
      }
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
    case 'lumber': case 'quarry': case 'mine': case 'dig': case 'reap': case 'herb': case 'prospect': case 'colliery': case 'uranium': gatherMaterial(sim, agent, group, MATERIAL_OF[choice.action]); break;
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
      const output = (.3 + agent.skills.crafting * .004) * modern.mechanization * modern.electric * effects.crafting;
      stock.cloth += output - keep(agent, group, output); civ.production.cloth += output; sim.civilization.goodsProduced += output;
      agent.action = 'weaving cloth'; experience(agent, 'crafting', .3); agent.energy = clamp(agent.energy - 2.2, 0, 100); outcome = .4;
      break;
    }
    case 'remedy': {
      if (stock.herbs < .3) break;
      stock.herbs -= .3;
      const output = (.3 + agent.skills.medicine * .004) * effects.healing * (civ.technologies.includes('chemistry') ? 1.3 : 1);
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
      const efficiency = effects.food * (irrigation ? 1.4 : 1) * (civ.technologies.includes('engineering') ? 1.35 : 1) * modern.mechanization * techniqueFactor(agent, 'soil') * facilities(group).harvest;
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
      // Metal set aside for a building or demonstration is not turned into tools.
      const metal = stock.metal - .2 >= (choice.target || 0);
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
    case 'manufacture': {
      if (stock.metal < .3 || stock.coal < .3) break;
      stock.metal -= .3; stock.coal -= .3;
      const output = (.3 + agent.skills.crafting * .004) * modern.electric * effects.crafting;
      stock.machines += output - keep(agent, group, output); civ.production.machines += output; sim.civilization.goodsProduced += output;
      agent.action = 'working the factory engines'; experience(agent, 'crafting', .4); agent.energy = clamp(agent.energy - 4, 0, 100); outcome = .5;
      break;
    }
    case 'assemble': {
      if (stock.metal < .2 || stock.clay < .2 || !modern.powered) break;
      stock.metal -= .2; stock.clay -= .2;
      const output = (.15 + agent.skills.crafting * .002 + agent.skills.scholarship * .002) * modern.mechanization * effects.crafting;
      stock.electronics += output - keep(agent, group, output); civ.production.electronics += output; sim.civilization.goodsProduced += output;
      agent.action = 'assembling electronics'; experience(agent, 'crafting', .3); experience(agent, 'scholarship', .15); agent.energy = clamp(agent.energy - 2.5, 0, 100); outcome = .5;
      break;
    }
    case 'enrich': {
      if (stock.uranium < .5 || stock.electronics < .2 || stock.metal < .3 || !modern.powered) break;
      stock.uranium -= .5; stock.electronics -= .2; stock.metal -= .3;
      const output = (.08 + agent.skills.scholarship * .001) * modern.computing;
      stock.warheads += output; civ.production.warheads += output;
      agent.action = 'building nuclear warheads'; experience(agent, 'scholarship', .3); agent.energy = clamp(agent.energy - 3, 0, 100); outcome = .3;
      if (agent.psyche) agent.psyche.mood.fear = Math.min(1, agent.psyche.mood.fear + .01);
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
  const b = group.civilization.buildings, awaited = awaitedMaterials(group)[item] ? techById.get(group.civilization.project.technology).materials[item] : 0;
  let base;
  switch (item) {
    case 'tools': base = Math.max(2, n * .12); break;
    case 'cloth': base = Math.max(1, n * .15); break;
    case 'remedies': base = Math.max(1, n * .08); break;
    case 'goods': base = Math.max(2, n * .2); break;
    case 'metal': base = 2; break;
    case 'bricks': base = 3; break;
    case 'hides': base = Math.max(1, n * .08); break;
    case 'gems': base = 1; break;
    case 'coal': base = b.factory || b.powerplant ? 4 + n * .05 : 0; break;
    case 'machines': base = b.factory ? Math.max(2, n * .12) : Math.max(1, n * .05); break;
    case 'electronics': base = b.datacenter || b.silo || b.reactor ? 2 : 0; break;
  }
  return Math.max(awaited, base);
}

function exchangePair(first, second) {
  // A buyer must actually need the good and have surplus food to pay; the seller
  // must hold a surplus and want food. This prevents meaningless back-and-forth
  // trades and unlimited stock accumulation.
  // A seller must want food; checked first, since it rules out a direction for every good.
  const forward = first.food < first.members.length * 2, backward = second.food < second.members.length * 2;
  if (!forward && !backward) return null;
  for (const item of TRADE_ITEMS) {
    const price = TRADE_GOODS[item];
    for (const [seller, buyer, wants] of [[first, second, forward], [second, first, backward]]) {
      if (wants && buyer.food > Math.max(2, buyer.members.length) + price
        && seller.civilization.stock[item] >= tradeTarget(seller, item) + 1 && buyer.civilization.stock[item] < tradeTarget(buyer, item)) return { seller, buyer, item, price };
    }
  }
  return null;
}

function trade(sim, agent, home, destination) {
  if (!destination || !tradeAccess(sim, home, destination)) return;
  const logistics = innovationEffects(sim, home).trade * techniqueFactor(agent, 'trade') * facilities(home).trade * routeFactor(sim, home, destination);
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
    mind.role = roleOf(sim, agent, sim._groupMap.get(agent.groupId));
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
    // Households use up pottery, cloth and tools; industrial and information economies consume far more.
    // Only surplus above a working reserve is used up, so building stock can accumulate.
    const standard = civ.buildings.datacenter ? 3 : civ.buildings.factory ? 2.5 : 1, n = group.members.length, reserve = 4 + n * .05;
    const consume = (key, rate) => { civ.stock[key] -= Math.min(Math.max(0, civ.stock[key] - reserve), n * rate * standard); };
    consume('goods', .0015); consume('cloth', .0008);
    if (standard > 1) consume('tools', .0004);
    civ.stock.hides *= .9985; civ.stock.herbs *= .999; civ.stock.remedies *= .9995;
    civ.stock.machines *= .9992; civ.stock.electronics *= .9996;
    // Power stations burn coal every day; a fuelled reactor replaces them and burns a little uranium.
    const b = civ.buildings;
    if (b.reactor && civ.stock.uranium >= .01) civ.stock.uranium = Math.max(0, civ.stock.uranium - .0015 * Math.min(2, b.reactor));
    else if (b.powerplant && civ.stock.coal > 0) civ.stock.coal = Math.max(0, civ.stock.coal - (.01 + group.members.length * .0003) * Math.min(2, b.powerplant));
    if (b.railway && civ.stock.coal > 0) civ.stock.coal = Math.max(0, civ.stock.coal - .005 * Math.min(2, b.railway));
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
    if (sim.day % 30 === (group.id + 20) % 30) { rememberTechnologies(sim, group); considerOutbreak(sim, group); considerMeltdown(sim, group); measureEconomy(sim, group); }
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
  const archived = (civ.technologies.includes('writing') && (civ.buildings.school > 0 || civ.buildings.library > 0)) || civ.buildings.datacenter > 0;
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

// What a unit of each product is worth, for measuring a society's economic output.
export const VALUE = Object.freeze({ food: 1, wood: .5, stone: .5, ore: 1, tools: 2, metal: 3, goods: 1.5, clay: .3, fiber: .3, herbs: .5, gems: 5, hides: 1, bricks: 1, cloth: 2, remedies: 3, coal: 1, uranium: 5, machines: 6, electronics: 8, warheads: 0 });
const productionValue = civ => Object.entries(civ.production).reduce((sum, [key, amount]) => sum + amount * (VALUE[key] ?? 0), 0);
const round2 = value => Math.round(value * 100) / 100;

/**
 * Monthly: the value of what a society produced, annualised and smoothed, with a
 * yearly record. A society whose output doubles within ten years is booming.
 */
function measureEconomy(sim, group) {
  const civ = group.civilization, value = productionValue(civ);
  const economy = civ.economy ||= { value, output: -1, history: [], yearDay: sim.day, boomDay: -1 };
  const month = Math.max(0, value - economy.value);
  economy.value = round2(value);
  // The first month sets the level; later months are smoothed into it.
  economy.output = round2(economy.output < 0 ? month * 12 : economy.output * .75 + month * 12 * .25);
  if (sim.day - economy.yearDay < 120) return;
  economy.yearDay = sim.day;
  economy.history.push(economy.output);
  if (economy.history.length > 20) economy.history.shift();
  const decade = economy.history.at(-11);
  // Only an established economy booms; young societies always grow from nothing.
  if (economy.history.length >= 13 && decade >= 400 && economy.output >= decade * 2 && sim.day - economy.boomDay > 1200) {
    economy.boomDay = sim.day;
    const industrial = civ.buildings.factory || civ.buildings.powerplant || civ.buildings.railway;
    sim._event('industry', `${group.name}'s economy is booming${industrial ? ' with industry' : ''}: its output has more than doubled in ten years.`, { groupId: group.id });
  }
}

/** Reactors rarely fail; computer control makes it rarer. A meltdown poisons the land around it. */
function considerMeltdown(sim, group) {
  const civ = group.civilization;
  if (!civ.buildings.reactor || civ.stock.uranium < .01) return;
  if (sim._random() >= .0008 * Math.min(2, civ.buildings.reactor) * (civ.buildings.datacenter ? .5 : 1)) return;
  civ.buildings.reactor--;
  contaminate(sim, group.x, group.y, 4, .35);
  for (const id of group.members) {
    const agent = sim._agentMap.get(id);
    if (!agent || distance(agent, group) > 10) continue;
    agent.health = clamp(agent.health - 15 - sim._random() * 30, 0, 100);
    if (agent.health === 0) agent._deathCause = 'radiation';
    if (agent.age >= 6) appraise(sim, agent, 'catastrophe', { text: `The reactor of ${group.name} melted down and poisoned our land.` });
  }
  sim._event('world', `The nuclear reactor of ${group.name} melts down. Radiation sickens its people and poisons the land around it.`, { groupId: group.id });
}

/** Fallout: soil, wild food and animals around a point are reduced to `survival`. */
export function contaminate(sim, x, y, radius, survival) {
  for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
    if (dx * dx + dy * dy > radius * radius) continue;
    const tx = Math.floor(x) + dx, ty = Math.floor(y) + dy;
    if (tx < 0 || ty < 0 || tx >= sim.width || ty >= sim.height) continue;
    const tile = sim.tiles[ty * sim.width + tx];
    tile.food *= survival; tile.soil = (tile.soil ?? tile.fertility) * survival;
    tile.game = (tile.game || 0) * survival; tile.fish = (tile.fish || 0) * survival; tile.herbs = (tile.herbs || 0) * survival;
  }
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
  // Saves before version 7 lack the newer materials and buildings; they start at zero.
  const legacy = (sim._restoreVersion || 7) < 7;
  // Records written before a building or material existed simply lack it; it starts at zero.
  const fill = (value, keys) => ({ ...blank(keys), ...object(value, 'society record') });
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
  // Surveys from before coal and uranium existed are simply retaken.
  if (raw.survey !== undefined && !legacy) {
    object(raw.survey, 'land survey');
    survey = { day: numeric(raw.survey.day, 'survey day', sim.day, 0, true), x: numeric(raw.survey.x, 'survey x', sim.width), y: numeric(raw.survey.y, 'survey y', sim.height), means: numbers(raw.survey.means, SURVEY_KEYS, 'survey', 1) };
  }
  let economy;
  if (raw.economy !== undefined) {
    const e = object(raw.economy, 'economy');
    economy = { value: numeric(e.value, 'economic value', 1e15), output: numeric(e.output, 'economic output', 1e15, -1), history: list(e.history, 'economic history', 20).map(value => numeric(value, 'economic record', 1e15)),
      yearDay: numeric(e.yearDay, 'economic year', sim.day, 0, true), boomDay: numeric(e.boomDay, 'boom day', sim.day, -1, true) };
  }
  let landsKnown;
  if (raw.landsKnown !== undefined) landsKnown = list(raw.landsKnown, 'known lands', 100000).map(value => numeric(value, 'known land', 1e7, 0, true));
  return { ...(economy ? { economy } : {}), ...(landsKnown ? { landsKnown } : {}), ...restoreSocietyFrontier(raw, sim, known), technologies: known, research, project, stock: numbers(fill(raw.stock, stockKeys), stockKeys, 'stock', Number.MAX_SAFE_INTEGER), buildings, workforce, production: numbers(fill(raw.production, productionKeys), productionKeys, 'production', 1e15), diet, neglect, outbreakUntil, immuneUntil, ...(survey ? { survey } : {}), tradePartners: ids(raw.tradePartners, 'trade partners', Number.MAX_SAFE_INTEGER, sim.nextGroupId), lastTradeDay: numeric(raw.lastTradeDay, 'last trade day', sim.day, -1, true) };
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
