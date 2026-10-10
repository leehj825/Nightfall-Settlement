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
    const n = Math.min(6, 2 + Math.floor(day / 2));
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), r = rand(39, 47), kind = day >= 4 && Math.random() < 0.3 ? 'normal' : 'beast';
      spawnEnemy(kind, { x: Math.cos(a) * r, z: Math.sin(a) * r });
      const e = enemies[enemies.length - 1]; e.userData.ex = false; e.userData.prowl = true; frostTint(e, 'night'); addGlow(e, 0x8f9cff, 1.5, 1.1);
    }
    setTimeout(() => toast('Night hunt: prowlers roam beyond the walls - double XP and loot, but it is dark out there'), 1500);
  }
  function prowlStep(e, u, dt) {
    const pd = Math.hypot(player.position.x - e.position.x, player.position.z - e.position.z);
    u.aggro = u.aggro ? pd < 18 : pd < 11;
    let moving = false;
    if (u.kbT > 0) { u.kbT -= dt; e.position.x += u.kbVx * dt; e.position.z += u.kbVz * dt; }
    else if (u.aggro && !(u.stunT > 0) && pd > 0.9) { { const ts = terrSpd(e.position.x, e.position.z) * climbMul(e.position.x, e.position.z, player.position.x, player.position.z); e.position.x += (player.position.x - e.position.x) / pd * u.speed * ts * dt; e.position.z += (player.position.z - e.position.z) / pd * u.speed * ts * dt; } e.lookAt(player.position.x, e.position.y, player.position.z); moving = true; }
    else if (!u.aggro) {
      u.wT = (u.wT || 0) - dt;
      if (u.wT <= 0 || !u.wp) { const a = Math.atan2(e.position.z, e.position.x) + rand(-0.9, 0.9), r = rand(39, 47); u.wp = { x: Math.cos(a) * r, z: Math.sin(a) * r }; u.wT = rand(4, 8); }
      const dx = u.wp.x - e.position.x, dz = u.wp.z - e.position.z, d = Math.hypot(dx, dz);
      if (d > 0.8) { { const ts = terrSpd(e.position.x, e.position.z) * climbMul(e.position.x, e.position.z, e.position.x + dx, e.position.z + dz); e.position.x += dx / d * u.speed * 0.45 * ts * dt; e.position.z += dz / d * u.speed * 0.45 * ts * dt; } e.lookAt(u.wp.x, e.position.y, u.wp.z); moving = true; }
    }
    const rr = Math.hypot(e.position.x, e.position.z); if (rr > MAP - 0.5) { e.position.x *= (MAP - 0.5) / rr; e.position.z *= (MAP - 0.5) / rr; }
    u.anim.base(moving ? 'walk' : 'idle', u.speed); u.atkAnimCd -= dt;
    if (pd < PLAYER_R + u.r + 0.15) {
      if (hurtCd <= 0 && !(u.stunT > 0)) { damage(u.contact); hurtCd = 0.8; shake = Math.max(shake, 0.15); }
      if (u.atkAnimCd <= 0) { u.atkAnimCd = 0.9; u.anim.once('attackSword'); }
    }
  }
  // ---------- 밤 활동 2: 모닥불 이야기 / 등불 상인 / 밤 손님 ----------
  const TALE_REQ = { any: () => true, exp: () => story.exps >= 1, age2: () => age >= 2, winter: () => CFG.SEASONS_ON && season().id === 'winter', beacon: () => story.beacon, dawn: () => story.dawn, crown: () => story.crown, hollow: () => story.hollow, finale: () => story.finale, road: () => story.road, wide: () => story.wide, eclipse: () => story.eclipse };
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
  function killEnemy(e) {                      // 즉시 사라지지 않고 쓰러지는 애니메이션을 보여 준 뒤 땅으로 꺼진다
    const u = e.userData;
    burst(e.position, u.boss ? 60 : 12);
    sfxAt(u.boss ? 'roar' : 'die', e.position.x, e.position.z); report.kills++; totalKills++;
    giveXp(((XP_KIND[u.kind] || 8) + (u.guardian ? 50 : 0)) * (u.prowl || (u.ex && exActive && exActive.night) ? 2 : 1));
    if (u.guardian && exActive && exActive.night) { pl.pend++; updateLvlUi(); toast('The guardian falls - a bonus upgrade is waiting'); }
    if (u.prowl) {                                                       // 밤사냥 전리품
      if (Math.random() < 0.55) { res.iron++; floatText('Loot: Iron +1', e.position.x, 2.6, e.position.z); }
      if (Math.random() < 0.45) { res.food += 2; floatText('Loot: Food +2', e.position.x, 3.0, e.position.z); }
      if (story.beacon && Math.random() < 0.1) { res.shard++; floatText('Loot: Shard +1', e.position.x, 3.4, e.position.z); }
      updateHud();
    }
    if (u.champ) { story.champs = (story.champs || 0) + 1; const k = 8 + dayNow(); res.iron += k; res.shard++; giveXp(80); floatText(`Champion down! +${k} Iron, +1 Shard`, e.position.x, 3.2, e.position.z); Snd.play('victory'); updateHud(); }
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
    if (byPlayer && !exActive) { const hi = player.position.y - (u.gy || 0); if (hi > 0.3) dmg *= 1 + Math.min(0.25, hi * 0.2); }       // 높은 곳에서 내려치면 최대 +25%
    if (byPlayer && u.boss) u.lureT = CFG.BOSS_LURE_TIME;      // 플레이어가 때리면 10초간 플레이어만 쫓는다
    u.hp -= dmg;
    sfxAt('hit', e.position.x, e.position.z);
    if (u.hp <= 0) { if (byPlayer && pl.st.leech) healPlayer(2 * pl.st.leech); killEnemy(e); return true; }
    burst(e.position, 4);
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
      if (d < 0.9 || (dx * fx + dz * fz) / d > Math.cos(half)) { hitEnemy(e, def.dmg, x, z, def.tier > 0, null, byPlayer); n++; }
    }
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
    const threat = (1 + Math.max(0, prosScore - 40) / 120) * (story.beacon ? 0.85 : 1) * (story.finale ? 0.85 : 1);
    const boss = day === CFG.BOSS_DAY && !chapterCleared;
    let n = Math.ceil((CFG.WAVE_BASE + day * CFG.WAVE_PER_DAY) * threat * dm().n); if (boss) n = Math.ceil(n / 2);
    const brutes = day >= CFG.BRUTE_FROM_DAY ? 1 + Math.floor((day - CFG.BRUTE_FROM_DAY) / 3) : 0, siege = day >= CFG.SIEGE_FROM_DAY ? 1 : 0;
    return `about ${n} raiders${brutes ? `, ${brutes} brute${brutes > 1 ? 's' : ''}` : ''}${siege ? ', siege throwers' : ''}${boss ? ', and the Behemoth' : ''}`;
  }
  function defenseSummary() {
    const fences = obstacles.filter(o => o.userData.type === 'fence'), wallPct = fences.length ? Math.round(100 * fences.reduce((a, f) => a + f.userData.hp / f.userData.maxHp, 0) / fences.length) : 0;
    return `Walls ${wallPct}% · Soldiers ${npcs.filter(n => n.role !== 'citizen').length} · Towers ${builtBuildings('tower').length}`;
  }
  function startWave(day) {
    wave.day = day;
    wave.quiet = !isRaid(day);
    wave.type = nightTypeOf(day);
    const extraRaiders = pendingRaiders; pendingRaiders = 0;
    const ease = nightEase ? 0.75 : 1; nightEase = false;                  // 정찰병의 경고에 대비했다면 오늘 밤 적이 25% 줄어든다               // 아침 이벤트 선택의 대가
    const threat = (1 + Math.max(0, prosScore - 40) / 120) * (story.beacon ? 0.85 : 1) * (story.finale ? 0.85 : 1);                   // 번영한 마을일수록 약탈자가 더 많이 몰려온다 (번영도 70 → +25%)
    if (wave.quiet) {                          // 조용한 밤: 짐승 / 소수의 적만 - 문명 발전에 집중할 시간
      wave.remaining = day <= 2 ? CFG.QUIET_BASE + day : Math.min(CFG.QUIET_MAX, 2 + Math.floor(day / 2));
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
            : (waveDay >= CFG.SHIELD_FROM_DAY && Math.random() < CFG.SHIELD_CHANCE ? 'shield' : specialKind(waveDay));
          spawnEnemy(kind);
          wave.remaining--;
        }
        spawnCd = rand(0.8, 1.2) * Math.max(CFG.MIN_SPAWN_INTERVAL, CFG.SPAWN_INTERVAL_BASE / (1 + CFG.SPAWN_RATE_GROWTH * (waveDay - 1)));
      }
    }
    for (const e of enemies.slice()) {
      const u = e.userData, er = u.r;
      u.anim.update(dt);
      if (!night && !u.sinking && !u.boss && !u.ex) u.sinking = true;          // 아침: 땅으로 꺼짐 (보스는 처치할 때까지 남는다)
      if (u.sinking) {
        if (u.dying > 0) { u.dying -= dt; continue; }
        e.position.y -= dt * 0.8;
        if (e.position.y < -1.0) removeEnemy(e);
        continue;
      }
      if (dead) continue;
      if (u.ex) { exEnemyStep(e, u, dt); continue; }                    // 원정 지역의 적은 별도 AI
      if (u.prowl) { prowlStep(e, u, dt); continue; }                   // 밤사냥 방랑자: 떠돌다가 플레이어를 보면 쫓는다

      // 기본 목표는 모닥불, 플레이어가 인식 거리 안이면 플레이어를 추적 (Aggro)
      const pd = Math.hypot(player.position.x - e.position.x, player.position.z - e.position.z);
      u.aggro = u.siege ? false : (u.boss && u.lureT > 0) ? true : (u.aggro ? pd < DEAGGRO : pd < AGGRO);      // 보스는 맞은 뒤 10초간 플레이어 고정      // 공성 투척병은 플레이어를 쫓지 않는다
      let tx = u.aggro ? player.position.x : 0, tz = u.aggro ? player.position.z : 0;
      if (u.sapper && !u.aggro) { let bd = 1e9; for (const o of obstacles) { if (o.userData.type !== 'fence') continue; const q = (o.position.x - e.position.x) ** 2 + (o.position.z - e.position.z) ** 2; if (q < bd) { bd = q; tx = o.position.x; tz = o.position.z; } } }       // 폭파병은 가장 가까운 목책으로
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
      u.anim.base(u.kbT > 0 || mvd < 0.3 ? 'idle' : 'walk', mvd);
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
          u.tele && u.tele.position.set(e.position.x, 0.1, e.position.z);
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

