// 고해상도 캐릭터 그림: 강아지/치즈 고양이, 입는 장비, 손에 드는 무기.
// 전투 화면은 256x144 칸이지만 캐릭터는 가로세로 2배 촘촘한 64x64로 그려서(HK=2) 더 자세한 도트를 표현함.
// 화면에는 크기를 절반으로 줄여 그리므로 캔버스의 실제 픽셀과 1:1로 맞음.
const HK = 2;

// 32칸 기준 좌표를 HK배로 키워서 그리는 도구 (E=타원, T=삼각형, R=사각형, P=점, L=굵은 선)
function _kit(s) {
  return {
    E: (cx, cy, rx, ry, pal) => _ell(s, cx * HK, cy * HK, rx * HK, ry * HK, pal),
    T: (x1, y1, x2, y2, x3, y3, c) => _tri(s, x1 * HK, y1 * HK, x2 * HK, y2 * HK, x3 * HK, y3 * HK, c),
    R: (x, y, w, h, c) => _rect(s, x * HK, y * HK, w * HK, h * HK, c),
    // 고해상도 칸(64 기준) 그대로 찍기
    p: (x, y, c) => _px(s, x, y, c),
    r: (x, y, w, h, c) => _rect(s, x, y, w, h, c),
    // 두께가 있는 선 (64 기준)
    L: (x1, y1, x2, y2, w, c) => {
      const n = Math.ceil(Math.hypot(x2 - x1, y2 - y1) * 2);
      for (let i = 0; i <= n; i++) { const t = i / n, x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t; _rect(s, Math.round(x - w / 2), Math.round(y - w / 2), w, w, c); }
    },
  };
}

// 눈 (64칸 기준). iris=홍채 색. 깜빡임/기쁨/아픔 표정
function _eyeHi(K, cx, cy, mode, iris) {
  const ink = '#241a1a';
  if (mode === 'open') {
    K.r(cx - 3, cy - 4, 6, 8, ink); K.r(cx - 4, cy - 3, 8, 6, ink);       // 둥근 눈
    K.r(cx - 3, cy - 1, 6, 4, iris); K.r(cx - 2, cy + 1, 4, 2, _mix(iris, '#ffffff', 0.25)); // 홍채
    K.r(cx - 2, cy - 3, 3, 3, '#ffffff'); K.p(cx + 1, cy + 1, '#ffffff'); // 반짝임
  } else if (mode === 'happy') {
    for (const [dx, dy] of [[-3, 1], [-2, 0], [-1, -1], [0, -1], [1, -1], [2, 0], [3, 1]]) K.r(cx + dx, cy + dy, 1, 2, ink);
  } else if (mode === 'hurt') {
    for (let i = -2; i <= 2; i++) { K.r(cx + i, cy + i, 2, 1, ink); K.r(cx + i, cy - i, 2, 1, ink); }
  } else { // blink
    K.r(cx - 4, cy + 1, 8, 2, ink); K.p(cx - 5, cy, ink); K.p(cx + 4, cy, ink);
  }
}

