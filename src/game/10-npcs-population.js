  // ---------- 동료 NPC / 시민 ----------
  // 각 NPC는 자기 상태(task, hp, 라벨 등)를 가진 Group. updateNpcs()가 순서대로 `npc`(현재 처리 중인 NPC)를 바꿔가며 AI를 돌린다.
  // role: 'melee'(파랑 근접 병사) | 'archer'(초록 궁수) | 'citizen'(노랑 시민)
  const NPC_COUNT = 3, NPC_HOME_RADIUS = 3.4;
  const ROLE = {
    melee: { color: 0x3a6fe0, hp: 50, name: '' },
    archer: { color: 0x3fae4a, hp: 50, name: 'Archer ' },
    citizen: { color: 0xf2c230, hp: CFG.CITIZEN_HP, name: 'Citizen ' },
  };
  const npcs = [];
  // 굶주림 말풍선 (모든 시민이 공유하는 텍스처)
  const hungerMat = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const c = cv.getContext('2d');
    c.fillStyle = '#fff'; c.strokeStyle = '#3a2a22'; c.lineWidth = 5;
    c.beginPath(); c.moveTo(34, 112); c.lineTo(46, 92); c.lineTo(90, 92); c.quadraticCurveTo(116, 92, 116, 66); c.lineTo(116, 36);
    c.quadraticCurveTo(116, 12, 90, 12); c.lineTo(40, 12); c.quadraticCurveTo(12, 12, 12, 38); c.lineTo(12, 66); c.quadraticCurveTo(12, 92, 40, 92); c.lineTo(34, 92); c.closePath(); c.fill(); c.stroke();
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '44px sans-serif'; c.fillStyle = '#000'; c.fillText('🍽️', 64, 38);
    c.font = 'bold 20px sans-serif'; c.fillStyle = '#c0392b'; c.fillText('Grrr…', 64, 74);
    return new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false, fog: false });
  })();
  const sickMat = (() => {                         // 아픈 시민 머리 위 말풍선
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d');
    c.fillStyle = '#e6f5d8'; c.strokeStyle = '#2d4a2a'; c.lineWidth = 5; c.beginPath(); c.arc(64, 60, 46, 0, 7); c.fill(); c.stroke();
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '56px sans-serif'; c.fillStyle = '#000'; c.fillText('🤒', 64, 60);
    return new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false, fog: false });
  })();
  function applyGear(n) {                         // 역할과 보유 장비에 맞춰 손에 쥔 무기 메쉬를 바꾼다
    n.rig.main = n.role === 'melee' ? 'sword' : n.role === 'archer' ? 'bow' : null;
    n.rig.setGear('sword', n.role === 'melee' ? gearDef(n.gear.sword) : null);
    n.rig.setGear('bow', n.role === 'archer' ? gearDef(n.gear.bow) : null);
    n.rig.setArmor(n.role === 'citizen' ? null : gearDef(n.gear.armor));
    n.rig.hold(n.rig.main);
  }
  const homeSlot = (k) => { const a = Math.PI / 4 + k * 0.85, r = Math.max(NPC_HOME_RADIUS, FIRE_R + 2.8) + (k % 3) * 1.0; return { x: Math.cos(a) * r, z: Math.sin(a) * r }; };      // 회관이 커지면 병사 대기 위치도 바깥으로
  function makeNpc(role, home, born = 'initial', delay = 0, preset = {}) {
    const n = new THREE.Group();
    const def = ROLE[role];
    const used = new Set(npcs.map(x => x.name)), free = CFG.NAMES.filter(x => !used.has(x));
    const nm = preset.name || (free.length ? free : CFG.NAMES)[Math.floor(Math.random() * (free.length || CFG.NAMES.length))];
    const tr = preset.trait || Object.keys(CFG.TRAITS)[Math.floor(Math.random() * Object.keys(CFG.TRAITS).length)];
    const color = role === 'citizen' ? citizenColor() : def.color;
    const rig = makeRig(role, color, { seed: [...nm].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7) });                  // 스틱맨 리그 + AnimationMixer
    const anim = new Anim(rig), m = rig.bodyMat, body = rig.root;
    n.add(body);
    n.position.set(home.x, 0, home.z);

    // 머리 위 상태 라벨 (NPC마다 별도 캔버스)
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 96;
    const tex = new THREE.CanvasTexture(cv);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, fog: false }));
    label.scale.set(2.6, 0.98, 1);
    label.position.y = 2.7;
    n.add(label);
    const hungerIcon = new THREE.Sprite(hungerMat);            // 굶주림(꼬르륵) 말풍선
    hungerIcon.scale.set(0.95, 0.95, 1); hungerIcon.position.y = 3.4; hungerIcon.visible = false;
    n.add(hungerIcon);
    const sickIcon = new THREE.Sprite(sickMat);                 // 질병 말풍선
    sickIcon.scale.set(0.8, 0.8, 1); sickIcon.position.y = 3.4; sickIcon.visible = false;
    n.add(sickIcon);

    Object.assign(n, { labelSprite: label, home, role, born, archer: role === 'archer', baseColor: color, name: nm, trait: tr, mood: preset.mood ?? 60, shock: 0, stateNow: 'Idle', maxHp: npcMaxHp(role, tr), mat: m, body, rig, anim, hungerIcon, sickIcon, sick: preset.sick || 0, gear: { sword: 'sword_basic', bow: 'bow_basic', armor: 'armor_none' }, carryGear: null, hungry: false, px: home.x, pz: home.z, lctx: cv.getContext('2d'), labelTex: tex,
      hp: npcMaxHp(role, tr), down: false, target: null, gatherT: 0, atkCd: 0, hurtCd: 0, returning: false, face: 0, labelText: '',
      task: null, workT: 0, short: null, pickCd: delay, wp: null, route: null, routeRing: 0, graceT: 0, graceRing: 0,
      promote: null, hidden: false, decor: null, work: null, wstate: 'seek', carry: 0, farmT: 0, wtarget: null, stateLabel: '', bobAmt: 0 });
    n.xp = preset.xp ? { ...preset.xp } : {}; n.pref = preset.pref || null;
    applyCitizenLook(n); applyGear(n);
    scene.add(n);
    npcs.push(n);
    return n;
  }
  for (let i = 0; i < NPC_COUNT; i++) {
    const ang = Math.PI / 4 + i * Math.PI * 2 / NPC_COUNT;       // 모닥불 둘레에 균등 배치
    makeNpc(i >= NPC_COUNT - CFG.ARCHER_COUNT ? 'archer' : 'melee', { x: Math.cos(ang) * NPC_HOME_RADIUS, z: Math.sin(ang) * NPC_HOME_RADIUS }, 'initial', i * 0.1);
  }
  let npc = npcs[0];                       // 현재 처리 중인 NPC

  function setLabel(state) {
    const text = `${state}|${npc.hp}|${npc.role}|${npc.name}`;
    if (npc.labelText === text) return;
    npc.labelText = text;
    const lctx = npc.lctx;
    lctx.clearRect(0, 0, 256, 96);
    lctx.fillStyle = 'rgba(10,10,30,.65)';
    lctx.beginPath(); lctx.roundRect ? lctx.roundRect(8, 8, 240, 80, 16) : lctx.rect(8, 8, 240, 80); lctx.fill();
    lctx.textAlign = 'center'; lctx.fillStyle = '#fff';
    lctx.font = 'bold 34px sans-serif'; lctx.fillText(state, 128, 46);
    lctx.font = '22px sans-serif'; lctx.fillStyle = '#9fd0ff'; lctx.fillText(`${npc.name} · HP ${npc.hp}/${npc.maxHp}`, 128, 76);
    npc.labelTex.needsUpdate = true;
  }

  const TR = (n) => CFG.TRAITS[n.trait] || {};
  const workMul = (n) => (n.hungry ? CFG.HUNGER_MULT : 1) * (n.sick > 0 ? 0.6 : 1) * (TR(n).work || 1) * (n.mood >= CFG.MOOD_HAPPY ? 1.1 : n.mood < CFG.MOOD_UNHAPPY ? 0.8 : 1) * (n.foreman ? 1.25 : npcs.some(f => f.foreman && !f.down) ? 1.12 : 1);
  const moveMul = (n) => (n.hungry ? CFG.HUNGER_MULT : 1) * (n.sick > 0 ? 0.75 : 1) * (TR(n).move || 1) * (n.mood < CFG.MOOD_UNHAPPY ? 0.9 : 1);
  const rationOf = (n) => Math.ceil(CFG.RATION * (TR(n).ration || 1) * season().ration);
  const moodLabel = (v) => v < CFG.MOOD_LEAVE ? 'Miserable' : v < CFG.MOOD_UNHAPPY ? 'Unhappy' : v < 60 ? 'Content' : v < CFG.MOOD_HAPPY ? 'Happy' : 'Joyful';
  const grieve = () => { for (const x of npcs) x.shock = Math.min(25, (x.shock || 0) + 10); };         // 동료가 쓰러지면 모두 마음이 가라앉는다
  // 기분: 먹었는지, 집·우물·시장, 번영도, 휴식, 슬픔(충격), 성격에 따라 목표값이 정해지고 천천히 따라간다
  function updateMood(n, dt) {
    n.shock = Math.max(0, (n.shock || 0) - dt * 1.2);
    n.moodT = (n.moodT || 0) + dt;
    if (n.moodT < 1) return;
    const k = n.moodT; n.moodT = 0;
    const aura = Math.min(6, npcs.reduce((a, x) => a + (x !== n ? (TR(x).aura || 0) : 0), 0));
    let target = 50 + (TR(n).mood || 0) + aura + (n.hungry ? -30 : 8) + (builtBuildings('well').length ? 4 + 2 * (bLevel('well') - 1) : 0) + (builtBuildings('market').length ? 4 : 0)
      + Math.max(-10, Math.min(15, (prosScore - 40) / 3)) + (n.stateNow === 'Resting' || n.stateNow === 'Lunch break' ? 6 : 0) + (hasPerk('steward') ? 5 : 0) + (story.beacon ? 6 : 0) + (story.dawn ? 4 : 0) + (story.finale ? 4 : 0) + (story.wide ? 4 : 0) + season().mood - (n.sick > 0 ? 10 : 0) - n.shock;
    if (n.role === 'citizen') target += (builtBuildings('house').length ? 4 : -8) + (jobKind(n) && likesJob(n, jobKind(n)) ? 4 : 0);
    target = Math.max(0, Math.min(100, target));
    n.mood += Math.max(-3 * k, Math.min(3 * k, target - n.mood));
  }
  function removeNpc(n) {                  // 시민 출신은 쓰러지면 영구 사망 → 인구수 감소
    npc = n; setTask(null); returnGear(n); report.lostCit++;
    scene.remove(n);
    npcs.splice(npcs.indexOf(n), 1);
    burst(n.position); grieve();
    toast(`${n.name} has fallen`);
  }
  function damageNpc(target, n) {
    npc = target; n = n * dm().dmg;
    if (target.role !== 'citizen') n = Math.max(1, Math.round(n * (1 - gearDef(target.gear.armor).reduce)));      // 병사 방어구
    if (TR(target).dmg) n = Math.max(1, Math.round(n * TR(target).dmg));                                         // 용감한 성격
    npc.hp = Math.max(0, npc.hp - n);
    if (npc.hp <= 0 && !npc.down) {
      if (npc.born === 'citizen') { removeNpc(npc); return; }
      npc.down = true; npc.target = null; npc.gatherT = 0; npc.returning = false; setTask(null); npc.workT = 0; npc.promote = null;
      npc.mat.color.set(0x777777);                // 회색으로 변환
      grieve();
      npc.anim.die();                             // 쓰러지는 애니메이션
      burst(npc.position);
    }
  }
  function reviveNpc() {
    npc.down = false; npc.hp = npc.maxHp;
    npc.mat.color.set(npc.baseColor); npc.anim.revive();
    npc.position.set(npc.home.x, 0, npc.home.z); npc.px = npc.home.x; npc.pz = npc.home.z;
  }
  function updateNpcs(dt, hour, t) {
    for (const n of npcs.slice()) {
      npc = n; updateNpc(dt, hour, t); n.anim.update(dt); updateMood(n, dt);
      { const f = Math.min(1.7, Math.max(0.45, DIST / 11)); n.labelSprite.scale.set(2.6 * f, 0.98 * f, 1); n.labelSprite.position.y = 2.2 + 0.5 * f; }      // 카메라 거리에 맞춰 이름표 크기 조절
      n.sickIcon.visible = n.sick > 0 && !n.down; if (n.sickIcon.visible) n.sickIcon.position.y = (n.hungerIcon.visible ? 4.2 : 3.4) + Math.sin(t * 4) * 0.07;
      n.hungerIcon.visible = n.hungry && !n.down;
      if (n.hungerIcon.visible) { n.hungerIcon.position.y = 3.4 + Math.sin(t * 5) * 0.09; const k = 0.95 + Math.sin(t * 9) * 0.05; n.hungerIcon.scale.set(k, k, 1); }
    }
  }

  // 시민 외형은 시대에 따라 달라진다: 옷 색 + 2시대 모자 / 3시대 투구와 망토
  const citizenColor = () => [0xe8d27a, 0xf2c230, 0xe39a1a][age - 1];
  const hatMat = mat(0x7a5530), helmMat = mat(0x9a9da4), capeMat = mat(0xa02a2a);
  function applyCitizenLook(n) {
    if (n.decor) { n.body.remove(n.decor); n.decor = null; }
    if (n.role !== 'citizen' || age < 2) return;
    const g = new THREE.Group();
    const add = (geo, m, px, py, pz) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.castShadow = true; g.add(o); return o; };
    if (age === 2) { add(new THREE.CylinderGeometry(0.32, 0.32, 0.04, 12), hatMat, 0, 1.93, 0); add(new THREE.CylinderGeometry(0.17, 0.2, 0.16, 10), hatMat, 0, 2.01, 0); }
    else { add(new THREE.SphereGeometry(0.24, 10, 6), helmMat, 0, 1.82, 0); add(new THREE.BoxGeometry(0.5, 0.9, 0.05), capeMat, 0, 1.15, -0.18); }
    n.body.add(g); n.decor = g;
  }
  function refreshCitizens() {
    for (const n of npcs) if (n.role === 'citizen') { n.baseColor = citizenColor(); if (!n.down) n.mat.color.set(n.baseColor); applyCitizenLook(n); }
  }

  // ---------- 인구 / 직업 (문명 시스템) ----------
  const builtBuildings = (kind) => obstacles.filter(o => o.userData.type === 'building' && o.userData.kind === kind);
  // ---------- 마을 번영도: 인구·식량·주거·방어·장비를 하나의 점수(0~100)로 ----------
  let prosScore = 25, prosBonus = 0, moodAvg = 60;
  function prosperity() {
    const cits = npcs.filter(n => n.role === 'citizen').length, houses = builtBuildings('house'), soldiers = npcs.filter(n => n.role !== 'citizen');
    const pop = Math.min(1, npcs.length / CFG.PROSPERITY_POP_TARGET);
    const food = cits ? (npcs.some(n => n.hungry) ? 0.15 : Math.min(1, 0.6 + 0.4 * res.food / (cits * CFG.RATION * 6))) : 0.5;
    const housing = houses.length ? houses.reduce((a, h) => a + (h.userData.level || 1), 0) / (houses.length * 3) : 0;
    const fences = obstacles.filter(o => o.userData.type === 'fence');
    const wall = designTier > 0 ? 0.5 + 0.5 * (fences.length ? fences.reduce((a, f) => a + f.userData.hp / f.userData.maxHp, 0) / fences.length : 0) : 0.1;
    const gear = soldiers.length ? soldiers.reduce((a, n) => a + ((n.role === 'melee' ? gearDef(n.gear.sword).tier : gearDef(n.gear.bow).tier) + gearDef(n.gear.armor).tier) / 4, 0) / soldiers.length : 0;
    const amen = Math.min(1, (builtBuildings('well').length ? 0.5 : 0) + (builtBuildings('market').length ? 0.5 : 0));
    moodAvg = npcs.length ? npcs.reduce((a, n) => a + n.mood, 0) / npcs.length : 60;
    return Math.min(100, (hasPerk('steward') ? 10 : 0) + (story.beacon ? 5 : 0) + Math.round(100 * (0.15 * pop + 0.15 * food + 0.15 * housing + 0.15 * wall + 0.1 * gear + 0.1 * amen + 0.2 * (moodAvg / 100))));
  }
  const prosLabel = (v) => CFG.PROSPERITY_LABELS.find(l => v < l[0])[1];
  const prosEl = document.getElementById('prosN'), moodEl = document.getElementById('moodN');
  function updateProsperity() {
    prosScore = prosperity();
    prosBonus = prosScore >= 80 ? 2 : prosScore >= 55 ? 1 : 0;           // 안정된 마을에는 이주민이 더 모인다
    const t = `${prosLabel(prosScore)} ${prosScore}`;
    if (prosEl.textContent !== t) prosEl.textContent = t;
    const mt = `${moodLabel(moodAvg)} ${Math.round(moodAvg)}`;
    if (moodEl.textContent !== mt) moodEl.textContent = mt;
  }
  // ---------- 아침 요약 카드: 어젯밤과 어제 하루 동안 마을에서 일어난 일 ----------
  const freshReport = () => ({ left: [], kills: 0, lostCit: 0, wallsLost: 0, built: 0, upgraded: 0, fort: 0, rep: 0, newCit: 0, equipped: 0, forged: 0, ill: [], healed: [], season: '', camps: '', res: { ...res }, pros: prosScore, pop: 0 });
  let report = freshReport();
  const repEl = document.getElementById('report'), repList = document.getElementById('repList');
  let repTimer;
  function showReport(dayNo) {
    const r = report, rows = [], d = (k) => res[k] - r.res[k];
    rows.push(r.kills ? `Night: ${r.kills} raider${r.kills > 1 ? 's' : ''} defeated` : 'A quiet night');
    if (r.wallsLost || r.lostCit) rows.push(`Lost: ${[r.wallsLost ? `${r.wallsLost} wall${r.wallsLost > 1 ? 's' : ''}` : '', r.lostCit ? `${r.lostCit} citizen${r.lostCit > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ')}`);
    if (r.built || r.upgraded) rows.push(`Built: ${r.built} · Upgraded: ${r.upgraded}`);
    { const fm = npcs.find(n => n.foreman), woodLeft = age >= CFG.UPGRADE_FENCE_AGE ? obstacles.filter(o => o.userData.type === 'fence' && o.userData.level === 'wood').length : 0;
      if (r.fort || r.rep || woodLeft) rows.push(`${fm ? 'Foreman ' + fm.name : 'Workers'}: ${r.fort} wall${r.fort === 1 ? '' : 's'} fortified, ${r.rep} repaired${woodLeft ? ` · ${woodLeft} wooden left${res.stone < CFG.FENCE_UPGRADE_STONE ? ' (need stone)' : ''}` : ''}`); }
    if (isRaid(dayNo)) rows.push(`⚠ Raid tonight: ${forecast(dayNo)}`); else if (isRaid(dayNo + 1)) rows.push(`⚠ Raid TOMORROW night: ${forecast(dayNo + 1)}`);
    if (r.season) rows.push(r.season);
    if (r.camps) rows.push(`Camps delivered: ${r.camps}`);
    if (r.newCit) rows.push(`New citizens: ${r.newCit}`);
    if (r.ill.length) rows.push(`Fell ill: ${r.ill.join(', ')}${builtBuildings('well').length ? '' : ' - a well would help'}`);
    if (r.healed.length) rows.push(`Recovered: ${r.healed.join(', ')}`);
    if (r.traded) rows.push('Market: sold surplus food for iron');
    if (r.left.length) rows.push(`Left the village: ${r.left.join(', ')}`);
    { const un = npcs.filter(n => n.mood < CFG.MOOD_UNHAPPY).length; rows.push(`Mood: ${moodLabel(moodAvg)} ${Math.round(moodAvg)}${un ? ` · ${un} unhappy` : ''}`); }
    if (prosScore > 40) rows.push(`Wealth draws raiders: +${Math.round((prosScore - 40) / 1.2)}% tonight`);
    if (r.equipped || r.forged) rows.push(`Gear: ${r.forged} forged · ${r.equipped} equipped`);
    const dr = [['wood', 'Wood'], ['stone', 'Stone'], ['iron', 'Iron'], ['food', 'Food']].map(([k, n]) => [n, Math.floor(d(k))]).filter(x => x[1] !== 0).map(([n, v]) => `${n} ${v > 0 ? '+' : ''}${v}`);
    if (dr.length) rows.push(`Stockpile: ${dr.join(' · ')}`);
    const dp = prosScore - r.pros;
    { const tn = nightTypeOf(dayNo), tm = nightTypeOf(dayNo + 1); rows.push(`Tonight: ${NIGHT_INFO[tn][0]}${tn === 'calm' ? '' : ' - ' + NIGHT_INFO[tn][1]}`); if (tm !== tn) rows.push(`Tomorrow night: ${NIGHT_INFO[tm][0]}`); }
    if (isRaid(dayNo) || isRaid(dayNo + 1)) rows.push(`Defense: ${defenseSummary()}`);
    rows.push(`Prosperity: ${prosLabel(prosScore)} ${prosScore}${dp ? ` (${dp > 0 ? '▲' : '▼'}${Math.abs(dp)})` : ''}`);
    document.getElementById('repTitle').textContent = `Day ${dayNo} · Morning report`;
    repList.innerHTML = rows.map(t => `<li>${t}</li>`).join('');
    repEl.classList.add('show'); clearTimeout(repTimer); repTimer = setTimeout(() => repEl.classList.remove('show'), 14000);
    report = freshReport();
  }
  repEl.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); repEl.classList.remove('show'); });
  // 마을을 떠나는 시민: 기분이 바닥(15 미만)이면 아침에 50% 확률로 짐을 싸서 떠난다
  function checkDepartures() {
    for (const n of npcs.filter(x => x.role === 'citizen' && x.mood < CFG.MOOD_LEAVE)) {
      if (Math.random() > 0.5) continue;
      npc = n; setTask(null); returnGear(n); if (n.work) { n.work.userData.worker = null; n.work = null; }
      scene.remove(n); npcs.splice(npcs.indexOf(n), 1); report.left.push(n.name);
    }
    if (report.left.length) setTimeout(() => toast(`${report.left.join(', ')} left the village - keep your people fed and safe`), 2400);
  }
  // ---------- 주민 카드: 주민을 누르면 이름, 직업, 성격, 기분, 하는 일을 보여 준다 ----------
  const ncEl = document.getElementById('npcCard'); let cardNpc = null, cardT = 0;
  const ROLE_TITLE = { melee: 'Soldier', archer: 'Archer', citizen: 'Citizen' };
  function renderCard() {
    const n = cardNpc;
    if (!n || !npcs.includes(n)) { cardNpc = null; ncEl.style.display = 'none'; return; }
    const tr = TR(n), m = Math.round(n.mood), col = m < CFG.MOOD_LEAVE ? '#d9534f' : m < CFG.MOOD_UNHAPPY ? '#e8923a' : m < CFG.MOOD_HAPPY ? '#d9c84a' : '#5cc86a';
    document.getElementById('ncName').textContent = n.name; document.getElementById('ncRole').textContent = `${ROLE_TITLE[n.role]} · HP ${n.hp}/${n.maxHp}`;
    document.getElementById('ncTrait').innerHTML = `<b>${tr.label}</b> - ${tr.desc}`;
    const bar = document.getElementById('ncMoodBar'); bar.style.width = `${m}%`; bar.style.background = col;
    document.getElementById('ncMoodTxt').textContent = `Mood: ${moodLabel(m)} (${m}/100)` + (m < CFG.MOOD_UNHAPPY ? ' - works slower' : m >= CFG.MOOD_HAPPY ? ' - works a bit faster' : '');
    const rows = [`Doing: ${n.down ? 'Down' : n.stateNow}`];
    if (n.hungry) rows.push('Hungry: speed and work at half');
    if (n.sick > 0) rows.push('Sick: slower and gloomy until it passes');
    if (n.role !== 'citizen' && vetLv(n)) rows.push(`Veteran rank ${vetLv(n)} (${n.vxp} drills): +${6 * vetLv(n)}% damage`);
    if (n.role !== 'citizen') rows.push(`Gear: ${gearDef(n.role === 'melee' ? n.gear.sword : n.gear.bow).name}${n.gear.armor !== 'armor_none' ? ' · ' + gearDef(n.gear.armor).name : ''}`);
    else {
      rows.push(`Job: ${jobTitle(n)}`);
      if (n.work) rows.push(`Works at: ${BUILDING_NAME[n.work.userData.kind] || 'the village'}`);
      const k = jobKind(n); if (k) rows.push(`Experience: ${(n.xp && n.xp[k]) || 0} tasks done`);
      const fav = CFG.TRAIT_JOB[n.trait]; if (fav) rows.push(`Talent: ${CFG.JOBS[fav]}${k === fav ? ' (using it: +10%)' : ''}`);
    }
    const jb = document.getElementById('ncJob'); jb.style.display = n.role === 'citizen' ? '' : 'none'; jb.textContent = `Job: ${PREF_LABEL(n.pref)} (tap to change)`;
    document.getElementById('ncInfo').innerHTML = rows.map(r => `<li>${r}</li>`).join('');
  }
  function openNpcCard(n) { cardNpc = n; renderCard(); ncEl.style.display = 'flex'; Snd.play('click'); }
  document.getElementById('ncJob').addEventListener('click', () => { if (cardNpc && cardNpc.role === 'citizen') { nextPref(cardNpc); renderCard(); } });
  document.getElementById('ncClose').addEventListener('click', () => { cardNpc = null; ncEl.style.display = 'none'; });
  ncEl.addEventListener('pointerdown', e => { if (e.target === ncEl) { cardNpc = null; ncEl.style.display = 'none'; } });
  // 시장: 매일 아침 남는 식량을 팔아 철을 산다 (식량 30 이상이면 10 → 철 3)
  function marketTrade() {
    if (!builtBuildings('market').length || res.food < 30) return;
    const lv = bLevel('market'), gain = 2 + lv, m = builtBuildings('market')[0];
    res.food -= 10; res.iron += gain; updateHud(); report.traded = (report.traded || 0) + 1;
    floatText(`Market: Food→Iron +${gain}`, m.position.x, 3.2, m.position.z);
  }
