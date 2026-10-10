  // ---------- 사운드: WebAudio 합성 (외부 파일 없음) + 낮/밤/습격 배경음 ----------
  const sfxAt = (name, x, z) => { const v = 1 - Math.hypot(x - player.position.x, z - player.position.z) / 45; if (v > 0.03) Snd.play(name, v); };
  for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => Snd.init());
  addEventListener('keydown', e => { if (e.code === 'KeyM' && !e.repeat) Snd.toggle(); });
  document.getElementById('muteBtn').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); Snd.init(); Snd.toggle(); });
  Snd.setMuted(Snd.isMuted());

  // ---------- 자원 / 상호작용 ----------
  let playerClass = null, order = 'guard', rallyT = 0;
  const perks = {};                                                  // 시대 -> 퍼크 id
  // 주인공 성장: 처치·원정·생존으로 경험치를 얻고, 레벨이 오를 때마다 세 가지 중 하나를 고른다 (유물을 찾으면 보너스 선택)
  const pl = { lvl: 1, xp: 0, pend: 0, st: { hp: 0, dmg: 0, spd: 0, dash: 0, ult: 0, leech: 0, guard: 0, rally: 0, spear: 0, fletch: 0, regen: 0, forage: 0 } };
  const PL_MAX = 12, xpNeed = (l) => 40 + 35 * (l - 1);
  let diff = 'normal', ngLevel = 0;
  try { const d0 = localStorage.getItem('nf_diff'); if (d0 && CFG.DIFFS[d0]) diff = d0; } catch (e) {}
  const dm = () => { const d = CFG.DIFFS[diff]; return { hp: d.hp * (1 + 0.4 * ngLevel), n: d.n * (1 + 0.25 * ngLevel), dmg: d.dmg * (1 + 0.2 * ngLevel) }; };
  const scaleHp = (h) => Math.round((h * dm().hp + (dm().hp - 1) * 1.2) * 10) / 10;
  const hasPerk = (id) => Object.values(perks).includes(id);
  const pMaxHp = () => CFG.PLAYER_MAX_HP + (playerClass === 'warrior' ? 30 : playerClass === 'commander' ? -20 : 0) + 20 * pl.st.hp + (story.dusk ? 20 : 0);
  const pDmg = () => (playerClass === 'warrior' ? 1.25 : playerClass === 'commander' ? 0.8 : 1) * (1 + 0.15 * pl.st.dmg) * (story.dusk ? 1.1 : 1);
  const gatherYield = (t) => CFG.GATHER_YIELD[t] + (hasPerk('forager') ? 1 : 0) + (pl.st.forage >= 3 ? 1 : 0) + (pl.st.forage >= 5 ? 1 : 0);
  const fenceHp = () => CFG.FENCE_HP * (hasPerk('fortifier') ? 1.5 : 1), wallHp = () => CFG.WALL_HP * (hasPerk('engineer') ? 1.5 : 1);
  const dashMul = () => (playerClass === 'warrior' ? 0.8 : 1) * (hasPerk('warlord') ? 0.75 : 1) * 0.88 ** pl.st.dash;
  const spdMul = () => (hasPerk('scout') ? 1.1 : 1) * (1 + 0.06 * pl.st.spd);
  const gearCost = (d) => hasPerk('smith') ? Object.fromEntries(Object.entries(d.cost).map(([k, v]) => [k, Math.ceil(v * 0.75)])) : d.cost;
  const npcMaxHp = (role, trait) => Math.round(ROLE[role].hp * (CFG.TRAITS[trait].hp || 1) * (hasPerk('lord') && role !== 'citizen' ? 1.15 : 1));
  const vetLv = (n) => { const x = n.vxp || 0; return x >= 40 ? 3 : x >= 20 ? 2 : x >= 8 ? 1 : 0; };
  const soldierMult = (n) => (1 + 0.06 * vetLv(n)) * (playerClass === 'commander' && Math.hypot(n.position.x - player.position.x, n.position.z - player.position.z) < 15 ? 1.15 : 1) * (rallyT > 0 ? 1.5 : 1) * (hasPerk('lord') ? 1.1 : 1) * (story.dawn ? 1.1 : 1) * (story.wide ? 1.1 : 1) * (story.dusk ? 1.1 : 1) * gateBonus(n);
  const res = { wood: 40, stone: 0, food: 0, iron: 0, shard: 0 };
  let weaponMode = 'sword';
  const playerGear = { sword: 'sword_basic', bow: 'bow_basic', armor: 'armor_none' };
  const gearDef = (id) => CFG.GEAR[id];
  function applyPlayerGear() {
    const vis = weaponMode === 'spear' ? 'sword' : weaponMode;
    playerRig.main = vis;
    playerRig.setGear('sword', gearDef(playerGear.sword)); playerRig.setGear('bow', gearDef(playerGear.bow)); playerRig.setArmor(gearDef(playerGear.armor));
    playerRig.hold(vis);
  }
  const woodEl = document.getElementById('woodN'), stoneEl = document.getElementById('stoneN'), ironEl = document.getElementById('ironN');
  const toastEl = document.getElementById('toast');
  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg; toastEl.style.opacity = 1;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.style.opacity = 0, 1400);
  }
  const atkEl = document.getElementById('atkN');
  const foodEl = document.getElementById('foodN');
  function updateHud() { updateLvlUi(); woodEl.textContent = res.wood; stoneEl.textContent = res.stone; ironEl.textContent = res.iron; if (res.shard > 0) { document.getElementById('shardRow').style.display = ''; document.getElementById('shardN').textContent = res.shard; } foodEl.textContent = Math.floor(res.food); { const sw = gearDef(playerGear.sword), bw = gearDef(playerGear.bow), ar = gearDef(playerGear.armor); atkEl.textContent = `${sw.short} ${sw.dmg} / ${bw.short} ${bw.dmg}`; document.getElementById('armN').textContent = ar.reduce ? `${ar.short} -${Math.round(ar.reduce * 100)}%` : 'None'; } }

  function rollIron(o) {                     // 바위를 캘 때 일정 확률로 철도 나온다 (대장간 재료)
    if (o.userData.type !== 'stone' || Math.random() > CFG.IRON_CHANCE) return;
    res.iron += 1; floatText('Iron +1', o.position.x, 2.2, o.position.z);
  }
  const GATHER_RANGE = 2.6;
  // 플레이어 채집: 버튼을 누르면 CFG.PLAYER_GATHER_TIME초 동안 들썩이며 진행 바가 차고, 이동하면 취소된다 (NPC와 같은 템포)
  let gathering = null;
  function gather() {
    if (dead || gathering) return;
    let best = null, bestD = GATHER_RANGE;
    for (const o of (exActive ? exObjs : obstacles)) {
      if (o.userData.type !== 'wood' && o.userData.type !== 'stone' && o.userData.type !== 'chest') continue;
      const d = Math.hypot(o.position.x - player.position.x, o.position.z - player.position.z) - o.userData.radius;
      if (d < bestD) { bestD = d; best = o; }
    }
    if (!best) return toast('Nothing to gather nearby');
    gathering = { target: best, t: 0 };
  }

  const fenceMat = mat(0x8a5a34), wallMat = mat(0x4a4d52);
  const UPGRADE_RANGE = 3.2;
  function nearestFence(level) {
    let best = null, bd = UPGRADE_RANGE;
    for (const o of obstacles) {
      if (o.userData.type !== 'fence' || (level && o.userData.level !== level)) continue;
      const d = Math.hypot(o.position.x - player.position.x, o.position.z - player.position.z);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }
  // 청사진: 충돌 판정이 없고(obstacles에 넣지 않음) 적도 무시하는 반투명 목책. 동료 NPC가 실물로 건설한다.
  const blueprints = [];
  const gateWaypoints = [];              // 출입구(Gap) 좌표 {x, z, r(소속 성벽 반지름)} - NPC 길찾기용 경유지
  const matMat = new THREE.MeshStandardMaterial({ color: 0x8a8d92, roughness: 1 });
  const matGeo = new THREE.BoxGeometry(3.2, 0.04, 3.2);
  const bpGeo = new THREE.BoxGeometry(2.4, 1.1, 0.35);
  function createFence(x, z, rot) {
    const fence = new THREE.Mesh(bpGeo, fenceMat);
    fence.position.set(x, 0.55, z);
    fence.rotation.y = rot;
    fence.castShadow = fence.receiveShadow = true;
    fence.userData = { type: 'fence', level: 'wood', radius: 1.2, hp: fenceHp(), maxHp: fenceHp() };
    scene.add(fence);
    obstacles.push(fence);
    return fence;
  }
  const wallGeo = new THREE.BoxGeometry(3.0, 1.4, 0.5);
  function createWall(x, z, rot) {              // 돌 성벽 (짙은 회색, HP 100)
    const w = new THREE.Mesh(wallGeo, wallMat);
    w.position.set(x, 0.7, z);
    w.rotation.y = rot;
    w.castShadow = w.receiveShadow = true;
    w.userData = { type: 'fence', level: 'stone', radius: 1.5, hp: wallHp(), maxHp: wallHp() };
    scene.add(w);
    obstacles.push(w);
    return w;
  }
  const createStructure = (kind, x, z, rot) => kind === 'stone' ? createWall(x, z, rot) : createFence(x, z, rot);
