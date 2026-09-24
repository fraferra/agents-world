# Toward realism: a research-grounded plan

This plan brings Common Ground closer to what anthropology, demography, ecology, cultural evolution and behavioural science have measured about real human societies. Each item names the evidence, what the model did before, and what changes. Items marked **✓ implemented** are in the current version (save format 6). The rest are the next phases.

The simulation stays an agent-based model with explicit, inspectable rules. Parameters come from empirical estimates where they exist and are otherwise calibrated so the qualitative pattern matches the evidence. The time scale stays compressed: one model year is 120 days.

## 1. Demography

**Evidence.**

- *Mortality.* Hunter-gatherer mortality fits a Siler competing-hazards model h(x) = a₁e^(−b₁x) + a₂ + a₃e^(b₃x). Gurven & Kaplan (2007) report averages for foragers (a₁ 0.422, b₁ 1.131, a₂ 0.013, a₃ 1.47×10⁻⁴, b₃ 0.086) and forager-horticulturalists (0.418, 1.657, 0.012, 3.65×10⁻⁴, 0.074). Acculturated populations with access to medicine sit near 0.248, 0.816, 0.006, 1.78×10⁻⁴, 0.079. About 57–67% of children survive to 15, adult mortality is about 1%/yr until 40, mortality doubles every 6–9 years after that, and the modal adult age at death is about 72.
- *Fertility.* Hunter-gatherer total fertility averages about 6 (range 4.7–6.2), with about 3.1 years between births, first birth near 20 and last near 38 (PLOS One 2020 life-history review). Settled farming shortens the gap between births: lactation suppresses ovulation less, and more carbohydrate in the diet shortens it further. This is Bocquet-Appel's Neolithic Demographic Transition.

**Before.** Everyone lived to a random age of 67–97 with no child mortality. Partnership was sexless and any unrelated adult pair could have children every two years.

**✓ Implemented.**

- **Sex and attraction.** Each person has a sex (about 105 boys per 100 girls at birth) and an attraction pattern: about 94% attracted to a different sex, 3% to the same sex, 3% to either. Partnerships need mutual attraction; only mixed-sex partnerships can have children.
- **Siler mortality.** Hazards come from Siler parameters and apply to everyone each day. The infant and constant components respond to nutrition, medicine (knowledge, clinics, healers) and endemic disease, moving from forager toward acculturated values as care improves. Senescence is intrinsic. A hard biological limit of about 100–110 years remains.
- **Natural fertility.** A woman's chance of conceiving follows a natural-fertility age schedule (Coale–Trussell style) from about 15 to about 49, with most births between 20 and 38. It is scaled by nutrition. After each birth there is a period of lactational infertility: long for mobile foragers, shorter for settled farmers and herders. This gives the transition to higher fertility with farming.
- **Grief for children.** Parents grieve children who die whether or not they appear in the parent's remembered relationships.
- **Vital statistics** (life expectancy, survival to 15, total fertility) are recorded and shown.

**Later.** Grandmothering effects on child survival; marriage systems (monogamy vs polygyny by wealth); sex-biased work; maternal mortality at childbirth.

## 2. Human behaviour

**Evidence.**

