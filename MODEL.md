# Minds, invention, and society

Each person makes a daily choice from their needs, values, memories, skills, knowledge, and local opportunities. No controller assigns the whole population to jobs. Group stores and shared projects let independently chosen work accumulate.

## Needs and decisions

Physical needs include food, health, energy, and social connection. People also seek purpose and stimulation. Five individual values weight security, belonging, autonomy, mastery, and care; ambition, patience, risk tolerance, and inherited traits vary. Children inherit traits with variation, but must learn practical skills and ideas.

Immediate survival takes priority over advanced work. Otherwise, a utility policy scores research, invention, reflection, farming, construction, material gathering, manufacturing, studying, teaching, healing, barter, and everyday life. Scores depend on needs, values, expertise, actual missing materials, local opportunities, and seeded variation. Patience favors continuing a short plan. The inspector exposes the selected reason and competing scores. These plans are structured intentions, not natural-language or symbolic general intelligence.

Shared food can support specialization. Every action consumes a day and demanding work consumes energy. Practice improves relevant skills; experienced people can teach others.

## Inner lives

Beyond needs and values, each person has an inner life (`src/psyche.js`). Every part of it changes behaviour.

- **Temperament.** Five personality dimensions (openness, conscientiousness, extraversion, agreeableness, neuroticism) correlate with the older traits and are inherited with variation. Each skill also has an inherited talent (0.5–1.6×) that sets how fast practice becomes proficiency.
- **Emotion.** Joy, pride, fear, anger, and grief rise with events: births, partnerships, discoveries, failed trials, raids, hunger, and deaths (grief scales with closeness). They decay toward a temperament-dependent baseline; grief fades slowest and neurotic people feel losses more strongly. Mood colours happiness and decisions, and joy and fear spread a little in conversation. Mediators calm anger.
- **Memory.** Alongside the eight recent moments, people keep up to 12 long-term episodes with emotional valence and salience. At a monthly reflection, salience fades: formative memories over decades, ordinary ones over seasons, and the weakest are forgotten. A person's first discoveries are formative; later ones become routine. Up to eight remembered places, at most three of any kind, lead hungry or prospecting people to food, timber, stone, or ore when nothing useful is in sight. They are updated on arrival.
- **Learning from experience.** Each advanced activity produces an outcome judged on arrival, never while travelling: a harvest, a failed or successful trial, a lesson that took. Outcomes update a learned expectation of that activity. Liking drifts more slowly from outcomes, personality fit, and competence.
- **Aspirations.** Adults hold a life goal chosen from values, personality, talent, and life stage: master a craft, discover, raise a family, earn trust, provide, heal, mentor, or explore. Progress is measured from real accomplishments in a life record (discoveries, lessons, health restored, buildings, trades, food provided). Achieved goals bring pride and raise the bar for the next. Stalled goals can be abandoned by impatient people.
- **Deliberation.** After the utility policy scores its options from circumstances, each option is adjusted by the person's: liking, track record, curiosity about untried work, aspiration, fear of risk, grief, anger, joy, pride, relevant techniques, talent, their most vivid related memory, and conscientious commitment. Remembered setbacks weigh twice as much as remembered triumphs. The three leading options and their largest reasons are stored for the inspector, and a one-line inner thought summarises what is driving the person.
- **Techniques.** Sixteen practical techniques, two per skill, multiply their holder's actual output. Examples: 20% more food per soil nutrient from crop rotation, 15% more tools from hafting, 30% more health restored by poultices, 50% more trading capacity from organizing, and 25% less timber for buildings from joinery. Rarely, someone works one out through practice above a skill threshold, and the first in the world is recorded in the chronicle. More often a technique is taught: the pupil needs the prerequisite and nearly the discovery threshold (the full threshold for advanced techniques), and pedagogy helps. Skills above a floor of 15 fade by 3% a month without practice, so specialists keep their edge.
- **Social cognition.** Relationships carry personal trust, the other person's observed expertise, and favours received. Gifts, lessons, and healing create gratitude. Gossip moves a listener's trust in a third person toward the speaker's opinion and spreads knowledge of who is good at what. Students with a mastery aspiration seek out a known expert. Conversation can also pass on directions to a remembered place or advice from experience; advice shifts the listener's expectations.

These are structured, template-rendered states rather than natural-language thought. Balance was checked against the model without inner lives across nine seeds over 40 years. Mean population, buildings, goods, and happiness stayed within the ordinary variation between seeds, while generated inventions were about 40% higher.

## How new inventions are developed

Nine foundation techniques provide initial capabilities and the requirements for farms, workshops, schools, and other buildings. Generated inventions operate alongside and beyond that graph; completing engineering does not end discovery.

