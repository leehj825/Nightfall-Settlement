# Leader model made of parts (owner model, test build)

Try it: **Settings > Leader model (test) > New parts model** (works in the Android app too; the game saves and reloads), or add `?leader=1` to the address (`?leader=0` forces the classic leader). The choice is stored in `localStorage` (`nf_leader`). When it is off the extra file is not downloaded by the browser (the Android app bundles it, about 0.6 MB).

## What it is
The owner's Tripo model, exported as **`Leader2.glb`** (45 separate meshes `tripo_part_N`, 9,724 triangles, a coloured base texture; the old black-and-white FBX is no longer needed and its dump tool was removed). Build it with one command (the `.glb` is not in the repo, keep your copy):

    python3 tools/build_leader_parts.py Leader2.glb [texture-size] [lift]

`build_leader_parts.py` reads the glb itself (no libraries), welds the vertices, scales the model to 1.8 m, binds each part to ONE bone (weight 100%) and writes `js/leader_parts.js` (`LEADER_PARTS`).

## Two leader options (Settings > Leader model, or `?leader=0|1`)
0. **Classic**: the polygon stick-man.
1. **New model**: the parts model. The stick-man's joints (shoulder, elbow, hip, knee, neck) are moved to the model's own joint heights (`LEADER_JOINTS` in `js/rig.js`) so the parts swing around the right points. (A third option that stretched the parts onto the classic joints was removed in nf-v165: it looked and moved the same.)

## Animation by segment
`tools/build_models.py` (the old models) blends bone weights by the distance of every vertex to the bones: the animation follows the area around a bone. The new build gives **each part one bone with weight 100%** (`assign()` in `build_leader_parts.py`: head, shoulder = upper arm and pauldron, elbow = forearm, bracer and hand, hips = pelvis and belt, hip = thigh, knee = shin and boot, spine = the rest, left or right by side). A sleeve, a boot or a shoulder pad moves as one rigid piece. To change one part's bone, edit the rules in `assign()` (or add a per-part override table).

## Sizes (measured)
| | Original | In the game |
|---|---|---|
| Files | Leader2.glb 12.4 MB (three 4096x4096 JPEGs: base colour 3.7 MB, normal 4.0 MB, metal/roughness 4.3 MB, plus the mesh) | `js/leader_parts.js` about 738 KB (geometry about 280 KB, the coloured base colour texture 265 KB, base64 text) |
| Vertices | 11,172 | 11,172 |
| Triangles | 9,724 | 9,724 (nothing removed) |
| Texture | three 4096x4096 (about 250 MB of video memory with mip maps) | one 1024x1024 base colour JPEG, 265 KB (about 5 MB of video memory) |
Only the base colour is used (no normal or roughness map). For comparison the old leader in `models.js` is 189 KB (3,390 vertices, 512 px texture). Everything is loaded only with `?leader=1`, so the default game size is unchanged (one small inline script in `index.html`).

## Ideas to make it smaller or faster
- Binary files instead of base64 in a JS file (-25%), and drop the two weight arrays (single bone, -80 KB raw).
- Merge parts that use the same bone into one mesh (45 draw calls become about 11) and drop hidden inner faces; decimate to about 5,000 triangles.
- 512 px texture (about 60 KB) or a grayscale JPEG; the colour texture is almost black.
- Use the stick-man (or a far LOD) when the camera is far away, as in the town view.
- Per-part colour tint (cloth, leather, metal) instead of painting the texture; this is possible now because the parts are separate.
- Soft weights only for the few parts that cross a joint (forearm bracer, thigh) to hide seams.

## Arms and shoulders
The classic animation was made for shoulders about 17 cm below the head bone, while this model has a long neck and low shoulders, so in the first builds the arms and shoulder pieces sat too low next to the neck and head. The build now lifts every shoulder and arm part (`ARM_UP` = 7 cm in `tools/build_leader_parts.py`) and the shoulder joint moved up with them (`LEADER_JOINTS.shY` in `js/rig.js` = 1.36 + 0.07). Tune both numbers together if you want more or less.

## Legs (nf-v166)
The legs looked short and the chain skirt opened at the back when the legs split. The build now lengthens the legs (`LEG_WARP` in `tools/build_leader_parts.py`: knee 0.38 -> 0.43 m, hip 0.80 -> 0.88 m, everything above moves up 8 cm; the leader is 1.88 m tall) and keeps the two long pelvis guards (the chain skirt, parts 1 and 2) on the pelvis bone instead of the thigh bones, so the skirt no longer opens when the legs swing. `LEADER_JOINTS` in `js/rig.js` follows the new heights (`shY` 1.51, `hipY` 0.88, `kneeDY` 0.45, `neckY` 1.58). Change the numbers in both files together.
