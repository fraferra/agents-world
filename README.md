# Common Ground

A persistent 2D sandbox for watching a society develop from individual choices. Agents pursue personal goals, forage, learn skills, exchange ideas, conduct collaborative experiments, invent designs and traditions, build industries, trade, form alliances, wage wars, raise children, migrate, and die. Societies emerge from repeated encounters; there is no scripted sequence of events.

**Play online:** https://fraferra.github.io/agents-world/ (runs entirely in your browser; your worlds are saved in your own browser).

## Run the world

Requires Node.js 20 or newer. No packages, accounts, API keys, or network services are required.

```sh
npm start
```

Open **http://127.0.0.1:4173**. An initial world starts automatically with 120 people, a large 224 × 144 world, and the seed `moss-17`. `npm run dev` is equivalent. To choose a different port:

```sh
npm start -- --port 8080
```

Use a current desktop browser supporting module workers, Canvas 2D, and IndexedDB. The layout also adapts to phones. Serve the app through the included server; opening `index.html` as a local file will not work with module workers.

## Observe and experiment

- **Watch the map:** drag to pan, scroll or use +/− to zoom. Fit resets the camera. Individuals move around an illustrated landscape; society labels and shelters appear as groups develop.
- **Inspect people:** click someone on the map, choose “Meet someone,” or use the searchable People list. Read their current thought, life aspiration, personality, feelings, talents, needs, values, beliefs, and plans. See how their leading options were weighed, factor by factor. You can also see their skills, the techniques they know and who taught them, what they enjoy, what experience says pays off, places they remember, the people they know (with trust and known expertise), formative and recent memories, family, and inventory. Follow them across the world.
- **Change the view:** Landscape shows terrain and productive buildings; Societies shows each society's territorial claim; Food shows abundance; Materials shows fertility, stone, ore, clay banks, fishing grounds, gem seams, coal and uranium; Ideas shows actual recent communication between living agents; Relations shows recorded wars, alliances, trade contacts, and prevailing belief traditions.
- **Control time:** pause/resume with the button or Space; step one day while paused. Speeds range from 1× (4 days/second) to 100× (up to 400 days/second, depending on the machine).
- **Observe societies:** the observation deck shows membership, culture, shelters, food stores, research, and a chronicle of discoveries and social events. Voices shows actual conversations and what was learned. Inventions shows generated recipes, quantitative gains and tradeoffs, trials, and design ancestry. Beliefs shows shared traditions and doctrines; Relations shows trust, tensions, treaties, raids, and casualties. Foundations retains the basic technique graph, and Industry shows workforce, stocks, production, and the effects of adopted ideas.
- **Change conditions and perform acts of god:** adjust resource renewal, cooperation, or fertility. From World conditions, change circumstances with 14 acts. World-wide: rainfall, drought, harsh winter, food aid, blessing the land, plague, festival, dark omen, a spark of genius. On a region you choose (or one fate picks): wanderers arrive, earthquake, wildfire, flood, mineral strike. Acts work through the same resources, bodies and minds the inhabitants live with; people still decide how to respond. A map badge shows ongoing plague or winter, and every act is recorded in the chronicle.
- **Explore cultures:** the Cultures tab shows each society's tier (band, village, town, city), character, leader, lineage of colonies, shared norms against the world average, customs, land pressure, and diet.
- **Start an experiment:** choose a seed, population, scenario, and world size: compact (96 × 64), standard (160 × 104), large (224 × 144), vast (320 × 208), or immense (400 × 260). Starting a new world exports the previous world before replacing it.

Seeds and parameters determine the simulation. Restoring the same save and applying the same interventions on the same days produces the same outcome; rendering and playback speed do not change the random sequence. Worlds can flourish or go extinct. Extreme overcrowding and scarcity may collapse a population.

## Save and continue

