# game.js source parts

`js/game.js` is one IIFE; its sections share closure state (constants, `let` variables, helper functions), so it cannot be
cut into independent modules without a rewrite. Instead the source lives here as numbered parts that are concatenated:

```
python3 tools/build_game.py          # src/game/*.js  ->  js/game.js
python3 tools/build_game.py --check  # fail if js/game.js is stale (CI runs this)
```

A part is **not** valid JavaScript on its own (the first opens the IIFE, the last closes it). Edit a part, rebuild, commit both.
Part order is file-name order; add new sections by renaming with a gap-friendly number.
