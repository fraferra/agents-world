/** The desire for expansion, individually and collectively. People carry a
 * pioneering drive shaped by temperament, crowding and culture. Societies feel
 * land pressure, weigh expansion through their norms and leader, and send
 * pioneers to found colonies that stay bound to them by kinship. Territorial
 * claims grow with size and standing; overlapping claims breed rivalry.
 */
import { initializeCulture } from './culture.js';
import { feel, recordEpisode } from './psyche.js';
import { seafaring } from './infrastructure.js';

const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));

/**
 * The households that go: each chosen adult with their partner and young children,
 * whole families only, added in order until `limit` people would be exceeded.
 */
function households(sim, group, adults, limit, exclude = null) {
  const going = new Set();
  for (const agent of adults) {
    const family = [agent];
    const partner = sim._agentMap.get(agent.partnerId);
    if (partner?.groupId === group.id && partner.id !== exclude && !going.has(partner)) family.push(partner);
    for (const id of agent.children) { const child = sim._agentMap.get(id); if (child?.groupId === group.id && child.age < 14 && !going.has(child)) family.push(child); }
    if (going.size + family.length > limit) continue;
    for (const member of family) going.add(member);
  }
  return going;
}
const round = value => Math.round(value * 1e4) / 1e4 || 0;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Claimed land around a settlement: grows with people and standing. */
export function claimRadius(group) {
  // Territory grows with people, standing and development: works, roads and industry reach farther.
  const built = Object.values(group.civilization?.buildings || {}).reduce((a, b) => a + b, 0);
  return 5 + Math.sqrt(group.members.length) * 1.2 + (group.civilization?.culture?.tier || 0) * 2 + Math.min(8, Math.sqrt(built) * 1.2);
}

/** How far a society's development pushes it outward: tier, statehood and the means to reach new land. */
export function development(sim, group) {
  const civ = group.civilization, known = civ.technologies;
  return Math.min(.45, (civ.culture?.tier || 0) * .06 + (sim.polity?.countries.some(country => country.members.includes(group.id)) ? .1 : 0)
    + (known.includes('governance') ? .05 : 0) + (civ.buildings.railway ? .05 : 0) + (civ.buildings.dock ? .05 : 0) + (civ.buildings.airport ? .05 : 0) + Math.min(.1, (civ.breakthroughs?.length || 0) * .01));
}

/** How hard a society presses on the land it can reach (0 comfortable – 1 overcrowded). */
export function landPressure(group, near) {
  const civ = group.civilization, n = group.members.length;
  const capacity = 8 + near.food * 30 + near.game * 8 + near.fish * 20 + Math.min(civ.buildings.farm * 6 + (civ.buildings.pasture || 0) * 4, near.fertility * 45);
  const hunger = clamp(1 - group.food / Math.max(1, n * 1.2));
  return clamp(n / capacity - .45 + hunger * .25);
}

