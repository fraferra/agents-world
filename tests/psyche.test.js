import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';
import { TECHNOLOGIES, SKILLS, BUILDINGS, initializeSociety, considerCivilization, communicate, observeAction } from '../src/civilization.js';
import { PERSONALITY, techniqueFactor, reflect, converse, trustIn, recordEpisode, rememberPlace } from '../src/psyche.js';

function community(seed = 'inner-lives') {
  const sim = new Simulation({ seed, population: 8, size: 'compact' });
  const center = sim._landNear(25.5, 30.5);
  const group = initializeSociety({ id: sim.nextGroupId++, name: 'Test Commons', color: '#809260', ...center, members: sim.agents.map(agent => agent.id), food: 50, wood: 10, shelters: 3, culture: 'Stewardship', _foundedDay: 0, _lastMoveDay: 0, _shortageDays: 0 });
  sim.groups = [group]; sim._groupMap.set(group.id, group);
  for (const agent of sim.agents) {
    Object.assign(agent, center, { groupId: group.id, hunger: 0, energy: 95, health: 100, social: 100 });
    agent.inventory.food = 5;
    agent.mind.values = { security: 0, belonging: 0, autonomy: 0, mastery: 1, care: 0 };
    agent.mind.ambition = 1; agent.mind.needs.stimulation = 90; agent.traits.curiosity = 1;
    agent.skills = Object.fromEntries(SKILLS.map(skill => [skill, 0]));
    // A neutral inner life, so each test changes only what it measures.
    Object.assign(agent.psyche, { personality: Object.fromEntries(PERSONALITY.map(key => [key, .5])), talents: Object.fromEntries(SKILLS.map(skill => [skill, 1])), mood: { joy: .3, pride: 0, fear: 0, anger: 0, grief: 0 }, preferences: {}, expectations: {}, techniques: [], episodes: [], places: [], reasoning: [], practice: {} });
    agent.psyche.aspiration = { kind: 'wanderer', text: 'See distant lands', since: 0, base: 0, target: 3, progress: 0, achieved: 0, start: 0 };
  }
  sim._buildSpatial();
  sim._random = () => 0;
  return { sim, group, agent: sim.agents[0] };
}

const correlation = (xs, ys) => {
  const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  return sxy / Math.sqrt(sxx * syy);
};

test('personality and talents vary, agree with observable traits, and are inherited with variation', () => {
  const sim = new Simulation({ seed: 'temperaments', population: 80 });
  assert.notDeepEqual(sim.agents[0].psyche.personality, sim.agents[1].psyche.personality);
  assert.notDeepEqual(sim.agents[0].psyche.talents, sim.agents[1].psyche.talents);
  assert.ok(correlation(sim.agents.map(a => a.traits.curiosity), sim.agents.map(a => a.psyche.personality.openness)) > .2);
  assert.ok(correlation(sim.agents.map(a => a.traits.sociability), sim.agents.map(a => a.psyche.personality.extraversion)) > .2);
  const [mother, father] = sim.agents;
  const child = sim._newAgent(mother.x, mother.y, 0, [mother, father]);
  for (const key of PERSONALITY) {
    const low = Math.min(mother.psyche.personality[key], father.psyche.personality[key]), high = Math.max(mother.psyche.personality[key], father.psyche.personality[key]);
    assert.ok(child.psyche.personality[key] >= low - .16 && child.psyche.personality[key] <= high + .16, key);
  }
  for (const skill of SKILLS) assert.ok(child.psyche.talents[skill] >= .5 && child.psyche.talents[skill] <= 1.6);
  assert.equal(child.psyche.aspiration.kind, 'grow');
});

test('talent changes how fast practice becomes skill, and practice is tracked', () => {
  const { sim, agent } = community();
  const peer = sim.agents[1];
  agent.psyche.talents.foraging = 1.5; peer.psyche.talents.foraging = .6;
  for (let i = 0; i < 40; i++) for (const person of [agent, peer]) { person.action = 'foraging'; observeAction(sim, person); }
  assert.ok(agent.skills.foraging > peer.skills.foraging * 2.2);
  assert.ok(agent.psyche.practice.foraging > 6);
});

test('unpracticed skills fade to a floor while practiced skills persist', () => {
  const { sim, agent } = community();
  agent.skills.farming = 60; agent.skills.mining = 60;
  for (let i = 0; i < 24; i++) { agent.psyche.practice = { farming: 3 }; sim.day += 30; reflect(sim, agent); }
  assert.equal(agent.skills.farming, 60);
  assert.ok(agent.skills.mining < 40 && agent.skills.mining >= 15);
  agent.skills.medicine = 12;
  sim.day += 30; reflect(sim, agent);
  assert.equal(agent.skills.medicine, 12, 'basic competence below the floor is never lost');
});

