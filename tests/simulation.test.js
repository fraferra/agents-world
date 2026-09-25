import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, DAYS_PER_YEAR, DEFAULT_CONFIG, WORLD_SIZES } from '../src/simulation.js';
import { TILE_RESOURCES } from '../src/resources.js';

function assertHealthyState(sim) {
  const state = sim.snapshot();
  const ids = new Set(state.agents.map((agent) => agent.id));
  const groups = new Map(state.groups.map((group) => [group.id, group]));
  assert.equal(ids.size, state.agents.length);
  assert.equal(state.stats.population, state.config.population + state.stats.births + state.stats.arrivals - state.stats.deaths);
  assert.equal(Object.hasOwn(state.config, 'maxPopulation'), false);
  assert.ok(state.history.length <= 720);
  assert.ok(state.events.length <= 120);
  for (const agent of state.agents) {
    for (const key of ['health', 'hunger', 'energy', 'social', 'happiness']) {
      assert.ok(Number.isFinite(agent[key]) && agent[key] >= 0 && agent[key] <= 100, `${key} for ${agent.id}`);
    }
    assert.ok(agent.x >= 0 && agent.x < state.width && agent.y >= 0 && agent.y < state.height);
    assert.notEqual(state.tiles[Math.floor(agent.y) * state.width + Math.floor(agent.x)].terrain, 'water');
    if (agent.partnerId !== null) {
      const partner = state.agents.find((other) => other.id === agent.partnerId);
      assert.ok(partner);
      assert.equal(partner.partnerId, agent.id);
    }
    if (agent.groupId !== null) assert.ok(groups.get(agent.groupId)?.members.includes(agent.id));
    for (const value of Object.values(agent.traits)) assert.ok(value >= 0 && value <= 1);
    assert.ok(agent.parentIds.length === 0 || agent.parentIds.length === 2);
    assert.ok(agent.parentIds.every((id) => id < agent.id));
  }
  for (const group of state.groups) {
    assert.ok(group.members.length > 0);
    for (const id of group.members) assert.equal(state.agents.find((agent) => agent.id === id)?.groupId, group.id);
    assert.ok(group.food >= 0 && group.wood >= 0);
  }
  for (const tile of state.tiles) {
    for (const key of ['food', 'wood', 'elevation', 'fertility', 'soil', 'stone', 'ore', ...TILE_RESOURCES]) assert.ok(Number.isFinite(tile[key]) && tile[key] >= 0 && tile[key] <= 1);
  }
  assert.deepEqual(Simulation.deserialize(JSON.parse(JSON.stringify(sim.serialize()))).serialize(), sim.serialize());
}

test('seeded world is repeatable, traversable, and meaningfully different across seeds', () => {
  assert.equal(DAYS_PER_YEAR, 120);
  assert.equal(DEFAULT_CONFIG.population, 120);
  assert.equal(DEFAULT_CONFIG.size, 'large');
  const first = new Simulation({ seed: 'test-island', size: 'standard' });
  const same = new Simulation({ seed: 'test-island', size: 'standard' });
  const different = new Simulation({ seed: 'another-island', size: 'standard' });
  assert.deepEqual(first.snapshot(), same.snapshot());
  assert.notDeepEqual(first.tiles, different.tiles);
  assert.equal(first.tiles.length, 160 * 104);
  assert.ok(first.regions.length >= 6);
  assert.ok(first.tiles.some((tile) => tile.ore > 0.15));
  assert.ok(first.tiles.some((tile) => tile.fertility > 0.75));
  assert.ok(new Set(first.tiles.map((tile) => tile.terrain)).size >= 4);
  assert.equal(first.groups.length, 0, 'societies must emerge from encounters');
  assertHealthyState(first);
});

test('chunked stepping and save/resume preserve the exact random sequence', () => {
  const whole = new Simulation({ seed: 'continuity' });
  const chunks = new Simulation({ seed: 'continuity' });
  whole.step(480);
  for (let i = 0; i < 40; i++) chunks.step(12);
  assert.deepEqual(whole.serialize(), chunks.serialize());
  whole.intervene('rain');
  whole.configure({ fertility: 1.4, cooperation: 0.8 });
  const resumed = Simulation.deserialize(JSON.parse(JSON.stringify(whole.serialize())));
  whole.step(900); resumed.step(900);
  assert.deepEqual(whole.serialize(), resumed.serialize());
  assertHealthyState(resumed);
});

