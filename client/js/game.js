// 게임 로직 (화면/DOM과 무관). 브라우저와 Node 테스트 양쪽에서 동작합니다.
// 랜덤은 모두 rt.rng(시드 기반)을 사용 → 나중에 서버에서 같은 결과를 다시 계산(랭킹 검증)할 수 있게 준비.

// ---------- 유틸 ----------
function fmt(n) {
  n = Math.floor(n);
  if (n < 10000) return n.toLocaleString('en-US');
  const units = [['경', 1e16], ['조', 1e12], ['억', 1e8], ['만', 1e4]];
  for (const [u, v] of units) {
    if (n >= v) {
      const x = n / v;
      return (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2)) + u;
    }
  }
  return String(n);
}

function fmtTime(sec) {
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60);
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 하루의 기준: 한국 시간 오전 6시 (UTC+9에서 6시간을 뺀 UTC+3 달력). 컴퓨터 시간대와 무관
function dayKey(nowMs) {
  const d = new Date((nowMs === undefined ? Date.now() : nowMs) + 3 * 3600e3);
  return d.getUTCFullYear() + '-' + (d.getUTCMonth() + 1) + '-' + d.getUTCDate();
}
function secSinceDayStart(nowMs) { return ((nowMs === undefined ? Date.now() : nowMs) + 3 * 3600e3) % 86400e3 / 1000; }

// 버닝 타임: 오늘 접속 시간이 3시간이 되기 전까지 경험치/골드/드롭률 배율
function burnLeft(s) { return Math.max(0, CFG.burn.sec - (s.today ? s.today.sec : 0)); }
function burnMul(s) { return burnLeft(s) > 0 ? CFG.burn.mul : 1; }

// ---------- 영구 포인트 / 칭호 ----------
// 칭호 버프: 얻은 뒤 N시즌 동안만 적용 (칭호 자체는 계속 남음)
function titleActive(s, t) { return (s.season || 0) - (t.season || 0) < CFG.titleBuffSeasons; }
function titleBuff(s, key) { let v = 0; for (const t of (s.titles || [])) if (t.buff && t.buff[key] && titleActive(s, t)) v += t.buff[key]; return v; }
// 골드/드롭/경험치 영구 배율 = 1 + 영구 투자 + 칭호 버프
function permMul(s, key) { return 1 + ((s.perm && s.perm[key]) || 0) * CFG.perm.items[key].per + titleBuff(s, key); }
function permNextCost(s, key) { const lv = s.perm[key]; return lv >= CFG.perm.maxLv ? null : CFG.perm.costs[lv]; }
function permSpent(s) { let t = 0; for (const k of Object.keys(CFG.perm.items)) for (let i = 0; i < (s.perm[k] || 0); i++) t += CFG.perm.costs[i]; return t; }
function buyPerm(s, key) { const c = permNextCost(s, key); if (c === null || s.permPoints < c) return false; s.permPoints -= c; s.perm[key]++; return true; }
function resetPerm(s) { s.permPoints += permSpent(s); for (const k of Object.keys(CFG.perm.items)) s.perm[k] = 0; }
function rollDay(s) {
  const k = dayKey();
  if (!s.today || s.today.date !== k) s.today = { date: k, sec: 0 };
  if (!s.ads || s.ads.date !== k) s.ads = { date: k, count: 0 };
  if (s.ticketDay !== k) { s.ticketDay = k; s.tickets = Math.min(CFG.roulette.cap, (s.tickets || 0) + 1); }   // 매일 첫 접속 룰렛 티켓
}

// ---------- 저장 데이터 ----------
function newSave(animal, name, cls) {
  cls = CFG.classes[cls] ? cls : 'melee';
  const sv = {
    v: 2, animal: animal || 'dog', name: name || '모험가',
    gold: 0, level: 1, exp: 0, kills: 0, playTime: 0, today: { date: dayKey(), sec: 0 },
    lvUnit: CFG.lvUnit, autoStat: 1, gearPct: 1, nameV: 2, animalLocked: true, region: 1, round: 1, lock: false, lockFix: 1,   // lock=라운드 고정(직접 켠 경우만). lockFix: 예전 버전이 자동으로 켜 둔 고정을 한 번 풀었다는 표시
    best: { region: 1, round: 1 },
    clearedRegions: [], permPoints: 0, pendingPoints: 0,   // permPoints=지금 쓸 수 있는 포인트, pendingPoints=이번 시즌에 모은 포인트(다음 시즌에 사용 가능)
    perm: { atk: 0, hp: 0, mag: 0, gold: 0, drop: 0, exp: 0 }, titles: [],
    tickets: 1, ticketDay: dayKey(),   // 룰렛 티켓 (매일 첫 접속 +1)
    ads: { date: dayKey(), count: 0 }, // 오늘 본 보상형 광고 횟수
    buff: { exp: { sec: 0, mul: 1 }, gold: { sec: 0, mul: 1 }, drop: { sec: 0, mul: 1 } },   // 룰렛 보너스 (남은 시간은 접속 중에만 줄어듦)
    endless: { best: 0, bestAt: 0 },   // 무한 모드 이번 시즌 최고 층과 도달 시각(ms)
    reward: null,                      // 지난 시즌 랭킹 보상 알림 (서버가 시즌 전환 때 넣고, 화면에서 보여준 뒤 지움)
    stats: { hp: 0, atk: 0, mag: 0, def: 0, spd: 0 },
    up: { gold: 0, drop: 0 },
    skillLv: [0, 0, 0, 0],
    weaponType: cls,
    equip: { weapon: null, hat: null, armor: null, ring: null },
    inv: [], invCap: CFG.inv.start, nextUid: 1, autoSalvage: -1,
    bossManual: false, miniClick: true,
  };
  sv.equip.weapon = makeItem(sv, 'weapon', 0, 1, cls); // 시작 무기
  return sv;
}

function mergeSave(raw) {
  const base = newSave(raw.animal, raw.name, raw.weaponType);
  const needLockFix = !raw.lockFix;
  const out = Object.assign(base, raw);
  if (needLockFix) { out.lock = false; out.lockFix = 1; }   // 예전 버전이 쓰러질 때 자동으로 켠 '라운드 고정'을 한 번 풀어 줌
  for (const k of ['stats', 'up', 'equip', 'best', 'perm', 'endless', 'buff', 'ads']) out[k] = Object.assign(base[k], raw[k] || {});
  if (!Array.isArray(out.titles)) out.titles = [];
  if (!raw.gearPct) {   // 장비 성능이 지역별 고정 수치였던 옛 저장: 등급 기준 비율 방식으로 다시 계산
    for (const it of out.inv.concat(CFG.slots.map((sl) => out.equip[sl]).filter(Boolean))) it.opts = makeItem({ nextUid: 0 }, it.slot, it.grade, it.region, it.cls).opts;
    out.gearPct = 1;
  }
  if ((raw.nameV | 0) < 2) {   // 장비 이름 체계가 바뀌기 전의 저장: 이름을 새 방식으로 다시 붙임
    for (const it of out.inv.concat(CFG.slots.map((sl) => out.equip[sl]).filter(Boolean))) it.name = itemName(it.slot, it.grade, it.cls, it.uid);
    out.nameV = 2;
  }
  if (!(out.invCap >= CFG.inv.start)) out.invCap = CFG.inv.start;   // 기본 보관함이 늘어난 경우 옛 저장도 맞춰 줌
  if (!raw.lvUnit) {   // 성장 레벨을 묶음 단위로 바꾸기 전 저장 데이터: 레벨을 묶음으로 줄이고, 남는 레벨의 비용은 골드로 돌려줌
    const U = CFG.lvUnit, L = CFG.legacyCost;
    const conv = (v, t) => { const n = Math.floor(v / U); for (let lv = n * U; lv < v; lv++) out.gold += costOf(t, lv); return n; };
    for (const k of Object.keys(out.stats)) out.stats[k] = conv(out.stats[k], L[k]);
    out.up.gold = conv(out.up.gold, L.gold); out.up.drop = conv(out.up.drop, L.drop);
    out.skillLv = out.skillLv.map((v) => conv(v, L.skill));
    out.lvUnit = U;
  }
  if (!raw.autoStat) {   // 능력치/스킬을 골드로 사던 시절의 저장 데이터: 투자한 골드를 전액 돌려주고 레벨 기반 자동 성장으로 전환
    out.gold += investedGold(out);
    out.stats = { hp: 0, atk: 0, mag: 0, def: 0, spd: 0 }; out.skillLv = [0, 0, 0, 0];
    out.autoStat = 1;
  }
  // v1 저장 데이터 이전: 장비에 직업/강화/고유번호 부여
  if ((raw.v || 1) < 2) {
    for (const slot of CFG.slots) {
      const it = out.equip[slot];
      if (it) { it.uid = out.nextUid++; it.cls = 'melee'; it.enh = (raw.enh && raw.enh[slot]) || 0; }
    }
    delete out.enh;
    out.v = 2;
  }
  rollDay(out);
  return out;
}

