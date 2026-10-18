// 임시 픽셀 스프라이트 (코드로 그려서 만듭니다). 32x32 해상도의 귀여운 캐릭터.
// 나중에 직접 그린 이미지로 교체할 수 있도록 "스프라이트 얻는 함수"만 밖에서 사용합니다.

function _mk(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return { c, g: c.getContext('2d'), w, h };
}
function _px(s, x, y, col) {
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= s.w || y >= s.h) return;
  s.g.fillStyle = col; s.g.fillRect(x, y, 1, 1);
}
function _rect(s, x, y, w, h, col) { s.g.fillStyle = col; s.g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
function _mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const f = (sh) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
  return '#' + [16, 8, 0].map((sh) => f(sh).toString(16).padStart(2, '0')).join('');
}
function _pal(base) { return { b: base, s: _mix(base, '#000000', 0.22), h: _mix(base, '#ffffff', 0.38) }; }

// 타원 채우기 (오른쪽 아래는 어둡게, 왼쪽 위에 하이라이트)
function _ell(s, cx, cy, rx, ry, pal) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, d = dx * dx + dy * dy;
      if (d > 1) continue;
      let col = pal.b;
      if (pal.s && (dx * 0.5 + dy * 0.85) > 0.42) col = pal.s;
      if (pal.h && ((dx + 0.42) * (dx + 0.42) + (dy + 0.5) * (dy + 0.5)) < 0.06) col = pal.h;
      _px(s, x, y, col);
    }
  }
}
function _tri(s, x1, y1, x2, y2, x3, y3, col) {
  const minX = Math.floor(Math.min(x1, x2, x3)), maxX = Math.ceil(Math.max(x1, x2, x3));
  const minY = Math.floor(Math.min(y1, y2, y3)), maxY = Math.ceil(Math.max(y1, y2, y3));
  const den = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5, py = y + 0.5;
      const a = ((y2 - y3) * (px - x3) + (x3 - x2) * (py - y3)) / den;
      const b = ((y3 - y1) * (px - x3) + (x1 - x3) * (py - y3)) / den;
      if (a >= 0 && b >= 0 && a + b <= 1) _px(s, x, y, col);
    }
  }
}
function _outline(s, col) {
  const d = s.g.getImageData(0, 0, s.w, s.h).data;
  const a = (x, y) => (x < 0 || y < 0 || x >= s.w || y >= s.h) ? 0 : d[(y * s.w + x) * 4 + 3];
  const add = [];
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
    if (!a(x, y) && (a(x - 1, y) || a(x + 1, y) || a(x, y - 1) || a(x, y + 1))) add.push([x, y]);
  }
  for (const [x, y] of add) _px(s, x, y, col);
}

// 눈: open / blink / happy / hurt / sleep
function _eyes(s, x, y, mode, k) {
  const ink = '#241a1a';
  k = k || 1;
  if (mode === 'open') {
    _rect(s, x, y, 2 * k, 3 * k, ink);
    _px(s, x, y, '#ffffff');
  } else if (mode === 'happy') {
    _px(s, x, y + 2 * k, ink); _px(s, x + 1, y + k, ink); _px(s, x + 2, y + 2 * k, ink);
  } else if (mode === 'hurt') {
    _px(s, x, y, ink); _px(s, x + 1, y + 1, ink); _px(s, x + 2, y + 2, ink);
    _px(s, x + 2, y, ink); _px(s, x, y + 2, ink);
  } else { // blink, sleep
    _rect(s, x, y + 2 * k, 3 * k, k, ink);
  }
}

// ---------- 장비 그림 ----------
function _clearEll(s, cx, cy, rx, ry) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
    if (dx * dx + dy * dy <= 1) s.g.clearRect(x, y, 1, 1);
  }
}
// 장비 색: 지역 색(재질) + 등급 색(장식/보석)
function _gear(it) {
  const rg = CFG.regions[it.region - 1];
  return { main: _pal(_mix(rg.color, '#b4bccb', 0.3)), reg: rg.color, trim: CFG.gradeColors[it.grade], trimDark: _mix(CFG.gradeColors[it.grade], '#000000', 0.35) };
}

