/** Politics: parties inside societies, and countries made of societies.
 *
 * Parties. In a town with governance (or a hall), people who think alike
 * organise. Each adult holds a position on six axes (communal, authority,
 * progress, military, faith, expansion) from their values, temperament, wealth
 * and grievances. A founder with like-minded followers starts a party whose
 * ideology is theirs and whose name reflects it. Everyone backs the party
 * nearest their own views. Egalitarian societies hold elections every four
 * years; in hierarchical ones the ruling party stays until discontent (poverty,
 * inequality, the unrest some breakthroughs bring) topples it. The governing
 * party's leader leads the society, and its ideology pulls the society's norms.
 *
 * Countries. Societies unite into named states: an overlord with its
 * tributaries (an empire), allied kin societies (a union or confederation), or
 * a city with its colonies (a kingdom or republic). Members do not war among
 * themselves. Countries split when a member breaks away, and end when their
 * capital is lost.
 */
import { tributariesOf, overlordOf, relationBetween } from './diplomacy.js';
import { advances } from './breakthroughs.js';

export const AXES = Object.freeze(['collectivism', 'hierarchy', 'innovation', 'martial', 'piety', 'expansion']);
const round = value => Math.round(value * 1e4) / 1e4 || 0;
const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function initializePolity(sim) {
  sim.polity = { nextParty: 1, parties: [], nextCountry: 1, countries: [], elections: 0, revolutions: 0 };
  return sim.polity;
}

/** Where a person stands on each axis. */
export function stance(agent, group) {
  const v = agent.mind.values, p = agent.psyche?.personality || {}, norms = group?.civilization.culture?.norms || {};
  const wealth = Math.log1p(agent.wealth || 0) / 4, poor = clamp(1 - wealth), grievance = clamp((agent._stress || 0) / 150 + (agent.psyche?.mood.anger || 0) * .5);
  return {
    collectivism: clamp(v.care * .35 + v.belonging * .25 + poor * .3 + agent.traits.cooperation * .1),
    hierarchy: clamp(v.security * .3 + (1 - v.autonomy) * .3 + (p.conscientiousness ?? .5) * .2 + wealth * .2 - grievance * .2),
    innovation: clamp(v.mastery * .3 + (p.openness ?? .5) * .4 + agent.traits.curiosity * .3),
    martial: clamp(agent.mind.riskTolerance * .4 + (p.agreeableness !== undefined ? 1 - p.agreeableness : .5) * .3 + (norms.martial ?? .5) * .3),
    piety: clamp((norms.piety ?? .4) * .5 + v.belonging * .3 + (1 - (p.openness ?? .5)) * .2),
    expansion: clamp((agent.psyche?.expansion ?? .4) * .7 + agent.mind.ambition * .3),
  };
}
const gap = (a, b) => Math.sqrt(AXES.reduce((sum, key) => sum + (a[key] - b[key]) ** 2, 0));

/** A party's name from what it stands for: a core word from its strongest position, an adjective from its second. */
function partyName(sim, ideology, group) {
  const strongest = AXES.map(key => [key, ideology[key] - .5]).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const [key, lean] = strongest[0], [second, lean2] = strongest[1];
  const pick = list => list[Math.floor(sim._random() * list.length)];
  const cores = {
    collectivism: lean > 0 ? ['Labour', 'Workers', 'Commons', 'Solidarity'] : ['Liberal', 'Enterprise', 'Free Market', 'Property'],
    hierarchy: lean > 0 ? ['Order', 'Crown', 'Unity'] : ['Democratic', 'Popular', 'Equality'],
    innovation: lean > 0 ? ['Progress', 'Reform', 'Future'] : ['Conservative', 'Tradition', 'Heritage'],
    martial: lean > 0 ? ['Patriots', 'Defence', 'Vanguard'] : ['Peace', 'Concord'],
    piety: lean > 0 ? ['Faith', 'Covenant'] : ['Secular', 'Rationalist'],
    expansion: lean > 0 ? ['Frontier', 'Pioneer'] : ['Homeland', 'Localist'],
  };
  const adjectives = {
    collectivism: lean2 > 0 ? 'Social' : 'Free', hierarchy: lean2 > 0 ? 'National' : 'Democratic', innovation: lean2 > 0 ? 'Progressive' : 'Traditional',
    martial: lean2 > 0 ? 'Patriotic' : 'Peaceful', piety: lean2 > 0 ? 'Faithful' : 'Secular', expansion: lean2 > 0 ? 'Greater' : 'Local',
  };
  const forms = ['Party', 'League', 'Union', 'Movement', 'Alliance', 'Front', 'Congress'];
  // A green movement grows where industry fouls the air and people want change.
  const core = advances(group).pollution > .15 && ideology.innovation > .5 && sim._random() < .3 ? 'Green' : pick(cores[key]);
  const adjective = Math.abs(lean2) > .08 && sim._random() < .6 ? `${adjectives[second]} ` : '';
  let name = `${adjective}${core} ${pick(forms)}`.replace(/^(\w+) \1 /, '$1 ');
  if (sim.polity.parties.some(party => party.groupId === group.id && party.name === name)) name = `New ${name}`;
  return name;
}

