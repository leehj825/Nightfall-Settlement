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
  campfire.add(hallHint);
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
    ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const nh = ray.intersectObjects(npcs, true);                          // 주민을 누르면 주민 카드
    if (nh.length) { let o = nh[0].object; while (o && !npcs.includes(o)) o = o.parent; if (o) { openNpcCard(o); return; } }
    const gp = new THREE.Vector3();
    const onGround = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), gp);      // 건물 주변을 눌러도 열리도록 지면 좌표로도 판정
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

