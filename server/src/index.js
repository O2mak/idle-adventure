// 서버 진입점: /api/* 요청 처리 (그 외는 게임 화면 파일을 그대로 전달)
import { CFG, newSave, dayKey } from './shared/game.generated.js';
import { hashPassword, verifyPassword, randomToken, sha256Hex } from './crypto.js';
import { checkNickname, checkLoginId, checkPassword } from './nickname.js';
import { seasonInfo } from './season.js';
import { validateSave, rollSave, normalizeToday } from './savelogic.js';

class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const fail = (status, code, message) => { throw new HttpError(status, code, message); };

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

const MAX_BODY = 300 * 1024;
const LOCK_AFTER = 5, LOCK_MS = 60e3;

async function readJson(request) {
  const text = await request.text();
  if (text.length > MAX_BODY) fail(413, 'too_big', '데이터가 너무 커요.');
  try { return text ? JSON.parse(text) : {}; } catch { fail(400, 'bad_json', '요청 형식이 올바르지 않아요.'); }
}

const seasonView = (s, now) => ({ index: s.index, name: s.name, startsAt: s.startsAt, endsAt: s.endsAt, serverNow: now });

// ---------- 인증 ----------
async function auth(request, env) {
  const h = request.headers.get('authorization') || '';
  const m = /^Bearer ([0-9a-f]{64})$/.exec(h);
  if (!m) fail(401, 'session', '로그인이 필요해요.');
  const acct = await env.DB.prepare('SELECT id, login_id, nickname FROM accounts WHERE session_hash = ?').bind(await sha256Hex(m[1])).first();
  if (!acct) fail(401, 'session', '다른 곳에서 접속했거나 로그인이 만료되었어요. 다시 로그인해 주세요.');
  return acct;
}

async function startSession(env, accountId, now) {
  const token = randomToken();
  await env.DB.prepare('UPDATE accounts SET session_hash = ?, session_at = ?, last_seen = ? WHERE id = ?')
    .bind(await sha256Hex(token), now, now, accountId).run();
  return token;
}

// ---------- 무한 모드 랭킹 ----------
// 한 시즌에서 내 순위: 층이 높을수록, 같으면 먼저 도달한 사람이 위 (그래도 같으면 먼저 가입한 계정)
async function myRank(env, season, accountId) {
  const me = await env.DB.prepare('SELECT floor, reached_at FROM endless_rank WHERE season = ? AND account_id = ?').bind(season, accountId).first();
  if (!me) return null;
  const better = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM endless_rank WHERE season = ?1 AND (floor > ?2 OR (floor = ?2 AND reached_at < ?3) OR (floor = ?2 AND reached_at = ?3 AND account_id < ?4))',
  ).bind(season, me.floor, me.reached_at, accountId).first();
  const total = await env.DB.prepare('SELECT COUNT(*) AS n FROM endless_rank WHERE season = ?').bind(season).first();
  return { rank: better.n + 1, total: total.n, floor: me.floor, reachedAt: me.reached_at };
}

async function recordRank(env, season, accountId, floor, reachedAt) {
  await env.DB.prepare(
    'INSERT INTO endless_rank (season, account_id, floor, reached_at) VALUES (?1, ?2, ?3, ?4) ' +
    'ON CONFLICT(season, account_id) DO UPDATE SET floor = ?3, reached_at = ?4 WHERE ?3 > endless_rank.floor',
  ).bind(season, accountId, floor, reachedAt).run();
}

