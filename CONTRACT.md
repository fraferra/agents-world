# Current schema

Version 6 adds `agent.sex`, `agent.attraction`, `agent.wealth`, the global `vital` records, `weather.climate`, and per-society `neglect`, `outbreakUntil` and `immuneUntil` (see [REALISM.md](REALISM.md)). Version 5 added tile resources (`clay`, `fiber`, `herbs`, `game`, `fish`, `gems`), new society stocks, buildings, `diet` and `survey`, `civilization.culture` per society and a global `culture` registry, `psyche.expansion`, `sim.arrivals`, and `weather.winterUntil/plagueUntil`. The world sizes `vast` and `immense` are new, and the default is now large with 120 people. `sim.intervene(kind, { region })` accepts every act in `src/acts.js`. Version 4 added `agent.psyche`, optional relationship fields (`trust`, `expertise`, `favors`), the global `psyche` counters, and message kinds `technique`, `advice` and `gossip` (see `src/psyche.js` and [MODEL.md](MODEL.md#inner-lives)); snapshots also expose each agent's `relations`. Version 3 extends this core shape with the generated invention, belief, soil, diplomacy, and uncapped-population fields in [OPEN_WORLD.md](OPEN_WORLD.md). That contract supersedes earlier population and version limits.

# Internal simulation interface

All modules are native ES modules without runtime dependencies.

`src/simulation.js` exports `Simulation`, `DAYS_PER_YEAR = 120`, `WORLD_SIZES`, and `DEFAULT_CONFIG`.
`new Simulation({seed: 'moss-17', size: 'standard', population: 96, abundance: 1, cooperation: 1, fertility: 1})` creates a world. Sizes are compact (96×64), standard (160×104), and large (224×144). `sim.step(days = 1)` advances whole days. `sim.snapshot()` returns the shape below. `sim.serialize()` returns JSON-serializable complete v5 state. `Simulation.deserialize(object)` validates/restores v5 and migrates v1–v4 saves without replacing their inhabitants or terrain. The outer portable envelope is still version 1. `sim.configure({abundance, cooperation, fertility})` changes parameters. `sim.intervene(kind)` accepts `rain`, `drought`, or `food` and logs the intervention.

Snapshot fields:
- version: 2, seed: string, day: integer, width: number, height: number, config: object
- tiles: row-major array of {terrain: 'water'|'grass'|'forest'|'sand'|'mountain', food: number 0..1, wood: number 0..1, elevation: number 0..1, fertility: number 0..1, stone: number 0..1, ore: number 0..1}
- agents: array of living agents {id: number, name: string, x: number, y: number, age: number in years, health: 0..100, hunger: 0..100 (high is bad), energy: 0..100, social: 0..100 (high is fulfilled), happiness: 0..100, traits: {cooperation: 0..1, curiosity: 0..1, sociability: 0..1}, inventory: {food: number, wood: number}, groupId: number|null, partnerId: number|null, parentIds: number[], children: number[], action: string, generation: number}
- groups: array {id: number, name: string, color: CSS hex string, x: number, y: number, members: number[], food: number, wood: number, shelters: number, culture: string}
- stats: {population, births, deaths, groups, food: number (total), happiness: 0..100, averageAge: number, generation: number, carryingCapacity: number}
- history: bounded array {day, population, food, happiness, groups, births, deaths}
- events: bounded newest-first array {id, day, type: 'birth'|'death'|'group'|'world'|'migration'|'technology'|'industry'|'communication'|'trade', text, agentId?: number, groupId?: number}

Agents additionally expose `mind`, `skills`, and `knowledge`; groups expose `civilization`; top-level `civilization` exposes cumulative activity and recent messages; `regions` identifies named geographic areas. Stats include technologies, industries, conversations, ideasShared, researchCompleted, goodsProduced, and tradeVolume. Full shapes and civilization integration functions are documented in [EVOLUTION.md](EVOLUTION.md), and behavior in [MODEL.md](MODEL.md).

Coordinates use tile units; x/y bounded to world. Events/history and snapshot size are bounded; dead agents may be retained in compact genealogy if documented.

`src/world-view.js` exports `WorldView`: `new WorldView(canvas, {onSelect: (agentId|null)=>{}, onHover: (agent|null)=>{}})`. Methods: `setSnapshot(snapshot)`, `setOverlay('natural'|'food'|'societies'|'industry'|'knowledge')`, `setSelected(id|null)`, `setFollow(id|null)`, `resetView()`, `zoomBy(factor)`, `destroy()`. Renderer handles resizing, HiDPI, RAF, pan/zoom/click selection. It renders terrain, individuals, real productive buildings, regions, recent communication links, group markers, and selection, with viewport culling and bounded terrain caches.
