// PNG의 투명하지 않은 부분 크기 (사용: node bbox.mjs 파일...)
import fs from 'fs'; import zlib from 'zlib';
for (const f of process.argv.slice(2)) {
  const b = fs.readFileSync(f); let o = 8, w, h, idat = [];
  while (o < b.length) { const l = b.readUInt32BE(o), t = b.toString('ascii', o + 4, o + 8); if (t === 'IHDR') { w = b.readUInt32BE(o + 8); h = b.readUInt32BE(o + 12); } if (t === 'IDAT') idat.push(b.subarray(o + 8, o + 8 + l)); o += l + 12; }
  const raw = zlib.inflateSync(Buffer.concat(idat)), st = w * 4 + 1; let x0 = w, x1 = -1, y0 = h, y1 = -1;
  const px = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) { const ft = raw[y * st]; for (let i = 0; i < w * 4; i++) { const a = i >= 4 ? px[y * w * 4 + i - 4] : 0, up = y ? px[(y - 1) * w * 4 + i] : 0, ul = y && i >= 4 ? px[(y - 1) * w * 4 + i - 4] : 0, v = raw[y * st + 1 + i];
    px[y * w * 4 + i] = (ft === 0 ? v : ft === 1 ? v + a : ft === 2 ? v + up : ft === 3 ? v + ((a + up) >> 1) : v + ((p, pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - ul)) => (pa <= pb && pa <= pc ? a : pb <= pc ? up : ul))(a + up - ul)) & 255; } }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3] > 20) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  console.log(f.split(/[\/]/).pop(), `캔버스 ${w}x${h}`, `그림 ${x1 - x0 + 1}x${y1 - y0 + 1}`);
}
