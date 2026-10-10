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

  // ----- 사람 리그 (정교한 로우폴리): 관절(Bone) 위에 둥근 몸통·팔다리·관절·얼굴(눈·눈썹·귀·코·입)·머리 모양 6종·복장·장구를 얹는다. 발이 y=0, 정면이 +Z -----
  // 같은 뼈 + 같은 재질의 조각은 하나의 메시로 합쳐서(draw call 절약) 디테일이 늘어도 그리는 비용은 거의 그대로다.
  // 사람마다 피부색·머리색·머리 모양·체형·옷 장식이 다르고(seed), 역할별 복장(병사: 사슬 + 튜닉 + 견갑 + 투구 / 궁수: 후드 + 화살통 + 가죽 조끼 / 시민: 튜닉 + 모자 / 주인공: 망토 + 머리띠 / 적: 두건 + 복면 + 누더기)이 붙는다.
  const skinMat = mat(0xf1c9a0), darkMat = mat(0x3a2a22), eyeMat = new THREE.MeshBasicMaterial({ color: 0xff3a1a }), visorMat = mat(0x2a2a30);
  const sm = (c, rough = 0.88, metal = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal });
  const SKINS = [0xf1c9a0, 0xe3b48a, 0xc88b63, 0x8d5a3b, 0xf4d6b8].map(c => sm(c, 0.8)), HAIRS = [0x2a1a10, 0x5a3a1e, 0x8a5a2b, 0xc9a23a, 0x9a9a9a, 0x151515, 0x7a2a1a].map(c => sm(c, 0.7));
  const bootMat = sm(0x2b1d14), beltMat = sm(0x4a3320), buckleMat = sm(0xc9a23a, 0.5, 0.3), steelMat = sm(0x9ca2ad, 0.55, 0.25), mailMat = sm(0x626874, 0.65, 0.2), eyeDark = new THREE.MeshBasicMaterial({ color: 0x1a1210 }), eyeWhite = new THREE.MeshBasicMaterial({ color: 0xf2eee6 });
  const leatherMat = sm(0x6a4a2c), cottonMat = sm(0xd9c9a0), goldMat = sm(0xd9a92a, 0.5, 0.3), redMat = sm(0x8a2a1c), mouthMat = new THREE.MeshBasicMaterial({ color: 0x7a3a30 }), strawMat = sm(0xd9b45a), ragMat = sm(0x2a2024), rustMat = sm(0x4a3a36, 0.7, 0.2);
  const PANTS = { citizen: sm(0x6b5a44), melee: sm(0x34373f), archer: sm(0x3f4a34), player: sm(0x3a2a22), enemy: sm(0x2a2024) };
  const emblemMat = (() => {                                  // 병사 튜닉의 문장 (마을의 등불)
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d');
    c.fillStyle = 'rgba(0,0,0,0)'; c.fillRect(0, 0, 64, 64); c.fillStyle = '#f2d27a'; c.strokeStyle = '#3a2a10'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(32, 6); c.lineTo(52, 30); c.lineTo(32, 58); c.lineTo(12, 30); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#c0392b'; c.beginPath(); c.arc(32, 32, 9, 0, 7); c.fill();
    return new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, roughness: 0.9, side: THREE.DoubleSide });
  })();
  let Q = 1;                                                    // 분할 정밀도: 적은 0.5로 만들어 삼각형 수를 줄인다
  const cyl = (rt, rb, h, seg = 12, open = false) => new THREE.CylinderGeometry(rt, rb, h, Math.max(6, Math.round(seg * Q)), 1, open), sph = (r, w = 14, h = 10, ps = 0, pl = Math.PI * 2, ts = 0, tl = Math.PI) => new THREE.SphereGeometry(r, Math.max(6, Math.round(w * Q)), Math.max(4, Math.round(h * Q)), ps, pl, ts, tl);
  const makeRG = () => ({
    pelvis: cyl(0.2, 0.215, 0.22, 14), waist: cyl(0.2, 0.17, 0.28, 14), chest: cyl(0.275, 0.2, 0.38, 16), yoke: sph(0.16, 12, 8), belt: cyl(0.208, 0.208, 0.06, 14), buckle: new THREE.BoxGeometry(0.07, 0.06, 0.02),
    neck: cyl(0.062, 0.075, 0.14, 10), head: sph(0.19, 18, 14), jaw: sph(0.13, 14, 10), ear: sph(0.035, 8, 6), eyeW: sph(0.033, 10, 8), pupil: sph(0.019, 8, 6), brow: new THREE.BoxGeometry(0.075, 0.016, 0.022), nose: sph(0.026, 8, 6), mouth: new THREE.BoxGeometry(0.07, 0.013, 0.01),
    hairCap: sph(0.205, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hairLong: cyl(0.16, 0.115, 0.42, 12), ball: sph(0.08, 10, 8), curl: sph(0.085, 8, 6), tail: new THREE.ConeGeometry(0.05, 0.32, 8), beard: sph(0.1, 10, 8), stache: new THREE.BoxGeometry(0.1, 0.022, 0.03),
    hood: sph(0.235, 20, 12, Math.PI / 2 + 0.8, Math.PI * 2 - 1.6, 0, Math.PI * 0.72), cowl: cyl(0.2, 0.29, 0.15, 14), mask: new THREE.BoxGeometry(0.2, 0.1, 0.06),
    shoulder: sph(0.08, 18, 12), pauldron: sph(0.145, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), spike: new THREE.ConeGeometry(0.04, 0.16, 6),
    upper: cyl(0.072, 0.058, 0.3, 10), elbow: sph(0.06, 14, 10), lower: cyl(0.056, 0.044, 0.3, 10), cuff: cyl(0.062, 0.062, 0.05, 10), bracer: cyl(0.065, 0.055, 0.15, 10), palm: sph(0.055, 12, 10), thumb: sph(0.022, 6, 5),
    thigh: cyl(0.105, 0.078, 0.46, 12), knee: sph(0.082, 16, 12), shin: cyl(0.076, 0.055, 0.44, 10), shaft: cyl(0.07, 0.082, 0.2, 10), foot: sph(0.1, 12, 8), sole: new THREE.BoxGeometry(0.15, 0.03, 0.32), greave: cyl(0.085, 0.065, 0.3, 10), cuffBoot: cyl(0.09, 0.09, 0.04, 10),
    skirt: cyl(0.23, 0.3, 0.26, 16), tabard: new THREE.BoxGeometry(0.32, 0.56, 0.03), emblem: new THREE.PlaneGeometry(0.2, 0.2), cape: new THREE.BoxGeometry(0.44, 0.42, 0.04), quiver: cyl(0.075, 0.06, 0.5, 10), fletch: new THREE.BoxGeometry(0.03, 0.09, 0.012), strap: new THREE.BoxGeometry(0.06, 0.62, 0.02),
    apron: new THREE.BoxGeometry(0.3, 0.36, 0.02), pouch: new THREE.BoxGeometry(0.1, 0.1, 0.06), lace: new THREE.BoxGeometry(0.1, 0.015, 0.012), collar: new THREE.TorusGeometry(0.13, 0.035, 8, 16), band: new THREE.TorusGeometry(0.2, 0.016, 6, 18), brim: cyl(0.31, 0.31, 0.02, 18), dome: sph(0.2, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), helm: sph(0.235, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), helmBrim: cyl(0.29, 0.29, 0.025, 18), nasal: new THREE.BoxGeometry(0.025, 0.12, 0.02),
    scabbard: new THREE.BoxGeometry(0.06, 0.62, 0.035), rag: new THREE.BoxGeometry(0.09, 0.3, 0.012), wrap: cyl(0.062, 0.062, 0.08, 8), spikeBig: new THREE.ConeGeometry(0.05, 0.22, 6),
  });
  const RG_HI = makeRG(); Q = 0.5; const RG_LO = makeRG(); Q = 1;
  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _v = new THREE.Vector3(), _n3 = new THREE.Matrix3();
  function mergeGeos(items) {                                   // [[geometry, matrix], ...] -> 하나의 BufferGeometry (위치·법선·uv)
    let nv = 0, ni = 0;
    for (const [g] of items) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let vo = 0, io = 0;
    for (const [g, m] of items) {
      const p = g.attributes.position, n = g.attributes.normal, t = g.attributes.uv; _n3.getNormalMatrix(m);
      for (let i = 0; i < p.count; i++) {
        _v.fromBufferAttribute(p, i).applyMatrix4(m); const k = (vo + i) * 3; pos[k] = _v.x; pos[k + 1] = _v.y; pos[k + 2] = _v.z;
        _v.fromBufferAttribute(n, i).applyMatrix3(_n3).normalize(); nor[k] = _v.x; nor[k + 1] = _v.y; nor[k + 2] = _v.z;
        if (t) { uv[(vo + i) * 2] = t.getX(i); uv[(vo + i) * 2 + 1] = t.getY(i); }
      }
      if (g.index) for (let i = 0; i < g.index.count; i++) idx[io++] = g.index.getX(i) + vo; else for (let i = 0; i < p.count; i++) idx[io++] = vo + i;
      vo += p.count;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); out.setIndex(new THREE.BufferAttribute(idx, 1));
    return out;
  }
  function buildStickman(color, opts = {}) {
    const kind = opts.kind || 'citizen', enemy = !!opts.enemy, seed = opts.seed ?? 0, bodyMat = opts.bodyMat || mat(color), root = new THREE.Group(), RG = enemy ? RG_LO : RG_HI;
    const R = (k) => ((Math.imul((seed | 0) ^ Math.imul(k + 1, 0x9e3779b1), 2654435761) >>> 0) % 1000) / 1000;            // 사람마다 고정된 0~1 난수
    if (!enemy) { bodyMat.flatShading = false; bodyMat.roughness = 0.88; bodyMat.needsUpdate = true; }
    const skin = enemy ? sm(0xb59a84, 0.8) : SKINS[Math.floor(R(1) * SKINS.length)], hair = HAIRS[Math.floor(R(2) * HAIRS.length)], hstyle = Math.floor(R(3) * 6);
    const pants = PANTS[enemy ? 'enemy' : kind] || PANTS.citizen;
    const cloth2 = sm(bodyMat.color.clone().multiplyScalar(0.72), 0.9);        // 옷의 보조 색(칼라·소매 끝·모자)
    const W = enemy ? 1.05 : 0.93 + 0.14 * R(8), isPlayer = kind === 'player';          // 체형(어깨 너비)
    const bones = {}, groups = new Map();
    const bone = (name, parent, x, y, z) => { const b = new THREE.Bone(); b.name = name; b.position.set(x, y, z); parent.add(b); bones[name] = b; return b; };
    const part = (geo, m, b, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
      _e.set(rx, ry, rz); _q.setFromEuler(_e); _m4.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
      const key = b.name + '|' + m.uuid; let g = groups.get(key); if (!g) groups.set(key, g = { b, m, items: [] }); g.items.push([geo, _m4.clone()]);
    };
    const top = kind === 'melee' ? mailMat : bodyMat;
    const hips = bone('hips', root, 0, 0.9, 0);
    part(RG.pelvis, pants, hips, 0, 0, 0, 0, 0, 0, W, 1, 0.7);
    const spine = bone('spine', hips, 0, 0.05, 0);
    part(RG.waist, top, spine, 0, 0.17, 0, 0, 0, 0, W, 1, 0.72); part(RG.chest, top, spine, 0, 0.47, 0, 0, 0, 0, W, 1, 0.6); part(RG.yoke, top, spine, 0, 0.64, 0, 0, 0, 0, 1.55 * W, 0.45, 0.85);
    part(RG.belt, beltMat, spine, 0, 0.05, 0, 0, 0, 0, W, 1, 0.72); part(RG.buckle, buckleMat, spine, 0, 0.05, 0.158 * 0.9 + 0.01);
    const head = bone('head', spine, 0, 0.66, 0);
    part(RG.neck, skin, head, 0, 0.03, 0);
    part(RG.head, skin, head, 0, 0.17, 0, 0, 0, 0, 0.93, 1.06, 1); part(RG.jaw, skin, head, 0, 0.07, 0.035, 0, 0, 0, 0.95, 0.7, 0.95);
    for (const sx of [-1, 1]) {
      part(RG.ear, skin, head, sx * 0.182, 0.17, 0, 0, 0, 0, 0.5, 1, 0.8);
      if (enemy) part(RG.eyeW, eyeMat, head, sx * 0.07, 0.2, 0.172, 0, 0, 0, 1.1, 0.8, 0.6);
      else { part(RG.eyeW, eyeWhite, head, sx * 0.07, 0.2, 0.172, 0, 0, 0, 1, 0.85, 0.5); part(RG.pupil, eyeDark, head, sx * 0.07, 0.2, 0.186); part(RG.brow, enemy ? ragMat : hair, head, sx * 0.07, 0.245, 0.178, 0, 0, -sx * 0.18); }
    }
    part(RG.nose, skin, head, 0, 0.15, 0.2, 0, 0, 0, 0.9, 1.1, 1.3);
    if (!enemy) part(RG.mouth, mouthMat, head, 0, 0.095, 0.183);
    // 머리: 후드(궁수·적) 또는 6가지 머리 모양 + 수염
    if (kind === 'archer' || enemy) {
      const hm = enemy ? ragMat : bodyMat; if (!enemy) part(RG.hairCap, hair, head, 0, 0.185, 0.0, -0.1, 0, 0, 0.97, 0.97, 0.97); part(RG.hood, hm, head, 0, 0.17, -0.01, -0.15); part(RG.cowl, hm, spine, 0, 0.62, 0, 0, 0, 0, W, 1, 0.8);
      if (enemy) part(RG.mask, ragMat, head, 0, 0.1, 0.185);
    } else {
      if (hstyle !== 5) part(RG.hairCap, hair, head, 0, 0.19, -0.01, -0.25);
      if (hstyle === 1) { part(RG.hairLong, hair, head, 0, 0.04, -0.1, 0, 0, 0, 1, 1, 0.55); for (const sx of [-1, 1]) part(RG.ball, hair, head, sx * 0.17, 0.12, 0.0, 0, 0, 0, 0.7, 1.3, 0.8); }
      if (hstyle === 2) { part(RG.ball, hair, head, 0, 0.22, -0.19, 0, 0, 0, 0.9, 0.9, 0.9); part(RG.tail, hair, head, 0, 0.06, -0.24, 0.35, Math.PI); }
      if (hstyle === 3) part(RG.ball, hair, head, 0, 0.38, -0.07);
      if (hstyle === 4) for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; part(RG.curl, hair, head, Math.cos(a) * 0.15, 0.27 + (i % 2) * 0.04, Math.sin(a) * 0.15 - 0.02); }
      if (hstyle === 5 || R(4) < 0.3) { if (!isPlayer || hstyle === 5) { part(RG.beard, hair, head, 0, 0.045, 0.115, 0, 0, 0, 1, 0.7, 0.7); part(RG.stache, hair, head, 0, 0.118, 0.2); } }
    }
    // 역할별 복장
    if (kind === 'melee') {
      part(RG.tabard, bodyMat, spine, 0, 0.3, 0.17 * W); part(RG.tabard, bodyMat, spine, 0, 0.3, -0.17 * W); part(RG.emblem, emblemMat, spine, 0, 0.4, 0.17 * W + 0.02);
      part(RG.helm, steelMat, head, 0, 0.2, 0); part(RG.helmBrim, steelMat, head, 0, 0.22, 0); part(RG.nasal, steelMat, head, 0, 0.17, 0.2);
      part(RG.scabbard, leatherMat, spine, -0.24, -0.1, -0.02, 0, 0, 0.45); part(RG.ball, goldMat, spine, -0.34, -0.38, -0.02, 0, 0, 0, 0.55, 0.55, 0.55);
    } else if (kind === 'archer') {
      part(RG.quiver, leatherMat, spine, 0.1, 0.45, -0.2, 0, 0, 0.28);
      for (const [dx, c] of [[-0.03, redMat], [0.01, cottonMat], [0.05, redMat]]) part(RG.fletch, c, spine, 0.1 + dx + 0.15, 0.73, -0.2, 0, 0, 0.28);
      part(RG.strap, beltMat, spine, 0, 0.4, 0.155 * W, 0, 0, -0.55); part(RG.pouch, leatherMat, spine, -0.22, 0.0, 0.1);
      for (let i = 0; i < 3; i++) part(RG.lace, beltMat, spine, 0, 0.42 + i * 0.07, 0.17 * W + 0.005);
    } else if (isPlayer) {
      part(RG.cape, redMat, spine, 0, 0.5, -0.19 * W, 0.06); part(RG.cape, redMat, spine, 0, 0.1, -0.23 * W, 0.2, 0, 0, 0.95, 1.2, 1);
      part(RG.collar, redMat, spine, 0, 0.66, 0, Math.PI / 2, 0, 0, 1, 1, 1.2); part(RG.ball, goldMat, spine, 0.09, 0.62, 0.15 * W, 0, 0, 0, 0.4, 0.4, 0.4); part(RG.band, redMat, head, 0, 0.27, 0, Math.PI / 2, 0, 0, 1, 1, 1.15);
      part(RG.pauldron, steelMat, spine, -0.34 * W, 0.63, 0);
    } else if (kind === 'citizen') {
      part(RG.skirt, cloth2, hips, 0, -0.14, 0, 0, 0, 0, W, 1, 0.78); part(RG.collar, cloth2, spine, 0, 0.66, 0.0, Math.PI / 2, 0, 0, 1, 1, 1.1);
      const v = Math.floor(R(5) * 4);
      if (v === 0) part(RG.apron, cottonMat, spine, 0, 0.18, 0.14 * W + 0.02);
      if (v === 1) { part(RG.brim, strawMat, head, 0, 0.3, 0, 0.1); part(RG.dome, strawMat, head, 0, 0.3, 0); }
      if (v === 2) part(RG.dome, cloth2, head, 0, 0.26, -0.01, -0.2, 0, 0, 1.12, 1, 1.12);
      if (v === 3) { part(RG.strap, leatherMat, spine, 0, 0.4, 0.155 * W, 0, 0, 0.55); part(RG.pouch, leatherMat, spine, -0.24, 0.0, 0.0); }
    }
    const out = { root, bodyMat, head, spine, baseScale: (opts.scale ?? 0.9) * (enemy || isPlayer ? 1 : 0.95 + 0.1 * R(7)) };
    for (const sx of [-1, 1]) {
      const n = sx < 0 ? 'L' : 'R';
      const sh = bone('shoulder' + n, spine, sx * 0.34 * W, 0.58, 0);
      const sleeve = top === mailMat ? mailMat : bodyMat;
      part(RG.shoulder, sleeve, sh, 0, 0, 0); part(RG.upper, sleeve, sh, 0, -0.15, 0);
      if (kind === 'melee') part(RG.pauldron, steelMat, sh, 0, 0.03, 0);
      if (enemy) { part(RG.spike, rustMat, sh, sx * 0.06, 0.14, 0, 0, 0, -sx * 0.35); part(RG.pauldron, rustMat, sh, 0, 0.03, 0, 0, 0, 0, 0.9, 0.9, 0.9); }
      const el = bone('elbow' + n, sh, 0, -0.3, 0);
      part(RG.elbow, sleeve, el, 0, 0, 0);
      const bare = kind === 'citizen' || isPlayer || kind === 'archer';
      part(RG.lower, kind === 'melee' ? steelMat : (bare ? skin : bodyMat), el, 0, -0.15, 0);
      if (kind === 'citizen') part(RG.cuff, cloth2, el, 0, -0.02, 0);
      if (kind === 'melee') part(RG.bracer, steelMat, el, 0, -0.17, 0);
      if (isPlayer) part(RG.bracer, goldMat, el, 0, -0.2, 0);
      if (kind === 'archer' && sx < 0) part(RG.bracer, leatherMat, el, 0, -0.2, 0);
      if (enemy) part(RG.wrap, ragMat, el, 0, -0.22, 0);
      const hd = bone('hand' + n, el, 0, -0.3, 0); out['hand' + n] = hd;
      part(RG.palm, skin, hd, 0, -0.02, 0.0, 0, 0, 0, 1, 1.15, 0.75); part(RG.thumb, skin, hd, -sx * 0.045, -0.015, 0.035);
      if (isPlayer || kind === 'melee') part(RG.cuff, kind === 'melee' ? steelMat : leatherMat, el, 0, -0.27, 0);
      const hp = bone('hip' + n, hips, sx * 0.14 * W, -0.04, 0);
      part(RG.thigh, pants, hp, 0, -0.225, 0); 
      const kn = bone('knee' + n, hp, 0, -0.45, 0);
      part(RG.knee, pants, kn, 0, 0, 0); part(RG.shin, pants, kn, 0, -0.225, 0);
      part(RG.shaft, bootMat, kn, 0, -0.33, 0); part(RG.cuffBoot, leatherMat, kn, 0, -0.24, 0);
      part(RG.foot, bootMat, kn, 0, -0.43, 0.06, 0, 0, 0, 0.85, 0.55, 1.55); part(RG.sole, darkMat, kn, 0, -0.485, 0.07);
      if (kind === 'melee') part(RG.greave, steelMat, kn, 0, -0.18, 0.012);
    }
    if (enemy) for (const dx of [-0.13, 0, 0.13]) part(RG.rag, ragMat, hips, dx, -0.2, 0.15, 0.12, 0, dx * 0.6);
    for (const g of groups.values()) { const mesh = new THREE.Mesh(mergeGeos(g.items), g.m); mesh.castShadow = !enemy || g.b.name === 'spine'; mesh.receiveShadow = false; g.b.add(mesh); }
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
    make('attackSpear', 0.55, 12, (ph, u) => {   // 창 찌르기: 뒤로 당김(발을 디딤) → 번개처럼 앞으로 찌름 → 거둠
      const wind = kf(u, [[0, 0], [0.28, 1], [0.4, 0], [1, 0]]), thr = kf(u, [[0, 0], [0.26, 0], [0.4, 1], [0.58, 0.85], [1, 0]]);
      return { shoulderR: [-0.7 * wind - 1.55 * thr, 0.25 * wind], elbowR: [-1.7 * wind - 0.08 * thr], shoulderL: [-0.6 * wind - 1.2 * thr], elbowL: [-0.5 * wind - 0.25 * thr],
        spine: [0.18 * thr, -0.35 * wind + 0.3 * thr], head: [-0.05 * thr], hipL: [-0.55 * thr + 0.2 * wind], hipR: [0.35 * thr - 0.1 * wind], kneeL: [0.3 * thr], hipsY: 0.9 - 0.06 * thr, hipsZ: 0.12 * thr };
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
  function makeSpearMesh(def) {                // 창: 긴 나무 자루 + 잎 모양 쇠 촉 + 붉은 술. 손잡이는 자루 중간쯤
    const g = new THREE.Group(), inner = new THREE.Group(), steel = gearMat('spearhead' + def.tier, def.tier > 0 ? 0xe4e8f0 : 0xb6bac2);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, 2.1, 7), gearMat('spearshaft', 0x7a5530)); shaft.position.y = 0.45;
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.42, 4), steel); head.position.y = 1.7; head.scale.z = 0.35;
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.09, 7), gearMat('spearcollar', def.tier > 0 ? 0xc9a23a : 0x6a5a48)); collar.position.y = 1.46;
    const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 6), gearMat('speartassel', 0xb02a22)); tassel.position.y = 1.36; tassel.rotation.x = Math.PI;
    const butt = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.08, 6), gearMat('spearbutt', 0x4a4d52)); butt.position.y = -0.6;
    inner.add(shaft, head, collar, tassel, butt); inner.rotation.x = 1.05; g.add(inner);
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
  const ARMOR_MATS = {};
  function makeRig(kind, color, opts = {}) {
    const rig = modelCache[kind] ? rigFromGltf(modelCache[kind], color) : kind === 'beast' ? buildBeast(color, opts) : buildStickman(color, { kind, ...opts });
    rig.kind = kind; rig.main = null; rig.held = null; rig.meshes = {};
    rig.root.scale.setScalar(rig.baseScale);
    rig.setGear = (slot, def) => {             // slot: 'sword'(오른손) | 'bow'(왼손). def가 없으면 비운다
      const hand = slot === 'sword' || slot === 'spear' ? rig.handR : rig.handL;
      if (rig.meshes[slot]) hand.remove(rig.meshes[slot]);
      rig.meshes[slot] = def ? (slot === 'sword' ? makeSwordMesh(def) : slot === 'spear' ? makeSpearMesh(def) : makeBowMesh(def)) : null;
      if (rig.meshes[slot]) hand.add(rig.meshes[slot]);
      rig.applyHold();
    };
    rig.applyHold = () => {
      const w = rig.held, m = rig.meshes;
      if (m.sword) m.sword.visible = w === 'sword';
      if (m.bow) m.bow.visible = w === 'bow';
      if (m.spear) m.spear.visible = w === 'spear';
      if (!m.pick) { m.pick = makePickMesh(); rig.handR.add(m.pick); }
      m.pick.visible = w === 'pick';
    };
    rig.hold = (what) => { rig.held = what; rig.applyHold(); };
    rig.setArmor = (def) => {                  // 흉갑 + 투구 (몸통/머리 뼈에 부착). 상위 등급은 금색 허리띠
      if (rig.armorMeshes) for (const o of rig.armorMeshes) o.parent && o.parent.remove(o);
      rig.armorMeshes = [];
      if (!def || !def.tier || !rig.spine) return;
      const armorMats = rig.constructor === Object ? ARMOR_MATS : ARMOR_MATS, am = (id, c) => armorMats[id] || (armorMats[id] = new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.25 })), m = am(def.id, def.color), gold = am('gold', 0xd9a92a), add = (geo, parent, x, y, z, mm = m) => { const o = new THREE.Mesh(geo, mm); o.position.set(x, y, z); o.castShadow = true; parent.add(o); rig.armorMeshes.push(o); return o; };
      add(new THREE.CylinderGeometry(0.3, 0.225, 0.48, 14), rig.spine, 0, 0.42, 0).scale.z = 0.68;                         // 흉갑
      add(new THREE.CylinderGeometry(0.225, 0.2, 0.14, 14), rig.spine, 0, 0.14, 0).scale.z = 0.72;                           // 복갑
      for (const sx of [-1, 1]) add(new THREE.SphereGeometry(0.17, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), rig.spine, sx * 0.34, 0.655, 0);   // 견갑
      add(new THREE.SphereGeometry(0.255, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), rig.head, 0, 0.205, 0);                        // 투구
      add(new THREE.CylinderGeometry(0.3, 0.3, 0.025, 18), rig.head, 0, 0.225, 0);
      if (def.tier > 1) { add(new THREE.CylinderGeometry(0.31, 0.31, 0.05, 18), rig.spine, 0, 0.12, 0, gold).scale.z = 0.74; add(new THREE.BoxGeometry(0.04, 0.2, 0.3), rig.head, 0, 0.45, 0, gold); }
      if (def.tier > 2) for (const sx of [-1, 1]) add(new THREE.ConeGeometry(0.04, 0.2, 6), rig.spine, sx * 0.36, 0.78, 0, gold).rotation.z = -sx * 0.4;
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
        if (n === 'attackSword' || n === 'attackBow' || n === 'attackSpear' || n === 'die') { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = n === 'die'; }
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