// ---------- 저장 ----------
// 저장 데이터를 읽고, 시즌이 바뀌었으면 새 시즌 데이터로 전환
async function loadSave(env, acct, now) {
  const cur = seasonInfo(now, env);
  const row = await env.DB.prepare('SELECT season, data FROM saves WHERE account_id = ?').bind(acct.id).first();
  let data = row ? JSON.parse(row.data) : null;
  let rolled = false;
  if (!data) data = newSave('dog', acct.nickname);
  if (!row || row.season !== cur.index) {
    if (row) {
      const r = await myRank(env, row.season, acct.id); // 끝난 시즌의 무한 모드 순위 → 보상
      data = rollSave(data, cur.index, r && { oldSeason: row.season, rank: r.rank, total: r.total, floor: r.floor });
      rolled = true;
    }
    data.season = cur.index; data.name = acct.nickname;
    await writeSave(env, acct.id, cur.index, data, now);
  }
  // 새 하루(오전 6시 기준)가 시작됐으면 오늘의 접속 시간을 0으로 (버닝 타임 새로 시작)
  const day = dayKey(now);
  if (!data.today || data.today.date !== day) data.today = { date: day, sec: 0 };
  return { save: data, season: cur, rolled };
}

async function writeSave(env, accountId, season, data, now) {
  await env.DB.prepare(
    'INSERT INTO saves (account_id, season, data, play_time, updated_at) VALUES (?1, ?2, ?3, ?4, ?5) ' +
    'ON CONFLICT(account_id) DO UPDATE SET season = ?2, data = ?3, play_time = ?4, updated_at = ?5',
  ).bind(accountId, season, JSON.stringify(data), data.playTime || 0, now).run();
}

