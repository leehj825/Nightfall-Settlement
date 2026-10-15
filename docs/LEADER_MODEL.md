# Leader model made of parts (owner model, test build)

Try it: **Settings > Leader model (test) > New parts model** (works in the Android app too; the game saves and reloads), or add `?leader=1` to the address (`?leader=0` forces the classic leader). The choice is stored in `localStorage` (`nf_leader`). When it is off the extra file is not downloaded by the browser (the Android app bundles it, about 0.6 MB).

## What it is
The owner's Tripo model (`Leader.fbx`, 45 separate meshes `tripo_part_N`, 9,724 triangles, three 4096x4096 PNG textures). Rebuilt for the game by two tools:
1. `node tools/dump_fbx_parts.js <three-r128-dir> Leader.fbx /tmp/parts.json` dumps every part (world positions, normals, uvs) as JSON (same three@0.128 folder that `retarget_mixamo.js` uses).
2. `python3 tools/build_leader_parts.py /tmp/parts.json Leader_basecolor.png [size] [lift]` welds the vertices, scales to 1.8 m, binds each part to one bone and writes `js/leader_parts.js` (`LEADER_PARTS`). The FBX and PNG files are not in the repo (16 MB); keep the originals.

## Three leader options (Settings > Leader model, or `?leader=0|1|2`)
0. **Classic**: the polygon stick-man.
1. **New model (own joints)**: the parts model, and the stick-man's joints (shoulder, elbow, hip, knee, neck) are moved to the model's own joint heights (`LEADER_JOINTS` in `js/rig.js`) so the parts swing around the right points. The first test build swung the arms around the classic shoulder, 17 cm above the model's real shoulder, so sleeves and bracers flew apart.
2. **New model on classic body**: the classic skeleton is unchanged and the same parts are stretched (`WARP` in `tools/build_leader_parts.py`, stored as `pos3`) so the model's joints land on the classic joints; the head keeps its size and is only moved up (the character is about 1.94 m instead of 1.8 m). Movement matches the classic leader exactly.

## Animation by segment
`tools/build_models.py` (the old models) blends bone weights by the distance of every vertex to the bones: the animation follows the area around a bone. The new build gives **each part one bone with weight 100%** (`assign()` in `build_leader_parts.py`: head, shoulder = upper arm and pauldron, elbow = forearm, bracer and hand, hips = pelvis and belt, hip = thigh, knee = shin and boot, spine = the rest, left or right by side). A sleeve, a boot or a shoulder pad moves as one rigid piece. To change one part's bone, edit the rules in `assign()` (or add a per-part override table).

## Sizes (measured)
| | Original | In the game |
|---|---|---|
| Files | 15.7 MB zip: FBX 8.4 MB + base colour 4.5 MB + normal 2.5 MB + roughness 0.9 MB | `js/leader_parts.js` about 706 KB (it now holds two sets of positions for the two modes) |
| Vertices | 29,172 (nothing shared) | 11,173 after welding |
| Triangles | 9,724 | 9,724 (nothing removed) |
| Texture | three 4096x4096 (about 250 MB of video memory with mip maps) | one 1024x1024 JPEG, 176 KB (about 5 MB of video memory) |
Only the base colour is used (no normal or roughness map). For comparison the old leader in `models.js` is 189 KB (3,390 vertices, 512 px texture). Everything is loaded only with `?leader=1`, so the default game size is unchanged (one small inline script in `index.html`).

## Ideas to make it smaller or faster
- Binary files instead of base64 in a JS file (-25%), and drop the two weight arrays (single bone, -80 KB raw).
- Merge parts that use the same bone into one mesh (45 draw calls become about 11) and drop hidden inner faces; decimate to about 5,000 triangles.
- 512 px texture (about 60 KB) or a grayscale JPEG; the colour texture is almost black.
- Use the stick-man (or a far LOD) when the camera is far away, as in the town view.
- Per-part colour tint (cloth, leather, metal) instead of painting the texture; this is possible now because the parts are separate.
- Soft weights only for the few parts that cross a joint (forearm bracer, thigh) to hide seams.
