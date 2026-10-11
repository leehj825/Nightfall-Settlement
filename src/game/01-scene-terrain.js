(() => {
  const setAppH = () => document.documentElement.style.setProperty('--app-h', innerHeight + 'px');       // 모바일 주소창 때문에 100vh가 실제 화면보다 큰 문제 방지
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
  const MAP = 62;   // 맵 반경 (마을은 평지, 바깥은 언덕과 강)
  // ---------- 지형: 마을 주변은 평지, 바깥은 완만한 언덕. 동남쪽에는 강이 흐르고 다리가 하나 있다 (강은 걸어서 건널 수 있지만 느려진다) ----------
  const TERR = { flat: 32, blend: 12, hill: 1.7, riverR: 50, riverW: 3.1, bridgeA: -0.42 };
  const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const RIVER = []; for (let i = 0; i <= 40; i++) { const a = -1.25 + i * (1.75 / 40); RIVER.push([Math.cos(a) * (TERR.riverR + Math.sin(a * 6) * 2.2), Math.sin(a) * (TERR.riverR + Math.sin(a * 6) * 2.2)]); }
  const riverDist = (x, z) => { let m = 1e9; for (let i = 0; i < RIVER.length - 1; i++) { const [ax, az] = RIVER[i], [bx, bz] = RIVER[i + 1], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz))); m = Math.min(m, Math.hypot(x - ax - dx * t, z - az - dz * t)); } return m; };
  const BR = { x: Math.cos(TERR.bridgeA) * TERR.riverR, z: Math.sin(TERR.bridgeA) * TERR.riverR, ux: Math.cos(TERR.bridgeA), uz: Math.sin(TERR.bridgeA), len: 7, wid: 1.9, y: 0.32 };
  const onBridge = (x, z) => { const dx = x - BR.x, dz = z - BR.z, a = dx * BR.ux + dz * BR.uz, l = -dx * BR.uz + dz * BR.ux; return Math.abs(a) < BR.len && Math.abs(l) < BR.wid; };
  function terrH(x, z) {
    if (Math.abs(x) > MAP + 24 || Math.abs(z) > MAP + 24) return 0;
    const edge = sstep(TERR.flat, TERR.flat + TERR.blend, Math.max(Math.abs(x), Math.abs(z)));
    const n = 0.9 * Math.sin(x * 0.11 + 1.3) * Math.cos(z * 0.09) + 0.6 * Math.sin((x + z) * 0.07 + 2) + 0.35 * Math.sin(x * 0.23) * Math.sin(z * 0.21 + 1);       // 대략 -1.85 ~ 1.85
    let h = (n * 0.27 + 0.5) * TERR.hill * edge;
    const bd = Math.hypot(x - BR.x, z - BR.z); h += (BR.y - h) * (1 - sstep(5, 10, bd));                  // 다리 근처는 둑을 평평하게
    const rd = riverDist(x, z); return h + (-0.55 - h) * (1 - sstep(TERR.riverW - 0.6, TERR.riverW + 1.6, rd));
  }
  const actorH = (x, z) => onBridge(x, z) ? BR.y : terrH(x, z);
  let riverMode = 'normal', riverDay = -1, waterMesh = null;           // normal / flood (봄 첫날 범람: 더 넓고 느림) / ice (겨울: 얼어서 어디서나 건널 수 있다)
  const inRiver = (x, z) => !onBridge(x, z) && riverDist(x, z) < TERR.riverW + 0.2 + (riverMode === 'flood' ? 1.4 : 0);
  const terrSpd = (x, z) => {
    if (Math.abs(x) > MAP + 2 || Math.abs(z) > MAP + 2) return 1;
    if (inRiver(x, z)) return riverMode === 'ice' ? 1.0 : riverMode === 'flood' ? 0.4 : 0.6;
    return roadAt(x, z) ? 1.2 : 1;
  };
  // ---------- 장식: 언덕의 덤불과 풀, 강가 낚시 부두 (충돌 없음, 계절 색을 따른다) ----------
  const decorMats = { bush: new THREE.MeshStandardMaterial({ color: 0x3f8a3c, flatShading: true, roughness: 1 }), tuft: new THREE.MeshStandardMaterial({ color: 0x6aa04a, flatShading: true, roughness: 1 }) };
  { const spots = [], rnd = (() => { let s = 12345; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; })();
    for (let i = 0; i < 2600 && spots.length < 260; i++) {
      const x = (rnd() * 2 - 1) * (MAP + 12), z = (rnd() * 2 - 1) * (MAP + 12), h = terrH(x, z);
      if (Math.max(Math.abs(x), Math.abs(z)) < 34 || h < 0.35 || riverDist(x, z) < TERR.riverW + 2.2 || onBridge(x, z) || Math.hypot(x - BR.x, z - BR.z) < 12) continue;
      spots.push([x, h, z, rnd()]);
    }
    const nb = spots.length, bushes = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.7, 0), decorMats.bush, nb), tufts = new THREE.InstancedMesh(new THREE.ConeGeometry(0.22, 0.7, 5), decorMats.tuft, nb * 3), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
    spots.forEach((s, i) => { const k = 0.7 + s[3] * 0.9; q.setFromEuler(new THREE.Euler(0, s[3] * 6, 0)); m4.compose(ps.set(s[0], s[1] + 0.3 * k, s[2]), q, sc.set(k * 1.2, k * 0.8, k * 1.2)); bushes.setMatrixAt(i, m4);
      for (let j = 0; j < 3; j++) { const a = s[3] * 20 + j * 2.1, kk = 0.8 + ((s[3] * 7 + j) % 1) * 0.8; m4.compose(ps.set(s[0] + Math.cos(a) * 1.3, terrH(s[0] + Math.cos(a) * 1.3, s[2] + Math.sin(a) * 1.3) + 0.3, s[2] + Math.sin(a) * 1.3), q, sc.set(kk, kk, kk)); tufts.setMatrixAt(i * 3 + j, m4); } });
    bushes.castShadow = true; scene.add(bushes, tufts);
    // 낚시 부두: 다리 위쪽 강둑에서 물 쪽으로 뻗은 나무 부두 + 통
    const pi = 14, [px, pz] = RIVER[pi], [qx, qz] = RIVER[pi + 1], tx = qx - px, tz = qz - pz, tl = Math.hypot(tx, tz), nx = tz / tl, nz = -tx / tl;      // 강 안쪽(마을 쪽)을 향하는 법선
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
  const groundGeo = new THREE.PlaneGeometry((MAP + 20) * 2, (MAP + 20) * 2, 164, 164); groundGeo.rotateX(-Math.PI / 2);
  { const p = groundGeo.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, terrH(p.getX(i), p.getZ(i))); groundGeo.computeVertexNormals(); }
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ color: 0x9a6b44, flatShading: true, roughness: 1 }));
  ground.receiveShadow = true;
  scene.add(ground);
  const iceC = new THREE.Color(0xcfe6f5), waterC = new THREE.Color(0x3a78a8);
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x3a78a8, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.82, side: THREE.DoubleSide });
  { const pos = [], idx = [];
    for (let i = 0; i < RIVER.length; i++) {
      const a = RIVER[Math.max(0, i - 1)], b = RIVER[Math.min(RIVER.length - 1, i + 1)], tx = b[0] - a[0], tz = b[1] - a[1], tl = Math.hypot(tx, tz), nx = -tz / tl, nz = tx / tl, w = TERR.riverW + 0.7;
      pos.push(RIVER[i][0] + nx * w, -0.12, RIVER[i][1] + nz * w, RIVER[i][0] - nx * w, -0.12, RIVER[i][1] - nz * w);
      if (i > 0) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
    }
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); wg.setIndex(idx); wg.computeVertexNormals();
    const water = new THREE.Mesh(wg, waterMat); water.receiveShadow = true; scene.add(water); waterMesh = water;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(BR.len * 2, 0.22, BR.wid * 2), new THREE.MeshStandardMaterial({ color: 0xb88a56, flatShading: true, roughness: 1 }));
    deck.position.set(BR.x, BR.y - 0.12, BR.z); deck.rotation.y = -TERR.bridgeA; deck.castShadow = deck.receiveShadow = true; scene.add(deck);
    for (const s of [-1, 1]) for (const e of [-1, 1]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.0, 6), new THREE.MeshStandardMaterial({ color: 0x5a3b22, flatShading: true })); post.position.set(BR.x + BR.ux * e * (BR.len - 0.3) - BR.uz * s * BR.wid, BR.y + 0.4, BR.z + BR.uz * e * (BR.len - 0.3) + BR.ux * s * BR.wid); post.castShadow = true; scene.add(post); }
  }