// ---------- 핸들러 ----------
async function register(request, env, now) {
  const b = await readJson(request);
  const id = checkLoginId(b.loginId); if (!id.ok) fail(400, 'bad_id', id.message);
  const pw = checkPassword(b.password); if (!pw.ok) fail(400, 'bad_pw', pw.message);
  const nick = checkNickname(b.nickname); if (!nick.ok) fail(400, 'bad_nick', nick.message);
  const animal = b.animal === 'cat' ? 'cat' : 'dog';
  const cls = CFG.enabledClasses.includes(b.cls) ? b.cls : 'melee'; // 직업(무기 종류). 기본은 전사

  if (await env.DB.prepare('SELECT 1 FROM accounts WHERE login_id = ?').bind(id.loginId).first()) fail(409, 'id_taken', '이미 사용 중인 아이디예요.');
  if (await env.DB.prepare('SELECT 1 FROM accounts WHERE nickname = ?').bind(nick.nickname).first()) fail(409, 'nick_taken', '이미 사용 중인 닉네임이에요.');

  const { hash, salt } = await hashPassword(pw.password);
  let res;
  try {
    res = await env.DB.prepare('INSERT INTO accounts (login_id, pw_hash, pw_salt, nickname, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(id.loginId, hash, salt, nick.nickname, now).run();
  } catch (e) { // 동시에 같은 아이디/닉네임으로 가입한 경우
    fail(409, 'taken', '이미 사용 중인 아이디 또는 닉네임이에요.');
  }
  const accountId = res.meta.last_row_id;
  const cur = seasonInfo(now, env);
  const save = newSave(animal, nick.nickname, cls); save.season = cur.index;
  await writeSave(env, accountId, cur.index, save, now);
  const token = await startSession(env, accountId, now);
  return json({ token, nickname: nick.nickname, save, season: seasonView(cur, now) }, 201);
}

async function login(request, env, now) {
  const b = await readJson(request);
  const row = await env.DB.prepare('SELECT id, nickname, pw_hash, pw_salt, fail_count, locked_until FROM accounts WHERE login_id = ?')
    .bind(String(b.loginId ?? '').trim()).first();
  const bad = () => fail(401, 'bad_login', '아이디 또는 비밀번호가 올바르지 않아요.');
  if (!row) { await hashPassword('dummy'); bad(); } // 아이디 존재 여부가 응답 시간으로 드러나지 않게
  if (row.locked_until > now) fail(429, 'locked', `로그인에 여러 번 실패해서 잠시 잠겼어요. ${Math.ceil((row.locked_until - now) / 1000)}초 뒤에 다시 시도해 주세요.`);
  if (!(await verifyPassword(String(b.password ?? ''), row.pw_hash, row.pw_salt))) {
    const n = row.fail_count + 1;
    await env.DB.prepare('UPDATE accounts SET fail_count = ?, locked_until = ? WHERE id = ?')
      .bind(n >= LOCK_AFTER ? 0 : n, n >= LOCK_AFTER ? now + LOCK_MS : 0, row.id).run();
    bad();
  }
  await env.DB.prepare('UPDATE accounts SET fail_count = 0, locked_until = 0 WHERE id = ?').bind(row.id).run();
  const token = await startSession(env, row.id, now); // 새 토큰 발급 → 기존 접속은 끊김
  const { save, season, rolled } = await loadSave(env, row, now);
  return json({ token, nickname: row.nickname, save, season: seasonView(season, now), rolled });
}

async function me(request, env, now) {
  const acct = await auth(request, env);
  await env.DB.prepare('UPDATE accounts SET last_seen = ? WHERE id = ?').bind(now, acct.id).run();
  const { save, season, rolled } = await loadSave(env, acct, now);
  return json({ nickname: acct.nickname, save, season: seasonView(season, now), rolled });
}

async function putSave(request, env, now) {
  const acct = await auth(request, env);
  const b = await readJson(request);
  const cur = seasonInfo(now, env);
  const row = await env.DB.prepare('SELECT season, data, updated_at FROM saves WHERE account_id = ?').bind(acct.id).first();
  if (!row) fail(404, 'no_save', '저장 데이터가 없어요.');

  // 시즌이 바뀌었으면 클라이언트가 보낸 데이터는 무시하고 새 시즌 데이터를 돌려줌
  if (row.season !== cur.index) {
    const { save } = await loadSave(env, acct, now);
    return json({ ok: true, rolled: true, save, season: seasonView(cur, now) });
  }
  const old = JSON.parse(row.data);
  const { fatal, flags } = validateSave(old, b.save, (now - row.updated_at) / 1000, now);
  if (fatal.length) {
    await env.DB.prepare('INSERT INTO flags (account_id, at, reason) VALUES (?, ?, ?)').bind(acct.id, now, '저장 거부: ' + fatal.join(', ')).run();
    fail(422, 'invalid_save', '저장 데이터에 문제가 있어요: ' + fatal[0]);
  }
  const data = b.save;
  data.name = acct.nickname; data.season = cur.index;
  data.reward = data.reward === null ? null : (old.reward || null); // 보상 알림은 서버만 만들 수 있고, 화면에서 확인한 뒤 지울 수만 있음
  flags.push(...normalizeToday(old, data, (now - row.updated_at) / 1000, now));
  // 무한 모드 새 기록: 도달 시각은 지난 저장 ~ 지금 사이로 제한 (화면이 보낸 시각을 참고하되 서버 시간을 넘지 못함)
  const oldBest = (old.endless && old.endless.best) || 0;
  if (data.endless.best > oldBest) {
    data.endless.bestAt = Math.min(now, Math.max(row.updated_at, data.endless.bestAt));
    if (data.endless.best >= CFG.endless.minFloor) await recordRank(env, cur.index, acct.id, data.endless.best, data.endless.bestAt);
  } else data.endless.bestAt = (old.endless && old.endless.bestAt) || 0;
  if (JSON.stringify(data).length > MAX_BODY) fail(413, 'too_big', '데이터가 너무 커요.');
  await writeSave(env, acct.id, cur.index, data, now);
  await env.DB.prepare('UPDATE accounts SET last_seen = ? WHERE id = ?').bind(now, acct.id).run();
  for (const f of flags) await env.DB.prepare('INSERT INTO flags (account_id, at, reason) VALUES (?, ?, ?)').bind(acct.id, now, f).run();
  return json({ ok: true, rolled: false, season: seasonView(cur, now), today: data.today, endless: data.endless });
}

// 무한 모드 순위표: 상위 N명과 내 순위 (로그인한 사람만 볼 수 있음)
async function ranking(request, env, now) {
  const acct = await auth(request, env);
  const cur = seasonInfo(now, env);
  const top = await env.DB.prepare(
    'SELECT r.floor, r.reached_at, a.nickname, a.id FROM endless_rank r JOIN accounts a ON a.id = r.account_id ' +
    'WHERE r.season = ? ORDER BY r.floor DESC, r.reached_at ASC, r.account_id ASC LIMIT 30',
  ).bind(cur.index).all();
  const total = await env.DB.prepare('SELECT COUNT(*) AS n FROM endless_rank WHERE season = ?').bind(cur.index).first();
  const mine = await myRank(env, cur.index, acct.id);
  return json({
    season: seasonView(cur, now), total: total.n, minFloor: CFG.endless.minFloor,
    list: top.results.map((r, i) => ({ rank: i + 1, nickname: r.nickname, floor: r.floor, reachedAt: r.reached_at, me: r.id === acct.id })),
    me: mine,
  });
}

async function setNickname(request, env, now) {
  const acct = await auth(request, env);
  const b = await readJson(request);
  const nick = checkNickname(b.nickname); if (!nick.ok) fail(400, 'bad_nick', nick.message);
  const other = await env.DB.prepare('SELECT id FROM accounts WHERE nickname = ?').bind(nick.nickname).first();
  if (other && other.id !== acct.id) fail(409, 'nick_taken', '이미 사용 중인 닉네임이에요.');
  try { await env.DB.prepare('UPDATE accounts SET nickname = ? WHERE id = ?').bind(nick.nickname, acct.id).run(); }
  catch { fail(409, 'nick_taken', '이미 사용 중인 닉네임이에요.'); }
  const row = await env.DB.prepare('SELECT data FROM saves WHERE account_id = ?').bind(acct.id).first();
  if (row) { const d = JSON.parse(row.data); d.name = nick.nickname; await env.DB.prepare('UPDATE saves SET data = ? WHERE account_id = ?').bind(JSON.stringify(d), acct.id).run(); }
  return json({ ok: true, nickname: nick.nickname });
}

async function setPassword(request, env, now) {
  const acct = await auth(request, env);
  const b = await readJson(request);
  const pw = checkPassword(b.newPassword); if (!pw.ok) fail(400, 'bad_pw', pw.message);
  const row = await env.DB.prepare('SELECT pw_hash, pw_salt FROM accounts WHERE id = ?').bind(acct.id).first();
  if (!(await verifyPassword(String(b.oldPassword ?? ''), row.pw_hash, row.pw_salt))) fail(401, 'bad_login', '현재 비밀번호가 올바르지 않아요.');
  const { hash, salt } = await hashPassword(pw.password);
  await env.DB.prepare('UPDATE accounts SET pw_hash = ?, pw_salt = ? WHERE id = ?').bind(hash, salt, acct.id).run();
  return json({ ok: true });
}

async function logout(request, env) {
  const acct = await auth(request, env);
  await env.DB.prepare('UPDATE accounts SET session_hash = NULL WHERE id = ?').bind(acct.id).run();
  return json({ ok: true });
}

// ---------- 의견 보내기 ----------
const FEEDBACK_CATEGORIES = { bug: '버그', idea: '건의', other: '기타' };
const FEEDBACK_GAP_MS = 20e3;

async function sendFeedback(request, env, now, ctx) {
  const acct = await auth(request, env);
  const b = await readJson(request);
  const body = String(b.body ?? '').trim();
  if (body.length < 2) fail(400, 'empty', '내용을 입력해 주세요.');
  if (body.length > 1000) fail(400, 'too_long', '의견은 1000자까지 보낼 수 있어요.');
  const category = FEEDBACK_CATEGORIES[b.category] ? b.category : 'other';
  const last = await env.DB.prepare('SELECT MAX(at) AS at FROM feedback WHERE account_id = ?').bind(acct.id).first();
  if (last && last.at && now - last.at < FEEDBACK_GAP_MS) fail(429, 'slow_down', '의견은 잠시 후에 다시 보낼 수 있어요.');
  const ctxText = String(b.context ?? '').slice(0, 300);
  await env.DB.prepare('INSERT INTO feedback (account_id, nickname, category, body, context, at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(acct.id, acct.nickname, category, body, ctxText, now).run();
  // 디스코드 알림(설정했을 때만). 실패해도 의견 저장에는 영향 없음
  if (env.DISCORD_WEBHOOK && ctx && ctx.waitUntil) {
    const text = `**[${FEEDBACK_CATEGORIES[category]}] ${acct.nickname}**${ctxText ? ` (${ctxText})` : ''}\n${body}`.slice(0, 1900);
    ctx.waitUntil(fetch(env.DISCORD_WEBHOOK, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: text, allowed_mentions: { parse: [] } }),
    }).catch(() => {}));
  }
  return json({ ok: true });
}

