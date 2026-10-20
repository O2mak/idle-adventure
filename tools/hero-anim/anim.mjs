// 64x64 도트 그림을 부위별로 나눠 칸 단위로 옮겨서 대기/걷기/공격 프레임을 만듦 (96x96 칸에 배치)
// 사용: node anim.mjs <cat|dog>
import fs from 'fs'; import zlib from 'zlib';
const K = process.argv[2] || 'cat';
const T = decodeURIComponent(new URL('.', import.meta.url).pathname).replace(/^\/(\w:)/, '$1');
const dir = T + 'out/';
const src = JSON.parse(fs.readFileSync(dir + K + '_grid.json', 'utf8')).grid.map((row) => row.map((p) => (p[3] > 128 && !(Math.abs(p[0] - 88) + Math.abs(p[1] - 104) + Math.abs(p[2] - 124) < 10) ? [p[0], p[1], p[2]] : null)));
const N = 64, OX = 16, OY = 21, FW = 96;
const red = (p) => p && p[0] > 140 && p[1] < 90 && p[2] < 100;
const blue = (p) => p && p[2] > p[0] + 25;
const silver = (p) => p && p[0] > 120 && p[2] >= p[0] && Math.abs(p[0] - p[1]) < 30;
const brownGreen = (p) => p && ((p[0] > 110 && p[1] > 50 && p[1] < 120 && p[2] < 80) || (p[1] > p[2] + 20 && p[0] > 80 && p[0] < 190));
// 부위 나누기 (64칸 좌표). 먼저 맞는 부위가 그 칸을 가짐
const PARTS = {
  cat: [
    ['head', (x, y) => y <= 22 && x >= 26],
    ['scarf', (x, y, p) => red(p) && x <= 27 && y <= 30],
    ['tail', (x, y, p) => (x <= 21 && y >= 25 && y <= 51) || (x >= 22 && x <= 27 && y >= 43 && y <= 50 && !brownGreen(p))],
    ['farArm', (x, y) => x >= 50 && y >= 32 && y <= 44],
    ['nearArm', (x, y, p) => x >= 33 && x <= 40 && y >= 33 && y <= 41 && !brownGreen(p)],
    ['farLeg', (x, y) => y >= 54 && x <= 36],
    ['nearLeg', (x, y) => y >= 54 && x >= 37],
    ['torso', () => true],
  ],
  dog: [
    ['head', (x, y) => y <= 22 && x >= 26],
    ['tail', (x, y, p) => (x <= 16 && y >= 31 && y <= 51 && !blue(p)) || (x >= 17 && x <= 24 && y >= 32 && y <= 48 && !blue(p))],
    ['cape', (x, y, p) => x <= 22 && y >= 46],
    ['farArm', (x, y) => x >= 48 && y >= 34 && y <= 44],
    ['nearArm', (x, y, p) => x >= 29 && x <= 36 && y >= 34 && y <= 41 && !silver(p) && !blue(p)],
    ['farLeg', (x, y) => y >= 56 && x <= 33],
    ['nearLeg', (x, y) => y >= 56 && x >= 34],
    ['torso', () => true],
  ],
}[K];
const partOf = Array.from({ length: N }, (_, y) => Array.from({ length: N }, (_, x) => { const p = src[y][x]; if (!p) return null; for (const [n, f] of PARTS) if (f(x, y, p)) return n; return 'torso'; }));
// 그리는 순서(뒤 → 앞)와, 1칸 움직일 때 원래 자리를 밑에 깔아 구멍을 막는 부위
const ORDER = ['tail', 'cape', 'farLeg', 'scarf', 'torso', 'nearLeg', 'farArm', 'head', 'nearArm'];
const SOLID = new Set(['torso', 'head']);
function frame(off) {
  const g = Array.from({ length: FW }, () => Array(FW).fill(null));
  const put = (name, dx, dy) => { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (partOf[y][x] === name) { const X = x + OX + dx, Y = y + OY + dy; if (X >= 0 && Y >= 0 && X < FW && Y < FW) g[Y][X] = src[y][x]; } };
  for (const n of ORDER) { const [dx, dy] = off[n] || [0, 0]; if (SOLID.has(n) && (dx || dy) && Math.abs(dx) + Math.abs(dy) <= 2) put(n, 0, 0); put(n, dx, dy); }
  return g;
}
const add = (a, b) => [(a ? a[0] : 0) + (b ? b[0] : 0), (a ? a[1] : 0) + (b ? b[1] : 0)];
const upper = ['head', 'torso', 'nearArm', 'farArm', 'tail', 'scarf', 'cape'];
function pose({ bob = 0, lean = 0, far = [0, 0], near = [0, 0], tail = [0, 0], scarf = [0, 0], nearArm = [0, 0], farArm = [0, 0], head = [0, 0] }) {
  const o = {}; for (const n of upper) o[n] = [lean, bob];
  o.farLeg = far; o.nearLeg = near;
  o.tail = add(o.tail, tail); o.scarf = add(o.scarf, scarf); o.cape = add(o.cape, scarf);
  o.nearArm = add(o.nearArm, nearArm); o.farArm = add(o.farArm, farArm); o.head = add(o.head, head);
  return o;
}
const frames = { idle: [], walk: [], attack: [] }, hands = { idle: [], walk: [], attack: [] };
for (let f = 0; f < 8; f++) { // 대기: 숨쉬기 + 꼬리/스카프 흔들림
  const ph = f / 8 * Math.PI * 2, b = (Math.sin(ph) + 1) / 2;
  const o = pose({ bob: b > 0.55 ? -1 : 0, head: [0, b > 0.85 ? -1 : 0], tail: [0, Math.round(Math.sin(ph + 1))], scarf: [0, Math.round(Math.sin(ph * 2) * 0.8)] });
  frames.idle.push(frame(o)); hands.idle.push(o.nearArm);
}
for (let f = 0; f < 6; f++) { // 걷기: 다리 번갈아 앞뒤, 몸 들썩, 팔 흔들기, 꼬리/스카프 펄럭임
  const ph = f / 6 * Math.PI * 2, s = Math.sin(ph), c = Math.cos(ph);
  const o = pose({ bob: Math.abs(s) > 0.8 ? -1 : 0, far: [Math.round(-2.5 * s), -Math.max(0, Math.round(2 * c))], near: [Math.round(2.5 * s), -Math.max(0, Math.round(-2 * c))], tail: [0, Math.round(1.4 * Math.sin(ph + 1))], scarf: [Math.round(Math.sin(ph * 2)), Math.round(Math.cos(ph * 2))], nearArm: [Math.round(1.4 * s), 0], farArm: [0, Math.round(-1.2 * s)] });
  frames.walk.push(frame(o)); hands.walk.push(o.nearArm);
}
// 공격: 0=힘 모으기(뒤로), 1=내지르기(앞으로 크게), 2=마무리
const atk = [
  pose({ lean: -1, nearArm: [-2, -2], farArm: [-1, -1], tail: [0, -1], scarf: [-1, 1] }),
  pose({ lean: 2, near: [1, 0], nearArm: [3, -1], farArm: [3, 0], head: [1, 0], scarf: [-1, -1], tail: [-1, 1] }),
  pose({ lean: 1, nearArm: [2, 0], farArm: [1, 0], scarf: [0, -1] }),
];
for (const o of atk) { frames.attack.push(frame(o)); hands.attack.push(o.nearArm); }

