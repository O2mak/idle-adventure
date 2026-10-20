// 제미나이로 몬스터 그림을 받아 오는 도구
// 사용: node gen.mjs <저장 이름> <normal|boss> "<몬스터 설명(영어)>" [모델]
// 결과: out/<저장 이름>.png (자홍색 배경의 큰 그림). 이어서 tools/hero-anim/grid.mjs → topng.mjs 로 칸 그림으로 줄임
// 키: 프로젝트 폴더의 제미나이키.txt (깃 제외). 참고 그림: 바탕화면 몬스터_참고그림 (한국 몬스터 + 고양이)
import fs from 'fs';
import path from 'path';
import os from 'os';
const T = decodeURIComponent(new URL('.', import.meta.url).pathname).replace(/^\/(\w:)/, '$1');
const [, , name, kind, desc, modelArg] = process.argv;
const model = modelArg || 'gemini-3-pro-image';
const key = fs.readFileSync(T + '../../제미나이키.txt', 'utf8').replace(/\s+/g, '');
const refDir = path.join(os.homedir(), 'Desktop', '몬스터_참고그림');
const refs = kind === 'boss'
  ? ['1지역_보스_도깨비대장.png', '1지역_도깨비.png', '캐릭터_고양이.png']
  : ['1지역_도깨비.png', '1지역_구미호.png', '캐릭터_고양이.png'];

const common = `The attached images are monsters and a hero from my game. Draw ONE NEW game monster as pixel art in exactly the same art style, same level of detail, same outline thickness and same shading as the attached images. The new monster is NOT any of the attached ones - only copy the art style.

Style rules:
- True pixel art on a strict square pixel grid. No anti-aliasing, no blur, no gradients, hard pixel edges.
- Dark purple-black 1-pixel outline around the whole body, 2-3 tone cel shading, light from the top-left, rich saturated colors.
- ${kind === 'boss'
    ? 'BOSS: bigger and more imposing than a normal monster, taller proportions (about 3 heads tall), more detailed and fierce, but still the same cute-fierce game style.'
    : 'NORMAL monster: cute but a little fierce mascot-style field monster, chubby chibi proportions, oversized head, short stubby limbs, big round eyes. Friendly-looking and a little mischievous, never gross or realistic.'}
- Facing LEFT in side 3/4 view, full body, standing in a battle-ready pose. Feet touch the bottom edge of the figure.
- Keep arms, legs, tail and weapons slightly apart from the body so each part reads clearly.
- Background: one flat solid color #FF00FF magenta. No ground, no shadow, no scenery, no text, no frame, no watermark.
- Only one character in the image, centered with a small margin around it.

Monster concept (design it in a way that fits its own country's folklore and culture): `;

const parts = [{ text: common + desc }];
for (const f of refs) {
  const p = path.join(refDir, f);
  if (fs.existsSync(p)) parts.push({ inlineData: { mimeType: 'image/png', data: fs.readFileSync(p).toString('base64') } });
}
const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
  body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ['IMAGE'] } }),
});
const j = await res.json();
if (j.error) { console.log('오류', j.error.code, j.error.status, String(j.error.message).slice(0, 200)); process.exit(1); }
const img = (j.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData);
if (!img) { console.log('그림 없음', JSON.stringify(j).slice(0, 300)); process.exit(1); }
fs.mkdirSync(T + 'out', { recursive: true });
fs.writeFileSync(T + `out/${name}.png`, Buffer.from(img.inlineData.data, 'base64'));
console.log('saved', `out/${name}.png`);
