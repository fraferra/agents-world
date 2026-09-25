/** Companies and entrepreneurs.
 *
 * In a society that knows commerce, ambitious, open and well-off people found
 * firms around what their town actually runs: factories, mines, railways,
 * ports, power stations, computer centres, farms and markets. Each month a
 * firm earns a share of the value its sector produced in the societies where it
 * operates, pays wages to the people who do that work, and splits the profit
 * between its owner and its capital. Capital builds more of the firm's kind of
 * works (the investment that drives an industrial boom), opens branches in
 * partner societies (a corporation) and carries it through lean months. Firms
 * that keep losing money go bankrupt; an owner's firm passes to their richest
 * child, or is wound up.
 */
import { VALUE, BUILDINGS } from './civilization.js';
import { addWealth } from './economy.js';
import { reachable } from './infrastructure.js';

export const SECTORS = Object.freeze({
  manufacturing: { name: 'Manufacturing', building: 'factory', technology: 'steam', products: ['machines', 'tools', 'goods', 'electronics'], roles: ['Engineer', 'Factory worker', 'Smith', 'Artisan'], word: ['Works', 'Manufacturing', 'Industries'] },
  mining: { name: 'Mining', building: 'forge', technology: 'metallurgy', products: ['coal', 'ore', 'stone', 'uranium'], roles: ['Miner'], word: ['Mining', 'Collieries', 'Minerals'] },
  railway: { name: 'Railways', building: 'railway', technology: 'railways', products: [], roles: ['Merchant', 'Engineer'], word: ['Railway', 'Rail Company', 'Lines'] },
  shipping: { name: 'Shipping', building: 'dock', technology: 'navigation', products: ['food'], roles: ['Sailor', 'Fisher', 'Merchant'], word: ['Shipping', 'Line', 'Navigation Company'] },
  energy: { name: 'Energy', building: 'powerplant', technology: 'electricity', products: [], roles: ['Engineer'], word: ['Power', 'Electric', 'Energy'] },
  technology: { name: 'Technology', building: 'datacenter', technology: 'computing', products: ['electronics'], roles: ['Scientist', 'Programmer'], word: ['Systems', 'Computing', 'Technologies'] },
  agriculture: { name: 'Agriculture', building: 'farm', technology: 'cultivation', products: ['food'], roles: ['Farmer', 'Herder'], word: ['Farms', 'Estates', 'Agricultural Company'] },
  commerce: { name: 'Commerce', building: 'market', technology: 'commerce', products: ['cloth', 'goods'], roles: ['Merchant'], word: ['Trading', 'Merchants', 'Exchange'] },
});
const round = value => Math.round(value * 100) / 100 || 0;
const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));

export function initializeEnterprise(sim) {
  sim.enterprise = { nextId: 1, companies: [], founded: 0, failed: 0 };
  return sim.enterprise;
}

/** Firms currently operating in a society. */
export function companiesIn(sim, group) { return (sim.enterprise?.companies || []).filter(company => company.branches.includes(group.id)); }
/** Whether this person owns a firm. */
export function ownsCompany(sim, agent) { return (sim.enterprise?.companies || []).some(company => company.ownerId === agent.id); }

const sectorValue = (civ, sector) => SECTORS[sector].products.reduce((sum, key) => sum + (civ.production[key] || 0) * (VALUE[key] ?? 0), 0);

/** What a firm of this sector earns in one society this month: a share of what the sector produced there, or of its services. */
function earnings(sim, company, group) {
  const civ = group.civilization, sector = SECTORS[company.sector];
  const value = sectorValue(civ, company.sector), last = company.ledger[group.id] ?? value;
  company.ledger[group.id] = round(value);
  const rivals = companiesIn(sim, group).filter(other => other.sector === company.sector).length;
  let revenue = Math.max(0, value - last) * .3 / Math.max(1, rivals);
  // Services earn from what they carry or supply rather than from goods made.
  if (company.sector === 'railway') revenue += (sim.infrastructure?.links.filter(link => link.kind === 'rail' && (link.a === group.id || link.b === group.id)).length || 0) * 1.5;
  if (company.sector === 'shipping') revenue += (sim.infrastructure?.links.filter(link => link.kind === 'sea' && (link.a === group.id || link.b === group.id)).length || 0) * 1.5 + (civ.buildings.dock ? .5 : 0);
  if (company.sector === 'energy') revenue += (civ.buildings.powerplant || civ.buildings.reactor ? group.members.length * .06 : 0);
  if (company.sector === 'commerce') revenue += civ.tradePartners.length * .8;
  return revenue * (sector.building && !civ.buildings[sector.building] ? .2 : 1);
}

function nameFor(sim, founder, sector, group) {
  const surname = founder.name.split(' ').at(-1), region = group.name.split(' ')[0], words = SECTORS[sector].word;
  const word = words[Math.floor(sim._random() * words.length)];
  const forms = [`${surname} ${word}`, `${surname} & Co.`, `${region} ${word}`, `${surname} Brothers ${word}`, `United ${region} ${word}`];
  let name = forms[Math.floor(sim._random() * forms.length)];
  if (sim.enterprise.companies.some(company => company.name === name)) name = `${name} ${sim.enterprise.nextId}`;
  return name;
}

