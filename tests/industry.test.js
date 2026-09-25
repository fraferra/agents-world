import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';
import { TECHNOLOGIES, BUILDINGS, SKILLS, initializeSociety, considerCivilization, advanceCivilization, industry, powered, facilities } from '../src/civilization.js';
import { DEPOSITS, generateDeposits } from '../src/resources.js';
import { initializeCulture } from '../src/culture.js';
import { initializeGroupIdeas } from '../src/innovation.js';
import { advanceDiplomacy } from '../src/diplomacy.js';
import { careLevel, diseaseLoad, annualHazard } from '../src/lifecourse.js';
import { economyOf } from '../src/economy.js';
import { PERSONALITY } from '../src/psyche.js';

const MODERN = ['chemistry', 'steam', 'railways', 'vaccination', 'electricity', 'computing', 'fission', 'nuclear-weapons'];

function society(options = {}) {
  const sim = new Simulation({ seed: options.seed || 'industrial-age', population: options.population || 8, size: 'compact' });
  const center = sim._mainlandNear(48, 32);
  const group = initializeSociety({ id: sim.nextGroupId++, name: 'Test Works', color: '#809260', ...center, members: sim.agents.map(agent => agent.id), food: 50, wood: 10, shelters: 3, culture: 'Stewardship', _foundedDay: 0, _lastMoveDay: 0, _shortageDays: 0 });
  initializeGroupIdeas(group);
  sim.groups = [group]; sim._groupMap.set(group.id, group);
  for (const agent of sim.agents) {
    Object.assign(agent, center, { groupId: group.id, hunger: 0, energy: 95, health: 100, social: 100, age: 30, _ageDays: 3600 });
    agent.inventory.food = 5;
    agent.mind.values = { security: 0, belonging: 0, autonomy: 0, mastery: 0, care: 0 };
    agent.mind.ambition = 0; agent.mind.needs.stimulation = 0; agent.traits.curiosity = 0;
    agent.skills = Object.fromEntries(SKILLS.map(skill => [skill, 0]));
    Object.assign(agent.psyche, { personality: Object.fromEntries(PERSONALITY.map(key => [key, .5])), talents: Object.fromEntries(SKILLS.map(skill => [skill, 1])), preferences: {}, expectations: {}, techniques: [], episodes: [], places: [], reasoning: [], practice: {}, expansion: .3 });
  }
  initializeCulture(sim, group);
  sim._buildSpatial();
  return { sim, group, agent: sim.agents[0] };
}

test('modern technologies form a connected tree above the classical one', () => {
  const ids = new Set(TECHNOLOGIES.map(tech => tech.id));
  for (const id of MODERN) {
    const tech = TECHNOLOGIES.find(entry => entry.id === id);
    assert.ok(tech && tech.era && tech.requires.length, `${id} has an era and prerequisites`);
    assert.ok(tech.requires.every(prerequisite => ids.has(prerequisite)));
  }
  for (const building of Object.values(BUILDINGS)) assert.ok(ids.has(building.technology));
  assert.ok(TECHNOLOGIES.find(tech => tech.id === 'steam').materials.coal > 0);
  assert.ok(TECHNOLOGIES.find(tech => tech.id === 'fission').materials.uranium > 0);
});

test('coal and uranium are seeded deposits: coal in hills and basins, uranium only in high ground', () => {
  const sim = new Simulation({ seed: 'moss-17', population: 4, size: 'standard' });
  for (const [index, tile] of sim.tiles.entries()) {
    for (const key of DEPOSITS) assert.ok(tile[key] >= 0 && tile[key] <= 1);
    if (tile.terrain === 'water') assert.ok(tile.coal === 0 && tile.uranium === 0);
    if (tile.uranium > 0) assert.ok(tile.terrain === 'mountain' || tile.elevation > .62);
    if (index % 997 === 0) assert.deepEqual(generateDeposits(sim, index), { coal: tile.coal, uranium: tile.uranium });
  }
  assert.ok(sim.tiles.some(tile => tile.coal > .2), 'workable coal seams exist');
  assert.ok(sim.tiles.some(tile => tile.uranium > .05), 'some uranium exists');
});

test('version 6 worlds gain the same deposits, empty industrial stocks, and keep running exactly', () => {
  const sim = new Simulation({ seed: 'moss-17', population: 30, size: 'compact' });
  sim.step(240);
  const legacy = sim.serialize();
  legacy.version = 6;
  for (const tile of legacy.tiles) for (const key of DEPOSITS) delete tile[key];
  for (const group of legacy.groups) {
    const civ = group.civilization;
    for (const key of ['coal', 'uranium', 'machines', 'electronics', 'warheads']) { delete civ.stock[key]; delete civ.production[key]; }
    for (const key of ['factory', 'railway', 'hospital', 'powerplant', 'datacenter', 'reactor', 'silo']) delete civ.buildings[key];
    if (civ.survey) for (const key of DEPOSITS) delete civ.survey.means[key];
  }
  delete legacy.diplomacy.nuclearStrikes;
  const migrated = Simulation.deserialize(structuredClone(legacy)), twin = Simulation.deserialize(structuredClone(legacy));
  assert.equal(migrated.serialize().version, 7);
  assert.ok(migrated.tiles.every((tile, index) => tile.coal === sim.tiles[index].coal && tile.uranium === sim.tiles[index].uranium));
  assert.ok(migrated.groups.every(group => group.civilization.stock.coal === 0 && group.civilization.buildings.factory === 0));
  migrated.step(60); twin.step(60);
  assert.deepEqual(migrated.serialize(), twin.serialize());
});