test('individual encounters produce societies, shelters, families and inherited variation', () => {
  const sim = new Simulation({ seed: 'moss-17' });
  sim.step(1200);
  const state = sim.snapshot();
  assert.ok(state.groups.length > 1);
  assert.ok(state.groups.some((group) => group.shelters > 0));
  assert.ok(state.agents.some((agent) => agent.partnerId));
  assert.ok(state.stats.births > 10);
  const children = state.agents.filter((agent) => agent.generation > 1);
  assert.ok(children.length > 10);
  for (const child of children) {
    const parents = child.parentIds.map((id) => state.agents.find((agent) => agent.id === id));
    if (!parents.every(Boolean)) continue;
    for (const trait of ['cooperation', 'curiosity', 'sociability']) {
      const inherited = (parents[0].traits[trait] + parents[1].traits[trait]) / 2;
      assert.ok(Math.abs(child.traits[trait] - inherited) <= 0.1500000001);
    }
    for (const parent of parents) assert.ok(parent.children.includes(child.id));
  }
  assertHealthyState(sim);
});

test('a century includes turnover and multiple generations without requiring resets', (t) => {
  const started = performance.now();
  let sim = new Simulation({ seed: 'moss-17', size: 'standard', population: 96 });
  sim.step(60 * DAYS_PER_YEAR);
  const midpoint = Simulation.deserialize(JSON.parse(JSON.stringify(sim.serialize())));
  sim.step(12); midpoint.step(12);
  assert.deepEqual(midpoint.serialize(), sim.serialize(), 'midpoint resume preserves individual choices and random state');
  sim = midpoint;
  sim.step(60 * DAYS_PER_YEAR - 12);
  const state = sim.snapshot();
  t.diagnostic(JSON.stringify({ years: 120, seconds: Math.round((performance.now() - started) / 100) / 10, ...state.stats, warsStarted: state.diplomacy.warsStarted, treaties: state.diplomacy.treaties, societiesWithDoctrines: state.groups.filter(group => group.civilization.doctrine).length }));
  assert.ok(state.stats.deaths >= 96, 'all founding adults have finite lifespans');
  assert.ok(state.stats.population >= 30, 'the default ecosystem supports replacement generations');
  assert.ok(state.stats.generation >= 4);
  assert.ok(state.stats.births > 100);
  assert.ok(state.stats.technologies >= 5, 'learned knowledge survives generational turnover');
  assert.ok(state.stats.industries > 10, 'working societies develop durable industries');
  assert.ok(state.stats.goodsProduced > 0 && state.stats.tradeVolume > 0, 'production and exchange occur through agent work');
  assert.ok(state.stats.inventions > 9 && state.stats.beliefs > 0, 'generated designs and traditions develop beyond the foundation techniques');
  assert.ok(state.stats.failedExperiments > 0, 'real trials include unsuccessful designs');
  assert.equal(state.history[0].day, 0, 'thinning retains the origin of the experiment');
  assert.ok(state.history.at(-1).day >= sim.day - 12);
  assertHealthyState(sim);
  const resumed = Simulation.deserialize(JSON.parse(JSON.stringify(sim.serialize())));
  sim.step(30); resumed.step(30);
  assert.deepEqual(resumed.serialize(), sim.serialize(), 'large idea registries retain exact behavior after save/resume');
});

test('zero fertility ages to extinction and the empty ecology remains valid', () => {
  const sim = new Simulation({ seed: 'closed-cohort', population: 16, fertility: 0 });
  sim.step(100 * DAYS_PER_YEAR);
  assert.equal(sim.births, 0);
  assert.equal(sim.deaths, 16);
  assert.equal(sim.agents.length, 0);
  assert.equal(sim.groups.length, 0);
  sim.intervene('rain'); sim.step(120);
  assertHealthyState(sim);
});

