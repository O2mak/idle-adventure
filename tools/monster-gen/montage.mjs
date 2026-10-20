// out/shot_*.png 에서 게임 장면(위쪽 큰 상자)만 잘라 한 장으로 모음 (사용: node montage.mjs <지역들> <라운드들> [번호])
import fs from 'fs';
const T = decodeURIComponent(new URL('.', import.meta.url).pathname).replace(/^\/(\w:)/, '$1');
const puppeteer = (await import('file:///' + T + '../hero-anim/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).default;
const rg = process.argv[2].split(','), rd = process.argv[3].split(','), n = process.argv[4] || '0';
const cells = []; for (const a of rg) for (const b of rd) { const f = T + `out/shot_${a}_${b}_${n}.png`; if (fs.existsSync(f)) cells.push(`<div style="width:520px;height:290px;overflow:hidden;position:relative"><img src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}" style="position:absolute;left:0;top:-45px"></div>`); }
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage(); await page.setViewport({ width: 1040, height: 300 });
await page.setContent(`<body style="margin:0;background:#000;display:grid;grid-template-columns:520px 520px">${cells.join('')}</body>`); await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: T + 'out/montage.png', fullPage: true }); await browser.close(); console.log('ok', cells.length);
