/** Roads and railways between societies, and what development does to the land.
 *
 * Societies that know masonry pave roads to the communities they deal with
 * (trade partners, allies, kin, tributaries); with a railway station they lay
 * track, upgrading roads to rail. Construction draws on real stocks, clears
 * the woodland along the route, and is recorded in the chronicle. Links carry
 * trade and contact farther and more often. Industry marks the land around it:
 * coal smoke tires the soil and drives away game and fish.
 */
import { industry } from './civilization.js';
import { atWar, relationBetween } from './diplomacy.js';

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
// Materials per tile of route length. Sea and air routes are cheap per tile but need ports and airports.
export const ROUTES = Object.freeze({
  road: { name: 'road', range: 45, cost: { stone: .12, wood: .05 } },
  rail: { name: 'railway', range: 90, cost: { metal: .12, wood: .08, coal: .03 } },
  sea: { name: 'sea route', range: 320, cost: { wood: .03, cloth: .01 } },
  air: { name: 'air route', range: Infinity, cost: { metal: .01, electronics: .002 } },
});

const NONE = Object.freeze({ kind: null, reach: 0, speed: 0, coastal: 0 });
/**
 * How a society's people cross water: canoes hug the coast and hop narrow straits;
 * a port with navigation launches sailing ships across open sea, faster and
 * farther with steam; an airport lets them fly anywhere.
 */
export function seafaring(group) {
  const civ = group?.civilization;
  if (!civ) return NONE;
  const known = civ.technologies, b = civ.buildings;
  if (b.airport > 0 && known.includes('aviation')) return { kind: 'aircraft', reach: Infinity, speed: 5, coastal: Infinity };
  if (b.dock > 0 && known.includes('navigation')) return known.includes('steam') ? { kind: 'steamship', reach: 320, speed: 2.8, coastal: Infinity } : { kind: 'ship', reach: 140, speed: 1.8, coastal: Infinity };
  if (known.includes('fishing')) return { kind: 'canoe', reach: 10, speed: 1.2, coastal: 3 };
  return NONE;
}

const landOf = (sim, point) => sim._landmasses().label[Math.floor(point.y) * sim.width + Math.floor(point.x)];
/** Whether two places share a landmass. */
export function sameLand(sim, a, b) { return landOf(sim, a) === landOf(sim, b); }
/**
 * Whether two societies can reach each other: over land, along a route, or across
 * water that one of them has the boats (or aircraft) to cross.
 */
export function reachable(sim, a, b) {
  if (!a || !b) return false;
  if (sameLand(sim, a, b) || linkBetween(sim, a, b)) return true;
  return distance(a, b) <= Math.max(seafaring(a).reach, seafaring(b).reach);
}

export function initializeInfrastructure(sim) {
  sim.infrastructure = { links: [], roadsBuilt: 0, railsBuilt: 0, seaRoutes: 0, airRoutes: 0 };
  return sim.infrastructure;
}

/** The route between two societies, if any. */
export function linkBetween(sim, a, b) {
  if (!a || !b || a.id === b.id) return null;
  const lo = Math.min(a.id, b.id), hi = Math.max(a.id, b.id);
  return sim.infrastructure?.links.find(link => link.a === lo && link.b === hi) || null;
}

/** Trade logistics along a route: a road doubles how often goods move; railways, ships and aircraft more. */
export function routeFactor(sim, a, b) {
  const link = linkBetween(sim, a, b);
  return !link ? 1 : { road: 1.8, rail: 3, sea: 2.2, air: 4 }[link.kind];
}

function stock(group, key) { return key === 'wood' ? group.wood : key === 'food' ? group.food : group.civilization.stock[key] || 0; }
function spend(group, key, amount) {
  if (key === 'wood') group.wood -= amount; else if (key === 'food') group.food -= amount; else group.civilization.stock[key] -= amount;
}

/** Walk the straight route between two places, calling back for each land tile crossed. */
export function alongRoute(sim, from, to, visit) {
  const steps = Math.ceil(distance(from, to));
  for (let step = 0; step <= steps; step++) {
    const x = from.x + (to.x - from.x) * step / Math.max(1, steps), y = from.y + (to.y - from.y) * step / Math.max(1, steps);
    const tile = sim._tile(x, y);
    if (tile.terrain !== 'water') visit(tile);
  }
}

/** Partners worth connecting, most important first. */
function partners(sim, group) {
  const civ = group.civilization, list = [];
  for (const other of sim.groups) {
    if (other === group || atWar(sim, group, other) || !reachable(sim, group, other)) continue;
    const r = relationBetween(sim, group, other);
    const kin = civ.culture?.parentId === other.id || other.civilization.culture?.parentId === group.id;
    const ruled = r?.status === 'tributary';
    const weight = (ruled ? 3 : 0) + (r?.status === 'alliance' ? 2 : 0) + (civ.tradePartners.includes(other.id) ? 2 : 0) + (kin ? 1.5 : 0) + (r ? Math.max(0, r.trust) : 0);
    if (weight > 0) list.push({ other, weight, range: distance(group, other) });
  }
  return list.sort((x, y) => y.weight - x.weight || x.range - y.range);
}

