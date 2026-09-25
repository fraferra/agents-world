import { Simulation } from './simulation.js';

let simulation = null;
let running = true;
let speed = 1;
let lastTime = performance.now();
let lastSnapshot = 0;
let accumulator = 0;
let publishCost = 0;
// What the page already holds, so each update carries only what changed:
// ideas are append-only, the map changes slowly, and full minds are needed
// only for the person being inspected.
let detailId = null;
let sentDiscoveries = 0;
let sentBreakthroughs = 0;
let staticTilesSent = false;
let lastTiles = -Infinity;
let visible = true;
const TILE_INTERVAL = 3000;

function publish({ tiles = false } = {}) {
  const started = performance.now();
  if (simulation) {
    const snapshot = simulation.view({ detailId, discoveriesFrom: sentDiscoveries, breakthroughsFrom: sentBreakthroughs });
    sentDiscoveries = simulation.innovation.discoveries.length;
    sentBreakthroughs = simulation.breakthroughs.list.length;
    let packed = null;
    if (tiles || !staticTilesSent || started - lastTiles > TILE_INTERVAL) {
      packed = simulation.packTiles(!staticTilesSent);
      staticTilesSent = true; lastTiles = started;
    }
    const transfer = packed ? [...Object.values(packed.fields), packed.terrain, packed.elevation, packed.fertility].filter(Boolean).map(array => array.buffer) : [];
    postMessage({ type: 'snapshot', snapshot, tiles: packed, running, speed }, transfer);
  }
  lastSnapshot = performance.now();
  publishCost = lastSnapshot - started;
}

self.onmessage = ({ data: { id, type, payload = {} } }) => {
  try {
    let result = true;
    switch (type) {
      case 'init': {
        const next = payload.state ? Simulation.deserialize(payload.state) : new Simulation(payload.config);
        simulation = next;
        sentDiscoveries = 0; sentBreakthroughs = 0; staticTilesSent = false; detailId = null;
        running = payload.running !== false;
        accumulator = 0;
        lastTime = performance.now();
        publish();
        break;
      }
      case 'running':
        running = !!payload.running;
        accumulator = 0;
        publish();
        break;
      case 'speed':
        if (![1, 5, 20, 100].includes(payload.speed)) throw new Error('Unknown simulation speed.');
        speed = payload.speed;
        publish();
        break;
      case 'step':
        if (!simulation) throw new Error('The world is still loading.');
        running = false;
        accumulator = 0;
        simulation.step(1);
        publish({ tiles: true });
        break;
      case 'configure':
        simulation.configure(payload);
        publish();
        break;
      case 'intervene':
        simulation.intervene(payload.kind, payload.region === undefined || payload.region === null ? {} : { region: payload.region });
        publish({ tiles: true });
        break;
      case 'inspect':
        detailId = Number.isSafeInteger(payload.id) ? payload.id : null;
        publish();
        break;
      case 'visible':
        visible = payload.visible !== false;
        break;
      case 'serialize':
        result = simulation.serialize();
        break;
      case 'validate':
        Simulation.deserialize(payload.state);
        break;
      default:
        throw new Error('Unknown world command.');
    }
    postMessage({ id, ok: true, result });
  } catch (error) {
    postMessage({ id, ok: false, error: error.message });
  }
};

function advance() {
  const now = performance.now();
  const elapsed = Math.min(250, now - lastTime);
  lastTime = now;
  try {
    if (simulation && running) {
      accumulator = Math.min(100, accumulator + elapsed * 0.004 * speed);
      const deadline = performance.now() + 22;
      while (accumulator >= 1 && performance.now() < deadline) {
        simulation.step(1);
        accumulator -= 1;
      }
      // Large populations slow wall-clock playback and observation frequency;
      // the simulation never suppresses births or drops inhabitants to keep up.
      // A hidden tab needs only occasional updates.
      if (now - lastSnapshot > (visible ? Math.max(140, publishCost * 4) : 5000)) publish();
    }
  } catch (error) {
    running = false;
    postMessage({ type: 'fatal', error: `Simulation paused: ${error.message}` });
  }
  setTimeout(advance, 25);
}
advance();