/** Where pioneers would go: good land, resources the mother lacks, room to grow. */
function chooseSite(sim, group, near) {
  let best = null, bestScore = -Infinity;
  const reach = 16 + (group.civilization.culture?.tier || 0) * 5;
  // Sites remembered by the society's scouts and travellers are considered first.
  const remembered = [];
  for (const id of group.members) for (const place of sim._agentMap.get(id)?.psyche?.places || []) {
    const range = distance(place, group);
    if (range >= 14 && range <= 60 && (place.kind === 'food' || place.kind === 'fish' || place.kind === 'game')) remembered.push({ x: place.x, y: place.y, range });
  }
  // Seafaring peoples also look across the water, to islands their ships can reach.
  const voyage = seafaring(group), lands = sim._landmasses(), home = lands.label[Math.floor(group.y) * sim.width + Math.floor(group.x)];
  const overseas = voyage.reach >= 60 ? 16 : voyage.reach >= 10 ? 8 : 0;
  for (let attempt = 0; attempt < 36 + Math.min(12, remembered.length) + overseas; attempt++) {
    const scouted = attempt < remembered.length && attempt < 12 ? remembered[attempt] : null;
    const abroad = attempt >= 36 + Math.min(12, remembered.length);
    const angle = sim._random() * Math.PI * 2, range = scouted ? scouted.range : abroad ? 20 + sim._random() * Math.min(voyage.reach, 160) : reach + sim._random() * 22;
    const across = abroad ? sim._voyageTarget(group, Math.min(voyage.reach, 160)) : null;
    const point = scouted ? sim._landNear(scouted.x, scouted.y) : across || sim._landNear(group.x + Math.cos(angle) * range, group.y + Math.sin(angle) * range);
    if (distance(point, group) < 12) continue;
    // Across the water only with boats that can make the crossing.
    const there = lands.label[Math.floor(point.y) * sim.width + Math.floor(point.x)];
    if (there !== home && distance(point, group) > voyage.reach) continue;
    if (sim.groups.some(other => distance(other, point) < claimRadius(other) + 4)) continue;
    const site = { food: 0, fertility: 0, wood: 0, stone: 0, ore: 0, clay: 0, fish: 0, game: 0 };
    let land = 0;
    for (let dy = -5; dy <= 5; dy += 2) for (let dx = -5; dx <= 5; dx += 2) {
      const tile = sim._tile(point.x + dx, point.y + dy);
      if (tile.terrain === 'water') continue;
      land++;
      for (const key of Object.keys(site)) site[key] += tile[key] || 0;
    }
    if (land < 12) continue;
    for (const key of Object.keys(site)) site[key] /= land;
    // Pioneers seek good land, plus whatever their home lacks.
    const lacking = Object.keys(site).reduce((sum, key) => sum + Math.max(0, site[key] - (near[key] || 0)), 0);
    // Unclaimed land across the sea is a prize in itself.
    const score = site.food * 2 + site.fertility * 1.5 + site.wood + site.fish + site.game * .5 + lacking * 1.5 - range * .01 + (there !== home ? 1 : 0);
    if (score > bestScore) { bestScore = score; best = point; }
  }
  return best;
}

/**
 * Considered monthly per society. Returns the new colony or null.
 * `found` creates and registers a group, supplied by the engine.
 */
