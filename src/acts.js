/** Acts of god: observer interventions that reshape the world through the same
 * resources, bodies and minds the inhabitants live with. Nothing here decides
 * for anyone; each act changes circumstances and people respond.
 * All randomness uses the world's seeded generator, so replaying the same acts
 * on the same days reproduces the same history.
 */
import { feel, recordEpisode, rememberPlace, inspire } from './psyche.js';
import { TECHNOLOGIES } from './civilization.js';
import { proposeFrontier, adoptBreakthrough, breakthroughById, canPushFrontier } from './breakthroughs.js';
import { foundCompany, SECTORS, ownsCompany } from './enterprise.js';
import { callElection, proclaim, secede } from './polity.js';
import { declare, overlordOf, establishKinship } from './diplomacy.js';
import { reachable } from './infrastructure.js';
import { initializeCulture } from './culture.js';

export const PLAGUE_DAYS = 120, WINTER_DAYS = 90;

export const ACTS = Object.freeze([
  { id: 'rain', name: 'Rainfall', scope: 'world', icon: 'rain', toast: 'Rain falls across the world.', description: 'Wild food grows faster for 90 days.' },
  { id: 'drought', name: 'Drought', scope: 'world', icon: 'sun', toast: 'A dry spell begins.', description: 'Growth slows and exposed food withers for 180 days.' },
  { id: 'winter', name: 'Harsh winter', scope: 'world', icon: 'snow', toast: 'A bitter winter sets in.', description: 'For 90 days growth nearly stops, stores spoil faster, and cold drains energy from anyone without shelter.' },
  { id: 'food', name: 'Food aid', scope: 'world', icon: 'sprout', toast: 'Food supplies have arrived.', description: 'Replenishes supplies and the land around every inhabitant.' },
  { id: 'renewal', name: 'Bless the land', scope: 'world', icon: 'leaf', toast: 'The land is renewed.', description: 'Restores exhausted soil everywhere and brings wild food back to half its potential or more.' },
  { id: 'plague', name: 'Plague', scope: 'world', icon: 'plague', toast: 'Sickness spreads.', description: 'For 120 days illness strikes, worst in crowded settlements. Clinics, healers and medical knowledge protect people.' },
  { id: 'festival', name: 'Festival', scope: 'world', icon: 'star', toast: 'A great festival begins.', description: 'Joy and belonging surge, grief and anger ease, and existing bonds grow stronger.' },
  { id: 'omen', name: 'Dark omen', scope: 'world', icon: 'eye', toast: 'A dark omen appears.', description: 'Fear spreads and people search for meaning, turning toward reflection and shared belief.' },
  { id: 'inspiration', name: 'Spark of genius', scope: 'world', icon: 'spark', toast: 'Inspiration strikes.', description: 'A few of the most curious adults grasp a new technique and deepen their best skill; their shared experiments leap ahead.' },
  { id: 'wanderers', name: 'Wanderers arrive', scope: 'region', icon: 'people', toast: 'Strangers arrive.', description: 'A band of skilled newcomers arrives in a region, bringing techniques of their own.' },
  { id: 'earthquake', name: 'Earthquake', scope: 'region', icon: 'quake', toast: 'The ground shakes.', description: 'Injures people, topples buildings and shelters, and exposes stone and ore.' },
  { id: 'wildfire', name: 'Wildfire', scope: 'region', icon: 'flame', toast: 'Fire sweeps the land.', description: 'Burns woodland and wild food, damages camps, and leaves fertile ash behind.' },
  { id: 'flood', name: 'Flood', scope: 'region', icon: 'wave', toast: 'The waters rise.', description: 'Drowns crops and stores in low-lying land, then leaves rich silt in the soil.' },
  { id: 'strike', name: 'Mineral strike', scope: 'region', icon: 'gem', toast: 'A rich deposit is revealed.', description: 'Rich stone and ore surface near the region; nearby people learn where.' },
  { id: 'aid', name: 'Send aid', scope: 'society', icon: 'sprout', toast: 'Aid arrives.', description: 'Food, timber, stone, metal and cloth for the society.' },
  { id: 'knowledge', name: 'Share knowledge', scope: 'society', icon: 'spark', toast: 'Knowledge is shared.', description: 'The next technology it could learn, or a breakthrough known elsewhere.' },
  { id: 'visionary', name: 'Inspire a visionary', scope: 'society', icon: 'star', toast: 'A visionary emerges.', description: 'Its research leaps ahead, toward its next project or past the known.' },
  { id: 'enterprise', name: 'Back an entrepreneur', scope: 'society', icon: 'people', toast: 'A venture is funded.', description: 'Its most ambitious member receives capital and founds a company.' },
  { id: 'unrest', name: 'Stir unrest', scope: 'society', icon: 'flame', toast: 'Discontent spreads.', description: 'Anger and strain rise; the opposition gains, and revolution may follow.' },
  { id: 'election', name: 'Call an election', scope: 'society', icon: 'eye', toast: 'The people vote.', description: 'A snap election among its parties.' },
  { id: 'peace', name: 'Broker peace', scope: 'society', icon: 'leaf', toast: 'Peace is made.', description: 'Every war it is fighting ends in a truce.' },
  { id: 'discord', name: 'Sow discord', scope: 'society', icon: 'quake', toast: 'Tempers flare.', description: 'It goes to war with its nearest rival.' },
  { id: 'proclaim', name: 'Proclaim a nation', scope: 'society', icon: 'gem', toast: 'A nation is born.', description: 'It unites with its kin, allies and tributaries as a country.' },
  { id: 'independence', name: 'Independence', scope: 'society', icon: 'wave', toast: 'Independence!', description: 'It leaves its country and throws off any overlord.' },
  { id: 'settle', name: 'Found a settlement', scope: 'society', icon: 'people', toast: 'Settlers set out.', description: 'Volunteers found a colony in the chosen region.' },
]);
const actById = new Map(ACTS.map(act => [act.id, act]));
export const isRegionalAct = kind => actById.get(kind)?.scope === 'region';
export const isSocietyAct = kind => actById.get(kind)?.scope === 'society';

