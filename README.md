# Nightfall Settlement

A low-poly quarter-view 3D action / survival / village-building game that runs in the browser (Three.js r128, no build step).

## Run

Open `index.html` in a browser (needs internet for the Three.js CDN). Add `?debug=1` to the address for debug buttons and the `window.__nf` test hook.

A single-file build is in `dist/nightfall-single.html` (regenerate with `python3 tools/build_single.py`).

## Layout

| File | What it holds |
| --- | --- |
| `index.html` | Page markup (HUD, buttons, panels) and script tags |
| `css/style.css` | All styles, including the responsive layouts |
| `js/config.js` | `CFG`: every balance number, gear, perks, traits, classes |
| `js/audio.js` | Synthesized sound effects and music (WebAudio) |
| `js/rig.js` | Stickman/beast rigs, procedural animation clips, gear meshes, `Anim`, optional GLTF models |
| `js/game.js` | Game logic: world, time, enemies, villagers, buildings, UI |

Scripts are plain (non-module) so the game also works when opened from `file://`.

## Controls

WASD move · F attack · Q swap weapon · Space jump · R dash · E ultimate (Commander: Rally Cry) · G gather · V eat · T town hall · C blacksmith · O orders (Commander) · B bird's-eye view · J journal / expeditions (also "Return home") · M mute. On touch screens use the on-screen joystick and buttons; pinch to zoom.

## Saving and settings
The game auto-saves to the browser (localStorage) every morning and when you return from an expedition. On the next visit you can Continue or start a New game. The ⚙ button (next to the sound button) opens Settings: music / effects volume, text size, graphics (Low turns off shadows and uses lower resolution), replay tips, delete save. Saves are per browser and per file location, and a bad or old save is ignored.

## Village life (stage 9)
- **Jobs:** tap a citizen to see their job, skill level and talent; the Job button cycles Auto / Farmer / Woodcutter / Stonecutter / Blacksmith / Laborer. Skills grow with every finished task (+12% speed per level) and a talent that matches the job adds 10%.
- **Worksite levels:** farms, camps, the smithy, the market and the well upgrade themselves each morning when you have surplus resources (limited by your Age); upgraded buildings fly a banner.
- **Merchant:** with a Market built, a travelling merchant visits every 3 days from Day 4 and trades resources (better rates at higher market level).
- **Patrols:** idle soldiers patrol inside the walls and take their posts at dusk; you get a warning if there are fewer soldiers than gates.
- **Seasons:** 3 days each (Spring, Summer, Autumn, Winter). Crops, rations, mood and illness change; winter is hard. Illness slows citizens; wells reduce it and the merchant sells healing herbs. Both can be switched off in `js/config.js` (`SEASONS_ON`, `SICK_ON`).

## Expeditions, camps and Chapter 3 (stage 10)
- **Escort:** in the Journal choose up to 3 soldiers to come along. They follow you in the expedition zone and fight; if they fall they are carried home (no permanent loss).
- **Camps:** clear an expedition site completely (every chest opened, every foe defeated), then build a camp from the Journal. Each camp delivers resources every morning (60% in winter) and shows a tent at the edge of the village.
- **Chapter 3 - Frostmarch:** after the Dawn Gate opens, a new frozen region with a frost-tinted host and the Frost Warden. Taking the Winter Crown finishes the current story.
- The game clock runs 4x slower while you are on an expedition; a countdown at the top shows when you will be called home.

