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
    e.traverse(o => { if (o.isMesh && o.material && o.material.color && !o.material.isMeshBasicMaterial) { let c = map.get(o.material); if (!c) { c = o.material.clone(); c.color.lerp(FACTION_COLOR[faction] || FACTION_COLOR.frost, 0.55); map.set(o.material, c); } o.material = c; } });
    if (map.has(e.material)) e.material = map.get(e.material);
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
    for (const kind of foeList) { const p = spot(2.5); spawnEnemy(kind, p); if (d.faction) frostTint(enemies[enemies.length - 1], d.faction); addGlow(enemies[enemies.length - 1], FOE_GLOW[d.faction] || 0xff6a4a, 1.7, 1.2); }
    if (d.guardian) {                                                 // 수호자: 커다랗고 단단한 우두머리. 쓰러뜨리면 보상 상자가 나온다
      const p = spot(4); spawnEnemy(d.guardian.kind, p);
      const e = enemies[enemies.length - 1], u = e.userData, s = d.guardian.scale;
      u.hp *= d.guardian.hpMul; u.maxHp = u.hp; u.guardian = true; u.contact *= 1.3; u.r *= s; u.baseY *= s;
      e.scale.multiplyScalar(s); e.position.y = u.baseY;
      if (d.faction) frostTint(e, d.faction);
      addGlow(e, 0xffd45a, 3.4, 1.4);
      const lbl = textSprite(d.guardian.name || 'Guardian', '#ffcf5a', 1.5, 0.5, 'bold 56px sans-serif'); lbl.position.set(0, 2.5, 0); e.add(lbl);
    }
  }
  function cleanupZone() {
    for (const o of exMeshes.concat(exObjs)) scene.remove(o);
    exMeshes.length = 0; exObjs.length = 0; exBeams.length = 0;
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
    u.aggro = exActive ? (u.aggro ? near < 24 : near < 13) : false;
    let moving = false; u.escortCd = (u.escortCd || 0) - dt;
    if (u.kbT > 0) { u.kbT -= dt; e.position.x += u.kbVx * dt; e.position.z += u.kbVz * dt; }
    else if (u.aggro && td > 0.9 && !(u.stunT > 0)) { e.position.x += (tx - e.position.x) / td * u.speed * dt; e.position.z += (tz - e.position.z) / td * u.speed * dt; e.lookAt(tx, e.position.y, tz); moving = true; }
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
    n.hp = Math.max(0, n.hp - Math.max(1, Math.round(dmg * dm().dmg * (1 - gearDef(n.gear.armor).reduce) * (TR(n).dmg || 1))));
    if (n.hp <= 0) { n.down = true; n.mat.color.set(0x777777); n.anim.die(); grieve(); toast(`${n.name} is down - they will be carried home`); }
  }
  function exMove(n, tx, tz, speed, dt) {          // 원정 지역용 단순 이동: 장애물 밀어내기 + 지역 경계
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
    let foe = null, bd = 16;
    for (const e of enemies) {
      if (!e.userData.ex || e.userData.sinking || e.userData.dying > 0) continue;
      const d = Math.hypot(e.position.x - n.position.x, e.position.z - n.position.z);
      if (d < bd) { bd = d; foe = e; }
    }
    let state = 'Escorting';
    if (foe) {
      state = 'Fighting';
      if (n.role === 'melee') {
        if (bd > 1.7) exMove(n, foe.position.x, foe.position.z, 5.2, dt);
        else { n.face = Math.atan2(foe.position.x - n.position.x, foe.position.z - n.position.z); n.rotation.y = n.face; if (n.atkCd <= 0) soldierStrike(foe); }
      } else {
        if (bd > 9) exMove(n, foe.position.x, foe.position.z, 4.5, dt);
        else if (bd < 4) exMove(n, n.position.x * 2 - foe.position.x, n.position.z * 2 - foe.position.z, 4.5, dt);
        if (bd <= 11) soldierShoot(foe);
      }
    } else {
      const k = npcs.filter(x => x.escort).indexOf(n), a = facing + Math.PI + (k - 1) * 0.9, tx = player.position.x + Math.sin(a) * 2.6, tz = player.position.z + Math.cos(a) * 2.6;
      const d = Math.hypot(tx - n.position.x, tz - n.position.z);
      if (d > 1.2) exMove(n, tx, tz, d > 8 ? 8 : 5, dt);
    }
    const mv = Math.hypot(n.position.x - n.px, n.position.z - n.pz) / Math.max(dt, 1e-4); n.px = n.position.x; n.pz = n.position.z;
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
  const story = { stats: [], roads: [], relics: {}, said: {}, log: [], intro: false, exps: 0, beacon: false, dawn: false, crown: false, hollow: false, finale: false, road: false, wide: false, eclipse: false, dusk: false, champs: 0, camps: {}, cleared: {}, tales: {}, taleDay: 0, ms: {} };
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
  let escortN = 0;
  const escortPool = () => npcs.filter(n => n.role !== 'citizen' && !n.down && !n.escort);
  function powerOf() {                                       // 마을의 전투력: 병사 + 주인공
    const sold = npcs.filter(n => n.role !== 'citizen').reduce((a, n) => a + 2 + 2 * gearDef(n.role === 'melee' ? n.gear.sword : n.gear.bow).tier + 1.5 * gearDef(n.gear.armor).tier + 1.5 * vetLv(n), 0);
    const me = 3 * pl.lvl + 3 * gearDef(playerGear.sword).tier + 2 * gearDef(playerGear.armor).tier;
    return { sold: Math.round(sold), me: Math.round(me), total: Math.round(sold + me) };
  }
  const needOf = (d) => CFG.EXP_NEED[d.id] || 0;
  const nightExpWhy = () => {                                   // 밤 원정이 닫혀 있는 이유 (열려 있으면 '')
    const h = (gameMin / 60) % 24;
    if (!(h >= 20 || h < CFG.EXP_NIGHT_LATEST)) return 'Night only (20:00 - 02:00)';
    if (isRaid(nightDayNo())) return 'A raid is coming tonight - stay and defend';
    if (wave.day !== Math.max(1, nightDayNo()) || wave.remaining > 0 || wave.siegeLeft > 0 || wave.bossLeft > 0 || enemies.some(e => !e.userData.sinking && !e.userData.prowl && !e.userData.ex)) return 'Clear the night\'s raiders first';
    return '';
  };
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
    if (powerOf().total < needOf(d)) return toast(`Too dangerous for now: needs power ${needOf(d)} (you have ${powerOf().total}). Upgrade gear, train soldiers, level up.`);
    if (d.night) { const why = nightExpWhy(); if (why) return toast(why); }
    else if (nowHour < 6 || nowHour >= CFG.EXP_LATEST) return toast('Too late to set out - dusk is near');
    closeJournal(); exEnding = true; gathering = null;
    fadeTo(() => {
      exActive = { dest: d, night: !!d.night, ret: { x: player.position.x, z: player.position.z }, res0: { ...res } };
      buildZone(d);
      const party = escortPool().sort((a, b) => (a.role === 'melee' ? 0 : 1) - (b.role === 'melee' ? 0 : 1)).slice(0, Math.min(escortN, CFG.ESCORT_MAX));     // 동행 병사: 근접 병사 먼저
      party.forEach((n, i) => {
        npc = n; setTask(null); n.workT = 0; n.promote = null; n.target = null; n.returning = false; returnGear(n);
        n.escort = true; n.position.set(EXC.x + (i - (party.length - 1) / 2) * 2.2, 0, EXC.z - 31); n.px = n.position.x; n.pz = n.position.z; n.hidden = false;
      });
      exActive.party = party.length;
      player.position.set(EXC.x, 0, EXC.z - 33); facing = 0; player.rotation.y = 0; yaw = 0;
      camera.position.copy(goalPos(camGoal)); lookAt.set(player.position.x, LOOK_H, player.position.z);
      exEnding = false; updateExUi(); toast(`${d.name}: find the chests - you have a few minutes before dusk`); Snd.play('horn');
    });
  }
  function endExpedition(forced) {
    if (!exActive || exEnding) return;
    const ex = exActive; exEnding = true; gathering = null;
    fadeTo(() => {
      const gain = ['wood', 'stone', 'iron', 'food', 'shard'].map(k => [k, res[k] - ex.res0[k]]).filter(x => x[1] > 0).map(([k, v]) => `${v} ${k}`).join(', ');
      const left = exObjs.filter(o => o.userData.type === 'chest').length + enemies.filter(e => e.userData.ex && !(e.userData.dying > 0)).length;
      const cleared = left === 0;
      for (const n of npcs.filter(x => x.escort)) {                           // 동행 병사 귀환 (쓰러진 병사는 집에서 회복)
        n.escort = false; n.position.set(n.home.x, 0, n.home.z); n.px = n.home.x; n.pz = n.home.z; n.atkCd = 0;
        if (n.down) { n.hp = n.maxHp; }
      }
      cleanupZone(); exActive = null;
      if (ex.party > 0) unlockAch('escort');
      if (cleared) unlockAch('clear');
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
    if ((chests || foes) && performance.now() - returnArm > 3500) { returnArm = performance.now(); toast(`${chests} chest${chests === 1 ? '' : 's'} and ${foes} foe${foes === 1 ? '' : 's'} left - press again to go home`); return; }
    endExpedition(false);
  }
  document.getElementById('expBtn').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); exActive ? requestReturn() : toggleJournal(); });
  addEventListener('keydown', e => { if (e.code === 'KeyJ' && !e.repeat) { if (exActive) requestReturn(); else toggleJournal(); } });

  // ---------- 일지(Journal): 이야기 목표 + 원정 목록 ----------
  const jEl = document.getElementById('journalPanel');
  function campHtml(d) {
    if (story.camps[d.id]) return `<small>Camp ✔ ${Object.entries(CFG.CAMPS[d.id]).map(([k, v]) => `+${v} ${k}`).join(', ')} every morning</small>`;
    if (!story.cleared[d.id]) return '';
    const cost = CFG.CAMP_COST[d.age];
    return `<small><button class="campBtn" data-camp="${d.id}" ${canPay(cost) ? '' : 'disabled'}>Build camp (${costText(cost)})</button> ${Object.entries(CFG.CAMPS[d.id]).map(([k, v]) => `+${v} ${k}`).join(', ')} every morning</small>`;
  }
  function renderJournal() {
    const chain = storyChain(), first = chain.findIndex(s => !storyDone(s.id));
    document.getElementById('jStory').innerHTML = (story.intro ? chain.map((s, i) => `<div class="q ${storyDone(s.id) ? 'done' : i === first ? 'now' : ''}"><span>${storyDone(s.id) ? '✔' : i === first ? '➤' : '•'}</span><span>${s.goal}</span></div>`).join('') +
      (story.beacon ? '<div class="q done"><span>★</span><span>The Beacon is lit! Chapter 2: gather the three shards</span></div>' : '') + (story.dawn ? '<div class="q done"><span>★</span><span>The Dawn Gate is open - Beacon gear can be forged</span></div>' : '') + (story.crown ? '<div class="q done"><span>★</span><span>The Winter Crown shines on the Beacon - Chapter 4: the Hollow Court</span></div>' : '') + (story.finale ? '<div class="q done"><span>★</span><span>The Keeper\'s Oath is sworn - the Hollow Court is at peace</span></div>' : '') + (story.road ? '<div class="q done"><span>★</span><span>The Wide Road: carry the light to Ashford, Reedhaven and Stonegate</span></div>' : '') + (story.wide ? '<div class="q done"><span>★</span><span>The road is lit from end to end</span></div>' : '') +
      story.log.slice(-2).map(t => `<div class="log">${t}</div>`).join('') : '<div class="q">Your story begins at the next dawn...</div>');
    { const pw = powerOf(); document.getElementById('jPower').textContent = `Your power: ${pw.total} (soldiers ${pw.sold} · you ${pw.me}) - stronger gear, more soldiers and levels open harder expeditions`; }
    const late = nowHour < 6 || nowHour >= CFG.EXP_LATEST, nightWhy = nightExpWhy(), lateFor = (d) => d.night ? !!nightWhy : late;
    document.getElementById('jHint').textContent = `Set out between 06:00 and ${fmtH(CFG.EXP_LATEST)}. Time moves slowly while you are away, but you are called home at ${fmtH(CFG.EXP_FORCE)} (a countdown shows at the top). The village keeps working meanwhile. Moonlit sites open at night (20:00 - 02:00) once the night's raiders are dealt with, and give double XP.`;
    const pool = escortPool().length; escortN = Math.min(escortN, pool, CFG.ESCORT_MAX);
    const escHtml = `<div class="ex"><div class="info"><b>Escort</b><small>Soldiers who come along follow you and fight (they are carried home if they fall). They are away from the village while you are gone.</small></div><button id="escBtn" ${pool ? '' : 'disabled'}>${escortN ? escortN + ' soldier' + (escortN > 1 ? 's' : '') : pool ? 'None' : 'No soldiers'}</button></div>`;
    document.getElementById('jExp').innerHTML = escHtml + CFG.EXPEDITIONS.map(d => {
      const weak = powerOf().total < needOf(d), lock = age < d.age || (d.ch === 2 && !story.beacon) || (d.ch === 3 && !story.dawn) || (d.ch === 4 && !story.hollow) || (d.ch === 5 && !story.road) || (d.ch === 6 && !story.eclipse) || (d.needs && !d.needs.every(r => story.relics[r])) || weak, found = d.relic && story.relics[d.id];
      return `<div class="ex"><div class="info"><b>${d.name}</b><small>${d.desc}</small><small>Risk: ${d.risk} · Power ${needOf(d)}${d.night ? ' · 🌙 ' + (nightWhy || 'Open now') : ''} · Reward: ${d.reward}${found ? ' · Relic recovered ✔' : ''}${lock ? (d.ch === 2 && !story.beacon ? ' · Light the Beacon first' : d.ch === 3 && !story.dawn ? ' · Open the Dawn Gate first' : d.ch === 4 && !story.hollow ? ' · Take the Winter Crown first' : d.ch === 5 && !story.road ? ' · Swear the Keeper\'s Oath first' : d.needs && !d.needs.every(r => story.relics[r]) ? ' · Needs the earlier sites\' relics' : age < d.age ? ` · Requires Age ${d.age}` : ` · Needs power ${needOf(d)}`) : ''}</small>${campHtml(d)}</div><button data-id="${d.id}" ${lock || lateFor(d) ? 'disabled' : ''}>${lock ? 'Locked' : lateFor(d) ? (d.night ? 'Night only' : 'Too late') : 'Depart'}</button></div>`;
    }).join('');
    jEl.querySelectorAll('#jExp button[data-id]').forEach(b => b.addEventListener('click', () => startExpedition(b.dataset.id)));
    jEl.querySelectorAll('#jExp .campBtn').forEach(b => b.addEventListener('click', () => buildCamp(b.dataset.camp)));
    const eb = document.getElementById('escBtn'); if (eb) eb.addEventListener('click', () => { escortN = (escortN + 1) % (Math.min(pool, CFG.ESCORT_MAX) + 1); renderJournal(); });
  }
  function openJournal() { if (dead || exActive) return; renderJournal(); jEl.style.display = 'flex'; }
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
