// 무한 모드 화면 확인용: 서버 응답을 흉내 내서(가짜 순위표) 결과 카드와 무한 탭을 사진으로 저장
// 사용: node endless.mjs   결과: out/endless_*.png
import fs from 'fs'; import http from 'http'; import path from 'path';
const T = decodeURIComponent(new URL('.', import.meta.url).pathname).replace(/^\/(\w:)/, '$1');
const puppeteer = (await import('file:///' + T + '../hero-anim/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).default;
const root = path.resolve(T, '../../client'), mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html')); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' }); r.end(d); } }); }).listen(8124);
fs.mkdirSync(T + 'out', { recursive: true });
const now = Date.now(), season = { name: '시즌 3', endsAt: now + 20 * 86400e3, serverNow: now };
const names = ['gg', '고양이왕', 'Rokking', '도깨비', '나비', '코기', '밤하늘', '무한러', '초보자', '구름'];
const list = names.map((n, i) => ({ rank: i + 1, nickname: n === '나비' ? '시험' : n, floor: 30 - i * 2 - (i > 5 ? 1 : 0), reachedAt: now - i * 3600e3, me: n === '나비' }));
const mock = (url) => {
  if (url.endsWith('/api/me')) return { nickname: '시험', season, rolled: false, save: { animal: 'cat', name: '시험', level: 40, region: 5, round: 1, best: { region: 5, round: 1 }, endless: { best: 14, bestAt: now }, nameV: 2, gearPct: 1, lockFix: 1, animalLocked: true, lock: true } };
  if (url.endsWith('/api/save')) return { ok: true, rolled: false, season, today: null, endless: { best: 14, bestAt: now } };
  if (url.endsWith('/api/ranking')) return { season, total: 10, minFloor: 10, list, me: { rank: 5, total: 10, floor: 22, reachedAt: now - 4 * 3600e3 } };
  return {};
};
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage(); await page.setViewport({ width: 520, height: 1000 });
await page.setRequestInterception(true);
page.on('request', (req) => { const u = req.url(); if (u.includes('/api/')) req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(mock(u)) }); else req.continue(); });
page.on('pageerror', (e) => console.log('페이지 오류:', e.message));
await page.evaluateOnNewDocument(() => { try { localStorage.clear(); localStorage.setItem('idlegame_token', 'x'); } catch (e) {} });
await page.goto('http://localhost:8124/index.html'); await new Promise((r) => setTimeout(r, 2500));
console.log('토큰 키 확인:', await page.evaluate(() => typeof API !== 'undefined' && API.tokenKey));
await page.addStyleTag({ content: '.overlay { display: none !important; }' });   // 첫 접속 룰렛 창 가리기
await page.evaluate(() => { UI.tab = 'endless'; });
await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: T + 'out/endless_1_panel.png' });
// 무한 모드 시작 → 7층에서 쓰러짐
await page.evaluate(() => { startEndless(UI.rt); UI.rt.endless.floor = 7; failRound(UI.rt, '쓰러졌습니다!'); });
await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({ path: T + 'out/endless_2_result.png' });
await page.evaluate(() => { UI.showRewards = true; });
await new Promise((r) => setTimeout(r, 800));
await page.evaluate(() => { UI.result.closed = true; });
await page.setViewport({ width: 520, height: 1900 });
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: T + 'out/endless_3_rewards.png' });
await browser.close(); srv.close(); console.log('done');
