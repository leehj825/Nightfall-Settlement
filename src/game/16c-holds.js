  // ---------- 점령지 (원정 지도 3단계): 무너뜨린 야영지에 병사를 남겨 지키면 '점령지'가 된다. 수입과 습격 감소가 계속되지만 적이 되찾으러 올 수 있다 ----------
  // (이 파일의 것은 모두 function 선언이다) story.holds[id] = { n: 주둔 병사 수, since: 날 }, story.clearedDay[id] = 마지막으로 무너뜨린 날
  const HOLD_MAX = 3, HOLD_REVERT_DAYS = 10, HOLD_RANK = { clanwatch: 1.2, legionpost: 1.4, clanhold: 2.2, legionkeep: 2, legioncastle: 2.6, legionfortress: 3.2, clancastle: 2.6, banditcastle: 2.6, ironthrone: 3.6, raiderpost: 1, banditcamp: 1.4, hillclan: 1.4, banditfort: 2, legionfort: 2.4 };
  const holdOf = (id) => (story.holds || {})[id] || null;
  const holdCount = () => Object.values(story.holds || {}).reduce((a, h) => a + h.n, 0);
  function holdRisk(id) {                                                  // 하루에 되찾으러 올 확률과, 왔을 때 지킬 확률
    const h = holdOf(id), d0 = CFG.EXPEDITIONS.find(x => x.id === id), rank = (HOLD_RANK[id] || 1) * (d0 && d0.realm ? realmStrength(d0.realm) : 1), n = h ? h.n : 1, chance = Math.min(0.5, 0.06 * rank / n), atk = 6 * rank + dayNow() * 0.4, ratio = (n * 9) / atk;
    return { chance, win: Math.min(1, ratio) };
  }
  function pickGarrison() {                                                // 마을에 남은 병사 가운데 가장 약한 병사
    let best = null, bv = 1e9;
    for (const n of npcs) if (n.role !== 'citizen' && !n.escort && !n.down && !n.promote) { const v = soldierVal(n); if (v < bv) { bv = v; best = n; } }
    return best;
  }
  function garrisonOut(n) {                                                // 병사를 마을에서 빼서 점령지로 보낸다 (죽은 것이 아니므로 애도 없음)
    npc = n; setTask(null); returnGear(n); scene.remove(n); npcs.splice(npcs.indexOf(n), 1);
  }
  function garrisonIt(id) {
    const d = CFG.EXPEDITIONS.find(x => x.id === id); if (!d || !d.raid || !story.cleared[id]) return;
    story.holds = story.holds || {}; const h = story.holds[id];
    if (h && h.n >= HOLD_MAX) return toast('Garrison is full');
    const s = pickGarrison(); if (!s) return toast('No free soldier');
    const name = s.name, man = { name: s.name, trait: s.trait, xp: { ...(s.xp || {}) }, vxp: s.vxp || 0, cstr: s.cstr || 0, cspd: s.cspd || 0 }; garrisonOut(s);
    if (h) { h.n++; (h.men = h.men || []).push(man); } else { story.holds[id] = { n: 1, since: dayNow(), men: [man] }; story.camps[id] = true; rebuildCamps(); }
    toast(`${name} garrisons ${d.name}`); Snd.play('chime'); updateHud(); realmCheck(); renderJournal();
  }
  function recallGarrison(id) {                                            // 점령지에 둔 병사 한 명을 마을로 불러온다 (이름·성격·숙련은 그대로)
    const d = CFG.EXPEDITIONS.find(x => x.id === id), h = holdOf(id); if (!d || !h) return;
    const man = (h.men && h.men.pop()) || {}, n = makeNpc('melee', homeSlot(npcs.length), 'initial', 0, { name: man.name, trait: man.trait, xp: man.xp });
    if (man.vxp) n.vxp = man.vxp; n.cstr = man.cstr || 0; n.cspd = man.cspd || 0;
    h.n--; if (h.n <= 0) { delete story.holds[id]; (story.clearedDay = story.clearedDay || {})[id] = dayNow(); }          // 마지막 병사가 돌아오면 열흘 뒤 다시 산적이 차지한다
    toast(`${n.name} returns from ${d.name}`); Snd.play('chime'); updateHud(); realmCheck(); renderJournal();
  }
  function holdsMorning() {                                                // 매일 아침: 주둔 병사의 식량, 되찾으러 오는 적, 방치된 곳의 복귀
    woundsMorning();
    const hs = story.holds || {}, day = dayNow(), lines = [];
    for (const id of Object.keys(hs)) {
      const d = CFG.EXPEDITIONS.find(x => x.id === id), h = hs[id]; if (!d) continue;
      res.food = Math.max(0, res.food - h.n);                              // 주둔 병사는 하루에 식량 1씩
      const r = holdRisk(id);
      if (Math.random() < r.chance) {
        if (Math.random() < r.win) lines.push(`${d.name} held.`);
        else { delete hs[id]; story.camps[id] = false; story.cleared[id] = false; rebuildCamps(); lines.push(`${d.name} fell. Garrison lost.`); }
      }
    }
    const cd = story.clearedDay || {};
    for (const id of Object.keys(story.cleared || {})) {                    // 지키는 병사가 없는 야영지는 열흘 뒤 산적이 다시 차지한다
      const d = CFG.EXPEDITIONS.find(x => x.id === id);
      if (d && d.raid && story.cleared[id] && !hs[id] && cd[id] !== undefined && day - cd[id] >= HOLD_REVERT_DAYS) { story.cleared[id] = false; story.camps[id] = false; rebuildCamps(); lines.push(`Bandits retook ${d.name}.`); }
    }
    if (lines.length) setTimeout(() => toast(lines.join(' ')), 2400);
  }
  function holdHtml(d) {                                                   // 일지 카드: 점령 상태와 버튼 (글은 짧게)
    if (!d.raid) return '';
    const h = holdOf(d.id), inc = Object.entries(CFG.CAMPS[d.id] || {}).map(([k, v]) => `+${v} ${k}`).join(' ');
    if (h) { const r = holdRisk(d.id); return `<small>&#9873; Held ${h.n}/${HOLD_MAX} · ${inc}/day · retake ${Math.round(r.chance * 100)}%/day, hold ${Math.round(r.win * 100)}%<br><button class="holdBtn" data-hold="${d.id}" ${h.n >= HOLD_MAX ? 'disabled' : ''}>+1 soldier</button> <button class="holdBtn" data-recall="${d.id}">Bring 1 home</button></small>`; }
    if (story.camps[d.id]) return `<small>&#10003; Camp ${inc}/day</small>`;
    if (story.cleared[d.id]) { const cd = (story.clearedDay || {})[d.id]; return `<small>Broken${cd === undefined ? '' : ` · lost in ${Math.max(0, HOLD_REVERT_DAYS - (dayNow() - cd))}d`}<br><button class="holdBtn" data-hold="${d.id}">Garrison (1 soldier)</button></small>`; }
    return '';
  }
  const levyCount = () => npcs.filter(n => n.levy).length;
  function callLevy() {                                                      // 농민병 소집: 식량을 내고 약한 임시 병사를 하나 부른다 (다음 원정 한 번만)
    if (exActive || dead) return;
    if (levyCount() >= CFG.LEVY.MAX) return toast('No more villagers can be called');
    if (res.food < CFG.LEVY.FOOD) return toast(`Need ${CFG.LEVY.FOOD} food`);
    res.food -= CFG.LEVY.FOOD; const k = levyCount() + 1, n = makeNpc('melee', homeSlot(npcs.length), 'initial', 0, { name: `Levy ${k}` });
    n.levy = true; n.warband = -3; n.maxHp = Math.round(n.maxHp * CFG.LEVY.HP); n.hp = n.maxHp; applyGear(n);
    toast(`${n.name} called up`); Snd.play('horn', 0.5); updateHud(); renderJournal();
  }
  function dismissLevy(n) { npc = n; scene.remove(n); const i = npcs.indexOf(n); if (i >= 0) npcs.splice(i, 1); }
  const woundedList = () => npcs.filter(n => n.woundDays > 0);
  function tendWounded() {                                                   // 식량을 내고 부상병을 모두 바로 낫게 한다 (부상 하루당 식량 3)
    const w = woundedList(); if (!w.length) return;
    const cost = w.reduce((a, n) => a + n.woundDays, 0) * CFG.WOUND.TEND_FOOD;
    if (res.food < cost) return toast(`Need ${cost} food to tend them`);
    res.food -= cost; for (const n of w) { n.woundDays = 0; n.sitting = false; } updateHud(); toast(`${w.length} wounded tended (${cost} food)`); Snd.play('heal', 0.5); renderJournal();
  }
  function woundsMorning() {                                                 // 아침: 부상이 줄어든다 (마을에 치료사가 있으면 하루 더), 불려 온 농민병은 돌아간다, 용기는 조금씩 되돌아온다
    const medic = Math.min(2, npcs.filter(n => n.role === 'melee' && !n.escort && !n.down && !n.levy && homeCls(n) === 'medic').length) * CFG.WOUND.MEDIC_EXTRA;
    for (const n of npcs) if (n.woundDays > 0) n.woundDays = Math.max(0, n.woundDays - 1 - medic - (builtBuildings('infirmary').length ? 1 : 0));       // 병원이 있으면 하루 더 빨리 낫는다
    { const seats = CFG.YARD_SEATS * builtBuildings('trainyard').length;                                    // 훈련소: 집에 있는 병사가 아침마다 숙련 +1
      if (seats) { const pool = npcs.filter(n => n.role !== 'citizen' && !n.levy && !n.escort && !n.down && !(n.woundDays > 0)).slice(0, seats); let up = 0; for (const n of pool) { const b = vetLv(n); n.vxp = (n.vxp || 0) + CFG.YARD_XP; if (vetLv(n) > b) up++; } if (pool.length) setTimeout(() => toast(`Yard drills: ${pool.length} soldiers trained${up ? ` · ${up} new veteran rank${up > 1 ? 's' : ''}` : ''}`), 2500); } }
    { const mills = builtBuildings('windmill').length; if (mills) res.food += CFG.WINDMILL_FOOD * mills; }       // 풍차는 아침마다 식량
    for (const n of npcs.filter(x => x.levy && !x.escort)) dismissLevy(n);
    const c = courageOf(), K = CFG.COURAGE.START + (hasPerk('banneret') ? 10 : 0), D = CFG.COURAGE.DRIFT * (hasPerk('banneret') ? 1.6 : 1); story.courage = c < K ? Math.min(K, c + D) : c > K ? Math.max(K, c - D) : c;
    if (res.food <= 0 && npcs.some(n => n.role !== 'citizen')) addCourage(-CFG.COURAGE.HUNGRY);
    if (builtBuildings('monument').length) addCourage(CFG.MONUMENT_COURAGE);                // 승전 기념비: 아침마다 사기 +3 (드리프트 뒤에 더한다)
  }
