import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, TILE_FIELDS, TERRAIN } from '../src/simulation.js';

test('the browser view sends full detail only for the inspected person, and only new ideas', () => {
  const sim = new Simulation({ seed: 'light-view', population: 40, size: 'compact' });
  sim.step(600);
  const chosen = sim.agents[3];
  const view = sim.view({ detailId: chosen.id });
  const full = sim.snapshot();
  assert.equal(view.agents.length, sim.agents.length);
  for (const agent of view.agents) {
    if (agent.id === chosen.id) assert.ok(!agent.lite && agent.psyche.places && agent.relations && agent.mind.memories);
    else assert.ok(agent.lite && agent.mind.role && !agent.relations && !agent.skills && !('memories' in agent.mind));
  }
  assert.deepEqual(view.agents.find(agent => agent.id === chosen.id).psyche, full.agents.find(agent => agent.id === chosen.id).psyche);
  const holders = Object.values(view.ideaHolders).reduce((sum, counts) => sum + Object.values(counts).reduce((a, b) => a + b, 0), 0);
  assert.equal(holders, sim.agents.reduce((sum, agent) => sum + agent.ideas.length, 0), 'idea holder counts cover everyone');
  assert.ok(JSON.stringify(view).length < JSON.stringify(full).length / 2, 'much lighter than a full snapshot');
  const total = sim.innovation.discoveries.length;
  assert.equal(sim.view({ discoveriesFrom: 0 }).innovation.discoveries.length, total);
  assert.equal(sim.view({ discoveriesFrom: total }).innovation.discoveries.length, 0);
  assert.equal(sim.view().innovation.trials, sim.innovation.trials);
});

test('packed tiles reproduce every tile field', () => {
  const sim = new Simulation({ seed: 'packed-tiles', population: 10, size: 'compact' });
  sim.step(30);
  const packed = sim.packTiles(true);
  assert.equal(packed.length, sim.tiles.length);
  for (const index of [0, 17, 999, sim.tiles.length - 1]) {
    const tile = sim.tiles[index];
    assert.equal(TERRAIN[packed.terrain[index]], tile.terrain);
    assert.ok(Math.abs(packed.elevation[index] - tile.elevation) < 1e-6 && Math.abs(packed.fertility[index] - tile.fertility) < 1e-6);
    for (const key of TILE_FIELDS) assert.ok(Math.abs(packed.fields[key][index] - (tile[key] || 0)) < 1e-6, key);
  }
  assert.equal(sim.packTiles(false).terrain, undefined, 'static fields are sent only on request');
});
