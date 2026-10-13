  // ---------- 전투단 (Warband, 군대 확장 1단계): 병사를 최대 6명씩 묶는다. 전투단이 원정에 함께 나가는 단위다 ----------
  // (이 파일의 것은 모두 function 선언이다: 10-npcs 의 초기 병사 생성이 이 파일보다 먼저 실행되기 때문)
  function isSoldier(n) { return n.role !== 'citizen'; }
  function warbandMembers(i) { return npcs.filter(n => isSoldier(n) && n.warband === i); }
  function warbandName(i) { return wbi(i).name; }
  function warbandColor(i) { return i >= 0 ? wbi(i).color : '#9aa0aa'; }
  function assignWarband(n) {                                   // 자리가 있는 첫 전투단로 (모두 찼으면 전투단 없음 -1)
    if (!isSoldier(n)) { n.warband = null; return; }
    n.warband = -1;
    for (let i = 0; i < CFG.WARBAND.MAX; i++) if (warbandMembers(i).length < CFG.WARBAND.SIZE) { n.warband = i; break; }
  }
  function cycleWarband(n) {                                    // 카드에서 눌러 다음 전투단로 옮긴다 (꽉 찬 전투단는 건너뜀)
    const cur = n.warband >= 0 ? n.warband : -1, M = CFG.WARBAND.MAX;
    for (let k = 1; k <= M; k++) {
      const i = (cur + k + M) % M;
      if (i !== cur && warbandMembers(i).length < CFG.WARBAND.SIZE) { n.warband = i; return true; }
    }
    return false;
  }
  // 병사 수 상한: 기본 6명 + 병영 1채당 6명 + 사격장 1채당 3명
  function soldierCap() { return CFG.WARBAND.CAP_BASE + CFG.WARBAND.CAP_BARRACKS * builtBuildings('barracks').length + CFG.WARBAND.CAP_RANGE * builtBuildings('range').length; }
  // 병사 직업(class)은 두 개다: 마을에서 쓰는 직업(clsHome)과 원정에서 쓰는 직업(clsTrip, 없으면 마을 직업과 같다). n.cls 는 지금 쓰는 직업이다.
  // 출발할 때 n.cls = 원정 직업, 돌아오면 n.cls = 마을 직업. 원정 중에 카드에서 바꾸면 원정 직업만, 마을에서 바꾸면 마을 직업만 바뀐다.
  function clsName(c) { return { sword: 'Swordsman', spear: 'Spearman', greatsword: 'Great Swordsman', medic: 'Medic' }[c] || 'Swordsman'; }
  function homeCls(n) { return n.clsHome || n.cls || 'sword'; }
  function tripCls(n) { return n.clsTrip || homeCls(n); }
  function setClassFor(n, c) { if (n.escort) n.clsTrip = c; else { n.clsHome = c; n.cls = c; } if (n.escort) n.cls = c; applyGear(n); }
  const CLS_LIST = ['sword', 'spear', 'greatsword', 'medic'];
  function setHomeCls(n, c) { n.clsHome = c; if (!n.escort) { n.cls = c; applyGear(n); } }
  function setTripCls(n, c) { n.clsTrip = c; if (n.escort) { n.cls = c; applyGear(n); } }
  function cycleHomeCls(n) { setHomeCls(n, CLS_LIST[(CLS_LIST.indexOf(homeCls(n)) + 1) % CLS_LIST.length]); }
  function cycleTripCls(n) { setTripCls(n, CLS_LIST[(CLS_LIST.indexOf(tripCls(n)) + 1) % CLS_LIST.length]); }
  // 원정에 데려가는 전투단: 시대에 따라 최대 1(시대 1) / 2(시대 2) / 3(시대 3)개. 다시 누르면 뺀다
  const bandMax = () => age >= 3 ? 3 : age >= 2 ? 2 : 1;
  const bringing = (i) => escortBands.includes(i);
  function toggleBring(i) {
    if (bringing(i)) { escortBands = escortBands.filter(x => x !== i); return true; }
    const mx = bandMax();
    if (mx === 1) { escortBands = [i]; return true; }
    if (escortBands.length >= mx) { toast(`You can bring ${mx} warbands at this age${age < 3 ? ' (more in the next age)' : ''}`); return false; }
    escortBands.push(i); return true;
  }
  function soldierCount() { return npcs.filter(n => isSoldier(n) || n.promote).length; }

  // ---------- 전투단 이름·색(플레이어가 바꿀 수 있음)과 화면 아래 띠, 전투단 창 ----------
  let warbandInfo = null;                                       // [{ name, color }] - 저장됨. 처음 쓸 때 기본값으로 만든다
  const WB_COLORS = ['#e0604a', '#4a8be0', '#5fc060', '#e0b43c', '#a864d6', '#b8794a', '#d8dce4', '#4a4f5a'];       // 고를 수 있는 깃발 색
  function wbi(i) {
    if (!warbandInfo) warbandInfo = CFG.WARBAND.NAMES.map((n, k) => ({ name: `${n} Warband`, color: CFG.WARBAND.COLORS[k] }));
    return warbandInfo[i] || { name: `Band ${i + 1} Warband`, color: '#9aa0aa' };
  }
  // 전투단 명령 (전쟁 계층 2단계): 전투단마다 하나. 저장된 예전 데이터에는 없으므로 읽을 때 'forward' 로 대신한다. 행동 연결은 다음 단계
  const WB_ORDERS = ['forward', 'stand', 'withdraw', 'charge'];
  function warbandOrder(i) { const o = i >= 0 && warbandInfo && warbandInfo[i] ? warbandInfo[i].order : null; return WB_ORDERS.includes(o) ? o : 'forward'; }
  function setWarbandOrder(i, o) { if (i < 0 || i >= CFG.WARBAND.MAX || !WB_ORDERS.includes(o)) return false; wbi(i); warbandInfo[i].order = o; for (const n of warbandMembers(i)) n.hold = null; return true; }
  const WB_ORDER_LABEL = { forward: 'Forward', stand: 'Stand firm', withdraw: 'Withdraw', charge: 'Charge' };
  const WB_ORDER_HINT = { forward: 'Fight as usual: take on foes near the village or follow you.', stand: 'Hold the ground: fight only foes that come close, do not chase.', withdraw: 'Fall back: melee men do not engage; on a journey they stay by your side.', charge: 'Rush the foe: notice enemies from further away and chase them harder.' };
  const orderOf = (n) => n && n.warband >= 0 ? warbandOrder(n.warband) : 'forward';
  // ---------- 지휘관의 깃발 (Leader's standard): 주인공(지휘관)의 곁에 있는 병사는 더 세게 치고 덜 맞는다. 지휘관이 쓰러지면 사라진다 ----------
  function standardRadius() { const S = CFG.STANDARD; return S.RADIUS * (1 + S.RANK_RADIUS * pl.st.standard) * (playerClass === 'commander' ? 1.25 : 1); }
  function standardMods(n) {
    if (dead || !n || n.role === 'citizen' || Math.hypot(n.position.x - player.position.x, n.position.z - player.position.z) > standardRadius()) return { dmg: 1, guard: 1 };
    const S = CFG.STANDARD, k = playerClass === 'commander' ? 1.5 : 1;
    return { dmg: 1 + (S.DMG + S.RANK_DMG * pl.st.standard) * k, guard: 1 - (S.GUARD + S.RANK_GUARD * pl.st.standard) * k };
  }
  let standardRing = null, standardFlag = null;
  function updateStandard(t) {
    if (!standardFlag) {                                                    // 등에 맨 깃발: 가는 장대와 펄럭이는 천
      const g = new THREE.Group(), pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.9, 5), new THREE.MeshLambertMaterial({ color: 0x6a4a2a })), cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.38), new THREE.MeshLambertMaterial({ color: 0xe0b43c, side: THREE.DoubleSide }));
      pole.position.y = 1.15; cloth.position.set(0.3, 1.85, 0); g.add(pole, cloth); g.position.set(0.18, 0, -0.34); g.rotation.y = 0.2; g.userData.cloth = cloth; player.add(g); standardFlag = g;
    }
    standardFlag.visible = !dead && !bird; standardFlag.userData.cloth.rotation.y = Math.sin(t * 4) * 0.35;
    const near = !dead && enemies.some(e => !e.userData.sinking && Math.hypot(e.position.x - player.position.x, e.position.z - player.position.z) < 36) && npcs.some(n => n.role !== 'citizen' && !n.down && standardMods(n).dmg > 1);
    if (!standardRing) {
      standardRing = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffd54a, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
      standardRing.rotation.x = -Math.PI / 2; standardRing.position.y = 0.07; scene.add(standardRing);
    }
    const m = standardRing.material; m.opacity += ((near ? 0.45 : 0) - m.opacity) * 0.1; standardRing.visible = m.opacity > 0.02;
    if (standardRing.visible) { standardRing.position.x = player.position.x; standardRing.position.z = player.position.z; standardRing.scale.setScalar(standardRadius()); }
  }
  // ---------- 적 표시 (Mark the foe): 가장 가까운(앞쪽 우선) 적에 표시를 달면 모든 전투단이 그 적을 먼저 노린다. 한 번 더 누르면 해제 ----------
  let markedFoe = null, markRing = null;
  const FOE_NAME = { normal: 'Raider', brute: 'Brute', shield: 'Shieldbearer', siege: 'Siege thrower', boss: 'Boss', beast: 'Beast', archer: 'Archer', healer: 'Healer', sapper: 'Sapper' };
  function markValid(e) { return !!e && enemies.includes(e) && !e.userData.sinking && !(e.userData.dying > 0); }
  function pickMarkTarget() {
    let best = null, bs = 1e9;
    for (const e of enemies) {
      const u = e.userData; if (u.sinking || u.dying > 0 || u.prowl || !!u.ex !== !!exActive) continue;      // 원정 중에는 원정 지역의 적만, 마을에서는 마을의 적만
      const dx = e.position.x - player.position.x, dz = e.position.z - player.position.z, d = Math.hypot(dx, dz); if (d > 45) continue;
      const front = d > 0.1 ? (dx * Math.sin(facing) + dz * Math.cos(facing)) / d : 0, sc = d - 8 * front;       // 가깝고 바라보는 쪽일수록 먼저
      if (sc < bs) { bs = sc; best = e; }
    }
    return best;
  }
  function toggleMark() {
    const t = pickMarkTarget();
    if (!t) { if (markedFoe) { markedFoe = null; toast('Mark cleared'); } else toast('No foe in sight to mark'); }
    else if (t === markedFoe) { markedFoe = null; toast('Mark cleared'); }
    else { markedFoe = t; toast(`Foe marked: ${FOE_NAME[t.userData.kind] || 'Foe'} - your warbands focus it`); Snd.play('click'); }
    wbBarHtml = ''; renderWbBar();
  }
  function updateMark(t) {
    if (markedFoe && !markValid(markedFoe)) { markedFoe = null; wbBarHtml = ''; }
    if (!markedFoe) { if (markRing) markRing.visible = false; return; }
    if (!markRing) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.9, depthTest: false, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.1, 24), mat), cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 4), mat);
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.1; cone.rotation.x = Math.PI; ring.renderOrder = cone.renderOrder = 999;
      markRing = new THREE.Group(); markRing.add(ring, cone); markRing.userData = { ring, cone }; scene.add(markRing);
    }
    const u = markedFoe.userData, k = u.boss ? 1.9 : (u.r || 0.5) * 1.8 + 0.4;
    markRing.visible = true; markRing.position.set(markedFoe.position.x, markedFoe.position.y - (u.baseY || 0), markedFoe.position.z);
    markRing.userData.ring.scale.setScalar(k * (1 + 0.08 * Math.sin(t * 7)));
    markRing.userData.cone.position.y = 2.6 * (u.boss ? 1.8 : 1) + Math.sin(t * 6) * 0.15;
  }
  const wbBar = document.getElementById('wbBar'), wbPanel = document.getElementById('wbPanel');
  let wbOpen = -1, wbBarHtml = '';
  function renderWbBar() {
    const show = !dead && !uiPause;                                  // 원정 중에도 보인다 (함께 간 전투단만)
    let html = '';
    if (show) for (let i = 0; i < CFG.WARBAND.MAX; i++) {
      const m = warbandMembers(i).filter(n => !exActive || n.escort); if (!m.length) continue;
      const hurt = m.filter(n => n.down).length, sel = !exActive && bringing(i);
      html += `<button class="wbchip${sel ? ' sel' : ''}" data-wb="${i}" style="--c:${wbi(i).color}" title="${wbi(i).name}"><i></i><b>${m.length - hurt}/${m.length}</b>${sel ? '<em>&#9873;</em>' : ''}${warbandOrder(i) !== 'forward' ? `<u>${WB_ORDER_LABEL[warbandOrder(i)][0]}</u>` : ''}</button>`;
    }
    if (html) html += `<button class="wbmark${markedFoe ? ' on' : ''}" data-mark="1" title="Mark the foe (Y)">&#9678; Mark</button>`;
    if (html === wbBarHtml) return; wbBarHtml = html; wbBar.innerHTML = html; wbBar.style.display = html ? 'flex' : 'none';
  }
  wbBar.addEventListener('pointerdown', e => { if (e.target.closest('.wbmark')) { e.preventDefault(); e.stopPropagation(); toggleMark(); return; } const b = e.target.closest('.wbchip'); if (!b) return; e.preventDefault(); e.stopPropagation(); openWbPanel(+b.dataset.wb); });
  function renderWbPanel() {
    const i = wbOpen; if (i < 0) return;
    const m = warbandMembers(i), info = wbi(i);
    if (!m.length) { closeWbPanel(); return; }
    const sw = WB_COLORS.map(c => `<button class="wbsw${c === info.color ? ' on' : ''}" data-color="${c}" style="background:${c}"></button>`).join('');
    const rows = m.map((n, k) => { const ix = npcs.indexOf(n);
      return `<li data-n="${ix}"><div class="wr1"><b>${clsTitle(n)}</b> ${n.name} <span>${n.down ? 'Down' : `HP ${n.hp}/${n.maxHp}`}${vetLv(n) ? ' · vet ' + vetLv(n) : ''}</span></div>
      <div class="wr2">${n.role === 'melee' ? `<button class="wbact" data-act="home" data-ix="${ix}">At home: ${clsName(homeCls(n))}</button><button class="wbact" data-act="trip" data-ix="${ix}">Journey: ${clsName(tripCls(n))}</button>` : ''}${n.escort ? '' : `<button class="wbact" data-act="band" data-ix="${ix}">Move band</button>`}</div></li>`; }).join('');
    wbPanel.querySelector('.wcard').innerHTML = `<div class="whead"><i style="background:${info.color}"></i><b>${info.name}</b><button id="wbRename">Rename</button></div>
      <div class="wsw">${sw}</div><ul class="wlist">${rows}</ul>
      ${exActive ? '' : `<button id="wbBring" class="${bringing(i) ? 'on' : ''}">${bringing(i) ? 'Coming on your next journey &#10003;' : 'Bring on your next journey'}</button>`}
      <div class="word">${WB_ORDERS.map(o => `<button class="wbord${o === warbandOrder(i) ? ' on' : ''}" data-ord="${o}">${WB_ORDER_LABEL[o]}</button>`).join('')}</div><small>${WB_ORDER_HINT[warbandOrder(i)]}</small>
      <small>Your standard: soldiers within ${Math.round(standardRadius())} paces of you deal +${Math.round((standardMods({ role: 'melee', position: player.position }).dmg - 1) * 100)}% damage and take ${Math.round((1 - standardMods({ role: 'melee', position: player.position }).guard) * 100)}% less.</small>
      <small>${m.length}/${CFG.WARBAND.SIZE} soldiers. At home sets the class in town; Journey sets the class on journeys. Tap a soldier's name to open their card; the card's Close button brings you back here.</small><button id="wbClose">Close</button>`;
  }
  function openWbPanel(i) { wbOpen = i; renderWbPanel(); wbPanel.style.display = 'flex'; Snd.play('click'); }
  function closeWbPanel() { wbOpen = -1; wbPanel.style.display = 'none'; }
  wbPanel.addEventListener('pointerdown', e => {
    if (e.target === wbPanel) { closeWbPanel(); return; }
    const t = e.target, i = wbOpen; if (i < 0) return;
    if (t.dataset && t.dataset.ord) { setWarbandOrder(i, t.dataset.ord); toast(`${wbi(i).name}: ${WB_ORDER_LABEL[t.dataset.ord]}`); renderWbPanel(); wbBarHtml = ''; renderWbBar(); e.stopPropagation(); return; }
    if (t.dataset && t.dataset.act) { const n = npcs[+t.dataset.ix];
      if (n) { if (t.dataset.act === 'home' && n.role === 'melee') cycleHomeCls(n); else if (t.dataset.act === 'trip' && n.role === 'melee') cycleTripCls(n); else if (t.dataset.act === 'band' && !n.escort) { if (cycleWarband(n)) toast(`${n.name} joins ${warbandName(n.warband)}`); else toast('All warbands are full'); wbBarHtml = ''; renderWbBar(); } renderWbPanel(); }
      e.stopPropagation(); return; }
    if (t.id === 'wbClose') { closeWbPanel(); }
    else if (t.id === 'wbBring') { toggleBring(i); renderWbPanel(); wbBarHtml = ''; renderWbBar(); }
    else if (t.id === 'wbRename') {
      let v = null; try { v = window.prompt('Name this warband', wbi(i).name); } catch (er) {}
      if (v !== null) { v = v.trim().slice(0, 22); const def = `${CFG.WARBAND.NAMES[i]} Warband`; wbi(i).name = v || def; renderWbPanel(); wbBarHtml = ''; renderWbBar(); for (const n of warbandMembers(i)) n.labelText = ''; }
    } else if (t.dataset && t.dataset.color) { wbi(i).color = t.dataset.color; renderWbPanel(); wbBarHtml = ''; renderWbBar(); for (const n of warbandMembers(i)) n.labelText = ''; }
    else { const r1 = t.closest('.wr1'), li = r1 && r1.closest('li[data-n]'); if (li) { const n = npcs[+li.dataset.n]; closeWbPanel(); if (n) { openNpcCard(n); cardBackWb = i; } } }
    e.stopPropagation();
  });
  setInterval(renderWbBar, 600);
