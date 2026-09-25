import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';
import { initializeSociety, harvestSoil } from '../src/civilization.js';
import { initializeGroupIdeas } from '../src/innovation.js';
import { advanceDiplomacy, tradeAccess, recordTrade, restoreDiplomacy } from '../src/diplomacy.js';

function neighbors() {
  const sim = new Simulation({ seed: 'neighboring-camps', population: 16, size: 'compact' });
  const center = sim._mainlandNear(48, 32);
  const groups = [0, 1].map(index => {
    const group = initializeSociety({ id: sim.nextGroupId++, name: `Camp ${index}`, color: '#809260', ...center, members: [], food: 20, wood: 10, shelters: 2, culture: 'Kinship', _foundedDay: 0, _lastMoveDay: 0, _shortageDays: 0 });
    initializeGroupIdeas(group);
    group.civilization.stock.tools = 4; group.civilization.stock.goods = 3;
    for (const agent of sim.agents.slice(index * 8, index * 8 + 8)) {
      Object.assign(agent, center, { age: 25, _ageDays: 25 * 120, health: 100, hunger: 0, groupId: group.id });
      group.members.push(agent.id);
    }
    return group;
  });
  sim.groups = groups; sim._groupMap = new Map(groups.map(g => [g.id, g]));
  sim._random = () => 0;
  sim.day = 12; advanceDiplomacy(sim);
  return { sim, a: groups[0], b: groups[1], relation: sim.diplomacy.relations[0] };
}

test('trade builds trust, alliances are conditional, war closes exchange', () => {
  const { sim, a, b, relation } = neighbors();
  assert.equal(tradeAccess(sim, a, b), true);
  for (let i = 0; i < 24; i++) recordTrade(sim, a, b, 3);
  assert.equal(relation.tradeTotal, 72);
  sim.day = 24; advanceDiplomacy(sim);
  assert.equal(relation.status, 'alliance');
  assert.equal(sim.diplomacy.treaties, 1);
  relation.status = 'war';
  assert.equal(tradeAccess(sim, a, b), false);
  recordTrade(sim, a, b, 3);
  assert.equal(relation.tradeTotal, 72, 'hostile groups cannot book an exchange');
});

test('scarcity and sustained nearby rivalry can lead to war, separated camps cannot', () => {
  const { sim, a, b, relation } = neighbors();
  a.food = b.food = 0;
  for (const agent of sim.agents) agent.hunger = 65;
  for (let day = 24; day <= 1200 && relation.status !== 'war'; day += 12) { sim.day = day; advanceDiplomacy(sim); }
  assert.equal(relation.status, 'war');
  assert.equal(sim.diplomacy.warsStarted, 1);
  b.x += 60;
  sim.day++; advanceDiplomacy(sim);
  assert.equal(relation.status, 'truce');
  assert.match(relation.reason, /separated/);
});

test('war consumes provisions, transfers loot conservatively and damages actual agents', () => {
  const { sim, a, b, relation } = neighbors();
  relation.status = 'war'; relation.since = sim.day;
  sim.diplomacy.warsStarted = 1;
  const food = a.food + b.food, wood = a.wood + b.wood;
  const tools = a.civilization.stock.tools + b.civilization.stock.tools;
  const goods = a.civilization.stock.goods + b.civilization.stock.goods;
  sim.day = 18; advanceDiplomacy(sim);
  assert.ok(a.food + b.food < food, 'campaign consumes real provisions');
  assert.ok(Math.abs(a.wood + b.wood - wood) < 1e-9);
  assert.ok(Math.abs(a.civilization.stock.tools + b.civilization.stock.tools - tools) < 1e-9);
  assert.ok(Math.abs(a.civilization.stock.goods + b.civilization.stock.goods - goods) < 1e-9);
  assert.ok(sim.agents.some(agent => agent.health < 100));
  assert.equal(sim.diplomacy.raids, 1);
  // Wars end when a side's weariness passes its resolve: here, after years of fighting.
  const war = sim.diplomacy.wars[0];
  assert.ok(war && relation.warId === war.id, 'the war has a record');
  war.start = sim.day - 120 * 8;
  sim.day = 31; advanceDiplomacy(sim);
  assert.equal(relation.status, 'truce', 'wars end through exhaustion');
  assert.ok(war.end !== null && war.outcome.text.length);
});

