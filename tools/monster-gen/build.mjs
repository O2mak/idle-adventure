// 칸 격자(hero-anim/out/<이름>_grid.json)를 게임용 PNG로 만들면서, 한국 몬스터와 크기를 맞추도록 키움
// 사용: node build.mjs <지역 번호들(쉼표)>   결과: out/final/mon_<지역>_<0|1|boss>.png  (키운 배율을 출력)
// 일반은 높이 약 46칸, 보스는 약 86칸을 목표로, 그보다 작을 때만 키움 (배율 1.25 미만이면 그대로). 칸 하나가 고르게 늘어나는 최근접 방식
import fs from 'fs'; import zlib from 'zlib';
const T = decodeURIComponent(new URL('.', import.meta.url).pathname).replace(/^\/(\w:)/, '$1');
const NORMAL_H = 46, BOSS_H = 86;
const crc = (bb) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let x = 0xffffffff; for (const v of bb) x = t[(x ^ v) & 255] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
const ch = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
fs.mkdirSync(T + 'out/final', { recursive: true });
for (const region of process.argv[2].split(',')) for (const n of ['0', '1', 'boss']) {
  const name = `mon_${region}_${n}`, r = JSON.parse(fs.readFileSync(T + `../hero-anim/out/${name}_grid.json`, 'utf8'));
  const target = n === 'boss' ? BOSS_H : NORMAL_H;
  let s = target / r.m; if (s < 1.25) s = 1;
  const w = Math.round(r.n * s), h = Math.round(r.m * s), raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = r.grid[Math.min(r.m - 1, Math.floor((y + 0.5) / s))][Math.min(r.n - 1, Math.floor((x + 0.5) / s))], o = y * (w * 4 + 1) + 1 + x * 4;
    raw[o] = p[0]; raw[o + 1] = p[1]; raw[o + 2] = p[2]; raw[o + 3] = p[3] ? 255 : 0;
  }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  fs.writeFileSync(T + `out/final/${name}.png`, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ch('IHDR', ih), ch('IDAT', zlib.deflateSync(raw)), ch('IEND', Buffer.alloc(0))]));
  console.log(name, `${r.n}x${r.m} → ${w}x${h} (x${s.toFixed(2)})`);
}
