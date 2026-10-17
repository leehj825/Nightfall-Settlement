  // ---------- 끝맺음 (Endgame): 철의 왕좌를 무너뜨리면(story.campaignWon) 승리 화면이 한 번 뜬다. 계속 다스리거나 New Game+ 로 갈 수 있다 ----------
  function throneLine() {                                                   // 일지의 마지막 목표 줄: 세 성을 모두 꺾으면 철의 왕좌로 진군할 수 있다
    const d = CFG.EXPEDITIONS.find(x => x.id === 'ironthrone'); if (!d) return '';
    const need = [].concat(d.after || []), done = need.filter(id => story.cleared && story.cleared[id]).length;
    const txt = story.campaignWon ? 'Iron Throne: taken' : done >= need.length ? 'Iron Throne: open - march when ready' : `Iron Throne: break the three castles (${done}/${need.length})`;
    return `<div class="jrealm"><span style="color:#ffd27a">&#9813; ${txt}</span></div>`;
  }
  const victoryEl = document.getElementById('victory');
  function showVictory() {
    story.victoryShown = true; uiPause = true;
    const broken = CFG.REALMS.filter(r => story.realmDone && story.realmDone[r.id]).length, bld = obstacles.filter(o => o.userData.type === 'building').length;
    document.getElementById('vText').textContent = 'The Iron Warlord is dead and the three realms are broken. The night will never be the same.';
    const rows = [['Days', dayNow()], ['Hero level', pl.lvl], ['Foes defeated', totalKills], ['Population', npcs.length], ['Soldiers', soldierCount()], ['Sites held', holdCount()], ['Realms broken', `${broken}/${CFG.REALMS.length}`], ['Buildings', bld], ['Stage', CFG.STAGES[stage - 1].name], ['Difficulty', CFG.DIFFS[diff].label + (ngLevel ? ' NG+' + ngLevel : '')]];
    document.getElementById('vStats').innerHTML = rows.map(([k, v]) => `<li>${k}<b>${v}</b></li>`).join('');
    victoryEl.classList.add('show'); Snd.play('victory'); try { saveGame(); } catch (e) { /* ignore */ }
  }
  function victoryTick() {                                                  // 원정에서 돌아와 마을에 있을 때 한 번만 띄운다
    if (!story.campaignWon || story.victoryShown || exActive || exEnding || dead || eventOpen || uiPause) return;
    showVictory();
  }
  document.getElementById('vKeep').addEventListener('click', () => { victoryEl.classList.remove('show'); uiPause = false; toast('Endless rule begins: the night still comes'); });
  document.getElementById('vNG').addEventListener('click', () => {
    try { localStorage.setItem('nf_carry', JSON.stringify({ ng: ngLevel + 1, lvl: pl.lvl, st: { ...pl.st } })); sessionStorage.setItem('nf_intent', 'ng'); } catch (e) { /* ignore */ }
    location.reload();
  });
  document.getElementById('vMenu').addEventListener('click', () => {
    try { saveGame(); localStorage.setItem('nf_carry', JSON.stringify({ ng: ngLevel + 1, lvl: pl.lvl, st: { ...pl.st } })); sessionStorage.setItem('nf_intent', 'title'); } catch (e) { /* ignore */ }
    location.reload();
  });