export function partiesOf(sim, group) { return (sim.polity?.parties || []).filter(party => party.groupId === group.id); }
export function rulingParty(sim, group) { return partiesOf(sim, group).find(party => party.inPower) || null; }
/** Whether this person leads a party. */
export function leadsParty(sim, agent) { return (sim.polity?.parties || []).some(party => party.leaderId === agent.id); }

/** Countries a society belongs to, if any. */
export function countryOf(sim, group) { return (sim.polity?.countries || []).find(country => country.members.includes(group.id)) || null; }

/** Monthly and staggered per society, plus yearly country formation. */
export function advancePolity(sim, hooks = {}) {
  if (!sim.polity) initializePolity(sim);
  for (const group of sim.groups) {
    if (sim.day % 30 !== (group.id + 17) % 30 || !group.civilization?.culture) continue;
    politics(sim, group, hooks);
  }
  if (sim.day % 120 === 60) countries(sim);
  // Parties and countries end with the societies that held them.
  sim.polity.parties = sim.polity.parties.filter(party => sim._groupMap.has(party.groupId));
}

function politics(sim, group, hooks) {
  const civ = group.civilization, culture = civ.culture;
  const organised = (civ.technologies.includes('governance') || civ.buildings.hall > 0) && group.members.length >= 12;
  const parties = partiesOf(sim, group);
  if (!organised) { if (parties.length) sim.polity.parties = sim.polity.parties.filter(party => party.groupId !== group.id); return; }
  const adults = group.members.map(id => sim._agentMap.get(id)).filter(agent => agent && agent.age >= 18);
  const views = new Map(adults.map(agent => [agent.id, stance(agent, group)]));
  // Support: each adult backs the nearest party.
  for (const party of parties) party.support = 0;
  let unrepresented = [];
  for (const agent of adults) {
    let best = null, nearest = Infinity;
    for (const party of parties) { const d = gap(views.get(agent.id), party.ideology); if (d < nearest) { nearest = d; best = party; } }
    if (best && nearest < .45) best.support++; else unrepresented.push(agent);
  }
  for (const party of parties) {
    party.share = round(party.support / Math.max(1, adults.length));
    // A party whose leader is gone chooses the most capable remaining supporter.
    if (!sim._agentMap.get(party.leaderId) || sim._agentMap.get(party.leaderId).groupId !== group.id) {
      const next = adults.filter(agent => gap(views.get(agent.id), party.ideology) < .45).sort((a, b) => b.skills.leadership - a.skills.leadership)[0];
      if (next) party.leaderId = next.id;
    }
  }
  // A party with almost no one behind it dissolves.
  for (const party of parties.filter(party => party.share < .04 && sim.day - party.founded > 720)) {
    sim.polity.parties = sim.polity.parties.filter(other => other !== party);
    if (party.inPower) culture.leaderSince = sim.day;
    sim._event('group', `The ${party.name} of ${group.name} dissolves for lack of support.`, { groupId: group.id });
  }
  // Founding: when enough people find no party that speaks for them, the most capable of them starts one.
  if (partiesOf(sim, group).length < 5 && unrepresented.length >= Math.max(3, adults.length * .15) && sim._random() < .25) {
    const founder = unrepresented.sort((a, b) => b.skills.leadership + b.mind.ambition * 30 - a.skills.leadership - a.mind.ambition * 30)[0];
    const circle = unrepresented.filter(agent => gap(views.get(agent.id), views.get(founder.id)) < .35);
    if (circle.length >= 3) {
      const ideology = Object.fromEntries(AXES.map(key => [key, round(circle.reduce((sum, agent) => sum + views.get(agent.id)[key], 0) / circle.length)]));
      const party = { id: `party-${sim.polity.nextParty++}`, name: partyName(sim, ideology, group), groupId: group.id, ideology, leaderId: founder.id, founded: sim.day, support: circle.length, share: round(circle.length / adults.length), inPower: false, since: sim.day, wins: 0 };
      sim.polity.parties.push(party);
      sim._event('group', `${founder.name} founds the ${party.name} in ${group.name}.`, { groupId: group.id, agentId: founder.id });
    }
  }
  const current = partiesOf(sim, group);
  if (!current.length) return;
  const leading = [...current].sort((a, b) => b.support - a.support)[0], ruling = current.find(party => party.inPower);
  const democratic = culture.norms.hierarchy < .55;
  const take = (party, how) => {
    for (const other of current) other.inPower = false;
    party.inPower = true; party.since = sim.day; party.wins++;
    const leader = sim._agentMap.get(party.leaderId);
    if (leader && leader.groupId === group.id) { culture.leaderId = leader.id; culture.leaderSince = sim.day; hooks.onLeader?.(leader, group); }
    sim._event('group', how, { groupId: group.id, ...(leader ? { agentId: leader.id } : {}) });
  };
  if (!ruling) take(leading, `The ${leading.name} forms the first government of ${group.name}.`);
  else if (democratic && sim.day - Math.max(ruling.since, ruling.lastElection ?? 0) >= 480) {
    for (const party of current) party.lastElection = sim.day;
    sim.polity.elections++;
    if (leading !== ruling) take(leading, `The ${leading.name} wins the election in ${group.name} with ${Math.round(leading.share * 100)}% support, defeating the ${ruling.name}.`);
    else { ruling.wins++; if (current.length > 1) sim._event('group', `The ${ruling.name} is re-elected in ${group.name} (${Math.round(ruling.share * 100)}%).`, { groupId: group.id }); }
  } else if (!democratic && leading !== ruling) {
    // Discontent under an unelected government can boil over.
    const people = adults.length || 1;
    const hardship = adults.filter(agent => agent.hunger > 40 || (agent._stress || 0) > 80).length / people;
    const unrest = clamp(hardship + advances(group).unrest * 2 + Math.max(0, leading.share - ruling.share));
    if (leading.share > ruling.share * 1.5 && sim._random() < unrest * .15) {
      sim.polity.revolutions++;
      take(leading, `Revolution in ${group.name}: the ${leading.name} overthrows the ${ruling.name}.`);
      culture.norms.hierarchy = round(clamp(culture.norms.hierarchy - .1));
    }
  }
  // Government: the ruling party's ideology pulls the society's norms, and so its policies.
  const governing = current.find(party => party.inPower);
  if (governing) for (const key of AXES) culture.norms[key] = round(clamp(culture.norms[key] + (governing.ideology[key] - culture.norms[key]) * .03));
}

