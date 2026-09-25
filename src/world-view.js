// A small, dependency-free atlas renderer. Simulation coordinates remain in
// tiles; the camera and illustration never change the simulation itself.
import { farmRadius, industry } from './civilization.js';
import { seafaring } from './infrastructure.js';

const TILE = 16;
const OCEAN = '#587c79';
const TAU = Math.PI * 2;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const lerp = (a, b, n) => a + (b - a) * n;

const built = group => Object.values(group.civilization?.buildings || {}).reduce((a, b) => a + b, 0);
const FIELDS = ['energy', 'agriculture', 'information', 'machines', 'transport', 'medicine', 'weapons', 'materials', 'society'];
/** The depth of a society's deepest breakthrough in any field. */
const frontierDepth = group => Math.max(0, ...Object.values(group.mastery || {}));
/**
 * How developed a settlement looks: 0 camp, 1 village, 2 brick town, 3 stone city,
 * 4 industrial town, 5 modern city with electric light, 6 a city of the future
 * built on deep breakthroughs.
 */
function eraOf(group) {
  const civ = group.civilization, b = civ?.buildings;
  if (!b || !built(group)) return 0;
  const powered = industry(group).powered;
  if (frontierDepth(group) >= 7 && (powered || b.factory || b.datacenter)) return 6;
  if ((b.datacenter || b.powerplant || b.reactor) && powered) return 5;
  if (b.factory || b.railway) return 4;
  const tier = civ.culture?.tier || 0;
  if (tier >= 3) return 3;
  if (tier >= 2 || (b.kiln && civ.technologies.includes('brickmaking'))) return 2;
  return 1;
}
/** Radius of the built-up area, in tiles. */
function urbanRadius(group) {
  const era = eraOf(group);
  return era ? 0.9 + Math.sqrt(group.members.length) * 0.32 + era * 0.35 : 0;
}

function withAlpha(color, alpha) {
  const hex = color.replace('#', '');
  const rgb = hex.length === 3 ? [...hex].map(char => char + char).join('') : hex.slice(0, 6);
  return `#${rgb}${alpha}`;
}

