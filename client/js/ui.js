// 화면 UI (HUD, 탭 패널, 입력 처리, PiP, 장비 칸/툴팁)
const UI = { rt: null, tab: 'growth', qty: 1, lastHtml: '', lastLog: '', onChange: null, pipWin: null, sel: null, online: false, season: null };
// [키, 이름, 아이콘, 위치] 위치: main=위쪽 큰 탭(캐릭터 키우기), dock=아래쪽 메뉴(모험/랭킹/영구/설정)
const TABS = [['growth', '성장', 'growth', 'main'], ['equip', '장비', 'hat', 'main'], ['skills', '스킬', 'star', 'main'], ['stage', '스테이지', 'flag', 'dock'], ['endless', '무한', 'tower', 'dock'], ['perm', '영구', 'gem', 'dock'], ['set', '설정', 'gear', 'dock']];
const tabLabel = (t, dot) => mi(t[2]) + `<span>${t[1]}</span>` + (dot ? '<i class="dot"></i>' : '');
// PiP 창으로 옮겨진 요소도 찾을 수 있게
const $ = (id) => document.getElementById(id) || (UI.pipWin && !UI.pipWin.closed ? UI.pipWin.document.getElementById(id) : null);
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const AUTO_SALV = [-1, 0, 1];

function uiInit(rt) {
  UI.rt = rt;
  for (const [id, where] of [['tabs', 'main'], ['dock', 'dock']]) $(id).innerHTML = TABS.filter((t) => t[3] === where).map((t) => `<button data-act="tab:${t[0]}">${tabLabel(t, false)}</button>`).join('');
  buildSkillbar();
  document.addEventListener('pointerdown', (ev) => {
    const el = ev.target.closest('[data-act]');
    if (!el || el.disabled) return;
    ev.preventDefault();
    // 더블클릭(빠르게 두 번 누르기): 보관함 장비는 장착, 착용 중인 장비는 해제.
    // 첫 클릭에서 화면이 다시 그려져도 인식되도록 직접 시간을 재서 판단
    const key = el.dataset.uid ? 'inv:' + el.dataset.uid : el.dataset.slot ? 'eq:' + el.dataset.slot : '';
    const now = performance.now();
    if (key && UI.lastTap && UI.lastTap.key === key && now - UI.lastTap.t < 450) {
      UI.lastTap = null;
      if (el.dataset.uid) uiAct('equip:' + el.dataset.uid);
      else if (UI.rt.save.equip[el.dataset.slot]) uiAct('unequip:' + el.dataset.slot);
      return;
    }
    uiAct(el.dataset.act);
    UI.lastTap = key ? { key, t: performance.now() } : null;
  });
  document.addEventListener('input', (ev) => { if (ev.target.id === 'fbText') UI.fbDraft = ev.target.value; if (ev.target.id === 'volRange') Sound.setVol(Number(ev.target.value) / 100); });
  document.addEventListener('change', (ev) => {
    if (ev.target.id === 'nickInput') {
      const v = ev.target.value.trim().slice(0, 12);
      if (!v) return;
      if (UI.online && UI.onChange) UI.onChange('nickname', v); // 서버가 중복/금칙어를 확인
      else { UI.rt.save.name = v; uiUpdate(); }
    }
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.target.tagName === 'INPUT' || ev.ctrlKey || ev.altKey) return;
    if (ev.key >= '1' && ev.key <= '3') castSkill(UI.rt, Number(ev.key) - 1);
    else if (ev.key === 'm' || ev.key === 'M') uiAct('manual');
    else if (ev.key === 'l' || ev.key === 'L') uiAct('lock');
  });
  // 미니(펫) 모드에서 캐릭터를 누르면 전체 화면으로 (설정에서 끌 수 있음)
  $('stage').addEventListener('pointerdown', () => {
    if (document.body.className === 'mode-mini' && UI.rt.save.miniClick) uiAct('mode:full');
  });
  initTooltip();
  if (window.ResizeObserver) new ResizeObserver(fitCanvas).observe($('gamePane'));
  window.addEventListener('resize', fitCanvas);
  fitCanvas();
  uiUpdate();
}

function setRuntime(rt) { UI.rt = rt; UI.lastHtml = ''; UI.sel = null; buildSkillbar(); uiUpdate(); }

// 직업 선택 버튼 만들기 (가입/시작 화면에서 사용). 선택이 바뀌면 onPick(직업) 호출
function buildClassPicker(el, onPick) {
  el.innerHTML = CFG.enabledClasses.map((c, i) => {
    const ci = CFG.classInfo[c];
    const icon = itemIconUrl({ slot: 'weapon', cls: c, region: 1, grade: 0 });
    return `<button type="button" class="clsbtn ${ci.recommend ? 'sel' : ''}" data-cls="${c}">${ci.recommend ? '<i>추천</i>' : ''}` +
      `<img src="${icon}" alt=""><b>${ci.title} (${ci.weapon})</b><span>${esc(ci.desc)}</span></button>`;
  }).join('');
  el.querySelectorAll('.clsbtn').forEach((b) => b.addEventListener('click', () => {
    el.querySelectorAll('.clsbtn').forEach((x) => x.classList.toggle('sel', x === b));
    onPick(b.dataset.cls);
  }));
}

// ---------- 마우스 올리면 나오는 상세 정보 ----------
function initTooltip() {
  const tip = document.createElement('div');
  tip.id = 'tip'; tip.style.display = 'none';
  document.body.appendChild(tip);
  const place = (ev) => {
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let x = ev.clientX + 16, y = ev.clientY + 16;
    if (x + w > window.innerWidth - 8) x = ev.clientX - w - 16;
    if (y + h > window.innerHeight - 8) y = window.innerHeight - h - 8;
    tip.style.left = Math.max(4, x) + 'px'; tip.style.top = Math.max(4, y) + 'px';
  };
  document.addEventListener('mouseover', (ev) => {
    const el = ev.target.closest('[data-tip]');
    const html = el ? tipHtml(el.dataset.tip) : '';
    if (!html) { tip.style.display = 'none'; return; }
    tip.innerHTML = html; tip.style.display = 'block'; place(ev);
  });
  document.addEventListener('mousemove', (ev) => { if (tip.style.display === 'block') place(ev); });
  document.addEventListener('pointerdown', () => { tip.style.display = 'none'; });
}

function tipHtml(key) {
  const s = UI.rt.save, [t, k] = key.split(':');
  if (t === 'eq') { const it = s.equip[k]; return it ? itemInfoHtml(it, 'eq') : ''; }
  const it = s.inv.find((x) => String(x.uid) === k);
  return it ? itemInfoHtml(it, 'inv') + '<div class="thint">더블클릭: 장착</div>' : '';
}

// 화면 크기에 맞춰 전투 캔버스를 정수배로 확대 (도트가 뭉개지지 않도록)
function fitCanvas() {
  const stage = $('stage'), fc = $('fx');
  if (!stage || !fc) return;
  const pip = UI.pipWin && !UI.pipWin.closed ? UI.pipWin : null;
  let avail;
  if (pip) avail = pip.innerWidth;
  else {
    const gp = $('gamePane'), cs = getComputedStyle(gp);
    avail = gp.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  }
  const W = CFG.view.w;
  let w = avail >= W * 2 ? W * Math.floor(avail / W) : avail;
  w = Math.max(120, Math.floor(w));
  stage.style.width = w + 'px';
  const dpr = (pip || window).devicePixelRatio || 1;
  fc.width = Math.round(w * dpr); fc.height = Math.round(w * CFG.view.h / W * dpr);
}