// ---------- 강아지 (코기 느낌: 납작한 색 면, 선 굵게, 쫑긋한 큰 귀, 흰 줄무늬와 흰 주둥이) ----------
function _dogEye(K, cx, cy, mode) {
  const ink = '#241a1a';
  if (mode === 'open') { K.r(cx - 2, cy - 2, 5, 5, ink); K.r(cx - 2, cy - 2, 2, 2, '#ffffff'); }
  else if (mode === 'happy') { K.r(cx - 3, cy + 1, 2, 2, ink); K.r(cx - 1, cy - 1, 3, 2, ink); K.r(cx + 2, cy + 1, 2, 2, ink); }
  else if (mode === 'hurt') { for (let i = -2; i <= 2; i++) { K.r(cx + i, cy + i, 2, 1, ink); K.r(cx + i, cy - i, 2, 1, ink); } }
  else K.r(cx - 3, cy + 1, 7, 2, ink);
}
function drawDogHi(e) {
  const s = _mk(32 * HK, 32 * HK), K = _kit(s);
  const main = { b: '#F0C040' }, white = { b: '#FFF8EC' }, pink = '#F4B8D8';
  const tw = e.tail ? 1 : 0;
  // 짧은 꼬리 (흔들흔들)
  K.E(24.6 + tw, 25.5, 2.2, 2.2, main); K.E(25 + tw, 24.6, 1.1, 1.1, white);
  // 몸 + 흰 배 + 흰 발
  K.E(16, 25.5, 6.8, 4.8, main); K.E(16, 27, 4.4, 3.4, white);
  K.E(11.5, 29, 3.2, 2, white); K.E(20.5, 29, 3.2, 2, white);
  for (const x of [21, 24, 40, 43]) K.r(x, 59, 1, 2, '#e8dcc0');
  // 쫑긋한 큰 귀 (안쪽 분홍)
  K.T(3.6, 13, 5.4, 1.6, 13.4, 9.6, main.b); K.T(28.4, 13, 26.6, 1.6, 18.6, 9.6, main.b);
  K.T(6.6, 11.4, 7, 5, 11.6, 9.4, pink); K.T(25.4, 11.4, 25, 5, 20.4, 9.4, pink);
  // 얼굴: 주황 윗부분 + 흰 이마 줄무늬 + 흰 아래 얼굴
  K.E(16, 16.4, 12, 9, main);
  K.R(14.6, 8.4, 2.8, 6.4, white.b); K.T(14.6, 14.8, 17.4, 14.8, 16, 19, white.b);
  K.E(16, 22, 9.8, 5.2, white); K.R(6.5, 17.6, 3, 3, white.b); K.R(22.5, 17.6, 3, 3, white.b);
  // 눈 / 코 / 입 / 혀
  _dogEye(K, 22, 31, e.eyes); _dogEye(K, 42, 31, e.eyes);
  K.r(29, 36, 6, 3, '#241a1a'); K.r(30, 39, 4, 1, '#241a1a');
  K.r(27, 40, 1, 1, '#241a1a'); K.r(28, 41, 2, 1, '#241a1a'); K.r(34, 41, 2, 1, '#241a1a'); K.r(36, 40, 1, 1, '#241a1a');
  if (e.mouth) { K.r(29, 42, 6, 4, '#c8283a'); K.r(31, 46, 2, 2, '#c8283a'); K.r(29, 41, 6, 1, '#241a1a'); }
  else { K.r(30, 42, 4, 3, '#e04a5a'); K.r(31, 45, 2, 1, '#e04a5a'); }
  _outline(s, '#2a1a1a');
  return s.c;
}
// ---------- 치즈 고양이 (납작한 색 면 도트, 넓은 얼굴, 큰 귀, 이마 줄무늬, 크림색 주둥이) ----------
function _catEye(K, cx, cy, mode) {
  const ink = '#52352F';
  if (mode === 'open') { K.r(cx - 2, cy - 4, 5, 8, ink); K.r(cx - 3, cy - 3, 7, 6, ink); K.r(cx - 2, cy - 3, 2, 3, '#ffffff'); }
  else if (mode === 'happy') { K.r(cx - 4, cy, 3, 2, ink); K.r(cx - 2, cy - 2, 5, 2, ink); K.r(cx + 3, cy, 3, 2, ink); } // 웃는 눈 ^
  else if (mode === 'hurt') { for (let i = -2; i <= 2; i++) { K.r(cx + i, cy + i, 2, 1, ink); K.r(cx + i, cy - i, 2, 1, ink); } }
  else K.r(cx - 4, cy + 1, 9, 2, ink);   // 깜빡임
}
function drawCatHi(e) {
  const s = _mk(32 * HK, 32 * HK), K = _kit(s);
  const main = { b: '#EAB97B' }, stripe = '#B38245', cream = { b: '#FFEEDA' }, pink = '#F28A96';
  const tw = e.tail ? 1 : 0;
  // 가늘고 긴 꼬리 (줄무늬, 끝은 크림색)
  [[48, 55], [51, 54], [53, 52], [54, 49], [54 + tw, 45], [55 + tw, 41], [55 + tw, 37]].forEach(([x, y], i) => { K.r(x - 1, y - 1, 4, 4, '#EAB97B'); if (i % 2) K.r(x - 1, y - 1, 4, 2, stripe); });
  K.r(55 + tw - 1, 34, 4, 4, '#FFEEDA');
  // 몸 + 크림 배 + 크림 발
  K.E(16, 24.8, 6.6, 5, main); K.E(16, 26.2, 3.8, 3.2, cream);
  K.E(11.5, 28.6, 3, 2, cream); K.E(20.5, 28.6, 3, 2, cream);
  for (const x of [20, 23, 40, 43]) K.r(x, 58, 1, 2, '#e3cfae');
  // 큰 귀 (안쪽 크림색)
  K.T(4, 11, 5.5, 2.4, 13.4, 7, main.b); K.T(28, 11, 26.5, 2.4, 18.6, 7, main.b);
  K.T(6.4, 9.6, 6.8, 5, 11, 7.6, cream.b); K.T(25.6, 9.6, 25.2, 5, 21, 7.6, cream.b);
  // 넓은 얼굴
  K.E(16, 15.2, 11.6, 8.8, main);
  K.r(26, 13, 3, 6, stripe); K.r(31, 13, 2, 5, stripe); K.r(35, 13, 3, 6, stripe);     // 이마 줄무늬
  K.r(11, 29, 6, 2, stripe); K.r(11, 33, 5, 2, stripe); K.r(47, 29, 6, 2, stripe); K.r(48, 33, 5, 2, stripe);   // 볼 줄무늬
  K.E(16, 20, 6.2, 4.2, cream); K.E(16, 21.6, 4.4, 2.6, cream);
  // 눈, 코, 입, 수염
  _catEye(K, 21, 26, e.eyes); _catEye(K, 43, 26, e.eyes);
  K.r(30, 31, 4, 2, pink); K.r(31, 33, 2, 1, pink);
  if (e.mouth) { K.E(16, 20.6, 1.8, 1.5, { b: '#8a2a35' }); }
  else { K.r(28, 34, 3, 1, pink); K.r(33, 34, 3, 1, pink); K.r(31, 35, 2, 1, pink); }
  for (const dy of [-1, 2, 5]) { K.r(2, 31 + dy, 8, 1, '#f1d3a0'); K.r(54, 31 + dy, 8, 1, '#f1d3a0'); }
  _outline(s, '#9a6a35');
  return s.c;
}
// ---------- 입는 장비 (얼굴과 몸을 가리지 않는 작은 소품) ----------
function drawHatHi(it) { // 귀 사이에 얹는 알록달록한 작은 모자 (색은 직업별, 장식은 등급 색)
  const s = _mk(32 * HK, 32 * HK), K = _kit(s), c = _cute(it), cls = it.cls;
  if (cls === 'mage') { // 보라 마법모자 + 노란 띠와 별
    K.T(16, 0.2, 12.6, 7, 19.4, 7, '#8a5ad8'); K.T(16.6, 0.2, 17.2, 7, 19.4, 7, '#6a3ab8');
    K.E(16, 7.2, 5.4, 1.3, { b: '#6a3ab8' }); K.R(13.2, 5.4, 5.6, 1.2, '#ffd23a');
    K.r(31, 6, 2, 2, c.trimLite); K.r(30, 7, 4, 1, c.trimLite); K.r(33, 14, 1, 1, '#ffffff');
  } else if (cls === 'ranged') { // 초록 베레모 + 깃털 + 빨간 리본
    K.E(16, 6.2, 5, 2.4, { b: '#58c068', s: '#3a9a4a', h: '#8ae09a' }); K.r(31, 4, 2, 3, '#3a9a4a');
    K.R(11.2, 7.6, 9.6, 1, '#2f7a3c');
    K.L(37, 9, 44, 3, 2, c.trim); K.L(38, 8, 43, 4, 1, c.trimLite);
    K.r(27, 14, 4, 2, '#ff6a7a'); K.r(26, 15, 2, 2, '#ff6a7a');
  } else { // 빨간 방울 비니 + 크림 줄무늬
    K.E(16, 6.4, 4.8, 3, { b: '#e85a5a', s: '#c04040', h: '#ff8a8a' });
    K.R(11.2, 7.4, 9.6, 1.6, '#fff6e6');
    for (const x of [24, 28, 32, 36, 40]) K.r(x, 15, 1, 3, '#f0d0c0');
    K.E(16, 3.2, 1.7, 1.7, { b: c.trimLite, s: c.trim, h: '#ffffff' });
  }
  _outline(s, _OUT);
  return s.c;
}function drawArmorHi(it) { // 어깨 뒤로 살짝 보이는 천 자락 / 목 스카프
  const s = _mk(32 * HK, 32 * HK), K = _kit(s), c = _cute(it), cls = it.cls;
  if (cls === 'mage') {
    K.T(9, 21.5, 5, 28.5, 11, 27.5, c.main.b); K.T(23, 21.5, 27, 28.5, 21, 27.5, c.main.b);
    K.T(9, 21.5, 5, 28.5, 7, 26, c.main.s); K.T(23, 21.5, 27, 28.5, 25, 26, c.main.s);
    K.r(14, 50, 2, 2, c.trimLite); K.r(48, 50, 2, 2, c.trimLite); K.r(24, 44, 2, 2, c.trim); K.r(38, 44, 2, 2, c.trim);
  } else if (cls === 'ranged') {
    K.R(10, 22, 12, 1, c.trim); K.r(20, 45, 6, 3, c.trim);
    K.r(40, 46, 5, 11, c.trim); K.r(40, 50, 5, 2, c.trimDark); K.r(40, 54, 5, 2, c.trimDark);
  } else {
    K.T(9, 21.5, 5, 28.5, 11, 27.5, c.dark); K.T(23, 21.5, 27, 28.5, 21, 27.5, c.dark);
    K.T(9, 21.5, 5, 28.5, 7, 26, _mix(c.dark, '#000000', 0.2)); K.T(23, 21.5, 27, 28.5, 25, 26, _mix(c.dark, '#000000', 0.2));
    K.r(24, 44, 3, 3, c.trim); K.r(37, 44, 3, 3, c.trim);
  }
  _outline(s, _OUT);
  return s.c;
}
function drawRingHi(it) { // 방울 목걸이
  const s = _mk(32 * HK, 32 * HK), K = _kit(s), c = _cute(it);
  K.R(11, 22, 10, 1, c.trim);
  K.T(16, 22.4, 12, 20.4, 12, 24.2, c.trimLite); K.T(16, 22.4, 20, 20.4, 20, 24.2, c.trimLite);
  K.E(16, 25.4, 2.4, 2.6, _BELL); K.r(31, 50, 2, 1, '#8a5a10'); K.r(31, 48, 2, 1, _BELL.h); K.r(31, 52, 2, 1, '#8a5a10');
  _outline(s, _OUT);
  return s.c;
}

