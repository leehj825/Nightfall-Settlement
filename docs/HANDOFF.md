# Handoff notes (for starting a new chat)

Read this first, then `docs/ROADMAP.md` (the plan) and `README.md` (feature list by round). Last updated at version `nf-v148`.

## The project
**Nightfall Settlement**: a quarter-view low-poly 3D survival / village game in the browser (Three.js r128, no build step for players). Repo `leehj825/Nightfall-Settlement` (use the dev branch the session gives you; push there; no pull requests unless the owner asks; `main` is still the initial commit). The owner writes Korean or English; the game UI is English only. Play Store release is documented in `RELEASE.md` but is the owner's task. A medieval setting: avoid modern words (see the terms table in the roadmap).

## Working rules that have been followed each round
1. Make the change in `src/game/*.js` (or `js/rig.js`, `js/config.js`, `js/audio.js`, `index.html`, `css/style.css`).
2. Bump `VERSION` in `sw.js` (`nf-vNN`) so players pick up the new build.
3. Add a short note to `README.md` (and update `docs/ROADMAP.md` if plans changed).
4. `python3 tools/build_game.py` then `python3 tools/build_game.py --check` (builds `js/game.js` from `src/game/*.js`; CI checks it), `node --check js/game.js`, then `python3 tools/build_single.py` (rebuilds `dist/nightfall-single.html`).
5. Commit and push. Report honestly what was verified (headless only unless the owner tested on a phone).
6. Do not add model names to commits or files.

## Where things are
| Area | Files |
|---|---|
| Game logic (one IIFE split into parts) | `src/game/01..18-*.js`, `10b-warbands.js`; built to `js/game.js` (do not edit it by hand) |
| Characters, animation state machine, weapons | `js/rig.js` (polygon characters, `Anim` class, `_res` picks clips by weapon set, guard/jump/dodge/flinch, tool and great-sword arm IK) |
| Captured animations | `js/anims.js` (clips used by the game, ~86), `js/anims_lib.js` (all ~180 retargeted clips, not loaded by the game or the Android build) |
| Animation tool | `tools/retarget_mixamo.js` (`LIB=1` writes the library; `win` option trims and loops a clip; reads `.fbx` and `.glb#N`) |
| Animation sources kept in the repo | `tools/anim_src/` (knight GLBs for mining and chopping, the horizontal melee FBX). The big Mixamo packs are not in the repo: if a new move is needed and it is not in `anims_lib.js`, ask the owner to resend it |
| Models and structures | `js/models.js` (skinned characters, off by default, `?models=1` turns them on; weapon and tool models are always used), `js/structures.js` (well, smithy, range, tent, tree, campfire, fence, wall) built by `tools/build_structures.py` |
| Config and balance numbers | `js/config.js` (`CFG`: stages and stage gates, town groups, siege/wound/levy/training numbers, expeditions, warbands `CFG.WARBAND`, towers, gear) |
| Audio | `js/audio.js` (synth sounds and music) |
| Build/package | `tools/build_single.py`, `tools/make_www.js` (Android `www/`, leaves out `anims_lib.js`), `ANDROID.md`, `RELEASE.md` |

## How to test (nothing is saved in the repo)
Headless Chromium with Playwright is available (`/opt/pw-browsers`, do not run `playwright install`). Load `index.html?debug=1`; route `three.min.js` from a local three@0.128 copy if the page cannot reach the network. In debug mode `window.__nf` exposes helpers (`playerAnim`, `npcs`, `enemies`, `obstacles`, `spawnEnemy`, `setMin`, `openNpcCard`, `res`, `CFG`...). **Shift+B** runs `debugSetup`: Stage 3, all town plans built, soldiers promoted. Headless frame rate is low and the game clamps `dt` to 0.05, so wait on game state, not wall-clock time. A page error list should stay empty.