test('techniques give their holder real productive advantages', () => {
  const tools = hafting => {
    const { sim, group, agent } = community();
    const civ = group.civilization;
    civ.technologies = TECHNOLOGIES.map(tech => tech.id);
    for (const id of Object.keys(BUILDINGS)) civ.buildings[id] = 1;
    for (const person of sim.agents) person.knowledge = [...civ.technologies];
    agent.skills.crafting = 100;
    civ.stock.stone = 5; civ.stock.ore = 0; civ.stock.metal = 0; civ.stock.goods = 12;
    if (hafting) agent.psyche.techniques.push({ id: 'hafting', day: 0, source: 'practice' });
    considerCivilization(sim, agent, group);
    assert.equal(agent.mind.policy.action, 'craft');
    return civ.stock.tools;
  };
  const plain = tools(false), skilled = tools(true);
  assert.ok(Math.abs(skilled / plain - 1.15) < 1e-9, 'hafting yields 15% more tools from the same inputs');
  const { agent } = community();
  assert.equal(techniqueFactor(agent, 'heal'), 1);
  agent.psyche.techniques.push({ id: 'poultices', day: 0, source: 'practice' }, { id: 'bone-setting', day: 0, source: 'practice' });
  assert.ok(Math.abs(techniqueFactor(agent, 'heal') - 1.3 * 1.25) < 1e-12);
});

test('techniques are worked out through skilled practice and taught only to grounded pupils', () => {
  const { sim, agent } = community();
  sim._random = () => .001;
  for (let i = 0; i < 20; i++) { sim.day += 30; reflect(sim, agent); }
  assert.equal(agent.psyche.techniques.length, 0, 'no skill, no technique');
  agent.skills.farming = 95;
  for (let i = 0; i < 5 && !agent.psyche.techniques.length; i++) { agent.psyche.practice = { farming: 5 }; sim.day += 30; reflect(sim, agent); }
  assert.deepEqual(agent.psyche.techniques.map(entry => [entry.id, entry.source]), [['rotation', 'practice']]);
  assert.equal(sim.psyche.techniquesDiscovered, 1);
  assert.deepEqual(sim.psyche.firsts, ['rotation']);
  assert.match(sim.events[0].text, /first to work out crop rotation/);

  sim._random = () => 0;
  const novice = sim.agents[1], pupil = sim.agents[2];
  novice.skills.farming = 5; pupil.skills.farming = 26;
  sim.day++; communicate(sim, agent, novice, true);
  assert.equal(novice.psyche.techniques.length, 0, 'an ungrounded pupil cannot absorb a technique');
  sim.day++; communicate(sim, agent, pupil, true);
  assert.deepEqual(pupil.psyche.techniques.map(entry => [entry.id, entry.source, entry.teacherId]), [['rotation', 'taught', agent.id]]);
  assert.equal(sim.civilization.messages[0].kind, 'technique');
  assert.equal(sim.civilization.messages[0].techniqueId, 'rotation');
  assert.equal(sim.psyche.techniquesTaught, 1);
});

test('learned expectations and memories change the choice, and the reasons are recorded', () => {
  const { sim, group, agent } = community();
  group.civilization.project = { technology: 'stonecraft', progress: 0, required: 65, contributors: [] };
  group.civilization.research.stonecraft = 0;
  considerCivilization(sim, agent, group);
  assert.equal(agent.mind.policy.action, 'research');
  const first = agent.psyche.reasoning.find(item => item.action === 'research');
  assert.ok(first.factors.some(factor => factor.label === 'Curious to try it'));
  assert.ok(Math.abs(first.score - first.base - first.factors.reduce((sum, factor) => sum + factor.value, 0)) < 1e-6);

  sim.day++;
  agent.psyche.expectations.research = -1; agent.psyche.preferences.research = -1;
  recordEpisode(sim, agent, { type: 'setback', text: 'Our research collapsed after a season of work.', valence: -1, salience: 1, activity: 'research' });
  considerCivilization(sim, agent, group);
  assert.notEqual(agent.mind.policy.action, 'research', 'bad experience steers the person elsewhere');
  const avoided = agent.psyche.reasoning.find(item => item.action === 'research');
  assert.ok(avoided, 'the rejected option is still explained');
  const labels = avoided.factors.map(factor => factor.label);
  assert.ok(labels.includes('Went badly before') && labels.includes('Dislikes this work'));
  assert.ok(labels.some(label => label.startsWith('Remembers: our research collapsed')));
  assert.ok(agent.psyche.reasoning.length <= 3 && agent.psyche.reasoning.every(item => item.factors.length <= 5));
});

