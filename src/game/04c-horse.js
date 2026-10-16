  // ---------- Horse: the classic box horse on a jointed skeleton (23 joints), with a walk and a gallop taken from the owner's horse animation pack (js/horse_anim.js, tools/build_horse_anim.py) ----------
  // The horse faces +x (the callers turn it with rotation.y = -PI/2). Every box hangs on a joint; the joints rest with identity rotations, so the clips are plain local rotations.
  function horseModel(rnd, o) {                                              // o = { coat, blanket (saddle blanket colour), armor (barding) }
    o = o || {}; const A = HORSE_ANIM, s = new THREE.Group(), coat = M(o.coat !== undefined ? o.coat : [0x7a4a2a, 0x3a2a22, 0xc8c0a8, 0x9a6a3a][Math.floor(rnd() * 4)]), dark = M(0x2a2018);
    const J = {}, RP = {}; A.bones.forEach(([n, p], i) => { const j = new THREE.Group(); j.name = n; const r = A.rest[i], pr = p >= 0 ? A.rest[p] : [0, 0, 0]; j.position.set(r[0] - pr[0], r[1] - pr[1], r[2] - pr[2]); RP[n] = r; J[n] = j; (p >= 0 ? J[A.bones[p][0]] : s).add(j); });
    const box = (bone, w, h, d, m, x, y, z, rz = 0) => { const k = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m), r = RP[bone]; k.position.set(x - r[0], y - r[1], z - r[2]); k.rotation.z = rz; k.castShadow = true; J[bone].add(k); return k; };
    const seg = (bone, a, b, w, d, m, grow = 0) => {                       // a box from joint a to joint b (or to a point), hung on `bone`
      const pa = Array.isArray(a) ? a : RP[a], pb = Array.isArray(b) ? b : RP[b], dx = pb[0] - pa[0], dy = pb[1] - pa[1], L = Math.hypot(dx, dy) + grow;
      return box(bone, w, L, d, m, (pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2, (pa[2] + pb[2]) / 2, Math.atan2(-dx, dy));
    };
    box('hips', 0.7, 0.55, 0.44, coat, -0.55, 1.27, 0); box('mid', 0.8, 0.58, 0.44, coat, -0.02, 1.2, 0); box('front', 0.74, 0.66, 0.44, coat, 0.42, 1.2, 0);        // rump, barrel, chest
    seg('neck1', 'neck1', 'neck2', 0.3, 0.22, coat, 0.12); seg('neck2', 'neck2', 'head', 0.24, 0.2, coat, 0.1);                                                            // neck
    seg('neck1', [RP.neck1[0] - 0.09, RP.neck1[1] + 0.09, 0], [RP.neck2[0] - 0.09, RP.neck2[1] + 0.09, 0], 0.07, 0.07, dark, 0.1);                                      // mane
    { const h = box('head', 0.5, 0.24, 0.22, coat, RP.head[0] + 0.2, RP.head[1] - 0.1, 0, -0.5); box('head', 0.2, 0.2, 0.2, dark, RP.head[0] + 0.4, RP.head[1] - 0.26, 0, -0.5); box('head', 0.07, 0.16, 0.06, dark, RP.head[0] - 0.02, RP.head[1] + 0.16, 0.08); box('head', 0.07, 0.16, 0.06, dark, RP.head[0] - 0.02, RP.head[1] + 0.16, -0.08); }   // head, muzzle, ears
    box('tail', 0.09, 0.62, 0.12, dark, RP.tail[0] - 0.06, RP.tail[1] - 0.28, 0, 0.15); box('tail', 0.14, 0.14, 0.14, dark, RP.tail[0] + 0.02, RP.tail[1], 0);                   // tail
    for (const sd of ['L', 'R']) {
      const f = (i) => RP['f' + sd + i], h = (i) => RP['h' + sd + i], fo = f(4), ho = h(4);
      seg('f' + sd + '1', f(1), f(2), 0.2, 0.2, coat, 0.06); seg('f' + sd + '2', f(2), f(3), 0.15, 0.15, coat, 0.04); seg('f' + sd + '3', f(3), f(4), 0.11, 0.11, coat); seg('f' + sd + '4', fo, [fo[0], 0.02, fo[2]], 0.13, 0.14, dark);    // front leg: arm, forearm, cannon, hoof
      box('f' + sd + '2', 0.16, 0.16, 0.16, dark, f(3)[0], f(3)[1], f(3)[2]);                                                                                                       // knee
      seg('h' + sd + '1', h(1), h(2), 0.24, 0.22, coat, 0.08); seg('h' + sd + '2', h(2), h(3), 0.15, 0.15, coat, 0.04); seg('h' + sd + '3', h(3), h(4), 0.11, 0.11, coat); seg('h' + sd + '4', ho, [ho[0], 0.02, ho[2]], 0.13, 0.14, dark);    // hind leg: thigh, shin, cannon, hoof
      box('h' + sd + '2', 0.17, 0.17, 0.17, dark, h(3)[0], h(3)[1], h(3)[2]);                                                                                                       // hock
    }
    box('mid', 0.7, 0.08, 0.5, M(o.blanket !== undefined ? o.blanket : 0x8a2a2a), 0.05, 1.5, 0); box('mid', 0.55, 0.12, 0.36, M(0x4a301c), 0.05, 1.56, 0);                         // blanket, saddle
    if (o.armor) {                                                                                                                                                            // barding: chest, neck and head plates and a forehead ornament
      const steel = M(0x9aa0aa), gold = M(0xe0b040);
      box('front', 0.5, 0.65, 0.5, steel, 0.6, 1.15, 0); seg('neck1', 'neck1', 'neck2', 0.34, 0.3, steel, 0.1); box('head', 0.44, 0.2, 0.28, steel, RP.head[0] + 0.12, RP.head[1] - 0.05, 0, -0.5); box('head', 0.08, 0.2, 0.08, gold, RP.head[0] + 0.1, RP.head[1] + 0.12, 0);
    }
    s.userData.legs = []; s.userData.hr = { J, A, t: { walk: rnd() * 1, run: rnd() * 1 }, w: { walk: 0, run: 0 }, q: new THREE.Quaternion(), qa: new THREE.Quaternion(), qb: new THREE.Quaternion(), qr: new THREE.Quaternion() };
    return s;
  }
  // Moves the horse's joints for one frame: speed (m/s) picks standing / walk / gallop (cross-faded); returns how much the back rises (the rider follows it).
  function horseStep(h, dt, speed) {
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
    }
    // the back bobs with the gait (translation delta of the hips in the clips)
    const hp = R.J.hips, r0 = A.rest[0]; let dx = 0, dy = 0, dz = 0;
    for (const n of ['walk', 'run']) if (R.w[n] > 0.02) { const cl = c[n], f = R.t[n] * cl.n, i = Math.floor(f) % cl.n, j = (i + 1) % cl.n, u = f - Math.floor(f); dx += R.w[n] * (cl.p[i * 3] * (1 - u) + cl.p[j * 3] * u); dy += R.w[n] * (cl.p[i * 3 + 1] * (1 - u) + cl.p[j * 3 + 1] * u); dz += R.w[n] * (cl.p[i * 3 + 2] * (1 - u) + cl.p[j * 3 + 2] * u); }
    hp.position.set(r0[0] + dx, r0[1] + dy, r0[2] + dz); bob = dy; h.userData.bob = bob;
    return bob;
  }