1. **Choose a problem.** A researcher weights agriculture, extraction, manufacturing, medicine, logistics, and warfare using shortages, experience, values, and actual war status.
2. **Propose a recipe.** Available food, wood, stone, and ore combine with process primitives such as binding, heating, and channeling and principles such as retention, circulation, and coordination. A continuous intensity parameter varies the design. Previously learned designs can supply one or two parents, inheriting some of their properties and preserving ancestry.
3. **Derive consequences.** Domain, materials, process, principle, intensity, skill, parental effects, and mutation generate a vector affecting food yield, gathering, crafting, healing, storage, trade, combat, and learning. Each design has costs and negative effects as well as intended benefits. A new name alone is not a new capability: these numbers change the simulation.
4. **Contribute work.** Individuals choose to advance the shared experiment. Scholarship, relevant practical skill, and nearby collaborators improve effort. Unfunded projects wait for real materials. Time alone never completes them.
5. **Run a material trial.** Completing the required work spends the recipe's food, wood, stone, and ore. Success is probabilistic, depending on skill, collaboration, complexity, and earlier attempts. Failure consumes the materials, records a failed trial, revises the proportions, and requires more labor. Success measures a quality-adjusted effect vector, teaches contributors, and records evidence.
6. **Spread and apply it.** Encounters can teach a design, and communities can adopt it. Adopted inventions affect actual production and social competition with diminishing returns and combined tradeoffs. A registry preserves identities and ancestry, while access to an idea still requires individual or community knowledge.

There is no list of named invention unlocks and no total-discovery ceiling. The generative space is still an explicit model: fixed material and process primitives with variable combinations and quantitative effects. Agents cannot invent arbitrary new physical laws or execute invented code.

## Beliefs, religion, and communication

Reflection is an effortful social activity that consumes food and energy. People can articulate traditions involving invented symbols and practices, or reinterpret and combine known beliefs. Their experiences, values, trust, needs, and seeded variation shape five independent doctrine dimensions: solidarity, openness, authority, militancy, and spirituality. Spirituality does not imply militancy.

A person learns beliefs through reflection or conversation and holds a separate strength of conviction for each. Familiar practices can gain conviction; new interpretations can form branches. A society periodically selects its prevailing doctrine from actual member convictions, with a support threshold. Knowing a belief is not equivalent to every member adhering to it. Doctrines alter cooperation, learning, healing, industry, food use, trade, and combat in specified ways.

Nearby people can have at most one recorded dialogue each per day. Relationship strength, trust, personality, and compatibility influence the transfer of a technique, design, or belief. Mentoring can transfer skill, and resource reports update perceived abundance and opportunity. Voices records these actual changes; map links show real recent conversations between living people. Messages use templates rather than language-model generation.

## Resources and industry

Food and timber renew on the map; stone and ore are finite. Soil nutrients renew according to fertility, abundance, season, and weather. Farms consume the soil of actual nearby plots. More farm buildings allow more workers and access to a wider local field area, up to a practical travel radius. Overlapping farms draw from the same tiles, so additional buildings do not create nutrients. Irrigation, engineering, and generated agricultural designs improve food obtained per nutrient unit. Labor, skills, drought, and accessible stocks still constrain each harvest.

Workshops consume timber plus stone or metal to make tools. Kilns consume timber and stone-rich earth for goods; forges consume ore and fuel for metal. Generated manufacturing designs change yields. Gathering designs improve collection rates but cannot remove more than a tile contains. Granaries and storage inventions reduce spoilage. Clinics and medical designs improve paid care. Tools wear out, buildings cost resources, and migration abandons some infrastructure.

Trade requires complementary needs: one community has surplus tools and needs food while the other needs tools and can spare food. An exchange transfers one tool for two food units; neither resource is created. Logistics designs increase accessible trading range and frequency. Actual war prevents exchange. Transportation and prices remain abstract.

## Diplomacy and warfare

Nearby societies establish contact. Trust grows through peaceful contact and actual trade; enough trust and low tension permit alliances. Scarcity, overlap in resource access, grievances, relative capability, and closed or militant doctrines can raise tension. Doctrine differences matter together with attitudes and circumstances, not merely because two societies have different belief names. Open, cooperative traditions can support trade and peace.

Sustained tension can lead to war. Military effectiveness depends on available healthy adults, provisions, equipment, solidarity, and generated combat designs. Raids spend food, damage real adults' health and energy, transfer existing supplies, and sometimes destroy infrastructure. People can die from combat; memories and trust respond to attacks. The viewer reports real relation status, trust, tension, trade volume, casualties, and recorded events.

### Conflicts: why wars start, how long they last, what they change

Every war has a record (`src/conflict.js`) listed in the Conflicts tab.

