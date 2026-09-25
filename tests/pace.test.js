import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';
import { TECHNOLOGIES, BUILDINGS, SKILLS, initializeSociety, considerCivilization } from '../src/civilization.js';
import { initializeCulture } from '../src/culture.js';
import { initializeGroupIdeas } from '../src/innovation.js';
import { PERSONALITY } from '../src/psyche.js';

function society() {
  const sim = new Simulation({ seed: 'research-pace', population: 8, size: 'compact' });
  const center = sim._mainlandNear(48, 32);
  const group = initializeSociety({ id: sim.nextGroupId++, name: 'Test Hearth', color: '#809260', ...center, members: sim.agents.map(agent => agent.id), food: 50, wood: 10, shelters: 3, culture: 'Stewardship', _foundedDay: 0, _lastMoveDay: 0, _shortageDays: 0 });
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
const upTo = id => { const index = TECHNOLOGIES.findIndex(tech => tech.id === id); return TECHNOLOGIES.slice(0, index).map(tech => tech.id); };

test('societies do not take up research whose demonstration their land cannot supply', () => {
  const { sim, group, agent } = society();
  const civ = group.civilization;
  // Every foundation is known, so the modern technologies are the only options.
  civ.technologies = upTo('chemistry');
  for (const tile of sim.tiles) { tile.coal = 0; tile.herbs = 0; }
  delete civ.survey;
  considerCivilization(sim, agent, group);
  assert.notEqual(civ.project?.technology, 'steam', 'no coal within reach: no steam engine');
  assert.notEqual(civ.project?.technology, 'chemistry', 'no herbs within reach: no chemistry');
});

test('a producer the society knows how to build makes its materials worth planning for', () => {
  const { sim, group, agent } = society();
  const civ = group.civilization;
  civ.technologies = upTo('chemistry').filter(id => id !== 'navigation');
  for (const tile of sim.tiles) if (tile.terrain !== 'water') tile.fiber = .5;
  delete civ.survey;
  assert.equal(civ.buildings.loom, 0);
  sim._random = () => .99;
  considerCivilization(sim, agent, group);
  // With no loom yet, navigation's cloth still counts as obtainable because a loom can be built.
  const options = TECHNOLOGIES.filter(tech => !civ.technologies.includes(tech.id) && tech.requires.every(id => civ.technologies.includes(id))).map(tech => tech.id);
  assert.ok(options.includes('navigation'));
  assert.ok(civ.project, 'a project was chosen');
});

test('a finished idea waiting on cloth sends people to the loom', () => {
  const { sim, group, agent } = society();
  const civ = group.civilization;
  civ.technologies = TECHNOLOGIES.map(tech => tech.id).filter(id => id !== 'navigation');
  for (const id of Object.keys(BUILDINGS)) civ.buildings[id] = 1;
  Object.assign(civ.stock, { tools: 20, goods: 20, metal: 20, remedies: 20, bricks: 20, stone: 20, ore: 20, coal: 20, uranium: 20, electronics: 20, machines: 20, warheads: 20, cloth: 0, fiber: 2 });
  civ.project = { technology: 'navigation', progress: 420, required: 420, contributors: [] };
  civ.research.navigation = 420;
  agent.skills.crafting = 40;
  sim._random = () => 0;
  considerCivilization(sim, agent, group);
  assert.equal(agent.mind.policy.action, 'weave');
});

test('toolmakers leave the metal a building needs', () => {
  const { sim, group, agent } = society();
  const civ = group.civilization;
  civ.technologies = upTo('chemistry').concat(['chemistry', 'steam']);
  // Everything else is built, so the factory (4 metal) is the next building.
  for (const [id, building] of Object.entries(BUILDINGS)) if (id !== 'factory' && civ.technologies.includes(building.technology)) civ.buildings[id] = 1;
  Object.assign(civ.stock, { metal: 4, stone: 5, tools: 0, bricks: 6, coal: 5, clay: 5, goods: 20, cloth: 20, remedies: 20 });
  group.wood = 10;
  agent.skills.crafting = 50; agent.mind.values.mastery = 1;
  sim._random = () => 0;
  considerCivilization(sim, agent, group);
  assert.equal(agent.mind.policy.action, 'craft');
  assert.equal(civ.stock.metal, 4, 'tools were made from stone, not the factory’s metal');
  assert.ok(civ.stock.stone < 5);
});
