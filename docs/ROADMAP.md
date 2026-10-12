# Nightfall Settlement - Roadmap

Naming: a small fighting group is a **warband** (6 soldiers, heraldic names: Lion, Wolf, Stag, Eagle, Raven, Boar). Later: several warbands form a **company**, the whole army is the **host**, each warband may get a **captain**, and you are the **leader**.

Ideas for the long term. Nothing here is built yet unless it says so. Order is a suggestion, not a promise.

## Big idea: from village survival to war

Today the game is "build a village, survive the night". The next level is **commanding an army**: bring your soldiers on expeditions of any size, take dungeons and ruins with a small warband, or lead a full host to assault another city, castle or fortress. You stay on the field as the **leader**: a fighter and a commander at once.

### What already exists and can be reused
- Soldier classes (swordsman, great swordsman, spearman, medic) and archers, with veteran levels.
- Expeditions with an escort (`CFG.ESCORT_MAX` = 3 soldiers who follow and fight).
- Rally Cry, hero skill tree, combat animation sets per weapon, hit reactions, block and dodge.
- Wall, tower and gate systems; enemies with siege units and a boss.
- Stronghold economy: farms, quarry, lumber, smith (gear), barracks, population cap by houses.

### Pillar 1 - Army size and warbands
- Barracks capacity limits the number of soldiers. More barracks, a larger drill ground and houses raise it.
- Soldiers are grouped into **warbands** (for example 4 to 8 units of one class). A warband is the unit you command.
- The expedition screen lets you pick warbands to bring instead of a number. Escort stays as the "quick small party".
- Warbands you leave behind keep guarding the village at night; warbands you bring are away (the village is weaker).

### Pillar 2 - Expeditions at three scales
| Scale | Party | Goal | Time |
|---|---|---|---|
| Patrol | 1 warband (4 to 8) | dungeons, ruins, chests, camps | minutes |
| Raid | 2 to 3 warbands | enemy outposts, bandit fort, boss lair | one day |
| War | 4+ warbands, siege gear | attack a city, castle or fortress | several days, with a war map |

- The existing expedition levels become "patrol". New ones add a **war map**: a simple node map of places (outpost, village, castle, fortress), each with a garrison size, wall level and reward.
- Marching takes time (days) and food. Far targets need supply wagons.

### Pillar 3 - The leader on the field
- Commands (few, touch-friendly): **Advance / Hold / Fall back**, **Focus target**, **Charge** (warband rush), **Rally** (existing Rally Cry becomes the army rally).
- Leader aura: nearby allies get damage or morale bonus; if the leader falls the army wavers (not an instant loss).
- Leader skill tree gets a Commander branch: bigger command radius, extra warband slots, formation bonuses, siege skills.
- You can fight in the line or stay back and command; both should be valid.

### Pillar 4 - Siege and fortress assault
- Attack side: ladders, rams, siege towers, catapults (built at a workshop, carried by the army).
- Defender side: walls, gates, towers, archers, a garrison, sometimes a commander.
- Gate and wall sections have hit points (reuse the wall system). Breaching opens the way; capturing the keep or killing the commander wins.
- Reward: resources, a captured outpost that produces income, new recruits, rare gear, story progress.

### Pillar 5 - Logistics and consequences
- Upkeep: soldiers eat more when away; unpaid or starving troops lose morale.
- Casualties: soldiers who fall may be wounded (recover in the village) or lost; veterans are valuable.
- Reinforcements: recruit from the village between battles; mercenaries for resources.
- Retreat is always possible, with a cost.
- Village stays under threat: raids can hit while the army is away (a reason to keep a garrison).

### Pillar 6 - Enemy factions
- A few rival forces with their own style: bandit lords (light, fast), an iron legion (shields, heavy), a hill clan (archers, beasts).
- Each holds castles on the war map. Taking one weakens that faction's raids on you.
- Final goal: break the three strongholds to end the war (replaces or extends the current chapter goals).

## How the war layer fits into the current game

War is **not a separate game mode**. It is a new layer on the same village, save, hero and clock. Nothing existing is removed; each current system gets a bigger sibling.

