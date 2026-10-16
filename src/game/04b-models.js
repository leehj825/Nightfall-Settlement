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
  function musterModel(add) {                                                // 집결장(작게): 다진 흙 마당 + 깃발 세 개(깃발 색) + 단상 + 무기 걸이
    add(new THREE.BoxGeometry(6.2, 0.1, 4.4), M(0x8a6c48), 0, 0.05, 0);
    for (const z of [-2.25, 2.25]) add(new THREE.BoxGeometry(6.5, 0.18, 0.22), M(0x6a6e78), 0, 0.09, z);
    for (const x of [-3.15, 3.15]) add(new THREE.BoxGeometry(0.22, 0.18, 4.4), M(0x6a6e78), x, 0.09, 0);
    CFG.BANNER.COLORS.forEach((c, i) => {
      const x = (i - 1) * 1.9;
      add(new THREE.CylinderGeometry(0.06, 0.08, 3.6, 6), M(0x4a301c), x, 1.9, -1.5);
      add(new THREE.BoxGeometry(1.0, 1.2, 0.05), M(c), x + 0.55, 3.0, -1.5);
    });
    add(new THREE.BoxGeometry(1.8, 0.4, 1.1), woodMat2, 0, 0.25, 0.5);                                           // 단상
    add(new THREE.BoxGeometry(0.1, 1.2, 1.8), woodMat2, 2.5, 0.7, 0.9);                                           // 무기 걸이
    for (const z of [0.3, 0.9, 1.5]) add(new THREE.BoxGeometry(0.06, 1.0, 0.06), M(0x9aa0aa), 2.4, 0.85, z);
  }
  function penModel(add, seed, add0) {                                       // 가축 우리: 나무 울타리 + 건초 + 양 (seed 로 마리 수가 조금 달라진다)
    const w = 5.2, d = 4.2, post = M(0x6b4a2a), rnd = rngOf(seed || 7);
    add(new THREE.BoxGeometry(w, 0.06, d), M(0x6f8a3a), 0, 0.03, 0);
    for (const z of [-d / 2, d / 2]) for (const y of [0.45, 0.85]) add(new THREE.BoxGeometry(w, 0.09, 0.09), post, 0, y, z);
    for (const x of [-w / 2, w / 2]) for (const y of [0.45, 0.85]) add(new THREE.BoxGeometry(0.09, 0.09, d), post, x, y, 0);
    for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2], [0, -d / 2], [0, d / 2]]) add(new THREE.BoxGeometry(0.14, 1.1, 0.14), post, x, 0.55, z);
    add(new THREE.BoxGeometry(1.2, 0.6, 0.9), M(0xd8b848), w / 2 - 1.0, 0.3, -d / 2 + 0.8);                      // 건초 더미
    const n = 3 + Math.floor(rnd() * 3), wool = M(0xeeeeea), face = M(0x3a3430), sheep = [];
    for (let i = 0; i < n; i++) {                                                                                 // 양: 그룹 하나 = 몸 + 머리 + 다리 (우리 안을 돌아다닌다)
      const s = new THREE.Group(), body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.55), wool), head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), face);
      body.position.y = 0.55; head.position.set(0.55, 0.65, 0); body.castShadow = head.castShadow = true; s.add(body, head);
      for (const [lx, lz] of [[-0.3, -0.2], [0.3, -0.2], [-0.3, 0.2], [0.3, 0.2]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.1), face); l.position.set(lx, 0.15, lz); s.add(l); }
      s.position.set((rnd() - 0.5) * (w - 1.8) - 0.4, 0, (rnd() - 0.5) * (d - 1.2)); s.rotation.y = rnd() * 6.28;
      s.userData = { tx: s.position.x, tz: s.position.z, wait: rnd() * 3, ph: rnd() * 6, cx: -0.4, cz: 0, bx: 1.7, bz: 1.5, sp: 0.8 }; sheep.push(s); add0(s);
    }
    return sheep;
  }
  function windmillModel(add, g) {                                           // 풍차: 돌 몸통 + 나무 모자 + 돌아가는 날개 네 개 + 곡식 자루
    add(new THREE.CylinderGeometry(1.25, 1.75, 0.5, 10), M(0x8d9098), 0, 0.25, 0);
    add(new THREE.CylinderGeometry(1.0, 1.5, 3.6, 10), M(0xd8cfba), 0, 2.3, 0);
    add(new THREE.CylinderGeometry(1.05, 1.05, 0.2, 10), M(0x6a4a2a), 0, 4.15, 0);
    add(new THREE.ConeGeometry(1.35, 1.6, 10), houseRoof, 0, 5.0, 0);
    add(new THREE.BoxGeometry(0.7, 1.2, 0.12), M(0x4a301c), 0, 0.85, 1.42);                                      // 문
    add(new THREE.BoxGeometry(0.4, 0.5, 0.1), windowGlow, 0, 3.0, 1.2);
    const hub = new THREE.Group(); hub.position.set(0, 4.4, 1.35);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.5, 8), M(0x4a301c)); cap.rotation.x = Math.PI / 2; hub.add(cap);
    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Group(); arm.rotation.z = i * Math.PI / 2;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3.4, 0.1), M(0x6a4a2a)), sail = new THREE.Mesh(new THREE.BoxGeometry(0.75, 2.3, 0.05), M(0xf0e8d0));
      bar.position.y = 1.7; sail.position.set(0.45, 2.0, 0.03); bar.castShadow = sail.castShadow = true; arm.add(bar, sail); hub.add(arm);
    }
    g.add(hub); g.userData.sails = hub;
    for (const [x, z] of [[1.6, 0.6], [1.9, 1.1]]) add(new THREE.CylinderGeometry(0.3, 0.34, 0.5, 8), M(0xc8a860), x, 0.25, z);
  }
  function infirmaryModel(add) {                                             // 병원: 흰 회벽 긴 집 + 붉은 지붕 + 빨간 십자 간판 + 약초밭
    add(new THREE.BoxGeometry(5.6, 0.3, 3.8), M(0x8d9098), 0, 0.15, 0);
    add(new THREE.BoxGeometry(5.0, 2.1, 3.2), M(0xe8e2d2), 0, 1.35, 0);
    const roof = add(gableGeo(5.6, 1.5, 3.8), M(0xa84a3a), 0, 2.4, 0); roof.rotation.y = Math.PI / 2; roof.scale.set(1, 1, 1);
    add(new THREE.BoxGeometry(0.9, 1.5, 0.12), M(0x6a4a2a), 0, 1.05, 1.62);
    for (const x of [-1.7, 1.7]) add(new THREE.BoxGeometry(0.7, 0.6, 0.1), windowGlow, x, 1.7, 1.62);
    add(new THREE.BoxGeometry(1.0, 1.0, 0.08), M(0xf4f4f0), 0, 3.0, 1.66);
    add(new THREE.BoxGeometry(0.62, 0.18, 0.1), M(0xc0302a), 0, 3.0, 1.7); add(new THREE.BoxGeometry(0.18, 0.62, 0.1), M(0xc0302a), 0, 3.0, 1.7);
    add(new THREE.BoxGeometry(2.4, 0.1, 0.9), dirt, 3.4, 0.05, 0.6);
    for (let i = 0; i < 5; i++) add(new THREE.ConeGeometry(0.16, 0.45, 5), cropMat, 2.5 + i * 0.4, 0.3, 0.6);
  }
  function monumentModel(add, g) {                                           // 승전 기념비: 돌 계단 + 비석 + 금빛 꼭대기 + 꺾은 세력마다 전리품 깃발이 오른다
    add(new THREE.CylinderGeometry(1.9, 2.0, 0.25, 12), M(0x8d9098), 0, 0.12, 0); add(new THREE.CylinderGeometry(1.4, 1.5, 0.25, 12), M(0xa9acb4), 0, 0.37, 0);
    add(new THREE.BoxGeometry(0.9, 2.6, 0.9), M(0xb8bac0), 0, 1.7, 0); add(new THREE.ConeGeometry(0.75, 0.8, 4), M(0xe0b040), 0, 3.4, 0).rotation.y = Math.PI / 4;
    add(new THREE.SphereGeometry(0.22, 8, 6), M(0xe0b040), 0, 3.95, 0);
    g.userData.pennants = CFG.REALMS.map((r, i) => {
      const a = i * 2.094 + 0.5, x = Math.cos(a) * 1.35, z = Math.sin(a) * 1.35;
      add(new THREE.CylinderGeometry(0.04, 0.05, 2.4, 5), M(0x4a301c), x, 1.45, z);
      const f = new THREE.Group(), cloth = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.04), M(parseInt(r.color.slice(1), 16))); cloth.position.set(0.32, -0.45, 0); cloth.castShadow = true;
      f.add(cloth); f.position.set(x, 2.6, z); f.visible = false; g.add(f); return f;
    });
  }
  function horseModel(rnd, o) {                                              // 말: 몸통 + 목 + 머리 + 다리 네 개 + 갈기와 꼬리. o = { coat, blanket(안장 담요 색), armor(마갑) }
    o = o || {}; const s = new THREE.Group(), coat = M(o.coat !== undefined ? o.coat : [0x7a4a2a, 0x3a2a22, 0xc8c0a8, 0x9a6a3a][Math.floor(rnd() * 4)]), dark = M(0x2a2018), mk = (g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; s.add(o); return o; };
    mk(new THREE.BoxGeometry(1.5, 0.75, 0.42), coat, 0, 1.15, 0);
    mk(new THREE.BoxGeometry(0.4, 0.8, 0.27), coat, 0.85, 1.5, 0).rotation.z = -0.5;
    mk(new THREE.BoxGeometry(0.6, 0.3, 0.22), coat, 1.2, 1.8, 0);
    mk(new THREE.BoxGeometry(0.15, 0.55, 0.12), dark, 0.62, 1.7, 0).rotation.z = -0.5;
    mk(new THREE.BoxGeometry(0.1, 0.6, 0.12), dark, -0.8, 1.1, 0).rotation.z = 0.35;
    mk(new THREE.BoxGeometry(0.7, 0.08, 0.48), M(o.blanket !== undefined ? o.blanket : 0x8a2a2a), 0.05, 1.56, 0); mk(new THREE.BoxGeometry(0.55, 0.12, 0.34), M(0x4a301c), 0.05, 1.62, 0);        // 안장 담요와 안장
    if (o.armor) {                                                                                               // 마갑: 가슴·목·머리 철판과 이마의 장식
      const steel = M(0x9aa0aa), gold = M(0xe0b040);
      mk(new THREE.BoxGeometry(0.5, 0.65, 0.48), steel, 0.6, 1.1, 0); mk(new THREE.BoxGeometry(0.42, 0.7, 0.3), steel, 0.88, 1.5, 0).rotation.z = -0.5;
      mk(new THREE.BoxGeometry(0.4, 0.2, 0.24), steel, 1.3, 1.9, 0); mk(new THREE.BoxGeometry(0.08, 0.2, 0.08), gold, 1.5, 2.05, 0);
    }
    s.userData.legs = [[-0.6, -0.14], [-0.6, 0.14], [0.6, -0.14], [0.6, 0.14]].map(([lx, lz]) => mk(new THREE.BoxGeometry(0.12, 0.8, 0.12), dark, lx, 0.4, lz));
    return s;
  }
  function stableModel(add, seed, add0) {                                    // 마구간: 나무 외양간(칸막이 셋) + 앞 방목장 울타리 + 말 두 마리
    const rnd = rngOf(seed || 11), wood = M(0x7a5a3a), post = M(0x6b4a2a);
    add(new THREE.BoxGeometry(5.2, 0.1, 6.4), M(0x7a8a3a), 0, 0.05, 0.3);
    add(new THREE.BoxGeometry(5.0, 2.2, 2.6), wood, 0, 1.2, -2.2);
    const roof = add(gableGeo(5.6, 1.3, 2.9), M(0x6a3a2a), 0, 2.3, -2.2); roof.rotation.y = Math.PI / 2;
    for (const x of [-1.6, 0, 1.6]) { add(new THREE.BoxGeometry(1.2, 1.5, 0.1), M(0x3a2a1c), x, 0.85, -0.88); add(new THREE.BoxGeometry(0.1, 1.4, 0.1), post, x + 0.8, 0.7, -0.8); }
    for (const z of [0.2, 3.2]) for (const y of [0.45, 0.85]) add(new THREE.BoxGeometry(5.0, 0.09, 0.09), post, 0, y, z);
    for (const x of [-2.5, 2.5]) for (const y of [0.45, 0.85]) add(new THREE.BoxGeometry(0.09, 0.09, 3.0), post, x, y, 1.7);
    for (const [x, z] of [[-2.5, 0.2], [2.5, 0.2], [-2.5, 3.2], [2.5, 3.2], [0, 3.2]]) add(new THREE.BoxGeometry(0.14, 1.1, 0.14), post, x, 0.55, z);
    add(new THREE.BoxGeometry(1.0, 0.5, 0.7), M(0xd8b848), 2.0, 0.25, 2.5);
    const horses = [];
    for (let i = 0; i < 2; i++) {
      const h = horseModel(rnd); h.position.set(-1.0 + i * 1.8, 0, 1.7); h.rotation.y = rnd() * 6.28; h.scale.setScalar(0.85);
      h.userData = { tx: h.position.x, tz: h.position.z, wait: rnd() * 3, ph: rnd() * 6, cx: 0, cz: 1.7, bx: 1.5, bz: 1.0, sp: 0.9 }; horses.push(h); add0(h);
    }
    return horses;
  }
  function gatehouseModel(g, gate) {                                         // 성문 문루: 문 양옆 돌탑 + 위의 아치 + 횃불 (보기용, 지나다니는 데 방해 없음)
    const grp = new THREE.Group(), stone = M(0x8d9098), dark = M(0x6a6e78), light = M(0xa9acb4);
    const mk = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; grp.add(o); return o; };
    for (const s of [-1, 1]) {
      const x = s * 3.5;
      mk(new THREE.BoxGeometry(2.4, 4.4, 2.8), stone, x, 2.2, 0); mk(new THREE.BoxGeometry(2.9, 0.3, 3.3), light, x, 4.5, 0);
      for (const [px, pz] of [[-1, -1.3], [0, -1.3], [1, -1.3], [-1, 1.3], [0, 1.3], [1, 1.3]]) mk(new THREE.BoxGeometry(0.55, 0.5, 0.5), light, x + px * 1.0, 4.9, pz);
      mk(new THREE.BoxGeometry(0.1, 0.8, 0.06), dark, x, 2.8, 1.43);
      mk(new THREE.ConeGeometry(0.17, 0.5, 6), lampGlow, x + s * 0.0, 5.45, 0);
      const halo = new THREE.Sprite(haloMat); halo.scale.set(3.4, 3.4, 1); halo.position.set(x, 5.5, 0); halo.renderOrder = 5; grp.add(halo); lampHalos.push(halo);
    }
    mk(new THREE.BoxGeometry(5.0, 0.7, 2.4), stone, 0, 4.0, 0); mk(new THREE.BoxGeometry(5.4, 0.25, 2.8), light, 0, 4.45, 0);
    mk(new THREE.BoxGeometry(1.4, 1.1, 0.06), M(0xe0b040), 0, 3.0, 1.0);
    grp.position.set(gate.x, 0, gate.z); grp.rotation.y = Math.atan2(gate.nx, gate.nz); scene.add(grp); doormats.push(grp);
    return grp;
  }
  function trainyardModel(add, g) {                                          // 훈련소: 모래 마당 + 나무 울타리 + 짚 인형 셋 + 과녁 + 무기 걸이 + 깃발. 아침 훈련 때 인형이 흔들린다
    const post = M(0x6b4a2a);
    add(new THREE.BoxGeometry(7, 0.1, 5.6), M(0xc8b080), 0, 0.05, 0);
    for (const z of [-2.8, 2.8]) for (const y of [0.45, 0.85]) add(new THREE.BoxGeometry(7, 0.08, 0.08), post, 0, y, z);
    for (const x of [-3.5, 3.5]) for (const y of [0.45, 0.85]) add(new THREE.BoxGeometry(0.08, 0.08, 5.6), post, x, y, 0);
    for (const [x, z] of [[-3.5, -2.8], [3.5, -2.8], [-3.5, 2.8], [3.5, 2.8], [0, -2.8], [0, 2.8]]) add(new THREE.BoxGeometry(0.14, 1.1, 0.14), post, x, 0.55, z);
    g.userData.dummies = [-2, 0, 2].map(x => {
      const d = new THREE.Group(), mk = (geo, m, px, py, pz) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.castShadow = true; d.add(o); };
      mk(new THREE.CylinderGeometry(0.07, 0.09, 1.6, 6), post, 0, 0.8, 0); mk(new THREE.BoxGeometry(1.0, 0.1, 0.1), post, 0, 1.25, 0); mk(new THREE.BoxGeometry(0.5, 0.7, 0.3), M(0xd8c070), 0, 1.15, 0); mk(new THREE.SphereGeometry(0.22, 8, 6), M(0xe0cc88), 0, 1.75, 0);
      d.position.set(x, 0, -1.0); g.add(d); return d;
    });
    add(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 5), post, 2.9, 0.9, 1.6);                                    // 활 과녁
    for (const [r, c, y] of [[0.7, 0xf0f0e8, 0], [0.48, 0xc0302a, 0.02], [0.24, 0xf0f0e8, 0.04]]) add(new THREE.CylinderGeometry(r, r, 0.1, 18), M(c), 2.9, 1.7, 1.6 + y).rotation.x = Math.PI / 2;
    add(new THREE.BoxGeometry(1.6, 0.9, 0.1), woodMat2, -2.3, 0.6, 2.4); for (const x of [-2.8, -2.3, -1.8]) add(new THREE.BoxGeometry(0.06, 1.1, 0.06), M(0x9aa0aa), x, 1.2, 2.4);       // 무기 걸이
    add(new THREE.CylinderGeometry(0.05, 0.06, 3.2, 6), post, 3.3, 1.6, -2.4); add(new THREE.BoxGeometry(0.9, 0.7, 0.04), M(0xb02a2a), 3.75, 2.9, -2.4);
  }
  // ---------- 5단계 마을의 활기: 손수레 두 대가 큰길을 오가고, 광장 분수 곁에 마을 사람들이 서 있다 (보기용, 충돌 없음. 낮에만 보인다) ----------
  const townLife = { done: false, carts: [], folk: [] };
  function cartModel() {                                                       // 수레: 나무 짐칸 + 바퀴 둘 + 짐(자루·통) + 짐 끄는 말
    const g = new THREE.Group(), wood = M(0x7a5a3a), mk = (geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
    mk(new THREE.BoxGeometry(2.2, 0.15, 1.2), wood, 0, 0.7, 0); for (const z of [-0.6, 0.6]) mk(new THREE.BoxGeometry(2.2, 0.35, 0.08), wood, 0, 0.9, z); mk(new THREE.BoxGeometry(0.08, 0.35, 1.2), wood, -1.1, 0.9, 0);
    g.userData.wheels = [-0.65, 0.65].map(z => { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 12), M(0x4a301c)); w.rotation.x = Math.PI / 2; w.position.set(0, 0.42, z * 1.0 + (z > 0 ? 0.1 : -0.1)); w.castShadow = true; g.add(w); return w; });
    mk(new THREE.BoxGeometry(0.5, 0.4, 0.45), M(0xc8a860), -0.5, 1.0, -0.2); mk(new THREE.BoxGeometry(0.5, 0.4, 0.45), M(0xd8c890), -0.3, 1.0, 0.3); mk(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 8), M(0x8a5a2a), 0.2, 1.05, 0);
    const horse = horseModel(() => 0.4, { coat: 0x8a6a4a, blanket: 0x6a4a2a }); horse.scale.setScalar(0.85); horse.position.set(2.5, 0, 0); g.add(horse);
    mk(new THREE.BoxGeometry(0.9, 0.06, 0.06), wood, 1.45, 0.8, -0.25); mk(new THREE.BoxGeometry(0.9, 0.06, 0.06), wood, 1.45, 0.8, 0.25);
    g.userData.horse = horse; return g;
  }
  function townLifeSync() {
    if (townLife.done || stage < 5) return; const plaza = builtBuildings('plaza')[0]; if (!plaza) return;
    townLife.done = true;
    for (const [x0, x1, z] of [[9, 23, 1.4], [-23, -9, -1.4]]) { const c = cartModel(); c.position.set(x0, 0, z); c.userData.run = { x0, x1, z, dir: 1, x: x0, wait: 0 }; scene.add(c); townLife.carts.push(c); }
    const px = plaza.position.x, pz = plaza.position.z;
    [[-1.6, 3.9, 0.3], [-0.9, 3.9, -0.5], [2.0, -3.8, 2.9], [1.2, -3.8, 3.5], [-3.9, 0.8, 1.6]].forEach(([dx, dz, ry], i) => {
      const rig = makeRig('citizen', [0xc05a3a, 0x3a7ac0, 0xd8a83a, 0x5aa05a, 0xa05aa0][i], { seed: 30 + i }), anim = new Anim(rig), g = new THREE.Group();
      g.add(rig.root); g.position.set(px + dx, 0, pz + dz); g.rotation.y = Math.atan2(-dx, -dz) + (i % 2 ? 0.5 : -0.4); anim.base('idle', 0); scene.add(g); townLife.folk.push({ g, anim });
    });
  }
  function townLifeTick(t, dt) {
    townLifeSync(); if (!townLife.done) return;
    const day = nowHour >= 7 && nowHour < 19;
    const far = (o) => (o.position.x - player.position.x) ** 2 + (o.position.z - player.position.z) ** 2 > 3600;
    for (const c of townLife.carts) {
      const r = c.userData.run; c.visible = day;
      if (!day || far(c)) continue;
      if (r.wait > 0) { r.wait -= dt; } else { r.x += r.dir * 1.4 * dt; if (r.x > r.x1) { r.x = r.x1; r.dir = -1; r.wait = 3; } else if (r.x < r.x0) { r.x = r.x0; r.dir = 1; r.wait = 3; } }
      c.position.set(r.x, 0, r.z); c.rotation.y = r.dir > 0 ? 0 : Math.PI;
      const mv = r.wait > 0 ? 0 : 1; for (const w of c.userData.wheels) w.rotation.y += mv * dt * 3.3 * r.dir * -1;
      const h = c.userData.horse, legs = h.userData.legs || []; legs.forEach((l, i) => { l.rotation.z = Math.sin(t * 7 + (i % 2 ? Math.PI : 0)) * 0.4 * mv; }); h.position.y = Math.abs(Math.sin(t * 7)) * 0.04 * mv;
    }
    for (const f of townLife.folk) { f.g.visible = day; if (day && !far(f.g)) f.anim.update(dt); }
  }
  let mountBtnT = 0;
  function lifeTick(t, dt) {                                                 // 우리 안의 양이 돌아다니고, 풍차 날개가 돈다. 기병은 말이 달리고 돌격 힘이 쌓인다. 깃발도 여기서 갱신
    victoryTick(); townLifeTick(t, dt); bannerFlagTick(t); leaderRideTick(t, dt); if ((mountBtnT -= dt) <= 0) { mountBtnT = 0.5; updateMountBtn(); }
    for (const n of npcs) {
      if (!n.horse) continue;
      const mv = Math.hypot(n.position.x - (n.lx ?? n.position.x), n.position.z - (n.lz ?? n.position.z)); n.lx = n.position.x; n.lz = n.position.z;
      const v = dt > 0 ? mv / dt : 0;
      n.charge = v > 3.2 ? Math.min(1.6, (n.charge || 0) + dt) : Math.max(0, (n.charge || 0) - dt * 2);
      const sw = Math.min(1, v / 5) * 0.55, ph = t * 11, legs = n.horse.userData.legs || [];
      legs.forEach((l, i) => { l.rotation.z = Math.sin(ph + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * sw; });
      n.horse.position.y = n.rider.position.y * 0 + Math.abs(Math.sin(ph)) * 0.06 * Math.min(1, v / 5); n.rider.position.y = 0.8 + n.horse.position.y;
    }
    for (const o of obstacles) {
      const u = o.userData; if (u.type !== 'building' || (!u.sails && !u.sheep && !u.pennants && !u.dummies)) continue;
      if ((o.position.x - player.position.x) ** 2 + (o.position.z - player.position.z) ** 2 > 3600) continue;        // 60칸보다 멀면 움직임을 건너뛴다 (폰 성능)
      if (u.dummies) u.dummies.forEach((d, i) => { d.rotation.z = Math.sin(t * 2.2 + i * 1.7) * 0.035 * (nowHour >= 7 && nowHour < 18 ? 1 : 0.3); });
      if (u.sails) u.sails.rotation.z -= dt * (0.6 + 0.4 * Math.sin(t * 0.3));
      if (u.pennants) u.pennants.forEach((p, i) => { const id = CFG.REALMS[i].id, held = realmHeld(id) > 0, done = realmHeld(id) >= realmSites(id).length; p.visible = held; p.scale.y = done ? 1 : 0.6; p.rotation.y = Math.sin(t * 3 + i * 2) * 0.25; });
      if (!u.sheep) continue;
      for (const s of u.sheep) {
        const d = s.userData, dx = d.tx - s.position.x, dz = d.tz - s.position.z, dist = Math.hypot(dx, dz);
        if (dist < 0.15) {
          if ((d.wait -= dt) <= 0) { d.wait = 1.5 + Math.random() * 4; d.tx = d.cx + (Math.random() - 0.5) * 2 * d.bx; d.tz = d.cz + (Math.random() - 0.5) * 2 * d.bz; }
          s.position.y = 0; continue;
        }
        const ang = Math.atan2(-dz, dx); let da = ang - s.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da)); s.rotation.y += da * Math.min(1, dt * 4);
        const sp = Math.min(dist, d.sp * dt); s.position.x += dx / dist * sp; s.position.z += dz / dist * sp; s.position.y = Math.abs(Math.sin(t * 7 + d.ph)) * 0.05;
      }
    }
  }

