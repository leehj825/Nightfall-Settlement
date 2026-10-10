  // ---------- 8단계: 자동 저장 / 설정 / 팁 ----------
  const SAVE_KEY = 'nf_save_v1', DEBUG = /[?&]debug/.test(location.search);
  let saveReady = false, uiPause = false;
  const tut = { done: false, step: 0, hints: {} };
  function saveGame() {                                   // 매일 아침과 원정 귀환 때: 마을 상태만 저장한다 (원정 중에는 저장하지 않는다)
    if (!saveReady || dead || exActive || exEnding) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, ts: Date.now(), day: Math.floor(gameMin / 1440) + 1, snap: makeSnapshot(), tut, diff, ng: ngLevel })); } catch (e) {}
  }
  function readSave() {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      return d && d.v === 1 && d.snap && d.snap.res && Array.isArray(d.snap.npcs) ? d : null;
    } catch (e) { return null; }
  }
  function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }
  function loadSave(d) {
    applySnapshot(d.snap);
    Object.assign(tut, { done: false, step: 0, hints: {} }, d.tut || {}); diff = CFG.DIFFS[d.diff] ? d.diff : 'normal'; ngLevel = d.ng || 0;
    checkpoints.length = 0; saveCheckpoint('Loaded save');
    toast(`Continuing from Day ${d.day}`);
  }

  // 설정 (볼륨 · 글자 크기 · 그래픽)
  const setEl = document.getElementById('setPanel'), settings = { text: 'm', gfx: 'hi', haptic: true, hand: 'r', bsz: 'm' };
  try { Object.assign(settings, JSON.parse(localStorage.getItem('nf_settings') || '{}')); } catch (e) {}
  function applySettings() {
    document.documentElement.dataset.ts = settings.text; document.documentElement.dataset.hand = settings.hand; document.documentElement.dataset.bsz = settings.bsz;
    const lo = settings.gfx === 'lo';
    renderer.setPixelRatio(lo ? 1 : Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight, false);
    renderer.shadowMap.enabled = !lo; sun.castShadow = !lo;
    scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.needsUpdate = true); });
  }
  // 느린 기기 자동 대응: 터치 기기에서 처음 몇 초의 프레임이 낮으면 그래픽을 '낮음'으로 바꾸고 알려 준다 (한 번만, 직접 고른 설정은 건드리지 않는다)
  const fpsLog = [];
  setInterval(() => {
    if (settings.auto || settings.gfx === 'lo' || !saveReady || uiPause || eventOpen || document.hidden || !window.__nfFps) return;
    fpsLog.push(window.__nfFps); if (fpsLog.length > 8) fpsLog.shift();
    if (fpsLog.length === 8 && (/[?&]autoq/.test(location.search) || matchMedia('(pointer: coarse)').matches) && fpsLog.reduce((a, b) => a + b, 0) / 8 < 26) {
      settings.gfx = 'lo'; settings.auto = true; saveSettings(); applySettings(); toast('Graphics set to Low for smoother play (change it in Settings)');
    }
  }, 1000);
  function saveSettings() { try { localStorage.setItem('nf_settings', JSON.stringify(settings)); } catch (e) {} }
  function openSettings() {
    document.getElementById('setMusic').value = Math.round(Snd.getVol('music') * 100);
    document.getElementById('setSfx').value = Math.round(Snd.getVol('sfx') * 100);
    { const sd = document.getElementById('setDiff'); if (!sd.options.length) Object.entries(CFG.DIFFS).forEach(([id, d]) => sd.add(new Option(d.label, id))); sd.value = diff; }
    document.getElementById('setHand').value = settings.hand; document.getElementById('setBsz').value = settings.bsz;
    document.getElementById('setHaptic').value = settings.haptic === false ? 'off' : 'on';
    document.getElementById('setText').value = settings.text; document.getElementById('setGfx').value = settings.gfx;
    const d = readSave(); document.getElementById('setSaveInfo').textContent = d ? `Saved: Day ${d.day} (auto-saves every morning)` : 'No save yet - the game auto-saves every morning';
    uiPause = true; setEl.style.display = 'flex';
  }
  function closeSettings() { uiPause = false; setEl.style.display = 'none'; }
  document.getElementById('setBtn').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); Snd.init(); setEl.style.display === 'flex' ? closeSettings() : openSettings(); });
  document.getElementById('setClose').addEventListener('click', closeSettings);
  document.getElementById('setMusic').addEventListener('input', e => Snd.setVol('music', e.target.value / 100));
  document.getElementById('setSfx').addEventListener('input', e => Snd.setVol('sfx', e.target.value / 100));
  document.getElementById('setText').addEventListener('change', e => { settings.text = e.target.value; saveSettings(); applySettings(); });
  document.getElementById('setDiff').addEventListener('change', e => { diff = e.target.value; try { localStorage.setItem('nf_diff', diff); } catch (x) {} toast(`Difficulty: ${CFG.DIFFS[diff].label}`); saveGame(); });
  document.getElementById('setHand').addEventListener('change', e => { settings.hand = e.target.value; saveSettings(); applySettings(); });
  document.getElementById('setBsz').addEventListener('change', e => { settings.bsz = e.target.value; saveSettings(); applySettings(); });
  document.getElementById('setHaptic').addEventListener('change', e => { settings.haptic = e.target.value === 'on'; saveSettings(); buzz(60); });
  document.getElementById('setGfx').addEventListener('change', e => { settings.gfx = e.target.value; settings.auto = true; saveSettings(); applySettings(); });
  document.getElementById('setTips').addEventListener('click', () => { Object.assign(tut, { done: false, step: 0, hints: {} }); closeSettings(); toast('Tips restarted'); });
  document.getElementById('setDel').addEventListener('click', e => {
    if (e.target.dataset.sure !== '1') { e.target.dataset.sure = '1'; e.target.textContent = 'Tap again to confirm'; return; }
    clearSave(); e.target.dataset.sure = ''; e.target.textContent = 'Delete save'; document.getElementById('setSaveInfo').textContent = 'Save deleted'; toast('Save deleted');
  });
  applySettings();

  // 팁: 첫 며칠 동안 지금 할 일을 한 줄로 알려 주고, 처음 만나는 시스템은 한 번만 안내한다
  const tutEl = document.getElementById('tutor'), tutTxt = document.getElementById('tutorTxt');
  const TUT = [
    { text: 'Tap Defense Line to plan a fence - soldiers build it', done: () => designTier > 0 || blueprints.length > 0 || obstacles.some(o => o.userData.type === 'fence') },
    { text: 'Survive the night near the campfire', done: () => gameMin >= 1440 + CFG.RESPAWN_HOUR * 60 },
    { text: 'Defeat raiders to level up, then pick an upgrade', done: () => pl.lvl >= 2 && pl.pend === 0 },
    { text: 'Tap Plan Town Buildings', done: () => townStage > 0 },
    { text: 'Raise your Age at the Town Hall (T)', done: () => age >= 2 },
  ];
  function tutorStep() {
    if (exActive) { tutEl.style.display = 'none'; return; }
    if (!saveReady || dead || eventOpen || uiPause) return;
    if (!tut.done && tut.step < TUT.length && TUT[tut.step].done()) { tut.step++; toast('Good work!'); }
    if (tut.step >= TUT.length) tut.done = true;
    const show = !tut.done && !tut.off;
    tutEl.style.display = show ? 'flex' : 'none';
    if (show) tutTxt.textContent = TUT[tut.step].text;
    const hint = (k, msg) => { if (!tut.hints[k]) { tut.hints[k] = 1; toast(msg); } };
    if (smiths().length) hint('smith', 'Blacksmith ready: walk up and press C to craft gear');
    if (npcs.length && res.food < 1 && gameMin > 1440 * 1) hint('food', 'Citizens eat at dawn - build farms to keep food stocked');
    if (story.intro) hint('journal', 'New: Journal (J) - head out on expeditions for rare loot');
  }
  setInterval(tutorStep, 700);
  document.getElementById('tutorX').addEventListener('click', () => { tut.off = true; tutEl.style.display = 'none'; });

  // ---------- 11단계: 업적 (브라우저에 저장되어 새 게임을 해도 남는다) ----------
  const ACH = [
    { id: 'night1', name: 'First Dawn', desc: 'Survive the first night', test: () => dayNow() >= 2 },
    { id: 'week', name: 'A Whole Week', desc: 'Reach Day 7', test: () => dayNow() >= 7 },
    { id: 'boss', name: 'Behemoth Slayer', desc: 'Defeat the Behemoth', test: () => chapterCleared },
    { id: 'age2', name: 'Wooden Town', desc: 'Reach Age 2', test: () => age >= 2 },
    { id: 'age3', name: 'Stone Keep', desc: 'Reach Age 3', test: () => age >= 3 },
    { id: 'pop10', name: 'Busy Streets', desc: 'Have 10 villagers', test: () => npcs.length >= 10 },
    { id: 'smith', name: 'Hammer and Anvil', desc: 'Build a Blacksmith', test: () => smiths().length > 0 },
    { id: 'armed', name: 'Armed to the Teeth', desc: 'Have 3 soldiers wearing armor', test: () => npcs.filter(n => n.role !== 'citizen' && n.gear.armor !== 'armor_none').length >= 3 },
    { id: 'master', name: 'Master Craftsman', desc: 'Train a citizen to Master level', test: () => npcs.some(n => Object.values(n.xp || {}).some(v => v >= CFG.SKILL_XP[3])) },
    { id: 'lvl3', name: 'Grand Works', desc: 'Upgrade a workshop to level 3', test: () => CFG.LEVELED.some(k => builtBuildings(k).some(o => lvOf(o) >= 3)) },
    { id: 'rich', name: 'Full Granary', desc: 'Store 100 Food', test: () => res.food >= 100 },
    { id: 'prosper', name: 'Flourishing', desc: 'Reach Flourishing prosperity (80+)', test: () => prosScore >= 80 },
    { id: 'winter', name: 'Through the Cold', desc: 'Live through a whole winter', test: () => CFG.SEASONS_ON && dayNow() >= CFG.SEASON_DAYS * 4 + 1 },
    { id: 'merchant', name: 'Good Business', desc: 'Trade with a travelling merchant' },
    { id: 'clear', name: 'Site Cleared', desc: 'Clear an expedition site completely' },
    { id: 'escort', name: 'Never Alone', desc: 'Return from an expedition with an escort' },
    { id: 'camp1', name: 'Outpost', desc: 'Build a camp', test: () => Object.keys(story.camps).length >= 1 },
    { id: 'camp3', name: 'Supply Line', desc: 'Build 3 camps', test: () => Object.keys(story.camps).length >= 3 },
    { id: 'storm', name: 'Stormproof', desc: 'Survive a thunderstorm night' },
    { id: 'hunt', name: 'Pack Breaker', desc: 'Survive a wolf hunt night' },
    { id: 'nightmarket', name: 'Lantern Trade', desc: 'Buy something from the lantern merchant' },
    { id: 'tales', name: 'Storyteller', desc: 'Hear 5 fireside tales', test: () => Object.keys(story.tales || {}).length >= 5 },
    { id: 'ng1', name: 'Again, Stronger', desc: 'Begin a New Game+', test: () => ngLevel >= 1 },
    { id: 'hardwin', name: 'Hard Road', desc: 'Finish the story on Hard or Nightmare', test: () => story.finale && (diff === 'hard' || diff === 'nightmare') },
    { id: 'wide', name: 'Keeper of the Road', desc: 'Light the Wide Road (Chapter 5)', test: () => story.wide },
    { id: 'dusk', name: 'The Long Dawn', desc: 'End the Eclipse (Chapter 6)', test: () => story.dusk },
    { id: 'champ3', name: 'Champion Slayer', desc: 'Defeat 3 Champions in endless mode', test: () => (story.champs || 0) >= 3 },
    { id: 'champ10', name: 'Name Taker', desc: 'Defeat 10 Champions in endless mode', test: () => (story.champs || 0) >= 10 },
    { id: 'kills500', name: 'Five Hundred', desc: 'Defeat 500 enemies in one run', test: () => totalKills >= 500 },
    { id: 'day50', name: 'Half a Hundred', desc: 'Survive to Day 50', test: () => dayNow() >= 50 },
    { id: 'day15', name: 'Fifteen Days', desc: 'Survive to Day 15', test: () => dayNow() >= 15 },
    { id: 'day30', name: 'A Month of Nights', desc: 'Survive to Day 30', test: () => dayNow() >= 30 },
    { id: 'lvl5', name: 'Veteran', desc: 'Reach player level 5', test: () => pl.lvl >= 5 },
    { id: 'lvl10', name: 'Legend', desc: 'Reach player level 10', test: () => pl.lvl >= 10 },
    { id: 'beacon', name: 'Light in the Dark', desc: 'Light the Beacon', test: () => story.beacon },
    { id: 'dawn', name: 'Dawn Gate', desc: 'Open the Dawn Gate', test: () => story.dawn },
    { id: 'crown', name: 'Winter Crown', desc: 'Take the Winter Crown', test: () => story.crown },
    { id: 'echo', name: 'Voices of the Keepers', desc: 'Recover the Echo Stone', test: () => !!story.relics.barrow },
    { id: 'finale', name: 'The Last Keeper', desc: 'Defeat the Hollow King and swear the Keeper\'s Oath', test: () => story.finale },
  ];
  let achSave = {};
  try { achSave = JSON.parse(localStorage.getItem('nf_ach') || '{}') || {}; } catch (e) { achSave = {}; }
  const achBanner = document.createElement('div'); achBanner.id = 'achBanner'; document.body.appendChild(achBanner); let achTimer;
  function unlockAch(id) {
    const a = ACH.find(x => x.id === id);
    if (!a || achSave[id]) return;
    achSave[id] = Date.now(); try { localStorage.setItem('nf_ach', JSON.stringify(achSave)); } catch (e) {}
    achBanner.textContent = `🏆 ${a.name} - ${a.desc}`; achBanner.classList.add('show'); clearTimeout(achTimer); achTimer = setTimeout(() => achBanner.classList.remove('show'), 3800); Snd.play('chime');
  }
  function achStep() { if (!saveReady || dead) return; for (const a of ACH) if (a.test && !achSave[a.id]) { let ok = false; try { ok = !!a.test(); } catch (e) {} if (ok) unlockAch(a.id); } }
  setInterval(achStep, 1000);
  const achEl = document.getElementById('achPanel');
  function openAch() {
    const n = ACH.filter(a => achSave[a.id]).length;
    document.getElementById('achCount').textContent = `${n} / ${ACH.length} unlocked`;
    document.getElementById('achList').innerHTML = ACH.map(a => `<div class="ach ${achSave[a.id] ? 'got' : ''}"><span>${achSave[a.id] ? '🏆' : '🔒'}</span><div><b>${a.name}</b><small>${a.desc}</small></div></div>`).join('');
    achEl.style.display = 'flex';
  }
  document.getElementById('setAch').addEventListener('click', () => { closeSettings(); uiPause = true; openAch(); });
  document.getElementById('achClose').addEventListener('click', () => { achEl.style.display = 'none'; uiPause = false; });

  // 시작 화면: 저장이 있으면 이어하기 / 새 게임 / (엔딩을 본 적이 있으면) 새 게임+
  const readCarry = () => { try { const c = JSON.parse(localStorage.getItem('nf_carry') || 'null'); return c && c.ng >= 1 && c.lvl >= 1 ? c : null; } catch (e) { return null; } };
  function bootGame() {
    const d = readSave(), carry = readCarry();
    if ((d || carry) && (!DEBUG || /[?&]load/.test(location.search))) {
      const p = document.getElementById('startPanel'); uiPause = true;
      document.getElementById('startInfo').textContent = d ? `Saved game: Day ${d.day} - ${new Date(d.ts).toLocaleString()}` : 'Welcome back';
      document.getElementById('startContinue').style.display = d ? '' : 'none';
      const ngBtn = document.getElementById('startNG'); ngBtn.style.display = carry ? '' : 'none'; if (carry) ngBtn.textContent = `New Game+ ${carry.ng} (keep Lv ${carry.lvl})`;
      p.style.display = 'flex';
      const begin = () => { p.style.display = 'none'; uiPause = false; clearSave(); saveReady = true; setTimeout(openDifficultyChoice, 700); saveCheckpoint('Day 1 start'); };
      document.getElementById('startContinue').addEventListener('click', () => { p.style.display = 'none'; uiPause = false; saveReady = true; loadSave(d); });
      document.getElementById('startNew').addEventListener('click', () => { ngLevel = 0; begin(); });
      ngBtn.addEventListener('click', () => { ngLevel = carry.ng; Object.assign(pl, { lvl: carry.lvl, xp: 0, pend: 0 }); pl.st = Object.assign({ hp: 0, dmg: 0, spd: 0, dash: 0, ult: 0, leech: 0, guard: 0, rally: 0 }, carry.st || {}); updateLvlUi(); begin(); });
      return;
    }
    saveReady = true;
    if (DEBUG) { setClass('warrior'); choosePerk(1, 'forager'); } else setTimeout(openDifficultyChoice, 700);
    saveCheckpoint('Day 1 start');
  }
  updateAgeUi(); updateTownBtn(); updateRaidUi(8, 1);
  bootGame();      // 처음 시작할 때 역할 선택 (저장이 있으면 이어하기 선택)
  if (/[?&]debug/.test(location.search)) window.__nf = { terrSpd, terrH, spawnChampion, CFG, res, npcs, enemies, obstacles, playerGear, player, setMin: m => { gameMin = m; }, getMin: () => gameMin, debugSetup, spawnEnemy, setClass, toggleBird, toggleOrder, choosePerk, openPerk, perks, rally: () => rally(), get bird() { return bird; }, scene, blueprints, makeRock, designDefense, designTown, exObjs, story, startExpedition, endExpedition, checkStory, get exActive() { return exActive; }, EVENTS, openEvent, nightTypeOf, openNpcCard, checkDepartures, snap: () => makeSnapshot(), recordBest, endlessMilestone, dm, get diff() { return diff; }, set diff(v) { diff = v; }, get ngLevel() { return ngLevel; }, set ngLevel(v) { ngLevel = v; }, scaleHp, readCarry, nightExpWhy, fireTale, nextTale, nightMerchantMenu, get nmActive() { return nmActive; }, NIGHT_EVENTS, get peaceT() { return peaceT; }, wave, hitEnemyDbg: (e) => hitEnemy(e, 999, e.position.x - 1, e.position.z, false, null, true), toggleRest, canRest, get resting() { return resting; }, vetLv, powerOf, needOf, pl, giveXp, openLevelPick, isRaid, checkStoryAll, unlockAch, achSave, achStep, ACH, openEvent, nightTypeOf, setEscort: n => { escortN = n; }, buildCamp, campIncome, storyChain, campMeshes, upgradeBuildings, rollSickness, seasonTick, season, citizens, merchantVisit, nextPref, jobTitle, bLevel, skillLv, saveGame, readSave, loadSave, tut, TUT, tutorStep, get saveReady() { return saveReady; }, settings, restore: sn => applySnapshot(sn), feedCitizens, openSmith, get peaceful() { return peaceful; } };
  tick();
})();
