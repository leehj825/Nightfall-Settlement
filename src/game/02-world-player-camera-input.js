  // ---------- 절차적 맵: 나무 / 바위 ----------
  const obstacles = [];   // 충돌 + 채집 대상 배열
  const mat = (c) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 1 });
  const trunkMat = mat(0x6b4226), leafMat = mat(0x3f8a3c), rockMat = mat(0x8b8b92);
  const rand = (a, b) => a + Math.random() * (b - a);

  let treeMat = null;                                                    // 모델 나무 재질: 계절 색(leafMat)을 흰색 쪽으로 약하게 섞어 곱한다 (tintTrees)
  const tintTrees = () => { if (treeMat) treeMat.color.copy(leafMat.color).lerp(new THREE.Color(0xffffff), 0.8); };
  function makeTree() {
    const tm = structMesh('tree');
    if (tm) {
      if (!treeMat) { treeMat = tm.material.clone(); treeMat.emissive = new THREE.Color(0x4a4a4a); treeMat.emissiveMap = treeMat.map; treeMat.roughness = 1; tintTrees(); }       // 밝고 선명한 연두색 소나무: 텍스처를 스스로 조금 빛나게 한다
      tm.material = treeMat; tm.scale.setScalar(rand(0.8, 1.25)); tm.rotation.y = rand(0, 6.28);
      const g = new THREE.Group(); g.add(tm); g.userData = { type: 'wood', radius: 0.9 };
      return g;
    }
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
  function biomeDensity(type, x, z) {                                        // 지대별 자원 밀도 (0~1)
    if (Math.max(Math.abs(x), Math.abs(z)) < 34) return 1;
    const b = biomeAt(x, z);
    return type === 'wood' ? { forest: 1, meadow: 0.5, marsh: 0.3, rock: 0.15 }[b] : type === 'stone' ? { forest: 0.3, meadow: 0.5, marsh: 0.15, rock: 1 }[b] : 1;
  }
  function scatter(factory, count, ok = () => true) {
    for (let i = 0; i < count; i++) {
      const o = factory();
      for (let tries = 0; tries < 60; tries++) {
        const [x, z] = samplePoint();
        if (Math.hypot(x, z) < 6 || inRiver(x, z) || !ok(x, z)) continue;   // 모닥불 주변 비우기
        if (Math.random() > biomeDensity(o.userData.type, x, z)) continue;       // 숲에는 나무, 고원에는 바위가 많다
        if (obstacles.some(p => Math.hypot(p.position.x - x, p.position.z - z) < p.userData.radius + o.userData.radius + 0.8)) continue;
        o.position.set(x, Math.max(0, terrH(x, z)), z);
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
  const playerRig = makeRig('player', 0xa4492f, { seed: 11 });
  const bodyMat = playerRig.bodyMat;
  const playerAnim = new Anim(playerRig);
  player.add(playerRig.root);
  scene.add(player);
  const PLAYER_R = 0.5;

  // ---------- 카메라 (Orbit + Lerp) ----------
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
  let yaw = 0, pitch = 0.45;
  let DIST = 8, DIST_MAX = 22; const LOOK_H = 1.6, DIST_MIN = 4;
  function setCamMax() { DIST_MAX = age >= 4 ? 34 : age >= 3 ? 28 : 22; }       // 단계가 오를수록 마을이 커지므로 더 멀리 볼 수 있다
  let exActive = null, exEnding = false; const exObjs = [], EXC = { x: 600, z: 0 };              // 원정 중이면 exActive, 원정 지역은 마을(반경 50)에서 멀리 떨어진 곳
  let bird = false, savedView = null, camFront = false, birdX = 0, birdZ = 0;      // camFront: 영웅의 앞모습을 보는 카메라 / birdX,Z: 지도 보기의 카메라 초점(자유롭게 이동)                                // 버드아이 뷰: 마을 전체를 한눈에
  const camFocus = () => bird ? { x: birdX, z: birdZ } : player.position;
  const setDist = d => { DIST = bird ? Math.min(150, Math.max(5, d)) : Math.min(DIST_MAX, Math.max(DIST_MIN, d)); };
  const camGoal = new THREE.Vector3(), lookAt = new THREE.Vector3();
  const viewYaw = () => yaw + (camFront && !bird ? Math.PI : 0);          // 카메라가 실제로 놓이는 각도 (앞모습 보기에서는 영웅 정면에 놓인다)
  function goalPos(out) {
    const va = viewYaw();
    return out.set(
      camFocus().x + Math.sin(va) * Math.cos(pitch) * DIST,
      LOOK_H + (bird ? 0 : player.position.y) + Math.sin(pitch) * DIST,
      camFocus().z + Math.cos(va) * Math.cos(pitch) * DIST);
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
  let panMid = null, panId = null;
  const panView = (dx, dy) => {                                     // 지도 보기: 두 손가락 / 마우스 오른쪽 드래그로 카메라 초점을 옮긴다
    const sc = DIST * 0.0016, rx = Math.cos(yaw), rz = -Math.sin(yaw), fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    birdX = Math.max(-140, Math.min(140, birdX + (-rx * dx + fx * dy) * sc)); birdZ = Math.max(-140, Math.min(140, birdZ + (-rz * dx + fz * dy) * sc));
  };
  canvas.addEventListener('pointerdown', e => {
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (bird && e.pointerType === 'mouse' && e.button === 2) { panId = e.pointerId; panMid = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); return; }
    if (e.pointerType === 'touch' && ptrs.size === 2) { look.id = null; pinchD = pinchDist(); tapStart = null; panMid = null; return; }
    const ok = e.pointerType === 'mouse' ? e.button === 0 : true;       // 버튼과 조이스틱이 아닌 화면 어디서든 끌어서 카메라를 돌린다
    if (!ok || look.id !== null) return;
    look.id = e.pointerId; look.x = e.clientX; look.y = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    const p = ptrs.get(e.pointerId); if (p) { p.x = e.clientX; p.y = e.clientY; }
    if (e.pointerId === panId && panMid) { panView(e.clientX - panMid.x, e.clientY - panMid.y); panMid.x = e.clientX; panMid.y = e.clientY; return; }
    if (ptrs.size === 2 && e.pointerType === 'touch') {
      const d = pinchDist();
      if (pinchD > 0 && d > 0) setDist(DIST * pinchD / d);
      pinchD = d;
      if (bird) { const [a, b] = [...ptrs.values()], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; if (panMid) panView(mx - panMid.x, my - panMid.y); panMid = { x: mx, y: my }; }
      return;
    }
    if (e.pointerId !== look.id) return;
    yaw -= (e.clientX - look.x) * 0.006;
    pitch = Math.min(bird ? 1.5 : 1.2, Math.max(bird ? 0.12 : 0.1, pitch + (e.clientY - look.y) * 0.005));
    look.x = e.clientX; look.y = e.clientY;
  });
  const lookEnd = e => { ptrs.delete(e.pointerId); pinchD = 0; if (e.pointerId === panId) panId = null; panMid = null; if (e.pointerId === look.id) look.id = null; };
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
    if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) jump(); }
    if (e.code === 'KeyR' && !e.repeat) dash();
    if (e.code === 'KeyG' && !e.repeat) gather();
    if (e.code === 'KeyE' && !e.repeat) ultimate();
    if (e.code === 'KeyF' && !e.repeat) attack();
    if (e.code === 'KeyQ' && !e.repeat) swapWeapon();
    if (e.code === 'KeyC' && !e.repeat) { if (smithEl.style.display === 'flex') closeSmith(); else openSmith(); }
    keys[e.code] = true;
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

