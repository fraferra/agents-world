import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';
import { TECHNOLOGIES, SKILLS, BUILDINGS, initializeSociety, considerCivilization, communicate, observeAction, advanceCivilization } from '../src/civilization.js';

function community() {
  const sim = new Simulation({ seed: 'laboratory', population: 8, size: 'compact' });
  const center = sim._landNear(25.5, 30.5);
  const group = initializeSociety({ id: sim.nextGroupId++, name: 'Test Commons', color: '#809260', ...center, members: sim.agents.map(agent => agent.id), food: 50, wood: 10, shelters: 3, culture: 'Stewardship', _foundedDay: 0, _lastMoveDay: 0, _shortageDays: 0 });
  sim.groups = [group]; sim._groupMap.set(group.id, group);
  for (const agent of sim.agents) {
    Object.assign(agent, center, { groupId: group.id, hunger: 0, energy: 95, health: 100, social: 100 });
    agent.inventory.food = 5;
    agent.mind.values = { security: 0, belonging: 0, autonomy: 0, mastery: 1, care: 0 };
    agent.mind.ambition = 1; agent.mind.needs.stimulation = 90; agent.traits.curiosity = 1;
    agent.skills = Object.fromEntries(SKILLS.map(skill => [skill, 0]));
  }
  sim._buildSpatial();
  sim._random = () => 0;
  return { sim, group, agent: sim.agents[0] };
}

test('individual internal state varies, follows experience, and is not a cosmetic skill counter', () => {
  const sim = new Simulation({ population: 8 });
  assert.notDeepEqual(sim.agents[0].mind.values, sim.agents[1].mind.values);
  const agent = sim.agents[0];
  const before = agent.skills.foraging;
  agent.action = 'foraging';
  for (let i = 0; i < 20; i++) observeAction(sim, agent);
  assert.ok(agent.skills.foraging > before);
  assert.ok(agent.mind.beliefs.abundance >= 0 && agent.mind.beliefs.abundance <= 1);
  const untrained = Simulation.deserialize(sim.serialize());
  const skilled = Simulation.deserialize(sim.serialize());
  untrained.agents[0].skills.foraging = 0;
  skilled.agents[0].skills.foraging = 100;
  for (const world of [untrained, skilled]) {
    const a = world.agents[0];
    a.inventory.food = 0;
    for (const tile of world.tiles) if (tile.terrain !== 'water') tile.food = 1;
    world._forage(a);
  }
  assert.ok(skilled.agents[0].inventory.food > untrained.agents[0].inventory.food, 'skill improves actual food yield');
});

test('survival overrides advanced goals; communal reserves let well-fed people specialize', () => {
  const { sim, group, agent } = community();
  group.civilization.project = { technology: 'stonecraft', progress: 0, required: 65, contributors: [] };
  group.civilization.research.stonecraft = 0;
  agent.hunger = 90;
  assert.equal(considerCivilization(sim, agent, group), false);
  assert.equal(agent.mind.policy.action, 'survive');
  assert.equal(group.civilization.project.progress, 0);
  agent.hunger = 0; agent.inventory.food = 0;
  assert.equal(considerCivilization(sim, agent, group), true, 'shared meals make research possible');
  assert.equal(agent.mind.policy.action, 'research');
  assert.ok(group.civilization.project.progress > 0);
  assert.ok(agent.mind.policy.scores.length > 1);
});

test('research requires labor, benefits from nearby collaborators, and obeys prerequisites', () => {
  const { sim, group, agent } = community();
  group.civilization.project = { technology: 'stonecraft', progress: 0, required: 65, contributors: [] };
  group.civilization.research.stonecraft = 0;
  for (let i = 0; i < 60; i++) { sim.day++; advanceCivilization(sim); }
  assert.equal(group.civilization.project.progress, 0, 'time alone does not research');
  considerCivilization(sim, agent, group);
  const solo = group.civilization.project.progress;
  group.civilization.project.progress = group.civilization.research.stonecraft = 0;
  for (const peer of sim.agents.slice(1)) peer.mind.policy.action = 'research';
  considerCivilization(sim, agent, group);
  assert.ok(group.civilization.project.progress > solo, 'local collaboration boosts effort');
  group.civilization.project.progress = group.civilization.research.stonecraft = 64.99;
  considerCivilization(sim, agent, group);
  assert.ok(group.civilization.technologies.includes('stonecraft'));
  assert.ok(agent.knowledge.includes('stonecraft'));
  assert.equal(sim.civilization.researchCompleted, 1);
  assert.ok(!group.civilization.technologies.includes('metallurgy'));
});

