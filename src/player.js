/** Taking charge of one person.
 *
 * The observer may direct one inhabitant. Each day that person carries out the
 * standing order (walk or sail somewhere, do a job their society supports,
 * forage, rest, explore, seek out someone to talk to, court, give food to, or
 * join a society) instead of deciding for themselves. Some orders happen at
 * once: leaving a society, founding a society, a company or a party. The
 * person still eats, tires, ages and can die; the rest of the world carries on.
 * Everything uses the world's own rules, so a directed life is still a life in it.
 */
import { availableWork, performWork, communicate } from './civilization.js';
import { acquaint, appraise, appreciate } from './psyche.js';
import { foundCompany, SECTORS, ownsCompany } from './enterprise.js';
import { foundParty } from './polity.js';

export const ORDERS = Object.freeze(['move', 'work', 'forage', 'rest', 'explore', 'talk', 'court', 'give', 'join']);
const IMMEDIATE = Object.freeze(['leave', 'found-society', 'found-company', 'found-party']);
const clamp = (value, low = 0, high = 100) => Math.min(high, Math.max(low, value));
const near = (a, b, range) => Math.hypot(a.x - b.x, a.y - b.y) <= range;

export function initializePlayer(sim) { sim.player = { id: null, order: null }; return sim.player; }

/** The person being directed, if they are alive. */
export function playerAgent(sim) { return sim.player?.id ? sim._agentMap.get(sim.player.id) || null : null; }

/**
 * Applies a command from the observer: { type: 'possess', id } | { type: 'release' } |
 * { type: 'order', kind, x?, y?, target?, action?, sector? }. Returns a short description.
 */
export function command(sim, payload) {
  if (!sim.player) initializePlayer(sim);
  if (!payload || typeof payload !== 'object') throw new Error('A command must be an object.');
  if (payload.type === 'possess') {
    const agent = sim._agentMap.get(payload.id);
    if (!agent) throw new Error('That person is no longer alive.');
    if (agent.age < 12) throw new Error('Children cannot be directed.');
    sim.player = { id: agent.id, order: null };
    agent._courtship = null;
    return `You take charge of ${agent.name}.`;
  }
  if (payload.type === 'release') { const agent = playerAgent(sim); sim.player = { id: null, order: null }; return agent ? `${agent.name} lives on by their own choices.` : 'Released.'; }
  if (payload.type !== 'order') throw new Error('Unknown command.');
  const agent = playerAgent(sim);
  if (!agent) throw new Error('No one is in your charge.');
  const group = sim._groupMap.get(agent.groupId);
  const kind = payload.kind;
  if (IMMEDIATE.includes(kind)) return immediate(sim, agent, group, kind, payload);
  if (!ORDERS.includes(kind)) throw new Error('Unknown order.');
  const order = { kind, since: sim.day };
  if (kind === 'move') {
    if (!Number.isFinite(payload.x) || !Number.isFinite(payload.y)) throw new Error('Choose a place to go.');
    order.x = clamp(payload.x, .5, sim.width - .5); order.y = clamp(payload.y, .5, sim.height - .5);
  }
  if (kind === 'work') {
    const job = availableWork(sim, agent, group).find(entry => entry.action === payload.action);
    if (!job) throw new Error('That work is not available here.');
    order.action = job.action;
  }
  if (['talk', 'court', 'give'].includes(kind)) {
    const other = sim._agentMap.get(payload.target);
    if (!other || other === agent) throw new Error('Choose someone else.');
    if (kind === 'court' && !sim._eligibleMate(agent, other)) throw new Error(`${other.name} is not someone ${agent.name} could marry.`);
    order.target = other.id;
  }
  if (kind === 'join') {
    const society = sim._groupMap.get(payload.target);
    if (!society || society === group) throw new Error('Choose another society.');
    order.target = society.id;
  }
  sim.player.order = order;
  return describe(sim, order);
}

function describe(sim, order) {
  const name = id => sim._agentMap.get(id)?.name || sim._groupMap.get(id)?.name || 'them';
  return { move: 'Setting out.', work: `Working: ${order.action}.`, forage: 'Foraging.', rest: 'Resting.', explore: 'Exploring.', talk: `Going to talk with ${name(order.target)}.`,
    court: `Courting ${name(order.target)}.`, give: `Taking food to ${name(order.target)}.`, join: `Heading to join ${name(order.target)}.` }[order.kind];
}