// ---------- 손에 드는 무기 (고해상도 48x48. 아이콘과 같은 색/장식) ----------
function drawWeaponHi(it) {
  const s = _mk(24 * HK, 24 * HK), K = _kit(s);
  const cls = it ? it.cls : 'melee', c = it ? _gear(it) : { main: _pal('#c9d1dc'), reg: '#e8b83a', trim: '#e8b83a', trimDark: '#b8861f' };
  if (cls === 'ranged') { // 활: 휘어진 몸체 + 시위 + 손잡이 + 화살
    for (let y = 6; y <= 41; y++) {
      const t = (y - 23.5) / 17.5, x = Math.round(35 - 12 * t * t);
      K.r(x, y, 2, 1, '#a8703a'); K.r(x + 2, y, 2, 1, '#7a4a22'); K.r(x - 1, y, 1, 1, '#c8905a');
    }
    K.r(18, 8, 1, 31, '#e8eef5');
    K.r(30, 20, 7, 6, c.reg); K.r(31, 21, 2, 2, c.trim); K.r(30, 25, 7, 1, _mix(c.reg, '#000000', 0.3));
    K.L(18, 23, 40, 23, 1, '#e8d8b0'); K.T(40, 20.4, 40, 25.6, 45, 23, '#e8eef5'); K.r(18, 21, 3, 1, '#ff8a6a'); K.r(18, 25, 3, 1, '#ff8a6a');
  } else if (cls === 'mage') { // 스태프: 막대 + 마디 + 보석 구슬
    K.L(8, 42, 36, 14, 3, '#7a4a22'); K.L(9, 41, 36, 13, 1, '#c8905a');
    K.L(14, 36, 17, 33, 4, c.trim);
    K.E(18.5, 6.5, 4.6, 4.6, _pal(c.reg));
    K.E(18.5, 6.5, 2.6, 2.6, { b: _mix(c.reg, '#ffffff', 0.4) });
    K.r(31, 9, 3, 3, '#ffffff'); K.r(44, 4, 1, 3, '#ffffff'); K.r(42, 5, 5, 1, '#ffffff'); K.r(30, 2, 1, 3, '#ffffff');
  } else { // 칼: 날 + 가운데 줄 + 가드 + 손잡이
    const lite = _mix('#f4f8ff', c.trim, 0.2), dark = _mix('#b8c4d6', c.trim, 0.2);
    K.L(15, 33, 41, 7, 5, dark); K.L(15, 33, 41, 7, 3, lite);
    K.T(40, 3, 46, 2, 43, 9, lite);
    K.L(18, 30, 38, 10, 1, '#ffffff');
    K.L(8, 40, 22, 28, 3, c.trim); K.L(9, 41, 21, 29, 1, c.trimDark);          // 가드
    K.L(10, 36, 4, 43, 4, '#8a5a2a'); K.L(11, 36, 5, 43, 1, '#b07a42');         // 손잡이
    K.E(2.3, 22.6, 1.6, 1.6, _pal(c.trim));
  }
  _outline(s, '#2a2030');
  return s.c;
}