| Today | What it becomes |
|---|---|
| **Ages** (Camp, Wooden Town, Stone Fortress) | The army tech tiers. Age 1: patrols only (one warband). Age 2: raids on bandit camps (2 to 3 warbands) and a bigger soldier cap. Age 3: the war map, a siege workshop and companies (several warbands). |
| **Village Plan / town stages** | New plan steps: a drill ground (raises the soldier cap and veteran training), a siege workshop, stables later. They use the same outer ring and wall rules as the outer fields. |
| **Journey (expeditions)** | Stays as the **patrol** level: same zones, chests, timer and escort, but you bring a warband. The chapter expeditions become the first nodes on the war map, so story progress and relics unlock nodes. |
| **Night raid defense** | Unchanged at its core. Attacked factions send revenge raids; neglected defense invites bigger ones. Warbands you take away weaken the village, so the plan is to keep at least one warband home or rely on towers and walls. |
| **Chapters / endless mode** | The six chapters stay. The late chapters become the campaign against the three rival strongholds. Endless mode becomes a never-ending series of generated fortresses to attack. |
| **Hero level, skills, gear** | Same hero, same skill tree plus the Commander branch. You fight in the battle yourself, as today, while your warbands follow commands. |
| **Resources, smith, farms** | Armies cost food while away and iron for gear and siege engines; captured places pay income. No new currency is needed at first. |

### Time and the day/night loop
- **Short operations (patrol, raid)** happen within a day like journeys now: leave after dawn, be home before dusk.
- **Long wars (several days)** use a campaign mode: you march, the days pass, and the village is simulated in the background. Nightly raids at home are then resolved automatically from your remaining warbands, walls and towers (shown in a morning report), because you are not there to fight them.
- The existing rule "time moves slowly while you are away" stays for short trips; the long march uses the war map clock instead.

### Battles
- A fortress assault is a playable level built from the same pieces as the village: the wall, gate and tower system, with the defender's garrison. It is the existing expedition-zone code with a fortress map.
- Warbands outside your view, or whole battles you choose to auto-resolve, use an abstract strength-versus-strength roll so phones stay fast.

### Gating, so early game does not change
- War features appear from Age 2 (raids) and Age 3 (war map). Players who only want survival can keep playing the classic way.
- A setting can turn the war layer off for players who prefer the original game (decision still open).

### Save and balance
- Everything is additive: new fields for warbands (already saved), war-map state, faction progress and captured places. Old saves load as before.
- Expedition power requirements will move from "all soldiers" to "the party you bring" when the war layer lands, with the numbers retuned then.

## Technical notes (mobile first)
- Cap simultaneous units (for example 60 total in view), reduce detail with distance, and share geometry. Already known: animations are cheap, skinned models are not (they stay off by default).
- Use warband-level movement and simple formations (line, wedge, circle) instead of per-unit pathfinding for large armies.
- Battle simulation outside the player's view (other warbands) can be abstract: strength vs strength with randomness, shown as a bar.
- Keep touch UI small: a warband bar along the edge with 3 to 4 command buttons. No dense menus.
- Save format must store warbands, war-map state and faction progress.

## Suggested phases
1. **Warbands** (done in `nf-v61`, first version): soldiers grouped into warbands of up to 6, soldier cap from barracks/ranges, patrol expeditions with a chosen warband. Still to do: a warband bar on screen, warband names/colours chosen by the player, party-based expedition power.
2. **Commands**: advance / hold / fall back / focus / charge, leader aura, army rally.
3. **War map and raids**: node map, garrison sizes, march time and food, an enemy outpost to attack.
4. **Siege**: ladders and rams, breakable gates, defender garrison, capturing a fortress.
5. **Factions and endgame**: rival forces, castles, final campaign, captured outposts that produce income.
6. Polish: balance, battle report screen, more unit types (cavalry, siege crews), audio.

## Open questions
- Should the war map replace the current expedition menu or sit beside it?
- How much of the village defense should be automatic while the army is away?
- Real-time battles only, or a quick-resolve option for big fights on phones?
- Do captured places need permanent garrisons?

## Other backlog (smaller)
- Custom character models (leader, soldiers, citizens, raiders) and more weapon/building models; the current skinned models are disabled and several kinds (houses, towers, gates, wolves, great sword, staff, armor) have none.
- More captured animations as needed from `js/anims_lib.js` (all received Mixamo clips are already stored retargeted).
- Tune balance numbers marked as guesses in the README (great sword skills, unarmed damage, citizen defense, block strength).
- Verify recent animation work on real phones (mining, chopping, farming, combos).
