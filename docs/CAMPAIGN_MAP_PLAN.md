# Campaign map - plan

Status: **phases 1 to 4 built (`nf-v86` to `nf-v91`)**; the rest is still plan. The owner approved the defaults in section 9. It turns the roadmap's "campaign map and marching" step into small shippable updates. Terms follow the roadmap table (warband, banner, host, realm, foray, raid, campaign, provisions).

## 1. What exists today that the map builds on
- **Sites**: `CFG.EXPEDITIONS` has 26 entries: forays (quarry, forest, tower, mine, citadel...), chapter sites (ch 2 to 6, unlocked by relics/story), night sites, and three **raids** (Raider Outpost 1 band, Bandit Camp 2, Bandit Stronghold 3). Each is a playable zone built by `buildZone` in `src/game/16-expeditions-story-journal.js`.
- **Clock rule**: a day journey starts after 06:00 (latest 13:00) and you are called home at 17:30; the game clock runs at half speed while away (`EXP_TIME_MULT`), so one journey is about 4 minutes of real time. Night sites run 20:00 to 04:30.
- **Party**: up to 1/2/3 warbands by Age (`bandMax`), journey power from the warbands brought (`powerOf`, `powerFor`), soldiers walk home on return.
- **Effects that already persist**: `story.campFx` (a broken camp makes raids smaller for some days), supply camps (`story.camps`, daily income), `story.cleared`.
- **UI**: Journal with Journeys and Raids tabs, a warband bar and window, journey HUD line, a fade between village and zone.
- **Saves**: `makeSnapshot` / `applySnapshot`; additive fields with fallbacks.

## 2. The big design question: how long is a "campaign"?
| Option | What it is | Cost | Fit |
|---|---|---|---|
| A. Map as a nicer menu | A node map replaces the Journal lists; every trip is still one real-time visit within a day | small | no new gameplay, but a good first step |
| **B. Map with marching days (recommended)** | Targets are nodes with a distance. Near nodes are same-day trips as today; far nodes take 1 to 3 days to reach, so you leave the village for days. Time passes in the background, the village is simulated, night raids at home are resolved automatically with a morning report | medium | matches the roadmap, keeps real-time battles |
| C. Full strategic layer | Armies move on the map in real time, auto-resolved battles | large | too big for phones and a different game |

Recommendation: **A then B**, in the phases below. Option C is not planned.

## 3. The map (data)
A new `CFG.MAP` list of **nodes**; the existing expeditions become nodes (so nothing is lost):
```
{ id, kind: 'foray'|'raid'|'chapter'|'night'|'outpost'|'village'|'castle'|'fortress',
  x, y,            // position on a 0..100 board
  from: [ids],     // roads: nodes it can be reached from (the village is the root)
  zone: 'banditcamp',   // existing expedition id to play (null = auto-resolved)
  garrison, walls, reward, realm }   // the later phases use these
```
- Distance = road length (sum along the roads from the village). Day count = ceil(distance / marchSpeed). Same-day nodes keep today's rules.
- Reveal: nodes appear when linked from a cleared/known node, or by story relics (as chapter sites unlock today).
- State per node in `story.map[id] = { state: 'unknown'|'known'|'cleared'|'held', lastDay, garrisonLeft }` (additive, old saves = defaults).

## 4. Marching, provisions and the home front (the new rules)
- **Provisions**: marching soldiers eat. Cost per soldier per day away from a ration setting; take it from `res.food` at departure (shown in the plan screen). If food runs out the party loses courage (damage penalty) and may turn back.
- **March time**: a trip of N days: you choose warbands, see days, food and risk, press March. A short march screen runs the days with a progress bar and events (ambush, weather, a merchant), then the zone loads for the battle. Retreat is possible at the end with a cost (wounded soldiers, lost provisions).
- **Home front while away (days)**: the clock advances; citizens keep working (existing day code); each night at home is **auto-resolved** from warbands left home, walls, towers and the camp relief effect (strength vs raid size roll, damage to walls, citizen losses), and shown in a **morning report**. Rule of thumb: if you leave nobody at home, expect losses.
- **Day-trip rule stays**: forays and the three raids remain same-day. Only far nodes are multi-day.
- **Wounds**: fallen soldiers recover at home over days; veterans are worth protecting (a later phase).

