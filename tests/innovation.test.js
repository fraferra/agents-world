import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';
import { initializeSociety, TECHNOLOGIES } from '../src/civilization.js';
import { initializeInnovation, initializeAgentIdeas, initializeGroupIdeas, attemptInnovation, reflectBelief, spreadIdeas, innovationEffects, advanceInnovation, innovationStats, restoreInnovation, restoreAgentIdeas, restoreGroupIdeas } from '../src/innovation.js';

function laboratory(seed = 'open-laboratory') {
  const sim = new Simulation({ seed, population: 6, size: 'compact' });
  initializeInnovation(sim);
  const center = sim._landNear(25, 30);
  const group = initializeGroupIdeas(initializeSociety({ id: sim.nextGroupId++, name: 'Laboratory Commons', color: '#809260', ...center, members: sim.agents.map(agent => agent.id), food: 100, wood: 100, shelters: 3, culture: 'Stewardship', _foundedDay: 0, _lastMoveDay: 0, _shortageDays: 0 }));
  group.civilization.stock.stone = group.civilization.stock.ore = 100;
  sim.groups = [group]; sim._groupMap = new Map([[group.id, group]]);
  for (const agent of sim.agents) {
    initializeAgentIdeas(agent);
    Object.assign(agent, center, { groupId: group.id, age: 30, health: 100, energy: 95, social: 80 });
    agent.mind.policy.action = 'invent';
    for (const key of Object.keys(agent.skills)) agent.skills[key] = 60;
  }
  sim._buildSpatial();
  return { sim, group, agent: sim.agents[0] };
}

function finishTrial(sim, agent, group, random = () => 0) {
  const previous = sim._random;
  sim._random = random;
  try {
    if (!group.civilization.experiment) attemptInnovation(sim, agent, group);
    group.civilization.experiment.progress = group.civilization.experiment.required - .01;
    agent.energy = 100;
    attemptInnovation(sim, agent, group);
  } finally { sim._random = previous; }
}

test('experimentation uses labor and consumes real materials on failed and successful trials', () => {
  const { sim, group, agent } = laboratory();
  assert.equal(attemptInnovation(sim, agent, group), true);
  const project = group.civilization.experiment;
  assert.ok(project.progress > 0 && project.progress < project.required);
  const progress = project.progress;
  for (let i = 0; i < 100; i++) { sim.day++; advanceInnovation(sim); }
  assert.equal(project.progress, progress, 'elapsed time cannot discover designs');
  const costs = structuredClone(project.hypothesis.cost);
  const resources = { food: group.food, wood: group.wood, stone: group.civilization.stock.stone, ore: group.civilization.stock.ore };
  finishTrial(sim, agent, group, () => .999);
  assert.equal(sim.innovation.trials, 1);
  assert.equal(sim.innovation.failures, 1);
  assert.equal(sim.innovation.discoveries.length, 0);
  assert.equal(project.progress, 0);
  assert.ok(agent.energy < 100);
  for (const key of Object.keys(costs)) assert.ok(Math.abs((key === 'food' || key === 'wood' ? group[key] : group.civilization.stock[key]) - (resources[key] - costs[key])) < 1e-10);
  assert.notDeepEqual(project.hypothesis.cost, costs, 'failed proportions are revised');
  finishTrial(sim, agent, group);
  assert.equal(sim.innovation.successes, 1);
  assert.equal(group.civilization.experiment, null);
  assert.deepEqual(sim.innovation.discoveries[0].evidence, { trials: 2, successes: 1, failures: 1, quality: sim.innovation.discoveries[0].evidence.quality });
  assert.ok(group.civilization.ideas.includes(sim.innovation.discoveries[0].id));
});

test('an unfunded experiment cannot run or create resources', () => {
  const { sim, group, agent } = laboratory();
  attemptInnovation(sim, agent, group);
  const before = structuredClone(group.civilization.experiment), energy = agent.energy;
  group.food = group.wood = group.civilization.stock.stone = group.civilization.stock.ore = 0;
  assert.equal(attemptInnovation(sim, agent, group), false);
  assert.deepEqual(group.civilization.experiment, before);
  assert.equal(agent.energy, energy);
  assert.equal(sim.innovation.trials, 0);
});

test('designs recombine quantitative effects indefinitely after foundation techniques complete', () => {
  const { sim, group, agent } = laboratory();
  group.civilization.technologies = TECHNOLOGIES.map(technology => technology.id);
  for (let i = 0; i < 24; i++) {
    sim.day++;
    finishTrial(sim, agent, group);
  }
  const designs = sim.innovation.discoveries;
  assert.equal(designs.length, 24, 'no nine-tech catalog or global invention ceiling');
  assert.ok(designs.slice(1).every(idea => idea.parentIds.length && idea.generation > 0));
  assert.ok(new Set(designs.map(idea => JSON.stringify(idea.effects))).size > 15, 'generated quantitative outcomes differ, not only labels');
  assert.ok(designs.every(idea => Object.values(idea.effects).some(value => value < 0)), 'working designs have opportunity costs');
  assert.ok(designs.every(idea => idea.recipe.materials.length && idea.cost.food > 0));
  const effects = innovationEffects(sim, group);
  assert.ok(effects.food > 1 && Number.isFinite(effects.food));
  const snapshot = { innovation: structuredClone(sim.innovation) };
  assert.deepEqual(innovationEffects(snapshot, structuredClone(group)), effects, 'UI can reproduce modifiers from a read-only snapshot');
  const next = laboratory('a-different-experience');
  attemptInnovation(next.sim, next.agent, next.group);
  assert.notDeepEqual(next.group.civilization.experiment.hypothesis.effects, designs[0].effects);
});

