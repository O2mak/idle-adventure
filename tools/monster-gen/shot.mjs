// 게임을 시험(오프라인) 모드로 열어 지역별 몬스터 화면을 사진으로 저장
// 사용: node shot.mjs <지역 번호들(쉼표)> [라운드(기본 1,10)]   결과: out/shot_<지역>_<라운드>_<번호>.png
import fs from 'fs'; import http from 'http'; import path from 'path';
const T = decodeURIComponent(new URL('.', import.meta.url).pathname).replace(/^\/(\w:)/, '$1');
const puppeteer = (await import('file:///' + T + '../hero-anim/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).default;
const regions = (process.argv[2] || '2').split(',').map(Number), rounds = (process.argv[3] || '1,10').split(',').map(Number);
const root = path.resolve(T, '../../client'), mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html')); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' }); r.end(d); } }); }).listen(8123);
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox'] });
for (const rg of regions) for (const rd of rounds) {
  const page = await browser.newPage(); await page.setViewport({ width: 520, height: 900, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument((rg, rd) => { try { localStorage.clear(); localStorage.setItem('idlegame_save_v2', JSON.stringify({ animal: 'cat', name: '시험', region: rg, round: rd, best: { region: 10, round: 10 }, nameV: 2, animalLocked: true, lockFix: 1, lock: true, level: 60 })); } catch (e) {} }, rg, rd);
  await page.goto('http://localhost:8123/index.html?offline=1'); 
  for (let i = 0; i < 2; i++) { await new Promise((r) => setTimeout(r, i ? 2500 : 3500)); await page.screenshot({ path: T + `out/shot_${rg}_${rd}_${i}.png` }); }
  await page.close();
}
await browser.close(); srv.close(); console.log('done');
