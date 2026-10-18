  // ---------- On-screen controls: auto-hide while a keyboard or controller is the last thing used; the 🎮 button cycles Auto / Show / Hide by choice (saved) ----------
  const ctl = { mode: 'auto', last: 'touch' };
  try { const m = localStorage.getItem('nf_ctl'); if (m === 'show' || m === 'hide' || m === 'auto') ctl.mode = m; } catch (e) { /* ignore */ }
  const CTL_ICON = { auto: '🎮', show: '👆', hide: '🚫' }, CTL_TEXT = { auto: 'Auto: the on-screen buttons hide while a keyboard or controller is used', show: 'On-screen buttons: always shown', hide: 'On-screen buttons: hidden' };
  function applyCtl() {
    const hide = ctl.mode === 'hide' || (ctl.mode === 'auto' && ctl.last !== 'touch');
    document.body.classList.toggle('ctlHidden', hide);
    const b = document.getElementById('ctlBtn'); if (b) { b.textContent = CTL_ICON[ctl.mode]; b.title = CTL_TEXT[ctl.mode]; }
  }
  function ctlSeen(kind) { if (ctl.last !== kind) { ctl.last = kind; applyCtl(); } }
  addEventListener('keydown', e => { if (e.isTrusted && !e.repeat && !/^(Shift|Control|Alt|Meta)/.test(e.code)) ctlSeen('keys'); }, true);
  addEventListener('pointerdown', e => { if (e.isTrusted && (e.pointerType === 'touch' || e.pointerType === 'pen')) ctlSeen('touch'); }, true);
  { const b = document.getElementById('ctlBtn');
    if (b) {
      b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); const nx = { auto: 'show', show: 'hide', hide: 'auto' }[ctl.mode]; ctl.mode = nx; if (nx === 'auto') ctl.last = 'touch'; try { localStorage.setItem('nf_ctl', nx); } catch (er) { /* ignore */ } applyCtl(); toast(CTL_TEXT[nx]); });
      const place = () => {                                          // sits next to the settings button, using that button's own (containing-block relative) offsets
        const s = document.getElementById('setBtn'); if (!s || !s.offsetWidth) return; const cs = getComputedStyle(s), w = s.offsetWidth + 6, left = document.documentElement.dataset.hand === 'l';
        b.style.width = b.style.height = s.offsetWidth + 'px'; b.style.top = 'auto'; b.style.bottom = cs.bottom;
        if (left) { b.style.left = 'auto'; b.style.right = (parseFloat(cs.right) + w) + 'px'; } else { b.style.right = 'auto'; b.style.left = (parseFloat(cs.left) + w) + 'px'; }
      };
      setInterval(place, 700); addEventListener('resize', place); place();
    }
  }
  applyCtl();
