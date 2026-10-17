// 장기 시뮬레이션: 하루 H시간씩 D일 동안 효율적으로 플레이하는 봇. 지역별 클리어 시각/레벨/처치 수 출력
// 사용: node sim2.js <하루 시간> <일수> <직업> <시드> [출력주기(시간)]
const fs = require('fs'), vm = require('vm');
const path = require('path');
const dir = path.resolve(__dirname, '../client/js') + '/';
const code = fs.readFileSync(dir + 'config.js', 'utf8') + '\n' + fs.readFileSync(dir + 'game.js', 'utf8') +
  '\n;globalThis.G = { CFG, step, createRuntime, newSave, buyStat, buyUp, buyEnh, buySkill, calcStats, costOf, enhCostFn, fmt, equipBest, mergeAll, salvageUpTo, dayKey, expNeed, endlessFeasible, investedAll, goldCeiling, setStage };';
const ctx = { Math, console, Date, JSON, Object, Array, Set, Number, String, Infinity, globalThis: null };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(code, ctx);
const G = ctx.G;

const perDay = Number(process.argv[2] || 3), days = Number(process.argv[3] || 14);
const cls = process.argv[4] || 'melee', seed = Number(process.argv[5] || 1);
const every = Number(process.argv[6] || 0);
const rt = G.createRuntime(G.newSave('dog', 'bot', cls), seed);
const s = rt.save, dt = G.CFG.tickDt;
s.today.date = G.dayKey();

function invest() {
  G.equipBest(rt); G.mergeAll(rt); G.equipBest(rt); G.salvageUpTo(rt, 1);
  const mainStat = G.CFG.classInfo[s.weaponType].stat;
  for (let guard = 0; guard < 50; guard++) {
    const opts = [];
    for (const k of ['hp', mainStat, 'def', 'spd']) opts.push({ c: G.costOf(G.CFG.statCost[k], s.stats[k]) * (k === 'spd' ? 0.6 : 1), f: () => G.buyStat(s, k, 1) });
    for (const sl of G.CFG.slots) { const it = s.equip[sl]; if (it && it.enh < G.CFG.enh.max) opts.push({ c: G.enhCostFn(it)(it.enh) * 0.5, f: () => G.buyEnh(s, sl, 1) }); }
    for (let i = 0; i < 3; i++) opts.push({ c: G.costOf(G.CFG.skillUp.cost, s.skillLv[i]) * 1.5, f: () => G.buySkill(s, i, 1) });
    opts.push({ c: G.costOf(G.CFG.goldUp.cost, s.up.gold) * 2, f: () => G.buyUp(s, 'gold', 1) });
    opts.push({ c: G.costOf(G.CFG.dropUp.cost, s.up.drop) * 2, f: () => G.buyUp(s, 'drop', 1) });
    opts.sort((a, b) => a.c - b.c);
    const o = opts[0];
    if (s.gold < o.c) break;
    const before = s.gold; o.f(); if (s.gold === before) break;
  }
  rt.d = G.calcStats(s);
}

const FARM_MIN = Number(process.env.FARM_MIN || 15);  // 막힐 때 이전 라운드에서 파밍하는 시간(분)
const cleared = {};      // 지역 → {h, lv, kills}
let prevKills = 0, hoursOnline = 0, tick = 0, lastPrint = 0;
const t0 = Date.now();
for (let d = 1; d <= days; d++) {
  s.today = { date: G.dayKey(), sec: 0 };
  const steps = Math.floor(perDay * 3600 / dt);
  for (let i = 0; i < steps; i++) {
    G.step(rt, dt); tick++;
    if (tick % 20 === 0) invest();
    if (s.lock && tick >= (rt.unlockAt || 0)) s.lock = false;
    if (rt.fails >= 3 && !s.lock) { rt.fails = 0; let rg = s.region, rd = s.round; if (rd > 1) rd--; else if (rg > 1) { rg--; rd = G.CFG.roundsPerRegion - 1; } if (rg !== s.region || rd !== s.round) { G.setStage(rt, rg, rd, true); rt.unlockAt = tick + FARM_MIN * 60 * 20; } }   // 사람처럼: 계속 막히면 직접 이전 라운드를 골라 고정
    for (const r of s.clearedRegions) if (!cleared[r]) { cleared[r] = { h: (hoursOnline + i * dt / 3600), lv: s.level, kills: s.kills - prevKills, day: d }; prevKills = s.kills; }
    if (every && (hoursOnline + i * dt / 3600) - lastPrint >= every) {
      lastPrint = hoursOnline + i * dt / 3600;
      console.log(`h=${lastPrint.toFixed(1)} day${d} Lv${s.level} stage=${s.region}-${s.round}${s.lock ? '고정' : ''} best=${s.best.region}-${s.best.round} gold=${G.fmt(s.gold)} hp=${G.fmt(rt.d.hp)} main=${G.fmt(rt.d.main)}`);
    }
  }
  hoursOnline += perDay;
  if (process.env.ENDLESS && (d % Number(process.env.ENDLESS) === 0 || d === days)) {
    // 지금 장비/능력치로 무한 모드에서 어디까지 갈 수 있는지 (보스 약점 항상 적중 = 가장 유리한 조건)
    let f = 1; while (f < 400 && G.endlessFeasible(s, f)) f++;
    console.log(`  투자합계/상한 = ${(G.investedAll(s) / G.goldCeiling(s)).toFixed(3)}`);
    console.log(`  [${d}일차 ${hoursOnline}h] Lv${s.level} 스토리 ${s.best.region}-${s.best.round} → 무한 모드 약 ${f}층까지`);
  }
}
console.log(`[${cls} ${perDay}h/일 ${days}일] 계산 ${((Date.now() - t0) / 1000).toFixed(0)}초`);
for (let r = 1; r <= G.CFG.regions.length; r++) {
  const c = cleared[r];
  console.log(`  ${r}지역 클리어: ` + (c ? `${c.h.toFixed(2)}시간째(${c.day}일차) Lv${c.lv} 이 지역 처치 ${c.kills}` : '못 깸'));
}
const owned = s.inv.concat(Object.values(s.equip)).filter(Boolean);
console.log(`  보유 전설 ${owned.filter((x) => x.grade === 4).length}개, 영웅 ${owned.filter((x) => x.grade === 3).length}개 (보관함 ${s.inv.length})`);
console.log(`  최종: Lv${s.level} 최고 ${s.best.region}-${s.best.round} 총 처치 ${s.kills}`);