// ---------- 능력치 계산 ----------
// 골드 투자 레벨 → 효과. 레벨마다 복리로 커져서(필요 골드도 복리로 커짐) 후반에도 골드가 의미를 가짐
function lvVal(lv) { const g = CFG.statGrowth; return (Math.pow(g, lv) - 1) / (g - 1); }
function lvLin(lv) { return lv * (1 + lv / CFG.statCurve); }  // 신속처럼 폭주하면 안 되는 능력치용
function autoLv(pts, L) {   // 꼭짓점 목록을 직선으로 이어 L(캐릭터 레벨)에 해당하는 값을 구함
  L = Math.max(pts[0][0], Math.min(pts[pts.length - 1][0], L || 1));
  for (let i = 1; i < pts.length; i++) if (L <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + (y1 - y0) * (L - x0) / (x1 - x0); }
  return pts[pts.length - 1][1];
}
function skillLevelOf(s) { return autoLv(CFG.autoStat.skill, s.level); }
// 가격은 100, 150, 200, 300, 500, 800, 1000 처럼 딱 떨어지는 값으로 맞춤 (1, 1.5, 2, 3, 4, 5, 6, 8 x 10의 거듭제곱 중 가장 가까운 값)
const NICE_STEPS = [1, 1.5, 2, 3, 4, 5, 6, 8, 10];
function niceNum(v) {
  if (!(v >= 10)) return Math.max(1, Math.round(v));
  const p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p;
  let best = NICE_STEPS[0], bd = Infinity;
  for (const n of NICE_STEPS) { const d = Math.abs(Math.log(m / n)); if (d < bd) { bd = d; best = n; } }
  return Math.round(best * p);
}
function costOf(table, lv) { return niceNum(table[0] * Math.pow(table[1], lv)); }
function isBoss(round) { return round === CFG.roundsPerRegion; }

function calcStats(s) {
  const P = CFG.player, per = CFG.statPer, st = s.stats;
  const U = CFG.lvUnit;   // 성장 1레벨 = 옛 U레벨 효과
  const gm = autoLv(CFG.autoStat.main, s.level) * U, gs = autoLv(CFG.autoStat.spd, s.level) * U;   // 능력치는 캐릭터 레벨로 자동 성장
  let hp = P.hp + lvVal(gm) * per.hp;
  let atk = P.atk + lvVal(gm) * per.atk;
  let mag = P.mag + lvVal(gm) * per.mag;
  let def = P.def + lvVal(gm) * per.def;
  let spdB = lvLin(gs) * per.spd;
  const lv = (s.level || 1) - 1; // 캐릭터 레벨 보너스 (고정 수치)
  hp += lv * CFG.level.hp; atk += lv * CFG.level.atk; mag += lv * CFG.level.mag;
  const pm = s.perm || {}, PI = CFG.perm.items; // 영구 포인트 투자 (고정 수치)
  hp += (pm.hp || 0) * PI.hp.per; atk += (pm.atk || 0) * PI.atk.per; mag += (pm.mag || 0) * PI.mag.per;
  let gH = 0, gA = 0, gM = 0, gD = 0;   // 장비: 능력치에 곱해지는 비율의 합 (등급·강화에 따라 커짐)
  for (const slot of CFG.slots) {
    const it = s.equip[slot];
    if (!it) continue;
    const m = enhMul(it), o = it.opts;
    gH += (o.hp || 0) * m; gA += (o.atk || 0) * m; gM += (o.mag || 0) * m; gD += (o.def || 0) * m; spdB += (o.spd || 0) * m;
  }
  hp *= 1 + gH; atk *= 1 + gA; mag *= 1 + gM; def *= 1 + gD;
  const ci = CFG.classInfo[s.weaponType];
  const cm = autoLv(ci.curve, s.level); atk *= cm; mag *= cm; hp *= Math.sqrt(cm);   // 직업별 성장 곡선: 레벨에 따라 공격력/마력(체력은 제곱근) 배율이 달라짐
  const ab = 1 + awakenBonus(s.equip.weapon); atk *= ab; mag *= ab;   // 무기 각성: 최종 공격력/마력 배율
  hp *= ci.hp; // 직업별 체력 배율 (전사 튼튼, 궁수/마법사 약함)
  const ap = animalPassive(s); if (ap && ap.hpMul) hp *= ap.hpMul;   // 동물 패시브
  hp *= weaponTrait(s).hpMul || 1;   // 전설 무기 특성
  const spd = P.spd * (1 + spdB);
  const main = ci.stat === 'mag' ? mag : atk;
  return { hp, atk, mag, def, spd, main, plain: main * ci.plain };
}

function monStats(region, round) {
  const M = CFG.mon, T = CFG.tune, boss = isBoss(round), rg = region - 1, rd = round - 1;
  const t = (k) => (T && T[k] && T[k][rg]) || 1;
  return {
    boss,
    hp: M.hp * Math.pow(M.hpRegion, rg) * Math.pow(M.hpRound, rd) * (boss ? M.bossHp : 1) * t('hp'),
    atk: M.atk * Math.pow(M.atkRegion, rg) * Math.pow(M.atkRound, rd) * (boss ? M.bossAtk : 1) * t('atk'),
    gold: M.gold * Math.pow(M.goldRegion, rg) * Math.pow(M.goldRound, rd) * (boss ? M.bossGold : 1) * t('gold'),
    exp: CFG.exp.base * Math.pow(CFG.exp.region, rg) * Math.pow(CFG.exp.round, rd) * (boss ? CFG.exp.boss : 1) * t('exp'),
  };
}

// ---------- 무한 모드 ----------
function isEndlessBoss(floor) { return floor % CFG.endless.bossEvery === 0; }
function endlessMon(floor) {
  const E = CFG.endless, M = CFG.mon, base = monStats(1, 5), boss = isEndlessBoss(floor);
  // 기본 곡선(층마다 배율)은 처음부터 어려워서, 초반 층(rampFloor까지)은 1지역 몬스터에서 시작해 곡선에 부드럽게 이어지게 함
  const val = (b, k, per) => {
    const curve = (f) => b * k * Math.pow(per, f - 1), at = curve(E.rampFloor), b0 = b * E.rampStart;
    return Math.min(curve(floor), b0 * Math.pow(at / b0, (floor - 1) / (E.rampFloor - 1)));
  };
  return {
    boss, gold: 0, exp: 0,
    hp: val(base.hp, E.baseHp, E.hpPer) * (boss ? M.bossHp : 1),
    atk: val(base.atk, E.baseAtk, E.atkPer) * (boss ? M.bossAtk : 1),
  };
}
// 화면에 보여줄 지역(배경/몬스터 색): 무한 모드는 5층마다 다음 나라로 바뀜
function stageRegion(rt) { return rt.endless ? Math.floor((rt.endless.floor - 1) / 5) % CFG.regions.length + 1 : rt.save.region; }
function curBoss(rt) { return rt.endless ? isEndlessBoss(rt.endless.floor) : isBoss(rt.save.round); }
function needKillsRt(rt) { return curBoss(rt) ? 1 : (rt.endless ? CFG.endless.monsters : CFG.monstersPerRound); }