- Prospect theory: losses weigh about 2.25 times gains (Tversky & Kahneman 1992).
- Kin selection (Hamilton's rule) and reciprocal altruism structure food sharing.
- Among foragers, sharing takes the form of demand sharing.
- Prestige bias: people learn from the successful and respected (Henrich & Gil-White 2001).
- Conformist bias: people over-adopt the majority variant (Boyd & Richerson 1985).

**✓ Implemented.**

- **Loss aversion.** Learned expectations weigh bad outcomes 2.25 times as much as good ones.
- **Selective generosity.** Gifts go preferentially to kin and to people who have given before; people who never reciprocate lose trust.
- **Prestige.** Skill and standing make a speaker more convincing.
- **Conformity.** Beliefs spread faster when more of the listener's community already hold them.

**Later.** Time discounting varying with scarcity; costly punishment of free-riders; sex differences in risk-taking.

## 3. Culture and technology (the "collective brain")

**Evidence.**

- Henrich (2004), the Tasmanian case: when populations shrink or become isolated, complex skills are lost because too few skilled people remain to pass them on. Large, well-connected populations accumulate and keep more culture.
- Knowledge lives in minds unless it is written down.

**✓ Implemented.**

- **Losing technology.** A society keeps a technology only while some living member knows it. If no holder remains for a year, and there is no writing plus a school or library to preserve it, the technology is forgotten. Technologies go leaf first, never while something built on them is still known.
- **Research scales with the collective brain.** Research effort grows with the number of connected minds: society size and trading partners.

**Later.** Copying error that grows with skill complexity; oral tradition as a fragile archive.

## 4. Economy and inequality

**Evidence.** Borgerhoff Mulder et al. (2009, *Science*) measured material-wealth Gini coefficients across 21 small-scale societies: about 0.25 for hunter-gatherers, 0.27 for horticulturalists, 0.42 for pastoralists and 0.48 for agriculturalists. Material wealth passes strongly to heirs where it is defensible (livestock and land: pastoral 0.67, agricultural 0.55) and weakly where it isn't (foragers 0.17).

**✓ Implemented.**

- **Private wealth.** People keep a personal share of what they produce. The share depends on the economy (foraging, horticultural, pastoral, agricultural) and falls in communal cultures. Demand sharing levels wealth monthly, and more strongly among foragers and in communal cultures.
- **Uses of wealth.** Wealth can be exchanged for food in hard times. It makes a person a more attractive partner and a more likely leader.
- **Inheritance.** Wealth passes to children (else a partner, else the society) at the transmission rates measured for each economy.
- **Measurement.** Each society's economy type and wealth Gini are measured and shown. Poverty relative to peers adds stress.

**Later.** Land tenure and property boundaries; debt and patronage; specialists' wages.

## 5. Environment

**Evidence.**

- Rainfall varies from year to year with persistence: dry years cluster.
- Cleared tropical forest takes a median of about 66 years to regain 90% of its biomass (Poorter et al. 2016, *Nature*).
- Sedentism, crowding and domesticated animals raised infectious-disease load in the Neolithic: zoonoses and crowd diseases, the "first epidemiological transition".

**✓ Implemented.**

- **Climate.** A persistent climate anomaly (a first-order autoregressive process) makes wet and dry runs of years, on top of the seasons.
- **Forests.** Woodland regrows logistically, so heavy clearing leaves degraded land for decades.
- **Disease.** Endemic disease rises with settlement size, sedentism and livestock, and falls with medicine. It raises child and adult mortality. Epidemics can break out on their own where people crowd together with animals and trade widely, and they travel along trade routes and alliances.

**Later.** Soil erosion and salinisation under intensive farming; fallow cycles; climate trends; natural disasters that emerge from the climate state.

## 6. Political organisation

**Evidence.**

- Johnson (1982), scalar stress: decision-making strain grows with group size until hierarchy forms. Groups of about six units need leadership.
- Forager camps hold about 30–50 people, within wider networks of about 150 (Dunbar).
- Carneiro (1970): where land is circumscribed, population pressure makes war lead to conquest and ever-larger political units, and eventually states.

**✓ Implemented.**

- **Fission.** Groups beyond their organisational capacity feel scalar stress and split along lines of friendship and kinship. Capacity grows with hierarchy, a leader, halls and governance.
- **Conquest.** A war that ends with an overwhelmingly weaker side and no room to disperse ends in conquest: the conquered join the victors, whose culture grows more hierarchical. This is the route from villages to chiefdoms and states.

**Later.** Tribute instead of full absorption; elites and commoners; revolts; laws.

## Validation targets

The model is tuned so that, in ordinary worlds:

- Survival to 15 is roughly 55–75% and life expectancy at birth is roughly 30–45 years, rising with medicine.
- Total fertility is roughly 4–7, higher with farming.
- Wealth inequality in foraging societies is low (Gini ≈ 0.2–0.3); pastoral and agricultural ones become markedly more unequal (≈ 0.35–0.5).
- Populations grow slowly and are regulated by food, disease and conflict rather than by caps.

Deviations are reported honestly in `MODEL.md`.

## Sources

- Gurven, M. & Kaplan, H. (2007). Longevity among hunter-gatherers: a cross-cultural examination. *Population and Development Review* 33(2). https://onlinelibrary.wiley.com/doi/abs/10.1111/j.1728-4457.2007.00171.x
- Bocquet-Appel, J.-P. (2011). The agricultural demographic transition during and after the agriculture inventions. *Current Anthropology* 52(S4). https://www.journals.uchicago.edu/doi/full/10.1086/659243
- Human uniqueness? Life history diversity among small-scale societies and chimpanzees (2020). *PLOS One*. https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0239170
- Henrich, J. (2004). Demography and cultural evolution: the Tasmanian case. *American Antiquity* 69(2). https://henrich.fas.harvard.edu/publications/demography-and-cultural-evolution-how-adaptive-cultural-processes-can-produce
- Borgerhoff Mulder, M. et al. (2009). Intergenerational wealth transmission and the dynamics of inequality in small-scale societies. *Science* 326. https://www.science.org/doi/abs/10.1126/science.1178336
- Johnson, G. (1982) on scalar stress; see Modeling group size and scalar stress, *PLOS One* (2014). https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0091510
- Carneiro, R. (1970). A theory of the origin of the state (circumscription theory). https://en.wikipedia.org/wiki/Circumscription_theory
- Tversky, A. & Kahneman, D. (1992). Advances in prospect theory. https://cemi.ehess.fr/docannexe/file/2780/tversjy_kahneman_advances.pdf
- Muthukrishna, Morgan & Henrich (2016). The when and who of social learning and conformist transmission. https://www.sciencedirect.com/science/article/abs/pii/S1090513815000586
- Poorter, L. et al. (2016). Biomass resilience of Neotropical secondary forests. *Nature*. https://pubmed.ncbi.nlm.nih.gov/26840632/
- Infectious diseases and the First Epidemiological Transition (review). https://www.researchgate.net/publication/396841558_Infectious_diseases_and_the_First_Epidemiological_Transition_in_Central_and_Western_Eurasian_prehistory_A_review_in_light_of_the_aDNA_revolution