/** Monthly and staggered: entrepreneurs found firms, firms trade, invest, expand, fail or pass to heirs. */
export function advanceEnterprise(sim) {
  if (!sim.enterprise) initializeEnterprise(sim);
  for (const group of sim.groups) {
    if (sim.day % 30 !== (group.id + 3) % 30 || !group.civilization) continue;
    const civ = group.civilization;
    for (const company of companiesIn(sim, group)) if (company.homeId === group.id) operate(sim, company);
    if (!civ.technologies.includes('commerce')) continue;
    // Entrepreneurship: the ambitious, open and well-off start firms around what their town runs.
    const collectivism = civ.culture?.norms.collectivism ?? .5;
    const people = group.members.map(id => sim._agentMap.get(id)).filter(agent => agent && agent.age >= 20 && agent.age < 60);
    const wealthy = people.map(agent => agent.wealth || 0).sort((a, b) => b - a)[Math.floor(people.length / 4)] || 0;
    for (const agent of people) {
      if ((agent.wealth || 0) < Math.max(6, wealthy) || agent.mind.ambition < .55 || (agent.psyche?.personality.openness ?? .5) < .45 || ownsCompany(sim, agent)) continue;
      if (sim._random() > .03 * (1.3 - collectivism)) continue;
      const present = companiesIn(sim, group).map(company => company.sector);
      const options = Object.entries(SECTORS).filter(([key, sector]) => civ.technologies.includes(sector.technology) && (!sector.building || civ.buildings[sector.building] > 0) && present.filter(s => s === key).length < 2);
      if (!options.length) break;
      const [sector] = options[Math.floor(sim._random() * options.length)];
      const capital = round(agent.wealth * .6);
      agent.wealth = round(agent.wealth - capital);
      foundCompany(sim, agent, group, sector, capital);
      break;
    }
  }
  // Firms whose home and every branch have gone are wound up.
  sim.enterprise.companies = sim.enterprise.companies.filter(company => {
    company.branches = company.branches.filter(id => sim._groupMap.has(id));
    if (!company.branches.length) { sim.enterprise.failed++; return false; }
    if (!company.branches.includes(company.homeId)) company.homeId = company.branches[0];
    return true;
  });
}

/** Registers a new firm owned by `agent` in `group`. */
export function foundCompany(sim, agent, group, sector, capital) {
  const company = { id: `firm-${sim.enterprise.nextId++}`, name: nameFor(sim, agent, sector, group), sector, founderId: agent.id, ownerId: agent.id, homeId: group.id, branches: [group.id],
    capital: round(capital), revenue: 0, profit: 0, employees: 0, founded: sim.day, losses: 0, history: [], ledger: {} };
  company.ledger[group.id] = round(sectorValue(group.civilization, sector));
  sim.enterprise.companies.push(company);
  sim.enterprise.founded++;
  const kind = SECTORS[sector].name.toLowerCase();
  sim._event('industry', `${agent.name} founds ${company.name}, ${/^[aeiou]/.test(kind) ? 'an' : 'a'} ${kind} firm in ${group.name}.`, { groupId: group.id, agentId: agent.id });
  return company;
}

