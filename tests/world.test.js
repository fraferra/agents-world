import test from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { Simulation, WORLD_SIZES } from '../src/simulation.js';
import { TECHNOLOGIES, BUILDINGS, SKILLS, initializeSociety, considerCivilization, have, dietVariety } from '../src/civilization.js';
import { TILE_RESOURCES, DEPOSITS, shoreMask, generateResources, renew, capacity } from '../src/resources.js';
import { initializeCulture, advanceCulture, shareCustom, customModifiers, tierOf } from '../src/culture.js';
import { considerExpansion, claimFriction, landPressure } from '../src/expansion.js';
import { innovationEffects, initializeGroupIdeas } from '../src/innovation.js';
import { PERSONALITY } from '../src/psyche.js';

function society(options = {}) {
  const sim = new Simulation({ seed: options.seed || 'material-world', population: options.population || 8, size: 'compact' });
  const center = sim._mainlandNear(48, 32);
  const group = initializeSociety({ id: sim.nextGroupId++, name: 'Test Commons', color: '#809260', ...center, members: sim.agents.map(agent => agent.id), food: 50, wood: 10, shelters: 3, culture: 'Stewardship', _foundedDay: 0, _lastMoveDay: 0, _shortageDays: 0 });
  initializeGroupIdeas(group);
  sim.groups = [group]; sim._groupMap.set(group.id, group);
  for (const agent of sim.agents) {
    Object.assign(agent, center, { groupId: group.id, hunger: 0, energy: 95, health: 100, social: 100, age: 30, _ageDays: 3600 });
    agent.inventory.food = 5;
    agent.mind.values = { security: 0, belonging: 0, autonomy: 0, mastery: 0, care: 0 };
    agent.mind.ambition = 0; agent.mind.needs.stimulation = 0; agent.mind.needs.purpose = 0; agent.traits.curiosity = 0; agent.traits.sociability = 0;
    agent.skills = Object.fromEntries(SKILLS.map(skill => [skill, 0]));
    Object.assign(agent.psyche, { personality: Object.fromEntries(PERSONALITY.map(key => [key, .5])), talents: Object.fromEntries(SKILLS.map(skill => [skill, 1])), preferences: {}, expectations: {}, techniques: [], episodes: [], places: [], reasoning: [], practice: {}, expansion: .3 });
  }
  initializeCulture(sim, group);
  sim._buildSpatial();
  return { sim, group, agent: sim.agents[0] };
}
const total = (sim, key) => sim.tiles.reduce((sum, tile) => sum + tile[key], 0);

test('larger worlds have more regions and rivers, and every land tile carries seeded deposits', () => {
  assert.deepEqual(WORLD_SIZES.vast, { width: 320, height: 208 });
  assert.deepEqual(WORLD_SIZES.immense, { width: 400, height: 260 });
  const standard = new Simulation({ seed: 'wide', size: 'standard', population: 4 });
  const immense = new Simulation({ seed: 'wide', size: 'immense', population: 4 });
  assert.equal(standard.regions.length, 12);
  assert.ok(immense.regions.length > 20 && immense.regions.length <= 30);
  assert.equal(new Set(immense.regions.map(region => region.name)).size, immense.regions.length, 'region names are unique');
  const shore = shoreMask(standard);
  for (let i = 0; i < standard.tiles.length; i++) {
    const tile = standard.tiles[i];
    for (const key of TILE_RESOURCES) assert.ok(tile[key] >= 0 && tile[key] <= 1);
    if (tile.terrain === 'water') assert.ok(TILE_RESOURCES.every(key => tile[key] === 0));
    if (!shore[i]) assert.equal(tile.fish, 0, 'fish only along shores');
    if (tile.gems > 0) assert.ok(tile.terrain === 'mountain' || tile.elevation > .6, 'gems only in high ground');
  }
  assert.ok(standard.tiles.some(tile => tile.gems > .1) && standard.tiles.some(tile => tile.clay > .4));
  // Deposits come from noise, not the random generator: regeneration is identical.
  assert.deepEqual(generateResources(standard, 500, shore[500]), Object.fromEntries([...TILE_RESOURCES, ...DEPOSITS].map(key => [key, standard.tiles[500][key]])));
});

