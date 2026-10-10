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
    runs.push({ ts: Date.now(), diff, ng: ngLevel, day: rb.day, lv: pl.lvl, k: totalKills, cls: playerClass, cause, age, pop: npcs.length });
    try { localStorage.setItem('nf_runs', JSON.stringify(runs.slice(-15))); } catch (e) {}
  }
  function balanceReport() {
    const L = [`Nightfall Settlement balance report`, `Now: ${diff}${ngLevel ? ' NG+' + ngLevel : ''} · Day ${dayNow()} · Lv ${pl.lvl} · class ${playerClass || '-'} · age ${age} · pop ${npcs.length} · kills ${totalKills} · power ${Math.round(powerOf().total)}`, '', 'Night log (day, raid?, kills, walls lost, citizens lost, walls fortified, built, pop, prosperity, level, power, wood/stone/iron/food):'];
    for (const s of story.stats || []) L.push(`D${s.d}${s.raid ? ' RAID' : ''}: kills ${s.k}, walls lost ${s.wl}, citizens lost ${s.cl}, fortified ${s.f || 0}, built ${s.b}, pop ${s.pop}, pros ${s.pr}, Lv${s.lv}, power ${s.pw}, ${s.w}/${s.s}/${s.i}/${s.fd}`);
    let runs = []; try { runs = JSON.parse(localStorage.getItem('nf_runs') || '[]') || []; } catch (e) { runs = []; }
    if (runs.length) { L.push('', 'Past runs:'); for (const r of runs.slice().reverse()) L.push(`${new Date(r.ts).toISOString().slice(0, 10)} ${r.diff}${r.ng ? '+' + r.ng : ''}: day ${r.day}, Lv ${r.lv}, kills ${r.k}, ${r.cls || '-'}, age ${r.age}, pop ${r.pop} - ${r.cause}`); }
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
    if (invincibleT > 0) return;               // 대시 무적
    n = Math.max(1, Math.round(n * dm().dmg * (1 - gearDef(playerGear.armor).reduce) * 0.92 ** pl.st.guard));      // 난이도 + 방어구 + 성장 피해 감소
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
    g.position.set(x, 0.08, z);
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