test('fear makes risky work less attractive', () => {
  const choose = fear => {
    const { sim, group, agent } = community('fearful');
    group.civilization.technologies = ['stonecraft']; group.civilization.project = null; group.civilization.stock.stone = 0;
    agent.skills.mining = 100; agent.mind.values.mastery = 0; agent.mind.needs.stimulation = 0; agent.traits.curiosity = 0; agent.mind.ambition = 0;
    for (const tile of sim.tiles) tile.stone = 0;
    sim._tile(agent.x, agent.y).stone = 1;
    agent.psyche.mood.fear = fear;
    considerCivilization(sim, agent, group);
    return agent.psyche.reasoning.find(item => item.action === 'quarry');
  };
  const calm = choose(0), afraid = choose(1);
  assert.ok(afraid.score < calm.score - 10);
  assert.ok(afraid.factors.some(factor => factor.label === 'Afraid of the risk'));
});

test('outcomes on arrival shape expectations; travelling is not judged as failure', () => {
  const quarry = stone => {
    const { sim, group, agent } = community('quarries');
    group.civilization.technologies = ['stonecraft']; group.civilization.project = null; group.civilization.stock.stone = 0;
    agent.skills.mining = 100; agent.mind.values.mastery = 0; agent.mind.needs.stimulation = 0; agent.traits.curiosity = 0; agent.mind.ambition = 0;
    for (const tile of sim.tiles) tile.stone = 0;
    sim._tile(agent.x, agent.y).stone = stone;
    considerCivilization(sim, agent, group);
    assert.equal(agent.mind.policy.action, 'quarry');
    return agent.psyche.expectations.quarry;
  };
  assert.ok(quarry(1) > 0, 'a rich deposit raises expectations');
  assert.ok(quarry(.001) < 0, 'an exhausted deposit lowers them');
  assert.equal(quarry(0), undefined, 'searching without reaching a deposit teaches nothing yet');
});

test('bereavement brings lasting grief and a formative memory that outlives ordinary ones', () => {
  const sim = new Simulation({ seed: 'bereavement', population: 6, size: 'compact' });
  const [survivor, partner] = sim.agents;
  survivor.partnerId = partner.id; partner.partnerId = survivor.id;
  sim._remember(survivor, partner);
  recordEpisode(sim, survivor, { type: 'work', text: 'Mended a fence.', valence: .3, salience: .5 });
  partner.health = 0;
  sim._removeDead();
  assert.ok(survivor.psyche.mood.grief > .3);
  const loss = survivor.psyche.episodes.find(episode => episode.type === 'loss');
  assert.equal(loss.about, partner.id);
  assert.match(loss.text, /my partner, died/);
  for (let i = 0; i < 40; i++) { sim.day += 30; reflect(sim, survivor); }
  assert.ok(survivor.psyche.episodes.some(episode => episode.type === 'loss'), 'a decade later the loss is remembered');
  assert.ok(!survivor.psyche.episodes.some(episode => episode.text === 'Mended a fence.'), 'trivial memories fade');
  for (let i = 0; i < 20; i++) recordEpisode(sim, survivor, { type: 'work', text: `Task ${i}.`, valence: 0, salience: .2 });
  assert.ok(survivor.psyche.episodes.length <= 12);
});

test('remembered and described places guide people to resources', () => {
  const sim = new Simulation({ seed: 'wayfinding', population: 2, size: 'compact' });
  const [scout, listener] = sim.agents;
  for (const tile of sim.tiles) tile.food = 0;
  const target = sim._landNear(scout.x + 18, scout.y);
  sim._tile(target.x, target.y).food = 1;
  const before = Math.hypot(target.x - scout.x, target.y - scout.y);
  rememberPlace(sim, scout, 'food', target.x, target.y, 1);
  scout.hunger = 50; scout.inventory.food = 0;
  sim._forage(scout);
  assert.equal(scout.action, 'heading to remembered foraging ground');
  assert.ok(Math.hypot(target.x - scout.x, target.y - scout.y) < before - .5);

  sim._random = () => 0;
  const message = converse(sim, scout, listener, 1);
  assert.equal(message.kind, 'resource');
  assert.match(message.text, /will remember the way/);
  assert.equal(listener.psyche.places.length, 1);
  assert.equal(listener.psyche.places[0].kind, 'food');
});