test('rain, drought and abundance have causal effects on resource growth', () => {
  const base = new Simulation({ seed: 'ecology', population: 0 });
  for (const tile of base.tiles) tile.food *= 0.2;
  const rain = Simulation.deserialize(base.serialize());
  const drought = Simulation.deserialize(base.serialize());
  const abundant = Simulation.deserialize(base.serialize());
  rain.intervene('rain'); drought.intervene('drought'); abundant.configure({ abundance: 2 });
  base.step(60); rain.step(60); drought.step(60); abundant.step(60);
  const stock = (world) => world.snapshot().stats.food;
  assert.ok(stock(rain) > stock(base));
  assert.ok(stock(abundant) > stock(base));
  assert.ok(stock(drought) < stock(base));
  assert.ok(drought.snapshot().stats.carryingCapacity < base.snapshot().stats.carryingCapacity);
  const inhabited = new Simulation();
  const before = inhabited.snapshot().stats.food;
  inhabited.intervene('food');
  assert.ok(inhabited.snapshot().stats.food > before);
  assert.equal(inhabited.events[0].type, 'world');
});

test('births and imports exceed former population limits while food still constrains reproduction', () => {
  for (const population of [600, 1000]) {
    const sim = new Simulation({ seed: 'uncapped', population, maxPopulation: 24 });
    const [parent, partner] = sim.agents;
    sim.day = 100;
    parent.partnerId = partner.id; partner.partnerId = parent.id;
    Object.assign(parent, { sex: 'female', attraction: 'different' });
    Object.assign(partner, { x: parent.x, y: parent.y, sex: 'male', attraction: 'different' });
    for (const agent of [parent, partner]) {
      agent.age = 24; agent._ageDays = 24 * DAYS_PER_YEAR;
      agent._bondDay = 0; agent.hunger = 0; agent.health = 100; agent.energy = 100;
      agent.inventory.food = 1;
    }
    const random = sim._random;
    sim._random = () => 0;
    sim._reproduce(parent);
    assert.equal(sim.agents.length, population + 1);
    assert.equal(sim.births, 1);
    assert.ok(Math.abs(parent.inventory.food + partner.inventory.food + sim.agents.at(-1).inventory.food - 2) < 1e-10, 'infant provisions come from existing resources');
    parent._lastBirthDay = partner._lastBirthDay = -1000;
    parent.inventory.food = partner.inventory.food = 0;
    sim._reproduce(parent);
    assert.equal(sim.births, 1, 'food scarcity still blocks reproduction');
    sim._random = random;
    assertHealthyState(sim);
  }
});

test('zero cooperation suppresses group formation', () => {
  const independent = new Simulation({ cooperation: 0 });
  independent.step(720);
  assert.equal(independent.groups.length, 0);
  assertHealthyState(independent);
});

test('resource deprivation harms individuals and ends temporary climate events', () => {
  const sim = new Simulation({ seed: 'scarce', population: 150, abundance: 0.1 });
  for (const tile of sim.tiles) tile.food = 0;
  for (const agent of sim.agents) agent.inventory.food = 0;
  sim.intervene('drought'); sim.step(30);
  assert.ok(sim.agents.some((agent) => agent.health < 90));
  sim.step(170);
  assert.ok(sim.deaths > 0);
  assert.ok(sim.weather.droughtUntil <= sim.day);
  assertHealthyState(sim);
});

test('snapshots and exported saves do not expose mutable live state', () => {
  const sim = new Simulation();
  const snapshot = sim.snapshot(), save = sim.serialize();
  snapshot.tiles[0].food = -999;
  snapshot.agents[0].traits.curiosity = -1;
  snapshot.agents[0].children.push(9999);
  save.agents[0]._relations.push({ id: 9999, strength: 1, lastSeen: 0 });
  snapshot.agents[0].mind.values.security = -999;
  snapshot.agents[0].mind.memories.push({ day: 0, type: 'test', text: 'mutated snapshot' });
  save.agents[0].skills.foraging = -1;
  save.agents[0].knowledge.push('invented');
  snapshot.civilization.messages.push({ day: 0 });
  snapshot.agents[0].ideas.push('idea-9999');
  save.agents[0].convictions['idea-9999'] = 1;
  snapshot.innovation.discoveries.push({ name: 'mutated' });
  save.diplomacy.relations.push({ a: 9999 });
  save.regions[0].name = 'mutated';
  assert.ok(sim.tiles[0].food >= 0);
  assert.ok(sim.agents[0].traits.curiosity >= 0);
  assert.equal(sim.agents[0].children.length, 0);
  assert.equal(sim.agents[0]._relations.length, 0);
  assert.ok(sim.agents[0].mind.values.security >= 0);
  assert.ok(sim.agents[0].skills.foraging >= 0);
  assert.ok(!sim.agents[0].knowledge.includes('invented'));
  assert.ok(!sim.agents[0].mind.memories.some((memory) => memory.text === 'mutated snapshot'));
  assert.equal(sim.civilization.messages.length, 0);
  assert.equal(sim.agents[0].ideas.length, 0);
  assert.deepEqual(sim.agents[0].convictions, {});
  assert.equal(sim.innovation.discoveries.length, 0);
  assert.equal(sim.diplomacy.relations.length, 0);
  assert.notEqual(sim.regions[0].name, 'mutated');
});

