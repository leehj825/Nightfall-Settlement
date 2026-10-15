# Leader model made of parts (owner model, test build)

Try it: **Settings > Leader model (test) > New parts model** (works in the Android app too; the game saves and reloads), or add `?leader=1` to the address (`?leader=0` forces the classic leader). The choice is stored in `localStorage` (`nf_leader`). When it is off the extra file is not downloaded by the browser (the Android app bundles it, about 0.6 MB).

## What it is
The owner's Tripo model, exported as **`Leader2.glb`** (45 separate meshes `tripo_part_N`, 9,724 triangles, a coloured base texture; the old black-and-white FBX is no longer needed and its dump tool was removed). Build it with one command (the `.glb` is not in the repo, keep your copy):

    python3 tools/build_leader_parts.py Leader2.glb [texture-size] [lift]

`build_leader_parts.py` reads the glb itself (no libraries), welds the vertices, scales the model to 1.8 m, binds each part to ONE bone (weight 100%) and writes `js/leader_parts.js` (`LEADER_PARTS`).

## Leader options (Settings > Leader model, or `?leader=0..4`)
0. **Classic**: the polygon stick-man.
1. **New model**: the parts model as built (rigid parts, joints of the stick-man moved to the model's joints, `LEADER_JOINTS` in `js/rig.js`).
2. **New model + soft joints**: vertices near a joint also follow the bone on the other side (`softenLeaderJoints` in `js/rig.js`: 50% at the joint fading to 0 at 7 to 10 cm, 35% at shoulder and hip tops; since nf-v169 also the waist, where the bottom of the vest follows the pelvis by up to 55% and the belt follows the vest by up to 50%, and the neck, where the collar and the head share up to 40%), so a sleeve end or a boot top stretches to the next piece. Only weights change, not the parts.
3. **New model + under layer**: a simple leather-brown body (tubes between the joints, 11 soft skinned tubes, `leaderUnderlayer`) under the armour, so what shows through a gap is clothing, not the ground.
4. **New model + both**.
These are for comparing on the phone; once one is chosen the others and the unused code can be removed.

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

## Longer legs and a stretching skirt (nf-v167)
- Legs: `LEG_WARP` now puts the hip at 0.92 m (was 0.88) and the knee at 0.45 m, everything above moves up 12 cm; the leader is 1.92 m tall. `LEADER_JOINTS` in `js/rig.js` follows (`shY` 1.55, `hipY` 0.92, `kneeDY` 0.47, `neckY` 1.62).
- Skirt (the two chain pelvis guards, `is_skirt()` in `tools/build_leader_parts.py`) is now soft skinned instead of rigid: every vertex follows the pelvis bone and, at the front, also the thigh bone on its side. The thigh share grows towards the front (z), towards the hem (y) and away from the centre line (x), so the back panel stays joined and the front pieces swing with each thigh and stretch. The numbers are in the 'skirt' block of the builder (`0.12` front blend, `0.08` centre blend, `h ** 0.8` hem curve).

## Soft joints, second version (nf-v170)
The first soft joints left many gaps at the waist and shoulders because the parts there rotate against each other. `softenLeaderJoints` (`js/rig.js`) now works in two steps: whole parts first, then vertices near a joint.
- Shoulder pads (centre closer than 22 cm to the body line) follow the vest 65% and the shoulder bone 35%; the pauldron follows the vest 30%.
- The belt and pouches follow the vest 75%.
- The top of the chain skirt follows the vest (80% at the top, fading to 0 at half of the skirt height); the hem follows the thighs as before.
- Joint ends blend up to 55% (radius 11 to 12 cm) at the elbow, hip and knee, up to 50% (radius 9 to 10 cm) at the shoulder top and hip top; the bottom of the vest follows the pelvis up to 60%.
Only skin weights change; the part meshes are untouched. Numbers are in that function.

## Under layer, second version (nf-v171)
`leaderUnderlayer` (`js/rig.js`) is now a leather-brown mannequin made of pills (capsules with round ends) and balls (ellipsoids), all soft skinned: pelvis, chest and belly, a pill across the shoulders (fills the armpits and the shoulder tops), neck, head, and per side a shoulder ball, upper arm, elbow ball, forearm, hand, hip ball, thigh, knee ball, shin and foot. Round ends and joint balls mean a bend never opens a slit. About 1,900 vertices, built at load time, no data file.
