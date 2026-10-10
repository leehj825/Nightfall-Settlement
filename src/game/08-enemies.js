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
  function spawnEnemy(kind = 'normal', at = null) {
    const brute = kind === 'brute', shield = kind === 'shield', siege = kind === 'siege', boss = kind === 'boss', beast = kind === 'beast';
    const a = rand(0, Math.PI * 2), r = MAP - 1;    // 맵 외곽 (안개 속 먼 곳)
    const sc = beast ? 0.75 : boss ? CFG.BOSS_SCALE : brute ? CFG.BRUTE_SCALE : siege ? 1.15 : 1;
    const eMat = beast ? beastMat : boss ? bossMat.clone() : brute ? bruteMat : shield ? shieldMat : siege ? siegeMat : enemyMat;
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
    if (!beast && !siege && !boss) { rig.main = 'sword'; rig.setGear('sword', brute ? BRUTE_CLUB : RAIDER_BLADE); rig.hold('sword'); }
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
    const hp = scaleHp((beast ? CFG.BEAST_HP : (boss ? CFG.BOSS_HP : brute ? CFG.BRUTE_HP : shield ? CFG.SHIELD_HP : siege ? CFG.SIEGE_HP : CFG.ENEMY_HP) + hpBonus));
    m.userData = {
      kind, brute, shield, siege, boss, throwCd: rand(1.5, 3), hp, maxHp: hp,
      dpsKey: boss ? 'boss' : brute ? 'brute' : 'normal', slamCd: 3, slamT: 0, baseY: 0.8 * sc, r: ENEMY_R * sc,
      speed: ENEMY_SPEED * (beast ? 1.35 : boss ? CFG.BOSS_SPEED_MUL : brute ? CFG.BRUTE_SPEED_MUL : shield ? CFG.SHIELD_SPEED_MUL : 1),
      contact: beast ? 6 : boss ? CFG.BOSS_CONTACT_DMG : brute ? CFG.BRUTE_CONTACT_DMG : CFG.ENEMY_CONTACT_DMG,
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
  const XP_KIND = { normal: 8, beast: 6, shield: 12, brute: 20, siege: 15, boss: 150 };
  const LEVEL_UPS = [
    { id: 'hp', label: 'Vigor', desc: '+20 max HP' }, { id: 'dmg', label: 'Might', desc: '+15% damage' }, { id: 'spd', label: 'Swift', desc: '+6% move speed' },
    { id: 'dash', label: 'Quick Step', desc: 'Dash cooldown -12%' }, { id: 'ult', label: 'Focus', desc: 'Ultimate cooldown -12%' }, { id: 'leech', label: 'Bloodthirst', desc: 'Heal 2 HP for every kill you land' },
    { id: 'guard', label: 'Hardened', desc: 'Take 8% less damage' }, { id: 'rally', label: 'Rallying Voice', desc: 'Rally Cry lasts and reaches 20% more', cls: 'commander' },
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
