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

