/**
 * Common Ground's deterministic, local-rule society model.
 * One tick is one day; the compressed model year has 120 days. Decisions use
 * individual needs, nearby resources and remembered encounters, not a script.
 */
import { initializeMind, initializeSociety, initializeCivilization, considerCivilization, observeAction, communicate, advanceCivilization, civilizationStats, dietVariety, surroundings, facilities, industry, farmRadius, restoreMind, restoreSociety, restoreCivilization } from './civilization.js';
import { initializeInnovation, initializeAgentIdeas, initializeGroupIdeas, innovationEffects, advanceInnovation, innovationStats, restoreInnovation, restoreAgentIdeas, restoreGroupIdeas } from './innovation.js';
import { initializeDiplomacy, advanceDiplomacy, diplomacyStats, restoreDiplomacy, atWar, relationBetween, recordMarriage } from './diplomacy.js';
import { assignSex, assignAttraction, compatible, mother as motherOf, mortality, postpartumDays, conceptionChance, maximumLifespanDays, initializeVital, recordDeath, recordCompletedFertility, vitalStats, restoreVital } from './lifecourse.js';
import { drawOnWealth, bequeath, shareWealth, standing, gini } from './economy.js';
import { TILE_RESOURCES, DEPOSITS, shoreMask, generateResources, generateDeposits, renew } from './resources.js';
import { initializeGlobalCulture, initializeCulture, advanceCulture, cultureLabel, customModifiers, restoreGlobalCulture, restoreCulture } from './culture.js';
import { considerExpansion, considerFission } from './expansion.js';
import { establishKinship } from './diplomacy.js';
import { initializeInfrastructure, advanceInfrastructure, infrastructureStats, restoreInfrastructure, linkBetween } from './infrastructure.js';
import { performAct, endureConditions, activeConditions, PLAGUE_DAYS, WINTER_DAYS } from './acts.js';
import { initializeGlobalPsyche, initializePsyche, restoreGlobalPsyche, restorePsyche, restoreRelationExtras, psycheStats, moodBalance, appraise, acquaint, appreciate, techniqueFactor, rememberPlace, recallPlace, revisitPlace, recordEpisode } from './psyche.js';

export const DAYS_PER_YEAR = 120;
export const DEFAULT_CONFIG = Object.freeze({
  seed: 'moss-17', size: 'large', population: 120, abundance: 1, cooperation: 1, fertility: 1,
});

export const WORLD_SIZES = Object.freeze({
  compact: Object.freeze({ width: 96, height: 64 }), standard: Object.freeze({ width: 160, height: 104 }), large: Object.freeze({ width: 224, height: 144 }),
  vast: Object.freeze({ width: 320, height: 208 }), immense: Object.freeze({ width: 400, height: 260 }),
});
const REGION_GRID = { compact: [4, 3], standard: [4, 3], large: [4, 3], vast: [5, 4], immense: [6, 5] };
const HISTORY_LIMIT = 720, EVENT_LIMIT = 120;
export const TERRAIN = ['water', 'grass', 'forest', 'sand', 'mountain'];
// Tile fields that change as the world is used; terrain, elevation and fertility never do.
export const TILE_FIELDS = Object.freeze(['food', 'wood', 'soil', 'stone', 'ore', ...TILE_RESOURCES, ...DEPOSITS, 'worked']);
const COLORS = ['#df985f', '#6dbea0', '#b29bd6', '#e0bd60', '#7da9d3', '#d8869c', '#a4ba72', '#88c7ca'];
const FIRST_NAMES = ['Ari', 'Mira', 'Kai', 'Sora', 'Lena', 'Noor', 'Emi', 'Rowan', 'Asa', 'Iris', 'Leo', 'Wren', 'Ivo', 'Nia', 'Theo', 'Zuri', 'Sage', 'Ada', 'Remy', 'Ravi', 'June', 'Eden', 'Oren', 'Alba', 'Jin', 'Isla', 'Finn', 'Yara', 'Paz', 'Elio', 'Lumi', 'Tala'];
const MORE_REGION_NAMES = ['Alder', 'Amber', 'Willow', 'Silver', 'Moss', 'Copper', 'Juniper', 'Wind', 'Sun', 'Fern', 'Ash', 'Blue', 'Heron', 'Cedar', 'Ember', 'Frost', 'Hazel', 'Iron', 'Lark', 'Marsh', 'Oak', 'Pine', 'Quill', 'Raven', 'Sable', 'Thistle', 'Umber', 'Violet', 'Wren', 'Yarrow'];
const LAST_NAMES = ['Moss', 'Reed', 'Ash', 'Vale', 'Brook', 'Fern', 'Lake', 'Alder', 'Stone', 'Willow', 'Briar', 'Clay', 'Wells', 'Birch', 'Dune', 'Holt'];
const GROUP_WORDS = ['Hearth', 'Commons', 'Circle', 'Grove', 'Kin', 'Haven', 'Collective', 'Camp'];
const clamp = (n, low = 0, high = 1) => Math.max(low, Math.min(high, n));
const distance2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const foodCapacity = (terrain) => terrain === 'forest' ? 1 : terrain === 'grass' ? 0.8 : terrain === 'sand' ? 0.17 : terrain === 'mountain' ? 0.07 : 0;
const growthRate = (terrain) => terrain === 'forest' ? 0.012 : terrain === 'grass' ? 0.0085 : terrain === 'sand' ? 0.0014 : terrain === 'mountain' ? 0.0004 : 0;

function hashSeed(seed) {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619);
  return hash >>> 0 || 1;
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

function validateConfig(input = {}, base = DEFAULT_CONFIG) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Configuration must be an object.');
  const config = { ...base };
  if (input.seed !== undefined) {
    if (typeof input.seed !== 'string' || !input.seed.length || input.seed.length > 128) throw new Error('Seed must contain 1–128 characters.');
    config.seed = input.seed;
  }
  if (input.size !== undefined) {
    if (!Object.hasOwn(WORLD_SIZES, input.size)) throw new Error('Invalid world size. Choose compact, standard, or large.');
    config.size = input.size;
  }
  for (const [key, min, max, integer] of [
    ['population', 0, Number.MAX_SAFE_INTEGER, true],
    ['abundance', 0.1, 3, false], ['cooperation', 0, 2, false], ['fertility', 0, 3, false],
  ]) {
    if (input[key] === undefined) continue;
    const value = input[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isSafeInteger(value))) {
      throw new Error(`Invalid ${key}: expected ${integer ? 'an integer' : 'a number'} between ${min} and ${max}.`);
    }
    config[key] = value;
  }
  return config;
}

export class Simulation {
  constructor(options = {}) {
    this.config = validateConfig(options);
    this.seed = this.config.seed;
    this.width = WORLD_SIZES[this.config.size].width; this.height = WORLD_SIZES[this.config.size].height; this.day = 0;
    this.rngState = hashSeed(this.seed);
    this.nextAgentId = 1; this.nextGroupId = 1; this.nextEventId = 1;
    this.births = 0; this.deaths = 0; this.arrivals = 0;
    this.weather = { rainUntil: 0, droughtUntil: 0, winterUntil: 0, plagueUntil: 0, climate: 0 };
    this.tiles = []; this.agents = []; this.groups = []; this.history = []; this.events = [];
    this._agentMap = new Map(); this._groupMap = new Map(); this._spatial = new Map();
    this._makeWorld();
    initializeCivilization(this);
    initializeInnovation(this);
    initializeDiplomacy(this);
    initializeGlobalPsyche(this);
    initializeGlobalCulture(this);
    initializeInfrastructure(this);
    initializeVital(this);
    this._populate();
    this._event('world', `${this.agents.length} individuals arrive in a new world. Their choices will shape what follows.`);
    this._recordHistory();
  }

  _random() {
    let x = this.rngState;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    this.rngState = x >>> 0;
    return this.rngState / 4294967296;
  }

  _pick(array) { return array[Math.floor(this._random() * array.length)]; }