export function considerExpansion(sim, group, near, found) {
  const civ = group.civilization, culture = civ.culture;
  if (!culture) return null;
  culture.pressure = round(landPressure(group, near));
  const people = group.members.map(id => sim._agentMap.get(id)).filter(Boolean);
  const adults = people.filter(agent => agent.age >= 18 && agent.age < 55 && agent.health > 50);
  // Developed societies are ready to found the next settlement sooner.
  const grown = development(sim, group);
  if (people.length < 16 || adults.length < 8 || sim.day - culture.lastColony < Math.max(300, 720 - grown * 900) || sim.day - culture.founded < 720) return null;
  const leader = sim._agentMap.get(culture.leaderId);
  const drives = adults.map(agent => agent.psyche?.expansion ?? .4);
  const eager = drives.filter(drive => drive > .55).length / adults.length;
  // A society expands when its people, its culture and its leader want to, or the land forces it.
  // Fields, workshops and halls root people: a settled town sends colonists mainly under real land pressure.
  // ...until a society develops the institutions and means to settle new land: then it expands more and more.
  const rooted = Math.min(.25, Object.values(civ.buildings).reduce((a, b) => a + b, 0) * .015) * (1 - grown * 2);
  // Ships open the islands: a seafaring people sees empty land across the water as opportunity.
  const reachAcross = seafaring(group).reach;
  const venture = reachAcross >= 60 ? .14 + culture.norms.expansion * .1 + culture.norms.mercantile * .06 : reachAcross >= 10 ? .05 + culture.norms.expansion * .05 : 0;
  const desire = culture.norms.expansion * .3 + culture.pressure * .35 + eager * .2 + (leader?.psyche?.expansion ?? .4) * .15 * (.5 + culture.norms.hierarchy) + (civ.buildings.hall ? .08 : 0) - rooted + venture + grown;
  if (desire < .36 || sim._random() >= (desire - .32) * .5) return null;
  const site = chooseSite(sim, group, near);
  if (!site) return null;
  // The most eager go; nobody is sent against their will.
  const pioneers = adults.filter(agent => agent.id !== culture.leaderId && (agent.psyche?.expansion ?? .4) > .45).sort((a, b) => (b.psyche?.expansion ?? 0) - (a.psyche?.expansion ?? 0));
  const overseas = sim._landmasses().label[Math.floor(site.y) * sim.width + Math.floor(site.x)] !== sim._landmasses().label[Math.floor(group.y) * sim.width + Math.floor(group.x)];
  const crew = overseas ? 4 : 6;
  const count = Math.min(pioneers.length, Math.max(crew, Math.round(people.length * (.18 + desire * .15))));
  // A colony needs enough pioneers to survive (a ship's crew may be fewer), and the mother community enough people to carry on.
  if (count < crew || people.length - count < 12) return null;
  // Families go together, but a colony never takes more than a third of the town, and at least
  // twelve people (and three fifths of the town) stay home.
  const limit = Math.min(Math.floor(people.length / 3), people.length - Math.max(12, Math.ceil(people.length * .6)));
  const chosen = households(sim, group, pioneers.slice(0, Math.max(count, crew)), limit, culture.leaderId);
  if ([...chosen].filter(agent => agent.age >= 16).length < Math.min(crew, 4)) return null;
  const settlers = [...chosen];
  const share = settlers.length / people.length;
  const colony = found(site, settlers, group);
  const colonyCiv = colony.civilization;
  // Pioneers carry a fair share of stores and everything the society knows how to do.
  colonyCiv.technologies = [...civ.technologies];
  colonyCiv.breakthroughs = [...(civ.breakthroughs || [])];
  if (civ.advances) colonyCiv.advances = { ...civ.advances };
  for (const id of colonyCiv.technologies) colonyCiv.research[id] = civ.research[id];
  colonyCiv.ideas = [...civ.ideas]; colonyCiv.doctrine = civ.doctrine;
  for (const key of Object.keys(civ.stock)) { const moved = civ.stock[key] * share; civ.stock[key] -= moved; colonyCiv.stock[key] += moved; }
  const food = group.food * share, wood = group.wood * share;
  group.food -= food; colony.food += food; group.wood -= wood; colony.wood += wood;
  initializeCulture(sim, colony, group);
  const leaderOfExpedition = settlers.find(agent => agent.age >= 18) || settlers[0];
  colonyCiv.culture.leaderId = leaderOfExpedition.id;
  culture.lastColony = sim.day;
  culture.pressure = round(landPressure(group, near));
  sim.culture.coloniesFounded++;
  for (const agent of settlers) {
    agent._wanderX = site.x; agent._wanderY = site.y;
    if (agent.age < 14 || !agent.psyche) continue;
    agent.psyche.record.founded = (agent.psyche.record.founded || 0) + 1;
    feel(agent, 'joy', .25); feel(agent, 'pride', .3); feel(agent, 'fear', .1);
    recordEpisode(sim, agent, { type: 'journey', text: `Left ${group.name} to found ${colony.name}.`, valence: .75, salience: .95, activity: 'pioneer' });
  }
  for (const agent of people) {
    if (chosen.has(agent) || agent.age < 14 || !agent._relations.some(relation => relation.strength > .5 && chosen.has(sim._agentMap.get(relation.id)))) continue;
    feel(agent, 'grief', .1);
    recordEpisode(sim, agent, { type: 'community', text: `Friends left to found ${colony.name}.`, valence: -.3, salience: .5 });
  }
  return { colony, leader: leaderOfExpedition, settlers };
}

/** Rivalry from overlapping claims, arising only where expansionist peoples press
 * beyond the ordinary: neighbours with settled outlooks share land peacefully. */
