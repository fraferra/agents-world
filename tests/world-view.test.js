import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldView } from '../src/world-view.js';

test('communication map shows only recent recorded encounters between living people', () => {
  const segments = [];
  const ctx = {
    save() {}, restore() {}, setLineDash() {}, beginPath() {}, ellipse() {}, fill() {},
    moveTo(x, y) { this.from = [x, y]; },
    lineTo(x, y) { this.to = [x, y]; },
    stroke() { segments.push([this.from, this.to]); },
  };
  const view = {
    scale: 4,
    viewport: { left: 0, right: 20, top: 0, bottom: 20 },
    positions: new Map([[1, { x: 2, y: 2 }], [2, { x: 4, y: 4 }], [3, { x: 6, y: 6 }], [4, { x: 8, y: 8 }]]),
    snapshot: { day: 100, civilization: { messages: [
      { day: 100, speakerId: 1, listenerId: 2, kind: 'idea' },
      { day: 99, speakerId: 2, listenerId: 1, kind: 'social' },
      { day: 98, speakerId: 1, listenerId: 77, kind: 'teaching' },
      { day: 54, speakerId: 1, listenerId: 3, kind: 'idea' },
      { day: 100, speakerId: 4, listenerId: 4, kind: 'social' },
      { day: 101, speakerId: 2, listenerId: 3, kind: 'resource' },
    ] } },
  };
  WorldView.prototype.drawCommunication.call(view, ctx, 500);
  assert.deepEqual(segments, [[[2, 1.7], [4, 3.7]]]);
  view.snapshot.civilization.messages = [];
  segments.length = 0;
  WorldView.prototype.drawCommunication.call(view, ctx, 500);
  assert.deepEqual(segments, [], 'living nearby agents do not imply a fabricated conversation');
});

test('communication culling preserves encounters crossing the visible area', () => {
  let lines = 0;
  const ctx = { save() {}, restore() {}, setLineDash() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() { lines++; } };
  const view = {
    scale: 4,
    viewport: { left: 5, right: 10, top: 5, bottom: 10 },
    positions: new Map([[1, { x: 0, y: 7 }], [2, { x: 15, y: 7 }], [3, { x: 0, y: 0 }], [4, { x: 3, y: 3 }]]),
    snapshot: { day: 50, civilization: { messages: [
      { day: 49, speakerId: 1, listenerId: 2, kind: 'resource' },
      { day: 48, speakerId: 3, listenerId: 4, kind: 'social' },
    ] } },
  };
  WorldView.prototype.drawCommunication.call(view, ctx, 500);
  assert.equal(lines, 1);
});

test('relation overlay draws only recorded relations with living society endpoints', () => {
  const lines = [];
  const ctx = { save() {}, restore() {}, setLineDash() {}, beginPath() {}, moveTo(x, y) { this.from = [x, y]; }, lineTo(x, y) { this.to = [x, y]; }, stroke() { lines.push({ from: this.from, to: this.to, color: this.strokeStyle }); } };
  const view = {
    scale: 4, zoom: 1,
    viewport: { left: 5, right: 10, top: 5, bottom: 10 },
    snapshot: { groups: [{ id: 1, x: 0, y: 7 }, { id: 2, x: 15, y: 7 }, { id: 3, x: 0, y: 0 }, { id: 4, x: 3, y: 3 }], diplomacy: { relations: [
      { a: 1, b: 2, status: 'war' }, { a: 1, b: 9, status: 'alliance' }, { a: 3, b: 4, status: 'trade' },
    ] } },
  };
  WorldView.prototype.drawRelations.call(view, ctx);
  assert.deepEqual(lines, [{ from: [0, 7], to: [15, 7], color: '#e69978' }]);
  lines.length = 0;
  view.snapshot.diplomacy.relations = [];
  WorldView.prototype.drawRelations.call(view, ctx);
  assert.equal(lines.length, 0, 'proximity alone does not draw diplomatic links');
});

test('belief markers require a society doctrine referencing an actual belief', () => {
  let markers = 0;
  const ctx = { save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() { markers++; }, stroke() {} };
  const view = {
    scale: 4, zoom: 1, visible: () => true,
    snapshot: { groups: [
      { x: 2, y: 2, civilization: { doctrine: 'idea-1' } },
      { x: 4, y: 4, civilization: { doctrine: 'idea-2' } },
      { x: 6, y: 6, civilization: { doctrine: 'idea-3' } },
      { x: 8, y: 8, civilization: { doctrine: null } },
    ], innovation: { discoveries: [{ id: 'idea-1', kind: 'belief', name: 'The shared hearth' }, { id: 'idea-2', kind: 'invention', name: 'Seed basket' }] } },
  };
  WorldView.prototype.drawBeliefs.call(view, ctx);
  assert.equal(markers, 1);
});
