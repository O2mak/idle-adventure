// 소리: 외부 파일 없이 브라우저(WebAudio)로 직접 합성하는 효과음과 배경음 (저작권 걱정 없음)
const Sound = {
  ctx: null, master: null, sfxGain: null, bgmGain: null,
  sfxOn: true, bgmOn: true, vol: 0.5,
  _last: {}, _bgmTimer: null, _step: 0, _region: 1, _nextT: 0,

  load() {
    try { const j = JSON.parse(localStorage.getItem('idlegame_sound') || 'null'); if (j) { this.sfxOn = j.sfx !== false; this.bgmOn = j.bgm !== false; this.vol = typeof j.vol === 'number' ? j.vol : 0.5; } } catch (e) { /* 무시 */ }
  },
  save() { try { localStorage.setItem('idlegame_sound', JSON.stringify({ sfx: this.sfxOn, bgm: this.bgmOn, vol: this.vol })); } catch (e) { /* 무시 */ } },

  // 브라우저 정책상 사용자가 한 번 누른 뒤에야 소리를 낼 수 있음
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain(); this.sfxGain.connect(this.master);
      this.bgmGain = this.ctx.createGain(); this.bgmGain.connect(this.master);
      this.apply();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.startBgm();
  },
  apply() {
    if (!this.ctx) return;
    this.master.gain.value = this.vol;
    this.sfxGain.gain.value = this.sfxOn ? 0.55 : 0;
    this.bgmGain.gain.value = this.bgmOn ? 0.16 : 0;
  },
  setOn(sfx, bgm) { this.sfxOn = sfx; this.bgmOn = bgm; this.apply(); this.save(); },
  setVol(v) { this.vol = Math.max(0, Math.min(1, v)); this.apply(); this.save(); },

  // 한 음 내기: 주파수, 길이(초), 파형, 음량, 음높이 변화, 시작 지연
  tone(freq, dur, type, vol, slide, delay, dest) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + (delay || 0), o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfxGain); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, vol, delay) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + (delay || 0), n = Math.floor(this.ctx.sampleRate * dur), buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource(), g = this.ctx.createGain(), f = this.ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 1200; g.gain.value = vol;
    src.buffer = buf; src.connect(f); f.connect(g); g.connect(this.sfxGain); src.start(t);
  },

  // 효과음 (같은 소리가 너무 자주 나지 않게 최소 간격을 둠)
  FX: {
    slash: { gap: 0.18, f() { Sound.noise(0.08, 0.25); Sound.tone(520, 0.07, 'square', 0.08, 0.5); } },
    bow:   { gap: 0.18, f() { Sound.tone(900, 0.09, 'triangle', 0.14, 0.45); } },
    zap:   { gap: 0.18, f() { Sound.tone(700, 0.1, 'sine', 0.14, 1.8); } },
    skill: { gap: 0.15, f() { Sound.tone(330, 0.12, 'square', 0.12, 2); Sound.tone(660, 0.14, 'triangle', 0.12, 1.5, 0.05); } },
    kill:  { gap: 0.12, f() { Sound.tone(880, 0.06, 'square', 0.08); Sound.tone(1320, 0.08, 'square', 0.07, 1, 0.05); } },
    hurt:  { gap: 0.25, f() { Sound.tone(180, 0.14, 'sawtooth', 0.14, 0.5); } },
    drop:  { gap: 0.2,  f() { Sound.tone(988, 0.07, 'triangle', 0.14); Sound.tone(1318, 0.12, 'triangle', 0.14, 1, 0.07); } },
    rare:  { gap: 0.3,  f() { [784, 988, 1175, 1568].forEach((fq, i) => Sound.tone(fq, 0.14, 'triangle', 0.16, 1, i * 0.08)); } },
    level: { gap: 0.5,  f() { [523, 659, 784, 1046].forEach((fq, i) => Sound.tone(fq, 0.16, 'square', 0.13, 1, i * 0.09)); } },
    clear: { gap: 0.5,  f() { [523, 659, 784].forEach((fq, i) => Sound.tone(fq, 0.18, 'triangle', 0.15, 1, i * 0.1)); } },
    win:   { gap: 0.8,  f() { [523, 659, 784, 1046, 1318].forEach((fq, i) => Sound.tone(fq, 0.22, 'triangle', 0.17, 1, i * 0.1)); } },
    fail:  { gap: 0.8,  f() { [392, 330, 262].forEach((fq, i) => Sound.tone(fq, 0.25, 'sawtooth', 0.12, 0.9, i * 0.14)); } },
    weak:  { gap: 1.0,  f() { Sound.tone(1200, 0.1, 'square', 0.12); Sound.tone(1200, 0.1, 'square', 0.12, 1, 0.14); } },
  },
  play(name) {
    if (!this.ctx || !this.sfxOn || this.ctx.state !== 'running') return;
    const fx = this.FX[name]; if (!fx) return;
    const now = this.ctx.currentTime;
    if (now - (this._last[name] || -9) < fx.gap) return;
    this._last[name] = now; fx.f();
  },
  // 전투에서 쌓인 사건 목록을 소리로 (한 번에 너무 많이 나지 않게)
  playEvents(list) {
    const seen = new Set();
    for (const n of list) { if (seen.has(n)) continue; seen.add(n); this.play(n); }
  },

  // 배경음: 지역마다 음계와 빠르기가 달라지는 잔잔한 8비트 반복곡
  setRegion(r) { this._region = r; },
  startBgm() {
    if (this._bgmTimer || !this.ctx) return;
    this._nextT = this.ctx.currentTime + 0.1;
    this._bgmTimer = setInterval(() => this._schedule(), 120);
  },
  _schedule() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const r = this._region, scales = [[0, 2, 4, 7, 9], [0, 3, 5, 7, 10], [0, 2, 4, 7, 9], [0, 2, 5, 7, 9], [0, 3, 5, 7, 10]];
    const sc = scales[(r - 1) % scales.length], root = 196 * Math.pow(2, ((r * 2) % 7) / 12), bpm = 84 + (r % 4) * 6, stepDur = 60 / bpm / 2;
    // 지역마다 고정된 멜로디 (간단한 난수로 만들어 같은 지역은 항상 같은 곡)
    const rnd = (n) => { const x = Math.sin((r * 97 + n * 31) * 12.9898) * 43758.5453; return x - Math.floor(x); };
    while (this._nextT < this.ctx.currentTime + 0.4) {
      const i = this._step % 32, t = this._nextT - this.ctx.currentTime;
      const deg = sc[Math.floor(rnd(i) * sc.length)], oct = rnd(i + 50) > 0.7 ? 2 : 1;
      if (i % 2 === 0 || rnd(i + 9) > 0.55) this.tone(root * oct * Math.pow(2, deg / 12), stepDur * 1.6, 'triangle', 0.5, 1, t, this.bgmGain);
      if (i % 8 === 0) this.tone(root / 2 * Math.pow(2, sc[Math.floor(rnd(i + 3) * 3)] / 12), stepDur * 6, 'sine', 0.7, 1, t, this.bgmGain);
      this._step++; this._nextT += stepDur;
    }
  },
};
