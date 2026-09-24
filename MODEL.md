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

Sustained tension can lead to war. Military effectiveness depends on available healthy adults, provisions, equipment, solidarity, and generated combat designs. Raids spend food, damage real adults' health and energy, transfer existing supplies, and sometimes destroy infrastructure. People can die from combat; memories and trust respond to attacks. Losses, exhaustion, provisioning pressure, or separation through migration lead to truces. The viewer reports real relation status, trust, tension, trade volume, casualties, and recorded events.

## Resources, production and technology

The land holds ten resources (`src/resources.js`). Wild food, timber, fiber (grass and reeds), herbs, game and fish renew toward terrain-dependent capacities. Game and fish grow logistically, so a heavily hunted or fished area recovers slowly. Fish exist only on land bordering water. Stone, ore, clay (rich along rivers and shores) and gems (rare, in high ground) are effectively finite. Placement comes from seeded noise rather than the random generator.

People gather each material with the matching skill: timber with forestry; stone, ore, clay and gems with mining; fiber with foraging; herbs with medicine. They hunt and fish for food, which takes real animals from tiles. Societies turn materials into goods:

| Chain | Needs | Yields |
| --- | --- | --- |
| Kiln | clay (or stone-rich earth) + wood | pottery (goods); bricks once brickmaking is known |
| Loom house | fiber | cloth |
| Apothecary | herbs | remedies |
| Forge | ore + wood | metal |
| Workshop | wood + stone or metal | tools |
| Pasture | grass fiber around the settlement | food and hides |

Goods have uses. Bricks and cloth are building materials. Cloth and hides halve winter chill, and hides stretched over a frame make tents. Remedies make care 50% more effective and protect against plague. Gems go into temples, observatories, art and trade. Trade exchanges any surplus good for food at fixed prices, and markets allow two exchanges per visit. A varied diet (several of wild food, crops, game, fish and herds) speeds recovery of health.

Twenty-one foundation technologies form the tree. Research ends with a demonstration that consumes real materials, and a society won't pursue a technology whose materials its land cannot supply. Societies prioritise research by local resources, current problems (plague, winter, food) and culture. They choose among nineteen buildings by need, land and culture, skipping any whose materials cannot be obtained. Institutions have real effects:

- Libraries speed research.
- Markets double exchanges per visit.
- Walls strengthen defense.
- Observatories raise harvests and soften drought.
- Docks extend trade range.
- Temples and halls reduce the stress that makes people leave.

## Culture

Every society has eight norms (`src/culture.js`): innovation, tradition, collectivism, hierarchy, martial spirit, trade, piety and expansion. Each month they drift toward targets set by:

- **Members' temperament and values.** For example, openness and curiosity pull toward innovation, and cooperation, belonging and care toward collectivism.
- **What the society lives through.** Wars raise martial spirit, disasters and losses raise piety, trading partners raise the trade norm, and age and continuity raise tradition.
- **Its institutions and leader.** Doctrine and tier raise hierarchy, and a long-serving leader's temperament rubs off.

Customs emerge from material and social life: cuisines from a dominant food source, crafts from what is produced most, festivals from shared hardship, harvests or war, rites from the strongest norm, and building styles from construction materials. A custom strengthens while its basis persists and fades when it goes; a library slows the fading. It also reinforces the norm it expresses, so cultures diverge rather than averaging out. Customs have small real effects on the same multipliers as inventions, and "cohesion" reduces the stress that drives people away. They spread through trade and alliance, especially into open, less traditional societies, and colonies inherit them. A society's label names the norms where it most exceeds the world's other societies.

Children and people new to a society slowly absorb its values. Culture also shapes individual decisions: invention-minded cultures favour research, devout ones reflection, trading peoples exchange. In hierarchical societies, members lean toward the work their leader's own life goal calls for, and the inspector labels each of these reasons. Invention topics and the doctrine of new beliefs follow the culture that produces them.

Societies grow from band to village (6+ people, 2+ buildings), town (12+ people, 6+ buildings, writing) and city (24+ people, 12+ buildings, masonry and governance). Tier raises building targets, custom formation and territorial claims. Leaders are chosen by the trust members actually place in them, plus leadership skill, age, extraversion and ambition. Hierarchical societies keep a leader for life; egalitarian ones re-choose every four years.

## Expansion

Each person has a pioneering drive (`psyche.expansion`) that combines temperament (openness, ambition, autonomy, risk tolerance, emotional steadiness) with felt land pressure and the culture's expansion norm. People with a strong drive may scout distant land, remembering its food, timber, minerals, fish and game. Some take "found a new settlement" as their life goal.

Each month a society measures its land pressure: its size against what the surrounding land, farms and pastures can support, and whether stores run short. Societies of 16 or more weigh founding a colony, at most once every six years. The decision combines the expansion norm, land pressure, the share of eager members, and the leader's drive, weighted by hierarchy; a hall makes it easier. Only willing members go (drive above average), with their partners and young children. The site is chosen from places the society's scouts remember and from sampled land, favouring good food and fertility, resources the mother society lacks, and room away from others. Pioneers carry a proportional share of stores and every technique the society knows, found a new society led by the expedition's leader, and begin as allies of their mother community through kinship.

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

There is no numerical limit on the living population and no headcount-based fertility penalty. Healthy, provisioned adult pairs can have children after bonding and a cooldown. Infant food comes from existing parental or shared resources. Food security, land, renewable resource rates, production efficiency, deprivation, and finite lifespans determine population dynamics. Carrying capacity is only an approximate ecological indicator; it never suppresses a birth. One model year is 120 days.

Version 6 saves include each person's sex, attraction and private wealth, vital records, the climate anomaly, epidemics and technology memory, as well as the random generator, soil and every tile resource, individual minds, inner lives and convictions, society cultures, customs and land surveys, shared experiments, design ancestry, belief traditions, diplomatic relations, resource stocks, and cumulative counters. Restoring a save resumes deterministically. Version 1–5 saves keep their people, map size, families, resources and prior knowledge, and lose their old population ceiling. They gain the new state deterministically, without consuming the saved random state: inner lives, pioneering drives, tile deposits, and cultures derived from members. The changed rules naturally change future trajectories after migration.

Recent events, conversations, relationships, memories, and the sampled population history remain bounded. Living individuals and the design registry are not culled to fit those narrative limits. Large populations can make simulation days slower; observation frequency adapts without altering demographics. Browser workers run only while the browser permits; the headless runner uses the same model for long experiments and portable checkpoints.
