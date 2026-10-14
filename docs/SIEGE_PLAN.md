# Siege plan

Status: **steps 1 to 4 built** (`nf-v110` Legion Castle, `nf-v111` ram and breakable gate, `nf-v112` ladders and boiling oil, `nf-v113` Siege Workshop and carried gear); steps 5 and 6 still plan. It is campaign map phase 5. It turns the roadmap's "castles and sieges" into small shippable steps. Terms follow the roadmap table (warband, host, realm, hold, provisions, courage). Numbers are guesses; they live in `CFG` so they can be tuned after phone testing.

## 1. Goal
A **castle** is a walled raid that cannot be won by walking in. You march a host to it, break the **gate** (or climb the **walls**), beat the garrison and take the keep. The leader must be present: the rule added in `nf-v109` (soldiers deal only 20% damage to a chief when the leader is more than 16 paces away) stays.

## 2. What already exists and is reused
| Piece | Where | Use |
|---|---|---|
| Walled camp builder, gate routing, `campRoute`, `exPush` | `buildBanditCamp` in `src/game/16-expeditions-story-journal.js` | Castle is the same builder with a bigger layout, stone walls, an inner keep and a gate with HP |
| Alarm, tower archers, burn-the-banner or kill-the-chief | `campAlarm`, `campBroken` | Castle win condition and tower defenders (towers rebuilt in `nf-v109`, arrows now fly down) |
| Map nodes, realms, holds, garrisons | `CFG.MAP`, `16c-holds.js`, `16d-realms.js` | Castle and fortress nodes; capturing makes a hold and weakens that realm |
| March days, provisions, home nights | `16b-march.js` | A siege is a far march with more food and soldiers |
| Warbands, orders, Mark the foe, standard | `10b-warbands.js` | Orders drive the ram escort and the ladder assault |
| Enemy siege units (night raids) | `08-enemies.js` | Pattern for projectile and structure damage |

## 3. Design

### 3.1 Castle layout (zone)
- Larger zone than the Stronghold: a stone outer wall (about 26 paces), four corner towers, **one gate** on the near side, an inner **keep** with the lord and a banner.
- Garrison: wall archers on the towers and wall walks, spearmen behind the gate, a few shield soldiers, a **lord** (chief with more health and an armour phase). Counts scale with `CFG.EXPEDITIONS` entry and difficulty (`dm()`).
- Walls and the gate are **structures with HP** (reuse `damageStructure`). Normal weapons barely scratch them (10% damage); siege gear does full damage.

### 3.2 Siege gear (built at a new Siege Workshop)
| Gear | Role | Rules |
|---|---|---|
| **Ram** | Breaks the gate | Needs 2 to 3 soldiers to push (they follow the ram and stop being soldiers while pushing); slow; weak to oil and fire from the gate towers; damage per hit to the gate |
| **Ladder** | Lets soldiers and you climb a wall section | Placed by a warband; climbing soldiers take arrows; wall defenders can push a ladder over once |
| **Catapult** (later step) | Breaks a wall section from range | Slow, needs crew, hits towers and wall walks |

- The Siege Workshop is a new building in Age 3 (a Village Plan step). It costs wood and iron; gear costs iron and is carried by the host on the march (cost counted in provisions). Gear lost in a failed siege is gone.

### 3.3 The fight (phases, one real-time zone)
1. **Approach:** archers on the walls and towers shoot at anyone within range. Staying in range costs health; use cover and shields. Soldiers hold unless ordered.
2. **Breach:** push the ram to the gate (or raise ladders). The garrison sorties out through the gate or drops oil. Protecting the ram crew is the loop.
3. **Storm:** gate or wall falls, bands rush in. Soldiers fight the guards; you go for the lord. The lord stays in the keep until the gate is broken.
4. **Take the keep:** kill the lord or burn the keep banner. The castle falls, becomes a hold, and the realm is weakened.

### 3.4 Aftermath
- **Captured castle** becomes a hold with income and needs a garrison (existing hold rules); realm relief is larger than for camps.
- **Failed siege:** if the ram crew or most soldiers fall, **Withdraw** works as for camps; gear left on the field is lost; lost soldiers are lost (wounds come in a later phase).

## 4. Data and saves
- `CFG.MAP` nodes with `kind: 'castle'` and `'fortress'` get `garrison`, `walls`, `gate` (HP), `reward`, `realm`, `needs` (gear) fields. Saved state stays additive: `story.map[id]` unchanged, `story.siege = { gear: { ram, ladder } }` for carried gear.
- Zone state (gate HP, wall HP) is not saved mid-siege (like camps today: leaving resets the zone, with the existing "camp still stands" rules).

## 5. Phases (each a small, testable update)
1. **Castle zone, plain assault (no gear) - DONE in nf-v110 (`legioncastle`, gate in `buildBanditCamp`, `gateHit`):** castle node and zone with stone walls, gate (strong, normal weapons do 10%), towers and garrison; broken only by killing the lord. Gate can be opened by killing the gate captain as a temporary rule. Balance on Normal and Hard with the headless bot (`scratchpad/camp.js` style).
2. **Ram and breakable gate - DONE in nf-v111 (`ramTick`, `ramCrewPower`; the ram is placed in front of the gate for now, step 4 makes it carried gear):** ram entity (push crew, HP, damage to the gate), gate with HP and a broken model.
3. **Ladders and wall defenders - DONE in nf-v112 (`raiseLadder`, `dropLadder`, `oilTick`; ladders lie at the wall and are raised with Gather, not carried yet):** ladder entity and climbing, wall archers with oil and rocks.
4. **Siege Workshop and gear cost - DONE in nf-v113 (`siegeshop` building, `CFG.SIEGE`, `story.siege`, `renderSiegeRows`):** building, gear production, carrying it on the march (provisions), loss on failure.
5. **Capture and fortress:** capture as hold, realm relief, a larger fortress tier; battle report screen (win, losses, gear lost).
6. **Catapult and polish (optional):** catapult, balance pass, phone testing.

## 6. Risks and how to handle them
- **Performance on phones:** limit wall defenders (about 20), reuse shared geometry, no per-brick physics (gate and wall sections are single objects with HP).
- **Pathing:** soldiers must route through the gate or climb ladders; reuse `campRoute`; add the gate as a gap that opens when broken.
- **Ladders and siege AI:** keep rules simple (ladder = a ramp that exists once placed) to avoid bugs.
- **Balance:** all numbers in `CFG`; tune with the headless bot, then phones.
- **Scope:** wounds, levies, banners and the host are the next plan, not part of this one.

## 7. Defaults I will use unless you say otherwise
1. One big real-time battle, with the ram and ladders as phases inside it (not separate screens).
2. First version: **ram and ladders only**; catapult later.
3. Losing a siege costs soldiers and gear for good; no wounds yet.
4. The Siege Workshop is Age 3 only.
5. A castle takes 3 warbands to attempt (power need set from the garrison, like camps).
6. Soldiers do 20% damage to the lord without the leader nearby (existing rule), and 10% to walls and gates without siege gear.

## 8. Next step
Approve (or change) the defaults, then start **phase 1: the castle zone**.