  _makeWorld() {
    const seed = hashSeed(this.seed), bend = lattice(5, 11, seed) * 5;
    // Larger worlds are not just finer: terrain features repeat at the same
    // physical scale, so there are more hills, woods, basins and rivers.
    const feature = Math.max(1, this.width / 224);
    const rivers = [{ base: 0.35, amp: 0.055, phase: bend, slope: 0.12 }];
    for (let r = 1; r < 1 + Math.round(feature); r++) {
      rivers.push({ base: r % 2 ? 0.14 + lattice(r, 3, seed) * 0.06 : 0.55 + lattice(r, 5, seed) * 0.06, amp: 0.04 + lattice(r, 7, seed) * 0.03, phase: lattice(r, 9, seed) * 6, slope: (lattice(r, 13, seed) - 0.5) * 0.2 });
    }
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const u = x / this.width, v = y / this.height;
        const nx = u * 96 * feature, ny = v * 64 * feature;
        const hills = noise(nx / 19, ny / 18, seed), detail = noise(nx / 5, ny / 5, seed + 41);
        const continent = Math.max(0.72 - u * u * 0.82, 0.53 - (u - 0.91) ** 2 * 13 - (v - 0.63) ** 2 * 2.3);
        const strait = Math.max(0, 0.045 - Math.abs(u - (0.745 + Math.sin(v * 6 + bend) * 0.018))) * 5;
        const elevation = clamp(continent + (hills - 0.5) * 0.43 + (detail - 0.5) * 0.14 - strait);
        let riverDistance = Infinity;
        for (const river of rivers) riverDistance = Math.min(riverDistance, Math.abs(x - this.width * (river.base + Math.sin(v * 6 + river.phase) * river.amp + v * river.slope)));
        const riverWidth = Math.max(0.8, this.width / 120);
        const moisture = noise(nx / 10, ny / 11, seed + 89);
        const terrain = elevation < 0.23 || riverDistance < riverWidth ? 'water'
          : elevation < 0.28 || riverDistance < riverWidth + 0.8 ? 'sand'
            : elevation > 0.75 ? 'mountain' : moisture > 0.49 ? 'forest' : 'grass';
        const fertility = terrain === 'water' ? 0 : clamp((terrain === 'grass' ? 0.55 : terrain === 'forest' ? 0.43 : terrain === 'sand' ? 0.12 : 0.08)
          + moisture * 0.28 + (riverDistance < 7 ? 0.18 : 0));
        const minerals = noise(nx / 8, ny / 8, seed + 173);
        const stone = terrain === 'water' ? 0 : clamp((terrain === 'mountain' ? 0.55 : 0.04) + elevation * minerals * 0.5);
        const ore = terrain === 'water' ? 0 : clamp((terrain === 'mountain' ? 0.32 : 0.015) + Math.max(0, minerals - 0.5) * (0.7 + elevation));
        this.tiles.push({ terrain, elevation, fertility, soil: fertility, stone, ore,
          food: foodCapacity(terrain) * (0.48 + this._random() * 0.52),
          wood: terrain === 'forest' ? 0.5 + this._random() * 0.5 : terrain === 'grass' ? this._random() * 0.12 : 0 });
      }
    }
    this._makeRegions();
    const shore = shoreMask(this);
    for (let i = 0; i < this.tiles.length; i++) Object.assign(this.tiles[i], generateResources(this, i, shore[i]));
  }

  _makeRegions() {
    const [cols, rows] = REGION_GRID[this.config.size] || [4, 3];
    const seed = hashSeed(this.seed), names = cols > 4 ? MORE_REGION_NAMES : MORE_REGION_NAMES.slice(0, 12);
    const suffix = { grass: 'Meadows', forest: 'Woods', mountain: 'Heights', sand: 'Reach' };
    this.regions = [];
    // Regions label real terrain around a dispersed land coordinate. They do not
    // impose political borders, which remain the outcome of agent encounters.
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      const x = (col + 0.35 + lattice(col, row, seed) * 0.3) * this.width / cols;
      const y = (row + 0.35 + lattice(col, row, seed + 1) * 0.3) * this.height / rows;
      const point = this._landNear(x, y);
      if (this.regions.some((region) => distance2(region, point) < 100)) continue;
      const biome = this._tile(point.x, point.y).terrain;
      const base = `${names[(col + row * cols + seed % names.length) % names.length]} ${suffix[biome]}`;
      const name = this.regions.some((region) => region.name === base) ? `${base} ${['East', 'West', 'North', 'South'][(col + row) % 4]}` : base;
      this.regions.push({ id: this.regions.length + 1, name, ...point, biome });
    }
  }

  _populate() {
    // Loose starting clusters make encounters possible without assigning a society.
    const fertile = [];
    for (let i = 0; i < this.tiles.length; i++) {
      if (this.tiles[i].terrain === 'grass' || this.tiles[i].terrain === 'forest') fertile.push(i);
    }
    const centers = [];
    for (let c = 0; c < Math.max(2, Math.ceil(this.config.population / 16)); c++) {
      let index = this._pick(fertile);
      for (let attempt = 0; attempt < 30; attempt++) {
        const candidate = this._pick(fertile), point = { x: candidate % this.width, y: Math.floor(candidate / this.width) };
        index = candidate;
        if (centers.every((center) => distance2(point, center) > 160)) break;
      }
      centers.push({ x: index % this.width + 0.5, y: Math.floor(index / this.width) + 0.5 });
    }
    for (let i = 0; i < this.config.population; i++) {
      const center = centers[i % centers.length];
      const position = this._landNear(center.x + (this._random() - 0.5) * 14, center.y + (this._random() - 0.5) * 14);
      const agent = this._newAgent(position.x, position.y, 16 + this._random() * 29);
      this.agents.push(agent); this._agentMap.set(agent.id, agent);
    }
  }

  _newAgent(x, y, age = 0, parents = null) {
    const traits = {};
    for (const trait of ['cooperation', 'curiosity', 'sociability']) {
      traits[trait] = parents ? clamp((parents[0].traits[trait] + parents[1].traits[trait]) / 2 + (this._random() - 0.5) * 0.3)
        : 0.15 + this._random() * 0.8;
    }
    const id = this.nextAgentId++;
    const ageDays = Math.floor(age * DAYS_PER_YEAR);
    const surname = parents ? parents[this._random() < 0.5 ? 0 : 1].name.split(' ').at(-1) : this._pick(LAST_NAMES);
    const agent = {
      id, name: `${this._pick(FIRST_NAMES)} ${surname}`, x, y, age: ageDays / DAYS_PER_YEAR,
      health: 95, hunger: age === 0 ? 0 : 8 + this._random() * 12, energy: 70 + this._random() * 25,
      social: 45 + this._random() * 30, happiness: 75, traits,
      inventory: { food: age === 0 ? 0.6 : 1.2 + this._random(), wood: 0 },
      groupId: null, partnerId: null, parentIds: parents ? parents.map((p) => p.id) : [], children: [],
      action: age < 5 ? 'growing up' : 'exploring', generation: parents ? Math.max(parents[0].generation, parents[1].generation) + 1 : 1,
      _ageDays: ageDays, _lifespan: maximumLifespanDays(this._random()), sex: assignSex(this), attraction: assignAttraction(this), wealth: 0,
      _lastBirthDay: -1000, _bondDay: -1, _relations: [], _stress: 0, _homeDays: 0,
      _wanderX: x, _wanderY: y, _courtship: null,
    };
    initializeMind(this, agent, parents);
    initializeAgentIdeas(agent);
    initializePsyche(this, agent, parents);
    return agent;
  }

  _tile(x, y) { return this.tiles[Math.floor(clamp(y, 0, this.height - 0.001)) * this.width + Math.floor(clamp(x, 0, this.width - 0.001))]; }

  _landNear(x, y) {
    x = clamp(x, 0.5, this.width - 0.5); y = clamp(y, 0.5, this.height - 0.5);
    if (this._tile(x, y).terrain !== 'water') return { x, y };
    for (let radius = 1; radius < this.width; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (const dx of [-radius, radius]) {
          const px = clamp(Math.floor(x) + dx + 0.5, 0.5, this.width - 0.5), py = clamp(Math.floor(y) + dy + 0.5, 0.5, this.height - 0.5);
          if (this._tile(px, py).terrain !== 'water') return { x: px, y: py };
        }
      }
      for (let dx = -radius + 1; dx < radius; dx++) {
        for (const dy of [-radius, radius]) {
          const px = clamp(Math.floor(x) + dx + 0.5, 0.5, this.width - 0.5), py = clamp(Math.floor(y) + dy + 0.5, 0.5, this.height - 0.5);
          if (this._tile(px, py).terrain !== 'water') return { x: px, y: py };
        }
      }
    }
    return { x, y };
  }

  _move(agent, target, speed = 1.05) {
    const dx = target.x - agent.x, dy = target.y - agent.y, distance = Math.hypot(dx, dy);
    if (distance < 0.1) return;
    const amount = Math.min(speed, distance);
    const nx = clamp(agent.x + dx / distance * amount, 0.15, this.width - 0.15);
    const ny = clamp(agent.y + dy / distance * amount, 0.15, this.height - 0.15);
    if (this._tile(nx, ny).terrain !== 'water') { agent.x = nx; agent.y = ny; }
    else {
      // Walk the bank until a crossing is found. Narrow rivers may be forded;
      // ocean tiles are never valid destinations.
      const candidates = [
        { x: nx, y: agent.y }, { x: agent.x, y: ny },
        { x: clamp(agent.x + Math.sign(dx) * 2.3, 0.15, this.width - 0.15), y: ny },
        { x: nx, y: clamp(agent.y + Math.sign(dy) * 2.3, 0.15, this.height - 0.15) },
      ];
      let next = null, score = Infinity;
      for (const candidate of candidates) {
        if (this._tile(candidate.x, candidate.y).terrain === 'water' || distance2(agent, candidate) < 0.001) continue;
        const candidateScore = distance2(candidate, target);
        if (candidateScore < score) { score = candidateScore; next = candidate; }
      }
      if (next) { agent.x = next.x; agent.y = next.y; }
    }
    agent.energy = clamp(agent.energy - amount * 0.65, 0, 100);
  }

  _buildSpatial() {
    this._spatial.clear();
    for (const agent of this.agents) {
      const key = (Math.floor(agent.y / 4) * Math.ceil(this.width / 4)) + Math.floor(agent.x / 4);
      let cell = this._spatial.get(key);
      if (!cell) { cell = []; this._spatial.set(key, cell); }
      cell.push(agent);
    }
  }

  _neighbors(agent, radius = 3) {
    const list = [];
    const minX = Math.max(0, Math.floor((agent.x - radius) / 4)), maxX = Math.min(Math.ceil(this.width / 4) - 1, Math.floor((agent.x + radius) / 4));
    const minY = Math.max(0, Math.floor((agent.y - radius) / 4)), maxY = Math.min(Math.ceil(this.height / 4) - 1, Math.floor((agent.y + radius) / 4));
    for (let cy = minY; cy <= maxY; cy++) for (let cx = minX; cx <= maxX; cx++) {
      const cell = this._spatial.get(cy * Math.ceil(this.width / 4) + cx);
      if (cell) for (const other of cell) if (other.id !== agent.id && other.health > 0 && distance2(agent, other) <= radius ** 2) list.push(other);
    }
    return list;
  }

  _climate() {
    const before = this.weather.climate;
    // First-order autoregressive anomaly with a stationary spread of about ±0.4.
    const shock = (this._random() + this._random() + this._random() - 1.5) * 0.45;
    this.weather.climate = Math.round(clamp(before * 0.8 + shock, -2, 2) * 1e4) / 1e4 || 0;
    if (before > -0.6 && this.weather.climate <= -0.6) this._event('world', 'A run of dry years sets in; wild food and harvests shrink.');
    else if (before < 0.6 && this.weather.climate >= 0.6) this._event('world', 'Several unusually wet, fertile years follow one another.');
  }

  _ecology() {
    const rain = this.weather.rainUntil > this.day, drought = this.weather.droughtUntil > this.day, winter = this.weather.winterUntil > this.day;
    const season = 0.82 + 0.32 * Math.sin(this.day / DAYS_PER_YEAR * Math.PI * 2);
    // Interannual climate: a persistent anomaly, so wet and dry years come in runs.
    if (this.day % 30 === 0) this._climate();
    const rate = this.config.abundance * season * (drought ? 0.22 : rain ? 1.8 : 1) * (winter ? 0.25 : 1) * Math.exp(this.weather.climate * 0.6);
    // Staggered eight-day ecological updates keep large time advances cheap.
    const shore = shoreMask(this);
    for (let i = this.day % 8; i < this.tiles.length; i += 8) {
      const tile = this.tiles[i], capacity = foodCapacity(tile.terrain);
      if (!capacity) continue;
      if (drought) tile.food *= 0.95;
      tile.food = Math.min(capacity, tile.food + growthRate(tile.terrain) * (0.7 + tile.fertility * 0.6) * 8 * rate);
      tile.soil = Math.min(1, tile.soil + 0.008 * tile.fertility * 8 * rate);
      renew(tile, shore[i], rate);
      const woodCap = tile.terrain === 'forest' ? 1 : tile.terrain === 'grass' ? 0.12 : 0;
      // Woodland regrows logistically: cleared land takes decades to recover (Poorter et al. 2016).
      tile.wood = Math.min(woodCap, tile.wood + (tile.terrain === 'forest' ? 0.016 * tile.wood * (1 - tile.wood) + 0.0006 : 0.0008) * this.config.abundance);
    }
    for (const group of this.groups) {
      const storage = innovationEffects(this, group).storage;
      group.food *= 1 - (group.civilization?.buildings.granary ? 0.0005 : 0.0015) / storage * (winter ? 2.5 : 1);
      group.wood = Math.min(group.wood, 40 + group.shelters * 6);
      if (group.shelters && this._random() < group.shelters * 0.00015) group.shelters--;
    }
  }

  _eat(agent, group) {
    const demand = agent.age < 18 ? 0.09 + agent.age / 18 * 0.14 : 0.23;
    agent.hunger = clamp(agent.hunger + demand * 30, 0, 100);
    const wanted = Math.min(0.52, agent.hunger / 30);
    let eaten = Math.min(wanted, agent.inventory.food);
    agent.inventory.food -= eaten;
    // Households eat from their own stores before drawing on the common one.
    if (eaten < wanted && agent.hunger > 20) eaten += drawOnWealth(agent, wanted - eaten);
    if (eaten < wanted && group && distance2(agent, group) < 81) {
      const shared = Math.min(wanted - eaten, group.food);
      eaten += shared; group.food -= shared;
    }
    if (eaten < wanted && agent.age < 14) {
      for (const parentId of agent.parentIds) {
        const parent = this._agentMap.get(parentId);
        if (!parent || distance2(agent, parent) > 20) continue;
        const gift = Math.min(wanted - eaten, Math.max(0, parent.inventory.food - 0.15));
        parent.inventory.food -= gift; eaten += gift;
        if (eaten < wanted) eaten += drawOnWealth(parent, wanted - eaten);
        if (eaten >= wanted) break;
      }
    }
    agent.hunger = clamp(agent.hunger - eaten * 30, 0, 100);
    agent.inventory.food *= 1 - 0.001 / techniqueFactor(agent, 'preserve');
  }

  _forage(agent) {
    let best = null, bestScore = -Infinity;
    const range = agent.hunger > 60 ? 7 : 4;
    const startX = Math.floor(agent.x), startY = Math.floor(agent.y);
    // Sample the neighborhood, including every immediately adjacent cell.
    const samples = 16 + Math.floor(agent.traits.curiosity * 10);
    for (let attempt = -9; attempt < samples; attempt++) {
      const dx = attempt < 0 ? (attempt + 9) % 3 - 1 : Math.floor(this._random() * (range * 2 + 1)) - range;
      const dy = attempt < 0 ? Math.floor((attempt + 9) / 3) - 1 : Math.floor(this._random() * (range * 2 + 1)) - range;
      const x = startX + dx, y = startY + dy;
      if (x < 0 || x >= this.width || y < 0 || y >= this.height) continue;
      const tile = this.tiles[y * this.width + x];
      if (tile.terrain === 'water') continue;
      const score = tile.food - Math.hypot(dx, dy) * 0.045;
      if (score > bestScore) { bestScore = score; best = { x: x + 0.5, y: y + 0.5 }; }
    }
    // When nothing nearby is worth eating, head for a remembered foraging ground.
    const remembered = bestScore < 0.2 && agent.age >= 10 ? recallPlace(agent, 'food') : null;
    if (remembered) this._move(agent, remembered, 1.1);
    else if (best) this._move(agent, best, agent.age < 10 ? 0.85 : 1.1);
    const tile = this._tile(agent.x, agent.y);
    const group = this._groupMap.get(agent.groupId);
    const efficiency = (1 + agent.skills.foraging / 250 + (group?.civilization.stock.tools > 0 ? 0.12 : 0)) * innovationEffects(this, group).gathering * techniqueFactor(agent, 'forage');
    const amount = Math.max(0, Math.min(tile.food, (agent.age < 8 ? 0.18 : agent.age < 16 ? 0.53 : 0.9) * efficiency, 5 - agent.inventory.food));
    revisitPlace(this, agent, 'food', tile.food);
    if (tile.food > 0.6) rememberPlace(this, agent, 'food', Math.floor(agent.x) + 0.5, Math.floor(agent.y) + 0.5, tile.food);
    if (group) { group.civilization.production.food += amount; group.civilization.diet.wild += amount; }
    agent.inventory.food += amount; tile.food -= amount;
    agent.energy = clamp(agent.energy - 2.8, 0, 100);
    agent.action = amount > 0.08 ? 'foraging' : remembered ? 'heading to remembered foraging ground' : 'seeking food';
    // Eat newly collected food immediately if a journey began hungry.
    if (agent.hunger > 18) {
      const meal = Math.min(agent.inventory.food, (agent.hunger - 8) / 30, 0.65);
      agent.inventory.food -= meal; agent.hunger = clamp(agent.hunger - meal * 30, 0, 100);
    }
  }

  _gatherWood(agent, group) {
    let target = null, bestScore = 0;
    for (let i = 0; i < 16; i++) {
      const x = Math.floor(agent.x) + Math.floor(this._random() * 11) - 5;
      const y = Math.floor(agent.y) + Math.floor(this._random() * 11) - 5;
      if (x < 0 || x >= this.width || y < 0 || y >= this.height) continue;
      const tile = this.tiles[y * this.width + x], score = tile.wood - Math.hypot(x - agent.x, y - agent.y) * 0.055;
      if (score > bestScore) { bestScore = score; target = { x: x + 0.5, y: y + 0.5 }; }
    }
    if (target && agent.inventory.wood < 2) this._move(agent, target);
    const efficiency = (1 + agent.skills.forestry / 250 + (group.civilization.stock.tools > 0 ? 0.12 : 0)) * innovationEffects(this, group).gathering;
    const tile = this._tile(agent.x, agent.y), amount = Math.max(0, Math.min(tile.wood, 0.5 * efficiency, 2 - agent.inventory.wood));
    group.civilization.production.wood += amount;
    tile.wood -= amount; agent.inventory.wood += amount;
    agent.energy = clamp(agent.energy - 2.5, 0, 100);
    agent.action = 'gathering wood';
    if (agent.inventory.wood >= 1 || !target) {
      this._move(agent, group);
      if (distance2(agent, group) < 16) {
        group.wood += agent.inventory.wood; agent.inventory.wood = 0;
        if (group.wood >= 3.5 && group.shelters < Math.ceil(group.members.length / 5)) {
          group.wood -= 3.5; group.shelters++; agent.action = 'building shelter';
        } else if (group.civilization.stock.hides >= 2.5 && group.wood >= 1 && group.shelters < Math.ceil(group.members.length / 5)) {
          // Hunters' hides stretched over a light frame make a tent.
          group.civilization.stock.hides -= 2.5; group.wood -= 1; group.shelters++; agent.action = 'raising a hide tent';
        }
      }
    }
  }

  _act(agent, group) {
    const home = group && distance2(agent, group) < 64;
    const youngChild = agent.children.some((id) => {
      const child = this._agentMap.get(id);
      return child && child.age < 12 && distance2(agent, child) < 64;
    });
    if (agent.age < 5) {
      const parents = agent.parentIds.map((id) => this._agentMap.get(id)).filter(Boolean);
      const parent = parents.sort((a, b) => distance2(a, agent) - distance2(b, agent))[0];
      if (parent) this._move(agent, parent, 1.3);
      else if (group) this._move(agent, group, 0.7);
      agent.energy = clamp(agent.energy + 8, 0, 100);
      agent.social = clamp(agent.social + (parent || home ? 3 : -1), 0, 100);
      agent.action = parent ? 'with family' : home ? 'growing up' : 'seeking family';
      if (agent.hunger > 35 && !parent) this._forage(agent);
      return;
    }
    // Exhaustion comes before topping up a food reserve; only real hunger overrides it.
    const exhausted = agent.energy < 25 && agent.hunger <= 40;
    if (!exhausted && (agent.hunger > 40 || (agent.inventory.food < (youngChild ? 2.1 : 1.15) && !(home && group.food > group.members.length * 0.7)))) {
      this._forage(agent); return;
    }
    // Rest before energy falls below what work needs (43, see considerCivilization);
    // otherwise people drift just under it, too tired to work yet not resting.
    if (agent.energy < 45 || (agent.energy < 67 && this._random() < 0.12)) {
      if (group && !home && agent.hunger < 30) this._move(agent, group);
      agent.energy = clamp(agent.energy + (home && group.shelters * 5 >= group.members.length ? 20 : 14), 0, 100);
      agent.action = home && group.shelters ? 'resting at home' : 'resting';
      return;
    }
    if (group && agent.age >= 14 && group.shelters < Math.ceil(group.members.length / 5)
      && this._random() < agent.traits.cooperation * this.config.cooperation * 0.4) {
      this._gatherWood(agent, group); return;
    }
    if (group && agent.inventory.food > 1.25 && group.food < group.members.length * 3 + 8
      && this._random() < agent.traits.cooperation * this.config.cooperation * 0.65) {
      if (!home) this._move(agent, group);
      if (distance2(agent, group) < 36) {
        const gift = Math.min(0.85, agent.inventory.food - 0.9);
        group.food += gift; agent.inventory.food -= gift;
        agent.psyche.record.provided = Math.round((agent.psyche.record.provided + gift) * 1e4) / 1e4;
        agent.social = clamp(agent.social + 4, 0, 100); agent.action = 'sharing food';
      } else agent.action = 'returning to camp';
      return;
    }
    const partner = this._agentMap.get(agent.partnerId);
    if (partner && distance2(agent, partner) > 9 && (agent.social < 65 || youngChild)) {
      this._move(agent, partner); agent.action = 'seeking family'; return;
    }
    if (agent.social < 60 + agent.traits.sociability * 20) {
      const neighbors = this._neighbors(agent, 7);
      if (neighbors.length) {
        const other = this._pick(neighbors);
        this._move(agent, other, 0.8); agent.action = 'socializing'; return;
      }
      if (group) { this._move(agent, group); agent.action = 'returning to camp'; return; }
    }
    if (youngChild && this._random() < 0.5) {
      const child = agent.children.map((id) => this._agentMap.get(id)).find((a) => a && a.age < 12);
      if (child) { this._move(agent, child); agent.social = clamp(agent.social + 3, 0, 100); agent.action = 'caring for family'; return; }
    }
    // Curious people range far from camp (from about 12 to 40 tiles) before the pull of home wins.
    const range = 12 + agent.traits.curiosity * 28;
    if (group && distance2(agent, group) > range * range && this._random() > agent.traits.curiosity) {
      this._move(agent, group); agent.action = 'returning to camp'; return;
    }
    const arrived = distance2(agent, { x: agent._wanderX, y: agent._wanderY }) < 2;
    if (arrived) this._survey(agent);
    if (arrived || this._random() < 0.06) {
      const reach = 16 + agent.traits.curiosity * 44;
      const target = this._landNear(agent.x + (this._random() - 0.5) * reach, agent.y + (this._random() - 0.5) * reach);
      agent._wanderX = target.x; agent._wanderY = target.y;
    }
    this._move(agent, { x: agent._wanderX, y: agent._wanderY }, 0.9);
    agent.action = 'exploring';
  }

  /** An explorer notes the best food, timber and materials around a place they reach. */
  _survey(agent) {
    for (const kind of ['food', 'wood', 'stone', 'ore', 'game', 'fish', 'clay', 'coal']) {
      let best = null, value = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const tile = this._tile(agent.x + dx, agent.y + dy);
        if (tile.terrain !== 'water' && (tile[kind] || 0) > value) { value = tile[kind]; best = { x: Math.floor(clamp(agent.x + dx, 0, this.width - 1)) + 0.5, y: Math.floor(clamp(agent.y + dy, 0, this.height - 1)) + 0.5 }; }
      }
      if (best && value > 0.45) rememberPlace(this, agent, kind, best.x, best.y, value);
    }
  }

  _remember(agent, other) {
    let relation = agent._relations.find((r) => r.id === other.id);
    if (!relation) {
      if (agent._relations.length >= 12) {
        agent._relations.sort((a, b) => a.strength - b.strength || a.lastSeen - b.lastSeen);
        agent._relations.shift();
      }
      relation = { id: other.id, strength: 0.1, lastSeen: this.day };
      agent._relations.push(relation);
    }
    relation.strength = clamp(relation.strength + 0.025 + (agent.traits.cooperation + other.traits.cooperation) * this.config.cooperation * 0.025);
    relation.lastSeen = this.day;
    return relation;
  }

  _kin(a, b) {
    return a.parentIds.includes(b.id) || b.parentIds.includes(a.id) || a.parentIds.some((id) => b.parentIds.includes(id));
  }

  _socialize(agent) {
    if (this._random() > 0.3 + agent.traits.sociability * 0.35) return;
    const neighbors = this._neighbors(agent, 2.7);
    if (!neighbors.length) return;
    const other = this._pick(neighbors);
    const bond = this._remember(agent, other);
    const returned = this._remember(other, agent);
    acquaint(agent, other, bond); acquaint(other, agent, returned);
    communicate(this, agent, other);
    agent.social = clamp(agent.social + 7, 0, 100); other.social = clamp(other.social + 6, 0, 100);
    // Hamilton's rule and reciprocity: people give most readily to kin and to those who have given to them;
    // someone who keeps taking without returning gets less.
    const balance = bond.favors || 0;
    const generosity = agent.traits.cooperation * this.config.cooperation * (this._kin(agent, other) || agent.partnerId === other.id ? 1.8 : 1) * clamp(1 + balance / 5, 0.3, 2);
    if (agent.inventory.food > 0.6 && other.hunger > 35 && this._random() < generosity) {
      const gift = Math.min(0.5, agent.inventory.food - 0.4);
      agent.inventory.food -= gift; other.inventory.food += gift;
      bond.favors = Math.round(Math.max(-50, balance - 1) * 1e4) / 1e4 || 0;
      if (bond.favors < -4) bond.trust = Math.round(clamp((bond.trust ?? 0.45) - 0.02) * 1e4) / 1e4;
      agent.psyche.record.provided = Math.round((agent.psyche.record.provided + gift) * 1e4) / 1e4;
      appreciate(other, agent);
      agent.action = 'helping a neighbor';
    }
    if (this._eligibleMate(agent, other) && bond.strength > 0.28 && this._random() < 0.2 * (1 + Math.min(0.5, (standing(agent) + standing(other)) / 10))) {
      this._pair(agent, other);
      if (agent.groupId && !other.groupId) this._joinGroup(other, this._groupMap.get(agent.groupId));
      else if (other.groupId && !agent.groupId) this._joinGroup(agent, this._groupMap.get(other.groupId));
    }
    if (!agent.groupId && other.groupId && agent.age >= 14 && bond.strength > 0.24
      && this._random() < 0.055 * this.config.cooperation * (0.3 + agent.traits.cooperation)) {
      const group = this._groupMap.get(other.groupId);
      if (group && distance2(agent, group) < 225) this._joinGroup(agent, group);
    }
  }

  /** Adults who could begin a life together: single, of age, close in age, mutually attracted, not close kin. */
  _eligibleMate(a, b) {
    return a !== b && b.health > 0 && !a.partnerId && !b.partnerId && a.age >= 16 && b.age >= 16 && a.age < 55 && b.age < 55
      && Math.abs(a.age - b.age) < 20 && compatible(a, b) && !this._kin(a, b);
  }

  _pair(a, b) {
    a.partnerId = b.id; b.partnerId = a.id;
    a._bondDay = this.day; b._bondDay = this.day;
    a.social = clamp(a.social + 15, 0, 100); b.social = clamp(b.social + 15, 0, 100);
    appraise(this, a, 'bond', { name: b.name, about: b.id }); appraise(this, b, 'bond', { name: a.name, about: a.id });
    a._courtship = null; b._courtship = null;
  }

  /** Single adults by society (0 for those without one), rebuilt daily; eligibility is rechecked on use. */
  _singles() {
    if (this._singleCache?.day === this.day) return this._singleCache.map;
    const map = new Map();
    for (const agent of this.agents) {
      if (agent.partnerId || agent.age < 16 || agent.age >= 55 || agent.health <= 0) continue;
      const key = agent.groupId || 0;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(agent);
    }
    this._singleCache = { day: this.day, map };
    return map;
  }

  /**
   * Band exogamy. Small bands soon hold no one a single person could marry, so,
   * as foragers do, people look to other bands. A single adult with no suitable
   * partner at home may set out for a band within reach that has one. Allied,
   * trading and kin bands draw people from farther away; a band at war never
   * does. Open, outward-looking cultures marry out readily, traditional and
   * inward-looking ones less.
   */
  _considerCourtship(agent, home) {
    if (agent.partnerId || agent._courtship || agent.age >= 50) return;
    const singles = this._singles();
    if (home ? (singles.get(home.id) || []).some((other) => this._eligibleMate(agent, other)) : this._neighbors(agent, 8).some((other) => this._eligibleMate(agent, other))) return;
    const norms = home?.civilization.culture?.norms;
    const outlook = norms ? (norms.expansion + norms.mercantile - norms.tradition - norms.collectivism) * 0.25 : 0.1;
    const willingness = clamp(0.35 + (agent.psyche.personality.openness - 0.5) * 0.4 + agent.traits.sociability * 0.15 + outlook, 0.05, 0.85);
    if (this._random() > willingness * 0.5) return;
    const origin = home || agent, reach = 45 * (home ? industry(home).reach : 1);
    let best = null, bestScore = -Infinity;
    for (const band of this.groups) {
      if (band === home || !(singles.get(band.id) || []).some((other) => this._eligibleMate(agent, other))) continue;
      // A road or railway brings a distant band within easy reach.
      const route = home ? linkBetween(this, home, band) : null;
      const distance = Math.sqrt(distance2(origin, band)) / (route ? (route.kind === 'rail' ? 3 : 2) : 1);
      if (distance > reach || (home && atWar(this, home, band))) continue;
      const r = home ? relationBetween(this, home, band) : null;
      const kin = home && (home.civilization.culture?.parentId === band.id || band.civilization.culture?.parentId === home.id) ? 0.5 : 0;
      const ties = !r ? 0 : r.status === 'alliance' ? 0.6 : r.status === 'trade' ? 0.4 : r.status === 'truce' ? -0.3 : 0;
      // Strangers are approached only nearby; friends and kin are worth a longer journey.
      const score = ties + kin + (r ? r.trust * 0.5 - r.tension / 100 : 0) - distance / reach;
      if (score > bestScore) { bestScore = score; best = band; }
    }
    if (!best || bestScore < -0.7) return;
    agent._courtship = { groupId: best.id, since: this.day };
  }

  /** A courting journey: travel to the band, get to know its singles, perhaps marry. Returns false to fall back to everyday needs. */
  _court(agent, home) {
    const band = this._groupMap.get(agent._courtship.groupId);
    const hosts = band ? (this._singles().get(band.id) || []).filter((other) => this._eligibleMate(agent, other)) : [];
    if (!band || band === home || agent.partnerId || !hosts.length || (home && atWar(this, home, band)) || this.day - agent._courtship.since > 150) {
      agent._courtship = null; return false;
    }
    if (agent.hunger > 40 || agent.energy < 30) return false;
    agent.mind.intention = `Find a partner among the people of ${band.name}.`;
    if (distance2(agent, band) > 36) {
      this._move(agent, band, 1.1); agent.action = `travelling to ${band.name} to find a partner`; return true;
    }
    const nearby = hosts.filter((other) => distance2(other, band) < 225);
    if (!nearby.length) { this._move(agent, band, 0.6); agent.action = `visiting ${band.name}`; return true; }
    const other = this._pick(nearby);
    this._move(agent, other, 0.9);
    const bond = this._remember(agent, other), returned = this._remember(other, agent);
    acquaint(agent, other, bond); acquaint(other, agent, returned);
    communicate(this, agent, other);
    agent.social = clamp(agent.social + 5, 0, 100); other.social = clamp(other.social + 5, 0, 100);
    agent.action = `courting ${other.name} in ${band.name}`;
    const trust = home ? relationBetween(this, home, band)?.trust || 0 : 0;
    if (bond.strength > 0.28 && this._random() < 0.25 * (1 + trust)) this._marry(agent, other, home, band);
    return true;
  }

  /** The couple settles where life looks better: the larger, better-fed band. */
  _marry(agent, other, home, band) {
    this._pair(agent, other);
    const prospects = (group) => group.members.length + group.food / Math.max(1, group.members.length) * 2;
    let text;
    if (home && prospects(home) > prospects(band)) {
      this._joinGroup(other, home);
      text = `${agent.name} of ${home.name} marries ${other.name} of ${band.name} and brings them home.`;
    } else {
      this._joinGroup(agent, band);
      text = `${agent.name}${home ? ` of ${home.name}` : ''} marries ${other.name} and joins ${band.name}.`;
    }
    if (home) recordMarriage(this, home, band);
    this._event('group', text, { agentId: agent.id, groupId: band.id });
  }

  _joinGroup(agent, group) {
    if (!group || agent.groupId === group.id) return;
    const old = this._groupMap.get(agent.groupId);
    if (old) old.members = old.members.filter((id) => id !== agent.id);
    agent.groupId = group.id; group.members.push(agent.id); agent._homeDays = 0; agent._stress = 0;
    if (agent.age >= 14) appraise(this, agent, 'belonging', { text: `Became part of ${group.name}.` });
    for (const id of agent.children) {
      const child = this._agentMap.get(id);
      if (child && child.age < 14 && child.groupId !== group.id) this._joinGroup(child, group);
    }
  }

  _considerSociety(agent) {
    if (agent.age < 16 || agent.hunger > 45 || this.config.cooperation === 0) return;
    const group = this._groupMap.get(agent.groupId);
    this._considerCourtship(agent, group);
    if (group) {
      agent._homeDays += 7;
      // Customs, temples and halls hold a community together; restless pioneers leave more readily.
      const cohesion = (customModifiers(this, group)?.cohesion || 0) + facilities(group).cohesion * 0.15;
      // Relative deprivation: being far poorer than one's neighbours is a lasting strain.
      const mean = group.members.reduce((sum, id) => sum + (this._agentMap.get(id)?.wealth || 0), 0) / Math.max(1, group.members.length);
      const deprived = mean > 2 && agent.wealth * 3 < mean ? 1 : 0;
      agent._stress = clamp(agent._stress + (agent.hunger > 30 || (agent.social < 20 && distance2(agent, group) > 225) ? 2 : -0.5) + (agent.psyche.mood.anger > 0.5 ? 1 : 0) + deprived - cohesion * 2, 0, 200);
      if (agent._homeDays > 240 && agent._stress > 100 && this._random() < 0.018 * (1.1 - agent.traits.cooperation) * (0.6 + agent.psyche.expansion * 0.8)) {
        group.members = group.members.filter((id) => id !== agent.id); agent.groupId = null; agent._stress = 0;
        appraise(this, agent, 'departure', { text: `Left ${group.name} in search of a better home.` });
        this._event('migration', `${agent.name} leaves ${group.name} in search of a better home.`, { agentId: agent.id, groupId: group.id });
      }
      return;
    }
    if (this._random() > 0.09 * this.config.cooperation * (0.25 + agent.traits.cooperation)) return;
    const friends = agent._relations.filter((r) => r.strength > 0.28).map((r) => this._agentMap.get(r.id))
      .filter((other) => other && !other.groupId && other.age >= 16 && distance2(agent, other) < 64);
    if (friends.length < 2) return;
    const founders = [agent, ...friends.slice(0, 5)], id = this.nextGroupId++;
    const center = this._landNear(founders.reduce((sum, a) => sum + a.x, 0) / founders.length, founders.reduce((sum, a) => sum + a.y, 0) / founders.length);
    const newGroup = { id, name: `${this._pick(LAST_NAMES)} ${this._pick(GROUP_WORDS)}`, color: COLORS[(id - 1) % COLORS.length],
      ...center, members: [], food: 0, wood: 0, shelters: 0, culture: 'Kinship', _foundedDay: this.day, _lastMoveDay: this.day, _shortageDays: 0 };
    initializeSociety(newGroup);
    initializeGroupIdeas(newGroup);
    this.groups.push(newGroup); this._groupMap.set(id, newGroup);
    for (const founder of founders) {
      this._joinGroup(founder, newGroup);
      const partner = this._agentMap.get(founder.partnerId);
      if (partner && !partner.groupId) this._joinGroup(partner, newGroup);
    }
    initializeCulture(this, newGroup);
    this._updateCulture(newGroup);
    this._event('group', `${newGroup.name} forms as ${newGroup.members.length} neighbors choose to share a home.`, { groupId: id, agentId: agent.id });
  }

  _updateCulture(group) {
    const label = cultureLabel(group, this);
    if (label) { group.culture = label; return; }
    let cooperation = 0, curiosity = 0, sociability = 0, count = 0;
    for (const id of group.members) {
      const member = this._agentMap.get(id);
      if (!member) continue;
      cooperation += member.traits.cooperation; curiosity += member.traits.curiosity; sociability += member.traits.sociability; count++;
    }
    if (!count) return;
    group.culture = cooperation / count > 0.67 ? 'Mutual care' : curiosity / count > 0.65 ? 'Exploration'
      : sociability / count > 0.64 ? 'Kinship' : cooperation / count < 0.42 ? 'Independence' : 'Stewardship';
  }

  _groupLife() {
    for (const group of this.groups) {
      const members = group.members.map((id) => this._agentMap.get(id)).filter(Boolean);
      const hunger = members.reduce((sum, agent) => sum + agent.hunger, 0) / (members.length || 1);
      group._shortageDays = Math.max(0, group._shortageDays + (hunger > 30 ? 1 : -0.5));
      if (this.day % 60 === 0) this._updateCulture(group);
      const settled = Object.values(group.civilization.buildings).some((count) => count > 0);
      if ((!settled || group._shortageDays > 60) && (group._shortageDays > 20 || (members.length && members.filter((a) => distance2(a, group) > 225).length > members.length * 0.7))
        && this.day - group._lastMoveDay > 180) {
        const candidates = [group, ...members];
        let best = group, bestScore = -Infinity;
        for (let i = 0; i < Math.min(candidates.length + 10, 35); i++) {
          const candidate = i < candidates.length ? candidates[i] : this._landNear(group.x + (this._random() - 0.5) * 24, group.y + (this._random() - 0.5) * 24);
          let food = 0;
          for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) food += this._tile(candidate.x + dx, candidate.y + dy).food;
          const score = food - Math.sqrt(distance2(group, candidate)) * 0.25;
          if (score > bestScore) { bestScore = score; best = candidate; }
        }
        if (distance2(best, group) > 16) {
          const place = this._landNear(best.x, best.y);
          group.x = place.x; group.y = place.y; group.shelters = Math.floor(group.shelters / 2);
          for (const building of Object.keys(group.civilization.buildings)) group.civilization.buildings[building] = Math.floor(group.civilization.buildings[building] / 2);
          group.food *= 0.8; group._lastMoveDay = this.day; group._shortageDays = 0;
          this._event('migration', `${group.name} moves its camp toward more promising land.`, { groupId: group.id });
        }
      }
    }
    if (this.day % 30 === 15) { this._consolidate(); this._urbanize(); }
    for (let i = this.groups.length - 1; i >= 0; i--) {
      const group = this.groups[i];
      if (group.members.length === 0 || (group.members.length < 2 && this.day - group._foundedDay > 180)) {
        for (const id of group.members) { const member = this._agentMap.get(id); if (member) member.groupId = null; }
        this.groups.splice(i, 1); this._groupMap.delete(group.id);
        this._event('group', `${group.name} dissolves as its last members move on.`, { groupId: group.id });
      }
    }
  }

  /**
   * A dwindling band cannot keep up its camp. Its people join the most promising
   * friendly band within reach (allies, kin and settled towns first), bringing
   * their stores, instead of dying out one by one.
   */
  _consolidate() {
    for (const band of [...this.groups]) {
      if (band.members.length >= 5 || this.day - band._foundedDay < 360 || !this._groupMap.has(band.id)) continue;
      let best = null, bestScore = -Infinity;
      for (const other of this.groups) {
        if (other === band || other.members.length <= band.members.length || atWar(this, band, other)) continue;
        const distance = Math.sqrt(distance2(band, other));
        if (distance > 40) continue;
        const r = relationBetween(this, band, other);
        const kin = band.civilization.culture?.parentId === other.id || other.civilization.culture?.parentId === band.id;
        const built = Object.values(other.civilization.buildings).reduce((a, b) => a + b, 0);
        const score = (r?.status === 'alliance' || kin ? 1 : r?.status === 'trade' ? 0.6 : 0) + (r?.trust || 0) - (r?.tension || 0) / 100 + Math.min(1, built / 12) + Math.min(1, other.members.length / 40) - distance / 40;
        if (score > bestScore) { bestScore = score; best = other; }
      }
      if (!best) continue;
      best.food += band.food; best.wood += band.wood; band.food = 0; band.wood = 0;
      for (const key of Object.keys(band.civilization.stock)) { best.civilization.stock[key] += band.civilization.stock[key]; band.civilization.stock[key] = 0; }
      for (const id of [...band.members]) {
        const agent = this._agentMap.get(id);
        if (!agent || agent.groupId !== band.id) continue;
        this._joinGroup(agent, best);
        agent._wanderX = best.x; agent._wanderY = best.y;
      }
      this._event('group', `The last people of ${band.name} join ${best.name}.`, { groupId: best.id });
    }
  }

  /**
   * Urbanisation: working-age people leave poorer bands for a thriving town
   * within reach (or joined by road, rail or sea), above all an industrial one,
   * as the countryside emptied into factory towns. Output per person measures
   * how well a place lives; the move is individual, with partner and children.
   */
  _urbanize() {
    const perHead = (group) => (group.civilization.economy?.output > 0 ? group.civilization.economy.output : 0) / Math.max(1, group.members.length);
    const towns = this.groups.filter((group) => group.members.length >= 12 && group.civilization.economy?.history.length >= 2);
    if (!towns.length) return;
    for (const band of [...this.groups]) {
      const home = perHead(band);
      for (const id of [...band.members]) {
        const agent = this._agentMap.get(id);
        if (!agent || agent.age < 16 || agent.age > 40 || agent.groupId !== band.id || agent.partnerId && this._agentMap.get(agent.partnerId)?.age > 45) continue;
        if (this._random() > 0.03) continue;
        let best = null, bestScore = 0;
        for (const town of towns) {
          if (town === band || atWar(this, band, town)) continue;
          const route = linkBetween(this, band, town), distance = Math.sqrt(distance2(band, town));
          if (distance > (route ? 90 : 35)) continue;
          const industrial = town.civilization.buildings.factory || town.civilization.buildings.railway ? 1.4 : 1;
          const pull = perHead(town) * industrial / Math.max(1, home) - 1.5 - distance / 60 + (route ? 0.3 : 0);
          if (pull > bestScore) { bestScore = pull; best = town; }
        }
        if (!best || this._random() > Math.min(0.6, bestScore * 0.25) * (0.5 + agent.psyche.personality.openness)) continue;
        this._joinGroup(agent, best);
        agent._wanderX = best.x; agent._wanderY = best.y;
        const partner = this._agentMap.get(agent.partnerId);
        if (partner && partner.groupId === band.id) { this._joinGroup(partner, best); partner._wanderX = best.x; partner._wanderY = best.y; }
        appraise(this, agent, 'belonging', { text: `Moved to ${best.name} for a better life.` });
        if (best.members.length % 10 === 0) this._event('migration', `${best.name} draws newcomers from the countryside; it now has ${best.members.length} people.`, { groupId: best.id });
      }
    }
  }

  /** Culture evolves monthly; societies weigh expansion on their own schedule. */
  _advanceSocieties() {
    for (const group of this.groups) if (!group.civilization.culture) initializeCulture(this, group);
    advanceCulture(this, (group) => innovationEffects(this, group), {
      onLeader: (leader, group) => {
        recordEpisode(this, leader, { type: 'community', text: `Chosen to lead ${group.name}.`, valence: 0.8, salience: 0.85 });
      },
    });
    for (const group of this.groups) if (this.day % 30 === (group.id + 5) % 30) shareWealth(this, group);
    for (const group of [...this.groups]) {
      if (!group.civilization.culture || this.day % 30 !== (group.id + 11) % 30) continue;
      const split = considerFission(this, group, (site, settlers) => this._foundColony(site, settlers));
      if (split) {
        this._updateCulture(split.offshoot);
        this._event('group', `${group.name} has grown beyond what it can agree on: ${split.instigator.name} leads ${split.settlers.length} people away to found ${split.offshoot.name}.`, { groupId: split.offshoot.id, agentId: split.instigator.id });
        continue;
      }
      const result = considerExpansion(this, group, surroundings(this, group), (site, settlers) => this._foundColony(site, settlers));
      if (!result) continue;
      const { colony, leader, settlers } = result;
      establishKinship(this, group, colony);
      const region = this.regions.reduce((best, candidate) => distance2(candidate, colony) < distance2(best, colony) ? candidate : best, this.regions[0]);
      this._updateCulture(colony);
      this._event('migration', `Pioneers led by ${leader.name} leave ${group.name} to found ${colony.name} near ${region.name} (${settlers.length} people).`, { groupId: colony.id, agentId: leader.id });
    }
  }

  _foundColony(site, settlers) {
    const id = this.nextGroupId++;
    const region = this.regions.reduce((best, candidate) => distance2(candidate, site) < distance2(best, site) ? candidate : best, this.regions[0]);
    const colony = { id, name: `${region.name.split(' ')[0]} ${this._pick(GROUP_WORDS)}`, color: COLORS[(id - 1) % COLORS.length], ...site,
      members: [], food: 0, wood: 0, shelters: 0, culture: 'Kinship', _foundedDay: this.day, _lastMoveDay: this.day, _shortageDays: 0 };
    initializeSociety(colony);
    initializeGroupIdeas(colony);
    this.groups.push(colony); this._groupMap.set(id, colony);
    for (const settler of settlers) this._joinGroup(settler, colony);
    return colony;
  }

  /** Births follow natural fertility after lactational infertility; see src/lifecourse.js. */
  _reproduce(agent) {
    if (!agent.partnerId || agent.id > agent.partnerId || this.config.fertility === 0) return;
    const partner = this._agentMap.get(agent.partnerId);
    if (!partner) return;
    const woman = motherOf(agent, partner);
    if (!woman) return;
    const man = woman === agent ? partner : agent;
    const group = this._groupMap.get(woman.groupId) || this._groupMap.get(man.groupId);
    if (woman.age < 15 || woman.age >= 50 || man.age < 16 || woman.health < 50 || woman.hunger > 45
      || this.day - agent._bondDay < 60 || this.day - woman._lastBirthDay < postpartumDays(group)
      // Couples in the same community share a household even when their days take them apart.
      || (distance2(woman, man) > 64 && (!woman.groupId || woman.groupId !== man.groupId))) return;
    const savings = woman.inventory.food + man.inventory.food + woman.wealth + man.wealth + (group ? group.food / Math.max(1, group.members.length) : 0);
    if (savings < 1 || this._random() > conceptionChance(this, woman, man)) return;
    const position = this._landNear(woman.x, woman.y);
    const child = this._newAgent(position.x, position.y, 0, [woman, man]);
    this.agents.push(child); this._agentMap.set(child.id, child);
    woman.children.push(child.id); man.children.push(child.id);
    // At most 64 child IDs per living parent are retained; no dead-agent archive.
    if (woman.children.length > 64) woman.children.shift();
    if (man.children.length > 64) man.children.shift();
    woman._lastBirthDay = man._lastBirthDay = this.day;
    // A child's starting provisions are transferred from family stores. Shared
    // savings can fund a birth, but reproduction never creates food.
    let provisions = child.inventory.food;
    for (const parent of [woman, man]) {
      const contribution = Math.min(parent.inventory.food, provisions);
      parent.inventory.food -= contribution; provisions -= contribution;
    }
    if (provisions > 0 && group) group.food = Math.max(0, group.food - provisions);
    woman.energy = clamp(woman.energy - 12, 0, 100); woman.health = clamp(woman.health - 4, 0, 100);
    if (group) this._joinGroup(child, group);
    this.births++;
    appraise(this, woman, 'birth', { name: child.name, about: child.id }); appraise(this, man, 'birth', { name: child.name, about: child.id });
    this._event('birth', `${child.name} is born to ${woman.name} and ${man.name} (generation ${child.generation}).`, { agentId: child.id, ...(child.groupId ? { groupId: child.groupId } : {}) });
  }

  _removeDead() {
    const dead = this.agents.filter((a) => a.health <= 0 || a._ageDays >= a._lifespan);
    if (!dead.length) return;
    const ids = new Set(dead.map((a) => a.id));
    const causes = { war: 'war', 'nuclear war': 'a nuclear strike', radiation: 'radiation sickness', plague: 'plague', disaster: 'injuries from a disaster', 'childhood illness': 'a childhood illness', 'old age': 'old age', illness: 'illness', 'an accident': 'an accident', epidemic: 'an epidemic' };
    for (const agent of dead) {
      const group = this._groupMap.get(agent.groupId);
      if (group) {
        group.members = group.members.filter((id) => id !== agent.id);
        group.food += agent.inventory.food; group.wood += agent.inventory.wood;
      }
      bequeath(this, agent, group);
      const partner = this._agentMap.get(agent.partnerId);
      if (partner) { partner.partnerId = null; partner.social = clamp(partner.social - 30, 0, 100); }
      this._agentMap.delete(agent.id); this.deaths++;
      recordDeath(this, agent);
      const reason = causes[agent._deathCause] || (agent._ageDays >= agent._lifespan ? 'old age' : agent.hunger > 70 ? 'hunger' : 'poor health');
      this._event('death', `${agent.name} dies from ${reason}, aged ${Math.floor(agent.age)}.`, { agentId: agent.id, ...(agent.groupId ? { groupId: agent.groupId } : {}) });
    }
    this.agents = this.agents.filter((a) => !ids.has(a.id));
    // Bereavement depends on closeness. Family is mourned whether or not the
    // relationship was among the few a person keeps in mind; friends through bonds.
    for (const person of dead) {
      const family = [[this._agentMap.get(person.partnerId), 'partner', 0.75], ...person.parentIds.map((id) => [this._agentMap.get(id), 'child', person.age < 15 ? 0.9 : 0.8]), ...person.children.map((id) => [this._agentMap.get(id), 'parent', 0.55])];
      for (const [mourner, role, closeness] of family) {
        if (!mourner || ids.has(mourner.id)) continue;
        appraise(this, mourner, 'bereavement', { about: person.id, closeness, text: `${person.name}, my ${role}, died${role === 'child' && person.age < 5 ? ' so young' : ''}.` });
      }
    }
    for (const agent of this.agents) {
      for (const relation of agent._relations) {
        const person = ids.has(relation.id) ? dead.find((a) => a.id === relation.id) : null;
        if (!person || relation.strength <= 0.45 || person.partnerId === agent.id || agent.parentIds.includes(person.id) || person.parentIds.includes(agent.id)) continue;
        appraise(this, agent, 'bereavement', { about: person.id, closeness: 0.2 + relation.strength * 0.2, text: `My friend ${person.name} died.` });
      }
      agent._relations = agent._relations.filter((r) => !ids.has(r.id));
    }
    if (!this.agents.length) this._event('world', 'The final inhabitant has died. The ecosystem continues to grow.');
  }

  step(days = 1) {
    if (!Number.isInteger(days) || days < 0 || days > 100000) throw new Error('Advance must be a whole number of days between 0 and 100,000.');
    if (this.day + days > 1e9) throw new Error('This world has reached its supported time limit.');
    for (let tick = 0; tick < days; tick++) {
      this.day++; this._ecology(); this._buildSpatial();
      // Rotate iteration priority; no fixed individual always harvests first.
      const count = this.agents.length, offset = count ? this.day % count : 0;
      for (let i = 0; i < count; i++) {
        const agent = this.agents[(i + offset) % count], group = this._groupMap.get(agent.groupId);
        agent._ageDays++; agent.age = agent._ageDays / DAYS_PER_YEAR;
        // A night under a roof at home restores some of the day's effort.
        const sheltered = group && group.shelters * 5 >= group.members.length && distance2(agent, group) < 64;
        agent.energy = clamp(agent.energy - 1.8 + (sheltered ? 3 : 0), 0, 100);
        agent.social = clamp(agent.social - (0.35 + agent.traits.sociability * 0.45), 0, 100);
        this._eat(agent, group);
        endureConditions(this, agent, group);
        if (!(agent._courtship && this._court(agent, group)) && !considerCivilization(this, agent, group)) this._act(agent, group);
        observeAction(this, agent);
        this._socialize(agent);
        if (agent.hunger > 65) agent.health -= 0.35 + (agent.hunger - 65) * 0.052;
        else if (agent.hunger < 30 && agent.energy > 25) agent.health += 0.22 + (group ? dietVariety(group) * 0.03 : 0);
        if (agent.energy < 8) agent.health -= 0.3;
        agent.health = clamp(agent.health, 0, 100);
        // Age-specific mortality from the Siler model (see src/lifecourse.js).
        const cause = agent.health > 0 ? mortality(this, agent, group) : null;
        if (cause) { agent.health = 0; agent._deathCause = cause; }
        if (agent._ageDays === 45 * DAYS_PER_YEAR) recordCompletedFertility(this, agent);
        const security = group ? Math.min(100, 45 + group.shelters * 5 / Math.max(1, group.members.length) * 50 + group.food / Math.max(1, group.members.length) * 8) : 38;
        const contentment = (100 - agent.hunger) * 0.29 + agent.health * 0.19 + agent.energy * 0.16 + agent.social * 0.26 + security * 0.1 + moodBalance(agent);
        agent.happiness = clamp(agent.happiness * 0.85 + contentment * 0.15, 0, 100);
        if (this.day % 7 === agent.id % 7) this._considerSociety(agent);
      }
      advanceInnovation(this);
      advanceDiplomacy(this);
      this._removeDead();
      const parents = this.agents.length;
      for (let i = 0; i < parents; i++) this._reproduce(this.agents[i]);
      this._groupLife();
      this._advanceSocieties();
      this.diplomacy.relations = this.diplomacy.relations.filter((relation) => this._groupMap.has(relation.a) && this._groupMap.has(relation.b));
      advanceCivilization(this);
      advanceInfrastructure(this);
      if (this.day % 60 === 0) {
        for (const agent of this.agents) {
          for (const relation of agent._relations) if (this.day - relation.lastSeen > 60) relation.strength *= 0.92;
          agent._relations = agent._relations.filter((r) => r.strength > 0.03 && this._agentMap.has(r.id));
        }
      }
      if (this.day % 12 === 0) this._recordHistory();
    }
    return this;
  }

  configure(changes) {
    if (!changes || typeof changes !== 'object' || Array.isArray(changes)) throw new Error('Settings must be an object.');
    const allowed = {};
    for (const key of Object.keys(changes)) {
      if (!['abundance', 'cooperation', 'fertility'].includes(key)) throw new Error(`${key} cannot be changed in a running world.`);
      allowed[key] = changes[key];
    }
    const next = validateConfig(allowed, this.config);
    const adjusted = Object.keys(allowed).filter((key) => next[key] !== this.config[key]);
    this.config = next;
    if (adjusted.length) this._event('world', `World conditions change: ${adjusted.map((key) => `${key} ${this.config[key].toFixed(2)}×`).join(', ')}.`);
    return this;
  }

  /** Acts of god (see src/acts.js). Regional acts accept `{ region: regionId }`. */
  intervene(kind, options = {}) {
    if (!options || typeof options !== 'object' || Array.isArray(options)) throw new Error('Act options must be an object.');
    performAct(this, kind, options);
    return this;
  }

  _event(type, text, extra = {}) {
    this.events.unshift({ id: this.nextEventId++, day: this.day, type, text, ...extra });
    if (this.events.length > EVENT_LIMIT) this.events.length = EVENT_LIMIT;
  }

  _stats() {
    let food = 0, growth = 0;
    for (const tile of this.tiles) { food += tile.food; growth += growthRate(tile.terrain) * (0.7 + tile.fertility * 0.6); }
    let happiness = 0, age = 0, generation = 0;
    for (const agent of this.agents) {
      food += agent.inventory.food; happiness += agent.happiness; age += agent.age; generation = Math.max(generation, agent.generation);
    }
    const farmPlots = new Map();
    for (const group of this.groups) {
      food += group.food;
      const society = group.civilization, farms = society.buildings.farm;
      if (!farms) continue;
      const radius = farmRadius(group);
      const conversion = 2 * innovationEffects(this, group).food * (society.technologies.includes('irrigation') ? 1.4 : 1) * (society.technologies.includes('engineering') ? 1.35 : 1);
      for (let y = Math.max(0, Math.floor(group.y) - radius); y <= Math.min(this.height - 1, Math.floor(group.y) + radius); y++) {
        for (let x = Math.max(0, Math.floor(group.x) - radius); x <= Math.min(this.width - 1, Math.floor(group.x) + radius); x++) {
          const index = y * this.width + x, tile = this.tiles[index];
          if (tile.terrain === 'water' || tile.terrain === 'mountain') continue;
          farmPlots.set(index, Math.max(farmPlots.get(index) || 0, conversion));
        }
      }
    }
    // Descriptive renewal estimate, never a birth condition. Count overlapping
    // cultivated land once, using the most efficient technology available there.
    for (const [index, conversion] of farmPlots) growth += this.tiles[index].fertility * 0.008 * conversion;
    return { ...civilizationStats(this), ...innovationStats(this), ...diplomacyStats(this), ...infrastructureStats(this), ...psycheStats(this), population: this.agents.length, births: this.births, deaths: this.deaths, arrivals: this.arrivals, groups: this.groups.length, ...vitalStats(this), wealthGini: gini(this.agents.filter((a) => a.age >= 16).map((a) => a.wealth || 0)),
      food, happiness: happiness / (this.agents.length || 1), averageAge: age / (this.agents.length || 1), generation,
      carryingCapacity: Math.round(growth * this.config.abundance * 0.82 / 0.23 * (this.weather.droughtUntil > this.day ? 0.22 : this.weather.rainUntil > this.day ? 1.8 : 1) * (this.weather.winterUntil > this.day ? 0.25 : 1)) };
  }

  _recordHistory() {
    const { population, food, happiness, groups, births, deaths } = this._stats();
    this.history.push({ day: this.day, population, food, happiness, groups, births, deaths });
    // Keep the start and recent detail while progressively thinning older data.
    if (this.history.length > HISTORY_LIMIT) this.history = this.history.filter((_, index) => index === 0 || index >= 360 || index % 2 === 0);
  }

  snapshot() {
    return {
      version: 7, seed: this.seed, day: this.day, width: this.width, height: this.height, config: { ...this.config },
      regions: this.regions.map((region) => ({ ...region })), civilization: structuredClone(this.civilization),
      innovation: structuredClone(this.innovation), diplomacy: structuredClone(this.diplomacy), infrastructure: structuredClone(this.infrastructure), psyche: structuredClone(this.psyche), culture: structuredClone(this.culture), vital: structuredClone(this.vital),
      conditions: activeConditions(this), tiles: this.tiles.map((tile) => ({ ...tile })),
      agents: this.agents.map((agent) => {
        const { id, name, x, y, age, health, hunger, energy, social, happiness, groupId, partnerId, action, generation } = agent;
        return { id, name, x, y, age, health, hunger, energy, social, happiness, sex: agent.sex, attraction: agent.attraction, wealth: agent.wealth, traits: { ...agent.traits }, inventory: { ...agent.inventory },
          groupId, partnerId, parentIds: [...agent.parentIds], children: [...agent.children], action, generation,
          mind: structuredClone(agent.mind), skills: { ...agent.skills }, knowledge: [...agent.knowledge], ideas: [...agent.ideas], convictions: { ...agent.convictions },
          psyche: structuredClone(agent.psyche), relations: agent._relations.map((relation) => ({ ...relation })) };
      }),
      groups: this.groups.map((group) => {
        const { id, name, color, x, y, food, wood, shelters, culture } = group;
        return { id, name, color, x, y, members: [...group.members], food, wood, shelters, culture, civilization: structuredClone(group.civilization) };
      }),
      stats: this._stats(), history: this.history.map((point) => ({ ...point })), events: this.events.map((event) => ({ ...event })),
    };
  }

  /**
   * A lighter observation for the browser. Everyone's position and outward state
   * is included, but a full mind, inner life and relationships only for `detailId`.
   * Generated ideas never change once recorded, so only those after
   * `discoveriesFrom` are sent. Tiles are sent separately (see packTiles).
   */
  view({ detailId = null, discoveriesFrom = 0 } = {}) {
    const { discoveries, ...innovation } = this.innovation;
    return {
      version: 7, seed: this.seed, day: this.day, width: this.width, height: this.height, config: { ...this.config },
      regions: this.regions.map((region) => ({ ...region })), civilization: structuredClone(this.civilization),
      innovation: { ...structuredClone(innovation), discoveriesFrom, discoveries: structuredClone(discoveries.slice(discoveriesFrom)) },
      diplomacy: structuredClone(this.diplomacy), infrastructure: structuredClone(this.infrastructure), psyche: structuredClone(this.psyche), culture: structuredClone(this.culture), vital: structuredClone(this.vital),
      conditions: activeConditions(this),
      agents: this.agents.map((agent) => {
        const { id, name, x, y, age, health, hunger, energy, social, happiness, groupId, partnerId, action, generation } = agent;
        const outward = { id, name, x, y, age, health, hunger, energy, social, happiness, sex: agent.sex, attraction: agent.attraction, wealth: agent.wealth, traits: { ...agent.traits }, inventory: { ...agent.inventory },
          groupId, partnerId, parentIds: [...agent.parentIds], children: [...agent.children], action, generation, knowledge: [...agent.knowledge], convictions: { ...agent.convictions } };
        if (agent.id !== detailId) return { ...outward, lite: true, ideaCount: agent.ideas.length, mind: { role: agent.mind.role }, psyche: { thought: agent.psyche?.thought, expansion: agent.psyche?.expansion } };
        return { ...outward, ideas: [...agent.ideas], mind: structuredClone(agent.mind), skills: { ...agent.skills }, psyche: structuredClone(agent.psyche), relations: agent._relations.map((relation) => ({ ...relation })) };
      }),
      // How many people in each society (0 for none) hold each idea, instead of everyone's list.
      ideaHolders: this.agents.reduce((holders, agent) => {
        const counts = holders[agent.groupId || 0] ||= {};
        for (const id of agent.ideas) counts[id] = (counts[id] || 0) + 1;
        return holders;
      }, {}),
      groups: this.groups.map((group) => {
        const { id, name, color, x, y, food, wood, shelters, culture } = group;
        return { id, name, color, x, y, members: [...group.members], food, wood, shelters, culture, civilization: structuredClone(group.civilization) };
      }),
      stats: this._stats(), history: this.history.map((point) => ({ ...point })), events: this.events.map((event) => ({ ...event })),
    };
  }

  /** Tiles as typed arrays, one per field, cheap to transfer to the page; static fields on request. */
  packTiles(includeStatic = false) {
    const n = this.tiles.length, fields = {};
    for (const key of TILE_FIELDS) {
      const values = new Float32Array(n);
      for (let i = 0; i < n; i++) values[i] = this.tiles[i][key] || 0;
      fields[key] = values;
    }
    if (!includeStatic) return { length: n, fields };
    const terrain = new Uint8Array(n), elevation = new Float32Array(n), fertility = new Float32Array(n);
    for (let i = 0; i < n; i++) { terrain[i] = TERRAIN.indexOf(this.tiles[i].terrain); elevation[i] = this.tiles[i].elevation; fertility[i] = this.tiles[i].fertility; }
    return { length: n, fields, terrain, elevation, fertility };
  }

  serialize() {
    return {
      format: 'common-ground-simulation', version: 7, seed: this.seed, day: this.day, width: this.width, height: this.height,
      config: { ...this.config }, rngState: this.rngState, nextAgentId: this.nextAgentId, nextGroupId: this.nextGroupId, nextEventId: this.nextEventId,
      births: this.births, deaths: this.deaths, arrivals: this.arrivals, weather: { ...this.weather },
      regions: this.regions.map((region) => ({ ...region })), civilization: structuredClone(this.civilization),
      innovation: structuredClone(this.innovation), diplomacy: structuredClone(this.diplomacy), infrastructure: structuredClone(this.infrastructure), psyche: structuredClone(this.psyche), culture: structuredClone(this.culture), vital: structuredClone(this.vital),
      tiles: this.tiles.map((tile) => ({ ...tile })),
      agents: this.agents.map((agent) => ({ ...agent, mind: structuredClone(agent.mind), psyche: structuredClone(agent.psyche), skills: { ...agent.skills }, knowledge: [...agent.knowledge], ideas: [...agent.ideas], convictions: { ...agent.convictions }, traits: { ...agent.traits }, inventory: { ...agent.inventory },
        parentIds: [...agent.parentIds], children: [...agent.children], _relations: agent._relations.map((relation) => ({ ...relation })) })),
      groups: this.groups.map((group) => ({ ...group, civilization: structuredClone(group.civilization), members: [...group.members] })),
      history: this.history.map((point) => ({ ...point })), events: this.events.map((event) => ({ ...event })),
    };
  }

  static deserialize(raw) {
    return restore(raw);
  }
}

