import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';
import { initializeSociety } from '../src/civilization.js';
import { initializeCulture } from '../src/culture.js';
import { initializeGroupIdeas } from '../src/innovation.js';
import { relationBetween } from '../src/diplomacy.js';

/** Two bands 20 tiles apart. Home holds a single man and two older relatives; the other band a single woman. */
function twoBands() {
  const sim = new Simulation({ seed: 'two-bands', population: 7, size: 'compact' });
  const band = (name, center, people, food) => {
    const group = initializeSociety({ id: sim.nextGroupId++, name, color: '#809260', ...center, members: people.map(agent => agent.id), food, wood: 5, shelters: 2, culture: 'Kinship', _foundedDay: 0, _lastMoveDay: 0, _shortageDays: 0 });
    initializeGroupIdeas(group);
    sim.groups.push(group); sim._groupMap.set(group.id, group);
    for (const agent of people) Object.assign(agent, center, { groupId: group.id, partnerId: null, hunger: 0, energy: 95, health: 100, social: 50 });
    initializeCulture(sim, group);
    return group;
  };
  sim.groups = []; sim._groupMap = new Map();
  const [seeker, uncle, aunt, bride, ...hosts] = sim.agents;
  const setup = (agent, sex, age) => Object.assign(agent, { sex, attraction: 'different', age, _ageDays: age * 120, parentIds: [], children: [], _relations: [], _courtship: null });
  setup(seeker, 'male', 25); setup(uncle, 'male', 60); setup(aunt, 'female', 58); setup(bride, 'female', 24);
  for (const host of hosts) setup(host, 'male', 62);
  seeker.psyche.personality.openness = .8;
  const home = band('Home Camp', sim._mainlandNear(38, 32), [seeker, uncle, aunt], 10);
  const away = band('River Camp', sim._mainlandNear(58, 32), [bride, ...hosts], 60);
  sim._buildSpatial();
  return { sim, home, away, seeker, bride };
}

test('a single with no one to marry at home travels to another band, courts, marries and joins the better-provided band', () => {
  const { sim, home, away, seeker, bride } = twoBands();
  sim._random = () => 0;
  sim._considerCourtship(seeker, home);
  assert.deepEqual(seeker._courtship, { groupId: away.id, since: sim.day });
  const start = Math.hypot(seeker.x - away.x, seeker.y - away.y);
  for (let day = 0; day < 60 && !seeker.partnerId; day++) { sim.day++; sim._buildSpatial(); assert.ok(sim._court(seeker, home)); }
  assert.ok(start > 10 && seeker.partnerId === bride.id && bride.partnerId === seeker.id, 'they married after the journey');
  assert.equal(seeker.groupId, away.id, 'the larger, better-fed band became their home');
  assert.equal(seeker._courtship, null);
  assert.ok(!home.members.includes(seeker.id) && away.members.includes(seeker.id));
  assert.ok(relationBetween(sim, home, away).trust > 0, 'the marriage binds the two bands');
  assert.ok(sim.events.some(event => event.text.includes('marries')));
});

test('a partner is brought home when home offers more', () => {
  const { sim, home, away, seeker, bride } = twoBands();
  home.food = 400;
  sim._random = () => 0;
  sim._considerCourtship(seeker, home);
  for (let day = 0; day < 60 && !seeker.partnerId; day++) { sim.day++; sim._buildSpatial(); sim._court(seeker, home); }
  assert.equal(bride.groupId, home.id);
  assert.equal(seeker.groupId, home.id);
});

test('nobody courts across a war, nor leaves when someone suitable lives at home', () => {
  const { sim, home, away, seeker, bride } = twoBands();
  sim._random = () => 0;
  sim.diplomacy.relations.push({ a: home.id, b: away.id, trust: -.5, tension: 90, status: 'war', since: 0, lastContact: 0, warDays: 5, casualties: 0, tradeTotal: 0, reason: 'Test war.' });
  sim._considerCourtship(seeker, home);
  assert.equal(seeker._courtship, null);
  sim.diplomacy.relations = [];
  away.members = away.members.filter(id => id !== bride.id); home.members.push(bride.id); bride.groupId = home.id;
  sim.day++;
  sim._considerCourtship(seeker, home);
  assert.equal(seeker._courtship, null, 'a suitable partner at home keeps them there');
});

test('courtships survive a save exactly, and forged ones are rejected', () => {
  const sim = new Simulation({ seed: 'courting-save', population: 40, size: 'compact' });
  sim.step(200);
  const group = sim.groups[0];
  const single = sim.agents.find(agent => !agent.partnerId && agent.age >= 16);
  single._courtship = { groupId: group.id, since: sim.day };
  const saved = sim.serialize();
  const restored = Simulation.deserialize(structuredClone(saved));
  assert.deepEqual(restored.serialize(), saved);
  restored.step(30); sim.step(30);
  assert.deepEqual(restored.serialize(), sim.serialize());
  const forged = structuredClone(saved);
  forged.agents.find(agent => agent.id === single.id)._courtship = { groupId: saved.nextGroupId + 5, since: 0 };
  assert.throws(() => Simulation.deserialize(forged), /courtship/);
});
