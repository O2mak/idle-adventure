// 가까운 풍경 띠: AI 그림을 가로 512칸으로 줄이고 자홍 배경·바닥선을 지워 게임용 PNG로 저장
// 사용: node strip.mjs <그림 파일> <저장할 PNG> [가로 칸 수=512] [지울 칸 영역 x0,y0,x1,y1 ...]
import puppeteer from 'puppeteer-core';
import fs from 'fs';
const [, , file, dest, cols, ...erase] = process.argv;
const N = Number(cols || 512);
const ext = file.toLowerCase().endsWith('.webp') ? 'webp' : 'png';
const url = `data:image/${ext};base64,` + fs.readFileSync(file).toString('base64');
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage(); await page.setContent('<body></body>');
const r = await page.evaluate(async (url, N, erase) => {
  const img = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = url; });
  const W = img.width, H = img.height, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const D = g.getImageData(0, 0, W, H).data, at = (x, y) => { const o = (y * W + x) * 4; return [D[o], D[o + 1], D[o + 2]]; };
  const s = W / N, M = Math.round(H / s);
  const isBg = (p) => p[0] > 150 && p[2] > 150 && p[1] < Math.min(p[0], p[2]) * 0.62;
  const grid = [];
  for (let j = 0; j < M; j++) { const row = []; for (let i = 0; i < N; i++) {
    const bins = new Map(); let bgc = 0, tot = 0;
    for (let y = Math.floor(j * s + s * 0.2); y <= Math.min(H - 1, Math.floor((j + 1) * s - s * 0.2)); y++) for (let x = Math.floor(i * s + s * 0.2); x <= Math.min(W - 1, Math.floor((i + 1) * s - s * 0.2)); x++) {
      const p = at(x, y); tot++; if (isBg(p)) { bgc++; continue; } const k = (p[0] >> 3) << 10 | (p[1] >> 3) << 5 | (p[2] >> 3); const b = bins.get(k) || [0, 0, 0, 0]; b[0]++; b[1] += p[0]; b[2] += p[1]; b[3] += p[2]; bins.set(k, b); }
    if (bgc > tot * 0.5 || !bins.size) { row.push(null); continue; }
    let t = null; for (const b of bins.values()) if (!t || b[0] > t[0]) t = b;
    const col = [Math.round(t[1] / t[0]), Math.round(t[2] / t[0]), Math.round(t[3] / t[0])];
    const mg = col[1] < Math.min(col[0], col[2]) * 0.7 && Math.abs(col[0] - col[2]) < 60 && col[0] > 60;   // 자홍 배경이 섞인 테두리
    if (mg && col[0] + col[2] > 330) { row.push(null); continue; }
    row.push(mg ? [40, 26, 40] : col);
  } grid.push(row); }
  // 바닥선 지우기: 아래쪽에서 거의 한 줄 전체가 어두운 칸으로 찬 줄
  for (let j = M - 1; j >= M - 8; j--) { const row = grid[j]; const dark = row.filter((p) => p && p[0] + p[1] + p[2] < 200).length; if (dark > N * 0.5) grid[j] = row.map((p) => (p && p[0] + p[1] + p[2] < 200 ? null : p)); }
  // 바닥선 흔적: 아래 3줄에서 바로 위에 물체가 없는 칸은 지움
  for (let j = M - 1; j >= M - 3; j--) for (let i = 0; i < N; i++) if (grid[j][i] && !(grid[j - 2] && grid[j - 2][i]) && !(grid[j - 3] && grid[j - 3][i])) grid[j][i] = null;
  // 지정한 영역 지우기(워터마크 등) → 위 칸 색으로 메움
  for (const e of erase) { const [x0, y0, x1, y1] = e.split(',').map(Number); for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (grid[y] && grid[y][x]) { let k = y - 1; while (k >= 0 && k >= y0 - 6 && !(grid[k][x])) k--; const src = grid[Math.max(0, y0 - 1)][x] || grid[y][x - (x1 - x0 + 2)] || null; grid[y][x] = src; } }
  // 아래쪽 빈 줄 자르기 (물체가 바닥선에 서도록)
  let last = M - 1; while (last > 0 && grid[last].every((p) => !p)) last--;
  const out = grid.slice(0, last + 1), h = out.length;
  const o = document.createElement('canvas'); o.width = N; o.height = h; const og = o.getContext('2d'); const id = og.createImageData(N, h);
  out.forEach((row, y) => row.forEach((p, x) => { if (!p) return; const q = (y * N + x) * 4; id.data[q] = p[0]; id.data[q + 1] = p[1]; id.data[q + 2] = p[2]; id.data[q + 3] = 255; }));
  og.putImageData(id, 0, 0);
  const pv = document.createElement('canvas'); pv.width = N * 3; pv.height = h * 3; const pg = pv.getContext('2d'); pg.fillStyle = '#7a8aa0'; pg.fillRect(0, 0, pv.width, pv.height); pg.imageSmoothingEnabled = false; pg.drawImage(o, 0, 0, pv.width, pv.height);
  return { W, H, s, N, h, png: o.toDataURL(), prev: pv.toDataURL() };
}, url, N, erase);
await browser.close();
fs.writeFileSync(dest, Buffer.from(r.png.split(',')[1], 'base64'));
fs.writeFileSync(dest.replace(/\.png$/, '_preview.png'), Buffer.from(r.prev.split(',')[1], 'base64'));
console.log(`원본 ${r.W}x${r.H}, 칸 ${r.s.toFixed(2)}px → ${r.N}x${r.h}`);

