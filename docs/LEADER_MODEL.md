# Leader model and character proportions (current state, nf-v225)

This file describes what the code does now. (The long history of the earlier parts-model experiments - 45 and 16 separate parts, soft joints, an under layer, automatic skinning - was removed on purpose: that code is gone; see git history before nf-v194 if it is ever needed.)

## Two leaders (Settings > Leader model)
- **Classic**: the polygon stick-man built in code (`buildStickman` in `js/rig.js`, kind `player`). It has its own, finer geometry set (`RG_PL`: twice the segments of the crowd, smooth-shaded skin) and the body balance `LEADER_BALANCE`.
- **New model**: the owner's skinned model, loaded from `js/leader_parts.js` (330 KB) only when selected (`window.NF_LEADER`, set in `index.html` from `?leader=1` or `localStorage nf_leader`; changing the setting saves and reloads). Old saved values 2 to 4 load the new model.

## The new model: how it is built
`python3 tools/build_leader_parts.py leader_skeleton.glb [texture-size] [lift]` (the .glb is not in the repo).
- The glb is a Mixamo-style rig: 65 joints with fingers and clavicles, per-vertex weights (4 joints), one 1024 px texture, 3 463 vertices.
- The builder **keeps the file's own weights** and merges the joints into the game's bones: Hips -> `hips`; Spine/Spine1/Spine2 -> `spine`; Neck/Head -> `head`; Shoulder (clavicle) -> `clavL/clavR`; Arm -> `shoulder`; ForeArm, Hand and all fingers -> `elbow`; UpLeg -> `hip`; Leg, Foot, Toe -> `knee`. Mixamo "Left" is +x, the game's L is -x, so the sides are swapped.
- The model is in T-pose. At build time the arms are rotated 72 degrees down about the shoulder (linear blend skinning with the arm weights) so the rest pose matches the rig. Height 1.944 m (`HEIGHT`).
- The joint positions after posing and scaling are written into `leader_parts.js` (`joints`: shoulder, elbow, hip, knee, neck, collar x, fist offset). `js/rig.js` reads them as `LEADER_JOINTS` and moves the stick-man's bones there, so the same animation clips play. Nothing is tuned by hand.

## Clavicle bones
The new model has two extra skin-only bones `clavL/clavR` (child of the spine, parent of the shoulder), 13 skin bones in all. They are not in the clips: `updateClavicles` (runs after `mixer.update`) lifts the shoulder up to about 29 degrees when the upper arm goes above the horizontal and turns it forward when reaching. Only this leader has them.

## Body balance of the classic characters
`LEADER_BALANCE` (leader) and `FOLLOWER_BALANCE` (soldiers, archers, citizens, raiders) in `js/rig.js` scale the parts per bone (`[x, z, y]` multipliers, left and right share): the head is 12 to 14 % smaller, arms and legs thicker (leader about 20 to 28 %, followers about half of that), torso and pelvis slightly bigger. The beast and the horse are not affected.

## Sizes
The new leader is 1.944 m, the classic one about 1.8 m. `leader_parts.js` is 330 KB (3 463 vertices, 148 KB texture). Everything is loaded lazily (only when the New model is chosen).

## Tuning
- Joint positions come from the file; to move a joint, change the glb or the arm pose angle `ARM_DOWN` / `HEIGHT` in the builder and rebuild.
- Fist position: `joints.fistX/fistY` (grip offset from the elbow bone), used by `out.setHand` in `js/rig.js`.
- Collar lift strength: the two numbers in `updateClavicles`.
- Proportions of the classic bodies: the two balance tables.

## Great sword
The great sword mesh is the owner's model (`js/greatsword.js`, 67 KB, built by `tools/build_greatsword.py Greatsword.glb`): the sword is separated from the scabbard that the file also holds, turned to the rig's weapon axis, 2.25 m long, 22 % narrower and 15 % thinner than the file, handle 1.3x (`HANDLE`, `THIN_W`, `THIN_T`, default length in the script). `makeSwordMesh` uses it for `def.great`.

## Riders
A mounted character plays its idle upper body while the horse walks or runs (`Anim._res`), sits with the thighs open over the flanks (`_seat`), cannot jump by itself (the horse leaps: `rig.hopT/hopK`, see `docs/MODEL_FIELD.md`), and a dead rider slides off sideways and lies beside the horse (`_fallStep`).
