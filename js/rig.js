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
  const PLAYER_SKIN = sm(0xe7ae88, 0.8), PLAYER_HAIR = sm(0x5a2d1e, 0.65);       // 지휘관: 따뜻한 살구빛 피부와 붉은 밤색 머리
  const SKINS = [0xf1c9a0, 0xe3b48a, 0xc88b63, 0x8d5a3b, 0xf4d6b8].map(c => { const m = sm(c, 0.8); m.flatShading = true; return m; }), HAIRS = [0x2a1a10, 0x5a3a1e, 0x8a5a2b, 0xc9a23a, 0x9a9a9a, 0x151515, 0x7a2a1a].map(c => sm(c, 0.7));
  const bootMat = sm(0x2b1d14), beltMat = sm(0x4a3320), buckleMat = sm(0xc9a23a, 0.5, 0.3), steelMat = sm(0x9ca2ad, 0.55, 0.25), mailMat = sm(0x626874, 0.65, 0.2), eyeDark = new THREE.MeshBasicMaterial({ color: 0x1a1210 }), eyeWhite = new THREE.MeshBasicMaterial({ color: 0xf2eee6 });
  mailMat.map = (() => {                                       // 사슬 갑옷: 회색 바탕에 격자무늬
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d'); c.fillStyle = '#9aa2ac'; c.fillRect(0, 0, 64, 64); c.fillStyle = '#6e7580';
    for (let i = 0; i < 64; i += 8) { c.fillRect(i, 0, 2, 64); c.fillRect(0, i, 64, 2); }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2); return t;
  })(); mailMat.color.set(0xffffff);
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

  // 얼굴이 있는 각진 로우폴리 머리: 모서리가 둥근 직육면체(네모난 이마·턱·광대)를 깎아 만든다
  function faceHeadGeo(w, h) {
    const hx = 0.145, hy = 0.2, hz = 0.15, r = 0.06, n = Math.max(3, Math.round(4 * Q)), g = new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2, n, n + 1, n), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const cx = Math.max(-(hx - r), Math.min(hx - r, x)), cy = Math.max(-(hy - r), Math.min(hy - r, y)), cz = Math.max(-(hz - r), Math.min(hz - r, z));
      let dx = x - cx, dy = y - cy, dz = z - cz; const l = Math.hypot(dx, dy, dz);
      if (l > 1e-6) { x = cx + dx / l * r; y = cy + dy / l * r; z = cz + dz / l * r; }
      const ny = y / hy;                                                                        // -1 턱 ... +1 정수리
      if (ny < -0.1) { const k = (-ny - 0.1) / 0.9; x *= 1 - 0.22 * k; z = z * (1 - 0.1 * k) + 0.02 * k; }          // 턱은 조금 좁게
      else if (ny > 0.55) { const k = (ny - 0.55) / 0.45; x *= 1 - 0.1 * k; }                    // 정수리는 살짝 둥글게
      p.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals(); return g;
  }
  // 머리카락: 머리와 같은 둥근 상자 모양을 조금 키워 정수리·뒤통수·옆머리를 덮는다 (얼굴 앞쪽 아래만 열어 둔다)
  function hairShellGeo() {
    const hx = 0.162, hy = 0.208, hz = 0.168, r = 0.065, n = Math.max(3, Math.round(4 * Q)), g0 = new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2, n, n + 1, n), p = g0.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const cx = Math.max(-(hx - r), Math.min(hx - r, x)), cy = Math.max(-(hy - r), Math.min(hy - r, y)), cz = Math.max(-(hz - r), Math.min(hz - r, z));
      const dx = x - cx, dy = y - cy, dz = z - cz, l = Math.hypot(dx, dy, dz);
      if (l > 1e-6) { x = cx + dx / l * r; y = cy + dy / l * r; z = cz + dz / l * r; }
      const ny = y / hy; if (ny < -0.1) { const k = (-ny - 0.1) / 0.9; x *= 1 - 0.18 * k; }
      p.setXYZ(i, x, y, z);
    }
    const idx = g0.index.array, keep = [];
    for (let t = 0; t < idx.length; t += 3) {                           // 얼굴 앞쪽(이마선 아래)의 면은 빼서 얼굴이 보이게 한다
      let cy = 0, cz = 0; for (let k = 0; k < 3; k++) { cy += p.getY(idx[t + k]); cz += p.getZ(idx[t + k]); } cy /= 3; cz /= 3;
      if (cz > 0.06 && cy < 0.1) continue;
      keep.push(idx[t], idx[t + 1], idx[t + 2]);
    }
    g0.setIndex(keep); g0.computeVertexNormals(); return g0;
  }
  const makeRG = () => ({
    pelvis: cyl(0.2, 0.215, 0.22, 14), waist: cyl(0.2, 0.17, 0.28, 14), chest: cyl(0.275, 0.2, 0.38, 16), yoke: sph(0.16, 12, 8), belt: cyl(0.208, 0.208, 0.06, 14), buckle: new THREE.BoxGeometry(0.07, 0.06, 0.02),
    neck: cyl(0.068, 0.082, 0.14, 8), head: sph(0.19, 18, 14), headV: faceHeadGeo(11, 9), noseW: new THREE.ConeGeometry(0.028, 0.09, 4), browRidge: new THREE.BoxGeometry(0.17, 0.028, 0.05), cheek: sph(0.04, 6, 5), eyeBox: new THREE.BoxGeometry(0.042, 0.022, 0.012), irisBox: new THREE.BoxGeometry(0.022, 0.02, 0.012), beardJaw: new THREE.ConeGeometry(0.115, 0.17, 6), sideburn: new THREE.BoxGeometry(0.03, 0.1, 0.035), fringe: new THREE.BoxGeometry(0.2, 0.05, 0.07), finger: cyl(0.014, 0.012, 0.075, 5), pauldronBig: sph(0.17, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), helmCheek: new THREE.BoxGeometry(0.035, 0.15, 0.11), fur: cyl(0.3, 0.33, 0.1, 10), furBump: sph(0.07, 6, 5), kerchief: sph(0.205, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), dressSkirt: cyl(0.22, 0.36, 0.66, 12), tab: new THREE.BoxGeometry(0.09, 0.2, 0.015), robe: cyl(0.24, 0.36, 0.9, 12), cloakLong: new THREE.BoxGeometry(0.5, 0.95, 0.04), scarfRing: new THREE.TorusGeometry(0.12, 0.04, 6, 10), toe: sph(0.075, 8, 6), jaw: sph(0.13, 14, 10), ear: sph(0.035, 8, 6), eyeW: sph(0.033, 10, 8), pupil: sph(0.019, 8, 6), brow: new THREE.BoxGeometry(0.075, 0.016, 0.022), nose: sph(0.026, 8, 6), mouth: new THREE.BoxGeometry(0.07, 0.013, 0.01),
    hairCap: sph(0.18, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hairShell: hairShellGeo(), hairLong: cyl(0.16, 0.115, 0.42, 12), ball: sph(0.08, 10, 8), curl: sph(0.085, 8, 6), quiff: sph(0.15, 12, 8), tail: new THREE.ConeGeometry(0.05, 0.32, 8), beard: sph(0.1, 10, 8), stache: new THREE.BoxGeometry(0.1, 0.022, 0.03),
    hood: sph(0.235, 20, 12, Math.PI / 2 + 0.8, Math.PI * 2 - 1.6, 0, Math.PI * 0.72), cowl: cyl(0.2, 0.29, 0.15, 14), mask: new THREE.BoxGeometry(0.2, 0.1, 0.06),
    shoulder: sph(0.08, 18, 12), pauldron: sph(0.145, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), spike: new THREE.ConeGeometry(0.04, 0.16, 6),
    upper: cyl(0.072, 0.058, 0.3, 10), elbow: sph(0.06, 14, 10), lower: cyl(0.056, 0.044, 0.3, 10), cuff: cyl(0.062, 0.062, 0.05, 10), bracer: cyl(0.065, 0.055, 0.15, 10), palm: sph(0.055, 12, 10), thumb: sph(0.022, 6, 5),
    thigh: cyl(0.105, 0.078, 0.46, 12), knee: sph(0.082, 16, 12), shin: cyl(0.076, 0.055, 0.44, 10), shaft: cyl(0.07, 0.082, 0.2, 10), foot: sph(0.1, 12, 8), sole: new THREE.BoxGeometry(0.15, 0.03, 0.32), greave: cyl(0.085, 0.065, 0.3, 10), cuffBoot: cyl(0.09, 0.09, 0.04, 10),
    skirt: cyl(0.23, 0.3, 0.26, 16), tabard: new THREE.BoxGeometry(0.32, 0.56, 0.03), emblem: new THREE.PlaneGeometry(0.2, 0.2), cape: new THREE.BoxGeometry(0.44, 0.42, 0.04), quiver: cyl(0.075, 0.06, 0.5, 10), fletch: new THREE.BoxGeometry(0.03, 0.09, 0.012), strap: new THREE.BoxGeometry(0.06, 0.62, 0.02),
    apron: new THREE.BoxGeometry(0.3, 0.36, 0.02), pouch: new THREE.BoxGeometry(0.1, 0.1, 0.06), lace: new THREE.BoxGeometry(0.1, 0.015, 0.012), collar: new THREE.TorusGeometry(0.13, 0.035, 8, 16), band: new THREE.TorusGeometry(0.2, 0.016, 6, 18), brim: cyl(0.31, 0.31, 0.02, 18), dome: sph(0.2, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), helm: sph(0.235, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), helmBrim: cyl(0.29, 0.29, 0.025, 18), nasal: new THREE.BoxGeometry(0.025, 0.12, 0.02),
    scabbard: new THREE.BoxGeometry(0.06, 0.62, 0.035), rag: new THREE.BoxGeometry(0.09, 0.3, 0.012), wrap: cyl(0.062, 0.062, 0.08, 8), spikeBig: new THREE.ConeGeometry(0.05, 0.22, 6),
  });
  const LEADER_BALANCE = { head: [0.86, 0.86, 0.86], spine: [1.06, 1.12, 1], shoulder: [1.22, 1.22, 1], elbow: [1.2, 1.2, 1], hip: [1.28, 1.28, 1], knee: [1.22, 1.22, 1], hips: [1.08, 1.12, 1] };       // [x, z, y] multipliers per bone (L/R share): the proportions of the custom leader
  const FOLLOWER_BALANCE = { head: [0.88, 0.88, 0.88], spine: [1.02, 1.05, 1], shoulder: [1.1, 1.1, 1], elbow: [1.08, 1.08, 1], hip: [1.12, 1.12, 1], knee: [1.1, 1.1, 1], hips: [1.03, 1.05, 1] };       // soldiers, archers, citizens, raiders: the smaller head, but only about half the extra thickness of the leader
  const RG_HI = makeRG(); Q = 0.5; const RG_LO = makeRG(); Q = 2; const RG_PL = makeRG(); Q = 1;                      // RG_PL: the classic leader, twice the segments, smooth shaded
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
    const kind = opts.kind || 'citizen', enemy = !!opts.enemy, seed = opts.seed ?? 0, bodyMat = opts.bodyMat || mat(color), root = new THREE.Group(), RG = enemy ? RG_LO : kind === 'player' ? RG_PL : RG_HI;
    const R = (k) => ((Math.imul((seed | 0) ^ Math.imul(k + 1, 0x9e3779b1), 2654435761) >>> 0) % 1000) / 1000;            // 사람마다 고정된 0~1 난수
    if (!enemy) { bodyMat.flatShading = false; bodyMat.roughness = 0.88; bodyMat.needsUpdate = true; }
    const skin = enemy ? sm(0xb59a84, 0.8) : kind === 'player' ? PLAYER_SKIN : SKINS[Math.floor(R(1) * SKINS.length)], hair = kind === 'player' ? PLAYER_HAIR : HAIRS[Math.floor(R(2) * HAIRS.length)], hstyle = Math.floor(R(3) * 6);
    const pants = PANTS[enemy ? 'enemy' : kind] || PANTS.citizen;
    const cloth2 = sm(bodyMat.color.clone().multiplyScalar(0.72), 0.9);        // 옷의 보조 색(칼라·소매 끝·모자)
    const W = enemy ? 1.05 : 0.93 + 0.14 * R(8), isPlayer = kind === 'player';          // 체형(어깨 너비)
    const bones = {}, groups = new Map();
    const bone = (name, parent, x, y, z) => { const b = new THREE.Bone(); b.name = name; b.position.set(x, y, z); parent.add(b); bones[name] = b; return b; };
    const BAL = isPlayer ? LEADER_BALANCE : FOLLOWER_BALANCE;                                    // body balance of every human: head smaller, thicker arms and legs (soldiers, archers, citizens, raiders and the leader) - see LEADER_BALANCE
    const part = (geo, m, b, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
      if (BAL) { const k = BAL[b.name.replace(/[LR]$/, '')]; if (k) { x *= k[0]; z *= k[1]; y *= k[2]; sx *= k[0]; sz *= k[1]; sy *= k[2]; } }
      _e.set(rx, ry, rz); _q.setFromEuler(_e); _m4.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
      const key = b.name + '|' + m.uuid; let g = groups.get(key); if (!g) groups.set(key, g = { b, m, items: [] }); g.items.push([geo, _m4.clone()]);
    };
    // ---------- 외형: 컨셉 그림처럼 가죽 조끼 + 사슬 + 가죽끈 + 벨트·주머니 + 긴 장화, 각진 얼굴과 머리 모양 ----------
    const female = kind === 'citizen' && R(9) < 0.45, elder = kind === 'citizen' && !female && R(10) < 0.22, ev = enemy ? Math.floor(R(11) * 5) : -1;
    const brute = ev === 2, hood = (kind === 'archer' && R(12) < 0.4) || ev === 1 || ev === 3;
    const Wb = W * (female ? 0.88 : brute ? 1.2 : 1);
    const vestMat = enemy ? sm(0x4a3626, 0.9) : kind === 'archer' ? sm(0x6a4a2c, 0.9) : kind === 'player' ? sm(0x7a4a28, 0.85) : kind === 'melee' ? sm(0x6a4426, 0.85) : null;
    const sleeveMat = (kind === 'melee' || isPlayer) ? mailMat : bodyMat, hasVest = !!vestMat && !(brute);
    const hips = bone('hips', root, 0, 0.9, 0);
    part(RG.pelvis, pants, hips, 0, 0, 0, 0, 0, 0, Wb, 1, 0.7);
    const spine = bone('spine', hips, 0, 0.05, 0);
    part(RG.waist, bodyMat, spine, 0, 0.17, 0, 0, 0, 0, Wb, 1, 0.72); part(RG.chest, bodyMat, spine, 0, 0.47, 0, 0, 0, 0, Wb * 1.08, 1, 0.62); part(RG.yoke, bodyMat, spine, 0, 0.64, 0, 0, 0, 0, 1.6 * Wb, 0.45, 0.85);
    if (hasVest) { part(RG.chest, vestMat, spine, 0, 0.47, 0, 0, 0, 0, Wb * 1.14, 1.02, 0.67); part(RG.waist, vestMat, spine, 0, 0.17, 0, 0, 0, 0, Wb * 1.06, 1.02, 0.77); part(RG.yoke, vestMat, spine, 0, 0.62, 0, 0, 0, 0, 1.55 * Wb, 0.4, 0.9); }
    if (brute) { part(RG.chest, ragMat, spine, 0, 0.45, 0, 0, 0, 0, Wb * 1.12, 0.92, 0.66); part(RG.waist, sm(0x2a2824), spine, 0, 0.17, 0, 0, 0, 0, Wb * 1.06, 1.02, 0.77); }
    // 가죽끈 X자 + 이중 벨트 + 주머니
    if (hasVest || brute) { part(RG.strap, beltMat, spine, 0, 0.42, 0.172 * Wb, 0, 0, 0.55); part(RG.strap, beltMat, spine, 0, 0.42, 0.176 * Wb, 0, 0, -0.55); part(RG.buckle, buckleMat, spine, 0, 0.45, 0.19 * Wb); part(RG.buckle, buckleMat, spine, 0, 0.3, 0.19 * Wb); }
    part(RG.belt, beltMat, spine, 0, 0.05, 0, 0, 0, 0, Wb * 1.02, 1, 0.76); part(RG.belt, beltMat, spine, 0, 0.12, 0, 0, 0, 0, Wb * 1.04, 1, 0.77); part(RG.buckle, buckleMat, spine, 0, 0.08, 0.158 * Wb + 0.03, 0, 0, 0, 1.5, 1.6, 1);
    if (!female && !elder && kind !== 'citizen') part(RG.pouch, leatherMat, spine, -0.24 * Wb, 0.0, 0.1, 0, 0, 0.1, 1.5, 1.4, 1.4);
    // 머리: 각진 얼굴
    const head = bone('head', spine, 0, 0.66, 0);
    const HS = 0.8, partH = (geo, m, bn, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => part(geo, m, bn, x * HS, y * HS + 0.045, z * HS, rx, ry, rz, sx * HS, sy * HS, sz * HS);       // 머리 부품은 한꺼번에 작게: 현실적인 비율의 머리
    part(RG.neck, skin, head, 0, 0.03, 0, 0, 0, 0, brute ? 1.35 : 1, 1, brute ? 1.3 : 1);
    partH(RG.headV, skin, head, 0, 0.17, 0, 0, 0, 0, female ? 0.9 : 1, 1, 1);
    for (const sx of [-1, 1]) {
      partH(RG.ear, skin, head, sx * 0.172, 0.16, 0, 0, 0, 0, 0.5, 1, 0.8);
      if (enemy) partH(RG.eyeBox, eyeMat, head, sx * 0.067, 0.195, 0.168, 0, 0, 0, 1.15, 0.8, 1);
      else { partH(RG.eyeBox, eyeWhite, head, sx * 0.067, 0.195, 0.168); partH(RG.irisBox, eyeDark, head, sx * 0.067, 0.195, 0.175); }
      partH(RG.brow, enemy ? ragMat : hair, head, sx * 0.067, isPlayer ? 0.236 : 0.232, 0.174, 0, 0, -sx * (enemy ? 0.4 : isPlayer ? 0.3 : 0.14), enemy ? 1.3 : isPlayer ? 1.55 : 1.1, isPlayer ? 2.0 : 1.3, 1);
    }
    partH(RG.browRidge, skin, head, 0, 0.225, 0.158); partH(RG.noseW, skin, head, 0, 0.145, 0.19, Math.PI / 2 + 0.25, 0, 0, 0.95, 1, 1.15);
    if (!enemy) partH(RG.mouth, mouthMat, head, 0, 0.082, 0.19, 0, 0, 0, female ? 0.8 : 1);
    // 수염·머리카락
    const beardy = !female && (isPlayer || kind === 'melee' || ev === 0 || brute || (kind !== 'archer' && R(4) < 0.4)) && ev !== 1 && ev !== 4;
    if (beardy) { partH(RG.beard, hair, head, 0, 0.045, 0.1, 0.15, 0, 0, 1.05, 0.85, 0.8); partH(RG.beard, hair, head, 0, 0.0, 0.04, 0, 0, 0, 1.15, 0.7, 0.9); partH(RG.stache, hair, head, 0, 0.108, 0.195, 0, 0, 0, 1.2, 1.1, 1); for (const sx of [-1, 1]) partH(RG.sideburn, hair, head, sx * 0.16, 0.14, 0.04); }
    const helm = kind === 'melee' || ev === 0;
    if (hood) {
      const hm = enemy ? ragMat : bodyMat; partH(RG.hood, hm, head, 0, 0.17, -0.01, -0.15); part(RG.cowl, hm, spine, 0, 0.62, 0, 0, 0, 0, Wb, 1, 0.8);
      if (ev === 1) partH(RG.mask, ragMat, head, 0, 0.1, 0.18);
      if (kind === 'archer') partH(RG.fringe, hair, head, 0, 0.275, 0.13, -0.3);
    } else if (helm) {
      partH(RG.helm, steelMat, head, 0, 0.2, 0); partH(RG.helmBrim, steelMat, head, 0, 0.22, 0); partH(RG.nasal, steelMat, head, 0, 0.17, 0.2);
      for (const sx of [-1, 1]) partH(RG.helmCheek, steelMat, head, sx * 0.165, 0.1, 0.05);
      partH(RG.hairLong, hair, head, 0, 0.0, -0.13, 0, 0, 0, 0.85, 0.5, 0.5);
    } else if (kind === 'citizen' && female) {
      partH(RG.hairShell, hair, head, 0, 0.17, -0.005); partH(RG.hairLong, hair, head, 0, 0.0, -0.12, 0, 0, 0, 0.9, 1, 0.6); partH(RG.kerchief, R(6) < 0.5 ? cottonMat : cloth2, head, 0, 0.2, -0.02, -0.28, 0, 0, 1, 1, 1.05); partH(RG.ball, cottonMat, head, 0, 0.2, -0.22, 0, 0, 0, 0.7, 0.7, 0.7);
    } else if (isPlayer) {                                                  // 지휘관: 뒤로 쓸어 넘긴 풍성한 머리, 옆으로 흐르는 머리, 어깨 가까이 닿는 뒷머리, 턱까지 이어지는 수염
      partH(RG.hairShell, hair, head, 0, 0.175, -0.01, 0, 0, 0, 1.03, 1.04, 1.05);
      partH(RG.quiff, hair, head, 0, 0.3, 0.07, -0.75, 0, 0, 0.95, 0.5, 1.0); partH(RG.quiff, hair, head, 0, 0.3, -0.03, -0.35, 0, 0, 1.0, 0.55, 1.2);
      for (const sx of [-1, 1]) {
        partH(RG.quiff, hair, head, sx * 0.14, 0.24, 0.0, 0, 0, sx * 0.35, 0.4, 0.6, 0.95);
        partH(RG.sideburn, hair, head, sx * 0.158, 0.1, 0.055, 0, 0, 0, 0.9, 1.7, 1.1);
        partH(RG.beard, hair, head, sx * 0.095, 0.065, 0.075, 0, 0, sx * 0.3, 0.42, 0.9, 0.7);
        partH(RG.stache, hair, head, sx * 0.055, 0.098, 0.195, 0, 0, sx * -0.5, 0.6, 1.3, 1);
      }
      partH(RG.beard, hair, head, 0, -0.02, 0.15, 0.3, 0, 0, 0.55, 0.5, 0.7);
      partH(RG.hairLong, hair, head, 0, 0.1, -0.13, 0, 0, 0, 0.9, 0.55, 0.55);
    } else if (ev === 4 || (enemy && ev === 2)) {
      partH(RG.hairShell, hair, head, 0, 0.17, -0.005); partH(RG.fringe, hair, head, 0.03, 0.272, 0.12, -0.35, 0, 0.12); 
    } else {
      const hs = elder ? 5 : hstyle;
      { partH(RG.hairShell, hair, head, 0, 0.17, -0.005); partH(RG.fringe, hair, head, 0, 0.275, 0.115, -0.32, 0, hs % 2 ? 0.1 : -0.1); }
      if (elder) partH(RG.kerchief, cloth2, head, 0, 0.2, -0.02, -0.28, 0, 0, 1, 1, 1.05);
      if (hs === 1) { partH(RG.hairLong, hair, head, 0, 0.04, -0.1, 0, 0, 0, 1, 1, 0.55); for (const sx of [-1, 1]) partH(RG.ball, hair, head, sx * 0.17, 0.12, 0.0, 0, 0, 0, 0.7, 1.3, 0.8); }
      if (hs === 2) { partH(RG.ball, hair, head, 0, 0.22, -0.19, 0, 0, 0, 0.9, 0.9, 0.9); partH(RG.tail, hair, head, 0, 0.06, -0.24, 0.35, Math.PI); }
      if (hs === 3) partH(RG.ball, hair, head, 0, 0.38, -0.07);
      if (hs === 4) for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; partH(RG.curl, hair, head, Math.cos(a) * 0.15, 0.27 + (i % 2) * 0.04, Math.sin(a) * 0.15 - 0.02); }
    }
    // 역할별 복장
    if (kind === 'melee') {
      part(RG.cowl, mailMat, spine, 0, 0.62, 0, 0, 0, 0, Wb, 1, 0.8);
      for (const dz of [1, -1]) part(RG.tab, bodyMat, spine, 0, 0.05, dz * 0.19 * Wb, 0, 0, 0, 1.7, 1.4, 1);
      part(RG.emblem, emblemMat, spine, 0, 0.3, 0.2 * Wb + 0.01, 0, 0, 0, 0.8, 0.8, 1);
      part(RG.skirt, mailMat, hips, 0, -0.1, 0, 0, 0, 0, Wb, 0.95, 0.78);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; part(RG.tab, mailMat, hips, Math.cos(a) * 0.27 * Wb, -0.27, Math.sin(a) * 0.21, 0.12, -a + Math.PI / 2, 0, 1.1, 0.7, 1); }
      part(RG.scabbard, leatherMat, spine, -0.24, -0.1, -0.02, 0, 0, 0.45);
    } else if (kind === 'archer') {
      part(RG.quiver, leatherMat, spine, 0.1, 0.45, -0.2, 0, 0, 0.28);
      for (const [dx, c] of [[-0.03, redMat], [0.01, cottonMat], [0.05, redMat]]) part(RG.fletch, c, spine, 0.1 + dx + 0.15, 0.73, -0.2, 0, 0, 0.28);
      part(RG.collar, leatherMat, spine, 0, 0.67, 0, Math.PI / 2, 0, 0, 1.1, 1.1, 1.3);
      part(RG.skirt, vestMat, hips, 0, -0.07, 0, 0, 0, 0, Wb, 0.8, 0.78);
      for (const dz of [1, -1]) part(RG.tab, vestMat, spine, 0, 0.0, dz * 0.2 * Wb, 0, 0, 0, 2.2, 1.6, 1);
    } else if (isPlayer) {
      part(RG.cowl, mailMat, spine, 0, 0.62, 0, 0, 0, 0, Wb, 1.1, 0.8); part(RG.collar, mailMat, spine, 0, 0.66, 0, Math.PI / 2, 0, 0, 1.15, 1.15, 1.4);
      part(RG.skirt, mailMat, hips, 0, -0.1, 0, 0, 0, 0, Wb, 0.95, 0.78);
      for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; part(RG.tab, i % 2 ? leatherMat : mailMat, hips, Math.cos(a) * 0.27 * Wb, -0.27, Math.sin(a) * 0.21, 0.12, -a + Math.PI / 2, 0, 1.2, 0.8, 1); }
      part(RG.cape, redMat, spine, 0, 0.45, -0.2 * Wb, 0.08, 0, 0, 0.4, 0.5, 1);                  // 작은 붉은 망토 자락: 주인공 표식
    } else if (kind === 'citizen') {
      const v = female ? 5 : Math.floor(R(5) * 4);
      if (female) {
        part(RG.dressSkirt, bodyMat, hips, 0, -0.35, 0, 0, 0, 0, Wb, 1, 0.8); part(RG.apron, cottonMat, spine, 0, 0.1, 0.14 * Wb + 0.03, 0, 0, 0, 1.2, 1.2, 1); part(RG.apron, cottonMat, hips, 0, -0.38, 0.27, 0.02, 0, 0, 1.5, 1.6, 1);
        for (let i = 0; i < 3; i++) part(RG.lace, beltMat, spine, 0, 0.36 + i * 0.07, 0.18 * Wb);
        part(RG.chest, cloth2, spine, 0, 0.47, 0, 0, 0, 0, Wb * 1.1, 0.7, 0.64);
      } else if (elder) {
        part(RG.robe, bodyMat, hips, 0, -0.35, 0, 0, 0, 0, Wb, 1.1, 0.82); part(RG.chest, cloth2, spine, 0, 0.47, 0, 0, 0, 0, Wb * 1.13, 1, 0.66);
        part(RG.collar, cloth2, spine, 0, 0.66, 0, Math.PI / 2, 0, 0, 1.2, 1.2, 1.3); part(RG.belt, beltMat, spine, 0, 0.12, 0, 0, 0, 0, Wb * 1.06, 1, 0.8);
      } else {
        part(RG.skirt, cloth2, hips, 0, -0.14, 0, 0, 0, 0, Wb, 1, 0.78); part(RG.collar, cloth2, spine, 0, 0.66, 0.0, Math.PI / 2, 0, 0, 1, 1, 1.1);
        if (v === 0) { part(RG.apron, leatherMat, spine, 0, 0.12, 0.15 * Wb + 0.03, 0, 0, 0, 1.15, 1.7, 1); for (const sx of [-1, 1]) part(RG.strap, leatherMat, spine, sx * 0.1, 0.45, 0.14, 0, 0, -sx * 0.1, 0.8, 0.5, 1); }
        if (v === 1) { partH(RG.brim, strawMat, head, 0, 0.3, 0, 0.1); partH(RG.dome, strawMat, head, 0, 0.3, 0); }
        if (v === 2) partH(RG.dome, cloth2, head, 0, 0.26, -0.01, -0.2, 0, 0, 1.12, 1, 1.12);
        if (v === 3) { part(RG.chest, leatherMat, spine, 0, 0.47, 0, 0, 0, 0, Wb * 1.13, 1, 0.66); part(RG.pouch, leatherMat, spine, -0.24, 0.0, 0.0); }
      }
    } else if (enemy) {
      if (ev === 0) { part(RG.cowl, mailMat, spine, 0, 0.62, 0, 0, 0, 0, Wb, 1, 0.8); part(RG.skirt, mailMat, hips, 0, -0.1, 0, 0, 0, 0, Wb, 0.9, 0.78); for (const dx of [-0.13, 0.1]) part(RG.rag, ragMat, hips, dx, -0.28, 0.2, 0.1, 0, dx * 0.6, 1.4, 1, 1); }
      if (ev === 1) { part(RG.skirt, ragMat, hips, 0, -0.1, 0, 0, 0, 0, Wb, 0.9, 0.78); part(RG.cloakLong, ragMat, spine, 0, 0.18, -0.2 * Wb, 0.1, 0, 0, 0.9, 0.7, 1); }
      if (ev === 2) { part(RG.fur, sm(0x8a7458, 1), spine, 0, 0.64, 0, 0, 0, 0, Wb, 1.1, 0.85); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; part(RG.furBump, sm(0x8a7458, 1), spine, Math.cos(a) * 0.3 * Wb, 0.67, Math.sin(a) * 0.24, 0, 0, 0, 1.2, 1.1, 1.2); } part(RG.skirt, ragMat, hips, 0, -0.1, 0, 0, 0, 0, Wb, 0.8, 0.78); }
      if (ev === 3) { part(RG.cloakLong, sm(0x3a4228, 1), spine, 0, 0.1, -0.22 * Wb, 0.1, 0, 0, 1.1, 1.1, 1); part(RG.robe, ragMat, hips, 0, -0.38, 0, 0, 0, 0, Wb, 1.05, 0.82); part(RG.kerchief, sm(0x6a6a48, 1), head, 0, 0.2, -0.02, -0.28, 0, 0, 1, 1, 1.05); }
      if (ev === 4) { part(RG.scarfRing, sm(0x7a7a70, 1), spine, 0, 0.66, 0.0, Math.PI / 2, 0, 0, 1.05, 1.05, 1.4); part(RG.skirt, ragMat, hips, 0, -0.1, 0, 0, 0, 0, Wb, 0.7, 0.78); }
    }
    const out = { root, bodyMat, head, spine, baseScale: (opts.scale ?? 0.9) * (enemy || isPlayer ? (brute ? 1.12 : 1) : 0.95 + 0.1 * R(7)) * (female ? 0.96 : 1) };
    out.hips = hips;
    for (const sx of [-1, 1]) {
      const n = sx < 0 ? 'L' : 'R';
      const sh = bone('shoulder' + n, spine, sx * 0.34 * Wb, 0.58, 0);
      const bareArm = brute || (kind === 'citizen' && R(13) < 0.35 && !female && !elder);
      const sleeve = bareArm ? skin : sleeveMat;
      part(RG.shoulder, sleeve, sh, 0, 0, 0, 0, 0, 0, 1.15, 1.15, 1.15); part(RG.upper, sleeve, sh, 0, -0.15, 0, 0, 0, 0, brute ? 1.35 : 1.08, 1, brute ? 1.35 : 1.08);
      if (isPlayer || kind === 'melee' || ev === 0) { if (sx > 0 || kind !== 'player') part(RG.pauldronBig, steelMat, sh, 0.02 * sx, 0.04, 0, 0, 0, -sx * 0.25, 0.8, 0.7, 0.8); else part(RG.pauldron, leatherMat, sh, 0, 0.03, 0, 0, 0, 0, 1, 0.9, 1); }
      else if (kind === 'archer') part(RG.pauldron, vestMat, sh, 0, 0.03, 0, 0, 0, 0, 1, 0.9, 1);
      if (enemy && ev !== 0) { if (ev === 2) part(RG.pauldron, rustMat, sh, 0, 0.03, 0, 0, 0, 0, 0.9, 0.9, 0.9); }
      const el = bone('elbow' + n, sh, 0, -0.3, 0); out['elbow' + n] = el; out['shoulder' + n] = sh;
      part(RG.elbow, sleeve, el, 0, 0, 0, 0, 0, 0, 1.05, 1.05, 1.05);
      const forearm = kind === 'archer' || kind === 'player' || kind === 'melee' || enemy ? (kind === 'player' || kind === 'melee' ? mailMat : bodyMat) : bodyMat;
      part(RG.lower, bareArm || kind === 'melee' ? (kind === 'melee' ? mailMat : skin) : forearm, el, 0, -0.15, 0, 0, 0, 0, brute ? 1.3 : 1.05, 1, brute ? 1.3 : 1.05);
      if (kind === 'citizen') part(RG.cuff, cloth2, el, 0, -0.02, 0);
      if (isPlayer || kind === 'melee') part(RG.bracer, steelMat, el, 0, -0.2, 0, 0, 0, 0, 1.12, 1.2, 1.12);
      else if (kind === 'archer') part(RG.bracer, leatherMat, el, 0, -0.2, 0, 0, 0, 0, 1.05, 1.2, 1.05);
      else if (enemy) part(RG.bracer, brute ? leatherMat : ragMat, el, 0, -0.2, 0, 0, 0, 0, brute ? 1.35 : 1, 1.1, brute ? 1.35 : 1);
      const hd = bone('hand' + n, el, 0, -0.3, 0); out['hand' + n] = hd;
      part(RG.palm, skin, hd, 0, -0.025, 0.0, 0, 0, 0, brute ? 1.3 : 1.1, 1.1, 0.8); part(RG.thumb, skin, hd, -sx * 0.05, -0.02, 0.035, 0, 0, 0, 1.3, 1.5, 1.3);
      const hp = bone('hip' + n, hips, sx * 0.14 * Wb, -0.04, 0); out['hip' + n] = hp;
      part(RG.thigh, pants, hp, 0, -0.225, 0, 0, 0, 0, brute ? 1.15 : 1, 1, brute ? 1.15 : 1);
      const kn = bone('knee' + n, hp, 0, -0.45, 0); out['knee' + n] = kn;
      part(RG.knee, pants, kn, 0, 0, 0); part(RG.shin, pants, kn, 0, -0.225, 0);
      part(RG.shaft, bootMat, kn, 0, -0.33, 0, 0, 0, 0, 1.12, 1.05, 1.12); part(RG.cuffBoot, leatherMat, kn, 0, -0.23, 0, 0, 0, 0, 1.25, 1.6, 1.25);
      part(RG.foot, bootMat, kn, 0, -0.43, 0.06, 0, 0, 0, 0.85, 0.55, 1.55); part(RG.sole, darkMat, kn, 0, -0.485, 0.07);
      if (kind === 'melee' || isPlayer) part(RG.greave, steelMat, kn, 0, -0.16, 0.012, 0, 0, 0, 1.12, 1.15, 1.12);
    }
    if (enemy && ev !== 2) for (const dx of [-0.13, 0.04]) part(RG.rag, ragMat, hips, dx, -0.22, 0.15, 0.12, 0, dx * 0.6);
    const mk = (typeof CHAR_MODELS !== 'undefined' && opts.model !== false && USE_CHAR_MODELS) ? modelKeyFor(kind, seed, enemy) : (USE_LEADER_PARTS && kind === 'player' && opts.model !== false ? LEADER_KEY : null);
    if (mk) {                                                                                 // 모델 캐릭터: 부품 대신 같은 뼈에 스킨 메시를 입힌다 (애니메이션은 그대로)
      if (mk === 'leaderParts') {                                                              // put the joints where this model's joints are
        const J = LEADER_JOINTS, sy = bones.spine.parent.position.y + bones.spine.position.y;
        for (const [n, sx] of [['L', -1], ['R', 1]]) {
          const cl = new THREE.Bone(); cl.name = 'clav' + n; cl.position.set(sx * J.clX, J.shY - sy, 0); bones.spine.add(cl); bones['clav' + n] = cl; cl.add(bones['shoulder' + n]); out['clav' + n] = cl;      // collar bone: lifts the shoulder when the arm goes up (updateClavicles)
          bones['shoulder' + n].position.set(sx * (J.shX - J.clX), 0, 0); bones['elbow' + n].position.set(sx * J.elX, -J.elDY, 0);
          bones['hip' + n].position.set(sx * J.hipX, J.hipY - bones.hips.position.y, 0); bones['knee' + n].position.set(sx * J.kneeX, -J.kneeDY, 0);
        }
        bones.head.position.y = J.neckY - sy;
      }
      root.updateMatrixWorld(true);
      const skel = new THREE.Skeleton((mk === 'leaderParts' ? BONES.concat(['clavL', 'clavR']) : BONES).map(n => bones[n])), mat0 = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0 }); mat0.skinning = true;                // three r128: 스킨 메시는 재질에 skinning 이 켜져 있어야 뼈를 따라 움직인다
      const HP = { leaderParts: [0.1, -0.29], leader: [0.08, -0.45], soldierSword: [-0.04, -0.5], soldierBow: [-0.03, -0.48], citizenMale: [0.01, -0.49], citizenFemale: [-0.05, -0.48], bandit1: [-0.03, -0.47], bandit2: [0, -0.52] };       // 모델마다 주먹 위치(팔꿈치 기준)가 다르다
      out.setHand = (key) => { const h = key === 'leaderParts' && typeof LEADER_PARTS !== 'undefined' ? [LEADER_PARTS.joints.fistX, LEADER_PARTS.joints.fistY] : HP[key] || [0, -0.47]; out.handR.position.set(h[0], h[1], 0.03); out.handL.position.set(-h[0], h[1], 0.03); };
      out.setHand(mk);                // 모델의 주먹은 막대인간 손뼈보다 아래에 있다: 무기가 손에 쥐어지도록 손뼈를 내린다
      out.bodyMat = mat0; out.skeleton = skel; out.seed = seed; out.model = mk;
      out.setModel = (key) => {
        if (out.skin) { root.remove(out.skin); out.skin = null; }
        const m = modelMesh(key, skel, mat0); root.add(m); out.skin = m; out.model = key; out.setHand(key);
      };
      out.setModel(mk);
    } else for (const g of groups.values()) { const mesh = new THREE.Mesh(mergeGeos(g.items), g.m); mesh.castShadow = !enemy || g.b.name === 'spine'; mesh.receiveShadow = false; g.b.add(mesh); }
    out.clips = STICK_CLIPS;
    return out;
  }
  // ----- 스킨 모델 (js/models.js, tools/build_models.py): 종류별로 모델을 고른다 -----
  const modelGeos = {}, modelTexs = {};
  function modelKeyFor(kind, seed, enemy) {
    if (enemy || kind === 'enemy') return (seed & 1) ? 'bandit1' : 'bandit2';
    if (kind === 'player') return USE_LEADER_PARTS ? LEADER_KEY : 'leader';
    if (kind === 'melee') return 'soldierSword';
    if (kind === 'archer') return 'soldierBow';
    return (seed & 1) ? 'citizenFemale' : 'citizenMale';
  }
  const unb64 = (s, T) => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new T(u.buffer); };
  const _cq = new THREE.Vector3();
  function updateClavicles(rig) {                           // the collar bones follow the arm: above the horizontal the shoulder lifts (up to ~29 degrees) and turns forward when reaching
    for (const [n, s] of [['L', -1], ['R', 1]]) {
      const v = _cq.set(0, -1, 0).applyQuaternion(rig['shoulder' + n].quaternion), t = Math.max(0, Math.min(1, (v.y + 0.85) / 0.85)), f = Math.max(0, Math.min(1, v.z));
      rig['clav' + n].rotation.set(0, -s * 0.25 * f, s * 0.5 * t);
    }
  }
  function modelMesh(key, skeleton, material) {
    const d = key === 'leaderParts' ? LEADER_PARTS : CHAR_MODELS[key];
    let geo = modelGeos[key];
    if (!geo) {
      geo = modelGeos[key] = new THREE.BufferGeometry(); const n = d.n;
      const p = unb64(d.pos, Int16Array), uv = unb64(d.uv, Uint16Array), nr = unb64(d.nor, Int8Array), sw = unb64(d.sw, Uint8Array), si = unb64(d.si, Uint8Array);
      const P = new Float32Array(n * 3), U = new Float32Array(n * 2), N = new Float32Array(n * 3), W = new Float32Array(n * 4), I = new Uint16Array(n * 4);
      for (let i = 0; i < n * 3; i++) { P[i] = p[i] / 10000; N[i] = nr[i] / 127; }
      for (let i = 0; i < n * 2; i++) U[i] = uv[i] / 65535;
      for (let i = 0; i < n * 4; i++) { W[i] = sw[i] / 255; I[i] = si[i]; }
      geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(U, 2)); geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
      geo.setAttribute('skinWeight', new THREE.BufferAttribute(W, 4)); geo.setAttribute('skinIndex', new THREE.BufferAttribute(I, 4));
      geo.setIndex(new THREE.BufferAttribute(d.idx32 ? unb64(d.idx, Uint32Array) : unb64(d.idx, Uint16Array), 1));
    }
    let tex = modelTexs[key];
    if (!tex) { tex = modelTexs[key] = new THREE.TextureLoader().load(d.tex); tex.flipY = true; tex.anisotropy = 2; }
    material.map = tex; material.needsUpdate = true;
    const mesh = new THREE.SkinnedMesh(geo, material); mesh.frustumCulled = false; mesh.castShadow = true; mesh.receiveShadow = false;
    mesh.bind(skeleton, new THREE.Matrix4());
    return mesh;
  }

  // ----- 코드로 만든 애니메이션 클립 (모든 뼈에 키를 둬서 CrossFade 때 자세가 남지 않게 한다) -----
  const BONES = ['hips', 'spine', 'head', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'hipL', 'hipR', 'kneeL', 'kneeR'];
  // 임시: 캐릭터 모델을 끄고 막대인간(폴리곤) 리그만 쓴다. 모델을 다시 켜려면 주소 뒤에 ?models=1 을 붙이거나 이 값을 true 로 바꾼다.
  const USE_CHAR_MODELS = /[?&]models=1/.test(location.search);
  const LEADER_MODE = typeof LEADER_PARTS !== 'undefined' ? Math.max(0, Math.min(1, +window.NF_LEADER || 0)) : 0, USE_LEADER_PARTS = LEADER_MODE > 0, LEADER_KEY = 'leaderParts';
  // 0 = classic stick-man; 1 = the new model (soft joints always on)
  // the model's own joint heights (metres, feet at 0): the stick-man's bones are moved there so the parts swing around the right points
  const LEADER_JOINTS = typeof LEADER_PARTS !== 'undefined' ? LEADER_PARTS.joints : { shX: 0.23, shY: 1.52, elX: 0.04, elDY: 0.28, hipX: 0.11, hipY: 0.98, kneeX: 0, kneeDY: 0.44, neckY: 1.6, clX: 0.08, fistX: 0.1, fistY: -0.29 };      // from the model's own skeleton (tools/build_leader_parts.py)      // 지휘관만 따로 만든 부품(분리된 조각) 모델로 바꿔 본다: 주소 뒤에 ?leader=1
  const TBONES = BONES.concat(['handL', 'handR']);          // 애니메이션 뼈: 손목은 스킨에는 없고 무기만 따라간다
  const kf = (u, pts) => {                   // pts: [[u, value], ...] 선형 보간
    for (let i = 1; i < pts.length; i++) if (u <= pts[i][0]) { const [a, va] = pts[i - 1], [b, vb] = pts[i]; return va + (vb - va) * (b === a ? 1 : (u - a) / (b - a)); }
    return pts[pts.length - 1][1];
  };
  const STICK_CLIPS = (() => {
    const clips = {}, eul = new THREE.Euler(), q = new THREE.Quaternion();
    // fn(ph, u) -> { 뼈이름: [x, y, z], hipsY, hipsZ }. 루프 클립은 ph=0..2π, 1회 클립은 u=0..1
    const make = (name, T, n, fn, loop = true) => {
      const times = [], rot = {}, pos = [];
      for (const b of TBONES) rot[b] = [];
      for (let i = 0; i <= n; i++) {
        const u = i / n, f = fn(u * Math.PI * 2, u);
        times.push(u * T);
        for (const b of TBONES) { const v = f[b] || [0, 0, 0]; eul.set(v[0] || 0, v[1] || 0, v[2] || 0); q.setFromEuler(eul); rot[b].push(q.x, q.y, q.z, q.w); }
        pos.push(0, f.hipsY ?? 0.9, f.hipsZ ?? 0);
      }
      const tracks = TBONES.map(b => new THREE.QuaternionKeyframeTrack(b + '.quaternion', times, rot[b]));
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
    make('gather', 1.0, 20, (ph, u) => {       // 곡괭이·도끼질: 두 손으로 쥐고 뒤로 젖혀 들어 올림 → 온몸으로 내려찍기 → 충격 반동 → 천천히 자세 회복
      const r = kf(u, [[0, 0.2], [0.4, 1], [0.5, 0.35], [0.56, 0], [0.62, -0.06], [0.7, 0.05], [1, 0.2]]);     // 1 = 머리 위로 젖힘, 0 = 내려찍는 순간
      const lean = 0.55 - 0.85 * r, bend = 0.3 + 0.3 * (1 - Math.max(0, r));
      return { shoulderR: [-1.05 - 1.55 * r, 0.1 - 0.25 * r, -0.38 - 0.25 * r], shoulderL: [-1.0 - 1.5 * r, -0.1 + 0.25 * r, 0.4 + 0.3 * r], elbowR: [-0.45 - 0.8 * r], elbowL: [-0.55 - 0.7 * r],
        spine: [lean, 0.2 * r - 0.05, 0], hips: [0.05 * (1 - r)], head: [0.2 - 0.25 * r], kneeL: [bend], kneeR: [bend + 0.05], hipL: [-bend * 0.55], hipR: [-bend * 0.55 - 0.05], hipsY: 0.86 - 0.07 * (1 - Math.max(0, r)) };
    });
    make('gatherAxe', 1.15, 24, (ph, u) => {   // 나무 베기: 야구 스윙 - 몸통을 틀어 도끼를 어깨 뒤로 젖힘 → 허리부터 돌며 팔을 뻗어 수평으로 휘두름 → 끝까지 돌려 멈춤 → 회복
      const w = kf(u, [[0, 0], [0.3, -1], [0.38, -1], [0.5, 0.15], [0.56, 1], [0.7, 0.9], [1, 0]]);          // -1 = 뒤로 젖힘, +1 = 휘두른 끝
      const t = (1 - w) / 2, bend = 0.32;                                                                    // t: 0 = 끝, 1 = 젖힘 (팔꿈치용)
      return { spine: [0.12, -0.9 * w, 0], hips: [0, -0.35 * w, 0], head: [0.08, 0.35 * w], shoulderR: [-0.95, 0.2 - 0.35 * w, -0.4], shoulderL: [-0.95, -0.1 - 0.3 * w, 0.42],
        elbowR: [-0.35 - 1.0 * Math.max(0, -w)], elbowL: [-0.4 - 1.0 * Math.max(0, -w)], hipL: [-bend * 0.5, 0, 0.12 * w], hipR: [-bend * 0.5, 0, 0.12 * w], kneeL: [bend + 0.08 * t], kneeR: [bend + 0.08 * t], hipsY: 0.85 - 0.02 * t };
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
    make('spearLunge', 0.85, 16, (ph, u) => {  // 창 돌진 찌르기: 몸을 크게 뒤로 젖혀 모음 → 뒷발로 박차고 온몸을 실어 한 걸음 깊이 내디디며 찌름 → 천천히 일어섬
      const wind = kf(u, [[0, 0], [0.4, 1], [0.5, 1], [0.62, 0], [1, 0]]), thr = kf(u, [[0, 0], [0.48, 0], [0.62, 1], [0.78, 1], [1, 0]]);
      return { shoulderR: [-0.5 * wind - 1.6 * thr, 0.3 * wind], elbowR: [-1.9 * wind - 0.05 * thr], shoulderL: [-0.5 * wind - 1.35 * thr], elbowL: [-0.7 * wind - 0.15 * thr],
        spine: [-0.15 * wind + 0.45 * thr, -0.5 * wind + 0.35 * thr], hips: [0, -0.2 * wind + 0.2 * thr], head: [-0.2 * thr], hipL: [0.2 * wind - 1.0 * thr], hipR: [-0.1 * wind + 0.5 * thr],
        kneeL: [0.1 * wind + 0.55 * thr], kneeR: [0.1 * wind], hipsY: 0.9 - 0.04 * wind - 0.2 * thr, hipsZ: -0.1 * wind + 0.4 * thr };
    }, false);
    make('die', 0.9, 9, (ph, u) => {           // 뒤로 쓰러져 눕기
      const f = kf(u, [[0, 0], [0.7, 1], [1, 1]]);
      return { hips: [-1.5 * f], hipsY: 0.9 - 0.78 * f, hipsZ: -0.2 * f, shoulderL: [0.3 * f, 0, 0.5 * f], shoulderR: [0.3 * f, 0, -0.5 * f], kneeL: [0.25 * f], kneeR: [0.2 * f], head: [0.2 * f] };
    }, false);
    make('sit', 3, 8, ph => { const s = Math.sin(ph); return { hipL: [-1.5], hipR: [-1.5], kneeL: [0.12], kneeR: [0.12], spine: [0.12 + 0.015 * s], head: [0.1 - 0.04 * s], shoulderL: [-0.5], shoulderR: [-0.5], elbowL: [-0.9], elbowR: [-0.9], hipsY: 0.2 }; });
    return clips;
  })();

  // ----- 모션캡처 클립(Mixamo, tools/retarget_mixamo.js 로 이 리그에 맞춰 변환): 있으면 idle/walk/run/die를 바꾸고 방패 자세 클립을 더한다 -----
  if (typeof MIXAMO_CLIPS !== 'undefined') {
    const eul = new THREE.Euler(), q = new THREE.Quaternion();
    for (const [name, c] of Object.entries(MIXAMO_CLIPS)) {
      const times = [], rot = {}, pos = [];
      for (const b of TBONES) rot[b] = [];
      for (let i = 0; i <= c.n; i++) {
        times.push(c.d * i / c.n);
        for (const b of TBONES) { const v = c.t[b] ? c.t[b][i] : [0, 0, 0]; eul.set(v[0], v[1], v[2]); q.setFromEuler(eul); rot[b].push(q.x, q.y, q.z, q.w); }
        pos.push(0, c.t.hipsY[i], c.t.hipsZ[i]);
      }
      const tracks = TBONES.map(b => new THREE.QuaternionKeyframeTrack(b + '.quaternion', times, rot[b]));
      tracks.push(new THREE.VectorKeyframeTrack('hips.position', times, pos));
      STICK_CLIPS[name] = new THREE.AnimationClip(name, c.d, tracks);
    }
    // 곡괭이질: 다리와 골반은 검 공격(ssAttack1)의 스텝, 상체(척추·머리·팔·손목)는 내려찍기(ssAttack4)의 큰 동작을 합친다
    const L = MIXAMO_CLIPS.ssAttack1, U = MIXAMO_CLIPS.ssAttack4;
    if (L && U) {
      const T = 1.7, N = 34, smp = (arr, c, u) => { const f = Math.min(1, u) * c.n, i = Math.min(c.n - 1, Math.floor(f)), k = f - i, a0 = arr[i], a1 = arr[i + 1]; return [a0[0] + (a1[0] - a0[0]) * k, a0[1] + (a1[1] - a0[1]) * k, a0[2] + (a1[2] - a0[2]) * k]; };
      const times = [], rot = {}, pos = [], LEG = ['hips', 'hipL', 'hipR', 'kneeL', 'kneeR'];
      for (const b of TBONES) rot[b] = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N; times.push(T * u);
        for (const b of TBONES) { const src = LEG.includes(b) ? L : U, v = smp(src.t[b], src, u); eul.set(v[0], v[1], v[2]); q.setFromEuler(eul); rot[b].push(q.x, q.y, q.z, q.w); }
        const f = Math.min(1, u) * L.n, j = Math.min(L.n - 1, Math.floor(f)); pos.push(0, L.t.hipsY[j] + (L.t.hipsY[j + 1] - L.t.hipsY[j]) * (f - j), 0);
      }
      const tracks = TBONES.map(b => new THREE.QuaternionKeyframeTrack(b + '.quaternion', times, rot[b]));
      tracks.push(new THREE.VectorKeyframeTrack('hips.position', times, pos));
      STICK_CLIPS.gatherPick = new THREE.AnimationClip('gatherPick', T, tracks);
    }
    // 나무 베기: 상체는 야구 스윙(gatherAxe) 그대로, 다리와 높이는 검 공격(ssAttack1)의 스텝을 쓴다
    if (L && STICK_CLIPS.gatherAxe) {
      const ax = STICK_CLIPS.gatherAxe, T2 = ax.duration, N2 = 28, times = [], rot = {}, pos = [], LEG2 = ['hipL', 'hipR', 'kneeL', 'kneeR'];
      const smp = (arr, c, u) => { const f = Math.min(1, u) * c.n, i = Math.min(c.n - 1, Math.floor(f)), k = f - i, a0 = arr[i], a1 = arr[i + 1]; return [a0[0] + (a1[0] - a0[0]) * k, a0[1] + (a1[1] - a0[1]) * k, a0[2] + (a1[2] - a0[2]) * k]; };
      for (const b of LEG2) rot[b] = [];
      for (let i = 0; i <= N2; i++) {
        const u = i / N2; times.push(T2 * u);
        for (const b of LEG2) { const v = smp(L.t[b], L, u); eul.set(v[0], v[1], v[2]); q.setFromEuler(eul); rot[b].push(q.x, q.y, q.z, q.w); }
        const f = u * L.n, j = Math.min(L.n - 1, Math.floor(f)); pos.push(0, L.t.hipsY[j] + (L.t.hipsY[j + 1] - L.t.hipsY[j]) * (f - j), 0);
      }
      const keep = ax.tracks.filter(t => !/^(hipL|hipR|kneeL|kneeR)\.quaternion$|^hips\.position$/.test(t.name));
      for (const b of LEG2) keep.push(new THREE.QuaternionKeyframeTrack(b + '.quaternion', times, rot[b]));
      keep.push(new THREE.VectorKeyframeTrack('hips.position', times, pos));
      STICK_CLIPS.gatherAxe = new THREE.AnimationClip('gatherAxe', T2, keep);
    }
  }
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

  // 창 공격 동작의 좌우를 바꾼다: 찌르기·휘두르기는 원래 동작 그대로, 마지막 돌진 찌르기만 두 팔의 좌우를 바꾼다 (엉덩이와 다리는 원래대로, 창은 오른손·방패는 왼손 그대로). 검·방패의 공격(ssAttack1)은 창 전용 복사본을 쓴다
  (() => {
    const mirror = (src, name, torso) => {                                 // 두 팔은 좌우를 맞바꾸고(축 반전), torso 가 true 면 척추·머리도 거울상으로 뒤집는다. 엉덩이·다리는 그대로
      const tr = src.tracks.map(t => {
        const m = /^(\w+)\.quaternion$/.exec(t.name); if (!m) return t.clone();
        const b = m[1], isArm = /^(shoulder|elbow|hand)[LR]$/.test(b); if (!isArm && !(torso && /^(spine|head)$/.test(b))) return t.clone();
        const v = t.values.slice(); for (let i = 0; i < v.length; i += 4) { v[i + 1] = -v[i + 1]; v[i + 2] = -v[i + 2]; }
        return new THREE.QuaternionKeyframeTrack(isArm ? b.replace(/[LR]$/, c => c === 'L' ? 'R' : 'L') + '.quaternion' : t.name, t.times.slice(), v);
      });
      return new THREE.AnimationClip(name, src.duration, tr);
    };
    if (STICK_CLIPS.ssAttack1) STICK_CLIPS.spearSlash1 = STICK_CLIPS.ssAttack2;
    for (const n of ['spearFinal', 'spearLunge']) if (STICK_CLIPS[n]) STICK_CLIPS[n] = mirror(STICK_CLIPS[n], n, false);
  })();

  // ----- 장비 메쉬 (손 뼈에 붙는다): 칼날이 팔 방향(+Z)으로 향하도록 inner.rotation.x = π/2 -----
  const gearMatCache = {};
  const gearMat = (id, color) => gearMatCache[id] || (gearMatCache[id] = new THREE.MeshStandardMaterial({ color, flatShading: true, metalness: 0.5, roughness: 0.4 }));
  // ----- 건물 모델 (js/structures.js, tools/build_structures.py): 우물·대장간·사격장·텐트·모닥불·목책·성벽. 바닥 중앙이 원점, 앞쪽이 +z -----
  const sGeos = {}, sTexs = {}, sMats = {};
  function structMesh(key) {
    if (typeof STRUCT_MODELS === 'undefined' || !STRUCT_MODELS.parts[key]) return null;
    const d = STRUCT_MODELS.parts[key];
    let geo = sGeos[key];
    if (!geo) {
      const n = d.n, p = unb64(d.pos, Int16Array), uv = unb64(d.uv, Uint16Array), nr = unb64(d.nor, Int8Array), P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2);
      for (let i = 0; i < n * 3; i++) { P[i] = p[i] / 1000; N[i] = nr[i] / 127; } for (let i = 0; i < n * 2; i++) U[i] = uv[i] / 65535;
      geo = sGeos[key] = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(N, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(U, 2)); geo.setIndex(new THREE.BufferAttribute(unb64(d.idx, Uint16Array), 1));
    }
    if (!sMats[d.t]) { const t = sTexs[d.t] = new THREE.TextureLoader().load(STRUCT_MODELS.tex[d.t]); t.flipY = true; sMats[d.t] = new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, metalness: 0, side: THREE.DoubleSide }); }
    const m = new THREE.Mesh(geo, sMats[d.t]); m.castShadow = m.receiveShadow = true; return m;
  }
  // ----- 무기 모델 (js/models.js 의 w_sword / w_spear / w_bow): 있으면 직접 만든 무기 대신 쓴다 -----
  const wGeos = {}; let wTex = null, tTex = null; const wMats = {};
  function weaponModel(kind, tier = 0) {
    const pre = (kind === 'pick' || kind === 'axe') ? 't_' : 'w_';
    if (typeof CHAR_MODELS === 'undefined' || !CHAR_MODELS[pre + kind]) return null;
    let geo = wGeos[kind];
    if (!geo) {
      const d = CHAR_MODELS[pre + kind], n = d.n, p = unb64(d.pos, Int16Array), uv = unb64(d.uv, Uint16Array), nr = unb64(d.nor, Int8Array);
      geo = wGeos[kind] = new THREE.BufferGeometry(); const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2);
      for (let i = 0; i < n * 3; i++) { P[i] = p[i] / 10000; N[i] = nr[i] / 127; } for (let i = 0; i < n * 2; i++) U[i] = uv[i] / 65535;
      geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(N, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(U, 2)); geo.setIndex(new THREE.BufferAttribute(unb64(d.idx, Uint16Array), 1));
    }
    const isTool = kind === 'pick' || kind === 'axe';
    if (isTool) { if (!tTex) { tTex = new THREE.TextureLoader().load(CHAR_MODELS.t_tex); tTex.flipY = true; } } else if (!wTex) { wTex = new THREE.TextureLoader().load(CHAR_MODELS.w_tex); wTex.flipY = true; }
    const mk = kind + (tier > 0 ? 1 : 0), m = wMats[mk] || (wMats[mk] = new THREE.MeshStandardMaterial({ map: isTool ? tTex : wTex, roughness: 0.6, metalness: 0.15, color: tier > 0 ? 0xfff0c8 : 0xffffff }));
    const mesh = new THREE.Mesh(geo, m); mesh.castShadow = true; return mesh;
  }
  function makeSwordMesh(def) {
    const wm = weaponModel('sword', def.tier);
    if (wm) { const g = new THREE.Group(), inner = new THREE.Group(); wm.scale.setScalar((def.tier > 0 ? 1.25 : 1) * (def.great ? 1.6 : 1)); inner.add(wm); inner.rotation.x = Math.PI / 2; g.add(inner); return g; }
    const g = new THREE.Group(), inner = new THREE.Group(), len = def.tier > 0 ? 1.05 : 0.8;
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 6), darkMat);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(def.tier > 0 ? 0.34 : 0.26, 0.05, 0.07), gearMat('guard' + def.tier, def.tier > 0 ? 0xc9a23a : 0x6a5a48));
    const blade = new THREE.Mesh(new THREE.BoxGeometry(def.tier > 0 ? 0.09 : 0.07, len, 0.025), gearMat(def.id, def.color));
    guard.position.y = 0.12; blade.position.y = 0.145 + len / 2;
    inner.add(grip, guard, blade); inner.rotation.x = Math.PI / 2; g.add(inner);
    return g;
  }
  function makeSpearMesh(def) {                // 창: 긴 나무 자루 + 잎 모양 쇠 촉 + 붉은 술. 손잡이는 자루 중간쯤
    { const wm = weaponModel('spear', def.tier); if (wm) { const g = new THREE.Group(), inner = new THREE.Group(); inner.add(wm); g.userData.spear = true; g.userData.inner = inner; g.add(inner); return g; } }
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
    { const wm = weaponModel('bow', def.tier); if (wm) { const g = new THREE.Group(), pivot = new THREE.Group(); wm.scale.setScalar(def.tier > 0 ? 1.15 : 1); pivot.add(wm); g.add(pivot); g.userData.pivot = pivot; g.userData.model = true; return g; } }
    const g = new THREE.Group(), pivot = new THREE.Group(), R0 = def.tier > 0 ? 0.55 : 0.45;
    const arcGeo = new THREE.TorusGeometry(R0, def.tier > 0 ? 0.04 : 0.028, 6, 14, Math.PI); arcGeo.rotateZ(Math.PI);     // 불룩한 쪽이 -Y
    const arc = new THREE.Mesh(arcGeo, gearMat(def.id, def.color)); arc.rotation.y = Math.PI / 2;                          // 활의 긴 축이 Z
    const string = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, R0 * 2), gearMat('string', 0xe8e0c8));
    pivot.add(arc, string);
    if (def.tier > 0) { const tip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), gearMat('bowtip', 0xd9d9e0)); tip.position.set(0, -R0 * 0.1, R0); const tip2 = tip.clone(); tip2.position.z = -R0; pivot.add(tip, tip2); }
    g.add(pivot); g.userData.pivot = pivot; pivot.rotation.x = -Math.PI / 2;           // 평소엔 세워서 든다
    return g;
  }
  function makeStaffMesh() {                   // 치료사의 지팡이: 나무 자루 + 빛나는 구슬
    const g = new THREE.Group(), inner = new THREE.Group(), pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.5, 6), gearMat('healstaff', 0x6a4a2a)), orb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshBasicMaterial({ color: 0x7affc8 }));
    pole.position.y = 0.45; orb.position.y = 1.25; inner.add(pole, orb); inner.rotation.x = 1.05; g.add(inner); return g;
  }
  function makeShieldMesh(def) {
    { const wm = weaponModel('shield', def.tier); if (wm) { const g = new THREE.Group(); g.add(wm); return g; } }               // 둥근 방패: 나무판 + 쇠 테두리 + 중앙 징. 왼팔에 붙는다
    const g = new THREE.Group(), t = def.tier || 0, wood = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 14), gearMat('shieldwood', 0x8a5a34));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 6, 16), gearMat('shieldrim' + t, t > 0 ? 0xc9a23a : 0x6a6d75)), boss = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), gearMat('shieldboss' + t, t > 0 ? 0xe8d28a : 0xa8abb2));
    wood.rotation.x = rim.rotation.x = Math.PI / 2; rim.position.z = 0; boss.position.z = 0.04; g.add(wood, rim, boss);
    return g;
  }
  function makeArmorIcon(def) {
    const g = new THREE.Group(), body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.2), gearMat(def.id, def.color)), cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55), gearMat(def.id, def.color));
    cap.position.y = 0.4; g.add(body, cap);
    return g;
  }
  function makePickMesh(kind = 'pick') {
    { const wm = weaponModel(kind, 0); if (wm) { const g = new THREE.Group(), inner = new THREE.Group(); inner.add(wm); inner.rotation.x = Math.PI / 2; g.userData.inner = inner; g.add(inner); return g; } }
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
      const hand = slot === 'sword' || slot === 'great' || slot === 'spear' || slot === 'staff' ? rig.handR : rig.handL;
      if (rig.meshes[slot]) hand.remove(rig.meshes[slot]);
      rig.meshes[slot] = def ? (slot === 'sword' || slot === 'great' ? makeSwordMesh(def) : slot === 'spear' ? makeSpearMesh(def) : slot === 'staff' ? makeStaffMesh() : makeBowMesh(def)) : null;
      if (rig.meshes[slot]) hand.add(rig.meshes[slot]);
      rig.applyHold();
    };
    rig.setShield = (def) => {                 // def가 있으면 왼손에 방패를 든다 (활을 들 때는 숨김)
      if (rig.meshes.shield && rig.meshes.shield.parent) rig.meshes.shield.parent.remove(rig.meshes.shield);
      rig.meshes.shield = def ? makeShieldMesh(def) : null;
      if (rig.meshes.shield) { const sh = rig.meshes.shield; sh.rotation.y = Math.PI / 2; if (rig.elbowL) { sh.position.set(-0.14, rig.skin ? -0.12 : -0.2, 0.02); rig.elbowL.add(sh); } else { sh.position.set(0.12, 0.1, 0.06); rig.handL.add(sh); } }       // 모델: 방패는 팔뚝 바깥쪽에 붙인다
      rig.applyHold();
    };
    rig.applyHold = () => {
      const w = rig.held, m = rig.meshes;
      const sh = !!rig.sheathed;                                           // 무기를 치운 상태(평상시 마을 안): 칼·창·활·방패를 숨긴다
      if (m.sword) m.sword.visible = w === 'sword' && !sh;
      if (m.great) m.great.visible = w === 'great' && !sh;
      if (m.bow) m.bow.visible = w === 'bow' && !sh;
      if (m.spear) m.spear.visible = w === 'spear' && !sh;
      if (m.staff) m.staff.visible = w === 'staff';
      if (m.shield) m.shield.visible = w !== 'bow' && w !== 'pick' && w !== 'great' && w !== 'none' && !sh;
      if (!m.pick) { m.pick = makePickMesh('pick'); rig.handR.add(m.pick); }
      if (!m.axe) { m.axe = makePickMesh('axe'); rig.handR.add(m.axe); }
      m.pick.visible = w === 'pick' && rig.tool !== 'axe'; m.axe.visible = w === 'pick' && rig.tool === 'axe';
    };
    rig.hold = (what) => { rig.held = what; rig.applyHold(); };
    rig.sheathe = (on) => { if (!!rig.sheathed !== !!on) { rig.sheathed = !!on; rig.applyHold(); } };
    rig.setArmor = (def) => {                  // 흉갑 + 투구 (몸통/머리 뼈에 부착). 상위 등급은 금색 허리띠
      if (rig.armorMeshes) for (const o of rig.armorMeshes) o.parent && o.parent.remove(o);
      rig.armorMeshes = [];
      if (!def || !def.tier || !rig.spine || rig.skin) return;
      const armorMats = rig.constructor === Object ? ARMOR_MATS : ARMOR_MATS, am = (id, c) => armorMats[id] || (armorMats[id] = new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.25 })), m = am(def.id, def.color), gold = am('gold', 0xd9a92a), add = (geo, parent, x, y, z, mm = m) => { const o = new THREE.Mesh(geo, mm); o.position.set(x, y, z); o.castShadow = true; parent.add(o); rig.armorMeshes.push(o); return o; };
      add(new THREE.CylinderGeometry(0.3, 0.225, 0.48, 14), rig.spine, 0, 0.42, 0).scale.z = 0.68;                         // 흉갑
      add(new THREE.CylinderGeometry(0.225, 0.2, 0.14, 14), rig.spine, 0, 0.14, 0).scale.z = 0.72;                           // 복갑
      for (const sx of [-1, 1]) add(new THREE.SphereGeometry(0.17, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), rig.spine, sx * 0.34, 0.655, 0);   // 견갑
      add(new THREE.SphereGeometry(0.255, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), rig.head, 0, 0.205, 0);                        // 투구
      add(new THREE.CylinderGeometry(0.3, 0.3, 0.025, 18), rig.head, 0, 0.225, 0);
      if (def.tier > 1) { add(new THREE.CylinderGeometry(0.31, 0.31, 0.05, 18), rig.spine, 0, 0.12, 0, gold).scale.z = 0.74; add(new THREE.BoxGeometry(0.04, 0.2, 0.3), rig.head, 0, 0.45, 0, gold); }
      if (def.tier > 2) for (const sx of [-1, 1]) add(new THREE.ConeGeometry(0.04, 0.2, 6), rig.spine, sx * 0.36, 0.78, 0, gold).rotation.z = -sx * 0.4;
    };
    rig.aim = (on) => { const b = rig.meshes.bow; if (b && !b.userData.model) b.userData.pivot.rotation.x = on ? 0 : -Math.PI / 2; };
    return rig;
  }

  // ----- Anim: AnimationMixer + CrossFade 상태 머신 (base 상태 + 1회성 동작) -----
  const MIXAMO_FAST_DIE = typeof MIXAMO_CLIPS !== 'undefined' ? 1.8 : 1;
  const BRAWL_SEQ = ['brawlPunch', 'brawlPunch2', 'brawlHook', 'brawlKick', 'brawlPunch2', 'brawlKick2', 'brawlHook', 'brawlRound'], AXE_ROLL = Math.PI / 2, FARM_CLIPS = ['farmPlant', 'farmWater', 'farmPull', 'farmPick'];
  class Anim {
    constructor(rig) {
      this.rig = rig; this.mixer = new THREE.AnimationMixer(rig.root); this.acts = {};
      for (const [n, clip] of Object.entries(rig.clips)) {
        const a = this.mixer.clipAction(clip);
        if (n === 'attackSword' || n === 'attackBow' || n === 'attackSpear' || /^die/.test(n) || /^(ss|gs)(Attack|Block)/.test(n) || n === 'bowDraw' || /^spear(Stab|Slash|Lunge|Final)/.test(n) || /^(ss|gs)(Impact|Jump)/.test(n) || /^bow(Dodge|Block|React)/.test(n) || n === 'jump') { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = /^die/.test(n) || /Block/.test(n); }
        this.acts[n] = a;
      }
      this.cur = null; this.baseName = ''; this.shot = null; this.dead = false;
      this.base('idle');
    }
    // 이동 클립 고르기: 무기마다 자기 팩의 동작을 쓴다 (칼·창 = 칼·방패 팩 / 활 = 롱보우 팩 / 대검 = 대검 팩). 그런 무기가 없으면 일반 이동(Locomotion).
    // rig.combat(적이 가깝거나 원정 중)이면 전투 대기 자세, 아니면 평상시 대기 자세(활은 걷기도 겨누지 않은 동작)
    // moveDir: f 앞 / b 뒤 / p,n 옆걸음 (p: +x쪽, n: -x쪽, 정면 +z 기준)
    _res(name) {
      const rig = this.rig, md = this.moveDir || 'f';
      if (name === 'gather') { const k = rig.tool === 'axe' ? (this.acts.chopMocap ? 'chopMocap' : 'gatherAxe') : (this.acts.mineMocap ? 'mineMocap' : 'gatherPick'); if (this.acts[k]) return k; return name; }       // 모션캡처(곡괭이질·도끼질) 우선
      if (name === 'farm') { const k = FARM_CLIPS[(this.farmI || 0) % FARM_CLIPS.length]; if (this.acts[k]) return k; return this.acts.gatherPick ? 'gatherPick' : 'gather'; }
      const set = rig.sheathed ? '' : rig.style === 'gs' ? 'gs' : (rig.style === 'ss' || rig.main === 'spear') ? 'ss' : rig.style === 'bow' ? 'bow' : '', war = !!rig.combat;
      const suf = md === 'b' ? 'B' : md === 'p' ? 'P' : md === 'n' ? 'N' : '';
      if (name === 'idle') { const k = set === 'ss' ? (war ? 'ssIdle' : 'ssIdleCalm') : set === 'gs' ? (war ? 'gsIdle' : 'gsIdleCalm') : set === 'bow' ? (war ? 'bowIdle' : 'bowIdleCalm') : 'idle'; return this.acts[k] ? k : 'idle'; }
      if (name === 'walk' || name === 'run') {
        const run = name === 'run', side = md === 'p' || md === 'n';
        let k;
        if (set === 'ss') k = side ? 'ssStrafe' + suf + (run ? '' : 'W') : (run ? 'ssRun' : 'ssWalk') + suf;
        else if (set === 'gs') k = side ? 'gsStrafe' + suf + (run ? '' : 'W') : (run ? 'gsRun' : 'gsWalk') + suf;
        else if (set === 'bow') k = run ? 'bowRun' + suf : (war ? 'bowAimWalk' : 'bowWalk') + suf;
        else k = side ? 'strafe' + suf + (run ? '' : 'W') : name;                              // 무기 자세가 없는 사람: 뒤로 걷기는 앞으로 걷기를 거꾸로 재생한다
        if (this.acts[k]) return k;
        return name;
      }
      return name;
    }
    _play(name, fade, force) {
      name = this._res(name);
      const next = this.acts[name] || this.acts.idle;
      if (!next || (next === this.cur && !force)) return;
      next.reset(); next.enabled = true; next.setEffectiveWeight(1);
      if (this.cur && this.cur !== next) { next.fadeIn(fade); this.cur.fadeOut(fade); }
      next.play(); this.cur = next;
    }
    base(name, speed = 0) {
      if (this.dead) return;
      const rs = this._res(name);
      if (name !== this.baseName || rs !== this.resName) { if (name === 'farm' && this.baseName !== 'farm') this._ft = 0; this.baseName = name; this.resName = rs; if (!this.shot && !this.guarding) this._play(name, 0.2); }
      const a = this.acts[rs];
      if (a && !this.shot) a.timeScale = (name === 'walk' ? Math.min(1.6, Math.max(0.5, speed / 2.2)) : name === 'run' ? Math.min(1.4, Math.max(0.7, speed / 5.5)) : 1) * (this.moveDir === 'b' && (rs === 'walk' || rs === 'run') ? -1 : 1);       // 뒤로 걷기: 앞으로 걷는 동작을 거꾸로 재생
      if (a && (rs === 'mineMocap' || rs === 'chopMocap')) a.timeScale = a.getClip().duration / 1.0;                 // 곡괭이질 0.9초, 도끼질 1초에 한 번
    }
    breakCombo() { this.atkI = 0; this.spI = 0; this.brI = 0; }                                                   // 회피·점프·방어·채집·무기 교체를 하면 콤보는 처음부터
    once(name) {
      if (this.dead || !this.acts[name]) return;
      let ts = 1;
      this.heavy = false; this.variant = ''; const wasBow = name === 'attackBow';
      if (!this.shot && performance.now() - (this._ce || 0) > 800) { this.atkI = 0; this.spI = 0; this.brI = 0; }                  // 마지막 공격이 끝나고 1초 안에 이어 누르지 않으면 콤보는 처음부터
      if (name === 'attackSword' && this.rig.brawl && this.acts.brawlPunch) {                                                 // 맨손(주인공 무기 해제·일반 시민): 주먹과 발차기를 끊김 없이 이어 붙인다 (앞뒤의 느린 부분은 잘라 낸다)
        const nm = BRAWL_SEQ[this.brI = ((this.brI || 0) % BRAWL_SEQ.length)]; this.brI++;
        const act = this.acts[nm], cd = act.getClip().duration, meta = MIXAMO_CLIPS[nm], hit = meta ? meta.hit : 0.45, a0 = Math.max(0, hit - 0.28), a1 = Math.min(0.97, hit + 0.2);
        const target = nm === 'brawlRound' ? 0.78 : /Punch/.test(nm) ? 0.46 : 0.62, sc = (a1 - a0) * cd / target;
        this.heavy = nm === 'brawlRound'; this.variant = /Kick|Round/.test(nm) ? 'kick' : 'punch'; act.timeScale = sc;
        this.shot = { t: 0, dur: target }; this.hitIn = (hit - a0) * cd / sc; this._play(nm, 0.07, true); act.time = a0 * cd; return;
      }
      if (name === 'attackSpear' && this.acts.spearSlash1 && this.acts.spearStab) {                                              // 창: 찌르기 → 휘두르기(검 동작) → 온몸을 실은 돌진 찌르기
        this.spI = ((this.spI || 0) % 3) + 1; const v = ['stab', 'slash', 'lunge'][this.spI - 1]; this.variant = v; this.heavy = v === 'lunge';
        name = v === 'stab' ? 'spearStab' : v === 'slash' ? 'spearSlash1' : this.acts.spearFinal ? 'spearFinal' : 'spearLunge'; ts = this.acts[name].getClip().duration / (v === 'lunge' ? 0.9 : v === 'slash' ? 0.65 : 0.6);
      }
      if (wasBow && this.rig.style === 'bow' && this.acts.bowDraw) { name = 'bowDraw'; ts = this.acts.bowDraw.getClip().duration / 0.75; }              // 활: 화살을 뽑아 걸고 쏘는 동작을 0.75초로
      if (name === 'attackSword' && this.rig.style === 'ss' && this.acts.ssAttack1) {                 // 검·방패 공격: 세 번은 베기, 네 번째는 점프 내려찍기 (약 0.65초 / 1.15초 안에 끝나도록 빠르게)
        this.atkI = ((this.atkI || 0) % 3) + 1; name = ['ssAttack1', 'ssAttack2', 'ssAttack4'][this.atkI - 1]; this.heavy = this.atkI === 3;
        ts = this.acts[name].getClip().duration / (this.heavy ? 1.15 : 0.65);
      }
      if (name === 'attackSword' && this.rig.style === 'gs' && this.acts.gsAttack1) {                 // 대검: 세 번은 크게 베기, 네 번째는 제자리 회전 베기 (범위가 넓다)
        this.atkI = ((this.atkI || 0) % 3) + 1; name = ['gsAttack2', 'gsAttack3', 'gsAttack4'][this.atkI - 1]; this.heavy = this.atkI === 3;       // 첫 동작(gsAttack1)은 칼자루로 치는 듯해서 뺐다: 빠르게 휘두르는 베기 둘을 번갈아 쓴다
        ts = this.acts[name].getClip().duration / (this.heavy ? 1.7 : 0.9);
      }
      const act = this.acts[name]; act.timeScale = ts;
      const dur = act.getClip().duration / ts, meta = typeof MIXAMO_CLIPS !== 'undefined' && MIXAMO_CLIPS[name === 'spearSlash1' ? 'ssAttack2' : name];
      this.shot = { t: 0, dur };
      this.hitIn = dur * (meta && meta.hit ? meta.hit : name === 'attackBow' ? 0.6 : name === 'attackSpear' ? 0.4 : name === 'spearLunge' ? 0.66 : 0.38);       // 타격 순간까지 걸리는 시간 (칼이 휘둘러지는 때)
      if (wasBow) this.rig.aim(true);
      this._play(name, 0.08, true);
    }
    die() {
      this.dead = true; this.shot = null; this.guarding = false; this.rig.aim(false);
      const set = this.rig.style === 'bow' ? ['dieBow', 'dieBow2'] : this.rig.style === 'gs' ? ['dieGs', 'dieGs2'] : ['die', 'die2'], ok = set.filter(k => this.acts[k]), dk = ok.length ? ok[Math.floor(Math.random() * ok.length)] : 'die';
      this._play(dk, 0.15, true); if (this.acts[dk]) this.acts[dk].timeScale = MIXAMO_FAST_DIE;
    }
    // 점프: 칼·방패 / 대검 / 일반 이동 팩의 점프를 약 0.75초로 재생한다 (높이는 모션캡처의 엉덩이 높이를 그대로 쓴다)
    jump() {
      if (this.dead || this.shot || this.guarding || this.rig.seated) return false;        // a rider does not jump by himself: the horse carries him
      this.breakCombo();
      const k = this.rig.style === 'gs' && this.acts.gsJump ? 'gsJump' : (this.rig.style === 'ss' || this.rig.main === 'spear') && this.acts.ssJump ? 'ssJump' : this.acts.jump ? 'jump' : null; if (!k) return false;
      return k === 'jump' ? this._short(k, 1.1, 0.08, 0.125, 0.83) : this._short(k, 0.75, 0.08);        // 일반 점프 클립은 앞뒤 서 있는 부분을 잘라 낸다 (웅크림 → 공중 → 착지)
    }
    // 회피(대시): 이동 방향(f 앞 / b 뒤 / p,n 옆)에 맞는 구르기·회피 동작
    dodge(dir) {
      if (this.dead || this.guarding) return false;
      this.breakCombo();
      const k = { f: 'bowDodgeF', b: 'bowDodgeB', p: 'bowDodgeP', n: 'bowDodgeN' }[dir] || 'bowDodgeF'; if (!this.acts[k]) return false;
      this.shot = null; return this._short(k, 0.5, 0.06);
    }
    // 피격 반응: 무기 팩의 맞는 동작을 짧게 (공격 중이거나 방금 반응했다면 건너뛴다)
    flinch() {
      const now = performance.now(); if (this.dead || this.shot || this.guarding || now - (this._fl || 0) < 700) return false;
      const st = this.rig.style, v = Math.random() < 0.5 ? '' : '2', k = st === 'gs' ? 'gsImpact' + v : st === 'bow' ? 'bowReact' + v : 'ssImpact' + v; if (!this.acts[k]) return false;
      this._fl = now; return this._short(k, 0.42, 0.06);
    }
    _short(k, dur, fade, a0 = 0, a1 = 1) { const a = this.acts[k], cd = a.getClip().duration; a.timeScale = (a1 - a0) * cd / dur; this.shot = { t: 0, dur }; this.hitIn = dur; this._play(k, fade, true); a.time = a0 * cd; return true; }
    // 막기: 방패 / 대검 / 활 팩의 막기 자세를 잡고 있는다 (끝 자세에서 멈춘다). 풀면 원래 동작으로
    guard(on) {
      on = !!on; if (on === !!this.guarding || this.dead) return;
      this.guarding = on; if (on) this.breakCombo();
      if (on) { const k = this.rig.style === 'gs' && this.acts.gsBlock ? 'gsBlock' : this.rig.style === 'bow' && this.acts.bowBlock ? 'bowBlock' : 'ssBlock'; if (!this.acts[k]) { this.guarding = false; return; } this.shot = null; this.acts[k].timeScale = 1.3; this._play(k, 0.1, true); }
      else this._play(this.baseName || 'idle', 0.15, true);
    }
    revive() { this.dead = false; this.baseName = ''; this.base('idle'); }
    update(dt) {
      if (this.baseName === 'farm' && !this.shot && this.cur) {                 // 농사: 심기 → 물주기 → 뽑기 → 따기 동작을 한 번씩 돌아가며 한다
        this._ft = (this._ft || 0) + dt;
        if (this._ft > this.cur.getClip().duration) { this._ft = 0; this.farmI = ((this.farmI || 0) + 1) % FARM_CLIPS.length; this._play('farm', 0.4, true); }
      }
      if (this.guarding && this.cur && this.cur === this.acts.bowBlock && this.cur.time > 0.8) this.cur.timeScale = 0;        // 활 막기: 자세를 잡은 채 멈춰 있는다
      if (this.shot && (this.shot.t += dt) >= this.shot.dur) { this._ce = performance.now(); this.shot = null; this.rig.aim(false); this._play(this.baseName || 'idle', 0.15, true); }
      const want = this.baseName === 'gather' && !this.shot ? 'pick' : this.rig.main;
      if (want !== this.rig.held) this.rig.hold(want);
      this.mixer.update(dt); if (this.rig.clavL) updateClavicles(this.rig);
      this._spear(dt); this._tool(); this._toolArm(); this._gsArm(dt); if (this.rig.seated) this._seat();
    }
    // 말 위의 앉은 자세: 허벅지를 앞으로 벌려 안장을 감싸고 무릎을 접어 정강이가 말 옆구리로 내려오게 한다 (모션캡처 위에 덮어쓴다)
    _seat() {
      const R = this.rig, e = this._se || (this._se = new THREE.Euler()), q = this._sq || (this._sq = new THREE.Quaternion());
      if (!R.hipL || !R.hipR || !R.kneeL || !R.kneeR) return;
      for (const [h, k, s] of [[R.hipL, R.kneeL, 1], [R.hipR, R.kneeR, -1]]) {
        e.set(-0.75, 0, -s * 0.55); h.quaternion.setFromEuler(e);                  // the thigh opens sideways over the horse's flanks and a little forward
        e.set(0.55, 0, 0); k.quaternion.setFromEuler(e);                          // the lower leg hangs down the flank (heels in), not moving with the run clip
      }
      if (R.hips) { R.hips.position.set(0, R.hips.userData.seatY ?? (R.hips.userData.seatY = R.hips.position.y > 0.5 ? 0.9 : R.hips.position.y), 0); R.hips.quaternion.identity(); }       // the pelvis stays on the saddle: no run bob, no jump
    }
    // 창: 서 있을 때는 위로 세워 들고, 달리기·공격에서는 검처럼 손에 직각으로 쥔다 (손목은 모션캡처를 따른다)
    // 2관절 팔 IK: 어깨→팔꿈치→손이 목표 T에 닿게 한다. base1/base2 는 w=0 일 때의 자세
    _ik2(sh, el, T, pole, base1, base2, w, tmp) {
      const L1 = 0.3, L2 = 0.3, reach = L1 + L2 - 0.02, S = tmp.S, d = tmp.d, p = tmp.p, E = tmp.E;
      sh.getWorldPosition(S); d.copy(T).sub(S); const dist = d.length(), dd = Math.min(Math.max(dist, 0.12), reach); d.normalize();
      p.copy(pole).addScaledVector(d, -pole.dot(d)); if (p.lengthSq() < 1e-6) p.set(0, -1, 0); p.normalize();
      const a = (L1 * L1 - L2 * L2 + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
      E.copy(S).addScaledVector(d, a).addScaledVector(p, h);
      const par = sh.parent.getWorldQuaternion(tmp.qa).invert(), dl = tmp.v.copy(E).sub(S).normalize().applyQuaternion(par);
      tmp.qi.setFromUnitVectors(tmp.dn, dl); sh.quaternion.copy(base1).slerp(tmp.qi, w); sh.updateMatrixWorld(true);
      const par2 = sh.getWorldQuaternion(tmp.qa).invert(), dl2 = tmp.v.copy(T).sub(E).normalize().applyQuaternion(par2);
      tmp.qe.setFromUnitVectors(tmp.dn, dl2); el.quaternion.copy(base2).slerp(tmp.qe, w); el.updateMatrixWorld(true);
    }
    // 대검: 공격할 때는 두 손이 칼자루를 함께 쥔다 (왼손이 닿는 곳까지 오른손도 끌려 가 가운데서 만난다). 평소 이동·대기에서는 왼팔을 내리고 한 손으로 든다
    _gsArm(dt) {
      const R = this.rig, gm = R.meshes && R.meshes.great;
      if (R.style !== 'gs' || !gm || !gm.visible || this.dead || !R.shoulderL) return;
      const atk = !!this.shot, k = this._gk = Math.max(0, Math.min(1, (this._gk || 0) + (atk ? dt / 0.1 : -dt / 0.15)));
      const V = this._gv || (this._gv = { S: new THREE.Vector3(), T: new THREE.Vector3(), E: new THREE.Vector3(), d: new THREE.Vector3(), p: new THREE.Vector3(), v: new THREE.Vector3(), Hr: new THREE.Vector3(), D: new THREE.Vector3(), poleL: new THREE.Vector3(), poleR: new THREE.Vector3(),
        qa: new THREE.Quaternion(), qi: new THREE.Quaternion(), qe: new THREE.Quaternion(), qr: new THREE.Quaternion(), qh: new THREE.Quaternion(), qw: new THREE.Quaternion(), qHang: new THREE.Quaternion(), qHangE: new THREE.Quaternion(), dn: new THREE.Vector3(0, -1, 0), eu: new THREE.Euler() });
      R.root.updateMatrixWorld(true);
      V.eu.set(0.12, 0, -0.1); V.qHang.setFromEuler(V.eu); V.eu.set(-0.3, 0, 0); V.qHangE.setFromEuler(V.eu);          // 걸어 다닐 때의 왼팔: 몸 옆으로 자연스럽게
      const sh = R.shoulderL, el = R.elbowL;
      if (k <= 0.001) return;                                                                      // 공격이 아닐 때는 모션캡처 팔을 그대로 쓴다
      const rq = R.root.getWorldQuaternion(V.qr);
      V.poleL.set(-0.55, -0.8, -0.25).applyQuaternion(rq); const poleR = V.poleR.set(0.55, -0.8, -0.25).applyQuaternion(rq);
      const wm = gm.children[0].children[0], hit = () => { V.T.set(0, -0.1, 0); wm.localToWorld(V.T); return V.T; };
      gm.updateMatrixWorld(true); hit();
      // 왼손이 닿을 수 있는 가장 가까운 점 P: 목표 T 가 너무 멀면 오른손도 그만큼 끌어 와서 가운데서 만난다
      V.S.copy(V.T); sh.getWorldPosition(V.d); V.v.copy(V.S).sub(V.d); const dist = V.v.length(), reach = 0.58;
      if (dist > reach) {
        V.D.copy(V.v).normalize().multiplyScalar(-(dist - reach) * k);                 // T → P 이동량
        R.handR.getWorldPosition(V.Hr); V.Hr.add(V.D);
        const hq = R.handR.getWorldQuaternion(V.qh).clone();                        // 칼 방향(오른 손목)은 그대로 유지한다
        this._ik2(R.shoulderR, R.elbowR, V.Hr, poleR, R.shoulderR.quaternion.clone(), R.elbowR.quaternion.clone(), k, V);
        R.handR.quaternion.copy(R.elbowR.getWorldQuaternion(V.qw).invert()).multiply(hq);
        R.root.updateMatrixWorld(true); gm.updateMatrixWorld(true); hit();
      }
      this._ik2(sh, el, V.T, V.poleL, V.qHang, V.qHangE, k, V);
    }
    // 곡괭이·도끼: 모션캡처는 두 손으로 자루를 쥔다. 왼손은 캡처된 위치에서 가장 가까운 자루 위의 점을 잡도록 팔을 IK 로 맞춘다
    _toolArm() {
      const R = this.rig, m = R.meshes, t = m && (m.pick && m.pick.visible ? m.pick : m.axe && m.axe.visible ? m.axe : null);
      if (!t || !(this.baseName === 'gather') || (this.resName !== 'mineMocap' && this.resName !== 'chopMocap') || !R.shoulderL || this.dead) return;
      const V = this._tav || (this._tav = { S: new THREE.Vector3(), d: new THREE.Vector3(), p: new THREE.Vector3(), v: new THREE.Vector3(), O: new THREE.Vector3(), D: new THREE.Vector3(), H: new THREE.Vector3(), T: new THREE.Vector3(), pole: new THREE.Vector3(), q: new THREE.Quaternion(),
        qa: new THREE.Quaternion(), qi: new THREE.Quaternion(), qe: new THREE.Quaternion(), E: new THREE.Vector3(), dn: new THREE.Vector3(0, -1, 0), b1: new THREE.Quaternion(), b2: new THREE.Quaternion() });
      R.root.updateMatrixWorld(true);
      t.getWorldPosition(V.O); V.D.set(0, 1, 0).applyQuaternion(t.getWorldQuaternion(V.q)).normalize();        // 자루 방향(손에서 머리 쪽)
      R.handL.getWorldPosition(V.H);
      const along = Math.max(0.12, Math.min(0.5, V.v.copy(V.H).sub(V.O).dot(V.D)));
      V.T.copy(V.O).addScaledVector(V.D, along);
      V.pole.set(-0.55, -0.8, -0.25).applyQuaternion(R.root.getWorldQuaternion(V.qa));
      V.b1.copy(R.shoulderL.quaternion); V.b2.copy(R.elbowL.quaternion);
      this._ik2(R.shoulderL, R.elbowL, V.T, V.pole, V.b1, V.b2, 1, V);
    }
    _tool() {                                   // 곡괭이·도끼: 자루는 어깨→손 방향을 따르고, 머리(날)의 방향은 휘두르는 면에 맞춘다
      const m = this.rig.meshes, t = m && (m.pick && m.pick.visible ? m.pick : m.axe && m.axe.visible ? m.axe : null); if (!t || !t.userData.inner) return;
      const inn = t.userData.inner, wm = inn.children[0];
      wm.rotation.set(0, 0, 0);
      if (this.baseName !== 'gather') { t.quaternion.identity(); inn.rotation.set(Math.PI / 2, 0, 0); return; }
      inn.rotation.set(0, 0, 0);
      const R = this.rig; R.root.updateMatrixWorld(true);
      const V = this._tv || (this._tv = { a: new THREE.Vector3(), b: new THREE.Vector3(), d: new THREE.Vector3(), z: new THREE.Vector3(), x: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), M: new THREE.Matrix4(), q: new THREE.Quaternion(), h: new THREE.Quaternion() });
      R.shoulderR.getWorldPosition(V.a); R.handR.getWorldPosition(V.b); V.d.copy(V.b).sub(V.a); if (V.d.lengthSq() < 0.01) return; V.d.normalize();
      if (t === m.axe) V.z.crossVectors(V.d, V.up);                                    // 도끼날: 수평으로 휘두르는 방향(+x쪽에서 -x쪽으로 도는 몸통)의 앞쪽
      else { V.x.set(1, 0, 0).applyQuaternion(R.root.getWorldQuaternion(V.q)); V.z.crossVectors(V.x, V.d); }       // 곡괭이: 머리 축은 자루와 몸의 좌우 축에 모두 수직 = 앞뒤 휘두르는 면 안
      if (V.z.lengthSq() < 1e-4) return; V.z.normalize();
      V.z.addScaledVector(V.d, -V.z.dot(V.d)).normalize(); V.x.crossVectors(V.d, V.z);
      V.M.makeBasis(V.x, V.d, V.z); V.q.setFromRotationMatrix(V.M);                  // 모델: 자루 = +Y, 머리/날 = +Z
      R.handR.getWorldQuaternion(V.h).invert(); t.quaternion.copy(V.h).multiply(V.q);
    }
    spearAim() {                                                       // 창이 지금 가리키는 수평 방향(라디안): 찌르기 판정을 보이는 창끝에 맞추려고 쓴다
      const sp = this.rig.meshes && this.rig.meshes.spear; if (!sp || !sp.visible) return null;
      sp.updateWorldMatrix(true, false); const q = sp.getWorldQuaternion(new THREE.Quaternion()), d = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
      return Math.hypot(d.x, d.z) < 0.3 ? null : Math.atan2(d.x, d.z);
    }
    spearOrigin() {                                                    // 창을 쥔 손의 수평 위치: 찌르기 판정이 몸 가운데가 아니라 창이 나가는 자리에서 시작하게 한다
      const R = this.rig; if (!R.handR) return null; R.root.updateMatrixWorld(true); const p = R.handR.getWorldPosition(new THREE.Vector3()); return [p.x, p.z];
    }
    _spear(dt) {
      const sp = this.rig.meshes && this.rig.meshes.spear; if (!sp || !sp.userData.spear || !sp.visible) return;
      const stab = !!this.shot && /^(stab|slash|lunge)$/.test(this.variant), swing = !!this.shot && this.variant === 'slash', idle = !this.shot && (this.baseName === 'idle' || !this.baseName), inn = sp.userData.inner;
      const tgt = stab ? 0 : Math.PI / 2; inn.rotation.x += (tgt - inn.rotation.x) * Math.min(1, dt / 0.08);
      const k = this._sk = Math.max(0, Math.min(1, (this._sk || 0) + (stab ? dt / 0.1 : -dt / 0.12)));
      if (k <= 0) { sp.quaternion.identity(); sp.position.set(0, 0, 0); return; }
      // 찌르기: 모션캡처 손목은 총을 쥔 각도라서, 자루를 어깨에서 손으로 뻗은 방향에 맞추고 손이 자루 뒤쪽을 쥐게 한다
      const R = this.rig; R.root.updateMatrixWorld(true);
      const a = R.shoulderR.getWorldPosition(this._va || (this._va = new THREE.Vector3())), b = R.handR.getWorldPosition(this._vb || (this._vb = new THREE.Vector3()));
      const d = b.sub(a); if (d.lengthSq() < 0.01) return;
      const fw = (this._fw || (this._fw = new THREE.Vector3())).set(0, 0.06, 1).applyQuaternion(R.root.getWorldQuaternion(this._qr || (this._qr = new THREE.Quaternion())));       // 창끝은 팔 방향보다 적을 향해(캐릭터 정면, 수평) 길게 뻗는다
      d.normalize().multiplyScalar(swing ? 0.8 : 0.15).addScaledVector(fw.normalize(), swing ? 0.2 : 0.85).normalize();
      const inv = R.handR.getWorldQuaternion(this._qa || (this._qa = new THREE.Quaternion())).invert();
      d.applyQuaternion(inv);
      sp.quaternion.slerpQuaternions(this._qi || (this._qi = new THREE.Quaternion()), (this._qb || (this._qb = new THREE.Quaternion())).setFromUnitVectors(new THREE.Vector3(0, 1, 0), d), k);
      sp.position.copy(d).multiplyScalar(0.38 * k);
    }
  }