function countryName(sim, capital, government) {
  const root = capital.name.split(' ')[0];
  const forms = { empire: [`${root} Empire`, `Empire of ${root}`], union: [`${root} Union`, `${root} Confederation`, `United ${root} Lands`], kingdom: [`Kingdom of ${root}`, `${root} Realm`], republic: [`${root} Republic`, `Republic of ${root}`, `Commonwealth of ${root}`] }[government];
  let name = forms[Math.floor(sim._random() * forms.length)];
  if (sim.polity.countries.some(country => country.name === name)) name = `${name} ${sim.polity.nextCountry}`;
  return name;
}

function governmentOf(capital, kind) {
  if (kind === 'empire') return 'empire';
  if (kind === 'union') return 'union';
  return (capital.civilization.culture?.norms.hierarchy ?? .5) >= .55 ? 'kingdom' : 'republic';
}

/** Yearly: countries gain and lose members, split and form. */
function countries(sim) {
  const polity = sim.polity;
  // Upkeep: members that vanished, broke away or went to war with the capital leave.
  for (const country of [...polity.countries]) {
    const capital = sim._groupMap.get(country.capitalId);
    if (!capital) { polity.countries = polity.countries.filter(other => other !== country); sim._event('group', `${country.name} falls apart with the loss of its capital.`, {}); continue; }
    const before = country.members.length;
    country.members = country.members.filter(id => {
      const member = sim._groupMap.get(id);
      if (!member) return false;
      if (id === country.capitalId) return true;
      const r = relationBetween(sim, capital, member);
      if (r?.status === 'war') { sim._event('war', `${member.name} breaks away from ${country.name}.`, { groupId: member.id }); return false; }
      return country.government === 'empire' ? overlordOf(sim, member) === capital || r?.status === 'alliance' || member.civilization.culture?.parentId === capital.id : r?.status === 'alliance' || member.civilization.culture?.parentId === capital.id || overlordOf(sim, member) === capital;
    });
    if (country.members.length < 2 && sim.day - country.founded > 240) {
      polity.countries = polity.countries.filter(other => other !== country);
      sim._event('group', `${country.name} dissolves as its members go their own ways.`, { groupId: capital.id });
      continue;
    }
    if (country.members.length < before) country.government = governmentOf(capital, tributariesOf(sim, capital).length >= 2 ? 'empire' : country.government === 'union' ? 'union' : 'state');
  }
  // Formation: a city with its colonies or allies, or an overlord with tributaries, proclaims a state.
  for (const group of [...sim.groups].sort((a, b) => b.members.length - a.members.length)) {
    if (countryOf(sim, group) || !group.civilization.culture) continue;
    const tier = group.civilization.culture.tier || 0;
    const ruled = tributariesOf(sim, group).filter(member => !countryOf(sim, member));
    const kin = sim.groups.filter(other => other !== group && !countryOf(sim, other) && (other.civilization.culture?.parentId === group.id || relationBetween(sim, group, other)?.status === 'alliance') && distance(group, other) < 120);
    let kind = null, members = null;
    if (ruled.length >= 2) { kind = 'empire'; members = [group, ...ruled, ...kin.filter(other => other.civilization.culture?.parentId === group.id)]; }
    else if (tier >= 3 && kin.length >= 1) { kind = 'state'; members = [group, ...kin]; }
    else if (tier >= 2 && kin.length >= 2) { kind = 'union'; members = [group, ...kin]; }
    if (!kind || sim._random() > .5) continue;
    const government = governmentOf(group, kind);
    const country = { id: `country-${polity.nextCountry++}`, name: countryName(sim, group, government), capitalId: group.id, members: [...new Set(members.map(member => member.id))], government, founded: sim.day, color: group.color };
    polity.countries.push(country);
    sim._event('group', `${country.name} is proclaimed, uniting ${country.members.length} societies with ${group.name} as its capital.`, { groupId: group.id });
  }
  // Growth: allies, colonies and tributaries of a capital join its country.
  for (const country of polity.countries) {
    const capital = sim._groupMap.get(country.capitalId);
    for (const other of sim.groups) {
      if (countryOf(sim, other) || !capital) continue;
      const r = relationBetween(sim, capital, other);
      if ((overlordOf(sim, other) === capital || (r?.status === 'alliance' && other.civilization.culture?.parentId === capital.id)) && sim._random() < .5) {
        country.members.push(other.id);
        sim._event('group', `${other.name} joins ${country.name}.`, { groupId: other.id });
      }
    }
  }
}