function random(x, y, salt = 0) {
  let n = Math.imul((x | 0) + 374761393, 668265263) ^ Math.imul((y | 0) + salt * 1013, 1274126177);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function canvasOf(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function ellipse(ctx, x, y, rx, ry, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fill();
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

export class WorldView {
  constructor(canvas, { onSelect = () => {}, onHover = () => {}, onGround = null } = {}) {
    this.onGround = onGround;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.onSelect = onSelect;
    this.onHover = onHover;
    this.snapshot = null;
    this.overlay = 'natural';
    this.selectedId = null;
    this.followId = null;
    this.hoverId = null;
    this.positions = new Map();
    this.camera = { x: 48, y: 32 };
    this.zoom = 1;
    this.width = 1;
    this.height = 1;
    this.scale = 1;
    this.listeners = [];
    this.pointer = null;
    this.destroyed = false;
    this.previousTime = 0;
    this.overlayKey = '';
    this.lastHoverPoint = null;
    this.canvas.style.touchAction = 'none';
    this.canvas.style.cursor = 'grab';
    if (!this.canvas.getAttribute('aria-label')) {
      this.canvas.setAttribute('aria-label', 'Living world. Drag to explore, scroll to zoom, and select an individual.');
    }
    this.bindEvents();
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(canvas);
    } else {
      this.listen(window, 'resize', () => this.resize());
    }
    this.resize();
    this.frame = requestAnimationFrame(time => this.draw(time));
  }

  listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    this.listeners.push(() => target.removeEventListener(type, handler, options));
  }

  resize() {
    const bounds = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, bounds.width);
    this.height = Math.max(1, bounds.height);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.updateScale();
  }

  updateScale() {
    const width = this.snapshot?.width || 96;
    const height = this.snapshot?.height || 64;
    // A little ocean around the island is part of the atlas, not an empty frame.
    const padding = this.width < 600 ? 12 : 26;
    this.baseScale = Math.max(0.1, Math.min((this.width - padding) / width, (this.height - padding) / height));
    this.scale = this.baseScale * this.zoom;
  }

  setSnapshot(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.tiles)) return;
    const newWorld = !this.snapshot || snapshot.seed !== this.snapshot.seed ||
      snapshot.width !== this.snapshot.width || snapshot.height !== this.snapshot.height ||
      snapshot.day < this.snapshot.day;
    this.snapshot = snapshot;
    // Interventions can change resources without advancing the day.
    this.overlayKey = '';
    this.developmentKey = '';
    this.groups = new Map(snapshot.groups.map(group => [group.id, group]));
    const alive = new Set();
    for (const agent of snapshot.agents) {
      alive.add(agent.id);
      const current = this.positions.get(agent.id);
      if (!current || newWorld) this.positions.set(agent.id, { x: agent.x, y: agent.y });
    }
    for (const id of this.positions.keys()) if (!alive.has(id)) this.positions.delete(id);
    if (this.followId !== null && !alive.has(this.followId)) this.followId = null;
    if (newWorld) {
      this.developmentCanvas = null;
      this.buildTerrain();
      this.resetView();
      this.overlayKey = '';
    }
    if (this.hoverId !== null) {
      const agent = snapshot.agents.find(item => item.id === this.hoverId);
      if (!agent) this.setHovered(null);
    }
  }

  setOverlay(overlay) {
    if (!['natural', 'food', 'societies', 'knowledge', 'industry', 'relations'].includes(overlay)) return;
    this.overlay = overlay;
    this.overlayKey = '';
  }

  setSelected(id) { this.selectedId = id; }

  /** Centres the map on a place, zoomed in close enough to see it. */
  focusOn(x, y, zoom = 6) {
    this.followId = null;
    this.camera.x = x; this.camera.y = y;
    if (this.zoom < zoom) this.zoomBy(zoom / this.zoom);
  }

  setFollow(id) {
    this.followId = id;
    if (id !== null && this.zoom < 1.65) this.zoomBy(1.65 / this.zoom);
  }

  resetView() {
    this.zoom = 1;
    this.camera.x = (this.snapshot?.width || 96) / 2;
    this.camera.y = (this.snapshot?.height || 64) / 2;
    this.followId = null;
    this.updateScale();
  }

  zoomBy(factor) { this.zoomAt(factor, this.width / 2, this.height / 2); }

  zoomAt(factor, x, y) {
    if (!Number.isFinite(factor) || factor <= 0) return;
    const before = this.toWorld(x, y);
    // Zoom in until a tile is about 48 pixels across, whatever the map size.
    this.zoom = clamp(this.zoom * factor, 0.65, Math.max(7, 48 / Math.max(0.01, this.baseScale)));
    this.updateScale();
    const after = this.toWorld(x, y);
    this.camera.x += before.x - after.x;
    this.camera.y += before.y - after.y;
    this.clampCamera();
  }

  toWorld(x, y) {
    return {
      x: (x - this.width / 2) / this.scale + this.camera.x,
      y: (y - this.height / 2) / this.scale + this.camera.y,
    };
  }

  clampCamera() {
    const world = this.snapshot;
    if (!world) return;
    this.camera.x = clamp(this.camera.x, -world.width * 0.1, world.width * 1.1);
    this.camera.y = clamp(this.camera.y, -world.height * 0.1, world.height * 1.1);
  }

  eventPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  nearestAgent(x, y) {
    if (!this.snapshot) return null;
    const world = this.toWorld(x, y);
    let best = null;
    let distance = Math.max(8 / this.scale, 0.6) ** 2;
    for (const agent of this.snapshot.agents) {
      const p = this.positions.get(agent.id) || agent;
      const d = (p.x - world.x) ** 2 + (p.y - world.y) ** 2;
      if (d < distance) { distance = d; best = agent; }
    }
    return best;
  }

  setHovered(agent) {
    const id = agent?.id ?? null;
    if (id !== this.hoverId) {
      this.hoverId = id;
      this.onHover(agent);
    }
    if (!this.pointer) this.canvas.style.cursor = agent ? 'pointer' : 'grab';
  }

  bindEvents() {
    this.listen(this.canvas, 'pointerdown', event => {
      if (event.button !== 0 || this.pointer) return;
      const point = this.eventPoint(event);
      this.pointer = { id: event.pointerId, ...point, startX: point.x, startY: point.y, moved: false };
      this.canvas.setPointerCapture?.(event.pointerId);
      this.canvas.style.cursor = 'grabbing';
    });
    this.listen(this.canvas, 'pointermove', event => {
      const point = this.eventPoint(event);
      this.lastHoverPoint = point;
      if (this.pointer?.id === event.pointerId) {
        const pointer = this.pointer;
        if (Math.hypot(point.x - pointer.startX, point.y - pointer.startY) > 4) pointer.moved = true;
        if (pointer.moved) {
          this.followId = null;
          this.camera.x -= (point.x - pointer.x) / this.scale;
          this.camera.y -= (point.y - pointer.y) / this.scale;
          this.clampCamera();
          this.setHovered(null);
        }
        pointer.x = point.x;
        pointer.y = point.y;
      } else {
        this.setHovered(this.nearestAgent(point.x, point.y));
      }
    });
    const finishPointer = (event, cancelled = false) => {
      if (this.pointer?.id !== event.pointerId) return;
      const pointer = this.pointer;
      this.pointer = null;
      this.canvas.releasePointerCapture?.(event.pointerId);
      if (!pointer.moved && !cancelled) {
        const point = this.eventPoint(event);
        const agent = this.nearestAgent(point.x, point.y);
        // With someone in your charge, a click on open ground is where they should go.
        if (!agent && this.onGround?.(this.toWorld(point.x, point.y))) { this.canvas.style.cursor = 'grab'; return; }
        this.selectedId = agent?.id ?? null;
        this.onSelect(this.selectedId);
        this.setHovered(agent);
      }
      this.canvas.style.cursor = this.hoverId === null ? 'grab' : 'pointer';
    };
    this.listen(this.canvas, 'pointerup', event => finishPointer(event));
    this.listen(this.canvas, 'pointercancel', event => finishPointer(event, true));
    this.listen(this.canvas, 'pointerleave', () => { this.lastHoverPoint = null; this.setHovered(null); });
    this.listen(this.canvas, 'wheel', event => {
      event.preventDefault();
      const point = this.eventPoint(event);
      const delta = event.deltaY * (event.deltaMode === 1 ? 18 : event.deltaMode === 2 ? this.height : 1);
      this.zoomAt(Math.exp(-clamp(delta, -180, 180) * 0.002), point.x, point.y);
    }, { passive: false });
    this.listen(this.canvas, 'dblclick', event => {
      const point = this.eventPoint(event);
      this.zoomAt(1.45, point.x, point.y);
    });
  }

  buildTerrain() {
    const { width, height, tiles } = this.snapshot;
    // Bound memory and initial paint time even on the largest map. Illustration
    // detail scales with the raster; all interactions remain in world units.
    // Each cached layer (terrain, land mask, land use, overlay) is one raster of this size.
    const rasterTile = Math.min(TILE, Math.max(3, Math.floor(Math.sqrt(1600000 / (width * height)))));
    this.rasterTile = rasterTile;
    const canvas = canvasOf(width * rasterTile, height * rasterTile);
    const ctx = canvas.getContext('2d');
    const data = ctx.createImageData(canvas.width, canvas.height);
    const mask = ctx.createImageData(canvas.width, canvas.height);
    const terrainValues = tiles.map(tile => ({
      land: tile.terrain === 'water' ? 0 : 1,
      forest: tile.terrain === 'forest' ? 1 : 0,
      sand: tile.terrain === 'sand' ? 1 : 0,
      mountain: tile.terrain === 'mountain' ? 1 : 0,
      elevation: tile.elevation,
    }));
    const ocean = { land: 0, forest: 0, sand: 0, mountain: 0, elevation: 0 };
    const tileAt = (x, y) => x < 0 || y < 0 || x >= width || y >= height ? ocean : terrainValues[y * width + x];
    for (let py = 0; py < canvas.height; py++) {
      for (let px = 0; px < canvas.width; px++) {
        // Displacement breaks up the regular grid without moving meaningful locations.
        const x = px / rasterTile - 0.5 + Math.sin(py * 0.097) * 0.065;
        const y = py / rasterTile - 0.5 + Math.sin(px * 0.083) * 0.065;
        const ix = Math.floor(x), iy = Math.floor(y);
        const fx = x - ix, fy = y - iy;
        const a = tileAt(ix, iy), b = tileAt(ix + 1, iy);
        const c = tileAt(ix, iy + 1), d = tileAt(ix + 1, iy + 1);
        const sample = key => lerp(lerp(a[key], b[key], fx), lerp(c[key], d[key], fx), fy);
        const land = sample('land');
        const grain = (random(px, py, 1) - 0.5) * 5;
        const broadGrain = (random(Math.floor(px / 12), Math.floor(py / 12), 7) - 0.5) * 2;
        let r = 88, g = 124, blue = 121;
        if (land < 0.44) {
          const shoal = Math.max(0, land - 0.04) / 0.4;
          r += shoal * 29;
          g += shoal * 27;
          blue += shoal * 17;
        } else {
          const coast = clamp((land - 0.44) / 0.24, 0, 1);
          const forest = sample('forest');
          const sand = sample('sand');
          const mountain = sample('mountain');
          const elevation = sample('elevation');
          const luma = (elevation - 0.5) * 10 + Math.sin(x * 0.15 + y * 0.23) * 3;
          r = 171 - forest * 32 + sand * 29 - mountain * 26 + luma;
          g = 182 - forest * 25 + sand * 16 - mountain * 32 + luma;
          blue = 122 - forest * 18 + sand * 15 + mountain * 7 + luma;
          r = lerp(218, r, coast);
          g = lerp(212, g, coast);
          blue = lerp(171, blue, coast);
        }
        const index = (py * canvas.width + px) * 4;
        data.data[index] = r + grain + broadGrain;
        data.data[index + 1] = g + grain + broadGrain;
        data.data[index + 2] = blue + grain + broadGrain;
        data.data[index + 3] = 255;
        mask.data[index] = mask.data[index + 1] = mask.data[index + 2] = 255;
        mask.data[index + 3] = clamp((land - 0.43) / 0.08, 0, 1) * 255;
      }
    }
    ctx.putImageData(data, 0, 0);
    this.landMask = canvasOf(canvas.width, canvas.height);
    this.landMask.getContext('2d').putImageData(mask, 0, 0);

    // Fine marks are fixed to the world so they never shimmer while panning.
    ctx.save();
    ctx.scale(rasterTile / TILE, rasterTile / TILE);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const tile = tiles[y * width + x];
        const rand = random(x, y, 2);
        const px = (x + 0.28 + random(x, y, 5) * 0.44) * TILE;
        const py = (y + 0.3 + random(x, y, 6) * 0.4) * TILE;
        if (tile.terrain === 'water') {
          if (rand < 0.12) {
            ctx.strokeStyle = 'rgba(201,221,208,0.20)';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(px - 4, py);
            ctx.quadraticCurveTo(px, py + 1.5, px + 5, py - 0.3);
            ctx.stroke();
            if (rand < 0.045) {
              ctx.beginPath(); ctx.moveTo(px + 1, py + 3); ctx.lineTo(px + 7, py + 3); ctx.stroke();
            }
          }
        } else if (tile.terrain === 'forest') {
          const count = rand > 0.6 ? 2 : 1;
          for (let i = 0; i < count; i++) {
            const tx = px + (i ? 5 : -1), ty = py + (i ? 4 : 0);
            const size = 3.2 + random(x, y, i + 20) * 2;
            ellipse(ctx, tx + 1.9, ty + size * 0.65, size * 0.95, size * 0.4, 'rgba(63,83,56,.18)');
            ctx.fillStyle = '#6d7650';
            ctx.fillRect(tx - 0.55, ty + 0.5, 1.1, size * 0.8);
            const shade = rand > 0.5 ? '#6f875d' : '#7c925f';
            ellipse(ctx, tx, ty - 1.2, size, size * 0.78, shade);
            ellipse(ctx, tx - size * 0.37, ty - size * 0.47, size * 0.64, size * 0.63, '#8f9f6c');
            ellipse(ctx, tx + size * 0.39, ty - size * 0.11, size * 0.51, size * 0.53, shade);
            ellipse(ctx, tx - size * 0.38, ty - size * 0.64, size * 0.3, size * 0.17, '#a2ae7a');
          }
        } else if (tile.terrain === 'mountain' && rand < 0.69) {
          const size = 4 + rand * 6;
          ellipse(ctx, px + 2, py + 3, size * 0.8, size * 0.35, 'rgba(72,83,64,.17)');
          ctx.fillStyle = '#969b80';
          ctx.beginPath();
          ctx.moveTo(px - size, py + 3);
          ctx.lineTo(px - size * 0.1, py - size * 0.8);
          ctx.lineTo(px + size * 0.6, py + size * 0.4);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#b6b89a';
          ctx.beginPath();
          ctx.moveTo(px - size, py + 3);
          ctx.lineTo(px - size * 0.1, py - size * 0.8);
          ctx.lineTo(px - size * 0.13, py + size * 0.2);
          ctx.closePath(); ctx.fill();
        } else if (tile.terrain === 'grass' && rand < 0.22) {
          ctx.strokeStyle = rand < 0.08 ? 'rgba(227,225,167,.64)' : 'rgba(111,135,82,.40)';
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(px - 2, py + 1); ctx.lineTo(px - 3, py - 1);
          ctx.moveTo(px, py + 1); ctx.lineTo(px + 0.4, py - 2);
          ctx.moveTo(px + 2, py + 1); ctx.lineTo(px + 3, py - 0.5);
          ctx.stroke();
          if (rand < 0.045) ellipse(ctx, px + 0.3, py - 2, 1.1, 1.1, '#d8cf96');
        } else if (tile.terrain === 'sand' && rand < 0.2) {
          ellipse(ctx, px, py, 1.3, 0.8, 'rgba(132,128,94,.3)');
          ellipse(ctx, px + 3, py + 1, 0.8, 0.5, 'rgba(132,128,94,.25)');
        }
      }
    }
    ctx.restore();
    this.terrainCanvas = canvas;
  }

  /**
   * What people have done to the land, redrawn as the map updates: cleared
   * woodland, quarries and mines, fields around farming towns (browner as the
   * soil tires), built-up ground and streets, and smoke over industry.
   */
  buildDevelopment() {
    const { width, height, tiles, groups, tilesVersion = 0, day } = this.snapshot;
    const key = `${tilesVersion}:${Math.floor(day / 30)}:${groups.length}:${groups.reduce((sum, group) => sum + built(group), 0)}`;
    if (key === this.developmentKey && this.developmentCanvas) return;
    this.developmentKey = key;
    const unit = this.rasterTile;
    const canvas = this.developmentCanvas || canvasOf(width * unit, height * unit);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i];
      if (tile.terrain === 'water') continue;
      const tx = i % width, ty = Math.floor(i / width), x = tx * unit, y = ty * unit;
      if (tile.terrain === 'forest' && tile.wood < 0.35) {
        // Felled woodland: open ground with stumps where trees stood.
        ctx.fillStyle = `rgba(176,170,120,${(1 - tile.wood / 0.35) * 0.82})`;
        ctx.fillRect(x, y, unit, unit);
        if (random(tx, ty, 41) < 0.5) { ctx.fillStyle = 'rgba(116,98,70,.7)'; ctx.fillRect(x + unit * 0.3, y + unit * 0.5, Math.max(1, unit * 0.14), Math.max(1, unit * 0.14)); }
      }
      if ((tile.worked || 0) > 0.15) {
        // Quarries, pits and mines.
        const w = Math.min(1, tile.worked);
        ctx.fillStyle = `rgba(120,108,92,${0.25 + w * 0.5})`;
        ctx.beginPath(); ctx.ellipse(x + unit / 2, y + unit / 2, unit * (0.2 + w * 0.3), unit * (0.14 + w * 0.2), 0, 0, TAU); ctx.fill();
      }
    }
    for (const group of groups) {
      const b = group.civilization?.buildings;
      if (!b) continue;
      const urban = urbanRadius(group), era = eraOf(group);
      if (b.farm || b.pasture) {
        // Cultivated land around the town, out to the fields its farms can work.
        const reach = Math.min(farmRadius(group), 2 + Math.sqrt((b.farm || 0) + (b.pasture || 0) * 0.6) * 2.4);
        for (let dy = -Math.ceil(reach); dy <= reach; dy++) for (let dx = -Math.ceil(reach); dx <= reach; dx++) {
          const d = Math.hypot(dx, dy);
          if (d > reach || d < urban) continue;
          const tx = Math.floor(group.x) + dx, ty = Math.floor(group.y) + dy;
          if (tx < 0 || ty < 0 || tx >= width || ty >= height) continue;
          const tile = tiles[ty * width + tx];
          if (tile.terrain === 'water' || tile.terrain === 'mountain') continue;
          const soil = tile.soil ?? tile.fertility, pasture = random(tx, ty, 43) < (b.pasture || 0) / Math.max(1, (b.farm || 0) + (b.pasture || 0));
          const rich = clamp(soil / Math.max(0.2, tile.fertility), 0, 1);
          const [r, g, bl] = pasture ? [150, 176, 110] : [lerp(168, 214, rich), lerp(142, 192, rich), lerp(98, 108, rich)];
          ctx.fillStyle = `rgba(${r | 0},${g | 0},${bl | 0},.78)`;
          ctx.fillRect(tx * unit, ty * unit, unit, unit);
          if (!pasture && unit >= 4) {
            ctx.strokeStyle = 'rgba(120,112,74,.35)'; ctx.lineWidth = 1;
            const across = random(tx, ty, 44) < 0.5;
            ctx.beginPath();
            for (let row = 1; row < 3; row++) {
              if (across) { ctx.moveTo(tx * unit, ty * unit + row * unit / 3); ctx.lineTo(tx * unit + unit, ty * unit + row * unit / 3); }
              else { ctx.moveTo(tx * unit + row * unit / 3, ty * unit); ctx.lineTo(tx * unit + row * unit / 3, ty * unit + unit); }
            }
            ctx.stroke();
          }
        }
      }
      if (urban) {
        // Built-up ground: trodden earth, then cobbles, then stone and asphalt.
        const ground = ['#b9a983', '#b9a983', '#b8a58a', '#aaa596', '#8f8b84', '#85888a', '#9aa6a0'][era];
        const r = urban * unit;
        ctx.fillStyle = withAlpha(ground, 'd9');
        ctx.beginPath(); ctx.ellipse(group.x * unit, group.y * unit, r, r * 0.78, 0, 0, TAU); ctx.fill();
        if (era >= 2 && unit >= 4) {
          ctx.save();
          ctx.beginPath(); ctx.ellipse(group.x * unit, group.y * unit, r, r * 0.78, 0, 0, TAU); ctx.clip();
          ctx.strokeStyle = era >= 4 ? 'rgba(70,70,72,.55)' : 'rgba(140,124,96,.55)'; ctx.lineWidth = Math.max(1, unit * 0.12);
          const step = unit * (era >= 4 ? 1.1 : 1.6);
          ctx.beginPath();
          for (let gx = group.x * unit - r; gx < group.x * unit + r; gx += step) { ctx.moveTo(gx, group.y * unit - r); ctx.lineTo(gx, group.y * unit + r); }
          for (let gy = group.y * unit - r; gy < group.y * unit + r; gy += step) { ctx.moveTo(group.x * unit - r, gy); ctx.lineTo(group.x * unit + r, gy); }
          ctx.stroke();
          ctx.restore();
        }
      }
      this.developAdvanced(ctx, group, unit, urban, width, height, tiles);
      const smog = industry(group).smog;
      if (smog > 0) {
        const r = (5 + smog * 4) * unit;
        const haze = ctx.createRadialGradient(group.x * unit, group.y * unit, r * 0.1, group.x * unit, group.y * unit, r);
        haze.addColorStop(0, `rgba(96,92,86,${0.18 + smog * 0.3})`);
        haze.addColorStop(1, 'rgba(96,92,86,0)');
        ctx.fillStyle = haze;
        ctx.fillRect(group.x * unit - r, group.y * unit - r, r * 2, r * 2);
      }
    }
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(this.landMask, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    this.developmentCanvas = canvas;
  }

  /**
   * What breakthroughs do to the land around a society: ring roads and
   * motorways, solar fields, green belts where farming no longer needs the
   * land, and dead grey woods where advances pollute.
   */
  developAdvanced(ctx, group, unit, urban, width, height, tiles) {
    const m = group.mastery;
    if (!m) return;
    const cx = group.x * unit, cy = group.y * unit, advances = group.civilization?.advances || {};
    const pollution = Math.min(1, advances.pollution || 0);
    if (pollution > 0.3) {
      // Poisoned land: greyed, dying vegetation around the town.
      const r = (urban + 4 + pollution * 5) * unit;
      const blight = ctx.createRadialGradient(cx, cy, urban * unit, cx, cy, r);
      blight.addColorStop(0, `rgba(120,112,96,${0.12 + pollution * 0.25})`); blight.addColorStop(1, 'rgba(120,112,96,0)');
      ctx.fillStyle = blight; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    if (m.agriculture >= 5 && (advances.energy || 0) >= 0.3) {
      // A green belt: land spared by vertical farms and clean power, returning to wood and meadow.
      const r0 = (urban + 1) * unit, r1 = (urban + 4.5) * unit;
      ctx.strokeStyle = 'rgba(88,128,72,.5)'; ctx.lineWidth = r1 - r0;
      ctx.beginPath(); ctx.ellipse(cx, cy, (r0 + r1) / 2, (r0 + r1) / 2 * 0.8, 0, 0, TAU); ctx.stroke();
      if (unit >= 3) for (let k = 0; k < 40; k++) {
        const a = random(group.id, k, 81) * TAU, d = r0 + random(group.id, k, 82) * (r1 - r0);
        ellipse(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, unit * 0.35, unit * 0.3, 'rgba(62,104,58,.55)');
      }
    }
    if (m.energy >= 5) {
      // Solar fields on open ground beyond the town.
      for (let k = 0; k < Math.min(4, m.energy - 3); k++) {
        const a = group.id * 1.7 + k * 1.9, d = (urban + 5 + k * 1.2);
        const tx = Math.floor(group.x + Math.cos(a) * d), ty = Math.floor(group.y + Math.sin(a) * d * 0.8);
        if (tx < 1 || ty < 1 || tx >= width - 2 || ty >= height - 2 || tiles[ty * width + tx]?.terrain === 'water' || tiles[ty * width + tx]?.terrain === 'mountain') continue;
        ctx.fillStyle = 'rgba(58,84,120,.8)'; ctx.fillRect(tx * unit, ty * unit, unit * 2, unit * 1.4);
        if (unit >= 4) { ctx.strokeStyle = 'rgba(200,214,230,.5)'; ctx.lineWidth = 1; for (let r = 1; r < 4; r++) { ctx.beginPath(); ctx.moveTo(tx * unit, ty * unit + r * unit * 0.35); ctx.lineTo(tx * unit + unit * 2, ty * unit + r * unit * 0.35); ctx.stroke(); } }
      }
    }
    if (m.transport >= 4) {
      // A ring road, and at greater depth a second, wider motorway ring with radial spokes.
      const rings = m.transport >= 6 ? [urban + 1.2, urban + 3.2] : [urban + 1.2];
      ctx.strokeStyle = 'rgba(96,98,102,.75)'; ctx.lineWidth = Math.max(1, unit * 0.32);
      for (const r of rings) { ctx.beginPath(); ctx.ellipse(cx, cy, r * unit, r * unit * 0.8, 0, 0, TAU); ctx.stroke(); }
      ctx.lineWidth = Math.max(1, unit * 0.22);
      for (let k = 0; k < (m.transport >= 6 ? 6 : 4); k++) {
        const a = k / (m.transport >= 6 ? 6 : 4) * TAU + group.id;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * urban * 0.6 * unit, cy + Math.sin(a) * urban * 0.6 * unit * 0.8);
        ctx.lineTo(cx + Math.cos(a) * (rings.at(-1) + 2) * unit, cy + Math.sin(a) * (rings.at(-1) + 2) * unit * 0.8); ctx.stroke();
      }
    }
  }

  /**
   * Harbour life: a coastal town's boats working its waters. Fishing craft stay
   * close in; a port's sailing ships or steamships ply farther out. Their number
   * and kind come from the town's fisheries, port and technology.
   */
  drawHarbours(ctx, time) {
    const { width, height, tiles } = this.snapshot;
    this.harbourWaters ||= new Map();
    for (const group of this.snapshot.groups) {
      const civ = group.civilization, b = civ?.buildings;
      if (!b || !civ.technologies.includes('fishing') || !this.visible(group.x, group.y, 16)) continue;
      const key = `${group.id}:${Math.floor(group.x)}:${Math.floor(group.y)}`;
      let waters = this.harbourWaters.get(key);
      if (!waters) {
        waters = [];
        for (let dy = -9; dy <= 9; dy++) for (let dx = -9; dx <= 9; dx++) {
          const x = Math.floor(group.x) + dx, y = Math.floor(group.y) + dy;
          if (x < 0 || y < 0 || x >= width || y >= height || tiles[y * width + x]?.terrain !== 'water') continue;
          waters.push({ x: x + 0.5, y: y + 0.5, d: Math.hypot(dx, dy) });
        }
        waters.sort((a, b) => a.d - b.d);
        this.harbourWaters.set(key, waters);
      }
      if (waters.length < 6) continue;
      const vessel = seafaring(group).kind;
      const fleet = Math.min(7, (b.fishery || 0) + (b.dock || 0) * 2 + 1);
      for (let i = 0; i < fleet; i++) {
        const far = vessel !== 'canoe' && i % 2 === 1;
        const pool = far ? waters.slice(Math.floor(waters.length / 3)) : waters.slice(0, Math.max(6, Math.floor(waters.length / 3)));
        const a = pool[(i * 7 + group.id) % pool.length], c = pool[(i * 13 + group.id * 3 + 5) % pool.length];
        const t = (Math.sin(time / 1000 * (far ? 0.08 : 0.12) + i * 1.7 + group.id) + 1) / 2;
        const x = a.x + (c.x - a.x) * t, y = a.y + (c.y - a.y) * t;
        this.drawVessel(ctx, { groupId: group.id, id: group.id * 31 + i, kind: far ? vessel : 'canoe' }, x, y, time);
      }
    }
  }

  /** Roads and railways between the settlements they join. */
  drawRoutes(ctx) {
    const groups = this.groups;
    for (const link of this.snapshot.infrastructure?.links || []) {
      const a = groups.get(link.a), b = groups.get(link.b);
      if (!a || !b) continue;
      if (Math.max(a.x, b.x) < this.viewport.left - 2 || Math.min(a.x, b.x) > this.viewport.right + 2 ||
          Math.max(a.y, b.y) < this.viewport.top - 2 || Math.min(a.y, b.y) > this.viewport.bottom + 2) continue;
      ctx.save();
      ctx.lineCap = 'round';
      if (link.kind === 'sea' || link.kind === 'air') {
        // Shipping lanes and flight paths arc between ports; a ship or plane plies each one.
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const bend = link.kind === 'air' ? 0.22 : 0.08, cx = mx - (b.y - a.y) * bend, cy = my + (b.x - a.x) * bend;
        ctx.strokeStyle = link.kind === 'air' ? 'rgba(236,240,244,.55)' : 'rgba(214,232,236,.6)';
        ctx.lineWidth = link.kind === 'air' ? 0.08 : 0.12; ctx.setLineDash(link.kind === 'air' ? [0.5, 0.35] : [0.8, 0.5]);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(cx, cy, b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
        const t = ((this.previousTime || 0) / 1000 / (length * (link.kind === 'air' ? 0.05 : 0.25)) + link.a * 0.37) % 1;
        const px = (1 - t) ** 2 * a.x + 2 * (1 - t) * t * cx + t * t * b.x, py = (1 - t) ** 2 * a.y + 2 * (1 - t) * t * cy + t * t * b.y;
        ctx.fillStyle = link.kind === 'air' ? '#f4f6f8' : '#8a6a4a';
        ctx.beginPath(); ctx.ellipse(px, py, link.kind === 'air' ? 0.35 : 0.4, 0.14, Math.atan2(b.y - a.y, b.x - a.x), 0, TAU); ctx.fill();
        ctx.restore();
        continue;
      }
      if (link.kind === 'rail') {
        const length = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = -(b.y - a.y) / length, ny = (b.x - a.x) / length;
        ctx.strokeStyle = 'rgba(92,78,62,.85)'; ctx.lineWidth = 0.14;
        ctx.beginPath();
        for (let t = 0; t <= length; t += 0.55) {
          const x = a.x + (b.x - a.x) * t / length, y = a.y + (b.y - a.y) * t / length;
          ctx.moveTo(x - nx * 0.22, y - ny * 0.22); ctx.lineTo(x + nx * 0.22, y + ny * 0.22);
        }
        ctx.stroke();
        ctx.strokeStyle = '#4b4a4c'; ctx.lineWidth = 0.08;
        for (const side of [-0.12, 0.12]) {
          ctx.beginPath(); ctx.moveTo(a.x + nx * side, a.y + ny * side); ctx.lineTo(b.x + nx * side, b.y + ny * side); ctx.stroke();
        }
      } else {
        ctx.strokeStyle = 'rgba(128,112,82,.55)'; ctx.lineWidth = 0.46;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.strokeStyle = 'rgba(222,208,164,.9)'; ctx.lineWidth = 0.28;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      ctx.restore();
    }
  }

  buildOverlay() {
    const { width, height, tiles, groups, day } = this.snapshot;
    const key = `${this.overlay}:${day}:${groups.length}`;
    if (key === this.overlayKey) return;
    this.overlayKey = key;
    if (this.overlay === 'natural' || this.overlay === 'knowledge') { this.overlayCanvas = null; return; }
    const unit = this.rasterTile;
    const canvas = this.overlayCanvas || canvasOf(width * unit, height * unit);
    if (canvas.width !== width * unit || canvas.height !== height * unit) {
      canvas.width = width * unit;
      canvas.height = height * unit;
    }
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (this.overlay === 'societies') {
      // Countries share one colour across all their member societies.
      const countryColor = new Map();
      for (const country of this.snapshot.polity?.countries || []) for (const id of country.members) countryColor.set(id, country.color);
      for (const group of groups.map(group => countryColor.has(group.id) ? { ...group, color: countryColor.get(group.id) } : group)) {
        // The shaded area is the society's actual territorial claim.
        const radius = (5 + Math.sqrt(group.members.length) * 1.2 + (group.civilization?.culture?.tier || 0) * 2) * unit;
        const gradient = ctx.createRadialGradient(group.x * unit, group.y * unit, radius * 0.1, group.x * unit, group.y * unit, radius);
        gradient.addColorStop(0, withAlpha(group.color, 'a6'));
        gradient.addColorStop(0.65, withAlpha(group.color, '59'));
        gradient.addColorStop(1, withAlpha(group.color, '00'));
        ctx.fillStyle = gradient;
        ctx.fillRect(group.x * unit - radius, group.y * unit - radius, radius * 2, radius * 2);
      }
    } else if (this.overlay === 'industry') {
      for (let i = 0; i < tiles.length; i++) {
        const tile = tiles[i];
        if (tile.terrain === 'water') continue;
        const x = (i % width + 0.5) * unit, y = (Math.floor(i / width) + 0.5) * unit;
        if (tile.fertility > 0.55) {
          ctx.fillStyle = `rgba(230,211,132,${(tile.fertility - 0.4) * 0.35})`;
          ctx.fillRect(x - unit / 2, y - unit / 2, unit, unit);
        }
        // Clay banks, fishing grounds and gem seams, then stone and ore.
        if (tile.clay > 0.45) { ctx.fillStyle = 'rgba(190,120,82,.45)'; ctx.fillRect(x - unit * 0.18, y - unit * 0.18, unit * 0.36, unit * 0.36); }
        if (tile.fish > 0.45) { ctx.strokeStyle = 'rgba(96,142,160,.8)'; ctx.lineWidth = unit * 0.07; ctx.beginPath(); ctx.arc(x, y, unit * 0.22, 0, Math.PI); ctx.stroke(); }
        if (tile.uranium > 0.12) { ctx.fillStyle = '#9fc25a'; ctx.beginPath(); ctx.arc(x, y, unit * (0.12 + tile.uranium * 0.14), 0, Math.PI * 2); ctx.fill(); continue; }
        if (tile.coal > 0.2) { ctx.fillStyle = `rgba(52,50,48,${0.35 + tile.coal * 0.45})`; const c = unit * (0.12 + tile.coal * 0.14); ctx.fillRect(x - c, y - c * 0.6, c * 2, c * 1.2); }
        if (tile.gems > 0.15) { ctx.fillStyle = '#9d7fbf'; const g = unit * (0.14 + tile.gems * 0.14); ctx.beginPath(); ctx.moveTo(x, y - g); ctx.lineTo(x + g * 0.8, y); ctx.lineTo(x, y + g); ctx.lineTo(x - g * 0.8, y); ctx.closePath(); ctx.fill(); continue; }
        if (tile.ore > 0.18 || tile.stone > 0.48) {
          const ore = tile.ore > 0.18;
          ctx.fillStyle = ore ? '#b57750' : '#e2debf';
          const size = unit * (ore ? 0.15 + tile.ore * 0.17 : 0.12);
          ctx.beginPath();
          ctx.moveTo(x, y - size); ctx.lineTo(x + size, y);
          ctx.lineTo(x, y + size); ctx.lineTo(x - size, y); ctx.closePath(); ctx.fill();
        }
      }
    } else {
      for (let i = 0; i < tiles.length; i++) {
        const tile = tiles[i];
        if (tile.terrain === 'water' || tile.food < 0.12) continue;
        const x = (i % width + 0.5) * unit, y = (Math.floor(i / width) + 0.5) * unit;
        ctx.fillStyle = `rgba(239,205,103,${Math.min(0.7, tile.food * 0.68)})`;
        ctx.beginPath();
        ctx.arc(x, y, unit * (0.25 + tile.food * 0.38), 0, TAU);
        ctx.fill();
        if (tile.food > 0.55 && random(i % width, Math.floor(i / width), 31) < 0.11) {
          ellipse(ctx, x - 2, y + 1, 2, 2, '#ead784');
          ellipse(ctx, x + 2, y + 1, 2, 2, '#ead784');
          ellipse(ctx, x, y - 2, 2, 2, '#faf0b5');
        }
      }
    }
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(this.landMask, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    this.overlayCanvas = canvas;
  }

  drawSettlement(ctx, group, time = 0) {
    this.drawIndustry(ctx, group, time);
    this.drawLandmarks(ctx, group, time);
    const era = eraOf(group);
    if (era >= 2) { this.drawTown(ctx, group, era, time); return; }
    const count = clamp(group.shelters || 0, 0, 9);
    if (!count) {
      // A meeting place appears before the first permanent building.
      ellipse(ctx, group.x, group.y, 0.55, 0.26, 'rgba(76,69,43,.19)');
      ctx.strokeStyle = '#8c8160'; ctx.lineWidth = 0.08;
      ctx.beginPath(); ctx.arc(group.x, group.y - 0.08, 0.32, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#d5aa6a';
      ctx.beginPath(); ctx.moveTo(group.x - 0.13, group.y); ctx.lineTo(group.x, group.y - 0.39); ctx.lineTo(group.x + 0.17, group.y); ctx.fill();
      return;
    }
    for (let i = count - 1; i >= 0; i--) {
      const angle = i * 2.39996 + group.id;
      const distance = i === 0 ? 0 : 0.75 + Math.sqrt(i) * 0.65;
      const x = group.x + Math.cos(angle) * distance;
      const y = group.y + Math.sin(angle) * distance * 0.7;
      const tx = Math.floor(x), ty = Math.floor(y);
      if (tx < 0 || ty < 0 || tx >= this.snapshot.width || ty >= this.snapshot.height ||
        this.snapshot.tiles[ty * this.snapshot.width + tx]?.terrain === 'water') continue;
      ctx.strokeStyle = 'rgba(201,188,140,.65)'; ctx.lineWidth = 0.28;
      ctx.beginPath(); ctx.moveTo(group.x, group.y); ctx.lineTo(x, y + 0.3); ctx.stroke();
      ellipse(ctx, x + 0.14, y + 0.29, 0.65, 0.22, 'rgba(59,69,43,.22)');
      ctx.fillStyle = '#dccba0';
      ctx.fillRect(x - 0.41, y - 0.17, 0.78, 0.57);
      ctx.fillStyle = '#b9a77f';
      ctx.fillRect(x + 0.15, y - 0.17, 0.23, 0.57);
      ctx.fillStyle = i % 3 === 0 ? '#8d6950' : '#9d7953';
      ctx.beginPath();
      ctx.moveTo(x - 0.55, y - 0.11); ctx.lineTo(x - 0.03, y - 0.64);
      ctx.lineTo(x + 0.53, y - 0.11); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#b5976b'; ctx.lineWidth = 0.055;
      ctx.beginPath(); ctx.moveTo(x - 0.31, y - 0.25); ctx.lineTo(x + 0.3, y - 0.25); ctx.stroke();
      ctx.fillStyle = '#726c52';
      ctx.fillRect(x - 0.12, y + 0.04, 0.2, 0.36);
      ctx.fillStyle = '#f2d893';
      ctx.fillRect(x - 0.32, y + 0.01, 0.13, 0.14);
      ctx.fillStyle = group.color;
      ctx.fillRect(x + 0.29, y - 0.36, 0.09, 0.28);
    }
  }

  /**
   * The works of a society's breakthroughs, one for each field it has pushed
   * far, drawn as the deepest stage it has reached: wind turbines, then solar
   * towers, then a fusion plant; greenhouses, then vertical farms; a radio
   * mast, a data campus, then a thinking machine; robot works; a spaceport;
   * a research hospital; a military base; a plaza of the commons.
   */
  drawLandmarks(ctx, group, time) {
    const m = group.mastery;
    if (!m) return;
    const inner = urbanRadius(group);
    let slot = 0;
    for (const field of FIELDS) {
      const depth = m[field] || 0;
      if (depth < 3) continue;
      let position = null;
      for (let attempt = 0; attempt < 10 && !position; attempt++) {
        const angle = group.id * 0.9 + slot * 2.2 + attempt * 0.45;
        const radius = inner + 5.4 + (slot % 3) * 1.3 + attempt * 0.2;
        const x = group.x + Math.cos(angle) * radius, y = group.y + Math.sin(angle) * radius * 0.75;
        const tile = this.snapshot.tiles[Math.floor(y) * this.snapshot.width + Math.floor(x)];
        if (tile && tile.terrain !== 'water' && x > 1 && y > 1 && x < this.snapshot.width - 1 && y < this.snapshot.height - 1) position = { x, y };
      }
      slot++;
      if (!position || !this.visible(position.x, position.y, 4)) continue;
      ctx.save(); ctx.translate(position.x, position.y);
      ellipse(ctx, 0.1, 0.45, 1.1, 0.28, 'rgba(59,69,43,.22)');
      this.drawLandmark(ctx, field, depth, time, group);
      ctx.restore();
      if (this.overlay === 'industry' && this.scale > 8) {
        ctx.font = `500 ${9 / this.scale}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillStyle = '#e8f4f4'; ctx.strokeStyle = '#3f5d63'; ctx.lineWidth = 2.4 / this.scale;
        const label = `${field[0].toUpperCase()}${field.slice(1)} · depth ${depth}`;
        ctx.strokeText(label, position.x, position.y + 0.8); ctx.fillText(label, position.x, position.y + 0.8);
      }
    }
  }

  drawLandmark(ctx, field, depth, time, group) {
    const t = time / 1000;
    const glow = (alpha = 1) => `rgba(120,230,245,${alpha * (0.6 + Math.sin(t * 2 + group.id) * 0.3)})`;
    if (field === 'energy') {
      if (depth >= 7) {
        // Fusion plant: a glowing torus under a dome.
        ctx.fillStyle = '#c9d3d8'; ctx.fillRect(-1, -0.3, 2, 0.75);
        ellipse(ctx, 0, -0.35, 0.9, 0.6, '#dde6ea');
        ctx.strokeStyle = glow(); ctx.lineWidth = 0.14; ctx.beginPath(); ctx.ellipse(0, -0.35, 0.55, 0.22, 0, 0, TAU); ctx.stroke();
        return;
      }
      if (depth >= 5) {
        // A solar tower amid its mirrors.
        ctx.fillStyle = '#6d7a86'; ctx.fillRect(-0.08, -1.6, 0.16, 1.9);
        ctx.fillStyle = `rgba(255,230,150,${0.7 + Math.sin(t * 3) * 0.2})`; ctx.beginPath(); ctx.arc(0, -1.65, 0.16, 0, TAU); ctx.fill();
        ctx.fillStyle = '#4c6c8f'; for (let k = 0; k < 6; k++) ctx.fillRect(-1.1 + (k % 3) * 0.8, 0.05 + Math.floor(k / 3) * 0.3, 0.5, 0.16);
        return;
      }
      // Wind turbines, blades turning.
      for (const [ox, oy] of [[-0.7, 0.1], [0.1, -0.1], [0.8, 0.15]]) {
        ctx.strokeStyle = '#e9ecee'; ctx.lineWidth = 0.07;
        ctx.beginPath(); ctx.moveTo(ox, oy + 0.35); ctx.lineTo(ox, oy - 0.9); ctx.stroke();
        for (let k = 0; k < 3; k++) {
          const a = t * 2.4 + ox + k * TAU / 3;
          ctx.beginPath(); ctx.moveTo(ox, oy - 0.9); ctx.lineTo(ox + Math.cos(a) * 0.5, oy - 0.9 + Math.sin(a) * 0.5); ctx.stroke();
        }
      }
      return;
    }
    if (field === 'agriculture') {
      if (depth >= 5) {
        // A vertical farm: a tower banded with green.
        ctx.fillStyle = '#d8e4dc'; ctx.fillRect(-0.4, -2, 0.8, 2.35);
        for (let k = 0; k < 7; k++) { ctx.fillStyle = k % 2 ? '#6ea35c' : '#8dc06f'; ctx.fillRect(-0.4, -1.9 + k * 0.3, 0.8, 0.14); }
        if (depth >= 8) { ellipse(ctx, 1, 0, 0.6, 0.45, 'rgba(170,220,190,.8)'); ellipse(ctx, 1, 0.1, 0.4, 0.18, '#6ea35c'); }
        return;
      }
      // Greenhouses in rows.
      for (let k = 0; k < 3; k++) { ctx.fillStyle = 'rgba(214,236,232,.9)'; ctx.fillRect(-1.1 + k * 0.78, -0.2, 0.62, 0.5); ctx.fillStyle = 'rgba(120,170,110,.7)'; ctx.fillRect(-1.05 + k * 0.78, 0.1, 0.52, 0.15); }
      return;
    }
    if (field === 'information') {
      if (depth >= 7) {
        // A thinking machine: a dark monolith with a living glow.
        ctx.fillStyle = '#1d2327'; ctx.fillRect(-0.45, -2, 0.9, 2.35);
        ctx.fillStyle = glow(); for (let k = 0; k < 5; k++) ctx.fillRect(-0.3, -1.8 + k * 0.42 + (Math.sin(t * 3 + k) + 1) * 0.05, 0.6, 0.05);
        ctx.strokeStyle = glow(0.5); ctx.lineWidth = 0.05; ctx.beginPath(); ctx.arc(0, -1, 1 + (t % 1.5) * 0.4, 0, TAU); ctx.stroke();
        return;
      }
      if (depth >= 5) {
        // A data campus: server halls and a dish.
        ctx.fillStyle = '#b8c2c8'; ctx.fillRect(-1, -0.3, 1.3, 0.7); ctx.fillRect(0.4, -0.1, 0.7, 0.5);
        ctx.fillStyle = '#6fd3e0'; for (let k = 0; k < 5; k++) ctx.fillRect(-0.9 + k * 0.25, -0.15, 0.1, 0.05);
        ctx.strokeStyle = '#e4e8ea'; ctx.lineWidth = 0.08; ctx.beginPath(); ctx.arc(0.75, -0.5, 0.35, Math.PI * 0.9, Math.PI * 1.9); ctx.stroke();
        return;
      }
      // A lattice radio mast with a blinking light.
      ctx.strokeStyle = '#8b8f94'; ctx.lineWidth = 0.05;
      ctx.beginPath(); ctx.moveTo(-0.3, 0.35); ctx.lineTo(0, -1.8); ctx.lineTo(0.3, 0.35); ctx.moveTo(-0.2, -0.3); ctx.lineTo(0.2, -0.3); ctx.moveTo(-0.1, -1); ctx.lineTo(0.1, -1); ctx.stroke();
      if (Math.sin(t * 3) > 0) { ctx.fillStyle = '#e8584a'; ctx.beginPath(); ctx.arc(0, -1.85, 0.08, 0, TAU); ctx.fill(); }
      return;
    }
    if (field === 'machines') {
      // Robot works: a clean, windowless hall with an arm at work; a hex dome for nanofactories.
      ctx.fillStyle = '#c4ccd0'; ctx.fillRect(-1, -0.3, 2, 0.75);
      ctx.fillStyle = '#e28f3a'; ctx.fillRect(-1, -0.3, 2, 0.08);
      const a = Math.sin(t * 1.8 + group.id) * 0.6;
      ctx.strokeStyle = '#e8a23f'; ctx.lineWidth = 0.1; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0.5, -0.3); ctx.lineTo(0.5 + Math.cos(-1.2 + a) * 0.45, -0.3 + Math.sin(-1.2 + a) * 0.45); ctx.lineTo(0.5 + Math.cos(-1.2 + a) * 0.45 + 0.3, -0.3 + Math.sin(-1.2 + a) * 0.45 + 0.1); ctx.stroke(); ctx.lineCap = 'butt';
      if (depth >= 7) { ellipse(ctx, -0.5, -0.4, 0.5, 0.4, 'rgba(200,210,220,.95)'); ctx.strokeStyle = glow(0.7); ctx.lineWidth = 0.04; ctx.beginPath(); ctx.ellipse(-0.5, -0.4, 0.5, 0.4, 0, Math.PI, TAU); ctx.stroke(); }
      return;
    }
    if (field === 'transport') {
      if (depth >= 9) {
        // A space elevator: a tether rising out of sight.
        ctx.strokeStyle = 'rgba(210,235,245,.55)'; ctx.lineWidth = 0.06;
        ctx.beginPath(); ctx.moveTo(0.8, 0.1); ctx.lineTo(0.8, -40); ctx.stroke();
        const climb = ((t * 0.15 + group.id) % 1) * 38;
        ctx.fillStyle = '#e8f2f6'; ctx.fillRect(0.7, -climb - 0.2, 0.2, 0.3);
      }
      if (depth >= 7) {
        // A spaceport: a launch tower and a rocket that lifts off now and then.
        ctx.fillStyle = '#9da3a8'; ctx.fillRect(-1, 0.1, 2, 0.3);
        ctx.strokeStyle = '#b75b3a'; ctx.lineWidth = 0.07; ctx.beginPath(); ctx.moveTo(-0.45, 0.1); ctx.lineTo(-0.45, -1.9); ctx.stroke();
        const cycle = (t + group.id * 3) % 24, lift = cycle > 20 ? (cycle - 20) ** 2 * 1.2 : 0;
        ctx.fillStyle = '#f2f2ee'; ctx.beginPath(); ctx.moveTo(-0.1, 0.1 - lift); ctx.lineTo(-0.1, -1.4 - lift); ctx.lineTo(0, -1.75 - lift); ctx.lineTo(0.1, -1.4 - lift); ctx.lineTo(0.1, 0.1 - lift); ctx.fill();
        if (lift) { ctx.fillStyle = 'rgba(255,190,90,.85)'; ctx.beginPath(); ctx.moveTo(-0.1, 0.1 - lift); ctx.lineTo(0, 0.7 - lift + Math.random() * 0.2); ctx.lineTo(0.1, 0.1 - lift); ctx.fill(); this.drawSmoke(ctx, 0, 0.3, time, 'rgba(230,230,225,', 0.6, group.id); }
        return;
      }
      // A motorway interchange: a cloverleaf.
      ctx.strokeStyle = '#7b7e82'; ctx.lineWidth = 0.14;
      ctx.beginPath(); ctx.moveTo(-1.2, 0); ctx.lineTo(1.2, 0); ctx.moveTo(0, -0.9); ctx.lineTo(0, 0.9); ctx.stroke();
      for (const [ox, oy] of [[-0.35, -0.3], [0.35, -0.3], [-0.35, 0.3], [0.35, 0.3]]) { ctx.beginPath(); ctx.arc(ox, oy, 0.25, 0, TAU); ctx.stroke(); }
      if (depth >= 5) { const k = (t * 0.3 + group.id) % 1; ctx.fillStyle = '#e9ecef'; ctx.fillRect(-1.2 + k * 2.4, -0.07, 0.3, 0.14); }
      return;
    }
    if (field === 'medicine') {
      // A research hospital with a helipad; at depth a biolab dome.
      ctx.fillStyle = '#f0f1ee'; ctx.fillRect(-0.9, -0.9, 1.3, 1.25);
      ctx.fillStyle = '#c94a45'; ctx.fillRect(-0.32, -0.7, 0.16, 0.5); ctx.fillRect(-0.49, -0.53, 0.5, 0.16);
      ctx.fillStyle = '#9fb7c0'; for (let k = 0; k < 3; k++) ctx.fillRect(-0.8 + k * 0.4, 0, 0.25, 0.15);
      if (depth >= 7) ellipse(ctx, 0.8, -0.1, 0.45, 0.4, 'rgba(210,240,220,.9)');
      else { ellipse(ctx, 0.75, 0.1, 0.35, 0.2, '#8d9296'); ctx.fillStyle = '#f0f1ee'; ctx.font = '0.25px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('H', 0.75, 0.18); }
      return;
    }
    if (field === 'weapons') {
      // A military base: hangars, a radar dish, and missiles at depth.
      ctx.fillStyle = '#7d8468'; ctx.fillRect(-1.1, -0.1, 2.2, 0.5);
      ctx.fillStyle = '#5f6552'; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(-0.7 + k * 0.6, 0, 0.26, Math.PI, TAU); ctx.fill(); }
      const a = t * 1.5;
      ctx.strokeStyle = '#d6d9d2'; ctx.lineWidth = 0.06; ctx.beginPath(); ctx.moveTo(0.95, -0.1); ctx.lineTo(0.95, -0.6); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0.95, -0.7, 0.28 * Math.abs(Math.cos(a)), 0.14, 0, 0, TAU); ctx.stroke();
      if (depth >= 6) { ctx.fillStyle = '#d2d5cc'; for (let k = 0; k < 2; k++) ctx.fillRect(-1.05 + k * 0.25, -0.9, 0.1, 0.75); }
      return;
    }
    if (field === 'society') {
      // A civic plaza under a glass dome, with gardens.
      ellipse(ctx, 0, 0.1, 1.1, 0.45, '#cfd8c6');
      ctx.fillStyle = '#ece6d4'; ctx.fillRect(-0.6, -0.5, 1.2, 0.6);
      ellipse(ctx, 0, -0.5, 0.55, 0.42, depth >= 6 ? 'rgba(200,232,238,.9)' : '#c8b88a');
      ctx.fillStyle = group.color; ctx.fillRect(-0.03, -1.2, 0.3, 0.18);
      ctx.strokeStyle = '#6b654f'; ctx.lineWidth = 0.04; ctx.beginPath(); ctx.moveTo(-0.03, -0.9); ctx.lineTo(-0.03, -1.2); ctx.stroke();
      return;
    }
    // Materials: iridescent spires of smart matter, or a modern foundry.
    const hue = (t * 40 + group.id * 30) % 360;
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = depth >= 6 ? `hsla(${(hue + k * 40) % 360},55%,70%,.9)` : '#8f8a86';
      ctx.beginPath(); ctx.moveTo(-0.7 + k * 0.6, 0.35); ctx.lineTo(-0.55 + k * 0.6, -0.6 - k * 0.35); ctx.lineTo(-0.4 + k * 0.6, 0.35); ctx.fill();
    }
  }

  /** A town drawn in the style of its age, one house for about every three people. */
  drawTown(ctx, group, era, time) {
    const count = clamp(Math.max(group.shelters || 0, Math.ceil(group.members.length / 3)), 1, 40);
    const spread = urbanRadius(group) * 0.92;
    const houses = [];
    for (let i = 0; i < count; i++) {
      const angle = i * 2.39996 + group.id;
      const distance = i === 0 ? 0 : spread * Math.sqrt(i / count);
      const x = group.x + Math.cos(angle) * distance, y = group.y + Math.sin(angle) * distance * 0.72;
      const tx = Math.floor(x), ty = Math.floor(y);
      if (tx < 0 || ty < 0 || tx >= this.snapshot.width || ty >= this.snapshot.height || this.snapshot.tiles[ty * this.snapshot.width + tx]?.terrain === 'water') continue;
      houses.push({ x, y, i });
    }
    houses.sort((a, b) => a.y - b.y);
    const lit = era === 5;
    for (const { x, y, i } of houses) {
      const r = random(Math.round(x * 10), Math.round(y * 10), 51);
      ellipse(ctx, x + 0.14, y + 0.3, 0.6, 0.2, 'rgba(59,69,43,.22)');
      if (era === 6) {
        // The city of the future: slender glass spires with rooftop gardens, domes and sky bridges.
        const w = 0.34 + r * 0.2, h = i === 0 ? 4.2 : 1.3 + r * 2.2;
        if (r < 0.18 && i) {
          ellipse(ctx, x, y - 0.1, 0.62, 0.5, 'rgba(190,226,232,.85)');
          ctx.strokeStyle = 'rgba(120,170,180,.9)'; ctx.lineWidth = 0.04; ctx.beginPath(); ctx.ellipse(x, y - 0.1, 0.62, 0.5, 0, Math.PI, TAU); ctx.stroke();
          ellipse(ctx, x, y + 0.05, 0.4, 0.12, 'rgba(92,150,88,.8)');
          continue;
        }
        const glass = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
        glass.addColorStop(0, '#d6eef2'); glass.addColorStop(0.6, '#a9ccd6'); glass.addColorStop(1, '#7fa5b3');
        ctx.fillStyle = glass;
        ctx.beginPath(); ctx.moveTo(x - w / 2, y + 0.3); ctx.lineTo(x - w / 2, y - h + w / 2); ctx.quadraticCurveTo(x, y - h - w * 0.6, x + w / 2, y - h + w / 2); ctx.lineTo(x + w / 2, y + 0.3); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(90,150,90,.9)'; ctx.fillRect(x - w / 2, y - h * 0.55, w, 0.08);
        ctx.fillStyle = 'rgba(140,230,240,.85)';
        for (let wy = y - h + 0.4; wy < y + 0.1; wy += 0.3) if (random(Math.round(x * 30), Math.round(wy * 30), 53) < 0.55) ctx.fillRect(x - w / 2 + 0.06, wy, w - 0.12, 0.05);
        if (i === 0) {
          // A beacon on the central spire.
          ctx.fillStyle = `rgba(150,240,255,${0.55 + Math.sin(time / 400) * 0.35})`;
          ctx.beginPath(); ctx.arc(x, y - h - w * 0.35, 0.12, 0, TAU); ctx.fill();
        } else if (i % 5 === 1) {
          // Sky bridges to the centre.
          ctx.strokeStyle = 'rgba(200,230,236,.55)'; ctx.lineWidth = 0.07;
          ctx.beginPath(); ctx.moveTo(x, y - h * 0.6); ctx.lineTo(group.x, group.y - 2.2); ctx.stroke();
        }
      } else if (era === 5) {
        // Modern towers of steel and glass, windows lit.
        const w = 0.46 + r * 0.24, h = i === 0 ? 2.4 : 0.9 + r * 1.3;
        ctx.fillStyle = r < 0.5 ? '#9aaab6' : '#aeb7bb'; ctx.fillRect(x - w / 2, y - h, w, h + 0.3);
        ctx.fillStyle = '#7d8c97'; ctx.fillRect(x + w / 2 - 0.12, y - h, 0.12, h + 0.3);
        ctx.fillStyle = lit ? 'rgba(248,230,160,.9)' : '#d9e3e8';
        for (let wy = y - h + 0.15; wy < y + 0.1; wy += 0.24) for (let wx = x - w / 2 + 0.08; wx < x + w / 2 - 0.16; wx += 0.14) if (random(Math.round(wx * 50), Math.round(wy * 50), 52) < 0.6) ctx.fillRect(wx, wy, 0.07, 0.1);
      } else if (era === 4) {
        // Industrial rowhouses in dark brick with chimney pots.
        ctx.fillStyle = '#90604b'; ctx.fillRect(x - 0.5, y - 0.3, 1, 0.66);
        ctx.fillStyle = '#4f4b4b'; ctx.beginPath(); ctx.moveTo(x - 0.58, y - 0.26); ctx.lineTo(x - 0.4, y - 0.62); ctx.lineTo(x + 0.4, y - 0.62); ctx.lineTo(x + 0.58, y - 0.26); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#6b4d40'; ctx.fillRect(x + 0.2, y - 0.86, 0.12, 0.3);
        ctx.fillStyle = '#e8d49a'; ctx.fillRect(x - 0.34, y - 0.15, 0.14, 0.16); ctx.fillRect(x + 0.08, y - 0.15, 0.14, 0.16);
        if (i % 4 === 0) this.drawSmoke(ctx, x + 0.26, y - 0.9, time, 'rgba(120,116,110,', 0.5, i);
      } else if (era === 3) {
        // Stone city houses, two and three storeys under slate.
        const h = 0.7 + r * 0.4;
        ctx.fillStyle = '#ddd5c2'; ctx.fillRect(x - 0.45, y - h + 0.35, 0.9, h);
        ctx.fillStyle = '#c3baa5'; ctx.fillRect(x + 0.22, y - h + 0.35, 0.23, h);
        ctx.fillStyle = '#6e7580'; ctx.beginPath(); ctx.moveTo(x - 0.55, y - h + 0.38); ctx.lineTo(x, y - h - 0.12); ctx.lineTo(x + 0.55, y - h + 0.38); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f1dba0'; for (let floor = 0; floor < 2; floor++) { ctx.fillRect(x - 0.3, y - h + 0.5 + floor * 0.3, 0.14, 0.14); ctx.fillRect(x + 0.02, y - h + 0.5 + floor * 0.3, 0.14, 0.14); }
      } else {
        // Brick town houses under red tile.
        ctx.fillStyle = '#c9a07e'; ctx.fillRect(x - 0.42, y - 0.18, 0.84, 0.56);
        ctx.fillStyle = '#b38a6b'; ctx.fillRect(x + 0.18, y - 0.18, 0.24, 0.56);
        ctx.fillStyle = r < 0.5 ? '#a4533f' : '#b3604a'; ctx.beginPath(); ctx.moveTo(x - 0.55, y - 0.12); ctx.lineTo(x - 0.02, y - 0.62); ctx.lineTo(x + 0.53, y - 0.12); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#72594a'; ctx.fillRect(x - 0.1, y + 0.05, 0.19, 0.33);
        ctx.fillStyle = '#f2d893'; ctx.fillRect(x - 0.33, y - 0.02, 0.13, 0.14);
      }
    }
    // The society's banner flies over its centre.
    ctx.strokeStyle = '#6b654f'; ctx.lineWidth = 0.05;
    const pole = era === 6 ? 4.8 : era === 5 ? 3 : 1.6;
    ctx.beginPath(); ctx.moveTo(group.x, group.y - 0.1); ctx.lineTo(group.x, group.y - pole); ctx.stroke();
    ctx.fillStyle = group.color; ctx.fillRect(group.x, group.y - pole, 0.45, 0.26);
  }

  /**
   * War on the map: scorched battlefields that fade over the years after, the
   * line between the principal enemies, and armies marching to the front
   * while a campaign is under way.
   */
  drawWars(ctx, time) {
    const wars = this.snapshot.diplomacy?.wars;
    if (!wars?.length) return;
    const day = this.snapshot.day, year = 120;
    for (const war of wars) {
      const age = war.end === null ? 0 : (day - war.end) / year;
      if (age > 4) continue;
      for (const site of war.sites) {
        if (!this.visible(site.x, site.y, 4)) continue;
        // Scars fade over four years of peace.
        const fade = clamp(1 - age / 4, 0, 1) * clamp(1 - (day - site.day) / (year * 12), 0.3, 1);
        for (let k = 0; k < 5; k++) {
          const ox = (random(Math.round(site.x * 10), k, 71) - 0.5) * 2.2, oy = (random(Math.round(site.y * 10), k, 72) - 0.5) * 1.6;
          ellipse(ctx, site.x + ox, site.y + oy, 0.5 + random(k, site.day, 73) * 0.5, 0.3 + random(k, site.day, 74) * 0.25, `rgba(66,52,40,${0.34 * fade})`);
        }
        // Craters and burnt stumps.
        ctx.fillStyle = `rgba(40,34,30,${0.55 * fade})`;
        for (let k = 0; k < 4; k++) ctx.fillRect(site.x + (random(site.day, k, 75) - 0.5) * 2, site.y + (random(site.day, k, 76) - 0.5) * 1.4, 0.12, 0.26);
      }
      if (war.end !== null) continue;
      const attacker = this.groups.get(war.attacker), defender = this.groups.get(war.defender);
      if (!attacker || !defender) continue;
      const front = war.front;
      if (this.visible(front.x, front.y, 30) || this.visible(attacker.x, attacker.y, 20) || this.visible(defender.x, defender.y, 20)) {
        ctx.strokeStyle = 'rgba(170,58,44,.45)'; ctx.lineWidth = 0.14; ctx.setLineDash([0.5, 0.4]);
        ctx.beginPath(); ctx.moveTo(attacker.x, attacker.y); ctx.lineTo(front.x, front.y); ctx.lineTo(defender.x, defender.y); ctx.stroke();
        ctx.setLineDash([]);
      }
      if (war.phase === 'campaign') {
        // Columns march out from each side toward the front and back.
        for (const [group, sign] of [[attacker, 1], [defender, -1]]) {
          const dx = front.x - group.x, dy = front.y - group.y, length = Math.hypot(dx, dy) || 1;
          for (let k = 0; k < 3; k++) {
            const t = 0.35 + 0.6 * ((Math.sin(time / 1000 * 0.25 + k * 1.3 + group.id) + 1) / 2);
            const x = group.x + dx * t + (-dy / length) * (k - 1) * 0.6, y = group.y + dy * t + (dx / length) * (k - 1) * 0.6;
            if (!this.visible(x, y, 2)) continue;
            ellipse(ctx, x + 0.1, y + 0.2, 0.42, 0.12, 'rgba(40,40,30,.25)');
            ctx.fillStyle = '#4c4a40'; ctx.fillRect(x - 0.34, y - 0.2, 0.68, 0.34);
            ctx.fillStyle = group.color; ctx.fillRect(x - 0.3, y - 0.16, 0.6, 0.12);
            ctx.strokeStyle = '#3c3a33'; ctx.lineWidth = 0.05;
            ctx.beginPath(); ctx.moveTo(x + 0.3 * sign, y - 0.2); ctx.lineTo(x + 0.3 * sign, y - 0.7); ctx.stroke();
            ctx.fillStyle = group.color; ctx.fillRect(x + 0.3 * sign, y - 0.7, 0.28 * sign, 0.18);
          }
        }
      }
      if (!this.visible(front.x, front.y, 3)) continue;
      // Crossed swords over the front, pulsing while armies are in the field.
      const pulse = war.phase === 'campaign' ? 1 + Math.sin(time / 260) * 0.12 : 0.8;
      ctx.save(); ctx.translate(front.x, front.y - 0.4); ctx.scale(pulse, pulse);
      ellipse(ctx, 0, 0, 0.7, 0.7, war.phase === 'campaign' ? 'rgba(178,64,46,.82)' : 'rgba(150,110,90,.7)');
      ctx.strokeStyle = '#f3e7cf'; ctx.lineWidth = 0.1; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-0.38, -0.38); ctx.lineTo(0.38, 0.38); ctx.moveTo(0.38, -0.38); ctx.lineTo(-0.38, 0.38); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-0.2, 0.32); ctx.lineTo(-0.34, 0.18); ctx.moveTo(0.2, 0.32); ctx.lineTo(0.34, 0.18); ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.restore();
      if (this.scale > 5) {
        ctx.font = `600 ${10 / this.scale}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillStyle = '#f7e9d2'; ctx.strokeStyle = 'rgba(90,40,30,.85)'; ctx.lineWidth = 2.6 / this.scale;
        ctx.strokeText(war.name, front.x, front.y + 0.5); ctx.fillText(war.name, front.x, front.y + 0.5);
      }
    }
  }

  /** Someone at sea: a canoe, a sailing ship, a steamship or an aircraft, as their society has. */
  drawVessel(ctx, agent, x, y, time) {
    const kind = agent.kind || seafaring(this.groups.get(agent.groupId)).kind || 'canoe';
    const color = this.groups.get(agent.groupId)?.color || '#e3ce9b';
    const bob = Math.sin(time * 0.004 + agent.id) * 0.04;
    ctx.save();
    ctx.translate(x, y + bob);
    // Ocean-going ships are drawn larger than canoes so they read at a distance.
    if (kind === 'ship' || kind === 'steamship') ctx.scale(1.6, 1.6);
    if (kind === 'aircraft') {
      ctx.fillStyle = '#e8ecef'; ctx.strokeStyle = '#6f7b83'; ctx.lineWidth = 0.05;
      ctx.beginPath(); ctx.moveTo(-0.6, 0); ctx.lineTo(0.6, 0); ctx.lineTo(0.7, -0.08); ctx.lineTo(-0.5, -0.1); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-0.1, -0.05); ctx.lineTo(0.1, -0.5); ctx.lineTo(0.25, -0.05); ctx.moveTo(-0.1, -0.02); ctx.lineTo(0.1, 0.45); ctx.lineTo(0.25, 0); ctx.fill(); ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(230,240,240,.5)';
      ctx.beginPath(); ctx.ellipse(-0.45, 0.12, 0.35, 0.06, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = kind === 'steamship' ? '#4f4b4b' : '#8a6a4a';
      const length = kind === 'canoe' ? 0.45 : 0.7;
      ctx.beginPath(); ctx.moveTo(-length, -0.05); ctx.lineTo(length, -0.05); ctx.lineTo(length * 0.75, 0.12); ctx.lineTo(-length * 0.8, 0.12); ctx.closePath(); ctx.fill();
      if (kind === 'ship') {
        ctx.fillStyle = '#f1ead2'; ctx.beginPath(); ctx.moveTo(0, -0.08); ctx.lineTo(0, -0.75); ctx.lineTo(0.42, -0.12); ctx.closePath(); ctx.fill();
        ctx.fillStyle = color; ctx.fillRect(0, -0.85, 0.2, 0.1);
      } else if (kind === 'steamship') {
        ctx.fillStyle = '#d9d2c2'; ctx.fillRect(-0.35, -0.3, 0.6, 0.25);
        ctx.fillStyle = color; ctx.fillRect(0.05, -0.55, 0.14, 0.26);
        this.drawSmoke(ctx, 0.12, -0.6, time, 'rgba(110,106,100,', 0.4, agent.id);
      } else {
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, -0.16, 0.1, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }

  /** Rising, fading smoke; `tint` is an rgba prefix such as 'rgba(120,116,110,'. */
  drawSmoke(ctx, x, y, time, tint, scale = 1, seed = 0) {
    for (let k = 0; k < 4; k++) {
      const phase = ((time / 1000) * 0.3 + k / 4 + seed * 0.137) % 1;
      const drift = Math.sin(phase * 3 + seed) * 0.25 * scale + phase * 0.5 * scale;
      ctx.fillStyle = `${tint}${(1 - phase) * 0.5})`;
      ctx.beginPath(); ctx.arc(x + drift, y - phase * 1.8 * scale, (0.14 + phase * 0.4) * scale, 0, TAU); ctx.fill();
    }
  }

  drawIndustry(ctx, group, time = 0) {
    const buildings = group.civilization?.buildings;
    if (!buildings) return;
    const kinds = ['farm', 'pasture', 'granary', 'workshop', 'lumbermill', 'kiln', 'forge', 'school', 'clinic', 'fishery', 'loom', 'apothecary', 'market', 'library', 'temple', 'observatory', 'hall', 'dock', 'factory', 'railway', 'hospital', 'powerplant', 'datacenter', 'reactor', 'silo', 'airport'];
    const modern = industry(group), inner = urbanRadius(group);
    if (buildings.walls) {
      // Walls ring the whole settlement.
      ctx.strokeStyle = 'rgba(140,128,104,.85)'; ctx.lineWidth = 0.32; ctx.setLineDash([0.9, 0.35]);
      ctx.beginPath(); ctx.ellipse(group.x, group.y, 7.2, 5.4, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
    let slot = 0;
    for (const kind of kinds) {
      // Several illustrations represent a developed district; exact building
      // counts are available in its society inspector.
      const count = clamp(Math.floor(buildings[kind] || 0), 0, kind === 'farm' || kind === 'pasture' ? 4 : ['temple', 'observatory', 'hall', 'dock', 'library', 'market', 'railway', 'datacenter', 'reactor', 'silo', 'airport'].includes(kind) ? 1 : 3);
      for (let i = 0; i < count; i++, slot++) {
        let position = null;
        for (let attempt = 0; attempt < 12; attempt++) {
          const angle = (slot + attempt * 0.31) * 2.39996 + group.id;
          const radius = Math.max(3.1, inner + 0.9) + Math.sqrt(slot) * 1.12 + attempt * 0.15;
          const x = group.x + Math.cos(angle) * radius;
          const y = group.y + Math.sin(angle) * radius * 0.72;
          if (x < 1.7 || y < 1.7 || x >= this.snapshot.width - 1.7 || y >= this.snapshot.height - 1.7) continue;
          const corners = kind === 'farm' || kind === 'pasture' ? [[-1.4, -0.9], [1.4, -0.9], [-1.4, 0.9], [1.4, 0.9]] : [[0, 0]];
          if (corners.every(([dx, dy]) => this.snapshot.tiles[Math.floor(y + dy) * this.snapshot.width + Math.floor(x + dx)]?.terrain !== 'water')) {
            position = { x, y }; break;
          }
        }
        if (!position) continue;
        const { x, y } = position;
        ctx.strokeStyle = 'rgba(209,194,147,.63)'; ctx.lineWidth = 0.20;
        ctx.beginPath(); ctx.moveTo(group.x, group.y); ctx.lineTo(x, y + 0.35); ctx.stroke();
        ctx.save();
        ctx.translate(x, y);
        if (kind === 'pasture') {
          ctx.fillStyle = '#a9b97c'; ctx.fillRect(-1.5, -0.95, 3, 1.9);
          ctx.strokeStyle = '#8a7652'; ctx.lineWidth = 0.1; ctx.strokeRect(-1.5, -0.95, 3, 1.9);
          for (const [ax, ay] of [[-0.8, -0.3], [0.3, 0.2], [0.9, -0.45]]) ellipse(ctx, ax, ay, 0.22, 0.14, '#f1ead2');
        } else if (['factory', 'railway', 'hospital', 'powerplant', 'datacenter', 'reactor', 'silo', 'airport', 'dock'].includes(kind)) {
          this.drawModern(ctx, kind, modern, time, slot);
        } else if (kind === 'farm') {
          ctx.fillStyle = '#b7ab72'; ctx.fillRect(-1.5, -0.95, 3, 1.9);
          ctx.strokeStyle = '#e3d09a'; ctx.lineWidth = 0.12;
          ctx.strokeRect(-1.5, -0.95, 3, 1.9);
          for (let row = 0; row < 5; row++) {
            ctx.strokeStyle = row % 2 ? '#81945e' : '#99a769'; ctx.lineWidth = 0.21;
            ctx.beginPath(); ctx.moveTo(-1.3, -0.72 + row * 0.35); ctx.lineTo(1.3, -0.72 + row * 0.35); ctx.stroke();
            ctx.strokeStyle = 'rgba(231,219,155,.64)'; ctx.lineWidth = 0.055;
            ctx.beginPath(); ctx.moveTo(-1.3, -0.81 + row * 0.35); ctx.lineTo(1.3, -0.81 + row * 0.35); ctx.stroke();
          }
        } else {
          ellipse(ctx, 0.15, 0.49, 0.93, 0.28, 'rgba(59,69,43,.22)');
          if (kind === 'kiln') {
            ellipse(ctx, 0, -0.05, 0.65, 0.6, '#a78060');
            ctx.fillStyle = '#bc916d'; ctx.fillRect(-0.65, -0.05, 1.3, 0.52);
            ctx.fillStyle = '#735445'; ctx.fillRect(-0.18, 0.12, 0.37, 0.35);
            ctx.fillStyle = '#d6a162'; ctx.fillRect(-0.11, 0.28, 0.23, 0.15);
            ctx.fillStyle = '#8e7658'; ctx.fillRect(-0.15, -0.85, 0.3, 0.42);
          } else if (kind === 'granary') {
            ctx.fillStyle = '#d0bd8b'; ctx.fillRect(-0.53, -0.43, 1.06, 0.86);
            ellipse(ctx, 0, 0.4, 0.53, 0.18, '#b4a77d');
            ctx.strokeStyle = '#948464'; ctx.lineWidth = 0.065;
            for (let stripe = 0; stripe < 4; stripe++) {
              ctx.beginPath(); ctx.moveTo(-0.33 + stripe * 0.22, -0.43); ctx.lineTo(-0.33 + stripe * 0.22, 0.47); ctx.stroke();
            }
            ctx.fillStyle = '#96704f';
            ctx.beginPath(); ctx.moveTo(-0.65, -0.38); ctx.lineTo(0, -0.91); ctx.lineTo(0.65, -0.38); ctx.fill();
          } else {
            ctx.fillStyle = kind === 'clinic' ? '#e4ddbe' : '#d4c49a';
            ctx.fillRect(-0.67, -0.27, 1.34, 0.76);
            ctx.fillStyle = '#b2a47e'; ctx.fillRect(0.39, -0.27, 0.28, 0.76);
            const roofs = { school: '#78877a', forge: '#775f51', fishery: '#6f8f98', loom: '#a68aa8', apothecary: '#7d9a6a', market: '#c28a4f', library: '#5f7392', temple: '#b9a97a', observatory: '#8a8f9e', hall: '#8b5e4c', dock: '#7b6a55' };
            ctx.fillStyle = roofs[kind] || '#a08059';
            ctx.beginPath(); ctx.moveTo(-0.85, -0.21); ctx.lineTo(-0.05, -0.88); ctx.lineTo(0.85, -0.21); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#756b50'; ctx.fillRect(-0.13, 0.10, 0.25, 0.39);
            ctx.fillStyle = kind === 'forge' ? '#e3ad62' : '#f1dba0'; ctx.fillRect(-0.47, -0.04, 0.20, 0.20);
            ctx.fillRect(0.24, -0.04, 0.17, 0.20);
            if (kind === 'forge' || kind === 'workshop') {
              ctx.fillStyle = '#827862'; ctx.fillRect(0.36, -1.03, 0.25, 0.60);
              ctx.fillStyle = '#6b6654'; ctx.fillRect(0.31, -1.06, 0.35, 0.13);
            }
            if (kind === 'school') {
              ctx.strokeStyle = '#706e53'; ctx.lineWidth = 0.06;
              ctx.beginPath(); ctx.moveTo(-0.04, -0.86); ctx.lineTo(-0.04, -1.48); ctx.stroke();
              ctx.fillStyle = group.color; ctx.fillRect(-0.02, -1.44, 0.38, 0.22);
              ctx.fillStyle = '#efe6bb'; ctx.fillRect(-0.23, -0.44, 0.38, 0.23);
              ctx.strokeStyle = '#817b60'; ctx.lineWidth = 0.035;
              ctx.beginPath(); ctx.moveTo(-0.04, -0.44); ctx.lineTo(-0.04, -0.21); ctx.stroke();
            } else if (kind === 'temple' || kind === 'hall') {
              ctx.fillStyle = '#efe7cc';
              for (const px of [-0.5, -0.17, 0.17, 0.5]) ctx.fillRect(px - 0.05, -0.2, 0.1, 0.68);
            } else if (kind === 'observatory') {
              ellipse(ctx, 0, -0.62, 0.36, 0.3, '#c9ccd4');
            } else if (kind === 'market') {
              ctx.fillStyle = '#e9d9a6'; for (let stripe = 0; stripe < 4; stripe++) ctx.fillRect(-0.72 + stripe * 0.38, 0.52, 0.19, 0.16);
            } else if (kind === 'clinic') {
              ctx.fillStyle = '#728d71'; ctx.fillRect(-0.11, -0.58, 0.16, 0.39); ctx.fillRect(-0.23, -0.47, 0.40, 0.15);
            } else if (kind === 'lumbermill') {
              ctx.strokeStyle = '#8e6c4f'; ctx.lineWidth = 0.21;
              for (let log = 0; log < 3; log++) {
                ctx.beginPath(); ctx.moveTo(0.51, 0.08 + log * 0.18); ctx.lineTo(1.22, 0.08 + log * 0.18); ctx.stroke();
                ellipse(ctx, 1.22, 0.08 + log * 0.18, 0.11, 0.11, '#d4b680');
              }
            } else if (kind === 'workshop') {
              ctx.strokeStyle = '#685f4c'; ctx.lineWidth = 0.08;
              ctx.beginPath(); ctx.moveTo(-0.34, -0.39); ctx.lineTo(0.16, -0.58); ctx.moveTo(-0.12, -0.66); ctx.lineTo(0, -0.31); ctx.stroke();
            }
          }
        }
        ctx.restore();
        if (this.overlay === 'industry' && this.scale > 8) {
          ctx.font = `500 ${9 / this.scale}px system-ui, sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'top';
          ctx.fillStyle = '#f4ebcf'; ctx.strokeStyle = '#59694d'; ctx.lineWidth = 2.4 / this.scale;
          const name = kind[0].toUpperCase() + kind.slice(1);
          ctx.strokeText(name, x, y + 0.8); ctx.fillText(name, x, y + 0.8);
        }
      }
    }
  }

  /** Industrial and modern buildings, drawn at the origin of the current transform. */
  drawModern(ctx, kind, modern, time, seed) {
    ellipse(ctx, 0.15, 0.55, 1.2, 0.3, 'rgba(59,69,43,.24)');
    if (kind === 'factory') {
      ctx.fillStyle = '#8a6d5d'; ctx.fillRect(-1, -0.25, 2, 0.8);
      ctx.fillStyle = '#5c5856';
      for (let tooth = 0; tooth < 4; tooth++) { ctx.beginPath(); ctx.moveTo(-1 + tooth * 0.5, -0.25); ctx.lineTo(-1 + tooth * 0.5, -0.65); ctx.lineTo(-0.5 + tooth * 0.5, -0.25); ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = '#9fb6c0'; for (let tooth = 0; tooth < 4; tooth++) ctx.fillRect(-0.98 + tooth * 0.5, -0.62, 0.06, 0.36);
      ctx.fillStyle = '#6b5a52'; ctx.fillRect(0.72, -1.5, 0.2, 1.3);
      ctx.fillStyle = '#e3c27f'; for (let w = 0; w < 4; w++) ctx.fillRect(-0.85 + w * 0.45, 0.05, 0.2, 0.18);
      this.drawSmoke(ctx, 0.82, -1.55, time, 'rgba(92,88,84,', 1, seed);
    } else if (kind === 'railway') {
      ctx.strokeStyle = '#4b4a4c'; ctx.lineWidth = 0.07;
      for (const offset of [0.42, 0.62]) { ctx.beginPath(); ctx.moveTo(-1.4, offset); ctx.lineTo(1.4, offset); ctx.stroke(); }
      ctx.fillStyle = '#b89b78'; ctx.fillRect(-0.8, -0.35, 1.6, 0.65);
      ctx.fillStyle = '#6d6a6e'; ctx.beginPath(); ctx.ellipse(0, -0.35, 0.9, 0.35, 0, Math.PI, TAU); ctx.fill();
      ctx.fillStyle = '#e9dcb0'; ctx.fillRect(-0.12, -0.2, 0.24, 0.3);
      ctx.fillStyle = '#3f3d3e'; ctx.fillRect(0.9, 0.18, 0.5, 0.3); ctx.fillRect(1.25, 0.02, 0.1, 0.18);
      this.drawSmoke(ctx, 1.3, -0.02, time, 'rgba(200,200,196,', 0.6, seed);
    } else if (kind === 'hospital') {
      ctx.fillStyle = '#efebe1'; ctx.fillRect(-0.85, -0.55, 1.7, 1.05);
      ctx.fillStyle = '#d7d1c3'; ctx.fillRect(0.55, -0.55, 0.3, 1.05);
      ctx.fillStyle = '#c0493f'; ctx.fillRect(-0.11, -0.45, 0.22, 0.6); ctx.fillRect(-0.3, -0.26, 0.6, 0.22);
      ctx.fillStyle = '#9fb6c0'; for (let w = 0; w < 3; w++) ctx.fillRect(-0.75 + w * 0.55, 0.22, 0.2, 0.16);
    } else if (kind === 'powerplant') {
      for (const tx of [-0.55, 0.45]) {
        ctx.fillStyle = '#b9b8b0'; ctx.beginPath(); ctx.moveTo(tx - 0.45, 0.5); ctx.quadraticCurveTo(tx - 0.2, -0.3, tx - 0.32, -1.1); ctx.lineTo(tx + 0.32, -1.1); ctx.quadraticCurveTo(tx + 0.2, -0.3, tx + 0.45, 0.5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#9d9c95'; ctx.fillRect(tx + 0.12, -1.1, 0.2, 1.6);
        if (modern.powered) this.drawSmoke(ctx, tx, -1.2, time, modern.smog > 0 ? 'rgba(110,106,100,' : 'rgba(240,240,236,', 1.1, seed + tx);
      }
    } else if (kind === 'datacenter') {
      ctx.fillStyle = '#6f93a8'; ctx.fillRect(-0.8, -0.9, 1.6, 1.4);
      ctx.strokeStyle = 'rgba(214,232,240,.8)'; ctx.lineWidth = 0.04;
      ctx.beginPath(); for (let g = -0.6; g < 0.8; g += 0.3) { ctx.moveTo(g, -0.9); ctx.lineTo(g, 0.5); } for (let g = -0.6; g < 0.5; g += 0.3) { ctx.moveTo(-0.8, g); ctx.lineTo(0.8, g); } ctx.stroke();
      if (modern.powered && Math.floor(time / 500) % 2) { ctx.fillStyle = '#9ef0a0'; ctx.fillRect(0.55, -0.8, 0.1, 0.1); }
    } else if (kind === 'reactor') {
      ctx.fillStyle = '#cfcabe'; ctx.fillRect(-0.7, -0.3, 1.4, 0.8);
      ellipse(ctx, 0, -0.3, 0.7, 0.62, '#dcd8cc');
      ctx.fillStyle = '#b9b8b0'; ctx.fillRect(0.9, -1.2, 0.35, 1.7);
      ctx.fillStyle = '#e4c24a'; ctx.beginPath(); ctx.arc(0, -0.35, 0.16, 0, TAU); ctx.fill();
      if (modern.powered) this.drawSmoke(ctx, 1.07, -1.3, time, 'rgba(244,244,240,', 0.9, seed);
    } else if (kind === 'airport') {
      ctx.fillStyle = '#8f9196'; ctx.save(); ctx.rotate(-0.35); ctx.fillRect(-1.6, -0.12, 3.2, 0.24);
      ctx.strokeStyle = '#f1f1ea'; ctx.lineWidth = 0.04; ctx.setLineDash([0.2, 0.15]); ctx.beginPath(); ctx.moveTo(-1.5, 0); ctx.lineTo(1.5, 0); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
      ctx.fillStyle = '#c9ced3'; ctx.fillRect(-0.5, 0.2, 1, 0.4);
      ctx.fillStyle = '#6f93a8'; ctx.fillRect(-0.45, 0.25, 0.9, 0.12);
      ctx.fillStyle = '#b8bcc0'; ctx.fillRect(0.55, -0.4, 0.14, 0.9); ctx.fillStyle = '#9ef0a0'; ctx.fillRect(0.53, -0.48, 0.18, 0.1);
    } else if (kind === 'dock') {
      // A port: quay, cranes and a moored ship.
      ctx.fillStyle = '#9d8a6a'; ctx.fillRect(-1.2, 0.1, 2.4, 0.3);
      ctx.fillStyle = '#7b6a55'; for (let pile = -1.1; pile < 1.2; pile += 0.4) ctx.fillRect(pile, 0.4, 0.06, 0.2);
      ctx.strokeStyle = '#5c5856'; ctx.lineWidth = 0.07; ctx.beginPath(); ctx.moveTo(-0.7, 0.1); ctx.lineTo(-0.7, -0.9); ctx.lineTo(-0.2, -0.7); ctx.stroke();
      ctx.fillStyle = '#6b5846'; ctx.beginPath(); ctx.moveTo(0.1, 0.55); ctx.lineTo(1.2, 0.55); ctx.lineTo(1.05, 0.75); ctx.lineTo(0.2, 0.75); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f1ead2'; ctx.beginPath(); ctx.moveTo(0.6, 0.52); ctx.lineTo(0.6, -0.1); ctx.lineTo(0.95, 0.5); ctx.closePath(); ctx.fill();
    } else if (kind === 'silo') {
      ellipse(ctx, 0, 0.1, 0.95, 0.5, '#9a9a88');
      ellipse(ctx, 0, 0.05, 0.55, 0.3, '#5e5e56');
      ellipse(ctx, 0, 0.05, 0.3, 0.16, '#3d3d38');
      ctx.strokeStyle = '#c9b44a'; ctx.lineWidth = 0.06; ctx.beginPath(); ctx.ellipse(0, 0.1, 0.8, 0.42, 0, 0, TAU); ctx.stroke();
    }
  }

  visible(x, y, padding = 0) {
    const view = this.viewport;
    return !view || (x >= view.left - padding && x <= view.right + padding && y >= view.top - padding && y <= view.bottom + padding);
  }

  drawCachedLayer(ctx, canvas) {
    const { width, height } = this.snapshot;
    const x = clamp(this.viewport.left, 0, width), y = clamp(this.viewport.top, 0, height);
    const w = clamp(this.viewport.right, 0, width) - x, h = clamp(this.viewport.bottom, 0, height) - y;
    if (w <= 0 || h <= 0) return;
    ctx.drawImage(canvas, x * this.rasterTile, y * this.rasterTile, w * this.rasterTile, h * this.rasterTile, x, y, w, h);
  }

  drawRegionLabels(ctx) {
    if (this.zoom > 4) return;
    const drawn = [];
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const region of this.snapshot.regions || []) {
      if (!this.visible(region.x, region.y, 12)) continue;
      const size = this.width < 600 ? 8 : 10;
      const y = region.y - 2;
      ctx.font = `italic 500 ${size / this.scale}px Georgia, serif`;
      const label = region.name;
      const w = ctx.measureText(label).width;
      const box = { left: region.x - w / 2, right: region.x + w / 2, top: y - 12 / this.scale, bottom: y + 15 / this.scale };
      if (drawn.some(other => box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top)) continue;
      if (this.snapshot.groups.some(group => Math.abs(region.x - group.x) < w / 2 + 4 && Math.abs(y - group.y) < 7)) continue;
      drawn.push(box);
      ctx.strokeStyle = 'rgba(197,203,162,.75)'; ctx.lineWidth = 2.5 / this.scale;
      ctx.fillStyle = 'rgba(55,76,59,.82)';
      ctx.strokeText(label, region.x, y); ctx.fillText(label, region.x, y);
      if (this.width >= 600 && region.biome) {
        ctx.font = `${7 / this.scale}px system-ui, sans-serif`;
        ctx.fillStyle = 'rgba(63,83,64,.72)';
        ctx.fillText(region.biome.toUpperCase(), region.x, y + 10 / this.scale);
      }
    }
  }

  drawCommunication(ctx, time) {
    const messages = this.snapshot.civilization?.messages || [];
    const pairs = new Set();
    ctx.save();
    for (const message of messages) {
      const age = this.snapshot.day - message.day;
      if (age < 0 || age > 45) continue;
      const from = this.positions.get(message.speakerId), to = this.positions.get(message.listenerId);
      if (!from || !to || message.speakerId === message.listenerId) continue;
      const pair = [message.speakerId, message.listenerId].sort((a, b) => a - b).join(':');
      if (pairs.has(pair)) continue;
      pairs.add(pair);
      if (Math.max(from.x, to.x) < this.viewport.left || Math.min(from.x, to.x) > this.viewport.right ||
          Math.max(from.y, to.y) < this.viewport.top || Math.min(from.y, to.y) > this.viewport.bottom) continue;
      const informative = ['idea', 'teaching', 'invention', 'belief'].includes(message.kind);
      ctx.globalAlpha = (informative ? 0.86 : 0.47) * (1 - age / 60);
      ctx.strokeStyle = ['idea', 'invention'].includes(message.kind) ? '#ffe3a1' : message.kind === 'belief' ? '#d8cbea' : message.kind === 'teaching' ? '#def6d6' : '#d5e0c3';
      ctx.fillStyle = ctx.strokeStyle;
      ctx.lineWidth = (informative ? 1.6 : 0.9) / this.scale;
      ctx.setLineDash(informative ? [] : [3 / this.scale, 4 / this.scale]);
      ctx.beginPath(); ctx.moveTo(from.x, from.y - 0.3); ctx.lineTo(to.x, to.y - 0.3); ctx.stroke();
      if (informative) {
        const phase = (time / 2400 + (message.speakerId % 11) / 11) % 1;
        const x = lerp(from.x, to.x, phase), y = lerp(from.y, to.y, phase) - 0.3;
        ellipse(ctx, x, y, 2.1 / this.scale, 2.1 / this.scale, ctx.fillStyle);
      }
    }
    ctx.restore();
  }

  drawRelations(ctx) {
    const groups = new Map(this.snapshot.groups.map(group => [group.id, group]));
    const colors = { neutral: '#dfdfcc', trade: '#f4d18e', alliance: '#b6e5bc', war: '#e69978', truce: '#bedee3', tributary: '#c7a5dd' };
    ctx.save();
    for (const relation of this.snapshot.diplomacy?.relations || []) {
      const a = groups.get(relation.a), b = groups.get(relation.b);
      if (!a || !b || a === b) continue;
      if (Math.max(a.x, b.x) < this.viewport.left || Math.min(a.x, b.x) > this.viewport.right ||
          Math.max(a.y, b.y) < this.viewport.top || Math.min(a.y, b.y) > this.viewport.bottom) continue;
      ctx.strokeStyle = colors[relation.status] || colors.neutral;
      ctx.globalAlpha = relation.status === 'neutral' ? .38 : .9;
      ctx.lineWidth = (relation.status === 'war' ? 2.4 : 1.7) / this.scale;
      ctx.setLineDash(['neutral', 'truce'].includes(relation.status) ? [4 / this.scale, 5 / this.scale] : relation.status === 'trade' ? [8 / this.scale, 4 / this.scale] : []);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      if (this.zoom > 1.5 && relation.status !== 'neutral') {
        const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
        ctx.font = `600 ${8 / this.scale}px system-ui, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.setLineDash([]); ctx.lineWidth = 3 / this.scale;
        ctx.strokeStyle = '#5c7155'; ctx.fillStyle = colors[relation.status] || colors.neutral;
        ctx.strokeText(relation.status.toUpperCase(), x, y); ctx.fillText(relation.status.toUpperCase(), x, y);
      }
    }
    ctx.restore();
  }

  drawBeliefs(ctx) {
    const ideas = new Map((this.snapshot.innovation?.discoveries || []).map(idea => [idea.id, idea]));
    ctx.save();
    for (const group of this.snapshot.groups) {
      const belief = ideas.get(group.civilization?.doctrine);
      if (belief?.kind !== 'belief' || !this.visible(group.x, group.y, 8)) continue;
      const x = group.x, y = group.y - 1.4 - 8 / this.scale;
      const size = 5 / this.scale;
      const hue = (Number(belief.id.replace('idea-', '')) * 137.508) % 360;
      ctx.fillStyle = `hsl(${hue} 32% 78%)`;
      ctx.strokeStyle = '#657259'; ctx.lineWidth = 1.1 / this.scale;
      ctx.beginPath(); ctx.moveTo(x, y - size); ctx.lineTo(x + size, y); ctx.lineTo(x, y + size); ctx.lineTo(x - size, y); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (this.zoom > 2.5) {
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.font = `500 ${8 / this.scale}px system-ui, sans-serif`;
        const label = belief.name.length > 34 ? `${belief.name.slice(0, 32)}…` : belief.name;
        ctx.lineWidth = 2.8 / this.scale; ctx.strokeStyle = '#607452'; ctx.fillStyle = '#f1ecdb';
        ctx.strokeText(label, x, y - size - 3 / this.scale); ctx.fillText(label, x, y - size - 3 / this.scale);
      }
    }
    ctx.restore();
  }

  drawAgent(ctx, agent, position, time) {
    const x = position.x, y = position.y;
    if (agent.afloat) { this.drawVessel(ctx, agent, x, y, time); return; }
    const moving = Math.abs(agent.x - x) + Math.abs(agent.y - y) > 0.07;
    const bob = moving ? Math.sin(time * 0.015 + agent.id) * 0.025 : 0;
    const child = agent.age < 16;
    const size = child ? 0.76 : 1;
    const color = this.groups.get(agent.groupId)?.color || '#e3ce9b';
    const selected = agent.id === this.selectedId;
    const hovered = agent.id === this.hoverId;
    if (selected || hovered) {
      const radius = Math.max(0.64, (selected ? 8 : 6) / this.scale);
      ctx.strokeStyle = selected ? '#fff8d9' : 'rgba(255,250,230,.8)';
      ctx.lineWidth = (selected ? 1.75 : 1) / this.scale;
      ctx.beginPath(); ctx.arc(x, y - 0.13, radius, 0, TAU); ctx.stroke();
      if (selected) {
        ctx.strokeStyle = 'rgba(39,54,44,.34)';
        ctx.lineWidth = 1 / this.scale;
        ctx.beginPath(); ctx.arc(x, y - 0.13, radius + 2 / this.scale, 0, TAU); ctx.stroke();
      }
    }
    ctx.save();
    ctx.translate(x, y + bob);
    // A minimum size preserves individual citizens on narrow displays.
    const legibility = Math.max(1, 5.5 / this.scale);
    ctx.scale(size * legibility, size * legibility);
    ellipse(ctx, 0.045, 0.17, 0.25, 0.10, 'rgba(45,59,47,.27)');
    ctx.strokeStyle = '#414f46'; ctx.lineWidth = 0.09;
    const stride = moving ? Math.sin(time * 0.012 + agent.id) * 0.08 : 0;
    ctx.beginPath();
    ctx.moveTo(-0.075, 0.04); ctx.lineTo(-0.09 - stride, 0.22);
    ctx.moveTo(0.07, 0.04); ctx.lineTo(0.08 + stride, 0.22); ctx.stroke();
    ctx.strokeStyle = 'rgba(44,56,43,.35)'; ctx.lineWidth = 0.055;
    ctx.fillStyle = color;
    roundedRect(ctx, -0.19, -0.27, 0.38, 0.38, 0.13); ctx.fill(); ctx.stroke();
    const skin = ['#e8c697', '#c79d70', '#a87854', '#f0d3a8'][agent.id % 4];
    ellipse(ctx, 0, -0.36, 0.14, 0.15, skin);
    ctx.fillStyle = ['#696348', '#564d3e', '#8a7150'][agent.id % 3];
    ctx.beginPath(); ctx.arc(0, -0.41, 0.135, Math.PI, TAU); ctx.fill();
    if (agent.inventory.food > 2) ellipse(ctx, 0.2, -0.02, 0.07, 0.1, '#c5a476');
    ctx.restore();
  }

  /** Country names across their lands, legible when zoomed out. */
  drawCountryLabels(ctx) {
    if (this.scale > 7) return;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const country of this.snapshot.polity?.countries || []) {
      const members = country.members.map(id => this.groups.get(id)).filter(Boolean);
      if (!members.length) continue;
      const x = members.reduce((sum, group) => sum + group.x, 0) / members.length, y = members.reduce((sum, group) => sum + group.y, 0) / members.length - 6;
      if (!this.visible(x, y, 40)) continue;
      ctx.font = `italic 600 ${15 / this.scale}px "DM Serif Display", Georgia, serif`;
      ctx.lineWidth = 3 / this.scale; ctx.strokeStyle = 'rgba(251,247,231,.75)'; ctx.fillStyle = withAlpha(country.color, 'dd');
      const text = country.name.toUpperCase().split('').join(' ');
      ctx.strokeText(text, x, y); ctx.fillText(text, x, y);
    }
    ctx.restore();
  }

  drawGroupLabels(ctx) {
    const { groups } = this.snapshot;
    const scale = this.scale;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const drawn = [];
    for (const group of [...groups].sort((a, b) => b.members.length - a.members.length)) {
      if (!this.visible(group.x, group.y, 24 / scale + 8)) continue;
      const fontSize = this.width < 600 ? 9 : 10;
      ctx.font = `500 ${fontSize / scale}px "DM Sans", system-ui, sans-serif`;
      const text = this.overlay === 'societies' ? `${group.name} · ${group.members.length}` : group.name;
      const w = ctx.measureText(text).width + 22 / scale;
      const h = 21 / scale;
      const x = group.x, y = group.y + 1.2 + 13 / scale;
      const box = { left: x - w / 2, right: x + w / 2, top: y - h / 2, bottom: y + h / 2 };
      if (drawn.some(other => box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top)) continue;
      drawn.push(box);
      ctx.fillStyle = this.overlay === 'societies' ? 'rgba(251,247,231,.94)' : 'rgba(251,247,231,.87)';
      ctx.strokeStyle = 'rgba(71,79,50,.17)'; ctx.lineWidth = 1 / scale;
      roundedRect(ctx, box.left, box.top, w, h, 5 / scale); ctx.fill(); ctx.stroke();
      ellipse(ctx, box.left + 8 / scale, y, 2.3 / scale, 2.3 / scale, group.color);
      ctx.fillStyle = '#3e493b';
      ctx.fillText(text, x + 4 / scale, y + 0.3 / scale);
    }
  }

  draw(time) {
    if (this.destroyed) return;
    this.frame = requestAnimationFrame(next => this.draw(next));
    // Terrain is cached; at rest only the small animated layer is repainted.
    const dt = Math.min((time - (this.previousTime || time)) / 1000, 0.1);
    this.previousTime = time;
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = OCEAN;
    ctx.fillRect(0, 0, this.width, this.height);
    if (!this.snapshot || !this.terrainCanvas) return;
    const blend = 1 - Math.exp(-dt * 8);
    for (const agent of this.snapshot.agents) {
      const p = this.positions.get(agent.id);
      if (!p) continue;
      if (Math.hypot(p.x - agent.x, p.y - agent.y) > 12) {
        p.x = agent.x; p.y = agent.y;
      } else {
        p.x = lerp(p.x, agent.x, blend); p.y = lerp(p.y, agent.y, blend);
      }
    }
    if (this.followId !== null) {
      const p = this.positions.get(this.followId);
      if (p) {
        this.camera.x = lerp(this.camera.x, p.x, blend);
        this.camera.y = lerp(this.camera.y, p.y, blend);
      }
    }
    const halfWidth = this.width / (2 * this.scale), halfHeight = this.height / (2 * this.scale);
    this.viewport = { left: this.camera.x - halfWidth, right: this.camera.x + halfWidth,
      top: this.camera.y - halfHeight, bottom: this.camera.y + halfHeight };
    ctx.save();
    ctx.translate(this.width / 2 - this.camera.x * this.scale, this.height / 2 - this.camera.y * this.scale);
    ctx.scale(this.scale, this.scale);
    ctx.imageSmoothingEnabled = true;
    this.drawCachedLayer(ctx, this.terrainCanvas);
    this.buildDevelopment();
    this.drawCachedLayer(ctx, this.developmentCanvas);
    if (['food', 'societies', 'industry'].includes(this.overlay)) {
      this.buildOverlay();
      this.drawCachedLayer(ctx, this.overlayCanvas);
    }
    this.drawRegionLabels(ctx);
    this.drawRoutes(ctx);
    this.drawHarbours(ctx, time);
    this.drawWars(ctx, time);
    if (this.overlay === 'relations') this.drawRelations(ctx);
    for (const group of this.snapshot.groups) {
      if (this.visible(group.x, group.y, 18)) this.drawSettlement(ctx, group, time);
    }
    if (this.overlay === 'knowledge') this.drawCommunication(ctx, time);
    const ordered = this.snapshot.agents.filter(agent => {
      const p = this.positions.get(agent.id) || agent;
      return this.visible(p.x, p.y, 12 / this.scale);
    }).sort((a, b) => a.y - b.y);
    for (const agent of ordered) {
      const p = this.positions.get(agent.id);
      if (p) this.drawAgent(ctx, agent, p, time);
    }
    this.drawOrbit(ctx, time);
    this.drawCountryLabels(ctx);
    this.drawGroupLabels(ctx);
    if (['relations', 'knowledge'].includes(this.overlay)) this.drawBeliefs(ctx);
    ctx.restore();
    this.drawCompass(ctx);
  }

  /** Satellites launched by spacefaring societies, crossing the sky in their colours. */
  drawOrbit(ctx, time) {
    const spacefaring = this.snapshot.groups.filter(group => (group.mastery?.transport || 0) >= 8 || (group.mastery?.information || 0) >= 9);
    if (!spacefaring.length) return;
    const { width, height } = this.snapshot, t = time / 1000;
    let n = 0;
    for (const group of spacefaring) for (let k = 0; k < 3 && n < 14; k++, n++) {
      const speed = 0.012 + random(group.id, k, 91) * 0.01, phase = random(group.id, k, 92), tilt = (random(group.id, k, 93) - 0.5) * 0.8;
      const u = (t * speed + phase) % 1, x = u * width, y = height * (0.15 + random(group.id, k, 94) * 0.7) + (x - width / 2) * tilt * 0.3;
      if (!this.visible(x, y, 2)) continue;
      ctx.strokeStyle = 'rgba(230,240,245,.25)'; ctx.lineWidth = 0.08;
      ctx.beginPath(); ctx.moveTo(x - 3, y - 3 * tilt * 0.3); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = '#eef4f6'; ctx.fillRect(x - 0.12, y - 0.12, 0.24, 0.24);
      ctx.fillStyle = group.color; ctx.fillRect(x - 0.45, y - 0.06, 0.3, 0.12); ctx.fillRect(x + 0.15, y - 0.06, 0.3, 0.12);
    }
  }

  drawCompass(ctx) {
    if (this.width < 440 || this.height < 260) return;
    const x = this.width - 30, y = 37;
    ctx.save();
    ctx.fillStyle = 'rgba(235,237,210,.68)';
    ctx.font = '500 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', x, y - 13);
    ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x + 4, y + 8); ctx.lineTo(x, y + 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(235,237,210,.3)';
    ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x - 4, y + 8); ctx.lineTo(x, y + 4); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver?.disconnect();
    this.listeners.forEach(remove => remove());
    this.listeners.length = 0;
    this.positions.clear();
  }
}