## Content and polish (stage 11)
- **22 morning events** (bard, wolves, wandering smith, storm damage, tax collector, ...) with seasonal and state conditions; the same event will not come back within 3 rolls.
- **New nights:** Thunderstorm (lightning, faster raiders) and Wolf Hunt (a fast pack of beasts that drop food) join calm, fog, plunder and the Blood Moon.
- **23 achievements,** saved in the browser (Settings > Achievements).
- **Install as an app (PWA):** when the game is served over http(s) it can be installed ("Add to Home Screen") and works offline after the first visit (`manifest.json`, `sw.js`, `icons/`). Bump `VERSION` in `sw.js` when you publish a new build. Opening `index.html` from disk (file://) works as before without the service worker.
- **Slow devices:** on touch devices the game switches graphics to Low automatically if the frame rate stays under ~26 FPS for the first seconds (you can change it back in Settings).

## Chapter 4 - The Hollow Court
After the Winter Crown the story continues: a tolling bell and a road the Crown draws to three places. Recover the **Echo Stone** (Sunken Barrow) and the **Mourning Bell** (Mourning Chapel), then the Obsidian Spire opens: defeat **The Hollow King** and swear the Keeper's Oath. The ending makes nights 15% smaller and the villagers a little happier, and the game keeps going in endless mode. The hollow host is violet-tinted; each site can also get a camp. Story text lives in `js/config.js` (`STORY_HOLLOW`, `STORY4`, `STORY_FINALE`).

## New pacing (the day is longer, threats are announced)
- **Day length:** about 5.5 real minutes (was 2.4). Peaceful nights are really quiet; big raids are on an irregular schedule (Day 3, 7 = boss, 10, 14, 17, ...) and you get a warning on the morning before, with a forecast of how many raiders / brutes to expect and a defense summary (walls, soldiers, towers) in the morning report.
- **You level up:** kills, surviving nights, chests, relics and camps give XP. Each level (max 12) lets you pick one of three upgrades (HP, damage, speed, dash/ultimate cooldowns, lifesteal, damage reduction, Rally boost for Commanders). Relics give a bonus pick. The Level line in the top-left blinks when a pick is waiting (it also opens by itself when no enemy is near).
- **Power opens expeditions:** each expedition shows the power it needs (see `EXP_NEED` in `js/config.js`). Power = soldiers (more with better gear) + you (level and gear). Better weapons, armor, soldiers and levels unlock the next sites and story chapters.
- You start with 40 Wood, so the first fence can be planned immediately while your soldiers gather and build.

## Things to do at night
- **Faster nights:** the clock runs 1.8x faster at night. When the night's raiders are dead, **Rest** (button or Z) fast-forwards to dawn (tap again, or any danger, wakes you).
- **Night hunt:** on quiet nights prowlers roam outside the walls. They do not attack the village; kill them for double XP and loot (iron, food, sometimes a shard).
- **Village at night:** the smith keeps forging by firelight (1.5x); soldiers who rest at the barracks or archery range train and become Veterans (+6% damage per rank, shown on their card); stand near the barracks at night to spar for XP.
- **Lantern merchant:** every 3rd night (Day 5, 8, ...) a merchant sets up at the market with night-only wares (XP manual, whetstones for all soldiers, moon tonic, shards). Walk over or tap the market.
- **Fireside tales:** stand by the campfire on a peaceful night for old Edda's stories (+25 XP, mood). Ten tales that foreshadow the story chapters.
- **Night visitors:** five random night events on quiet nights (a knock at the gate, an owl that foretells the next raid, whispers in the woods, ...).
- **Moonlit expeditions:** Moonlit Crypt, Whispering Marsh and Pale Mausoleum open from 20:00 to 02:00 once the night's raiders are cleared (not on raid nights). Double XP, and their guardians give a bonus level-up choice. You are called home at 04:30.
- **Seeing in the dark:** in expedition zones chests have light beams (faint up close), enemies have glowing halos (gold for guardians, colored by faction), the moon lights the ground and your torch reaches farther. The top line shows time left, chests left with the nearest chest's direction and distance, and foes left.

## Difficulty and New Game+
- **Difficulty** is chosen when a new game starts (and can be changed in Settings): Easy, Normal, Hard, Nightmare. They scale enemy health, raid size and the damage you, your soldiers and your walls take (`DIFFS` in `js/config.js`). Normal is much tougher than the first versions.
- **New Game+:** after the ending (the Keeper's Oath) the start screen offers New Game+. It keeps your player level and upgrade picks, and each New Game+ makes enemies tougher (+40% health, +25% numbers, +20% damage per cycle). Achievements always carry over.

## Phone polish, Chapter 5 and records
- Stats are hidden behind a compact top strip; tap it (or press `I`) to open a large stats panel, tap anywhere else to close it.
- Haptic feedback on hits, level-ups and warnings (Settings -> Haptics); audio pauses when the app is in the background.
- Chapter 5 - The Wide Road: after the finale, Ashford, Reedhaven and Stonegate open; collecting their embers ends the story with permanent perks.
- Endless milestones every 5 days after the story is cleared (iron, XP, shards) and per-difficulty best records shown on the game-over screen.

## Source layout
`js/game.js` is generated from `src/game/*.js` (numbered parts) by `python3 tools/build_game.py`; edit the parts, rebuild, commit both. See `src/game/README.md`.

## Controls (simplified)
- Press the red Attack button (or `F`) to attack; tapping the screen no longer attacks on touch devices. Journal, Map View and Town Hall sit above the move stick; Rest / Orders / Smithy appear in a small column next to the action buttons and keep their slot when hidden.
- Settings: left-handed layout, button size (small / normal / large), text size, vibration, volumes.

- Stone walls are no longer built by hand: from Stage 3 your workers and soldiers replace wooden fences with stone on their own (5 stone each, taken from your stock), after repairs and building plans. The Stone Wall button and `U` key are gone.

## Terrain
The village stays on flat ground; beyond the walls the land rolls into hills, and a river runs along the south-east with one wooden bridge. Wading through the river slows the hero and raiders to 60% speed; the bridge is full speed. Trees and rocks do not grow in the water.

## Chapter 6 and endless Champions
- Chapter 6 - The Eclipse opens after the Wide Road: Cinder Warrens, Drowned Archive, then the Eclipse Throne (needs both relics). Ending perks: +10% hero damage, +20 health, +10% soldier strength.
- In endless mode every second big raid brings a named Champion (Frost Tyrant, Hollow Duelist, Ash Reaver, Lantern Warden, Night Marshal) with iron, shard and XP rewards; new achievements track Champions, kills and days.

## Music
Chord-based synthesized music (bright day arpeggios, slow minor night pads, pulsing danger and boss themes) plus extra effects: level-up, chest, heal, warning bell, howl, victory.

## Hands-off village (latest)
- **Village Plan:** one button replaces the two planning buttons. Workers plan fences and town buildings themselves whenever the resources allow; you only pick the priority (Defense first / Balanced / Economy first).
- **Foreman:** once the village has 5+ people the most experienced villager becomes foreman (+25% work speed, everyone else +12%). The morning report lists walls fortified and repaired.
- **Upgrades by workers:** from Stage 3 workers replace wooden fences with stone; each morning they also level up one building, tower (more damage, faster) or gate (stone pillars; soldiers near it hit 7% harder per level).
- **Autosave** when you leave the app (skipped while raiders are attacking).

## Terrain, river and roads
- High ground: hits from higher than the target deal up to +25%; raiders slow down climbing.
- River: spring flood on the first spring day of each year (slower wading), frozen in winter (raiders cross anywhere), and villagers fish for food.
- Roads wear into the ground wherever people often walk outside the walls (20% faster).

## Weapons and raiders
- Third weapon: **Spear** (long narrow thrust, pierces lines, slower). New level-up picks: Spear Mastery, Fletching, Second Wind, Forager.
- New raiders: **archers** (day 5+), **healers** (day 6+, heal nearby raiders), **sappers** (day 4+, run to a fence and explode).
- Settings > **Balance report** shows a night-by-night log and past runs; copy it to share when tuning.

## Latest round
- **Models:** hooded archers with quivers, healers with glowing staffs, sappers with powder kegs, and a round shield for the hero.
- **Soldier classes:** tap a soldier and change class: Swordsman (wide sweep), Spearman (long thrust, holds the line) or Medic (heals allies nearby, weak attack).
- **Walls:** raiders are drawn to badly damaged wall sections, workers repair the most damaged section first, and the morning report counts weak walls.
- **Caravans:** from day 5, every fourth day a trade caravan crosses the bridge to your gate. Roads raise the payout; bandits sometimes ambush it - defend it or it is lost.
- **Hero skills:** level-ups open a skill tree (Vanguard / Ranger / Tactician) instead of random picks; deeper nodes need points in the same branch. Tap the stats bar level row to view it any time.
- **Weather:** rain (and snow in winter) cuts vision and archer range; storm nights always rain.
- **World dressing:** bushes on the hills, a fishing pier, and farm plots that appear beside well-worn roads.
- **Guided first day:** short highlighted tips on a new game (Settings > Replay tips to see them again).
- **Graphics:** a new Lowest setting for old phones (also switched on automatically if Low is still too slow).
- **Farming:** farmers now play the Farming Pack clips (plant, water, pull, pick fruit, cycling) instead of the pickaxe animation. The archery range model is smaller.
- **Medics on expeditions:** a Medic soldier in your escort now heals you and the other escorts as it does at home.
- **Great sword:** walking and running use the original motion-capture arms again; only attacks bring the left hand to the grip.
- **Great sword skills:** the Vanguard branch gains Great Sword Mastery (+18% damage, +6% reach per rank) and Whirlwind (+25% spin-slash damage, +8% radius per rank). Q now also cycles to **Unarmed** (no weapon or shield, normal locomotion, weak punches) so the base movement can be checked. Source FBX files are not stored in the repo, only the retargeted `js/anims.js`.
- **Spear combo (nf-v98):** three attacks in a row, reset after 0.8 s without attacking, a dash, jump or block: 1) the captured bayonet stab, 2) the sword-style slash (a copy of `ssAttack1`, the same as before), 3) a full-body lunge stab (captured `spearFinal` from `Standing_Torch_Melee_Attack_Stab.fbx`, trimmed to its wind-up and thrust; procedural `spearLunge` is the fallback): about 2.6x damage, longer reach, stun and a screen shake. Attack 1 is the captured bayonet stab (0.6 s), attack 2 is the swing of the second sword-and-shield attack (`ssAttack2`, steered by the spear arm, 0.65 s); only the final lunge has its two arms mirrored (the spear stays in the right hand, the shield on the left) in the mirror block of `js/rig.js`. The lunge shows a FULL THRUST! text and does about 2.6x damage. Soldiers with spears use the same three steps.
- **Animation library:** `js/anims_lib.js` holds all 178 readable clips from every Mixamo pack received (locomotion, sword and shield, longbow, great sword, farming, spear), already retargeted and named `<pack>_<clip>`. The game never loads it (and the Android build leaves it out); to use a move such as jump, copy that clip into `js/anims.js` and wire it up, no FBX needed. Regenerate with `LIB=1 node tools/retarget_mixamo.js <three-dir> <fbx folders...>`. Two farming clips are unreadable by the loader and are missing.
- **Mining and woodcutting:** stone mining and woodcutting now use the captured pickaxe swing and axe swing from `tools/anim_src/knight_tools.glb` (retargeted by `tools/retarget_mixamo.js`, which now also reads `.glb` files with several animations; `file.glb#N` selects animation N). The captured clips are two-handed, so the left hand is placed on the tool shaft at the captured grip point; the tool head orientation code is unchanged. The older hand-built mining and chopping motions stay as a fallback. Both swings are played at exactly 1 second per swing (woodcutting uses the heavy side swing from `tools/anim_src/knight_chop.glb`). The captured clips did not loop cleanly (mining ended mid-crouch, chopping ended standing and snapped back), so only one swing is kept from each (`win` in `tools/retarget_mixamo.js`) and its last frames blend into the first. Mining plays the whole captured motion (wind-up, strike, bend down to the ore) in 1 s with only the last 6 frames blended into the first; woodcutting now uses `Standing_Melee_Attack_Horizontal` (`tools/anim_src/standing_melee_horizontal.fbx`), trimmed of its idle tail and played in 1 s; the left hand grips the axe shaft too.
- **Brawling:** the Unarmed hero and ordinary citizens punch and kick using six captured clips (two punches, hook, two kicks, roundhouse). They chain into an endless combo with the slow lead-in and recovery trimmed so there is no gap, ending with a roundhouse. Citizens who meet an enemy nearby by day fight back weakly. Punches and kicks use their own thud sounds and small dust puffs at the fist or foot instead of the sword swoosh and slash arc.
- **Town growth:** reaching Age 3 turns every tent into a wooden house. Once the second (stone) wall is finished the Village Plan adds "Outer Fields & Towers": farms and the archery range move to the ring between the first fence and the second wall (levels and workers kept; farms that are missing are built new, up to four), and four more defense towers go on the outer corners. Towers shoot enemies in any direction within 22 units (not siege units or roaming enemies).
- **Outer homes, towers, labels:** after the outer fields the plan adds six outer houses in two batches of three (the second batch waits until the first is built; each house raises the population cap by 1). Towers now shoot siege units too. NPCs no longer show what they are doing above their heads, only a small health bar (the tap card still shows the activity); the hunger and sickness bubbles are gone too.
- **Citizen look:** removed the old era-based straw hat, helmet and red cape that were added on top of citizens (left over from the stick figures); farmers and other citizens now show only their own polygon clothes and hats.
- **Combo reset:** every attack chain (sword, great sword, spear, brawl) starts again from its first move if you do not attack again within 1 second of the last attack ending.
- **Jump, block, dodge, reactions:** X (or the Jump button) plays the weapon set's jump clip. Hold Shift (or the Block button) to guard with the shield / great sword / bow guard pose: 75% less damage, slower movement, no attacking. Dash now plays a dodge clip matching the move direction (forward, back, left, right). Getting hit plays a short impact reaction (hero and raiders; not bosses, siege or beasts), and deaths pick between two clips. Raiders now use the combat packs too: sword-and-shield locomotion, attacks and reactions (bow pack for archers), running when fast. Fixed: non-looping captured clips used to end on their first pose (so blocks released and dead bodies popped back up); blocks now hold as long as you hold, and the normal / bow jump plays only the crouch-air-landing part over 1.1 s.

## Warbands (army expansion, phase 1)
Soldiers now belong to **warbands** of up to 6, named after heraldic beasts (Lion, Wolf, Stag, Eagle, Raven, Boar; up to 6 warbands) and shown by the banner colour of the health bar frame above each soldier. New soldiers join the first warband with room; tap a soldier and use the **warband** button on the card to move them. The soldier limit is 6 plus 6 per barracks and 3 per archery range (the morning promotion skips when you are at the limit). In the Journal, the old Escort button became the **Warbands** list: pick one warband to bring on an expedition; its soldiers follow you and fight, and are away from the village meanwhile. A small **warband bar** at the bottom centre shows each warband as a banner-coloured chip with its soldiers (a flag marks the one coming on your next journey). Tap a chip to open the warband window: rename it (any name up to 22 letters), pick a banner colour from eight, see its soldiers (tap one to open their card), and choose whether it comes on the next journey. Journey power now counts the warband you bring in full and the soldiers left home at one third (reserves), plus you. Warbands are saved with the game (the save field is still called `squad`). Expedition power requirements still count every soldier, not only the ones you bring.

## Roadmap
Journey power requirements (`CFG.EXP_NEED`) are now multiplied by `CFG.EXP_NEED_SCALE` (0.8, a guess): they were tuned when every soldier counted fully, but now only the warband you bring counts fully and soldiers left home count one third. Each warband also has a saved order field (`forward`, `stand`, `withdraw`, `charge`; default `forward`, old saves load as `forward`). It has no effect or buttons yet; these come with the next steps of the orders work.

Soldiers now have two classes: the **home class** (used in town, changed on the soldier card while at home) and the **journey class** (used only on journeys). Set the journey class with the **Journey** button beside each soldier in the warband window; changing the class from the card during a journey changes only the journey class. When a warband sets out its soldiers switch to their journey class (for example a medic), and when they return they switch back to their home class and carry on their normal duty. Saves keep both (old saves: journey class = home class).

The warband window now has four **order buttons**: Forward (as before), Stand firm (at night only fight foes near the post; on a journey hold the spot where the order was given), Withdraw (melee men do not engage; on a journey they stay by your side), Charge (notice foes from further away and chase harder). A small letter on the warband chip shows a non-Forward order. The older Follow / Guard order (now the O key) is separate and unchanged. Orders are saved. Not yet tested by watching real fights.

Interface fixes (nf-v67): the **View** button (camera) moved to the right-hand button column, above **Weapon** (both shortened to one word) so it is no longer pressed by mistake, and the three shortcut buttons above the stick sit higher, leaving free space around the stick. The **warband bar now shows during journeys** (only the warbands that came along) so you can give orders there, and the journey class can be changed there too. Each soldier row in the warband window has **At home**, **Journey** class buttons and **Move band**, so no soldier card is needed; tapping a soldier's name still opens the card, and closing the card returns to the warband window. In portrait the warband bar sits above the sound and settings buttons instead of on top of them.

