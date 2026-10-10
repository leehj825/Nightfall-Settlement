  // ---------- 아침 이벤트: 선택에 따라 득실이 갈리는 짧은 사건 (창이 열려 있는 동안 시간이 멈춘다) ----------
  let eventOpen = false, pendingRaiders = 0; const eventQueue = [];
  const evEl = document.getElementById('eventPanel'), evBtns = document.getElementById('evBtns');
  const citizens = () => npcs.filter(n => n.role === 'citizen' && !n.down);
  function spawnCitizens(k) {
    const houses = builtBuildings('house'); let made = 0;
    for (let i = 0; i < k && houses.length; i++) { const door = doorOf(houses[(npcs.length + i) % houses.length]); const c = makeNpc('citizen', door, 'citizen', i * 0.15); c.position.set(door.x, 0, door.z); made++; }
    report.newCit += made; return made;
  }
  const moodAll = (x) => npcs.forEach(n => { n.mood = Math.max(0, Math.min(100, n.mood + x)); });
  const dayNow = () => Math.floor(gameMin / 1440) + 1;
  const tinkerTarget = () => CFG.LEVELED.flatMap(k => builtBuildings(k)).find(o => lvOf(o) < age);
  const EVENTS = [
    { id: 'merchant', title: 'Wandering Merchant', text: 'A cart rolls up to the gate. The merchant offers a few fair trades.', opts: [
      { label: 'Trade 12 Food for 4 Iron', ok: () => res.food >= 12, run: () => { res.food -= 12; res.iron += 4; return 'Deal done: +4 Iron'; } },
      { label: 'Trade 15 Wood for 8 Food', ok: () => res.wood >= 15, run: () => { res.wood -= 15; res.food += 8; return 'Deal done: +8 Food'; } },
      { label: 'Send the merchant away', alt: true, run: () => 'The merchant moves on' } ] },
    { id: 'refugees', title: 'Refugee Family', text: 'A tired family asks for shelter behind your walls. They will need feeding.', avail: () => npcs.length < maxPop() && builtBuildings('house').length > 0, opts: [
      { label: 'Welcome them', sub: 'Costs 6 Food · up to 2 new citizens', ok: () => res.food >= 6, run: () => { res.food -= 6; const k = spawnCitizens(Math.min(2, maxPop() - npcs.length)); return `${k} new citizen${k > 1 ? 's' : ''} joined the village`; } },
      { label: 'Turn them away', alt: true, run: () => 'The family walks on into the dusk' } ] },
    { id: 'caravan', title: 'Abandoned Caravan', text: 'Wreckage lies beside the road, still full of supplies. Something may be watching it.', opts: [
      { label: 'Scavenge it', sub: '+25 Wood, +15 Stone, +3 Iron · 3 more raiders tonight', run: () => { res.wood += 25; res.stone += 15; res.iron += 3; pendingRaiders += 3; return 'Loaded up the cart. Raiders may follow...'; } },
      { label: 'Leave it alone', alt: true, run: () => 'Better safe than sorry' } ] },
    { id: 'sickness', title: 'Sickness Rumor', text: 'Travelers brought coughs into the village. A few people look pale.', avail: () => citizens().length > 0, opts: [
      { label: 'Quarantine the travelers', sub: 'Costs 8 Food', ok: () => res.food >= 8, run: () => { res.food -= 8; return 'The sickness never spreads'; } },
      { label: 'Ignore it', sub: 'Up to 2 citizens fall ill for a few days (slower, gloomy)', alt: true, run: () => { const c = citizens().filter(n => !(n.sick > 0)).slice(0, 2); c.forEach(n => { n.sick = CFG.SICK_DAYS + 1; }); return c.length ? `${c.length} citizen${c.length > 1 ? 's' : ''} fell ill` : 'Nobody fell ill'; } } ] },
    { id: 'bard', title: 'Travelling Bard', text: 'A bard with a battered lute asks for a meal and offers songs for the evening.', avail: () => citizens().length > 0, opts: [
      { label: 'Feed the bard', sub: 'Costs 6 Food · everyone feels better (+15 mood)', ok: () => res.food >= 6, run: () => { res.food -= 6; moodAll(15); return 'Songs by the fire lift everyone\'s spirits'; } },
      { label: 'No time for songs', alt: true, run: () => 'The bard wanders on' } ] },
    { id: 'wolves', title: 'Hungry Wolves', text: 'Wolves circle the fields at dawn, thin and bold.', avail: () => dayNow() >= 3, opts: [
      { label: 'Drive them off yourself', sub: 'You lose 25 HP · +6 Food from the pelts', run: () => { hp = Math.max(1, hp - 25); hpEl.textContent = Math.ceil(hp); res.food += 6; return 'The wolves flee. You are bruised.'; } },
      { label: 'Leave food at the edge', sub: 'Costs 10 Food', ok: () => res.food >= 10, run: () => { res.food -= 10; return 'The wolves take the bait and leave'; } },
      { label: 'Ignore them', sub: 'Two citizens panic (-12 mood)', alt: true, run: () => { citizens().slice(0, 2).forEach(n => { n.mood = Math.max(0, n.mood - 12); }); return 'The wolves are gone by noon, but nerves are frayed'; } } ] },
    { id: 'stray', title: 'A Stray Dog', text: 'A scruffy dog trots into the village and refuses to leave.', avail: () => citizens().length > 0, opts: [
      { label: 'Let it stay', sub: 'Everyone is a little happier (+8 mood)', run: () => { moodAll(8); return 'The dog has found a home'; } },
      { label: 'Shoo it away', alt: true, run: () => 'The dog slinks off' } ] },
    { id: 'tinker', title: 'Wandering Smith', text: 'A smith with a pack of tools offers to improve one of your workshops.', avail: () => !!tinkerTarget(), opts: [
      { label: 'Hire the smith', sub: 'Costs 8 Iron + 10 Wood · upgrades a workshop by one level', ok: () => res.iron >= 8 && res.wood >= 10, run: () => { const t = tinkerTarget(); if (!t) return 'Nothing left to improve'; res.iron -= 8; res.wood -= 10; setBuildingLevel(t, lvOf(t) + 1); report.upgraded++; floatText(`${BUILDING_NAME[t.userData.kind]} Lv${lvOf(t)}!`, t.position.x, 3.6, t.position.z); return `${BUILDING_NAME[t.userData.kind]} upgraded`; } },
      { label: 'Send the smith away', alt: true, run: () => 'The smith shoulders his pack' } ] },
    { id: 'trainer', title: 'Master Craftsman', text: 'A retired craftsman offers to teach your workers a few tricks for a hot meal.', avail: () => citizens().some(n => jobKind(n)), opts: [
      { label: 'Share a meal', sub: 'Costs 10 Food · every working citizen gains 2 experience', ok: () => res.food >= 10, run: () => { res.food -= 10; citizens().forEach(n => { const k = jobKind(n); if (k) { addXp(n, k); addXp(n, k); } }); return 'Your workers pick up new tricks'; } },
      { label: 'Politely decline', alt: true, run: () => 'The craftsman moves on' } ] },
    { id: 'storm', title: 'Storm Damage', text: 'A storm in the night has loosened planks along your walls.', avail: () => obstacles.some(o => o.userData.type === 'fence'), opts: [
      { label: 'Brace the walls', sub: 'Costs 10 Wood', ok: () => res.wood >= 10, run: () => { res.wood -= 10; return 'The walls hold firm'; } },
      { label: 'Hope for the best', sub: 'Several wall pieces are damaged', alt: true, run: () => { const f = obstacles.filter(o => o.userData.type === 'fence').sort(() => Math.random() - 0.5).slice(0, 6); f.forEach(o => { o.userData.hp = Math.max(1, o.userData.hp * 0.5); }); return 'Some planks are cracked - repairs are needed'; } } ] },
    { id: 'harvest', title: 'Bountiful Harvest', text: 'The fields are heavy with grain this autumn.', avail: () => season().id === 'autumn', opts: [
      { label: 'Store it all', sub: '+25 Food', run: () => { res.food += 25; return 'The granary is full'; } },
      { label: 'Hold a harvest festival', sub: '+10 Food · everyone +10 mood', run: () => { res.food += 10; moodAll(10); return 'A merry festival'; } } ] },
    { id: 'drought', title: 'Dry Spell', text: 'Weeks without rain have cracked the fields.', avail: () => season().id === 'summer' && builtBuildings('farm').length > 0, opts: [
      { label: 'Dig irrigation channels', sub: 'Costs 8 Wood', ok: () => res.wood >= 8, run: () => { res.wood -= 8; return 'Water reaches the crops'; } },
      { label: 'Wait for rain', sub: 'Lose 15 Food to spoilage', alt: true, run: () => { res.food = Math.max(0, res.food - 15); return 'The crops wither a little'; } } ] },
    { id: 'lights', title: 'Strange Lights', text: 'Pale lights drift over the hills at dawn. Something is out there.', avail: () => dayNow() >= 3, opts: [
      { label: 'Follow the lights', sub: 'A reward - and 2 more raiders tonight', run: () => { pendingRaiders += 2; if (story.beacon) { res.shard++; res.iron += 6; return 'You find a glowing shard and some iron'; } res.wood += 12; res.stone += 4; return 'You find a cache of wood and stone'; } },
      { label: 'Stay inside', alt: true, run: () => 'The lights fade with the sun' } ] },
    { id: 'deserter', title: 'Deserter', text: 'A soldier in torn armor asks to join your village.', avail: () => npcs.length < maxPop() && builtBuildings('house').length > 0, opts: [
      { label: 'Take them in', sub: 'Costs 5 Food · joins as a melee soldier', ok: () => res.food >= 5, run: () => { res.food -= 5; const k = spawnCitizens(1), c = npcs[npcs.length - 1]; if (k && c) setRole(c, 'melee'); return k ? 'A new soldier joins you' : 'No room for them'; } },
      { label: 'Turn them away', alt: true, run: () => 'The soldier trudges away' } ] },
    { id: 'lost', title: 'Lost Child', text: 'A child wanders in from the woods, hungry and alone.', avail: () => npcs.length < maxPop() && builtBuildings('house').length > 0, opts: [
      { label: 'Look after the child', sub: 'Costs 4 Food · a new citizen, everyone +6 mood', ok: () => res.food >= 4, run: () => { res.food -= 4; const k = spawnCitizens(1); moodAll(6); return k ? 'The child is welcomed' : 'No room, but hearts are warmed'; } },
      { label: 'Send word to other villages', alt: true, run: () => 'Someone will come for the child' } ] },
    { id: 'tax', title: 'Tax Collector', text: 'A royal tax collector has heard of your wealth.', avail: () => prosScore >= 45, opts: [
      { label: 'Pay 20 Wood', ok: () => res.wood >= 20, run: () => { res.wood -= 20; return 'The collector is satisfied'; } },
      { label: 'Pay 12 Stone', ok: () => res.stone >= 12, run: () => { res.stone -= 12; return 'The collector is satisfied'; } },
      { label: 'Refuse', sub: 'Everyone -10 mood · 2 more raiders tonight', alt: true, run: () => { moodAll(-10); pendingRaiders += 2; return 'The collector storms off, muttering threats'; } } ] },
    { id: 'rats', title: 'Rats in the Stores', text: 'Droppings and gnawed sacks - rats have found your food.', avail: () => res.food >= 20, opts: [
      { label: 'Set traps', sub: 'Costs 6 Wood', ok: () => res.wood >= 6, run: () => { res.wood -= 6; return 'The traps do their work'; } },
      { label: 'Ignore it', sub: 'Lose a quarter of your food', alt: true, run: () => { res.food = Math.floor(res.food * 0.75); return 'The rats feast'; } } ] },
    { id: 'comet', title: 'Falling Star', text: 'A streak of fire crossed the sky last night and landed in the hills.', opts: [
      { label: 'Search the crater', sub: '+4 Iron (and a shard if the Beacon is lit)', run: () => { res.iron += 4; if (story.beacon) res.shard++; return 'You pull glowing metal from the crater'; } },
      { label: 'Leave it', alt: true, run: () => 'Better not to touch it' } ] },
    { id: 'pilgrims', title: 'Pilgrims', text: 'A band of pilgrims on their way to a distant shrine asks for a meal.', avail: () => citizens().length > 0, opts: [
      { label: 'Give 10 Food', sub: 'Everyone +15 mood · the sick recover', ok: () => res.food >= 10, run: () => { res.food -= 10; moodAll(15); npcs.forEach(n => { n.sick = 0; }); return 'Their blessing eases every heart'; } },
      { label: 'Send them on', alt: true, run: () => 'The pilgrims walk on' } ] },
    { id: 'scout', title: 'Scout\'s Warning', text: 'A scout reports movement in the dark beyond your walls.', avail: () => dayNow() >= 2, opts: [
      { label: 'Reinforce the gate', sub: 'Costs 12 Wood · tonight\'s attack is 25% smaller', ok: () => res.wood >= 12, run: () => { res.wood -= 12; nightEase = true; return 'The gate is ready'; } },
      { label: 'Trust your walls', alt: true, run: () => 'You wave the scout off' } ] },
    { id: 'toll', title: 'Bandit Toll', text: 'Bandits block the road and demand a toll to let traders pass.', avail: () => dayNow() >= 4, opts: [
      { label: 'Pay 8 Iron', ok: () => res.iron >= 8, run: () => { res.iron -= 8; return 'The road stays open'; } },
      { label: 'Refuse', sub: '4 more raiders tonight', alt: true, run: () => { pendingRaiders += 4; return 'The bandits spit and ride off'; } } ] },
    { id: 'feast', title: 'Harvest Feast', text: 'The villagers ask to hold a feast to lift everyone\'s spirits.', avail: () => citizens().length > 0, opts: [
      { label: 'Hold the feast', sub: 'Costs 12 Food · everyone recovers, +1 newcomer if there is room', ok: () => res.food >= 12, run: () => { res.food -= 12; npcs.forEach(n => { n.hungry = false; }); const k = npcs.length < maxPop() ? spawnCitizens(1) : 0; citizens().forEach(n => floatText('Feast!', n.position.x, 3.0, n.position.z)); return k ? 'A great feast! A newcomer joined' : 'A great feast! Spirits are high'; } },
      { label: 'Not now', alt: true, run: () => 'Maybe next season' } ] },
  ];
  function openEvent(ev) {
    if (dead) return;
    if (eventOpen) { eventQueue.push(ev); return; }
    eventOpen = true; repEl.classList.remove('show'); if (typeof cardNpc !== 'undefined') { cardNpc = null; document.getElementById('npcCard').style.display = 'none'; }
    document.querySelector('#eventPanel small').textContent = ev.tag || 'Morning event';
    document.getElementById('evTitle').textContent = ev.title; document.getElementById('evText').textContent = ev.text;
    evBtns.innerHTML = '';
    for (const o of ev.opts) {
      const b = document.createElement('button'); b.className = o.alt ? 'alt' : '';
      b.innerHTML = `${o.label}${o.sub ? `<small>${o.sub}</small>` : ''}`;
      b.disabled = o.ok ? !o.ok() : false;
      b.addEventListener('click', () => { const msg = o.run(); eventOpen = false; evEl.style.display = 'none'; updateHud(); updateProsperity(); if (msg) toast(msg); Snd.play('chime'); if (eventQueue.length) setTimeout(() => openEvent(eventQueue.shift()), 350); });
      evBtns.appendChild(b);
    }
    evEl.style.display = 'flex'; Snd.play('click');
  }
  // ---------- 9-2: 떠돌이 상인: 시장이 있으면 3일마다(4일차부터) 찾아와 자원을 서로 바꿔 준다. 시장 레벨이 높을수록 환율이 좋다 ----------
  let lastMerchantDay = 0;
  const MVAL = { wood: 1, stone: 1.2, food: 1, iron: 4 }, MNAME = { wood: 'Wood', stone: 'Stone', food: 'Food', iron: 'Iron' };
  const MLOTS = [{ g: 'food', n: 20, r: 'iron' }, { g: 'wood', n: 30, r: 'iron' }, { g: 'stone', n: 25, r: 'iron' }, { g: 'iron', n: 3, r: 'food' }, { g: 'iron', n: 3, r: 'wood' }, { g: 'iron', n: 3, r: 'stone' }];
  function merchantMenu(lots, rate, p) {
    openEvent({ tag: 'Travelling merchant', title: 'A Merchant Sets Up Camp', text: `Prices today are ${p > 1.1 ? 'good' : p < 0.95 ? 'poor' : 'fair'}. Trade as much as you like - the merchant leaves when you say farewell.`,
      opts: lots.map(l => {
        const get = Math.max(1, Math.round(l.n * MVAL[l.g] / MVAL[l.r] * rate));
        return { label: `Give ${l.n} ${MNAME[l.g]}`, sub: `Get ${get} ${MNAME[l.r]} · you have ${Math.floor(res[l.g])}`, ok: () => res[l.g] >= l.n,
          run: () => { if (res[l.g] < l.n) return 'Not enough to trade'; res[l.g] -= l.n; res[l.r] += get; updateHud(); report.traded = (report.traded || 0) + 1; unlockAch('merchant'); setTimeout(() => merchantMenu(lots, rate, p), 450); return `Traded: +${get} ${MNAME[l.r]}`; } };
      }).concat(npcs.some(n => n.sick > 0) ? [{ label: 'Buy healing herbs', sub: 'Costs 2 Iron · cures every sick citizen', ok: () => res.iron >= 2, run: () => { res.iron -= 2; npcs.forEach(n => { n.sick = 0; }); setTimeout(() => merchantMenu(lots, rate, p), 450); return 'The sick are on their feet again'; } }] : [])
        .concat([{ label: 'Farewell', alt: true, run: () => 'The merchant moves on' }]) });
  }
  function merchantVisit(dayNo) {
    if (!builtBuildings('market').length || dayNo < 4 || (dayNo - 4) % 3 !== 0 || lastMerchantDay === dayNo) return;
    lastMerchantDay = dayNo;
    const p = 0.85 + Math.random() * 0.4, rate = 0.9 * p * (1 + 0.1 * (bLevel('market') - 1));
    const sells = MLOTS.slice(0, 3), buys = MLOTS.slice(3), pick = (a) => a.splice(Math.floor(Math.random() * a.length), 1)[0];
    const lots = [pick(sells), pick(sells), pick(buys), pick(buys)];
    setTimeout(() => merchantMenu(lots, rate, p), 3600);
  }
  const recentEv = [];
  function rollEvent(dayNo) {
    if (dayNo < 2 || Math.random() > 0.65) return;
    let pool = EVENTS.filter(e => (!e.avail || e.avail()) && !recentEv.includes(e.id));      // 최근 3번 나온 이벤트는 제외
    if (!pool.length) pool = EVENTS.filter(e => !e.avail || e.avail());
    if (pool.length) { const ev = pool[Math.floor(Math.random() * pool.length)]; recentEv.push(ev.id); if (recentEv.length > 3) recentEv.shift(); setTimeout(() => openEvent(ev), 1500); }
  }
  // ---------- 9단계: 건물 레벨 (농장·벌목장·채석장·대장간·시장·우물): 시대가 올라가면 매일 아침 여유 자원으로 한 채씩 ----------
  const bLevel = (kind) => builtBuildings(kind).reduce((a, o) => Math.max(a, o.userData.level || 1), 0);
  const lvOf = (o) => o.userData.level || 1;
  const bannerMat = mat(0xd9a92a);
  function setBuildingLevel(o, lv) {            // 레벨 2부터 모서리에 깃발이 서고, 레벨만큼 삼각기가 늘어난다
    o.userData.level = lv;
    if (o.userData.banner) { o.remove(o.userData.banner); o.userData.banner = null; }
    if (lv < 2) return;
    const b = new THREE.Group(), sz = CFG.BUILDING[o.userData.kind].size, r = o.userData.radius;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), woodMat2); pole.position.y = 1.3; b.add(pole);
    for (let i = 0; i < lv - 1; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.26, 0.04), bannerMat); f.position.set(0.3, 2.3 - i * 0.34, 0); b.add(f); }
    b.position.set(sz ? sz[0] / 2 + 0.3 : r + 0.3, 0, sz ? sz[2] / 2 : r * 0.7);
    b.traverse(m => { if (m.isMesh) m.castShadow = true; });
    o.add(b); o.userData.banner = b;
  }
  function upgradeBuildings() {
    let n = 0;
    for (const kind of CFG.LEVELED) for (const o of builtBuildings(kind)) {
      const lv = lvOf(o), cost = CFG.BUILD_UPGRADE[lv + 1];
      if (n >= CFG.BUILD_UPGRADES_PER_MORNING || lv >= age || !cost) continue;
      if (!Object.entries(cost).every(([k, v]) => res[k] >= v * 1.5)) continue;
      payCost(cost); setBuildingLevel(o, lv + 1); n++; report.upgraded++;
      dust(o.position.x, o.position.z); sfxAt('build', o.position.x, o.position.z); floatText(`${BUILDING_NAME[kind]} Lv${lv + 1}!`, o.position.x, 3.6, o.position.z);
    }
    if (n) updateHud();
  }
  // ---------- 9단계: 직업 / 숙련도 ----------
  const jobKind = (n) => (n.work && obstacles.includes(n.work) ? n.work.userData.kind : null);
  const skillLv = (n, k) => { const x = (n.xp && n.xp[k]) || 0; let l = 0; CFG.SKILL_XP.forEach((v, i) => { if (x >= v) l = i; }); return l; };
  const likesJob = (n, k) => CFG.TRAIT_JOB[n.trait] === k;
  function addXp(n, k) {
    if (!n.xp) n.xp = {};
    const before = skillLv(n, k); n.xp[k] = (n.xp[k] || 0) + 1;
    if (skillLv(n, k) > before) floatText(`${CFG.JOBS[k]}: ${CFG.SKILL_NAMES[skillLv(n, k)]}!`, n.position.x, 3.2, n.position.z);
  }
  const jobTitle = (n) => { const k = jobKind(n); return k ? `${CFG.JOBS[k]} (${CFG.SKILL_NAMES[skillLv(n, k)]})` : 'Laborer'; };
  const PREF_LABEL = (p) => p === 'free' ? 'Laborer' : p ? CFG.JOBS[p] : 'Auto';
  function nextPref(n) {                           // 카드 버튼: Auto → (지어진 일터 종류들) → Laborer → Auto
    const opts = [null, ...Object.keys(CFG.JOBS).filter(k => builtBuildings(k).length), 'free'];
    const i = opts.indexOf(n.pref || null);
    n.pref = opts[(i + 1) % opts.length];
    if (n.work && (n.pref === 'free' || (n.pref && jobKind(n) !== n.pref))) { n.work.userData.worker = null; n.work = null; n.wstate = 'seek'; n.carry = 0; }
  }

  // 질병: 겨울·굶주림·불만·집 부족이면 아침마다 시민이 앓을 수 있다. 우물이 확률을 낮추고(레벨이 높을수록 더), 며칠 지나면 낫는다. 상인에게서 약초를 살 수도 있다
  let lastSeasonId = null;
  // 엔딩(보스 처치) 이후 무한 모드: 5일마다 이정표 보상
  function endlessMilestone(dayNo) {
    if (!chapterCleared || dayNo <= CFG.BOSS_DAY || dayNo % 5 !== 0 || (story.ms && story.ms[dayNo])) return;
    (story.ms || (story.ms = {}))[dayNo] = 1; giveXp(60 + dayNo * 2); res.iron += 10 + dayNo; if (story.beacon) res.shard++; updateHud();
    report.season = `Endless milestone: Day ${dayNo} survived! (+${10 + dayNo} Iron${story.beacon ? ', +1 Shard' : ''}, XP)`;
  }
  // 낚시: 마을 사람들이 강에서 물고기를 잡아 온다 (겨울에는 얼음 낚시라 절반). 시민 3명당 식량 1 + 기본 1
  function fishingTick(dayNo) {
    const folks = npcs.filter(n => n.role === 'citizen' && !n.down).length; if (folks < 2) return 0;
    const f = Math.max(1, Math.floor((1 + Math.floor(folks / 3)) * (seasonOfDay(dayNo).id === 'winter' ? 0.5 : 1))); res.food += f;
    report.season = (report.season ? report.season + ' | ' : '') + `Fishers brought ${f} food from the river`; return f;
  }
  function seasonTick(dayNo) {
    const s = seasonOfDay(dayNo);
    if (s.id !== lastSeasonId) { const first = lastSeasonId === null; lastSeasonId = s.id; if (CFG.SEASONS_ON && (!first || dayNo > 1)) { report.season = s.msg; setTimeout(() => toast(s.msg), 4200); } }
  }
  function rollSickness(dayNo) {
    if (!CFG.SICK_ON) return;
    const cs = citizens(), wellMul = builtBuildings('well').length ? (bLevel('well') >= 3 ? 0.35 : 0.5) : 1, houses = builtBuildings('house').length;
    for (const c of cs) if (c.sick > 0) {                          // 회복: 하루 지날 때마다 1일 줄고, 0이 되면 완치
      c.sick -= wellMul < 1 ? 2 : 1;
      if (c.sick <= 0) { c.sick = 0; report.healed.push(c.name); }
    }
    if (dayNo < 2) return;
    const cap = Math.max(1, Math.ceil(cs.length * 0.35)); let n = 0;
    for (const c of cs.slice().sort(() => Math.random() - 0.5)) {
      if (n >= cap || c.sick > 0) continue;
      const p = (season().sick + (c.hungry ? 0.15 : 0) + (c.mood < CFG.MOOD_UNHAPPY ? 0.1 : 0) + (houses < cs.length ? 0.04 : 0)) * wellMul * (c.trait === 'stout' ? 0.6 : 1);
      if (Math.random() < p) { c.sick = CFG.SICK_DAYS + 1; n++; report.ill.push(c.name); }
    }
  }
  // ---------- 집 업그레이드: 시대가 올라도 한 번에 바뀌지 않고, 매일 아침 여유 자원으로 한두 채씩 ----------
  function upgradeHouses() {
    let n = 0;
    for (const h of builtBuildings('house')) {
      const lv = h.userData.level || 1, cost = CFG.HOUSE_UPGRADE[lv + 1];
      if (n >= CFG.HOUSE_UPGRADES_PER_MORNING || lv >= age || !cost) continue;
      if (!Object.entries(cost).every(([k, v]) => res[k] >= v * 1.5)) continue;     // 여유가 있을 때만 (비축분을 다 쓰지 않는다)
      payCost(cost); h.userData.level = lv + 1; setHouseModel(h); n++; report.upgraded++;
      dust(h.position.x, h.position.z); sfxAt('build', h.position.x, h.position.z); floatText('House upgraded!', h.position.x, 3.6, h.position.z);
    }
    if (n) updateHud();
  }
  const maxPop = () => (story.wide ? 2 : 0) + CFG.BASE_POP + builtBuildings('house').length + builtBuildings('well').length + (hasPerk('steward') ? 1 : 0) + prosBonus;      // 거주지 1채당 최대 인구 +1, 번영도가 높으면 이주민 추가
  const countRole = (r) => npcs.filter(n => n.role === r).length;
  const popEl = document.getElementById('popN'), popJobsEl = document.getElementById('popJobs');
  function updatePopUi() {
    const a = `${npcs.length} / ${maxPop()}`, b = `(Citizens: ${countRole('citizen')} | Melee: ${countRole('melee')} | Archers: ${countRole('archer')}${npcs.some(n => n.hungry) ? ` | Hungry: ${npcs.filter(n => n.hungry).length}` : ''})`;
    if (popEl.textContent !== a) popEl.textContent = a;
    if (popJobsEl.textContent !== b) popJobsEl.textContent = b;
  }
  function setRole(n, role) {              // 직업 변경(전직): 색, 체력, 집 위치 갱신
    n.role = role; n.archer = role === 'archer'; n.baseColor = ROLE[role].color; n.maxHp = npcMaxHp(role, n.trait); n.hp = n.maxHp;
    n.mat.color.set(n.baseColor); n.promote = null; n.born = 'citizen';
    if (n.work) { n.work.userData.worker = null; n.work = null; }          // 전직하면 일터를 떠난다
    applyCitizenLook(n);
    n.home = homeSlot(npcs.filter(x => x.role !== 'citizen').length);
    n.labelText = ''; n.hungry = false;          // 병사는 배급 대상이 아니므로 굶주림 해제
    applyGear(n);
    dust(n.position.x, n.position.z);
  }
  // 매일 아침: 인구가 최대 인구보다 적으면 완성된 거주지 앞에서 시민 스폰 → 병영/사격장이 있으면 시민 1명씩 전직 훈련
  function morningTown() {
    const houses = builtBuildings('house'), fresh = [];
    let guard = 0;
    while (houses.length && npcs.length < maxPop() && guard++ < 20) {
      const h = houses[npcs.length % houses.length], door = doorOf(h);
      const c = makeNpc('citizen', door, 'citizen', fresh.length * 0.15);
      c.position.set(door.x, 0, door.z);
      fresh.push(c);
    }
    report.newCit += fresh.length;
    if (fresh.length) toast(`${fresh.length} new citizen${fresh.length > 1 ? 's' : ''} arrived in the village`);
    const pool = fresh.concat(npcs.filter(n => n.role === 'citizen' && !fresh.includes(n) && !n.promote));
    const barracks = builtBuildings('barracks')[0], range = builtBuildings('range')[0];
    if (barracks && pool.length) pool.shift().promote = { to: 'melee', target: barracks };
    if (range && pool.length) pool.shift().promote = { to: 'archer', target: range };
  }
  // 전직 이동: 해당 건물 앞까지 걸어가면 직업 변경. 진행 중이면 true
  function promoteStep(dt) {
    const pr = npc.promote, b = pr.target;
    if (!obstacles.includes(b)) { npc.promote = null; return false; }
    const door = doorOf(b);
    if (npcMove(door.x, door.z, 3.5, dt) < 1.6) {
      setRole(npc, pr.to);
      toast(pr.to === 'melee' ? 'A citizen became a melee soldier!' : 'A citizen became an archer!');
      return false;
    }
    return true;
  }
  // ---------- 경제 건물: 시민이 정착해서 일한다 ----------
  const isWorksite = (o) => o.userData.type === 'building' && (o.userData.kind === 'smith' || o.userData.kind === 'farm' || o.userData.kind === 'lumber' || o.userData.kind === 'quarry');
  function claimWorksite() {
    const free = obstacles.filter(o => isWorksite(o) && !(o.userData.worker && npcs.includes(o.userData.worker)));
    let pool = free.filter(o => o.userData.kind !== 'smith' || npc.pref === 'smith');           // 대장간은 다른 일터가 모두 찼을 때(또는 지정했을 때) 배정한다
    const want = npc.pref && npc.pref !== 'free' ? free.filter(o => o.userData.kind === npc.pref) : [];
    if (want.length) pool = want; else if (!pool.length) pool = free;
    const foodLow = res.food < npcs.filter(n => n.role === 'citizen').length * CFG.RATION * 2;
    let best = null, bs = Infinity;
    for (const o of pool) {
      const k = o.userData.kind, d = Math.hypot(o.position.x - npc.position.x, o.position.z - npc.position.z);
      const s = d - (likesJob(npc, k) ? 12 : 0) - (k === 'farm' && foodLow ? 25 : 0);          // 성격에 맞는 일터와, 식량이 모자랄 때의 농장을 우선한다
      if (s < bs) { bs = s; best = o; }
    }
    if (best) { best.userData.worker = npc; npc.work = best; npc.wstate = 'seek'; npc.carry = 0; npc.wtarget = null; npc.farmT = 0; npc.workT = 0; }
    return best;
  }
  function autoForge(site) {
    const soldiers = npcs.filter(n => n.role !== 'citizen');
    let best = null;
    for (const [id, d] of Object.entries(CFG.GEAR)) {
      if (!d.cost || (d.age || 1) > age || (d.req && !story[d.req]) || (site.userData.stock[id] || 0) > 0 || npcs.some(n => n.carryGear === id) || !canPay(gearCost(d))) continue;
      const need = soldiers.some(n => (d.slot === 'armor' || d.slot === (n.role === 'melee' ? 'sword' : 'bow')) && d.tier > gearDef(n.gear[d.slot]).tier);
      if (need && (!best || d.tier < best.tier)) best = d;                         // 낮은 등급부터 차례로
    }
    if (!best) return;
    payCost(gearCost(best)); site.userData.stock[best.id] = (site.userData.stock[best.id] || 0) + 1; refreshRack(site); updateHud();
    forgeEffect(site); report.forged++; floatText(`Forged ${best.name}`, site.position.x, 3.4, site.position.z);
  }
  function workStep(dt) {
    if (npc.work && !obstacles.includes(npc.work)) npc.work = null;
    if (npc.pref === 'free') { if (npc.work) { npc.work.userData.worker = null; npc.work = null; } return false; }         // 플레이어가 '잡일'로 지정: 일터 없이 건설·수리·채집을 한다
    if (!npc.work && !claimWorksite()) return false;
    if (npc.task) { setTask(null); npc.workT = 0; }
    const site = npc.work, k = site.userData.kind;
    npc.bobAmt = 0;
    const wdt = dt * workMul(npc) * (1 + CFG.SKILL_BONUS * skillLv(npc, k)) * (likesJob(npc, k) ? 1.1 : 1);        // 굶주림·성격·기분·숙련도·성격 적성이 작업 효율을 정한다
    if (k === 'smith') {                                        // 대장간 시민: 모루 앞에서 망치질하며 병사에게 필요한 장비를 주기적으로 자동 제작
      const door = doorOf(site);
      if (Math.hypot(door.x - npc.position.x, door.z - npc.position.z) > 1.2) { npcMove(door.x, door.z, 3.5, dt); npc.stateLabel = 'To smithy'; return true; }
      npc.face = Math.atan2(site.position.x - npc.position.x, site.position.z - npc.position.z); npc.rotation.y = npc.face;
      npc.stateLabel = 'Forging'; npc.forgeT = (npc.forgeT || 0) + wdt * ((nowHour >= 18 || nowHour < 6) ? 1.5 : 1);
      if (npc.forgeT >= CFG.FORGE_CYCLE * (hasPerk('smith') ? 0.6 : 1) * (1 - 0.2 * (lvOf(site) - 1))) { npc.forgeT = 0; autoForge(site); addXp(npc, 'smith'); }
      return true;
    }
    if (k === 'farm') {                                         // 농장: 밭에 서서 작물을 키우고 주기마다 식량 수확
      if (Math.hypot(site.position.x - npc.position.x, site.position.z - npc.position.z) > 1.8) { npcMove(site.position.x, site.position.z, 3.5, dt); npc.stateLabel = 'To farm'; return true; }
      npc.farmT += wdt; npc.bobAmt = Math.abs(Math.sin(npc.farmT * 6)) * 0.12; npc.stateLabel = 'Farming';
      site.userData.growth = 0.3 + 0.7 * Math.min(1, npc.farmT / CFG.FARM_CYCLE);
      for (const c of site.userData.crops) c.scale.y = site.userData.growth;
      if (npc.farmT >= CFG.FARM_CYCLE) {
        npc.farmT = 0; const fy = Math.max(1, Math.round((CFG.FARM_YIELD + (lvOf(site) - 1)) * season().farm)); res.food += fy; updateHud(); addXp(npc, 'farm');
        floatText(`Food +${fy}`, site.position.x, 2.2, site.position.z);
      }
      return true;
    }
    const type = k === 'lumber' ? 'wood' : 'stone', door = doorOf(site);          // 벌목장/채석장: 주변 자원을 캐서 건물로 가져와 쌓는다
    if (npc.wstate === 'carry') {
      npc.stateLabel = 'Hauling';
      if (npcMove(door.x, door.z, 3.8, dt) < 2.0) { res[type] += npc.carry; npc.carry = 0; npc.wstate = 'seek'; npc.wtarget = null; updateHud(); addXp(npc, k); }
      return true;
    }
    if (!npc.wtarget || !obstacles.includes(npc.wtarget) || (npc.wtarget.userData.owner && npc.wtarget.userData.owner !== npc && npcs.includes(npc.wtarget.userData.owner))) {
      npc.wtarget = null;
      let bd = Infinity;
      for (const o of obstacles) {
        if (o.userData.type !== type || !unclaimed(o)) continue;
        const d = Math.hypot(o.position.x - site.position.x, o.position.z - site.position.z);
        if (d < CFG.WORK_RADIUS && d < bd) { bd = d; npc.wtarget = o; }
      }
      if (npc.wtarget) { npc.wtarget.userData.owner = npc; npc.workT = 0; }
    }
    if (!npc.wtarget) { npc.stateLabel = 'Idle'; npcMove(door.x, door.z, 3.5, dt); return true; }
    const o = npc.wtarget, stop = o.userData.radius + PLAYER_R + 0.3;
    npc.stateLabel = k === 'lumber' ? 'Chopping' : 'Quarrying';
    if (Math.hypot(o.position.x - npc.position.x, o.position.z - npc.position.z) > stop) { npcMove(o.position.x, o.position.z, 3.8, dt); npc.workT = 0; return true; }
    npc.workT += wdt; npc.bobAmt = Math.abs(Math.sin(npc.workT * 14)) * 0.15;
    if (npc.workT >= CFG.GATHER_TIME) {
      scene.remove(o); obstacles.splice(obstacles.indexOf(o), 1); rollIron(o);
      npc.carry = Math.round(gatherYield(type) * CFG.WORKSITE_YIELD_MULT * (1 + 0.4 * (lvOf(site) - 1)) * (hasPerk('merchant') ? 1.25 : 1)); npc.wstate = 'carry'; npc.wtarget = null; npc.workT = 0;
    }
    return true;
  }
  // 평화로운 밤(주변에 적이 없음): 시민은 흩어지지 않고 모닥불 둘레에 둥글게 모여 앉는다
  const faceFire = () => { npc.face = Math.atan2(-npc.position.x, -npc.position.z); npc.rotation.y = npc.face; };
  // 성문 경비: 밤에 적이 없을 때 근접 병사 일부가 성문 안쪽에 서서 지킨다 (성문 하나당 1명)
  function sentryPost(n) {
    if (n.role !== 'melee' || !gateWaypoints.length) return null;
    const melees = npcs.filter(x => x.role === 'melee'), i = melees.indexOf(n);
    if (i < 0 || i >= gateWaypoints.length) return null;
    const g = gateWaypoints[i], sgn = Math.hypot(g.x - g.nx * 3, g.z - g.nz * 3) < Math.hypot(g.x + g.nx * 3, g.z + g.nz * 3) ? 1 : -1;
    return { x: g.x - g.nx * 3 * sgn, z: g.z - g.nz * 3 * sgn };
  }
  const faceTo = (x, z) => { npc.face = Math.atan2(x - npc.position.x, z - npc.position.z); npc.rotation.y = npc.face; };
  // 집·병영이 생긴 뒤(2시대~)에는 모닥불(회관) 둘레가 아니라, 시민은 각자 집 앞 계단에, 병사는 병영·사격장 앞에 앉아 쉰다. 점심은 시장·우물 앞.
  function restSpot(n, purpose) {
    if (age < 2) return null;
    const cits = npcs.filter(x => x.role === 'citizen'), sold = npcs.filter(x => x.role !== 'citizen');
    let b = null, slot = 0;
    if (n.role === 'citizen') {
      const houses = builtBuildings('house'), i = Math.max(0, cits.indexOf(n));
      if (purpose === 'lunch') b = builtBuildings('market')[0] || builtBuildings('well')[0];
      if (b) slot = i; else if (houses.length) { b = houses[i % houses.length]; slot = Math.floor(i / houses.length); }
    } else {
      b = builtBuildings(n.role === 'melee' ? 'barracks' : 'range')[0] || builtBuildings('barracks')[0] || builtBuildings('house')[0];
      slot = Math.max(0, sold.filter(x => x.role === n.role).indexOf(n));
    }
    if (!b) return null;
    const d = doorOf(b), len = Math.hypot(d.x, d.z) || 1, ux = d.x / len, uz = d.z / len;
    const lat = ((slot % 4) - 1.5) * 1.1, out = 0.9 + Math.floor(slot / 4) * 1.0;
    return { x: d.x + ux * out - uz * lat, z: d.z + uz * out + ux * lat, fx: b.position.x, fz: b.position.z };
  }
  const seatSpot = () => {                       // 모닥불 둘레 좌석 (시민마다 고유한 각도)
    const mates = npcs.filter(x => x.role === 'citizen'), k = Math.max(1, mates.length), i = Math.max(0, mates.indexOf(npc));
    const r = FIRE_R + 1.9, a = Math.PI / 4 + i / k * Math.PI * 2;
    return { x: Math.cos(a) * r, z: Math.sin(a) * r };
  };
  function citizenRest(dt) {
    const rs = restSpot(npc, 'night'), sp = rs || seatSpot();
    npc.hidden = false;
    if (npcMove(sp.x, sp.z, 3.6, dt) < 0.35) { if (rs) faceTo(rs.fx, rs.fz); else faceFire(); return 'Resting'; }
    return rs ? 'Heading home' : 'To the fire';
  }
  // 시민의 하루 루틴: 아침 물 긷기(우물) → 일 → 정오 점심 휴식(모닥불 곁) → 일 → 저녁 귀가(거주지 앞). 일하는 시간을 조금 쓰는 대신 마을에 생활감이 생긴다
  function routineStep(dt, hour) {
    let spot, label, lrs = null;
    if (hour >= 6 && hour < 7) { const w = builtBuildings('well')[0]; if (!w) return null; spot = doorOf(w); label = 'water'; }
    else if (hour >= 12 && hour < 13) { lrs = restSpot(npc, 'lunch'); spot = lrs || seatSpot(); label = 'lunch'; }
    else if (hour >= 17 && hour < 18) {
      let h = null, bd = Infinity;
      for (const x of builtBuildings('house')) { const d = (x.position.x - npc.position.x) ** 2 + (x.position.z - npc.position.z) ** 2; if (d < bd) { bd = d; h = x; } }
      if (!h) return null; spot = doorOf(h); label = 'home';
    } else return null;
    if (npc.task) { setTask(null); npc.workT = 0; }
    const d = npcMove(spot.x, spot.z, 3.6, dt);
    if (label === 'lunch') { if (d < 0.35) { if (lrs) faceTo(lrs.fx, lrs.fz); else faceFire(); return 'Lunch break'; } return 'To lunch'; }
    if (label === 'water') return d < 1.0 ? 'Drawing water' : 'To the well';
    return d < 1.0 ? 'At home' : 'Heading home';
  }
  // 병사: 대장간 선반에 완성된 상위 장비가 있으면 걸어가서 직접 수령(Equip)한다
  function returnGear(n) { if (n.carryGear) { const sm = builtBuildings('smith')[0]; if (sm) { sm.userData.stock[n.carryGear]++; refreshRack(sm); } n.carryGear = null; } }
  function gearFetchStep(dt) {
    if (npc.role === 'citizen') return false;
    const sm = builtBuildings('smith')[0];
    if (!sm) { npc.carryGear = null; return false; }
    if (!npc.carryGear) {
      let best = null, bt = -1;
      for (const id in sm.userData.stock) {
        const d = gearDef(id), slotOk = d.slot === 'armor' || d.slot === (npc.role === 'melee' ? 'sword' : 'bow');
        if (sm.userData.stock[id] > 0 && slotOk && d.tier > gearDef(npc.gear[d.slot]).tier && d.tier > bt) { best = id; bt = d.tier; }
      }
      if (!best) return false;
      sm.userData.stock[best]--; npc.carryGear = best; refreshRack(sm);          // 수령 예약 (다른 병사와 중복 방지)
      if (npc.task) { setTask(null); npc.workT = 0; }
    }
    const door = doorOf(sm);
    if (npcMove(door.x, door.z, 4, dt) < 1.5) {
      const d = gearDef(npc.carryGear);
      npc.gear[d.slot] = npc.carryGear; npc.carryGear = null; applyGear(npc); report.equipped++;
      floatText(`Equipped ${d.name}!`, npc.position.x, 2.9, npc.position.z); dust(npc.position.x, npc.position.z); sfxAt('chime', npc.position.x, npc.position.z);
    }
    return true;
  }
  // 시민 야간 AI: 전투에 참여하지 않고 가장 가까운 거주지(없으면 모닥불)로 도망쳐 웅크린다
  function citizenHide(dt) {
    let spot = null, bd = Infinity;
    for (const h of builtBuildings('house')) {
      const d = (h.position.x - npc.position.x) ** 2 + (h.position.z - npc.position.z) ** 2;
      if (d < bd) { bd = d; spot = doorOf(h); }
    }
    if (!spot) { const l = Math.hypot(npc.position.x, npc.position.z) || 1; spot = { x: npc.position.x / l * 1.6, z: npc.position.z / l * 1.6 }; }
    if (npcMove(spot.x, spot.z, npc.trait === 'timid' ? 6.5 : 5, dt) < 0.7) { npc.hidden = true; return 'Hiding'; }
    npc.hidden = false;
    return 'Fleeing';
  }