// Imported files are untrusted. Copy only known fields, validate every number,
// validate collection IDs, and check graph references before running a save.
function restore(raw) {
  const fail = (field) => { throw new Error(`Invalid world save: ${field}.`); };
  const object = (value, field) => { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(field); return value; };
  const number = (value, field, min = 0, max = Number.MAX_SAFE_INTEGER, integer = false) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isSafeInteger(value))) fail(field);
    return value;
  };
  const text = (value, field, max = 128) => { if (typeof value !== 'string' || !value.length || value.length > max) fail(field); return value; };
  const array = (value, field, max = Number.MAX_SAFE_INTEGER) => { if (!Array.isArray(value) || value.length > max) fail(field); return value; };
  const id = (value, field) => number(value, field, 1, Number.MAX_SAFE_INTEGER - 1, true);
  const optionalId = (value, field) => value === null ? null : id(value, field);
  object(raw, 'root');
  if (raw.format !== 'common-ground-simulation' || ![1, 2, 3, 4, 5, 6, 7].includes(raw.version)) fail('format or version');
  const legacy = raw.version === 1;
  const openWorld = raw.version >= 3;
  const innerLives = raw.version >= 4;
  const materialWorld = raw.version >= 5;
  const lifeCourse = raw.version >= 6;
  const modernWorld = raw.version >= 7;
  const dimensions = Object.entries(WORLD_SIZES).find(([, size]) => size.width === raw.width && size.height === raw.height);
  if (!dimensions || (legacy && dimensions[0] !== 'compact')) fail('world dimensions');
  const sim = Object.create(Simulation.prototype);
  const configuration = object(raw.config, 'configuration');
  if (!legacy && configuration.size !== dimensions[0]) fail('world size mismatch');
  sim.config = validateConfig(legacy ? { ...configuration, size: 'compact' } : configuration);
  sim.seed = text(raw.seed, 'seed');
  if (sim.seed !== sim.config.seed) fail('seed mismatch');
  sim.width = raw.width; sim.height = raw.height;
  sim.day = number(raw.day, 'day', 0, 1e9, true);
  sim.rngState = number(raw.rngState, 'random generator', 1, 0xffffffff, true);
  sim.nextAgentId = id(raw.nextAgentId, 'next agent ID'); sim.nextGroupId = id(raw.nextGroupId, 'next group ID'); sim.nextEventId = id(raw.nextEventId, 'next event ID');
  sim.births = number(raw.births, 'births', 0, 1e12, true); sim.deaths = number(raw.deaths, 'deaths', 0, 1e12, true);
  sim.arrivals = raw.arrivals === undefined ? 0 : number(raw.arrivals, 'arrivals', 0, 1e12, true);
  const weather = object(raw.weather, 'weather');
  sim.weather = { rainUntil: number(weather.rainUntil, 'rain duration', 0, sim.day + 90, true), droughtUntil: number(weather.droughtUntil, 'drought duration', 0, sim.day + 180, true),
    winterUntil: weather.winterUntil === undefined ? 0 : number(weather.winterUntil, 'winter duration', 0, sim.day + WINTER_DAYS, true),
    plagueUntil: weather.plagueUntil === undefined ? 0 : number(weather.plagueUntil, 'plague duration', 0, sim.day + PLAGUE_DAYS, true),
    climate: weather.climate === undefined ? 0 : number(weather.climate, 'climate anomaly', -2, 2) };
  sim.tiles = array(raw.tiles, 'tiles', sim.width * sim.height).map((tile, index) => {
    object(tile, 'tile'); if (!TERRAIN.includes(tile.terrain)) fail('terrain');
    const restored = { terrain: tile.terrain, food: number(tile.food, 'tile food', 0, 1), wood: number(tile.wood, 'tile wood', 0, 1), elevation: number(tile.elevation, 'elevation', 0, 1) };
    if (legacy) {
      const minerals = noise((index % sim.width) / 8, Math.floor(index / sim.width) / 8, hashSeed(sim.seed) + 173);
      restored.fertility = tile.terrain === 'water' ? 0 : tile.terrain === 'grass' ? 0.75 : tile.terrain === 'forest' ? 0.65 : tile.terrain === 'sand' ? 0.25 : 0.12;
      restored.stone = tile.terrain === 'water' ? 0 : clamp((tile.terrain === 'mountain' ? 0.55 : 0.04) + tile.elevation * minerals * 0.5);
      restored.ore = tile.terrain === 'water' ? 0 : clamp((tile.terrain === 'mountain' ? 0.32 : 0.015) + Math.max(0, minerals - 0.5) * (0.7 + tile.elevation));
    } else {
      for (const field of ['fertility', 'stone', 'ore']) restored[field] = number(tile[field], `tile ${field}`, 0, 1);
    }
    restored.soil = openWorld ? number(tile.soil, 'tile soil', 0, 1) : restored.fertility;
    if (materialWorld) for (const key of TILE_RESOURCES) restored[key] = number(tile[key], `tile ${key}`, 0, 1);
    // How much people have dug and built on a tile; absent until they first do.
    if (tile.worked !== undefined) restored.worked = number(tile.worked, 'tile worked', 0, 1);
    if (modernWorld) for (const key of DEPOSITS) restored[key] = number(tile[key], `tile ${key}`, 0, 1);
    return restored;
  });
  if (sim.tiles.length !== sim.width * sim.height || !sim.tiles.some((tile) => tile.terrain !== 'water')) fail('world dimensions or habitable land');
  if (!materialWorld) {
    // Older worlds gain deposits from the same seeded noise used for new worlds.
    const shore = shoreMask(sim);
    for (let i = 0; i < sim.tiles.length; i++) Object.assign(sim.tiles[i], generateResources(sim, i, shore[i]));
  } else if (!modernWorld) {
    // Version 6 worlds gain coal and uranium from the same seeded noise as new worlds.
    for (let i = 0; i < sim.tiles.length; i++) Object.assign(sim.tiles[i], generateDeposits(sim, i));
  }
  const uniqueIds = (values, field, max) => {
    const ids = array(values, field, max).map((value) => id(value, field));
    if (new Set(ids).size !== ids.length) fail(`duplicate ${field}`);
    return ids;
  };
  initializeCivilization(sim);
  initializeInnovation(sim);
  initializeDiplomacy(sim);
  initializeInfrastructure(sim);
  initializeGlobalPsyche(sim);
  initializeGlobalCulture(sim);
  sim._restoreVersion = raw.version;
  sim.agents = array(raw.agents, 'agents').map((a) => {
    object(a, 'agent'); object(a.traits, 'traits'); object(a.inventory, 'inventory');
    const agent = {
      id: id(a.id, 'agent ID'), name: text(a.name, 'agent name', 80), x: number(a.x, 'agent x', 0, sim.width - Number.EPSILON), y: number(a.y, 'agent y', 0, sim.height - Number.EPSILON),
      age: number(a.age, 'age', 0, 120), health: number(a.health, 'health', 0, 100), hunger: number(a.hunger, 'hunger', 0, 100),
      energy: number(a.energy, 'energy', 0, 100), social: number(a.social, 'social need', 0, 100), happiness: number(a.happiness, 'happiness', 0, 100),
      traits: { cooperation: number(a.traits.cooperation, 'cooperation trait', 0, 1), curiosity: number(a.traits.curiosity, 'curiosity trait', 0, 1), sociability: number(a.traits.sociability, 'sociability trait', 0, 1) },
      inventory: { food: number(a.inventory.food, 'inventory food', 0, 5), wood: number(a.inventory.wood, 'inventory wood', 0, 2) },
      groupId: optionalId(a.groupId, 'group ID'), partnerId: optionalId(a.partnerId, 'partner ID'), parentIds: uniqueIds(a.parentIds, 'parents', 2), children: uniqueIds(a.children, 'children', 64),
      action: text(a.action, 'action', 80), generation: number(a.generation, 'generation', 1, 1e8, true),
      _ageDays: number(a._ageDays, 'age days', 0, 120 * DAYS_PER_YEAR, true), _lifespan: number(a._lifespan, 'lifespan', 1, 120 * DAYS_PER_YEAR, true),
      _lastBirthDay: number(a._lastBirthDay, 'birth cooldown', -1000, sim.day, true), _bondDay: number(a._bondDay, 'bond day', -1, sim.day, true),
      _stress: number(a._stress, 'stress', 0, 200), _homeDays: number(a._homeDays, 'home duration', 0, 1e9, true),
      ...(lifeCourse ? { sex: ['female', 'male'].includes(a.sex) ? a.sex : fail('sex'), attraction: ['different', 'same', 'both'].includes(a.attraction) ? a.attraction : fail('attraction'), wealth: number(a.wealth, 'wealth', 0, 1e12) } : { wealth: 0 }),
      _wanderX: number(a._wanderX, 'destination x', 0, sim.width), _wanderY: number(a._wanderY, 'destination y', 0, sim.height),
      _courtship: a._courtship == null ? null : { groupId: id(object(a._courtship, 'courtship').groupId, 'courtship society'), since: number(a._courtship.since, 'courtship start', 0, sim.day, true) },
      _relations: array(a._relations, 'relationships', 12).map((r) => {
        object(r, 'relationship');
        const relation = { id: id(r.id, 'relationship ID'), strength: number(r.strength, 'relationship strength', 0, 1), lastSeen: number(r.lastSeen, 'encounter day', 0, sim.day, true) };
        return innerLives ? restoreRelationExtras(r, relation, fail) : relation;
      }),
    };
    if (agent.x >= sim.width || agent.y >= sim.height || agent.age !== agent._ageDays / DAYS_PER_YEAR || agent._ageDays >= agent._lifespan || agent.health <= 0) fail('living agent');
    if (sim._tile(agent.x, agent.y).terrain === 'water') fail('agent standing in water');
    if (agent.id >= sim.nextAgentId || agent.parentIds.some((value) => value >= agent.id) || agent.children.some((value) => value <= agent.id || value >= sim.nextAgentId)) fail('genealogy or agent sequence');
    if (new Set(agent._relations.map((r) => r.id)).size !== agent._relations.length) fail('duplicate relationships');
    if (a._deathCause !== undefined) {
      if (!['war', 'nuclear war', 'radiation', 'plague', 'disaster', 'childhood illness', 'old age', 'illness', 'an accident', 'epidemic'].includes(a._deathCause)) fail('death cause');
      agent._deathCause = a._deathCause;
    }
    return agent;
  });
  sim._agentMap = new Map(sim.agents.map((agent) => [agent.id, agent]));
  if (sim._agentMap.size !== sim.agents.length) fail('duplicate agent IDs');
  sim.groups = array(raw.groups, 'groups').map((g) => {
    object(g, 'group');
    const color = text(g.color, 'group color', 7); if (!/^#[0-9a-f]{6}$/i.test(color)) fail('group color');
    return { id: id(g.id, 'group ID'), name: text(g.name, 'group name', 80), color,
      x: number(g.x, 'group x', 0, sim.width - 0.001), y: number(g.y, 'group y', 0, sim.height - 0.001), members: uniqueIds(g.members, 'members'),
      food: number(g.food, 'shared food'), wood: number(g.wood, 'shared wood'), shelters: number(g.shelters, 'shelters', 0, Number.MAX_SAFE_INTEGER, true), culture: text(g.culture, 'culture', 80),
      _foundedDay: number(g._foundedDay, 'founding day', 0, sim.day, true), _lastMoveDay: number(g._lastMoveDay, 'migration day', 0, sim.day, true), _shortageDays: number(g._shortageDays, 'shortage duration', 0, sim.day) };
  });
  sim._groupMap = new Map(sim.groups.map((group) => [group.id, group]));
  const membership = new Map(sim.groups.map((group) => [group.id, new Set(group.members)]));
  sim._spatial = new Map();
  if (sim._groupMap.size !== sim.groups.length) fail('duplicate group IDs');
  for (const group of sim.groups) {
    if (group.id >= sim.nextGroupId || !group.members.length || sim._tile(group.x, group.y).terrain === 'water') fail('group sequence or location');
    for (const member of group.members) if (sim._agentMap.get(member)?.groupId !== group.id) fail('group membership');
  }
  for (const agent of sim.agents) {
    if (agent.groupId !== null && !membership.get(agent.groupId)?.has(agent.id)) fail('agent membership');
    if (agent.partnerId !== null && (agent.partnerId === agent.id || sim._agentMap.get(agent.partnerId)?.partnerId !== agent.id)) fail('partnership');
    for (const relation of agent._relations) if (relation.id === agent.id || !sim._agentMap.has(relation.id)) fail('relationship reference');
    if (agent._courtship && agent._courtship.groupId >= sim.nextGroupId) fail('courtship society');
  }
  // Registries precede cognition/messages because those records can reference
  // generated discoveries. Legacy migrations add these without consuming RNG.
  if (openWorld) {
    sim.innovation = restoreInnovation(raw.innovation, sim);
    sim.diplomacy = restoreDiplomacy(raw.diplomacy, sim);
    sim.infrastructure = restoreInfrastructure(raw.infrastructure, sim);
  }
  if (legacy) {
    // New inherited cognition is deterministic, while every saved original field
    // (including the next random state) is preserved during schema migration.
    const savedRngState = sim.rngState;
    for (const agent of sim.agents) initializeMind(sim, agent);
    for (const group of sim.groups) initializeSociety(group);
    sim.rngState = savedRngState;
    sim._makeRegions();
  } else {
    sim.civilization = restoreCivilization(raw.civilization, sim);
    for (let index = 0; index < sim.agents.length; index++) Object.assign(sim.agents[index], restoreMind(raw.agents[index], sim));
    for (let index = 0; index < sim.groups.length; index++) sim.groups[index].civilization = restoreSociety(raw.groups[index], sim);
    sim.regions = array(raw.regions, 'regions', 30).map((region) => {
      object(region, 'region');
      if (!TERRAIN.includes(region.biome) || region.biome === 'water') fail('region biome');
      const restored = { id: id(region.id, 'region ID'), name: text(region.name, 'region name', 80),
        x: number(region.x, 'region x', 0, sim.width - 0.001), y: number(region.y, 'region y', 0, sim.height - 0.001), biome: region.biome };
      if (sim._tile(restored.x, restored.y).terrain !== restored.biome) fail('region terrain');
      return restored;
    });
    if (!sim.regions.length || new Set(sim.regions.map((region) => region.id)).size !== sim.regions.length) fail('region IDs');
  }
  for (let index = 0; index < sim.agents.length; index++) {
    if (openWorld) Object.assign(sim.agents[index], restoreAgentIdeas(raw.agents[index], sim));
    else initializeAgentIdeas(sim.agents[index]);
  }
  for (let index = 0; index < sim.groups.length; index++) {
    if (openWorld) Object.assign(sim.groups[index].civilization, restoreGroupIdeas(raw.groups[index], sim));
    else initializeGroupIdeas(sim.groups[index]);
  }
  if (innerLives) {
    sim.psyche = restoreGlobalPsyche(raw.psyche);
    for (let index = 0; index < sim.agents.length; index++) Object.assign(sim.agents[index], restorePsyche(raw.agents[index], sim));
  } else {
    // Earlier saves gain inner lives deterministically; the saved random state is kept.
    const savedRngState = sim.rngState;
    for (const agent of sim.agents) initializePsyche(sim, agent);
    sim.rngState = savedRngState;
  }
  // Culture follows minds: pre-v5 societies derive their first norms from their members.
  if (materialWorld) {
    sim.culture = restoreGlobalCulture(raw.culture, sim);
    const known = new Set(sim.culture.customs.map((custom) => custom.id));
    // A society saved without culture (for example one created by a tool) stays without it
    // until the next daily pass derives it, exactly as it would have without the save.
    for (let index = 0; index < sim.groups.length; index++) {
      const saved = raw.groups[index].civilization?.culture;
      if (saved !== undefined) sim.groups[index].civilization.culture = restoreCulture(saved, sim, known);
    }
  } else for (const group of sim.groups) initializeCulture(sim, group);
  if (lifeCourse) sim.vital = restoreVital(raw.vital);
  else {
    // Earlier worlds had no sexes or age-specific mortality. Sexes are assigned
    // deterministically (partners as mixed-sex couples), and the old fixed
    // lifespans become a distant biological limit; the random state is untouched.
    initializeVital(sim);
    const hash = (id) => { let h = Math.imul(id ^ 0x9e3779b9, 2654435761) >>> 0; h ^= h >>> 15; return (Math.imul(h, 2246822519) >>> 0) / 4294967296; };
    for (const agent of sim.agents) {
      if (agent.sex) continue;
      const partner = sim._agentMap.get(agent.partnerId);
      agent.sex = partner?.sex ? (partner.sex === 'female' ? 'male' : 'female') : hash(agent.id) < 105 / 205 ? 'male' : 'female';
      agent.attraction = partner ? 'different' : (() => { const roll = hash(agent.id + 7919); return roll < .94 ? 'different' : roll < .97 ? 'same' : 'both'; })();
      agent._lifespan = Math.max(agent._ageDays + 1, maximumLifespanDays(hash(agent.id + 104729)));
    }
  }
  delete sim._restoreVersion;
  if (sim.config.population + sim.births + sim.arrivals - sim.deaths !== sim.agents.length || sim.nextAgentId !== sim.config.population + sim.births + sim.arrivals + 1) fail('population accounting');
  sim.history = array(raw.history, 'history', HISTORY_LIMIT).map((h) => {
    object(h, 'history point');
    return { day: number(h.day, 'history day', 0, sim.day, true), population: number(h.population, 'history population', 0, Number.MAX_SAFE_INTEGER, true),
      food: number(h.food, 'history food', 0, Number.MAX_SAFE_INTEGER), happiness: number(h.happiness, 'history happiness', 0, 100), groups: number(h.groups, 'history groups', 0, Number.MAX_SAFE_INTEGER, true),
      births: number(h.births, 'history births', 0, sim.births, true), deaths: number(h.deaths, 'history deaths', 0, sim.deaths, true) };
  });
  if (!sim.history.length || sim.history.some((h, index) => index && h.day <= sim.history[index - 1].day)) fail('history order');
  sim.events = array(raw.events, 'events', EVENT_LIMIT).map((e) => {
    object(e, 'event'); if (!['birth', 'death', 'group', 'world', 'migration', 'technology', 'industry', 'communication', 'trade', 'invention', 'belief', 'experiment', 'war', 'peace', 'diplomacy'].includes(e.type)) fail('event type');
    const event = { id: id(e.id, 'event ID'), day: number(e.day, 'event day', 0, sim.day, true), type: e.type, text: text(e.text, 'event text', 500) };
    if (e.agentId !== undefined) { event.agentId = id(e.agentId, 'event agent'); if (event.agentId >= sim.nextAgentId) fail('event agent sequence'); }
    if (e.groupId !== undefined) { event.groupId = id(e.groupId, 'event group'); if (event.groupId >= sim.nextGroupId) fail('event group sequence'); }
    if (event.id >= sim.nextEventId) fail('event sequence');
    return event;
  });
  if (sim.events.some((e, index) => index && (e.id >= sim.events[index - 1].id || e.day > sim.events[index - 1].day))) fail('event order');
  return sim;
}