export function claimFriction(a, b) {
  const ra = claimRadius(a), rb = claimRadius(b);
  const overlap = clamp((ra + rb - distance(a, b)) / (ra + rb));
  const drive = ((a.civilization.culture?.norms.expansion ?? .45) + (b.civilization.culture?.norms.expansion ?? .45)) / 2;
  return overlap * Math.max(0, drive - .5) * 4;
}

/**
 * Scalar stress (Johnson 1982): consensus becomes harder as a group grows, until
 * hierarchy and institutions carry the load. Beyond its organisational capacity
 * a society may split: a disaffected member leaves with close friends and their
 * families to start a new community nearby. Unlike a colony, it leaves on cool terms.
 */
export function organisationalCapacity(group) {
  const civ = group.civilization, culture = civ.culture;
  return 22 + (culture?.norms.hierarchy ?? .3) * 30 + (culture?.leaderId ? 6 : 0) + Math.min(2, civ.buildings.hall || 0) * 15
    + (civ.technologies.includes('governance') ? 15 : 0) + (culture?.tier || 0) * 4;
}

export function considerFission(sim, group, found) {
  const capacity = organisationalCapacity(group), n = group.members.length;
  if (n <= capacity || sim.day - (group.civilization.culture?.founded ?? 0) < 360) return null;
  if (sim._random() >= Math.min(.5, (n - capacity) / capacity)) return null;
  const people = group.members.map(id => sim._agentMap.get(id)).filter(agent => agent && agent.age >= 18);
  const leaderId = group.civilization.culture?.leaderId;
  // The most discontented adult (stress, anger, distrust of the leader) leads the split.
  const discontent = agent => agent._stress / 100 + (agent.psyche?.mood.anger || 0) - (agent._relations.find(relation => relation.id === leaderId)?.trust ?? .45);
  const instigator = people.filter(agent => agent.id !== leaderId).sort((a, b) => discontent(b) - discontent(a))[0];
  if (!instigator) return null;
  const faction = new Set([instigator]);
  for (const relation of instigator._relations) {
    const friend = sim._agentMap.get(relation.id);
    if (friend?.groupId === group.id && friend.id !== leaderId && relation.strength > .5 && faction.size < n * .45) faction.add(friend);
  }
  // With their families, the breakaway takes at most 45% of the society.
  const leaving = households(sim, group, [...faction], Math.floor(n * .45), leaderId);
  faction.clear(); for (const agent of leaving) faction.add(agent);
  if (faction.size < 4 || n - faction.size < 6) return null;
  const angle = sim._random() * Math.PI * 2, range = 9 + sim._random() * 8;
  const site = sim._landNear(group.x + Math.cos(angle) * range, group.y + Math.sin(angle) * range);
  const settlers = [...faction], share = settlers.length / n;
  const offshoot = found(site, settlers, group);
  offshoot.civilization.breakthroughs = [...(group.civilization.breakthroughs || [])];
  if (group.civilization.advances) offshoot.civilization.advances = { ...group.civilization.advances };
  offshoot.civilization.technologies = group.civilization.technologies.filter(id => settlers.some(agent => agent.knowledge.includes(id)) || group.civilization.technologies.length < 3);
  for (const id of offshoot.civilization.technologies) offshoot.civilization.research[id] = group.civilization.research[id];
  const food = group.food * share * .8, wood = group.wood * share * .8;
  group.food -= food; offshoot.food += food; group.wood -= wood; offshoot.wood += wood;
  initializeCulture(sim, offshoot, group);
  offshoot.civilization.culture.parentId = null;
  offshoot.civilization.culture.leaderId = instigator.id;
  for (const agent of settlers) {
    agent._wanderX = site.x; agent._wanderY = site.y; agent._stress = 0;
    if (agent.age >= 14 && agent.psyche) recordEpisode(sim, agent, { type: 'community', text: `Left ${group.name} with ${instigator.name} when it grew too large to agree.`, valence: -.2, salience: .7 });
  }
  return { offshoot, instigator, settlers };
}