test('malformed, oversized, inconsistent, and non-finite imports are rejected', () => {
  const sim = new Simulation();
  sim.step(240);
  const corruptions = [
    (s) => { s.version = 99; },
    (s) => { s.rngState = 0; },
    (s) => { s.day = -1; },
    (s) => { s.tiles.pop(); },
    (s) => { s.tiles[0].terrain = '<script>'; },
    (s) => { s.tiles[0].fertility = Infinity; },
    (s) => { s.tiles[0].ore = -1; },
    (s) => { s.tiles[0].stone = 1.1; },
    (s) => { s.tiles[0].soil = -1; },
    (s) => { s.config.size = 'compact'; },
    (s) => { s.regions[0].x = s.width; },
    (s) => { s.regions.push(s.regions[0]); },
    (s) => { s.regions[0].biome = 'water'; },
    (s) => { s.agents[0].health = NaN; },
    (s) => { s.agents[0]._deathCause = 'script'; },
    (s) => { s.agents[0].x = s.width; },
    (s) => { s.agents[0].traits.curiosity = Infinity; },
    (s) => { s.agents[0].partnerId = s.agents[0].id; },
    (s) => { s.agents[0].groupId = 999999; },
    (s) => { s.agents[0].parentIds = [s.agents[0].id]; },
    (s) => { s.agents[0]._relations.push({ id: 999999, strength: 1, lastSeen: 0 }); },
    (s) => { s.agents[0].inventory.food = 500; },
    (s) => { s.agents.push(s.agents[0]); },
    (s) => { s.history = Array(721).fill(s.history[0]); },
    (s) => { s.events[0].text = 'x'.repeat(501); },
    (s) => { s.deaths++; },
    (s) => { s.nextAgentId--; },
    (s) => { s.weather.droughtUntil = s.day + 181; },
  ];
  for (const corrupt of corruptions) {
    const raw = sim.serialize(); corrupt(raw);
    assert.throws(() => Simulation.deserialize(raw), /Invalid|exceeds/);
  }
  assert.throws(() => Simulation.deserialize(sim.snapshot()), /Invalid/);
  assert.throws(() => Simulation.deserialize(null), /Invalid/);
});

test('invalid runtime commands fail without advancing or corrupting the world', () => {
  const sim = new Simulation();
  const before = sim.serialize();
  for (const days of [-1, 0.5, Infinity, NaN, '10', 100001]) assert.throws(() => sim.step(days));
  assert.throws(() => sim.configure({ abundance: 0 }));
  assert.throws(() => sim.configure({ fertility: 1, seed: 'replacement' }));
  assert.throws(() => sim.intervene('unknown'));
  assert.deepEqual(sim.serialize(), before);
  assert.equal(sim.step(0), sim);
});


test('all selectable world sizes have independent spatial cells and valid boundaries', () => {
  for (const [size, dimensions] of Object.entries(WORLD_SIZES)) {
    const sim = new Simulation({ size, population: 12 });
    assert.equal(sim.width, dimensions.width);
    assert.equal(sim.height, dimensions.height);
    assert.equal(sim.tiles.length, dimensions.width * dimensions.height);
    const agent = sim.agents[0], other = sim.agents[1];
    const eastern = sim._landNear(sim.width - 2, sim.height * 0.6);
    Object.assign(agent, eastern); Object.assign(other, eastern);
    sim._buildSpatial();
    assert.ok(sim._neighbors(agent, 2).includes(other), `${size}: encounters beyond original world boundary`);
    sim._move(agent, { x: sim.width + 20, y: sim.height + 20 }, 100);
    assert.ok(agent.x < sim.width && agent.y < sim.height);
    sim.step(120);
    assertHealthyState(sim);
  }
  assert.throws(() => new Simulation({ size: 'unbounded' }), /Invalid/);
});

