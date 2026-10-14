# Stages and the Training Field - combined plan

Status: **plan only, nothing built yet** (written at `nf-v123`). It answers three owner observations: (1) the settlement reaches Age 2 and Age 3 almost instantly, (2) after Age 3 the town has nothing left to grow into and the stone fortress is large for the map, (3) there is no place to see the whole army, try orders and rehearse battles. Numbers are guesses, kept in `CFG` and tuned after phone testing.

## 1. Terms
- The settlement's steps are called **Stages** in all player-facing text ("Age" is dropped): Stage 1 Camp, Stage 2 Wooden Town, Stage 3 Stone Fortress, **Stage 4 Walled City**, **Stage 5 Seat of Power**.
- "Level" stays for the leader and for buildings; "tier" stays for gear. Code names (`age`, `CFG.AGES`) are **not** renamed (saves and many call sites use them); only strings change.

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

## 4. The Training Field
A separate zone entered from the Town Hall panel or a field gate, reusing the expedition zone code and fade. Open all day, no clock, no night, no losses (soldiers are restored at the end, nothing is spent, the leader does not die).
1. **Parade view:** your warbands stand in formation by banner colour with name tags, a high camera, a total count and courage line.
2. **Practice battles:** pick an enemy set (raiders, archers and brutes, a shield line, a gate) and fight it with the whole army; a **last battle report** (kills, damage, courage, who fought well) is shown.
3. **Test orders:** Forward, Stand firm, Withdraw, Charge, Mark the foe (banner and host orders later).
4. **Veteran drills:** soldiers gain veteran experience slowly, for a food cost and a daily limit (no free grinding).
5. **Siege practice:** a practice wall and gate with your ram, ladders and catapult (gear is not consumed).
- Rules: separate from `exActive` expedition bookkeeping where a loss would matter (no wounds, no courage change except in the report, no gear loss, no story or achievement progress except a "trained" achievement).

## 5. Build order (each a small, testable update)
1. **Terms and gates:** change "Age" to "Stage" in text, add the checklist and minimum-day gates for Stages 2 and 3, show the checklist on the Town Hall panel. *Risk: low (numbers and text).*
2. **Stage 4 and 5:** the two new stages, their unlock lists, perks, the wider default camera, the third wall ring and market district lots. *Risk: medium (town layout and saves).*
3. **Training Field step 1:** enter and leave, parade view, one practice battle (raiders), free of losses.
4. **Training Field step 2:** more enemy sets, siege practice, the last battle report.
5. **Training Field step 3:** veteran drills.
6. **Then banners and the host** (Stage 5 unlocks them), with the field as the testing ground.

## 6. Defaults I will use unless you say otherwise
1. Gates are a hard checklist **plus** a minimum day **plus** resources (not a score).
2. Stage names as in section 1; "Age" removed from text only.
3. The Training Field opens at Stage 4 (Stage 3 players see it listed as locked).
4. Drills give at most one veteran step per soldier per day.
5. Existing saves: players already at Stage 3 keep it and need only Stage 4's gates.

## 7. Risks
- **Saves and balance:** keep every new field additive with defaults; test loading an old save.
- **Layout:** the third wall ring and the market district must not overlap existing lots (reuse `planOuterFields` and `findTownSpot`).
- **Scope:** do not build banners, the host or a new map inside this plan.