**A cause and an aim.** When tension boils over, the cause is read from the situation between the two societies, and the side with the stronger motive attacks:

| Cause | Arises from | The attacker fights to |
| --- | --- | --- |
| Contested land | Overlapping claims of expansionist peoples | take the land and make the enemy pay |
| Hunger | Scarcity; the hungrier side attacks | seize food and stores |
| Mineral wealth | Coal, uranium or iron between two industrial societies | take the land |
| Faith, ideology | Distant, closed doctrines; rival parties | impose its ways and a friendly government |
| Revenge | An earlier war the attacker lost | avenge its defeat |
| Imperial ambition | A strong, expansionist or martial power | conquer and rule |
| Refusal to submit | A weak society defying a demand for tribute | force submission and tribute |
| Independence | A tributary or colony that has grown strong | win its freedom |
| Trade dispute, provocation, old grievances | Rich trade gone sour, acts of god, lingering tension | extract reparations |

Wars are named for what they are about: the War of a disputed region, the Coal War, a War of Independence, the Second Ashford–Kell War.

**Allies and great wars.** Allies with strong trust, tributaries and fellow members of a country may join either side, defenders more readily than attackers, up to three on a side. A war with five or more belligerents becomes a Great War. Making peace between the two principal enemies ends the whole war.

**Campaigns and lulls.** Armies fight in campaigns of one to three seasons, separated by lulls in which they rarely meet, so a war lasts months to many years. Battles move a war score and the front, and trample and burn the fields around the front. Monthly, each side's war-weariness grows with the years, its dead relative to its strength, hunger, a losing score and shrinking numbers. Its resolve rises with its martial culture, a warlike government, and what is at stake (a war of independence, or the defence of the homeland against conquest). A democracy tires sooner. When weariness passes resolve, a side seeks terms:
- A clear winner imposes its aim: conquest (small peoples are absorbed), tribute, independence, a friendly government with its norms, or reparations in food and goods (more for plunder; a land war also costs the loser its expansionism).
- A crushed rising is made to pay tribute again.
- An exhausted stalemate ends in a white peace.

Overwhelmed sides may still be conquered mid-war, and a nuclear strike ends a war in an armistice.

**What war changes.**
- *War footing.* Soldiers are fed from the stores, stocks of metal, tools, machines and goods are spent as munitions, and hierarchy creeps up. People near the front are afraid, and the risk-taking young are soldiers (drone operators where weapons breakthroughs run deep).
- *Refugees.* Families on a losing side flee to the nearest society at peace, which takes them in.
- *Opinion.* People rally to the flag in a war's first year, then tire. War-weariness pulls opinion away from martial parties, feeds unrest, and can topple an unelected government.
- *Victory.* The victors grow more martial, expansionist and hierarchical.
- *Defeat.* A proud martial people nurses a grievance (the seed of a war of revenge); others turn away from war. A defeated democracy's government falls to the opposition. An unelected one may face revolution, or a leader without a party may be deposed.
- *Memory.* Everyone remembers the victory, the defeat or the peace.
- *The map.* Fronts are marked with crossed swords, armies march out in their colours during campaigns, and battlefields stay scarred for years.

## Worlds

Terrain comes from the seed alone (the random generator only scatters starting food and timber). Every world has a large main continent whose position, size, tilt and coastline vary with the seed, bent into bays, capes and peninsulas by warped noise. Offshore lie islands and island chains, more of them on larger maps. Mountain spines follow ridged noise across the high ground. Rivers rise in the heights and run downhill to the sea, cutting through small rises, and now and then a basin holds a lake. River valleys are fertile, and dry interiors become sandy steppe. The first people all start on the main continent. Sizes run from compact (96 × 64) to colossal (640 × 416); new worlds default to vast (320 × 208) with 150 founders.

**Crossing water.** People walk on land and ford narrow rivers. With fishing, a society's canoes hug the coast (up to three tiles out) and hop short straits. Navigation and a port launch sailing ships across open sea (about 140 tiles), steam makes them faster steamships (about 320 tiles), and aviation with an airport lets people fly anywhere. Travellers are drawn as their vessel and may be at sea when a world is saved. Trade, contact, marriage, migration and colonisation reach across water only for societies with the boats (or aircraft) for the distance, or along a sea or air route. Island peoples stay isolated until then. A seafaring people sees unclaimed islands as opportunity: it considers overseas sites, prizes empty land, and can send a ship's crew of four. Scouts of a society with boats often sail out to land across the water within reach (canoes to nearby islets, ships far beyond), survey it, and the chronicle records each society's first landfall on a landmass; curious wanderers sometimes paddle across too. A colony founded across the sea, or by a hierarchical society or a country, is a tributary of its mother from the start: it pays tribute across the water as long as boats can make the crossing, and joins the mother's country. Colonists resent tribute about a third as fast as a conquered people, and a colony rises for independence only once it is as strong as its mother (or clearly strong while she is at war) and resentment has set in. Colonies of egalitarian societies over land remain allied kin. Ports open sea routes to societies on other landmasses, and societies with airports open air routes to each other; ships and aircraft ply them on the map.

