// 캔버스 렌더링 (논리 해상도 256x144, CSS로 정수배 확대). 숫자 효과는 별도의 고해상도 캔버스에 그림.
class Renderer {
  constructor(canvas, fxCanvas) {
    this.c = canvas; this.fc = fxCanvas; this.g = canvas.getContext('2d');
    this.V = CFG.view; this.W = this.V.w; this.H = this.V.h;
    canvas.width = this.W * HK; canvas.height = this.H * HK;   // 배경은 256x144 칸 그대로 두고, 캐릭터/몬스터는 2배 촘촘한 그림을 그리기 위해 버퍼를 2배로
    this.g.imageSmoothingEnabled = false;
    this.bg = {};
  }

  // ----- 배경 타일 (지역별로 한 번만 생성) -----
  layers(region) {
    if (this.bg[region]) return this.bg[region];
    const rg = CFG.regions[region - 1], W = this.W, gh = this.H - this.V.ground;
    const TAU = Math.PI * 2;

    const clouds = _mk(W, 40);
    const cc = { b: rg.cloud, s: _mix(rg.cloud, '#6a7ab0', 0.18) };
    for (const [x, y, r] of [[30, 12, 1], [120, 22, 0.8], [200, 9, 1.1]]) {
      _ell(clouds, x, y, 14 * r, 5 * r, cc); _ell(clouds, x - 9 * r, y + 2, 8 * r, 4 * r, cc); _ell(clouds, x + 10 * r, y + 2, 9 * r, 4 * r, cc);
    }

    const lm = _mk(W, 96); drawLandmark(lm, rg.landmark, rg);
    const far = _mk(W, 50), near = _mk(W, 36);
    for (let x = 0; x < W; x++) {
      const h1 = 22 + Math.sin(TAU * x / W * 2) * 9 + Math.sin(TAU * x / W * 5) * 3;
      _rect(far, x, 50 - h1, 1, h1, rg.hill);
      const h2 = 12 + Math.sin(TAU * x / W * 3 + 1) * 6 + Math.sin(TAU * x / W * 7) * 2;
      _rect(near, x, 36 - h2, 1, h2, rg.hill2);
    }

    const trees = _mk(W, 52);
    const tp = _pal(rg.tree);
    for (const [x, sz] of [[26, 1], [92, 0.85], [160, 1.1], [224, 0.9]]) {
      const base = 52, th = 14 * sz;
      _rect(trees, x - 2, base - th, 4, th, '#6a4a2a');
      _ell(trees, x, base - th - 8 * sz, 11 * sz, 10 * sz, tp);
      _ell(trees, x - 7 * sz, base - th - 3 * sz, 7 * sz, 6 * sz, tp);
      _ell(trees, x + 7 * sz, base - th - 3 * sz, 7 * sz, 6 * sz, tp);
    }
    _outline(trees, _mix(rg.tree, '#000000', 0.6));

    const ground = _mk(W, gh);
    _rect(ground, 0, 0, W, gh, rg.ground);
    _rect(ground, 0, 0, W, 2, _mix(rg.ground, '#ffffff', 0.25));
    _rect(ground, 0, 2, W, 1, _mix(rg.ground, '#000000', 0.2));
    for (let i = 0; i < 26; i++) {
      const x = Math.floor(Math.random() * W), y = 5 + Math.floor(Math.random() * (gh - 7));
      _rect(ground, x, y, 5, 1, rg.groundDark); _rect(ground, x + 1, y + 1, 3, 1, rg.groundDark);
    }
    for (let i = 0; i < 18; i++) {
      const x = Math.floor(Math.random() * W), y = 4 + Math.floor(Math.random() * (gh - 6));
      _px(ground, x, y, _mix(rg.ground, '#ffffff', 0.35)); _px(ground, x, y - 1, _mix(rg.ground, '#ffffff', 0.35));
    }
    for (let i = 0; i < 5; i++) { // 작은 꽃
      const x = Math.floor(Math.random() * W), y = 6 + Math.floor(Math.random() * (gh - 9));
      _px(ground, x, y, ['#ffe36a', '#ff9fb4', '#ffffff'][i % 3]);
    }
    return (this.bg[region] = { lm: lm.c, clouds: clouds.c, far: far.c, near: near.c, trees: trees.c, ground: ground.c });
  }