const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const foodCapacity = terrain => terrain === 'forest' ? 1 : terrain === 'grass' ? 0.8 : terrain === 'sand' ? 0.17 : terrain === 'mountain' ? 0.07 : 0;

/** Applies an act. `region` is a region ID for regional acts; omitted, fate picks one. */
export function performAct(sim, kind, { region = null, society = null } = {}) {
  const act = actById.get(kind);
  if (!act) throw new Error(`Unknown act. Choose one of: ${ACTS.map(entry => entry.id).join(', ')}.`);
  let place = null;
  if (act.scope === 'society') {
    const group = sim._groupMap.get(society);
    if (!group) throw new Error('Choose a society.');
    if (region !== null && region !== undefined) {
      place = sim.regions.find(candidate => candidate.id === region);
      if (!place) throw new Error('Unknown region.');
    }
    societyHandlers[kind](sim, group, place);
    return;
  }
  if (society !== null && society !== undefined) throw new Error(`${act.name} does not act on one society.`);
  if (act.scope === 'region') {
    if (region !== null && region !== undefined) {
      place = sim.regions.find(candidate => candidate.id === region);
      if (!place) throw new Error('Unknown region.');
    } else place = sim.regions[Math.floor(sim._random() * sim.regions.length)];
  } else if (region !== null && region !== undefined) throw new Error(`${act.name} affects the whole world, not one region.`);
  handlers[kind](sim, place);
}

// ——— helpers ———

function tilesWithin(sim, center, radius, visit) {
  for (let y = Math.max(0, Math.floor(center.y - radius)); y <= Math.min(sim.height - 1, Math.floor(center.y + radius)); y++) {
    for (let x = Math.max(0, Math.floor(center.x - radius)); x <= Math.min(sim.width - 1, Math.floor(center.x + radius)); x++) {
      const d = Math.hypot(x + .5 - center.x, y + .5 - center.y);
      if (d <= radius) visit(sim.tiles[y * sim.width + x], d / radius, x, y);
    }
  }
}
const within = (sim, center, radius) => sim.agents.filter(agent => Math.hypot(agent.x - center.x, agent.y - center.y) <= radius);
const groupsWithin = (sim, center, radius) => sim.groups.filter(group => Math.hypot(group.x - center.x, group.y - center.y) <= radius);

function injure(agent, damage, cause) {
  agent.health = clamp(agent.health - damage, 0, 100);
  if (agent.health === 0 && !agent._deathCause) agent._deathCause = cause;
}

function remember(sim, people, episode, emotions) {
  for (const agent of people) {
    for (const [emotion, amount] of Object.entries(emotions)) feel(agent, emotion, amount);
    recordEpisode(sim, agent, episode);
  }
}