## What exists now (summary)
- **Village**: five Stages (Camp, Wooden Town, Stone Fortress, Walled City, Seat of Power; the word "age" is gone from text and code). Tents become wooden houses at Stage 2. Each stage needs resources, a minimum day and a goal checklist (`CFG.STAGE_GATES`, `STAGE_TESTS` in `06-time-seasons-fire-ages.js`), village plan with priorities, two defense lines, outer fields and homes between the first fence and the second wall (farms and archery range move outside once the second wall is built; six outer houses in two batches; four outer corner towers). Towers shoot in all directions including at siege units.
- **People**: citizens (jobs, moods, farming animations), soldiers with classes (swordsman, great swordsman, spearman, medic) and archers, veteran levels, soldier cap from barracks and archery ranges. NPCs show only a health bar above the head (frame colour = warband).
- **Warbands (done)**: up to 6 soldiers each, six heraldic names, banner colours, rename and recolour in the warband window, bar chips at the bottom centre, one warband can go on a journey, journey power = warband brought (full) + soldiers left home (one third) + hero.
- **Hero**: weapons cycle with Q (sword, great sword, bow, spear, unarmed), great sword skills in the Vanguard tree, block (hold Shift), jump (X), dodge on dash, hit reactions, combo that restarts after 1 s without attacking, punches and kicks when unarmed (also used by citizens who fight back).
- **Animation**: combat locomotion sets per weapon (sword and shield, bow, great sword) used when an enemy is near or on a journey; calm sets otherwise; raiders use the same packs; mining and chopping use captured clips; farmers cycle the farming clips.
- **Journeys, raids, bosses, chapters 1 to 6, endless mode, caravans, weather, seasons**: as described in `README.md`.

## Known gaps and things not verified
- The owner has now played the debug build on a phone, so the old "headless only" caveat no longer applies in general. Specific findings were not written down yet: when the owner reports problems (layout, performance, animation feel, balance), record them here. Still unconfirmed in detail: the warband bar and window layout, the extra Jump and Block buttons, mining, chopping, farming and combo animations, block feel.
- Guessed numbers worth tuning: great sword skill bonuses, unarmed and citizen punch damage, block strength (75% less), soldier-left-home power factor (one third), soldier cap values.
- Chopping axe blade direction and the left-hand grip on tools are checked only in still frames.
- Citizens fighting back and the roaming day enemies are lightly tested.
- Journey power requirements are scaled by `CFG.EXP_NEED_SCALE` (0.8, a guess) since power became warband-based; check on a real run.
- Custom skinned character models are disabled. Houses, the Stage 2 hall, the Stage 3 to 5 keep, barracks, lumber camp, quarry and tower are detailed procedural models in `src/game/04b-models.js` (`houseModel` varies per lot from `userData.seed`). The archery range, farm, gates, wolves, great sword, staff and armour still have no custom model.
- Needs tuning from phone play (numbers are still guesses): World v2 performance, the stage gates (3 homes / 3 citizens for Stage 2, 8 and 12 villagers for Stages 3 and 4), raid and siege strength, wounds and courage, the title screen.

- **Gear slots**: `sword`, `great`, `spear`, `bow`, `armor` (`CFG.GEAR`); hero helpers `weaponDef(mode)`, `gearAtTier`; soldiers use `soldierWeaponDef(n)` (best of class slot and sword).
- **Two classes per soldier**: `n.clsHome` (town) and `n.clsTrip` (journey, optional); `n.cls` is the active one, swapped on departure/return in `16-expeditions-story-journal.js`. Helpers `homeCls`, `tripCls`, `setClassFor` in `10b-warbands.js`.

