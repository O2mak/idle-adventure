// AI가 만든 "도트 느낌" 큰 그림에서 실제 칸 크기를 찾아 칸 격자로 줄이고, 단색 배경(자홍색)과 구석의 워터마크를 지움
// 사용: node grid.mjs <그림 파일> <이름> [칸 크기(생략하면 자동)]
// 결과: out/<이름>_grid.json (anim.mjs와 같은 형식), out/<이름>_cells.png (칸 그림 원본 크기)
import puppeteer from 'puppeteer-core';
import fs from 'fs';
const T = decodeURIComponent(new URL('.', import.meta.url).pathname).replace(/^\/(\w:)/, '$1');
const [, , file, name, forceCell] = process.argv;
const out = T + 'out/'; fs.mkdirSync(out, { recursive: true });
const ext = file.toLowerCase().endsWith('.webp') ? 'webp' : file.toLowerCase().endsWith('.jpg') ? 'jpeg' : 'png';
const url = `data:image/${ext};base64,` + fs.readFileSync(file).toString('base64');
const exe = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({ executablePath: exe, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setContent('<body></body>');
const r = await page.evaluate(async (url, forceCell) => {
  const img = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = url; });
  const W = img.width, H = img.height, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, W, H).data, at = (x, y) => { const o = (y * W + x) * 4; return [d[o], d[o + 1], d[o + 2]]; };
  const diff = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  // 칸 크기 찾기: 색이 크게 바뀌는 경계 위치들이 가장 잘 맞아떨어지는 간격과 시작점
  const edgesX = new Float32Array(W), edgesY = new Float32Array(H);
  for (let y = 0; y < H; y += 2) for (let x = 1; x < W; x++) if (diff(at(x, y), at(x - 1, y)) > 60) edgesX[x]++;
  for (let x = 0; x < W; x += 2) for (let y = 1; y < H; y++) if (diff(at(x, y), at(x, y - 1)) > 60) edgesY[y]++;
  const score = (E, n, s) => { let best = [0, 0]; for (let o = 0; o < s; o += 0.25) { let v = 0, k = 0; for (let p = o; p < n; p += s, k++) { const i = Math.round(p); v += (E[i] || 0) + 0.5 * ((E[i - 1] || 0) + (E[i + 1] || 0)); } v /= Math.max(1, k); if (v > best[0]) best = [v, o]; } return best; };
  let bestCell = forceCell ? Number(forceCell) : 0, bestV = -1, cand = [];
  if (!bestCell) for (let s = 6; s <= 24; s += 0.125) { const v = score(edgesX, W, s)[0] + score(edgesY, H, s)[0]; cand.push([s, v]); if (v > bestV) { bestV = v; bestCell = s; } }
  const ox = score(edgesX, W, bestCell)[1], oy = score(edgesY, H, bestCell)[1];
  const n = Math.floor((W - ox) / bestCell), m = Math.floor((H - oy) / bestCell);
  // 각 칸의 대표 색: 칸 가운데 영역에서 가장 많이 나온 색(비슷한 색끼리 묶음)
  const grid = [];
  for (let j = 0; j < m; j++) { const row = []; for (let i = 0; i < n; i++) {
    const x0 = Math.round(ox + i * bestCell + bestCell * 0.25), x1 = Math.round(ox + (i + 1) * bestCell - bestCell * 0.25), y0 = Math.round(oy + j * bestCell + bestCell * 0.25), y1 = Math.round(oy + (j + 1) * bestCell - bestCell * 0.25);
    const bins = new Map();
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const p = at(Math.min(W - 1, x), Math.min(H - 1, y)), k = (p[0] >> 3) << 10 | (p[1] >> 3) << 5 | (p[2] >> 3); const b = bins.get(k) || [0, 0, 0, 0]; b[0]++; b[1] += p[0]; b[2] += p[1]; b[3] += p[2]; bins.set(k, b); }
    let top = null; for (const b of bins.values()) if (!top || b[0] > top[0]) top = b;
    row.push([Math.round(top[1] / top[0]), Math.round(top[2] / top[0]), Math.round(top[3] / top[0]), 255]);
  } grid.push(row); }
  cand.sort((a, b) => b[1] - a[1]);
  return { W, H, cell: bestCell, ox, oy, n, m, grid, top: cand.slice(0, 5) };
}, url, forceCell);
await browser.close();
// 배경 지우기: 자홍색 계열(빨강·파랑 높고 초록 낮음)과, 그와 이어진 밝은 분홍(워터마크)
const isBg = (p) => p[0] > 170 && p[2] > 170 && p[1] < 120;
const isPale = (p) => p[0] > 200 && p[2] > 200 && p[1] > 120;
const G = r.grid, n = r.n, m = r.m;
for (const row of G) for (const p of row) if (isBg(p)) p[3] = 0;
// 오른쪽 아래 구석의 밝은 반짝이(워터마크): 배경에 둘러싸인 밝은 분홍 칸 지우기
for (let j = Math.floor(m * 0.75); j < m; j++) for (let i = Math.floor(n * 0.75); i < n; i++) if (G[j][i][3] && isPale(G[j][i])) G[j][i][3] = 0;
// 외톨이 칸(주변이 모두 투명) 지우기
for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) { if (!G[j][i][3]) continue; let k = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = G[j + dy] && G[j + dy][i + dx]; if (q && q[3]) k++; } if (!k) G[j][i][3] = 0; }
// 그림이 있는 범위만 남기기
let x0 = n, y0 = m, x1 = -1, y1 = -1;
for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) if (G[j][i][3]) { x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, j); y1 = Math.max(y1, j); }
const crop = G.slice(y0, y1 + 1).map((row) => row.slice(x0, x1 + 1));
fs.writeFileSync(out + name + '_grid.json', JSON.stringify({ cell: r.cell, n: crop[0].length, m: crop.length, grid: crop }));
console.log(`${name}: 원본 ${r.W}x${r.H}, 칸 크기 ${r.cell}px (시작 ${r.ox},${r.oy}) → 격자 ${r.n}x${r.m}, 그림 범위 ${crop[0].length}x${crop.length}`);
console.log('칸 크기 후보:', r.top.map(([s, v]) => s + '(' + v.toFixed(1) + ')').join(' '));
