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
    ground.material.color.lerp(s.gc, k); leafMat.color.lerp(s.lc, k); waterMat.color.lerp(s.id === 'winter' ? iceC : waterC, k);
  }
  function applyLighting(n, b = 0) {           // n: 밤 정도, b: 붉은 달 정도 (습격의 밤에만)
    sun.color.copy(L.sunDay).lerp(L.sunNight, n).lerp(L.sunBlood, b * 0.85);
    sun.intensity = lerp(1.2, 0.18, n) + b * 0.35;
    ambient.color.copy(L.ambDay).lerp(L.ambNight, n).lerp(L.ambBlood, b * 0.8);
    ambient.intensity = lerp(0.6, 0.28, n) + b * 0.12;
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
  let age = 1;
  const fireMax = () => CFG.FIRE_HP_BY_AGE[age - 1];
  const hallGroup = new THREE.Group();
  campfire.add(hallGroup);
  const hallHint = textSprite('Upgrade Age: Click / T', '#ffe7a8', 3.2, 0.8, 'bold 40px sans-serif');
  campfire.add(hallHint);
  const hallWood = mat(0x8a5a34), hallRoof = mat(0x6b3a22), hallDark = mat(0x2e2218), keepStone = mat(0x8b8e95), keepTower = mat(0x7a7e87), keepTop = mat(0x5c606a);
  function buildHall() {
    while (hallGroup.children.length) hallGroup.remove(hallGroup.children[0]);
    const add = (geo, m, px, py, pz) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.castShadow = o.receiveShadow = true; hallGroup.add(o); return o; };
    campDecor.visible = age === 1;
    if (age === 1) { flame.position.y = 0; fireLight.position.y = 1.4; hallHint.position.y = 2.6; }
    else if (age === 2) {                                              // 나무 마을 회관 (큰 목조 건물)
      add(new THREE.BoxGeometry(4.6, 2.6, 4.6), hallWood, 0, 1.3, 0);
      add(new THREE.ConeGeometry(3.9, 1.9, 4), hallRoof, 0, 3.55, 0).rotation.y = Math.PI / 4;
      add(new THREE.BoxGeometry(1.2, 1.8, 0.12), hallDark, 0, 0.9, 2.32);
      add(new THREE.BoxGeometry(0.5, 0.5, 0.12), hallDark, -1.5, 1.6, 2.32); add(new THREE.BoxGeometry(0.5, 0.5, 0.12), hallDark, 1.5, 1.6, 2.32);
      add(new THREE.CylinderGeometry(0.35, 0.45, 0.5, 8), hallDark, 0, 4.15, 0);                // 지붕 위 화덕
      flame.position.y = 4.15; fireLight.position.y = 5.2; hallHint.position.y = 6.6;
    } else {                                                           // 석조 성채(Keep): 모서리 탑 4개 + 중앙 망루
      add(new THREE.BoxGeometry(6.2, 3.2, 6.2), keepStone, 0, 1.6, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        add(new THREE.CylinderGeometry(1.0, 1.1, 4.6, 10), keepTower, sx * 3.1, 2.3, sz * 3.1);
        add(new THREE.ConeGeometry(1.3, 1.2, 10), keepTop, sx * 3.1, 5.2, sz * 3.1);
      }
      add(new THREE.BoxGeometry(3.2, 2.6, 3.2), keepStone, 0, 4.5, 0);
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; add(new THREE.BoxGeometry(0.55, 0.55, 0.55), keepTop, Math.cos(a) * 1.7, 6.0, Math.sin(a) * 1.7); }
      add(new THREE.BoxGeometry(1.6, 2.2, 0.14), hallDark, 0, 1.1, 3.12);
      flame.position.y = 6.0; fireLight.position.y = 7.2; hallHint.position.y = 8.6;
    }
    FIRE_R = CFG.HALL_RADIUS[age - 1];
    campfire.userData.radius = FIRE_R;
  }
  buildHall();

  const ageEl = document.getElementById('ageN');
  const ageName = (a) => `Age ${a} · ${CFG.AGES[a - 1].name}`;
  function updateAgeUi() { ageEl.textContent = ageName(age); }
  function setAge(a) {                       // 시대 적용 (비용 지불 없이): 회관/거주지/시민 외형을 모두 갱신
    age = a; buildHall(); fireHp = fireMax();
    refreshCitizens(); updateAgeUi(); updateTownBtn(); updateDesignBtn();
    npcs.filter(n => n.role !== 'citizen').forEach((n, i) => { n.home = homeSlot(i); });      // 시대가 바뀌면 병사 대기 위치 재배치
  }
  // ----- 시대 발전 패널 -----
  const techEl = document.getElementById('techPanel'), techUpBtn = document.getElementById('techUp');
  function refreshTech() {
    document.getElementById('techTitle').textContent = `${CFG.AGES[age - 1].hall} · ${ageName(age)}`;
    document.getElementById('techCur').textContent = `Unlocked: ${CFG.AGES.slice(0, age).map(a => a.unlock).join(' / ')}` + (playerClass ? `\nYou: ${CFG.CLASSES[playerClass].label}` : '') + (Object.keys(perks).length ? `\nPerks: ${Object.entries(perks).map(([a, id]) => CFG.PERKS[a].find(p => p.id === id).label).join(' · ')}` : '');
    const nx = CFG.AGES[age];
    if (!nx) { document.getElementById('techNext').textContent = 'Final age reached. Your town hall has become a mighty keep.'; techUpBtn.disabled = true; techUpBtn.textContent = 'Max Age'; return; }
    document.getElementById('techNext').textContent = `Next: ${ageName(age + 1)} (${nx.hall}) - Cost: ${costText(nx.cost)} (You have: ${res.wood} Wood · ${res.stone} Stone)\nUnlocks: ${nx.unlock}`;
    techUpBtn.disabled = !canPay(nx.cost); techUpBtn.textContent = `Advance to Age ${age + 1}`;
  }
  function openTech() { if (dead) return; refreshTech(); techEl.style.display = 'flex'; }
  function closeTech() { techEl.style.display = 'none'; }
  function upgradeAge() {
    const nx = CFG.AGES[age];
    if (!nx) return;
    if (!canPay(nx.cost)) return toast(`Need ${costText(nx.cost)}`);
    payCost(nx.cost);
    setAge(age + 1);
    burst({ x: 0, z: 0 }, 40); shake = Math.max(shake, 0.6);
    updateHud(); refreshTech();
    toast(`Age advanced! ${ageName(age)} - ${CFG.AGES[age - 1].hall}`);
    setTimeout(() => openPerk(age), 900);
  }
  document.getElementById('techUp').addEventListener('click', upgradeAge);
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
    ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const nh = ray.intersectObjects(npcs, true);                          // 주민을 누르면 주민 카드
    if (nh.length) { let o = nh[0].object; while (o && !npcs.includes(o)) o = o.parent; if (o) { openNpcCard(o); return; } }
    const gp = new THREE.Vector3();
    const onGround = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), gp);      // 건물 주변을 눌러도 열리도록 지면 좌표로도 판정
    if (nmActive && builtBuildings('market').length && (ray.intersectObjects(builtBuildings('market'), true).length || (onGround && builtBuildings('market').some(m => Math.hypot(gp.x - m.position.x, gp.z - m.position.z) < m.userData.radius + 0.3)))) nightMerchantMenu();
    else if (smiths().length && (ray.intersectObjects(smiths(), true).length || (onGround && smiths().some(m => Math.hypot(gp.x - m.position.x, gp.z - m.position.z) < m.userData.radius + 0.3)))) openSmith();
    else if (!dead && !uiPause && !eventOpen) attack();                    // 빈 곳을 탭하면 기본 공격
  });

  function animateFire(t) {
    if (!fireAlive) return;
    const f = 1 + Math.sin(t * 9) * 0.12 + Math.sin(t * 23) * 0.06;
    const hpR = Math.max(0.35, fireHp / fireMax());         // 모닥불 체력이 줄면 불꽃도 작아진다
    flame.scale.set((2 - f) * hpR, f * hpR, (2 - f) * hpR);
    fireLight.intensity = 1.8 + (f - 1) * 1.5;
  }

