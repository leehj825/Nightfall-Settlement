  // ---------- Model field: a separate flat field to look at characters, mounts and your own .glb files with a free camera (Settings > Model field) ----------
  const mv = { scene: null, cam: null, subs: [], sel: 'all', weapon: 'sword', mounted: false, yaw: 0.5, pitch: 0.25, dist: 6, target: new THREE.Vector3(0, 1, 0), auto: false, action: 'idle', gl: [] };
  function mvInit() {
    if (mv.scene) return;
    const sc = mv.scene = new THREE.Scene(); sc.background = new THREE.Color(0x8fb0c8);
    sc.add(new THREE.HemisphereLight(0xdfe8f0, 0x55604a, 0.55)); const sun = new THREE.DirectionalLight(0xffffff, 0.75); sun.position.set(6, 12, 8); sc.add(sun);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: 0x6d7c5f, roughness: 1 })); ground.rotation.x = -Math.PI / 2; sc.add(ground);
    const grid = new THREE.GridHelper(40, 40, 0x3e4a3a, 0x58664f); grid.position.y = 0.005; sc.add(grid);
    const ruler = new THREE.Group(); for (let i = 1; i <= 4; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(i % 2 ? 0.25 : 0.4, 0.02, 0.02), new THREE.MeshBasicMaterial({ color: 0xc03030 })); m.position.set(-3.2, i * 0.5, 0); ruler.add(m); }
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.02, 2, 0.02), new THREE.MeshBasicMaterial({ color: 0xc03030 })); pole.position.set(-3.2, 1, 0); ruler.add(pole); sc.add(ruler);   // height ruler: a mark every 0.5 m
    mv.cam = new THREE.PerspectiveCamera(50, 1, 0.05, 300);
    const defs = [['Leader', 'player', 0xa4492f, 11], ['Soldier', 'melee', 0x3a6fe0, 21], ['Archer', 'archer', 0x3fae4a, 22], ['Citizen 1', 'citizen', 0xc05a3a, 30], ['Citizen 2', 'citizen', 0x3a7ac0, 31], ['Citizen 3', 'citizen', 0xd8a83a, 32], ['Citizen 4', 'citizen', 0x5aa05a, 33],
      ['Raider 1', 'enemy', 0, 101], ['Raider 2', 'enemy', 0, 102], ['Raider 3', 'enemy', 0, 103], ['Raider 4', 'enemy', 0, 104], ['Raider 5', 'enemy', 0, 105], ['Raider 6', 'enemy', 0, 106], ['Beast', 'beast', 0, 1]];
    for (const [label, kind, color, seed] of defs) {
      const enemy = kind === 'enemy' || kind === 'beast', rig = kind === 'beast' ? makeRig('beast', 0, { enemy: true }) : makeRig(kind, color, enemy ? { enemy: true, scale: 0.88, seed } : { seed });
      const g = new THREE.Group(); g.add(rig.root); sc.add(g); const s = { label, kind, g, rig, anim: new Anim(rig), horse: null, rider: null };
      if (kind === 'enemy') rig.combat = true;
      mv.subs.push(s);
    }
    const hg = new THREE.Group(), horse = horseModel(() => 0.3, { coat: 0x7a4a2a, blanket: 0x8a2a2a }); horse.rotation.y = -Math.PI / 2; hg.add(horse); hg.userData.legs = horse.userData.legs; sc.add(hg);
    mv.subs.push({ label: 'Horse', kind: 'horse', g: hg, rig: null, anim: null, horse: hg, rider: null, hmove: 0 });
    mv.hop = 0;
    mvWeapon(mv.weapon); mvLayout(); mvUi();
  }
  function mvWeapon(w) {                                    // the same gear setup the player and soldiers use
    mv.weapon = w;
    for (const s of mv.subs) { const r = s.rig; if (!r || s.kind === 'beast') continue;
      r.brawl = w === 'none'; r.main = w; r.style = w === 'sword' ? 'ss' : w === 'great' ? 'gs' : w === 'bow' ? 'bow' : '';
      r.setGear('sword', gearDef('iron_sword')); r.setGear('great', { ...gearDef('iron_great'), slot: 'sword', great: true }); r.setGear('bow', gearDef('bow_basic')); r.setGear('spear', { id: 'spear_iron_spear', slot: 'spear', tier: 1, color: gearDef('iron_spear').color });
      r.setShield && r.setShield(s.kind === 'player' || s.kind === 'melee' ? { tier: 1 } : null); r.hold(w); s.anim.base(s.anim.baseName || 'idle'); }       // shield as in the game: kept with sword, greatsword and spear (the rig hides it with the bow)
  }
  function mvMount(on) {
    mv.mounted = on;
    for (const s of mv.subs) { if (!s.rig || s.kind === 'beast') continue;
      if (on && !s.horse) { const h = new THREE.Group(), body = horseModel(() => 0.3, { coat: 0x7a4a2a, blanket: 0x8a2a2a }), rider = new THREE.Group(); body.rotation.y = -Math.PI / 2; h.add(body); const cur = s.rig.root; s.g.remove(cur); rider.add(cur); rider.position.y = 0.8; s.g.add(rider, h); s.rig.seated = true; s.rig.rider = rider; s.horse = h; s.rider = rider; h.userData.legs = body.userData.legs; }
      else if (!on && s.horse) { const cur = s.rig.root; s.rider.remove(cur); s.g.add(cur); s.g.remove(s.rider, s.horse); s.rig.seated = false; s.rig.rider = null; s.horse = s.rider = null; } }
    mvLayout();
  }
  function mvLayout() {                                      // all in a row, or only the chosen one in the middle
    const list = mv.subs.concat(mv.gl).filter(s => mv.sel === 'all' || s.label === mv.sel), gap = mv.mounted ? 3.0 : 2.0;
    for (const s of mv.subs.concat(mv.gl)) s.g.visible = list.includes(s);
    const cols = Math.min(list.length, 6), rows = Math.ceil(list.length / cols);                      // a block of up to 6 per row, the first row at the back
    list.forEach((s, i) => s.g.position.set(((i % cols) - (cols - 1) / 2) * gap, 0, (Math.floor(i / cols) - (rows - 1) / 2) * gap));
    mv.target.set(0, 1, 0); mv.dist = list.length === 1 ? 4 : Math.max(5, cols * gap * 0.75 + rows * 1.5);
  }
  function mvAct(a) {
    mv.action = a;
    for (const s of mv.subs) { const an = s.anim; if (!an) continue;
      if (a === 'die') an.die(); else { if (an.dead) an.revive();
        if (a === 'attack') an.once(mv.weapon === 'bow' ? 'attackBow' : mv.weapon === 'spear' ? 'attackSpear' : 'attackSword');
        else if (a === 'block') { an.guard(true); setTimeout(() => an.guard(false), 1500); } else if (a === 'jump') { an.jump(); mv.hop = 0.8; }
        else an.base(a, a === 'run' ? 5.5 : a === 'walk' ? 2.2 : 0); } }
    for (const s of mv.gl) if (s.mixer && s.clips[a]) { s.mixer.stopAllAction(); s.mixer.clipAction(s.clips[a]).play(); }
  }
  function mvLoadGlb(file) {
    const url = URL.createObjectURL(file);
    new THREE.GLTFLoader().load(url, gltf => {
      const g = new THREE.Group(); g.add(gltf.scene); mv.scene.add(g); const box = new THREE.Box3().setFromObject(gltf.scene), h = box.max.y - box.min.y; if (h > 0) { gltf.scene.scale.setScalar(1.8 / h); gltf.scene.position.y = -box.min.y * 1.8 / h; }
      const s = { label: file.name, g, rig: null, anim: null, mixer: gltf.animations.length ? new THREE.AnimationMixer(gltf.scene) : null, clips: {} };
      for (const c of gltf.animations) s.clips[c.name] = c; mv.gl.push(s); mv.sel = file.name; mvUi(); mvLayout();
      if (s.mixer && gltf.animations[0]) s.mixer.clipAction(gltf.animations[0]).play();
      toast(gltf.animations.length ? gltf.animations.length + ' animations: ' + gltf.animations.map(c => c.name).join(', ') : 'No animations in this file');
    }, undefined, () => toast('Could not read that file'));
  }
  let mvEl = null;
  function mvUi() {
    if (!mvEl) {
      const st = document.createElement('style'); st.textContent = 'body.mv>*:not(#game):not(#mvUi):not(#toast){display:none!important}#mvUi{position:fixed;inset:0;z-index:900;pointer-events:none;font:13px system-ui,sans-serif;color:#fff}#mvUi .mp{pointer-events:auto;position:absolute;top:8px;left:8px;max-width:min(46vw,300px);max-height:calc(100% - 16px);overflow:auto;background:rgba(20,22,30,.82);border-radius:10px;padding:8px}#mvUi .mp h4{margin:4px 0 4px;font-size:12px;opacity:.7}#mvUi button,#mvUi select,#mvUi label.fb{pointer-events:auto;font:inherit;margin:2px;padding:6px 9px;border-radius:7px;border:0;background:#3a4258;color:#fff}#mvUi button.on{background:#c77b2a}#mvUi .ex{position:absolute;top:8px;right:8px}#mvUi .vb{position:absolute;right:8px;bottom:8px;display:flex;flex-direction:column}#mvUi input[type=file]{display:none}';
      document.head.appendChild(st); mvEl = document.createElement('div'); mvEl.id = 'mvUi'; mvEl.style.display = 'none'; document.body.appendChild(mvEl);
      mvEl.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
        if (d.act) mvAct(d.act); else if (d.w) { mvWeapon(d.w); mvUi(); } else if (d.view) { const v = { front: [0, 0.15], side: [Math.PI / 2, 0.15], back: [Math.PI, 0.15], top: [0, 1.5] }[d.view]; mv.yaw = v[0]; mv.pitch = v[1]; }
        else if (d.k === 'mount') { mvMount(!mv.mounted); mvUi(); } else if (d.k === 'auto') { mv.auto = !mv.auto; mvUi(); } else if (d.k === 'exit') mvExit(); });
      mvEl.addEventListener('change', e => { if (e.target.id === 'mvSel') { mv.sel = e.target.value; mvLayout(); } else if (e.target.id === 'mvFile' && e.target.files[0]) mvLoadGlb(e.target.files[0]); });
    }
    const opt = ['all'].concat(mv.subs.map(s => s.label), mv.gl.map(s => s.label)), btn = (a, l, on) => `<button data-act="${a}"${on ? ' class="on"' : ''}>${l}</button>`, wb = (w, l) => `<button data-w="${w}"${mv.weapon === w ? ' class="on"' : ''}>${l}</button>`;
    mvEl.innerHTML = `<div class="mp"><h4>Model</h4><select id="mvSel">${opt.map(o => `<option value="${o}"${o === mv.sel ? ' selected' : ''}>${o === 'all' ? 'All (line-up)' : o}</option>`).join('')}</select>
      <h4>Action</h4>${['idle', 'walk', 'run', 'attack', 'block', 'jump', 'die'].map(a => btn(a, a, false)).join('')}
      <h4>Weapon</h4>${wb('sword', 'Sword')}${wb('great', 'Greatsword')}${wb('spear', 'Spear')}${wb('bow', 'Bow')}${wb('none', 'None')}
      <h4>Mount</h4><button data-k="mount"${mv.mounted ? ' class="on"' : ''}>Mounted</button><button data-k="auto"${mv.auto ? ' class="on"' : ''}>Auto-rotate</button>
      <h4>Your model</h4><label class="fb">Open .glb<input type="file" id="mvFile" accept=".glb,.gltf"></label>
      <h4>Leader model: ${window.NF_LEADER ? 'New' : 'Classic'} (change in Settings)</h4></div>
      <button class="ex" data-k="exit">Exit</button>
      <div class="vb"><button data-view="front">Front</button><button data-view="side">Side</button><button data-view="back">Back</button><button data-view="top">Top</button></div>`;
  }
  function mvEnter() { mvInit(); mvActive = true; uiPause = true; document.body.classList.add('mv'); mvEl.style.display = 'block'; setEl.style.display = 'none'; mvAct(mv.action === 'die' ? 'idle' : mv.action); }
  function mvExit() { mvActive = false; uiPause = false; document.body.classList.remove('mv'); mvEl.style.display = 'none'; }
  function mvStep(dt) {
    dt = Math.min(dt, 0.05); const t = clock.elapsedTime; if (mv.auto) mv.yaw += dt * 0.5;
    for (const s of mv.subs) { if (!s.g.visible) continue; if (s.anim) s.anim.update(dt);
      if (s.horse) { const u = mv.hop > 0 ? 1 - mv.hop / 0.8 : -1, hop = u >= 0 ? Math.sin(Math.PI * u) * 0.6 : 0; if (s.rider && !s.rig.fallen) s.rider.position.y = 0.8 + hop; const mvg = mv.action === 'walk' ? 0.5 : mv.action === 'run' ? 1 : 0, legs = s.horse.userData.legs || []; legs.forEach((l, i) => { l.rotation.z = Math.sin(t * 7 + (i % 2 ? Math.PI : 0)) * 0.4 * mvg; }); s.horse.position.y = Math.abs(Math.sin(t * 7)) * 0.04 * mvg + hop; if (s.rider && !s.rig.fallen) s.rider.position.y = 0.8 + s.horse.position.y; } }
    if (mv.hop > 0) mv.hop -= dt;
    for (const s of mv.gl) if (s.mixer && s.g.visible) s.mixer.update(dt);
    const c = mv.cam, cp = Math.cos(mv.pitch), d = mv.dist; c.aspect = innerWidth / innerHeight; c.updateProjectionMatrix();
    c.position.set(mv.target.x + Math.sin(mv.yaw) * cp * d, Math.max(0.1, mv.target.y + Math.sin(mv.pitch) * d), mv.target.z + Math.cos(mv.yaw) * cp * d); c.lookAt(mv.target);
    renderer.render(mv.scene, c);
  }
  { const cv = document.getElementById('game'), ptrs = new Map(); let last = 0;
    cv.addEventListener('pointerdown', e => { if (!mvActive) return; cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY, e.button]); last = 0; });
    cv.addEventListener('pointerup', e => { ptrs.delete(e.pointerId); }); cv.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); });
    cv.addEventListener('pointermove', e => { if (!mvActive || !ptrs.has(e.pointerId)) return; const p = ptrs.get(e.pointerId), dx = e.clientX - p[0], dy = e.clientY - p[1];
      if (ptrs.size === 2) { const o = [...ptrs.entries()].find(([k]) => k !== e.pointerId)[1], d0 = Math.hypot(p[0] - o[0], p[1] - o[1]), d1 = Math.hypot(e.clientX - o[0], e.clientY - o[1]);
        mv.dist = Math.max(1, Math.min(40, mv.dist * (d0 / Math.max(1, d1)))); const k = mv.dist * 0.0012; mv.target.y += dy * k * 0.5; mv.target.x -= dx * k * 0.5 * Math.cos(mv.yaw); mv.target.z += dx * k * 0.5 * Math.sin(mv.yaw); }
      else if (p[2] === 2 || p[2] === 1) { const k = mv.dist * 0.002; mv.target.y += dy * k; mv.target.x -= dx * k * Math.cos(mv.yaw); mv.target.z += dx * k * Math.sin(mv.yaw); }
      else { mv.yaw -= dx * 0.008; mv.pitch = Math.max(-0.2, Math.min(1.5, mv.pitch + dy * 0.008)); }
      p[0] = e.clientX; p[1] = e.clientY; });
    cv.addEventListener('wheel', e => { if (!mvActive) return; e.preventDefault(); mv.dist = Math.max(1, Math.min(40, mv.dist * (1 + Math.sign(e.deltaY) * 0.1))); }, { passive: false });
    cv.addEventListener('contextmenu', e => { if (mvActive) e.preventDefault(); }); }
  document.getElementById('setModelField').addEventListener('click', mvEnter);
  if (/[?&]modelfield/.test(location.search)) setTimeout(mvEnter, 1500);
  tick();
})();
