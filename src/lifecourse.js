/** The human life course from empirical demography.
 *
 * Mortality follows the Siler competing-hazards model fitted to small-scale
 * societies by Gurven & Kaplan (2007): h(x) = a1·e^(−b1·x) + a2 + a3·e^(b3·x).
 * Infant and background hazards move from forager values toward those of
 * populations with access to medicine as care improves, and rise with endemic
 * disease and hunger; senescence is intrinsic. Fertility follows a natural-
 * fertility age schedule (Coale–Trussell) after a period of lactational
 * infertility that is longer for mobile foragers than for settled farmers
 * (Bocquet-Appel's Neolithic Demographic Transition). See REALISM.md.
 */
export const SILER = Object.freeze({
  forager: Object.freeze({ a1: .422, b1: 1.131, a2: .013, a3: 1.47e-4, b3: .086 }),
  acculturated: Object.freeze({ a1: .248, b1: .816, a2: .006, a3: 1.78e-4, b3: .079 }),
});
// Relative natural fertility by age (Coale & Trussell), interpolated between groups.
const NATURAL_FERTILITY = [[14, 0], [17, .411], [22, .46], [27, .431], [32, .396], [37, .321], [42, .167], [47, .024], [50, 0]];
const PEAK = .46;
const DAYS = 120;
const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const lerp = (a, b, t) => a + (b - a) * t;

export function naturalFertility(age) {
  if (age <= NATURAL_FERTILITY[0][0] || age >= NATURAL_FERTILITY.at(-1)[0]) return 0;
  for (let i = 1; i < NATURAL_FERTILITY.length; i++) {
    const [x1, y1] = NATURAL_FERTILITY[i];
    if (age <= x1) { const [x0, y0] = NATURAL_FERTILITY[i - 1]; return y0 + (y1 - y0) * (age - x0) / (x1 - x0); }
  }
  return 0;
}

/** Sex at birth (about 105 boys per 100 girls) and who a person is attracted to. */
export function assignSex(sim) { return sim._random() < 105 / 205 ? 'male' : 'female'; }
export function assignAttraction(sim) { const roll = sim._random(); return roll < .94 ? 'different' : roll < .97 ? 'same' : 'both'; }
function drawnTo(person, other) {
  if (!person.sex || !other.sex) return true;
  return person.attraction === 'both' || (person.attraction === 'same') === (person.sex === other.sex);
}
/** Partnership needs mutual attraction; only mixed-sex couples can have children. */
export function compatible(a, b) { return drawnTo(a, b) && drawnTo(b, a); }
export function mother(a, b) { return a.sex === 'female' && b.sex === 'male' ? a : b.sex === 'female' && a.sex === 'male' ? b : null; }

/** Medical care available to a society: knowledge, institutions, prepared remedies. */
export function careLevel(group) {
  const civ = group?.civilization;
  if (!civ) return 0;
  const known = civ.technologies, b = civ.buildings;
  return clamp((known.includes('herbalism') ? .12 : 0) + (known.includes('medicine') ? .3 : 0) + Math.min(2, b.clinic || 0) * .15 + Math.min(1, b.apothecary || 0) * .08
    + Math.min(1, (civ.stock.remedies || 0) / Math.max(1, group.members.length * .15)) * .1);
}

/**
 * Endemic infectious disease: settled, crowded communities living with animals
 * carry more pathogens (the first epidemiological transition); care reduces it.
 */
export function diseaseLoad(group) {
  const civ = group?.civilization;
  if (!civ) return 0;
  const built = Object.values(civ.buildings).reduce((a, b) => a + b, 0);
  const sedentism = Math.min(1, built / 6);
  const crowding = Math.min(1.5, group.members.length / 60);
  const livestock = Math.min(1, (civ.buildings.pasture || 0) * .35);
  return Math.max(0, sedentism * .25 + crowding * .35 + livestock * .3) * (1 - careLevel(group) * .6);
}

