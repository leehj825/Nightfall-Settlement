// Nightfall Settlement - synthesized sound effects and background music (WebAudio, no asset files).
  const Snd = (() => {
    let ctx = null, master, sfxBus, musicBus, drone, noiseBuf, muted = false, mood = { nf: 0, danger: false }, step = 0;
    const last = {};
    try { muted = localStorage.getItem('nf_mute') === '1'; } catch (e) {}
    function init() {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(master);
      musicBus = ctx.createGain(); musicBus.gain.value = 0.3; musicBus.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      // 밤의 저음 드론 (밤이 깊을수록 커진다)
      const dg = ctx.createGain(); dg.gain.value = 0; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
      for (const f of [55, 55.4, 82.5]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(); }
      lp.connect(dg); dg.connect(musicBus); drone = dg;
      setInterval(musicTick, 480);
    }
    function tone(f, dur, type = 'sine', vol = 0.3, slide = null, delay = 0, bus = sfxBus) {
      const t0 = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t0);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(bus); o.start(t0); o.stop(t0 + dur + 0.05);
    }
    function noise(dur, vol, type, f0, f1, delay = 0) {
      const t0 = ctx.currentTime + delay, src = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = noiseBuf; fl.type = type; fl.frequency.setValueAtTime(f0, t0); fl.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
      g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(fl); fl.connect(g); g.connect(sfxBus); src.start(t0); src.stop(t0 + dur + 0.05);
    }
    const SFX = {
      swing: v => noise(0.16, 0.3 * v, 'bandpass', 500, 2600),
      hit: v => { noise(0.09, 0.4 * v, 'lowpass', 1800, 200); tone(130, 0.1, 'sine', 0.35 * v, 60); },
      bow: v => { tone(240, 0.18, 'triangle', 0.3 * v, 110); noise(0.08, 0.15 * v, 'highpass', 3000, 6000); },
      anvil: v => { for (const [f, vv] of [[880, 0.3], [1320, 0.22], [1980, 0.15]]) tone(f, 0.7, 'sine', vv * v, f * 0.98); noise(0.05, 0.4 * v, 'highpass', 2000, 5000); tone(180, 0.12, 'square', 0.18 * v, 90); },
      chime: v => { [660, 880, 1320].forEach((f, i) => tone(f, 0.35, 'sine', 0.2 * v, null, i * 0.07)); },
      hurt: v => tone(220, 0.22, 'sawtooth', 0.28 * v, 80),
      die: v => { noise(0.3, 0.35 * v, 'lowpass', 1200, 120); tone(160, 0.3, 'sawtooth', 0.2 * v, 50); },
      roar: v => { tone(95, 1.1, 'sawtooth', 0.4 * v, 45); tone(140, 1.0, 'square', 0.15 * v, 60); noise(0.9, 0.3 * v, 'lowpass', 900, 100); },
      growl: v => { tone(75, 0.6, 'sawtooth', 0.3 * v, 55); tone(110, 0.5, 'triangle', 0.15 * v, 70, 0.1); },
      chop: v => { noise(0.07, 0.35 * v, 'bandpass', 900, 400); tone(300, 0.06, 'square', 0.1 * v, 150); },
      build: v => { tone(95, 0.18, 'sine', 0.35 * v, 45); noise(0.12, 0.25 * v, 'lowpass', 1500, 200); },
      dash: v => noise(0.22, 0.28 * v, 'highpass', 800, 4500),
      ult: v => { tone(70, 0.6, 'sine', 0.5 * v, 30); noise(0.55, 0.4 * v, 'lowpass', 2500, 120); },
      boom: v => { tone(55, 0.7, 'sine', 0.55 * v, 25); noise(0.6, 0.35 * v, 'lowpass', 1400, 80); },
      horn: v => { tone(196, 0.9, 'sawtooth', 0.22 * v, 190); tone(147, 0.9, 'sawtooth', 0.18 * v, 140, 0.0); tone(220, 1.0, 'sawtooth', 0.2 * v, 215, 0.7); },
      click: v => tone(700, 0.05, 'square', 0.1 * v, 500),
    };
    function play(name, v = 1) {
      if (!ctx || muted || !SFX[name]) return;
      const now = performance.now();
      if (now - (last[name] || 0) < 55) return;                  // 같은 소리가 한꺼번에 겹치지 않게
      last[name] = now; SFX[name](Math.min(1, v));
    }
    // 배경음: 낮 = 잔잔한 펜타토닉 음, 밤 = 낮은 드론 + 드문 음, 습격 = 맥박 + 긴장 음
    const DAY = [262, 294, 330, 392, 440, 523], NIGHT = [110, 131, 147, 165, 196];
    function musicTick() {
      if (!ctx || muted) return;
      step++;
      drone.gain.setTargetAtTime(0.35 * mood.nf * (mood.danger ? 1.5 : 1), ctx.currentTime, 1.5);
      if (mood.danger) { tone(62, 0.18, 'sine', 0.5, 38, 0, musicBus); if (step % 2 === 0) tone(NIGHT[(step >> 1) % 5] * 2, 0.5, 'triangle', 0.12, null, 0.1, musicBus); return; }
      if (mood.nf < 0.5) { if (step % 5 === 0) tone(DAY[Math.floor(Math.random() * DAY.length)], 1.4, 'sine', 0.16, null, 0, musicBus); }
      else if (step % 7 === 0) tone(NIGHT[Math.floor(Math.random() * NIGHT.length)] * 2, 2.2, 'sine', 0.14, null, 0, musicBus);
    }
    function setMuted(m) {
      muted = m; try { localStorage.setItem('nf_mute', m ? '1' : '0'); } catch (e) {}
      if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.05);
      const b = document.getElementById('muteBtn'); if (b) b.textContent = m ? '🔇' : '🔊';
    }
    return { init, play, setMood: (nf, danger) => { mood.nf = nf; mood.danger = danger; }, toggle: () => setMuted(!muted), isMuted: () => muted, setMuted };
  })();
