  // ---------- Game controller (Xbox-style pad via the Gamepad API; Bluetooth pads work in the Android app) ----------
  // Left stick moves, right stick turns the camera, buttons fire the same key actions as the keyboard (synthetic key events), so every key binding works.
  //   A jump · B dash · X attack · Y swap weapon · RT attack · LT gather · RB ultimate · LB block (hold)
  //   L-stick click mount · R-stick click mark foe · D-pad up/down zoom · D-pad left orders · D-pad right smithy · Back map view
  //   Start: menu cursor on/off. In cursor mode the left stick moves a pointer, A clicks, right stick scrolls lists. It is on by itself on the title screen and in event windows.
  const pad = { on: false, cursor: false, cx: 0, cy: 0, prev: [], el: null, keyHeld: {} };
  const PAD_KEYS = { 0: 'Space', 1: 'KeyR', 2: 'KeyF', 3: 'KeyQ', 7: 'KeyF', 6: 'KeyG', 5: 'KeyE', 10: 'KeyM', 11: 'KeyY', 8: 'KeyB', 14: 'KeyO', 15: 'KeyC' };
  const padKey = (type, code) => dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true }));
  function padPointer(type, x, y, target) { const o = { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' || type === 'click' ? 0 : 1, pointerId: 77, pointerType: 'mouse', isPrimary: true }; target.dispatchEvent(type === 'click' ? new MouseEvent('click', o) : new PointerEvent(type, o)); }
  function padClick() {
    const x = pad.cx, y = pad.cy; if (pad.el) pad.el.style.visibility = 'hidden';
    const t = document.elementFromPoint(x, y); if (pad.el) pad.el.style.visibility = '';
    if (!t) return; padPointer('pointerdown', x, y, t); padPointer('pointerup', x, y, t); padPointer('click', x, y, t);
  }
  function padScroll(dy) {
    if (pad.el) pad.el.style.visibility = 'hidden'; let t = document.elementFromPoint(pad.cx, pad.cy); if (pad.el) pad.el.style.visibility = '';
    for (; t && t !== document.body; t = t.parentElement) { if (t.scrollHeight > t.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(t).overflowY)) { t.scrollTop += dy; return; } }
  }
  function padCursorOn(v) {
    pad.cursor = v; if (!pad.el) { pad.el = document.createElement('div'); pad.el.style.cssText = 'position:fixed;left:0;top:0;width:26px;height:26px;margin:-13px 0 0 -13px;border:3px solid #ffd27a;border-radius:50%;background:rgba(255,210,122,.25);z-index:99999;pointer-events:none;display:none'; document.body.appendChild(pad.el); }
    pad.el.style.display = v ? 'block' : 'none'; if (v) { pad.cx = pad.cx || innerWidth / 2; pad.cy = pad.cy || innerHeight / 2; }
    if (v) { joy.x = 0; joy.y = 0; keys.ShiftLeft = false; }
  }
  addEventListener('gamepadconnected', () => { pad.on = true; toast('Controller connected'); });
  addEventListener('gamepaddisconnected', () => { pad.on = !!(navigator.getGamepads && [...navigator.getGamepads()].some(Boolean)); if (!pad.on) { joy.x = 0; joy.y = 0; keys.ShiftLeft = false; padCursorOn(false); } });
  let padLast = performance.now();
  function padPoll() {
    requestAnimationFrame(padPoll);
    const now = performance.now(), dt = Math.min(0.05, (now - padLast) / 1000); padLast = now;
    const gps = navigator.getGamepads ? navigator.getGamepads() : []; let g = null; for (const x of gps) if (x && x.connected) { g = x; break; }
    if (!g) return; pad.on = true;
    const b = (i) => !!(g.buttons[i] && g.buttons[i].pressed), edge = (i) => b(i) && !pad.prev[i], dz = (v) => Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82;
    const lx = dz(g.axes[0] || 0), ly = dz(g.axes[1] || 0), rx = dz(g.axes[2] || 0), ry = dz(g.axes[3] || 0);
    const auto = titleMode || eventOpen || uiPause;                  // menus and event windows need the pointer
    if (edge(9)) padCursorOn(!pad.cursor); else if (auto && !pad.cursor) padCursorOn(true); else if (!auto && pad.cursor && pad.auto) padCursorOn(false);
    pad.auto = auto && !edge(9);
    if (pad.cursor) {
      pad.cx = Math.max(0, Math.min(innerWidth - 1, pad.cx + lx * 900 * dt)); pad.cy = Math.max(0, Math.min(innerHeight - 1, pad.cy + ly * 900 * dt));
      pad.el.style.left = pad.cx + 'px'; pad.el.style.top = pad.cy + 'px'; if (ry) padScroll(ry * 600 * dt);
      if (edge(0) || edge(2) || edge(7)) padClick();
      if (edge(1)) padKey('keydown', 'Escape');
    } else if (!dead) {
      if (lx || ly) { const m = Math.min(1, Math.hypot(lx, ly)); joy.x = lx / (Math.hypot(lx, ly) || 1) * m; joy.y = -ly / (Math.hypot(lx, ly) || 1) * m; pad.stick = true; } else if (pad.stick) { joy.x = 0; joy.y = 0; pad.stick = false; }
      if (rx || ry) { yaw -= rx * 2.6 * dt; pitch = Math.min(bird ? 1.5 : 1.2, Math.max(bird ? 0.12 : 0.1, pitch + ry * 1.5 * dt)); }
      if (b(12)) setDist(DIST * Math.exp(-1.2 * dt)); if (b(13)) setDist(DIST * Math.exp(1.2 * dt));
      keys.ShiftLeft = b(4);                                                     // LB held = block
      for (const k in PAD_KEYS) if (edge(+k) && !(+k === 9)) { padKey('keydown', PAD_KEYS[k]); setTimeout(() => padKey('keyup', PAD_KEYS[k]), 60); }
    }
    for (let i = 0; i < g.buttons.length; i++) pad.prev[i] = b(i);
  }
  requestAnimationFrame(padPoll);
