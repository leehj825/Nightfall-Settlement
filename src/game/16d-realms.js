  // ---------- 세력 (원정 지도 4단계): 산적 영주 / 언덕 부족 / 강철 군단. 큰 습격은 한 세력이 보낸다. 그 세력의 야영지를 점령할수록 그 세력의 습격이 약해진다 ----------
  // (이 파일의 것은 모두 function 선언이다)
  const realmDef = (id) => CFG.REALMS.find(r => r.id === id) || CFG.REALMS[0];
  const realmSites = (id) => CFG.EXPEDITIONS.filter(d => d.realm === id);
  const realmHeld = (id) => realmSites(id).filter(d => holdOf(d.id)).length;
  const realmOfNight = (day) => isRaid(day) ? CFG.REALMS[(day * 5 + 1) % CFG.REALMS.length].id : null;       // 큰 습격이 오는 밤마다 정해진 세력
  function realmRelief(id) {                                              // 그 세력의 습격이 줄어드는 정도: 기한 중인 효과 + 점령지 (모두 점령하면 크게 꺾인다)
    const fx = story.campFx || [], d = dayNow(), held = story.holds || {};
    const ids = new Set(fx.filter(x => d <= x.until).map(x => x.id).concat(Object.keys(held)));
    let r = 0; for (const s of realmSites(id)) if (ids.has(s.id) && CFG.CAMP_RELIEF[s.id]) r += CFG.CAMP_RELIEF[s.id].pct;
    r = Math.min(CFG.REALM_RELIEF_MAX, r);
    return realmHeld(id) >= realmSites(id).length ? Math.max(r, CFG.REALM_BROKEN) : r;
  }
  function campRelief(day) {                                              // 그날 밤의 습격 감소율 (큰 습격: 그 세력 것, 조용한 밤: 세 세력의 평균)
    if (day === undefined) return Math.max(...CFG.REALMS.map(r => realmRelief(r.id)));
    const rn = realmOfNight(day);
    return rn ? realmRelief(rn) : CFG.REALMS.reduce((a, r) => a + realmRelief(r.id), 0) / CFG.REALMS.length;
  }
  const realmStrength = (id) => Math.max(0.4, 1 - 0.2 * realmHeld(id));      // 점령지가 많을수록 그 세력이 되찾으러 오는 힘도 약해진다
  function realmBar() {                                                    // 일지: 세력별 점령 현황 한 줄
    return `<div class="jrealm">${CFG.REALMS.map(r => `<span style="color:${r.color}">&#9679; ${r.short} ${realmHeld(r.id)}/${realmSites(r.id).length}</span>`).join('')}</div>` + throneLine();
  }
  function realmCheck() {                                                  // 한 세력을 모두 점령하면 한 번 알린다
    story.realmDone = story.realmDone || {};
    for (const r of CFG.REALMS) if (realmHeld(r.id) >= realmSites(r.id).length && !story.realmDone[r.id]) { story.realmDone[r.id] = true; toast(`${r.name} broken!`); Snd.play('victory'); }
  }