**Mark the foe** (nf-v70): the **Mark** button at the end of the warband bar (key **Y**) marks the closest enemy, preferring the one in front of you (within 45); a red ring and arrow follow it. Every warband then goes for it first: at night at home (melee and archers; archers skip siege throwers) and on journeys. Withdraw ignores the mark; Stand firm only follows it when the foe is near their post or spot. Press Mark again to clear; the mark also clears when the foe dies. Not saved. Marking a siege thrower lets your melee men rush it. Only tested headless.

**Leader's standard** (nf-v71): you carry a small gold banner on your back. Soldiers within 12 paces of you deal +15% damage and take 15% less (the Commander class gets 1.5x the bonus and a 25% wider reach; this replaces the old Commander-only 15% aura). A faint gold ring shows the reach while a fight is near. The numbers are guesses (`CFG.STANDARD`). The warband window shows the current bonus. **New hero skills**: Ranger (movement) gains Long Stride (faster when no foe is near), Shadow Step (longer dash, a little more untouchable time) and Rushing Strike (+25% damage for 1.2s after a dash); Tactician (spear) gains Lunge (spear thrust +12% damage, +10% reach), Impale (thrust staggers foes 0.25s per rank, slightly wider) and Standard Bearer (standard reaches 20% further per rank and gives +4% damage / +3% less damage taken per rank). The skill tree now has up to 7 nodes per branch (unlock points 0, 2, 4, 6, 6, 8, 10). Only tested headless.

**Blacksmith: great swords and spears** (nf-v72): the smithy now lists swords, great swords, spears, bows and armor in sections, and the great sword and spear have their own gear: Iron (damage 4), Steel (6, Age 3) and Beacon (9, after the Dawn Gate), each with its own cost (more iron for the great sword; wood and iron for the spear). The hero uses the gear of the weapon in hand; old saves start with the great sword and spear at the same level as the sword. Soldiers of the great sword and spear classes fetch gear for their class from the rack, and use the better of that and their sword. Journey power counts the best of the three weapons. Racks show the new weapons. Only tested headless; the prices are guesses.

**Several warbands on one journey** (nf-v73): you can now bring up to 1 warband at Age 1, 2 at Age 2 and 3 at Age 3 (tap Bring in the warband window or the Journal; tap again to leave one home). Everyone who goes follows you in rows of six. When you return, the soldiers who went stand where you came back and walk to their own duties; fallen soldiers are carried home to recover. A message lists each warband that came back and how many are on their feet. If every soldier comes along, a warning says the village has no guard. Journey power counts all the warbands you bring in full. Only tested headless.

**Bandit Camp raid (first step, nf-v75)**: a new Age 2 Journal entry, **Bandit Camp**, marked as a raid that needs at least 2 warbands (the button says "Bring 2 warbands" until you pick them; the camp needs power 56 for now). The camp is a walled ring with a gate in the south facing your arrival point, four watchtowers on the corners, six tents, a campfire with three loot chests nearby, a red chief's tent, a bandit banner, and a big Bandit Chief guard. About three in four of its guards stand inside the walls, the rest roam outside. This step is only the layout: the palisade blocks you and your soldiers but not the raiders yet, towers have no archers on them, and the camp is cleared like any other site (there is no chief or banner objective, no lasting effect and no tuned power yet). Only tested headless.

**Fixes (nf-v76)**: after clearing the Bandit Camp the Journal would not open (the camp had no supply-camp entry, so the list crashed); fixed, and a cleared Bandit Camp can now become a supply camp (+4 iron, +3 food each morning). The gold standard banner on the hero's back now only shows while soldiers fight beside you, not in town. Attack is now a big red **Attack** button at the bottom of the right-hand column; tapping empty ground on a touch screen no longer attacks, so you cannot hit a soldier by mistake (mouse clicks still attack on a computer; F still works).

**Bandit Camp behaviour** (nf-v77): the camp guards now hold their posts and only rush you when you or your soldiers come within about 12 paces, or when the alarm sounds (any guard noticing you or taking a hit rings it; a horn plays and the top line shows ALARM). Raiders cannot walk through the palisade, towers or tents: to get in or out they use the south gate, and your soldiers do the same. Guards that lose their target walk back to their posts. Two of the four towers have an archer on top (they shoot out to about 20 paces; you can still hit them from the foot of the tower), and the one ordinary archer inside shoots too; raiders' arrows now hurt journey soldiers properly. Killing the **Bandit Chief** breaks the camp: +8 iron, +6 food, bonus XP, a reward chest, and the remaining guards stop attacking. The top line shows whether the chief is alive, the alarm is up, or the camp is broken; pressing Return home first warns you if the chief still stands, and the camp only counts as cleared (for the supply camp) once the chief is down and the chests are taken. Only tested headless: the alarm, wall blocking and chief kill worked; arrows from the towers and the feel of the fight were not checked.

**One-warband raid and a Raids tab** (nf-v78): the Journal now has two tabs, **Journeys** and **Raids**, so camps no longer sit among the ordinary journeys (the warband list shows on both). The Raids tab has two entries: **Raider Outpost** (Age 1, needs only 1 warband, power 24: a small palisaded outpost with one watchtower archer, three tents, two loot chests and a Raider Captain) and the **Bandit Camp** (Age 2, 2 warbands, power 56). Both use the same camp behaviour and both can become supply camps once cleared (outpost +2 iron, +2 food; camp +4 iron, +3 food). Only tested headless.

**Broken camps weaken raids; towers shoot wanderers** (nf-v79): breaking a camp now lowers the size of the nightly waves on your village for a while: the Raider Outpost by 10% for 5 days, the Bandit Camp by 20% for 7 days. Effects from different camps add up (at most 35%), raiding the same camp again refreshes its timer, and it works for quiet nights, Blood Moon raids and the forecast. The Raids tab shows the active effect and the defence summary mentions it. Town towers now also shoot the wandering night prowlers and roaming day creatures (before, only the ordinary raiders), make a bow sound when they shoot, and fire slower than archers: every 2.4 seconds instead of 1.3 (archers fire every 1.5). The effect timer is saved with the game story. Only tested headless.

**New face for the leader** (nf-v80): the hero's polygon head was reshaped toward a reference picture (stylised bearded man with swept-back brown hair): warm peach skin, reddish-brown hair swept back from the forehead with volume over the temples and a longer back, thick angled brows, a fuller beard that joins long sideburns and a drooping moustache; the coat is now a darker russet leather (it was bright orange-red). Only the hero changed. It is an approximation in the game's blocky low-poly style, not a copy of the picture.

**Face and armor tweaks** (nf-v81): the round cheek bumps were removed from every character's face. The leader no longer shows a helmet or breastplate when you upgrade armor: armor still reduces damage as before, but the leader's look stays the same (soldiers still show their armor). The leader's shield still changes with armor tier.

**Raid power and the banner objective** (nf-v83): raids now compare your power counting only the warbands you bring plus you (soldiers left at home do not help in a camp); the Raids tab shows your number next to the need, and the toast when you are too weak says so. Needs were lowered a little: Raider Outpost 22, Bandit Camp 50. There is now a second way to break a camp: stand next to the bandit banner in the middle of the camp and press Gather (G) for 3 seconds (moving cancels it). A burning banner breaks the camp like killing the chief does, with a smaller reward (+4 iron, +3 food), the same lasting effect on raids, and the guards stop fighting; the chief can still be killed for his chest. The camp counts as cleared once it is broken and the chests are taken. Only tested headless.

**Bandit Stronghold** (nf-v84): a third raid in the Raids tab for Age 3 that needs 3 warbands (power 96). It is a much bigger camp: a 20-pace palisade, six watchtowers with four archers on them, about nine tents, five loot chests, a big Bandit Warlord (9x health) and around 18 guards, with the same behaviour as the other camps (posts and alarm, gate, burn the banner or kill the warlord). Breaking it makes raids on your village 25% smaller for 8 days (effects from all camps still add up to at most 35%) and it can become a supply camp (+6 iron, +4 food, +4 stone a morning). The tent ring now leaves a gap for the chief's tent, so one tent less in the smaller camps (it used to overlap). Only tested headless.

