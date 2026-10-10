  // ---------- 메인 루프 ----------
  const SPEED = 6;
  let propCd = 0, peaceful = false, peaceT = 0, fogNight = false, fogBoost = 0;          // 주변에 적이 없는 상태가 잠시 이어지면 평화로운 밤 (시민들이 모닥불 곁에서 쉰다)
  let facing = 0;
  const clock = new THREE.Clock();
  let resting = false, sparT = 0;
  let fpsT = 0, fpsN = 0, stormT = 5, lightning = 0, thunderIn = 0;

  function tick() {
    requestAnimationFrame(tick);
    const rawDt = clock.getDelta(); fpsT += rawDt; fpsN++; if (fpsT >= 1) { window.__nfFps = Math.round(fpsN / fpsT); fpsN = 0; fpsT = 0; }
    const dt = Math.min(rawDt, 0.05) * (eventOpen || uiPause ? 0 : 1);       // 아침 이벤트 창이 열려 있으면 시간이 멈춘다
    const t = clock.elapsedTime;

    // 시간 / 조명
    { const h0 = (gameMin / 60) % 24, isNight = h0 >= 18 || h0 < 6;
      gameMin += dt * MIN_PER_SEC * (exActive ? CFG.EXP_TIME_MULT : isNight ? (resting ? CFG.REST_SPEED : CFG.NIGHT_SPEED) : 1); }          // 원정 중에는 천천히, 밤에는 빠르게(쉬는 중에는 아주 빠르게)
    const hour = (gameMin / 60) % 24;
    const night = hour >= 20 || hour < 5;
    const nf = nightFactor(hour);
    const dayNo0 = Math.floor(gameMin / 1440) + 1, nightDay = hour < 7 ? dayNo0 - 1 : dayNo0;
    applyLighting(nf, isRaid(nightDay) ? nf : 0); seasonVisual(Math.min(1, dt * 0.6 + 0.0005));
    if (wave.type === 'storm' && nf > 0.4 && !exActive) {                      // 폭풍우: 번개가 번쩍이고 조금 뒤에 천둥이 친다
      stormT -= dt; if (stormT <= 0) { stormT = 3.5 + Math.random() * 7; lightning = 1; thunderIn = 0.5 + Math.random() * 0.8; }
      if (thunderIn > 0 && (thunderIn -= dt) <= 0) Snd.play('thunder');
    }
    if (exActive) {                                                                  // 원정 지역: 밤에도 달빛이 있어 상자와 적을 찾을 수 있다
      ambient.intensity += 0.45 * nf; sun.intensity += 0.3 * nf; scene.fog.near *= 2.4; scene.fog.far *= 2.0;
      for (const b of exBeams) { const d = Math.hypot(b.parent.position.x - player.position.x, b.parent.position.z - player.position.z); b.material.opacity = (0.1 + 0.2 * nf) * Math.min(1, d / 9); }       // 가까이 가면 기둥이 옅어진다
    }
    if (lightning > 0) { lightning = Math.max(0, lightning - dt * 3.2); const f = lightning * (0.6 + 0.4 * Math.sin(t * 60)); ambient.intensity += f * 1.4; sun.intensity += f * 0.9; scene.fog.color.lerp(C(0xcfd8ff), f * 0.5); scene.background.copy(scene.fog.color); }
    fogNight = night && wave.type === 'fog'; fogBoost += ((fogNight ? 1 : 0) - fogBoost) * Math.min(1, dt * 0.8);
    scene.fog.near *= 1 - 0.55 * fogBoost; scene.fog.far *= 1 - 0.45 * fogBoost;      // 안개의 밤: 시야가 크게 줄어든다
    if (bird) { scene.fog.near *= 4; scene.fog.far *= 4; }                            // 버드아이 뷰에서는 안개가 멀리 밀려난다
    { const g = Math.max(0, Math.min(1, (nf - 0.2) / 0.45)), fl = 0.94 + 0.06 * Math.sin(t * 9); windowGlow.color.setRGB(0.16 + 0.84 * g * fl, 0.16 + 0.62 * g * fl, 0.2 + 0.2 * g); lampGlow.color.copy(windowGlow.color); lampLevel = g * fl; updateGateLights(t); }      // 창문·가로등은 밤에 켜진다                      // 붉은 달의 밤에는 화면 전체가 붉게 물든다
    torch.intensity = nf * (exActive ? 3.4 : 2.4); torch.distance = exActive ? 34 : 18;   // 횃불: 밤에 켜지고 낮에 꺼짐 (원정 지역에서는 더 넓게)
    const hh = Math.floor(hour), mm = Math.floor(gameMin % 60);
    clockEl.textContent = `Day ${Math.floor(gameMin / 1440) + 1}${CFG.SEASONS_ON ? ' · ' + season().name : ''} - ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}${chapterCleared ? ' · ∞ Endless' : ''}${resting ? ' · 💤' : ''}${ngLevel ? ' · NG+' + ngLevel : ''}`;

    const dayNo = Math.floor(gameMin / 1440) + 1;
    nowHour = hour;
    if (exActive && !exEnding && (exActive.night ? (hour >= CFG.EXP_NIGHT_FORCE && hour < 12) : hour >= CFG.EXP_FORCE)) endExpedition(true);       // 해 지기 전에 자동 귀환
    updateRaidUi(hour, dayNo);
    const waveDay = hour < 5 ? dayNo - 1 : dayNo;      // 자정이 지나도 같은 밤의 웨이브로 취급
    if (!dead && hour >= 18 && lastWarnDay !== dayNo) { lastWarnDay = dayNo; 
      if (dayNo === CFG.BOSS_DAY && !chapterCleared) { showWarning('WARNING: A massive threat approaches!'); bossShakeT = 3; }
      else if (isRaid(dayNo)) showWarning(`Night ${dayNo} - Blood Moon raid! Prepare your defenses!` + (dayNo === CFG.BOSS_DAY - 1 && !chapterCleared ? ' (An even greater threat comes tomorrow night)' : ''));
      else showWarning(`Night ${dayNo} - A quiet night. Beasts prowl nearby`);
    }
    if (bossShakeT > 0) { bossShakeT -= dt; shake = Math.max(shake, 0.55); }       // 보스 경고: 강한 화면 흔들림
    if (!dead && hour >= 16 && hour < 18 && lastGuardDay !== dayNo && !exActive) {            // 해 지기 전 점검: 문보다 병사가 적으면 알려 준다
      lastGuardDay = dayNo;
      const guards = npcs.filter(n => n.role === 'melee').length, gates = gateWaypoints.length;
      if (gates > guards) toast(`Only ${guards} soldier${guards === 1 ? '' : 's'} for ${gates} gates - some entrances will be unguarded tonight`);
    }
    if (!dead && hour >= CFG.RESPAWN_HOUR && hour < 18 && lastRespawnDay !== dayNo) { lastRespawnDay = dayNo; respawnResources(); morningTown(); feedCitizens(); checkDepartures(); marketTrade(); upgradeHouses(); upgradeBuildings(); campIncome(); checkStoryAll(); if (dayNo > 1) giveXp(20 + 5 * dayNo); endlessMilestone(dayNo); if (dayNo > 1 && wave.type === 'storm') unlockAch('storm'); if (dayNo > 1 && wave.type === 'hunt') unlockAch('hunt'); seasonTick(dayNo); rollSickness(dayNo); updateProsperity(); if (dayNo > 1) { if (isRaid(dayNo + 1)) setTimeout(() => showWarning(`Warning: a raid comes tomorrow night - ${forecast(dayNo + 1)}`), 3000); showReport(dayNo); if (dayNo >= 2) storyIntro(); rollEvent(dayNo); merchantVisit(dayNo); } else report = freshReport(); if (hp < pMaxHp()) { healPlayer(pMaxHp()); toast('Morning has come. Your health is fully restored'); } saveCheckpoint(`Day ${dayNo} morning`); }
    updateEnemies(dt, night, Math.max(1, waveDay));
    const danger = enemies.some(e => !e.userData.sinking && (e.userData.boss || Math.hypot(e.position.x, e.position.z) < 34));
    peaceT = danger ? 0 : peaceT + dt; peaceful = peaceT > 2.5;
    if (peaceful && night && !exActive && !dead) {                                   // 병영·사격장 곁에서 병사와 함께 훈련하면 경험치를 얻는다
      const camp = builtBuildings('barracks').concat(builtBuildings('range')).find(b => Math.hypot(b.position.x - player.position.x, b.position.z - player.position.z) < b.userData.radius + 5);
      if (camp && (sparT += dt) >= 6) { sparT = 0; giveXp(5 + age * 2); floatText('Sparring: +XP', player.position.x, 3.0, player.position.z); }
    }
    nightActivities(dt, hour, night);
    updateNpcs(dt, hour, t);
    updateFx(dt);
    updateArrows(dt);
    updateRocks(dt);
    updateShocks(dt);
    updatePopUi(); rallyT = Math.max(0, rallyT - dt);
    if (cardNpc && (cardT -= dt) <= 0) { cardT = 0.4; renderCard(); }
    if ((propCd -= dt) <= 0) { propCd = 0.5; updateProsperity(); }
    updateRegen(dt);
    replenishTick(dt);
    siteRegrowTick(dt);
    updateTowers(dt);
    updateFood(dt);
    updateDash(dt);
    updateFloaters(dt); updateSmith(dt, t);
    Snd.setMood(nf, danger && night, enemies.some(e => e.userData.boss));
    for (const bp of blueprints) bp.material.opacity = 0.35 + 0.15 * Math.sin(t * 4);
    animateFire(t);
    atkCd -= dt;
    if (atkT > 0) {
      atkT -= dt;
      playerRig.root.position.z = Math.sin((1 - Math.max(atkT, 0) / SLASH_LIFE) * Math.PI) * 0.25;   // 베는 순간 앞으로 살짝 踏み込む
      if (atkT <= 0) playerRig.root.position.z = 0;
    }
    { const sm = dead ? null : nearestSmith(); smithBtnEl.style.display = sm ? '' : 'none'; if (!sm && smithOpenFor) closeSmith(); hallBtnEl.style.display = !dead && Math.hypot(player.position.x, player.position.z) < 14 ? '' : 'none'; }

    // 입력 합산 (조이스틱 or WASD)
    let ix = joy.x, iy = joy.y;
    const kx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    const ky = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
    if (dead) { ix = iy = 0; }
    else if (kx || ky) { const l = Math.hypot(kx, ky); ix = kx / l; iy = ky / l; }
    const mag = Math.min(1, Math.hypot(ix, iy));

    if (dashT > 0) {                       // 대시 중: 입력 이동 대신 바라보는 방향으로 질주
      const sd = Math.min(dt, dashT);
      player.position.x += dashDX * (CFG.DASH_DIST / CFG.DASH_TIME) * sd;
      player.position.z += dashDZ * (CFG.DASH_DIST / CFG.DASH_TIME) * sd;
      dashT -= dt;
    } else if (mag > 0.08) {
      // 현재 카메라가 바라보는 방향(수평) 기준으로 전진/우측 벡터 계산
      const fwdX = -Math.sin(yaw), fwdZ = -Math.cos(yaw);
      const rightX = Math.cos(yaw), rightZ = -Math.sin(yaw);
      let mx = rightX * ix + fwdX * iy, mz = rightZ * ix + fwdZ * iy;
      const ml = Math.hypot(mx, mz); mx /= ml; mz /= ml;

      const ts = terrSpd(player.position.x, player.position.z);
      player.position.x += mx * SPEED * spdMul() * ts * mag * dt;
      player.position.z += mz * SPEED * spdMul() * ts * mag * dt;

      // 이동 방향으로 부드럽게 회전
      let diff = Math.atan2(mx, mz) - facing;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      facing += diff * Math.min(1, dt * 14);
      player.rotation.y = facing;
    }
    playerAnim.base(gathering ? 'gather' : dashT > 0 ? 'run' : mag > 0.08 ? (mag > 0.6 ? 'run' : 'walk') : 'idle', SPEED * mag);   // Idle / Walk / Run / Gather CrossFade
    playerAnim.update(dt);

    updateGather(dt, dashT > 0 || mag > 0.08);

    // 충돌 처리: 겹치면 바깥으로 밀어냄
    for (const o of obstacles) {
      const dx = player.position.x - o.position.x, dz = player.position.z - o.position.z;
      const min = o.userData.radius + PLAYER_R, d = Math.hypot(dx, dz);
      if (d < min && d > 1e-4) { player.position.x = o.position.x + dx / d * min; player.position.z = o.position.z + dz / d * min; }
    }
    if (exActive) {
      for (const o of exObjs) {
        const dx = player.position.x - o.position.x, dz = player.position.z - o.position.z, min = o.userData.radius + PLAYER_R, d = Math.hypot(dx, dz);
        if (d < min && d > 1e-4) { player.position.x = o.position.x + dx / d * min; player.position.z = o.position.z + dz / d * min; }
      }
      const dx = player.position.x - EXC.x, dz = player.position.z - EXC.z, dd = Math.hypot(dx, dz);
      if (dd > 41) { player.position.x = EXC.x + dx / dd * 41; player.position.z = EXC.z + dz / dd * 41; }
    } else {
      player.position.x = Math.max(-MAP, Math.min(MAP, player.position.x));
      player.position.z = Math.max(-MAP, Math.min(MAP, player.position.z));
    }

    // 지형 높이 적용: 주인공/주민은 바닥 높이를 그대로, 적은 (몸 높이 + 지형 변화량)만큼 올린다. 나무/바위는 처음 한 번만 맞춘다
    if (!exActive) {
      player.position.y = actorH(player.position.x, player.position.z);
      for (const n of npcs) n.position.y = actorH(n.position.x, n.position.z);
      for (const e of enemies) { const u = e.userData; if (u.sinking || u.ex) continue; const nh = actorH(e.position.x, e.position.z); e.position.y += nh - (u.gy || 0); u.gy = nh; }
    } else player.position.y = 0;
    for (const o of obstacles) { const ud = o.userData; if (!ud.gset && (ud.type === 'wood' || ud.type === 'stone')) { ud.gset = true; o.position.y = terrH(o.position.x, o.position.z); } }

    // 카메라 Lerp 추적
    const k = 1 - Math.exp(-6 * dt);
    camera.position.lerp(goalPos(camGoal), k);
    lookAt.lerp(new THREE.Vector3(camFocus().x, bird ? 0 : LOOK_H + player.position.y, camFocus().z), k);
    { const gy = terrH(camera.position.x, camera.position.z) + 1.3; if (camera.position.y < gy) camera.position.y = gy; }
    camera.lookAt(lookAt);

    // 그림자 범위가 플레이어를 따라가게
    sun.target.position.copy(player.position);
    sun.position.set(player.position.x - 20, 16, player.position.z - 12);

    // 카메라 흔들림 (렌더 직전에만 적용)
    let off = null;
    if (shake > 0) {
      off = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(shake);
      camera.position.add(off);
      shake = Math.max(0, shake - dt * 1.5);
    }
    renderer.render(scene, camera);
    if (off) camera.position.sub(off);
  }
  applyPlayerGear(); updateHud();