/** Each lost building is a real loss; nothing is rebuilt without labour and materials. */
function damageSettlement(sim, group, chance, shelterShare) {
  let lost = 0;
  for (const key of Object.keys(group.civilization.buildings)) {
    const count = group.civilization.buildings[key];
    for (let i = 0; i < count; i++) if (sim._random() < chance) { group.civilization.buildings[key]--; lost++; }
  }
  const shelters = Math.floor(group.shelters * shelterShare);
  group.shelters -= shelters;
  return lost + shelters;
}

// ——— the acts ———

const handlers = {
  rain(sim) {
    sim.weather.rainUntil = sim.day + 90; sim.weather.droughtUntil = sim.day;
    sim._event('world', 'Gentle rains begin. Wild food grows faster for the next 90 days.');
  },
  drought(sim) {
    sim.weather.droughtUntil = sim.day + 180; sim.weather.rainUntil = sim.day;
    sim._event('world', 'A drought begins. Growth slows and exposed food withers for the next 180 days.');
  },
  food(sim) {
    for (const agent of sim.agents) {
      agent.inventory.food = Math.min(5, agent.inventory.food + 1.3);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const tile = sim._tile(agent.x + dx, agent.y + dy);
        tile.food = Math.min(foodCapacity(tile.terrain), tile.food + 0.4);
      }
    }
    for (const group of sim.groups) group.food = Math.min(group.food + group.members.length, group.members.length * 3 + 8);
    sim._event('world', 'A food windfall replenishes supplies and the land around the inhabitants.');
  },
  winter(sim) {
    sim.weather.winterUntil = sim.day + WINTER_DAYS; sim.weather.rainUntil = Math.min(sim.weather.rainUntil, sim.day);
    remember(sim, sim.agents.filter(agent => agent.age >= 6), { type: 'hardship', text: 'A bitter winter came; the land froze and the cold bit deep.', valence: -.55, salience: .6, activity: 'basic' }, { fear: .2 });
    sim._event('world', 'A harsh winter sets in. For 90 days little grows, stores spoil faster, and the unsheltered suffer from cold.');
  },
  renewal(sim) {
    for (const tile of sim.tiles) {
      if (tile.terrain === 'water') continue;
      tile.soil = Math.max(tile.soil, tile.fertility);
      tile.food = Math.max(tile.food, foodCapacity(tile.terrain) * .5);
    }
    remember(sim, sim.agents.filter(agent => agent.age >= 6), { type: 'wonder', text: 'The land was renewed; worn-out fields grew rich again.', valence: .7, salience: .55, activity: 'farm' }, { joy: .25 });
    sim._event('world', 'The land is blessed. Exhausted soil recovers its natural fertility and wild food returns.');
  },
  plague(sim) {
    sim.weather.plagueUntil = sim.day + PLAGUE_DAYS;
    remember(sim, sim.agents.filter(agent => agent.age >= 6), { type: 'hardship', text: 'A plague began to spread among us.', valence: -.7, salience: .7 }, { fear: .35 });
    sim._event('world', 'A plague spreads. For 120 days illness strikes, worst where people crowd together; healers and clinics can save lives.');
  },
  festival(sim) {
    for (const agent of sim.agents) {
      agent.social = 100; agent._stress = Math.max(0, agent._stress - 40);
      if (agent.psyche) { agent.psyche.mood.grief = Math.round(agent.psyche.mood.grief * 5e3) / 1e4; agent.psyche.mood.anger = Math.round(agent.psyche.mood.anger * 3e3) / 1e4; }
      for (const relation of agent._relations) relation.strength = clamp(relation.strength + .08);
    }
    remember(sim, sim.agents.filter(agent => agent.age >= 4), { type: 'community', text: 'A great festival brought everyone together.', valence: .85, salience: .7 }, { joy: .5, pride: .1 });
    sim._event('world', 'A great festival sweeps the world. People celebrate together; old bonds deepen and sorrows ease.');
  },
  omen(sim) {
    for (const agent of sim.agents) agent.mind.needs.purpose = clamp(agent.mind.needs.purpose + 35, 0, 100);
    remember(sim, sim.agents.filter(agent => agent.age >= 6), { type: 'omen', text: 'A dark omen filled the sky, and no one could explain it.', valence: -.6, salience: .75, activity: 'reflect' }, { fear: .5 });
    sim._event('world', 'A dark omen appears in the sky. Fear spreads, and people search for meaning together.');
  },
  inspiration(sim) {
    const adults = sim.agents.filter(agent => agent.age >= 16 && agent.psyche);
    const count = Math.min(adults.length, Math.max(3, Math.round(adults.length / 25)));
    const chosen = adults.map(agent => ({ agent, score: agent.traits.curiosity * agent.psyche.personality.openness + sim._random() * .3 })).sort((a, b) => b.score - a.score).slice(0, count).map(entry => entry.agent);
    const names = [];
    for (const agent of chosen) {
      const technique = inspire(sim, agent);
      const skill = technique?.skill || Object.keys(agent.skills).sort((a, b) => agent.skills[b] - agent.skills[a])[0];
      agent.skills[skill] = clamp(agent.skills[skill] + 12, 0, 100);
      agent.mind.needs.stimulation = 0;
      feel(agent, 'pride', .4); feel(agent, 'joy', .3);
      recordEpisode(sim, agent, { type: 'inspiration', text: `Woke with a sudden insight${technique ? ` into ${technique.name.toLowerCase()}` : ` about ${skill}`}.`, valence: .9, salience: .9 });
      const experiment = sim._groupMap.get(agent.groupId)?.civilization.experiment;
      if (experiment) experiment.progress = Math.min(experiment.required, experiment.progress + experiment.required * .5);
      names.push(agent.name);
    }
    sim._event('world', chosen.length ? `A spark of genius: ${names.slice(0, 4).join(', ')}${names.length > 4 ? ` and ${names.length - 4} others` : ''} ${names.length === 1 ? 'is' : 'are'} struck by sudden insight.` : 'A spark of genius falls, but there is no one to catch it.', chosen[0] ? { agentId: chosen[0].id } : {});
  },
  wanderers(sim, region) {
    const population = sim.agents.length;
    const count = Math.max(4, Math.min(20, Math.round(population * .05)));
    const band = [];
    for (let i = 0; i < count; i++) {
      const spot = sim._landNear(region.x + (sim._random() - .5) * 10, region.y + (sim._random() - .5) * 10);
      const agent = sim._newAgent(spot.x, spot.y, 18 + sim._random() * 22);
      // Travellers bring practised skills and something they know how to do.
      for (const skill of Object.keys(agent.skills)) agent.skills[skill] = clamp(agent.skills[skill] + sim._random() * 25, 0, 100);
      inspire(sim, agent);
      recordEpisode(sim, agent, { type: 'journey', text: `Arrived in ${region.name} after a long journey.`, valence: .4, salience: .8 });
      sim.agents.push(agent); sim._agentMap.set(agent.id, agent);
      band.push(agent);
    }
    for (const agent of band) for (const other of band) if (agent !== other) { const bond = sim._remember(agent, other); bond.strength = Math.max(bond.strength, .35); }
    sim.arrivals += count;
    sim._event('migration', `${count} wanderers arrive in ${region.name}, bringing skills and techniques from distant lands.`, { agentId: band[0].id });
  },
  earthquake(sim, region) {
    const radius = 14;
    tilesWithin(sim, region, radius, (tile, falloff) => {
      if (tile.terrain === 'water') return;
      tile.stone = clamp(tile.stone + .25 * (1 - falloff));
      if (tile.terrain === 'mountain' || tile.elevation > .55) tile.ore = clamp(tile.ore + .2 * (1 - falloff));
    });
    const people = within(sim, region, radius);
    for (const agent of people) {
      const falloff = Math.hypot(agent.x - region.x, agent.y - region.y) / radius;
      injure(agent, (5 + sim._random() * 25) * (1 - falloff * .6), 'disaster');
      agent.energy = clamp(agent.energy - 20, 0, 100);
    }
    remember(sim, people, { type: 'disaster', text: `The earth shook in ${region.name}.`, valence: -.85, salience: .9 }, { fear: .5 });
    let destroyed = 0;
    for (const group of groupsWithin(sim, region, radius)) destroyed += damageSettlement(sim, group, .35, .4);
    sim._event('world', `An earthquake strikes ${region.name}. ${people.length} people are shaken or hurt${destroyed ? ` and ${destroyed} structures collapse` : ''}; fresh stone and ore lie exposed.`);
  },
  wildfire(sim, region) {
    const radius = 16;
    let burned = 0;
    tilesWithin(sim, region, radius, tile => {
      if (tile.terrain !== 'forest' && tile.terrain !== 'grass') return;
      if (tile.wood > .05 || tile.food > .05) burned++;
      tile.wood *= .05; tile.food *= .15; tile.soil = clamp(tile.soil + .25);
    });
    const people = within(sim, region, radius);
    for (const agent of people) injure(agent, 3 + sim._random() * 12, 'disaster');
    remember(sim, people, { type: 'disaster', text: `Fire swept through ${region.name}.`, valence: -.8, salience: .85 }, { fear: .45 });
    for (const group of groupsWithin(sim, region, radius)) { group.wood *= .4; group.food *= .8; damageSettlement(sim, group, .12, .3); }
    sim._event('world', `Wildfire sweeps ${region.name}, burning ${burned} tracts of woodland and meadow. Ash will enrich the soil as it regrows.`);
  },
  flood(sim, region) {
    const radius = 18, low = tile => tile.elevation < .45 && tile.terrain !== 'water' && tile.terrain !== 'mountain';
    let drowned = 0;
    tilesWithin(sim, region, radius, tile => {
      if (!low(tile)) return;
      drowned++;
      tile.food = 0; tile.wood *= .6; tile.soil = clamp(tile.soil + .5);
    });
    const people = within(sim, region, radius).filter(agent => low(sim._tile(agent.x, agent.y)));
    for (const agent of people) { injure(agent, 2 + sim._random() * 10, 'disaster'); agent.inventory.food *= .5; }
    remember(sim, people, { type: 'disaster', text: `Floodwaters swept through ${region.name}.`, valence: -.75, salience: .8 }, { fear: .4, grief: .1 });
    for (const group of groupsWithin(sim, region, radius)) if (low(sim._tile(group.x, group.y))) { group.food *= .5; damageSettlement(sim, group, .1, .25); }
    sim._event('world', `Floods cover ${drowned} low-lying tracts around ${region.name}. Crops and stores are lost, but the silt will feed future harvests.`);
  },
  strike(sim, region) {
    const center = sim._landNear(region.x + (sim._random() - .5) * 8, region.y + (sim._random() - .5) * 8);
    tilesWithin(sim, center, 7, (tile, falloff) => {
      if (tile.terrain === 'water') return;
      tile.stone = clamp(tile.stone + .5 * (1 - falloff)); tile.ore = clamp(tile.ore + .5 * (1 - falloff));
    });
    const witnesses = within(sim, center, 14);
    for (const agent of witnesses) {
      rememberPlace(sim, agent, 'ore', center.x, center.y, .9); rememberPlace(sim, agent, 'stone', center.x, center.y, .9);
      agent.mind.beliefs.opportunity = clamp(agent.mind.beliefs.opportunity + .2);
    }
    remember(sim, witnesses, { type: 'wonder', text: `Rich stone and ore surfaced near ${region.name}.`, valence: .6, salience: .6, activity: 'mine' }, { joy: .15 });
    sim._event('world', `A rich mineral deposit surfaces near ${region.name}. ${witnesses.length} people nearby know where to dig.`);
  },
};

