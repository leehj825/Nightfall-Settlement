  // ---------- 원정(Expedition): 낮에 마을 밖의 별도 지역으로 떠나 자원·유물을 얻고 해 지기 전에 돌아온다 ----------
  const fmtH = (h) => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
  const exMeshes = [];
  const fadeEl = document.getElementById('fade');
  function fadeTo(fn) { fadeEl.style.opacity = 1; setTimeout(() => { fn(); fadeEl.style.opacity = 0; }, 380); }
  const oreMat = mat(0x4a3f4c), chestWood = mat(0x7a4f2a), chestGold = new THREE.MeshBasicMaterial({ color: 0xffd45a }), chestBand = mat(0xb9892a), ruinMat = mat(0x7d7f86), flagMat = mat(0xc0392b);
  const exAdd = (m, solid) => { scene.add(m); (solid ? exObjs : exMeshes).push(m); return m; };
  function makeChest(x, z, relic) {
    const gr = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.7), chestWood); body.position.y = 0.3;
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.22, 0.74), relic ? chestGold : chestBand); lid.position.y = 0.7;
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.64, 0.74), chestBand); band.position.y = 0.32;
    gr.add(body, lid, band); gr.traverse(m => { if (m.isMesh) m.castShadow = true; });
    gr.position.set(x, 0, z); gr.rotation.y = rand(0, 6.28);
    gr.userData = { type: 'chest', radius: 0.9, relic: !!relic };
    const col = relic ? 0xffe27a : 0xffc060;                                         // 상자: 멀리서도 보이는 빛기둥 + 빛무리
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.26, 22, 10, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    beam.position.y = 11; gr.add(beam); exBeams.push(beam); addGlow(gr, col, relic ? 3.2 : 2.2, 0.8);
    return exAdd(gr, true);
  }
  const glowCache = new Map();
  function addGlow(parent, color, scale, y) {                    // 어두운 곳에서도 보이는 빛무리 (추가 조명 없이 스프라이트만 사용)
    let m = glowCache.get(color);
    if (!m) { m = new THREE.SpriteMaterial({ map: smokeTex, color, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }); glowCache.set(color, m); }
    const s = new THREE.Sprite(m); s.scale.setScalar(scale); s.position.y = y; parent.add(s); return s;
  }
  const exBeams = [], FOE_GLOW = { frost: 0x8fd0ff, hollow: 0xb08cff, wisp: 0x7affd0, ash: 0xffa060 };
  const FACTION_COLOR = { frost: new THREE.Color(0x9fd6ff), hollow: new THREE.Color(0xb08cff), night: new THREE.Color(0x6f7cff), wisp: new THREE.Color(0x7affd0), ash: new THREE.Color(0xff9a5a) };
  function frostTint(e, faction = 'frost') {                        // 서리 세력: 몸 재질을 복제해 푸르게 물들인다 (공유 재질은 건드리지 않는다)
    const map = new Map();
    e.traverse(o => { if (o.isMesh && o.material && o.material.color && !o.material.isMeshBasicMaterial) { let c = map.get(o.material); if (!c) { c = o.material.clone(); c.skinning = o.material.skinning; c.color.lerp(FACTION_COLOR[faction] || FACTION_COLOR.frost, 0.55); map.set(o.material, c); } o.material = c; } });
    if (map.has(e.material)) e.material = map.get(e.material);
  }
  // ---------- 산적 야영지 (습격 Raid): 목책 · 문 · 감시탑 · 천막 · 모닥불 · 우두머리 천막. 목책은 막히는 지형 (적의 길 막힘은 다음 단계) ----------
  const campWood = mat(0x6b4a2a), campDark = mat(0x3f2a1a), campTent = [mat(0xa08358), mat(0x8a5a44), mat(0x7a7048)], campRed = mat(0x6a1c1c);
  let exCamp = null;                                                // { cx, cz, R, banner, fire }: 현재 습격 지역의 야영지 정보
  function buildBanditCamp(d, cx, cz, inner) {
    const C = d.camp, R = C.radius, gateA = -Math.PI / 2, segs = Math.round(2 * Math.PI * R / 2.6), step = Math.PI * 2 / segs;
    const solids = [], stake = new THREE.ConeGeometry(0.3, 0.8, 4), plank = new THREE.BoxGeometry(2.7, 2.2, 0.45);
    for (let i = 0; i < segs; i++) {                                // 목책: 남쪽(입구 쪽)에 문 틈을 남기고 빙 둘러 세운다
      const a = i * step; let ad = a - (gateA + Math.PI * 2); ad = Math.atan2(Math.sin(ad), Math.cos(ad));
      if (Math.abs(ad) < step * 1.6) continue;
      const g = new THREE.Group(), body = new THREE.Mesh(plank, campWood); body.position.y = 1.1;
      for (const o of [-0.95, 0, 0.95]) { const s = new THREE.Mesh(stake, campDark); s.position.set(o, 2.6, 0); g.add(s); }
      g.add(body); g.traverse(m => { if (m.isMesh) m.castShadow = true; });
      g.position.set(cx + Math.cos(a) * R, 0, cz + Math.sin(a) * R); g.rotation.y = -a - Math.PI / 2; g.userData = { type: 'palisade', radius: 1.45, wall: true };
      exAdd(g, true); solids.push(g);
    }
    for (const s of [-1, 1]) {                                      // 문기둥: 높은 기둥 두 개와 붉은 천
      const a = gateA + s * step * 1.9, g = new THREE.Group(), pole = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 5, 7), campDark), cloth = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.3, 0.06), campRed);
      pole.position.y = 2.5; cloth.position.set(0.55, 4.1, 0); g.add(pole, cloth); g.position.set(cx + Math.cos(a) * R, 0, cz + Math.sin(a) * R); g.userData = { type: 'gatepost', radius: 0.5 }; exAdd(g, true);
    }
    const towers = [];
    for (let k = 0; k < C.towers; k++) {                            // 감시탑: 네 모서리 (망루 위 궁수 배치는 다음 단계)
      const a = Math.PI / 4 + k * (Math.PI * 2 / C.towers), g = new THREE.Group();
      for (const [lx, lz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 5.2, 6), campWood); leg.position.set(lx, 2.6, lz); g.add(leg); }
      const deck = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.25, 2.6), campWood); deck.position.y = 5.2;
      const rail = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 2.6), campDark); rail.position.y = 5.6; rail.scale.set(1, 1, 1);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.1, 1.3, 4), campTent[1]); roof.position.y = 7; roof.rotation.y = Math.PI / 4;
      g.add(deck, rail, roof); g.traverse(m => { if (m.isMesh) m.castShadow = true; });
      g.position.set(cx + Math.cos(a) * (R - 0.2), 0, cz + Math.sin(a) * (R - 0.2)); g.userData = { type: 'campTower', radius: 1.7 }; exAdd(g, true); towers.push(g); solids.push(g);
      inner.push({ x: g.position.x, z: g.position.z, r: 3 });
    }
    for (let k = 0; k < C.tents; k++) {                             // 천막: 안쪽 둘레에 빙 둘러
      const a = k * (Math.PI * 2 / C.tents) + 0.4; if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.5) continue;       // 우두머리 천막 자리는 비운다
      const rr = R * 0.62, g = new THREE.Group(), t = new THREE.Mesh(new THREE.ConeGeometry(1.9, 2.5, 6), campTent[k % 3]);
      t.position.y = 1.25; g.add(t); g.traverse(m => { if (m.isMesh) m.castShadow = true; });
      g.position.set(cx + Math.cos(a) * rr, 0, cz + Math.sin(a) * rr); g.rotation.y = rand(0, 6); g.userData = { type: 'tent', radius: 1.8 }; exAdd(g, true); solids.push(g);
      inner.push({ x: g.position.x, z: g.position.z, r: 2.4 });
    }
    { const g = new THREE.Group(), t = new THREE.Mesh(new THREE.ConeGeometry(2.9, 3.4, 7), campRed);     // 우두머리 천막: 더 크고 붉다
      t.position.y = 1.7; g.add(t); g.traverse(m => { if (m.isMesh) m.castShadow = true; }); g.position.set(cx, 0, cz + R * 0.5); g.userData = { type: 'tent', radius: 2.6 }; exAdd(g, true); inner.push({ x: cx, z: cz + R * 0.5, r: 3.6 }); }
    const fire = new THREE.Group();                                  // 가운데 모닥불
    for (let k = 0; k < 3; k++) { const l = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.2, 0.2), campDark); l.position.y = 0.12; l.rotation.y = k * 1.05; fire.add(l); }
    addGlow(fire, 0xff8a3a, 5, 1.0); fire.position.set(cx, 0, cz); fire.userData = { type: 'campfire', radius: 0.8 }; exAdd(fire, true); inner.push({ x: cx, z: cz, r: 2 });
    const banner = new THREE.Group(), bp = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 5.5, 6), campDark), bc = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 0.06), campRed);   // 산적 깃발 (다음 단계의 목표물)
    bp.position.y = 2.75; bc.position.set(0.85, 4.8, 0); banner.add(bp, bc); banner.position.set(cx + 3.2, 0, cz - 1.5); banner.userData = { type: 'banditBanner', radius: 0.5, gatherTime: 3 }; exAdd(banner, true); inner.push({ x: cx + 3.2, z: cz - 1.5, r: 1.5 });
    for (let k = 0; k < C.chests; k++) { const a = k * 2.1 + 1.0, p = { x: cx + Math.cos(a) * R * 0.34, z: cz + Math.sin(a) * R * 0.34 }; makeChest(p.x, p.z, false); inner.push({ x: p.x, z: p.z, r: 1.6 }); }
    return { cx, cz, R, towers, banner, fire, solids, alarm: false, broken: false };
  }
  function buildZone(d) {
    const geo = new THREE.CircleGeometry(46, 40); geo.rotateX(-Math.PI / 2);
    const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: d.tint, flatShading: true, roughness: 1 }));
    ground.position.set(EXC.x, 0.02, EXC.z); ground.receiveShadow = true; exAdd(ground, false);
    for (let i = 0; i < 26; i++) {                                   // 지역 테두리: 큰 바위들
      const a = i / 26 * Math.PI * 2, s = rand(1.4, 2.4), r = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rockMat);
      r.position.set(EXC.x + Math.cos(a) * 44, s * 0.5, EXC.z + Math.sin(a) * 44); r.castShadow = true; exAdd(r, false);
    }
    const flag = new THREE.Group();                                   // 귀환 깃발 (입구)
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4, 6), lampPostMat); pole.position.y = 2;
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.8, 0.05), flagMat); cloth.position.set(0.7, 3.5, 0);
    flag.add(pole, cloth); flag.position.set(EXC.x, 0, EXC.z - 36); exAdd(flag, false);
    const taken = [{ x: EXC.x, z: EXC.z - 34, r: 7 }];
    const spot = (rad) => {                                           // 겹치지 않는 위치 찾기
      for (let k = 0; k < 40; k++) {
        const a = rand(0, 6.28), rr = Math.sqrt(Math.random()) * 38, x = EXC.x + Math.cos(a) * rr, z = EXC.z + Math.sin(a) * rr;
        if (taken.every(t => Math.hypot(x - t.x, z - t.z) > t.r + rad)) { taken.push({ x, z, r: rad }); return { x, z }; }
      }
      return { x: EXC.x + rand(-30, 30), z: EXC.z + rand(-20, 30) };
    };
    exCamp = null; const inner = [];
    if (d.camp) { const cx = EXC.x, cz = EXC.z + 6; exCamp = buildBanditCamp(d, cx, cz, inner); taken.push({ x: cx, z: cz, r: d.camp.radius + 2.5 }); }
    const innerSpot = (rad) => {                                      // 야영지 안쪽의 빈 자리
      const C = exCamp; if (!C) return spot(rad);
      for (let k = 0; k < 40; k++) {
        const a = rand(0, 6.28), rr = Math.sqrt(Math.random()) * (C.R - 3.5), x = C.cx + Math.cos(a) * rr, z = C.cz + Math.sin(a) * rr;
        if (inner.every(t => Math.hypot(x - t.x, z - t.z) > t.r + rad)) { inner.push({ x, z, r: rad }); return { x, z }; }
      }
      return spot(rad);
    };
    for (let i = 0; i < d.trees; i++) { const o = makeTree(), p = spot(1.8); o.position.set(p.x, 0, p.z); exAdd(o, true); }
    for (let i = 0; i < d.rocks; i++) { const o = makeRock(), p = spot(1.6); o.position.set(p.x, 0, p.z); exAdd(o, true); }
    for (let i = 0; i < d.ore; i++) {
      const o = makeRock(), p = spot(1.8); o.scale.setScalar(1.25); o.userData.radius *= 1.25; o.userData.ore = true;
      o.traverse(m => { if (m.isMesh) m.material = oreMat; });
      o.position.set(p.x, 0, p.z); exAdd(o, true);
    }
    for (let i = 0; i < (d.ruins || 0); i++) {                        // 폐허 기둥: 막히는 지형
      const h = rand(1.6, 4), p = spot(1.6), m = new THREE.Mesh(new THREE.BoxGeometry(rand(0.8, 1.3), h, rand(0.8, 1.3)), ruinMat);
      m.position.set(p.x, h / 2, p.z); m.rotation.y = rand(0, 3); m.castShadow = m.receiveShadow = true; m.userData = { type: 'ruin', radius: 0.9 }; exAdd(m, true);
    }
    for (let i = 0; i < d.chests; i++) { const p = spot(2.2); makeChest(p.x, p.z, !!d.relic && i === d.chests - 1); }
    const foeList = d.foes.slice(); for (let i = Math.round(d.foes.length * (dm().n - 1)); i > 0; i--) foeList.push(d.foes[Math.floor(Math.random() * d.foes.length)]);
    let fi = 0;
    for (const kind of foeList) { const inside = exCamp && fi++ % 4 !== 3, p = inside ? innerSpot(1.4) : spot(2.5); spawnEnemy(kind, p); if (inside) { enemies[enemies.length - 1].userData.camp = true; enemies[enemies.length - 1].userData.home = { x: p.x, z: p.z }; } if (d.faction) frostTint(enemies[enemies.length - 1], d.faction); addGlow(enemies[enemies.length - 1], FOE_GLOW[d.faction] || 0xff6a4a, 1.7, 1.2); }
    if (exCamp && d.camp.towerArchers) for (let k = 0; k < d.camp.towerArchers; k++) {          // 망루 위 궁수: 마주 보는 탑 둘에 올라간다
      const t = exCamp.towers[Math.floor(k * exCamp.towers.length / d.camp.towerArchers) % exCamp.towers.length]; spawnEnemy('archer', { x: t.position.x, z: t.position.z });
      const e = enemies[enemies.length - 1], u = e.userData; u.tower = true; u.camp = true; u.baseY = 5.4; e.position.y = 5.4; u.speed = 0;
    }
    if (d.guardian) {                                                 // 수호자: 커다랗고 단단한 우두머리. 쓰러뜨리면 보상 상자가 나온다
      const p = exCamp ? { x: exCamp.cx - 2, z: exCamp.cz + exCamp.R * 0.3 } : spot(4); spawnEnemy(d.guardian.kind, p);
      const e = enemies[enemies.length - 1], u = e.userData, s = d.guardian.scale; if (exCamp) { u.camp = true; u.home = { x: p.x, z: p.z }; }
      u.hp *= d.guardian.hpMul; u.maxHp = u.hp; u.guardian = true; u.contact *= 1.3; u.r *= s; u.baseY *= s;
      e.scale.multiplyScalar(s); e.position.y = u.baseY;
      if (d.faction) frostTint(e, d.faction);
      addGlow(e, 0xffd45a, 3.4, 1.4);
      const lbl = textSprite(d.guardian.name || 'Guardian', '#ffcf5a', 1.5, 0.5, 'bold 56px sans-serif'); lbl.position.set(0, 2.5, 0); e.add(lbl);
    }
  }
  function cleanupZone() {
    for (const o of exMeshes.concat(exObjs)) scene.remove(o);
    exMeshes.length = 0; exObjs.length = 0; exBeams.length = 0; exCamp = null;
    for (const e of enemies.slice()) if (e.userData.ex) removeEnemy(e);
  }
  function exEnemyStep(e, u, dt) {
    const px = player.position.x - e.position.x, pz = player.position.z - e.position.z, pd = Math.hypot(px, pz);
    let tx = player.position.x, tz = player.position.z, td = pd, tn = null, near = pd;           // 가장 가까운 상대: 플레이어 또는 동행 병사
    for (const n of npcs) if (n.escort && !n.down) {
      const d = Math.hypot(n.position.x - e.position.x, n.position.z - e.position.z);
      if (d < near) near = d;
      if (d < td - 1.5 && d < 10) { td = d; tx = n.position.x; tz = n.position.z; tn = n; }
    }
    const C = exCamp;
    if (u.tower) {                                                            // 망루 궁수: 제자리에서 사거리 안의 상대를 쏜다
      u.atkAnimCd -= dt; u.anim.base('idle', 0);
      if (near < 22 && !(C && C.broken) && !(u.stunT > 0)) { e.lookAt(tx, e.position.y, tz); u.range = 20; archerStep(e, u, dt); }
      return;
    }
    if (C && u.camp && u.hp < (u.hpPrev ?? u.hp)) campAlarm();                // 맞으면 경보
    u.hpPrev = u.hp;
    if (C && u.camp) {                                                        // 야영지 병사: 가까이 오거나 경보가 울리면 달려들고, 아니면 자리를 지킨다
      const was = u.aggro;
      u.aggro = C.broken ? false : (u.aggro ? near < 26 : near < (C.alarm ? 32 : 12));
      if (u.aggro && !was) campAlarm();
    } else u.aggro = exActive ? (u.aggro ? near < 24 : near < 13) : false;
    let moving = false; u.escortCd = (u.escortCd || 0) - dt;
    if (u.kbT > 0) { u.kbT -= dt; e.position.x += u.kbVx * dt; e.position.z += u.kbVz * dt; }
    else if (u.aggro && td > 0.9 && !(u.stunT > 0)) {
      const r = campRoute(e.position.x, e.position.z, tx, tz), rd = Math.max(0.01, Math.hypot(r.x - e.position.x, r.z - e.position.z));
      e.position.x += (r.x - e.position.x) / rd * u.speed * dt; e.position.z += (r.z - e.position.z) / rd * u.speed * dt; e.lookAt(r.x, e.position.y, r.z); moving = true;
    } else if (C && u.camp && u.home && !u.aggro && !(u.stunT > 0)) {         // 자리로 돌아간다 (문을 거쳐서)
      const r = campRoute(e.position.x, e.position.z, u.home.x, u.home.z), hd = Math.hypot(u.home.x - e.position.x, u.home.z - e.position.z);
      if (hd > 1.0) { const rd = Math.max(0.01, Math.hypot(r.x - e.position.x, r.z - e.position.z)); e.position.x += (r.x - e.position.x) / rd * u.speed * 0.8 * dt; e.position.z += (r.z - e.position.z) / rd * u.speed * 0.8 * dt; e.lookAt(r.x, e.position.y, r.z); moving = true; }
    }
    if (C) exPush(e, u.r);
    if (u.archer && u.aggro) { u.range = 14; archerStep(e, u, dt); }
    const dx = e.position.x - EXC.x, dz = e.position.z - EXC.z, dd = Math.hypot(dx, dz);
    if (dd > 42) { e.position.x = EXC.x + dx / dd * 42; e.position.z = EXC.z + dz / dd * 42; }
    u.anim.base(moving ? 'walk' : 'idle', u.speed); u.atkAnimCd -= dt;
    if (td < (tn ? 0.45 : PLAYER_R) + u.r + 0.15) {
      if (tn) { if (u.escortCd <= 0 && !(u.stunT > 0)) { u.escortCd = 0.9; damageEscort(tn, u.contact * 0.7); } }
      else if (hurtCd <= 0 && !(u.stunT > 0)) { damage(u.contact); hurtCd = 0.8; shake = Math.max(shake, 0.15); }
      if (u.atkAnimCd <= 0) { u.atkAnimCd = 0.9; u.anim.once('attackSword'); }
    }
  }
  // ---------- 10단계: 동행 병사 (원정에 함께 간 병사는 플레이어를 따라다니며 원정 지역의 적과 싸운다. 쓰러져도 영구 사망하지 않고 집으로 옮겨진다) ----------
  function damageEscort(n, dmg) {
    if (n.down) return;
    n.hp = Math.max(0, n.hp - Math.max(1, Math.round(dmg * dm().dmg * (1 - gearDef(n.gear.armor).reduce) * standardMods(n).guard * (TR(n).dmg || 1))));
    if (n.hp <= 0) { n.down = true; n.mat.color.set(0x777777); n.anim.die(); grieve(); toast(`${n.name} is down - they will be carried home`); }
  }
  // ---------- 야영지 행동: 목책 때문에 안팎을 오갈 때는 남쪽 문을 거친다 / 목책·탑·천막은 적도 뚫지 못한다 / 경보 / 우두머리를 쓰러뜨리면 야영지가 무너진다 ----------
  function campRoute(x, z, tx, tz) {
    const C = exCamp; if (!C) return { x: tx, z: tz };
    const inA = Math.hypot(x - C.cx, z - C.cz) < C.R - 0.5, inB = Math.hypot(tx - C.cx, tz - C.cz) < C.R - 0.5;
    if (inA === inB) return { x: tx, z: tz };
    const gx = C.cx, gz = C.cz - C.R;
    if (Math.hypot(gx - x, gz - z) < 1.8) return inA ? { x: gx, z: gz - 5 } : { x: gx, z: gz + 5 };       // 문을 지나는 중이면 그 너머를 향한다
    return { x: gx, z: gz };
  }
  function exPush(e, r) {
    const C = exCamp; if (!C) return;
    for (const o of C.solids) {
      const dx = e.position.x - o.position.x, dz = e.position.z - o.position.z, m = o.userData.radius + r * 0.7, d = Math.hypot(dx, dz);
      if (d < m && d > 1e-4) { e.position.x = o.position.x + dx / d * m; e.position.z = o.position.z + dz / d * m; }
    }
  }
  function campAlarm() { const C = exCamp; if (!C || C.alarm || C.broken) return; C.alarm = true; toast('The camp sounds the alarm!'); Snd.play('horn'); }
  function campRelief() { const fx = story.campFx || [], d = dayNow(), held = story.holds || {}, ids = new Set(fx.filter(x => d <= x.until).map(x => x.id).concat(Object.keys(held))); return Math.min(CFG.CAMP_RELIEF_MAX, [...ids].reduce((a, id) => a + (CFG.CAMP_RELIEF[id] ? CFG.CAMP_RELIEF[id].pct : 0), 0)); }       // 점령지는 기한 없이 계속
  function campReliefTxt(id) { if (holdOf(id)) return ''; const x = (story.campFx || []).find(f => f.id === id), r = CFG.CAMP_RELIEF[id]; return x && r && dayNow() <= x.until ? ` · Camp broken: raids on the village ${Math.round(r.pct * 100)}% smaller until day ${x.until}` : ''; }
  function burnBanner(o) {                                                  // 산적 깃발을 불태우면 야영지가 사기를 잃는다 (우두머리를 쓰러뜨리는 것의 다른 길)
    const f = new THREE.Group(); addGlow(f, 0xff7a2a, 6, 3.5); f.position.set(o.position.x, 0, o.position.z); exAdd(f, false); campBroken(o, 'banner');
  }
  function campBroken(e, how) {
    const C = exCamp; if (!C || C.broken) return; C.broken = true;
    const fi = how === 'banner' ? 4 : 8, fo = how === 'banner' ? 3 : 6; res.iron += fi; res.food += fo; updateHud(); giveXp(how === 'banner' ? 40 : 60);
    const id = exActive && exActive.dest.id, rf = CFG.CAMP_RELIEF[id];
    if (rf) { story.campFx = (story.campFx || []).filter(x => x.id !== id).concat({ id, until: dayNow() + rf.days }); }
    toast(`${how === 'banner' ? 'The banner burns - the camp loses heart!' : 'The chief has fallen - the camp is broken!'} +${fi} Iron, +${fo} Food${rf ? `. Raids on your village will be ${Math.round(Math.min(CFG.CAMP_RELIEF_MAX, campRelief()) * 100)}% smaller for ${rf.days} days` : ''}`); Snd.play('victory'); shake = Math.max(shake, 0.6);
    floatText('CAMP BROKEN!', e.position.x, 3.6, e.position.z);
  }
  function exMove(n, tx, tz, speed, dt) {          // 원정 지역용 단순 이동: 장애물 밀어내기 + 지역 경계
    if (exCamp) { const r = campRoute(n.position.x, n.position.z, tx, tz); tx = r.x; tz = r.z; }
    const dx = tx - n.position.x, dz = tz - n.position.z, d = Math.hypot(dx, dz);
    if (d < 0.05) return d;
    const st = Math.min(d, speed * moveMul(n) * dt);
    n.position.x += dx / d * st; n.position.z += dz / d * st; n.face = Math.atan2(dx, dz); n.rotation.y = n.face;
    for (const o of exObjs) {
      const ox = n.position.x - o.position.x, oz = n.position.z - o.position.z, m = o.userData.radius + 0.45, od = Math.hypot(ox, oz);
      if (od < m && od > 1e-4) { n.position.x = o.position.x + ox / od * m; n.position.z = o.position.z + oz / od * m; }
    }
    const cx = n.position.x - EXC.x, cz = n.position.z - EXC.z, cd = Math.hypot(cx, cz);
    if (cd > 41) { n.position.x = EXC.x + cx / cd * 41; n.position.z = EXC.z + cz / cd * 41; }
    return d;
  }
  function escortStep(dt) {
    const n = npc;
    if (n.down) { setLabel('Down'); n.anim.base('idle', 0); n.stateNow = 'Down'; return; }
    n.atkCd -= dt;
    if (n.cls === 'medic' && n.role === 'melee') medicTick(dt);                                // 원정 중에도 치료사는 주변 아군과 주인공을 치료한다
    const ord = orderOf(n);                                                                     // 명령: Stand firm 은 그 자리를 지킨다, Withdraw 는 근접병이 싸우지 않고 곁에 붙는다, Charge 는 멀리서 달려든다
    if (ord === 'stand') { if (!n.hold) n.hold = { x: n.position.x, z: n.position.z }; } else n.hold = null;
    let foe = null, bd = ord === 'charge' ? 26 : ord === 'stand' ? 9 : 16;
    for (const e of enemies) {
      if (ord === 'withdraw' && n.role === 'melee') break;
      if (!e.userData.ex || e.userData.sinking || e.userData.dying > 0) continue;
      const o0 = n.hold || n.position, d = Math.hypot(e.position.x - o0.x, e.position.z - o0.z);
      if (d < bd) { bd = d; foe = e; }
    }
    if (markedFoe && markedFoe.userData.ex && !(ord === 'withdraw' && n.role === 'melee')) {            // 표시된 적을 먼저 노린다 (Stand firm 은 지키는 자리 근처일 때만)
      const o1 = n.hold || n.position, md = Math.hypot(markedFoe.position.x - o1.x, markedFoe.position.z - o1.z);
      if (ord !== 'stand' || md < 9) { foe = markedFoe; bd = md; }
    }
    if (foe && n.hold) bd = Math.hypot(foe.position.x - n.position.x, foe.position.z - n.position.z);
    let state = ord === 'withdraw' ? 'Falling back' : 'Escorting';
    if (foe) {
      state = 'Fighting';
      if (n.role === 'melee') {
        if (bd > 1.7) exMove(n, foe.position.x, foe.position.z, ord === 'charge' ? 6 : 5.2, dt);
        else { n.face = Math.atan2(foe.position.x - n.position.x, foe.position.z - n.position.z); n.rotation.y = n.face; if (n.atkCd <= 0) soldierStrike(foe); }
      } else {
        if (bd > 9) exMove(n, foe.position.x, foe.position.z, 4.5, dt);
        else if (bd < 4) exMove(n, n.position.x * 2 - foe.position.x, n.position.z * 2 - foe.position.z, 4.5, dt);
        if (bd <= 11) soldierShoot(foe);
      }
    } else if (n.hold) {
      if (Math.hypot(n.hold.x - n.position.x, n.hold.z - n.position.z) > 0.6) exMove(n, n.hold.x, n.hold.z, 5, dt);       // 지킬 자리로 돌아온다
    } else {
      const k = npcs.filter(x => x.escort).indexOf(n), a = facing + Math.PI + ((k % 6) - 2.5) * 0.7, rr = 2.6 + Math.floor(k / 6) * 1.6, tx = player.position.x + Math.sin(a) * rr, tz = player.position.z + Math.cos(a) * rr;
      const d = Math.hypot(tx - n.position.x, tz - n.position.z);
      if (d > 1.2) exMove(n, tx, tz, d > 8 ? 8 : 5, dt);
    }
    const mv = Math.hypot(n.position.x - n.px, n.position.z - n.pz) / Math.max(dt, 1e-4); n.px = n.position.x; n.pz = n.position.z;
    n.rig.combat = true; n.rig.sheathe(false);                                                // 원정 중에는 항상 전투 자세 이동
    n.anim.base(mv > 4.4 ? 'run' : mv > 0.5 ? 'walk' : 'idle', mv);
    n.stateNow = state; setLabel(state);
  }
  function openChest(o) {
    const d = exActive.dest, tier = d.age, picks = [['wood', 10 + tier * 4, 'Wood'], ['stone', 8 + tier * 4, 'Stone'], ['iron', 2 + tier * 2, 'Iron'], ['food', 6 + tier * 3, 'Food']].sort(() => Math.random() - 0.5).slice(0, 2);
    picks.forEach(([k, n, nm], i) => { res[k] += n; floatText(`+${n} ${nm}`, o.position.x, 2.0 + i * 0.5, o.position.z); });
    if (d.ch >= 2) { const k = 1 + (o.userData.relic ? 2 : 0); res.shard += k; floatText(`+${k} Shard`, o.position.x, 2.9, o.position.z); }
    burst({ x: o.position.x, z: o.position.z, y: 1 }, 16); Snd.play('chest'); updateHud(); giveXp((8 + 4 * d.age) * (d.night ? 2 : 1)); if (d.night && story.beacon) { res.shard++; floatText('+1 Shard', o.position.x, 3.3, o.position.z); }
    if (o.userData.relic) foundRelic(d);
  }

  // ---------- 이야기 ----------
  const story = { stats: [], roads: [], relics: {}, said: {}, log: [], intro: false, exps: 0, beacon: false, dawn: false, crown: false, hollow: false, finale: false, road: false, wide: false, eclipse: false, dusk: false, champs: 0, camps: {}, cleared: {}, tales: {}, taleDay: 0, ms: {}, campFx: [], holds: {}, clearedDay: {} };
  const storyChain = () => CFG.STORY.concat(story.beacon ? CFG.STORY2 : []).concat(story.dawn ? CFG.STORY3 : []).concat(story.hollow ? CFG.STORY4 : []).concat(story.road ? CFG.STORY5 : []).concat(story.eclipse ? CFG.STORY6 : []);
  let beaconMesh = null;
  function setBeacon(on) {
    if (on && !beaconMesh) {
      beaconMesh = new THREE.Group();
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.2, 40, 14, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      beam.position.y = 20; beaconMesh.add(beam);
      const glow = new THREE.PointLight(0xffd070, 1.6, 40, 1.4); glow.position.y = 6; beaconMesh.add(glow);
      scene.add(beaconMesh);
    }
    if (beaconMesh) beaconMesh.visible = on;
    story.beacon = on;
  }
  const storyDone = (id) => id === 'first' ? story.exps >= 1 : !!story.relics[id];
  function storyDialog(title, text) { openEvent({ tag: 'Story', title, text, opts: [{ label: 'Continue', run: () => '' }] }); }
  function checkStory() {
    for (const s of storyChain()) {
      if (!storyDone(s.id) || story.said[s.id]) continue;
      story.said[s.id] = true; story.log.push(`${s.title}: ${s.text}`);
      for (const [k, v] of Object.entries(s.reward)) res[k] += v;
      updateHud(); storyDialog(s.title, `${s.text}\n\nReward: ${costText(s.reward)}`);
    }
    if (!story.beacon && CFG.STORY.every(s => storyDone(s.id))) {
      setBeacon(true); story.log.push(`${CFG.STORY_BEACON.title}: ${CFG.STORY_BEACON.text}`);
      storyDialog(CFG.STORY_BEACON.title, CFG.STORY_BEACON.text); shake = Math.max(shake, 0.5); Snd.play('horn');
    }
    if (story.beacon && !story.dawn && CFG.STORY2.every(s => storyDone(s.id))) {
      story.dawn = true; story.log.push(`${CFG.STORY_DAWN.title}: ${CFG.STORY_DAWN.text}`);
      storyDialog(CFG.STORY_DAWN.title, CFG.STORY_DAWN.text); shake = Math.max(shake, 0.6); Snd.play('horn');
      if (beaconMesh) beaconMesh.children[0].material.opacity = 0.4;
    }
    if (story.crown && !story.hollow) {
      story.hollow = true; story.log.push(`${CFG.STORY_HOLLOW.title}: ${CFG.STORY_HOLLOW.text}`);
      storyDialog(CFG.STORY_HOLLOW.title, CFG.STORY_HOLLOW.text); shake = Math.max(shake, 0.4); Snd.play('horn');
    }
    if (story.hollow && !story.finale && CFG.STORY4.every(s => storyDone(s.id))) {
      story.finale = true; story.log.push(`${CFG.STORY_FINALE.title}: ${CFG.STORY_FINALE.text}`);
      storyDialog(CFG.STORY_FINALE.title, CFG.STORY_FINALE.text); shake = Math.max(shake, 0.6); Snd.play('horn');
      if (beaconMesh) { beaconMesh.children[0].material.opacity = 0.55; }
      try { localStorage.setItem('nf_carry', JSON.stringify({ ng: ngLevel + 1, lvl: pl.lvl, st: { ...pl.st } })); } catch (e) {} setTimeout(() => toast('New Game+ unlocked: start a new game to carry your level into a tougher world'), 3000);
    }
    if (story.finale && !story.road) {
      story.road = true; story.log.push(`${CFG.STORY_ROAD.title}: ${CFG.STORY_ROAD.text}`);
      setTimeout(() => storyDialog(CFG.STORY_ROAD.title, CFG.STORY_ROAD.text), 2500);
    }
    if (story.road && !story.wide && CFG.STORY5.every(s => storyDone(s.id))) {
      story.wide = true; story.log.push(`${CFG.STORY_WIDE.title}: ${CFG.STORY_WIDE.text}`);
      storyDialog(CFG.STORY_WIDE.title, CFG.STORY_WIDE.text); shake = Math.max(shake, 0.5); Snd.play('horn');
    }
    if (story.wide && !story.eclipse) {
      story.eclipse = true; story.log.push(`${CFG.STORY_ECLIPSE.title}: ${CFG.STORY_ECLIPSE.text}`);
      setTimeout(() => storyDialog(CFG.STORY_ECLIPSE.title, CFG.STORY_ECLIPSE.text), 2500);
    }
    if (story.eclipse && !story.dusk && CFG.STORY6.every(s => storyDone(s.id))) {
      story.dusk = true; story.log.push(`${CFG.STORY_END6.title}: ${CFG.STORY_END6.text}`);
      storyDialog(CFG.STORY_END6.title, CFG.STORY_END6.text); shake = Math.max(shake, 0.6); Snd.play('victory'); updateHud();
    }
    if (story.dawn && !story.crown && CFG.STORY3.every(s => storyDone(s.id))) {
      story.crown = true; story.log.push(`${CFG.STORY_CROWN.title}: ${CFG.STORY_CROWN.text}`);
      storyDialog(CFG.STORY_CROWN.title, CFG.STORY_CROWN.text); shake = Math.max(shake, 0.5); Snd.play('horn');
    }
  }
  function checkStoryAll() { checkStory(); checkStory(); }                    // 한 번에 여러 이야기가 이어질 때(왕관 → 4장 시작 → ...)를 위해 두 번 돈다
  function foundRelic(d) {
    story.relics[d.id] = true; pl.pend++; giveXp(40); if (d.id === 'ashford') setTimeout(() => { const k = spawnCitizens(Math.max(0, Math.min(2, maxPop() - npcs.length))); if (k) toast(`${k} villagers from Ashford followed you home`); }, 1500); toast(`Relic found: ${d.relic}! (a bonus upgrade is waiting)`); floatText(`Relic: ${d.relic}`, player.position.x, 3.2, player.position.z);
    burst({ x: player.position.x, z: player.position.z, y: 1.5 }, 40); shake = Math.max(shake, 0.35); Snd.play('horn');
  }
  function storyIntro() {
    if (story.intro) return; story.intro = true;
    const t = 'At dawn a traveler leaves a charred map at your gate. "There was a Beacon once, far past the old road. It kept the dark away. Three relics powered it - find them, and the night may lose its teeth." Open the Journal (J) to plan an expedition.';
    story.log.push(`A Weathered Map: ${t}`); storyDialog('A Weathered Map', t);
  }

  // ---------- 원정 출발 / 귀환 ----------
  let escortBands = [];                                                    // 원정에 데려갈 전투단들 (비어 있으면 혼자)
  const escortPool = () => npcs.filter(n => n.role !== 'citizen' && !n.down && !n.escort);
  function powerOf() {                                       // 마을의 전투력: 병사 + 주인공
    const val = (n) => 2 + 2 * (n.role === 'melee' ? soldierWeaponDef(n) : gearDef(n.gear.bow)).tier + 1.5 * gearDef(n.gear.armor).tier + 1.5 * vetLv(n);
    const all = npcs.filter(n => n.role !== 'citizen'), going = all.filter(n => escortBands.includes(n.warband));
    const brought = going.reduce((a, n) => a + val(n), 0), home = all.filter(n => !going.includes(n)).reduce((a, n) => a + val(n), 0) * 0.35;      // 데려가는 전투단은 전부, 마을에 남는 병사는 35%만 (예비대)
    const me = 3 * pl.lvl + 3 * bestPlayerTier() + 2 * gearDef(playerGear.armor).tier;
    return { sold: Math.round(brought + home), brought: Math.round(brought), home: Math.round(home), me: Math.round(me), total: Math.round(brought + home + me) };
  }
  const powerFor = (d) => { const p = powerOf(); return d.raid ? p.brought + p.me : p.total; };       // 습격은 데려가는 전투단과 주인공만 센다 (마을에 남는 병사는 도움이 안 된다)
  const needOf = (d) => Math.round((CFG.EXP_NEED[d.id] || 0) * CFG.EXP_NEED_SCALE);      // 요구 전투력은 '병사 전원'이 아니라 '데려가는 전투단 + 예비대 1/3' 기준으로 맞춘다
  const nightExpWhy = () => {                                   // 밤 원정이 닫혀 있는 이유 (열려 있으면 '')
    const h = (gameMin / 60) % 24;
    if (!(h >= 20 || h < CFG.EXP_NIGHT_LATEST)) return 'Night only (20:00 - 02:00)';
    if (isRaid(nightDayNo())) return 'A raid is coming tonight - stay and defend';
    if (wave.day !== Math.max(1, nightDayNo()) || wave.remaining > 0 || wave.siegeLeft > 0 || wave.bossLeft > 0 || enemies.some(e => !e.userData.sinking && !e.userData.prowl && !e.userData.ex)) return 'Clear the night\'s raiders first';
    return '';
  };
  let marchArm = '', marchArmT = 0;
  function startExpedition(id) {
    const d = CFG.EXPEDITIONS.find(x => x.id === id);
    if (!d || exActive || dead || exEnding) return;
    if (age < d.age) return toast(`Requires Age ${d.age} (${CFG.AGES[d.age - 1].name})`);
    if (d.ch === 2 && !story.beacon) return toast('Light the Beacon first');
    if (d.ch === 3 && !story.dawn) return toast('Open the Dawn Gate first');
    if (d.ch === 4 && !story.hollow) return toast('Take the Winter Crown first');
    if (d.ch === 6 && !story.eclipse) return toast('Light the Wide Road first');
    if (d.ch === 5 && !story.road) return toast('Swear the Keeper\'s Oath first');
    if (d.needs && !d.needs.every(r => story.relics[r])) return toast('Recover the earlier relics first: this place stays hidden until you carry them');
    if (d.bands && escortBands.filter(i => escortPool().some(n => n.warband === i)).length < d.bands) return toast(`A raid needs ${d.bands} warbands: pick them with Bring in the warband window or the Journal${bandMax() < d.bands ? ` (you can bring ${bandMax()} at this age)` : ''}`);
    if (d.march) {                                                          // 먼 곳: 식량과 확인 (한 번 더 누르면 출발)
      const cost = marchFood(d);
      if (res.food < cost) return toast(`The march needs ${cost} food for the soldiers (you have ${Math.floor(res.food)}).`);
      if (marchArm !== d.id || performance.now() - marchArmT > 5000) { marchArm = d.id; marchArmT = performance.now(); return toast(`March ${d.march} day${d.march > 1 ? 's' : ''} each way: ${cost} food. ${homeOdds(d)}. Press Depart again to march.`); }
      marchArm = '';
    }
    if (powerFor(d) < needOf(d)) return toast(`Too dangerous for now: needs power ${needOf(d)} (you have ${powerFor(d)}${d.raid ? ', counting only the warbands you bring' : ''}). Upgrade gear, train soldiers, level up.`);
    if (d.night) { const why = nightExpWhy(); if (why) return toast(why); }
    else if (nowHour < 6 || nowHour >= CFG.EXP_LATEST) return toast('Too late to set out - dusk is near');
    closeJournal(); exEnding = true; gathering = null;
    const marchCost = d.march ? marchFood(d) : 0; if (marchCost) res.food -= marchCost;                 // 행군 식량은 출발할 때 먹는다
    fadeTo(() => {
      exActive = { dest: d, night: !!d.night, ret: { x: player.position.x, z: player.position.z }, res0: { ...res } };
      buildZone(d);
      const party = escortPool().filter(n => escortBands.includes(n.warband)).slice(0, CFG.WARBAND.SIZE * bandMax());                // 선택한 전투단의 병사들이 함께 간다
      party.forEach((n, i) => {
        npc = n; setTask(null); n.workT = 0; n.promote = null; n.target = null; n.returning = false; returnGear(n);
        n.clsHome = homeCls(n); n.cls = tripCls(n); applyGear(n);                    // 원정 직업으로 바꾼다 (마을 직업은 clsHome 에 남는다)
        n.escort = true; n.hold = null; n.position.set(EXC.x + ((i % 6) - 2.5) * 1.8, 0, EXC.z - 31 - Math.floor(i / 6) * 1.6); n.px = n.position.x; n.pz = n.position.z; n.hidden = false;
      });
      exActive.party = party.length; if (d.march) { const ml = marchOut(d); exActive.marchLines = ml; setTimeout(() => showTripReport(`${d.march} day${d.march > 1 ? 's' : ''} on the march`, ml.concat(`Provisions eaten on the road: ${marchCost} food. The warbands you took are with you; the village fights alone.`)), 1800); } if (party.length && !npcs.some(n => n.role !== 'citizen' && !party.includes(n)) && (story.guardWarn = (story.guardWarn || 0) + 1) <= 3) setTimeout(() => toast('Every soldier came with you - the village has no guard until you return'), 3200);       // 처음 세 번만 알린다
      player.position.set(EXC.x, 0, EXC.z - 33); facing = 0; player.rotation.y = 0; yaw = 0;
      camera.position.copy(goalPos(camGoal)); lookAt.set(player.position.x, LOOK_H, player.position.z);
      exEnding = false; updateExUi(); toast(`${d.name}: find the chests - you have a few minutes before dusk`); Snd.play('horn');
    });
  }
  function endExpedition(forced) {
    if (!exActive || exEnding) return;
    const ex = exActive; exEnding = true; gathering = null;
    fadeTo(() => {
      const backLines = ex.dest.march ? marchBack(ex.dest) : null;                          // 돌아오는 길의 밤들 (병사들은 아직 원정 중으로 센다)
      const gain = ['wood', 'stone', 'iron', 'food', 'shard'].map(k => [k, res[k] - ex.res0[k]]).filter(x => x[1] > 0).map(([k, v]) => `${v} ${k}`).join(', ');
      const left = exObjs.filter(o => o.userData.type === 'chest').length + enemies.filter(e => e.userData.ex && !(e.userData.dying > 0)).length;
      const cleared = exCamp ? (exCamp.broken && exObjs.filter(o => o.userData.type === 'chest').length === 0) : left === 0;
      const backMen = npcs.filter(x => x.escort), report0 = [...new Set(backMen.map(x => x.warband))].map(i => `${warbandName(i)} (${backMen.filter(x => x.warband === i && !x.down).length}/${backMen.filter(x => x.warband === i).length} on their feet)`);
      backMen.forEach((n, k) => {                                              // 동행 병사 귀환: 돌아온 자리에서 걸어서 각자의 일과 초소로 간다 (쓰러진 병사는 회복)
        n.escort = false; n.hold = null; n.cls = homeCls(n); applyGear(n);       // 마을로 돌아오면 마을 직업으로
        const a = k * 2.4, rr = 2 + (k % 3) * 0.9;
        if (n.down) { n.hp = n.maxHp; n.position.set(n.home.x, 0, n.home.z); }       // 쓰러진 병사는 집으로 옮겨져 회복한다
        else n.position.set(ex.ret.x + Math.sin(a) * rr, 0, ex.ret.z + Math.cos(a) * rr);
        n.px = n.position.x; n.pz = n.position.z; n.atkCd = 0;
      });
      if (backLines) setTimeout(() => showTripReport(`Home again after ${ex.dest.march * 2} days`, backLines.concat(report0.length ? `Back from the journey, returning to duty: ${report0.join(', ')}` : [])), 2600);
      if (report0.length && !backLines) setTimeout(() => toast(`Back from the journey, returning to duty: ${report0.join(', ')}`), 2200);
      cleanupZone(); exActive = null;
      if (ex.party > 0) unlockAch('escort');
      if (cleared) unlockAch('clear');
      if (cleared && ex.dest.raid) { (story.clearedDay = story.clearedDay || {})[ex.dest.id] = dayNow(); }
      if (cleared && !story.cleared[ex.dest.id]) { story.cleared[ex.dest.id] = true; setTimeout(() => toast(`${ex.dest.name} is cleared - build a camp from the Journal for daily supplies`), 2200); }
      player.position.set(ex.ret.x, 0, ex.ret.z); camera.position.copy(goalPos(camGoal)); lookAt.set(player.position.x, LOOK_H, player.position.z);
      story.exps++; exEnding = false; updateExUi(); updateHud(); saveGame();
      toast(`${forced ? (ex.night ? 'You rushed home as dawn broke. ' : 'You rushed home as dusk fell. ') : 'Back home. '}${gain ? 'Brought back: ' + gain : 'You found nothing this time'}`);
      checkStoryAll();
    });
  }
  // ---------- 10단계: 야영지 (정리한 원정지에 세우면 매일 아침 자원이 들어온다) ----------
  const campMeshes = [], campTentMat = mat(0xcbb48a), campFlagMat = mat(0x2f7fc0);
  function rebuildCamps() {
    for (const m of campMeshes) scene.remove(m);
    campMeshes.length = 0;
    CFG.EXPEDITIONS.filter(d => story.camps[d.id]).forEach((d, i) => {
      const a = 0.55 + i * 0.62, r = 47, g = new THREE.Group();
      const tent = new THREE.Mesh(new THREE.ConeGeometry(1.5, 2.1, 5), campTentMat); tent.position.y = 1.05;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 6), woodMat2); pole.position.set(1.8, 1.6, 0);
      const flag = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.04), campFlagMat); flag.position.set(2.15, 2.9, 0);
      g.add(tent, pole, flag); g.traverse(m => { if (m.isMesh) m.castShadow = true; });
      g.position.set(Math.cos(a) * r, actorH(Math.cos(a) * r, Math.sin(a) * r), Math.sin(a) * r); g.rotation.y = -a; scene.add(g); campMeshes.push(g);
    });
  }
  function buildCamp(id) {
    const d = CFG.EXPEDITIONS.find(x => x.id === id), cost = CFG.CAMP_COST[d.age];
    if (!d || !story.cleared[id] || story.camps[id] || !canPay(cost)) return;
    payCost(cost); story.camps[id] = true; updateHud(); rebuildCamps(); Snd.play('chime'); giveXp(20);
    toast(`${d.name} camp established: ${Object.entries(CFG.CAMPS[id]).map(([k, v]) => `+${v} ${k}`).join(', ')} each morning`);
    renderJournal(); saveGame();
  }
  function campIncome() {
    const tot = {}; let any = false;
    for (const d of CFG.EXPEDITIONS) if (story.camps[d.id] && CFG.CAMPS[d.id]) for (const [k, v] of Object.entries(CFG.CAMPS[d.id])) {
      const g = Math.max(1, Math.round(v * (season().id === 'winter' ? 0.6 : 1))); res[k] += g; tot[k] = (tot[k] || 0) + g; any = true;
    }
    if (any) { report.camps = Object.entries(tot).map(([k, v]) => `${k} +${v}`).join(' · '); updateHud(); }
  }
  function updateExUi() {
    const b = document.getElementById('expBtn');
    b.firstChild.textContent = exActive ? 'Return home' : 'Journal';
    b.classList.toggle('on', !!exActive);
  }
  let returnArm = 0;
  function requestReturn() {                       // 상자·적이 남아 있으면 실수로 돌아가지 않도록 한 번 더 누르게 한다
    if (!exActive || exEnding) return;
    const chests = exObjs.filter(o => o.userData.type === 'chest').length, foes = enemies.filter(e => e.userData.ex && !(e.userData.dying > 0)).length;
    if (exCamp && !exCamp.broken && performance.now() - returnArm > 3500) { returnArm = performance.now(); toast(`The camp still stands - burn its banner (G) or defeat the chief. Press again to go home`); return; }
    if ((chests || foes) && performance.now() - returnArm > 3500) { returnArm = performance.now(); toast(`${chests} chest${chests === 1 ? '' : 's'} and ${foes} foe${foes === 1 ? '' : 's'} left - press again to go home`); return; }
    endExpedition(false);
  }
  document.getElementById('expBtn').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); exActive ? requestReturn() : toggleJournal(); });
  addEventListener('keydown', e => { if (e.code === 'KeyJ' && !e.repeat) { if (exActive) requestReturn(); else toggleJournal(); } });

  // ---------- 일지(Journal): 이야기 목표 + 원정 목록 ----------
  const jEl = document.getElementById('journalPanel');
  function campHtml(d) {
    if (d.raid) return holdHtml(d);
    if (story.camps[d.id]) return `<small>Camp ✔ ${Object.entries(CFG.CAMPS[d.id]).map(([k, v]) => `+${v} ${k}`).join(', ')} every morning</small>`;
    if (!story.cleared[d.id]) return '';
    const cost = CFG.CAMP_COST[d.age];
    return `<small><button class="campBtn" data-camp="${d.id}" ${canPay(cost) ? '' : 'disabled'}>Build camp (${costText(cost)})</button> ${Object.entries(CFG.CAMPS[d.id]).map(([k, v]) => `+${v} ${k}`).join(', ')} every morning</small>`;
  }
  let jTab = 'map', jMapSel = 'quarry', jFocus = true;                                                      // 일지의 탭: 'journey'(원정) / 'raid'(습격)
  function renderJournal() {
    const chain = storyChain(), first = chain.findIndex(s => !storyDone(s.id));
    document.getElementById('jStory').innerHTML = (story.intro ? chain.map((s, i) => `<div class="q ${storyDone(s.id) ? 'done' : i === first ? 'now' : ''}"><span>${storyDone(s.id) ? '✔' : i === first ? '➤' : '•'}</span><span>${s.goal}</span></div>`).join('') +
      (story.beacon ? '<div class="q done"><span>★</span><span>The Beacon is lit! Chapter 2: gather the three shards</span></div>' : '') + (story.dawn ? '<div class="q done"><span>★</span><span>The Dawn Gate is open - Beacon gear can be forged</span></div>' : '') + (story.crown ? '<div class="q done"><span>★</span><span>The Winter Crown shines on the Beacon - Chapter 4: the Hollow Court</span></div>' : '') + (story.finale ? '<div class="q done"><span>★</span><span>The Keeper\'s Oath is sworn - the Hollow Court is at peace</span></div>' : '') + (story.road ? '<div class="q done"><span>★</span><span>The Wide Road: carry the light to Ashford, Reedhaven and Stonegate</span></div>' : '') + (story.wide ? '<div class="q done"><span>★</span><span>The road is lit from end to end</span></div>' : '') +
      story.log.slice(-2).map(t => `<div class="log">${t}</div>`).join('') : '<div class="q">Your story begins at the next dawn...</div>');
    { const pw = powerOf(); document.getElementById('jPower').textContent = `Your power: ${pw.total} (warband you bring ${pw.brought} · reserves at home ${pw.home} · you ${pw.me}) - the warband you bring counts fully, soldiers left home only a third. Stronger gear, more soldiers and levels open harder expeditions`; }
    const fewBands = (d) => d.bands && escortBands.filter(i => escortPool().some(n => n.warband === i)).length < d.bands;
    const late = nowHour < 6 || nowHour >= CFG.EXP_LATEST, nightWhy = nightExpWhy(), lateFor = (d) => d.night ? !!nightWhy : late;
    document.getElementById('jHint').textContent = `Set out between 06:00 and ${fmtH(CFG.EXP_LATEST)}. Time moves slowly while you are away, but you are called home at ${fmtH(CFG.EXP_FORCE)} (a countdown shows at the top). The village keeps working meanwhile. Moonlit sites open at night (20:00 - 02:00) once the night's raiders are dealt with, and give double XP.`;
    escortBands = escortBands.filter(i => escortPool().some(n => n.warband === i));
    const wbRows = []; for (let i = 0; i < CFG.WARBAND.MAX; i++) {
      const mem = warbandMembers(i); if (!mem.length) continue;
      const ready = mem.filter(n => !n.down && !n.escort).length, on = bringing(i);
      wbRows.push(`<div class="ex"><div class="info"><b style="color:${warbandColor(i)}">&#9679; ${warbandName(i)} (${mem.length}/${CFG.WARBAND.SIZE})</b><small>${mem.map(n => clsTitle(n).replace('Swordsman', 'Sword').replace('Great Swordsman', 'Great Sword') + ' ' + n.name).join(', ')}</small></div><button data-wb="${i}" ${ready ? '' : 'disabled'}>${on ? 'Going &#10003;' : ready ? 'Bring' : 'Away'}</button></div>`);
    }
    const escHtml = `<div class="ex"><div class="info"><b>Warbands</b><small>Soldiers: ${soldierCount()}/${soldierCap()} (more barracks and archery ranges raise the limit). Pick up to ${bandMax()} warband${bandMax() > 1 ? 's' : ''} to bring (more at higher ages): they follow you and fights (fallen soldiers are carried home), and is away from the village meanwhile. Tap a soldier in the village to change their warband.</small></div></div>` + (wbRows.length ? wbRows.join('') : '<div class="ex"><div class="info"><small>No soldiers yet. Build a barracks or archery range.</small></div></div>');
    const jtabs = `<div class="jtabs"><button data-jtab="map" class="${jTab === 'map' ? 'on' : ''}">Map</button><button data-jtab="journey" class="${jTab === 'journey' ? 'on' : ''}">Journeys</button><button data-jtab="raid" class="${jTab === 'raid' ? 'on' : ''}">Raids</button></div>`;
    const chLocked = (d) => (d.ch === 2 && !story.beacon) || (d.ch === 3 && !story.dawn) || (d.ch === 4 && !story.hollow) || (d.ch === 5 && !story.road) || (d.ch === 6 && !story.eclipse);
    const lockOf = (d) => age < d.age || chLocked(d) || (d.needs && !d.needs.every(r => story.relics[r])) || powerFor(d) < needOf(d);
    const rowOf = (d) => {
      const weak = powerFor(d) < needOf(d), lock = age < d.age || (d.ch === 2 && !story.beacon) || (d.ch === 3 && !story.dawn) || (d.ch === 4 && !story.hollow) || (d.ch === 5 && !story.road) || (d.ch === 6 && !story.eclipse) || (d.needs && !d.needs.every(r => story.relics[r])) || weak, found = d.relic && story.relics[d.id];
      return `<div class="ex"><div class="info"><b>${d.name}</b><small>${d.desc}</small><small>Risk: ${d.risk}${d.raid ? ` · ⚔ Raid: ${d.bands} warband${d.bands > 1 ? 's' : ''}` : ''}${d.march ? ` · March ${d.march} day${d.march > 1 ? 's' : ''} each way (${marchFood(d)} food for the soldiers you bring)` : ''} · Power ${needOf(d)}${d.raid ? ` (you: ${powerFor(d)}, warbands you bring + you)` : ''}${d.night ? ' · 🌙 ' + (nightWhy || 'Open now') : ''} · Reward: ${d.reward}${campReliefTxt(d.id)}${found ? ' · Relic recovered ✔' : ''}${lock ? (d.ch === 2 && !story.beacon ? ' · Light the Beacon first' : d.ch === 3 && !story.dawn ? ' · Open the Dawn Gate first' : d.ch === 4 && !story.hollow ? ' · Take the Winter Crown first' : d.ch === 5 && !story.road ? ' · Swear the Keeper\'s Oath first' : d.needs && !d.needs.every(r => story.relics[r]) ? ' · Needs the earlier sites\' relics' : age < d.age ? ` · Requires Age ${d.age}` : ` · Needs power ${needOf(d)}`) : ''}</small>${campHtml(d)}</div><button data-id="${d.id}" ${lock || lateFor(d) || fewBands(d) ? 'disabled' : ''}>${lock ? 'Locked' : lateFor(d) ? (d.night ? 'Night only' : 'Too late') : fewBands(d) ? `Bring ${d.bands} warbands` : 'Depart'}</button></div>`;
    };
    const mapHtml = () => {                                                  // 지도 화면: 마디(원정)와 길. 고르면 아래에 같은 카드가 나온다
      const N = CFG.MAP.NODES, V = CFG.MAP.START, vis = CFG.EXPEDITIONS.filter(d => N[d.id] && !chLocked(d)), ids = new Set(vis.map(d => d.id)), near = vis.filter(d => !N[d.id].far), far = vis.filter(d => N[d.id].far);
      if (!ids.has(jMapSel)) jMapSel = (near.find(d => !lockOf(d)) || near[0]).id;
      const posOf = (id) => id === 'village' ? V : N[id];
      let lines = '', dots = '';
      for (const d of near) { const n = N[d.id]; if (n.from !== 'village' && !ids.has(n.from)) continue; const p = posOf(n.from); lines += `<line x1="${p.x}" y1="${p.y}" x2="${n.x}" y2="${n.y}"/>`; }
      for (const d of near) {
        const n = N[d.id], locked = lockOf(d), sel = d.id === jMapSel, col = d.raid ? '#e0604a' : d.night ? '#6f7cff' : d.ch ? '#e0b43c' : '#5fc060', sym = d.raid ? '&#9876;' : d.night ? '&#9790;' : d.ch ? '&#9733;' : '&#9679;';
        dots += `<g data-node="${d.id}" class="${locked ? 'lk' : ''}"><circle class="hit" cx="${n.x}" cy="${n.y}" r="5"/><circle cx="${n.x}" cy="${n.y}" r="3.2" fill="${col}" stroke="${sel ? '#fff' : story.cleared[d.id] ? '#8fd49a' : '#2a2118'}" stroke-width="${sel || story.cleared[d.id] ? 1 : 0.5}"/><text x="${n.x}" y="${n.y + 1.1}">${sym}</text>${holdOf(d.id) ? `<text class="flag" x="${n.x + 3.8}" y="${n.y - 2.2}">&#9873;</text>` : story.cleared[d.id] ? `<text class="ok" x="${n.x + 3.6}" y="${n.y - 2.6}">&#10003;</text>` : ''}${sel ? `<text class="nm" x="${n.x}" y="${n.y + 7.2}">${d.name}</text>` : ''}</g>`;
      }
      const sd = CFG.EXPEDITIONS.find(d => d.id === jMapSel);
      return `<svg class="jmap" viewBox="0 0 100 70"><g class="roads">${lines}</g><g class="home" transform="translate(${V.x} ${V.y})"><circle r="3.6" fill="#c8923a"/><text y="1.2">&#8962;</text><text class="nm" y="7.2">Home</text></g>${dots}</svg><small class="jleg">&#9679; foray &nbsp; &#9876; raid &nbsp; &#9790; night &nbsp; &#9733; story site &nbsp; dim = locked or too strong &nbsp; &#10003; cleared</small>` + (far.length ? `<div class="jfar"><b>Far lands</b> (march days)<br>${far.map(d => `<button data-node="${d.id}" class="farchip${d.id === jMapSel ? ' on' : ''}${lockOf(d) ? ' lk' : ''}">${holdOf(d.id) ? '&#9873; ' : ''}${d.name} · ${d.march} day${d.march > 1 ? 's' : ''}</button>`).join('')}</div>` : '') + (sd ? rowOf(sd) : '') + escHtml;
    };
    const expList = jTab === 'map' ? mapHtml() : CFG.EXPEDITIONS.filter(d => !!d.raid === (jTab === 'raid')).map(rowOf).join('');
    document.getElementById('jExp').innerHTML = jtabs + (jTab === 'map' ? '' : escHtml) + expList;       // 지도 탭: 지도와 카드가 먼저, 전투단 목록은 그 아래
    if (jFocus) { jFocus = false; const card = jEl.querySelector('.jcard'), ex = document.getElementById('jExp'); if (card && ex) card.scrollTop += ex.getBoundingClientRect().top - card.getBoundingClientRect().top - 8; }       // 열거나 탭을 바꾸면 지도 부분으로 스크롤
    jEl.querySelectorAll('#jExp [data-node]').forEach(g => g.addEventListener('click', () => { jMapSel = g.dataset.node; renderJournal(); }));
    jEl.querySelectorAll('#jExp button[data-jtab]').forEach(b => b.addEventListener('click', () => { jTab = b.dataset.jtab; jFocus = true; renderJournal(); }));
    jEl.querySelectorAll('#jExp button[data-id]').forEach(b => b.addEventListener('click', () => startExpedition(b.dataset.id)));
    jEl.querySelectorAll('#jExp .holdBtn').forEach(b => b.addEventListener('click', () => garrisonIt(b.dataset.hold)));
    jEl.querySelectorAll('#jExp .campBtn').forEach(b => b.addEventListener('click', () => buildCamp(b.dataset.camp)));
    jEl.querySelectorAll('#jExp button[data-wb]').forEach(b => b.addEventListener('click', () => { const i = +b.dataset.wb; toggleBring(i); renderJournal(); }));
  }
  function openJournal() { if (dead || exActive) return; jFocus = true; renderJournal(); jEl.style.display = 'flex'; }
  function closeJournal() { jEl.style.display = 'none'; }
  function toggleJournal() { jEl.style.display === 'flex' ? closeJournal() : openJournal(); }
  document.getElementById('jClose').addEventListener('click', closeJournal);

  // ---------- 대장간 연출: 굴뚝 연기 + 화덕 깜빡임 ----------
  let forgeFlash = 0, smokeCd = 0;
  const puffs = [];
  const smokeTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const c = cv.getContext('2d'), g = c.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv);
  })();
  function updateSmith(dt, t) {
    forgeFlash = Math.max(0, forgeFlash - dt * 2);
    const k = 0.7 + 0.25 * Math.sin(t * 11) * Math.sin(t * 7.3) + forgeFlash * 0.9;
    forgeGlow.color.setRGB(1, Math.min(1, 0.3 + 0.28 * k), 0.06 + 0.12 * k);
    smokeCd -= dt;
    if (smokeCd <= 0) {
      smokeCd = 0.45;
      for (const sm of smiths()) {
        if (puffs.length > 26) break;
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0xb8b8c0, transparent: true, opacity: 0.55, depthWrite: false }));
        sp.position.set(sm.position.x - 1.4 + rand(-0.1, 0.1), 3.4, sm.position.z - 0.9 + rand(-0.1, 0.1));
        sp.scale.setScalar(0.5); sp.userData = { life: 0, wind: rand(0.2, 0.5) };
        scene.add(sp); puffs.push(sp);
      }
    }
    for (const p of puffs.slice()) {
      p.userData.life += dt;
      p.position.y += dt * 1.1; p.position.x += dt * p.userData.wind;
      p.scale.setScalar(0.5 + p.userData.life * 0.9);
      p.material.opacity = Math.max(0, 0.55 * (1 - p.userData.life / 2.6));
      if (p.userData.life >= 2.6) { scene.remove(p); p.material.dispose(); puffs.splice(puffs.indexOf(p), 1); }
    }
  }