  tile(img, off, y) {
    const w = img.width, x = -(((Math.floor(off) % w) + w) % w);
    this.g.drawImage(img, x, y); this.g.drawImage(img, x + w, y);
  }

  draw(rt) {
    this.g.setTransform(HK, 0, 0, HK, 0, 0); this.g.imageSmoothingEnabled = false;
    const g = this.g, s = rt.save, sr = stageRegion(rt), rg = CFG.regions[sr - 1], L = this.layers(sr), gy = this.V.ground;
    const grad = g.createLinearGradient(0, 0, 0, gy);
    grad.addColorStop(0, rg.sky[0]); grad.addColorStop(1, rg.sky[1]);
    g.fillStyle = grad; g.fillRect(0, 0, this.W, gy);
    const sc = rt.scroll;
    this.tile(L.clouds, rt.clock * 1.5 + sc * 0.05, 4);
    this.tile(L.far, sc * 0.12, gy - 50);
    this.tile(L.lm, sc * 0.2, gy - 96);
    this.tile(L.near, sc * 0.3, gy - 36);
    this.tile(L.trees, sc * 0.6, gy - 50);
    this.tile(L.ground, sc, gy);

    for (const e of rt.enemies) this.drawEnemy(rt, e, sr);
    this.drawPlayer(rt);
    for (const p of rt.proj) this.drawProj(rt, p);
    if (rt.weak) { g.fillStyle = `rgba(255,50,50,${0.1 + Math.sin(rt.clock * 10) * 0.05})`; g.fillRect(0, 0, this.W, this.H); }
    this.drawFx(rt);
  }

  drawPlayer(rt) {
    const g = this.g, s = rt.save, t = rt.clock, foot = this.V.foot, px = this.V.playerX;
    const swing = Math.max(0, 1 - (t - rt.hitAt) / 0.18);
    const hurt = t - rt.hurtAt < 0.25;
    const happy = t - rt.happyAt < 1.5;
    let eyes = 'open';
    if (hurt) eyes = 'hurt'; else if (happy) eyes = 'happy'; else if (t % 4 < 0.14) eyes = 'blink';
    const spr = characterSprite(s, { eyes, mouth: swing > 0.3 || happy, tail: Math.floor(t * 3) % 2 });
    const engaged = rt.enemies.some((e) => e.x <= e.stop + 1);
    const bob = Math.sin(t * 7) * (engaged ? 0.6 : 1.2);
    const hop = happy ? Math.abs(Math.sin(t * 9)) * 6 : 0;
    const sw0 = spr.width / HK, sh0 = spr.height / HK, hr = (v) => Math.round(v * HK) / HK;  // 절반 칸 단위로 맞춤
    const x = hr(px - sw0 / 2 + swing * 4 - (hurt ? 2 : 0));
    const y = hr(foot - sh0 + 1 + bob - hop);
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.fillRect(px - 10, foot - 1, 20, 3);
    g.drawImage(spr, x, y, sw0, sh0);
    // 무기
    const sw = weaponSprite(s.equip.weapon);
    if (sw) {
      const cls = s.weaponType;
      g.save();
      if (cls === 'ranged') { // 활: 몸 앞에 세워 들고, 쏠 때 살짝 뒤로 당김
        g.drawImage(sw, hr(x + 27 - 13 - swing * 2), y + 16 - 11, 24, 24);
      } else if (cls === 'mage') { // 스태프: 비스듬히 들고, 쓸 때 살짝 흔듦
        g.translate(x + 22, y + 25);
        g.rotate(-0.1 + swing * 0.5);
        g.drawImage(sw, -4, -21, 24, 24);
      } else { // 칼
        g.translate(x + 24, y + 22);
        g.rotate(-0.45 + swing * 1.5);
        g.drawImage(sw, -3, -21, 24, 24);
      }
      g.restore();
    }
    this.bar(px - 12, y - 4, 24, rt.hp / rt.d.hp, '#4ee06a');
  }

