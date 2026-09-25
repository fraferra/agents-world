import { culturalPull } from './culture.js';

/** Inner lives: personality, emotion, long-term memory, learned preferences,
 * aspirations, transmissible techniques, spatial memory and social cognition.
 * Every field here changes behaviour — deliberation, yields, learning or trust.
 * All randomness comes from sim._random(); stored numbers are rounded so that
 * in-memory and file checkpoints stay identical (JSON has no negative zero).
 */
export const PERSONALITY = Object.freeze(['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism']);
export const EMOTIONS = Object.freeze(['joy', 'pride', 'fear', 'anger', 'grief']);
export const ACTIVITIES = Object.freeze(['basic', 'research', 'invent', 'reflect', 'study', 'teach', 'farm', 'build', 'craft', 'pottery', 'smelt', 'lumber', 'quarry', 'mine', 'heal', 'trade',
  'hunt', 'fish', 'herd', 'dig', 'reap', 'herb', 'prospect', 'bricks', 'weave', 'remedy', 'pioneer', 'colliery', 'uranium', 'manufacture', 'assemble', 'enrich']);
const SKILL_IDS = ['foraging', 'farming', 'forestry', 'mining', 'crafting', 'scholarship', 'medicine', 'leadership'];
const PLACE_KINDS = ['food', 'wood', 'stone', 'ore', 'clay', 'fiber', 'herbs', 'gems', 'game', 'fish', 'coal', 'uranium'];
const RECORD_KEYS = ['discovered', 'taught', 'healed', 'built', 'traded', 'provided', 'founded'];

/** Practical know-how. Effects multiply the named quantity for the holder only. */
export const TECHNIQUES = Object.freeze([
  { id: 'keen-eye', name: 'Forager’s eye', skill: 'foraging', threshold: 22, requires: null, effect: { forage: 1.2 }, description: 'Reads the land for ripe food: wild harvests yield 20% more.' },
  { id: 'preserving', name: 'Drying & smoking', skill: 'foraging', threshold: 50, requires: 'keen-eye', effect: { preserve: 5 }, description: 'Carried food spoils five times more slowly.' },
  { id: 'rotation', name: 'Crop rotation', skill: 'farming', threshold: 28, requires: null, effect: { soil: 1.2 }, description: 'Draws 20% more food from each unit of soil nutrients.' },
  { id: 'seed-saving', name: 'Seed selection', skill: 'farming', threshold: 58, requires: 'rotation', effect: { farm: 1.15 }, description: 'Chooses the best seed stock: each day in the fields harvests 15% more.' },
  { id: 'coppicing', name: 'Coppicing', skill: 'forestry', threshold: 28, requires: null, effect: { timber: 1.2 }, description: 'Cuts regrowing stems: 20% more timber per day, never more than the tile holds.' },
  { id: 'joinery', name: 'Joinery', skill: 'forestry', threshold: 58, requires: 'coppicing', effect: { buildWood: .75 }, description: 'Fitted joints: buildings this person raises need 25% less timber.' },
  { id: 'vein-reading', name: 'Vein reading', skill: 'mining', threshold: 28, requires: null, effect: { prospect: 1.5 }, description: 'Recognises mineral signs from further away when prospecting.' },
  { id: 'fire-setting', name: 'Fire-setting', skill: 'mining', threshold: 58, requires: 'vein-reading', effect: { extract: 1.2 }, description: 'Cracks rock with heat: 20% more stone and ore per day.' },
  { id: 'hafting', name: 'Hafting', skill: 'crafting', threshold: 25, requires: null, effect: { tools: 1.15 }, description: 'Secure handles: 15% more tools from the same materials.' },
  { id: 'tempering', name: 'Tempering', skill: 'crafting', threshold: 58, requires: 'hafting', effect: { metal: 1.2, tools: 1.08 }, description: 'Controlled heating and quenching: more metal from each smelt, sturdier tools.' },
  { id: 'note-taking', name: 'Note-taking', skill: 'scholarship', threshold: 30, requires: null, effect: { research: 1.15 }, description: 'Keeps records of attempts: research and experiments progress 15% faster.' },
  { id: 'pedagogy', name: 'Pedagogy', skill: 'scholarship', threshold: 62, requires: 'note-taking', effect: { teach: 1.4 }, description: 'Explains in steps: pupils gain skill 40% faster and adopt techniques more readily.' },
  { id: 'poultices', name: 'Poultices', skill: 'medicine', threshold: 25, requires: null, effect: { heal: 1.3 }, description: 'Herbal dressings: care restores 30% more health.' },
  { id: 'bone-setting', name: 'Bone-setting', skill: 'medicine', threshold: 58, requires: 'poultices', effect: { heal: 1.25 }, description: 'Sets fractures properly: care restores a further 25% more health.' },
  { id: 'mediation', name: 'Mediation', skill: 'leadership', threshold: 28, requires: null, effect: { mediate: 1 }, description: 'Calms anger in conversation and builds trust faster.' },
  { id: 'organizing', name: 'Organizing', skill: 'leadership', threshold: 60, requires: 'mediation', effect: { trade: 1.5 }, description: 'Arranges exchanges efficiently: this person can trade 50% more often.' },
]);
const techniqueById = new Map(TECHNIQUES.map(technique => [technique.id, technique]));

/** Which activities exercise which skill; used by mastery aspirations and techniques. */
const SKILL_ACTIVITIES = { foraging: ['basic', 'hunt', 'fish', 'reap'], farming: ['farm', 'herd'], forestry: ['lumber'], mining: ['quarry', 'mine', 'dig', 'prospect', 'colliery', 'uranium'], crafting: ['craft', 'pottery', 'smelt', 'build', 'bricks', 'weave', 'manufacture', 'assemble'], scholarship: ['research', 'invent', 'study', 'enrich'], medicine: ['heal', 'herb', 'remedy'], leadership: ['trade', 'teach', 'reflect', 'pioneer'] };
const ACTIVITY_SKILL = Object.fromEntries(Object.entries(SKILL_ACTIVITIES).flatMap(([skill, activities]) => activities.map(activity => [activity, skill])));
const ACTIVITY_LABEL = { basic: 'everyday foraging', research: 'research', invent: 'experimenting', reflect: 'reflection', study: 'study', teach: 'teaching', farm: 'farming', build: 'building', craft: 'toolmaking', pottery: 'pottery', smelt: 'smelting', lumber: 'timber work', quarry: 'quarrying', mine: 'mining', heal: 'healing', trade: 'trading',
  hunt: 'hunting', fish: 'fishing', herd: 'herding', dig: 'clay digging', reap: 'fiber gathering', herb: 'herb gathering', prospect: 'gem prospecting', bricks: 'brickmaking', weave: 'weaving', remedy: 'remedy making', pioneer: 'pioneering', colliery: 'coal mining', uranium: 'uranium mining', manufacture: 'factory work', assemble: 'electronics assembly', enrich: 'weapons work' };
const SKILL_NOUN = { foraging: 'forager', farming: 'farmer', forestry: 'forester', mining: 'miner', crafting: 'artisan', scholarship: 'scholar', medicine: 'healer', leadership: 'organiser' };