/** Annual mortality hazard for a person, from Siler components adjusted for their circumstances. */
export function annualHazard(agent, group, day) {
  const care = careLevel(group), load = diseaseLoad(group);
  const f = SILER.forager, m = SILER.acculturated;
  let a1 = lerp(f.a1, m.a1, care), b1 = lerp(f.b1, m.b1, care), a2 = lerp(f.a2, m.a2, care);
  a1 *= 1 + load * .8; a2 *= 1 + load * .6;
  if (group?.civilization.outbreakUntil > day) a2 += .04 * (1 - care * .6);
  // Hunger raises the risk of dying from everything else, above all for the young.
  if (agent.hunger > 45) { const strain = (agent.hunger - 45) / 55; a1 *= 1 + strain * 2; a2 *= 1 + strain; }
  return a1 * Math.exp(-b1 * agent.age) + a2 + f.a3 * Math.exp(f.b3 * agent.age);
}

/** Draws today's mortality. Returns a cause of death or null. */
export function mortality(sim, agent, group) {
  const hazard = annualHazard(agent, group, sim.day);
  if (sim._random() >= 1 - Math.exp(-hazard / DAYS)) return null;
  const epidemic = group?.civilization.outbreakUntil > sim.day ? .04 * (1 - careLevel(group) * .6) : 0;
  if (epidemic && sim._random() < epidemic / hazard) return 'epidemic';
  const senescent = SILER.forager.a3 * Math.exp(SILER.forager.b3 * agent.age);
  if (agent.age < 5) return 'childhood illness';
  if (senescent > hazard * .5) return 'old age';
  return sim._random() < .8 ? 'illness' : 'an accident';
}

/** Days of lactational infertility after a birth: long for mobile foragers, shorter when settled. */
export function postpartumDays(group) {
  const b = group?.civilization?.buildings;
  const settled = b && (b.farm > 0 || b.pasture > 0);
  // Gestation plus lactational amenorrhoea; conception then takes about two months,
  // giving birth intervals near 3.1 years for foragers and about 2.4 when settled.
  return settled ? 230 : 310;
}

/** Daily chance that a fertile, provisioned couple conceives, carried to a birth. */
export function conceptionChance(sim, woman, man) {
  const age = naturalFertility(woman.age) / PEAK;
  if (age <= 0) return 0;
  const nutrition = clamp(1 - Math.max(0, woman.hunger - 15) / 45, .1, 1) * clamp((woman.health - 40) / 40, .2, 1);
  return age * nutrition * (1 / 50) * sim.config.fertility * (man.age < 65 ? 1 : .5);
}

/** A hard biological limit on top of the hazards; almost no one reaches it. */
export function maximumLifespanDays(seed) { return Math.floor((100 + seed * 10) * DAYS); }

/** Bounded vital records for observers. */
export function initializeVital(sim) {
  sim.vital = { deathAges: [], childDeaths: 0, adultDeaths: 0, completedFertility: [] };
  return sim.vital;
}
export function recordDeath(sim, agent) {
  const vital = sim.vital;
  vital.deathAges.push(Math.round(agent.age * 10) / 10);
  if (vital.deathAges.length > 400) vital.deathAges.shift();
  if (agent.age < 15) vital.childDeaths++; else vital.adultDeaths++;
}
/** Women's completed fertility is recorded as they pass age 45. */
export function recordCompletedFertility(sim, agent) {
  if (agent.sex !== 'female') return;
  sim.vital.completedFertility.push(agent.children.length);
  if (sim.vital.completedFertility.length > 200) sim.vital.completedFertility.shift();
}
export function vitalStats(sim) {
  const v = sim.vital, deaths = v.deathAges;
  const mean = list => list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0;
  return {
    meanAgeAtDeath: Math.round(mean(deaths) * 10) / 10,
    childDeathShare: deaths.length ? Math.round(deaths.filter(age => age < 15).length / deaths.length * 1000) / 1000 : 0,
    completedFertility: Math.round(mean(v.completedFertility) * 100) / 100,
  };
}

export function restoreVital(raw) {
  const fail = field => { throw new Error(`Invalid vital records: ${field}.`); };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('object');
  const list = (value, max, top) => { if (!Array.isArray(value) || value.length > max || value.some(entry => typeof entry !== 'number' || !Number.isFinite(entry) || entry < 0 || entry > top)) fail('list'); return [...value]; };
  const count = value => { if (!Number.isSafeInteger(value) || value < 0) fail('count'); return value; };
  return { deathAges: list(raw.deathAges, 400, 130), childDeaths: count(raw.childDeaths), adultDeaths: count(raw.adultDeaths), completedFertility: list(raw.completedFertility, 200, 1e4) };
}