test('game and fish regrow logistically: depleted stocks recover slowly, healthy ones quickly', () => {
  const tile = { terrain: 'forest', fiber: 0, herbs: 0, game: .01, fish: 0, clay: 0 };
  const cap = capacity(tile, 0, 'game');
  renew(tile, 0, 1); const nearlyGone = tile.game - .01;
  const healthy = { ...tile, game: cap / 2 };
  renew(healthy, 0, 1); const recovering = healthy.game - cap / 2;
  assert.ok(recovering > nearlyGone * 3);
  const full = { ...tile, game: cap }; renew(full, 0, 1);
  assert.equal(full.game, cap, 'never exceeds the land’s capacity');
});

test('research is completed by a real demonstration that consumes its materials', () => {
  const { sim, group, agent } = society();
  const civ = group.civilization;
  civ.technologies = ['cultivation', 'stonecraft', 'pottery'];
  civ.project = { technology: 'brickmaking', progress: 170, required: 170, contributors: [] };
  civ.research.brickmaking = 170;
  agent.mind.values.mastery = 1; agent.traits.curiosity = 1; agent.mind.needs.stimulation = 90; agent.mind.ambition = 1;
  civ.stock.clay = 0;
  sim._random = () => 0;
  considerCivilization(sim, agent, group);
  assert.ok(!civ.technologies.includes('brickmaking'), 'no clay, no demonstration');
  assert.notEqual(agent.mind.policy.action, 'research');
  sim.day++; civ.stock.clay = 5;
  considerCivilization(sim, agent, group);
  assert.ok(civ.technologies.includes('brickmaking'));
  assert.equal(civ.stock.clay, 2, 'the demonstration used three units of clay');
});

test('production chains transform real inputs: bricks, cloth, remedies and herds', () => {
  // Everything else is built and stocked, so only the chain under test has work to do.
  const run = (setup, action) => {
    const { sim, group, agent } = society();
    const civ = group.civilization;
    civ.technologies = TECHNOLOGIES.map(tech => tech.id);
    for (const id of Object.keys(BUILDINGS)) civ.buildings[id] = 1;
    Object.assign(civ.stock, { tools: 20, goods: 20, metal: 20, cloth: 20, remedies: 20, bricks: 20, stone: 20, ore: 20, coal: 20, uranium: 20, machines: 20, electronics: 20, warheads: 20 });
    setup(sim, group, civ, agent);
    sim._random = () => 0;
    considerCivilization(sim, agent, group);
    assert.equal(agent.mind.policy.action, action);
    return { sim, civ, group, agent };
  };
  const bricks = run((sim, group, civ) => { civ.stock.bricks = 0; civ.stock.clay = 1; group.wood = 1; }, 'bricks');
  assert.ok(Math.abs(bricks.civ.stock.clay - .6) < 1e-9 && bricks.civ.stock.bricks + bricks.agent.wealth > .4);
  const cloth = run((sim, group, civ) => { civ.stock.cloth = 0; civ.stock.fiber = 1; }, 'weave');
  assert.ok(Math.abs(cloth.civ.stock.fiber - .6) < 1e-9 && cloth.civ.stock.cloth + cloth.agent.wealth > .25);
  const remedies = run((sim, group, civ) => { civ.stock.remedies = 0; civ.stock.herbs = 1; }, 'remedy');
  assert.ok(Math.abs(remedies.civ.stock.herbs - .7) < 1e-9 && remedies.civ.stock.remedies + remedies.agent.wealth > .25);
  const herds = run((sim, group, civ, agent) => {
    civ.buildings.pasture = 2; civ.buildings.farm = 0; civ.technologies = civ.technologies.filter(id => id !== 'cultivation'); group.food = 1;
    agent.mind.values.security = 1;
    for (const tile of sim.tiles) { tile.game = 0; tile.fish = 0; }
    for (const tile of sim.tiles) if (tile.terrain === 'grass' || tile.terrain === 'sand') tile.fiber = .6;
  }, 'herd');
  assert.ok(herds.civ.diet.herd > 0 && herds.civ.stock.hides > 0, 'grass became food and hides');
});