export const ASPIRATIONS = Object.freeze({
  grow: { serves: ['study'], label: 'Grow up and find my place' },
  mastery: { serves: [], label: 'Master a craft' },
  discovery: { serves: ['research', 'invent'], label: 'Discover something new' },
  family: { serves: ['basic', 'farm'], label: 'Raise a family' },
  leadership: { serves: ['trade', 'teach', 'reflect', 'build'], label: 'Earn the trust of many' },
  provider: { serves: ['farm', 'lumber', 'craft'], label: 'Keep my community fed' },
  healer: { serves: ['heal', 'study'], label: 'Care for the sick' },
  mentor: { serves: ['teach', 'study'], label: 'Pass on what I know' },
  wanderer: { serves: ['basic', 'trade'], label: 'See distant lands' },
  pioneer: { serves: ['pioneer', 'basic'], label: 'Found a new settlement' },
});

/** The part of a person's pioneering drive that comes from who they are. Deterministic. */
export function temperamentalDrive(agent) {
  const p = agent.psyche?.personality, mind = agent.mind;
  if (!p || !mind) return .4;
  return clamp(.1 + p.openness * .25 + mind.ambition * .2 + mind.values.autonomy * .2 + mind.riskTolerance * .15 + (1 - p.neuroticism) * .1 - p.agreeableness * .05);
}

const LIMITS = { episodes: 12, places: 8, reasoning: 3, factors: 5 };
const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const round = value => Math.round(value * 1e4) / 1e4 || 0;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// ——— creation ———

export function initializeGlobalPsyche(sim) {
  sim.psyche = { techniquesDiscovered: 0, techniquesTaught: 0, aspirationsAchieved: 0, adviceShared: 0, gossip: 0, firsts: [] };
  return sim.psyche;
}

/** Personality correlates with the older traits so both descriptions agree. */
export function initializePsyche(sim, agent, parents = null) {
  const inherited = parents?.every(parent => parent.psyche);
  const personality = {};
  const anchor = { openness: agent.traits.curiosity, extraversion: agent.traits.sociability, agreeableness: agent.traits.cooperation };
  for (const key of PERSONALITY) {
    personality[key] = round(inherited
      ? clamp((parents[0].psyche.personality[key] + parents[1].psyche.personality[key]) / 2 + (sim._random() - .5) * .3)
      : clamp((anchor[key] ?? .5) * .45 + .1 + sim._random() * .5));
  }
  const talents = {};
  for (const skill of SKILL_IDS) {
    talents[skill] = round(inherited
      ? clamp((parents[0].psyche.talents[skill] + parents[1].psyche.talents[skill]) / 2 + (sim._random() - .5) * .35, .5, 1.6)
      : .65 + sim._random() * .75);
  }
  agent.psyche = {
    personality, talents, mood: { joy: .3, pride: 0, fear: 0, anger: 0, grief: 0 },
    preferences: {}, expectations: {}, techniques: [], episodes: [], places: [], visited: 0, practice: {},
    record: Object.fromEntries(RECORD_KEYS.map(key => [key, 0])),
    aspiration: null, reasoning: [], thought: agent.age < 14 ? 'Everything here is new.' : 'I should find my place in this world.', lastReflection: sim.day, expansion: .4,
  };
  agent.psyche.expansion = round(temperamentalDrive(agent));
  agent.psyche.aspiration = agent.age < 14 ? aspirationOf(sim, agent, 'grow') : chooseAspiration(sim, agent);
  return agent;
}

// ——— memory & emotion ———

/** Emotional reactivity: neurotic people feel losses and threats more strongly. */
export function feel(agent, emotion, amount) {
  const p = agent.psyche?.personality;
  if (!p) return;
  const scale = ['fear', 'anger', 'grief'].includes(emotion) ? .55 + p.neuroticism * .9 : emotion === 'joy' ? .7 + p.extraversion * .5 : .7 + p.conscientiousness * .5;
  agent.psyche.mood[emotion] = round(clamp(agent.psyche.mood[emotion] + amount * scale));
}

/** Long-term episodic memory. Salient episodes outlive trivial ones. */
export function recordEpisode(sim, agent, { type, text, valence = 0, salience = .5, about = null, activity = null }) {
  const psyche = agent.psyche;
  if (!psyche) return;
  const episodes = psyche.episodes;
  if (episodes.some(episode => episode.text === text && sim.day - episode.day < 60)) return;
  const episode = { day: sim.day, type, text, valence: round(clamp(valence, -1, 1)), salience: round(clamp(salience)) };
  if (about !== null) episode.about = about;
  if (activity) episode.activity = activity;
  episodes.push(episode);
  if (episodes.length > LIMITS.episodes) {
    let weakest = 0;
    for (let i = 1; i < episodes.length; i++) if (episodes[i].salience < episodes[weakest].salience) weakest = i;
    episodes.splice(weakest, 1);
  }
  if (salience >= .8) psyche.thought = innerVoice(sim, agent);
}

/** One call for significant life events: an emotion, a memory, sometimes a new thought. */
export function appraise(sim, agent, kind, detail = {}) {
  if (!agent?.psyche) return;
  const name = detail.name || 'someone';
  switch (kind) {
    case 'bereavement':
      feel(agent, 'grief', detail.closeness ?? .6); feel(agent, 'joy', -.2);
      recordEpisode(sim, agent, { type: 'loss', text: detail.text || `${name} died.`, valence: -.9, salience: clamp(.45 + (detail.closeness ?? .6) * .55), about: detail.about ?? null });
      break;
    case 'birth':
      feel(agent, 'joy', .5); feel(agent, 'pride', .2);
      recordEpisode(sim, agent, { type: 'family', text: `${name} was born to us.`, valence: .9, salience: .85, about: detail.about ?? null });
      break;
    case 'bond':
      feel(agent, 'joy', .45);
      recordEpisode(sim, agent, { type: 'family', text: `Began a shared life with ${name}.`, valence: .85, salience: .85, about: detail.about ?? null });
      break;
    case 'belonging':
      feel(agent, 'joy', .2);
      recordEpisode(sim, agent, { type: 'community', text: detail.text, valence: .6, salience: .55 });
      break;
    case 'departure':
      feel(agent, 'anger', .2); feel(agent, 'grief', .15);
      recordEpisode(sim, agent, { type: 'community', text: detail.text, valence: -.5, salience: .6 });
      break;
    case 'raid':
      feel(agent, 'fear', .4); feel(agent, 'anger', .3);
      recordEpisode(sim, agent, { type: 'war', text: `Wounded when ${name} raided us.`, valence: -.85, salience: .8 });
      break;
    case 'victory':
      feel(agent, 'pride', .4); feel(agent, 'joy', .3); feel(agent, 'fear', -.2);
      recordEpisode(sim, agent, { type: 'war', text: detail.text, valence: .6, salience: .75 });
      break;
    case 'defeat':
      feel(agent, 'grief', .3); feel(agent, 'anger', .35); feel(agent, 'pride', -.3);
      recordEpisode(sim, agent, { type: 'war', text: detail.text, valence: -.8, salience: .85 });
      break;
    case 'peace':
      feel(agent, 'joy', .25); feel(agent, 'fear', -.3);
      recordEpisode(sim, agent, { type: 'war', text: detail.text, valence: .3, salience: .6 });
      break;
    case 'exile':
      feel(agent, 'grief', .35); feel(agent, 'fear', .2);
      recordEpisode(sim, agent, { type: 'hardship', text: detail.text, valence: -.7, salience: .85 });
      break;
    case 'discovery': {
      // The first discoveries are formative; later ones become part of the routine.
      const novelty = 1 / (1 + agent.psyche.record.discovered * .25);
      feel(agent, 'pride', .45 * novelty); feel(agent, 'joy', .2 * novelty); agent.psyche.record.discovered++;
      recordEpisode(sim, agent, { type: 'discovery', text: `Helped bring ${name} into the world.`, valence: .6 + .25 * novelty, salience: .2 + .6 * novelty, activity: detail.activity || 'invent' });
      break;
    }
    case 'failure':
      feel(agent, 'anger', .12); feel(agent, 'pride', -.1);
      recordEpisode(sim, agent, { type: 'setback', text: `Our trial of ${name} failed and used up the materials.`, valence: -.5, salience: .45, activity: detail.activity || 'invent' });
      break;
    case 'gift':
      feel(agent, 'joy', .006);
      break;
    case 'catastrophe':
      feel(agent, 'fear', .6); feel(agent, 'grief', .4); feel(agent, 'joy', -.3);
      recordEpisode(sim, agent, { type: 'disaster', text: detail.text, valence: -.95, salience: .95 });
      break;
  }
}

