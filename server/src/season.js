// 시즌 계산: 첫 시즌 시작 시각 이후, 매월 1일 / 15일 오전 6시(한국 시간)에 새 시즌.
// 첫 시즌 시작 전에는 index 0 (테스트 시즌)
const DEFAULT_FIRST = '2026-12-01T06:00:00+09:00';

// 한국 시간 y-m-d 06:00 을 UTC 밀리초로 (한국은 UTC+9, 서머타임 없음)
const kst = (y, m, d) => Date.UTC(y, m, d, 6 - 9);

// 시작 시각이 속한 달의 1일/15일 중 하나로 맞춰 경계 목록을 만들어 주는 제너레이터
function* boundaries(firstMs) {
  const k = new Date(firstMs + 9 * 3600e3); // 한국 시간 달력으로 읽기 위한 이동
  let y = k.getUTCFullYear(), m = k.getUTCMonth(), half = k.getUTCDate() >= 15 ? 1 : 0;
  for (;;) {
    yield kst(y, m, half ? 15 : 1);
    if (half) { half = 0; m++; if (m > 11) { m = 0; y++; } } else half = 1;
  }
}

export function seasonInfo(nowMs, env) {
  const firstMs = Date.parse((env && env.FIRST_SEASON_START) || DEFAULT_FIRST);
  if (!(firstMs > 0)) throw new Error('FIRST_SEASON_START 설정이 올바르지 않습니다');
  // 시험용: TEST_SEASON_HOURS 가 있으면 시즌 길이를 그 시간으로 고정 (첫 시즌 시작 시각부터 연속). 정식 운영 때는 이 설정을 지움
  const testH = Number(env && env.TEST_SEASON_HOURS);
  if (testH > 0) {
    const len = testH * 3600e3;
    if (nowMs < firstMs) return { index: 0, startsAt: null, endsAt: firstMs, name: '시즌 0 (테스트)' };
    const index = Math.floor((nowMs - firstMs) / len) + 1;
    return { index, startsAt: firstMs + (index - 1) * len, endsAt: firstMs + index * len, name: `시즌 ${index} (테스트)` };
  }
  if (nowMs < firstMs) return { index: 0, startsAt: null, endsAt: firstMs, name: '시즌 0 (테스트)' };
  let index = 0, start = firstMs, end = firstMs;
  for (const b of boundaries(firstMs)) {
    if (b > nowMs) { end = b; break; }
    index++; start = b;
    if (index > 5000) throw new Error('시즌 계산 오류');
  }
  return { index, startsAt: start, endsAt: end, name: `시즌 ${index}` };
}

