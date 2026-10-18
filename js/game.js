(() => {
  const adH = (typeof CFG !== 'undefined' && CFG.ADS && CFG.ADS.BANNER) ? CFG.ADS.HEIGHT : 0; if (adH) { document.documentElement.style.setProperty('--ad-h', adH + 'px'); document.body.classList.add('ad'); }
  const setAppH = () => document.documentElement.style.setProperty('--app-h', (innerHeight - (document.body.classList.contains('titlemode') ? 0 : adH)) + 'px');       // 모바일 주소창 때문에 100vh가 실제 화면보다 큰 문제 방지
  setAppH(); addEventListener('resize', setAppH);
  // ---------- 렌더러 / 씬 ----------
  const canvas = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const dusk = new THREE.Color(0x3a2a52);
  scene.background = dusk;
  scene.fog = new THREE.Fog(dusk, 35, 80);

  // ---------- 조명 ----------
  const ambient = new THREE.AmbientLight(0x6f86d6, 0.6);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xff9a4a, 1.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 90 });
  scene.add(sun, sun.target);

  // ---------- 바닥 ----------
  const MAP = 100;   // 맵 반경 (마을은 평지, 바깥은 언덕·강·호수·늪·숲·고원)
  // ---------- 지형: 마을 주변은 평지, 바깥은 완만한 언덕. 동남쪽에는 강이 흐르고 다리가 하나 있다 (강은 걸어서 건널 수 있지만 느려진다) ----------
  const TERR = { flat: 44, blend: 16, hill: 3.4, riverR: 78, riverW: 3.1, bridgeA: -0.42 };
  const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const RIVER = []; for (let i = 0; i <= 56; i++) { const a = -1.4 + i * (2.3 / 56); RIVER.push([Math.cos(a) * (TERR.riverR + Math.sin(a * 6) * 3), Math.sin(a) * (TERR.riverR + Math.sin(a * 6) * 3)]); }       // 큰 강: 동쪽에서 남쪽으로 휘어 흐른다
  const STREAM = [[-62, 44], [-70, 28], [-80, 14], [-84, -6], [-92, -24], [-100, -40]].map(([x, z]) => [x, z]);                                   // 호수에서 서쪽으로 흘러 나가는 시냇물
  const LAKES = [{ x: -62, z: 58, r: 15 }];                                                                                                      // 북서쪽 호수
  const polyDist = (P, x, z) => { let m = 1e9; for (let i = 0; i < P.length - 1; i++) { const [ax, az] = P[i], [bx, bz] = P[i + 1], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz))); m = Math.min(m, Math.hypot(x - ax - dx * t, z - az - dz * t)); } return m; };
  const lakeDist = (x, z) => { let m = 1e9; for (const L of LAKES) m = Math.min(m, Math.hypot(x - L.x, z - L.z) - L.r); return m; };               // 음수면 호수 안
  const riverDist = (x, z) => Math.min(polyDist(RIVER, x, z), polyDist(STREAM, x, z) - 0.9 * 0, lakeDist(x, z) + TERR.riverW);                      // 물까지의 거리(호수는 가장자리 기준으로 강 폭만큼 보정)
  const MARSH = { x: -60, z: -62, r: 26 }, FORESTS = [{ x: -86, z: 2, r: 28 }, { x: 44, z: 82, r: 22 }, { x: 20, z: -90, r: 20 }];
  const marshW = (x, z) => 1 - sstep(MARSH.r * 0.55, MARSH.r, Math.hypot(x - MARSH.x, z - MARSH.z));                                              // 늪 가중치 0~1
  const forestW = (x, z) => { let w = 0; for (const F of FORESTS) w = Math.max(w, 1 - sstep(F.r * 0.5, F.r, Math.hypot(x - F.x, z - F.z))); return w; };
  const highW = (x, z) => sstep(66, 71, z);                                                                                                       // 북쪽 고원 (절벽 위)
  const BR = { x: Math.cos(TERR.bridgeA) * TERR.riverR, z: Math.sin(TERR.bridgeA) * TERR.riverR, ux: Math.cos(TERR.bridgeA), uz: Math.sin(TERR.bridgeA), len: 7, wid: 1.9, y: 0.32 };
  const onBridge = (x, z) => { const dx = x - BR.x, dz = z - BR.z, a = dx * BR.ux + dz * BR.uz, l = -dx * BR.uz + dz * BR.ux; return Math.abs(a) < BR.len && Math.abs(l) < BR.wid; };
  function terrH(x, z) {
    if (Math.abs(x) > MAP + 24 || Math.abs(z) > MAP + 24) return 0;
    const edge = sstep(TERR.flat, TERR.flat + TERR.blend, Math.max(Math.abs(x), Math.abs(z)));
    const n = 0.9 * Math.sin(x * 0.11 + 1.3) * Math.cos(z * 0.09) + 0.6 * Math.sin((x + z) * 0.07 + 2) + 0.35 * Math.sin(x * 0.23) * Math.sin(z * 0.21 + 1);       // 대략 -1.85 ~ 1.85
    const big = 0.5 + 0.5 * Math.sin(x * 0.031 + 0.8) * Math.cos(z * 0.027 - 0.4);                                                                          // 큰 굴곡: 완만한 언덕과 골짜기
    let h = ((n * 0.27 + 0.5) * TERR.hill + big * TERR.hill * 0.9) * edge;
    const gap = 1 - 0.88 * (Math.exp(-(((x + 30) / 10) ** 2)) + Math.exp(-(((x - 38) / 10) ** 2)));                                                          // 절벽에 난 두 개의 통로
    h += 5.2 * sstep(66, 70.5, z) * Math.max(0.12, Math.min(1, gap)) * edge;                                                                                 // 북쪽 절벽과 고원
    h -= 0.6 * marshW(x, z) * edge;                                                                                                                          // 늪은 낮고 평평하다
    const bd = Math.hypot(x - BR.x, z - BR.z); h += (BR.y - h) * (1 - sstep(5, 10, bd));                                                                      // 다리 근처는 둑을 평평하게
    const rd = riverDist(x, z); return h + (-0.55 - h) * (1 - sstep(TERR.riverW - 0.6, TERR.riverW + 1.6, rd));
  }
  const actorH = (x, z) => onBridge(x, z) ? BR.y : terrH(x, z);
  const groundY = (x, z, r = 1.6) => { let h = actorH(x, z); for (const [dx, dz] of [[r, 0], [-r, 0], [0, r], [0, -r]]) h = Math.max(h, terrH(x + dx, z + dz)); return h; };       // 바닥 표시(공격 범위·고리)가 언덕에 묻히지 않도록: 주변 땅 높이의 최댓값
  let riverMode = 'normal', riverDay = -1, waterMesh = null;           // normal / flood (봄 첫날 범람: 더 넓고 느림) / ice (겨울: 얼어서 어디서나 건널 수 있다)
  const inRiver = (x, z) => !onBridge(x, z) && riverDist(x, z) < TERR.riverW + 0.2 + (riverMode === 'flood' ? 1.4 : 0);
  const biomeAt = (x, z) => marshW(x, z) > 0.5 ? 'marsh' : forestW(x, z) > 0.5 ? 'forest' : highW(x, z) > 0.5 || terrH(x, z) > 4 ? 'rock' : 'meadow';
  const terrSpd = (x, z) => {
    if (Math.abs(x) > MAP + 2 || Math.abs(z) > MAP + 2) return 1;
    if (inRiver(x, z)) return riverMode === 'ice' ? 1.0 : riverMode === 'flood' ? 0.4 : 0.6;
    if (marshW(x, z) > 0.45) return 0.72;
    return roadAt(x, z) ? 1.2 : 1;
  };
  // ---------- 장식: 언덕의 덤불과 풀, 강가 낚시 부두 (충돌 없음, 계절 색을 따른다) ----------
  const decorMeshes = [];
  const decorMats = { bush: new THREE.MeshStandardMaterial({ color: 0x3f8a3c, flatShading: true, roughness: 1 }), tuft: new THREE.MeshStandardMaterial({ color: 0x6aa04a, flatShading: true, roughness: 1 }) };
  { const spots = [], rnd = (() => { let s = 12345; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; })();
    for (let i = 0; i < 6000 && spots.length < 520; i++) {
      const x = (rnd() * 2 - 1) * (MAP + 12), z = (rnd() * 2 - 1) * (MAP + 12), h = terrH(x, z);
      if (Math.max(Math.abs(x), Math.abs(z)) < 34 || h < 0.35 || marshW(x, z) > 0.5 || riverDist(x, z) < TERR.riverW + 2.2 || onBridge(x, z) || Math.hypot(x - BR.x, z - BR.z) < 12) continue;
      spots.push([x, h, z, rnd()]);
    }
    const nb = spots.length, bushes = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.7, 0), decorMats.bush, nb), tufts = new THREE.InstancedMesh(new THREE.ConeGeometry(0.22, 0.7, 5), decorMats.tuft, nb * 3), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
    spots.forEach((s, i) => { const k = 0.7 + s[3] * 0.9; q.setFromEuler(new THREE.Euler(0, s[3] * 6, 0)); m4.compose(ps.set(s[0], s[1] + 0.3 * k, s[2]), q, sc.set(k * 1.2, k * 0.8, k * 1.2)); bushes.setMatrixAt(i, m4);
      for (let j = 0; j < 3; j++) { const a = s[3] * 20 + j * 2.1, kk = 0.8 + ((s[3] * 7 + j) % 1) * 0.8; m4.compose(ps.set(s[0] + Math.cos(a) * 1.3, terrH(s[0] + Math.cos(a) * 1.3, s[2] + Math.sin(a) * 1.3) + 0.3, s[2] + Math.sin(a) * 1.3), q, sc.set(kk, kk, kk)); tufts.setMatrixAt(i * 3 + j, m4); } });
    bushes.castShadow = true; scene.add(bushes, tufts); decorMeshes.push(bushes, tufts);
    // 낚시 부두: 다리 위쪽 강둑에서 물 쪽으로 뻗은 나무 부두 + 통
    const pi = 18, [px, pz] = RIVER[pi], [qx, qz] = RIVER[pi + 1], tx = qx - px, tz = qz - pz, tl = Math.hypot(tx, tz), nx = tz / tl, nz = -tx / tl;      // 강 안쪽(마을 쪽)을 향하는 법선
    const side = Math.hypot(px + nx * 3, pz + nz * 3) < Math.hypot(px - nx * 3, pz - nz * 3) ? 1 : -1, wood = new THREE.MeshStandardMaterial({ color: 0xa87a48, flatShading: true, roughness: 1 });
    const pier = new THREE.Group(); const deck = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 5.4), wood); deck.position.set(0, 0.28, 0); deck.castShadow = deck.receiveShadow = true; pier.add(deck);
    for (const sx of [-0.65, 0.65]) for (const sz of [-2.4, 0, 2.4]) { const po = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 1.1, 6), wood); po.position.set(sx, 0, sz); pier.add(po); }
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 8), new THREE.MeshStandardMaterial({ color: 0x7a5a2a, flatShading: true })); barrel.position.set(0.45, 0.6, -2.1); pier.add(barrel);
    pier.position.set(px + side * nx * 2.3, 0, pz + side * nz * 2.3); pier.rotation.y = Math.atan2(-side * nx, -side * nz) + Math.PI; scene.add(pier);
    // 걸어서 만든 길 옆 밭 (결정적 위치: 길 칸의 해시로 정한다)
    var plotMesh = new THREE.Group(); scene.add(plotMesh);
  }
  const plotSoil = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, flatShading: true, roughness: 1 }), plotCrop = new THREE.MeshStandardMaterial({ color: 0x78b04a, flatShading: true, roughness: 1 });
  function clearPlots() { while (plotMesh.children.length) { const c = plotMesh.children.pop(); } plotMesh.clear(); }
  function maybePlot(k, x, z) {
    let hsh = 0; for (let i = 0; i < k.length; i++) hsh = (hsh * 31 + k.charCodeAt(i)) >>> 0;
    if (hsh % 17 !== 0 || plotMesh.children.length >= 12 || Math.hypot(x, z) < 36) return;
    const a = (hsh % 628) / 100, px = x + Math.cos(a) * 3.2, pz = z + Math.sin(a) * 3.2;
    if (inRiver(px, pz) || riverDist(px, pz) < TERR.riverW + 2 || plotMesh.children.some(c => Math.hypot(c.position.x - px, c.position.z - pz) < 7)) return;
    const g = new THREE.Group(), soil = new THREE.Mesh(new THREE.BoxGeometry(3, 0.12, 2.2), plotSoil); g.add(soil);
    for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 4), plotCrop); c.position.set(-1.1 + (i % 3) * 1.1, 0.3, i < 3 ? -0.5 : 0.5); g.add(c); }
    g.position.set(px, terrH(px, pz) + 0.08, pz); g.rotation.y = a; plotMesh.add(g);
  }
  // 오르막을 오르는 적은 느려진다 (가는 방향으로 0.8칸 앞의 높이차에 비례, 최대 -40%)
  function climbMul(x, z, tx, tz) { const d = Math.hypot(tx - x, tz - z); if (d < 0.5) return 1; const dh = actorH(x + (tx - x) / d * 0.8, z + (tz - z) / d * 0.8) - actorH(x, z); return dh > 0.02 ? Math.max(0.6, 1 - dh * 0.9) : 1; }
  // ---------- 길: 성벽 밖을 자주 걷는 곳은 다져져서 길이 되고, 길 위에서는 20% 빨리 걷는다 (story.roads에 저장) ----------
  const ROAD = { cell: 2, need: 3, max: 520, cnt: new Map(), set: new Set(), n: 0 };
  const roadMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(2.1, 2.1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x6b4f35, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), ROAD.max);
  roadMesh.count = 0; roadMesh.receiveShadow = true; roadMesh.frustumCulled = false; scene.add(roadMesh);
  const rkey = (x, z) => Math.round(x / ROAD.cell) + ',' + Math.round(z / ROAD.cell);
  function roadAt(x, z) { return ROAD.set.size > 0 && ROAD.set.has(rkey(x, z)); }
  function addRoad(k, save = true) {
    if (ROAD.set.has(k) || ROAD.n >= ROAD.max) return;
    const [i, j] = k.split(',').map(Number), x = i * ROAD.cell, z = j * ROAD.cell, m = new THREE.Matrix4().makeTranslation(x, actorH(x, z) + 0.05, z);
    roadMesh.setMatrixAt(ROAD.n++, m); roadMesh.count = ROAD.n; roadMesh.instanceMatrix.needsUpdate = true; ROAD.set.add(k);
    if (save) (story.roads || (story.roads = [])).push(k);
    maybePlot(k, x, z);
  }
  function stepRoad(x, z, w) {
    if (Math.max(Math.abs(x), Math.abs(z)) < 28 || Math.abs(x) > MAP || Math.abs(z) > MAP || inRiver(x, z) || riverDist(x, z) < TERR.riverW + 1) return;
    const k = rkey(x, z); if (ROAD.set.has(k)) return;
    const c = (ROAD.cnt.get(k) || 0) + w; ROAD.cnt.set(k, c); if (c >= ROAD.need) addRoad(k);
  }
  function rebuildRoads() { clearPlots(); ROAD.set.clear(); ROAD.cnt.clear(); ROAD.n = 0; roadMesh.count = 0; for (const k of (story.roads || [])) addRoad(k, false); roadMesh.instanceMatrix.needsUpdate = true; }
  const groundGeo = new THREE.PlaneGeometry((MAP + 20) * 2, (MAP + 20) * 2, 180, 180); groundGeo.rotateX(-Math.PI / 2);
  { const p = groundGeo.attributes.position, col = new Float32Array(p.count * 3);                      // 지형 색: 지대마다 기본색에 곱해지는 색조 (계절 색은 재질 색이 맡는다)
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), h = terrH(x, z); p.setY(i, h);
      let r = 1, g = 1, b = 1; const mw = marshW(x, z), fw = forestW(x, z), hw = Math.max(highW(x, z), sstep(3.2, 5.2, h)), rv = riverDist(x, z), sand = 1 - sstep(TERR.riverW + 0.5, TERR.riverW + 4.5, rv);
      r += (0.5 - 1) * mw + (0.68 - 1) * fw + (1.1 - 1) * hw + (1.18 - 1) * sand; g += (0.98 - 1) * mw + (1.08 - 1) * fw + (1.08 - 1) * hw + (1.1 - 1) * sand; b += (0.78 - 1) * mw + (0.72 - 1) * fw + (1.15 - 1) * hw + (0.9 - 1) * sand;
      const j = 0.97 + 0.06 * Math.sin(x * 0.9) * Math.cos(z * 0.8); col[i * 3] = Math.min(1.3, r * j); col[i * 3 + 1] = Math.min(1.3, g * j); col[i * 3 + 2] = Math.min(1.3, b * j);
    }
    groundGeo.setAttribute('color', new THREE.BufferAttribute(col, 3)); groundGeo.computeVertexNormals(); }
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ color: 0x9a6b44, flatShading: true, roughness: 1, vertexColors: true }));
  ground.receiveShadow = true;
  scene.add(ground);
  const iceC = new THREE.Color(0xcfe6f5), waterC = new THREE.Color(0x3a78a8);
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x3a78a8, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.82, side: THREE.DoubleSide });
  { waterMesh = new THREE.Group(); scene.add(waterMesh);
    const ribbon = (P, w) => { const pos = [], idx = [];
      for (let i = 0; i < P.length; i++) {
        const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], tx = b[0] - a[0], tz = b[1] - a[1], tl = Math.hypot(tx, tz) || 1, nx = -tz / tl, nz = tx / tl;
        pos.push(P[i][0] + nx * w, -0.12, P[i][1] + nz * w, P[i][0] - nx * w, -0.12, P[i][1] - nz * w);
        if (i > 0) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
      }
      const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); wg.setIndex(idx); wg.computeVertexNormals();
      const m = new THREE.Mesh(wg, waterMat); m.receiveShadow = true; waterMesh.add(m); };
    ribbon(RIVER, TERR.riverW + 0.7); ribbon(STREAM, TERR.riverW + 0.7);
    for (const L of LAKES) { const lg = new THREE.CircleGeometry(L.r + 0.8, 36); lg.rotateX(-Math.PI / 2); const m = new THREE.Mesh(lg, waterMat); m.position.set(L.x, -0.12, L.z); m.receiveShadow = true; waterMesh.add(m); }
    const deck = new THREE.Mesh(new THREE.BoxGeometry(BR.len * 2, 0.22, BR.wid * 2), new THREE.MeshStandardMaterial({ color: 0xb88a56, flatShading: true, roughness: 1 }));
    deck.position.set(BR.x, BR.y - 0.12, BR.z); deck.rotation.y = -TERR.bridgeA; deck.castShadow = deck.receiveShadow = true; scene.add(deck);
    for (const s of [-1, 1]) for (const e of [-1, 1]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.0, 6), new THREE.MeshStandardMaterial({ color: 0x5a3b22, flatShading: true })); post.position.set(BR.x + BR.ux * e * (BR.len - 0.3) - BR.uz * s * BR.wid, BR.y + 0.4, BR.z + BR.uz * e * (BR.len - 0.3) + BR.ux * s * BR.wid); post.castShadow = true; scene.add(post); }
  }


  // ---------- 절차적 맵: 나무 / 바위 ----------
  const obstacles = [];   // 충돌 + 채집 대상 배열
  const mat = (c) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 1 });
  // ---------- generated textures: stone blocks, planks, shingles, plaster. No files: drawn on a canvas, mapped by object-space triplanar so boxes, cones and walls of any size keep the same scale ----------
  const procTexCache = {};
  function procTex(kind) {
    if (procTexCache[kind]) return procTexCache[kind];
    const S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S; const c = cv.getContext('2d');
    let seed = kind.length * 977 + kind.charCodeAt(0); const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const g = (v) => { v = Math.max(0, Math.min(255, Math.round(v))); return `rgb(${v},${v},${v})`; };
    c.fillStyle = g(235); c.fillRect(0, 0, S, S);
    if (kind === 'stone') {                                           // staggered blocks, dark mortar, speckles
      c.fillStyle = g(120); c.fillRect(0, 0, S, S);
      for (let row = 0; row < 8; row++) { const bw = 32, off = row % 2 ? 16 : 0; for (let col = -1; col < 5; col++) { const x = col * bw + off, y = row * 16, v = 205 + r() * 45; c.fillStyle = g(v); c.fillRect(x + 1.5, y + 1.5, bw - 3, 13); c.fillStyle = g(v + 14); c.fillRect(x + 1.5, y + 1.5, bw - 3, 2); } }
    } else if (kind === 'wood') {                                     // vertical planks with grain lines and nail dots
      for (let i = 0; i < 8; i++) { const x = i * 16, v = 205 + r() * 40; c.fillStyle = g(v); c.fillRect(x, 0, 16, S); for (let k = 0; k < 9; k++) { c.fillStyle = g(v - 22 - r() * 20); c.fillRect(x + 2 + r() * 12, 0, 1, S); } c.fillStyle = g(95); c.fillRect(x + 15, 0, 1.5, S); c.fillRect(x + 7, 8, 2, 2); c.fillRect(x + 7, S - 10, 2, 2); }
    } else if (kind === 'shingle') {                                  // overlapping rows of rounded tiles
      c.fillStyle = g(110); c.fillRect(0, 0, S, S);
      for (let row = 0; row < 8; row++) { const off = row % 2 ? 8 : 0; for (let col = -1; col < 9; col++) { const x = col * 16 + off, y = row * 16, v = 190 + r() * 55; c.fillStyle = g(v); c.beginPath(); c.moveTo(x + 1, y); c.lineTo(x + 15, y); c.lineTo(x + 15, y + 9); c.quadraticCurveTo(x + 8, y + 20, x + 1, y + 9); c.fill(); c.fillStyle = g(v - 40); c.fillRect(x + 1, y, 14, 2); } }
    } else if (kind === 'rough') {                                    // rubble masonry: rows of small uneven stones, dark mortar, warm and cool greys mixed
      c.fillStyle = g(95); c.fillRect(0, 0, S, S);
      for (let row = 0; row < 8; row++) {
        let x = -r() * 10; const y = row * 16;
        while (x < S) {
          const w = 12 + r() * 16, v = 175 + r() * 55, wr = Math.round(v + 3 + (r() - 0.5) * 7), wb = Math.round(v - 5 + (r() - 0.5) * 7), ins = 1.4 + r() * 0.8, h = 16 - 2 * ins;
          for (const ox of x + w > S ? [0, -S] : [0]) { const px = x + ox + ins, cr = 2.5; c.fillStyle = `rgb(${wr},${Math.round(v)},${wb})`; c.beginPath(); c.moveTo(px + cr, y + ins); c.lineTo(px + w - 2 * ins - cr, y + ins); c.lineTo(px + w - 2 * ins, y + ins + cr); c.lineTo(px + w - 2 * ins, y + ins + h - cr); c.lineTo(px + w - 2 * ins - cr, y + ins + h); c.lineTo(px + cr, y + ins + h); c.lineTo(px, y + ins + h - cr); c.lineTo(px, y + ins + cr); c.closePath(); c.fill(); c.fillStyle = 'rgba(255,255,255,0.14)'; c.fillRect(px + 2, y + ins, w - 2 * ins - 4, 2); }
          x += w;
        }
      }
    } else if (kind === 'thatch') {                                   // straw: dense short diagonal strands in bundles
      c.fillStyle = g(190); c.fillRect(0, 0, S, S);
      for (let i = 0; i < 900; i++) { const x = r() * S, y = r() * S, v = 140 + r() * 115; c.strokeStyle = g(v); c.lineWidth = 1 + r(); c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r() - 0.5) * 5, y + 8 + r() * 12); c.stroke(); }
      for (let y = 0; y < S; y += 32) { c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(0, y, S, 2); }
    } else {                                                          // plaster: soft mottling and a few cracks
      for (let i = 0; i < 700; i++) { c.fillStyle = g(205 + r() * 50); c.fillRect(r() * S, r() * S, 2 + r() * 6, 2 + r() * 6); }
    }
    for (let i = 0; i < 160; i++) { c.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.05})`; c.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2); }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return (procTexCache[kind] = t);
  }
  function texMat(color, kind, tile) {                                // tile: texture repeats per metre
    const m = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 1, map: procTex(kind) });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTile = { value: tile };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vTP; varying vec3 vTN;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvTP = position * vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), length(modelMatrix[2].xyz)); vTN = abs(normal);');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vTP; varying vec3 vTN; uniform float uTile;').replace('#include <map_fragment>', 'vec3 tw = pow(normalize(vTN + 1e-4), vec3(4.0)); tw /= (tw.x + tw.y + tw.z); diffuseColor.rgb *= (texture2D(map, vTP.zy * uTile) * tw.x + texture2D(map, vTP.xz * uTile) * tw.y + texture2D(map, vTP.xy * uTile) * tw.z).rgb;');
    };
    m.customProgramCacheKey = () => 'procTex';
    return m;
  }
  const trunkMat = mat(0x6b4226), leafMat = mat(0x3f8a3c), rockMat = mat(0x8b8b92);
  const rand = (a, b) => a + Math.random() * (b - a);

  let treeMat = null;                                                    // 모델 나무 재질: 계절 색(leafMat)을 흰색 쪽으로 약하게 섞어 곱한다 (tintTrees)
  const tintTrees = () => { if (treeMat) treeMat.color.copy(leafMat.color).lerp(new THREE.Color(0xffffff), 0.8); };
  function makeTree() {
    const tm = structMesh('tree');
    if (tm) {
      if (!treeMat) { treeMat = tm.material.clone(); treeMat.emissive = new THREE.Color(0x4a4a4a); treeMat.emissiveMap = treeMat.map; treeMat.roughness = 1; tintTrees(); }       // 밝고 선명한 연두색 소나무: 텍스처를 스스로 조금 빛나게 한다
      tm.material = treeMat; tm.scale.setScalar(rand(0.8, 1.25)); tm.rotation.y = rand(0, 6.28);
      const g = new THREE.Group(); g.add(tm); g.userData = { type: 'wood', radius: 0.9 };
      return g;
    }
    const g = new THREE.Group();
    const h = rand(1.2, 1.8);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.32, h, 6), trunkMat);
    trunk.position.y = h / 2;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(rand(1.0, 1.3), rand(2.2, 3), 6), leafMat);
    cone.position.y = h + 0.9;
    g.add(trunk, cone);
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    g.userData = { type: 'wood', radius: 0.9 };
    return g;
  }
  function makeRock() {
    const s = rand(0.6, 1.2);
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rockMat);
    m.scale.y = rand(0.7, 1);
    m.position.y = s * 0.55;
    m.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
    m.castShadow = m.receiveShadow = true;
    const g = new THREE.Group();
    g.add(m);
    g.userData = { type: 'stone', radius: s * 0.95 };
    return g;
  }
  // 자원 생성 위치: 마을 안쪽(중앙 십자 통로 제외) / 1~2단계 성벽 사이 고리 / 맵 전체. 통로(출입구로 이어지는 길)는 항상 비워 둔다
  function samplePoint() {
    const Z = CFG.SPAWN_ZONES;
    for (let k = 0; k < 12; k++) {
      const r = Math.random();
      let x, z;
      if (r < Z.inner) { x = rand(-11, 11); z = rand(-11, 11); }
      else if (r < Z.inner + Z.annulus) {
        const c = rand(18.5, 22.5), t = rand(-22.5, 22.5), sg = Math.random() < 0.5 ? -1 : 1;
        if (Math.random() < 0.5) { x = sg * c; z = t; } else { x = t; z = sg * c; }
      } else { x = rand(-MAP + 3, MAP - 3); z = rand(-MAP + 3, MAP - 3); }
      const inBase = Math.max(Math.abs(x), Math.abs(z)) < 26;
      if (inBase && (Math.abs(x) < 2.8 || Math.abs(z) < 2.8)) continue;       // 출입구로 이어지는 길
      return [x, z];
    }
    return [rand(-MAP + 3, MAP - 3), rand(-MAP + 3, MAP - 3)];
  }
  function biomeDensity(type, x, z) {                                        // 지대별 자원 밀도 (0~1)
    if (Math.max(Math.abs(x), Math.abs(z)) < 34) return 1;
    const b = biomeAt(x, z);
    return type === 'wood' ? { forest: 1, meadow: 0.5, marsh: 0.3, rock: 0.15 }[b] : type === 'stone' ? { forest: 0.3, meadow: 0.5, marsh: 0.15, rock: 1 }[b] : 1;
  }
  function scatter(factory, count, ok = () => true) {
    for (let i = 0; i < count; i++) {
      const o = factory();
      for (let tries = 0; tries < 60; tries++) {
        const [x, z] = samplePoint();
        if (Math.hypot(x, z) < 6 || inRiver(x, z) || !ok(x, z)) continue;   // 모닥불 주변 비우기
        if (Math.random() > biomeDensity(o.userData.type, x, z)) continue;       // 숲에는 나무, 고원에는 바위가 많다
        if (obstacles.some(p => Math.hypot(p.position.x - x, p.position.z - z) < p.userData.radius + o.userData.radius + 0.8)) continue;
        o.position.set(x, Math.max(0, terrH(x, z)), z);
        o.rotation.y = rand(0, Math.PI * 2);
        scene.add(o);
        obstacles.push(o);
        break;
      }
    }
  }
  scatter(makeTree, CFG.TREE_COUNT);
  scatter(makeRock, CFG.STONE_COUNT);

  const R = 0.45, H = 0.7;
  // ---------- 플레이어 ----------
  const player = new THREE.Group();
  const playerRig = makeRig('player', 0xa4492f, { seed: 11 });
  const bodyMat = playerRig.bodyMat;
  const playerAnim = new Anim(playerRig);
  player.add(playerRig.root);
  scene.add(player);
  const PLAYER_R = 0.5;

  // ---------- 카메라 (Orbit + Lerp) ----------
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
  let yaw = 0, pitch = 0.45;
  let titleMode = false, titleAng = 0.6;                                 // 시작 화면: 완성된 성 마을 둘레를 천천히 도는 카메라
  let DIST = 8, DIST_MAX = 22; const LOOK_H = 1.6, DIST_MIN = 4;
  function setCamMax() { DIST_MAX = stage >= 4 ? 34 : stage >= 3 ? 28 : 22; }       // 단계가 오를수록 마을이 커지므로 더 멀리 볼 수 있다
  let exActive = null, exEnding = false; const exObjs = [], EXC = { x: 600, z: 0 }; let exR = 46;              // 원정 중이면 exActive, 원정 지역은 마을(반경 50)에서 멀리 떨어진 곳
  let bird = false, savedView = null, camFront = false, birdX = 0, birdZ = 0;      // camFront: 영웅의 앞모습을 보는 카메라 / birdX,Z: 지도 보기의 카메라 초점(자유롭게 이동)                                // 버드아이 뷰: 마을 전체를 한눈에
  const camFocus = () => bird ? { x: birdX, z: birdZ } : player.position;
  const setDist = d => { DIST = bird ? Math.min(150, Math.max(5, d)) : Math.min(DIST_MAX, Math.max(DIST_MIN, d)); };
  const camGoal = new THREE.Vector3(), lookAt = new THREE.Vector3();
  const viewYaw = () => yaw + (camFront && !bird ? Math.PI : 0);          // 카메라가 실제로 놓이는 각도 (앞모습 보기에서는 영웅 정면에 놓인다)
  function goalPos(out) {
    const va = viewYaw();
    return out.set(
      camFocus().x + Math.sin(va) * Math.cos(pitch) * DIST,
      LOOK_H + (bird ? 0 : player.position.y) + Math.sin(pitch) * DIST,
      camFocus().z + Math.cos(va) * Math.cos(pitch) * DIST);
  }
  camera.position.copy(goalPos(camGoal));
  lookAt.set(0, LOOK_H, 0);

  function resize() {
    const vw = canvas.clientWidth || innerWidth, vh = canvas.clientHeight || innerHeight;                  // the game area (below the ad banner)
    renderer.setSize(vw, vh, false);
    camera.aspect = vw / vh;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();

  // ---------- 카메라 회전 입력 ----------
  // Desktop: left-drag on the canvas (buttons are separate elements) / Mobile: drag on the right side, two-finger pinch to zoom
  let tapStart = null;
  const look = { id: null, x: 0, y: 0 };
  const ptrs = new Map();            // active canvas pointers (for pinch)
  let pinchD = 0;
  const pinchDist = () => { const [p, q] = [...ptrs.values()]; return Math.hypot(p.x - q.x, p.y - q.y); };
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  let panMid = null, panId = null;
  const panView = (dx, dy) => {                                     // 지도 보기: 두 손가락 / 마우스 오른쪽 드래그로 카메라 초점을 옮긴다
    const sc = DIST * 0.0016, rx = Math.cos(yaw), rz = -Math.sin(yaw), fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const ox = exActive ? EXC.x : 0, oz = exActive ? EXC.z : 0;
    birdX = ox + Math.max(-140, Math.min(140, birdX - ox + (-rx * dx + fx * dy) * sc)); birdZ = oz + Math.max(-140, Math.min(140, birdZ - oz + (-rz * dx + fz * dy) * sc));
  };
  canvas.addEventListener('pointerdown', e => {
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (bird && e.pointerType === 'mouse' && e.button === 2) { panId = e.pointerId; panMid = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); return; }
    if (e.pointerType === 'touch' && ptrs.size === 2) { look.id = null; pinchD = pinchDist(); tapStart = null; panMid = null; return; }
    const ok = e.pointerType === 'mouse' ? e.button === 0 : true;       // 버튼과 조이스틱이 아닌 화면 어디서든 끌어서 카메라를 돌린다
    if (!ok || look.id !== null) return;
    look.id = e.pointerId; look.x = e.clientX; look.y = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    const p = ptrs.get(e.pointerId); if (p) { p.x = e.clientX; p.y = e.clientY; }
    if (e.pointerId === panId && panMid) { panView(e.clientX - panMid.x, e.clientY - panMid.y); panMid.x = e.clientX; panMid.y = e.clientY; return; }
    if (ptrs.size === 2 && e.pointerType === 'touch') {
      const d = pinchDist();
      if (pinchD > 0 && d > 0) setDist(DIST * pinchD / d);
      pinchD = d;
      if (bird) { const [a, b] = [...ptrs.values()], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; if (panMid) panView(mx - panMid.x, my - panMid.y); panMid = { x: mx, y: my }; }
      return;
    }
    if (e.pointerId !== look.id) return;
    yaw -= (e.clientX - look.x) * 0.006;
    pitch = Math.min(bird ? 1.5 : 1.2, Math.max(bird ? 0.12 : 0.1, pitch + (e.clientY - look.y) * 0.005));
    look.x = e.clientX; look.y = e.clientY;
  });
  const lookEnd = e => { ptrs.delete(e.pointerId); pinchD = 0; if (e.pointerId === panId) panId = null; panMid = null; if (e.pointerId === look.id) look.id = null; };
  canvas.addEventListener('pointerup', lookEnd);
  canvas.addEventListener('pointercancel', lookEnd);
  canvas.addEventListener('wheel', e => { e.preventDefault(); setDist(DIST * Math.exp(e.deltaY * 0.001)); }, { passive: false });

  // ---------- 가상 조이스틱 (Canvas) ----------
  const joyCanvas = document.getElementById('joy');
  const jctx = joyCanvas.getContext('2d');
  const joy = { x: 0, y: 0, id: null };   // x: 오른쪽 +, y: 위쪽 +
  const JC = 75, JMAX = 50;
  function drawJoy() {
    jctx.clearRect(0, 0, 150, 150);
    jctx.beginPath(); jctx.arc(JC, JC, JMAX + 10, 0, 7);
    jctx.fillStyle = 'rgba(255,255,255,.12)'; jctx.fill();
    jctx.lineWidth = 3; jctx.strokeStyle = 'rgba(255,255,255,.4)'; jctx.stroke();
    jctx.beginPath(); jctx.arc(JC + joy.x * JMAX, JC - joy.y * JMAX, 28, 0, 7);
    jctx.fillStyle = 'rgba(255,190,110,.8)'; jctx.fill();
    jctx.strokeStyle = 'rgba(255,255,255,.8)'; jctx.stroke();
  }
  function joyUpdate(e) {
    const r = joyCanvas.getBoundingClientRect();
    let dx = e.clientX - r.left - JC, dy = e.clientY - r.top - JC;
    const l = Math.hypot(dx, dy);
    if (l > JMAX) { dx = dx / l * JMAX; dy = dy / l * JMAX; }
    joy.x = dx / JMAX; joy.y = -dy / JMAX;
    drawJoy();
  }
  const joyEnd = e => { if (e.pointerId !== joy.id) return; joy.id = null; joy.x = joy.y = 0; drawJoy(); };
  joyCanvas.addEventListener('pointerdown', e => {
    if (joy.id !== null) return;
    joy.id = e.pointerId; joyCanvas.setPointerCapture(e.pointerId); joyUpdate(e);
  });
  joyCanvas.addEventListener('pointermove', e => { if (e.pointerId === joy.id) joyUpdate(e); });
  joyCanvas.addEventListener('pointerup', joyEnd);
  joyCanvas.addEventListener('pointercancel', joyEnd);
  drawJoy();

  // ---------- 키보드 ----------
  const keys = {};
  addEventListener('keydown', e => {
    if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) jump(); }
    if (e.code === 'KeyR' && !e.repeat) dash();
    if (e.code === 'KeyM' && !e.repeat) toggleLeaderMount();
    if (e.code === 'KeyG' && !e.repeat) gather();
    if (e.code === 'KeyE' && !e.repeat) ultimate();
    if (e.code === 'KeyF' && !e.repeat) attack();
    if (e.code === 'KeyQ' && !e.repeat) swapWeapon();
    if (e.code === 'KeyC' && !e.repeat) { if (smithEl.style.display === 'flex') closeSmith(); else openSmith(); }
    keys[e.code] = true;
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  // ---------- 사운드: WebAudio 합성 (외부 파일 없음) + 낮/밤/습격 배경음 ----------
  const sfxAt = (name, x, z) => { const v = 1 - Math.hypot(x - player.position.x, z - player.position.z) / 45; if (v > 0.03) Snd.play(name, v); };
  for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => Snd.init());
  addEventListener('keydown', e => { if (e.code === 'KeyM' && !e.repeat) Snd.toggle(); });
  document.getElementById('muteBtn').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); Snd.init(); Snd.toggle(); });
  Snd.setMuted(Snd.isMuted());

  // ---------- 자원 / 상호작용 ----------
  let playerClass = null, order = 'guard', rallyT = 0;
  const perks = {};                                                  // 시대 -> 퍼크 id
  // 주인공 성장: 처치·원정·생존으로 경험치를 얻고, 레벨이 오를 때마다 세 가지 중 하나를 고른다 (유물을 찾으면 보너스 선택)
  const ST0 = () => ({ hp: 0, dmg: 0, spd: 0, dash: 0, ult: 0, leech: 0, guard: 0, rally: 0, spear: 0, fletch: 0, regen: 0, forage: 0, cleave: 0, whirl: 0, standard: 0, bannerlord: 0, warcommand: 0, horsemaster: 0, drillmaster: 0, lunge: 0, impale: 0, evade: 0, vault: 0, stride: 0 });      // 영웅 성장 기본값 (새 항목은 옛 저장에서 0)
  const pl = { lvl: 1, xp: 0, pend: 0, st: ST0() };
  const PL_MAX = 12, xpNeed = (l) => 40 + 35 * (l - 1);
  let diff = 'normal', ngLevel = 0;
  try { const d0 = localStorage.getItem('nf_diff'); if (d0 && CFG.DIFFS[d0]) diff = d0; } catch (e) {}
  const dm = () => { const d = CFG.DIFFS[diff]; return { hp: d.hp * (1 + 0.4 * ngLevel), n: d.n * (1 + 0.25 * ngLevel), dmg: d.dmg * (1 + 0.2 * ngLevel) }; };
  const scaleHp = (h) => Math.round((h * dm().hp + (dm().hp - 1) * 1.2) * 10) / 10;
  const hasPerk = (id) => Object.values(perks).includes(id);
  const pMaxHp = () => CFG.PLAYER_MAX_HP + (playerClass === 'warrior' ? 30 : playerClass === 'commander' ? -20 : 0) + 20 * pl.st.hp + (story.dusk ? 20 : 0);
  const pDmg = () => (playerClass === 'warrior' ? 1.25 : playerClass === 'commander' ? 0.8 : 1) * (1 + 0.15 * pl.st.dmg) * (story.dusk ? 1.1 : 1) * (dashBonusT > 0 ? 1 + 0.25 * pl.st.vault : 1) * leaderMountMul();
  const gatherYield = (t) => CFG.GATHER_YIELD[t] + (hasPerk('forager') ? 1 : 0) + (pl.st.forage >= 3 ? 1 : 0) + (pl.st.forage >= 5 ? 1 : 0);
  const fenceHp = () => CFG.FENCE_HP * (hasPerk('fortifier') ? 1.5 : 1), wallHp = () => CFG.WALL_HP * (hasPerk('engineer') ? 1.5 : 1) * (hasPerk('bastion') ? 1.25 : 1);
  const dashMul = () => (playerClass === 'warrior' ? 0.8 : 1) * (hasPerk('warlord') ? 0.75 : 1) * 0.88 ** pl.st.dash;
  const spdMul = () => (playerMounted ? CFG.CAV.SPEED * (1 + 0.08 * pl.st.horsemaster) : 1) * (hasPerk('scout') ? 1.1 : 1) * (1 + 0.06 * pl.st.spd) * (pl.st.stride && !enemyWithin(player.position.x, player.position.z, 20) ? 1 + 0.08 * pl.st.stride : 1);       // Long Stride: 적이 가까이 없을 때만
  const gearCost = (d) => hasPerk('smith') ? Object.fromEntries(Object.entries(d.cost).map(([k, v]) => [k, Math.ceil(v * 0.75)])) : d.cost;
  const npcMaxHp = (role, trait) => Math.round(ROLE[role].hp * (CFG.TRAITS[trait].hp || 1) * (hasPerk('lord') && role !== 'citizen' ? 1.15 : 1));
  const vetLv = (n) => { const x = n.vxp || 0; return x >= 40 ? 3 : x >= 20 ? 2 : x >= 8 ? 1 : 0; };
  // individual growth: soldiers gain Strength (damage) and Speed (move and attack rate) from fighting at all, not only from killing, so a whole band that fights together grows together; soft caps (+30% / +15%)
  const fgrow = (x, k) => 1 - Math.exp(-(x || 0) / k);
  const soldierStr = (n) => !n || n.role === 'citizen' ? 1 : 1 + 0.30 * fgrow(n.cstr, 150), soldierSpd = (n) => !n || n.role === 'citizen' ? 1 : 1 + 0.15 * fgrow(n.cspd, 200);
  function fightGain(n, s, p) {
    if (!n || n.role === 'citizen' || n.down) return;
    const a = Math.floor(fgrow(n.cstr, 150) * 8), b = Math.floor(fgrow(n.cspd, 200) * 8);
    n.cstr = (n.cstr || 0) + s; n.cspd = (n.cspd || 0) + p;
    if (Math.floor(fgrow(n.cstr, 150) * 8) > a) floatText('Stronger!', n.position.x, 3.2, n.position.z); else if (Math.floor(fgrow(n.cspd, 200) * 8) > b) floatText('Quicker!', n.position.x, 3.2, n.position.z);
  }
  const courageOf = () => Math.max(0, Math.min(100, story.courage ?? CFG.COURAGE.START));
  const courageMul = () => { const c = courageOf() / 100, K = CFG.COURAGE; return c <= 0.7 ? K.MIN_MUL + (1 - K.MIN_MUL) * c / 0.7 : 1 + (K.MAX_MUL - 1) * (c - 0.7) / 0.3; };       // 0 = 0.75, 70 = 1.0, 100 = 1.1
  function addCourage(d) { const was = courageOf(); story.courage = Math.max(0, Math.min(100, was + d)); if (story.courage <= 0 && was > 0 && exActive) toast('The host loses heart and falls back!'); }
  const soldierMult = (n) => (1 + 0.06 * vetLv(n)) * soldierStr(n) * standardMods(n).dmg * mountMul(n) * (rallyT > 0 ? 1.5 : 1) * (hasPerk('lord') ? 1.1 : 1) * (story.dawn ? 1.1 : 1) * (story.wide ? 1.1 : 1) * (story.dusk ? 1.1 : 1) * gateBonus(n) * (hasPerk('veteran') ? 1.1 : 1) * courageMul() * (n.levy ? CFG.LEVY.DMG : 1);
  const res = { wood: 40, stone: 0, food: 0, iron: 0, shard: 0 };
  let weaponMode = 'sword', blocking = false, blockBtn = false;
  const playerGear = { sword: 'sword_basic', bow: 'bow_basic', armor: 'armor_none', great: 'great_basic', spear: 'spear_basic' };
  const gearDef = (id) => CFG.GEAR[id];
  // 영웅의 무기: 대검과 창은 대장간에서 각자의 장비를 따로 키운다 (옛 저장은 칼과 같은 등급으로 이어받는다)
  const weaponDef = (m) => gearDef(m === 'great' ? (playerGear.great || 'great_basic') : m === 'spear' ? (playerGear.spear || 'spear_basic') : playerGear.sword);
  function gearAtTier(slot, tier) { let best = null; for (const id in CFG.GEAR) { const d = CFG.GEAR[id]; if (d.slot === slot && d.tier <= tier && (!best || d.tier > best.tier)) best = d; } return best ? best.id : null; }
  const bestPlayerTier = () => Math.max(gearDef(playerGear.sword).tier, weaponDef('great').tier, weaponDef('spear').tier);
  function soldierWeaponDef(n) {                               // 병사: 직업에 맞는 장비와 칼 중 더 좋은 것
    const slot = n.cls === 'greatsword' ? 'great' : n.cls === 'spear' ? 'spear' : 'sword', a = gearDef(n.gear.sword), b = slot !== 'sword' && n.gear[slot] ? gearDef(n.gear[slot]) : null;
    return b && b.tier > a.tier ? b : a;
  }
  function applyPlayerGear() {
    const vis = weaponMode;
    playerRig.brawl = vis === 'none'; playerRig.main = vis; playerRig.style = vis === 'sword' ? 'ss' : vis === 'great' ? 'gs' : vis === 'bow' ? 'bow' : '';
    playerRig.setGear('great', { ...weaponDef('great'), slot: 'sword', great: true });
    playerRig.setGear('sword', gearDef(playerGear.sword)); playerRig.setGear('bow', gearDef(playerGear.bow)); { const sd = weaponDef('spear'); playerRig.setGear('spear', { id: 'spear_' + sd.id, slot: 'spear', tier: sd.tier, color: sd.color }); } playerRig.setArmor(null);       // 지휘관은 방어구를 올려도 겉모습(흉갑·투구)이 바뀌지 않는다 (피해 감소만 적용)
    playerRig.setShield({ tier: gearDef(playerGear.armor).tier || 0 });
    playerRig.hold(vis);
  }
  const woodEl = document.getElementById('woodN'), stoneEl = document.getElementById('stoneN'), ironEl = document.getElementById('ironN');
  const toastEl = document.getElementById('toast');
  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg; toastEl.style.opacity = 1;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.style.opacity = 0, 1400);
  }
  const atkEl = document.getElementById('atkN');
  const foodEl = document.getElementById('foodN');
  function updateHud() { updateLvlUi(); woodEl.textContent = res.wood; stoneEl.textContent = res.stone; ironEl.textContent = res.iron; if (res.shard > 0) { document.getElementById('shardRow').style.display = ''; document.getElementById('shardN').textContent = res.shard; } foodEl.textContent = Math.floor(res.food); { const sw = gearDef(playerGear.sword), bw = gearDef(playerGear.bow), ar = gearDef(playerGear.armor); atkEl.textContent = `${sw.short} ${sw.dmg} / ${bw.short} ${bw.dmg}`; document.getElementById('armN').textContent = ar.reduce ? `${ar.short} -${Math.round(ar.reduce * 100)}%` : 'None'; } }

  function rollIron(o) {                     // 바위를 캘 때 일정 확률로 철도 나온다 (대장간 재료)
    if (o.userData.type !== 'stone' || Math.random() > CFG.IRON_CHANCE) return;
    res.iron += 1; floatText('Iron +1', o.position.x, 2.2, o.position.z);
  }
  const GATHER_RANGE = 2.6;
  // 플레이어 채집: 버튼을 누르면 CFG.PLAYER_GATHER_TIME초 동안 들썩이며 진행 바가 차고, 이동하면 취소된다 (NPC와 같은 템포)
  let gathering = null;
  function gather() {
    if (playerMounted) leaderDismount();
    if (dead || gathering) return;
    let best = null, bestD = GATHER_RANGE;
    for (const o of (exActive ? exObjs : obstacles)) {
      if (o.userData.type !== 'wood' && o.userData.type !== 'stone' && o.userData.type !== 'chest' && o.userData.type !== 'siegeLadder' && !(o.userData.type === 'banditBanner' && exCamp && !exCamp.broken)) continue;
      const d = Math.hypot(o.position.x - player.position.x, o.position.z - player.position.z) - o.userData.radius;
      if (d < bestD) { bestD = d; best = o; }
    }
    if (!best) return toast('Nothing to gather nearby');
    gathering = { target: best, t: 0 }; playerAnim.breakCombo();
  }

  const fenceMat = texMat(0x946038, 'wood', 0.9), wallMat = texMat(0x55585e, 'stone', 0.5);
  const UPGRADE_RANGE = 3.2;
  function nearestFence(level) {
    let best = null, bd = UPGRADE_RANGE;
    for (const o of obstacles) {
      if (o.userData.type !== 'fence' || (level && o.userData.level !== level)) continue;
      const d = Math.hypot(o.position.x - player.position.x, o.position.z - player.position.z);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }
  // 청사진: 충돌 판정이 없고(obstacles에 넣지 않음) 적도 무시하는 반투명 목책. 동료 NPC가 실물로 건설한다.
  const blueprints = [];
  const gateWaypoints = [];              // 출입구(Gap) 좌표 {x, z, r(소속 성벽 반지름)} - NPC 길찾기용 경유지
  const matMat = new THREE.MeshStandardMaterial({ color: 0x8a8d92, roughness: 1 });
  const matGeo = new THREE.BoxGeometry(3.2, 0.04, 3.2);
  const bpGeo = new THREE.BoxGeometry(2.4, 1.1, 0.35);
  function createFence(x, z, rot) {
    const fm = structMesh('fence'), fence = fm ? new THREE.Mesh(fm.geometry, fm.material) : new THREE.Mesh(bpGeo, fenceMat);       // 나무 목책 모델
    fence.position.set(x, fm ? 0 : 0.55, z);
    fence.rotation.y = rot;
    fence.castShadow = fence.receiveShadow = true;
    fence.userData = { type: 'fence', level: 'wood', radius: 1.2, hp: fenceHp(), maxHp: fenceHp() };
    scene.add(fence);
    obstacles.push(fence);
    return fence;
  }
  const wallGeo = new THREE.BoxGeometry(3.0, 1.4, 0.5);
  // Fort wall: the outermost ring (the Great Wall, half-width 40) is as tall as the gate towers (4.4 m) and cannot be jumped over: a stone body with a walkway ledge and merlons along the top
  const isFortSpot = (x, z) => Math.max(Math.abs(x), Math.abs(z)) > 32;
  let fortGeo = null; const fortMat = texMat(0x969aa4, 'stone', 0.4);
  function fortWallGeo() {
    if (fortGeo) return fortGeo; const it = [], add = (w, h, d, x, y, z) => { const m = new THREE.Matrix4().makeTranslation(x, y, z); it.push([new THREE.BoxGeometry(w, h, d), m]); };
    add(3.3, 3.9, 1.1, 0, 1.95, 0); add(3.3, 0.22, 1.5, 0, 3.95, 0);                                              // body, overhanging walkway ledge
    for (const mx of [-1.2, -0.4, 0.4, 1.2]) add(0.55, 0.55, 1.5, mx, 4.33, 0);                                  // merlons
    return fortGeo = mergeGeos(it);
  }
  function createWall(x, z, rot) {              // 돌 성벽 (짙은 회색, HP 100)
    if (isFortSpot(x, z)) { const f = new THREE.Mesh(fortWallGeo(), fortMat); f.position.set(x, 0, z); f.rotation.y = rot; f.castShadow = f.receiveShadow = true; f.userData = { type: 'fence', level: 'stone', tall: true, radius: 1.6, hp: wallHp() * 1.5, maxHp: wallHp() * 1.5 }; scene.add(f); obstacles.push(f); return f; }
    const wm = structMesh('wall'), w = wm ? new THREE.Mesh(wm.geometry, wm.material) : new THREE.Mesh(wallGeo, wallMat);       // 벽돌 성벽 모델
    w.position.set(x, wm ? 0 : 0.7, z);
    w.rotation.y = rot;
    w.castShadow = w.receiveShadow = true;
    w.userData = { type: 'fence', level: 'stone', radius: 1.5, hp: wallHp(), maxHp: wallHp() };
    scene.add(w);
    obstacles.push(w);
    return w;
  }
  const createStructure = (kind, x, z, rot) => kind === 'stone' ? createWall(x, z, rot) : createFence(x, z, rot);
  // ---------- 마을 자동 확장: 사각형 방어선 도면 ----------
  function addBlueprint(kind, x, z, rot) {
    const stone = kind === 'stone';
    const bp = new THREE.Mesh(stone ? wallGeo : bpGeo,
      new THREE.MeshBasicMaterial({ color: stone ? 0xc8d8ff : 0x4aa8ff, transparent: true, opacity: 0.4, depthWrite: false }));
    bp.position.set(x, stone ? 0.7 : 0.55, z);
    bp.rotation.y = rot;
    bp.userData = { type: 'blueprint', res: kind, radius: stone ? 1.5 : 1.2, owner: null };
    scene.add(bp);
    blueprints.push(bp);
  }
  // ----- 마을 건물 (거주지 / 병영 / 사격장) -----
  const bMat = (c) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 1 });
  const houseWall = texMat(0xd2ac70, 'plaster', 0.6), houseRoof = texMat(0xb04e2c, 'shingle', 0.7), barrackMat = texMat(0x858a94, 'rough', 0.9), barrackTop = texMat(0x626772, 'shingle', 0.7);
  const woodMat2 = texMat(0x946038, 'wood', 0.9), tgtRed = new THREE.MeshStandardMaterial({ color: 0xd23a2a, roughness: 1 }), tgtWhite = new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 1 });
  function faceOf(x, z) {              // 가장 가까운 큰길(x=0 또는 z=0 십자 길)을 향하는 방향
    if (Math.abs(x) < Math.abs(z)) return { x: x > 0 ? -1 : 1, z: 0 };
    return { x: 0, z: z > 0 ? -1 : 1 };
  }
  function doorOf(b) {                 // 건물 앞 출입 지점: 길을 향한 쪽
    const f = b.userData.face, off = b.userData.radius + 0.9;
    if (f) return { x: b.position.x + f.x * off, z: b.position.z + f.z * off };
    const d = Math.hypot(b.position.x, b.position.z) || 1;
    return { x: b.position.x - b.position.x / d * off, z: b.position.z - b.position.z / d * off };
  }
  const windowGlow = new THREE.MeshBasicMaterial({ color: 0x2a2a33 }), lampGlow = new THREE.MeshBasicMaterial({ color: 0x2a2a33 });        // 밤이 되면 따뜻하게 켜진다 (tick)
  const forgeGlow = new THREE.MeshBasicMaterial({ color: 0xff7a1a }), anvilMat = bMat(0x34363c);
  const tentMat = bMat(0xd9c9a0), tentDoor = bMat(0x4a3a24), stoneWall = texMat(0x969aa4, 'rough', 0.9), slateRoof = texMat(0x545864, 'shingle', 0.7), chimneyMat = texMat(0x6f727a, 'rough', 0.9);
  const dirt = bMat(0x6b4a2b), cropMat = bMat(0x4fae3a), logPile = bMat(0x7a4f2a), rockPile = bMat(0x9a9aa2), towerStone = bMat(0x7f838c), towerTop = bMat(0x5c606a);
  // 거주지 외형은 시대에 따라 바뀐다: 1시대 텐트(원뿔) → 2시대 나무집(삼각 지붕) → 3시대 돌집
  function setHouseModel(g) {
    const lvl = g.userData.level || 1;
    while (g.children.length) g.remove(g.children[0]);
    const add = (geo, m, px, py, pz) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
    const tentM = lvl <= 1 && structMesh('tent');
    if (tentM) { g.add(tentM); }                                         // 1시대: 모델 텐트
    else if (lvl <= 1) {
      add(new THREE.ConeGeometry(1.9, 2.6, 8), tentMat, 0, 1.3, 0);
      add(new THREE.BoxGeometry(0.7, 1.1, 0.12), windowGlow, 0, 0.55, 1.6).rotation.x = -0.35;
    } else {                                                           // 2단계 목골 집 / 3단계 이상 돌집 (04b-models.js)
      houseModel(g, lvl);
    }
  }
  function refreshHouses() { for (const h of obstacles) if (h.userData.type === 'building' && h.userData.kind === 'house') setHouseModel(h); }
  function createBuilding(kind, x, z) {
    const g = new THREE.Group();
    const add = (geo, m, px, py, pz) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
    g.userData = { type: 'building', kind, radius: CFG.BUILDING[kind].radius, worker: null, seed: Math.abs(Math.floor(x * 73.1 + z * 131.7) * 2654435761 | 0) || 7 };
    if (['house', 'barracks', 'smith', 'range', 'market', 'siegeshop'].includes(kind)) g.userData.face = faceOf(x, z);
    if (CFG.LEVELED.includes(kind)) g.userData.level = 1;
    const sm = (kind === 'well' || kind === 'smith' || kind === 'range') && structMesh(kind);        // 모델이 있으면 모델 건물
    if (sm) g.add(sm);
    if (kind === 'house') {
      g.userData.level = stage;                                          // 새 집은 현재 시대의 모습으로 지어진다
      setHouseModel(g);
    } else if (kind === 'siegeshop') {                                   // 공성 작업장: 열린 헛간, 안에 망치 뼈대와 사다리 걸이
      for (const [px, pz] of [[-2.6, -1.8], [2.6, -1.8], [-2.6, 1.8], [2.6, 1.8]]) add(new THREE.BoxGeometry(0.28, 2.6, 0.28), woodMat2, px, 1.3, pz);
      add(new THREE.BoxGeometry(6.2, 0.22, 4.6), houseRoof, 0, 2.7, 0).rotation.z = 0.06;
      add(new THREE.BoxGeometry(1.5, 0.5, 3.4), woodMat2, -0.6, 0.55, 0); add(new THREE.CylinderGeometry(0.3, 0.3, 3.8, 8), logPile, -0.6, 1.1, 0).rotation.x = Math.PI / 2;
      for (const lz of [-1.4, 1.4]) add(new THREE.BoxGeometry(0.1, 2.4, 0.1), woodMat2, 2.2, 1.2, lz);
    } else if (kind === 'plaza') { plazaModel(add);
    } else if (kind === 'muster') { musterModel(add);
    } else if (kind === 'pen') { g.userData.sheep = penModel(add, g.userData.seed, (o) => g.add(o));
    } else if (kind === 'windmill') { windmillModel(add, g);
    } else if (kind === 'infirmary') { infirmaryModel(add);
    } else if (kind === 'monument') { monumentModel(add, g);
    } else if (kind === 'trainyard') { trainyardModel(add, g);
    } else if (kind === 'stable') { g.userData.sheep = stableModel(add, g.userData.seed, (o) => g.add(o));
    } else if (kind === 'barracks') {                                    // 평평하고 넓은 회색 건물
      barracksModel(add);
    } else if (kind === 'range' && sm) {
    } else if (kind === 'well' && sm) {
    } else if (kind === 'smith' && sm) {
      const rack = new THREE.Group(); rack.position.set(3.1, 0, 0.3);                       // 완성된 장비가 걸리는 선반
      for (const dz of [-1.1, 1.1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.5, 0.14), woodMat2); post.position.set(0, 0.75, dz); post.castShadow = true; rack.add(post); }
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 2.4), woodMat2); bar.position.set(0, 1.4, 0); rack.add(bar);
      const items = new THREE.Group(); rack.add(items); g.add(rack);
      g.userData.rackItems = items;
      g.userData.stock = {};
      for (const id in CFG.GEAR) if (CFG.GEAR[id].cost) g.userData.stock[id] = 0;
    } else if (kind === 'range') {                                       // 사격장: 나무 단상 + 앞의 원형 과녁
      add(new THREE.BoxGeometry(4.4, 0.4, 3.0), woodMat2, 0, 0.2, 0);
      add(new THREE.BoxGeometry(0.2, 1.6, 0.2), woodMat2, 0, 0.8, -3.2);
      for (const [r, m, yy] of [[0.9, tgtRed, 0], [0.62, tgtWhite, 0.02], [0.32, tgtRed, 0.04]]) {
        const t = add(new THREE.CylinderGeometry(r, r, 0.12, 24), m, 0, 1.7, -3.2 - yy); t.rotation.x = Math.PI / 2;
      }
    } else if (kind === 'farm') {                                        // 네모난 갈색 밭 + 자라나는 작물
      add(new THREE.BoxGeometry(5, 0.12, 4), dirt, 0, 0.06, 0);
      g.userData.crops = [];
      for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) {
        const c = add(new THREE.ConeGeometry(0.22, 0.7, 5), cropMat, -2 + i * 0.8, 0.4, -1.4 + j * 0.9);
        c.scale.y = 0.3; g.userData.crops.push(c);
      }
      g.userData.growth = 0.3;
    } else if (kind === 'lumber') {                                      // 벌목장: 나무 오두막 + 통나무 더미
      lumberModel(add);
    } else if (kind === 'quarry') {                                      // 채석장: 바위 더미 + 곡괭이 틀
      quarryModel(add);
    } else if (kind === 'well') {                                        // 우물: 돌 테두리 + 물 + 작은 지붕
      add(new THREE.CylinderGeometry(1.0, 1.1, 0.7, 12), stoneWall, 0, 0.35, 0);
      add(new THREE.CylinderGeometry(0.78, 0.78, 0.05, 12), new THREE.MeshStandardMaterial({ color: 0x3a78c8, roughness: 0.3 }), 0, 0.7, 0);
      for (const sx of [-0.95, 0.95]) add(new THREE.BoxGeometry(0.12, 1.5, 0.12), woodMat2, sx, 1.1, 0);
      add(new THREE.ConeGeometry(1.35, 0.7, 4), houseRoof, 0, 2.2, 0).rotation.y = Math.PI / 4;
    } else if (kind === 'market') {                                      // 시장: 나무 단상 + 색색 천막 가판 3개 + 등불
      add(new THREE.BoxGeometry(5.0, 0.2, 3.2), woodMat2, 0, 0.1, 0);
      [0xc0392b, 0x2f7fc0, 0xd9a92a].forEach((c, i) => {
        const x = -1.7 + i * 1.7, awn = new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 1 });
        add(new THREE.BoxGeometry(1.3, 0.6, 0.9), woodMat2, x, 0.5, 0.5);
        add(new THREE.BoxGeometry(1.5, 0.08, 1.3), awn, x, 1.7, 0.45).rotation.x = 0.18;
        for (const dx of [-0.65, 0.65]) add(new THREE.BoxGeometry(0.08, 1.4, 0.08), woodMat2, x + dx, 1.0, 1.0);
        add(new THREE.BoxGeometry(0.3, 0.2, 0.3), [cropMat, logPile, rockPile].at(i), x, 0.9, 0.5);
      });
      for (const lx of [-2.3, 2.3]) { add(new THREE.CylinderGeometry(0.05, 0.05, 1.8, 5), woodMat2, lx, 1.0, -1.4); add(new THREE.SphereGeometry(0.16, 8, 6), lampGlow, lx, 2.0, -1.4); }
    } else if (kind === 'smith') {                                       // 대장간: 석조 작업장 + 굴뚝 + 모루 + 완성품 선반
      add(new THREE.BoxGeometry(4.0, 1.5, 3.0), stoneWall, 0, 0.75, 0);
      add(new THREE.BoxGeometry(4.5, 0.22, 3.5), slateRoof, 0, 1.62, 0);
      add(new THREE.BoxGeometry(0.7, 2.4, 0.7), chimneyMat, -1.4, 2.0, -0.9);
      add(new THREE.BoxGeometry(0.46, 0.1, 0.46), forgeGlow, -1.4, 3.22, -0.9);
      add(new THREE.BoxGeometry(1.0, 0.7, 0.1), forgeGlow, 0.6, 0.65, 1.52);                // 화덕 불빛
      add(new THREE.BoxGeometry(0.7, 0.3, 0.4), anvilMat, 1.2, 0.5, 2.5);                    // 모루 + 받침
      add(new THREE.CylinderGeometry(0.28, 0.32, 0.35, 8), woodMat2, 1.2, 0.17, 2.5);
      const rack = new THREE.Group(); rack.position.set(-2.9, 0, 0.2);                       // 완성된 장비가 걸리는 선반
      for (const dz of [-1.1, 1.1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.5, 0.14), woodMat2); post.position.set(0, 0.75, dz); post.castShadow = true; rack.add(post); }
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 2.4), woodMat2); bar.position.set(0, 1.4, 0); rack.add(bar);
      const items = new THREE.Group(); rack.add(items); g.add(rack);
      g.userData.rackItems = items;
      g.userData.stock = {};
      for (const id in CFG.GEAR) if (CFG.GEAR[id].cost) g.userData.stock[id] = 0;
    } else {                                                             // 방어 타워: 돌 원기둥 + 흉벽
      towerModel(add);
      g.userData.shootCd = rand(0, 1);
    }
    g.position.set(x, 0, z);
    if (g.userData.face) g.rotation.y = Math.atan2(g.userData.face.x, g.userData.face.z);
    scene.add(g);
    obstacles.push(g);
    if (kind !== 'farm' && kind !== 'tower' && kind !== 'lumber' && kind !== 'quarry') { const dr = doorOf(g); if (g.userData.face) addPathToRoad(dr.x, dr.z, 1.5); else addPath(dr.x, dr.z, 1.5); }      // 문 앞에서 중앙 광장까지 흙길
    return g;
  }
  // 선반에 완성품 진열 (재고 수만큼 칼/활을 걸어 둔다)
  function refreshRack(sm) {
    const grp = sm.userData.rackItems; if (!grp) return;
    while (grp.children.length) grp.remove(grp.children[0]);
    let i = 0;
    for (const id in sm.userData.stock) {
      for (let k = 0; k < Math.min(4, sm.userData.stock[id]); k++, i++) {
        const d = gearDef(id), m = d.slot === 'sword' ? makeSwordMesh(d) : d.slot === 'great' ? makeSwordMesh({ ...d, slot: 'sword', great: true }) : d.slot === 'spear' ? makeSpearMesh({ ...d, id: 'spear_' + id }) : d.slot === 'bow' ? makeBowMesh(d) : makeArmorIcon(d);
        m.scale.setScalar(0.8); m.position.set(0.12, 1.25, -1.0 + (i % 5) * 0.5);
        if (d.slot === 'armor') { m.position.y = 1.0; m.rotation.y = Math.PI / 2; }
        else if (d.slot === 'sword' || d.slot === 'great') { m.rotation.set(Math.PI / 2, 0, 0); m.position.y = 1.4; }
        else if (d.slot === 'spear') { m.rotation.set(Math.PI / 2, 0, 0); m.position.y = 1.55; m.scale.setScalar(0.6); }       // 칼날이 아래로 걸리도록
        else { m.rotation.y = Math.PI / 2; m.position.y = 0.85; }                                // 활은 세워서 (불룩한 쪽이 바깥)
        grp.add(m);
      }
    }
  }
  function addBuildingBlueprint(kind, x, z) {
    const def = CFG.BUILDING[kind];
    const size = def.size || (kind === 'house' ? [2.6, 2.4, 2.6] : kind === 'barracks' ? [6.4, 1.8, 4.4] : [4.4, 1.8, 3.0]);
    const bp = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial({ color: 0x7fe0a0, transparent: true, opacity: 0.4, depthWrite: false }));
    bp.position.set(x, size[1] / 2, z);
    bp.userData = { type: 'blueprint', res: def.res, cost: def.cost, bkind: kind, radius: def.radius, stand: def.radius + 0.9 + (kind === 'farm' ? 1.4 : 0), buildTime: CFG.BUILD_TIME_BUILDING, owner: null };
    scene.add(bp);
    blueprints.push(bp);
  }
  // 건설 부지 확보: 해당 위치의 나무/바위를 즉시 삭제
  function clearArea(x, z, r) {
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i], ty = o.userData.type;
      if ((ty === 'wood' || ty === 'stone') && Math.hypot(o.position.x - x, o.position.z - z) < o.userData.radius + r) {
        scene.remove(o); obstacles.splice(i, 1);
      }
    }
  }
  const doormats = [];                                              // 바닥 장식(도어 매트·흙길·가로등): 월드 초기화 때 함께 지운다
  const pathMat = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 1 }), lampPostMat = new THREE.MeshStandardMaterial({ color: 0x3a2a22, roughness: 1 });
  function addPath(x, z, w) {                                       // 중앙(모닥불 가장자리)에서 (x, z)까지 이어지는 다져진 흙길
    const d = Math.hypot(x, z); if (d < 2.5) return;
    const ux = x / d, uz = z / d, a = 0.9, len = d - a;
    const geo = new THREE.PlaneGeometry(w, len); geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, pathMat);
    m.position.set(ux * (a + len / 2), 0.012, uz * (a + len / 2)); m.rotation.y = Math.atan2(ux, uz); m.receiveShadow = true;
    scene.add(m); doormats.push(m);
  }
  function addPathToRoad(x, z, w) {                                 // 문 앞에서 가장 가까운 큰길(x=0 / z=0)까지 짧은 흙길
    const f = faceOf(x, z), len = f.x ? Math.abs(x) : Math.abs(z); if (len < 0.6) return;
    const geo = new THREE.PlaneGeometry(f.x ? len : w, f.x ? w : len); geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, pathMat); m.position.set(f.x ? x / 2 : x, 0.012, f.x ? z : z / 2); m.receiveShadow = true;
    scene.add(m); doormats.push(m);
  }
  function addLamp(x, z) {                                          // 가로등: 밤이 되면 불이 켜진다
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.3, 6), lampPostMat); post.position.y = 1.15; post.castShadow = true;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), lampGlow); bulb.position.y = 2.45;
    const halo = new THREE.Sprite(haloMat); halo.scale.set(2.6, 2.6, 1); halo.position.y = 2.45; halo.renderOrder = 5;       // 등불 주변의 번지는 빛
    g.add(post, bulb, halo); g.position.set(x, 0, z); scene.add(g); doormats.push(g);
    lampHalos.push(halo);
  }
  // 성벽 모서리 횃불대: 성벽을 설계하면 네 모서리에 높은 횃불대를 세운다 (밤에 켜지고 바닥에 빛 웅덩이가 퍼진다. 점광원은 쓰지 않아 폰에서도 가볍다)
  const cornerLit = [];
  function addCornerLamp(x, z) {
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 3.4, 6), lampPostMat); post.position.y = 1.7; post.castShadow = true;
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.26, 0.3, 8), lampPostMat); bowl.position.y = 3.5;
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 6), lampGlow); flame.position.y = 3.95;
    const halo = new THREE.Sprite(haloMat); halo.scale.set(5.2, 5.2, 1); halo.position.y = 3.9; halo.renderOrder = 5;
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), poolMat); pool.rotation.x = -Math.PI / 2; pool.scale.set(11, 11, 1); pool.position.y = 0.06; pool.renderOrder = 4;
    g.add(post, bowl, flame, halo, pool); g.position.set(x, 0, z); scene.add(g); doormats.push(g); lampHalos.push(halo);
  }
  // first layer too crowded: once the second wall stands, the starting houses move out to the second / third layer (the freed room stays open)
  const HOUSE_OUT = [{ x: 17, z: -16, min: 16, max: 24 }, { x: -17, z: 17, min: 16, max: 24 }, { x: 29, z: -4, min: 26, max: 37 }, { x: -29, z: -4, min: 26, max: 37 }, { x: -28, z: -26, min: 26, max: 37 }, { x: 28, z: 26, min: 26, max: 37 }, { x: -16, z: 30, min: 26, max: 37 }, { x: 16, z: -30, min: 26, max: 37 }];
  function thinFirstLayer() {
    if (!outerWallDone()) return;
    const inner = [...obstacles.filter(o => o.userData.type === 'building' && o.userData.kind === 'house'), ...blueprints.filter(b => b.userData.type === 'blueprint' && b.userData.bkind === 'house')].filter(o => cheb(o.position.x, o.position.z) < 15);
    inner.forEach((o) => {
      let pos = null; for (const t of HOUSE_OUT) { pos = findSpotNear('house', t, o, true); if (pos) break; } if (!pos) return;
      clearArea(pos.x, pos.z, 3.2); o.position.x = pos.x; o.position.z = pos.z; dust(pos.x, pos.z);
    });
  }
  function cornerLampsSync() {
    thinFirstLayer();                                      // 설계한 성벽 줄마다 한 번씩 (예전 저장·디버그 시작도 여기서 채운다)
    for (let t = 0; t < designTier && t < CFG.DESIGN.length; t++) {
      if (cornerLit[t]) continue; cornerLit[t] = true;
      const h = CFG.DESIGN[t].half - 0.4; for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) addCornerLamp(sx * h, sz * h);
    }
    if (stage >= 5) for (const g of gateWaypoints) if (g.r > 32 && !g.house) g.house = gatehouseModel(null, g);      // stage 5: only the outermost wall's gates get the gatehouse towers (the 2nd wall's gates are plain openings)
  }
  // 성문 조명: 문마다 실제 점광원 + 바닥에 퍼지는 따뜻한 빛 웅덩이 (밤에 문 앞이 충분히 밝도록)
  const haloMat = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const c = cv.getContext('2d'), gr = c.createRadialGradient(32, 32, 1, 32, 32, 31);
    gr.addColorStop(0, 'rgba(255,214,140,1)'); gr.addColorStop(0.35, 'rgba(255,170,70,.45)'); gr.addColorStop(1, 'rgba(255,140,40,0)');
    c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
    return new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false });
  })();
  const poolMat = new THREE.MeshBasicMaterial({ map: haloMat.map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false });
  const lampHalos = [], gateLights = [];
  let lampLevel = 0;
  function updateGateLights(t) {
    haloMat.opacity = Math.min(1, lampLevel * 1.1); poolMat.opacity = lampLevel * 0.3;
    for (let i = gateLights.length - 1; i >= 0; i--) {
      const l = gateLights[i];
      if (!l.parent) { gateLights.splice(i, 1); continue; }
      l.intensity = lampLevel * (2.2 + 0.2 * Math.sin(t * 7 + i * 1.7));
    }
    for (let i = lampHalos.length - 1; i >= 0; i--) if (!lampHalos[i].parent) lampHalos.splice(i, 1);
  }
  // 출입구 강화: 매일 아침 일꾼이 한 곳씩 돌기둥과 깃발을 세운다. 레벨마다 근처(5칸) 병사의 공격력 +7%
  const gateBonus = (n) => { for (const g of gateWaypoints) if ((g.lv || 1) > 1 && Math.hypot(n.position.x - g.x, n.position.z - g.z) < 5) return 1 + 0.07 * (g.lv - 1); return 1; };
  const gatePillarMat = bMat(0x7d8088);
  function setGateLevel(g, lv) {
    g.lv = lv;
    for (const m of g.meshes || []) { scene.remove(m); const i = doormats.indexOf(m); if (i >= 0) doormats.splice(i, 1); }
    g.meshes = [];
    for (const s of [-1, 1]) {
      const h = 1.8 + lv * 0.5, p = new THREE.Mesh(new THREE.BoxGeometry(0.75, h, 0.75), gatePillarMat);
      p.position.set(g.x - g.nz * 2.1 * s, h / 2, g.z + g.nx * 2.1 * s); p.castShadow = p.receiveShadow = true; scene.add(p); doormats.push(p); g.meshes.push(p);
      for (let i = 0; i < lv - 1; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.24, 0.04), bannerMat); f.position.set(p.position.x + g.nx * 0.42, h - 0.35 - i * 0.32, p.position.z + g.nz * 0.42); f.rotation.y = Math.atan2(g.nx, g.nz); scene.add(f); doormats.push(f); g.meshes.push(f); }
    }
  }
  function upgradeGates() {
    for (const g of gateWaypoints) {
      const lv = g.lv || 1, cost = CFG.BUILD_UPGRADE[lv + 1];
      if (lv >= stage || !cost || !Object.entries(cost).every(([k, v]) => res[k] >= v * 1.5)) continue;
      payCost(cost); setGateLevel(g, lv + 1); report.upgraded++; updateHud();
      dust(g.x, g.z); sfxAt('build', g.x, g.z); floatText(`Gate Lv${lv + 1}!`, g.x, 3.6, g.z); return;
    }
  }
  function addGate(x, z, r, nx, nz) {                                // 출입구 경유지 등록 + 바닥의 얇고 납작한 회색 도어 매트
    gateWaypoints.push({ x, z, r, nx, nz });
    const doormat = new THREE.Mesh(matGeo, matMat);
    doormat.position.set(x, 0.02, z);
    doormat.receiveShadow = true;
    scene.add(doormat);
    doormats.push(doormat);
    addPath(x, z, 2.4);
    addLamp(x - nz * 2.6, z + nx * 2.6); addLamp(x + nz * 2.6, z - nx * 2.6);        // 출입구 양옆 가로등
    const light = new THREE.PointLight(0xffc27a, 0, 18, 1.3); light.position.set(x, 3.2, z); scene.add(light); doormats.push(light); gateLights.push(light);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(7.5, 28), poolMat); pool.rotation.x = -Math.PI / 2; pool.position.set(x, 0.04, z); pool.renderOrder = 4; scene.add(pool); doormats.push(pool);
  }
  // 정사각형 성벽 띠(중앙 기준 체비셰프 거리 R ± width) 안의 자원을 모두 치워, 벽과 나무/바위 사이에 NPC가 끼는 틈을 없앤다
  const cheb = (x, z) => Math.max(Math.abs(x), Math.abs(z));
  function clearCorridor(R, width) {
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i], ty = o.userData.type;
      if ((ty === 'wood' || ty === 'stone') && Math.abs(cheb(o.position.x, o.position.z) - R) < width + o.userData.radius) {
        scene.remove(o); obstacles.splice(i, 1);
      }
    }
  }
  // 중앙(0,0)을 기준으로 정사각형 네 테두리를 따라 청사진 배치. 각 변의 정중앙은 출입구(Gap)로 비워 도어 매트와 경유지를 만든다
  function designSquare(cfg) {
    const R = cfg.half, n = cfg.perHalf, step = R / n;
    clearCorridor(R, CFG.CORRIDOR_WIDTH);
    const rad = cfg.kind === 'stone' ? 1.5 : 1.2;
    const pts = [];
    for (let k = -n; k <= n; k++) { pts.push({ x: k * step, z: -R, u: k, nx: 0, nz: -1, rot: 0 }); pts.push({ x: k * step, z: R, u: k, nx: 0, nz: 1, rot: 0 }); }              // 북/남 (모서리 포함)
    for (let k = -(n - 1); k <= n - 1; k++) { pts.push({ x: R, z: k * step, u: k, nx: 1, nz: 0, rot: Math.PI / 2 }); pts.push({ x: -R, z: k * step, u: k, nx: -1, nz: 0, rot: Math.PI / 2 }); }   // 동/서
    let placed = 0;
    for (const p of pts) {
      if (p.u === 0) {                                              // 출입구: 비워 두고 길만 터 준 뒤 경유지로 등록
        clearArea(p.x, p.z, 2.4);
        addGate(p.x, p.z, R, p.nx, p.nz);
        continue;
      }
      const taken = blueprints.some(b => Math.hypot(b.position.x - p.x, b.position.z - p.z) < 1.5) ||
                    obstacles.some(o => o.userData.type === 'fence' && Math.hypot(o.position.x - p.x, o.position.z - p.z) < 1.5);
      if (taken) continue;
      clearArea(p.x, p.z, rad + 0.3);
      addBlueprint(cfg.kind, p.x, p.z, p.rot);
      placed++;
    }
    return placed;
  }
  let designTier = 0;
  const designBtnEl = document.getElementById('designBtn');
  function updateDesignBtn() {
    const cfg = CFG.DESIGN[designTier];
    designBtnEl.classList.remove('done');
    if (!cfg) {
      designBtnEl.classList.add('done'); designBtnEl.classList.remove('stone');
      document.getElementById('designLbl').textContent = 'Defense Lines Complete';
      document.getElementById('designCost').textContent = 'All tiers planned';
      return;
    }
    const [type, n] = Object.entries(cfg.cost)[0];
    document.getElementById('designLbl').textContent = cfg.label;
    document.getElementById('designCost').textContent = cfg.stage && stage < cfg.stage ? `Requires Stage ${cfg.stage} · ${n} ${type === 'wood' ? 'Wood' : 'Stone'}` : `Costs ${n} ${type === 'wood' ? 'Wood' : 'Stone'}`;
    designBtnEl.classList.toggle('stone', cfg.kind === 'stone');
  }
  function designDefense() {
    if (dead) return;
    const cfg = CFG.DESIGN[designTier];
    if (!cfg) return;
    if (cfg.stage && stage < cfg.stage) return toast(`Available from Stage ${cfg.stage} (${CFG.STAGES[cfg.stage - 1].name})`);
    const [type, n] = Object.entries(cfg.cost)[0];
    if (res[type] < n) return toast(`Need ${n} ${type === 'wood' ? 'Wood' : 'Stone'}`);
    res[type] -= n;
    const placed = designSquare(cfg);
    designTier++;
    updateHud(); updateDesignBtn();
    toast(`${cfg.label} planned! ${placed} blueprints - your companions will build them`);
  }
  // ----- 마을 인프라: 시대별 묶음 설계 -----
  let townStage = 0;                          // 지금까지 설계한 묶음 수
  const canPay = (c) => Object.entries(c).every(([k, v]) => res[k] >= v);
  const payCost = (c) => { for (const [k, v] of Object.entries(c)) res[k] -= v; };
  const costText = (c) => Object.entries(c).map(([k, v]) => `${v} ${k === 'wood' ? 'Wood' : k === 'stone' ? 'Stone' : k === 'iron' ? 'Iron' : k === 'shard' ? 'Shard' : 'Food'}`).join(' + ');
  // 숲/바위가 가장 많이 모여 있는 빈 자리를 찾아 벌목장/채석장 위치로 삼는다
  function findClusterSpot(kind) {
    const type = kind === 'lumber' ? 'wood' : 'stone';
    const occupied = (x, z) => obstacles.some(o => (o.userData.type === 'building' || o.userData.type === 'fence') && Math.hypot(o.position.x - x, o.position.z - z) < 7) ||
                               blueprints.some(b => Math.hypot(b.position.x - x, b.position.z - z) < 7);
    let best = null, bs = -1;
    for (let i = 0; i < 260; i++) {
      const x = rand(-38, 38), z = rand(-38, 38), c = cheb(x, z);
      if (c < 8 || Math.abs(x) < 3.5 || Math.abs(z) < 3.5 || Math.abs(c - 15) < 3.6 || Math.abs(c - 25) < 3.6 || occupied(x, z)) continue;
      const score = obstacles.filter(o => o.userData.type === type && Math.hypot(o.position.x - x, o.position.z - z) < 10).length + (c < 26 ? 2 : 0);   // 마을 안쪽이면 가산점
      if (score > bs) { bs = score; best = { x, z }; }
    }
    return best || { x: kind === 'lumber' ? 20 : -20, z: kind === 'lumber' ? 10 : -10 };
  }
  // 마을 안쪽의 빈 자리 찾기 (우물·시장): 중심에 가깝고, 출입구 통로와 다른 건물에서 떨어진 곳
  const KEEP_HALF = 5.1;                                                     // 5단계 성채가 차지하는 반너비 (모서리 탑 포함). 어느 시대에 지어도 성채가 커져서 겹치지 않도록 항상 이만큼 비운다
  function findTownSpot(kind, ignore) {
    const rad = CFG.BUILDING[kind].radius;
    const others = obstacles.filter(o => o.userData.type === 'building' && o !== ignore).map(o => [o.position.x, o.position.z, o.userData.radius]).concat(blueprints.map(b => [b.position.x, b.position.z, b.userData.radius || 2]));
    for (const [maxC, tm] of [[10.5, 4.5], [12, 3.5], [13, 2.5]]) {                                  // 자리가 없으면 조건을 조금씩 풀어서 다시 찾는다
      let best = null, bd = Infinity;
      for (let x = -13; x <= 13; x += 0.5) for (let z = -13; z <= 13; z += 0.5) {
        const d = Math.hypot(x, z);
        if (cheb(x, z) > maxC || cheb(x, z) < KEEP_HALF + rad + 0.6 || Math.abs(x) < rad + 1.2 || Math.abs(z) < rad + 1.2 || d < FIRE_R + rad + 3.2) continue;
        if (others.some(([ox, oz, or]) => Math.hypot(x - ox, z - oz) < rad + or + 1.0)) continue;
        if ([[-12.3, -12.3], [12.3, -12.3], [-12.3, 12.3], [12.3, 12.3]].some(([tx, tz]) => Math.hypot(x - tx, z - tz) < rad + tm)) continue;       // 예정된 모서리 타워 자리와 겹치지 않게
        if (d < bd) { bd = d; best = { x, z }; }
      }
      if (best) return best;
    }
    return { x: 9, z: -4 };
  }
  // 목표 위치 근처의 빈 자리 (바깥 구역용): 이미 있는 건물·계획·성벽·큰길과 겹치지 않는, 목표에서 가장 가까운 칸. near = { x, z, min, max } (min~max 는 마을 중심에서의 체비쇼프 거리)
  function findSpotNear(kind, near, ignore, strict) {
    const rad = CFG.BUILDING[kind].radius;
    const others = obstacles.filter(o => o !== ignore && (o.userData.type === 'building' || o.userData.type === 'fence')).map(o => [o.position.x, o.position.z, o.userData.type === 'fence' ? 1.5 : o.userData.radius || 2]).concat(blueprints.map(b => [b.position.x, b.position.z, b.userData.radius || 2]));       // 성벽은 충돌 반지름 1.5. 건물 가장자리와 사이에 사람이 지나갈 틈(넉넉히 1.6)을 남긴다
    let best = null, bd = Infinity;
    for (let x = -40; x <= 40; x += 1) for (let z = -40; z <= 40; z += 1) {
      const c = cheb(x, z); if (c < near.min || c > near.max || Math.abs(x) < rad + 1.4 || Math.abs(z) < rad + 1.4) continue;
      const d = Math.hypot(x - near.x, z - near.z); if (d >= bd) continue;
      if (others.some(([ox, oz, or]) => Math.hypot(x - ox, z - oz) < rad + or + 1.6)) continue;
      bd = d; best = { x, z };
    }
    return best || (strict ? null : { x: near.x, z: near.z });
  }
  // 길 막힘 방지: 움직여도 되는 건물(벌목장·채석장·마구간·풍차·병원·집결장·우리·기념비)이 다른 건물과 겹치거나 성벽에 너무 붙어 사람이 지나갈 틈이 없으면 가까운 빈 자리로 옮긴다
  const MOVABLE = ['lumber', 'quarry', 'stable', 'windmill', 'infirmary', 'muster', 'pen', 'monument', 'trainyard'];
  function fixTightBuildings() {
    const B = obstacles.filter(o => o.userData.type === 'building'), F = obstacles.filter(o => o.userData.type === 'fence'), now = performance.now();
    for (const o of B) {
      const u = o.userData; if (!MOVABLE.includes(u.kind) || (u.noSpotT && now < u.noSpotT)) continue;
      const r = u.radius || 2;
      const bad = B.some(q => q !== o && Math.hypot(q.position.x - o.position.x, q.position.z - o.position.z) - r - (q.userData.radius || 2) < 0.2) || F.some(f => Math.hypot(f.position.x - o.position.x, f.position.z - o.position.z) - r - 1.5 < 0.6);
      if (!bad) continue;
      const c = cheb(o.position.x, o.position.z), pos = findSpotNear(u.kind, { x: o.position.x, z: o.position.z, min: Math.max(8, c - 8), max: c + 8 }, o, true);
      if (!pos) { u.noSpotT = now + 60000; continue; }
      clearArea(pos.x, pos.z, r + 1.4); o.position.x = pos.x; o.position.z = pos.z; dust(pos.x, pos.z);
    }
  }
  // 성채가 커지면(3 → 4 → 5단계) 이미 지은 건물(예전 저장 포함)이 성채와 겹칠 수 있다: 겹친 건물은 빈 자리로 옮긴다
  function keepOverlap(o) {
    const K = stage >= 4 ? KEEP_HALF : stage >= 3 ? 4.4 : 0; if (!K) return false;
    const dx = Math.max(Math.abs(o.position.x) - K, 0), dz = Math.max(Math.abs(o.position.z) - K, 0);
    return Math.hypot(dx, dz) < (o.userData.radius || 2) + 0.3;
  }
  function fixKeepOverlaps() {
    for (const o of obstacles) {
      const u = o.userData; if (u.type !== 'building' || u.kind === 'tower' || u.kind === 'farm' || !CFG.BUILDING[u.kind] || cheb(o.position.x, o.position.z) > 14 || !keepOverlap(o)) continue;
      const rad = CFG.BUILDING[u.kind].radius, fixed = u.kind === 'siegeshop' ? { x: -21, z: -3.5 } : null;
      const free = fixed && !obstacles.some(q => q !== o && q.userData.type === 'building' && Math.hypot(q.position.x - fixed.x, q.position.z - fixed.z) < rad + (q.userData.radius || 2) + 0.5);
      const pos = free ? fixed : findTownSpot(u.kind, o);
      clearArea(pos.x, pos.z, rad + 1.4); o.position.x = pos.x; o.position.z = pos.z;
      if (u.face) { u.face = faceOf(pos.x, pos.z); o.rotation.y = Math.atan2(u.face.x, u.face.z); }
      dust(pos.x, pos.z);
    }
  }
  // 둘째(바깥) 방어선이 계획되었고, 그 성벽 청사진이 하나도 남지 않았으면 완성
  const homesBuilt = () => !blueprints.some(b => b.userData.type === 'blueprint' && b.userData.bkind === 'house');       // 지을 집 청사진이 남아 있지 않다
  const thirdWallDone = () => designTier >= 3 && !blueprints.some(b => b.userData.type === 'blueprint' && !b.userData.bkind && b.userData.res === 'stone');
  const outerWallDone = () => designTier >= 2 && !blueprints.some(b => b.userData.type === 'blueprint' && !b.userData.bkind && b.userData.res === 'stone');
  // 바깥 구역(첫 목책~둘째 성벽 사이): 이미 지은 농장·사격장은 그대로 옮기고(레벨·일꾼 유지) 모자란 농장은 새로 짓는다
  function planOuterFields(g) {
    const out = [], free = g.farmSlots.slice(), moved = { farm: 0, range: 0 };
    const relocate = (o, pos) => { clearArea(pos.x, pos.z, 3.2); o.position.x = pos.x; o.position.z = pos.z; dust(pos.x, pos.z); };
    for (const o of obstacles) if (o.userData.type === 'building' && o.userData.kind === 'farm' && free.length && cheb(o.position.x, o.position.z) < 14) { relocate(o, free.shift()); moved.farm++; }
    for (const b of blueprints) if (b.userData.type === 'blueprint' && b.userData.bkind === 'farm' && free.length && cheb(b.position.x, b.position.z) < 14) { clearArea(free[0].x, free[0].z, 3.2); const p = free.shift(); b.position.x = p.x; b.position.z = p.z; moved.farm++; }
    let rangeDone = false;
    for (const o of obstacles) if (o.userData.type === 'building' && o.userData.kind === 'range' && cheb(o.position.x, o.position.z) < 14) { relocate(o, g.rangeSlot); rangeDone = true; moved.range++; }
    for (const b of blueprints) if (b.userData.type === 'blueprint' && b.userData.bkind === 'range' && cheb(b.position.x, b.position.z) < 14) { clearArea(g.rangeSlot.x, g.rangeSlot.z, 3.2); b.position.x = g.rangeSlot.x; b.position.z = g.rangeSlot.z; rangeDone = true; moved.range++; }
    const have = obstacles.filter(o => o.userData.type === 'building' && o.userData.kind === 'farm').length + blueprints.filter(b => b.userData.bkind === 'farm').length;
    for (let i = 0; i < Math.min(free.length, Math.max(0, g.farms - have)); i++) { clearArea(free[i].x, free[i].z, 3.2); addBuildingBlueprint('farm', free[i].x, free[i].z); out.push('Farm'); }
    if (!rangeDone && !obstacles.some(o => o.userData.type === 'building' && o.userData.kind === 'range') && !blueprints.some(b => b.userData.bkind === 'range')) { clearArea(g.rangeSlot.x, g.rangeSlot.z, 3.2); addBuildingBlueprint('range', g.rangeSlot.x, g.rangeSlot.z); out.push('Archery Range'); }
    if (moved.farm || moved.range) out.push(`moved ${moved.farm} farm(s)${moved.range ? ' and the archery range' : ''} outside`);
    return out;
  }
  function designTown() {
    if (dead) return;
    const g = CFG.TOWN_GROUPS[townStage];
    if (!g) return;
    if (stage < g.stage) return toast(`Available in Stage ${g.stage} (${CFG.STAGES[g.stage - 1].name})`);
    if (!canPay(g.cost)) return toast(`Need ${costText(g.cost)}`);
    if (g.needsOuterWall && !outerWallDone()) return toast('Finish the second wall first');
    if (g.needsThirdWall && !thirdWallDone()) return toast('Finish the Great Wall first');
    if (g.needsHomesBuilt && !homesBuilt()) return toast('Finish building the first outer homes first');
    payCost(g.cost);
    townStage++;
    const names = [];
    if (g.outer) names.push(...planOuterFields(g));
    for (const lot of g.lots) {
      const pos = lot.near ? findSpotNear(lot.kind, lot.near) : lot.auto ? (lot.auto === 'town' ? findTownSpot(lot.kind) : findClusterSpot(lot.kind)) : lot;
      clearArea(pos.x, pos.z, CFG.BUILDING[lot.kind].radius + 1.4);
      addBuildingBlueprint(lot.kind, pos.x, pos.z);
      names.push(BUILDING_NAME[lot.kind]);
    }
    updateHud(); updateTownBtn();
    toast(`${g.label} done! ${names.join(' · ')} - your companions will build them`);
  }
  const BUILDING_NAME = { well: 'Well', market: 'Market', smith: 'Blacksmith', house: 'House', barracks: 'Barracks', range: 'Archery Range', farm: 'Farm', lumber: 'Lumber Camp', quarry: 'Quarry', tower: 'Defense Tower', siegeshop: 'Siege Workshop', plaza: 'Fountain Plaza', muster: 'Muster Yard', pen: 'Animal Pen', windmill: 'Windmill', infirmary: 'Infirmary', monument: 'Victory Monument', stable: 'Stables', trainyard: 'Training Yard' };
  // ----- 마을 계획: 일꾼들이 알아서 계획을 세운다. 플레이어는 우선순위만 고른다 (버튼을 누르면 방어 → 균형 → 경제 순으로 바뀐다) -----
  const PLAN_MODES = [['defense', 'Defense first'], ['balanced', 'Balanced'], ['economy', 'Economy first']];
  const planModeNow = () => PLAN_MODES.find(m => m[0] === settings.plan) || PLAN_MODES[1];
  function planCandidates() {
    const D = CFG.DESIGN[designTier], T = CFG.TOWN_GROUPS[townStage], dd = D && { kind: 'defense', cost: D.cost, stage: D.stage || 1, label: D.label, run: designDefense }, tt = T && { kind: 'town', cost: T.cost, stage: T.stage, label: T.label, run: designTown, ok: () => (!T.needsOuterWall || outerWallDone()) && (!T.needsHomesBuilt || homesBuilt()) };
    const m = settings.plan || 'balanced';
    const order = m === 'defense' ? [dd, tt] : m === 'economy' ? [tt, dd] : (designTier <= townStage ? [dd, tt] : [tt, dd]);
    return order.filter(Boolean);
  }
  function nextPlan() { const c = planCandidates(); return c.find(x => stage >= x.stage && (!x.ok || x.ok())) || null; }          // 나이 조건을 만족하는 첫 계획 (자원이 모자라면 기다린다)
  function updatePlanBtn() {
    const b = document.getElementById('planBtn'); if (!b) return;
    const n = nextPlan(), lbl = `Village Plan: ${planModeNow()[1]}`;
    if (document.getElementById('planLbl').textContent !== lbl) document.getElementById('planLbl').textContent = lbl;
    const nt = n ? `Next: ${n.label} (${costText(n.cost)})` : planCandidates().length ? (planCandidates().some(x => x.ok && !x.ok() && stage >= x.stage) ? 'Waiting for walls / homes to be finished' : `Waiting for Stage ${planCandidates()[0].stage}`) : 'Everything is planned';
    if (document.getElementById('planNext').textContent !== nt) document.getElementById('planNext').textContent = nt;
    b.classList.toggle('done', !planCandidates().length);
  }
  function cyclePlan() { const i = PLAN_MODES.findIndex(m => m === planModeNow()); settings.plan = PLAN_MODES[(i + 1) % PLAN_MODES.length][0]; saveSettings(); updatePlanBtn(); toast(`Village plan: ${planModeNow()[1]}`); }
  let planCd = 0;
  function autoPlanTick(dt) {
    planCd -= dt; if (planCd > 0) return; planCd = 2.5;
    updatePlanBtn();
    if (dead || exActive || eventOpen || uiPause || !saveReady) return;
    fixKeepOverlaps(); fixTightBuildings(); cornerLampsSync(); trimMounts();
    const h = (gameMin / 60) % 24; if (h >= 18 || h < 6) return;              // 낮에만 계획한다
    if (blueprints.length > 8) return;                                          // 아직 지을 것이 많으면 새 계획을 쌓지 않는다
    const n = nextPlan(); if (n && canPay(n.cost)) n.run();
  }
  function updateTownBtn() {
    const g = CFG.TOWN_GROUPS[townStage], b = document.getElementById('townBtn');
    b.classList.toggle('done', !g);
    document.getElementById('townLbl').textContent = g ? g.label : 'Town Planning Complete';
    document.getElementById('townCost').textContent = g ? (stage < g.stage ? `Requires Stage ${g.stage}` : g.needsOuterWall && !outerWallDone() ? 'Requires the second wall' : g.needsHomesBuilt && !homesBuilt() ? 'Requires the first outer homes built' : `Costs ${costText(g.cost)}`) : 'All buildings planned';
  }
  function upgradeFence() {
    if (dead) return;
    if (stage < CFG.UPGRADE_FENCE_STAGE) return toast(`Stone walls unlock in Stage ${CFG.UPGRADE_FENCE_STAGE} (${CFG.STAGES[CFG.UPGRADE_FENCE_STAGE - 1].name})`);
    const f = nearestFence('wood');
    if (!f) return toast(nearestFence() ? 'Already a stone wall' : 'No wooden fence nearby to upgrade');
    if (res.stone < CFG.FENCE_UPGRADE_STONE) return toast(`Need ${CFG.FENCE_UPGRADE_STONE} Stone`);
    res.stone -= CFG.FENCE_UPGRADE_STONE;
    makeStoneFence(f);
    updateHud();
    toast('Upgraded to a stone wall!');
  }
  function makeStoneFence(f) {
    if (isFortSpot(f.position.x, f.position.z)) { f.geometry = fortWallGeo(); f.material = fortMat; f.position.y = 0; Object.assign(f.userData, { level: 'stone', tall: true, radius: 1.6, hp: wallHp() * 1.5, maxHp: wallHp() * 1.5 }); return; }
    const wm = structMesh('wall');
    if (wm) { f.geometry = wm.geometry; f.material = wm.material; f.position.y = 0; }       // 벽돌 성벽 모델
    else { f.material = wallMat; f.scale.y = 1.25; f.position.y = 0.55 * 1.25; }                 // 짙은 회색 돌 성벽
    Object.assign(f.userData, { level: 'stone', hp: wallHp(), maxHp: wallHp() });
  }
  // 버튼: 가까이에 나무 목책이 있으면 업그레이드, 아니면 건설

  // ---------- 더 자세한 건물 모양 (집과 성채): 기본 도형을 모아 만든 로우폴리 모델. 모두 function 선언이다 ----------
  const mdlCache = {};
  const isGrey = (c) => { const r = c >> 16 & 255, g = c >> 8 & 255, b = c & 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx - mn <= 24 && mx >= 0x50 && mx <= 0xd0; };
  let stoneAuto = false;                                                    // only the keep, towers and gatehouses use the stone-block texture on their grey parts
  const WOODS = new Set([0x4a301c, 0x3a2414, 0x6b4a2a, 0x7a4f2a, 0x6a4a2a, 0x7a5a3a, 0x6b4a2b, 0x8a5a2a, 0x5a3a22, 0x5a3a1e, 0x3a2a1c, 0x8a6c48]);       // brown parts of the wooden buildings get plank texture
  const M = (c, kind, tile) => { if (!kind && stoneAuto && isGrey(c)) kind = 'stone'; else if (!kind && WOODS.has(c)) { kind = 'wood'; tile = tile || 1.1; } const k = c + (kind || ''); return mdlCache[k] || (mdlCache[k] = kind ? texMat(c, kind, tile || 0.5) : new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 1 })); };
  const withStone = (fn) => function (...a) { stoneAuto = true; try { return fn.apply(this, a); } finally { stoneAuto = false; } };
  function gableGeo(w, h, d) {                                               // 삼각 단면(너비 w, 높이 h)을 깊이 d 만큼 밀어낸 박공 지붕: 바닥이 y=0, 앞뒤(z)로 d/2
    const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(0, h); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false }); g.translate(0, 0, -d / 2); return g;
  }
  function rngOf(seed) { let s = (seed >>> 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
  function houseModel(g, lvl) {                                              // 2단계: 목골 집 / 3단계 이상: 돌집 (정면은 +z). g.userData.seed 로 집마다 색·크기·지붕 방향·문 위치·부속 건물이 달라진다
    const R = rngOf(g.userData.seed || 1), pick = (a) => a[Math.floor(R() * a.length)];
    const inner = new THREE.Group(); inner.scale.set(0.9 + R() * 0.3, 0.92 + R() * 0.2, 0.88 + R() * 0.25); g.add(inner);
    const add = (geo, m, px, py, pz, ry = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.rotation.y = ry; o.castShadow = o.receiveShadow = true; inner.add(o); return o; };
    const stone = lvl >= 3;
    const roofKind = pick(stone ? ['shingle', 'shingle', 'plank'] : ['thatch', 'thatch', 'shingle', 'plank']);
    const wallM = stone ? M(pick([0x9a9da4, 0xa8a294, 0x8f969e, 0xb0a898]), 'rough', 0.9) : M(pick([0xd8bf90, 0xe6d8b8, 0xcfa97c, 0xd9cfae, 0xbfa27a]), 'plaster', 0.6), beamM = M(pick([0x4a301c, 0x3a2a1c, 0x5a3a22]), 'wood', 1.2),
      roofM = roofKind === 'thatch' ? M(pick([0xc8aa64, 0xb89a58, 0xa8884a]), 'thatch', 0.8) : roofKind === 'plank' ? M(pick([0x7a5232, 0x6a4a2e, 0x8a6038]), 'wood', 0.9) : M(stone ? pick([0x4a4f5c, 0x5c4a42, 0x3f5a52, 0x5a3f4a]) : pick([0xa34a2a, 0x8c5a34, 0x6b7d4a, 0xb5651d, 0x7a3a2a]), 'shingle', 0.7), baseM = M(0x6f7078), doorM = M(pick([0x3a2414, 0x4a2a1a, 0x2f3a4a, 0x5a2a2a])),
      flowerM = M(pick([0x4f8a3a, 0xc0504a, 0xd8a02a, 0x8a5ab0]));
    const W = stone ? 3.0 : 2.8, H = (stone ? 2.3 : 1.8) + (R() < 0.3 ? 0.5 : 0);
    const ridgeX = R() < 0.5, dOff = R() < 0.5 ? 0 : (R() < 0.5 ? -1 : 1) * W * 0.17;                              // 용마루 방향 / 문 위치 어긋남
    add(new THREE.BoxGeometry(W + 0.3, 0.3, W + 0.3), baseM, 0, 0.15, 0);                                       // 돌 기초
    add(new THREE.BoxGeometry(W, H, W), wallM, 0, 0.3 + H / 2, 0);
    const top = 0.3 + H;
    if (!stone) {                                                                                               // 목골: 모서리 기둥, 가로 들보, 가새
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(new THREE.BoxGeometry(0.16, H, 0.16), beamM, sx * W / 2, 0.3 + H / 2, sz * W / 2);
      for (const y of [0.3, top - 0.08]) { add(new THREE.BoxGeometry(W + 0.1, 0.12, 0.12), beamM, 0, y, W / 2); add(new THREE.BoxGeometry(W + 0.1, 0.12, 0.12), beamM, 0, y, -W / 2); add(new THREE.BoxGeometry(0.12, 0.12, W + 0.1), beamM, W / 2, y, 0); add(new THREE.BoxGeometry(0.12, 0.12, W + 0.1), beamM, -W / 2, y, 0); }
      if (H > 2) add(new THREE.BoxGeometry(W + 0.12, 0.14, W + 0.12), beamM, 0, 0.3 + H * 0.5, 0);               // 2층 허리 들보
      if (R() < 0.6) for (const sx of [-1, 1]) { const br = add(new THREE.BoxGeometry(0.1, 1.3, 0.1), beamM, sx * W * 0.32, 0.3 + H * 0.5, W / 2 + 0.02); br.rotation.z = -sx * 0.6; }
    } else {                                                                                                    // 돌집: 모서리 돌(쐐기돌)
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(new THREE.BoxGeometry(0.34, H, 0.34), M(0xb4b6bc), sx * W / 2, 0.3 + H / 2, sz * W / 2);
      add(new THREE.BoxGeometry(W + 0.12, 0.14, W + 0.12), M(0xb4b6bc), 0, top, 0);
    }
    const rw = W + 0.7, rh = (stone ? 1.7 : 1.45) * (0.9 + R() * 0.35);
    const roof = add(gableGeo(rw, rh, W + 0.7), roofM, 0, top, 0); if (ridgeX) roof.rotation.y = Math.PI / 2;      // 박공 지붕 (처마가 벽보다 튀어나온다)
    for (const k of [-1, 1]) { const gw = add(gableGeo(W * 0.94, rh * 0.84, 0.06), wallM, ridgeX ? k * (W + 0.7) / 2 + k * 0.02 : 0, top + 0.02, ridgeX ? 0 : k * (W + 0.7) / 2 + k * 0.02); if (ridgeX) gw.rotation.y = Math.PI / 2; }
    const ridge = add(new THREE.BoxGeometry(0.16, 0.14, W + 0.8), M(0x3a2414), 0, top + rh, 0); if (ridgeX) ridge.rotation.y = Math.PI / 2;
    if (R() < 0.85) { const cx = (R() < 0.5 ? -1 : 1) * W * 0.28, cz = (R() < 0.5 ? -1 : 1) * W * 0.18;           // 굴뚝
      add(new THREE.BoxGeometry(0.55, 1.0, 0.55), M(0x7a5a4a), cx, top + rh * 0.62, cz); add(new THREE.BoxGeometry(0.7, 0.12, 0.7), M(0x5a4a40), cx, top + rh * 0.62 + 0.55, cz); }
    add(new THREE.BoxGeometry(0.7, 1.25, 0.1), doorM, dOff, 0.3 + 0.62, W / 2 + 0.04);                          // 문 + 문틀 + 처마
    add(new THREE.BoxGeometry(0.9, 0.12, 0.12), beamM, dOff, 0.3 + 1.28, W / 2 + 0.07);
    add(new THREE.BoxGeometry(0.1, 0.12, 0.34), beamM, dOff + 0.45, 0.3 + 1.3, W / 2 + 0.14); add(new THREE.BoxGeometry(0.1, 0.12, 0.34), beamM, dOff - 0.45, 0.3 + 1.3, W / 2 + 0.14);
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 6), M(0xc8a040), dOff + 0.22, 0.3 + 0.62, W / 2 + 0.1).rotation.x = Math.PI / 2;
    for (const sx of [-1, 1]) {                                                                                 // 덧문 달린 창 + 화단
      const wx = sx * W * 0.32, wy = 0.3 + H * 0.58; if (Math.abs(wx - dOff) < 0.75) continue;
      add(new THREE.BoxGeometry(0.52, 0.52, 0.06), windowGlow, wx, wy, W / 2 + 0.03);
      add(new THREE.BoxGeometry(0.62, 0.08, 0.1), beamM, wx, wy + 0.3, W / 2 + 0.06); add(new THREE.BoxGeometry(0.62, 0.08, 0.1), beamM, wx, wy - 0.3, W / 2 + 0.06);
      add(new THREE.BoxGeometry(0.16, 0.5, 0.05), beamM, wx - 0.36, wy, W / 2 + 0.06); add(new THREE.BoxGeometry(0.16, 0.5, 0.05), beamM, wx + 0.36, wy, W / 2 + 0.06);
      add(new THREE.BoxGeometry(0.6, 0.14, 0.22), M(0x6b4a2a), wx, wy - 0.42, W / 2 + 0.15); add(new THREE.BoxGeometry(0.5, 0.12, 0.16), flowerM, wx, wy - 0.32, W / 2 + 0.15);
    }
    if (H > 2) for (const wx of [-0.7, 0.7]) add(new THREE.BoxGeometry(0.46, 0.46, 0.06), windowGlow, wx, 0.3 + H * 0.82, W / 2 + 0.03);    // 2층 창
    for (const sz of [-1, 1]) for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.06, 0.5, 0.5), windowGlow, sx * (W / 2 + 0.03), 0.3 + H * 0.58, sz * W * 0.22);   // 옆 창
    if (stone && R() < 0.65) { add(new THREE.BoxGeometry(0.7, 0.6, 0.7), M(0x4a4f5c), 0, top + rh * 0.35, W * 0.45); add(new THREE.BoxGeometry(0.4, 0.4, 0.05), windowGlow, 0, top + rh * 0.35, W * 0.45 + 0.37); }   // 지붕창
    const side = R() < 0.5 ? -1 : 1;
    if (R() < 0.5) {                                                                                            // 한쪽에 덧붙인 헛간 (경사 지붕)
      add(new THREE.BoxGeometry(1.3, 1.1, W * 0.65), wallM, side * (W / 2 + 0.6), 0.3 + 0.55, -0.2);
      const sh = add(new THREE.BoxGeometry(1.8, 0.1, W * 0.75), roofM, side * (W / 2 + 0.55), 0.3 + 1.25, -0.2); sh.rotation.z = -side * 0.35;
    } else if (R() < 0.8) {                                                                                     // 문 옆의 통과 장작더미 / 통
      if (R() < 0.5) { for (let i = 0; i < 3; i++) add(new THREE.CylinderGeometry(0.14, 0.14, 0.9, 6), M(0x7a4f2a), -side * (W / 2 - 0.1) - side * (i % 2) * 0.1, 0.4 + (i > 1 ? 0.25 : 0), W / 2 + 0.4 + (i % 2) * 0.3).rotation.z = Math.PI / 2; }
      else { add(new THREE.CylinderGeometry(0.28, 0.3, 0.6, 8), M(0x6b4a2a), side * (W / 2 - 0.2), 0.6, W / 2 + 0.45); add(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 8), M(0x3a78c8), side * (W / 2 - 0.2), 0.92, W / 2 + 0.45); }
    }
  }
  const keepModel = withStone(function keepModel0(add, stage) {                                           // 석조 성채: 3단계 키프, 4단계 큰 성채, 5단계 금빛 왕좌의 방
    const gold = stage >= 5, big = stage >= 4, W = big ? 7.4 : 6.0, H = big ? 3.8 : 3.3, stoneM = M(0x8d9098), darkM = M(0x6a6e78), lightM = M(0xa9acb4), roofM = gold ? new THREE.MeshStandardMaterial({ color: 0xe0b040, flatShading: true, roughness: 0.55, metalness: 0.3 }) : M(0x6b2a2a), dark = M(0x1e1a16);
    add(new THREE.BoxGeometry(W + 0.9, 0.45, W + 0.9), darkM, 0, 0.22, 0);                                       // 기단
    add(new THREE.BoxGeometry(W, H, W), stoneM, 0, 0.45 + H / 2, 0);
    const top = 0.45 + H;
    add(new THREE.BoxGeometry(W + 0.5, 0.35, W + 0.5), lightM, 0, top + 0.1, 0);                                 // 처마 띠
    const step = 0.95, n = Math.floor(W / step);                                                                 // 흉벽: 네 변에 이빨 모양
    for (let i = 0; i < n; i++) { const t = (i - (n - 1) / 2) * step; for (const [px, pz] of [[t, W / 2 + 0.1], [t, -W / 2 - 0.1], [W / 2 + 0.1, t], [-W / 2 - 0.1, t]]) add(new THREE.BoxGeometry(0.55, 0.55, 0.55), lightM, px, top + 0.55, pz); }
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {                                               // 모서리 원통 탑 + 이빨 + 원뿔 지붕 + 깃발
      const tx = sx * (W / 2), tz = sz * (W / 2), th = H + (big ? 2.6 : 2.0);
      add(new THREE.CylinderGeometry(1.25, 1.35, th, 12), darkM, tx, 0.45 + th / 2, tz);
      add(new THREE.CylinderGeometry(1.5, 1.4, 0.4, 12), lightM, tx, 0.45 + th + 0.05, tz);
      add(new THREE.ConeGeometry(1.55, 1.9, 12), roofM, tx, 0.45 + th + 1.25, tz);
      add(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 5), M(0x4a301c), tx, 0.45 + th + 2.7, tz);
      add(new THREE.BoxGeometry(0.8, 0.45, 0.04), gold ? M(0xe0b040) : M(0xb02a2a), tx + 0.42, 0.45 + th + 3.2, tz);
      add(new THREE.BoxGeometry(0.1, 0.55, 0.06), dark, tx, 0.45 + th * 0.6, tz + sz * 1.26);                    // 화살 구멍
    }
    for (const [dx, dz, ry] of [[0, 1, 0], [0, -1, 0], [1, 0, 1], [-1, 0, 1]]) {                                  // 벽면: 화살 구멍과 창, 앞면에는 문
      const px = dx * (W / 2 + 0.03), pz = dz * (W / 2 + 0.03);
      for (const o of [-1.8, 1.8]) { const m = add(new THREE.BoxGeometry(0.16, 0.7, 0.08), dark, dx ? px : o, 0.45 + H * 0.6, dz ? pz : o); if (ry) m.rotation.y = Math.PI / 2; }
    }
    add(new THREE.BoxGeometry(1.7, 2.3, 0.2), dark, 0, 0.45 + 1.15, W / 2 + 0.06);                                // 정문(아치) + 쇠창살 + 문틀
    add(new THREE.CylinderGeometry(0.85, 0.85, 0.2, 14, 1, false, 0, Math.PI), dark, 0, 0.45 + 2.3, W / 2 + 0.06).rotation.set(Math.PI / 2, 0, Math.PI / 2);
    add(new THREE.BoxGeometry(2.1, 0.2, 0.3), lightM, 0, 0.45 + 2.0 + 0.9 + 0.2, W / 2 + 0.1);
    for (let i = -2; i <= 2; i++) add(new THREE.BoxGeometry(0.06, 2.4, 0.06), M(0x55585f), i * 0.3, 0.45 + 1.2, W / 2 + 0.2);
    const dh = big ? 3.2 : 2.6, dw = big ? 4.2 : 3.4;                                                            // 중앙 주탑
    add(new THREE.BoxGeometry(dw, dh, dw), stoneM, 0, top + 0.28 + dh / 2, 0);
    const dn = Math.floor(dw / 0.9);
    for (let i = 0; i < dn; i++) { const t = (i - (dn - 1) / 2) * 0.9; for (const [px, pz] of [[t, dw / 2], [t, -dw / 2], [dw / 2, t], [-dw / 2, t]]) add(new THREE.BoxGeometry(0.5, 0.5, 0.5), lightM, px, top + 0.28 + dh + 0.25, pz); }
    add(new THREE.ConeGeometry(dw * 0.66, 2.0, 4), roofM, 0, top + 0.28 + dh + 1.1, 0).rotation.y = Math.PI / 4;
    for (const [px, pz] of [[0, dw / 2 + 0.03], [0, -dw / 2 - 0.03]]) add(new THREE.BoxGeometry(0.5, 0.8, 0.06), windowGlow, px, top + 0.28 + dh * 0.55, pz);
    add(new THREE.CylinderGeometry(0.05, 0.05, 2.0, 5), M(0x4a301c), 0, top + 0.28 + dh + 3.0, 0);
    add(new THREE.BoxGeometry(1.1, 0.6, 0.05), gold ? M(0xe0b040) : M(0xb02a2a), 0.55, top + 0.28 + dh + 3.4, 0);
    if (gold) {                                                                                                  // 5단계: 정문 앞 계단과 양옆 금빛 깃발
      add(new THREE.BoxGeometry(3.6, 0.2, 1.2), lightM, 0, 0.1, W / 2 + 0.9); add(new THREE.BoxGeometry(2.8, 0.2, 0.9), lightM, 0, 0.3, W / 2 + 0.7);
      for (const sx of [-1, 1]) { add(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 6), M(0x4a301c), sx * 2.3, 1.7, W / 2 + 1.1); add(new THREE.BoxGeometry(0.7, 1.1, 0.04), M(0xe0b040), sx * 2.3 + 0.38, 2.6, W / 2 + 1.1); }
    }
  });

  function townHallModel(add) {                                              // 2단계 마을 회관: 목골 2층 + 박공 지붕 + 현관 지붕 + 종탑 (정면은 +z)
    const wall = M(0xd9c196, 'plaster', 0.6), beam = M(0x4a301c), roof = M(0x9a3f24, 'shingle', 0.7), roofDk = M(0x7c3019, 'shingle', 0.7), stone = M(0x6f7078, 'rough', 0.9), door = M(0x3a2414), glow = new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffa030, emissiveIntensity: 0.5, flatShading: true });
    const W = 4.6, H = 2.9, B = 0.35, T = B + H;
    add(new THREE.BoxGeometry(W + 0.5, B, W + 0.5), stone, 0, B / 2, 0);                                           // 돌 기단
    add(new THREE.BoxGeometry(W, H, W), wall, 0, B + H / 2, 0);
    add(new THREE.BoxGeometry(W + 0.14, 0.2, W + 0.14), beam, 0, B + H * 0.52, 0);                                  // 2층 허리 들보
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(new THREE.BoxGeometry(0.24, H, 0.24), beam, sx * W / 2, B + H / 2, sz * W / 2);
    for (const sx of [-0.5, 0.5]) for (const sz of [-1, 1]) add(new THREE.BoxGeometry(0.14, H, 0.14), beam, sx * W * 0.5, B + H / 2, sz * (W / 2 + 0.01) * 1);
    for (const sz of [-1, 1]) for (const sx of [-1, 1]) { const br = add(new THREE.BoxGeometry(0.12, 1.3, 0.12), beam, sx * W * 0.3, B + H * 0.27, sz * (W / 2 + 0.02)); br.rotation.z = -sx * 0.7; }
    const roofLen = W + 1.0, gh = 2.1;                                                                              // 용마루가 좌우(x)로 달린 박공 지붕
    const g = gableGeo(W + 0.9, gh, roofLen); const r = add(g, roof, 0, T, 0); r.rotation.y = Math.PI / 2;
    for (const sz of [-1, 1]) { const sl = add(new THREE.BoxGeometry(roofLen + 0.1, 0.12, 0.16), roofDk, 0, T + gh + 0.02, 0); sl.scale.z = 1; }
    add(new THREE.BoxGeometry(roofLen + 0.2, 0.16, 0.22), roofDk, 0, T + gh, 0);                                    // 용마루
    for (const sx of [-1, 1]) {                                                                                     // 양 끝 박공 벽(회반죽) + 들보
      const gw = add(gableGeo(W + 0.5, gh - 0.1, 0.1), wall, sx * (roofLen / 2 - 0.1), T + 0.02, 0); gw.rotation.y = Math.PI / 2;
    }
    add(new THREE.BoxGeometry(0.6, 1.7, 0.6), stone, 1.5, T + 1.0, -1.1); add(new THREE.BoxGeometry(0.75, 0.16, 0.75), stone, 1.5, T + 1.95, -1.1);   // 굴뚝
    // 정면(+z): 큰 이중문 + 현관 지붕과 기둥 + 창
    add(new THREE.BoxGeometry(1.5, 1.9, 0.14), door, 0, B + 0.95, W / 2 + 0.04); add(new THREE.BoxGeometry(0.06, 1.9, 0.16), beam, 0, B + 0.95, W / 2 + 0.06);
    add(new THREE.BoxGeometry(1.8, 0.16, 0.18), beam, 0, B + 1.98, W / 2 + 0.06);
    for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.2, 2.2, 0.2), beam, sx * 1.05, B + 1.1, W / 2 + 1.0);
    const pr = add(new THREE.BoxGeometry(2.8, 0.14, 1.4), roof, 0, B + 2.3, W / 2 + 0.7); pr.rotation.x = 0.28;
    add(new THREE.BoxGeometry(2.0, 0.12, 1.0), stone, 0, B + 0.06, W / 2 + 0.7);                                    // 현관 바닥
    for (const sx of [-1.45, 1.45]) { add(new THREE.BoxGeometry(0.7, 0.8, 0.1), glow, sx, B + 0.9, W / 2 + 0.04); add(new THREE.BoxGeometry(0.9, 0.1, 0.14), beam, sx, B + 1.36, W / 2 + 0.06); add(new THREE.BoxGeometry(0.9, 0.1, 0.18), M(0x3f6b34), sx, B + 0.46, W / 2 + 0.12); }
    for (const sx of [-1.45, 0, 1.45]) { add(new THREE.BoxGeometry(0.6, 0.7, 0.1), glow, sx, B + H * 0.76, W / 2 + 0.04); add(new THREE.BoxGeometry(0.1, 0.8, 0.14), beam, sx - 0.38, B + H * 0.76, W / 2 + 0.07); add(new THREE.BoxGeometry(0.1, 0.8, 0.14), beam, sx + 0.38, B + H * 0.76, W / 2 + 0.07); }
    for (const sz of [-0.9, 0.9]) add(new THREE.BoxGeometry(0.1, 0.7, 0.6), glow, W / 2 + 0.04, B + H * 0.55, sz);   // 옆 창
    add(new THREE.BoxGeometry(0.5, 0.9, 0.5), M(0x5a3a22), 0, T + gh + 0.45, 0);                                   // 종탑
    add(new THREE.BoxGeometry(0.32, 0.4, 0.32), M(0xc9a23a), 0, T + gh + 0.7, 0);
    add(new THREE.ConeGeometry(0.55, 0.7, 4), roofDk, 0, T + gh + 1.25, 0).rotation.y = Math.PI / 4;
    add(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 5), beam, 0, T + gh + 1.9, 0);                                  // 깃대와 깃발
    add(new THREE.BoxGeometry(0.7, 0.4, 0.04), M(0xc23a2a), 0.36, T + gh + 2.25, 0);
  }

  function barracksModel(add) {                                              // 병영: 돌 기단 + 목골 긴 건물 + 박공 지붕 + 문 앞 무기 걸이와 방패 (정면은 +z, 크기 6.4x4.4)
    const wall = M(0xb9b3a4, 'plaster', 0.6), beam = M(0x4a301c), roof = M(0x5a4a42, 'shingle', 0.7), roofDk = M(0x3f332e, 'shingle', 0.7), stone = M(0x6f7078, 'rough', 0.9), door = M(0x3a2414), iron = M(0x8d9199), red = M(0xb3342a), blue = M(0x2f4f8f);
    const glow = new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffa030, emissiveIntensity: 0.5, flatShading: true });
    const L = 6.4, D = 4.4, H = 1.9, B = 0.3, T = B + H;
    add(new THREE.BoxGeometry(L + 0.4, B, D + 0.4), stone, 0, B / 2, 0);
    add(new THREE.BoxGeometry(L, H, D), wall, 0, B + H / 2, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new THREE.BoxGeometry(0.3, H, 0.3), beam, sx * L / 2, B + H / 2, sz * D / 2);
    for (const sx of [-2.1, -0.7, 0.7, 2.1]) for (const sz of [-1, 1]) add(new THREE.BoxGeometry(0.14, H, 0.14), beam, sx, B + H / 2, sz * (D / 2 + 0.02));
    for (const sz of [-1, 1]) add(new THREE.BoxGeometry(L + 0.1, 0.16, 0.16), beam, 0, T - 0.05, sz * (D / 2 + 0.02));
    const gh = 1.7;                                                                                              // 용마루가 x 방향인 지붕
    add(gableGeo(D + 0.9, gh, L + 0.8), roof, 0, T, 0).rotation.y = Math.PI / 2;
    add(new THREE.BoxGeometry(L + 0.9, 0.14, 0.2), roofDk, 0, T + gh, 0);
    for (const sx of [-1, 1]) add(gableGeo(D + 0.4, gh - 0.1, 0.1), wall, sx * (L / 2 + 0.3), T + 0.02, 0).rotation.y = Math.PI / 2;
    add(new THREE.BoxGeometry(0.6, 1.5, 0.6), stone, -2.2, T + 0.9, -0.8); add(new THREE.BoxGeometry(0.75, 0.14, 0.75), stone, -2.2, T + 1.7, -0.8);
    add(new THREE.BoxGeometry(1.4, 1.5, 0.12), door, 0, B + 0.75, D / 2 + 0.04); add(new THREE.BoxGeometry(0.06, 1.5, 0.14), beam, 0, B + 0.75, D / 2 + 0.06);   // 큰 문과 문틀
    add(new THREE.BoxGeometry(1.7, 0.18, 0.2), beam, 0, B + 1.58, D / 2 + 0.06);
    for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.14, 1.6, 0.14), beam, sx * 0.78, B + 0.8, D / 2 + 0.06);
    for (const wx of [-2.3, -1.3, 1.3, 2.3]) { add(new THREE.BoxGeometry(0.55, 0.5, 0.1), glow, wx, B + 1.1, D / 2 + 0.04); add(new THREE.BoxGeometry(0.7, 0.08, 0.14), beam, wx, B + 1.4, D / 2 + 0.06); }
    for (const sx of [-1.9, 1.9]) { add(new THREE.CylinderGeometry(0.4, 0.4, 0.08, 10), sx < 0 ? red : blue, sx, B + 1.0, D / 2 + 0.12).rotation.x = Math.PI / 2; add(new THREE.CylinderGeometry(0.1, 0.1, 0.1, 8), iron, sx, B + 1.0, D / 2 + 0.17).rotation.x = Math.PI / 2; }   // 방패 장식
    for (const sx of [-1, 1]) { add(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 5), beam, sx * 1.15, B + 0.9, D / 2 + 0.5); add(new THREE.SphereGeometry(0.1, 6, 5), glow, sx * 1.15, B + 1.85, D / 2 + 0.5); }   // 횃불
    add(new THREE.BoxGeometry(1.8, 0.1, 0.1), beam, 2.7, B + 1.0, D / 2 + 0.5);                                   // 창 걸이대
    for (const sx of [2.0, 2.7, 3.4]) add(new THREE.BoxGeometry(0.1, 1.2, 0.1), beam, sx > 3 ? 3.4 : sx, B + 0.6, D / 2 + 0.5);
    for (const sx of [2.2, 2.5, 2.8, 3.1]) { add(new THREE.CylinderGeometry(0.03, 0.03, 1.9, 4), beam, sx, B + 1.05, D / 2 + 0.4); add(new THREE.ConeGeometry(0.07, 0.25, 4), iron, sx, B + 2.1, D / 2 + 0.4); }
    add(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 5), beam, 0, T + gh + 0.9, 0); add(new THREE.BoxGeometry(0.8, 0.5, 0.04), red, 0.42, T + gh + 1.7, 0);   // 지붕 위 깃발
  }

  function lumberModel(add) {                                                // 벌목장: 통나무 오두막 + 나무 켜는 틀 + 쌓인 통나무와 그루터기 + 도끼
    const log = M(0x7a4f2a), logDk = M(0x5a3a1e), roof = M(0x6b4a2b), cut = M(0xd9b98a), beam = M(0x4a301c), iron = M(0x8d9199), stone = M(0x6f7078);
    add(new THREE.BoxGeometry(2.6, 0.2, 2.2), stone, 0, 0.1, 0);
    for (let i = 0; i < 5; i++) add(new THREE.CylinderGeometry(0.2, 0.2, 2.3, 8), i % 2 ? log : logDk, 0, 0.35 + i * 0.3, 0).rotation.z = Math.PI / 2;      // 쌓은 통나무 벽 (앞뒤는 얇게)
    for (const sz of [-0.95, 0.95]) for (let i = 0; i < 5; i++) add(new THREE.CylinderGeometry(0.2, 0.2, 2.3, 8), i % 2 ? log : logDk, 0, 0.35 + i * 0.3, sz).rotation.z = Math.PI / 2;
    add(new THREE.BoxGeometry(2.3, 1.5, 1.7), logDk, 0, 0.95, 0);
    const rf = add(gableGeo(3.0, 1.0, 2.8), roof, 0, 1.7, 0); rf.rotation.y = Math.PI / 2;
    add(new THREE.BoxGeometry(2.8, 0.1, 0.14), beam, 0, 2.72, 0);
    add(new THREE.BoxGeometry(0.6, 1.0, 0.1), M(0x3a2414), 0, 0.7, 1.0);                                           // 문
    add(new THREE.BoxGeometry(0.5, 0.45, 0.08), new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffa030, emissiveIntensity: 0.4 }), 0.8, 1.1, 1.0);
    for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.12, 1.1, 0.12), beam, sx * 0.9, 0.55, -2.0);               // 톱질 틀 (X자)
    add(new THREE.BoxGeometry(2.0, 0.14, 0.14), beam, 0, 0.75, -2.0);
    for (const sx of [-1, 1]) { const x = add(new THREE.BoxGeometry(0.1, 1.2, 0.1), beam, sx * 0.9, 0.6, -2.0); x.rotation.z = sx * 0.5; }
    add(new THREE.CylinderGeometry(0.22, 0.22, 1.9, 8), log, 0, 0.95, -2.0).rotation.z = Math.PI / 2;                 // 켜는 중인 통나무
    add(new THREE.CylinderGeometry(0.4, 0.45, 0.45, 8), logDk, 1.9, 0.22, 1.1); add(new THREE.CylinderGeometry(0.36, 0.36, 0.05, 8), cut, 1.9, 0.46, 1.1);   // 그루터기
    add(new THREE.BoxGeometry(0.08, 0.55, 0.08), beam, 1.9, 0.75, 1.1).rotation.z = 0.5; add(new THREE.BoxGeometry(0.3, 0.2, 0.05), iron, 2.05, 0.95, 1.1);    // 꽂힌 도끼
    for (let r = 0; r < 3; r++) for (let i = 0; i < 3 - r; i++) add(new THREE.CylinderGeometry(0.22, 0.22, 1.6, 8), r ? log : logDk, 2.0, 0.22 + r * 0.38, -1.0 + i * 0.5 + r * 0.25).rotation.z = Math.PI / 2;   // 통나무 더미
    for (const sz of [-1.0, 1.0]) add(new THREE.BoxGeometry(0.08, 0.08, 0.06), cut, 2.82, 0.4, sz * 0.4);
  }

  function quarryModel(add) {                                                // 채석장: 깎인 바위 단 + 돌 블록 + 크레인(도르래) + 수레 + 곡괭이
    const rock = M(0x9a9aa2), rockDk = M(0x7c7d86), block = M(0xb4b6bc), beam = M(0x4a301c), rope = M(0xc9b28a), iron = M(0x8d9199), cart = M(0x7a4f2a);
    add(new THREE.BoxGeometry(3.2, 0.5, 2.4), rockDk, -0.6, 0.25, -0.3); add(new THREE.BoxGeometry(2.4, 0.5, 1.8), rock, -0.8, 0.75, -0.5); add(new THREE.BoxGeometry(1.5, 0.5, 1.2), rockDk, -1.0, 1.25, -0.6);   // 깎아 낸 계단식 바위
    add(new THREE.DodecahedronGeometry(0.6, 0), rock, -1.9, 0.5, 0.6);
    for (const [x, z, s] of [[1.0, 0.9, 0.8], [1.9, 0.6, 0.7], [1.3, 1.6, 0.6]]) { add(new THREE.BoxGeometry(s, s * 0.7, s), block, x, s * 0.35, z).rotation.y = x; }   // 다듬은 돌 블록
    add(new THREE.BoxGeometry(0.8, 0.5, 0.8), block, 1.5, 1.05, 0.9).rotation.y = 0.4;
    add(new THREE.BoxGeometry(0.16, 2.6, 0.16), beam, 0.6, 1.3, -0.9);                                              // 크레인 기둥과 팔
    add(new THREE.BoxGeometry(1.8, 0.14, 0.14), beam, 1.4, 2.5, -0.9);
    const br = add(new THREE.BoxGeometry(0.1, 1.2, 0.1), beam, 0.95, 2.0, -0.9); br.rotation.z = 0.8;
    add(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 4), rope, 2.1, 1.9, -0.9); add(new THREE.BoxGeometry(0.5, 0.35, 0.5), block, 2.1, 1.1, -0.9);
    add(new THREE.BoxGeometry(0.9, 0.35, 0.6), cart, -2.0, 0.55, 1.5); for (const sx of [-0.3, 0.3]) add(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 8), M(0x3a2414), -2.0 + sx, 0.25, 1.82).rotation.x = Math.PI / 2;   // 수레
    for (const sx of [-0.3, 0.3]) add(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 8), M(0x3a2414), -2.0 + sx, 0.25, 1.18).rotation.x = Math.PI / 2;
    add(new THREE.DodecahedronGeometry(0.3, 0), rock, -2.0, 0.85, 1.5);
    add(new THREE.BoxGeometry(0.08, 1.0, 0.08), beam, 0.1, 0.5, 1.4).rotation.z = 0.4; add(new THREE.BoxGeometry(0.5, 0.1, 0.1), iron, -0.05, 0.98, 1.4);      // 기대 둔 곡괭이
  }

  const towerModel = withStone(function towerModel0(add) {                                                 // 방어 타워: 비탈진 돌 기단 + 돌 몸통 + 화살 구멍 + 돌출 흉벽 + 목재 지붕과 깃발 (궁수 높이는 y≈4.3 유지)
    const st = M(0x7f838c), stDk = M(0x6a6e77), top = M(0x5c606a), wood = M(0x6b4a2b), roof = M(0x8c3a24), flag = M(0xc23a2a), slit = M(0x14161c);
    add(new THREE.CylinderGeometry(1.7, 1.9, 0.6, 10), stDk, 0, 0.3, 0);
    add(new THREE.CylinderGeometry(1.2, 1.5, 3.4, 10), st, 0, 2.3, 0);
    for (const y of [1.2, 2.2, 3.1]) add(new THREE.CylinderGeometry(1.5 - (y - 0.6) * 0.08, 1.5 - (y - 0.6) * 0.08, 0.1, 10), stDk, 0, y, 0);   // 돌 단 줄
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + Math.PI / 4; add(new THREE.BoxGeometry(0.12, 0.6, 0.12), slit, Math.cos(a) * 1.3, 2.4, Math.sin(a) * 1.3); }   // 화살 구멍
    add(new THREE.CylinderGeometry(1.0, 1.0, 0.7, 8), slit, 0, 0.7, 1.45).scale.set(0.5, 1, 0.1);                   // 문
    add(new THREE.CylinderGeometry(1.85, 1.3, 0.5, 10), top, 0, 4.0, 0);                                            // 밖으로 돌출한 받침
    add(new THREE.CylinderGeometry(1.8, 1.8, 0.16, 10), wood, 0, 4.3, 0);                                           // 전망 바닥
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; add(new THREE.BoxGeometry(0.5, 0.5, 0.45), top, Math.cos(a) * 1.7, 4.65, Math.sin(a) * 1.7).rotation.y = -a; }   // 흉벽
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + Math.PI / 4; add(new THREE.BoxGeometry(0.14, 1.6, 0.14), wood, Math.cos(a) * 1.0, 5.3, Math.sin(a) * 1.0); }   // 지붕 기둥
    add(new THREE.ConeGeometry(1.55, 1.0, 8), roof, 0, 6.4, 0);
    add(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 5), wood, 0, 7.4, 0); add(new THREE.BoxGeometry(0.6, 0.35, 0.04), flag, 0.3, 7.7, 0);
  });

  // ---------- 5단계 '권좌의 도시' 건물: 광장 분수, 집결장(깃발 터), 가축 우리 ----------
  function plazaModel(add) {                                                 // 광장: 둥근 포석 + 분수 + 가로등 네 개 + 긴 의자
    add(new THREE.CylinderGeometry(3.0, 3.1, 0.14, 24), M(0x9b9a94), 0, 0.07, 0);
    add(new THREE.CylinderGeometry(2.1, 2.2, 0.1, 24), M(0xb5b3aa), 0, 0.17, 0);
    add(new THREE.CylinderGeometry(1.35, 1.5, 0.55, 16), M(0x8d9098), 0, 0.42, 0);                              // 분수 테두리
    add(new THREE.CylinderGeometry(1.15, 1.15, 0.08, 16), new THREE.MeshStandardMaterial({ color: 0x3a78c8, roughness: 0.25 }), 0, 0.66, 0);
    add(new THREE.CylinderGeometry(0.22, 0.3, 1.3, 8), M(0xa9acb4), 0, 1.2, 0);                                // 가운데 기둥
    add(new THREE.CylinderGeometry(0.6, 0.3, 0.2, 10), M(0xa9acb4), 0, 1.85, 0);
    add(new THREE.SphereGeometry(0.2, 8, 6), M(0xe0b040), 0, 2.15, 0);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      add(new THREE.CylinderGeometry(0.06, 0.07, 2.1, 6), M(0x2f3036), sx * 2.5, 1.05, sz * 2.5);
      add(new THREE.SphereGeometry(0.2, 8, 6), lampGlow, sx * 2.5, 2.2, sz * 2.5);
    }
    for (const s of [-1, 1]) { add(new THREE.BoxGeometry(1.6, 0.12, 0.4), woodMat2, 0, 0.5, s * 2.15); for (const dx of [-0.65, 0.65]) add(new THREE.BoxGeometry(0.12, 0.4, 0.34), M(0x6a6e78), dx, 0.22, s * 2.15); }
  }
  function musterModel(add) {                                                // 집결장(작게): 다진 흙 마당 + 깃발 세 개(깃발 색) + 단상 + 무기 걸이
    add(new THREE.BoxGeometry(6.2, 0.1, 4.4), M(0x8a6c48), 0, 0.05, 0);
    for (const z of [-2.25, 2.25]) add(new THREE.BoxGeometry(6.5, 0.18, 0.22), M(0x6a6e78), 0, 0.09, z);
    for (const x of [-3.15, 3.15]) add(new THREE.BoxGeometry(0.22, 0.18, 4.4), M(0x6a6e78), x, 0.09, 0);
    CFG.BANNER.COLORS.forEach((c, i) => {
      const x = (i - 1) * 1.9;
      add(new THREE.CylinderGeometry(0.06, 0.08, 3.6, 6), M(0x4a301c), x, 1.9, -1.5);
      add(new THREE.BoxGeometry(1.0, 1.2, 0.05), M(c), x + 0.55, 3.0, -1.5);
    });
    add(new THREE.BoxGeometry(1.8, 0.4, 1.1), woodMat2, 0, 0.25, 0.5);                                           // 단상
    add(new THREE.BoxGeometry(0.1, 1.2, 1.8), woodMat2, 2.5, 0.7, 0.9);                                           // 무기 걸이
    for (const z of [0.3, 0.9, 1.5]) add(new THREE.BoxGeometry(0.06, 1.0, 0.06), M(0x9aa0aa), 2.4, 0.85, z);
  }
  function penModel(add, seed, add0) {                                       // 가축 우리: 나무 울타리 + 건초 + 양 (seed 로 마리 수가 조금 달라진다)
    const w = 5.2, d = 4.2, post = M(0x6b4a2a), rnd = rngOf(seed || 7);
    add(new THREE.BoxGeometry(w, 0.06, d), M(0x6f8a3a), 0, 0.03, 0);
    for (const z of [-d / 2, d / 2]) for (const y of [0.45, 0.85]) add(new THREE.BoxGeometry(w, 0.09, 0.09), post, 0, y, z);
    for (const x of [-w / 2, w / 2]) for (const y of [0.45, 0.85]) add(new THREE.BoxGeometry(0.09, 0.09, d), post, x, y, 0);
    for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2], [0, -d / 2], [0, d / 2]]) add(new THREE.BoxGeometry(0.14, 1.1, 0.14), post, x, 0.55, z);
    add(new THREE.BoxGeometry(1.2, 0.6, 0.9), M(0xd8b848), w / 2 - 1.0, 0.3, -d / 2 + 0.8);                      // 건초 더미
    const n = 3 + Math.floor(rnd() * 3), wool = M(0xeeeeea), face = M(0x3a3430), sheep = [];
    for (let i = 0; i < n; i++) {                                                                                 // 양: 그룹 하나 = 몸 + 머리 + 다리 (우리 안을 돌아다닌다)
      const s = new THREE.Group(), body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.55), wool), head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), face);
      body.position.y = 0.55; head.position.set(0.55, 0.65, 0); body.castShadow = head.castShadow = true; s.add(body, head);
      for (const [lx, lz] of [[-0.3, -0.2], [0.3, -0.2], [-0.3, 0.2], [0.3, 0.2]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.1), face); l.position.set(lx, 0.15, lz); s.add(l); }
      s.position.set((rnd() - 0.5) * (w - 1.8) - 0.4, 0, (rnd() - 0.5) * (d - 1.2)); s.rotation.y = rnd() * 6.28;
      s.userData = { tx: s.position.x, tz: s.position.z, wait: rnd() * 3, ph: rnd() * 6, cx: -0.4, cz: 0, bx: 1.7, bz: 1.5, sp: 0.8 }; sheep.push(s); add0(s);
    }
    return sheep;
  }
  function windmillModel(add, g) {                                           // 풍차: 돌 몸통 + 나무 모자 + 돌아가는 날개 네 개 + 곡식 자루
    add(new THREE.CylinderGeometry(1.25, 1.75, 0.5, 10), M(0x8d9098, 'rough', 0.9), 0, 0.25, 0);
    add(new THREE.CylinderGeometry(1.0, 1.5, 3.6, 10), M(0xd8cfba, 'plaster', 0.6), 0, 2.3, 0);
    add(new THREE.CylinderGeometry(1.05, 1.05, 0.2, 10), M(0x6a4a2a), 0, 4.15, 0);
    add(new THREE.ConeGeometry(1.35, 1.6, 10), houseRoof, 0, 5.0, 0);
    add(new THREE.BoxGeometry(0.7, 1.2, 0.12), M(0x4a301c), 0, 0.85, 1.42);                                      // 문
    add(new THREE.BoxGeometry(0.4, 0.5, 0.1), windowGlow, 0, 3.0, 1.2);
    const hub = new THREE.Group(); hub.position.set(0, 4.4, 1.35);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.5, 8), M(0x4a301c)); cap.rotation.x = Math.PI / 2; hub.add(cap);
    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Group(); arm.rotation.z = i * Math.PI / 2;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3.4, 0.1), M(0x6a4a2a)), sail = new THREE.Mesh(new THREE.BoxGeometry(0.75, 2.3, 0.05), M(0xf0e8d0));
      bar.position.y = 1.7; sail.position.set(0.45, 2.0, 0.03); bar.castShadow = sail.castShadow = true; arm.add(bar, sail); hub.add(arm);
    }
    g.add(hub); g.userData.sails = hub;
    for (const [x, z] of [[1.6, 0.6], [1.9, 1.1]]) add(new THREE.CylinderGeometry(0.3, 0.34, 0.5, 8), M(0xc8a860), x, 0.25, z);
  }
  function infirmaryModel(add) {                                             // 병원: 흰 회벽 긴 집 + 붉은 지붕 + 빨간 십자 간판 + 약초밭
    add(new THREE.BoxGeometry(5.6, 0.3, 3.8), M(0x8d9098, 'rough', 0.9), 0, 0.15, 0);
    add(new THREE.BoxGeometry(5.0, 2.1, 3.2), M(0xe8e2d2, 'plaster', 0.6), 0, 1.35, 0);
    const roof = add(gableGeo(5.6, 1.5, 3.8), M(0xa84a3a, 'shingle', 0.7), 0, 2.4, 0); roof.rotation.y = Math.PI / 2; roof.scale.set(1, 1, 1);
    add(new THREE.BoxGeometry(0.9, 1.5, 0.12), M(0x6a4a2a), 0, 1.05, 1.62);
    for (const x of [-1.7, 1.7]) add(new THREE.BoxGeometry(0.7, 0.6, 0.1), windowGlow, x, 1.7, 1.62);
    add(new THREE.BoxGeometry(1.0, 1.0, 0.08), M(0xf4f4f0), 0, 3.0, 1.66);
    add(new THREE.BoxGeometry(0.62, 0.18, 0.1), M(0xc0302a), 0, 3.0, 1.7); add(new THREE.BoxGeometry(0.18, 0.62, 0.1), M(0xc0302a), 0, 3.0, 1.7);
    add(new THREE.BoxGeometry(2.4, 0.1, 0.9), dirt, 3.4, 0.05, 0.6);
    for (let i = 0; i < 5; i++) add(new THREE.ConeGeometry(0.16, 0.45, 5), cropMat, 2.5 + i * 0.4, 0.3, 0.6);
  }
  function monumentModel(add, g) {                                           // 승전 기념비: 돌 계단 + 비석 + 금빛 꼭대기 + 꺾은 세력마다 전리품 깃발이 오른다
    add(new THREE.CylinderGeometry(1.9, 2.0, 0.25, 12), M(0x8d9098), 0, 0.12, 0); add(new THREE.CylinderGeometry(1.4, 1.5, 0.25, 12), M(0xa9acb4), 0, 0.37, 0);
    add(new THREE.BoxGeometry(0.9, 2.6, 0.9), M(0xb8bac0), 0, 1.7, 0); add(new THREE.ConeGeometry(0.75, 0.8, 4), M(0xe0b040), 0, 3.4, 0).rotation.y = Math.PI / 4;
    add(new THREE.SphereGeometry(0.22, 8, 6), M(0xe0b040), 0, 3.95, 0);
    g.userData.pennants = CFG.REALMS.map((r, i) => {
      const a = i * 2.094 + 0.5, x = Math.cos(a) * 1.35, z = Math.sin(a) * 1.35;
      add(new THREE.CylinderGeometry(0.04, 0.05, 2.4, 5), M(0x4a301c), x, 1.45, z);
      const f = new THREE.Group(), cloth = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.04), M(parseInt(r.color.slice(1), 16))); cloth.position.set(0.32, -0.45, 0); cloth.castShadow = true;
      f.add(cloth); f.position.set(x, 2.6, z); f.visible = false; g.add(f); return f;
    });
  }
  function stableModel(add, seed, add0) {                                    // 마구간: 나무 외양간(칸막이 셋) + 앞 방목장 울타리 + 말 두 마리
    const rnd = rngOf(seed || 11), wood = M(0x7a5a3a), post = M(0x6b4a2a);
    add(new THREE.BoxGeometry(5.2, 0.1, 6.4), M(0x7a8a3a), 0, 0.05, 0.3);
    add(new THREE.BoxGeometry(5.0, 2.2, 2.6), wood, 0, 1.2, -2.2);
    const roof = add(gableGeo(5.6, 1.3, 2.9), M(0x6a3a2a, 'shingle', 0.7), 0, 2.3, -2.2); roof.rotation.y = Math.PI / 2;
    for (const x of [-1.6, 0, 1.6]) { add(new THREE.BoxGeometry(1.2, 1.5, 0.1), M(0x3a2a1c), x, 0.85, -0.88); add(new THREE.BoxGeometry(0.1, 1.4, 0.1), post, x + 0.8, 0.7, -0.8); }
    for (const z of [0.2, 3.2]) for (const y of [0.45, 0.85]) add(new THREE.BoxGeometry(5.0, 0.09, 0.09), post, 0, y, z);
    for (const x of [-2.5, 2.5]) for (const y of [0.45, 0.85]) add(new THREE.BoxGeometry(0.09, 0.09, 3.0), post, x, y, 1.7);
    for (const [x, z] of [[-2.5, 0.2], [2.5, 0.2], [-2.5, 3.2], [2.5, 3.2], [0, 3.2]]) add(new THREE.BoxGeometry(0.14, 1.1, 0.14), post, x, 0.55, z);
    add(new THREE.BoxGeometry(1.0, 0.5, 0.7), M(0xd8b848), 2.0, 0.25, 2.5);
    const horses = [];
    for (let i = 0; i < 2; i++) {
      const h = horseModel(rnd); h.position.set(-1.0 + i * 1.8, 0, 1.7); h.rotation.y = rnd() * 6.28; h.scale.setScalar(0.85);
      h.userData = { tx: h.position.x, tz: h.position.z, wait: rnd() * 3, ph: rnd() * 6, cx: 0, cz: 1.7, bx: 1.5, bz: 1.0, sp: 0.9 }; horses.push(h); add0(h);
    }
    return horses;
  }
  const gatehouseModel = withStone(function gatehouseModel0(g, gate) {                                         // 성문 문루: 문 양옆 돌탑 + 위의 아치 + 횃불 (보기용, 지나다니는 데 방해 없음)
    const grp = new THREE.Group(), stone = M(0x8d9098), dark = M(0x6a6e78), light = M(0xa9acb4);
    const mk = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; grp.add(o); return o; };
    for (const s of [-1, 1]) {
      const x = s * 3.5;
      mk(new THREE.BoxGeometry(2.4, 4.4, 2.8), stone, x, 2.2, 0); mk(new THREE.BoxGeometry(2.9, 0.3, 3.3), light, x, 4.5, 0);
      for (const [px, pz] of [[-1, -1.3], [0, -1.3], [1, -1.3], [-1, 1.3], [0, 1.3], [1, 1.3]]) mk(new THREE.BoxGeometry(0.55, 0.5, 0.5), light, x + px * 1.0, 4.9, pz);
      mk(new THREE.BoxGeometry(0.1, 0.8, 0.06), dark, x, 2.8, 1.43);
      mk(new THREE.ConeGeometry(0.17, 0.5, 6), lampGlow, x + s * 0.0, 5.45, 0);
      const halo = new THREE.Sprite(haloMat); halo.scale.set(3.4, 3.4, 1); halo.position.set(x, 5.5, 0); halo.renderOrder = 5; grp.add(halo); lampHalos.push(halo);
    }
    mk(new THREE.BoxGeometry(5.0, 0.7, 2.4), stone, 0, 4.0, 0); mk(new THREE.BoxGeometry(5.4, 0.25, 2.8), light, 0, 4.45, 0);
    mk(new THREE.BoxGeometry(1.4, 1.1, 0.06), M(0xe0b040), 0, 3.0, 1.0);
    grp.position.set(gate.x, 0, gate.z); grp.rotation.y = Math.atan2(gate.nx, gate.nz); scene.add(grp); doormats.push(grp);
    return grp;
  });
  function trainyardModel(add, g) {                                          // 훈련소: 모래 마당 + 나무 울타리 + 짚 인형 셋 + 과녁 + 무기 걸이 + 깃발. 아침 훈련 때 인형이 흔들린다
    const post = M(0x6b4a2a);
    add(new THREE.BoxGeometry(7, 0.1, 5.6), M(0xc8b080), 0, 0.05, 0);
    for (const z of [-2.8, 2.8]) for (const y of [0.45, 0.85]) add(new THREE.BoxGeometry(7, 0.08, 0.08), post, 0, y, z);
    for (const x of [-3.5, 3.5]) for (const y of [0.45, 0.85]) add(new THREE.BoxGeometry(0.08, 0.08, 5.6), post, x, y, 0);
    for (const [x, z] of [[-3.5, -2.8], [3.5, -2.8], [-3.5, 2.8], [3.5, 2.8], [0, -2.8], [0, 2.8]]) add(new THREE.BoxGeometry(0.14, 1.1, 0.14), post, x, 0.55, z);
    g.userData.dummies = [-2, 0, 2].map(x => {
      const d = new THREE.Group(), mk = (geo, m, px, py, pz) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.castShadow = true; d.add(o); };
      mk(new THREE.CylinderGeometry(0.07, 0.09, 1.6, 6), post, 0, 0.8, 0); mk(new THREE.BoxGeometry(1.0, 0.1, 0.1), post, 0, 1.25, 0); mk(new THREE.BoxGeometry(0.5, 0.7, 0.3), M(0xd8c070), 0, 1.15, 0); mk(new THREE.SphereGeometry(0.22, 8, 6), M(0xe0cc88), 0, 1.75, 0);
      d.position.set(x, 0, -1.0); g.add(d); return d;
    });
    add(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 5), post, 2.9, 0.9, 1.6);                                    // 활 과녁
    for (const [r, c, y] of [[0.7, 0xf0f0e8, 0], [0.48, 0xc0302a, 0.02], [0.24, 0xf0f0e8, 0.04]]) add(new THREE.CylinderGeometry(r, r, 0.1, 18), M(c), 2.9, 1.7, 1.6 + y).rotation.x = Math.PI / 2;
    add(new THREE.BoxGeometry(1.6, 0.9, 0.1), woodMat2, -2.3, 0.6, 2.4); for (const x of [-2.8, -2.3, -1.8]) add(new THREE.BoxGeometry(0.06, 1.1, 0.06), M(0x9aa0aa), x, 1.2, 2.4);       // 무기 걸이
    add(new THREE.CylinderGeometry(0.05, 0.06, 3.2, 6), post, 3.3, 1.6, -2.4); add(new THREE.BoxGeometry(0.9, 0.7, 0.04), M(0xb02a2a), 3.75, 2.9, -2.4);
  }
  // ---------- 5단계 마을의 활기: 손수레 두 대가 큰길을 오가고, 광장 분수 곁에 마을 사람들이 서 있다 (보기용, 충돌 없음. 낮에만 보인다) ----------
  const townLife = { done: false, carts: [], folk: [] };
  function cartModel() {                                                       // 수레: 나무 짐칸 + 바퀴 둘 + 짐(자루·통) + 짐 끄는 말
    const g = new THREE.Group(), wood = M(0x7a5a3a), mk = (geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
    mk(new THREE.BoxGeometry(2.2, 0.15, 1.2), wood, 0, 0.7, 0); for (const z of [-0.6, 0.6]) mk(new THREE.BoxGeometry(2.2, 0.35, 0.08), wood, 0, 0.9, z); mk(new THREE.BoxGeometry(0.08, 0.35, 1.2), wood, -1.1, 0.9, 0);
    g.userData.wheels = [-0.65, 0.65].map(z => { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 12), M(0x4a301c)); w.rotation.x = Math.PI / 2; w.position.set(0, 0.42, z * 1.0 + (z > 0 ? 0.1 : -0.1)); w.castShadow = true; g.add(w); return w; });
    mk(new THREE.BoxGeometry(0.5, 0.4, 0.45), M(0xc8a860), -0.5, 1.0, -0.2); mk(new THREE.BoxGeometry(0.5, 0.4, 0.45), M(0xd8c890), -0.3, 1.0, 0.3); mk(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 8), M(0x8a5a2a), 0.2, 1.05, 0);
    const horse = horseModel(() => 0.4, { coat: 0x8a6a4a, blanket: 0x6a4a2a }); horse.scale.setScalar(0.85); horse.position.set(2.5, 0, 0); g.add(horse);
    mk(new THREE.BoxGeometry(0.9, 0.06, 0.06), wood, 1.45, 0.8, -0.25); mk(new THREE.BoxGeometry(0.9, 0.06, 0.06), wood, 1.45, 0.8, 0.25);
    g.userData.horse = horse; return g;
  }
  function townLifeSync() {
    if (townLife.done || stage < 5) return; const plaza = builtBuildings('plaza')[0]; if (!plaza) return;
    townLife.done = true;
    for (const [x0, x1, z] of [[9, 23, 1.4], [-23, -9, -1.4]]) { const c = cartModel(); c.position.set(x0, 0, z); c.userData.run = { x0, x1, z, dir: 1, x: x0, wait: 0 }; scene.add(c); townLife.carts.push(c); }
    const px = plaza.position.x, pz = plaza.position.z;
    [[-1.6, 3.9, 0.3], [-0.9, 3.9, -0.5], [2.0, -3.8, 2.9], [1.2, -3.8, 3.5], [-3.9, 0.8, 1.6]].forEach(([dx, dz, ry], i) => {
      const rig = makeRig('citizen', [0xc05a3a, 0x3a7ac0, 0xd8a83a, 0x5aa05a, 0xa05aa0][i], { seed: 30 + i }), anim = new Anim(rig), g = new THREE.Group();
      g.add(rig.root); g.position.set(px + dx, 0, pz + dz); g.rotation.y = Math.atan2(-dx, -dz) + (i % 2 ? 0.5 : -0.4); anim.base('idle', 0); scene.add(g); townLife.folk.push({ g, anim });
    });
  }
  function townLifeTick(t, dt) {
    townLifeSync(); if (!townLife.done) return;
    const day = nowHour >= 7 && nowHour < 19;
    const far = (o) => (o.position.x - player.position.x) ** 2 + (o.position.z - player.position.z) ** 2 > 3600;
    for (const c of townLife.carts) {
      const r = c.userData.run; c.visible = day;
      if (!day || far(c)) continue;
      if (r.wait > 0) { r.wait -= dt; } else { r.x += r.dir * 1.4 * dt; if (r.x > r.x1) { r.x = r.x1; r.dir = -1; r.wait = 3; } else if (r.x < r.x0) { r.x = r.x0; r.dir = 1; r.wait = 3; } }
      c.position.set(r.x, 0, r.z); c.rotation.y = r.dir > 0 ? 0 : Math.PI;
      const mv = r.wait > 0 ? 0 : 1; for (const w of c.userData.wheels) w.rotation.y += mv * dt * 3.3 * r.dir * -1;
      const h = c.userData.horse, legs = h.userData.legs || []; legs.forEach((l, i) => { l.rotation.z = Math.sin(t * 7 + (i % 2 ? Math.PI : 0)) * 0.4 * mv; }); h.position.y = Math.abs(Math.sin(t * 7)) * 0.04 * mv;
    }
    for (const f of townLife.folk) { f.g.visible = day; if (day && !far(f.g)) f.anim.update(dt); }
  }
  let mountBtnT = 0;
  function lifeTick(t, dt) {                                                 // 우리 안의 양이 돌아다니고, 풍차 날개가 돈다. 기병은 말이 달리고 돌격 힘이 쌓인다. 깃발도 여기서 갱신
    victoryTick(); townLifeTick(t, dt); bannerFlagTick(t); leaderRideTick(t, dt); if ((mountBtnT -= dt) <= 0) { mountBtnT = 0.5; updateMountBtn(); }
    for (const n of npcs) {
      if (!n.horse) continue;
      const mv = Math.hypot(n.position.x - (n.lx ?? n.position.x), n.position.z - (n.lz ?? n.position.z)); n.lx = n.position.x; n.lz = n.position.z;
      const v = dt > 0 ? mv / dt : 0;
      n.charge = v > 3.2 ? Math.min(1.6, (n.charge || 0) + dt) : Math.max(0, (n.charge || 0) - dt * 2);
      const air = n.rig.hopK || 0, bob = horseStep(n.horse, dt, v, air); n.horse.position.y = air * 1.7; if (!n.rig.fallen) n.rider.position.y = 0.8 + bob + n.horse.position.y;
    }
    for (const o of obstacles) {
      const u = o.userData; if (u.type !== 'building' || (!u.sails && !u.sheep && !u.pennants && !u.dummies)) continue;
      if ((o.position.x - player.position.x) ** 2 + (o.position.z - player.position.z) ** 2 > 3600) continue;        // 60칸보다 멀면 움직임을 건너뛴다 (폰 성능)
      if (u.dummies) u.dummies.forEach((d, i) => { d.rotation.z = Math.sin(t * 2.2 + i * 1.7) * 0.035 * (nowHour >= 7 && nowHour < 18 ? 1 : 0.3); });
      if (u.sails) u.sails.rotation.z -= dt * (0.6 + 0.4 * Math.sin(t * 0.3));
      if (u.pennants) u.pennants.forEach((p, i) => { const id = CFG.REALMS[i].id, held = realmHeld(id) > 0, done = realmHeld(id) >= realmSites(id).length; p.visible = held; p.scale.y = done ? 1 : 0.6; p.rotation.y = Math.sin(t * 3 + i * 2) * 0.25; });
      if (!u.sheep) continue;
      for (const s of u.sheep) {
        const d = s.userData, dx = d.tx - s.position.x, dz = d.tz - s.position.z, dist = Math.hypot(dx, dz);
        if (dist < 0.15) {
          if ((d.wait -= dt) <= 0) { d.wait = 1.5 + Math.random() * 4; d.tx = d.cx + (Math.random() - 0.5) * 2 * d.bx; d.tz = d.cz + (Math.random() - 0.5) * 2 * d.bz; }
          s.position.y = 0; continue;
        }
        const ang = Math.atan2(-dz, dx); let da = ang - s.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da)); s.rotation.y += da * Math.min(1, dt * 4);
        const sp = Math.min(dist, d.sp * dt); s.position.x += dx / dist * sp; s.position.z += dz / dist * sp; s.position.y = Math.abs(Math.sin(t * 7 + d.ph)) * 0.05;
      }
    }
  }

  // ---------- Horse: the classic box horse on a jointed skeleton (12 joints), with a walk and a gallop taken from the owner's horse animation pack (js/horse_anim.js, tools/build_horse_anim.py) ----------
  // The horse faces +x (the callers turn it with rotation.y = -PI/2). Every box hangs on a joint; the joints rest with identity rotations, so the clips are plain local rotations.
  function horseModel(rnd, o) {                                              // o = { coat, blanket (saddle blanket colour), armor (barding) }
    o = o || {}; const A = HORSE_ANIM, s = new THREE.Group(), coat = M(o.coat !== undefined ? o.coat : [0x7a4a2a, 0x3a2a22, 0xc8c0a8, 0x9a6a3a][Math.floor(rnd() * 4)]), dark = M(0x2a2018);
    const J = {}, RP = {}; A.bones.forEach(([n, p], i) => { const j = new THREE.Group(); j.name = n; const r = A.rest[i], pr = p >= 0 ? A.rest[p] : [0, 0, 0]; j.position.set(r[0] - pr[0], r[1] - pr[1], r[2] - pr[2]); RP[n] = r; J[n] = j; (p >= 0 ? J[A.bones[p][0]] : s).add(j); });
    const box = (bone, w, h, d, m, x, y, z, rz = 0) => { const k = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m), r = RP[bone]; k.position.set(x - r[0], y - r[1], z - r[2]); k.rotation.z = rz; k.castShadow = true; J[bone].add(k); return k; };
    const seg = (bone, pa, pb, w, d, m, grow = 0) => {                      // a box from point pa to point pb, hung on `bone`
      const dx = pb[0] - pa[0], dy = pb[1] - pa[1], L = Math.hypot(dx, dy) + grow;
      return box(bone, w, L, d, m, (pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2, (pa[2] + pb[2]) / 2, Math.atan2(-dx, dy));
    };
    box('body', 1.7, 0.62, 0.46, coat, -0.02, 1.2, 0);                                                                                                 // body: one block
    seg('neck', [RP.neck[0] - 0.05, RP.neck[1] - 0.05, 0], RP.head, 0.3, 0.22, coat, 0.16);                                                          // neck: one block
    { const hx = RP.head[0], hy = RP.head[1], white = M(0xf4efe4), ca = Math.cos(-0.5), sa = Math.sin(-0.5), at = (d, dy = 0) => [hx + ca * d - sa * dy, hy + sa * d + ca * dy];      // head: a skull that narrows to a slim muzzle and a darker nose, with eyes, ears and a forelock
      const sk = at(0.14), mz = at(0.4, -0.02), ns = at(0.56, -0.025);
      box('head', 0.36, 0.31, 0.27, coat, sk[0], sk[1], 0, -0.5); box('head', 0.34, 0.24, 0.2, coat, mz[0], mz[1], 0, -0.5); box('head', 0.12, 0.2, 0.17, dark, ns[0], ns[1], 0, -0.5);
      for (const z of [-1, 1]) { const e = at(0.18, 0.05); box('head', 0.055, 0.06, 0.04, white, e[0], e[1], z * 0.14, -0.5); box('head', 0.03, 0.04, 0.03, dark, e[0] + 0.005, e[1], z * 0.16, -0.5); box('head', 0.08, 0.22, 0.06, coat, hx - 0.02, hy + 0.2, z * 0.09, z * -0.12); box('head', 0.035, 0.13, 0.03, dark, hx - 0.01, hy + 0.2, z * 0.09, z * -0.12); }
      box('head', 0.1, 0.18, 0.1, dark, hx + 0.02, hy + 0.12, 0, 0.3); }
    { const n0 = [RP.neck[0] - 0.1, RP.neck[1] + 0.2], n1 = [RP.head[0] - 0.12, RP.head[1] + 0.2], ang = Math.atan2(-(n1[0] - n0[0]), n1[1] - n0[1]);              // mane: a thick row of dark tufts along the top of the neck, hanging down the sides
      for (let i = 0; i < 6; i++) { const u = i / 5, x = n0[0] + (n1[0] - n0[0]) * u - 0.02, y = n0[1] + (n1[1] - n0[1]) * u + 0.03 - 0.03 * (i % 2), h = 0.26 + 0.05 * (i % 2); box('neck', 0.16, h, 0.2, dark, x, y, 0, ang); box('neck', 0.1, h * 0.8, 0.34, dark, x - 0.01, y - 0.06, 0, ang); } }
    box('tail', 0.1, 0.55, 0.1, dark, RP.tail[0] - 0.05, RP.tail[1] - 0.22, 0, 0.15);                                                                  // tail
    for (const sd of ['L', 'R']) {
      const z = (i) => RP['f' + sd + i][2], fu = RP['f' + sd + 'U'], fl = RP['f' + sd + 'L'], hu = RP['h' + sd + 'U'], hl = RP['h' + sd + 'L'];
      seg('f' + sd + 'U', [fu[0] + 0.05, fu[1] + 0.2, fu[2]], fl, 0.27, 0.27, coat, 0.04); seg('f' + sd + 'L', fl, [fl[0], 0, fl[2]], 0.19, 0.19, dark, 0.02);        // front leg: upper, lower (with the hoof)
      seg('h' + sd + 'U', hu, hl, 0.31, 0.29, coat, 0.1); seg('h' + sd + 'L', hl, [hl[0], 0, hl[2]], 0.19, 0.19, dark, 0.02);                                // hind leg: upper, lower
    }
    box('body', 0.7, 0.08, 0.52, M(o.blanket !== undefined ? o.blanket : 0x8a2a2a), 0.05, 1.52, 0); box('body', 0.55, 0.12, 0.36, M(0x4a301c), 0.05, 1.58, 0);          // blanket, saddle
    if (o.armor) box('body', 0.5, 0.7, 0.52, M(0x9aa0aa), 0.62, 1.15, 0);                                                                              // barding: a chest plate
    s.userData.legs = []; s.userData.hr = { J, A, t: { walk: rnd() * 1, run: rnd() * 1 }, w: { walk: 0, run: 0 }, q: new THREE.Quaternion(), qa: new THREE.Quaternion(), qb: new THREE.Quaternion(), qr: new THREE.Quaternion() };
    return s;
  }
  // Moves the horse's joints for one frame: speed (m/s) picks standing / walk / gallop (cross-faded); returns how much the back rises (the rider follows it).
  function horseStep(h, dt, speed, air = 0) {
    const R = h.userData.hr; if (!R) return 0;
    const A = R.A, c = A.clips, want = { walk: speed > 0.3 && speed < 4.2 ? 1 : 0, run: speed >= 4.2 ? 1 : 0 }, k = Math.min(1, dt * 6);
    for (const n of ['walk', 'run']) R.w[n] += (want[n] - R.w[n]) * k;
    const rate = { walk: Math.max(0.7, Math.min(2.2, speed / 1.6)) / c.walk.dur, run: Math.max(0.8, Math.min(1.4, speed / 6.5)) / c.run.dur };
    for (const n of ['walk', 'run']) if (R.w[n] > 0.02) R.t[n] = (R.t[n] + dt * rate[n]) % 1;
    const w0 = Math.max(0, 1 - R.w.walk - R.w.run), nb = A.bones.length; let bob = 0;
    const frame = (n, b, out) => { const cl = c[n], f = R.t[n] * cl.n, i = Math.floor(f) % cl.n, j = (i + 1) % cl.n, u = f - Math.floor(f), o = b * 4, q = cl.q; R.qa.set(q[i * nb * 4 + o], q[i * nb * 4 + o + 1], q[i * nb * 4 + o + 2], q[i * nb * 4 + o + 3]); R.qb.set(q[j * nb * 4 + o], q[j * nb * 4 + o + 1], q[j * nb * 4 + o + 2], q[j * nb * 4 + o + 3]); return out.copy(R.qa).slerp(R.qb, u); };
    for (let b = 0; b < nb; b++) {
      const jt = R.J[A.bones[b][0]]; let x = 0, y = 0, z = 0, w = w0;                                  // blend by normalised weights (small rotations: a weighted sum is close enough)
      for (const n of ['walk', 'run']) if (R.w[n] > 0.02) { frame(n, b, R.q); if (x * R.q.x + y * R.q.y + z * R.q.z + w * R.q.w < 0 && n !== 'walk') R.q.set(-R.q.x, -R.q.y, -R.q.z, -R.q.w); x += R.q.x * R.w[n]; y += R.q.y * R.w[n]; z += R.q.z * R.w[n]; w += R.q.w * R.w[n]; }
      jt.quaternion.set(x, y, z, w).normalize();
      if (air > 0) { const nm = A.bones[b][0], th = (nm[0] === 'f' && nm[2] === 'U' ? 0.45 : nm[0] === 'f' && nm[2] === 'L' ? -1.1 : nm[0] === 'h' && nm[2] === 'U' ? -0.35 : nm[0] === 'h' && nm[2] === 'L' ? 0.7 : 0) * air; if (th) { R.qr.set(0, 0, Math.sin(th / 2), Math.cos(th / 2)); jt.quaternion.premultiply(R.qr); } }       // jumping: the legs tuck (front knees fold back, hind legs fold forward)
    }
    // the back bobs with the gait (translation delta of the hips in the clips)
    const hp = R.J.body, r0 = A.rest[0]; let dx = 0, dy = 0, dz = 0;
    for (const n of ['walk', 'run']) if (R.w[n] > 0.02) { const cl = c[n], f = R.t[n] * cl.n, i = Math.floor(f) % cl.n, j = (i + 1) % cl.n, u = f - Math.floor(f); dx += R.w[n] * (cl.p[i * 3] * (1 - u) + cl.p[j * 3] * u); dy += R.w[n] * (cl.p[i * 3 + 1] * (1 - u) + cl.p[j * 3 + 1] * u); dz += R.w[n] * (cl.p[i * 3 + 2] * (1 - u) + cl.p[j * 3 + 2] * u); }
    hp.position.set(r0[0] + dx, r0[1] + dy, r0[2] + dz); bob = dy; h.userData.bob = bob;
    return bob;
  }
  // ---------- 대장간: 장비 제작 창 ----------
  const hallBtnEl = document.getElementById('hallBtn');
  const smithEl = document.getElementById('smithPanel'), smithList = document.getElementById('smithList'), smithBtnEl = document.getElementById('smithBtn');
  let smithOpenFor = null;
  const SMITH_RANGE = 8;
  const smiths = () => builtBuildings('smith');
  const nearestSmith = () => smiths().find(m => Math.hypot(m.position.x - player.position.x, m.position.z - player.position.z) < SMITH_RANGE + m.userData.radius) || null;
  function openSmith() {
    if (dead) return;
    const sm = nearestSmith();
    if (!sm) return toast(smiths().length ? 'Move closer to the Blacksmith' : 'No Blacksmith yet - plan Stage 2 buildings first');
    smithOpenFor = sm; renderSmith(); smithEl.style.display = 'flex';
  }
  function closeSmith() { smithEl.style.display = 'none'; smithOpenFor = null; }
  function renderSmith() {
    const sm = smithOpenFor;
    if (!sm || !obstacles.includes(sm)) return closeSmith();
    document.getElementById('smithRes').textContent = `You have: ${res.wood} Wood · ${res.stone} Stone · ${res.iron} Iron${res.shard || story.beacon ? ` · ${res.shard} Shards` : ''}  (Iron drops from rocks)`;
    smithList.innerHTML = '';
    const SLOT_HEAD = { sword: 'Swords', great: 'Great Swords', spear: 'Spears', bow: 'Bows', armor: 'Armor' };
    for (const slot of Object.keys(SLOT_HEAD)) {
      const h = document.createElement('div'); h.className = 'shead'; h.textContent = `${SLOT_HEAD[slot]} - you use: ${gearDef(playerGear[slot] || 'armor_none').name}`; smithList.appendChild(h);
    for (const [id, d] of Object.entries(CFG.GEAR)) {
      if (!d.cost || d.slot !== slot) continue;
      const stock = sm.userData.stock[id] || 0, equipped = playerGear[d.slot] === id, locked = (d.stage || 1) > stage || (d.req && !story[d.req]);
      const row = document.createElement('div'); row.className = 'srow';
      row.innerHTML = `<div class="sinfo"><b>${d.name}</b> <small>${d.desc}</small><small>${locked ? ((d.stage || 1) > stage ? `Requires Stage ${d.stage} (${CFG.STAGES[d.stage - 1].name})` : 'Locked: open the Dawn Gate first') : `Cost: ${costText(gearCost(d))}`} · On rack: ${stock}${equipped ? ' · You are using this' : ''}</small></div><div class="sbtns"><button data-act="craft">Craft</button><button data-act="equip">Equip</button></div>`;
      const [bc, be] = row.querySelectorAll('button');
      bc.disabled = locked || !canPay(gearCost(d)); be.disabled = stock <= 0 || equipped;
      bc.addEventListener('click', () => craftGear(id)); be.addEventListener('click', () => equipPlayer(id));
      smithList.appendChild(row);
    }
    }
    renderSiegeRows();
  }
  const siegeGear = () => { const g = story.siege || (story.siege = { ram: 0, ladder: 0 }); if (g.catapult === undefined) g.catapult = 0; return g; };
  function renderSiegeRows() {                                         // 공성 장비: 공성 작업장이 있어야 만들 수 있다. 보유 수는 마을 창고에 쌓인다
    const h = document.createElement('div'); h.className = 'shead'; h.textContent = 'Siege gear - for castles'; smithList.appendChild(h);
    if (!builtBuildings('siegeshop').length) { const r = document.createElement('div'); r.className = 'srow'; r.innerHTML = '<div class="sinfo"><small>Build a Siege Workshop first (the last Village Plan step, Stage 3).</small></div>'; smithList.appendChild(r); return; }
    const G = siegeGear();
    for (const [key, name, desc, cost, have, cap] of [['ram', 'Siege Ram', 'Batters a castle gate. Soldiers push it.', CFG.SIEGE.RAM, G.ram, 1], ['ladder', 'Siege Ladder', 'Raise it to climb a castle wall.', CFG.SIEGE.LADDER, G.ladder, CFG.SIEGE.LADDER_MAX], ['catapult', 'Catapult', 'Hurls boulders: cracks a wall open from range and hits the defenders. Needs you or two soldiers beside it.', CFG.SIEGE.CATAPULT, G.catapult, 1]]) {
      const row = document.createElement('div'); row.className = 'srow';
      row.innerHTML = `<div class="sinfo"><b>${name}</b> <small>${desc}</small><small>Cost: ${costText(cost)} · You carry: ${have} / ${cap}</small></div><div class="sbtns"><button>Build</button></div>`;
      const b = row.querySelector('button'); b.disabled = have >= cap || !canPay(cost);
      b.addEventListener('click', () => { if (siegeGear()[key] >= cap || !canPay(cost)) return; payCost(cost); siegeGear()[key]++; forgeEffect(smithOpenFor); updateHud(); toast(`${name} built (${siegeGear()[key]}/${cap})`); renderSmith(); });
      smithList.appendChild(row);
    }
  }
  function forgeEffect(sm) {                  // 모루 위 불꽃 + 화덕이 확 밝아진다 + 쾅 소리
    burst({ x: sm.position.x + 1.2, z: sm.position.z + 2.5, y: 1 }, 20); forgeFlash = 1;
    sfxAt('anvil', sm.position.x, sm.position.z);
  }
  function craftGear(id) {
    const sm = smithOpenFor, d = gearDef(id);
    if (!sm || !canPay(gearCost(d))) return;
    payCost(gearCost(d)); sm.userData.stock[id] = (sm.userData.stock[id] || 0) + 1; refreshRack(sm); updateHud(); report.forged++;
    forgeEffect(sm);
    toast(`Forged: ${d.name}! Soldiers will come to pick it up`);
    renderSmith();
  }
  function equipPlayer(id) {
    const sm = smithOpenFor, d = gearDef(id);
    if (!sm || !(sm.userData.stock[id] > 0)) return;
    sm.userData.stock[id]--; playerGear[d.slot] = id; refreshRack(sm); applyPlayerGear(); updateHud();
    toast(`Equipped ${d.name}`); Snd.play('chime'); renderSmith();
  }
  document.getElementById('smithClose').addEventListener('click', closeSmith);
  // ---------- 플레이어 역할 / 지휘 명령 / 시대 퍼크 ----------
  function setClass(c) {
    playerClass = c; hp = pMaxHp(); hpEl.textContent = Math.ceil(hp);
    document.getElementById('ultBtn').firstChild.textContent = c === 'commander' ? 'Rally Cry' : 'Ultimate';
    document.getElementById('ordBtn').style.display = c === 'commander' ? '' : 'none';
    if (c !== 'commander') order = 'guard';
    updateHud();
  }
  function toggleBird() {
    if (!bird) { savedView = { d: DIST, p: pitch }; bird = true; DIST = exActive ? 58 + (exR - 46) * 1.2 : 58; pitch = 1.3; birdX = exActive ? EXC.x : 0; birdZ = exActive ? EXC.z : 0; }
    else { bird = false; if (savedView) { DIST = savedView.d; pitch = savedView.p; } }
    document.getElementById('birdBtn').classList.toggle('on', bird);
    toast(bird ? "Map view - drag to turn, two fingers (or right-drag) to move, pinch to zoom in close. Press again to return" : 'Back to the hero view');
  }
  function toggleFront() {                                          // 영웅의 앞모습 ↔ 뒷모습 카메라
    if (bird) return toast('Leave the map view first');
    camFront = !camFront;
    const b = document.getElementById('viewBtn'); b.classList.toggle('on', camFront); b.firstChild.textContent = 'View';
  }
  function toggleOrder() {
    if (dead || playerClass !== 'commander') return;
    order = order === 'guard' ? 'follow' : 'guard';
    document.getElementById('ordSub').textContent = `O · ${order === 'follow' ? 'Follow' : 'Guard'}`;
    toast(order === 'follow' ? 'Order: Follow me - soldiers gather at your side' : 'Order: Guard - soldiers return to their duties');
    Snd.play('horn');
  }
  function choosePerk(a, id) {
    perks[a] = id;
    if (id === 'lord') for (const n of npcs) if (n.role !== 'citizen') { const m = npcMaxHp(n.role, n.trait); n.hp += m - n.maxHp; n.maxHp = m; n.labelText = ''; }
    if (id === 'fortifier' || id === 'engineer') for (const o of obstacles) if (o.userData.type === 'fence' && o.userData.level === (id === 'engineer' ? 'stone' : 'wood')) { o.userData.hp *= 1.5; o.userData.maxHp *= 1.5; }
    if (id === 'bastion') for (const o of obstacles) if (o.userData.type === 'fence' && o.userData.level === 'stone') { o.userData.hp *= 1.25; o.userData.maxHp *= 1.25; }
    updateHud(); updateProsperity();
  }
  function openDifficultyChoice() {
    openEvent({ tag: 'New game', title: 'Choose a difficulty', text: 'How hard should the nights be? You can change this later in Settings.',
      opts: Object.entries(CFG.DIFFS).map(([id, d]) => ({ label: d.label + (id === diff ? ' (current)' : ''), sub: d.desc, run: () => { diff = id; try { localStorage.setItem('nf_diff', id); } catch (e) {} setTimeout(openClassChoice, 500); return `Difficulty: ${d.label}`; } })) });
  }
  function openClassChoice() {
    openEvent({ tag: 'Choose your path', title: 'Who will you be?', text: 'Fight on the front line, or lead others from just behind it. This choice lasts the whole game.',
      opts: Object.entries(CFG.CLASSES).map(([id, c]) => ({ label: c.label, sub: c.desc, run: () => { setClass(id); setTimeout(() => openPerk(1), 500); return `You are the ${c.label}`; } })) });
  }
  function openPerk(a) {
    const list = CFG.PERKS[a];
    if (!list || perks[a] || dead) return;
    openEvent({ tag: `Stage ${a} perk`, title: `${CFG.STAGES[a - 1].name}: choose a perk`, text: 'Pick one permanent bonus for this stage.',
      opts: list.map(p => ({ label: p.label, sub: p.desc, run: () => { choosePerk(a, p.id); return `${p.label}: ${p.desc}`; } })) });
  }
  addEventListener('keydown', e => { if (e.code === 'KeyO' && !e.repeat) toggleOrder(); if (e.code === 'KeyB' && !e.shiftKey && !e.repeat) toggleBird(); if (e.code === 'KeyH' && !e.repeat) toggleFront(); if (e.code === 'KeyY' && !e.repeat) toggleMark(); });
  const bindBtn = (id, fn) => document.getElementById(id).addEventListener('pointerdown', e => { e.preventDefault(); fn(); });
  bindBtn('actBtn', gather);
  bindBtn('buildBtn', upgradeFence);
  bindBtn('planBtn', cyclePlan);
  bindBtn('designBtn', designDefense);
  bindBtn('townBtn', designTown);
  bindBtn('smithBtn', openSmith);
  bindBtn('ordBtn', toggleOrder);
  bindBtn('birdBtn', toggleBird);
  bindBtn('viewBtn', toggleFront);
  bindBtn('hallBtn', () => openTech());
  bindBtn('atkBtn', attack);
  bindBtn('dashBtn', dash);
  bindBtn('mountBtn', toggleLeaderMount);
  bindBtn('jumpBtn', jump);
  { const bb = document.getElementById('blockBtn'), off = () => { blockBtn = false; bb.classList.remove('held'); };         // 막기: 누르고 있는 동안
    bb.addEventListener('pointerdown', e => { e.preventDefault(); blockBtn = true; bb.classList.add('held'); });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) bb.addEventListener(ev, off); }
  bindBtn('ultBtn', ultimate);
  bindBtn('swapBtn', swapWeapon);

  // ---------- 낮/밤 순환 ----------
  const DAY_START_MIN = 8 * 60;       // 08:00 시작
  const MIN_PER_SEC = 4.4;            // 현실 1초 = 게임 4.4분 (하루 약 5.5분)
  const clockEl = document.getElementById('clock');
  let gameMin = DAY_START_MIN;
  const C = (h) => new THREE.Color(h);
  const L = {
    sunDay: C(0xff9a4a), sunNight: C(0x3a4a9a),
    ambDay: C(0x6f86d6), ambNight: C(0x1a2450),
    fogDay: C(0x3a2a52), fogNight: C(0x0a0d1c),
    sunBlood: C(0xff4a30), ambBlood: C(0x7a1224), fogBlood: C(0x3a0a10),      // 붉은 달 조명
  };
  const lerp = THREE.MathUtils.lerp;
  // 0 = 낮, 1 = 한밤. 18시부터 서서히 어두워지고 05~07시에 다시 밝아짐
  function nightFactor(h) {
    if (h >= 18 && h < 21) return (h - 18) / 3;
    if (h >= 21 || h < 5) return 1;
    if (h < 7) return 1 - (h - 5) / 2;
    return 0;
  }
  // ---------- 9-3: 계절 (봄 → 여름 → 가을 → 겨울, 각 CFG.SEASON_DAYS일). 농장 수확, 식량 소비, 기분, 질병 확률이 달라지고 땅·나뭇잎 색이 바뀐다 ----------
  const SEASONS = [
    { id: 'spring', name: 'Spring', farm: 1, ration: 1, mood: 2, sick: 0.05, ground: 0x8f7b3f, leaf: 0x58a040, msg: 'Spring has come: the fields wake up' },
    { id: 'summer', name: 'Summer', farm: 1.25, ration: 1, mood: 3, sick: 0.02, ground: 0xa27a40, leaf: 0x3f8a3c, msg: 'Summer has come: long warm days, crops grow 25% better' },
    { id: 'autumn', name: 'Autumn', farm: 1.5, ration: 1, mood: 0, sick: 0.05, ground: 0xa5622f, leaf: 0xc7782a, msg: 'Autumn has come: harvest time, crops yield 50% more' },
    { id: 'winter', name: 'Winter', farm: 0.5, ration: 1.5, mood: -3, sick: 0.12, ground: 0xdde3ec, leaf: 0xcfe0dd, msg: 'Winter has come: crops yield half, citizens eat more, and sickness spreads. Stock food and build wells' },
  ].map(s => ({ ...s, gc: new THREE.Color(s.ground), lc: new THREE.Color(s.leaf) }));
  const NEUTRAL_SEASON = { id: 'none', name: '', farm: 1, ration: 1, mood: 0, sick: 0.03, gc: new THREE.Color(0x9a6b44), lc: new THREE.Color(0x3f8a3c) };
  const seasonOfDay = (day) => CFG.SEASONS_ON ? SEASONS[Math.floor((day - 1) / CFG.SEASON_DAYS) % 4] : NEUTRAL_SEASON;
  const season = () => seasonOfDay(Math.floor(gameMin / 1440) + 1);
  function seasonVisual(k) {
    const s = season();
    ground.material.color.lerp(s.gc, k); leafMat.color.lerp(s.lc, k); tintTrees(); decorMats.bush.color.lerp(s.lc, k); decorMats.tuft.color.lerp(s.lc, k); plotCrop.color.lerp(s.id === 'winter' ? new THREE.Color(0xd8e4e8) : s.id === 'autumn' ? new THREE.Color(0xd2a23a) : new THREE.Color(0x78b04a), k); waterMat.color.lerp(s.id === 'winter' ? iceC : waterC, k);
  }
  function applyLighting(n, b = 0) {           // n: 밤 정도, b: 붉은 달 정도 (습격의 밤에만)
    sun.color.copy(L.sunDay).lerp(L.sunNight, n).lerp(L.sunBlood, b * 0.85);
    sun.intensity = lerp(1.2, 0.3, n) + b * 0.35;
    ambient.color.copy(L.ambDay).lerp(L.ambNight, n).lerp(L.ambBlood, b * 0.8);
    ambient.intensity = lerp(0.6, 0.42, n) + b * 0.12;
    scene.fog.color.copy(L.fogDay).lerp(L.fogNight, n).lerp(L.fogBlood, b * 0.9);
    scene.background.copy(scene.fog.color);
    scene.fog.near = lerp(35, 6, n);
    scene.fog.far = lerp(80, 30, n);
  }

  // ---------- 플레이어 횃불 ----------
  const torch = new THREE.PointLight(0xff8a30, 0, 18, 1.6);   // 밤에만 켜짐 (tick에서 밝기 제어)
  torch.position.set(0, 2.4, 0.3);
  player.add(torch);

  // ---------- 모닥불 (마을 거점) ----------
  let FIRE_R = 0.8;                       // 시대에 따라 모닥불 → 마을 회관 → 성채로 커진다
  const campfire = new THREE.Group();
  const campDecor = new THREE.Group();     // 1시대 모닥불의 장작/돌 (회관으로 바뀌면 숨김)
  campfire.add(campDecor);
  const campM = structMesh('campfire');
  if (campM) campDecor.add(campM);          // 모델: 돌 테두리 + 장작
  else {
  const logMat = mat(0x5a3a1e);
  for (let i = 0; i < 4; i++) {
    const log = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.22, 0.22), logMat);
    log.position.y = 0.2;
    log.rotation.y = i * Math.PI / 4 + 0.2;
    log.rotation.z = 0.15;
    log.castShadow = true;
    campDecor.add(log);
  }
  for (let i = 0; i < 8; i++) {   // 테두리 돌
    const a = i / 8 * Math.PI * 2;
    const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), rockMat);
    st.position.set(Math.cos(a) * 0.85, 0.12, Math.sin(a) * 0.85);
    campDecor.add(st);
  }
  }
  const flame = new THREE.Group();
  const flameOuter = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.1, 6), new THREE.MeshBasicMaterial({ color: 0xff7a1a }));
  const flameInner = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 6), new THREE.MeshBasicMaterial({ color: 0xffd84a }));
  flameOuter.position.y = 0.75; flameInner.position.y = 0.6;
  flame.add(flameOuter, flameInner);
  campfire.add(flame);
  const fireLight = new THREE.PointLight(0xff8c3a, 1.8, 28, 1.4);   // 영구 조명
  fireLight.position.y = 1.4;
  campfire.add(fireLight);
  campfire.userData = { type: 'campfire', radius: FIRE_R };
  scene.add(campfire);
  obstacles.push(campfire);
  let fireAlive = true, fireHp = CFG.FIRE_HP;

  // ---------- 시대 발전: 모닥불 → 나무 마을 회관 → 석조 성채 ----------
  let stage = 1;
  const fireMax = () => CFG.FIRE_HP_BY_STAGE[stage - 1];
  const hallGroup = new THREE.Group();
  campfire.add(hallGroup);
  const hallHint = textSprite('Upgrade Stage: Click / T', '#ffe7a8', 3.2, 0.8, 'bold 40px sans-serif');
  // (안내 글자는 더 이상 붙이지 않는다: 클릭으로는 열리지 않고 T 키·Town Hall 버튼을 쓴다)
  const hallWood = mat(0x8a5a34), hallRoof = mat(0x6b3a22), hallDark = mat(0x2e2218), keepStone = mat(0x8b8e95), keepTower = mat(0x7a7e87), keepTop = mat(0x5c606a);
  function buildHall() {
    while (hallGroup.children.length) hallGroup.remove(hallGroup.children[0]);
    const add = (geo, m, px, py, pz) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.castShadow = o.receiveShadow = true; hallGroup.add(o); return o; };
    campDecor.visible = stage === 1; flame.visible = stage === 1;
    if (stage === 1) { flame.position.y = 0; fireLight.position.y = 1.4; hallHint.position.y = 2.6; }
    else if (stage === 2) {                                              // 나무 마을 회관 (큰 목조 건물)
      townHallModel(add);
      flame.position.y = 7.2; fireLight.position.y = 8.2; hallHint.position.y = 9.4;
    } else {                                                           // 3~5단계: 석조 성채 (04b-models.js)
      keepModel(add, stage);
      flame.position.y = stage >= 4 ? 10.2 : 8.4; fireLight.position.y = stage >= 4 ? 11.4 : 9.6; hallHint.position.y = stage >= 4 ? 13 : 11;
    }
    FIRE_R = CFG.HALL_RADIUS[stage - 1];
    campfire.userData.radius = FIRE_R;
  }
  buildHall();

  const stageEl = document.getElementById('stageN');
  const stageName = (a) => `Stage ${a} · ${CFG.STAGES[a - 1].name}`;
  function updateStageUi() { stageEl.textContent = stageName(stage); }
  function setStage(a) {                       // 시대 적용 (비용 지불 없이): 회관/거주지/시민 외형을 모두 갱신
    stage = a; buildHall(); fireHp = fireMax();
    if (a >= 3) for (const h of obstacles) if (h.userData.type === 'building' && h.userData.kind === 'house' && (h.userData.level || 1) < 2) { h.userData.level = 2; setHouseModel(h); }       // 3시대: 텐트는 모두 나무집으로
    refreshCitizens(); updateStageUi(); updateTownBtn(); updateDesignBtn(); setCamMax();
    npcs.filter(n => n.role !== 'citizen').forEach((n, i) => { n.home = homeSlot(i); });      // 시대가 바뀌면 병사 대기 위치 재배치
  }
  // ----- 시대 발전 패널 -----
  const techEl = document.getElementById('techPanel'), techUpBtn = document.getElementById('techUp');
  function refreshTech() {
    document.getElementById('techTitle').textContent = `${CFG.STAGES[stage - 1].hall} · ${stageName(stage)}`;
    document.getElementById('techCur').textContent = `Unlocked: ${CFG.STAGES.slice(0, stage).map(a => a.unlock).join(' / ')}` + (playerClass ? `\nYou: ${CFG.CLASSES[playerClass].label}` : '') + (Object.keys(perks).length ? `\nPerks: ${Object.entries(perks).map(([a, id]) => CFG.PERKS[a].find(p => p.id === id).label).join(' · ')}` : '');
    const nx = CFG.STAGES[stage];
    if (!nx) { document.getElementById('techNext').textContent = 'Final stage reached. Your town hall has become a mighty keep.'; techUpBtn.disabled = true; techUpBtn.textContent = 'Max Stage'; return; }
    document.getElementById('techNext').textContent = `Next: ${stageName(stage + 1)} (${nx.hall}) - Cost: ${costText(nx.cost)} (You have: ${res.wood} Wood · ${res.stone} Stone · ${res.iron} Iron)\nUnlocks: ${nx.unlock}`;
    const chk = stageChecks(stage + 1), done = chk.filter(c => c.ok).length;
    document.getElementById('techNext').textContent += `\nGoals (${done}/${chk.length}):\n` + chk.map(c => `${c.ok ? '✔' : '○'} ${c.text}`).join('\n');
    techUpBtn.disabled = !canPay(nx.cost) || done < chk.length; techUpBtn.textContent = `Advance to Stage ${stage + 1}`;
  }
  const STAGE_TESTS = {                                                       // 단계 목표: [글, 달성 여부]
    nights1: () => ['Survive night 1', dayNow() >= 2],
    houses3: () => [`3 homes built (${Math.min(3, builtBuildings('house').length)}/3)`, builtBuildings('house').length >= 3],
    cit3: () => [`3 citizens (${Math.min(3, npcs.filter(n => n.role === 'citizen').length)}/3)`, npcs.filter(n => n.role === 'citizen').length >= 3],
    blood1: () => ['Survive the first Blood Moon raid', dayNow() > raidDays[0]],
    barracksRange: () => ['Barracks and Archery Range built', builtBuildings('barracks').length >= 1 && builtBuildings('range').length >= 1],
    stronghold: () => ['Break a realm stronghold', ['banditfort', 'clanhold', 'legionfort', 'hillclan', 'legionkeep'].some(id => story.cleared[id])],
    outerWall: () => ['Second wall finished', outerWallDone()],
    cit14: () => [`Village of 12 people (${Math.min(12, npcs.length)}/12)`, npcs.length >= 12],
    castleTaken: () => ['Take a realm castle', ['legioncastle', 'clancastle', 'banditcastle'].some(id => story.cleared[id])],
    siegeWorkshop: () => ['Siege Workshop built', builtBuildings('siegeshop').length >= 1],
    cit10: () => [`Village of 8 people (${Math.min(8, npcs.length)}/8)`, npcs.length >= 8],
  };
  function stageChecks(target) {                                             // 다음 단계의 조건 목록: { text, ok }
    const g = CFG.STAGE_GATES[target]; if (!g) return [];
    return [{ text: `Day ${g.day} or later (day ${dayNow()})`, ok: dayNow() >= g.day }].concat(g.goals.map(id => { const [text, ok] = STAGE_TESTS[id](); return { text, ok }; }));
  }
  function openTech() { if (dead) return; refreshTech(); techEl.style.display = 'flex'; }
  function closeTech() { techEl.style.display = 'none'; }
  function upgradeStage() {
    const nx = CFG.STAGES[stage];
    if (!nx) return;
    if (!canPay(nx.cost)) return toast(`Need ${costText(nx.cost)}`);
    { const bad = stageChecks(stage + 1).find(c => !c.ok); if (bad) return toast(`Not yet: ${bad.text}`); }
    payCost(nx.cost);
    setStage(stage + 1);
    burst({ x: 0, z: 0 }, 40); shake = Math.max(shake, 0.6);
    updateHud(); refreshTech();
    toast(`Stage advanced! ${stageName(stage)} - ${CFG.STAGES[stage - 1].hall}`);
    setTimeout(() => openPerk(stage), 900);
  }
  document.getElementById('techUp').addEventListener('click', upgradeStage);
  document.getElementById('techClose').addEventListener('click', closeTech);
  addEventListener('keydown', e => {
    if (e.code === 'KeyT' && !e.repeat) { if (techEl.style.display === 'flex') closeTech(); else if (Math.hypot(player.position.x, player.position.z) < 14) openTech(); else toast('Press T near the town hall (campfire)'); }
    if (e.code === 'Escape') { closeTech(); closeSmith(); }
  });
  // 모닥불/회관 클릭(탭)으로 열기: 드래그가 아닌 짧은 클릭만
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  canvas.addEventListener('pointerdown', e => { tapStart = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }; });
  canvas.addEventListener('pointerup', e => {
    if (!tapStart || tapStart.id !== e.pointerId) return;
    const moved = Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y), dur = performance.now() - tapStart.t;
    tapStart = null;
    if (moved > 10 || dur > 450 || e.button !== 0) return;
    { const cr = canvas.getBoundingClientRect(); ndc.set((e.clientX - cr.left) / cr.width * 2 - 1, -((e.clientY - cr.top) / cr.height) * 2 + 1); }
    ray.setFromCamera(ndc, camera);
    if (wbPlacing && exActive) { const gq = new THREE.Vector3(); if (ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), gq)) { placeBands(gq.x, gq.z); return; } }
    const nh = ray.intersectObjects(npcs, true);                          // 주민을 누르면 주민 카드
    if (nh.length) { let o = nh[0].object; while (o && !npcs.includes(o)) o = o.parent; if (o) { openNpcCard(o); return; } }
    const gp = new THREE.Vector3();
    const onGround = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), gp);
    if (nmActive && builtBuildings('market').length && (ray.intersectObjects(builtBuildings('market'), true).length || (onGround && builtBuildings('market').some(m => Math.hypot(gp.x - m.position.x, gp.z - m.position.z) < m.userData.radius + 0.3)))) nightMerchantMenu();
    else if (smiths().length && (ray.intersectObjects(smiths(), true).length || (onGround && smiths().some(m => Math.hypot(gp.x - m.position.x, gp.z - m.position.z) < m.userData.radius + 0.3)))) openSmith();
    else if (e.pointerType === 'mouse' && !dead && !uiPause && !eventOpen) attack();                    // 마우스 클릭만 기본 공격 (터치는 공격 버튼으로: 병사를 잘못 누르지 않게)
  });

  function animateFire(t) {
    if (!fireAlive) return;
    flame.visible = stage === 1;                              // 회관·성채 위에는 불꽃을 보이지 않는다 (불빛만 남는다)
    const f = 1 + Math.sin(t * 9) * 0.12 + Math.sin(t * 23) * 0.06;
    const hpR = Math.max(0.35, fireHp / fireMax());         // 모닥불 체력이 줄면 불꽃도 작아진다
    flame.scale.set((2 - f) * hpR, f * hpR, (2 - f) * hpR);
    fireLight.intensity = 1.8 + (f - 1) * 1.5;
  }

  // ---------- 체력 / 게임오버 ----------
  let hp = CFG.PLAYER_MAX_HP, dead = false, hurtCd = 0, sinceHurt = 99, nowHour = 8;
  const hpEl = document.getElementById('hpN');
  let totalKills = 0;
  const BEST_KEY = 'nf_best';
  function recordBest() {                                              // 난이도별 최고 생존 일수
    const day = Math.floor(gameMin / 1440) + 1; let b = {};
    try { b = JSON.parse(localStorage.getItem(BEST_KEY) || '{}') || {}; } catch (e) { b = {}; }
    const key = diff + (ngLevel ? '+' + ngLevel : ''), prev = b[key] || 0;
    if (day > prev) { b[key] = day; try { localStorage.setItem(BEST_KEY, JSON.stringify(b)); } catch (e) {} }
    return { day, best: Math.max(prev, day), newBest: day > prev, key };
  }
  // ---------- 밸런스 기록: 밤마다 한 줄씩 쌓고, 게임 오버 때 한 판 요약을 저장한다. 설정 > Balance report 에서 복사해 공유할 수 있다 ----------
  function saveRunSummary(cause, rb) {
    let runs = []; try { runs = JSON.parse(localStorage.getItem('nf_runs') || '[]') || []; } catch (e) { runs = []; }
    runs.push({ ts: Date.now(), diff, ng: ngLevel, day: rb.day, lv: pl.lvl, k: totalKills, cls: playerClass, cause, stage, pop: npcs.length });
    try { localStorage.setItem('nf_runs', JSON.stringify(runs.slice(-15))); } catch (e) {}
  }
  function balanceReport() {
    const L = [`Nightfall Settlement balance report`, `Now: ${diff}${ngLevel ? ' NG+' + ngLevel : ''} · Day ${dayNow()} · Lv ${pl.lvl} · class ${playerClass || '-'} · stage ${stage} · pop ${npcs.length} · kills ${totalKills} · power ${Math.round(powerOf().total)}`, '', 'Night log (day, raid?, kills, walls lost, citizens lost, walls fortified, built, pop, prosperity, level, power, wood/stone/iron/food):'];
    for (const s of story.stats || []) L.push(`D${s.d}${s.raid ? ' RAID' : ''}: kills ${s.k}, walls lost ${s.wl}, citizens lost ${s.cl}, fortified ${s.f || 0}, built ${s.b}, pop ${s.pop}, pros ${s.pr}, Lv${s.lv}, power ${s.pw}, ${s.w}/${s.s}/${s.i}/${s.fd}`);
    let runs = []; try { runs = JSON.parse(localStorage.getItem('nf_runs') || '[]') || []; } catch (e) { runs = []; }
    if (runs.length) { L.push('', 'Past runs:'); for (const r of runs.slice().reverse()) L.push(`${new Date(r.ts).toISOString().slice(0, 10)} ${r.diff}${r.ng ? '+' + r.ng : ''}: day ${r.day}, Lv ${r.lv}, kills ${r.k}, ${r.cls || '-'}, stage ${r.stage}, pop ${r.pop} - ${r.cause}`); }
    return L.join('\n');
  }
  function gameOver(sub) {
    if (dead) return;
    dead = true;
    const rb = recordBest(); saveRunSummary(sub, rb);
    document.getElementById('goDays').textContent = `Days survived: ${rb.day} · Level ${pl.lvl} · Foes defeated: ${totalKills} · Best on ${CFG.DIFFS[diff].label}${ngLevel ? ' NG+' + ngLevel : ''}: ${rb.best}${rb.newBest ? ' (new record!)' : ''}`;
    document.getElementById('goCause').textContent = sub;
    document.getElementById('gameover').style.display = 'flex';
    renderRewindButtons();
  }
  document.getElementById('restartBtn').addEventListener('click', () => { clearSave(); location.reload(); });
  const buzz = (p) => { if (settings.haptic !== false && navigator.vibrate) { try { navigator.vibrate(p); } catch (e) {} } };         // 진동 (설정에서 끌 수 있다)
  function damage(n) {
    if (invincibleT > 0 || (exActive && exActive.training)) return;               // 대시 무적 / 훈련장에서는 다치지 않는다
    n = Math.max(1, Math.round(n * dm().dmg * (1 - gearDef(playerGear.armor).reduce) * 0.92 ** pl.st.guard));      // 난이도 + 방어구 + 성장 피해 감소
    if (blocking) { n = Math.max(1, Math.round(n * 0.25)); Snd.play('hit', 0.6); } else if (hp - n > 0) playerAnim.flinch();        // 막는 중에는 피해 75% 감소, 아니면 맞는 동작
    hp = Math.max(0, hp - n);
    sinceHurt = 0;
    hpEl.textContent = Math.ceil(hp); Snd.play('hurt'); buzz(hp <= 0 ? 300 : 30);
    if (hp <= 0) gameOver('You were slain');
  }
  function healPlayer(n) { if (n >= 20 && hp < pMaxHp()) Snd.play('heal', 0.8); hp = Math.min(pMaxHp(), hp + n); hpEl.textContent = Math.ceil(hp); }
  // 회복: 모닥불 곁에서 일정 시간 맞지 않으면 초당 회복, 모닥불은 낮에 서서히 회복
  function updateRegen(dt) {
    if (dead) return;
    sinceHurt += dt;
    if (pl.st.regen > 0 && hp < pMaxHp()) hp = Math.min(pMaxHp(), hp + 0.35 * pl.st.regen * dt);
    if (fireAlive && hp < pMaxHp() && sinceHurt >= CFG.REGEN_DELAY && Math.hypot(player.position.x, player.position.z) < CFG.REGEN_RADIUS) healPlayer(CFG.REGEN_RATE * (hasPerk('scout') ? 1.5 : 1) * dt);
    if (fireAlive && fireHp < fireMax() && nowHour >= 6 && nowHour < 18) fireHp = Math.min(fireMax(), fireHp + CFG.FIRE_REGEN * dt);
  }
  function destroyFire() {
    fireAlive = false;
    flame.visible = false;
    fireLight.intensity = 0;
    gameOver('The settlement was destroyed');
  }

  // ---------- 이펙트: 타격 궤적 / 파편 ----------
  const ATK_RANGE = 3, ATK_HALF = Math.PI / 3, ATK_CD = 0.4, SLASH_LIFE = 0.15;
  const slashGeo = new THREE.CircleGeometry(ATK_RANGE, 20, -Math.PI / 2 - ATK_HALF, ATK_HALF * 2);
  const slashes = [];
  const slashScale = (def) => def.slash || 1;
  function spawnSlash(x, z, ang, def = gearDef(playerGear.sword)) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(slashGeo, new THREE.MeshBasicMaterial({
      color: def.slashColor || 0xffffff, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2;
    g.add(m);
    g.position.set(x, groundY(x, z, 2.2) + 0.08, z);
    g.rotation.y = ang;
    g.scale.setScalar(slashScale(def));
    g.userData.life = SLASH_LIFE;
    scene.add(g);
    slashes.push(g);
  }
  const particles = [];
  const pGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
  const pMat = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
  const PLIFE = 0.7;
  function burst(pos, count = 12) {
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(pGeo, pMat);
      m.position.set(pos.x, 0.8, pos.z);
      m.userData = { v: new THREE.Vector3(rand(-1, 1) * 4, rand(3, 6), rand(-1, 1) * 4), life: PLIFE };
      scene.add(m);
      particles.push(m);
    }
  }
  const dustMat = new THREE.MeshBasicMaterial({ color: 0xc8b090 });
  function dust(x, z) {                       // 건설 완료 먼지 파티클
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(pGeo, dustMat);
      m.position.set(x + rand(-1, 1), 0.2, z + rand(-0.3, 0.3));
      m.userData = { v: new THREE.Vector3(rand(-1, 1) * 2.2, rand(1, 2.6), rand(-1, 1) * 2.2), life: PLIFE };
      scene.add(m);
      particles.push(m);
    }
  }
  function updateFx(dt) {
    for (const s of slashes.slice()) {
      s.userData.life -= dt;
      s.children[0].material.opacity = Math.max(0, s.userData.life / SLASH_LIFE) * 0.6;
      if (s.userData.life <= 0) { scene.remove(s); s.children[0].material.dispose(); slashes.splice(slashes.indexOf(s), 1); }
    }
    for (const p of particles.slice()) {
      const u = p.userData;
      u.v.y -= 14 * dt;
      p.position.addScaledVector(u.v, dt);
      if (p.position.y < 0.1) { p.position.y = 0.1; u.v.y *= -0.3; u.v.x *= 0.6; u.v.z *= 0.6; }
      p.rotation.x += dt * 8; p.rotation.z += dt * 6;
      u.life -= dt;
      p.scale.setScalar(Math.max(u.life / PLIFE, 0.01));
      if (u.life <= 0) { scene.remove(p); particles.splice(particles.indexOf(p), 1); }
    }
  }

  // ---------- 적 (약탈자) ----------
  const enemies = [];
  const enemyWithin = (x, z, r) => { for (const e of enemies) if (!e.userData.sinking && Math.hypot(e.position.x - x, e.position.z - z) < r) return true; return false; };       // 가까운 적이 있나 (전투 자세 이동용)
  const RAIDER_BLADE = { id: 'raider_blade', slot: 'sword', tier: 0, color: 0x6b6b70 };
  const BRUTE_CLUB = { id: 'brute_club', slot: 'sword', tier: 0, color: 0x5a3a1e };
  const enemyMat = mat(0xc4231a), bruteMat = mat(0x5a0d0a);
  const ENEMY_R = 0.45, ENEMY_SPEED = 2.4;
  const AGGRO = 9, DEAGGRO = 13, FIRE_BREAK_TIME = 3;
  let spawnCd = 0;
  // kind: 'normal' | 'brute' | 'shield'. 최대 HP는 날짜에 따라 HP_SCALE_EVERY일마다 +1
  const beastMat = mat(0x8a6a40), bossMat = mat(0x0b0b0e), siegeMat = mat(0x8a3fc0), shieldMat = mat(0xb8c0cc), shieldPlateMat = mat(0x666b73), shieldPlateGeo = new THREE.BoxGeometry(0.95, 1.1, 0.14);
  const archerMat = mat(0xc9731d), healerMat = mat(0x2fbf8f), sapperMat = mat(0xd6b02a);
  function spawnEnemy(kind = 'normal', at = null) {
    const brute = kind === 'brute', shield = kind === 'shield', siege = kind === 'siege', boss = kind === 'boss', beast = kind === 'beast', archer = kind === 'archer', healer = kind === 'healer', sapper = kind === 'sapper';
    const a = rand(0, Math.PI * 2), r = Math.min(MAP - 1, 86);    // 맵 외곽 (안개 속 먼 곳)
    const sc = beast ? 0.75 : boss ? CFG.BOSS_SCALE : brute ? CFG.BRUTE_SCALE : siege ? 1.15 : sapper ? 0.9 : healer ? 1.05 : 1;
    const eMat = beast ? beastMat : boss ? bossMat.clone() : brute ? bruteMat : shield ? shieldMat : siege ? siegeMat : archer ? archerMat : healer ? healerMat : sapper ? sapperMat : enemyMat;
    const rig = beast ? makeRig('beast', 0, { bodyMat: eMat, enemy: true }) : makeRig('enemy', 0, { bodyMat: eMat, enemy: true, scale: 0.88, seed: Math.floor(Math.random() * 1e6) });       // 스틱맨/네발 리그 (몸통 색 = 적 종류)
    rig.combat = true;                                                  // 적은 항상 전투 자세 이동
    if (!beast) rig.style = archer ? 'bow' : healer ? '' : 'ss';        // 적도 같은 팩의 전투 이동·공격·피격·죽음 동작을 쓴다 (궁수는 활 팩, 나머지는 칼·방패 팩)
    if (boss) {                                                                    // 보스: 뿔 + 가시 어깨 + 거대 몽둥이
      const hornM = gearMat('horn', 0xd8d0b8), padM = gearMat('bosspad', 0x2a2a30);
      for (const sx of [-1, 1]) {
        const h = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.38, 6), hornM); h.position.set(sx * 0.16, 0.4, 0); h.rotation.z = -sx * 0.5; rig.head.add(h);
        const pad = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), padM); pad.position.set(sx * 0.37, 0.62, 0); rig.spine.add(pad);
        const spk = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.24, 5), hornM); spk.position.set(sx * 0.4, 0.82, 0); spk.rotation.z = -sx * 0.35; rig.spine.add(spk);
      }
      rig.main = 'sword'; rig.setGear('sword', { id: 'boss_club', slot: 'sword', tier: 1, color: 0x2a2a30 }); rig.meshes.sword.scale.setScalar(1.8); rig.hold('sword');
    }
    if (archer) {                                                                // 궁수: 두건 + 등에 맨 화살통
      if (!rig.skin) { const hood = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.34, 7), gearMat('archerhood', 0x4a3a1e)); hood.position.set(0, 0.34, -0.02); rig.head.add(hood); }
      const quiver = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.5, 7), gearMat('quiver', 0x5a3a1e)); quiver.position.set(0.12, 0.3, -0.26); quiver.rotation.z = 0.25; rig.spine.add(quiver);
      for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 4), gearMat('fletch', 0xe8e0c8)); f.position.set(0.12 + (i - 1) * 0.04, 0.6, -0.26); rig.spine.add(f); }
    }
    if (healer) {                                                                // 치유사: 빛나는 구슬이 달린 지팡이 + 흰 망토
      const staff = new THREE.Group(), pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.5, 6), gearMat('healstaff', 0x6a4a2a)), orb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshBasicMaterial({ color: 0x7affc8 }));
      pole.position.y = 0.45; orb.position.y = 1.25; staff.add(pole, orb); staff.rotation.x = Math.PI / 2 + 0.35; rig.handR.add(staff);
      if (!rig.skin) { const cape = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.7, 0.05), gearMat('healcape', 0xe8f4ec)); cape.position.set(0, 0.35, -0.26); rig.spine.add(cape); }
    }
    if (sapper) {                                                                // 폭파병: 등에 화약통 + 타오르는 도화선
      const keg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.34, 9), gearMat('keg', 0x7a5a2a)), band = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.02, 5, 12), gearMat('kegband', 0x3a3a3a)), fuse = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff7a1a }));
      keg.position.set(0, 0.3, -0.3); band.rotation.x = Math.PI / 2; band.position.set(0, 0.3, -0.3); fuse.position.set(0, 0.55, -0.3); rig.spine.add(keg, band, fuse);
    }
    if (archer) { rig.style = 'bow'; rig.main = 'bow'; rig.setGear('bow', { id: 'raider_bow', slot: 'bow', tier: 0, color: 0x6b4a2a }); rig.hold('bow'); }
    else if (!beast && !siege && !boss) { rig.main = 'sword'; rig.setGear('sword', brute ? BRUTE_CLUB : RAIDER_BLADE); rig.hold('sword'); }
    if (rig.skin) rig.bodyMat.color.set(archer ? 0xffc890 : healer ? 0xb8ffd8 : sapper ? 0xffe08a : boss ? 0x6a6a74 : brute ? 0xd49a8a : shield ? 0xb8c4d8 : 0xffffff);       // 모델 질감에 종류별 색을 곱한다
    const m = new THREE.Group();
    rig.root.position.y = -0.8;                          // 그룹 중심(= 예전 원기둥 중심) 기준으로 발을 바닥에 맞춘다
    m.add(rig.root); m.material = rig.bodyMat;           // 보스 깜빡임/기절 색 변경은 m.material을 사용
    m.scale.setScalar(sc);
    m.position.set(Math.cos(a) * r, 0.8 * sc, Math.sin(a) * r);
    if (at) m.position.set(at.x, 0.8 * sc, at.z);
    if (shield) {                                    // 앞쪽(+Z, 진행 방향)에 방패 판
      const plate = new THREE.Mesh(shieldPlateGeo, shieldPlateMat);
      plate.position.set(0, 0.05, 0.55);
      plate.castShadow = true;
      m.add(plate);
    }
    const hpBonus = Math.floor((Math.max(1, wave.day) - 1) / CFG.HP_SCALE_EVERY) +
      (chapterCleared ? Math.max(0, wave.day - CFG.BOSS_DAY) * CFG.ENDLESS_HP_PER_DAY : 0);      // 무한 모드: 날마다 체력 추가 증가
    const hp = scaleHp((beast ? CFG.BEAST_HP : archer ? CFG.ENEMY_HP * 0.8 : healer ? CFG.ENEMY_HP * 1.3 : sapper ? CFG.ENEMY_HP * 0.6 : (boss ? CFG.BOSS_HP : brute ? CFG.BRUTE_HP : shield ? CFG.SHIELD_HP : siege ? CFG.SIEGE_HP : CFG.ENEMY_HP) + hpBonus));
    m.userData = {
      kind, brute, shield, siege, boss, archer, healer, sapper, shootCd: rand(1.2, 2.4), healCd: rand(1, 2), throwCd: rand(1.5, 3), hp, maxHp: hp,
      dpsKey: boss ? 'boss' : brute ? 'brute' : 'normal', slamCd: 3, slamT: 0, baseY: 0.8 * sc, r: ENEMY_R * sc,
      speed: ENEMY_SPEED * (beast ? 1.35 : boss ? CFG.BOSS_SPEED_MUL : brute ? CFG.BRUTE_SPEED_MUL : shield ? CFG.SHIELD_SPEED_MUL : archer ? 0.9 : healer ? 0.85 : sapper ? 1.55 : 1),
      contact: sapper ? 0 : archer ? 4 : beast ? 6 : boss ? CFG.BOSS_CONTACT_DMG : brute ? CFG.BRUTE_CONTACT_DMG : CFG.ENEMY_CONTACT_DMG,
      kbMul: boss ? CFG.BOSS_KB_MUL : brute ? CFG.BRUTE_KNOCKBACK_MUL : 1, kbT: 0, kbVx: 0, kbVz: 0,
      fireTimer: 0, aggro: false, sinking: false, castT: 0, stunT: 0, lureT: 0, critT: 0, tele: null,
      anim: new Anim(rig), ex: !!at, px: m.position.x, pz: m.position.z, atkAnimCd: rand(0, 0.6) };
    if (boss) {                                       // 보스 머리 위 표시: 어그로 '!' / 기절 텍스트와 빙글 도는 별
      const bang = textSprite('!', '#ff2a1a', 0.5, 0.5, 'bold 96px sans-serif');
      bang.position.set(0, 1.25, 0); bang.visible = false; m.add(bang);
      const stunTxt = textSprite('STUNNED! ★', '#ffe14a', 1.1, 0.28, 'bold 48px sans-serif');
      stunTxt.position.set(0, 1.4, 0); stunTxt.visible = false; m.add(stunTxt);
      const stars = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), new THREE.MeshBasicMaterial({ color: 0xffe14a }));
        const a = i / 3 * Math.PI * 2; st.position.set(Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4); stars.add(st);
      }
      stars.position.y = 1.1; stars.visible = false; m.add(stars);
      Object.assign(m.userData, { bang, stunTxt, stars });
    }
    if (wave.type === 'storm' && !at) m.userData.speed *= 1.12;          // 폭풍우: 적이 조금 더 빠르다
    if (healer) addGlow(m, 0x4dffb0, 1.9, 1.0); if (sapper) addGlow(m, 0xffd23a, 1.5, 0.9);
    scene.add(m);
    enemies.push(m);
  }
  function textSprite(text, color, w, h, font) {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 128;
    const c = cv.getContext('2d');
    c.font = font; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 8; c.strokeStyle = 'rgba(0,0,0,.8)'; c.strokeText(text, 128, 64);
    c.fillStyle = color; c.fillText(text, 128, 64);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false, fog: false }));
    sp.scale.set(w, h, 1); sp.renderOrder = 12;
    return sp;
  }
  function removeEnemy(e) { if (e.userData.tele) scene.remove(e.userData.tele); scene.remove(e); enemies.splice(enemies.indexOf(e), 1); }
  const XP_KIND = { archer: 12, healer: 16, sapper: 10, normal: 8, beast: 6, shield: 12, brute: 20, siege: 15, boss: 150 };
  const LEVEL_UPS = [
    { id: 'hp', label: 'Vigor', desc: '+20 max HP' }, { id: 'dmg', label: 'Might', desc: '+15% damage' }, { id: 'spd', label: 'Swift', desc: '+6% move speed' },
    { id: 'dash', label: 'Quick Step', desc: 'Dash cooldown -12%' }, { id: 'ult', label: 'Focus', desc: 'Ultimate cooldown -12%' }, { id: 'leech', label: 'Bloodthirst', desc: 'Heal 2 HP for every kill you land' },
    { id: 'guard', label: 'Hardened', desc: 'Take 8% less damage' }, { id: 'rally', label: 'Rallying Voice', desc: 'Rally Cry lasts and reaches 20% more', cls: 'commander' },
    { id: 'spear', label: 'Spear Mastery', desc: 'Spear: +20% damage and +8% reach' }, { id: 'fletch', label: 'Fletching', desc: 'Bow: +20% arrow damage' },
    { id: 'cleave', label: 'Great Sword Mastery', desc: 'Great sword: +18% damage and +6% reach' }, { id: 'whirl', label: 'Whirlwind', desc: 'Great sword spin slash: +25% damage and +8% radius' },
    { id: 'stride', label: 'Long Stride', desc: 'Run 8% faster whenever no foe is near' }, { id: 'evade', label: 'Shadow Step', desc: 'Dash goes 15% further and keeps you untouchable a little longer' },
    { id: 'vault', label: 'Rushing Strike', desc: 'After a dash your attacks deal +25% damage for 1.2s' }, { id: 'lunge', label: 'Lunge', desc: 'Spear thrust: +12% damage and +10% reach' },
    { id: 'impale', label: 'Impale', desc: 'Spear thrust: staggers foes 0.25s and widens a little (not bosses)' }, { id: 'standard', label: 'Standard Bearer', desc: 'Your standard reaches 20% further and soldiers near you fight and endure more' },
    { id: 'bannerlord', label: 'Banner Lord', desc: 'Banners: +3% damage and guard, +3 reach for their bonus' }, { id: 'warcommand', label: 'War Command', desc: 'Charging men deal +8% damage; men standing firm take 6% less' },
    { id: 'horsemaster', label: 'Horse Master', desc: 'Mounted men: +8% speed and +25% charge damage' }, { id: 'drillmaster', label: 'Drill Master', desc: 'Training Field drills give +1 extra drill XP' },
    { id: 'regen', label: 'Second Wind', desc: 'Regain health slowly anywhere, even in a fight' }, { id: 'forage', label: 'Forager', desc: 'Gather faster; +1 yield at 3 and 5 stacks' },
  ];
  const hudEl = document.getElementById('hud'), hudBarEl = document.getElementById('hudBar');
  let barT = 0;
  function updateBar(dt) {
    if ((barT -= dt) > 0) return; barT = 0.25;
    const a = `❤ ${Math.ceil(hp)}/${pMaxHp()} · ⭐ Lv ${pl.lvl}${pl.pend > 0 ? ' ▲' : ''} 📊`, b = `🌲${res.wood} 🪨${res.stone} 🔩${res.iron} 🍞${Math.floor(res.food)}`;
    const ea = document.getElementById('barA'), eb = document.getElementById('barB');
    if (ea.textContent !== a) ea.textContent = a; if (eb.textContent !== b) eb.textContent = b;
    hudBarEl.classList.toggle('pick', pl.pend > 0);
  }
  const toggleStats = (on) => { const open = on ?? !hudEl.classList.contains('open'); hudEl.classList.toggle('open', open); if (open) updateHud(); };
  canvas.addEventListener('pointerdown', () => { if (hudEl.classList.contains('open')) toggleStats(false); });
  hudBarEl.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); toggleStats(); });
  hudEl.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); toggleStats(false); });
  addEventListener('keydown', e => { if (e.code === 'KeyI' && !e.repeat) toggleStats(); if (e.code === 'Escape') toggleStats(false); });
  function updateLvlUi() {
    const row = document.getElementById('lvlRow'); if (!row) return;
    document.getElementById('lvlN').textContent = pl.lvl >= PL_MAX ? `${pl.lvl} (max)` : pl.lvl;
    document.getElementById('xpN').textContent = pl.pend > 0 ? '▲ Choose an upgrade' : pl.lvl >= PL_MAX ? '' : `${pl.xp}/${xpNeed(pl.lvl)} XP`;
    row.classList.toggle('pick', pl.pend > 0);
  }
  function giveXp(n, at) {
    if (pl.lvl >= PL_MAX) return;
    pl.xp += n;
    while (pl.lvl < PL_MAX && pl.xp >= xpNeed(pl.lvl)) { pl.xp -= xpNeed(pl.lvl); pl.lvl++; pl.pend++; toast(`Level ${pl.lvl}! Choose an upgrade`); Snd.play('levelup'); buzz([40, 40, 80]); floatText(`Level ${pl.lvl}!`, player.position.x, 3.4, player.position.z); }
    if (pl.lvl >= PL_MAX) pl.xp = 0;
    updateLvlUi();
  }
  // ---------- 영웅 기술 트리: 세 갈래(전사 / 사냥꾼 / 전략가). 레벨업마다 한 칸에 포인트를 넣는다. 깊은 칸은 같은 갈래에 포인트가 쌓여야 열린다 ----------
  const TREE = [
    { id: 'vanguard', name: 'Vanguard', color: '#e0604a', nodes: ['dmg', 'hp', 'guard', 'leech', 'cleave', 'whirl'] },
    { id: 'ranger', name: 'Ranger', color: '#6cc060', nodes: ['spd', 'fletch', 'stride', 'dash', 'evade', 'vault', 'forage'] },
    { id: 'tactician', name: 'Tactician', color: '#5b9bd6', nodes: ['spear', 'lunge', 'ult', 'impale', 'regen', 'standard', 'rally'] },
    { id: 'marshal', name: 'Marshal', color: '#e0b43c', nodes: ['bannerlord', 'warcommand', 'horsemaster', 'drillmaster'] },
  ];
  const branchPts = (b) => b.nodes.reduce((a, id) => a + (pl.st[id] || 0), 0);
  const nodeInfo = (id) => LEVEL_UPS.find(u => u.id === id);
  const treeEl = document.getElementById('treePanel'); let treeSnooze = 0;
  function renderTree() {
    const cols = TREE.map(b => {
      const pts = branchPts(b), nodes = b.nodes.map((id, k) => {
        const u = nodeInfo(id), rank = pl.st[id] || 0, need = [0, 2, 4, 6, 6, 8, 10][k], open = pts >= need, hidden = u.cls && u.cls !== playerClass, can = open && rank < 5 && pl.pend > 0 && !hidden;
        return `<button class="tnode${can ? ' can' : ''}${!open ? ' lock' : ''}${hidden ? ' off' : ''}" data-id="${id}" ${can ? '' : 'disabled'}><b>${u.label}</b><small>${hidden ? 'Commander only' : u.desc}</small><span class="dots">${'●'.repeat(rank)}${'○'.repeat(5 - rank)}</span>${!open ? `<em>needs ${need} points in ${b.name}</em>` : ''}</button>`;
      }).join('<div class="tlink"></div>');
      return `<div class="tcol" style="--bc:${b.color}"><h4>${b.name} <small>${pts} pts</small></h4>${nodes}</div>`;
    }).join('');
    treeEl.querySelector('#treeCols').innerHTML = cols;
    treeEl.querySelector('#treeHead').textContent = pl.pend > 0 ? `Level ${pl.lvl} - spend ${pl.pend} point${pl.pend > 1 ? 's' : ''}` : `Level ${pl.lvl} - no points to spend`;
    treeEl.querySelectorAll('.tnode.can').forEach(b => b.addEventListener('click', () => {
      const u = nodeInfo(b.dataset.id); pl.st[u.id]++; pl.pend--; if (u.id === 'hp') healPlayer(20); updateLvlUi(); Snd.play('chime'); toast(`${u.label}: ${u.desc}`);
      if (pl.pend <= 0) closeTree(); else renderTree();
    }));
  }
  function closeTree(snooze) { treeEl.style.display = 'none'; uiPause = false; if (snooze) treeSnooze = performance.now() + 60000; }
  document.getElementById('treeClose').addEventListener('click', () => closeTree(true));
  function openLevelPick(force) {
    if (dead || eventOpen || (pl.pend <= 0 && !force)) return;
    if (pl.pend > 0 && !TREE.some(b => b.nodes.some(id => (pl.st[id] || 0) < 5 && !(nodeInfo(id).cls && nodeInfo(id).cls !== playerClass)))) { pl.pend = 0; updateLvlUi(); return; }
    renderTree(); treeEl.style.display = 'flex'; uiPause = true; toggleStats(false);
  }
  setInterval(() => {                                   // 안전할 때(주변에 적이 없을 때) 선택창을 자동으로 띄운다
    if (pl.pend <= 0 || eventOpen || dead || !saveReady || uiPause || performance.now() < treeSnooze) return;
    if (enemies.some(e => !e.userData.sinking && Math.hypot(e.position.x - player.position.x, e.position.z - player.position.z) < 28)) return;
    openLevelPick();
  }, 1200);
  document.getElementById('lvlRow').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); toggleStats(false); openLevelPick(true); });

  // ---------- 새 적: 궁수(멀리서 화살) / 치유사(주변 적 회복) / 폭파병(목책으로 달려가 자폭) ----------
  const enemyArrows = [], eArrowGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.8, 5), eArrowMat = new THREE.MeshBasicMaterial({ color: 0xc86a2a });
  function fireEnemyArrow(e, tx, tz) {
    e.userData.anim.once('attackBow');                                      // 화살을 뽑아 걸고 시위를 놓는 순간에 날아간다
    later(e.userData.anim.hitIn ?? 0.3, () => {
      if (e.userData.sinking || !enemies.includes(e)) return;
      const sx = e.position.x, sz = e.position.z, a = Math.atan2(tx - sx, tz - sz), m = new THREE.Mesh(eArrowGeo, eArrowMat);
      const sy = e.position.y + 0.9, td = Math.hypot(tx - sx, tz - sz), vy = sy > 2.5 ? (0.9 - sy) / Math.max(0.3, td / 11) : 0;       // 탑 위 궁수: 화살이 표적 높이로 내려온다
      m.rotation.set(Math.PI / 2 + Math.atan2(-vy, 11), a, 0, 'YXZ'); m.position.set(sx, sy, sz); scene.add(m);
      enemyArrows.push({ m, vx: Math.sin(a) * 11, vz: Math.cos(a) * 11, vy, life: 1.6 }); sfxAt('bow', sx, sz);
    });
  }
  function updateEnemyArrows(dt) {
    for (let i = enemyArrows.length - 1; i >= 0; i--) {
      const a = enemyArrows[i], p = a.m.position; p.x += a.vx * dt; p.z += a.vz * dt; if (a.vy) p.y = Math.max(0.1, p.y + a.vy * dt); a.life -= dt;
      let hit = false;
      if (!dead && invincibleT <= 0 && Math.hypot(player.position.x - p.x, player.position.z - p.z) < 0.75) { damage(CFG.ENEMY_CONTACT_DMG * 0.8); hurtCd = Math.max(hurtCd, 0.3); hit = true; }
      if (!hit) for (const n of npcs) if (!n.down && Math.hypot(n.position.x - p.x, n.position.z - p.z) < 0.7) { if (n.escort) damageEscort(n, CFG.ENEMY_CONTACT_DMG * 0.8); else damageNpc(n, CFG.ENEMY_CONTACT_DMG * 0.8); hit = true; break; }
      if (!hit) for (const o of obstacles) if (o.userData.type === 'fence' && Math.hypot(o.position.x - p.x, o.position.z - p.z) < o.userData.radius) { damageStructure(o, 4); hit = true; break; }
      if (hit || a.life <= 0) { scene.remove(a.m); enemyArrows.splice(i, 1); }
    }
  }
  function archerStep(e, u, dt) {                      // 사거리 안에 표적(플레이어 > 병사 > 모닥불)이 있으면 쏜다
    u.shootCd -= dt; if (u.shootCd > 0 || u.stunT > 0) return;
    let tx = null, tz = null, bd = u.range || 13;
    const pd = Math.hypot(player.position.x - e.position.x, player.position.z - e.position.z);
    if (pd < bd && !dead) { tx = player.position.x; tz = player.position.z; bd = pd; }
    for (const n of npcs) { if (n.down) continue; const d = Math.hypot(n.position.x - e.position.x, n.position.z - e.position.z); if (d < bd - 1.5) { bd = d; tx = n.position.x; tz = n.position.z; } }
    if (tx === null && fireAlive && Math.hypot(e.position.x, e.position.z) < 13) { tx = 0; tz = 0; }
    if (tx === null) return;
    u.shootCd = rand(2.0, 2.8); fireEnemyArrow(e, tx, tz);
  }
  function healerStep(e, u, dt) {
    u.healCd -= dt; if (u.healCd > 0 || u.stunT > 0) return; u.healCd = 2.2;
    let healed = 0;
    for (const o of enemies) { const v = o.userData; if (o === e || v.sinking || v.hp >= v.maxHp || Math.hypot(o.position.x - e.position.x, o.position.z - e.position.z) > 6.5) continue; v.hp = Math.min(v.maxHp, v.hp + v.maxHp * 0.1 + 1); healed++; burst(o.position, 3); }
    if (healed) { floatText('+heal', e.position.x, 2.4, e.position.z); Snd.play('heal', 0.4); }
  }
  function sapperBoom(e, u) {
    const x = e.position.x, z = e.position.z; u.hp = 0;
    burst(e.position, 24); sfxAt('boom', x, z); if (Math.hypot(player.position.x - x, player.position.z - z) < 25) shake = Math.max(shake, 0.35);
    for (const o of obstacles.slice()) if (o.userData.type === 'fence' && Math.hypot(o.position.x - x, o.position.z - z) < 3.4) damageStructure(o, CFG.ROCK_DAMAGE * 1.1);
    if (Math.hypot(player.position.x - x, player.position.z - z) < 3 && invincibleT <= 0) damage(CFG.BRUTE_CONTACT_DMG * 0.7);
    for (const n of npcs) if (!n.down && Math.hypot(n.position.x - x, n.position.z - z) < 3) damageNpc(n, CFG.BRUTE_CONTACT_DMG * 0.7);
    u.kind = 'sapper'; killEnemy(e);
  }
  // ---------- 밤 활동: 새벽까지 쉬기 ----------
  const restBtnEl = document.getElementById('restBtn');
  function canRest() {
    const h = (gameMin / 60) % 24, wd = Math.max(1, h < 5 ? dayNow() - 1 : dayNow());
    if (dead || eventOpen || uiPause || exActive || !(h >= 20 || h < 5) || wave.day !== wd) return false;
    if (wave.remaining > 0 || wave.siegeLeft > 0 || wave.bossLeft > 0) return false;
    return !enemies.some(e => !e.userData.sinking && (!e.userData.prowl || Math.hypot(e.position.x - player.position.x, e.position.z - player.position.z) < 22));
  }
  function toggleRest() {
    if (resting) { resting = false; return toast('You get up'); }
    if (!canRest()) return toast((gameMin / 60) % 24 >= 5 && (gameMin / 60) % 24 < 20 ? 'You can rest at night, once the fighting is over' : 'Enemies are near - you cannot rest');
    resting = true; toast('Resting until dawn... (tap again to get up)');
  }
  bindBtn('restBtn', toggleRest);
  addEventListener('keydown', e => { if (e.code === 'KeyZ' && !e.repeat) toggleRest(); });
  function updateRestUi() {
    if (resting && (!canRest() || ((gameMin / 60) % 24 >= 5.6 && (gameMin / 60) % 24 < 12))) { resting = false; toast('You wake up'); }
    const show = resting || canRest();
    if (restBtnEl.style.display !== (show ? '' : 'none')) restBtnEl.style.display = show ? '' : 'none';
    const lab = resting ? 'Wake' : 'Rest'; if (restBtnEl.firstChild.textContent !== lab) restBtnEl.firstChild.textContent = lab;
  }
  // ---------- 밤사냥: 조용한 밤에는 성벽 밖을 떠도는 '밤 방랑자'가 나온다 (처치하면 경험치 2배 + 전리품, 마을은 공격하지 않는다) ----------
  function spawnProwlers(day) {
    const n = Math.min(12, 3 + Math.floor(day * 0.8));
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), r = rand(40, 80), kind = day >= 4 && Math.random() < 0.3 ? 'normal' : 'beast';
      spawnEnemy(kind, { x: Math.cos(a) * r, z: Math.sin(a) * r });
      const e = enemies[enemies.length - 1]; e.userData.ex = false; e.userData.prowl = true; frostTint(e, 'night'); addGlow(e, 0x8f9cff, 1.5, 1.1);
    }
    setTimeout(() => toast('Night hunt: prowlers roam beyond the walls - double XP and loot, but it is dark out there'), 1500);
  }
  function ambushStep(e, u, dt) {                                          // 도적: 마차가 있으면 마차를, 플레이어가 가까우면 플레이어를 쫓는다
    const c = typeof caravan !== 'undefined' ? caravan : null, pd = Math.hypot(player.position.x - e.position.x, player.position.z - e.position.z);
    let tx, tz, td;
    if (c && (pd > 9 || dead)) { tx = c.g.position.x; tz = c.g.position.z; } else { tx = player.position.x; tz = player.position.z; }
    td = Math.hypot(tx - e.position.x, tz - e.position.z);
    e.lookAt(tx, e.position.y, tz);
    if (u.kbT > 0) { u.kbT -= dt; e.position.x += u.kbVx * dt; e.position.z += u.kbVz * dt; }
    else if (td > 1.1 && !(u.stunT > 0)) { const ts = terrSpd(e.position.x, e.position.z); e.position.x += (tx - e.position.x) / td * u.speed * 1.1 * ts * dt; e.position.z += (tz - e.position.z) / td * u.speed * 1.1 * ts * dt; }
    u.anim.base(td > 1.2 ? 'walk' : 'idle', u.speed); u.atkAnimCd -= dt;
    if (c && Math.hypot(c.g.position.x - e.position.x, c.g.position.z - e.position.z) < 1.6) { c.hp -= 7 * dt; if (u.atkAnimCd <= 0) { u.atkAnimCd = 0.9; u.anim.once('attackSword'); } }
    if (pd < PLAYER_R + u.r + 0.15 && hurtCd <= 0 && !(u.stunT > 0)) { damage(u.contact); hurtCd = 0.8; shake = Math.max(shake, 0.15); }
    if (!c) u.keepDay = false;                                              // 마차가 사라지면 도적도 흩어진다
  }
  // ---------- 떠돌이: 낮에도 밤에도 마을 밖 지도 곳곳을 어슬렁거리는 적. 마을 안으로는 들어오지 않고, 가까이 가면 쫓아온다 ----------
  let roamT = 3;
  function roamerTick(dt) {
    if (dead || exActive || uiPause || eventOpen) return;
    roamT -= dt; if (roamT > 0) return;
    const day = Math.max(1, dayNow()), want = Math.min(12, 3 + Math.floor(day / 2));
    let n = 0; for (const e of enemies) if (e.userData.roam && !e.userData.sinking) n++;
    roamT = n < want / 2 ? 2 : 7; if (n >= want) return;
    for (let k = 0; k < 10; k++) {
      const a = rand(0, Math.PI * 2), r = rand(38, MAP - 8), x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.hypot(x - player.position.x, z - player.position.z) < 24) continue;
      const kind = Math.random() < 0.45 ? 'beast' : day >= 3 && Math.random() < 0.25 ? 'brute' : 'normal';
      spawnEnemy(kind, { x, z }); const e = enemies[enemies.length - 1]; e.userData.ex = false; e.userData.prowl = true; e.userData.roam = true; break;
    }
  }
  function prowlStep(e, u, dt) {
    const pd = Math.hypot(player.position.x - e.position.x, player.position.z - e.position.z);
    u.aggro = u.aggro ? pd < 18 : pd < 11;
    if (u.roam && Math.hypot(player.position.x, player.position.z) < 32) u.aggro = false;       // 떠돌이는 마을 안까지 쫓아오지 않는다
    let moving = false;
    if (u.kbT > 0) { u.kbT -= dt; e.position.x += u.kbVx * dt; e.position.z += u.kbVz * dt; }
    else if (u.aggro && !(u.stunT > 0) && pd > 0.9) { { const ts = terrSpd(e.position.x, e.position.z) * climbMul(e.position.x, e.position.z, player.position.x, player.position.z); e.position.x += (player.position.x - e.position.x) / pd * u.speed * ts * dt; e.position.z += (player.position.z - e.position.z) / pd * u.speed * ts * dt; } e.lookAt(player.position.x, e.position.y, player.position.z); moving = true; }
    else if (!u.aggro) {
      u.wT = (u.wT || 0) - dt;
      if (u.wT <= 0 || !u.wp) { const a = Math.atan2(e.position.z, e.position.x) + rand(-0.9, 0.9), r = u.roam ? rand(38, MAP - 8) : rand(39, 47); u.wp = { x: Math.cos(a) * r, z: Math.sin(a) * r }; u.wT = rand(4, 8); }
      const dx = u.wp.x - e.position.x, dz = u.wp.z - e.position.z, d = Math.hypot(dx, dz);
      if (d > 0.8) { { const ts = terrSpd(e.position.x, e.position.z) * climbMul(e.position.x, e.position.z, e.position.x + dx, e.position.z + dz); e.position.x += dx / d * u.speed * 0.45 * ts * dt; e.position.z += dz / d * u.speed * 0.45 * ts * dt; } e.lookAt(u.wp.x, e.position.y, u.wp.z); moving = true; }
    }
    const rr = Math.hypot(e.position.x, e.position.z); if (rr > MAP - 0.5) { e.position.x *= (MAP - 0.5) / rr; e.position.z *= (MAP - 0.5) / rr; } else if (u.roam && rr < 34) { e.position.x *= 34 / Math.max(rr, 1e-3); e.position.z *= 34 / Math.max(rr, 1e-3); }       // 떠돌이는 성벽 근처까지만
    u.anim.base(moving ? 'walk' : 'idle', u.speed); u.atkAnimCd -= dt;
    if (pd < PLAYER_R + u.r + 0.15) {
      if (hurtCd <= 0 && !(u.stunT > 0)) { damage(u.contact); hurtCd = 0.8; shake = Math.max(shake, 0.15); }
      if (u.atkAnimCd <= 0) { u.atkAnimCd = 0.9; u.anim.once('attackSword'); }
    }
  }
  // ---------- 밤 활동 2: 모닥불 이야기 / 등불 상인 / 밤 손님 ----------
  const TALE_REQ = { any: () => true, exp: () => story.exps >= 1, stage2: () => stage >= 2, winter: () => CFG.SEASONS_ON && season().id === 'winter', beacon: () => story.beacon, dawn: () => story.dawn, crown: () => story.crown, hollow: () => story.hollow, finale: () => story.finale, road: () => story.road, wide: () => story.wide, eclipse: () => story.eclipse };
  const nightDayNo = () => { const h = (gameMin / 60) % 24; return h < 5 ? dayNow() - 1 : dayNow(); };
  let taleT = 0, nmActive = null, nmLantern = null, lastNightEvDay = 0;
  function nextTale() { return CFG.TALES.find(t => !story.tales[t.id] && TALE_REQ[t.req]()); }
  function fireTale() {
    const t = nextTale(); if (!t) return;
    story.taleDay = nightDayNo();
    openEvent({ tag: 'Fireside tale', title: t.title, text: t.text, opts: [
      { label: 'Listen by the fire', sub: '+25 XP · everyone +6 mood', run: () => { story.tales[t.id] = 1; giveXp(25); moodAll(6); return 'The fire crackles. The story stays with you.'; } },
      { label: 'Not tonight', alt: true, run: () => { story.taleDay = 0; return 'Another night, then'; } } ] });
  }
  function nightMerchantMenu() {
    const lots = [
      { label: 'Training manual', sub: 'Costs 15 Food · +60 XP', ok: () => res.food >= 15, run: () => { res.food -= 15; giveXp(60); return 'You study by lantern light'; } },
      { label: 'Whetstones', sub: 'Costs 8 Iron · every soldier gets +4 drills', ok: () => res.iron >= 8 && npcs.some(n => n.role !== 'citizen'), run: () => { res.iron -= 8; npcs.filter(n => n.role !== 'citizen').forEach(n => { n.vxp = (n.vxp || 0) + 4; }); return 'The soldiers sharpen more than their blades'; } },
      { label: 'Moon tonic', sub: 'Costs 6 Food · heals you and cures the sick', ok: () => res.food >= 6, run: () => { res.food -= 6; healPlayer(pMaxHp()); npcs.forEach(n => { n.sick = 0; }); return 'The tonic tastes of mint and silver'; } },
    ];
    if (story.beacon) lots.push({ label: 'Shard pedlar', sub: 'Costs 12 Iron · 1 Shard', ok: () => res.iron >= 12, run: () => { res.iron -= 12; res.shard++; return 'A cold shard changes hands'; } });
    openEvent({ tag: 'Lantern merchant', title: 'A Merchant by Lantern Light', text: 'Wares you will not find in daylight. The lantern burns until dawn - trade as you like.',
      opts: lots.map(l => ({ ...l, run: () => { const m = l.run(); unlockAch('nightmarket'); updateHud(); setTimeout(nightMerchantMenu, 450); return m; } })).concat([{ label: 'Farewell', alt: true, run: () => 'The lantern bobs away' }]) });
  }
  function setNmLantern(on) {
    if (on && !nmLantern) {
      const m = builtBuildings('market')[0]; if (!m) return;
      nmLantern = new THREE.Group();
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd27a })), pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2, 6), woodMat2);
      bulb.position.y = 2.1; pole.position.y = 1; const lt = new THREE.PointLight(0xffb040, 1.6, 14, 1.5); lt.position.y = 2.2; nmLantern.add(pole, bulb, lt);
      nmLantern.position.set(m.position.x + 3.2, 0, m.position.z + 1.6); scene.add(nmLantern);
    } else if (!on && nmLantern) { scene.remove(nmLantern); nmLantern = null; }
  }
  function nightActivities(dt, hour, night) {
    const nd = nightDayNo();
    // 등불 상인: 비습격 밤에 3일마다(3일차부터) 시장에 찾아온다
    if (!nmActive && night && !isRaid(nd) && nd >= 3 && nd % 3 === 2 && builtBuildings('market').length && !exActive && lastNmDay !== nd) { lastNmDay = nd; nmActive = { day: nd, prompted: false }; setNmLantern(true); toast('A lantern merchant has set up at the market - walk over or tap the market'); }
    if (nmActive && (hour >= 6 && hour < 18 || nmActive.day !== nd)) { nmActive = null; setNmLantern(false); }
    if (nmActive && !nmActive.prompted && !eventOpen && !exActive) {
      const m = builtBuildings('market')[0];
      if (m && Math.hypot(m.position.x - player.position.x, m.position.z - player.position.z) < m.userData.radius + 4) { nmActive.prompted = true; nightMerchantMenu(); }
    }
    // 모닥불 이야기: 평화로운 밤에 모닥불 곁에 3초 머물면
    if (peaceful && night && !exActive && !dead && !eventOpen && story.taleDay !== nd && nextTale() && Math.hypot(player.position.x, player.position.z) < FIRE_R + 5) { if ((taleT += dt) >= 3) { taleT = 0; fireTale(); } } else taleT = 0;
    // 밤 손님: 조용한 밤 21시 이후 한 번, 45% 확률
    if (night && hour >= 21 && hour < 24 && !exActive && !eventOpen && !dead && wave.quiet && peaceful && lastNightEvDay !== nd && nd >= 2) {
      lastNightEvDay = nd;
      const pool = NIGHT_EVENTS.filter(e => !e.avail || e.avail());
      if (Math.random() < 0.45 && pool.length) openEvent(pool[Math.floor(Math.random() * pool.length)]);
    }
  }
  const NIGHT_EVENTS = [
    { id: 'knock', tag: 'Night visitor', title: 'A Knock at the Gate', text: 'Someone is knocking, politely, long after dark.', opts: [
      { label: 'Open the gate', sub: 'Usually a traveler who wants to stay... usually', run: () => { if (npcs.length < maxPop() && builtBuildings('house').length && Math.random() < 0.7) { const k = spawnCitizens(1); return k ? 'A traveler joins the village' : 'The traveler thanks you and moves on'; } res.food = Math.max(0, res.food - 10); moodAll(-4); return 'A thief! Ten food gone and everyone is uneasy'; } },
      { label: 'Keep it shut', alt: true, run: () => 'The knocking stops after a while' } ] },
    { id: 'owl', tag: 'Night visitor', title: 'A Wise Owl', text: 'An owl lands on the wall and stares at you with great purpose.', opts: [
      { label: 'Follow its gaze', sub: '+10 XP · learn what the next big raid will be', run: () => { giveXp(10); let d = nightDayNo() + 1; while (!isRaid(d)) d++; return `Day ${d}: ${forecast(d)}`; } },
      { label: 'Shoo it', alt: true, run: () => 'The owl looks offended' } ] },
    { id: 'whispers', tag: 'Night visitor', title: 'Whispers in the Woods', text: 'The trees outside the wall are whispering. Something is out there, and it seems to want company.', opts: [
      { label: 'Go and look', sub: 'Three more prowlers appear (double XP) - plus 6 Iron if you survive', run: () => { for (let i = 0; i < 3; i++) { const a = rand(0, 6.28), r = rand(39, 46); spawnEnemy('beast', { x: Math.cos(a) * r, z: Math.sin(a) * r }); const e = enemies[enemies.length - 1]; e.userData.ex = false; e.userData.prowl = true; frostTint(e, 'night'); addGlow(e, 0x8f9cff, 1.5, 1.1); } res.iron += 6; return 'Shapes move at the edge of the torchlight...'; } },
      { label: 'Close the shutters', alt: true, run: () => 'You wait for the whispering to pass' } ] },
    { id: 'songs', tag: 'Night visitor', title: 'Singing by the Fire', text: 'The villagers have started singing. Badly, but with feeling.', avail: () => citizens().length > 0, opts: [
      { label: 'Join in', sub: 'Costs 8 Food (snacks) · everyone +10 mood', ok: () => res.food >= 8, run: () => { res.food -= 8; moodAll(10); return 'You sing worse than anyone. It is wonderful.'; } },
      { label: 'Listen from the wall', alt: true, run: () => 'It carries far in the quiet' } ] },
    { id: 'hunter', tag: 'Night visitor', title: 'The Wounded Hunter', text: 'A hunter limps in, bleeding from a wolf bite. She offers to teach you what she knows if you patch her up.', opts: [
      { label: 'Treat her wounds', sub: 'Costs 8 Food · a bonus level-up choice', ok: () => res.food >= 8, run: () => { res.food -= 8; pl.pend++; updateLvlUi(); return 'She shows you how to read the dark. (Level-up choice waiting)'; } },
      { label: 'Send her to the healer\'s hut', alt: true, run: () => 'She nods, a little disappointed' } ] },
  ];
  let lastNmDay = 0;
  function killEnemy(e, byPlayer = false) {                      // 즉시 사라지지 않고 쓰러지는 애니메이션을 보여 준 뒤 땅으로 꺼진다
    const u = e.userData; if (exActive && u.ex) exStats.kills++;
    if (exActive && exActive.training && u.ex) { burst(e.position, 10); sfxAt('die', e.position.x, e.position.z); hideTelegraph(e); u.sinking = true; u.dying = 1.0; e.position.y = u.baseY + (u.gy || 0); u.anim.die(); if (u.guardian && exCamp) campBroken(e); return; }       // 훈련장: 경험치·전리품 없음 (공성 연습에서는 우두머리를 쓰러뜨리면 끝)
    for (const o of npcs) if (o.role !== 'citizen' && !o.down && Math.hypot(o.position.x - e.position.x, o.position.z - e.position.z) < 16) fightGain(o, 3, 2);       // teamwork: everyone near the fight shares the credit
    burst(e.position, u.boss ? 60 : 12);
    sfxAt(u.boss ? 'roar' : 'die', e.position.x, e.position.z); report.kills++; totalKills++;
    if (byPlayer) giveXp(((XP_KIND[u.kind] || 8) + (u.guardian ? 50 : 0)) * ((u.prowl && !u.roam) || (u.ex && exActive && exActive.night) ? 2 : u.roam ? 1.3 : 1));
    if (u.guardian && exActive && exActive.night) { pl.pend++; updateLvlUi(); toast('The guardian falls - a bonus upgrade is waiting'); }
    if (u.roam) { if (Math.random() < 0.35) { res.iron++; floatText('Loot: Iron +1', e.position.x, 2.6, e.position.z); updateHud(); } }
    else if (u.prowl) {                                                       // 밤사냥 전리품
      if (Math.random() < 0.55) { res.iron++; floatText('Loot: Iron +1', e.position.x, 2.6, e.position.z); }
      if (Math.random() < 0.45) { res.food += 2; floatText('Loot: Food +2', e.position.x, 3.0, e.position.z); }
      if (story.beacon && Math.random() < 0.1) { res.shard++; floatText('Loot: Shard +1', e.position.x, 3.4, e.position.z); }
      updateHud();
    }
    if (u.champ) { story.champs = (story.champs || 0) + 1; const k = 8 + dayNow(); res.iron += k; res.shard++; giveXp(80); floatText(`Champion down! +${k} Iron, +1 Shard`, e.position.x, 3.2, e.position.z); Snd.play('victory'); updateHud(); }
    if (u.guardian && exActive && exCamp) campBroken(e);
    if (u.guardian && exActive) { makeChest(e.position.x, e.position.z, false); floatText('Guardian down! A chest appears', e.position.x, 3.2, e.position.z); shake = Math.max(shake, 0.5); }
    if (u.ex && Math.random() < 0.35) { res.iron++; updateHud(); floatText('Loot: Iron +1', e.position.x, 2.4, e.position.z); }
    if (wave.type === 'hunt' && Math.random() < 0.5) { res.food++; updateHud(); floatText('Loot: Food +1', e.position.x, 2.4, e.position.z); }
    if (wave.type === 'plunder' && Math.random() < 0.4) { res.iron++; updateHud(); floatText('Loot: Iron +1', e.position.x, 2.4, e.position.z); }
    hideTelegraph(e);
    u.sinking = true; u.dying = 1.0; e.position.y = u.baseY + (u.gy || 0); u.anim.die();
    if (u.bang) u.bang.visible = u.stunTxt.visible = u.stars.visible = false;
    if (u.boss) onBossDefeated();
  }

  // 적에게 피해: 죽으면 true, 살아남으면 작은 파편 + 넉백 (무기 강화 시 더 멀리)
  const KB_TIME = 0.15;
  function hitEnemy(e, dmg, fromX, fromZ, strongKb = false, kbDist = null, byPlayer = false) {
    const u = e.userData;
    if (u.stunT > 0) {                                  // 기절한 보스: 모든 피해 2배 (크리티컬)
      dmg *= CFG.STUN_DMG_MULT;
      if (u.critT <= 0) { u.critT = 0.45; floatText('CRITICAL x2!', e.position.x, e.position.y + 5.2, e.position.z); }
    }
    if (!byPlayer && exActive && exCamp && !exCamp.broken) {                        // 습격지: 지휘관(주인공)이 곁에 없으면 병사만으로는 우두머리를 못 쓰러뜨린다
      const pd = Math.hypot(player.position.x - e.position.x, player.position.z - e.position.z);
      if (u.guardian) dmg *= pd > 16 ? 0.2 : pd > 10 ? 0.6 : 1; else if (pd > 28) dmg *= 0.7;
    }
    if (byPlayer && !exActive) { const hi = player.position.y - (u.gy || 0); if (hi > 0.3) dmg *= 1 + Math.min(0.25, hi * 0.2); }       // 높은 곳에서 내려치면 최대 +25%
    if (byPlayer && u.boss) u.lureT = CFG.BOSS_LURE_TIME;      // 플레이어가 때리면 10초간 플레이어만 쫓는다
    u.hp -= dmg;
    sfxAt('hit', e.position.x, e.position.z);
    if (u.hp <= 0) { if (byPlayer && pl.st.leech) healPlayer(2 * pl.st.leech); killEnemy(e, byPlayer); return true; }
    burst(e.position, 4);
    if (!u.boss && !u.siege && u.kind !== 'beast' && !(u.kbMul > 1.5)) u.anim.flinch();
    const dx = e.position.x - fromX, dz = e.position.z - fromZ, d = Math.hypot(dx, dz) || 1;
    const dist = (kbDist ?? (strongKb ? CFG.KNOCKBACK_UPGRADED : CFG.KNOCKBACK)) * u.kbMul;
    u.kbT = KB_TIME; u.kbVx = dx / d * dist / KB_TIME; u.kbVz = dz / d * dist / KB_TIME;
    return false;
  }

  // 부채꼴 판정(근접): (x,z)에서 ang 방향, 검 데미지만큼 피해 (플레이어·근접 동료 공통). 방패병도 정상 피해를 받는다.
  function sectorHit(x, z, ang, byPlayer = false, def = gearDef(playerGear.sword)) {
    const fx = Math.sin(ang), fz = Math.cos(ang);
    const range = ATK_RANGE * slashScale(def) * (def.rangeMul || 1), half = def.half || ATK_HALF;
    let n = 0;
    for (const e of enemies.slice()) {
      if (e.userData.sinking) continue;
      const dx = e.position.x - x, dz = e.position.z - z;
      const d = Math.hypot(dx, dz);
      if (d > range + e.userData.r) continue;
      if (d < 0.9 || (dx * fx + dz * fz) / d > Math.cos(half)) { hitEnemy(e, def.dmg, x, z, def.tier > 0, null, byPlayer); n++; if (def.stun && !e.userData.boss && enemies.includes(e)) e.userData.stunT = Math.max(e.userData.stunT || 0, def.stun); }
    }
    if (exActive && exCamp && exCamp.gate && !exCamp.gate.broken && gateInReach(x, z, ang, range, half)) gateHit((def.dmg || 1) * (byPlayer ? 0.5 : 0.25), !!def.siege);                   // 성문도 맞는다
    return n;
  }

  // 웨이브: 밤이 시작될 때 그날의 총 마릿수를 정하고 순차적으로 스폰. 브루트는 웨이브 마지막에 등장
  let chapterCleared = false;                // Day 7 보스 처치 후 true → 무한 모드
  const wave = { day: 0, remaining: 0, brutes: 0, siegeLeft: 0, bossLeft: 0 };
  // 밤의 종류 (조용한 밤만 변주): calm / fog(안개: 시야·사거리 감소) / plunder(약탈: 적이 더 많지만 철을 떨어뜨린다). 아침 요약과 상단 안내로 미리 알려 준다
  const NIGHT_PATTERN = ['calm', 'calm', 'fog', 'calm', 'plunder', 'calm', 'storm', 'calm', 'hunt', 'fog', 'calm', 'plunder'];
  const NIGHT_INFO = { calm: ['Calm night', 'Beasts and a few raiders'], fog: ['Foggy night', 'Shorter sight for you and the archers'], plunder: ['Plunder night', 'More raiders, but they drop iron'], storm: ['Thunderstorm', 'Lightning flashes and raiders move faster'], hunt: ['Wolf hunt', 'A fast pack of beasts - they drop food'], raid: ['Blood Moon raid', 'A full assault'] };
  function nightTypeOf(d) {
    if (isRaid(d)) return 'raid';
    let q = 0;
    for (let i = 1; i <= d; i++) if (!isRaid(i)) q++;
    return NIGHT_PATTERN[(q - 1) % NIGHT_PATTERN.length];
  }
  const raidDays = [3];                                                       // 붉은 달 대규모 습격의 밤: 간격이 일정하지 않고 하루 전에 경고가 뜬다
  const isRaid = (d) => { while (raidDays[raidDays.length - 1] < d + 1) raidDays.push(raidDays[raidDays.length - 1] + CFG.RAID_GAPS[(raidDays.length - 1) % CFG.RAID_GAPS.length]); return raidDays.includes(d) || d === CFG.BOSS_DAY; };
  const nextRaidFrom = (d) => { while (!isRaid(d)) d++; return d; };
  let nightEase = false;
  // 습격 예보: 다가오는 큰 습격의 규모를 미리 알려 준다 (startWave와 같은 식으로 어림한 값)
  function forecast(day) {
    const threat = (1 + Math.max(0, prosScore - 40) / 120) * (story.beacon ? 0.85 : 1) * (story.finale ? 0.85 : 1) * (1 - campRelief(day));
    const boss = day === CFG.BOSS_DAY && !chapterCleared;
    let n = Math.ceil((CFG.WAVE_BASE + day * CFG.WAVE_PER_DAY) * threat * dm().n); if (boss) n = Math.ceil(n / 2);
    const brutes = day >= CFG.BRUTE_FROM_DAY ? 1 + Math.floor((day - CFG.BRUTE_FROM_DAY) / 3) : 0, siege = day >= CFG.SIEGE_FROM_DAY ? 1 : 0;
    const rn = realmOfNight(day);
    return `${rn ? realmDef(rn).short + ': ' : ''}about ${n} raiders${brutes ? `, ${brutes} brute${brutes > 1 ? 's' : ''}` : ''}${siege ? ', siege throwers' : ''}${boss ? ', and the Behemoth' : ''}`;
  }
  function defenseSummary() {
    const fences = obstacles.filter(o => o.userData.type === 'fence'), wallPct = fences.length ? Math.round(100 * fences.reduce((a, f) => a + f.userData.hp / f.userData.maxHp, 0) / fences.length) : 0;
    const weak = fences.filter(f => f.userData.hp / f.userData.maxHp < 0.5).length;
    return `Walls ${wallPct}%${weak ? ` (${weak} weak)` : ''} · Soldiers ${npcs.filter(n => n.role !== 'citizen').length} · Towers ${builtBuildings('tower').length}${campRelief(dayNow()) > 0 ? ` · Raids -${Math.round(campRelief(dayNow()) * 100)}%` : ''}`;
  }
  function startWave(day) {
    wave.day = day;
    wave.quiet = !isRaid(day);
    wave.type = nightTypeOf(day); wave.realm = realmOfNight(day);
    const extraRaiders = pendingRaiders; pendingRaiders = 0;
    const ease = nightEase ? 0.75 : 1; nightEase = false;                  // 정찰병의 경고에 대비했다면 오늘 밤 적이 25% 줄어든다               // 아침 이벤트 선택의 대가
    const threat = (1 + Math.max(0, prosScore - 40) / 120) * (story.beacon ? 0.85 : 1) * (story.finale ? 0.85 : 1) * (1 - campRelief(day));                   // 번영한 마을일수록 약탈자가 더 많이 몰려온다 (번영도 70 → +25%)
    if (wave.quiet) {                          // 조용한 밤: 짐승 / 소수의 적만 - 문명 발전에 집중할 시간
      wave.remaining = day <= 2 ? CFG.QUIET_BASE + day : Math.min(CFG.QUIET_MAX, 3 + Math.floor(day / 2));
      if (wave.type === 'calm') wave.remaining = Math.max(1, Math.floor(wave.remaining * 0.5));            // 평범한 밤은 정말 조용하다
      if (wave.type === 'plunder') wave.remaining = Math.ceil(wave.remaining * 1.5) + 1;
      if (wave.type === 'hunt') wave.remaining = Math.ceil(wave.remaining * 1.6) + 1;
      if (wave.type === 'storm') wave.remaining = Math.ceil(wave.remaining * 1.2);
      wave.remaining = Math.ceil(wave.remaining * threat * ease * dm().n) + extraRaiders;
      wave.brutes = 0; wave.siegeLeft = 0; wave.bossLeft = 0; spawnCd = 0;
      spawnProwlers(day);
      return;
    }
    wave.remaining = Math.ceil((CFG.WAVE_BASE + day * CFG.WAVE_PER_DAY) * threat * ease * dm().n) + extraRaiders;
    wave.brutes = day >= CFG.BRUTE_FROM_DAY ? 1 + Math.floor((day - CFG.BRUTE_FROM_DAY) / 3) : 0;
    wave.siegeLeft = day >= CFG.SIEGE_FROM_DAY ? 1 + (Math.random() < 0.5 ? 1 : 0) : 0;      // Day 4부터 밤마다 공성 투척병 1~2마리
    if (day === CFG.BOSS_DAY) { wave.remaining = Math.ceil(wave.remaining / 2); wave.bossLeft = 1; }     // 보스 밤: 일반 적 절반 + 베헤모스 1마리
    if (chapterCleared && day > CFG.BOSS_DAY) wave.remaining += (day - CFG.BOSS_DAY) * CFG.ENDLESS_EXTRA_PER_DAY;   // 무한 모드 물량 증가
    wave.champ = 0;
    if (chapterCleared && day > CFG.BOSS_DAY) { story.raidN = (story.raidN || 0) + 1; if (story.raidN % 2 === 0) { wave.champ = 1; } }       // 무한 모드: 두 번째 큰 습격마다 이름 있는 챔피언이 온다
    spawnCd = 0;
  }
  function spawnChampion() {
    const ch = CFG.CHAMPIONS[(story.champs || 0) % CFG.CHAMPIONS.length], before = enemies.length;
    spawnEnemy('brute'); if (enemies.length === before) return;
    const e = enemies[enemies.length - 1], u = e.userData, s = ch.scale;
    u.hp *= ch.hpMul; u.maxHp = u.hp; u.champ = true; u.contact *= 1.25; u.r *= s; u.baseY *= s; e.scale.multiplyScalar(s); e.position.y = u.baseY;
    frostTint(e, ch.faction); addGlow(e, FOE_GLOW[ch.faction] || 0xff6a4a, 3.2, 1.4);
    const lbl = textSprite(ch.name, '#ff9a5a', 1.5, 0.5, 'bold 56px sans-serif'); lbl.position.set(0, 2.5, 0); e.add(lbl);
    showWarning(`Champion: the ${ch.name} has come!`);
  }
  // 날짜가 지날수록 특수 적이 섞인다: 폭파병(4일~) / 궁수(5일~) / 치유사(6일~). 한 번에 살아 있는 수를 제한한다
  function specialKind(day) {
    const alive = (k) => enemies.filter(x => x.userData.kind === k && !x.userData.sinking).length, r = Math.random(), f = Math.min(1.6, 1 + (day - 4) * 0.08);
    if (day >= 4 && alive('sapper') < 2 + Math.floor(day / 8) && r < 0.09 * f) return 'sapper';
    if (day >= 5 && alive('archer') < 2 + Math.floor(day / 6) && r < 0.2 * f) return 'archer';
    if (day >= 6 && alive('healer') < 1 + Math.floor(day / 10) && r < 0.28 * f) return 'healer';
    return 'normal';
  }
  // 성벽의 약한 곳: 체력 비율이 낮고(목책은 돌보다 약하게 친다) 가까운 구간. 멀쩡한 성벽(80%↑)은 표적이 되지 않는다
  function weakestWall(e) {
    let best = null, bs = 0.8;
    for (const o of obstacles) { if (o.userData.type !== 'fence') continue; const d = Math.hypot(o.position.x - e.position.x, o.position.z - e.position.z); if (d > 28) continue; const sc = (o.userData.hp / o.userData.maxHp) * (o.userData.level === 'wood' ? 0.9 : 1) + d / 140; if (sc < bs) { bs = sc; best = o; } }
    return best;
  }
  function updateEnemies(dt, night, waveDay) {
    if (night && wave.day !== waveDay) startWave(waveDay);
    const nh = nowHour < 5 ? nowHour + 24 : nowHour;
    if (night && !dead && wave.bossLeft > 0 && nh >= CFG.BOSS_SPAWN_HOUR) {      // 보스는 밤이 시작되고 잠시 뒤 등장 (준비 시간)
      spawnEnemy('boss'); wave.bossLeft = 0;
      showWarning('The Behemoth has appeared!'); shake = Math.max(shake, 0.8);
    }
    if (night && !dead && wave.champ > 0 && nh >= CFG.BOSS_SPAWN_HOUR) { wave.champ = 0; spawnChampion(); }
    if (night && !dead && (wave.remaining > 0 || wave.siegeLeft > 0)) {
      spawnCd -= dt;
      if (spawnCd <= 0 && enemies.length < CFG.MAX_ALIVE) {
        if (wave.siegeLeft > 0 && (wave.remaining === 0 || Math.random() < 0.25)) {
          spawnEnemy('siege'); wave.siegeLeft--;
        } else {
          const kind = wave.quiet ? (wave.type === 'hunt' ? 'beast' : wave.type === 'plunder' ? 'normal' : waveDay <= 2 || Math.random() < 0.6 ? 'beast' : 'normal')
            : wave.remaining <= wave.brutes ? 'brute'
            : (wave.realm === 'clan' && Math.random() < 0.3 && enemies.filter(x => x.userData.kind === 'archer' && !x.userData.sinking).length < 6 ? 'archer' : waveDay >= CFG.SHIELD_FROM_DAY && Math.random() < CFG.SHIELD_CHANCE * (wave.realm === 'legion' ? 1.8 : 1) ? 'shield' : specialKind(waveDay));
          spawnEnemy(kind);
          wave.remaining--;
        }
        spawnCd = rand(0.8, 1.2) * Math.max(CFG.MIN_SPAWN_INTERVAL, CFG.SPAWN_INTERVAL_BASE / (1 + CFG.SPAWN_RATE_GROWTH * (waveDay - 1)));
      }
    }
    if (exActive && exCamp && (exCamp.ram || exCamp.oil || exCamp.cat)) castleTick(dt);
    if (exActive && exActive.training) trainTick(dt);
    for (const e of enemies.slice()) {
      const u = e.userData, er = u.r;
      u.anim.update(dt);
      if (!night && !u.sinking && !u.boss && !u.ex && !u.roam && !(u.keepDay && caravan)) u.sinking = true;          // 아침: 땅으로 꺼짐 (보스는 처치할 때까지 남는다)
      if (u.sinking) {
        if (u.dying > 0) { u.dying -= dt; continue; }
        e.position.y -= dt * 0.8;
        if (e.position.y < -1.0) removeEnemy(e);
        continue;
      }
      if (dead) continue;
      if (u.ex) { exEnemyStep(e, u, dt); continue; }                    // 원정 지역의 적은 별도 AI
      if (u.amb) { ambushStep(e, u, dt); continue; }                  // 마차를 노리는 도적
      if (u.prowl) { prowlStep(e, u, dt); continue; }                   // 밤사냥 방랑자: 떠돌다가 플레이어를 보면 쫓는다

      // 기본 목표는 모닥불, 플레이어가 인식 거리 안이면 플레이어를 추적 (Aggro)
      const pd = Math.hypot(player.position.x - e.position.x, player.position.z - e.position.z);
      u.aggro = u.siege ? false : (u.boss && u.lureT > 0) ? true : (u.aggro ? pd < DEAGGRO : pd < AGGRO);      // 보스는 맞은 뒤 10초간 플레이어 고정      // 공성 투척병은 플레이어를 쫓지 않는다
      let tx = u.aggro ? player.position.x : 0, tz = u.aggro ? player.position.z : 0;
      if (u.sapper && !u.aggro) { let bd = 1e9; for (const o of obstacles) { if (o.userData.type !== 'fence') continue; const q = (o.position.x - e.position.x) ** 2 + (o.position.z - e.position.z) ** 2; if (q < bd) { bd = q; tx = o.position.x; tz = o.position.z; } } }       // 폭파병은 가장 가까운 목책으로
      else if (!u.aggro && !u.siege && !u.boss && !u.archer && !u.healer) {                      // 약한 곳 노리기: 근처에 크게 다친 성벽이 있으면 그쪽으로 몰려간다
        if ((u.wallT = (u.wallT || 0) - dt) <= 0) { u.wallT = 1.5; u.wallGoal = weakestWall(e); }
        if (u.wallGoal && obstacles.includes(u.wallGoal)) { tx = u.wallGoal.position.x; tz = u.wallGoal.position.z; }
      }
      if (u.archer) archerStep(e, u, dt); if (u.healer) healerStep(e, u, dt);
      e.lookAt(tx, e.position.y, tz);
      const dx = tx - e.position.x, dz = tz - e.position.z;
      const d = Math.hypot(dx, dz);
      let blocked = null;
      if (u.kbT > 0) {                       // 넉백 중에는 밀려남
        u.kbT -= dt;
        e.position.x += u.kbVx * dt; e.position.z += u.kbVz * dt;
      } else if (d > 0.8 && !(u.slamT > 0) && !(u.castT > 0) && !(u.stunT > 0) && !(u.siege && Math.hypot(e.position.x, e.position.z) <= CFG.SIEGE_STANDOFF) && !(u.archer && d < 9.5)) {   // 투척병은 안전거리에서 멈춘다
        e.position.x += dx / d * u.speed * dt;
        e.position.z += dz / d * u.speed * dt;
      }
      // 장애물 충돌: 목책이면 멈추고 공격, 나머지는 비켜 감
      for (const o of obstacles) {
        const ox = e.position.x - o.position.x, oz = e.position.z - o.position.z;
        const min = o.userData.radius + er, od = Math.hypot(ox, oz);
        if (od < min && od > 1e-4) {
          e.position.x = o.position.x + ox / od * min;
          e.position.z = o.position.z + oz / od * min;
          if (o.userData.type === 'fence') blocked = o;
        }
      }
      if (u.sapper && (blocked || pd < 1.3)) { sapperBoom(e, u); continue; }
      if (blocked) {
        e.position.x += (Math.random() - .5) * 0.02;
        if (!(u.stunT > 0)) blocked.userData.hp -= CFG.STRUCT_DPS[u.dpsKey][blocked.userData.level === 'stone' ? 'stone' : 'wood'] * dt * dm().dmg;   // 구조물 체력 감소
        if (blocked.userData.hp <= 0) collapseStructure(blocked);     // 파괴 시 청사진으로 되돌아간다
      }

      const mvd = Math.hypot(e.position.x - u.px, e.position.z - u.pz) / Math.max(dt, 1e-4);      // 이동 속도에 맞춰 걷기/대기, 장애물·플레이어 앞에서는 공격 모션
      u.px = e.position.x; u.pz = e.position.z; u.atkAnimCd -= dt;
      u.anim.base(u.kbT > 0 || mvd < 0.3 ? 'idle' : mvd > 4.6 ? 'run' : 'walk', mvd);
      if ((blocked || pd < PLAYER_R + er + 0.8) && u.atkAnimCd <= 0 && !(u.stunT > 0) && !u.siege) { u.atkAnimCd = 0.9; u.anim.once('attackSword'); }
      // 베헤모스 지진 강타: 캐스팅(1.5초, 붉게 깜빡 + 예고 링) → 점프 → 내려찍기. 캐스팅 중 궁극기에 맞으면 취소되고 기절
      if (u.boss) {
        u.slamCd -= dt; u.lureT -= dt; u.critT -= dt;
        u.bang.visible = u.lureT > 0 && !(u.stunT > 0);
        u.stunTxt.visible = u.stars.visible = u.stunT > 0;
        u.stars.rotation.y += dt * 5;
        if (u.stunT > 0) {
          u.stunT -= dt;
          if (u.stunT <= 0) bossRecover(e);
        } else if (u.slamT > 0) {
          u.slamT -= dt;
          e.position.y = u.baseY + (u.gy || 0) + Math.sin((1 - Math.max(u.slamT, 0) / CFG.BOSS_JUMP_TIME) * Math.PI) * 1.8;
          if (u.slamT <= 0) { e.position.y = u.baseY + (u.gy || 0); spawnShockwave(e.position.x, e.position.z); }
        } else if (u.castT > 0) {
          u.castT -= dt;
          const pulse = 0.5 + 0.5 * Math.sin(u.castT * 24);
          if (e.material.emissive) { e.material.emissive.setHex(0xff2000); e.material.emissiveIntensity = 0.25 + 0.75 * pulse; }
          if (u.tele) u.tele.children.forEach(c => c.material.opacity = 0.15 + 0.25 * pulse);
          u.tele && u.tele.position.set(e.position.x, groundY(e.position.x, e.position.z, 2) + 0.1, e.position.z);
          if (u.castT <= 0) { hideTelegraph(e); u.slamT = CFG.BOSS_JUMP_TIME; }
        } else if (u.slamCd <= 0) { u.castT = CFG.BOSS_CAST_TIME; u.slamCd = CFG.BOSS_SLAM_INTERVAL; showTelegraph(e); }
      }

      // 공성 투척병: 안전거리에 도착하면 일정 간격으로 폭발 바위를 던진다
      if (u.siege && Math.hypot(e.position.x, e.position.z) <= CFG.SIEGE_STANDOFF + 1) {
        u.throwCd -= dt;
        if (u.throwCd <= 0) { u.throwCd = CFG.SIEGE_INTERVAL; throwRock(e); }
      }

      // 모닥불 공격: 도달 후 3초 유지되면 모닥불 소멸 → 패배
      if (fireAlive && Math.hypot(e.position.x, e.position.z) < FIRE_R + er + 0.3) {
        if (u.boss) {                                             // 보스: 즉사 대신 초당 피해, 오래 붙어 있으면 밀려난다
          if (!(u.stunT > 0)) {
            fireHp -= CFG.BOSS_FIRE_DPS * dt * dm().dmg; u.fireTimer += dt;
            if (fireHp <= 0) destroyFire();
            else if (u.fireTimer >= CFG.BOSS_FIRE_BUMP_TIME) {
              u.fireTimer = 0;
              const l = Math.hypot(e.position.x, e.position.z) || 1, kd = CFG.BOSS_FIRE_BUMP_DIST / (KB_TIME * 2);
              u.kbT = KB_TIME * 2; u.kbVx = e.position.x / l * kd; u.kbVz = e.position.z / l * kd;
              shake = Math.max(shake, 0.4);
            }
          }
        } else {
          u.fireTimer += dt;
          if (u.fireTimer >= FIRE_BREAK_TIME) destroyFire();
        }
      } else u.fireTimer = 0;

      // 플레이어 / 동료와 접촉 시 피해
      if (pd < PLAYER_R + er + 0.15 && hurtCd <= 0 && !(u.stunT > 0)) { damage(u.contact); hurtCd = 0.8; shake = Math.max(shake, 0.15); }
      for (const n of npcs.slice()) {
        if (!n.down && n.hurtCd <= 0 && !(u.stunT > 0) && Math.hypot(n.position.x - e.position.x, n.position.z - e.position.z) < PLAYER_R + er) {
          damageNpc(n, u.contact); n.hurtCd = 0.8;
        }
      }
    }
    updateEnemyArrows(dt);
    hurtCd -= dt;
    for (const n of npcs) n.hurtCd -= dt;
  }

  // ---------- 동료 NPC / 시민 ----------
  // 각 NPC는 자기 상태(task, hp, 라벨 등)를 가진 Group. updateNpcs()가 순서대로 `npc`(현재 처리 중인 NPC)를 바꿔가며 AI를 돌린다.
  // role: 'melee'(파랑 근접 병사) | 'archer'(초록 궁수) | 'citizen'(노랑 시민)
  const NPC_COUNT = 3, NPC_HOME_RADIUS = 3.4;
  const ROLE = {
    melee: { color: 0x3a6fe0, hp: 50, name: '' },
    archer: { color: 0x3fae4a, hp: 50, name: 'Archer ' },
    citizen: { color: 0xf2c230, hp: CFG.CITIZEN_HP, name: 'Citizen ' },
  };
  const npcs = [];
  // 굶주림 말풍선 (모든 시민이 공유하는 텍스처)
  const hungerMat = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const c = cv.getContext('2d');
    c.fillStyle = '#fff'; c.strokeStyle = '#3a2a22'; c.lineWidth = 5;
    c.beginPath(); c.moveTo(34, 112); c.lineTo(46, 92); c.lineTo(90, 92); c.quadraticCurveTo(116, 92, 116, 66); c.lineTo(116, 36);
    c.quadraticCurveTo(116, 12, 90, 12); c.lineTo(40, 12); c.quadraticCurveTo(12, 12, 12, 38); c.lineTo(12, 66); c.quadraticCurveTo(12, 92, 40, 92); c.lineTo(34, 92); c.closePath(); c.fill(); c.stroke();
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '44px sans-serif'; c.fillStyle = '#000'; c.fillText('🍽️', 64, 38);
    c.font = 'bold 20px sans-serif'; c.fillStyle = '#c0392b'; c.fillText('Grrr…', 64, 74);
    return new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false, fog: false });
  })();
  const sickMat = (() => {                         // 아픈 시민 머리 위 말풍선
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d');
    c.fillStyle = '#e6f5d8'; c.strokeStyle = '#2d4a2a'; c.lineWidth = 5; c.beginPath(); c.arc(64, 60, 46, 0, 7); c.fill(); c.stroke();
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '56px sans-serif'; c.fillStyle = '#000'; c.fillText('🤒', 64, 60);
    return new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false, fog: false });
  })();
  function applyGear(n) {                         // 역할과 보유 장비에 맞춰 손에 쥔 무기 메쉬를 바꾼다
    syncClassRole(n); dropMountIfNeeded(n);
    if (n.rig.setModel) { const k = modelKeyFor(n.role, n.rig.seed || 0, false); if (k !== n.rig.model) n.rig.setModel(k); n.baseColor = 0xffffff; n.mat.color.set(0xffffff); }       // 직업이 바뀌면 모델도 바뀐다 (시민 → 병사)
    const cls = n.role === 'melee' ? (n.cls || 'sword') : null;
    n.rig.brawl = n.role === 'citizen';
    n.rig.style = cls === 'sword' ? 'ss' : cls === 'greatsword' ? 'gs' : n.role === 'archer' ? 'bow' : '';
    n.rig.main = cls === 'spear' ? 'spear' : cls === 'medic' ? 'staff' : n.role === 'melee' ? 'sword' : n.role === 'archer' ? 'bow' : null;
    n.rig.setGear('sword', n.role === 'melee' ? (cls === 'greatsword' ? { ...soldierWeaponDef(n), slot: 'sword', great: true } : { ...soldierWeaponDef(n), slot: 'sword' }) : null);
    { const sd = soldierWeaponDef(n); n.rig.setGear('spear', cls === 'spear' ? { id: 'spear_' + sd.id, slot: 'spear', tier: sd.tier, color: sd.color } : null); }
    n.rig.setGear('staff', cls === 'medic' ? {} : null);
    n.rig.setGear('bow', n.role === 'archer' ? gearDef(n.gear.bow) : null);
    n.rig.setArmor(n.role === 'citizen' ? null : gearDef(n.gear.armor));
    n.rig.hold(n.rig.main);
  }
  const homeSlot = (k) => { const a = Math.PI / 4 + k * 0.85, r = Math.max(NPC_HOME_RADIUS, FIRE_R + 2.8) + (k % 3) * 1.0; return { x: Math.cos(a) * r, z: Math.sin(a) * r }; };      // 회관이 커지면 병사 대기 위치도 바깥으로
  function makeNpc(role, home, born = 'initial', delay = 0, preset = {}) {
    const n = new THREE.Group();
    const def = ROLE[role];
    const used = new Set(npcs.map(x => x.name)), free = CFG.NAMES.filter(x => !used.has(x));
    const nm = preset.name || (free.length ? free : CFG.NAMES)[Math.floor(Math.random() * (free.length || CFG.NAMES.length))];
    const tr = preset.trait || Object.keys(CFG.TRAITS)[Math.floor(Math.random() * Object.keys(CFG.TRAITS).length)];
    const color = role === 'citizen' ? citizenColor() : def.color;
    const rig = makeRig(role, color, { seed: [...nm].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7) });                  // 스틱맨 리그 + AnimationMixer
    const anim = new Anim(rig), m = rig.bodyMat, body = rig.root;
    n.add(body);
    n.position.set(home.x, 0, home.z);

    // 머리 위 상태 라벨 (NPC마다 별도 캔버스)
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 96;
    const tex = new THREE.CanvasTexture(cv);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, fog: false }));
    label.scale.set(2.6, 0.98, 1);
    label.position.y = 2.7;
    n.add(label);
    const hungerIcon = new THREE.Sprite(hungerMat);            // 굶주림(꼬르륵) 말풍선
    hungerIcon.scale.set(0.95, 0.95, 1); hungerIcon.position.y = 3.4; hungerIcon.visible = false;
    n.add(hungerIcon);
    const sickIcon = new THREE.Sprite(sickMat);                 // 질병 말풍선
    sickIcon.scale.set(0.8, 0.8, 1); sickIcon.position.y = 3.4; sickIcon.visible = false;
    n.add(sickIcon);

    Object.assign(n, { labelSprite: label, home, role, born, archer: role === 'archer', baseColor: color, name: nm, trait: tr, mood: preset.mood ?? 60, shock: 0, stateNow: 'Idle', maxHp: npcMaxHp(role, tr), mat: m, body, rig, anim, hungerIcon, sickIcon, sick: preset.sick || 0, gear: { sword: 'sword_basic', bow: 'bow_basic', armor: 'armor_none' }, carryGear: null, hungry: false, px: home.x, pz: home.z, lctx: cv.getContext('2d'), labelTex: tex,
      hp: npcMaxHp(role, tr), down: false, target: null, gatherT: 0, atkCd: 0, hurtCd: 0, returning: false, face: 0, labelText: '',
      task: null, workT: 0, short: null, pickCd: delay, wp: null, route: null, routeRing: 0, graceT: 0, graceRing: 0,
      promote: null, hidden: false, decor: null, work: null, wstate: 'seek', carry: 0, farmT: 0, wtarget: null, stateLabel: '', bobAmt: 0 });
    n.xp = preset.xp ? { ...preset.xp } : {}; n.pref = preset.pref || null;
    applyCitizenLook(n); applyGear(n);
    scene.add(n);
    npcs.push(n);
    assignWarband(n);
    return n;
  }
  for (let i = 0; i < NPC_COUNT; i++) {
    const ang = Math.PI / 4 + i * Math.PI * 2 / NPC_COUNT;       // 모닥불 둘레에 균등 배치
    makeNpc(i >= NPC_COUNT - CFG.ARCHER_COUNT ? 'archer' : 'melee', { x: Math.cos(ang) * NPC_HOME_RADIUS, z: Math.sin(ang) * NPC_HOME_RADIUS }, 'initial', i * 0.1);
  }
  let npc = npcs[0];                       // 현재 처리 중인 NPC

  function setLabel(state) {                  // 머리 위에는 하는 일 대신 작은 체력 막대만 보여 준다
    const hpv = Math.max(0, Math.ceil(npc.hp)), text = `${hpv}|${npc.maxHp}|${npc.warband}`;
    if (npc.labelText === text) return;
    npc.labelText = text;
    const lctx = npc.lctx, r = Math.max(0, Math.min(1, npc.hp / (npc.maxHp || 1)));
    lctx.clearRect(0, 0, 256, 96);
    if (isSoldier(npc)) { lctx.fillStyle = warbandColor(npc.warband); lctx.fillRect(44, 34, 168, 26); }          // 전투단 색 테두리
    lctx.fillStyle = 'rgba(10,10,30,.8)'; lctx.fillRect(48, 38, 160, 18);
    lctx.fillStyle = r > 0.5 ? '#5fd35f' : r > 0.25 ? '#e8c43c' : '#e0523c'; lctx.fillRect(51, 41, 154 * r, 12);
    npc.labelTex.needsUpdate = true;
  }

  const TR = (n) => CFG.TRAITS[n.trait] || {};
  const workMul = (n) => (n.hungry ? CFG.HUNGER_MULT : 1) * (n.sick > 0 ? 0.6 : 1) * (TR(n).work || 1) * (n.mood >= CFG.MOOD_HAPPY ? 1.1 : n.mood < CFG.MOOD_UNHAPPY ? 0.8 : 1) * (n.foreman ? 1.25 : npcs.some(f => f.foreman && !f.down) ? 1.12 : 1);
  const moveMul = (n) => soldierSpd(n) * (n.hungry ? CFG.HUNGER_MULT : 1) * (n.sick > 0 ? 0.75 : 1) * (TR(n).move || 1) * (n.mood < CFG.MOOD_UNHAPPY ? 0.9 : 1) * (n.mounted ? CFG.CAV.SPEED * (1 + 0.08 * pl.st.horsemaster) : 1);
  const rationOf = (n) => Math.ceil(CFG.RATION * (TR(n).ration || 1) * season().ration);
  const moodLabel = (v) => v < CFG.MOOD_LEAVE ? 'Miserable' : v < CFG.MOOD_UNHAPPY ? 'Unhappy' : v < 60 ? 'Content' : v < CFG.MOOD_HAPPY ? 'Happy' : 'Joyful';
  const grieve = () => { for (const x of npcs) x.shock = Math.min(25, (x.shock || 0) + 10); };         // 동료가 쓰러지면 모두 마음이 가라앉는다
  // 기분: 먹었는지, 집·우물·시장, 번영도, 휴식, 슬픔(충격), 성격에 따라 목표값이 정해지고 천천히 따라간다
  function updateMood(n, dt) {
    n.shock = Math.max(0, (n.shock || 0) - dt * 1.2);
    n.moodT = (n.moodT || 0) + dt;
    if (n.moodT < 1) return;
    const k = n.moodT; n.moodT = 0;
    const aura = Math.min(6, npcs.reduce((a, x) => a + (x !== n ? (TR(x).aura || 0) : 0), 0));
    let target = 50 + (TR(n).mood || 0) + aura + (n.hungry ? -30 : 8) + (builtBuildings('well').length ? 4 + 2 * (bLevel('well') - 1) : 0) + (builtBuildings('market').length ? 4 : 0)
      + Math.max(-10, Math.min(15, (prosScore - 40) / 3)) + (n.stateNow === 'Resting' || n.stateNow === 'Lunch break' ? 6 : 0) + ((hasPerk('steward') || hasPerk('crown')) ? 5 : 0) + (story.beacon ? 6 : 0) + (story.dawn ? 4 : 0) + (story.finale ? 4 : 0) + (story.wide ? 4 : 0) + season().mood - (n.sick > 0 ? 10 : 0) - n.shock;
    if (n.role === 'citizen') target += (builtBuildings('house').length ? 4 : -8) + (jobKind(n) && likesJob(n, jobKind(n)) ? 4 : 0);
    target = Math.max(0, Math.min(100, target));
    n.mood += Math.max(-3 * k, Math.min(3 * k, target - n.mood));
  }
  function removeNpc(n) {                  // 시민 출신은 쓰러지면 영구 사망 → 인구수 감소
    npc = n; setTask(null); returnGear(n); report.lostCit++;
    scene.remove(n);
    npcs.splice(npcs.indexOf(n), 1);
    burst(n.position); grieve();
    toast(`${n.name} has fallen`);
  }
  function damageNpc(target, n) {
    npc = target; n = n * dm().dmg;
    if (target.role !== 'citizen') n = Math.max(1, Math.round(n * (1 - gearDef(target.gear.armor).reduce) * standardMods(target).guard));      // 병사 방어구 + 지휘관의 깃발
    if (TR(target).dmg) n = Math.max(1, Math.round(n * TR(target).dmg));                                         // 용감한 성격
    npc.hp = Math.max(0, npc.hp - n); if (n > 0) fightGain(npc, 0.3, 0.8);                      // being in the thick of it trains too
    if (npc.hp <= 0 && !npc.down) {
      if (npc.born === 'citizen') { removeNpc(npc); return; }
      npc.down = true; npc.target = null; npc.gatherT = 0; npc.returning = false; setTask(null); npc.workT = 0; npc.promote = null;
      npc.mat.color.set(0x777777);                // 회색으로 변환
      grieve();
      npc.anim.die();                             // 쓰러지는 애니메이션
      burst(npc.position);
    }
  }
  function reviveNpc() {
    npc.down = false; npc.hp = npc.maxHp;
    npc.mat.color.set(npc.baseColor); npc.anim.revive();
    npc.position.set(npc.home.x, 0, npc.home.z); npc.px = npc.home.x; npc.pz = npc.home.z;
  }
  function updateNpcs(dt, hour, t) {
    for (const n of npcs.slice()) {
      npc = n; updateNpc(dt, hour, t); n.anim.update(dt); updateMood(n, dt);
      { const f = Math.min(1.7, Math.max(0.45, DIST / 11)); n.labelSprite.scale.set(2.6 * f, 0.98 * f, 1); n.labelSprite.position.y = 2.2 + 0.5 * f; }      // 카메라 거리에 맞춰 이름표 크기 조절
      n.sickIcon.visible = false; n.hungerIcon.visible = false;                 // 배고픔·질병 말풍선은 머리 위에 띄우지 않는다 (상태는 카드와 아침 보고서에 나온다)
    }
  }

  // 시민 외형은 시대에 따라 달라진다: 옷 색 + 2시대 모자 / 3시대 투구와 망토
  const citizenColor = () => [0xe8d27a, 0xf2c230, 0xe39a1a, 0xdc8a1a, 0xd07818][stage - 1];
  const hatMat = mat(0x7a5530), helmMat = mat(0x9a9da4), capeMat = mat(0xa02a2a);
  function applyCitizenLook(n) {
    if (n.decor) { n.body.remove(n.decor); n.decor = null; }
    return;                                                           // 예전 막대 인형용 모자·투구·망토 장식은 새 다각형 캐릭터와 겹쳐 이상하게 보이므로 쓰지 않는다
    if (n.role !== 'citizen' || stage < 2 || n.rig.skin) return;
    const g = new THREE.Group();
    const add = (geo, m, px, py, pz) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.castShadow = true; g.add(o); return o; };
    if (stage === 2) { add(new THREE.CylinderGeometry(0.32, 0.32, 0.04, 12), hatMat, 0, 1.93, 0); add(new THREE.CylinderGeometry(0.17, 0.2, 0.16, 10), hatMat, 0, 2.01, 0); }
    else { add(new THREE.SphereGeometry(0.24, 10, 6), helmMat, 0, 1.82, 0); add(new THREE.BoxGeometry(0.5, 0.9, 0.05), capeMat, 0, 1.15, -0.18); }
    n.body.add(g); n.decor = g;
  }
  function refreshCitizens() {
    for (const n of npcs) if (n.role === 'citizen') { n.baseColor = n.rig.skin ? 0xffffff : citizenColor(); if (!n.down) n.mat.color.set(n.baseColor); applyCitizenLook(n); }
  }

  // ---------- 인구 / 직업 (문명 시스템) ----------
  const builtBuildings = (kind) => obstacles.filter(o => o.userData.type === 'building' && o.userData.kind === kind);
  // ---------- 마을 번영도: 인구·식량·주거·방어·장비를 하나의 점수(0~100)로 ----------
  let prosScore = 25, prosBonus = 0, moodAvg = 60;
  function prosperity() {
    const cits = npcs.filter(n => n.role === 'citizen').length, houses = builtBuildings('house'), soldiers = npcs.filter(n => n.role !== 'citizen');
    const pop = Math.min(1, npcs.length / CFG.PROSPERITY_POP_TARGET);
    const food = cits ? (npcs.some(n => n.hungry) ? 0.15 : Math.min(1, 0.6 + 0.4 * res.food / (cits * CFG.RATION * 6))) : 0.5;
    const housing = houses.length ? houses.reduce((a, h) => a + (h.userData.level || 1), 0) / (houses.length * 3) : 0;
    const fences = obstacles.filter(o => o.userData.type === 'fence');
    const wall = designTier > 0 ? 0.5 + 0.5 * (fences.length ? fences.reduce((a, f) => a + f.userData.hp / f.userData.maxHp, 0) / fences.length : 0) : 0.1;
    const gear = soldiers.length ? soldiers.reduce((a, n) => a + ((n.role === 'melee' ? soldierWeaponDef(n).tier : gearDef(n.gear.bow).tier) + gearDef(n.gear.armor).tier) / 4, 0) / soldiers.length : 0;
    const amen = Math.min(1, (builtBuildings('well').length ? 0.5 : 0) + (builtBuildings('market').length ? 0.5 : 0));
    moodAvg = npcs.length ? npcs.reduce((a, n) => a + n.mood, 0) / npcs.length : 60;
    return Math.min(100, ((hasPerk('steward') || hasPerk('crown')) ? 10 : 0) + (story.beacon ? 5 : 0) + Math.round(100 * (0.15 * pop + 0.15 * food + 0.15 * housing + 0.15 * wall + 0.1 * gear + 0.1 * amen + 0.2 * (moodAvg / 100))));
  }
  const prosLabel = (v) => CFG.PROSPERITY_LABELS.find(l => v < l[0])[1];
  const prosEl = document.getElementById('prosN'), moodEl = document.getElementById('moodN');
  function updateProsperity() {
    prosScore = prosperity();
    prosBonus = prosScore >= 80 ? 2 : prosScore >= 55 ? 1 : 0;           // 안정된 마을에는 이주민이 더 모인다
    const t = `${prosLabel(prosScore)} ${prosScore}`;
    if (prosEl.textContent !== t) prosEl.textContent = t;
    const mt = `${moodLabel(moodAvg)} ${Math.round(moodAvg)}`;
    if (moodEl.textContent !== mt) moodEl.textContent = mt;
  }
  // ---------- 아침 요약 카드: 어젯밤과 어제 하루 동안 마을에서 일어난 일 ----------
  const freshReport = () => ({ left: [], kills: 0, lostCit: 0, wallsLost: 0, built: 0, upgraded: 0, fort: 0, rep: 0, newCit: 0, equipped: 0, forged: 0, ill: [], healed: [], season: '', camps: '', res: { ...res }, pros: prosScore, pop: 0 });
  let report = freshReport();
  const repEl = document.getElementById('report'), repList = document.getElementById('repList');
  let repTimer;
  function showReport(dayNo) {
    const r = report, rows = [], d = (k) => res[k] - r.res[k];
    if (dayNo > 1) { (story.stats || (story.stats = [])).push({ d: dayNo - 1, raid: isRaid(dayNo - 1) ? 1 : 0, k: r.kills, wl: r.wallsLost, cl: r.lostCit, f: r.fort, b: r.built, pop: npcs.length, pr: Math.round(prosScore), lv: pl.lvl, pw: Math.round(powerOf().total), w: res.wood, s: res.stone, i: res.iron, fd: Math.floor(res.food) }); if (story.stats.length > 120) story.stats.shift(); }
    rows.push(r.kills ? `Night: ${r.kills} raider${r.kills > 1 ? 's' : ''} defeated` : 'A quiet night');
    if (r.wallsLost || r.lostCit) rows.push(`Lost: ${[r.wallsLost ? `${r.wallsLost} wall${r.wallsLost > 1 ? 's' : ''}` : '', r.lostCit ? `${r.lostCit} citizen${r.lostCit > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ')}`);
    if (r.built || r.upgraded) rows.push(`Built: ${r.built} · Upgraded: ${r.upgraded}`);
    { const fm = npcs.find(n => n.foreman), woodLeft = stage >= CFG.UPGRADE_FENCE_STAGE ? obstacles.filter(o => o.userData.type === 'fence' && o.userData.level === 'wood').length : 0;
      if (r.fort || r.rep || woodLeft) rows.push(`${fm ? 'Foreman ' + fm.name : 'Workers'}: ${r.fort} wall${r.fort === 1 ? '' : 's'} fortified, ${r.rep} repaired${woodLeft ? ` · ${woodLeft} wooden left${res.stone < CFG.FENCE_UPGRADE_STONE ? ' (need stone)' : ''}` : ''}`); }
    if (isRaid(dayNo)) rows.push(`⚠ Raid tonight: ${forecast(dayNo)}`); else if (isRaid(dayNo + 1)) rows.push(`⚠ Raid TOMORROW night: ${forecast(dayNo + 1)}`);
    if (r.season) rows.push(r.season);
    if (r.camps) rows.push(`Camps delivered: ${r.camps}`);
    if (r.newCit) rows.push(`New citizens: ${r.newCit}`);
    if (r.ill.length) rows.push(`Fell ill: ${r.ill.join(', ')}${builtBuildings('well').length ? '' : ' - a well would help'}`);
    if (r.healed.length) rows.push(`Recovered: ${r.healed.join(', ')}`);
    if (r.left.length) rows.push(`Left the village: ${r.left.join(', ')}`);
    { const un = npcs.filter(n => n.mood < CFG.MOOD_UNHAPPY).length; rows.push(`Mood: ${moodLabel(moodAvg)} ${Math.round(moodAvg)}${un ? ` · ${un} unhappy` : ''}`); }
    const dr = [['wood', 'Wood'], ['stone', 'Stone'], ['iron', 'Iron'], ['food', 'Food']].map(([k, n]) => [n, Math.floor(d(k))]).filter(x => x[1] !== 0).map(([n, v]) => `${n} ${v > 0 ? '+' : ''}${v}`);
    if (dr.length) rows.push(`Stockpile: ${dr.join(' · ')}`);
    const dp = prosScore - r.pros;
    { const tn = nightTypeOf(dayNo), tm = nightTypeOf(dayNo + 1); rows.push(`Tonight: ${NIGHT_INFO[tn][0]}${tn === 'calm' ? '' : ' - ' + NIGHT_INFO[tn][1]}`); if (tm !== tn) rows.push(`Tomorrow night: ${NIGHT_INFO[tm][0]}`); }
    if (isRaid(dayNo) || isRaid(dayNo + 1)) rows.push(`Defense: ${defenseSummary()}`);
    rows.push(`Prosperity: ${prosLabel(prosScore)} ${prosScore}${dp ? ` (${dp > 0 ? '▲' : '▼'}${Math.abs(dp)})` : ''}`);
    document.getElementById('repTitle').textContent = `Day ${dayNo} · Morning report`;
    repList.innerHTML = rows.map(t => `<li>${t}</li>`).join('');
    repEl.classList.add('show'); clearTimeout(repTimer); repTimer = setTimeout(() => repEl.classList.remove('show'), 14000);
    report = freshReport();
  }
  repEl.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); repEl.classList.remove('show'); });
  // 마을을 떠나는 시민: 기분이 바닥(15 미만)이면 아침에 50% 확률로 짐을 싸서 떠난다
  function checkDepartures() {
    for (const n of npcs.filter(x => x.role === 'citizen' && x.mood < CFG.MOOD_LEAVE)) {
      if (Math.random() > 0.5) continue;
      npc = n; setTask(null); returnGear(n); if (n.work) { n.work.userData.worker = null; n.work = null; }
      scene.remove(n); npcs.splice(npcs.indexOf(n), 1); report.left.push(n.name);
    }
    if (report.left.length) setTimeout(() => toast(`${report.left.join(', ')} left the village - keep your people fed and safe`), 2400);
  }
  // ---------- 주민 카드: 주민을 누르면 이름, 직업, 성격, 기분, 하는 일을 보여 준다 ----------
  const ncEl = document.getElementById('npcCard'); let cardNpc = null, cardT = 0, cardBackWb = -1;       // cardBackWb: 전투단 창에서 열었으면 닫을 때 그 창으로 돌아간다
  const ROLE_TITLE = { melee: 'Soldier', archer: 'Archer', citizen: 'Citizen' };
  const CLS_ORDER = ['sword', 'spear', 'greatsword', 'medic', 'archer'], CLS_INFO = { archer: 'Archer: shoots from range, weak up close', sword: 'Swordsman: wide sweep', greatsword: 'Great Swordsman: long two-handed blade, slow heavy cleaves and a spinning slash', spear: 'Spearman: long thrust, holds the line', medic: 'Medic: heals allies nearby, fights weakly' };
  const clsTitle = (n) => n.role === 'archer' && n.mounted ? 'Horse Archer' : n.role === 'melee' ? n.mounted && ((n.cls || 'sword') === 'sword' || n.cls === 'spear') ? (n.cls === 'spear' ? 'Lancer' : 'Horseman') : { sword: 'Swordsman', spear: 'Spearman', greatsword: 'Great Swordsman', medic: 'Medic' }[n.cls || 'sword'] : ROLE_TITLE[n.role];
  function renderCard() {
    const n = cardNpc;
    if (!n || !npcs.includes(n)) { cardNpc = null; ncEl.style.display = 'none'; return; }
    const tr = TR(n), m = Math.round(n.mood), col = m < CFG.MOOD_LEAVE ? '#d9534f' : m < CFG.MOOD_UNHAPPY ? '#e8923a' : m < CFG.MOOD_HAPPY ? '#d9c84a' : '#5cc86a';
    document.getElementById('ncName').textContent = n.name; document.getElementById('ncRole').textContent = `${clsTitle(n)} · HP ${n.hp}/${n.maxHp}`;
    document.getElementById('ncTrait').innerHTML = `<b>${tr.label}</b> - ${tr.desc}`;
    const bar = document.getElementById('ncMoodBar'); bar.style.width = `${m}%`; bar.style.background = col;
    document.getElementById('ncMoodTxt').textContent = `Mood: ${moodLabel(m)} (${m}/100)` + (m < CFG.MOOD_UNHAPPY ? ' - works slower' : m >= CFG.MOOD_HAPPY ? ' - works a bit faster' : '');
    const rows = [`Doing: ${n.down ? 'Down' : n.stateNow}`];
    if (n.hungry) rows.push('Hungry: speed and work at half');
    if (n.sick > 0) rows.push('Sick: slower and gloomy until it passes');
    if (n.role !== 'citizen') rows.push(`Strength +${Math.round((soldierStr(n) - 1) * 100)}% · Speed +${Math.round((soldierSpd(n) - 1) * 100)}% (from fighting)`);
    if (n.role !== 'citizen' && vetLv(n)) rows.push(`Veteran rank ${vetLv(n)} (${n.vxp} drills): +${6 * vetLv(n)}% damage`);
    if (n.role !== 'citizen') rows.push(`Gear: ${(n.role === 'melee' ? soldierWeaponDef(n) : gearDef(n.gear.bow)).name}${n.gear.armor !== 'armor_none' ? ' · ' + gearDef(n.gear.armor).name : ''}`);
    else {
      rows.push(`Job: ${jobTitle(n)}`);
      if (n.work) rows.push(`Works at: ${BUILDING_NAME[n.work.userData.kind] || 'the village'}`);
      const k = jobKind(n); if (k) rows.push(`Technique: ${CFG.SKILL_NAMES[skillLv(n, k)]} (+${Math.round(CFG.SKILL_BONUS * skillLv(n, k) * 100)}% work speed, ${(n.xp && n.xp[k]) || 0} tasks done)`);
      const fav = CFG.TRAIT_JOB[n.trait]; if (fav) rows.push(`Talent: ${CFG.JOBS[fav]}${k === fav ? ' (using it: +10%)' : ''}`);
    }
    { const cb = document.getElementById('ncClass'); cb.style.display = n.role !== 'citizen' ? '' : 'none'; cb.textContent = `Class: ${clsTitle(n)} (tap to change)`; const pk = document.getElementById('ncPick'); pk.style.display = n.role !== 'citizen' ? '' : 'none'; const cur = n.role === 'archer' ? 'archer' : (n.cls || 'sword'); for (const b of pk.children) b.classList.toggle('on', b.dataset.cls === cur); if (n.role !== 'citizen') rows.push(CLS_INFO[cur]); }
    { const sb = document.getElementById('ncWarband'); sb.style.display = isSoldier(n) ? '' : 'none'; sb.textContent = n.warband >= 0 ? `${warbandName(n.warband)} (${warbandMembers(n.warband).length}/${CFG.WARBAND.SIZE}) - tap to change` : 'No warband - tap to join one'; if (isSoldier(n) && n.warband >= 0) sb.style.boxShadow = `0 2px 0 #a8480f, inset 0 0 0 3px ${warbandColor(n.warband)}`; }
    const jb = document.getElementById('ncJob'); jb.style.display = n.role === 'citizen' ? '' : 'none'; jb.textContent = `Job: ${PREF_LABEL(n.pref)} (tap to change)`;
    document.getElementById('ncInfo').innerHTML = rows.map(r => `<li>${r}</li>`).join('');
  }
  function openNpcCard(n) { cardBackWb = -1; cardNpc = n; renderCard(); ncEl.style.display = 'flex'; Snd.play('click'); }
  document.getElementById('ncClass').addEventListener('click', () => { if (cardNpc && cardNpc.role !== 'citizen') { setClassFor(cardNpc, CLS_ORDER[(CLS_ORDER.indexOf(cardNpc.role === 'archer' ? 'archer' : (cardNpc.cls || 'sword')) + 1) % CLS_ORDER.length]); renderCard(); toast(`${cardNpc.name} is now a ${clsTitle(cardNpc)}${cardNpc.escort ? ' for this journey' : ' at home'}`); } });
  document.getElementById('ncPick').addEventListener('click', e => { const c = e.target.dataset && e.target.dataset.cls; if (c && cardNpc && cardNpc.role !== 'citizen') { setClassFor(cardNpc, c); renderCard(); toast(`${cardNpc.name} is now a ${clsTitle(cardNpc)}${cardNpc.escort ? ' for this journey' : ' at home'}`); } });
  document.getElementById('ncWarband').addEventListener('click', () => { if (cardNpc && isSoldier(cardNpc)) { if (!cycleWarband(cardNpc)) toast('All warbands are full'); renderCard(); } });
  document.getElementById('ncJob').addEventListener('click', () => { if (cardNpc && cardNpc.role === 'citizen') { nextPref(cardNpc); renderCard(); } });
  function closeNpcCard() { cardNpc = null; ncEl.style.display = 'none'; if (cardBackWb >= 0) { const i = cardBackWb; cardBackWb = -1; openWbPanel(i); } }
  document.getElementById('ncClose').addEventListener('click', closeNpcCard);
  ncEl.addEventListener('pointerdown', e => { if (e.target === ncEl) closeNpcCard(); });
  // 시장: 매일 아침 남는 식량을 팔아 철을 산다 (식량 30 이상이면 10 → 철 3)
  function marketTrade() {
    if (!builtBuildings('market').length || res.food < 30) return;
    const lv = bLevel('market'), gain = 2 + lv, m = builtBuildings('market')[0];
    res.food -= 10; res.iron += gain; updateHud(); report.traded = (report.traded || 0) + 1;
    floatText(`Market: Food→Iron +${gain}`, m.position.x, 3.2, m.position.z);
  }
  // ---------- 전투단 (Warband, 군대 확장 1단계): 병사를 최대 6명씩 묶는다. 전투단이 원정에 함께 나가는 단위다 ----------
  // (이 파일의 것은 모두 function 선언이다: 10-npcs 의 초기 병사 생성이 이 파일보다 먼저 실행되기 때문)
  const inParty = (n) => escortBands.includes(n.warband) || !!n.levy;           // 원정에 가는 병사: 고른 전투단 + 소집한 농민병
  function isSoldier(n) { return n.role !== 'citizen'; }
  function warbandMembers(i) { return npcs.filter(n => isSoldier(n) && n.warband === i); }
  function warbandName(i) { return wbi(i).name; }
  function warbandColor(i) { return i >= 0 ? wbi(i).color : '#9aa0aa'; }
  function assignWarband(n) {                                   // 자리가 있는 첫 전투단로 (모두 찼으면 전투단 없음 -1)
    if (!isSoldier(n)) { n.warband = null; return; }
    n.warband = -1;
    for (let i = 0; i < CFG.WARBAND.MAX; i++) if (warbandMembers(i).length < CFG.WARBAND.SIZE) { n.warband = i; break; }
  }
  function cycleWarband(n) {                                    // 카드에서 눌러 다음 전투단로 옮긴다 (꽉 찬 전투단는 건너뜀)
    const cur = n.warband >= 0 ? n.warband : -1, M = CFG.WARBAND.MAX;
    for (let k = 1; k <= M; k++) {
      const i = (cur + k + M) % M;
      if (i !== cur && warbandMembers(i).length < CFG.WARBAND.SIZE) { n.warband = i; return true; }
    }
    return false;
  }
  // 병사 수 상한: 기본 6명 + 병영 1채당 6명 + 사격장 1채당 3명
  function soldierCap() { return CFG.WARBAND.CAP_BASE + CFG.WARBAND.CAP_BARRACKS * builtBuildings('barracks').length + CFG.WARBAND.CAP_RANGE * builtBuildings('range').length + CFG.WARBAND.CAP_YARD * builtBuildings('trainyard').length; }
  // 병사 직업(class)은 두 개다: 마을에서 쓰는 직업(clsHome)과 원정에서 쓰는 직업(clsTrip, 없으면 마을 직업과 같다). n.cls 는 지금 쓰는 직업이다.
  // 출발할 때 n.cls = 원정 직업, 돌아오면 n.cls = 마을 직업. 원정 중에 카드에서 바꾸면 원정 직업만, 마을에서 바꾸면 마을 직업만 바뀐다.
  // 궁수도 하나의 '직업'이다: 직업을 궁수로 바꾸면 병사의 역할(role)이 archer 로, 다른 직업으로 바꾸면 melee 로 바뀐다 (체력 비율·장비·숙련은 그대로). applyGear 가 매번 맞춰 준다
  function syncClassRole(n) {
    if (!n.clsSet || n.role === 'citizen') return;
    const want = n.cls === 'archer' ? 'archer' : 'melee'; if (n.role === want) return;
    const ratio = n.maxHp > 0 ? n.hp / n.maxHp : 1; n.role = want; n.archer = want === 'archer';
    n.baseColor = ROLE[want].color; n.maxHp = npcMaxHp(want, n.trait); n.hp = Math.max(1, Math.round(n.maxHp * ratio)); n.mat.color.set(n.baseColor); n.labelText = ''; n.hold = null; n.target = null;
  }
  function dropMountIfNeeded(n) { if (n.mounted && !canMount(n)) { n.mounted = false; applyMount(n); } }
  function clsName(c) { return { sword: 'Swordsman', spear: 'Spearman', greatsword: 'Great Swordsman', medic: 'Medic', archer: 'Archer' }[c] || 'Swordsman'; }
  function homeCls(n) { return n.clsHome || (n.role === 'archer' ? 'archer' : n.cls) || 'sword'; }
  function tripCls(n) { return n.clsTrip || homeCls(n); }
  function setClassFor(n, c) { n.clsSet = true; n.clsHome = n.clsHome || homeCls(n); n.clsTrip = n.clsTrip || tripCls(n); if (n.escort) n.clsTrip = c; else { n.clsHome = c; n.cls = c; } if (n.escort) n.cls = c; applyGear(n); }
  const CLS_LIST = ['sword', 'spear', 'greatsword', 'medic', 'archer'];
  function setHomeCls(n, c) { n.clsSet = true; n.clsTrip = n.clsTrip || tripCls(n); n.clsHome = c; if (!n.escort) { n.cls = c; applyGear(n); } }
  function setTripCls(n, c) { n.clsSet = true; n.clsHome = n.clsHome || homeCls(n); n.clsTrip = c; if (n.escort) { n.cls = c; applyGear(n); } }
  function cycleHomeCls(n) { setHomeCls(n, CLS_LIST[(CLS_LIST.indexOf(homeCls(n)) + 1) % CLS_LIST.length]); }
  function cycleTripCls(n) { setTripCls(n, CLS_LIST[(CLS_LIST.indexOf(tripCls(n)) + 1) % CLS_LIST.length]); }
  // 원정에 데려가는 전투단: 시대에 따라 최대 1(시대 1) / 2(시대 2) / 3(시대 3)개. 다시 누르면 뺀다
  const bandMax = () => (stage >= 3 ? 3 : stage >= 2 ? 2 : 1) + (bannersOpen() ? CFG.BANNER.HOST_BONUS : 0) + (hasPerk('warhost') ? 1 : 0);
  const bringing = (i) => escortBands.includes(i);
  function toggleBring(i) {
    if (bringing(i)) { escortBands = escortBands.filter(x => x !== i); return true; }
    const mx = bandMax();
    if (mx === 1) { escortBands = [i]; return true; }
    if (escortBands.length >= mx) { toast(`Max ${mx} warband${mx > 1 ? 's' : ''} at this stage`); return false; }
    escortBands.push(i); return true;
  }
  function soldierCount() { return npcs.filter(n => (isSoldier(n) && !n.levy) || n.promote).length + holdCount(); }

  // ---------- 전투단 이름·색(플레이어가 바꿀 수 있음)과 화면 아래 띠, 전투단 창 ----------
  let warbandInfo = null;                                       // [{ name, color }] - 저장됨. 처음 쓸 때 기본값으로 만든다
  const WB_COLORS = ['#e0604a', '#4a8be0', '#5fc060', '#e0b43c', '#a864d6', '#b8794a', '#d8dce4', '#4a4f5a'];       // 고를 수 있는 깃발 색
  function wbi(i) {
    if (!warbandInfo) warbandInfo = CFG.WARBAND.NAMES.map((n, k) => ({ name: `${n} Warband`, color: CFG.WARBAND.COLORS[k] }));
    return warbandInfo[i] || { name: `Band ${i + 1} Warband`, color: '#9aa0aa' };
  }
  // ---------- 깃발 (Banner, 시대 5): 전투단 2~3개를 한 깃발 아래 묶는다. 같은 깃발의 전투단이 가까이 있으면 더 세게 치고 덜 맞는다. 명령과 원정 합류도 한 번에 ----------
  function bannersOpen() { return stage >= CFG.BANNER.STAGE; }
  function bannerOf(i) { const b = i >= 0 && warbandInfo && warbandInfo[i] ? warbandInfo[i].banner : -1; return bannersOpen() && b >= 0 && b < CFG.BANNER.MAX ? b : -1; }
  function bannerName(b) { return `${CFG.BANNER.NAMES[b]} Banner`; }
  function bannerBands(b) { const r = []; for (let i = 0; i < CFG.WARBAND.MAX; i++) if (bannerOf(i) === b && warbandMembers(i).length) r.push(i); return r; }
  function setBanner(i, b) {
    if (!bannersOpen() || i < 0 || i >= CFG.WARBAND.MAX) return false;
    if (b >= 0) { if (b >= CFG.BANNER.MAX) return false; let c = 0; for (let k = 0; k < CFG.WARBAND.MAX; k++) if (k !== i && bannerOf(k) === b) c++; if (c >= CFG.BANNER.MAX_BANDS) return false; }
    wbi(i); warbandInfo[i].banner = b; return true;
  }
  function cycleBanner(i) { const cur = bannerOf(i); for (let k = 1; k <= CFG.BANNER.MAX + 1; k++) { const b = ((cur + 1 + k) % (CFG.BANNER.MAX + 1)) - 1; if (b !== cur && setBanner(i, b)) return b; } return cur; }
  function setBannerOrder(b, o) { for (let i = 0; i < CFG.WARBAND.MAX; i++) if (bannerOf(i) === b) setWarbandOrder(i, o); }
  function toggleBringBanner(b) {                                // 깃발의 전투단 전부를 데려가거나 뺀다 (자리가 모자라면 되는 만큼만)
    const bands = bannerBands(b); if (!bands.length) return false;
    if (bands.every(bringing)) { escortBands = escortBands.filter(x => !bands.includes(x)); return true; }
    let left = 0; for (const i of bands) if (!bringing(i)) { if (escortBands.length >= bandMax()) { left++; continue; } escortBands.push(i); }
    if (left) toast(`Only ${bandMax()} warbands fit in the host`); return true;
  }
  function setHostOrder(o) { for (let i = 0; i < CFG.WARBAND.MAX; i++) if (warbandMembers(i).length) setWarbandOrder(i, o); }     // 모든 전투단에 같은 명령
  const inBanner = (n) => !!n && n.warband >= 0 && bannerOf(n.warband) >= 0;                // 깃발 소속 병사 (군대 집결 나팔이 어디서든 들린다)
  function drilledTogether(n) { const b = n.warband >= 0 ? bannerOf(n.warband) : -1; return b >= 0 && npcs.filter(m => m.escort && m.role !== 'citizen' && bannerOf(m.warband) === b && m.warband !== n.warband).length > 0; }
  function bannerMods(n) {                                       // 같은 깃발의 다른 전투단 병사가 가까이 있으면 보너스
    const B = CFG.BANNER, b = n && n.warband >= 0 ? bannerOf(n.warband) : -1; if (b < 0 || n.down) return { dmg: 1, guard: 1 };
    const bands = new Set([n.warband]);
    for (const m of npcs) if (m !== n && !m.down && m.warband >= 0 && m.warband !== n.warband && bannerOf(m.warband) === b && !!m.escort === !!n.escort && Math.hypot(m.position.x - n.position.x, m.position.z - n.position.z) <= B.RADIUS + 3 * pl.st.bannerlord) bands.add(m.warband);
    return bands.size >= B.MIN_BANDS ? { dmg: 1 + B.DMG + 0.03 * pl.st.bannerlord, guard: 1 - B.GUARD - 0.03 * pl.st.bannerlord } : { dmg: 1, guard: 1 };
  }
  // ---------- 기병 (Cavalry): 마구간이 있으면 검병·창병이 말을 탈 수 있다 (마구간 1채당 CFG.CAV.PER_STABLE 기). 빠르고, 달려가서 치는 첫 일격이 세다 ----------
  const mountCap = () => CFG.CAV.PER_STABLE * builtBuildings('stable').length;
  const mountedCount = () => npcs.filter(n => n.mounted && !n.levy).length;
  const canMount = (n) => n.role === 'archer' || (n.role === 'melee' && ((n.cls || 'sword') === 'sword' || n.cls === 'spear'));
  function mountMul(n) { return n && n.mounted ? CFG.CAV.DMG + (n.chargeBonus ? CFG.CAV.CHARGE * (1 + 0.25 * pl.st.horsemaster) : 0) : 1; }
  function applyMount(n) {                                                   // 말 메쉬를 붙이거나 뗀다 (기수를 말 등 높이로 올린다)
    const want = !!n.mounted && canMount(n);
    if (want && !n.horse) {
      const hash = [...(n.name || 'x')].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7) >>> 0, coats = [0x7a4a2a, 0x3a2a22, 0xc8c0a8, 0x9a6a3a, 0x5a5a5e, 0xb08a5a], bc = parseInt((n.warband >= 0 ? warbandColor(n.warband) : '#8a2a2a').slice(1), 16);
      const horse = new THREE.Group(), body = horseModel(() => 0.3, { coat: coats[hash % coats.length], blanket: bc, armor: n.cls === 'spear' }), rider = new THREE.Group(); body.rotation.y = -Math.PI / 2; horse.add(body);
      const cur = n.rig.root; n.remove(cur); rider.add(cur); rider.position.y = 0.8; n.add(rider, horse); n.rig.seated = true; n.rig.rider = rider; n.horse = horse; n.rider = rider; horse.userData.legs = body.userData.legs; horse.userData.hr = body.userData.hr;
    } else if (!want && n.horse) {
      const cur = n.rig.root; n.rider.remove(cur); n.add(cur); n.remove(n.rider, n.horse); n.rig.seated = false; n.rig.rider = null; n.horse = n.rider = null; n.mounted = false;
    }
    n.charge = 0;
  }
  function toggleMount(n) {
    if (!canMount(n)) { toast('Only swordsmen, spearmen and archers can ride'); return false; }
    if (!n.mounted && mountedCount() >= mountCap()) { toast(builtBuildings('stable').length ? 'Every stall is taken (3 horses per stable)' : 'Build Stables first'); return false; }
    n.mounted = !n.mounted; applyMount(n); return true;
  }
  function trimMounts() { let extra = mountedCount() - mountCap(); for (const n of npcs) { if (n.mounted && !canMount(n)) { n.mounted = false; applyMount(n); } else if (extra > 0 && n.mounted) { n.mounted = false; applyMount(n); extra--; } } }
  // ---------- 지휘관의 말: 마구간이 하나라도 있으면 5단계에서 주인공도 말을 탈 수 있다 (M 키 / Mount 버튼). 빨라지고 달려가며 치는 첫 일격이 세다. 채집하면 자동으로 내린다 ----------
  let playerMounted = false, pHorse = null, pRider = null, pCharge = 0, pBonusT = 0;
  const leaderCanRide = () => stage >= CFG.BANNER.STAGE && builtBuildings('stable').length > 0;
  function leaderMountMul() { return playerMounted ? 1.05 + (pBonusT > 0 ? CFG.CAV.CHARGE * (1 + 0.25 * pl.st.horsemaster) : 0) : 1; }
  function leaderRideApply() {
    if (playerMounted && !pHorse) {
      const horse = new THREE.Group(), body = horseModel(() => 0.7, { coat: 0xe8e4d8, blanket: 0xe0b040, armor: true }), rider = new THREE.Group(); body.rotation.y = -Math.PI / 2; horse.add(body);
      const cur = playerRig.root; player.remove(cur); rider.add(cur); rider.position.y = 0.8; player.add(rider, horse); playerRig.seated = true; playerRig.rider = rider; pHorse = horse; pRider = rider; horse.userData.legs = body.userData.legs; horse.userData.hr = body.userData.hr;
    } else if (!playerMounted && pHorse) {
      const cur = playerRig.root; pRider.remove(cur); player.add(cur); player.remove(pRider, pHorse); playerRig.seated = false; playerRig.rider = null; pHorse = pRider = null;
    }
    pCharge = 0; pBonusT = 0;
  }
  function leaderChargeStrike() { if (!playerMounted) return; if (pCharge > CFG.CAV.CHARGE_T) { pBonusT = 0.9; floatText('Charge!', player.position.x, 3.2, player.position.z); } pCharge = 0; }
  function leaderDismount() { if (playerMounted) { playerMounted = false; leaderRideApply(); updateMountBtn(); } }
  function toggleLeaderMount() {
    if (dead) return;
    if (!playerMounted && !leaderCanRide()) return toast(stage < CFG.BANNER.STAGE ? 'Horses come with Stage 5' : 'Build Stables to ride');
    playerMounted = !playerMounted; gathering = null; leaderRideApply(); updateMountBtn(); toast(playerMounted ? 'Mounted' : 'Dismounted');
  }
  function updateMountBtn() {
    const b = document.getElementById('mountBtn'); if (!b) return;
    const show = leaderCanRide() || playerMounted; if (b.style.display !== (show ? '' : 'none')) b.style.display = show ? '' : 'none';
    const l = playerMounted ? 'Dismount' : 'Mount'; if (document.getElementById('mountLbl').textContent !== l) document.getElementById('mountLbl').textContent = l;
  }
  function leaderRideTick(t, dt) {
    if (dead && playerMounted) leaderDismount();
    if (!playerMounted || !pHorse) return;
    const mv = Math.hypot(player.position.x - (pLX ?? player.position.x), player.position.z - (pLZ ?? player.position.z)); pLX = player.position.x; pLZ = player.position.z;
    const v = dt > 0 ? mv / dt : 0; pCharge = v > 4 ? Math.min(1.6, pCharge + dt) : Math.max(0, pCharge - dt * 2);
    pBonusT = Math.max(0, pBonusT - dt);
    const air = playerRig.hopK || 0, bob = horseStep(pHorse, dt, v, air); pHorse.position.y = air * 1.7; if (!playerRig.fallen) pRider.position.y = 0.8 + bob + pHorse.position.y;
  }
  let pLX, pLZ;
  // ---------- 깃발 든 병사: 깃발마다 첫 전투단의 병사 한 명이 그 깃발의 큰 깃발을 등에 진다 (보기용) ----------
  function bannerFlagTick(t) {
    const bearers = new Map();
    if (bannersOpen()) for (let b = 0; b < CFG.BANNER.MAX; b++) { const bands = bannerBands(b); for (const i of bands) { const m = warbandMembers(i).find(x => !x.down && !x.hidden); if (m) { bearers.set(m, b); break; } } }
    for (const n of npcs) {
      const b = bearers.has(n) ? bearers.get(n) : -1;
      if (n.bflag && n.bflag.userData.b !== b) { n.remove(n.bflag); n.bflag = null; }
      if (b >= 0 && !n.bflag) {
        const g = new THREE.Group(), col = parseInt(CFG.BANNER.COLORS[b].slice(1), 16), pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.0, 5), new THREE.MeshLambertMaterial({ color: 0x5a3a1a })), cloth = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.04), new THREE.MeshLambertMaterial({ color: col })), tip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 5), new THREE.MeshLambertMaterial({ color: 0xe0b040 }));
        pole.position.y = 1.9; cloth.position.set(0.48, 3.0, 0); tip.position.y = 3.5; g.add(pole, cloth, tip); g.position.set(-0.25, n.horse ? 0.9 : 0, -0.35); g.userData = { b, cloth }; n.add(g); n.bflag = g;
      }
      if (n.bflag) n.bflag.userData.cloth.rotation.y = Math.sin(t * 4 + b) * 0.3;
    }
  }
  // 전투단 명령 (전쟁 계층 2단계): 전투단마다 하나. 저장된 예전 데이터에는 없으므로 읽을 때 'forward' 로 대신한다. 행동 연결은 다음 단계
  const WB_ORDERS = ['forward', 'stand', 'withdraw', 'charge'];
  function warbandOrder(i) { const o = i >= 0 && warbandInfo && warbandInfo[i] ? warbandInfo[i].order : null; return WB_ORDERS.includes(o) ? o : 'forward'; }
  function setWarbandOrder(i, o) { if (i < 0 || i >= CFG.WARBAND.MAX || !WB_ORDERS.includes(o)) return false; wbi(i); warbandInfo[i].order = o; for (const n of warbandMembers(i)) n.hold = null; return true; }
  const WB_ORDER_LABEL = { forward: 'Forward', stand: 'Stand firm', withdraw: 'Withdraw', charge: 'Charge' };
  const WB_ORDER_HINT = { forward: 'Fight as usual.', stand: 'Hold ground, no chasing.', withdraw: 'Fall back, no melee.', charge: 'Rush the foe.' };
  const orderOf = (n) => exActive && courageOf() <= 0 && n && n.role === 'melee' ? 'withdraw' : n && n.warband >= 0 ? warbandOrder(n.warband) : 'forward';
  // ---------- 지휘관의 깃발 (Leader's standard): 주인공(지휘관)의 곁에 있는 병사는 더 세게 치고 덜 맞는다. 지휘관이 쓰러지면 사라진다 ----------
  function standardRadius() { const S = CFG.STANDARD; return S.RADIUS * (1 + S.RANK_RADIUS * pl.st.standard) * (playerClass === 'commander' ? 1.25 : 1); }
  function standardMods(n) { const a = leaderMods(n), c = bannerMods(n), o = marshalMods(n), fm = formMods(n); return { dmg: a.dmg * c.dmg * o.dmg * fm.dmg, guard: a.guard * c.guard * o.guard * fm.guard }; }
  function marshalMods(n) {                                                  // 지휘관 기술: 돌격 명령을 받은 병사는 더 세게, 버티기 명령을 받은 병사는 덜 맞는다
    if (!n || n.role === 'citizen' || !(n.warband >= 0)) return { dmg: 1, guard: 1 };
    const o = warbandOrder(n.warband); return { dmg: o === 'charge' ? 1 + 0.08 * pl.st.warcommand : 1, guard: o === 'stand' ? 1 - 0.06 * pl.st.warcommand : 1 };
  }
  function leaderMods(n) {
    if (dead || !n || n.role === 'citizen' || Math.hypot(n.position.x - player.position.x, n.position.z - player.position.z) > standardRadius()) return { dmg: 1, guard: 1 };
    const S = CFG.STANDARD, k = playerClass === 'commander' ? 1.5 : 1;
    return { dmg: 1 + (S.DMG + S.RANK_DMG * pl.st.standard) * k, guard: 1 - (S.GUARD + S.RANK_GUARD * pl.st.standard) * k };
  }
  let standardRing = null, standardFlag = null;
  function updateStandard(t) {
    if (!standardFlag) {                                                    // 등에 맨 깃발: 가는 장대와 펄럭이는 천
      const g = new THREE.Group(), pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.9, 5), new THREE.MeshLambertMaterial({ color: 0x6a4a2a })), cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.38), new THREE.MeshLambertMaterial({ color: 0xe0b43c, side: THREE.DoubleSide }));
      pole.position.y = 1.15; cloth.position.set(0.3, 1.85, 0); g.add(pole, cloth); g.position.set(0.18, 0, -0.34); g.rotation.y = 0.2; g.userData.cloth = cloth; player.add(g); standardFlag = g;
    }
    const near = !dead && enemies.some(e => !e.userData.sinking && Math.hypot(e.position.x - player.position.x, e.position.z - player.position.z) < 36) && npcs.some(n => n.role !== 'citizen' && !n.down && leaderMods(n).dmg > 1);
    if (!standardRing) {
      standardRing = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffd54a, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
      standardRing.rotation.x = -Math.PI / 2; standardRing.position.y = 0.07; scene.add(standardRing);
    }
    const m = standardRing.material; m.opacity += ((near ? 0.45 : 0) - m.opacity) * 0.1; standardRing.visible = m.opacity > 0.02;
    standardFlag.visible = !dead && !bird && m.opacity > 0.12; standardFlag.userData.cloth.rotation.y = Math.sin(t * 4) * 0.35;       // 깃발은 병사와 함께 싸울 때만 보인다 (마을에서는 숨김)
    if (standardRing.visible) { standardRing.position.x = player.position.x; standardRing.position.z = player.position.z; standardRing.position.y = groundY(player.position.x, player.position.z, standardRadius() * 0.6) + 0.1; standardRing.scale.setScalar(standardRadius()); }
  }
  // ---------- 적 표시 (Mark the foe): 가장 가까운(앞쪽 우선) 적에 표시를 달면 모든 전투단이 그 적을 먼저 노린다. 한 번 더 누르면 해제 ----------
  let markedFoe = null, markRing = null;
  const FOE_NAME = { normal: 'Raider', brute: 'Brute', shield: 'Shieldbearer', siege: 'Siege thrower', boss: 'Boss', beast: 'Beast', archer: 'Archer', healer: 'Healer', sapper: 'Sapper' };
  function markValid(e) { return !!e && enemies.includes(e) && !e.userData.sinking && !(e.userData.dying > 0); }
  function pickMarkTarget() {
    let best = null, bs = 1e9;
    for (const e of enemies) {
      const u = e.userData; if (u.sinking || u.dying > 0 || u.prowl || !!u.ex !== !!exActive) continue;      // 원정 중에는 원정 지역의 적만, 마을에서는 마을의 적만
      const dx = e.position.x - player.position.x, dz = e.position.z - player.position.z, d = Math.hypot(dx, dz); if (d > 45) continue;
      const front = d > 0.1 ? (dx * Math.sin(facing) + dz * Math.cos(facing)) / d : 0, sc = d - 8 * front;       // 가깝고 바라보는 쪽일수록 먼저
      if (sc < bs) { bs = sc; best = e; }
    }
    return best;
  }
  function toggleMark() {
    const t = pickMarkTarget();
    if (!t) { if (markedFoe) { markedFoe = null; toast('Mark cleared'); } else toast('No foe in sight to mark'); }
    else if (t === markedFoe) { markedFoe = null; toast('Mark cleared'); }
    else { markedFoe = t; toast(`Marked: ${FOE_NAME[t.userData.kind] || 'Foe'}`); Snd.play('click'); }
    wbBarHtml = ''; renderWbBar();
  }
  function updateMark(t) {
    if (markedFoe && !markValid(markedFoe)) { markedFoe = null; wbBarHtml = ''; }
    if (!markedFoe) { if (markRing) markRing.visible = false; return; }
    if (!markRing) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.9, depthTest: false, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.1, 24), mat), cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 4), mat);
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.1; cone.rotation.x = Math.PI; ring.renderOrder = cone.renderOrder = 999;
      markRing = new THREE.Group(); markRing.add(ring, cone); markRing.userData = { ring, cone }; scene.add(markRing);
    }
    const u = markedFoe.userData, k = u.boss ? 1.9 : (u.r || 0.5) * 1.8 + 0.4;
    markRing.visible = true; markRing.position.set(markedFoe.position.x, markedFoe.position.y - (u.baseY || 0), markedFoe.position.z);
    markRing.userData.ring.scale.setScalar(k * (1 + 0.08 * Math.sin(t * 7)));
    markRing.userData.cone.position.y = 2.6 * (u.boss ? 1.8 : 1) + Math.sin(t * 6) * 0.15;
  }
  const wbBar = document.getElementById('wbBar'), wbPanel = document.getElementById('wbPanel');
  let wbOpen = -1, wbBarHtml = '', wbSel = -1, wbAll = false, wbMoveFor = -1, wbPlacing = false;
  // ---------- 전투단 진지 (원정): 'Place' 를 누르고 땅을 누르면 고른 전투단이 그 자리에 줄지어 서서 지킨다. 'Follow' 는 다시 따라오게 한다 ----------
  var bandPost = {};
  const bandSlot = (n) => npcs.filter(x => x.escort && x.warband === n.warband).indexOf(n);
  // ---------- formations: Block (loose), Line (one wide rank), Wedge (a point that bites in), Shield wall (melee shoulder to shoulder in front, archers behind). Only while the band holds a placed post ----------
  const FORMS = ['block', 'line', 'wedge', 'wall'], FORM_NAME = { block: 'Block', line: 'Line', wedge: 'Wedge', wall: 'Shield wall' }, FORM_HINT = { block: 'Loose block.', line: 'One wide rank: +5% damage.', wedge: 'A point that bites in: +10% damage, +5% damage taken.', wall: 'Shield wall: melee front, archers behind. -30% damage taken, -10% damage dealt.' };
  const warbandForm = (i) => { const o = i >= 0 && warbandInfo && warbandInfo[i] ? warbandInfo[i].form : null; return FORMS.includes(o) ? o : 'block'; };
  function formSlot(form, n) {                                           // slot of soldier n in its band: local x = to the right, z = forward (toward the foe)
    const mem = npcs.filter(x => x.escort && x.warband === n.warband), k = mem.indexOf(n), cnt = mem.length;
    if (form === 'line') return { x: (k - (cnt - 1) / 2) * 2.0, z: 0 };
    if (form === 'wedge') { if (k === 0) return { x: 0, z: 1.6 }; const r = Math.floor((k + 1) / 2); return { x: (k % 2 ? 1 : -1) * r * 1.5, z: 1.6 - r * 1.4 }; }
    if (form === 'wall') {
      const grp = mem.filter(x => (x.role === 'melee') === (n.role === 'melee')), gk = grp.indexOf(n), front = n.role === 'melee';
      return { x: (gk - (grp.length - 1) / 2) * (front ? 1.25 : 1.7), z: front ? 0.4 : -1.8 };
    }
    return { x: ((k % 5) - 2) * 1.9, z: -Math.floor(k / 5) * 1.7 };
  }
  function postHeading(post) {                                           // the band faces the nearest foe, else the camp, else south
    const now = performance.now(); if (post.hT && now - post.hT < 400) return post.h || 0; post.hT = now;
    let best = null, bd = 70; for (const e of enemies) { const u = e.userData; if (!u.ex || u.sinking || u.dying > 0) continue; const d = Math.hypot(e.position.x - post.x, e.position.z - post.z); if (d < bd) { bd = d; best = e.position; } }
    const t = best || (exCamp ? { x: exCamp.cx, z: exCamp.cz } : null); post.h = t ? Math.atan2(t.x - post.x, t.z - post.z) : 0; return post.h;
  }
  function formWorld(form, n, post) {
    const s = formSlot(form, n), h = postHeading(post), fx = Math.sin(h), fz = Math.cos(h);
    return { x: post.x + fz * s.x + fx * s.z, z: post.z - fx * s.x + fz * s.z, h };
  }
  function formMods(n) {                                                 // only soldiers standing in their slot get the bonus
    if (!n || !n.inForm || n.warband < 0) return { dmg: 1, guard: 1 };
    const f = warbandForm(n.warband);
    if (f === 'line') return { dmg: 1.05, guard: 1 };
    if (f === 'wedge') return { dmg: 1.10, guard: 1.05 };
    if (f === 'wall') return n.role === 'melee' ? { dmg: 0.9, guard: 0.7 } : { dmg: 1, guard: 0.9 };
    return { dmg: 1, guard: 1 };
  }
  function cycleForm() {
    const tgt = wbOrderTargets(); if (!tgt.length) return;
    const nx = FORMS[(FORMS.indexOf(warbandForm(tgt[0])) + 1) % FORMS.length];
    for (const b of tgt) { wbi(b); warbandInfo[b].form = nx; }
    toast(`${tgt.length === 1 ? wbi(tgt[0]).name : 'The whole host'}: ${FORM_NAME[nx]}. ${FORM_HINT[nx]}${nx === 'block' ? '' : ' (Place the band to form up)'}`); Snd.play('click'); wbBarHtml = ''; renderWbBar();
  }
  function postMarks() {
    for (const k of Object.keys(bandPost)) { const p = bandPost[k]; if (!exActive || !p.mark) continue; p.mark.userData.cloth.rotation.y = Math.sin(performance.now() / 300 + +k) * 0.3; }
  }
  function setBandPost(i, x, z) {
    let p = bandPost[i];
    if (!p) { const g = new THREE.Group(), col = new THREE.Color(wbi(i).color), ring = new THREE.Mesh(new THREE.RingGeometry(3.4, 4.0, 32), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide })), pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 6, 5), lampPostMat), cloth = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.3, 0.05), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.12; pole.position.y = 3; cloth.position.set(1.05, 5.3, 0); g.add(ring, pole, cloth); g.userData.cloth = cloth; scene.add(g); exMeshes.push(g); p = bandPost[i] = { x, z, mark: g }; }
    p.x = x; p.z = z; p.mark.position.set(x, groundY(x, z, 1) || 0, z);
  }
  function clearBandPost(i) { const p = bandPost[i]; if (!p) return; scene.remove(p.mark); delete bandPost[i]; }
  function clearAllPosts() { for (const k of Object.keys(bandPost)) clearBandPost(k); wbPlacing = false; }
  function placeBands(x, z) {                                              // 땅을 눌렀다: 고른 전투단들을 그 자리에 (여럿이면 가로로 나란히)
    const tgt = wbOrderTargets(); wbPlacing = false; wbBarHtml = ''; renderWbBar(); if (!tgt.length) return;
    const lim = exR - 7, hx = x - EXC.x, hz = z - EXC.z, hd = Math.hypot(hx, hz); if (hd > lim) { x = EXC.x + hx / hd * lim; z = EXC.z + hz / hd * lim; }
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);
    tgt.forEach((b, k) => { const off = (k - (tgt.length - 1) / 2) * 11; setBandPost(b, x + rx * off, z + rz * off); });
    toast(tgt.length === 1 ? `${wbi(tgt[0]).name} holds that ground` : 'The bands take their ground'); Snd.play('click');
  }
  function renderWbBar() {
    const show = !dead && !uiPause;                                  // 원정 중에도 보인다 (함께 간 전투단만)
    let html = '';
    if (show) for (let i = 0; i < CFG.WARBAND.MAX; i++) {
      const m = warbandMembers(i).filter(n => !exActive || n.escort); if (!m.length) continue;
      const hurt = m.filter(n => n.down).length, sel = !exActive && bringing(i);
      html += `<button class="wbchip${sel ? ' sel' : ''}${wbSel === i ? ' pick' : ''}" data-wb="${i}" style="--c:${wbi(i).color}" title="${wbi(i).name}"><i></i><b>${m.length - hurt}/${m.length}</b>${sel ? '<em>&#9873;</em>' : ''}${bannerOf(i) >= 0 ? `<s style="color:${CFG.BANNER.COLORS[bannerOf(i)]}">${CFG.BANNER.NAMES[bannerOf(i)][0]}</s>` : ''}${warbandOrder(i) !== 'forward' ? `<u>${WB_ORDER_LABEL[warbandOrder(i)][0]}</u>` : ''}</button>`;
    }
    if (html && exActive) html = `${exActive.prep ? '<button class="wbbegin" data-begin="1" title="End the preparation: the foe attacks">&#9876; Begin</button>' : ''}<button class="wbplace${wbPlacing ? ' on' : ''}" data-place="1" title="Then tap the ground">&#8982; ${wbPlacing ? 'Tap ground' : 'Place'}</button><button class="wbfollow" data-follow="1" title="Come back to the commander">&#9873; Follow</button><button class="wbform" data-form="1" title="Formation of the selected band (or the whole host)">&#9638; ${FORM_NAME[warbandForm(wbOrderTargets()[0] ?? -1)]}</button>` + html;
    if (html) html += `<button class="wbmark${markedFoe ? ' on' : ''}" data-mark="1" title="Mark the foe (Y)">&#9678; Mark</button>`;
    if (html) {                                                          // 명령 띠: 고른 전투단(없거나 All 이면 전체)에게 바로 내린다. 창을 열 필요가 없다
      const tgt = wbOrderTargets(), cur = tgt.length && tgt.every(b => warbandOrder(b) === warbandOrder(tgt[0])) ? warbandOrder(tgt[0]) : '';
      html += `<div class="wbq"><button class="wball${wbAll || wbSel < 0 ? ' on' : ''}" data-all="1" title="Orders go to the whole host">All</button>${WB_ORDERS.map(o => `<button class="wbqo${o === cur ? ' on' : ''}" data-ordq="${o}" title="${WB_ORDER_HINT[o]}">${WB_ORDER_SHORT[o]}</button>`).join('')}</div>`;
    }
    if (html === wbBarHtml) return; wbBarHtml = html; wbBar.innerHTML = html; wbBar.style.display = html ? 'flex' : 'none';
  }
  const WB_ORDER_SHORT = { forward: '&#10148; Go', stand: '&#9632; Hold', withdraw: '&#8630; Back', charge: '&#9876; Charge' };
  function wbOrderTargets() { const all = []; for (let i = 0; i < CFG.WARBAND.MAX; i++) if (warbandMembers(i).filter(n => !exActive || n.escort).length) all.push(i); return wbAll || wbSel < 0 || !all.includes(wbSel) ? all : [wbSel]; }
  function issueOrder(o) {
    const tgt = wbOrderTargets(); if (!tgt.length) return;
    const done = new Set(); for (const b of tgt) { if (done.has(b)) continue; const bn = bannerOf(b); if (bn >= 0) { setBannerOrder(bn, o); bannerBands(bn).forEach(x => done.add(x)); } else { setWarbandOrder(b, o); done.add(b); } }
    toast(`${tgt.length === 1 ? wbi(tgt[0]).name : 'The whole host'}: ${WB_ORDER_LABEL[o]}`); Snd.play('click'); wbBarHtml = ''; renderWbBar();
  }
  wbBar.addEventListener('pointerdown', e => {
    if (e.target.closest('[data-begin]')) { e.preventDefault(); e.stopPropagation(); endPrep(''); return; }
    if (e.target.closest('[data-place]')) { e.preventDefault(); e.stopPropagation(); wbPlacing = !wbPlacing; if (wbPlacing) toast(`Tap the ground to place ${wbOrderTargets().length === 1 ? wbi(wbOrderTargets()[0]).name : 'the bands'}`); wbBarHtml = ''; renderWbBar(); return; }
    if (e.target.closest('[data-form]')) { e.preventDefault(); e.stopPropagation(); cycleForm(); return; }
    if (e.target.closest('[data-follow]')) { e.preventDefault(); e.stopPropagation(); const tg = wbOrderTargets(); tg.forEach(clearBandPost); wbPlacing = false; toast('Following you'); wbBarHtml = ''; renderWbBar(); return; }
    if (e.target.closest('.wbmark')) { e.preventDefault(); e.stopPropagation(); toggleMark(); return; }
    const q = e.target.closest('[data-ordq]'); if (q) { e.preventDefault(); e.stopPropagation(); issueOrder(q.dataset.ordq); return; }
    if (e.target.closest('[data-all]')) { e.preventDefault(); e.stopPropagation(); wbAll = !wbAll; if (wbAll) wbSel = -1; wbBarHtml = ''; renderWbBar(); return; }
    const b = e.target.closest('.wbchip'); if (!b) return; e.preventDefault(); e.stopPropagation();
    const i = +b.dataset.wb; if (wbSel === i) { openWbPanel(i); return; }                                  // 한 번 누르면 고르고, 고른 것을 다시 누르면 창이 열린다
    wbSel = i; wbAll = false; Snd.play('click'); wbBarHtml = ''; renderWbBar();
  });
  function renderWbPanel() {
    const i = wbOpen; if (i < 0) return;
    const m = warbandMembers(i), info = wbi(i);
    if (!m.length) { closeWbPanel(); return; }
    if (wbMoveFor >= 0) {                                                  // 옮길 전투단 고르기: 한 번 눌러 바로 옮긴다 (꽉 찬 곳은 서로 자리를 바꾼다)
      const mv = npcs[wbMoveFor];
      if (mv && mv.role !== 'citizen') {
        const list = []; for (let b = 0; b < CFG.WARBAND.MAX; b++) { const mem = warbandMembers(b).length, full = mem >= CFG.WARBAND.SIZE, here = mv.warband === b;
          list.push(`<button class="wbdest${here ? ' here' : ''}" data-dest="${b}" style="--c:${wbi(b).color}"><i></i><b>${wbi(b).name}</b><span>${mem}/${CFG.WARBAND.SIZE}${here ? ' · here' : full ? ' · swap' : ''}</span></button>`); }
        wbPanel.querySelector('.wcard').innerHTML = `<div class="whead"><b>Move ${mv.name} to…</b></div><div class="wdests">${list.join('')}</div><button id="wbMoveCancel">Cancel</button>`;
        return;
      }
      wbMoveFor = -1;
    }
    const sw = WB_COLORS.map(c => `<button class="wbsw${c === info.color ? ' on' : ''}" data-color="${c}" style="background:${c}"></button>`).join('');
    const rows = m.map((n, k) => { const ix = npcs.indexOf(n);
      return `<li data-n="${ix}"><div class="wr1"><b>${clsTitle(n)}</b> ${n.name} <span>${n.down ? 'Down' : `HP ${n.hp}/${n.maxHp}`}${vetLv(n) ? ' · vet ' + vetLv(n) : ''}</span></div>
      <div class="wr2">${n.role !== 'citizen' ? `<button class="wbact" data-act="home" data-ix="${ix}">At home: ${clsName(homeCls(n))}</button><button class="wbact" data-act="trip" data-ix="${ix}">Journey: ${clsName(tripCls(n))}</button>` : ''}${canMount(n) && bannersOpen() ? `<button class="wbact" data-act="mount" data-ix="${ix}">${n.mounted ? 'Dismount' : 'Mount'}</button>` : ''}${n.escort ? '' : `<button class="wbact" data-act="band" data-ix="${ix}">Move to…</button>`}</div></li>`; }).join('');
    const mel = m.filter(n => n.role !== 'citizen'), uni = (f) => mel.length && mel.every(n => f(n) === f(mel[0])) ? clsName(f(mel[0])) : 'Mixed';
    const bulk = mel.length > 1 ? `<div class="wbulk"><button class="wbact" data-bulk="home">All at home: ${uni(homeCls)} &#8594;</button><button class="wbact" data-bulk="trip">All journey: ${uni(tripCls)} &#8594;</button></div>` : '';
    wbPanel.querySelector('.wcard').innerHTML = `<div class="whead"><i style="background:${info.color}"></i><b>${info.name}</b><button id="wbRename">Rename</button></div>
      <div class="wsw">${sw}</div>${bulk}<ul class="wlist">${rows}</ul>
      ${exActive ? '' : `<button id="wbBring" class="${bringing(i) ? 'on' : ''}">${bringing(i) ? 'Coming on your next journey &#10003;' : 'Bring on your next journey'}</button>`}
      ${bannersOpen() ? `<div class="wbn"><button id="wbBanner">${bannerOf(i) >= 0 ? bannerName(bannerOf(i)) + ' (' + bannerBands(bannerOf(i)).length + ' bands)' : 'No banner'}</button>${bannerOf(i) >= 0 && !exActive ? `<button id="wbBannerBring" class="${bannerBands(bannerOf(i)).every(bringing) ? 'on' : ''}">Bring whole banner</button>` : ''}</div>` : ''}
      ${bannersOpen() ? `<div class="word host"><small>Whole host:</small>${WB_ORDERS.map(o => `<button class="wbord" data-hord="${o}">${WB_ORDER_LABEL[o]}</button>`).join('')}</div>` : ''}
      <div class="word">${WB_ORDERS.map(o => `<button class="wbord${o === warbandOrder(i) ? ' on' : ''}" data-ord="${o}">${WB_ORDER_LABEL[o]}</button>`).join('')}</div><small>${WB_ORDER_HINT[warbandOrder(i)]}${bannerOf(i) >= 0 ? ' Orders go to the whole banner.' : ''}</small>
      <small>${m.length}/${CFG.WARBAND.SIZE} soldiers</small><button id="wbClose">Close</button>`;
  }
  function openWbPanel(i) { wbOpen = i; renderWbPanel(); wbPanel.style.display = 'flex'; Snd.play('click'); }
  function closeWbPanel() { wbOpen = -1; wbMoveFor = -1; wbPanel.style.display = 'none'; }
  wbPanel.addEventListener('pointerdown', e => {
    if (e.target === wbPanel) { closeWbPanel(); return; }
    const t = e.target, i = wbOpen; if (i < 0) return;
    if (t.dataset && t.dataset.hord) { setHostOrder(t.dataset.hord); toast(`The whole host: ${WB_ORDER_LABEL[t.dataset.hord]}`); renderWbPanel(); wbBarHtml = ''; renderWbBar(); e.stopPropagation(); return; }
    if (t.dataset && t.dataset.ord) { if (bannerOf(i) >= 0) setBannerOrder(bannerOf(i), t.dataset.ord); else setWarbandOrder(i, t.dataset.ord); toast(`${wbi(i).name}: ${WB_ORDER_LABEL[t.dataset.ord]}`); renderWbPanel(); wbBarHtml = ''; renderWbBar(); e.stopPropagation(); return; }
    if (t.id === 'wbMoveCancel') { wbMoveFor = -1; renderWbPanel(); e.stopPropagation(); return; }
    { const d = t.closest('[data-dest]'); if (d && wbMoveFor >= 0) { const n = npcs[wbMoveFor], to = +d.dataset.dest; wbMoveFor = -1; if (n && !n.escort && to !== n.warband) { const mem = warbandMembers(to).filter(x => !x.escort);
          if (warbandMembers(to).length < CFG.WARBAND.SIZE) { n.warband = to; toast(`${n.name} joins ${warbandName(to)}`); } else if (mem.length) { const o = mem[mem.length - 1]; o.warband = n.warband; n.warband = to; toast(`${n.name} and ${o.name} swap places`); } else toast('That band is full'); }
        if (n) { n.labelText = ''; } wbBarHtml = ''; renderWbBar(); const left = warbandMembers(i).length; if (!left) closeWbPanel(); else renderWbPanel(); e.stopPropagation(); return; } }
    { const bk = t.dataset && t.dataset.bulk; if (bk) { const mel = warbandMembers(i).filter(n => n.role !== 'citizen'); if (mel.length) { const f = bk === 'home' ? homeCls : tripCls, nx = CLS_LIST[(CLS_LIST.indexOf(f(mel[0])) + 1) % CLS_LIST.length]; for (const n of mel) { if (bk === 'home') setHomeCls(n, nx); else setTripCls(n, nx); } toast(`${wbi(i).name}: all ${bk === 'home' ? 'at home' : 'on journeys'} are ${clsName(nx)}s`); } renderWbPanel(); e.stopPropagation(); return; } }
    if (t.dataset && t.dataset.act) { const n = npcs[+t.dataset.ix];
      if (n) { if (t.dataset.act === 'home' && n.role !== 'citizen') cycleHomeCls(n); else if (t.dataset.act === 'trip' && n.role !== 'citizen') cycleTripCls(n); else if (t.dataset.act === 'mount') { toggleMount(n); renderWbPanel(); } else if (t.dataset.act === 'band' && !n.escort) { wbMoveFor = npcs.indexOf(n); } renderWbPanel(); }
      e.stopPropagation(); return; }
    if (t.id === 'wbClose') { closeWbPanel(); }
    else if (t.id === 'wbBanner') { const b = cycleBanner(i); toast(b >= 0 ? `${warbandName(i)} joins the ${bannerName(b)}` : `${warbandName(i)} leaves its banner`); renderWbPanel(); wbBarHtml = ''; renderWbBar(); }
    else if (t.id === 'wbBannerBring') { toggleBringBanner(bannerOf(i)); renderWbPanel(); wbBarHtml = ''; renderWbBar(); }
    else if (t.id === 'wbBring') { toggleBring(i); renderWbPanel(); wbBarHtml = ''; renderWbBar(); }
    else if (t.id === 'wbRename') {
      let v = null; try { v = window.prompt('Name this warband', wbi(i).name); } catch (er) {}
      if (v !== null) { v = v.trim().slice(0, 22); const def = `${CFG.WARBAND.NAMES[i]} Warband`; wbi(i).name = v || def; renderWbPanel(); wbBarHtml = ''; renderWbBar(); for (const n of warbandMembers(i)) n.labelText = ''; }
    } else if (t.dataset && t.dataset.color) { wbi(i).color = t.dataset.color; renderWbPanel(); wbBarHtml = ''; renderWbBar(); for (const n of warbandMembers(i)) n.labelText = ''; }
    else { const r1 = t.closest('.wr1'), li = r1 && r1.closest('li[data-n]'); if (li) { const n = npcs[+li.dataset.n]; closeWbPanel(); if (n) { openNpcCard(n); cardBackWb = i; } } }
    e.stopPropagation();
  });
  setInterval(() => { renderWbBar(); postMarks(); }, 600);
  // ---------- 아침 이벤트: 선택에 따라 득실이 갈리는 짧은 사건 (창이 열려 있는 동안 시간이 멈춘다) ----------
  let eventOpen = false, pendingRaiders = 0; const eventQueue = [];
  const evEl = document.getElementById('eventPanel'), evBtns = document.getElementById('evBtns');
  const citizens = () => npcs.filter(n => n.role === 'citizen' && !n.down);
  function spawnCitizens(k) {
    const houses = builtBuildings('house'); let made = 0;
    for (let i = 0; i < k && houses.length; i++) { const door = doorOf(houses[(npcs.length + i) % houses.length]); const c = makeNpc('citizen', door, 'citizen', i * 0.15); c.position.set(door.x, 0, door.z); made++; }
    report.newCit += made; return made;
  }
  const moodAll = (x) => npcs.forEach(n => { n.mood = Math.max(0, Math.min(100, n.mood + x)); });
  const dayNow = () => Math.floor(gameMin / 1440) + 1;
  const tinkerTarget = () => CFG.LEVELED.flatMap(k => builtBuildings(k)).find(o => lvOf(o) < stage);
  const EVENTS = [
    { id: 'merchant', title: 'Wandering Merchant', text: 'A cart rolls up to the gate. The merchant offers a few fair trades.', opts: [
      { label: 'Trade 12 Food for 4 Iron', ok: () => res.food >= 12, run: () => { res.food -= 12; res.iron += 4; return 'Deal done: +4 Iron'; } },
      { label: 'Trade 15 Wood for 8 Food', ok: () => res.wood >= 15, run: () => { res.wood -= 15; res.food += 8; return 'Deal done: +8 Food'; } },
      { label: 'Send the merchant away', alt: true, run: () => 'The merchant moves on' } ] },
    { id: 'refugees', title: 'Refugee Family', text: 'A tired family asks for shelter behind your walls. They will need feeding.', avail: () => npcs.length < maxPop() && builtBuildings('house').length > 0, opts: [
      { label: 'Welcome them', sub: 'Costs 6 Food · up to 2 new citizens', ok: () => res.food >= 6, run: () => { res.food -= 6; const k = spawnCitizens(Math.min(2, maxPop() - npcs.length)); return `${k} new citizen${k > 1 ? 's' : ''} joined the village`; } },
      { label: 'Turn them away', alt: true, run: () => 'The family walks on into the dusk' } ] },
    { id: 'caravan', title: 'Abandoned Caravan', text: 'Wreckage lies beside the road, still full of supplies. Something may be watching it.', opts: [
      { label: 'Scavenge it', sub: '+25 Wood, +15 Stone, +3 Iron · 3 more raiders tonight', run: () => { res.wood += 25; res.stone += 15; res.iron += 3; pendingRaiders += 3; return 'Loaded up the cart. Raiders may follow...'; } },
      { label: 'Leave it alone', alt: true, run: () => 'Better safe than sorry' } ] },
    { id: 'sickness', title: 'Sickness Rumor', text: 'Travelers brought coughs into the village. A few people look pale.', avail: () => citizens().length > 0, opts: [
      { label: 'Quarantine the travelers', sub: 'Costs 8 Food', ok: () => res.food >= 8, run: () => { res.food -= 8; return 'The sickness never spreads'; } },
      { label: 'Ignore it', sub: 'Up to 2 citizens fall ill for a few days (slower, gloomy)', alt: true, run: () => { const c = citizens().filter(n => !(n.sick > 0)).slice(0, 2); c.forEach(n => { n.sick = CFG.SICK_DAYS + 1; }); return c.length ? `${c.length} citizen${c.length > 1 ? 's' : ''} fell ill` : 'Nobody fell ill'; } } ] },
    { id: 'bard', title: 'Travelling Bard', text: 'A bard with a battered lute asks for a meal and offers songs for the evening.', avail: () => citizens().length > 0, opts: [
      { label: 'Feed the bard', sub: 'Costs 6 Food · everyone feels better (+15 mood)', ok: () => res.food >= 6, run: () => { res.food -= 6; moodAll(15); return 'Songs by the fire lift everyone\'s spirits'; } },
      { label: 'No time for songs', alt: true, run: () => 'The bard wanders on' } ] },
    { id: 'wolves', title: 'Hungry Wolves', text: 'Wolves circle the fields at dawn, thin and bold.', avail: () => dayNow() >= 3, opts: [
      { label: 'Drive them off yourself', sub: 'You lose 25 HP · +6 Food from the pelts', run: () => { hp = Math.max(1, hp - 25); hpEl.textContent = Math.ceil(hp); res.food += 6; return 'The wolves flee. You are bruised.'; } },
      { label: 'Leave food at the edge', sub: 'Costs 10 Food', ok: () => res.food >= 10, run: () => { res.food -= 10; return 'The wolves take the bait and leave'; } },
      { label: 'Ignore them', sub: 'Two citizens panic (-12 mood)', alt: true, run: () => { citizens().slice(0, 2).forEach(n => { n.mood = Math.max(0, n.mood - 12); }); return 'The wolves are gone by noon, but nerves are frayed'; } } ] },
    { id: 'stray', title: 'A Stray Dog', text: 'A scruffy dog trots into the village and refuses to leave.', avail: () => citizens().length > 0, opts: [
      { label: 'Let it stay', sub: 'Everyone is a little happier (+8 mood)', run: () => { moodAll(8); return 'The dog has found a home'; } },
      { label: 'Shoo it away', alt: true, run: () => 'The dog slinks off' } ] },
    { id: 'tinker', title: 'Wandering Smith', text: 'A smith with a pack of tools offers to improve one of your workshops.', avail: () => !!tinkerTarget(), opts: [
      { label: 'Hire the smith', sub: 'Costs 8 Iron + 10 Wood · upgrades a workshop by one level', ok: () => res.iron >= 8 && res.wood >= 10, run: () => { const t = tinkerTarget(); if (!t) return 'Nothing left to improve'; res.iron -= 8; res.wood -= 10; setBuildingLevel(t, lvOf(t) + 1); report.upgraded++; floatText(`${BUILDING_NAME[t.userData.kind]} Lv${lvOf(t)}!`, t.position.x, 3.6, t.position.z); return `${BUILDING_NAME[t.userData.kind]} upgraded`; } },
      { label: 'Send the smith away', alt: true, run: () => 'The smith shoulders his pack' } ] },
    { id: 'trainer', title: 'Master Craftsman', text: 'A retired craftsman offers to teach your workers a few tricks for a hot meal.', avail: () => citizens().some(n => jobKind(n)), opts: [
      { label: 'Share a meal', sub: 'Costs 10 Food · every working citizen gains 2 experience', ok: () => res.food >= 10, run: () => { res.food -= 10; citizens().forEach(n => { const k = jobKind(n); if (k) { addXp(n, k); addXp(n, k); } }); return 'Your workers pick up new tricks'; } },
      { label: 'Politely decline', alt: true, run: () => 'The craftsman moves on' } ] },
    { id: 'storm', title: 'Storm Damage', text: 'A storm in the night has loosened planks along your walls.', avail: () => obstacles.some(o => o.userData.type === 'fence'), opts: [
      { label: 'Brace the walls', sub: 'Costs 10 Wood', ok: () => res.wood >= 10, run: () => { res.wood -= 10; return 'The walls hold firm'; } },
      { label: 'Hope for the best', sub: 'Several wall pieces are damaged', alt: true, run: () => { const f = obstacles.filter(o => o.userData.type === 'fence').sort(() => Math.random() - 0.5).slice(0, 6); f.forEach(o => { o.userData.hp = Math.max(1, o.userData.hp * 0.5); }); return 'Some planks are cracked - repairs are needed'; } } ] },
    { id: 'harvest', title: 'Bountiful Harvest', text: 'The fields are heavy with grain this autumn.', avail: () => season().id === 'autumn', opts: [
      { label: 'Store it all', sub: '+25 Food', run: () => { res.food += 25; return 'The granary is full'; } },
      { label: 'Hold a harvest festival', sub: '+10 Food · everyone +10 mood', run: () => { res.food += 10; moodAll(10); return 'A merry festival'; } } ] },
    { id: 'drought', title: 'Dry Spell', text: 'Weeks without rain have cracked the fields.', avail: () => season().id === 'summer' && builtBuildings('farm').length > 0, opts: [
      { label: 'Dig irrigation channels', sub: 'Costs 8 Wood', ok: () => res.wood >= 8, run: () => { res.wood -= 8; return 'Water reaches the crops'; } },
      { label: 'Wait for rain', sub: 'Lose 15 Food to spoilage', alt: true, run: () => { res.food = Math.max(0, res.food - 15); return 'The crops wither a little'; } } ] },
    { id: 'lights', title: 'Strange Lights', text: 'Pale lights drift over the hills at dawn. Something is out there.', avail: () => dayNow() >= 3, opts: [
      { label: 'Follow the lights', sub: 'A reward - and 2 more raiders tonight', run: () => { pendingRaiders += 2; if (story.beacon) { res.shard++; res.iron += 6; return 'You find a glowing shard and some iron'; } res.wood += 12; res.stone += 4; return 'You find a cache of wood and stone'; } },
      { label: 'Stay inside', alt: true, run: () => 'The lights fade with the sun' } ] },
    { id: 'deserter', title: 'Deserter', text: 'A soldier in torn armor asks to join your village.', avail: () => npcs.length < maxPop() && builtBuildings('house').length > 0, opts: [
      { label: 'Take them in', sub: 'Costs 5 Food · joins as a melee soldier', ok: () => res.food >= 5, run: () => { res.food -= 5; const k = spawnCitizens(1), c = npcs[npcs.length - 1]; if (k && c) setRole(c, 'melee'); return k ? 'A new soldier joins you' : 'No room for them'; } },
      { label: 'Turn them away', alt: true, run: () => 'The soldier trudges away' } ] },
    { id: 'lost', title: 'Lost Child', text: 'A child wanders in from the woods, hungry and alone.', avail: () => npcs.length < maxPop() && builtBuildings('house').length > 0, opts: [
      { label: 'Look after the child', sub: 'Costs 4 Food · a new citizen, everyone +6 mood', ok: () => res.food >= 4, run: () => { res.food -= 4; const k = spawnCitizens(1); moodAll(6); return k ? 'The child is welcomed' : 'No room, but hearts are warmed'; } },
      { label: 'Send word to other villages', alt: true, run: () => 'Someone will come for the child' } ] },
    { id: 'tax', title: 'Tax Collector', text: 'A royal tax collector has heard of your wealth.', avail: () => prosScore >= 45, opts: [
      { label: 'Pay 20 Wood', ok: () => res.wood >= 20, run: () => { res.wood -= 20; return 'The collector is satisfied'; } },
      { label: 'Pay 12 Stone', ok: () => res.stone >= 12, run: () => { res.stone -= 12; return 'The collector is satisfied'; } },
      { label: 'Refuse', sub: 'Everyone -10 mood · 2 more raiders tonight', alt: true, run: () => { moodAll(-10); pendingRaiders += 2; return 'The collector storms off, muttering threats'; } } ] },
    { id: 'rats', title: 'Rats in the Stores', text: 'Droppings and gnawed sacks - rats have found your food.', avail: () => res.food >= 20, opts: [
      { label: 'Set traps', sub: 'Costs 6 Wood', ok: () => res.wood >= 6, run: () => { res.wood -= 6; return 'The traps do their work'; } },
      { label: 'Ignore it', sub: 'Lose a quarter of your food', alt: true, run: () => { res.food = Math.floor(res.food * 0.75); return 'The rats feast'; } } ] },
    { id: 'comet', title: 'Falling Star', text: 'A streak of fire crossed the sky last night and landed in the hills.', opts: [
      { label: 'Search the crater', sub: '+4 Iron (and a shard if the Beacon is lit)', run: () => { res.iron += 4; if (story.beacon) res.shard++; return 'You pull glowing metal from the crater'; } },
      { label: 'Leave it', alt: true, run: () => 'Better not to touch it' } ] },
    { id: 'pilgrims', title: 'Pilgrims', text: 'A band of pilgrims on their way to a distant shrine asks for a meal.', avail: () => citizens().length > 0, opts: [
      { label: 'Give 10 Food', sub: 'Everyone +15 mood · the sick recover', ok: () => res.food >= 10, run: () => { res.food -= 10; moodAll(15); npcs.forEach(n => { n.sick = 0; }); return 'Their blessing eases every heart'; } },
      { label: 'Send them on', alt: true, run: () => 'The pilgrims walk on' } ] },
    { id: 'scout', title: 'Scout\'s Warning', text: 'A scout reports movement in the dark beyond your walls.', avail: () => dayNow() >= 2, opts: [
      { label: 'Reinforce the gate', sub: 'Costs 12 Wood · tonight\'s attack is 25% smaller', ok: () => res.wood >= 12, run: () => { res.wood -= 12; nightEase = true; return 'The gate is ready'; } },
      { label: 'Trust your walls', alt: true, run: () => 'You wave the scout off' } ] },
    { id: 'toll', title: 'Bandit Toll', text: 'Bandits block the road and demand a toll to let traders pass.', avail: () => dayNow() >= 4, opts: [
      { label: 'Pay 8 Iron', ok: () => res.iron >= 8, run: () => { res.iron -= 8; return 'The road stays open'; } },
      { label: 'Refuse', sub: '4 more raiders tonight', alt: true, run: () => { pendingRaiders += 4; return 'The bandits spit and ride off'; } } ] },
    { id: 'feast', title: 'Harvest Feast', text: 'The villagers ask to hold a feast to lift everyone\'s spirits.', avail: () => citizens().length > 0, opts: [
      { label: 'Hold the feast', sub: 'Costs 12 Food · everyone recovers, +1 newcomer if there is room', ok: () => res.food >= 12, run: () => { res.food -= 12; npcs.forEach(n => { n.hungry = false; }); const k = npcs.length < maxPop() ? spawnCitizens(1) : 0; citizens().forEach(n => floatText('Feast!', n.position.x, 3.0, n.position.z)); return k ? 'A great feast! A newcomer joined' : 'A great feast! Spirits are high'; } },
      { label: 'Not now', alt: true, run: () => 'Maybe next season' } ] },
  ];
  function openEvent(ev) {
    if (dead) return;
    if (eventOpen) { eventQueue.push(ev); return; }
    eventOpen = true; repEl.classList.remove('show'); if (typeof cardNpc !== 'undefined') { cardNpc = null; document.getElementById('npcCard').style.display = 'none'; }
    document.querySelector('#eventPanel small').textContent = ev.tag || 'Morning event';
    document.getElementById('evTitle').textContent = ev.title; document.getElementById('evText').textContent = ev.text;
    evBtns.innerHTML = '';
    for (const o of ev.opts) {
      const b = document.createElement('button'); b.className = o.alt ? 'alt' : '';
      b.innerHTML = `${o.label}${o.sub ? `<small>${o.sub}</small>` : ''}`;
      b.disabled = o.ok ? !o.ok() : false;
      b.addEventListener('click', () => { const msg = o.run(); eventOpen = false; evEl.style.display = 'none'; updateHud(); updateProsperity(); if (msg) toast(msg); Snd.play('chime'); if (eventQueue.length) setTimeout(() => openEvent(eventQueue.shift()), 350); });
      evBtns.appendChild(b);
    }
    evEl.style.display = 'flex'; Snd.play('click');
  }
  // ---------- 9-2: 떠돌이 상인: 시장이 있으면 3일마다(4일차부터) 찾아와 자원을 서로 바꿔 준다. 시장 레벨이 높을수록 환율이 좋다 ----------
  let lastMerchantDay = 0;
  const MVAL = { wood: 1, stone: 1.2, food: 1, iron: 4 }, MNAME = { wood: 'Wood', stone: 'Stone', food: 'Food', iron: 'Iron' };
  const MLOTS = [{ g: 'food', n: 20, r: 'iron' }, { g: 'wood', n: 30, r: 'iron' }, { g: 'stone', n: 25, r: 'iron' }, { g: 'iron', n: 3, r: 'food' }, { g: 'iron', n: 3, r: 'wood' }, { g: 'iron', n: 3, r: 'stone' }];
  function merchantMenu(lots, rate, p) {
    openEvent({ tag: 'Travelling merchant', title: 'A Merchant Sets Up Camp', text: `Prices today are ${p > 1.1 ? 'good' : p < 0.95 ? 'poor' : 'fair'}. Trade as much as you like - the merchant leaves when you say farewell.`,
      opts: lots.map(l => {
        const get = Math.max(1, Math.round(l.n * MVAL[l.g] / MVAL[l.r] * rate));
        return { label: `Give ${l.n} ${MNAME[l.g]}`, sub: `Get ${get} ${MNAME[l.r]} · you have ${Math.floor(res[l.g])}`, ok: () => res[l.g] >= l.n,
          run: () => { if (res[l.g] < l.n) return 'Not enough to trade'; res[l.g] -= l.n; res[l.r] += get; updateHud(); report.traded = (report.traded || 0) + 1; unlockAch('merchant'); setTimeout(() => merchantMenu(lots, rate, p), 450); return `Traded: +${get} ${MNAME[l.r]}`; } };
      }).concat(npcs.some(n => n.sick > 0) ? [{ label: 'Buy healing herbs', sub: 'Costs 2 Iron · cures every sick citizen', ok: () => res.iron >= 2, run: () => { res.iron -= 2; npcs.forEach(n => { n.sick = 0; }); setTimeout(() => merchantMenu(lots, rate, p), 450); return 'The sick are on their feet again'; } }] : [])
        .concat([{ label: 'Farewell', alt: true, run: () => 'The merchant moves on' }]) });
  }
  // ---------- 교역 마차: 닷새째부터 나흘마다 강 건너편에서 다리를 건너 마을 문으로 온다. 길이 많을수록 교역이 커지고, 가끔 도적이 매복한다 ----------
  let caravan = null, caravanDay = 0, caravanDone = 0;
  const cartMat = mat(0x8a5a30), cartCover = mat(0xe8dcc4), wheelMat = mat(0x3a2a1a);
  function caravanMorning(dayNo) {
    if (dayNo >= 5 && (dayNo - 5) % 4 === 0 && caravanDone !== dayNo && builtBuildings('market').length) { caravanDay = dayNo; setTimeout(() => toast('A trade caravan is on the road - it crosses the bridge this morning'), 4200); }
  }
  function spawnCaravan() {
    const g = new THREE.Group(), body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 1.0), cartMat), cover = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.5, 8, 1, false, 0, Math.PI), cartCover);
    body.position.y = 0.6; cover.rotation.z = Math.PI / 2; cover.position.y = 1.0; g.add(body, cover);
    for (const sx of [-0.55, 0.55]) for (const sz of [-0.55, 0.55]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 10), wheelMat); w.rotation.x = Math.PI / 2; w.position.set(sx, 0.3, sz); g.add(w); }
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.04), bannerMat); flag.position.set(0, 1.9, 0); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.0, 5), wheelMat); pole.position.set(-0.25, 1.5, 0); g.add(pole, flag);
    g.traverse(m => { if (m.isMesh) m.castShadow = true; });
    const gate = gateWaypoints.slice().sort((a, b) => Math.hypot(a.x - BR.x, a.z - BR.z) - Math.hypot(b.x - BR.x, b.z - BR.z))[0];
    const goal = gate ? { x: gate.x + gate.nx * 4, z: gate.z + gate.nz * 4 } : { x: BR.x * 0.2, z: BR.z * 0.2 };
    const far = { x: BR.ux * (TERR.riverR + 12), z: BR.uz * (TERR.riverR + 12) }, pts = [far, { x: BR.x + BR.ux * 8, z: BR.z + BR.uz * 8 }, { x: BR.x - BR.ux * 8, z: BR.z - BR.uz * 8 }, goal];
    g.position.set(far.x, actorH(far.x, far.z), far.z); scene.add(g);
    caravan = { g, pts, i: 1, hp: 70, maxHp: 70, wait: 0, back: false, amb: Math.random() < 0.4, ambDone: false, road: Math.min(1.5, 1 + (story.roads || []).length / 80) };
    caravanDone = caravanDay; toast('Caravan sighted by the river');
  }
  function endCaravan(ok) { if (!caravan) return; scene.remove(caravan.g); caravan = null; if (!ok) toast('The caravan was lost'); }
  function caravanTick(dt) {
    const h = (gameMin / 60) % 24;
    if (!caravan && caravanDay && caravanDay === dayNow() && h >= 8 && h < 16 && !exActive && !dead && caravanDone !== caravanDay) spawnCaravan();
    if (!caravan) return;
    const c = caravan; if (exActive || dead) return;
    if (h >= 18 || h < 6) { endCaravan(true); return; }
    if (c.hp <= 0) { burst(c.g.position, 20); endCaravan(false); return; }
    if (c.amb && !c.ambDone && c.i >= 2) {                               // 매복: 다리를 건넌 뒤 도적 3~4명이 길목에서 튀어나온다
      c.ambDone = true; const n = 3 + Math.floor(dayNow() / 10), p = c.g.position;
      for (let k = 0; k < n; k++) { spawnEnemy('normal', { x: p.x + BR.ux * 9 + rand(-3, 3), z: p.z + BR.uz * 9 + rand(-3, 3) }); const b = enemies[enemies.length - 1]; b.userData.ex = false; b.userData.amb = true; b.userData.keepDay = true; b.userData.aggro = true; frostTint(b, 'ash'); }
      showWarning('Bandits ambush the caravan!');
    }
    if (c.wait > 0) { c.wait -= dt; if (c.wait <= 0) { c.back = true; c.i = c.pts.length - 2; } return; }
    const tgt = c.pts[c.i], p = c.g.position, dx = tgt.x - p.x, dz = tgt.z - p.z, d = Math.hypot(dx, dz);
    const stopped = enemies.some(e => e.userData.amb && !e.userData.sinking && Math.hypot(e.position.x - p.x, e.position.z - p.z) < 3.2);       // 도적이 붙으면 멈춘다
    if (d > 0.5 && !stopped) { const sp = 2.6 * terrSpd(p.x, p.z) * dt; p.x += dx / d * sp; p.z += dz / d * sp; c.g.rotation.y = Math.atan2(dx, dz) + Math.PI / 2; p.y = actorH(p.x, p.z); }
    if (d <= 0.5) {
      if (!c.back && c.i === c.pts.length - 1) {                           // 도착: 교역
        const day = dayNow(), k = c.road, iron = Math.round((6 + day * 0.6) * k), food = Math.round((10 + day) * k), gold = story.beacon ? 1 + (k > 1.25 ? 1 : 0) : 0;
        res.iron += iron; res.food += food; res.shard += gold; updateHud(); giveXp(15 + day);
        floatText(`Caravan: +${iron} Iron, +${food} Food${gold ? ', +' + gold + ' Shard' : ''}`, p.x, 3.2, p.z); toast(`The caravan traded: +${iron} Iron, +${food} Food${gold ? `, +${gold} Shard` : ''}${k > 1.2 ? ' (busy roads pay well)' : ''}`); Snd.play('chime');
        report.season = (report.season ? report.season + ' | ' : '') + 'Caravan trade completed'; c.wait = 4;
      } else if (c.back && c.i === 0) { endCaravan(true); return; }
      else c.i += c.back ? -1 : 1;
    }
  }
  function merchantVisit(dayNo) {
    if (!builtBuildings('market').length || dayNo < 4 || (dayNo - 4) % 3 !== 0 || lastMerchantDay === dayNo) return;
    lastMerchantDay = dayNo;
    const p = 0.85 + Math.random() * 0.4, rate = 0.9 * p * (1 + 0.1 * (bLevel('market') - 1));
    const sells = MLOTS.slice(0, 3), buys = MLOTS.slice(3), pick = (a) => a.splice(Math.floor(Math.random() * a.length), 1)[0];
    const lots = [pick(sells), pick(sells), pick(buys), pick(buys)];
    setTimeout(() => merchantMenu(lots, rate, p), 3600);
  }
  const recentEv = [];
  function rollEvent(dayNo) {
    if (dayNo < 2 || Math.random() > 0.65) return;
    let pool = EVENTS.filter(e => (!e.avail || e.avail()) && !recentEv.includes(e.id));      // 최근 3번 나온 이벤트는 제외
    if (!pool.length) pool = EVENTS.filter(e => !e.avail || e.avail());
    if (pool.length) { const ev = pool[Math.floor(Math.random() * pool.length)]; recentEv.push(ev.id); if (recentEv.length > 3) recentEv.shift(); setTimeout(() => openEvent(ev), 1500); }
  }
  // ---------- 9단계: 건물 레벨 (농장·벌목장·채석장·대장간·시장·우물): 시대가 올라가면 매일 아침 여유 자원으로 한 채씩 ----------
  const bLevel = (kind) => builtBuildings(kind).reduce((a, o) => Math.max(a, o.userData.level || 1), 0);
  const lvOf = (o) => o.userData.level || 1;
  const bannerMat = mat(0xd9a92a);
  function setBuildingLevel(o, lv) {            // 레벨 2부터 모서리에 깃발이 서고, 레벨만큼 삼각기가 늘어난다
    o.userData.level = lv;
    if (o.userData.banner) { o.remove(o.userData.banner); o.userData.banner = null; }
    if (lv < 2) return;
    const b = new THREE.Group(), sz = CFG.BUILDING[o.userData.kind].size, r = o.userData.radius;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), woodMat2); pole.position.y = 1.3; b.add(pole);
    for (let i = 0; i < lv - 1; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.26, 0.04), bannerMat); f.position.set(0.3, 2.3 - i * 0.34, 0); b.add(f); }
    b.position.set(sz ? sz[0] / 2 + 0.3 : r + 0.3, 0, sz ? sz[2] / 2 : r * 0.7);
    b.traverse(m => { if (m.isMesh) m.castShadow = true; });
    o.add(b); o.userData.banner = b;
  }
  function upgradeBuildings() {
    let n = 0;
    for (const kind of CFG.LEVELED) for (const o of builtBuildings(kind)) {
      const lv = lvOf(o), cost = CFG.BUILD_UPGRADE[lv + 1];
      if (n >= CFG.BUILD_UPGRADES_PER_MORNING || lv >= stage || !cost) continue;
      if (!Object.entries(cost).every(([k, v]) => res[k] >= v * 1.5)) continue;
      payCost(cost); setBuildingLevel(o, lv + 1); n++; report.upgraded++;
      dust(o.position.x, o.position.z); sfxAt('build', o.position.x, o.position.z); floatText(`${BUILDING_NAME[kind]} Lv${lv + 1}!`, o.position.x, 3.6, o.position.z);
    }
    if (n) updateHud();
  }
  // ---------- 9단계: 직업 / 숙련도 ----------
  const jobKind = (n) => (n.work && obstacles.includes(n.work) ? n.work.userData.kind : null);
  const skillLv = (n, k) => { const x = (n.xp && n.xp[k]) || 0; let l = 0; CFG.SKILL_XP.forEach((v, i) => { if (x >= v) l = i; }); return l; };
  const likesJob = (n, k) => CFG.TRAIT_JOB[n.trait] === k;
  function addXp(n, k) {
    if (!n.xp) n.xp = {};
    const before = skillLv(n, k); n.xp[k] = (n.xp[k] || 0) + 1;
    if (skillLv(n, k) > before) floatText(`${CFG.JOBS[k]}: ${CFG.SKILL_NAMES[skillLv(n, k)]}!`, n.position.x, 3.2, n.position.z);
  }
  // 작업반장: 마을이 커지면(5명 이상) 경험이 가장 많은 사람이 반장이 된다. 반장은 일이 25% 빠르고, 반장이 살아 있으면 나머지도 12% 빨라진다
  function assignForeman() {
    for (const n of npcs) n.foreman = false;
    const pool = npcs.filter(n => !n.down && !n.promote && !n.escort); if (pool.length < 5) return;
    let best = null, bs = -1; for (const n of pool) { const s = Object.values(n.xp || {}).reduce((a, b) => a + b, 0) + (n.vxp || 0) * 0.5; if (s > bs) { bs = s; best = n; } }
    if (best) { best.foreman = true; if (!story.foreman) { story.foreman = true; setTimeout(() => toast(`${best.name} has become the foreman: building and repairs go faster`), 2500); } }
  }
  const jobTitle = (n) => { if (n.foreman) return 'Foreman'; const k = jobKind(n); return k ? `${CFG.JOBS[k]} (${CFG.SKILL_NAMES[skillLv(n, k)]})` : 'Laborer'; };
  const PREF_LABEL = (p) => p === 'free' ? 'Laborer' : p ? CFG.JOBS[p] : 'Auto';
  function nextPref(n) {                           // 카드 버튼: Auto → (지어진 일터 종류들) → Laborer → Auto
    const opts = [null, ...Object.keys(CFG.JOBS).filter(k => builtBuildings(k).length), 'free'];
    const i = opts.indexOf(n.pref || null);
    n.pref = opts[(i + 1) % opts.length];
    if (n.work && (n.pref === 'free' || (n.pref && jobKind(n) !== n.pref))) { n.work.userData.worker = null; n.work = null; n.wstate = 'seek'; n.carry = 0; }
  }

  // 질병: 겨울·굶주림·불만·집 부족이면 아침마다 시민이 앓을 수 있다. 우물이 확률을 낮추고(레벨이 높을수록 더), 며칠 지나면 낫는다. 상인에게서 약초를 살 수도 있다
  let lastSeasonId = null;
  // 엔딩(보스 처치) 이후 무한 모드: 5일마다 이정표 보상
  function endlessMilestone(dayNo) {
    if (!chapterCleared || dayNo <= CFG.BOSS_DAY || dayNo % 5 !== 0 || (story.ms && story.ms[dayNo])) return;
    (story.ms || (story.ms = {}))[dayNo] = 1; giveXp(60 + dayNo * 2); res.iron += 10 + dayNo; if (story.beacon) res.shard++; updateHud();
    report.season = `Endless milestone: Day ${dayNo} survived! (+${10 + dayNo} Iron${story.beacon ? ', +1 Shard' : ''}, XP)`;
  }
  // 낚시: 마을 사람들이 강에서 물고기를 잡아 온다 (겨울에는 얼음 낚시라 절반). 시민 3명당 식량 1 + 기본 1
  function fishingTick(dayNo) {
    const folks = npcs.filter(n => n.role === 'citizen' && !n.down).length; if (folks < 2) return 0;
    const f = Math.max(1, Math.floor((1 + Math.floor(folks / 3)) * (seasonOfDay(dayNo).id === 'winter' ? 0.5 : 1))); res.food += f;
    report.season = (report.season ? report.season + ' | ' : '') + `Fishers brought ${f} food from the river`; return f;
  }
  function seasonTick(dayNo) {
    const s = seasonOfDay(dayNo);
    if (s.id !== lastSeasonId) { const first = lastSeasonId === null; lastSeasonId = s.id; if (CFG.SEASONS_ON && (!first || dayNo > 1)) { report.season = s.msg; setTimeout(() => toast(s.msg), 4200); } }
  }
  function rollSickness(dayNo) {
    if (!CFG.SICK_ON) return;
    const cs = citizens(), wellMul = builtBuildings('well').length ? (bLevel('well') >= 3 ? 0.35 : 0.5) : 1, houses = builtBuildings('house').length;
    for (const c of cs) if (c.sick > 0) {                          // 회복: 하루 지날 때마다 1일 줄고, 0이 되면 완치
      c.sick -= wellMul < 1 ? 2 : 1;
      if (c.sick <= 0) { c.sick = 0; report.healed.push(c.name); }
    }
    if (dayNo < 2) return;
    const cap = Math.max(1, Math.ceil(cs.length * 0.35)); let n = 0;
    for (const c of cs.slice().sort(() => Math.random() - 0.5)) {
      if (n >= cap || c.sick > 0) continue;
      const p = (season().sick + (c.hungry ? 0.15 : 0) + (c.mood < CFG.MOOD_UNHAPPY ? 0.1 : 0) + (houses < cs.length ? 0.04 : 0)) * wellMul * (c.trait === 'stout' ? 0.6 : 1);
      if (Math.random() < p) { c.sick = CFG.SICK_DAYS + 1; n++; report.ill.push(c.name); }
    }
  }
  // ---------- 집 업그레이드: 시대가 올라도 한 번에 바뀌지 않고, 매일 아침 여유 자원으로 한두 채씩 ----------
  function upgradeHouses() {
    let n = 0;
    for (const h of builtBuildings('house')) {
      const lv = h.userData.level || 1, cost = CFG.HOUSE_UPGRADE[lv + 1];
      if (n >= CFG.HOUSE_UPGRADES_PER_MORNING || lv >= stage || !cost) continue;
      if (!Object.entries(cost).every(([k, v]) => res[k] >= v * 1.5)) continue;     // 여유가 있을 때만 (비축분을 다 쓰지 않는다)
      payCost(cost); h.userData.level = lv + 1; setHouseModel(h); n++; report.upgraded++;
      dust(h.position.x, h.position.z); sfxAt('build', h.position.x, h.position.z); floatText('House upgraded!', h.position.x, 3.6, h.position.z);
    }
    if (n) updateHud();
  }
  const maxPop = () => (story.wide ? 2 : 0) + CFG.BASE_POP + builtBuildings('house').length + builtBuildings('well').length + ((hasPerk('steward') || hasPerk('crown')) ? 1 : 0) + prosBonus;      // 거주지 1채당 최대 인구 +1, 번영도가 높으면 이주민 추가
  const countRole = (r) => npcs.filter(n => n.role === r).length;
  const popEl = document.getElementById('popN'), popJobsEl = document.getElementById('popJobs');
  function updatePopUi() {
    const a = `${npcs.length} / ${maxPop()}`, b = `(Citizens: ${countRole('citizen')} | Melee: ${countRole('melee')} | Archers: ${countRole('archer')}${npcs.some(n => n.hungry) ? ` | Hungry: ${npcs.filter(n => n.hungry).length}` : ''})`;
    if (popEl.textContent !== a) popEl.textContent = a;
    if (popJobsEl.textContent !== b) popJobsEl.textContent = b;
  }
  function setRole(n, role) {              // 직업 변경(전직): 색, 체력, 집 위치 갱신
    n.role = role; n.archer = role === 'archer'; n.baseColor = ROLE[role].color; n.maxHp = npcMaxHp(role, n.trait); n.hp = n.maxHp;
    n.mat.color.set(n.baseColor); n.promote = null; n.born = 'citizen';
    if (n.work) { n.work.userData.worker = null; n.work = null; }          // 전직하면 일터를 떠난다
    applyCitizenLook(n); assignWarband(n);
    n.home = homeSlot(npcs.filter(x => x.role !== 'citizen').length);
    n.labelText = ''; n.hungry = false;          // 병사는 배급 대상이 아니므로 굶주림 해제
    applyGear(n);
    dust(n.position.x, n.position.z);
  }
  // 매일 아침: 인구가 최대 인구보다 적으면 완성된 거주지 앞에서 시민 스폰 → 병영/사격장이 있으면 시민 1명씩 전직 훈련
  function morningTown() {
    const houses = builtBuildings('house'), fresh = [];
    let guard = 0;
    while (houses.length && npcs.length < maxPop() && guard++ < 20) {
      const h = houses[npcs.length % houses.length], door = doorOf(h);
      const c = makeNpc('citizen', door, 'citizen', fresh.length * 0.15);
      c.position.set(door.x, 0, door.z);
      fresh.push(c);
    }
    report.newCit += fresh.length;
    if (fresh.length) toast(`${fresh.length} new citizen${fresh.length > 1 ? 's' : ''} arrived in the village`);
    const pool = fresh.concat(npcs.filter(n => n.role === 'citizen' && !fresh.includes(n) && !n.promote));
    const barracks = builtBuildings('barracks')[0], range = builtBuildings('range')[0];
    let sc = soldierCount(); const cap = soldierCap();                         // 병사 수 상한: 병영·사격장이 많을수록 늘어난다
    if (barracks && pool.length && sc < cap) { pool.shift().promote = { to: 'melee', target: barracks }; sc++; }
    if (range && pool.length && sc < cap) { pool.shift().promote = { to: 'archer', target: range }; sc++; }
    if (sc >= cap && (barracks || range)) setTimeout(() => toast(`Soldier limit reached (${cap}): build more barracks or archery ranges`), 2500);
  }
  // 전직 이동: 해당 건물 앞까지 걸어가면 직업 변경. 진행 중이면 true
  function promoteStep(dt) {
    const pr = npc.promote, b = pr.target;
    if (!obstacles.includes(b)) { npc.promote = null; return false; }
    const door = doorOf(b);
    if (npcMove(door.x, door.z, 3.5, dt) < 1.6) {
      setRole(npc, pr.to);
      toast(pr.to === 'melee' ? 'A citizen became a melee soldier!' : 'A citizen became an archer!');
      return false;
    }
    return true;
  }
  // ---------- 경제 건물: 시민이 정착해서 일한다 ----------
  const isWorksite = (o) => o.userData.type === 'building' && (o.userData.kind === 'smith' || o.userData.kind === 'farm' || o.userData.kind === 'lumber' || o.userData.kind === 'quarry');
  function claimWorksite() {
    const free = obstacles.filter(o => isWorksite(o) && !(o.userData.worker && npcs.includes(o.userData.worker)));
    let pool = free.filter(o => o.userData.kind !== 'smith' || npc.pref === 'smith');           // 대장간은 다른 일터가 모두 찼을 때(또는 지정했을 때) 배정한다
    const want = npc.pref && npc.pref !== 'free' ? free.filter(o => o.userData.kind === npc.pref) : [];
    if (want.length) pool = want; else if (!pool.length) pool = free;
    const foodLow = res.food < npcs.filter(n => n.role === 'citizen').length * CFG.RATION * 2;
    let best = null, bs = Infinity;
    for (const o of pool) {
      const k = o.userData.kind, d = Math.hypot(o.position.x - npc.position.x, o.position.z - npc.position.z);
      const s = d - (likesJob(npc, k) ? 12 : 0) - (k === 'farm' && foodLow ? 25 : 0);          // 성격에 맞는 일터와, 식량이 모자랄 때의 농장을 우선한다
      if (s < bs) { bs = s; best = o; }
    }
    if (best) { best.userData.worker = npc; npc.work = best; npc.wstate = 'seek'; npc.carry = 0; npc.wtarget = null; npc.farmT = 0; npc.workT = 0; }
    return best;
  }
  function autoForge(site) {
    const soldiers = npcs.filter(n => n.role !== 'citizen');
    let best = null;
    for (const [id, d] of Object.entries(CFG.GEAR)) {
      if (!d.cost || (d.stage || 1) > stage || (d.req && !story[d.req]) || (site.userData.stock[id] || 0) > 0 || npcs.some(n => n.carryGear === id) || !canPay(gearCost(d))) continue;
      const need = soldiers.some(n => (d.slot === 'armor' || d.slot === (n.role === 'melee' ? 'sword' : 'bow')) && d.tier > gearDef(n.gear[d.slot]).tier);
      if (need && (!best || d.tier < best.tier)) best = d;                         // 낮은 등급부터 차례로
    }
    if (!best) return;
    payCost(gearCost(best)); site.userData.stock[best.id] = (site.userData.stock[best.id] || 0) + 1; refreshRack(site); updateHud();
    forgeEffect(site); report.forged++; floatText(`Forged ${best.name}`, site.position.x, 3.4, site.position.z);
  }
  function workStep(dt) {
    if (npc.work && !obstacles.includes(npc.work)) npc.work = null;
    if (npc.pref === 'free') { if (npc.work) { npc.work.userData.worker = null; npc.work = null; } return false; }         // 플레이어가 '잡일'로 지정: 일터 없이 건설·수리·채집을 한다
    if (!npc.work && !claimWorksite()) return false;
    if (npc.task) { setTask(null); npc.workT = 0; }
    const site = npc.work, k = site.userData.kind;
    npc.bobAmt = 0;
    const wdt = dt * workMul(npc) * (1 + CFG.SKILL_BONUS * skillLv(npc, k)) * (likesJob(npc, k) ? 1.1 : 1);        // 굶주림·성격·기분·숙련도·성격 적성이 작업 효율을 정한다
    if (k === 'smith') {                                        // 대장간 시민: 모루 앞에서 망치질하며 병사에게 필요한 장비를 주기적으로 자동 제작
      const door = doorOf(site);
      if (Math.hypot(door.x - npc.position.x, door.z - npc.position.z) > 1.2) { npcMove(door.x, door.z, 3.5, dt); npc.stateLabel = 'To smithy'; return true; }
      npc.face = Math.atan2(site.position.x - npc.position.x, site.position.z - npc.position.z); npc.rotation.y = npc.face;
      npc.stateLabel = 'Forging'; npc.forgeT = (npc.forgeT || 0) + wdt * ((nowHour >= 18 || nowHour < 6) ? 1.5 : 1);
      if (npc.forgeT >= CFG.FORGE_CYCLE * (hasPerk('smith') ? 0.6 : 1) * (1 - 0.2 * (lvOf(site) - 1))) { npc.forgeT = 0; autoForge(site); addXp(npc, 'smith'); }
      return true;
    }
    if (k === 'farm') {                                         // 농장: 밭에 서서 작물을 키우고 주기마다 식량 수확
      if (Math.hypot(site.position.x - npc.position.x, site.position.z - npc.position.z) > 1.8) { npcMove(site.position.x, site.position.z, 3.5, dt); npc.stateLabel = 'To farm'; return true; }
      npc.farmT += wdt; npc.bobAmt = Math.abs(Math.sin(npc.farmT * 6)) * 0.12; npc.stateLabel = 'Farming';
      site.userData.growth = 0.3 + 0.7 * Math.min(1, npc.farmT / CFG.FARM_CYCLE);
      for (const c of site.userData.crops) c.scale.y = site.userData.growth;
      if (npc.farmT >= CFG.FARM_CYCLE) {
        npc.farmT = 0; const fy = Math.max(1, Math.round((CFG.FARM_YIELD + (lvOf(site) - 1)) * season().farm)); res.food += fy; updateHud(); addXp(npc, 'farm');
        floatText(`Food +${fy}`, site.position.x, 2.2, site.position.z);
      }
      return true;
    }
    const type = k === 'lumber' ? 'wood' : 'stone', door = doorOf(site);          // 벌목장/채석장: 주변 자원을 캐서 건물로 가져와 쌓는다
    if (npc.wstate === 'carry') {
      npc.stateLabel = 'Hauling';
      if (npcMove(door.x, door.z, 3.8, dt) < 2.0) { res[type] += npc.carry; npc.carry = 0; npc.wstate = 'seek'; npc.wtarget = null; updateHud(); addXp(npc, k); }
      return true;
    }
    if (!npc.wtarget || !obstacles.includes(npc.wtarget) || (npc.wtarget.userData.owner && npc.wtarget.userData.owner !== npc && npcs.includes(npc.wtarget.userData.owner))) {
      npc.wtarget = null;
      let bd = Infinity;
      for (const o of obstacles) {
        if (o.userData.type !== type || !unclaimed(o)) continue;
        const d = Math.hypot(o.position.x - site.position.x, o.position.z - site.position.z);
        if (d < CFG.WORK_RADIUS && d < bd) { bd = d; npc.wtarget = o; }
      }
      if (npc.wtarget) { npc.wtarget.userData.owner = npc; npc.workT = 0; }
    }
    if (!npc.wtarget) { npc.stateLabel = 'Idle'; npcMove(door.x, door.z, 3.5, dt); return true; }
    const o = npc.wtarget, stop = o.userData.radius + PLAYER_R + 0.3;
    npc.stateLabel = k === 'lumber' ? 'Chopping' : 'Quarrying';
    if (Math.hypot(o.position.x - npc.position.x, o.position.z - npc.position.z) > stop) { npcMove(o.position.x, o.position.z, 3.8, dt); npc.workT = 0; return true; }
    npc.workT += wdt; npc.bobAmt = Math.abs(Math.sin(npc.workT * 14)) * 0.15;
    if (npc.workT >= CFG.GATHER_TIME) {
      scene.remove(o); obstacles.splice(obstacles.indexOf(o), 1); rollIron(o);
      npc.carry = Math.round(gatherYield(type) * CFG.WORKSITE_YIELD_MULT * (1 + 0.4 * (lvOf(site) - 1)) * (hasPerk('merchant') ? 1.25 : 1)); npc.wstate = 'carry'; npc.wtarget = null; npc.workT = 0;
    }
    return true;
  }
  // 평화로운 밤(주변에 적이 없음): 시민은 흩어지지 않고 모닥불 둘레에 둥글게 모여 앉는다
  const faceFire = () => { npc.face = Math.atan2(-npc.position.x, -npc.position.z); npc.rotation.y = npc.face; };
  // 성문 경비: 밤에 적이 없을 때 근접 병사 일부가 성문 안쪽에 서서 지킨다 (성문 하나당 1명)
  function sentryPost(n) {
    if (n.role !== 'melee' || !gateWaypoints.length) return null;
    const melees = npcs.filter(x => x.role === 'melee'), i = melees.indexOf(n);
    if (i < 0 || i >= gateWaypoints.length) return null;
    const g = gateWaypoints[i], sgn = Math.hypot(g.x - g.nx * 3, g.z - g.nz * 3) < Math.hypot(g.x + g.nx * 3, g.z + g.nz * 3) ? 1 : -1;
    return { x: g.x - g.nx * 3 * sgn, z: g.z - g.nz * 3 * sgn };
  }
  const faceTo = (x, z) => { npc.face = Math.atan2(x - npc.position.x, z - npc.position.z); npc.rotation.y = npc.face; };
  // 집·병영이 생긴 뒤(2시대~)에는 모닥불(회관) 둘레가 아니라, 시민은 각자 집 앞 계단에, 병사는 병영·사격장 앞에 앉아 쉰다. 점심은 시장·우물 앞.
  function restSpot(n, purpose) {
    if (stage < 2) return null;
    const cits = npcs.filter(x => x.role === 'citizen'), sold = npcs.filter(x => x.role !== 'citizen');
    let b = null, slot = 0;
    if (n.role === 'citizen') {
      const houses = builtBuildings('house'), i = Math.max(0, cits.indexOf(n));
      if (purpose === 'lunch') b = builtBuildings('market')[0] || builtBuildings('well')[0];
      if (b) slot = i; else if (houses.length) { b = houses[i % houses.length]; slot = Math.floor(i / houses.length); }
    } else {
      b = builtBuildings(n.role === 'melee' ? 'barracks' : 'range')[0] || builtBuildings('barracks')[0] || builtBuildings('house')[0];
      slot = Math.max(0, sold.filter(x => x.role === n.role).indexOf(n));
    }
    if (!b) return null;
    const d = doorOf(b), len = Math.hypot(d.x, d.z) || 1, ux = d.x / len, uz = d.z / len;
    const lat = ((slot % 4) - 1.5) * 1.1, out = 0.9 + Math.floor(slot / 4) * 1.0;
    return { x: d.x + ux * out - uz * lat, z: d.z + uz * out + ux * lat, fx: b.position.x, fz: b.position.z };
  }
  const seatSpot = () => {                       // 모닥불 둘레 좌석 (시민마다 고유한 각도)
    const mates = npcs.filter(x => x.role === 'citizen'), k = Math.max(1, mates.length), i = Math.max(0, mates.indexOf(npc));
    const r = FIRE_R + 1.9, a = Math.PI / 4 + i / k * Math.PI * 2;
    return { x: Math.cos(a) * r, z: Math.sin(a) * r };
  };
  function citizenRest(dt) {
    const rs = restSpot(npc, 'night'), sp = rs || seatSpot();
    npc.hidden = false;
    if (npcMove(sp.x, sp.z, 3.6, dt) < 0.35) { if (rs) faceTo(rs.fx, rs.fz); else faceFire(); return 'Resting'; }
    return rs ? 'Heading home' : 'To the fire';
  }
  // 시민의 하루 루틴: 아침 물 긷기(우물) → 일 → 정오 점심 휴식(모닥불 곁) → 일 → 저녁 귀가(거주지 앞). 일하는 시간을 조금 쓰는 대신 마을에 생활감이 생긴다
  function routineStep(dt, hour) {
    let spot, label, lrs = null;
    if (hour >= 6 && hour < 7) { const w = builtBuildings('well')[0]; if (!w) return null; spot = doorOf(w); label = 'water'; }
    else if (hour >= 12 && hour < 13) { lrs = restSpot(npc, 'lunch'); spot = lrs || seatSpot(); label = 'lunch'; }
    else if (hour >= 17 && hour < 18) {
      let h = null, bd = Infinity;
      for (const x of builtBuildings('house')) { const d = (x.position.x - npc.position.x) ** 2 + (x.position.z - npc.position.z) ** 2; if (d < bd) { bd = d; h = x; } }
      if (!h) return null; spot = doorOf(h); label = 'home';
    } else return null;
    if (npc.task) { setTask(null); npc.workT = 0; }
    const d = npcMove(spot.x, spot.z, 3.6, dt);
    if (label === 'lunch') { if (d < 0.35) { if (lrs) faceTo(lrs.fx, lrs.fz); else faceFire(); return 'Lunch break'; } return 'To lunch'; }
    if (label === 'water') return d < 1.0 ? 'Drawing water' : 'To the well';
    return d < 1.0 ? 'At home' : 'Heading home';
  }
  // 병사: 대장간 선반에 완성된 상위 장비가 있으면 걸어가서 직접 수령(Equip)한다
  function returnGear(n) { if (n.carryGear) { const sm = builtBuildings('smith')[0]; if (sm) { sm.userData.stock[n.carryGear] = (sm.userData.stock[n.carryGear] || 0) + 1; refreshRack(sm); } n.carryGear = null; } }
  function gearFetchStep(dt) {
    if (npc.role === 'citizen') return false;
    const sm = builtBuildings('smith')[0];
    if (!sm) { npc.carryGear = null; return false; }
    if (!npc.carryGear) {
      let best = null, bt = -1;
      for (const id in sm.userData.stock) {
        const d = gearDef(id), cs = npc.cls === 'greatsword' ? 'great' : npc.cls === 'spear' ? 'spear' : 'sword', slotOk = d.slot === 'armor' || (npc.role === 'melee' ? (d.slot === 'sword' || d.slot === cs) : d.slot === 'bow');
        const have = d.slot === 'armor' ? gearDef(npc.gear.armor).tier : npc.role === 'melee' ? soldierWeaponDef(npc).tier : gearDef(npc.gear.bow).tier;
        if (sm.userData.stock[id] > 0 && slotOk && d.tier > have && d.tier > bt) { best = id; bt = d.tier; }
      }
      if (!best) return false;
      sm.userData.stock[best]--; npc.carryGear = best; refreshRack(sm);          // 수령 예약 (다른 병사와 중복 방지)
      if (npc.task) { setTask(null); npc.workT = 0; }
    }
    const door = doorOf(sm);
    if (npcMove(door.x, door.z, 4, dt) < 1.5) {
      const d = gearDef(npc.carryGear);
      npc.gear[d.slot] = npc.carryGear; npc.carryGear = null; applyGear(npc); report.equipped++;
      floatText(`Equipped ${d.name}!`, npc.position.x, 2.9, npc.position.z); dust(npc.position.x, npc.position.z); sfxAt('chime', npc.position.x, npc.position.z);
    }
    return true;
  }
  // 시민 야간 AI: 전투에 참여하지 않고 가장 가까운 거주지(없으면 모닥불)로 도망쳐 웅크린다
  function citizenHide(dt) {
    let spot = null, bd = Infinity;
    for (const h of builtBuildings('house')) {
      const d = (h.position.x - npc.position.x) ** 2 + (h.position.z - npc.position.z) ** 2;
      if (d < bd) { bd = d; spot = doorOf(h); }
    }
    if (!spot) { const l = Math.hypot(npc.position.x, npc.position.z) || 1; spot = { x: npc.position.x / l * 1.6, z: npc.position.z / l * 1.6 }; }
    if (npcMove(spot.x, spot.z, npc.trait === 'timid' ? 6.5 : 5, dt) < 0.7) { npc.hidden = true; return 'Hiding'; }
    npc.hidden = false;
    return 'Fleeing';
  }

  // ---------- 출입구 경유지 길찾기 (사각형 성벽) ----------
  // 성벽을 사이에 두고 있으면 목표로 직진하지 않고, 가장 가까운 출입구를 임시 목표로 삼아 문 앞 → 문 뒤 순서로 통과한다.
  // 안/밖 판별은 중앙으로부터의 체비셰프 거리(cheb)와 각 성벽의 half 값을 비교한다.
  // 반환: 통과해야 하는 성벽의 half (없으면 null)
  function ringToCross(px, pz, tx, tz) {
    const rings = [...new Set(gateWaypoints.map(g => g.r))].sort((a, b) => a - b);
    if (!rings.length) return null;
    const dMe = cheb(px, pz), dT = cheb(tx, tz);
    const inward = dMe > dT;                                  // 안쪽으로 가면 바깥 성벽부터, 바깥쪽으로 가면 안쪽 성벽부터
    for (const R of (inward ? rings.slice().reverse() : rings)) {
      const meOut = dMe > R;
      const tgtOut = Math.abs(dT - R) < CFG.GATE_BAND ? meOut : dT > R;   // 성벽 위(청사진/목책)에 있는 목표는 같은 쪽으로 취급
      if (meOut !== tgtOut) return R;
    }
    return null;
  }
  function nearestGate(R) {
    let best = null, bd = Infinity;
    for (const g of gateWaypoints) {
      if (g.r !== R) continue;
      const dx = g.x - npc.position.x, dz = g.z - npc.position.z, d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = g; }
    }
    return best;
  }
  // 선분(P→Q)이 중앙 정사각형(half H)의 내부를 지나는지 (slab 검사)
  function segHitsBox(x0, z0, x1, z1, H) {
    let t0 = 0, t1 = 1;
    for (const [p, d] of [[x0, x1 - x0], [z0, z1 - z0]]) {
      if (Math.abs(d) < 1e-9) { if (Math.abs(p) > H) return false; continue; }
      let a = (-H - p) / d, b = (H - p) / d;
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
      if (t0 > t1) return false;
    }
    return true;
  }
  // 성벽 바깥에서 목표로 직진하면 성벽 안을 가로지르게 되므로, 성벽 바깥 궤도(모서리 지점)를 거쳐 돌아간다
  function aimPoint(px, pz, tx, tz) {
    const cP = cheb(px, pz), cQ = cheb(tx, tz);
    let R = 0;
    for (const g of gateWaypoints) if (cP > g.r + 1.5 && cQ > g.r - 0.5 && g.r > R) R = g.r;      // 둘 다 이 성벽 바깥쪽인 가장 큰 사각형
    if (!R) { npc.orbitTarget = -1; return [tx, tz]; }
    const H = cQ > R + 1.5 ? R + 1.2 : R - 1.0;                                                     // 성벽 위 목표는 내부만 피한다
    if (!segHitsBox(px, pz, tx, tz, H)) { npc.orbitDir = 0; npc.orbitTarget = -1; return [tx, tz]; }
    // 성벽 바깥 모서리 궤도를 따라 돈다: 향할 모서리(orbitTarget)를 정해 두고, 도착하면 회전 방향(orbitDir)의 인접 모서리로 이어서 이동
    const c = R + 2.5, corners = [[-c, -c], [c, -c], [c, c], [-c, c]];
    if (npc.orbitTarget >= 0 && npc.orbitTarget != null) {
      const [cx, cz] = corners[npc.orbitTarget];
      if (Math.hypot(cx - px, cz - pz) < 2.0) {
        if (!npc.orbitDir) {
          const f = corners[(npc.orbitTarget + 1) % 4], b = corners[(npc.orbitTarget + 3) % 4];
          npc.orbitDir = Math.hypot(tx - f[0], tz - f[1]) <= Math.hypot(tx - b[0], tz - b[1]) ? 1 : -1;
        }
        npc.orbitTarget = (npc.orbitTarget + npc.orbitDir + 4) % 4;
      }
      return corners[npc.orbitTarget];
    }
    npc.orbitDir = 0;
    let best = null, bd = Infinity;
    corners.forEach(([cx, cz], i) => {
      if (segHitsBox(px, pz, cx, cz, H)) return;                       // 성벽 안을 가로질러야 닿는 모서리는 제외 (인접 모서리만)
      const d = Math.hypot(cx - px, cz - pz) + Math.hypot(tx - cx, tz - cz);
      if (d < bd) { bd = d; best = [cx, cz]; npc.orbitTarget = i; }
    });
    return best || [tx, tz];
  }
  // 반환값은 최종 목적지까지의 (이동 전) 거리 - 호출부의 도착 판정에 그대로 쓰인다
  function npcMove(tx, tz, speed, dt) {
    // 끼임 감지: 5초 동안 거의 못 움직이면 stuckFlag를 세우고 살짝 밀어 준다 (호출한 쪽이 작업을 포기하도록)
    const nowMs = performance.now();
    if (!npc.sw || nowMs - npc.sw.last > 800) npc.sw = { x: npc.position.x, z: npc.position.z, t: 0, last: nowMs };
    npc.sw.t += dt; npc.sw.last = nowMs;
    if (npc.sw.t >= 6) {
      const mvd = Math.hypot(npc.position.x - npc.sw.x, npc.position.z - npc.sw.z);
      npc.sw = { x: npc.position.x, z: npc.position.z, t: 0, last: nowMs };
      if (!window.__nfNoFix && mvd < 2.5 && Math.hypot(tx - npc.position.x, tz - npc.position.z) > 2) { npc.stuckFlag = true; npc.position.x += rand(-1.6, 1.6); npc.position.z += rand(-1.6, 1.6); }
    }
    speed *= moveMul(npc);                                    // 굶주림·성격·기분이 이동 속도를 정한다
    // 끼임 방지: 거의 못 움직이면 잠깐 옆으로 비켜 걷는다
    const moved = Math.hypot(npc.position.x - (npc.prevX ?? npc.position.x), npc.position.z - (npc.prevZ ?? npc.position.z));
    npc.prevX = npc.position.x; npc.prevZ = npc.position.z;
    if (npc.nudgeT > 0) npc.nudgeT -= dt;
    else if (moved < speed * dt * 0.2 && Math.hypot(tx - npc.position.x, tz - npc.position.z) > 1.5) {
      npc.stuckT = (npc.stuckT || 0) + dt;
      if (npc.stuckT > 0.5) { npc.stuckT = 0; npc.nudgeT = 0.7; npc.nudgeDir = Math.random() < 0.5 ? 1 : -1; }
    } else npc.stuckT = 0;
    const dFinal = Math.hypot(tx - npc.position.x, tz - npc.position.z);
    const stepTo = (x, z) => { const [ax, az] = aimPoint(npc.position.x, npc.position.z, x, z); npcStep(ax, az, speed, dt); };

    // 이미 출입구 경유 중이면 계속 진행: [문 앞(approach), 문 뒤(exit)]
    if (npc.route) {
      if (npc.route.length === 2 && ringToCross(npc.position.x, npc.position.z, tx, tz) !== npc.routeRing) npc.route = null;   // 목적지가 바뀌어 더는 통과가 필요 없음
      else {
        const pt = npc.route[0];
        if (Math.hypot(pt.x - npc.position.x, pt.z - npc.position.z) < 1.3) {
          npc.route.shift();
          if (!npc.route.length) {                       // 경유 완료 → 해제하고 원래 목적지로 직진
            npc.graceRing = npc.routeRing; npc.graceT = CFG.GATE_GRACE; npc.route = null; npc.wp = null;
          }
        }
        if (npc.route) { stepTo(npc.route[0].x, npc.route[0].z); return dFinal; }
      }
    }
    const R = ringToCross(npc.position.x, npc.position.z, tx, tz);
    if (R !== null && !(npc.graceT > 0 && npc.graceRing === R)) {
      const g = npc.wp && npc.wp.r === R ? npc.wp : (npc.wp = nearestGate(R));        // 경유할 출입구는 한 번 정하면 유지
      if (g) {
        const pOut = cheb(npc.position.x, npc.position.z) > R, k = pOut ? 1 : -1;
        const A = { x: g.x + g.nx * 3 * k, z: g.z + g.nz * 3 * k }, B = { x: g.x - g.nx * 3 * k, z: g.z - g.nz * 3 * k };
        // 출입구 반경 2.0 이내면 문 앞 지점은 건너뛴다
        npc.route = Math.hypot(g.x - npc.position.x, g.z - npc.position.z) < CFG.GATE_REACH ? [B] : [A, B];
        npc.routeRing = R;
        stepTo(npc.route[0].x, npc.route[0].z);
        return dFinal;
      }
    } else npc.wp = null;
    stepTo(tx, tz);
    return dFinal;
  }
  // 목표 지점으로 한 걸음 이동 (장애물 밀어내기 포함, NPC끼리는 충돌하지 않으므로 출입구에서 서로 밀치지 않는다)
  function npcStep(tx, tz, speed, dt) {
    const dx = tx - npc.position.x, dz = tz - npc.position.z, d = Math.hypot(dx, dz);
    if (d > 0.05) {
      let mx = dx / d, mz = dz / d;
      if (npc.nudgeT > 0) { const t0 = mx; mx = -mz * npc.nudgeDir; mz = t0 * npc.nudgeDir; }   // 끼임 탈출: 목표의 수직 방향
      // 장애물을 정면으로 들이받지 않도록, 가까운 장애물 쪽 성분을 제거하고 옆으로 미끄러진다 (벽에 비비적거림 방지)
      for (const o of obstacles) {
        const ox = npc.position.x - o.position.x, oz = npc.position.z - o.position.z;
        const reach = o.userData.radius + PLAYER_R + 0.45, od = Math.hypot(ox, oz);
        if (od >= reach || od < 1e-4) continue;
        if (Math.abs(o.position.x - tx) < 0.3 && Math.abs(o.position.z - tz) < 0.3) continue;   // 목적지 자체(채집/수리 대상)는 피하지 않는다
        const nx = ox / od, nz = oz / od, into = mx * nx + mz * nz;
        if (into >= 0) continue;
        mx -= into * nx; mz -= into * nz;
        if (Math.hypot(mx, mz) < 0.3) {                       // 정면 충돌이면 목표 쪽으로 가까운 옆 방향 선택
          const side = (nx * mz - nz * mx) >= 0 ? 1 : -1;
          mx = -nz * side; mz = nx * side;
        }
      }
      const ml = Math.hypot(mx, mz) || 1;
      const step = Math.min(d, speed * dt);
      npc.position.x += mx / ml * step; npc.position.z += mz / ml * step;
      npc.face = Math.atan2(mx, mz);
      npc.rotation.y = npc.face;
    }
    for (const o of obstacles) {
      const ox = npc.position.x - o.position.x, oz = npc.position.z - o.position.z;
      const min = o.userData.radius + PLAYER_R, od = Math.hypot(ox, oz);
      if (od < min && od > 1e-4) { npc.position.x = o.position.x + ox / od * min; npc.position.z = o.position.z + oz / od * min; }
    }
    return d;
  }
  // 주간 작업 선택 (제곱거리 비교로 가장 가까운 대상을 O(n) 한 번에 탐색, 다른 동료가 점유한 대상은 제외)
  function nearestOf(list, pred) {
    let best = null, bd = Infinity;
    const nx = npc.position.x, nz = npc.position.z;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (!pred(o)) continue;
      const dx = o.position.x - nx, dz = o.position.z - nz, d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }
  const unclaimed = (o) => !(o.userData.skipUntil > gameMin) && (!o.userData.owner || o.userData.owner === npc || !npcs.includes(o.userData.owner));      // 도달할 수 없어 포기한 대상은 한동안 제외
  const reserved = { wood: 0, stone: 0 };       // 건설 담당이 이미 '예약'한 자원 (여럿이 같은 자원을 보고 동시에 건설하러 가지 않게)
  const bpCost = (b) => b.userData.cost ?? CFG.BP_COST[b.userData.res];
  function setTask(nt) {                       // 대상 점유(claim)/해제 + 건설 자원 예약
    if (npc.task) {
      npc.task.target.userData.owner = null;
      if (npc.task.kind === 'build') reserved[npc.task.target.userData.res] -= bpCost(npc.task.target);
    }
    npc.task = nt;
    if (nt) {
      nt.target.userData.owner = npc;
      if (nt.kind === 'build') reserved[nt.target.userData.res] += bpCost(nt.target);
    }
  }
  // 낮 작업 배분: 수리 > (채집조/건설조 분업). 자원이 부족하면 채집 담당을 먼저 정해 두고, 나머지는 '살 수 있는' 청사진만 지으러 간다
  let fortifyTold = false;
  function pickDayTask() {
    let damaged = null, bs = Infinity;                                      // 가장 많이 다친 성벽부터 (거리는 조금만 반영)
    for (const o of obstacles) { if (o.userData.type !== 'fence' || o.userData.hp >= o.userData.maxHp || !unclaimed(o)) continue; const sc = o.userData.hp / o.userData.maxHp + Math.hypot(o.position.x - npc.position.x, o.position.z - npc.position.z) / 120; if (sc < bs) { bs = sc; damaged = o; } }
    if (damaged) return { kind: 'repair', target: damaged };
    if (stage >= CFG.UPGRADE_FENCE_STAGE && res.stone - reserved.stone >= CFG.FENCE_UPGRADE_STONE) {      // 돌 시대가 되면 일꾼이 알아서 목책을 돌 성벽으로 바꾼다
      const wf = nearestOf(obstacles, o => o.userData.type === 'fence' && o.userData.level === 'wood' && unclaimed(o));
      if (wf) { if (!fortifyTold) { fortifyTold = true; toast('Your workers will now rebuild the wooden fences in stone'); } return { kind: 'fortify', target: wf }; }
    }
    const workers = npcs.filter(n => !n.down && !n.promote);
    const gatherers = workers.filter(n => n !== npc && n.task && n.task.kind === 'gather').length;
    const need = { wood: -res.wood, stone: -res.stone };                 // 청사진 전체 비용 - 보유량 = 부족분
    for (const b of blueprints) need[b.userData.res] += bpCost(b);
    const deficit = Math.max(0, need.wood) + Math.max(0, need.stone);
    let want = 0;
    const buffer = Math.max(0, res.wood - reserved.wood) + Math.max(0, res.stone - reserved.stone);       // 지금 바로 쓸 수 있는 여유 자원
    if (deficit > 0) want = workers.length <= 1 ? 0 : (deficit > CFG.GATHER_WORKERS_BIG_DEFICIT && buffer < CFG.GATHER_BUFFER ? Math.ceil(workers.length / 2) : 1);
    if (gatherers >= want) {                                              // 채집조가 충분 → 이 NPC는 건설 (예약 후에도 자원이 남는 청사진만)
      const bp = nearestOf(blueprints, b => unclaimed(b) && res[b.userData.res] - reserved[b.userData.res] >= bpCost(b));
      if (bp) return { kind: 'build', target: bp };
    }
    const wantType = need.wood >= need.stone ? (need.wood > 0 ? 'wood' : null) : (need.stone > 0 ? 'stone' : null);   // 가장 부족한 자원부터
    const isRes = (t) => t === 'wood' || t === 'stone';
    const r = (wantType && nearestOf(obstacles, o => o.userData.type === wantType && unclaimed(o))) ||
              nearestOf(obstacles, o => isRes(o.userData.type) && unclaimed(o));
    return r ? { kind: 'gather', target: r } : null;
  }
  function taskValid(tk) {
    if (tk.kind === 'build') return blueprints.includes(tk.target);
    if (!obstacles.includes(tk.target)) return false;
    if (tk.kind === 'fortify') return tk.target.userData.level === 'wood' && stage >= CFG.UPGRADE_FENCE_STAGE;
    return tk.kind !== 'repair' || tk.target.userData.hp < tk.target.userData.maxHp;
  }
  // 궁수 야간 AI: 모닥불 곁(안전지대)을 지키며 인식 거리 안의 가장 가까운 적에게 일정 간격으로 화살 발사 (돌진하지 않음)
  const strikeRange = () => npc.cls === 'spear' ? 3.3 : npc.cls === 'greatsword' ? 2.6 : 1.7;               // 창병은 멀리서 찌른다
  function citizenFight(dt) {                                               // 시민도 가까이 온 적은 맨손(주먹·발차기 연타)으로 막는다
    let foe = null, bd = 2.2;
    for (const e of enemies) { const u = e.userData; if (u.ex || u.sinking || u.dying > 0) continue; const d = Math.hypot(e.position.x - npc.position.x, e.position.z - npc.position.z); if (d < bd) { bd = d; foe = e; } }
    if (!foe) return false;
    npc.face = Math.atan2(foe.position.x - npc.position.x, foe.position.z - npc.position.z); npc.rotation.y = npc.face;
    if (npc.atkCd <= 0) {
      npc.anim.once('attackSword');
      const n = npc, dur = n.anim.shot ? n.anim.shot.dur : 0.5, hitIn = n.anim.hitIn ?? 0.25, kick = n.anim.variant === 'kick', base = gearDef('sword_basic');
      n.atkCd = dur * 0.95; n.atkLock = dur * 0.9;
      later(hitIn, () => { if (!npcs.includes(n) || n.down) return; const ang = enemies.includes(foe) ? Math.atan2(foe.position.x - n.position.x, foe.position.z - n.position.z) : n.rotation.y; impactFx(n.position.x, n.position.z, ang, kick ? 'kick' : 'punch'); sectorHit(n.position.x, n.position.z, ang, false, { ...base, dmg: base.dmg * (kick ? 0.32 : 0.22), half: Math.PI / 3, rangeMul: 0.7 }); });
    }
    return true;
  }
  function soldierStrike(foe) {                                             // 애니메이션을 시작하고, 칼이 휘둘러지는 순간에 피해를 준다. 휘두르는 동안은 제자리에 선다
    const n = npc; n.chargeBonus = !!n.mounted && (n.charge || 0) > CFG.CAV.CHARGE_T; n.charge = 0; if (n.chargeBonus) floatText('Charge!', n.position.x, 3.0, n.position.z); fightGain(n, 1, 0.5);
    const base = soldierWeaponDef(n), spear = n.cls === 'spear', medic = n.cls === 'medic', great = n.cls === 'greatsword';
    n.anim.once(spear ? 'attackSpear' : 'attackSword'); sfxAt('swing', n.position.x, n.position.z);
    const dur = n.anim.shot ? n.anim.shot.dur : 0.6, heavy = !spear && n.anim.heavy, hitIn = n.anim.hitIn ?? 0.25;
    n.atkCd = Math.max(spear ? 1.0 : medic ? 0.9 : great ? 1.1 : 0.6, dur * 0.95) / soldierSpd(n); n.atkLock = dur * 0.9;
    later(hitIn, () => {
      if (!npcs.includes(n) || n.down) return;
      const ang = enemies.includes(foe) ? Math.atan2(foe.position.x - n.position.x, foe.position.z - n.position.z) : n.rotation.y;
      if (spear) {
        if (n.anim.variant === 'slash') { spawnSlash(n.position.x, n.position.z, ang, { ...base, slash: 1.3 }); sectorHit(n.position.x, n.position.z, ang, false, { ...base, dmg: base.dmg * soldierMult(n) * 1.1, half: Math.PI / 2.8, rangeMul: 1.3, slash: 1.3 }); }
        else if (n.anim.variant === 'lunge') sectorHit(n.position.x, n.position.z, ang, false, { ...base, dmg: base.dmg * soldierMult(n) * 2.2, half: Math.PI / 8, rangeMul: 1.8, slash: 1.5, stun: 0.5 });
        else sectorHit(n.position.x, n.position.z, ang, false, { ...base, dmg: base.dmg * soldierMult(n) * 1.2, half: Math.PI / 9, rangeMul: 1.5, slash: 1.2 });
        return;
      }
      if (great) {                                                                  // 대검: 느리지만 묵직하고 사거리가 길다 / 네 번째는 제자리 회전 베기
        if (heavy) { spawnSlash(n.position.x, n.position.z, ang, { ...base, slash: 1.7 }); sectorHit(n.position.x, n.position.z, ang, false, { ...base, dmg: base.dmg * soldierMult(n) * 2.4, half: Math.PI, rangeMul: 1.5, slash: 1.7, tier: 1 }); return; }
        spawnSlash(n.position.x, n.position.z, ang, { ...base, slash: 1.5 }); sectorHit(n.position.x, n.position.z, ang, false, { ...base, dmg: base.dmg * soldierMult(n) * 1.7, half: Math.PI / 2.3, rangeMul: 1.4, slash: 1.5 }); return;
      }
      if (heavy) { spawnSlash(n.position.x, n.position.z, ang, { ...base, slash: 1.3 }); sectorHit(n.position.x, n.position.z, ang, false, { ...base, dmg: base.dmg * soldierMult(n) * 1.8, half: Math.PI, rangeMul: 1.25, slash: 1.3, tier: 1 }); return; }
      spawnSlash(n.position.x, n.position.z, ang, base);
      sectorHit(n.position.x, n.position.z, ang, false, { ...base, dmg: base.dmg * soldierMult(n) * (medic ? 0.5 : 1) });
    });
  }
  function medicTick(dt) {                                                  // 치료사: 3초마다 7칸 안의 다친 아군(병사·주민·주인공)을 최대 체력의 12%씩 치료
    npc.healT = (npc.healT || 0) - dt; if (npc.healT > 0 || npc.down) return; npc.healT = 3;
    let healed = 0;
    for (const o of npcs) if (o !== npc && !o.down && o.hp < o.maxHp && Math.hypot(o.position.x - npc.position.x, o.position.z - npc.position.z) < 7) { o.hp = Math.min(o.maxHp, o.hp + Math.ceil(o.maxHp * 0.12)); healed++; burst(o.position, 3); }
    if (hp < pMaxHp() && !dead && Math.hypot(player.position.x - npc.position.x, player.position.z - npc.position.z) < 7) { healPlayer(Math.ceil(pMaxHp() * 0.06)); healed++; }
    if (healed) { floatText('+heal', npc.position.x, 2.6, npc.position.z); Snd.play('heal', 0.4); }
  }
  function soldierShoot(foe) {
    const ang = Math.atan2(foe.position.x - npc.position.x, foe.position.z - npc.position.z);
    npc.face = ang; npc.rotation.y = ang;
    if (npc.atkCd <= 0) {                                                  // 화살을 뽑아 걸고 시위를 놓는 순간에 발사한다
      const n = npc; n.atkCd = CFG.ARCHER_FIRE_INTERVAL / soldierSpd(n); fightGain(n, 1, 0.5); n.anim.once('attackBow');
      later(n.anim.hitIn ?? 0.3, () => { if (!npcs.includes(n) || n.down) return; const a2 = enemies.includes(foe) ? Math.atan2(foe.position.x - n.position.x, foe.position.z - n.position.z) : ang; sfxAt('bow', n.position.x, n.position.z); fireArrow(n.position.x, n.position.z, a2, false, gearDef(n.gear.bow).dmg * soldierMult(n)); });
    }
  }
  // 지휘 명령 'Follow': 병사들이 플레이어 곁에 모여 따라다니며, 플레이어 주변의 적을 함께 상대한다 (낮에도 일을 멈추고 따른다)
  function followStep(dt) {
    if (npc.task) { setTask(null); npc.workT = 0; }
    npc.hidden = false; npc.returning = false;
    let foe = null, bd = 16;
    for (const e of enemies) {
      if (e.userData.sinking || e.userData.siege || e.userData.prowl) continue;
      const d = Math.hypot(e.position.x - player.position.x, e.position.z - player.position.z);
      if (d < bd) { bd = d; foe = e; }
    }
    const idx = npcs.filter(x => x.role !== 'citizen').indexOf(npc), a = idx * 2.4 + player.rotation.y, r = 2.6 + (idx % 2) * 0.9;
    if (foe) {
      if (npc.archer) {
        if (Math.hypot(foe.position.x - npc.position.x, foe.position.z - npc.position.z) <= CFG.ARCHER_AGGRO) { soldierShoot(foe); return 'Fighting'; }
      } else {
        const d = npc.atkLock > 0 ? Math.hypot(foe.position.x - npc.position.x, foe.position.z - npc.position.z) : npcMove(foe.position.x, foe.position.z, 5.5, dt);
        if (d < strikeRange() && npc.atkCd <= 0) soldierStrike(foe);
        return 'Fighting';
      }
    }
    const d = npcMove(player.position.x + Math.sin(a) * r, player.position.z + Math.cos(a) * r, 5.5, dt);
    if (d < 0.8) { npc.face = Math.atan2(player.position.x - npc.position.x, player.position.z - npc.position.z); npc.rotation.y = npc.face; }
    return 'Following';
  }
  // 밤 훈련: 평화로운 밤에 병영·사격장에서 쉬는 병사는 훈련을 해서 숙련도(베테랑)를 쌓는다 (등급마다 공격력 +6%)
  function trainTick(dt) {
    if (!(builtBuildings('barracks').length || builtBuildings('range').length)) return false;
    npc.trainT = (npc.trainT || 0) + dt;
    if ((npc.trainA = (npc.trainA || 0) + dt) > 3.2) { npc.trainA = 0; npc.anim.once(npc.role === 'archer' ? 'attackBow' : 'attackSword'); }
    if (npc.trainT >= 6) { npc.trainT = 0; const b = vetLv(npc); npc.vxp = (npc.vxp || 0) + 1; if (vetLv(npc) > b) floatText(`${npc.name}: Veteran ${vetLv(npc)}`, npc.position.x, 3.0, npc.position.z); }
    return true;
  }
  function archerDefend(dt) {
    const rs = peaceful ? restSpot(npc, 'night') : null, hx = rs ? rs.x : npc.home.x, hz = rs ? rs.z : npc.home.z;
    if (Math.hypot(npc.position.x - hx, npc.position.z - hz) > 1.0) npcMove(hx, hz, 4.5, dt);
    let foe = null, bd = (orderOf(npc) === 'charge' ? 1.25 : 1) * CFG.ARCHER_AGGRO * (fogNight ? 0.65 : 1) * (1 - 0.15 * rainNow());
    for (const e of enemies) {
      if (e.userData.sinking || e.userData.siege || e.userData.prowl) continue;      // 공성 투척병은 궁수가 노릴 수 없다
      const d = Math.hypot(e.position.x - npc.position.x, e.position.z - npc.position.z);
      if (d < bd) { bd = d; foe = e; }
    }
    if (markedFoe && !markedFoe.userData.ex && !markedFoe.userData.siege && !markedFoe.userData.prowl && Math.hypot(markedFoe.position.x - npc.position.x, markedFoe.position.z - npc.position.z) < CFG.ARCHER_AGGRO * 1.25) foe = markedFoe;       // 표시된 적을 먼저 쏜다
    if (!foe) {
      if (peaceful && Math.hypot(npc.position.x - hx, npc.position.z - hz) < 1.0) { if (rs) faceTo(rs.fx, rs.fz); else faceFire(); return trainTick(dt) ? 'Training' : 'Resting'; }
      return 'Idle';
    }
    soldierShoot(foe);
    return 'Fighting';
  }
  // ---------- 9-2: 병사의 낮 순찰: 할 일이 없을 때 성벽 안쪽을 돌며 걷고, 해 질 녘(17시~)에는 문 앞 초소로 먼저 모인다 ----------
  function guardIdle(dt, hour) {
    if (hour >= 17) {
      const post = sentryPost(npc) || npc.home;
      if (npcMove(post.x, post.z, 3.5, dt) < 0.8) { faceTo(post.x * 2, post.z * 2); return 'On watch'; }
      return 'Taking posts';
    }
    const H = designTier > 0 ? CFG.DESIGN[designTier - 1].half - 3 : 7, i = npc.patrolI = npc.patrolI ?? (npcs.indexOf(npc) * 3) % 8;
    const P = [[1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]][i % 8], tx = P[0] * H, tz = P[1] * H;
    if (npc.patrolWait > 0) { npc.patrolWait -= dt; faceTo(tx * 2, tz * 2); return 'Patrolling'; }
    if (npcMove(tx, tz, 3.2, dt) < 1.3) { npc.patrolI = (i + 1) % 8; npc.patrolWait = 2 + Math.random() * 2; }
    return 'Patrolling';
  }
  function updateNpc(dt, hour, t) {
    if (dead) return;
    if (npc.escort) { escortStep(dt); return; }                       // 원정에 동행 중인 병사
    const isDay = hour >= 6 && hour < 18;
    if (npc.down) {
      if (isDay && !(npc.woundDays > 0)) { npc.woundDays = 0; npc.sitting = false; reviveNpc(); }
      else if (npc.woundDays > 0) { if (!npc.sitting) { npc.sitting = true; npc.anim.revive(); } npc.anim.base('sit', 0); setLabel(`Wounded ${npc.woundDays}d`); return; }       // 부상병은 바닥에 눕지 않고 앉아서 쉰다
      else { setLabel('Down'); return; }
    }
    npc.atkCd -= dt; npc.atkLock = (npc.atkLock || 0) - dt;
    npc.graceT -= dt;
    if (npc.cls === 'medic' && npc.role === 'melee') medicTick(dt);
    let state = 'Idle';
    let bob = 0;
    if (isDay && npc.hidden) { npc.hidden = false; }                       // 아침: 웅크림 해제
    let busy = isDay && npc.promote ? (state = 'Training', promoteStep(dt)) : false;
    if (order === 'follow' && !exActive && npc.role !== 'citizen') { state = followStep(dt); busy = true; }       // 지휘 명령: 플레이어를 따른다
    if (!busy && npc.role === 'citizen' && !npc.hidden && citizenFight(dt)) { busy = true; state = 'Fighting back'; }
    if (!busy && isDay && gearFetchStep(dt)) { busy = true; state = 'Fetching gear'; }       // 병사: 대장간에서 새 장비 수령
    if (!busy && isDay && npc.role === 'citizen') { const rs = routineStep(dt, hour); if (rs) { busy = true; state = rs; } }
    if (!busy && isDay && npc.role === 'citizen' && workStep(dt)) { busy = true; state = npc.stateLabel; bob = npc.bobAmt; }      // 경제 건물에 정착한 시민

    if (busy) { /* 전직 훈련 이동 중 */ } else if (isDay) {
      // 주간 우선순위: 1) 수리  2) 건설(청사진)  3) 채집
      let task = npc.task;
      if (task && !taskValid(task)) { setTask(null); task = null; npc.workT = 0; }
      if (task) {                                                        // 워치독: 한 작업에 게임 시간 5시간(실제 약 30초) 넘게 매달리면 포기하고 그 대상은 잠시 제외
        task.startMin = task.startMin ?? gameMin;
        if (gameMin - task.startMin > 300) { task.target.userData.skipUntil = gameMin + 180; setTask(null); npc.workT = 0; task = null; }
      }
      npc.pickCd -= dt;
      if (!task && npc.pickCd <= 0) {          // 작업이 끝나거나 사라졌을 때만 새 작업 선택 (중간에 바꾸지 않아 갈팡질팡 방지)
        npc.pickCd = 0.3;
        const nt = pickDayTask();
        if (nt) { setTask(nt); task = nt; npc.workT = 0; }
      }
      if (task) {
        const o = task.target;
        state = { repair: 'Repairing', build: 'Building', gather: 'Gathering', fortify: 'Fortifying' }[task.kind];
        const stop = task.kind === 'build' ? (o.userData.stand ?? 1.2) : o.userData.radius + PLAYER_R + (task.kind === 'repair' || task.kind === 'fortify' ? 0.4 : 0.3);
        const d = Math.hypot(o.position.x - npc.position.x, o.position.z - npc.position.z);
        if (d > stop) { npcMove(o.position.x, o.position.z, 3.5, dt); npc.workT = 0; }
        else {
          npc.face = Math.atan2(o.position.x - npc.position.x, o.position.z - npc.position.z);
          npc.rotation.y = npc.face;
          if (task.kind === 'build' && npc.workT === 0 && res[o.userData.res] < (o.userData.cost ?? CFG.BP_COST[o.userData.res])) {
            // 도착했는데 나무가 부족하면 건설 보류, 즉시 채집으로 전환
            setTask(null);                       // (플레이어가 자원을 써 버린 경우) 건설 보류 → 다음 선택에서 채집으로 배정
          } else {
            npc.workT += dt * workMul(npc);       // 굶주림·성격·기분이 작업 효율을 정한다
            bob = 0;
            if (task.kind === 'build' && npc.workT >= (o.userData.buildTime ?? CFG.BUILD_TIME)) {
              const kind = o.userData.res, cost = o.userData.cost ?? CFG.BP_COST[kind];
              if (res[kind] >= cost) {
                res[kind] -= cost; updateHud();
                blueprints.splice(blueprints.indexOf(o), 1); scene.remove(o);
                if (o.userData.bkind) createBuilding(o.userData.bkind, o.position.x, o.position.z);
                else createStructure(kind, o.position.x, o.position.z, o.rotation.y);
                dust(o.position.x, o.position.z); sfxAt('build', o.position.x, o.position.z); report.built++;
              }
              setTask(null); npc.workT = 0;
            } else if (task.kind === 'repair' && npc.workT >= CFG.REPAIR_TIME) {
              o.userData.hp = o.userData.maxHp; report.rep++;
              dust(o.position.x, o.position.z);
              setTask(null); npc.workT = 0;
            } else if (task.kind === 'fortify' && npc.workT >= CFG.REPAIR_TIME * 1.5) {
              if (res.stone >= CFG.FENCE_UPGRADE_STONE) { res.stone -= CFG.FENCE_UPGRADE_STONE; makeStoneFence(o); updateHud(); dust(o.position.x, o.position.z); sfxAt('build', o.position.x, o.position.z); report.fort++; }
              else o.userData.skipUntil = gameMin + 120;
              setTask(null); npc.workT = 0;
            } else if (task.kind === 'gather' && npc.workT >= CFG.GATHER_TIME) {
              const type = o.userData.type;
              scene.remove(o); obstacles.splice(obstacles.indexOf(o), 1);
              res[type] += gatherYield(type); rollIron(o); updateHud(); sfxAt('chop', o.position.x, o.position.z);
              setTask(null); npc.workT = 0;
            }
          }
        }
      } else if (npc.role !== 'citizen' && order !== 'follow') state = guardIdle(dt, hour);
      else npcMove(npc.home.x, npc.home.z, 3.5, dt);
    } else {
      // 야간: 모닥불 방어
      npc.target = null; npc.gatherT = 0; setTask(null); npc.workT = 0;
      if (npc.role === 'citizen') {
        if (peaceful && npc.work && obstacles.includes(npc.work) && npc.work.userData.kind === 'smith') {            // 대장장이는 평화로운 밤에도 불빛 아래서 일한다 (1.5배)
          if (workStep(dt)) { state = npc.stateLabel; bob = npc.bobAmt; } else state = citizenRest(dt);
        } else state = peaceful ? citizenRest(dt) : citizenHide(dt);
      } else if (npc.archer) state = archerDefend(dt); else {
      const ord = orderOf(npc), post0 = ord === 'stand' ? (sentryPost(npc) || npc.home) : null;       // 명령: Stand firm 은 초소 근처의 적만, Charge 는 더 멀리서, Withdraw 는 싸우러 나가지 않는다
      let foe = null, bd = ord === 'charge' ? CFG.MELEE_AGGRO * 1.3 : ord === 'stand' ? 14 : CFG.MELEE_AGGRO;      // 성벽 밖까지 인식 → npcMove의 출입구 경유 길찾기로 밖에 나가 싸우고, 끝나면 문으로 복귀
      for (const e of enemies) {
        if (e.userData.sinking || e.userData.siege || e.userData.prowl || ord === 'withdraw') continue;
        const d = post0 ? Math.hypot(e.position.x - post0.x, e.position.z - post0.z) : Math.hypot(e.position.x - npc.position.x, e.position.z - npc.position.z);
        if (d < bd) { bd = d; foe = e; }
      }
      if (markedFoe && !markedFoe.userData.ex && ord !== 'withdraw') {                         // 표시된 적이 있으면 그 적을 먼저 노린다 (Stand firm 은 초소 근처일 때만)
        const md = post0 ? Math.hypot(markedFoe.position.x - post0.x, markedFoe.position.z - post0.z) : Math.hypot(markedFoe.position.x - npc.position.x, markedFoe.position.z - npc.position.z);
        if (ord !== 'stand' || md < 14) { foe = markedFoe; bd = md; }
      }
      if (npc.returning || !foe) {
        const post = sentryPost(npc), rs = peaceful && !post ? restSpot(npc, 'night') : null, tgt = post || rs || npc.home;
        if (npcMove(tgt.x, tgt.z, 5, dt) < 0.8) { npc.returning = false; if (post) { state = 'Guarding'; npc.face = Math.atan2(-post.x, -post.z) + Math.PI; npc.rotation.y = npc.face; } else if (peaceful) { state = trainTick(dt) ? 'Training' : 'Resting'; if (rs) faceTo(rs.fx, rs.fz); else faceFire(); } }      // 성문 경비는 문 앞에 서고, 나머지는 평화로운 밤에 모닥불 곁에 앉아 쉰다
      } else {
        state = 'Fighting';
        const d = npc.atkLock > 0 ? Math.hypot(foe.position.x - npc.position.x, foe.position.z - npc.position.z) : npcMove(foe.position.x, foe.position.z, 5.5, dt);
        if (d < strikeRange() && npc.atkCd <= 0) {
          soldierStrike(foe);
          if (!enemies.includes(foe)) npc.returning = true;     // 처치했으면 모닥불로 복귀
        }
      }
      }
    }
    // 애니메이션 상태 머신: 실제 이동 속도 + 현재 행동으로 Idle / Walk / Run / Gather / Sit 을 고른다 (전환은 CrossFade)
    const mv = Math.hypot(npc.position.x - npc.px, npc.position.z - npc.pz) / Math.max(dt, 1e-4);
    npc.px = npc.position.x; npc.pz = npc.position.z;
    const working = state === 'Gathering' || state === 'Building' || state === 'Repairing' || state === 'Chopping' || state === 'Quarrying' || state === 'Farming';
    let anim = mv > 4.4 ? 'run' : mv > 0.5 ? 'walk' : 'idle';
    if ((state === 'Resting' || state === 'Lunch break') && mv < 0.5) anim = 'sit'; else if ((working || state === 'Drawing water') && mv < 0.8) anim = state === 'Farming' ? 'farm' : 'gather';
    npc.rig.tool = state === 'Chopping' || (npc.task && npc.task.kind === 'gather' && npc.task.target.userData.type === 'wood') ? 'axe' : 'pick';
    npc.rig.combat = !!exActive || enemyWithin(npc.position.x, npc.position.z, 24);       // 적이 가까우면 전투 자세 이동(칼·방패 / 활), 아니면 평상시 이동
    npc.rig.sheathe(npc.role !== 'citizen' && npc.cls !== 'medic' && !npc.rig.combat && !npc.anim.shot);       // 평상시 마을 안에서는 무기를 치우고 일반 이동으로 걷는다
    npc.anim.base(anim, mv);
    const bs = npc.rig.baseScale;
    npc.body.scale.set(bs, bs * (npc.hidden ? 0.55 : 1), bs);                // 숨은 시민은 웅크린다
    if (npc.stuckFlag) {                                                   // 끼인 NPC: 지금 목표를 한동안 포기하고 다른 일을 고른다
      npc.stuckFlag = false;
      if (npc.task) { npc.task.target.userData.skipUntil = gameMin + 180; setTask(null); npc.workT = 0; }
      if (npc.wtarget) { npc.wtarget.userData.skipUntil = gameMin + 180; npc.wtarget = null; }
      if (npc.promote) npc.promote = npc.promote;
      if (npc.patrolI != null) npc.patrolI = (npc.patrolI + 1) % 8;
    }
    npc.stateNow = state;
    setLabel(state);
  }

  // ---------- 플레이어 공격 ----------
  let atkT = 0, atkCd = 0, shake = 0;
  let tapTip = false; try { tapTip = !!localStorage.getItem('nf_tiptap'); } catch (e) {}
  // 지연 실행: 공격 애니메이션에서 칼이 휘둘러지는 순간(hitIn초 뒤)에 피해를 준다
  const delayed = [];
  const later = (t, fn) => delayed.push({ t: Number.isFinite(t) ? t : 0.25, fn });             // 시간 값이 없어도 (옛 캐시 파일 등) 반드시 실행되게 한다
  function tickDelayed(dt) { for (let i = delayed.length - 1; i >= 0; i--) { const d = delayed[i]; if ((d.t -= dt) <= 0) { delayed.splice(i, 1); try { d.fn(); } catch (e) { console.error(e); } } } }
  let atkLock = 0;                                                       // 근접 공격 동안 제자리에 서 있는다
  function attack() {
    if (!tapTip && !dead) { tapTip = true; try { localStorage.setItem('nf_tiptap', '1'); } catch (e) {} setTimeout(() => toast('Tip: use the red Attack button (or press F) to attack'), 600); }
    if (dead || atkCd > 0 || dashT > 0 || blocking) return;
    gathering = null; leaderChargeStrike();
    if (weaponMode === 'bow') {
      playerAnim.once('attackBow'); { const dur = playerAnim.shot.dur; atkCd = Math.max(ATK_CD, dur * 0.9); atkLock = dur * 0.9; }
      later(playerAnim.hitIn, () => { if (dead) return; shake = Math.max(shake, 0.08); Snd.play('bow'); fireArrow(player.position.x, player.position.z, facing, true, gearDef(playerGear.bow).dmg * pDmg() * (1 + 0.2 * pl.st.fletch)); });
      return;
    }
    if (weaponMode === 'spear') {                                      // 창: 좁은 부채꼴, 긴 사거리, 느린 연타. 줄지어 선 적을 한꺼번에 꿰뚫는다
      playerAnim.once('attackSpear'); const dur = playerAnim.shot.dur, slash = playerAnim.variant === 'slash', lunge = playerAnim.variant === 'lunge'; atkCd = Math.max(ATK_CD * 1.25, dur * 0.9); atkLock = dur * 0.9; Snd.play('swing');
      later(playerAnim.hitIn, () => {
        if (dead) return; const base = weaponDef('spear'), reach = 1 + 0.08 * pl.st.spear + 0.1 * pl.st.lunge, dm = base.dmg * pDmg() * (1 + 0.2 * pl.st.spear);
        atkT = SLASH_LIFE;
        if (slash) {                                                                                          // 휘둘러 베기: 앞쪽 넓은 부채꼴
          shake = 0.3; spawnSlash(player.position.x, player.position.z, facing, { ...base, slash: 1.5 });
          const hits = sectorHit(player.position.x, player.position.z, facing, true, { ...base, dmg: dm * 1.15, half: Math.PI / 2.6, rangeMul: 1.45 * reach, slash: 1.5 });
          if (hits >= 2) floatText(`SWEEP x${hits}!`, player.position.x + Math.sin(facing) * 2, 2.6, player.position.z + Math.cos(facing) * 2);
          return;
        }
        const sd = lunge ? { ...base, dmg: dm * 2.6 * (1 + 0.12 * pl.st.lunge), half: Math.PI / 8 * (1 + 0.12 * pl.st.impale), stun: 0.6 + 0.25 * pl.st.impale, rangeMul: 2.3 * reach, slash: (base.slash || 1) * 2.0, tier: 1 }       // 마지막 돌진 찌르기: 온몸을 실어 더 아프고 더 멀리, 기절까지
          : { ...base, dmg: dm * 1.25 * (1 + 0.12 * pl.st.lunge), half: Math.PI / 10 * (1 + 0.12 * pl.st.impale), stun: 0.25 * pl.st.impale, rangeMul: 1.9 * reach, slash: (base.slash || 1) * 1.6 };          // 찌르기: 좁고 아주 긴 사거리
        const sa = playerAnim.spearAim(), ang = sa === null ? facing : sa, so = playerAnim.spearOrigin() || [player.position.x, player.position.z];       // 찌르기 판정은 보이는 창끝이 가리키는 방향으로
        shake = lunge ? 0.55 : 0.2; spawnThrust(so[0], so[1], ang, ATK_RANGE * sd.rangeMul);
        const hits = sectorHit(so[0], so[1], ang, true, sd);
        if (lunge) floatText(hits >= 2 ? `FULL THRUST x${hits}!` : 'FULL THRUST!', player.position.x + Math.sin(facing) * 2, 2.8, player.position.z + Math.cos(facing) * 2);
        else if (hits >= 3) floatText(`PIERCE x${hits}!`, player.position.x + Math.sin(facing) * 2, 2.6, player.position.z + Math.cos(facing) * 2);
      });
      return;
    }
    const great = weaponMode === 'great';                                 // 대검: 느리지만 묵직하고 사거리가 길다, 네 번째는 제자리 회전 베기
    playerAnim.once('attackSword'); const dur = playerAnim.shot.dur, heavy = playerAnim.heavy;
    atkCd = Math.max(great ? ATK_CD * 1.3 : ATK_CD, dur * 0.92); atkLock = dur * 0.92; if (weaponMode !== 'none') Snd.play('swing');
    later(playerAnim.hitIn, () => {                                      // 칼이 휘둘러지는 순간에 베기 판정
      if (dead) return;
      const base = weaponDef(weaponMode), mulDps = (great ? 1.7 * (1 + 0.18 * pl.st.cleave) : playerAnim.rig.style === 'ss' ? 1.4 : weaponMode === 'none' ? (playerAnim.variant === 'kick' ? 0.6 : 0.45) : 1), gr = 1 + 0.06 * pl.st.cleave;           // 모션이 길어 공격 간격이 늘었으므로 한 방을 키워 초당 피해를 맞춘다
      atkT = SLASH_LIFE; shake = heavy ? 0.7 : 0.3;
      if (heavy) {                                                                                           // 점프 내려찍기: 착지 지점 주위 전방위
        if (weaponMode === 'none') impactFx(player.position.x, player.position.z, facing, 'round'); else spawnSlash(player.position.x, player.position.z, facing, { ...base, slash: great ? 1.8 : 1.5 }); Snd.play('boom', 0.6);
        const hits = sectorHit(player.position.x, player.position.z, facing, true, { ...base, dmg: base.dmg * pDmg() * (great ? 2.4 * (1 + 0.25 * pl.st.whirl) : weaponMode === 'none' ? 1.2 : 2.3), half: Math.PI, rangeMul: great ? 1.55 * gr * (1 + 0.08 * pl.st.whirl) : 1.35, slash: great ? 1.8 : 1.4, tier: 1 });
        const nm = weaponMode === 'none' ? 'KICK' : great ? 'SPIN' : 'SLAM'; floatText(hits ? `${nm} x${hits}!` : `${nm}!`, player.position.x, 2.8, player.position.z); return;
      }
      if (weaponMode === 'none') impactFx(player.position.x, player.position.z, facing, playerAnim.variant); else spawnSlash(player.position.x, player.position.z, facing, great ? { ...base, slash: 1.5 } : undefined);
      const hits = sectorHit(player.position.x, player.position.z, facing, true, great ? { ...base, dmg: base.dmg * pDmg() * mulDps, half: Math.PI / 2.3, rangeMul: 1.45 * gr, slash: 1.5 } : { ...base, dmg: base.dmg * pDmg() * mulDps });
      if (hits >= 2) { shake = Math.min(0.7, 0.3 + hits * 0.06); floatText(`CLEAVE x${hits}!`, player.position.x + Math.sin(facing) * 2, 2.6, player.position.z + Math.cos(facing) * 2); }
    });
  }

  // 맨손 타격 효과: 칼의 베기 궤적 대신, 주먹·발이 닿는 앞쪽 지점에서 작은 충격 먼지가 튄다 (돌려차기는 몸 둘레로 퍼진다)
  function impactFx(x, z, ang, kind) {
    sfxAt(kind === 'punch' ? 'punch' : 'kick', x, z);
    if (kind === 'round') { burst({ x, z }, 4); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + ang; burst({ x: x + Math.sin(a) * 1.3, z: z + Math.cos(a) * 1.3 }, 2); } return; }
    burst({ x: x + Math.sin(ang) * (kind === 'kick' ? 1.5 : 1.2), z: z + Math.cos(ang) * (kind === 'kick' ? 1.5 : 1.2) }, kind === 'kick' ? 5 : 3);
  }
  // 창 찌르기 궤적: 앞으로 쭉 뻗는 가늘고 긴 빛줄기
  const thrustGeo = new THREE.PlaneGeometry(0.34, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5);
  function spawnThrust(x, z, ang, len) {
    const g = new THREE.Group(), m = new THREE.Mesh(thrustGeo, new THREE.MeshBasicMaterial({ color: 0xdfe8ff, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }));
    m.scale.z = len; g.add(m); g.position.set(x, actorH(x, z) + 0.9, z); g.rotation.y = ang; g.userData.life = SLASH_LIFE * 1.3; scene.add(g); slashes.push(g);
  }
  const WEAPON_NAME = { sword: 'Sword', great: 'Great Sword', bow: 'Bow', spear: 'Spear', none: 'Unarmed' };
  function swapWeapon() {
    if (dead) return;
    playerAnim.breakCombo();
    weaponMode = weaponMode === 'sword' ? 'great' : weaponMode === 'great' ? 'bow' : weaponMode === 'bow' ? 'spear' : weaponMode === 'spear' ? 'none' : 'sword';
    playerRig.brawl = weaponMode === 'none'; playerRig.main = weaponMode; playerRig.style = weaponMode === 'sword' ? 'ss' : weaponMode === 'great' ? 'gs' : weaponMode === 'bow' ? 'bow' : '';
    document.getElementById('swapCur').textContent = `Q · ${WEAPON_NAME[weaponMode]}`;
    toast(weaponMode === 'none' ? 'Unarmed (normal movement, weak punches)' : weaponMode === 'great' ? 'Great sword equipped (two-handed, long reach, slow heavy cleaves and a spinning slash)' : weaponMode === 'bow' ? 'Bow equipped (ranged)' : weaponMode === 'spear' ? 'Spear equipped (long thrust, slower)' : 'Sword equipped (wide sweep)');
  }
  // 화살은 아군 구조물(obstacles)과 충돌 검사를 하지 않으므로 목책/성벽을 그대로 통과한다 (one-way wall).
  const arrows = [];
  const arrowGeo = new THREE.CylinderGeometry(0.045, 0.045, 1.6, 6), arrowTipGeo = new THREE.ConeGeometry(0.1, 0.28, 5), arrowTipMat = new THREE.MeshBasicMaterial({ color: 0xd8dde6 });
  const arrowMat = new THREE.MeshBasicMaterial({ color: 0x8a5a2b });
  function fireArrow(x, z, ang, byPlayer = false, dmg = null, y = 1.0, tdist = 0) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(arrowGeo, arrowMat);
    m.rotation.x = Math.PI / 2;                     // 원기둥 축을 진행(+Z) 방향으로 눕힘
    const tip = new THREE.Mesh(arrowTipGeo, arrowTipMat); tip.rotation.x = Math.PI / 2; tip.position.z = 0.9;     // 쇠 화살촉
    g.add(m, tip);
    const sx = Math.sin(ang), sz = Math.cos(ang);
    g.position.set(x + sx * 0.7, y, z + sz * 0.7);
    g.rotation.y = ang;
    g.userData = { vx: sx * CFG.ARROW_SPEED, vz: sz * CFG.ARROW_SPEED, dist: 0, byPlayer, dmg };
    if (tdist > 0 && y > 2) { const vy = (0.9 - y) / Math.max(0.2, tdist / CFG.ARROW_SPEED); g.userData.vy = vy; g.rotation.order = 'YXZ'; g.rotation.x = Math.atan2(-vy, CFG.ARROW_SPEED); }       // 높은 곳(탑)에서 쏜 화살은 표적을 향해 내려꽂힌다
    scene.add(g);
    arrows.push(g);
  }
  // 떠오르는 텍스트 (방패병 면역 표시)
  const floaters = [], floatTex = new Map();
  function floatText(text, x, y, z) {
    let tex = floatTex.get(text);
    if (!tex) {
      const cv = document.createElement('canvas');
      cv.width = 256; cv.height = 64;
      const c = cv.getContext('2d');
      c.font = 'bold 30px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 5; c.strokeStyle = 'rgba(0,0,0,.7)'; c.strokeText(text, 128, 32);
      c.fillStyle = '#c9ced6'; c.fillText(text, 128, 32);
      tex = new THREE.CanvasTexture(cv);
      floatTex.set(text, tex);
    }
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, fog: false, depthTest: false }));
    sp.scale.set(1.6, 0.4, 1);
    sp.position.set(x, y, z);
    sp.userData = { life: 0.9 };
    scene.add(sp);
    floaters.push(sp);
  }
  function updateFloaters(dt) {
    for (const f of floaters.slice()) {
      f.userData.life -= dt;
      f.position.y += dt * 1.1;
      f.material.opacity = Math.max(0, Math.min(1, f.userData.life / 0.4));
      if (f.userData.life <= 0) { scene.remove(f); f.material.dispose(); floaters.splice(floaters.indexOf(f), 1); }
    }
  }
  function updateArrows(dt) {
    for (const a of arrows.slice()) {
      const u = a.userData;
      const x0 = a.position.x, z0 = a.position.z;
      const dx = u.vx * dt, dz = u.vz * dt, len = Math.hypot(dx, dz);
      // 이번 프레임 이동 구간(선분)과 가장 먼저 만나는 적을 찾는다 (빠른 화살의 터널링 방지)
      let hit = null, bestT = Infinity;
      for (const e of enemies) {
        if (e.userData.sinking) continue;
        const ex = e.position.x - x0, ez = e.position.z - z0;
        const t = Math.max(0, Math.min(1, (ex * dx + ez * dz) / (len * len)));
        const px = ex - dx * t, pz = ez - dz * t;
        if (px * px + pz * pz < (e.userData.r + 0.15) ** 2 && t < bestT) { bestT = t; hit = e; }
      }
      if (hit) {
        if (hit.userData.shield) floatText('Immune', hit.position.x, hit.position.y + 1.6, hit.position.z);   // 방패병: 화살 면역
        else hitEnemy(hit, u.dmg ?? CFG.BOW_DMG, x0, z0, false, null, u.byPlayer);    // 활 데미지는 고정(무기 강화 영향 없음)
        scene.remove(a); arrows.splice(arrows.indexOf(a), 1);
        continue;
      }
      a.position.x += dx; a.position.z += dz; if (u.vy) { a.position.y += u.vy * dt; if (a.position.y < 0.05) { scene.remove(a); arrows.splice(arrows.indexOf(a), 1); continue; } }
      u.dist += len;
      if (u.dist >= CFG.ARROW_RANGE) { scene.remove(a); arrows.splice(arrows.indexOf(a), 1); }   // 사거리 초과 시 소멸
    }
  }

  // ---------- 구조물 파괴 → 청사진 복귀 ----------
  function collapseStructure(o) {
    const i = obstacles.indexOf(o);
    if (i < 0) return;
    obstacles.splice(i, 1); report.wallsLost++;
    scene.remove(o);
    addBlueprint(o.userData.level === 'stone' ? 'stone' : 'wood', o.position.x, o.position.z, o.rotation.y);   // 같은 위치·회전의 반투명 청사진 (충돌 없음)
    dust(o.position.x, o.position.z);
  }
  function damageStructure(o, dmg) {
    o.userData.hp -= dmg * dm().dmg;
    if (o.userData.hp <= 0) collapseStructure(o);
  }

  // ---------- 공성 투척병의 폭발 바위 (곡사) ----------
  const rocks = [];
  const rockGeo = new THREE.SphereGeometry(0.55, 12, 10);
  const rockMatBlack = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.5 });
  const markGeo = new THREE.RingGeometry(CFG.ROCK_SPLASH - 0.3, CFG.ROCK_SPLASH, 32);
  const boomGeo = new THREE.CircleGeometry(CFG.ROCK_SPLASH, 28);
  const ROCK_G = 16;
  function throwRock(e) {
    e.userData.anim.once('attackSword');
    // 조준: 가장 가까운 구조물, 없으면 모닥불
    let tx = 0, tz = 0, bd = Infinity;
    for (const o of obstacles) {
      if (o.userData.type !== 'fence') continue;
      const d = (o.position.x - e.position.x) ** 2 + (o.position.z - e.position.z) ** 2;
      if (d < bd) { bd = d; tx = o.position.x; tz = o.position.z; }
    }
    tx += rand(-1.5, 1.5); tz += rand(-1.5, 1.5);
    const sx = e.position.x, sz = e.position.z, y0 = 2.4;
    const T = Math.max(1.4, Math.hypot(tx - sx, tz - sz) / CFG.ROCK_FLIGHT_SPEED);   // 체공 시간
    const m = new THREE.Mesh(rockGeo, rockMatBlack);
    m.position.set(sx, y0, sz);
    m.castShadow = true;
    const mark = new THREE.Mesh(markGeo, new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
    mark.rotation.x = -Math.PI / 2; mark.position.set(tx, groundY(tx, tz, 1.8) + 0.06, tz);      // 낙하 지점 경고 (대시로 피할 수 있다)
    m.userData = { vx: (tx - sx) / T, vz: (tz - sz) / T, vy: (0.5 * ROCK_G * T * T - y0) / T, t: 0, T, tx, tz, mark };
    scene.add(m, mark);
    rocks.push(m);
  }
  function explodeRock(r) {
    const { tx, tz, mark } = r.userData;
    const x = r.position.x, z = r.position.z;
    scene.remove(r); scene.remove(mark); mark.material.dispose();
    rocks.splice(rocks.indexOf(r), 1);
    burst({ x, z }, 30);                                                  // 붉은 폭발 파티클
    const g = new THREE.Group();                                          // 폭발 범위 섬광
    const f = new THREE.Mesh(boomGeo, new THREE.MeshBasicMaterial({ color: 0xff3b1a, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }));
    f.rotation.x = -Math.PI / 2; g.add(f); g.position.set(x, groundY(x, z, 2) + 0.1, z); g.userData.life = SLASH_LIFE * 1.5;
    scene.add(g); slashes.push(g);
    if (Math.hypot(player.position.x - x, player.position.z - z) < 25) shake = Math.max(shake, 0.4);
    for (const o of obstacles.slice()) {                                  // 광역 피해: 반경 내 모든 구조물 체력 -50
      if (o.userData.type === 'fence' && Math.hypot(o.position.x - x, o.position.z - z) < CFG.ROCK_SPLASH) damageStructure(o, CFG.ROCK_DAMAGE);
    }
    if (fireAlive && Math.hypot(x, z) < CFG.ROCK_SPLASH + FIRE_R) {       // 모닥불 직격
      fireHp -= CFG.ROCK_DAMAGE * dm().dmg;
      toast('The campfire was hit by a siege boulder!');
      if (fireHp <= 0) destroyFire();
    }
  }
  function updateRocks(dt) {
    for (const r of rocks.slice()) {
      const u = r.userData;
      u.t += dt; u.vy -= ROCK_G * dt;
      r.position.x += u.vx * dt; r.position.z += u.vz * dt; r.position.y += u.vy * dt;
      u.mark.material.opacity = 0.35 + 0.25 * Math.sin(u.t * 14);
      if (u.t >= u.T || r.position.y <= 0.3) explodeRock(r);               // 땅에 닿으면 폭발
    }
  }

  // ---------- 대시 (무적 포함) ----------
  let dashBonusT = 0, dashT = 0, dashCd = 0, invincibleT = 0, dashDX = 0, dashDZ = 0;
  const dashDist = () => CFG.DASH_DIST * (1 + 0.15 * pl.st.evade);
  function jump() {                                                         // 점프: 제자리 뛰기 동작 (공격·채집 중에는 못 한다)
    if (dead || blocking || dashT > 0 || gathering || atkLock > 0) return;
    if (playerAnim.jump()) { atkCd = Math.max(atkCd, 0.25); Snd.play('dash', 0.4); }
  }
  function dash() {
    if (dead || dashCd > 0 || dashT > 0) return;
    if (performance.now() - lastMT < 350) { dashDX = lastMX; dashDZ = lastMZ; } else { dashDX = Math.sin(facing); dashDZ = Math.cos(facing); }          // 입력 방향으로 (입력이 없으면 정면)
    { const fx = Math.sin(facing), fz = Math.cos(facing), f = dashDX * fx + dashDZ * fz, sd = dashDX * fz - dashDZ * fx; playerAnim.dodge(f > 0.5 ? 'f' : f < -0.5 ? 'b' : sd > 0 ? 'p' : 'n'); }       // 이동 방향에 맞는 회피 동작
    atkLock = 0; dashT = CFG.DASH_TIME; dashCd = CFG.DASH_CD * dashMul(); invincibleT = CFG.DASH_INVULN + 0.04 * pl.st.evade; dashBonusT = pl.st.vault ? 1.2 : 0; Snd.play('dash');
    dust(player.position.x, player.position.z);
  }
  const barBg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthTest: false, fog: false }));
  const barFill = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x7fd4ff, transparent: true, opacity: 0.6, depthTest: false, fog: false }));
  barBg.scale.set(1.3, 0.14, 1); barFill.center.set(0, 0.5);
  barBg.renderOrder = barFill.renderOrder = 10;
  barBg.visible = barFill.visible = false;
  scene.add(barBg, barFill);
  const gBg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthTest: false, fog: false }));
  const gFill = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffe08a, transparent: true, opacity: 0.6, depthTest: false, fog: false }));
  gBg.scale.set(1.3, 0.14, 1); gFill.center.set(0, 0.5);
  gBg.renderOrder = gFill.renderOrder = 10;
  gBg.visible = gFill.visible = false;
  scene.add(gBg, gFill);
  function updateGather(dt, moving) {
    if (!gathering) { gBg.visible = gFill.visible = false; return; }
    const g = gathering, o = g.target;
    const gone = !(exActive && exObjs.includes(o)) && !obstacles.includes(o) || Math.hypot(o.position.x - player.position.x, o.position.z - player.position.z) - o.userData.radius > GATHER_RANGE + 1;
    if (dead || moving || gone) {
      if (moving && !gone) toast('Gathering cancelled');
      gathering = null; gBg.visible = gFill.visible = false; return;
    }
    g.t += dt;
    facing = Math.atan2(o.position.x - player.position.x, o.position.z - player.position.z); player.rotation.y = facing;
    const need = o.userData.gatherTime || CFG.PLAYER_GATHER_TIME, prog = Math.min(1, g.t / need), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    gBg.visible = gFill.visible = true;
    { const gy = groundY(player.position.x, player.position.z, 0.9) + 0.04; gBg.position.set(player.position.x, gy, player.position.z); gFill.position.set(player.position.x - rx * 0.65, gy, player.position.z - rz * 0.65); }
    gFill.scale.set(Math.max(0.001, 1.3 * prog), 0.14, 1);
    if (g.t >= need) {
      scene.remove(o);
      if (o.userData.type === 'banditBanner') { exObjs.splice(exObjs.indexOf(o), 1); burnBanner(o); }
      else if (o.userData.type === 'chest') { exObjs.splice(exObjs.indexOf(o), 1); openChest(o); }
      else if (o.userData.type === 'siegeLadder') { exObjs.splice(exObjs.indexOf(o), 1); raiseLadder(o); }
      else {
        const pool = exObjs.includes(o) ? exObjs : obstacles; pool.splice(pool.indexOf(o), 1);
        res[o.userData.type] += gatherYield(o.userData.type); rollIron(o); Snd.play('chop');
        if (o.userData.ore) { const k = 2 + Math.floor(Math.random() * 3); res.iron += k; floatText(`Ore: Iron +${k}`, o.position.x, 2.4, o.position.z); }
      }
      updateHud();
      gathering = null; gBg.visible = gFill.visible = false;
    }
  }

  // ---------- 궁극기: 회전 강타 ----------
  let ultCd = 0;
  const ultBtnEl = document.getElementById('ultBtn'), ultCdEl = document.getElementById('ultCd');
  const ultGeo = new THREE.CircleGeometry(CFG.ULT_RADIUS, 40);
  function rally() {                                                  // 지휘형의 궁극기: 병사들 회복 + 8초간 공격력 +50%
    ultCd = CFG.RALLY_CD * (hasPerk('warlord') ? 0.7 : 1) * 0.88 ** pl.st.ult; rallyT = CFG.RALLY_TIME * (1 + 0.2 * pl.st.rally); Snd.play('horn'); shake = Math.max(shake, 0.3);
    const g = new THREE.Group();
    const m = new THREE.Mesh(ultGeo, new THREE.MeshBasicMaterial({ color: 0x8affc0, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.scale.setScalar(CFG.RALLY_RADIUS * (1 + 0.2 * pl.st.rally) / CFG.ULT_RADIUS); g.add(m);
    g.position.set(player.position.x, groundY(player.position.x, player.position.z, 3) + 0.12, player.position.z); g.userData.life = 0.45; scene.add(g); slashes.push(g);
    let k = 0;
    for (const n of npcs) {
      if (n.role === 'citizen' || n.down || (!inBanner(n) && Math.hypot(n.position.x - player.position.x, n.position.z - player.position.z) > CFG.RALLY_RADIUS)) continue;
      n.hp = Math.min(n.maxHp, n.hp + Math.round(n.maxHp * 0.3)); k++; floatText('Rally!', n.position.x, 3.0, n.position.z);
    }
    toast(`Rally Cry! ${k} soldier${k === 1 ? '' : 's'} fight harder for ${CFG.RALLY_TIME}s`);
  }
  function ultimate() {
    if (dead || ultCd > 0) return;
    if (playerClass === 'commander') return rally();
    ultCd = CFG.ULT_CD * (playerClass === 'warrior' ? 0.8 : 1) * (hasPerk('warlord') ? 0.7 : 1) * 0.88 ** pl.st.ult; Snd.play('ult');
    gathering = null;
    const g = new THREE.Group();                                     // 360도 원반형 검기
    const m = new THREE.Mesh(ultGeo, new THREE.MeshBasicMaterial({ color: 0xffd54a, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; g.add(m);
    g.position.set(player.position.x, groundY(player.position.x, player.position.z, 3) + 0.12, player.position.z); g.userData.life = 0.3;
    scene.add(g); slashes.push(g);
    shake = 0.7;
    let n = 0;
    for (const e of enemies.slice()) {                               // 반경 내 모든 적: 방패병 포함(검 피해는 방패 무시), 강한 넉백
      if (e.userData.sinking) continue;
      if (Math.hypot(e.position.x - player.position.x, e.position.z - player.position.z) < CFG.ULT_RADIUS + e.userData.r) {
        const wasCasting = e.userData.castT > 0;
        hitEnemy(e, CFG.ULT_DAMAGE * pDmg(), player.position.x, player.position.z, true, CFG.ULT_KB, true); n++;
        if (wasCasting && enemies.includes(e)) stunBoss(e);          // 캐스팅 중 궁극기 적중 → 지진 취소 + 기절
      }
    }
    if (n) floatText(`WHIRLWIND x${n}!`, player.position.x, 2.8, player.position.z);
  }

  // ---------- 베헤모스: 예고 링 / 기절 ----------
  const teleDiscGeo = new THREE.CircleGeometry(5, 32), teleRingGeo = new THREE.RingGeometry(0.985, 1, 64);
  function showTelegraph(e) {
    const u = e.userData;
    if (u.tele) return;
    const g = new THREE.Group();
    const mk = (geo) => new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }));
    const disc = mk(teleDiscGeo), ring = mk(teleRingGeo);
    ring.scale.set(CFG.QUAKE_MAX, CFG.QUAKE_MAX, 1);
    disc.rotation.x = ring.rotation.x = -Math.PI / 2;
    g.add(disc, ring); g.position.set(e.position.x, groundY(e.position.x, e.position.z, 3) + 0.1, e.position.z);
    scene.add(g); u.tele = g;
  }
  function hideTelegraph(e) { const u = e.userData; if (u.tele) { scene.remove(u.tele); u.tele = null; } }
  function resetBossLook(e) { if (e.material.emissive) { e.material.emissive.setHex(0x000000); e.material.emissiveIntensity = 0; } e.material.color.setHex(0x0b0b0e); }
  function stunBoss(e) {
    const u = e.userData;
    u.castT = 0; u.slamT = 0; hideTelegraph(e);
    u.stunT = CFG.BOSS_STUN_TIME; u.slamCd = CFG.BOSS_SLAM_INTERVAL;
    e.position.y = u.baseY + (u.gy || 0);
    if (e.material.emissive) { e.material.emissive.setHex(0x000000); e.material.emissiveIntensity = 0; }
    e.material.color.setHex(0x8a8a92);                                           // 기절: 회색
    floatText('COUNTER! STUNNED!', e.position.x, e.position.y + 5.8, e.position.z);
    shake = Math.max(shake, 0.6);
  }
  function bossRecover(e) { resetBossLook(e); e.userData.slamCd = 2; }

  // ---------- 베헤모스 충격파 (지진 강타) ----------
  const shocks = [];
  const shockGeo = new THREE.RingGeometry(0.92, 1, 64);
  function shoveNpc(n, ux, uz, dist) {
    n.position.x += ux * dist; n.position.z += uz * dist;
    for (const o of obstacles) {
      const ox = n.position.x - o.position.x, oz = n.position.z - o.position.z, min = o.userData.radius + PLAYER_R, od = Math.hypot(ox, oz);
      if (od < min && od > 1e-4) { n.position.x = o.position.x + ox / od * min; n.position.z = o.position.z + oz / od * min; }
    }
    n.position.x = Math.max(-MAP + 1, Math.min(MAP - 1, n.position.x)); n.position.z = Math.max(-MAP + 1, Math.min(MAP - 1, n.position.z));
  }
  function spawnShockwave(x, z) {
    const m = new THREE.Mesh(shockGeo, new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, groundY(x, z, 2) + 0.15, z); m.scale.set(0.1, 0.1, 1); sfxAt('boom', x, z);
    scene.add(m);
    shocks.push({ m, x, z, r: 0, hit: new Set() });
    burst({ x, z }, 24);
    if (Math.hypot(player.position.x - x, player.position.z - z) < 35) shake = Math.max(shake, 0.9);
  }
  function updateShocks(dt) {
    for (const s of shocks.slice()) {
      s.r += CFG.QUAKE_SPEED * dt;
      s.m.scale.set(s.r, s.r, 1);
      s.m.material.opacity = 0.8 * Math.max(0, 1 - s.r / CFG.QUAKE_MAX);
      const reach = (px, pz, pad = 0) => Math.hypot(px - s.x, pz - s.z) <= s.r + pad;
      for (const o of obstacles.slice()) {                                   // 충격파에 닿는 구조물: 거리가 멀수록 피해가 줄어든다
        if (o.userData.type === 'fence' && !s.hit.has(o) && reach(o.position.x, o.position.z)) {
          s.hit.add(o);
          const dd = Math.hypot(o.position.x - s.x, o.position.z - s.z);
          damageStructure(o, CFG.QUAKE_STRUCT_DMG * (1 - CFG.QUAKE_FALLOFF * Math.min(1, dd / CFG.QUAKE_MAX)));
        }
      }
      if (fireAlive && !s.hit.has('fire') && reach(0, 0)) { s.hit.add('fire'); fireHp -= CFG.QUAKE_FIRE_DMG * dm().dmg; if (fireHp <= 0) destroyFire(); }
      for (const n of npcs.slice()) {                                       // 동료/시민: 피해는 거의 없이 넉백만 (벽/건물/맵 밖으로 날아가지 않게 보정)
        if (n.down || s.hit.has(n) || !reach(n.position.x, n.position.z)) continue;
        s.hit.add(n);
        const dx = n.position.x - s.x, dz = n.position.z - s.z, d = Math.hypot(dx, dz) || 1;
        shoveNpc(n, dx / d, dz / d, CFG.QUAKE_NPC_KB);
        damageNpc(n, CFG.QUAKE_NPC_DMG);
      }
      if (!s.hit.has('player') && reach(player.position.x, player.position.z)) {
        s.hit.add('player');
        if (invincibleT <= 0) {                                              // 대시 무적이면 회피
          const dx = player.position.x - s.x, dz = player.position.z - s.z, d = Math.hypot(dx, dz) || 1;
          player.position.x += dx / d * CFG.QUAKE_KB; player.position.z += dz / d * CFG.QUAKE_KB;
          damage(CFG.QUAKE_PLAYER_DMG); shake = Math.max(shake, 0.6);
        }
      }
      if (s.r >= CFG.QUAKE_MAX) { scene.remove(s.m); s.m.material.dispose(); shocks.splice(shocks.indexOf(s), 1); }
    }
  }

  // ---------- 1장 클리어 → 무한 모드 ----------
  const clearEl = document.getElementById('clear');
  function onBossDefeated() {
    if (chapterCleared) return;
    chapterCleared = true;
    clearEl.classList.add('show'); setTimeout(() => clearEl.classList.remove('show'), 6000);
    for (const e of enemies.slice()) { if (e.userData.dying > 0) continue; burst(e.position, 6); removeEnemy(e); }       // 살아있는 모든 적 소멸
    for (const r of rocks.slice()) { scene.remove(r); scene.remove(r.userData.mark); rocks.splice(rocks.indexOf(r), 1); }
    wave.remaining = 0; wave.siegeLeft = 0; wave.bossLeft = 0;
    // 강제로 다음 아침(06:00)으로
    const dayIdx = Math.floor(gameMin / 1440), hourNow = (gameMin / 60) % 24;
    gameMin = (hourNow >= 6 ? dayIdx + 1 : dayIdx) * 1440 + 360;
    toast('Endless Mode begins - enemies grow stronger from Day 8');
  }

  const dashBtnEl = document.getElementById('dashBtn');
  function updateDash(dt) {
    dashCd = Math.max(0, dashCd - dt); invincibleT = Math.max(0, invincibleT - dt);
    bodyMat.transparent = true; bodyMat.opacity = invincibleT > 0 ? 0.45 : 1;       // 무적 중 반투명
    playerRig.root.rotation.x = dashT > 0 ? 0.35 : 0;
    // 쿨타임 게이지 (캐릭터 발밑, 카메라 기준 좌→우로 차오름)
    const show = dashCd > 0;
    barBg.visible = barFill.visible = show;
    if (show) {
      const prog = 1 - dashCd / (CFG.DASH_CD * dashMul()), rx = Math.cos(yaw), rz = -Math.sin(yaw);
      barBg.position.set(player.position.x, 0.25, player.position.z);
      barFill.position.set(player.position.x - rx * 0.65, 0.25, player.position.z - rz * 0.65);
      barFill.scale.set(Math.max(0.001, 1.3 * prog), 0.14, 1);
    }
    dashBtnEl.classList.toggle('cool', show); updateRestUi(); updateBar(dt);
    ultCd = Math.max(0, ultCd - dt);
    ultBtnEl.classList.toggle('cool', ultCd > 0);
    ultCdEl.textContent = ultCd > 0 ? `${Math.ceil(ultCd)}s` : 'E';
    const boss = enemies.find(e => e.userData.boss && !(e.userData.dying > 0));          // 보스 체력 바
    bossBarEl.style.display = boss ? 'block' : 'none';
    if (boss) bossFillEl.style.width = `${Math.max(0, boss.userData.hp / boss.userData.maxHp * 100)}%`;
  }
  const bossBarEl = document.getElementById('bossBar'), bossFillEl = document.getElementById('bossFill');

  // ---------- 체크포인트: 매일 아침 자동 저장 → 게임 오버 때 그날(또는 이전) 아침으로 되돌아가기 ----------
  const checkpoints = [];            // { day, label, snap } - 최근 4개
  function makeSnapshot() {
    const pos = (o) => ({ x: o.position.x, z: o.position.z });
    const res_ = (o) => o.userData.type === 'wood' || o.userData.type === 'stone';
    return {
      tw3: 1, gameMin, wbInfo: warbandInfo ? warbandInfo.map(x => ({ ...x })) : null, res: { ...res }, story: JSON.parse(JSON.stringify(story)), playerClass, perks: { ...perks }, order, playerGear: { ...playerGear }, weaponMode, hp, fireHp, designTier, townStage, stage, chapterCleared, lastWarnDay, lastRespawnDay,
      wave: { ...wave }, player: { ...pos(player), facing }, pl: { lvl: pl.lvl, xp: pl.xp, pend: pl.pend, st: { ...pl.st } }, tk: totalKills,
      nodes: obstacles.filter(res_).map(o => ({ t: o.userData.type, ...pos(o), rot: o.rotation.y })),
      fences: obstacles.filter(o => o.userData.type === 'fence').map(o => ({ level: o.userData.level, ...pos(o), rot: o.rotation.y, hp: o.userData.hp })),
      buildings: obstacles.filter(o => o.userData.type === 'building').map(o => {
        const stock = o.userData.stock ? { ...o.userData.stock } : null;
        if (stock) for (const n of npcs) if (n.carryGear) stock[n.carryGear]++;      // 수령하러 가던 장비는 선반으로 되돌려 저장
        return { kind: o.userData.kind, ...pos(o), stock, level: o.userData.level };
      }),
      bps: blueprints.map(b => ({ res: b.userData.res, bkind: b.userData.bkind, ...pos(b), rot: b.rotation.y })),
      gates: gateWaypoints.map(g => ({ ...g })),
      npcs: npcs.filter(n => !n.levy).map(n => ({ role: n.role, born: n.born, home: { ...n.home }, ...pos(n), hp: n.hp, name: n.name, trait: n.trait, mood: n.mood, gear: { ...n.gear }, hungry: n.hungry, xp: { ...n.xp }, pref: n.pref, sick: n.sick || 0, vxp: n.vxp || 0, cstr: n.cstr || 0, cspd: n.cspd || 0, cls: homeCls(n), clsTrip: n.clsTrip || null, clsSet: !!n.clsSet, mounted: !!n.mounted, warband: n.warband ?? null, promoteTo: n.promote ? n.promote.to : null })),
      boss: enemies.filter(e => e.userData.boss).map(e => ({ ...pos(e), hp: e.userData.hp })),
    };
  }
  function saveCheckpoint(label) {
    const day = Math.floor(gameMin / 1440) + 1;
    const i = checkpoints.findIndex(c => c.day === day);
    if (i >= 0) checkpoints.splice(i, 1);                                   // 같은 날은 최신 것으로 교체
    checkpoints.push({ day, label, snap: makeSnapshot() });
    checkpoints.sort((a, b) => a.day - b.day);
    while (checkpoints.length > 4) checkpoints.shift();
    saveGame();
  }
  function clearWorld() {
    for (const e of enemies.slice()) removeEnemy(e);
    for (const list of [rocks, arrows, shocks, particles, slashes, floaters]) {
      for (const o of list.slice()) {
        scene.remove(o.m || o); if (o.userData && o.userData.mark) scene.remove(o.userData.mark);
      }
      list.length = 0;
    }
    for (const o of obstacles.slice()) if (o !== campfire) scene.remove(o);
    obstacles.length = 0; obstacles.push(campfire);
    for (const b of blueprints) scene.remove(b);
    blueprints.length = 0;
    for (const d of doormats) scene.remove(d);
    doormats.length = 0; gateWaypoints.length = 0;
    for (const n of npcs) scene.remove(n);
    npcs.length = 0;
    reserved.wood = 0; reserved.stone = 0;
  }
  function applySnapshot(sn) {
    clearWorld();
    if (exActive) { cleanupZone(); exActive = null; } exEnding = false; updateExUi(); closeJournal();
    Object.assign(story, { stats: [], roads: [], relics: {}, said: {}, log: [], intro: false, exps: 0, beacon: false, dawn: false, crown: false, hollow: false, finale: false, road: false, wide: false, eclipse: false, dusk: false, champs: 0, camps: {}, cleared: {}, tales: {}, taleDay: 0, ms: {}, campFx: [], holds: {}, clearedDay: {} }, JSON.parse(JSON.stringify(sn.story || {}))); setBeacon(!!story.beacon); rebuildCamps();
    rebuildRoads(); totalKills = sn.tk || 0; Object.assign(pl, { lvl: 1, xp: 0, pend: 0 }, sn.pl || {}); pl.st = Object.assign(ST0(), (sn.pl && sn.pl.st) || {}); updateLvlUi();
    gameMin = sn.gameMin; res.wood = sn.res.wood; res.stone = sn.res.stone; res.food = sn.res.food || 0; res.iron = sn.res.iron || 0; res.shard = sn.res.shard || 0;
    for (const k of Object.keys(perks)) delete perks[k]; Object.assign(perks, sn.perks || {});
    if (sn.playerClass) { const keep = sn.hp; setClass(sn.playerClass); } else { playerClass = null; setTimeout(openDifficultyChoice, 700); }
    order = sn.order || 'guard'; document.getElementById('ordSub').textContent = `O · ${order === 'follow' ? 'Follow' : 'Guard'}`;
    Object.assign(playerGear, { sword: 'sword_basic', bow: 'bow_basic', armor: 'armor_none', great: 'great_basic', spear: 'spear_basic' }, sn.playerGear || {}); if (!(sn.playerGear && sn.playerGear.great)) playerGear.great = gearAtTier('great', gearDef(playerGear.sword).tier); if (!(sn.playerGear && sn.playerGear.spear)) playerGear.spear = gearAtTier('spear', gearDef(playerGear.sword).tier); weaponMode = sn.weaponMode; applyPlayerGear();
    closeSmith(); hp = sn.hp; fireHp = sn.fireHp;
    designTier = sn.designTier; townStage = sn.townStage || 0; if (!sn.tw3 && townStage >= 7) townStage++;          // older saves: the Great Wall Towers group was inserted at index 7 stage = sn.stage || 1; chapterCleared = sn.chapterCleared;
    buildHall(); updateStageUi();                                      // 시대에 맞는 회관/거주지 외형으로 복원
    lastWarnDay = sn.lastWarnDay; lastRespawnDay = sn.lastRespawnDay; Object.assign(wave, sn.wave);
    dead = false; fireAlive = true; flame.visible = stage === 1; hurtCd = 0; sinceHurt = 99; bossShakeT = 0; shake = 0;
    dashBonusT = dashT = dashCd = invincibleT = ultCd = atkT = atkCd = 0; gathering = null; replenishCd = 0;
    for (const n of sn.nodes) { const o = n.t === 'wood' ? makeTree() : makeRock(); o.position.set(n.x, 0, n.z); o.rotation.y = n.rot; scene.add(o); obstacles.push(o); }
    for (const f of sn.fences) { const o = f.level === 'stone' ? createWall(f.x, f.z, f.rot) : createFence(f.x, f.z, f.rot); o.userData.hp = f.hp; }
    for (const b of sn.buildings) { const o = createBuilding(b.kind, b.x, b.z); if (b.level) { if (b.kind === 'house') { o.userData.level = b.level; setHouseModel(o); } else setBuildingLevel(o, b.level); } if (b.stock) { Object.assign(o.userData.stock, b.stock); refreshRack(o); } }
    for (const b of sn.bps) { if (b.bkind) addBuildingBlueprint(b.bkind, b.x, b.z); else addBlueprint(b.res, b.x, b.z, b.rot); }
    for (const g of sn.gates) { addGate(g.x, g.z, g.r, g.nx, g.nz); if (g.lv > 1) setGateLevel(gateWaypoints[gateWaypoints.length - 1], g.lv); }
    if (sn.wbInfo) warbandInfo = sn.wbInfo.map(x => ({ ...x }));
    for (const d of sn.npcs) {
      const n = makeNpc(d.role, d.home, d.born, 0, { name: d.name, trait: d.trait, mood: d.mood, xp: d.xp, pref: d.pref, sick: d.sick }); n.vxp = d.vxp || 0; n.cstr = d.cstr || 0; n.cspd = d.cspd || 0; n.position.set(d.x, 0, d.z); n.hp = d.hp; n.px = d.x; n.pz = d.z;
      n.cls = d.cls || 'sword'; n.clsHome = n.cls; n.clsSet = !!d.clsSet; if (d.mounted) { n.mounted = true; applyMount(n); } n.clsTrip = d.clsTrip || null; { const wb = d.warband ?? d.squad; if (n.role !== 'citizen' && wb !== undefined && wb !== null) n.warband = wb; }       // 예전 저장(squad)도 읽는다
      if (d.gear) { n.gear = { armor: 'armor_none', ...d.gear }; applyGear(n); } else if (n.role === 'melee') applyGear(n);
      n.hungry = !!d.hungry;
      if (d.promoteTo) n.promote = { to: d.promoteTo, target: builtBuildings(d.promoteTo === 'melee' ? 'barracks' : 'range')[0] };
    }
    npc = npcs[0];
    player.position.set(sn.player.x, 0, sn.player.z); facing = sn.player.facing; player.rotation.y = facing;
    camera.position.copy(goalPos(camGoal)); lookAt.set(sn.player.x, LOOK_H, sn.player.z);
    for (const b of sn.boss) { wave.day = sn.wave.day; spawnEnemy('boss'); const e = enemies[enemies.length - 1]; e.position.x = b.x; e.position.z = b.z; e.userData.hp = b.hp; }
    // UI 동기화
    document.getElementById('gameover').style.display = 'none';
    clearEl.classList.remove('show'); warnEl.classList.remove('show');
    updateHud(); hpEl.textContent = Math.ceil(hp); updateDesignBtn(); updatePopUi();
    document.getElementById('swapCur').textContent = `Q · ${WEAPON_NAME[weaponMode] || 'Sword'}`;
    updateTownBtn();
  }
  function rewindTo(cp) {
    applySnapshot(cp.snap);
    for (let i = checkpoints.length - 1; i >= 0; i--) if (checkpoints[i].day > cp.day) checkpoints.splice(i, 1);     // 되돌린 시점보다 미래의 저장은 폐기
    toast(`Rewound to ${cp.label}`);
  }
  function renderRewindButtons() {
    const box = document.getElementById('goRewind');
    box.innerHTML = '';
    [...checkpoints].reverse().forEach((cp, i) => {
      const b = document.createElement('button');
      b.textContent = i === 0 ? `Rewind to ${cp.label} (most recent morning)` : `Rewind to ${cp.label}`;
      b.addEventListener('click', () => rewindTo(cp));
      box.appendChild(b);
    });
  }

  // ---------- 디버그: 보스전 바로 테스트 (Shift+B: Day 7 준비 / Shift+N: 보스 소환, 주소 뒤에 ?debug=1 이면 버튼 표시) ----------
  function debugSetup() {
    if (dead) return;
    res.wood += 400; res.stone += 400; res.iron += 60;
    setStage(3);                                                // 디버그: 3시대(석조 요새)로
    if (!playerClass) setClass('warrior');
    for (const a of [1, 2, 3]) if (!perks[a]) choosePerk(a, CFG.PERKS[a][0].id);
    const finishAll = () => { for (const b of blueprints.slice()) {                // 도면을 즉시 완성
      blueprints.splice(blueprints.indexOf(b), 1); scene.remove(b);
      if (b.userData.bkind) createBuilding(b.userData.bkind, b.position.x, b.position.z);
      else createStructure(b.userData.res, b.position.x, b.position.z, b.rotation.y);
    } };
    while (CFG.DESIGN[designTier] && (!CFG.DESIGN[designTier].stage || stage >= CFG.DESIGN[designTier].stage)) designDefense();
    finishAll();                                              // 바깥 성벽이 먼저 완성되어야 바깥 구역 계획을 세울 수 있다
    for (let r = 0; r < 3; r++) { for (let g = 0; townStage < CFG.TOWN_GROUPS.length && g < 10; g++) designTown(); finishAll(); }          // 둘째 주택 묶음은 첫 묶음이 지어진 뒤에 계획된다
    morningTown();                                            // 시민 스폰 → 병영/사격장 전직 즉시 완료
    for (const c of npcs.filter(n => n.promote)) setRole(c, c.promote.to);
    const sm = smiths()[0];                                   // 디버그: 대장간 선반에 장비를 채워 병사들이 수령하게 한다
    if (sm) { sm.userData.stock.iron_sword += 3; sm.userData.stock.strong_bow += 2; sm.userData.stock.iron_armor += 4; sm.userData.stock.steel_sword += 1; refreshRack(sm); }
    playerGear.sword = 'iron_sword'; playerGear.great = 'iron_great'; playerGear.spear = 'iron_spear'; applyPlayerGear();
    for (const e of enemies.slice()) removeEnemy(e);
    for (const r of rocks.slice()) { scene.remove(r); scene.remove(r.userData.mark); rocks.splice(rocks.indexOf(r), 1); }
    healPlayer(pMaxHp()); fireHp = fireMax();
    chapterCleared = false; wave.day = 0; wave.bossLeft = 0;
    gameMin = (CFG.BOSS_DAY - 1) * 1440 + 17 * 60 + 30;       // Day 7 17:30
    lastWarnDay = CFG.BOSS_DAY - 1; lastRespawnDay = CFG.BOSS_DAY;
    updateHud();
    toast('DEBUG: Day 7 17:30 - defenses, town, and troops ready');
  }
  // 디버그: 새 게임을 n단계에서 시작한다. 단계 조건(건물·성벽·인구·점령·날짜)을 모두 채우고 능력도 고른다 (시작 화면의 Debug start)
  function debugFinishAll() {
    for (const b of blueprints.slice()) {
      blueprints.splice(blueprints.indexOf(b), 1); scene.remove(b);
      if (b.userData.bkind) createBuilding(b.userData.bkind, b.position.x, b.position.z);
      else createStructure(b.userData.res, b.position.x, b.position.z, b.rotation.y);
    }
  }
  function debugJump(n) {
    n = Math.max(1, Math.min(CFG.STAGES.length, n | 0)); if (n < 2 || dead) return;
    res.wood += 4000; res.stone += 4000; res.iron += 600; res.food += 600;
    if (!playerClass) setClass('warrior');
    for (let st = 1; st <= n; st++) {
      if (st > 1) setStage(st);
      if (!perks[st]) choosePerk(st, CFG.PERKS[st][0].id);
      let guard = 0;
      while (CFG.DESIGN[designTier] && (!CFG.DESIGN[designTier].stage || stage >= CFG.DESIGN[designTier].stage) && guard++ < 6) designDefense();
      debugFinishAll();
      for (let r = 0; r < 3; r++) { for (let g = 0; townStage < CFG.TOWN_GROUPS.length && CFG.TOWN_GROUPS[townStage].stage <= stage && g < 10; g++) designTown(); debugFinishAll(); }
    }
    if (n >= 4) story.cleared.legionfort = true;                                 // 4단계 조건: 거점 점령
    if (n >= 5) story.cleared.legioncastle = true;                               // 5단계 조건: 성 점령
    for (let i = 0; i < 8; i++) morningTown();                                   // 시민 입주 → 병영/사격장 전직
    for (const c of npcs.filter(x => x.promote)) setRole(c, c.promote.to);
    const sm = smiths()[0];
    if (sm) { for (const id in sm.userData.stock) sm.userData.stock[id] += 2; refreshRack(sm); }
    for (const e of enemies.slice()) removeEnemy(e);
    healPlayer(pMaxHp()); fireHp = fireMax();
    const need = CFG.STAGE_GATES[n] ? CFG.STAGE_GATES[n].day : 1;
    wave.day = 0; wave.bossLeft = 0; chapterCleared = false;
    gameMin = (Math.max(need, 4) - 1) * 1440 + 8 * 60; lastWarnDay = dayNow() - 1; lastRespawnDay = dayNow();
    tut.done = true; player.position.set(0, 0, CFG.HALL_RADIUS[n - 1] + 5);
    updateHud(); refreshTech && refreshTech();
    toast(`DEBUG start: Stage ${n} - ${npcs.length} people, ${builtBuildings('house').length} homes, day ${dayNow()}`);
  }
  function debugBoss() { debugSetup(); gameMin = (CFG.BOSS_DAY - 1) * 1440 + 21 * 60 + 40; }   // Day 7 21:40 → 곧 보스 등장
  addEventListener('keydown', e => { if (e.shiftKey && e.code === 'KeyB') debugSetup(); if (e.shiftKey && e.code === 'KeyN') debugBoss(); });
  if (/[?&]debug/.test(location.search)) {
    document.getElementById('dbg').style.display = 'flex';
    document.getElementById('dbgSetup').addEventListener('click', debugSetup);
    document.getElementById('dbgBoss').addEventListener('click', debugBoss);
  }

  // ---------- 방어 타워(3시대) / 식량 사용 ----------
  function updateTowers(dt) {
    for (const t of obstacles) {
      if (t.userData.type !== 'building' || t.userData.kind !== 'tower') continue;
      t.userData.shootCd -= dt;
      if (t.userData.shootCd > 0) continue;
      let foe = null, bd = CFG.TOWER_RANGE * (hasPerk('engineer') ? 1.25 : 1);
      for (const e of enemies) {
        if (e.userData.sinking || e.userData.ex) continue;                   // 떠돌이(prowl)와 낮에 어슬렁거리는 적도 쏜다
        const d = Math.hypot(e.position.x - t.position.x, e.position.z - t.position.z);
        if (d < bd) { bd = d; foe = e; }
      }
      if (!foe) continue;
      t.userData.shootCd = CFG.TOWER_INTERVAL * (1 - 0.12 * (lvOf(t) - 1));
      sfxAt('bow', t.position.x, t.position.z);
      fireArrow(t.position.x, t.position.z, Math.atan2(foe.position.x - t.position.x, foe.position.z - t.position.z), false, CFG.TOWER_DMG * (hasPerk('engineer') ? 1.5 : 1) * (1 + 0.35 * (lvOf(t) - 1)), 4.9, bd);
    }
  }
  let eatCd = 0;
  function eat() {
    if (dead || res.food < CFG.FOOD_MEAL || hp >= pMaxHp() || eatCd > 0) return;
    res.food -= CFG.FOOD_MEAL; healPlayer(CFG.FOOD_HEAL); eatCd = 6; updateHud();
    floatText(`Meal +${CFG.FOOD_HEAL}`, player.position.x, 2.6, player.position.z);
  }
  // 매일 아침(06:00) 시민 1명당 식량 1개를 소비한다. 식량이 모자라면 굶주린 시민은 이동·작업 속도 50%
  function feedCitizens() {
    const cs = npcs.filter(n => n.role === 'citizen');
    if (!cs.length) return;
    let fed = 0, starving = 0;
    for (const c of cs) {
      const need = rationOf(c);
      if (res.food >= need) { res.food -= need; c.hungry = false; fed++; } else { c.hungry = true; starving++; }
    }
    updateHud();
    const msg = starving ? `${starving} citizen${starving > 1 ? 's are' : ' is'} starving! Speed and work halved - grow more food` : `Morning rations: ${fed} Food eaten by citizens`;
    setTimeout(() => { toast(msg); if (starving) Snd.play('growl'); }, 1600);
  }
  function updateFood(dt) {
    eatCd -= dt;
    {                                                                    // 굶주린 시민은 식량이 생기는 즉시 먹는다
      const h = npcs.find(n => n.hungry && n.role === 'citizen' && !n.down && res.food >= rationOf(n));
      if (h) { res.food -= rationOf(h); h.hungry = false; updateHud(); floatText('Fed!', h.position.x, 3.2, h.position.z); }
    }
    if (hp < pMaxHp() * CFG.FOOD_AUTO_BELOW) eat();           // 체력이 절반 미만이면 자동 식사
  }
  addEventListener('keydown', e => { if (e.code === 'KeyV' && !e.repeat) eat(); });

  // ---------- 습격의 날 안내 UI ----------
  const raidEl = document.getElementById('raidInfo'), raidTxtEl = document.getElementById('raidTxt');
  let raidTxt = '';
  function updateRaidUi(hour, dayNo) {
    const night = hour >= 18 || hour < 7, nd = hour < 7 ? dayNo - 1 : dayNo;
    let text, cls = '';
    if (exActive) {
      const nowM = gameMin % 1440, target = exActive.night ? (nowM >= 720 ? 1440 + CFG.EXP_NIGHT_FORCE * 60 : CFG.EXP_NIGHT_FORCE * 60) : CFG.EXP_FORCE * 60;
      const left = Math.max(0, Math.ceil((target - nowM) / (MIN_PER_SEC * CFG.EXP_TIME_MULT))), mm = Math.floor(left / 60), ss = String(left % 60).padStart(2, '0');
      if (left <= 30 && !exActive.warned) { exActive.warned = true; toast(exActive.night ? 'Dawn is near - about 30 seconds left. Grab the last chests!' : 'Time is nearly up - about 30 seconds left. Grab the last chests!'); }
      const chests = exObjs.filter(o => o.userData.type === 'chest'), foes = enemies.filter(e => e.userData.ex && !(e.userData.dying > 0));
      let near = null, nd0 = Infinity; for (const c of chests) { const d = Math.hypot(c.position.x - player.position.x, c.position.z - player.position.z); if (d < nd0) { nd0 = d; near = c; } }
      let arrow = ''; if (near) {
        const f = camera.getWorldDirection(new THREE.Vector3()), tx = near.position.x - player.position.x, tz = near.position.z - player.position.z;
        const rel = Math.atan2(tx * -f.z + tz * f.x, tx * f.x + tz * f.z); arrow = ` ${['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'][(Math.round(rel / (Math.PI / 4)) + 8) % 8]}${Math.round(nd0)}m`;
      }
      const t = exActive.training ? `Training Field · ☠${foes.length} · kills ${exStats.kills} · ✊${Math.round(courageOf())}` : `${exActive.dest.name} · home in ${mm}:${ss} · 🎁${chests.length}${arrow} · ☠${foes.length} · ✊${Math.round(courageOf())}${exCamp ? (exCamp.broken ? ' · camp broken ✔' : exCamp.alarm ? ' · ALARM' : exActive.prep ? ' · PREPARING' : ' · chief alive') : ''}`; if (t !== raidTxt) { raidTxt = t; raidTxtEl.textContent = t; raidEl.className = 'soon'; } return; }
    if (night) {
      if (isRaid(nd)) { text = `🌑 Blood Moon raid: ${realmDef(realmOfNight(nd)).short}`; cls = 'blood'; }
      else { const left = nextRaidFrom(nd + 1) - nd, tp = nightTypeOf(nd); text = `${tp === 'calm' ? 'Quiet night' : NIGHT_INFO[tp][0]} · ${left} day${left > 1 ? 's' : ''} until the next big raid`; cls = left <= 1 ? 'soon' : ''; }
    } else if (isRaid(dayNo)) { text = '⚠ Blood Moon raid tonight!'; cls = 'blood'; }
    else { const left = nextRaidFrom(dayNo) - dayNo, tp = nightTypeOf(dayNo); text = `${left} day${left > 1 ? 's' : ''} until the next big raid` + (tp !== 'calm' ? ` · Tonight: ${NIGHT_INFO[tp][0]}` : ''); cls = left <= 1 ? 'soon' : ''; }
    if (text !== raidTxt) { raidTxt = text; raidTxtEl.textContent = text; raidEl.className = cls; }
  }

  // ---------- 경고 UI / 자원 리스폰 ----------
  const warnEl = document.getElementById('warn');
  let warnTimer;
  function showWarning(msg) {
    buzz([120, 60, 120]); warnEl.textContent = msg; warnEl.classList.add('show'); Snd.play(/Behemoth|massive/.test(msg) ? 'roar' : /^Warning/.test(msg) ? 'bell' : 'horn');
    clearTimeout(warnTimer); warnTimer = setTimeout(() => warnEl.classList.remove('show'), 3000);
  }
  const countType = (t) => obstacles.filter(o => o.userData.type === t).length;
  // 자원 보충: 나무/바위가 목표 수보다 적으면 (플레이어·동료·청사진·출입구·성벽 통행로를 피해) 채워 넣는다
  function resourceFree() {
    return (x, z) => Math.hypot(x - player.position.x, z - player.position.z) > 6 &&
      npcs.every(n => Math.hypot(x - n.position.x, z - n.position.z) > 4) &&
      blueprints.every(b => Math.hypot(x - b.position.x, z - b.position.z) > 3) &&
      gateWaypoints.every(g => Math.hypot(x - g.x, z - g.z) > 3.5) &&
      gateWaypoints.every(g => Math.abs(cheb(x, z) - g.r) > CFG.CORRIDOR_WIDTH + 1);      // 성벽 통행로에는 생성 금지
  }
  function topUpResources(maxPerType = Infinity) {
    const free = resourceFree(), before = obstacles.length;
    scatter(makeTree, Math.min(maxPerType, Math.max(0, CFG.TREE_COUNT - countType('wood'))), free);
    scatter(makeRock, Math.min(maxPerType, Math.max(0, CFG.STONE_COUNT - countType('stone'))), free);
    return obstacles.length - before;
  }
  function respawnResources() { if (topUpResources() > 0) toast('Morning has come. Resources have regrown'); }
  let replenishCd = 0;
  function replenishTick(dt) {                 // 하루 한 번이 아니라 수시로 보충해서 자원이 바닥나지 않게 한다
    replenishCd -= dt;
    if (replenishCd > 0 || dead) return;
    replenishCd = CFG.REPLENISH_INTERVAL;
    topUpResources(CFG.REPLENISH_BATCH);
  }
  // 벌목장/채석장 주변에는 자원이 다시 자라나서 시민이 멀리 나가지 않고도 계속 일할 수 있다
  function spawnNear(factory, cx, cz, rMin, rMax) {
    const free = resourceFree();
    const o = factory();
    for (let i = 0; i < 30; i++) {
      const a = rand(0, Math.PI * 2), r = rand(rMin, rMax), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (Math.max(Math.abs(x), Math.abs(z)) > MAP - 3 || Math.hypot(x, z) < 6 || inRiver(x, z) || !free(x, z)) continue;
      if (obstacles.some(p => Math.hypot(p.position.x - x, p.position.z - z) < p.userData.radius + o.userData.radius + 0.8)) continue;
      o.position.set(x, 0, z); o.rotation.y = rand(0, Math.PI * 2); scene.add(o); obstacles.push(o);
      return true;
    }
    return false;
  }
  let regrowCd = 0;
  function siteRegrowTick(dt) {
    regrowCd -= dt;
    if (regrowCd > 0 || dead) return;
    regrowCd = CFG.SITE_REGROW;
    for (const b of obstacles) {
      if (b.userData.type !== 'building' || (b.userData.kind !== 'lumber' && b.userData.kind !== 'quarry')) continue;
      const type = b.userData.kind === 'lumber' ? 'wood' : 'stone';
      const near = obstacles.filter(o => o.userData.type === type && Math.hypot(o.position.x - b.position.x, o.position.z - b.position.z) < CFG.WORK_RADIUS).length;
      if (near < 10) spawnNear(type === 'wood' ? makeTree : makeRock, b.position.x, b.position.z, 4, 11);
    }
  }
  let lastWarnDay = 0, lastRespawnDay = 1, bossShakeT = 0, lastGuardDay = 0;


  // ---------- 원정(Expedition): 낮에 마을 밖의 별도 지역으로 떠나 자원·유물을 얻고 해 지기 전에 돌아온다 ----------
  const fmtH = (h) => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
  const exMeshes = [];
  const fadeEl = document.getElementById('fade');
  function fadeTo(fn) { fadeEl.style.opacity = 1; setTimeout(() => { fn(); fadeEl.style.opacity = 0; }, 380); }
  const oreMat = mat(0x4a3f4c), chestWood = mat(0x7a4f2a), chestGold = new THREE.MeshBasicMaterial({ color: 0xffd45a }), chestBand = mat(0xb9892a), ruinMat = mat(0x7d7f86), flagMat = mat(0xc0392b);
  const exAdd = (m, solid) => { scene.add(m); (solid ? exObjs : exMeshes).push(m); return m; };
  function makeChest(x, z, relic) {
    const gr = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.7), chestWood); body.position.y = 0.3;
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.22, 0.74), relic ? chestGold : chestBand); lid.position.y = 0.7;
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.64, 0.74), chestBand); band.position.y = 0.32;
    gr.add(body, lid, band); gr.traverse(m => { if (m.isMesh) m.castShadow = true; });
    gr.position.set(x, 0, z); gr.rotation.y = rand(0, 6.28);
    gr.userData = { type: 'chest', radius: 0.9, relic: !!relic };
    const col = relic ? 0xffe27a : 0xffc060;                                         // 상자: 멀리서도 보이는 빛기둥 + 빛무리
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.26, 22, 10, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    beam.position.y = 11; gr.add(beam); exBeams.push(beam); addGlow(gr, col, relic ? 3.2 : 2.2, 0.8);
    return exAdd(gr, true);
  }
  const glowCache = new Map();
  function addGlow(parent, color, scale, y) {                    // 어두운 곳에서도 보이는 빛무리 (추가 조명 없이 스프라이트만 사용)
    let m = glowCache.get(color);
    if (!m) { m = new THREE.SpriteMaterial({ map: smokeTex, color, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }); glowCache.set(color, m); }
    const s = new THREE.Sprite(m); s.scale.setScalar(scale); s.position.y = y; parent.add(s); return s;
  }
  const exBeams = [], FOE_GLOW = { frost: 0x8fd0ff, hollow: 0xb08cff, wisp: 0x7affd0, ash: 0xffa060 };
  const FACTION_COLOR = { frost: new THREE.Color(0x9fd6ff), hollow: new THREE.Color(0xb08cff), night: new THREE.Color(0x6f7cff), wisp: new THREE.Color(0x7affd0), ash: new THREE.Color(0xff9a5a) };
  function frostTint(e, faction = 'frost') {                        // 서리 세력: 몸 재질을 복제해 푸르게 물들인다 (공유 재질은 건드리지 않는다)
    const map = new Map();
    e.traverse(o => { if (o.isMesh && o.material && o.material.color && !o.material.isMeshBasicMaterial) { let c = map.get(o.material); if (!c) { c = o.material.clone(); c.skinning = o.material.skinning; c.color.lerp(FACTION_COLOR[faction] || FACTION_COLOR.frost, 0.55); map.set(o.material, c); } o.material = c; } });
    if (map.has(e.material)) e.material = map.get(e.material);
  }
  // ---------- 산적 야영지 (습격 Raid): 목책 · 문 · 감시탑 · 천막 · 모닥불 · 우두머리 천막. 목책은 막히는 지형 (적의 길 막힘은 다음 단계) ----------
  const campWood = texMat(0x72502e, 'wood', 0.9), campDark = mat(0x3f2a1a), campTent = [mat(0xa08358), mat(0x8a5a44), mat(0x7a7048)], campRed = mat(0x6a1c1c), campStone = texMat(0x8a8d96, 'stone', 0.4), campStoneDark = texMat(0x5e616b, 'stone', 0.4), campGateMat = mat(0x3a2a1c);
  let exStats = { kills: 0, t0: 0 };                                 // 이번 원정의 전투 기록 (보고서용)
  let siegeLoad = { ram: 0, ladder: 0, catapult: 0 };                             // 이번 원정에 가져온 공성 장비
  let exCamp = null;                                                // { cx, cz, R, banner, fire }: 현재 습격 지역의 야영지 정보
  function buildBanditCamp(d, cx, cz, inner) {
    const C = d.camp, R = C.radius, gateA = -Math.PI / 2, segs = Math.round(2 * Math.PI * R / 2.6), step = Math.PI * 2 / segs;
    const solids = [], stone = !!C.stone, stake = new THREE.ConeGeometry(0.3, 0.8, 4), plank = stone ? new THREE.BoxGeometry(2.8, 4.2, 0.9) : C.gate ? new THREE.BoxGeometry(2.7, 3.6, 0.55) : new THREE.BoxGeometry(2.7, 2.2, 0.45), wallM = stone ? campStone : campWood;
    for (let i = 0; i < segs; i++) {                                // 목책: 남쪽(입구 쪽)에 문 틈을 남기고 빙 둘러 세운다
      const a = i * step; let ad = a - (gateA + Math.PI * 2); ad = Math.atan2(Math.sin(ad), Math.cos(ad));
      if (Math.abs(ad) < step * 1.6) continue;
      const g = new THREE.Group(), body = new THREE.Mesh(plank, wallM); body.position.y = stone ? 2.1 : C.gate ? 1.8 : 1.1;
      for (const o of [-0.95, 0, 0.95]) { const s = new THREE.Mesh(stone ? new THREE.BoxGeometry(0.7, 0.6, 0.95) : stake, stone ? campStoneDark : campDark); s.position.set(o, stone ? 4.5 : C.gate ? 4.0 : 2.6, 0); g.add(s); }
      g.add(body); g.traverse(m => { if (m.isMesh) m.castShadow = true; });
      g.position.set(cx + Math.cos(a) * R, 0, cz + Math.sin(a) * R); g.rotation.y = -a - Math.PI / 2; g.userData = { type: 'palisade', radius: 1.45, wall: true };
      exAdd(g, true); solids.push(g);
    }
    for (const s of [-1, 1]) {                                      // 문기둥: 높은 기둥 두 개와 붉은 천
      const a = gateA + s * step * 1.9, g = new THREE.Group(), pole = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 5, 7), campDark), cloth = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.3, 0.06), campRed);
      pole.position.y = 2.5; cloth.position.set(0.55, 4.1, 0); g.add(pole, cloth); g.position.set(cx + Math.cos(a) * R, 0, cz + Math.sin(a) * R); g.userData = { type: 'gatepost', radius: 0.5 }; exAdd(g, true);
    }
    let gate = null;
    if (C.gate) {                                                   // 성문: 닫힌 문짝 셋 (체력이 있다). 부수기 전에는 아무도 지나지 못한다
      gate = { hp: C.gate, maxHp: C.gate, broken: false, parts: [], x: cx, z: cz - R };
      for (const ox of [-2.7, 0, 2.7]) {
        const g = new THREE.Group(), door = new THREE.Mesh(new THREE.BoxGeometry(2.7, 4.4, 0.6), campGateMat), band = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.25, 0.7), campStoneDark);
        door.position.y = 2.2; band.position.y = 1.2; const band2 = band.clone(); band2.position.y = 3.3; g.add(door, band, band2); g.traverse(m => { if (m.isMesh) m.castShadow = true; });
        g.position.set(cx + ox, 0, cz - R); g.userData = { type: 'palisade', radius: 1.45, wall: true, gatePart: true }; exAdd(g, true); gate.parts.push(g); solids.push(g);
      }
    }
    const towers = [];
    for (let k = 0; k < C.towers; k++) {                            // 감시탑: 네 모서리 (망루 위 궁수 배치는 다음 단계)
      const a = Math.PI / 4 + k * (Math.PI * 2 / C.towers), g = new THREE.Group();
      for (const [lx, lz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 5.2, 6), stone ? campStone : campWood); leg.position.set(lx, 2.6, lz); g.add(leg); }
      const deck = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.25, 3.4), campWood); deck.position.y = 5.2;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.9, 1.4, 4), campTent[1]); roof.position.y = 8.5; roof.rotation.y = Math.PI / 4;
      g.add(deck, roof);
      for (const [lx, lz] of [[-1.55, -1.55], [1.55, -1.55], [-1.55, 1.55], [1.55, 1.55]]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 3, 5), campWood); post.position.set(lx, 6.7, lz); g.add(post); }      // 지붕 기둥 (난간은 낮게: 궁수가 보이고 쏜다)
      for (const [bx, bz, sx, sz] of [[0, -1.65, 3.4, 0.1], [0, 1.65, 3.4, 0.1], [-1.65, 0, 0.1, 3.4], [1.65, 0, 0.1, 3.4]]) { const rl = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.4, sz), campDark); rl.position.set(bx, 5.55, bz); g.add(rl); }
      g.traverse(m => { if (m.isMesh) m.castShadow = true; });
      g.position.set(cx + Math.cos(a) * (R - 0.2), 0, cz + Math.sin(a) * (R - 0.2)); g.userData = { type: 'campTower', radius: 2.1 }; exAdd(g, true); towers.push(g); solids.push(g);
      inner.push({ x: g.position.x, z: g.position.z, r: 3 });
    }
    for (let k = 0; k < C.tents; k++) {                             // 천막: 안쪽 둘레에 빙 둘러
      const a = k * (Math.PI * 2 / C.tents) + 0.4; if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.5) continue;       // 우두머리 천막 자리는 비운다
      const rr = R * 0.62, g = new THREE.Group(), t = new THREE.Mesh(new THREE.ConeGeometry(1.9, 2.5, 6), campTent[k % 3]);
      t.position.y = 1.25; g.add(t); g.traverse(m => { if (m.isMesh) m.castShadow = true; });
      g.position.set(cx + Math.cos(a) * rr, 0, cz + Math.sin(a) * rr); g.rotation.y = rand(0, 6); g.userData = { type: 'tent', radius: 1.8 }; exAdd(g, true); solids.push(g);
      inner.push({ x: g.position.x, z: g.position.z, r: 2.4 });
    }
    if (stone) { const g = new THREE.Group(), kp = new THREE.Mesh(new THREE.BoxGeometry(7, 6.4, 6), campStone); kp.position.y = 3.2; const top = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.8, 6.6), campStoneDark); top.position.y = 6.6; g.add(kp, top); g.traverse(m => { if (m.isMesh) m.castShadow = true; }); g.position.set(cx, 0, cz + R * 0.6); g.userData = { type: 'tent', radius: 4.4 }; exAdd(g, true); inner.push({ x: cx, z: cz + R * 0.6, r: 5 }); }
    else { const g = new THREE.Group(), t = new THREE.Mesh(new THREE.ConeGeometry(2.9, 3.4, 7), campRed);     // 우두머리 천막: 더 크고 붉다
      t.position.y = 1.7; g.add(t); g.traverse(m => { if (m.isMesh) m.castShadow = true; }); g.position.set(cx, 0, cz + R * 0.5); g.userData = { type: 'tent', radius: 2.6 }; exAdd(g, true); inner.push({ x: cx, z: cz + R * 0.5, r: 3.6 }); }
    const fire = new THREE.Group();                                  // 가운데 모닥불
    for (let k = 0; k < 3; k++) { const l = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.2, 0.2), campDark); l.position.y = 0.12; l.rotation.y = k * 1.05; fire.add(l); }
    addGlow(fire, 0xff8a3a, 5, 1.0); fire.position.set(cx, 0, cz); fire.userData = { type: 'campfire', radius: 0.8 }; exAdd(fire, true); inner.push({ x: cx, z: cz, r: 2 });
    const banner = new THREE.Group(), bp = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 5.5, 6), campDark), bc = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 0.06), campRed);   // 산적 깃발 (다음 단계의 목표물)
    bp.position.y = 2.75; bc.position.set(0.85, 4.8, 0); banner.add(bp, bc); banner.position.set(cx + 3.2, 0, cz - 1.5); banner.userData = { type: 'banditBanner', radius: 0.5, gatherTime: 3 }; exAdd(banner, true); inner.push({ x: cx + 3.2, z: cz - 1.5, r: 1.5 });
    for (let k = 0; k < C.chests; k++) { const a = k * 2.1 + 1.0, p = { x: cx + Math.cos(a) * R * 0.34, z: cz + Math.sin(a) * R * 0.34 }; makeChest(p.x, p.z, false); inner.push({ x: p.x, z: p.z, r: 1.6 }); }
    const ladders = [], oil = [];
    const ladderMesh = () => { const g = new THREE.Group(), wd = mat(0x8a6038); for (const lx of [-0.45, 0.45]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 6.4, 0.12), wd); rail.position.set(lx, 3.2, 0); g.add(rail); } for (let k = 0; k < 9; k++) { const rung = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 0.1), wd); rung.position.y = 0.5 + k * 0.68; g.add(rung); } g.traverse(m => { if (m.isMesh) m.castShadow = true; }); return g; };
    for (let k = 0; k < (C.gate ? Math.min(C.ladders || 0, siegeLoad.ladder) : 0); k++) {                    // 사다리: 성벽 밖 땅에 누워 있다. 주인공이 일으켜 세우면 그 자리에서 성벽을 넘을 수 있다 (오래 두면 수비병이 밀어 넘어뜨린다)
      const a = [gateA - 1.0, gateA + 1.0, 0][k % 3], pg = new THREE.Group(), lm = ladderMesh();
      lm.rotation.x = Math.PI / 2; lm.position.y = 0.2; pg.add(lm); pg.position.set(cx + Math.cos(a) * (R + 4), 0, cz + Math.sin(a) * (R + 4)); pg.rotation.y = -a - Math.PI / 2;
      pg.userData = { type: 'siegeLadder', radius: 1.3, gatherTime: 2, a, k }; exAdd(pg, true); ladders.push({ a, pickup: pg, mesh: null, up: false, t: 0, segs: [] });
    }
    for (let k = 0; k < (C.oil || 0); k++) {                        // 끓는 기름 항아리: 성벽 위. 문 양옆 둘과 옆구리 둘 (망치와 사다리를 노린다)
      const a = [gateA - 0.32, gateA + 0.32, gateA - 1.4, gateA + 1.4, gateA - 2.4, gateA + 2.4][k % 6], g = new THREE.Group(), pot = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.4, 0.7, 8), campDark);
      pot.position.y = 4.55; addGlow(g, 0xff7a2a, 2.2, 1.2); g.add(pot); g.position.set(cx + Math.cos(a) * (R - 0.4), 0, cz + Math.sin(a) * (R - 0.4)); exAdd(g, false); oil.push({ x: g.position.x, z: g.position.z, cd: 4 + k * 1.6, mesh: g });
    }
    let ram = null;
    if (gate && siegeLoad.ram > 0) {                                                       // 공성 망치: 성문 앞 멀리에서 시작한다 (다음 단계에서 대장간에서 만들어 가져온다)
      const g = new THREE.Group(), wood = mat(0x7a5632);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.4, 4.4), wood); frame.position.y = 0.75;
      const roof = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.25, 4.0), mat(0x5a3d22)); roof.position.y = 2.1; roof.rotation.z = 0;
      for (const [px, pz] of [[-0.85, -1.8], [0.85, -1.8], [-0.85, 1.8], [0.85, 1.8]]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.4, 0.16), wood); post.position.set(px, 1.45, pz); g.add(post); const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.2, 8), campDark); wh.rotation.z = Math.PI / 2; wh.position.set(px * 1.15, 0.42, pz); g.add(wh); }
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 4.8, 8), mat(0x8a6038)); log.rotation.x = Math.PI / 2; log.position.y = 1.3; log.name = 'ramLog';
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.8, 8), campStoneDark); head.rotation.x = Math.PI / 2; head.position.set(0, 1.3, 2.8);
      g.add(frame, roof, log, head); g.traverse(m => { if (m.isMesh) m.castShadow = true; });
      g.position.set(cx, 0, cz - R - 12); exAdd(g, false);
      ram = { mesh: g, log, hp: 120, maxHp: 120, dead: false, hitCd: 1.2, recoil: 0, gx: cx, gz: cz - R - 3.2, sz: cz - R - 12 };
    }
    let cat = null;
    if (gate && siegeLoad.catapult > 0) {                              // 투석기: 성벽 동쪽 바깥에 놓인다. 곁에 사람이 있어야 쏜다
      const g = new THREE.Group(), wood = mat(0x7a5632), base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 3.4), wood); base.position.y = 0.7;
      for (const [px, pz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.2, 8), campDark); wh.rotation.z = Math.PI / 2; wh.position.set(px, 0.5, pz); g.add(wh); }
      for (const px of [-0.8, 0.8]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.2, 0.2), wood); post.position.set(px, 1.7, 0); g.add(post); }
      const armPivot = new THREE.Group(); armPivot.position.set(0, 2.6, 0); const arm = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 4.4), mat(0x8a6038)); arm.position.z = -1.1; const bucket = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.9), campDark); bucket.position.set(0, 0.2, 1.1); armPivot.add(arm, bucket); armPivot.rotation.x = 0.6;
      g.add(base, armPivot); g.traverse(m => { if (m.isMesh) m.castShadow = true; });
      g.position.set(cx + R + 11, 0, cz); g.rotation.y = -Math.PI / 2; exAdd(g, false);
      cat = { mesh: g, arm: armPivot, hp: CFG.SIEGE.CAT_HP, dead: false, cd: 4, anim: 0, shots: 0, ball: null, flight: 0, tx: 0, tz: 0, sx: 0, sz: 0, target: null };
    }
    return { cx, cz, R, towers, banner, fire, solids, gate, ram, cat, ladders, oil, drops: [], load: { ...siegeLoad }, alarm: false, broken: false };
  }
  function buildZone(d) {
    exR = d.training ? (d.siege ? 80 : 62) : d.castle ? 80 : d.camp && (d.bands >= 2 || d.camp.radius >= 15) ? 62 : 46;          // 큰 전투일수록 들판이 넓다
    const big = exR / 46, cnt = (n) => Math.round(n * big * big * 0.75), campDz = Math.round((exR - 46) * 0.3);
    const geo = new THREE.CircleGeometry(exR, 56); geo.rotateX(-Math.PI / 2);
    const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: d.tint, flatShading: true, roughness: 1 }));
    ground.position.set(EXC.x, 0.02, EXC.z); ground.receiveShadow = true; exAdd(ground, false);
    const nRim = Math.round(26 * big);
    for (let i = 0; i < nRim; i++) {                                 // 지역 테두리: 큰 바위들
      const a = i / nRim * Math.PI * 2, s = rand(1.4, 2.4), r = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rockMat);
      r.position.set(EXC.x + Math.cos(a) * (exR - 2), s * 0.5, EXC.z + Math.sin(a) * (exR - 2)); r.castShadow = true; exAdd(r, false);
    }
    const flag = new THREE.Group();                                   // 귀환 깃발 (입구)
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4, 6), lampPostMat); pole.position.y = 2;
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.8, 0.05), flagMat); cloth.position.set(0.7, 3.5, 0);
    flag.add(pole, cloth); flag.position.set(EXC.x, 0, EXC.z - (exR - 10)); exAdd(flag, false);
    const taken = [{ x: EXC.x, z: EXC.z - (exR - 12), r: 7 + (exR - 46) * 0.3 }];
    const spot = (rad) => {                                           // 겹치지 않는 위치 찾기
      for (let k = 0; k < 40; k++) {
        const a = rand(0, 6.28), rr = Math.sqrt(Math.random()) * (exR - 8), x = EXC.x + Math.cos(a) * rr, z = EXC.z + Math.sin(a) * rr;
        if (taken.every(t => Math.hypot(x - t.x, z - t.z) > t.r + rad)) { taken.push({ x, z, r: rad }); return { x, z }; }
      }
      return { x: EXC.x + rand(-30, 30) * big, z: EXC.z + rand(-20, 30) * big };
    };
    exCamp = null; const inner = [];
    if (d.camp) { const cx = EXC.x, cz = EXC.z + 6 + campDz; exCamp = buildBanditCamp(d, cx, cz, inner); taken.push({ x: cx, z: cz, r: d.camp.radius + 2.5 }); }
    const innerSpot = (rad) => {                                      // 야영지 안쪽의 빈 자리
      const C = exCamp; if (!C) return spot(rad);
      for (let k = 0; k < 40; k++) {
        const a = rand(0, 6.28), rr = Math.sqrt(Math.random()) * (C.R - 3.5), x = C.cx + Math.cos(a) * rr, z = C.cz + Math.sin(a) * rr;
        if (inner.every(t => Math.hypot(x - t.x, z - t.z) > t.r + rad)) { inner.push({ x, z, r: rad }); return { x, z }; }
      }
      return spot(rad);
    };
    for (let i = 0, nT = cnt(d.trees); i < nT; i++) { const o = makeTree(), p = spot(1.8); o.position.set(p.x, 0, p.z); exAdd(o, true); }
    for (let i = 0, nR = cnt(d.rocks); i < nR; i++) { const o = makeRock(), p = spot(1.6); o.position.set(p.x, 0, p.z); exAdd(o, true); }
    for (let i = 0; i < d.ore; i++) {
      const o = makeRock(), p = spot(1.8); o.scale.setScalar(1.25); o.userData.radius *= 1.25; o.userData.ore = true;
      o.traverse(m => { if (m.isMesh) m.material = oreMat; });
      o.position.set(p.x, 0, p.z); exAdd(o, true);
    }
    for (let i = 0; i < (d.ruins || 0); i++) {                        // 폐허 기둥: 막히는 지형
      const h = rand(1.6, 4), p = spot(1.6), m = new THREE.Mesh(new THREE.BoxGeometry(rand(0.8, 1.3), h, rand(0.8, 1.3)), ruinMat);
      m.position.set(p.x, h / 2, p.z); m.rotation.y = rand(0, 3); m.castShadow = m.receiveShadow = true; m.userData = { type: 'ruin', radius: 0.9 }; exAdd(m, true);
    }
    for (let i = 0; i < d.chests; i++) { const p = spot(2.2); makeChest(p.x, p.z, !!d.relic && i === d.chests - 1); }
    const foeList = d.foes.slice(); for (let i = Math.round(d.foes.length * (dm().n - 1)); i > 0; i--) foeList.push(d.foes[Math.floor(Math.random() * d.foes.length)]);
    let fi = 0;
    for (const kind of foeList) { const inside = exCamp && fi++ % 4 !== 3, p = inside ? innerSpot(1.4) : spot(2.5); spawnEnemy(kind, p); if (inside) { enemies[enemies.length - 1].userData.camp = true; enemies[enemies.length - 1].userData.home = { x: p.x, z: p.z }; } if (d.faction) frostTint(enemies[enemies.length - 1], d.faction); addGlow(enemies[enemies.length - 1], FOE_GLOW[d.faction] || 0xff6a4a, 1.7, 1.2); }
    if (exCamp && d.camp.towerArchers) for (let k = 0; k < d.camp.towerArchers; k++) {          // 망루 위 궁수: 마주 보는 탑 둘에 올라간다
      const t = exCamp.towers[Math.floor(k * exCamp.towers.length / d.camp.towerArchers) % exCamp.towers.length]; spawnEnemy('archer', { x: t.position.x, z: t.position.z });
      const e = enemies[enemies.length - 1], u = e.userData; u.tower = true; u.camp = true; u.baseY = 6.13; e.position.y = 6.13; u.speed = 0;
    }
    if (d.guardian) {                                                 // 수호자: 커다랗고 단단한 우두머리. 쓰러뜨리면 보상 상자가 나온다
      const p = exCamp ? { x: exCamp.cx - 2, z: exCamp.cz + exCamp.R * 0.3 } : spot(4); spawnEnemy(d.guardian.kind, p);
      const e = enemies[enemies.length - 1], u = e.userData, s = d.guardian.scale; if (exCamp) { u.camp = true; u.home = { x: p.x, z: p.z }; }
      u.hp *= d.guardian.hpMul; u.maxHp = u.hp; u.guardian = true; u.contact *= 1.3; u.r *= s; u.baseY *= s;
      e.scale.multiplyScalar(s); e.position.y = u.baseY;
      if (d.faction) frostTint(e, d.faction);
      addGlow(e, 0xffd45a, 3.4, 1.4);
      const lbl = textSprite(d.guardian.name || 'Guardian', '#ffcf5a', 1.5, 0.5, 'bold 56px sans-serif'); lbl.position.set(0, 2.5, 0); e.add(lbl);
    }
  }
  function cleanupZone() {
    for (const o of exMeshes.concat(exObjs)) scene.remove(o);
    if (exCamp) for (const d of exCamp.drops || []) { scene.remove(d.ring); scene.remove(d.ball); }
    clearAllPosts(); exMeshes.length = 0; exObjs.length = 0; exBeams.length = 0; exCamp = null; for (const n of npcs) n.ramCrew = false;
    for (const e of enemies.slice()) if (e.userData.ex) removeEnemy(e);
  }
  function endPrep(why) {
    if (!exActive || !exActive.prep) return;
    exActive.prep = false; toast(why ? `${why} The battle begins!` : 'The battle begins!'); Snd.play('horn'); wbBarHtml = ''; renderWbBar();
  }
  function exEnemyStep(e, u, dt) {
    const px = player.position.x - e.position.x, pz = player.position.z - e.position.z, pd = Math.hypot(px, pz);
    let tx = player.position.x, tz = player.position.z, td = pd, tn = null, near = pd;           // 가장 가까운 상대: 플레이어 또는 동행 병사
    for (const n of npcs) if (n.escort && !n.down) {
      const d = Math.hypot(n.position.x - e.position.x, n.position.z - e.position.z);
      if (d < near) near = d;
      if (d < td - 1.5 && d < 10) { td = d; tx = n.position.x; tz = n.position.z; tn = n; }
    }
    const C = exCamp;
    if (exActive && exActive.prep) {                                          // 준비 단계: 아직 싸움이 시작되지 않았다. 가까이 다가가거나 먼저 치면 끝난다
      if (u.hp < (u.hpPrev ?? u.hp) || (C && Math.hypot(player.position.x - C.cx, player.position.z - C.cz) < C.R + 22) || near < 14) endPrep(u.hp < (u.hpPrev ?? u.hp) ? 'First blood!' : 'The foe has seen you!');
    }
    const prep = !!(exActive && exActive.prep);
    if (u.tower) {                                                            // 망루 궁수: 제자리에서 사거리 안의 상대를 쏜다
      u.atkAnimCd -= dt; u.anim.base('idle', 0);
      if (near < 22 && !prep && !(C && C.broken) && !(u.stunT > 0)) { e.lookAt(tx, e.position.y, tz); u.range = 20; archerStep(e, u, dt); }
      return;
    }
    if (C && u.camp && u.hp < (u.hpPrev ?? u.hp)) campAlarm();                // 맞으면 경보
    u.hpPrev = u.hp;
    if (C && u.camp) {                                                        // 야영지 병사: 가까이 오거나 경보가 울리면 달려들고, 아니면 자리를 지킨다
      const was = u.aggro;
      u.aggro = C.broken || prep ? false : (u.aggro ? near < 26 : near < (C.alarm ? 32 : 12));
      if (u.aggro && !was) campAlarm();
    } else u.aggro = exActive && !prep ? (u.aggro ? near < 24 : near < 13) : false;
    let moving = false; u.escortCd = (u.escortCd || 0) - dt;
    if (u.kbT > 0) { u.kbT -= dt; e.position.x += u.kbVx * dt; e.position.z += u.kbVz * dt; }
    else if (u.aggro && td > 0.9 && !(u.stunT > 0)) {
      const r = campRoute(e.position.x, e.position.z, tx, tz), rd = Math.max(0.01, Math.hypot(r.x - e.position.x, r.z - e.position.z));
      e.position.x += (r.x - e.position.x) / rd * u.speed * dt; e.position.z += (r.z - e.position.z) / rd * u.speed * dt; e.lookAt(r.x, e.position.y, r.z); moving = true;
    } else if (C && u.camp && u.home && !u.aggro && !(u.stunT > 0)) {         // 자리로 돌아간다 (문을 거쳐서)
      const r = campRoute(e.position.x, e.position.z, u.home.x, u.home.z), hd = Math.hypot(u.home.x - e.position.x, u.home.z - e.position.z);
      if (hd > 1.0) { const rd = Math.max(0.01, Math.hypot(r.x - e.position.x, r.z - e.position.z)); e.position.x += (r.x - e.position.x) / rd * u.speed * 0.8 * dt; e.position.z += (r.z - e.position.z) / rd * u.speed * 0.8 * dt; e.lookAt(r.x, e.position.y, r.z); moving = true; }
    }
    if (C) exPush(e, u.r);
    if (u.archer && u.aggro) { u.range = 14; archerStep(e, u, dt); }
    const dx = e.position.x - EXC.x, dz = e.position.z - EXC.z, dd = Math.hypot(dx, dz);
    if (dd > exR - 4) { e.position.x = EXC.x + dx / dd * (exR - 4); e.position.z = EXC.z + dz / dd * (exR - 4); }
    u.anim.base(moving ? 'walk' : 'idle', u.speed); u.atkAnimCd -= dt;
    if (td < (tn ? 0.45 : PLAYER_R) + u.r + 0.15) {
      if (tn) { if (u.escortCd <= 0 && !(u.stunT > 0)) { u.escortCd = 0.9; damageEscort(tn, u.contact * 0.7); } }
      else if (hurtCd <= 0 && !(u.stunT > 0)) { damage(u.contact); hurtCd = 0.8; shake = Math.max(shake, 0.15); }
      if (u.atkAnimCd <= 0) { u.atkAnimCd = 0.9; u.anim.once('attackSword'); }
    }
  }
  // ---------- 10단계: 동행 병사 (원정에 함께 간 병사는 플레이어를 따라다니며 원정 지역의 적과 싸운다. 쓰러져도 영구 사망하지 않고 집으로 옮겨진다) ----------
  function damageEscort(n, dmg) {
    if (n.down || (exActive && exActive.training)) return;
    n.hp = Math.max(0, n.hp - Math.max(1, Math.round(dmg * dm().dmg * (1 - gearDef(n.gear.armor).reduce) * standardMods(n).guard * (TR(n).dmg || 1))));
    if (n.hp <= 0) { n.down = true; n.mat.color.set(0x777777); n.anim.die(); grieve(); addCourage(-CFG.COURAGE.FALL); toast(`${n.name} is down - they will be carried home`); }
  }
  // ---------- 야영지 행동: 목책 때문에 안팎을 오갈 때는 남쪽 문을 거친다 / 목책·탑·천막은 적도 뚫지 못한다 / 경보 / 우두머리를 쓰러뜨리면 야영지가 무너진다 ----------
  function campRoute(x, z, tx, tz) {
    const C = exCamp; if (!C) return { x: tx, z: tz };
    const inA = Math.hypot(x - C.cx, z - C.cz) < C.R - 0.5, inB = Math.hypot(tx - C.cx, tz - C.cz) < C.R - 0.5;
    if (inA === inB) return { x: tx, z: tz };
    let gx = C.cx, gz = C.cz - C.R;
    if (C.gate && !C.gate.broken) {                                         // 성문이 닫혀 있으면 세워진 사다리 쪽으로 (없으면 문 앞에서 막힌다)
      let bd = 1e9; for (const L of C.ladders || []) if (L.up) { const lx = C.cx + Math.cos(L.a) * C.R, lz = C.cz + Math.sin(L.a) * C.R, d = Math.hypot(lx - x, lz - z); if (d < bd) { bd = d; gx = lx; gz = lz; } }
      if (bd < 1e9) { const dx = gx - C.cx, dz = gz - C.cz, dl = Math.hypot(dx, dz) || 1; if (Math.hypot(gx - x, gz - z) < 1.8) return inA ? { x: gx + dx / dl * 5, z: gz + dz / dl * 5 } : { x: gx - dx / dl * 5, z: gz - dz / dl * 5 }; return { x: gx, z: gz }; }
    }
    if (Math.hypot(gx - x, gz - z) < 1.8) return inA ? { x: gx, z: gz - 5 } : { x: gx, z: gz + 5 };       // 문을 지나는 중이면 그 너머를 향한다
    return { x: gx, z: gz };
  }
  function exPush(e, r) {
    const C = exCamp; if (!C) return;
    for (const o of C.solids) {
      const dx = e.position.x - o.position.x, dz = e.position.z - o.position.z, m = o.userData.radius + r * 0.7, d = Math.hypot(dx, dz);
      if (d < m && d > 1e-4) { e.position.x = o.position.x + dx / d * m; e.position.z = o.position.z + dz / d * m; }
    }
  }
  const dropGeo = new THREE.SphereGeometry(0.4, 8, 6), dropMat = new THREE.MeshBasicMaterial({ color: 0xff8a2a }), ringGeo = new THREE.RingGeometry(1.6, 2.2, 24), ringMat = new THREE.MeshBasicMaterial({ color: 0xff4a1a, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
  function oilTick(dt) {                                             // 성벽 위 기름 항아리: 가까운 표적(주인공·병사·망치) 아래에 붉은 표시를 하고 잠시 뒤 끓는 기름을 쏟는다
    const C = exCamp; if (!C || !C.oil || C.broken) return;
    for (const o of C.oil) {
      o.cd -= dt; if (o.cd > 0) continue;
      let best = null, bd = 10.5;
      const cand = []; if (!dead) cand.push({ x: player.position.x, z: player.position.z });
      for (const n of npcs) if (n.escort && !n.down) cand.push({ x: n.position.x, z: n.position.z });
      if (C.ram && !C.ram.dead) cand.push({ x: C.ram.mesh.position.x, z: C.ram.mesh.position.z + 1.4, ram: true });
      for (const t of cand) { const d = Math.hypot(t.x - o.x, t.z - o.z); if (Math.hypot(t.x - C.cx, t.z - C.cz) > C.R + 0.5 && d < bd) { bd = d; best = t; } }
      if (!best) { o.cd = 1.2; continue; }
      o.cd = rand(5.5, 8);
      const ring = new THREE.Mesh(ringGeo, ringMat.clone()); ring.rotation.x = -Math.PI / 2; ring.position.set(best.x, 0.06, best.z); scene.add(ring);
      const ball = new THREE.Mesh(dropGeo, dropMat); ball.position.set(o.x, 4.6, o.z); scene.add(ball);
      C.drops.push({ x: best.x, z: best.z, sx: o.x, sz: o.z, t: 0, ring, ball });
      sfxAt('bow', o.x, o.z);
    }
    for (let i = C.drops.length - 1; i >= 0; i--) {
      const d = C.drops[i]; d.t += dt; const u = Math.min(1, d.t / 1.1);
      d.ball.position.set(d.sx + (d.x - d.sx) * u, 4.6 * (1 - u * u) + 0.3, d.sz + (d.z - d.sz) * u); d.ring.material.opacity = 0.25 + 0.35 * Math.abs(Math.sin(d.t * 9));
      if (d.t < 1.1) continue;
      scene.remove(d.ring); scene.remove(d.ball); C.drops.splice(i, 1);
      burst({ x: d.x, z: d.z }, 10); sfxAt('boom', d.x, d.z); floatText('BOILING OIL!', d.x, 2.2, d.z);
      const dmgE = CFG.ENEMY_CONTACT_DMG * 1.6;
      if (!dead && invincibleT <= 0 && Math.hypot(player.position.x - d.x, player.position.z - d.z) < 2.3) { damage(dmgE); hurtCd = Math.max(hurtCd, 0.4); }
      for (const n of npcs) if (n.escort && !n.down && Math.hypot(n.position.x - d.x, n.position.z - d.z) < 2.3) damageEscort(n, dmgE);
      if (C.ram && !C.ram.dead && Math.hypot(C.ram.mesh.position.x - d.x, C.ram.mesh.position.z + 1.4 - d.z) < 3) C.ram.hp -= 18;
    }
  }
  function raiseLadder(o) {                                          // 사다리를 일으켜 세운다: 그 자리의 성벽 두 칸이 낮아져 넘어갈 수 있다
    const C = exCamp; if (!C) return;
    const L = C.ladders.find(l => l.pickup === o); if (!L || L.up) return;
    const a = L.a, wx = C.cx + Math.cos(a) * C.R, wz = C.cz + Math.sin(a) * C.R;
    const g = new THREE.Group(), lm = (() => { const q = new THREE.Group(), wd = mat(0x8a6038); for (const lx of [-0.45, 0.45]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 6.4, 0.12), wd); rail.position.set(lx, 3.2, 0); q.add(rail); } for (let k = 0; k < 9; k++) { const rung = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 0.1), wd); rung.position.y = 0.5 + k * 0.68; q.add(rung); } return q; })();
    lm.rotation.x = 0.42; lm.position.z = -2.4; g.add(lm); g.position.set(wx, 0, wz); g.rotation.y = -a - Math.PI / 2; scene.add(g); exMeshes.push(g);
    L.mesh = g; L.up = true; L.t = 0; L.segs = [];
    for (const w of C.solids.slice()) if (w.userData.wall && !w.userData.gatePart && Math.hypot(w.position.x - wx, w.position.z - wz) < 3.2) { L.segs.push({ w, sy: w.scale.y }); w.scale.y = 0.3; C.solids.splice(C.solids.indexOf(w), 1); const i = exObjs.indexOf(w); if (i >= 0) exObjs.splice(i, 1); }
    toast('Ladder raised! Climb over the wall'); Snd.play('chop'); campAlarm();
  }
  function dropLadder(L, why) {                                      // 수비병이 사다리를 밀어 넘어뜨리면 성벽이 다시 막힌다
    const C = exCamp; if (!C || !L.up) return;
    L.up = false; if (L.mesh) { scene.remove(L.mesh); const i = exMeshes.indexOf(L.mesh); if (i >= 0) exMeshes.splice(i, 1); L.mesh = null; }
    for (const s of L.segs) { s.w.scale.y = s.sy; C.solids.push(s.w); exObjs.push(s.w); } L.segs = [];
    L.lost = true; toast(why || 'The defenders pushed the ladder over and it broke!');
  }
  function ladderTick(dt) {
    const C = exCamp; if (!C || !C.ladders) return;
    for (const L of C.ladders) {
      if (!L.up || L.perm) continue;
      const wx = C.cx + Math.cos(L.a) * C.R, wz = C.cz + Math.sin(L.a) * C.R;
      const mine = Math.hypot(player.position.x - wx, player.position.z - wz) < 7 || npcs.some(n => n.escort && !n.down && Math.hypot(n.position.x - wx, n.position.z - wz) < 5);
      const foes = enemies.some(e => e.userData.ex && !e.userData.sinking && !e.userData.tower && Math.hypot(e.position.x - wx, e.position.z - wz) < 7 && Math.hypot(e.position.x - C.cx, e.position.z - C.cz) < C.R);
      L.t += dt * (foes && !mine ? 1 : foes ? 0.35 : -0.5); L.t = Math.max(0, L.t);
      if (L.t > 14 && !L.perm) dropLadder(L);
    }
  }
  function breachWall(a, perm) {                                     // 성벽의 (각도 a) 자리 세 칸을 낮춘다 (투석기 명중: 영구)
    const C = exCamp; if (!C) return; const wx = C.cx + Math.cos(a) * C.R, wz = C.cz + Math.sin(a) * C.R, segs = [];
    for (const w of C.solids.slice()) if (w.userData.wall && !w.userData.gatePart && Math.hypot(w.position.x - wx, w.position.z - wz) < 4.6) { segs.push({ w, sy: w.scale.y }); w.scale.y = 0.28; C.solids.splice(C.solids.indexOf(w), 1); const i = exObjs.indexOf(w); if (i >= 0) exObjs.splice(i, 1); }
    C.ladders.push({ a, pickup: null, mesh: null, up: true, t: 0, segs, perm: !!perm, lost: false, breach: true });
    toast('The wall is breached!'); shake = Math.max(shake, 0.8); campAlarm(); floatText('WALL BREACHED!', wx, 4, wz);
  }
  function catapultTick(dt) {                                        // 투석기: 곁에 주인공이나 병사 둘이 있으면 일정 시간마다 돌덩이를 던진다. 먼저 성벽 동쪽을 세 번 때려 허물고, 그다음엔 가까운 망루의 궁수를 노린다
    const C = exCamp, K = C && C.cat; if (!K || K.dead) return;
    const m = K.mesh, near = (!dead && Math.hypot(player.position.x - m.position.x, player.position.z - m.position.z) < 6) || npcs.filter(n => n.escort && !n.down && Math.hypot(n.position.x - m.position.x, n.position.z - m.position.z) < 6).length >= 2;
    for (const e of enemies) { const u = e.userData; if (!u.ex || u.sinking || u.dying > 0 || u.tower) continue; if (Math.hypot(e.position.x - m.position.x, e.position.z - m.position.z) < 3.6) K.hp -= dt * (u.kind === 'brute' ? 7 : 3.5); }
    if (K.hp <= 0) { K.dead = true; scene.remove(m); toast('The catapult is lost!'); floatText('CATAPULT LOST', m.position.x, 3, m.position.z); return; }
    if (K.ball) {                                                    // 날아가는 돌덩이
      K.flight += dt / 1.4; const u = Math.min(1, K.flight);
      K.ball.position.set(K.sx + (K.tx - K.sx) * u, 1.8 + 7 * Math.sin(u * Math.PI), K.sz + (K.tz - K.sz) * u);
      if (u >= 1) {
        scene.remove(K.ball); K.ball = null; burst({ x: K.tx, z: K.tz }, 16); sfxAt('boom', K.tx, K.tz); shake = Math.max(shake, 0.45);
        for (const e of enemies.slice()) { const v = e.userData; if (!v.ex || v.sinking || v.dying > 0) continue; if (Math.hypot(e.position.x - K.tx, e.position.z - K.tz) < 4) hitEnemy(e, CFG.SIEGE.CAT_DMG, K.tx, K.tz, true, null, true); }
        K.shots++;
        if (K.target && K.target.tower) { K.target.tower.userData.hits = (K.target.tower.userData.hits || 0) + 1; if (K.target.tower.userData.hits >= 2) { K.target.tower.scale.y = 0.6; for (const e of enemies.slice()) if (e.userData.tower && Math.hypot(e.position.x - K.target.tower.position.x, e.position.z - K.target.tower.position.z) < 2.5) { e.userData.hp = 0; hitEnemy(e, 9999, K.tx, K.tz, false, null, true); } floatText('TOWER HIT!', K.tx, 3, K.tz); } }
        else if (K.target && K.target.wall) { K.wallHits = (K.wallHits || 0) + 1; floatText(`WALL CRACKS ${K.wallHits}/3`, K.tx, 4, K.tz); if (K.wallHits >= 3) breachWall(0, true); }
      }
    }
    if (K.anim > 0) { K.anim = Math.max(0, K.anim - dt * 1.8); K.arm.rotation.x = 0.6 - 2.0 * Math.sin((1 - K.anim) * Math.PI * 0.5); } else K.arm.rotation.x += (0.6 - K.arm.rotation.x) * Math.min(1, dt * 2);
    if (!near || C.broken) return; K.cd -= dt; if (K.cd > 0 || K.ball) return;
    K.cd = CFG.SIEGE.CAT_RELOAD; K.anim = 1;
    const wallOpen = (K.wallHits || 0) >= 3; let tw = null, bd = 1e9;
    if (wallOpen) for (const t of C.towers) { if ((t.userData.hits || 0) >= 2) continue; const d = Math.hypot(t.position.x - m.position.x, t.position.z - m.position.z); if (d < bd) { bd = d; tw = t; } }
    K.sx = m.position.x; K.sz = m.position.z;
    if (tw) { K.target = { tower: tw }; K.tx = tw.position.x; K.tz = tw.position.z; } else if (!wallOpen) { K.target = { wall: true }; K.tx = C.cx + C.R - 0.3; K.tz = C.cz + (Math.random() - 0.5) * 3; } else { K.target = null; K.tx = C.cx + C.R * 0.4; K.tz = C.cz; }
    K.ball = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), mat(0x55585e)); K.ball.position.set(K.sx, 2.6, K.sz); scene.add(K.ball); K.flight = 0; sfxAt('boom', K.sx, K.sz);
  }
  function castleTick(dt) { ramTick(dt); oilTick(dt); ladderTick(dt); catapultTick(dt); }
  function ramCrewPower() {                                          // 망치를 미는 힘: 곁의 병사 1명당 1, 주인공이 뒤에서 밀면 2
    const R = exCamp && exCamp.ram; if (!R || R.dead) return 0;
    const px = R.mesh.position.x, pz = R.mesh.position.z; let pw = 0;
    for (const n of npcs) if (n.escort && !n.down && n.ramCrew && Math.hypot(n.position.x - px, n.position.z - pz) < 4.5) pw++;
    if (!dead && Math.hypot(player.position.x - px, player.position.z - (pz - 2.4)) < 3.2) pw += 2;
    return pw;
  }
  function ramTick(dt) {                                             // 성문 부수는 망치: 밀 사람이 있으면 문 앞까지 나아가 때린다. 가까운 적에게 맞아 부서질 수 있다
    const C = exCamp, R = C && C.ram, G = C && C.gate; if (!R || R.dead) return;
    if (G.broken) { for (const n of npcs) n.ramCrew = false; return; }
    const m = R.mesh, pw = ramCrewPower();
    for (const e of enemies) { const u = e.userData; if (!u.ex || u.sinking || u.dying > 0) continue; if (Math.hypot(e.position.x - m.position.x, e.position.z - m.position.z) < 3.4) R.hp -= dt * (u.kind === 'brute' ? 7 : u.kind === 'archer' ? 1 : 3.5); }
    if (R.hp <= 0) { R.dead = true; scene.remove(m); for (const n of npcs) n.ramCrew = false; toast('The ram is lost! Break the gate by hand'); shake = Math.max(shake, 0.5); floatText('RAM LOST', m.position.x, 3, m.position.z); return; }
    if (pw >= 2 && m.position.z < R.gz) { m.position.z = Math.min(R.gz, m.position.z + Math.min(3.0, 0.8 * pw) * dt); }
    else if (pw >= 2 && m.position.z >= R.gz) {
      R.hitCd -= dt * (0.6 + 0.2 * pw);
      if (R.hitCd <= 0) { R.hitCd = 1.8; R.recoil = 1; gateHit(16, true); sfxAt('boom', G.x, G.z); shake = Math.max(shake, 0.35); }
    }
    if (R.recoil > 0) { R.recoil = Math.max(0, R.recoil - dt * 2.2); R.log.position.z = -Math.sin(R.recoil * Math.PI) * 0.6; }
  }
  function gateHit(dmg, siege) {                                   // 성문에 피해: 일반 무기는 10%만 먹는다 (공성 무기는 4배, 호출하는 쪽이 사람 0.5 / 병사 0.25 배로 줄여 넘긴다)
    const C = exCamp, G = C && C.gate; if (!G || G.broken) return;
    G.hp -= dmg * (siege ? 4 : 1); for (const p of G.parts) { p.position.x += (Math.random() - 0.5) * 0.06; }
    if (G.hp <= 0) {
      G.broken = true; for (const p of G.parts) { scene.remove(p); const i = exObjs.indexOf(p); if (i >= 0) exObjs.splice(i, 1); const j = C.solids.indexOf(p); if (j >= 0) C.solids.splice(j, 1); }
      toast('The gate is broken!'); Snd.play('victory', 0.6); shake = Math.max(shake, 0.7); campAlarm(); floatText('GATE BROKEN!', G.x, 4, G.z);
    }
  }
  function gateInReach(x, z, ang, range, half) {                   // 부채꼴 안에 닫힌 성문이 있는가
    const G = exCamp && exCamp.gate; if (!G || G.broken) return false;
    const dx = G.x - x, dz = G.z - z, d = Math.hypot(dx, dz); if (d > range + 3.5) return false;
    return d < 1 || (dx * Math.sin(ang) + dz * Math.cos(ang)) / d > Math.cos(half + 0.5);
  }
  function campAlarm() { const C = exCamp; if (!C || C.alarm || C.broken) return; C.alarm = true; toast('Alarm!'); Snd.play('horn'); }
  function campReliefTxt(id) { if (holdOf(id)) return ''; const x = (story.campFx || []).find(f => f.id === id), r = CFG.CAMP_RELIEF[id]; return x && r && dayNow() <= x.until ? ` · raids -${Math.round(r.pct * 100)}% to day ${x.until}` : ''; }
  function burnBanner(o) {                                                  // 산적 깃발을 불태우면 야영지가 사기를 잃는다 (우두머리를 쓰러뜨리는 것의 다른 길)
    const f = new THREE.Group(); addGlow(f, 0xff7a2a, 6, 3.5); f.position.set(o.position.x, 0, o.position.z); exAdd(f, false); campBroken(o, 'banner');
  }
  function campBroken(e, how) {
    const C = exCamp; if (!C || C.broken) return; C.broken = true;
    if (exActive && exActive.training) {                                      // 공성 연습: 보상 없이 결과만 보여 준다
      const secs = Math.round((performance.now() - exStats.t0) / 1000), G = C.gate, K = C.cat, lost = C.ladders.filter(l => l.lost).length;
      showTripReport('Siege practice: keep taken', [`Time ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`, `Gate ${G && G.broken ? 'broken' : 'standing'}${C.ram ? ` · ram ${C.ram.dead ? 'lost' : 'saved'}` : ''}`, `Ladders lost: ${lost}${K ? ` · boulders thrown: ${K.shots}` : ''}`, 'Practice only: no losses, no rewards.']); toast('Practice keep taken!'); return;
    }
    const fi = how === 'banner' ? 4 : 8, fo = how === 'banner' ? 3 : 6; res.iron += fi; res.food += fo; updateHud(); giveXp(how === 'banner' ? 40 : 60);
    const id = exActive && exActive.dest.id, rf = CFG.CAMP_RELIEF[id];
    if (rf) { story.campFx = (story.campFx || []).filter(x => x.id !== id).concat({ id, until: dayNow() + rf.days }); }
    const rl = exActive && exActive.dest.realm; toast(`Camp broken! +${fi} iron +${fo} food${rl ? ` · ${realmDef(rl).short} raids -${Math.round(realmRelief(rl) * 100)}%` : ''}`); Snd.play('victory'); shake = Math.max(shake, 0.6);
    if (exActive && exActive.dest.castle) { const f = exActive.dest.id === 'legionfortress' ? 2 : 1; res.stone += 12 * f; res.iron += 10 * f; res.wood += 8 * f; updateHud(); giveXp(100 * f); setTimeout(() => toast(`${exActive ? exActive.dest.name : 'Castle'} taken! +${12 * f} stone +${10 * f} iron +${8 * f} wood`), 1200); }
    if (exActive && exActive.dest.final) { story.campaignWon = true; unlockAch('won'); addCourage(100); floatText('THE IRON WARLORD FALLS!', e.position.x, 5, e.position.z); shake = 1; }
    floatText(exActive && exActive.dest.castle ? 'CASTLE TAKEN!' : 'CAMP BROKEN!', e.position.x, 3.6, e.position.z);
  }
  function exMove(n, tx, tz, speed, dt) {          // 원정 지역용 단순 이동: 장애물 밀어내기 + 지역 경계
    if (exCamp) { const r = campRoute(n.position.x, n.position.z, tx, tz); tx = r.x; tz = r.z; }
    const dx = tx - n.position.x, dz = tz - n.position.z, d = Math.hypot(dx, dz);
    if (d < 0.05) return d;
    const st = Math.min(d, speed * moveMul(n) * dt);
    n.position.x += dx / d * st; n.position.z += dz / d * st; n.face = Math.atan2(dx, dz); n.rotation.y = n.face;
    for (const o of exObjs) {
      const ox = n.position.x - o.position.x, oz = n.position.z - o.position.z, m = o.userData.radius + 0.45, od = Math.hypot(ox, oz);
      if (od < m && od > 1e-4) { n.position.x = o.position.x + ox / od * m; n.position.z = o.position.z + oz / od * m; }
    }
    const cx = n.position.x - EXC.x, cz = n.position.z - EXC.z, cd = Math.hypot(cx, cz);
    if (cd > exR - 5) { n.position.x = EXC.x + cx / cd * (exR - 5); n.position.z = EXC.z + cz / cd * (exR - 5); }
    return d;
  }
  function escortStep(dt) {
    const n = npc;
    if (n.down) { setLabel('Down'); n.anim.base('idle', 0); n.stateNow = 'Down'; return; }
    n.atkCd -= dt;
    if (n.cls === 'medic' && n.role === 'melee') medicTick(dt);                                // 원정 중에도 치료사는 주변 아군과 주인공을 치료한다
    const ord = orderOf(n);                                                                     // 명령: Stand firm 은 그 자리를 지킨다, Withdraw 는 근접병이 싸우지 않고 곁에 붙는다, Charge 는 멀리서 달려든다
    const post = ord !== 'withdraw' && n.warband >= 0 ? bandPost[n.warband] : null;                  // 전투단 진지: 정해 준 자리에 줄지어 선다
    const form = n.warband >= 0 ? warbandForm(n.warband) : 'block';
    if (post) { const w = formWorld(form, n, post); n.hold = { x: w.x, z: w.z }; n.holdFace = w.h; }
    else if (ord === 'stand') { if (!n.hold) n.hold = { x: n.position.x, z: n.position.z }; } else n.hold = null;
    let foe = null, bd = post ? (ord === 'charge' ? 18 : ord === 'stand' ? 9 : 13) : ord === 'charge' ? 26 : ord === 'stand' ? 9 : 16;
    for (const e of enemies) {
      if (ord === 'withdraw' && n.role === 'melee') break;
      if (!e.userData.ex || e.userData.sinking || e.userData.dying > 0) continue;
      const o0 = n.hold || n.position, d = Math.hypot(e.position.x - o0.x, e.position.z - o0.z);
      if (d < bd) { bd = d; foe = e; }
    }
    if (markedFoe && markedFoe.userData.ex && !(ord === 'withdraw' && n.role === 'melee')) {            // 표시된 적을 먼저 노린다 (Stand firm 은 지키는 자리 근처일 때만)
      const o1 = n.hold || n.position, md = Math.hypot(markedFoe.position.x - o1.x, markedFoe.position.z - o1.z);
      if (ord !== 'stand' || md < 9) { foe = markedFoe; bd = md; }
    }
    if (foe && n.hold) bd = Math.hypot(foe.position.x - n.position.x, foe.position.z - n.position.z);
    let state = ord === 'withdraw' ? 'Falling back' : 'Escorting';
    if (foe) {
      state = 'Fighting'; n.ramCrew = false;
      if (n.role === 'melee') {
        if (bd > 1.7) exMove(n, foe.position.x, foe.position.z, ord === 'charge' ? 6 : 5.2, dt);
        else { n.face = Math.atan2(foe.position.x - n.position.x, foe.position.z - n.position.z); n.rotation.y = n.face; if (n.atkCd <= 0) soldierStrike(foe); }
      } else {
        if (bd > 9) exMove(n, foe.position.x, foe.position.z, 4.5, dt);
        else if (bd < 4) exMove(n, n.position.x * 2 - foe.position.x, n.position.z * 2 - foe.position.z, 4.5, dt);
        if (bd <= 11) soldierShoot(foe);
      }
    } else if (n.role === 'melee' && ord !== 'withdraw' && !n.hold && exCamp && exCamp.ram && !exCamp.ram.dead && exCamp.gate && !exCamp.gate.broken && Math.hypot(player.position.x - exCamp.ram.mesh.position.x, player.position.z - exCamp.ram.mesh.position.z) < 24 && (n.ramCrew || npcs.filter(x => x.escort && x.ramCrew).length < 3)) {      // 망치 병사: 지휘관이 가까이 있으면 셋이 망치를 밀고 간다
      state = 'Pushing ram'; n.ramCrew = true; const rm = exCamp.ram.mesh, slot = npcs.filter(x => x.escort && x.ramCrew).indexOf(n), side = [-1.7, 1.7, 0][Math.max(0, slot) % 3], tz = rm.position.z - (slot === 2 ? 3 : 0.3);
      const d = Math.hypot(rm.position.x + side - n.position.x, tz - n.position.z); if (d > 0.8) exMove(n, rm.position.x + side, tz, 6, dt); else { n.face = 0; n.rotation.y = 0; n.anim.base('idle', 0); }
    } else if (n.role === 'melee' && ord !== 'withdraw' && !n.hold && exCamp && exCamp.gate && !exCamp.gate.broken && Math.hypot(player.position.x - exCamp.gate.x, player.position.z - exCamp.gate.z) < 16) {      // 성문이 닫혀 있고 주인공이 문 앞에 있으면 병사도 문을 친다 (약하게)
      state = 'Breaking gate'; const G = exCamp.gate, gd = Math.hypot(G.x - n.position.x, G.z - n.position.z);
      if (gd > 4.2) exMove(n, G.x + ((npcs.filter(x => x.escort).indexOf(n) % 5) - 2) * 1.3, G.z - 3.6, 5.5, dt);
      else { n.face = Math.atan2(G.x - n.position.x, G.z - n.position.z); n.rotation.y = n.face; if (n.atkCd <= 0) { n.anim.once('attackSword'); const dur = n.anim.shot ? n.anim.shot.dur : 0.6; n.atkCd = Math.max(1.0, dur); n.atkLock = dur * 0.9; later(n.anim.hitIn ?? 0.25, () => { if (npcs.includes(n) && !n.down) gateHit(soldierWeaponDef(n).dmg * soldierMult(n) * 0.25, false); }); } }
    } else if (n.parade && exActive && exActive.training) {                  // 훈련장: 전투 중이 아니면 줄을 지켜 서 있다
      state = 'On parade'; const pd = Math.hypot(n.parade.x - n.position.x, n.parade.z - n.position.z);
      if (pd > 0.8) exMove(n, n.parade.x, n.parade.z, 5, dt); else { n.face = 0; n.rotation.y = 0; n.anim.base('idle', 0); }
    } else if (n.hold) {
      if (Math.hypot(n.hold.x - n.position.x, n.hold.z - n.position.z) > 0.6) exMove(n, n.hold.x, n.hold.z, 5, dt);       // 지킬 자리로 돌아온다
      else if (post) { n.face = n.holdFace || 0; n.rotation.y = n.face; n.anim.base('idle', 0); }                             // in formation: stand facing the foe
    } else {
      const k = npcs.filter(x => x.escort).indexOf(n), a = facing + Math.PI + ((k % 6) - 2.5) * 0.7, rr = 2.6 + Math.floor(k / 6) * 1.6, tx = player.position.x + Math.sin(a) * rr, tz = player.position.z + Math.cos(a) * rr;
      const d = Math.hypot(tx - n.position.x, tz - n.position.z);
      if (d > 1.2) exMove(n, tx, tz, d > 8 ? 8 : 5, dt);
    }
    n.inForm = !!(post && n.hold && Math.hypot(n.hold.x - n.position.x, n.hold.z - n.position.z) < 2.2);
    const mv = Math.hypot(n.position.x - n.px, n.position.z - n.pz) / Math.max(dt, 1e-4); n.px = n.position.x; n.pz = n.position.z;
    n.rig.combat = true; n.rig.sheathe(false);                                                // 원정 중에는 항상 전투 자세 이동
    n.anim.base(mv > 4.4 ? 'run' : mv > 0.5 ? 'walk' : 'idle', mv);
    n.stateNow = state; setLabel(state);
  }
  function openChest(o) {
    const d = exActive.dest, tier = d.stage, picks = [['wood', 10 + tier * 4, 'Wood'], ['stone', 8 + tier * 4, 'Stone'], ['iron', 2 + tier * 2, 'Iron'], ['food', 6 + tier * 3, 'Food']].sort(() => Math.random() - 0.5).slice(0, 2);
    picks.forEach(([k, n, nm], i) => { res[k] += n; floatText(`+${n} ${nm}`, o.position.x, 2.0 + i * 0.5, o.position.z); });
    if (d.ch >= 2) { const k = 1 + (o.userData.relic ? 2 : 0); res.shard += k; floatText(`+${k} Shard`, o.position.x, 2.9, o.position.z); }
    burst({ x: o.position.x, z: o.position.z, y: 1 }, 16); Snd.play('chest'); updateHud(); giveXp((8 + 4 * d.stage) * (d.night ? 2 : 1)); if (d.night && story.beacon) { res.shard++; floatText('+1 Shard', o.position.x, 3.3, o.position.z); }
    if (o.userData.relic) foundRelic(d);
  }

  // ---------- 이야기 ----------
  const story = { stats: [], roads: [], relics: {}, said: {}, log: [], intro: false, exps: 0, beacon: false, dawn: false, crown: false, hollow: false, finale: false, road: false, wide: false, eclipse: false, dusk: false, champs: 0, camps: {}, cleared: {}, tales: {}, taleDay: 0, ms: {}, campFx: [], holds: {}, clearedDay: {} };
  const storyChain = () => CFG.STORY.concat(story.beacon ? CFG.STORY2 : []).concat(story.dawn ? CFG.STORY3 : []).concat(story.hollow ? CFG.STORY4 : []).concat(story.road ? CFG.STORY5 : []).concat(story.eclipse ? CFG.STORY6 : []);
  let beaconMesh = null;
  function setBeacon(on) {
    if (on && !beaconMesh) {
      beaconMesh = new THREE.Group();
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.2, 40, 14, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      beam.position.y = 20; beaconMesh.add(beam);
      const glow = new THREE.PointLight(0xffd070, 1.6, 40, 1.4); glow.position.y = 6; beaconMesh.add(glow);
      scene.add(beaconMesh);
    }
    if (beaconMesh) beaconMesh.visible = on;
    story.beacon = on;
  }
  const storyDone = (id) => id === 'first' ? story.exps >= 1 : !!story.relics[id];
  function storyDialog(title, text) { openEvent({ tag: 'Story', title, text, opts: [{ label: 'Continue', run: () => '' }] }); }
  function checkStory() {
    for (const s of storyChain()) {
      if (!storyDone(s.id) || story.said[s.id]) continue;
      story.said[s.id] = true; story.log.push(`${s.title}: ${s.text}`);
      for (const [k, v] of Object.entries(s.reward)) res[k] += v;
      updateHud(); storyDialog(s.title, `${s.text}\n\nReward: ${costText(s.reward)}`);
    }
    if (!story.beacon && CFG.STORY.every(s => storyDone(s.id))) {
      setBeacon(true); story.log.push(`${CFG.STORY_BEACON.title}: ${CFG.STORY_BEACON.text}`);
      storyDialog(CFG.STORY_BEACON.title, CFG.STORY_BEACON.text); shake = Math.max(shake, 0.5); Snd.play('horn');
    }
    if (story.beacon && !story.dawn && CFG.STORY2.every(s => storyDone(s.id))) {
      story.dawn = true; story.log.push(`${CFG.STORY_DAWN.title}: ${CFG.STORY_DAWN.text}`);
      storyDialog(CFG.STORY_DAWN.title, CFG.STORY_DAWN.text); shake = Math.max(shake, 0.6); Snd.play('horn');
      if (beaconMesh) beaconMesh.children[0].material.opacity = 0.4;
    }
    if (story.crown && !story.hollow) {
      story.hollow = true; story.log.push(`${CFG.STORY_HOLLOW.title}: ${CFG.STORY_HOLLOW.text}`);
      storyDialog(CFG.STORY_HOLLOW.title, CFG.STORY_HOLLOW.text); shake = Math.max(shake, 0.4); Snd.play('horn');
    }
    if (story.hollow && !story.finale && CFG.STORY4.every(s => storyDone(s.id))) {
      story.finale = true; story.log.push(`${CFG.STORY_FINALE.title}: ${CFG.STORY_FINALE.text}`);
      storyDialog(CFG.STORY_FINALE.title, CFG.STORY_FINALE.text); shake = Math.max(shake, 0.6); Snd.play('horn');
      if (beaconMesh) { beaconMesh.children[0].material.opacity = 0.55; }
      try { localStorage.setItem('nf_carry', JSON.stringify({ ng: ngLevel + 1, lvl: pl.lvl, st: { ...pl.st } })); } catch (e) {} setTimeout(() => toast('New Game+ unlocked: start a new game to carry your level into a tougher world'), 3000);
    }
    if (story.finale && !story.road) {
      story.road = true; story.log.push(`${CFG.STORY_ROAD.title}: ${CFG.STORY_ROAD.text}`);
      setTimeout(() => storyDialog(CFG.STORY_ROAD.title, CFG.STORY_ROAD.text), 2500);
    }
    if (story.road && !story.wide && CFG.STORY5.every(s => storyDone(s.id))) {
      story.wide = true; story.log.push(`${CFG.STORY_WIDE.title}: ${CFG.STORY_WIDE.text}`);
      storyDialog(CFG.STORY_WIDE.title, CFG.STORY_WIDE.text); shake = Math.max(shake, 0.5); Snd.play('horn');
    }
    if (story.wide && !story.eclipse) {
      story.eclipse = true; story.log.push(`${CFG.STORY_ECLIPSE.title}: ${CFG.STORY_ECLIPSE.text}`);
      setTimeout(() => storyDialog(CFG.STORY_ECLIPSE.title, CFG.STORY_ECLIPSE.text), 2500);
    }
    if (story.eclipse && !story.dusk && CFG.STORY6.every(s => storyDone(s.id))) {
      story.dusk = true; story.log.push(`${CFG.STORY_END6.title}: ${CFG.STORY_END6.text}`);
      storyDialog(CFG.STORY_END6.title, CFG.STORY_END6.text); shake = Math.max(shake, 0.6); Snd.play('victory'); updateHud();
    }
    if (story.dawn && !story.crown && CFG.STORY3.every(s => storyDone(s.id))) {
      story.crown = true; story.log.push(`${CFG.STORY_CROWN.title}: ${CFG.STORY_CROWN.text}`);
      storyDialog(CFG.STORY_CROWN.title, CFG.STORY_CROWN.text); shake = Math.max(shake, 0.5); Snd.play('horn');
    }
  }
  function checkStoryAll() { checkStory(); checkStory(); }                    // 한 번에 여러 이야기가 이어질 때(왕관 → 4장 시작 → ...)를 위해 두 번 돈다
  function foundRelic(d) {
    story.relics[d.id] = true; pl.pend++; giveXp(40); if (d.id === 'ashford') setTimeout(() => { const k = spawnCitizens(Math.max(0, Math.min(2, maxPop() - npcs.length))); if (k) toast(`${k} villagers from Ashford followed you home`); }, 1500); toast(`Relic found: ${d.relic}! (a bonus upgrade is waiting)`); floatText(`Relic: ${d.relic}`, player.position.x, 3.2, player.position.z);
    burst({ x: player.position.x, z: player.position.z, y: 1.5 }, 40); shake = Math.max(shake, 0.35); Snd.play('horn');
  }
  function storyIntro() {
    if (story.intro) return; story.intro = true;
    const t = 'At dawn a traveler leaves a charred map at your gate. "There was a Beacon once, far past the old road. It kept the dark away. Three relics powered it - find them, and the night may lose its teeth." Open the Journal (J) to plan an expedition.';
    story.log.push(`A Weathered Map: ${t}`); storyDialog('A Weathered Map', t);
  }

  // ---------- 원정 출발 / 귀환 ----------
  let escortBands = [];                                                    // 원정에 데려갈 전투단들 (비어 있으면 혼자)
  const escortPool = () => npcs.filter(n => n.role !== 'citizen' && !n.down && !n.escort);
  function powerOf() {                                       // 마을의 전투력: 병사 + 주인공
    const val = (n) => 2 + 2 * (n.role === 'melee' ? soldierWeaponDef(n) : gearDef(n.gear.bow)).tier + 1.5 * gearDef(n.gear.armor).tier + 1.5 * vetLv(n);
    const all = npcs.filter(n => n.role !== 'citizen'), going = all.filter(n => inParty(n));
    const brought = going.reduce((a, n) => a + val(n), 0), home = all.filter(n => !going.includes(n)).reduce((a, n) => a + val(n), 0) * 0.35;      // 데려가는 전투단은 전부, 마을에 남는 병사는 35%만 (예비대)
    const me = 3 * pl.lvl + 3 * bestPlayerTier() + 2 * gearDef(playerGear.armor).tier;
    return { sold: Math.round(brought + home), brought: Math.round(brought), home: Math.round(home), me: Math.round(me), total: Math.round(brought + home + me) };
  }
  const powerFor = (d) => { const p = powerOf(); return d.raid ? p.brought + p.me : p.total; };       // 습격은 데려가는 전투단과 주인공만 센다 (마을에 남는 병사는 도움이 안 된다)
  const needOf = (d) => Math.round((CFG.EXP_NEED[d.id] || 0) * CFG.EXP_NEED_SCALE);      // 요구 전투력은 '병사 전원'이 아니라 '데려가는 전투단 + 예비대 1/3' 기준으로 맞춘다
  const nightExpWhy = () => {                                   // 밤 원정이 닫혀 있는 이유 (열려 있으면 '')
    const h = (gameMin / 60) % 24;
    if (!(h >= 20 || h < CFG.EXP_NIGHT_LATEST)) return 'Night only (20:00 - 02:00)';
    if (isRaid(nightDayNo())) return 'A raid is coming tonight - stay and defend';
    if (wave.day !== Math.max(1, nightDayNo()) || wave.remaining > 0 || wave.siegeLeft > 0 || wave.bossLeft > 0 || enemies.some(e => !e.userData.sinking && !e.userData.prowl && !e.userData.ex)) return 'Clear the night\'s raiders first';
    return '';
  };
  let marchArm = '', marchArmT = 0;
  const isYours = (d) => !!(d.raid && story.cleared[d.id]);       // 이미 무너뜨린 습격지는 다시 칠 수 없다 (산적이 되찾으면 다시 열린다)
  function startExpedition(id) {
    const d = CFG.EXPEDITIONS.find(x => x.id === id);
    if (!d || exActive || dead || exEnding) return;
    if (isYours(d)) return toast(`${d.name} is already broken${holdOf(d.id) ? ' and held' : ''}`);
    if (stage < d.stage) return toast(`Requires Stage ${d.stage} (${CFG.STAGES[d.stage - 1].name})`);
    if (d.ch === 2 && !story.beacon) return toast('Light the Beacon first');
    if (d.ch === 3 && !story.dawn) return toast('Open the Dawn Gate first');
    if (d.ch === 4 && !story.hollow) return toast('Take the Winter Crown first');
    if (d.ch === 6 && !story.eclipse) return toast('Light the Wide Road first');
    if (d.ch === 5 && !story.road) return toast('Swear the Keeper\'s Oath first');
    { const miss = [].concat(d.after || []).find(a => !story.cleared[a]); if (miss) return toast(`Take the ${CFG.EXPEDITIONS.find(x => x.id === miss).name} first`); }
    if (d.needs && !d.needs.every(r => story.relics[r])) return toast('Recover the earlier relics first: this place stays hidden until you carry them');
    if (d.bands && escortBands.filter(i => escortPool().some(n => n.warband === i)).length < d.bands) return toast(`Needs ${d.bands} warbands${bandMax() < d.bands ? ` (you can bring ${bandMax()})` : ''}`);
    if (d.march) {                                                          // 먼 곳: 식량과 확인 (한 번 더 누르면 출발)
      const cost = marchFood(d);
      if (res.food < cost) return toast(`Need ${cost} food (have ${Math.floor(res.food)})`);
      if (marchArm !== d.id || performance.now() - marchArmT > 5000) { marchArm = d.id; marchArmT = performance.now(); return toast(`${d.march}d march, ${cost} food. ${homeOdds(d)}. Tap Depart again.`); }
      marchArm = '';
    }
    if (powerFor(d) < needOf(d)) return toast(`Too strong: power ${needOf(d)} needed, you have ${powerFor(d)}`);
    if (d.night) { const why = nightExpWhy(); if (why) return toast(why); }
    else if (nowHour < 6 || nowHour >= CFG.EXP_LATEST) return toast('Night has fallen - too late to set out');
    closeJournal(); exEnding = true; gathering = null;
    const marchCost = d.march ? marchFood(d) : 0; if (marchCost) res.food -= marchCost;                 // 행군 식량은 출발할 때 먹는다
    fadeTo(() => {
      exActive = { dest: d, night: !!d.night, ret: { x: player.position.x, z: player.position.z }, res0: { ...res } };
      if (d.castle) { const G = siegeGear(); siegeLoad = { ram: Math.min(1, G.ram), ladder: Math.min(CFG.SIEGE.LADDER_MAX, G.ladder), catapult: Math.min(1, G.catapult) }; G.ram -= siegeLoad.ram; G.ladder -= siegeLoad.ladder; G.catapult -= siegeLoad.catapult; }
      else siegeLoad = { ram: 0, ladder: 0, catapult: 0 };
      exStats = { kills: 0, t0: performance.now() };
      buildZone(d); if (d.camp && exR > 46) { exActive.prep = true; setTimeout(() => toast('Preparation: Place your bands, then Begin the assault'), 3000); }
      if (d.castle) setTimeout(() => toast(siegeLoad.ram || siegeLoad.ladder || siegeLoad.catapult ? `Siege gear: ${siegeLoad.ram} ram, ${siegeLoad.ladder} ladder${siegeLoad.ladder === 1 ? '' : 's'}${siegeLoad.catapult ? ', catapult' : ''}` : 'No siege gear! Build a Siege Workshop. You must chip the gate by hand'), 1800);
      const party = escortPool().filter(n => inParty(n)).slice(0, CFG.WARBAND.SIZE * bandMax());                // 선택한 전투단의 병사들이 함께 간다
      party.forEach((n, i) => {
        npc = n; setTask(null); n.workT = 0; n.promote = null; n.target = null; n.returning = false; returnGear(n);
        n.clsHome = homeCls(n); n.cls = tripCls(n); applyGear(n);                    // 원정 직업으로 바꾼다 (마을 직업은 clsHome 에 남는다)
        n.escort = true; n.hold = null; n.position.set(EXC.x + ((i % 6) - 2.5) * 1.8, 0, EXC.z - (exR - 15) - Math.floor(i / 6) * 1.6); n.px = n.position.x; n.pz = n.position.z; n.hidden = false;
      });
      exActive.party = party.length; if (d.march) { const ml = marchOut(d); exActive.marchLines = ml; setTimeout(() => showTripReport(`${d.march}d march`, ml.concat(`Provisions: ${marchCost} food`)), 1800); } if (party.length && !npcs.some(n => n.role !== 'citizen' && !party.includes(n)) && (story.guardWarn = (story.guardWarn || 0) + 1) <= 3) setTimeout(() => toast('No soldiers left at home'), 3200);       // 처음 세 번만 알린다
      player.position.set(EXC.x, 0, EXC.z - (exR - 13)); facing = 0; player.rotation.y = 0; yaw = 0;
      camera.position.copy(goalPos(camGoal)); lookAt.set(player.position.x, LOOK_H, player.position.z);
      exEnding = false; updateExUi(); toast(d.raid ? `${d.name}: break the camp` : `${d.name}: find the chests`); Snd.play('horn');
    });
  }
  function endExpedition(forced) {
    if (!exActive || exEnding) return;
    if (exActive.training) return endTraining();
    const ex = exActive; exEnding = true; gathering = null;
    fadeTo(() => {
      if (ex.dest.castle && exCamp && exCamp.load) { const G = siegeGear(), ramOk = exCamp.ram && !exCamp.ram.dead, lost = exCamp.ladders.filter(l => l.lost).length; G.ram += ramOk ? exCamp.load.ram : 0; G.catapult += exCamp.cat && !exCamp.cat.dead ? exCamp.load.catapult : 0; G.ladder += Math.max(0, exCamp.load.ladder - lost); }        // 살아남은 장비는 집으로 가져온다
      const backLines = ex.dest.march ? marchBack(ex.dest) : null;                          // 돌아오는 길의 밤들 (병사들은 아직 원정 중으로 센다)
      const gain = ['wood', 'stone', 'iron', 'food', 'shard'].map(k => [k, res[k] - ex.res0[k]]).filter(x => x[1] > 0).map(([k, v]) => `${v} ${k}`).join(', ');
      const left = exObjs.filter(o => o.userData.type === 'chest').length + enemies.filter(e => e.userData.ex && !(e.userData.dying > 0)).length;
      const cleared = exCamp ? (exCamp.broken && exObjs.filter(o => o.userData.type === 'chest').length === 0) : left === 0;
      const backMen = npcs.filter(x => x.escort), report0 = [...new Set(backMen.filter(x => !x.levy).map(x => x.warband))].map(i => `${warbandName(i).replace(' Warband', '')} ${backMen.filter(x => x.warband === i && !x.down).length}/${backMen.filter(x => x.warband === i).length}`);
      backMen.forEach((n, k) => {                                              // 동행 병사 귀환: 돌아온 자리에서 걸어서 각자의 일과 초소로 간다 (쓰러진 병사는 회복)
        n.escort = false; n.hold = null; n.cls = homeCls(n); applyGear(n);       // 마을로 돌아오면 마을 직업으로
        const a = k * 2.4, rr = 2 + (k % 3) * 0.9;
        if (n.down) { n.hp = n.maxHp; n.position.set(n.home.x, 0, n.home.z); const W = ex.dest.castle ? CFG.WOUND.CASTLE_DAYS : CFG.WOUND.DAYS; n.woundDays = W[0] + Math.floor(Math.random() * (W[1] - W[0] + 1)); }       // 쓰러진 병사는 집으로 옮겨져 며칠 앓는다
        else n.position.set(ex.ret.x + Math.sin(a) * rr, 0, ex.ret.z + Math.cos(a) * rr);
        n.px = n.position.x; n.pz = n.position.z; n.atkCd = 0;
      });
      const fallen = backMen.filter(x => x.down && !x.levy).length, camp = exCamp, took = !!(camp && camp.broken), lines = [];
      if (ex.dest.raid) {                                                           // 전투 보고서: 습격·공성이 끝나면 한 화면에 결과를 모아 보여 준다
        const secs = Math.round((performance.now() - exStats.t0) / 1000), realm = ex.dest.realm;
        lines.push(took ? (ex.dest.castle ? `${ex.dest.name} taken!` : `${ex.dest.name} broken!`) : `You withdrew from ${ex.dest.name}.`);
        lines.push(`Time ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} · ${exStats.kills} foes defeated`);
        lines.push(`Warbands: ${report0.join(' · ') || 'none'}${fallen ? ` · ${fallen} fell${ex.dest.castle && !took ? ' (lost for good)' : ', wounded at home'}` : ''}`);
        if (camp && camp.gate) { const G = camp.gate, lad = camp.load ? camp.load.ladder : 0, lostL = camp.ladders.filter(l => l.lost).length; if (camp.load && camp.load.catapult) lines.push(`Catapult ${camp.cat && !camp.cat.dead ? 'saved' : 'lost'} · ${camp.cat ? camp.cat.shots : 0} boulders thrown`); lines.push(`Gate ${G.broken ? 'broken' : 'standing'}${camp.load && camp.load.ram ? ` · ram ${camp.ram && camp.ram.dead ? 'lost' : 'saved'}` : ' · no ram'} · ladders ${Math.max(0, lad - lostL)}/${lad} kept`); }
        if (gain) lines.push(`Loot: ${gain}`);
        if (took && realm) lines.push(`${realmDef(realm).short} raids -${Math.round(realmRelief(realm) * 100)}%`);
      }
      if (ex.dest.castle && !took) for (const n of backMen) if (n.down && !n.levy) removeNpc(n);
      for (const n of backMen.filter(x => x.levy)) dismissLevy(n);
      if (ex.dest.raid) addCourage(took ? CFG.COURAGE.WIN : -CFG.COURAGE.WITHDRAW);                      // 공성에 실패하면 쓰러진 병사는 돌아오지 못한다
      if (backLines || lines.length) setTimeout(() => showTripReport(ex.dest.final && took ? 'THE CAMPAIGN IS WON' : ex.dest.raid ? (took ? 'Victory' : 'Withdrawn') : 'Home again', (ex.dest.final && took ? ['The Iron Warlord is dead and the three realms are broken.', 'The night will never be the same. The land is yours.'] : []).concat(lines).concat(backLines || [], report0.length && !lines.length ? `Back: ${report0.join(' · ')}` : [])), 2600);
      if (report0.length && !backLines && !lines.length) setTimeout(() => toast(`Back home: ${report0.join(' · ')}`), 2200);
      cleanupZone(); exActive = null;
      if (ex.party > 0) unlockAch('escort');
      if (cleared) unlockAch('clear');
      if (cleared && ex.dest.raid) { (story.clearedDay = story.clearedDay || {})[ex.dest.id] = dayNow(); }
      if (cleared && !story.cleared[ex.dest.id]) { story.cleared[ex.dest.id] = true; setTimeout(() => toast(`${ex.dest.name} cleared`), 2200); }
      player.position.set(ex.ret.x, 0, ex.ret.z); camera.position.copy(goalPos(camGoal)); lookAt.set(player.position.x, LOOK_H, player.position.z);
      story.exps++; exEnding = false; updateExUi(); updateHud(); saveGame();
      toast(`${forced ? (ex.night ? 'You rushed home as dawn broke. ' : 'You rushed home as dusk fell. ') : 'Back home. '}${gain ? 'Brought back: ' + gain : 'You found nothing this time'}`);
      checkStoryAll();
    });
  }
  // ---------- 10단계: 야영지 (정리한 원정지에 세우면 매일 아침 자원이 들어온다) ----------
  const campMeshes = [], campTentMat = mat(0xcbb48a), campFlagMat = mat(0x2f7fc0);
  function rebuildCamps() {
    for (const m of campMeshes) scene.remove(m);
    campMeshes.length = 0;
    CFG.EXPEDITIONS.filter(d => story.camps[d.id]).forEach((d, i) => {
      const a = 0.55 + i * 0.62, r = 47, g = new THREE.Group();
      const tent = new THREE.Mesh(new THREE.ConeGeometry(1.5, 2.1, 5), campTentMat); tent.position.y = 1.05;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 6), woodMat2); pole.position.set(1.8, 1.6, 0);
      const flag = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.04), campFlagMat); flag.position.set(2.15, 2.9, 0);
      g.add(tent, pole, flag); g.traverse(m => { if (m.isMesh) m.castShadow = true; });
      g.position.set(Math.cos(a) * r, actorH(Math.cos(a) * r, Math.sin(a) * r), Math.sin(a) * r); g.rotation.y = -a; scene.add(g); campMeshes.push(g);
    });
  }
  function buildCamp(id) {
    const d = CFG.EXPEDITIONS.find(x => x.id === id), cost = CFG.CAMP_COST[d.stage];
    if (!d || !story.cleared[id] || story.camps[id] || !canPay(cost)) return;
    payCost(cost); story.camps[id] = true; updateHud(); rebuildCamps(); Snd.play('chime'); giveXp(20);
    toast(`${d.name} camp established: ${Object.entries(CFG.CAMPS[id]).map(([k, v]) => `+${v} ${k}`).join(', ')} each morning`);
    renderJournal(); saveGame();
  }
  function campIncome() {
    const tot = {}; let any = false;
    for (const d of CFG.EXPEDITIONS) if (story.camps[d.id] && CFG.CAMPS[d.id]) for (const [k, v] of Object.entries(CFG.CAMPS[d.id])) {
      const g = Math.max(1, Math.round(v * (season().id === 'winter' ? 0.6 : 1))); res[k] += g; tot[k] = (tot[k] || 0) + g; any = true;
    }
    if (any) { report.camps = Object.entries(tot).map(([k, v]) => `${k} +${v}`).join(' · '); updateHud(); }
  }
  function updateExUi() {
    const b = document.getElementById('expBtn');
    b.firstChild.textContent = exActive ? 'Return home' : 'Journal';
    b.classList.toggle('on', !!exActive);
    { const tb = document.getElementById('trainBar'); if (tb) { tb.style.display = exActive && exActive.training ? 'flex' : 'none'; for (const b of tb.querySelectorAll('[data-tr]')) b.style.display = (b.dataset.tr === 'clear' || b.dataset.tr === 'leave' || !(exActive && exActive.dest.siege)) ? '' : 'none'; } }
  }
  let returnArm = 0;
  function requestReturn() {                       // 상자·적이 남아 있으면 실수로 돌아가지 않도록 한 번 더 누르게 한다
    if (!exActive || exEnding) return;
    if (exActive.training) return endTraining();
    const chests = exObjs.filter(o => o.userData.type === 'chest').length, foes = enemies.filter(e => e.userData.ex && !(e.userData.dying > 0)).length;
    if (exCamp && !exCamp.broken && performance.now() - returnArm > 3500) { returnArm = performance.now(); toast('Camp still stands. Press again to leave'); return; }
    if ((chests || foes) && performance.now() - returnArm > 3500) { returnArm = performance.now(); toast(`${chests} chests, ${foes} foes left. Press again to leave`); return; }
    endExpedition(false);
  }
  document.getElementById('expBtn').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); exActive ? requestReturn() : toggleJournal(); });
  addEventListener('keydown', e => { if (e.code === 'KeyJ' && !e.repeat) { if (exActive) requestReturn(); else toggleJournal(); } });

  // ---------- 일지(Journal): 이야기 목표 + 원정 목록 ----------
  const jEl = document.getElementById('journalPanel');
  function campHtml(d) {
    if (d.raid) return holdHtml(d);
    if (story.camps[d.id]) return `<small>Camp ✔ ${Object.entries(CFG.CAMPS[d.id]).map(([k, v]) => `+${v} ${k}`).join(', ')} every morning</small>`;
    if (!story.cleared[d.id]) return '';
    const cost = CFG.CAMP_COST[d.stage];
    return `<small><button class="campBtn" data-camp="${d.id}" ${canPay(cost) ? '' : 'disabled'}>Build camp (${costText(cost)})</button> ${Object.entries(CFG.CAMPS[d.id]).map(([k, v]) => `+${v} ${k}`).join(', ')} every morning</small>`;
  }
  let jMapSel = 'quarry', jFocus = true, jMapFar = false;                                                      // 일지의 탭: 'journey'(원정) / 'raid'(습격)
  function renderJournal() {
    const chain = storyChain(), first = chain.findIndex(s => !storyDone(s.id));
    { const cur = chain[first >= 0 ? first : chain.length - 1]; document.getElementById('jStory').innerHTML = story.intro && cur ? `<div class="q now"><span>&#10148;</span><span>${cur.goal}</span></div>` : '<div class="q">Your story begins at the next dawn...</div>'; }
    { const pw = powerOf(); document.getElementById('jPower').textContent = `Power ${pw.total} (bring ${pw.brought} · home ${pw.home} · you ${pw.me})`; }
    const fewBands = (d) => d.bands && escortBands.filter(i => escortPool().some(n => n.warband === i)).length < d.bands;
    const late = nowHour < 6 || nowHour >= CFG.EXP_LATEST, nightWhy = nightExpWhy(), lateFor = (d) => d.night ? !!nightWhy : late;
    document.getElementById('jHint').textContent = `Depart ${fmtH(6)}-${fmtH(CFG.EXP_LATEST)} · called home ${fmtH(CFG.EXP_FORCE)} · night sites 20:00-02:00`;
    escortBands = escortBands.filter(i => escortPool().some(n => n.warband === i));
    const wbRows = []; for (let i = 0; i < CFG.WARBAND.MAX; i++) {
      const mem = warbandMembers(i); if (!mem.length) continue;
      const ready = mem.filter(n => !n.down && !n.escort).length, on = bringing(i);
      wbRows.push(`<div class="ex"><div class="info"><b style="color:${warbandColor(i)}">&#9679; ${warbandName(i)} (${mem.length}/${CFG.WARBAND.SIZE})</b><small>${ready}/${mem.length} ready</small></div><button data-wb="${i}" ${ready ? '' : 'disabled'}>${on ? 'Going &#10003;' : ready ? 'Bring' : 'Away'}</button></div>`);
    }
    const wounded = npcs.filter(n => n.woundDays > 0).length, escHtml = `<div class="ex"><div class="info"><b>Warbands</b><small>Soldiers ${soldierCount()}/${soldierCap()} · bring up to ${bandMax()} · Courage ${Math.round(courageOf())}%${wounded ? ` · ${wounded} wounded` : ''}</small></div>${wounded ? `<button class="tendBtn" ${res.food < npcs.filter(n => n.woundDays > 0).reduce((a, n) => a + n.woundDays, 0) * CFG.WOUND.TEND_FOOD ? 'disabled' : ''}>Tend wounded (${npcs.filter(n => n.woundDays > 0).reduce((a, n) => a + n.woundDays, 0) * CFG.WOUND.TEND_FOOD} food)</button>` : ''}</div><div class="ex"><div class="info"><b>Levies</b><small>Weak villager fighters for the next journey only: ${levyCount()}/${CFG.LEVY.MAX} · ${CFG.LEVY.FOOD} food each</small></div><button class="levyBtn" ${levyCount() >= CFG.LEVY.MAX || res.food < CFG.LEVY.FOOD || exActive ? 'disabled' : ''}>Call levy</button></div><div class="ex"><div class="info"><b>Training Field</b><small>${trainReady() ? 'See every warband on parade and fight practice battles. No losses, no rewards.' : `Opens at Stage ${CFG.TRAIN.STAGE}`}</small></div><button class="trainBtn" ${trainReady() && !exActive ? '' : 'disabled'}>Parade</button><button class="siegeTrainBtn" ${trainReady() && !exActive ? '' : 'disabled'}>Siege</button></div>` + (wbRows.length ? wbRows.join('') : '<div class="ex"><div class="info"><small>No soldiers yet.</small></div></div>');
    const chLocked = (d) => (d.ch === 2 && !story.beacon) || (d.ch === 3 && !story.dawn) || (d.ch === 4 && !story.hollow) || (d.ch === 5 && !story.road) || (d.ch === 6 && !story.eclipse);
    const lockOf = (d) => stage < d.stage || chLocked(d) || (d.needs && !d.needs.every(r => story.relics[r])) || powerFor(d) < needOf(d);
    const rowOf = (d) => {
      const weak = powerFor(d) < needOf(d), lock = stage < d.stage || (d.ch === 2 && !story.beacon) || (d.ch === 3 && !story.dawn) || (d.ch === 4 && !story.hollow) || (d.ch === 5 && !story.road) || (d.ch === 6 && !story.eclipse) || (d.needs && !d.needs.every(r => story.relics[r])) || weak, found = d.relic && story.relics[d.id];
      return `<div class="ex"><div class="info"><b>${d.name}</b><small>${d.desc}</small><small>${d.risk}${d.raid ? ` · ⚔ ${d.bands} band${d.bands > 1 ? 's' : ''} · <span style="color:${realmDef(d.realm).color}">${realmDef(d.realm).short}</span>` : ''}${d.march ? ` · ${d.march}d march (${marchFood(d)} food)` : ''} · Power ${needOf(d)}${d.raid ? ` (you ${powerFor(d)})` : ''}${d.night ? ' · 🌙 ' + (nightWhy || 'Open now') : ''} · ${d.reward}${campReliefTxt(d.id)}${found ? ' · Relic recovered ✔' : ''}${lock ? (d.ch === 2 && !story.beacon ? ' · Light the Beacon first' : d.ch === 3 && !story.dawn ? ' · Open the Dawn Gate first' : d.ch === 4 && !story.hollow ? ' · Take the Winter Crown first' : d.ch === 5 && !story.road ? ' · Swear the Keeper\'s Oath first' : d.needs && !d.needs.every(r => story.relics[r]) ? ' · Needs the earlier sites\' relics' : stage < d.stage ? ` · Requires Stage ${d.stage}` : ` · Needs power ${needOf(d)}`) : ''}</small>${campHtml(d)}</div><button data-id="${d.id}" ${lock || lateFor(d) || fewBands(d) || isYours(d) ? 'disabled' : ''}>${lock ? 'Locked' : isYours(d) ? (holdOf(d.id) ? 'Held' : 'Broken') : lateFor(d) ? (d.night ? 'Night only' : 'Too late') : fewBands(d) ? `Bring ${d.bands} warbands` : 'Depart'}</button></div>`;
    };
    const mapHtml = () => {                                                  // 지도 화면: 마디(원정)와 길. 고르면 아래에 같은 카드가 나온다
      const N = CFG.MAP.NODES, V = CFG.MAP.START, vis = CFG.EXPEDITIONS.filter(d => N[d.id] && !chLocked(d)), ids = new Set(vis.map(d => d.id)), near = vis.filter(d => !N[d.id].far), far = vis.filter(d => N[d.id].far);
      if (!far.length) jMapFar = false;
      if (ids.has(jMapSel)) jMapFar = !!N[jMapSel].far; else jMapSel = (jMapFar ? far[0] : (near.find(d => !lockOf(d)) || near[0])).id;
      const FAR = { hillclan: { x: 30, y: 18, from: 'home' }, clanhold: { x: 62, y: 12, from: 'hillclan' }, legionkeep: { x: 30, y: 52, from: 'home' }, legionfort: { x: 58, y: 58, from: 'legionkeep' }, legioncastle: { x: 78, y: 38, from: 'legionfort' }, legionfortress: { x: 92, y: 20, from: 'legioncastle' }, clancastle: { x: 88, y: 6, from: 'clanhold' }, banditcastle: { x: 52, y: 34, from: 'home' }, ironthrone: { x: 92, y: 58, from: 'legioncastle' } };       // 먼 땅 지도: 마을에서 갈래로 뻗는 길
      const posOf = (id) => id === 'village' || id === 'home' ? V : N[id].far ? (FAR[id] || { x: 50, y: 35 }) : N[id];
      let lines = '', dots = '';
      const shown = jMapFar ? far : near;
      for (const d of shown) { const n = posOf(d.id), fr = jMapFar ? (FAR[d.id] ? FAR[d.id].from : 'home') : N[d.id].from; if (fr !== 'village' && fr !== 'home' && !ids.has(fr)) continue; const p = posOf(fr); lines += `<line x1="${p.x}" y1="${p.y}" x2="${n.x}" y2="${n.y}"${jMapFar ? ' class="far"' : ''}/>`; }
      for (const d of shown) {
        const n = posOf(d.id), locked = lockOf(d), sel = d.id === jMapSel, col = d.raid ? realmDef(d.realm).color : d.night ? '#6f7cff' : d.ch ? '#e0b43c' : '#5fc060', sym = d.raid ? '&#9876;' : d.night ? '&#9790;' : d.ch ? '&#9733;' : '&#9679;';
        dots += `<g data-node="${d.id}" class="${locked ? 'lk' : ''}"><circle class="hit" cx="${n.x}" cy="${n.y}" r="5"/><circle cx="${n.x}" cy="${n.y}" r="3.2" fill="${col}" stroke="${sel ? '#fff' : story.cleared[d.id] ? '#8fd49a' : '#2a2118'}" stroke-width="${sel || story.cleared[d.id] ? 1 : 0.5}"/><text x="${n.x}" y="${n.y + 1.1}">${sym}</text>${holdOf(d.id) ? `<text class="flag" x="${n.x + 3.8}" y="${n.y - 2.2}">&#9873;</text>` : story.cleared[d.id] ? `<text class="ok" x="${n.x + 3.6}" y="${n.y - 2.6}">&#10003;</text>` : ''}${sel ? `<text class="nm" x="${n.x}" y="${n.y + 7.2}">${d.name}</text>` : ''}</g>`;
      }
      const sd = CFG.EXPEDITIONS.find(d => d.id === jMapSel);
      return `${far.length ? `<div class="jtabs"><button data-maptab="near" class="${jMapFar ? '' : 'on'}">Near lands</button><button data-maptab="far" class="${jMapFar ? 'on' : ''}">Far lands (${far.length})</button></div>` : ''}<svg class="jmap" viewBox="0 0 100 70"><g class="roads">${lines}</g><g class="home" transform="translate(${V.x} ${V.y})"><circle r="3.6" fill="#c8923a"/><text y="1.2">&#8962;</text><text class="nm" y="7.2">Home</text></g>${dots}</svg><small class="jleg">&#9679; foray &nbsp; &#9876; raid (realm colour) &nbsp; &#9790; night &nbsp; &#9733; story</small>${realmBar()}` + (jMapFar ? `<small class="jleg">Far lands: each trip takes days of marching (food and home nights count)</small>` : '') + (sd ? rowOf(sd) : '') + escHtml;
    };
    const expList = mapHtml();
    document.getElementById('jExp').innerHTML = expList;       // 지도와 카드가 먼저, 전투단 목록은 그 아래
    if (jFocus) { jFocus = false; const card = jEl.querySelector('.jcard'), ex = document.getElementById('jExp'); if (card && ex) card.scrollTop += ex.getBoundingClientRect().top - card.getBoundingClientRect().top - 8; }       // 열거나 탭을 바꾸면 지도 부분으로 스크롤
    jEl.querySelectorAll('#jExp [data-node]').forEach(g => g.addEventListener('click', () => { jMapSel = g.dataset.node; renderJournal(); }));
    jEl.querySelectorAll('#jExp [data-maptab]').forEach(b => b.addEventListener('click', () => { jMapFar = b.dataset.maptab === 'far'; const ids2 = CFG.EXPEDITIONS.filter(d => CFG.MAP.NODES[d.id] && !chLocked(d) && !!CFG.MAP.NODES[d.id].far === jMapFar); if (ids2.length && !ids2.some(d => d.id === jMapSel)) jMapSel = ids2[0].id; renderJournal(); }));
    jEl.querySelectorAll('.tendBtn').forEach(b => b.addEventListener('click', tendWounded));
    jEl.querySelectorAll('.levyBtn').forEach(b => b.addEventListener('click', callLevy));
    jEl.querySelectorAll('.trainBtn').forEach(b => b.addEventListener('click', () => startTraining('parade')));
    jEl.querySelectorAll('.siegeTrainBtn').forEach(b => b.addEventListener('click', () => startTraining('siege')));
    jEl.querySelectorAll('#jExp button[data-id]').forEach(b => b.addEventListener('click', () => startExpedition(b.dataset.id)));
    jEl.querySelectorAll('#jExp .holdBtn').forEach(b => b.dataset.recall ? b.addEventListener('click', () => recallGarrison(b.dataset.recall)) : b.addEventListener('click', () => garrisonIt(b.dataset.hold)));
    jEl.querySelectorAll('#jExp .campBtn').forEach(b => b.addEventListener('click', () => buildCamp(b.dataset.camp)));
    jEl.querySelectorAll('#jExp button[data-wb]').forEach(b => b.addEventListener('click', () => { const i = +b.dataset.wb; toggleBring(i); renderJournal(); }));
  }
  function openJournal() { if (dead || exActive) return; jFocus = true; renderJournal(); jEl.style.display = 'flex'; }
  function closeJournal() { jEl.style.display = 'none'; }
  function toggleJournal() { jEl.style.display === 'flex' ? closeJournal() : openJournal(); }
  document.getElementById('jClose').addEventListener('click', closeJournal);

  // ---------- 대장간 연출: 굴뚝 연기 + 화덕 깜빡임 ----------
  let forgeFlash = 0, smokeCd = 0;
  const puffs = [];
  const smokeTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const c = cv.getContext('2d'), g = c.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv);
  })();
  function updateSmith(dt, t) {
    forgeFlash = Math.max(0, forgeFlash - dt * 2);
    const k = 0.7 + 0.25 * Math.sin(t * 11) * Math.sin(t * 7.3) + forgeFlash * 0.9;
    forgeGlow.color.setRGB(1, Math.min(1, 0.3 + 0.28 * k), 0.06 + 0.12 * k);
    smokeCd -= dt;
    if (smokeCd <= 0) {
      smokeCd = 0.45;
      for (const sm of smiths()) {
        if (puffs.length > 26) break;
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0xb8b8c0, transparent: true, opacity: 0.55, depthWrite: false }));
        sp.position.set(sm.position.x - 1.4 + rand(-0.1, 0.1), 3.4, sm.position.z - 0.9 + rand(-0.1, 0.1));
        sp.scale.setScalar(0.5); sp.userData = { life: 0, wind: rand(0.2, 0.5) };
        scene.add(sp); puffs.push(sp);
      }
    }
    for (const p of puffs.slice()) {
      p.userData.life += dt;
      p.position.y += dt * 1.1; p.position.x += dt * p.userData.wind;
      p.scale.setScalar(0.5 + p.userData.life * 0.9);
      p.material.opacity = Math.max(0, 0.55 * (1 - p.userData.life / 2.6));
      if (p.userData.life >= 2.6) { scene.remove(p); p.material.dispose(); puffs.splice(puffs.indexOf(p), 1); }
    }
  }
  // ---------- 행군 (원정 지도 2단계): 먼 곳(march 일)으로 가면 며칠이 흐른다. 병사들은 식량을 먹고, 마을의 밤은 자동으로 치른다 ----------
  // (이 파일의 것은 모두 function 선언이다)
  const soldierVal = (n) => 2 + 2 * (n.role === 'melee' ? soldierWeaponDef(n) : gearDef(n.gear.bow)).tier + 1.5 * gearDef(n.gear.armor).tier + 1.5 * vetLv(n);
  function marchPartySize() { return escortPool().filter(n => inParty(n)).slice(0, CFG.WARBAND.SIZE * bandMax()).length; }
  function marchFood(d) { const g = d.castle && story.siege ? Math.min(1, story.siege.ram) * CFG.SIEGE.FOOD_RAM + Math.min(CFG.SIEGE.LADDER_MAX, story.siege.ladder) * CFG.SIEGE.FOOD_LADDER + Math.min(1, story.siege.catapult || 0) * CFG.SIEGE.FOOD_CATAPULT : 0; return d.march ? Math.ceil((marchPartySize() * d.march * 2 * CFG.MAP_RULES.FOOD_PER_SOLDIER_DAY) * (hasPerk('provisioner') ? 0.75 : 1)) + g : 0; }
  function homeThreat(day) {                                              // 그날 밤 마을을 덮칠 적의 수 (startWave 와 같은 식, 무리 크기만)
    const threat = (1 + Math.max(0, prosScore - 40) / 120) * (story.beacon ? 0.85 : 1) * (story.finale ? 0.85 : 1) * (1 - campRelief(day));
    if (isRaid(day)) return Math.ceil((CFG.WAVE_BASE + day * CFG.WAVE_PER_DAY) * threat * dm().n);
    let n = day <= 2 ? CFG.QUIET_BASE + day : Math.min(CFG.QUIET_MAX, 3 + Math.floor(day / 2));
    const tp = nightTypeOf(day);
    if (tp === 'calm') n = Math.max(1, Math.floor(n * 0.5)); else if (tp === 'plunder') n = Math.ceil(n * 1.5) + 1; else if (tp === 'hunt') n = Math.ceil(n * 1.6) + 1; else if (tp === 'storm') n = Math.ceil(n * 1.2);
    return Math.ceil(n * threat * dm().n);
  }
  function homeGuard(away) {                                              // 마을에 남은 방어력: 남은 병사 + 타워 + 민병 + 성벽 상태
    let d = 0; for (const n of npcs) if (n.role !== 'citizen' && !n.down && !(away ? away.includes(n) : n.escort)) d += soldierVal(n);
    d += builtBuildings('tower').length * 4;
    const f = obstacles.filter(o => o.userData.type === 'fence'), wf = f.length ? f.reduce((a, o) => a + Math.max(0, o.userData.hp) / o.userData.maxHp, 0) / f.length : 0;
    return (d + 4 + npcs.filter(n => n.role === 'citizen').length * 0.4) * (0.7 + 0.3 * wf);
  }
  const nightRatio = (day, away) => homeGuard(away) / (homeThreat(day) * CFG.MAP_RULES.RAIDER_STRENGTH);
  function homeOdds(d) {                                                  // 출발 전 안내: 자리를 비우는 동안의 밤들 가운데 가장 위험한 밤
    const party = escortPool().filter(n => inParty(n)).slice(0, CFG.WARBAND.SIZE * bandMax());
    let worst = 9; for (let i = 0; i < d.march * 2; i++) worst = Math.min(worst, nightRatio(dayNow() + i, party));
    return worst >= 1.2 ? 'Village should hold' : worst >= 0.6 ? 'Walls may be hit' : worst >= 0.3 ? 'Heavy losses likely' : 'Village may fall: keep a warband home';
  }
  function resolveHomeNight(day) {                                        // 마을의 밤 하나를 숫자로 치르고, 아침 보고서에 쓸 한 줄을 돌려준다
    const n = homeThreat(day), r = nightRatio(day), fences = obstacles.filter(o => o.userData.type === 'fence');
    const hurt = (frac, dmgFrac) => { for (const o of fences.slice()) if (Math.random() < frac) damageStructure(o, o.userData.maxHp * dmgFrac / dm().dmg); };
    const lose = (f) => { for (const k of ['wood', 'stone', 'food', 'iron']) res[k] = Math.floor(res[k] * (1 - f)); };
    const loseCitizen = () => { const c = npcs.filter(x => x.role === 'citizen'); if (c.length > 1) { const v = c[Math.floor(Math.random() * c.length)]; removeNpc(v); return true; } return false; };
    let msg;
    if (r >= 1.2) msg = `Night ${day}: ~${n} raiders repelled.`;
    else if (r >= 0.6) { hurt(0.25, 0.35); msg = `Night ${day}: ~${n} raiders repelled, walls hit.`; }
    else if (r >= 0.3) { hurt(0.5, 0.6); lose(0.1); const c = Math.random() < 0.35 && loseCitizen(); msg = `Night ${day}: ~${n} raiders broke through${c ? ', a villager lost' : ''}.`; }
    else { hurt(0.7, 1.2); lose(0.25); let c = 0; for (let i = 0; i < 2; i++) if (Math.random() < 0.6 && loseCitizen()) c++; msg = `Night ${day}: about ${n} raiders overran the village! Walls fell, a quarter of the stores were taken${c ? ` and ${c} villager${c > 1 ? 's' : ''} lost` : ''}.`; }
    updateHud();
    return msg;
  }
  function marchMorningLite() {                                           // 지나가는 아침마다: 시민 식사 (조용히)와 야영지 수입
    for (const c of npcs.filter(x => x.role === 'citizen')) { const need = rationOf(c); if (res.food >= need) { res.food -= need; c.hungry = false; } else c.hungry = true; }
    campIncome(); holdsMorning();
  }
  function marchOut(d) {                                                  // 출발: 같은 시각에 도착하도록 며칠을 넘긴다
    const lines = [], D = dayNow();
    for (let i = 0; i < d.march; i++) { lines.push(resolveHomeNight(D + i)); if (i > 0) marchMorningLite(); }
    gameMin += d.march * 1440;
    return lines;
  }
  function marchBack(d) {                                                 // 귀환: 돌아오는 밤들을 치르고 도착 아침 06:30 에 마을에 선다
    const lines = [], D = dayNow();
    for (let i = 0; i < d.march; i++) { lines.push(resolveHomeNight(D + i)); if (i > 0) marchMorningLite(); }
    gameMin = (D + d.march - 1) * 1440 + 6.5 * 60;
    return lines;
  }
  function showTripReport(title, lines) {
    document.getElementById('repTitle').textContent = title;
    repList.innerHTML = lines.map(t => `<li>${t}</li>`).join('');
    repEl.classList.add('show'); clearTimeout(repTimer); repTimer = setTimeout(() => repEl.classList.remove('show'), 20000);
  }
  // ---------- 점령지 (원정 지도 3단계): 무너뜨린 야영지에 병사를 남겨 지키면 '점령지'가 된다. 수입과 습격 감소가 계속되지만 적이 되찾으러 올 수 있다 ----------
  // (이 파일의 것은 모두 function 선언이다) story.holds[id] = { n: 주둔 병사 수, since: 날 }, story.clearedDay[id] = 마지막으로 무너뜨린 날
  const HOLD_MAX = 3, HOLD_REVERT_DAYS = 10, HOLD_RANK = { clanwatch: 1.2, legionpost: 1.4, clanhold: 2.2, legionkeep: 2, legioncastle: 2.6, legionfortress: 3.2, clancastle: 2.6, banditcastle: 2.6, ironthrone: 3.6, raiderpost: 1, banditcamp: 1.4, hillclan: 1.4, banditfort: 2, legionfort: 2.4 };
  const holdOf = (id) => (story.holds || {})[id] || null;
  const holdCount = () => Object.values(story.holds || {}).reduce((a, h) => a + h.n, 0);
  function holdRisk(id) {                                                  // 하루에 되찾으러 올 확률과, 왔을 때 지킬 확률
    const h = holdOf(id), d0 = CFG.EXPEDITIONS.find(x => x.id === id), rank = (HOLD_RANK[id] || 1) * (d0 && d0.realm ? realmStrength(d0.realm) : 1), n = h ? h.n : 1, chance = Math.min(0.5, 0.06 * rank / n), atk = 6 * rank + dayNow() * 0.4, ratio = (n * 9) / atk;
    return { chance, win: Math.min(1, ratio) };
  }
  function pickGarrison() {                                                // 마을에 남은 병사 가운데 가장 약한 병사
    let best = null, bv = 1e9;
    for (const n of npcs) if (n.role !== 'citizen' && !n.escort && !n.down && !n.promote) { const v = soldierVal(n); if (v < bv) { bv = v; best = n; } }
    return best;
  }
  function garrisonOut(n) {                                                // 병사를 마을에서 빼서 점령지로 보낸다 (죽은 것이 아니므로 애도 없음)
    npc = n; setTask(null); returnGear(n); scene.remove(n); npcs.splice(npcs.indexOf(n), 1);
  }
  function garrisonIt(id) {
    const d = CFG.EXPEDITIONS.find(x => x.id === id); if (!d || !d.raid || !story.cleared[id]) return;
    story.holds = story.holds || {}; const h = story.holds[id];
    if (h && h.n >= HOLD_MAX) return toast('Garrison is full');
    const s = pickGarrison(); if (!s) return toast('No free soldier');
    const name = s.name, man = { name: s.name, trait: s.trait, xp: { ...(s.xp || {}) }, vxp: s.vxp || 0, cstr: s.cstr || 0, cspd: s.cspd || 0 }; garrisonOut(s);
    if (h) { h.n++; (h.men = h.men || []).push(man); } else { story.holds[id] = { n: 1, since: dayNow(), men: [man] }; story.camps[id] = true; rebuildCamps(); }
    toast(`${name} garrisons ${d.name}`); Snd.play('chime'); updateHud(); realmCheck(); renderJournal();
  }
  function recallGarrison(id) {                                            // 점령지에 둔 병사 한 명을 마을로 불러온다 (이름·성격·숙련은 그대로)
    const d = CFG.EXPEDITIONS.find(x => x.id === id), h = holdOf(id); if (!d || !h) return;
    const man = (h.men && h.men.pop()) || {}, n = makeNpc('melee', homeSlot(npcs.length), 'initial', 0, { name: man.name, trait: man.trait, xp: man.xp });
    if (man.vxp) n.vxp = man.vxp; n.cstr = man.cstr || 0; n.cspd = man.cspd || 0;
    h.n--; if (h.n <= 0) { delete story.holds[id]; (story.clearedDay = story.clearedDay || {})[id] = dayNow(); }          // 마지막 병사가 돌아오면 열흘 뒤 다시 산적이 차지한다
    toast(`${n.name} returns from ${d.name}`); Snd.play('chime'); updateHud(); realmCheck(); renderJournal();
  }
  function holdsMorning() {                                                // 매일 아침: 주둔 병사의 식량, 되찾으러 오는 적, 방치된 곳의 복귀
    woundsMorning();
    const hs = story.holds || {}, day = dayNow(), lines = [];
    for (const id of Object.keys(hs)) {
      const d = CFG.EXPEDITIONS.find(x => x.id === id), h = hs[id]; if (!d) continue;
      res.food = Math.max(0, res.food - h.n);                              // 주둔 병사는 하루에 식량 1씩
      const r = holdRisk(id);
      if (Math.random() < r.chance) {
        if (Math.random() < r.win) lines.push(`${d.name} held.`);
        else { delete hs[id]; story.camps[id] = false; story.cleared[id] = false; rebuildCamps(); lines.push(`${d.name} fell. Garrison lost.`); }
      }
    }
    const cd = story.clearedDay || {};
    for (const id of Object.keys(story.cleared || {})) {                    // 지키는 병사가 없는 야영지는 열흘 뒤 산적이 다시 차지한다
      const d = CFG.EXPEDITIONS.find(x => x.id === id);
      if (d && d.raid && story.cleared[id] && !hs[id] && cd[id] !== undefined && day - cd[id] >= HOLD_REVERT_DAYS) { story.cleared[id] = false; story.camps[id] = false; rebuildCamps(); lines.push(`Bandits retook ${d.name}.`); }
    }
    if (lines.length) setTimeout(() => toast(lines.join(' ')), 2400);
  }
  function holdHtml(d) {                                                   // 일지 카드: 점령 상태와 버튼 (글은 짧게)
    if (!d.raid) return '';
    const h = holdOf(d.id), inc = Object.entries(CFG.CAMPS[d.id] || {}).map(([k, v]) => `+${v} ${k}`).join(' ');
    if (h) { const r = holdRisk(d.id); return `<small>&#9873; Held ${h.n}/${HOLD_MAX} · ${inc}/day · retake ${Math.round(r.chance * 100)}%/day, hold ${Math.round(r.win * 100)}%<br><button class="holdBtn" data-hold="${d.id}" ${h.n >= HOLD_MAX ? 'disabled' : ''}>+1 soldier</button> <button class="holdBtn" data-recall="${d.id}">Bring 1 home</button></small>`; }
    if (story.camps[d.id]) return `<small>&#10003; Camp ${inc}/day</small>`;
    if (story.cleared[d.id]) { const cd = (story.clearedDay || {})[d.id]; return `<small>Broken${cd === undefined ? '' : ` · lost in ${Math.max(0, HOLD_REVERT_DAYS - (dayNow() - cd))}d`}<br><button class="holdBtn" data-hold="${d.id}">Garrison (1 soldier)</button></small>`; }
    return '';
  }
  const levyCount = () => npcs.filter(n => n.levy).length;
  function callLevy() {                                                      // 농민병 소집: 식량을 내고 약한 임시 병사를 하나 부른다 (다음 원정 한 번만)
    if (exActive || dead) return;
    if (levyCount() >= CFG.LEVY.MAX) return toast('No more villagers can be called');
    if (res.food < CFG.LEVY.FOOD) return toast(`Need ${CFG.LEVY.FOOD} food`);
    res.food -= CFG.LEVY.FOOD; const k = levyCount() + 1, n = makeNpc('melee', homeSlot(npcs.length), 'initial', 0, { name: `Levy ${k}` });
    n.levy = true; n.warband = -3; n.maxHp = Math.round(n.maxHp * CFG.LEVY.HP); n.hp = n.maxHp; applyGear(n);
    toast(`${n.name} called up`); Snd.play('horn', 0.5); updateHud(); renderJournal();
  }
  function dismissLevy(n) { npc = n; scene.remove(n); const i = npcs.indexOf(n); if (i >= 0) npcs.splice(i, 1); }
  const woundedList = () => npcs.filter(n => n.woundDays > 0);
  function tendWounded() {                                                   // 식량을 내고 부상병을 모두 바로 낫게 한다 (부상 하루당 식량 3)
    const w = woundedList(); if (!w.length) return;
    const cost = w.reduce((a, n) => a + n.woundDays, 0) * CFG.WOUND.TEND_FOOD;
    if (res.food < cost) return toast(`Need ${cost} food to tend them`);
    res.food -= cost; for (const n of w) { n.woundDays = 0; n.sitting = false; } updateHud(); toast(`${w.length} wounded tended (${cost} food)`); Snd.play('heal', 0.5); renderJournal();
  }
  function woundsMorning() {                                                 // 아침: 부상이 줄어든다 (마을에 치료사가 있으면 하루 더), 불려 온 농민병은 돌아간다, 용기는 조금씩 되돌아온다
    const medic = Math.min(2, npcs.filter(n => n.role === 'melee' && !n.escort && !n.down && !n.levy && homeCls(n) === 'medic').length) * CFG.WOUND.MEDIC_EXTRA;
    for (const n of npcs) if (n.woundDays > 0) n.woundDays = Math.max(0, n.woundDays - 1 - medic - (builtBuildings('infirmary').length ? 1 : 0));       // 병원이 있으면 하루 더 빨리 낫는다
    { const seats = CFG.YARD_SEATS * builtBuildings('trainyard').length;                                    // 훈련소: 집에 있는 병사가 아침마다 숙련 +1
      if (seats) { const pool = npcs.filter(n => n.role !== 'citizen' && !n.levy && !n.escort && !n.down && !(n.woundDays > 0)).slice(0, seats); let up = 0; for (const n of pool) { const b = vetLv(n); n.vxp = (n.vxp || 0) + CFG.YARD_XP; if (vetLv(n) > b) up++; } if (pool.length) setTimeout(() => toast(`Yard drills: ${pool.length} soldiers trained${up ? ` · ${up} new veteran rank${up > 1 ? 's' : ''}` : ''}`), 2500); } }
    { const mills = builtBuildings('windmill').length; if (mills) res.food += CFG.WINDMILL_FOOD * mills; }       // 풍차는 아침마다 식량
    for (const n of npcs.filter(x => x.levy && !x.escort)) dismissLevy(n);
    const c = courageOf(), K = CFG.COURAGE.START + (hasPerk('banneret') ? 10 : 0), D = CFG.COURAGE.DRIFT * (hasPerk('banneret') ? 1.6 : 1); story.courage = c < K ? Math.min(K, c + D) : c > K ? Math.max(K, c - D) : c;
    if (res.food <= 0 && npcs.some(n => n.role !== 'citizen')) addCourage(-CFG.COURAGE.HUNGRY);
    if (builtBuildings('monument').length) addCourage(CFG.MONUMENT_COURAGE);                // 승전 기념비: 아침마다 사기 +3 (드리프트 뒤에 더한다)
  }
  // ---------- 세력 (원정 지도 4단계): 산적 영주 / 언덕 부족 / 강철 군단. 큰 습격은 한 세력이 보낸다. 그 세력의 야영지를 점령할수록 그 세력의 습격이 약해진다 ----------
  // (이 파일의 것은 모두 function 선언이다)
  const realmDef = (id) => CFG.REALMS.find(r => r.id === id) || CFG.REALMS[0];
  const realmSites = (id) => CFG.EXPEDITIONS.filter(d => d.realm === id);
  const realmHeld = (id) => realmSites(id).filter(d => holdOf(d.id)).length;
  const realmOfNight = (day) => isRaid(day) ? CFG.REALMS[(day * 5 + 1) % CFG.REALMS.length].id : null;       // 큰 습격이 오는 밤마다 정해진 세력
  function realmRelief(id) {                                              // 그 세력의 습격이 줄어드는 정도: 기한 중인 효과 + 점령지 (모두 점령하면 크게 꺾인다)
    const fx = story.campFx || [], d = dayNow(), held = story.holds || {};
    const ids = new Set(fx.filter(x => d <= x.until).map(x => x.id).concat(Object.keys(held)));
    let r = 0; for (const s of realmSites(id)) if (ids.has(s.id) && CFG.CAMP_RELIEF[s.id]) r += CFG.CAMP_RELIEF[s.id].pct;
    r = Math.min(CFG.REALM_RELIEF_MAX, r);
    return realmHeld(id) >= realmSites(id).length ? Math.max(r, CFG.REALM_BROKEN) : r;
  }
  function campRelief(day) {                                              // 그날 밤의 습격 감소율 (큰 습격: 그 세력 것, 조용한 밤: 세 세력의 평균)
    if (day === undefined) return Math.max(...CFG.REALMS.map(r => realmRelief(r.id)));
    const rn = realmOfNight(day);
    return rn ? realmRelief(rn) : CFG.REALMS.reduce((a, r) => a + realmRelief(r.id), 0) / CFG.REALMS.length;
  }
  const realmStrength = (id) => Math.max(0.4, 1 - 0.2 * realmHeld(id));      // 점령지가 많을수록 그 세력이 되찾으러 오는 힘도 약해진다
  function realmBar() {                                                    // 일지: 세력별 점령 현황 한 줄
    return `<div class="jrealm">${CFG.REALMS.map(r => `<span style="color:${r.color}">&#9679; ${r.short} ${realmHeld(r.id)}/${realmSites(r.id).length}</span>`).join('')}</div>` + throneLine();
  }
  function realmCheck() {                                                  // 한 세력을 모두 점령하면 한 번 알린다
    story.realmDone = story.realmDone || {};
    for (const r of CFG.REALMS) if (realmHeld(r.id) >= realmSites(r.id).length && !story.realmDone[r.id]) { story.realmDone[r.id] = true; toast(`${r.name} broken!`); Snd.play('victory'); }
  }
  // ---------- 훈련장 (Training Field): 별도 지역. 모든 전투단이 줄지어 서고, 모의 전투를 치른다. 시계는 멈추고, 아무도 다치지 않으며, 보상도 없다 ----------
  // (이 파일의 것은 모두 function 선언이다)
  const TRAIN_DEST = { id: 'trainfield', name: 'Training Field', training: true, tint: 0x4d6a3c, trees: 6, rocks: 3, ore: 0, chests: 0, foes: [], desc: '' };
  function trainReady() { return stage >= CFG.TRAIN.STAGE; }
  const TRAIN_SIEGE = { id: 'trainsiege', name: 'Siege practice', training: true, siege: true, tint: 0x4d6a3c, trees: 0, rocks: 2, ore: 0, chests: 0, get camp() { return CFG.TRAIN.SIEGE.camp; }, get foes() { return CFG.TRAIN.SIEGE.foes; }, get guardian() { return CFG.TRAIN.SIEGE.guardian; }, desc: '' };
  function startTraining(mode) {
    if (exActive || dead || exEnding) return;
    if (!trainReady()) return toast(`The Training Field opens at Stage ${CFG.TRAIN.STAGE}`);
    if (nowHour < 6 || nowHour >= 16) return toast('Train in daylight (before 16:00)');
    if (!escortPool().length) return toast('No soldiers to train');
    closeJournal(); exEnding = true; gathering = null;
    fadeTo(() => {
      const siege = mode === 'siege', dest = siege ? TRAIN_SIEGE : TRAIN_DEST;
      exActive = { dest, training: true, night: false, ret: { x: player.position.x, z: player.position.z }, res0: { ...res } };
      siegeLoad = siege ? { ram: 1, ladder: CFG.SIEGE.LADDER_MAX, catapult: 1 } : { ram: 0, ladder: 0, catapult: 0 }; exStats = { kills: 0, t0: performance.now(), battle: null };       // 공성 연습: 장비는 소모되지 않는다
      buildZone(dest); if (siege) exActive.prep = true;
      const party = escortPool(), bands = [...new Set(party.map(n => n.warband))].sort((a, b) => (a < 0 ? 99 : bannerOf(a) >= 0 ? bannerOf(a) * 10 + a : 50 + a) - (b < 0 ? 99 : bannerOf(b) >= 0 ? bannerOf(b) * 10 + b : 50 + b));
      bands.forEach((bi, row) => {                                              // 전투단마다 한 줄: 왼쪽에 깃발과 이름
        const z = EXC.z - (exR - 12) + row * 3.6, mem = party.filter(n => n.warband === bi), col = bi >= 0 ? warbandColor(bi) : '#9aa0aa';
        const g = new THREE.Group(), pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4, 6), lampPostMat), cloth = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.05), new THREE.MeshStandardMaterial({ color: new THREE.Color(col), flatShading: true }));
        pole.position.y = 2; cloth.position.set(0.6, 3.4, 0); g.add(pole, cloth);
        const lbl = textSprite(bi >= 0 ? warbandName(bi) + (bannerOf(bi) >= 0 ? ` (${CFG.BANNER.NAMES[bannerOf(bi)]})` : '') : 'Levies', col, 3.4, 0.9, 'bold 52px sans-serif'); lbl.position.set(0, 4.6, 0); g.add(lbl);
        g.position.set(EXC.x - 10, 0, z); exAdd(g, false);
        if (siege) { const mem2 = party.filter(n => n.warband === bi); mem2.forEach((n, j) => { npc = n; setTask(null); n.workT = 0; n.promote = null; n.target = null; n.returning = false; returnGear(n); n.clsHome = homeCls(n); n.cls = tripCls(n); applyGear(n); n.escort = true; n.hold = null; n.parade = null; n.position.set(EXC.x + ((j % 6) - 2.5) * 1.8, 0, EXC.z - (exR - 15) - row * 1.6); n.px = n.position.x; n.pz = n.position.z; n.hidden = false; n.hp = n.maxHp; }); return; }
        mem.forEach((n, j) => {
          npc = n; setTask(null); n.workT = 0; n.promote = null; n.target = null; n.returning = false; returnGear(n);
          n.clsHome = homeCls(n); n.cls = tripCls(n); applyGear(n);
          n.escort = true; n.hold = null; n.parade = { x: EXC.x - 6 + j * 2.2, z }; n.position.set(n.parade.x, 0, z); n.px = n.position.x; n.pz = n.position.z; n.hidden = false; n.hp = n.maxHp;
        });
      });
      exActive.party = party.length;
      player.position.set(EXC.x, 0, EXC.z - (exR - 22)); facing = 0; player.rotation.y = 0; yaw = 0; DIST = Math.min(DIST_MAX, 26); pitch = 0.95;
      camera.position.copy(goalPos(camGoal)); lookAt.set(player.position.x, LOOK_H, player.position.z);
      exEnding = false; updateExUi(); toast(siege ? 'Siege practice: break the gate, take the keep. Gear is not used up' : `Training Field: ${party.length} soldiers on parade. Pick a practice battle`); Snd.play('horn');
    });
  }
  function trainSpawn(id) {                                                  // 모의 전투: 정해진 적을 불러낸다 (다치지도 보상도 없다)
    if (!exActive || !exActive.training) return;
    const set = CFG.TRAIN.SETS.find(s => s.id === id); if (!set || exActive.dest.siege) return;
    trainClear(true);
    const foes = set.foes.slice(); foes.forEach((kind, i) => {
      const a = (i / Math.max(1, foes.length) - 0.5) * 1.6, p = { x: EXC.x + Math.sin(a) * 18, z: EXC.z - 17 + Math.cos(a) * 4 + (i % 2) * 2 };
      spawnEnemy(kind, p); const u = enemies[enemies.length - 1].userData; u.ex = true; u.practice = true; u.aggro = true;
    });
    exStats.battle = { id, label: set.label, n: foes.length, t0: performance.now(), k0: exStats.kills };
    toast(`${set.label}: ${foes.length} foes. Fight!`); Snd.play('horn');
  }
  function trainDrill() {                                                    // 훈련: 오늘 아직 훈련하지 않은 병사에게 숙련(drill) +2, 병사 한 명당 식량 1 (하루에 한 번만)
    if (!exActive || !exActive.training || exActive.dest.siege) return;
    const K = CFG.TRAIN.DRILL, day = dayNow(), todo = npcs.filter(n => n.escort && n.role !== 'citizen' && !n.levy && n.drillDay !== day);
    if (!todo.length) return toast('Everyone has drilled today');
    const cost = todo.length * K.FOOD; if (res.food < cost) return toast(`Need ${cost} food to drill ${todo.length} soldiers`);
    res.food -= cost; let up = 0;
    for (const n of todo) { const b = vetLv(n); n.vxp = (n.vxp || 0) + K.XP + (drilledTogether(n) ? CFG.BANNER.DRILL_XP : 0) + pl.st.drillmaster; n.drillDay = day; if (vetLv(n) > b) { up++; floatText(`${n.name}: Veteran ${vetLv(n)}`, n.position.x, 3.0, n.position.z); } npc = n; n.anim.once('attackSword'); }
    updateHud(); Snd.play('chime'); toast(`Drills: ${todo.length} soldiers +${K.XP} drills (${cost} food)${up ? ` · ${up} new veteran rank${up > 1 ? 's' : ''}` : ''}`);
  }
  function trainClear(silent) {
    for (const e of enemies.slice()) if (e.userData.practice) removeEnemy(e);
    if (exStats) exStats.battle = silent ? exStats.battle : null; if (!silent) toast('Field cleared');
  }
  function trainTick(dt) {                                                   // 모의 전투가 끝나면 짧은 보고를 보여 준다
    const B = exStats && exStats.battle; if (!B) return;
    if (enemies.some(e => e.userData.practice && !e.userData.sinking && !(e.userData.dying > 0))) return;
    const secs = Math.round((performance.now() - B.t0) / 1000), down = npcs.filter(n => n.escort && n.hp < n.maxHp * 0.5).length;
    exStats.battle = null;
    showTripReport(`Practice battle: ${B.label}`, [`Foes defeated: ${exStats.kills - B.k0} of ${B.n}`, `Time ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`, `Soldiers badly hurt (would be wounded): ${down}`, 'Practice only: no losses, no rewards.']);
    for (const n of npcs) if (n.escort) n.hp = n.maxHp;
  }
  function endTraining() {
    const ex = exActive; if (!ex || exEnding) return; exEnding = true; gathering = null;
    fadeTo(() => {
      const back = npcs.filter(x => x.escort);
      back.forEach((n, k) => { n.escort = false; n.hold = null; n.parade = null; n.cls = homeCls(n); applyGear(n); n.hp = n.maxHp; const a = k * 2.4, rr = 2 + (k % 3) * 0.9; n.position.set(ex.ret.x + Math.sin(a) * rr, 0, ex.ret.z + Math.cos(a) * rr); n.px = n.position.x; n.pz = n.position.z; n.atkCd = 0; });
      cleanupZone(); exActive = null;
      player.position.set(ex.ret.x, 0, ex.ret.z); camera.position.copy(goalPos(camGoal)); lookAt.set(player.position.x, LOOK_H, player.position.z);
      exEnding = false; updateExUi(); updateHud(); toast('Back from the Training Field');
    });
  }
  document.getElementById('trainBar').addEventListener('pointerdown', e => { const b = e.target.closest('button'); if (!b) return; e.preventDefault(); e.stopPropagation(); const k = b.dataset.tr; if (k === 'clear') trainClear(); else if (k === 'drill') trainDrill(); else if (k === 'leave') endTraining(); else trainSpawn(k); });
  // ---------- 끝맺음 (Endgame): 철의 왕좌를 무너뜨리면(story.campaignWon) 승리 화면이 한 번 뜬다. 계속 다스리거나 New Game+ 로 갈 수 있다 ----------
  function throneLine() {                                                   // 일지의 마지막 목표 줄: 세 성을 모두 꺾으면 철의 왕좌로 진군할 수 있다
    const d = CFG.EXPEDITIONS.find(x => x.id === 'ironthrone'); if (!d) return '';
    const need = [].concat(d.after || []), done = need.filter(id => story.cleared && story.cleared[id]).length;
    const txt = story.campaignWon ? 'Iron Throne: taken' : done >= need.length ? 'Iron Throne: open - march when ready' : `Iron Throne: break the three castles (${done}/${need.length})`;
    return `<div class="jrealm"><span style="color:#ffd27a">&#9813; ${txt}</span></div>`;
  }
  const victoryEl = document.getElementById('victory');
  function showVictory() {
    story.victoryShown = true; uiPause = true;
    const broken = CFG.REALMS.filter(r => story.realmDone && story.realmDone[r.id]).length, bld = obstacles.filter(o => o.userData.type === 'building').length;
    document.getElementById('vText').textContent = 'The Iron Warlord is dead and the three realms are broken. The night will never be the same.';
    const rows = [['Days', dayNow()], ['Hero level', pl.lvl], ['Foes defeated', totalKills], ['Population', npcs.length], ['Soldiers', soldierCount()], ['Sites held', holdCount()], ['Realms broken', `${broken}/${CFG.REALMS.length}`], ['Buildings', bld], ['Stage', CFG.STAGES[stage - 1].name], ['Difficulty', CFG.DIFFS[diff].label + (ngLevel ? ' NG+' + ngLevel : '')]];
    document.getElementById('vStats').innerHTML = rows.map(([k, v]) => `<li>${k}<b>${v}</b></li>`).join('');
    victoryEl.classList.add('show'); Snd.play('victory'); try { saveGame(); } catch (e) { /* ignore */ }
  }
  function victoryTick() {                                                  // 원정에서 돌아와 마을에 있을 때 한 번만 띄운다
    if (!story.campaignWon || story.victoryShown || exActive || exEnding || dead || eventOpen || uiPause) return;
    showVictory();
  }
  document.getElementById('vKeep').addEventListener('click', () => { victoryEl.classList.remove('show'); uiPause = false; toast('Endless rule begins: the night still comes'); });
  document.getElementById('vNG').addEventListener('click', () => {
    try { localStorage.setItem('nf_carry', JSON.stringify({ ng: ngLevel + 1, lvl: pl.lvl, st: { ...pl.st } })); sessionStorage.setItem('nf_intent', 'ng'); } catch (e) { /* ignore */ }
    location.reload();
  });
  document.getElementById('vMenu').addEventListener('click', () => {
    try { saveGame(); localStorage.setItem('nf_carry', JSON.stringify({ ng: ngLevel + 1, lvl: pl.lvl, st: { ...pl.st } })); sessionStorage.setItem('nf_intent', 'title'); } catch (e) { /* ignore */ }
    location.reload();
  });
  // ---------- 메인 루프 ----------
  const SPEED = 6;
  let mvActive = false;                                       // Model field (19-model-field.js) is showing: the game is not stepped
  let bootFrames = 0;                                         // frames drawn so far; the loading cover waits for a few after the start scene is built
  // ---------- 날씨: 비(봄·가을 위주, 폭풍우 밤엔 항상) / 눈(겨울). 시야와 빛이 줄고, 궁수의 사거리가 짧아진다 ----------
  const WX_N = 1600, WX_BASE = 650, wxPos = new Float32Array(WX_N * 6), wxVel = new Float32Array(WX_N), wxLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xaec6ff, transparent: true, opacity: 0.0, depthWrite: false, fog: false }));
  for (let i = 0; i < WX_N; i++) { const x = rand(-16, 16), y = rand(0, 14), z = rand(-16, 16); wxPos.set([x, y, z, x, y + 0.7, z], i * 6); wxVel[i] = rand(0.8, 1.2); }
  wxLines.geometry.setAttribute('position', new THREE.BufferAttribute(wxPos, 3)); wxLines.frustumCulled = false; scene.add(wxLines);
  let wx = { kind: 'none', day: -1, lvl: 0, target: 0, snd: 0 };
  const dayWeather = (d) => { const s = seasonOfDay(d).id, h = ((d * 2654435761) >>> 0) % 100; return s === 'winter' ? (h < 38 ? 'snow' : 'none') : s === 'summer' ? (h < 10 ? 'rain' : 'none') : (h < 30 ? 'rain' : 'none'); };
  const rainNow = () => wx.lvl * (wx.kind === 'rain' ? 1 : 0);
  function weatherStep(dt, night, hour) {
    const dn = dayNow();
    if (dn !== wx.day) { wx.day = dn; wx.kind = dayWeather(dn); if (dn > 1 && wx.kind !== 'none') setTimeout(() => toast(wx.kind === 'rain' ? 'Rain today: the view is shorter and archers shoot less far' : 'It is snowing today'), 3500); }
    const storm = night && wave.type === 'storm' && !exActive, kind = storm ? 'rain' : wx.kind;
    const want = exActive ? 0 : storm ? 1 : (kind !== 'none' && hour >= 7 && hour < 20) ? 0.7 : (kind !== 'none' ? 0.5 : 0);
    wx.lvl += (want - wx.lvl) * Math.min(1, dt * 0.5);
    const show = wx.lvl > 0.03, snow = !storm && wx.kind === 'snow';
    wxLines.visible = show; if (!show) return;
    const mat = wxLines.material; mat.color.setHex(snow ? 0xffffff : 0xaec6ff); mat.opacity = Math.min(0.55, wx.lvl * 0.6);
    const zoom = Math.min(3.2, Math.max(1, DIST / 12)), live = Math.min(WX_N, Math.round(WX_BASE * zoom * zoom * 0.5 + WX_BASE * 0.5));        // 카메라를 멀리 당기면 비 구역도 함께 커진다 (마을 전체에 내린다)
    wxLines.scale.set(zoom, zoom, zoom); wxLines.geometry.setDrawRange(0, Math.max(WX_BASE, live) * 2);
    wxLines.position.set(player.position.x, player.position.y, player.position.z);
    const a = wxLines.geometry.attributes.position.array, fall = snow ? 2.2 : 16, len = snow ? 0.12 : 0.75;
    for (let i = 0, n = Math.max(WX_BASE, live); i < n; i++) {
      const o = i * 6; let y = a[o + 1] - fall * wxVel[i] * dt; if (y < 0) y += 14;
      a[o + 1] = y; a[o + 4] = y + len; a[o] = a[o + 3] += (snow ? Math.sin(y * 2 + i) * 0.4 : -2.0) * dt; if (a[o] < -16) a[o] = a[o + 3] += 32; a[o + 2] = a[o + 5];
    }
    wxLines.geometry.attributes.position.needsUpdate = true;
    ambient.intensity *= 1 - 0.14 * wx.lvl; sun.intensity *= 1 - 0.3 * wx.lvl; scene.fog.near *= 1 - 0.3 * wx.lvl; scene.fog.far *= 1 - 0.3 * wx.lvl;
    if (!snow && (wx.snd -= dt) <= 0) { wx.snd = 0.5; Snd.play('rain', wx.lvl); }
  }
  let propCd = 0, peaceful = false, peaceT = 0, fogNight = false, fogBoost = 0;          // 주변에 적이 없는 상태가 잠시 이어지면 평화로운 밤 (시민들이 모닥불 곁에서 쉰다)
  const xhairEl = document.getElementById('xhair'), xhV = new THREE.Vector3(); let xhLock = false;
  let facing = 0, moveDir = 'f', lastMX = 0, lastMZ = 0, lastMT = -1e9;
  const clock = new THREE.Clock();
  let resting = false, sparT = 0;
  let fpsT = 0, fpsN = 0, stormT = 5, lightning = 0, thunderIn = 0;

  function tick() {
    requestAnimationFrame(tick);
    if (mvActive) { mvStep(clock.getDelta()); return; }
    const rawDt = clock.getDelta(); fpsT += rawDt; fpsN++; if (fpsT >= 1) { window.__nfFps = Math.round(fpsN / fpsT); fpsN = 0; fpsT = 0; }
    const dt = Math.min(rawDt, 0.05) * (eventOpen || uiPause ? 0 : 1);       // 아침 이벤트 창이 열려 있으면 시간이 멈춘다
    const t = clock.elapsedTime;

    // 시간 / 조명
    { const h0 = (gameMin / 60) % 24, isNight = h0 >= 18 || h0 < 6;
      gameMin += dt * MIN_PER_SEC * (exActive ? (exActive.training ? 0 : CFG.EXP_TIME_MULT) : isNight ? (resting ? CFG.REST_SPEED : CFG.NIGHT_SPEED) : 1); }          // 원정 중에는 천천히, 밤에는 빠르게(쉬는 중에는 아주 빠르게)
    const hour = (gameMin / 60) % 24;
    const night = hour >= 20 || hour < 5;
    const nf = nightFactor(hour);
    const dayNo0 = Math.floor(gameMin / 1440) + 1, nightDay = hour < 7 ? dayNo0 - 1 : dayNo0;
    applyLighting(nf, isRaid(nightDay) ? nf : 0); seasonVisual(Math.min(1, dt * 0.6 + 0.0005));
    if (wave.type === 'storm' && nf > 0.4 && !exActive) {                      // 폭풍우: 번개가 번쩍이고 조금 뒤에 천둥이 친다
      stormT -= dt; if (stormT <= 0) { stormT = 3.5 + Math.random() * 7; lightning = 1; thunderIn = 0.5 + Math.random() * 0.8; }
      if (thunderIn > 0 && (thunderIn -= dt) <= 0) Snd.play('thunder');
    }
    if (exActive) {                                                                  // 원정 지역: 밤에도 달빛이 있어 상자와 적을 찾을 수 있다
      ambient.intensity += 0.45 * nf; sun.intensity += 0.3 * nf; scene.fog.near *= 2.4; scene.fog.far *= 2.0;
      for (const b of exBeams) { const d = Math.hypot(b.parent.position.x - player.position.x, b.parent.position.z - player.position.z); b.material.opacity = (0.1 + 0.2 * nf) * Math.min(1, d / 9); }       // 가까이 가면 기둥이 옅어진다
    }
    if (lightning > 0) { lightning = Math.max(0, lightning - dt * 3.2); const f = lightning * (0.6 + 0.4 * Math.sin(t * 60)); ambient.intensity += f * 1.4; sun.intensity += f * 0.9; scene.fog.color.lerp(C(0xcfd8ff), f * 0.5); scene.background.copy(scene.fog.color); }
    weatherStep(dt, night, hour); updateMark(t); updateStandard(t); lifeTick(t, dt);
    fogNight = night && wave.type === 'fog'; fogBoost += ((fogNight ? 1 : 0) - fogBoost) * Math.min(1, dt * 0.8);
    scene.fog.near *= 1 - 0.55 * fogBoost; scene.fog.far *= 1 - 0.45 * fogBoost;      // 안개의 밤: 시야가 크게 줄어든다
    if (bird) { scene.fog.near *= 4; scene.fog.far *= 4; ambient.intensity += 0.2 * nf; }       // 버드아이 뷰에서는 안개가 멀리 밀려나고 밤에도 마을이 보인다
    { const dF = camera.position.distanceTo(lookAt); scene.fog.near += dF; scene.fog.far += dF; }     // 안개는 카메라가 아니라 보는 곳(주인공) 기준: 멀리 물러나도 어두워지지 않는다
    { const g = Math.max(0, Math.min(1, (nf - 0.2) / 0.45)), fl = 0.94 + 0.06 * Math.sin(t * 9); windowGlow.color.setRGB(0.16 + 0.84 * g * fl, 0.16 + 0.62 * g * fl, 0.2 + 0.2 * g); lampGlow.color.copy(windowGlow.color); lampLevel = g * fl; updateGateLights(t); }      // 창문·가로등은 밤에 켜진다                      // 붉은 달의 밤에는 화면 전체가 붉게 물든다
    torch.intensity = nf * (exActive ? 3.4 : 2.4); torch.distance = exActive ? 34 : 18;   // 횃불: 밤에 켜지고 낮에 꺼짐 (원정 지역에서는 더 넓게)
    const hh = Math.floor(hour), mm = Math.floor(gameMin % 60);
    clockEl.textContent = `Day ${Math.floor(gameMin / 1440) + 1}${CFG.SEASONS_ON ? ' · ' + season().name : ''} - ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}${chapterCleared ? ' · ∞ Endless' : ''}${resting ? ' · 💤' : ''}${ngLevel ? ' · NG+' + ngLevel : ''}`;

    const dayNo = Math.floor(gameMin / 1440) + 1;
    nowHour = hour;
    if (exActive && !exEnding && (exActive.night ? (hour >= CFG.EXP_NIGHT_FORCE && hour < 12) : hour >= CFG.EXP_FORCE)) endExpedition(true);       // 해 지기 전에 자동 귀환
    updateRaidUi(hour, dayNo);
    roamerTick(dt);
    const waveDay = hour < 5 ? dayNo - 1 : dayNo;      // 자정이 지나도 같은 밤의 웨이브로 취급
    if (!dead && hour >= 18 && lastWarnDay !== dayNo) { lastWarnDay = dayNo; 
      if (dayNo === CFG.BOSS_DAY && !chapterCleared) { showWarning('WARNING: A massive threat approaches!'); bossShakeT = 3; }
      else if (isRaid(dayNo)) showWarning(`Night ${dayNo} - Blood Moon raid: ${realmDef(realmOfNight(dayNo)).short}` + (dayNo === CFG.BOSS_DAY - 1 && !chapterCleared ? ' (An even greater threat comes tomorrow night)' : ''));
      else showWarning(`Night ${dayNo} - A quiet night. Beasts prowl nearby`);
    }
    if (bossShakeT > 0) { bossShakeT -= dt; shake = Math.max(shake, 0.55); }       // 보스 경고: 강한 화면 흔들림
    if (!dead && hour >= 16 && hour < 18 && lastGuardDay !== dayNo && !exActive) {            // 해 지기 전 점검: 문보다 병사가 적으면 알려 준다
      lastGuardDay = dayNo;
      const guards = npcs.filter(n => n.role === 'melee').length, gates = gateWaypoints.length;
      if (gates > guards) toast(`Only ${guards} soldier${guards === 1 ? '' : 's'} for ${gates} gates - some entrances will be unguarded tonight`);
    }
    if (!dead && hour >= CFG.RESPAWN_HOUR && hour < 18 && lastRespawnDay !== dayNo) { lastRespawnDay = dayNo; respawnResources(); morningTown(); feedCitizens(); checkDepartures(); marketTrade(); upgradeHouses(); upgradeBuildings(); upgradeGates(); caravanMorning(dayNo); assignForeman(); campIncome(); holdsMorning(); checkStoryAll(); if (dayNo > 1) giveXp(20 + 5 * dayNo); endlessMilestone(dayNo); if (dayNo > 1 && wave.type === 'storm') unlockAch('storm'); if (dayNo > 1 && wave.type === 'hunt') unlockAch('hunt'); seasonTick(dayNo); fishingTick(dayNo); rollSickness(dayNo); updateProsperity(); if (dayNo > 1) { if (isRaid(dayNo + 1)) setTimeout(() => showWarning(`Warning: a raid comes tomorrow night - ${forecast(dayNo + 1)}`), 3000); showReport(dayNo); if (dayNo >= 2) storyIntro(); rollEvent(dayNo); merchantVisit(dayNo); } else report = freshReport(); if (hp < pMaxHp()) { healPlayer(pMaxHp()); toast('Morning has come. Your health is fully restored'); } saveCheckpoint(`Day ${dayNo} morning`); }
    updateEnemies(dt, night, Math.max(1, waveDay));
    const danger = enemies.some(e => !e.userData.sinking && (e.userData.boss || Math.hypot(e.position.x, e.position.z) < 34));
    peaceT = danger ? 0 : peaceT + dt; peaceful = peaceT > 2.5;
    if (peaceful && night && !exActive && !dead) {                                   // 병영·사격장 곁에서 병사와 함께 훈련하면 경험치를 얻는다
      const camp = builtBuildings('barracks').concat(builtBuildings('range')).find(b => Math.hypot(b.position.x - player.position.x, b.position.z - player.position.z) < b.userData.radius + 5);
      if (camp && (sparT += dt) >= 6) { sparT = 0; giveXp(5 + stage * 2); floatText('Sparring: +XP', player.position.x, 3.0, player.position.z); }
    }
    nightActivities(dt, hour, night);
    updateNpcs(dt, hour, t);
    updateFx(dt);
    updateArrows(dt);
    updateRocks(dt);
    updateShocks(dt);
    updatePopUi(); rallyT = Math.max(0, rallyT - dt);
    if (cardNpc && (cardT -= dt) <= 0) { cardT = 0.4; renderCard(); }
    if ((propCd -= dt) <= 0) { propCd = 0.5; updateProsperity(); }
    updateRegen(dt);
    replenishTick(dt);
    siteRegrowTick(dt);
    updateTowers(dt);
    updateFood(dt);
    updateDash(dt);
    updateFloaters(dt); updateSmith(dt, t); autoPlanTick(dt); caravanTick(dt); tickDelayed(dt);
    Snd.setMood(nf, danger && night, enemies.some(e => e.userData.boss));
    { const boss = enemies.some(e => e.userData.boss && !e.userData.sinking), battle = exActive ? !!(exCamp && !exCamp.broken && !exActive.prep && !exActive.training) : danger && night;       // raid music: night raids, sieges and camp assaults, bosses
      Snd.setScene(titleMode ? 'title' : battle || boss ? 'raid' : hour >= 19 || hour < 6 ? 'night' : 'day'); }
    for (const bp of blueprints) bp.material.opacity = 0.35 + 0.15 * Math.sin(t * 4);
    animateFire(t);
    atkCd -= dt;
    if (atkT > 0) {
      atkT -= dt;
      playerRig.root.position.z = Math.sin((1 - Math.max(atkT, 0) / SLASH_LIFE) * Math.PI) * 0.25;   // 베는 순간 앞으로 살짝 踏み込む
      if (atkT <= 0) playerRig.root.position.z = 0;
    }
    { const sm = dead ? null : nearestSmith(); smithBtnEl.style.display = sm ? '' : 'none'; if (!sm && smithOpenFor) closeSmith(); hallBtnEl.style.display = !dead && Math.hypot(player.position.x, player.position.z) < 14 ? '' : 'none'; }

    // 입력 합산 (조이스틱 or WASD)
    let ix = joy.x, iy = joy.y;
    const kx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    const ky = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
    if (dead) { ix = iy = 0; }
    else if (kx || ky) { const l = Math.hypot(kx, ky); ix = kx / l; iy = ky / l; }
    dashBonusT -= dt; atkLock -= dt; const locked = atkLock > 0 && dashT <= 0;
    if (locked) { ix = iy = 0; }                                       // 공격 모션 중에는 움직이지 않는다
    const mag = Math.min(1, Math.hypot(ix, iy));

    if (dashT > 0) {                       // 대시 중: 입력 이동 대신 바라보는 방향으로 질주
      const sd = Math.min(dt, dashT);
      player.position.x += dashDX * (dashDist() / CFG.DASH_TIME) * sd;
      player.position.z += dashDZ * (dashDist() / CFG.DASH_TIME) * sd;
      dashT -= dt;
    } else if (mag > 0.08) {
      // 현재 카메라가 바라보는 방향(수평) 기준으로 전진/우측 벡터 계산
      const vy = viewYaw(), fwdX = -Math.sin(vy), fwdZ = -Math.cos(vy);                  // 입력은 화면 기준 (앞모습 보기에서는 화면 위쪽 = 카메라에서 멀어지는 쪽)
      const rightX = Math.cos(vy), rightZ = -Math.sin(vy);
      let mx = rightX * ix + fwdX * iy, mz = rightZ * ix + fwdZ * iy;
      const ml = Math.hypot(mx, mz); mx /= ml; mz /= ml;

      const ts = terrSpd(player.position.x, player.position.z);
      const bk = blocking ? 0.45 : 1;                                       // 막는 중에는 느리게
      player.position.x += mx * SPEED * spdMul() * ts * mag * bk * dt;
      player.position.z += mz * SPEED * spdMul() * ts * mag * bk * dt;

      lastMX = mx; lastMZ = mz; lastMT = performance.now();
      { const fx = Math.sin(facing), fz = Math.cos(facing), f = mx * fx + mz * fz, sd = mx * fz - mz * fx;       // 바라보는 방향 기준 앞/뒤/옆걸음
        moveDir = f > 0.5 ? 'f' : f < -0.5 ? 'b' : sd > 0 ? 'p' : 'n'; }
    }
    if (!(mag > 0.08)) moveDir = 'f';
    if (bird) {                                                          // 지도 보기: 화면을 돌려도 영웅은 따라 돌지 않고, 걷는 방향을 본다
      moveDir = 'f';
      if (mag > 0.08 && dashT <= 0) { let diff = Math.atan2(lastMX, lastMZ) - facing; diff = Math.atan2(Math.sin(diff), Math.cos(diff)); facing += diff * Math.min(1, dt * 14); player.rotation.y = facing; }
    } else if (!gathering) {                                                    // 몸은 화면(카메라)이 향한 쪽만 본다: 화면을 터치/마우스로 돌릴 때만 회전하고, 이동은 옆걸음·뒤로걷기로 한다
      let diff = yaw + Math.PI - facing; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      facing += diff * Math.min(1, dt * 18); player.rotation.y = facing;
    }
    { const wantB = !!(keys.ShiftLeft || keys.ShiftRight || blockBtn) && !dead && dashT <= 0 && !gathering && !uiPause; if (wantB !== blocking) { blocking = wantB; playerAnim.guard(blocking); } }
    playerRig.combat = !!exActive || enemyWithin(player.position.x, player.position.z, 26);        // 적이 가깝거나 원정 중이면 전투 자세 이동
    playerAnim.moveDir = dashT > 0 || gathering ? 'f' : moveDir;
    playerRig.tool = gathering && gathering.target.userData.type === 'wood' ? 'axe' : 'pick';
    playerAnim.base(gathering ? 'gather' : dashT > 0 ? 'run' : mag > 0.08 ? (mag > 0.6 ? 'run' : 'walk') : 'idle', SPEED * mag);   // Idle / Walk / Run / Gather CrossFade
    playerAnim.update(dt);

    updateGather(dt, dashT > 0 || mag > 0.08);

    // 충돌 처리: 겹치면 바깥으로 밀어냄
    const airborne = playerRig.seated && (playerRig.hopT > 0 || (playerRig.hopT = 0, false)), landT = playerRig.seated ? (playerRig.landT = airborne ? 0.35 : Math.max(0, (playerRig.landT || 0) - dt)) : 0;      // a rider's leap carries the horse over wooden fences and stone walls (not the tall fort walls)
    for (const o of obstacles) {
      const ud0 = o.userData; if (ud0.type === 'fence' && !ud0.tall && airborne) continue;
      const dx = player.position.x - o.position.x, dz = player.position.z - o.position.z;
      const min = o.userData.radius + PLAYER_R, d = Math.hypot(dx, dz);
      if (ud0.type === 'fence' && !ud0.tall && landT > 0 && d < min) { const fx = Math.sin(facing), fz = Math.cos(facing), f = dx * fx + dz * fz; if (f < 0.4 * min) { player.position.x = o.position.x + fx * min; player.position.z = o.position.z + fz * min; continue; } }       // landed inside the wall line: step out on the far side
      if (d < min && d > 1e-4) { player.position.x = o.position.x + dx / d * min; player.position.z = o.position.z + dz / d * min; }
    }
    if (exActive) {
      for (const o of exObjs) {
        const dx = player.position.x - o.position.x, dz = player.position.z - o.position.z, min = o.userData.radius + PLAYER_R, d = Math.hypot(dx, dz);
        if (d < min && d > 1e-4) { player.position.x = o.position.x + dx / d * min; player.position.z = o.position.z + dz / d * min; }
      }
      const dx = player.position.x - EXC.x, dz = player.position.z - EXC.z, dd = Math.hypot(dx, dz);
      if (dd > exR - 5) { player.position.x = EXC.x + dx / dd * (exR - 5); player.position.z = EXC.z + dz / dd * (exR - 5); }
    } else {
      player.position.x = Math.max(-MAP, Math.min(MAP, player.position.x));
      player.position.z = Math.max(-MAP, Math.min(MAP, player.position.z));
    }

    // 지형 높이 적용: 주인공/주민은 바닥 높이를 그대로, 적은 (몸 높이 + 지형 변화량)만큼 올린다. 나무/바위는 처음 한 번만 맞춘다
    if (!exActive) {
      const dn = dayNow();
      if (dn !== riverDay) {                                                // 하루가 바뀌면 강의 상태(범람/결빙)를 다시 정한다
        riverDay = dn; const s = seasonOfDay(dn), firstSpring = s.id === 'spring' && dn > 1 && (dn - 1) % CFG.SEASON_DAYS === 0, prev = riverMode;
        riverMode = s.id === 'winter' ? 'ice' : firstSpring ? 'flood' : 'normal';
        if (waterMesh) waterMesh.position.y = riverMode === 'flood' ? 0.32 : 0;
        waterMat.opacity = riverMode === 'ice' ? 1 : 0.82;
        if (riverMode !== prev && dn > 1) toast(riverMode === 'flood' ? 'Spring flood: the river runs high and fast - crossing is slow' : riverMode === 'ice' ? 'The river has frozen - raiders can cross it anywhere' : prev === 'ice' ? 'The ice has thawed' : 'The flood has gone down');
      }
      if (!dead) { if (player.userData.lastX !== undefined && Math.hypot(player.position.x - player.userData.lastX, player.position.z - player.userData.lastZ) > 0.02) stepRoad(player.position.x, player.position.z, dt); player.userData.lastX = player.position.x; player.userData.lastZ = player.position.z; }
      for (const n of npcs) if (!n.escort && !n.down) stepRoad(n.position.x, n.position.z, dt * 0.5);
      player.position.y = actorH(player.position.x, player.position.z);
      for (const n of npcs) n.position.y = actorH(n.position.x, n.position.z);
      for (const e of enemies) { const u = e.userData; if (u.sinking || u.ex) continue; const nh = actorH(e.position.x, e.position.z); e.position.y += nh - (u.gy || 0); u.gy = nh; }
    } else player.position.y = 0;
    for (const o of obstacles) { const ud = o.userData; if (!ud.gset && (ud.type === 'wood' || ud.type === 'stone')) { ud.gset = true; o.position.y = terrH(o.position.x, o.position.z); } }

    // 카메라 Lerp 추적
    const k = 1 - Math.exp(-6 * dt);
    if (titleMode) {                                                       // 시작 화면: 성 마을 둘레를 도는 카메라, 시간은 해질녘에 고정
      titleAng += rawDt * 0.06; invincibleT = 1e9; gameMin = 3 * 1440 + 17 * 60 + 40;
      for (const e of enemies.slice()) removeEnemy(e);
      camera.position.set(Math.cos(titleAng) * 50, 21 + Math.sin(titleAng * 0.7) * 2.5, Math.sin(titleAng) * 50); lookAt.set(0, 3.5, 0);
    } else {
      camera.position.lerp(goalPos(camGoal), k);
      lookAt.lerp(new THREE.Vector3(camFocus().x, bird ? 0 : LOOK_H + player.position.y, camFocus().z), k);
    }
    { const gy = terrH(camera.position.x, camera.position.z) + 1.3; if (camera.position.y < gy) camera.position.y = gy; }
    camera.lookAt(lookAt);
    { // 활: 화살이 날아갈 쪽에 작은 조준 십자선 (적이 그 선 위에 있으면 붉게)
      const xh = xhairEl;
      if (weaponMode === 'bow' && !dead && !bird && !camFront && !uiPause) {
        camera.updateMatrixWorld(); xhV.set(player.position.x + Math.sin(facing) * 12, player.position.y + 1.1, player.position.z + Math.cos(facing) * 12).project(camera);
        if (xhV.z < 1 && Math.abs(xhV.x) < 1.2 && Math.abs(xhV.y) < 1.2) {
          xh.style.display = 'block'; xh.style.transform = `translate(${((xhV.x * 0.5 + 0.5) * canvas.clientWidth).toFixed(1)}px, ${((-xhV.y * 0.5 + 0.5) * canvas.clientHeight).toFixed(1)}px)`;
          let lock = false; const fx = Math.sin(facing), fz = Math.cos(facing);
          for (const e of enemies) { if (e.userData.sinking) continue; const dx = e.position.x - player.position.x, dz = e.position.z - player.position.z, d = Math.hypot(dx, dz); if (d < 26 && d > 1 && (dx * fx + dz * fz) / d > 0.985) { lock = true; break; } }
          if (lock !== xhLock) { xhLock = lock; xh.classList.toggle('lock', lock); }
        } else xh.style.display = 'none';
      } else if (xh.style.display !== 'none') xh.style.display = 'none';
    }

    // 그림자 범위가 플레이어를 따라가게
    sun.target.position.copy(player.position);
    sun.position.set(player.position.x - 20, 16, player.position.z - 12);

    // 카메라 흔들림 (렌더 직전에만 적용)
    let off = null;
    if (shake > 0) {
      off = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(shake);
      camera.position.add(off);
      shake = Math.max(0, shake - dt * 1.5);
    }
    renderer.render(scene, camera); bootFrames++;
    if (off) camera.position.sub(off);
  }
  applyPlayerGear(); updateHud();

  // ---------- 8단계: 자동 저장 / 설정 / 팁 ----------
  const SAVE_KEY = 'nf_save_v1', DEBUG = /[?&]debug/.test(location.search);
  let saveReady = false, uiPause = false;
  const tut = { done: false, step: 0, hints: {} };
  function saveGame() {                                   // 매일 아침과 원정 귀환 때: 마을 상태만 저장한다 (원정 중에는 저장하지 않는다)
    if (!saveReady || dead || exActive || exEnding) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, ts: Date.now(), day: Math.floor(gameMin / 1440) + 1, snap: makeSnapshot(), tut, diff, ng: ngLevel })); } catch (e) {}
  }
  // 앱을 나가거나 다른 앱으로 전환할 때도 저장한다 (적이 마을을 습격 중이면 건너뛴다 - 그때 불러오면 전투 중간이 끊기기 때문)
  const calmNow = () => !eventOpen && !enemies.some(e => !e.userData.sinking && !e.userData.prowl && !e.userData.ex);
  const autoSave = () => { if (calmNow()) saveGame(); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) autoSave(); });
  addEventListener('pagehide', autoSave);
  function readSave() {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      return d && d.v === 1 && d.snap && d.snap.res && Array.isArray(d.snap.npcs) ? d : null;
    } catch (e) { return null; }
  }
  function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }
  function loadSave(d) {
    applySnapshot(d.snap);
    Object.assign(tut, { done: false, step: 0, hints: {} }, d.tut || {}); diff = CFG.DIFFS[d.diff] ? d.diff : 'normal'; ngLevel = d.ng || 0;
    checkpoints.length = 0; saveCheckpoint('Loaded save');
    toast(`Continuing from Day ${d.day}`);
  }

  // 설정 (볼륨 · 글자 크기 · 그래픽)
  const setEl = document.getElementById('setPanel'), settings = { text: 'm', gfx: 'hi', haptic: true, hand: 'r', bsz: 'm', plan: 'balanced' };
  try { Object.assign(settings, JSON.parse(localStorage.getItem('nf_settings') || '{}')); } catch (e) {}
  function applySettings() {
    document.documentElement.dataset.ts = settings.text; document.documentElement.dataset.hand = settings.hand; document.documentElement.dataset.bsz = settings.bsz;
    const min = settings.gfx === 'min', lo = settings.gfx === 'lo' || min;
    renderer.setPixelRatio(min ? 0.7 : lo ? 1 : Math.min(devicePixelRatio, 2));
    camera.far = min ? 95 : 200; camera.updateProjectionMatrix(); for (const d of decorMeshes) d.visible = !min; wxLines.material.visible = !min; renderer.setSize(innerWidth, innerHeight, false);
    renderer.shadowMap.enabled = !lo; sun.castShadow = !lo;
    scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.needsUpdate = true); });
  }
  // 느린 기기 자동 대응: 터치 기기에서 처음 몇 초의 프레임이 낮으면 그래픽을 '낮음'으로 바꾸고 알려 준다 (한 번만, 직접 고른 설정은 건드리지 않는다)
  const fpsLog = [], fpsLo = [];
  setInterval(() => {
    if (settings.gfx === 'lo' && !settings.auto2 && saveReady && !uiPause && !eventOpen && !document.hidden && window.__nfFps) {          // 낮음에서도 느리면 한 단계 더: 가장 낮음
      fpsLo.push(window.__nfFps); if (fpsLo.length > 10) fpsLo.shift();
      if (fpsLo.length === 10 && fpsLo.reduce((a, b) => a + b, 0) / 10 < 18) { settings.gfx = 'min'; settings.auto2 = true; saveSettings(); applySettings(); toast('Graphics: Lowest (Settings)'); }
    }
    if (settings.auto || settings.gfx === 'lo' || settings.gfx === 'min' || !saveReady || uiPause || eventOpen || document.hidden || !window.__nfFps) return;
    fpsLog.push(window.__nfFps); if (fpsLog.length > 8) fpsLog.shift();
    if (fpsLog.length === 8 && (/[?&]autoq/.test(location.search) || matchMedia('(pointer: coarse)').matches) && fpsLog.reduce((a, b) => a + b, 0) / 8 < 26) {
      settings.gfx = 'lo'; settings.auto = true; saveSettings(); applySettings(); toast('Graphics: Low (Settings)');
    }
  }, 1000);
  function saveSettings() { try { localStorage.setItem('nf_settings', JSON.stringify(settings)); } catch (e) {} }
  function openSettings() {
    document.getElementById('setMusic').value = Math.round(Snd.getVol('music') * 100);
    document.getElementById('setSfx').value = Math.round(Snd.getVol('sfx') * 100);
    { const sd = document.getElementById('setDiff'); if (!sd.options.length) Object.entries(CFG.DIFFS).forEach(([id, d]) => sd.add(new Option(d.label, id))); sd.value = diff; }
    document.getElementById('setHand').value = settings.hand; document.getElementById('setBsz').value = settings.bsz;
    document.getElementById('setHaptic').value = settings.haptic === false ? 'off' : 'on';
    document.getElementById('setText').value = settings.text; document.getElementById('setGfx').value = settings.gfx;
    const d = readSave(); document.getElementById('setSaveInfo').textContent = d ? `Saved: Day ${d.day} (auto-saves every morning)` : 'No save yet - the game auto-saves every morning';
    uiPause = true; setEl.style.display = 'flex';
  }
  function closeSettings() { uiPause = false; setEl.style.display = 'none'; }
  document.getElementById('setBtn').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); Snd.init(); setEl.style.display === 'flex' ? closeSettings() : openSettings(); });
  document.getElementById('setClose').addEventListener('click', closeSettings);
  document.getElementById('setMusic').addEventListener('input', e => Snd.setVol('music', e.target.value / 100));
  document.getElementById('setSfx').addEventListener('input', e => Snd.setVol('sfx', e.target.value / 100));
  document.getElementById('setText').addEventListener('change', e => { settings.text = e.target.value; saveSettings(); applySettings(); });
  document.getElementById('setDiff').addEventListener('change', e => { diff = e.target.value; try { localStorage.setItem('nf_diff', diff); } catch (x) {} toast(`Difficulty: ${CFG.DIFFS[diff].label}`); saveGame(); });
  document.getElementById('setHand').addEventListener('change', e => { settings.hand = e.target.value; saveSettings(); applySettings(); });
  document.getElementById('setBsz').addEventListener('change', e => { settings.bsz = e.target.value; saveSettings(); applySettings(); });
  document.getElementById('setHaptic').addEventListener('change', e => { settings.haptic = e.target.value === 'on'; saveSettings(); buzz(60); });
  document.getElementById('setGfx').addEventListener('change', e => { settings.gfx = e.target.value; settings.auto = true; saveSettings(); applySettings(); });
  document.getElementById('setTips').addEventListener('click', () => { Object.assign(tut, { done: false, step: 0, hints: {} }); closeSettings(); coachSeen = false; toast('Tips restarted'); });
  document.getElementById('setDel').addEventListener('click', e => {
    if (e.target.dataset.sure !== '1') { e.target.dataset.sure = '1'; e.target.textContent = 'Tap again to confirm'; return; }
    clearSave(); e.target.dataset.sure = ''; e.target.textContent = 'Delete save'; document.getElementById('setSaveInfo').textContent = 'Save deleted'; toast('Save deleted');
  });
  applySettings();

  // 팁: 첫 며칠 동안 지금 할 일을 한 줄로 알려 주고, 처음 만나는 시스템은 한 번만 안내한다
  const tutEl = document.getElementById('tutor'), tutTxt = document.getElementById('tutorTxt');
  const TUT = [
    { text: 'Gather wood for the fence', done: () => designTier > 0 || blueprints.length > 0 || obstacles.some(o => o.userData.type === 'fence') },
    { text: 'Survive the night near the campfire', done: () => gameMin >= 1440 + CFG.RESPAWN_HOUR * 60 },
    { text: 'Defeat raiders, then pick an upgrade', done: () => pl.lvl >= 2 && pl.pend === 0 },
    { text: 'Gather more to build the town', done: () => townStage > 0 },
    { text: 'Advance your Stage at the Town Hall (T)', done: () => stage >= 2 },
  ];
  // ---------- 첫 날 길잡이: 핵심 요소를 하나씩 강조하며 설명한다 (한 번만, 설정의 Replay tips로 다시 볼 수 있다) ----------
  const COACH = [
    { sel: '#joy', text: 'Drag to move. The red button attacks.' },
    { sel: '#actBtn', text: 'Next to a tree or rock, tap Gather.' },
    { sel: '#planBtn', text: 'The Village Plan builds for you. Tap to change what comes first.' },
    { sel: '#hudBar', text: 'Health, level, resources. Tap for stats.' },
    { sel: null, text: 'Raiders come at night. Stay near the fire. Good luck, Keeper!' },
  ];
  let coachStep = -1, coachSeen = false; try { coachSeen = !!localStorage.getItem('nf_coach'); } catch (e) {}
  const coachEl = document.createElement('div'); coachEl.id = 'coach'; coachEl.innerHTML = '<p id="coachTxt"></p><div class="tbtns"><button id="coachNext">Next</button><button id="coachSkip">Skip</button></div>'; document.body.appendChild(coachEl);
  function coachShow(i) {
    document.querySelectorAll('.coachHi').forEach(e => e.classList.remove('coachHi'));
    if (i >= COACH.length) { coachStep = -1; coachEl.style.display = 'none'; uiPause = false; coachSeen = true; try { localStorage.setItem('nf_coach', '1'); } catch (e) {} return; }
    coachStep = i; const c = COACH[i], el = c.sel && document.querySelector(c.sel);
    if (el && el.offsetWidth) el.classList.add('coachHi');
    document.getElementById('coachTxt').textContent = c.text; document.getElementById('coachNext').textContent = i === COACH.length - 1 ? 'Start' : 'Next';
    coachEl.style.display = 'block'; uiPause = true;
  }
  document.getElementById('coachNext').addEventListener('click', () => coachShow(coachStep + 1));
  document.getElementById('coachSkip').addEventListener('click', () => coachShow(COACH.length));
  setInterval(() => { if (!coachSeen && coachStep < 0 && saveReady && !eventOpen && !dead && !uiPause && playerClass && dayNow() <= 1 && !(/[?&]debug/.test(location.search) && !/[?&]coach/.test(location.search))) coachShow(0); }, 1500);
  function tutorStep() {
    if (exActive) { tutEl.style.display = 'none'; return; }
    if (!saveReady || dead || eventOpen || uiPause) return;
    if (!tut.done && tut.step < TUT.length && TUT[tut.step].done()) { tut.step++; toast('Good work!'); }
    if (tut.step >= TUT.length) tut.done = true;
    const show = !tut.done && !tut.off;
    tutEl.style.display = show ? 'flex' : 'none';
    if (show) tutTxt.textContent = TUT[tut.step].text;
    const hint = (k, msg) => { if (!tut.hints[k]) { tut.hints[k] = 1; toast(msg); } };
    if (smiths().length) hint('smith', 'Blacksmith ready: walk up and press C to craft gear');
    if (npcs.length && res.food < 1 && gameMin > 1440 * 1) hint('food', 'Citizens eat at dawn - build farms to keep food stocked');
    if (story.intro) hint('journal', 'New: Journal (J) - head out on expeditions for rare loot');
  }
  setInterval(tutorStep, 700);
  document.getElementById('tutorX').addEventListener('click', () => { tut.off = true; tutEl.style.display = 'none'; });

  // ---------- 11단계: 업적 (브라우저에 저장되어 새 게임을 해도 남는다) ----------
  const ACH = [
    { id: 'night1', name: 'First Dawn', desc: 'Survive the first night', test: () => dayNow() >= 2 },
    { id: 'week', name: 'A Whole Week', desc: 'Reach Day 7', test: () => dayNow() >= 7 },
    { id: 'boss', name: 'Behemoth Slayer', desc: 'Defeat the Behemoth', test: () => chapterCleared },
    { id: 'stage2', name: 'Wooden Town', desc: 'Reach Stage 2', test: () => stage >= 2 },
    { id: 'stage3', name: 'Stone Keep', desc: 'Reach Stage 3', test: () => stage >= 3 },
    { id: 'pop10', name: 'Busy Streets', desc: 'Have 10 villagers', test: () => npcs.length >= 10 },
    { id: 'smith', name: 'Hammer and Anvil', desc: 'Build a Blacksmith', test: () => smiths().length > 0 },
    { id: 'armed', name: 'Armed to the Teeth', desc: 'Have 3 soldiers wearing armor', test: () => npcs.filter(n => n.role !== 'citizen' && n.gear.armor !== 'armor_none').length >= 3 },
    { id: 'master', name: 'Master Craftsman', desc: 'Train a citizen to Master level', test: () => npcs.some(n => Object.values(n.xp || {}).some(v => v >= CFG.SKILL_XP[3])) },
    { id: 'lvl3', name: 'Grand Works', desc: 'Upgrade a workshop to level 3', test: () => CFG.LEVELED.some(k => builtBuildings(k).some(o => lvOf(o) >= 3)) },
    { id: 'rich', name: 'Full Granary', desc: 'Store 100 Food', test: () => res.food >= 100 },
    { id: 'prosper', name: 'Flourishing', desc: 'Reach Flourishing prosperity (80+)', test: () => prosScore >= 80 },
    { id: 'winter', name: 'Through the Cold', desc: 'Live through a whole winter', test: () => CFG.SEASONS_ON && dayNow() >= CFG.SEASON_DAYS * 4 + 1 },
    { id: 'merchant', name: 'Good Business', desc: 'Trade with a travelling merchant' },
    { id: 'clear', name: 'Site Cleared', desc: 'Clear an expedition site completely' },
    { id: 'won', name: 'Warlord Fallen', desc: 'Take the Iron Throne and win the campaign' },
    { id: 'escort', name: 'Never Alone', desc: 'Return from an expedition with an escort' },
    { id: 'camp1', name: 'Outpost', desc: 'Build a camp', test: () => Object.keys(story.camps).length >= 1 },
    { id: 'camp3', name: 'Supply Line', desc: 'Build 3 camps', test: () => Object.keys(story.camps).length >= 3 },
    { id: 'storm', name: 'Stormproof', desc: 'Survive a thunderstorm night' },
    { id: 'hunt', name: 'Pack Breaker', desc: 'Survive a wolf hunt night' },
    { id: 'nightmarket', name: 'Lantern Trade', desc: 'Buy something from the lantern merchant' },
    { id: 'tales', name: 'Storyteller', desc: 'Hear 5 fireside tales', test: () => Object.keys(story.tales || {}).length >= 5 },
    { id: 'ng1', name: 'Again, Stronger', desc: 'Begin a New Game+', test: () => ngLevel >= 1 },
    { id: 'hardwin', name: 'Hard Road', desc: 'Finish the story on Hard or Nightmare', test: () => story.finale && (diff === 'hard' || diff === 'nightmare') },
    { id: 'wide', name: 'Keeper of the Road', desc: 'Light the Wide Road (Chapter 5)', test: () => story.wide },
    { id: 'dusk', name: 'The Long Dawn', desc: 'End the Eclipse (Chapter 6)', test: () => story.dusk },
    { id: 'champ3', name: 'Champion Slayer', desc: 'Defeat 3 Champions in endless mode', test: () => (story.champs || 0) >= 3 },
    { id: 'champ10', name: 'Name Taker', desc: 'Defeat 10 Champions in endless mode', test: () => (story.champs || 0) >= 10 },
    { id: 'kills500', name: 'Five Hundred', desc: 'Defeat 500 enemies in one run', test: () => totalKills >= 500 },
    { id: 'day50', name: 'Half a Hundred', desc: 'Survive to Day 50', test: () => dayNow() >= 50 },
    { id: 'day15', name: 'Fifteen Days', desc: 'Survive to Day 15', test: () => dayNow() >= 15 },
    { id: 'day30', name: 'A Month of Nights', desc: 'Survive to Day 30', test: () => dayNow() >= 30 },
    { id: 'lvl5', name: 'Veteran', desc: 'Reach player level 5', test: () => pl.lvl >= 5 },
    { id: 'lvl10', name: 'Legend', desc: 'Reach player level 10', test: () => pl.lvl >= 10 },
    { id: 'beacon', name: 'Light in the Dark', desc: 'Light the Beacon', test: () => story.beacon },
    { id: 'dawn', name: 'Dawn Gate', desc: 'Open the Dawn Gate', test: () => story.dawn },
    { id: 'crown', name: 'Winter Crown', desc: 'Take the Winter Crown', test: () => story.crown },
    { id: 'echo', name: 'Voices of the Keepers', desc: 'Recover the Echo Stone', test: () => !!story.relics.barrow },
    { id: 'finale', name: 'The Last Keeper', desc: 'Defeat the Hollow King and swear the Keeper\'s Oath', test: () => story.finale },
  ];
  let achSave = {};
  try { achSave = JSON.parse(localStorage.getItem('nf_ach') || '{}') || {}; } catch (e) { achSave = {}; }
  const achBanner = document.createElement('div'); achBanner.id = 'achBanner'; document.body.appendChild(achBanner); let achTimer;
  function unlockAch(id) {
    const a = ACH.find(x => x.id === id);
    if (!a || achSave[id]) return;
    achSave[id] = Date.now(); try { localStorage.setItem('nf_ach', JSON.stringify(achSave)); } catch (e) {}
    achBanner.textContent = `🏆 ${a.name} - ${a.desc}`; achBanner.classList.add('show'); clearTimeout(achTimer); achTimer = setTimeout(() => achBanner.classList.remove('show'), 3800); Snd.play('chime');
  }
  function achStep() { if (!saveReady || dead) return; for (const a of ACH) if (a.test && !achSave[a.id]) { let ok = false; try { ok = !!a.test(); } catch (e) {} if (ok) unlockAch(a.id); } }
  setInterval(achStep, 1000);
  const achEl = document.getElementById('achPanel');
  function openAch() {
    const n = ACH.filter(a => achSave[a.id]).length;
    document.getElementById('achCount').textContent = `${n} / ${ACH.length} unlocked`;
    document.getElementById('achList').innerHTML = ACH.map(a => `<div class="ach ${achSave[a.id] ? 'got' : ''}"><span>${achSave[a.id] ? '🏆' : '🔒'}</span><div><b>${a.name}</b><small>${a.desc}</small></div></div>`).join('');
    achEl.style.display = 'flex';
  }
  { const rp = document.getElementById('repPanel'), rt = document.getElementById('repText');
    document.getElementById('setRep').addEventListener('click', () => { closeSettings(); uiPause = true; rt.value = balanceReport(); rp.style.display = 'flex'; });
    document.getElementById('repClose').addEventListener('click', () => { rp.style.display = 'none'; uiPause = false; });
    document.getElementById('repCopy').addEventListener('click', () => { rt.select(); try { navigator.clipboard.writeText(rt.value); toast('Report copied'); } catch (e) { document.execCommand && document.execCommand('copy'); toast('Report selected - copy it'); } }); }
  document.getElementById('setAch').addEventListener('click', () => { closeSettings(); uiPause = true; openAch(); });
  document.getElementById('achClose').addEventListener('click', () => { achEl.style.display = 'none'; uiPause = false; });

  // 시작 화면: 저장이 있으면 이어하기 / 새 게임 / (엔딩을 본 적이 있으면) 새 게임+
  const readCarry = () => { try { const c = JSON.parse(localStorage.getItem('nf_carry') || 'null'); return c && c.ng >= 1 && c.lvl >= 1 ? c : null; } catch (e) { return null; } };
  const startUiEls = () => [document.getElementById('game'), document.getElementById('startPanel')];
  function showStartUi() { for (const e of startUiEls()) if (e) e.style.visibility = ''; }              // canvas and title stay invisible under the loading cover until the finished town is drawn
  function hideBootCover() {                                                 // the loading cover (index.html) hides the half-built start scene; lift it after two drawn frames
    const c = document.getElementById('bootCover'); if (!c || c.dataset.done) return; c.dataset.done = 1;
    const f0 = bootFrames, t0 = performance.now();                           // lift only after the finished scene has really been drawn (shader compiling can make the first frames slow)
    const lift = () => { if (bootFrames < f0 + 4 && performance.now() - t0 < 7000) return requestAnimationFrame(lift); showStartUi(); c.classList.add('off'); setTimeout(() => c.remove(), 600); };
    requestAnimationFrame(lift);
  }
  setTimeout(hideBootCover, 8000);                                           // safety: never keep the cover up
  function bootGame() {
    const d = readSave(), carry = readCarry();
    let intent = null; try { intent = sessionStorage.getItem('nf_intent'); sessionStorage.removeItem('nf_intent'); } catch (e) { /* 저장소 사용 불가 */ }
    const begin = () => { uiPause = false; clearSave(); saveReady = true; setTimeout(openDifficultyChoice, 700); saveCheckpoint('Day 1 start'); };
    if (intent) {                                                          // 시작 화면에서 고른 항목을 새로 고친 깨끗한 세계에서 실행한다
      if (intent === 'continue' && d) { saveReady = true; loadSave(d); return; }
      if (intent === 'new') { ngLevel = 0; begin(); return; }
      if (intent === 'ng' && carry) { ngLevel = carry.ng; Object.assign(pl, { lvl: carry.lvl, xp: 0, pend: 0 }); pl.st = Object.assign(ST0(), carry.st || {}); updateLvlUi(); begin(); return; }
      if (/^dbg/.test(intent)) { const n = +intent.slice(3); ngLevel = 0; clearSave(); saveReady = true; if (n > 1) debugJump(n); else setTimeout(openDifficultyChoice, 700); saveCheckpoint(`Debug start: stage ${n}`); return; }
    }
    if (!DEBUG || intent === 'title' || /[?&]load/.test(location.search)) { showTitle(d, carry); return; }
    saveReady = true;
    if (DEBUG) { setClass('warrior'); choosePerk(1, 'forager'); } else setTimeout(openDifficultyChoice, 700);
    saveCheckpoint('Day 1 start');
  }
  function showTitle(d, carry) {                                           // 시작 화면: 뒤에는 완성된 5단계 성 마을이 천천히 돈다 (저장은 건드리지 않는다)
    const p = document.getElementById('startPanel'), $ = (id) => document.getElementById(id);
    $('startInfo').textContent = d ? `Saved game · Day ${d.day} · ${new Date(d.ts).toLocaleDateString()}` : 'Hold the night. Build the realm.';
    $('startContinue').style.display = d ? '' : 'none';
    const ngBtn = $('startNG'); ngBtn.style.display = carry ? '' : 'none'; if (carry) ngBtn.textContent = `New Game+ ${carry.ng} (keep Lv ${carry.lvl})`;
    for (const e of startUiEls()) if (e) e.style.visibility = 'hidden';
    document.body.classList.add('titlemode'); p.style.display = 'flex'; dispatchEvent(new Event('resize'));        // the title uses the whole screen (no ad strip)
    const go = (intent) => { try { sessionStorage.setItem('nf_intent', intent); } catch (e) { /* ignore */ } p.classList.add('out'); setTimeout(() => location.reload(), 380); };
    $('startContinue').addEventListener('click', () => go('continue'));
    $('startNew').addEventListener('click', () => go('new'));
    ngBtn.addEventListener('click', () => go('ng'));
    $('startDbg').addEventListener('click', () => go('dbg' + $('startStage').value));
    titleMode = true; debugJump(5); hideBootCover();       // built at once, before the first frame is drawn, so the stage-1 campfire view is never drawn at all (the render loop starts after this file)
    //            // the background town is built behind the loading cover; the cover lifts once it has been drawn
  }
  { const sl = document.getElementById('setLeader'); sl.value = String(window.NF_LEADER ? 1 : 0);                       // 지휘관 모델 바꾸기(시험): 저장해 두고 다시 불러온다
    sl.addEventListener('change', () => {
      try { localStorage.setItem('nf_leader', sl.value); } catch (e) { /* ignore */ }
      try { saveGame(); sessionStorage.setItem('nf_intent', 'continue'); } catch (e) { /* ignore */ }
      location.href = location.pathname + location.search.replace(/([?&])leader=[0-9]&?/, '$1').replace(/[?&]$/, '');
    }); }
  document.getElementById('setUnstick').addEventListener('click', () => {  // 설정 → 길이 막혔을 때: 주인공을 마을 큰길의 빈 곳으로 옮긴다
    if (dead || exActive) return toast('Not now');
    leaderDismount(); player.position.set(0, 0, CFG.HALL_RADIUS[stage - 1] + 6); toast('Moved to the town square');
  });
  document.getElementById('setMenu').addEventListener('click', () => {      // 설정 → 시작 화면으로 (아침마다 저장되며, 지금 저장도 시도한다)
    if (!confirm('Return to the title screen? Your progress is saved each morning.')) return;
    try { saveGame(); sessionStorage.setItem('nf_intent', 'title'); } catch (e) { /* ignore */ }
    location.reload();
  });
  { const A = document.getElementById('actions'), C = document.getElementById('ctxActions');       // the context buttons sit right beside however many columns the action buttons wrap into
    const placeCtx = () => { if (!A || !C) return; const r = A.getBoundingClientRect(), left = document.documentElement.dataset.hand === 'l'; if (!r.width) return;
      if (left) { C.style.left = Math.round(r.right + 8) + 'px'; C.style.right = ''; } else { C.style.right = Math.round(document.body.clientWidth - r.left + 8) + 'px'; C.style.left = ''; } };
    if (window.ResizeObserver && A) new ResizeObserver(placeCtx).observe(A); addEventListener('resize', placeCtx); setInterval(placeCtx, 700); placeCtx(); }
  updateStageUi(); updateTownBtn(); updateRaidUi(8, 1);
  bootGame();      // 처음 시작할 때 역할 선택 (저장이 있으면 이어하기 선택)
  if (!document.body.classList.contains('titlemode')) setTimeout(hideBootCover, 600);        // not the title screen (continue / new game / debug): show the game itself
  if (/[?&]debug/.test(location.search)) window.__nf = { procTex, get bandPost() { return bandPost; }, createFence, createWall, get mvSubs() { return mv.subs; }, showVictory, throneLine, fixTightBuildings, woundsMorning2: 0, toggleLeaderMount, leaderMountMul, leaderDismount, toggleMount, mountedCount, mountCap, applyMount, marshalMods, bannerFlagTick, cornerLampsSync, fixKeepOverlaps, findTownSpot, debugJump, setWeather: (k) => { wx.kind = k; wx.day = dayNow(); wx.lvl = 0.7; }, setHostOrder, warbandOrder, drilledTogether, setBanner, bannerOf, bannerBands, bannerMods, toggleBringBanner, setStage, builtBuildings, trainDrill, startTraining, trainSpawn, endTraining, tendWounded, callLevy, woundsMorning, addCourage, courageOf, courageMul, dismissLevy, recallGarrison, breachWall, catapultTick, createBuilding, siegeGear, raiseLadder, castleTick, ramTick, ramCrewPower, makeNpc, assignWarband, powerFor, set invincible(v) { invincibleT = v; }, get isDead() { return dead; }, pause(v) { uiPause = v; }, get playerAnim() { return playerAnim; }, attack, get facing() { return facing; }, get weaponMode() { return weaponMode; }, swapWeapon, get yaw() { return yaw; }, setClass, get order() { return order; }, get playerClass() { return playerClass; }, realmRelief, realmOfNight, realmHeld, realmCheck, holdsMorning, holdRisk, garrisonIt, holdOf, holdCount, get gameMin() { return gameMin; }, marchFood, homeOdds, homeThreat, homeGuard, resolveHomeNight, makeSnapshot, applySnapshot, get gathering() { return gathering; }, gather, get playerRig() { return playerRig; }, camTest: (d, p, front) => { camFront = front !== false; DIST = d; pitch = p; }, campRelief, hitEnemy, get exCamp() { return exCamp; }, EXC, requestReturn, story, openJournal, get stage() { return stage; }, get escortBands() { return escortBands; }, bandMax, openSmith, weaponDef, gearAtTier, soldierWeaponDef, playerGear, applyPlayerGear, openLevelPick, standardMods, standardRadius, pl, toggleMark, get markedFoe() { return markedFoe; }, homeCls, tripCls, setClassFor, cycleTripCls, startExpedition: typeof startExpedition === "function" ? startExpedition : null, endExpedition, warbandOrder, setWarbandOrder, needOf, powerOf, applyGear, openNpcCard, get playerAnim() { return playerAnim; }, spawnCaravan, get caravan() { return caravan; }, set caravanDay(v) { caravanDay = v; }, get yaw() { return yaw; }, set yaw(v) { yaw = v; }, enemyArrows, specialKind, sectorHit, get facing() { return facing; }, set facing(v) { facing = v; }, assignForeman, upgradeGates, gateWaypoints, hitEnemy, climbMul, stepRoad, roadAt, get riverMode() { return riverMode; }, terrSpd, terrH, spawnChampion, CFG, res, npcs, enemies, obstacles, playerGear, player, setMin: m => { gameMin = m; }, getMin: () => gameMin, debugSetup, spawnEnemy, setClass, toggleBird, toggleOrder, choosePerk, openPerk, perks, rally: () => rally(), get bird() { return bird; }, scene, blueprints, makeRock, designDefense, designTown, exObjs, story, startExpedition, endExpedition, checkStory, get exActive() { return exActive; }, EVENTS, openEvent, nightTypeOf, openNpcCard, checkDepartures, snap: () => makeSnapshot(), recordBest, endlessMilestone, dm, get diff() { return diff; }, set diff(v) { diff = v; }, get ngLevel() { return ngLevel; }, set ngLevel(v) { ngLevel = v; }, scaleHp, readCarry, nightExpWhy, fireTale, nextTale, nightMerchantMenu, get nmActive() { return nmActive; }, NIGHT_EVENTS, get peaceT() { return peaceT; }, wave, hitEnemyDbg: (e) => hitEnemy(e, 999, e.position.x - 1, e.position.z, false, null, true), toggleRest, canRest, get resting() { return resting; }, vetLv, powerOf, needOf, pl, giveXp, openLevelPick, isRaid, checkStoryAll, unlockAch, achSave, achStep, ACH, openEvent, nightTypeOf, setEscort: n => { escortN = n; }, buildCamp, campIncome, storyChain, campMeshes, upgradeBuildings, rollSickness, seasonTick, season, citizens, merchantVisit, nextPref, jobTitle, bLevel, skillLv, saveGame, readSave, loadSave, tut, TUT, tutorStep, get saveReady() { return saveReady; }, settings, restore: sn => applySnapshot(sn), feedCitizens, openSmith, get peaceful() { return peaceful; } };
  // ---------- Game controller (Xbox-style pad via the Gamepad API; Bluetooth pads work in the Android app) ----------
  // Left stick moves, right stick turns the camera, buttons fire the same key actions as the keyboard (synthetic key events), so every key binding works.
  //   A jump · B dash · X attack · Y swap weapon · RT attack · LT gather · RB ultimate · LB block (hold)
  //   L-stick click mount · R-stick click mark foe · D-pad up/down zoom · D-pad left orders · D-pad right smithy · Back map view
  //   Start: menu cursor on/off. In cursor mode the left stick moves a pointer, A clicks, right stick scrolls lists. It is on by itself on the title screen and in event windows.
  const pad = { on: false, cursor: false, cx: 0, cy: 0, prev: [], el: null, keyHeld: {} };
  const PAD_KEYS = { 0: 'Space', 1: 'KeyR', 2: 'KeyF', 3: 'KeyQ', 7: 'KeyF', 6: 'KeyG', 5: 'KeyE', 10: 'KeyM', 11: 'KeyY', 8: 'KeyB', 14: 'KeyO', 15: 'KeyC' };
  const padKey = (type, code) => dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true }));
  function padPointer(type, x, y, target) { const o = { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' || type === 'click' ? 0 : 1, pointerId: 77, pointerType: 'mouse', isPrimary: true }; target.dispatchEvent(type === 'click' ? new MouseEvent('click', o) : new PointerEvent(type, o)); }
  function padClick() {
    const x = pad.cx, y = pad.cy; if (pad.el) pad.el.style.visibility = 'hidden';
    const t = document.elementFromPoint(x, y); if (pad.el) pad.el.style.visibility = '';
    if (!t) return; padPointer('pointerdown', x, y, t); padPointer('pointerup', x, y, t); padPointer('click', x, y, t);
  }
  function padScroll(dy) {
    if (pad.el) pad.el.style.visibility = 'hidden'; let t = document.elementFromPoint(pad.cx, pad.cy); if (pad.el) pad.el.style.visibility = '';
    for (; t && t !== document.body; t = t.parentElement) { if (t.scrollHeight > t.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(t).overflowY)) { t.scrollTop += dy; return; } }
  }
  function padCursorOn(v) {
    pad.cursor = v; if (!pad.el) { pad.el = document.createElement('div'); pad.el.style.cssText = 'position:fixed;left:0;top:0;width:26px;height:26px;margin:-13px 0 0 -13px;border:3px solid #ffd27a;border-radius:50%;background:rgba(255,210,122,.25);z-index:99999;pointer-events:none;display:none'; document.body.appendChild(pad.el); }
    pad.el.style.display = v ? 'block' : 'none'; if (v) { pad.cx = pad.cx || innerWidth / 2; pad.cy = pad.cy || innerHeight / 2; }
    if (v) { joy.x = 0; joy.y = 0; keys.ShiftLeft = false; }
  }
  addEventListener('gamepadconnected', () => { pad.on = true; toast('Controller connected'); });
  addEventListener('gamepaddisconnected', () => { pad.on = !!(navigator.getGamepads && [...navigator.getGamepads()].some(Boolean)); if (!pad.on) { joy.x = 0; joy.y = 0; keys.ShiftLeft = false; padCursorOn(false); } });
  let padLast = performance.now();
  function padPoll() {
    requestAnimationFrame(padPoll);
    const now = performance.now(), dt = Math.min(0.05, (now - padLast) / 1000); padLast = now;
    const gps = navigator.getGamepads ? navigator.getGamepads() : []; let g = null; for (const x of gps) if (x && x.connected) { g = x; break; }
    if (!g) return; pad.on = true;
    const b = (i) => !!(g.buttons[i] && g.buttons[i].pressed), edge = (i) => b(i) && !pad.prev[i], dz = (v) => Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82;
    const lx = dz(g.axes[0] || 0), ly = dz(g.axes[1] || 0), rx = dz(g.axes[2] || 0), ry = dz(g.axes[3] || 0);
    const auto = titleMode || eventOpen || uiPause;                  // menus and event windows need the pointer
    if (edge(9)) padCursorOn(!pad.cursor); else if (auto && !pad.cursor) padCursorOn(true); else if (!auto && pad.cursor && pad.auto) padCursorOn(false);
    pad.auto = auto && !edge(9);
    if (pad.cursor) {
      pad.cx = Math.max(0, Math.min(innerWidth - 1, pad.cx + lx * 900 * dt)); pad.cy = Math.max(0, Math.min(innerHeight - 1, pad.cy + ly * 900 * dt));
      pad.el.style.left = pad.cx + 'px'; pad.el.style.top = pad.cy + 'px'; if (ry) padScroll(ry * 600 * dt);
      if (edge(0) || edge(2) || edge(7)) padClick();
      if (edge(1)) padKey('keydown', 'Escape');
    } else if (!dead) {
      if (lx || ly) { const m = Math.min(1, Math.hypot(lx, ly)); joy.x = lx / (Math.hypot(lx, ly) || 1) * m; joy.y = -ly / (Math.hypot(lx, ly) || 1) * m; pad.stick = true; } else if (pad.stick) { joy.x = 0; joy.y = 0; pad.stick = false; }
      if (rx || ry) { yaw -= rx * 2.6 * dt; pitch = Math.min(bird ? 1.5 : 1.2, Math.max(bird ? 0.12 : 0.1, pitch + ry * 1.5 * dt)); }
      if (b(12)) setDist(DIST * Math.exp(-1.2 * dt)); if (b(13)) setDist(DIST * Math.exp(1.2 * dt));
      keys.ShiftLeft = b(4);                                                     // LB held = block
      for (const k in PAD_KEYS) if (edge(+k) && !(+k === 9)) { padKey('keydown', PAD_KEYS[k]); setTimeout(() => padKey('keyup', PAD_KEYS[k]), 60); }
    }
    for (let i = 0; i < g.buttons.length; i++) pad.prev[i] = b(i);
  }
  requestAnimationFrame(padPoll);
  // ---------- Model field: a separate flat field to look at characters, mounts and your own .glb files with a free camera (Settings > Model field) ----------
  const mv = { scene: null, cam: null, subs: [], sel: 'all', weapon: 'sword', mounted: false, yaw: 0.5, pitch: 0.25, dist: 6, target: new THREE.Vector3(0, 1, 0), auto: false, action: 'idle', gl: [] };
  function mvInit() {
    if (mv.scene) return;
    const sc = mv.scene = new THREE.Scene(); sc.background = new THREE.Color(0x8fb0c8);
    sc.add(new THREE.HemisphereLight(0xdfe8f0, 0x55604a, 0.55)); const sun = new THREE.DirectionalLight(0xffffff, 0.75); sun.position.set(6, 12, 8); sc.add(sun);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: 0x6d7c5f, roughness: 1 })); ground.rotation.x = -Math.PI / 2; sc.add(ground);
    const grid = new THREE.GridHelper(40, 40, 0x3e4a3a, 0x58664f); grid.position.y = 0.005; sc.add(grid);
    const ruler = new THREE.Group(); for (let i = 1; i <= 4; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(i % 2 ? 0.25 : 0.4, 0.02, 0.02), new THREE.MeshBasicMaterial({ color: 0xc03030 })); m.position.set(-3.2, i * 0.5, 0); ruler.add(m); }
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.02, 2, 0.02), new THREE.MeshBasicMaterial({ color: 0xc03030 })); pole.position.set(-3.2, 1, 0); ruler.add(pole); sc.add(ruler);   // height ruler: a mark every 0.5 m
    mv.cam = new THREE.PerspectiveCamera(50, 1, 0.05, 300);
    const defs = [['Leader', 'player', 0xa4492f, 11], ['Soldier', 'melee', 0x3a6fe0, 21], ['Archer', 'archer', 0x3fae4a, 22], ['Citizen 1', 'citizen', 0xc05a3a, 30], ['Citizen 2', 'citizen', 0x3a7ac0, 31], ['Citizen 3', 'citizen', 0xd8a83a, 32], ['Citizen 4', 'citizen', 0x5aa05a, 33],
      ['Raider 1', 'enemy', 0, 101], ['Raider 2', 'enemy', 0, 102], ['Raider 3', 'enemy', 0, 103], ['Raider 4', 'enemy', 0, 104], ['Raider 5', 'enemy', 0, 105], ['Raider 6', 'enemy', 0, 106], ['Beast', 'beast', 0, 1]];
    for (const [label, kind, color, seed] of defs) {
      const enemy = kind === 'enemy' || kind === 'beast', rig = kind === 'beast' ? makeRig('beast', 0, { enemy: true }) : makeRig(kind, color, enemy ? { enemy: true, scale: 0.88, seed } : { seed });
      const g = new THREE.Group(); g.add(rig.root); sc.add(g); const s = { label, kind, g, rig, anim: new Anim(rig), horse: null, rider: null };
      if (kind === 'enemy') rig.combat = true;
      mv.subs.push(s);
    }
    const hg = new THREE.Group(), horse = horseModel(() => 0.3, { coat: 0x7a4a2a, blanket: 0x8a2a2a }); horse.rotation.y = -Math.PI / 2; hg.add(horse); hg.userData.legs = horse.userData.legs; hg.userData.hr = horse.userData.hr; sc.add(hg);
    mv.subs.push({ label: 'Horse', kind: 'horse', g: hg, rig: null, anim: null, horse: hg, rider: null, hmove: 0 });
    mv.hop = 0;
    mvWeapon(mv.weapon); mvLayout(); mvUi();
  }
  function mvWeapon(w) {                                    // the same gear setup the player and soldiers use
    mv.weapon = w;
    for (const s of mv.subs) { const r = s.rig; if (!r || s.kind === 'beast') continue;
      r.brawl = w === 'none'; r.main = w; r.style = w === 'sword' ? 'ss' : w === 'great' ? 'gs' : w === 'bow' ? 'bow' : '';
      r.setGear('sword', gearDef('iron_sword')); r.setGear('great', { ...gearDef('iron_great'), slot: 'sword', great: true }); r.setGear('bow', gearDef('bow_basic')); r.setGear('spear', { id: 'spear_iron_spear', slot: 'spear', tier: 1, color: gearDef('iron_spear').color });
      r.setShield && r.setShield(s.kind === 'player' || s.kind === 'melee' ? { tier: 1 } : null); r.hold(w); s.anim.base(s.anim.baseName || 'idle'); }       // shield as in the game: kept with sword, greatsword and spear (the rig hides it with the bow)
  }
  function mvMount(on) {
    mv.mounted = on;
    for (const s of mv.subs) { if (!s.rig || s.kind === 'beast') continue;
      if (on && !s.horse) { const h = new THREE.Group(), body = horseModel(() => 0.3, { coat: 0x7a4a2a, blanket: 0x8a2a2a }), rider = new THREE.Group(); body.rotation.y = -Math.PI / 2; h.add(body); const cur = s.rig.root; s.g.remove(cur); rider.add(cur); rider.position.y = 0.8; s.g.add(rider, h); s.rig.seated = true; s.rig.rider = rider; s.horse = h; s.rider = rider; h.userData.legs = body.userData.legs; h.userData.hr = body.userData.hr; }
      else if (!on && s.horse) { const cur = s.rig.root; s.rider.remove(cur); s.g.add(cur); s.g.remove(s.rider, s.horse); s.rig.seated = false; s.rig.rider = null; s.horse = s.rider = null; } }
    mvLayout();
  }
  function mvLayout() {                                      // all in a row, or only the chosen one in the middle
    const list = mv.subs.concat(mv.gl).filter(s => mv.sel === 'all' || s.label === mv.sel), gap = mv.mounted ? 3.0 : 2.0;
    for (const s of mv.subs.concat(mv.gl)) s.g.visible = list.includes(s);
    const cols = Math.min(list.length, 6), rows = Math.ceil(list.length / cols);                      // a block of up to 6 per row, the first row at the back
    list.forEach((s, i) => s.g.position.set(((i % cols) - (cols - 1) / 2) * gap, 0, (Math.floor(i / cols) - (rows - 1) / 2) * gap));
    mv.target.set(0, 1, 0); mv.dist = list.length === 1 ? 4 : Math.max(5, cols * gap * 0.75 + rows * 1.5);
  }
  function mvAct(a) {
    mv.action = a;
    for (const s of mv.subs) { const an = s.anim; if (!an) continue;
      if (a === 'die') an.die(); else { if (an.dead) an.revive();
        if (a === 'attack') an.once(mv.weapon === 'bow' ? 'attackBow' : mv.weapon === 'spear' ? 'attackSpear' : 'attackSword');
        else if (a === 'block') { an.guard(true); setTimeout(() => an.guard(false), 1500); } else if (a === 'jump') an.jump();
        else an.base(a, a === 'run' ? 5.5 : a === 'walk' ? 2.2 : 0); } }
    if (a === 'jump') mv.hop = 0.9;
    for (const s of mv.gl) if (s.mixer && s.clips[a]) { s.mixer.stopAllAction(); s.mixer.clipAction(s.clips[a]).play(); }
  }
  function mvLoadGlb(file) {
    const url = URL.createObjectURL(file);
    new THREE.GLTFLoader().load(url, gltf => {
      const g = new THREE.Group(); g.add(gltf.scene); mv.scene.add(g); const box = new THREE.Box3().setFromObject(gltf.scene), h = box.max.y - box.min.y; if (h > 0) { gltf.scene.scale.setScalar(1.8 / h); gltf.scene.position.y = -box.min.y * 1.8 / h; }
      const s = { label: file.name, g, rig: null, anim: null, mixer: gltf.animations.length ? new THREE.AnimationMixer(gltf.scene) : null, clips: {} };
      for (const c of gltf.animations) s.clips[c.name] = c; mv.gl.push(s); mv.sel = file.name; mvUi(); mvLayout();
      if (s.mixer && gltf.animations[0]) s.mixer.clipAction(gltf.animations[0]).play();
      toast(gltf.animations.length ? gltf.animations.length + ' animations: ' + gltf.animations.map(c => c.name).join(', ') : 'No animations in this file');
    }, undefined, () => toast('Could not read that file'));
  }
  let mvEl = null;
  function mvUi() {
    if (!mvEl) {
      const st = document.createElement('style'); st.textContent = 'body.mv>*:not(#game):not(#mvUi):not(#toast){display:none!important}#mvUi{position:fixed;inset:0;z-index:900;pointer-events:none;font:13px system-ui,sans-serif;color:#fff}#mvUi .mp{pointer-events:auto;position:absolute;top:8px;left:8px;max-width:min(46vw,300px);max-height:calc(100% - 16px);overflow:auto;background:rgba(20,22,30,.82);border-radius:10px;padding:8px}#mvUi .mp h4{margin:4px 0 4px;font-size:12px;opacity:.7}#mvUi button,#mvUi select,#mvUi label.fb{pointer-events:auto;font:inherit;margin:2px;padding:6px 9px;border-radius:7px;border:0;background:#3a4258;color:#fff}#mvUi button.on{background:#c77b2a}#mvUi .ex{position:absolute;top:8px;right:8px}#mvUi .vb{position:absolute;right:8px;bottom:8px;display:flex;flex-direction:column}#mvUi input[type=file]{display:none}';
      document.head.appendChild(st); mvEl = document.createElement('div'); mvEl.id = 'mvUi'; mvEl.style.display = 'none'; document.body.appendChild(mvEl);
      mvEl.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
        if (d.act) mvAct(d.act); else if (d.w) { mvWeapon(d.w); mvUi(); } else if (d.view) { const v = { front: [0, 0.15], side: [Math.PI / 2, 0.15], back: [Math.PI, 0.15], top: [0, 1.5] }[d.view]; mv.yaw = v[0]; mv.pitch = v[1]; }
        else if (d.k === 'mount') { mvMount(!mv.mounted); mvUi(); } else if (d.k === 'auto') { mv.auto = !mv.auto; mvUi(); } else if (d.k === 'exit') mvExit(); });
      mvEl.addEventListener('change', e => { if (e.target.id === 'mvSel') { mv.sel = e.target.value; mvLayout(); } else if (e.target.id === 'mvFile' && e.target.files[0]) mvLoadGlb(e.target.files[0]); });
    }
    const opt = ['all'].concat(mv.subs.map(s => s.label), mv.gl.map(s => s.label)), btn = (a, l, on) => `<button data-act="${a}"${on ? ' class="on"' : ''}>${l}</button>`, wb = (w, l) => `<button data-w="${w}"${mv.weapon === w ? ' class="on"' : ''}>${l}</button>`;
    mvEl.innerHTML = `<div class="mp"><h4>Model</h4><select id="mvSel">${opt.map(o => `<option value="${o}"${o === mv.sel ? ' selected' : ''}>${o === 'all' ? 'All (line-up)' : o}</option>`).join('')}</select>
      <h4>Action</h4>${['idle', 'walk', 'run', 'attack', 'block', 'jump', 'die'].map(a => btn(a, a, false)).join('')}
      <h4>Weapon</h4>${wb('sword', 'Sword')}${wb('great', 'Greatsword')}${wb('spear', 'Spear')}${wb('bow', 'Bow')}${wb('none', 'None')}
      <h4>Mount</h4><button data-k="mount"${mv.mounted ? ' class="on"' : ''}>Mounted</button><button data-k="auto"${mv.auto ? ' class="on"' : ''}>Auto-rotate</button>
      <h4>Your model</h4><label class="fb">Open .glb<input type="file" id="mvFile" accept=".glb,.gltf"></label>
      <h4>Leader model: ${window.NF_LEADER ? 'New' : 'Classic'} (change in Settings)</h4></div>
      <button class="ex" data-k="exit">Exit</button>
      <div class="vb"><button data-view="front">Front</button><button data-view="side">Side</button><button data-view="back">Back</button><button data-view="top">Top</button></div>`;
  }
  function mvEnter() { mvInit(); mvActive = true; uiPause = true; document.body.classList.add('mv'); mvEl.style.display = 'block'; setEl.style.display = 'none'; mvAct(mv.action === 'die' ? 'idle' : mv.action); }
  function mvExit() { mvActive = false; uiPause = false; document.body.classList.remove('mv'); mvEl.style.display = 'none'; }
  function mvStep(dt) {
    dt = Math.min(dt, 0.05); const t = clock.elapsedTime; if (mv.auto) mv.yaw += dt * 0.5;
    for (const s of mv.subs) { if (!s.g.visible) continue; if (s.anim) s.anim.update(dt);
      if (s.horse) { const air = s.rig ? s.rig.hopK || 0 : (mv.hop > 0 ? Math.sin(Math.PI * (1 - mv.hop / 0.9)) : 0), bob = horseStep(s.horse, dt, mv.action === 'run' ? 5.5 : mv.action === 'walk' ? 2.2 : 0, air); s.horse.position.y = air * 1.7; if (s.rider && !s.rig.fallen) s.rider.position.y = 0.8 + bob + s.horse.position.y; } }
    if (mv.hop > 0) mv.hop -= dt;
    for (const s of mv.gl) if (s.mixer && s.g.visible) s.mixer.update(dt);
    const c = mv.cam, cp = Math.cos(mv.pitch), d = mv.dist; c.aspect = innerWidth / innerHeight; c.updateProjectionMatrix();
    c.position.set(mv.target.x + Math.sin(mv.yaw) * cp * d, Math.max(0.1, mv.target.y + Math.sin(mv.pitch) * d), mv.target.z + Math.cos(mv.yaw) * cp * d); c.lookAt(mv.target);
    renderer.render(mv.scene, c);
  }
  { const cv = document.getElementById('game'), ptrs = new Map(); let last = 0;
    cv.addEventListener('pointerdown', e => { if (!mvActive) return; cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY, e.button]); last = 0; });
    cv.addEventListener('pointerup', e => { ptrs.delete(e.pointerId); }); cv.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); });
    cv.addEventListener('pointermove', e => { if (!mvActive || !ptrs.has(e.pointerId)) return; const p = ptrs.get(e.pointerId), dx = e.clientX - p[0], dy = e.clientY - p[1];
      if (ptrs.size === 2) { const o = [...ptrs.entries()].find(([k]) => k !== e.pointerId)[1], d0 = Math.hypot(p[0] - o[0], p[1] - o[1]), d1 = Math.hypot(e.clientX - o[0], e.clientY - o[1]);
        mv.dist = Math.max(1, Math.min(40, mv.dist * (d0 / Math.max(1, d1)))); const k = mv.dist * 0.0012; mv.target.y += dy * k * 0.5; mv.target.x -= dx * k * 0.5 * Math.cos(mv.yaw); mv.target.z += dx * k * 0.5 * Math.sin(mv.yaw); }
      else if (p[2] === 2 || p[2] === 1) { const k = mv.dist * 0.002; mv.target.y += dy * k; mv.target.x -= dx * k * Math.cos(mv.yaw); mv.target.z += dx * k * Math.sin(mv.yaw); }
      else { mv.yaw -= dx * 0.008; mv.pitch = Math.max(-0.2, Math.min(1.5, mv.pitch + dy * 0.008)); }
      p[0] = e.clientX; p[1] = e.clientY; });
    cv.addEventListener('wheel', e => { if (!mvActive) return; e.preventDefault(); mv.dist = Math.max(1, Math.min(40, mv.dist * (1 + Math.sign(e.deltaY) * 0.1))); }, { passive: false });
    cv.addEventListener('contextmenu', e => { if (mvActive) e.preventDefault(); }); }
  document.getElementById('setModelField').addEventListener('click', mvEnter);
  if (/[?&]modelfield/.test(location.search)) setTimeout(mvEnter, 1500);
  tick();
})();
