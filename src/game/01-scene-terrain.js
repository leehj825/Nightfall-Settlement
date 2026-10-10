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
  const inRiver = (x, z) => !onBridge(x, z) && riverDist(x, z) < TERR.riverW + 0.2;
  const terrSpd = (x, z) => (Math.abs(x) < MAP + 2 && Math.abs(z) < MAP + 2 && inRiver(x, z)) ? 0.6 : 1;
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
    const water = new THREE.Mesh(wg, waterMat); water.receiveShadow = true; scene.add(water);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(BR.len * 2, 0.22, BR.wid * 2), new THREE.MeshStandardMaterial({ color: 0xb88a56, flatShading: true, roughness: 1 }));
    deck.position.set(BR.x, BR.y - 0.12, BR.z); deck.rotation.y = -TERR.bridgeA; deck.castShadow = deck.receiveShadow = true; scene.add(deck);
    for (const s of [-1, 1]) for (const e of [-1, 1]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.0, 6), new THREE.MeshStandardMaterial({ color: 0x5a3b22, flatShading: true })); post.position.set(BR.x + BR.ux * e * (BR.len - 0.3) - BR.uz * s * BR.wid, BR.y + 0.4, BR.z + BR.uz * e * (BR.len - 0.3) + BR.ux * s * BR.wid); post.castShadow = true; scene.add(post); }
  }