## Resources, production and technology

The land holds twelve resources (`src/resources.js`). Wild food, timber, fiber (grass and reeds), herbs, game and fish renew toward terrain-dependent capacities. Game and fish grow logistically, so a heavily hunted or fished area recovers slowly. Fish exist only on land bordering water. Stone, ore, clay (rich along rivers and shores), gems (rare, in high ground), coal (seams in hills and old forest basins) and uranium (very rare, in mountains) are effectively finite. Placement comes from seeded noise rather than the random generator.

People gather each material with the matching skill: timber with forestry; stone, ore, clay, gems, coal and uranium with mining; fiber with foraging; herbs with medicine. They hunt and fish for food, which takes real animals from tiles. Societies turn materials into goods:

| Chain | Needs | Yields |
| --- | --- | --- |
| Kiln | clay (or stone-rich earth) + wood | pottery (goods); bricks once brickmaking is known |
| Loom house | fiber | cloth |
| Apothecary | herbs | remedies |
| Forge | ore + wood | metal |
| Workshop | wood + stone or metal | tools |
| Pasture | grass fiber around the settlement | food and hides |
| Factory | metal + coal | machines; electronics from metal + clay once powered |
| Missile silo | uranium + electronics + metal, with power | nuclear warheads |

Goods have uses. Bricks and cloth are building materials. Cloth and hides halve winter chill, and hides stretched over a frame make tents. Remedies make care 50% more effective and protect against plague. Gems go into temples, observatories, art and trade. Trade exchanges any surplus good for food at fixed prices, and markets allow two exchanges per visit. A varied diet (several of wild food, crops, game, fish and herds) speeds recovery of health.

Thirty technologies form the tree: twenty-one foundations, then nine industrial, modern and atomic ones (see below), including aviation. Research effort per person-day is scaled by a global research pace (`RESEARCH_PACE`, 2.5). Research ends with a demonstration that consumes real materials, and a society won't pursue a technology whose materials it cannot obtain. Materials count as obtainable if they are in store, can be gathered nearby, or can be made in a workshop the society has built or knows how to build and supply (it plans for the forge a steam engine will need). While a finished idea waits for its demonstration, the work that supplies it takes precedence (weaving cloth, preparing remedies, smelting, gathering the raw inputs), the building that produces a missing good becomes the most urgent construction, and traders buy enough of it. Toolmakers leave metal set aside for a building or demonstration. A day's mining at a distant deposit is a day trip: the load comes from the deposit itself, smaller the farther it lies (roads and railways shorten the trip). A unit of deposit yields several units of product (coal 6, ore 2.5, stone 2, uranium 3). Only two traders per society set out on any day. Work toward a planned road or railway counts toward material targets, and a dark power station makes coal mining urgent, more so where leaders hold authority. Machines and electric power refund part of each day's labour. People of working age move from poorer bands to thriving towns within reach, above all industrial ones (urbanisation). Coal and uranium are surveyed and mined up to about 30 tiles from camp, and miners return to remembered deposits up to 60 tiles away, so whether a society reaches the atomic age depends on uranium lying within that range. Societies prioritise research by local resources, current problems (plague, winter, food) and culture. They choose among twenty-seven buildings by need, land and culture, skipping any whose materials cannot be obtained. Institutions have real effects:

- Libraries speed research.
- Markets double exchanges per visit.
- Walls strengthen defense.
- Observatories raise harvests and soften drought.
- Docks extend trade range.
- Temples and halls reduce the stress that makes people leave.

### Industrial, modern and atomic eras

Eight later technologies build on the foundations (`src/civilization.js`): chemistry, the steam engine, railways, germ theory and vaccines, electricity, computers, nuclear fission and nuclear weapons. Each changes the society that holds it, and each depends on finite fuel:

