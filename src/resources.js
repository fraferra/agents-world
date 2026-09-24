/** Natural resources beyond food and timber. Placement comes from seeded noise
 * (never the random generator), so older saves gain identical deposits when
 * migrated. Renewable resources regrow toward a terrain-dependent capacity;
 * clay and gems are effectively finite.
 */
export const TILE_RESOURCES = Object.freeze(['clay', 'fiber', 'herbs', 'game', 'fish', 'gems']);
export const RESOURCE_INFO = Object.freeze({
  food: { name: 'Wild food', renews: true, uses: 'Eaten; stored by societies; funds experiments.' },
  wood: { name: 'Timber', renews: true, uses: 'Shelters, buildings, fuel for kilns and forges, tool handles.' },
  stone: { name: 'Stone', renews: false, uses: 'Tools, buildings, walls and temples.' },
  ore: { name: 'Ore', renews: false, uses: 'Smelted into metal for tools, forges and engineering.' },
  clay: { name: 'Clay', renews: false, uses: 'Pottery, fired bricks, granaries and apothecaries. Found along rivers and shores.' },
  fiber: { name: 'Fiber', renews: true, uses: 'Woven into cloth; nets, sails and pasture fences. Grows on grassland and shores.' },
  herbs: { name: 'Herbs', renews: true, uses: 'Prepared into remedies that strengthen healing and resist plague.' },
  game: { name: 'Game', renews: true, uses: 'Hunted for food and hides. Herds recover slowly if over-hunted.' },
  fish: { name: 'Fish', renews: true, uses: 'Caught from shores and riverbanks for food. Stocks recover logistically.' },
  gems: { name: 'Gems', renews: false, uses: 'Luxuries for temples, observatories, art and trade. Rare, in mountains.' },
});

function hash(seed, salt) {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return h >>> 0 || 1;
}
function lattice(x, y, seed) {
  let h = Math.imul(x + 193, 374761393) ^ Math.imul(y + 719, 668265263) ^ seed;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y);
  let u = x - ix, v = y - iy;
  u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
  return (lattice(ix, iy, seed) * (1 - u) + lattice(ix + 1, iy, seed) * u) * (1 - v)
    + (lattice(ix, iy + 1, seed) * (1 - u) + lattice(ix + 1, iy + 1, seed) * u) * v;
}
const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const round = value => Math.round(value * 1e4) / 1e4 || 0;

/** Land tiles bordering water hold fishing grounds and river clay. Derived, never saved. */
export function shoreMask(sim) {
  if (sim._shore?.length === sim.tiles.length) return sim._shore;
  const mask = new Uint8Array(sim.tiles.length);
  for (let y = 0; y < sim.height; y++) for (let x = 0; x < sim.width; x++) {
    const index = y * sim.width + x;
    if (sim.tiles[index].terrain === 'water') continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < sim.width && ny < sim.height && sim.tiles[ny * sim.width + nx].terrain === 'water') { mask[index] = 1; break; }
    }
  }
  sim._shore = mask;
  return mask;
}

export function capacity(tile, shore, key) {
  const t = tile.terrain;
  if (t === 'water') return 0;
  switch (key) {
    case 'fiber': return shore ? .7 : t === 'grass' ? .65 : t === 'sand' ? .2 : t === 'forest' ? .15 : 0;
    case 'herbs': return t === 'forest' ? .6 : t === 'grass' ? .28 : t === 'mountain' ? .25 : .05;
    case 'game': return t === 'forest' ? .8 : t === 'grass' ? .6 : t === 'mountain' ? .2 : .08;
    case 'fish': return shore ? .9 : 0;
  }
  return 0;
}

/** Deterministic deposits for a tile from the world seed and its position. */
export function generateResources(sim, index, shore) {
  const tile = sim.tiles[index], x = index % sim.width, y = Math.floor(index / sim.width);
  const scale = 96 / Math.min(sim.width, 224);
  const n = salt => noise(x * scale / 7, y * scale / 7, hash(sim.seed, salt));
  if (tile.terrain === 'water') return { clay: 0, fiber: 0, herbs: 0, game: 0, fish: 0, gems: 0 };
  const clay = clamp((shore ? .42 : 0) + (tile.terrain === 'sand' ? .3 : 0) + (tile.terrain === 'grass' && tile.elevation < .4 ? .15 : 0) + (n(11) - .5) * .5);
  const gems = tile.terrain === 'mountain' ? clamp((n(29) - .68) * 2.6) : tile.elevation > .6 ? clamp((n(29) - .8) * 1.6) : 0;
  return {
    clay: round(clay),
    fiber: round(capacity(tile, shore, 'fiber') * (.35 + n(13) * .65)),
    herbs: round(capacity(tile, shore, 'herbs') * clamp(.2 + n(17) * 1.1)),
    game: round(capacity(tile, shore, 'game') * (.45 + n(19) * .55)),
    fish: round(capacity(tile, shore, 'fish') * (.5 + n(23) * .5)),
    gems: round(gems),
  };
}

/** Renewal for one tile on the staggered eight-day ecology pass. */
export function renew(tile, shore, rate) {
  if (tile.terrain === 'water') return;
  const fiberCap = capacity(tile, shore, 'fiber'), herbCap = capacity(tile, shore, 'herbs');
  const gameCap = capacity(tile, shore, 'game'), fishCap = capacity(tile, shore, 'fish');
  tile.fiber = Math.min(fiberCap, tile.fiber + (fiberCap - tile.fiber) * .04 * rate);
  tile.herbs = Math.min(herbCap, tile.herbs + (herbCap - tile.herbs) * .025 * rate);
  // Animal and fish stocks regrow logistically: heavily depleted stocks recover slowly.
  if (gameCap) tile.game = Math.min(gameCap, tile.game + (.04 * tile.game * (1 - tile.game / gameCap) + .0015 * gameCap) * Math.sqrt(rate));
  if (fishCap) tile.fish = Math.min(fishCap, tile.fish + (.07 * tile.fish * (1 - tile.fish / fishCap) + .002 * fishCap) * Math.sqrt(rate));
  if (shore && tile.clay < .35) tile.clay = Math.min(.35, tile.clay + .0006 * rate);
}
