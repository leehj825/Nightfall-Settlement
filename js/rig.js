// Nightfall Settlement - character rigs: stickman/beast skeletons, procedural animation clips, gear meshes, Anim state machine, optional GLTF models.
const mat = (c) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 1 });
  // ---------- 캐릭터 리그: GLTFLoader 준비 + 코드로 만든 스틱맨(Bone 계층) + AnimationMixer ----------
  // 외부 모델(.glb)을 쓰려면 아래 URL만 채우면 된다. 비어 있으면 코드로 만든 스틱맨 리그를 쓴다.
  // glb 규칙: 클립 이름에 idle / walk / run / gather / attack / shoot / die / sit 포함, 손 뼈 이름에 RightHand·LeftHand(또는 hand_r / hand_l)
  const MODEL_URLS = { player: null, melee: null, archer: null, citizen: null, enemy: null };
  const modelCache = {};
  (function preloadModels() {
    if (typeof THREE.GLTFLoader === 'undefined') return;
    const loader = new THREE.GLTFLoader();
    for (const [kind, url] of Object.entries(MODEL_URLS)) {
      if (url) loader.load(url, g => { modelCache[kind] = g; }, undefined, () => console.warn('Model load failed, using the stickman rig:', url));
    }
  })();
  function rigFromGltf(g, color) {
    const root = new THREE.Group(), model = (THREE.SkeletonUtils && THREE.SkeletonUtils.clone) ? THREE.SkeletonUtils.clone(g.scene) : g.scene.clone(true);
    root.add(model);
    const clips = {}, pick = (name, re) => { const c = g.animations.find(a => re.test(a.name)); if (c) clips[name] = c; };
    pick('idle', /idle/i); pick('walk', /walk/i); pick('run', /run/i); pick('gather', /gather|mine|pick|chop/i);
    pick('attackSword', /attack|slash|sword/i); pick('attackBow', /shoot|bow/i); pick('die', /die|death/i); pick('sit', /sit|rest/i);
    let handR = null, handL = null, bodyMat = null;
    model.traverse(o => {
      if (o.isBone && !handR && /right.*hand|hand[._]?r$/i.test(o.name)) handR = o;
      if (o.isBone && !handL && /left.*hand|hand[._]?l$/i.test(o.name)) handL = o;
      if (o.isMesh) { o.castShadow = true; if (!bodyMat) { bodyMat = o.material = o.material.clone(); bodyMat.color && bodyMat.color.set(color); } }
    });
    return { root, clips, handR: handR || root, handL: handL || root, bodyMat: bodyMat || mat(color), baseScale: 1 };
  }

  // ----- 사람 리그: 관절(Bone) 위에 몸통·목·얼굴·머리카락·손·장화 등을 얹은 로우폴리 인체. 발이 y=0, 정면이 +Z -----
  // 사람마다 피부색·머리색·머리 모양이 다르고(seed), 역할별 복장(병사: 사슬 + 튜닉 + 견갑 / 궁수: 후드 + 화살통 / 시민: 셔츠 / 주인공: 망토 / 적: 두건 + 복면)이 붙는다.
  const skinMat = mat(0xf1c9a0), darkMat = mat(0x3a2a22), eyeMat = new THREE.MeshBasicMaterial({ color: 0xff3a1a }), visorMat = mat(0x2a2a30);
  const SKINS = [0xf1c9a0, 0xe3b48a, 0xc88b63, 0x8d5a3b].map(mat), HAIRS = [0x2a1a10, 0x5a3a1e, 0x8a5a2b, 0xc9a23a, 0x9a9a9a, 0x151515].map(mat);
  const bootMat = mat(0x2b1d14), beltMat = mat(0x4a3320), buckleMat = mat(0xc9a23a), steelMat = mat(0x8e939d), mailMat = mat(0x5d626c), eyeDark = new THREE.MeshBasicMaterial({ color: 0x1a1210 });
  const PANTS = { citizen: mat(0x6b5a44), melee: mat(0x34373f), archer: mat(0x3f4a34), player: mat(0x3a2a22), enemy: mat(0x2a2024) };
  const hashPick = (arr, seed, k) => arr[(Math.imul((seed | 0) ^ Math.imul(k + 1, 0x9e3779b1), 2654435761) >>> 0) % arr.length];
  const RG = {
    hips: new THREE.BoxGeometry(0.42, 0.18, 0.26), chest: new THREE.BoxGeometry(0.5, 0.34, 0.28), waist: new THREE.BoxGeometry(0.4, 0.26, 0.24),
    belt: new THREE.BoxGeometry(0.43, 0.06, 0.27), buckle: new THREE.BoxGeometry(0.07, 0.06, 0.02), neck: new THREE.CylinderGeometry(0.07, 0.08, 0.12, 6),
    head: new THREE.SphereGeometry(0.2, 10, 8), eye: new THREE.BoxGeometry(0.035, 0.04, 0.02), nose: new THREE.BoxGeometry(0.03, 0.045, 0.045),
    hairCap: new THREE.SphereGeometry(0.215, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.55), hairBack: new THREE.BoxGeometry(0.3, 0.34, 0.1), beard: new THREE.BoxGeometry(0.2, 0.1, 0.08),
    hood: new THREE.SphereGeometry(0.235, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.68), mask: new THREE.BoxGeometry(0.2, 0.1, 0.06),
    shoulder: new THREE.SphereGeometry(0.095, 8, 6), pauldron: new THREE.SphereGeometry(0.135, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), spike: new THREE.ConeGeometry(0.04, 0.16, 5),
    upper: new THREE.CylinderGeometry(0.075, 0.065, 0.3, 6), lower: new THREE.CylinderGeometry(0.065, 0.055, 0.3, 6), hand: new THREE.SphereGeometry(0.07, 6, 5),
    thigh: new THREE.CylinderGeometry(0.105, 0.085, 0.45, 6), shin: new THREE.CylinderGeometry(0.085, 0.07, 0.45, 6), shaft: new THREE.CylinderGeometry(0.09, 0.085, 0.15, 6), boot: new THREE.BoxGeometry(0.16, 0.1, 0.3),
    tabard: new THREE.BoxGeometry(0.34, 0.52, 0.02), cape: new THREE.BoxGeometry(0.46, 0.9, 0.04), quiver: new THREE.CylinderGeometry(0.07, 0.06, 0.46, 6), tip: new THREE.ConeGeometry(0.03, 0.09, 5), strap: new THREE.BoxGeometry(0.06, 0.62, 0.02), apron: new THREE.BoxGeometry(0.3, 0.3, 0.02),
  };
  function buildStickman(color, opts = {}) {
    const kind = opts.kind || 'citizen', enemy = !!opts.enemy, seed = opts.seed ?? 0, bodyMat = opts.bodyMat || mat(color), root = new THREE.Group();
    const skin = enemy ? mat(0xb59a84) : hashPick(SKINS, seed, 1), hair = hashPick(HAIRS, seed, 2), hstyle = Math.abs(Math.imul(seed | 0, 2246822519) >>> 7) % 3;
    const pants = PANTS[enemy ? 'enemy' : kind] || PANTS.citizen;
    const bone = (name, parent, x, y, z) => { const b = new THREE.Bone(); b.name = name; b.position.set(x, y, z); parent.add(b); return b; };
    const part = (geo, m, parent, x, y, z, shadow = true) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = shadow && !enemy ? true : (shadow && enemy && geo === RG.chest); parent.add(o); return o; };
    const top = kind === 'melee' ? mailMat : bodyMat;                 // 병사는 사슬 갑옷 위에 튜닉(tabard)을 입는다
    const hips = bone('hips', root, 0, 0.9, 0);
    part(RG.hips, pants, hips, 0, 0, 0);
    const spine = bone('spine', hips, 0, 0.05, 0);
    part(RG.waist, top, spine, 0, 0.17, 0); part(RG.chest, top, spine, 0, 0.47, 0);
    part(RG.belt, beltMat, spine, 0, 0.05, 0, false); part(RG.buckle, buckleMat, spine, 0, 0.05, 0.14, false);
    const head = bone('head', spine, 0, 0.66, 0);
    part(RG.neck, skin, head, 0, 0.03, 0, false);
    part(RG.head, skin, head, 0, 0.17, 0);
    part(RG.eye, enemy ? eyeMat : eyeDark, head, -0.07, 0.2, 0.185, false); part(RG.eye, enemy ? eyeMat : eyeDark, head, 0.07, 0.2, 0.185, false);
    part(RG.nose, skin, head, 0, 0.15, 0.2, false);
    // 머리: 후드(궁수·적) 또는 머리카락(그 외)
    if (kind === 'archer' || enemy) {
      const hm = enemy ? mat(0x1a1214) : bodyMat; const h = part(RG.hood, hm, head, 0, 0.17, -0.01, false); h.rotation.x = -0.15;
      if (enemy) part(RG.mask, hm, head, 0, 0.1, 0.19, false);
    } else {
      const h = part(RG.hairCap, hair, head, 0, 0.19, -0.01, false); h.rotation.x = -0.25;
      if (hstyle === 1) part(RG.hairBack, hair, head, 0, 0.08, -0.16, false);
      if (hstyle === 2 && kind !== 'player') part(RG.beard, hair, head, 0, 0.05, 0.15, false);
    }
    // 역할별 복장
    if (kind === 'melee') {
      part(RG.tabard, bodyMat, spine, 0, 0.3, 0.15, false); part(RG.tabard, bodyMat, spine, 0, 0.3, -0.15, false);
    } else if (kind === 'archer') {
      const q = part(RG.quiver, beltMat, spine, 0.1, 0.45, -0.2, false); q.rotation.z = 0.28;
      for (const dx of [-0.03, 0.01, 0.05]) { const t = part(RG.tip, steelMat, spine, 0.1 + dx + 0.12, 0.7, -0.2, false); t.rotation.z = 0.28; }
      const st = part(RG.strap, beltMat, spine, 0, 0.4, 0.145, false); st.rotation.z = -0.55;
    } else if (kind === 'player') {
      part(RG.cape, mat(0x8a2a1c), spine, 0, 0.18, -0.17, false);
    } else if (kind === 'citizen' && Math.abs(seed | 0) % 2 === 0) {
      part(RG.apron, mat(0xd9c9a0), spine, 0, 0.2, 0.13, false);
    }
    const out = { root, bodyMat, head, spine, baseScale: opts.scale ?? 0.9 };
    for (const sx of [-1, 1]) {
      const n = sx < 0 ? 'L' : 'R';
      const sh = bone('shoulder' + n, spine, sx * 0.34, 0.58, 0);
      part(RG.shoulder, top === mailMat ? mailMat : bodyMat, sh, 0, 0, 0);
      part(RG.upper, kind === 'melee' ? mailMat : bodyMat, sh, 0, -0.15, 0);
      if (kind === 'melee') part(RG.pauldron, steelMat, sh, 0, 0.03, 0, false);
      if (enemy) { const sp = part(RG.spike, mat(0x2a2024), sh, sx * 0.06, 0.14, 0, false); sp.rotation.z = -sx * 0.35; }
      const el = bone('elbow' + n, sh, 0, -0.3, 0);
      part(RG.lower, kind === 'melee' ? steelMat : skin, el, 0, -0.15, 0, false);
      out['hand' + n] = bone('hand' + n, el, 0, -0.3, 0);
      part(RG.hand, skin, out['hand' + n], 0, 0, 0, false);
      const hp = bone('hip' + n, hips, sx * 0.14, -0.04, 0);
      part(RG.thigh, pants, hp, 0, -0.225, 0);
      const kn = bone('knee' + n, hp, 0, -0.45, 0);
      part(RG.shin, pants, kn, 0, -0.225, 0);
      part(RG.shaft, bootMat, kn, 0, -0.34, 0, false);
      part(RG.boot, bootMat, kn, 0, -0.43, 0.06, false);
    }
    out.clips = STICK_CLIPS;
    return out;
  }

  // ----- 코드로 만든 애니메이션 클립 (모든 뼈에 키를 둬서 CrossFade 때 자세가 남지 않게 한다) -----
  const BONES = ['hips', 'spine', 'head', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'hipL', 'hipR', 'kneeL', 'kneeR'];
  const kf = (u, pts) => {                   // pts: [[u, value], ...] 선형 보간
    for (let i = 1; i < pts.length; i++) if (u <= pts[i][0]) { const [a, va] = pts[i - 1], [b, vb] = pts[i]; return va + (vb - va) * (b === a ? 1 : (u - a) / (b - a)); }
    return pts[pts.length - 1][1];
  };
  const STICK_CLIPS = (() => {
    const clips = {}, eul = new THREE.Euler(), q = new THREE.Quaternion();
    // fn(ph, u) -> { 뼈이름: [x, y, z], hipsY, hipsZ }. 루프 클립은 ph=0..2π, 1회 클립은 u=0..1
    const make = (name, T, n, fn, loop = true) => {
      const times = [], rot = {}, pos = [];
      for (const b of BONES) rot[b] = [];
      for (let i = 0; i <= n; i++) {
        const u = i / n, f = fn(u * Math.PI * 2, u);
        times.push(u * T);
        for (const b of BONES) { const v = f[b] || [0, 0, 0]; eul.set(v[0] || 0, v[1] || 0, v[2] || 0); q.setFromEuler(eul); rot[b].push(q.x, q.y, q.z, q.w); }
        pos.push(0, f.hipsY ?? 0.9, f.hipsZ ?? 0);
      }
      const tracks = BONES.map(b => new THREE.QuaternionKeyframeTrack(b + '.quaternion', times, rot[b]));
      tracks.push(new THREE.VectorKeyframeTrack('hips.position', times, pos));
      clips[name] = new THREE.AnimationClip(name, T, tracks);
    };
    make('idle', 2.4, 8, ph => { const s = Math.sin(ph); return { spine: [0.02 * s], head: [-0.02 * s], shoulderL: [0.05 + 0.05 * s], shoulderR: [0.05 - 0.05 * s], elbowL: [-0.25], elbowR: [-0.25], hipsY: 0.9 + 0.006 * s }; });
    const gait = (T, A, K, B, E, lean, bob) => ph => {
      const s = Math.sin(ph), c = Math.cos(ph);
      return { hipL: [-s * A], hipR: [s * A], kneeL: [Math.max(0, c) * K], kneeR: [Math.max(0, -c) * K], shoulderL: [s * B], shoulderR: [-s * B],
        elbowL: [-E], elbowR: [-E], spine: [lean, s * 0.07], head: [-lean * 0.5], hipsY: 0.9 - lean * 0.1 + Math.cos(2 * ph) * bob };
    };
    make('walk', 0.9, 12, gait(0.9, 0.55, 0.75, 0.4, 0.35, 0.05, 0.02));
    make('run', 0.55, 12, gait(0.55, 0.95, 1.5, 1.0, 1.2, 0.22, 0.05));
    make('gather', 0.9, 14, (ph, u) => {       // 곡괭이질: 들어 올림 → 내려찍기 → 반동
      const v = u < 0.7 ? Math.sin(u / 0.7 * Math.PI / 2) : u < 0.8 ? 1 - (u - 0.7) / 0.1 : 0;
      const a = -0.5 - 2.1 * v, e = -0.3 - 0.6 * v;
      return { shoulderR: [a], shoulderL: [a * 0.9], elbowR: [e], elbowL: [e], spine: [0.35 - 0.45 * v], head: [0.1], kneeL: [0.25], kneeR: [0.25], hipL: [-0.1], hipR: [-0.1], hipsY: 0.86 };
    });
    make('attackSword', 0.5, 10, (ph, u) => {  // 검 휘두르기: 뒤로 젖힘 → 내려베기 → 복귀
      const w = kf(u, [[0, 0], [0.3, 1], [0.45, -0.25], [1, 0]]);
      return { shoulderR: [-2.3 * Math.max(0, w) + 0.6 * Math.min(0, w), -0.3 * w], elbowR: [-0.7 * Math.max(0, w) - 0.1], spine: [-0.1 * w + 0.2 * Math.min(0, w), 0.45 * w], shoulderL: [-0.3 * w], hipL: [-0.3 * w], hipR: [0.3 * w], head: [0, -0.2 * w] };
    }, false);
    make('attackBow', 0.45, 10, (ph, u) => {   // 활 쏘기: 조준 → 시위를 당김 → 발사
      const aim = kf(u, [[0, 0], [0.2, 1], [0.7, 1], [1, 0]]), draw = kf(u, [[0, 0], [0.2, -1.9], [0.55, -2.3], [0.62, -0.5], [1, 0]]);
      return { shoulderL: [-1.5 * aim], elbowL: [-0.08 * aim], shoulderR: [-1.5 * aim], elbowR: [draw], spine: [0, -0.35 * aim], head: [0, 0.35 * aim], hipL: [0, 0, 0.1 * aim], hipR: [0, 0, -0.1 * aim] };
    }, false);
    make('die', 0.9, 9, (ph, u) => {           // 뒤로 쓰러져 눕기
      const f = kf(u, [[0, 0], [0.7, 1], [1, 1]]);
      return { hips: [-1.5 * f], hipsY: 0.9 - 0.78 * f, hipsZ: -0.2 * f, shoulderL: [0.3 * f, 0, 0.5 * f], shoulderR: [0.3 * f, 0, -0.5 * f], kneeL: [0.25 * f], kneeR: [0.2 * f], head: [0.2 * f] };
    }, false);
    make('sit', 3, 8, ph => { const s = Math.sin(ph); return { hipL: [-1.5], hipR: [-1.5], kneeL: [0.12], kneeR: [0.12], spine: [0.12 + 0.015 * s], head: [0.1 - 0.04 * s], shoulderL: [-0.5], shoulderR: [-0.5], elbowL: [-0.9], elbowR: [-0.9], hipsY: 0.2 }; });
    return clips;
  })();

  // ----- 짐승: 네발 리그 (몸통/머리/꼬리/다리 4개 Bone) -----
  const BEAST_CLIPS = (() => {
    const clips = {}, eul = new THREE.Euler(), q = new THREE.Quaternion(), B = ['body', 'headB', 'tail', 'legFL', 'legFR', 'legBL', 'legBR'];
    const make = (name, T, n, fn) => {
      const times = [], rot = {}, pos = [];
      for (const b of B) rot[b] = [];
      for (let i = 0; i <= n; i++) {
        const u = i / n, f = fn(u * Math.PI * 2, u);
        times.push(u * T);
        for (const b of B) { const v = f[b] || [0, 0, 0]; eul.set(v[0] || 0, v[1] || 0, v[2] || 0); q.setFromEuler(eul); rot[b].push(q.x, q.y, q.z, q.w); }
        pos.push(0, f.y ?? 0.62, f.z ?? 0);
      }
      const tracks = B.map(b => new THREE.QuaternionKeyframeTrack(b + '.quaternion', times, rot[b]));
      tracks.push(new THREE.VectorKeyframeTrack('body.position', times, pos));
      clips[name] = new THREE.AnimationClip(name, T, tracks);
    };
    make('idle', 2, 8, ph => ({ y: 0.62 + 0.01 * Math.sin(ph), headB: [0.05 * Math.sin(ph)], tail: [0, 0.3 * Math.sin(ph * 2)] }));
    make('walk', 0.5, 8, ph => { const s = Math.sin(ph); return { y: 0.62 + Math.abs(Math.cos(ph)) * 0.04, legFL: [s * 0.7], legBR: [s * 0.7], legFR: [-s * 0.7], legBL: [-s * 0.7], tail: [0, s * 0.35], headB: [0.1 * Math.cos(ph * 2)] }; });
    make('attackSword', 0.45, 9, (ph, u) => {       // 물어뜯기: 몸을 낮췄다가 앞으로 도약
      const w = kf(u, [[0, 0], [0.3, -1], [0.5, 1], [1, 0]]);
      return { y: 0.62 + 0.1 * Math.max(0, w) - 0.1 * Math.max(0, -w), z: 0.35 * Math.max(0, w), headB: [0.6 * Math.max(0, w) - 0.2 * Math.max(0, -w)], body: [-0.2 * Math.max(0, -w)], legFL: [-0.5 * Math.max(0, w)], legFR: [-0.5 * Math.max(0, w)] };
    });
    make('die', 0.7, 8, (ph, u) => { const f = kf(u, [[0, 0], [0.6, 1], [1, 1]]); return { y: 0.62 - 0.35 * f, body: [0, 0, 1.45 * f], legFL: [0.6 * f], legFR: [0.5 * f], legBL: [-0.5 * f], legBR: [-0.4 * f] }; });
    return clips;
  })();
  function buildBeast(color, opts = {}) {
    const bodyMat = opts.bodyMat || mat(color), root = new THREE.Group();
    const bone = (name, parent, x, y, z) => { const b = new THREE.Bone(); b.name = name; b.position.set(x, y, z); parent.add(b); return b; };
    const part = (geo, m, parent, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = false; parent.add(o); return o; };
    const body = bone('body', root, 0, 0.62, 0);
    part(new THREE.BoxGeometry(0.55, 0.42, 1.0), bodyMat, body, 0, 0, 0).castShadow = true;
    const head = bone('headB', body, 0, 0.12, 0.55);
    part(new THREE.BoxGeometry(0.36, 0.3, 0.36), bodyMat, head, 0, 0.04, 0.1);
    part(new THREE.BoxGeometry(0.2, 0.14, 0.22), darkMat, head, 0, -0.03, 0.34);
    part(new THREE.BoxGeometry(0.3, 0.05, 0.05), eyeMat, head, 0, 0.12, 0.29);
    for (const sx of [-1, 1]) part(new THREE.ConeGeometry(0.07, 0.18, 4), bodyMat, head, sx * 0.13, 0.25, 0.02);
    const tail = bone('tail', body, 0, 0.1, -0.5);
    part(new THREE.ConeGeometry(0.08, 0.5, 5), bodyMat, tail, 0, 0, -0.25).rotation.x = -Math.PI / 2;
    for (const [n, x, z] of [['legFL', -1, 1], ['legFR', 1, 1], ['legBL', -1, -1], ['legBR', 1, -1]]) {
      const leg = bone(n, body, x * 0.2, -0.18, z * 0.38);
      part(new THREE.CylinderGeometry(0.07, 0.06, 0.46, 5), darkMat, leg, 0, -0.23, 0);
    }
    return { root, bodyMat, head, spine: null, handR: head, handL: head, baseScale: opts.scale ?? 1.5, clips: BEAST_CLIPS };
  }

  // ----- 장비 메쉬 (손 뼈에 붙는다): 칼날이 팔 방향(+Z)으로 향하도록 inner.rotation.x = π/2 -----
  const gearMatCache = {};
  const gearMat = (id, color) => gearMatCache[id] || (gearMatCache[id] = new THREE.MeshStandardMaterial({ color, flatShading: true, metalness: 0.5, roughness: 0.4 }));
  function makeSwordMesh(def) {
    const g = new THREE.Group(), inner = new THREE.Group(), len = def.tier > 0 ? 1.05 : 0.8;
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 6), darkMat);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(def.tier > 0 ? 0.34 : 0.26, 0.05, 0.07), gearMat('guard' + def.tier, def.tier > 0 ? 0xc9a23a : 0x6a5a48));
    const blade = new THREE.Mesh(new THREE.BoxGeometry(def.tier > 0 ? 0.09 : 0.07, len, 0.025), gearMat(def.id, def.color));
    guard.position.y = 0.12; blade.position.y = 0.145 + len / 2;
    inner.add(grip, guard, blade); inner.rotation.x = Math.PI / 2; g.add(inner);
    return g;
  }
  function makeBowMesh(def) {
    const g = new THREE.Group(), pivot = new THREE.Group(), R0 = def.tier > 0 ? 0.55 : 0.45;
    const arcGeo = new THREE.TorusGeometry(R0, def.tier > 0 ? 0.04 : 0.028, 6, 14, Math.PI); arcGeo.rotateZ(Math.PI);     // 불룩한 쪽이 -Y
    const arc = new THREE.Mesh(arcGeo, gearMat(def.id, def.color)); arc.rotation.y = Math.PI / 2;                          // 활의 긴 축이 Z
    const string = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, R0 * 2), gearMat('string', 0xe8e0c8));
    pivot.add(arc, string);
    if (def.tier > 0) { const tip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), gearMat('bowtip', 0xd9d9e0)); tip.position.set(0, -R0 * 0.1, R0); const tip2 = tip.clone(); tip2.position.z = -R0; pivot.add(tip, tip2); }
    g.add(pivot); g.userData.pivot = pivot; pivot.rotation.x = -Math.PI / 2;           // 평소엔 세워서 든다
    return g;
  }
  function makeArmorIcon(def) {
    const g = new THREE.Group(), body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.2), gearMat(def.id, def.color)), cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55), gearMat(def.id, def.color));
    cap.position.y = 0.4; g.add(body, cap);
    return g;
  }
  function makePickMesh() {
    const g = new THREE.Group(), inner = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6), gearMat('woodpick', 0x7a5530)), head = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.55), gearMat('ironpick', 0x9a9da4));
    handle.position.y = 0.3; head.position.y = 0.78;
    inner.add(handle, head); inner.rotation.x = Math.PI / 2; g.add(inner);
    return g;
  }

  // ----- 리그 공용 API: setGear / hold / aim -----
  function makeRig(kind, color, opts = {}) {
    const rig = modelCache[kind] ? rigFromGltf(modelCache[kind], color) : kind === 'beast' ? buildBeast(color, opts) : buildStickman(color, { kind, ...opts });
    rig.kind = kind; rig.main = null; rig.held = null; rig.meshes = {};
    rig.root.scale.setScalar(rig.baseScale);
    rig.setGear = (slot, def) => {             // slot: 'sword'(오른손) | 'bow'(왼손). def가 없으면 비운다
      const hand = slot === 'sword' ? rig.handR : rig.handL;
      if (rig.meshes[slot]) hand.remove(rig.meshes[slot]);
      rig.meshes[slot] = def ? (slot === 'sword' ? makeSwordMesh(def) : makeBowMesh(def)) : null;
      if (rig.meshes[slot]) hand.add(rig.meshes[slot]);
      rig.applyHold();
    };
    rig.applyHold = () => {
      const w = rig.held, m = rig.meshes;
      if (m.sword) m.sword.visible = w === 'sword';
      if (m.bow) m.bow.visible = w === 'bow';
      if (!m.pick) { m.pick = makePickMesh(); rig.handR.add(m.pick); }
      m.pick.visible = w === 'pick';
    };
    rig.hold = (what) => { rig.held = what; rig.applyHold(); };
    rig.setArmor = (def) => {                  // 흉갑 + 투구 (몸통/머리 뼈에 부착). 상위 등급은 금색 허리띠
      if (rig.armorMeshes) for (const o of rig.armorMeshes) o.parent && o.parent.remove(o);
      rig.armorMeshes = [];
      if (!def || !def.tier || !rig.spine) return;
      const m = gearMat(def.id, def.color), add = (geo, parent, x, y, z, mm = m) => { const o = new THREE.Mesh(geo, mm); o.position.set(x, y, z); o.castShadow = true; parent.add(o); rig.armorMeshes.push(o); return o; };
      add(new THREE.BoxGeometry(0.56, 0.5, 0.34), rig.spine, 0, 0.38, 0);
      add(new THREE.BoxGeometry(0.18, 0.1, 0.38), rig.spine, -0.3, 0.6, 0); add(new THREE.BoxGeometry(0.18, 0.1, 0.38), rig.spine, 0.3, 0.6, 0);
      add(new THREE.SphereGeometry(0.235, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), rig.head, 0, 0.19, 0);
      if (def.tier > 1) { add(new THREE.BoxGeometry(0.6, 0.06, 0.38), rig.spine, 0, 0.14, 0, gearMat('gold', 0xd9a92a)); add(new THREE.BoxGeometry(0.04, 0.16, 0.3), rig.head, 0, 0.42, 0, gearMat('gold', 0xd9a92a)); }
    };
    rig.aim = (on) => { const b = rig.meshes.bow; if (b) b.userData.pivot.rotation.x = on ? 0 : -Math.PI / 2; };
    return rig;
  }

  // ----- Anim: AnimationMixer + CrossFade 상태 머신 (base 상태 + 1회성 동작) -----
  class Anim {
    constructor(rig) {
      this.rig = rig; this.mixer = new THREE.AnimationMixer(rig.root); this.acts = {};
      for (const [n, clip] of Object.entries(rig.clips)) {
        const a = this.mixer.clipAction(clip);
        if (n === 'attackSword' || n === 'attackBow' || n === 'die') { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = n === 'die'; }
        this.acts[n] = a;
      }
      this.cur = null; this.baseName = ''; this.shot = null; this.dead = false;
      this.base('idle');
    }
    _play(name, fade, force) {
      const next = this.acts[name] || this.acts.idle;
      if (!next || (next === this.cur && !force)) return;
      next.reset(); next.enabled = true; next.setEffectiveWeight(1);
      if (this.cur && this.cur !== next) { next.fadeIn(fade); this.cur.fadeOut(fade); }
      next.play(); this.cur = next;
    }
    base(name, speed = 0) {
      if (this.dead) return;
      if (name !== this.baseName) { this.baseName = name; if (!this.shot) this._play(name, 0.2); }
      const a = this.acts[name];
      if (a && !this.shot) a.timeScale = name === 'walk' ? Math.min(1.6, Math.max(0.5, speed / 2.2)) : name === 'run' ? Math.min(1.4, Math.max(0.7, speed / 5.5)) : 1;
    }
    once(name) {
      if (this.dead || !this.acts[name]) return;
      this.shot = { t: 0, dur: this.acts[name].getClip().duration };
      if (name === 'attackBow') this.rig.aim(true);
      this._play(name, 0.08, true);
    }
    die() { this.dead = true; this.shot = null; this.rig.aim(false); this._play('die', 0.15, true); }
    revive() { this.dead = false; this.baseName = ''; this.base('idle'); }
    update(dt) {
      if (this.shot && (this.shot.t += dt) >= this.shot.dur) { this.shot = null; this.rig.aim(false); this._play(this.baseName || 'idle', 0.15, true); }
      const want = this.baseName === 'gather' && !this.shot ? 'pick' : this.rig.main;
      if (want !== this.rig.held) this.rig.hold(want);
      this.mixer.update(dt);
    }
  }