// ——— social cognition ———

function relationOf(agent, otherId) { return agent._relations?.find(relation => relation.id === otherId) || null; }
/** Trust defaults from familiarity until experience says otherwise. */
export function trustIn(agent, otherId) {
  const relation = relationOf(agent, otherId);
  if (!relation) return .4;
  return relation.trust ?? clamp(.42 + relation.strength * .2);
}
function adjustTrust(agent, otherId, delta) {
  const relation = relationOf(agent, otherId);
  if (relation) relation.trust = round(clamp(trustIn(agent, otherId) + delta));
  return relation;
}

/** Called on every encounter: people notice what their acquaintances are good at. */
export function acquaint(agent, other, relation) {
  if (!agent.psyche || !relation) return;
  if (relation.trust === undefined) relation.trust = round(clamp(.42 + relation.strength * .2));
  let best = SKILL_IDS[0];
  for (const skill of SKILL_IDS) if (other.skills[skill] > other.skills[best]) best = skill;
  if (other.skills[best] >= 30) relation.expertise = best;
}

/** Gratitude: gifts and lessons build trust and a remembered debt. */
export function appreciate(agent, benefactor, amount = 1) {
  const relation = adjustTrust(agent, benefactor.id, .035 * amount);
  if (relation) relation.favors = round(clamp((relation.favors || 0) + amount, -50, 50));
  appraise(null, agent, 'gift');
}

/** Find an acquaintance nearby who is known to be good at a skill. */
export function knownExpert(sim, agent, skill, radius = 16) {
  let best = null, bestScore = 0;
  for (const relation of agent._relations || []) {
    if (relation.expertise !== skill) continue;
    const other = sim._agentMap.get(relation.id);
    if (!other || distance(agent, other) > radius || other.skills[skill] <= agent.skills[skill] + 5) continue;
    const score = trustIn(agent, other.id) + relation.strength;
    if (score > bestScore) { bestScore = score; best = other; }
  }
  return best;
}

// ——— techniques ———

export function knowsTechnique(agent, id) { return !!agent.psyche?.techniques.some(entry => entry.id === id); }

/** Multiplier for one quantity from every technique this person holds.
 * Techniques are only ever added, so their count identifies the cached product. */
const factorCache = new WeakMap();
export function techniqueFactor(agent, key) {
  const techniques = agent?.psyche?.techniques;
  if (!techniques?.length) return 1;
  let cached = factorCache.get(techniques);
  if (cached?.count !== techniques.length) {
    cached = { count: techniques.length, factors: {} };
    for (const entry of techniques) for (const [name, value] of Object.entries(techniqueById.get(entry.id)?.effect || {})) cached.factors[name] = (cached.factors[name] ?? 1) * value;
    factorCache.set(techniques, cached);
  }
  return cached.factors[key] ?? 1;
}

function acquireTechnique(sim, agent, technique, source, teacher = null) {
  const entry = { id: technique.id, day: sim.day, source };
  if (teacher) { entry.teacherId = teacher.id; entry.teacher = teacher.name; }
  agent.psyche.techniques.push(entry);
  feel(agent, 'pride', source === 'practice' ? .35 : .15); feel(agent, 'joy', .1);
  recordEpisode(sim, agent, { type: 'technique', text: source === 'practice' ? `Worked out ${technique.name.toLowerCase()} through my own practice.` : `Learned ${technique.name.toLowerCase()} from ${teacher.name}.`, valence: .7, salience: source === 'practice' ? .75 : .55, activity: SKILL_ACTIVITIES[technique.skill][0] });
  if (source === 'practice') {
    sim.psyche.techniquesDiscovered++;
    if (!sim.psyche.firsts.includes(technique.id)) {
      sim.psyche.firsts.push(technique.id);
      sim._event('technology', `${agent.name} is the first to work out ${technique.name.toLowerCase()}. ${technique.description}`, { agentId: agent.id, ...(agent.groupId ? { groupId: agent.groupId } : {}) });
    }
  } else sim.psyche.techniquesTaught++;
}

/** A sudden insight (an act of god): the person grasps the next technique in their
 * most promising skill, whatever their proficiency. Returns the technique or null. */
export function inspire(sim, agent) {
  if (!agent.psyche) return null;
  const skills = [...SKILL_IDS].sort((a, b) => agent.psyche.talents[b] * (agent.skills[b] + 10) - agent.psyche.talents[a] * (agent.skills[a] + 10));
  for (const skill of skills) {
    const technique = TECHNIQUES.find(candidate => candidate.skill === skill && !knowsTechnique(agent, candidate.id) && (!candidate.requires || knowsTechnique(agent, candidate.requires)));
    if (technique) { acquireTechnique(sim, agent, technique, 'practice'); return technique; }
  }
  return null;
}

function eligible(agent, technique, discount = 1) {
  return !knowsTechnique(agent, technique.id) && (!technique.requires || knowsTechnique(agent, technique.requires)) && agent.skills[technique.skill] >= technique.threshold * discount;
}

// ——— aspirations ———

function progressValue(sim, agent, aspiration) {
  const psyche = agent.psyche, record = psyche.record;
  switch (aspiration.kind) {
    case 'grow': return clamp(agent.age / 14);
    case 'mastery': return clamp(agent.skills[aspiration.skill] / aspiration.target);
    case 'discovery': return clamp((record.discovered - aspiration.base) / aspiration.target);
    case 'family': return clamp((agent.partnerId ? .34 : 0) + Math.min(aspiration.target, agent.children.length - aspiration.base) / aspiration.target * .66);
    case 'leadership': {
      // Needs both: many people who trust them deeply, and real organising skill.
      const trusted = (agent._relations || []).filter(relation => (relation.trust ?? 0) > .72).length;
      return clamp(Math.min(1, trusted / aspiration.target) * .5 + Math.min(1, agent.skills.leadership / 45) * .5);
    }
    case 'provider': return clamp((record.provided - aspiration.base) / aspiration.target);
    case 'healer': return clamp((record.healed - aspiration.base) / aspiration.target);
    case 'mentor': return clamp((record.taught - aspiration.base) / aspiration.target);
    case 'wanderer': return clamp((popcount(psyche.visited) - aspiration.base) / aspiration.target);
    case 'pioneer': return clamp((record.founded - aspiration.base) / aspiration.target);
  }
  return 0;
}

