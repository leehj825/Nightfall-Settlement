  // ---------- Horse: the classic box horse on a jointed skeleton (12 joints), with a walk and a gallop taken from the owner's horse animation pack (js/horse_anim.js, tools/build_horse_anim.py) ----------
  // The horse faces +x (the callers turn it with rotation.y = -PI/2). Every box hangs on a joint; the joints rest with identity rotations, so the clips are plain local rotations.
  function horseModel(rnd, o) {                                              // o = { coat, blanket (saddle blanket colour), armor (barding) }
    o = o || {}; const A = HORSE_ANIM, s = new THREE.Group(), coat = M(o.coat !== undefined ? o.coat : [0x7a4a2a, 0x3a2a22, 0xc8c0a8, 0x9a6a3a][Math.floor(rnd() * 4)]), dark = M(0x2a2018);
    const J = {}, RP = {}; A.bones.forEach(([n, p], i) => { const j = new THREE.Group(); j.name = n; const r = A.rest[i], pr = p >= 0 ? A.rest[p] : [0, 0, 0]; j.position.set(r[0] - pr[0], r[1] - pr[1], r[2] - pr[2]); RP[n] = r; J[n] = j; (p >= 0 ? J[A.bones[p][0]] : s).add(j); });
    const box = (bone, w, h, d, m, x, y, z, rz = 0) => { const k = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m), r = RP[bone]; k.position.set(x - r[0], y - r[1], z - r[2]); k.rotation.z = rz; k.castShadow = true; J[bone].add(k); return k; };
    const seg = (bone, pa, pb, w, d, m, grow = 0) => {                      // a box from point pa to point pb, hung on `bone`
      const dx = pb[0] - pa[0], dy = pb[1] - pa[1], L = Math.hypot(dx, dy) + grow;
      return box(bone, w, L, d, m, (pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2, (pa[2] + pb[2]) / 2, Math.atan2(-dx, dy));
    };
    box('body', 1.7, 0.62, 0.46, coat, -0.02, 1.2, 0);                                                                                                 // body: one block
    seg('neck', [RP.neck[0] - 0.05, RP.neck[1] - 0.05, 0], RP.head, 0.3, 0.22, coat, 0.16);                                                          // neck: one block
    { const hx = RP.head[0], hy = RP.head[1], white = M(0xf4efe4), ca = Math.cos(-0.5), sa = Math.sin(-0.5), at = (d, dy = 0) => [hx + ca * d - sa * dy, hy + sa * d + ca * dy];      // head: a skull that narrows to a slim muzzle and a darker nose, with eyes, ears and a forelock
      const sk = at(0.14), mz = at(0.4, -0.02), ns = at(0.56, -0.025);
      box('head', 0.36, 0.31, 0.27, coat, sk[0], sk[1], 0, -0.5); box('head', 0.34, 0.24, 0.2, coat, mz[0], mz[1], 0, -0.5); box('head', 0.12, 0.2, 0.17, dark, ns[0], ns[1], 0, -0.5);
      for (const z of [-1, 1]) { const e = at(0.18, 0.05); box('head', 0.055, 0.06, 0.04, white, e[0], e[1], z * 0.14, -0.5); box('head', 0.03, 0.04, 0.03, dark, e[0] + 0.005, e[1], z * 0.16, -0.5); box('head', 0.08, 0.22, 0.06, coat, hx - 0.02, hy + 0.2, z * 0.09, z * -0.12); box('head', 0.035, 0.13, 0.03, dark, hx - 0.01, hy + 0.2, z * 0.09, z * -0.12); }
      box('head', 0.1, 0.18, 0.1, dark, hx + 0.02, hy + 0.12, 0, 0.3); }
    { const n0 = [RP.neck[0] - 0.1, RP.neck[1] + 0.2], n1 = [RP.head[0] - 0.12, RP.head[1] + 0.2], ang = Math.atan2(-(n1[0] - n0[0]), n1[1] - n0[1]);              // mane: a thick row of dark tufts along the top of the neck, hanging down the sides
      for (let i = 0; i < 6; i++) { const u = i / 5, x = n0[0] + (n1[0] - n0[0]) * u - 0.02, y = n0[1] + (n1[1] - n0[1]) * u + 0.03 - 0.03 * (i % 2), h = 0.26 + 0.05 * (i % 2); box('neck', 0.16, h, 0.2, dark, x, y, 0, ang); box('neck', 0.1, h * 0.8, 0.34, dark, x - 0.01, y - 0.06, 0, ang); } }
    box('tail', 0.1, 0.55, 0.1, dark, RP.tail[0] - 0.05, RP.tail[1] - 0.22, 0, 0.15);                                                                  // tail
    for (const sd of ['L', 'R']) {
      const z = (i) => RP['f' + sd + i][2], fu = RP['f' + sd + 'U'], fl = RP['f' + sd + 'L'], hu = RP['h' + sd + 'U'], hl = RP['h' + sd + 'L'];
      seg('f' + sd + 'U', [fu[0] + 0.05, fu[1] + 0.2, fu[2]], fl, 0.27, 0.27, coat, 0.04); seg('f' + sd + 'L', fl, [fl[0], 0, fl[2]], 0.19, 0.19, dark, 0.02);        // front leg: upper, lower (with the hoof)
      seg('h' + sd + 'U', hu, hl, 0.31, 0.29, coat, 0.1); seg('h' + sd + 'L', hl, [hl[0], 0, hl[2]], 0.19, 0.19, dark, 0.02);                                // hind leg: upper, lower
    }
    box('body', 0.7, 0.08, 0.52, M(o.blanket !== undefined ? o.blanket : 0x8a2a2a), 0.05, 1.52, 0); box('body', 0.55, 0.12, 0.36, M(0x4a301c), 0.05, 1.58, 0);          // blanket, saddle
    if (o.armor) box('body', 0.5, 0.7, 0.52, M(0x9aa0aa), 0.62, 1.15, 0);                                                                              // barding: a chest plate
    s.userData.legs = []; s.userData.hr = { J, A, t: { walk: rnd() * 1, run: rnd() * 1 }, w: { walk: 0, run: 0 }, q: new THREE.Quaternion(), qa: new THREE.Quaternion(), qb: new THREE.Quaternion(), qr: new THREE.Quaternion() };
    return s;
  }
  // Moves the horse's joints for one frame: speed (m/s) picks standing / walk / gallop (cross-faded); returns how much the back rises (the rider follows it).
  function horseStep(h, dt, speed, air = 0) {
    const R = h.userData.hr; if (!R) return 0;
    const A = R.A, c = A.clips, want = { walk: speed > 0.3 && speed < 4.2 ? 1 : 0, run: speed >= 4.2 ? 1 : 0 }, k = Math.min(1, dt * 6);
    for (const n of ['walk', 'run']) R.w[n] += (want[n] - R.w[n]) * k;
    const rate = { walk: Math.max(0.7, Math.min(2.2, speed / 1.6)) / c.walk.dur, run: Math.max(0.8, Math.min(1.4, speed / 6.5)) / c.run.dur };
    for (const n of ['walk', 'run']) if (R.w[n] > 0.02) R.t[n] = (R.t[n] + dt * rate[n]) % 1;
    const w0 = Math.max(0, 1 - R.w.walk - R.w.run), nb = A.bones.length; let bob = 0;
    const frame = (n, b, out) => { const cl = c[n], f = R.t[n] * cl.n, i = Math.floor(f) % cl.n, j = (i + 1) % cl.n, u = f - Math.floor(f), o = b * 4, q = cl.q; R.qa.set(q[i * nb * 4 + o], q[i * nb * 4 + o + 1], q[i * nb * 4 + o + 2], q[i * nb * 4 + o + 3]); R.qb.set(q[j * nb * 4 + o], q[j * nb * 4 + o + 1], q[j * nb * 4 + o + 2], q[j * nb * 4 + o + 3]); return out.copy(R.qa).slerp(R.qb, u); };
    for (let b = 0; b < nb; b++) {
      const jt = R.J[A.bones[b][0]]; let x = 0, y = 0, z = 0, w = w0;                                  // blend by normalised weights (small rotations: a weighted sum is close enough)
      for (const n of ['walk', 'run']) if (R.w[n] > 0.02) { frame(n, b, R.q); if (x * R.q.x + y * R.q.y + z * R.q.z + w * R.q.w < 0 && n !== 'walk') R.q.set(-R.q.x, -R.q.y, -R.q.z, -R.q.w); x += R.q.x * R.w[n]; y += R.q.y * R.w[n]; z += R.q.z * R.w[n]; w += R.q.w * R.w[n]; }
      jt.quaternion.set(x, y, z, w).normalize();
      if (air > 0) { const nm = A.bones[b][0], th = (nm[0] === 'f' && nm[2] === 'U' ? 0.45 : nm[0] === 'f' && nm[2] === 'L' ? -1.1 : nm[0] === 'h' && nm[2] === 'U' ? -0.35 : nm[0] === 'h' && nm[2] === 'L' ? 0.7 : 0) * air; if (th) { R.qr.set(0, 0, Math.sin(th / 2), Math.cos(th / 2)); jt.quaternion.premultiply(R.qr); } }       // jumping: the legs tuck (front knees fold back, hind legs fold forward)
    }
    // the back bobs with the gait (translation delta of the hips in the clips)
    const hp = R.J.body, r0 = A.rest[0]; let dx = 0, dy = 0, dz = 0;
    for (const n of ['walk', 'run']) if (R.w[n] > 0.02) { const cl = c[n], f = R.t[n] * cl.n, i = Math.floor(f) % cl.n, j = (i + 1) % cl.n, u = f - Math.floor(f); dx += R.w[n] * (cl.p[i * 3] * (1 - u) + cl.p[j * 3] * u); dy += R.w[n] * (cl.p[i * 3 + 1] * (1 - u) + cl.p[j * 3 + 1] * u); dz += R.w[n] * (cl.p[i * 3 + 2] * (1 - u) + cl.p[j * 3 + 2] * u); }
    hp.position.set(r0[0] + dx, r0[1] + dy, r0[2] + dz); bob = dy; h.userData.bob = bob;
    return bob;
  }