function legacySave(sim) {
  const raw = sim.serialize();
  raw.version = 1;
  delete raw.config.size;
  delete raw.regions;
  delete raw.civilization;
  delete raw.innovation; delete raw.diplomacy; delete raw.psyche;
  for (const tile of raw.tiles) for (const key of ['fertility', 'soil', 'stone', 'ore', ...TILE_RESOURCES]) delete tile[key];
  for (const agent of raw.agents) {
    for (const key of ['mind', 'skills', 'knowledge', 'ideas', 'convictions', 'psyche', 'sex', 'attraction', 'wealth']) delete agent[key];
    agent._relations = agent._relations.map(({ id, strength, lastSeen }) => ({ id, strength, lastSeen }));
  }
  for (const group of raw.groups) delete group.civilization;
  raw.events = raw.events.filter((event) => ['birth', 'death', 'group', 'world', 'migration'].includes(event.type));
  return raw;
}

test('legacy version 1 saves migrate without resetting inhabitants, land, history, or time', () => {
  const original = new Simulation({ size: 'compact', population: 64 });
  original.step(360);
  const legacy = legacySave(original);
  const migrated = Simulation.deserialize(legacy);
  const same = Simulation.deserialize(JSON.parse(JSON.stringify(legacy)));
  assert.equal(migrated.width, 96);
  assert.equal(migrated.height, 64);
  assert.equal(migrated.config.size, 'compact');
  assert.equal(migrated.day, legacy.day);
  assert.equal(migrated.rngState, legacy.rngState);
  assert.equal(migrated.births, legacy.births);
  assert.equal(migrated.deaths, legacy.deaths);
  assert.deepEqual(migrated.history, legacy.history);
  assert.deepEqual(migrated.events, legacy.events);
  for (let index = 0; index < legacy.tiles.length; index++) {
    for (const [field, value] of Object.entries(legacy.tiles[index])) assert.equal(migrated.tiles[index][field], value);
  }
  for (let index = 0; index < legacy.agents.length; index++) {
    const agent = migrated.agents[index];
    // Old fixed lifespans become a distant biological limit under age-specific mortality.
    for (const [field, value] of Object.entries(legacy.agents[index])) if (field !== '_lifespan') assert.deepEqual(agent[field], value);
    assert.ok(['female', 'male'].includes(agent.sex) && agent.wealth === 0);
    assert.ok(agent.mind && agent.skills && Array.isArray(agent.knowledge));
  }
  for (let index = 0; index < legacy.groups.length; index++) {
    for (const [field, value] of Object.entries(legacy.groups[index])) assert.deepEqual(migrated.groups[index][field], value);
    assert.ok(migrated.groups[index].civilization);
  }
  assert.deepEqual(migrated.serialize(), same.serialize());
  assert.equal(migrated.serialize().version, 7);
  assert.ok(migrated.agents.every((agent) => agent.psyche?.aspiration && agent.psyche.techniques.length === 0));
  migrated.step(90); same.step(90);
  assert.deepEqual(migrated.serialize(), same.serialize());
  assertHealthyState(migrated);
});