function popcount(bits) { let count = 0; for (let value = bits >>> 0; value; value &= value - 1) count++; return count; }

function aspirationOf(sim, agent, kind, skill = null) {
  const psyche = agent.psyche, record = psyche?.record || {};
  const achieved = psyche?.aspiration?.achieved || 0;
  const aspiration = { kind, text: ASPIRATIONS[kind].label, since: sim.day, base: 0, target: 1, progress: 0, achieved };
  switch (kind) {
    case 'mastery': {
      aspiration.skill = skill;
      aspiration.target = agent.skills[skill] >= 55 ? 85 : 60;
      aspiration.text = `Become a ${aspiration.target >= 85 ? 'renowned' : 'master'} ${SKILL_NOUN[skill]}`;
      break;
    }
    // Each goal already achieved raises the bar for the next one.
    case 'discovery': aspiration.base = record.discovered; aspiration.target = 4 * (1 + achieved); break;
    case 'family': aspiration.base = agent.children.length; aspiration.target = 2; break;
    case 'leadership': aspiration.target = Math.min(12, 6 + achieved * 2); break;
    case 'provider': aspiration.base = record.provided; aspiration.target = 60 * (1 + achieved); break;
    case 'healer': aspiration.base = record.healed; aspiration.target = 150 * (1 + achieved); break;
    case 'mentor': aspiration.base = record.taught; aspiration.target = 30 * (1 + achieved); break;
    case 'wanderer': aspiration.base = popcount(psyche.visited); aspiration.target = 3; break;
    case 'pioneer': aspiration.base = record.founded || 0; aspiration.target = 1; break;
  }
  aspiration.base = round(aspiration.base);
  if (psyche) aspiration.progress = round(progressValue(sim, agent, aspiration));
  aspiration.start = aspiration.progress;
  return aspiration;
}

/** Life goals weigh values, personality, talent and life stage. */
function chooseAspiration(sim, agent, exclude = null) {
  const p = agent.psyche.personality, t = agent.psyche.talents, v = agent.mind.values, mind = agent.mind;
  let masterySkill = SKILL_IDS[0], masteryScore = -1;
  for (const skill of SKILL_IDS) {
    const score = t[skill] * (agent.skills[skill] + 12);
    if (score > masteryScore && agent.skills[skill] < 85) { masteryScore = score; masterySkill = skill; }
  }
  const options = [
    ['mastery', v.mastery * 1.1 + p.conscientiousness * .6],
    ['discovery', agent.traits.curiosity * .7 + p.openness * .8 + mind.ambition * .4],
    ['family', agent.age < 44 && agent.children.length < 4 ? v.belonging * .7 + v.care * .6 + p.agreeableness * .4 : 0],
    ['leadership', mind.ambition * .8 + p.extraversion * .8 + agent.skills.leadership / 100],
    ['provider', v.security * 1.1 + v.care * .4],
    ['healer', v.care * .8 + p.agreeableness * .5 + (t.medicine - 1) * .6],
    ['mentor', v.care * .5 + p.extraversion * .4 + agent.skills.scholarship / 80],
    ['wanderer', v.autonomy * 1 + p.openness * .5 - p.neuroticism * .3],
    ['pioneer', agent.age < 50 ? (agent.psyche.expansion ?? .4) * 1.3 + v.autonomy * .3 - .2 : 0],
  ];
  let best = 'mastery', bestScore = -Infinity;
  for (const [kind, weight] of options) {
    if (kind === exclude || weight <= 0) continue;
    const score = weight * (.6 + sim._random() * .8);
    if (score > bestScore) { bestScore = score; best = kind; }
  }
  return aspirationOf(sim, agent, best, masterySkill);
}

// ——— deliberation ———

const RISKY = new Set(['mine', 'quarry', 'trade', 'invent', 'hunt', 'prospect', 'pioneer', 'colliery', 'uranium', 'enrich']);
const SAFE = new Set(['farm', 'basic', 'build', 'study', 'herd', 'weave']);
const WITHDRAWN = new Set(['reflect', 'basic']);
const OUTGOING = new Set(['teach', 'trade', 'reflect', 'heal']);
const AMBITIOUS = new Set(['invent', 'research', 'build', 'teach']);
const PHYSICAL = new Set(['lumber', 'quarry', 'mine', 'dig', 'hunt', 'colliery', 'uranium']);
const CARING = new Set(['teach', 'heal', 'reflect']);

function personalityFit(p, action) {
  switch (action) {
    case 'research': case 'invent': return p.openness - .5;
    case 'teach': case 'trade': return p.extraversion - .5;
    case 'reflect': return (p.openness + p.agreeableness) / 2 - .5;
    case 'heal': return p.agreeableness - .5;
    case 'farm': case 'craft': case 'build': case 'pottery': case 'smelt': case 'manufacture': case 'assemble': return p.conscientiousness - .5;
    case 'mine': case 'quarry': return .2 - p.neuroticism * .4;
  }
  return 0;
}

/** Everything about this person that bears on one option, as a score adjustment.
 * With `labels`, also records each named factor so observers can see why;
 * label text is only built when requested because this runs for every option daily. */
function weigh(sim, agent, context, action, labels = null) {
  const psyche = agent.psyche, p = psyche.personality, mood = psyche.mood, aspiration = psyche.aspiration;
  let total = 0;
  const push = (value, label) => {
    if (Math.abs(value) < .25) return;
    value = round(value); total += value;
    if (labels) { const text = typeof label === 'function' ? label() : label; labels.push({ label: text.length > 120 ? `${text.slice(0, 119)}…` : text, value }); }
  };
  const liking = psyche.preferences[action];
  if (liking !== undefined) push(liking * 5, liking >= 0 ? 'Enjoys this work' : 'Dislikes this work');
  const expected = psyche.expectations[action];
  if (expected !== undefined) push(expected * 6 * (.6 + p.conscientiousness * .4), expected >= 0 ? 'Has worked well before' : 'Went badly before');
  else if (action !== 'basic') push(p.openness * 3, 'Curious to try it');
  if (context.serves.includes(action)) push(2 + 6 * agent.mind.ambition * (1 - aspiration.progress * .5), () => `Aspiration: ${lower(aspiration.text)}`);
  if (RISKY.has(action)) push(-mood.fear * 12, 'Afraid of the risk');
  else if (SAFE.has(action)) push(mood.fear * 6, 'Wants safety');
  if (WITHDRAWN.has(action)) push(mood.grief * 9, 'Needs time to grieve');
  else if (action === 'trade' || action === 'invent' || action === 'research') push(-mood.grief * 6, 'Grief saps focus');
  if (CARING.has(action)) push(-mood.anger * 8, 'Too angry to be patient');
  else if (PHYSICAL.has(action)) push(mood.anger * 4, 'Channels frustration');
  if (OUTGOING.has(action)) push((mood.joy - .3) * 5, 'In good spirits');
  if (AMBITIOUS.has(action)) push(mood.pride * 3, 'Confident from success');
  const skill = ACTIVITY_SKILL[action];
  if (skill && action !== 'basic') {
    const known = context.techniques[skill] || 0;
    if (known) push(Math.min(2, known) * 2, () => `Knows ${known} ${skill} technique${known > 1 ? 's' : ''}`);
    push((psyche.talents[skill] - 1) * 6, 'Natural talent');
  }
  // Vivid memories: setbacks deter more strongly than triumphs encourage (negativity bias).
  const vivid = context.vivid[action];
  if (vivid) push(vivid.valence * vivid.salience * (vivid.valence < 0 ? 5 : 2.5) * (.5 + p.neuroticism), () => `Remembers: ${lower(vivid.text.replace(/\.$/, ''))}`);
  if (context.committed === action) push(p.conscientiousness * 2, 'Committed to the plan');
  // Shared norms and, in hierarchical societies, the leader's ambitions.
  for (const entry of context.culture?.[action] || []) push(entry.value, entry.label);
  const leader = context.culture?.leader;
  if (leader) {
    const wants = leader.aspiration.kind === 'mastery' ? SKILL_ACTIVITIES[leader.aspiration.skill] : ASPIRATIONS[leader.aspiration.kind].serves;
    if (wants.includes(action)) push(leader.weight, () => `Our leader ${leader.name} wants to ${lower(leader.aspiration.text)}`);
  }
  if (action === 'pioneer') push((psyche.expansion - .4) * 20, 'Drawn to new lands');
  return total;
}