test('beliefs require effort, spread through actual learning, and acquire member-backed influence', () => {
  const { sim, group, agent } = laboratory();
  sim._random = () => 0;
  const food = group.food, energy = agent.energy;
  assert.equal(reflectBelief(sim, agent, group), true);
  const belief = sim.innovation.discoveries[0];
  assert.equal(belief.kind, 'belief');
  assert.equal(group.food, food - .04);
  assert.equal(agent.energy, energy - 1.8);
  assert.ok(agent.convictions[belief.id] > 0);
  sim.day = group.id;
  advanceInnovation(sim);
  assert.equal(group.civilization.doctrine, null, 'a single founder does not speak for six people');
  const listener = sim.agents[1];
  const message = spreadIdeas(sim, agent, listener, 1, true);
  assert.equal(message.ideaId, belief.id);
  assert.equal(message.kind, 'belief');
  assert.equal(spreadIdeas(sim, agent, listener, 1, true), null, 'repeat exposure is not new learning');
  advanceInnovation(sim);
  assert.equal(group.civilization.doctrine, belief.id);
  const effects = innovationEffects(sim, group);
  assert.equal(effects.solidarity, belief.doctrine.solidarity);
  assert.equal(effects.militancy, belief.doctrine.militancy);
  assert.notEqual(effects.trade, 1, 'doctrinal values affect actual modifiers');
  assert.notEqual(effects.combat, 1, 'doctrinal solidarity and militancy affect combat capability');
  assert.equal(sim.innovation.trials, 0, 'religious conviction is not experimental physical evidence');
});

test('generated doctrines can favor peaceful exchange or military coordination independently of spirituality', () => {
  const peaceful = laboratory('doctrine-comparison'), martial = laboratory('doctrine-comparison');
  for (const [world, care, risk] of [[peaceful, 1, 0], [martial, 0, 1]]) {
    world.agent.mind.values.care = care;
    world.agent.mind.riskTolerance = risk;
    world.agent.mind.values.belonging = 1;
    world.agent.traits.cooperation = 1;
    let call = 0;
    world.sim._random = () => call++ === 0 ? 0 : .8;
    reflectBelief(world.sim, world.agent, world.group);
    const belief = world.sim.innovation.discoveries[0];
    world.group.civilization.doctrine = belief.id;
  }
  const p = innovationEffects(peaceful.sim, peaceful.group), m = innovationEffects(martial.sim, martial.group);
  assert.equal(p.spirituality, m.spirituality, 'spirituality alone does not encode aggressiveness');
  assert.ok(p.militancy < m.militancy);
  assert.ok(p.trade > m.trade, 'peaceful doctrines improve exchange relative to militant ones');
  assert.ok(p.combat < m.combat, 'military coordination has a real relative advantage');
});

test('doctrine consensus ignores outsiders and retains discovered traditions after adherents leave', () => {
  const { sim, group, agent } = laboratory();
  sim._random = () => 0;
  reflectBelief(sim, agent, group);
  const belief = sim.innovation.discoveries[0];
  for (const person of sim.agents.slice(1)) { person.ideas.push(belief.id); person.convictions[belief.id] = 1; person.groupId = null; }
  sim.day = group.id;
  advanceInnovation(sim);
  assert.equal(group.civilization.doctrine, null);
  assert.ok(group.civilization.ideas.includes(belief.id), 'shared archive preserves ideas independently of current consensus');
  assert.equal(innovationStats(sim).beliefs, 1);
});

test('strict portable innovation state validates lineage, costs, accounting and all references', () => {
  const { sim, group, agent } = laboratory();
  finishTrial(sim, agent, group);
  finishTrial(sim, agent, group);
  const random = sim._random; sim._random = () => 0; reflectBelief(sim, agent, group); sim._random = random;
  attemptInnovation(sim, agent, group);
  const global = structuredClone(sim.innovation);
  const restored = restoreInnovation(global, sim);
  assert.deepEqual(restored, global);
  global.discoveries[0].effects.food = 99;
  assert.notEqual(restored.discoveries[0].effects.food, 99, 'restoration does not alias input');
  const agentState = restoreAgentIdeas(agent, sim);
  const groupState = restoreGroupIdeas(group, sim);
  assert.deepEqual(agentState, { ideas: agent.ideas, convictions: agent.convictions });
  assert.deepEqual(groupState, { ideas: group.civilization.ideas, doctrine: group.civilization.doctrine, experiment: group.civilization.experiment });
  for (const corrupt of [
    raw => { raw.discoveries[0].parentIds = ['idea-2']; },
    raw => { raw.discoveries[0].cost.food = -1; },
    raw => { raw.discoveries[0].recipe.method = 'infinite food'; },
    raw => { raw.discoveries[0].effects.food = Infinity; },
    raw => { raw.trials++; },
    raw => { raw.nextId += 1; },
    raw => { raw.discoveries[1].generation += 1; },
    raw => { raw.discoveries[2].doctrine.openness = -1; },
  ]) {
    const raw = structuredClone(sim.innovation); corrupt(raw);
    assert.throws(() => restoreInnovation(raw, sim), /Invalid innovation/);
  }
  assert.throws(() => restoreAgentIdeas({ ideas: ['idea-999'], convictions: {} }, sim), /Invalid innovation/);
  const bad = structuredClone(agent); bad.convictions['idea-1'] = 1;
  assert.throws(() => restoreAgentIdeas(bad, sim), /Invalid innovation/);
  const badGroup = structuredClone(group); badGroup.civilization.doctrine = 'idea-1';
  assert.throws(() => restoreGroupIdeas(badGroup, sim), /Invalid innovation/);
});