function startEndless(rt) {
  rt.endless = { floor: 1 };
  rt.hp = rt.d.hp; rt.cd = [0, 0, 0, 0]; resetRound(rt);
  msg(rt, '무한 모드 시작! 죽거나 시간이 지나면 1층부터 다시 시작해요. 골드와 경험치는 얻지 못해요.', 'ok');
}
function exitEndless(rt) {
  rt.endless = null;
  rt.hp = rt.d.hp; rt.cd = [0, 0, 0, 0]; resetRound(rt);
  msg(rt, '무한 모드를 마치고 스토리 사냥으로 돌아왔어요.', 'ok');
}

// 이 능력치로 floor 층을 깰 수 있는지 (서버 검증용): 새로 시작한 상태에서, 보스 약점을 항상 맞추는 가장 유리한 조건으로 시뮬레이션
function endlessFeasible(save, floor) {
  const sv = JSON.parse(JSON.stringify(save)); sv.bossManual = false;
  const rt = createRuntime(sv, 12345);
  rt.endless = { floor }; rt.optimistic = true; rt.slack = 0.8; // 몬스터 체력 20% 여유
  resetRound(rt);
  const maxSteps = Math.ceil((CFG.endless.floorTime + 5) / 0.05);
  for (let i = 0; i < maxSteps; i++) {
    step(rt, 0.05);
    if (rt.endless.floor > floor) return true;
    if (rt.endlessFailed) return false;
  }
  return false;
}

// ---------- 레벨 ----------
function expNeed(level) { return Math.floor(CFG.level.need[0] * level * level + CFG.level.need[1]); }
function skillOpen(s, i) { const sk = skillList(s)[i]; return !!sk && (s.level || 1) >= sk.unlock; }

