import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';
import { SKILLS, TECHNOLOGIES, initializeSociety, roleOf } from '../src/civilization.js';
import { initializeCulture } from '../src/culture.js';
import { initializeGroupIdeas } from '../src/innovation.js';
import { advanceDiplomacy, declare, relationBetween } from '../src/diplomacy.js';
import { warsOf, warMood } from '../src/conflict.js';
import { advancePolity, partiesOf, rulingParty } from '../src/polity.js';
import { advanceBreakthroughs, adoptBreakthrough, fieldMastery } from '../src/breakthroughs.js';

/** Societies side by side on one stretch of land, each with its own people and culture. */
function region(count = 2, people = 10, seed = 'fields-of-war') {
  const sim = new Simulation({ seed, population: count * people, size: 'compact' });
  const center = sim._mainlandNear(48, 32);
  sim.groups = []; sim._groupMap = new Map();
  for (let index = 0; index < count; index++) {
    const spot = sim._landNear(center.x + index * 5, center.y);
    const members = sim.agents.slice(index * people, index * people + people);
    const group = initializeSociety({ id: sim.nextGroupId++, name: ['Ashford Kin', 'Kell Hold', 'Moss Reach', 'Tarn Vale'][index], color: '#809260', ...spot, members: members.map(agent => agent.id), food: 120, wood: 20, shelters: 4, culture: 'Kinship', _foundedDay: 0, _lastMoveDay: 0, _shortageDays: 0 });
    initializeGroupIdeas(group);
    sim.groups.push(group); sim._groupMap.set(group.id, group);
    for (const agent of members) Object.assign(agent, spot, { age: 30, _ageDays: 3600, health: 100, hunger: 0, groupId: group.id });
    initializeCulture(sim, group);
  }
  return { sim, groups: sim.groups };
}
const warDay = (sim, war) => { sim.day++; while (sim.day % 30 !== Number(war.id.slice(4)) % 30) sim.day++; };

test('a war starts for a recorded reason, with an aim, and is fought in campaigns and lulls', () => {
  const { sim, groups: [a, b] } = region();
  sim._random = () => .5;
  sim.day = 12; advanceDiplomacy(sim);
  const relation = relationBetween(sim, a, b);
  // Hunger: both camps starving, neighbours with nothing to spare.
  a.food = b.food = 0;
  for (const agent of sim.agents) agent.hunger = 70;
  a.civilization.culture.norms.martial = .9;
  sim._random = () => 0;
  for (let day = 24; day <= 2400 && relation.status !== 'war'; day += 12) { sim.day = day; advanceDiplomacy(sim); }
  sim._random = () => .5;
  assert.equal(relation.status, 'war');
  const [war] = sim.diplomacy.wars;
  assert.equal(relation.warId, war.id);
  assert.equal(war.cause, 'hunger');
  assert.equal(war.goal, 'plunder');
  assert.match(war.name, /War/);
  assert.ok(sim.events.some(event => event.type === 'war' && event.text.includes(war.name) && event.text.includes('Cause')));
  // Campaigns give way to lulls in which armies rarely meet.
  assert.equal(war.phase, 'campaign');
  sim.day = war.phaseUntil; advanceDiplomacy(sim);
  assert.equal(war.phase, 'lull');
  const raids = sim.diplomacy.raids;
  for (let day = 0; day < 24; day++) { sim.day++; if (sim.day < war.phaseUntil) advanceDiplomacy(sim); }
  assert.equal(sim.diplomacy.raids, raids, 'no battles in a lull when chance does not favour one');
  assert.deepEqual(warsOf(sim, a), [war]);
});

