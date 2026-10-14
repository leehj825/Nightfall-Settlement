  // ---------- 훈련장 (Training Field): 별도 지역. 모든 전투단이 줄지어 서고, 모의 전투를 치른다. 시계는 멈추고, 아무도 다치지 않으며, 보상도 없다 ----------
  // (이 파일의 것은 모두 function 선언이다)
  const TRAIN_DEST = { id: 'trainfield', name: 'Training Field', training: true, tint: 0x4d6a3c, trees: 6, rocks: 3, ore: 0, chests: 0, foes: [], desc: '' };
  function trainReady() { return age >= CFG.TRAIN.AGE; }
  const TRAIN_SIEGE = { id: 'trainsiege', name: 'Siege practice', training: true, siege: true, tint: 0x4d6a3c, trees: 0, rocks: 2, ore: 0, chests: 0, get camp() { return CFG.TRAIN.SIEGE.camp; }, get foes() { return CFG.TRAIN.SIEGE.foes; }, get guardian() { return CFG.TRAIN.SIEGE.guardian; }, desc: '' };
  function startTraining(mode) {
    if (exActive || dead || exEnding) return;
    if (!trainReady()) return toast(`The Training Field opens at Stage ${CFG.TRAIN.AGE}`);
    if (nowHour < 6 || nowHour >= 16) return toast('Train in daylight (before 16:00)');
    if (!escortPool().length) return toast('No soldiers to train');
    closeJournal(); exEnding = true; gathering = null;
    fadeTo(() => {
      const siege = mode === 'siege', dest = siege ? TRAIN_SIEGE : TRAIN_DEST;
      exActive = { dest, training: true, night: false, ret: { x: player.position.x, z: player.position.z }, res0: { ...res } };
      siegeLoad = siege ? { ram: 1, ladder: CFG.SIEGE.LADDER_MAX, catapult: 1 } : { ram: 0, ladder: 0, catapult: 0 }; exStats = { kills: 0, t0: performance.now(), battle: null };       // 공성 연습: 장비는 소모되지 않는다
      buildZone(dest);
      const party = escortPool(), bands = [...new Set(party.map(n => n.warband))].sort((a, b) => (a < 0 ? 99 : a) - (b < 0 ? 99 : b));
      bands.forEach((bi, row) => {                                              // 전투단마다 한 줄: 왼쪽에 깃발과 이름
        const z = EXC.z - 34 + row * 3.6, mem = party.filter(n => n.warband === bi), col = bi >= 0 ? warbandColor(bi) : '#9aa0aa';
        const g = new THREE.Group(), pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4, 6), lampPostMat), cloth = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.05), new THREE.MeshStandardMaterial({ color: new THREE.Color(col), flatShading: true }));
        pole.position.y = 2; cloth.position.set(0.6, 3.4, 0); g.add(pole, cloth);
        const lbl = textSprite(bi >= 0 ? warbandName(bi) : 'Levies', col, 3.4, 0.9, 'bold 52px sans-serif'); lbl.position.set(0, 4.6, 0); g.add(lbl);
        g.position.set(EXC.x - 10, 0, z); exAdd(g, false);
        if (siege) { const mem2 = party.filter(n => n.warband === bi); mem2.forEach((n, j) => { npc = n; setTask(null); n.workT = 0; n.promote = null; n.target = null; n.returning = false; returnGear(n); n.clsHome = homeCls(n); n.cls = tripCls(n); applyGear(n); n.escort = true; n.hold = null; n.parade = null; n.position.set(EXC.x + ((j % 6) - 2.5) * 1.8, 0, EXC.z - 31 - row * 1.6); n.px = n.position.x; n.pz = n.position.z; n.hidden = false; n.hp = n.maxHp; }); return; }
        mem.forEach((n, j) => {
          npc = n; setTask(null); n.workT = 0; n.promote = null; n.target = null; n.returning = false; returnGear(n);
          n.clsHome = homeCls(n); n.cls = tripCls(n); applyGear(n);
          n.escort = true; n.hold = null; n.parade = { x: EXC.x - 6 + j * 2.2, z }; n.position.set(n.parade.x, 0, z); n.px = n.position.x; n.pz = n.position.z; n.hidden = false; n.hp = n.maxHp;
        });
      });
      exActive.party = party.length;
      player.position.set(EXC.x, 0, EXC.z - 24); facing = 0; player.rotation.y = 0; yaw = 0; DIST = Math.min(DIST_MAX, 26); pitch = 0.95;
      camera.position.copy(goalPos(camGoal)); lookAt.set(player.position.x, LOOK_H, player.position.z);
      exEnding = false; updateExUi(); toast(siege ? 'Siege practice: break the gate, take the keep. Gear is not used up' : `Training Field: ${party.length} soldiers on parade. Pick a practice battle`); Snd.play('horn');
    });
  }
  function trainSpawn(id) {                                                  // 모의 전투: 정해진 적을 불러낸다 (다치지도 보상도 없다)
    if (!exActive || !exActive.training) return;
    const set = CFG.TRAIN.SETS.find(s => s.id === id); if (!set || exActive.dest.siege) return;
    trainClear(true);
    const foes = set.foes.slice(); foes.forEach((kind, i) => {
      const a = (i / Math.max(1, foes.length) - 0.5) * 1.6, p = { x: EXC.x + Math.sin(a) * 18, z: EXC.z - 17 + Math.cos(a) * 4 + (i % 2) * 2 };
      spawnEnemy(kind, p); const u = enemies[enemies.length - 1].userData; u.ex = true; u.practice = true; u.aggro = true;
    });
    exStats.battle = { id, label: set.label, n: foes.length, t0: performance.now(), k0: exStats.kills };
    toast(`${set.label}: ${foes.length} foes. Fight!`); Snd.play('horn');
  }
  function trainDrill() {                                                    // 훈련: 오늘 아직 훈련하지 않은 병사에게 숙련(drill) +2, 병사 한 명당 식량 1 (하루에 한 번만)
    if (!exActive || !exActive.training || exActive.dest.siege) return;
    const K = CFG.TRAIN.DRILL, day = dayNow(), todo = npcs.filter(n => n.escort && n.role !== 'citizen' && !n.levy && n.drillDay !== day);
    if (!todo.length) return toast('Everyone has drilled today');
    const cost = todo.length * K.FOOD; if (res.food < cost) return toast(`Need ${cost} food to drill ${todo.length} soldiers`);
    res.food -= cost; let up = 0;
    for (const n of todo) { const b = vetLv(n); n.vxp = (n.vxp || 0) + K.XP; n.drillDay = day; if (vetLv(n) > b) { up++; floatText(`${n.name}: Veteran ${vetLv(n)}`, n.position.x, 3.0, n.position.z); } npc = n; n.anim.once('attackSword'); }
    updateHud(); Snd.play('chime'); toast(`Drills: ${todo.length} soldiers +${K.XP} drills (${cost} food)${up ? ` · ${up} new veteran rank${up > 1 ? 's' : ''}` : ''}`);
  }
  function trainClear(silent) {
    for (const e of enemies.slice()) if (e.userData.practice) removeEnemy(e);
    if (exStats) exStats.battle = silent ? exStats.battle : null; if (!silent) toast('Field cleared');
  }
  function trainTick(dt) {                                                   // 모의 전투가 끝나면 짧은 보고를 보여 준다
    const B = exStats && exStats.battle; if (!B) return;
    if (enemies.some(e => e.userData.practice && !e.userData.sinking && !(e.userData.dying > 0))) return;
    const secs = Math.round((performance.now() - B.t0) / 1000), down = npcs.filter(n => n.escort && n.hp < n.maxHp * 0.5).length;
    exStats.battle = null;
    showTripReport(`Practice battle: ${B.label}`, [`Foes defeated: ${exStats.kills - B.k0} of ${B.n}`, `Time ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`, `Soldiers badly hurt (would be wounded): ${down}`, 'Practice only: no losses, no rewards.']);
    for (const n of npcs) if (n.escort) n.hp = n.maxHp;
  }
  function endTraining() {
    const ex = exActive; if (!ex || exEnding) return; exEnding = true; gathering = null;
    fadeTo(() => {
      const back = npcs.filter(x => x.escort);
      back.forEach((n, k) => { n.escort = false; n.hold = null; n.parade = null; n.cls = homeCls(n); applyGear(n); n.hp = n.maxHp; const a = k * 2.4, rr = 2 + (k % 3) * 0.9; n.position.set(ex.ret.x + Math.sin(a) * rr, 0, ex.ret.z + Math.cos(a) * rr); n.px = n.position.x; n.pz = n.position.z; n.atkCd = 0; });
      cleanupZone(); exActive = null;
      player.position.set(ex.ret.x, 0, ex.ret.z); camera.position.copy(goalPos(camGoal)); lookAt.set(player.position.x, LOOK_H, player.position.z);
      exEnding = false; updateExUi(); updateHud(); toast('Back from the Training Field');
    });
  }
  document.getElementById('trainBar').addEventListener('pointerdown', e => { const b = e.target.closest('button'); if (!b) return; e.preventDefault(); e.stopPropagation(); const k = b.dataset.tr; if (k === 'clear') trainClear(); else if (k === 'drill') trainDrill(); else if (k === 'leave') endTraining(); else trainSpawn(k); });