## Added since nf-v96 (read the README sections for detail)
- **War layer:** campaign map with Near/Far tabs, holds and garrisons (`16c-holds.js`), realms (`16d-realms.js`), march and provisions (`16b-march.js`), wounds, courage and levies, castles and the siege layer (see below), Iron Throne final siege.
- **World v2 and stages:** map radius 100 with river, stream, lakes, marsh, forests and a northern cliff (`01-scene-terrain.js`), Stage 4 Walled City and Stage 5 Seat of Power, Training Field (`16e-training.js`: parade, practice battles, siege practice, drills).
- **Models:** `04b-models.js` (see above). Buildings (houses, barracks, smith, range, market) face the nearest main road (the x=0 / z=0 cross roads, `faceOf` and `doorOf` in `04-town-planning.js`) and get a short path to it.
- **Title screen and debug start (nf-v138 to nf-v143):** `showTitle` in `18-save-settings-achievements.js` builds a Stage 5 showcase town with `debugJump(5)` and orbits the camera around it (`titleMode`). Every button stores an intent in `sessionStorage` (`nf_intent`) and reloads so the game starts in a clean world; `bootGame` reads it. The Debug corner starts a new game at stage 1 to 5 with everything built (`debugJump` in `14-chapter-clear-checkpoint-debug.js`). Settings has a Main menu button. `?debug=1` skips the title (add `&load=1` to see it); `__nf` also exposes `setStage`, `builtBuildings`.
- **Headless test tips:** call `__nf.pause(false)`, dismiss the tutorial coach and "Morning event" dialogs, set the clock with `setMin` and wait about 500 ms (`nowHour` only updates in the main loop), and run long scripts in the background. Camera views for screenshots: `__nf.camTest(dist, pitch, front)` with the player moved next to the building.

## Next steps (also in the roadmap)
1. **Phone tuning pass:** collect the owner's findings from phone play, then tune the guessed numbers listed under "Known gaps" (all live in `js/config.js`).
2. **Banners and the host:** phases 1 and 2 done in nf-v144 and nf-v145 (`docs/BANNERS_PLAN.md`, `CFG.BANNER`, banner block in `10b-warbands.js`); next Marshal extras, banner flags in the field, phone tuning. Orders, raids, the campaign map (phases 1 to 4), realms, sieges and wounds/courage/levies are all done; see `docs/ROADMAP.md`.
3. **Models and polish:** archery range, farm, gates, market and siege workshop models; audio; formations; extra unit types.
4. Later: custom skinned character models; Play Store release (`RELEASE.md`, owner tasks: signing key, secrets, store listing).

## Conventions worth remembering
- `js/game.js` is generated; edit parts in `src/game/`. Parts run in file-name order; the first opens the IIFE, the last closes it. A part loaded early must not call `const` helpers from a later part at load time (use `function` declarations; see `10b-warbands.js`).
- In `Anim.base()` the clip speed is set every frame, so a custom speed must be applied after the generic line.
- Non-looping clips must not end on their first pose: the retarget tool samples just before the clip end.
- Save data is additive. New fields should be read with a fallback so old saves still load.

## Siege layer (nf-v110 to nf-v115)
Plan and status: `docs/SIEGE_PLAN.md`. Code is in `src/game/16-expeditions-story-journal.js` (`buildBanditCamp` with `stone`/`gate`/`ladders`/`oil` camp options, `gateHit`, `castleTick` = `ramTick` + `oilTick` + `ladderTick` + `catapultTick`, `breachWall`, `raiseLadder`, battle report in `endExpedition`), `src/game/05-smithy-roles.js` (`renderSiegeRows`, `siegeGear` = `story.siege`), `src/game/16b-march.js` (gear food), config in `js/config.js` (`legioncastle`, `legionfortress`, `CFG.SIEGE`, `siegeshop` and the last `TOWN_GROUPS` step). Test notes: in headless tests call `__nf.pause(false)` and dismiss morning-event dialogs and the tutorial coach (they freeze time); use `__nf.yaw = Math.PI` to face +z; debug-only hooks (`makeNpc`, `siegeGear`, `createBuilding`, `ramTick`, `breachWall`, `invincible`) exist in `?debug` mode. Balance numbers are guesses: tune on phones.