- **Chemistry.** Fertilisers raise harvests by 25% and remedies are 30% stronger.
- **Steam engine.** Factories turn metal and coal into machines. While there are enough machines for the workforce, they multiply the output of workshops, kilns, forges, looms, mines and farms by up to 1.6. Factory societies have an *industrial* economy: workers keep more of what they make, sharing weakens and wealth concentrates (Kuznets 1955). Factory smoke adds to disease.
- **Railways.** Trade and contact range grow by half, traders travel more often, and armies move faster. Engines burn a little coal.
- **Vaccines.** Care rises beyond what herbal medicine can reach: vaccination and hospitals cut infant and background mortality below the acculturated Siler values, so far more children survive and populations can grow.
- **Electricity.** A power station burns coal every day. While fuelled, it adds 30% to workshop output, speeds research and lets factories assemble electronics. When the coal runs out, the power stops.
- **Computers.** A powered computer centre makes research 60% faster and preserves every technique, as writing and a library do. It gives the society an *information* economy that is somewhat less unequal than an industrial one. Computers and science also secularise: piety falls.
- **Fission.** A reactor replaces coal power, burning very little uranium and producing no smoke. About once a century per reactor (half as often with computer control), it melts down: it is destroyed, people nearby are sickened, and the land around is poisoned.
- **Nuclear weapons.** A missile silo lets a powered society build warheads. How many it wants depends on its martial norm and the threats it faces. Two nuclear powers almost never go to war, and a lone nuclear power is feared. In a war, a nuclear power that is losing, or a very militant one, may strike. A strike kills much of the target's population, levels most of its buildings and poisons its land, and the whole world is frightened. A target with warheads retaliates, and the fighting ends in a truce. Each use makes the next less likely.

### Breakthroughs: beyond the written tree

The thirty written technologies are only the start (`src/breakthroughs.js`). Once a society has writing and engineering and no written research left to do, its researchers push past the known. A frontier project combines two things the society already knows (written technologies or earlier breakthroughs) from different fields: machines, weapons, energy, medicine, agriculture, transport, information, materials or social institutions. Culture and circumstance steer the choice: martial peoples at war lean to weapons, inventive ones to information, trading ones to transport. The result gets a name drawn from a vocabulary that runs from early devices (lathes, telegraphs, reapers) to far-future ones (self-replicating factories, superintelligence), with special results for some pairings (machines and information give calculating engines, robots, then artificial intelligence). Its depth is one more than its deeper parent, and each breakthrough can be combined again, so there is no last invention. Effects come from both fields, scaled by depth and luck; about a third carry a side effect (pollution, unrest, poorer health or food, more fighting, lower fertility), and one in twenty is a far larger leap. Effort grows steeply with depth, and a prototype must be built from materials the society can make (metal or tools, bricks or goods, electronics where it has powered works); inventors improvise when materials are short, and finished research is built as soon as they arrive.

Advances sum with diminishing returns and act on the society: production, food, research, health, fertility, combat, trade, clean energy (enough of it powers a town without fuel), and automation. Automated works turn out goods, tools, machines and electronics without workers, and automation spares people's labour. Research advances speed further research, a feedback that can take off where materials and power allow. Weapons advances make a society more martial; information advances more inventive. Breakthroughs spread to trade partners, allies, tributaries and colonies whose own knowledge can take them up, so the same invention may appear in several places at once (hence "Radio III").

**How breakthroughs change a society and its land.** A society's mastery of a field is the depth of its deepest breakthrough there. It shows on the map and in the lives of its people.
- *The city.* Past depth 7, cities become cities of the future: glass spires with rooftop gardens, domes and sky bridges.
- *Field works.* Around each city stands one work per field it has pushed far, at the stage it has reached:
  - energy: wind turbines, then solar towers, then fusion plants
  - agriculture: greenhouses, then vertical farms, then biodomes
  - information: a radio mast, then a data campus, then a thinking machine
  - also robot works, motorway interchanges and spaceports (and, deep enough, a space elevator), research hospitals, military bases, civic domes, and spires of smart matter
- *Orbit.* Spacefaring societies put satellites in orbit.
- *The land.* Ring roads and motorways circle cities, and solar fields cover open ground.
  - Where deep agriculture and clean energy spare the land, or synthetic materials replace mining, forests regrow and mines close, and a green belt appears.
  - Pollution saturates, and clean energy offsets it. Where pollution remains high, woods die back and the land around a town greys.
  - A green government with clean power replants as policy.
- *Work.* Skilled people take the new specialisms: robotics, energy and materials engineers, AI researchers and data scientists, geneticists, agronomists.
- *Automation.* It displaces the unskilled. A welfare state or a communal culture shares its dividend with them. Otherwise they grow angry and stressed, and may leave.
- *Politics.* New movements answer: a basic income, humanist or neo-Luddite resistance to automation, technocrats and transhumanists for it.
- *Culture.* Each field nudges norms: transport toward trade and expansion, social institutions toward equality and community, medicine toward care.

Industry also moves culture. Factories and railways raise innovation, trade and hierarchy and weaken tradition and communal norms. They can make a society a *metropolis* (40+ people, 20+ buildings, a factory and railways), and they give rise to new customs such as machine works and iron-and-glass halls. A silo makes a society more martial.

