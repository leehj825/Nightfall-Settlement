  // ---------- 습격의 날 안내 UI ----------
  const raidEl = document.getElementById('raidInfo'), raidTxtEl = document.getElementById('raidTxt');
  let raidTxt = '';
  function updateRaidUi(hour, dayNo) {
    const night = hour >= 18 || hour < 7, nd = hour < 7 ? dayNo - 1 : dayNo;
    let text, cls = '';
    if (exActive) {
      const nowM = gameMin % 1440, target = exActive.night ? (nowM >= 720 ? 1440 + CFG.EXP_NIGHT_FORCE * 60 : CFG.EXP_NIGHT_FORCE * 60) : CFG.EXP_FORCE * 60;
      const left = Math.max(0, Math.ceil((target - nowM) / (MIN_PER_SEC * CFG.EXP_TIME_MULT))), mm = Math.floor(left / 60), ss = String(left % 60).padStart(2, '0');
      if (left <= 30 && !exActive.warned) { exActive.warned = true; toast(exActive.night ? 'Dawn is near - about 30 seconds left. Grab the last chests!' : 'Dusk is near - about 30 seconds left. Grab the last chests!'); }
      const chests = exObjs.filter(o => o.userData.type === 'chest'), foes = enemies.filter(e => e.userData.ex && !(e.userData.dying > 0));
      let near = null, nd0 = Infinity; for (const c of chests) { const d = Math.hypot(c.position.x - player.position.x, c.position.z - player.position.z); if (d < nd0) { nd0 = d; near = c; } }
      let arrow = ''; if (near) {
        const f = camera.getWorldDirection(new THREE.Vector3()), tx = near.position.x - player.position.x, tz = near.position.z - player.position.z;
        const rel = Math.atan2(tx * -f.z + tz * f.x, tx * f.x + tz * f.z); arrow = ` ${['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'][(Math.round(rel / (Math.PI / 4)) + 8) % 8]}${Math.round(nd0)}m`;
      }
      const t = `${exActive.dest.name} · home in ${mm}:${ss} · 🎁${chests.length}${arrow} · ☠${foes.length}`; if (t !== raidTxt) { raidTxt = t; raidTxtEl.textContent = t; raidEl.className = 'soon'; } return; }
    if (night) {
      if (isRaid(nd)) { text = '🌑 Blood Moon raid in progress!'; cls = 'blood'; }
      else { const left = nextRaidFrom(nd + 1) - nd, tp = nightTypeOf(nd); text = `${tp === 'calm' ? 'Quiet night' : NIGHT_INFO[tp][0]} · ${left} day${left > 1 ? 's' : ''} until the next big raid`; cls = left <= 1 ? 'soon' : ''; }
    } else if (isRaid(dayNo)) { text = '⚠ Blood Moon raid tonight!'; cls = 'blood'; }
    else { const left = nextRaidFrom(dayNo) - dayNo, tp = nightTypeOf(dayNo); text = `${left} day${left > 1 ? 's' : ''} until the next big raid` + (tp !== 'calm' ? ` · Tonight: ${NIGHT_INFO[tp][0]}` : ''); cls = left <= 1 ? 'soon' : ''; }
    if (text !== raidTxt) { raidTxt = text; raidTxtEl.textContent = text; raidEl.className = cls; }
  }

  // ---------- 경고 UI / 자원 리스폰 ----------
  const warnEl = document.getElementById('warn');
  let warnTimer;
  function showWarning(msg) {
    buzz([120, 60, 120]); warnEl.textContent = msg; warnEl.classList.add('show'); Snd.play(/Behemoth|massive/.test(msg) ? 'roar' : /^Warning/.test(msg) ? 'bell' : 'horn');
    clearTimeout(warnTimer); warnTimer = setTimeout(() => warnEl.classList.remove('show'), 3000);
  }
  const countType = (t) => obstacles.filter(o => o.userData.type === t).length;
  // 자원 보충: 나무/바위가 목표 수보다 적으면 (플레이어·동료·청사진·출입구·성벽 통행로를 피해) 채워 넣는다
  function resourceFree() {
    return (x, z) => Math.hypot(x - player.position.x, z - player.position.z) > 6 &&
      npcs.every(n => Math.hypot(x - n.position.x, z - n.position.z) > 4) &&
      blueprints.every(b => Math.hypot(x - b.position.x, z - b.position.z) > 3) &&
      gateWaypoints.every(g => Math.hypot(x - g.x, z - g.z) > 3.5) &&
      gateWaypoints.every(g => Math.abs(cheb(x, z) - g.r) > CFG.CORRIDOR_WIDTH + 1);      // 성벽 통행로에는 생성 금지
  }
  function topUpResources(maxPerType = Infinity) {
    const free = resourceFree(), before = obstacles.length;
    scatter(makeTree, Math.min(maxPerType, Math.max(0, CFG.TREE_COUNT - countType('wood'))), free);
    scatter(makeRock, Math.min(maxPerType, Math.max(0, CFG.STONE_COUNT - countType('stone'))), free);
    return obstacles.length - before;
  }
  function respawnResources() { if (topUpResources() > 0) toast('Morning has come. Resources have regrown'); }
  let replenishCd = 0;
  function replenishTick(dt) {                 // 하루 한 번이 아니라 수시로 보충해서 자원이 바닥나지 않게 한다
    replenishCd -= dt;
    if (replenishCd > 0 || dead) return;
    replenishCd = CFG.REPLENISH_INTERVAL;
    topUpResources(CFG.REPLENISH_BATCH);
  }
  // 벌목장/채석장 주변에는 자원이 다시 자라나서 시민이 멀리 나가지 않고도 계속 일할 수 있다
  function spawnNear(factory, cx, cz, rMin, rMax) {
    const free = resourceFree();
    const o = factory();
    for (let i = 0; i < 30; i++) {
      const a = rand(0, Math.PI * 2), r = rand(rMin, rMax), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (Math.max(Math.abs(x), Math.abs(z)) > MAP - 3 || Math.hypot(x, z) < 6 || inRiver(x, z) || !free(x, z)) continue;
      if (obstacles.some(p => Math.hypot(p.position.x - x, p.position.z - z) < p.userData.radius + o.userData.radius + 0.8)) continue;
      o.position.set(x, 0, z); o.rotation.y = rand(0, Math.PI * 2); scene.add(o); obstacles.push(o);
      return true;
    }
    return false;
  }
  let regrowCd = 0;
  function siteRegrowTick(dt) {
    regrowCd -= dt;
    if (regrowCd > 0 || dead) return;
    regrowCd = CFG.SITE_REGROW;
    for (const b of obstacles) {
      if (b.userData.type !== 'building' || (b.userData.kind !== 'lumber' && b.userData.kind !== 'quarry')) continue;
      const type = b.userData.kind === 'lumber' ? 'wood' : 'stone';
      const near = obstacles.filter(o => o.userData.type === type && Math.hypot(o.position.x - b.position.x, o.position.z - b.position.z) < CFG.WORK_RADIUS).length;
      if (near < 10) spawnNear(type === 'wood' ? makeTree : makeRock, b.position.x, b.position.z, 4, 11);
    }
  }
  let lastWarnDay = 0, lastRespawnDay = 1, bossShakeT = 0, lastGuardDay = 0;