  drawEnemy(rt, e, region) {
    const g = this.g, t = rt.clock, foot = this.V.foot, px = this.V.playerX;
    const spr = monsterSprite(region, e.boss);
    const hop = Math.abs(Math.sin(t * 6 + e.seed)) * (e.x > e.stop + 1 ? 4 : 1);
    const shake = (t - e.flash) < 0.1 ? (Math.round(Math.random() * 3) - 1) : 0;
    const cx = px + e.x, w = spr.width / HK, h = spr.height / HK, hr = (v) => Math.round(v * HK) / HK;
    const x = hr(cx - w / 2 + shake), y = hr(foot - h + 1 - hop);
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.fillRect(Math.round(cx - w / 3), foot - 1, Math.round(w * 0.66), 3);
    g.drawImage(spr, x, y, w, h);
    if (e.boss) {
      const cxm = Math.round(cx), top = y + 15;
      g.fillStyle = '#7a5a10'; g.fillRect(cxm - 11, top - 11, 22, 11);
      g.fillStyle = '#ffd23a'; g.fillRect(cxm - 10, top - 6, 20, 5);
      for (const dx of [-10, -2, 6]) { g.fillRect(cxm + dx, top - 10, 4, 5); }
      g.fillStyle = '#ff5a5a'; g.fillRect(cxm - 1, top - 5, 2, 2);
      if (rt.weak) {
        const cy = y + h * 0.5, r = 9 + Math.sin(t * 14) * 1.5;
        g.strokeStyle = '#ff4040'; g.lineWidth = 1.5;
        g.beginPath(); g.arc(cxm, cy, r, 0, 6.3); g.stroke();
        g.fillStyle = '#ff4040'; g.fillRect(cxm - 1, cy - 4, 2, 8); g.fillRect(cxm - 4, cy - 1, 8, 2);
      }
    }
    this.bar(cx - (e.boss ? 24 : 12), y - 4, e.boss ? 48 : 24, e.hp / e.maxhp, e.boss ? '#ff5a5a' : '#ff9a5a');
  }

