import test from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { Simulation } from '../src/simulation.js';
import { initializeSociety } from '../src/civilization.js';
import { initializeGroupIdeas } from '../src/innovation.js';
import { initializeCulture } from '../src/culture.js';
import { SILER, annualHazard, naturalFertility, compatible, mother, postpartumDays, diseaseLoad } from '../src/lifecourse.js';
import { ECONOMIES, economyOf, keptShare, shareWealth, bequeath, gini } from '../src/economy.js';
import { organisationalCapacity, considerFission } from '../src/expansion.js';

function camp(size = 10, seed = 'realism') {
  const sim = new Simulation({ seed, population: size, size: 'compact' });
  const center = sim._landNear(25.5, 30.5);
  const group = initializeSociety({ id: sim.nextGroupId++, name: 'Camp', color: '#809260', ...center, members: sim.agents.map(agent => agent.id), food: 40, wood: 10, shelters: 3, culture: 'Stewardship', _foundedDay: 0, _lastMoveDay: 0, _shortageDays: 0 });
  initializeGroupIdeas(group);
  sim.groups = [group]; sim._groupMap.set(group.id, group);
  for (const agent of sim.agents) Object.assign(agent, center, { groupId: group.id, hunger: 0, health: 100 });
  initializeCulture(sim, group);
  return { sim, group };
}

test('mortality follows the Siler hazards of real small-scale societies', () => {
  const f = SILER.forager;
  const person = age => ({ age, hunger: 0 });
  const expected = age => f.a1 * Math.exp(-f.b1 * age) + f.a2 + f.a3 * Math.exp(f.b3 * age);
  for (const age of [0, 5, 30, 70]) assert.ok(Math.abs(annualHazard(person(age), null, 0) - expected(age)) < 1e-12, `forager hazard at ${age}`);
  // Survival to 15 under forager hazards is close to the observed 57%.
  let survival = 1;
  for (let day = 0; day < 15 * 120; day++) survival *= Math.exp(-annualHazard(person(day / 120), null, 0) / 120);
  assert.ok(survival > .5 && survival < .66, `l15 = ${survival}`);
  // Medicine moves infant and background mortality toward acculturated values; hunger raises it.
  const { group } = camp();
  group.civilization.technologies.push('herbalism', 'medicine'); group.civilization.buildings.clinic = 2;
  assert.ok(annualHazard(person(1), group, 0) < annualHazard(person(1), null, 0));
  assert.ok(annualHazard({ age: 1, hunger: 90 }, null, 0) > annualHazard(person(1), null, 0) * 2);
});

test('fertility follows a natural age schedule, needs a mixed-sex couple and is spaced by lactation', () => {
  assert.equal(naturalFertility(12), 0);
  assert.equal(naturalFertility(52), 0);
  assert.ok(naturalFertility(24) > naturalFertility(40) && naturalFertility(40) > naturalFertility(46));
  const woman = { sex: 'female', attraction: 'different' }, man = { sex: 'male', attraction: 'different' }, other = { sex: 'female', attraction: 'same' };
  assert.ok(compatible(woman, man) && !compatible(woman, other) && compatible(other, { sex: 'female', attraction: 'both' }));
  assert.equal(mother(woman, man), woman);
  assert.equal(mother(other, woman), null, 'same-sex couples partner but do not conceive');
  const { group } = camp();
  const mobile = postpartumDays(group);
  group.civilization.buildings.farm = 1;
  assert.ok(postpartumDays(group) < mobile, 'settled farming shortens birth intervals');
  const sim = new Simulation({ seed: 'sexes', population: 400, size: 'compact' });
  const males = sim.agents.filter(agent => agent.sex === 'male').length / sim.agents.length;
  assert.ok(males > .44 && males < .58);
});

test('populations follow realistic life courses: high child mortality, adult longevity, slow growth', () => {
  const sim = new Simulation({ seed: 'life-tables', size: 'standard', population: 96 });
  sim.step(120 * 60);
  const stats = sim._stats();
  assert.ok(stats.childDeathShare > .3 && stats.childDeathShare < .7, `child share ${stats.childDeathShare}`);
  assert.ok(stats.meanAgeAtDeath > 18 && stats.meanAgeAtDeath < 45, `mean age at death ${stats.meanAgeAtDeath}`);
  assert.ok(stats.population > 30, 'the population persists');
  assert.ok(sim.agents.some(agent => agent.age > 60), 'some adults reach old age');
});

test('wealth is kept, shared, inherited and grows more unequal where it can be defended', () => {
  const { sim, group } = camp(12);
  assert.equal(economyOf(group), 'foraging');
  const foraging = keptShare(group, 10);
  group.civilization.buildings.pasture = 2;
  assert.equal(economyOf(group), 'pastoral');
  assert.ok(keptShare(group, 10) > foraging * 3, 'herders keep far more of their output');
  // Demand sharing conserves wealth and narrows gaps.
  const [rich, ...rest] = sim.agents;
  rich.wealth = 100; for (const agent of rest) agent.wealth = 0;
  group.civilization.buildings.pasture = 0;
  const before = gini(sim.agents.map(agent => agent.wealth));
  shareWealth(sim, group);
  assert.ok(Math.abs(sim.agents.reduce((sum, agent) => sum + agent.wealth, 0) - 100) < 1e-3, 'holdings are stored to four decimals');
  assert.ok(gini(sim.agents.map(agent => agent.wealth)) < before);
  // Estates pass to children at the rate of the economy; the rest returns to the community.
  const heir = sim.agents[1]; rich.children = [heir.id]; heir.wealth = 0; rich.wealth = 50;
  const food = group.food;
  bequeath(sim, rich, group);
  assert.ok(Math.abs(heir.wealth - 50 * ECONOMIES.foraging.inherit) < 1e-9);
  assert.ok(Math.abs(group.food - food - 50 * (1 - ECONOMIES.foraging.inherit)) < 1e-9);
  assert.equal(gini([1, 1, 1, 1]), 0);
  assert.ok(gini([0, 0, 0, 10]) > .7);
});

