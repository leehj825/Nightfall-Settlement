  // ---------- 분대 (군대 확장 1단계): 병사를 최대 6명씩 분대로 묶는다. 분대가 원정에 함께 나가는 단위다 ----------
  // (이 파일의 것은 모두 function 선언이다: 10-npcs 의 초기 병사 생성이 이 파일보다 먼저 실행되기 때문)
  function isSoldier(n) { return n.role !== 'citizen'; }
  function squadMembers(i) { return npcs.filter(n => isSoldier(n) && n.squad === i); }
  function squadName(i) { return CFG.SQUAD.NAMES[i] || `Squad ${i + 1}`; }
  function squadColor(i) { return (i >= 0 && CFG.SQUAD.COLORS[i]) || '#9aa0aa'; }
  function assignSquad(n) {                                   // 자리가 있는 첫 분대로 (모두 찼으면 분대 없음 -1)
    if (!isSoldier(n)) { n.squad = null; return; }
    n.squad = -1;
    for (let i = 0; i < CFG.SQUAD.MAX; i++) if (squadMembers(i).length < CFG.SQUAD.SIZE) { n.squad = i; break; }
  }
  function cycleSquad(n) {                                    // 카드에서 눌러 다음 분대로 옮긴다 (꽉 찬 분대는 건너뜀)
    const cur = n.squad >= 0 ? n.squad : -1, M = CFG.SQUAD.MAX;
    for (let k = 1; k <= M; k++) {
      const i = (cur + k + M) % M;
      if (i !== cur && squadMembers(i).length < CFG.SQUAD.SIZE) { n.squad = i; return true; }
    }
    return false;
  }
  // 병사 수 상한: 기본 6명 + 병영 1채당 6명 + 사격장 1채당 3명
  function soldierCap() { return CFG.SQUAD.CAP_BASE + CFG.SQUAD.CAP_BARRACKS * builtBuildings('barracks').length + CFG.SQUAD.CAP_RANGE * builtBuildings('range').length; }
  function soldierCount() { return npcs.filter(n => isSoldier(n) || n.promote).length; }
