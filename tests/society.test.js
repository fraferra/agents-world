import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';
import { TECHNOLOGIES, SKILLS, initializeSociety, roleOf } from '../src/civilization.js';
import { initializeCulture } from '../src/culture.js';
import { initializeGroupIdeas } from '../src/innovation.js';
import { advanceEnterprise, companiesIn } from '../src/enterprise.js';
import { advancePolity, partiesOf, rulingParty, countryOf, stance } from '../src/polity.js';
import { establishKinship, advanceDiplomacy } from '../src/diplomacy.js';

function town(people = 24, count = 1) {
  const sim = new Simulation({ seed: 'civic-life', population: people * count, size: 'compact' });
  sim.groups = []; sim._groupMap = new Map();
  const center = sim._mainlandNear(48, 32);
  for (let index = 0; index < count; index++) {
    const members = sim.agents.slice(index * people, index * people + people);
    const group = initializeSociety({ id: sim.nextGroupId++, name: `Town ${index}`, color: '#809260', x: center.x + index * 4, y: center.y, members: members.map(agent => agent.id), food: 200, wood: 20, shelters: 8, culture: 'Kinship', _foundedDay: 0, _lastMoveDay: 0, _shortageDays: 0 });
    initializeGroupIdeas(group);
    sim.groups.push(group); sim._groupMap.set(group.id, group);
    for (const agent of members) Object.assign(agent, { x: group.x, y: group.y, groupId: group.id, age: 30, _ageDays: 3600 });
    initializeCulture(sim, group);
    group.civilization.technologies = TECHNOLOGIES.map(tech => tech.id);
    group.civilization.buildings.factory = 1; group.civilization.buildings.market = 1; group.civilization.buildings.farm = 2; group.civilization.buildings.hall = 1;
    group.civilization.culture.tier = 3;
  }
  return { sim, groups: sim.groups };
}
const onDay = (sim, group, offset) => { sim.day += 1; while (sim.day % 30 !== (group.id + offset) % 30) sim.day++; };

test('entrepreneurs found firms that earn from real production, pay wages, and can go bankrupt', () => {
  const { sim, groups: [group] } = town();
  const founder = sim.agents[0];
  Object.assign(founder, { wealth: 50 }); founder.mind.ambition = 1; founder.psyche.personality.openness = 1;
  sim._random = () => 0;
  onDay(sim, group, 3); advanceEnterprise(sim);
  const [company] = companiesIn(sim, group);
  assert.ok(company, 'a firm was founded');
  assert.equal(company.ownerId, founder.id);
  assert.ok(founder.wealth < 50, 'its capital came from the founder');
  assert.equal(roleOf(sim, founder, group), 'Entrepreneur');
  const product = { manufacturing: 'machines', mining: 'coal', agriculture: 'food', commerce: 'goods', technology: 'electronics', shipping: 'food' }[company.sector] || 'goods';
  group.civilization.production[product] += 400;
  onDay(sim, group, 3); advanceEnterprise(sim);
  assert.ok(company.revenue > 0, 'it earned from what was produced');
  company.capital = -10;
  onDay(sim, group, 3); advanceEnterprise(sim);
  assert.ok(!companiesIn(sim, group).includes(company), 'a firm out of money is wound up');
  assert.ok(sim.enterprise.failed >= 1);
});

test('like-minded people found a party, it forms a government, and elections follow', () => {
  const { sim, groups: [group] } = town(24);
  group.civilization.culture.norms.hierarchy = .2;
  for (const agent of sim.agents) { agent.mind.values = { security: 0, belonging: 1, autonomy: 0, mastery: 0, care: 1 }; agent.wealth = 0; agent.skills = Object.fromEntries(SKILLS.map(skill => [skill, 30])); }
  sim._random = () => 0;
  onDay(sim, group, 17); advancePolity(sim);
  const [party] = partiesOf(sim, group);
  assert.ok(party, 'a party was founded');
  onDay(sim, group, 17); advancePolity(sim);
  assert.equal(rulingParty(sim, group), party, 'it formed the government');
  assert.equal(group.civilization.culture.leaderId, party.leaderId);
  assert.equal(roleOf(sim, sim._agentMap.get(party.leaderId), group), 'Politician');
  assert.ok(stance(sim.agents[1], group).collectivism > .5);
  const before = sim.polity.elections;
  sim.day += 500; onDay(sim, group, 17); advancePolity(sim);
  assert.equal(sim.polity.elections, before + 1, 'a democracy holds elections');
});

test('a city with its colonies proclaims a country whose members do not go to war with each other, and it all survives a save', () => {
  const { sim, groups: [capital, colony] } = town(14, 2);
  colony.civilization.culture.parentId = capital.id;
  establishKinship(sim, capital, colony);
  sim._random = () => 0;
  sim.day = 60; advancePolity(sim);
  const country = countryOf(sim, capital);
  assert.ok(country && country.members.includes(colony.id));
  assert.equal(country.capitalId, capital.id);
  const relation = sim.diplomacy.relations[0];
  relation.status = 'neutral'; relation.tension = 100;
  sim.day = 72; advanceDiplomacy(sim);
  assert.notEqual(relation.status, 'war');
  delete sim._random;
  const saved = sim.serialize();
  assert.deepEqual(Simulation.deserialize(structuredClone(saved)).serialize(), saved);
  const forged = structuredClone(saved);
  forged.polity.countries[0].capitalId = 999;
  assert.throws(() => Simulation.deserialize(forged), /polity/);
});