/** Ongoing effects on one person each day: plague and cold. */
const adultsOf = (sim, group) => group.members.map(id => sim._agentMap.get(id)).filter(agent => agent && agent.age >= 16);

// ——— acts upon one society ———
const societyHandlers = {
  aid(sim, group) {
    const n = group.members.length, stock = group.civilization.stock;
    group.food += n * 3; group.wood += 10;
    stock.stone += 6; stock.metal += 4; stock.cloth += 3; stock.tools += 3;
    remember(sim, adultsOf(sim, group), { type: 'community', text: 'Aid arrived from beyond: food and materials for all.', valence: .7, salience: .6 }, { joy: .3 });
    sim._event('world', `Aid arrives in ${group.name}: food, timber, stone, metal and cloth.`, { groupId: group.id });
  },
  knowledge(sim, group) {
    const civ = group.civilization;
    const next = TECHNOLOGIES.filter(tech => !civ.technologies.includes(tech.id) && tech.requires.every(id => civ.technologies.includes(id))).sort((a, b) => a.cost - b.cost)[0];
    if (next) {
      civ.technologies.push(next.id); civ.research[next.id] = next.cost;
      if (civ.project?.technology === next.id) civ.project = null;
      for (const agent of adultsOf(sim, group)) if (!agent.knowledge.includes(next.id) && sim._random() < .6) agent.knowledge.push(next.id);
      sim._event('technology', `${group.name} is given the knowledge of ${next.name.toLowerCase()}. ${next.description}`, { groupId: group.id });
      return;
    }
    const known = new Set([...civ.technologies, ...(civ.breakthroughs || [])]);
    const elsewhere = (sim.breakthroughs?.list || []).find(entry => !known.has(entry.id) && entry.parents.every(parent => known.has(parent)));
    if (elsewhere) { adoptBreakthrough(sim, group, breakthroughById(sim, elsewhere.id)); sim._event('technology', `${group.name} is given the secret of ${elsewhere.name}.`, { groupId: group.id }); }
    else sim._event('world', `${group.name} already knows all it can yet understand.`, { groupId: group.id });
  },
  visionary(sim, group) {
    const civ = group.civilization;
    if (civ.project) civ.project.progress = Math.min(civ.project.required, civ.project.progress + civ.project.required * .6), civ.research[civ.project.technology] = civ.project.progress;
    else if (canPushFrontier(group)) { civ.frontier ||= proposeFrontier(sim, group); if (civ.frontier) civ.frontier.progress = Math.min(civ.frontier.required, civ.frontier.progress + civ.frontier.required * .6); }
    const thinker = adultsOf(sim, group).sort((a, b) => b.traits.curiosity - a.traits.curiosity)[0];
    if (thinker) { thinker.skills.scholarship = Math.min(100, thinker.skills.scholarship + 20); inspire(sim, thinker); }
    sim._event('world', `A visionary in ${group.name}${thinker ? `, ${thinker.name},` : ''} carries its research far ahead.`, { groupId: group.id, ...(thinker ? { agentId: thinker.id } : {}) });
  },
  enterprise(sim, group) {
    const civ = group.civilization;
    const founder = adultsOf(sim, group).filter(agent => !ownsCompany(sim, agent)).sort((a, b) => b.mind.ambition - a.mind.ambition)[0];
    if (!founder) return;
    const sectors = Object.entries(SECTORS).filter(([, sector]) => civ.technologies.includes(sector.technology) && (!sector.building || civ.buildings[sector.building] > 0));
    const [sector] = sectors.length ? sectors[Math.floor(sim._random() * sectors.length)] : ['agriculture'];
    foundCompany(sim, founder, group, sector, 40);
  },
  unrest(sim, group) {
    for (const agent of adultsOf(sim, group)) { agent._stress = Math.min(200, (agent._stress || 0) + 60); feel(agent, 'anger', .5); }
    group.civilization.culture && (group.civilization.culture.norms.hierarchy = Math.max(0, group.civilization.culture.norms.hierarchy - .05));
    sim._event('world', `Unrest spreads through ${group.name}.`, { groupId: group.id });
  },
  election(sim, group) {
    if (!callElection(sim, group)) sim._event('world', `${group.name} has no parties to vote for yet.`, { groupId: group.id });
  },
  peace(sim, group) {
    let made = 0;
    for (const r of [...(sim.diplomacy?.relations || [])]) {
      if (r.status !== 'war' || (r.a !== group.id && r.b !== group.id)) continue;
      const other = sim._groupMap.get(r.a === group.id ? r.b : r.a);
      if (other) { declare(sim, group, other, 'truce', 'A peace is brokered from beyond.'); made++; }
    }
    if (!made) sim._event('world', `${group.name} is at peace already.`, { groupId: group.id });
  },
  discord(sim, group) {
    const rival = sim.groups.filter(other => other !== group && reachable(sim, group, other)).sort((a, b) => Math.hypot(a.x - group.x, a.y - group.y) - Math.hypot(b.x - group.x, b.y - group.y))[0];
    if (rival) declare(sim, group, rival, 'war', 'Old grievances flare into open war.');
  },
  proclaim(sim, group) { proclaim(sim, group); },
  independence(sim, group) {
    const lord = overlordOf(sim, group);
    if (lord) declare(sim, group, lord, 'truce', `${group.name} throws off the rule of ${lord.name}.`);
    if (!secede(sim, group) && !lord) sim._event('world', `${group.name} is already independent.`, { groupId: group.id });
  },
  settle(sim, group, place) {
    const target = place || sim.regions[Math.floor(sim._random() * sim.regions.length)];
    const site = sim._landNear(target.x, target.y);
    const volunteers = adultsOf(sim, group).filter(agent => agent.age < 50 && agent.id !== group.civilization.culture?.leaderId).sort((a, b) => (b.psyche?.expansion ?? 0) - (a.psyche?.expansion ?? 0)).slice(0, Math.max(3, Math.min(8, Math.floor(group.members.length / 3))));
    if (volunteers.length < 3) { sim._event('world', `${group.name} has too few people to spare for a settlement.`, { groupId: group.id }); return; }
    const settlers = new Set(volunteers);
    for (const agent of volunteers) {
      const partner = sim._agentMap.get(agent.partnerId);
      if (partner?.groupId === group.id) settlers.add(partner);
      for (const id of agent.children) { const child = sim._agentMap.get(id); if (child?.groupId === group.id && child.age < 14) settlers.add(child); }
    }
    const colony = sim._foundColony(site, [...settlers]);
    colony.civilization.technologies = [...group.civilization.technologies];
    for (const id of colony.civilization.technologies) colony.civilization.research[id] = group.civilization.research[id];
    colony.civilization.breakthroughs = [...(group.civilization.breakthroughs || [])];
    if (group.civilization.advances) colony.civilization.advances = { ...group.civilization.advances };
    const food = group.food * .25, wood = group.wood * .25;
    group.food -= food; colony.food += food; group.wood -= wood; colony.wood += wood;
    if (group.civilization.culture) initializeCulture(sim, colony, group);
    establishKinship(sim, group, colony);
    for (const agent of settlers) { agent._wanderX = site.x; agent._wanderY = site.y; }
    sim._event('migration', `Settlers from ${group.name} set out to found ${colony.name} in ${target.name} (${settlers.size} people).`, { groupId: colony.id });
  },
};