## Work, companies, parties and countries

**Occupations.** A person's role comes from their strongest skill, read through their society's institutions and what they do:
- A healer becomes a physician with a clinic and a doctor with a hospital.
- A scholar becomes a programmer or scientist with a computer centre, or a teacher at a school.
- An artisan becomes a smith, then an engineer or factory worker.
- People at sea are sailors (pilots with an airport), and traders are merchants.
- The risk-taking young are soldiers in wartime.
- Party leaders are politicians and company owners entrepreneurs.
- Breakthroughs create further specialisms, from robotics engineers to AI researchers.
- Where automation is deep, the unskilled become machine minders or displaced workers.

**Companies** (`src/enterprise.js`). In a society that knows commerce, ambitious, open and well-off adults found firms (fewer in communal cultures) around what the town runs: manufacturing, mining, railways, shipping, energy, technology, agriculture or commerce. A founder puts in most of their wealth as capital. Each month a firm earns a share (split among rivals) of the value its sector produced where it operates, or of the services it provides (rail and sea routes carried, power supplied, trade), pays wages to the people in its sector's jobs, and splits the profit between capital and its owner. Capital builds more of the firm's kind of works where they are wanted, and with enough to spare a firm opens branches in trading partners; three or more make it a corporation. Firms that run out of money, or lose money for a year and a half, are wound up; a dead owner's richest adult child inherits.

**Parties** (`src/polity.js`). In societies of twelve or more with governance or a hall, every adult has a position on six axes (communal against free market, authority against equality, progress against tradition, martial against peaceful, devout against secular, expansion against homeland) from their values, temperament, wealth and grievances. When enough people find no party near their views, the most capable of them founds one with their shared ideology and a name that says what it stands for; green movements grow where industry pollutes. Adults back the nearest party. Egalitarian societies (hierarchy below 0.55) hold elections every four years; in hierarchical ones the ruling party stays until a clearly more popular rival, fed by hunger, stress, inequality and the unrest some breakthroughs bring, overthrows it in a revolution that also lowers hierarchy. The governing party's leader leads the society, and its ideology pulls the society's norms, and so its policies.

**Countries.** Once a year, societies unite into named states: an overlord with two or more tributaries (an empire), a city with its colonies or allies (a kingdom or republic, by its hierarchy), or a town with two or more allied kin societies (a union or confederation). Allies, colonies and tributaries of a capital join over time. Members of a country do not go to war with each other. A member at war with the capital breaks away, a country whose other members have gone dissolves, and one that loses its capital falls apart. Countries share a colour on the Societies view and their names are written across their lands.

## Farming, growth and expansion

**Farming.** A society caps its daily experimenters (about 15% of members) and scouts (about 8%). Farming is a duty: until enough people are in the fields to feed everyone at what a farm day yields with the society's methods, farming outranks other work. Hungry people in a farming band fill that quota themselves and keep up to half their harvest. A band that knows cultivation builds its first field even while hungry. Once societies farm, crops supply most of their food.

**The demographic transition.** Natural fertility falls as children reliably survive (medical care), schooling, wealth and modern institutions spread: up to 70% of it forgone in the most modern societies. Breakthroughs can raise or lower fertility only within limits.

**Expansion.** Development (tier, statehood, governance, railways, ports, airports, breakthroughs) drives colonisation rather than rooting a society, and shortens the time between colonies. A society's territory grows with its works and industry. Countries absorb the colonies of any member and small, friendly neighbours near their lands by treaty.

**Harbours.** Coastal towns that know fishing show their boats working nearby waters; a port's ships (steamships once they have steam) ply farther out, and ports on the same coast open coastal sea routes.

## Taking charge

The observer may take charge of one adult (`src/player.js`). Each day that person follows a standing order instead of their own judgement: walk or sail to a place; do any work their society supports; forage, rest or explore; seek someone out to talk with, court (marriage follows the usual rules of attraction, age and kinship) or give food to; or travel to join a society. Leaving a society and founding a society, a company (with commerce and some wealth) or a party (in an organised society) happen at once. An exhausted person rests whatever the order. They still eat, tire, age and can die, which ends your charge; the choice and order are saved with the world.

## Acts upon a society

Besides acts upon the whole world or a region, the observer can act upon one society: send aid (food, timber, stone, metal, cloth); share knowledge (the next technology it could learn, or a breakthrough known elsewhere); inspire a visionary (research leaps ahead); back an entrepreneur (its most ambitious member founds a company); stir unrest; call a snap election; broker peace in all its wars; sow discord with its nearest rival; proclaim a nation with its kin, allies and tributaries; grant independence from its country or overlord; or send settlers to found a colony in a chosen region.

