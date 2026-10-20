// 자홍색 배경의 몬스터 시트(한 장에 3마리)에서 몬스터를 하나씩 잘라 냄
// 사용: node slice.mjs <시트 그림> <지역 번호> [cut:x1,y1,x2 | rects:영역들]
// rects: 몬스터마다 영역을 직접 지정. 몬스터는 ; 로, 한 몬스터의 여러 영역은 | 로, 영역은 x0,y0,x1,y1 (순서: 일반0;일반1;보스). 영역 밖(쓰지 않는 그림)은 버리고, 겹친 곳은 앞 몬스터가 가져감
// 마지막에 line 을 붙이면(예: rects:... line) 바닥에 그어진 긴 가로선(얇은 검은 줄)을 지움
// cut: 서로 붙은 두 몬스터를 나눌 때 씀. (x < x1) 이거나 (x < x2 이고 y > y1)인 부분은 따로 떨어진 덩어리로 봄
// 결과: out/mon_<지역>_0.png, _1.png(일반 2종, 왼쪽 위부터), out/mon_<지역>_boss.png(가장 큰 것). 배경은 #FF00FF로 통일
// (이어서 tools/hero-anim/grid.mjs 로 칸 크기를 찾아 줄임)
import fs from 'fs';
const T = decodeURIComponent(new URL('.', import.meta.url).pathname).replace(/^\/(\w:)/, '$1');
const puppeteer = (await import('file:///' + T + '../hero-anim/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).default;
const [, , file, region, extra, lineArg] = process.argv;
const delLine = lineArg === "line" || extra === "line";
const cut = extra && extra.startsWith("cut:") ? extra.slice(4).split(",").map(Number) : null;
const rects = extra && extra.startsWith("rects:") ? extra.slice(6).split(";").map((m) => m.split("|").map((r) => r.split(",").map(Number))) : null;
const ext = file.toLowerCase().endsWith('.webp') ? 'webp' : file.toLowerCase().endsWith('.jpg') ? 'jpeg' : 'png';
const url = `data:image/${ext};base64,` + fs.readFileSync(file).toString('base64');
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setContent('<body></body>');
const res = await page.evaluate(async (url, cut, rects, delLine) => {
  const img = await new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = url; });
  const W = img.width, H = img.height, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const id = g.getImageData(0, 0, W, H), d = id.data;
  // 배경(자홍색 계열) 표시: 빨강·파랑이 높고 초록이 낮음
  const bg = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) { const r = d[i * 4], gg = d[i * 4 + 1], b = d[i * 4 + 2]; bg[i] = r > 170 && b > 170 && gg < 130 && Math.abs(r - b) < 90 ? 1 : 0; }
  // 바닥선 지우기: 어두운 칸이 가로로 길게 이어진 얇은 줄(14줄 이하)
  if (delLine) { const dark = (i) => d[i * 4] < 80 && d[i * 4 + 1] < 80 && d[i * 4 + 2] < 80, rows = [];
    for (let y = 0; y < H; y++) { let n = 0; for (let x = 0; x < W; x++) if (dark(y * W + x) && !bg[y * W + x]) n++; rows.push(y > H * 0.7 && n > W * 0.5); }
    for (let y = 0; y < H;) { if (!rows[y]) { y++; continue; } let e = y; while (e < H && rows[e]) e++;
      if (e - y <= 14) for (let yy = y; yy < e; yy++) for (let x = 0; x < W; x++) if (dark(yy * W + x)) bg[yy * W + x] = 1;
      y = e; } }
  // 영역 지정: 어느 몬스터 영역인지 표시, 영역 밖은 배경 취급
  const ownerMap = new Uint8Array(W * H);
  if (rects) { rects.forEach((list, i) => { for (const [a, b, c2, e] of list) for (let y = Math.max(0, b); y <= Math.min(H - 1, e); y++) for (let x = Math.max(0, a); x <= Math.min(W - 1, c2); x++) if (!ownerMap[y * W + x]) ownerMap[y * W + x] = i + 1; });
    for (let i = 0; i < W * H; i++) if (!ownerMap[i]) bg[i] = 1; }
  // 몬스터 덩어리 찾기 (4칸 안의 이웃은 한 덩어리)
  const own = (q) => rects ? ownerMap[q] : (cut && ((q % W) < cut[0] || ((q % W) < cut[2] && ((q / W) | 0) > cut[1])) ? 1 : 0);
  const R = 4, lab = new Int32Array(W * H).fill(-1), comps = [];
  for (let s = 0; s < W * H; s++) {
    if (bg[s] || lab[s] >= 0) continue;
    const id2 = comps.length, st = [s]; lab[s] = id2; let x0 = W, x1 = 0, y0 = H, y1 = 0, area = 0;
    while (st.length) {
      const q = st.pop(), x = q % W, y = (q / W) | 0; area++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (let dy = -R; dy <= R; dy += 1) for (let dx = -R; dx <= R; dx += 1) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const t = ny * W + nx; if (!bg[t] && lab[t] < 0 && own(t) === own(s)) { lab[t] = id2; st.push(t); }
      }
    }
    comps.push({ id: id2, x0, x1, y0, y1, area, ow: ownerMap[s] });
  }
  const big = rects ? rects.map((_, i) => comps.filter((k) => k.ow === i + 1).sort((a, b) => b.area - a.area)[0]) : comps.filter((k) => k.area > 3000).sort((a, b) => b.area - a.area);
  const out = [];
  for (const k of big) {
    const m = 6, x0 = Math.max(0, k.x0 - m), y0 = Math.max(0, k.y0 - m), x1 = Math.min(W - 1, k.x1 + m), y1 = Math.min(H - 1, k.y1 + m);
    const w = x1 - x0 + 1, h = y1 - y0 + 1, oc = document.createElement('canvas'); oc.width = w; oc.height = h;
    const og = oc.getContext('2d'), od = og.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const si = (y + y0) * W + (x + x0), o = (y * w + x) * 4;
      if (lab[si] === k.id) { od.data[o] = d[si * 4]; od.data[o + 1] = d[si * 4 + 1]; od.data[o + 2] = d[si * 4 + 2]; }
      else { od.data[o] = 255; od.data[o + 1] = 0; od.data[o + 2] = 255; }
      od.data[o + 3] = 255;
    }
    og.putImageData(od, 0, 0);
    out.push({ x: k.x0, y: k.y0, w: k.x1 - k.x0 + 1, h: k.y1 - k.y0 + 1, area: k.area, png: oc.toDataURL('image/png') });
  }
  return { W, H, out };
}, url, cut, rects, delLine);
await browser.close();
fs.mkdirSync(T + 'out', { recursive: true });
// 가장 큰 것 = 보스, 나머지 둘은 왼쪽(같으면 위) 순서
const boss = rects ? res.out[2] : res.out[0], norm = rects ? res.out.slice(0, 2) : res.out.slice(1, 3).sort((a, b) => (a.x + a.w / 2) - (b.x + b.w / 2));
const save = (o, n) => { fs.writeFileSync(T + `out/mon_${region}_${n}.png`, Buffer.from(o.png.split(',')[1], 'base64')); console.log(n, `위치 ${o.x},${o.y} 크기 ${o.w}x${o.h}`); };
console.log('시트', res.W + 'x' + res.H, '덩어리', res.out.length, '개(작은 것 제외)');
save(norm[0], '0'); save(norm[1], '1'); save(boss, 'boss');