// 운영자 확인용: ADMIN_KEY(비밀 설정)를 아는 사람만 의견과 의심 기록을 볼 수 있음
async function adminFeedback(request, env) {
  const key = new URL(request.url).searchParams.get('key') || request.headers.get('x-admin-key') || '';
  if (!env.ADMIN_KEY || (await sha256Hex(key.trim())) !== (await sha256Hex(String(env.ADMIN_KEY).trim()))) fail(403, 'forbidden', '권한이 없어요.');
  const fb = await env.DB.prepare('SELECT id, nickname, category, body, context, at FROM feedback ORDER BY at DESC LIMIT 200').all();
  const flags = await env.DB.prepare('SELECT f.at, f.reason, a.nickname FROM flags f LEFT JOIN accounts a ON a.id = f.account_id ORDER BY f.at DESC LIMIT 100').all();
  // 이용자 목록: 계정 + 진행 요약 (비밀번호 해시/세션 값은 포함하지 않음)
  const users = await env.DB.prepare(
    "SELECT a.nickname, a.login_id AS loginId, a.created_at AS createdAt, a.last_seen AS lastSeen, s.season, s.play_time AS playTime, " +
    "json_extract(s.data,'$.level') AS level, json_extract(s.data,'$.weaponType') AS cls, json_extract(s.data,'$.animal') AS animal, " +
    "json_extract(s.data,'$.best.region') AS bestRegion, json_extract(s.data,'$.best.round') AS bestRound, " +
    "json_extract(s.data,'$.endless.best') AS endlessBest, json_extract(s.data,'$.kills') AS kills, " +
    "(SELECT COUNT(*) FROM flags f WHERE f.account_id = a.id) AS flagCount " +
    "FROM accounts a LEFT JOIN saves s ON s.account_id = a.id ORDER BY a.last_seen DESC LIMIT 500").all();
  const stats = await env.DB.prepare('SELECT (SELECT COUNT(*) FROM accounts) AS accounts, (SELECT COUNT(*) FROM accounts WHERE last_seen > ?) AS active_day').bind(Date.now() - 86400e3).first();
  return json({ feedback: fb.results, flags: flags.results, users: users.results, stats });
}

// ---------- 라우팅 ----------
const routes = {
  'POST /api/register': register,
  'POST /api/login': login,
  'GET /api/me': me,
  'PUT /api/save': putSave,
  'GET /api/ranking': ranking,
  'POST /api/nickname': setNickname,
  'POST /api/password': setPassword,
  'POST /api/logout': logout,
  'POST /api/feedback': sendFeedback,
  'GET /api/admin': adminFeedback,
  'GET /api/season': async (request, env, now) => json(seasonView(seasonInfo(now, env), now)),
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    const handler = routes[`${request.method} ${url.pathname}`];
    if (!handler) return json({ error: 'not_found', message: '없는 주소예요.' }, 404);
    try {
      return await handler(request, env, Date.now(), ctx);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.code, message: e.message }, e.status);
      console.error(e);
      return json({ error: 'server', message: '서버에 문제가 생겼어요. 잠시 후 다시 시도해 주세요.' }, 500);
    }
  },
};