## Culture

Every society has eight norms (`src/culture.js`): innovation, tradition, collectivism, hierarchy, martial spirit, trade, piety and expansion. Each month they drift toward targets set by:

- **Members' temperament and values.** For example, openness and curiosity pull toward innovation, and cooperation, belonging and care toward collectivism.
- **What the society lives through.** Wars raise martial spirit, disasters and losses raise piety, trading partners raise the trade norm, and age and continuity raise tradition.
- **Its institutions and leader.** Doctrine and tier raise hierarchy, and a long-serving leader's temperament rubs off.

Customs emerge from material and social life: cuisines from a dominant food source, crafts from what is produced most, festivals from shared hardship, harvests or war, rites from the strongest norm, and building styles from construction materials. A custom strengthens while its basis persists and fades when it goes; a library slows the fading. It also reinforces the norm it expresses, so cultures diverge rather than averaging out. Customs have small real effects on the same multipliers as inventions, and "cohesion" reduces the stress that drives people away. They spread through trade and alliance, especially into open, less traditional societies, and colonies inherit them. A society's label names the norms where it most exceeds the world's other societies.

Children and people new to a society slowly absorb its values. Culture also shapes individual decisions: invention-minded cultures favour research, devout ones reflection, trading peoples exchange. In hierarchical societies, members lean toward the work their leader's own life goal calls for, and the inspector labels each of these reasons. Invention topics and the doctrine of new beliefs follow the culture that produces them.

Societies grow from band to village (6+ people, 2+ buildings), town (12+ people, 6+ buildings, writing) city (24+ people, 12+ buildings, masonry and governance) and metropolis (40+ people, 20+ buildings, a factory and railways). Tier raises building targets, custom formation and territorial claims. Leaders are chosen by the trust members actually place in them, plus leadership skill, age, extraversion and ambition. Hierarchical societies keep a leader for life; egalitarian ones re-choose every four years.

## Expansion

Each person has a pioneering drive (`psyche.expansion`) that combines temperament (openness, ambition, autonomy, risk tolerance, emotional steadiness) with felt land pressure and the culture's expansion norm. People with a strong drive may scout distant land, remembering its food, timber, minerals, fish and game. Some take "found a new settlement" as their life goal.

Each month a society measures its land pressure: its size against what the surrounding land, farms and pastures can support, and whether stores run short. Societies of 16 or more weigh founding a colony, at most once every six years. The decision combines the expansion norm, land pressure, the share of eager members, and the leader's drive, weighted by hierarchy; a hall makes it easier. Only willing members go (drive above average), with their partners and young children. The site is chosen from places the society's scouts remember and from sampled land, favouring good food and fertility, resources the mother society lacks, and room away from others. Pioneers carry a proportional share of stores and every technique the society knows, found a new society led by the expedition's leader, and begin as allies of their mother community through kinship.

A society's buildings root it: each one makes founding a colony less appealing, so settled towns send colonists mainly under real land pressure. A colony needs at least six pioneers (four for a ship's crew) and goes with whole families, but never takes more than a third of the town, and at least twelve people and three fifths of the town stay home. A society that splits loses at most 45% of its people, families included. A band that has dwindled below five people, a year or more after its founding, joins the most promising band within 40 tiles that is larger and not at war with it. Allies, kin, trading partners, trust, buildings and size all count toward "most promising". The band brings its stores, and its people walk to their new home.

**Subjugation and empire.** When a war ends in a decisive victory (the circumscription rule above), a defeated society of eight or more that owes tribute to no one becomes a *tributary* instead of being absorbed. It keeps its people, culture and buildings. Each month it sends 6% of its food and 8% of its tools, metal, goods, cloth, bricks, gems, remedies, hides, coal, machines and electronics to its overlord. The overlord's leader keeps a cut in proportion to hierarchy. Without war, an expansionist or martial society at least twice as strong as a tense neighbour may demand submission. Warlike peoples, and those with nuclear weapons, refuse more often. Subjugation makes the overlord more hierarchical and martial. Tribute breeds resentment, faster in proud, martial tributaries, and a tributary rebels when it approaches its overlord's strength or when the overlord is fighting another war. After twenty years of quiet rule, a small tributary within 30 tiles may be annexed peacefully. A tributary that falls out of contact stops paying. An overlord with three tributaries is announced as an empire.

Territorial claims grow with population and tier. Where two claims overlap, tension rises only in proportion to how far both peoples' expansion norms exceed the ordinary; settled neighbours share land peacefully.

## Acts of god

The observer can change circumstances without deciding for anyone (`src/acts.js`). World-wide acts:

