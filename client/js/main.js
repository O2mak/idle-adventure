// 시작/로그인/저장/메인 루프/중복 접속 방지
(function () {
  const params = new URLSearchParams(location.search);
  // 개발 서버(주소가 develop- 로 시작)에서는 화면에 표시를 해서 라이브와 헷갈리지 않게 함
  if (location.hostname.indexOf('develop-') === 0) { document.title = '[개발] ' + document.title; document.documentElement.classList.add('is-dev'); }
  // 서버 주소(http/https)로 열면 온라인 모드, 파일로 직접 열었거나 ?offline=1 이면 시험(오프라인) 모드
  const online = location.protocol !== 'file:' && !params.get('offline');
  const tabId = Math.random().toString(36).slice(2);
  const ACTIVE_KEY = 'idlegame_active';
  let rt = null, renderer = null, paused = false, started = false, blockerMode = 'tab', pushing = false;
  UI.online = online;

  // ----- 오프라인(시험) 저장 -----
  function loadLocal() {
    try {
      const raw = localStorage.getItem(CFG.saveKey) || localStorage.getItem(CFG.oldSaveKey);
      return raw ? mergeSave(JSON.parse(raw)) : null;
    } catch (e) { return null; }
  }
  function saveLocal() {
    try { localStorage.setItem(CFG.saveKey, JSON.stringify(rt.save)); } catch (e) { /* 무시 */ }
  }

  // ----- 서버 저장 -----
  function setSeason(season) {
    UI.season = season ? { name: season.name, endsAt: season.endsAt, offset: season.serverNow - Date.now() } : null;
  }
  async function pushServer(keepalive) {
    if (pushing && !keepalive) return;
    pushing = true;
    try {
      const r = await API.save(rt.save, keepalive);
      // 오늘의 접속 시간(버닝 타임)은 서버 기록을 기준으로 맞춤 (서버가 더 크면 그 값을 따름)
      if (r.today && rt.save.today) {
        rt.save.today = r.today.date === rt.save.today.date
          ? { date: r.today.date, sec: Math.max(r.today.sec, rt.save.today.sec) }
          : { date: r.today.date, sec: r.today.sec };
      }
      // 무한 모드 기록은 서버가 인정한 값을 따름 (검증을 통과하지 못한 기록은 되돌려짐)
      if (r.endless && r.endless.best < rt.save.endless.best) { rt.save.endless = r.endless; msg(rt, '서버가 무한 모드 기록을 확인하지 못해 이전 기록으로 되돌렸어요.', 'bad'); }
      if (r.rolled) {
        paused = true;
        alert('새 시즌이 시작되었어요! 화면을 새로 불러옵니다.');
        location.reload();
      }
    } catch (e) {
      if (e.status === 401) {
        paused = true;
        blockerMode = 'relogin';
        $('takeoverBtn').textContent = '다시 로그인';
        showBlocker('다른 곳에서 접속했거나 로그인이 만료되었어요', '한 계정은 한 번에 한 곳에서만 플레이할 수 있어요.');
      } else if (e.status === 422) {
        console.warn('서버가 저장을 거부했어요:', e.message);
        msg(rt, '서버가 진행 상황 저장을 거부했어요. (' + e.message + ')', 'bad');
      } // 네트워크 오류는 다음 주기에 다시 시도
    } finally { pushing = false; }
  }
  function persist(keepalive) {
    if (!rt || paused) return;
    if (online) pushServer(keepalive); else saveLocal();
  }

  // ----- 같은 브라우저의 다른 탭 방지 -----
  function readActive() {
    try { return JSON.parse(localStorage.getItem(ACTIVE_KEY) || 'null'); } catch (e) { return null; }
  }
  function beat() { try { localStorage.setItem(ACTIVE_KEY, JSON.stringify({ id: tabId, ts: Date.now() })); } catch (e) { /* 무시 */ } }
  function otherActive() {
    const a = readActive();
    return a && a.id !== tabId && Date.now() - a.ts < 5000;
  }
  function showBlocker(title, text) {
    $('blockerTitle').textContent = title; $('blockerText').textContent = text;
    $('blocker').classList.remove('hidden');
  }

  // 동물 고유 능력 설명 (시작/가입 화면에서 미리 보여 줌)
  function animalNote(el, a) { const k = CFG.animalSkills[a]; if (el) el.textContent = `${a === 'dog' ? '강아지' : '고양이'} · ${k.name}: ${k.desc} (Lv.${k.unlock}부터) — 동물은 시즌이 시작될 때만 고를 수 있어요.`; }

  // ----- 화면 미리보기 -----
  function drawPreviews() {
    document.querySelectorAll('canvas[data-sprite]').forEach((c) => {
      const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.clearRect(0, 0, 96, 96);
      g.drawImage(animalSprite(c.dataset.sprite, { eyes: 'open', mouth: false, tail: 0 }), 0, 0, 96, 96);
    });
  }

  window.addEventListener('herochange', drawPreviews);

  // ----- 시험(오프라인) 시작 화면 -----
  function showStart() {
    $('startOverlay').classList.remove('hidden');
    drawPreviews();
    let animal = 'dog', cls = 'melee';
    buildClassPicker($('clsPickStart'), (c) => { cls = c; });
    document.querySelectorAll('#startOverlay .animal').forEach((b) => b.addEventListener('click', () => {
      animal = b.dataset.animal; animalNote($('startAnimalInfo'), animal);
      document.querySelectorAll('#startOverlay .animal').forEach((x) => x.classList.toggle('sel', x === b));
    }));
    animalNote($('startAnimalInfo'), animal);
    $('startBtn').addEventListener('click', () => {
      const name = $('startName').value.trim().slice(0, 12) || '모험가';
      $('startOverlay').classList.add('hidden');
      begin(newSave(animal, name, cls));
    });
  }

  // ----- 로그인 / 가입 -----
  function showLogin(message) {
    $('loginOverlay').classList.remove('hidden');
    drawPreviews();
    let mode = 'login', animal = 'dog', cls = 'melee';
    buildClassPicker($('clsPickReg'), (c) => { cls = c; });
    const msgEl = $('liMsg');
    msgEl.textContent = message || '';
    const setMode = (m) => {
      mode = m;
      document.querySelectorAll('[data-login-tab]').forEach((b) => b.classList.toggle('on', b.dataset.loginTab === m));
      $('regOnly').classList.toggle('hidden', m !== 'register');
      $('liBtn').textContent = m === 'register' ? '가입하고 시작' : '로그인';
      $('liPw').autocomplete = m === 'register' ? 'new-password' : 'current-password';
      msgEl.textContent = '';
    };
    document.querySelectorAll('[data-login-tab]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.loginTab)));
    document.querySelectorAll('[data-reg-animal]').forEach((b) => b.addEventListener('click', () => {
      animal = b.dataset.regAnimal; animalNote($('regAnimalInfo'), animal);
      document.querySelectorAll('[data-reg-animal]').forEach((x) => x.classList.toggle('sel', x === b));
    }));
    animalNote($('regAnimalInfo'), animal);
    const submit = async () => {
      const id = $('liId').value.trim(), pw = $('liPw').value;
      if (!id || !pw) { msgEl.textContent = '아이디와 비밀번호를 입력해 주세요.'; return; }
      $('liBtn').disabled = true; msgEl.textContent = '';
      try {
        const d = mode === 'register'
          ? await API.register(id, pw, $('liNick').value.trim(), animal, cls)
          : await API.login(id, pw);
        $('loginOverlay').classList.add('hidden');
        enter(d);
      } catch (e) {
        msgEl.textContent = e.message || '실패했어요.';
      } finally { $('liBtn').disabled = false; }
    };
    $('liBtn').addEventListener('click', submit);
    ['liId', 'liPw', 'liNick'].forEach((id) => $(id).addEventListener('keydown', (ev) => { if (ev.key === 'Enter') submit(); }));
  }

  // 서버에서 받은 데이터로 게임 시작
  function enter(d) {
    setSeason(d.season);
    begin(mergeSave(d.save));
    if (d.rolled) msg(rt, `새 시즌이 시작되었어요! (${d.season.name}) 영구 포인트와 닉네임은 이어집니다.`, 'ok');
    showReward();
    if (!rt.save.animalLocked) openAnimalPick();   // 새 시즌: 동물을 다시 고름
    else if (rt.save.tickets > 0) setTimeout(() => uiAct('roulette'), 500);   // 접속하면 룰렛부터
  }

  // 지난 시즌 무한 모드 순위 보상 알림 (한 번 보여준 뒤 지움)
  function showReward() {
    const w = rt.save.reward;
    if (!w) return;
    const text = `시즌 ${w.season} 무한 모드 결과\n\n최고 ${w.floor}층 · ${w.total}명 중 ${w.rank}등\n` +
      (w.points || w.title ? `\n보상: 영구 포인트 +${w.points}${w.title ? `\n칭호: ${w.title}` : ''}` : '\n이번에는 보상 순위에 들지 못했어요. 다음 시즌에 다시 도전해 보세요!');
    rt.save.reward = null;
    persist();
    setTimeout(() => alert(text), 300);
  }

  // ----- 게임 시작 -----
  function begin(save) {
    if (started) return;
    started = true;
    Sound.load();
    document.body.className = 'mode-' + (function () { try { return localStorage.getItem('idlegame_mode') || 'full'; } catch (e) { return 'full'; } })();
    rt = createRuntime(save);
    renderer = new Renderer($('view'), $('fx')); UI.renderer = renderer;   // 작은 창(영상)이 탭이 뒤로 가도 그릴 수 있게
    uiInit(rt);
    UI.onChange = onUiChange;
    beat();
    persist();
    startLoops();
  }

  // 화면에서 서버 작업이 필요한 요청들 (닉네임, 비밀번호, 로그아웃, 초기화)
  async function onUiChange(what, value) {
    if (what === 'reset') {
      try { localStorage.removeItem(CFG.saveKey); localStorage.removeItem(CFG.oldSaveKey); } catch (e) { /* 무시 */ }
      paused = true; location.reload();
    } else if (what === 'logout') {
      paused = true;
      try { await pushServerFinal(); await API.logout(); } catch (e) { API.setToken(null); }
      location.reload();
    } else if (what === 'nickname') {
      try {
        const r = await API.nickname(value);
        rt.save.name = r.nickname; UI.lastHtml = ''; uiUpdate();
        msg(rt, `닉네임을 '${r.nickname}'(으)로 바꿨어요.`, 'ok');
      } catch (e) { alert(e.message); UI.lastHtml = ''; uiUpdate(); }
    } else if (what === 'password') {
      try {
        await API.password(value.oldPassword, value.newPassword);
        alert('비밀번호를 바꿨어요.');
        UI.lastHtml = ''; uiUpdate();
      } catch (e) { alert(e.message); }
    }
  }
  async function pushServerFinal() { try { await API.save(rt.save); } catch (e) { /* 무시 */ } }

  function startLoops() {
    let last = performance.now(), acc = 0;
    // 로직은 setInterval + 실제 경과 시간 기준 (탭이 백그라운드여도 진행)
    setInterval(() => {
      const now = performance.now();
      acc += (now - last) / 1000; last = now;
      if (paused) { acc = 0; return; }
      if (acc > CFG.catchUpMax) acc = CFG.catchUpMax;
      while (acc >= CFG.tickDt) { step(rt, CFG.tickDt); acc -= CFG.tickDt; }
      // 소리: 탭이 보일 때만 재생 (숨겨져 있을 때는 소리 없이 쌓인 사건만 비움)
      if (!document.hidden) { Sound.playEvents(rt.ev); Sound.setRegion(stageRegion(rt)); }
      rt.ev.length = 0;
    }, 50);
    // 브라우저 정책상 사용자가 한 번 누르거나 키를 눌러야 소리를 낼 수 있음
    const unlock = () => Sound.unlock();
    document.addEventListener('pointerdown', unlock); document.addEventListener('keydown', unlock);

    (function frame() {
      try { if (!paused) { renderer.draw(rt); uiUpdateSkills(); } } catch (e) { console.error(e); }
      requestAnimationFrame(frame);
    })();

    setInterval(() => { if (!paused) { rollDay(rt.save); uiUpdate(); } }, 250);
    setInterval(() => persist(), online ? 30000 : 5000);

    // 하트비트 + 다른 탭이 가져가면 이 탭은 정지
    setInterval(() => {
      const a = readActive();
      if (!paused && a && a.id !== tabId && Date.now() - a.ts < 5000) {
        paused = true; blockerMode = 'tab';
        $('takeoverBtn').textContent = '여기서 플레이';
        showBlocker('다른 탭에서 게임이 실행되어 이 탭은 멈췄습니다', '한 계정은 한 번에 한 곳에서만 플레이할 수 있어요.');
      } else if (!paused) beat();
    }, 1500);

    document.addEventListener('visibilitychange', () => { if (document.hidden) persist(true); });
    window.addEventListener('pagehide', () => {
      persist(true);
      // 새로고침/닫기 직후 다시 열 때 "다른 탭에서 실행 중"으로 잘못 막히지 않도록 내 접속 표시를 지움
      const a = readActive();
      if (a && a.id === tabId) { try { localStorage.removeItem(ACTIVE_KEY); } catch (e) { /* 무시 */ } }
    });
  }

  $('takeoverBtn').addEventListener('click', async () => {
    if (blockerMode === 'relogin') { API.setToken(null); location.reload(); return; }
    $('blocker').classList.add('hidden');
    beat();
    if (!started) { init(); return; }
    let fresh = null;
    try { fresh = online ? mergeSave((await API.me()).save) : loadLocal(); } catch (e) { fresh = null; }
    rt = createRuntime(fresh || rt.save);
    setRuntime(rt);
    paused = false;
  });

  // ----- 진입점 -----
  async function init() {
    if (online) {
      API.load();
      if (!API.token) { showLogin(); return; }
      try { enter(await API.me()); }
      catch (e) {
        if (e.status === 401) { API.setToken(null); showLogin(); }
        else showLogin(e.message);
      }
      return;
    }
    // 시험(오프라인) 모드
    let save = loadLocal();
    if (!save && (params.get('dev') || params.get('animal'))) {
      save = newSave(params.get('animal') || 'cat', params.get('name') || '테스트', params.get('job'));
      if (params.get('dev')) save.gold = 200000;
    }
    // 개발용: ?stage=1-10, ?tab=equip, ?mode=mini, ?items=N&cls=melee,ranged, ?sel=eq:hat
    if (save && params.get('points')) { save.permPoints = Number(params.get('points')); }
    if (save && params.get('title')) { save.titles = [{ id: 't1', name: '시즌1 1등', season: 1, buff: { gold: 0.02 } }]; save.season = Number(params.get('title')); }
    if (save && params.get('level')) { save.level = Math.min(CFG.level.cap, Math.max(1, Number(params.get('level')))); save.exp = 0; }
    if (save && params.get('stage')) {
      const [r, rd] = params.get('stage').split('-').map(Number);
      save.region = r; save.round = rd; save.best = { region: r, round: rd }; save.lock = true;
      if (params.get('hard')) { save.clearedRegions = CFG.regions.map((_, i) => i + 1); save.best = { region: CFG.regions.length, round: CFG.roundsPerRegion }; save.hard = true; save.hardBest = { region: r, round: rd }; }
    }
    if (save && params.get('items')) {
      const n = Number(params.get('items')), tmp = createRuntime(save, 7), cl = (params.get('cls') || 'melee').split(',');
      for (let i = 0; i < n; i++) addItem(tmp, makeItem(save, CFG.slots[i % 4], i % 4 === 3 ? 1 : (i % 5), 1 + (i % 3), cl[i % cl.length]), true);
    }
    if (params.get('tab')) UI.tab = params.get('tab');
    if (params.get('sel')) { const [t, k] = params.get('sel').split(':'); UI.sel = { t, k }; }
    if (params.get('mode')) { try { localStorage.setItem('idlegame_mode', params.get('mode')); } catch (e) { /* 무시 */ } }

    if (save) begin(save); else showStart();
  }

  if (otherActive()) {
    blockerMode = 'tab';
    showBlocker('다른 탭에서 게임이 실행 중입니다', '한 계정은 한 번에 한 곳에서만 플레이할 수 있어요. 여기서 시작하면 다른 탭은 멈춥니다.');
  } else init();
})();