// 무기 (손에 드는 그림이자 아이콘). it이 없으면 기본 검
function drawWeapon(it) {
  const lw = it && typeof legendOf === 'function' && legendOf(it);   // 전설 무기: 고유한 모양 (손에 드는 그림을 작게 줄여 아이콘으로 씀)
  if (lw) { const ic = _mk(24, 24); ic.g.drawImage(drawLegendWeaponHi(lw.name), 0, 0, 24, 24); return ic.c; }
  const s = _mk(24, 24);
  const cls = it ? it.cls : 'melee', c = it ? _gear(it) : { main: _pal('#c9d1dc'), reg: '#e8b83a', trim: '#e8b83a', trimDark: '#b8861f' };
  if (cls === 'ranged') { // 활
    for (let y = 3; y <= 20; y++) {
      const x = 17 - Math.round(((y - 11.5) * (y - 11.5)) / 9);
      _px(s, x, y, '#a8703a'); _px(s, x + 1, y, '#7a4a22');
    }
    for (let y = 4; y <= 19; y++) _px(s, 9, y, '#e8eef5');
    _rect(s, 15, 10, 3, 3, c.reg); _px(s, 16, 11, c.trim);
    _px(s, 10, 11, '#e8eef5');
  } else if (cls === 'mage') { // 지팡이
    for (let i = 0; i < 15; i++) { _px(s, 4 + i, 21 - i, '#a8703a'); _px(s, 5 + i, 21 - i, '#7a4a22'); }
    _ell(s, 18.5, 6.5, 4, 4, _pal(c.reg));
    _px(s, 17, 5, '#ffffff'); _rect(s, 14, 10, 2, 2, c.trim);
  } else { // 검
    const lite = _mix('#f4f8ff', c.trim, 0.22), dark = _mix('#b8c4d6', c.trim, 0.22);
    for (let i = 0; i < 15; i++) {
      const x = 7 + i, y = 17 - i;
      _px(s, x, y, lite); _px(s, x + 1, y, dark); _px(s, x, y + 1, dark);
    }
    _px(s, 22, 2, lite);
    for (let j = -3; j <= 3; j++) _px(s, 6 + j, 18 + j, c.trim);
    for (let j = -3; j <= 3; j++) _px(s, 7 + j, 18 + j, c.trimDark);
    _px(s, 5, 19, '#8a5a2a'); _px(s, 4, 20, '#8a5a2a'); _px(s, 5, 20, '#6a4220'); _px(s, 3, 21, '#8a5a2a'); _px(s, 4, 21, '#6a4220');
    _px(s, 2, 22, c.trim); _px(s, 3, 22, c.trim);
  }
  _outline(s, '#2a2030');
  return s.c;
}

// ---------- 귀여운 장비 그림 (아이콘 24x24 / 캐릭터가 입는 모습 32x32) ----------
const _CREAM = '#f7f0e0';

// 부드러운 파스텔 색 (지역 색) + 등급 색(리본/별/방울 장식)
function _cute(it) {
  const rg = CFG.regions[it.region - 1], soft = _mix(rg.color, '#ffffff', 0.2), g = CFG.gradeColors[it.grade];
  return { main: _pal(soft), dark: _mix(soft, '#000000', 0.22), trim: g, trimDark: _mix(g, '#000000', 0.3), trimLite: _mix(g, '#ffffff', 0.5) };
}
const _BELL = { b: '#ffd54a', s: '#d49a1a', h: '#fff3b0' };
const _OUT = '#3a2630';

// 가로로 퍼지는 사다리꼴(로브/망토) 채우기
function _trap(s, cx, y0, y1, w0, w1, pal) {
  for (let y = y0; y <= y1; y++) {
    const half = (w0 + (w1 - w0) * ((y - y0) / Math.max(1, y1 - y0))) / 2, x0 = Math.round(cx - half), w = Math.round(half * 2);
    _rect(s, x0, y, w, 1, pal.b);
    _rect(s, x0 + w - Math.max(2, Math.round(w * 0.22)), y, Math.max(2, Math.round(w * 0.22)), 1, pal.s);
    _px(s, x0 + 1, y, pal.h);
  }
}
const _star = (s, x, y, col) => { _px(s, x, y, col); _px(s, x - 1, y, col); _px(s, x + 1, y, col); _px(s, x, y - 1, col); _px(s, x, y + 1, col); };

