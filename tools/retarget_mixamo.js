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
  idle: ['idle', true], walk: ['walking', true], run: ['running', true],
  ssIdle: ['sword and shield idle', true], ssRun: ['sword and shield run', true],
  ssAttack1: ['sword and shield attack (4)', false], ssAttack2: ['sword and shield attack (2)', false], ssAttack3: ['sword and shield attack (3)', false], ssAttack4: ['sword and shield attack', false],
  ssBlock: ['sword and shield block', false],
  bowDraw: ['Standing_Draw_Arrow', false], bowRun: ['Standing_Run_Forward', true], bowWalk: ['Crouch_Walk_Forward', true], die: ['sword and shield death', false],
};
const MAXF = 48;
const V = THREE.Vector3, Q = THREE.Quaternion, E = THREE.Euler;
const byName = (o) => { const m = {}; o.traverse(x => { if (x.isBone) m[x.name.replace('mixamorig', '')] = x; }); return m; };
// 좌우 반전: Mixamo 캐릭터는 오른손(-x)에 검을 쥔다. 이 게임은 검이 'R'(+x) 손에 있으므로 동작 전체를 x축 기준으로 뒤집는다.
const MIRROR = true;
const wq = (b) => { const q = b.getWorldQuaternion(new Q()); return MIRROR ? new Q(q.x, -q.y, -q.z, q.w) : q; }, wp = (b) => { const p = b.getWorldPosition(new V()); if (MIRROR) p.x = -p.x; return p; };
const UP = new V(0, -1, 0);
function solveLimb(parentW, dWorld) { const dl = dWorld.clone().applyQuaternion(parentW.clone().invert()); return new Q().setFromUnitVectors(UP, dl.normalize()); }
const eul = (q) => { const e = new E().setFromQuaternion(q, 'XYZ'); return [+e.x.toFixed(3), +e.y.toFixed(3), +e.z.toFixed(3)]; };
const out = {};
for (const [name, [file, loop]] of Object.entries(WANT)) {
  let fp = null; for (const d of dirs) { const p = path.join(d, file + '.fbx'); if (fs.existsSync(p)) fp = p; }
  if (!fp) { console.warn('missing', file); continue; }
  const obj = load(fp), B = byName(obj), clip = obj.animations[0];
  obj.updateMatrixWorld(true);
  const rest = {}; for (const k of ['Hips', 'Spine1', 'Head']) rest[k] = wq(B[k]);
  const swordHand = B.RightHand, hv = [];             // 검 손(Mixamo 오른손)의 속도가 가장 큰 순간 = 타격 순간
  const hipsRest = wp(B.Hips), scale = 0.9 / hipsRest.y;
  // 캐릭터의 왼쪽(+x) = 이 게임의 'R' 뼈, 오른쪽(-x) = 'L' 뼈 (게임 리그는 +z를 보고 sx<0 가 'L')
  const side = { L: 'Left', R: 'Right' };          // 반전 후: 게임의 R(+x) = Mixamo 오른손(검), L(-x) = 왼손(방패)
  const mixer = new THREE.AnimationMixer(obj); mixer.clipAction(clip).play();
  const n = Math.min(MAXF, Math.max(10, Math.round(clip.duration * 24))), tr = { hips: [], spine: [], head: [], shoulderL: [], shoulderR: [], elbowL: [], elbowR: [], hipL: [], hipR: [], kneeL: [], kneeR: [], hipsY: [], hipsZ: [] };
  let z0 = null;
  for (let i = 0; i <= n; i++) {
    mixer.setTime(clip.duration * i / n); obj.updateMatrixWorld(true);
    const Wh = wq(B.Hips).multiply(rest.Hips.clone().invert()), Ws = wq(B.Spine1).multiply(rest.Spine1.clone().invert()), Wd = wq(B.Head).multiply(rest.Head.clone().invert());
    tr.hips.push(eul(Wh)); const qs = Wh.clone().invert().multiply(Ws); tr.spine.push(eul(qs)); const Wsp = Wh.clone().multiply(qs);
    tr.head.push(eul(Wsp.clone().invert().multiply(Wd)));
    for (const s of ['L', 'R']) {
      const m = side[s], A = wp(B[m + 'Arm']), F = wp(B[m + 'ForeArm']), H = wp(B[m + 'Hand']);
      const qsh = solveLimb(Wsp, F.clone().sub(A)); tr['shoulder' + s].push(eul(qsh)); const Wsh = Wsp.clone().multiply(qsh);
      const qel = solveLimb(Wsh, H.clone().sub(F)); tr['elbow' + s].push(eul(qel));
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
  const drift = Math.abs(tr.hipsZ[n]); out[name] = { d: +clip.duration.toFixed(3), n, loop, hit: +(bi / n).toFixed(3), t: tr };
  console.log(name.padEnd(10), file.padEnd(30), clip.duration.toFixed(2) + 's', n + 'f', 'hit@' + (bi / n).toFixed(2), 'hips Z drift (ignored)', drift.toFixed(2));
}
const js = '// Generated by tools/retarget_mixamo.js from Mixamo animation packs (Locomotion Pack, Lite Sword and Shield Pack). Do not edit by hand.\nconst MIXAMO_CLIPS = ' + JSON.stringify(out) + ';\n';
fs.writeFileSync(path.join(__dirname, '..', 'js', 'anims.js'), js);
console.log('wrote js/anims.js', (js.length / 1024).toFixed(0) + ' KB');
