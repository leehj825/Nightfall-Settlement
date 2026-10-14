# Nightfall Settlement - Roadmap

## Terms (medieval wording used in the game and these notes)
| Instead of | We say | Meaning |
|---|---|---|
| squad | **Warband** | a group of up to 6 soldiers, named for a heraldic beast (Lion, Wolf, Stag, Eagle, Raven, Boar) with a banner colour |
| company, platoon | **Banner** | 2 to 4 warbands under one standard (later) |
| army | **Host** | all your fighting men together |
| squad leader | **Captain** | leads a warband (later) |
| you in war | **Leader of the Host** | you stay the Leader; the skill branch is called Marshal |
| patrol | **Foray** | a small outing with one warband (today's journeys) |
| (war) campaign | **Campaign** | a long war against a hold or castle |
| faction | **Realm** | a rival power (bandit lords, iron legion, hill clan) |
| logistics, upkeep | **Provisions**, **baggage train** | food and supplies an army carries |
| reinforcements | **Levies** (called-up villagers), **sellswords** (paid fighters) | extra men |
| morale | **Courage** | how steady the men are |
| aura | **Standard** | the leader's banner effect |
| orders | **Forward / Stand firm / Withdraw / Mark the foe / Charge** | the few commands |
| drill ground | **Training yard** | building that trains veterans |
| war map | **Campaign map** | map of realms, holds and castles |

> The detailed plan for the campaign map is in [CAMPAIGN_MAP_PLAN.md](CAMPAIGN_MAP_PLAN.md). The siege plan is in [SIEGE_PLAN.md](SIEGE_PLAN.md).

## Status (nf-v108)
See `docs/HANDOFF.md` for the full state of the project, the working rules and how to test. A new chat should read that file first.

**Done**
- **Warbands (phase 1):** soldiers in warbands of up to 6 (heraldic names, banner colours, saved), soldier cap from barracks and archery ranges, warband bar and window, journey power from the warbands brought, home class vs journey class per soldier.
- **Commands:** Forward, Stand firm, Withdraw, Charge, Mark the foe, Follow/Guard orders (O key), the leader's standard aura.
- **Raids:** Raider Outpost (1 warband), Bandit Camp (2), Bandit Stronghold (3), far raids (Hill Clan, Iron Legion, Clan Stronghold, Legion Keep); camp behaviour (alarm, gates, tower archers, burn the banner or kill the chief); lasting relief when a camp is broken.
- **Campaign map:** phase 1 map tab, phase 2 march days, provisions and auto-resolved home nights with a morning report, phase 3 garrisons and holds, phase 4 three realms (Bandit Lords, Hill Clan, Iron Legion) with per-realm relief. The Journeys and Raids tabs were removed (the map replaces them).
- **Hero:** advanced movement and spear skills, great sword and spear blacksmith gear, spear combo (stab, stab, full-force lunge), three-hit sword and great sword combos with a combo reset window, a red Attack button, camera drag anywhere, leader face from a reference picture.
- **Village:** tents become houses at Age 3, outer ring farms and archery range, outer homes and corner towers, closer walls, towers shoot hostile creatures, night lighting follows the hero.
- **Polish:** shorter in-game text, View/Weapon button labels, order buttons, key rebinds.

**Not done**
- Sieges (map phase 5), banners and the host, levies and wounds, courage, the final campaign, extra unit types, audio, a battle report screen, formations.
- Tuning after phone testing, and custom models.

**Next steps, in order**
1. **Sieges** (plan in `SIEGE_PLAN.md`; steps 1 to 4, the Legion Castle with a barred gate, a ram, ladders, boiling oil and the Siege Workshop with carried gear, are built; capture rewards, the Iron Fortress and the battle report are built too; the catapult is built too (nf-v115); a castle for the other two realms is not): castle and fortress nodes with walls, gates, ladders and rams, and a defender garrison.
2. **Banners and the host** (wounds, courage and levies are built, nf-v118).
3. **Final campaign and endgame:** a last assault on a realm's castle; captured outposts that pay income.
4. **Polish:** battle report screen, cavalry and siege crews, audio, formations; balance and phone testing; custom models.

Ideas for the long term. Nothing here is built yet unless it says so. Order is a suggestion, not a promise.

## Big idea: from village survival to war

Today the game is "build a village, survive the night". The next level is **commanding an army**: bring your soldiers on expeditions of any size, take dungeons and ruins with a small warband, or lead a full host to assault another city, castle or fortress. You stay on the field as the **leader**: a fighter and a commander at once.

### What already exists and can be reused
- Soldier classes (swordsman, great swordsman, spearman, medic) and archers, with veteran levels.
- Journeys (expeditions) where one warband of up to 6 soldiers follows and fights, and returns fallen soldiers home.
- Rally Cry, hero skill tree, combat animation sets per weapon, hit reactions, block and dodge.
- Wall, tower and gate systems; enemies with siege units and a boss.
- Stronghold economy: farms, quarry, lumber, smith (gear), barracks, population cap by houses.

### Pillar 1 - Army size and warbands (built)
- The soldier cap is 6 plus 6 per barracks and 3 per archery range. A training yard and more houses will raise it later.
- Soldiers are grouped into **warbands** of up to 6. A warband is the unit you command.
- You pick the warband to bring from the bar or the Journal. Later, two or three warbands go on raids.
- Warbands you leave behind keep guarding the village at night; warbands you bring are away (the village is weaker).

### Pillar 2 - Expeditions at three scales
| Scale | Party | Goal | Time |
|---|---|---|---|
| Foray | 1 warband (4 to 8) | dungeons, ruins, chests, camps | minutes |
| Raid | 2 to 3 warbands | enemy outposts, bandit fort, boss lair | one day |
| Campaign | 4+ warbands, siege gear | attack a city, castle or fortress | several days, with a campaign map |

- The existing expedition levels become "foray". New ones add a **campaign map**: a simple node map of places (outpost, village, castle, fortress), each with a garrison size, wall level and reward.
- Marching takes time (days) and food. Far targets need supply wagons.

### Pillar 3 - The leader on the field
- Commands (few, touch-friendly): **Forward / Stand firm / Withdraw**, **Mark the foe**, **Charge** (warband rush), **Rally** (existing Rally Cry becomes the army rally).
- Leader's standard: nearby allies get a damage or courage bonus (the sight of your banner); if the leader falls the army wavers (not an instant loss).
- Leader skill tree gets a Marshal branch: bigger command radius, extra warband slots, formation bonuses, siege skills.
- You can fight in the line or stay back and command; both should be valid.

### Pillar 4 - Siege and fortress assault
- Attack side: ladders, rams, siege towers, catapults (built at a workshop, carried by the army).
- Defender side: walls, gates, towers, archers, a garrison, sometimes a commander.
- Gate and wall sections have hit points (reuse the wall system). Breaching opens the way; capturing the keep or killing the commander wins.
- Reward: resources, a captured outpost that produces income, new recruits, rare gear, story progress.

### Pillar 5 - Provisions and consequences
- Provisions: soldiers eat more when away; unpaid or starving troops lose courage.
- Casualties: soldiers who fall may be wounded (recover in the village) or lost; veterans are valuable.
- Levies and sellswords: recruit from the village between battles; mercenaries for resources.
- Retreat is always possible, with a cost.
- Village stays under threat: raids can hit while the army is away (a reason to keep a garrison).

### Pillar 6 - Enemy realms
- A few rival forces with their own style: bandit lords (light, fast), an iron legion (shields, heavy), a hill clan (archers, beasts).
- Each holds castles on the campaign map. Taking one weakens that realm's raids on you.
- Final goal: break the three strongholds to end the war (replaces or extends the current chapter goals).

## How the war layer fits into the current game

War is **not a separate game mode**. It is a new layer on the same village, save, hero and clock. Nothing existing is removed; each current system gets a bigger sibling.

| Today | What it becomes |
|---|---|
| **Ages** (Camp, Wooden Town, Stone Fortress) | The army tech tiers. Age 1: forays only (one warband). Age 2: raids on bandit camps (2 to 3 warbands) and a bigger soldier cap. Age 3: the campaign map, a siege workshop and companies (several warbands). |
| **Village Plan / town stages** | New plan steps: a training yard (raises the soldier cap and veteran training), a siege workshop, stables later. They use the same outer ring and wall rules as the outer fields. |
| **Journey (expeditions)** | Stays as the **foray** level: same zones, chests, timer and escort, but you bring a warband. The chapter expeditions become the first nodes on the campaign map, so story progress and relics unlock nodes. |
| **Night raid defense** | Unchanged at its core. Attacked realms send revenge raids; neglected defense invites bigger ones. Warbands you take away weaken the village, so the plan is to keep at least one warband home or rely on towers and walls. |
| **Chapters / endless mode** | The six chapters stay. The late chapters become the campaign against the three rival strongholds. Endless mode becomes a never-ending series of generated fortresses to attack. |
| **Hero level, skills, gear** | Same hero, same skill tree plus the Marshal branch. You fight in the battle yourself, as today, while your warbands follow commands. |
| **Resources, smith, farms** | Armies cost food while away and iron for gear and siege engines; captured places pay income. No new currency is needed at first. |

### Time and the day/night loop
- **Short operations (foray, raid)** happen within a day like journeys now: leave after dawn, be home before dusk.
- **Long wars (several days)** use a campaign mode: you march, the days pass, and the village is simulated in the background. Nightly raids at home are then resolved automatically from your remaining warbands, walls and towers (shown in a morning report), because you are not there to fight them.
- The existing rule "time moves slowly while you are away" stays for short trips; the long march uses the campaign map clock instead.

### Battles
- A fortress assault is a playable level built from the same pieces as the village: the wall, gate and tower system, with the defender's garrison. It is the existing expedition-zone code with a fortress map.
- Warbands outside your view, or whole battles you choose to auto-resolve, use an abstract strength-versus-strength roll so phones stay fast.

### Gating, so early game does not change
- War features appear from Age 2 (raids) and Age 3 (campaign map). Players who only want survival can keep playing the classic way.
- A setting can turn the war layer off for players who prefer the original game (decision still open).

### Save and balance
- Everything is additive: new fields for warbands (already saved), war-map state, realm progress and captured places. Old saves load as before.
- Expedition power requirements will move from "all soldiers" to "the party you bring" when the war layer lands, with the numbers retuned then.

## Technical notes (mobile first)
- Cap simultaneous units (for example 60 total in view), reduce detail with distance, and share geometry. Already known: animations are cheap, skinned models are not (they stay off by default).
- Use warband-level movement and simple formations (shield wall, wedge, ring) instead of per-unit pathfinding for large armies.
- Battle simulation outside the player's view (other warbands) can be abstract: strength vs strength with randomness, shown as a bar.
- Keep touch UI small: a warband bar along the edge with 3 to 4 command buttons. No dense menus.
- Save format must store warbands, war-map state and realm progress.

## Suggested phases
1. **Warbands** (done): soldiers grouped into warbands of up to 6, soldier cap from barracks/ranges, foray expeditions with a chosen warband. Bar, names/colours and party-based power are done too.
2. **Commands** (done, army rally not built): advance / hold / fall back / focus / charge, leader standard.
3. **Campaign map and raids** (done, nf-v86 to nf-v91): node map, garrison sizes, march time and food, an enemy outpost to attack.
4. **Siege**: ladders and rams, breakable gates, defender garrison, capturing a fortress.
5. **Realms and endgame**: rival forces (done), castles and the final campaign (not done), captured outposts that produce income (holds done).
6. Polish: balance, battle report screen, more unit types (cavalry, siege crews), audio.

## Open questions
- Should the campaign map replace the current expedition menu or sit beside it?
- How much of the village defense should be automatic while the army is away?
- Real-time battles only, or a quick-resolve option for big fights on phones?
- Do captured places need permanent garrisons?

## Other backlog (smaller)
- Custom character models (leader, soldiers, citizens, raiders) and more weapon/building models; the current skinned models are disabled and several kinds (houses, towers, gates, wolves, great sword, staff, armor) have none.
- More captured animations as needed from `js/anims_lib.js` (all received Mixamo clips are already stored retargeted).
- Tune balance numbers marked as guesses in the README (great sword skills, unarmed damage, citizen defense, block strength).
- Verify recent animation work on real phones (mining, chopping, farming, combos).