function buildSkillbar() {
  const list = skillList(UI.rt.save);
  $('skillbar').innerHTML = list.map((sk, i) =>
    `<button class="skill ${sk.special ? 'special' : ''}" data-act="cast:${i}" title="${esc(sk.desc)}"><span class="key">${i + 1}</span><span class="nm">${esc(sk.name)}</span><div class="cdmask"></div><span class="cdtxt"></span></button>`).join('');
}

// 작은 창(PiP)으로 전투 화면 분리: 크롬/엣지의 Document Picture-in-Picture 기능 사용
async function openPip() {
  if (UI.pipWin && !UI.pipWin.closed) { UI.pipWin.close(); return; }
  if (!('documentPictureInPicture' in window)) {
    alert('이 브라우저는 작은 창 분리를 지원하지 않습니다. (크롬/엣지 최신 버전에서 사용할 수 있어요)');
    return;
  }
  try {
    const w = await window.documentPictureInPicture.requestWindow({ width: 320, height: 200 });
    for (const sheet of document.styleSheets) {
      try {
        const st = w.document.createElement('style');
        st.textContent = [...sheet.cssRules].map((r) => r.cssText).join('\n');
        w.document.head.appendChild(st);
      } catch (e) {
        if (sheet.href) { const l = w.document.createElement('link'); l.rel = 'stylesheet'; l.href = sheet.href; w.document.head.appendChild(l); }
      }
    }
    w.document.body.className = 'mode-pip';
    const stage = $('stage'), holder = stage.parentNode, next = stage.nextSibling;
    UI.pipWin = w;
    w.document.body.appendChild(stage);
    w.addEventListener('pagehide', () => {
      holder.insertBefore(stage, next);
      UI.pipWin = null;
      fitCanvas();
    });
    w.addEventListener('resize', fitCanvas);
    fitCanvas();
  } catch (e) {
    UI.pipWin = null;
    alert('작은 창을 열지 못했어요. (' + e.message + ')\n파일로 직접 열었을 때는 막힐 수 있고, 도메인(https)에 올리면 동작합니다.');
  }
}

function uiAct(act) {
  const rt = UI.rt, s = rt.save;
  const [a, b, c] = act.split(':');
  switch (a) {
    case 'tab': UI.tab = b; break;
    case 'qty': UI.qty = b === 'max' ? 'max' : Number(b); break;
    case 'stat': buyStat(s, b, UI.qty); refresh(rt); break;
    case 'up': buyUp(s, b, UI.qty); break;
    case 'enh': buyEnh(s, b, UI.qty); refresh(rt); break;
    case 'skill': buySkill(s, Number(b), UI.qty); break;
    case 'cast': castSkill(rt, Number(b)); break;
    case 'lock': s.lock = !s.lock; break;
    case 'manual': s.bossManual = !s.bossManual; break;
    case 'mode':
      document.body.className = 'mode-' + b;
      try { localStorage.setItem('idlegame_mode', b); } catch (e) { /* 무시 */ }
      fitCanvas();
      break;
    case 'pip': openPip(); break;
    case 'sound': { const on = Sound.sfxOn || Sound.bgmOn; Sound.setOn(!on, !on); break; }
    case 'sfx': Sound.setOn(!Sound.sfxOn, Sound.bgmOn); break;
    case 'bgm': Sound.setOn(Sound.sfxOn, !Sound.bgmOn); break;
    case 'awaken': {
      const w = s.equip.weapon;
      if (!w || w.enh < CFG.enh.max || w.enh >= CFG.enh.awaken.max) break;
      const A = CFG.enh.awaken, n = w.enh + 1, i = n - CFG.enh.max - 1;
      const text = `무기를 +${w.enh} → +${n} 로 각성할까요?\n\n비용 ${fmt(awakenCost(n))} G (실패해도 돌려받지 못해요)\n성공 확률 ${Math.round(awakenChance(w) * 100)}% (연속으로 실패하면 확률이 조금씩 올라가요)\n성공하면 최종 공격력·마력 +${Math.round(A.bonus[i] * 100)}%` +
        (n >= A.dropFrom ? `\n\n실패하면 +${w.enh - 1}로 내려갑니다!` : '') + '\n\n보통은 스탯에 투자하는 것이 훨씬 이득이에요. 정말 도전할까요?';
      if (confirm(text)) { const r = tryAwaken(rt); UI.sel = { t: 'eq', k: 'weapon' }; if (r.ok) UI.awkResult = { ...r, at: Date.now() }; }
      break;
    }
    case 'roulette': rouletteAct(b); return;
    case 'fbcat': UI.fbCat = b; break;
    case 'fb': sendFeedbackUi(); return;
    case 'ad': adAct(b, c); return;
    case 'layout': UI.layout = b; try { localStorage.setItem('idlegame_layout', b); } catch (e) { /* 무시 */ } break;
    case 'chap': {
      const N = CFG.regions.length;
      UI.chap = b === 'prev' ? Math.max(1, (UI.chap || s.region) - 1) : b === 'next' ? Math.min(N, (UI.chap || s.region) + 1) : Number(b);
      break;
    }
    case 'go':
      if (canEnter(s, Number(b), Number(c))) { if (rt.endless) exitEndless(rt); setStage(rt, Number(b), Number(c), true); }
      break;
    case 'endless':
      if (b === 'start') startEndless(rt);
      else if (b === 'exit') exitEndless(rt);
      else if (b === 'refresh') fetchRanking(true);
      break;
    case 'animal': s.animal = b; break;
    case 'miniclick': s.miniClick = !s.miniClick; break;
    case 'sel': UI.sel = { t: b, k: c }; break;
    case 'permup': if (buyPerm(s, b)) refresh(rt); break;
    case 'permreset':
      if (permSpent(s) > 0 && confirm('영구 포인트 투자를 모두 되돌릴까요? (포인트는 그대로 돌려받아요)')) { resetPerm(s); refresh(rt); }
      break;
    case 'swap': {
      const pv = swapPreview(s, b), ci = CFG.classInfo[b];
      if (!pv.ok) { alert(pv.reason); break; }
      const text = `${ci.title}(${ci.weapon})(으)로 바꿀까요?\n\n` +
        `• 스탯/스킬에 투자한 ${fmt(pv.invested)}G 중 ${Math.round(CFG.swap.refund * 100)}%인 ${fmt(pv.refund)}G를 돌려받고, 투자는 0으로 초기화돼요.\n` +
        `• 지금 끼고 있는 장비 ${pv.mismatched}개는 보관함으로 이동해요. (직업이 달라서 착용할 수 없어요)\n` +
        `• 레벨(Lv.${s.level}), 골드 획득량/드롭률, 장비 강화는 그대로예요.\n` +
        `• ${ci.title}의 스킬은 레벨에 맞춰 다시 해금돼요.`;
      if (confirm(text)) { switchClass(rt, b); buildSkillbar(); UI.sel = null; }
      break;
    }
    case 'equip': {
      const it = s.inv.find((x) => x.uid === Number(b));
      if (it && equipItem(rt, it.uid)) UI.sel = { t: 'eq', k: it.slot };
      break;
    }
    case 'unequip': {
      if (unequipItem(rt, b)) UI.sel = { t: 'inv', k: String(s.inv[s.inv.length - 1].uid) };
      break;
    }
    case 'equipbest': equipBest(rt); break;
    case 'salv': salvageItem(rt, Number(b)); UI.sel = null; break;
    case 'salvgrade': salvageUpTo(rt, Number(b)); UI.sel = null; break;
    case 'merge': mergeGroup(rt, b, Number(c)); break;
    case 'mergeall': mergeAll(rt); break;
    case 'invup': buyInvCap(s); break;
    case 'autosalv': s.autoSalvage = AUTO_SALV[(AUTO_SALV.indexOf(s.autoSalvage) + 1) % AUTO_SALV.length]; break;
    case 'reset':
      if (confirm('정말 모든 진행 상황을 지울까요? 되돌릴 수 없습니다.')) { if (UI.onChange) UI.onChange('reset'); return; }
      break;
    case 'logout': if (UI.onChange) UI.onChange('logout'); return;
    case 'pwchange': {
      const o = $('pwOld'), n = $('pwNew');
      if (UI.onChange && o && n) UI.onChange('password', { oldPassword: o.value, newPassword: n.value });
      return;
    }
  }
  UI.lastHtml = '';
  uiUpdate();
}