test('communication actually transfers discoveries, skills and resource beliefs within encounter range', () => {
  const { sim, group, agent: teacher } = community();
  const learner = sim.agents[1];
  teacher.knowledge = ['stonecraft'];
  assert.equal(communicate(sim, teacher, learner, true), true);
  assert.deepEqual(learner.knowledge, ['stonecraft']);
  assert.deepEqual(group.civilization.technologies, ['stonecraft']);
  assert.equal(sim.civilization.messages[0].kind, 'idea');
  assert.equal(sim.civilization.ideasShared, 1);
  assert.equal(communicate(sim, teacher, learner, true), false, 'one dialogue per person each day');
  sim.day++;
  teacher.skills.mining = 75;
  communicate(sim, teacher, learner, true);
  assert.ok(learner.skills.mining > 0);
  assert.equal(sim.civilization.messages[0].kind, 'teaching');
  sim.day++; teacher.skills.mining = learner.skills.mining;
  teacher.mind.beliefs.abundance = 1; learner.mind.beliefs.abundance = 0;
  communicate(sim, teacher, learner, true);
  assert.ok(learner.mind.beliefs.abundance > 0);
  sim.day++; learner.x = sim.width - 1;
  assert.equal(communicate(sim, teacher, learner, true), false, 'distant people cannot converse');
});

test('workshop production consumes real inputs and cannot run on empty stores', () => {
  const { sim, group, agent } = community();
  const civ = group.civilization;
  civ.technologies = TECHNOLOGIES.map(tech => tech.id);
  for (const id of Object.keys(BUILDINGS)) civ.buildings[id] = 1;
  for (const person of sim.agents) person.knowledge = [...civ.technologies];
  agent.skills.crafting = 100;
  civ.stock.stone = 5; civ.stock.ore = 0; civ.stock.metal = 8; civ.stock.goods = 12;
  const wood = group.wood, metal = civ.stock.metal;
  considerCivilization(sim, agent, group);
  assert.equal(agent.mind.policy.action, 'craft');
  assert.ok(civ.stock.tools > 0);
  assert.equal(group.wood, wood - .3);
  assert.equal(civ.stock.metal, metal - .2);
  // Output is conserved: what the maker keeps privately plus the common stock.
  assert.ok(Math.abs(civ.production.tools - civ.stock.tools - agent.wealth) < 1e-3, "private holdings are stored to four decimals");
  group.wood = 0; civ.stock.stone = 0; civ.stock.metal = 0;
  const tools = civ.stock.tools;
  considerCivilization(sim, agent, group);
  assert.notEqual(agent.mind.policy.action, 'craft');
  assert.equal(civ.stock.tools, tools, 'no material-free tool production');
});

test('mining depletes finite mineral deposits and contributes gathered material to industry', () => {
  const { sim, group, agent } = community();
  group.civilization.technologies = ['stonecraft'];
  group.civilization.stock.stone = 0;
  group.civilization.project = null;
  agent.skills.mining = 100; agent.mind.values.mastery = 0;
  agent.mind.needs.stimulation = 0; agent.traits.curiosity = 0; agent.mind.ambition = 0;
  for (const tile of sim.tiles) tile.stone = 0;
  const tile = sim._tile(agent.x, agent.y); tile.stone = 1;
  considerCivilization(sim, agent, group);
  assert.equal(agent.mind.policy.action, 'quarry');
  assert.ok(tile.stone < 1);
  assert.ok(group.civilization.stock.stone > 0);
  assert.ok(Math.abs(tile.stone + group.civilization.stock.stone - 1) < 1e-10);
});

