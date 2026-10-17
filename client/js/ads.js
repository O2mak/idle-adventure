// 보상형 광고. 지금은 시험용 가짜 광고(5초 카운트다운)만 있습니다.
// 실제 광고 서비스(예: 구글 애드센스/애드몹)를 붙일 때는 Ads.show 안에서 그 서비스의 '보상형 광고 재생' 함수를 호출하고,
// 끝까지 봤을 때만 resolve(true) 하면 나머지(횟수 제한, 보상 지급, 서버 검증)는 그대로 동작합니다.
const Ads = {
  show() {
    if (CFG.ads.provider !== 'mock') return Promise.resolve(false);
    return new Promise((resolve) => {
      const ov = document.getElementById('adPlayer'), bar = document.getElementById('adBar'), txt = document.getElementById('adCount'), skip = document.getElementById('adSkip');
      let left = 5, done = false;
      const finish = (ok) => { if (done) return; done = true; clearInterval(iv); ov.classList.add('hidden'); resolve(ok); };
      ov.classList.remove('hidden'); bar.style.width = '0%'; txt.textContent = left;
      const iv = setInterval(() => { left--; txt.textContent = Math.max(0, left); bar.style.width = ((5 - left) / 5 * 100) + '%'; if (left <= 0) finish(true); }, 1000);
      skip.onclick = () => finish(false);
    });
  },
};
