// 지역별 몬스터 강도(tune.hp/atk)와 경험치(tune.exp)를 목표 시간표/레벨표에 맞게 자동 조정
// 사용: node calibrate.js <반복횟수> [이어하기 파일]
const fs = require('fs'), vm = require('vm');
const path = require('path');
const dir = path.resolve(__dirname, '../client/js') + '/';
const SP = __dirname + '/';   // 조정 결과(tune.json)를 이 폴더에 저장
const code = fs.readFileSync(dir + 'config.js', 'utf8') + '\n' + fs.readFileSync(dir + 'game.js', 'utf8') +
  '\n;globalThis.G = { CFG, step, createRuntime, newSave, buyStat, buyUp, buyEnh, buySkill, calcStats, costOf, enhCostFn, fmt, equipBest, mergeAll, salvageUpTo, dayKey, expNeed };';
const ctx = { Math, console, Date, JSON, Object, Array, Set, Number, String, Infinity, globalThis: null };
ctx.globalThis = ctx; vm.createContext(ctx); vm.runInContext(code, ctx);
const G = ctx.G, N = G.CFG.regions.length;

// 목표: 지역별 소요 시간(시간), 지역 클리어 시점 레벨
const DUR = [0.15, 0.3, 0.6, 1.0, 1.7, 2.6, 3.8, 5.2, 7.0, 7.65];
const LV = [10, 15, 20, 25, 30, 42, 54, 66, 78, 90];
const cumExp = (lv) => { let t = 0; for (let L = 1; L < lv; L++) t += G.expNeed(L); return t; };
const PER_DAY = 3, DAYS = 16, CLS = process.argv[4] || 'melee';

function runOnce() {
  const rt = G.createRuntime(G.newSave('dog', 'bot', CLS), 1), s = rt.save, dt = G.CFG.tickDt;
  s.today.date = G.dayKey();
  const mainStat = G.CFG.classInfo[s.weaponType].stat;
  const invest = () => {
    G.equipBest(rt); G.mergeAll(rt); G.equipBest(rt); G.salvageUpTo(rt, 1);
    for (let guard = 0; guard < 50; guard++) {
      const opts = [];
      for (const k of ['hp', mainStat, 'def', 'spd']) opts.push({ c: G.costOf(G.CFG.statCost[k], s.stats[k]) * (k === 'spd' ? 0.6 : 1), f: () => G.buyStat(s, k, 1) });
      for (const sl of G.CFG.slots) { const it = s.equip[sl]; if (it && it.enh < G.CFG.enh.max) opts.push({ c: G.enhCostFn(it)(it.enh) * 0.5, f: () => G.buyEnh(s, sl, 1) }); }
      for (let i = 0; i < 3; i++) opts.push({ c: G.costOf(G.CFG.skillUp.cost, s.skillLv[i]) * 1.5, f: () => G.buySkill(s, i, 1) });
      opts.push({ c: G.costOf(G.CFG.goldUp.cost, s.up.gold) * 2, f: () => G.buyUp(s, 'gold', 1) });
      opts.push({ c: G.costOf(G.CFG.dropUp.cost, s.up.drop) * 2, f: () => G.buyUp(s, 'drop', 1) });
      opts.sort((a, b) => a.c - b.c);
      const o = opts[0]; if (s.gold < o.c) break;
      const before = s.gold; o.f(); if (s.gold === before) break;
    }
    rt.d = G.calcStats(s);
  };
  const clearAt = new Array(N).fill(null), lvAt = new Array(N).fill(null), expAt = new Array(N).fill(null);
  let online = 0, tick = 0, done = 0;
  for (let d = 1; d <= DAYS && done < N; d++) {
    s.today = { date: G.dayKey(), sec: 0 };
    const steps = Math.floor(PER_DAY * 3600 / dt);
    for (let i = 0; i < steps; i++) {
      G.step(rt, dt); tick++;
      if (tick % 20 === 0) invest();
      if (s.lock && tick % 6000 === 0) s.lock = false;
      while (done < N && s.clearedRegions.includes(done + 1)) {
        clearAt[done] = online + i * dt / 3600; lvAt[done] = s.level;
        let e = s.exp; for (let L = 1; L < s.level; L++) e += G.expNeed(L); expAt[done] = e; done++;
      }
    }
    online += PER_DAY;
  }
  return { clearAt, lvAt, expAt, online, final: { lv: s.level, best: s.best } };
}

