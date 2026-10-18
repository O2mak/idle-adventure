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

// ---------- 강아지 / 고양이 (서 있는 2.5등신 비율: 머리 + 몸통 + 팔다리 + 꼬리, 명암이 들어간 도트) ----------
// 64x64 칸 기준. 머리는 위쪽(중심 32,21), 몸통과 팔다리는 아래쪽. 오른손(화면 오른쪽)이 무기를 드는 자리 (약 48,44)
const HAT_DY = -9;   // 모자 그림을 예전 큰 머리 기준으로 그려 두었으므로 새 머리 위치로 올려서 얹음
function _pe(s, cx, cy, rx, ry, base, o) {   // 음영 있는 타원: 위쪽 왼쪽이 밝고 아래쪽 오른쪽이 어두움
  o = o || {};
  _ell(s, cx, cy, rx, ry, { b: base, s: o.s || _mix(base, '#3a1a0a', 0.28), h: o.h || _mix(base, '#ffffff', 0.34) });
}
function _eyeBig(s, cx, cy, mode, ink, glint) {   // 크고 반짝이는 눈 (open) / 웃는 눈 / 아픈 눈 / 감은 눈
  const r = (x, y, w, h, c) => _rect(s, x, y, w, h, c);
  if (mode === 'open') {
    r(cx - 2, cy - 4, 5, 9, ink); r(cx - 3, cy - 3, 7, 7, ink); r(cx - 4, cy - 1, 9, 3, ink);
    r(cx - 1, cy + 1, 3, 3, glint.iris);
    r(cx - 2, cy - 3, 2, 2, '#ffffff'); r(cx + 1, cy + 2, 1, 1, '#ffffff');
  } else if (mode === 'happy') {
    for (const [dx, dy] of [[-3, 1], [-2, 0], [-1, -1], [0, -1], [1, -1], [2, 0], [3, 1]]) r(cx + dx, cy + dy, 1, 2, ink);
  } else if (mode === 'hurt') {
    for (let i = -2; i <= 2; i++) { r(cx + i, cy + i, 2, 1, ink); r(cx + i, cy - i, 2, 1, ink); }
  } else { r(cx - 4, cy + 1, 9, 2, ink); r(cx - 5, cy, 1, 1, ink); r(cx + 5, cy, 1, 1, ink); }
}
function drawDogHi(e) {
  const s = _mk(32 * HK, 32 * HK), r = (x, y, w, h, c) => _rect(s, x, y, w, h, c), t = (a, b, c2, d, e2, f, col) => _tri(s, a, b, c2, d, e2, f, col);
  const FUR = '#F0A838', FUR_D = '#C8741E', WH = '#FFF8EC', WH_D = '#EAD8BC', PINK = '#F4A8C8', INK = '#2a1a1a';
  const tw = e.tail ? 2 : 0;
  // 짧고 복실한 꼬리
  _pe(s, 47 + tw, 52, 4.4, 4.4, FUR); _pe(s, 48 + tw, 50.6, 2.2, 2.2, WH);
  // 다리와 발 (짧은 코기 다리, 흰 양말)
  _pe(s, 26, 56, 4.4, 5, FUR); _pe(s, 38, 56, 4.4, 5, FUR);
  _pe(s, 25, 60, 5.4, 2.6, WH, { s: WH_D, h: '#ffffff' }); _pe(s, 39, 60, 5.4, 2.6, WH, { s: WH_D, h: '#ffffff' });
  // 몸통 + 흰 가슴/배
  _pe(s, 32, 46, 12, 10.5, FUR); _pe(s, 32, 48, 7.6, 8, WH, { s: WH_D, h: '#ffffff' });
  // 팔 (왼쪽은 내려뜨림, 오른쪽은 무기를 쥘 자리)
  _pe(s, 19, 46, 3.8, 6.4, FUR); _pe(s, 19, 51.4, 3.8, 2.8, WH, { s: WH_D, h: '#ffffff' });
  _pe(s, 45, 46, 3.8, 6.4, FUR); _pe(s, 46, 51.4, 3.8, 2.8, WH, { s: WH_D, h: '#ffffff' });
  // 쫑긋한 큰 귀
  t(12, 22, 12, 2, 25, 11, FUR); t(52, 22, 52, 2, 39, 11, FUR);
  t(15, 18, 14.4, 6, 23, 12, FUR_D); t(49, 18, 49.6, 6, 41, 12, FUR_D);
  t(16, 17, 16, 8, 22.4, 12.6, PINK); t(48, 17, 48, 8, 41.6, 12.6, PINK);
  // 얼굴: 주황 윗머리 + 흰 이마 줄무늬 + 흰 아랫 얼굴
  _pe(s, 32, 22, 20, 14.5, FUR);
  _pe(s, 32, 29.4, 16, 8, WH, { s: WH_D, h: '#ffffff' }); r(15, 24, 5, 5, WH); r(44, 24, 5, 5, WH);
  r(29.5, 9, 5, 10, WH); t(29.5, 18, 34.5, 18, 32, 25, WH); r(29.5, 9, 1, 9, WH_D);
  r(18, 14, 3, 2, '#FFD070'); r(43, 14, 3, 2, '#FFD070');
  _eyeBig(s, 23.5, 22.5, e.eyes, INK, { iris: '#6a3a1a' }); _eyeBig(s, 40.5, 22.5, e.eyes, INK, { iris: '#6a3a1a' });
  _pe(s, 32, 28.4, 3.8, 2.6, '#3a2a2a', { s: '#1a1010', h: '#7a6a6a' }); r(30.6, 27, 2, 1, '#c8c0c0');
  r(31, 31, 2, 2, INK); r(27.6, 33.2, 4, 1, INK); r(32.4, 33.2, 4, 1, INK);
  if (e.mouth) { _pe(s, 32, 35.6, 3.6, 2.8, '#c8283a', { s: '#8a1424', h: '#ff6a7a' }); r(29, 33, 6, 1, INK); }
  else { _pe(s, 32, 35, 2.2, 2, '#f0506a', { s: '#c02a44', h: '#ff9aaa' }); }
  _ell(s, 17, 29, 3, 1.8, { b: '#ffb8a8' }); _ell(s, 47, 29, 3, 1.8, { b: '#ffb8a8' });
  _outline(s, '#4a2a10');
  return s.c;
}
function drawCatHi(e) {
  const s = _mk(32 * HK, 32 * HK), r = (x, y, w, h, c) => _rect(s, x, y, w, h, c), t = (a, b, c2, d, e2, f, col) => _tri(s, a, b, c2, d, e2, f, col);
  const FUR = '#E8A050', FUR_D = '#B8682A', STR = '#9A4E1E', CREAM = '#FFE8C8', CREAM_D = '#E8C8A0', PINK = '#F08A96', INK = '#1e1418';
  const tw = e.tail ? 2 : 0;
  // 길고 가는 줄무늬 꼬리 (끝은 크림색)
  const tp = [[42, 54], [49, 55], [54, 50], [56, 43], [56 + tw, 37], [55 + tw, 31], [53 + tw, 26]];   // 꼬리 중심선: 촘촘히 이어 매끈하게 그림
  for (let i = 0; i < tp.length - 1; i++) for (let k = 0; k < 6; k++) {
    const u = k / 6, x = tp[i][0] + (tp[i + 1][0] - tp[i][0]) * u, y = tp[i][1] + (tp[i + 1][1] - tp[i][1]) * u, tip = i === tp.length - 2 && k > 2;
    _ell(s, x, y, 2.6, 2.6, { b: tip ? CREAM : FUR, s: tip ? CREAM_D : FUR_D, h: tip ? '#ffffff' : '#F8C888' });
    if (!tip && (i + k / 6) % 1.2 < 0.35 && i > 0) _rect(s, Math.round(x - 2), Math.round(y - 1), 5, 1, STR);
  }
  // 다리와 발
  _pe(s, 27, 56, 3.6, 5, FUR); _pe(s, 37, 56, 3.6, 5, FUR);
  _pe(s, 26, 60, 5, 2.6, CREAM, { s: CREAM_D, h: '#ffffff' }); _pe(s, 38, 60, 5, 2.6, CREAM, { s: CREAM_D, h: '#ffffff' });
  // 몸통 + 크림 배
  _pe(s, 32, 46, 11, 10.5, FUR); _pe(s, 32, 48, 6.6, 8, CREAM, { s: CREAM_D, h: '#ffffff' });
  r(21, 42, 3, 1, STR); r(40, 42, 3, 1, STR); r(21, 46, 3, 1, STR); r(40, 46, 3, 1, STR);
  // 팔
  _pe(s, 20, 46, 3.4, 6.4, FUR); _pe(s, 20, 51.4, 3.4, 2.8, CREAM, { s: CREAM_D, h: '#ffffff' });
  _pe(s, 44, 46, 3.4, 6.4, FUR); _pe(s, 45, 51.4, 3.4, 2.8, CREAM, { s: CREAM_D, h: '#ffffff' });
  // 큰 귀 (안쪽 분홍)
  t(12, 21, 13, 2, 26, 10, FUR); t(52, 21, 51, 2, 38, 10, FUR);
  t(14, 18, 14, 6, 23, 11, FUR_D); t(50, 18, 50, 6, 41, 11, FUR_D);
  t(15, 18, 15.4, 8, 22.6, 11.6, CREAM); t(49, 18, 48.6, 8, 41.4, 11.6, CREAM); t(16.6, 17.4, 17, 10, 21, 12, PINK); t(47.4, 17.4, 47, 10, 43, 12, PINK);
  // 얼굴 + 이마 줄무늬 + 볼 줄무늬
  _pe(s, 32, 22, 19.5, 14.5, FUR);
  t(26, 8, 28.6, 8, 27.3, 14, STR); t(30.4, 7, 33.6, 7, 32, 14, STR); t(35.4, 8, 38, 8, 36.7, 14, STR);
  r(12, 22, 5, 2, STR); r(13, 26, 4, 2, STR); r(47, 22, 5, 2, STR); r(47, 26, 4, 2, STR);
  _pe(s, 32, 29.6, 9, 6, CREAM, { s: CREAM_D, h: '#ffffff' });
  _eyeBig(s, 24, 22, e.eyes, INK, { iris: '#6a4a1a' }); _eyeBig(s, 40, 22, e.eyes, INK, { iris: '#6a4a1a' });
  t(29.6, 26, 34.4, 26, 32, 29.4, PINK);
  if (e.mouth) { _pe(s, 32, 34, 3, 2.4, '#8a2a35', { s: '#5a1424', h: '#c85a6a' }); r(28.6, 31, 3.4, 1, STR); r(32, 31, 3.4, 1, STR); }
  else { r(28.6, 31, 3, 1, STR); r(32.4, 31, 3, 1, STR); r(31, 29.4, 2, 2, '#b05a6a'); r(27.6, 30, 1, 1, STR); r(35.4, 30, 1, 1, STR); }
  _ell(s, 16, 29, 3, 1.8, { b: '#ffa89a' }); _ell(s, 48, 29, 3, 1.8, { b: '#ffa89a' });
  _outline(s, '#5a2c10');
  for (const [dy, d2] of [[-1, -1], [2, 0], [5, 1]]) { r(3, 27 + dy, 9, 1, '#fff0d8'); r(53, 27 + dy, 9, 1, '#fff0d8'); r(2, 27 + dy + d2, 2, 1, '#fff0d8'); r(61, 27 + dy + d2, 2, 1, '#fff0d8'); }   // 수염은 윤곽선 뒤에 가늘게
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



