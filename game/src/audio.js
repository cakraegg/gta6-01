// VENTARA BAY — sound: everything is synthesised with WebAudio, no audio
// files. Engine hum, sirens, gunshots, chimes and a procedural sunset
// music loop. Every call is guarded: if audio is unavailable the game
// still plays silently.

export function createAudio() {
  const audio = {
    ctx: null, muted: false, musicOn: false,
    engineOsc: null, engineGain: null, sirenOsc: null, sirenGain: null,
    ensure, setMuted, shot, swing, thud, click, reload, chime, jingle,
    engine, siren, startMusic, stopMusic, update,
  };
  let musicTimer = null, musicStep = 0;

  function ensure() {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      audio.ctx = new AC();
      // engine: two detuned saws through a lowpass
      audio.engineOsc = audio.ctx.createOscillator();
      audio.engineOsc.type = 'sawtooth';
      audio.engineOsc.frequency.value = 55;
      const o2 = audio.ctx.createOscillator();
      o2.type = 'sawtooth'; o2.frequency.value = 58;
      audio.engineGain = audio.ctx.createGain();
      audio.engineGain.gain.value = 0;
      const lp = audio.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 420;
      audio.engineOsc.connect(lp); o2.connect(lp);
      lp.connect(audio.engineGain); audio.engineGain.connect(audio.ctx.destination);
      audio.engineOsc.start(); o2.start();
      audio._engineO2 = o2;
      // siren: triangle that wails
      audio.sirenOsc = audio.ctx.createOscillator();
      audio.sirenOsc.type = 'triangle';
      audio.sirenOsc.frequency.value = 700;
      audio.sirenGain = audio.ctx.createGain();
      audio.sirenGain.gain.value = 0;
      audio.sirenOsc.connect(audio.sirenGain);
      audio.sirenGain.connect(audio.ctx.destination);
      audio.sirenOsc.start();
      return true;
    } catch (e) { return false; }
  }
  function setMuted(m) {
    audio.muted = m;
    if (audio.engineGain) audio.engineGain.gain.value = m ? 0 : audio._engineLevel || 0;
    if (audio.sirenGain) audio.sirenGain.gain.value = m ? 0 : audio._sirenLevel || 0;
  }
  function blip(freq, dur, type, vol, slideTo) {
    if (!audio.ctx || audio.muted) return;
    try {
      const o = audio.ctx.createOscillator();
      const g = audio.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, audio.ctx.currentTime);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, audio.ctx.currentTime + dur);
      g.gain.setValueAtTime(vol || 0.2, audio.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + dur);
      o.connect(g); g.connect(audio.ctx.destination);
      o.start(); o.stop(audio.ctx.currentTime + dur + 0.02);
    } catch (e) {}
  }
  function noiseBurst(dur, vol, freq) {
    if (!audio.ctx || audio.muted) return;
    try {
      const len = Math.floor(audio.ctx.sampleRate * dur);
      const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = audio.ctx.createBufferSource();
      src.buffer = buf;
      const f = audio.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = freq || 1800;
      const g = audio.ctx.createGain();
      g.gain.value = vol || 0.35;
      src.connect(f); f.connect(g); g.connect(audio.ctx.destination);
      src.start();
    } catch (e) {}
  }
  function shot() { noiseBurst(0.14, 0.5, 2600); blip(160, 0.1, 'square', 0.25, 60); }
  function swing() { noiseBurst(0.08, 0.18, 900); }
  function thud() { blip(90, 0.18, 'sine', 0.4, 45); noiseBurst(0.1, 0.25, 500); }
  function click() { blip(1400, 0.05, 'square', 0.12); }
  function reload() { blip(500, 0.06, 'square', 0.15); setTimeout(() => blip(700, 0.06, 'square', 0.15), 120); }
  function chime() { blip(880, 0.18, 'sine', 0.22); setTimeout(() => blip(1318, 0.25, 'sine', 0.2), 110); }
  function jingle() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => setTimeout(() => blip(n, 0.3, 'triangle', 0.22), i * 130));
  }
  function engine(speed01) {
    if (!audio.ctx) return;
    const level = audio.muted ? 0 : 0.05 + speed01 * 0.06;
    audio._engineLevel = level;
    if (audio.engineGain) audio.engineGain.gain.value = level;
    if (audio.engineOsc) audio.engineOsc.frequency.value = 55 + speed01 * 110;
    if (audio._engineO2) audio._engineO2.frequency.value = 58 + speed01 * 112;
  }
  function siren(on) {
    if (!audio.ctx) return;
    const level = on && !audio.muted ? 0.045 : 0;
    audio._sirenLevel = level;
    if (audio.sirenGain) audio.sirenGain.gain.value = level;
  }
  // procedural music: a slow sunset groove — bass notes + hats, D minor
  function startMusic() {
    if (!audio.ctx || audio.musicOn) return;
    audio.musicOn = true;
    const bass = [73.42, 0, 87.31, 0, 65.41, 0, 98.0, 0];
    musicTimer = setInterval(() => {
      if (audio.muted || !audio.musicOn) return;
      const step = musicStep % 8;
      const note = bass[step];
      if (note) blip(note, 0.42, 'triangle', 0.16);
      if (step % 2 === 1) noiseBurst(0.03, 0.05, 6000);
      if (step === 0) blip(220, 0.5, 'sine', 0.06);
      musicStep += 1;
    }, 300);
  }
  function stopMusic() {
    audio.musicOn = false;
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  }
  function update(dt, G) {
    if (!audio.ctx) return;
    const driving = !G.player.onFoot && G.player.car;
    engine(driving ? Math.abs(G.player.car.speed) / 26 : 0);
    siren(G.police.wanted > 0 && G.police.cars.length > 0);
    if (audio.sirenOsc) {
      audio.sirenOsc.frequency.value = 620 + Math.sin(G.time * 2.4) * 180;
    }
  }
  return audio;
}