function immediate(sim, agent, group, kind, payload) {
  if (kind === 'leave') {
    if (!group) throw new Error(`${agent.name} belongs to no society.`);
    group.members = group.members.filter(id => id !== agent.id); agent.groupId = null;
    appraise(sim, agent, 'departure', { text: `Left ${group.name} to go my own way.` });
    sim._event('migration', `${agent.name} leaves ${group.name}.`, { agentId: agent.id, groupId: group.id });
    return `${agent.name} leaves ${group.name}.`;
  }
  if (kind === 'found-society') {
    const friends = sim._neighbors(agent, 8).filter(other => other.age >= 16 && (agent._relations.find(r => r.id === other.id)?.strength || 0) > .15 && sim._groupMap.get(other.groupId)?.civilization?.culture?.leaderId !== other.id).slice(0, 6);
    if (group) { group.members = group.members.filter(id => id !== agent.id); agent.groupId = null; }
    const created = sim._formGroup([agent, ...friends]);
    return `${created.name} is founded by ${agent.name}${friends.length ? ` with ${friends.length} ${friends.length === 1 ? 'friend' : 'friends'}` : ''}.`;
  }
  if (kind === 'found-company') {
    if (!group?.civilization?.technologies.includes('commerce')) throw new Error(`${agent.name}'s society does not know commerce yet.`);
    if (ownsCompany(sim, agent)) throw new Error(`${agent.name} already owns a company.`);
    if ((agent.wealth || 0) < 3) throw new Error(`${agent.name} has too little wealth to found a company.`);
    const civ = group.civilization;
    const options = Object.entries(SECTORS).filter(([, sector]) => civ.technologies.includes(sector.technology) && (!sector.building || civ.buildings[sector.building] > 0)).map(([key]) => key);
    const sector = options.includes(payload.sector) ? payload.sector : options[0];
    if (!sector) throw new Error(`${group.name} runs no works a company could be built around.`);
    const capital = agent.wealth * .6; agent.wealth = Math.round((agent.wealth - capital) * 1e4) / 1e4;
    const company = foundCompany(sim, agent, group, sector, capital);
    return `${agent.name} founds ${company.name}.`;
  }
  if (kind === 'found-party') {
    if (!group) throw new Error(`${agent.name} belongs to no society.`);
    const party = foundParty(sim, group, agent);
    if (!party) throw new Error(`${group.name} is not yet organised for party politics (it needs governance or a hall and a dozen people).`);
    return `${agent.name} founds the ${party.name}.`;
  }
  return '';
}

/** One day of a directed life. */
export function playerTurn(sim, agent, group) {
  const order = sim.player.order;
  // Exhaustion forces rest whatever the order.
  if (agent.energy < 12) { rest(sim, agent, group); return; }
  if (!order) { agent.action = 'awaiting your direction'; agent.energy = clamp(agent.energy + 4); return; }
  const done = () => { sim.player.order = null; };
  switch (order.kind) {
    case 'move':
      sim._move(agent, order, 1.2);
      agent.action = agent._afloat ? 'sailing where you direct' : 'travelling where you direct';
      if (near(agent, order, .6)) done();
      break;
    case 'work':
      if (!group || !performWork(sim, agent, group, order.action)) { agent.action = 'unable to do that work here'; done(); }
      break;
    case 'forage': sim._forage(agent); break;
    case 'rest': rest(sim, agent, group); break;
    case 'explore': {
      if (!order.x || near(agent, order, 1.5)) { const next = sim._landNear(agent.x + (sim._random() - .5) * 40, agent.y + (sim._random() - .5) * 40); order.x = next.x; order.y = next.y; }
      sim._move(agent, order, 1.1); agent.action = 'exploring where you lead';
      break;
    }
    case 'talk': case 'court': case 'give': {
      const other = sim._agentMap.get(order.target);
      if (!other) { done(); break; }
      if (!near(agent, other, 2.5)) { sim._move(agent, other, 1.2); agent.action = `going to ${other.name}`; break; }
      const bond = sim._remember(agent, other), returned = sim._remember(other, agent);
      acquaint(agent, other, bond); acquaint(other, agent, returned);
      if (order.kind === 'talk') { communicate(sim, agent, other, true); agent.social = clamp(agent.social + 8); other.social = clamp(other.social + 6); agent.action = `talking with ${other.name}`; done(); }
      if (order.kind === 'give') {
        const gift = Math.min(2, agent.inventory.food);
        agent.inventory.food -= gift; other.inventory.food = Math.min(5, other.inventory.food + gift);
        appreciate(other, agent); agent.action = `giving food to ${other.name}`; done();
      }
      if (order.kind === 'court') {
        agent.action = `courting ${other.name}`; agent.social = clamp(agent.social + 5); other.social = clamp(other.social + 5);
        if (!sim._eligibleMate(agent, other)) { done(); break; }
        if (bond.strength > .25 && returned.strength > .25) {
          sim._pair(agent, other);
          const society = sim._groupMap.get(agent.groupId);
          if (society && !other.groupId) sim._joinGroup(other, society);
          else if (!society && other.groupId) sim._joinGroup(agent, sim._groupMap.get(other.groupId));
          sim._event('group', `${agent.name} and ${other.name} begin a life together.`, { agentId: agent.id });
          done();
        } else if (sim.day - order.since > 40) done();
      }
      break;
    }
    case 'join': {
      const society = sim._groupMap.get(order.target);
      if (!society) { done(); break; }
      if (!near(agent, society, 6)) { sim._move(agent, society, 1.2); agent.action = `travelling to ${society.name}`; break; }
      sim._joinGroup(agent, society);
      sim._event('migration', `${agent.name} joins ${society.name}.`, { agentId: agent.id, groupId: society.id });
      done();
      break;
    }
  }
}