test('granaries reduce actual spoilage without creating same-day food', () => {
  const { sim, group } = community();
  group.civilization.technologies = ['stonecraft', 'pottery'];
  group.civilization.buildings.granary = 1;
  group.food = 20;
  sim._ecology();
  assert.equal(group.food, 20 * .9995);
  group.food += 5;
  const afterProduction = group.food;
  advanceCivilization(sim);
  assert.equal(group.food, afterProduction, 'end-of-day accounting never invents food');
});

test('barter only occurs for complementary needs and conserves both goods', () => {
  const { sim, group, agent } = community();
  const neighbor = initializeSociety({ ...group, id: sim.nextGroupId++, name: 'Neighbor', members: [sim.agents[1].id], food: 1, wood: 0 });
  neighbor.civilization.stock.tools = 4;
  sim.groups.push(neighbor); sim._groupMap.set(neighbor.id, neighbor);
  group.members = group.members.filter(id => id !== sim.agents[1].id);
  sim.agents[1].groupId = neighbor.id;
  group.civilization.technologies = TECHNOLOGIES.map(t => t.id);
  for (const id of Object.keys(BUILDINGS)) group.civilization.buildings[id] = 1;
  for (const person of sim.agents) person.knowledge = [...group.civilization.technologies];
  group.wood = 0; group.civilization.stock.stone = 0;
  agent.skills.leadership = 100; agent.skills.scholarship = 50; agent.mind.ambition = 1;
  agent.mind.values.mastery = 0; agent.traits.curiosity = 0; agent.mind.needs.stimulation = 0;
  sim.day = 15;
  const food = group.food + neighbor.food;
  const tools = group.civilization.stock.tools + neighbor.civilization.stock.tools;
  considerCivilization(sim, agent, group);
  assert.equal(agent.mind.policy.action, 'trade');
  assert.equal(sim.civilization.tradeVolume, 3);
  assert.equal(group.food + neighbor.food, food);
  assert.equal(group.civilization.stock.tools + neighbor.civilization.stock.tools, tools);
  assert.equal(group.civilization.stock.tools, 1);
});

test('sustained worlds develop several technologies, productive industries and bounded communication', () => {
  const sim = new Simulation({ seed: 'moss-17' });
  sim.step(12 * 120);
  const state = sim.snapshot();
  assert.ok(state.stats.technologies >= 4);
  assert.ok(state.stats.industries > 10);
  assert.ok(state.stats.conversations > 1000);
  assert.ok(state.stats.ideasShared > 10);
  assert.ok(state.stats.goodsProduced > 1);
  assert.ok(state.civilization.messages.length <= 80);
  assert.ok(state.agents.every(agent => agent.mind.memories.length <= 8 && agent.mind.policy.scores.length <= 5));
  const restored = Simulation.deserialize(sim.serialize());
  sim.step(240); restored.step(240);
  assert.deepEqual(restored.serialize(), sim.serialize(), 'industrial/cognitive state continues exactly');
});

test('new save fields reject non-finite skills, forged technologies, resources and oversized memories', () => {
  const sim = new Simulation(); sim.step(240);
  for (const corrupt of [
    save => { save.agents[0].skills.scholarship = Infinity; },
    save => { save.agents[0].knowledge = ['unlimited-energy']; },
    save => { save.agents[0].mind.beliefs.trust = -1; },
    save => { save.agents[0].mind.role = 'Wizard'; },
    save => { save.agents[0].mind.memories = Array(9).fill({ day: 0, type: 'test', text: 'Bad' }); },
    save => { save.civilization.messages = Array(81).fill({}); },
    save => { save.groups[0].civilization.stock.tools = -1; },
    save => { save.groups[0].civilization.buildings.forge = 999; },
  ]) {
    const state = sim.serialize(); corrupt(state);
    assert.throws(() => Simulation.deserialize(state), /Invalid/);
  }
});