// ---------- 장비 ----------
function makeItem(s, slot, grade, region, cls) {
  const opts = {};
  for (const [k, v] of Object.entries(CFG.slotBase[slot])) opts[k] = v * CFG.gradeMul[grade];   // 지역과 무관: 등급으로만 결정
  const uid = s.nextUid++;
  return { uid, slot, grade, region, cls, enh: 0, opts, name: itemName(slot, grade, cls, uid) };
}
// 장비 번호로 고정된 무작위 선택 (같은 장비는 항상 같은 이름/전설)
function pickByUid(arr, uid) {
  let h = Math.imul(uid ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return arr[(h >>> 0) % arr.length];
}
function legendOf(it) { return it && it.slot === 'weapon' && it.grade === 4 && CFG.legendWeapons[it.cls] ? pickByUid(CFG.legendWeapons[it.cls], it.uid) : null; }
function itemName(slot, grade, cls, uid) {
  if (slot === 'weapon' && grade === 4 && CFG.legendWeapons[cls]) return pickByUid(CFG.legendWeapons[cls], uid).name;
  return `${pickByUid(CFG.namePrefix[grade], uid)} ${CFG.itemNouns[cls][slot]}`;
}
function weaponTrait(s) { const l = legendOf(s.equip.weapon); return l ? l.trait : {}; }

// 강화를 반영한 전투력 점수 (비교용)
function itemScore(it) {
  if (!it) return 0;
  const o = it.opts;
  const base = (o.atk || 0) + (o.mag || 0) + (o.hp || 0) * 0.7 + (o.def || 0) * 0.7 + (o.spd || 0) * 5;
  return base * enhMul(it);
}

function itemDesc(it) {
  const m = enhMul(it);
  const n = { atk: '공격력', mag: '마력', hp: '체력', def: '방어력', spd: '신속' };
  const lg = legendOf(it);
  return Object.entries(it.opts).map(([k, v]) => `${n[k]} +${(v * m * 100).toFixed(k === 'spd' ? 1 : 0)}%`).join(' · ') + (lg ? `<br>✦ ${lg.desc}` : '');
}

function rollGrade(rt, region, boss) {
  // 아직 해금되지 않은 등급은 나오지 않음. 보스는 높은 등급 쪽으로 조금 치우침
  const shift = boss ? 1.2 : 0;
  const w = CFG.gradeWeights.map((x, g) => (region >= CFG.gradeUnlock[g] ? x * Math.pow(1 + shift, g) : 0));
  let r = rt.rng() * w.reduce((a, b) => a + b, 0);
  for (let g = 0; g < w.length; g++) { r -= w[g]; if (r <= 0) return g; }
  return 0;
}

function salvageValue(it) {
  return niceNum(monStats(it.region, 5).gold * CFG.salvageMul[it.grade]);
}

function pickRandom(rt, arr) { return arr[Math.floor(rt.rng() * arr.length)]; }

// 새 장비 획득: 빈 부위면 자동 장착, 아니면 보관함. 가득 차거나 자동분해 대상이면 바로 분해
function addItem(rt, item, force) {
  const s = rt.save, gn = CFG.gradeNames[item.grade], tag = `[${gn}] ${item.name}`;
  if (!s.equip[item.slot] && item.cls === s.weaponType) {
    s.equip[item.slot] = item; refresh(rt);
    msg(rt, `${tag} 획득! 빈 부위라 장착했습니다.`, 'g' + item.grade);
    return;
  }
  if (!force && (item.grade <= s.autoSalvage || s.inv.length >= s.invCap)) {
    const g = salvageValue(item); s.gold += g;
    msg(rt, `${tag} 자동 분해 +${fmt(g)}G${s.inv.length >= s.invCap ? ' (보관함 가득)' : ''}`, 'sold');
    return;
  }
  s.inv.push(item);
  msg(rt, `${tag} 획득`, 'g' + item.grade);
  if (item.grade >= 3) rt.happyAt = rt.clock;
  sfx(rt, item.grade >= 2 ? 'rare' : 'drop');
}

function equipItem(rt, uid) {
  const s = rt.save, i = s.inv.findIndex((x) => x.uid === uid);
  if (i < 0) return false;
  const it = s.inv[i];
  if (it.cls !== s.weaponType) return false;
  const old = s.equip[it.slot];
  s.equip[it.slot] = it;
  s.inv.splice(i, 1);
  if (old) s.inv.push(old);
  refresh(rt);
  return true;
}

// 착용 해제: 보관함에 자리가 있을 때만
function unequipItem(rt, slot) {
  const s = rt.save, it = s.equip[slot];
  if (!it || s.inv.length >= s.invCap) return false;
  s.inv.push(it); s.equip[slot] = null;
  refresh(rt);
  return true;
}

function equipBest(rt) {
  const s = rt.save;
  for (const slot of CFG.slots) {
    let best = null, bestScore = itemScore(s.equip[slot]);
    for (const it of s.inv) if (it.slot === slot && it.cls === s.weaponType && itemScore(it) > bestScore) { best = it; bestScore = itemScore(it); }
    if (best) equipItem(rt, best.uid);
  }
}

function salvageItem(rt, uid) {
  const s = rt.save, i = s.inv.findIndex((x) => x.uid === uid);
  if (i < 0) return 0;
  const g = salvageValue(s.inv[i]);
  s.inv.splice(i, 1); s.gold += g;
  return g;
}

function salvageUpTo(rt, grade) {
  const s = rt.save;
  let total = 0;
  for (const it of s.inv.slice()) if (it.grade <= grade) total += salvageItem(rt, it.uid);
  return total;
}

function mergeCount(s, slot, grade) {
  let n = 0;
  for (const it of s.inv) if (it.slot === slot && it.grade === grade) n++;
  return n;
}
function canMergeGrade(grade) { return grade + 1 <= CFG.merge.maxResultGrade; }   // 합성은 등급 해금과 상관없이 가능(재료 10개가 워낙 많이 필요해서 자연히 늦어짐)

// 같은 부위 + 같은 등급 N개 → 한 단계 위 등급 장비 1개 (부위/직업 랜덤, 무기 제외, 강화 소멸)
function mergeGroup(rt, slot, grade) {
  const s = rt.save, need = CFG.merge.need;
  if (!canMergeGrade(grade, s) || mergeCount(s, slot, grade) < need) return false;
  const pool = s.inv.filter((x) => x.slot === slot && x.grade === grade)
    .sort((a, b) => (a.enh - b.enh) || (itemScore(a) - itemScore(b))).slice(0, need);
  const ids = new Set(pool.map((x) => x.uid));
  const region = Math.max(CFG.gradeUnlock[grade + 1], ...pool.map((x) => x.region));
  s.inv = s.inv.filter((x) => !ids.has(x.uid));
  const item = makeItem(s, pickRandom(rt, CFG.merge.resultSlots), grade + 1, region, pickRandom(rt, CFG.enabledClasses));
  addItem(rt, item, true);
  msg(rt, `합성 성공! [${CFG.gradeNames[grade + 1]}] ${item.name}`, 'ok');
  rt.happyAt = rt.clock;
  return true;
}

function mergeAll(rt) {
  let n = 0, again = true;
  while (again) {
    again = false;
    for (const slot of CFG.slots) for (let g = 0; canMergeGrade(g, rt.save); g++) {
      if (mergeGroup(rt, slot, g)) { n++; again = true; }
    }
  }
  return n;
}

function buyInvCap(s) {
  if (s.invCap >= CFG.inv.max) return false;
  const c = costOf(CFG.inv.cost, (s.invCap - CFG.inv.start) / CFG.inv.step);
  if (s.gold < c) return false;
  s.gold -= c; s.invCap = Math.min(CFG.inv.max, s.invCap + CFG.inv.step);
  return true;
}
function invCapCost(s) { return costOf(CFG.inv.cost, (s.invCap - CFG.inv.start) / CFG.inv.step); }

// ---------- 구매 ----------
function planBuy(costFn, lv, qty, gold, cap) {
  let n = 0, total = 0;
  const limit = qty === 'max' ? 1000 : qty;
  while (n < limit && (cap === undefined || lv + n < cap)) {
    const c = costFn(lv + n);
    if (total + c > gold) break;
    total += c; n++;
  }
  return { n, total };
}

function buyStat(s, key, qty) {
  const p = planBuy((lv) => costOf(CFG.statCost[key], lv), s.stats[key], qty, s.gold);
  s.gold -= p.total; s.stats[key] += p.n; return p.n;
}
function buyUp(s, key, qty) {
  const p = planBuy((lv) => costOf(CFG[key + 'Up'].cost, lv), s.up[key], qty, s.gold);
  s.gold -= p.total; s.up[key] += p.n; return p.n;
}
// 일반 강화 배율(+10까지 단계마다 +20%). 무기 +11 이후는 별도의 '각성' 보너스를 씀
function enhMul(it) { return 1 + Math.min(it.enh, CFG.enh.max) * CFG.enh.per; }
function enhMax(it) { return it.slot === 'weapon' ? CFG.enh.awaken.max : CFG.enh.max; }
function awakenBonus(it) { return it && it.slot === 'weapon' && it.enh > CFG.enh.max ? CFG.enh.awaken.bonus[it.enh - CFG.enh.max - 1] : 0; }
// +10 -> +11 처럼 n(11~15)강으로 올리는 도전 1회 비용: 공격력 스탯 refLevel레벨 가격의 일정 배수
function awakenCost(n) { const A = CFG.enh.awaken; return niceNum(A.base * A.costMul[n - CFG.enh.max - 1]); }
// 지금 도전의 성공 확률 (기본 확률 + 연속 실패 보너스)
function awakenChance(w) { const A = CFG.enh.awaken; return Math.min(1, A.chance[w.enh + 1 - CFG.enh.max - 1] + Math.min(A.pityMax, (w.pity || 0) * A.pityStep)); }
// 무기 각성 도전. 결과: { ok:false, reason } 또는 { ok:true, success, from, to, cost }
function tryAwaken(rt) {
  const s = rt.save, w = s.equip.weapon, A = CFG.enh.awaken;
  if (!w) return { ok: false, reason: '무기가 없어요.' };
  if (w.enh < CFG.enh.max) return { ok: false, reason: `일반 강화를 +${CFG.enh.max}까지 먼저 올려 주세요.` };
  if (w.enh >= A.max) return { ok: false, reason: '이미 최대 각성이에요.' };
  const n = w.enh + 1, cost = awakenCost(n);
  if (s.gold < cost) return { ok: false, reason: '골드가 부족해요.' };
  s.gold -= cost;
  const from = w.enh, success = rt.rng() < awakenChance(w);
  if (success) { w.enh = n; w.pity = 0; }
  else { w.pity = (w.pity || 0) + 1; if (n >= A.dropFrom) { w.enh = from - 1; } }
  refresh(rt);
  msg(rt, success ? `무기 각성 성공! +${from} → +${n}` : `무기 각성 실패... ${n >= A.dropFrom ? `+${from} → +${w.enh}` : `+${from} 유지`}`, success ? 'ok' : 'bad');
  sfx(rt, success ? 'win' : 'fail');
  if (success) rt.happyAt = rt.clock;
  return { ok: true, success, from, to: w.enh, cost };
}

function enhCostFn(it) {
  // 강화 가격은 장비 등급이 처음 나오는 지역의 수입 수준에 맞춰짐 (지역이 아니라 등급 기준)
  return (lv) => niceNum(costOf(CFG.enh.cost, lv) * Math.pow(CFG.itemScale, CFG.gradeUnlock[it.grade] - 1));
}
function buyEnh(s, slot, qty) {
  const it = s.equip[slot];
  if (!it) return 0;
  const p = planBuy(enhCostFn(it), it.enh, qty, s.gold, CFG.enh.max);   // 일반 강화는 +10까지 (그 이상은 무기 각성)
  s.gold -= p.total; it.enh += p.n; return p.n;
}
function buySkill(s, i, qty) {
  const p = planBuy((lv) => costOf(CFG.skillUp.cost, lv), s.skillLv[i], qty, s.gold);
  s.gold -= p.total; s.skillLv[i] += p.n; return p.n;
}

// ---------- 런타임(전투 상태) ----------
function createRuntime(save, seed) {
  const rt = {
    save, d: calcStats(save), hp: 0, enemies: [], kills: 0, spawned: 0, spawnT: 0,
    rng: makeRng(seed === undefined ? Math.floor(Math.random() * 4294967296) : seed),
    atkT: 0, cd: [0, 0, 0, 0], bossClock: 0, bossLeft: CFG.bossTime, weak: false,
    gainLog: [], clock: 0, scroll: 0, fx: [], proj: [], ev: [], msgs: [], hitAt: -1, castAt: -1, hurtAt: -1, happyAt: -10, cdMax: [1, 1, 1, 1],
  };
  rt.hp = rt.d.hp;
  rt.burnEnded = !!(save.today && save.today.sec >= CFG.burn.sec);
  resetRound(rt);
  if (!save.kills && !save.playTime) msg(rt, '환영해요! 몬스터를 잡아 골드를 모으고, 성장 탭에서 체력과 공격력을 올려 보세요.', 'ok');
  return rt;
}

function refresh(rt) {
  const ratio = rt.d.hp > 0 ? rt.hp / rt.d.hp : 1;
  rt.d = calcStats(rt.save);
  rt.hp = Math.min(rt.d.hp, rt.d.hp * ratio);
}

function resetRound(rt) {
  rt.enemies = []; rt.kills = 0; rt.spawned = 0; rt.spawnT = 0.3;
  rt.bossClock = 0; rt.bossLeft = CFG.bossTime; rt.weak = false; rt.bossSkillUsed = false; rt.floorClock = 0;
  rt.gs = {}; rt.poison = null; rt.silenceLeft = 0; rt.shielded = false; rt.reflecting = false; rt.gimMsg = '';
}

// 소리 사건 기록 (화면에서만 사용). 너무 많이 쌓이지 않게 제한
function sfx(rt, name) { if (rt.ev.length < 16) rt.ev.push(name); }

function msg(rt, text, cls) {
  rt.msgs.push({ text, cls: cls || '' });
  if (rt.msgs.length > 40) rt.msgs.shift();
}
function fx(rt, x, text, color) {
  rt.fx.push({ x, text, color, born: rt.clock });
  if (rt.fx.length > 24) rt.fx.shift();
}

function skillList(s) { return CFG.skills[s.weaponType]; }

// 동물 고유 패시브 (레벨 조건을 만족할 때만)
function animalPassive(s) { const a = CFG.animalSkills[s.animal]; return a && (s.level || 1) >= a.unlock ? a : null; }
function playerRange(s) { return CFG.classInfo[s.weaponType].range; }
function needKills(s) { return isBoss(s.round) ? 1 : CFG.monstersPerRound; }

function spawn(rt) {
  const s = rt.save, m = rt.endless ? endlessMon(rt.endless.floor) : monStats(s.region, s.round);
  if (rt.slack) m.hp *= rt.slack;
  rt.enemies.push({
    x: CFG.spawnX, hp: m.hp, maxhp: m.hp, atk: m.atk, gold: m.gold, exp: m.exp, boss: m.boss,
    speed: CFG.mon.speed * (m.boss ? 0.8 : 1), stop: m.boss ? CFG.stopBoss : CFG.stopNormal,
    interval: m.boss ? 1.6 : 1.2, cd: 0.6, flash: -1, seed: rt.rng() * 6.28,
  });
  rt.spawned++;
}

function dealDamage(rt, e, dmg, label) {
  const C = CFG.boss;
  let mul = 1;
  if (e.boss) {
    if (rt.weak) mul *= C.weakMul;
    mul *= 1 + (weaponTrait(rt.save).bossDmg || 0);   // 전설 무기: 보스 피해
    if (e.hp / e.maxhp <= C.lowHp) mul *= C.lowMul;
  }
  if (e.boss && rt.shielded && !rt.weak) mul *= rt.shieldMul;       // 방어막: 약점이 드러났을 때만 제대로 들어감
  dmg = dmg * mul * (0.92 + rt.rng() * 0.16);
  e.hp -= dmg; e.flash = rt.clock;
  if (e.boss && rt.reflecting) rt.hp -= dmg * rt.reflectPct;         // 반사: 준 피해의 일부를 되돌려 받음
  fx(rt, e.x, (label ? label + ' ' : '') + fmt(dmg), mul > 1 ? '#ff6a6a' : (label ? '#ffd35a' : '#ffffff'));
}

function nearest(rt, range) {
  let t = null;
  for (const e of rt.enemies) if (e.x <= range && (!t || e.x < t.x)) t = e;
  return t;
}

function skillDamage(rt, i) {
  const sk = skillList(rt.save)[i];
  return rt.d.main * CFG.classInfo[rt.save.weaponType].skill * sk.mult * (1 + CFG.skillUp.per * skillLevelOf(rt.save));
}

// 날아가는 연출 기록 (화면에서만 사용, 피해는 즉시 적용)
function proj(rt, type, x, extra) {
  rt.proj.push(Object.assign({ type, x, born: rt.clock }, extra || {}));
  if (rt.proj.length > 20) rt.proj.shift();
}

// 스킬 사용 (자동/수동 공통). 사용 불가면 false
function castSkill(rt, i) {
  const s = rt.save, sk = skillList(s)[i];
  if (!sk || rt.cd[i] > 0 || !skillOpen(s, i) || rt.silenceLeft > 0) return false;
  const target = nearest(rt, sk.range);
  if (!target) return false;
  const dmg = skillDamage(rt, i), hits = sk.hits || 1;
  if (sk.fx) proj(rt, sk.fx, target.x, { hits });
  for (let h = 0; h < hits; h++) {
    if (sk.aoe) { for (const e of rt.enemies.slice()) { if (e.x <= sk.range) dealDamage(rt, e, dmg, h === 0 ? sk.name : ''); } }
    else dealDamage(rt, target, dmg, h === 0 ? sk.name : '');
  }
  const cdv = sk.cd * (1 - (weaponTrait(s).cdr || 0));   // 전설 무기: 쿨타임 감소
  rt.cd[i] = cdv; rt.cdMax[i] = cdv; rt.castAt = rt.clock; rt.hitAt = rt.clock; sfx(rt, 'skill');
  collectDead(rt);
  return true;
}

// 보스 전용 스킬: 보스전 중 한 번만. 보스 약점이 드러났을 때 쓰면 피해 x약점 배율
function bossSkillOf(s) { return CFG.bossSkills[s.weaponType]; }
function bossSkillReady(rt) {
  const s = rt.save, b = bossSkillOf(s);
  return !!b && !rt.endless && !!curBoss(rt) && !rt.bossSkillUsed && s.level >= b.unlock;
}
function castBossSkill(rt) {
  if (!bossSkillReady(rt)) return false;
  const s = rt.save, b = bossSkillOf(s), boss = rt.enemies.find((e) => e.boss);
  if (!boss) return false;
  const dmg = rt.d.main * CFG.classInfo[s.weaponType].skill * b.mult * (1 + CFG.skillUp.per * skillLevelOf(s));
  if (b.fx) proj(rt, b.fx, boss.x, { hits: b.hits });
  for (let h = 0; h < b.hits; h++) dealDamage(rt, boss, dmg, h === 0 ? b.name : '');
  rt.bossSkillUsed = true; rt.castAt = rt.clock; rt.hitAt = rt.clock; sfx(rt, 'skill');
  collectDead(rt);
  return true;
}

// ---------- 직업(무기) 교체 ----------
// 스탯/스킬에 투자한 골드 합계 (교체 시 일부 환급 대상)
function investedGold(s) {
  let total = 0;   // 능력치/스킬은 이제 골드로 사지 않으므로 보통 0 (옛 저장의 잔여분만 계산)
  for (const k of Object.keys(CFG.statCost)) for (let lv = 0; lv < s.stats[k]; lv++) total += costOf(CFG.statCost[k], lv);
  for (const n of s.skillLv) for (let lv = 0; lv < n; lv++) total += costOf(CFG.skillUp.cost, lv);
  return total;
}

// 지금까지 골드로 사들인 모든 것의 합계 (서버가 '벌 수 있는 골드' 한도와 견주어 조작을 가려내는 용도)
function investedAll(s) {
  let t = investedGold(s);
  for (let lv = 0; lv < s.up.gold; lv++) t += costOf(CFG.goldUp.cost, lv);
  for (let lv = 0; lv < s.up.drop; lv++) t += costOf(CFG.dropUp.cost, lv);
  for (const it of s.inv.concat(CFG.slots.map((sl) => s.equip[sl]).filter(Boolean))) {
    const f = enhCostFn(it);
    for (let lv = 0; lv < Math.min(it.enh, CFG.enh.max); lv++) t += f(lv);
    for (let n = CFG.enh.max + 1; n <= it.enh; n++) t += awakenCost(n);
  }
  for (let c = CFG.inv.start; c < s.invCap; c += CFG.inv.step) t += costOf(CFG.inv.cost, (c - CFG.inv.start) / CFG.inv.step);
  return t;
}
// 지금까지 처치 수로 벌 수 있었던 골드의 넉넉한 상한 (버닝 x3, 영구/칭호 배율, 분해 수입 감안)
function goldCeiling(s) {
  const r = Math.min(CFG.regions.length, Math.max(1, s.best.region));
  return (s.kills || 0) * monStats(r, CFG.roundsPerRegion).gold * 4 + 1000;
}

// 교체 미리보기: 환급액, 보관함으로 돌아갈 장비 수, 불가 사유
function swapPreview(s, cls) {
  if (!CFG.enabledClasses.includes(cls) || cls === s.weaponType) return { ok: false, reason: '이미 이 직업이에요.' };
  const mismatched = CFG.slots.filter((sl) => s.equip[sl] && s.equip[sl].cls !== cls).length;
  // 직업 변경 비용: 초보(캐릭터 Lv.freeUntil 미만)는 무료, 그 뒤로는 도달한 지역에 비례한 골드를 내야 함
  const fee = s.level < CFG.swap.freeUntil ? 0 : niceNum(monStats(Math.max(1, s.best.region), 5).gold * CFG.swap.feeMul);
  const space = s.invCap - s.inv.length;
  if (mismatched > space) return { ok: false, reason: `보관함이 부족해요. ${mismatched - space}칸을 비워 주세요.`, mismatched, fee };
  if (s.gold < fee) return { ok: false, reason: `직업을 바꾸려면 ${fmt(fee)}G가 필요해요.`, mismatched, fee };
  return { ok: true, fee, mismatched };
}

function switchClass(rt, cls) {
  const s = rt.save, pv = swapPreview(s, cls);
  if (!pv.ok) return pv;
  // 1) 현재 직업 장비를 보관함으로
  for (const sl of CFG.slots) { const it = s.equip[sl]; if (it && it.cls !== cls) { s.inv.push(it); s.equip[sl] = null; } }
  // 2) 변경 비용 지불 (골드 획득량/드롭률/보관함은 유지, 직업 장비의 강화는 그 직업 장비에 남음)
  s.gold -= pv.fee;
  s.weaponType = cls;
  // 3) 새 직업 장비 중 좋은 것 장착, 무기가 없으면 기본 무기 지급
  equipBest(rt);
  if (!s.equip.weapon) s.equip.weapon = makeItem(s, 'weapon', 0, 1, cls);
  rt.cd = [0, 0, 0, 0]; rt.enemies = []; rt.spawned = 0; rt.kills = 0;
  refresh(rt);
  rt.hp = rt.d.hp;
  msg(rt, `${CFG.classInfo[cls].title}(으)로 바꿨어요!${pv.fee ? ` (${fmt(pv.fee)}G 사용)` : ''}`, 'ok');
  return { ok: true, fee: pv.fee };
}

function collectDead(rt) {
  const s = rt.save;
  for (const e of rt.enemies.slice()) {
    if (e.hp > 0) continue;
    rt.enemies.splice(rt.enemies.indexOf(e), 1);
    if (e.minion) { sfx(rt, 'kill'); continue; } // 보스가 부른 졸개: 보상도 처치 수도 없음
    rt.kills++;
    if (rt.endless) { sfx(rt, 'kill'); continue; } // 무한 모드: 골드/경험치/드롭 없음
    const bm = burnMul(s), rb = (k) => (s.buff && s.buff[k] && s.buff[k].sec > 0 ? s.buff[k].mul : 1);
    const g = niceNum(e.gold * (1 + CFG.goldUp.per * s.up.gold + (weaponTrait(s).goldMul || 0)) * permMul(s, 'gold') * bm * rb('gold'));   // 100, 150, 200, 300 처럼 딱 떨어지는 값
    s.gold += g; s.kills = (s.kills || 0) + 1;
    fx(rt, e.x, '+' + fmt(g) + 'G', '#ffd35a');
    sfx(rt, 'kill');
    const xp = e.exp * permMul(s, 'exp') * bm * rb('exp');
    gainExp(rt, xp);
    rt.gainLog.push([rt.clock, g, xp]);   // 분당 수익 표시용
    const chance = (e.boss ? CFG.drop.boss : CFG.drop.normal) * (1 + CFG.dropUp.per * s.up.drop) * permMul(s, 'drop') * bm * rb('drop');
    if (rt.rng() < chance) rollDrop(rt, e);
  }
}

function gainExp(rt, amount) {
  const s = rt.save, cap = CFG.level.cap;
  if (s.level >= cap) return;
  const before = s.level;
  s.exp += amount;
  while (s.level < cap && s.exp >= expNeed(s.level)) { s.exp -= expNeed(s.level); s.level++; }
  if (s.level >= cap) s.exp = 0;
  if (s.level === before) return;
  refresh(rt);
  rt.happyAt = rt.clock;
  fx(rt, -6, 'LEVEL UP!', '#ffe066'); sfx(rt, 'level');
  msg(rt, `레벨 업! Lv.${s.level}`, 'ok');
  skillList(s).forEach((sk) => { if (sk.unlock > before && sk.unlock <= s.level) msg(rt, `새 스킬 해금: ${sk.name}`, 'ok'); });
}

function rollDrop(rt, e) {
  const s = rt.save;
  const slot = pickRandom(rt, CFG.slots);
  const item = makeItem(s, slot, rollGrade(rt, s.region, e.boss), s.region, pickRandom(rt, CFG.enabledClasses));
  addItem(rt, item, false);
}

function setStage(rt, region, round, lock) {
  const s = rt.save;
  s.region = region; s.round = round; s.lock = !!lock;
  if (region > s.best.region || (region === s.best.region && round > s.best.round)) s.best = { region, round };
  resetRound(rt);
}

function canEnter(s, region, round) {
  if (region < 1 || region > CFG.regions.length) return false;
  return region < s.best.region || (region === s.best.region && round <= s.best.round);
}

function failRound(rt, why) {
  const s = rt.save;
  if (rt.endless) {
    const f = rt.endless.floor;
    rt.endless.floor = 1; rt.endlessFailed = true;
    rt.hp = rt.d.hp; rt.cd = [0, 0, 0, 0];
    resetRound(rt); sfx(rt, 'fail');
    msg(rt, `${why} ${f}층에서 멈췄어요. 1층부터 다시 도전합니다.`, 'bad');
    return;
  }
  // 쓰러지거나 시간이 지나면 같은 라운드를 처음부터 다시 도전 (자동으로 이전 라운드로 돌아가지 않음. 파밍이 필요하면 스테이지 탭에서 직접 고르고 고정)
  rt.fails = (rt.fails || 0) + 1;
  rt.hp = rt.d.hp;
  rt.cd = [0, 0, 0, 0];
  resetRound(rt);
  sfx(rt, 'fail');
  msg(rt, `${why} ${s.region}-${s.round}을(를) 다시 도전해요.${rt.fails % 3 === 0 ? ' 너무 어려우면 성장 탭에서 능력치를 올리거나, 스테이지 탭에서 이전 라운드를 골라 고정(파밍)해 보세요.' : ''}`, 'bad');
}
function clearRound(rt) {
  const s = rt.save; rt.fails = 0;
  if (rt.endless) {
    const E = s.endless, f = ++rt.endless.floor;
    sfx(rt, isEndlessBoss(f - 1) ? 'win' : 'clear');
    if (isEndlessBoss(f - 1)) rt.happyAt = rt.clock;
    if (f > E.best) {
      E.best = f; E.bestAt = Date.now();
      if (f >= CFG.endless.minFloor) msg(rt, `무한 모드 ${f}층 도달! (최고 기록)`, 'ok');
    }
    resetRound(rt);
    return;
  }
  msg(rt, `${s.region}-${s.round} 클리어!`, 'ok'); sfx(rt, isBoss(s.round) ? 'win' : 'clear');
  if (isBoss(s.round)) rt.happyAt = rt.clock;
  if (s.lock) { resetRound(rt); return; }
  if (s.round < CFG.roundsPerRegion) { setStage(rt, s.region, s.round + 1, false); return; }
  if (!s.clearedRegions.includes(s.region)) {
    s.clearedRegions.push(s.region); s.pendingPoints++;
    msg(rt, '지역 클리어! 영구 포인트 +1 (다음 시즌부터 투자할 수 있어요)', 'ok');
  }
  if (s.region < CFG.regions.length) setStage(rt, s.region + 1, 1, false);
  else { msg(rt, '현재 준비된 마지막 지역입니다. 보스를 반복합니다.', 'ok'); resetRound(rt); }
}

// ---------- 보스 특수 패턴 ----------
function bossInfoOf(rt) {
  const n = CFG.bossInfo.length;
  const idx = rt.endless ? (Math.floor(rt.endless.floor / CFG.endless.bossEvery) - 1) % n : rt.save.region - 1;
  return CFG.bossInfo[Math.max(0, idx)];
}

function bossGimmicks(rt, dt) {
  const boss = rt.enemies.find((e) => e.boss);
  if (!boss) return;
  const info = bossInfoOf(rt), now = rt.bossClock, G = rt.gs, d = rt.d;
  let msgs = [];
  rt.shielded = false; rt.reflecting = false;
  info.gimmicks.forEach((g, gi) => {
    const st = G[gi] || (G[gi] = { next: g.period ? g.period * 0.6 : 0, wind: -1 });
    switch (g.type) {
      case 'charge': {
        if (st.wind < 0 && now >= st.next) { st.wind = g.windup; st.hp0 = boss.hp; msg(rt, `${info.name}의 ${g.label} 충전! 피해를 몰아서 끊으세요!`, 'bad'); sfx(rt, 'weak'); }
        if (st.wind >= 0) {
          st.wind -= dt;
          if (boss.hp <= st.hp0 - g.breakPct * boss.maxhp) { st.wind = -1; st.next = now + g.period; fx(rt, boss.x, '끊었다!', '#7ad0ff'); msg(rt, `${g.label}을(를) 끊었어요!`, 'ok'); }
          else if (st.wind <= 0) {
            st.wind = -1; st.next = now + g.period;
            const taken = d.hp * g.dmg * (1 - 0.5 * d.def / (d.def + 2 * boss.atk));
            rt.hp -= taken; rt.hurtAt = rt.clock; sfx(rt, 'hurt'); fx(rt, -6, '-' + fmt(taken), '#ff5a5a');
          } else msgs.push(`${g.label} 충전 중! (${st.wind.toFixed(1)}초) 피해를 몰아주세요`);
        }
        break;
      }
      case 'poison':
        if (now >= st.next) { st.next = now + g.period; rt.poison = { left: g.dur, dps: d.hp * g.dps }; msg(rt, `${g.label}에 중독됐어요!`, 'bad'); }
        if (rt.poison) msgs.push('중독 중');
        break;
      case 'silence':
        if (now >= st.next) { st.next = now + g.period; rt.silenceLeft = g.dur; msg(rt, `${g.label}! 스킬을 잠시 쓸 수 없어요.`, 'bad'); }
        if (rt.silenceLeft > 0) msgs.push('스킬 봉인');
        break;
      case 'heal':
        if (now >= st.next) { st.next = now + g.period; boss.hp = Math.min(boss.maxhp, boss.hp + boss.maxhp * g.pct); fx(rt, boss.x, '회복', '#6aff8a'); msg(rt, `${info.name}이(가) ${g.label}로 회복했어요.`, ''); }
        break;
      case 'summon':
        if (now >= st.next) {
          st.next = now + g.period;
          for (let i = 0; i < g.count; i++) rt.enemies.push({ x: CFG.spawnX + 10 * i, hp: boss.maxhp * 0.03, maxhp: boss.maxhp * 0.03, atk: boss.atk * 0.3, gold: 0, exp: 0, boss: false, minion: true, speed: CFG.mon.speed, stop: CFG.stopNormal, interval: 1.2, cd: 0.8, flash: -1, seed: rt.rng() * 6.28 });
          msg(rt, `${g.label}이(가) 나타났어요!`, 'bad');
        }
        break;
      case 'enrage':
        if (!st.on && boss.hp / boss.maxhp <= g.below) { st.on = true; boss.interval *= g.speed; msg(rt, `${g.label}! ${info.name}이(가) 사나워졌어요.`, 'bad'); }
        if (st.on) msgs.push('분노 상태');
        break;
      case 'shield':
        if (now % g.period < g.dur && now > g.period * 0.4) { rt.shielded = true; rt.shieldMul = g.mul; msgs.push(`${g.label}: 약점이 드러날 때까지 피해가 거의 안 들어가요`); }
        break;
      case 'reflect':
        if (now % g.period < g.dur && now > g.period * 0.4) { rt.reflecting = true; rt.reflectPct = g.pct; msgs.push(`${g.label}: 지금 공격하면 피해를 되돌려 받아요`); }
        break;
    }
  });
  rt.gimMsg = msgs.join(' · ');
}

// 전투력: 화면에 보여 주는 대표 수치 (초당 피해와 버티는 힘을 합친 값)
function combatPower(s, d) { return Math.floor(d.plain * d.spd * 6 + d.hp / 4 + d.def * 2 + (s.level || 1) * 5); }

// ---------- 보상형 광고 ----------
function adsLeft(s) { return Math.max(0, CFG.ads.perDay - (s.ads && s.ads.date === dayKey() ? s.ads.count : 0)); }
// 광고를 끝까지 본 뒤 호출. 선택한 종류(exp/gold/drop)의 보너스를 줌. 못 받으면 false
function applyAdReward(rt, kind) {
  const s = rt.save, A = CFG.ads;
  if (!A.enabled || !CFG.roulette.kinds[kind] || adsLeft(s) < 1) return false;
  rollDay(s); s.ads.count++;
  const b = s.buff[kind];
  b.sec = Math.min(7200, (b.sec > 0 ? b.sec : 0) + A.sec); b.mul = Math.max(b.sec > A.sec ? b.mul : 1, A.mul);
  msg(rt, `광고 보상! ${CFG.roulette.kinds[kind]} ×${A.mul} (${Math.round(A.sec / 60)}분)`, 'ok');
  return true;
}

// ---------- 수익 표시 / 추천 투자 ----------
// 최근 2분 동안의 분당 골드/경험치 (너무 짧으면 null)
function gainRates(rt) {
  const win = Math.min(120, rt.clock);
  if (win < 10 || rt.endless) return null;
  let g = 0, x = 0;
  for (const [, gg, xx] of rt.gainLog) { g += gg; x += xx; }
  return { gold: g / win * 60, exp: x / win * 60 };
}

// 지금 살 수 있는 투자 후보와 '가성비' 점수 (비용 x 가중치, 낮을수록 좋음). 체력/주력/방어 > 신속 > 스킬/사냥효율 > 장비 강화 순으로 가중
function investOptions(s) {
  const main = CFG.classInfo[s.weaponType].stat, opts = [];
  for (const k of ['gold', 'drop']) {
    const c = costOf(CFG[k + 'Up'].cost, s.up[k]);
    opts.push({ key: 'up:' + k, c, score: c * 2, buy: () => buyUp(s, k, 1) });
  }
  for (const slot of CFG.slots) {
    const it = s.equip[slot];
    if (!it || it.enh >= CFG.enh.max) continue;
    const c = enhCostFn(it)(it.enh);
    opts.push({ key: 'enh:' + slot, c, score: c * 0.5, buy: () => buyEnh(s, slot, 1) });
  }
  return opts.sort((a, b) => a.score - b.score);
}
function bestInvest(s) { return investOptions(s)[0] || null; }
// 가진 골드로 추천 순서대로 계속 구매. 산 횟수를 돌려줌
function autoInvest(rt) {
  const s = rt.save; let n = 0;
  for (let guard = 0; guard < 300; guard++) {
    const o = bestInvest(s);
    if (!o || s.gold < o.c) break;
    const before = s.gold; o.buy();
    if (s.gold === before) break;
    n++;
  }
  refresh(rt);
  return n;
}

// ---------- 룰렛 ----------
// 티켓 1개로 돌려서 보너스를 받음. 같은 종류 보너스가 이미 있으면 시간을 더하고 배율은 높은 쪽
function spinRoulette(rt) {
  const s = rt.save, R = CFG.roulette;
  if ((s.tickets || 0) < 1) return null;
  const idx = Math.floor(rt.rng() * R.segments.length), seg = R.segments[idx], b = s.buff[seg.kind];
  s.tickets--;
  b.sec = Math.min(7200, (b.sec > 0 ? b.sec : 0) + seg.sec);
  b.mul = Math.max(b.sec > seg.sec ? b.mul : 1, seg.mul);
  msg(rt, `룰렛! ${R.kinds[seg.kind]} ×${seg.mul} (${Math.round(seg.sec / 60)}분)`, 'ok');
  sfx(rt, 'rare');
  return { idx, seg };
}
// ---------- 1틱 진행 ----------
function step(rt, dt) {
  const s = rt.save, d = rt.d, boss = curBoss(rt);
  rt.clock += dt; s.playTime += dt;
  if (rt.endless) rt.floorClock += dt;
  if (s.today) s.today.sec += dt;
  rt.dayT = (rt.dayT || 0) + dt;
  if (rt.dayT >= 30) { rt.dayT = 0; rollDay(s); } // 하루가 바뀌었는지 가끔 확인 (새 날이면 버닝 타임 다시 시작)
  if (s.today && !rt.burnEnded && s.today.sec >= CFG.burn.sec) { rt.burnEnded = true; msg(rt, '오늘의 버닝 타임이 끝났어요. (내일 오전 6시에 다시 시작)', ''); }
  if (s.today && s.today.sec < CFG.burn.sec) rt.burnEnded = false;
  rt.hp = Math.min(d.hp, rt.hp + d.hp * CFG.regen * ((animalPassive(s) || {}).regenMul || 1) * dt);
  if (s.buff) for (const k of Object.keys(s.buff)) if (s.buff[k].sec > 0) s.buff[k].sec = Math.max(0, s.buff[k].sec - dt);   // 룰렛 보너스는 접속 중에만 흐름
  if (rt.silenceLeft > 0) rt.silenceLeft = Math.max(0, rt.silenceLeft - dt);
  if (rt.poison) { rt.hp -= rt.poison.dps * dt; rt.poison.left -= dt; if (rt.poison.left <= 0) rt.poison = null; }
  for (let i = 0; i < rt.cd.length; i++) if (rt.cd[i] > 0) rt.cd[i] = Math.max(0, rt.cd[i] - dt);
  while (rt.gainLog.length && rt.clock - rt.gainLog[0][0] > 120) rt.gainLog.shift();
  while (rt.fx.length && rt.clock - rt.fx[0].born > 0.9) rt.fx.shift();
  while (rt.proj.length && rt.clock - rt.proj[0].born > 1.2) rt.proj.shift();

  if (boss) {
    rt.bossClock += dt; rt.bossLeft -= dt;
    const wasWeak = rt.weak;
    rt.weak = rt.optimistic || rt.bossClock % CFG.boss.cycle >= CFG.boss.cycle - CFG.boss.weakDur;
    if (rt.weak && !wasWeak) sfx(rt, 'weak');
    if (!rt.optimistic) bossGimmicks(rt, dt);
  } else { rt.weak = false; rt.gimMsg = ''; }

  // 몬스터 등장
  if (boss) { if (rt.spawned < 1) spawn(rt); }
  else if (rt.spawned < needKillsRt(rt) && rt.enemies.length < 3) {
    rt.spawnT -= dt;
    if (rt.spawnT <= 0) { spawn(rt); rt.spawnT = 0.7; }
  }

  // 몬스터 이동/공격
  let blocked = false;
  for (const e of rt.enemies) {
    if (e.x > e.stop) e.x = Math.max(e.stop, e.x - e.speed * dt);
    if (e.x <= e.stop + 0.01) {
      blocked = true;
      e.cd -= dt;
      if (e.cd <= 0) {
        e.cd = e.interval;
        const taken = e.atk * (1 - 0.8 * d.def / (d.def + 2 * e.atk));
        rt.hp -= taken; rt.hurtAt = rt.clock; sfx(rt, 'hurt');
        fx(rt, -6, '-' + fmt(taken), '#ff8a8a');
      }
    }
  }
  if (!blocked) rt.scroll += 28 * dt;

  // 플레이어 공격 (스킬 우선, 없으면 기본 공격)
  const range = playerRange(s);
  const target = nearest(rt, range);
  rt.atkT += dt;
  const interval = 1 / d.spd;
  if (target) {
    let used = false;
    const list = skillList(s);
    for (let i = 0; i < list.length; i++) {
      if (rt.cd[i] <= 0 && castSkill(rt, i)) { used = true; break; }
    }
    if (!used && rt.atkT >= interval) {
      rt.atkT = 0; rt.hitAt = rt.clock;
      sfx(rt, s.weaponType === 'melee' ? 'slash' : s.weaponType === 'mage' ? 'zap' : 'bow');
      if (s.weaponType !== 'melee') proj(rt, s.weaponType === 'mage' ? 'spark' : 'arrow', target.x, { hits: 1 });
      dealDamage(rt, target, d.plain, '');
      const ap = animalPassive(s);
      if (ap && ap.procChance && rt.rng() < ap.procChance && rt.enemies.includes(target)) dealDamage(rt, target, d.plain * ap.procMul, '연타');
      const wt = weaponTrait(s);
      if (wt.procChance && rt.rng() < wt.procChance && rt.enemies.includes(target)) dealDamage(rt, target, d.plain * wt.procMul, '추가타');
      collectDead(rt);
    }
  } else if (rt.atkT > interval) rt.atkT = interval;

  // 승패 판정
  if (rt.hp <= 0) { failRound(rt, '쓰러졌습니다!'); return; }
  if (boss && rt.bossLeft <= 0) { failRound(rt, '시간 초과!'); return; }
  if (rt.endless && rt.floorClock > CFG.endless.floorTime) { failRound(rt, '시간 초과!'); return; }
  if (rt.kills >= needKillsRt(rt) && rt.enemies.length === 0) clearRound(rt);
}

if (typeof module !== 'undefined') module.exports = { CFG };














