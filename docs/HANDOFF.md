# Handoff notes (for starting a new chat)

Read this first, then `docs/ROADMAP.md` (the plan) and `README.md` (feature list by round). Last updated at version `nf-v93`.

## The project
**Nightfall Settlement**: a quarter-view low-poly 3D survival / village game in the browser (Three.js r128, no build step for players). Repo `leehj825/Nightfall-Settlement`, dev branch `ccr-9e4a8ed7-fh7jhu` (push there; no pull requests unless the owner asks). The owner writes Korean or English; the game UI is English only. No Play Store work. A medieval setting: avoid modern words (see the terms table in the roadmap).

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
| Config and balance numbers | `js/config.js` (`CFG`: ages, town groups, expeditions, warbands `CFG.WARBAND`, towers, gear) |
| Audio | `js/audio.js` (synth sounds and music) |
| Build/package | `tools/build_single.py`, `tools/make_www.js` (Android `www/`, leaves out `anims_lib.js`), `ANDROID.md`, `RELEASE.md` |

## How to test (nothing is saved in the repo)
Headless Chromium with Playwright is available (`/opt/pw-browsers`, do not run `playwright install`). Load `index.html?debug=1`; route `three.min.js` from a local three@0.128 copy if the page cannot reach the network. In debug mode `window.__nf` exposes helpers (`playerAnim`, `npcs`, `enemies`, `obstacles`, `spawnEnemy`, `setMin`, `openNpcCard`, `res`, `CFG`...). **Shift+B** runs `debugSetup`: Age 3, all town plans built, soldiers promoted. Headless frame rate is low and the game clamps `dt` to 0.05, so wait on game state, not wall-clock time. A page error list should stay empty.

## What exists now (summary)
- **Village**: ages 1 to 3 (tents become wooden houses at Age 3), village plan with priorities, two defense lines, outer fields and homes between the first fence and the second wall (farms and archery range move outside once the second wall is built; six outer houses in two batches; four outer corner towers). Towers shoot in all directions including at siege units.
- **People**: citizens (jobs, moods, farming animations), soldiers with classes (swordsman, great swordsman, spearman, medic) and archers, veteran levels, soldier cap from barracks and archery ranges. NPCs show only a health bar above the head (frame colour = warband).
- **Warbands (done)**: up to 6 soldiers each, six heraldic names, banner colours, rename and recolour in the warband window, bar chips at the bottom centre, one warband can go on a journey, journey power = warband brought (full) + soldiers left home (one third) + hero.
- **Hero**: weapons cycle with Q (sword, great sword, bow, spear, unarmed), great sword skills in the Vanguard tree, block (hold Shift), jump (X), dodge on dash, hit reactions, combo that restarts after 1 s without attacking, punches and kicks when unarmed (also used by citizens who fight back).
- **Animation**: combat locomotion sets per weapon (sword and shield, bow, great sword) used when an enemy is near or on a journey; calm sets otherwise; raiders use the same packs; mining and chopping use captured clips; farmers cycle the farming clips.
- **Journeys, raids, bosses, chapters 1 to 6, endless mode, caravans, weather, seasons**: as described in `README.md`.

## Known gaps and things not verified
- Everything was verified headless only. Not yet checked on a real phone: the warband bar and window layout, the extra Jump and Block buttons (the action column wraps into two columns), mining, chopping, farming and combo animations, block feel.
- Guessed numbers worth tuning: great sword skill bonuses, unarmed and citizen punch damage, block strength (75% less), soldier-left-home power factor (one third), soldier cap values.
- Chopping axe blade direction and the left-hand grip on tools are checked only in still frames.
- Citizens fighting back and the roaming day enemies are lightly tested.
- Journey power requirements are scaled by `CFG.EXP_NEED_SCALE` (0.8, a guess) since power became warband-based; check on a real run.
- Custom skinned character models are disabled; houses, gates, towers, wolves, great sword, staff, armor have no custom model.

- **Gear slots**: `sword`, `great`, `spear`, `bow`, `armor` (`CFG.GEAR`); hero helpers `weaponDef(mode)`, `gearAtTier`; soldiers use `soldierWeaponDef(n)` (best of class slot and sword).
- **Two classes per soldier**: `n.clsHome` (town) and `n.clsTrip` (journey, optional); `n.cls` is the active one, swapped on departure/return in `16-expeditions-story-journal.js`. Helpers `homeCls`, `tripCls`, `setClassFor` in `10b-warbands.js`.

## Next steps (also in the roadmap)
1. **Orders (buttons and soldier behaviour done in nf-v66, only UI-tested headless; fights not watched)**, Mark the foe is done (nf-v70, `toggleMark` / `markedFoe` in `10b-warbands.js`); leader's standard done (nf-v71, `standardMods` in `10b-warbands.js`, tuned by `CFG.STANDARD` and the Standard Bearer skill); next the Marshal extras (war layer phase 2; the saved per-warband `order` field exists in `10b-warbands.js` with `warbandOrder` / `setWarbandOrder`, nothing uses it yet; next: buttons, soldier behaviour, Mark the foe, standard): Forward, Stand firm, Withdraw, Mark the foe, Charge; nearby men fight better near the leader. Needs: a small order set on the warband bar, soldier behaviour states for the selected warband, saved settings.
2. Raids: camp layout done (nf-v75: `banditcamp` in `CFG.EXPEDITIONS`, `buildBanditCamp` in `16-expeditions-story-journal.js`; note the old `buildCamp(id)` is the supply camp). Camp behaviour done too (nf-v77: `campRoute`, `exPush`, `campAlarm`, `campBroken`, tower archers `u.tower`). Lasting effect (`story.campFx`, `campRelief`), banner objective (`burnBanner`) and raid power (`powerFor`) done. Age 3 Bandit Stronghold done (nf-v84). Next: the campaign map; the plan is in `docs/CAMPAIGN_MAP_PLAN.md` (phase 1, the map view, is done in nf-v86; phase 2 is done in nf-v87: march days, provisions and auto-resolved home nights in `src/game/16b-march.js`; phase 3 done in nf-v88: garrisons and holds in `src/game/16c-holds.js`; phase 4 done in nf-v91: realms in `src/game/16d-realms.js`; next phase 5: siege nodes, a separate plan). Multi-warband journeys are done (nf-v73: `escortBands`, `bandMax`, `toggleBring`). Next: raids on bandit camps with two or three warbands (Age 2), then the campaign map and sieges (Age 3).
3. Realms, provisions, banners and the host, the final campaign.
4. Later: custom models, tuning pass after phone testing.

## Conventions worth remembering
- `js/game.js` is generated; edit parts in `src/game/`. Parts run in file-name order; the first opens the IIFE, the last closes it. A part loaded early must not call `const` helpers from a later part at load time (use `function` declarations; see `10b-warbands.js`).
- In `Anim.base()` the clip speed is set every frame, so a custom speed must be applied after the generic line.
- Non-looping clips must not end on their first pose: the retarget tool samples just before the clip end.
- Save data is additive. New fields should be read with a fallback so old saves still load.
