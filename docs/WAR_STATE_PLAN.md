# Wounds, courage and levies - plan

Status: **built in `nf-v118`** (all three parts below). Banners and the host are not part of this plan. Numbers live in `CFG.WOUND`, `CFG.COURAGE`, `CFG.LEVY` and are guesses to tune after phone testing.

## Why
Sieges and garrisons are where soldiers fall, but today a fallen soldier is carried home and is fine by the next day, and nothing tracks how steady the host is. These three small systems give raids real stakes without adding new screens.

## 1. Wounds
- A soldier who is down when a raid ends comes home **wounded** for 1 to 2 days (2 to 3 after a castle). A wounded soldier cannot fight or be brought on a journey; their label reads "Wounded 2d".
- Each morning a wound drops by 1, and by 1 more if a Medic (home class) is in the village.
- A castle you fail to take still costs the fallen for good (existing rule).

## 2. Courage (0 to 100, one value for the whole host, saved in `story.courage`, starts at 70)
- Soldier damage is scaled by courage: 0 = x0.75, 70 = x1.0, 100 = x1.1.
- Down: -4 for each soldier that falls on a raid; +12 when a camp or castle is broken; -6 when you withdraw without winning; -5 on a morning with no food in the stores; drifts back 5 per morning toward 70.
- At 0, soldiers on a raid fall back (Withdraw) until courage rises above 0.
- Shown in the raid HUD line and in the Journal warband box.

## 3. Levies
- In the Journal warband box: **Call levy** (6 food each, up to 4). A levy is a temporary weak soldier (60% health, 70% damage) who joins the next journey whatever warbands you bring and is dismissed when you come home or at the next morning. Levies do not count toward the soldier cap and are not saved.

## Later (not built)
Banners (2 to 4 warbands under one standard), the host, the final campaign.