// ---------- 패널 HTML ----------
function qtyBar() {
  return `<div class="qty">${[1, 10, 'max'].map((q) =>
    `<button class="chip ${UI.qty === q ? 'on' : ''}" data-act="qty:${q}">${q === 'max' ? '최대' : '×' + q}</button>`).join('')}</div>`;
}

function buyRow(name, sub, lvText, act, costFn, lv, cap) {
  const s = UI.rt.save;
  const plan = planBuy(costFn, lv, UI.qty, s.gold, cap);
  const maxed = cap !== undefined && lv >= cap;
  const shown = plan.n > 0 ? plan.total : costFn(lv);
  const label = maxed ? '최대' : `${fmt(shown)} G${plan.n > 1 ? ` (+${plan.n})` : ''}`;
  return `<div class="row"><div class="rn">${name}<small>${sub}</small></div><div class="rl">${lvText}</div>` +
    `<button class="buy" data-act="${act}" ${plan.n > 0 && !maxed ? '' : 'disabled'}>${label}</button></div>`;
}

function panelGrowth() {
  const rt = UI.rt, s = rt.save, d = rt.d, st = s.stats;
  const sc = (k) => (n) => costOf(CFG.statCost[k], n);
  let h = `<div class="head"><span class="gold">${mi('coin')}${fmt(s.gold)} G</span>${qtyBar()}</div>`;
  const ci = CFG.classInfo[s.weaponType];
  h += `<div class="row"><div class="rn"><b>직업: ${ci.title}</b> <span class="badge">${CFG.classes[s.weaponType]}</span><small>${esc(ci.desc)}</small></div>` +
    CFG.enabledClasses.filter((c) => c !== s.weaponType).map((c) => `<button class="chip" data-act="swap:${c}">${CFG.classInfo[c].title}(으)로</button>`).join('') + '</div>';
  const need = expNeed(s.level);
  h += `<div class="row"><div class="rn"><b>캐릭터 Lv.${s.level}</b>${s.level >= CFG.level.cap ? ' (최대 레벨)' : ''}` +
    `<small>${s.level >= CFG.level.cap ? '' : `경험치 ${fmt(s.exp)} / ${fmt(need)} · `}레벨업마다 체력 +${CFG.level.hp}, 공격력 +${CFG.level.atk}, 마력 +${CFG.level.mag}</small></div></div>`;
  h += buyRow(mi('heart') + '체력', `현재 ${fmt(d.hp)}`, `Lv.${st.hp}`, 'stat:hp', sc('hp'), st.hp);
  const star = (k) => (ci.stat === k ? ' ★ 현재 직업의 주력' : ' · 현재 직업은 쓰지 않아요');
  h += buyRow(mi('sword') + '공격력', `현재 ${fmt(d.atk)} (전사/궁수가 사용)${star('atk')}`, `Lv.${st.atk}`, 'stat:atk', sc('atk'), st.atk);
  h += buyRow(mi('magic') + '마력', `현재 ${fmt(d.mag)} (마법사가 사용)${star('mag')}`, `Lv.${st.mag}`, 'stat:mag', sc('mag'), st.mag);
  h += buyRow(mi('shield') + '방어력', `현재 ${fmt(d.def)}`, `Lv.${st.def}`, 'stat:def', sc('def'), st.def);
  h += buyRow(mi('bolt') + '신속', `공격 속도 초당 ${d.spd.toFixed(2)}회`, `Lv.${st.spd}`, 'stat:spd', sc('spd'), st.spd);
  const bl2 = burnLeft(s);
  h += `<p class="note">${bl2 > 0 ? `🔥 버닝 타임 진행 중! 남은 ${fmtTime(bl2)} 동안 경험치·골드·장비 드롭률이 ×${CFG.burn.mul}배예요.` : '오늘의 버닝 타임은 끝났어요. 내일 오전 6시에 다시 시작해요.'} (하루 접속 시간 중 처음 ${CFG.burn.sec / 3600}시간)</p>`;
  h += '<h3>사냥 효율</h3>';
  h += buyRow(mi('coin') + '골드 획득량', `+${(CFG.goldUp.per * s.up.gold * 100).toFixed(0)}%`, `Lv.${s.up.gold}`, 'up:gold', (n) => costOf(CFG.goldUp.cost, n), s.up.gold);
  h += buyRow(mi('gift') + '드롭률', `+${(CFG.dropUp.per * s.up.drop * 100).toFixed(0)}%`, `Lv.${s.up.drop}`, 'up:drop', (n) => costOf(CFG.dropUp.cost, n), s.up.drop);
  return h;
}

// ---------- 장비 ----------
function itemTitle(it) {
  return `<span style="color:${CFG.gradeColors[it.grade]}">[${CFG.gradeNames[it.grade]}] ${esc(it.name)}${it.enh ? ' +' + it.enh : ''}</span>`;
}

// 장비 상세 정보 (툴팁과 상세 패널 공용)
function itemInfoHtml(it, where) {
  const s = UI.rt.save;
  let h = `<div class="tname">${itemTitle(it)}</div>` +
    `<div class="tsub">${CFG.slotNames[it.slot]} · ${CFG.classes[it.cls]} 전용 · ${esc(CFG.regions[it.region - 1].name)} 장비</div>` +
    `<div class="tstat">${itemDesc(it)}</div>`;
  if (it.enh) h += `<div class="tsub">강화 +${it.enh} (효과 +${Math.round(Math.min(it.enh, CFG.enh.max) * CFG.enh.per * 100)}%)</div>`;
  if (awakenBonus(it) > 0) h += `<div class="tstat awk">무기 각성 +${it.enh}: 최종 공격력·마력 +${Math.round(awakenBonus(it) * 100)}%</div>`;
  if (where === 'inv') {
    const cur = s.equip[it.slot];
    if (it.cls !== s.weaponType) h += `<div class="down">현재 직업(${CFG.classes[s.weaponType]})은 착용할 수 없어요</div>`;
    else if (cur) {
      const diff = Math.round((itemScore(it) / itemScore(cur) - 1) * 100);
      h += diff >= 0 ? `<div class="up">착용 중인 장비보다 ▲${diff}%</div>` : `<div class="down">착용 중인 장비보다 ▼${-diff}%</div>`;
    } else h += '<div class="up">빈 칸이에요. 장착해 보세요!</div>';
    h += `<div class="tsub">분해 시 +${fmt(salvageValue(it))} G</div>`;
  }
  return h;
}

function gearIcon(it, cls) { return `<img class="ico ${cls || ''}" src="${itemIconUrl(it)}" alt="">`; }

function slotCell(slot) {
  const s = UI.rt.save, it = s.equip[slot], on = UI.sel && UI.sel.t === 'eq' && UI.sel.k === slot;
  const inner = it
    ? gearIcon(it) + (it.enh ? `<i class="enh ${it.enh > CFG.enh.max ? 'hi' : ''}">+${it.enh}</i>` : '')
    : gearIcon({ slot, cls: s.weaponType, region: 1, grade: 0 }, 'ghost') + `<span class="ph">${CFG.slotNames[slot]}</span>`;
  return `<div class="cell eq ${it ? '' : 'empty'} ${on ? 'sel' : ''}" style="--gc:${it ? CFG.gradeColors[it.grade] : '#3a4258'}" data-act="sel:eq:${slot}" data-slot="${slot}" ${it ? `data-tip="eq:${slot}"` : ''}>${inner}</div>`;
}

