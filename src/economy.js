/** Private wealth, sharing and inheritance.
 *
 * Borgerhoff Mulder et al. (2009, Science) found that wealth inequality and its
 * transmission to heirs are low among foragers and horticulturalists (Gini about
 * 0.25) and high among pastoralists and agriculturalists (about 0.42–0.48),
 * because herds and land can be defended and inherited. Here people keep a
 * share of what they produce that depends on how their society makes a living
 * and how communal its culture is. Demand sharing levels holdings, most strongly
 * among foragers. Estates pass to children at rates that follow the same
 * production systems. Wealth is real stored value (grain, animals, goods): it can
 * be eaten in hard times and it makes a person a more attractive partner, a more
 * likely leader and a more persuasive voice.
 */
const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const round = value => Math.round(value * 1e4) / 1e4 || 0;

export const ECONOMIES = Object.freeze({
  // keep: share of own output kept privately; levelling: monthly demand-sharing of
  // surplus above the mean; inherit: share of an estate passed to heirs.
  foraging: { label: 'Foraging', keep: .08, levelling: .03, inherit: .3 },
  horticultural: { label: 'Horticultural', keep: .14, levelling: .02, inherit: .35 },
  pastoral: { label: 'Pastoral', keep: .35, levelling: .005, inherit: .9 },
  agricultural: { label: 'Agricultural', keep: .3, levelling: .004, inherit: .85 },
});

/** How a society makes its living, from what it has built. */
export function economyOf(group) {
  const b = group?.civilization?.buildings;
  if (!b) return 'foraging';
  if (b.pasture > 0 && b.pasture >= b.farm) return 'pastoral';
  if (b.farm > 0 && (b.granary > 0 || group.civilization.technologies.includes('irrigation'))) return 'agricultural';
  if (b.farm > 0) return 'horticultural';
  return 'foraging';
}

/** The part of a day's output a worker keeps; the rest goes to the common store. */
export function keptShare(group, amount) {
  if (!group || !(amount > 0)) return 0;
  const collectivism = group.civilization.culture?.norms.collectivism ?? .5;
  return amount * clamp(ECONOMIES[economyOf(group)].keep * (1.4 - collectivism));
}

export function addWealth(agent, amount) { if (amount > 0) agent.wealth = round((agent.wealth || 0) + amount); }

/** Demand sharing: the better-off give part of their surplus to those below the mean. */
export function shareWealth(sim, group) {
  const people = group.members.map(id => sim._agentMap.get(id)).filter(Boolean);
  if (people.length < 2) return;
  const mean = people.reduce((sum, agent) => sum + (agent.wealth || 0), 0) / people.length;
  const collectivism = group.civilization.culture?.norms.collectivism ?? .5;
  const rate = clamp(ECONOMIES[economyOf(group)].levelling * (.5 + collectivism));
  let pool = 0;
  for (const agent of people) if (agent.wealth > mean) { const given = (agent.wealth - mean) * rate; agent.wealth = round(agent.wealth - given); pool += given; }
  const poor = people.filter(agent => (agent.wealth || 0) < mean);
  const deficit = poor.reduce((sum, agent) => sum + mean - (agent.wealth || 0), 0);
  if (!poor.length || !deficit) { if (pool) { const each = pool / people.length; for (const agent of people) addWealth(agent, each); } return; }
  for (const agent of poor) addWealth(agent, pool * (mean - (agent.wealth || 0)) / deficit);
}

/** An estate passes to children, otherwise to a partner; the rest returns to the community. */
export function bequeath(sim, agent, group) {
  const estate = agent.wealth || 0;
  if (estate <= 0) return;
  const heirs = agent.children.map(id => sim._agentMap.get(id)).filter(child => child && child.health > 0);
  const partner = sim._agentMap.get(agent.partnerId);
  const inherited = estate * ECONOMIES[economyOf(group)].inherit;
  if (heirs.length) for (const heir of heirs) addWealth(heir, inherited / heirs.length);
  else if (partner && partner.health > 0) addWealth(partner, inherited);
  const remainder = heirs.length || (partner && partner.health > 0) ? estate - inherited : estate;
  if (group) group.food += remainder;
  agent.wealth = 0;
}

/** Private stores are eaten when nothing else is left. Returns food obtained. */
export function drawOnWealth(agent, wanted) {
  const used = Math.min(agent.wealth || 0, wanted);
  if (used > 0) agent.wealth = round(agent.wealth - used);
  return used;
}

export function gini(values) {
  const list = values.filter(value => value >= 0).sort((a, b) => a - b);
  const n = list.length, total = list.reduce((a, b) => a + b, 0);
  if (n < 2 || total <= 0) return 0;
  let weighted = 0;
  for (let i = 0; i < n; i++) weighted += (i + 1) * list[i];
  return Math.round(((2 * weighted) / (n * total) - (n + 1) / n) * 1000) / 1000;
}

/** Inequality among a society's adults, as field studies measure it. */
export function groupGini(sim, group) { return gini(group.members.map(id => sim._agentMap.get(id)).filter(agent => agent && agent.age >= 16).map(agent => agent.wealth || 0)); }

/** Standing that wealth confers, on a gently diminishing scale. */
export function standing(agent) { return Math.log1p(agent.wealth || 0); }
