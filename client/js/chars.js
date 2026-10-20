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
// ---------- 전설 무기 10종: 각각 다른 모양 (48x48, 손에 드는 그림. 아이콘은 이것을 줄여서 사용) ----------
function drawLegendWeaponHi(name) {
  const s = _mk(24 * HK, 24 * HK), K = _kit(s);
  const e = (cx, cy, rx, ry, pal) => K.E(cx / 2, cy / 2, rx / 2, ry / 2, pal);                              // 48칸 기준 타원
  const t = (x1, y1, x2, y2, x3, y3, c) => K.T(x1 / 2, y1 / 2, x2 / 2, y2 / 2, x3 / 2, y3 / 2, c);        // 48칸 기준 삼각형
  const GOLD = '#f0c43a', GOLD_D = '#a87818', GOLD_L = '#fff0a0', GP = { b: GOLD, s: GOLD_D, h: GOLD_L };
  const blade = (lite, dark, mid) => { K.L(15, 33, 41, 7, 5, dark); K.L(15, 33, 41, 7, 3, lite); t(40, 3, 46, 2, 43, 9, lite); K.L(18, 30, 38, 10, 1, mid || '#ffffff'); };
  const guard = (c, d) => { K.L(8, 40, 22, 28, 3, c); K.L(9, 41, 21, 29, 1, d); };
  const grip = (c, l) => { K.L(10, 36, 4, 43, 4, c); K.L(11, 36, 5, 43, 1, l); };
  const spark = (x, y, c) => { K.r(x, y - 1, 1, 3, c); K.r(x - 1, y, 3, 1, c); };
  const bowX = (y, c0, k2, k4) => { const u = (y - 23.5) / 20.5; return Math.round(c0 - k2 * u * u + k4 * Math.pow(Math.abs(u), 5)); };
  switch (name) {
    case '엑스칼리버':      // 왕의 검: 푸른 빛 날, 황금 가드와 푸른 보석
      blade('#e6f2ff', '#9fb8dd', '#9ad8ff'); guard(GOLD, GOLD_D); K.L(7, 41, 23, 27, 1, GOLD_L);
      grip('#5a3a8a', '#8a62c0'); e(4, 45, 3, 3, GP); K.r(13, 33, 4, 4, '#4aa8ff'); K.r(14, 34, 2, 2, '#d8f0ff');
      spark(44, 11, '#ffffff'); spark(34, 18, '#bfe6ff'); break;
    case '청룡언월도':     // 긴 자루 끝의 초승달 모양 청룡 칼날과 붉은 술
      K.L(5, 44, 30, 19, 3, '#6a3a1a'); K.L(6, 43, 29, 19, 1, '#a8703a'); K.L(12, 37, 15, 34, 3, GOLD);
      t(29, 21, 38, 3, 46, 11, '#35c9a8'); t(29, 21, 46, 11, 40, 27, '#1f9a80'); t(38, 3, 42, 2, 46, 11, '#c8fff0');
      K.L(31, 20, 44, 12, 1, '#d8fff4'); K.r(40, 13, 2, 2, '#ffe066'); K.L(27, 23, 22, 31, 2, '#e8483a'); K.L(26, 25, 21, 33, 1, '#ff9a7a'); break;
    case '쿠사나기의 검':  // 삼종신기: 연둣빛 날, 둥근 황금 날밑, 붉은 끈 손잡이
      blade('#f2fff0', '#a8d8a0', '#6ad88a'); e(15, 34, 6, 6, { b: '#c8a040', s: '#8a6a20', h: GOLD_L }); e(15, 34, 2, 2, { b: '#2a2030' });
      grip('#8a2a2a', '#d85a5a'); K.r(6, 40, 3, 1, '#2a2030'); K.r(8, 38, 3, 1, '#2a2030'); e(4, 45, 3, 3, { b: '#7ae09a', s: '#3a9a5a', h: '#d8ffe0' });
      spark(42, 9, '#d8ffe0'); break;
    case '뚜언띠엔':       // 황금 거북이 돌려받은 검: 금빛 날과 거북 등껍질 날밑
      blade('#fff2b0', '#d8b040', '#ffffff'); e(15, 34, 7, 6, { b: '#3aa860', s: '#1f7a40', h: '#7ae09a' });
      K.r(10, 33, 11, 1, '#1f5a30'); K.r(15, 29, 1, 10, '#1f5a30'); K.r(12, 30, 1, 3, '#1f5a30'); K.r(18, 36, 1, 3, '#1f5a30');
      e(22, 29, 2.5, 2, { b: '#6ad080', s: '#3a9a5a' }); K.r(22, 28, 1, 1, '#241a1a'); e(7, 40, 2, 1.5, { b: '#6ad080', s: '#3a9a5a' });
      grip('#7a4a1a', '#b8842a'); e(4, 45, 3, 3, GP); spark(44, 11, GOLD_L); break;
    case '주몽의 활': {    // 각궁: 붉은 뿔 활, 뼈로 된 끝, 푸른 끈
      for (let y = 3; y <= 44; y++) { const x = bowX(y, 35, 14, 10), u = Math.abs((y - 23.5) / 20.5), end = u > 0.82;
        K.r(x, y, 2, 1, end ? '#e8dcc0' : '#8a3a22'); K.r(x + 2, y, 2, 1, end ? '#b8a888' : '#5a2418'); K.r(x - 1, y, 1, 1, end ? '#fff6e0' : '#c85a3a'); }
      K.L(bowX(3, 35, 14, 10), 3, bowX(44, 35, 14, 10), 44, 1, '#f0ead8');
      K.r(31, 19, 8, 9, '#2a5ab8'); K.r(32, 20, 2, 2, '#bfd8ff'); K.r(36, 24, 2, 2, '#bfd8ff'); K.r(31, 27, 8, 1, '#1a3a78');
      K.L(20, 23, 42, 23, 1, '#e8d8b0'); t(42, 20.5, 42, 25.5, 47, 23, '#e8eef5'); K.r(20, 21, 4, 1, '#ff6a5a'); K.r(20, 25, 4, 1, '#ff6a5a'); break; }
    case '로빈 후드의 장궁': {  // 긴 활: 곧고 긴 나무 활, 초록 깃과 금화
      for (let y = 1; y <= 46; y++) { const x = bowX(y, 34, 5, 0); K.r(x, y, 2, 1, '#b88a3a'); K.r(x + 2, y, 2, 1, '#7a5418'); K.r(x - 1, y, 1, 1, '#e0b060'); }
      K.L(bowX(1, 34, 5, 0), 1, bowX(46, 34, 5, 0), 46, 1, '#f0ead8');
      K.r(30, 19, 8, 9, '#2f9a4a'); K.r(31, 20, 2, 2, '#8ae09a'); e(34, 23, 2.5, 2.5, GP);
      K.L(19, 23, 42, 23, 1, '#e8d8b0'); t(42, 20.5, 42, 25.5, 47, 23, '#e8eef5'); K.r(19, 21, 5, 1, '#3ac85a'); K.r(19, 25, 5, 1, '#3ac85a'); K.r(21, 22, 3, 1, '#7ae89a'); break; }
    case '윌리엄 텔의 석궁': {  // 석궁: 나무 개머리판, 강철 활대, 빨간 사과 장식
      K.r(10, 22, 31, 5, '#7a4a22'); K.r(10, 22, 31, 1, '#b07a42'); K.r(10, 26, 31, 1, '#4a2a12'); K.r(24, 27, 3, 4, '#4a2a12');
      for (let y = 5; y <= 42; y++) { const u = (y - 23.5) / 18.5, x = 37 + Math.round(8 * u * u); K.r(x, y, 2, 1, '#b8c4d8'); K.r(x + 2, y, 1, 1, '#6a7890'); K.r(x - 1, y, 1, 1, '#f0f6ff'); }
      K.L(45, 5, 30, 24, 1, '#f0ead8'); K.L(45, 42, 30, 25, 1, '#f0ead8'); K.L(30, 24, 47, 24, 1, '#e8d8b0'); t(45, 21.5, 45, 26.5, 49, 24, '#e8eef5');
      e(10, 30, 3.5, 3.5, { b: '#e83a3a', s: '#a82020', h: '#ff9a8a' }); K.r(10, 25, 1, 2, '#5a3a1a'); K.r(11, 24, 3, 1, '#3ab84a'); break; }
    case '메를린의 지팡이': // 대마법사: 비틀린 나뭇가지 지팡이와 푸른 수정, 별빛
      K.L(8, 42, 33, 17, 3, '#6a4a2a'); K.L(9, 41, 33, 16, 1, '#a87a4a'); K.r(16, 34, 3, 2, '#4a3018'); K.r(23, 28, 3, 2, '#4a3018');
      K.L(29, 22, 31, 11, 2, '#6a4a2a'); K.L(33, 23, 45, 19, 2, '#6a4a2a'); K.L(30, 11, 33, 7, 2, '#6a4a2a');
      e(37, 13, 6, 6, { b: '#5ab8ff', s: '#2a6ad0', h: '#d8f0ff' }); K.r(35, 10, 2, 2, '#ffffff');
      spark(45, 5, '#ffffff'); spark(28, 4, '#bfe6ff'); spark(46, 24, '#bfe6ff'); break;
    case '서왕모의 복숭아 지팡이': // 불로장생: 황금 지팡이 끝의 복숭아
      K.L(8, 42, 33, 17, 3, '#c8905a'); K.L(9, 41, 33, 16, 1, '#f0c890'); K.L(26, 24, 29, 21, 3, GOLD); K.L(14, 37, 17, 34, 3, GOLD);
      e(37, 13, 6.5, 6.5, { b: '#ffa8b8', s: '#e8708a', h: '#ffe0e8' }); K.L(37, 8, 36, 18, 1, '#e8708a'); K.r(34, 9, 2, 2, '#fff0f4');
      t(38, 6, 46, 2, 43, 9, '#5ad068'); t(38, 6, 40, 0, 44, 5, '#3aa850'); spark(46, 18, '#ffe0e8'); spark(28, 6, GOLD_L); break;
    case '아누비스의 홀':  // 와스 홀: 검은 자칼 머리와 황금 목걸이
      K.L(8, 42, 33, 17, 3, '#2a2a3a'); K.L(9, 41, 33, 16, 1, '#5a5a78'); K.L(12, 38, 15, 35, 3, GOLD); K.L(22, 29, 25, 26, 3, GOLD);
      e(35, 15, 6, 5, { b: '#2e2e40', s: '#16161f', h: '#5a5a78' }); t(38, 11, 48, 16, 39, 18, '#2e2e40'); t(31, 11, 30, 1, 36, 9, '#2e2e40'); t(36, 10, 39, 0, 41, 9, '#2e2e40');
      t(32, 9, 31, 3, 35, 8, GOLD); K.r(38, 12, 2, 1, '#ffd23a'); K.r(47, 15, 1, 2, '#0a0a12'); e(32, 20, 5, 2, GP); break;
    default: K.L(15, 33, 41, 7, 5, '#b8c4d6'); K.L(15, 33, 41, 7, 3, '#f4f8ff');
  }
  _outline(s, '#2a2030');
  return s.c;
}