function invCell(it) {
  const s = UI.rt.save, on = UI.sel && UI.sel.t === 'inv' && String(UI.sel.k) === String(it.uid);
  const can = it.cls === s.weaponType;
  return `<div class="cell ${on ? 'sel' : ''} ${can ? '' : 'locked'}" style="--gc:${CFG.gradeColors[it.grade]}" data-uid="${it.uid}" data-act="sel:inv:${it.uid}" data-tip="inv:${it.uid}">` +
    gearIcon(it) + (it.enh ? `<i class="enh ${it.enh > CFG.enh.max ? 'hi' : ''}">+${it.enh}</i>` : '') + '</div>';
}

function selectedItem() {
  const s = UI.rt.save, sel = UI.sel;
  if (!sel) return null;
  if (sel.t === 'eq') { const it = s.equip[sel.k]; return it ? { it, where: 'eq' } : null; }
  const it = s.inv.find((x) => String(x.uid) === String(sel.k));
  return it ? { it, where: 'inv' } : null;
}

function panelDetail() {
  const s = UI.rt.save, cur = selectedItem();
  if (!cur) return '<div class="detail"><p class="note">장비 칸을 누르면 자세한 정보가 여기에 보여요. 마우스를 올려도 볼 수 있고, 보관함 장비는 <b>더블클릭</b>으로 장착, 착용 중인 장비는 <b>더블클릭</b>으로 해제됩니다.</p></div>';
  const { it, where } = cur;
  let btns = '';
  if (where === 'inv') {
    const can = it.cls === s.weaponType;
    btns = `<button class="buy" data-act="equip:${it.uid}" ${can ? '' : 'disabled'}>${can ? '장착' : '착용 불가'}</button>` +
      `<button class="danger" data-act="salv:${it.uid}">분해 +${fmt(salvageValue(it))}G</button>`;
  } else {
    const plan = planBuy(enhCostFn(it), it.enh, UI.qty, s.gold, CFG.enh.max);
    const maxed = it.enh >= CFG.enh.max;
    const label = maxed ? '최대 강화' : `강화 +${it.enh} → +${it.enh + Math.max(1, plan.n)} (${fmt(plan.n > 0 ? plan.total : enhCostFn(it)(it.enh))}G)`;
    btns = `<button class="buy" data-act="enh:${it.slot}" ${plan.n > 0 && !maxed ? '' : 'disabled'}>${label}</button>` +
      `<button class="chip" data-act="unequip:${it.slot}" ${s.inv.length < s.invCap ? '' : 'disabled'}>해제</button>`;
  }
  // 무기 각성(+11~+15): 일반 강화를 +10까지 올린 무기에서만. 비싸고 확률로 성공하는 고위험 도전
  let awk = '';
  if (where === 'eq' && it.slot === 'weapon' && it.enh >= CFG.enh.max) {
    const A = CFG.enh.awaken, n = it.enh + 1;
    if (it.enh >= A.max) awk = '<div class="awaken"><b>최대 각성 (+15)</b></div>';
    else {
      const cost = awakenCost(n), p = Math.round(awakenChance(it) * 100), pity = Math.round(Math.min(A.pityMax, (it.pity || 0) * A.pityStep) * 100), gain = Math.round(A.bonus[n - CFG.enh.max - 1] * 100);
      awk = `<div class="awaken"><b>무기 각성 +${it.enh} → +${n}</b>` +
        `<small>성공 확률 ${p}%${pity ? ` (연속 실패 보너스 +${pity}%)` : ''} · 비용 ${fmt(cost)} G (실패해도 사라져요)<br>성공하면 최종 공격력·마력 +${gain}%` +
        `${n >= A.dropFrom ? `<br><span class="down">실패하면 +${it.enh - 1}로 내려가요</span>` : ''}</small>` +
        `<button class="danger" data-act="awaken" ${s.gold >= cost ? '' : 'disabled'}>도전 (${fmt(cost)} G)</button></div>`;
    }
  }
  return `<div class="detail">${gearIcon(it, 'big')}<div class="dinfo">${itemInfoHtml(it, where)}<div class="dbtns">${btns}</div>${awk}</div></div>`;
}

function panelEquip() {
  const s = UI.rt.save;
  let h = `<div class="head"><span class="gold">${mi('coin')}${fmt(s.gold)} G</span>${qtyBar()}</div>`;

  h += '<h3>착용 중</h3><div class="eqrow">' + CFG.slots.map(slotCell).join('') + '</div>';
  h += panelDetail();

  const full = s.invCap >= CFG.inv.max;
  const autoLabel = ['끔', '일반 이하', '고급 이하'][AUTO_SALV.indexOf(s.autoSalvage)];
  h += `<h3>보관함 ${s.inv.length} / ${s.invCap}</h3><div class="toolbar">` +
    `<button class="chip" data-act="equipbest">최적 장비 착용</button>` +
    `<button class="chip" data-act="invup" ${full || s.gold < invCapCost(s) ? 'disabled' : ''}>${full ? '칸 최대' : `칸 +${CFG.inv.step} (${fmt(invCapCost(s))}G)`}</button>` +
    `<button class="chip" data-act="autosalv">자동 분해: ${autoLabel}</button>` +
    `<button class="chip" data-act="salvgrade:0">일반 전부 분해</button></div>`;

  const list = s.inv.slice().sort((a, b) => (b.grade - a.grade) || (CFG.slots.indexOf(a.slot) - CFG.slots.indexOf(b.slot)) || (itemScore(b) - itemScore(a)));
  h += '<div class="grid">' + list.map(invCell).join('') + '<div class="cell empty"></div>'.repeat(Math.max(0, s.invCap - list.length)) + '</div>';

  // 합성
  let mergeRows = '';
  for (const slot of CFG.slots) for (let g = 0; canMergeGrade(g); g++) {
    const n = mergeCount(s, slot, g);
    if (!n) continue;
    const rep = s.inv.find((x) => x.slot === slot && x.grade === g);
    mergeRows += `<div class="row">${gearIcon(rep, 'sm')}<div class="rn">${CFG.slotNames[slot]} · ${CFG.gradeNames[g]} <b>${n}/${CFG.merge.need}</b>` +
      `<small>${CFG.gradeNames[g + 1]} 장비로 합성 (부위·직업 랜덤, 무기 제외)</small></div>` +
      `<button class="buy" data-act="merge:${slot}:${g}" ${n >= CFG.merge.need ? '' : 'disabled'}>합성</button></div>`;
  }
  h += '<h3>합성</h3>' + (mergeRows || '<p class="note">같은 부위·같은 등급 장비를 10개 모으면 한 단계 위 장비로 합칠 수 있어요. (강화는 사라지고, 전설은 합성으로 만들 수 없어요)</p>');
  if (mergeRows) h += `<div class="toolbar"><button class="chip" data-act="mergeall">가능한 합성 모두 진행</button></div>`;
  return h;
}