function rest(sim, agent, group) {
  const home = group && Math.hypot(agent.x - group.x, agent.y - group.y) < 8;
  agent.energy = clamp(agent.energy + (home ? 20 : 14));
  agent.action = home ? 'resting at home' : 'resting';
}

/** What the observer needs to direct the person: their order, the work open to them, who is near, and what they could join or found. */
export function playerView(sim) {
  const agent = playerAgent(sim);
  if (!agent) return { id: null, order: null };
  const group = sim._groupMap.get(agent.groupId);
  const nearby = sim._neighbors(agent, 12).slice(0, 14).map(other => ({ id: other.id, name: other.name, age: Math.floor(other.age), groupId: other.groupId,
    bond: Math.round((agent._relations.find(r => r.id === other.id)?.strength || 0) * 100) / 100, eligible: sim._eligibleMate(agent, other) }));
  const societies = sim.groups.filter(other => other !== group && Math.hypot(other.x - agent.x, other.y - agent.y) < 40).slice(0, 8).map(other => ({ id: other.id, name: other.name, members: other.members.length }));
  const civ = group?.civilization;
  return { id: agent.id, order: sim.player.order ? { ...sim.player.order } : null, work: group ? availableWork(sim, agent, group) : [], nearby, societies,
    canFoundCompany: !!civ?.technologies.includes('commerce') && !ownsCompany(sim, agent) && (agent.wealth || 0) >= 3,
    canFoundParty: !!civ && (civ.technologies.includes('governance') || civ.buildings.hall > 0) && group.members.length >= 12 };
}

export function restorePlayer(raw, sim) {
  if (raw === undefined || raw === null) return initializePlayer(sim);
  const bad = field => { throw new Error(`Invalid player save: ${field}.`); };
  if (typeof raw !== 'object') bad('state');
  const id = raw.id === null ? null : Number.isSafeInteger(raw.id) && raw.id > 0 && raw.id < sim.nextAgentId ? raw.id : bad('person');
  let order = null;
  if (raw.order) {
    const o = raw.order;
    if (!ORDERS.includes(o.kind) || !Number.isSafeInteger(o.since) || o.since < 0 || o.since > sim.day) bad('order');
    order = { kind: o.kind, since: o.since };
    for (const key of ['x', 'y']) if (o[key] !== undefined) { if (!Number.isFinite(o[key]) || o[key] < 0 || o[key] > Math.max(sim.width, sim.height)) bad('order place'); order[key] = o[key]; }
    if (o.target !== undefined) { if (!Number.isSafeInteger(o.target) || o.target < 1) bad('order target'); order.target = o.target; }
    if (o.action !== undefined) { if (typeof o.action !== 'string' || o.action.length > 40) bad('order work'); order.action = o.action; }
  }
  return { id, order };
}
