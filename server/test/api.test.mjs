// 서버 통합 테스트: 먼저 `npm run dev` 로 서버를 켜 둔 상태에서 `npm test`
import { execSync } from 'node:child_process';
import { newSave } from '../src/shared/game.generated.js';
import { seasonInfo } from '../src/season.js';
import { checkNickname } from '../src/nickname.js';

const BASE = process.env.BASE || 'http://127.0.0.1:8787';
let pass = 0, failed = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; console.log('PASS', name); } else { failed++; console.log('FAIL', name, extra ?? ''); } };

async function api(method, path, body, token) {
  let res;
  for (let i = 0; ; i++) { // wrangler 로컬 DB를 직접 고친 직후에는 연결이 잠깐 끊길 수 있어 몇 번 다시 시도
    try {
      res = await fetch(BASE + path, {
        method,
        headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      break;
    } catch (e) { if (i >= 4) throw e; await new Promise((r) => setTimeout(r, 700)); }
  }
  let data = null;
  try { data = await res.json(); } catch { /* 본문 없음 */ }
  return { status: res.status, data };
}
const sql = (q) => execSync(`npx wrangler d1 execute idlegame --local --command "${q}"`, { stdio: 'pipe' }).toString();

// ---------- 순수 로직 ----------
{
  const env = { FIRST_SEASON_START: '2026-12-01T06:00:00+09:00' };
  const t = (s) => Date.parse(s);
  { const e2 = { FIRST_SEASON_START: '2026-10-16T06:00:00+09:00', TEST_SEASON_HOURS: '48' }; const f = Date.parse(e2.FIRST_SEASON_START);
    ok('테스트 시즌: 시작 직후는 1', seasonInfo(f + 3600e3, e2).index === 1);
    ok('테스트 시즌: 48시간 뒤 2, 이름에 (테스트)', seasonInfo(f + 49 * 3600e3, e2).index === 2 && seasonInfo(f + 49 * 3600e3, e2).name.includes('테스트'));
    ok('테스트 시즌: 끝나는 시각', seasonInfo(f + 3600e3, e2).endsAt === f + 48 * 3600e3); }
  ok('시즌: 시작 전은 0', seasonInfo(t('2026-11-30T20:59:00Z'), env).index === 0); // 12/01 05:59 KST
  ok('시즌: 정각에 1', seasonInfo(t('2026-12-01T06:00:00+09:00'), env).index === 1);
  ok('시즌: 14일까지 1', seasonInfo(t('2026-12-15T05:59:00+09:00'), env).index === 1);
  ok('시즌: 15일 6시에 2', seasonInfo(t('2026-12-15T06:00:00+09:00'), env).index === 2);
  ok('시즌: 다음 달 1일에 3', seasonInfo(t('2027-01-01T06:00:00+09:00'), env).index === 3);
  ok('시즌: 종료 시각', seasonInfo(t('2026-12-03T12:00:00+09:00'), env).endsAt === t('2026-12-15T06:00:00+09:00'));
  ok('시즌: 연말 넘김', seasonInfo(t('2027-01-20T12:00:00+09:00'), env).endsAt === t('2027-02-01T06:00:00+09:00'));
  const mid = { FIRST_SEASON_START: '2026-12-15T06:00:00+09:00' };
  ok('시즌: 15일 시작 설정', seasonInfo(t('2027-01-02T00:00:00+09:00'), mid).index === 2);
  ok('닉네임: 욕설 차단', !checkNickname('시 발').ok && !checkNickname('Fuck!').ok);
  ok('닉네임: 정상 허용', checkNickname('귀여운멍멍').ok);
  ok('닉네임: 운영자 사칭 차단', !checkNickname('운영자').ok && !checkNickname('Admin01').ok);
  ok('닉네임: 길이 제한', !checkNickname('가').ok && !checkNickname('가'.repeat(13)).ok);
}

{
  const { normalizeToday } = await import('../src/savelogic.js');
  const { dayKey, secSinceDayStart } = await import('../src/shared/game.generated.js');
  const now = Date.parse('2026-12-03T12:00:00+09:00'), day = dayKey(now);
  ok('하루 기준: 한국 시간 오전 6시', dayKey(Date.parse('2026-12-03T05:59:00+09:00')) !== dayKey(Date.parse('2026-12-03T06:00:00+09:00')));
  ok('하루 시작 후 경과 초', Math.abs(secSinceDayStart(Date.parse('2026-12-03T07:30:00+09:00')) - 5400) < 1);
  let s = { today: { date: day, sec: 99999 } };
  const f1 = normalizeToday({ today: { date: day, sec: 100 } }, s, 30, now);
  ok('접속 시간 과다 신고는 허용치로 줄이고 기록', s.today.sec <= 100 + 30 * 1.25 + 60 && f1.length === 1, JSON.stringify([s.today, f1]));
  s = { today: { date: day, sec: 0 } };
  const f2 = normalizeToday({ today: { date: day, sec: 5000 } }, s, 30, now);
  ok('같은 날 접속 시간 되돌리기(버닝 초기화) 방지', s.today.sec === 5000 && f2.some((x) => x.includes('버닝')), JSON.stringify([s.today, f2]));
  s = { today: { date: '2000-1-1', sec: 700 } };
  normalizeToday({ today: { date: '2000-1-1', sec: 700 } }, s, 20, now);
  ok('날짜가 틀려도 서버 날짜로 맞춤', s.today.date === day && s.today.sec <= 90, JSON.stringify(s.today));
  s = { today: { date: day, sec: 3600 } };
  normalizeToday({ today: { date: day, sec: 3500 } }, s, 120, now);
  ok('정상 증가는 그대로', s.today.sec === 3600);
}

// ---------- 서버 API ----------
const sfx = Math.random().toString(36).slice(2, 8);
const A = { loginId: 'tester_' + sfx, password: 'pass1234', nickname: '테스터' + sfx, animal: 'cat' };

let r = await api('POST', '/api/register', A);
ok('가입 성공', r.status === 201 && r.data.token && r.data.save.animal === 'cat' && r.data.save.name === A.nickname, JSON.stringify(r.data));
let tokenA = r.data?.token;
ok('가입 직후 시즌 0 데이터', r.data?.save?.season === 0 && r.data?.season?.index === 0);

r = await api('POST', '/api/register', { ...A, nickname: '다른닉' + sfx });
ok('아이디 중복 거부', r.status === 409 && r.data.error === 'id_taken');
r = await api('POST', '/api/register', { ...A, loginId: 'other_' + sfx, nickname: A.nickname.toUpperCase() });
ok('닉네임 중복 거부(대소문자 무시)', r.status === 409 && r.data.error === 'nick_taken', JSON.stringify(r.data));
r = await api('POST', '/api/register', { ...A, loginId: 'bad_' + sfx, nickname: '씨발놈' });
ok('욕설 닉네임 거부', r.status === 400 && r.data.error === 'bad_nick');
r = await api('POST', '/api/register', { ...A, loginId: 'short_' + sfx, nickname: '닉' + sfx, password: '12' });
ok('너무 짧은 비밀번호 거부', r.status === 400 && r.data.error === 'bad_pw');

r = await api('POST', '/api/login', { loginId: A.loginId, password: 'wrong' });
ok('잘못된 비밀번호 거부', r.status === 401 && r.data.error === 'bad_login');
r = await api('POST', '/api/login', { loginId: 'nobody_' + sfx, password: 'x' });
ok('없는 아이디도 같은 오류', r.status === 401 && r.data.error === 'bad_login');

r = await api('POST', '/api/login', { loginId: A.loginId.toUpperCase(), password: A.password });
ok('로그인 성공(아이디 대소문자 무시)', r.status === 200 && r.data.token && r.data.token !== tokenA);
const tokenB = r.data.token;
r = await api('GET', '/api/me', null, tokenA);
ok('새 로그인 후 기존 접속 끊김', r.status === 401 && r.data.error === 'session');
r = await api('GET', '/api/me', null, tokenB);
ok('새 접속은 유효', r.status === 200 && r.data.nickname === A.nickname);
r = await api('GET', '/api/me');
ok('토큰 없으면 거부', r.status === 401);

// 저장
const me = (await api('GET', '/api/me', null, tokenB)).data;
const s1 = JSON.parse(JSON.stringify(me.save));
s1.gold = 1234; s1.playTime = 5; s1.stats.atk = 3;
r = await api('PUT', '/api/save', { save: s1 }, tokenB);
ok('저장 성공', r.status === 200 && r.data.ok && r.data.rolled === false, JSON.stringify(r.data));
r = await api('GET', '/api/me', null, tokenB);
ok('저장된 값 불러오기', r.data.save.gold === 1234 && r.data.save.stats.atk === 3);
r = await api('PUT', '/api/save', { save: s1 }, tokenA);
ok('끊긴 접속의 저장은 거부', r.status === 401);

const bad = (mut) => { const s = JSON.parse(JSON.stringify(s1)); mut(s); return s; };
r = await api('PUT', '/api/save', { save: bad((s) => { s.gold = -5; }) }, tokenB);
ok('음수 골드 거부', r.status === 422);
r = await api('PUT', '/api/save', { save: bad((s) => { s.playTime = 999999; }) }, tokenB);
ok('시간 대비 과도한 플레이 시간 거부', r.status === 422);
r = await api('PUT', '/api/save', { save: bad((s) => { s.best = { region: 3, round: 1 }; }) }, tokenB);
ok('진행도 점프 거부', r.status === 422);
r = await api('PUT', '/api/save', { save: bad((s) => { s.permPoints = 50; }) }, tokenB);
ok('영구 포인트 합계 임의 증가 거부', r.status === 422);
r = await api('PUT', '/api/save', { save: bad((s) => { s.pendingPoints = 5; }) }, tokenB);
ok('이번 시즌 포인트 임의 증가 거부', r.status === 422);
r = await api('PUT', '/api/save', { save: bad((s) => { s.perm.atk = 11; }) }, tokenB);
ok('영구 투자 레벨 상한 초과 거부', r.status === 422);
r = await api('PUT', '/api/save', { save: bad((s) => { s.perm.atk = 3; }) }, tokenB);
ok('포인트 없이 영구 투자 거부', r.status === 422);
ok('영구 포인트 임의 증가 거부', r.status === 422);
r = await api('PUT', '/api/save', { save: bad((s) => { s.invCap = 5000; }) }, tokenB);
ok('보관함 크기 조작 거부', r.status === 422);
r = await api('PUT', '/api/save', { save: bad((s) => { s.equip.hat = { slot: 'hat', grade: 9, enh: 0, cls: 'melee', opts: {} }; }) }, tokenB);
ok('없는 등급 장비 거부', r.status === 422);
r = await api('PUT', '/api/save', { save: bad((s) => { s.today = { date: s.today.date, sec: 999999 }; }) }, tokenB);
ok('서버가 오늘 접속 시간을 허용 범위로 줄여서 저장', r.status === 200 && r.data.today.sec < 300, JSON.stringify(r.data));
r = await api('PUT', '/api/save', { save: s1 }, tokenB);
r = await api('PUT', '/api/save', { save: bad((s) => { s.level = 9999; }) }, tokenB);
ok('범위를 벗어난 레벨 거부', r.status === 422);
r = await api('PUT', '/api/save', { save: bad((s) => { s.level = 3.5; }) }, tokenB);
ok('소수 레벨 거부', r.status === 422);
r = await api('PUT', '/api/save', { save: bad((s) => { s.exp = -1; }) }, tokenB);
ok('음수 경험치 거부', r.status === 422);
r = await api('GET', '/api/me', null, tokenB);
ok('거부된 저장은 반영되지 않음', r.data.save.gold === 1234);
ok('새 저장 데이터에 레벨 1', r.data.save.level === 1 && r.data.save.exp === 0);

r = await api('PUT', '/api/save', { save: bad((s) => { s.equip.weapon.enh = 16; }) }, tokenB);
ok('무기 강화 16 이상은 거부', r.status === 422);
r = await api('PUT', '/api/save', { save: bad((s) => { s.equip.hat = null; s.equip.weapon.enh = 12; }) }, tokenB);
ok('무기 각성 +12는 저장 가능(범위 안)', r.status === 200, JSON.stringify(r.data));
r = await api('PUT', '/api/save', { save: s1 }, tokenB);
r = await api('PUT', '/api/save', { save: bad((s) => { s.weaponType = 'ranged'; }) }, tokenB);
ok('착용 장비와 직업이 다르면 거부', r.status === 422);
r = await api('PUT', '/api/save', { save: bad((s) => { s.weaponType = 'wizard'; }) }, tokenB);
ok('없는 직업 거부', r.status === 422);

// 직업 선택 가입
const M = await api('POST', '/api/register', { loginId: 'mage_' + sfx, password: 'pw1234', nickname: '마법' + sfx, animal: 'dog', cls: 'mage' });
ok('마법사로 가입', M.status === 201 && M.data.save.weaponType === 'mage' && M.data.save.equip.weapon.cls === 'mage');
const M2 = await api('POST', '/api/register', { loginId: 'wrong_' + sfx, password: 'pw1234', nickname: '이상' + sfx, cls: 'dragon' });
ok('없는 직업이면 전사로 시작', M2.status === 201 && M2.data.save.weaponType === 'melee');

// 닉네임/비밀번호
r = await api('POST', '/api/nickname', { nickname: '바뀐' + sfx }, tokenB);
ok('닉네임 변경', r.status === 200 && r.data.nickname === '바뀐' + sfx);
r = await api('GET', '/api/me', null, tokenB);
ok('저장 데이터의 이름도 함께 변경', r.data.save.name === '바뀐' + sfx && r.data.nickname === '바뀐' + sfx);
const B = { loginId: 'second_' + sfx, password: 'pw5678', nickname: '둘째' + sfx };
const rb = await api('POST', '/api/register', B);
r = await api('POST', '/api/nickname', { nickname: '바뀐' + sfx }, rb.data.token);
ok('다른 사람 닉네임으로 변경 거부', r.status === 409);
r = await api('POST', '/api/password', { oldPassword: 'nope', newPassword: 'newpass99' }, tokenB);
ok('현재 비밀번호 틀리면 변경 거부', r.status === 401);
r = await api('POST', '/api/password', { oldPassword: A.password, newPassword: 'newpass99' }, tokenB);
ok('비밀번호 변경', r.status === 200);

// 시즌 전환: 지역 1 클리어(영구 포인트 1) 후, DB의 시즌을 옛 값으로 돌려 놓고 저장 → 새 시즌으로 전환되어야 함
const s2 = JSON.parse(JSON.stringify((await api('GET', '/api/me', null, tokenB)).data.save));
s2.playTime = 8; s2.clearedRegions = [1]; s2.pendingPoints = 1; s2.best = { region: 2, round: 1 }; s2.gold = 777;
r = await api('PUT', '/api/save', { save: s2 }, tokenB);
ok('지역 클리어 + 포인트 1 저장', r.status === 200, JSON.stringify(r.data));
sql(`UPDATE saves SET season = 99 WHERE account_id = (SELECT id FROM accounts WHERE login_id = '${A.loginId}')`);
r = await api('PUT', '/api/save', { save: s2 }, tokenB);
ok('시즌이 바뀌면 새 시즌 데이터로 전환', r.status === 200 && r.data.rolled === true && r.data.save.gold === 0 && r.data.save.region === 1 && r.data.save.season === 0, JSON.stringify(r.data).slice(0, 200));
ok('이번 시즌 포인트는 다음 시즌에 사용 가능 포인트로, 닉네임도 유지', r.data?.save?.permPoints === 1 && r.data?.save?.pendingPoints === 0 && r.data?.save?.name === '바뀐' + sfx);
ok('클리어 기록/장비는 초기화', (r.data?.save?.clearedRegions || []).length === 0 && r.data?.save?.inv?.length === 0);

// 새 비밀번호 로그인 + 잠금
r = await api('POST', '/api/login', { loginId: A.loginId, password: 'newpass99' });
ok('바뀐 비밀번호로 로그인', r.status === 200);
const tokenC = r.data.token;
for (let i = 0; i < 5; i++) r = await api('POST', '/api/login', { loginId: B.loginId, password: 'wrong' + i });
ok('연속 실패 시 잠금', r.status === 401);
r = await api('POST', '/api/login', { loginId: B.loginId, password: B.password });
ok('잠긴 동안은 올바른 비밀번호도 거부', r.status === 429 && r.data.error === 'locked', JSON.stringify(r.data));

// ---------- 무한 모드 ----------
{
  const E = await api('POST', '/api/register', { loginId: 'endl_' + sfx, password: 'pw1234', nickname: '무한' + sfx, animal: 'dog' });
  const tk = E.data.token, base = E.data.save;
  const put = (mut) => { const s = JSON.parse(JSON.stringify(base)); s.playTime = 5; mut(s); return api('PUT', '/api/save', { save: s }, tk); };
  r = await put((s) => { s.endless = { best: 3, bestAt: Date.now() }; });
  ok('무한 모드: 초반 층 기록은 인정', r.status === 200 && r.data.endless.best === 3, JSON.stringify(r.data));
  r = await put((s) => { s.endless = { best: 40, bestAt: Date.now() }; });
  ok('무한 모드: 말이 안 되는 층 점프는 기록만 되돌림(저장은 성공)', r.status === 200 && r.data.endless.best === 3, JSON.stringify(r.data));
  r = await put((s) => { s.endless = { best: 3, bestAt: Date.now() }; s.stats.hp = 5000; s.stats.atk = 5000; s.endless.best = 9; });
  ok('무한 모드: 벌 수 없는 투자량으로 올린 기록은 되돌림', r.status === 200 && r.data.endless.best === 3, JSON.stringify(r.data));
  r = await put((s) => { s.endless = { best: 1, bestAt: 0 }; });
  ok('무한 모드: 기록이 줄어드는 저장은 거부', r.status === 422);
  r = await put((s) => { s.endless = { best: 'x', bestAt: 0 }; });
  ok('무한 모드: 이상한 기록 형식 거부', r.status === 422);
  r = await put((s) => { s.endless = { best: 3, bestAt: 0 }; s.titles = [{ id: 'x', name: '가짜 칭호', season: 0, buff: { gold: 9 } }]; });
  ok('칭호를 임의로 추가하는 저장은 거부', r.status === 422);
  r = await put((s) => { s.endless = { best: 3, bestAt: 0 }; s.reward = { points: 99 }; });
  ok('보상 알림을 임의로 만드는 저장은 무시', r.status === 200);
  r = await api('GET', '/api/me', null, tk);
  ok('임의로 만든 보상 알림은 저장되지 않음', r.data.save.reward === null);

  // 시즌 순위 보상: 지난 시즌(99) 순위를 DB에 넣고, 시즌이 바뀐 것처럼 만든 뒤 접속
  const S1 = 1000 + Math.floor(Math.random() * 8000), S2 = S1 + 9000;
  const id = (login) => `(SELECT id FROM accounts WHERE login_id = '${login}')`;
  sql(`INSERT INTO endless_rank (season, account_id, floor, reached_at) VALUES (${S1}, ${id('endl_' + sfx)}, 30, 1000)`);
  sql(`UPDATE saves SET season = ${S1} WHERE account_id = ${id('endl_' + sfx)}`);
  r = await api('GET', '/api/me', null, tk);
  const sv = r.data.save;
  ok('시즌 1등: 영구 포인트 보상', r.data.rolled === true && sv.permPoints === 10 && sv.reward && sv.reward.rank === 1 && sv.reward.total === 1 && sv.reward.points === 10, JSON.stringify(sv.reward));
  ok('시즌 1등: 칭호 지급(현재 시즌 기준 버프)', sv.titles.length === 1 && sv.titles[0].name === `시즌 ${S1} 챔피언` && sv.titles[0].season === 0 && sv.titles[0].buff.gold > 0, JSON.stringify(sv.titles));
  ok('새 시즌 무한 모드 기록 초기화', sv.endless.best === 0);
  r = await api('PUT', '/api/save', { save: { ...sv, reward: null } }, tk);
  ok('보상 알림 확인 후 지우기', r.status === 200);
  r = await api('GET', '/api/me', null, tk);
  ok('확인한 알림은 다시 나오지 않음', r.data.save.reward === null && r.data.save.titles.length === 1);

  // 2등 이하(참가 2명 중 2등 = 상위 100%)는 보상 없이 결과만 알림
  const F = await api('POST', '/api/register', { loginId: 'endf_' + sfx, password: 'pw1234', nickname: '무한둘' + sfx });
  sql(`INSERT INTO endless_rank (season, account_id, floor, reached_at) VALUES (${S2}, ${id('endl_' + sfx)}, 50, 1000)`);
  sql(`INSERT INTO endless_rank (season, account_id, floor, reached_at) VALUES (${S2}, ${id('endf_' + sfx)}, 20, 900)`);
  sql(`UPDATE saves SET season = ${S2} WHERE account_id = ${id('endf_' + sfx)}`);
  r = await api('GET', '/api/me', null, F.data.token);
  ok('순위권 밖: 보상 없이 결과만', r.data.save.reward && r.data.save.reward.rank === 2 && r.data.save.reward.total === 2 && r.data.save.reward.points === 0 && r.data.save.permPoints === 0, JSON.stringify(r.data.save.reward));

  // 룰렛 티켓/보너스
  {
    const R = await api('POST', '/api/register', { loginId: 'roul_' + sfx, password: 'pw1234', nickname: '룰렛' + sfx });
    const rtk = R.data.token, rb = R.data.save;
    const send = (mut) => { const s = JSON.parse(JSON.stringify(rb)); s.playTime = 3; mut(s); return api('PUT', '/api/save', { save: s }, rtk); };
    ok('룰렛: 새 계정은 티켓 1개로 시작', rb.tickets === 1 && rb.buff.exp.sec === 0, JSON.stringify([rb.tickets, rb.buff]));
    r = await send((s) => { s.tickets = 3; });
    ok('룰렛: 티켓 임의 증가 거부', r.status === 422);
    r = await send((s) => { s.buff.exp = { sec: 1800, mul: 2 }; });
    ok('룰렛: 티켓을 쓰지 않고 보너스만 늘리면 거부', r.status === 422);
    r = await send((s) => { s.tickets = 0; s.buff.gold = { sec: 5000, mul: 2 }; });
    ok('룰렛: 한 번 돌려서 얻을 수 있는 시간보다 많으면 거부', r.status === 422);
    r = await send((s) => { s.tickets = 0; s.buff.exp = { sec: 600, mul: 3 }; });
    ok('룰렛: 티켓 1개 사용 + 정상 보너스는 인정', r.status === 200, JSON.stringify(r.data));
    r = await send((s) => { s.tickets = 0; s.buff.exp = { sec: 600, mul: 9 }; });
    ok('룰렛: 배율이 비정상이면 거부', r.status === 422);
    // 광고
    const today = rb.ads.date;
    r = await send((s) => { s.tickets = 0; s.buff.gold = { sec: 1800, mul: 2 }; });
    ok('광고: 횟수를 올리지 않고 보너스만 늘리면 거부', r.status === 422);
    r = await send((s) => { s.tickets = 0; s.ads = { date: today, count: 1 }; s.buff.gold = { sec: 1800, mul: 2 }; });
    ok('광고: 1회 시청 + 30분 보너스 인정', r.status === 200, JSON.stringify(r.data));
    r = await send((s) => { s.tickets = 0; s.ads = { date: today, count: 9 }; });
    ok('광고: 하루 횟수 초과 거부', r.status === 422);
    r = await send((s) => { s.tickets = 0; s.ads = { date: today, count: 1 }; s.buff.gold = { sec: 5400, mul: 2 }; });
    ok('광고: 한 번 본 뒤 보너스를 크게 늘리면 거부', r.status === 422);
  }

  // 순위표
  r = await api('GET', '/api/ranking', null, tk);
  ok('순위표 조회', r.status === 200 && Array.isArray(r.data.list) && r.data.minFloor === 10, JSON.stringify(r.data).slice(0, 200));
  r = await api('GET', '/api/ranking');
  ok('순위표는 로그인해야 볼 수 있음', r.status === 401);
}

// ---------- 의견 보내기 ----------
{
  const F = await api('POST', '/api/register', { loginId: 'fb_' + sfx, password: 'pw1234', nickname: '의견' + sfx });
  const ftk = F.data.token;
  r = await api('POST', '/api/feedback', { category: 'bug', body: '테스트 의견입니다' });
  ok('의견: 로그인 없이는 거부', r.status === 401);
  r = await api('POST', '/api/feedback', { category: 'bug', body: ' ' }, ftk);
  ok('의견: 빈 내용 거부', r.status === 400);
  r = await api('POST', '/api/feedback', { category: 'bug', body: 'x'.repeat(1001) }, ftk);
  ok('의견: 너무 긴 내용 거부', r.status === 400);
  r = await api('POST', '/api/feedback', { category: 'bug', body: '테스트 의견입니다 <b>태그</b>', context: 'Lv.3' }, ftk);
  ok('의견: 보내기 성공', r.status === 200 && r.data.ok);
  r = await api('POST', '/api/feedback', { category: 'idea', body: '바로 또 보내기' }, ftk);
  ok('의견: 연속으로 보내면 잠시 제한', r.status === 429);
  r = await api('GET', '/api/admin?key=wrong');
  ok('운영자 화면: 키가 틀리면 거부', r.status === 403);
  r = await api('GET', '/api/admin?key=dev-admin-key');
  ok('운영자 화면: 키가 맞으면 의견 목록', r.status === 200 && r.data.feedback.some((f) => f.nickname === '의견' + sfx && f.body.includes('태그')) && r.data.stats.accounts > 0, JSON.stringify(r.data).slice(0, 150));
  ok('운영자 화면: 이용자 목록(진행 요약 포함, 비밀번호 정보는 없음)', Array.isArray(r.data.users) && r.data.users.some((u) => u.nickname === '의견' + sfx && u.level === 1 && u.loginId) && !JSON.stringify(r.data.users).match(/pw_hash|pw_salt|session/), JSON.stringify(r.data.users).slice(0, 200));
  ok('운영자 화면: 전투력이 계산되어 나옴', r.data.users.some((u) => u.nickname === '의견' + sfx && Number.isFinite(u.power) && u.power > 0 && !('data' in u)), JSON.stringify(r.data.users).slice(0, 200));
  r = await api('GET', '/api/profile?nickname=' + encodeURIComponent('의견' + sfx), null, ftk);
  ok('장비 구경: 요약과 착용 장비', r.status === 200 && r.data.level === 1 && r.data.equip.weapon && Number.isFinite(r.data.power) && !JSON.stringify(r.data).match(/pw_hash|session|token/), JSON.stringify(r.data).slice(0, 200));
  r = await api('GET', '/api/profile?nickname=' + encodeURIComponent('없는사람' + sfx), null, ftk);
  ok('장비 구경: 없는 사람은 404', r.status === 404);
  r = await api('GET', '/api/profile?nickname=x');
  ok('장비 구경: 로그인이 필요함', r.status === 401);
}
r = await api('POST', '/api/logout', null, tokenC);
ok('로그아웃', r.status === 200);
r = await api('GET', '/api/me', null, tokenC);
ok('로그아웃 후 토큰 무효', r.status === 401);
r = await api('GET', '/api/season');
ok('시즌 정보 조회', r.status === 200 && typeof r.data.index === 'number' && r.data.serverNow > 0);
r = await api('GET', '/api/nothing');
ok('없는 주소는 404', r.status === 404);

console.log(`\n${pass} 통과 / ${failed} 실패`);
process.exit(failed ? 1 : 0);








