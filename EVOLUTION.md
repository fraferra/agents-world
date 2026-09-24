> Historical v2 implementation notes. The current v3 contract is [OPEN_WORLD.md](OPEN_WORLD.md); its rules supersede all population ceilings below.

# Civilization expansion implementation contract

Ownership: root owns `src/civilization.js`, `tests/civilization.test.js`, docs and integration. Engine agent owns `src/simulation.js` + its tests. UI agent owns `index.html`, `src/main.js`, `src/style.css`. Renderer agent owns `src/world-view.js`, browser-check changes/tests. Other files coordinate first.

Preserve existing fields/methods; simulation saves advance to v2 with v1 import migration (no destructive reset). Outer envelope remains v1. New worlds default 160×104, selectable `config.size`: `compact` 96×64, `standard` 160×104, `large` 224×144. Default population 96, max600. Existing worlds retain dimensions. All bounds/spatial indexing must become dynamic. Tiles add `fertility`, `stone`, `ore`, each0..1; resource distribution affects farming/mining. Snapshot adds `regions: [{id,name,x,y,biome}]` and full civilization fields below. No technology is unlocked by elapsed time alone.

`civilization.js` exports:
- `TECHNOLOGIES`: array `{id,name,requires:string[],cost:number,description}`
- `SKILLS`: array skill IDs: foraging, farming, forestry, mining, crafting, scholarship, medicine, leadership
- `BUILDINGS`: object keys farm, workshop, kiln, forge, school, clinic, granary, lumbermill; values `{name,technology,cost:{wood,stone,ore?}}`
- `initializeMind(sim,agent,parents=null)` assigns agent.mind, .skills, .knowledge, returns agent. Call once after creating the base agent.
- `initializeSociety(group)` assigns .civilization, returns group. Call after group is created.
- `initializeCivilization(sim)` initializes sim.civilization `{conversations:0,ideasShared:0,researchCompleted:0,goodsProduced:0,tradeVolume:0,messages:[]}`. Call before populate.
- `considerCivilization(sim,agent,group)` chooses a utility-based advanced action, returns true if action handled, false to use existing survival/basic behavior. Call in daily loop before `_act`, after `_eat`. Low hunger/energy or children always defer to basic behavior.
- `observeAction(sim,agent)` updates experience, internal beliefs/needs after either advanced or basic action.
- `communicate(sim,agent,other)` called from existing `_socialize` when encounter occurs. Shares knowledge, skills and resource beliefs according to trust and personality; emits bounded communication records.
- `advanceCivilization(sim)` called after daily `_groupLife`. Maintains group projects, workforce accounting, industry wear and records; not free research/production.
- `civilizationStats(sim)` => `{technologies,industries,conversations,ideasShared,researchCompleted,goodsProduced,tradeVolume}` for snapshot.stats. Technologies = unique discoveries across currently living groups and agents; industries = built structures count excluding basic shelters.
- `restoreMind(rawAgent,sim)` validates+copies `.mind`, `.skills`, `.knowledge` and returns these3 fields; `restoreSociety(rawGroup,sim)` returns validated copied `.civilization`; `restoreCivilization(raw,sim)` validates+copies global civilization. Legacy migration calls initializers instead. New nested data MUST be deep copied in snapshot/serialize (structuredClone or explicit clone).

Agent additions:
- skills: object SKILLS =>0..100, knowledge: technology ID array
- mind: {values:{security,belonging,autonomy,mastery,care}:0..1, ambition:0..1, patience:0..1, riskTolerance:0..1, needs:{purpose,stimulation}:0..100, beliefs:{abundance,trust,opportunity}:0..1, goal:string, role:string, intention:string, policy:{action:string,reason:string,scores:[{action,score}],since:day}, memories:[{day,type,text}], plan:{goal,steps:string[],until:day}, lastTalkDay:day}

Group additions:
- civilization:{technologies:string[],research:{[techId]:number},project:null|{technology:string,progress:number,required:number,contributors:number[]},stock:{stone,ore,tools,metal,goods}:number,buildings:{[buildingId]:integer},workforce:{[role]:integer},production:{food,wood,stone,ore,tools,metal,goods}:cumulative number,tradePartners:number[],lastTradeDay:number}

Global `snapshot.civilization` same shape sim.civilization: cumulative counts + bounded newest-first `messages:[{day,speakerId,listenerId,speaker,listener,kind:'idea'|'teaching'|'resource'|'social'|'trade',text,technology?:string}]` max80. Personal memories max8; policy scores max5; plan steps max4; personal knowledge finite catalog. Event types add `technology`, `industry`, `communication`, `trade`. Messages are readable templates of actual communication events, not LLM dialogue. Research requires skilled agent effort, prerequisite techs, and cooperation; knowledge diffuses through real encounters.

Module may use sim._random(), _pick(), _move(agent,target,speed), _neighbors(agent,radius), _tile(x,y), _landNear(x,y), _event(type,text,extra), _agentMap/_groupMap, sim.day, tiles,width,height,config,groups,agents. Avoid adding private assumptions beyond these.

UI: add Knowledge/Industry observation views and communication feed; richer person inspector showing goals, reason/top action scores, learned skills, knowledge, beliefs/values and memories; societies show research progress and real stocks/production. Add world size select and effective model explanation. Renderer: larger world/regions; farms/workshops/schools/forges and a knowledge/network overlay rendering actual recent messages. All features should explain real model state, not decorative counters.
