import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';
import { TECHNOLOGIES, initializeSociety } from '../src/civilization.js';
import { initializeCulture } from '../src/culture.js';
import { initializeGroupIdeas } from '../src/innovation.js';
import { relationBetween, overlordOf, advanceDiplomacy } from '../src/diplomacy.js';
import { sameLand } from '../src/infrastructure.js';

function mother(sim, center, people = 20) {
  const members = sim.agents.slice(0, people);
  const group = initializeSociety({ id: sim.nextGroupId++, name: 'Mother Port', color: '#809260', ...center, members: members.map(agent => agent.id), food: 200, wood: 30, shelters: 6, culture: 'Kinship', _foundedDay: 0, _lastMoveDay: 0, _shortageDays: 0 });
  initializeGroupIdeas(group);
  sim.groups = [group]; sim._groupMap = new Map([[group.id, group]]);
  for (const agent of members) Object.assign(agent, center, { groupId: group.id });
  initializeCulture(sim, group);
  group.civilization.technologies = TECHNOLOGIES.map(tech => tech.id);
  group.civilization.buildings.dock = 1;
  return group;
}

test('ships carry scouts and settlers across the water, and overseas colonies owe tribute', () => {
  const sim = new Simulation({ seed: 'across-the-sea', population: 30, size: 'vast' });
  const home = mother(sim, sim._mainlandNear(160, 104));
  // Scouting by ship aims at land beyond the water.
  const target = sim._voyageTarget(home, 140);
  assert.ok(target && !sameLand(sim, home, target), 'a landing place across the water');
  const site = target;
  const settlers = sim.agents.slice(20, 26);
  const colony = sim._foundColony(site, settlers);
  initializeCulture(sim, colony, home);
  sim._bindColony(home, colony);
  const relation = relationBetween(sim, home, colony);
  assert.equal(relation.status, 'tributary');
  assert.equal(relation.colonial, true);
  assert.equal(overlordOf(sim, colony), home);
  // Tribute reaches home across the sea, however far, while ships can make the crossing.
  const food = home.food;
  sim.day = 30 * 4 + Math.max(home.id, colony.id) % 30; colony.food = 100;
  advanceDiplomacy(sim);
  assert.ok(home.food > food, 'tribute arrived');
  assert.equal(relationBetween(sim, home, colony).status, 'tributary');
});

test('an egalitarian people founding a colony over land keeps it as allied kin', () => {
  const sim = new Simulation({ seed: 'across-the-sea', population: 30, size: 'vast' });
  const home = mother(sim, sim._mainlandNear(160, 104));
  home.civilization.culture.norms.hierarchy = .2;
  const site = sim._mainlandNear(home.x + 20, home.y);
  const colony = sim._foundColony(site, sim.agents.slice(20, 26));
  initializeCulture(sim, colony, home);
  sim._bindColony(home, colony);
  assert.equal(relationBetween(sim, home, colony).status, 'alliance');
});

test('a colony stays loyal until it is strong and resentful, then rises', () => {
  const sim = new Simulation({ seed: 'across-the-sea', population: 30, size: 'vast' });
  const home = mother(sim, sim._mainlandNear(160, 104), 10);
  const colony = sim._foundColony(sim._mainlandNear(home.x + 20, home.y), sim.agents.slice(10, 30));
  initializeCulture(sim, colony, home);
  home.civilization.culture.norms.hierarchy = .8;
  sim._bindColony(home, colony);
  const relation = relationBetween(sim, home, colony);
  colony.food = 200;
  sim._random = () => 0;
  sim.day = 30 * 4 + Math.max(home.id, colony.id) % 30;
  advanceDiplomacy(sim);
  assert.equal(relation.status, 'tributary', 'a young colony does not rise, even when stronger');
  relation.tension = 60;
  sim.day += 30; advanceDiplomacy(sim);
  assert.equal(relation.status, 'war', 'a strong, resentful colony rises');
  assert.equal(relation.colonial, undefined);
});
