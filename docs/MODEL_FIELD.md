# Model field

Settings > **Model field** opens a separate flat field (no town, no night, no enemies) for looking at characters, mounts and your own models with a free camera. **Exit** returns to the game where you were (the game is paused while you are in the field). `?modelfield` in the address opens it right away (handy on desktop).

- **Camera:** one finger / left mouse drag = orbit; two fingers = pinch zoom + pan; right/middle mouse drag = pan; wheel = zoom; Front / Side / Back / Top buttons; *Auto-rotate*. A red ruler at the left marks every 0.5 m (2 m tall).
- **Models:** Leader (Classic or New, as set in Settings > Leader model; changing it reloads the game), Soldier, Archer, four citizens, six raiders, Beast, Horse. Pick one in the list, or *All (line-up)*.
- **Actions:** idle, walk, run, attack (by the chosen weapon), block, jump, die. **Weapon:** sword, greatsword, spear, bow, none. **Mounted** puts every human on a horse.
- **Your own model:** *Open .glb* loads a file from the phone/PC, scales it to 1.8 m and plays its first animation; if it has animations they are listed in a toast and can be triggered with the action buttons that share a clip name (e.g. `idle`, `walk`).
- Code: `src/game/19-model-field.js` (own scene and camera; the main loop only calls `mvStep` while it is open). To add a model to the list, add a row to `defs` in `mvInit` (or a branch for a new kind) there.

## Horse
The classic box horse is a simple jointed horse (`src/game/04c-horse.js`): 12 joints - body, neck, head, tail and two parts per leg (upper, lower) - each with one box: one body block, one neck block, one head block, thick legs (the lower part is dark, with the hoof), a tail, the saddle and, for spearmen, a chest plate of barding. Walk and gallop come from the owner's horse animation pack (`tools/build_horse_anim.py Lowpolyhorseanimationspack.glb` -> `js/horse_anim.js`, 15 KB): the walk is "horse walk attack 1", the gallop is "horse runcycle new". Each joint sits at one bone of the pack's skeleton; the legs, neck and head follow the *direction* between two bones (swing only), so a two-part leg still steps like the real one. Speed picks standing (rest pose), walk (< 4.2 m/s) or gallop, cross-faded; the cycle speed follows the ground speed; the back's bob moves the rider.
