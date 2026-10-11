#!/usr/bin/env node
// Retargets Mixamo FBX animations onto the game's simple stick-man skeleton and writes js/anims.js.
//   node tools/retarget_mixamo.js <three-r128-dir> <fbx-dir> [<fbx-dir> ...]
// <three-r128-dir> = a folder with three@0.128 (build/three.js, examples/js/loaders/FBXLoader.js, examples/js/libs/fflate.min.js).
// Method: hips/spine/head take the Mixamo bone's world rotation relative to its rest pose; each limb bone is rotated so that it
// points along the same world direction as the matching Mixamo limb segment (swing only - the stick-man has no twist joints).
const fs = require('fs'), path = require('path'), vm = require('vm');
const T = process.argv[2], dirs = process.argv.slice(3);
if (!T || !dirs.length) { console.error('usage: retarget_mixamo.js <three-dir> <fbx-dir>...'); process.exit(1); }
global.THREE = require(path.join(T, 'build/three.js')); global.window = global; global.self = global;
global.fflate = (() => { const m = { exports: {} }; new Function('module', 'exports', fs.readFileSync(path.join(T, 'examples/js/libs/fflate.min.js'), 'utf8') + '\n;return module.exports;')(m, m.exports); return m.exports; })();
vm.runInThisContext(fs.readFileSync(path.join(T, 'examples/js/loaders/FBXLoader.js'), 'utf8'));
const loader = new THREE.FBXLoader();
const load = (f) => { const b = fs.readFileSync(f); return loader.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), ''); };
// wanted clips: output name -> [file name (without .fbx), loop?]
const WANT = {
  // 평상시 이동 (Locomotion Pack): 뒤로 걷기는 앞으로 걷기를 거꾸로 재생한다 (게임 쪽)
  idle: ['idle', true], walk: ['walking', true], run: ['running', true],
  strafeN: ['left strafe', true], strafeP: ['right strafe', true], strafeNW: ['left strafe walking', true], strafePW: ['right strafe walking', true],       // N: 캐릭터가 -x쪽으로, P: +x쪽으로 (정면 +z 기준) 옆걸음
  // 전투 자세 이동: 칼·방패 (Pro Sword and Shield Pack)
  ssIdle: ['sword and shield idle', true], ssIdleCalm: ['sword and shield idle (3)', true], ssWalk: ['sword and shield walk', true], ssWalkB: ['sword and shield walk (2)', true], ssRun: ['sword and shield run', true], ssRunB: ['sword and shield run (2)', true],
  ssStrafePW: ['sword and shield strafe', true], ssStrafeNW: ['sword and shield strafe (2)', true], ssStrafeN: ['sword and shield strafe (3)', true], ssStrafeP: ['sword and shield strafe (4)', true],
  ssAttack1: ['sword and shield attack (4)', false], ssAttack2: ['sword and shield attack (2)', false], ssAttack3: ['sword and shield attack (3)', false], ssAttack4: ['sword and shield attack', false],
  ssBlock: ['sword and shield block', false], die: ['sword and shield death', false],
  spearStab: ['Bayonet_Stab', false], spearSlash: ['Slash_Advance', false],
  // 전투 자세 이동: 활 (Pro Longbow Pack)
  bowIdle: ['standing idle 01', true], bowWalk: ['standing walk forward', true], bowWalkB: ['standing walk back', true], bowWalkP: ['standing walk right', true], bowWalkN: ['standing walk left', true],
  bowRun: ['standing run forward', true], bowRunB: ['standing run back', true], bowRunP: ['standing run right', true], bowRunN: ['standing run left', true],
  bowIdleCalm: ['standing idle 02 looking', true],                                                                                    // 평상시(적이 멀 때) 대기
  bowAimWalk: ['standing aim walk forward', true], bowAimWalkB: ['standing aim walk back', true], bowAimWalkP: ['standing aim walk right', true], bowAimWalkN: ['standing aim walk left', true],       // 전투 중 걷기 (활을 겨눈 채)
  bowDraw: ['standing draw arrow', false], dieBow: ['standing death backward 01', false],
  // 대검 (Great Sword Pack): 두 손 큰 칼
  gsIdle: ['great sword idle', true], gsIdleCalm: ['great sword idle (5)', true], gsWalk: ['great sword walk', true], gsWalkB: ['great sword walk (2)', true], gsRun: ['great sword run (2)', true], gsRunB: ['great sword run', true],
  gsStrafeNW: ['great sword strafe', true], gsStrafePW: ['great sword strafe (2)', true], gsStrafeN: ['great sword strafe (3)', true], gsStrafeP: ['great sword strafe (4)', true],
  gsAttack1: ['great sword attack', false], gsAttack2: ['great sword slash', false], gsAttack3: ['great sword slash (5)', false], gsAttack4: ['great sword high spin attack', false], gsBlock: ['great sword blocking', false],
  dieGs: ['two handed sword death', false],
};
if (process.env.WANT_FILE) { for (const k of Object.keys(WANT)) delete WANT[k]; Object.assign(WANT, JSON.parse(fs.readFileSync(process.env.WANT_FILE, 'utf8'))); }       // 미리보기용: 필요한 클립만 따로 변환
const MAXF = 48;
const V = THREE.Vector3, Q = THREE.Quaternion, E = THREE.Euler;
const byName = (o) => { const m = {}; o.traverse(x => { if (x.isBone) m[x.name.replace('mixamorig', '')] = x; }); return m; };
// 좌우 반전: Mixamo 캐릭터는 오른손(-x)에 검을 쥔다. 이 게임은 검이 'R'(+x) 손에 있으므로 동작 전체를 x축 기준으로 뒤집는다.
let MIRROR = true;
const wq = (b) => { const q = b.getWorldQuaternion(new Q()); return MIRROR ? new Q(q.x, -q.y, -q.z, q.w) : q; }, wp = (b) => { const p = b.getWorldPosition(new V()); if (MIRROR) p.x = -p.x; return p; };
const UP = new V(0, -1, 0);
function solveLimb(parentW, dWorld) { const dl = dWorld.clone().applyQuaternion(parentW.clone().invert()); return new Q().setFromUnitVectors(UP, dl.normalize()); }
const eul = (q) => { const e = new E().setFromQuaternion(q, 'XYZ'); return [+e.x.toFixed(3), +e.y.toFixed(3), +e.z.toFixed(3)]; };
const out = {};
for (const [name, [file, loop]] of Object.entries(WANT)) {
  let fp = null; for (const d of dirs) { const p = path.join(d, file + '.fbx'); if (fs.existsSync(p)) fp = p; }
  if (!fp) { console.warn('missing', file); continue; }
  const bow = /^bow/.test(name); MIRROR = true;           // 활 동작은 뒤집지 않고 Mixamo 오른팔(활을 뻗는 팔)이 게임의 L(활을 드는 왼손 쪽)을 움직이게 한다
  const obj = load(fp), B = byName(obj), clip = obj.animations[0];
  obj.updateMatrixWorld(true);
  const rest = {}; for (const k of ['Hips', 'Spine1', 'Head', 'LeftHand', 'RightHand']) rest[k] = wq(B[k]);
  const swordHand = B.RightHand, hv = [];             // 검 손(Mixamo 오른손)의 속도가 가장 큰 순간 = 타격 순간
  const hipsRest = wp(B.Hips), scale = 0.9 / hipsRest.y;
  // 캐릭터의 왼쪽(+x) = 이 게임의 'R' 뼈, 오른쪽(-x) = 'L' 뼈 (게임 리그는 +z를 보고 sx<0 가 'L')
  const side = { L: 'Left', R: 'Right' };          // 반전 후: 게임의 R(+x) = Mixamo 오른손(검), L(-x) = 왼손(방패)
  const mixer = new THREE.AnimationMixer(obj); mixer.clipAction(clip).play();
  const n = Math.min(MAXF, Math.max(10, Math.round(clip.duration * 24))), tr = { hips: [], spine: [], head: [], shoulderL: [], shoulderR: [], elbowL: [], elbowR: [], hipL: [], hipR: [], kneeL: [], kneeR: [], handL: [], handR: [], hipsY: [], hipsZ: [] };
  let z0 = null; const xStart = (mixer.setTime(0), obj.updateMatrixWorld(true), wp(B.Hips).x);
  for (let i = 0; i <= n; i++) {
    mixer.setTime(clip.duration * i / n); obj.updateMatrixWorld(true);
    const Wh = wq(B.Hips).multiply(rest.Hips.clone().invert()), Ws = wq(B.Spine1).multiply(rest.Spine1.clone().invert()), Wd = wq(B.Head).multiply(rest.Head.clone().invert());
    tr.hips.push(eul(Wh)); const qs = Wh.clone().invert().multiply(Ws); tr.spine.push(eul(qs)); const Wsp = Wh.clone().multiply(qs);
    tr.head.push(eul(Wsp.clone().invert().multiply(Wd)));
    for (const s of ['L', 'R']) {
      const m = side[s], A = wp(B[m + 'Arm']), F = wp(B[m + 'ForeArm']), H = wp(B[m + 'Hand']);
      const qsh = solveLimb(Wsp, F.clone().sub(A)); tr['shoulder' + s].push(eul(qsh)); const Wsh = Wsp.clone().multiply(qsh);
      const qel = solveLimb(Wsh, H.clone().sub(F)); tr['elbow' + s].push(eul(qel));
      // 손목: 손뼈의 월드 회전 변화(Wd)를 '팔이 내려온 기준 자세'로 옮긴다. T자세(팔이 옆) -> 게임 기준(팔이 아래)은 z축 ∓90도(C)
      { const Wd = wq(B[m + 'Hand']).multiply(rest[m + 'Hand'].clone().invert()), C = new Q().setFromAxisAngle(new V(0, 0, 1), s === 'R' ? -Math.PI / 2 : Math.PI / 2);
        const Wg = Wd.multiply(C.clone().invert()), Wel = Wsh.clone().multiply(qel); tr['hand' + s].push(eul(Wel.invert().multiply(Wg))); }
      const U = wp(B[m + 'UpLeg']), K = wp(B[m + 'Leg']), Fo = wp(B[m + 'Foot']);
      const qh = solveLimb(Wh, K.clone().sub(U)); tr['hip' + s].push(eul(qh)); const Whp = Wh.clone().multiply(qh);
      tr['knee' + s].push(eul(solveLimb(Whp, Fo.clone().sub(K))));
    }
    const hp = wp(B.Hips); if (z0 === null) z0 = hp.z; hv.push(wp(swordHand).sub(hp));                    // 루트 이동을 뺀 손의 위치
    tr.hipsY.push(+(hp.y * scale).toFixed(3)); tr.hipsZ.push(0);                                   // 애니메이션 안의 위치 이동(루트 모션)은 무시한다: 이동은 게임이 맡는다
  }
  // 반복 클립은 끝과 처음이 이어지도록 마지막 키를 첫 키로 맞춘다 (이음매의 튐 방지)
  if (loop) for (const k of Object.keys(tr)) tr[k][n] = tr[k][0];
  let best = 0, bi = 0; for (let i = 1; i < Math.floor(hv.length * 0.92); i++) { const sp = hv[i].distanceTo(hv[i - 1]); if (sp > best) { best = sp; bi = i; } }
  { const ys = tr.hipsY, mx = Math.max(...ys), mn = Math.min(...ys);               // 점프 공격: 타격 순간 = 공중에서 내려와 착지하는 때
    if (name.startsWith('ssAttack') && mx - mn > 0.6) { const p = ys.indexOf(mx); for (let i = p; i <= n; i++) if (ys[i] < mn + 0.25 * (mx - mn)) { bi = i; break; } } }
  if (name === 'bowDraw') bi = Math.round(n * 0.5);               // 화살을 뽑아 시위에 건 손이 앞에 닿는 순간 = 발사
  if (/^strafe/.test(name)) { const dx = wp(B.Hips).x - xStart; console.log('   strafe hips x travel (game space)', dx.toFixed(2)); }
  const drift = Math.abs(tr.hipsZ[n]); out[name] = { d: +clip.duration.toFixed(3), n, loop, hit: +(bi / n).toFixed(3), t: tr };
  console.log(name.padEnd(10), file.padEnd(30), clip.duration.toFixed(2) + 's', n + 'f', 'hit@' + (bi / n).toFixed(2), 'hips Z drift (ignored)', drift.toFixed(2));
}
const js = '// Generated by tools/retarget_mixamo.js from Mixamo animation packs (Locomotion Pack, Lite Sword and Shield Pack). Do not edit by hand.\nconst MIXAMO_CLIPS = ' + JSON.stringify(out) + ';\n';
fs.writeFileSync(process.env.OUT_FILE || path.join(__dirname, '..', 'js', 'anims.js'), js);
console.log('wrote js/anims.js', (js.length / 1024).toFixed(0) + ' KB');
