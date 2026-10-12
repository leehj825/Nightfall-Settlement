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
  const wbBar = document.getElementById('wbBar'), wbPanel = document.getElementById('wbPanel');
  let wbOpen = -1, wbBarHtml = '';
  function renderWbBar() {
    const show = !dead && !uiPause;                                  // 원정 중에도 보인다 (함께 간 전투단만)
    let html = '';
    if (show) for (let i = 0; i < CFG.WARBAND.MAX; i++) {
      const m = warbandMembers(i).filter(n => !exActive || n.escort); if (!m.length) continue;
      const hurt = m.filter(n => n.down).length, sel = !exActive && escortWarband === i;
      html += `<button class="wbchip${sel ? ' sel' : ''}" data-wb="${i}" style="--c:${wbi(i).color}" title="${wbi(i).name}"><i></i><b>${m.length - hurt}/${m.length}</b>${sel ? '<em>&#9873;</em>' : ''}${warbandOrder(i) !== 'forward' ? `<u>${WB_ORDER_LABEL[warbandOrder(i)][0]}</u>` : ''}</button>`;
    }
    if (html === wbBarHtml) return; wbBarHtml = html; wbBar.innerHTML = html; wbBar.style.display = html ? 'flex' : 'none';
  }
  wbBar.addEventListener('pointerdown', e => { const b = e.target.closest('.wbchip'); if (!b) return; e.preventDefault(); e.stopPropagation(); openWbPanel(+b.dataset.wb); });
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
      ${exActive ? '' : `<button id="wbBring" class="${escortWarband === i ? 'on' : ''}">${escortWarband === i ? 'Coming on your next journey &#10003;' : 'Bring on your next journey'}</button>`}
      <div class="word">${WB_ORDERS.map(o => `<button class="wbord${o === warbandOrder(i) ? ' on' : ''}" data-ord="${o}">${WB_ORDER_LABEL[o]}</button>`).join('')}</div><small>${WB_ORDER_HINT[warbandOrder(i)]}</small>
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
    else if (t.id === 'wbBring') { escortWarband = escortWarband === i ? -1 : i; renderWbPanel(); wbBarHtml = ''; renderWbBar(); }
    else if (t.id === 'wbRename') {
      let v = null; try { v = window.prompt('Name this warband', wbi(i).name); } catch (er) {}
      if (v !== null) { v = v.trim().slice(0, 22); const def = `${CFG.WARBAND.NAMES[i]} Warband`; wbi(i).name = v || def; renderWbPanel(); wbBarHtml = ''; renderWbBar(); for (const n of warbandMembers(i)) n.labelText = ''; }
    } else if (t.dataset && t.dataset.color) { wbi(i).color = t.dataset.color; renderWbPanel(); wbBarHtml = ''; renderWbBar(); for (const n of warbandMembers(i)) n.labelText = ''; }
    else { const r1 = t.closest('.wr1'), li = r1 && r1.closest('li[data-n]'); if (li) { const n = npcs[+li.dataset.n]; closeWbPanel(); if (n) { openNpcCard(n); cardBackWb = i; } } }
    e.stopPropagation();
  });
  setInterval(renderWbBar, 600);
