  // ---------- 플레이어 공격 ----------
  let atkT = 0, atkCd = 0, shake = 0;
  let tapTip = false; try { tapTip = !!localStorage.getItem('nf_tiptap'); } catch (e) {}
  function attack() {
    if (!tapTip && !dead) { tapTip = true; try { localStorage.setItem('nf_tiptap', '1'); } catch (e) {} setTimeout(() => toast('Tip: tap anywhere on the screen to attack'), 600); }
    if (dead || atkCd > 0) return;
    atkCd = ATK_CD * (weaponMode === 'spear' ? 1.25 : 1);
    gathering = null;
    if (weaponMode === 'bow') {
      shake = Math.max(shake, 0.08);
      playerAnim.once('attackBow'); Snd.play('bow');
      fireArrow(player.position.x, player.position.z, facing, true, gearDef(playerGear.bow).dmg * pDmg() * (1 + 0.2 * pl.st.fletch));
      return;
    }
    if (weaponMode === 'spear') {                                      // 창: 좁은 부채꼴, 긴 사거리, 느린 연타. 줄지어 선 적을 한꺼번에 꿰뚫는다
      const base = gearDef(playerGear.sword), sd = { ...base, dmg: base.dmg * pDmg() * 1.12 * (1 + 0.2 * pl.st.spear), half: Math.PI / 9, rangeMul: 1.75 * (1 + 0.08 * pl.st.spear), slash: (base.slash || 1) * 1.6 };
      atkT = SLASH_LIFE; shake = 0.2; playerAnim.once('attackSword'); Snd.play('swing'); spawnSlash(player.position.x, player.position.z, facing, { ...sd, slash: 1.5 });
      const hits = sectorHit(player.position.x, player.position.z, facing, true, sd);
      if (hits >= 3) floatText(`PIERCE x${hits}!`, player.position.x + Math.sin(facing) * 2, 2.6, player.position.z + Math.cos(facing) * 2);
      return;
    }
    atkT = SLASH_LIFE; shake = 0.3;
    playerAnim.once('attackSword'); Snd.play('swing');
    spawnSlash(player.position.x, player.position.z, facing);
    // 광역(Cleave): 부채꼴 안의 모든 적이 동시에 피해와 넉백을 받는다
    const hits = sectorHit(player.position.x, player.position.z, facing, true, { ...gearDef(playerGear.sword), dmg: gearDef(playerGear.sword).dmg * pDmg() });
    if (hits >= 2) {
      shake = Math.min(0.7, 0.3 + hits * 0.06);
      floatText(`CLEAVE x${hits}!`, player.position.x + Math.sin(facing) * 2, 2.6, player.position.z + Math.cos(facing) * 2);
    }
  }

  // ---------- 무기 교체 / 화살 ----------
  const WEAPON_NAME = { sword: 'Sword', bow: 'Bow', spear: 'Spear' };
  function swapWeapon() {
    if (dead) return;
    weaponMode = weaponMode === 'sword' ? 'bow' : weaponMode === 'bow' ? 'spear' : 'sword';
    playerRig.main = weaponMode === 'spear' ? 'sword' : weaponMode;
    document.getElementById('swapCur').textContent = `Q · ${WEAPON_NAME[weaponMode]}`;
    toast(weaponMode === 'bow' ? 'Bow equipped (ranged)' : weaponMode === 'spear' ? 'Spear equipped (long thrust, slower)' : 'Sword equipped (wide sweep)');
  }
  // 화살은 아군 구조물(obstacles)과 충돌 검사를 하지 않으므로 목책/성벽을 그대로 통과한다 (one-way wall).
  const arrows = [];
  const arrowGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.9, 6);
  const arrowMat = new THREE.MeshBasicMaterial({ color: 0x8a5a2b });
  function fireArrow(x, z, ang, byPlayer = false, dmg = null, y = 1.0) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(arrowGeo, arrowMat);
    m.rotation.x = Math.PI / 2;                     // 원기둥 축을 진행(+Z) 방향으로 눕힘
    g.add(m);
    const sx = Math.sin(ang), sz = Math.cos(ang);
    g.position.set(x + sx * 0.7, y, z + sz * 0.7);
    g.rotation.y = ang;
    g.userData = { vx: sx * CFG.ARROW_SPEED, vz: sz * CFG.ARROW_SPEED, dist: 0, byPlayer, dmg };
    scene.add(g);
    arrows.push(g);
  }
  // 떠오르는 텍스트 (방패병 면역 표시)
  const floaters = [], floatTex = new Map();
  function floatText(text, x, y, z) {
    let tex = floatTex.get(text);
    if (!tex) {
      const cv = document.createElement('canvas');
      cv.width = 256; cv.height = 64;
      const c = cv.getContext('2d');
      c.font = 'bold 30px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 5; c.strokeStyle = 'rgba(0,0,0,.7)'; c.strokeText(text, 128, 32);
      c.fillStyle = '#c9ced6'; c.fillText(text, 128, 32);
      tex = new THREE.CanvasTexture(cv);
      floatTex.set(text, tex);
    }
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, fog: false, depthTest: false }));
    sp.scale.set(1.6, 0.4, 1);
    sp.position.set(x, y, z);
    sp.userData = { life: 0.9 };
    scene.add(sp);
    floaters.push(sp);
  }
  function updateFloaters(dt) {
    for (const f of floaters.slice()) {
      f.userData.life -= dt;
      f.position.y += dt * 1.1;
      f.material.opacity = Math.max(0, Math.min(1, f.userData.life / 0.4));
      if (f.userData.life <= 0) { scene.remove(f); f.material.dispose(); floaters.splice(floaters.indexOf(f), 1); }
    }
  }
  function updateArrows(dt) {
    for (const a of arrows.slice()) {
      const u = a.userData;
      const x0 = a.position.x, z0 = a.position.z;
      const dx = u.vx * dt, dz = u.vz * dt, len = Math.hypot(dx, dz);
      // 이번 프레임 이동 구간(선분)과 가장 먼저 만나는 적을 찾는다 (빠른 화살의 터널링 방지)
      let hit = null, bestT = Infinity;
      for (const e of enemies) {
        if (e.userData.sinking) continue;
        const ex = e.position.x - x0, ez = e.position.z - z0;
        const t = Math.max(0, Math.min(1, (ex * dx + ez * dz) / (len * len)));
        const px = ex - dx * t, pz = ez - dz * t;
        if (px * px + pz * pz < (e.userData.r + 0.15) ** 2 && t < bestT) { bestT = t; hit = e; }
      }
      if (hit) {
        if (hit.userData.shield) floatText('Immune', hit.position.x, hit.position.y + 1.6, hit.position.z);   // 방패병: 화살 면역
        else hitEnemy(hit, u.dmg ?? CFG.BOW_DMG, x0, z0, false, null, u.byPlayer);    // 활 데미지는 고정(무기 강화 영향 없음)
        scene.remove(a); arrows.splice(arrows.indexOf(a), 1);
        continue;
      }
      a.position.x += dx; a.position.z += dz;
      u.dist += len;
      if (u.dist >= CFG.ARROW_RANGE) { scene.remove(a); arrows.splice(arrows.indexOf(a), 1); }   // 사거리 초과 시 소멸
    }
  }

  // ---------- 구조물 파괴 → 청사진 복귀 ----------
  function collapseStructure(o) {
    const i = obstacles.indexOf(o);
    if (i < 0) return;
    obstacles.splice(i, 1); report.wallsLost++;
    scene.remove(o);
    addBlueprint(o.userData.level === 'stone' ? 'stone' : 'wood', o.position.x, o.position.z, o.rotation.y);   // 같은 위치·회전의 반투명 청사진 (충돌 없음)
    dust(o.position.x, o.position.z);
  }
  function damageStructure(o, dmg) {
    o.userData.hp -= dmg * dm().dmg;
    if (o.userData.hp <= 0) collapseStructure(o);
  }

  // ---------- 공성 투척병의 폭발 바위 (곡사) ----------
  const rocks = [];
  const rockGeo = new THREE.SphereGeometry(0.55, 12, 10);
  const rockMatBlack = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.5 });
  const markGeo = new THREE.RingGeometry(CFG.ROCK_SPLASH - 0.3, CFG.ROCK_SPLASH, 32);
  const boomGeo = new THREE.CircleGeometry(CFG.ROCK_SPLASH, 28);
  const ROCK_G = 16;
  function throwRock(e) {
    e.userData.anim.once('attackSword');
    // 조준: 가장 가까운 구조물, 없으면 모닥불
    let tx = 0, tz = 0, bd = Infinity;
    for (const o of obstacles) {
      if (o.userData.type !== 'fence') continue;
      const d = (o.position.x - e.position.x) ** 2 + (o.position.z - e.position.z) ** 2;
      if (d < bd) { bd = d; tx = o.position.x; tz = o.position.z; }
    }
    tx += rand(-1.5, 1.5); tz += rand(-1.5, 1.5);
    const sx = e.position.x, sz = e.position.z, y0 = 2.4;
    const T = Math.max(1.4, Math.hypot(tx - sx, tz - sz) / CFG.ROCK_FLIGHT_SPEED);   // 체공 시간
    const m = new THREE.Mesh(rockGeo, rockMatBlack);
    m.position.set(sx, y0, sz);
    m.castShadow = true;
    const mark = new THREE.Mesh(markGeo, new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
    mark.rotation.x = -Math.PI / 2; mark.position.set(tx, 0.06, tz);      // 낙하 지점 경고 (대시로 피할 수 있다)
    m.userData = { vx: (tx - sx) / T, vz: (tz - sz) / T, vy: (0.5 * ROCK_G * T * T - y0) / T, t: 0, T, tx, tz, mark };
    scene.add(m, mark);
    rocks.push(m);
  }
  function explodeRock(r) {
    const { tx, tz, mark } = r.userData;
    const x = r.position.x, z = r.position.z;
    scene.remove(r); scene.remove(mark); mark.material.dispose();
    rocks.splice(rocks.indexOf(r), 1);
    burst({ x, z }, 30);                                                  // 붉은 폭발 파티클
    const g = new THREE.Group();                                          // 폭발 범위 섬광
    const f = new THREE.Mesh(boomGeo, new THREE.MeshBasicMaterial({ color: 0xff3b1a, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }));
    f.rotation.x = -Math.PI / 2; g.add(f); g.position.set(x, 0.1, z); g.userData.life = SLASH_LIFE * 1.5;
    scene.add(g); slashes.push(g);
    if (Math.hypot(player.position.x - x, player.position.z - z) < 25) shake = Math.max(shake, 0.4);
    for (const o of obstacles.slice()) {                                  // 광역 피해: 반경 내 모든 구조물 체력 -50
      if (o.userData.type === 'fence' && Math.hypot(o.position.x - x, o.position.z - z) < CFG.ROCK_SPLASH) damageStructure(o, CFG.ROCK_DAMAGE);
    }
    if (fireAlive && Math.hypot(x, z) < CFG.ROCK_SPLASH + FIRE_R) {       // 모닥불 직격
      fireHp -= CFG.ROCK_DAMAGE * dm().dmg;
      toast('The campfire was hit by a siege boulder!');
      if (fireHp <= 0) destroyFire();
    }
  }
  function updateRocks(dt) {
    for (const r of rocks.slice()) {
      const u = r.userData;
      u.t += dt; u.vy -= ROCK_G * dt;
      r.position.x += u.vx * dt; r.position.z += u.vz * dt; r.position.y += u.vy * dt;
      u.mark.material.opacity = 0.35 + 0.25 * Math.sin(u.t * 14);
      if (u.t >= u.T || r.position.y <= 0.3) explodeRock(r);               // 땅에 닿으면 폭발
    }
  }

  // ---------- 대시 (무적 포함) ----------
  let dashT = 0, dashCd = 0, invincibleT = 0, dashDX = 0, dashDZ = 0;
  function dash() {
    if (dead || dashCd > 0 || dashT > 0) return;
    dashDX = Math.sin(facing); dashDZ = Math.cos(facing);
    dashT = CFG.DASH_TIME; dashCd = CFG.DASH_CD * dashMul(); invincibleT = CFG.DASH_INVULN; Snd.play('dash');
    dust(player.position.x, player.position.z);
  }
  const barBg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthTest: false, fog: false }));
  const barFill = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x7fd4ff, transparent: true, opacity: 0.6, depthTest: false, fog: false }));
  barBg.scale.set(1.3, 0.14, 1); barFill.center.set(0, 0.5);
  barBg.renderOrder = barFill.renderOrder = 10;
  barBg.visible = barFill.visible = false;
  scene.add(barBg, barFill);
  const gBg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthTest: false, fog: false }));
  const gFill = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffe08a, transparent: true, opacity: 0.6, depthTest: false, fog: false }));
  gBg.scale.set(1.3, 0.14, 1); gFill.center.set(0, 0.5);
  gBg.renderOrder = gFill.renderOrder = 10;
  gBg.visible = gFill.visible = false;
  scene.add(gBg, gFill);
  function updateGather(dt, moving) {
    if (!gathering) { gBg.visible = gFill.visible = false; return; }
    const g = gathering, o = g.target;
    const gone = !(exActive && exObjs.includes(o)) && !obstacles.includes(o) || Math.hypot(o.position.x - player.position.x, o.position.z - player.position.z) - o.userData.radius > GATHER_RANGE + 1;
    if (dead || moving || gone) {
      if (moving && !gone) toast('Gathering cancelled');
      gathering = null; gBg.visible = gFill.visible = false; return;
    }
    g.t += dt;
    facing = Math.atan2(o.position.x - player.position.x, o.position.z - player.position.z); player.rotation.y = facing;
    const prog = Math.min(1, g.t / CFG.PLAYER_GATHER_TIME), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    gBg.visible = gFill.visible = true;
    gBg.position.set(player.position.x, 0.02, player.position.z);
    gFill.position.set(player.position.x - rx * 0.65, 0.02, player.position.z - rz * 0.65);
    gFill.scale.set(Math.max(0.001, 1.3 * prog), 0.14, 1);
    if (g.t >= CFG.PLAYER_GATHER_TIME) {
      scene.remove(o);
      if (o.userData.type === 'chest') { exObjs.splice(exObjs.indexOf(o), 1); openChest(o); }
      else {
        const pool = exObjs.includes(o) ? exObjs : obstacles; pool.splice(pool.indexOf(o), 1);
        res[o.userData.type] += gatherYield(o.userData.type); rollIron(o); Snd.play('chop');
        if (o.userData.ore) { const k = 2 + Math.floor(Math.random() * 3); res.iron += k; floatText(`Ore: Iron +${k}`, o.position.x, 2.4, o.position.z); }
      }
      updateHud();
      gathering = null; gBg.visible = gFill.visible = false;
    }
  }

  // ---------- 궁극기: 회전 강타 ----------
  let ultCd = 0;
  const ultBtnEl = document.getElementById('ultBtn'), ultCdEl = document.getElementById('ultCd');
  const ultGeo = new THREE.CircleGeometry(CFG.ULT_RADIUS, 40);
  function rally() {                                                  // 지휘형의 궁극기: 병사들 회복 + 8초간 공격력 +50%
    ultCd = CFG.RALLY_CD * (hasPerk('warlord') ? 0.7 : 1) * 0.88 ** pl.st.ult; rallyT = CFG.RALLY_TIME * (1 + 0.2 * pl.st.rally); Snd.play('horn'); shake = Math.max(shake, 0.3);
    const g = new THREE.Group();
    const m = new THREE.Mesh(ultGeo, new THREE.MeshBasicMaterial({ color: 0x8affc0, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.scale.setScalar(CFG.RALLY_RADIUS * (1 + 0.2 * pl.st.rally) / CFG.ULT_RADIUS); g.add(m);
    g.position.set(player.position.x, 0.12, player.position.z); g.userData.life = 0.45; scene.add(g); slashes.push(g);
    let k = 0;
    for (const n of npcs) {
      if (n.role === 'citizen' || n.down || Math.hypot(n.position.x - player.position.x, n.position.z - player.position.z) > CFG.RALLY_RADIUS) continue;
      n.hp = Math.min(n.maxHp, n.hp + Math.round(n.maxHp * 0.3)); k++; floatText('Rally!', n.position.x, 3.0, n.position.z);
    }
    toast(`Rally Cry! ${k} soldier${k === 1 ? '' : 's'} fight harder for ${CFG.RALLY_TIME}s`);
  }
  function ultimate() {
    if (dead || ultCd > 0) return;
    if (playerClass === 'commander') return rally();
    ultCd = CFG.ULT_CD * (playerClass === 'warrior' ? 0.8 : 1) * (hasPerk('warlord') ? 0.7 : 1) * 0.88 ** pl.st.ult; Snd.play('ult');
    gathering = null;
    const g = new THREE.Group();                                     // 360도 원반형 검기
    const m = new THREE.Mesh(ultGeo, new THREE.MeshBasicMaterial({ color: 0xffd54a, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; g.add(m);
    g.position.set(player.position.x, 0.12, player.position.z); g.userData.life = 0.3;
    scene.add(g); slashes.push(g);
    shake = 0.7;
    let n = 0;
    for (const e of enemies.slice()) {                               // 반경 내 모든 적: 방패병 포함(검 피해는 방패 무시), 강한 넉백
      if (e.userData.sinking) continue;
      if (Math.hypot(e.position.x - player.position.x, e.position.z - player.position.z) < CFG.ULT_RADIUS + e.userData.r) {
        const wasCasting = e.userData.castT > 0;
        hitEnemy(e, CFG.ULT_DAMAGE * pDmg(), player.position.x, player.position.z, true, CFG.ULT_KB, true); n++;
        if (wasCasting && enemies.includes(e)) stunBoss(e);          // 캐스팅 중 궁극기 적중 → 지진 취소 + 기절
      }
    }
    if (n) floatText(`WHIRLWIND x${n}!`, player.position.x, 2.8, player.position.z);
  }

  // ---------- 베헤모스: 예고 링 / 기절 ----------
  const teleDiscGeo = new THREE.CircleGeometry(5, 32), teleRingGeo = new THREE.RingGeometry(0.985, 1, 64);
  function showTelegraph(e) {
    const u = e.userData;
    if (u.tele) return;
    const g = new THREE.Group();
    const mk = (geo) => new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }));
    const disc = mk(teleDiscGeo), ring = mk(teleRingGeo);
    ring.scale.set(CFG.QUAKE_MAX, CFG.QUAKE_MAX, 1);
    disc.rotation.x = ring.rotation.x = -Math.PI / 2;
    g.add(disc, ring); g.position.set(e.position.x, 0.1, e.position.z);
    scene.add(g); u.tele = g;
  }
  function hideTelegraph(e) { const u = e.userData; if (u.tele) { scene.remove(u.tele); u.tele = null; } }
  function resetBossLook(e) { if (e.material.emissive) { e.material.emissive.setHex(0x000000); e.material.emissiveIntensity = 0; } e.material.color.setHex(0x0b0b0e); }
  function stunBoss(e) {
    const u = e.userData;
    u.castT = 0; u.slamT = 0; hideTelegraph(e);
    u.stunT = CFG.BOSS_STUN_TIME; u.slamCd = CFG.BOSS_SLAM_INTERVAL;
    e.position.y = u.baseY + (u.gy || 0);
    if (e.material.emissive) { e.material.emissive.setHex(0x000000); e.material.emissiveIntensity = 0; }
    e.material.color.setHex(0x8a8a92);                                           // 기절: 회색
    floatText('COUNTER! STUNNED!', e.position.x, e.position.y + 5.8, e.position.z);
    shake = Math.max(shake, 0.6);
  }
  function bossRecover(e) { resetBossLook(e); e.userData.slamCd = 2; }

  // ---------- 베헤모스 충격파 (지진 강타) ----------
  const shocks = [];
  const shockGeo = new THREE.RingGeometry(0.92, 1, 64);
  function shoveNpc(n, ux, uz, dist) {
    n.position.x += ux * dist; n.position.z += uz * dist;
    for (const o of obstacles) {
      const ox = n.position.x - o.position.x, oz = n.position.z - o.position.z, min = o.userData.radius + PLAYER_R, od = Math.hypot(ox, oz);
      if (od < min && od > 1e-4) { n.position.x = o.position.x + ox / od * min; n.position.z = o.position.z + oz / od * min; }
    }
    n.position.x = Math.max(-MAP + 1, Math.min(MAP - 1, n.position.x)); n.position.z = Math.max(-MAP + 1, Math.min(MAP - 1, n.position.z));
  }
  function spawnShockwave(x, z) {
    const m = new THREE.Mesh(shockGeo, new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.15, z); m.scale.set(0.1, 0.1, 1); sfxAt('boom', x, z);
    scene.add(m);
    shocks.push({ m, x, z, r: 0, hit: new Set() });
    burst({ x, z }, 24);
    if (Math.hypot(player.position.x - x, player.position.z - z) < 35) shake = Math.max(shake, 0.9);
  }
  function updateShocks(dt) {
    for (const s of shocks.slice()) {
      s.r += CFG.QUAKE_SPEED * dt;
      s.m.scale.set(s.r, s.r, 1);
      s.m.material.opacity = 0.8 * Math.max(0, 1 - s.r / CFG.QUAKE_MAX);
      const reach = (px, pz, pad = 0) => Math.hypot(px - s.x, pz - s.z) <= s.r + pad;
      for (const o of obstacles.slice()) {                                   // 충격파에 닿는 구조물: 거리가 멀수록 피해가 줄어든다
        if (o.userData.type === 'fence' && !s.hit.has(o) && reach(o.position.x, o.position.z)) {
          s.hit.add(o);
          const dd = Math.hypot(o.position.x - s.x, o.position.z - s.z);
          damageStructure(o, CFG.QUAKE_STRUCT_DMG * (1 - CFG.QUAKE_FALLOFF * Math.min(1, dd / CFG.QUAKE_MAX)));
        }
      }
      if (fireAlive && !s.hit.has('fire') && reach(0, 0)) { s.hit.add('fire'); fireHp -= CFG.QUAKE_FIRE_DMG * dm().dmg; if (fireHp <= 0) destroyFire(); }
      for (const n of npcs.slice()) {                                       // 동료/시민: 피해는 거의 없이 넉백만 (벽/건물/맵 밖으로 날아가지 않게 보정)
        if (n.down || s.hit.has(n) || !reach(n.position.x, n.position.z)) continue;
        s.hit.add(n);
        const dx = n.position.x - s.x, dz = n.position.z - s.z, d = Math.hypot(dx, dz) || 1;
        shoveNpc(n, dx / d, dz / d, CFG.QUAKE_NPC_KB);
        damageNpc(n, CFG.QUAKE_NPC_DMG);
      }
      if (!s.hit.has('player') && reach(player.position.x, player.position.z)) {
        s.hit.add('player');
        if (invincibleT <= 0) {                                              // 대시 무적이면 회피
          const dx = player.position.x - s.x, dz = player.position.z - s.z, d = Math.hypot(dx, dz) || 1;
          player.position.x += dx / d * CFG.QUAKE_KB; player.position.z += dz / d * CFG.QUAKE_KB;
          damage(CFG.QUAKE_PLAYER_DMG); shake = Math.max(shake, 0.6);
        }
      }
      if (s.r >= CFG.QUAKE_MAX) { scene.remove(s.m); s.m.material.dispose(); shocks.splice(shocks.indexOf(s), 1); }
    }
  }

