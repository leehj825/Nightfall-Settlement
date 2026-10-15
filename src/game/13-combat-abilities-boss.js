  // ---------- 플레이어 공격 ----------
  let atkT = 0, atkCd = 0, shake = 0;
  let tapTip = false; try { tapTip = !!localStorage.getItem('nf_tiptap'); } catch (e) {}
  // 지연 실행: 공격 애니메이션에서 칼이 휘둘러지는 순간(hitIn초 뒤)에 피해를 준다
  const delayed = [];
  const later = (t, fn) => delayed.push({ t: Number.isFinite(t) ? t : 0.25, fn });             // 시간 값이 없어도 (옛 캐시 파일 등) 반드시 실행되게 한다
  function tickDelayed(dt) { for (let i = delayed.length - 1; i >= 0; i--) { const d = delayed[i]; if ((d.t -= dt) <= 0) { delayed.splice(i, 1); try { d.fn(); } catch (e) { console.error(e); } } } }
  let atkLock = 0;                                                       // 근접 공격 동안 제자리에 서 있는다
  function attack() {
    if (!tapTip && !dead) { tapTip = true; try { localStorage.setItem('nf_tiptap', '1'); } catch (e) {} setTimeout(() => toast('Tip: use the red Attack button (or press F) to attack'), 600); }
    if (dead || atkCd > 0 || dashT > 0 || blocking) return;
    gathering = null;
    if (weaponMode === 'bow') {
      playerAnim.once('attackBow'); { const dur = playerAnim.shot.dur; atkCd = Math.max(ATK_CD, dur * 0.9); atkLock = dur * 0.9; }
      later(playerAnim.hitIn, () => { if (dead) return; shake = Math.max(shake, 0.08); Snd.play('bow'); fireArrow(player.position.x, player.position.z, facing, true, gearDef(playerGear.bow).dmg * pDmg() * (1 + 0.2 * pl.st.fletch)); });
      return;
    }
    if (weaponMode === 'spear') {                                      // 창: 좁은 부채꼴, 긴 사거리, 느린 연타. 줄지어 선 적을 한꺼번에 꿰뚫는다
      playerAnim.once('attackSpear'); const dur = playerAnim.shot.dur, slash = playerAnim.variant === 'slash', lunge = playerAnim.variant === 'lunge'; atkCd = Math.max(ATK_CD * 1.25, dur * 0.9); atkLock = dur * 0.9; Snd.play('swing');
      later(playerAnim.hitIn, () => {
        if (dead) return; const base = weaponDef('spear'), reach = 1 + 0.08 * pl.st.spear + 0.1 * pl.st.lunge, dm = base.dmg * pDmg() * (1 + 0.2 * pl.st.spear);
        atkT = SLASH_LIFE;
        if (slash) {                                                                                          // 휘둘러 베기: 앞쪽 넓은 부채꼴
          shake = 0.3; spawnSlash(player.position.x, player.position.z, facing, { ...base, slash: 1.5 });
          const hits = sectorHit(player.position.x, player.position.z, facing, true, { ...base, dmg: dm * 1.15, half: Math.PI / 2.6, rangeMul: 1.45 * reach, slash: 1.5 });
          if (hits >= 2) floatText(`SWEEP x${hits}!`, player.position.x + Math.sin(facing) * 2, 2.6, player.position.z + Math.cos(facing) * 2);
          return;
        }
        const sd = lunge ? { ...base, dmg: dm * 2.6 * (1 + 0.12 * pl.st.lunge), half: Math.PI / 8 * (1 + 0.12 * pl.st.impale), stun: 0.6 + 0.25 * pl.st.impale, rangeMul: 2.3 * reach, slash: (base.slash || 1) * 2.0, tier: 1 }       // 마지막 돌진 찌르기: 온몸을 실어 더 아프고 더 멀리, 기절까지
          : { ...base, dmg: dm * 1.25 * (1 + 0.12 * pl.st.lunge), half: Math.PI / 10 * (1 + 0.12 * pl.st.impale), stun: 0.25 * pl.st.impale, rangeMul: 1.9 * reach, slash: (base.slash || 1) * 1.6 };          // 찌르기: 좁고 아주 긴 사거리
        const sa = playerAnim.spearAim(), ang = sa === null ? facing : sa, so = playerAnim.spearOrigin() || [player.position.x, player.position.z];       // 찌르기 판정은 보이는 창끝이 가리키는 방향으로
        shake = lunge ? 0.55 : 0.2; spawnThrust(so[0], so[1], ang, ATK_RANGE * sd.rangeMul);
        const hits = sectorHit(so[0], so[1], ang, true, sd);
        if (lunge) floatText(hits >= 2 ? `FULL THRUST x${hits}!` : 'FULL THRUST!', player.position.x + Math.sin(facing) * 2, 2.8, player.position.z + Math.cos(facing) * 2);
        else if (hits >= 3) floatText(`PIERCE x${hits}!`, player.position.x + Math.sin(facing) * 2, 2.6, player.position.z + Math.cos(facing) * 2);
      });
      return;
    }
    const great = weaponMode === 'great';                                 // 대검: 느리지만 묵직하고 사거리가 길다, 네 번째는 제자리 회전 베기
    playerAnim.once('attackSword'); const dur = playerAnim.shot.dur, heavy = playerAnim.heavy;
    atkCd = Math.max(great ? ATK_CD * 1.3 : ATK_CD, dur * 0.92); atkLock = dur * 0.92; if (weaponMode !== 'none') Snd.play('swing');
    later(playerAnim.hitIn, () => {                                      // 칼이 휘둘러지는 순간에 베기 판정
      if (dead) return;
      const base = weaponDef(weaponMode), mulDps = (great ? 1.7 * (1 + 0.18 * pl.st.cleave) : playerAnim.rig.style === 'ss' ? 1.4 : weaponMode === 'none' ? (playerAnim.variant === 'kick' ? 0.6 : 0.45) : 1), gr = 1 + 0.06 * pl.st.cleave;           // 모션이 길어 공격 간격이 늘었으므로 한 방을 키워 초당 피해를 맞춘다
      atkT = SLASH_LIFE; shake = heavy ? 0.7 : 0.3;
      if (heavy) {                                                                                           // 점프 내려찍기: 착지 지점 주위 전방위
        if (weaponMode === 'none') impactFx(player.position.x, player.position.z, facing, 'round'); else spawnSlash(player.position.x, player.position.z, facing, { ...base, slash: great ? 1.8 : 1.5 }); Snd.play('boom', 0.6);
        const hits = sectorHit(player.position.x, player.position.z, facing, true, { ...base, dmg: base.dmg * pDmg() * (great ? 2.4 * (1 + 0.25 * pl.st.whirl) : weaponMode === 'none' ? 1.2 : 2.3), half: Math.PI, rangeMul: great ? 1.55 * gr * (1 + 0.08 * pl.st.whirl) : 1.35, slash: great ? 1.8 : 1.4, tier: 1 });
        const nm = weaponMode === 'none' ? 'KICK' : great ? 'SPIN' : 'SLAM'; floatText(hits ? `${nm} x${hits}!` : `${nm}!`, player.position.x, 2.8, player.position.z); return;
      }
      if (weaponMode === 'none') impactFx(player.position.x, player.position.z, facing, playerAnim.variant); else spawnSlash(player.position.x, player.position.z, facing, great ? { ...base, slash: 1.5 } : undefined);
      const hits = sectorHit(player.position.x, player.position.z, facing, true, great ? { ...base, dmg: base.dmg * pDmg() * mulDps, half: Math.PI / 2.3, rangeMul: 1.45 * gr, slash: 1.5 } : { ...base, dmg: base.dmg * pDmg() * mulDps });
      if (hits >= 2) { shake = Math.min(0.7, 0.3 + hits * 0.06); floatText(`CLEAVE x${hits}!`, player.position.x + Math.sin(facing) * 2, 2.6, player.position.z + Math.cos(facing) * 2); }
    });
  }

  // 맨손 타격 효과: 칼의 베기 궤적 대신, 주먹·발이 닿는 앞쪽 지점에서 작은 충격 먼지가 튄다 (돌려차기는 몸 둘레로 퍼진다)
  function impactFx(x, z, ang, kind) {
    sfxAt(kind === 'punch' ? 'punch' : 'kick', x, z);
    if (kind === 'round') { burst({ x, z }, 4); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + ang; burst({ x: x + Math.sin(a) * 1.3, z: z + Math.cos(a) * 1.3 }, 2); } return; }
    burst({ x: x + Math.sin(ang) * (kind === 'kick' ? 1.5 : 1.2), z: z + Math.cos(ang) * (kind === 'kick' ? 1.5 : 1.2) }, kind === 'kick' ? 5 : 3);
  }
  // 창 찌르기 궤적: 앞으로 쭉 뻗는 가늘고 긴 빛줄기
  const thrustGeo = new THREE.PlaneGeometry(0.34, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5);
  function spawnThrust(x, z, ang, len) {
    const g = new THREE.Group(), m = new THREE.Mesh(thrustGeo, new THREE.MeshBasicMaterial({ color: 0xdfe8ff, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }));
    m.scale.z = len; g.add(m); g.position.set(x, actorH(x, z) + 0.9, z); g.rotation.y = ang; g.userData.life = SLASH_LIFE * 1.3; scene.add(g); slashes.push(g);
  }
  const WEAPON_NAME = { sword: 'Sword', great: 'Great Sword', bow: 'Bow', spear: 'Spear', none: 'Unarmed' };
  function swapWeapon() {
    if (dead) return;
    playerAnim.breakCombo();
    weaponMode = weaponMode === 'sword' ? 'great' : weaponMode === 'great' ? 'bow' : weaponMode === 'bow' ? 'spear' : weaponMode === 'spear' ? 'none' : 'sword';
    playerRig.brawl = weaponMode === 'none'; playerRig.main = weaponMode; playerRig.style = weaponMode === 'sword' ? 'ss' : weaponMode === 'great' ? 'gs' : weaponMode === 'bow' ? 'bow' : '';
    document.getElementById('swapCur').textContent = `Q · ${WEAPON_NAME[weaponMode]}`;
    toast(weaponMode === 'none' ? 'Unarmed (normal movement, weak punches)' : weaponMode === 'great' ? 'Great sword equipped (two-handed, long reach, slow heavy cleaves and a spinning slash)' : weaponMode === 'bow' ? 'Bow equipped (ranged)' : weaponMode === 'spear' ? 'Spear equipped (long thrust, slower)' : 'Sword equipped (wide sweep)');
  }
  // 화살은 아군 구조물(obstacles)과 충돌 검사를 하지 않으므로 목책/성벽을 그대로 통과한다 (one-way wall).
  const arrows = [];
  const arrowGeo = new THREE.CylinderGeometry(0.045, 0.045, 1.6, 6), arrowTipGeo = new THREE.ConeGeometry(0.1, 0.28, 5), arrowTipMat = new THREE.MeshBasicMaterial({ color: 0xd8dde6 });
  const arrowMat = new THREE.MeshBasicMaterial({ color: 0x8a5a2b });
  function fireArrow(x, z, ang, byPlayer = false, dmg = null, y = 1.0, tdist = 0) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(arrowGeo, arrowMat);
    m.rotation.x = Math.PI / 2;                     // 원기둥 축을 진행(+Z) 방향으로 눕힘
    const tip = new THREE.Mesh(arrowTipGeo, arrowTipMat); tip.rotation.x = Math.PI / 2; tip.position.z = 0.9;     // 쇠 화살촉
    g.add(m, tip);
    const sx = Math.sin(ang), sz = Math.cos(ang);
    g.position.set(x + sx * 0.7, y, z + sz * 0.7);
    g.rotation.y = ang;
    g.userData = { vx: sx * CFG.ARROW_SPEED, vz: sz * CFG.ARROW_SPEED, dist: 0, byPlayer, dmg };
    if (tdist > 0 && y > 2) { const vy = (0.9 - y) / Math.max(0.2, tdist / CFG.ARROW_SPEED); g.userData.vy = vy; g.rotation.order = 'YXZ'; g.rotation.x = Math.atan2(-vy, CFG.ARROW_SPEED); }       // 높은 곳(탑)에서 쏜 화살은 표적을 향해 내려꽂힌다
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
      a.position.x += dx; a.position.z += dz; if (u.vy) { a.position.y += u.vy * dt; if (a.position.y < 0.05) { scene.remove(a); arrows.splice(arrows.indexOf(a), 1); continue; } }
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
    mark.rotation.x = -Math.PI / 2; mark.position.set(tx, groundY(tx, tz, 1.8) + 0.06, tz);      // 낙하 지점 경고 (대시로 피할 수 있다)
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
    f.rotation.x = -Math.PI / 2; g.add(f); g.position.set(x, groundY(x, z, 2) + 0.1, z); g.userData.life = SLASH_LIFE * 1.5;
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
  let dashBonusT = 0, dashT = 0, dashCd = 0, invincibleT = 0, dashDX = 0, dashDZ = 0;
  const dashDist = () => CFG.DASH_DIST * (1 + 0.15 * pl.st.evade);
  function jump() {                                                         // 점프: 제자리 뛰기 동작 (공격·채집 중에는 못 한다)
    if (dead || blocking || dashT > 0 || gathering || atkLock > 0) return;
    if (playerAnim.jump()) { atkCd = Math.max(atkCd, 0.25); Snd.play('dash', 0.4); }
  }
  function dash() {
    if (dead || dashCd > 0 || dashT > 0) return;
    if (performance.now() - lastMT < 350) { dashDX = lastMX; dashDZ = lastMZ; } else { dashDX = Math.sin(facing); dashDZ = Math.cos(facing); }          // 입력 방향으로 (입력이 없으면 정면)
    { const fx = Math.sin(facing), fz = Math.cos(facing), f = dashDX * fx + dashDZ * fz, sd = dashDX * fz - dashDZ * fx; playerAnim.dodge(f > 0.5 ? 'f' : f < -0.5 ? 'b' : sd > 0 ? 'p' : 'n'); }       // 이동 방향에 맞는 회피 동작
    atkLock = 0; dashT = CFG.DASH_TIME; dashCd = CFG.DASH_CD * dashMul(); invincibleT = CFG.DASH_INVULN + 0.04 * pl.st.evade; dashBonusT = pl.st.vault ? 1.2 : 0; Snd.play('dash');
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
    const need = o.userData.gatherTime || CFG.PLAYER_GATHER_TIME, prog = Math.min(1, g.t / need), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    gBg.visible = gFill.visible = true;
    { const gy = groundY(player.position.x, player.position.z, 0.9) + 0.04; gBg.position.set(player.position.x, gy, player.position.z); gFill.position.set(player.position.x - rx * 0.65, gy, player.position.z - rz * 0.65); }
    gFill.scale.set(Math.max(0.001, 1.3 * prog), 0.14, 1);
    if (g.t >= need) {
      scene.remove(o);
      if (o.userData.type === 'banditBanner') { exObjs.splice(exObjs.indexOf(o), 1); burnBanner(o); }
      else if (o.userData.type === 'chest') { exObjs.splice(exObjs.indexOf(o), 1); openChest(o); }
      else if (o.userData.type === 'siegeLadder') { exObjs.splice(exObjs.indexOf(o), 1); raiseLadder(o); }
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
    g.position.set(player.position.x, groundY(player.position.x, player.position.z, 3) + 0.12, player.position.z); g.userData.life = 0.45; scene.add(g); slashes.push(g);
    let k = 0;
    for (const n of npcs) {
      if (n.role === 'citizen' || n.down || (!inBanner(n) && Math.hypot(n.position.x - player.position.x, n.position.z - player.position.z) > CFG.RALLY_RADIUS)) continue;
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
    g.position.set(player.position.x, groundY(player.position.x, player.position.z, 3) + 0.12, player.position.z); g.userData.life = 0.3;
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
    g.add(disc, ring); g.position.set(e.position.x, groundY(e.position.x, e.position.z, 3) + 0.1, e.position.z);
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
    m.rotation.x = -Math.PI / 2; m.position.set(x, groundY(x, z, 2) + 0.15, z); m.scale.set(0.1, 0.1, 1); sfxAt('boom', x, z);
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