test('diplomacy state validates identities and accounting and has no aliases', () => {
  const { sim } = neighbors();
  const restored = restoreDiplomacy(sim.diplomacy, sim);
  assert.deepEqual(restored, sim.diplomacy);
  restored.relations[0].tension = 100;
  assert.notEqual(restored.relations[0].tension, sim.diplomacy.relations[0].tension);
  for (const mutate of [r => r.trust = Infinity, r => r.a = r.b, r => r.status = 'conquest', r => r.casualties = 4]) {
    const raw = structuredClone(sim.diplomacy); mutate(raw.relations[0]);
    assert.throws(() => restoreDiplomacy(raw, sim), /Invalid diplomacy/);
  }
});

test('combat deaths leave no dead inhabitants and active wars resume exactly from a save', () => {
  const { sim, a, b, relation } = neighbors();
  relation.status = 'war'; sim.diplomacy.warsStarted = 1;
  a.food = 100; b.food = 0;
  for (const id of b.members) sim._agentMap.get(id).health = 36;
  const originalRandom = Simulation.prototype._random;
  sim._random = () => .6;
  sim.day = 18; advanceDiplomacy(sim); sim._removeDead();
  sim._random = originalRandom;
  assert.ok(sim.diplomacy.warDeaths > 0);
  assert.equal(sim.deaths, sim.diplomacy.warDeaths);
  assert.equal(sim.agents.length, sim.config.population - sim.deaths);
  assert.ok(sim.agents.every(agent => agent.health > 0));
  assert.ok(sim.events.some(event => event.type === 'death' && /war/.test(event.text)));
  const restored = Simulation.deserialize(JSON.parse(JSON.stringify(sim.serialize())));
  sim.step(24); restored.step(24);
  assert.deepEqual(restored.serialize(), sim.serialize());
});

test('adopted combat designs give a society a real advantage under identical raid conditions', () => {
  const baseline = neighbors(), improved = neighbors();
  const fields = ['food', 'gathering', 'crafting', 'healing', 'storage', 'trade', 'combat', 'learning'];
  for (let i = 1; i <= 10; i++) {
    const id = `idea-${i}`;
    improved.sim.innovation.discoveries.push({ id, kind: 'invention', effects: Object.fromEntries(fields.map(key => [key, key === 'combat' ? .3 : 0])) });
    improved.a.civilization.ideas.push(id);
  }
  for (const fixture of [baseline, improved]) {
    fixture.relation.status = 'war'; fixture.sim.diplomacy.warsStarted = 1;
    fixture.sim._random = () => .6; fixture.sim.day = 18;
    advanceDiplomacy(fixture.sim);
  }
  assert.ok(baseline.a.wood < 10, 'equal forces lose this seeded encounter');
  assert.ok(improved.a.wood > 10, 'better combat designs change who captures existing supplies');
  const damage = fixture => fixture.a.members.reduce((total, id) => total + 100 - fixture.sim._agentMap.get(id).health, 0);
  assert.ok(damage(improved) < damage(baseline), 'technology also reduces combat damage');
});

test('farms share finite soil, cannot create food on depleted land, and technology improves resource efficiency', () => {
  const { sim, a, b } = neighbors();
  a.civilization.buildings.farm = b.civilization.buildings.farm = 1;
  for (const tile of sim.tiles) tile.soil = 0;
  const plot = sim._tile(a.x, a.y); plot.soil = 1;
  const first = harvestSoil(sim, a, 1, 1);
  const second = harvestSoil(sim, b, 100, 1);
  assert.equal(first + second, 2, 'overlapping farms spend the same nutrient budget');
  assert.equal(harvestSoil(sim, a, 100, 1), 0);
  plot.soil = 1;
  assert.equal(harvestSoil(sim, a, 100, 2), 4, 'better designs yield more food from the same soil');
  assert.ok(sim.tiles.every(tile => tile.soil >= 0));
});