test('gossip, lessons and gratitude shape personal trust and known expertise', () => {
  const { sim, agent: speaker } = community('reputations');
  const listener = sim.agents[1], subject = sim.agents[2];
  for (const [a, b] of [[speaker, subject], [listener, subject], [listener, speaker], [speaker, listener]]) sim._remember(a, b);
  speaker._relations.find(r => r.id === subject.id).trust = .95;
  listener._relations.find(r => r.id === subject.id).trust = .4;
  subject.skills.medicine = 60;
  speaker._relations.find(r => r.id === subject.id).expertise = 'medicine';
  sim._random = () => .8;
  const talk = converse(sim, speaker, listener, 1);
  assert.equal(talk.kind, 'gossip');
  assert.ok(trustIn(listener, subject.id) > .5, 'a trusted friend’s praise raises trust');
  assert.equal(listener._relations.find(r => r.id === subject.id).expertise, 'medicine');

  sim._random = () => 0;
  const before = trustIn(listener, speaker.id);
  speaker.skills.mining = 70;
  sim.day++;
  communicate(sim, speaker, listener, true);
  assert.equal(sim.civilization.messages[0].kind, 'teaching');
  const bond = listener._relations.find(r => r.id === speaker.id);
  assert.ok(trustIn(listener, speaker.id) > before);
  assert.equal(bond.favors, 1);
  assert.equal(bond.expertise, 'mining');
});

test('aspirations advance with real accomplishments and are replaced when achieved', () => {
  const { sim, agent } = community();
  agent.psyche.aspiration = { kind: 'mastery', skill: 'farming', text: 'Become a master farmer', since: 0, base: 0, target: 60, progress: 0, achieved: 0, start: 0 };
  agent.skills.farming = 30; agent.psyche.practice = { farming: 2 };
  sim.day += 30; reflect(sim, agent);
  assert.equal(agent.psyche.aspiration.progress, .5);
  agent.skills.farming = 61; agent.psyche.practice = { farming: 2 };
  sim.day += 30; reflect(sim, agent);
  assert.equal(sim.psyche.aspirationsAchieved, 1);
  assert.equal(agent.psyche.aspiration.achieved, 1);
  assert.ok(agent.psyche.mood.pride > .3);
  assert.ok(agent.psyche.episodes.some(episode => episode.type === 'aspiration' && /master farmer/.test(episode.text)));
  assert.ok(agent.psyche.thought.length > 0);
});

test('inner lives resume exactly, reject forged state, and older saves gain them deterministically', () => {
  const sim = new Simulation({ seed: 'persistent-minds' });
  sim.step(900);
  assert.ok(sim.agents.some(agent => agent.psyche.techniques.length), 'techniques emerge within a few years');
  assert.ok(sim.agents.some(agent => agent.psyche.episodes.length && Object.keys(agent.psyche.expectations).length));
  const restored = Simulation.deserialize(JSON.parse(JSON.stringify(sim.serialize())));
  assert.deepEqual(restored.serialize(), sim.serialize());
  sim.step(120); restored.step(120);
  assert.deepEqual(restored.serialize(), sim.serialize());

  const holder = sim.agents.findIndex(agent => agent.psyche.techniques.length);
  for (const corrupt of [
    save => { save.agents[0].psyche.personality.openness = 2; },
    save => { save.agents[0].psyche.mood.fear = -1; },
    save => { save.agents[0].psyche.talents.mining = 5; },
    save => { save.agents[0].psyche.techniques = [{ id: 'telepathy', day: 0, source: 'practice' }]; },
    save => { save.agents[0].psyche.techniques = [{ id: 'seed-saving', day: 0, source: 'practice' }]; },
    save => { save.agents[holder].psyche.techniques[0].source = 'dream'; },
    save => { save.agents[0].psyche.episodes = Array(13).fill({ day: 0, type: 'x', text: 'x', valence: 0, salience: .5 }); },
    save => { save.agents[0].psyche.aspiration.kind = 'conquest'; },
    save => { save.agents[0].psyche.expectations = { dancing: .5 }; },
    save => { save.agents[0].psyche.places = [{ kind: 'gold', x: 1, y: 1, value: .5, day: 0 }]; },
    save => { save.agents.find(agent => agent._relations.length)._relations[0].trust = 3; },
    save => { save.psyche.firsts = ['rotation', 'rotation']; },
  ]) {
    const state = sim.serialize(); corrupt(state);
    assert.throws(() => Simulation.deserialize(state), /Invalid/);
  }

  const legacy = sim.serialize();
  legacy.version = 3; delete legacy.psyche;
  for (const agent of legacy.agents) { delete agent.psyche; agent._relations = agent._relations.map(({ id, strength, lastSeen }) => ({ id, strength, lastSeen })); }
  legacy.civilization.messages = legacy.civilization.messages.filter(message => !['technique', 'advice', 'gossip'].includes(message.kind)).map(({ techniqueId, about, ...message }) => message);
  const migrated = Simulation.deserialize(legacy), twin = Simulation.deserialize(structuredClone(legacy));
  assert.equal(migrated.rngState, legacy.rngState);
  assert.ok(migrated.agents.every(agent => agent.psyche.aspiration && agent.psyche.techniques.length === 0));
  assert.equal(migrated.serialize().version, 6);
  migrated.step(60); twin.step(60);
  assert.deepEqual(migrated.serialize(), twin.serialize());
});
