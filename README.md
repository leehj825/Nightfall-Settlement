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

## Android (debug APK)
See [ANDROID.md](ANDROID.md): a Capacitor wrapper plus a GitHub Actions workflow that builds `app-debug.apk` (Actions -> "Android debug APK" -> Run workflow). three.js is now bundled in `vendor/`, so the game (and the app) work fully offline.

