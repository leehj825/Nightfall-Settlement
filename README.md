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

WASD move · F attack · Q swap weapon · Space dash · E ultimate (Commander: Rally Cry) · G gather · V eat · T town hall · C blacksmith · R orders (Commander) · B bird's-eye view · M mute. On touch screens use the on-screen joystick and buttons; pinch to zoom.