## 5. UI
- A **Map** tab in the Journal (or the existing Map View button opens it): a simple 2D board, nodes as banner-coloured dots, roads as lines, village at the centre-left. Tap a node: card with name, kind, garrison hint, walls, reward, days away, food cost, power need, and a March button.
- Reuse the warband window to pick warbands; show "marching: Lion, Wolf" on the bar.
- During the march: a small panel with day, food, event text. Morning report reuses the existing report box.
- Phone first: big tap targets, no pan/zoom needed (fixed board, 12 to 20 nodes).

## 6. Phases (each a small, testable update)
1. **Map view (option A) - DONE in nf-v86 (`CFG.MAP`, `mapHtml` in `renderJournal`)**: `CFG.MAP` from existing sites, node-map screen replacing the two Journal lists for choosing a site, same behaviour as now. Save `story.map`. *Risk: low.*
2. **Distances and march time - DONE in nf-v87 (`src/game/16b-march.js`, far raids `hillclan` and `legionfort`, `CFG.MAP_RULES`; far sites are listed under the map as chips rather than drawn on it)**: add far nodes, march screen, days passing, provisions cost, auto-resolved home nights and the morning report. *Risk: medium (time handling and the night loop).*
3. **Garrisons and holds - DONE in nf-v88 (`src/game/16c-holds.js`; garrison size does not change the zone yet)**: outposts and villages as nodes you can capture (no walls): garrison size decides which camp zone is built (reuse the camp builder with other sizes), captured nodes become held (income, a banner on the map, a small garrison needed). *Risk: medium.*
4. **Realms - DONE in nf-v91 (`src/game/16d-realms.js`, `CFG.REALMS`)**: three rival forces tint nodes and flavour garrisons (bandit lords, iron legion, hill clan); breaking a realm's node weakens that realm's raids on you (extend `campRelief` per realm). *Risk: low to medium.*
5. **Siege nodes**: castles and fortresses with walls, gates and siege gear (roadmap phase 4). Separate plan.
6. **Wounds, levies, banners and the host**: later.

## 7. How it fits what exists
- **Ages**: Age 1 shows only near nodes (forays and the outpost), Age 2 adds raids and a second ring, Age 3 the far ring and castles.
- **Chapters and story**: chapter sites stay on the map as story nodes; relics reveal them (`needs`, `ch` rules kept).
- **Raids**: the three camps become raid nodes; `campRelief` stays; later per realm.
- **Night raids at home**: today fought live. Auto-resolution is used only when you are away for the night; being home keeps the live fight.
- **Power**: keep `powerFor`; garrison strength compared the same way (raw need scaled by `EXP_NEED_SCALE`).

## 8. Risks and how to handle them
- **Time bugs**: day skipping touches clock, seasons, wave spawning and the morning events. Mitigation: phase 2 first only skips whole days with the existing morning code (`startWave`, report) called per day; test saves across the skip.
- **Phone performance**: the map is plain DOM/canvas, no 3D.
- **Balance**: all numbers (march speed, food per soldier, resolve odds) are guesses; keep them in `CFG.MAP_RULES` and tune after phone testing.
- **Scope**: sieges and realms are separate plans; do not build them inside the map update.

## 9. Open questions (my default if not answered)
1. Should every site go through the map, or keep the Journal lists beside it? *Default: the map replaces choosing a site; the Journal keeps story and supply camps.*
2. How harsh is leaving the village for days? *Default: auto-resolved nights with a visible odds line; you may keep a warband home.*
3. Can the player skip the march (instant arrival for a food cost)? *Default: yes after the first time.*
4. A setting to turn the war layer off? *Default: not now.*
5. Do captured nodes need a garrison? *Default: a held node needs one soldier from a warband; unheld nodes revert slowly.*

## 10. Next step
Approve (or change) the defaults above, then start **phase 1: the map view** (one update, no new rules), followed by phase 2.