function drawGearIcon(it) {
  if (it.slot === 'weapon') return drawWeapon(it);
  const s = _mk(24, 24), c = _cute(it), cls = it.cls;
  if (it.slot === 'hat') {
    if (cls === 'mage') { // 보라 마법모자
      _tri(s, 12, 0.5, 4, 17, 20, 17, '#8a5ad8'); _tri(s, 12.5, 0.5, 13, 17, 20, 17, '#6a3ab8');
      _ell(s, 12, 18.5, 11, 3, { b: '#6a3ab8' }); _rect(s, 5, 14, 14, 2, '#ffd23a');
      _star(s, 12, 8, c.trimLite);
    } else if (cls === 'ranged') { // 초록 베레모
      _ell(s, 11, 14, 10, 5.5, { b: '#58c068', s: '#3a9a4a', h: '#8ae09a' }); _ell(s, 11, 8.6, 2, 1.6, { b: '#3a9a4a' });
      _rect(s, 2, 16, 18, 2, '#2f7a3c');
      _tri(s, 15, 9, 22, 1, 19, 10, c.trim); _tri(s, 15, 9, 22, 1, 17, 6, c.trimLite);
    } else { // 빨간 방울 비니
      _ell(s, 12, 13, 9, 8, { b: '#e85a5a', s: '#c04040', h: '#ff8a8a' }); _rect(s, 3, 15, 18, 5, '#fff6e6');
      for (let x = 4; x < 21; x += 3) _rect(s, x, 15, 1, 5, '#f0d0c0');
      _ell(s, 12, 4.8, 3.2, 3.2, { b: c.trimLite, s: c.trim, h: '#ffffff' });
    }  } else if (it.slot === 'armor') {
    if (cls === 'mage') { // 별빛 로브
      _ell(s, 4.5, 11, 2.6, 5, c.main); _ell(s, 19.5, 11, 2.6, 5, c.main);
      _trap(s, 12, 5, 21, 8, 18, c.main); _rect(s, 8, 5, 8, 2, '#ffffff'); _rect(s, 4, 20, 16, 2, c.trim);
      _star(s, 9, 12, c.trimLite); _star(s, 15, 15, c.trimLite); _px(s, 11, 18, c.trimLite);
    } else if (cls === 'ranged') { // 스카프 조끼
      _rect(s, 6, 8, 12, 13, c.main.b); _rect(s, 15, 8, 3, 13, c.main.s); _rect(s, 6, 8, 2, 13, c.main.h);
      _rect(s, 5, 4, 14, 4, c.trim); _rect(s, 15, 8, 3, 8, c.trimDark); _rect(s, 15, 11, 3, 1, c.trim); _rect(s, 15, 14, 3, 1, c.trim);
      _px(s, 9, 13, _CREAM); _px(s, 9, 16, _CREAM);
    } else { // 망토 조끼
      _trap(s, 12, 4, 22, 11, 21, { b: c.dark, s: _mix(c.dark, '#000000', 0.2), h: c.dark });
      _rect(s, 8, 5, 8, 15, c.main.b); _rect(s, 14, 5, 2, 15, c.main.s); _rect(s, 8, 5, 8, 2, _CREAM);
      _px(s, 11, 11, c.trim); _px(s, 11, 14, c.trim); _px(s, 12, 11, c.trimLite); _px(s, 12, 14, c.trimLite);
    }
  } else { // 방울 목걸이
    _ell(s, 12, 9, 8, 8, { b: c.trim, s: c.trimDark }); _clearEll(s, 12, 9, 6, 6);
    _tri(s, 12, 2, 6, 0, 6, 5, c.trimLite); _tri(s, 12, 2, 18, 0, 18, 5, c.trimLite);
    _ell(s, 12, 16.5, 4.2, 4.4, _BELL); _rect(s, 8, 19, 8, 1, _BELL.s); _rect(s, 11, 19, 2, 1, '#8a5a10'); _px(s, 12, 21, '#8a5a10');
    _rect(s, 11, 12, 2, 2, _BELL.s);
  }
  _outline(s, _OUT);
  return s.c;
}

// 몬스터: k=1 일반(32px), k=2 보스(64px, 해상도가 두 배라서 더 자세함)
function drawSlime(color, k) {
  const s = _mk(32 * k, 29 * k), pal = _pal(color);
  _ell(s, 16 * k, 21 * k, 13 * k, 6.5 * k, pal);
  _ell(s, 16 * k, 15 * k, 11.5 * k, 11 * k, pal);
  for (const x of [11, 20]) { _ell(s, x * k, 16 * k, 1.7 * k, 2.4 * k, { b: '#241a1a' }); _px(s, x * k - k * 0.5, 15 * k - k * 0.5, '#fff'); if (k > 1) _px(s, x * k - 1, 15 * k, '#fff'); }
  _ell(s, 7.5 * k, 20 * k, 2 * k, 1.2 * k, { b: '#ff9fb4' }); _ell(s, 24.5 * k, 20 * k, 2 * k, 1.2 * k, { b: '#ff9fb4' });
  _rect(s, 14.5 * k, 20 * k, 3 * k, k, '#3a2a2a');
  _outline(s, _mix(color, '#000000', 0.7));
  return s.c;
}