// Deliberation and its explanation share one context per person per day.
const contexts = new WeakMap();
function deliberationContext(sim, agent) {
  const cached = contexts.get(agent);
  if (cached?.day === sim.day && cached.episodes === agent.psyche.episodes.length && cached.known === agent.psyche.techniques.length) return cached;
  const psyche = agent.psyche, aspiration = psyche.aspiration;
  const techniques = {}, vivid = {};
  for (const entry of psyche.techniques) { const skill = techniqueById.get(entry.id)?.skill; if (skill) techniques[skill] = (techniques[skill] || 0) + 1; }
  for (const episode of psyche.episodes) {
    if (episode.activity && episode.salience >= .3 && (!vivid[episode.activity] || episode.salience > vivid[episode.activity].salience)) vivid[episode.activity] = episode;
  }
  const serves = aspiration ? aspiration.kind === 'mastery' ? SKILL_ACTIVITIES[aspiration.skill] : ASPIRATIONS[aspiration.kind].serves : [];
  const committed = sim.day < agent.mind.plan.until ? agent.mind.policy.action : null;
  const context = { day: sim.day, episodes: psyche.episodes.length, known: psyche.techniques.length, techniques, vivid, serves, committed, culture: culturalPull(sim, agent) };
  contexts.set(agent, context);
  return context;
}

/** Adjusts every option's utility by who this person is; mutates choices in place. */
export function deliberate(sim, agent, choices) {
  if (!agent.psyche) return;
  const context = deliberationContext(sim, agent);
  for (const choice of choices) {
    choice.base = choice.score;
    choice.score += weigh(sim, agent, context, choice.action);
  }
}

/** Keeps the leading alternatives with their largest reasons (call before the policy changes).
 * Refreshed whenever the decision changes, and at least every five days otherwise. */
export function recordReasoning(sim, agent, sorted) {
  if (!agent.psyche) return;
  const current = agent.psyche.reasoning;
  if (current.length && current[0].action === sorted[0].action && (sim.day + agent.id) % 5) return;
  const context = deliberationContext(sim, agent);
  agent.psyche.reasoning = sorted.slice(0, LIMITS.reasoning).map(choice => {
    const factors = [];
    weigh(sim, agent, context, choice.action, factors);
    factors.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    return { action: choice.action, score: round(choice.score), base: round(choice.base ?? choice.score), factors: factors.slice(0, LIMITS.factors) };
  });
}

/** Survival overrides and independent life bypass the weighed policy. */
export function clearReasoning(agent) {
  if (agent.psyche) agent.psyche.reasoning = [];
}

/** Reinforcement: outcomes update learned expectations and slowly shape taste. */
export function reinforce(sim, agent, action, outcome) {
  const psyche = agent.psyche;
  if (!psyche || !ACTIVITIES.includes(action) || !Number.isFinite(outcome)) return;
  const p = psyche.personality;
  const previous = psyche.expectations[action] ?? 0;
  // Loss aversion (Tversky & Kahneman 1992): a bad outcome weighs about 2.25 times a good one.
  const felt = outcome < 0 ? outcome * 2.25 : outcome;
  psyche.expectations[action] = round(clamp(previous + (clamp(felt, -1, 1) - previous) * (.12 + p.openness * .08), -1, 1));
  const skill = ACTIVITY_SKILL[action];
  const competence = skill ? (agent.skills[skill] - 30) / 70 : 0;
  const target = clamp(outcome, -1, 1) * .45 + personalityFit(p, action) * .6 + competence * .3;
  const liking = psyche.preferences[action] ?? 0;
  psyche.preferences[action] = round(clamp(liking + (target - liking) * .03, -1, 1));
  if (outcome >= .95) feel(agent, 'pride', .05);
  else if (outcome <= -.5) feel(agent, 'anger', .03);
}

// ——— daily life ———

/** Cheap daily upkeep: emotions decay, bodily states raise fear or contentment. */
export function livePsyche(sim, agent) {
  const psyche = agent.psyche;
  if (!psyche) return;
  const p = psyche.personality, mood = psyche.mood;
  const decay = .035 * (1.25 - p.neuroticism * .6);
  mood.joy = round(clamp(mood.joy + ((.2 + p.extraversion * .15) - mood.joy) * decay * 1.6));
  mood.pride = round(mood.pride * (1 - decay * 1.4));
  mood.fear = round(mood.fear * (1 - decay * 1.2));
  mood.anger = round(mood.anger * (1 - decay));
  mood.grief = round(mood.grief * (1 - decay * .35));
  if (agent.hunger > 55) feel(agent, 'fear', .025 * (agent.hunger - 55) / 45);
  if (agent.health < 35) feel(agent, 'fear', .02);
  if (agent.social > 70 && agent.hunger < 30) feel(agent, 'joy', .002);
  if (agent.hunger > 70 && !psyche.episodes.some(episode => episode.type === 'hardship' && sim.day - episode.day < 120)) {
    recordEpisode(sim, agent, { type: 'hardship', text: 'Went hungry for days with no food to be found.', valence: -.8, salience: .7, activity: 'basic' });
  }
  if (sim.day % 10 === agent.id % 10 && sim.regions?.length) {
    let nearest = 0, best = Infinity;
    for (let i = 0; i < sim.regions.length; i++) { const d = distance(agent, sim.regions[i]); if (d < best) { best = d; nearest = i; } }
    if (best < 18 && nearest < 30) psyche.visited = (psyche.visited | (1 << nearest)) >>> 0;
  }
  if (sim.day % 30 === (agent.id + 15) % 30) reflect(sim, agent);
}

