# Open invention / belief / conflict / uncapped population contract (v3)

Ownership: engine agent owns simulation.js, worker.js, scripts/simulate.mjs and engine/CLI tests; innovation agent owns innovation.js and innovation tests; UI agent owns index.html/main.js/style.css/world-view.js/browser checks; root owns civilization.js integration, diplomacy.js/tests, docs and integration tests. Coordinate overlaps.

Keep 9 basic techniques as foundation capabilities/backward-compatible building requirements. Add genuinely generated designs and beliefs with recombination, variation, material-consuming tests, failures, generated parameter effects and adoption, rather than only randomized labels on fixed unlocks. Generated designs continue beyond the basic techniques. All randomness is seeded via sim._random(). No real religions, ethnic stereotypes, supernatural truth claims: beliefs are invented social practices whose doctrine affects cooperation, openness, authority and militancy independently.

No numerical population ceiling, including birth checks, save validation tied to old maxPopulation, or artificial fertility slowdown from agent count. Discard legacy maxPopulation on config migration; never use it. Initial input may validate safe integer and file size, but do not cap *living* population or silently cull. Resource availability, health, aging, actual land and technology govern demographics. Worker slows as needed; no disabling births for performance. v3 saves migrate v1/v2, preserve existing individuals/land/knowledge and remove ceiling. Reference sizes remain same.

## Innovation module API (innovation agent)

Exports `initializeInnovation(sim)`, `initializeAgentIdeas(agent)`, `initializeGroupIdeas(group)`, `attemptInnovation(sim,agent,group)`, `reflectBelief(sim,agent,group)`, `spreadIdeas(sim,speaker,listener,trust,deliberate=false)`, `innovationEffects(sim,group)`, `advanceInnovation(sim)`, `innovationStats(sim)`, `restoreInnovation(raw,sim)`, `restoreAgentIdeas(rawAgent,sim)`, `restoreGroupIdeas(rawGroup,sim)`.

- initializers assign fields below; engine calls them for new agents/groups and v1/v2 migration. Initialize globals before populate.
- attemptInnovation executes ONE research work action, may propose an experiment, expend labor/materials, test, fail/revise, or discover; returns boolean handled. Existing core chooses whether to act. Must set action and consume energy. Uses sim._tile/_neighbors/_agentMap/_groupMap/_random/_event and dimensions. Experiments need real inputs, scalable effort, no auto unlock from time. Return false if cannot act.
- reflectBelief is a deliberation/ritual work action; creates/mutates/recombines doctrines from experiences/values/known beliefs, permits neutral/beneficial/harmful effects. Uses actual effort, messages/events. Beliefs can spread without technology prerequisites.
- spreadIdeas returns null or `{kind:'invention'|'belief',text,ideaId}` on ACTUAL learning. Update agent ideas/convictions and group adoption; core logs actual message and counters. Trust/personality/compatibility affect adoption. Don't count same idea repeatedly as new learning.
- innovationEffects returns positive multipliers `{food,gathering,crafting,healing,storage,trade,combat,learning}` (defaults1) and doctrine parameters `{solidarity,openness,authority,militancy,spirituality}` (defaults.5). Generated effects must be reproducible from registry+adoptedIDs, with tradeoffs and diminishing returns but no global invention count ceiling. Lookup efficient; caches invalidated by adoption.
- advanceInnovation updates doctrine consensus from member convictions, active experiment collaborators, preserves developed knowledge, periodic bookkeeping (no passive research). No counting strangers as adherents. Root diplomacy consumes modifiers.
- restore functions strictly validate fields and cross references without arbitrary live population cap; return data to engine: global object, agent `{ideas,convictions}`, group `{ideas,doctrine,experiment}`. Engine assigns group return into group.civilization, agent return into agent.

Global `sim.innovation` / snapshot.innovation:
`{nextId:integer, discoveries:Idea[], trials:integer, failures:integer, successes:integer}`.
Idea:
`{id:'idea-N',kind:'invention'|'belief',name,description,createdDay,founderId,originGroupId,parentIds:string[],generation:integer,domain:'agriculture'|'extraction'|'manufacturing'|'medicine'|'logistics'|'warfare'|'belief',recipe:{materials:string[],method:string,principle:string,intensity:number},effects:{food,gathering,crafting,healing,storage,trade,combat,learning}:number (deltas, can be negative),doctrine:null|{solidarity,openness,authority,militancy,spirituality}:0..1,cost:{food,wood,stone,ore}:nonnegative numbers,evidence:{trials,successes,failures,quality:0..1}}`
All dictionaries have listed keys. Quantitative effects and recipes vary between ideas and carry parent provenance; success is not predetermined.