  // 날아가는 화살/마법 연출 (피해는 이미 적용됐고, 모양만 그림)
  drawProj(rt, p) {
    const g = this.g, age = rt.clock - p.born, foot = this.V.foot;
    const x0 = this.V.playerX + 24, x1 = this.V.playerX + p.x, yMid = foot - 16;
    const lerp = (a, b, t) => a + (b - a) * t;
    if (p.type === 'arrow') {
      for (let i = 0; i < (p.hits || 1); i++) {
        const t = (age - i * 0.1) / 0.22;
        if (t < 0 || t > 1) continue;
        const x = lerp(x0, x1, t);
        g.fillStyle = '#7a4a22'; g.fillRect(Math.round(x - 8), yMid - i * 0 + (i - 1) * 3, 8, 1);
        g.fillStyle = '#e8eef5'; g.fillRect(Math.round(x), yMid + (i - 1) * 3 - 1, 3, 3);
        g.fillStyle = '#ffffff'; g.fillRect(Math.round(x - 9), yMid + (i - 1) * 3 - 1, 2, 3);
      }
    } else if (p.type === 'spark') {
      const t = age / 0.2;
      if (t <= 1) { g.fillStyle = '#8ad4ff'; g.fillRect(Math.round(lerp(x0, x1, t)) - 1, yMid - 1, 3, 3); g.fillStyle = '#fff'; g.fillRect(Math.round(lerp(x0, x1, t)), yMid, 1, 1); }
    } else if (p.type === 'fire') {
      const t = age / 0.28;
      if (t <= 1) {
        const x = lerp(x0, x1, t);
        g.fillStyle = '#ff7a2a'; g.beginPath(); g.arc(x, yMid, 4, 0, 6.3); g.fill();
        g.fillStyle = '#ffd35a'; g.beginPath(); g.arc(x, yMid, 2, 0, 6.3); g.fill();
        g.fillStyle = 'rgba(255,120,40,.5)'; g.fillRect(Math.round(x - 12), yMid - 1, 8, 2);
      } else if (age < 0.5) { g.fillStyle = `rgba(255,160,60,${1 - (age - 0.28) / 0.22})`; g.beginPath(); g.arc(x1, yMid, 6 + (age - 0.28) * 30, 0, 6.3); g.fill(); }
    } else if (p.type === 'bolt') {
      if (age < 0.35) {
        for (const dx of [-26, 0, 26]) {
          const bx = x1 + dx; if (bx > this.W - 4) continue;
          g.strokeStyle = age < 0.12 ? '#ffffff' : '#ffe96a'; g.lineWidth = 2; g.beginPath();
          g.moveTo(bx, 0); g.lineTo(bx - 5, foot * 0.3); g.lineTo(bx + 4, foot * 0.55); g.lineTo(bx - 3, foot * 0.8); g.lineTo(bx, foot); g.stroke();
        }
        g.fillStyle = `rgba(255,255,160,${0.35 * (1 - age / 0.35)})`; g.fillRect(0, 0, this.W, this.H);
      }
    } else if (p.type === 'star') {
      for (let i = 0; i < 9; i++) {
        const t = (age - i * 0.04) / 0.35;
        if (t < 0 || t > 1) continue;
        const sx = x1 - 40 + i * 10 + (i % 2) * 4, sy = lerp(-8, foot - 4, t);
        g.fillStyle = '#fff6a8'; g.fillRect(Math.round(sx), Math.round(sy), 3, 3);
        g.fillStyle = 'rgba(255,240,140,.5)'; g.fillRect(Math.round(sx) + 1, Math.round(sy) - 8, 1, 8);
      }
    } else if (p.type === 'meteor') {
      const t = age / 0.5;
      if (t <= 1) {
        const x = lerp(x1 - 50, x1, t), y = lerp(-10, foot - 8, t);
        g.fillStyle = 'rgba(255,100,30,.5)'; g.beginPath(); g.arc(x - 8, y - 8, 8, 0, 6.3); g.fill();
        g.fillStyle = '#ff5a1a'; g.beginPath(); g.arc(x, y, 8, 0, 6.3); g.fill();
        g.fillStyle = '#ffd35a'; g.beginPath(); g.arc(x + 1, y + 1, 4, 0, 6.3); g.fill();
      } else if (age < 0.75) {
        const k = (age - 0.5) / 0.25;
        g.fillStyle = `rgba(255,140,40,${1 - k})`; g.beginPath(); g.arc(x1, foot - 8, 10 + k * 40, 0, 6.3); g.fill();
      }
    }
  }

  bar(x, y, w, ratio, color) {
    const g = this.g;
    ratio = Math.max(0, Math.min(1, ratio));
    g.fillStyle = '#16161c'; g.fillRect(Math.round(x) - 1, Math.round(y) - 1, Math.round(w) + 2, 4);
    g.fillStyle = color; g.fillRect(Math.round(x), Math.round(y), Math.round(w * ratio), 2);
  }

  // 숫자 효과: 실제 화면 해상도 캔버스에 그려서 글씨가 또렷하게 보이도록
  drawFx(rt) {
    const fc = this.fc, g = fc.getContext('2d');
    g.clearRect(0, 0, fc.width, fc.height);
    const sc = fc.width / this.W;
    g.font = `bold ${Math.round(5.5 * sc)}px 'Malgun Gothic', sans-serif`;
    g.textAlign = 'center'; g.lineJoin = 'round';
    for (const f of rt.fx) {
      const age = rt.clock - f.born;
      g.globalAlpha = Math.max(0, 1 - age / 0.9);
      const x = (this.V.playerX + f.x) * sc, y = (this.V.foot - 40 - age * 18) * sc;
      g.lineWidth = Math.max(2, sc * 1.4); g.strokeStyle = '#000'; g.strokeText(f.text, x, y);
      g.fillStyle = f.color; g.fillText(f.text, x, y);
    }
    g.globalAlpha = 1;
  }
}


