import { readFile, mkdir, writeFile, rename, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setImmediate as yieldToEventLoop } from 'node:timers/promises';
import { DEFAULT_CONFIG, WORLD_SIZES } from '../src/simulation.js';

const USAGE = `Common Ground — continuous headless simulation

Usage:
  npm run simulate -- --years 100 --size large --seed moss-17 --population 96 --save ./world.json
  npm run simulate -- --years 100 --load ./world.json --save ./world.json

Options:
  --years N        Additional years to simulate, 1–100000 (default: 100)
  --seed TEXT      New-world seed, 1–128 characters (default: moss-17)
  --population N   Starting population, nonnegative integer (default: ${DEFAULT_CONFIG.population})
  --size NAME      New-world size: compact, standard, large, vast, or immense (default: ${DEFAULT_CONFIG.size})
  --load PATH      Continue an exported world or a raw simulation state
  --save PATH      Save a browser-compatible world every 30 seconds and on exit
  --report PATH    Write final statistics as JSON
  --help           Show this help

The browser does not need to stay open. Keep the terminal running and the
computer awake. With --save, atomic checkpoints are written every 30 seconds;
completion and Ctrl+C also save the current world.`;

export function parseOptions(args) {
  const options = { years: 100, seed: DEFAULT_CONFIG.seed, population: DEFAULT_CONFIG.population, size: DEFAULT_CONFIG.size };
  const explicit = new Set();
  const allowed = new Set(['years', 'seed', 'population', 'size', 'load', 'save', 'report']);
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--help' || args[index] === '-h') return { help: true };
    const match = /^--([a-z]+)(?:=(.*))?$/.exec(args[index]);
    if (!match || !allowed.has(match[1])) throw new Error(`Unknown option: ${args[index]}. Use --help for usage.`);
    const [, name, inline] = match;
    const value = inline ?? args[++index];
    if (typeof value !== 'string' || !value.trim() || value.startsWith('--')) throw new Error(`--${name} requires a value.`);
    if (explicit.has(name)) throw new Error(`--${name} was supplied more than once.`);
    explicit.add(name);
    options[name] = value;
  }
  for (const [name, maximum, minimum] of [['years', 100000, 1], ['population', Number.MAX_SAFE_INTEGER, 0]]) {
    const value = String(options[name]);
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < minimum || Number(value) > maximum) {
      throw new Error(`--${name} must be an integer between ${minimum} and ${maximum}.`);
    }
    options[name] = Number(value);
  }
  if (options.seed.length > 128 || !options.seed.trim()) throw new Error('--seed must contain 1–128 characters.');
  if (!Object.hasOwn(WORLD_SIZES, options.size)) throw new Error(`--size must be one of: ${Object.keys(WORLD_SIZES).join(', ')}.`);
  if (options.load && (explicit.has('seed') || explicit.has('population') || explicit.has('size'))) {
    throw new Error('--load restores the seed, population, and dimensions; omit --seed, --population, and --size when continuing a world.');
  }
  if (options.report && options.save && resolve(options.report) === resolve(options.save)) {
    throw new Error('--report and --save must use different paths.');
  }
  if (options.report && options.load && resolve(options.report) === resolve(options.load)) {
    throw new Error('--report cannot overwrite the world being loaded.');
  }
  return options;
}

/** Atomic replacement avoids truncating an existing save during a write. */
export async function writeJson(path, value) {
  const target = resolve(path);
  await mkdir(dirname(target), { recursive: true });
  const temporary = `${target}.tmp-${process.pid}-${Date.now()}`;
  try {
    await writeFile(temporary, `${JSON.stringify(value)}\n`, { flag: 'wx' });
    await rename(temporary, target);
  } finally {
    await unlink(temporary).catch(() => {});
  }
}

function display(snapshot, daysPerYear) {
  const stats = snapshot.stats;
  console.log(`Year ${(snapshot.day / daysPerYear).toFixed(1).padStart(7)} | population ${String(stats.population).padStart(4)} | societies ${String(stats.groups).padStart(3)} | technologies ${stats.technologies} | industries ${stats.industries} | inventions ${stats.inventions} | beliefs ${stats.beliefs} | wars ${stats.wars} | techniques known ${stats.techniquesKnown} | births ${stats.births} | deaths ${stats.deaths} | happiness ${stats.happiness.toFixed(0)}% | generation ${stats.generation}`);
}