function drawWeaponHi(it) {
  const lw = it && typeof legendOf === 'function' && legendOf(it);
  if (lw) return drawLegendWeaponHi(lw.name);
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

// ---------- 영웅 그림 (64x64 도트 일러스트를 부위별로 나눠 칸 단위로 움직여서 만든 동작) ----------
// 동물마다 96x96 칸 그림: east=서 있는 모습, idle=대기 8장, walk=걷기 6장, attack=공격 3장(힘 모으기, 내지르기, 마무리). 여러 장은 가로로 이어 붙임
// 장비는 겉모습에 그려지지 않고, 무기는 앞쪽 손 위치(hand)나 먼 쪽 손 위치(far, 활)에 따로 얹음. HERO는 지금 그리는 동물의 설정을 가리킴
// walkHand/attackHand: 프레임마다 앞쪽 손이 움직인 만큼(게임 좌표)
const HERO_WALK_HAND = [[0, 0], [0.5, -0.5], [0.5, -0.5], [0, 0], [-0.5, -0.5], [-0.5, -0.5]], HERO_ATK_HAND = [[-1.5, -1], [2.5, -0.5], [1.5, 0]];
const _hero = (name, o) => Object.assign({ name, east: null, idleImg: null, walkImg: null, atkImg: null, ready: false, idle: [], walk: [], attack: [], hurt: null, base: null, feet: 85, walkHand: HERO_WALK_HAND, attackHand: HERO_ATK_HAND }, o, { cur: o.hand, farNow: o.far });
const HEROES = {
  cat: _hero('cat', { hand: [26, 29], far: [36.5, 30.5], staff: 0.25 }),
  dog: _hero('dog', { hand: [24, 29], far: [34, 30.5], staff: 0.25 }),
};
let HERO = HEROES.cat;
function heroLoad() {
  if (typeof Image === 'undefined') return;
  for (const k of Object.keys(HEROES)) {
    const H = HEROES[k]; if (H.east) continue;
    const files = [['east', '_east'], ['idleImg', '_idle'], ['walkImg', '_walk'], ['atkImg', '_attack']];
    let n = 0;
    const done = () => { if (++n === files.length) { H.ready = true; heroBuild(H); } };
    for (const [key, suf] of files) { H[key] = new Image(); H[key].onload = done; H[key].src = 'img/' + k + suf + '.png'; }
  }
}
function heroBuild(H) {
  const cut = (img, i) => { const c = _mk(96, 96); c.g.drawImage(img, i * 96, 0, 96, 96, 0, 0, 96, 96); return c.c; };
  H.base = cut(H.east, 0);
  for (let f = 0; f < 8; f++) H.idle.push(cut(H.idleImg, f));
  for (let f = 0; f < 6; f++) H.walk.push(cut(H.walkImg, f));
  for (let f = 0; f < 3; f++) H.attack.push(cut(H.atkImg, f));
  const h = _mk(96, 96); h.g.drawImage(H.base, 0, 0); h.g.globalCompositeOperation = 'source-atop'; h.g.fillStyle = 'rgba(255,60,60,0.5)'; h.g.fillRect(0, 0, 96, 96);
  H.hurt = h.c;
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('herochange'));   // 시작 화면 미리보기를 새 그림으로 다시 그리게 함
}
// 지금 상황에 맞는 프레임 (그림이 아직 로딩 중이면 null). swing: 공격 직후 1에서 0으로 줄어드는 값
function heroSprite(t, moving, hurt, animal, swing) {
  HERO = HEROES[animal || 'cat'] || HEROES.cat;
  if (!HERO.ready) return null;
  const at = (d) => { HERO.cur = [HERO.hand[0] + d[0], HERO.hand[1] + d[1]]; HERO.farNow = [HERO.far[0] + d[0] * 0.5, HERO.far[1]]; };
  at([0, 0]);
  if (hurt) return HERO.hurt;
  if (swing > 0.25) { const i = swing > 0.6 ? 1 : 2; at(HERO.attackHand[i]); return HERO.attack[i]; }   // 공격: 내지르기 → 마무리
  if (!moving) return HERO.idle[Math.floor(t * 5) % 8];
  const i = Math.floor(t * 9) % 6;   // 걷는 동안 손 위치가 프레임마다 달라서 무기도 따라감
  at(HERO.walkHand[i]);
  return HERO.walk[i];
}
heroLoad();