export function endureConditions(sim, agent, group) {
  const weather = sim.weather;
  if (weather.plagueUntil > sim.day && agent.health > 0) {
    // Crowding raises exposure; clinics, local medical knowledge and good health lower harm.
    const crowd = group ? Math.min(2.5, group.members.length / 12) : .3;
    const stock = group?.civilization.stock;
    const protection = 1 + (group?.civilization.buildings.clinic || 0) * .6 + (group?.civilization.buildings.apothecary || 0) * .4 + (group?.civilization.technologies.includes('medicine') ? .4 : 0)
      + agent.skills.medicine / 100 + (stock ? Math.min(1, stock.remedies / Math.max(1, group.members.length * .2)) * .8 : 0);
    const frailty = agent.age < 6 || agent.age > 60 ? 1.6 : 1;
    if (sim._random() < .035 * (.4 + crowd)) {
      injure(agent, (6 + sim._random() * 14) * frailty / protection, 'plague');
      if (stock?.remedies >= .05) stock.remedies -= .05;
      agent.energy = clamp(agent.energy - 10, 0, 100);
      if (agent.psyche && !agent.psyche.episodes.some(episode => episode.type === 'illness' && sim.day - episode.day < PLAGUE_DAYS)) {
        feel(agent, 'fear', .25);
        recordEpisode(sim, agent, { type: 'illness', text: 'Fell ill during the plague.', valence: -.7, salience: .75 });
      }
    }
  }
  if (weather.winterUntil > sim.day) {
    const sheltered = group && Math.hypot(agent.x - group.x, agent.y - group.y) < 8 && group.shelters * 5 >= group.members.length;
    // Cloth or hides worn through the winter halve the chill; clothing slowly wears out.
    const stock = group?.civilization.stock, clothed = stock && stock.cloth + stock.hides >= group.members.length * .15;
    if (clothed) { const wear = .004; if (stock.cloth >= wear) stock.cloth -= wear; else stock.hides = Math.max(0, stock.hides - wear); }
    agent.energy = clamp(agent.energy - (sheltered ? .4 : 1.4) * (clothed ? .5 : 1), 0, 100);
  }
}

/** Snapshot summary of ongoing conditions, for observers. */
export function activeConditions(sim) {
  const weather = sim.weather, left = until => Math.max(0, until - sim.day);
  return { rain: left(weather.rainUntil), drought: left(weather.droughtUntil), winter: left(weather.winterUntil), plague: left(weather.plagueUntil) };
}
