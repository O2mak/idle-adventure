// out/final 의 몬스터 그림을 한 장에 모아 확대해서 사진으로 저장 (사용: node preview.mjs [배율])
import fs from 'fs';
const T = decodeURIComponent(new URL('.', import.meta.url).pathname).replace(/^\/(\w:)/, '$1');
const puppeteer = (await import('file:///' + T + '../hero-anim/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).default;
const S = Number(process.argv[2] || 4);
const files = fs.readdirSync(T + 'out/final').filter((f) => f.endsWith('.png')).sort();
const rows = {}; for (const f of files) (rows[f.split('_')[1]] ||= []).push(f);
const html = '<body style="margin:0;background:#5a8a5a">' + Object.entries(rows).map(([r, fs2]) => `<div style="display:flex;align-items:flex-end;gap:16px;padding:6px;border-bottom:1px solid #345">${fs2.map((f) => `<img style="image-rendering:pixelated;width:auto" src="data:image/png;base64,${fs.readFileSync(T + 'out/final/' + f).toString('base64')}" onload="this.style.width=this.naturalWidth*${S}+'px'">`).join('')}</div>`).join('') + '</body>';
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage(); await page.setViewport({ width: 1100, height: 800 });
await page.setContent(html); await new Promise((r) => setTimeout(r, 500));
await page.screenshot({ path: T + 'out/preview.png', fullPage: true }); await browser.close(); console.log('saved out/preview.png');
