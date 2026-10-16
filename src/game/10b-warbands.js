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
  function soldierCap() { return CFG.WARBAND.CAP_BASE + CFG.WARBAND.CAP_BARRACKS * builtBuildings('barracks').length + CFG.WARBAND.CAP_RANGE * builtBuildings('range').length + CFG.WARBAND.CAP_YARD * builtBuildings('trainyard').length; }
  // 병사 직업(class)은 두 개다: 마을에서 쓰는 직업(clsHome)과 원정에서 쓰는 직업(clsTrip, 없으면 마을 직업과 같다). n.cls 는 지금 쓰는 직업이다.
  // 출발할 때 n.cls = 원정 직업, 돌아오면 n.cls = 마을 직업. 원정 중에 카드에서 바꾸면 원정 직업만, 마을에서 바꾸면 마을 직업만 바뀐다.
  // 궁수도 하나의 '직업'이다: 직업을 궁수로 바꾸면 병사의 역할(role)이 archer 로, 다른 직업으로 바꾸면 melee 로 바뀐다 (체력 비율·장비·숙련은 그대로). applyGear 가 매번 맞춰 준다
  function syncClassRole(n) {
    if (!n.clsSet || n.role === 'citizen') return;
    const want = n.cls === 'archer' ? 'archer' : 'melee'; if (n.role === want) return;
    const ratio = n.maxHp > 0 ? n.hp / n.maxHp : 1; n.role = want; n.archer = want === 'archer';
    n.baseColor = ROLE[want].color; n.maxHp = npcMaxHp(want, n.trait); n.hp = Math.max(1, Math.round(n.maxHp * ratio)); n.mat.color.set(n.baseColor); n.labelText = ''; n.hold = null; n.target = null;
  }
  function dropMountIfNeeded(n) { if (n.mounted && !canMount(n)) { n.mounted = false; applyMount(n); } }
  function clsName(c) { return { sword: 'Swordsman', spear: 'Spearman', greatsword: 'Great Swordsman', medic: 'Medic', archer: 'Archer' }[c] || 'Swordsman'; }
  function homeCls(n) { return n.clsHome || (n.role === 'archer' ? 'archer' : n.cls) || 'sword'; }
  function tripCls(n) { return n.clsTrip || homeCls(n); }
  function setClassFor(n, c) { n.clsSet = true; n.clsHome = n.clsHome || homeCls(n); n.clsTrip = n.clsTrip || tripCls(n); if (n.escort) n.clsTrip = c; else { n.clsHome = c; n.cls = c; } if (n.escort) n.cls = c; applyGear(n); }
  const CLS_LIST = ['sword', 'spear', 'greatsword', 'medic', 'archer'];
  function setHomeCls(n, c) { n.clsSet = true; n.clsTrip = n.clsTrip || tripCls(n); n.clsHome = c; if (!n.escort) { n.cls = c; applyGear(n); } }
  function setTripCls(n, c) { n.clsSet = true; n.clsHome = n.clsHome || homeCls(n); n.clsTrip = c; if (n.escort) { n.cls = c; applyGear(n); } }
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
  function setHostOrder(o) { for (let i = 0; i < CFG.WARBAND.MAX; i++) if (warbandMembers(i).length) setWarbandOrder(i, o); }     // 모든 전투단에 같은 명령
  const inBanner = (n) => !!n && n.warband >= 0 && bannerOf(n.warband) >= 0;                // 깃발 소속 병사 (군대 집결 나팔이 어디서든 들린다)
  function drilledTogether(n) { const b = n.warband >= 0 ? bannerOf(n.warband) : -1; return b >= 0 && npcs.filter(m => m.escort && m.role !== 'citizen' && bannerOf(m.warband) === b && m.warband !== n.warband).length > 0; }
  function bannerMods(n) {                                       // 같은 깃발의 다른 전투단 병사가 가까이 있으면 보너스
    const B = CFG.BANNER, b = n && n.warband >= 0 ? bannerOf(n.warband) : -1; if (b < 0 || n.down) return { dmg: 1, guard: 1 };
    const bands = new Set([n.warband]);
    for (const m of npcs) if (m !== n && !m.down && m.warband >= 0 && m.warband !== n.warband && bannerOf(m.warband) === b && !!m.escort === !!n.escort && Math.hypot(m.position.x - n.position.x, m.position.z - n.position.z) <= B.RADIUS + 3 * pl.st.bannerlord) bands.add(m.warband);
    return bands.size >= B.MIN_BANDS ? { dmg: 1 + B.DMG + 0.03 * pl.st.bannerlord, guard: 1 - B.GUARD - 0.03 * pl.st.bannerlord } : { dmg: 1, guard: 1 };
  }
  // ---------- 기병 (Cavalry): 마구간이 있으면 검병·창병이 말을 탈 수 있다 (마구간 1채당 CFG.CAV.PER_STABLE 기). 빠르고, 달려가서 치는 첫 일격이 세다 ----------
  const mountCap = () => CFG.CAV.PER_STABLE * builtBuildings('stable').length;
  const mountedCount = () => npcs.filter(n => n.mounted && !n.levy).length;
  const canMount = (n) => n.role === 'archer' || (n.role === 'melee' && ((n.cls || 'sword') === 'sword' || n.cls === 'spear'));
  function mountMul(n) { return n && n.mounted ? CFG.CAV.DMG + (n.chargeBonus ? CFG.CAV.CHARGE * (1 + 0.25 * pl.st.horsemaster) : 0) : 1; }
  function applyMount(n) {                                                   // 말 메쉬를 붙이거나 뗀다 (기수를 말 등 높이로 올린다)
    const want = !!n.mounted && canMount(n);
    if (want && !n.horse) {
      const hash = [...(n.name || 'x')].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7) >>> 0, coats = [0x7a4a2a, 0x3a2a22, 0xc8c0a8, 0x9a6a3a, 0x5a5a5e, 0xb08a5a], bc = parseInt((n.warband >= 0 ? warbandColor(n.warband) : '#8a2a2a').slice(1), 16);
      const horse = new THREE.Group(), body = horseModel(() => 0.3, { coat: coats[hash % coats.length], blanket: bc, armor: n.cls === 'spear' }), rider = new THREE.Group(); body.rotation.y = -Math.PI / 2; horse.add(body);
      const cur = n.rig.root; n.remove(cur); rider.add(cur); rider.position.y = 0.8; n.add(rider, horse); n.rig.seated = true; n.rig.rider = rider; n.horse = horse; n.rider = rider; horse.userData.legs = body.userData.legs; horse.userData.hr = body.userData.hr;
    } else if (!want && n.horse) {
      const cur = n.rig.root; n.rider.remove(cur); n.add(cur); n.remove(n.rider, n.horse); n.rig.seated = false; n.rig.rider = null; n.horse = n.rider = null; n.mounted = false;
    }
    n.charge = 0;
  }
  function toggleMount(n) {
    if (!canMount(n)) { toast('Only swordsmen, spearmen and archers can ride'); return false; }
    if (!n.mounted && mountedCount() >= mountCap()) { toast(builtBuildings('stable').length ? 'Every stall is taken (3 horses per stable)' : 'Build Stables first'); return false; }
    n.mounted = !n.mounted; applyMount(n); return true;
  }
  function trimMounts() { let extra = mountedCount() - mountCap(); for (const n of npcs) { if (n.mounted && !canMount(n)) { n.mounted = false; applyMount(n); } else if (extra > 0 && n.mounted) { n.mounted = false; applyMount(n); extra--; } } }
  // ---------- 지휘관의 말: 마구간이 하나라도 있으면 5단계에서 주인공도 말을 탈 수 있다 (M 키 / Mount 버튼). 빨라지고 달려가며 치는 첫 일격이 세다. 채집하면 자동으로 내린다 ----------
  let playerMounted = false, pHorse = null, pRider = null, pCharge = 0, pBonusT = 0;
  const leaderCanRide = () => stage >= CFG.BANNER.STAGE && builtBuildings('stable').length > 0;
  function leaderMountMul() { return playerMounted ? 1.05 + (pBonusT > 0 ? CFG.CAV.CHARGE * (1 + 0.25 * pl.st.horsemaster) : 0) : 1; }
  function leaderRideApply() {
    if (playerMounted && !pHorse) {
      const horse = new THREE.Group(), body = horseModel(() => 0.7, { coat: 0xe8e4d8, blanket: 0xe0b040, armor: true }), rider = new THREE.Group(); body.rotation.y = -Math.PI / 2; horse.add(body);
      const cur = playerRig.root; player.remove(cur); rider.add(cur); rider.position.y = 0.8; player.add(rider, horse); playerRig.seated = true; playerRig.rider = rider; pHorse = horse; pRider = rider; horse.userData.legs = body.userData.legs; horse.userData.hr = body.userData.hr;
    } else if (!playerMounted && pHorse) {
      const cur = playerRig.root; pRider.remove(cur); player.add(cur); player.remove(pRider, pHorse); playerRig.seated = false; playerRig.rider = null; pHorse = pRider = null;
    }
    pCharge = 0; pBonusT = 0;
  }
  function leaderChargeStrike() { if (!playerMounted) return; if (pCharge > CFG.CAV.CHARGE_T) { pBonusT = 0.9; floatText('Charge!', player.position.x, 3.2, player.position.z); } pCharge = 0; }
  function leaderDismount() { if (playerMounted) { playerMounted = false; leaderRideApply(); updateMountBtn(); } }
  function toggleLeaderMount() {
    if (dead) return;
    if (!playerMounted && !leaderCanRide()) return toast(stage < CFG.BANNER.STAGE ? 'Horses come with Stage 5' : 'Build Stables to ride');
    playerMounted = !playerMounted; gathering = null; leaderRideApply(); updateMountBtn(); toast(playerMounted ? 'Mounted' : 'Dismounted');
  }
  function updateMountBtn() {
    const b = document.getElementById('mountBtn'); if (!b) return;
    const show = leaderCanRide() || playerMounted; if (b.style.display !== (show ? '' : 'none')) b.style.display = show ? '' : 'none';
    const l = playerMounted ? 'Dismount' : 'Mount'; if (document.getElementById('mountLbl').textContent !== l) document.getElementById('mountLbl').textContent = l;
  }
  function leaderRideTick(t, dt) {
    if (dead && playerMounted) leaderDismount();
    if (!playerMounted || !pHorse) return;
    const mv = Math.hypot(player.position.x - (pLX ?? player.position.x), player.position.z - (pLZ ?? player.position.z)); pLX = player.position.x; pLZ = player.position.z;
    const v = dt > 0 ? mv / dt : 0; pCharge = v > 4 ? Math.min(1.6, pCharge + dt) : Math.max(0, pCharge - dt * 2);
    pBonusT = Math.max(0, pBonusT - dt);
    const bob = horseStep(pHorse, dt, v); if (!playerRig.fallen) pRider.position.y = 0.8 + bob;
  }
  let pLX, pLZ;
  // ---------- 깃발 든 병사: 깃발마다 첫 전투단의 병사 한 명이 그 깃발의 큰 깃발을 등에 진다 (보기용) ----------
  function bannerFlagTick(t) {
    const bearers = new Map();
    if (bannersOpen()) for (let b = 0; b < CFG.BANNER.MAX; b++) { const bands = bannerBands(b); for (const i of bands) { const m = warbandMembers(i).find(x => !x.down && !x.hidden); if (m) { bearers.set(m, b); break; } } }
    for (const n of npcs) {
      const b = bearers.has(n) ? bearers.get(n) : -1;
      if (n.bflag && n.bflag.userData.b !== b) { n.remove(n.bflag); n.bflag = null; }
      if (b >= 0 && !n.bflag) {
        const g = new THREE.Group(), col = parseInt(CFG.BANNER.COLORS[b].slice(1), 16), pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.0, 5), new THREE.MeshLambertMaterial({ color: 0x5a3a1a })), cloth = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.04), new THREE.MeshLambertMaterial({ color: col })), tip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 5), new THREE.MeshLambertMaterial({ color: 0xe0b040 }));
        pole.position.y = 1.9; cloth.position.set(0.48, 3.0, 0); tip.position.y = 3.5; g.add(pole, cloth, tip); g.position.set(-0.25, n.horse ? 0.9 : 0, -0.35); g.userData = { b, cloth }; n.add(g); n.bflag = g;
      }
      if (n.bflag) n.bflag.userData.cloth.rotation.y = Math.sin(t * 4 + b) * 0.3;
    }
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
  function standardMods(n) { const a = leaderMods(n), c = bannerMods(n), o = marshalMods(n); return { dmg: a.dmg * c.dmg * o.dmg, guard: a.guard * c.guard * o.guard }; }
  function marshalMods(n) {                                                  // 지휘관 기술: 돌격 명령을 받은 병사는 더 세게, 버티기 명령을 받은 병사는 덜 맞는다
    if (!n || n.role === 'citizen' || !(n.warband >= 0)) return { dmg: 1, guard: 1 };
    const o = warbandOrder(n.warband); return { dmg: o === 'charge' ? 1 + 0.08 * pl.st.warcommand : 1, guard: o === 'stand' ? 1 - 0.06 * pl.st.warcommand : 1 };
  }
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
  let wbOpen = -1, wbBarHtml = '', wbSel = -1, wbAll = false, wbMoveFor = -1;
  function renderWbBar() {
    const show = !dead && !uiPause;                                  // 원정 중에도 보인다 (함께 간 전투단만)
    let html = '';
    if (show) for (let i = 0; i < CFG.WARBAND.MAX; i++) {
      const m = warbandMembers(i).filter(n => !exActive || n.escort); if (!m.length) continue;
      const hurt = m.filter(n => n.down).length, sel = !exActive && bringing(i);
      html += `<button class="wbchip${sel ? ' sel' : ''}${wbSel === i ? ' pick' : ''}" data-wb="${i}" style="--c:${wbi(i).color}" title="${wbi(i).name}"><i></i><b>${m.length - hurt}/${m.length}</b>${sel ? '<em>&#9873;</em>' : ''}${bannerOf(i) >= 0 ? `<s style="color:${CFG.BANNER.COLORS[bannerOf(i)]}">${CFG.BANNER.NAMES[bannerOf(i)][0]}</s>` : ''}${warbandOrder(i) !== 'forward' ? `<u>${WB_ORDER_LABEL[warbandOrder(i)][0]}</u>` : ''}</button>`;
    }
    if (html) html += `<button class="wbmark${markedFoe ? ' on' : ''}" data-mark="1" title="Mark the foe (Y)">&#9678; Mark</button>`;
    if (html) {                                                          // 명령 띠: 고른 전투단(없거나 All 이면 전체)에게 바로 내린다. 창을 열 필요가 없다
      const tgt = wbOrderTargets(), cur = tgt.length && tgt.every(b => warbandOrder(b) === warbandOrder(tgt[0])) ? warbandOrder(tgt[0]) : '';
      html += `<div class="wbq"><button class="wball${wbAll || wbSel < 0 ? ' on' : ''}" data-all="1" title="Orders go to the whole host">All</button>${WB_ORDERS.map(o => `<button class="wbqo${o === cur ? ' on' : ''}" data-ordq="${o}" title="${WB_ORDER_HINT[o]}">${WB_ORDER_SHORT[o]}</button>`).join('')}</div>`;
    }
    if (html === wbBarHtml) return; wbBarHtml = html; wbBar.innerHTML = html; wbBar.style.display = html ? 'flex' : 'none';
  }
  const WB_ORDER_SHORT = { forward: '&#10148; Go', stand: '&#9632; Hold', withdraw: '&#8630; Back', charge: '&#9876; Charge' };
  function wbOrderTargets() { const all = []; for (let i = 0; i < CFG.WARBAND.MAX; i++) if (warbandMembers(i).filter(n => !exActive || n.escort).length) all.push(i); return wbAll || wbSel < 0 || !all.includes(wbSel) ? all : [wbSel]; }
  function issueOrder(o) {
    const tgt = wbOrderTargets(); if (!tgt.length) return;
    const done = new Set(); for (const b of tgt) { if (done.has(b)) continue; const bn = bannerOf(b); if (bn >= 0) { setBannerOrder(bn, o); bannerBands(bn).forEach(x => done.add(x)); } else { setWarbandOrder(b, o); done.add(b); } }
    toast(`${tgt.length === 1 ? wbi(tgt[0]).name : 'The whole host'}: ${WB_ORDER_LABEL[o]}`); Snd.play('click'); wbBarHtml = ''; renderWbBar();
  }
  wbBar.addEventListener('pointerdown', e => {
    if (e.target.closest('.wbmark')) { e.preventDefault(); e.stopPropagation(); toggleMark(); return; }
    const q = e.target.closest('[data-ordq]'); if (q) { e.preventDefault(); e.stopPropagation(); issueOrder(q.dataset.ordq); return; }
    if (e.target.closest('[data-all]')) { e.preventDefault(); e.stopPropagation(); wbAll = !wbAll; if (wbAll) wbSel = -1; wbBarHtml = ''; renderWbBar(); return; }
    const b = e.target.closest('.wbchip'); if (!b) return; e.preventDefault(); e.stopPropagation();
    const i = +b.dataset.wb; if (wbSel === i) { openWbPanel(i); return; }                                  // 한 번 누르면 고르고, 고른 것을 다시 누르면 창이 열린다
    wbSel = i; wbAll = false; Snd.play('click'); wbBarHtml = ''; renderWbBar();
  });
  function renderWbPanel() {
    const i = wbOpen; if (i < 0) return;
    const m = warbandMembers(i), info = wbi(i);
    if (!m.length) { closeWbPanel(); return; }
    if (wbMoveFor >= 0) {                                                  // 옮길 전투단 고르기: 한 번 눌러 바로 옮긴다 (꽉 찬 곳은 서로 자리를 바꾼다)
      const mv = npcs[wbMoveFor];
      if (mv && mv.role !== 'citizen') {
        const list = []; for (let b = 0; b < CFG.WARBAND.MAX; b++) { const mem = warbandMembers(b).length, full = mem >= CFG.WARBAND.SIZE, here = mv.warband === b;
          list.push(`<button class="wbdest${here ? ' here' : ''}" data-dest="${b}" style="--c:${wbi(b).color}"><i></i><b>${wbi(b).name}</b><span>${mem}/${CFG.WARBAND.SIZE}${here ? ' · here' : full ? ' · swap' : ''}</span></button>`); }
        wbPanel.querySelector('.wcard').innerHTML = `<div class="whead"><b>Move ${mv.name} to…</b></div><div class="wdests">${list.join('')}</div><button id="wbMoveCancel">Cancel</button>`;
        return;
      }
      wbMoveFor = -1;
    }
    const sw = WB_COLORS.map(c => `<button class="wbsw${c === info.color ? ' on' : ''}" data-color="${c}" style="background:${c}"></button>`).join('');
    const rows = m.map((n, k) => { const ix = npcs.indexOf(n);
      return `<li data-n="${ix}"><div class="wr1"><b>${clsTitle(n)}</b> ${n.name} <span>${n.down ? 'Down' : `HP ${n.hp}/${n.maxHp}`}${vetLv(n) ? ' · vet ' + vetLv(n) : ''}</span></div>
      <div class="wr2">${n.role !== 'citizen' ? `<button class="wbact" data-act="home" data-ix="${ix}">At home: ${clsName(homeCls(n))}</button><button class="wbact" data-act="trip" data-ix="${ix}">Journey: ${clsName(tripCls(n))}</button>` : ''}${canMount(n) && bannersOpen() ? `<button class="wbact" data-act="mount" data-ix="${ix}">${n.mounted ? 'Dismount' : 'Mount'}</button>` : ''}${n.escort ? '' : `<button class="wbact" data-act="band" data-ix="${ix}">Move to…</button>`}</div></li>`; }).join('');
    const mel = m.filter(n => n.role !== 'citizen'), uni = (f) => mel.length && mel.every(n => f(n) === f(mel[0])) ? clsName(f(mel[0])) : 'Mixed';
    const bulk = mel.length > 1 ? `<div class="wbulk"><button class="wbact" data-bulk="home">All at home: ${uni(homeCls)} &#8594;</button><button class="wbact" data-bulk="trip">All journey: ${uni(tripCls)} &#8594;</button></div>` : '';
    wbPanel.querySelector('.wcard').innerHTML = `<div class="whead"><i style="background:${info.color}"></i><b>${info.name}</b><button id="wbRename">Rename</button></div>
      <div class="wsw">${sw}</div>${bulk}<ul class="wlist">${rows}</ul>
      ${exActive ? '' : `<button id="wbBring" class="${bringing(i) ? 'on' : ''}">${bringing(i) ? 'Coming on your next journey &#10003;' : 'Bring on your next journey'}</button>`}
      ${bannersOpen() ? `<div class="wbn"><button id="wbBanner">${bannerOf(i) >= 0 ? bannerName(bannerOf(i)) + ' (' + bannerBands(bannerOf(i)).length + ' bands)' : 'No banner'}</button>${bannerOf(i) >= 0 && !exActive ? `<button id="wbBannerBring" class="${bannerBands(bannerOf(i)).every(bringing) ? 'on' : ''}">Bring whole banner</button>` : ''}</div>` : ''}
      ${bannersOpen() ? `<div class="word host"><small>Whole host:</small>${WB_ORDERS.map(o => `<button class="wbord" data-hord="${o}">${WB_ORDER_LABEL[o]}</button>`).join('')}</div>` : ''}
      <div class="word">${WB_ORDERS.map(o => `<button class="wbord${o === warbandOrder(i) ? ' on' : ''}" data-ord="${o}">${WB_ORDER_LABEL[o]}</button>`).join('')}</div><small>${WB_ORDER_HINT[warbandOrder(i)]}${bannerOf(i) >= 0 ? ' Orders go to the whole banner.' : ''}</small>
      <small>${m.length}/${CFG.WARBAND.SIZE} soldiers</small><button id="wbClose">Close</button>`;
  }
  function openWbPanel(i) { wbOpen = i; renderWbPanel(); wbPanel.style.display = 'flex'; Snd.play('click'); }
  function closeWbPanel() { wbOpen = -1; wbMoveFor = -1; wbPanel.style.display = 'none'; }
  wbPanel.addEventListener('pointerdown', e => {
    if (e.target === wbPanel) { closeWbPanel(); return; }
    const t = e.target, i = wbOpen; if (i < 0) return;
    if (t.dataset && t.dataset.hord) { setHostOrder(t.dataset.hord); toast(`The whole host: ${WB_ORDER_LABEL[t.dataset.hord]}`); renderWbPanel(); wbBarHtml = ''; renderWbBar(); e.stopPropagation(); return; }
    if (t.dataset && t.dataset.ord) { if (bannerOf(i) >= 0) setBannerOrder(bannerOf(i), t.dataset.ord); else setWarbandOrder(i, t.dataset.ord); toast(`${wbi(i).name}: ${WB_ORDER_LABEL[t.dataset.ord]}`); renderWbPanel(); wbBarHtml = ''; renderWbBar(); e.stopPropagation(); return; }
    if (t.id === 'wbMoveCancel') { wbMoveFor = -1; renderWbPanel(); e.stopPropagation(); return; }
    { const d = t.closest('[data-dest]'); if (d && wbMoveFor >= 0) { const n = npcs[wbMoveFor], to = +d.dataset.dest; wbMoveFor = -1; if (n && !n.escort && to !== n.warband) { const mem = warbandMembers(to).filter(x => !x.escort);
          if (warbandMembers(to).length < CFG.WARBAND.SIZE) { n.warband = to; toast(`${n.name} joins ${warbandName(to)}`); } else if (mem.length) { const o = mem[mem.length - 1]; o.warband = n.warband; n.warband = to; toast(`${n.name} and ${o.name} swap places`); } else toast('That band is full'); }
        if (n) { n.labelText = ''; } wbBarHtml = ''; renderWbBar(); const left = warbandMembers(i).length; if (!left) closeWbPanel(); else renderWbPanel(); e.stopPropagation(); return; } }
    { const bk = t.dataset && t.dataset.bulk; if (bk) { const mel = warbandMembers(i).filter(n => n.role !== 'citizen'); if (mel.length) { const f = bk === 'home' ? homeCls : tripCls, nx = CLS_LIST[(CLS_LIST.indexOf(f(mel[0])) + 1) % CLS_LIST.length]; for (const n of mel) { if (bk === 'home') setHomeCls(n, nx); else setTripCls(n, nx); } toast(`${wbi(i).name}: all ${bk === 'home' ? 'at home' : 'on journeys'} are ${clsName(nx)}s`); } renderWbPanel(); e.stopPropagation(); return; } }
    if (t.dataset && t.dataset.act) { const n = npcs[+t.dataset.ix];
      if (n) { if (t.dataset.act === 'home' && n.role !== 'citizen') cycleHomeCls(n); else if (t.dataset.act === 'trip' && n.role !== 'citizen') cycleTripCls(n); else if (t.dataset.act === 'mount') { toggleMount(n); renderWbPanel(); } else if (t.dataset.act === 'band' && !n.escort) { wbMoveFor = npcs.indexOf(n); } renderWbPanel(); }
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
