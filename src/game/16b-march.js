  // ---------- 행군 (원정 지도 2단계): 먼 곳(march 일)으로 가면 며칠이 흐른다. 병사들은 식량을 먹고, 마을의 밤은 자동으로 치른다 ----------
  // (이 파일의 것은 모두 function 선언이다)
  const soldierVal = (n) => 2 + 2 * (n.role === 'melee' ? soldierWeaponDef(n) : gearDef(n.gear.bow)).tier + 1.5 * gearDef(n.gear.armor).tier + 1.5 * vetLv(n);
  function marchPartySize() { return escortPool().filter(n => escortBands.includes(n.warband)).slice(0, CFG.WARBAND.SIZE * bandMax()).length; }
  function marchFood(d) { return d.march ? Math.ceil(marchPartySize() * d.march * 2 * CFG.MAP_RULES.FOOD_PER_SOLDIER_DAY) : 0; }
  function homeThreat(day) {                                              // 그날 밤 마을을 덮칠 적의 수 (startWave 와 같은 식, 무리 크기만)
    const threat = (1 + Math.max(0, prosScore - 40) / 120) * (story.beacon ? 0.85 : 1) * (story.finale ? 0.85 : 1) * (1 - campRelief());
    if (isRaid(day)) return Math.ceil((CFG.WAVE_BASE + day * CFG.WAVE_PER_DAY) * threat * dm().n);
    let n = day <= 2 ? CFG.QUIET_BASE + day : Math.min(CFG.QUIET_MAX, 2 + Math.floor(day / 2));
    const tp = nightTypeOf(day);
    if (tp === 'calm') n = Math.max(1, Math.floor(n * 0.5)); else if (tp === 'plunder') n = Math.ceil(n * 1.5) + 1; else if (tp === 'hunt') n = Math.ceil(n * 1.6) + 1; else if (tp === 'storm') n = Math.ceil(n * 1.2);
    return Math.ceil(n * threat * dm().n);
  }
  function homeGuard(away) {                                              // 마을에 남은 방어력: 남은 병사 + 타워 + 민병 + 성벽 상태
    let d = 0; for (const n of npcs) if (n.role !== 'citizen' && !n.down && !(away ? away.includes(n) : n.escort)) d += soldierVal(n);
    d += builtBuildings('tower').length * 4;
    const f = obstacles.filter(o => o.userData.type === 'fence'), wf = f.length ? f.reduce((a, o) => a + Math.max(0, o.userData.hp) / o.userData.maxHp, 0) / f.length : 0;
    return (d + 4 + npcs.filter(n => n.role === 'citizen').length * 0.4) * (0.7 + 0.3 * wf);
  }
  const nightRatio = (day, away) => homeGuard(away) / (homeThreat(day) * CFG.MAP_RULES.RAIDER_STRENGTH);
  function homeOdds(d) {                                                  // 출발 전 안내: 자리를 비우는 동안의 밤들 가운데 가장 위험한 밤
    const party = escortPool().filter(n => escortBands.includes(n.warband)).slice(0, CFG.WARBAND.SIZE * bandMax());
    let worst = 9; for (let i = 0; i < d.march * 2; i++) worst = Math.min(worst, nightRatio(dayNow() + i, party));
    return worst >= 1.2 ? 'The village should hold' : worst >= 0.6 ? 'Some wall damage is likely' : worst >= 0.3 ? 'Serious losses are likely' : 'The village may be sacked - leave a warband home';
  }
  function resolveHomeNight(day) {                                        // 마을의 밤 하나를 숫자로 치르고, 아침 보고서에 쓸 한 줄을 돌려준다
    const n = homeThreat(day), r = nightRatio(day), fences = obstacles.filter(o => o.userData.type === 'fence');
    const hurt = (frac, dmgFrac) => { for (const o of fences.slice()) if (Math.random() < frac) damageStructure(o, o.userData.maxHp * dmgFrac / dm().dmg); };
    const lose = (f) => { for (const k of ['wood', 'stone', 'food', 'iron']) res[k] = Math.floor(res[k] * (1 - f)); };
    const loseCitizen = () => { const c = npcs.filter(x => x.role === 'citizen'); if (c.length > 1) { const v = c[Math.floor(Math.random() * c.length)]; removeNpc(v); return true; } return false; };
    let msg;
    if (r >= 1.2) msg = `Night ${day}: about ${n} raiders were driven off at the gates.`;
    else if (r >= 0.6) { hurt(0.25, 0.35); msg = `Night ${day}: about ${n} raiders were driven off, but some walls were damaged.`; }
    else if (r >= 0.3) { hurt(0.5, 0.6); lose(0.1); const c = Math.random() < 0.35 && loseCitizen(); msg = `Night ${day}: about ${n} raiders broke through the walls. Walls and stores were hit${c ? ' and a villager was lost' : ''}.`; }
    else { hurt(0.7, 1.2); lose(0.25); let c = 0; for (let i = 0; i < 2; i++) if (Math.random() < 0.6 && loseCitizen()) c++; msg = `Night ${day}: about ${n} raiders overran the village! Walls fell, a quarter of the stores were taken${c ? ` and ${c} villager${c > 1 ? 's' : ''} lost` : ''}.`; }
    updateHud();
    return msg;
  }
  function marchMorningLite() {                                           // 지나가는 아침마다: 시민 식사 (조용히)와 야영지 수입
    for (const c of npcs.filter(x => x.role === 'citizen')) { const need = rationOf(c); if (res.food >= need) { res.food -= need; c.hungry = false; } else c.hungry = true; }
    campIncome(); holdsMorning();
  }
  function marchOut(d) {                                                  // 출발: 같은 시각에 도착하도록 며칠을 넘긴다
    const lines = [], D = dayNow();
    for (let i = 0; i < d.march; i++) { lines.push(resolveHomeNight(D + i)); if (i > 0) marchMorningLite(); }
    gameMin += d.march * 1440;
    return lines;
  }
  function marchBack(d) {                                                 // 귀환: 돌아오는 밤들을 치르고 도착 아침 06:30 에 마을에 선다
    const lines = [], D = dayNow();
    for (let i = 0; i < d.march; i++) { lines.push(resolveHomeNight(D + i)); if (i > 0) marchMorningLite(); }
    gameMin = (D + d.march - 1) * 1440 + 6.5 * 60;
    return lines;
  }
  function showTripReport(title, lines) {
    document.getElementById('repTitle').textContent = title;
    repList.innerHTML = lines.map(t => `<li>${t}</li>`).join('');
    repEl.classList.add('show'); clearTimeout(repTimer); repTimer = setTimeout(() => repEl.classList.remove('show'), 20000);
  }