/** The next route a society means to build: to its most important partner still unconnected. */
export function plannedRoute(sim, group) {
  const civ = group.civilization, known = civ.technologies, voyage = seafaring(group);
  const canRail = known.includes('railways') && civ.buildings.railway > 0, canRoad = known.includes('masonry');
  const canSail = voyage.kind === 'ship' || voyage.kind === 'steamship' || voyage.kind === 'aircraft', canFly = voyage.kind === 'aircraft';
  if (!canRail && !canRoad && !canSail) return null;
  for (const { other, range } of partners(sim, group)) {
    const existing = linkBetween(sim, group, other), overland = sameLand(sim, group, other);
    const kind = canFly && other.civilization.buildings.airport > 0 && existing?.kind !== 'air' ? 'air'
      : !overland ? (canSail && !existing && range <= Math.min(ROUTES.sea.range, voyage.reach) ? 'sea' : null)
        : canRail && range <= ROUTES.rail.range && existing?.kind !== 'rail' && existing?.kind !== 'air' ? 'rail'
          : canRoad && !existing && range <= ROUTES.road.range ? 'road' : null;
    if (!kind) continue;
    const length = Math.max(1, range);
    return { other, kind, existing, length, cost: Object.fromEntries(Object.entries(ROUTES[kind].cost).map(([key, perTile]) => [key, perTile * length])) };
  }
  return null;
}

/** Monthly, staggered: each society builds its planned route once it has gathered the materials. */
function build(sim, group) {
  const plan = plannedRoute(sim, group);
  if (!plan) return;
  const { other, kind, existing, length, cost } = plan;
  {
    if (!Object.entries(cost).every(([key, amount]) => stock(group, key) >= amount)) return;
    for (const [key, amount] of Object.entries(cost)) spend(group, key, amount);
    // Clearing the way: woodland along an overland route is cut back.
    if (kind === 'road' || kind === 'rail') alongRoute(sim, group, other, tile => { tile.wood *= kind === 'rail' ? .3 : .5; });
    const lo = Math.min(group.id, other.id), hi = Math.max(group.id, other.id);
    if (existing) { existing.kind = kind; existing.day = sim.day; existing.builder = group.id; }
    else sim.infrastructure.links.push({ a: lo, b: hi, kind, day: sim.day, builder: group.id });
    if (kind === 'rail') sim.infrastructure.railsBuilt++; else if (kind === 'road') sim.infrastructure.roadsBuilt++; else sim.infrastructure[kind === 'sea' ? 'seaRoutes' : 'airRoutes'] = (sim.infrastructure[kind === 'sea' ? 'seaRoutes' : 'airRoutes'] || 0) + 1;
    const verb = kind === 'sea' ? `opens a sea route to ${other.name}` : kind === 'air' ? `opens an air route to ${other.name}` : existing ? `lays a railway along its road to ${other.name}` : `builds a ${ROUTES[kind].name} to ${other.name} (${Math.round(length)} leagues)`;
    sim._event('industry', `${group.name} ${verb}.`, { groupId: group.id });
  }
}

/** Coal smoke tires the soil and drives off game and fish around an industrial town. */
function pollute(sim, group) {
  const smog = industry(group).smog;
  if (smog <= 0) return;
  const radius = 5 + Math.round(smog * 4);
  for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
    if (dx * dx + dy * dy > radius * radius) continue;
    const x = Math.floor(group.x) + dx, y = Math.floor(group.y) + dy;
    if (x < 0 || y < 0 || x >= sim.width || y >= sim.height) continue;
    const tile = sim.tiles[y * sim.width + x];
    if (tile.terrain === 'water') continue;
    const harm = smog * .02 * (1 - Math.hypot(dx, dy) / (radius + 1));
    tile.soil = Math.max(0, (tile.soil ?? tile.fertility) * (1 - harm));
    tile.game = (tile.game || 0) * (1 - harm * 2); tile.fish = (tile.fish || 0) * (1 - harm * 2);
  }
}

export function advanceInfrastructure(sim) {
  if (!sim.infrastructure) initializeInfrastructure(sim);
  const live = sim._groupMap;
  // Routes end with the communities they joined, or when a move takes one far away.
  sim.infrastructure.links = sim.infrastructure.links.filter(link => {
    const a = live.get(link.a), b = live.get(link.b);
    return a && b && (link.kind === 'air' || distance(a, b) <= ROUTES[link.kind].range * 1.3);
  });
  for (const group of sim.groups) {
    if (sim.day % 30 !== (group.id + 25) % 30 || !group.civilization) continue;
    build(sim, group);
    pollute(sim, group);
  }
}

export function infrastructureStats(sim) {
  const links = sim.infrastructure?.links || [];
  return { roads: links.filter(link => link.kind === 'road').length, railways: links.filter(link => link.kind === 'rail').length, seaRoutes: links.filter(link => link.kind === 'sea').length, airRoutes: links.filter(link => link.kind === 'air').length };
}

export function restoreInfrastructure(raw, sim) {
  if (raw === undefined) return initializeInfrastructure(sim);
  const bad = field => { throw new Error(`Invalid infrastructure save: ${field}.`); };
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.links)) bad('state');
  const count = (value, field) => (Number.isSafeInteger(value) && value >= 0 ? value : bad(field));
  const seen = new Set();
  const links = raw.links.map(link => {
    if (!link || typeof link !== 'object' || !['road', 'rail', 'sea', 'air'].includes(link.kind)) bad('route');
    const a = count(link.a, 'route end'), b = count(link.b, 'route end'), builder = count(link.builder, 'route builder');
    if (a < 1 || a >= b || b >= sim.nextGroupId || (builder !== a && builder !== b) || seen.has(`${a}:${b}`)) bad('route ends');
    seen.add(`${a}:${b}`);
    const day = count(link.day, 'route day');
    if (day > sim.day) bad('route day');
    return { a, b, kind: link.kind, day, builder };
  });
  return { links, roadsBuilt: count(raw.roadsBuilt, 'roads built'), railsBuilt: count(raw.railsBuilt, 'railways built'),
    seaRoutes: raw.seaRoutes === undefined ? 0 : count(raw.seaRoutes, 'sea routes'), airRoutes: raw.airRoutes === undefined ? 0 : count(raw.airRoutes, 'air routes') };
}
