  // ---------- 더 자세한 건물 모양 (집과 성채): 기본 도형을 모아 만든 로우폴리 모델. 모두 function 선언이다 ----------
  const mdlCache = {};
  const M = (c) => mdlCache[c] || (mdlCache[c] = new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 1 }));
  function gableGeo(w, h, d) {                                               // 삼각 단면(너비 w, 높이 h)을 깊이 d 만큼 밀어낸 박공 지붕: 바닥이 y=0, 앞뒤(z)로 d/2
    const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(0, h); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false }); g.translate(0, 0, -d / 2); return g;
  }
  function houseModel(g, lvl) {                                              // 2단계: 목골 집 / 3단계 이상: 돌집 (정면은 +z)
    const add = (geo, m, px, py, pz, ry = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.rotation.y = ry; o.castShadow = o.receiveShadow = true; g.add(o); return o; };
    const stone = lvl >= 3, wallM = stone ? M(0x9a9da4) : M(0xd8bf90), beamM = M(0x4a301c), roofM = stone ? M(0x4a4f5c) : M(0xa34a2a), baseM = M(0x6f7078), doorM = M(0x3a2414);
    const W = stone ? 3.0 : 2.8, H = stone ? 2.3 : 1.8;
    add(new THREE.BoxGeometry(W + 0.3, 0.3, W + 0.3), baseM, 0, 0.15, 0);                                       // 돌 기초
    add(new THREE.BoxGeometry(W, H, W), wallM, 0, 0.3 + H / 2, 0);
    const top = 0.3 + H;
    if (!stone) {                                                                                               // 목골: 모서리 기둥, 가로 들보, 가새
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(new THREE.BoxGeometry(0.16, H, 0.16), beamM, sx * W / 2, 0.3 + H / 2, sz * W / 2);
      for (const y of [0.3, top - 0.08]) { add(new THREE.BoxGeometry(W + 0.1, 0.12, 0.12), beamM, 0, y, W / 2); add(new THREE.BoxGeometry(W + 0.1, 0.12, 0.12), beamM, 0, y, -W / 2); add(new THREE.BoxGeometry(0.12, 0.12, W + 0.1), beamM, W / 2, y, 0); add(new THREE.BoxGeometry(0.12, 0.12, W + 0.1), beamM, -W / 2, y, 0); }
      for (const sx of [-1, 1]) { const br = add(new THREE.BoxGeometry(0.1, 1.3, 0.1), beamM, sx * W * 0.32, 0.3 + H * 0.5, W / 2 + 0.02); br.rotation.z = -sx * 0.6; }
    } else {                                                                                                    // 돌집: 모서리 돌(쐐기돌)
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(new THREE.BoxGeometry(0.34, H, 0.34), M(0xb4b6bc), sx * W / 2, 0.3 + H / 2, sz * W / 2);
      add(new THREE.BoxGeometry(W + 0.12, 0.14, W + 0.12), M(0xb4b6bc), 0, top, 0);
    }
    const rw = W + 0.7, rh = stone ? 1.7 : 1.45;
    add(gableGeo(rw, rh, W + 0.7), roofM, 0, top, 0);                                                           // 박공 지붕 (처마가 벽보다 튀어나온다)
    for (const z of [-1, 1]) add(gableGeo(W * 0.94, rh * 0.84, 0.06), wallM, 0, top + 0.02, z * (W + 0.7) / 2 + z * 0.02);   // 박공 벽면
    add(new THREE.BoxGeometry(0.16, 0.14, W + 0.8), M(0x3a2414), 0, top + rh, 0);                              // 용마루
    add(new THREE.BoxGeometry(0.55, 1.0, 0.55), M(0x7a5a4a), W * 0.28, top + rh * 0.62, -W * 0.18);            // 굴뚝
    add(new THREE.BoxGeometry(0.7, 0.12, 0.7), M(0x5a4a40), W * 0.28, top + rh * 0.62 + 0.55, -W * 0.18);
    add(new THREE.BoxGeometry(0.7, 1.25, 0.1), doorM, 0, 0.3 + 0.62, W / 2 + 0.04);                            // 문 + 문틀 + 처마
    add(new THREE.BoxGeometry(0.9, 0.12, 0.12), beamM, 0, 0.3 + 1.28, W / 2 + 0.07);
    add(new THREE.BoxGeometry(0.1, 0.12, 0.34), beamM, 0.45, 0.3 + 1.3, W / 2 + 0.14); add(new THREE.BoxGeometry(0.1, 0.12, 0.34), beamM, -0.45, 0.3 + 1.3, W / 2 + 0.14);
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 6), M(0xc8a040), 0.22, 0.3 + 0.62, W / 2 + 0.1).rotation.x = Math.PI / 2;
    for (const sx of [-1, 1]) {                                                                                 // 덧문 달린 창 + 화단
      const wx = sx * W * 0.32, wy = 0.3 + H * 0.58;
      add(new THREE.BoxGeometry(0.52, 0.52, 0.06), windowGlow, wx, wy, W / 2 + 0.03);
      add(new THREE.BoxGeometry(0.62, 0.08, 0.1), beamM, wx, wy + 0.3, W / 2 + 0.06); add(new THREE.BoxGeometry(0.62, 0.08, 0.1), beamM, wx, wy - 0.3, W / 2 + 0.06);
      add(new THREE.BoxGeometry(0.16, 0.5, 0.05), beamM, wx - 0.36, wy, W / 2 + 0.06); add(new THREE.BoxGeometry(0.16, 0.5, 0.05), beamM, wx + 0.36, wy, W / 2 + 0.06);
      add(new THREE.BoxGeometry(0.6, 0.14, 0.22), M(0x6b4a2a), wx, wy - 0.42, W / 2 + 0.15); add(new THREE.BoxGeometry(0.5, 0.12, 0.16), M(0x4f8a3a), wx, wy - 0.32, W / 2 + 0.15);
    }
    for (const sz of [-1, 1]) add(new THREE.BoxGeometry(0.06, 0.5, 0.5), windowGlow, sx2(W), 0.3 + H * 0.58, sz * W * 0.22);               // 옆 창
    if (stone) { add(new THREE.BoxGeometry(0.7, 0.6, 0.7), M(0x4a4f5c), 0, top + rh * 0.35, W * 0.45); add(new THREE.BoxGeometry(0.4, 0.4, 0.05), windowGlow, 0, top + rh * 0.35, W * 0.45 + 0.37); }   // 지붕창
  }
  const sx2 = (W) => W / 2 + 0.03;
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
