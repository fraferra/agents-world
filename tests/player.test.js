import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';

const developed = (() => { const sim = new Simulation({ seed: 'in-your-hands', population: 40, size: 'compact' }); sim.step(600); return sim.serialize(); })();
const world = () => Simulation.deserialize(structuredClone(developed));
const adultIn = sim => sim.agents.find(agent => agent.age >= 18 && agent.groupId && agent.health > 60);

test('taking charge of a person, directing them to walk, work and talk, and letting go', () => {
  const sim = world(), agent = adultIn(sim);
  assert.match(sim.command({ type: 'possess', id: agent.id }), /take charge/);
  const target = sim._landNear(agent.x + 4, agent.y);
  sim.command({ type: 'order', kind: 'move', x: target.x, y: target.y });
  sim.step(12);
  assert.ok(Math.hypot(agent.x - target.x, agent.y - target.y) < 1.5, 'they went where directed');
  assert.equal(sim.player.order, null, 'a finished journey clears the order');
  const view = sim.view({ detailId: agent.id }).player;
  assert.equal(view.id, agent.id);
  assert.ok(view.work.length > 0, 'work their society supports is offered');
  sim.command({ type: 'order', kind: 'work', action: view.work[0].action });
  sim.step(1);
  assert.equal(agent.mind.policy.reason, 'Directed from beyond.');
  const other = sim.agents.find(person => person !== agent && person.age >= 16);
  sim.command({ type: 'order', kind: 'talk', target: other.id });
  for (let day = 0; day < 60 && sim.player.order; day++) sim.step(1);
  assert.ok(agent._relations.some(relation => relation.id === other.id), 'they met and got to know each other');
  assert.throws(() => sim.command({ type: 'order', kind: 'work', action: 'telepathy' }), /not available/);
  sim.command({ type: 'release' });
  assert.equal(sim.player.id, null);
});

test('founding a society, a company or a party from a directed life, within the rules of the world', () => {
  const sim = world(), agent = adultIn(sim);
  sim.command({ type: 'possess', id: agent.id });
  const before = sim.groups.length;
  assert.match(sim.command({ type: 'order', kind: 'found-society' }), /founded by/);
  assert.equal(sim.groups.length, before + 1);
  assert.equal(sim._groupMap.get(agent.groupId).members.includes(agent.id), true);
  assert.throws(() => sim.command({ type: 'order', kind: 'found-company' }), /commerce|wealth|works/);
  assert.throws(() => sim.command({ type: 'order', kind: 'found-party' }), /organised/);
});

test('the directed life survives a save exactly, and death releases it', () => {
  const sim = world(), agent = adultIn(sim);
  sim.command({ type: 'possess', id: agent.id });
  sim.command({ type: 'order', kind: 'explore' });
  const saved = sim.serialize();
  const restored = Simulation.deserialize(structuredClone(saved));
  assert.deepEqual(restored.serialize(), saved);
  restored.step(20); sim.step(20);
  assert.deepEqual(restored.serialize(), sim.serialize());
  agent.health = 0; sim.step(1);
  assert.equal(sim.player.id, null, 'a life that ends leaves your charge');
});
