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
      gameMin, res: { ...res }, story: JSON.parse(JSON.stringify(story)), playerClass, perks: { ...perks }, order, playerGear: { ...playerGear }, weaponMode, hp, fireHp, designTier, townStage, age, chapterCleared, lastWarnDay, lastRespawnDay,
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
      npcs: npcs.map(n => ({ role: n.role, born: n.born, home: { ...n.home }, ...pos(n), hp: n.hp, name: n.name, trait: n.trait, mood: n.mood, gear: { ...n.gear }, hungry: n.hungry, xp: { ...n.xp }, pref: n.pref, sick: n.sick || 0, vxp: n.vxp || 0, promoteTo: n.promote ? n.promote.to : null })),
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
    Object.assign(story, { roads: [], relics: {}, said: {}, log: [], intro: false, exps: 0, beacon: false, dawn: false, crown: false, hollow: false, finale: false, road: false, wide: false, eclipse: false, dusk: false, champs: 0, camps: {}, cleared: {}, tales: {}, taleDay: 0, ms: {} }, JSON.parse(JSON.stringify(sn.story || {}))); setBeacon(!!story.beacon); rebuildCamps();
    rebuildRoads(); totalKills = sn.tk || 0; Object.assign(pl, { lvl: 1, xp: 0, pend: 0 }, sn.pl || {}); pl.st = Object.assign({ hp: 0, dmg: 0, spd: 0, dash: 0, ult: 0, leech: 0, guard: 0, rally: 0, spear: 0, fletch: 0, regen: 0, forage: 0 }, (sn.pl && sn.pl.st) || {}); updateLvlUi();
    gameMin = sn.gameMin; res.wood = sn.res.wood; res.stone = sn.res.stone; res.food = sn.res.food || 0; res.iron = sn.res.iron || 0; res.shard = sn.res.shard || 0;
    for (const k of Object.keys(perks)) delete perks[k]; Object.assign(perks, sn.perks || {});
    if (sn.playerClass) { const keep = sn.hp; setClass(sn.playerClass); } else { playerClass = null; setTimeout(openDifficultyChoice, 700); }
    order = sn.order || 'guard'; document.getElementById('ordSub').textContent = `R · ${order === 'follow' ? 'Follow' : 'Guard'}`;
    Object.assign(playerGear, { sword: 'sword_basic', bow: 'bow_basic', armor: 'armor_none' }, sn.playerGear || {}); weaponMode = sn.weaponMode; applyPlayerGear();
    closeSmith(); hp = sn.hp; fireHp = sn.fireHp;
    designTier = sn.designTier; townStage = sn.townStage || 0; age = sn.age || 1; chapterCleared = sn.chapterCleared;
    buildHall(); updateAgeUi();                                      // 시대에 맞는 회관/거주지 외형으로 복원
    lastWarnDay = sn.lastWarnDay; lastRespawnDay = sn.lastRespawnDay; Object.assign(wave, sn.wave);
    dead = false; fireAlive = true; flame.visible = true; hurtCd = 0; sinceHurt = 99; bossShakeT = 0; shake = 0;
    dashT = dashCd = invincibleT = ultCd = atkT = atkCd = 0; gathering = null; replenishCd = 0;
    for (const n of sn.nodes) { const o = n.t === 'wood' ? makeTree() : makeRock(); o.position.set(n.x, 0, n.z); o.rotation.y = n.rot; scene.add(o); obstacles.push(o); }
    for (const f of sn.fences) { const o = f.level === 'stone' ? createWall(f.x, f.z, f.rot) : createFence(f.x, f.z, f.rot); o.userData.hp = f.hp; }
    for (const b of sn.buildings) { const o = createBuilding(b.kind, b.x, b.z); if (b.level) { if (b.kind === 'house') { o.userData.level = b.level; setHouseModel(o); } else setBuildingLevel(o, b.level); } if (b.stock) { Object.assign(o.userData.stock, b.stock); refreshRack(o); } }
    for (const b of sn.bps) { if (b.bkind) addBuildingBlueprint(b.bkind, b.x, b.z); else addBlueprint(b.res, b.x, b.z, b.rot); }
    for (const g of sn.gates) { addGate(g.x, g.z, g.r, g.nx, g.nz); if (g.lv > 1) setGateLevel(gateWaypoints[gateWaypoints.length - 1], g.lv); }
    for (const d of sn.npcs) {
      const n = makeNpc(d.role, d.home, d.born, 0, { name: d.name, trait: d.trait, mood: d.mood, xp: d.xp, pref: d.pref, sick: d.sick }); n.vxp = d.vxp || 0; n.position.set(d.x, 0, d.z); n.hp = d.hp; n.px = d.x; n.pz = d.z;
      if (d.gear) { n.gear = { armor: 'armor_none', ...d.gear }; applyGear(n); }
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
    setAge(3);                                                // 디버그: 3시대(석조 요새)로
    if (!playerClass) setClass('warrior');
    for (const a of [1, 2, 3]) if (!perks[a]) choosePerk(a, CFG.PERKS[a][0].id);
    while (townStage < CFG.TOWN_GROUPS.length) designTown();
    while (CFG.DESIGN[designTier]) designDefense();
    for (const b of blueprints.slice()) {                     // 도면을 즉시 완성
      blueprints.splice(blueprints.indexOf(b), 1); scene.remove(b);
      if (b.userData.bkind) createBuilding(b.userData.bkind, b.position.x, b.position.z);
      else createStructure(b.userData.res, b.position.x, b.position.z, b.rotation.y);
    }
    morningTown();                                            // 시민 스폰 → 병영/사격장 전직 즉시 완료
    for (const c of npcs.filter(n => n.promote)) setRole(c, c.promote.to);
    const sm = smiths()[0];                                   // 디버그: 대장간 선반에 장비를 채워 병사들이 수령하게 한다
    if (sm) { sm.userData.stock.iron_sword += 3; sm.userData.stock.strong_bow += 2; sm.userData.stock.iron_armor += 4; sm.userData.stock.steel_sword += 1; refreshRack(sm); }
    playerGear.sword = 'iron_sword'; applyPlayerGear();
    for (const e of enemies.slice()) removeEnemy(e);
    for (const r of rocks.slice()) { scene.remove(r); scene.remove(r.userData.mark); rocks.splice(rocks.indexOf(r), 1); }
    healPlayer(pMaxHp()); fireHp = fireMax();
    chapterCleared = false; wave.day = 0; wave.bossLeft = 0;
    gameMin = (CFG.BOSS_DAY - 1) * 1440 + 17 * 60 + 30;       // Day 7 17:30
    lastWarnDay = CFG.BOSS_DAY - 1; lastRespawnDay = CFG.BOSS_DAY;
    updateHud();
    toast('DEBUG: Day 7 17:30 - defenses, town, and troops ready');
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
        if (e.userData.sinking || e.userData.siege || e.userData.prowl) continue;
        const d = Math.hypot(e.position.x - t.position.x, e.position.z - t.position.z);
        if (d < bd) { bd = d; foe = e; }
      }
      if (!foe) continue;
      t.userData.shootCd = CFG.TOWER_INTERVAL * (1 - 0.12 * (lvOf(t) - 1));
      fireArrow(t.position.x, t.position.z, Math.atan2(foe.position.x - t.position.x, foe.position.z - t.position.z), false, CFG.TOWER_DMG * (hasPerk('engineer') ? 1.5 : 1) * (1 + 0.35 * (lvOf(t) - 1)), 4.9);
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

