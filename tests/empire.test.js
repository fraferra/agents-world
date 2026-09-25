import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';
import { initializeSociety } from '../src/civilization.js';
import { initializeCulture } from '../src/culture.js';
import { initializeGroupIdeas } from '../src/innovation.js';
import { advanceDiplomacy, overlordOf, tributariesOf } from '../src/diplomacy.js';

/** A strong society of `big` adults at war with a weak one of `small`, ten tiles apart. */
function war(big, small) {
  const sim = new Simulation({ seed: 'empire', population: big + small, size: 'compact' });
  sim.groups = []; sim._groupMap = new Map();
  const make = (name, center, people) => {
    const group = initializeSociety({ id: sim.nextGroupId++, name, color: '#809260', ...center, members: people.map(agent => agent.id), food: 400, wood: 20, shelters: 10, culture: 'Kinship', _foundedDay: 0, _lastMoveDay: 0, _shortageDays: 0 });
    initializeGroupIdeas(group);
    sim.groups.push(group); sim._groupMap.set(group.id, group);
    for (const agent of people) Object.assign(agent, center, { groupId: group.id, age: 30, _ageDays: 3600, health: 100, hunger: 0 });
    initializeCulture(sim, group);
    return group;
  };
  const strong = make('Iron Hold', sim._mainlandNear(43, 32), sim.agents.slice(0, big));
  const weak = make('Reed Camp', sim._mainlandNear(53, 32), sim.agents.slice(big));
  sim.diplomacy.relations.push({ a: strong.id, b: weak.id, trust: -.5, tension: 90, status: 'war', since: 0, lastContact: 0, warDays: 40, casualties: 0, tradeTotal: 0, reason: 'Test war.' });
  sim.day = 36;
  sim._buildSpatial();
  return { sim, strong, weak, relation: sim.diplomacy.relations[0] };
}

test('a decisive victory over a sizeable society makes it a tributary; a small one is absorbed', () => {
  const { sim, strong, weak, relation } = war(64, 8);
  sim._random = () => 0;
  advanceDiplomacy(sim);
  assert.equal(relation.status, 'tributary');
  assert.equal(relation.overlord, strong.id);
  assert.equal(overlordOf(sim, weak), strong);
  assert.deepEqual(tributariesOf(sim, strong), [weak]);
  assert.equal(weak.members.length, 8, 'the tributary keeps its people');
  const small = war(64, 6);
  small.sim._random = () => 0;
  advanceDiplomacy(small.sim);
  assert.equal(small.weak.members.length, 0, 'a small people is absorbed');
  assert.notEqual(small.relation.status, 'tributary');
});

test('tributaries pay tribute monthly and rebel when they grow strong', () => {
  const { sim, strong, weak, relation } = war(64, 8);
  sim._random = () => 0;
  advanceDiplomacy(sim);
  const before = { strong: strong.food, weak: weak.food, tools: strong.civilization.stock.tools };
  weak.civilization.stock.tools = 10;
  sim._random = () => .99;
  sim.day = 30 * 3 + Math.max(strong.id, weak.id) % 30;
  advanceDiplomacy(sim);
  assert.equal(relation.status, 'tributary');
  assert.ok(weak.food < before.weak && strong.food > before.strong - 1e-9, 'food flows to the overlord');
  assert.ok(Math.abs(weak.civilization.stock.tools - 9.2) < 1e-9 && strong.civilization.stock.tools > before.tools, 'goods flow to the overlord');
  // The overlord's people scatter: the tributary is now the stronger side.
  for (const id of strong.members.slice(4)) sim._agentMap.get(id).health = 30;
  sim._random = () => 0;
  sim.day += 30;
  advanceDiplomacy(sim);
  assert.equal(relation.status, 'war');
  assert.equal(relation.overlord, undefined);
  assert.ok(sim.events.some(event => /rises against its overlord/.test(event.text)));
});

test('tributary relations survive a save, and forged overlords are rejected', () => {
  const { sim, strong } = war(64, 8);
  sim._random = () => 0;
  advanceDiplomacy(sim);
  delete sim._random;
  const saved = sim.serialize();
  const restored = Simulation.deserialize(structuredClone(saved));
  assert.equal(restored.diplomacy.relations[0].overlord, strong.id);
  assert.deepEqual(restored.serialize(), saved);
  const forged = structuredClone(saved);
  forged.diplomacy.relations[0].overlord = 999;
  assert.throws(() => Simulation.deserialize(forged), /overlord/);
});