function operate(sim, company) {
  const sector = SECTORS[company.sector];
  let revenue = 0, employees = 0, wages = 0;
  for (const id of company.branches) {
    const group = sim._groupMap.get(id);
    if (!group) continue;
    revenue += earnings(sim, company, group);
    // Wages go to the people who do the sector's work.
    const workers = group.members.map(member => sim._agentMap.get(member)).filter(agent => agent && sector.roles.includes(agent.mind.role));
    const share = companiesIn(sim, group).filter(other => other.sector === company.sector).length || 1;
    employees += Math.round(workers.length / share);
    const pay = Math.min(revenue * .5, workers.length / share * .12);
    for (const worker of workers) addWealth(worker, pay / Math.max(1, workers.length));
    wages += pay;
  }
  const profit = round(revenue - wages - company.branches.length * .1);
  company.revenue = round(company.revenue * .7 + revenue * 12 * .3);
  company.profit = round(company.profit * .7 + profit * 12 * .3);
  company.employees = employees;
  const owner = sim._agentMap.get(company.ownerId);
  if (profit > 0) { company.capital = round(company.capital + profit * .6); if (owner) addWealth(owner, round(profit * .4)); }
  else company.capital = round(company.capital + profit);
  company.losses = profit < 0 ? company.losses + 1 : 0;
  if (sim.day - company.founded >= 120 && (sim.day - company.founded) % 120 < 30) { company.history.push(round(company.capital)); if (company.history.length > 20) company.history.shift(); }
  const home = sim._groupMap.get(company.homeId);
  // Inheritance: a dead owner's richest child takes over; otherwise the firm is wound up.
  if (!owner) {
    const heir = sim.agents.filter(agent => agent.parentIds.includes(company.ownerId) && agent.age >= 18).sort((a, b) => (b.wealth || 0) - (a.wealth || 0))[0];
    if (heir) { company.ownerId = heir.id; sim._event('industry', `${heir.name} inherits ${company.name}.`, { agentId: heir.id, groupId: company.homeId }); }
    else { wind(sim, company, 'its owner died without heirs'); return; }
  }
  if (company.capital < -5 || company.losses >= 18) { wind(sim, company, 'it ran out of money'); return; }
  if (!home) return;
  // Investment: capital builds more of the firm's kind of works where they are wanted.
  const kind = sector.building, cost = kind && BUILDINGS[kind]?.cost;
  if (kind && cost && home.civilization.technologies.includes(BUILDINGS[kind].technology)) {
    const price = Object.entries(cost).reduce((sum, [key, amount]) => sum + amount * (VALUE[key] ?? 1), 0) * 1.5;
    const target = Math.max(1, Math.ceil(home.members.length / (kind === 'farm' ? 12 : 30)));
    if (company.capital >= price && home.civilization.buildings[kind] < target) {
      company.capital = round(company.capital - price);
      home.civilization.buildings[kind]++;
      sim._event('industry', `${company.name} builds a ${BUILDINGS[kind].name.toLowerCase()} in ${home.name}.`, { groupId: home.id });
    }
  }
  // Expansion: with capital to spare, a firm opens in a partner society that runs its kind of works.
  if (company.capital >= 60 && company.branches.length < 6) {
    const partner = sim.groups.find(other => !company.branches.includes(other.id) && home.civilization.tradePartners.includes(other.id) && reachable(sim, home, other)
      && other.civilization.technologies.includes(sector.technology) && (!kind || other.civilization.buildings[kind] > 0));
    if (partner) {
      company.branches.push(partner.id); company.capital = round(company.capital - 20);
      company.ledger[partner.id] = round(sectorValue(partner.civilization, company.sector));
      sim._event('industry', `${company.name} opens in ${partner.name}${company.branches.length === 3 ? ', becoming a corporation' : ''}.`, { groupId: partner.id });
    }
  }
}

function wind(sim, company, why) {
  sim.enterprise.companies = sim.enterprise.companies.filter(other => other !== company);
  sim.enterprise.failed++;
  sim._event('industry', `${company.name} is wound up: ${why}.`, { groupId: company.homeId });
}

export function enterpriseStats(sim) {
  const companies = sim.enterprise?.companies || [];
  return { companies: companies.length, corporations: companies.filter(company => company.branches.length >= 3).length };
}

// ——— strict restore ———
export function restoreEnterprise(raw, sim) {
  if (raw === undefined) return initializeEnterprise(sim);
  const bad = field => { throw new Error(`Invalid enterprise save: ${field}.`); };
  const num = (value, field, min = -1e12, max = 1e12) => (typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : bad(field));
  const int = (value, field, min = 0, max = Number.MAX_SAFE_INTEGER) => (Number.isSafeInteger(value) && value >= min && value <= max ? value : bad(field));
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.companies)) bad('state');
  const nextId = int(raw.nextId, 'next ID', 1), seen = new Set();
  const companies = raw.companies.map(company => {
    if (!company || typeof company !== 'object' || !/^firm-[1-9]\d*$/.test(company.id) || Number(company.id.slice(5)) >= nextId || seen.has(company.id)) bad('firm ID');
    seen.add(company.id);
    if (!SECTORS[company.sector] || typeof company.name !== 'string' || !company.name.length || company.name.length > 80) bad('firm');
    if (!Array.isArray(company.branches) || !company.branches.length || !Array.isArray(company.history) || company.history.length > 20) bad('firm branches');
    const ledger = {};
    for (const [key, value] of Object.entries(company.ledger || {})) ledger[key] = num(value, 'ledger', 0);
    return { id: company.id, name: company.name, sector: company.sector, founderId: int(company.founderId, 'founder', 1, sim.nextAgentId - 1), ownerId: int(company.ownerId, 'owner', 1, sim.nextAgentId - 1),
      homeId: int(company.homeId, 'home', 1, sim.nextGroupId - 1), branches: company.branches.map(id => int(id, 'branch', 1, sim.nextGroupId - 1)), capital: num(company.capital, 'capital'), revenue: num(company.revenue, 'revenue'),
      profit: num(company.profit, 'profit'), employees: int(company.employees, 'employees'), founded: int(company.founded, 'founding day', 0, sim.day), losses: int(company.losses, 'losses'), history: company.history.map(value => num(value, 'history')), ledger };
  });
  return { nextId, companies, founded: int(raw.founded, 'founded'), failed: int(raw.failed, 'failed') };
}

/** Clamp for callers that weigh how corporate a society is. */
export function corporatePresence(sim, group) { return clamp(companiesIn(sim, group).length / 4); }
