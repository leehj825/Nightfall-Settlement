  // ---------- 대장간: 장비 제작 창 ----------
  const hallBtnEl = document.getElementById('hallBtn');
  const smithEl = document.getElementById('smithPanel'), smithList = document.getElementById('smithList'), smithBtnEl = document.getElementById('smithBtn');
  let smithOpenFor = null;
  const SMITH_RANGE = 8;
  const smiths = () => builtBuildings('smith');
  const nearestSmith = () => smiths().find(m => Math.hypot(m.position.x - player.position.x, m.position.z - player.position.z) < SMITH_RANGE + m.userData.radius) || null;
  function openSmith() {
    if (dead) return;
    const sm = nearestSmith();
    if (!sm) return toast(smiths().length ? 'Move closer to the Blacksmith' : 'No Blacksmith yet - plan Age 2 buildings first');
    smithOpenFor = sm; renderSmith(); smithEl.style.display = 'flex';
  }
  function closeSmith() { smithEl.style.display = 'none'; smithOpenFor = null; }
  function renderSmith() {
    const sm = smithOpenFor;
    if (!sm || !obstacles.includes(sm)) return closeSmith();
    document.getElementById('smithRes').textContent = `You have: ${res.wood} Wood · ${res.stone} Stone · ${res.iron} Iron${res.shard || story.beacon ? ` · ${res.shard} Shards` : ''}  (Iron drops from rocks)`;
    smithList.innerHTML = '';
    for (const [id, d] of Object.entries(CFG.GEAR)) {
      if (!d.cost) continue;
      const stock = sm.userData.stock[id] || 0, equipped = playerGear[d.slot] === id, locked = (d.age || 1) > age || (d.req && !story[d.req]);
      const row = document.createElement('div'); row.className = 'srow';
      row.innerHTML = `<div class="sinfo"><b>${d.name}</b> <small>${d.desc}</small><small>${locked ? ((d.age || 1) > age ? `Requires Age ${d.age} (${CFG.AGES[d.age - 1].name})` : 'Locked: open the Dawn Gate first') : `Cost: ${costText(gearCost(d))}`} · On rack: ${stock}${equipped ? ' · You are using this' : ''}</small></div><div class="sbtns"><button data-act="craft">Craft</button><button data-act="equip">Equip</button></div>`;
      const [bc, be] = row.querySelectorAll('button');
      bc.disabled = locked || !canPay(gearCost(d)); be.disabled = stock <= 0 || equipped;
      bc.addEventListener('click', () => craftGear(id)); be.addEventListener('click', () => equipPlayer(id));
      smithList.appendChild(row);
    }
  }
  function forgeEffect(sm) {                  // 모루 위 불꽃 + 화덕이 확 밝아진다 + 쾅 소리
    burst({ x: sm.position.x + 1.2, z: sm.position.z + 2.5, y: 1 }, 20); forgeFlash = 1;
    sfxAt('anvil', sm.position.x, sm.position.z);
  }
  function craftGear(id) {
    const sm = smithOpenFor, d = gearDef(id);
    if (!sm || !canPay(gearCost(d))) return;
    payCost(gearCost(d)); sm.userData.stock[id]++; refreshRack(sm); updateHud(); report.forged++;
    forgeEffect(sm);
    toast(`Forged: ${d.name}! Soldiers will come to pick it up`);
    renderSmith();
  }
  function equipPlayer(id) {
    const sm = smithOpenFor, d = gearDef(id);
    if (!sm || !(sm.userData.stock[id] > 0)) return;
    sm.userData.stock[id]--; playerGear[d.slot] = id; refreshRack(sm); applyPlayerGear(); updateHud();
    toast(`Equipped ${d.name}`); Snd.play('chime'); renderSmith();
  }
  document.getElementById('smithClose').addEventListener('click', closeSmith);
  // ---------- 플레이어 역할 / 지휘 명령 / 시대 퍼크 ----------
  function setClass(c) {
    playerClass = c; hp = pMaxHp(); hpEl.textContent = Math.ceil(hp);
    document.getElementById('ultBtn').firstChild.textContent = c === 'commander' ? 'Rally Cry' : 'Ultimate';
    document.getElementById('ordBtn').style.display = c === 'commander' ? '' : 'none';
    if (c !== 'commander') order = 'guard';
    updateHud();
  }
  function toggleBird() {
    if (!bird) { savedView = { d: DIST, p: pitch }; bird = true; DIST = 58; pitch = 1.3; }
    else { bird = false; if (savedView) { DIST = savedView.d; pitch = savedView.p; } }
    document.getElementById('birdBtn').classList.toggle('on', bird);
    toast(bird ? "Bird's-eye view - press again to return" : 'Back to the hero view');
  }
  function toggleOrder() {
    if (dead || playerClass !== 'commander') return;
    order = order === 'guard' ? 'follow' : 'guard';
    document.getElementById('ordSub').textContent = `R · ${order === 'follow' ? 'Follow' : 'Guard'}`;
    toast(order === 'follow' ? 'Order: Follow me - soldiers gather at your side' : 'Order: Guard - soldiers return to their duties');
    Snd.play('horn');
  }
  function choosePerk(a, id) {
    perks[a] = id;
    if (id === 'lord') for (const n of npcs) if (n.role !== 'citizen') { const m = npcMaxHp(n.role, n.trait); n.hp += m - n.maxHp; n.maxHp = m; n.labelText = ''; }
    if (id === 'fortifier' || id === 'engineer') for (const o of obstacles) if (o.userData.type === 'fence' && o.userData.level === (id === 'engineer' ? 'stone' : 'wood')) { o.userData.hp *= 1.5; o.userData.maxHp *= 1.5; }
    updateHud(); updateProsperity();
  }
  function openDifficultyChoice() {
    openEvent({ tag: 'New game', title: 'Choose a difficulty', text: 'How hard should the nights be? You can change this later in Settings.',
      opts: Object.entries(CFG.DIFFS).map(([id, d]) => ({ label: d.label + (id === diff ? ' (current)' : ''), sub: d.desc, run: () => { diff = id; try { localStorage.setItem('nf_diff', id); } catch (e) {} setTimeout(openClassChoice, 500); return `Difficulty: ${d.label}`; } })) });
  }
  function openClassChoice() {
    openEvent({ tag: 'Choose your path', title: 'Who will you be?', text: 'Fight on the front line, or lead others from just behind it. This choice lasts the whole game.',
      opts: Object.entries(CFG.CLASSES).map(([id, c]) => ({ label: c.label, sub: c.desc, run: () => { setClass(id); setTimeout(() => openPerk(1), 500); return `You are the ${c.label}`; } })) });
  }
  function openPerk(a) {
    const list = CFG.PERKS[a];
    if (!list || perks[a] || dead) return;
    openEvent({ tag: `Age ${a} perk`, title: `${CFG.AGES[a - 1].name}: choose a perk`, text: 'Pick one permanent bonus for this age.',
      opts: list.map(p => ({ label: p.label, sub: p.desc, run: () => { choosePerk(a, p.id); return `${p.label}: ${p.desc}`; } })) });
  }
  addEventListener('keydown', e => { if (e.code === 'KeyR' && !e.repeat) toggleOrder(); if (e.code === 'KeyB' && !e.shiftKey && !e.repeat) toggleBird(); });
  const bindBtn = (id, fn) => document.getElementById(id).addEventListener('pointerdown', e => { e.preventDefault(); fn(); });
  bindBtn('actBtn', gather);
  bindBtn('buildBtn', upgradeFence);
  bindBtn('designBtn', designDefense);
  bindBtn('townBtn', designTown);
  bindBtn('smithBtn', openSmith);
  bindBtn('ordBtn', toggleOrder);
  bindBtn('birdBtn', toggleBird);
  bindBtn('hallBtn', () => openTech());
  bindBtn('atkBtn', attack);
  bindBtn('dashBtn', dash);
  bindBtn('ultBtn', ultimate);
  bindBtn('swapBtn', swapWeapon);

