  // ---------- 적 (약탈자) ----------
  const enemies = [];
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
    const a = rand(0, Math.PI * 2), r = MAP - 1;    // 맵 외곽 (안개 속 먼 곳)
    const sc = beast ? 0.75 : boss ? CFG.BOSS_SCALE : brute ? CFG.BRUTE_SCALE : siege ? 1.15 : sapper ? 0.9 : healer ? 1.05 : 1;
    const eMat = beast ? beastMat : boss ? bossMat.clone() : brute ? bruteMat : shield ? shieldMat : siege ? siegeMat : archer ? archerMat : healer ? healerMat : sapper ? sapperMat : enemyMat;
    const rig = beast ? makeRig('beast', 0, { bodyMat: eMat, enemy: true }) : makeRig('enemy', 0, { bodyMat: eMat, enemy: true, scale: 0.88, seed: Math.floor(Math.random() * 1e6) });       // 스틱맨/네발 리그 (몸통 색 = 적 종류)
    if (boss) {                                                                    // 보스: 뿔 + 가시 어깨 + 거대 몽둥이
      const hornM = gearMat('horn', 0xd8d0b8), padM = gearMat('bosspad', 0x2a2a30);
      for (const sx of [-1, 1]) {
        const h = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.38, 6), hornM); h.position.set(sx * 0.16, 0.4, 0); h.rotation.z = -sx * 0.5; rig.head.add(h);
        const pad = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), padM); pad.position.set(sx * 0.37, 0.62, 0); rig.spine.add(pad);
        const spk = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.24, 5), hornM); spk.position.set(sx * 0.4, 0.82, 0); spk.rotation.z = -sx * 0.35; rig.spine.add(spk);
      }
      rig.main = 'sword'; rig.setGear('sword', { id: 'boss_club', slot: 'sword', tier: 1, color: 0x2a2a30 }); rig.meshes.sword.scale.setScalar(1.8); rig.hold('sword');
    }
    if (archer) { rig.main = 'bow'; rig.setGear('bow', { id: 'raider_bow', slot: 'bow', tier: 0, color: 0x6b4a2a }); rig.hold('bow'); }
    else if (!beast && !siege && !boss) { rig.main = 'sword'; rig.setGear('sword', brute ? BRUTE_CLUB : RAIDER_BLADE); rig.hold('sword'); }
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
  function openLevelPick() {
    if (pl.pend <= 0 || dead || eventOpen) return;
    const pool = LEVEL_UPS.filter(u => (!u.cls || u.cls === playerClass) && pl.st[u.id] < 5).sort(() => Math.random() - 0.5).slice(0, 3);
    if (!pool.length) { pl.pend = 0; updateLvlUi(); return; }
    openEvent({ tag: `Level ${pl.lvl}`, title: 'Choose an upgrade', text: 'You have grown stronger. Pick one permanent bonus.',
      opts: pool.map(u => ({ label: u.label, sub: `${u.desc}${pl.st[u.id] ? ` · you have ${pl.st[u.id]}` : ''}`, run: () => { pl.st[u.id]++; pl.pend--; if (u.id === 'hp') healPlayer(20); updateLvlUi(); if (pl.pend > 0) setTimeout(openLevelPick, 450); return `${u.label}: ${u.desc}`; } })) });
  }
  setInterval(() => {                                   // 안전할 때(주변에 적이 없을 때) 선택창을 자동으로 띄운다
    if (pl.pend <= 0 || eventOpen || dead || !saveReady || uiPause) return;
    if (enemies.some(e => !e.userData.sinking && Math.hypot(e.position.x - player.position.x, e.position.z - player.position.z) < 28)) return;
    openLevelPick();
  }, 1200);
  document.getElementById('lvlRow').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (pl.pend > 0) { toggleStats(false); openLevelPick(); } else toggleStats(false); });

  // ---------- 새 적: 궁수(멀리서 화살) / 치유사(주변 적 회복) / 폭파병(목책으로 달려가 자폭) ----------
  const enemyArrows = [], eArrowGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.8, 5), eArrowMat = new THREE.MeshBasicMaterial({ color: 0xc86a2a });
  function fireEnemyArrow(e, tx, tz) {
    const sx = e.position.x, sz = e.position.z, a = Math.atan2(tx - sx, tz - sz), m = new THREE.Mesh(eArrowGeo, eArrowMat);
    m.rotation.set(Math.PI / 2, a, 0, 'YXZ'); m.position.set(sx, e.position.y + 0.9, sz); scene.add(m);
    enemyArrows.push({ m, vx: Math.sin(a) * 11, vz: Math.cos(a) * 11, life: 1.6 });
    e.userData.anim.once('attackBow'); sfxAt('bow', sx, sz);
  }
  function updateEnemyArrows(dt) {
    for (let i = enemyArrows.length - 1; i >= 0; i--) {
      const a = enemyArrows[i], p = a.m.position; p.x += a.vx * dt; p.z += a.vz * dt; a.life -= dt;
      let hit = false;
      if (!dead && invincibleT <= 0 && Math.hypot(player.position.x - p.x, player.position.z - p.z) < 0.75) { damage(CFG.ENEMY_CONTACT_DMG * 0.8); hurtCd = Math.max(hurtCd, 0.3); hit = true; }
      if (!hit) for (const n of npcs) if (!n.down && Math.hypot(n.position.x - p.x, n.position.z - p.z) < 0.7) { damageNpc(n, CFG.ENEMY_CONTACT_DMG * 0.8); hit = true; break; }
      if (!hit) for (const o of obstacles) if (o.userData.type === 'fence' && Math.hypot(o.position.x - p.x, o.position.z - p.z) < o.userData.radius) { damageStructure(o, 4); hit = true; break; }
      if (hit || a.life <= 0) { scene.remove(a.m); enemyArrows.splice(i, 1); }
    }
  }
  function archerStep(e, u, dt) {                      // 사거리 안에 표적(플레이어 > 병사 > 모닥불)이 있으면 쏜다
    u.shootCd -= dt; if (u.shootCd > 0 || u.stunT > 0) return;
    let tx = null, tz = null, bd = 13;
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
