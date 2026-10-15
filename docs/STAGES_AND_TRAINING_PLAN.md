# World, Stages and the Training Field - combined plan

Status: **built through the Training Field (`nf-v124` to `nf-v130`)**; banners and the host remain. (Written at `nf-v123`, revised once.) It answers the owner's observations: (1) the settlement reaches Age 2 and Age 3 almost instantly, (2) after Age 3 the town has nothing left to grow into and the stone fortress is large for the map, (3) there is no place to see the whole army, try orders and rehearse battles, (4) the map is small with little terrain variety (one small river), (5) ground hit effects are hidden on terrain with height. **Old saves do not matter**, so the world can be rebuilt and identifiers can be renamed freely. Numbers are guesses, kept in `CFG` and tuned after phone testing.

## 1. Terms
- The settlement's steps are called **Stages** in all player-facing text ("Age" is dropped): Stage 1 Camp, Stage 2 Wooden Town, Stage 3 Stone Fortress, **Stage 4 Walled City**, **Stage 5 Seat of Power**.
- "Level" stays for the leader and for buildings; "tier" stays for gear. Code names were renamed to match in `nf-v131` (`age` is now `stage`, `CFG.AGES` is `CFG.STAGES`).

## 2. Stage gates (pacing)
Each stage needs **three things**, all shown as a checklist on the Town Hall panel ("3 of 4 done"):
1. **Resources** (higher, with iron and food added).
2. **A goal checklist** (hard conditions, below).
3. **A minimum day** (so saved resources cannot skip the pacing).

| Stage | Min day | Resources | Goals |
|---|---|---|---|
| 2 Wooden Town | 2 | 80 wood | survive night 1; 4 houses built; 6 citizens |
| 3 Stone Fortress | 5 | 200 wood, 150 stone, 15 iron | survive the first Blood Moon raid; Barracks and Archery Range built; 12 citizens |
| 4 Walled City | 9 | 300 wood, 300 stone, 40 iron, 40 food | break any realm stronghold; second wall finished; 18 citizens |
| 5 Seat of Power | 14 | 500 stone, 100 iron, 100 food | take any realm castle; a Siege Workshop built |

- Perk choice stays at each stage (a fourth and fifth perk list is needed).
- Stage 3 to 5 numbers will be tuned from the balance reports (`balance report` in the game).
- Existing saves keep their stage (additive fields only; no loss).

## 3. What the new stages unlock
- **Stage 4 Walled City:** a third wall ring and a market district (more houses, higher population cap), a **Training Field** (section 4), a second barracks tier (more soldiers), the Siege Workshop plan step becomes available earlier (it is the last plan step today).
- **Stage 5 Seat of Power:** **banners and the host** (separate plan, built after this one), the Throne Hall (town hall look), veteran drills at full strength, the final campaign becomes visible on the map.
- Camera: the default zoom is a little wider at Stage 3 and up, and the outer ring is less crowded, so the fortress feels smaller on screen.

## 3b. The world (new, built before Stage 4)
- **Bigger map from the start:** the playable radius grows from 62 to about **100** (more than twice the area). The town stays in the middle on flat ground; the stone wall and third ring fit with room around them.
- **More terrain variety**, not only one small river. The ground is regenerated with distinct regions: a main river with a tributary and a **lake**, fords and bridges, rolling **hills and plateaus**, a **ravine or cliff line** with passes, a **marsh** (slow ground), **rocky highlands** (ore and stone), **dense forest** and open **meadows**. Rules: no building on water or steep slopes, units slow in marsh and water, high ground gives archers range and a damage edge (existing height bonus), passes become natural chokepoints.
- **More enemies:** a larger spawn ring (enemies walk further and arrive in streams), bigger waves (more raiders per night), a higher live-enemy cap (30 to about 45) guarded by performance checks (distance culling, shared geometry, cheaper far animation), and new roaming packs (wolf packs, scouts) in the wilds.
- **Expeditions and sites** keep their own zones; only their map positions and the world edge change.
- **Phones:** the terrain mesh and fog are tuned for the larger size (lower detail far away, draw distance); test on a phone before the next step.

## 3c. Ground hit effects fix (quick bug fix, first)
Slash arcs, thrust beams, the ultimate and rally rings, oil and gather indicators are placed at a fixed height (0.08 or 0.9) so they hide inside terrain with height. They will be placed at the terrain height under them (`actorH`), drawn on top of the ground, and sized to follow slopes, so the hit area is always visible and matches the real hitbox.

## 4. The Training Field
A separate zone entered from the Town Hall panel or a field gate, reusing the expedition zone code and fade. Open all day, no clock, no night, no losses (soldiers are restored at the end, nothing is spent, the leader does not die).
1. **Parade view:** your warbands stand in formation by banner colour with name tags, a high camera, a total count and courage line.
2. **Practice battles:** pick an enemy set (raiders, archers and brutes, a shield line, a gate) and fight it with the whole army; a **last battle report** (kills, damage, courage, who fought well) is shown.
3. **Test orders:** Forward, Stand firm, Withdraw, Charge, Mark the foe (banner and host orders later).
4. **Veteran drills:** soldiers gain veteran experience slowly, for a food cost and a daily limit (no free grinding).
5. **Siege practice:** a practice wall and gate with your ram, ladders and catapult (gear is not consumed).
- Rules: separate from `exActive` expedition bookkeeping where a loss would matter (no wounds, no courage change except in the report, no gear loss, no story or achievement progress except a "trained" achievement).

## 5. Build order (each a small, testable update)
1. **Ground effects fix** (section 3c). *Risk: low.*
2. **Terms and gates:** "Age" becomes "Stage" in text (and in code, since saves do not matter), checklist plus minimum-day gates for Stages 2 and 3, checklist on the Town Hall panel. *Risk: low.*
3. **World v2:** bigger map (radius about 100), varied terrain regions, bigger spawn ring, more enemies with the performance guard, new roaming packs. *Risk: high (terrain, spawns, paths, performance); test with screenshots and a phone-sized run.*
4. **Stage 4 and 5:** the two new stages, third wall ring, market district, bigger population cap, perks, wider default camera. *Risk: medium.*
5. **Training Field step 1:** enter and leave, parade view, one raider practice battle, free of losses.
6. **Training Field step 2:** more enemy sets, siege practice, last battle report.
7. **Training Field step 3:** veteran drills.
8. **Then banners and the host** (Stage 5 unlocks them), with the field as their testing ground.

## 6. Defaults I will use unless you say otherwise
1. Gates are a hard checklist **plus** a minimum day **plus** resources (not a score).
2. Stage names as in section 1; "Age" removed from text only.
3. The Training Field opens at Stage 4 (Stage 3 players see it listed as locked).
4. Drills give at most one veteran step per soldier per day.
5. Old saves are not preserved (a new game is expected after the world update).
6. Map radius about 100; live-enemy cap about 45; terrain regions as in section 3b.

## 7. Risks
- **Balance:** a larger map and more enemies change pacing; re-tune waves, soldier counts and walls from balance reports after the world update.
- **Layout:** the third wall ring, market district and the terrain rules must not overlap existing lots or water (reuse `planOuterFields` and `findTownSpot`).
- **Scope:** do not build banners, the host or a new map inside this plan.
