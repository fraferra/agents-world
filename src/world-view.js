// A small, dependency-free atlas renderer. Simulation coordinates remain in
// tiles; the camera and illustration never change the simulation itself.
const TILE = 16;
const OCEAN = '#587c79';
const TAU = Math.PI * 2;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const lerp = (a, b, n) => a + (b - a) * n;

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
  constructor(canvas, { onSelect = () => {}, onHover = () => {} } = {}) {
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
    this.zoom = clamp(this.zoom * factor, 0.65, 7);
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
    const rasterTile = Math.min(TILE, Math.max(4, Math.floor(Math.sqrt(2500000 / (width * height)))));
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

  buildOverlay() {
    const { width, height, tiles, groups, day } = this.snapshot;
    const key = `${this.overlay}:${day}:${groups.length}`;
    if (key === this.overlayKey) return;
    this.overlayKey = key;
    if (this.overlay === 'natural' || this.overlay === 'knowledge') return;
    const unit = this.rasterTile;
    const canvas = this.overlayCanvas || canvasOf(width * unit, height * unit);
    if (canvas.width !== width * unit || canvas.height !== height * unit) {
      canvas.width = width * unit;
      canvas.height = height * unit;
    }
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (this.overlay === 'societies') {
      for (const group of groups) {
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

  drawSettlement(ctx, group) {
    this.drawIndustry(ctx, group);
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

  drawIndustry(ctx, group) {
    const buildings = group.civilization?.buildings;
    if (!buildings) return;
    const kinds = ['farm', 'pasture', 'granary', 'workshop', 'lumbermill', 'kiln', 'forge', 'school', 'clinic', 'fishery', 'loom', 'apothecary', 'market', 'library', 'temple', 'observatory', 'hall', 'dock'];
    if (buildings.walls) {
      // Walls ring the whole settlement.
      ctx.strokeStyle = 'rgba(140,128,104,.85)'; ctx.lineWidth = 0.32; ctx.setLineDash([0.9, 0.35]);
      ctx.beginPath(); ctx.ellipse(group.x, group.y, 7.2, 5.4, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
    let slot = 0;
    for (const kind of kinds) {
      // Several illustrations represent a developed district; exact building
      // counts are available in its society inspector.
      const count = clamp(Math.floor(buildings[kind] || 0), 0, kind === 'farm' || kind === 'pasture' ? 4 : ['temple', 'observatory', 'hall', 'dock', 'library', 'market'].includes(kind) ? 1 : 3);
      for (let i = 0; i < count; i++, slot++) {
        let position = null;
        for (let attempt = 0; attempt < 12; attempt++) {
          const angle = (slot + attempt * 0.31) * 2.39996 + group.id;
          const radius = 3.1 + Math.sqrt(slot) * 1.12 + attempt * 0.15;
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
    const colors = { neutral: '#dfdfcc', trade: '#f4d18e', alliance: '#b6e5bc', war: '#e69978', truce: '#bedee3' };
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
    if (['food', 'societies', 'industry'].includes(this.overlay)) {
      this.buildOverlay();
      this.drawCachedLayer(ctx, this.overlayCanvas);
    }
    this.drawRegionLabels(ctx);
    if (this.overlay === 'relations') this.drawRelations(ctx);
    for (const group of this.snapshot.groups) {
      if (this.visible(group.x, group.y, 14)) this.drawSettlement(ctx, group);
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
    this.drawGroupLabels(ctx);
    if (['relations', 'knowledge'].includes(this.overlay)) this.drawBeliefs(ctx);
    ctx.restore();
    this.drawCompass(ctx);
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