const iters = Number(process.argv[2] || 6);
const file = process.argv[3] || (SP + 'tune.json');
const T = G.CFG.tune;
if (fs.existsSync(file)) { const j = JSON.parse(fs.readFileSync(file, 'utf8')); for (const k of ['hp', 'atk', 'exp']) T[k] = j[k]; }

for (let it = 1; it <= iters; it++) {
  const t0 = Date.now();
  const r = runOnce();
  // 지역별 실제 소요 시간 (못 깬 지역은 끝까지 걸린 시간으로 간주)
  const dur = []; let prev = 0, stuck = false;
  for (let i = 0; i < N; i++) {
    if (r.clearAt[i] !== null) { dur.push(r.clearAt[i] - prev); prev = r.clearAt[i]; }
    else { dur.push(stuck ? null : (r.online - prev)); stuck = true; }
  }
  const line = dur.map((d, i) => `${i + 1}:${d === null ? '-' : d.toFixed(2)}/${DUR[i]}`).join(' ');
  const lvl = r.lvAt.map((l, i) => `${i + 1}:${l ?? '-'}/${LV[i]}`).join(' ');
  console.log(`[반복 ${it}] ${((Date.now() - t0) / 1000).toFixed(0)}초  소요시간(실제/목표) ${line}`);
  console.log(`   레벨(실제/목표) ${lvl}  | 총 ${r.clearAt[N - 1] !== null ? r.clearAt[N - 1].toFixed(1) + '시간에 10지역 클리어' : '10지역 못 깸'}`);
  // 조정: 지역별 시간
  for (let i = 0; i < N; i++) {
    if (dur[i] === null) continue;
    const m = Math.max(dur[i], 0.02), ratio = Math.min(8, Math.max(0.2, DUR[i] / m));
    const f = Math.pow(ratio, r.clearAt[i] === null ? 0.35 : 0.6);
    T.hp[i] *= f;
    if (i === 0) T.hp[0] = Math.min(1.25, Math.max(0.6, T.hp[0])); // 1지역은 새 캐릭터가 반드시 깰 수 있어야 함
    T.atk[i] = Math.pow(T.hp[i], 0.7); // 몬스터가 단단해지면 공격도 조금 세게
  }
  // 조정: 경험치 (지역마다 필요한 총 경험치 / 실제 얻은 경험치)
  for (let i = 0; i < N; i++) {
    if (r.expAt[i] === null) continue;
    if (r.lvAt[i] >= G.CFG.level.cap) { T.exp[i] *= 0.6; continue; } // 상한에 걸리면 얻은 경험치가 과소 측정되므로 낮추기만 함
    const gained = r.expAt[i] - (i ? r.expAt[i - 1] : 0), need = cumExp(LV[i]) - (i ? cumExp(LV[i - 1]) : 0);
    T.exp[i] *= Math.min(10, Math.max(0.1, need / Math.max(1, gained)));
  }
  fs.writeFileSync(file, JSON.stringify({ hp: T.hp, atk: T.atk, exp: T.exp }, null, 1));
}
console.log('hp  ', JSON.stringify(T.hp.map((x) => +x.toPrecision(4))));
console.log('atk ', JSON.stringify(T.atk.map((x) => +x.toPrecision(4))));
console.log('exp ', JSON.stringify(T.exp.map((x) => +x.toPrecision(4))));