test('version 2 migration preserves existing resources, learning, and RNG while discarding its ceiling', () => {
  const original = new Simulation({ seed: 'migration-two', population: 96 });
  original.step(480);
  const legacy = original.serialize();
  legacy.version = 2; legacy.config.maxPopulation = 32;
  delete legacy.innovation; delete legacy.diplomacy; delete legacy.psyche;
  for (const tile of legacy.tiles) for (const key of ['soil', ...TILE_RESOURCES]) delete tile[key];
  for (const agent of legacy.agents) {
    delete agent.ideas; delete agent.convictions; delete agent.psyche; delete agent.sex; delete agent.attraction; delete agent.wealth;
    agent._relations = agent._relations.map(({ id, strength, lastSeen }) => ({ id, strength, lastSeen }));
  }
  for (const group of legacy.groups) {
    delete group.civilization.ideas; delete group.civilization.doctrine; delete group.civilization.experiment;
  }
  legacy.civilization.messages = legacy.civilization.messages.filter(message => !['invention', 'belief', 'technique', 'advice', 'gossip'].includes(message.kind)).map(({ techniqueId, about, ...message }) => message);
  legacy.events = legacy.events.filter(event => ['birth', 'death', 'group', 'world', 'migration', 'technology', 'industry', 'communication', 'trade'].includes(event.type));
  const migrated = Simulation.deserialize(legacy), same = Simulation.deserialize(structuredClone(legacy));
  assert.equal(migrated.serialize().version, 7);
  assert.equal(Object.hasOwn(migrated.config, 'maxPopulation'), false);
  assert.equal(migrated.day, legacy.day);
  assert.equal(migrated.rngState, legacy.rngState);
  assert.equal(migrated.agents.length, legacy.agents.length);
  assert.deepEqual(migrated.civilization, legacy.civilization);
  assert.deepEqual(migrated.agents.map(agent => agent.knowledge), legacy.agents.map(agent => agent.knowledge));
  assert.deepEqual(migrated.agents.map(agent => agent.mind), legacy.agents.map(agent => agent.mind));
  for (let index = 0; index < legacy.tiles.length; index++) {
    assert.deepEqual(Object.fromEntries(Object.entries(migrated.tiles[index]).filter(([key]) => !TILE_RESOURCES.includes(key))), { ...legacy.tiles[index], soil: legacy.tiles[index].fertility });
  }
  assert.equal(migrated.innovation.discoveries.length, 0);
  assert.equal(migrated.diplomacy.relations.length, 0);
  migrated.step(240); same.step(240);
  assert.deepEqual(migrated.serialize(), same.serialize());
  assertHealthyState(migrated);
});

test('version 3 import validates nested cognition and society data without shared references', () => {
  const sim = new Simulation(); sim.step(600);
  assert.ok(sim.groups.length > 0);
  const invalid = [
    (save) => { save.agents[0].skills.scholarship = Infinity; },
    (save) => { save.agents[0].mind.values.security = -1; },
    (save) => { save.agents[0].mind.beliefs.trust = 2; },
    (save) => { save.agents[0].mind.plan.steps = Array(10).fill('invent'); },
    (save) => { save.agents[0].knowledge.push('impossible technology'); },
    (save) => { save.groups[0].civilization.stock.ore = -1; },
    (save) => { save.groups[0].civilization.buildings.farm = 0.5; },
    (save) => { save.groups[0].civilization.technologies.push('impossible technology'); },
    (save) => { save.civilization.conversations = -1; },
    (save) => { save.civilization.messages = Array(81).fill({}); },
  ];
  for (const corrupt of invalid) {
    const save = sim.serialize(); corrupt(save);
    assert.throws(() => Simulation.deserialize(save), /Invalid/);
  }
  const save = sim.serialize(), restored = Simulation.deserialize(save);
  save.agents[0].mind.values.security = -1;
  save.groups[0].civilization.stock.ore = -1;
  save.groups[0].civilization.production.food = -1;
  save.civilization.messages.length = 0;
  assert.ok(restored.agents[0].mind.values.security >= 0);
  assert.ok(restored.groups[0].civilization.stock.ore >= 0);
  assert.ok(restored.groups[0].civilization.production.food >= 0);
  assert.deepEqual(restored.serialize(), sim.serialize());
  const snapshot = sim.snapshot();
  snapshot.groups[0].civilization.technologies.push('invented');
  snapshot.groups[0].civilization.stock.tools = -1;
  assert.ok(!sim.groups[0].civilization.technologies.includes('invented'));
  assert.ok(sim.groups[0].civilization.stock.tools >= 0);
});


test('practiced foraging skills increase real harvested resources', () => {
  const novice = new Simulation({ population: 1 });
  const forest = novice.tiles.findIndex(tile => tile.terrain === 'forest');
  const agent = novice.agents[0];
  agent.x = forest % novice.width + 0.5; agent.y = Math.floor(forest / novice.width) + 0.5;
  agent.inventory.food = 0; agent.hunger = 0; agent.skills.foraging = 0;
  novice.tiles[forest].food = 1;
  const expert = Simulation.deserialize(novice.serialize());
  expert.agents[0].skills.foraging = 100;
  novice._forage(agent); expert._forage(expert.agents[0]);
  assert.ok(expert.agents[0].inventory.food > agent.inventory.food);
  assert.ok(expert.tiles[forest].food < novice.tiles[forest].food);
  assert.ok(Math.abs(expert.agents[0].inventory.food + expert.tiles[forest].food - 1) < 1e-10);
});