Version 1–5 worlds upgrade automatically to version 6, preserving inhabitants, terrain, families, existing knowledge, resources, and elapsed time. Old population ceilings are discarded. Missing state is added deterministically without changing the saved random state: soil, generated ideas and diplomacy; each inhabitant's inner life and pioneering drive; each tile's new deposits; each society's culture, derived from its members; and each person's sex (existing partners become mixed-sex couples) and life course. Worlds keep their original dimensions; choose New world for the larger maps. The new behavior changes future outcomes, so continuation is deterministic within version 6 rather than identical to the old model.

The browser autosaves to IndexedDB every minute and when the tab is hidden or closed, retaining the previous checkpoint as a recovery copy. Opening the app at the same address restores the saved world. Use the download icon for a permanent JSON checkpoint; “Import a saved world” restores an exported browser or headless world and pauses it for inspection. Malformed saves are rejected before replacing the current world. Import also exports the previous world first.

The page stays light during long runs. The simulation runs in a worker, which sends the page only what changed: everyone's position and outward state, with a full mind and memories only for the person being inspected, newly recorded ideas rather than the whole registry, and idea holder counts rather than everyone's list. The map arrives as compact binary arrays every three seconds, moved rather than copied, and the page updates its tiles in place. A hidden tab is updated only every five seconds. Autosaves alternate between two slots, so saving never reads the previous world back into memory.

Keep one active browser tab per experiment: multiple tabs at the same address share the autosave slot. Browser storage belongs to its exact origin (including the port), and clearing site data removes it. Export files for experiments you want to keep. Closing the tab can lose changes since the latest completed autosave.

The browser runs the model in a worker so the interface stays responsive. **It does not keep simulating when the browser is closed or the computer is asleep.** Background tabs may be throttled. For uninterrupted runs without a browser, use the headless runner and keep the computer awake:

```sh
# Run 1,000 model years and create a browser-compatible checkpoint.
npm run simulate -- --years 1000 --seed moss-17 --size large --save world.json --report report.json

# Continue the same world for another 1,000 years.
npm run simulate -- --years 1000 --load world.json --save world.json
```

To continue a browser experiment headlessly, export it and pass that file to `--load`. Import the resulting `--save` file to see the developed world. `--years` is the additional duration, not a target year; it supports up to 100,000 years per invocation. With `--save`, the runner writes atomic checkpoints every 30 seconds, at completion, and on Ctrl+C. Reports contain final metrics and the bounded population history. `npm run simulate -- --help` lists all options.

## What is modeled