test('hunting takes living game, yields food and hides, and depletes the land', () => {
  const { sim, group, agent } = society();
  const civ = group.civilization;
  group.food = 0;
  for (const tile of sim.tiles) { tile.game = tile.terrain === 'water' ? 0 : .3; tile.fish = 0; }
  const here = sim._tile(agent.x, agent.y); here.game = .8;
  agent.mind.riskTolerance = 1; agent.mind.values.security = 1;
  for (const person of sim.agents) person.skills.foraging = 60;
  sim._random = () => 0;
  considerCivilization(sim, agent, group);
  assert.equal(agent.mind.policy.action, 'hunt');
  assert.ok(here.game < .8 && group.food > 0 && civ.stock.hides > 0 && civ.diet.game > 0);
});

test('markets let one visit settle two exchanges; trades conserve every good', () => {
  const { sim, group, agent } = society();
  const partners = sim.agents.slice(1, 4);
  const other = initializeSociety({ ...group, id: sim.nextGroupId++, name: 'Partner', members: partners.map(person => person.id), food: 1, wood: 0 });
  initializeGroupIdeas(other); initializeCulture(sim, other);
  group.members = group.members.filter(id => !partners.some(person => person.id === id));
  for (const person of partners) person.groupId = other.id;
  sim.groups.push(other); sim._groupMap.set(other.id, other);
  other.civilization.stock.tools = 4; other.civilization.stock.cloth = 4;
  group.civilization.technologies = TECHNOLOGIES.map(tech => tech.id);
  for (const id of Object.keys(BUILDINGS)) group.civilization.buildings[id] = 1;
  group.civilization.buildings.market = 1; group.wood = 0; group.civilization.stock.stone = 0;
  agent.skills.leadership = 100; agent.mind.ambition = 1; sim.day = 15;
  const goods = () => group.food + other.food + group.civilization.stock.tools + other.civilization.stock.tools + group.civilization.stock.cloth + other.civilization.stock.cloth;
  const before = goods();
  sim._random = () => 0;
  considerCivilization(sim, agent, group);
  assert.equal(agent.mind.policy.action, 'trade');
  assert.equal(group.civilization.stock.tools + group.civilization.stock.cloth, 2, 'the market allowed a second exchange in one visit');
  assert.equal(goods(), before);
});

test('varied diets support recovery, and unobtainable buildings are not attempted', () => {
  const { sim, group } = society();
  const civ = group.civilization;
  civ.diet = { wild: 10, crops: 10, game: 10, fish: 10, herd: 0 };
  assert.equal(dietVariety(group), 3);
  civ.diet = { wild: 40, crops: 0, game: 0, fish: 0, herd: 0 };
  assert.equal(dietVariety(group), 0);
  civ.technologies = TECHNOLOGIES.map(tech => tech.id);
  for (const id of Object.keys(BUILDINGS)) civ.buildings[id] = 1;
  civ.buildings.temple = 0;
  for (const tile of sim.tiles) tile.gems = 0;
  delete group.civilization.survey;
  const agent = sim.agents[0];
  sim._random = () => 0;
  considerCivilization(sim, agent, group);
  assert.notEqual(agent.mind.policy.action, 'prospect', 'no gems anywhere near: no temple, no futile prospecting');
});