function drawMushroom(color, k) {
  const s = _mk(32 * k, 31 * k), cap = _pal(color);
  _ell(s, 12 * k, 28 * k, 3 * k, 2 * k, _pal('#e8d8b0')); _ell(s, 20 * k, 28 * k, 3 * k, 2 * k, _pal('#e8d8b0'));
  _ell(s, 16 * k, 21 * k, 7 * k, 8 * k, _pal('#f1e3c0'));
  _ell(s, 16 * k, 12 * k, 14.5 * k, 10 * k, cap);
  _ell(s, 10 * k, 9 * k, 2.6 * k, 2.1 * k, { b: '#ffffff' }); _ell(s, 20 * k, 7 * k, 2.2 * k, 1.8 * k, { b: '#ffffff' }); _ell(s, 24 * k, 13 * k, 2 * k, 1.6 * k, { b: '#ffffff' });
  for (const x of [13, 19]) { _ell(s, x * k, 23 * k, 1.3 * k, 1.9 * k, { b: '#241a1a' }); _px(s, x * k - k * 0.5, 22 * k, '#fff'); }
  _ell(s, 10.5 * k, 25.5 * k, 1.6 * k, 1 * k, { b: '#ff9fb4' }); _ell(s, 21.5 * k, 25.5 * k, 1.6 * k, 1 * k, { b: '#ff9fb4' });
  _rect(s, 15 * k, 26 * k, 2 * k, k, '#3a2a2a');
  _outline(s, _mix(color, '#000000', 0.75));
  return s.c;
}

// ---------- 캐시된 접근 함수 ----------
const _cache = {};
function _get(key, make) { return _cache[key] || (_cache[key] = make()); }

// expr: { eyes:'open'|'blink'|'happy'|'hurt', mouth:bool, tail:0|1 }
function animalSprite(animal, expr) {
  const e = expr || { eyes: 'open', mouth: false, tail: 0 };
  const key = `${animal}_${e.eyes}_${e.mouth ? 1 : 0}_${e.tail ? 1 : 0}`;
  return _get(key, () => (animal === 'cat' ? drawCatHi(e) : drawDogHi(e)));
}
const _gk = (it) => `${it.cls}_${it.slot}_${it.region}_${it.grade}` + (it.slot === 'weapon' && it.grade === 4 && typeof legendOf === 'function' && legendOf(it) ? '_' + legendOf(it).name : '');

// 손에 드는 무기 (없으면 null)
function weaponSprite(it) { return it ? _get('wp_' + _gk(it), () => drawWeaponHi(it)) : null; }

// 장비 아이콘 (HTML <img>에 쓸 수 있는 주소). 아이템이 없으면 빈칸 안내용 흐린 그림
const _iconUrls = {};
function itemIconUrl(it) {
  const k = _gk(it);
  return _iconUrls[k] || (_iconUrls[k] = drawGearIcon(it).toDataURL());
}

// 장비를 입은 캐릭터 (기본 몸 + 옷 + 반지 + 모자)
function characterSprite(save, expr) {
  const base = animalSprite(save.animal, expr), eq = save.equip;
  const parts = ['hat'].filter((sl) => eq[sl]);
  if (!parts.length) return base;
  const key = 'chr_' + save.animal + '_' + expr.eyes + '_' + (expr.mouth ? 1 : 0) + '_' + (expr.tail ? 1 : 0) + '_' + parts.map((sl) => sl + _gk(eq[sl])).join('|');
  return _get(key, () => {
    const s = _mk(32 * HK, 32 * HK);
    s.g.drawImage(base, 0, 0);
    for (const sl of parts) s.g.drawImage(sl === 'armor' ? drawArmorHi(eq[sl]) : sl === 'ring' ? drawRingHi(eq[sl]) : drawHatHi(eq[sl]), 0, 0);
    return s.c;
  });
}
function monsterSprite(region, boss, variant) {
  const rg = CFG.regions[region - 1], k = boss ? 2 : 1, kind = monsterKind(region, boss, variant);
  return _get(`mon_${region}_${kind}_${k}`, () => (kind && drawRegionMonster(kind, rg.color, k)) || drawSlime(rg.color, boss ? 4 : 2));
}



