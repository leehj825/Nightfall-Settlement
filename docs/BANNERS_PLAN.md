# Banners and the host - plan

Status: **phases 1 and 2 built (`nf-v144`, `nf-v145`)**. Unlocked at Stage 5 (`CFG.BANNER.STAGE`). Numbers live in `CFG.BANNER` and are guesses to tune after phone play.

## Terms
- **Banner**: 2 to 3 warbands under one standard (Dragon, Griffin, Hart). Up to 3 banners.
- **Host**: every warband you bring on a journey together. Stage 5 raises the party cap by 1 (`HOST_BONUS`).

## Phase 1 (built)
- Warband window (Stage 5): a button cycles the warband through No banner / Dragon / Griffin / Hart (a banner holds at most 3 warbands). The bar chip shows the banner's initial.
- Orders pressed on a warband in a banner go to the whole banner.
- **Bring whole banner** adds every warband of the banner to the next journey (as many as fit in the party cap).
- **Cohesion bonus**: a soldier gets +6% damage and 6% less damage taken while a soldier of another warband of the same banner is within 18 paces (`bannerMods` in `10b-warbands.js`, combined with the leader's standard in `standardMods`).
- Saved with the warband info (`banner` field, additive).

## Phase 2 (built in `nf-v145`)
- **Host orders:** the warband window has a "Whole host" row of order buttons that set every warband at once (`setHostOrder`).
- **Army rally:** Rally Cry heals soldiers of any banner wherever they are (`inBanner` in `13-combat-abilities-boss.js`); unbannered soldiers still need to be in range.
- **Training Field:** the parade groups warbands by banner and the name tags show the banner. Drills give +1 extra drill XP (`CFG.BANNER.DRILL_XP`) to soldiers whose banner has another warband in the party (`drilledTogether`).

## Later (not built)
- Banner flags carried in the field (visual); Marshal skill extras; retune the bonuses and party cap from phone play.
