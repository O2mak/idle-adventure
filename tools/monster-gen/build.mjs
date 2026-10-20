// 칸 격자(hero-anim/out/<이름>_grid.json)를 게임용 PNG로 만들면서, 한국 몬스터와 크기를 맞추도록 키움
// 사용: node build.mjs <지역 번호들(쉼표)>   결과: out/final/mon_<지역>_<0|1|boss>.png  (키운 배율을 출력)
// 일반은 높이 약 46칸, 보스는 약 86칸을 목표로 키움(최근접, 1.25배 미만이면 그대로). 일반 64칸·보스 100칸을 넘으면 각각 56칸·90칸으로 줄임(겹친 칸 중 가장 많은 색)
import fs from 'fs'; import zlib from 'zlib';
const T = decodeURIComponent(new URL('.', import.meta.url).pathname).replace(/^\/(\w:)/, '$1');
const NORMAL_H = 46, BOSS_H = 86, NORMAL_MAX = 64, NORMAL_SHRINK = 56, BOSS_MAX = 100, BOSS_SHRINK = 90;
const crc = (bb) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let x = 0xffffffff; for (const v of bb) x = t[(x ^ v) & 255] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
const ch = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
// 줄일 때: 이 칸이 덮는 원래 칸들 중 가장 많은 색(투명이 절반 넘으면 투명)
function shrinkPx(r, x, y, s) {
  const x0 = Math.floor(x / s), x1 = Math.max(x0, Math.ceil((x + 1) / s) - 1), y0 = Math.floor(y / s), y1 = Math.max(y0, Math.ceil((y + 1) / s) - 1), cnt = new Map(); let tot = 0, op = 0;
  for (let yy = y0; yy <= Math.min(r.m - 1, y1); yy++) for (let xx = x0; xx <= Math.min(r.n - 1, x1); xx++) { const p = r.grid[yy][xx]; tot++; if (!p[3]) continue; op++; const k = p[0] + "," + p[1] + "," + p[2]; cnt.set(k, (cnt.get(k) || 0) + 1); }
  if (!tot || op * 2 < tot) return [0, 0, 0, 0];
  let best = null, bn = 0; for (const [k, n] of cnt) if (n > bn) { bn = n; best = k; }
  const c = best.split(",").map(Number); return [c[0], c[1], c[2], 1];
}
fs.mkdirSync(T + 'out/final', { recursive: true });
for (const region of process.argv[2].split(',')) for (const n of ['0', '1', 'boss']) {
  const name = `mon_${region}_${n}`, r = JSON.parse(fs.readFileSync(T + `../hero-anim/out/${name}_grid.json`, 'utf8'));
  const boss = n === 'boss', big = boss ? BOSS_MAX : NORMAL_MAX;
  const target = boss ? BOSS_H : NORMAL_H; let s = 1;
  if (r.m > big) s = (boss ? BOSS_SHRINK : NORMAL_SHRINK) / r.m; else if (r.m * 1.25 <= target) s = target / r.m;
  const w = Math.round(r.n * s), h = Math.round(r.m * s), raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = s < 1 ? shrinkPx(r, x, y, s) : r.grid[Math.min(r.m - 1, Math.floor((y + 0.5) / s))][Math.min(r.n - 1, Math.floor((x + 0.5) / s))], o = y * (w * 4 + 1) + 1 + x * 4;
    raw[o] = p[0]; raw[o + 1] = p[1]; raw[o + 2] = p[2]; raw[o + 3] = p[3] ? 255 : 0;
  }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  fs.writeFileSync(T + `out/final/${name}.png`, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ch('IHDR', ih), ch('IDAT', zlib.deflateSync(raw)), ch('IEND', Buffer.alloc(0))]));
  console.log(name, `${r.n}x${r.m} → ${w}x${h} (x${s.toFixed(2)})`);
}