function panelSkills() {
  const rt = UI.rt, s = rt.save;
  let h = `<div class="head"><span class="gold">${mi('coin')}${fmt(s.gold)} G</span>${qtyBar()}</div>`;
  skillList(s).forEach((sk, i) => {
    const lv = s.skillLv[i];
    if (sk.special) { // 동물 특수 스킬: 강화 없음
      h += `<div class="row"${skillOpen(s, i) ? '' : ' style="opacity:.6"'}><div class="rn">${mi('star')}${esc(sk.name)} <span class="badge">${s.animal === 'dog' ? '강아지' : '고양이'} 특수</span>${skillOpen(s, i) ? '' : ` <span class="badge">캐릭터 Lv.${sk.unlock}에 해금</span>`}<small>${esc(sk.desc)}<br>쿨타임 ${sk.cd}초 · 강화 없음</small></div></div>`;
      return;
    }
    if (!skillOpen(s, i)) {
      h += `<div class="row" style="opacity:.6"><div class="rn">${esc(sk.name)} <span class="badge">캐릭터 Lv.${sk.unlock}에 해금</span><small>${esc(sk.desc)}</small></div></div>`;
      return;
    }
    h += buyRow(mi('star') + esc(sk.name), `${esc(sk.desc)}<br>쿨타임 ${sk.cd}초 · 피해 ${fmt(skillDamage(rt, i))}`, `Lv.${lv}`, 'skill:' + i, (n) => costOf(CFG.skillUp.cost, n), lv);
  });
  const ap0 = CFG.animalSkills[s.animal];
  if (ap0) h += `<h3>${s.animal === 'dog' ? '강아지' : '고양이'}의 특별한 능력</h3><div class="row"${s.level >= ap0.unlock ? '' : ' style="opacity:.6"'}><div class="rn">${mi('star')}${esc(ap0.name)} <span class="badge">패시브</span>${s.level >= ap0.unlock ? '' : `<span class="badge">캐릭터 Lv.${ap0.unlock}에 해금</span>`}<small>${esc(ap0.desc)}</small></div></div>`;
  h += '<p class="note">평소에는 쿨타임이 돌면 자동으로 사용됩니다. 보스전에서 <b>보스 수동</b>을 켜면 직접 눌러 타이밍을 정할 수 있어요. 보스의 약점이 드러났을 때 긴 쿨타임 스킬을 쓰면 피해가 크게 늘어납니다.</p>';
  return h;
}

const _monUrl = {};
function monUrl(r) { return _monUrl[r] || (_monUrl[r] = monsterSprite(r, false).toDataURL()); }