/** Monthly reflection: consolidate memory, pursue or revise life goals, learn by practice. */
export function reflect(sim, agent) {
  const psyche = agent.psyche, p = psyche.personality;
  psyche.lastReflection = sim.day;
  // Formative (strongly emotional) memories fade over decades; ordinary ones over seasons.
  const retention = .9 + p.conscientiousness * .06, formative = .975 + p.conscientiousness * .015;
  psyche.episodes = psyche.episodes.filter(episode => {
    episode.salience = round(episode.salience * (Math.abs(episode.valence) >= .8 ? formative : retention));
    return episode.salience >= .06;
  });
  psyche.places = psyche.places.filter(place => {
    if (sim.day - place.day > 480) place.value = round(place.value * .8);
    return place.value >= .1;
  });
  // Use it or lose it: proficiency above a basic floor fades without practice,
  // so people who keep working at a skill become its specialists.
  for (const skill of SKILL_IDS) {
    if ((psyche.practice[skill] || 0) < .5 && agent.skills[skill] > 15) agent.skills[skill] = Math.max(15, agent.skills[skill] - (agent.skills[skill] - 15) * .03);
  }
  psyche.practice = {};
  // Pioneering drive drifts toward temperament, felt crowding and the culture's outlook.
  const culture = sim._groupMap?.get(agent.groupId)?.civilization.culture;
  const target = clamp(temperamentalDrive(agent) + (culture?.pressure ?? 0) * .3 + ((culture?.norms.expansion ?? .45) - .45) * .3);
  psyche.expansion = round(clamp(psyche.expansion + (target - psyche.expansion) * .08));
  // Enculturation: the young and newcomers absorb their society's values.
  if (culture && (agent.age < 18 || agent._homeDays < 720)) {
    const rate = agent.age < 18 ? .03 : .012, n = culture.norms, values = agent.mind.values;
    const pull = (key, norm) => { values[key] = clamp(values[key] + (norm - values[key]) * rate); };
    pull('belonging', n.collectivism); pull('care', (n.collectivism + n.piety) / 2); pull('mastery', n.innovation);
    pull('security', (n.hierarchy + n.tradition) / 2); pull('autonomy', n.expansion);
  }
  // Self-discovery is rare; most people acquire techniques from others.
  for (const technique of TECHNIQUES) {
    if (!eligible(agent, technique)) continue;
    const chance = .008 * (1 + (agent.skills[technique.skill] - technique.threshold) / 30) * (.5 + p.openness) * psyche.talents[technique.skill];
    if (sim._random() < chance) { acquireTechnique(sim, agent, technique, 'practice'); break; }
  }
  let aspiration = psyche.aspiration;
  if (aspiration.kind === 'grow' && agent.age >= 14) aspiration = psyche.aspiration = chooseAspiration(sim, agent, 'grow');
  aspiration.progress = round(progressValue(sim, agent, aspiration));
  if (aspiration.progress >= 1 && aspiration.kind !== 'grow') {
    feel(agent, 'pride', .5); feel(agent, 'joy', .3);
    recordEpisode(sim, agent, { type: 'aspiration', text: `Achieved a life goal: ${lower(aspiration.text)}.`, valence: 1, salience: .95 });
    sim.psyche.aspirationsAchieved++;
    aspiration.achieved++;
    psyche.aspiration = chooseAspiration(sim, agent, aspiration.kind === 'mastery' ? null : aspiration.kind);
  } else if (aspiration.kind !== 'grow' && sim.day - aspiration.since > 360 && aspiration.progress - aspiration.start < .15 && sim._random() < (1 - agent.mind.patience) * .4) {
    feel(agent, 'anger', .12); feel(agent, 'grief', .08);
    recordEpisode(sim, agent, { type: 'aspiration', text: `Gave up hoping to ${aspiration.text.charAt(0).toLowerCase()}${aspiration.text.slice(1)}.`, valence: -.5, salience: .6 });
    psyche.aspiration = chooseAspiration(sim, agent, aspiration.kind);
  }
  psyche.thought = innerVoice(sim, agent);
}

/** A one-line inner monologue generated from the state that is driving behaviour. */
function innerVoice(sim, agent) {
  const psyche = agent.psyche, mood = psyche.mood, aspiration = psyche.aspiration;
  const strongest = type => psyche.episodes.filter(episode => !type || episode.type === type).sort((a, b) => b.salience - a.salience)[0];
  if (mood.grief > .45) {
    const loss = strongest('loss');
    return loss ? `I keep thinking about it: ${loss.text.charAt(0).toLowerCase()}${loss.text.slice(1)}` : 'Loss weighs on me.';
  }
  if (mood.fear > .5) return agent.hunger > 50 ? 'If the food runs out, what happens to us?' : 'This place does not feel safe any more.';
  if (mood.anger > .45) {
    const setback = psyche.episodes.filter(episode => episode.valence < 0).sort((a, b) => b.day - a.day)[0];
    return setback ? `I am still angry: ${setback.text.charAt(0).toLowerCase()}${setback.text.slice(1)}` : 'Things keep going wrong.';
  }
  if (aspiration && aspiration.kind !== 'grow' && aspiration.progress >= .75) return `I am close. Soon I will ${aspiration.text.charAt(0).toLowerCase()}${aspiration.text.slice(1)}.`;
  if (mood.pride > .4) {
    const success = psyche.episodes.filter(episode => episode.valence > .5).sort((a, b) => b.day - a.day)[0];
    if (success) return `${success.text.replace(/\.$/, '')}. I am proud of that.`;
  }
  let best = null, worst = null;
  for (const [action, value] of Object.entries(psyche.expectations)) {
    if (!best || value > psyche.expectations[best]) best = action;
    if (!worst || value < psyche.expectations[worst]) worst = action;
  }
  if (worst && psyche.expectations[worst] < -.3) {
    const skill = ACTIVITY_SKILL[worst], expert = skill ? knownExpert(sim, agent, skill, 40) : null;
    return `${capital(ACTIVITY_LABEL[worst])} keeps failing me.${expert ? ` Maybe ${expert.name} could teach me.` : ' I should try something else.'}`;
  }
  if (best && psyche.expectations[best] > .4) return `${capital(ACTIVITY_LABEL[best])} has served me well; I will keep at it.`;
  return aspiration ? `One day I want to ${aspiration.text.charAt(0).toLowerCase()}${aspiration.text.slice(1)}.` : 'I should find my place in this world.';
}
const capital = text => text.charAt(0).toUpperCase() + text.slice(1);
function lower(text) { return text.charAt(0).toLowerCase() + text.slice(1); }

// ——— spatial memory ———

export function rememberPlace(sim, agent, kind, x, y, value) {
  const psyche = agent.psyche;
  if (!psyche || !PLACE_KINDS.includes(kind)) return;
  // Remembered places always lie on the map, even when surveyed from its edge.
  x = clamp(x, .5, sim.width - .5); y = clamp(y, .5, sim.height - .5);
  const places = psyche.places;
  // Nearby finds refine one landmark; each kind keeps at most three, the best places win.
  const existing = places.find(place => place.kind === kind && Math.hypot(place.x - x, place.y - y) < 10);
  if (existing) { existing.value = round(clamp(value)); existing.day = sim.day; existing.x = round(x); existing.y = round(y); return; }
  if (value < .35) return;
  places.push({ kind, x: round(x), y: round(y), value: round(clamp(value)), day: sim.day });
  const same = places.filter(place => place.kind === kind);
  const crowded = same.length > 3 ? same : places.length > LIMITS.places ? places : null;
  if (crowded) {
    let weakest = crowded[0];
    for (const place of crowded) if (place.value < weakest.value) weakest = place;
    places.splice(places.indexOf(weakest), 1);
  }
}