test('a war lasts until a side is worn down, then the stronger side imposes its aim', () => {
  const { sim, groups: [a, b] } = region();
  sim._random = () => .5;
  const relation = declare(sim, a, b, 'war', 'A border incident.');
  const war = sim.diplomacy.wars[0];
  assert.equal(war.cause, 'provocation');
  assert.equal(war.attacker, a.id);
  // A young war with few losses goes on.
  warDay(sim, war); advanceDiplomacy(sim);
  assert.equal(war.end, null);
  assert.equal(relation.status, 'war');
  // Years of attrition, with the attackers winning.
  war.start = sim.day - 120 * 6; war.score = 60; war.casualties = [1, 6];
  const food = a.food;
  sim._random = () => .2;
  warDay(sim, war); advanceDiplomacy(sim);
  assert.notEqual(war.end, null);
  assert.equal(war.outcome.winner, 'attackers');
  assert.equal(war.outcome.terms, 'reparations');
  assert.ok(a.food > food, 'the loser pays');
  assert.equal(relation.status, 'truce');
  assert.equal(relation.warId, undefined);
  assert.ok(sim.events.some(event => event.type === 'peace' && event.text.includes(war.name)));
  assert.ok(warMood(sim, b).defeat > 0, 'defeat is remembered');
});

test('allies honour their alliance and a local war can widen', () => {
  const { sim, groups: [a, b, c] } = region(3, 8);
  sim._random = () => .1;
  const ally = declare(sim, b, c, 'alliance', 'Old friends.');
  ally.trust = .9;
  declare(sim, a, b, 'war', 'A raid on a herd.');
  const war = sim.diplomacy.wars[0];
  assert.deepEqual(war.defenders, [b.id, c.id]);
  assert.equal(relationBetween(sim, a, c).status, 'war');
  assert.equal(relationBetween(sim, a, c).warId, war.id);
  // When the principal enemies make peace, the whole war ends.
  declare(sim, a, b, 'truce', 'Envoys meet.');
  assert.notEqual(war.end, null);
  assert.equal(relationBetween(sim, a, c).status, 'truce');
});

test('a tributary rising fights a war of independence; winning it frees it', () => {
  const { sim, groups: [overlord, vassal] } = region();
  sim._random = () => .5;
  sim.day = 12; advanceDiplomacy(sim);
  const relation = relationBetween(sim, overlord, vassal);
  Object.assign(relation, { status: 'tributary', overlord: overlord.id, tension: 90 });
  // Make the vassal far stronger so it rises.
  for (const id of overlord.members.slice(2)) sim._agentMap.get(id).health = 20;
  sim._random = () => .1;
  sim.day = 30 * 5 + Math.max(overlord.id, vassal.id) % 30; advanceDiplomacy(sim);
  sim._random = () => .5;
  assert.equal(relation.status, 'war');
  const war = sim.diplomacy.wars[0];
  assert.equal(war.cause, 'independence');
  assert.equal(war.attacker, vassal.id);
  war.start = sim.day - 120 * 6; war.score = 50;
  sim._random = () => .2;
  warDay(sim, war); advanceDiplomacy(sim);
  assert.equal(war.outcome?.terms, 'independence');
  assert.equal(relation.status, 'truce');
  assert.equal(relation.overlord, undefined);
});

test('war moves politics: rallying at first, a defeated government falls, and all of it survives a save', () => {
  const { sim, groups: [a, b] } = region(2, 16);
  for (const group of [a, b]) { group.civilization.technologies = TECHNOLOGIES.map(tech => tech.id); group.civilization.culture.norms.hierarchy = .3; }
  for (const agent of sim.agents) { agent.skills = Object.fromEntries(SKILLS.map(skill => [skill, 30])); agent.wealth = 0; agent.mind.values = { security: 0, belonging: 1, autonomy: 0, mastery: 0, care: 1 }; }
  sim._random = () => 0;
  // Parties form and one governs in each society.
  for (let day = 1; day <= 90; day++) { sim.day = day; advancePolity(sim); }
  const ruling = rulingParty(sim, b);
  assert.ok(ruling && partiesOf(sim, b).length >= 1);
  sim.day = 1200;
  declare(sim, a, b, 'war', 'A border incident.');
  const war = sim.diplomacy.wars[0];
  assert.ok(warMood(sim, a).rally > .9, 'a new war rallies people');
  // A second party in the losing society, so a government can fall.
  if (partiesOf(sim, b).length < 2) sim.polity.parties.push({ ...ruling, id: `party-${sim.polity.nextParty++}`, name: 'Peace Congress', inPower: false, support: 1, share: .1 });
  const martial = a.civilization.culture.norms.martial;
  war.start = sim.day - 120 * 6; war.score = 70; war.casualties = [0, 8];
  delete sim._random;
  sim._random = () => 0;
  warDay(sim, war); advanceDiplomacy(sim);
  assert.equal(war.outcome.winner, 'attackers');
  assert.ok(a.civilization.culture.norms.martial > martial, 'victory breeds martial pride');
  assert.notEqual(rulingParty(sim, b), ruling, 'the government that lost the war falls');
  delete sim._random;
  const saved = sim.serialize();
  assert.deepEqual(Simulation.deserialize(structuredClone(saved)).serialize(), saved);
  const forged = structuredClone(saved);
  forged.diplomacy.relations[0].warId = 'war-99';
  assert.throws(() => Simulation.deserialize(forged), /diplomacy|war/);
  const scored = structuredClone(saved);
  scored.diplomacy.wars[0].score = 500;
  assert.throws(() => Simulation.deserialize(scored), /war/);
});

