  // ---------- 점령지 (원정 지도 3단계): 무너뜨린 야영지에 병사를 남겨 지키면 '점령지'가 된다. 수입과 습격 감소가 계속되지만 적이 되찾으러 올 수 있다 ----------
  // (이 파일의 것은 모두 function 선언이다) story.holds[id] = { n: 주둔 병사 수, since: 날 }, story.clearedDay[id] = 마지막으로 무너뜨린 날
  const HOLD_MAX = 3, HOLD_REVERT_DAYS = 10, HOLD_RANK = { clanwatch: 1.2, legionpost: 1.4, clanhold: 2.2, legionkeep: 2, legioncastle: 2.6, legionfortress: 3.2, raiderpost: 1, banditcamp: 1.4, hillclan: 1.4, banditfort: 2, legionfort: 2.4 };
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
    const name = s.name; garrisonOut(s);
    if (h) h.n++; else { story.holds[id] = { n: 1, since: dayNow() }; story.camps[id] = true; rebuildCamps(); }
    toast(`${name} garrisons ${d.name}`); Snd.play('chime'); updateHud(); realmCheck(); renderJournal();
  }
  function holdsMorning() {                                                // 매일 아침: 주둔 병사의 식량, 되찾으러 오는 적, 방치된 곳의 복귀
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
    if (h) { const r = holdRisk(d.id); return `<small>&#9873; Held ${h.n}/${HOLD_MAX} · ${inc}/day · retake ${Math.round(r.chance * 100)}%/day, hold ${Math.round(r.win * 100)}%<br><button class="holdBtn" data-hold="${d.id}" ${h.n >= HOLD_MAX ? 'disabled' : ''}>+1 soldier</button></small>`; }
    if (story.camps[d.id]) return `<small>&#10003; Camp ${inc}/day</small>`;
    if (story.cleared[d.id]) { const cd = (story.clearedDay || {})[d.id]; return `<small>Broken${cd === undefined ? '' : ` · lost in ${Math.max(0, HOLD_REVERT_DAYS - (dayNow() - cd))}d`}<br><button class="holdBtn" data-hold="${d.id}">Garrison (1 soldier)</button></small>`; }
    return '';
  }
