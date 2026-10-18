// 밸런스/설정 값 모음. 수치 조정은 이 파일만 고치면 됩니다.
// 성장 레벨 1칸 = 옛 레벨 LV_UNIT칸 묶음 (클릭 수를 줄이려고 가격과 효과를 함께 키움. 전체 속도는 그대로)
const LV_UNIT = 10;
function bundleCost(t) { const r = Math.pow(t[1], LV_UNIT); return [t[0] * (r - 1) / (t[1] - 1), r]; }
const CFG = {
  lvUnit: LV_UNIT,
  tickDt: 0.05,          // 로직 1틱 = 0.05초
  catchUpMax: 120,       // 탭이 느려졌을 때 한 번에 따라잡는 최대 시간(초)
  saveKey: 'idlegame_save_v2',
  oldSaveKey: 'idlegame_save_v1',

  roundsPerRegion: 10,   // 마지막 라운드는 보스
  monstersPerRound: 15,
  bossTime: 45,          // 보스 제한 시간(초)
  regen: 0.01,           // 초당 체력 회복 비율

  // 영구 포인트: 지역을 클리어하면 1개씩(시즌 종료 때 사용 가능 포인트로 전환) 받아서 시즌이 바뀌어도 유지되는 능력치에 투자
  perm: {
    maxLv: 10,
    costs: [1, 1, 2, 2, 3, 3, 4, 4, 5, 5],   // 1~10레벨 올리는 데 필요한 포인트 (처음은 싸게, 갈수록 비싸게)
    items: {
      atk:  { name: '공격력', per: 4, unit: '' },
      hp:   { name: '체력', per: 40, unit: '' },
      mag:  { name: '마력', per: 4, unit: '' },
      gold: { name: '골드 획득량', per: 0.01, unit: '%' },
      drop: { name: '장비 드롭률', per: 0.01, unit: '%' },
      exp:  { name: '경험치 획득량', per: 0.01, unit: '%' },
    },
  },
  titleBuffSeasons: 3,                         // 칭호의 능력치 효과는 얻은 뒤 3시즌 동안만 (칭호 자체는 계속 남음)

  // 버닝 타임: 하루(오전 6시 기준) 접속 시간 중 처음 3시간 동안 경험치/골드/드롭률 배율. 이월/휴식 감소 없음
  burn: { sec: 3 * 3600, mul: 3 },

  // 캐릭터 레벨: 몬스터를 처치하면 경험치, 레벨업 시 능력치가 자동으로 오르고 스킬이 해금됨
  // 목표: 1지역 끝 약 10레벨, 5지역 끝 약 30레벨, 10지역 클리어 약 90레벨
  level: { cap: 100, hp: 10, atk: 1, mag: 1, need: [4.2, 20] },  // 레벨업 필요 경험치 = 4.2 x 레벨² + 20
  exp: { base: 6, region: 1.9, round: 1.06, boss: 8 },           // 처치 경험치 = base x region^(지역-1) x round^(라운드-1)

  // 전투 화면 좌표 (논리 해상도 256x144 기준)
  view: { w: 256, h: 144, ground: 118, foot: 130, playerX: 56 },
  spawnX: 190, stopNormal: 30, stopBoss: 46,

  // 플레이어 기본 능력치
  player: { hp: 130, atk: 12, mag: 13, def: 0, spd: 1.0 },
  // 스탯 1레벨당 증가량
  statPer: { hp: 20, atk: 2, mag: 2, def: 1, spd: 0.03 },
  statGrowth: 1.07,      // 체력/공격력/마력/방어력: 투자 레벨마다 효과가 이 비율로 복리 증가 (필요 골드 증가율보다 약간 낮게)
  statCurve: 50,         // 신속: 레벨이 높을수록 효율이 조금씩 올라가는 정도(선형)
  // 체력/공격력/마력/방어력/신속/스킬은 골드로 사지 않고 캐릭터 레벨에 따라 자동으로 오름 ([캐릭터 레벨, 성장 레벨] 꼭짓점 사이를 직선으로 이음)
  autoStat: {
    main: [[1, 0], [20, 4], [35, 14], [46, 16], [57, 19], [100, 24]],
    spd:  [[1, 0], [20, 2], [35, 8], [57, 12], [100, 16]],
    skill: [[1, 0], [26, 1], [30, 2], [46, 3], [57, 4], [100, 5]],
  },
  // 옛 1칸 기준 가격표(마이그레이션·각성 비용 기준용). 실제 가격표는 아래에서 묶음으로 계산
  legacyCost: {
    hp: [10, 1.08], atk: [10, 1.08], mag: [10, 1.08], def: [15, 1.09], spd: [40, 1.12],
    gold: [60, 1.25], drop: [80, 1.28], skill: [100, 1.35],
  },
  statCost: {            // [기본 비용, 레벨당 증가 배율] (묶음 단위)
    hp: bundleCost([10, 1.08]), atk: bundleCost([10, 1.08]), mag: bundleCost([10, 1.08]), def: bundleCost([15, 1.09]), spd: bundleCost([40, 1.12]),
  },
  goldUp: { per: 0.04 * LV_UNIT, cost: bundleCost([60, 1.25]) },   // 골드 획득량
  dropUp: { per: 0.03 * LV_UNIT, cost: bundleCost([80, 1.28]) },   // 드롭률
  skillUp: { per: 0.15 * LV_UNIT, cost: bundleCost([100, 1.35]) },

  // 장비 강화: 장비 하나하나에 붙는 +0 ~ +10 (등급과는 별개)
  enh: {
    per: 0.2, max: 10, cost: [40, 1.5],
    // 무기 '각성' (+11 ~ +15): 아주 비싸고 확률로 성공하는 고위험 도전. 성공하면 최종 공격력/마력이 크게 늘어남.
    // 능력치는 레벨로 자동 성장하므로 골드의 주 쓰임새는 장비 강화이고, 각성은 그 끝에 있는 도전.
    // 비용 = base x costMul. 실패하면 -1강이라 기대 총비용 10강->14강은 약 1.14 x base, 10강->15강은 약 7 x base.
    // 목표: +14는 '하루 12시간(30일)' 유저가 버는 골드(시뮬레이션 약 1.7조)의 절반쯤(약 8,700억)으로 평균 운이면 가능, +15는 그 3배 이상(약 5조)이라 최상위권 + 운이 좋아야 함
    awaken: {
      max: 15, base: 7.6e11,
      costMul: [0.011, 0.0216, 0.041, 0.084, 0.168],   // +10->11, 11->12, 12->13, 13->14, 14->15 한 번 도전 비용
      chance:  [0.65, 0.5, 0.38, 0.26, 0.15],         // 성공 확률
      pityStep: 0.03, pityMax: 0.15,                  // 연속으로 실패하면 도전마다 성공 확률이 pityStep씩 올라감(최대 pityMax). 성공하면 초기화
      dropFrom: 12,                                   // +11에서 +12 이상으로 올리는 도전이 실패하면 한 단계 내려감 (+10에서 +11 도전이 실패하면 +10 그대로)
      bonus:   [0.10, 0.22, 0.38, 0.60, 0.90],        // +11 ~ +15 달성 시 최종 공격력/마력 추가 배율
    },
  },

  // 몬스터 능력치: 지역/라운드가 올라갈수록 곱해지는 배율
  mon: {
    hp: 48, hpRegion: 3.5, hpRound: 1.12, bossHp: 15,
    atk: 6, atkRegion: 3, atkRound: 1.1, bossAtk: 1.6,
    gold: 3, goldRegion: 3.8, goldRound: 1.12, bossGold: 15,
    speed: 24,
  },
  // 지역별 미세 조정 (시뮬레이션으로 목표 시간표에 맞춰 자동 계산된 값. 1 = 기본)
  // 목표: 효율적인 플레이어가 하루 3시간(버닝 타임 사용)씩 하면 약 30시간(10일)에 10지역 보스 클리어, 레벨은 지역 끝마다 10/15/20/25/30/42/54/66/78/90
  tune: {
    hp:   [1.17, 9.0, 30.5, 123, 320, 666, 1518, 2271, 3270, 5056],
    atk:  [0.35, 4.66, 10.9, 29.1, 56.7, 94.8, 168.6, 223.5, 288.5, 391.5],
    gold: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    exp:  [0.26, 0.17, 0.08, 0.073, 0.0169, 0.0649, 0.0141, 0.0245, 0.0099, 0.0079],
  },
  boss: { cycle: 14, weakDur: 4, weakMul: 2.5, lowHp: 0.35, lowMul: 1.3 },

  // 지역 보스: 나라마다 전통 악귀/괴물이 등장하고, 저마다 다른 특수 패턴을 씀 (무한 모드 보스도 10층마다 이 순서로 돌아가며 등장)
  // 패턴 종류와 설명:
  //  charge  : 충전 후 큰 한 방. 충전 중에 보스 체력의 breakPct 이상 피해를 주면 끊을 수 있음 (dmg = 내 최대 체력 비율)
  //  poison  : 독. dur초 동안 초당 내 최대 체력의 dps 비율만큼 피해
  //  silence : 스킬 봉인 dur초 (기본 공격만 가능)
  //  heal    : 보스가 최대 체력의 pct만큼 회복
  //  summon  : 졸개 소환 (졸개를 모두 처치해야 클리어)
  //  enrage  : 체력이 below 이하가 되면 공격 속도가 빨라짐
  //  shield  : dur초 동안 방어막 (약점이 드러났을 때만 피해가 제대로 들어감)
  //  reflect : dur초 동안 준 피해의 일부(pct)를 되돌려 받음
  bossInfo: [
    { name: '도깨비 대장', gimmicks: [{ type: 'charge', period: 16, windup: 3, dmg: 0.4, breakPct: 0.05, label: '도깨비 방망이' }] },
    { name: '오니', gimmicks: [{ type: 'poison', period: 12, dur: 6, dps: 0.012, label: '독안개' }] },
    { name: '강시 대왕', gimmicks: [{ type: 'silence', period: 14, dur: 4, label: '부적 봉인' }] },
    { name: '나가', gimmicks: [{ type: 'heal', period: 15, pct: 0.06, label: '탈피' }] },
    { name: '미라 파라오', gimmicks: [{ type: 'summon', period: 14, count: 2, label: '붕대 하수인' }] },
    { name: '늑대인간 우두머리', gimmicks: [{ type: 'enrage', below: 0.5, speed: 0.6, label: '보름달' }] },
    { name: '가고일 군주', gimmicks: [{ type: 'shield', period: 14, dur: 5, mul: 0.25, label: '석상화' }] },
    { name: '밴시', gimmicks: [{ type: 'reflect', period: 14, dur: 4, pct: 0.35, label: '비명의 장막' }] },
    { name: '목 없는 기수', gimmicks: [{ type: 'charge', period: 13, windup: 2.5, dmg: 0.42, breakPct: 0.05, label: '돌격' }, { type: 'enrage', below: 0.4, speed: 0.65, label: '질주' }] },
    { name: '사시', gimmicks: [{ type: 'poison', period: 12, dur: 5, dps: 0.012, label: '회오리 독' }, { type: 'silence', period: 18, dur: 3, label: '장난' }] },
  ],

  // 동물 고유 특수 능력 (캐릭터 레벨 unlock 이상에서 자동 적용되는 은근한 패시브. 새 동물은 여기에 추가)
  //  regenMul: 체력 회복 배율, hpMul: 최대 체력 배율, procChance/procMul: 기본 공격 때 추가 타격 확률/피해 배율
  animalSkills: {
    dog: { name: '충직한 마음', unlock: 10, regenMul: 2, hpMul: 1.05, desc: '쉬지 않고 곁을 지켜요. 최대 체력 +5%, 체력 회복이 2배로 빨라집니다.' },
    cat: { name: '날쌘 발놀림', unlock: 10, procChance: 0.12, procMul: 0.6, desc: '기본 공격을 할 때 12% 확률로 한 번 더 할큅니다. (추가 타격 피해 60%)' },
  },
  // 보상형 광고: 끝까지 보면 선택한 보너스(접속 중에만 흐르는 시간)를 받음. 하루 perDay번. provider는 'mock'(시험용 가짜 광고)이며 실제 광고 서비스가 정해지면 ads.js에서 바꿈
  ads: { enabled: true, perDay: 3, mul: 2, sec: 1800, provider: 'mock' },

  // 룰렛: 티켓으로 돌려서 일정 시간(접속 중에만 흐름) 경험치/골드/드롭률 보너스를 받음. 티켓은 매일 첫 접속 1개 (최대 3개까지 모아둘 수 있음)
  roulette: {
    cap: 3,
    segments: [
      { kind: 'exp', mul: 2, sec: 1800 }, { kind: 'gold', mul: 2, sec: 1800 }, { kind: 'drop', mul: 2, sec: 1800 },
      { kind: 'exp', mul: 3, sec: 600 }, { kind: 'gold', mul: 3, sec: 600 }, { kind: 'drop', mul: 3, sec: 600 },
    ],
    kinds: { exp: '경험치', gold: '골드', drop: '장비 드롭' },
  },

  // 무한 모드: 층을 계속 올라가는 도전. 죽거나 시간이 지나면 1층부터. 골드/경험치/드롭 없음 (현재 장비와 능력치 그대로 도전)
  // 몬스터 능력치 = 1지역 5라운드 몬스터 x 층마다 곱해지는 배율 (5층마다 대략 한 지역 정도 강해짐)
  endless: {
    bossEvery: 10, monsters: 6, floorTime: 60, rampFloor: 12, rampStart: 0.3,
    hpPer: 1.34, atkPer: 1.24, baseHp: 800, baseAtk: 25,   // 1층 몬스터 = 1지역 5라운드 몬스터 x baseHp/baseAtk, 이후 층마다 hpPer/atkPer배
    minFloor: 10,          // 이 층 이상 도달해야 랭킹/시즌 보상 대상
    maxJump: 3,            // 서버 검증: 저장 한 번에(그리고 시간당) 늘 수 있는 층 수 여유
    // 시즌이 끝날 때 보상 (rank=등수, pct=상위 비율). 위에서부터 먼저 맞는 항목 하나만 받음
    rewards: [
      { rank: 1, points: 10, title: { key: 'champ', label: '챔피언', buff: { gold: 0.05, drop: 0.05, exp: 0.05 } } },
      { pct: 0.1, points: 3, title: { key: 'elite', label: '정예', buff: { gold: 0.02, drop: 0.02, exp: 0.02 } } },
      { pct: 0.3, points: 2 },
      { pct: 0.5, points: 1 },
    ],
  },

  // 드롭
  drop: { normal: 0.03, boss: 0.5 },
  // 장비 성능은 지역과 무관하고 등급으로만 정해짐 (능력치에 곱해지는 비율). 등급은 지역에 도달해야 드롭/합성됨
  gradeWeights: [100, 12, 3, 0.8, 0.12],  // 일반~전설 드롭 비중 (보스는 높은 등급 쪽으로 치우침)
  gradeUnlock: [1, 4, 7, 8, 9],         // 이 지역(최고 도달 지역)부터 해당 등급이 드롭되고 합성으로 만들 수 있음
  gradeMul: [1, 1.8, 3.2, 6, 11],
  gradeNames: ['일반', '고급', '희귀', '영웅', '전설'],
  gradeColors: ['#b0b8c0', '#6fd16f', '#5aa8ff', '#c47bff', '#ffb53d'],
  itemScale: 3.2,        // 강화 비용 배율: 등급이 처음 나오는 지역마다 이 값씩 곱해짐 (장비 성능이 아니라 강화 가격 기준)
  slots: ['weapon', 'hat', 'armor', 'ring'],
  slotNames: { weapon: '무기', hat: '모자', armor: '옷', ring: '목걸이' },
  slotBase: {            // 일반 등급 +0 기준: 착용하면 해당 능력치가 이 비율만큼 늘어남 (등급 배율, 강화 배율이 곱해짐)
    weapon: { atk: 0.25, mag: 0.25, spd: 0.02 },
    hat: { hp: 0.10, def: 0.10 },
    armor: { hp: 0.15, def: 0.15 },
    ring: { atk: 0.06, mag: 0.06, hp: 0.05 },
  },
  // 직업(무기 종류): 장비는 직업별로 착용 가능. 드롭 직업은 활성화된 것 중 랜덤
  classes: { melee: '근접', ranged: '원거리', mage: '마법' },
  enabledClasses: ['melee', 'ranged', 'mage'],
  // 직업별 성격: curve=[캐릭터 레벨, 주력 능력치 배율] (전사는 초반에 강하고, 마법사는 후반에 강하게), hp=체력 배율, plain=평타 피해 배율, skill=스킬 피해 배율, range=사거리, stat=쓰는 능력치
  classInfo: {
    melee: { title: '전사', weapon: '칼', range: 50, hp: 1.3, plain: 1.0, skill: 1.0, stat: 'atk', recommend: true, curve: [[1, 3.2], [24, 4.5], [38, 4.5], [50, 2.3], [70, 1.3], [100, 1.0]],
      desc: '사거리는 짧지만 몸이 튼튼해요. 처음 시작하기 가장 쉬워요.' },
    ranged: { title: '궁수', weapon: '활', range: 140, hp: 0.7, plain: 0.9, skill: 0.65, stat: 'atk', recommend: false, curve: [[1, 0.6], [40, 0.65], [60, 0.9], [100, 1.2]],
      desc: '멀리서 쏘는 평타가 강해요. 몸은 약해요.' },
    mage: { title: '마법사', weapon: '스태프', range: 120, hp: 0.7, plain: 0.6, skill: 1.2, stat: 'mag', recommend: false, curve: [[1, 0.38], [40, 0.42], [60, 0.8], [75, 1.0], [100, 1.1]],
      desc: '스킬이 아주 강하지만 평타는 약해요. 초반에는 조금 어려워요. (마력을 올려요)' },
  },
  swap: { freeUntil: 10, feeMul: 300 }, // 직업(무기) 교체: 캐릭터 Lv.10 미만은 무료, 이후 비용 = 최고 도달 지역 몬스터 골드 x feeMul. 직업이 다른 장비는 보관함으로 가서 새 직업 장비를 다시 맞춰야 함
  itemNouns: {
    melee: { weapon: '검', hat: '방울 비니', armor: '망토 조끼', ring: '방울 목걸이' },
    ranged: { weapon: '활', hat: '깃털 베레모', armor: '스카프 조끼', ring: '방울 목걸이' },
    mage: { weapon: '스태프', hat: '별 마법모자', armor: '별빛 로브', ring: '방울 목걸이' },
  },

  // 장비 이름: 등급마다 붙는 수식어(장비 번호로 고정되어 섞여 나옴). 전설 무기는 아래 legendWeapons의 고유 이름과 특성을 가짐
  namePrefix: [['낡은', '녹슨', '오래된'], ['평범한', '튼튼한', '쓸만한'], ['빛나는', '숙련자의', '정교한'], ['영웅의', '용사의', '기사단의'], ['전설의']],
  // 전설 무기: 직업마다 세 종류. trait = 착용하면 적용되는 특성
  //  bossDmg: 보스에게 주는 피해 +, cdr: 스킬 쿨타임 감소 비율, procChance/procMul: 기본 공격 때 추가 타격 확률/피해 배율, hpMul: 최대 체력 배율, goldMul: 골드 획득량 +
  legendWeapons: {
    melee: [
      { name: '엑스칼리버', desc: '왕의 검. 보스에게 주는 피해 +20%', trait: { bossDmg: 0.2 } },
      { name: '청룡언월도', desc: '청룡의 기세. 스킬 쿨타임 -15%', trait: { cdr: 0.15 } },
      { name: '쿠사나기의 검', desc: '풀을 베는 신검. 기본 공격 때 15% 확률로 한 번 더 벱니다(피해 60%)', trait: { procChance: 0.15, procMul: 0.6 } },
      { name: '뚜언띠엔', desc: '황금 거북의 검. 최대 체력 +15%', trait: { hpMul: 1.15 } },
    ],
    ranged: [
      { name: '주몽의 활', desc: '백발백중. 기본 공격 때 15% 확률로 화살을 한 발 더 쏩니다(피해 60%)', trait: { procChance: 0.15, procMul: 0.6 } },
      { name: '로빈 후드의 장궁', desc: '부자의 금화를 털던 활. 골드 획득량 +10%', trait: { goldMul: 0.1 } },
      { name: '윌리엄 텔의 석궁', desc: '사과를 꿰뚫는 정밀함. 보스에게 주는 피해 +20%', trait: { bossDmg: 0.2 } },
    ],
    mage: [
      { name: '메를린의 지팡이', desc: '대마법사의 지팡이. 스킬 쿨타임 -15%', trait: { cdr: 0.15 } },
      { name: '서왕모의 복숭아 지팡이', desc: '불로장생의 힘. 최대 체력 +15%', trait: { hpMul: 1.15 } },
      { name: '아누비스의 홀', desc: '심판의 홀. 보스에게 주는 피해 +20%', trait: { bossDmg: 0.2 } },
    ],
  },

  // 보관함 / 합성 / 분해
  inv: { start: 50, step: 5, max: 150, cost: [300, 1.35] },
  merge: { need: 10, maxResultGrade: 3, resultSlots: ['hat', 'armor', 'ring'] }, // 전설은 합성 불가, 결과 부위는 무기 제외
  salvageMul: [1, 3, 8, 20, 50],        // 분해 보상 = 해당 지역 몬스터 골드 x 이 값 (적게)

  // 직업별 스킬 (unlock=해금 캐릭터 레벨, hits=연속 타수, fx=날아가는 연출 종류)
  skills: {
    melee: [
      { name: '강타', unlock: 5, cd: 4, mult: 2.2, aoe: false, range: 50, desc: '대상 하나를 강하게 내려칩니다.' },
      { name: '회전 베기', unlock: 20, cd: 9, mult: 1.6, aoe: true, range: 60, desc: '주변 모든 적을 베어냅니다.' },
      { name: '폭풍 일격', unlock: 50, cd: 24, mult: 7, aoe: false, range: 50, desc: '긴 쿨타임의 필살기. 보스 약점에 맞추면 효과적입니다.' },
    ],
    ranged: [
      { name: '속사', unlock: 5, cd: 3.5, mult: 0.9, hits: 3, aoe: false, range: 140, fx: 'arrow', desc: '화살을 세 번 연달아 쏩니다.' },
      { name: '꿰뚫는 화살', unlock: 20, cd: 8, mult: 1.5, aoe: true, range: 140, fx: 'arrow', desc: '일직선에 있는 모든 적을 꿰뚫습니다.' },
      { name: '별빛 소나기', unlock: 50, cd: 22, mult: 6.5, aoe: true, range: 140, fx: 'star', desc: '하늘에서 별빛이 쏟아져 큰 피해를 줍니다. 보스 약점에 맞추면 효과적입니다.' },
    ],
    mage: [
      { name: '불꽃탄', unlock: 5, cd: 3, mult: 2.4, aoe: false, range: 120, fx: 'fire', desc: '불꽃을 던져 대상 하나를 태웁니다.' },
      { name: '번개 구름', unlock: 20, cd: 7, mult: 1.8, aoe: true, range: 120, fx: 'bolt', desc: '번개가 내리쳐 모든 적에게 피해를 줍니다.' },
      { name: '운석 낙하', unlock: 50, cd: 20, mult: 8, aoe: true, range: 120, fx: 'meteor', desc: '거대한 운석을 떨어뜨립니다. 보스 약점에 맞추면 효과적입니다.' },
    ],
  },

  // 보스 전용 스킬: 보스전에서만 쓸 수 있는 직업별 큰 한 방. 보스 한 번에 한 번만 사용하고, 약점이 드러났을 때 맞추면 피해가 크게 늘어남
  bossSkills: {
    melee:  { name: '천지 가르기', unlock: 15, mult: 10, hits: 1, fx: null, desc: '모든 힘을 모아 보스를 내려칩니다.' },
    ranged: { name: '화살비', unlock: 15, mult: 2.8, hits: 5, fx: 'arrow', desc: '화살 다섯 발을 한꺼번에 퍼붓습니다.' },
    mage:   { name: '대폭발', unlock: 15, mult: 8.5, hits: 1, fx: 'meteor', desc: '모아 둔 마력을 한 번에 터뜨립니다.' },
  },

  // 지역 정의: 전 세계를 도는 여정. 지역마다 나라의 랜드마크가 멀리 보임 (지역 추가는 여기에 항목만 더하면 됩니다)
  regions: [
    { name: '대한민국', prefix: '한국', landmark: 'gyeongbok', sprite: 'dokkaebi', color: '#6ed06e',
      sky: ['#8fd3ff', '#e6f7ff'], hill: '#9bd77a', hill2: '#7fc363', ground: '#5fae4a', groundDark: '#478a38', tree: '#3f8f45', cloud: '#ffffff' },
    { name: '일본', prefix: '일본', landmark: 'fuji', sprite: 'lantern', color: '#f08cb0',
      sky: ['#ffc8de', '#fff3f8'], hill: '#c6e0a6', hill2: '#a6cc86', ground: '#7fbf6a', groundDark: '#5fa050', tree: '#ff9fc0', cloud: '#ffffff' },
    { name: '중국', prefix: '중국', landmark: 'greatwall', sprite: 'jiangshi', color: '#e0604a',
      sky: ['#f4c27e', '#fff0d0'], hill: '#9ab07a', hill2: '#7c9a62', ground: '#8aa860', groundDark: '#6c8a48', tree: '#4a8a50', cloud: '#fff4e0' },
    { name: '인도', prefix: '인도', landmark: 'taj', sprite: 'cobra', color: '#f0a040',
      sky: ['#f6a468', '#ffe4b8'], hill: '#d8a868', hill2: '#c08e50', ground: '#d2b070', groundDark: '#b08e50', tree: '#6a9a3a', cloud: '#ffe9c8' },
    { name: '이집트', prefix: '이집트', landmark: 'pyramid', sprite: 'mummy', color: '#e8c860',
      sky: ['#78c0f0', '#f4e8c0'], hill: '#e0c070', hill2: '#c8a858', ground: '#e6cf84', groundDark: '#c8ae62', tree: '#6a8a3a', cloud: '#ffffff' },
    { name: '이탈리아', prefix: '이탈리아', landmark: 'colosseum', sprite: 'werewolf', color: '#78c868',
      sky: ['#78c8f0', '#e8f6ff'], hill: '#a8c878', hill2: '#8cb060', ground: '#8fb55e', groundDark: '#6f9440', tree: '#4a8a4a', cloud: '#ffffff' },
    { name: '프랑스', prefix: '프랑스', landmark: 'eiffel', sprite: 'gargoyle', color: '#b08ae0',
      sky: ['#b4c4f0', '#f0f0ff'], hill: '#b0c4a0', hill2: '#94aa86', ground: '#88b070', groundDark: '#6a9254', tree: '#6aa070', cloud: '#ffffff' },
    { name: '영국', prefix: '영국', landmark: 'bigben', sprite: 'ghost', color: '#8aa0b8',
      sky: ['#8a9ab0', '#d0d8e0'], hill: '#7a9a78', hill2: '#648a66', ground: '#5f8a5a', groundDark: '#487244', tree: '#3a6a48', cloud: '#e8ecf0' },
    { name: '미국', prefix: '미국', landmark: 'liberty', sprite: 'pumpkin', color: '#6a9ae0',
      sky: ['#66aef0', '#dff0ff'], hill: '#c0a878', hill2: '#a88c60', ground: '#b8a070', groundDark: '#9a8458', tree: '#6a8a4a', cloud: '#ffffff' },
    { name: '브라질', prefix: '브라질', landmark: 'cristo', sprite: 'saci', color: '#40c080',
      sky: ['#3cb8e8', '#c8f0ff'], hill: '#58a85a', hill2: '#3f8a48', ground: '#4aa850', groundDark: '#348a3a', tree: '#2a8a40', cloud: '#ffffff' },
  ],
};





















