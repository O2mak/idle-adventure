// 저장 데이터 검증과 시즌 전환. 화면(client)과 같은 게임 규칙 코드를 사용
import { CFG, newSave, dayKey, secSinceDayStart, endlessFeasible, makeItem, investedAll, goldCeiling } from './shared/game.generated.js';

const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const SLOTS = CFG.slots;

// 영구 포인트 투자에 쓴 포인트 합계
export function permSpent(perm) {
  let t = 0;
  for (const k of Object.keys(CFG.perm.items)) for (let i = 0; i < ((perm && perm[k]) || 0); i++) t += CFG.perm.costs[i] || 0;
  return t;
}

// 시즌이 끝났을 때 무한 모드 순위에 따른 보상. rank=등수(1부터), total=순위권 인원. 없으면 null
export function rewardFor(rank, total) {
  for (const r of CFG.endless.rewards) {
    if ((r.rank && rank === r.rank) || (r.pct && rank / total <= r.pct)) return r;
  }
  return null;
}

// 새 시즌: 진행 상황은 초기화하고, 닉네임/영구 투자/칭호만 이어감. 이번 시즌에 모은 포인트는 이제 쓸 수 있는 포인트가 됨
// rank: { oldSeason, rank, total, floor } (지난 시즌 무한 모드 순위가 있을 때)
export function rollSave(old, seasonIndex, rank) {
  const fresh = newSave(old.animal, old.name, old.weaponType);
  fresh.season = seasonIndex;
  fresh.animalLocked = false;   // 새 시즌 시작: 동물을 다시 고를 수 있음
  fresh.permPoints = (old.permPoints || 0) + (old.pendingPoints || 0);
  fresh.pendingPoints = 0;
  fresh.perm = Object.assign(fresh.perm, old.perm || {});
  fresh.titles = old.titles || [];
  fresh.level = 1;
  const r = rank && rewardFor(rank.rank, rank.total);
  if (r) {
    fresh.permPoints += r.points;
    let title = null;
    if (r.title) {
      title = { id: `${r.title.key}-${rank.oldSeason}`, name: `시즌 ${rank.oldSeason} ${r.title.label}`, season: seasonIndex, buff: r.title.buff };
      fresh.titles = fresh.titles.concat([title]);
    }
    fresh.reward = { season: rank.oldSeason, rank: rank.rank, total: rank.total, floor: rank.floor, points: r.points, title: title ? title.name : null };
  } else if (rank) {
    fresh.reward = { season: rank.oldSeason, rank: rank.rank, total: rank.total, floor: rank.floor, points: 0, title: null };
  }
  return fresh;
}

// 무한 모드 최고 층이 늘어난 저장이 믿을 만한지 확인 (순위에 직접 영향을 주므로 엄격하게). 문제 목록 반환
export function checkEndlessClaim(old, s, elapsedSec) {
  const bad = [], E = CFG.endless, best = s.endless.best, oldBest = (old.endless && old.endless.best) || 0;
  if (best - oldBest > elapsedSec / 2 + E.maxJump) bad.push('무한 모드 층이 너무 빨리 올랐어요');
  if ((s.kills || 0) > s.playTime * 4 + 100) bad.push('처치 수가 플레이 시간에 비해 많아요');
  const max = Math.max(1, s.best.region);
  for (const it of Object.values(s.equip).concat(s.inv)) {
    if (!it) continue;
    if (!Number.isInteger(it.region) || it.region < 1 || it.region > max || it.region < CFG.gradeUnlock[it.grade]) { bad.push('장비 정보가 진행도와 맞지 않아요'); break; }
    const ex = makeItem({ nextUid: 0 }, it.slot, it.grade, it.region, it.cls).opts, got = it.opts || {};
    const keys = Object.keys(ex);
    if (keys.length !== Object.keys(got).length || keys.some((k) => !isNum(got[k]) || Math.abs(got[k] - ex[k]) > 1e-6 * Math.max(1, Math.abs(ex[k])))) { bad.push('장비 능력치가 올바르지 않아요'); break; }
  }
  if (investedAll(s) > goldCeiling(s)) bad.push('성장 투자량이 벌 수 있는 골드보다 많아요');
  if (!bad.length && best - 1 >= 1 && !endlessFeasible(s, best - 1)) bad.push('이 능력치로는 도달하기 어려운 층이에요');
  return bad;
}

