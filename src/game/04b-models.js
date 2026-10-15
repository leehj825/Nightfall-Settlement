  // ---------- 더 자세한 건물 모양 (집과 성채): 기본 도형을 모아 만든 로우폴리 모델. 모두 function 선언이다 ----------
  const mdlCache = {};
  const M = (c) => mdlCache[c] || (mdlCache[c] = new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 1 }));
  function gableGeo(w, h, d) {                                               // 삼각 단면(너비 w, 높이 h)을 깊이 d 만큼 밀어낸 박공 지붕: 바닥이 y=0, 앞뒤(z)로 d/2
    const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(0, h); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false }); g.translate(0, 0, -d / 2); return g;
  }
  function rngOf(seed) { let s = (seed >>> 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
  function houseModel(g, lvl) {                                              // 2단계: 목골 집 / 3단계 이상: 돌집 (정면은 +z). g.userData.seed 로 집마다 색·크기·지붕 방향·문 위치·부속 건물이 달라진다
    const R = rngOf(g.userData.seed || 1), pick = (a) => a[Math.floor(R() * a.length)];
    const inner = new THREE.Group(); inner.scale.set(0.9 + R() * 0.3, 0.92 + R() * 0.2, 0.88 + R() * 0.25); g.add(inner);
    const add = (geo, m, px, py, pz, ry = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.rotation.y = ry; o.castShadow = o.receiveShadow = true; inner.add(o); return o; };
    const stone = lvl >= 3;
    const wallM = M(stone ? pick([0x9a9da4, 0xa8a294, 0x8f969e, 0xb0a898]) : pick([0xd8bf90, 0xe6d8b8, 0xcfa97c, 0xd9cfae, 0xbfa27a])), beamM = M(pick([0x4a301c, 0x3a2a1c, 0x5a3a22])),
      roofM = M(stone ? pick([0x4a4f5c, 0x5c4a42, 0x3f5a52, 0x5a3f4a]) : pick([0xa34a2a, 0x8c5a34, 0x6b7d4a, 0xb5651d, 0x7a3a2a])), baseM = M(0x6f7078), doorM = M(pick([0x3a2414, 0x4a2a1a, 0x2f3a4a, 0x5a2a2a])),
      flowerM = M(pick([0x4f8a3a, 0xc0504a, 0xd8a02a, 0x8a5ab0]));
    const W = stone ? 3.0 : 2.8, H = (stone ? 2.3 : 1.8) + (R() < 0.3 ? 0.5 : 0);
    const ridgeX = R() < 0.5, dOff = R() < 0.5 ? 0 : (R() < 0.5 ? -1 : 1) * W * 0.17;                              // 용마루 방향 / 문 위치 어긋남
    add(new THREE.BoxGeometry(W + 0.3, 0.3, W + 0.3), baseM, 0, 0.15, 0);                                       // 돌 기초
    add(new THREE.BoxGeometry(W, H, W), wallM, 0, 0.3 + H / 2, 0);
    const top = 0.3 + H;
    if (!stone) {                                                                                               // 목골: 모서리 기둥, 가로 들보, 가새
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(new THREE.BoxGeometry(0.16, H, 0.16), beamM, sx * W / 2, 0.3 + H / 2, sz * W / 2);
      for (const y of [0.3, top - 0.08]) { add(new THREE.BoxGeometry(W + 0.1, 0.12, 0.12), beamM, 0, y, W / 2); add(new THREE.BoxGeometry(W + 0.1, 0.12, 0.12), beamM, 0, y, -W / 2); add(new THREE.BoxGeometry(0.12, 0.12, W + 0.1), beamM, W / 2, y, 0); add(new THREE.BoxGeometry(0.12, 0.12, W + 0.1), beamM, -W / 2, y, 0); }
      if (H > 2) add(new THREE.BoxGeometry(W + 0.12, 0.14, W + 0.12), beamM, 0, 0.3 + H * 0.5, 0);               // 2층 허리 들보
      if (R() < 0.6) for (const sx of [-1, 1]) { const br = add(new THREE.BoxGeometry(0.1, 1.3, 0.1), beamM, sx * W * 0.32, 0.3 + H * 0.5, W / 2 + 0.02); br.rotation.z = -sx * 0.6; }
    } else {                                                                                                    // 돌집: 모서리 돌(쐐기돌)
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(new THREE.BoxGeometry(0.34, H, 0.34), M(0xb4b6bc), sx * W / 2, 0.3 + H / 2, sz * W / 2);
      add(new THREE.BoxGeometry(W + 0.12, 0.14, W + 0.12), M(0xb4b6bc), 0, top, 0);
    }
    const rw = W + 0.7, rh = (stone ? 1.7 : 1.45) * (0.9 + R() * 0.35);
    const roof = add(gableGeo(rw, rh, W + 0.7), roofM, 0, top, 0); if (ridgeX) roof.rotation.y = Math.PI / 2;      // 박공 지붕 (처마가 벽보다 튀어나온다)
    for (const k of [-1, 1]) { const gw = add(gableGeo(W * 0.94, rh * 0.84, 0.06), wallM, ridgeX ? k * (W + 0.7) / 2 + k * 0.02 : 0, top + 0.02, ridgeX ? 0 : k * (W + 0.7) / 2 + k * 0.02); if (ridgeX) gw.rotation.y = Math.PI / 2; }
    const ridge = add(new THREE.BoxGeometry(0.16, 0.14, W + 0.8), M(0x3a2414), 0, top + rh, 0); if (ridgeX) ridge.rotation.y = Math.PI / 2;
    if (R() < 0.85) { const cx = (R() < 0.5 ? -1 : 1) * W * 0.28, cz = (R() < 0.5 ? -1 : 1) * W * 0.18;           // 굴뚝
      add(new THREE.BoxGeometry(0.55, 1.0, 0.55), M(0x7a5a4a), cx, top + rh * 0.62, cz); add(new THREE.BoxGeometry(0.7, 0.12, 0.7), M(0x5a4a40), cx, top + rh * 0.62 + 0.55, cz); }
    add(new THREE.BoxGeometry(0.7, 1.25, 0.1), doorM, dOff, 0.3 + 0.62, W / 2 + 0.04);                          // 문 + 문틀 + 처마
    add(new THREE.BoxGeometry(0.9, 0.12, 0.12), beamM, dOff, 0.3 + 1.28, W / 2 + 0.07);
    add(new THREE.BoxGeometry(0.1, 0.12, 0.34), beamM, dOff + 0.45, 0.3 + 1.3, W / 2 + 0.14); add(new THREE.BoxGeometry(0.1, 0.12, 0.34), beamM, dOff - 0.45, 0.3 + 1.3, W / 2 + 0.14);
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 6), M(0xc8a040), dOff + 0.22, 0.3 + 0.62, W / 2 + 0.1).rotation.x = Math.PI / 2;
    for (const sx of [-1, 1]) {                                                                                 // 덧문 달린 창 + 화단
      const wx = sx * W * 0.32, wy = 0.3 + H * 0.58; if (Math.abs(wx - dOff) < 0.75) continue;
      add(new THREE.BoxGeometry(0.52, 0.52, 0.06), windowGlow, wx, wy, W / 2 + 0.03);
      add(new THREE.BoxGeometry(0.62, 0.08, 0.1), beamM, wx, wy + 0.3, W / 2 + 0.06); add(new THREE.BoxGeometry(0.62, 0.08, 0.1), beamM, wx, wy - 0.3, W / 2 + 0.06);
      add(new THREE.BoxGeometry(0.16, 0.5, 0.05), beamM, wx - 0.36, wy, W / 2 + 0.06); add(new THREE.BoxGeometry(0.16, 0.5, 0.05), beamM, wx + 0.36, wy, W / 2 + 0.06);
      add(new THREE.BoxGeometry(0.6, 0.14, 0.22), M(0x6b4a2a), wx, wy - 0.42, W / 2 + 0.15); add(new THREE.BoxGeometry(0.5, 0.12, 0.16), flowerM, wx, wy - 0.32, W / 2 + 0.15);
    }
    if (H > 2) for (const wx of [-0.7, 0.7]) add(new THREE.BoxGeometry(0.46, 0.46, 0.06), windowGlow, wx, 0.3 + H * 0.82, W / 2 + 0.03);    // 2층 창
    for (const sz of [-1, 1]) for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.06, 0.5, 0.5), windowGlow, sx * (W / 2 + 0.03), 0.3 + H * 0.58, sz * W * 0.22);   // 옆 창
    if (stone && R() < 0.65) { add(new THREE.BoxGeometry(0.7, 0.6, 0.7), M(0x4a4f5c), 0, top + rh * 0.35, W * 0.45); add(new THREE.BoxGeometry(0.4, 0.4, 0.05), windowGlow, 0, top + rh * 0.35, W * 0.45 + 0.37); }   // 지붕창
    const side = R() < 0.5 ? -1 : 1;
    if (R() < 0.5) {                                                                                            // 한쪽에 덧붙인 헛간 (경사 지붕)
      add(new THREE.BoxGeometry(1.3, 1.1, W * 0.65), wallM, side * (W / 2 + 0.6), 0.3 + 0.55, -0.2);
      const sh = add(new THREE.BoxGeometry(1.8, 0.1, W * 0.75), roofM, side * (W / 2 + 0.55), 0.3 + 1.25, -0.2); sh.rotation.z = -side * 0.35;
    } else if (R() < 0.8) {                                                                                     // 문 옆의 통과 장작더미 / 통
      if (R() < 0.5) { for (let i = 0; i < 3; i++) add(new THREE.CylinderGeometry(0.14, 0.14, 0.9, 6), M(0x7a4f2a), -side * (W / 2 - 0.1) - side * (i % 2) * 0.1, 0.4 + (i > 1 ? 0.25 : 0), W / 2 + 0.4 + (i % 2) * 0.3).rotation.z = Math.PI / 2; }
      else { add(new THREE.CylinderGeometry(0.28, 0.3, 0.6, 8), M(0x6b4a2a), side * (W / 2 - 0.2), 0.6, W / 2 + 0.45); add(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 8), M(0x3a78c8), side * (W / 2 - 0.2), 0.92, W / 2 + 0.45); }
    }
  }
  function keepModel(add, stage) {                                           // 석조 성채: 3단계 키프, 4단계 큰 성채, 5단계 금빛 왕좌의 방
    const gold = stage >= 5, big = stage >= 4, W = big ? 7.4 : 6.0, H = big ? 3.8 : 3.3, stoneM = M(0x8d9098), darkM = M(0x6a6e78), lightM = M(0xa9acb4), roofM = gold ? new THREE.MeshStandardMaterial({ color: 0xe0b040, flatShading: true, roughness: 0.55, metalness: 0.3 }) : M(0x6b2a2a), dark = M(0x1e1a16);
    add(new THREE.BoxGeometry(W + 0.9, 0.45, W + 0.9), darkM, 0, 0.22, 0);                                       // 기단
    add(new THREE.BoxGeometry(W, H, W), stoneM, 0, 0.45 + H / 2, 0);
    const top = 0.45 + H;
    add(new THREE.BoxGeometry(W + 0.5, 0.35, W + 0.5), lightM, 0, top + 0.1, 0);                                 // 처마 띠
    const step = 0.95, n = Math.floor(W / step);                                                                 // 흉벽: 네 변에 이빨 모양
    for (let i = 0; i < n; i++) { const t = (i - (n - 1) / 2) * step; for (const [px, pz] of [[t, W / 2 + 0.1], [t, -W / 2 - 0.1], [W / 2 + 0.1, t], [-W / 2 - 0.1, t]]) add(new THREE.BoxGeometry(0.55, 0.55, 0.55), lightM, px, top + 0.55, pz); }
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {                                               // 모서리 원통 탑 + 이빨 + 원뿔 지붕 + 깃발
      const tx = sx * (W / 2), tz = sz * (W / 2), th = H + (big ? 2.6 : 2.0);
      add(new THREE.CylinderGeometry(1.25, 1.35, th, 12), darkM, tx, 0.45 + th / 2, tz);
      add(new THREE.CylinderGeometry(1.5, 1.4, 0.4, 12), lightM, tx, 0.45 + th + 0.05, tz);
      add(new THREE.ConeGeometry(1.55, 1.9, 12), roofM, tx, 0.45 + th + 1.25, tz);
      add(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 5), M(0x4a301c), tx, 0.45 + th + 2.7, tz);
      add(new THREE.BoxGeometry(0.8, 0.45, 0.04), gold ? M(0xe0b040) : M(0xb02a2a), tx + 0.42, 0.45 + th + 3.2, tz);
      add(new THREE.BoxGeometry(0.1, 0.55, 0.06), dark, tx, 0.45 + th * 0.6, tz + sz * 1.26);                    // 화살 구멍
    }
    for (const [dx, dz, ry] of [[0, 1, 0], [0, -1, 0], [1, 0, 1], [-1, 0, 1]]) {                                  // 벽면: 화살 구멍과 창, 앞면에는 문
      const px = dx * (W / 2 + 0.03), pz = dz * (W / 2 + 0.03);
      for (const o of [-1.8, 1.8]) { const m = add(new THREE.BoxGeometry(0.16, 0.7, 0.08), dark, dx ? px : o, 0.45 + H * 0.6, dz ? pz : o); if (ry) m.rotation.y = Math.PI / 2; }
    }
    add(new THREE.BoxGeometry(1.7, 2.3, 0.2), dark, 0, 0.45 + 1.15, W / 2 + 0.06);                                // 정문(아치) + 쇠창살 + 문틀
    add(new THREE.CylinderGeometry(0.85, 0.85, 0.2, 14, 1, false, 0, Math.PI), dark, 0, 0.45 + 2.3, W / 2 + 0.06).rotation.set(Math.PI / 2, 0, Math.PI / 2);
    add(new THREE.BoxGeometry(2.1, 0.2, 0.3), lightM, 0, 0.45 + 2.0 + 0.9 + 0.2, W / 2 + 0.1);
    for (let i = -2; i <= 2; i++) add(new THREE.BoxGeometry(0.06, 2.4, 0.06), M(0x55585f), i * 0.3, 0.45 + 1.2, W / 2 + 0.2);
    const dh = big ? 3.2 : 2.6, dw = big ? 4.2 : 3.4;                                                            // 중앙 주탑
    add(new THREE.BoxGeometry(dw, dh, dw), stoneM, 0, top + 0.28 + dh / 2, 0);
    const dn = Math.floor(dw / 0.9);
    for (let i = 0; i < dn; i++) { const t = (i - (dn - 1) / 2) * 0.9; for (const [px, pz] of [[t, dw / 2], [t, -dw / 2], [dw / 2, t], [-dw / 2, t]]) add(new THREE.BoxGeometry(0.5, 0.5, 0.5), lightM, px, top + 0.28 + dh + 0.25, pz); }
    add(new THREE.ConeGeometry(dw * 0.66, 2.0, 4), roofM, 0, top + 0.28 + dh + 1.1, 0).rotation.y = Math.PI / 4;
    for (const [px, pz] of [[0, dw / 2 + 0.03], [0, -dw / 2 - 0.03]]) add(new THREE.BoxGeometry(0.5, 0.8, 0.06), windowGlow, px, top + 0.28 + dh * 0.55, pz);
    add(new THREE.CylinderGeometry(0.05, 0.05, 2.0, 5), M(0x4a301c), 0, top + 0.28 + dh + 3.0, 0);
    add(new THREE.BoxGeometry(1.1, 0.6, 0.05), gold ? M(0xe0b040) : M(0xb02a2a), 0.55, top + 0.28 + dh + 3.4, 0);
    if (gold) {                                                                                                  // 5단계: 정문 앞 계단과 양옆 금빛 깃발
      add(new THREE.BoxGeometry(3.6, 0.2, 1.2), lightM, 0, 0.1, W / 2 + 0.9); add(new THREE.BoxGeometry(2.8, 0.2, 0.9), lightM, 0, 0.3, W / 2 + 0.7);
      for (const sx of [-1, 1]) { add(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 6), M(0x4a301c), sx * 2.3, 1.7, W / 2 + 1.1); add(new THREE.BoxGeometry(0.7, 1.1, 0.04), M(0xe0b040), sx * 2.3 + 0.38, 2.6, W / 2 + 1.1); }
    }
  }

  function townHallModel(add) {                                              // 2단계 마을 회관: 목골 2층 + 박공 지붕 + 현관 지붕 + 종탑 (정면은 +z)
    const wall = M(0xd9c196), beam = M(0x4a301c), roof = M(0x9a3f24), roofDk = M(0x7c3019), stone = M(0x6f7078), door = M(0x3a2414), glow = new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffa030, emissiveIntensity: 0.5, flatShading: true });
    const W = 4.6, H = 2.9, B = 0.35, T = B + H;
    add(new THREE.BoxGeometry(W + 0.5, B, W + 0.5), stone, 0, B / 2, 0);                                           // 돌 기단
    add(new THREE.BoxGeometry(W, H, W), wall, 0, B + H / 2, 0);
    add(new THREE.BoxGeometry(W + 0.14, 0.2, W + 0.14), beam, 0, B + H * 0.52, 0);                                  // 2층 허리 들보
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(new THREE.BoxGeometry(0.24, H, 0.24), beam, sx * W / 2, B + H / 2, sz * W / 2);
    for (const sx of [-0.5, 0.5]) for (const sz of [-1, 1]) add(new THREE.BoxGeometry(0.14, H, 0.14), beam, sx * W * 0.5, B + H / 2, sz * (W / 2 + 0.01) * 1);
    for (const sz of [-1, 1]) for (const sx of [-1, 1]) { const br = add(new THREE.BoxGeometry(0.12, 1.3, 0.12), beam, sx * W * 0.3, B + H * 0.27, sz * (W / 2 + 0.02)); br.rotation.z = -sx * 0.7; }
    const roofLen = W + 1.0, gh = 2.1;                                                                              // 용마루가 좌우(x)로 달린 박공 지붕
    const g = gableGeo(W + 0.9, gh, roofLen); const r = add(g, roof, 0, T, 0); r.rotation.y = Math.PI / 2;
    for (const sz of [-1, 1]) { const sl = add(new THREE.BoxGeometry(roofLen + 0.1, 0.12, 0.16), roofDk, 0, T + gh + 0.02, 0); sl.scale.z = 1; }
    add(new THREE.BoxGeometry(roofLen + 0.2, 0.16, 0.22), roofDk, 0, T + gh, 0);                                    // 용마루
    for (const sx of [-1, 1]) {                                                                                     // 양 끝 박공 벽(회반죽) + 들보
      const gw = add(gableGeo(W + 0.5, gh - 0.1, 0.1), wall, sx * (roofLen / 2 - 0.1), T + 0.02, 0); gw.rotation.y = Math.PI / 2;
    }
    add(new THREE.BoxGeometry(0.6, 1.7, 0.6), stone, 1.5, T + 1.0, -1.1); add(new THREE.BoxGeometry(0.75, 0.16, 0.75), stone, 1.5, T + 1.95, -1.1);   // 굴뚝
    // 정면(+z): 큰 이중문 + 현관 지붕과 기둥 + 창
    add(new THREE.BoxGeometry(1.5, 1.9, 0.14), door, 0, B + 0.95, W / 2 + 0.04); add(new THREE.BoxGeometry(0.06, 1.9, 0.16), beam, 0, B + 0.95, W / 2 + 0.06);
    add(new THREE.BoxGeometry(1.8, 0.16, 0.18), beam, 0, B + 1.98, W / 2 + 0.06);
    for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.2, 2.2, 0.2), beam, sx * 1.05, B + 1.1, W / 2 + 1.0);
    const pr = add(new THREE.BoxGeometry(2.8, 0.14, 1.4), roof, 0, B + 2.3, W / 2 + 0.7); pr.rotation.x = 0.28;
    add(new THREE.BoxGeometry(2.0, 0.12, 1.0), stone, 0, B + 0.06, W / 2 + 0.7);                                    // 현관 바닥
    for (const sx of [-1.45, 1.45]) { add(new THREE.BoxGeometry(0.7, 0.8, 0.1), glow, sx, B + 0.9, W / 2 + 0.04); add(new THREE.BoxGeometry(0.9, 0.1, 0.14), beam, sx, B + 1.36, W / 2 + 0.06); add(new THREE.BoxGeometry(0.9, 0.1, 0.18), M(0x3f6b34), sx, B + 0.46, W / 2 + 0.12); }
    for (const sx of [-1.45, 0, 1.45]) { add(new THREE.BoxGeometry(0.6, 0.7, 0.1), glow, sx, B + H * 0.76, W / 2 + 0.04); add(new THREE.BoxGeometry(0.1, 0.8, 0.14), beam, sx - 0.38, B + H * 0.76, W / 2 + 0.07); add(new THREE.BoxGeometry(0.1, 0.8, 0.14), beam, sx + 0.38, B + H * 0.76, W / 2 + 0.07); }
    for (const sz of [-0.9, 0.9]) add(new THREE.BoxGeometry(0.1, 0.7, 0.6), glow, W / 2 + 0.04, B + H * 0.55, sz);   // 옆 창
    add(new THREE.BoxGeometry(0.5, 0.9, 0.5), M(0x5a3a22), 0, T + gh + 0.45, 0);                                   // 종탑
    add(new THREE.BoxGeometry(0.32, 0.4, 0.32), M(0xc9a23a), 0, T + gh + 0.7, 0);
    add(new THREE.ConeGeometry(0.55, 0.7, 4), roofDk, 0, T + gh + 1.25, 0).rotation.y = Math.PI / 4;
    add(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 5), beam, 0, T + gh + 1.9, 0);                                  // 깃대와 깃발
    add(new THREE.BoxGeometry(0.7, 0.4, 0.04), M(0xc23a2a), 0.36, T + gh + 2.25, 0);
  }

  function barracksModel(add) {                                              // 병영: 돌 기단 + 목골 긴 건물 + 박공 지붕 + 문 앞 무기 걸이와 방패 (정면은 +z, 크기 6.4x4.4)
    const wall = M(0xb9b3a4), beam = M(0x4a301c), roof = M(0x5a4a42), roofDk = M(0x3f332e), stone = M(0x6f7078), door = M(0x3a2414), iron = M(0x8d9199), red = M(0xb3342a), blue = M(0x2f4f8f);
    const glow = new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffa030, emissiveIntensity: 0.5, flatShading: true });
    const L = 6.4, D = 4.4, H = 1.9, B = 0.3, T = B + H;
    add(new THREE.BoxGeometry(L + 0.4, B, D + 0.4), stone, 0, B / 2, 0);
    add(new THREE.BoxGeometry(L, H, D), wall, 0, B + H / 2, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new THREE.BoxGeometry(0.3, H, 0.3), beam, sx * L / 2, B + H / 2, sz * D / 2);
    for (const sx of [-2.1, -0.7, 0.7, 2.1]) for (const sz of [-1, 1]) add(new THREE.BoxGeometry(0.14, H, 0.14), beam, sx, B + H / 2, sz * (D / 2 + 0.02));
    for (const sz of [-1, 1]) add(new THREE.BoxGeometry(L + 0.1, 0.16, 0.16), beam, 0, T - 0.05, sz * (D / 2 + 0.02));
    const gh = 1.7;                                                                                              // 용마루가 x 방향인 지붕
    add(gableGeo(D + 0.9, gh, L + 0.8), roof, 0, T, 0).rotation.y = Math.PI / 2;
    add(new THREE.BoxGeometry(L + 0.9, 0.14, 0.2), roofDk, 0, T + gh, 0);
    for (const sx of [-1, 1]) add(gableGeo(D + 0.4, gh - 0.1, 0.1), wall, sx * (L / 2 + 0.3), T + 0.02, 0).rotation.y = Math.PI / 2;
    add(new THREE.BoxGeometry(0.6, 1.5, 0.6), stone, -2.2, T + 0.9, -0.8); add(new THREE.BoxGeometry(0.75, 0.14, 0.75), stone, -2.2, T + 1.7, -0.8);
    add(new THREE.BoxGeometry(1.4, 1.5, 0.12), door, 0, B + 0.75, D / 2 + 0.04); add(new THREE.BoxGeometry(0.06, 1.5, 0.14), beam, 0, B + 0.75, D / 2 + 0.06);   // 큰 문과 문틀
    add(new THREE.BoxGeometry(1.7, 0.18, 0.2), beam, 0, B + 1.58, D / 2 + 0.06);
    for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.14, 1.6, 0.14), beam, sx * 0.78, B + 0.8, D / 2 + 0.06);
    for (const wx of [-2.3, -1.3, 1.3, 2.3]) { add(new THREE.BoxGeometry(0.55, 0.5, 0.1), glow, wx, B + 1.1, D / 2 + 0.04); add(new THREE.BoxGeometry(0.7, 0.08, 0.14), beam, wx, B + 1.4, D / 2 + 0.06); }
    for (const sx of [-1.9, 1.9]) { add(new THREE.CylinderGeometry(0.4, 0.4, 0.08, 10), sx < 0 ? red : blue, sx, B + 1.0, D / 2 + 0.12).rotation.x = Math.PI / 2; add(new THREE.CylinderGeometry(0.1, 0.1, 0.1, 8), iron, sx, B + 1.0, D / 2 + 0.17).rotation.x = Math.PI / 2; }   // 방패 장식
    for (const sx of [-1, 1]) { add(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 5), beam, sx * 1.15, B + 0.9, D / 2 + 0.5); add(new THREE.SphereGeometry(0.1, 6, 5), glow, sx * 1.15, B + 1.85, D / 2 + 0.5); }   // 횃불
    add(new THREE.BoxGeometry(1.8, 0.1, 0.1), beam, 2.7, B + 1.0, D / 2 + 0.5);                                   // 창 걸이대
    for (const sx of [2.0, 2.7, 3.4]) add(new THREE.BoxGeometry(0.1, 1.2, 0.1), beam, sx > 3 ? 3.4 : sx, B + 0.6, D / 2 + 0.5);
    for (const sx of [2.2, 2.5, 2.8, 3.1]) { add(new THREE.CylinderGeometry(0.03, 0.03, 1.9, 4), beam, sx, B + 1.05, D / 2 + 0.4); add(new THREE.ConeGeometry(0.07, 0.25, 4), iron, sx, B + 2.1, D / 2 + 0.4); }
    add(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 5), beam, 0, T + gh + 0.9, 0); add(new THREE.BoxGeometry(0.8, 0.5, 0.04), red, 0.42, T + gh + 1.7, 0);   // 지붕 위 깃발
  }

  function lumberModel(add) {                                                // 벌목장: 통나무 오두막 + 나무 켜는 틀 + 쌓인 통나무와 그루터기 + 도끼
    const log = M(0x7a4f2a), logDk = M(0x5a3a1e), roof = M(0x6b4a2b), cut = M(0xd9b98a), beam = M(0x4a301c), iron = M(0x8d9199), stone = M(0x6f7078);
    add(new THREE.BoxGeometry(2.6, 0.2, 2.2), stone, 0, 0.1, 0);
    for (let i = 0; i < 5; i++) add(new THREE.CylinderGeometry(0.2, 0.2, 2.3, 8), i % 2 ? log : logDk, 0, 0.35 + i * 0.3, 0).rotation.z = Math.PI / 2;      // 쌓은 통나무 벽 (앞뒤는 얇게)
    for (const sz of [-0.95, 0.95]) for (let i = 0; i < 5; i++) add(new THREE.CylinderGeometry(0.2, 0.2, 2.3, 8), i % 2 ? log : logDk, 0, 0.35 + i * 0.3, sz).rotation.z = Math.PI / 2;
    add(new THREE.BoxGeometry(2.3, 1.5, 1.7), logDk, 0, 0.95, 0);
    const rf = add(gableGeo(3.0, 1.0, 2.8), roof, 0, 1.7, 0); rf.rotation.y = Math.PI / 2;
    add(new THREE.BoxGeometry(2.8, 0.1, 0.14), beam, 0, 2.72, 0);
    add(new THREE.BoxGeometry(0.6, 1.0, 0.1), M(0x3a2414), 0, 0.7, 1.0);                                           // 문
    add(new THREE.BoxGeometry(0.5, 0.45, 0.08), new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffa030, emissiveIntensity: 0.4 }), 0.8, 1.1, 1.0);
    for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.12, 1.1, 0.12), beam, sx * 0.9, 0.55, -2.0);               // 톱질 틀 (X자)
    add(new THREE.BoxGeometry(2.0, 0.14, 0.14), beam, 0, 0.75, -2.0);
    for (const sx of [-1, 1]) { const x = add(new THREE.BoxGeometry(0.1, 1.2, 0.1), beam, sx * 0.9, 0.6, -2.0); x.rotation.z = sx * 0.5; }
    add(new THREE.CylinderGeometry(0.22, 0.22, 1.9, 8), log, 0, 0.95, -2.0).rotation.z = Math.PI / 2;                 // 켜는 중인 통나무
    add(new THREE.CylinderGeometry(0.4, 0.45, 0.45, 8), logDk, 1.9, 0.22, 1.1); add(new THREE.CylinderGeometry(0.36, 0.36, 0.05, 8), cut, 1.9, 0.46, 1.1);   // 그루터기
    add(new THREE.BoxGeometry(0.08, 0.55, 0.08), beam, 1.9, 0.75, 1.1).rotation.z = 0.5; add(new THREE.BoxGeometry(0.3, 0.2, 0.05), iron, 2.05, 0.95, 1.1);    // 꽂힌 도끼
    for (let r = 0; r < 3; r++) for (let i = 0; i < 3 - r; i++) add(new THREE.CylinderGeometry(0.22, 0.22, 1.6, 8), r ? log : logDk, 2.0, 0.22 + r * 0.38, -1.0 + i * 0.5 + r * 0.25).rotation.z = Math.PI / 2;   // 통나무 더미
    for (const sz of [-1.0, 1.0]) add(new THREE.BoxGeometry(0.08, 0.08, 0.06), cut, 2.82, 0.4, sz * 0.4);
  }

  function quarryModel(add) {                                                // 채석장: 깎인 바위 단 + 돌 블록 + 크레인(도르래) + 수레 + 곡괭이
    const rock = M(0x9a9aa2), rockDk = M(0x7c7d86), block = M(0xb4b6bc), beam = M(0x4a301c), rope = M(0xc9b28a), iron = M(0x8d9199), cart = M(0x7a4f2a);
    add(new THREE.BoxGeometry(3.2, 0.5, 2.4), rockDk, -0.6, 0.25, -0.3); add(new THREE.BoxGeometry(2.4, 0.5, 1.8), rock, -0.8, 0.75, -0.5); add(new THREE.BoxGeometry(1.5, 0.5, 1.2), rockDk, -1.0, 1.25, -0.6);   // 깎아 낸 계단식 바위
    add(new THREE.DodecahedronGeometry(0.6, 0), rock, -1.9, 0.5, 0.6);
    for (const [x, z, s] of [[1.0, 0.9, 0.8], [1.9, 0.6, 0.7], [1.3, 1.6, 0.6]]) { add(new THREE.BoxGeometry(s, s * 0.7, s), block, x, s * 0.35, z).rotation.y = x; }   // 다듬은 돌 블록
    add(new THREE.BoxGeometry(0.8, 0.5, 0.8), block, 1.5, 1.05, 0.9).rotation.y = 0.4;
    add(new THREE.BoxGeometry(0.16, 2.6, 0.16), beam, 0.6, 1.3, -0.9);                                              // 크레인 기둥과 팔
    add(new THREE.BoxGeometry(1.8, 0.14, 0.14), beam, 1.4, 2.5, -0.9);
    const br = add(new THREE.BoxGeometry(0.1, 1.2, 0.1), beam, 0.95, 2.0, -0.9); br.rotation.z = 0.8;
    add(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 4), rope, 2.1, 1.9, -0.9); add(new THREE.BoxGeometry(0.5, 0.35, 0.5), block, 2.1, 1.1, -0.9);
    add(new THREE.BoxGeometry(0.9, 0.35, 0.6), cart, -2.0, 0.55, 1.5); for (const sx of [-0.3, 0.3]) add(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 8), M(0x3a2414), -2.0 + sx, 0.25, 1.82).rotation.x = Math.PI / 2;   // 수레
    for (const sx of [-0.3, 0.3]) add(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 8), M(0x3a2414), -2.0 + sx, 0.25, 1.18).rotation.x = Math.PI / 2;
    add(new THREE.DodecahedronGeometry(0.3, 0), rock, -2.0, 0.85, 1.5);
    add(new THREE.BoxGeometry(0.08, 1.0, 0.08), beam, 0.1, 0.5, 1.4).rotation.z = 0.4; add(new THREE.BoxGeometry(0.5, 0.1, 0.1), iron, -0.05, 0.98, 1.4);      // 기대 둔 곡괭이
  }

  function towerModel(add) {                                                 // 방어 타워: 비탈진 돌 기단 + 돌 몸통 + 화살 구멍 + 돌출 흉벽 + 목재 지붕과 깃발 (궁수 높이는 y≈4.3 유지)
    const st = M(0x7f838c), stDk = M(0x6a6e77), top = M(0x5c606a), wood = M(0x6b4a2b), roof = M(0x8c3a24), flag = M(0xc23a2a), slit = M(0x14161c);
    add(new THREE.CylinderGeometry(1.7, 1.9, 0.6, 10), stDk, 0, 0.3, 0);
    add(new THREE.CylinderGeometry(1.2, 1.5, 3.4, 10), st, 0, 2.3, 0);
    for (const y of [1.2, 2.2, 3.1]) add(new THREE.CylinderGeometry(1.5 - (y - 0.6) * 0.08, 1.5 - (y - 0.6) * 0.08, 0.1, 10), stDk, 0, y, 0);   // 돌 단 줄
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + Math.PI / 4; add(new THREE.BoxGeometry(0.12, 0.6, 0.12), slit, Math.cos(a) * 1.3, 2.4, Math.sin(a) * 1.3); }   // 화살 구멍
    add(new THREE.CylinderGeometry(1.0, 1.0, 0.7, 8), slit, 0, 0.7, 1.45).scale.set(0.5, 1, 0.1);                   // 문
    add(new THREE.CylinderGeometry(1.85, 1.3, 0.5, 10), top, 0, 4.0, 0);                                            // 밖으로 돌출한 받침
    add(new THREE.CylinderGeometry(1.8, 1.8, 0.16, 10), wood, 0, 4.3, 0);                                           // 전망 바닥
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; add(new THREE.BoxGeometry(0.5, 0.5, 0.45), top, Math.cos(a) * 1.7, 4.65, Math.sin(a) * 1.7).rotation.y = -a; }   // 흉벽
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + Math.PI / 4; add(new THREE.BoxGeometry(0.14, 1.6, 0.14), wood, Math.cos(a) * 1.0, 5.3, Math.sin(a) * 1.0); }   // 지붕 기둥
    add(new THREE.ConeGeometry(1.55, 1.0, 8), roof, 0, 6.4, 0);
    add(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 5), wood, 0, 7.4, 0); add(new THREE.BoxGeometry(0.6, 0.35, 0.04), flag, 0.3, 7.7, 0);
  }

  // ---------- 5단계 '권좌의 도시' 건물: 광장 분수, 집결장(깃발 터), 가축 우리 ----------
  function plazaModel(add) {                                                 // 광장: 둥근 포석 + 분수 + 가로등 네 개 + 긴 의자
    add(new THREE.CylinderGeometry(3.0, 3.1, 0.14, 24), M(0x9b9a94), 0, 0.07, 0);
    add(new THREE.CylinderGeometry(2.1, 2.2, 0.1, 24), M(0xb5b3aa), 0, 0.17, 0);
    add(new THREE.CylinderGeometry(1.35, 1.5, 0.55, 16), M(0x8d9098), 0, 0.42, 0);                              // 분수 테두리
    add(new THREE.CylinderGeometry(1.15, 1.15, 0.08, 16), new THREE.MeshStandardMaterial({ color: 0x3a78c8, roughness: 0.25 }), 0, 0.66, 0);
    add(new THREE.CylinderGeometry(0.22, 0.3, 1.3, 8), M(0xa9acb4), 0, 1.2, 0);                                // 가운데 기둥
    add(new THREE.CylinderGeometry(0.6, 0.3, 0.2, 10), M(0xa9acb4), 0, 1.85, 0);
    add(new THREE.SphereGeometry(0.2, 8, 6), M(0xe0b040), 0, 2.15, 0);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      add(new THREE.CylinderGeometry(0.06, 0.07, 2.1, 6), M(0x2f3036), sx * 2.5, 1.05, sz * 2.5);
      add(new THREE.SphereGeometry(0.2, 8, 6), lampGlow, sx * 2.5, 2.2, sz * 2.5);
    }
    for (const s of [-1, 1]) { add(new THREE.BoxGeometry(1.6, 0.12, 0.4), woodMat2, 0, 0.5, s * 2.15); for (const dx of [-0.65, 0.65]) add(new THREE.BoxGeometry(0.12, 0.4, 0.34), M(0x6a6e78), dx, 0.22, s * 2.15); }
  }
  function musterModel(add) {                                                // 집결장: 다진 흙 마당 + 깃발 세 개(깃발 색) + 무기 걸이 + 단상
    add(new THREE.BoxGeometry(9, 0.1, 6.4), M(0x8a6c48), 0, 0.05, 0);
    add(new THREE.BoxGeometry(9.5, 0.2, 0.3), M(0x6a6e78), 0, 0.1, 3.3); add(new THREE.BoxGeometry(9.5, 0.2, 0.3), M(0x6a6e78), 0, 0.1, -3.3);
    add(new THREE.BoxGeometry(0.3, 0.2, 6.4), M(0x6a6e78), 4.6, 0.1, 0); add(new THREE.BoxGeometry(0.3, 0.2, 6.4), M(0x6a6e78), -4.6, 0.1, 0);
    CFG.BANNER.COLORS.forEach((c, i) => {
      const x = (i - 1) * 2.8;
      add(new THREE.CylinderGeometry(0.07, 0.09, 4.4, 6), M(0x4a301c), x, 2.3, -2.2);
      add(new THREE.BoxGeometry(1.2, 1.5, 0.05), M(c), x + 0.65, 3.7, -2.2);
      add(new THREE.BoxGeometry(1.0, 0.18, 0.06), M(0x2a2a30), x + 0.65, 2.85, -2.2);
    });
    add(new THREE.BoxGeometry(2.6, 0.45, 1.6), woodMat2, 0, 0.3, 0.4);                                           // 단상
    add(new THREE.BoxGeometry(0.1, 1.5, 2.6), woodMat2, 3.6, 0.85, 1.2);                                         // 무기 걸이
    for (const z of [0.4, 1.2, 2.0]) add(new THREE.BoxGeometry(0.06, 1.3, 0.06), M(0x9aa0aa), 3.5, 1.0, z);
    for (const z of [-0.4, 0.4]) add(new THREE.CylinderGeometry(0.4, 0.4, 0.12, 12), M(0xb02a2a), 3.4, 0.9, 2.9 + z * 0).rotation.z = Math.PI / 2;
  }
  function penModel(add, seed) {                                             // 가축 우리: 나무 울타리 + 건초 + 양 (seed 로 마리 수가 조금 달라진다)
    const w = 5.2, d = 4.2, post = M(0x6b4a2a), rnd = rngOf(seed || 7);
    add(new THREE.BoxGeometry(w, 0.06, d), M(0x6f8a3a), 0, 0.03, 0);
    for (const z of [-d / 2, d / 2]) for (const y of [0.45, 0.85]) add(new THREE.BoxGeometry(w, 0.09, 0.09), post, 0, y, z);
    for (const x of [-w / 2, w / 2]) for (const y of [0.45, 0.85]) add(new THREE.BoxGeometry(0.09, 0.09, d), post, x, y, 0);
    for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2], [0, -d / 2], [0, d / 2]]) add(new THREE.BoxGeometry(0.14, 1.1, 0.14), post, x, 0.55, z);
    add(new THREE.BoxGeometry(1.2, 0.6, 0.9), M(0xd8b848), w / 2 - 1.0, 0.3, -d / 2 + 0.8);                      // 건초 더미
    const n = 3 + Math.floor(rnd() * 3), wool = M(0xeeeeea), face = M(0x3a3430);
    for (let i = 0; i < n; i++) {
      const x = (rnd() - 0.5) * (w - 1.8) - 0.4, z = (rnd() - 0.5) * (d - 1.2), ry = rnd() * 6.28;
      const b = add(new THREE.BoxGeometry(0.9, 0.55, 0.55), wool, x, 0.55, z); b.rotation.y = ry;
      const h = add(new THREE.BoxGeometry(0.28, 0.28, 0.28), face, x + Math.cos(ry) * 0.55, 0.65, z - Math.sin(ry) * 0.55);
      for (const [lx, lz] of [[-0.3, -0.2], [0.3, -0.2], [-0.3, 0.2], [0.3, 0.2]]) add(new THREE.BoxGeometry(0.1, 0.3, 0.1), face, x + lx * Math.cos(ry) + lz * Math.sin(ry), 0.15, z - lx * Math.sin(ry) + lz * Math.cos(ry));
    }
  }

