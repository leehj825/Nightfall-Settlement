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

WASD move · F attack · Q swap weapon · Space dash · E ultimate (Commander: Rally Cry) · G gather · V eat · T town hall · C blacksmith · R orders (Commander) · B bird's-eye view · J journal / expeditions (also "Return home") · M mute. On touch screens use the on-screen joystick and buttons; pinch to zoom.

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
- Tap an empty spot on the screen to attack (or press `F`). Journal, Map View and Town Hall sit above the move stick; Rest / Orders / Smithy appear in a small column next to the action buttons and keep their slot when hidden.
- Settings: left-handed layout, button size (small / normal / large), text size, vibration, volumes.

- Stone walls are no longer built by hand: from Age 3 your workers and soldiers replace wooden fences with stone on their own (5 stone each, taken from your stock), after repairs and building plans. The Stone Wall button and `U` key are gone.

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
- **Upgrades by workers:** from Age 3 workers replace wooden fences with stone; each morning they also level up one building, tower (more damage, faster) or gate (stone pillars; soldiers near it hit 7% harder per level).
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

The warband window now has four **order buttons**: Forward (as before), Stand firm (at night only fight foes near the post; on a journey hold the spot where the order was given), Withdraw (melee men do not engage; on a journey they stay by your side), Charge (notice foes from further away and chase harder). A small letter on the warband chip shows a non-Forward order. The older R key (Follow / Guard) is separate and unchanged. Orders are saved. Not yet tested by watching real fights.

Interface fixes (nf-v67): the **View** button (camera) moved to the right-hand button column, above **Weapon** (both shortened to one word) so it is no longer pressed by mistake, and the three shortcut buttons above the stick sit higher, leaving free space around the stick. The **warband bar now shows during journeys** (only the warbands that came along) so you can give orders there, and the journey class can be changed there too. Each soldier row in the warband window has **At home**, **Journey** class buttons and **Move band**, so no soldier card is needed; tapping a soldier's name still opens the card, and closing the card returns to the warband window. In portrait the warband bar sits above the sound and settings buttons instead of on top of them.

**Mark the foe** (nf-v70): the **Mark** button at the end of the warband bar (key **Y**) marks the closest enemy, preferring the one in front of you (within 45); a red ring and arrow follow it. Every warband then goes for it first: at night at home (melee and archers; archers skip siege throwers) and on journeys. Withdraw ignores the mark; Stand firm only follows it when the foe is near their post or spot. Press Mark again to clear; the mark also clears when the foe dies. Not saved. Marking a siege thrower lets your melee men rush it. Only tested headless.

**Leader's standard** (nf-v71): you carry a small gold banner on your back. Soldiers within 12 paces of you deal +15% damage and take 15% less (the Commander class gets 1.5x the bonus and a 25% wider reach; this replaces the old Commander-only 15% aura). A faint gold ring shows the reach while a fight is near. The numbers are guesses (`CFG.STANDARD`). The warband window shows the current bonus. **New hero skills**: Ranger (movement) gains Long Stride (faster when no foe is near), Shadow Step (longer dash, a little more untouchable time) and Rushing Strike (+25% damage for 1.2s after a dash); Tactician (spear) gains Lunge (spear thrust +12% damage, +10% reach), Impale (thrust staggers foes 0.25s per rank, slightly wider) and Standard Bearer (standard reaches 20% further per rank and gives +4% damage / +3% less damage taken per rank). The skill tree now has up to 7 nodes per branch (unlock points 0, 2, 4, 6, 6, 8, 10). Only tested headless.

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