function png(w, h, rgba) {
  const crc = (bb) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let r = 0xffffffff; for (const x of bb) r = t[(r ^ x) & 255] ^ (r >>> 8); return (r ^ 0xffffffff) >>> 0; };
  const ch = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const raw = Buffer.alloc((w * 4 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ch('IHDR', ih), ch('IDAT', zlib.deflateSync(raw)), ch('IEND', Buffer.alloc(0))]);
}
function sheet(list, scale, bg) {
  const fw = FW * scale, w = fw * list.length, h = FW * scale, buf = Buffer.alloc(w * h * 4);
  list.forEach((fr, i) => { for (let y = 0; y < h; y++) for (let x = 0; x < fw; x++) { const c = fr[Math.floor(y / scale)][Math.floor(x / scale)], o = (y * w + i * fw + x) * 4; const col = c || bg; buf[o] = col ? col[0] : 0; buf[o + 1] = col ? col[1] : 0; buf[o + 2] = col ? col[2] : 0; buf[o + 3] = c || bg ? 255 : 0; } });
  return png(w, h, buf);
}
// 부위 나누기 확인용 색칠 그림
const PC = { head: [240, 90, 90], scarf: [250, 200, 60], tail: [80, 200, 240], cape: [60, 120, 250], farArm: [200, 90, 240], nearArm: [255, 255, 255], farLeg: [60, 220, 120], nearLeg: [40, 140, 70], torso: [150, 150, 150] };
fs.writeFileSync(dir + K + '_parts_x6.png', sheet([Array.from({ length: FW }, (_, Y) => Array.from({ length: FW }, (_, X) => { const x = X - OX, y = Y - OY; return x >= 0 && y >= 0 && x < N && y < N && partOf[y][x] ? PC[partOf[y][x]] : null; }))], 6, [40, 44, 52]));
const bg = [90, 110, 130];
fs.writeFileSync(dir + K + '_idle_x3.png', sheet(frames.idle, 3, bg));
fs.writeFileSync(dir + K + '_walk_x3.png', sheet(frames.walk, 3, bg));
fs.writeFileSync(dir + K + '_attack_x3.png', sheet(frames.attack, 3, bg));
fs.writeFileSync(dir + K + '_east.png', sheet([frame({})], 1, null));
fs.writeFileSync(dir + K + '_idle.png', sheet(frames.idle, 1, null));
fs.writeFileSync(dir + K + '_walk.png', sheet(frames.walk, 1, null));
fs.writeFileSync(dir + K + '_attack.png', sheet(frames.attack, 1, null));
fs.writeFileSync(dir + K + '_hands.json', JSON.stringify(hands));
console.log('saved', K);