Agent: `ideas:string[]`, `convictions:{[beliefId]:0..1}`.
Group civilization: `ideas:string[]`, `doctrine:string|null`, `experiment:null|{hypothesis:IdeaDraft,progress,required,contributors:number[],attempts:integer}`. IdeaDraft has all Idea fields except id/createdDay/founderId/originGroupId/evidence. Use chosen proposal draft in UI. Known registry retains designs for deterministic saves even if original inventor dies.
`innovationStats` returns `{inventions,beliefs,experiments,failedExperiments}`. Inventions/beliefs count discovered registry records, projects active.

## Diplomacy module API (root)

Exports `initializeDiplomacy(sim)`, `advanceDiplomacy(sim)`, `tradeAccess(sim,a,b)`, `recordTrade(sim,a,b,volume)`, `diplomacyStats(sim)`, `restoreDiplomacy(raw,sim)`.
Global `sim.diplomacy` / snapshot.diplomacy:
`{relations:[{a:number,b:number,trust:-1..1,tension:0..100,status:'neutral'|'trade'|'alliance'|'war'|'truce',since:day,lastContact:day,warDays:integer,casualties:integer,tradeTotal:number,reason:string}],warsStarted:integer,warDeaths:integer,treaties:integer,raids:integer}`.
Conflict depends on local contact, resource stress, doctrinal distance/attitudes, grievances, relative technology/logistics. Religion is not inherently warlike; solidarity/openness can yield peace/trade/alliance. Wars consume food, damage actual agents/infrastructure, transfer loot without creating it, then seek truces from costs/exhaustion. Age/health death system handles combat victims; set agent._deathCause='war' and call _removeDead after diplomacy before reproduction. Stats `{wars,alliances,tradeRoutes,warDeaths}`. Agent deathCause optional validation enum war, no permanent zero-health living agents in saves.

## Engine integration

- Import/init both global modules; initialize new agent/group ideas separately from existing mind/civ initialization.
- Snapshot/save global innovation+diplomacy, agent ideas/convictions and group added fields (deep copy). Restore v3 globals before restoring generated ID references. Do legacy field migration after core restore. v3 civilization.js restore helpers stay basic-tech validation; engine combines restoreGroupIdeas result afterward.
- day loop: ecology/actions/social → advanceInnovation → advanceDiplomacy → removeDead → reproduce → groupLife → advanceCivilization (order may be adjusted for dependencies, ensure no dead-agent iteration/reproduction). No hard birth cap.
- Add tiles `soil:0..1` and nutrient regen in ecology (initial fertility-based); older saves get soil from fertility. Root farm harvest will consume actual nearby soil budgets, modified by innovation efficiency; finite plots/resource renewal limits food without headcount caps. Resource ecology must remain finite per world and technology.
- Apply innovationEffects gathering bonus to existing foraging/wood, diplomacy to conflict casualty reason, include both stats.
- Remove clamp maxPopulation from carryingCapacity estimate. Estimate is descriptive, never population enforcement. Incorporate productive farms/technology if practical, clearly label estimate.
- Accept added event types invention, belief, experiment, war, peace, diplomacy. Message kinds add invention, belief; optional ideaId preserved.
- CLI start population options are safe integers without600/1000 cap; browser initial input numeric, no growthcap. Import arrays validated by safe arrays/IDs rather than oldcap; size bounds are file limits and errors, never truncation.

## UI / renderer

- Remove all cap wording/config and indicate resource-limited population. Add Ideas/Inventions and Beliefs/Diplomacy panels with generated names, actual recipes/effects/tradeoffs/parentage, experiments and failures; distinguish foundation technique tab from generated designs.
- Individual ideas and convictions visible; society adopted doctrine and effect multipliers visible. Actual relations/wars/treaties/trade routes and casualty counts. Belief/war/peace events in chronicle.
- Map optional relations overlay drawing real relations (different colors/status), invented-belief markers. Keep existing knowledge links and productive buildings. Responsive and accessible.
- Do not say arbitrary natural language invention/LLM. Description: a generative compositional model with fixed physical/social primitives and variable novel designs, outcomes, and lineages.
