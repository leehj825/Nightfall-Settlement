# Nightfall Settlement - Roadmap

Ideas for the long term. Nothing here is built yet unless it says so. Order is a suggestion, not a promise.

## Big idea: from village survival to war

Today the game is "build a village, survive the night". The next level is **commanding an army**: bring your soldiers on expeditions of any size, take dungeons and ruins with a small squad, or lead a full host to assault another city, castle or fortress. You stay on the field as the **leader**: a fighter and a commander at once.

### What already exists and can be reused
- Soldier classes (swordsman, great swordsman, spearman, medic) and archers, with veteran levels.
- Expeditions with an escort (`CFG.ESCORT_MAX` = 3 soldiers who follow and fight).
- Rally Cry, hero skill tree, combat animation sets per weapon, hit reactions, block and dodge.
- Wall, tower and gate systems; enemies with siege units and a boss.
- Stronghold economy: farms, quarry, lumber, smith (gear), barracks, population cap by houses.

### Pillar 1 - Army size and squads
- Barracks capacity limits the number of soldiers. More barracks, a larger drill ground and houses raise it.
- Soldiers are grouped into **squads** (for example 4 to 8 units of one class). A squad is the unit you command.
- The expedition screen lets you pick squads to bring instead of a number. Escort stays as the "quick small party".
- Squads you leave behind keep guarding the village at night; squads you bring are away (the village is weaker).

### Pillar 2 - Expeditions at three scales
| Scale | Party | Goal | Time |
|---|---|---|---|
| Patrol | 1 squad (4 to 8) | dungeons, ruins, chests, camps | minutes |
| Raid | 2 to 3 squads | enemy outposts, bandit fort, boss lair | one day |
| War | 4+ squads, siege gear | attack a city, castle or fortress | several days, with a war map |

- The existing expedition levels become "patrol". New ones add a **war map**: a simple node map of places (outpost, village, castle, fortress), each with a garrison size, wall level and reward.
- Marching takes time (days) and food. Far targets need supply wagons.

### Pillar 3 - The leader on the field
- Commands (few, touch-friendly): **Advance / Hold / Fall back**, **Focus target**, **Charge** (squad rush), **Rally** (existing Rally Cry becomes the army rally).
- Leader aura: nearby allies get damage or morale bonus; if the leader falls the army wavers (not an instant loss).
- Leader skill tree gets a Commander branch: bigger command radius, extra squad slots, formation bonuses, siege skills.
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

## Technical notes (mobile first)
- Cap simultaneous units (for example 60 total in view), reduce detail with distance, and share geometry. Already known: animations are cheap, skinned models are not (they stay off by default).
- Use squad-level movement and simple formations (line, wedge, circle) instead of per-unit pathfinding for large armies.
- Battle simulation outside the player's view (other squads) can be abstract: strength vs strength with randomness, shown as a bar.
- Keep touch UI small: a squad bar along the edge with 3 to 4 command buttons. No dense menus.
- Save format must store squads, war-map state and faction progress.

## Suggested phases
1. **Squads**: group soldiers, squad bar, barracks capacity, patrol expeditions with a chosen squad. Small, testable.
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