| System | Behavior |
| --- | --- |
| World | Five sizes up to 400 × 260: continents, river valleys, forests, grassland, sand, mountains, coastal straits, and 12–30 named regions. Larger worlds have more rivers and finer terrain features, not just more tiles. |
| Resources | Ten tile resources. Renewable: wild food, timber, fiber (grass and reeds), herbs, game (hunted; herds recover logistically, so over-hunting lasts), and fish (on shores and riverbanks). Finite: stone, ore, clay (along rivers and shores) and rare gems (in high ground). Deposits come from seeded noise, so older saves gain the same ones. |
| Ecology | Food, wood, fiber, herbs, game, fish and soil nutrients renew at terrain-dependent rates. Farms consume the actual soil of nearby plots; overlapping farms share that budget. Seasons, drought, winter, soils, irrigation, and generated designs affect production. Food, hides, herbs and remedies spoil; equipment and clothing wear out. |
| Individuals | Physical needs plus purpose and stimulation interact with inherited values, ambition, patience, risk tolerance, local beliefs, memories, skill, and short plans. Each person also has an inner life: an inherited five-factor personality and talents, emotions that respond to events, long-term memories that fade unless formative, learned tastes and expectations for each kind of work, a life aspiration, remembered places, and a life record. These adjust every decision, and the inspector shows each adjustment. See [Inner lives](MODEL.md#inner-lives). |
| Techniques | Sixteen practical techniques, two per skill (for example crop rotation, vein reading, tempering, poultices, mediation). Each multiplies its holder's real output. People work them out through sustained practice or learn them from someone more skilled. Advanced techniques require the basic one and real proficiency. |
| Relationships | Nearby encounters build bonds, transmit techniques, teach skills, and update resource beliefs. Each person keeps a personal trust level for the people they know, remembers what those people are good at, and tracks favours received. Gifts, lessons, and healing build trust; gossip spreads reputations. Conversations also pass on directions to resources and advice from experience, and moods spread between speakers. Agents form pairs, raise children, and grieve losses in proportion to closeness. When no one suitable lives in their own band, single adults travel to a nearby band that isn't at war with their own (allied, trading and kin bands draw them farther), court there, and marry. The couple settles in whichever band is larger and better fed, and each marriage builds trust between the two bands. Curious people explore far from camp, noting food and materials, and restless ones scout distant land. |
| Societies | Friends form groups, share stores, pool research effort, build infrastructure, trade goods, and preserve knowledge in schools and libraries. Societies grow from band to village, town, city and metropolis, and choose leaders by the trust others place in them; hierarchical societies keep leaders for life, egalitarian ones rotate them. Groups can move and dissolve; migration abandons some buildings. |
| Culture | Eight shared norms (invention, tradition, community, hierarchy, martial spirit, trade, devotion, expansion) drift toward members' dispositions, what the society lives through (war, disaster, trade, age) and its leader. Customs emerge from material life: cuisines from the dominant food source, crafts from what is made most, festivals from shared experience, rites from dominant norms, and building styles. They strengthen with practice, fade when their basis goes, spread through trade and alliance, pass to colonies, reinforce their norms, and change real effects. Children and newcomers absorb their society's values. Invention topics and new beliefs follow culture. |
| Expansion | Each person has a pioneering drive from temperament, felt crowding and culture; driven people scout distant land and remember good sites, and some hold the life goal of founding a settlement. Societies weigh expansion through land pressure, expansionist norms, eager members and their leader. Willing pioneers found colonies at scouted or promising sites, carrying a fair share of stores and all known techniques, and stay allied by kinship. Territorial claims grow with size and tier; overlapping claims create rivalry only between expansionist peoples. |
| Skills | Foraging, farming, forestry, mining, crafting, scholarship, medicine, and leadership improve through relevant work and teaching, at a pace set by inherited talent. Skills above a basic floor fade slowly when not practised, so specialists emerge. Skill changes actual gathering, production, healing, and research output. |
| Worlds | A large main continent with seed-dependent coasts, mountain spines, rivers and lakes, plus islands and archipelagos. People start on the continent and reach islands by canoe, sailing ship, steamship and eventually aircraft; ports and airports open sea and air routes. Sizes from compact to colossal (640 × 416). |
| Research | Thirty technologies unlock infrastructure: twenty-one foundations from hunting, herbalism and weaving to brickmaking, masonry, commerce, philosophy, astronomy, governance and navigation, then chemistry, the steam engine, railways, vaccines, electricity, aviation, computers, nuclear fission and nuclear weapons. Later technologies reshape the society that adopts them: machines multiply labor and concentrate wealth, coal smoke sickens, hospitals save children, computers speed research, and nuclear arsenals deter war or devastate a city. A finished idea needs a real demonstration that consumes materials (for example clay for brickmaking, gems for astronomy). Societies choose research by what their land offers, what they lack, and what their culture prizes. Beyond these, agents compose and recombine material recipes with continuous parameters and real tradeoffs. Labor and material trials can fail and produce revised hypotheses; successful designs spread through learning. There is no fixed count of possible discoveries. |
| Beliefs and diplomacy | Invented traditions spread through individual conviction. Solidarity, openness, authority, militancy, and spirituality vary independently. Prevailing doctrines change cooperation, production, learning, trade, and combat. Local contact and scarcity can produce rivalry; exchange builds trust and alliances. Wars consume resources, injure people, transfer loot, damage infrastructure, and end in truces. |
| Breakthroughs | Beyond the written tree, researchers combine what their society knows from different fields into new, generated technologies: machines, weapons, energy, medicine, agriculture, transport, information, materials and social institutions. Names, effects and side effects are drawn for each combination, depth grows without limit, and automation and research advances can drive runaway growth. They spread between societies and are listed in the Breakthroughs tab. |
| Society & politics | Modern occupations (doctors, engineers, scientists, teachers, miners, sailors, merchants, soldiers, politicians, entrepreneurs). Entrepreneurs found companies that earn from real production, pay wages, reinvest in works, expand into corporations and go bankrupt. Parties form around shared values with generated names, win elections or fall to revolutions, and steer their society's policies. Societies unite into empires, kingdoms, republics and unions that can split apart. Countries, Parties and Companies tabs list them. |
| Industry | Twenty-seven buildings require discoveries and materials, some of them processed. Farms, workshops, lumbermills, kilns, granaries, forges, schools, clinics, fisheries, loom houses, apothecaries, pastures, markets, libraries, temples, walls, observatories, halls and docks, then factories, railways, hospitals, power stations, computer centres, nuclear reactors and missile silos, which run on finite coal and uranium. Production chains: kilns fire clay into pottery and bricks; looms weave fiber into cloth; apothecaries prepare herbs into remedies; forges smelt ore into metal; pastures turn grass into food and hides. Institutions have real effects: libraries speed research, markets settle two exchanges per visit, walls strengthen defense, observatories improve and protect harvests, docks extend trade, temples and halls hold communities together. Cloth and hides keep people warm in winter; remedies strengthen healing and resist plague. A varied diet of wild food, crops, game, fish and herds helps people recover. Trade exchanges tools, cloth, remedies, pottery, metal, bricks, hides and gems for food. |
| Reproduction | People have a sex and an attraction pattern; partnership needs mutual attraction, and mixed-sex couples can have children. A woman's fertility follows a natural age schedule (about 15–49, peaking in her twenties), scaled by nutrition. After each birth comes a period of lactational infertility: about 3.1 years between births for mobile foragers, about 2.4 for settled farmers and herders (the Neolithic demographic transition). Children inherit varied traits and mature into adults. |
| Mortality | Every person faces age-specific Siler hazards fitted to real small-scale societies (Gurven & Kaplan 2007): high infant and child mortality, about 1% a year in early adulthood, and exponential ageing. Medicine, clinics and remedies move these toward the values of populations with healthcare; hunger, crowding, sedentism and livestock (endemic disease) and epidemics push them up. Starvation, war and disasters add their own deaths. |
| Economy & inequality | People keep a private share of what they produce, most where wealth can be defended (herds, farmland) and least among foragers and in communal cultures. Demand sharing levels holdings, and estates pass to heirs at rates that differ by economy. Wealth feeds its owner's household first, attracts partners, supports leadership and lends a voice weight; being far poorer than one's neighbours is stressful. Inequality emerges near the measured values: Gini about 0.25 for foragers, rising to about 0.48 for agriculturalists (Borgerhoff Mulder et al. 2009). |
| Environment & disease | A persistent climate anomaly makes dry and wet years come in runs. Woodland regrows over decades once cleared. Epidemics arise where people crowd together with animals and trade widely, travel along trade routes and alliances, and leave survivors immune for a while. |
| Politics | Groups beyond their organisational capacity split along lines of friendship (scalar stress); hierarchy, leaders, halls and governance raise that capacity. Overwhelmed sides in war can be conquered: small peoples are absorbed, larger ones become tributaries that keep their people and culture but pay part of their food and goods to an overlord (circumscription). Far stronger expansionist or martial powers can also demand submission without a war. Tributaries resent their overlord and rebel when they grow strong or the overlord is busy elsewhere, and long-ruled nearby ones may be annexed. A society with three tributaries is an empire. Dwindling bands of fewer than five join a nearby friendly band rather than dying out. A society forgets techniques no living member knows unless writing and a school or library preserve them (the collective brain). |

One simulation year is **120 days**. Parameters come from empirical research where it exists: see [REALISM.md](REALISM.md) for the evidence, sources, validation targets and the next phases. Pregnancy and genetics beyond trait inheritance are not modeled explicitly. **There is no numerical population ceiling.** Food security, accessible renewable resources, soil, technology, health, pairing, and aging determine demographic outcomes. The carrying-capacity number is an estimate, never a birth cutoff. Large worlds may simulate more slowly; performance never disables births.

This is a rule-based artificial-life model, not an LLM-driven society or a prediction of human behavior. Communication enacts structured information exchange using readable templates. Novel designs emerge within explicit material, process, and social primitives; agents do not invent arbitrary code, scientific laws, or unconstrained prose. Foundation buildings remain a fixed catalog. Barter uses a fixed food/tool exchange, with abstract transport, rather than a price-setting market. See [MODEL.md](MODEL.md) for the invention algorithm, policy, resource accounting, and conflict rules.

Customs are bounded too: at most six per society, and a registry of 400 customs from which ones no society still practices are forgotten first. Narrative memory is bounded: the latest 120 events, 80 conversations, at most 720 history points, and per individual eight recent memories, 12 long-term episodic memories, eight remembered places, and 12 remembered relationships. History progressively thins older samples while preserving the origin and recent detail. Living agents retain parent IDs and up to 64 child IDs. There is no complete archive of dead individuals or unlimited family tree. Living people, the invention registry, and retained design ancestry are not truncated to these history limits, so large or very old worlds require more memory and larger checkpoints.

## Checks and implementation

```sh
npm test
```

The tests cover deterministic seeds, exact save/resume, legacy migrations, resource scarcity, population accounting, reproduction, research prerequisites and cooperation, communication effects, skill-dependent yields, material consumption, depletion, bounded state, malformed saves, CLI checkpoints, and local-server path handling. Browser checks cover the richer mind inspector, Knowledge/Industry/Voices panels, real communication overlays, large worlds, legacy imports, autosave restore, and mobile layout.

The test suite checks exact save/resume, earlier-save migration, births and imports beyond the former 600 and 1,000 limits, finite shared soil, material-consuming failed experiments, new quantitative designs beyond the foundation graph, belief adoption, resource-conserving trade and raids, and multi-generation turnover. Persistence is an outcome, not a guarantee; worlds can still collapse from scarcity.

The app uses native JavaScript modules and Canvas without runtime dependencies:

- `src/simulation.js`: shared deterministic model, validation, and serialization.
- `src/civilization.js`: individual cognition, utility policy, communication, learning, research, and industries.
- `src/resources.js`: tile resources, their seeded placement and renewal.
- `src/culture.js`: norms, customs, tiers and leaders.
- `src/expansion.js`: land pressure, colonies and territorial claims.
- `src/acts.js`: acts of god and ongoing conditions (plague, winter).
- `src/psyche.js`: inner lives: personality, talents, emotion, episodic and spatial memory, learned preferences, aspirations, techniques, social cognition, and their strict save validation.
- `src/innovation.js`: generated experiments, belief traditions, adoption, and effect aggregation.
- `src/diplomacy.js`: local relations, trade access, alliances, costly warfare, and truces.
- `src/worker.js`: browser simulation loop and command protocol.
- `src/world-view.js`: cached terrain illustration and interactive agent rendering.
- `src/main.js`, `src/style.css`, `index.html`: observation UI.
- `src/storage.js`: local autosaves and portable save envelopes.
- `scripts/simulate.mjs`: headless runner using the identical model.
- `server.mjs`: localhost static server.

Optional browser checks use an isolated running Chromium instance with a DevTools port: `node scripts/browser-check.mjs 9225 http://127.0.0.1:4173`. They create a test world in that browser profile, download checkpoints, and write screenshots under `/tmp/common-ground-check`.