async function saveWorld(path, simulation) {
  await writeJson(path, {
    format: 'common-ground', version: 1, savedAt: new Date().toISOString(), simulation: simulation.serialize(),
  });
}

export async function run(options) {
  const { Simulation, DAYS_PER_YEAR } = await import('../src/simulation.js');
  let simulation;
  if (options.load) {
    const loaded = JSON.parse(await readFile(resolve(options.load), 'utf8'));
    if (loaded?.format === 'common-ground' && loaded.version !== 1) throw new Error('This save format version is not supported.');
    simulation = Simulation.deserialize(loaded?.format === 'common-ground' ? loaded.simulation : loaded);
  } else {
    simulation = new Simulation({ seed: options.seed, population: options.population, size: options.size });
  }
  const started = Date.now();
  let lastCheckpoint = started;
  const initial = simulation.snapshot();
  const daysRequested = options.years * DAYS_PER_YEAR;
  let daysCompleted = 0;
  let interrupted = false;
  const interrupt = () => { interrupted = true; };
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', interrupt);
  console.log(`World seed: ${initial.seed}. Size: ${initial.config.size} (${initial.width}×${initial.height}). Running ${options.years.toLocaleString()} additional years (${daysRequested.toLocaleString()} days).`);
  display(initial, DAYS_PER_YEAR);
  try {
    // Frequent yields let stop signals reach even fast, very long simulations.
    // A chunk never crosses a reporting boundary.
    const reportEvery = Math.max(1, Math.ceil(options.years / 100)) * DAYS_PER_YEAR;
    let nextReport = Math.min(reportEvery, daysRequested);
    while (daysCompleted < daysRequested && !interrupted) {
      const chunk = Math.min(12, daysRequested - daysCompleted, nextReport - daysCompleted);
      simulation.step(chunk);
      daysCompleted += chunk;
      if (daysCompleted === nextReport) {
        display(simulation.snapshot(), DAYS_PER_YEAR);
        nextReport = Math.min(nextReport + reportEvery, daysRequested);
      }
      if (options.save && daysCompleted < daysRequested && Date.now() - lastCheckpoint >= 30000) {
        await saveWorld(options.save, simulation);
        lastCheckpoint = Date.now();
        console.log(`Checkpoint saved to ${resolve(options.save)} (year ${((initial.day + daysCompleted) / DAYS_PER_YEAR).toFixed(1)}).`);
      }
      await yieldToEventLoop();
    }
    const final = simulation.snapshot();
    if (interrupted && daysCompleted % reportEvery !== 0) display(final, DAYS_PER_YEAR);
    const report = {
      format: 'common-ground-report',
      version: 1,
      savedAt: new Date().toISOString(),
      seed: final.seed,
      startDay: initial.day,
      day: final.day,
      year: final.day / DAYS_PER_YEAR,
      requestedYears: options.years,
      completedDays: daysCompleted,
      interrupted,
      elapsedSeconds: Number(((Date.now() - started) / 1000).toFixed(3)),
      stats: final.stats,
      config: final.config,
      history: final.history,
    };
    if (options.save) {
      await saveWorld(options.save, simulation);
      console.log(`World saved to ${resolve(options.save)}`);
    }
    if (options.report) {
      await writeJson(options.report, report);
      console.log(`Report saved to ${resolve(options.report)}`);
    }
    console.log(`${interrupted ? 'Stopped' : 'Finished'} after ${daysCompleted.toLocaleString()} days in ${report.elapsedSeconds}s. Population ${final.stats.population}; births ${final.stats.births}; deaths ${final.stats.deaths}; societies ${final.stats.groups}; total food ${Math.round(final.stats.food)}.`);
    if (interrupted && !options.save) console.log('No save path was supplied; this world was not written to disk.');
    return report;
  } finally {
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', interrupt);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseOptions(process.argv.slice(2));
    if (options.help) console.log(USAGE);
    else {
      const report = await run(options);
      if (report.interrupted) process.exitCode = 130;
    }
  } catch (error) {
    console.error(`Simulation failed: ${error.message}`);
    process.exitCode = 1;
  }
}