test('the collective brain: unheld, unrecorded technologies are forgotten', () => {
  const { sim, group } = camp();
  const civ = group.civilization;
  civ.technologies = ['stonecraft', 'cultivation', 'hunting'];
  for (const agent of sim.agents) agent.knowledge = ['stonecraft', 'cultivation'];
  civ.immuneUntil = 1e6; // keep epidemics out of this test
  return import('../src/civilization.js').then(({ advanceCivilization }) => {
    sim.day = (group.id + 20) % 30; // each society's monthly review day
    for (let month = 0; month < 14; month++) { sim.day += 30; advanceCivilization(sim); }
    assert.ok(!civ.technologies.includes('hunting'), 'no one knew hunting');
    assert.ok(civ.technologies.includes('stonecraft') && civ.technologies.includes('cultivation'));
    assert.ok(sim.events.some(event => /forgotten hunting/.test(event.text)));
  });
});

test('epidemics arise and spread along contacts; endemic disease grows with settlement', () => {
  const { sim, group } = camp(30);
  const load = diseaseLoad(group);
  group.civilization.buildings.farm = 4; group.civilization.buildings.pasture = 3;
  assert.ok(diseaseLoad(group) > load, 'sedentism and livestock raise endemic disease');
  return import('../src/civilization.js').then(({ startOutbreak }) => {
    startOutbreak(sim, group, null);
    assert.ok(group.civilization.outbreakUntil > sim.day);
    const infected = annualHazard({ age: 30, hunger: 0 }, group, sim.day);
    assert.ok(infected > annualHazard({ age: 30, hunger: 0 }, group, group.civilization.outbreakUntil + 1));
  });
});

test('persistent climate: dry and wet years come in runs', () => {
  const sim = new Simulation({ seed: 'weather-runs', population: 4, size: 'compact' });
  const values = [];
  for (let i = 0; i < 400; i++) { sim._climate(); values.push(sim.weather.climate); }
  const mean = values.reduce((a, b) => a + b) / values.length;
  let lag = 0, variance = 0;
  for (let i = 1; i < values.length; i++) { lag += (values[i] - mean) * (values[i - 1] - mean); variance += (values[i] - mean) ** 2; }
  assert.ok(lag / variance > .5, 'strong year-to-year persistence');
  assert.ok(Math.max(...values) - Math.min(...values) > .8);
});

test('scalar stress splits groups beyond their organisational capacity along lines of friendship', () => {
  const { sim, group } = camp(40, 'big-band');
  group.civilization.culture.norms.hierarchy = 0; group.civilization.culture.founded = 0; sim.day = 800;
  assert.ok(group.members.length > organisationalCapacity(group));
  const [instigator, ...others] = sim.agents;
  instigator._stress = 150; instigator.age = 30;
  for (const friend of others.slice(0, 6)) { const bond = sim._remember(instigator, friend); bond.strength = .9; }
  sim._random = () => 0;
  const split = considerFission(sim, group, (site, settlers) => sim._foundColony(site, settlers));
  assert.ok(split, 'the group splits');
  assert.ok(split.settlers.includes(instigator) && split.settlers.length >= 4);
  assert.equal(split.offshoot.civilization.culture.parentId, null, 'an offshoot, not a colony');
  assert.equal(group.members.length + split.offshoot.members.length, 40);
});

test('version 6 worlds resume exactly, and earlier saves gain sexes and life courses deterministically', () => {
  const sim = new Simulation({ seed: 'realism-save', size: 'standard', population: 96 });
  sim.step(120 * 10);
  const restored = Simulation.deserialize(JSON.parse(JSON.stringify(sim.serialize())));
  sim.step(120); restored.step(120);
  assert.ok(isDeepStrictEqual(restored.serialize(), sim.serialize()));
  for (const corrupt of [save => { save.agents[0].sex = 'unknown'; }, save => { save.agents[0].wealth = -5; }, save => { save.vital.deathAges = [500]; }, save => { save.weather.climate = 9; }]) {
    const state = sim.serialize(); corrupt(state);
    assert.throws(() => Simulation.deserialize(state), /Invalid/);
  }
  const legacy = sim.serialize();
  legacy.version = 5; delete legacy.vital; delete legacy.weather.climate;
  for (const agent of legacy.agents) { delete agent.sex; delete agent.attraction; delete agent.wealth; }
  const migrated = Simulation.deserialize(structuredClone(legacy)), twin = Simulation.deserialize(structuredClone(legacy));
  assert.ok(migrated.agents.every(agent => agent.sex && agent.attraction && agent.wealth === 0));
  for (const agent of migrated.agents) if (agent.partnerId) assert.notEqual(agent.sex, migrated._agentMap.get(agent.partnerId).sex, 'existing partners become mixed-sex couples');
  migrated.step(60); twin.step(60);
  assert.ok(isDeepStrictEqual(migrated.serialize(), twin.serialize()));
});
