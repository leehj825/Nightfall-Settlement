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

## Under layer fitted to the armour, soft joints for shoulders and neck (nf-v172)
- The under layer (options 3/4) is now fitted to the armour: `leaderSections` measures the armour's cross section per body part and height, and every pill/ball is centred in it with radii capped at 68 % of the armour's half size, so it no longer bulges out of the arms or legs.
- Soft joints (options 2/4) got a third pass: around the shoulders and the neck, bone weights are averaged with the vertices of neighbouring parts within 5 cm (50/50 with the vertex's own weights, top 4 bones kept), so collar, pauldrons and neck follow each other.
- Verified headless only; phone check pending.

## nf-v173: shoulder-to-body weights and a thicker under layer
- Shoulder pads/pauldrons hang more on the vest (0.85 / 0.5), the shoulder-to-vest blend radius is 0.17 m (max 0.7), and the neighbour-diffusion pass uses 7 cm radius, 65 % neighbours, over a 0.22 m zone around each shoulder: closes the back shoulder/back gap.
- Under layer: fit factor 0.9 (was 0.68) and larger pill/ball radii, with a deeper across-the-shoulders pill, so it shows through any remaining gap.

## nf-v174: joint-only under layer, collar pads fixed to the vest
- The under layer is now only short pieces at the joints (waist band, upper back, across the shoulders, neck, shoulder/elbow/hip/knee balls), fitted inside the armour (factor 0.8). Long limb and body pills were removed, so nothing can bulge out of the arms.
- Shoulder/collar pads near the neck (|x| < 0.22) follow the vest 100 % (they floated off the back when the arm was raised); the outer shoulder armour 60 %.

## nf-v175: shoulder armour follows the vest near the joint
The upper-arm shoulder armour (bone shoulder, centre below the collar) was getting no part-level weight, so it swung away from the back when the arm rose. The per-vertex shoulder→vest blend now reaches 0.24 m around the joint (max 0.9), so the armour keeps its seam with the back.

## nf-v176: shoulder filler matches the vest
Weights alone cannot close a gap between separate shells, so the shoulder ball of the under layer is no longer fitted to the arm section (it covers the armpit/back-of-shoulder where the arm leaves the vest), and the under layer colour is now vest red-brown (0x6e3322) so a filled gap reads as cloth, not as a dark hole.

## nf-v177: whole-body soft connection
The weight diffusion pass now runs over every vertex (twice, 6 cm radius, 45 % neighbours, 65 % at shoulders/neck), not only around the shoulders: neighbouring shells of every joint (waist, hips, knees, elbows, shoulders, neck) get similar weights and move together. Works in option 2 without the under layer.

## nf-v178: the leader model is now leader3.glb (16 parts)
- `python3 tools/build_leader_parts.py leader3.glb 1024` (the .glb is not in the repo). 16 parts, 15 291 vertices, 256 KB texture, `js/leader_parts.js` 877 KB (was 45 parts / 738 KB).
- Same rig and same animation: the model is height-warped to the existing LEADER_JOINTS (knee 0.37→0.45, hip 0.81→0.92, shoulder 1.40→1.55, top 1.80→1.92); only `elDY` (0.26→0.32) and the fist offset (-0.28→-0.30) changed.
- Parts go to bones as before (head, upper arm→shoulder, forearm/hand→elbow, thigh→hip, boot→knee, belt pieces→hips). The one big torso part (chest, belly, pelvis, chain skirt) is skinned softly per vertex: hips below the waist, spine above, head at the collar, and the skirt front also follows the thigh. All soft-joint options (2–4) run on it unchanged except that the skirt/waist logic is limited to vertices below the pelvis and only touches vertices with ≤2 influences.

## nf-v179: only Classic and New model
- Settings > Leader model now has two choices: Classic and New model. The New model always uses the soft joints (whole-body weight diffusion); the under layer and the old options 2–4 were removed (code and `?leader=2..4`, which now means the new model; saved values 2–4 also load the new model).
- Arms and shoulder armour are 5 cm higher (`ARM_UP` 0.05, `LEADER_JOINTS.shY` 1.60) to sit level with the neck.
- The silver collar/shoulder pad (and the other pad inside the torso part) is fixed to the vest and excluded from the weight diffusion, so it no longer moves with the arm. It is not lifted with the arms either.

## nf-v180: longer legs, hips higher in the skirt, arms higher
Height warp now knee 0.37→0.48, hip 0.81→0.99, shoulder 1.40→1.60, top 1.80→1.97 (the leader is 1.97 m); `ARM_UP` 0.07; LEADER_JOINTS: shY 1.67, hipY 0.99, kneeDY 0.51, neckY 1.66, elDY 0.31. Ground contact is unchanged (the hip joint world height equals the leg length; the hips bone stays at the clips' height).

## nf-v181: shorter skirt (more thigh), arms higher again
- The torso/skirt/belt parts have their own height warp (`BODY_WARP`: skirt hem 0.57→0.80 instead of 0.71), so the hem sits higher and more of the thigh shows below it; legs (thigh, boot) keep `LEG_WARP`.
- `ARM_UP` 0.10, `LEADER_JOINTS.shY` 1.70 (arms and shoulder armour 3 cm higher than nf-v180).

## nf-v182: skirt sides follow the thigh, sleeve top sticks to the collar
- Chain skirt: the side panels (|x| > 0.10, not the back) now also take thigh weight (up to 0.85), so the skirt opens and closes with the leg in a wide stance; the back stays on the pelvis.
- Shoulder: the sleeve-top blend toward the vest reaches 0.30 m (max 0.95), so no hole opens between the neck/collar and a raised arm.

## nf-v183: new leader model (leader_with_clothe.glb, simple clothes) with automatic smooth skinning
**This replaces everything above about parts, soft joints and the under layer: that code is gone.**
- Source: 7 meshes (legs+pelvis, torso+upper arms, two forearms/hands, head, two tiny pieces), 3 504 vertices, 136 KB texture, `js/leader_parts.js` 316 KB (was 877 KB). Build: `python3 tools/build_leader_parts.py <file>.glb 1024` (the .glb is not in the repo).
- Skinning is automatic per vertex (`skin()` in the builder): weight = exp(-(max(0, distance to the bone segment - radius)/0.045)^2) over the bones of the model's A-pose skeleton (table `JOINTS`), 4 strongest kept; left/right limbs do not mix except at the centre line. So there are no separate shells to tear apart, and the joints bend smoothly.
- The model is scaled to 1.9 m. `LEADER_JOINTS` in `js/rig.js` equals the builder's `JOINTS` (shX .29, shY 1.54, elX .06, elDY .34, hipX .11, hipY .91, kneeDY .41, neckY 1.59); fist offset `[0.09, -0.34]`.
- To tune: change `JOINTS`/radii/`SIGMA` in the builder and the same numbers in `LEADER_JOINTS`, rebuild.

## nf-v184: shoulder bone moved up
The shoulder pivot was at 1.54 m (below the shoulder top), so raised arms swung from too low. The bone now sits at shX 0.27, shY 1.60 (neck level), elbow at elX 0.08 / elDY 0.40 (same elbow spot as before). The mesh is unchanged; only the bones and the weight segments moved (builder `JOINTS` = `LEADER_JOINTS`).