test('norms drift toward members and experience; customs emerge, strengthen, spread and change output', () => {
  const { sim, group } = society({ population: 10 });
  const culture = group.civilization.culture;
  const innovation = culture.norms.innovation;
  for (const agent of sim.agents) { agent.psyche.personality.openness = 1; agent.traits.curiosity = 1; }
  for (let month = 0; month < 12; month++) { sim.day = 30 * (month + 1) + group.id % 30 - (30 * (month + 1)) % 30; advanceCulture(sim, g => innovationEffects(sim, g)); }
  assert.ok(culture.norms.innovation > innovation, 'curious members make an inventive culture');
  group.civilization.diet = { wild: 5, crops: 0, game: 0, fish: 200, herd: 0 };
  sim._random = () => 0;
  culture.lastCustom = sim.day - 200;
  sim.day += 1;
  while (sim.day % 30 !== group.id % 30) sim.day++;
  advanceCulture(sim, g => innovationEffects(sim, g));
  const custom = sim.culture.customs.find(entry => entry.basis === 'cuisine:fish') || sim.culture.customs[0];
  assert.ok(custom, 'a custom grows from what the society eats');
  assert.ok(culture.customs.some(entry => entry.id === custom.id));
  const plain = innovationEffects(sim, { civilization: { ...group.civilization, culture: { ...culture, customs: [] } } });
  const effects = innovationEffects(sim, group);
  assert.ok(Object.keys(custom.effects).filter(key => key !== 'cohesion').some(key => effects[key] > plain[key]), 'customs change real effects');
  assert.ok(customModifiers(sim, group));
  // Contact carries customs to others.
  const other = initializeSociety({ ...group, id: sim.nextGroupId++, name: 'Neighbours', members: [] });
  initializeGroupIdeas(other); initializeCulture(sim, other);
  culture.customs = culture.customs.map(entry => ({ ...entry, strength: 1 }));
  const shared = shareCustom(sim, group, other, 1);
  assert.ok(shared && other.civilization.culture.customs.some(entry => entry.id === shared.id));
});

test('societies rise through tiers and choose leaders who steer members', () => {
  const { sim, group } = society({ population: 12 });
  const civ = group.civilization;
  assert.equal(tierOf(group), 1 - (Object.values(civ.buildings).reduce((a, b) => a + b, 0) >= 2 ? 0 : 1));
  civ.buildings.farm = 4; civ.buildings.workshop = 3; civ.technologies = ['writing', 'forestry'];
  assert.equal(tierOf(group), 2);
  const leaderSkill = sim.agents[3];
  leaderSkill.skills.leadership = 100; leaderSkill.mind.ambition = 1;
  while (sim.day % 30 !== group.id % 30) sim.day++;
  advanceCulture(sim, g => innovationEffects(sim, g));
  assert.equal(civ.culture.tier, 2);
  assert.equal(civ.culture.leaderId, leaderSkill.id);
  assert.ok(sim.events.some(event => /grows into a town/.test(event.text)));
});

test('expansion: pressured, expansionist societies send willing pioneers to found kin colonies', () => {
  const { sim, group } = society({ population: 24 });
  const culture = group.civilization.culture;
  for (const agent of sim.agents) agent.psyche.expansion = .3;
  const eager = sim.agents.slice(0, 8);
  for (const agent of eager) agent.psyche.expansion = .9;
  culture.norms.expansion = .9; culture.founded = 0; culture.lastColony = 0; sim.day = 800;
  group.civilization.technologies = ['cultivation', 'stonecraft'];
  group.civilization.stock.tools = 10;
  const food = group.food, tools = group.civilization.stock.tools;
  sim._random = () => 0;
  const near = { food: .05, fertility: .2, wood: .1, stone: .1, ore: 0, clay: 0, fiber: .1, herbs: .1, game: .05, fish: 0, gems: 0 };
  assert.ok(landPressure(group, near) > .3);
  let colony = null;
  const result = considerExpansion(sim, group, near, (site, settlers) => { colony = sim._foundColony(site, settlers); return colony; });
  assert.ok(result, 'the society founds a colony');
  assert.ok(result.settlers.every(agent => agent.psyche.expansion > .45 || agent.age < 14 || eager.some(e => e.partnerId === agent.id)), 'only the willing (and their families) go');
  assert.ok(colony.members.length >= 4);
  assert.deepEqual(colony.civilization.technologies, group.civilization.technologies);
  assert.equal(colony.civilization.culture.parentId, group.id);
  assert.ok(Math.abs(group.food + colony.food - food) < 1e-9 && Math.abs(group.civilization.stock.tools + colony.civilization.stock.tools - tools) < 1e-9, 'stores are divided, not created');
  assert.ok(result.settlers.filter(agent => agent.age >= 14).every(agent => agent.psyche.record.founded === 1));
  // Settled neighbours share land peacefully; expansionist ones clash.
  const calm = { x: 0, y: 0, members: group.members, civilization: { culture: { norms: { expansion: .3 }, tier: 0 } } };
  const pushy = { x: 4, y: 0, members: group.members, civilization: { culture: { norms: { expansion: .9 }, tier: 0 } } };
  assert.equal(claimFriction(calm, { ...calm, x: 4 }), 0);
  assert.ok(claimFriction(pushy, { ...pushy, x: 0 }) > 0);
});

