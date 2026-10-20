// 받은 그림을 격자(칸)로 읽어서 JSON과 좌표 눈금 확대본으로 저장
import puppeteer from 'puppeteer-core';
import fs from 'fs';
const T = decodeURIComponent(new URL('.', import.meta.url).pathname).replace(/^\/(\w:)/, '$1');
const out = T + 'out/'; fs.mkdirSync(out, { recursive: true });
const src = { cat: T + 'src/cat_src.png', dog: T + 'src/dog_src.png' };
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage(); await page.setViewport({ width: 1100, height: 1100 });
await page.setContent('<body style="margin:0;background:#567"></body>');
for (const [k, f] of Object.entries(src)) {
  const url = 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
  const r = await page.evaluate(async (url) => {
    const img = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = url; });
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, img.width, img.height).data;
    // 칸 크기 찾기: 가로 방향으로 색이 바뀌는 위치 간격의 최대공약수
    const gcd = (a, b) => (b ? gcd(b, a % b) : a); let cell = 0;
    for (let y = 0; y < img.height; y += 7) { let prev = -1, run = 0; for (let x = 0; x < img.width; x++) { const o = (y * img.width + x) * 4, v = (d[o] << 24) ^ (d[o + 1] << 16) ^ (d[o + 2] << 8) ^ d[o + 3]; if (v !== prev && prev !== -1) { cell = gcd(cell, run); run = 0; } prev = v; run++; } }
    if (!cell) cell = 1;
    const n = img.width / cell, m = img.height / cell, grid = [];
    for (let y = 0; y < m; y++) { const row = []; for (let x = 0; x < n; x++) { const o = ((y * cell + (cell >> 1)) * img.width + x * cell + (cell >> 1)) * 4; row.push([d[o], d[o + 1], d[o + 2], d[o + 3]]); } grid.push(row); }
    return { cell, n, m, grid };
  }, url);
  // 배경색(가장자리 색)은 투명으로
  const bg = r.grid[0][0];
  const same = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 12;
  for (const row of r.grid) for (const px of row) if (px[3] < 20 || (bg[3] > 200 && same(px, bg))) px[3] = 0;
  fs.writeFileSync(out + k + '_grid.json', JSON.stringify(r));
  console.log(k, 'cell', r.cell, 'grid', r.n + 'x' + r.m, 'bg', bg.join(','));
}
await browser.close();

