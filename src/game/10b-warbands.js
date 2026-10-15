  // ---------- 전투단 (Warband, 군대 확장 1단계): 병사를 최대 6명씩 묶는다. 전투단이 원정에 함께 나가는 단위다 ----------
  // (이 파일의 것은 모두 function 선언이다: 10-npcs 의 초기 병사 생성이 이 파일보다 먼저 실행되기 때문)
  const inParty = (n) => escortBands.includes(n.warband) || !!n.levy;           // 원정에 가는 병사: 고른 전투단 + 소집한 농민병
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
  const bandMax = () => (stage >= 3 ? 3 : stage >= 2 ? 2 : 1) + (bannersOpen() ? CFG.BANNER.HOST_BONUS : 0) + (hasPerk('warhost') ? 1 : 0);
  const bringing = (i) => escortBands.includes(i);
  function toggleBring(i) {
    if (bringing(i)) { escortBands = escortBands.filter(x => x !== i); return true; }
    const mx = bandMax();
    if (mx === 1) { escortBands = [i]; return true; }
    if (escortBands.length >= mx) { toast(`Max ${mx} warband${mx > 1 ? 's' : ''} at this stage`); return false; }
    escortBands.push(i); return true;
  }
  function soldierCount() { return npcs.filter(n => (isSoldier(n) && !n.levy) || n.promote).length + holdCount(); }

  // ---------- 전투단 이름·색(플레이어가 바꿀 수 있음)과 화면 아래 띠, 전투단 창 ----------
  let warbandInfo = null;                                       // [{ name, color }] - 저장됨. 처음 쓸 때 기본값으로 만든다
  const WB_COLORS = ['#e0604a', '#4a8be0', '#5fc060', '#e0b43c', '#a864d6', '#b8794a', '#d8dce4', '#4a4f5a'];       // 고를 수 있는 깃발 색
  function wbi(i) {
    if (!warbandInfo) warbandInfo = CFG.WARBAND.NAMES.map((n, k) => ({ name: `${n} Warband`, color: CFG.WARBAND.COLORS[k] }));
    return warbandInfo[i] || { name: `Band ${i + 1} Warband`, color: '#9aa0aa' };
  }
  // ---------- 깃발 (Banner, 시대 5): 전투단 2~3개를 한 깃발 아래 묶는다. 같은 깃발의 전투단이 가까이 있으면 더 세게 치고 덜 맞는다. 명령과 원정 합류도 한 번에 ----------
  function bannersOpen() { return stage >= CFG.BANNER.STAGE; }
  function bannerOf(i) { const b = i >= 0 && warbandInfo && warbandInfo[i] ? warbandInfo[i].banner : -1; return bannersOpen() && b >= 0 && b < CFG.BANNER.MAX ? b : -1; }
  function bannerName(b) { return `${CFG.BANNER.NAMES[b]} Banner`; }
  function bannerBands(b) { const r = []; for (let i = 0; i < CFG.WARBAND.MAX; i++) if (bannerOf(i) === b && warbandMembers(i).length) r.push(i); return r; }
  function setBanner(i, b) {
    if (!bannersOpen() || i < 0 || i >= CFG.WARBAND.MAX) return false;
    if (b >= 0) { if (b >= CFG.BANNER.MAX) return false; let c = 0; for (let k = 0; k < CFG.WARBAND.MAX; k++) if (k !== i && bannerOf(k) === b) c++; if (c >= CFG.BANNER.MAX_BANDS) return false; }
    wbi(i); warbandInfo[i].banner = b; return true;
  }
  function cycleBanner(i) { const cur = bannerOf(i); for (let k = 1; k <= CFG.BANNER.MAX + 1; k++) { const b = ((cur + 1 + k) % (CFG.BANNER.MAX + 1)) - 1; if (b !== cur && setBanner(i, b)) return b; } return cur; }
  function setBannerOrder(b, o) { for (let i = 0; i < CFG.WARBAND.MAX; i++) if (bannerOf(i) === b) setWarbandOrder(i, o); }
  function toggleBringBanner(b) {                                // 깃발의 전투단 전부를 데려가거나 뺀다 (자리가 모자라면 되는 만큼만)
    const bands = bannerBands(b); if (!bands.length) return false;
    if (bands.every(bringing)) { escortBands = escortBands.filter(x => !bands.includes(x)); return true; }
    let left = 0; for (const i of bands) if (!bringing(i)) { if (escortBands.length >= bandMax()) { left++; continue; } escortBands.push(i); }
    if (left) toast(`Only ${bandMax()} warbands fit in the host`); return true;
  }
  function bannerMods(n) {                                       // 같은 깃발의 다른 전투단 병사가 가까이 있으면 보너스
    const B = CFG.BANNER, b = n && n.warband >= 0 ? bannerOf(n.warband) : -1; if (b < 0 || n.down) return { dmg: 1, guard: 1 };
    const bands = new Set([n.warband]);
    for (const m of npcs) if (m !== n && !m.down && m.warband >= 0 && m.warband !== n.warband && bannerOf(m.warband) === b && !!m.escort === !!n.escort && Math.hypot(m.position.x - n.position.x, m.position.z - n.position.z) <= B.RADIUS) bands.add(m.warband);
    return bands.size >= B.MIN_BANDS ? { dmg: 1 + B.DMG, guard: 1 - B.GUARD } : { dmg: 1, guard: 1 };
  }
  // 전투단 명령 (전쟁 계층 2단계): 전투단마다 하나. 저장된 예전 데이터에는 없으므로 읽을 때 'forward' 로 대신한다. 행동 연결은 다음 단계
  const WB_ORDERS = ['forward', 'stand', 'withdraw', 'charge'];
  function warbandOrder(i) { const o = i >= 0 && warbandInfo && warbandInfo[i] ? warbandInfo[i].order : null; return WB_ORDERS.includes(o) ? o : 'forward'; }
  function setWarbandOrder(i, o) { if (i < 0 || i >= CFG.WARBAND.MAX || !WB_ORDERS.includes(o)) return false; wbi(i); warbandInfo[i].order = o; for (const n of warbandMembers(i)) n.hold = null; return true; }
  const WB_ORDER_LABEL = { forward: 'Forward', stand: 'Stand firm', withdraw: 'Withdraw', charge: 'Charge' };
  const WB_ORDER_HINT = { forward: 'Fight as usual.', stand: 'Hold ground, no chasing.', withdraw: 'Fall back, no melee.', charge: 'Rush the foe.' };
  const orderOf = (n) => exActive && courageOf() <= 0 && n && n.role === 'melee' ? 'withdraw' : n && n.warband >= 0 ? warbandOrder(n.warband) : 'forward';
  // ---------- 지휘관의 깃발 (Leader's standard): 주인공(지휘관)의 곁에 있는 병사는 더 세게 치고 덜 맞는다. 지휘관이 쓰러지면 사라진다 ----------
  function standardRadius() { const S = CFG.STANDARD; return S.RADIUS * (1 + S.RANK_RADIUS * pl.st.standard) * (playerClass === 'commander' ? 1.25 : 1); }
  function standardMods(n) { const a = leaderMods(n), c = bannerMods(n); return { dmg: a.dmg * c.dmg, guard: a.guard * c.guard }; }
  function leaderMods(n) {
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
    const near = !dead && enemies.some(e => !e.userData.sinking && Math.hypot(e.position.x - player.position.x, e.position.z - player.position.z) < 36) && npcs.some(n => n.role !== 'citizen' && !n.down && leaderMods(n).dmg > 1);
    if (!standardRing) {
      standardRing = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffd54a, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
      standardRing.rotation.x = -Math.PI / 2; standardRing.position.y = 0.07; scene.add(standardRing);
    }
    const m = standardRing.material; m.opacity += ((near ? 0.45 : 0) - m.opacity) * 0.1; standardRing.visible = m.opacity > 0.02;
    standardFlag.visible = !dead && !bird && m.opacity > 0.12; standardFlag.userData.cloth.rotation.y = Math.sin(t * 4) * 0.35;       // 깃발은 병사와 함께 싸울 때만 보인다 (마을에서는 숨김)
    if (standardRing.visible) { standardRing.position.x = player.position.x; standardRing.position.z = player.position.z; standardRing.position.y = groundY(player.position.x, player.position.z, standardRadius() * 0.6) + 0.1; standardRing.scale.setScalar(standardRadius()); }
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
    else { markedFoe = t; toast(`Marked: ${FOE_NAME[t.userData.kind] || 'Foe'}`); Snd.play('click'); }
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
      html += `<button class="wbchip${sel ? ' sel' : ''}" data-wb="${i}" style="--c:${wbi(i).color}" title="${wbi(i).name}"><i></i><b>${m.length - hurt}/${m.length}</b>${sel ? '<em>&#9873;</em>' : ''}${bannerOf(i) >= 0 ? `<s style="color:${CFG.BANNER.COLORS[bannerOf(i)]}">${CFG.BANNER.NAMES[bannerOf(i)][0]}</s>` : ''}${warbandOrder(i) !== 'forward' ? `<u>${WB_ORDER_LABEL[warbandOrder(i)][0]}</u>` : ''}</button>`;
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
      ${bannersOpen() ? `<div class="wbn"><button id="wbBanner">${bannerOf(i) >= 0 ? bannerName(bannerOf(i)) + ' (' + bannerBands(bannerOf(i)).length + ' bands)' : 'No banner'}</button>${bannerOf(i) >= 0 && !exActive ? `<button id="wbBannerBring" class="${bannerBands(bannerOf(i)).every(bringing) ? 'on' : ''}">Bring whole banner</button>` : ''}</div>` : ''}
      <div class="word">${WB_ORDERS.map(o => `<button class="wbord${o === warbandOrder(i) ? ' on' : ''}" data-ord="${o}">${WB_ORDER_LABEL[o]}</button>`).join('')}</div><small>${WB_ORDER_HINT[warbandOrder(i)]}${bannerOf(i) >= 0 ? ' Orders go to the whole banner.' : ''}</small>
      <small>${m.length}/${CFG.WARBAND.SIZE} soldiers</small><button id="wbClose">Close</button>`;
  }
  function openWbPanel(i) { wbOpen = i; renderWbPanel(); wbPanel.style.display = 'flex'; Snd.play('click'); }
  function closeWbPanel() { wbOpen = -1; wbPanel.style.display = 'none'; }
  wbPanel.addEventListener('pointerdown', e => {
    if (e.target === wbPanel) { closeWbPanel(); return; }
    const t = e.target, i = wbOpen; if (i < 0) return;
    if (t.dataset && t.dataset.ord) { if (bannerOf(i) >= 0) setBannerOrder(bannerOf(i), t.dataset.ord); else setWarbandOrder(i, t.dataset.ord); toast(`${wbi(i).name}: ${WB_ORDER_LABEL[t.dataset.ord]}`); renderWbPanel(); wbBarHtml = ''; renderWbBar(); e.stopPropagation(); return; }
    if (t.dataset && t.dataset.act) { const n = npcs[+t.dataset.ix];
      if (n) { if (t.dataset.act === 'home' && n.role === 'melee') cycleHomeCls(n); else if (t.dataset.act === 'trip' && n.role === 'melee') cycleTripCls(n); else if (t.dataset.act === 'band' && !n.escort) { if (cycleWarband(n)) toast(`${n.name} joins ${warbandName(n.warband)}`); else toast('All warbands are full'); wbBarHtml = ''; renderWbBar(); } renderWbPanel(); }
      e.stopPropagation(); return; }
    if (t.id === 'wbClose') { closeWbPanel(); }
    else if (t.id === 'wbBanner') { const b = cycleBanner(i); toast(b >= 0 ? `${warbandName(i)} joins the ${bannerName(b)}` : `${warbandName(i)} leaves its banner`); renderWbPanel(); wbBarHtml = ''; renderWbBar(); }
    else if (t.id === 'wbBannerBring') { toggleBringBanner(bannerOf(i)); renderWbPanel(); wbBarHtml = ''; renderWbBar(); }
    else if (t.id === 'wbBring') { toggleBring(i); renderWbPanel(); wbBarHtml = ''; renderWbBar(); }
    else if (t.id === 'wbRename') {
      let v = null; try { v = window.prompt('Name this warband', wbi(i).name); } catch (er) {}
      if (v !== null) { v = v.trim().slice(0, 22); const def = `${CFG.WARBAND.NAMES[i]} Warband`; wbi(i).name = v || def; renderWbPanel(); wbBarHtml = ''; renderWbBar(); for (const n of warbandMembers(i)) n.labelText = ''; }
    } else if (t.dataset && t.dataset.color) { wbi(i).color = t.dataset.color; renderWbPanel(); wbBarHtml = ''; renderWbBar(); for (const n of warbandMembers(i)) n.labelText = ''; }
    else { const r1 = t.closest('.wr1'), li = r1 && r1.closest('li[data-n]'); if (li) { const n = npcs[+li.dataset.n]; closeWbPanel(); if (n) { openNpcCard(n); cardBackWb = i; } } }
    e.stopPropagation();
  });
  setInterval(renderWbBar, 600);
