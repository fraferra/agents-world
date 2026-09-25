import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';
import { TECHNOLOGIES, initializeSociety } from '../src/civilization.js';
import { initializeCulture } from '../src/culture.js';
import { initializeGroupIdeas } from '../src/innovation.js';
import { proposeFrontier, completeFrontier, advanceBreakthroughs, advances, breakthroughById } from '../src/breakthroughs.js';

function societies(count = 2) {
  const sim = new Simulation({ seed: 'frontier', population: 12 * count, size: 'compact' });
  sim.groups = []; sim._groupMap = new Map();
  const center = sim._mainlandNear(48, 32);
  for (let index = 0; index < count; index++) {
    const people = sim.agents.slice(index * 12, index * 12 + 12);
    const group = initializeSociety({ id: sim.nextGroupId++, name: `Works ${index}`, color: '#809260', ...center, members: people.map(agent => agent.id), food: 80, wood: 20, shelters: 4, culture: 'Kinship', _foundedDay: 0, _lastMoveDay: 0, _shortageDays: 0 });
    initializeGroupIdeas(group);
    sim.groups.push(group); sim._groupMap.set(group.id, group);
    for (const agent of people) Object.assign(agent, center, { groupId: group.id });
    initializeCulture(sim, group);
    group.civilization.technologies = TECHNOLOGIES.map(tech => tech.id);
    group.civilization.buildings.forge = 1; group.civilization.buildings.kiln = 1;
  }
  return { sim, groups: sim.groups };
}

test('a frontier project combines two known things from different fields into something deeper', () => {
  const { sim, groups: [group] } = societies(1);
  const frontier = proposeFrontier(sim, group);
  assert.ok(frontier.name.length > 2);
  assert.equal(frontier.parents.length, 2);
  assert.ok(frontier.parents.every(id => group.civilization.technologies.includes(id)));
  assert.ok(frontier.depth >= 2 && frontier.required > 0);
  assert.ok(Object.values(frontier.effects).some(value => value > 0), 'it does something');
});

test('finished research becomes a breakthrough once materials exist, and its advances apply', () => {
  const { sim, groups: [group] } = societies(1);
  const civ = group.civilization;
  civ.frontier = proposeFrontier(sim, group);
  civ.frontier.progress = civ.frontier.required;
  for (const key of Object.keys(civ.frontier.cost)) civ.stock[key] = 0;
  assert.equal(completeFrontier(sim, group, sim.agents[0]), null, 'no materials, no prototype');
  for (const [key, value] of Object.entries(civ.frontier.cost)) civ.stock[key] = value;
  const made = completeFrontier(sim, group, sim.agents[0]);
  assert.ok(made && breakthroughById(sim, made.id) === made);
  assert.deepEqual(civ.breakthroughs, [made.id]);
  assert.equal(civ.frontier, null);
  assert.ok(Object.values(advances(group)).some(value => value !== 0));
  // Breakthroughs build on breakthroughs: the next can go deeper still.
  const next = proposeFrontier(sim, group);
  assert.ok(next.depth >= 2);
});

test('research finished while materials were short completes on its own when they arrive', () => {
  const { sim, groups: [group] } = societies(1);
  const civ = group.civilization;
  civ.frontier = proposeFrontier(sim, group);
  civ.frontier.progress = civ.frontier.required;
  for (const [key, value] of Object.entries(civ.frontier.cost)) civ.stock[key] = value;
  sim.day = 30 + (group.id + 7) % 30 - 30 % 30;
  while (sim.day % 30 !== (group.id + 7) % 30) sim.day++;
  advanceBreakthroughs(sim);
  assert.equal(civ.breakthroughs.length, 1);
});

test('breakthroughs spread to trading partners and survive a save exactly', () => {
  const { sim, groups: [a, b] } = societies(2);
  a.civilization.frontier = proposeFrontier(sim, a);
  a.civilization.frontier.progress = a.civilization.frontier.required;
  for (const [key, value] of Object.entries(a.civilization.frontier.cost)) a.civilization.stock[key] = value;
  const made = completeFrontier(sim, a, sim.agents[0]);
  sim.diplomacy.relations.push({ a: a.id, b: b.id, trust: .5, tension: 0, status: 'trade', since: 0, lastContact: 0, warDays: 0, casualties: 0, tradeTotal: 5, reason: 'Test.' });
  sim._random = () => 0;
  sim.day = 1; while (sim.day % 30 !== (b.id + 7) % 30) sim.day++;
  advanceBreakthroughs(sim);
  assert.ok(b.civilization.breakthroughs.includes(made.id), 'a trading partner took it up');
  delete sim._random;
  const saved = sim.serialize();
  const restored = Simulation.deserialize(structuredClone(saved));
  assert.deepEqual(restored.serialize(), saved);
  const forged = structuredClone(saved);
  forged.groups[1].civilization.breakthroughs = ['advance-999'];
  assert.throws(() => Simulation.deserialize(forged), /breakthrough/);
});

test('running totals of advances equal a fresh sum however the list grew', async () => {
  const { sumAdvances } = await import('../src/breakthroughs.js');
  const { Simulation } = await import('../src/simulation.js');
  const sim = new Simulation({ seed: 'running-totals', population: 10, size: 'compact' });
  const keys = ['production', 'food', 'research', 'health', 'combat', 'trade', 'energy', 'automation', 'growth', 'pollution', 'unrest'];
  for (let i = 1; i <= 40; i++) sim.breakthroughs.list.push({ id: `advance-${i}`, effects: Object.fromEntries(keys.map((key, k) => [key, ((i * 7 + k * 13) % 17 - 6) / 37])) });
  const ids = [];
  for (let i = 1; i <= 40; i++) { ids.push(`advance-${i}`); sumAdvances(sim, ids); }
  assert.deepEqual(sumAdvances(sim, ids), sumAdvances(sim, [...ids]), 'incremental equals from scratch');
});
