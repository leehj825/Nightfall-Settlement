# Banners and the host - plan

Status: **phase 1 built in `nf-v144`**. Unlocked at Stage 5 (`CFG.BANNER.STAGE`). Numbers live in `CFG.BANNER` and are guesses to tune after phone play.

## Terms
- **Banner**: 2 to 3 warbands under one standard (Dragon, Griffin, Hart). Up to 3 banners.
- **Host**: every warband you bring on a journey together. Stage 5 raises the party cap by 1 (`HOST_BONUS`).

## Phase 1 (built)
- Warband window (Stage 5): a button cycles the warband through No banner / Dragon / Griffin / Hart (a banner holds at most 3 warbands). The bar chip shows the banner's initial.
- Orders pressed on a warband in a banner go to the whole banner.
- **Bring whole banner** adds every warband of the banner to the next journey (as many as fit in the party cap).
- **Cohesion bonus**: a soldier gets +6% damage and 6% less damage taken while a soldier of another warband of the same banner is within 18 paces (`bannerMods` in `10b-warbands.js`, combined with the leader's standard in `standardMods`).
- Saved with the warband info (`banner` field, additive).

## Phase 2 (not built)
- Host orders: one set of order buttons for every warband, and an army rally (the Rally Cry reaches all banners).
- Banner flags carried in the field (visual), banner names in the Training Field parade.
- Banner veterans: drills train a whole banner.
- Test on the Training Field, then retune the bonus and party cap from phone play.
