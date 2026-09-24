import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';
import { ACTS, endureConditions } from '../src/acts.js';

const developed = (() => { const sim = new Simulation({ seed: 'acts-of-god' }); sim.step(900); return sim.serialize(); })();
const world = () => Simulation.deserialize(structuredClone(developed));
const settled = sim => [...sim.groups].sort((a, b) => b.members.length - a.members.length)[0];
const regionAt = (sim, point) => sim.regions.reduce((best, region) => Math.hypot(region.x - point.x, region.y - point.y) < Math.hypot(best.x - point.x, best.y - point.y) ? region : best);

test('every act is deterministic, recorded, and leaves a valid world', () => {
  for (const act of ACTS) {
    const a = world(), b = world();
    const before = a.events[0]?.id;
    a.intervene(act.id); b.intervene(act.id);
    assert.ok(a.events[0].id !== before, `${act.id} is recorded`);
    a.step(30); b.step(30);
    assert.deepEqual(a.serialize(), b.serialize(), `${act.id} replays identically`);
    assert.deepEqual(Simulation.deserialize(JSON.parse(JSON.stringify(a.serialize()))).serialize(), a.serialize(), `${act.id} saves exactly`);
  }
});

test('invalid acts and targets are rejected without changing the world', () => {
  const sim = world(), before = JSON.stringify(sim.serialize());
  assert.throws(() => sim.intervene('apocalypse'), /Unknown act/);
  assert.throws(() => sim.intervene('earthquake', { region: 999 }), /Unknown region/);
  assert.throws(() => sim.intervene('plague', { region: sim.regions[0].id }), /whole world/);
  assert.equal(JSON.stringify(sim.serialize()), before);
  const save = sim.serialize(); save.weather.plagueUntil = save.day + 500;
  assert.throws(() => Simulation.deserialize(save), /Invalid/);
});

test('a harsh winter slows growth, spoils stores and chills the unsheltered', () => {
  const calm = world(), cold = world();
  cold.intervene('winter');
  const food = sim => sim.tiles.reduce((sum, tile) => sum + tile.food, 0);
  // Stores spoil faster: the same granary contents over one ecology pass.
  const warmStore = settled(calm), coldStore = cold._groupMap.get(warmStore.id);
  warmStore.food = coldStore.food = 50; calm._ecology(); cold._ecology();
  assert.ok(coldStore.food < warmStore.food);
  calm.step(40); cold.step(40);
  assert.ok(food(cold) < food(calm));
  assert.ok(cold.snapshot().conditions.winter === 50);
  cold.step(60);
  assert.equal(cold.snapshot().conditions.winter, 0, 'winter ends');
  // The same person loses more energy to cold when exposed than when sheltered.
  const exposure = sheltered => {
    const sim = world(); sim.intervene('winter');
    const group = settled(sim), person = sim._agentMap.get(group.members[0]);
    group.shelters = sheltered ? group.members.length : 0;
    Object.assign(person, { x: group.x, y: group.y, energy: 80 });
    endureConditions(sim, person, group);
    return 80 - person.energy;
  };
  assert.ok(exposure(false) > exposure(true) * 2);
});

test('plague harms crowded settlements more, medicine protects, and it ends', () => {
  const sim = world();
  sim.intervene('plague');
  const group = settled(sim);
  const members = new Set(group.members);
  const health = sim => { const people = sim.agents.filter(agent => members.has(agent.id)); return people.reduce((sum, agent) => sum + agent.health, 0) / people.length; };
  const protectedWorld = world(); protectedWorld.intervene('plague');
  const safe = protectedWorld._groupMap.get(group.id);
  safe.civilization.buildings.clinic = 4;
  if (!safe.civilization.technologies.includes('medicine')) safe.civilization.technologies.push('medicine');
  for (const id of safe.members) protectedWorld._agentMap.get(id).skills.medicine = 90;
  const baseline = world();
  sim.step(60); protectedWorld.step(60); baseline.step(60);
  assert.ok(health(sim) < health(baseline), 'the plague harms people');
  assert.ok(health(protectedWorld) > health(sim), 'clinics and medical skill protect');
  assert.ok(sim.agents.some(agent => agent.psyche.episodes.some(episode => episode.type === 'illness')));
  sim.step(61);
  assert.equal(sim.snapshot().conditions.plague, 0);
});