/** Best remembered place of a kind within reach, weighed by distance. */
export function recallPlace(agent, kind, reach = 30) {
  let best = null, bestScore = 0;
  for (const place of agent.psyche?.places || []) {
    if (place.kind !== kind) continue;
    const d = Math.hypot(place.x - agent.x, place.y - agent.y);
    if (d > reach || d < 1.5) continue;
    const score = place.value / (1 + d * .05);
    if (score > bestScore) { bestScore = score; best = place; }
  }
  return best;
}

/** Arriving somewhere remembered updates the memory with what is really there. */
export function revisitPlace(sim, agent, kind, value) {
  for (const place of agent.psyche?.places || []) {
    if (place.kind === kind && Math.hypot(place.x - agent.x, place.y - agent.y) < 2.5) {
      place.value = round(clamp(value)); place.day = sim.day;
      if (value < .15) feel(agent, 'anger', .02);
    }
  }
}

// ——— conversation ———

function nearestRegion(sim, point) {
  let best = null, closest = Infinity;
  for (const region of sim.regions || []) { const d = distance(region, point); if (d < closest) { closest = d; best = region; } }
  return best;
}

/** Emotional contagion and mediation happen in every exchange. */
export function attune(speaker, listener) {
  if (!speaker.psyche || !listener.psyche) return;
  const rate = .04 + listener.psyche.personality.agreeableness * .04;
  for (const emotion of ['joy', 'fear']) listener.psyche.mood[emotion] = round(clamp(listener.psyche.mood[emotion] + (speaker.psyche.mood[emotion] - listener.psyche.mood[emotion]) * rate));
  if (knowsTechnique(speaker, 'mediation')) listener.psyche.mood.anger = round(listener.psyche.mood.anger * .8);
}

/** Teaching practical techniques. Returns a message or null. */
export function teachTechnique(sim, speaker, listener, trust, deliberate) {
  if (!speaker.psyche?.techniques.length || !listener.psyche) return null;
  // A pupil needs real grounding in the skill: nearly the discovery threshold for
  // basic techniques, and the full threshold for advanced ones.
  const candidates = speaker.psyche.techniques.map(entry => techniqueById.get(entry.id)).filter(technique => technique && eligible(listener, technique, technique.requires ? 1 : .85));
  if (!candidates.length) return null;
  const technique = candidates[Math.floor(sim._random() * candidates.length)];
  const chance = trust * (deliberate ? .45 : .08) * techniqueFactor(speaker, 'teach') * (.6 + listener.psyche.personality.openness * .6);
  if (sim._random() >= chance) return null;
  acquireTechnique(sim, listener, technique, 'taught', speaker);
  speaker.psyche.record.taught++;
  feel(speaker, 'pride', .08);
  appreciate(listener, speaker);
  const relation = relationOf(listener, speaker.id);
  if (relation) relation.expertise = technique.skill;
  return { kind: 'technique', techniqueId: technique.id, name: technique.name.toLowerCase(), text: `Taught ${technique.name.toLowerCase()} to ${listener.name}. ${technique.description}` };
}

/** Everyday talk: remembered places, practical advice, and opinions of others. */
export function converse(sim, speaker, listener, trust) {
  const sp = speaker.psyche, lp = listener.psyche;
  if (!sp || !lp) return null;
  const roll = sim._random();
  // Directions to a resource the listener does not know about.
  if (roll < .4 && sp.places.length) {
    const place = sp.places.filter(candidate => candidate.value >= .4 && !lp.places.some(known => known.kind === candidate.kind && Math.hypot(known.x - candidate.x, known.y - candidate.y) < 6)).sort((a, b) => b.value - a.value)[0];
    if (place && sim._random() < trust + .2) {
      rememberPlace(sim, listener, place.kind, place.x, place.y, place.value * (.6 + trust * .3));
      const region = nearestRegion(sim, place);
      return { kind: 'resource', text: `Described ${place.value > .7 ? 'rich' : 'useful'} ${place.kind === 'food' ? 'foraging ground' : place.kind === 'wood' ? 'woodland' : `${place.kind} deposits`} near ${region ? region.name : 'the settlement'}; ${listener.name} will remember the way.` };
    }
  }
  // Advice distilled from experience changes the listener's expectations.
  if (roll < .75) {
    let action = null, strength = 0;
    for (const [candidate, value] of Object.entries(sp.expectations)) {
      if (Math.abs(value) < .3) continue;
      const gap = Math.abs(value - (lp.expectations[candidate] ?? 0));
      if (gap > .25 && gap > strength) { strength = gap; action = candidate; }
    }
    if (action) {
      const value = sp.expectations[action], before = lp.expectations[action] ?? 0;
      lp.expectations[action] = round(clamp(before + (value - before) * .3 * trust, -1, 1));
      sim.psyche.adviceShared++;
      return { kind: 'advice', text: value > 0 ? `Told ${listener.name} that ${ACTIVITY_LABEL[action]} has paid off for them.` : `Warned ${listener.name} that ${ACTIVITY_LABEL[action]} rarely pays off.` };
    }
  }
  // Gossip: reputations spread through trusted acquaintances.
  const mutual = (speaker._relations || []).filter(relation => relation.id !== listener.id && relationOf(listener, relation.id));
  if (!mutual.length) return null;
  const topic = mutual[Math.floor(sim._random() * mutual.length)];
  const subject = sim._agentMap.get(topic.id);
  if (!subject) return null;
  const opinion = trustIn(speaker, subject.id), heard = relationOf(listener, subject.id);
  heard.trust = round(clamp(trustIn(listener, subject.id) + (opinion - trustIn(listener, subject.id)) * .25 * trust));
  if (topic.expertise && !heard.expertise) heard.expertise = topic.expertise;
  sim.psyche.gossip++;
  const skill = topic.expertise ? `, a capable ${SKILL_NOUN[topic.expertise]}` : '';
  return { kind: 'gossip', about: subject.id, text: opinion > .6 ? `Spoke highly of ${subject.name}${skill}.` : opinion < .35 ? `Warned ${listener.name} not to rely on ${subject.name}.` : `Talked about ${subject.name}${skill}.` };
}

// ——— accessors ———

export function moodBalance(agent) {
  const mood = agent.psyche?.mood;
  return mood ? (mood.joy - .3) * 10 + mood.pride * 4 - mood.grief * 14 - mood.fear * 9 - mood.anger * 6 : 0;
}

export function psycheStats(sim) {
  const state = sim.psyche;
  let known = 0;
  for (const agent of sim.agents) known += agent.psyche?.techniques.length || 0;
  return { techniquesKnown: known, techniquesDiscovered: state.techniquesDiscovered, techniquesTaught: state.techniquesTaught, aspirationsAchieved: state.aspirationsAchieved, adviceShared: state.adviceShared, gossip: state.gossip };
}

export function techniqueName(id) { return techniqueById.get(id)?.name || id; }
export function activityLabel(action) { return ACTIVITY_LABEL[action] || action; }

// ——— strict restore ———