export function polityStats(sim) {
  const p = sim.polity;
  return { parties: p?.parties.length || 0, countries: p?.countries.length || 0, elections: p?.elections || 0, revolutions: p?.revolutions || 0 };
}

// ——— strict restore ———
export function restorePolity(raw, sim) {
  if (raw === undefined) return initializePolity(sim);
  const bad = field => { throw new Error(`Invalid polity save: ${field}.`); };
  const int = (value, field, min = 0, max = Number.MAX_SAFE_INTEGER) => (Number.isSafeInteger(value) && value >= min && value <= max ? value : bad(field));
  const num = (value, field, min = 0, max = 1) => (typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : bad(field));
  const text = (value, field) => (typeof value === 'string' && value.length && value.length <= 120 ? value : bad(field));
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.parties) || !Array.isArray(raw.countries)) bad('state');
  const nextParty = int(raw.nextParty, 'next party', 1), nextCountry = int(raw.nextCountry, 'next country', 1);
  const parties = raw.parties.map(party => {
    if (!party || typeof party !== 'object' || !/^party-[1-9]\d*$/.test(party.id) || Number(party.id.slice(6)) >= nextParty) bad('party ID');
    return { id: party.id, name: text(party.name, 'party name'), groupId: int(party.groupId, 'party society', 1, sim.nextGroupId - 1), ideology: Object.fromEntries(AXES.map(key => [key, num(party.ideology?.[key], 'ideology')])),
      leaderId: int(party.leaderId, 'party leader', 1, sim.nextAgentId - 1), founded: int(party.founded, 'party founding', 0, sim.day), support: int(party.support, 'support'), share: num(party.share, 'share'),
      inPower: party.inPower === true, since: int(party.since, 'in power since', 0, sim.day), wins: int(party.wins, 'wins'), ...(party.lastElection !== undefined ? { lastElection: int(party.lastElection, 'last election', 0, sim.day) } : {}) };
  });
  const countries = raw.countries.map(country => {
    if (!country || typeof country !== 'object' || !/^country-[1-9]\d*$/.test(country.id) || Number(country.id.slice(8)) >= nextCountry) bad('country ID');
    if (!['empire', 'union', 'kingdom', 'republic'].includes(country.government) || !Array.isArray(country.members) || !country.members.length) bad('country');
    if (!/^#[0-9a-f]{6}$/i.test(country.color)) bad('country colour');
    const members = country.members.map(id => int(id, 'member', 1, sim.nextGroupId - 1));
    const capitalId = int(country.capitalId, 'capital', 1, sim.nextGroupId - 1);
    if (!members.includes(capitalId)) bad('capital membership');
    return { id: country.id, name: text(country.name, 'country name'), capitalId, members, government: country.government, founded: int(country.founded, 'founded', 0, sim.day), color: country.color };
  });
  return { nextParty, parties, nextCountry, countries, elections: int(raw.elections, 'elections'), revolutions: int(raw.revolutions, 'revolutions') };
}
