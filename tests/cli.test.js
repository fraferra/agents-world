import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { parseOptions, run } from '../scripts/simulate.mjs';

const runNode = promisify(execFile);
const cli = fileURLToPath(new URL('../scripts/simulate.mjs', import.meta.url));

test('rejects ambiguous, out-of-range, and destructive CLI option combinations', () => {
  for (const args of [
    ['--years', '0'], ['--years', 'Infinity'], ['--years', '100001'],
    ['--population', '-1'], ['--population', '9007199254740992'], ['--population', '1.5'], ['--years', '1.5'],
    ['--size', 'gigantic'], ['--size'], ['--size', 'standard', '--size', 'large'],
    ['--save'], ['--what', 'yes'], ['--seed', ''],
    ['--load', 'world.json', '--seed', 'replacement'],
    ['--load', 'world.json', '--population', '32'],
    ['--load', 'world.json', '--size', 'standard'],
    ['--save', './world.json', '--report', resolve('world.json')],
    ['--load', 'world.json', '--report', './world.json'],
    ['--years', '2', '--years', '3'],
  ]) assert.throws(() => parseOptions(args), args.join(' '));
  assert.deepEqual(parseOptions([]), { years: 100, population: 150, seed: 'moss-17', size: 'vast' });
  assert.deepEqual(parseOptions(['--years=2', '--population', '64', '--seed', 'test-world']), { years: 2, population: 64, seed: 'test-world', size: 'vast' });
  for (const size of ['compact', 'standard', 'large', 'vast', 'immense', 'huge', 'colossal']) assert.equal(parseOptions([`--size=${size}`]).size, size);
  for (const population of ['0', '1', '2', '600', '1001', '12000']) assert.equal(parseOptions(['--population', population]).population, Number(population));
});

test('headless runs produce importable saves and resume without losing state', { timeout: 30000 }, async (t) => {
  const { Simulation, DAYS_PER_YEAR } = await import('../src/simulation.js');
  const directory = await mkdtemp(join(tmpdir(), 'common-ground-cli-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const worldPath = join(directory, 'world.json');
  const reportPath = join(directory, 'report.json');
  const first = await runNode(process.execPath, [cli, '--years', '1', '--seed', 'cli-test', '--population', '12', '--size', 'large', '--save', worldPath, '--report', reportPath]);
  assert.match(first.stdout, /Finished after 120 days/);
  assert.match(first.stdout, /Size: large \(224×144\)/);
  assert.match(first.stdout, /technologies \d+ \| industries \d+/);
  const envelope = JSON.parse(await readFile(worldPath, 'utf8'));
  assert.equal(envelope.format, 'common-ground');
  assert.equal(envelope.version, 1);
  const loaded = Simulation.deserialize(envelope.simulation);
  assert.equal(loaded.width, 224);
  assert.equal(loaded.height, 144);
  assert.equal(loaded.config.size, 'large');
  const expected = new Simulation({ seed: 'cli-test', population: 12, size: 'large' }).step(DAYS_PER_YEAR);
  assert.deepEqual(loaded.serialize(), expected.serialize());
  const initialReport = JSON.parse(await readFile(reportPath, 'utf8'));
  assert.equal(loaded.snapshot().day, DAYS_PER_YEAR);
  assert.equal(initialReport.day, DAYS_PER_YEAR);
  assert.deepEqual(initialReport.stats, loaded.snapshot().stats);
  loaded.step(DAYS_PER_YEAR);
  await runNode(process.execPath, [cli, '--years', '1', '--load', worldPath, '--save', worldPath]);
  const resumed = JSON.parse(await readFile(worldPath, 'utf8'));
  assert.deepEqual(Simulation.deserialize(resumed.simulation).serialize(), loaded.serialize());
});

test('interrupting a long run saves a valid world before exiting', { timeout: 30000 }, async (t) => {
  const { Simulation } = await import('../src/simulation.js');
  const directory = await mkdtemp(join(tmpdir(), 'common-ground-interrupt-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const worldPath = join(directory, 'interrupted.json');
  const child = spawn(process.execPath, [cli, '--years', '100000', '--population', '12', '--save', worldPath], { stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => { if (child.exitCode === null) child.kill('SIGKILL'); });
  let output = '';
  let errors = '';
  let interrupted = false;
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    output += chunk;
    if (!interrupted && output.includes('World seed:')) {
      interrupted = true;
      child.kill('SIGINT');
    }
  });
  child.stderr.on('data', (chunk) => { errors += chunk; });
  const code = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', resolve);
  });
  assert.equal(code, 130, errors || output);
  assert.match(output, /World saved to/);
  const envelope = JSON.parse(await readFile(worldPath, 'utf8'));
  const loaded = Simulation.deserialize(envelope.simulation);
  assert.ok(loaded.snapshot().day >= 0);
  assert.ok(loaded.snapshot().day < 12000000);
});

test('wall-clock checkpoints are valid and precede the final save', async (t) => {
  const { Simulation, DAYS_PER_YEAR } = await import('../src/simulation.js');
  const directory = await mkdtemp(join(tmpdir(), 'common-ground-checkpoint-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const worldPath = join(directory, 'world.json');
  let now = 0;
  t.mock.method(Date, 'now', () => { now += 31000; return now; });
  const checkpoints = [];
  t.mock.method(console, 'log', (message) => {
    if (message.startsWith('Checkpoint saved')) {
      const saved = JSON.parse(readFileSync(worldPath, 'utf8'));
      assert.equal(saved.format, 'common-ground');
      assert.equal(saved.version, 1);
      checkpoints.push(Simulation.deserialize(saved.simulation).snapshot().day);
    }
  });
  await run({ years: 1, seed: 'checkpoint-test', population: 12, save: worldPath });
  assert.ok(checkpoints.length > 0);
  assert.ok(checkpoints.every((day) => day > 0 && day < DAYS_PER_YEAR));
  const final = JSON.parse(await readFile(worldPath, 'utf8'));
  assert.equal(Simulation.deserialize(final.simulation).snapshot().day, DAYS_PER_YEAR);
});
