// Nightfall Settlement - synthesized sound effects and background music (WebAudio, no asset files).
  const Snd = (() => {
    let ctx = null, master, sfxBus, musicBus, drone, noiseBuf, muted = false, vol = { sfx: 1, music: 1 }, mood = { nf: 0, danger: false, boss: false }, step = 0;
    const last = {};
    try { muted = localStorage.getItem('nf_mute') === '1'; const v = JSON.parse(localStorage.getItem('nf_vol') || '{}'); if (v.sfx >= 0 && v.sfx <= 1) vol.sfx = v.sfx; if (v.music >= 0 && v.music <= 1) vol.music = v.music; } catch (e) {}
    function init() {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else if (!muted) ctx.resume(); });      // 앱이 백그라운드로 가면 소리를 멈춘다
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.gain.value = 0.8 * vol.sfx; sfxBus.connect(master);
      musicBus = ctx.createGain(); musicBus.gain.value = 0.3 * vol.music; musicBus.connect(master);
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
      levelup: v => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.4, 'triangle', 0.22 * v, null, i * 0.09)); tone(262, 0.8, 'sine', 0.2 * v, null, 0.1); },
      chest: v => { tone(180, 0.12, 'square', 0.12 * v, 120); [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.3, 'sine', 0.16 * v, null, 0.1 + i * 0.06)); },
      heal: v => { [440, 554, 659].forEach((f, i) => tone(f, 0.5, 'sine', 0.14 * v, f * 1.02, i * 0.1)); },
      bell: v => { for (const [f, vv] of [[330, 0.3], [495, 0.2], [742, 0.12]]) tone(f, 1.4, 'sine', vv * v, f * 0.995); tone(330, 1.4, 'sine', 0.25 * v, 328, 0.55); },
      howl: v => { tone(300, 1.4, 'sine', 0.22 * v, 520); tone(300.8, 1.4, 'triangle', 0.1 * v, 524, 0.02); tone(520, 0.9, 'sine', 0.18 * v, 330, 1.3); },
      victory: v => { [392, 523, 659, 784, 1047].forEach((f, i) => { tone(f, 0.5, 'triangle', 0.2 * v, null, i * 0.12); tone(f / 2, 0.5, 'sine', 0.12 * v, null, i * 0.12); }); },
      pickup: v => { tone(880, 0.08, 'sine', 0.16 * v, 1320); tone(1320, 0.12, 'sine', 0.12 * v, null, 0.07); },
      thunder: v => { noise(1.8, 0.55 * v, 'lowpass', 500, 50); tone(48, 1.4, 'sine', 0.5 * v, 28); noise(0.9, 0.3 * v, 'lowpass', 300, 40, 0.5); },
    };
    function play(name, v = 1) {
      if (!ctx || muted || !SFX[name]) return;
      const now = performance.now();
      if (now - (last[name] || 0) < 55) return;                  // 같은 소리가 한꺼번에 겹치지 않게
      last[name] = now; SFX[name](Math.min(1, v));
    }
    // 배경음: 코드 진행을 따라가는 작은 시퀀서. 낮 = 밝은 아르페지오, 밤 = 느린 단조 패드, 습격 = 맥박 + 불안한 선율, 보스 = 더 낮고 빠른 맥박
    const N = n => 440 * Math.pow(2, (n - 69) / 12);          // MIDI -> Hz
    const DAY_CH = [[60, 64, 67, 72], [57, 60, 64, 69], [53, 57, 60, 65], [55, 59, 62, 67]];          // C Am F G
    const NIGHT_CH = [[45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 58], [40, 47, 52, 55]];        // Am F G(m) Em, low and slow
    const DANGER_ROOT = [38, 38, 41, 36];
    function musicTick() {
      if (!ctx || muted) return;
      step++;
      drone.gain.setTargetAtTime(0.35 * mood.nf * (mood.danger ? 1.5 : 1), ctx.currentTime, 1.5);
      const bar = (step >> 3) & 3, beat = step & 7;                       // 8 ticks per bar, a bar per chord
      if (mood.danger) {
        const r = DANGER_ROOT[bar];
        if (beat % 2 === 0) tone(N(r), 0.22, 'sine', mood.boss ? 0.6 : 0.45, N(r) * 0.6, 0, musicBus);
        if (mood.boss && beat % 2 === 1) tone(N(r + 12), 0.1, 'square', 0.07, null, 0, musicBus);
        if (beat === 0 || beat === 3 || beat === 5) tone(N(r + [24, 27, 30][(step >> 1) % 3]), 0.45, 'triangle', 0.1, null, 0.05, musicBus);
        return;
      }
      if (mood.nf < 0.5) {                                                // 낮
        const ch = DAY_CH[bar];
        if (beat % 2 === 0) tone(N(ch[(beat >> 1) % 4]), 1.1, 'sine', 0.13, null, 0, musicBus);
        if (beat === 0) tone(N(ch[0] - 12), 2.6, 'sine', 0.1, null, 0, musicBus);
        if (beat === 4 && bar % 2 === 1) tone(N(ch[2] + 12), 1.6, 'triangle', 0.05, null, 0, musicBus);
      } else {                                                            // 밤
        const ch = NIGHT_CH[bar];
        if (beat === 0) { for (const n of ch) tone(N(n), 3.6, 'sine', 0.07, null, 0, musicBus); }
        if (beat === 2 || beat === 6) tone(N(ch[2 + (beat >> 2)] + 12), 1.8, 'sine', 0.08, null, 0.1, musicBus);
      }
    }
    function setMuted(m) {
      muted = m; try { localStorage.setItem('nf_mute', m ? '1' : '0'); } catch (e) {}
      if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.05);
      const b = document.getElementById('muteBtn'); if (b) b.textContent = m ? '🔇' : '🔊';
    }
    function setVol(kind, v) {
      vol[kind] = Math.max(0, Math.min(1, v)); try { localStorage.setItem('nf_vol', JSON.stringify(vol)); } catch (e) {}
      if (ctx) { (kind === 'sfx' ? sfxBus : musicBus).gain.setTargetAtTime((kind === 'sfx' ? 0.8 : 0.3) * vol[kind], ctx.currentTime, 0.05); }
    }
    return { init, play, setVol, getVol: k => vol[k], setMood: (nf, danger, boss) => { mood.nf = nf; mood.danger = danger; mood.boss = !!boss; }, toggle: () => setMuted(!muted), isMuted: () => muted, setMuted };
  })();