// 오늘의 접속 시간(버닝 타임 기준)은 서버 기준으로 바로잡음:
// - 날짜는 서버 시각(오전 6시 기준)으로 맞추고, 실제 흐른 시간/하루 경과 시간보다 많이 늘 수 없고, 같은 날 줄일 수도 없음
// 반환: 의심 사유 목록(저장은 계속 진행)
export function normalizeToday(old, s, elapsedSec, now) {
  const day = dayKey(now), since = secSinceDayStart(now), flags = [];
  const prevSec = old && old.today && old.today.date === day ? old.today.sec : 0;
  const sameDay = s.today && s.today.date === day;
  const claimed = s.today && isNum(s.today.sec) && s.today.sec >= 0 ? s.today.sec : 0;
  const allowed = Math.min(since + 60, prevSec + elapsedSec * 1.25 + 60);
  let sec = Math.min(claimed, allowed);
  if (sameDay && claimed > allowed + 5) flags.push(`오늘 접속 시간 과다 ${Math.floor(claimed)}초 (허용 ${Math.floor(allowed)}초)`);
  if (sec < prevSec - 5) { flags.push('버닝 타임 초기화 의심'); sec = prevSec; }
  s.today = { date: day, sec };
  return flags;
}

// 반환: { fatal: [사유...], flags: [의심 사유...] }
// fatal 이 있으면 저장을 거부하고, flags 는 저장은 하되 운영자가 볼 수 있게 기록
export function validateSave(old, s, elapsedSec, now = Date.now()) {
  const fatal = [], flags = [];
  if (!s || typeof s !== 'object') return { fatal: ['저장 데이터가 올바르지 않아요'], flags };
  if (s.v !== 2) fatal.push('저장 버전이 달라요');
  if (!['dog', 'cat'].includes(s.animal)) fatal.push('캐릭터 정보가 올바르지 않아요');
  if (!CFG.enabledClasses.includes(s.weaponType)) fatal.push('직업 정보가 올바르지 않아요');
  if (old && old.animalLocked !== false && old.animal && s.animal !== old.animal) fatal.push('동물은 시즌이 시작될 때만 바꿀 수 있어요');
  if (old && old.animalLocked !== false && s.animalLocked === false) fatal.push('동물 선택 상태가 올바르지 않아요');
  for (const k of ['gold', 'playTime', 'region', 'round', 'level', 'exp']) if (!isNum(s[k]) || s[k] < 0) fatal.push(`${k} 값이 올바르지 않아요`);
  if (isNum(s.level) && (!Number.isInteger(s.level) || s.level < 1 || s.level > CFG.level.cap)) fatal.push('레벨 값이 올바르지 않아요');
  if (fatal.length) return { fatal, flags };

  const regions = CFG.regions.length;
  if (s.region < 1 || s.region > regions || s.round < 1 || s.round > CFG.roundsPerRegion) fatal.push('스테이지 값이 올바르지 않아요');
  if (!s.best || !isNum(s.best.region) || !isNum(s.best.round) || s.best.region > regions) fatal.push('최고 기록 값이 올바르지 않아요');
  if (!Array.isArray(s.inv) || s.inv.length > CFG.inv.max) fatal.push('보관함 값이 올바르지 않아요');
  if (!isNum(s.invCap) || s.invCap < CFG.inv.start || s.invCap > CFG.inv.max || (Array.isArray(s.inv) && s.inv.length > s.invCap)) fatal.push('보관함 크기가 올바르지 않아요');
  if (!s.equip || typeof s.equip !== 'object') fatal.push('장비 값이 올바르지 않아요');
  else for (const sl of SLOTS) {
    const it = s.equip[sl];
    if (it && (it.cls !== s.weaponType || it.slot !== sl || !isNum(it.grade) || it.grade < 0 || it.grade >= CFG.gradeNames.length || !isNum(it.enh) || it.enh < 0 || it.enh > (sl === 'weapon' ? CFG.enh.awaken.max : CFG.enh.max) || !CFG.classes[it.cls])) fatal.push('장비 값이 올바르지 않아요');
  }
  if (!s.perm || typeof s.perm !== 'object') fatal.push('영구 투자 값이 올바르지 않아요');
  else for (const k of Object.keys(CFG.perm.items)) { const v = s.perm[k]; if (!Number.isInteger(v) || v < 0 || v > CFG.perm.maxLv) { fatal.push('영구 투자 값이 올바르지 않아요'); break; } }
  for (const k of ['permPoints', 'pendingPoints']) if (!isNum(s[k]) || s[k] < 0 || !Number.isInteger(s[k])) fatal.push('영구 포인트 값이 올바르지 않아요');
  if (!Array.isArray(s.titles)) fatal.push('칭호 값이 올바르지 않아요');
  if (!s.endless || !Number.isInteger(s.endless.best) || s.endless.best < 0 || s.endless.best > 1000 || !isNum(s.endless.bestAt)) fatal.push('무한 모드 기록이 올바르지 않아요');
  const R = CFG.roulette;
  if (!Number.isInteger(s.tickets) || s.tickets < 0 || s.tickets > R.cap) fatal.push('룰렛 티켓 값이 올바르지 않아요');
  if (!s.buff || typeof s.buff !== 'object') fatal.push('룰렛 보너스 값이 올바르지 않아요');
  else for (const k of Object.keys(R.kinds)) { const b = s.buff[k]; if (!b || !isNum(b.sec) || b.sec < 0 || b.sec > 7200 || !isNum(b.mul) || b.mul < 1 || b.mul > 3) { fatal.push('룰렛 보너스 값이 올바르지 않아요'); break; } }
  if (!s.stats || !s.up || !Array.isArray(s.skillLv)) fatal.push('성장 값이 올바르지 않아요');
  else {
    for (const v of [...Object.values(s.stats), ...Object.values(s.up), ...s.skillLv]) if (!isNum(v) || v < 0 || v > 100000) { fatal.push('성장 수치가 올바르지 않아요'); break; }
  }
  if (fatal.length) return { fatal, flags };

  if (old) {
    // 플레이 시간은 실제 흐른 시간보다 많이 늘 수 없음 (접속 중에만 진행되는 게임)
    const dPlay = s.playTime - (old.playTime || 0);
    if (dPlay < -1) fatal.push('플레이 시간이 줄어들었어요');
    else if (dPlay > elapsedSec * 1.25 + 60) fatal.push('플레이 시간이 실제 시간보다 많아요');
    // 한 번에 지역을 두 개 이상 뛰어넘을 수 없음
    if (s.best.region > (old.best ? old.best.region : 1) + 1) fatal.push('진행도가 비정상적으로 빨라요');
    // 이번 시즌에 모은 포인트는 지역 클리어로만 늘고, 쓸 수 있는 포인트+투자한 포인트의 합은 시즌 중에 늘 수 없음
    const dClear = (s.clearedRegions || []).length - (old.clearedRegions || []).length;
    if ((s.pendingPoints || 0) - (old.pendingPoints || 0) > Math.max(0, dClear)) fatal.push('영구 포인트가 비정상적으로 늘었어요');
    if ((s.permPoints || 0) + permSpent(s.perm) > (old.permPoints || 0) + permSpent(old.perm || {})) fatal.push('영구 포인트 합계가 비정상적으로 늘었어요');
    // 룰렛: 티켓은 (하루 첫 접속 +1, 지역 첫 클리어 +1)로만 늘고, 보너스 시간은 쓴 티켓 수만큼만 늘 수 있음
    if (old.tickets !== undefined && old.buff) {
      const today = dayKey(now), bonus = old.ticketDay !== today ? 1 : 0, avail = Math.min(R.cap, old.tickets + bonus);
      if (s.tickets > avail) fatal.push('룰렛 티켓이 비정상적으로 늘었어요');
      const spins = Math.max(0, avail - s.tickets), maxSec = Math.max(...R.segments.map((g) => g.sec));
      // 광고: 하루 횟수 제한. 오늘 날짜로 늘어난 횟수만 보너스를 줄 수 있음
      const A = CFG.ads, adCount = s.ads && s.ads.date === today ? s.ads.count : 0;
      if (!s.ads || !Number.isInteger(s.ads.count) || s.ads.count < 0 || s.ads.count > A.perDay) fatal.push('광고 횟수 값이 올바르지 않아요');
      const adsUsed = Math.max(0, adCount - (old.ads && old.ads.date === today ? old.ads.count : 0));
      let inc = 0;
      for (const k of Object.keys(R.kinds)) inc += Math.max(0, s.buff[k].sec - Math.max(0, (old.buff[k] ? old.buff[k].sec : 0) - elapsedSec));
      if (inc > spins * maxSec + adsUsed * A.sec + 30) fatal.push('보너스 시간이 비정상적으로 늘었어요');
    }
    // 무한 모드 최고 층: 줄어들 수 없고, 칭호는 서버만 줌, 층이 늘었을 때는 엄격하게 검증
    const oe = (old.endless && old.endless.best) || 0;
    if (s.endless.best < oe) fatal.push('무한 모드 기록이 줄어들었어요');
    if (s.titles.length > (old.titles || []).length) fatal.push('칭호가 비정상적으로 늘었어요');
    if (!fatal.length && s.endless.best > oe) {
      const bad = checkEndlessClaim(old, s, elapsedSec);
      if (bad.length) { // 저장은 받되, 무한 모드 기록만 이전 값으로 되돌리고 운영자가 볼 수 있게 기록
        flags.push(`무한 모드 ${s.endless.best}층 기록 거부: ${bad.join(', ')}`);
        s.endless = { best: oe, bestAt: (old.endless && old.endless.bestAt) || 0 };
      }
    }
    // 레벨이 한 번에 많이 오르면 기록 (정상 플레이에서도 초반에는 빠르게 오르므로 거부하지는 않음)
    if (s.level - (old.level || 1) > 12) flags.push(`레벨 급증 ${old.level || 1} → ${s.level}`);
    // 골드가 시간에 비해 과도하게 늘면 일단 기록만 남김 (정확한 상한은 운영하며 조정)
    const dGold = s.gold - (old.gold || 0);
    if (dGold > Math.max(old.gold || 0, 1000) * 100) flags.push(`골드 급증 +${Math.floor(dGold)} / ${Math.floor(elapsedSec)}초`);
  }
  return { fatal, flags };
}


