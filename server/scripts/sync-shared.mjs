// 게임 화면과 서버가 같은 규칙/설정을 쓰도록, client/js 의 config.js + game.js 를 서버용 모듈로 복사합니다.
// (원본은 client/js 하나뿐이고, 이 파일이 만드는 결과물은 직접 고치지 않습니다)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const js = path.resolve(root, '../client/js');
const cfg = fs.readFileSync(path.join(js, 'config.js'), 'utf8');
const game = fs.readFileSync(path.join(js, 'game.js'), 'utf8');

const out = `// 자동 생성 파일 — 직접 고치지 마세요. (server 폴더에서 npm run sync)\n${cfg}\n${game}\nexport { CFG, newSave, mergeSave, dayKey, secSinceDayStart, endlessFeasible, makeItem, investedAll, goldCeiling, combatPower };\n`;
const dest = path.join(root, 'src/shared/game.generated.js');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, out);
console.log('synced →', path.relative(root, dest));