test('blessing, festival and omen change land and minds', () => {
  const blessed = world();
  for (const tile of blessed.tiles) tile.soil = 0;
  blessed.intervene('renewal');
  assert.ok(blessed.tiles.every(tile => tile.terrain === 'water' || tile.soil === tile.fertility));

  const festive = world(), agent = festive.agents.find(person => person._relations.length && person.age > 16);
  const joy = agent.psyche.mood.joy, bond = agent._relations[0].strength;
  festive.intervene('festival');
  assert.ok(agent.psyche.mood.joy > joy);
  assert.ok(agent._relations[0].strength > bond || agent._relations[0].strength === 1);
  assert.equal(agent.social, 100);

  const ominous = world(), witness = ominous.agents.find(person => person.age > 16);
  ominous.intervene('omen');
  assert.ok(witness.psyche.mood.fear > .2);
  assert.ok(witness.mind.needs.purpose >= 35);
});

test('a spark of genius grants real techniques to curious adults', () => {
  const sim = world();
  const known = sim.agents.reduce((sum, agent) => sum + agent.psyche.techniques.length, 0);
  sim.intervene('inspiration');
  assert.ok(sim.agents.reduce((sum, agent) => sum + agent.psyche.techniques.length, 0) >= known + 3);
  assert.ok(sim.agents.some(agent => agent.psyche.episodes.some(episode => episode.type === 'inspiration')));
});

test('wanderers join the population with accounted arrivals and skills of their own', () => {
  const sim = world(), before = sim.agents.length, region = sim.regions[0];
  sim.intervene('wanderers', { region: region.id });
  const arrived = sim.agents.length - before;
  assert.ok(arrived >= 4 && arrived === sim.arrivals);
  const newcomers = sim.agents.slice(-arrived);
  assert.ok(newcomers.every(agent => agent.groupId === null && agent.age >= 18 && agent.psyche.techniques.length >= 1));
  assert.ok(newcomers.every(agent => agent._relations.length > 0), 'they travel as companions');
  const state = sim.snapshot();
  assert.equal(state.stats.population, state.config.population + state.stats.births + state.stats.arrivals - state.stats.deaths);
  const restored = Simulation.deserialize(JSON.parse(JSON.stringify(sim.serialize())));
  assert.equal(restored.agents.length, sim.agents.length);
});

test('regional disasters change land, settlements and people where they strike', () => {
  const quake = world(), group = settled(quake), region = regionAt(quake, group);
  const buildings = Object.values(group.civilization.buildings).reduce((a, b) => a + b, 0) + group.shelters;
  const stone = quake.tiles.reduce((sum, tile) => sum + tile.stone, 0);
  const near = quake.agents.find(agent => Math.hypot(agent.x - region.x, agent.y - region.y) < 8);
  quake.intervene('earthquake', { region: region.id });
  if (Math.hypot(group.x - region.x, group.y - region.y) <= 14) assert.ok(Object.values(group.civilization.buildings).reduce((a, b) => a + b, 0) + group.shelters <= buildings);
  assert.ok(quake.tiles.reduce((sum, tile) => sum + tile.stone, 0) > stone, 'stone is exposed');
  if (near) assert.ok(near.psyche.episodes.some(episode => episode.type === 'disaster'));

  const fire = world();
  const forestRegion = fire.regions.find(candidate => candidate.biome === 'forest') || fire.regions[0];
  const wood = fire.tiles.reduce((sum, tile) => sum + tile.wood, 0);
  fire.intervene('wildfire', { region: forestRegion.id });
  assert.ok(fire.tiles.reduce((sum, tile) => sum + tile.wood, 0) < wood);

  const flood = world(), wet = flood.regions[0];
  const low = [];
  for (let y = 0; y < flood.height; y++) for (let x = 0; x < flood.width; x++) {
    const tile = flood.tiles[y * flood.width + x];
    if (Math.hypot(x + .5 - wet.x, y + .5 - wet.y) <= 18 && tile.elevation < .45 && tile.terrain !== 'water' && tile.terrain !== 'mountain') low.push(tile);
  }
  const soil = low.map(tile => tile.soil);
  flood.intervene('flood', { region: wet.id });
  assert.ok(low.every(tile => tile.food === 0));
  assert.ok(low.every((tile, index) => tile.soil >= soil[index]), 'silt enriches soil');

  const strike = world(), place = strike.regions[1];
  const ore = strike.tiles.reduce((sum, tile) => sum + tile.ore, 0);
  strike.intervene('strike', { region: place.id });
  assert.ok(strike.tiles.reduce((sum, tile) => sum + tile.ore, 0) > ore + 1);
});
