// 나라별 랜드마크 배경 (코드로 그린 도트 실루엣). 256x72 타일 하나에 하나씩 그려서 멀리 지나가는 풍경으로 사용
// 먼 풍경 느낌이 나도록 하늘색 쪽으로 살짝 흐리게 섞어서 그림
function drawLandmark(s, kind, rg) {
  const F = (c) => _mix(c, rg.sky[1], 0.3), B = 72, cx = 150;
  const R = (x, y, w, h, c) => _rect(s, Math.round(x), Math.round(y), Math.round(w), Math.round(h), F(c));
  const T = (x1, y1, x2, y2, x3, y3, c) => _tri(s, x1, y1, x2, y2, x3, y3, F(c));
  const E = (x, y, rx, ry, c) => _ell(s, x, y, rx, ry, { b: F(c) });
  switch (kind) {
    case 'gyeongbok': { // 대한민국 · 경복궁 근정전
      R(cx - 44, B - 12, 88, 5, '#c4bcae'); R(cx - 38, B - 8, 76, 4, '#d6cfc2');
      R(cx - 32, B - 32, 64, 20, '#b8402c'); for (let x = cx - 30; x < cx + 30; x += 8) R(x, B - 32, 2, 20, '#8a2a1c'); R(cx - 6, B - 25, 12, 13, '#5a2a20');
      for (let i = 0; i < 8; i++) R(cx - 44 + i, B - 40 + i, 88 - i * 2, 1, '#38485a'); R(cx - 47, B - 41, 5, 2, '#38485a'); R(cx + 42, B - 41, 5, 2, '#38485a');
      R(cx - 24, B - 56, 48, 16, '#b8402c'); for (let x = cx - 22; x < cx + 22; x += 8) R(x, B - 56, 2, 16, '#8a2a1c');
      for (let i = 0; i < 9; i++) R(cx - 36 + i, B - 66 + i, 72 - i * 2, 1, '#38485a'); R(cx - 40, B - 67, 5, 2, '#38485a'); R(cx + 35, B - 67, 5, 2, '#38485a');
      R(cx - 16, B - 69, 32, 3, '#2a3848'); R(cx - 2, B - 73, 4, 4, '#2a3848');
      R(cx + 70, B - 56, 4, 50, '#8a96a6'); E(cx + 72, B - 58, 5, 3, '#8a96a6'); // 멀리 보이는 타워
      break;
    }
    case 'fuji': { // 일본 · 후지산과 도리이
      T(cx - 20, B - 66, cx - 86, B, cx + 46, B, '#6a86b4'); T(cx - 20, B - 66, cx - 38, B - 42, cx - 2, B - 42, '#ffffff');
      R(cx - 30, B - 46, 20, 3, '#ffffff');
      R(cx + 54, B - 30, 4, 30, '#d8402c'); R(cx + 74, B - 30, 4, 30, '#d8402c'); R(cx + 48, B - 34, 36, 5, '#2a2a2a'); R(cx + 52, B - 24, 28, 3, '#d8402c');
      break;
    }
    case 'greatwall': { // 중국 · 만리장성과 누각
      for (let i = 0; i < 9; i++) { const x = cx - 100 + i * 24, h = 14 + Math.round(Math.sin(i * 0.9) * 6); R(x, B - h - 8, 25, h, '#9a8a7a'); for (let m = 0; m < 25; m += 6) R(x + m, B - h - 11, 4, 3, '#9a8a7a'); }
      R(cx - 14, B - 46, 28, 30, '#a89888'); R(cx - 4, B - 38, 8, 12, '#4a3a30');
      for (let i = 0; i < 5; i++) R(cx - 22 + i * 2, B - 52 + i, 44 - i * 4, 1, '#b84a3a'); R(cx - 26, B - 53, 6, 2, '#b84a3a'); R(cx + 20, B - 53, 6, 2, '#b84a3a'); R(cx - 3, B - 58, 6, 6, '#b84a3a');
      break;
    }
    case 'taj': { // 인도 · 타지마할
      R(cx - 32, B - 8, 64, 8, '#e6e0d6'); R(cx - 24, B - 34, 48, 28, '#f2ece2'); R(cx - 6, B - 28, 12, 22, '#b8b0a4'); E(cx, B - 28, 6, 6, '#b8b0a4');
      E(cx, B - 44, 16, 16, '#f6f0e6'); R(cx - 1, B - 66, 2, 8, '#d8c060');
      for (const dx of [-42, 42]) { R(cx + dx - 3, B - 48, 6, 46, '#ebe4d8'); E(cx + dx, B - 49, 4, 4, '#f6f0e6'); R(cx + dx - 1, B - 56, 2, 5, '#d8c060'); }
      for (const dx of [-20, 20]) { E(cx + dx, B - 36, 5, 5, '#f6f0e6'); }
      break;
    }
    case 'pyramid': { // 이집트 · 피라미드
      T(cx - 10, B - 62, cx - 62, B, cx + 42, B, '#d9b36a'); T(cx - 10, B - 62, cx + 16, B, cx + 42, B, '#b8924a');
      T(cx + 50, B - 36, cx + 18, B, cx + 84, B, '#d2ac64'); T(cx + 50, B - 36, cx + 56, B, cx + 84, B, '#b08c48');
      T(cx - 78, B - 24, cx - 100, B, cx - 56, B, '#d2ac64');
      break;
    }
    case 'colosseum': { // 이탈리아 · 콜로세움
      R(cx - 56, B - 40, 112, 40, '#cdb08c');
      for (let tier = 0; tier < 3; tier++) for (let x = cx - 52; x < cx + 50; x += 9) E(x + 4, B - 33 + tier * 11, 3, 4, '#6a5440');
      R(cx - 56, B - 42, 112, 3, '#b89870'); R(cx - 56, B - 40, 14, 24, '#bfa27e'); R(cx + 42, B - 52, 14, 12, '#bfa27e');
      break;
    }
    case 'eiffel': { // 프랑스 · 에펠탑
      const c = '#5a5048';
      for (let y = 0; y < 66; y++) { const half = 3 + Math.pow((y) / 66, 1.7) * 30; R(cx - half, B - 70 + y, 3, 1, c); R(cx + half - 3, B - 70 + y, 3, 1, c); if (y % 11 === 5) R(cx - half, B - 70 + y, half * 2, 2, c); }
      R(cx - 30, B - 30, 60, 3, c); for (let a = 0; a < 20; a++) { R(cx - 22 + a * 2.2, B - 27 + Math.abs(a - 10), 2, 3, '#7a6e62'); }
      R(cx - 1, B - 80, 2, 12, c);
      break;
    }
    case 'bigben': { // 영국 · 빅벤과 국회의사당
      R(cx - 90, B - 20, 70, 20, '#b8a888'); for (let x = cx - 88; x < cx - 22; x += 6) R(x, B - 24, 3, 6, '#a89878');
      R(cx - 12, B - 62, 24, 62, '#c4b090'); R(cx - 12, B - 62, 4, 62, '#b09c7c');
      E(cx, B - 52, 8, 8, '#f4efe0'); R(cx - 1, B - 58, 2, 6, '#3a3a3a'); R(cx, B - 52, 4, 1, '#3a3a3a');
      T(cx, B - 86, cx - 13, B - 62, cx + 13, B - 62, '#6a7a8a'); R(cx - 1, B - 92, 2, 7, '#d8c060');
      break;
    }
    case 'liberty': { // 미국 · 자유의 여신상
      R(cx - 18, B - 18, 36, 18, '#b8b0a2'); R(cx - 12, B - 30, 24, 12, '#c8c0b2');
      T(cx, B - 56, cx - 11, B - 28, cx + 11, B - 28, '#6aa88c'); R(cx - 6, B - 56, 12, 28, '#6aa88c'); E(cx, B - 62, 5, 5, '#6aa88c');
      for (let i = -2; i <= 2; i++) T(cx + i * 3, B - 70, cx + i * 3 - 1, B - 64, cx + i * 3 + 1, B - 64, '#6aa88c');
      R(cx + 6, B - 72, 3, 16, '#6aa88c'); E(cx + 8, B - 76, 3, 4, '#f0d060'); R(cx - 14, B - 44, 4, 14, '#5a9078');
      break;
    }
    case 'cristo': { // 브라질 · 코르코바도 예수상
      T(cx, B - 40, cx - 70, B, cx + 70, B, '#4a8a58');
      R(cx - 5, B - 82, 10, 30, '#e8e6e0'); R(cx - 26, B - 76, 52, 5, '#e8e6e0'); E(cx, B - 86, 4, 4, '#e8e6e0'); R(cx - 8, B - 52, 16, 12, '#d8d6d0');
      break;
    }
  }
}