test('worlds stay deterministic and exact through culture, colonies and material economies', () => {
  const sim = new Simulation({ seed: 'long-arc', size: 'standard', population: 96 });
  sim.step(120 * 12);
  assert.ok(sim.groups.every(group => group.civilization.culture));
  assert.ok(sim.culture.customsBorn > 0);
  const restored = Simulation.deserialize(JSON.parse(JSON.stringify(sim.serialize())));
  sim.step(240); restored.step(240);
  assert.ok(isDeepStrictEqual(restored.serialize(), sim.serialize()), 'a restored world continues identically');
  for (const corrupt of [
    save => { save.tiles[5].clay = 2; },
    save => { save.groups[0].civilization.culture.norms.piety = -1; },
    save => { save.groups[0].civilization.culture.customs = [{ id: 'custom-99999', strength: .5 }]; },
    save => { save.groups[0].civilization.culture.tier = 7; },
    save => { save.culture.customs[0].kind = 'sorcery'; },
    save => { save.groups[0].civilization.stock.bricks = -1; },
  ]) {
    const state = sim.serialize(); corrupt(state);
    assert.throws(() => Simulation.deserialize(state), /Invalid/);
  }
  const legacy = sim.serialize();
  legacy.version = 4; delete legacy.culture;
  for (const tile of legacy.tiles) for (const key of TILE_RESOURCES) delete tile[key];
  for (const group of legacy.groups) { delete group.civilization.culture; delete group.civilization.diet; for (const key of ['clay', 'fiber', 'herbs', 'gems', 'hides', 'bricks', 'cloth', 'remedies', 'coal', 'uranium', 'machines', 'electronics', 'warheads']) { delete group.civilization.stock[key]; delete group.civilization.production[key]; } for (const key of ['fishery', 'loom', 'apothecary', 'pasture', 'market', 'library', 'temple', 'walls', 'observatory', 'hall', 'dock', 'factory', 'railway', 'hospital', 'powerplant', 'datacenter', 'reactor', 'silo', 'airport']) delete group.civilization.buildings[key]; delete group.civilization.breakthroughs; delete group.civilization.frontier; delete group.civilization.advances; }
  delete legacy.breakthroughs;
  for (const agent of legacy.agents) { delete agent.psyche.expansion; delete agent.psyche.record.founded; }
  const known = new Set(TECHNOLOGIES.slice(0, 0).map(tech => tech.id));
  for (const group of legacy.groups) { group.civilization.technologies = group.civilization.technologies.filter(id => ['stonecraft', 'cultivation', 'forestry', 'pottery', 'irrigation', 'metallurgy', 'medicine', 'writing', 'engineering'].includes(id)); if (group.civilization.project && !group.civilization.technologies.includes(group.civilization.project.technology) && !TECHNOLOGIES.find(tech => tech.id === group.civilization.project.technology).requires.every(id => group.civilization.technologies.includes(id))) group.civilization.project = null; }
  assert.equal(known.size, 0);
  const migrated = Simulation.deserialize(structuredClone(legacy)), twin = Simulation.deserialize(structuredClone(legacy));
  assert.equal(migrated.serialize().version, 7);
  assert.ok(migrated.groups.every(group => group.civilization.culture && have(group, 'bricks') === 0));
  assert.ok(migrated.agents.every(agent => agent.psyche.expansion > 0));
  migrated.step(60); twin.step(60);
  assert.ok(isDeepStrictEqual(migrated.serialize(), twin.serialize()), 'migration is deterministic');
});