- **Rainfall** and **drought**: faster or slower growth.
- **Harsh winter**: 90 days of little growth and faster spoilage; cold drains energy, softened by shelter and clothing.
- **Food aid.**
- **Bless the land**: exhausted soil recovers and wild food returns.
- **Plague**: 120 days of illness, worse in crowded settlements. Clinics, apothecaries, remedies, medical knowledge and skill protect people.
- **Festival**: joy and social fulfilment, eased grief and anger, strengthened bonds.
- **Dark omen**: fear, and a search for meaning that turns people to reflection.
- **Spark of genius**: the most curious adults each grasp a new technique, deepen their best skill, and advance their society's experiment.

Regional acts:

- **Wanderers**: skilled newcomers who bring techniques and travel as companions.
- **Earthquake**: injuries, toppled buildings and shelters, exposed stone and ore.
- **Wildfire**: burned woodland and food, damaged camps, ash-enriched soil.
- **Flood**: drowned crops and stores on low land, with silt left in the soil.
- **Mineral strike**: rich stone and ore; nearby people learn where.

Every act is recorded, feeds people's emotions and memories, and replays identically on the same day.

## Life course, inequality and politics

Demography, economy, disease and political organisation follow published research. [REALISM.md](REALISM.md) sets out the evidence (Gurven & Kaplan's mortality schedules, natural fertility and the Neolithic demographic transition, Borgerhoff Mulder's wealth inequality, Henrich's collective brain, Johnson's scalar stress, Carneiro's circumscription, prospect theory, conformist and prestige-biased learning, secondary-forest recovery, and the first epidemiological transition). It also gives exactly how each is modeled, the validation targets, and what remains. In validation runs of 120 model years across three seeds, simulated populations match the evidence:

- Mean age at death was about 27–32 years.
- 42–50% of deaths were of children.
- Period fertility was about 4–7 births per woman.
- Populations were close to stationary, with real swings.
- Wealth inequality rose from foraging toward agricultural economies.

## Population and persistence

There is no numerical limit on the living population and no headcount-based fertility penalty. Healthy, provisioned adult pairs can have children after bonding and a cooldown.

Households pool what they carry: a partner nearby shares the family's food reserve, so both parents need not forage for it. A night under a roof at home (enough shelters for the band) restores some of the day's effort, so settled people can work for longer stretches between rest days.

Pairs form between single adults of similar age who are mutually attracted and are not close kin (parents, children or siblings). Most meet nearby, but small bands soon hold no one a member could marry, so bands marry out, as foragers do. Once a week, a single adult under 50 with no suitable partner at home may set out for another band that has one. How willing they are depends on openness, sociability and culture: expansionist and trading cultures marry out readily, while traditional and communal ones do so less. The destination must be within reach (about 45 tiles, farther with railways) and never at war with their own band. Alliances, trade, kinship (colonies and mother communities) and trust make a band a more attractive destination, while tension and distance count against it. The traveller walks there, still eating and resting as needed, gets to know the singles in the camp, and may marry within about five months or give up and return. The couple settles where prospects are better (more people, more food per person): the traveller joins that band or brings the partner home. Each marriage raises trust between the bands, eases tension, and can carry customs.

Everyday exploration ranges from about 12 to 40 tiles from camp depending on curiosity. On reaching a spot, explorers note the best food, timber, stone, ore, game, fish, clay and coal nearby. Pioneers and curious, under-stimulated adults scout 20–65 tiles out, recording sites that guide colonies. Infant food comes from existing parental or shared resources. Food security, land, renewable resource rates, production efficiency, deprivation, and finite lifespans determine population dynamics. Carrying capacity is only an approximate ecological indicator; it never suppresses a birth. One model year is 120 days.

Version 7 saves add coal and uranium deposits, industrial stocks and buildings, and a count of nuclear strikes; version 6 saves gain the deposits from the same seeded noise and start with none of the rest. Version 6 saves include each person's sex, attraction and private wealth, vital records, the climate anomaly, epidemics and technology memory, as well as the random generator, soil and every tile resource, individual minds, inner lives and convictions, society cultures, customs and land surveys, shared experiments, design ancestry, belief traditions, diplomatic relations, resource stocks, and cumulative counters. Restoring a save resumes deterministically. Version 1–5 saves keep their people, map size, families, resources and prior knowledge, and lose their old population ceiling. They gain the new state deterministically, without consuming the saved random state: inner lives, pioneering drives, tile deposits, and cultures derived from members. The changed rules naturally change future trajectories after migration.

Recent events, conversations, relationships, memories, and the sampled population history remain bounded. Living individuals and the design registry are not culled to fit those narrative limits. Large populations can make simulation days slower; observation frequency adapts without altering demographics. Browser workers run only while the browser permits; the headless runner uses the same model for long experiments and portable checkpoints.