test('factories turn metal and coal into machines, which multiply work and make an industrial economy', () => {
  const { sim, group, agent } = society();
  const civ = group.civilization;
  civ.technologies = TECHNOLOGIES.map(tech => tech.id);
  for (const id of Object.keys(BUILDINGS)) civ.buildings[id] = 1;
  civ.buildings.datacenter = 0;
  Object.assign(civ.stock, { tools: 20, goods: 20, metal: 20, cloth: 20, remedies: 20, bricks: 20, stone: 20, ore: 20, electronics: 20, uranium: 20, warheads: 20, machines: 0, coal: 5 });
  assert.equal(economyOf(group), 'industrial');
  assert.equal(industry(group).mechanization, 1, 'a factory without machines multiplies nothing');
  agent.skills.crafting = 60; agent.mind.ambition = 1;
  sim._random = () => 0;
  considerCivilization(sim, agent, group);
  assert.equal(agent.mind.policy.action, 'manufacture');
  assert.ok(Math.abs(civ.stock.coal - 4.7) < 1e-9 && Math.abs(civ.stock.metal - 19.7) < 1e-9, 'machines are made from real metal and coal');
  assert.ok(civ.stock.machines + agent.wealth > .3);
  civ.stock.machines = 10;
  assert.ok(industry(group).mechanization > 1.5);
  civ.buildings.datacenter = 1;
  assert.equal(economyOf(group), 'information');
});

test('power stations burn coal and stop without it; a fuelled reactor replaces them', () => {
  const { sim, group } = society();
  const civ = group.civilization;
  civ.technologies = TECHNOLOGIES.map(tech => tech.id);
  civ.buildings.powerplant = 1; civ.buildings.datacenter = 1;
  civ.stock.coal = 1;
  assert.ok(powered(group));
  const research = facilities(group).research;
  advanceCivilization(sim);
  assert.ok(civ.stock.coal < 1, 'the station burned coal');
  civ.stock.coal = 0;
  assert.equal(powered(group), false);
  assert.ok(facilities(group).research < research, 'unpowered computers do not speed research');
  civ.buildings.reactor = 1; civ.stock.uranium = 1; civ.stock.coal = 2;
  advanceCivilization(sim);
  assert.ok(powered(group) && civ.stock.coal === 2 && civ.stock.uranium < 1, 'the reactor burns uranium, not coal');
});

test('vaccines and hospitals save children; coal smoke adds to disease', () => {
  const { group, agent } = society();
  const civ = group.civilization;
  civ.technologies = ['cultivation', 'herbalism', 'medicine'];
  civ.buildings.clinic = 2; civ.buildings.apothecary = 1;
  const before = careLevel(group);
  agent.age = 1;
  const hazard = annualHazard(agent, group, 0);
  civ.technologies.push('vaccination'); civ.buildings.hospital = 2;
  assert.ok(careLevel(group) > before + .5);
  assert.ok(annualHazard(agent, group, 0) < hazard * .7, 'infant mortality falls sharply');
  const clean = diseaseLoad(group);
  civ.buildings.factory = 3; civ.buildings.powerplant = 1; civ.stock.coal = 5;
  assert.ok(diseaseLoad(group) > clean + .1, 'factories and coal power foul the air');
});

test('a nuclear strike devastates its target, provokes retaliation from an armed rival, and ends the war', () => {
  const { sim, group } = society({ population: 16 });
  const others = sim.agents.slice(8);
  const rival = initializeSociety({ ...group, id: sim.nextGroupId++, name: 'Rival Works', members: others.map(person => person.id), food: 50, wood: 10, shelters: 3 });
  initializeGroupIdeas(rival); initializeCulture(sim, rival);
  group.members = group.members.filter(id => !others.some(person => person.id === id));
  for (const person of others) person.groupId = rival.id;
  sim.groups.push(rival); sim._groupMap.set(rival.id, rival);
  for (const side of [group, rival]) { side.civilization.technologies = TECHNOLOGIES.map(tech => tech.id); side.civilization.buildings.silo = 1; side.civilization.buildings.farm = 3; side.civilization.stock.warheads = 1; }
  sim.diplomacy.relations.push({ a: group.id, b: rival.id, trust: -.5, tension: 90, status: 'war', since: 0, lastContact: 0, warDays: 5, casualties: 0, tradeTotal: 0, reason: 'Test war.' });
  sim.day = 6;
  const fertile = sim._tile(rival.x, rival.y).soil;
  sim._random = () => 0;
  advanceDiplomacy(sim);
  const relation = sim.diplomacy.relations[0];
  assert.equal(sim.diplomacy.nuclearStrikes, 2, 'the target struck back');
  assert.equal(relation.status, 'truce');
  assert.ok(sim.agents.filter(agent => agent.health === 0 && agent._deathCause === 'nuclear war').length > 0);
  assert.ok(group.civilization.buildings.farm < 3 && rival.civilization.buildings.farm < 3, 'cities are levelled');
  assert.ok(sim._tile(rival.x, rival.y).soil < fertile, 'fallout poisons the land');
  assert.ok(group.civilization.stock.warheads === 0 && rival.civilization.stock.warheads === 0);
  assert.ok(relation.casualties <= sim.diplomacy.warDeaths);
});