const invalid = field => { throw new Error(`Invalid psyche save: ${field}.`); };
const object = (value, field) => { if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(field); return value; };
const num = (value, field, min = 0, max = 1, integer = false) => { if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isSafeInteger(value))) invalid(field); return value; };
const str = (value, field, max = 300) => { if (typeof value !== 'string' || !value.length || value.length > max) invalid(field); return value; };
const list = (value, field, max) => { if (!Array.isArray(value) || value.length > max) invalid(field); return value; };
const fixed = (value, keys, field, min, max) => { object(value, field); return Object.fromEntries(keys.map(key => [key, num(value[key], `${field}.${key}`, min, max)])); };
const sparse = (value, field) => {
  object(value, field);
  const result = {};
  for (const [key, entry] of Object.entries(value)) { if (!ACTIVITIES.includes(key)) invalid(`${field} activity`); result[key] = num(entry, field, -1, 1); }
  return result;
};

function skillMap(value) {
  object(value, 'practice');
  const result = {};
  for (const [key, entry] of Object.entries(value)) { if (!SKILL_IDS.includes(key)) invalid('practice skill'); result[key] = num(entry, 'practice amount', 0, 1e9); }
  return result;
}

export function restoreGlobalPsyche(raw) {
  object(raw, 'global psyche');
  const state = {};
  for (const key of ['techniquesDiscovered', 'techniquesTaught', 'aspirationsAchieved', 'adviceShared', 'gossip']) state[key] = num(raw[key], key, 0, 1e15, true);
  state.firsts = list(raw.firsts, 'first discoveries', TECHNIQUES.length).map(id => { if (!techniqueById.has(id)) invalid('first technique'); return id; });
  if (new Set(state.firsts).size !== state.firsts.length) invalid('duplicate first technique');
  return state;
}

export function restorePsyche(rawAgent, sim) {
  const raw = object(rawAgent.psyche, 'psyche');
  const techniques = list(raw.techniques, 'techniques', TECHNIQUES.length).map(entry => {
    object(entry, 'technique');
    if (!techniqueById.has(entry.id)) invalid('technique ID');
    if (!['practice', 'taught'].includes(entry.source)) invalid('technique source');
    const restored = { id: entry.id, day: num(entry.day, 'technique day', 0, sim.day, true), source: entry.source };
    if (entry.source === 'taught') { restored.teacherId = num(entry.teacherId, 'teacher', 1, sim.nextAgentId - 1, true); restored.teacher = str(entry.teacher, 'teacher name', 80); }
    return restored;
  });
  if (new Set(techniques.map(entry => entry.id)).size !== techniques.length) invalid('duplicate technique');
  for (const entry of techniques) { const requires = techniqueById.get(entry.id).requires; if (requires && !techniques.some(other => other.id === requires)) invalid('technique prerequisite'); }
  const episodes = list(raw.episodes, 'episodes', LIMITS.episodes).map(episode => {
    object(episode, 'episode');
    const restored = { day: num(episode.day, 'episode day', 0, sim.day, true), type: str(episode.type, 'episode type', 40), text: str(episode.text, 'episode text'), valence: num(episode.valence, 'valence', -1, 1), salience: num(episode.salience, 'salience') };
    if (episode.about !== undefined) restored.about = num(episode.about, 'episode subject', 1, sim.nextAgentId - 1, true);
    if (episode.activity !== undefined) { if (!ACTIVITIES.includes(episode.activity)) invalid('episode activity'); restored.activity = episode.activity; }
    return restored;
  });
  const places = list(raw.places, 'places', LIMITS.places).map(place => {
    object(place, 'place');
    if (!PLACE_KINDS.includes(place.kind)) invalid('place kind');
    return { kind: place.kind, x: num(place.x, 'place x', 0, sim.width), y: num(place.y, 'place y', 0, sim.height), value: num(place.value, 'place value'), day: num(place.day, 'place day', 0, sim.day, true) };
  });
  const a = object(raw.aspiration, 'aspiration');
  if (!Object.hasOwn(ASPIRATIONS, a.kind)) invalid('aspiration kind');
  const aspiration = { kind: a.kind, text: str(a.text, 'aspiration text', 120), since: num(a.since, 'aspiration start', 0, sim.day, true), base: num(a.base, 'aspiration base', 0, 1e15), target: num(a.target, 'aspiration target', 1e-9, 1e6), progress: num(a.progress, 'aspiration progress'), achieved: num(a.achieved, 'aspirations achieved', 0, 1e6, true), start: num(a.start, 'aspiration starting progress') };
  if (a.kind === 'mastery') { if (!SKILL_IDS.includes(a.skill)) invalid('aspiration skill'); aspiration.skill = a.skill; }
  else if (a.skill !== undefined) invalid('aspiration skill');
  const reasoning = list(raw.reasoning, 'reasoning', LIMITS.reasoning).map(item => {
    object(item, 'reasoning');
    return { action: str(item.action, 'reasoned action', 50), score: num(item.score, 'reasoned score', -1000, 1000), base: num(item.base, 'reasoned base', -1000, 1000), factors: list(item.factors, 'factors', LIMITS.factors).map(factor => { object(factor, 'factor'); return { label: str(factor.label, 'factor label', 200), value: num(factor.value, 'factor value', -1000, 1000) }; }) };
  });
  const legacy = (sim._restoreVersion || 5) < 5;
  const record = fixed(legacy ? { founded: 0, ...object(raw.record, 'life record') } : raw.record, RECORD_KEYS, 'life record', 0, 1e15);
  return {
    psyche: {
      personality: fixed(raw.personality, PERSONALITY, 'personality', 0, 1), talents: fixed(raw.talents, SKILL_IDS, 'talents', .5, 1.6),
      mood: fixed(raw.mood, EMOTIONS, 'mood', 0, 1), preferences: sparse(raw.preferences, 'preferences'), expectations: sparse(raw.expectations, 'expectations'),
      techniques, episodes, places, visited: num(raw.visited, 'visited regions', 0, 0xffffffff, true), practice: skillMap(raw.practice), record, aspiration, reasoning,
      thought: str(raw.thought, 'thought', 400), lastReflection: num(raw.lastReflection, 'last reflection', 0, sim.day, true),
      expansion: legacy && raw.expansion === undefined ? round(temperamentalDrive({ psyche: { personality: raw.personality }, mind: rawAgent.mind })) : num(raw.expansion, 'pioneering drive'),
    },
  };
}

/** Called for every gain in proficiency; unpracticed skills fade at reflection. */
export function practise(agent, skill, amount) {
  const practice = agent.psyche?.practice;
  if (practice) practice[skill] = round((practice[skill] || 0) + amount);
}

/** Optional relationship fields added by social cognition. */
export function restoreRelationExtras(raw, restored, fail) {
  if (raw.trust !== undefined) { if (typeof raw.trust !== 'number' || !Number.isFinite(raw.trust) || raw.trust < 0 || raw.trust > 1) fail('relationship trust'); restored.trust = raw.trust; }
  if (raw.favors !== undefined) { if (typeof raw.favors !== 'number' || !Number.isFinite(raw.favors) || raw.favors < -50 || raw.favors > 50) fail('relationship favors'); restored.favors = raw.favors; }
  if (raw.expertise !== undefined) { if (!SKILL_IDS.includes(raw.expertise)) fail('relationship expertise'); restored.expertise = raw.expertise; }
  return restored;
}