// 스테이지: 챕터(지역)를 하나씩 골라서 보는 방식
function panelStage() {
  const s = UI.rt.save, RN = CFG.regions.length;
  if (!UI.chap) UI.chap = s.region;
  const r = UI.chap, rg = CFG.regions[r - 1], open = canEnter(s, r, 1);
  let h = `<div class="head"><span>${mi('gem')}이번 시즌 모은 영구 포인트 <b>${s.pendingPoints}</b></span></div>`;
  h += '<div class="chapbar"><button class="chip" data-act="chap:prev">◀</button>' +
    CFG.regions.map((_, i) => {
      const n = i + 1, ok = canEnter(s, n, 1);
      return `<button class="chap ${n === r ? 'on' : ''} ${ok ? '' : 'locked'} ${s.region === n && !UI.rt.endless ? 'here' : ''} ${s.clearedRegions.includes(n) ? 'done' : ''}" data-act="chap:${n}">${n}</button>`;
    }).join('') + '<button class="chip" data-act="chap:next">▶</button></div>';
  const state = !open ? '잠김' : s.clearedRegions.includes(r) ? '클리어' : '진행 중';
  h += `<div class="chapcard"><img class="monimg" src="${monUrl(r)}" alt=""><div class="chaptxt"><b>${r}장 · ${esc(rg.name)}</b><small>${state}${s.region === r && !UI.rt.endless ? ' · 지금 여기서 사냥 중' : ''}</small></div></div>`;
  h += `<div class="row"><div class="rn">라운드 고정<small>${s.lock ? '켜짐 — 같은 라운드를 계속 반복해요. 꺼야 클리어 후 다음 라운드로 넘어가요.' : '꺼짐 — 클리어하면 자동으로 다음 라운드로 넘어가요.'}</small></div><button class="chip ${s.lock ? 'on' : ''}" data-act="lock">${s.lock ? '켜짐' : '꺼짐'}</button></div>`;
  h += '<div class="stagegrid">';
  for (let rd = 1; rd <= CFG.roundsPerRegion; rd++) {
    const cur = s.region === r && s.round === rd && !UI.rt.endless, ok = canEnter(s, r, rd), boss = rd === CFG.roundsPerRegion;
    h += `<button class="stagebtn ${cur ? 'cur' : ''} ${boss ? 'bossr' : ''}" data-act="go:${r}:${rd}" ${ok ? '' : 'disabled'}>${boss ? mi('crown') + '보스' : `${r}-${rd}`}</button>`;
  }
  h += '</div><p class="note">잠긴 라운드는 앞 라운드를 먼저 클리어하면 열려요. 열린 라운드를 누르면 그 라운드에 고정되어 파밍해요. 다음 지역은 몬스터가 훨씬 강하니, 막히면 이전 지역에서 골드를 모아 강화하세요. 이전 지역은 골드가 더 많이, 새 지역은 좋은 장비가 더 잘 나옵니다.</p>';
  return h;
}
// ---------- 무한 모드 / 랭킹 ----------
function fetchRanking(force) {
  const R = UI.rank || (UI.rank = { at: 0, data: null, busy: false, err: '' });
  if (!UI.online || R.busy || (!force && Date.now() - R.at < 30000)) return;
  R.busy = true;
  API.ranking().then((d) => { R.data = d; R.err = ''; }).catch((e) => { R.err = e.message || '순위표를 불러오지 못했어요.'; })
    .finally(() => { R.busy = false; R.at = Date.now(); UI.lastHtml = ''; });
}
const fmtWhen = (ms) => { const d = new Date(ms); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

function panelEndless() {
  const rt = UI.rt, s = rt.save, E = CFG.endless, on = !!rt.endless;
  fetchRanking(false);
  let h = `<div class="head"><span>이번 시즌 최고 <b class="gold">${s.endless.best ? s.endless.best + '층' : '기록 없음'}</b></span>` +
    `<span>${on ? `지금 <b>${rt.endless.floor}층</b> 도전 중` : '도전 전'}</span></div>`;
  h += on
    ? '<div class="toolbar"><button class="bigbtn" data-act="endless:exit">무한 모드 마치고 스토리 사냥으로</button></div>'
    : '<div class="toolbar"><button class="bigbtn go" data-act="endless:start">무한 모드 도전 (1층부터)</button></div>';
  h += `<p class="note">끝없이 올라가는 도전이에요. 지금 장비와 능력치 그대로 싸우고, 쓰러지거나 시간이 지나면 1층부터 다시 시작해요. 골드·경험치·장비는 얻지 못해요. ${E.bossEvery}층마다 보스가 나오고, 약점이 드러날 때 스킬을 맞추면 큰 피해를 줘요. ` +
    `최고 층이 높은 순서로 순위가 정해지고, 같은 층이면 먼저 도달한 사람이 위예요. (${E.minFloor}층부터 순위에 올라요)</p>`;
  h += '<h3>시즌 순위</h3>';
  if (!UI.online) h += '<p class="note">순위표는 서버에 접속했을 때만 볼 수 있어요.</p>';
  else {
    const R = UI.rank, d = R && R.data;
    h += `<div class="toolbar"><button class="chip" data-act="endless:refresh">새로고침</button><span class="note">${R && R.busy ? '불러오는 중…' : (R && R.err) || (d ? `참가 ${d.total}명` : '')}</span></div>`;
    if (d) {
      if (!d.list.length) h += `<p class="note">아직 순위에 오른 사람이 없어요. ${E.minFloor}층에 처음 도달해 보세요!</p>`;
      h += '<div class="rankbox">' + d.list.map((r) =>
        `<div class="rankrow ${r.me ? 'me' : ''} ${r.rank <= 3 ? 'top' + r.rank : ''}"><span class="rk">${r.rank}</span><span class="nm">${esc(r.nickname)}</span><span class="fl">${r.floor}층</span><span class="wh">${fmtWhen(r.reachedAt)}</span></div>`).join('') + '</div>';
      if (d.me && !d.list.some((r) => r.me)) h += `<div class="rankrow me"><span class="rk">${d.me.rank}</span><span class="nm">나</span><span class="fl">${d.me.floor}층</span><span class="wh">${fmtWhen(d.me.reachedAt)}</span></div>`;
      else if (!d.me && s.endless.best) h += `<p class="note">내 기록(${s.endless.best}층)이 아직 순위에 없어요. ${s.endless.best < E.minFloor ? `${E.minFloor}층부터 올라요.` : '잠시 후 저장되면 나타나요.'}</p>`;
    }
  }
  h += '<h3>시즌 보상</h3><p class="note">시즌이 끝나는 순간의 순위로 다음 시즌 시작 때 받아요.</p>';
  for (const r of E.rewards) {
    const who = r.rank ? `${r.rank}등` : `상위 ${Math.round(r.pct * 100)}%`;
    h += `<div class="row"><div class="rn">${who}<small>영구 포인트 +${r.points}${r.title ? ` · 칭호 '${r.title.label}' (능력치 효과 ${CFG.titleBuffSeasons}시즌)` : ''}</small></div></div>`;
  }
  return h;
}

const PERM_ICON = { atk: 'sword', hp: 'heart', mag: 'magic', gold: 'coin', drop: 'gift', exp: 'star' };
function panelPerm() {
  const s = UI.rt.save, PI = CFG.perm.items;
  let h = `<div class="head"><span>쓸 수 있는 포인트 <b class="gold">${s.permPoints}</b></span><span class="note">이번 시즌에 모은 포인트 ${s.pendingPoints}개는 다음 시즌부터 쓸 수 있어요</span></div>`;
  h += '<p class="note">시즌이 바뀌어도 사라지지 않는 능력치예요. 처음 레벨은 싸고, 올릴수록 포인트가 더 필요해요.</p>';
  for (const k of Object.keys(PI)) {
    const it = PI[k], lv = s.perm[k], max = lv >= CFG.perm.maxLv, cost = permNextCost(s, k);
    const eff = it.unit === '%' ? `+${(lv * it.per * 100).toFixed(0)}%` : `+${fmt(lv * it.per)}`;
    const per = it.unit === '%' ? `레벨당 +${(it.per * 100).toFixed(0)}%` : `레벨당 +${it.per}`;
    h += `<div class="row"><div class="rn">${it.name}<small>${per} · 지금 ${eff}</small></div><div class="rl">Lv.${lv}/${CFG.perm.maxLv}</div>` +
      `<button class="buy" data-act="permup:${k}" ${!max && s.permPoints >= cost ? '' : 'disabled'}>${max ? '최대' : `${cost} 포인트`}</button></div>`;
  }
  h += `<div class="toolbar"><button class="chip" data-act="permreset" ${permSpent(s) > 0 ? '' : 'disabled'}>투자 초기화 (포인트 되돌려받기)</button></div>`;
  h += '<h3>칭호</h3>';
  if (!s.titles.length) h += '<p class="note">아직 얻은 칭호가 없어요. 시즌 랭킹(무한 모드) 순위에 오르면 칭호를 받아요. 칭호는 계속 남고, 능력치 효과는 얻은 뒤 3시즌 동안 적용돼요.</p>';
  for (const t of s.titles) {
    const on = titleActive(s, t);
    h += `<div class="row"><div class="rn"><b>${esc(t.name)}</b><small>시즌 ${t.season} 획득 · ${on ? '능력치 효과 적용 중' : '효과 기간이 끝났어요 (칭호는 유지)'}</small></div></div>`;
  }
  return h;
}

// ---------- 의견 보내기 ----------
UI.fbCat = 'idea'; UI.fbDraft = ''; UI.fbMsg = '';
function feedbackPanel() {
  if (!UI.online) return '';
  const cats = [['bug', '버그'], ['idea', '건의'], ['other', '기타']];
  return `<h3>의견 보내기</h3><div class="toolbar">${cats.map(([k, n]) => `<button class="chip ${UI.fbCat === k ? 'on' : ''}" data-act="fbcat:${k}">${n}</button>`).join('')}</div>` +
    `<textarea id="fbText" maxlength="1000" rows="4" placeholder="이상한 점, 불편한 점, 바라는 점을 자유롭게 적어 주세요. 운영자에게 바로 전달돼요.">${esc(UI.fbDraft)}</textarea>` +
    `<div class="toolbar"><button class="buy" data-act="fb">보내기</button><span class="note">${esc(UI.fbMsg)}</span></div>`;
}
async function sendFeedbackUi() {
  const s = UI.rt.save, el = $('fbText'), body = (el ? el.value : UI.fbDraft).trim();
  if (body.length < 2) { UI.fbMsg = '내용을 입력해 주세요.'; if (el) el.blur(); UI.lastHtml = ''; uiUpdate(); return; }
  const ctx = `Lv.${s.level} ${s.region}-${s.round} ${s.animal}/${s.weaponType}`;
  try { await API.feedback(UI.fbCat, body, ctx); UI.fbDraft = ''; UI.fbMsg = '보냈어요. 고마워요!'; }
  catch (e) { UI.fbMsg = e.message || '보내지 못했어요.'; }
  const box = $('fbText'); if (box) box.blur();   // 입력 칸에서 빠져나와야 화면이 다시 그려짐
  UI.lastHtml = ''; uiUpdate();
}
// ---------- 큰 화면에서 성장/장비/스킬을 한 번에 보여주기 ----------
UI.layout = (function () { try { return localStorage.getItem('idlegame_layout') || 'auto'; } catch (e) { return 'auto'; } })();
function isWide() {
  if (document.body.className !== 'mode-full') return false;   // 사이드/미니/작은 창 모드에서는 쓰지 않음
  const w = window.innerWidth;
  return UI.layout === 'cols' ? w >= 1250 : UI.layout === 'auto' ? w >= 1700 : false;
}
function colsHtml() {
  return `<div class="cols"><section><h2>${mi('growth')}성장</h2>${panelGrowth()}</section>` +
    `<section><h2>${mi('hat')}장비</h2>${panelEquip()}</section>` +
    `<section><h2>${mi('star')}스킬</h2>${panelSkills()}</section></div>`;
}

function panelSettings() {
  const s = UI.rt.save;
  return `<h3>닉네임</h3><div class="row"><input id="nickInput" maxlength="12" value="${esc(s.name)}"><span class="note">입력 후 엔터</span></div>` +
    `<h3>캐릭터</h3><div class="row"><button class="chip ${s.animal === 'dog' ? 'on' : ''}" data-act="animal:dog">강아지</button><button class="chip ${s.animal === 'cat' ? 'on' : ''}" data-act="animal:cat">고양이</button></div>` +
    `<h3>화면 배치</h3><div class="row"><span class="rn">성장·장비·스킬 보기<small>큰 화면에서는 세 가지를 한 번에 보여 줄 수 있어요. (작은 화면에서는 탭으로 하나씩 보여요)</small></span>${[['auto', '자동'], ['tabs', '항상 탭'], ['cols', '한 번에']].map(([k, n]) => `<button class="chip ${UI.layout === k ? 'on' : ''}" data-act="layout:${k}">${n}</button>`).join('')}</div>` +
    `<h3>작은 화면</h3>` +
    `<div class="row"><span class="rn">미니 화면에서 캐릭터를 누르면 전체 화면 열기<small>끄면 눌러도 아무 일도 일어나지 않아요 (위의 '전체' 버튼으로 이동)</small></span><button class="chip ${s.miniClick ? 'on' : ''}" data-act="miniclick">${s.miniClick ? '켜짐' : '꺼짐'}</button></div>` +
    `<div class="row"><span class="rn">작은 창으로 분리 (PiP)<small>주소창 없이 항상 위에 떠 있는 작은 전투 창 (크롬/엣지)</small></span><button class="chip" data-act="pip">열기/닫기</button></div>` +
    `<h3>소리</h3>` +
    `<div class="row"><span class="rn">효과음<small>공격, 레벨업, 장비 획득 소리</small></span><button class="chip ${Sound.sfxOn ? 'on' : ''}" data-act="sfx">${Sound.sfxOn ? '켜짐' : '꺼짐'}</button></div>` +
    `<div class="row"><span class="rn">배경음<small>지역마다 다른 잔잔한 음악</small></span><button class="chip ${Sound.bgmOn ? 'on' : ''}" data-act="bgm">${Sound.bgmOn ? '켜짐' : '꺼짐'}</button></div>` +
    `<div class="row"><span class="rn">전체 음량</span><input id="volRange" type="range" min="0" max="100" value="${Math.round(Sound.vol * 100)}"></div>` +
    feedbackPanel() +
    `<h3>단축키</h3><p class="note">1·2·3 스킬 사용 · M 보스 수동 · L 라운드 고정</p>` +
    (UI.online
      ? `<h3>계정</h3><div class="row acct"><span class="rn">비밀번호 변경<small>현재 비밀번호와 새 비밀번호</small></span><input id="pwOld" type="password" placeholder="현재" maxlength="100"><input id="pwNew" type="password" placeholder="새 비밀번호" maxlength="100"><button class="chip" data-act="pwchange">변경</button></div>` +
        `<div class="row"><span class="rn">로그아웃<small>다른 기기에서 다시 로그인할 수 있어요</small></span><button class="chip" data-act="logout">로그아웃</button></div>`
      : `<h3>데이터</h3><div class="row"><span class="rn">진행 상황 초기화<small>이 브라우저에 저장된 데이터를 모두 지웁니다 (시험 모드)</small></span><button class="danger" data-act="reset">초기화</button></div>`);
}

// ---------- 룰렛 ----------
const RL_ICON = { exp: 'star', gold: 'coin', drop: 'gift' };
UI.spinning = false;
function renderRoulette(winIdx, onIdx) {
  const s = UI.rt.save, R = CFG.roulette;
  $('rlTickets').textContent = `티켓 ${s.tickets}개`;
  $('rlWheel').innerHTML = R.segments.map((g, i) =>
    `<div class="seg ${i === onIdx ? 'on' : ''} ${i === winIdx ? 'win' : ''}">${mi(RL_ICON[g.kind])}<b>${R.kinds[g.kind]} ×${g.mul}</b>${Math.round(g.sec / 60)}분</div>`).join('');
  $('rlSpin').disabled = UI.spinning || s.tickets < 1;
}
function rouletteAct(what) {
  if (!what) { $('rlResult').textContent = ''; renderRoulette(); $('rouletteOverlay').classList.remove('hidden'); return; }
  if (what === 'close') { if (!UI.spinning) $('rouletteOverlay').classList.add('hidden'); return; }
  if (what !== 'spin' || UI.spinning) return;
  const r = spinRoulette(UI.rt);
  if (!r) return;
  UI.spinning = true; $('rlResult').textContent = '';
  const n = CFG.roulette.segments.length, total = 3 * n + r.idx;   // 세 바퀴 돌고 결과 칸에서 멈춤
  let i = 0;
  (function tick() {
    renderRoulette(null, i % n);
    if (i >= total) {
      UI.spinning = false; renderRoulette(r.idx);
      $('rlResult').textContent = `${CFG.roulette.kinds[r.seg.kind]} ×${r.seg.mul} (${Math.round(r.seg.sec / 60)}분) 획득!`;
      return;
    }
    i++; setTimeout(tick, 60 + Math.pow(i / total, 3) * 340);
  })();
}

// ---------- 보상형 광고 ----------
UI.adBusy = false;
function renderAd() {
  const s = UI.rt.save, A = CFG.ads, left = adsLeft(s);
  $('adLeft').textContent = `오늘 남은 횟수 ${left} / ${A.perDay}`;
  $('adKinds').innerHTML = Object.keys(CFG.roulette.kinds).map((k) =>
    `<button class="bigbtn ${left > 0 ? 'go' : ''}" data-act="ad:watch:${k}" ${left > 0 && !UI.adBusy ? '' : 'disabled'}>${mi(RL_ICON[k])}${CFG.roulette.kinds[k]} ×${A.mul}<br><small>${Math.round(A.sec / 60)}분</small></button>`).join('');
}
async function adAct(what, kind) {
  if (!what) { renderAd(); $('adOverlay').classList.remove('hidden'); return; }
  if (what === 'close') { $('adOverlay').classList.add('hidden'); return; }
  if (what !== 'watch' || UI.adBusy || adsLeft(UI.rt.save) < 1) return;
  UI.adBusy = true; renderAd();
  const ok = await Ads.show();
  UI.adBusy = false;
  if (ok && applyAdReward(UI.rt, kind)) { $('adLeft').textContent = `${CFG.roulette.kinds[kind]} ×${CFG.ads.mul} 보너스를 받았어요!`; setTimeout(renderAd, 1800); }
  else renderAd();
}

// 탭에 빨간 점: 지금 할 일이 있다는 표시 (더 좋은 장비, 합성 가능, 쓸 수 있는 영구 포인트)
function tabBadge(s, key) {
  if (key === 'equip') {
    if (s.inv.some((it) => it.cls === s.weaponType && itemScore(it) > itemScore(s.equip[it.slot]))) return true;
    for (const slot of CFG.slots) for (let g = 0; canMergeGrade(g); g++) if (mergeCount(s, slot, g) >= CFG.merge.need) return true;
    return false;
  }
  if (key === 'perm') return s.permPoints > 0 && Object.keys(CFG.perm.items).some((k) => { const c = permNextCost(s, k); return c !== null && s.permPoints >= c; });
  return false;
}

// 전투 화면 아래 '내 정보' 카드: 착용 장비와 핵심 능력치를 탭을 바꾸지 않고도 볼 수 있게
function updateInfo(rt) {
  const s = rt.save, d = rt.d, el = $('infoGear');
  if (!el) return;
  const gear = CFG.slots.map((slot) => {
    const it = s.equip[slot];
    return `<div class="cell ${it ? '' : 'empty'}" style="--gc:${it ? CFG.gradeColors[it.grade] : '#3a4258'}" data-act="tab:equip" ${it ? `data-tip="eq:${slot}"` : ''}>` +
      (it ? gearIcon(it) + (it.enh ? `<i class="enh ${it.enh > CFG.enh.max ? 'hi' : ''}">+${it.enh}</i>` : '') : gearIcon({ slot, cls: s.weaponType, region: 1, grade: 0 }, 'ghost')) + '</div>';
  }).join('');
  const ci = CFG.classInfo[s.weaponType], mainName = ci.stat === 'mag' ? '마력' : '공격력';
  const stats = `<span>직업<b>${ci.title}</b></span><span>${mainName}<b>${fmt(d.main)}</b></span>` +
    `<span>체력<b>${fmt(d.hp)}</b></span><span>방어력<b>${fmt(d.def)}</b></span>` +
    `<span>초당 피해<b>${fmt(d.plain * d.spd)}</b></span><span>공격 속도<b>${d.spd.toFixed(2)}/초</b></span>`;
  if (gear !== UI.lastGear) { UI.lastGear = gear; el.innerHTML = gear; }
  if (stats !== UI.lastStats) { UI.lastStats = stats; $('infoStats').innerHTML = stats; }
}

// ---------- 주기적 갱신 ----------
function uiUpdate() {
  const rt = UI.rt;
  if (!rt) return;
  const s = rt.save, rg = CFG.regions[stageRegion(rt) - 1], boss = curBoss(rt);

  $('who').textContent = `${s.name} Lv.${s.level}`;
  $('power').textContent = '전투력 ' + fmt(combatPower(s, rt.d));
  const bossName = boss ? bossInfoOf(rt).name : '';
  const buffs = ['exp', 'gold', 'drop'].filter((k) => s.buff[k].sec > 0).map((k) => `${CFG.roulette.kinds[k]} ×${s.buff[k].mul} ${Math.floor(s.buff[k].sec / 60)}:${String(Math.floor(s.buff[k].sec % 60)).padStart(2, '0')}`);
  $('btnRoulette').textContent = `룰렛 ${s.tickets}`;
  $('btnRoulette').classList.toggle('ready', s.tickets > 0);
  $('btnAd').textContent = `광고 보상 ${adsLeft(s)}/${CFG.ads.perDay}`;
  $('btnAd').classList.toggle('ready', adsLeft(s) > 0);
  $('btnAd').style.display = CFG.ads.enabled ? '' : 'none';
  if (UI.season) {
    const left = UI.season.endsAt - (Date.now() + UI.season.offset);
    const d = Math.floor(left / 86400e3), h = Math.floor(left % 86400e3 / 3600e3);
    $('seasonInfo').textContent = left > 0 ? `${UI.season.name} · ${d > 0 ? d + '일 ' : ''}${h}시간 남음` : UI.season.name;
  } else $('seasonInfo').textContent = '';
  $('stageLabel').textContent = (rt.endless ? `무한 ${rt.endless.floor}층 · ${rg.name}` : `${s.region}-${s.round} ${rg.name}`) + (boss ? ` · ${bossName}` : '');
  $('killLabel').textContent = boss ? '보스' : `${rt.kills}/${needKillsRt(rt)}`;
  $('goldLabel').textContent = rt.endless ? `최고 ${s.endless.best}층` : fmt(s.gold) + ' G';
  $('hudTime').textContent = `오늘 ${fmtTime(s.today ? s.today.sec : 0)} · 접속 ${fmtTime(rt.clock)}`;
  const bl = burnLeft(s);
  $('stage').classList.toggle('burning', bl > 0);
  $('hudBurn').textContent = [bl > 0 ? `버닝 ×${CFG.burn.mul} · ${Math.floor(bl / 3600)}:${String(Math.floor(bl % 3600 / 60)).padStart(2, '0')}:${String(Math.floor(bl % 60)).padStart(2, '0')} 남음` : '', ...buffs].filter(Boolean).join('\n');
  const maxLv = s.level >= CFG.level.cap;
  $('hudLv').textContent = `Lv.${s.level}${maxLv ? ' (최대)' : ''}`;
  $('hudExpFill').style.width = (maxLv ? 100 : Math.min(100, s.exp / expNeed(s.level) * 100)) + '%';
  $('hpFill').style.width = Math.max(0, rt.hp / rt.d.hp * 100) + '%';
  $('hpText').textContent = `${fmt(Math.max(0, rt.hp))} / ${fmt(rt.d.hp)}`;
  $('bossTimer').textContent = boss ? `제한시간 ${Math.max(0, Math.ceil(rt.bossLeft))}초` : '';
  let alert = '';
  if (boss) {
    const t = rt.bossClock % CFG.boss.cycle;
    if (rt.weak) alert = '약점 노출! 지금이 기회!';
    else if (t >= CFG.boss.cycle - CFG.boss.weakDur - 2.5) alert = '약점이 곧 드러납니다...';
    if (rt.enemies[0] && rt.enemies[0].hp / rt.enemies[0].maxhp <= CFG.boss.lowHp) alert += (alert ? ' · ' : '') + '지쳐서 더 아파합니다';
  }
  if (boss && rt.gimMsg) alert += (alert ? ' · ' : '') + rt.gimMsg;
  $('weakAlert').textContent = alert;

  $('btnSound').classList.toggle('on', Sound.sfxOn || Sound.bgmOn);
  $('btnSound').textContent = (Sound.sfxOn || Sound.bgmOn) ? '소리 켬' : '소리 끔';
  $('btnLock').classList.toggle('on', s.lock);
  $('btnManual').classList.toggle('on', s.bossManual);
  $('btnManual').textContent = s.bossManual ? '보스 수동: 켜짐' : '보스 수동';
  document.querySelectorAll('#topbar .chip[data-act^="mode"]').forEach((b) => b.classList.toggle('on', 'mode-' + b.dataset.act.split(':')[1] === document.body.className));

  updateInfo(rt);
  document.querySelectorAll('#tabs button, #dock button').forEach((b) => {
    const k = b.dataset.act.slice(4);
    b.classList.toggle('on', k === UI.tab);
    const dot = tabBadge(s, k);
    if (!!b.querySelector('.dot') !== dot || !b.querySelector('.mi')) b.innerHTML = tabLabel(TABS.find((t) => t[0] === k), dot);
  });
  const main3 = ['growth', 'equip', 'skills'].includes(UI.tab), wide = main3 && isWide();
  document.documentElement.classList.toggle('wide', wide);
  const html = wide ? colsHtml() : ({ growth: panelGrowth, equip: panelEquip, skills: panelSkills, stage: panelStage, endless: panelEndless, perm: panelPerm, set: panelSettings })[UI.tab]();
  const typing = document.activeElement && document.activeElement.id === 'fbText';   // 의견을 쓰는 중에는 화면을 다시 그리지 않음
  if (html !== UI.lastHtml && !typing) { UI.lastHtml = html; $('tabBody').innerHTML = html; }

  // 로그
  const logHtml = rt.msgs.slice(-6).map((m) => `<div class="${m.cls}">${esc(m.text)}</div>`).join('');
  if (logHtml !== UI.lastLog) { UI.lastLog = logHtml; $('log').innerHTML = logHtml; }
}

// 스킬 쿨타임 표시는 더 자주 갱신
function uiUpdateSkills() {
  const rt = UI.rt;
  if (!rt) return;
  const s = rt.save, list = skillList(s), btns = $('skillbar').children, boss = curBoss(rt);
  let ult = -1; // 열려 있는 스킬 중 쿨타임이 가장 긴 것(보스 약점 때 노릴 스킬)
  list.forEach((sk, i) => { if (!sk.special && skillOpen(s, i) && (ult < 0 || sk.cd > list[ult].cd)) ult = i; });
  for (let i = 0; i < btns.length; i++) {
    const open = skillOpen(s, i), cd = rt.cd[i], max = rt.cdMax[i] || list[i].cd;
    btns[i].classList.toggle('locked', !open);
    btns[i].querySelector('.cdmask').style.height = open && cd > 0 ? (cd / max * 100) + '%' : '0';
    btns[i].querySelector('.cdtxt').textContent = !open ? `Lv.${list[i].unlock}` : (cd > 0 ? Math.ceil(cd) : '');
    btns[i].classList.toggle('ready', open && cd <= 0);
    btns[i].classList.toggle('glow', open && cd <= 0 && boss && rt.weak && i === ult);
  }
}