**Polish pass** (nf-v85): checked and found no problems in these (all headless): the on-screen buttons never overlap or fall off screen at five phone sizes (360x640, 390x844, 844x390, 667x375, 900x420; only the debug panel overlaps, and it exists only with ?debug=1); a long village night with orders, marks and the standard produced no errors; saving and loading keeps warband orders, journey classes, the new gear slots, new skill points and the camp effect, and an old save without those fields loads with sensible values (the great sword and spear start at the sword's level). Tweaks: town towers now do 3 damage (up from 2) to make up for firing slower than archers; the "every soldier came with you" warning shows only the first three times.

**Map view (campaign map phase 1, nf-v86)**: the Journal now opens on a **Map** tab (the Journeys and Raids lists are still there). The map is a small board with your village on the left, roads, and a dot for every site: green forays, red raids, blue night sites, gold story sites (which appear once their chapter is unlocked). Dim dots are locked or too strong, a tick marks a cleared site. Tap a dot to see the same card as in the lists (with the Depart button) under the map; the warband list moved below it. This changes only how you pick a site: the rules, time limits, power needs and battles are unchanged. Plan and next phases: `docs/CAMPAIGN_MAP_PLAN.md`. Only tested headless.

**March days (campaign map phase 2, nf-v87)**: two far raids appear under the map as **Far lands**: the **Hill Clan Camp** (Age 2, 2 warbands, 1 day's march each way, power 53) and the **Iron Legion Fort** (Age 3, 3 warbands, 2 days each way, power 104). Both are camps like the others (posts and alarm, gate, burn the banner or kill the chief; the Hill Clan is archer-heavy, the Legion has shield lines and six towers) and, once cleared, give bigger supply camps and a longer raid-relief (15% for 7 days and 30% for 9 days; all camp effects still add up to at most 35%). **Marching**: the soldiers you bring eat 1 food per soldier per day of the whole trip (there and back), paid when you leave; the first Depart press shows the cost and how safe the village will be, the second press marches. Whole days pass: you arrive at the same hour of day on the far side and come home at 06:30 after the return nights. **Home nights while you are away** are settled by numbers instead of a live fight: the raid size for that night (same formula as the real raids, with camp relief) against the guard left at home (soldiers who stayed, 4 per tower, the militia and the state of the walls). The result is one of: driven off; driven off with wall damage; broke through (walls and 10% of the stores hit, maybe a villager lost); overran (a quarter of the stores, most walls and up to two villagers lost). A report lists each night on departure and on return, and citizens keep eating and supply camps keep paying on the days in between. Forays and the three nearer raids stay same-day. All numbers (`CFG.MAP_RULES`, tower value 4, soldier value as in journey power) are guesses. Only tested headless: a full march out, the battle and the march back worked, and the night results were checked on sample numbers.

**Holding captured camps (campaign map phase 3, nf-v88)**: once a raid camp is broken and its chests are taken, its card in the Journal offers **Garrison it (1 soldier)**: your weakest soldier at home (not one on a journey) is posted there and leaves the village (he still counts against the soldier cap). A held camp (marked with a flag on the map) pays its supply income every morning with no building cost, and keeps raids on your village smaller for as long as it is held (no timer). Each garrison soldier eats 1 food a day; you can reinforce up to 3. Raiders may try to retake a held camp: the card shows the daily chance (6% to 12% by site, lower with more soldiers) and the chance the garrison holds; later in the game attacks get stronger, so a one-man garrison eventually falls. If the garrison falls, the soldiers are lost, the camp's supplies stop and it can be raided again. A cleared camp that nobody garrisons is reoccupied by bandits after 10 days (shown on the card). Holds are saved with the story and work during march days too. Not in this step: garrison size changing the camp you fight, recalling a garrison, and held nodes needing a banner or captain. Only tested headless (hold, reinforce, retake loss, revert, saves of the new fields).

**Less text in the game** (nf-v89): the Journal shows only the current story goal (no list of old goals, stars or log lines), a one-line power and departure hint, and a short warband line ("2/2 ready", no soldier names); site cards are shorter (for example "High · 2 bands · 1d march (8 food) · Power 50 (you 93) · Loot..." with one-line descriptions for the raids); the warband window lost its explanatory paragraphs and its standard line, and the order hint is a few words; march, camp, hold and return messages are one short line each ("Camp broken! +8 iron +6 food · raids -20%", "Night 3: ~16 raiders repelled."); the first-day tips and objectives are shorter; the morning report no longer has the wealth, gear and market lines. No rules changed. Rule of thumb for new text: one short line, numbers before words, no explanations in the game (they belong in this README).

**One Journal view** (nf-v90): the Journeys and Raids tabs are gone. Every site (forays, raids, night and story sites) is on the map, and the far raids are listed under it, so the Journal is now just: current goal, the map, the selected site's card, then your warbands. Older notes above that mention the Journeys / Raids tabs or lists describe earlier versions.

**Realms (campaign map phase 4, nf-v91)**: the raiders now belong to three realms: **Bandit Lords** (red), **Hill Clan** (green) and **Iron Legion** (blue-grey). Each has three raid camps (nine in all; four new: Clan Watch, Legion Post, Clan Stronghold, Legion Keep) shown in the realm's colour on the map and in the Far lands list, with a one-line count under the map (for example "Bandits 1/3" = camps held). Every Blood Moon raid on the village now comes from one realm, named in the warning and the top line: Hill Clan raids bring many more archers, Iron Legion raids many more shield bearers, Bandit raids are the old mix. Breaking a camp now weakens only **that realm's** raids (Clan Watch 25%, Hill Clan Camp 35%, Clan Stronghold 50% and so on; one realm is capped at 60%) for some days, or for as long as you hold it; quiet nights get the average of the three realms. If you **hold all three** camps of a realm, its raids drop by 80% and "<realm> broken!" shows once. Raiders retaking a held camp are also weaker when you hold more of that realm. The forecast and morning report name the realm. Only tested headless.

**Night lighting fix** (nf-v92): the night fog was measured from the camera, so zooming out pushed the whole village into fog and made it darker, as if the light followed the camera. The fog distances now add the camera's distance to the hero, so what is around the hero looks the same at any zoom. The night is also a little brighter overall (moonlight 0.18 to 0.30, ambient 0.28 to 0.42) and the Map View (bird's-eye) adds a bit of ambient light at night. In a headless test at night the screen brightness at three zoom levels went from 73 / 76 / 53 (darker when far) to 70 / 86 / 89 (no longer darker when far). Day lighting is unchanged. Only tested headless.

**Closer walls** (nf-v93): the defense lines are now planned with their pieces almost touching: the wooden fence spacing went from 3.0 to 2.5 (the fence piece is 2.4 wide) and the stone wall from 3.57 to 3.13 (the piece is 3.0 wide), so there are about 20% and 14% more pieces on each line (the first line 48 pieces, the second 64) and they need a bit more wood and stone to build or upgrade; the gates are a little narrower (about 2.6 for the first line). This only applies to lines you plan from now on: walls already built or planned in an existing save keep their old spacing. Only tested headless (in a fresh debug village the nearest pieces were 2.5 and 3.13 apart).

**No fire on top of the hall and castle** (nf-v94): the flame no longer burns on the roof of the wooden hall (Age 2) or on the stone castle (Age 3), and the little chimney-like hearth on the Age 2 roof is gone. The campfire still burns at Age 1. The warm light around the middle of the village stays, so nights are not darker; it just has no visible flame. Only tested headless.

**Orders button and camera drag** (nf-v95): the **Orders** button (and Rest / Smithy) could not be tapped because the invisible box around the Jump / Weapon button column covered them; only the buttons themselves take taps now (found by checking what sits on top of the button; after the fix the Orders button switches Follow and Guard). Dragging to turn the camera used to work only on the half of the screen away from the stick (the right 60% for right-handed play); it now works anywhere that is not a button or the stick, in both hand settings. Pinch to zoom is unchanged. Only tested headless (a simulated drag turned the camera by the same amount from the left and the right side).

**Spear aim, great sword swing, combo reset** (nf-v96): (1) Spear: the thrust hitbox and its streak now follow the direction the visible spear point is aiming at the moment of the hit (before, they used the body's facing, and the spear in the animation was about 8 degrees away from it); the spear is also steered more toward the facing (85% instead of 70%), so it is now about 3 degrees off at most. (2) Great sword: the first attack animation looked like a hit with the handle, so it is no longer used; the combo is now two quick sweeping slashes (the other two great sword slash animations) alternating, then the spin on the fourth, and the normal slashes are faster (0.9 s instead of 1.1 s). This also applies to soldiers with the great sword class. (3) Combo: it only builds when you attack again within 0.8 s of the last attack ending (it was 1 s), and dashing, jumping, blocking, gathering or switching weapon now resets it to the first attack (it used to keep counting through those). Only tested headless (the animation names, the combo steps and the spear angle were measured; I could not judge how the moves look).

Project state and how to continue in a new chat: [docs/HANDOFF.md](docs/HANDOFF.md). Long-term plans (army and war expansion: warbands, commands, war map, sieges, enemy factions) are in [docs/ROADMAP.md](docs/ROADMAP.md). Not built yet.

## Motion-capture animations
The Mixamo Locomotion Pack and Lite Sword and Shield Pack are retargeted onto the game's stick-man skeleton (`tools/retarget_mixamo.js` writes `js/anims.js`). Everyone uses the captured idle / walk / run / death; swordsmen and the hero in sword mode use the sword-and-shield guard idle, run and three rotating slashes plus a jumping slam every fourth attack. Bow users (hero in bow mode, archers) use the captured draw-arrow and run (walking uses the normal walk, the crouch-walk clip looked odd); the arrow leaves when the hand reaches forward. Spear users hold the spear upright when standing, and like a sword (shaft at a right angle to the forearm) when running and attacking: they use the sword-and-shield run, the captured bayonet stab (narrow, very long reach; shaft aligned from shoulder to hand) and a sword slash clip (wide sweep). Mining combines the leg step of the first sword attack with the upper body of the jumping slam (the pickaxe shaft follows the right arm); woodcutting is a procedural baseball swing (torso wound back, then whipped around with the axe level) on the same sword-attack leg step; the medic pose stays procedural. The wrist is retargeted too (`handL`/`handR` tracks), so swords and bows follow the captured hand; spears are thrust with one hand (the shaft follows the shoulder-to-hand line during a stab or slash) while the other arm carries the shield, which is strapped to the outside of the forearm, and the bow is held in the left hand, whose arm the draw clip extends forward. On model characters the hand bones sit at the fist (0.45 below the elbow) so weapons are gripped by the hand.
To regenerate: `node tools/retarget_mixamo.js <three@0.128 folder> <locomotion fbx folder> <sword-shield fbx folder>`.

## Character and weapon models
Characters are skinned meshes (`js/models.js`, built by `tools/build_models.py <models folder>`): the hero is the Leader, swordsmen use Soldier_sword, archers Soldier_bow, citizens the male/female models (picked per person), raiders Bandit1/Bandit2 (tinted per raider type). The meshes are weighted to the same 11-bone skeleton, so all animations (captured and procedural) drive them; weapons come from the weapons pack (sword, spear, bow, round shield - the scabbard is left out) and gathering uses the pickaxe / axe models (axe for trees, pickaxe for rock); the staff is still procedural and armor tiers are hidden (armor pieces are not drawn on the models). Textures are downsized to 512 px. If a model file is missing the game falls back to the old stick-man figures.

## Releasing to Google Play
See `RELEASE.md` (signing key, GitHub secrets, `Android release` workflow) and `docs/privacy-policy.md`.

## Android (debug APK)
See [ANDROID.md](ANDROID.md): a Capacitor wrapper plus a GitHub Actions workflow that builds `app-debug.apk` (Actions -> "Android debug APK" -> Run workflow). three.js is now bundled in `vendor/`, so the game (and the app) work fully offline.


### Structure models

The well, blacksmith, archery range, tent (age-1 houses), campfire ring, wooden fence, brick wall and pine tree are static meshes from `js/structures.js`, built by `tools/build_structures.py <folder>` (a folder with `Well/`, `Blacksmith/`, `archery_target/`, `camping_scene_3d_model/`). `structMesh(key)` in `js/rig.js` returns a mesh with the base centre at the origin and the front toward +z; if `structures.js` is missing the game falls back to the old box-built versions. Collision radii, blueprints and wall HP are unchanged.

> Temporary: the skinned character models are switched off (everyone uses the polygon stick-man rig so the movement can be judged). Add `?models=1` to the URL, or set `USE_CHAR_MODELS` in `js/rig.js`, to turn them back on.

### Polygon characters (concept-art look)

With the skinned models off, `buildStickman` in `js/rig.js` draws everyone from low-poly parts: a faceted head (carved from a sphere: flat face, squared jaw, brow ridge, nose, cheekbones, eyes), beards and hair styles, leather vests with crossed straps and double belts, chain-mail sleeves and tunics (with a mesh texture), steel pauldrons and greaves, tall cuffed boots, simple hands and feet (no fingers or toes). Roles: hero (mail + leather vest + one steel pauldron + beard), soldiers (nasal helm with cheek guards), archers (leather cuirass, hood or short hair), citizens (blacksmith apron, farmer hat, elder robe, woman with kerchief and dress) and five raider types (helmed fighter, hooded masked rogue, fur-collared brute, cloaked woman, scarfed youth).

### Aiming and strafing

The hero no longer turns toward the movement direction. The body always faces where the camera looks, and it turns only when you turn the screen (drag on touch, mouse drag). Movement is relative to that facing: forward runs, left/right play the captured strafe clips (the leg motion is mixed with the sword-and-shield or bow upper body), and backward plays the run clip in reverse. Attacks and arrows go where the camera looks; a dash goes in the input direction (or straight ahead when there is no input). Villagers, soldiers and raiders still face the way they walk.

The skinned/polygon heads are now rounded boxes (flat face, squared jaw).

### Camera

- **Front View (H)** button: puts the camera in front of the hero so you can see his face and front; press again for the usual back view. Controls stay screen-relative (stick up = away from the camera, so the hero backpedals toward you).
- **Map View (B)**: the camera is free - drag to turn/tilt (now up to straight down), pinch or wheel to zoom much closer (down to 5 units), and two fingers (or right mouse drag) to pan the camera across the map. The hero does not turn with the camera in map view; he faces the way he walks.

### Movement sets (Locomotion + Pro Longbow + Pro Sword and Shield packs)

`node tools/retarget_mixamo.js <three-r128-dir> <loco-dir> <ss-dir> <bow-dir> <spear-dir>` writes `js/anims.js` with three movement sets, each with idle, walk, run, left/right strafe and backward:

- **Normal** (Locomotion Pack): used by everyone with a weapon while no enemy is near. Backward is the forward clip played in reverse.
- **Sword and shield** (Pro Sword and Shield Pack): used by the hero, swordsmen and spearmen when an enemy is within about 25 units or on a journey (the clips are `ssIdle`, `ssWalk/ssWalkB`, `ssRun/ssRunB`, `ssStrafeP/N` and `ssStrafeP/NW` for walking strafes).
- **Bow** (Pro Longbow Pack): used by the hero in bow mode and by archers in the same situations (`bowIdle`, `bowWalk/B/P/N`, `bowRun/B/P/N`), plus the bow death.

Raiders and journey escorts are always in the combat set. The attack clips are unchanged (sword-and-shield attacks, the captured bayonet stab and slash, the bow draw); `die` is the sword-and-shield death and `dieBow` the bow death.

### Movement per weapon pack, and the Great Swordsman

Each weapon now moves with its own pack instead of the generic locomotion (people without a weapon pose, and raiders with melee weapons, still use the Locomotion Pack):

| Weapon | Pack | Calm (no enemy near) | Combat (enemy within ~25 units, or on a journey) |
|---|---|---|---|
| Sword, spear (+ shield) | Pro Sword and Shield | relaxed idle (idle 3), same walk / run / strafe / backward clips | guard idle, same walk / run / strafe / backward clips |
| Bow | Pro Longbow | idle 02, walk with the bow lowered, run | idle 01, aimed walk in all four directions, run |
| Great sword | Great Sword | relaxed idle (idle 5), walk / run / strafe / backward | guard idle, same walk / run / strafe / backward clips |

The Sword and Shield and Great Sword packs only contain guarded-stance locomotion, so there the calm/combat difference is the idle pose.

**Great Swordsman** (new soldier class; tap a soldier's card to cycle classes): a longer two-handed sword (the sword mesh at 1.6x), slow heavy cleaves (reach 2.6, 1.7x damage, wide arc) with every fourth attack a spinning 360-degree slash (2.4x damage). Attacks use the Great Sword pack (`gsAttack1..4`), death is `dieGs`.

### Town peace: weapons put away
Guards (swordsmen, spearmen, great swordsmen) and archers put their weapons (and shield) away while no enemy is within about 24 units and they are not on a journey or mid-attack, and they walk and idle with the normal Locomotion clips. When an enemy comes near they draw the weapon again and switch to their weapon pack's movement. The hero never sheathes. The spear is always held like a sword (tip up and forward); only the stab uses the shoulder-to-hand alignment.

The soldier card now has a class picker (Sword / Spear / Great Sword / Medic) as well as the tap-to-cycle button.

### Hero great sword
The Q weapon switch now cycles Sword, Great Sword, Bow, Spear. The great sword is two-handed (no shield), uses the Great Sword pack for moving and attacking, has longer reach (wide arc, 1.7x damage, slower cooldown) and every fourth attack is a spinning slash around the hero (2.4x damage, 360 degrees). It uses the equipped sword's tier and upgrades.

### Great sword grip
During an attack the great sword is held with both hands: a two-bone arm solver reaches the left hand to the hilt (and pulls the right hand in to meet it when the hilt is out of reach), keeping the sword's direction from the captured right wrist. While walking, running or standing the left arm hangs naturally and the sword is held in one hand.

### Bow reticle and roaming enemies
- With the bow equipped a small white crosshair (dark outline, ~70% opacity) shows where arrows fly (12 units ahead of the hero along his facing). It turns red when an enemy is almost exactly on that line within range. It is hidden in map view, front view and menus.
- A few raiders and beasts (2 at the start, up to 6 later) now roam the map outside the village by day and by night. They wander slowly, chase the hero when he comes within about 11 units (give up at about 18), never come closer to the village than 34 units and lose interest when the hero is inside the village (within 32). Soldiers and archers ignore them. They drop a little iron and give about 1.3x XP, and respawn after a while. Night hunt prowlers are unchanged.

**Three-hit combos** (nf-v108): the sword-and-shield and great sword combos are now three attacks instead of four: sword = slash 1, slash 2, jump slam; great sword = two slashes, then the spin slash. The repeated third slash was removed.

**Night, camp and tower balance** (nf-v109): night raids are bigger (WAVE_BASE 4, WAVE_PER_DAY 3, quiet nights 2 + day/2 up to 9, Normal x1.5 raiders and Hard x2.1). On a raid, soldiers do only 20% damage to the chief when the leader is more than 16 paces away (60% beyond 10), so bands cannot clear a camp alone. Camp towers were rebuilt with a wider deck, open low rails and a high roof so the archer stands visibly on top instead of inside a box. Arrows from high towers (the village towers and camp archers) now fly downward to the target instead of passing overhead.

**Siege, step 1: the Legion Castle** (nf-v110, `legioncastle`): a new far raid (Age 3, 3 warbands, 2 days away, power need 132, Iron Legion). The zone is a 22-pace stone wall with four towers and archers, a barred **gate** (three door panels, 240 HP, blocks everyone) and a stone keep, defended by shield lines, brutes and a Castle Lord. Break the gate (your hits do 50% of normal damage to it, soldiers 25%, and soldiers also hit it when you stand near it and nothing else is in reach), then kill the lord or burn the banner. Siege gear (step 2 and later) will deal 4x. Taking it makes a hold (income) and weakens the Legion's raids. Plan: `docs/SIEGE_PLAN.md`.

**Siege, step 2: the ram** (nf-v111): the Legion Castle gate now has 360 HP and a **siege ram** waits on the road in front of it. Stand behind the ram (counts as 2 pushers) and/or let your soldiers push it (up to 3 melee soldiers walk to it when nothing is in reach and you are within about 24 paces): with at least 2 pushers it rolls to the gate (faster with more pushers) and batters it every ~1.8 s for about 64 damage (4x), so the gate falls in around 6 hits. Enemies near the ram wear it down (120 HP; brutes hurt it most); if it breaks you must chip the gate by hand. Note: in the headless test, remember `__nf.pause(false)` because the tutorial coach can freeze time.

**Siege, step 3: ladders and boiling oil** (nf-v112): the Legion Castle now has 3 **ladders** lying outside the wall (two beside the gate and one on the east side) and 4 **oil pots** on the wall (two flanking the gate, two on the sides). Stand next to a ladder and press Gather (2 s) to raise it: the two wall sections there drop low so you and your soldiers can step over, and the army routes to a raised ladder while the gate is shut. The defenders push a ladder over after about 14 s if they are near it and you are not (about 40 s if you stay close and they are near), which closes the gap again and leaves the ladder to raise once more. Each oil pot picks the nearest target outside the wall within about 10 paces (you, a soldier or the ram), marks the ground with a red ring, and about 1 s later drops boiling oil (damage to people, 18 to the ram) every 5.5 to 8 s. They stop once the castle falls. Test note: morning event dialogs also freeze time in headless tests; dismiss them.

**Siege, step 4: the Siege Workshop and carried gear** (nf-v113): a new last Village Plan step, **Plan Siege Workshop** (Age 3, 80 wood, 40 stone, 10 iron, after the outer homes), places a Siege Workshop (an open shed with a ram frame). With it built, the Blacksmith window gets a **Siege gear** section: a **Siege Ram** (40 wood, 12 iron, carry 1) and **Siege Ladders** (18 wood, 2 iron each, carry up to 3). The gear is stored in `story.siege` (saved with the game). At a castle you bring what you carry: the ram and ladders only appear in the zone if you brought them (a toast says what you brought, or warns that you have none and must chip the gate by hand), and each carried item adds food to the march (ram 2, ladder 1). Coming home you keep a ram that is still alive and every ladder that was not pushed over (pushed-over ladders break and are lost). Debug test hooks added: `siegeGear`, `createBuilding`.

**Siege, step 5: capture, the Iron Fortress and the battle report** (nf-v114): (1) Taking a castle now also pays stone, iron and wood and extra experience (double for the fortress), shows CASTLE TAKEN!, and the castle can be garrisoned as a hold like other raids. (2) New siege **Iron Fortress** (`legionfortress`, Legion, 3 days away, power need 216, after you have taken the Legion Castle): a 26-pace wall, six towers with six archers, a 600 HP gate, six oil pots, three ladder spots and a Legion Marshal; it pays a bigger hold income and weakens Legion raids by 70% for 12 days. (3) A **battle report** now appears when a raid ends (Victory or Withdrawn): time, foes defeated, warband survivors, gate and ram and ladders kept, loot, and the realm effect, merged with the march-home night results. (4) If you withdraw from a castle without taking it, soldiers who had fallen are lost for good (they recover when you win).

**Siege, step 6: the catapult** (nf-v115): the Siege Workshop can also build a **Catapult** (60 wood, 20 iron, carry 1, 3 extra food on the march; Blacksmith window, Siege gear). Brought to a castle it stands outside the east wall. It fires a boulder every 7 s while you, or at least two soldiers, stand within 6 paces: the boulder lands with a splash (70 damage to foes within 4 paces) and screen shake. The first three shots crack the east wall (WALL CRACKS 1/3, 2/3, 3/3) and open a permanent breach (three wall sections drop low, and the army routes through it like a raised ladder); after that it targets the nearest tower, and two hits take out that tower's archer. Enemies standing next to it wear it down (90 HP); you keep it if it survives, and the battle report lists boulders thrown. Test hooks: `breachWall`, `catapultTick`.

**Bring a garrison soldier home** (nf-v116): a held camp or castle card in the Journal map now has a **Bring 1 home** button next to **+1 soldier**. It sends the soldier back to the village (same name, trait and veteran rank) and the garrison shrinks by one; when the last soldier leaves, the place is no longer held and, as before, bandits retake it after 10 days.

**No re-raiding a place you already broke** (nf-v117): a raid you have broken (shown as Broken, or Held with a garrison) can no longer be started again: its button reads Held or Broken, and starting it from elsewhere shows a message. Before, sending the army to a broken or held camp rebuilt the whole camp with fresh defenders, which looked like the camp had already been retaken. It opens again when the bandits really retake it (10 days with no garrison, or a lost hold).

**Wounds, courage and levies** (nf-v118, plan in `docs/WAR_STATE_PLAN.md`): (1) Soldiers who are down when a raid ends come home **wounded** for 1 to 2 days (2 to 3 after a castle) and cannot fight or go on a journey until healed (label Wounded Nd); each morning heals 1 day, plus 1 more with a Medic at home. (2) **Courage** (0 to 100, saved, starts at 70) scales soldier damage (0 = x0.75, 70 = x1, 100 = x1.1): -4 per soldier who falls, +12 when you break a camp or castle, -6 when you withdraw without winning, -5 on a morning with no food, and it drifts back 5 a morning toward 70. At 0 the soldiers on a raid fall back. It shows in the raid line (a fist and number) and in the Journal warband box. (3) **Levies**: in the Journal warband box, Call levy (6 food each, up to 4) adds weak villager fighters (60% health, 70% damage) who go on the next journey whichever warbands you bring and are dismissed when you come home or at the next morning; they do not count toward the soldier cap and are not saved.

**Raid tuning, round 2** (nf-v119): after a balance report (Normal, Day 5, Lv 11: the Day 3 Blood Moon raid cost 1 wall and no citizens, 25 kills), raid-night waves are bigger again: `WAVE_BASE` 5 and `WAVE_PER_DAY` 4 (was 4 and 3). Day 3 goes from about 29 to about 37 raiders on Normal at prosperity 97, and Day 7 and later raids grow faster. Quiet nights were left alone.

**Far lands tab on the map** (nf-v121): the Journal map now has two tabs, **Near lands** and **Far lands (6)**. The Far lands tab is its own board: Home on the left with two branching roads (Hill Clan Camp to Clan Stronghold; Legion Keep to Iron Legion Fort to Legion Castle to Iron Fortress). Tap a node for its card (days, food, power, Depart). Tapping a far node from anywhere switches to its tab.

**Realm castles and the final siege** (nf-v122): two new castle sieges join the Legion Castle on the Far lands tab: the **Clan Castle** (timber walls, 7 tower archers, archers and brutes, 320 HP gate; unlocks after you break the Clan Stronghold) and the **Bandit Castle** (stone walls, brutes, 360 HP gate, 5 oil pots; unlocks after the Bandit Stronghold). Each has its own lord (Clan Warlord, Bandit King), pays like the other castles and cuts that realm's raids by 55% for 10 days. When all three castles are taken the **Iron Throne** opens: the final siege (3 days away, power need 256 on the default scale): a 28-pace wall, six towers with eight archers, a 800 HP gate, six oil pots and the Iron Warlord. Taking it shows **THE CAMPAIGN IS WON**, unlocks the Warlord Fallen achievement, restores courage and the game continues. A site can need several earlier sites now (`after` may be a list).

**Faster healing for the wounded** (nf-v123): wounded soldiers now sit instead of lying on the ground (label Wounded Nd). The Journal warband box has a **Tend wounded** button that heals everyone at once for 3 food per wound-day, and Medics at home now each cut a wound by an extra day each morning (up to two Medics count).

**Ground effects follow the terrain** (nf-v124): slash arcs, thrust beams, boss warnings, the ultimate and rally rings, the leader's standard ring, the gather bar and similar ground markers are now placed at the highest terrain height around them (`groundY`) instead of a fixed height, so they are no longer hidden inside hills.

**Stages and gates** (nf-v125, plan in `docs/STAGES_AND_TRAINING_PLAN.md`): the game text now says **Stage** instead of Age (the code names were renamed in nf-v131: `age` is now `stage`, `CFG.AGES` is `CFG.STAGES`). Advancing needs three things, shown as a checklist in the Town Hall panel (T): resources, a minimum day, and goals. Stage 2: 80 wood, day 2 or later, 4 homes built, 6 citizens. Stage 3: 200 wood, 150 stone, 15 iron, day 5 or later, survive the first Blood Moon raid, Barracks and Archery Range built, 10 citizens. The Advance button stays disabled until every line is done, and the numbers are in `CFG.STAGE_GATES` and `CFG.AGES`.

**World v2** (nf-v126, plan in `docs/STAGES_AND_TRAINING_PLAN.md`): the map is bigger and has more kinds of ground. The playable radius is now 100 (was 62, more than twice the area) with a flat town area out to about 44. New terrain: a longer main river that curves from the east to the south, a **lake** in the north-west with a **stream** flowing from it to the west, a **marsh** in the south-west (slower to walk, lower ground, dark green), **forests** (west, north-east, south; more trees), a **northern cliff and plateau** (rocky, high) with two passes, and rolling hills everywhere outside the town. The ground is vertex-coloured by region on top of the season colour. Resources are denser in the right place (trees in forests, stone on the plateau) and there are more of them (160 trees, 120 stones). Night raiders appear farther out (about 86 from the town) and arrive in streams, up to 45 live enemies at once (was 30), and there are more daytime roaming packs and night prowlers over the larger area. The ground mesh uses 180 x 180 cells; the bird view can pan and zoom farther.

**Stage 4 Walled City and Stage 5 Seat of Power** (nf-v127): two new stages. **Stage 4** (300 wood, 300 stone, 40 iron, 40 food; day 9 or later; break a realm stronghold, finish the second wall, 14 citizens) opens the **Great Wall** (a third stone ring, 80 x 80, 180 stone), a **Market District** plan step (market, a second barracks and six more homes outside the second wall, after the Great Wall is finished), a bigger Great Hall and a wider camera limit; perk choices Drillmaster (+10% soldier damage), Provisioner (marches cost 25% less food), Bastion (+25% stone wall health). **Stage 5** (500 stone, 100 iron, 100 food; day 14 or later; take a realm castle, a Siege Workshop built) gives the gold-roofed **Throne Hall** and unlocks banners and the host later; perk choices Warhost (+1 warband), Crown (+10 prosperity, +1 population), Banneret (courage starts higher and recovers faster). The camera can zoom out to 28 at Stage 3 and 34 at Stage 4 (was 22).

**Training Field, step 1** (nf-v128, plan in `docs/STAGES_AND_TRAINING_PLAN.md`): from Stage 4, the Journal's warband box has a **Training Field** row with an **Enter** button (daylight only, before 16:00, and the clock stops while you are there). Every healthy soldier stands in a row per warband on a wide field, with a banner-coloured flag and the warband name at the left of each row, and the camera starts high. A bar at the top offers **Raiders** (a practice battle of 10 raiders), **Clear** and **Leave**. Practice is free of losses: the leader and soldiers cannot be hurt, enemies give no experience, loot or kills in the story, nothing is spent, and when the battle ends a short report shows foes defeated, the time and how many soldiers were badly hurt (who would have been wounded). Leave puts everyone back home. The Training Field code is in `src/game/16e-training.js` and the settings are in `CFG.TRAIN`.

**Training Field, step 2** (nf-v129): the top bar now offers three practice battles, **Raiders**, **Archers+Brutes** and **Shield line** (`CFG.TRAIN.SETS`), and the Journal Training Field row has two buttons, **Parade** and **Siege**. **Siege practice** builds a small practice castle (18-pace stone wall, 150 HP gate, two oil pots, a Practice Lord) and gives you a ram, three ladders and a catapult for free: they are not taken from or returned to your stores, and nothing you do there is saved. Taking the practice keep ends the exercise and shows a report (time, gate, ram, ladders lost, boulders thrown).

**Training Field, step 3: veteran drills** (nf-v130): on the parade field, the top bar has a **Drill** button. Each healthy soldier who has not drilled yet today gains 2 drills (veteran ranks come at 8, 20 and 40 drills) for 1 food per soldier (`CFG.TRAIN.DRILL`); a second press the same day says everyone has drilled. A floating "Veteran N" shows when a rank is reached. Levies do not drill.

**Code names now say stage** (nf-v131): to match the text, the identifiers were renamed: `age` to `stage`, `CFG.AGES` to `CFG.STAGES`, `setAge` to `setStage`, `upgradeAge` to `upgradeStage`, `updateAgeUi` to `updateStageUi`, `ageName` to `stageName`, `UPGRADE_FENCE_AGE` to `UPGRADE_FENCE_STAGE`, `FIRE_HP_BY_AGE` to `FIRE_HP_BY_STAGE`, `TRAIN.AGE` to `TRAIN.STAGE`, the `age:` field on gear, sites and plan steps to `stage:`, the achievement ids `age2` and `age3` to `stage2` and `stage3`, and the HUD element id `ageN` to `stageN`. Old saves are not compatible (the saved key is now `stage`).

## Better house and castle models (nf-v132)
- New `src/game/04b-models.js`: detailed procedural `houseModel` (stone foundation, timber-frame or stone-quoin walls, gabled eave roof, chimney, framed door with awning, shuttered windows with flower boxes, dormer from Stage 3) and `keepModel` (plinth, crenellated curtain, four corner towers with banners, arched gate with portcullis, central donjon; larger at Stage 4, gold roofs at Stage 5).
- Stage 1 huts unchanged. Real OBJ models can still be dropped in via `tools/build_structures.py`.

- nf-v133: Stage 2 gate now needs 3 homes (the Tent Village plan only has 3 lots; 4 was unreachable).
- nf-v134: Stage gates count people the population cap allows: Stage 2 needs 3 citizens; Stage 3 needs 8 villagers in total, Stage 4 needs 12 (soldiers and citizens both count).
- nf-v135: Detailed Stage 2 Town Hall (timber frame, porch, gable roof, bell turret, banner) and Barracks (stone base, timber longhouse, gable roof, shields, torches, spear rack) in 04b-models.js.
- nf-v136: Detailed Lumber Camp (log cabin, saw frame, stump, log pile), Quarry (stepped rock, crane, cart, blocks) and Defense Tower (battered base, arrow slits, overhanging battlements, wooden roof, flag). No campfire flame on stone halls after a respawn. Archery range and farm are unchanged.
- nf-v137: Houses vary per lot (wall/roof/door colours, size, roof direction, door offset, side shed, woodpile or barrel, second storey). Houses, barracks, smith, range and market now face the nearest main road (the x=0 / z=0 cross roads) with a short path from the door to it. The market is placed closer to the centre and away from the corner tower lots.
- nf-v138: The start screen always shows (Continue when a save exists, New game, New Game+). A Debug start drop-down starts a new game at stage 1-5 with every structure built, the population filled, the stage requirements met, perks chosen and the clock set to the stage day.
- nf-v141: New title screen: a slow orbit around a fully built Stage 5 castle town (display only, your save is untouched), big logo, Continue / New game / New Game+ buttons and a small Debug corner (start at stage 1-5). Choices apply after a quick reload so the game starts in a clean world.
- nf-v142: Settings has a Main menu button that returns to the title screen (saves first).
- nf-v143: Removed the "Upgrade Stage: Click / T" label floating above the campfire and halls.


## Banners (Stage 5, nf-v144)
At Stage 5 the warband window can put a warband under a Dragon, Griffin or Hart banner (up to 3 warbands each). Orders go to the whole banner, **Bring whole banner** adds its warbands to the next journey, the party cap is one larger, and soldiers of one banner fight +6% harder and take 6% less damage while another of its warbands is within 18 paces. Plan: `docs/BANNERS_PLAN.md`.

**nf-v145:** the warband window has a Whole host order row, Rally Cry reaches banner soldiers anywhere, and the Training Field parade groups by banner (banner soldiers get +1 drill XP).

**nf-v146:** rain and snow follow the camera zoom: the weather box grows (up to 3.2x) and gets more drops when you zoom out, so the whole town is covered. `__nf.setWeather("rain")` forces weather for tests.

**nf-v147 (Stage 5 town):** new Village Plan step "Plan Seat of Power" (150 wood, 120 stone): Fountain Plaza (`plazaModel`), Muster Yard (`musterModel`, banner colour flags), two Animal Pens (`penModel`), all visual only; the Stage 5 keep gets a stair and gold flags. Debug start at Stage 5 builds them too.

**nf-v148:** buildings no longer overlap the keep. The Siege Workshop is now a fixed lot in the left outer area, `findTownSpot` keeps clear of the Stage 5 keep footprint (`KEEP_HALF`) and searches a grid, and `fixKeepOverlaps` moves any building (also from old saves) that the growing keep covers. Known: random lumber camp and quarry spots can still touch towers or market-district lots.

**nf-v149:** Stage 5 "Plan Great Works" (120 wood, 150 stone): Windmill (`windmillModel`, sails turn), Infirmary, Victory Monument, all visual only, placed by `findSpotNear` (grid search near a target). The Muster Yard is smaller and sits in the outer (third) layer. Sheep in the pens walk around (`lifeTick` in `04b-models.js`). Every wall ring gets four corner torch posts that light at night (`cornerLampsSync`, glow sprite and ground pool, no real lights so phones stay fast).

**nf-v150:** Stage 5 finishing touches: gatehouses (`gatehouseModel`) on the gates of the second and third wall (visual only, made in `cornerLampsSync`), a "Plan Stables" step (`stableModel`, two horses wander in the paddock, 100 wood 40 stone), and the Victory Monument shows one pennant per realm you hold a site in (full size when the realm is broken).

**nf-v151:** Stage 5 plan step "Plan Outer Homes (3rd ring)" (160 wood): 8 more houses inside the third wall (`findSpotNear`, ring 27 to 36), so the population cap rises by 8 (house = +1 max population). Debug start at Stage 5 now has 23 houses.

**nf-v152:** Cavalry (Stage 5, needs Stables): Mount/Dismount button per soldier in the warband window; mounted men run 1.45x faster and charge for +45%. New Marshal column in the hero skill tree (Banner Lord, War Command, Horse Master, Drill Master). A soldier of each banner carries that banner's flag.

**nf-v153 (walkable gaps):** Stage 5 buildings no longer block paths. Stable, windmill and infirmary moved to the wide third layer; `findSpotNear` now keeps 1.5 collision radius for walls and a 1.6 gap between buildings; the new buildings have smaller collision radii (stable 2.8, infirmary 2.8, windmill 1.9, monument 1.8, muster 3.0, pen 2.4); pens at x=+-20. Games that already built them keep the old spots (start a new debug game).

**nf-v154:** the leader can ride (Stage 5 and at least one Stables built): Mount button above Jump, key M. Mounted: move x1.45 (Horse Master adds more), +5% damage, first strike after running about 1 second +45% "Charge!". Gathering or dying dismounts. Code: `toggleLeaderMount`, `leaderRideTick` in `10b-warbands.js`.

**nf-v155:** riders sit on their horse (`rig.seated`, `_seat` in `js/rig.js` overrides the legs); horses have varied coats, a saddle blanket in the warband colour, and lancers and the leader wear horse armour. Stage 5 town life (`townLifeTick` in `04b-models.js`): two handcarts with a horse go back and forth on the east and west roads, five villagers stand around the fountain; all visual, day only.

**nf-v156:** path safety net (`fixTightBuildings` in `04-town-planning.js`, runs with the plan tick, moves movable buildings with no walkable gap), Settings **Unstick** button (moves the leader to the town square), sheep/horses/sails/carts/villagers only animate within 60 paces of the leader, and effects for Stage 5 buildings: Windmill +4 food each morning (`CFG.WINDMILL_FOOD`), Infirmary heals wounds one extra day, Victory Monument +3 courage each morning (`CFG.MONUMENT_COURAGE`). Villagers already fill the population cap every morning, so no change was needed there.

**nf-v157:** Stage 5 "Plan Training Yard" (140 wood, 80 stone): sand yard with three swaying dummies, a target and a weapon rack; +6 soldier cap per yard and up to 6 home soldiers gain +1 veteran XP every morning (`CFG.YARD_XP`, `CFG.YARD_SEATS`). Endgame (`src/game/16f-endgame.js`): when the Iron Throne falls (`story.campaignWon`) and you are home, a victory screen shows days, level, kills, population, soldiers, sites held, realms broken, buildings and stage with Keep ruling, New Game+ and Main menu; the Journal shows a final goal line for the Iron Throne.

**nf-v158 (band config and control):** the warband window's **Move to…** shows all six bands with counts and moves a soldier in one tap (a full band swaps with its last member); **All at home / All journey** buttons set every soldier's class in a band at once; the warband bar tap now **selects** a band (white outline) and a second tap opens its window; a new **order strip** (All, Go, Hold, Back, Charge) sits next to Mark and gives orders to the selected band, or to the whole host when All is on or nothing is selected (banner members move together). Code: `issueOrder`, `wbOrderTargets`, `wbMoveFor` in `10b-warbands.js`.

**nf-v159 (archer as a class):** every soldier can now switch between Swordsman, Spearman, Great Swordsman, Medic and **Archer** in the warband window (At home / Journey / All buttons) and on the soldier card. Switching changes the role (`syncClassRole` in `10b-warbands.js`, called from `applyGear`): health keeps its ratio, veteran XP and band stay, the bow or the melee weapon is equipped. Home and journey classes can differ, so a soldier can be a spearman at home and an archer on journeys. Mounts are dropped when a rider becomes an archer. Saved with `clsSet`.

**nf-v160:** archers can ride too (Horse Archer): the Mount button now shows for swordsmen, spearmen and archers (`canMount`). Switching a rider to a class that cannot ride (great sword, medic) dismounts them at once (`dropMountIfNeeded`). Mounted archers get the speed and damage bonus; the charge bonus only applies to melee strikes.

**nf-v161 (leader test model):** `?leader=1` swaps the leader for the owner's 45-part Tripo model, each part bound rigidly to one bone (`js/leader_parts.js`, built by `tools/dump_fbx_parts.js` + `tools/build_leader_parts.py`; see `docs/LEADER_MODEL.md` for the sizes and ideas). Default game and its size are unchanged.

**nf-v162:** Settings has **Leader model (test)** (Classic / New parts model; saves, stores `nf_leader` in localStorage and reloads), so the Android app can test the parts model without an address flag (`?leader=0` forces classic). The warband bar (chips plus order strip) is now limited in width so it can never cover the sound and settings buttons (it did on wide screens after nf-v158), and the portrait rule keeps its own width.

**nf-v163:** three leader options in Settings: Classic, **New model (own joints)** (the stick-man's shoulders, elbows, hips, knees and neck are moved to the model's joints, which stops the parts flying apart) and **New model on classic body** (parts stretched to the classic joints, same movement as the classic leader). See `docs/LEADER_MODEL.md`.

**nf-v164:** the leader model now comes from `Leader2.glb` (coloured texture; `python3 tools/build_leader_parts.py Leader2.glb`; the FBX route and `tools/dump_fbx_parts.js` are gone), and the shoulders and arms are lifted next to the neck (`ARM_UP`). `js/leader_parts.js` is about 825 KB.

**nf-v165:** the third leader option (New model on classic body) is removed; Settings now offers Classic or New model (old saved choices map to New model). `js/leader_parts.js` is about 738 KB.

**nf-v166:** the new leader model has longer legs (about 8 cm, the leader is 1.88 m tall) and its chain skirt stays on the pelvis so it no longer opens at the back while running (`LEG_WARP`, see `docs/LEADER_MODEL.md`).

**nf-v167:** the new leader's legs are longer again (hip 0.92 m, the leader is 1.92 m tall) and the chain skirt is soft skinned: the back stays connected to the pelvis while the front follows the thighs and stretches (see `docs/LEADER_MODEL.md`).

**nf-v168:** Settings > Leader model now has five choices: Classic, New model, New model + soft joints, New model + under layer, New model + both. The soft joints and the under layer close the gaps that open at the joints when the rigid parts bend (the parts are not changed). `?leader=0..4`. See `docs/LEADER_MODEL.md`.

**nf-v169:** the soft joint options now also close the dark band at the waist (vest and skirt) and soften the neck; the under layer is leather brown instead of near black. The plain New model and the under-layer-only option have no waist blending.

**nf-v170:** stronger soft joints for the new leader (options 2 and 4): the shoulder pads, pauldron and belt hang on the vest, the top of the skirt follows the vest and the hem the thighs, and joint blends are wider. See `docs/LEADER_MODEL.md`.

**nf-v171:** the under layer of the new leader (options 3 and 4) now covers every joint and gap with pills and balls (shoulders and armpits, elbows, hands, hips, knees, feet, neck, head). See `docs/LEADER_MODEL.md`.
- nf-v172: under layer fitted inside the armour (no bulging); soft joints extended to shoulders and neck by weight diffusion.
- nf-v173: stronger shoulder-to-body soft joints; thicker under layer.
- nf-v174: under layer reduced to joint pieces; collar pads follow the vest fully.
- nf-v175: shoulder armour stays attached to the back when the arm is raised.
- nf-v176: shoulder filler of the under layer enlarged and recoloured to match the vest.
- nf-v177: soft connection applied to all joints of the leader (option 2/4).
- nf-v178: leader model replaced by leader3.glb (16 parts), same rig and animation.
- nf-v179: leader options reduced to Classic/New model; arms 5 cm higher; silver shoulder pad fixed to the body.
- nf-v180: new leader model legs longer, hips higher in the skirt, arms higher.
- nf-v181: skirt hem higher (more thigh visible), arms 3 cm higher.
- nf-v182: skirt side panels follow the thigh; sleeve top stays attached to the collar.
- nf-v183: new leader model with simple clothes, automatic smooth skinning (no parts, no soft-joint hacks); leader_parts.js 316 KB.
- nf-v184: leader shoulder bone raised to neck level (arms swing from the shoulder top).
- nf-v185: reverted to leader3 (16 parts); arm bones raised to shoulder level instead of lifting the arm meshes.
- nf-v186: leader3 back to its original size; joints placed on the model's own joints.
- nf-v187: shoulder and hip bones raised (meshes unchanged); skirt follows the legs more.
- nf-v188: shoulders (collar pad, top of the vest) now follow the raised arm.
- nf-v189: clavicle bones for the new leader; shoulders lift with the raised arm.
- nf-v190: stronger clavicle lift; armpit/chest no longer stretched.
- nf-v191: new T-pose leader model on the classic bones (no clavicle).
- nf-v192: tighter knee/hip blending (thighs not stretched); clavicle bones for the T-pose leader.
- nf-v193: knee pivot moved into the thigh/shin overlap; leader model 8 % bigger.
- nf-v194: new leader uses the skeleton weights from the model file.
- nf-v195: Settings > Model field: a separate flat field with a free camera for characters, mounts and your own .glb (docs/MODEL_FIELD.md).
- nf-v196: the classic leader is built with twice the segments (own geometry set RG_PL in rig.js, quality Q=2) and smooth-shaded skin; other characters unchanged.
- nf-v197: classic leader body balance (LEADER_BALANCE in rig.js): head 14 % smaller, arms and legs ~20-28 % thicker, torso a little deeper/wider.
- nf-v198: the new body balance (LEADER_BALANCE) now applies to every human: soldiers, archers, citizens, raiders.
- nf-v199: followers, citizens and raiders use FOLLOWER_BALANCE (smaller head, only about half the extra thickness); the leader keeps LEADER_BALANCE.
- nf-v200: riders sit: the seated pose now really runs (the rig exposes hips and knee bones; before, it exited early and the legs ran inside the horse), legs wrap the flanks, pelvis fixed on the saddle, no jump/bob clip while mounted; Model field horse hops on jump.
- nf-v201: horses are about 25 % narrower (body 0.55 to 0.42, saddle, neck, legs) and the rider's thighs open less, so the legs wrap the horse.
- nf-v202: unarmed riders keep both hands forward (no arm swing on walk/run); a dead rider slides off sideways and lies beside the horse; the flat apron board in front of female citizens' legs is gone.
- nf-v203: Model field keeps the shield with the spear (as in the game).
- nf-v204: a rider's upper body plays its idle motion while the horse walks/runs (every weapon and unarmed); the pelvis turn of the attack clips is kept (position still locked on the saddle), so sword/spear/bow attacks aim forward like on foot.
- nf-v205: the great sword uses the owner-made model (js/greatsword.js from Greatsword.glb via tools/build_greatsword.py; the scabbard in the file is left out).
- nf-v206: great sword from the new greatsword.glb (sword part picked from the scabbard by connectivity), 22 % narrower, 15 % thinner, handle 1.3x (HANDLE, THIN_W, THIN_T in tools/build_greatsword.py).
- nf-v207: great sword 1.5x bigger overall (2.25 m long, width and thickness scale with it; default length in tools/build_greatsword.py).
- nf-v208: a dead rider now lies on the ground beside the horse (the die clip lays him down; the rider group only slides off sideways to ground level; no extra tilt).
- nf-v209: the classic horse is rigged (23 joints) and walks/gallops with the animation from the horse pack; the rider follows the bob.
- nf-v210: the horse is simplified: 12 joints, one block each for body, neck and head, two thick parts per leg; the animation is retargeted by direction (swing) to fit.
- nf-v211: the horse's head is larger (0.74 m) with eyes, ears and a forelock, and the neck has a mane.
- nf-v212: the horse's mane is a thick row of six dark tufts along the neck.
- nf-v213: the horse's head tapers: a skull block, a slim muzzle and a dark nose; the neck is slimmer.
- nf-v214: the horse's muzzle is a middle size (0.4 x 0.24 x 0.2 m with a 0.12 m dark nose).
- nf-v215: the horse's head is a little shorter (skull 0.36 m, muzzle 0.34 m, nose forward 0.56 m).
- nf-v216: horse legs (all eight parts) and the body swing forward and back only; the sideways sway of the back is removed (tools/build_horse_anim.py).
- nf-v217: horse knees/hocks bend one way only: front lower legs fold backward, hind lower legs fold forward (tools/build_horse_anim.py); before, the gallop folded the hind lower legs 40-80 degrees backward.
- nf-v218: horse knee/hock fold (front backward, hind forward) now starts from a straight leg (the fold the pack keeps all the time is taken off); thighs/upper legs swing freely both ways.
- nf-v219: the hind legs swing further back and less forward (gallop thigh swing -29..+28 degrees instead of -5..+52; walk -25..+14; HIND_BACK in tools/build_horse_anim.py).
- nf-v220: mounted jump works in the game: the Jump button makes the horse (and rider) leap about 0.7 m for 0.8 s with the legs tucked; soldiers on horses use the same hop (rig.hopT/hopK, horseStep air argument).
- nf-v221: the mounted leap is 1.7 m high / 0.9 s and carries the horse over wooden fences and stone walls (not over fort walls); the outermost ring (Great Wall, > 32 m from the centre) is now a 4.4 m fort wall with walkway ledge and merlons, matching the gate towers, and cannot be jumped.
- nf-v222: a loading cover (title, LOADING and a bar, in index.html) hides the half-built start scene while the title town is built, then fades out; no glimpse of the starting village.
- nf-v223: the in-game 'Nightfall Settlement' title is removed (clock and notices move up); a 50 px ad banner slot sits on top of the game screen (CFG.ADS in js/config.js; a placeholder until an ad SDK is wired in); the game area, tap picking and crosshair use the area below the banner.
- nf-v224: the 2nd wall (stone ring, half-width 25) no longer gets gatehouse towers; only the outermost wall's gates do.
- nf-v225: documents updated to match the code (LEADER_MODEL.md rewritten as a current-state page, MODEL_FIELD.md, HANDOFF.md, ROADMAP.md).
- nf-v226: the context buttons (Orders, Smithy, Rest, Standard...) sit left of the action buttons' wrapped columns, so they no longer overlap Block/Attack now that the ad strip makes the screen shorter (css ctxActions right offsets).
- nf-v227: bigger battlefields (46 m radius for small camps, 62 m for big raids and the Training Field, 80 m for sieges and siege practice; rim rocks, trees, clamps, entry and the map view scale with it), a preparation phase before big raids and sieges (camp foes and tower archers stay quiet until you press Begin, walk near the camp or strike first), and band positions: select a band (or All), tap Place, tap the ground and the band forms up there and holds; Follow brings it back.
- nf-v228: tower archers in expedition camps stand on the platform deck (their feet no longer sink 0.8 m below it).
- nf-v229: generated textures (no files, drawn on a canvas, triplanar in object space): stone blocks on the walls, fort walls, towers, keeps and barracks, planks on fences and camp wood, plaster on houses, shingles on roofs. See `texMat`/`procTex` in 02-world-player-camera-input.js.
- nf-v230: houses now really use the textures (plaster or stone walls, shingle roofs, wood beams) and every grey stone part of the classic buildings (keep, towers, gatehouse, castle) gets the stone-block texture automatically (`M()` in 04b-models.js).
- nf-v231: the stone-block texture is only on the fortress walls, the keep, towers and gatehouses. Houses vary (plaster or rough fieldstone walls; thatch, shingle or plank roofs), barracks and cottages use rough fieldstone. New textures `rough` and `thatch`.
- nf-v232: wooden structures (doors, beams, stables, lumber camp, town hall frame, tower decks) use the plank texture (`WOODS` colour list in 04b-models.js).
- nf-v233: house stone walls use a finer rubble-masonry texture (the large blobs looked like leopard spots); plaster no longer has a repeating crack.
