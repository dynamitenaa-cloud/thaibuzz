// Meta(페이스북/인스타) API 사용률 감시 → 한도에 가까우면 이번 실행의 게시를 멈추고 다음 실행으로 미룸
// Meta 는 응답 헤더로 사용률(%)을 알려줌:
//   x-app-usage                 : 앱 수준 (페이지 토큰이 아닌 호출. 시간당 200 × 사용자 수)
//   x-business-use-case-usage   : 페이지/인스타 등 비즈니스 사용 사례 수준 (페이지 토큰 호출)
//   x-page-usage                : 페이지 수준
// 각 값의 call_count / total_cputime / total_time 중 가장 큰 % 를 기록
export const USAGE_LIMIT = Number(process.env.META_USAGE_LIMIT || 80);

let peak = 0;

function pct(obj) {
  if (!obj || typeof obj !== 'object') return 0;
  return Math.max(0, ...['call_count', 'total_cputime', 'total_time', 'acc_id_util_pct'].map((k) => Number(obj[k]) || 0));
}

export function trackUsage(res) {
  try {
    for (const h of ['x-app-usage', 'x-page-usage', 'x-ad-account-usage']) {
      const v = res.headers.get(h);
      if (v) peak = Math.max(peak, pct(JSON.parse(v)));
    }
    const buc = res.headers.get('x-business-use-case-usage');
    if (buc) for (const list of Object.values(JSON.parse(buc))) for (const u of [].concat(list)) peak = Math.max(peak, pct(u));
  } catch {}
  return peak;
}

export const usagePeak = () => peak;
// 한도 근처면 true → 호출 쪽에서 남은 게시를 다음 실행으로 미룸
export function overLimit(tag) {
  if (peak < USAGE_LIMIT) return false;
  console.warn(`${tag}: Meta API 사용률 ${peak}% ≥ ${USAGE_LIMIT}% → 남은 게시는 다음 실행으로 미룸`);
  return true;
}
