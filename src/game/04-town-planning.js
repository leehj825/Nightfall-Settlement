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
  const houseWall = bMat(0xc9a46a), houseRoof = bMat(0xa34a2a), barrackMat = bMat(0x7b808a), barrackTop = bMat(0x585d66);
  const woodMat2 = bMat(0x8a5a34), tgtRed = new THREE.MeshStandardMaterial({ color: 0xd23a2a, roughness: 1 }), tgtWhite = new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 1 });
  function doorOf(b) {                 // 건물 앞(중앙 쪽) 출입 지점
    const d = Math.hypot(b.position.x, b.position.z) || 1, off = b.userData.radius + 0.9;
    return { x: b.position.x - b.position.x / d * off, z: b.position.z - b.position.z / d * off };
  }
  const windowGlow = new THREE.MeshBasicMaterial({ color: 0x2a2a33 }), lampGlow = new THREE.MeshBasicMaterial({ color: 0x2a2a33 });        // 밤이 되면 따뜻하게 켜진다 (tick)
  const forgeGlow = new THREE.MeshBasicMaterial({ color: 0xff7a1a }), anvilMat = bMat(0x34363c);
  const tentMat = bMat(0xd9c9a0), tentDoor = bMat(0x4a3a24), stoneWall = bMat(0x8d9099), slateRoof = bMat(0x4a4d57), chimneyMat = bMat(0x6a6d75);
  const dirt = bMat(0x6b4a2b), cropMat = bMat(0x4fae3a), logPile = bMat(0x7a4f2a), rockPile = bMat(0x9a9aa2), towerStone = bMat(0x7f838c), towerTop = bMat(0x5c606a);
  // 거주지 외형은 시대에 따라 바뀐다: 1시대 텐트(원뿔) → 2시대 나무집(삼각 지붕) → 3시대 돌집
  function setHouseModel(g) {
    const lvl = g.userData.level || 1;
    while (g.children.length) g.remove(g.children[0]);
    const add = (geo, m, px, py, pz) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
    if (lvl <= 1) {
      add(new THREE.ConeGeometry(1.9, 2.6, 8), tentMat, 0, 1.3, 0);
      add(new THREE.BoxGeometry(0.7, 1.1, 0.12), windowGlow, 0, 0.55, 1.6).rotation.x = -0.35;
    } else if (lvl === 2) {
      add(new THREE.BoxGeometry(2.6, 1.8, 2.6), houseWall, 0, 0.9, 0);
      add(new THREE.ConeGeometry(2.3, 1.4, 4), houseRoof, 0, 2.5, 0).rotation.y = Math.PI / 4;
      add(new THREE.BoxGeometry(0.5, 0.5, 0.06), windowGlow, 0.6, 1.0, 1.32); add(new THREE.BoxGeometry(0.5, 0.5, 0.06), windowGlow, -0.6, 1.0, 1.32);
    } else {
      add(new THREE.BoxGeometry(2.8, 2.1, 2.8), stoneWall, 0, 1.05, 0);
      add(new THREE.ConeGeometry(2.5, 1.5, 4), slateRoof, 0, 2.85, 0).rotation.y = Math.PI / 4;
      add(new THREE.BoxGeometry(0.5, 1.2, 0.5), chimneyMat, 0.8, 3.0, 0.6);
      add(new THREE.BoxGeometry(0.5, 0.6, 0.06), windowGlow, 0.7, 1.2, 1.42); add(new THREE.BoxGeometry(0.5, 0.6, 0.06), windowGlow, -0.7, 1.2, 1.42);
    }
  }
  function refreshHouses() { for (const h of obstacles) if (h.userData.type === 'building' && h.userData.kind === 'house') setHouseModel(h); }
  function createBuilding(kind, x, z) {
    const g = new THREE.Group();
    const add = (geo, m, px, py, pz) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
    g.userData = { type: 'building', kind, radius: CFG.BUILDING[kind].radius, worker: null };
    if (CFG.LEVELED.includes(kind)) g.userData.level = 1;
    if (kind === 'house') {
      g.userData.level = age;                                          // 새 집은 현재 시대의 모습으로 지어진다
      setHouseModel(g);
    } else if (kind === 'barracks') {                                    // 평평하고 넓은 회색 건물
      add(new THREE.BoxGeometry(6.4, 1.6, 4.4), barrackMat, 0, 0.8, 0);
      add(new THREE.BoxGeometry(6.6, 0.25, 4.6), barrackTop, 0, 1.72, 0);
      for (const wx of [-2, 0, 2]) add(new THREE.BoxGeometry(0.6, 0.4, 0.06), windowGlow, wx, 1.0, 2.23);
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
      add(new THREE.BoxGeometry(2.2, 1.5, 1.8), woodMat2, 0, 0.75, 0);
      add(new THREE.BoxGeometry(2.6, 0.2, 2.2), houseRoof, 0, 1.6, 0);
      for (let i = 0; i < 3; i++) add(new THREE.CylinderGeometry(0.25, 0.25, 1.6, 8), logPile, 1.7, 0.25 + (i === 2 ? 0.4 : 0), -0.5 + (i % 2) * 0.55).rotation.z = Math.PI / 2;
    } else if (kind === 'quarry') {                                      // 채석장: 바위 더미 + 곡괭이 틀
      for (let i = 0; i < 4; i++) add(new THREE.DodecahedronGeometry(0.5 + i * 0.12, 0), rockPile, -0.9 + i * 0.7, 0.4, (i % 2) * 0.8);
      add(new THREE.BoxGeometry(0.15, 1.6, 0.15), woodMat2, 1.4, 0.8, 0);
      add(new THREE.BoxGeometry(1.0, 0.15, 0.15), woodMat2, 1.4, 1.6, 0);
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
      add(new THREE.CylinderGeometry(1.2, 1.5, 4, 10), towerStone, 0, 2, 0);
      add(new THREE.CylinderGeometry(1.7, 1.7, 0.5, 10), towerTop, 0, 4.25, 0);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(new THREE.BoxGeometry(0.5, 0.5, 0.5), towerTop, Math.cos(a) * 1.55, 4.75, Math.sin(a) * 1.55); }
      g.userData.shootCd = rand(0, 1);
    }
    g.position.set(x, 0, z);
    scene.add(g);
    obstacles.push(g);
    if (kind !== 'farm' && kind !== 'tower' && kind !== 'lumber' && kind !== 'quarry') { const dr = doorOf(g); addPath(dr.x, dr.z, 1.5); }      // 문 앞에서 중앙 광장까지 흙길
    return g;
  }
  // 선반에 완성품 진열 (재고 수만큼 칼/활을 걸어 둔다)
  function refreshRack(sm) {
    const grp = sm.userData.rackItems; if (!grp) return;
    while (grp.children.length) grp.remove(grp.children[0]);
    let i = 0;
    for (const id in sm.userData.stock) {
      for (let k = 0; k < Math.min(4, sm.userData.stock[id]); k++, i++) {
        const d = gearDef(id), m = d.slot === 'sword' ? makeSwordMesh(d) : d.slot === 'bow' ? makeBowMesh(d) : makeArmorIcon(d);
        m.scale.setScalar(0.8); m.position.set(0.12, 1.25, -1.0 + (i % 5) * 0.5);
        if (d.slot === 'armor') { m.position.y = 1.0; m.rotation.y = Math.PI / 2; }
        else if (d.slot === 'sword') { m.rotation.set(Math.PI / 2, 0, 0); m.position.y = 1.4; }       // 칼날이 아래로 걸리도록
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
  function addLamp(x, z) {                                          // 가로등: 밤이 되면 불이 켜진다
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.3, 6), lampPostMat); post.position.y = 1.15; post.castShadow = true;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), lampGlow); bulb.position.y = 2.45;
    const halo = new THREE.Sprite(haloMat); halo.scale.set(2.6, 2.6, 1); halo.position.y = 2.45; halo.renderOrder = 5;       // 등불 주변의 번지는 빛
    g.add(post, bulb, halo); g.position.set(x, 0, z); scene.add(g); doormats.push(g);
    lampHalos.push(halo);
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
    document.getElementById('designCost').textContent = cfg.age && age < cfg.age ? `Requires Age ${cfg.age} · ${n} ${type === 'wood' ? 'Wood' : 'Stone'}` : `Costs ${n} ${type === 'wood' ? 'Wood' : 'Stone'}`;
    designBtnEl.classList.toggle('stone', cfg.kind === 'stone');
  }
  function designDefense() {
    if (dead) return;
    const cfg = CFG.DESIGN[designTier];
    if (!cfg) return;
    if (cfg.age && age < cfg.age) return toast(`Available from Age ${cfg.age} (${CFG.AGES[cfg.age - 1].name})`);
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
  function findTownSpot(kind) {
    const rad = CFG.BUILDING[kind].radius;
    const others = obstacles.filter(o => o.userData.type === 'building').map(o => [o.position.x, o.position.z, o.userData.radius]).concat(blueprints.map(b => [b.position.x, b.position.z, b.userData.radius || 2]));
    let best = null, bd = Infinity;
    for (let i = 0; i < 400; i++) {
      const x = rand(-13, 13), z = rand(-13, 13), d = Math.hypot(x, z);
      if (cheb(x, z) > 13.2 || Math.abs(x) < rad + 1.2 || Math.abs(z) < rad + 1.2 || d < FIRE_R + rad + 3.2) continue;
      if (others.some(([ox, oz, or]) => Math.hypot(x - ox, z - oz) < rad + or + 1.0)) continue;
      if (d < bd) { bd = d; best = { x, z }; }
    }
    return best || { x: 7, z: -4 };
  }
  function designTown() {
    if (dead) return;
    const g = CFG.TOWN_GROUPS[townStage];
    if (!g) return;
    if (age < g.age) return toast(`Available in Age ${g.age} (${CFG.AGES[g.age - 1].name})`);
    if (!canPay(g.cost)) return toast(`Need ${costText(g.cost)}`);
    payCost(g.cost);
    townStage++;
    const names = [];
    for (const lot of g.lots) {
      const pos = lot.auto ? (lot.auto === 'town' ? findTownSpot(lot.kind) : findClusterSpot(lot.kind)) : lot;
      clearArea(pos.x, pos.z, CFG.BUILDING[lot.kind].radius + 1.4);
      addBuildingBlueprint(lot.kind, pos.x, pos.z);
      names.push(BUILDING_NAME[lot.kind]);
    }
    updateHud(); updateTownBtn();
    toast(`${g.label} done! ${names.join(' · ')} - your companions will build them`);
  }
  const BUILDING_NAME = { well: 'Well', market: 'Market', smith: 'Blacksmith', house: 'House', barracks: 'Barracks', range: 'Archery Range', farm: 'Farm', lumber: 'Lumber Camp', quarry: 'Quarry', tower: 'Defense Tower' };
  function updateTownBtn() {
    const g = CFG.TOWN_GROUPS[townStage], b = document.getElementById('townBtn');
    b.classList.toggle('done', !g);
    document.getElementById('townLbl').textContent = g ? g.label : 'Town Planning Complete';
    document.getElementById('townCost').textContent = g ? (age < g.age ? `Requires Age ${g.age}` : `Costs ${costText(g.cost)}`) : 'All buildings planned';
  }
  function upgradeFence() {
    if (dead) return;
    if (age < CFG.UPGRADE_FENCE_AGE) return toast(`Stone walls unlock in Age ${CFG.UPGRADE_FENCE_AGE} (${CFG.AGES[CFG.UPGRADE_FENCE_AGE - 1].name})`);
    const f = nearestFence('wood');
    if (!f) return toast(nearestFence() ? 'Already a stone wall' : 'No wooden fence nearby to upgrade');
    if (res.stone < CFG.FENCE_UPGRADE_STONE) return toast(`Need ${CFG.FENCE_UPGRADE_STONE} Stone`);
    res.stone -= CFG.FENCE_UPGRADE_STONE;
    f.material = wallMat;                         // 짙은 회색 돌 성벽
    f.scale.y = 1.25; f.position.y = 0.55 * 1.25;
    Object.assign(f.userData, { level: 'stone', hp: wallHp(), maxHp: wallHp() });
    updateHud();
    toast('Upgraded to a stone wall!');
  }
  // 버튼: 가까이에 나무 목책이 있으면 업그레이드, 아니면 건설