test('breakthroughs change a society: new occupations, automation displaces workers, and the land recovers', () => {
  const { sim, groups: [town] } = region(1, 20, 'machine-age');
  const civ = town.civilization;
  civ.buildings.factory = 1; civ.buildings.powerplant = 1; civ.stock.coal = 50;
  const make = (field, depth, effects) => {
    const entry = { id: `advance-${sim.breakthroughs.nextId++}`, name: `${field} ${depth}`, field, depth, parents: ['writing', 'engineering'], effects: { production: 0, food: 0, research: 0, health: 0, combat: 0, trade: 0, energy: 0, automation: 0, growth: 0, pollution: 0, unrest: 0, ...effects }, description: 'test', day: 0, originId: town.id, origin: town.name, inventorId: null };
    sim.breakthroughs.list.push(entry);
    adoptBreakthrough(sim, town, entry);
  };
  make('machines', 7, { automation: 2 });
  make('agriculture', 6, { food: 1 });
  make('energy', 6, { energy: 2 });
  make('information', 7, { research: 1 });
  assert.deepEqual({ machines: fieldMastery(sim, town).machines, agriculture: fieldMastery(sim, town).agriculture }, { machines: 7, agriculture: 6 });
  // Skilled people take the new specialisms; the unskilled are displaced or tend machines.
  const roles = new Set(sim.agents.map(agent => { agent.skills = Object.fromEntries(SKILLS.map(skill => [skill, 5])); agent.skills.crafting = agent.id % 2 ? 60 : 5; agent.skills.scholarship = agent.id % 2 ? 5 : 60; return roleOf(sim, agent, town); }));
  assert.ok(['Robotics engineer', 'Energy engineer', 'AI researcher', 'Data scientist'].some(role => roles.has(role)), [...roles].join(', '));
  const unskilled = sim.agents[0];
  unskilled.skills = Object.fromEntries(SKILLS.map(skill => [skill, 5]));
  assert.ok(['Displaced worker', 'Machine minder'].includes(roleOf(sim, unskilled, town)));
  // Monthly: the displaced grow angry without a welfare state, and felled woods regrow.
  town.civilization.culture.norms.collectivism = 0;
  for (const agent of sim.agents) agent.skills = Object.fromEntries(SKILLS.map(skill => [skill, 5]));
  const tile = sim._tile(town.x + 2, town.y);
  Object.assign(tile, { terrain: 'forest', wood: .1 });
  const anger = sim.agents.reduce((sum, agent) => sum + agent.psyche.mood.anger, 0);
  sim._random = () => .9;
  sim.day = 30 + (town.id + 7) % 30; advanceBreakthroughs(sim);
  assert.ok(sim.agents.reduce((sum, agent) => sum + agent.psyche.mood.anger, 0) > anger, 'automation without welfare breeds anger');
  assert.ok(tile.wood > .1, 'green belt: land spared by advanced farming and clean power regrows');
  // The map is told what to draw.
  delete sim._random;
  const view = sim.view().groups.find(group => group.id === town.id);
  assert.equal(view.mastery.machines, 7);
});
