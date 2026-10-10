(() => {
  const setAppH = () => document.documentElement.style.setProperty('--app-h', innerHeight + 'px');       // 모바일 주소창 때문에 100vh가 실제 화면보다 큰 문제 방지
  setAppH(); addEventListener('resize', setAppH);
  // ---------- 렌더러 / 씬 ----------
  const canvas = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const dusk = new THREE.Color(0x3a2a52);
  scene.background = dusk;
  scene.fog = new THREE.Fog(dusk, 35, 80);

  // ---------- 조명 ----------
  const ambient = new THREE.AmbientLight(0x6f86d6, 0.6);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xff9a4a, 1.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 90 });
  scene.add(sun, sun.target);

  // ---------- 바닥 ----------
  const MAP = 50;   // 맵 반경
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP * 2 + 40, MAP * 2 + 40),
    new THREE.MeshStandardMaterial({ color: 0x9a6b44, flatShading: true, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);


  // ---------- 절차적 맵: 나무 / 바위 ----------
  const obstacles = [];   // 충돌 + 채집 대상 배열
  const mat = (c) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 1 });
  const trunkMat = mat(0x6b4226), leafMat = mat(0x3f8a3c), rockMat = mat(0x8b8b92);
  const rand = (a, b) => a + Math.random() * (b - a);

  function makeTree() {
    const g = new THREE.Group();
    const h = rand(1.2, 1.8);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.32, h, 6), trunkMat);
    trunk.position.y = h / 2;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(rand(1.0, 1.3), rand(2.2, 3), 6), leafMat);
    cone.position.y = h + 0.9;
    g.add(trunk, cone);
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    g.userData = { type: 'wood', radius: 0.9 };
    return g;
  }
  function makeRock() {
    const s = rand(0.6, 1.2);
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rockMat);
    m.scale.y = rand(0.7, 1);
    m.position.y = s * 0.55;
    m.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
    m.castShadow = m.receiveShadow = true;
    const g = new THREE.Group();
    g.add(m);
    g.userData = { type: 'stone', radius: s * 0.95 };
    return g;
  }
  // 자원 생성 위치: 마을 안쪽(중앙 십자 통로 제외) / 1~2단계 성벽 사이 고리 / 맵 전체. 통로(출입구로 이어지는 길)는 항상 비워 둔다
  function samplePoint() {
    const Z = CFG.SPAWN_ZONES;
    for (let k = 0; k < 12; k++) {
      const r = Math.random();
      let x, z;
      if (r < Z.inner) { x = rand(-11, 11); z = rand(-11, 11); }
      else if (r < Z.inner + Z.annulus) {
        const c = rand(18.5, 22.5), t = rand(-22.5, 22.5), sg = Math.random() < 0.5 ? -1 : 1;
        if (Math.random() < 0.5) { x = sg * c; z = t; } else { x = t; z = sg * c; }
      } else { x = rand(-MAP + 3, MAP - 3); z = rand(-MAP + 3, MAP - 3); }
      const inBase = Math.max(Math.abs(x), Math.abs(z)) < 26;
      if (inBase && (Math.abs(x) < 2.8 || Math.abs(z) < 2.8)) continue;       // 출입구로 이어지는 길
      return [x, z];
    }
    return [rand(-MAP + 3, MAP - 3), rand(-MAP + 3, MAP - 3)];
  }
  function scatter(factory, count, ok = () => true) {
    for (let i = 0; i < count; i++) {
      const o = factory();
      for (let tries = 0; tries < 60; tries++) {
        const [x, z] = samplePoint();
        if (Math.hypot(x, z) < 6 || !ok(x, z)) continue;   // 모닥불 주변 비우기
        if (obstacles.some(p => Math.hypot(p.position.x - x, p.position.z - z) < p.userData.radius + o.userData.radius + 0.8)) continue;
        o.position.set(x, 0, z);
        o.rotation.y = rand(0, Math.PI * 2);
        scene.add(o);
        obstacles.push(o);
        break;
      }
    }
  }
  scatter(makeTree, CFG.TREE_COUNT);
  scatter(makeRock, CFG.STONE_COUNT);

  const R = 0.45, H = 0.7;
  // ---------- 플레이어 ----------
  const player = new THREE.Group();
  const playerRig = makeRig('player', 0xe8553c, { seed: 11 });
  const bodyMat = playerRig.bodyMat;
  const playerAnim = new Anim(playerRig);
  player.add(playerRig.root);
  scene.add(player);
  const PLAYER_R = 0.5;

  // ---------- 카메라 (Orbit + Lerp) ----------
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
  let yaw = 0, pitch = 0.45;
  let DIST = 8; const LOOK_H = 1.6, DIST_MIN = 4, DIST_MAX = 22;
  let exActive = null, exEnding = false; const exObjs = [], EXC = { x: 600, z: 0 };              // 원정 중이면 exActive, 원정 지역은 마을(반경 50)에서 멀리 떨어진 곳
  let bird = false, savedView = null;                                // 버드아이 뷰: 마을 전체를 한눈에
  const camFocus = () => bird ? (exActive ? EXC : { x: 0, z: 0 }) : player.position;
  const setDist = d => { DIST = bird ? Math.min(95, Math.max(24, d)) : Math.min(DIST_MAX, Math.max(DIST_MIN, d)); };
  const camGoal = new THREE.Vector3(), lookAt = new THREE.Vector3();
  function goalPos(out) {
    return out.set(
      camFocus().x + Math.sin(yaw) * Math.cos(pitch) * DIST,
      LOOK_H + Math.sin(pitch) * DIST,
      camFocus().z + Math.cos(yaw) * Math.cos(pitch) * DIST);
  }
  camera.position.copy(goalPos(camGoal));
  lookAt.set(0, LOOK_H, 0);

  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();

  // ---------- 카메라 회전 입력 ----------
  // Desktop: left-drag on the canvas (buttons are separate elements) / Mobile: drag on the right side, two-finger pinch to zoom
  let tapStart = null;
  const look = { id: null, x: 0, y: 0 };
  const ptrs = new Map();            // active canvas pointers (for pinch)
  let pinchD = 0;
  const pinchDist = () => { const [p, q] = [...ptrs.values()]; return Math.hypot(p.x - q.x, p.y - q.y); };
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerdown', e => {
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (e.pointerType === 'touch' && ptrs.size === 2) { look.id = null; pinchD = pinchDist(); tapStart = null; return; }
    const ok = e.pointerType === 'mouse' ? e.button === 0 : e.clientX > innerWidth * 0.4;
    if (!ok || look.id !== null) return;
    look.id = e.pointerId; look.x = e.clientX; look.y = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    const p = ptrs.get(e.pointerId); if (p) { p.x = e.clientX; p.y = e.clientY; }
    if (ptrs.size === 2 && e.pointerType === 'touch') {
      const d = pinchDist();
      if (pinchD > 0 && d > 0) setDist(DIST * pinchD / d);
      pinchD = d; return;
    }
    if (e.pointerId !== look.id) return;
    yaw -= (e.clientX - look.x) * 0.006;
    pitch = Math.min(1.2, Math.max(0.1, pitch + (e.clientY - look.y) * 0.005));
    look.x = e.clientX; look.y = e.clientY;
  });
  const lookEnd = e => { ptrs.delete(e.pointerId); pinchD = 0; if (e.pointerId === look.id) look.id = null; };
  canvas.addEventListener('pointerup', lookEnd);
  canvas.addEventListener('pointercancel', lookEnd);
  canvas.addEventListener('wheel', e => { e.preventDefault(); setDist(DIST * Math.exp(e.deltaY * 0.001)); }, { passive: false });

  // ---------- 가상 조이스틱 (Canvas) ----------
  const joyCanvas = document.getElementById('joy');
  const jctx = joyCanvas.getContext('2d');
  const joy = { x: 0, y: 0, id: null };   // x: 오른쪽 +, y: 위쪽 +
  const JC = 75, JMAX = 50;
  function drawJoy() {
    jctx.clearRect(0, 0, 150, 150);
    jctx.beginPath(); jctx.arc(JC, JC, JMAX + 10, 0, 7);
    jctx.fillStyle = 'rgba(255,255,255,.12)'; jctx.fill();
    jctx.lineWidth = 3; jctx.strokeStyle = 'rgba(255,255,255,.4)'; jctx.stroke();
    jctx.beginPath(); jctx.arc(JC + joy.x * JMAX, JC - joy.y * JMAX, 28, 0, 7);
    jctx.fillStyle = 'rgba(255,190,110,.8)'; jctx.fill();
    jctx.strokeStyle = 'rgba(255,255,255,.8)'; jctx.stroke();
  }
  function joyUpdate(e) {
    const r = joyCanvas.getBoundingClientRect();
    let dx = e.clientX - r.left - JC, dy = e.clientY - r.top - JC;
    const l = Math.hypot(dx, dy);
    if (l > JMAX) { dx = dx / l * JMAX; dy = dy / l * JMAX; }
    joy.x = dx / JMAX; joy.y = -dy / JMAX;
    drawJoy();
  }
  const joyEnd = e => { if (e.pointerId !== joy.id) return; joy.id = null; joy.x = joy.y = 0; drawJoy(); };
  joyCanvas.addEventListener('pointerdown', e => {
    if (joy.id !== null) return;
    joy.id = e.pointerId; joyCanvas.setPointerCapture(e.pointerId); joyUpdate(e);
  });
  joyCanvas.addEventListener('pointermove', e => { if (e.pointerId === joy.id) joyUpdate(e); });
  joyCanvas.addEventListener('pointerup', joyEnd);
  joyCanvas.addEventListener('pointercancel', joyEnd);
  drawJoy();

  // ---------- 키보드 ----------
  const keys = {};
  addEventListener('keydown', e => {
    if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) dash(); }
    if (e.code === 'KeyG' && !e.repeat) gather();
    if (e.code === 'KeyE' && !e.repeat) ultimate();
    if (e.code === 'KeyU' && !e.repeat) upgradeFence();
    if (e.code === 'KeyF' && !e.repeat) attack();
    if (e.code === 'KeyQ' && !e.repeat) swapWeapon();
    if (e.code === 'KeyC' && !e.repeat) { if (smithEl.style.display === 'flex') closeSmith(); else openSmith(); }
    keys[e.code] = true;
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  // ---------- 사운드: WebAudio 합성 (외부 파일 없음) + 낮/밤/습격 배경음 ----------
  const sfxAt = (name, x, z) => { const v = 1 - Math.hypot(x - player.position.x, z - player.position.z) / 45; if (v > 0.03) Snd.play(name, v); };
  for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => Snd.init());
  addEventListener('keydown', e => { if (e.code === 'KeyM' && !e.repeat) Snd.toggle(); });
  document.getElementById('muteBtn').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); Snd.init(); Snd.toggle(); });
  Snd.setMuted(Snd.isMuted());

  // ---------- 자원 / 상호작용 ----------
  let playerClass = null, order = 'guard', rallyT = 0;
  const perks = {};                                                  // 시대 -> 퍼크 id
  const hasPerk = (id) => Object.values(perks).includes(id);
  const pMaxHp = () => CFG.PLAYER_MAX_HP + (playerClass === 'warrior' ? 30 : playerClass === 'commander' ? -20 : 0);
  const pDmg = () => playerClass === 'warrior' ? 1.25 : playerClass === 'commander' ? 0.8 : 1;
  const gatherYield = (t) => CFG.GATHER_YIELD[t] + (hasPerk('forager') ? 1 : 0);
  const fenceHp = () => CFG.FENCE_HP * (hasPerk('fortifier') ? 1.5 : 1), wallHp = () => CFG.WALL_HP * (hasPerk('engineer') ? 1.5 : 1);
  const dashMul = () => (playerClass === 'warrior' ? 0.8 : 1) * (hasPerk('warlord') ? 0.75 : 1);
  const spdMul = () => hasPerk('scout') ? 1.1 : 1;
  const gearCost = (d) => hasPerk('smith') ? Object.fromEntries(Object.entries(d.cost).map(([k, v]) => [k, Math.ceil(v * 0.75)])) : d.cost;
  const npcMaxHp = (role, trait) => Math.round(ROLE[role].hp * (CFG.TRAITS[trait].hp || 1) * (hasPerk('lord') && role !== 'citizen' ? 1.15 : 1));
  const soldierMult = (n) => (playerClass === 'commander' && Math.hypot(n.position.x - player.position.x, n.position.z - player.position.z) < 15 ? 1.15 : 1) * (rallyT > 0 ? 1.5 : 1) * (hasPerk('lord') ? 1.1 : 1) * (story.dawn ? 1.1 : 1);
  const res = { wood: 0, stone: 0, food: 0, iron: 0, shard: 0 };
  let weaponMode = 'sword';
  const playerGear = { sword: 'sword_basic', bow: 'bow_basic', armor: 'armor_none' };
  const gearDef = (id) => CFG.GEAR[id];
  function applyPlayerGear() {
    playerRig.main = weaponMode;
    playerRig.setGear('sword', gearDef(playerGear.sword)); playerRig.setGear('bow', gearDef(playerGear.bow)); playerRig.setArmor(gearDef(playerGear.armor));
    playerRig.hold(weaponMode);
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
  function updateHud() { woodEl.textContent = res.wood; stoneEl.textContent = res.stone; ironEl.textContent = res.iron; if (res.shard > 0) { document.getElementById('shardRow').style.display = ''; document.getElementById('shardN').textContent = res.shard; } foodEl.textContent = Math.floor(res.food); { const sw = gearDef(playerGear.sword), bw = gearDef(playerGear.bow), ar = gearDef(playerGear.armor); atkEl.textContent = `${sw.short} ${sw.dmg} / ${bw.short} ${bw.dmg}`; document.getElementById('armN').textContent = ar.reduce ? `${ar.short} -${Math.round(ar.reduce * 100)}%` : 'None'; } }

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
  // ---------- 마을 자동 확장: 사각형 방어선 도면 ----------
  function addBlueprint(kind, x, z, rot) {
    const stone = kind === 'stone';
    const bp = new THREE.Mesh(stone ? wallGeo : bpGeo,
      new THREE.MeshBasicMaterial({ color: stone ? 0xc8d8ff : 0x4aa8ff, transparent: true, opacity: 0.4, depthWrite: false }));
    bp.position.set(x, stone ? 0.7 : 0.55, z);
    bp.rotation.y = rot;
    bp.userData = { type: 'blueprint', res: kind, radius: stone ? 1.5 : 1.2, owner: null };
    scene.add(bp);
    blueprints.push(bp);
  }
  // ----- 마을 건물 (거주지 / 병영 / 사격장) -----
  const bMat = (c) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 1 });
  const houseWall = bMat(0xc9a46a), houseRoof = bMat(0xa34a2a), barrackMat = bMat(0x7b808a), barrackTop = bMat(0x585d66);
  const woodMat2 = bMat(0x8a5a34), tgtRed = new THREE.MeshStandardMaterial({ color: 0xd23a2a, roughness: 1 }), tgtWhite = new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 1 });
  function doorOf(b) {                 // 건물 앞(중앙 쪽) 출입 지점
    const d = Math.hypot(b.position.x, b.position.z) || 1, off = b.userData.radius + 0.9;
    return { x: b.position.x - b.position.x / d * off, z: b.position.z - b.position.z / d * off };
  }
  const windowGlow = new THREE.MeshBasicMaterial({ color: 0x2a2a33 }), lampGlow = new THREE.MeshBasicMaterial({ color: 0x2a2a33 });        // 밤이 되면 따뜻하게 켜진다 (tick)
  const forgeGlow = new THREE.MeshBasicMaterial({ color: 0xff7a1a }), anvilMat = bMat(0x34363c);
  const tentMat = bMat(0xd9c9a0), tentDoor = bMat(0x4a3a24), stoneWall = bMat(0x8d9099), slateRoof = bMat(0x4a4d57), chimneyMat = bMat(0x6a6d75);
  const dirt = bMat(0x6b4a2b), cropMat = bMat(0x4fae3a), logPile = bMat(0x7a4f2a), rockPile = bMat(0x9a9aa2), towerStone = bMat(0x7f838c), towerTop = bMat(0x5c606a);
  // 거주지 외형은 시대에 따라 바뀐다: 1시대 텐트(원뿔) → 2시대 나무집(삼각 지붕) → 3시대 돌집
  function setHouseModel(g) {
    const lvl = g.userData.level || 1;
    while (g.children.length) g.remove(g.children[0]);
    const add = (geo, m, px, py, pz) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
    if (lvl <= 1) {
      add(new THREE.ConeGeometry(1.9, 2.6, 8), tentMat, 0, 1.3, 0);
      add(new THREE.BoxGeometry(0.7, 1.1, 0.12), windowGlow, 0, 0.55, 1.6).rotation.x = -0.35;
    } else if (lvl === 2) {
      add(new THREE.BoxGeometry(2.6, 1.8, 2.6), houseWall, 0, 0.9, 0);
      add(new THREE.ConeGeometry(2.3, 1.4, 4), houseRoof, 0, 2.5, 0).rotation.y = Math.PI / 4;
      add(new THREE.BoxGeometry(0.5, 0.5, 0.06), windowGlow, 0.6, 1.0, 1.32); add(new THREE.BoxGeometry(0.5, 0.5, 0.06), windowGlow, -0.6, 1.0, 1.32);
    } else {
      add(new THREE.BoxGeometry(2.8, 2.1, 2.8), stoneWall, 0, 1.05, 0);
      add(new THREE.ConeGeometry(2.5, 1.5, 4), slateRoof, 0, 2.85, 0).rotation.y = Math.PI / 4;
      add(new THREE.BoxGeometry(0.5, 1.2, 0.5), chimneyMat, 0.8, 3.0, 0.6);
      add(new THREE.BoxGeometry(0.5, 0.6, 0.06), windowGlow, 0.7, 1.2, 1.42); add(new THREE.BoxGeometry(0.5, 0.6, 0.06), windowGlow, -0.7, 1.2, 1.42);
    }
  }
  function refreshHouses() { for (const h of obstacles) if (h.userData.type === 'building' && h.userData.kind === 'house') setHouseModel(h); }
  function createBuilding(kind, x, z) {
    const g = new THREE.Group();
    const add = (geo, m, px, py, pz) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
    g.userData = { type: 'building', kind, radius: CFG.BUILDING[kind].radius, worker: null };
    if (CFG.LEVELED.includes(kind)) g.userData.level = 1;
    if (kind === 'house') {
      g.userData.level = age;                                          // 새 집은 현재 시대의 모습으로 지어진다
      setHouseModel(g);
    } else if (kind === 'barracks') {                                    // 평평하고 넓은 회색 건물
      add(new THREE.BoxGeometry(6.4, 1.6, 4.4), barrackMat, 0, 0.8, 0);
      add(new THREE.BoxGeometry(6.6, 0.25, 4.6), barrackTop, 0, 1.72, 0);
      for (const wx of [-2, 0, 2]) add(new THREE.BoxGeometry(0.6, 0.4, 0.06), windowGlow, wx, 1.0, 2.23);
    } else if (kind === 'range') {                                       // 사격장: 나무 단상 + 앞의 원형 과녁
      add(new THREE.BoxGeometry(4.4, 0.4, 3.0), woodMat2, 0, 0.2, 0);
      add(new THREE.BoxGeometry(0.2, 1.6, 0.2), woodMat2, 0, 0.8, -3.2);
      for (const [r, m, yy] of [[0.9, tgtRed, 0], [0.62, tgtWhite, 0.02], [0.32, tgtRed, 0.04]]) {
        const t = add(new THREE.CylinderGeometry(r, r, 0.12, 24), m, 0, 1.7, -3.2 - yy); t.rotation.x = Math.PI / 2;
      }
    } else if (kind === 'farm') {                                        // 네모난 갈색 밭 + 자라나는 작물
      add(new THREE.BoxGeometry(5, 0.12, 4), dirt, 0, 0.06, 0);
      g.userData.crops = [];
      for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) {
        const c = add(new THREE.ConeGeometry(0.22, 0.7, 5), cropMat, -2 + i * 0.8, 0.4, -1.4 + j * 0.9);
        c.scale.y = 0.3; g.userData.crops.push(c);
      }
      g.userData.growth = 0.3;
    } else if (kind === 'lumber') {                                      // 벌목장: 나무 오두막 + 통나무 더미
      add(new THREE.BoxGeometry(2.2, 1.5, 1.8), woodMat2, 0, 0.75, 0);
      add(new THREE.BoxGeometry(2.6, 0.2, 2.2), houseRoof, 0, 1.6, 0);
      for (let i = 0; i < 3; i++) add(new THREE.CylinderGeometry(0.25, 0.25, 1.6, 8), logPile, 1.7, 0.25 + (i === 2 ? 0.4 : 0), -0.5 + (i % 2) * 0.55).rotation.z = Math.PI / 2;
    } else if (kind === 'quarry') {                                      // 채석장: 바위 더미 + 곡괭이 틀
      for (let i = 0; i < 4; i++) add(new THREE.DodecahedronGeometry(0.5 + i * 0.12, 0), rockPile, -0.9 + i * 0.7, 0.4, (i % 2) * 0.8);
      add(new THREE.BoxGeometry(0.15, 1.6, 0.15), woodMat2, 1.4, 0.8, 0);
      add(new THREE.BoxGeometry(1.0, 0.15, 0.15), woodMat2, 1.4, 1.6, 0);
    } else if (kind === 'well') {                                        // 우물: 돌 테두리 + 물 + 작은 지붕
      add(new THREE.CylinderGeometry(1.0, 1.1, 0.7, 12), stoneWall, 0, 0.35, 0);
      add(new THREE.CylinderGeometry(0.78, 0.78, 0.05, 12), new THREE.MeshStandardMaterial({ color: 0x3a78c8, roughness: 0.3 }), 0, 0.7, 0);
      for (const sx of [-0.95, 0.95]) add(new THREE.BoxGeometry(0.12, 1.5, 0.12), woodMat2, sx, 1.1, 0);
      add(new THREE.ConeGeometry(1.35, 0.7, 4), houseRoof, 0, 2.2, 0).rotation.y = Math.PI / 4;
    } else if (kind === 'market') {                                      // 시장: 나무 단상 + 색색 천막 가판 3개 + 등불
      add(new THREE.BoxGeometry(5.0, 0.2, 3.2), woodMat2, 0, 0.1, 0);
      [0xc0392b, 0x2f7fc0, 0xd9a92a].forEach((c, i) => {
        const x = -1.7 + i * 1.7, awn = new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 1 });
        add(new THREE.BoxGeometry(1.3, 0.6, 0.9), woodMat2, x, 0.5, 0.5);
        add(new THREE.BoxGeometry(1.5, 0.08, 1.3), awn, x, 1.7, 0.45).rotation.x = 0.18;
        for (const dx of [-0.65, 0.65]) add(new THREE.BoxGeometry(0.08, 1.4, 0.08), woodMat2, x + dx, 1.0, 1.0);
        add(new THREE.BoxGeometry(0.3, 0.2, 0.3), [cropMat, logPile, rockPile].at(i), x, 0.9, 0.5);
      });
      for (const lx of [-2.3, 2.3]) { add(new THREE.CylinderGeometry(0.05, 0.05, 1.8, 5), woodMat2, lx, 1.0, -1.4); add(new THREE.SphereGeometry(0.16, 8, 6), lampGlow, lx, 2.0, -1.4); }
    } else if (kind === 'smith') {                                       // 대장간: 석조 작업장 + 굴뚝 + 모루 + 완성품 선반
      add(new THREE.BoxGeometry(4.0, 1.5, 3.0), stoneWall, 0, 0.75, 0);
      add(new THREE.BoxGeometry(4.5, 0.22, 3.5), slateRoof, 0, 1.62, 0);
      add(new THREE.BoxGeometry(0.7, 2.4, 0.7), chimneyMat, -1.4, 2.0, -0.9);
      add(new THREE.BoxGeometry(0.46, 0.1, 0.46), forgeGlow, -1.4, 3.22, -0.9);
      add(new THREE.BoxGeometry(1.0, 0.7, 0.1), forgeGlow, 0.6, 0.65, 1.52);                // 화덕 불빛
      add(new THREE.BoxGeometry(0.7, 0.3, 0.4), anvilMat, 1.2, 0.5, 2.5);                    // 모루 + 받침
      add(new THREE.CylinderGeometry(0.28, 0.32, 0.35, 8), woodMat2, 1.2, 0.17, 2.5);
      const rack = new THREE.Group(); rack.position.set(-2.9, 0, 0.2);                       // 완성된 장비가 걸리는 선반
      for (const dz of [-1.1, 1.1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.5, 0.14), woodMat2); post.position.set(0, 0.75, dz); post.castShadow = true; rack.add(post); }
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 2.4), woodMat2); bar.position.set(0, 1.4, 0); rack.add(bar);
      const items = new THREE.Group(); rack.add(items); g.add(rack);
      g.userData.rackItems = items;
      g.userData.stock = {};
      for (const id in CFG.GEAR) if (CFG.GEAR[id].cost) g.userData.stock[id] = 0;
    } else {                                                             // 방어 타워: 돌 원기둥 + 흉벽
      add(new THREE.CylinderGeometry(1.2, 1.5, 4, 10), towerStone, 0, 2, 0);
      add(new THREE.CylinderGeometry(1.7, 1.7, 0.5, 10), towerTop, 0, 4.25, 0);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(new THREE.BoxGeometry(0.5, 0.5, 0.5), towerTop, Math.cos(a) * 1.55, 4.75, Math.sin(a) * 1.55); }
      g.userData.shootCd = rand(0, 1);
    }
    g.position.set(x, 0, z);
    scene.add(g);
    obstacles.push(g);
    if (kind !== 'farm' && kind !== 'tower' && kind !== 'lumber' && kind !== 'quarry') { const dr = doorOf(g); addPath(dr.x, dr.z, 1.5); }      // 문 앞에서 중앙 광장까지 흙길
    return g;
  }
  // 선반에 완성품 진열 (재고 수만큼 칼/활을 걸어 둔다)
  function refreshRack(sm) {
    const grp = sm.userData.rackItems; if (!grp) return;
    while (grp.children.length) grp.remove(grp.children[0]);
    let i = 0;
    for (const id in sm.userData.stock) {
      for (let k = 0; k < Math.min(4, sm.userData.stock[id]); k++, i++) {
        const d = gearDef(id), m = d.slot === 'sword' ? makeSwordMesh(d) : d.slot === 'bow' ? makeBowMesh(d) : makeArmorIcon(d);
        m.scale.setScalar(0.8); m.position.set(0.12, 1.25, -1.0 + (i % 5) * 0.5);
        if (d.slot === 'armor') { m.position.y = 1.0; m.rotation.y = Math.PI / 2; }
        else if (d.slot === 'sword') { m.rotation.set(Math.PI / 2, 0, 0); m.position.y = 1.4; }       // 칼날이 아래로 걸리도록
        else { m.rotation.y = Math.PI / 2; m.position.y = 0.85; }                                // 활은 세워서 (불룩한 쪽이 바깥)
        grp.add(m);
      }
    }
  }
  function addBuildingBlueprint(kind, x, z) {
    const def = CFG.BUILDING[kind];
    const size = def.size || (kind === 'house' ? [2.6, 2.4, 2.6] : kind === 'barracks' ? [6.4, 1.8, 4.4] : [4.4, 1.8, 3.0]);
    const bp = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial({ color: 0x7fe0a0, transparent: true, opacity: 0.4, depthWrite: false }));
    bp.position.set(x, size[1] / 2, z);
    bp.userData = { type: 'blueprint', res: def.res, cost: def.cost, bkind: kind, radius: def.radius, stand: def.radius + 0.9 + (kind === 'farm' ? 1.4 : 0), buildTime: CFG.BUILD_TIME_BUILDING, owner: null };
    scene.add(bp);
    blueprints.push(bp);
  }
  // 건설 부지 확보: 해당 위치의 나무/바위를 즉시 삭제
  function clearArea(x, z, r) {
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i], ty = o.userData.type;
      if ((ty === 'wood' || ty === 'stone') && Math.hypot(o.position.x - x, o.position.z - z) < o.userData.radius + r) {
        scene.remove(o); obstacles.splice(i, 1);
      }
    }
  }
  const doormats = [];                                              // 바닥 장식(도어 매트·흙길·가로등): 월드 초기화 때 함께 지운다
  const pathMat = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 1 }), lampPostMat = new THREE.MeshStandardMaterial({ color: 0x3a2a22, roughness: 1 });
  function addPath(x, z, w) {                                       // 중앙(모닥불 가장자리)에서 (x, z)까지 이어지는 다져진 흙길
    const d = Math.hypot(x, z); if (d < 2.5) return;
    const ux = x / d, uz = z / d, a = 0.9, len = d - a;
    const geo = new THREE.PlaneGeometry(w, len); geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, pathMat);
    m.position.set(ux * (a + len / 2), 0.012, uz * (a + len / 2)); m.rotation.y = Math.atan2(ux, uz); m.receiveShadow = true;
    scene.add(m); doormats.push(m);
  }
  function addLamp(x, z) {                                          // 가로등: 밤이 되면 불이 켜진다
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.3, 6), lampPostMat); post.position.y = 1.15; post.castShadow = true;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), lampGlow); bulb.position.y = 2.45;
    const halo = new THREE.Sprite(haloMat); halo.scale.set(2.6, 2.6, 1); halo.position.y = 2.45; halo.renderOrder = 5;       // 등불 주변의 번지는 빛
    g.add(post, bulb, halo); g.position.set(x, 0, z); scene.add(g); doormats.push(g);
    lampHalos.push(halo);
  }
  // 성문 조명: 문마다 실제 점광원 + 바닥에 퍼지는 따뜻한 빛 웅덩이 (밤에 문 앞이 충분히 밝도록)
  const haloMat = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const c = cv.getContext('2d'), gr = c.createRadialGradient(32, 32, 1, 32, 32, 31);
    gr.addColorStop(0, 'rgba(255,214,140,1)'); gr.addColorStop(0.35, 'rgba(255,170,70,.45)'); gr.addColorStop(1, 'rgba(255,140,40,0)');
    c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
    return new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false });
  })();
  const poolMat = new THREE.MeshBasicMaterial({ map: haloMat.map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false });
  const lampHalos = [], gateLights = [];
  let lampLevel = 0;
  function updateGateLights(t) {
    haloMat.opacity = Math.min(1, lampLevel * 1.1); poolMat.opacity = lampLevel * 0.3;
    for (let i = gateLights.length - 1; i >= 0; i--) {
      const l = gateLights[i];
      if (!l.parent) { gateLights.splice(i, 1); continue; }
      l.intensity = lampLevel * (2.2 + 0.2 * Math.sin(t * 7 + i * 1.7));
    }
    for (let i = lampHalos.length - 1; i >= 0; i--) if (!lampHalos[i].parent) lampHalos.splice(i, 1);
  }
  function addGate(x, z, r, nx, nz) {                                // 출입구 경유지 등록 + 바닥의 얇고 납작한 회색 도어 매트
    gateWaypoints.push({ x, z, r, nx, nz });
    const doormat = new THREE.Mesh(matGeo, matMat);
    doormat.position.set(x, 0.02, z);
    doormat.receiveShadow = true;
    scene.add(doormat);
    doormats.push(doormat);
    addPath(x, z, 2.4);
    addLamp(x - nz * 2.6, z + nx * 2.6); addLamp(x + nz * 2.6, z - nx * 2.6);        // 출입구 양옆 가로등
    const light = new THREE.PointLight(0xffc27a, 0, 18, 1.3); light.position.set(x, 3.2, z); scene.add(light); doormats.push(light); gateLights.push(light);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(7.5, 28), poolMat); pool.rotation.x = -Math.PI / 2; pool.position.set(x, 0.04, z); pool.renderOrder = 4; scene.add(pool); doormats.push(pool);
  }
  // 정사각형 성벽 띠(중앙 기준 체비셰프 거리 R ± width) 안의 자원을 모두 치워, 벽과 나무/바위 사이에 NPC가 끼는 틈을 없앤다
  const cheb = (x, z) => Math.max(Math.abs(x), Math.abs(z));
  function clearCorridor(R, width) {
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i], ty = o.userData.type;
      if ((ty === 'wood' || ty === 'stone') && Math.abs(cheb(o.position.x, o.position.z) - R) < width + o.userData.radius) {
        scene.remove(o); obstacles.splice(i, 1);
      }
    }
  }
  // 중앙(0,0)을 기준으로 정사각형 네 테두리를 따라 청사진 배치. 각 변의 정중앙은 출입구(Gap)로 비워 도어 매트와 경유지를 만든다
  function designSquare(cfg) {
    const R = cfg.half, n = cfg.perHalf, step = R / n;
    clearCorridor(R, CFG.CORRIDOR_WIDTH);
    const rad = cfg.kind === 'stone' ? 1.5 : 1.2;
    const pts = [];
    for (let k = -n; k <= n; k++) { pts.push({ x: k * step, z: -R, u: k, nx: 0, nz: -1, rot: 0 }); pts.push({ x: k * step, z: R, u: k, nx: 0, nz: 1, rot: 0 }); }              // 북/남 (모서리 포함)
    for (let k = -(n - 1); k <= n - 1; k++) { pts.push({ x: R, z: k * step, u: k, nx: 1, nz: 0, rot: Math.PI / 2 }); pts.push({ x: -R, z: k * step, u: k, nx: -1, nz: 0, rot: Math.PI / 2 }); }   // 동/서
    let placed = 0;
    for (const p of pts) {
      if (p.u === 0) {                                              // 출입구: 비워 두고 길만 터 준 뒤 경유지로 등록
        clearArea(p.x, p.z, 2.4);
        addGate(p.x, p.z, R, p.nx, p.nz);
        continue;
      }
      const taken = blueprints.some(b => Math.hypot(b.position.x - p.x, b.position.z - p.z) < 1.5) ||
                    obstacles.some(o => o.userData.type === 'fence' && Math.hypot(o.position.x - p.x, o.position.z - p.z) < 1.5);
      if (taken) continue;
      clearArea(p.x, p.z, rad + 0.3);
      addBlueprint(cfg.kind, p.x, p.z, p.rot);
      placed++;
    }
    return placed;
  }
  let designTier = 0;
  const designBtnEl = document.getElementById('designBtn');
  function updateDesignBtn() {
    const cfg = CFG.DESIGN[designTier];
    designBtnEl.classList.remove('done');
    if (!cfg) {
      designBtnEl.classList.add('done'); designBtnEl.classList.remove('stone');
      document.getElementById('designLbl').textContent = 'Defense Lines Complete';
      document.getElementById('designCost').textContent = 'All tiers planned';
      return;
    }
    const [type, n] = Object.entries(cfg.cost)[0];
    document.getElementById('designLbl').textContent = cfg.label;
    document.getElementById('designCost').textContent = cfg.age && age < cfg.age ? `Requires Age ${cfg.age} · ${n} ${type === 'wood' ? 'Wood' : 'Stone'}` : `Costs ${n} ${type === 'wood' ? 'Wood' : 'Stone'}`;
    designBtnEl.classList.toggle('stone', cfg.kind === 'stone');
  }
  function designDefense() {
    if (dead) return;
    const cfg = CFG.DESIGN[designTier];
    if (!cfg) return;
    if (cfg.age && age < cfg.age) return toast(`Available from Age ${cfg.age} (${CFG.AGES[cfg.age - 1].name})`);
    const [type, n] = Object.entries(cfg.cost)[0];
    if (res[type] < n) return toast(`Need ${n} ${type === 'wood' ? 'Wood' : 'Stone'}`);
    res[type] -= n;
    const placed = designSquare(cfg);
    designTier++;
    updateHud(); updateDesignBtn();
    toast(`${cfg.label} planned! ${placed} blueprints - your companions will build them`);
  }
  // ----- 마을 인프라: 시대별 묶음 설계 -----
  let townStage = 0;                          // 지금까지 설계한 묶음 수
  const canPay = (c) => Object.entries(c).every(([k, v]) => res[k] >= v);
  const payCost = (c) => { for (const [k, v] of Object.entries(c)) res[k] -= v; };
  const costText = (c) => Object.entries(c).map(([k, v]) => `${v} ${k === 'wood' ? 'Wood' : k === 'stone' ? 'Stone' : k === 'iron' ? 'Iron' : k === 'shard' ? 'Shard' : 'Food'}`).join(' + ');
  // 숲/바위가 가장 많이 모여 있는 빈 자리를 찾아 벌목장/채석장 위치로 삼는다
  function findClusterSpot(kind) {
    const type = kind === 'lumber' ? 'wood' : 'stone';
    const occupied = (x, z) => obstacles.some(o => (o.userData.type === 'building' || o.userData.type === 'fence') && Math.hypot(o.position.x - x, o.position.z - z) < 7) ||
                               blueprints.some(b => Math.hypot(b.position.x - x, b.position.z - z) < 7);
    let best = null, bs = -1;
    for (let i = 0; i < 260; i++) {
      const x = rand(-38, 38), z = rand(-38, 38), c = cheb(x, z);
      if (c < 8 || Math.abs(x) < 3.5 || Math.abs(z) < 3.5 || Math.abs(c - 15) < 3.6 || Math.abs(c - 25) < 3.6 || occupied(x, z)) continue;
      const score = obstacles.filter(o => o.userData.type === type && Math.hypot(o.position.x - x, o.position.z - z) < 10).length + (c < 26 ? 2 : 0);   // 마을 안쪽이면 가산점
      if (score > bs) { bs = score; best = { x, z }; }
    }
    return best || { x: kind === 'lumber' ? 20 : -20, z: kind === 'lumber' ? 10 : -10 };
  }
  // 마을 안쪽의 빈 자리 찾기 (우물·시장): 중심에 가깝고, 출입구 통로와 다른 건물에서 떨어진 곳
  function findTownSpot(kind) {
    const rad = CFG.BUILDING[kind].radius;
    const others = obstacles.filter(o => o.userData.type === 'building').map(o => [o.position.x, o.position.z, o.userData.radius]).concat(blueprints.map(b => [b.position.x, b.position.z, b.userData.radius || 2]));
    let best = null, bd = Infinity;
    for (let i = 0; i < 400; i++) {
      const x = rand(-13, 13), z = rand(-13, 13), d = Math.hypot(x, z);
      if (cheb(x, z) > 13.2 || Math.abs(x) < rad + 1.2 || Math.abs(z) < rad + 1.2 || d < FIRE_R + rad + 3.2) continue;
      if (others.some(([ox, oz, or]) => Math.hypot(x - ox, z - oz) < rad + or + 1.0)) continue;
      if (d < bd) { bd = d; best = { x, z }; }
    }
    return best || { x: 7, z: -4 };
  }
  function designTown() {
    if (dead) return;
    const g = CFG.TOWN_GROUPS[townStage];
    if (!g) return;
    if (age < g.age) return toast(`Available in Age ${g.age} (${CFG.AGES[g.age - 1].name})`);
    if (!canPay(g.cost)) return toast(`Need ${costText(g.cost)}`);
    payCost(g.cost);
    townStage++;
    const names = [];
    for (const lot of g.lots) {
      const pos = lot.auto ? (lot.auto === 'town' ? findTownSpot(lot.kind) : findClusterSpot(lot.kind)) : lot;
      clearArea(pos.x, pos.z, CFG.BUILDING[lot.kind].radius + 1.4);
      addBuildingBlueprint(lot.kind, pos.x, pos.z);
      names.push(BUILDING_NAME[lot.kind]);
    }
    updateHud(); updateTownBtn();
    toast(`${g.label} done! ${names.join(' · ')} - your companions will build them`);
  }
  const BUILDING_NAME = { well: 'Well', market: 'Market', smith: 'Blacksmith', house: 'House', barracks: 'Barracks', range: 'Archery Range', farm: 'Farm', lumber: 'Lumber Camp', quarry: 'Quarry', tower: 'Defense Tower' };
  function updateTownBtn() {
    const g = CFG.TOWN_GROUPS[townStage], b = document.getElementById('townBtn');
    b.classList.toggle('done', !g);
    document.getElementById('townLbl').textContent = g ? g.label : 'Town Planning Complete';
    document.getElementById('townCost').textContent = g ? (age < g.age ? `Requires Age ${g.age}` : `Costs ${costText(g.cost)}`) : 'All buildings planned';
  }
  function upgradeFence() {
    if (dead) return;
    if (age < CFG.UPGRADE_FENCE_AGE) return toast(`Stone walls unlock in Age ${CFG.UPGRADE_FENCE_AGE} (${CFG.AGES[CFG.UPGRADE_FENCE_AGE - 1].name})`);
    const f = nearestFence('wood');
    if (!f) return toast(nearestFence() ? 'Already a stone wall' : 'No wooden fence nearby to upgrade');
    if (res.stone < CFG.FENCE_UPGRADE_STONE) return toast(`Need ${CFG.FENCE_UPGRADE_STONE} Stone`);
    res.stone -= CFG.FENCE_UPGRADE_STONE;
    f.material = wallMat;                         // 짙은 회색 돌 성벽
    f.scale.y = 1.25; f.position.y = 0.55 * 1.25;
    Object.assign(f.userData, { level: 'stone', hp: wallHp(), maxHp: wallHp() });
    updateHud();
    toast('Upgraded to a stone wall!');
  }
  // 버튼: 가까이에 나무 목책이 있으면 업그레이드, 아니면 건설

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

  // ---------- 낮/밤 순환 ----------
  const DAY_START_MIN = 8 * 60;       // 08:00 시작
  const MIN_PER_SEC = 10;             // 현실 1초 = 게임 10분
  const clockEl = document.getElementById('clock');
  let gameMin = DAY_START_MIN;
  const C = (h) => new THREE.Color(h);
  const L = {
    sunDay: C(0xff9a4a), sunNight: C(0x3a4a9a),
    ambDay: C(0x6f86d6), ambNight: C(0x1a2450),
    fogDay: C(0x3a2a52), fogNight: C(0x0a0d1c),
    sunBlood: C(0xff4a30), ambBlood: C(0x7a1224), fogBlood: C(0x3a0a10),      // 붉은 달 조명
  };
  const lerp = THREE.MathUtils.lerp;
  // 0 = 낮, 1 = 한밤. 18시부터 서서히 어두워지고 05~07시에 다시 밝아짐
  function nightFactor(h) {
    if (h >= 18 && h < 21) return (h - 18) / 3;
    if (h >= 21 || h < 5) return 1;
    if (h < 7) return 1 - (h - 5) / 2;
    return 0;
  }
  // ---------- 9-3: 계절 (봄 → 여름 → 가을 → 겨울, 각 CFG.SEASON_DAYS일). 농장 수확, 식량 소비, 기분, 질병 확률이 달라지고 땅·나뭇잎 색이 바뀐다 ----------
  const SEASONS = [
    { id: 'spring', name: 'Spring', farm: 1, ration: 1, mood: 2, sick: 0.05, ground: 0x8f7b3f, leaf: 0x58a040, msg: 'Spring has come: the fields wake up' },
    { id: 'summer', name: 'Summer', farm: 1.25, ration: 1, mood: 3, sick: 0.02, ground: 0xa27a40, leaf: 0x3f8a3c, msg: 'Summer has come: long warm days, crops grow 25% better' },
    { id: 'autumn', name: 'Autumn', farm: 1.5, ration: 1, mood: 0, sick: 0.05, ground: 0xa5622f, leaf: 0xc7782a, msg: 'Autumn has come: harvest time, crops yield 50% more' },
    { id: 'winter', name: 'Winter', farm: 0.5, ration: 1.5, mood: -3, sick: 0.12, ground: 0xdde3ec, leaf: 0xcfe0dd, msg: 'Winter has come: crops yield half, citizens eat more, and sickness spreads. Stock food and build wells' },
  ].map(s => ({ ...s, gc: new THREE.Color(s.ground), lc: new THREE.Color(s.leaf) }));
  const NEUTRAL_SEASON = { id: 'none', name: '', farm: 1, ration: 1, mood: 0, sick: 0.03, gc: new THREE.Color(0x9a6b44), lc: new THREE.Color(0x3f8a3c) };
  const seasonOfDay = (day) => CFG.SEASONS_ON ? SEASONS[Math.floor((day - 1) / CFG.SEASON_DAYS) % 4] : NEUTRAL_SEASON;
  const season = () => seasonOfDay(Math.floor(gameMin / 1440) + 1);
  function seasonVisual(k) {
    const s = season();
    ground.material.color.lerp(s.gc, k); leafMat.color.lerp(s.lc, k);
  }
  function applyLighting(n, b = 0) {           // n: 밤 정도, b: 붉은 달 정도 (습격의 밤에만)
    sun.color.copy(L.sunDay).lerp(L.sunNight, n).lerp(L.sunBlood, b * 0.85);
    sun.intensity = lerp(1.2, 0.18, n) + b * 0.35;
    ambient.color.copy(L.ambDay).lerp(L.ambNight, n).lerp(L.ambBlood, b * 0.8);
    ambient.intensity = lerp(0.6, 0.28, n) + b * 0.12;
    scene.fog.color.copy(L.fogDay).lerp(L.fogNight, n).lerp(L.fogBlood, b * 0.9);
    scene.background.copy(scene.fog.color);
    scene.fog.near = lerp(35, 6, n);
    scene.fog.far = lerp(80, 30, n);
  }

  // ---------- 플레이어 횃불 ----------
  const torch = new THREE.PointLight(0xff8a30, 0, 18, 1.6);   // 밤에만 켜짐 (tick에서 밝기 제어)
  torch.position.set(0, 2.4, 0.3);
  player.add(torch);

  // ---------- 모닥불 (마을 거점) ----------
  let FIRE_R = 0.8;                       // 시대에 따라 모닥불 → 마을 회관 → 성채로 커진다
  const campfire = new THREE.Group();
  const campDecor = new THREE.Group();     // 1시대 모닥불의 장작/돌 (회관으로 바뀌면 숨김)
  campfire.add(campDecor);
  const logMat = mat(0x5a3a1e);
  for (let i = 0; i < 4; i++) {
    const log = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.22, 0.22), logMat);
    log.position.y = 0.2;
    log.rotation.y = i * Math.PI / 4 + 0.2;
    log.rotation.z = 0.15;
    log.castShadow = true;
    campDecor.add(log);
  }
  for (let i = 0; i < 8; i++) {   // 테두리 돌
    const a = i / 8 * Math.PI * 2;
    const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), rockMat);
    st.position.set(Math.cos(a) * 0.85, 0.12, Math.sin(a) * 0.85);
    campDecor.add(st);
  }
  const flame = new THREE.Group();
  const flameOuter = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.1, 6), new THREE.MeshBasicMaterial({ color: 0xff7a1a }));
  const flameInner = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 6), new THREE.MeshBasicMaterial({ color: 0xffd84a }));
  flameOuter.position.y = 0.75; flameInner.position.y = 0.6;
  flame.add(flameOuter, flameInner);
  campfire.add(flame);
  const fireLight = new THREE.PointLight(0xff8c3a, 1.8, 28, 1.4);   // 영구 조명
  fireLight.position.y = 1.4;
  campfire.add(fireLight);
  campfire.userData = { type: 'campfire', radius: FIRE_R };
  scene.add(campfire);
  obstacles.push(campfire);
  let fireAlive = true, fireHp = CFG.FIRE_HP;

  // ---------- 시대 발전: 모닥불 → 나무 마을 회관 → 석조 성채 ----------
  let age = 1;
  const fireMax = () => CFG.FIRE_HP_BY_AGE[age - 1];
  const hallGroup = new THREE.Group();
  campfire.add(hallGroup);
  const hallHint = textSprite('Upgrade Age: Click / T', '#ffe7a8', 3.2, 0.8, 'bold 40px sans-serif');
  campfire.add(hallHint);
  const hallWood = mat(0x8a5a34), hallRoof = mat(0x6b3a22), hallDark = mat(0x2e2218), keepStone = mat(0x8b8e95), keepTower = mat(0x7a7e87), keepTop = mat(0x5c606a);
  function buildHall() {
    while (hallGroup.children.length) hallGroup.remove(hallGroup.children[0]);
    const add = (geo, m, px, py, pz) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.castShadow = o.receiveShadow = true; hallGroup.add(o); return o; };
    campDecor.visible = age === 1;
    if (age === 1) { flame.position.y = 0; fireLight.position.y = 1.4; hallHint.position.y = 2.6; }
    else if (age === 2) {                                              // 나무 마을 회관 (큰 목조 건물)
      add(new THREE.BoxGeometry(4.6, 2.6, 4.6), hallWood, 0, 1.3, 0);
      add(new THREE.ConeGeometry(3.9, 1.9, 4), hallRoof, 0, 3.55, 0).rotation.y = Math.PI / 4;
      add(new THREE.BoxGeometry(1.2, 1.8, 0.12), hallDark, 0, 0.9, 2.32);
      add(new THREE.BoxGeometry(0.5, 0.5, 0.12), hallDark, -1.5, 1.6, 2.32); add(new THREE.BoxGeometry(0.5, 0.5, 0.12), hallDark, 1.5, 1.6, 2.32);
      add(new THREE.CylinderGeometry(0.35, 0.45, 0.5, 8), hallDark, 0, 4.15, 0);                // 지붕 위 화덕
      flame.position.y = 4.15; fireLight.position.y = 5.2; hallHint.position.y = 6.6;
    } else {                                                           // 석조 성채(Keep): 모서리 탑 4개 + 중앙 망루
      add(new THREE.BoxGeometry(6.2, 3.2, 6.2), keepStone, 0, 1.6, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        add(new THREE.CylinderGeometry(1.0, 1.1, 4.6, 10), keepTower, sx * 3.1, 2.3, sz * 3.1);
        add(new THREE.ConeGeometry(1.3, 1.2, 10), keepTop, sx * 3.1, 5.2, sz * 3.1);
      }
      add(new THREE.BoxGeometry(3.2, 2.6, 3.2), keepStone, 0, 4.5, 0);
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; add(new THREE.BoxGeometry(0.55, 0.55, 0.55), keepTop, Math.cos(a) * 1.7, 6.0, Math.sin(a) * 1.7); }
      add(new THREE.BoxGeometry(1.6, 2.2, 0.14), hallDark, 0, 1.1, 3.12);
      flame.position.y = 6.0; fireLight.position.y = 7.2; hallHint.position.y = 8.6;
    }
    FIRE_R = CFG.HALL_RADIUS[age - 1];
    campfire.userData.radius = FIRE_R;
  }
  buildHall();

  const ageEl = document.getElementById('ageN');
  const ageName = (a) => `Age ${a} · ${CFG.AGES[a - 1].name}`;
  function updateAgeUi() { ageEl.textContent = ageName(age); }
  function setAge(a) {                       // 시대 적용 (비용 지불 없이): 회관/거주지/시민 외형을 모두 갱신
    age = a; buildHall(); fireHp = fireMax();
    refreshCitizens(); updateAgeUi(); updateTownBtn(); updateDesignBtn();
    npcs.filter(n => n.role !== 'citizen').forEach((n, i) => { n.home = homeSlot(i); });      // 시대가 바뀌면 병사 대기 위치 재배치
  }
  // ----- 시대 발전 패널 -----
  const techEl = document.getElementById('techPanel'), techUpBtn = document.getElementById('techUp');
  function refreshTech() {
    document.getElementById('techTitle').textContent = `${CFG.AGES[age - 1].hall} · ${ageName(age)}`;
    document.getElementById('techCur').textContent = `Unlocked: ${CFG.AGES.slice(0, age).map(a => a.unlock).join(' / ')}` + (playerClass ? `\nYou: ${CFG.CLASSES[playerClass].label}` : '') + (Object.keys(perks).length ? `\nPerks: ${Object.entries(perks).map(([a, id]) => CFG.PERKS[a].find(p => p.id === id).label).join(' · ')}` : '');
    const nx = CFG.AGES[age];
    if (!nx) { document.getElementById('techNext').textContent = 'Final age reached. Your town hall has become a mighty keep.'; techUpBtn.disabled = true; techUpBtn.textContent = 'Max Age'; return; }
    document.getElementById('techNext').textContent = `Next: ${ageName(age + 1)} (${nx.hall}) - Cost: ${costText(nx.cost)} (You have: ${res.wood} Wood · ${res.stone} Stone)\nUnlocks: ${nx.unlock}`;
    techUpBtn.disabled = !canPay(nx.cost); techUpBtn.textContent = `Advance to Age ${age + 1}`;
  }
  function openTech() { if (dead) return; refreshTech(); techEl.style.display = 'flex'; }
  function closeTech() { techEl.style.display = 'none'; }
  function upgradeAge() {
    const nx = CFG.AGES[age];
    if (!nx) return;
    if (!canPay(nx.cost)) return toast(`Need ${costText(nx.cost)}`);
    payCost(nx.cost);
    setAge(age + 1);
    burst({ x: 0, z: 0 }, 40); shake = Math.max(shake, 0.6);
    updateHud(); refreshTech();
    toast(`Age advanced! ${ageName(age)} - ${CFG.AGES[age - 1].hall}`);
    setTimeout(() => openPerk(age), 900);
  }
  document.getElementById('techUp').addEventListener('click', upgradeAge);
  document.getElementById('techClose').addEventListener('click', closeTech);
  addEventListener('keydown', e => {
    if (e.code === 'KeyT' && !e.repeat) { if (techEl.style.display === 'flex') closeTech(); else if (Math.hypot(player.position.x, player.position.z) < 14) openTech(); else toast('Press T near the town hall (campfire)'); }
    if (e.code === 'Escape') { closeTech(); closeSmith(); }
  });
  // 모닥불/회관 클릭(탭)으로 열기: 드래그가 아닌 짧은 클릭만
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  canvas.addEventListener('pointerdown', e => { tapStart = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }; });
  canvas.addEventListener('pointerup', e => {
    if (!tapStart || tapStart.id !== e.pointerId) return;
    const moved = Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y), dur = performance.now() - tapStart.t;
    tapStart = null;
    if (moved > 10 || dur > 450 || e.button !== 0) return;
    ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const nh = ray.intersectObjects(npcs, true);                          // 주민을 누르면 주민 카드
    if (nh.length) { let o = nh[0].object; while (o && !npcs.includes(o)) o = o.parent; if (o) { openNpcCard(o); return; } }
    const gp = new THREE.Vector3();
    const onGround = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), gp);      // 건물 주변을 눌러도 열리도록 지면 좌표로도 판정
    if (ray.intersectObject(campfire, true).length || (onGround && Math.hypot(gp.x, gp.z) < FIRE_R + 1.2)) openTech();
    else if (smiths().length && (ray.intersectObjects(smiths(), true).length || (onGround && smiths().some(m => Math.hypot(gp.x - m.position.x, gp.z - m.position.z) < m.userData.radius + 1.2)))) openSmith();
  });

  function animateFire(t) {
    if (!fireAlive) return;
    const f = 1 + Math.sin(t * 9) * 0.12 + Math.sin(t * 23) * 0.06;
    const hpR = Math.max(0.35, fireHp / fireMax());         // 모닥불 체력이 줄면 불꽃도 작아진다
    flame.scale.set((2 - f) * hpR, f * hpR, (2 - f) * hpR);
    fireLight.intensity = 1.8 + (f - 1) * 1.5;
  }

  // ---------- 체력 / 게임오버 ----------
  let hp = CFG.PLAYER_MAX_HP, dead = false, hurtCd = 0, sinceHurt = 99, nowHour = 8;
  const hpEl = document.getElementById('hpN');
  function gameOver(sub) {
    if (dead) return;
    dead = true;
    document.getElementById('goDays').textContent = `Days survived: ${Math.floor(gameMin / 1440) + 1}`;
    document.getElementById('goCause').textContent = sub;
    document.getElementById('gameover').style.display = 'flex';
    renderRewindButtons();
  }
  document.getElementById('restartBtn').addEventListener('click', () => { clearSave(); location.reload(); });
  function damage(n) {
    if (invincibleT > 0) return;               // 대시 무적
    n = Math.max(1, Math.round(n * (1 - gearDef(playerGear.armor).reduce)));      // 방어구 피해 감소
    hp = Math.max(0, hp - n);
    sinceHurt = 0;
    hpEl.textContent = Math.ceil(hp); Snd.play('hurt');
    if (hp <= 0) gameOver('You were slain');
  }
  function healPlayer(n) { hp = Math.min(pMaxHp(), hp + n); hpEl.textContent = Math.ceil(hp); }
  // 회복: 모닥불 곁에서 일정 시간 맞지 않으면 초당 회복, 모닥불은 낮에 서서히 회복
  function updateRegen(dt) {
    if (dead) return;
    sinceHurt += dt;
    if (fireAlive && hp < pMaxHp() && sinceHurt >= CFG.REGEN_DELAY && Math.hypot(player.position.x, player.position.z) < CFG.REGEN_RADIUS) healPlayer(CFG.REGEN_RATE * (hasPerk('scout') ? 1.5 : 1) * dt);
    if (fireAlive && fireHp < fireMax() && nowHour >= 6 && nowHour < 18) fireHp = Math.min(fireMax(), fireHp + CFG.FIRE_REGEN * dt);
  }
  function destroyFire() {
    fireAlive = false;
    flame.visible = false;
    fireLight.intensity = 0;
    gameOver('The settlement was destroyed');
  }

  // ---------- 이펙트: 타격 궤적 / 파편 ----------
  const ATK_RANGE = 3, ATK_HALF = Math.PI / 3, ATK_CD = 0.4, SLASH_LIFE = 0.15;
  const slashGeo = new THREE.CircleGeometry(ATK_RANGE, 20, -Math.PI / 2 - ATK_HALF, ATK_HALF * 2);
  const slashes = [];
  const slashScale = (def) => def.slash || 1;
  function spawnSlash(x, z, ang, def = gearDef(playerGear.sword)) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(slashGeo, new THREE.MeshBasicMaterial({
      color: def.slashColor || 0xffffff, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2;
    g.add(m);
    g.position.set(x, 0.08, z);
    g.rotation.y = ang;
    g.scale.setScalar(slashScale(def));
    g.userData.life = SLASH_LIFE;
    scene.add(g);
    slashes.push(g);
  }
  const particles = [];
  const pGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
  const pMat = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
  const PLIFE = 0.7;
  function burst(pos, count = 12) {
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(pGeo, pMat);
      m.position.set(pos.x, 0.8, pos.z);
      m.userData = { v: new THREE.Vector3(rand(-1, 1) * 4, rand(3, 6), rand(-1, 1) * 4), life: PLIFE };
      scene.add(m);
      particles.push(m);
    }
  }
  const dustMat = new THREE.MeshBasicMaterial({ color: 0xc8b090 });
  function dust(x, z) {                       // 건설 완료 먼지 파티클
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(pGeo, dustMat);
      m.position.set(x + rand(-1, 1), 0.2, z + rand(-0.3, 0.3));
      m.userData = { v: new THREE.Vector3(rand(-1, 1) * 2.2, rand(1, 2.6), rand(-1, 1) * 2.2), life: PLIFE };
      scene.add(m);
      particles.push(m);
    }
  }
  function updateFx(dt) {
    for (const s of slashes.slice()) {
      s.userData.life -= dt;
      s.children[0].material.opacity = Math.max(0, s.userData.life / SLASH_LIFE) * 0.6;
      if (s.userData.life <= 0) { scene.remove(s); s.children[0].material.dispose(); slashes.splice(slashes.indexOf(s), 1); }
    }
    for (const p of particles.slice()) {
      const u = p.userData;
      u.v.y -= 14 * dt;
      p.position.addScaledVector(u.v, dt);
      if (p.position.y < 0.1) { p.position.y = 0.1; u.v.y *= -0.3; u.v.x *= 0.6; u.v.z *= 0.6; }
      p.rotation.x += dt * 8; p.rotation.z += dt * 6;
      u.life -= dt;
      p.scale.setScalar(Math.max(u.life / PLIFE, 0.01));
      if (u.life <= 0) { scene.remove(p); particles.splice(particles.indexOf(p), 1); }
    }
  }

  // ---------- 적 (약탈자) ----------
  const enemies = [];
  const RAIDER_BLADE = { id: 'raider_blade', slot: 'sword', tier: 0, color: 0x6b6b70 };
  const BRUTE_CLUB = { id: 'brute_club', slot: 'sword', tier: 0, color: 0x5a3a1e };
  const enemyMat = mat(0xc4231a), bruteMat = mat(0x5a0d0a);
  const ENEMY_R = 0.45, ENEMY_SPEED = 2.4;
  const AGGRO = 9, DEAGGRO = 13, FIRE_BREAK_TIME = 3;
  let spawnCd = 0;
  // kind: 'normal' | 'brute' | 'shield'. 최대 HP는 날짜에 따라 HP_SCALE_EVERY일마다 +1
  const beastMat = mat(0x8a6a40), bossMat = mat(0x0b0b0e), siegeMat = mat(0x8a3fc0), shieldMat = mat(0xb8c0cc), shieldPlateMat = mat(0x666b73), shieldPlateGeo = new THREE.BoxGeometry(0.95, 1.1, 0.14);
  function spawnEnemy(kind = 'normal', at = null) {
    const brute = kind === 'brute', shield = kind === 'shield', siege = kind === 'siege', boss = kind === 'boss', beast = kind === 'beast';
    const a = rand(0, Math.PI * 2), r = MAP - 1;    // 맵 외곽 (안개 속 먼 곳)
    const sc = beast ? 0.75 : boss ? CFG.BOSS_SCALE : brute ? CFG.BRUTE_SCALE : siege ? 1.15 : 1;
    const eMat = beast ? beastMat : boss ? bossMat.clone() : brute ? bruteMat : shield ? shieldMat : siege ? siegeMat : enemyMat;
    const rig = beast ? makeRig('beast', 0, { bodyMat: eMat, enemy: true }) : makeRig('enemy', 0, { bodyMat: eMat, enemy: true, scale: 0.88, seed: Math.floor(Math.random() * 1e6) });       // 스틱맨/네발 리그 (몸통 색 = 적 종류)
    if (boss) {                                                                    // 보스: 뿔 + 가시 어깨 + 거대 몽둥이
      const hornM = gearMat('horn', 0xd8d0b8), padM = gearMat('bosspad', 0x2a2a30);
      for (const sx of [-1, 1]) {
        const h = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.38, 6), hornM); h.position.set(sx * 0.16, 0.4, 0); h.rotation.z = -sx * 0.5; rig.head.add(h);
        const pad = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), padM); pad.position.set(sx * 0.37, 0.62, 0); rig.spine.add(pad);
        const spk = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.24, 5), hornM); spk.position.set(sx * 0.4, 0.82, 0); spk.rotation.z = -sx * 0.35; rig.spine.add(spk);
      }
      rig.main = 'sword'; rig.setGear('sword', { id: 'boss_club', slot: 'sword', tier: 1, color: 0x2a2a30 }); rig.meshes.sword.scale.setScalar(1.8); rig.hold('sword');
    }
    if (!beast && !siege && !boss) { rig.main = 'sword'; rig.setGear('sword', brute ? BRUTE_CLUB : RAIDER_BLADE); rig.hold('sword'); }
    const m = new THREE.Group();
    rig.root.position.y = -0.8;                          // 그룹 중심(= 예전 원기둥 중심) 기준으로 발을 바닥에 맞춘다
    m.add(rig.root); m.material = rig.bodyMat;           // 보스 깜빡임/기절 색 변경은 m.material을 사용
    m.scale.setScalar(sc);
    m.position.set(Math.cos(a) * r, 0.8 * sc, Math.sin(a) * r);
    if (at) m.position.set(at.x, 0.8 * sc, at.z);
    if (shield) {                                    // 앞쪽(+Z, 진행 방향)에 방패 판
      const plate = new THREE.Mesh(shieldPlateGeo, shieldPlateMat);
      plate.position.set(0, 0.05, 0.55);
      plate.castShadow = true;
      m.add(plate);
    }
    const hpBonus = Math.floor((Math.max(1, wave.day) - 1) / CFG.HP_SCALE_EVERY) +
      (chapterCleared ? Math.max(0, wave.day - CFG.BOSS_DAY) * CFG.ENDLESS_HP_PER_DAY : 0);      // 무한 모드: 날마다 체력 추가 증가
    const hp = beast ? CFG.BEAST_HP : (boss ? CFG.BOSS_HP : brute ? CFG.BRUTE_HP : shield ? CFG.SHIELD_HP : siege ? CFG.SIEGE_HP : CFG.ENEMY_HP) + hpBonus;
    m.userData = {
      kind, brute, shield, siege, boss, throwCd: rand(1.5, 3), hp, maxHp: hp,
      dpsKey: boss ? 'boss' : brute ? 'brute' : 'normal', slamCd: 3, slamT: 0, baseY: 0.8 * sc, r: ENEMY_R * sc,
      speed: ENEMY_SPEED * (beast ? 1.35 : boss ? CFG.BOSS_SPEED_MUL : brute ? CFG.BRUTE_SPEED_MUL : shield ? CFG.SHIELD_SPEED_MUL : 1),
      contact: beast ? 6 : boss ? CFG.BOSS_CONTACT_DMG : brute ? CFG.BRUTE_CONTACT_DMG : CFG.ENEMY_CONTACT_DMG,
      kbMul: boss ? CFG.BOSS_KB_MUL : brute ? CFG.BRUTE_KNOCKBACK_MUL : 1, kbT: 0, kbVx: 0, kbVz: 0,
      fireTimer: 0, aggro: false, sinking: false, castT: 0, stunT: 0, lureT: 0, critT: 0, tele: null,
      anim: new Anim(rig), ex: !!at, px: m.position.x, pz: m.position.z, atkAnimCd: rand(0, 0.6) };
    if (boss) {                                       // 보스 머리 위 표시: 어그로 '!' / 기절 텍스트와 빙글 도는 별
      const bang = textSprite('!', '#ff2a1a', 0.5, 0.5, 'bold 96px sans-serif');
      bang.position.set(0, 1.25, 0); bang.visible = false; m.add(bang);
      const stunTxt = textSprite('STUNNED! ★', '#ffe14a', 1.1, 0.28, 'bold 48px sans-serif');
      stunTxt.position.set(0, 1.4, 0); stunTxt.visible = false; m.add(stunTxt);
      const stars = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), new THREE.MeshBasicMaterial({ color: 0xffe14a }));
        const a = i / 3 * Math.PI * 2; st.position.set(Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4); stars.add(st);
      }
      stars.position.y = 1.1; stars.visible = false; m.add(stars);
      Object.assign(m.userData, { bang, stunTxt, stars });
    }
    if (wave.type === 'storm' && !at) m.userData.speed *= 1.12;          // 폭풍우: 적이 조금 더 빠르다
    scene.add(m);
    enemies.push(m);
  }
  function textSprite(text, color, w, h, font) {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 128;
    const c = cv.getContext('2d');
    c.font = font; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 8; c.strokeStyle = 'rgba(0,0,0,.8)'; c.strokeText(text, 128, 64);
    c.fillStyle = color; c.fillText(text, 128, 64);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false, fog: false }));
    sp.scale.set(w, h, 1); sp.renderOrder = 12;
    return sp;
  }
  function removeEnemy(e) { if (e.userData.tele) scene.remove(e.userData.tele); scene.remove(e); enemies.splice(enemies.indexOf(e), 1); }
  function killEnemy(e) {                      // 즉시 사라지지 않고 쓰러지는 애니메이션을 보여 준 뒤 땅으로 꺼진다
    const u = e.userData;
    burst(e.position, u.boss ? 60 : 12);
    sfxAt(u.boss ? 'roar' : 'die', e.position.x, e.position.z); report.kills++;
    if (u.guardian && exActive) { makeChest(e.position.x, e.position.z, false); floatText('Guardian down! A chest appears', e.position.x, 3.2, e.position.z); shake = Math.max(shake, 0.5); }
    if (u.ex && Math.random() < 0.35) { res.iron++; updateHud(); floatText('Loot: Iron +1', e.position.x, 2.4, e.position.z); }
    if (wave.type === 'hunt' && Math.random() < 0.5) { res.food++; updateHud(); floatText('Loot: Food +1', e.position.x, 2.4, e.position.z); }
    if (wave.type === 'plunder' && Math.random() < 0.4) { res.iron++; updateHud(); floatText('Loot: Iron +1', e.position.x, 2.4, e.position.z); }
    hideTelegraph(e);
    u.sinking = true; u.dying = 1.0; e.position.y = u.baseY; u.anim.die();
    if (u.bang) u.bang.visible = u.stunTxt.visible = u.stars.visible = false;
    if (u.boss) onBossDefeated();
  }

  // 적에게 피해: 죽으면 true, 살아남으면 작은 파편 + 넉백 (무기 강화 시 더 멀리)
  const KB_TIME = 0.15;
  function hitEnemy(e, dmg, fromX, fromZ, strongKb = false, kbDist = null, byPlayer = false) {
    const u = e.userData;
    if (u.stunT > 0) {                                  // 기절한 보스: 모든 피해 2배 (크리티컬)
      dmg *= CFG.STUN_DMG_MULT;
      if (u.critT <= 0) { u.critT = 0.45; floatText('CRITICAL x2!', e.position.x, e.position.y + 5.2, e.position.z); }
    }
    if (byPlayer && u.boss) u.lureT = CFG.BOSS_LURE_TIME;      // 플레이어가 때리면 10초간 플레이어만 쫓는다
    u.hp -= dmg;
    sfxAt('hit', e.position.x, e.position.z);
    if (u.hp <= 0) { killEnemy(e); return true; }
    burst(e.position, 4);
    const dx = e.position.x - fromX, dz = e.position.z - fromZ, d = Math.hypot(dx, dz) || 1;
    const dist = (kbDist ?? (strongKb ? CFG.KNOCKBACK_UPGRADED : CFG.KNOCKBACK)) * u.kbMul;
    u.kbT = KB_TIME; u.kbVx = dx / d * dist / KB_TIME; u.kbVz = dz / d * dist / KB_TIME;
    return false;
  }

  // 부채꼴 판정(근접): (x,z)에서 ang 방향, 검 데미지만큼 피해 (플레이어·근접 동료 공통). 방패병도 정상 피해를 받는다.
  function sectorHit(x, z, ang, byPlayer = false, def = gearDef(playerGear.sword)) {
    const fx = Math.sin(ang), fz = Math.cos(ang);
    const range = ATK_RANGE * slashScale(def);
    let n = 0;
    for (const e of enemies.slice()) {
      if (e.userData.sinking) continue;
      const dx = e.position.x - x, dz = e.position.z - z;
      const d = Math.hypot(dx, dz);
      if (d > range + e.userData.r) continue;
      if (d < 0.9 || (dx * fx + dz * fz) / d > Math.cos(ATK_HALF)) { hitEnemy(e, def.dmg, x, z, def.tier > 0, null, byPlayer); n++; }
    }
    return n;
  }

  // 웨이브: 밤이 시작될 때 그날의 총 마릿수를 정하고 순차적으로 스폰. 브루트는 웨이브 마지막에 등장
  let chapterCleared = false;                // Day 7 보스 처치 후 true → 무한 모드
  const wave = { day: 0, remaining: 0, brutes: 0, siegeLeft: 0, bossLeft: 0 };
  // 밤의 종류 (조용한 밤만 변주): calm / fog(안개: 시야·사거리 감소) / plunder(약탈: 적이 더 많지만 철을 떨어뜨린다). 아침 요약과 상단 안내로 미리 알려 준다
  const NIGHT_PATTERN = ['calm', 'calm', 'fog', 'plunder', 'storm', 'fog', 'hunt', 'calm', 'plunder', 'storm', 'hunt', 'fog'];
  const NIGHT_INFO = { calm: ['Calm night', 'Beasts and a few raiders'], fog: ['Foggy night', 'Shorter sight for you and the archers'], plunder: ['Plunder night', 'More raiders, but they drop iron'], storm: ['Thunderstorm', 'Lightning flashes and raiders move faster'], hunt: ['Wolf hunt', 'A fast pack of beasts - they drop food'], raid: ['Blood Moon raid', 'A full assault'] };
  function nightTypeOf(d) {
    if (isRaid(d)) return 'raid';
    let q = 0;
    for (let i = 1; i <= d; i++) if (!isRaid(i)) q++;
    return NIGHT_PATTERN[(q - 1) % NIGHT_PATTERN.length];
  }
  const isRaid = (d) => d % CFG.RAID_EVERY === 0 || d === CFG.BOSS_DAY;       // 붉은 달 대규모 습격의 밤 (3, 6, 9 ... + 보스 밤)
  const nextRaidFrom = (d) => { while (!isRaid(d)) d++; return d; };
  let nightEase = false;
  function startWave(day) {
    wave.day = day;
    wave.quiet = !isRaid(day);
    wave.type = nightTypeOf(day);
    const extraRaiders = pendingRaiders; pendingRaiders = 0;
    const ease = nightEase ? 0.75 : 1; nightEase = false;                  // 정찰병의 경고에 대비했다면 오늘 밤 적이 25% 줄어든다               // 아침 이벤트 선택의 대가
    const threat = (1 + Math.max(0, prosScore - 40) / 120) * (story.beacon ? 0.85 : 1);                   // 번영한 마을일수록 약탈자가 더 많이 몰려온다 (번영도 70 → +25%)
    if (wave.quiet) {                          // 조용한 밤: 짐승 / 소수의 적만 - 문명 발전에 집중할 시간
      wave.remaining = day <= 2 ? CFG.QUIET_BASE + day : Math.min(CFG.QUIET_MAX, 2 + Math.floor(day / 2));
      if (wave.type === 'plunder') wave.remaining = Math.ceil(wave.remaining * 1.5) + 1;
      if (wave.type === 'hunt') wave.remaining = Math.ceil(wave.remaining * 1.6) + 1;
      if (wave.type === 'storm') wave.remaining = Math.ceil(wave.remaining * 1.2);
      wave.remaining = Math.ceil(wave.remaining * threat * ease) + extraRaiders;
      wave.brutes = 0; wave.siegeLeft = 0; wave.bossLeft = 0; spawnCd = 0;
      return;
    }
    wave.remaining = Math.ceil((CFG.WAVE_BASE + day * CFG.WAVE_PER_DAY) * threat * ease) + extraRaiders;
    wave.brutes = day >= CFG.BRUTE_FROM_DAY ? 1 + Math.floor((day - CFG.BRUTE_FROM_DAY) / 3) : 0;
    wave.siegeLeft = day >= CFG.SIEGE_FROM_DAY ? 1 + (Math.random() < 0.5 ? 1 : 0) : 0;      // Day 4부터 밤마다 공성 투척병 1~2마리
    if (day === CFG.BOSS_DAY) { wave.remaining = Math.ceil(wave.remaining / 2); wave.bossLeft = 1; }     // 보스 밤: 일반 적 절반 + 베헤모스 1마리
    if (chapterCleared && day > CFG.BOSS_DAY) wave.remaining += (day - CFG.BOSS_DAY) * CFG.ENDLESS_EXTRA_PER_DAY;   // 무한 모드 물량 증가
    spawnCd = 0;
  }
  function updateEnemies(dt, night, waveDay) {
    if (night && wave.day !== waveDay) startWave(waveDay);
    const nh = nowHour < 5 ? nowHour + 24 : nowHour;
    if (night && !dead && wave.bossLeft > 0 && nh >= CFG.BOSS_SPAWN_HOUR) {      // 보스는 밤이 시작되고 잠시 뒤 등장 (준비 시간)
      spawnEnemy('boss'); wave.bossLeft = 0;
      showWarning('The Behemoth has appeared!'); shake = Math.max(shake, 0.8);
    }
    if (night && !dead && (wave.remaining > 0 || wave.siegeLeft > 0)) {
      spawnCd -= dt;
      if (spawnCd <= 0 && enemies.length < CFG.MAX_ALIVE) {
        if (wave.siegeLeft > 0 && (wave.remaining === 0 || Math.random() < 0.25)) {
          spawnEnemy('siege'); wave.siegeLeft--;
        } else {
          const kind = wave.quiet ? (wave.type === 'hunt' ? 'beast' : wave.type === 'plunder' ? 'normal' : waveDay <= 2 || Math.random() < 0.6 ? 'beast' : 'normal')
            : wave.remaining <= wave.brutes ? 'brute'
            : (waveDay >= CFG.SHIELD_FROM_DAY && Math.random() < CFG.SHIELD_CHANCE ? 'shield' : 'normal');
          spawnEnemy(kind);
          wave.remaining--;
        }
        spawnCd = rand(0.8, 1.2) * Math.max(CFG.MIN_SPAWN_INTERVAL, CFG.SPAWN_INTERVAL_BASE / (1 + CFG.SPAWN_RATE_GROWTH * (waveDay - 1)));
      }
    }
    for (const e of enemies.slice()) {
      const u = e.userData, er = u.r;
      u.anim.update(dt);
      if (!night && !u.sinking && !u.boss && !u.ex) u.sinking = true;          // 아침: 땅으로 꺼짐 (보스는 처치할 때까지 남는다)
      if (u.sinking) {
        if (u.dying > 0) { u.dying -= dt; continue; }
        e.position.y -= dt * 0.8;
        if (e.position.y < -1.0) removeEnemy(e);
        continue;
      }
      if (dead) continue;
      if (u.ex) { exEnemyStep(e, u, dt); continue; }                    // 원정 지역의 적은 별도 AI

      // 기본 목표는 모닥불, 플레이어가 인식 거리 안이면 플레이어를 추적 (Aggro)
      const pd = Math.hypot(player.position.x - e.position.x, player.position.z - e.position.z);
      u.aggro = u.siege ? false : (u.boss && u.lureT > 0) ? true : (u.aggro ? pd < DEAGGRO : pd < AGGRO);      // 보스는 맞은 뒤 10초간 플레이어 고정      // 공성 투척병은 플레이어를 쫓지 않는다
      const tx = u.aggro ? player.position.x : 0, tz = u.aggro ? player.position.z : 0;
      e.lookAt(tx, e.position.y, tz);
      const dx = tx - e.position.x, dz = tz - e.position.z;
      const d = Math.hypot(dx, dz);
      let blocked = null;
      if (u.kbT > 0) {                       // 넉백 중에는 밀려남
        u.kbT -= dt;
        e.position.x += u.kbVx * dt; e.position.z += u.kbVz * dt;
      } else if (d > 0.8 && !(u.slamT > 0) && !(u.castT > 0) && !(u.stunT > 0) && !(u.siege && Math.hypot(e.position.x, e.position.z) <= CFG.SIEGE_STANDOFF)) {   // 투척병은 안전거리에서 멈춘다
        e.position.x += dx / d * u.speed * dt;
        e.position.z += dz / d * u.speed * dt;
      }
      // 장애물 충돌: 목책이면 멈추고 공격, 나머지는 비켜 감
      for (const o of obstacles) {
        const ox = e.position.x - o.position.x, oz = e.position.z - o.position.z;
        const min = o.userData.radius + er, od = Math.hypot(ox, oz);
        if (od < min && od > 1e-4) {
          e.position.x = o.position.x + ox / od * min;
          e.position.z = o.position.z + oz / od * min;
          if (o.userData.type === 'fence') blocked = o;
        }
      }
      if (blocked) {
        e.position.x += (Math.random() - .5) * 0.02;
        if (!(u.stunT > 0)) blocked.userData.hp -= CFG.STRUCT_DPS[u.dpsKey][blocked.userData.level === 'stone' ? 'stone' : 'wood'] * dt;   // 구조물 체력 감소
        if (blocked.userData.hp <= 0) collapseStructure(blocked);     // 파괴 시 청사진으로 되돌아간다
      }

      const mvd = Math.hypot(e.position.x - u.px, e.position.z - u.pz) / Math.max(dt, 1e-4);      // 이동 속도에 맞춰 걷기/대기, 장애물·플레이어 앞에서는 공격 모션
      u.px = e.position.x; u.pz = e.position.z; u.atkAnimCd -= dt;
      u.anim.base(u.kbT > 0 || mvd < 0.3 ? 'idle' : 'walk', mvd);
      if ((blocked || pd < PLAYER_R + er + 0.8) && u.atkAnimCd <= 0 && !(u.stunT > 0) && !u.siege) { u.atkAnimCd = 0.9; u.anim.once('attackSword'); }
      // 베헤모스 지진 강타: 캐스팅(1.5초, 붉게 깜빡 + 예고 링) → 점프 → 내려찍기. 캐스팅 중 궁극기에 맞으면 취소되고 기절
      if (u.boss) {
        u.slamCd -= dt; u.lureT -= dt; u.critT -= dt;
        u.bang.visible = u.lureT > 0 && !(u.stunT > 0);
        u.stunTxt.visible = u.stars.visible = u.stunT > 0;
        u.stars.rotation.y += dt * 5;
        if (u.stunT > 0) {
          u.stunT -= dt;
          if (u.stunT <= 0) bossRecover(e);
        } else if (u.slamT > 0) {
          u.slamT -= dt;
          e.position.y = u.baseY + Math.sin((1 - Math.max(u.slamT, 0) / CFG.BOSS_JUMP_TIME) * Math.PI) * 1.8;
          if (u.slamT <= 0) { e.position.y = u.baseY; spawnShockwave(e.position.x, e.position.z); }
        } else if (u.castT > 0) {
          u.castT -= dt;
          const pulse = 0.5 + 0.5 * Math.sin(u.castT * 24);
          if (e.material.emissive) { e.material.emissive.setHex(0xff2000); e.material.emissiveIntensity = 0.25 + 0.75 * pulse; }
          if (u.tele) u.tele.children.forEach(c => c.material.opacity = 0.15 + 0.25 * pulse);
          u.tele && u.tele.position.set(e.position.x, 0.1, e.position.z);
          if (u.castT <= 0) { hideTelegraph(e); u.slamT = CFG.BOSS_JUMP_TIME; }
        } else if (u.slamCd <= 0) { u.castT = CFG.BOSS_CAST_TIME; u.slamCd = CFG.BOSS_SLAM_INTERVAL; showTelegraph(e); }
      }

      // 공성 투척병: 안전거리에 도착하면 일정 간격으로 폭발 바위를 던진다
      if (u.siege && Math.hypot(e.position.x, e.position.z) <= CFG.SIEGE_STANDOFF + 1) {
        u.throwCd -= dt;
        if (u.throwCd <= 0) { u.throwCd = CFG.SIEGE_INTERVAL; throwRock(e); }
      }

      // 모닥불 공격: 도달 후 3초 유지되면 모닥불 소멸 → 패배
      if (fireAlive && Math.hypot(e.position.x, e.position.z) < FIRE_R + er + 0.3) {
        if (u.boss) {                                             // 보스: 즉사 대신 초당 피해, 오래 붙어 있으면 밀려난다
          if (!(u.stunT > 0)) {
            fireHp -= CFG.BOSS_FIRE_DPS * dt; u.fireTimer += dt;
            if (fireHp <= 0) destroyFire();
            else if (u.fireTimer >= CFG.BOSS_FIRE_BUMP_TIME) {
              u.fireTimer = 0;
              const l = Math.hypot(e.position.x, e.position.z) || 1, kd = CFG.BOSS_FIRE_BUMP_DIST / (KB_TIME * 2);
              u.kbT = KB_TIME * 2; u.kbVx = e.position.x / l * kd; u.kbVz = e.position.z / l * kd;
              shake = Math.max(shake, 0.4);
            }
          }
        } else {
          u.fireTimer += dt;
          if (u.fireTimer >= FIRE_BREAK_TIME) destroyFire();
        }
      } else u.fireTimer = 0;

      // 플레이어 / 동료와 접촉 시 피해
      if (pd < PLAYER_R + er + 0.15 && hurtCd <= 0 && !(u.stunT > 0)) { damage(u.contact); hurtCd = 0.8; shake = Math.max(shake, 0.15); }
      for (const n of npcs.slice()) {
        if (!n.down && n.hurtCd <= 0 && !(u.stunT > 0) && Math.hypot(n.position.x - e.position.x, n.position.z - e.position.z) < PLAYER_R + er) {
          damageNpc(n, u.contact); n.hurtCd = 0.8;
        }
      }
    }
    hurtCd -= dt;
    for (const n of npcs) n.hurtCd -= dt;
  }

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
  const workMul = (n) => (n.hungry ? CFG.HUNGER_MULT : 1) * (n.sick > 0 ? 0.6 : 1) * (TR(n).work || 1) * (n.mood >= CFG.MOOD_HAPPY ? 1.1 : n.mood < CFG.MOOD_UNHAPPY ? 0.8 : 1);
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
      + Math.max(-10, Math.min(15, (prosScore - 40) / 3)) + (n.stateNow === 'Resting' || n.stateNow === 'Lunch break' ? 6 : 0) + (hasPerk('steward') ? 5 : 0) + (story.beacon ? 6 : 0) + (story.dawn ? 4 : 0) + season().mood - (n.sick > 0 ? 10 : 0) - n.shock;
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
    npc = target;
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
  const freshReport = () => ({ left: [], kills: 0, lostCit: 0, wallsLost: 0, built: 0, upgraded: 0, newCit: 0, equipped: 0, forged: 0, ill: [], healed: [], season: '', camps: '', res: { ...res }, pros: prosScore, pop: 0 });
  let report = freshReport();
  const repEl = document.getElementById('report'), repList = document.getElementById('repList');
  let repTimer;
  function showReport(dayNo) {
    const r = report, rows = [], d = (k) => res[k] - r.res[k];
    rows.push(r.kills ? `Night: ${r.kills} raider${r.kills > 1 ? 's' : ''} defeated` : 'A quiet night');
    if (r.wallsLost || r.lostCit) rows.push(`Lost: ${[r.wallsLost ? `${r.wallsLost} wall${r.wallsLost > 1 ? 's' : ''}` : '', r.lostCit ? `${r.lostCit} citizen${r.lostCit > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ')}`);
    if (r.built || r.upgraded) rows.push(`Built: ${r.built} · Upgraded: ${r.upgraded}`);
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
          run: () => { if (res[l.g] < l.n) return 'Not enough to trade'; res[l.g] -= l.n; res[l.r] += get; updateHud(); report.traded = (report.traded || 0) + 1; setTimeout(() => merchantMenu(lots, rate, p), 450); return `Traded: +${get} ${MNAME[l.r]}`; } };
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
  const maxPop = () => CFG.BASE_POP + builtBuildings('house').length + builtBuildings('well').length + (hasPerk('steward') ? 1 : 0) + prosBonus;      // 거주지 1채당 최대 인구 +1, 번영도가 높으면 이주민 추가
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
      npc.stateLabel = 'Forging'; npc.forgeT = (npc.forgeT || 0) + wdt;
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

  // ---------- 출입구 경유지 길찾기 (사각형 성벽) ----------
  // 성벽을 사이에 두고 있으면 목표로 직진하지 않고, 가장 가까운 출입구를 임시 목표로 삼아 문 앞 → 문 뒤 순서로 통과한다.
  // 안/밖 판별은 중앙으로부터의 체비셰프 거리(cheb)와 각 성벽의 half 값을 비교한다.
  // 반환: 통과해야 하는 성벽의 half (없으면 null)
  function ringToCross(px, pz, tx, tz) {
    const rings = [...new Set(gateWaypoints.map(g => g.r))].sort((a, b) => a - b);
    if (!rings.length) return null;
    const dMe = cheb(px, pz), dT = cheb(tx, tz);
    const inward = dMe > dT;                                  // 안쪽으로 가면 바깥 성벽부터, 바깥쪽으로 가면 안쪽 성벽부터
    for (const R of (inward ? rings.slice().reverse() : rings)) {
      const meOut = dMe > R;
      const tgtOut = Math.abs(dT - R) < CFG.GATE_BAND ? meOut : dT > R;   // 성벽 위(청사진/목책)에 있는 목표는 같은 쪽으로 취급
      if (meOut !== tgtOut) return R;
    }
    return null;
  }
  function nearestGate(R) {
    let best = null, bd = Infinity;
    for (const g of gateWaypoints) {
      if (g.r !== R) continue;
      const dx = g.x - npc.position.x, dz = g.z - npc.position.z, d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = g; }
    }
    return best;
  }
  // 선분(P→Q)이 중앙 정사각형(half H)의 내부를 지나는지 (slab 검사)
  function segHitsBox(x0, z0, x1, z1, H) {
    let t0 = 0, t1 = 1;
    for (const [p, d] of [[x0, x1 - x0], [z0, z1 - z0]]) {
      if (Math.abs(d) < 1e-9) { if (Math.abs(p) > H) return false; continue; }
      let a = (-H - p) / d, b = (H - p) / d;
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
      if (t0 > t1) return false;
    }
    return true;
  }
  // 성벽 바깥에서 목표로 직진하면 성벽 안을 가로지르게 되므로, 성벽 바깥 궤도(모서리 지점)를 거쳐 돌아간다
  function aimPoint(px, pz, tx, tz) {
    const cP = cheb(px, pz), cQ = cheb(tx, tz);
    let R = 0;
    for (const g of gateWaypoints) if (cP > g.r + 1.5 && cQ > g.r - 0.5 && g.r > R) R = g.r;      // 둘 다 이 성벽 바깥쪽인 가장 큰 사각형
    if (!R) { npc.orbitTarget = -1; return [tx, tz]; }
    const H = cQ > R + 1.5 ? R + 1.2 : R - 1.0;                                                     // 성벽 위 목표는 내부만 피한다
    if (!segHitsBox(px, pz, tx, tz, H)) { npc.orbitDir = 0; npc.orbitTarget = -1; return [tx, tz]; }
    // 성벽 바깥 모서리 궤도를 따라 돈다: 향할 모서리(orbitTarget)를 정해 두고, 도착하면 회전 방향(orbitDir)의 인접 모서리로 이어서 이동
    const c = R + 2.5, corners = [[-c, -c], [c, -c], [c, c], [-c, c]];
    if (npc.orbitTarget >= 0 && npc.orbitTarget != null) {
      const [cx, cz] = corners[npc.orbitTarget];
      if (Math.hypot(cx - px, cz - pz) < 2.0) {
        if (!npc.orbitDir) {
          const f = corners[(npc.orbitTarget + 1) % 4], b = corners[(npc.orbitTarget + 3) % 4];
          npc.orbitDir = Math.hypot(tx - f[0], tz - f[1]) <= Math.hypot(tx - b[0], tz - b[1]) ? 1 : -1;
        }
        npc.orbitTarget = (npc.orbitTarget + npc.orbitDir + 4) % 4;
      }
      return corners[npc.orbitTarget];
    }
    npc.orbitDir = 0;
    let best = null, bd = Infinity;
    corners.forEach(([cx, cz], i) => {
      if (segHitsBox(px, pz, cx, cz, H)) return;                       // 성벽 안을 가로질러야 닿는 모서리는 제외 (인접 모서리만)
      const d = Math.hypot(cx - px, cz - pz) + Math.hypot(tx - cx, tz - cz);
      if (d < bd) { bd = d; best = [cx, cz]; npc.orbitTarget = i; }
    });
    return best || [tx, tz];
  }
  // 반환값은 최종 목적지까지의 (이동 전) 거리 - 호출부의 도착 판정에 그대로 쓰인다
  function npcMove(tx, tz, speed, dt) {
    // 끼임 감지: 5초 동안 거의 못 움직이면 stuckFlag를 세우고 살짝 밀어 준다 (호출한 쪽이 작업을 포기하도록)
    const nowMs = performance.now();
    if (!npc.sw || nowMs - npc.sw.last > 800) npc.sw = { x: npc.position.x, z: npc.position.z, t: 0, last: nowMs };
    npc.sw.t += dt; npc.sw.last = nowMs;
    if (npc.sw.t >= 6) {
      const mvd = Math.hypot(npc.position.x - npc.sw.x, npc.position.z - npc.sw.z);
      npc.sw = { x: npc.position.x, z: npc.position.z, t: 0, last: nowMs };
      if (!window.__nfNoFix && mvd < 2.5 && Math.hypot(tx - npc.position.x, tz - npc.position.z) > 2) { npc.stuckFlag = true; npc.position.x += rand(-1.6, 1.6); npc.position.z += rand(-1.6, 1.6); }
    }
    speed *= moveMul(npc);                                    // 굶주림·성격·기분이 이동 속도를 정한다
    // 끼임 방지: 거의 못 움직이면 잠깐 옆으로 비켜 걷는다
    const moved = Math.hypot(npc.position.x - (npc.prevX ?? npc.position.x), npc.position.z - (npc.prevZ ?? npc.position.z));
    npc.prevX = npc.position.x; npc.prevZ = npc.position.z;
    if (npc.nudgeT > 0) npc.nudgeT -= dt;
    else if (moved < speed * dt * 0.2 && Math.hypot(tx - npc.position.x, tz - npc.position.z) > 1.5) {
      npc.stuckT = (npc.stuckT || 0) + dt;
      if (npc.stuckT > 0.5) { npc.stuckT = 0; npc.nudgeT = 0.7; npc.nudgeDir = Math.random() < 0.5 ? 1 : -1; }
    } else npc.stuckT = 0;
    const dFinal = Math.hypot(tx - npc.position.x, tz - npc.position.z);
    const stepTo = (x, z) => { const [ax, az] = aimPoint(npc.position.x, npc.position.z, x, z); npcStep(ax, az, speed, dt); };

    // 이미 출입구 경유 중이면 계속 진행: [문 앞(approach), 문 뒤(exit)]
    if (npc.route) {
      if (npc.route.length === 2 && ringToCross(npc.position.x, npc.position.z, tx, tz) !== npc.routeRing) npc.route = null;   // 목적지가 바뀌어 더는 통과가 필요 없음
      else {
        const pt = npc.route[0];
        if (Math.hypot(pt.x - npc.position.x, pt.z - npc.position.z) < 1.3) {
          npc.route.shift();
          if (!npc.route.length) {                       // 경유 완료 → 해제하고 원래 목적지로 직진
            npc.graceRing = npc.routeRing; npc.graceT = CFG.GATE_GRACE; npc.route = null; npc.wp = null;
          }
        }
        if (npc.route) { stepTo(npc.route[0].x, npc.route[0].z); return dFinal; }
      }
    }
    const R = ringToCross(npc.position.x, npc.position.z, tx, tz);
    if (R !== null && !(npc.graceT > 0 && npc.graceRing === R)) {
      const g = npc.wp && npc.wp.r === R ? npc.wp : (npc.wp = nearestGate(R));        // 경유할 출입구는 한 번 정하면 유지
      if (g) {
        const pOut = cheb(npc.position.x, npc.position.z) > R, k = pOut ? 1 : -1;
        const A = { x: g.x + g.nx * 3 * k, z: g.z + g.nz * 3 * k }, B = { x: g.x - g.nx * 3 * k, z: g.z - g.nz * 3 * k };
        // 출입구 반경 2.0 이내면 문 앞 지점은 건너뛴다
        npc.route = Math.hypot(g.x - npc.position.x, g.z - npc.position.z) < CFG.GATE_REACH ? [B] : [A, B];
        npc.routeRing = R;
        stepTo(npc.route[0].x, npc.route[0].z);
        return dFinal;
      }
    } else npc.wp = null;
    stepTo(tx, tz);
    return dFinal;
  }
  // 목표 지점으로 한 걸음 이동 (장애물 밀어내기 포함, NPC끼리는 충돌하지 않으므로 출입구에서 서로 밀치지 않는다)
  function npcStep(tx, tz, speed, dt) {
    const dx = tx - npc.position.x, dz = tz - npc.position.z, d = Math.hypot(dx, dz);
    if (d > 0.05) {
      let mx = dx / d, mz = dz / d;
      if (npc.nudgeT > 0) { const t0 = mx; mx = -mz * npc.nudgeDir; mz = t0 * npc.nudgeDir; }   // 끼임 탈출: 목표의 수직 방향
      // 장애물을 정면으로 들이받지 않도록, 가까운 장애물 쪽 성분을 제거하고 옆으로 미끄러진다 (벽에 비비적거림 방지)
      for (const o of obstacles) {
        const ox = npc.position.x - o.position.x, oz = npc.position.z - o.position.z;
        const reach = o.userData.radius + PLAYER_R + 0.45, od = Math.hypot(ox, oz);
        if (od >= reach || od < 1e-4) continue;
        if (Math.abs(o.position.x - tx) < 0.3 && Math.abs(o.position.z - tz) < 0.3) continue;   // 목적지 자체(채집/수리 대상)는 피하지 않는다
        const nx = ox / od, nz = oz / od, into = mx * nx + mz * nz;
        if (into >= 0) continue;
        mx -= into * nx; mz -= into * nz;
        if (Math.hypot(mx, mz) < 0.3) {                       // 정면 충돌이면 목표 쪽으로 가까운 옆 방향 선택
          const side = (nx * mz - nz * mx) >= 0 ? 1 : -1;
          mx = -nz * side; mz = nx * side;
        }
      }
      const ml = Math.hypot(mx, mz) || 1;
      const step = Math.min(d, speed * dt);
      npc.position.x += mx / ml * step; npc.position.z += mz / ml * step;
      npc.face = Math.atan2(mx, mz);
      npc.rotation.y = npc.face;
    }
    for (const o of obstacles) {
      const ox = npc.position.x - o.position.x, oz = npc.position.z - o.position.z;
      const min = o.userData.radius + PLAYER_R, od = Math.hypot(ox, oz);
      if (od < min && od > 1e-4) { npc.position.x = o.position.x + ox / od * min; npc.position.z = o.position.z + oz / od * min; }
    }
    return d;
  }
  // 주간 작업 선택 (제곱거리 비교로 가장 가까운 대상을 O(n) 한 번에 탐색, 다른 동료가 점유한 대상은 제외)
  function nearestOf(list, pred) {
    let best = null, bd = Infinity;
    const nx = npc.position.x, nz = npc.position.z;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (!pred(o)) continue;
      const dx = o.position.x - nx, dz = o.position.z - nz, d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }
  const unclaimed = (o) => !(o.userData.skipUntil > gameMin) && (!o.userData.owner || o.userData.owner === npc || !npcs.includes(o.userData.owner));      // 도달할 수 없어 포기한 대상은 한동안 제외
  const reserved = { wood: 0, stone: 0 };       // 건설 담당이 이미 '예약'한 자원 (여럿이 같은 자원을 보고 동시에 건설하러 가지 않게)
  const bpCost = (b) => b.userData.cost ?? CFG.BP_COST[b.userData.res];
  function setTask(nt) {                       // 대상 점유(claim)/해제 + 건설 자원 예약
    if (npc.task) {
      npc.task.target.userData.owner = null;
      if (npc.task.kind === 'build') reserved[npc.task.target.userData.res] -= bpCost(npc.task.target);
    }
    npc.task = nt;
    if (nt) {
      nt.target.userData.owner = npc;
      if (nt.kind === 'build') reserved[nt.target.userData.res] += bpCost(nt.target);
    }
  }
  // 낮 작업 배분: 수리 > (채집조/건설조 분업). 자원이 부족하면 채집 담당을 먼저 정해 두고, 나머지는 '살 수 있는' 청사진만 지으러 간다
  function pickDayTask() {
    const damaged = nearestOf(obstacles, o => o.userData.type === 'fence' && o.userData.hp < o.userData.maxHp && unclaimed(o));
    if (damaged) return { kind: 'repair', target: damaged };
    const workers = npcs.filter(n => !n.down && !n.promote);
    const gatherers = workers.filter(n => n !== npc && n.task && n.task.kind === 'gather').length;
    const need = { wood: -res.wood, stone: -res.stone };                 // 청사진 전체 비용 - 보유량 = 부족분
    for (const b of blueprints) need[b.userData.res] += bpCost(b);
    const deficit = Math.max(0, need.wood) + Math.max(0, need.stone);
    let want = 0;
    const buffer = Math.max(0, res.wood - reserved.wood) + Math.max(0, res.stone - reserved.stone);       // 지금 바로 쓸 수 있는 여유 자원
    if (deficit > 0) want = workers.length <= 1 ? 0 : (deficit > CFG.GATHER_WORKERS_BIG_DEFICIT && buffer < CFG.GATHER_BUFFER ? Math.ceil(workers.length / 2) : 1);
    if (gatherers >= want) {                                              // 채집조가 충분 → 이 NPC는 건설 (예약 후에도 자원이 남는 청사진만)
      const bp = nearestOf(blueprints, b => unclaimed(b) && res[b.userData.res] - reserved[b.userData.res] >= bpCost(b));
      if (bp) return { kind: 'build', target: bp };
    }
    const wantType = need.wood >= need.stone ? (need.wood > 0 ? 'wood' : null) : (need.stone > 0 ? 'stone' : null);   // 가장 부족한 자원부터
    const isRes = (t) => t === 'wood' || t === 'stone';
    const r = (wantType && nearestOf(obstacles, o => o.userData.type === wantType && unclaimed(o))) ||
              nearestOf(obstacles, o => isRes(o.userData.type) && unclaimed(o));
    return r ? { kind: 'gather', target: r } : null;
  }
  function taskValid(tk) {
    if (tk.kind === 'build') return blueprints.includes(tk.target);
    if (!obstacles.includes(tk.target)) return false;
    return tk.kind !== 'repair' || tk.target.userData.hp < tk.target.userData.maxHp;
  }
  // 궁수 야간 AI: 모닥불 곁(안전지대)을 지키며 인식 거리 안의 가장 가까운 적에게 일정 간격으로 화살 발사 (돌진하지 않음)
  function soldierStrike(foe) {
    npc.atkCd = 0.8;
    const ang = Math.atan2(foe.position.x - npc.position.x, foe.position.z - npc.position.z), base = gearDef(npc.gear.sword);
    npc.anim.once('attackSword'); sfxAt('swing', npc.position.x, npc.position.z);
    spawnSlash(npc.position.x, npc.position.z, ang, base);
    sectorHit(npc.position.x, npc.position.z, ang, false, { ...base, dmg: base.dmg * soldierMult(npc) });
  }
  function soldierShoot(foe) {
    const ang = Math.atan2(foe.position.x - npc.position.x, foe.position.z - npc.position.z);
    npc.face = ang; npc.rotation.y = ang;
    if (npc.atkCd <= 0) { npc.atkCd = CFG.ARCHER_FIRE_INTERVAL; npc.anim.once('attackBow'); sfxAt('bow', npc.position.x, npc.position.z); fireArrow(npc.position.x, npc.position.z, ang, false, gearDef(npc.gear.bow).dmg * soldierMult(npc)); }
  }
  // 지휘 명령 'Follow': 병사들이 플레이어 곁에 모여 따라다니며, 플레이어 주변의 적을 함께 상대한다 (낮에도 일을 멈추고 따른다)
  function followStep(dt) {
    if (npc.task) { setTask(null); npc.workT = 0; }
    npc.hidden = false; npc.returning = false;
    let foe = null, bd = 16;
    for (const e of enemies) {
      if (e.userData.sinking || e.userData.siege) continue;
      const d = Math.hypot(e.position.x - player.position.x, e.position.z - player.position.z);
      if (d < bd) { bd = d; foe = e; }
    }
    const idx = npcs.filter(x => x.role !== 'citizen').indexOf(npc), a = idx * 2.4 + player.rotation.y, r = 2.6 + (idx % 2) * 0.9;
    if (foe) {
      if (npc.archer) {
        if (Math.hypot(foe.position.x - npc.position.x, foe.position.z - npc.position.z) <= CFG.ARCHER_AGGRO) { soldierShoot(foe); return 'Fighting'; }
      } else {
        const d = npcMove(foe.position.x, foe.position.z, 5.5, dt);
        if (d < 1.7 && npc.atkCd <= 0) soldierStrike(foe);
        return 'Fighting';
      }
    }
    const d = npcMove(player.position.x + Math.sin(a) * r, player.position.z + Math.cos(a) * r, 5.5, dt);
    if (d < 0.8) { npc.face = Math.atan2(player.position.x - npc.position.x, player.position.z - npc.position.z); npc.rotation.y = npc.face; }
    return 'Following';
  }
  function archerDefend(dt) {
    const rs = peaceful ? restSpot(npc, 'night') : null, hx = rs ? rs.x : npc.home.x, hz = rs ? rs.z : npc.home.z;
    if (Math.hypot(npc.position.x - hx, npc.position.z - hz) > 1.0) npcMove(hx, hz, 4.5, dt);
    let foe = null, bd = CFG.ARCHER_AGGRO * (fogNight ? 0.65 : 1);
    for (const e of enemies) {
      if (e.userData.sinking || e.userData.siege) continue;      // 공성 투척병은 궁수가 노릴 수 없다
      const d = Math.hypot(e.position.x - npc.position.x, e.position.z - npc.position.z);
      if (d < bd) { bd = d; foe = e; }
    }
    if (!foe) {
      if (peaceful && Math.hypot(npc.position.x - hx, npc.position.z - hz) < 1.0) { if (rs) faceTo(rs.fx, rs.fz); else faceFire(); return 'Resting'; }
      return 'Idle';
    }
    soldierShoot(foe);
    return 'Fighting';
  }
  // ---------- 9-2: 병사의 낮 순찰: 할 일이 없을 때 성벽 안쪽을 돌며 걷고, 해 질 녘(17시~)에는 문 앞 초소로 먼저 모인다 ----------
  function guardIdle(dt, hour) {
    if (hour >= 17) {
      const post = sentryPost(npc) || npc.home;
      if (npcMove(post.x, post.z, 3.5, dt) < 0.8) { faceTo(post.x * 2, post.z * 2); return 'On watch'; }
      return 'Taking posts';
    }
    const H = designTier > 0 ? CFG.DESIGN[designTier - 1].half - 3 : 7, i = npc.patrolI = npc.patrolI ?? (npcs.indexOf(npc) * 3) % 8;
    const P = [[1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]][i % 8], tx = P[0] * H, tz = P[1] * H;
    if (npc.patrolWait > 0) { npc.patrolWait -= dt; faceTo(tx * 2, tz * 2); return 'Patrolling'; }
    if (npcMove(tx, tz, 3.2, dt) < 1.3) { npc.patrolI = (i + 1) % 8; npc.patrolWait = 2 + Math.random() * 2; }
    return 'Patrolling';
  }
  function updateNpc(dt, hour, t) {
    if (dead) return;
    if (npc.escort) { escortStep(dt); return; }                       // 원정에 동행 중인 병사
    const isDay = hour >= 6 && hour < 18;
    if (npc.down) {
      if (isDay) reviveNpc(); else { setLabel('Down'); return; }
    }
    npc.atkCd -= dt;
    npc.graceT -= dt;
    let state = 'Idle';
    let bob = 0;
    if (isDay && npc.hidden) { npc.hidden = false; }                       // 아침: 웅크림 해제
    let busy = isDay && npc.promote ? (state = 'Training', promoteStep(dt)) : false;
    if (order === 'follow' && !exActive && npc.role !== 'citizen') { state = followStep(dt); busy = true; }       // 지휘 명령: 플레이어를 따른다
    if (!busy && isDay && gearFetchStep(dt)) { busy = true; state = 'Fetching gear'; }       // 병사: 대장간에서 새 장비 수령
    if (!busy && isDay && npc.role === 'citizen') { const rs = routineStep(dt, hour); if (rs) { busy = true; state = rs; } }
    if (!busy && isDay && npc.role === 'citizen' && workStep(dt)) { busy = true; state = npc.stateLabel; bob = npc.bobAmt; }      // 경제 건물에 정착한 시민

    if (busy) { /* 전직 훈련 이동 중 */ } else if (isDay) {
      // 주간 우선순위: 1) 수리  2) 건설(청사진)  3) 채집
      let task = npc.task;
      if (task && !taskValid(task)) { setTask(null); task = null; npc.workT = 0; }
      if (task) {                                                        // 워치독: 한 작업에 게임 시간 5시간(실제 약 30초) 넘게 매달리면 포기하고 그 대상은 잠시 제외
        task.startMin = task.startMin ?? gameMin;
        if (gameMin - task.startMin > 300) { task.target.userData.skipUntil = gameMin + 180; setTask(null); npc.workT = 0; task = null; }
      }
      npc.pickCd -= dt;
      if (!task && npc.pickCd <= 0) {          // 작업이 끝나거나 사라졌을 때만 새 작업 선택 (중간에 바꾸지 않아 갈팡질팡 방지)
        npc.pickCd = 0.3;
        const nt = pickDayTask();
        if (nt) { setTask(nt); task = nt; npc.workT = 0; }
      }
      if (task) {
        const o = task.target;
        state = { repair: 'Repairing', build: 'Building', gather: 'Gathering' }[task.kind];
        const stop = task.kind === 'build' ? (o.userData.stand ?? 1.2) : o.userData.radius + PLAYER_R + (task.kind === 'repair' ? 0.4 : 0.3);
        const d = Math.hypot(o.position.x - npc.position.x, o.position.z - npc.position.z);
        if (d > stop) { npcMove(o.position.x, o.position.z, 3.5, dt); npc.workT = 0; }
        else {
          npc.face = Math.atan2(o.position.x - npc.position.x, o.position.z - npc.position.z);
          npc.rotation.y = npc.face;
          if (task.kind === 'build' && npc.workT === 0 && res[o.userData.res] < (o.userData.cost ?? CFG.BP_COST[o.userData.res])) {
            // 도착했는데 나무가 부족하면 건설 보류, 즉시 채집으로 전환
            setTask(null);                       // (플레이어가 자원을 써 버린 경우) 건설 보류 → 다음 선택에서 채집으로 배정
          } else {
            npc.workT += dt * workMul(npc);       // 굶주림·성격·기분이 작업 효율을 정한다
            bob = 0;
            if (task.kind === 'build' && npc.workT >= (o.userData.buildTime ?? CFG.BUILD_TIME)) {
              const kind = o.userData.res, cost = o.userData.cost ?? CFG.BP_COST[kind];
              if (res[kind] >= cost) {
                res[kind] -= cost; updateHud();
                blueprints.splice(blueprints.indexOf(o), 1); scene.remove(o);
                if (o.userData.bkind) createBuilding(o.userData.bkind, o.position.x, o.position.z);
                else createStructure(kind, o.position.x, o.position.z, o.rotation.y);
                dust(o.position.x, o.position.z); sfxAt('build', o.position.x, o.position.z); report.built++;
              }
              setTask(null); npc.workT = 0;
            } else if (task.kind === 'repair' && npc.workT >= CFG.REPAIR_TIME) {
              o.userData.hp = o.userData.maxHp;
              dust(o.position.x, o.position.z);
              setTask(null); npc.workT = 0;
            } else if (task.kind === 'gather' && npc.workT >= CFG.GATHER_TIME) {
              const type = o.userData.type;
              scene.remove(o); obstacles.splice(obstacles.indexOf(o), 1);
              res[type] += gatherYield(type); rollIron(o); updateHud(); sfxAt('chop', o.position.x, o.position.z);
              setTask(null); npc.workT = 0;
            }
          }
        }
      } else if (npc.role !== 'citizen' && order !== 'follow') state = guardIdle(dt, hour);
      else npcMove(npc.home.x, npc.home.z, 3.5, dt);
    } else {
      // 야간: 모닥불 방어
      npc.target = null; npc.gatherT = 0; setTask(null); npc.workT = 0;
      if (npc.role === 'citizen') state = peaceful ? citizenRest(dt) : citizenHide(dt); else if (npc.archer) state = archerDefend(dt); else {
      let foe = null, bd = CFG.MELEE_AGGRO;      // 성벽 밖까지 인식 → npcMove의 출입구 경유 길찾기로 밖에 나가 싸우고, 끝나면 문으로 복귀
      for (const e of enemies) {
        if (e.userData.sinking || e.userData.siege) continue;
        const d = Math.hypot(e.position.x - npc.position.x, e.position.z - npc.position.z);
        if (d < bd) { bd = d; foe = e; }
      }
      if (npc.returning || !foe) {
        const post = sentryPost(npc), rs = peaceful && !post ? restSpot(npc, 'night') : null, tgt = post || rs || npc.home;
        if (npcMove(tgt.x, tgt.z, 5, dt) < 0.8) { npc.returning = false; if (post) { state = 'Guarding'; npc.face = Math.atan2(-post.x, -post.z) + Math.PI; npc.rotation.y = npc.face; } else if (peaceful) { state = 'Resting'; if (rs) faceTo(rs.fx, rs.fz); else faceFire(); } }      // 성문 경비는 문 앞에 서고, 나머지는 평화로운 밤에 모닥불 곁에 앉아 쉰다
      } else {
        state = 'Fighting';
        const d = npcMove(foe.position.x, foe.position.z, 5.5, dt);
        if (d < 1.7 && npc.atkCd <= 0) {
          soldierStrike(foe);
          if (!enemies.includes(foe)) npc.returning = true;     // 처치했으면 모닥불로 복귀
        }
      }
      }
    }
    // 애니메이션 상태 머신: 실제 이동 속도 + 현재 행동으로 Idle / Walk / Run / Gather / Sit 을 고른다 (전환은 CrossFade)
    const mv = Math.hypot(npc.position.x - npc.px, npc.position.z - npc.pz) / Math.max(dt, 1e-4);
    npc.px = npc.position.x; npc.pz = npc.position.z;
    const working = state === 'Gathering' || state === 'Building' || state === 'Repairing' || state === 'Chopping' || state === 'Quarrying' || state === 'Farming';
    let anim = mv > 4.4 ? 'run' : mv > 0.5 ? 'walk' : 'idle';
    if ((state === 'Resting' || state === 'Lunch break') && mv < 0.5) anim = 'sit'; else if ((working || state === 'Drawing water') && mv < 0.8) anim = 'gather';
    npc.anim.base(anim, mv);
    const bs = npc.rig.baseScale;
    npc.body.scale.set(bs, bs * (npc.hidden ? 0.55 : 1), bs);                // 숨은 시민은 웅크린다
    if (npc.stuckFlag) {                                                   // 끼인 NPC: 지금 목표를 한동안 포기하고 다른 일을 고른다
      npc.stuckFlag = false;
      if (npc.task) { npc.task.target.userData.skipUntil = gameMin + 180; setTask(null); npc.workT = 0; }
      if (npc.wtarget) { npc.wtarget.userData.skipUntil = gameMin + 180; npc.wtarget = null; }
      if (npc.promote) npc.promote = npc.promote;
      if (npc.patrolI != null) npc.patrolI = (npc.patrolI + 1) % 8;
    }
    npc.stateNow = state;
    setLabel(state);
  }

  // ---------- 플레이어 공격 ----------
  let atkT = 0, atkCd = 0, shake = 0;
  function attack() {
    if (dead || atkCd > 0) return;
    atkCd = ATK_CD;
    gathering = null;
    if (weaponMode === 'bow') {
      shake = Math.max(shake, 0.08);
      playerAnim.once('attackBow'); Snd.play('bow');
      fireArrow(player.position.x, player.position.z, facing, true, gearDef(playerGear.bow).dmg * pDmg());
      return;
    }
    atkT = SLASH_LIFE; shake = 0.3;
    playerAnim.once('attackSword'); Snd.play('swing');
    spawnSlash(player.position.x, player.position.z, facing);
    // 광역(Cleave): 부채꼴 안의 모든 적이 동시에 피해와 넉백을 받는다
    const hits = sectorHit(player.position.x, player.position.z, facing, true, { ...gearDef(playerGear.sword), dmg: gearDef(playerGear.sword).dmg * pDmg() });
    if (hits >= 2) {
      shake = Math.min(0.7, 0.3 + hits * 0.06);
      floatText(`CLEAVE x${hits}!`, player.position.x + Math.sin(facing) * 2, 2.6, player.position.z + Math.cos(facing) * 2);
    }
  }

  // ---------- 무기 교체 / 화살 ----------
  function swapWeapon() {
    if (dead) return;
    weaponMode = weaponMode === 'sword' ? 'bow' : 'sword';
    playerRig.main = weaponMode;
    document.getElementById('swapCur').textContent = `Q · Current: ${weaponMode === 'bow' ? 'Bow' : 'Sword'}`;
    toast(weaponMode === 'bow' ? 'Bow equipped (ranged)' : 'Sword equipped (melee)');
  }
  // 화살은 아군 구조물(obstacles)과 충돌 검사를 하지 않으므로 목책/성벽을 그대로 통과한다 (one-way wall).
  const arrows = [];
  const arrowGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.9, 6);
  const arrowMat = new THREE.MeshBasicMaterial({ color: 0x8a5a2b });
  function fireArrow(x, z, ang, byPlayer = false, dmg = null, y = 1.0) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(arrowGeo, arrowMat);
    m.rotation.x = Math.PI / 2;                     // 원기둥 축을 진행(+Z) 방향으로 눕힘
    g.add(m);
    const sx = Math.sin(ang), sz = Math.cos(ang);
    g.position.set(x + sx * 0.7, y, z + sz * 0.7);
    g.rotation.y = ang;
    g.userData = { vx: sx * CFG.ARROW_SPEED, vz: sz * CFG.ARROW_SPEED, dist: 0, byPlayer, dmg };
    scene.add(g);
    arrows.push(g);
  }
  // 떠오르는 텍스트 (방패병 면역 표시)
  const floaters = [], floatTex = new Map();
  function floatText(text, x, y, z) {
    let tex = floatTex.get(text);
    if (!tex) {
      const cv = document.createElement('canvas');
      cv.width = 256; cv.height = 64;
      const c = cv.getContext('2d');
      c.font = 'bold 30px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 5; c.strokeStyle = 'rgba(0,0,0,.7)'; c.strokeText(text, 128, 32);
      c.fillStyle = '#c9ced6'; c.fillText(text, 128, 32);
      tex = new THREE.CanvasTexture(cv);
      floatTex.set(text, tex);
    }
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, fog: false, depthTest: false }));
    sp.scale.set(1.6, 0.4, 1);
    sp.position.set(x, y, z);
    sp.userData = { life: 0.9 };
    scene.add(sp);
    floaters.push(sp);
  }
  function updateFloaters(dt) {
    for (const f of floaters.slice()) {
      f.userData.life -= dt;
      f.position.y += dt * 1.1;
      f.material.opacity = Math.max(0, Math.min(1, f.userData.life / 0.4));
      if (f.userData.life <= 0) { scene.remove(f); f.material.dispose(); floaters.splice(floaters.indexOf(f), 1); }
    }
  }
  function updateArrows(dt) {
    for (const a of arrows.slice()) {
      const u = a.userData;
      const x0 = a.position.x, z0 = a.position.z;
      const dx = u.vx * dt, dz = u.vz * dt, len = Math.hypot(dx, dz);
      // 이번 프레임 이동 구간(선분)과 가장 먼저 만나는 적을 찾는다 (빠른 화살의 터널링 방지)
      let hit = null, bestT = Infinity;
      for (const e of enemies) {
        if (e.userData.sinking) continue;
        const ex = e.position.x - x0, ez = e.position.z - z0;
        const t = Math.max(0, Math.min(1, (ex * dx + ez * dz) / (len * len)));
        const px = ex - dx * t, pz = ez - dz * t;
        if (px * px + pz * pz < (e.userData.r + 0.15) ** 2 && t < bestT) { bestT = t; hit = e; }
      }
      if (hit) {
        if (hit.userData.shield) floatText('Immune', hit.position.x, hit.position.y + 1.6, hit.position.z);   // 방패병: 화살 면역
        else hitEnemy(hit, u.dmg ?? CFG.BOW_DMG, x0, z0, false, null, u.byPlayer);    // 활 데미지는 고정(무기 강화 영향 없음)
        scene.remove(a); arrows.splice(arrows.indexOf(a), 1);
        continue;
      }
      a.position.x += dx; a.position.z += dz;
      u.dist += len;
      if (u.dist >= CFG.ARROW_RANGE) { scene.remove(a); arrows.splice(arrows.indexOf(a), 1); }   // 사거리 초과 시 소멸
    }
  }

  // ---------- 구조물 파괴 → 청사진 복귀 ----------
  function collapseStructure(o) {
    const i = obstacles.indexOf(o);
    if (i < 0) return;
    obstacles.splice(i, 1); report.wallsLost++;
    scene.remove(o);
    addBlueprint(o.userData.level === 'stone' ? 'stone' : 'wood', o.position.x, o.position.z, o.rotation.y);   // 같은 위치·회전의 반투명 청사진 (충돌 없음)
    dust(o.position.x, o.position.z);
  }
  function damageStructure(o, dmg) {
    o.userData.hp -= dmg;
    if (o.userData.hp <= 0) collapseStructure(o);
  }

  // ---------- 공성 투척병의 폭발 바위 (곡사) ----------
  const rocks = [];
  const rockGeo = new THREE.SphereGeometry(0.55, 12, 10);
  const rockMatBlack = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.5 });
  const markGeo = new THREE.RingGeometry(CFG.ROCK_SPLASH - 0.3, CFG.ROCK_SPLASH, 32);
  const boomGeo = new THREE.CircleGeometry(CFG.ROCK_SPLASH, 28);
  const ROCK_G = 16;
  function throwRock(e) {
    e.userData.anim.once('attackSword');
    // 조준: 가장 가까운 구조물, 없으면 모닥불
    let tx = 0, tz = 0, bd = Infinity;
    for (const o of obstacles) {
      if (o.userData.type !== 'fence') continue;
      const d = (o.position.x - e.position.x) ** 2 + (o.position.z - e.position.z) ** 2;
      if (d < bd) { bd = d; tx = o.position.x; tz = o.position.z; }
    }
    tx += rand(-1.5, 1.5); tz += rand(-1.5, 1.5);
    const sx = e.position.x, sz = e.position.z, y0 = 2.4;
    const T = Math.max(1.4, Math.hypot(tx - sx, tz - sz) / CFG.ROCK_FLIGHT_SPEED);   // 체공 시간
    const m = new THREE.Mesh(rockGeo, rockMatBlack);
    m.position.set(sx, y0, sz);
    m.castShadow = true;
    const mark = new THREE.Mesh(markGeo, new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
    mark.rotation.x = -Math.PI / 2; mark.position.set(tx, 0.06, tz);      // 낙하 지점 경고 (대시로 피할 수 있다)
    m.userData = { vx: (tx - sx) / T, vz: (tz - sz) / T, vy: (0.5 * ROCK_G * T * T - y0) / T, t: 0, T, tx, tz, mark };
    scene.add(m, mark);
    rocks.push(m);
  }
  function explodeRock(r) {
    const { tx, tz, mark } = r.userData;
    const x = r.position.x, z = r.position.z;
    scene.remove(r); scene.remove(mark); mark.material.dispose();
    rocks.splice(rocks.indexOf(r), 1);
    burst({ x, z }, 30);                                                  // 붉은 폭발 파티클
    const g = new THREE.Group();                                          // 폭발 범위 섬광
    const f = new THREE.Mesh(boomGeo, new THREE.MeshBasicMaterial({ color: 0xff3b1a, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }));
    f.rotation.x = -Math.PI / 2; g.add(f); g.position.set(x, 0.1, z); g.userData.life = SLASH_LIFE * 1.5;
    scene.add(g); slashes.push(g);
    if (Math.hypot(player.position.x - x, player.position.z - z) < 25) shake = Math.max(shake, 0.4);
    for (const o of obstacles.slice()) {                                  // 광역 피해: 반경 내 모든 구조물 체력 -50
      if (o.userData.type === 'fence' && Math.hypot(o.position.x - x, o.position.z - z) < CFG.ROCK_SPLASH) damageStructure(o, CFG.ROCK_DAMAGE);
    }
    if (fireAlive && Math.hypot(x, z) < CFG.ROCK_SPLASH + FIRE_R) {       // 모닥불 직격
      fireHp -= CFG.ROCK_DAMAGE;
      toast('The campfire was hit by a siege boulder!');
      if (fireHp <= 0) destroyFire();
    }
  }
  function updateRocks(dt) {
    for (const r of rocks.slice()) {
      const u = r.userData;
      u.t += dt; u.vy -= ROCK_G * dt;
      r.position.x += u.vx * dt; r.position.z += u.vz * dt; r.position.y += u.vy * dt;
      u.mark.material.opacity = 0.35 + 0.25 * Math.sin(u.t * 14);
      if (u.t >= u.T || r.position.y <= 0.3) explodeRock(r);               // 땅에 닿으면 폭발
    }
  }

  // ---------- 대시 (무적 포함) ----------
  let dashT = 0, dashCd = 0, invincibleT = 0, dashDX = 0, dashDZ = 0;
  function dash() {
    if (dead || dashCd > 0 || dashT > 0) return;
    dashDX = Math.sin(facing); dashDZ = Math.cos(facing);
    dashT = CFG.DASH_TIME; dashCd = CFG.DASH_CD * dashMul(); invincibleT = CFG.DASH_INVULN; Snd.play('dash');
    dust(player.position.x, player.position.z);
  }
  const barBg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthTest: false, fog: false }));
  const barFill = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x7fd4ff, transparent: true, opacity: 0.6, depthTest: false, fog: false }));
  barBg.scale.set(1.3, 0.14, 1); barFill.center.set(0, 0.5);
  barBg.renderOrder = barFill.renderOrder = 10;
  barBg.visible = barFill.visible = false;
  scene.add(barBg, barFill);
  const gBg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthTest: false, fog: false }));
  const gFill = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffe08a, transparent: true, opacity: 0.6, depthTest: false, fog: false }));
  gBg.scale.set(1.3, 0.14, 1); gFill.center.set(0, 0.5);
  gBg.renderOrder = gFill.renderOrder = 10;
  gBg.visible = gFill.visible = false;
  scene.add(gBg, gFill);
  function updateGather(dt, moving) {
    if (!gathering) { gBg.visible = gFill.visible = false; return; }
    const g = gathering, o = g.target;
    const gone = !(exActive && exObjs.includes(o)) && !obstacles.includes(o) || Math.hypot(o.position.x - player.position.x, o.position.z - player.position.z) - o.userData.radius > GATHER_RANGE + 1;
    if (dead || moving || gone) {
      if (moving && !gone) toast('Gathering cancelled');
      gathering = null; gBg.visible = gFill.visible = false; return;
    }
    g.t += dt;
    facing = Math.atan2(o.position.x - player.position.x, o.position.z - player.position.z); player.rotation.y = facing;
    const prog = Math.min(1, g.t / CFG.PLAYER_GATHER_TIME), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    gBg.visible = gFill.visible = true;
    gBg.position.set(player.position.x, 0.02, player.position.z);
    gFill.position.set(player.position.x - rx * 0.65, 0.02, player.position.z - rz * 0.65);
    gFill.scale.set(Math.max(0.001, 1.3 * prog), 0.14, 1);
    if (g.t >= CFG.PLAYER_GATHER_TIME) {
      scene.remove(o);
      if (o.userData.type === 'chest') { exObjs.splice(exObjs.indexOf(o), 1); openChest(o); }
      else {
        const pool = exObjs.includes(o) ? exObjs : obstacles; pool.splice(pool.indexOf(o), 1);
        res[o.userData.type] += gatherYield(o.userData.type); rollIron(o); Snd.play('chop');
        if (o.userData.ore) { const k = 2 + Math.floor(Math.random() * 3); res.iron += k; floatText(`Ore: Iron +${k}`, o.position.x, 2.4, o.position.z); }
      }
      updateHud();
      gathering = null; gBg.visible = gFill.visible = false;
    }
  }

  // ---------- 궁극기: 회전 강타 ----------
  let ultCd = 0;
  const ultBtnEl = document.getElementById('ultBtn'), ultCdEl = document.getElementById('ultCd');
  const ultGeo = new THREE.CircleGeometry(CFG.ULT_RADIUS, 40);
  function rally() {                                                  // 지휘형의 궁극기: 병사들 회복 + 8초간 공격력 +50%
    ultCd = CFG.RALLY_CD * (hasPerk('warlord') ? 0.7 : 1); rallyT = CFG.RALLY_TIME; Snd.play('horn'); shake = Math.max(shake, 0.3);
    const g = new THREE.Group();
    const m = new THREE.Mesh(ultGeo, new THREE.MeshBasicMaterial({ color: 0x8affc0, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.scale.setScalar(CFG.RALLY_RADIUS / CFG.ULT_RADIUS); g.add(m);
    g.position.set(player.position.x, 0.12, player.position.z); g.userData.life = 0.45; scene.add(g); slashes.push(g);
    let k = 0;
    for (const n of npcs) {
      if (n.role === 'citizen' || n.down || Math.hypot(n.position.x - player.position.x, n.position.z - player.position.z) > CFG.RALLY_RADIUS) continue;
      n.hp = Math.min(n.maxHp, n.hp + Math.round(n.maxHp * 0.3)); k++; floatText('Rally!', n.position.x, 3.0, n.position.z);
    }
    toast(`Rally Cry! ${k} soldier${k === 1 ? '' : 's'} fight harder for ${CFG.RALLY_TIME}s`);
  }
  function ultimate() {
    if (dead || ultCd > 0) return;
    if (playerClass === 'commander') return rally();
    ultCd = CFG.ULT_CD * (playerClass === 'warrior' ? 0.8 : 1) * (hasPerk('warlord') ? 0.7 : 1); Snd.play('ult');
    gathering = null;
    const g = new THREE.Group();                                     // 360도 원반형 검기
    const m = new THREE.Mesh(ultGeo, new THREE.MeshBasicMaterial({ color: 0xffd54a, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; g.add(m);
    g.position.set(player.position.x, 0.12, player.position.z); g.userData.life = 0.3;
    scene.add(g); slashes.push(g);
    shake = 0.7;
    let n = 0;
    for (const e of enemies.slice()) {                               // 반경 내 모든 적: 방패병 포함(검 피해는 방패 무시), 강한 넉백
      if (e.userData.sinking) continue;
      if (Math.hypot(e.position.x - player.position.x, e.position.z - player.position.z) < CFG.ULT_RADIUS + e.userData.r) {
        const wasCasting = e.userData.castT > 0;
        hitEnemy(e, CFG.ULT_DAMAGE * pDmg(), player.position.x, player.position.z, true, CFG.ULT_KB, true); n++;
        if (wasCasting && enemies.includes(e)) stunBoss(e);          // 캐스팅 중 궁극기 적중 → 지진 취소 + 기절
      }
    }
    if (n) floatText(`WHIRLWIND x${n}!`, player.position.x, 2.8, player.position.z);
  }

  // ---------- 베헤모스: 예고 링 / 기절 ----------
  const teleDiscGeo = new THREE.CircleGeometry(5, 32), teleRingGeo = new THREE.RingGeometry(0.985, 1, 64);
  function showTelegraph(e) {
    const u = e.userData;
    if (u.tele) return;
    const g = new THREE.Group();
    const mk = (geo) => new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }));
    const disc = mk(teleDiscGeo), ring = mk(teleRingGeo);
    ring.scale.set(CFG.QUAKE_MAX, CFG.QUAKE_MAX, 1);
    disc.rotation.x = ring.rotation.x = -Math.PI / 2;
    g.add(disc, ring); g.position.set(e.position.x, 0.1, e.position.z);
    scene.add(g); u.tele = g;
  }
  function hideTelegraph(e) { const u = e.userData; if (u.tele) { scene.remove(u.tele); u.tele = null; } }
  function resetBossLook(e) { if (e.material.emissive) { e.material.emissive.setHex(0x000000); e.material.emissiveIntensity = 0; } e.material.color.setHex(0x0b0b0e); }
  function stunBoss(e) {
    const u = e.userData;
    u.castT = 0; u.slamT = 0; hideTelegraph(e);
    u.stunT = CFG.BOSS_STUN_TIME; u.slamCd = CFG.BOSS_SLAM_INTERVAL;
    e.position.y = u.baseY;
    if (e.material.emissive) { e.material.emissive.setHex(0x000000); e.material.emissiveIntensity = 0; }
    e.material.color.setHex(0x8a8a92);                                           // 기절: 회색
    floatText('COUNTER! STUNNED!', e.position.x, e.position.y + 5.8, e.position.z);
    shake = Math.max(shake, 0.6);
  }
  function bossRecover(e) { resetBossLook(e); e.userData.slamCd = 2; }

  // ---------- 베헤모스 충격파 (지진 강타) ----------
  const shocks = [];
  const shockGeo = new THREE.RingGeometry(0.92, 1, 64);
  function shoveNpc(n, ux, uz, dist) {
    n.position.x += ux * dist; n.position.z += uz * dist;
    for (const o of obstacles) {
      const ox = n.position.x - o.position.x, oz = n.position.z - o.position.z, min = o.userData.radius + PLAYER_R, od = Math.hypot(ox, oz);
      if (od < min && od > 1e-4) { n.position.x = o.position.x + ox / od * min; n.position.z = o.position.z + oz / od * min; }
    }
    n.position.x = Math.max(-MAP + 1, Math.min(MAP - 1, n.position.x)); n.position.z = Math.max(-MAP + 1, Math.min(MAP - 1, n.position.z));
  }
  function spawnShockwave(x, z) {
    const m = new THREE.Mesh(shockGeo, new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.15, z); m.scale.set(0.1, 0.1, 1); sfxAt('boom', x, z);
    scene.add(m);
    shocks.push({ m, x, z, r: 0, hit: new Set() });
    burst({ x, z }, 24);
    if (Math.hypot(player.position.x - x, player.position.z - z) < 35) shake = Math.max(shake, 0.9);
  }
  function updateShocks(dt) {
    for (const s of shocks.slice()) {
      s.r += CFG.QUAKE_SPEED * dt;
      s.m.scale.set(s.r, s.r, 1);
      s.m.material.opacity = 0.8 * Math.max(0, 1 - s.r / CFG.QUAKE_MAX);
      const reach = (px, pz, pad = 0) => Math.hypot(px - s.x, pz - s.z) <= s.r + pad;
      for (const o of obstacles.slice()) {                                   // 충격파에 닿는 구조물: 거리가 멀수록 피해가 줄어든다
        if (o.userData.type === 'fence' && !s.hit.has(o) && reach(o.position.x, o.position.z)) {
          s.hit.add(o);
          const dd = Math.hypot(o.position.x - s.x, o.position.z - s.z);
          damageStructure(o, CFG.QUAKE_STRUCT_DMG * (1 - CFG.QUAKE_FALLOFF * Math.min(1, dd / CFG.QUAKE_MAX)));
        }
      }
      if (fireAlive && !s.hit.has('fire') && reach(0, 0)) { s.hit.add('fire'); fireHp -= CFG.QUAKE_FIRE_DMG; if (fireHp <= 0) destroyFire(); }
      for (const n of npcs.slice()) {                                       // 동료/시민: 피해는 거의 없이 넉백만 (벽/건물/맵 밖으로 날아가지 않게 보정)
        if (n.down || s.hit.has(n) || !reach(n.position.x, n.position.z)) continue;
        s.hit.add(n);
        const dx = n.position.x - s.x, dz = n.position.z - s.z, d = Math.hypot(dx, dz) || 1;
        shoveNpc(n, dx / d, dz / d, CFG.QUAKE_NPC_KB);
        damageNpc(n, CFG.QUAKE_NPC_DMG);
      }
      if (!s.hit.has('player') && reach(player.position.x, player.position.z)) {
        s.hit.add('player');
        if (invincibleT <= 0) {                                              // 대시 무적이면 회피
          const dx = player.position.x - s.x, dz = player.position.z - s.z, d = Math.hypot(dx, dz) || 1;
          player.position.x += dx / d * CFG.QUAKE_KB; player.position.z += dz / d * CFG.QUAKE_KB;
          damage(CFG.QUAKE_PLAYER_DMG); shake = Math.max(shake, 0.6);
        }
      }
      if (s.r >= CFG.QUAKE_MAX) { scene.remove(s.m); s.m.material.dispose(); shocks.splice(shocks.indexOf(s), 1); }
    }
  }

  // ---------- 1장 클리어 → 무한 모드 ----------
  const clearEl = document.getElementById('clear');
  function onBossDefeated() {
    if (chapterCleared) return;
    chapterCleared = true;
    clearEl.classList.add('show'); setTimeout(() => clearEl.classList.remove('show'), 6000);
    for (const e of enemies.slice()) { if (e.userData.dying > 0) continue; burst(e.position, 6); removeEnemy(e); }       // 살아있는 모든 적 소멸
    for (const r of rocks.slice()) { scene.remove(r); scene.remove(r.userData.mark); rocks.splice(rocks.indexOf(r), 1); }
    wave.remaining = 0; wave.siegeLeft = 0; wave.bossLeft = 0;
    // 강제로 다음 아침(06:00)으로
    const dayIdx = Math.floor(gameMin / 1440), hourNow = (gameMin / 60) % 24;
    gameMin = (hourNow >= 6 ? dayIdx + 1 : dayIdx) * 1440 + 360;
    toast('Endless Mode begins - enemies grow stronger from Day 8');
  }

  const dashBtnEl = document.getElementById('dashBtn');
  function updateDash(dt) {
    dashCd = Math.max(0, dashCd - dt); invincibleT = Math.max(0, invincibleT - dt);
    bodyMat.transparent = true; bodyMat.opacity = invincibleT > 0 ? 0.45 : 1;       // 무적 중 반투명
    playerRig.root.rotation.x = dashT > 0 ? 0.35 : 0;
    // 쿨타임 게이지 (캐릭터 발밑, 카메라 기준 좌→우로 차오름)
    const show = dashCd > 0;
    barBg.visible = barFill.visible = show;
    if (show) {
      const prog = 1 - dashCd / (CFG.DASH_CD * dashMul()), rx = Math.cos(yaw), rz = -Math.sin(yaw);
      barBg.position.set(player.position.x, 0.25, player.position.z);
      barFill.position.set(player.position.x - rx * 0.65, 0.25, player.position.z - rz * 0.65);
      barFill.scale.set(Math.max(0.001, 1.3 * prog), 0.14, 1);
    }
    dashBtnEl.classList.toggle('cool', show);
    ultCd = Math.max(0, ultCd - dt);
    ultBtnEl.classList.toggle('cool', ultCd > 0);
    ultCdEl.textContent = ultCd > 0 ? `${Math.ceil(ultCd)}s` : 'E';
    const boss = enemies.find(e => e.userData.boss && !(e.userData.dying > 0));          // 보스 체력 바
    bossBarEl.style.display = boss ? 'block' : 'none';
    if (boss) bossFillEl.style.width = `${Math.max(0, boss.userData.hp / boss.userData.maxHp * 100)}%`;
  }
  const bossBarEl = document.getElementById('bossBar'), bossFillEl = document.getElementById('bossFill');

  // ---------- 체크포인트: 매일 아침 자동 저장 → 게임 오버 때 그날(또는 이전) 아침으로 되돌아가기 ----------
  const checkpoints = [];            // { day, label, snap } - 최근 4개
  function makeSnapshot() {
    const pos = (o) => ({ x: o.position.x, z: o.position.z });
    const res_ = (o) => o.userData.type === 'wood' || o.userData.type === 'stone';
    return {
      gameMin, res: { ...res }, story: JSON.parse(JSON.stringify(story)), playerClass, perks: { ...perks }, order, playerGear: { ...playerGear }, weaponMode, hp, fireHp, designTier, townStage, age, chapterCleared, lastWarnDay, lastRespawnDay,
      wave: { ...wave }, player: { ...pos(player), facing },
      nodes: obstacles.filter(res_).map(o => ({ t: o.userData.type, ...pos(o), rot: o.rotation.y })),
      fences: obstacles.filter(o => o.userData.type === 'fence').map(o => ({ level: o.userData.level, ...pos(o), rot: o.rotation.y, hp: o.userData.hp })),
      buildings: obstacles.filter(o => o.userData.type === 'building').map(o => {
        const stock = o.userData.stock ? { ...o.userData.stock } : null;
        if (stock) for (const n of npcs) if (n.carryGear) stock[n.carryGear]++;      // 수령하러 가던 장비는 선반으로 되돌려 저장
        return { kind: o.userData.kind, ...pos(o), stock, level: o.userData.level };
      }),
      bps: blueprints.map(b => ({ res: b.userData.res, bkind: b.userData.bkind, ...pos(b), rot: b.rotation.y })),
      gates: gateWaypoints.map(g => ({ ...g })),
      npcs: npcs.map(n => ({ role: n.role, born: n.born, home: { ...n.home }, ...pos(n), hp: n.hp, name: n.name, trait: n.trait, mood: n.mood, gear: { ...n.gear }, hungry: n.hungry, xp: { ...n.xp }, pref: n.pref, sick: n.sick || 0, promoteTo: n.promote ? n.promote.to : null })),
      boss: enemies.filter(e => e.userData.boss).map(e => ({ ...pos(e), hp: e.userData.hp })),
    };
  }
  function saveCheckpoint(label) {
    const day = Math.floor(gameMin / 1440) + 1;
    const i = checkpoints.findIndex(c => c.day === day);
    if (i >= 0) checkpoints.splice(i, 1);                                   // 같은 날은 최신 것으로 교체
    checkpoints.push({ day, label, snap: makeSnapshot() });
    checkpoints.sort((a, b) => a.day - b.day);
    while (checkpoints.length > 4) checkpoints.shift();
    saveGame();
  }
  function clearWorld() {
    for (const e of enemies.slice()) removeEnemy(e);
    for (const list of [rocks, arrows, shocks, particles, slashes, floaters]) {
      for (const o of list.slice()) {
        scene.remove(o.m || o); if (o.userData && o.userData.mark) scene.remove(o.userData.mark);
      }
      list.length = 0;
    }
    for (const o of obstacles.slice()) if (o !== campfire) scene.remove(o);
    obstacles.length = 0; obstacles.push(campfire);
    for (const b of blueprints) scene.remove(b);
    blueprints.length = 0;
    for (const d of doormats) scene.remove(d);
    doormats.length = 0; gateWaypoints.length = 0;
    for (const n of npcs) scene.remove(n);
    npcs.length = 0;
    reserved.wood = 0; reserved.stone = 0;
  }
  function applySnapshot(sn) {
    clearWorld();
    if (exActive) { cleanupZone(); exActive = null; } exEnding = false; updateExUi(); closeJournal();
    Object.assign(story, { relics: {}, said: {}, log: [], intro: false, exps: 0, beacon: false, dawn: false, crown: false, camps: {}, cleared: {} }, JSON.parse(JSON.stringify(sn.story || {}))); setBeacon(!!story.beacon); rebuildCamps();
    gameMin = sn.gameMin; res.wood = sn.res.wood; res.stone = sn.res.stone; res.food = sn.res.food || 0; res.iron = sn.res.iron || 0; res.shard = sn.res.shard || 0;
    for (const k of Object.keys(perks)) delete perks[k]; Object.assign(perks, sn.perks || {});
    if (sn.playerClass) { const keep = sn.hp; setClass(sn.playerClass); } else { playerClass = null; setTimeout(openClassChoice, 700); }
    order = sn.order || 'guard'; document.getElementById('ordSub').textContent = `R · ${order === 'follow' ? 'Follow' : 'Guard'}`;
    Object.assign(playerGear, { sword: 'sword_basic', bow: 'bow_basic', armor: 'armor_none' }, sn.playerGear || {}); weaponMode = sn.weaponMode; applyPlayerGear();
    closeSmith(); hp = sn.hp; fireHp = sn.fireHp;
    designTier = sn.designTier; townStage = sn.townStage || 0; age = sn.age || 1; chapterCleared = sn.chapterCleared;
    buildHall(); updateAgeUi();                                      // 시대에 맞는 회관/거주지 외형으로 복원
    lastWarnDay = sn.lastWarnDay; lastRespawnDay = sn.lastRespawnDay; Object.assign(wave, sn.wave);
    dead = false; fireAlive = true; flame.visible = true; hurtCd = 0; sinceHurt = 99; bossShakeT = 0; shake = 0;
    dashT = dashCd = invincibleT = ultCd = atkT = atkCd = 0; gathering = null; replenishCd = 0;
    for (const n of sn.nodes) { const o = n.t === 'wood' ? makeTree() : makeRock(); o.position.set(n.x, 0, n.z); o.rotation.y = n.rot; scene.add(o); obstacles.push(o); }
    for (const f of sn.fences) { const o = f.level === 'stone' ? createWall(f.x, f.z, f.rot) : createFence(f.x, f.z, f.rot); o.userData.hp = f.hp; }
    for (const b of sn.buildings) { const o = createBuilding(b.kind, b.x, b.z); if (b.level) { if (b.kind === 'house') { o.userData.level = b.level; setHouseModel(o); } else setBuildingLevel(o, b.level); } if (b.stock) { Object.assign(o.userData.stock, b.stock); refreshRack(o); } }
    for (const b of sn.bps) { if (b.bkind) addBuildingBlueprint(b.bkind, b.x, b.z); else addBlueprint(b.res, b.x, b.z, b.rot); }
    for (const g of sn.gates) addGate(g.x, g.z, g.r, g.nx, g.nz);
    for (const d of sn.npcs) {
      const n = makeNpc(d.role, d.home, d.born, 0, { name: d.name, trait: d.trait, mood: d.mood, xp: d.xp, pref: d.pref, sick: d.sick }); n.position.set(d.x, 0, d.z); n.hp = d.hp; n.px = d.x; n.pz = d.z;
      if (d.gear) { n.gear = { armor: 'armor_none', ...d.gear }; applyGear(n); }
      n.hungry = !!d.hungry;
      if (d.promoteTo) n.promote = { to: d.promoteTo, target: builtBuildings(d.promoteTo === 'melee' ? 'barracks' : 'range')[0] };
    }
    npc = npcs[0];
    player.position.set(sn.player.x, 0, sn.player.z); facing = sn.player.facing; player.rotation.y = facing;
    camera.position.copy(goalPos(camGoal)); lookAt.set(sn.player.x, LOOK_H, sn.player.z);
    for (const b of sn.boss) { wave.day = sn.wave.day; spawnEnemy('boss'); const e = enemies[enemies.length - 1]; e.position.x = b.x; e.position.z = b.z; e.userData.hp = b.hp; }
    // UI 동기화
    document.getElementById('gameover').style.display = 'none';
    clearEl.classList.remove('show'); warnEl.classList.remove('show');
    updateHud(); hpEl.textContent = Math.ceil(hp); updateDesignBtn(); updatePopUi();
    document.getElementById('swapCur').textContent = `Q · Current: ${weaponMode === 'bow' ? 'Bow' : 'Sword'}`;
    updateTownBtn();
  }
  function rewindTo(cp) {
    applySnapshot(cp.snap);
    for (let i = checkpoints.length - 1; i >= 0; i--) if (checkpoints[i].day > cp.day) checkpoints.splice(i, 1);     // 되돌린 시점보다 미래의 저장은 폐기
    toast(`Rewound to ${cp.label}`);
  }
  function renderRewindButtons() {
    const box = document.getElementById('goRewind');
    box.innerHTML = '';
    [...checkpoints].reverse().forEach((cp, i) => {
      const b = document.createElement('button');
      b.textContent = i === 0 ? `Rewind to ${cp.label} (most recent morning)` : `Rewind to ${cp.label}`;
      b.addEventListener('click', () => rewindTo(cp));
      box.appendChild(b);
    });
  }

  // ---------- 디버그: 보스전 바로 테스트 (Shift+B: Day 7 준비 / Shift+N: 보스 소환, 주소 뒤에 ?debug=1 이면 버튼 표시) ----------
  function debugSetup() {
    if (dead) return;
    res.wood += 400; res.stone += 400; res.iron += 60;
    setAge(3);                                                // 디버그: 3시대(석조 요새)로
    if (!playerClass) setClass('warrior');
    for (const a of [1, 2, 3]) if (!perks[a]) choosePerk(a, CFG.PERKS[a][0].id);
    while (townStage < CFG.TOWN_GROUPS.length) designTown();
    while (CFG.DESIGN[designTier]) designDefense();
    for (const b of blueprints.slice()) {                     // 도면을 즉시 완성
      blueprints.splice(blueprints.indexOf(b), 1); scene.remove(b);
      if (b.userData.bkind) createBuilding(b.userData.bkind, b.position.x, b.position.z);
      else createStructure(b.userData.res, b.position.x, b.position.z, b.rotation.y);
    }
    morningTown();                                            // 시민 스폰 → 병영/사격장 전직 즉시 완료
    for (const c of npcs.filter(n => n.promote)) setRole(c, c.promote.to);
    const sm = smiths()[0];                                   // 디버그: 대장간 선반에 장비를 채워 병사들이 수령하게 한다
    if (sm) { sm.userData.stock.iron_sword += 3; sm.userData.stock.strong_bow += 2; sm.userData.stock.iron_armor += 4; sm.userData.stock.steel_sword += 1; refreshRack(sm); }
    playerGear.sword = 'iron_sword'; applyPlayerGear();
    for (const e of enemies.slice()) removeEnemy(e);
    for (const r of rocks.slice()) { scene.remove(r); scene.remove(r.userData.mark); rocks.splice(rocks.indexOf(r), 1); }
    healPlayer(pMaxHp()); fireHp = fireMax();
    chapterCleared = false; wave.day = 0; wave.bossLeft = 0;
    gameMin = (CFG.BOSS_DAY - 1) * 1440 + 17 * 60 + 30;       // Day 7 17:30
    lastWarnDay = CFG.BOSS_DAY - 1; lastRespawnDay = CFG.BOSS_DAY;
    updateHud();
    toast('DEBUG: Day 7 17:30 - defenses, town, and troops ready');
  }
  function debugBoss() { debugSetup(); gameMin = (CFG.BOSS_DAY - 1) * 1440 + 21 * 60 + 40; }   // Day 7 21:40 → 곧 보스 등장
  addEventListener('keydown', e => { if (e.shiftKey && e.code === 'KeyB') debugSetup(); if (e.shiftKey && e.code === 'KeyN') debugBoss(); });
  if (/[?&]debug/.test(location.search)) {
    document.getElementById('dbg').style.display = 'flex';
    document.getElementById('dbgSetup').addEventListener('click', debugSetup);
    document.getElementById('dbgBoss').addEventListener('click', debugBoss);
  }

  // ---------- 방어 타워(3시대) / 식량 사용 ----------
  function updateTowers(dt) {
    for (const t of obstacles) {
      if (t.userData.type !== 'building' || t.userData.kind !== 'tower') continue;
      t.userData.shootCd -= dt;
      if (t.userData.shootCd > 0) continue;
      let foe = null, bd = CFG.TOWER_RANGE * (hasPerk('engineer') ? 1.25 : 1);
      for (const e of enemies) {
        if (e.userData.sinking || e.userData.siege) continue;
        const d = Math.hypot(e.position.x - t.position.x, e.position.z - t.position.z);
        if (d < bd) { bd = d; foe = e; }
      }
      if (!foe) continue;
      t.userData.shootCd = CFG.TOWER_INTERVAL;
      fireArrow(t.position.x, t.position.z, Math.atan2(foe.position.x - t.position.x, foe.position.z - t.position.z), false, CFG.TOWER_DMG * (hasPerk('engineer') ? 1.5 : 1), 4.9);
    }
  }
  let eatCd = 0;
  function eat() {
    if (dead || res.food < CFG.FOOD_MEAL || hp >= pMaxHp() || eatCd > 0) return;
    res.food -= CFG.FOOD_MEAL; healPlayer(CFG.FOOD_HEAL); eatCd = 6; updateHud();
    floatText(`Meal +${CFG.FOOD_HEAL}`, player.position.x, 2.6, player.position.z);
  }
  // 매일 아침(06:00) 시민 1명당 식량 1개를 소비한다. 식량이 모자라면 굶주린 시민은 이동·작업 속도 50%
  function feedCitizens() {
    const cs = npcs.filter(n => n.role === 'citizen');
    if (!cs.length) return;
    let fed = 0, starving = 0;
    for (const c of cs) {
      const need = rationOf(c);
      if (res.food >= need) { res.food -= need; c.hungry = false; fed++; } else { c.hungry = true; starving++; }
    }
    updateHud();
    const msg = starving ? `${starving} citizen${starving > 1 ? 's are' : ' is'} starving! Speed and work halved - grow more food` : `Morning rations: ${fed} Food eaten by citizens`;
    setTimeout(() => { toast(msg); if (starving) Snd.play('growl'); }, 1600);
  }
  function updateFood(dt) {
    eatCd -= dt;
    {                                                                    // 굶주린 시민은 식량이 생기는 즉시 먹는다
      const h = npcs.find(n => n.hungry && n.role === 'citizen' && !n.down && res.food >= rationOf(n));
      if (h) { res.food -= rationOf(h); h.hungry = false; updateHud(); floatText('Fed!', h.position.x, 3.2, h.position.z); }
    }
    if (hp < pMaxHp() * CFG.FOOD_AUTO_BELOW) eat();           // 체력이 절반 미만이면 자동 식사
  }
  addEventListener('keydown', e => { if (e.code === 'KeyV' && !e.repeat) eat(); });

  // ---------- 습격의 날 안내 UI ----------
  const raidEl = document.getElementById('raidInfo'), raidTxtEl = document.getElementById('raidTxt');
  let raidTxt = '';
  function updateRaidUi(hour, dayNo) {
    const night = hour >= 18 || hour < 7, nd = hour < 7 ? dayNo - 1 : dayNo;
    let text, cls = '';
    if (exActive) {
      const left = Math.max(0, Math.ceil((CFG.EXP_FORCE * 60 - (gameMin % 1440)) / (MIN_PER_SEC * CFG.EXP_TIME_MULT))), mm = Math.floor(left / 60), ss = String(left % 60).padStart(2, '0');
      if (left <= 30 && !exActive.warned) { exActive.warned = true; toast('Dusk is near - about 30 seconds left. Grab the last chests!'); }
      const t = `Expedition: ${exActive.dest.name} - called home in ${mm}:${ss}`; if (t !== raidTxt) { raidTxt = t; raidTxtEl.textContent = t; raidEl.className = 'soon'; } return; }
    if (night) {
      if (isRaid(nd)) { text = '🌑 Blood Moon raid in progress!'; cls = 'blood'; }
      else { const left = nextRaidFrom(nd + 1) - nd, tp = nightTypeOf(nd); text = `${tp === 'calm' ? 'Quiet night' : NIGHT_INFO[tp][0]} · ${left} day${left > 1 ? 's' : ''} until the next big raid`; cls = left <= 1 ? 'soon' : ''; }
    } else if (isRaid(dayNo)) { text = '⚠ Blood Moon raid tonight!'; cls = 'blood'; }
    else { const left = nextRaidFrom(dayNo) - dayNo, tp = nightTypeOf(dayNo); text = `${left} day${left > 1 ? 's' : ''} until the next big raid` + (tp !== 'calm' ? ` · Tonight: ${NIGHT_INFO[tp][0]}` : ''); cls = left <= 1 ? 'soon' : ''; }
    if (text !== raidTxt) { raidTxt = text; raidTxtEl.textContent = text; raidEl.className = cls; }
  }

  // ---------- 경고 UI / 자원 리스폰 ----------
  const warnEl = document.getElementById('warn');
  let warnTimer;
  function showWarning(msg) {
    warnEl.textContent = msg; warnEl.classList.add('show'); Snd.play(/Behemoth|massive/.test(msg) ? 'roar' : 'horn');
    clearTimeout(warnTimer); warnTimer = setTimeout(() => warnEl.classList.remove('show'), 3000);
  }
  const countType = (t) => obstacles.filter(o => o.userData.type === t).length;
  // 자원 보충: 나무/바위가 목표 수보다 적으면 (플레이어·동료·청사진·출입구·성벽 통행로를 피해) 채워 넣는다
  function resourceFree() {
    return (x, z) => Math.hypot(x - player.position.x, z - player.position.z) > 6 &&
      npcs.every(n => Math.hypot(x - n.position.x, z - n.position.z) > 4) &&
      blueprints.every(b => Math.hypot(x - b.position.x, z - b.position.z) > 3) &&
      gateWaypoints.every(g => Math.hypot(x - g.x, z - g.z) > 3.5) &&
      gateWaypoints.every(g => Math.abs(cheb(x, z) - g.r) > CFG.CORRIDOR_WIDTH + 1);      // 성벽 통행로에는 생성 금지
  }
  function topUpResources(maxPerType = Infinity) {
    const free = resourceFree(), before = obstacles.length;
    scatter(makeTree, Math.min(maxPerType, Math.max(0, CFG.TREE_COUNT - countType('wood'))), free);
    scatter(makeRock, Math.min(maxPerType, Math.max(0, CFG.STONE_COUNT - countType('stone'))), free);
    return obstacles.length - before;
  }
  function respawnResources() { if (topUpResources() > 0) toast('Morning has come. Resources have regrown'); }
  let replenishCd = 0;
  function replenishTick(dt) {                 // 하루 한 번이 아니라 수시로 보충해서 자원이 바닥나지 않게 한다
    replenishCd -= dt;
    if (replenishCd > 0 || dead) return;
    replenishCd = CFG.REPLENISH_INTERVAL;
    topUpResources(CFG.REPLENISH_BATCH);
  }
  // 벌목장/채석장 주변에는 자원이 다시 자라나서 시민이 멀리 나가지 않고도 계속 일할 수 있다
  function spawnNear(factory, cx, cz, rMin, rMax) {
    const free = resourceFree();
    const o = factory();
    for (let i = 0; i < 30; i++) {
      const a = rand(0, Math.PI * 2), r = rand(rMin, rMax), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (Math.max(Math.abs(x), Math.abs(z)) > MAP - 3 || Math.hypot(x, z) < 6 || !free(x, z)) continue;
      if (obstacles.some(p => Math.hypot(p.position.x - x, p.position.z - z) < p.userData.radius + o.userData.radius + 0.8)) continue;
      o.position.set(x, 0, z); o.rotation.y = rand(0, Math.PI * 2); scene.add(o); obstacles.push(o);
      return true;
    }
    return false;
  }
  let regrowCd = 0;
  function siteRegrowTick(dt) {
    regrowCd -= dt;
    if (regrowCd > 0 || dead) return;
    regrowCd = CFG.SITE_REGROW;
    for (const b of obstacles) {
      if (b.userData.type !== 'building' || (b.userData.kind !== 'lumber' && b.userData.kind !== 'quarry')) continue;
      const type = b.userData.kind === 'lumber' ? 'wood' : 'stone';
      const near = obstacles.filter(o => o.userData.type === type && Math.hypot(o.position.x - b.position.x, o.position.z - b.position.z) < CFG.WORK_RADIUS).length;
      if (near < 10) spawnNear(type === 'wood' ? makeTree : makeRock, b.position.x, b.position.z, 4, 11);
    }
  }
  let lastWarnDay = 0, lastRespawnDay = 1, bossShakeT = 0, lastGuardDay = 0;


  // ---------- 원정(Expedition): 낮에 마을 밖의 별도 지역으로 떠나 자원·유물을 얻고 해 지기 전에 돌아온다 ----------
  const fmtH = (h) => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
  const exMeshes = [];
  const fadeEl = document.getElementById('fade');
  function fadeTo(fn) { fadeEl.style.opacity = 1; setTimeout(() => { fn(); fadeEl.style.opacity = 0; }, 380); }
  const oreMat = mat(0x4a3f4c), chestWood = mat(0x7a4f2a), chestGold = new THREE.MeshBasicMaterial({ color: 0xffd45a }), chestBand = mat(0xb9892a), ruinMat = mat(0x7d7f86), flagMat = mat(0xc0392b);
  const exAdd = (m, solid) => { scene.add(m); (solid ? exObjs : exMeshes).push(m); return m; };
  function makeChest(x, z, relic) {
    const gr = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.7), chestWood); body.position.y = 0.3;
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.22, 0.74), relic ? chestGold : chestBand); lid.position.y = 0.7;
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.64, 0.74), chestBand); band.position.y = 0.32;
    gr.add(body, lid, band); gr.traverse(m => { if (m.isMesh) m.castShadow = true; });
    gr.position.set(x, 0, z); gr.rotation.y = rand(0, 6.28);
    gr.userData = { type: 'chest', radius: 0.9, relic: !!relic };
    return exAdd(gr, true);
  }
  const ICE = new THREE.Color(0x9fd6ff);
  function frostTint(e) {                        // 서리 세력: 몸 재질을 복제해 푸르게 물들인다 (공유 재질은 건드리지 않는다)
    const map = new Map();
    e.traverse(o => { if (o.isMesh && o.material && o.material.color && !o.material.isMeshBasicMaterial) { let c = map.get(o.material); if (!c) { c = o.material.clone(); c.color.lerp(ICE, 0.55); map.set(o.material, c); } o.material = c; } });
    if (map.has(e.material)) e.material = map.get(e.material);
  }
  function buildZone(d) {
    const geo = new THREE.CircleGeometry(46, 40); geo.rotateX(-Math.PI / 2);
    const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: d.tint, flatShading: true, roughness: 1 }));
    ground.position.set(EXC.x, 0.02, EXC.z); ground.receiveShadow = true; exAdd(ground, false);
    for (let i = 0; i < 26; i++) {                                   // 지역 테두리: 큰 바위들
      const a = i / 26 * Math.PI * 2, s = rand(1.4, 2.4), r = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rockMat);
      r.position.set(EXC.x + Math.cos(a) * 44, s * 0.5, EXC.z + Math.sin(a) * 44); r.castShadow = true; exAdd(r, false);
    }
    const flag = new THREE.Group();                                   // 귀환 깃발 (입구)
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4, 6), lampPostMat); pole.position.y = 2;
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.8, 0.05), flagMat); cloth.position.set(0.7, 3.5, 0);
    flag.add(pole, cloth); flag.position.set(EXC.x, 0, EXC.z - 36); exAdd(flag, false);
    const taken = [{ x: EXC.x, z: EXC.z - 34, r: 7 }];
    const spot = (rad) => {                                           // 겹치지 않는 위치 찾기
      for (let k = 0; k < 40; k++) {
        const a = rand(0, 6.28), rr = Math.sqrt(Math.random()) * 38, x = EXC.x + Math.cos(a) * rr, z = EXC.z + Math.sin(a) * rr;
        if (taken.every(t => Math.hypot(x - t.x, z - t.z) > t.r + rad)) { taken.push({ x, z, r: rad }); return { x, z }; }
      }
      return { x: EXC.x + rand(-30, 30), z: EXC.z + rand(-20, 30) };
    };
    for (let i = 0; i < d.trees; i++) { const o = makeTree(), p = spot(1.8); o.position.set(p.x, 0, p.z); exAdd(o, true); }
    for (let i = 0; i < d.rocks; i++) { const o = makeRock(), p = spot(1.6); o.position.set(p.x, 0, p.z); exAdd(o, true); }
    for (let i = 0; i < d.ore; i++) {
      const o = makeRock(), p = spot(1.8); o.scale.setScalar(1.25); o.userData.radius *= 1.25; o.userData.ore = true;
      o.traverse(m => { if (m.isMesh) m.material = oreMat; });
      o.position.set(p.x, 0, p.z); exAdd(o, true);
    }
    for (let i = 0; i < (d.ruins || 0); i++) {                        // 폐허 기둥: 막히는 지형
      const h = rand(1.6, 4), p = spot(1.6), m = new THREE.Mesh(new THREE.BoxGeometry(rand(0.8, 1.3), h, rand(0.8, 1.3)), ruinMat);
      m.position.set(p.x, h / 2, p.z); m.rotation.y = rand(0, 3); m.castShadow = m.receiveShadow = true; m.userData = { type: 'ruin', radius: 0.9 }; exAdd(m, true);
    }
    for (let i = 0; i < d.chests; i++) { const p = spot(2.2); makeChest(p.x, p.z, !!d.relic && i === d.chests - 1); }
    for (const kind of d.foes) { const p = spot(2.5); spawnEnemy(kind, p); if (d.faction === 'frost') frostTint(enemies[enemies.length - 1]); }
    if (d.guardian) {                                                 // 수호자: 커다랗고 단단한 우두머리. 쓰러뜨리면 보상 상자가 나온다
      const p = spot(4); spawnEnemy(d.guardian.kind, p);
      const e = enemies[enemies.length - 1], u = e.userData, s = d.guardian.scale;
      u.hp *= d.guardian.hpMul; u.maxHp = u.hp; u.guardian = true; u.contact *= 1.3; u.r *= s; u.baseY *= s;
      e.scale.multiplyScalar(s); e.position.y = u.baseY;
      if (d.faction === 'frost') frostTint(e);
      const lbl = textSprite(d.guardian.name || 'Guardian', '#ffcf5a', 1.5, 0.5, 'bold 56px sans-serif'); lbl.position.set(0, 2.5, 0); e.add(lbl);
    }
  }
  function cleanupZone() {
    for (const o of exMeshes.concat(exObjs)) scene.remove(o);
    exMeshes.length = 0; exObjs.length = 0;
    for (const e of enemies.slice()) if (e.userData.ex) removeEnemy(e);
  }
  function exEnemyStep(e, u, dt) {
    const px = player.position.x - e.position.x, pz = player.position.z - e.position.z, pd = Math.hypot(px, pz);
    let tx = player.position.x, tz = player.position.z, td = pd, tn = null, near = pd;           // 가장 가까운 상대: 플레이어 또는 동행 병사
    for (const n of npcs) if (n.escort && !n.down) {
      const d = Math.hypot(n.position.x - e.position.x, n.position.z - e.position.z);
      if (d < near) near = d;
      if (d < td - 1.5 && d < 10) { td = d; tx = n.position.x; tz = n.position.z; tn = n; }
    }
    u.aggro = exActive ? (u.aggro ? near < 24 : near < 13) : false;
    let moving = false; u.escortCd = (u.escortCd || 0) - dt;
    if (u.kbT > 0) { u.kbT -= dt; e.position.x += u.kbVx * dt; e.position.z += u.kbVz * dt; }
    else if (u.aggro && td > 0.9 && !(u.stunT > 0)) { e.position.x += (tx - e.position.x) / td * u.speed * dt; e.position.z += (tz - e.position.z) / td * u.speed * dt; e.lookAt(tx, e.position.y, tz); moving = true; }
    const dx = e.position.x - EXC.x, dz = e.position.z - EXC.z, dd = Math.hypot(dx, dz);
    if (dd > 42) { e.position.x = EXC.x + dx / dd * 42; e.position.z = EXC.z + dz / dd * 42; }
    u.anim.base(moving ? 'walk' : 'idle', u.speed); u.atkAnimCd -= dt;
    if (td < (tn ? 0.45 : PLAYER_R) + u.r + 0.15) {
      if (tn) { if (u.escortCd <= 0 && !(u.stunT > 0)) { u.escortCd = 0.9; damageEscort(tn, u.contact * 0.7); } }
      else if (hurtCd <= 0 && !(u.stunT > 0)) { damage(u.contact); hurtCd = 0.8; shake = Math.max(shake, 0.15); }
      if (u.atkAnimCd <= 0) { u.atkAnimCd = 0.9; u.anim.once('attackSword'); }
    }
  }
  // ---------- 10단계: 동행 병사 (원정에 함께 간 병사는 플레이어를 따라다니며 원정 지역의 적과 싸운다. 쓰러져도 영구 사망하지 않고 집으로 옮겨진다) ----------
  function damageEscort(n, dmg) {
    if (n.down) return;
    n.hp = Math.max(0, n.hp - Math.max(1, Math.round(dmg * (1 - gearDef(n.gear.armor).reduce) * (TR(n).dmg || 1))));
    if (n.hp <= 0) { n.down = true; n.mat.color.set(0x777777); n.anim.die(); grieve(); toast(`${n.name} is down - they will be carried home`); }
  }
  function exMove(n, tx, tz, speed, dt) {          // 원정 지역용 단순 이동: 장애물 밀어내기 + 지역 경계
    const dx = tx - n.position.x, dz = tz - n.position.z, d = Math.hypot(dx, dz);
    if (d < 0.05) return d;
    const st = Math.min(d, speed * moveMul(n) * dt);
    n.position.x += dx / d * st; n.position.z += dz / d * st; n.face = Math.atan2(dx, dz); n.rotation.y = n.face;
    for (const o of exObjs) {
      const ox = n.position.x - o.position.x, oz = n.position.z - o.position.z, m = o.userData.radius + 0.45, od = Math.hypot(ox, oz);
      if (od < m && od > 1e-4) { n.position.x = o.position.x + ox / od * m; n.position.z = o.position.z + oz / od * m; }
    }
    const cx = n.position.x - EXC.x, cz = n.position.z - EXC.z, cd = Math.hypot(cx, cz);
    if (cd > 41) { n.position.x = EXC.x + cx / cd * 41; n.position.z = EXC.z + cz / cd * 41; }
    return d;
  }
  function escortStep(dt) {
    const n = npc;
    if (n.down) { setLabel('Down'); n.anim.base('idle', 0); n.stateNow = 'Down'; return; }
    n.atkCd -= dt;
    let foe = null, bd = 16;
    for (const e of enemies) {
      if (!e.userData.ex || e.userData.sinking || e.userData.dying > 0) continue;
      const d = Math.hypot(e.position.x - n.position.x, e.position.z - n.position.z);
      if (d < bd) { bd = d; foe = e; }
    }
    let state = 'Escorting';
    if (foe) {
      state = 'Fighting';
      if (n.role === 'melee') {
        if (bd > 1.7) exMove(n, foe.position.x, foe.position.z, 5.2, dt);
        else { n.face = Math.atan2(foe.position.x - n.position.x, foe.position.z - n.position.z); n.rotation.y = n.face; if (n.atkCd <= 0) soldierStrike(foe); }
      } else {
        if (bd > 9) exMove(n, foe.position.x, foe.position.z, 4.5, dt);
        else if (bd < 4) exMove(n, n.position.x * 2 - foe.position.x, n.position.z * 2 - foe.position.z, 4.5, dt);
        if (bd <= 11) soldierShoot(foe);
      }
    } else {
      const k = npcs.filter(x => x.escort).indexOf(n), a = facing + Math.PI + (k - 1) * 0.9, tx = player.position.x + Math.sin(a) * 2.6, tz = player.position.z + Math.cos(a) * 2.6;
      const d = Math.hypot(tx - n.position.x, tz - n.position.z);
      if (d > 1.2) exMove(n, tx, tz, d > 8 ? 8 : 5, dt);
    }
    const mv = Math.hypot(n.position.x - n.px, n.position.z - n.pz) / Math.max(dt, 1e-4); n.px = n.position.x; n.pz = n.position.z;
    n.anim.base(mv > 4.4 ? 'run' : mv > 0.5 ? 'walk' : 'idle', mv);
    n.stateNow = state; setLabel(state);
  }
  function openChest(o) {
    const d = exActive.dest, tier = d.age, picks = [['wood', 10 + tier * 4, 'Wood'], ['stone', 8 + tier * 4, 'Stone'], ['iron', 2 + tier * 2, 'Iron'], ['food', 6 + tier * 3, 'Food']].sort(() => Math.random() - 0.5).slice(0, 2);
    picks.forEach(([k, n, nm], i) => { res[k] += n; floatText(`+${n} ${nm}`, o.position.x, 2.0 + i * 0.5, o.position.z); });
    if (d.ch >= 2) { const k = 1 + (o.userData.relic ? 2 : 0); res.shard += k; floatText(`+${k} Shard`, o.position.x, 2.9, o.position.z); }
    burst({ x: o.position.x, z: o.position.z, y: 1 }, 16); Snd.play('chime'); updateHud();
    if (o.userData.relic) foundRelic(d);
  }

  // ---------- 이야기 ----------
  const story = { relics: {}, said: {}, log: [], intro: false, exps: 0, beacon: false, dawn: false, crown: false, camps: {}, cleared: {} };
  const storyChain = () => CFG.STORY.concat(story.beacon ? CFG.STORY2 : []).concat(story.dawn ? CFG.STORY3 : []);
  let beaconMesh = null;
  function setBeacon(on) {
    if (on && !beaconMesh) {
      beaconMesh = new THREE.Group();
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.2, 40, 14, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      beam.position.y = 20; beaconMesh.add(beam);
      const glow = new THREE.PointLight(0xffd070, 1.6, 40, 1.4); glow.position.y = 6; beaconMesh.add(glow);
      scene.add(beaconMesh);
    }
    if (beaconMesh) beaconMesh.visible = on;
    story.beacon = on;
  }
  const storyDone = (id) => id === 'first' ? story.exps >= 1 : !!story.relics[id];
  function storyDialog(title, text) { openEvent({ tag: 'Story', title, text, opts: [{ label: 'Continue', run: () => '' }] }); }
  function checkStory() {
    for (const s of storyChain()) {
      if (!storyDone(s.id) || story.said[s.id]) continue;
      story.said[s.id] = true; story.log.push(`${s.title}: ${s.text}`);
      for (const [k, v] of Object.entries(s.reward)) res[k] += v;
      updateHud(); storyDialog(s.title, `${s.text}\n\nReward: ${costText(s.reward)}`);
    }
    if (!story.beacon && CFG.STORY.every(s => storyDone(s.id))) {
      setBeacon(true); story.log.push(`${CFG.STORY_BEACON.title}: ${CFG.STORY_BEACON.text}`);
      storyDialog(CFG.STORY_BEACON.title, CFG.STORY_BEACON.text); shake = Math.max(shake, 0.5); Snd.play('horn');
    }
    if (story.beacon && !story.dawn && CFG.STORY2.every(s => storyDone(s.id))) {
      story.dawn = true; story.log.push(`${CFG.STORY_DAWN.title}: ${CFG.STORY_DAWN.text}`);
      storyDialog(CFG.STORY_DAWN.title, CFG.STORY_DAWN.text); shake = Math.max(shake, 0.6); Snd.play('horn');
      if (beaconMesh) beaconMesh.children[0].material.opacity = 0.4;
    }
    if (story.dawn && !story.crown && CFG.STORY3.every(s => storyDone(s.id))) {
      story.crown = true; story.log.push(`${CFG.STORY_CROWN.title}: ${CFG.STORY_CROWN.text}`);
      storyDialog(CFG.STORY_CROWN.title, CFG.STORY_CROWN.text); shake = Math.max(shake, 0.5); Snd.play('horn');
    }
  }
  function foundRelic(d) {
    story.relics[d.id] = true; toast(`Relic found: ${d.relic}!`); floatText(`Relic: ${d.relic}`, player.position.x, 3.2, player.position.z);
    burst({ x: player.position.x, z: player.position.z, y: 1.5 }, 40); shake = Math.max(shake, 0.35); Snd.play('horn');
  }
  function storyIntro() {
    if (story.intro) return; story.intro = true;
    const t = 'At dawn a traveler leaves a charred map at your gate. "There was a Beacon once, far past the old road. It kept the dark away. Three relics powered it - find them, and the night may lose its teeth." Open the Journal (J) to plan an expedition.';
    story.log.push(`A Weathered Map: ${t}`); storyDialog('A Weathered Map', t);
  }

  // ---------- 원정 출발 / 귀환 ----------
  let escortN = 0;
  const escortPool = () => npcs.filter(n => n.role !== 'citizen' && !n.down && !n.escort);
  function startExpedition(id) {
    const d = CFG.EXPEDITIONS.find(x => x.id === id);
    if (!d || exActive || dead || exEnding) return;
    if (age < d.age) return toast(`Requires Age ${d.age} (${CFG.AGES[d.age - 1].name})`);
    if (d.ch === 2 && !story.beacon) return toast('Light the Beacon first');
    if (d.ch === 3 && !story.dawn) return toast('Open the Dawn Gate first');
    if (nowHour < 6 || nowHour >= CFG.EXP_LATEST) return toast('Too late to set out - dusk is near');
    closeJournal(); exEnding = true; gathering = null;
    fadeTo(() => {
      exActive = { dest: d, ret: { x: player.position.x, z: player.position.z }, res0: { ...res } };
      buildZone(d);
      const party = escortPool().sort((a, b) => (a.role === 'melee' ? 0 : 1) - (b.role === 'melee' ? 0 : 1)).slice(0, Math.min(escortN, CFG.ESCORT_MAX));     // 동행 병사: 근접 병사 먼저
      party.forEach((n, i) => {
        npc = n; setTask(null); n.workT = 0; n.promote = null; n.target = null; n.returning = false; returnGear(n);
        n.escort = true; n.position.set(EXC.x + (i - (party.length - 1) / 2) * 2.2, 0, EXC.z - 31); n.px = n.position.x; n.pz = n.position.z; n.hidden = false;
      });
      exActive.party = party.length;
      player.position.set(EXC.x, 0, EXC.z - 33); facing = 0; player.rotation.y = 0; yaw = 0;
      camera.position.copy(goalPos(camGoal)); lookAt.set(player.position.x, LOOK_H, player.position.z);
      exEnding = false; updateExUi(); toast(`${d.name}: find the chests - you have a few minutes before dusk`); Snd.play('horn');
    });
  }
  function endExpedition(forced) {
    if (!exActive || exEnding) return;
    const ex = exActive; exEnding = true; gathering = null;
    fadeTo(() => {
      const gain = ['wood', 'stone', 'iron', 'food', 'shard'].map(k => [k, res[k] - ex.res0[k]]).filter(x => x[1] > 0).map(([k, v]) => `${v} ${k}`).join(', ');
      const left = exObjs.filter(o => o.userData.type === 'chest').length + enemies.filter(e => e.userData.ex && !(e.userData.dying > 0)).length;
      const cleared = left === 0;
      for (const n of npcs.filter(x => x.escort)) {                           // 동행 병사 귀환 (쓰러진 병사는 집에서 회복)
        n.escort = false; n.position.set(n.home.x, 0, n.home.z); n.px = n.home.x; n.pz = n.home.z; n.atkCd = 0;
        if (n.down) { n.hp = n.maxHp; }
      }
      cleanupZone(); exActive = null;
      if (cleared && !story.cleared[ex.dest.id]) { story.cleared[ex.dest.id] = true; setTimeout(() => toast(`${ex.dest.name} is cleared - build a camp from the Journal for daily supplies`), 2200); }
      player.position.set(ex.ret.x, 0, ex.ret.z); camera.position.copy(goalPos(camGoal)); lookAt.set(player.position.x, LOOK_H, player.position.z);
      story.exps++; exEnding = false; updateExUi(); updateHud(); saveGame();
      toast(`${forced ? 'You rushed home as dusk fell. ' : 'Back home. '}${gain ? 'Brought back: ' + gain : 'You found nothing this time'}`);
      checkStory();
    });
  }
  // ---------- 10단계: 야영지 (정리한 원정지에 세우면 매일 아침 자원이 들어온다) ----------
  const campMeshes = [], campTentMat = mat(0xcbb48a), campFlagMat = mat(0x2f7fc0);
  function rebuildCamps() {
    for (const m of campMeshes) scene.remove(m);
    campMeshes.length = 0;
    CFG.EXPEDITIONS.filter(d => story.camps[d.id]).forEach((d, i) => {
      const a = 0.55 + i * 0.62, r = 47, g = new THREE.Group();
      const tent = new THREE.Mesh(new THREE.ConeGeometry(1.5, 2.1, 5), campTentMat); tent.position.y = 1.05;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 6), woodMat2); pole.position.set(1.8, 1.6, 0);
      const flag = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.04), campFlagMat); flag.position.set(2.15, 2.9, 0);
      g.add(tent, pole, flag); g.traverse(m => { if (m.isMesh) m.castShadow = true; });
      g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); g.rotation.y = -a; scene.add(g); campMeshes.push(g);
    });
  }
  function buildCamp(id) {
    const d = CFG.EXPEDITIONS.find(x => x.id === id), cost = CFG.CAMP_COST[d.age];
    if (!d || !story.cleared[id] || story.camps[id] || !canPay(cost)) return;
    payCost(cost); story.camps[id] = true; updateHud(); rebuildCamps(); Snd.play('chime');
    toast(`${d.name} camp established: ${Object.entries(CFG.CAMPS[id]).map(([k, v]) => `+${v} ${k}`).join(', ')} each morning`);
    renderJournal(); saveGame();
  }
  function campIncome() {
    const tot = {}; let any = false;
    for (const d of CFG.EXPEDITIONS) if (story.camps[d.id] && CFG.CAMPS[d.id]) for (const [k, v] of Object.entries(CFG.CAMPS[d.id])) {
      const g = Math.max(1, Math.round(v * (season().id === 'winter' ? 0.6 : 1))); res[k] += g; tot[k] = (tot[k] || 0) + g; any = true;
    }
    if (any) { report.camps = Object.entries(tot).map(([k, v]) => `${k} +${v}`).join(' · '); updateHud(); }
  }
  function updateExUi() {
    const b = document.getElementById('expBtn');
    b.firstChild.textContent = exActive ? 'Return home' : 'Journal';
    b.classList.toggle('on', !!exActive);
  }
  let returnArm = 0;
  function requestReturn() {                       // 상자·적이 남아 있으면 실수로 돌아가지 않도록 한 번 더 누르게 한다
    if (!exActive || exEnding) return;
    const chests = exObjs.filter(o => o.userData.type === 'chest').length, foes = enemies.filter(e => e.userData.ex && !(e.userData.dying > 0)).length;
    if ((chests || foes) && performance.now() - returnArm > 3500) { returnArm = performance.now(); toast(`${chests} chest${chests === 1 ? '' : 's'} and ${foes} foe${foes === 1 ? '' : 's'} left - press again to go home`); return; }
    endExpedition(false);
  }
  document.getElementById('expBtn').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); exActive ? requestReturn() : toggleJournal(); });
  addEventListener('keydown', e => { if (e.code === 'KeyJ' && !e.repeat) { if (exActive) requestReturn(); else toggleJournal(); } });

  // ---------- 일지(Journal): 이야기 목표 + 원정 목록 ----------
  const jEl = document.getElementById('journalPanel');
  function campHtml(d) {
    if (story.camps[d.id]) return `<small>Camp ✔ ${Object.entries(CFG.CAMPS[d.id]).map(([k, v]) => `+${v} ${k}`).join(', ')} every morning</small>`;
    if (!story.cleared[d.id]) return '';
    const cost = CFG.CAMP_COST[d.age];
    return `<small><button class="campBtn" data-camp="${d.id}" ${canPay(cost) ? '' : 'disabled'}>Build camp (${costText(cost)})</button> ${Object.entries(CFG.CAMPS[d.id]).map(([k, v]) => `+${v} ${k}`).join(', ')} every morning</small>`;
  }
  function renderJournal() {
    const chain = storyChain(), first = chain.findIndex(s => !storyDone(s.id));
    document.getElementById('jStory').innerHTML = (story.intro ? chain.map((s, i) => `<div class="q ${storyDone(s.id) ? 'done' : i === first ? 'now' : ''}"><span>${storyDone(s.id) ? '✔' : i === first ? '➤' : '•'}</span><span>${s.goal}</span></div>`).join('') +
      (story.beacon ? '<div class="q done"><span>★</span><span>The Beacon is lit! Chapter 2: gather the three shards</span></div>' : '') + (story.dawn ? '<div class="q done"><span>★</span><span>The Dawn Gate is open - Beacon gear can be forged</span></div>' : '') +
      story.log.slice(-2).map(t => `<div class="log">${t}</div>`).join('') : '<div class="q">Your story begins at the next dawn...</div>');
    const late = nowHour < 6 || nowHour >= CFG.EXP_LATEST;
    document.getElementById('jHint').textContent = `Set out between 06:00 and ${fmtH(CFG.EXP_LATEST)}. Time moves slowly while you are away, but you are called home at ${fmtH(CFG.EXP_FORCE)} (a countdown shows at the top). The village keeps working meanwhile.`;
    const pool = escortPool().length; escortN = Math.min(escortN, pool, CFG.ESCORT_MAX);
    const escHtml = `<div class="ex"><div class="info"><b>Escort</b><small>Soldiers who come along follow you and fight (they are carried home if they fall). They are away from the village while you are gone.</small></div><button id="escBtn" ${pool ? '' : 'disabled'}>${escortN ? escortN + ' soldier' + (escortN > 1 ? 's' : '') : pool ? 'None' : 'No soldiers'}</button></div>`;
    document.getElementById('jExp').innerHTML = escHtml + CFG.EXPEDITIONS.map(d => {
      const lock = age < d.age || (d.ch === 2 && !story.beacon) || (d.ch === 3 && !story.dawn), found = d.relic && story.relics[d.id];
      return `<div class="ex"><div class="info"><b>${d.name}</b><small>${d.desc}</small><small>Risk: ${d.risk} · Reward: ${d.reward}${found ? ' · Relic recovered ✔' : ''}${lock ? (d.ch === 2 && !story.beacon ? ' · Light the Beacon first' : d.ch === 3 && !story.dawn ? ' · Open the Dawn Gate first' : ` · Requires Age ${d.age}`) : ''}</small>${campHtml(d)}</div><button data-id="${d.id}" ${lock || late ? 'disabled' : ''}>${lock ? 'Locked' : late ? 'Too late' : 'Depart'}</button></div>`;
    }).join('');
    jEl.querySelectorAll('#jExp button[data-id]').forEach(b => b.addEventListener('click', () => startExpedition(b.dataset.id)));
    jEl.querySelectorAll('#jExp .campBtn').forEach(b => b.addEventListener('click', () => buildCamp(b.dataset.camp)));
    const eb = document.getElementById('escBtn'); if (eb) eb.addEventListener('click', () => { escortN = (escortN + 1) % (Math.min(pool, CFG.ESCORT_MAX) + 1); renderJournal(); });
  }
  function openJournal() { if (dead || exActive) return; renderJournal(); jEl.style.display = 'flex'; }
  function closeJournal() { jEl.style.display = 'none'; }
  function toggleJournal() { jEl.style.display === 'flex' ? closeJournal() : openJournal(); }
  document.getElementById('jClose').addEventListener('click', closeJournal);

  // ---------- 대장간 연출: 굴뚝 연기 + 화덕 깜빡임 ----------
  let forgeFlash = 0, smokeCd = 0;
  const puffs = [];
  const smokeTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const c = cv.getContext('2d'), g = c.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv);
  })();
  function updateSmith(dt, t) {
    forgeFlash = Math.max(0, forgeFlash - dt * 2);
    const k = 0.7 + 0.25 * Math.sin(t * 11) * Math.sin(t * 7.3) + forgeFlash * 0.9;
    forgeGlow.color.setRGB(1, Math.min(1, 0.3 + 0.28 * k), 0.06 + 0.12 * k);
    smokeCd -= dt;
    if (smokeCd <= 0) {
      smokeCd = 0.45;
      for (const sm of smiths()) {
        if (puffs.length > 26) break;
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0xb8b8c0, transparent: true, opacity: 0.55, depthWrite: false }));
        sp.position.set(sm.position.x - 1.4 + rand(-0.1, 0.1), 3.4, sm.position.z - 0.9 + rand(-0.1, 0.1));
        sp.scale.setScalar(0.5); sp.userData = { life: 0, wind: rand(0.2, 0.5) };
        scene.add(sp); puffs.push(sp);
      }
    }
    for (const p of puffs.slice()) {
      p.userData.life += dt;
      p.position.y += dt * 1.1; p.position.x += dt * p.userData.wind;
      p.scale.setScalar(0.5 + p.userData.life * 0.9);
      p.material.opacity = Math.max(0, 0.55 * (1 - p.userData.life / 2.6));
      if (p.userData.life >= 2.6) { scene.remove(p); p.material.dispose(); puffs.splice(puffs.indexOf(p), 1); }
    }
  }
  // ---------- 메인 루프 ----------
  const SPEED = 6;
  let propCd = 0, peaceful = false, peaceT = 0, fogNight = false, fogBoost = 0;          // 주변에 적이 없는 상태가 잠시 이어지면 평화로운 밤 (시민들이 모닥불 곁에서 쉰다)
  let facing = 0;
  const clock = new THREE.Clock();
  let fpsT = 0, fpsN = 0, stormT = 5, lightning = 0, thunderIn = 0;

  function tick() {
    requestAnimationFrame(tick);
    const rawDt = clock.getDelta(); fpsT += rawDt; fpsN++; if (fpsT >= 1) { window.__nfFps = Math.round(fpsN / fpsT); fpsN = 0; fpsT = 0; }
    const dt = Math.min(rawDt, 0.05) * (eventOpen || uiPause ? 0 : 1);       // 아침 이벤트 창이 열려 있으면 시간이 멈춘다
    const t = clock.elapsedTime;

    // 시간 / 조명
    gameMin += dt * MIN_PER_SEC * (exActive ? CFG.EXP_TIME_MULT : 1);          // 원정 중에는 시간이 천천히 흐른다
    const hour = (gameMin / 60) % 24;
    const night = hour >= 20 || hour < 5;
    const nf = nightFactor(hour);
    const dayNo0 = Math.floor(gameMin / 1440) + 1, nightDay = hour < 7 ? dayNo0 - 1 : dayNo0;
    applyLighting(nf, isRaid(nightDay) ? nf : 0); seasonVisual(Math.min(1, dt * 0.6 + 0.0005));
    if (wave.type === 'storm' && nf > 0.4 && !exActive) {                      // 폭풍우: 번개가 번쩍이고 조금 뒤에 천둥이 친다
      stormT -= dt; if (stormT <= 0) { stormT = 3.5 + Math.random() * 7; lightning = 1; thunderIn = 0.5 + Math.random() * 0.8; }
      if (thunderIn > 0 && (thunderIn -= dt) <= 0) Snd.play('thunder');
    }
    if (lightning > 0) { lightning = Math.max(0, lightning - dt * 3.2); const f = lightning * (0.6 + 0.4 * Math.sin(t * 60)); ambient.intensity += f * 1.4; sun.intensity += f * 0.9; scene.fog.color.lerp(C(0xcfd8ff), f * 0.5); scene.background.copy(scene.fog.color); }
    fogNight = night && wave.type === 'fog'; fogBoost += ((fogNight ? 1 : 0) - fogBoost) * Math.min(1, dt * 0.8);
    scene.fog.near *= 1 - 0.55 * fogBoost; scene.fog.far *= 1 - 0.45 * fogBoost;      // 안개의 밤: 시야가 크게 줄어든다
    if (bird) { scene.fog.near *= 4; scene.fog.far *= 4; }                            // 버드아이 뷰에서는 안개가 멀리 밀려난다
    { const g = Math.max(0, Math.min(1, (nf - 0.2) / 0.45)), fl = 0.94 + 0.06 * Math.sin(t * 9); windowGlow.color.setRGB(0.16 + 0.84 * g * fl, 0.16 + 0.62 * g * fl, 0.2 + 0.2 * g); lampGlow.color.copy(windowGlow.color); lampLevel = g * fl; updateGateLights(t); }      // 창문·가로등은 밤에 켜진다                      // 붉은 달의 밤에는 화면 전체가 붉게 물든다
    torch.intensity = nf * 2.4;   // 횃불: 밤에 켜지고 낮에 꺼짐
    const hh = Math.floor(hour), mm = Math.floor(gameMin % 60);
    clockEl.textContent = `Day ${Math.floor(gameMin / 1440) + 1}${CFG.SEASONS_ON ? ' · ' + season().name : ''} - ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}${chapterCleared ? ' · ∞ Endless' : ''}`;

    const dayNo = Math.floor(gameMin / 1440) + 1;
    nowHour = hour;
    if (exActive && !exEnding && hour >= CFG.EXP_FORCE) endExpedition(true);       // 해 지기 전에 자동 귀환
    updateRaidUi(hour, dayNo);
    const waveDay = hour < 5 ? dayNo - 1 : dayNo;      // 자정이 지나도 같은 밤의 웨이브로 취급
    if (!dead && hour >= 18 && lastWarnDay !== dayNo) { lastWarnDay = dayNo; 
      if (dayNo === CFG.BOSS_DAY && !chapterCleared) { showWarning('WARNING: A massive threat approaches!'); bossShakeT = 3; }
      else if (isRaid(dayNo)) showWarning(`Night ${dayNo} - Blood Moon raid! Prepare your defenses!` + (dayNo === CFG.BOSS_DAY - 1 && !chapterCleared ? ' (An even greater threat comes tomorrow night)' : ''));
      else showWarning(`Night ${dayNo} - A quiet night. Beasts prowl nearby`);
    }
    if (bossShakeT > 0) { bossShakeT -= dt; shake = Math.max(shake, 0.55); }       // 보스 경고: 강한 화면 흔들림
    if (!dead && hour >= 16 && hour < 18 && lastGuardDay !== dayNo && !exActive) {            // 해 지기 전 점검: 문보다 병사가 적으면 알려 준다
      lastGuardDay = dayNo;
      const guards = npcs.filter(n => n.role === 'melee').length, gates = gateWaypoints.length;
      if (gates > guards) toast(`Only ${guards} soldier${guards === 1 ? '' : 's'} for ${gates} gates - some entrances will be unguarded tonight`);
    }
    if (!dead && hour >= CFG.RESPAWN_HOUR && hour < 18 && lastRespawnDay !== dayNo) { lastRespawnDay = dayNo; respawnResources(); morningTown(); feedCitizens(); checkDepartures(); marketTrade(); upgradeHouses(); upgradeBuildings(); campIncome(); seasonTick(dayNo); rollSickness(dayNo); updateProsperity(); if (dayNo > 1) { showReport(dayNo); if (dayNo >= 2) storyIntro(); rollEvent(dayNo); merchantVisit(dayNo); } else report = freshReport(); if (hp < pMaxHp()) { healPlayer(pMaxHp()); toast('Morning has come. Your health is fully restored'); } saveCheckpoint(`Day ${dayNo} morning`); }
    updateEnemies(dt, night, Math.max(1, waveDay));
    const danger = enemies.some(e => !e.userData.sinking && (e.userData.boss || Math.hypot(e.position.x, e.position.z) < 34));
    peaceT = danger ? 0 : peaceT + dt; peaceful = peaceT > 2.5;
    updateNpcs(dt, hour, t);
    updateFx(dt);
    updateArrows(dt);
    updateRocks(dt);
    updateShocks(dt);
    updatePopUi(); rallyT = Math.max(0, rallyT - dt);
    if (cardNpc && (cardT -= dt) <= 0) { cardT = 0.4; renderCard(); }
    if ((propCd -= dt) <= 0) { propCd = 0.5; updateProsperity(); }
    updateRegen(dt);
    replenishTick(dt);
    siteRegrowTick(dt);
    updateTowers(dt);
    updateFood(dt);
    updateDash(dt);
    updateFloaters(dt); updateSmith(dt, t);
    Snd.setMood(nf, danger && night);
    for (const bp of blueprints) bp.material.opacity = 0.35 + 0.15 * Math.sin(t * 4);
    animateFire(t);
    atkCd -= dt;
    if (atkT > 0) {
      atkT -= dt;
      playerRig.root.position.z = Math.sin((1 - Math.max(atkT, 0) / SLASH_LIFE) * Math.PI) * 0.25;   // 베는 순간 앞으로 살짝 踏み込む
      if (atkT <= 0) playerRig.root.position.z = 0;
    }
    { const sm = dead ? null : nearestSmith(); smithBtnEl.style.display = sm ? '' : 'none'; if (!sm && smithOpenFor) closeSmith(); hallBtnEl.style.display = !dead && Math.hypot(player.position.x, player.position.z) < 14 ? '' : 'none'; }

    // 입력 합산 (조이스틱 or WASD)
    let ix = joy.x, iy = joy.y;
    const kx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    const ky = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
    if (dead) { ix = iy = 0; }
    else if (kx || ky) { const l = Math.hypot(kx, ky); ix = kx / l; iy = ky / l; }
    const mag = Math.min(1, Math.hypot(ix, iy));

    if (dashT > 0) {                       // 대시 중: 입력 이동 대신 바라보는 방향으로 질주
      const sd = Math.min(dt, dashT);
      player.position.x += dashDX * (CFG.DASH_DIST / CFG.DASH_TIME) * sd;
      player.position.z += dashDZ * (CFG.DASH_DIST / CFG.DASH_TIME) * sd;
      dashT -= dt;
    } else if (mag > 0.08) {
      // 현재 카메라가 바라보는 방향(수평) 기준으로 전진/우측 벡터 계산
      const fwdX = -Math.sin(yaw), fwdZ = -Math.cos(yaw);
      const rightX = Math.cos(yaw), rightZ = -Math.sin(yaw);
      let mx = rightX * ix + fwdX * iy, mz = rightZ * ix + fwdZ * iy;
      const ml = Math.hypot(mx, mz); mx /= ml; mz /= ml;

      player.position.x += mx * SPEED * spdMul() * mag * dt;
      player.position.z += mz * SPEED * spdMul() * mag * dt;

      // 이동 방향으로 부드럽게 회전
      let diff = Math.atan2(mx, mz) - facing;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      facing += diff * Math.min(1, dt * 14);
      player.rotation.y = facing;
    }
    playerAnim.base(gathering ? 'gather' : dashT > 0 ? 'run' : mag > 0.08 ? (mag > 0.6 ? 'run' : 'walk') : 'idle', SPEED * mag);   // Idle / Walk / Run / Gather CrossFade
    playerAnim.update(dt);

    updateGather(dt, dashT > 0 || mag > 0.08);

    // 충돌 처리: 겹치면 바깥으로 밀어냄
    for (const o of obstacles) {
      const dx = player.position.x - o.position.x, dz = player.position.z - o.position.z;
      const min = o.userData.radius + PLAYER_R, d = Math.hypot(dx, dz);
      if (d < min && d > 1e-4) { player.position.x = o.position.x + dx / d * min; player.position.z = o.position.z + dz / d * min; }
    }
    if (exActive) {
      for (const o of exObjs) {
        const dx = player.position.x - o.position.x, dz = player.position.z - o.position.z, min = o.userData.radius + PLAYER_R, d = Math.hypot(dx, dz);
        if (d < min && d > 1e-4) { player.position.x = o.position.x + dx / d * min; player.position.z = o.position.z + dz / d * min; }
      }
      const dx = player.position.x - EXC.x, dz = player.position.z - EXC.z, dd = Math.hypot(dx, dz);
      if (dd > 41) { player.position.x = EXC.x + dx / dd * 41; player.position.z = EXC.z + dz / dd * 41; }
    } else {
      player.position.x = Math.max(-MAP, Math.min(MAP, player.position.x));
      player.position.z = Math.max(-MAP, Math.min(MAP, player.position.z));
    }

    // 카메라 Lerp 추적
    const k = 1 - Math.exp(-6 * dt);
    camera.position.lerp(goalPos(camGoal), k);
    lookAt.lerp(new THREE.Vector3(camFocus().x, bird ? 0 : LOOK_H, camFocus().z), k);
    camera.lookAt(lookAt);

    // 그림자 범위가 플레이어를 따라가게
    sun.target.position.copy(player.position);
    sun.position.set(player.position.x - 20, 16, player.position.z - 12);

    // 카메라 흔들림 (렌더 직전에만 적용)
    let off = null;
    if (shake > 0) {
      off = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(shake);
      camera.position.add(off);
      shake = Math.max(0, shake - dt * 1.5);
    }
    renderer.render(scene, camera);
    if (off) camera.position.sub(off);
  }
  applyPlayerGear(); updateHud();

  // ---------- 8단계: 자동 저장 / 설정 / 팁 ----------
  const SAVE_KEY = 'nf_save_v1', DEBUG = /[?&]debug/.test(location.search);
  let saveReady = false, uiPause = false;
  const tut = { done: false, step: 0, hints: {} };
  function saveGame() {                                   // 매일 아침과 원정 귀환 때: 마을 상태만 저장한다 (원정 중에는 저장하지 않는다)
    if (!saveReady || dead || exActive || exEnding) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, ts: Date.now(), day: Math.floor(gameMin / 1440) + 1, snap: makeSnapshot(), tut })); } catch (e) {}
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
    Object.assign(tut, { done: false, step: 0, hints: {} }, d.tut || {});
    checkpoints.length = 0; saveCheckpoint('Loaded save');
    toast(`Continuing from Day ${d.day}`);
  }

  // 설정 (볼륨 · 글자 크기 · 그래픽)
  const setEl = document.getElementById('setPanel'), settings = { text: 'm', gfx: 'hi' };
  try { Object.assign(settings, JSON.parse(localStorage.getItem('nf_settings') || '{}')); } catch (e) {}
  function applySettings() {
    document.documentElement.dataset.ts = settings.text;
    const lo = settings.gfx === 'lo';
    renderer.setPixelRatio(lo ? 1 : Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight, false);
    renderer.shadowMap.enabled = !lo; sun.castShadow = !lo;
    scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.needsUpdate = true); });
  }
  function saveSettings() { try { localStorage.setItem('nf_settings', JSON.stringify(settings)); } catch (e) {} }
  function openSettings() {
    document.getElementById('setMusic').value = Math.round(Snd.getVol('music') * 100);
    document.getElementById('setSfx').value = Math.round(Snd.getVol('sfx') * 100);
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
  document.getElementById('setGfx').addEventListener('change', e => { settings.gfx = e.target.value; saveSettings(); applySettings(); });
  document.getElementById('setTips').addEventListener('click', () => { Object.assign(tut, { done: false, step: 0, hints: {} }); closeSettings(); toast('Tips restarted'); });
  document.getElementById('setDel').addEventListener('click', e => {
    if (e.target.dataset.sure !== '1') { e.target.dataset.sure = '1'; e.target.textContent = 'Tap again to confirm'; return; }
    clearSave(); e.target.dataset.sure = ''; e.target.textContent = 'Delete save'; document.getElementById('setSaveInfo').textContent = 'Save deleted'; toast('Save deleted');
  });
  applySettings();

  // 팁: 첫 며칠 동안 지금 할 일을 한 줄로 알려 주고, 처음 만나는 시스템은 한 번만 안내한다
  const tutEl = document.getElementById('tutor'), tutTxt = document.getElementById('tutorTxt');
  const TUT = [
    { text: 'Gather wood: stand by a tree, press G', done: () => res.wood >= 10 || obstacles.some(o => o.userData.type === 'fence') || blueprints.length > 0 },
    { text: 'Tap Defense Line to plan a fence', done: () => designTier > 0 || blueprints.length > 0 || obstacles.some(o => o.userData.type === 'fence') },
    { text: 'Survive the night near the campfire', done: () => gameMin >= 1440 + CFG.RESPAWN_HOUR * 60 },
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

  // 시작 화면: 저장이 있으면 이어하기 / 새 게임
  function bootGame() {
    const d = readSave();
    if (d && (!DEBUG || /[?&]load/.test(location.search))) {
      const p = document.getElementById('startPanel'); uiPause = true;
      document.getElementById('startInfo').textContent = `Saved game: Day ${d.day} - ${new Date(d.ts).toLocaleString()}`;
      p.style.display = 'flex';
      document.getElementById('startContinue').addEventListener('click', () => { p.style.display = 'none'; uiPause = false; saveReady = true; loadSave(d); });
      document.getElementById('startNew').addEventListener('click', () => { p.style.display = 'none'; uiPause = false; clearSave(); saveReady = true; setTimeout(openClassChoice, 700); saveCheckpoint('Day 1 start'); });
      return;
    }
    saveReady = true;
    if (DEBUG) { setClass('warrior'); choosePerk(1, 'forager'); } else setTimeout(openClassChoice, 700);
    saveCheckpoint('Day 1 start');
  }
  updateAgeUi(); updateTownBtn(); updateRaidUi(8, 1);
  bootGame();      // 처음 시작할 때 역할 선택 (저장이 있으면 이어하기 선택)
  if (/[?&]debug/.test(location.search)) window.__nf = { CFG, res, npcs, enemies, obstacles, playerGear, player, setMin: m => { gameMin = m; }, getMin: () => gameMin, debugSetup, spawnEnemy, setClass, toggleBird, toggleOrder, choosePerk, openPerk, perks, rally: () => rally(), get bird() { return bird; }, scene, blueprints, makeRock, designDefense, designTown, exObjs, story, startExpedition, endExpedition, checkStory, get exActive() { return exActive; }, EVENTS, openEvent, nightTypeOf, openNpcCard, checkDepartures, snap: () => makeSnapshot(), openEvent, nightTypeOf, setEscort: n => { escortN = n; }, buildCamp, campIncome, storyChain, campMeshes, upgradeBuildings, rollSickness, seasonTick, season, citizens, merchantVisit, nextPref, jobTitle, bLevel, skillLv, saveGame, readSave, loadSave, tut, TUT, tutorStep, get saveReady() { return saveReady; }, settings, restore: sn => applySnapshot(sn), feedCitizens, openSmith, get peaceful() { return peaceful; } };
  tick();
})();
