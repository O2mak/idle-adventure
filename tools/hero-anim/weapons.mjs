// AI가 만든 무기 표 그림(칸마다 무기 하나)을 잘라서 48x48 칸 무기 그림으로 만듦
// 사용: node weapons.mjs  → client/img/weapons/*.png 와 out/weapons_preview.png
import puppeteer from 'puppeteer-core';
import fs from 'fs';
const T = decodeURIComponent(new URL('.', import.meta.url).pathname).replace(/^\/(\w:)/, '$1');
const DEST = T + '../../client/img/weapons/';
fs.mkdirSync(DEST, { recursive: true }); fs.mkdirSync(T + 'out', { recursive: true });
// 표마다: 파일, 열, 줄, 칸 안쪽 여백(비율), 뽑을 칸 [열, 줄, 저장 이름, 손잡이 기준(bl=왼쪽 아래, c=가운데)]
const SHEETS = [
  { file: 'src/weapons_normal_src.webp', cols: 4, rows: 3, inset: 0.03, pick: [
    [0, 0, 'melee_0', 'bl'], [1, 0, 'melee_1', 'bl'], [2, 0, 'melee_2', 'bl'], [3, 0, 'melee_3', 'bl'],
    [0, 1, 'ranged_0', 'c'], [1, 1, 'ranged_1', 'c'], [2, 1, 'ranged_2', 'c'], [3, 1, 'ranged_3', 'c'],
    [0, 2, 'mage_0', 'bl'], [1, 2, 'mage_1', 'bl'], [2, 2, 'mage_2', 'bl'], [3, 2, 'mage_3', 'bl'] ] },
  { file: 'src/weapons_legend_src.webp', cols: 4, rows: 6, inset: 0.06, block: 4.2, pick: [
    [0, 0, 'legend_엑스칼리버', 'bl'], [1, 0, 'legend_청룡언월도', 'bl'], [2, 0, 'legend_쿠사나기의 검', 'bl'], [3, 0, 'legend_뚜언띠엔', 'bl'],
    [3, 2, 'legend_주몽의 활', 'c'], [0, 3, '로빈후드', 'c'], [1, 4, 'legend_윌리엄 텔의 석궁', 'c'],
    [2, 3, 'legend_메를린의 지팡이', 'bl'], [3, 3, 'legend_서왕모의 복숭아 지팡이', 'bl'], [3, 4, 'legend_아누비스의 홀', 'bl'] ] },
];
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage(); await page.setContent('<body></body>');
const all = [];
for (const sh of SHEETS) {
  const url = 'data:image/webp;base64,' + fs.readFileSync(T + sh.file).toString('base64');
  const res = await page.evaluate(async (url, sh) => {
    const img = await new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = url; });
    const W = img.width, H = img.height, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const D = g.getImageData(0, 0, W, H).data, px = (x, y) => { const o = (y * W + x) * 4; return [D[o], D[o + 1], D[o + 2]]; };
    const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
    const out = [];
    for (const [ci, ri, name, anchor] of sh.pick) {
      const cw = W / sh.cols, chh = H / sh.rows, ix = Math.round(cw * sh.inset), iy = Math.round(chh * sh.inset);
      const X0 = Math.round(ci * cw) + ix, Y0 = Math.round(ri * chh) + iy, X1 = Math.round((ci + 1) * cw) - ix, Y1 = Math.round((ri + 1) * chh) - iy, w = X1 - X0, h = Y1 - Y0;
      // 배경색: 칸 가장자리에서 가장 많이 나온 색
      const cnt = new Map(); for (let k = 0; k < w; k++) for (const y of [Y0, Y1 - 1]) { const p = px(X0 + k, y), key = p.map((v) => v >> 4).join(); cnt.set(key, (cnt.get(key) || 0) + 1); }
      for (let k = 0; k < h; k++) for (const x of [X0, X1 - 1]) { const p = px(x, Y0 + k), key = p.map((v) => v >> 4).join(); cnt.set(key, (cnt.get(key) || 0) + 1); }
      let bk = null, bn = 0; for (const [k, n] of cnt) if (n > bn) { bn = n; bk = k; }
      const bg = bk.split(',').map((v) => Number(v) * 16 + 8);
      // 빛 번짐: 배경색과 비슷하거나, 배경을 띤 채 밝아진(흰빛이 섞인) 색은 배경으로 봄
      const isBg = (p) => { if (dist(p, bg) < 110) return true; const v = [p[0] - bg[0], p[1] - bg[1], p[2] - bg[2]]; const magentaTint = p[0] > 150 && p[2] > 150 && p[1] < Math.min(p[0], p[2]) - 25; return magentaTint && Math.abs(p[0] - p[2]) < 90 && v[1] < 160; };
      const mask = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) mask[y * w + x] = isBg(px(X0 + x, Y0 + y)) ? 0 : 1;
      // 덩어리 나누기: 큰 덩어리만 남김 (빛 알갱이, 반짝이 제거)
      const lab = new Int32Array(w * h).fill(-1), sizes = [];
      for (let s = 0; s < w * h; s++) { if (!mask[s] || lab[s] >= 0) continue; const id = sizes.length; let n = 0; const st = [s]; lab[s] = id; while (st.length) { const q = st.pop(); n++; const qx = q % w, qy = (q / w) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = qx + dx, ny = qy + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue; const t = ny * w + nx; if (mask[t] && lab[t] < 0) { lab[t] = id; st.push(t); } } } sizes.push(n); }
      const big = Math.max(...sizes); const keep = new Set(sizes.map((n, i) => (n >= big * 0.06 ? i : -1)).filter((i) => i >= 0));
      let x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (let s = 0; s < w * h; s++) if (mask[s] && keep.has(lab[s])) { const x = s % w, y = (s / w) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } else mask[s] = 0;
      // 도트 칸 크기 추정: 가로 방향 색 경계가 가장 잘 맞는 간격 (2.5~9px)
      const ed = new Float32Array(w); for (let y = y0; y <= y1; y += 1) for (let x = x0 + 1; x <= x1; x++) if (mask[y * w + x] && mask[y * w + x - 1] && dist(px(X0 + x, Y0 + y), px(X0 + x - 1, Y0 + y)) > 50) ed[x]++;
      let best = 4, bv = -1; for (let s = 2.5; s <= 9; s += 0.05) { let top = 0; for (let o = 0; o < s; o += 0.5) { let v = 0, k = 0; for (let p = x0 + o; p <= x1; p += s, k++) { const i = Math.round(p); v += ed[i] || 0; } v /= Math.max(1, k); top = Math.max(top, v); } const v2 = top * Math.pow(s, 0.15); if (v2 > bv) { bv = v2; best = s; } }
      // 줄인 크기: 긴 쪽이 46칸을 넘으면 46칸에 맞춤
      if (sh.block) best = sh.block;
      let n = Math.round((x1 - x0 + 1) / best), m = Math.round((y1 - y0 + 1) / best);
      const fit = Math.min(1, 46 / Math.max(n, m)); n = Math.max(1, Math.round(n * fit)); m = Math.max(1, Math.round(m * fit));
      const sx = (x1 - x0 + 1) / n, sy = (y1 - y0 + 1) / m, cells = [];
      for (let j = 0; j < m; j++) { const row = []; for (let i = 0; i < n; i++) {
        const bins = new Map(); let solid = 0, tot = 0;
        for (let y = Math.floor(y0 + j * sy + sy * 0.2); y <= Math.floor(y0 + (j + 1) * sy - sy * 0.2); y++) for (let x = Math.floor(x0 + i * sx + sx * 0.2); x <= Math.floor(x0 + (i + 1) * sx - sx * 0.2); x++) { tot++; if (!mask[y * w + x]) continue; solid++; const p = px(X0 + x, Y0 + y), k = (p[0] >> 3) << 10 | (p[1] >> 3) << 5 | (p[2] >> 3); const b = bins.get(k) || [0, 0, 0, 0]; b[0]++; b[1] += p[0]; b[2] += p[1]; b[3] += p[2]; bins.set(k, b); }
        if (solid < tot * 0.45) { row.push(null); continue; }
        let tb = null; for (const b of bins.values()) if (!tb || b[0] > tb[0]) tb = b; const col = [Math.round(tb[1] / tb[0]), Math.round(tb[2] / tb[0]), Math.round(tb[3] / tb[0])];
        // 배경 자홍색이 섞인 테두리 칸: 어두우면 외곽선 색으로, 밝으면 버림
        const mg = col[1] < Math.min(col[0], col[2]) * 0.62 && Math.abs(col[0] - col[2]) < 50 && col[0] > 70;
        if (mg && col[0] + col[2] > 330) { row.push(null); continue; }
        row.push(mg ? [42, 24, 44] : col);
      } cells.push(row); }
      // 48x48 칸에 배치: 대각선 무기는 왼쪽 아래 기준, 활은 가운데
      const o = document.createElement('canvas'); o.width = 48; o.height = 48; const og = o.getContext('2d'); const id = og.createImageData(48, 48);
      const ox = anchor === 'bl' ? 1 : Math.round((48 - n) / 2), oy = anchor === 'bl' ? 47 - m : Math.round((48 - m) / 2);
      for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) { const p = cells[j][i]; if (!p) continue; const X = ox + i, Y = oy + j; if (X < 0 || Y < 0 || X > 47 || Y > 47) continue; const q = (Y * 48 + X) * 4; id.data[q] = p[0]; id.data[q + 1] = p[1]; id.data[q + 2] = p[2]; id.data[q + 3] = 255; }
      og.putImageData(id, 0, 0);
      out.push({ name, block: best.toFixed(2), size: n + 'x' + m, bg: bg.join(','), data: o.toDataURL() });
    }
    return out;
  }, url, sh);
  all.push(...res);
}
// 미리보기: 무기마다 6배 확대
const prev = await page.evaluate(async (all) => {
  const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = s; });
  const c = document.createElement('canvas'), col = 6, k = 5; c.width = col * 48 * k; c.height = Math.ceil(all.length / col) * (48 * k + 24); const g = c.getContext('2d'); g.fillStyle = '#56606f'; g.fillRect(0, 0, c.width, c.height); g.imageSmoothingEnabled = false;
  for (let i = 0; i < all.length; i++) { const im = await load(all[i].data), x = (i % col) * 48 * k, y = Math.floor(i / col) * (48 * k + 24); g.strokeStyle = '#3a4250'; g.strokeRect(x, y, 48 * k, 48 * k); g.drawImage(im, x, y, 48 * k, 48 * k); g.fillStyle = '#fff'; g.font = '16px sans-serif'; g.fillText(all[i].name, x + 4, y + 48 * k + 18); }
  return c.toDataURL();
}, all);
await browser.close();
for (const a of all) { if (!a.name.startsWith('로빈')) fs.writeFileSync(DEST + a.name + '.png', Buffer.from(a.data.split(',')[1], 'base64')); else fs.writeFileSync(DEST + 'legend_로빈 후드의 장궁.png', Buffer.from(a.data.split(',')[1], 'base64')); console.log(a.name, 'block', a.block, 'size', a.size, 'bg', a.bg); }
fs.writeFileSync(T + 'out/weapons_preview.png', Buffer.from(prev.split(',')[1], 'base64'));

