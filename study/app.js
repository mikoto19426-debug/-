'use strict';
/* べんきょう — 個人用の勉強アプリ。データはこの端末（localStorage）だけに保存する。 */

// ───────── 基本 ─────────
const KEY = 'benkyo-v1';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = (n) => String(n).padStart(2, '0');
const toMin = (s) => { const [h, m] = String(s).split(':').map(Number); return h * 60 + (m || 0); };
const hm = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const dur = (m) => { m = Math.round(m); if (m < 60) return `${m}分`; const h = Math.floor(m / 60), r = m % 60; return r ? `${h}時間${r}分` : `${h}時間`; };
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
const WD = ['日', '月', '火', '水', '木', '金', '土'];
const WD_ORDER = [1, 2, 3, 4, 5, 6, 0];
const md = (d) => `${d.getMonth() + 1}/${d.getDate()}（${WD[d.getDay()]}）`;
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const daysBetween = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 86400000);

const FIELDS = [
  { id: 'en', name: '英語' },
  { id: 'fr', name: 'フランス語' },
  { id: 'ds', name: 'データサイエンス' },
  { id: 'pe', name: '政治経済' },
  { id: 'other', name: 'その他' },
];
const fieldName = (id) => (FIELDS.find((f) => f.id === id) || FIELDS[4]).name;
// 駒場（教養学部前期課程）の時限
const PERIODS = [
  [1, '08:30', '10:15'], [2, '10:25', '12:10'], [3, '13:00', '14:45'],
  [4, '14:55', '16:40'], [5, '16:50', '18:35'], [6, '18:45', '20:30'],
];

// ───────── データ ─────────
function defaults() {
  const windows = {};
  for (let i = 0; i < 7; i++) windows[i] = (i === 0 || i === 6) ? { start: '10:00', end: '23:00' } : { start: '08:00', end: '23:00' };
  return {
    v: 1,
    tasks: [],      // {id,title,kind:'must'|'want',status:'todo'|'doing'|'done',field,deadline,estimateMin,spentMin,createdAt,doneAt}
    fixed: [],      // 毎週の予定 {id,weekday,start,end,name,field,type:'class'|'other'}
    windows,        // 曜日ごとの活動時間
    plans: {},      // 'YYYY-MM-DD' -> {blocks:[{id,type:'must'|'want'|'reward'|'event'|'rest',taskId,title,start,end,locked}]}
    sessions: [],   // 集中の記録 {id,taskId,title,field,startAt,endAt,minutes}
    settings: {
      focusMin: 25, breakMin: 5, longBreakMin: 15, longEvery: 4,
      rewardMin: 60, blockMin: 50, minBlockMin: 25, gapMin: 10, maxPerTaskDay: 120, days: 7,
      sound: true, vibrate: true, wakeLock: true,
    },
    timer: null,
  };
}
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const d = JSON.parse(raw), base = defaults();
    return { ...base, ...d, settings: { ...base.settings, ...(d.settings || {}) }, windows: { ...base.windows, ...(d.windows || {}) } };
  } catch (e) { return defaults(); }
}
let state = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { toast('保存できませんでした（容量がいっぱいかもしれません）'); }
}
const taskById = (id) => state.tasks.find((t) => t.id === id);
const isActive = (t) => t && t.status !== 'done';
const remainOf = (t) => Math.max(0, (t.estimateMin || 0) - (t.spentMin || 0));

// ───────── 自動スケジュール ─────────
let warnings = []; // [{task, short}]

function busyOf(wd) {
  return state.fixed.filter((f) => f.weekday === wd).map((f) => ({ start: toMin(f.start), end: toMin(f.end) }));
}
function subtract(free, busy) {
  let out = free;
  for (const b of busy) {
    const next = [];
    for (const f of out) {
      if (b.end <= f.start || b.start >= f.end) { next.push(f); continue; }
      if (b.start > f.start) next.push({ start: f.start, end: b.start });
      if (b.end < f.end) next.push({ start: b.end, end: f.end });
    }
    out = next;
  }
  return out.filter((f) => f.end - f.start > 0);
}

function replan() {
  const s = state.settings;
  const today = new Date(), todayKey = ymd(today);
  const nm = Math.ceil(nowMin() / 5) * 5;
  const gap = s.gapMin;

  // 古い予定を整理（60日より前）
  const cutoff = ymd(addDays(today, -60));
  for (const k of Object.keys(state.plans)) if (k < cutoff) delete state.plans[k];

  const rem = {};
  for (const t of state.tasks) if (isActive(t)) rem[t.id] = t.estimateMin ? remainOf(t) : (t.kind === 'want' ? Infinity : 0);

  // 1) 残すブロック（手で動かしたもの・過去のもの）を決め、その分を残り時間から引く
  const days = [];
  for (let i = 0; i < s.days; i++) {
    const d = addDays(today, i), key = ymd(d), isToday = i === 0;
    const plan = state.plans[key] || { blocks: [] };
    const kept = plan.blocks.filter((b) => {
      const past = isToday && b.start < nm;
      if (past) return true;
      if (!b.locked) return false;
      if (b.taskId && !isActive(taskById(b.taskId))) return false; // 終わったタスクの先の予定は消す
      return true;
    });
    for (const b of kept) {
      const future = !isToday || b.start >= nm;
      if (future && b.taskId && rem[b.taskId] != null) rem[b.taskId] -= b.end - b.start;
    }
    days.push({ d, key, isToday, kept });
  }

  // 今週すでに使った分野ごとの時間（やりたいことは少ない分野から入れる）
  const fieldMin = {};
  FIELDS.forEach((f) => (fieldMin[f.id] = 0));
  const wk = weekStart(today);
  for (const se of state.sessions) if (new Date(se.startAt) >= wk) fieldMin[se.field] = (fieldMin[se.field] || 0) + se.minutes;

  const musts = () => state.tasks.filter((t) => isActive(t) && t.kind === 'must' && rem[t.id] > 0)
    .sort((a, b) => (a.deadline || '9999') .localeCompare(b.deadline || '9999') || (a.status === 'doing' ? -1 : 0) - (b.status === 'doing' ? -1 : 0) || a.createdAt - b.createdAt);
  const wants = () => state.tasks.filter((t) => isActive(t) && t.kind === 'want' && rem[t.id] > 0)
    .sort((a, b) => ((b.status === 'doing') - (a.status === 'doing')) || (fieldMin[a.field] - fieldMin[b.field]) || a.createdAt - b.createdAt);

  for (const day of days) {
    const { d, key, isToday, kept } = day;
    const w = state.windows[d.getDay()];
    const ws = toMin(w.start), we = toMin(w.end);
    const blocks = [...kept];

    // 2) 1日の最後に、だらだら時間を必ず入れる
    if (!blocks.some((b) => b.type === 'reward')) {
      let rs = Math.max(ws, we - s.rewardMin);
      if (isToday) rs = Math.max(rs, nm);
      if (we - rs >= 5) blocks.push({ id: uid(), type: 'reward', start: rs, end: we, locked: false });
    }

    // 3) 空き時間を出す（授業などの前後に移動・休憩の余白をとる）
    const startBound = isToday ? Math.max(ws, nm) : ws;
    const busy = [...busyOf(d.getDay()), ...blocks].map((b) => ({ start: b.start - gap, end: b.end + gap }));
    // ブロックどうしの余白は gap、時間帯の端はそのまま
    const slots = subtract([{ start: startBound, end: we }], busy.map((b) => ({ ...b })))
      .map((f) => ({ start: f.start, end: f.end }));

    const placed = {};
    for (const slot of slots) {
      let c = slot.start;
      while (slot.end - c >= 15) {
        const avail = slot.end - c;
        let pick = null;
        for (const t of musts()) {
          const left = t.deadline ? daysBetween(key, t.deadline) : 99;
          const cap = left <= 1 ? Infinity : s.maxPerTaskDay;
          const allow = cap - (placed[t.id] || 0);
          let len = Math.min(s.blockMin, rem[t.id], avail, allow);
          // 15分未満の半端が残るなら、このコマで片づける
          if (rem[t.id] - len > 0 && rem[t.id] - len < 15 && rem[t.id] <= avail && rem[t.id] <= allow) len = rem[t.id];
          if (len >= Math.min(s.minBlockMin, rem[t.id]) && len >= Math.min(15, rem[t.id])) { pick = { t, len }; break; }
        }
        if (!pick) {
          for (const t of wants()) {
            if (placed[t.id]) continue; // やりたいことは1日1回まで
            const len = Math.min(s.blockMin, rem[t.id], avail);
            if (len >= Math.min(s.minBlockMin, rem[t.id]) && len >= 15) { pick = { t, len }; break; }
          }
        }
        if (!pick) break;
        const { t, len } = pick;
        blocks.push({ id: uid(), type: t.kind, taskId: t.id, start: c, end: c + len, locked: false });
        rem[t.id] -= len;
        placed[t.id] = (placed[t.id] || 0) + len;
        if (t.kind === 'want') fieldMin[t.field] = (fieldMin[t.field] || 0) + len;
        c += len + gap;
      }
    }
    blocks.sort((a, b) => a.start - b.start);
    state.plans[key] = { blocks };
  }

  // 4) 締切までに入りきらないタスク
  const lastKey = days[days.length - 1].key;
  warnings = state.tasks.filter((t) => isActive(t) && t.kind === 'must' && t.deadline && t.deadline <= lastKey && rem[t.id] > 0)
    .map((t) => ({ task: t, short: Math.round(rem[t.id]) }));
  state.lastPlan = Date.now();
  save();
}

// 1日の表示用：毎週の予定＋その日のブロック
function dayItems(key) {
  const d = parseYmd(key);
  const fixed = state.fixed.filter((f) => f.weekday === d.getDay())
    .map((f) => ({ id: f.id, type: 'fixed', fixedType: f.type, title: f.name, field: f.field, start: toMin(f.start), end: toMin(f.end) }));
  const blocks = (state.plans[key]?.blocks || []).map((b) => {
    const t = b.taskId ? taskById(b.taskId) : null;
    return { ...b, title: b.title || (t ? t.title : b.type === 'reward' ? 'だらだら時間' : b.type === 'rest' ? '空き' : '（削除したタスク）'), field: t?.field, task: t };
  });
  return [...fixed, ...blocks].sort((a, b) => a.start - b.start || a.end - b.end);
}

// 「次にやること」
function nextUp() {
  const key = ymd(new Date()), nm = nowMin();
  const items = dayItems(key);
  const cls = items.find((i) => i.type === 'fixed' && i.start <= nm && nm < i.end);
  const it = items.find((i) => ['must', 'want', 'reward'].includes(i.type) && i.end > nm && (i.type === 'reward' || isActive(i.task)));
  return { item: it, now: it && it.start <= nm, cls };
}
function urgentTask() {
  const list = state.tasks.filter((t) => isActive(t));
  list.sort((a, b) => (b.kind === 'must') - (a.kind === 'must') || (b.status === 'doing') - (a.status === 'doing') || (a.deadline || '9999').localeCompare(b.deadline || '9999'));
  return list[0];
}

// ───────── 表示：共通 ─────────
let view = 'home';
function setView(v) {
  view = v;
  $$('.view').forEach((el) => el.classList.toggle('active', el.id === 'view-' + v));
  $$('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
  render();
  window.scrollTo(0, 0);
}
function render() {
  renderHeader();
  if (view === 'home') renderHome();
  if (view === 'lists') renderLists();
  if (view === 'plan') renderPlan();
  if (view === 'stats') renderStats();
  if (view === 'settings') renderSettings();
}
function todayFocus() {
  const k = ymd(new Date());
  return state.sessions.filter((s) => ymd(new Date(s.startAt)) === k).reduce((a, s) => a + s.minutes, 0);
}
function renderHeader() {
  $('#hdrDate').textContent = md(new Date());
  const m = todayFocus();
  $('#hdrFocus').textContent = m ? `今日の集中 ${dur(m)}` : '今日はまだ集中していません';
}
function fieldChip(f) { return `<span class="chip f-${esc(f || 'other')}"><span class="dot"></span>${esc(fieldName(f))}</span>`; }
function deadlineText(t) {
  if (!t.deadline) return '';
  const left = daysBetween(ymd(new Date()), t.deadline);
  const d = parseYmd(t.deadline);
  const s = left < 0 ? `締切すぎ（${-left}日）` : left === 0 ? '今日まで' : left === 1 ? '明日まで' : `あと${left}日`;
  return `<span class="${left <= 1 ? 'warn' : ''}">${d.getMonth() + 1}/${d.getDate()}・${s}</span>`;
}

// ───────── 今日 ─────────
function renderHome() {
  const el = $('#view-home');
  const { item, now, cls } = nextUp();
  let html = '';
  if (state.timer) {
    const t = taskById(state.timer.taskId);
    html += `<div class="next"><div class="label">${state.timer.phase === 'focus' ? '集中しています' : '休憩中'}</div>
      <div class="title">${esc(t?.title || '')}</div>
      <button class="start" data-act="open-timer">タイマーを開く</button></div>`;
  } else if (item && item.type === 'reward') {
    html += `<div class="next reward"><div class="label">${now ? 'いま' : `次 ${hm(item.start)}〜`}</div>
      <div class="title">☕ だらだら時間</div>
      <div class="meta">${hm(item.start)}–${hm(item.end)}・${now ? '今日はよくがんばりました。好きに過ごそう' : 'ここまでやったら、ごほうび'}</div></div>`;
    if (now && urgentTask()) html += `<div class="next-sub"><span class="muted small">まだやる気があるなら</span><button class="link" data-act="pick-start">ほかのタスクで始める</button></div>`;
  } else if (item) {
    const t = item.task;
    html += `<div class="next"><div class="label">${now ? 'いまやること' : `次にやること ${hm(item.start)}〜`}</div>
      <div class="title">${esc(t.title)}</div>
      <div class="meta">${fieldChip(t.field)}<span>${hm(item.start)}–${hm(item.end)}（${dur(item.end - item.start)}）</span>${deadlineText(t)}</div>
      <button class="start" data-act="start" data-task="${t.id}" data-block="${item.id}">▶ スタート</button></div>
      <div class="next-sub"><span></span><button class="link" data-act="pick-start">別のタスクで始める</button></div>`;
  } else {
    const u = urgentTask();
    if (u) {
      html += `<div class="next"><div class="label">今日の予定は終わりました</div>
        <div class="title">${esc(u.title)}</div><div class="meta">${fieldChip(u.field)}${deadlineText(u)}</div>
        <button class="start" data-act="start" data-task="${u.id}">▶ もう少しやる</button></div>
        <div class="next-sub"><span></span><button class="link" data-act="pick-start">別のタスクで始める</button></div>`;
    } else {
      html += `<div class="next"><div class="label">はじめに</div>
        <div class="title">やることを登録しよう</div>
        <div class="meta">締切のある「やらなきゃ」と、いつかやりたい「やりたい」を入れると、空き時間に自動で予定を組みます。</div>
        <button class="start" data-act="add-task">＋ タスクを追加</button></div>`;
      if (!state.fixed.length) html += `<button class="btn block" data-act="go-settings">時間割を登録する</button>`;
    }
  }
  if (cls) html += `<div class="notice">いまは授業中：${esc(cls.title)}（〜${hm(cls.end)}）</div>`;
  const w = warnings.filter((x) => daysBetween(ymd(new Date()), x.task.deadline) <= 3);
  if (w.length) html += `<div class="warnbox">${w.map((x) => `<div>⚠ ${esc(x.task.title)}：締切までに${dur(x.short)}ぶん入りきりません</div>`).join('')}</div>`;

  const key = ymd(new Date());
  html += `<h2>今日の予定</h2>${timeline(key, true)}`;

  const done = state.tasks.filter((t) => t.doneAt && ymd(new Date(t.doneAt)) === key);
  if (done.length) html += `<h2>今日終わったこと</h2><ul class="tl">${done.map((t) => `<li class="f-${t.field}"><span class="tl-done">✓</span><div class="tl-title">${esc(t.title)}</div><span></span></li>`).join('')}</ul>`;
  el.innerHTML = html;
}

function timeline(key, compact) {
  const items = dayItems(key);
  if (!items.length) return `<div class="empty">予定はありません</div>`;
  const isToday = key === ymd(new Date()), nm = nowMin();
  return `<ul class="tl">${items.map((i) => {
    const past = isToday && i.end <= nm, cur = isToday && i.start <= nm && nm < i.end;
    const cls = [i.type === 'fixed' ? 'fixed' : '', i.type === 'reward' ? 'reward' : '', i.type === 'rest' ? 'rest' : '', past ? 'past' : '', cur ? 'now' : '', i.field ? 'f-' + i.field : '', i.type !== 'fixed' ? 'tap' : ''].join(' ');
    const sub = i.type === 'fixed' ? (i.fixedType === 'class' ? '授業' : '予定')
      : i.type === 'event' ? '予定' : i.type === 'reward' ? 'ごほうび' : i.type === 'rest' ? '休み'
      : `${i.type === 'must' ? 'やらなきゃ' : 'やりたい'}・${dur(i.end - i.start)}`;
    const done = i.task && i.task.status === 'done';
    return `<li class="${cls}" ${i.type !== 'fixed' ? `data-act="edit-block" data-key="${key}" data-id="${i.id}"` : ''}>
      <div class="tl-time">${hm(i.start)}<br>${hm(i.end)}</div>
      <div><div class="tl-title">${i.type === 'reward' ? '☕ ' : ''}${esc(i.title)}${i.locked ? ' 📌' : ''}</div><div class="tl-sub">${sub}</div></div>
      <span>${done ? '<span class="tl-done">✓</span>' : ''}</span></li>`;
  }).join('')}</ul>`;
}

// ───────── リスト ─────────
let listTab = 'must';
function renderLists() {
  const el = $('#view-lists');
  const act = state.tasks.filter(isActive);
  const n = { must: act.filter((t) => t.kind === 'must').length, want: act.filter((t) => t.kind === 'want').length, doing: act.filter((t) => t.status === 'doing').length };
  let list = listTab === 'doing' ? act.filter((t) => t.status === 'doing') : act.filter((t) => t.kind === listTab);
  if (listTab === 'must' || listTab === 'doing') list.sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999') || a.createdAt - b.createdAt);
  else list.sort((a, b) => (b.status === 'doing') - (a.status === 'doing') || a.createdAt - b.createdAt);
  const done = state.tasks.filter((t) => t.status === 'done' && (listTab === 'doing' || t.kind === listTab)).sort((a, b) => b.doneAt - a.doneAt).slice(0, 30);
  const emptyMsg = { must: '締切のある課題・レポートなどを入れましょう', want: '「政治の本を読む」「英語のニュースを読む」など、理想でOK', doing: '進行中のタスクはありません。タイマーを始めるとここに入ります' }[listTab];
  el.innerHTML = `
    <div class="seg">
      <button data-act="list-tab" data-tab="must" class="${listTab === 'must' ? 'on' : ''}">やらなきゃ<span class="n">${n.must}</span></button>
      <button data-act="list-tab" data-tab="want" class="${listTab === 'want' ? 'on' : ''}">やりたい<span class="n">${n.want}</span></button>
      <button data-act="list-tab" data-tab="doing" class="${listTab === 'doing' ? 'on' : ''}">いまやってる<span class="n">${n.doing}</span></button>
    </div>
    ${list.length ? `<ul class="items">${list.map(itemRow).join('')}</ul>` : `<div class="empty">${emptyMsg}</div>`}
    ${done.length ? `<details class="more"><summary>完了したもの（${done.length}）</summary><ul class="items">${done.map(itemRow).join('')}</ul></details>` : ''}
    <button class="fab" data-act="add-task">＋ 追加</button>`;
}
function itemRow(t) {
  const est = t.estimateMin ? Math.min(100, Math.round((t.spentMin || 0) / t.estimateMin * 100)) : 0;
  return `<li class="item ${t.status === 'done' ? 'done' : ''}">
    <button class="check" data-act="toggle-done" data-id="${t.id}" aria-label="完了"><span>✓</span></button>
    <div class="it-body" data-act="edit-task" data-id="${t.id}">
      <div class="it-title">${esc(t.title)}</div>
      <div class="it-meta">${fieldChip(t.field)}
        ${listTab === 'doing' ? `<span>${t.kind === 'must' ? 'やらなきゃ' : 'やりたい'}</span>` : ''}
        ${t.kind === 'must' ? deadlineText(t) : ''}
        ${t.estimateMin ? `<span>${dur(t.spentMin || 0)} / ${dur(t.estimateMin)}</span><span class="bar"><i style="width:${est}%"></i></span>` : (t.spentMin ? `<span>${dur(t.spentMin)}</span>` : '')}
        ${t.status === 'doing' ? '<span>・進行中</span>' : ''}
      </div>
    </div>
    ${t.status !== 'done' ? `<button class="play" data-act="start" data-task="${t.id}" aria-label="スタート">▶</button>` : '<span></span>'}
  </li>`;
}

function taskSheet(t) {
  const isNew = !t;
  t = t || { kind: listTab === 'want' ? 'want' : 'must', field: 'other', estimateMin: listTab === 'want' ? 0 : 60, status: listTab === 'doing' ? 'doing' : 'todo', deadline: '' };
  const f = { ...t };
  const draw = () => {
    openSheet(`<h3>${isNew ? 'タスクを追加' : 'タスクを編集'}</h3>
      <label class="field"><span>名前</span><input type="text" id="tTitle" value="${esc(f.title || '')}" placeholder="例：経済のレポート" maxlength="80"></label>
      <div class="field"><span>種類</span><div class="chips">
        <button data-k="must" class="${f.kind === 'must' ? 'on' : ''}">やらなきゃ</button>
        <button data-k="want" class="${f.kind === 'want' ? 'on' : ''}">やりたい</button></div></div>
      <div class="field"><span>分野</span><div class="chips">${FIELDS.map((x) => `<button data-f="${x.id}" class="f-${x.id} ${f.field === x.id ? 'on' : ''}"><span class="dot"></span>${x.name}</button>`).join('')}</div></div>
      ${f.kind === 'must' ? `<label class="field"><span>締切</span><input type="date" id="tDeadline" value="${esc(f.deadline || '')}"></label>` : ''}
      <div class="field"><span>所要時間の目安${f.kind === 'want' ? '（なしでもOK）' : ''}</span>
        <div class="chips">${(f.kind === 'want' ? [0, 30, 60, 120, 180] : [30, 60, 90, 120, 180, 300]).map((m) => `<button data-e="${m}" class="${+f.estimateMin === m ? 'on' : ''}">${m ? dur(m) : 'なし'}</button>`).join('')}</div>
        <div class="row" style="margin-top:8px"><input type="number" id="tEst" min="0" step="5" value="${f.estimateMin || 0}" style="width:110px"><span class="muted">分</span></div></div>
      <div class="field"><span>状態</span><div class="chips">
        <button data-s="todo" class="${f.status !== 'doing' ? 'on' : ''}">まだ</button>
        <button data-s="doing" class="${f.status === 'doing' ? 'on' : ''}">いまやってる</button></div></div>
      ${!isNew && t.spentMin ? `<p class="muted small">これまでの集中：${dur(t.spentMin)}</p>` : ''}
      <div class="actions">${!isNew ? '<button class="btn danger" id="tDel">削除</button>' : ''}<button class="btn primary" id="tSave">保存</button></div>`);
    const sync = () => { f.title = $('#tTitle').value; if ($('#tDeadline')) f.deadline = $('#tDeadline').value; f.estimateMin = Math.max(0, +$('#tEst').value || 0); };
    $$('#sheet [data-k]').forEach((b) => b.onclick = () => { sync(); f.kind = b.dataset.k; if (f.kind === 'want' && !t.id) f.estimateMin = 0; if (f.kind === 'must' && !f.estimateMin) f.estimateMin = 60; draw(); });
    $$('#sheet [data-f]').forEach((b) => b.onclick = () => { sync(); f.field = b.dataset.f; draw(); });
    $$('#sheet [data-e]').forEach((b) => b.onclick = () => { sync(); f.estimateMin = +b.dataset.e; draw(); });
    $$('#sheet [data-s]').forEach((b) => b.onclick = () => { sync(); f.status = b.dataset.s; draw(); });
    $('#tSave').onclick = () => {
      sync();
      if (!f.title.trim()) { $('#tTitle').focus(); return; }
      if (f.kind === 'want') f.deadline = '';
      if (isNew) state.tasks.push({ id: uid(), title: f.title.trim(), kind: f.kind, status: f.status, field: f.field, deadline: f.deadline || '', estimateMin: f.estimateMin, spentMin: 0, createdAt: Date.now(), doneAt: null });
      else Object.assign(t, { title: f.title.trim(), kind: f.kind, status: f.status, field: f.field, deadline: f.deadline || '', estimateMin: f.estimateMin });
      closeSheet(); replan(); render(); toast(isNew ? '追加しました。予定に組み込みました' : '保存しました');
    };
    const del = $('#tDel');
    if (del) del.onclick = async () => {
      if (!(await ask(`「${t.title}」を削除しますか？（集中の記録は残ります）`, '削除'))) return;
      state.tasks = state.tasks.filter((x) => x.id !== t.id);
      replan(); render(); toast('削除しました');
    };
    if (isNew) setTimeout(() => $('#tTitle')?.focus(), 50);
  };
  draw();
}

function setDone(t, done) {
  t.status = done ? 'done' : 'todo';
  t.doneAt = done ? Date.now() : null;
  replan(); render();
  if (done) toast(`✓ 「${t.title}」完了！`);
}

// ───────── 予定 ─────────
let planDay = null;
function renderPlan() {
  const el = $('#view-plan');
  const today = new Date();
  const keys = Array.from({ length: state.settings.days }, (_, i) => ymd(addDays(today, i)));
  if (!planDay || !keys.includes(planDay)) planDay = keys[0];
  const d = parseYmd(planDay);
  const items = dayItems(planDay);
  const study = items.filter((i) => i.type === 'must' || i.type === 'want').reduce((a, i) => a + i.end - i.start, 0);
  el.innerHTML = `
    <div class="days">${keys.map((k, i) => { const x = parseYmd(k); return `<button data-act="plan-day" data-key="${k}" class="${k === planDay ? 'on' : ''}">${i === 0 ? '今日' : i === 1 ? '明日' : WD[x.getDay()]}<b>${x.getDate()}</b></button>`; }).join('')}</div>
    ${warnings.length ? `<div class="warnbox">${warnings.map((x) => `<div>⚠ ${esc(x.task.title)}（${parseYmd(x.task.deadline).getMonth() + 1}/${parseYmd(x.task.deadline).getDate()}締切）：あと${dur(x.short)}入りきりません</div>`).join('')}<div class="muted small">目安時間を見直すか、予定を手で空けてください</div></div>` : ''}
    <div class="row"><b>${md(d)}</b><span class="spacer"></span><span class="muted small">勉強 ${dur(study)}</span></div>
    <div class="plan-actions">
      <button class="btn sm" data-act="replan">↻ 組み直す</button>
      <button class="btn sm" data-act="add-event">＋ 予定を入れる</button>
    </div>
    ${timeline(planDay)}
    <p class="muted small">ブロックをタップすると、時間の変更・入れ替え・タスクの差し替えができます。手で変えたブロックは 📌 がつき、「組み直す」でも動きません。授業は ⚙ 設定の時間割で変えられます。</p>`;
}

function blockSheet(key, id) {
  const plan = state.plans[key];
  const b = plan?.blocks.find((x) => x.id === id);
  if (!b) return;
  const t = b.taskId ? taskById(b.taskId) : null;
  const movable = plan.blocks.filter((x) => x.type !== 'event').sort((a, c) => a.start - c.start);
  const idx = movable.indexOf(b);
  const prev = movable[idx - 1], next = movable[idx + 1];
  const title = b.title || (t ? t.title : b.type === 'reward' ? 'だらだら時間' : b.type === 'rest' ? '空き' : '');
  const opts = state.tasks.filter(isActive).map((x) => `<option value="${x.id}" ${x.id === b.taskId ? 'selected' : ''}>${esc(x.title)}</option>`).join('');
  const isToday = key === ymd(new Date());
  openSheet(`<h3>${b.type === 'reward' ? '☕ ' : ''}${esc(title)}${b.locked ? ' 📌' : ''}</h3>
    <p class="muted small" style="margin-top:0">${md(parseYmd(key))} ${hm(b.start)}–${hm(b.end)}</p>
    ${t && isActive(t) && isToday ? `<button class="btn primary block" id="bStart">▶ これを始める</button>` : ''}
    <div class="two" style="margin-top:12px">
      <label class="field"><span>開始</span><input type="time" id="bS" value="${hm(b.start)}" step="300"></label>
      <label class="field"><span>終了</span><input type="time" id="bE" value="${hm(b.end)}" step="300"></label>
    </div>
    ${b.type === 'event' ? `<label class="field"><span>名前</span><input type="text" id="bTitle" value="${esc(b.title)}"></label>` : ''}
    ${b.type === 'must' || b.type === 'want' || b.type === 'rest' ? `<label class="field"><span>やること</span><select id="bTask"><option value="">（空き・休み）</option>${opts}</select></label>` : ''}
    ${b.type !== 'event' ? `<div class="two"><button class="btn" id="bUp" ${prev ? '' : 'disabled style="opacity:.35"'}>↑ 前と入れ替え</button><button class="btn" id="bDown" ${next ? '' : 'disabled style="opacity:.35"'}>↓ 後と入れ替え</button></div>` : ''}
    <div class="actions">
      ${b.type === 'event' || b.type === 'rest' ? '<button class="btn danger" id="bDel">削除</button>' : b.type !== 'reward' ? '<button class="btn" id="bRest">ここを空ける</button>' : ''}
      ${b.locked && b.type !== 'event' ? '<button class="btn" id="bUnlock">📌 固定をはずす</button>' : ''}
      <button class="btn primary" id="bSave">保存</button>
    </div>`);
  const swap = (o) => {
    // 時間はそのままに、中身（タスク）を入れ替える
    const keys = ['type', 'taskId', 'title'];
    for (const k of keys) { const tmp = b[k]; b[k] = o[k]; o[k] = tmp; }
    b.locked = o.locked = true;
    save(); closeSheet(); render(); toast('入れ替えました 📌');
  };
  if ($('#bUp') && prev) $('#bUp').onclick = () => swap(prev);
  if ($('#bDown') && next) $('#bDown').onclick = () => swap(next);
  if ($('#bStart')) $('#bStart').onclick = () => { closeSheet(); startFocus(t.id, b.id); };
  $('#bSave').onclick = () => {
    const s = toMin($('#bS').value), e = toMin($('#bE').value);
    if (!(e > s)) { toast('終了は開始より後にしてください'); return; }
    b.start = s; b.end = e;
    if ($('#bTitle')) b.title = $('#bTitle').value.trim() || '予定';
    if ($('#bTask')) {
      const v = $('#bTask').value;
      if (v) { const nt = taskById(v); b.taskId = v; b.type = nt.kind; delete b.title; }
      else { b.taskId = null; b.type = 'rest'; }
    }
    b.locked = true;
    plan.blocks.sort((a, c) => a.start - c.start);
    closeSheet(); replan(); render(); toast('変更しました 📌');
  };
  if ($('#bRest')) $('#bRest').onclick = () => { b.type = 'rest'; b.taskId = null; b.locked = true; closeSheet(); replan(); render(); toast('この時間は空けておきます'); };
  if ($('#bDel')) $('#bDel').onclick = () => { plan.blocks = plan.blocks.filter((x) => x !== b); closeSheet(); replan(); render(); };
  if ($('#bUnlock')) $('#bUnlock').onclick = () => { b.locked = false; closeSheet(); replan(); render(); toast('固定をはずして組み直しました'); };
}

function eventSheet(key) {
  openSheet(`<h3>予定を入れる</h3>
    <p class="muted small" style="margin-top:0">${md(parseYmd(key))}だけの予定（サークル・バイトなど）。この時間には勉強を入れません。</p>
    <label class="field"><span>名前</span><input type="text" id="eTitle" placeholder="例：サークル" maxlength="40"></label>
    <div class="two"><label class="field"><span>開始</span><input type="time" id="eS" value="18:00" step="300"></label>
    <label class="field"><span>終了</span><input type="time" id="eE" value="20:00" step="300"></label></div>
    <div class="actions"><button class="btn" data-close>やめる</button><button class="btn primary" id="eSave">追加</button></div>`);
  $('#eSave').onclick = () => {
    const s = toMin($('#eS').value), e = toMin($('#eE').value);
    if (!(e > s)) { toast('終了は開始より後にしてください'); return; }
    state.plans[key] = state.plans[key] || { blocks: [] };
    state.plans[key].blocks.push({ id: uid(), type: 'event', title: $('#eTitle').value.trim() || '予定', start: s, end: e, locked: true });
    closeSheet(); replan(); render(); toast('予定を入れて、組み直しました');
  };
}

// ───────── 記録 ─────────
let weekOffset = 0, selDay = null;
function weekStart(d) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); const wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); return x; }
function renderStats() {
  const el = $('#view-stats');
  const ws = addDays(weekStart(new Date()), weekOffset * 7);
  const keys = Array.from({ length: 7 }, (_, i) => ymd(addDays(ws, i)));
  const per = {}; keys.forEach((k) => { per[k] = {}; FIELDS.forEach((f) => (per[k][f.id] = 0)); });
  const tot = {}; FIELDS.forEach((f) => (tot[f.id] = 0));
  for (const s of state.sessions) {
    const k = ymd(new Date(s.startAt));
    if (per[k]) { per[k][s.field] = (per[k][s.field] || 0) + s.minutes; tot[s.field] = (tot[s.field] || 0) + s.minutes; }
  }
  const dayTot = keys.map((k) => FIELDS.reduce((a, f) => a + per[k][f.id], 0));
  const sum = dayTot.reduce((a, b) => a + b, 0);
  const max = Math.max(60, ...dayTot);
  const todayKey = ymd(new Date());
  if (!selDay || !keys.includes(selDay)) selDay = keys.includes(todayKey) ? todayKey : null;
  const used = FIELDS.filter((f) => tot[f.id] > 0 || f.id !== 'other');
  const doneWeek = state.tasks.filter((t) => t.doneAt && keys.includes(ymd(new Date(t.doneAt)))).sort((a, b) => a.doneAt - b.doneAt);
  const fmax = Math.max(1, ...FIELDS.map((f) => tot[f.id]));
  const detail = (k) => {
    if (!k) return 'グラフの棒をタップすると、その日の内訳が出ます';
    const i = keys.indexOf(k);
    const parts = FIELDS.filter((f) => per[k][f.id]).map((f) => `${f.name} ${dur(per[k][f.id])}`);
    return `<b style="color:var(--ink)">${md(parseYmd(k))} 合計 ${dur(dayTot[i])}</b><br>${parts.join(' / ') || '記録なし'}`;
  };
  el.innerHTML = `
    <div class="weeknav">
      <button class="btn sm" data-act="week" data-d="-1">‹ 前の週</button>
      <b>${md(ws)}〜${md(addDays(ws, 6)).replace(/（.）/, '')}</b>
      <button class="btn sm" data-act="week" data-d="1" ${weekOffset >= 0 ? 'disabled style="opacity:.35"' : ''}>次の週 ›</button>
    </div>
    <div class="card">
      <div class="muted small">この週の集中</div>
      <div class="big-num">${dur(sum)}</div>
      <div class="muted small" style="margin-bottom:12px">1日平均 ${dur(sum / 7)}・完了 ${doneWeek.length}件</div>
      <div class="legend">${used.map((f) => `<span class="f-${f.id}"><i class="sw"></i>${f.name}</span>`).join('')}</div>
      <div class="chart" role="img" aria-label="日ごとの分野別集中時間">
        ${keys.map((k, i) => `<div class="col ${k === selDay ? 'sel' : ''}" data-act="sel-day" data-key="${k}" title="${md(parseYmd(k))} ${dur(dayTot[i])}">
          ${dayTot[i] ? `<span class="tot">${dayTot[i] >= 60 ? (dayTot[i] / 60).toFixed(1) + 'h' : dayTot[i] + 'm'}</span>` : ''}
          <div class="stack">${FIELDS.filter((f) => per[k][f.id] > 0).map((f) => `<i class="f-${f.id}" style="height:${Math.max(2, per[k][f.id] / max * 140)}px"></i>`).join('')}</div>
        </div>`).join('')}
      </div>
      <div class="xlabels">${keys.map((k) => `<span class="${k === todayKey ? 'today' : ''}">${WD[parseYmd(k).getDay()]}</span>`).join('')}</div>
      <div class="daydetail" id="dayDetail">${detail(selDay)}</div>
    </div>
    <h2>分野ごと</h2>
    <div class="card"><table class="ftable">${FIELDS.map((f) => `<tr class="f-${f.id}"><td><div class="nm"><i class="sw"></i>${f.name}</div><div class="hbar"><i style="width:${tot[f.id] / fmax * 100}%"></i></div></td><td class="val">${dur(tot[f.id])}<br><span class="muted small">${sum ? Math.round(tot[f.id] / sum * 100) : 0}%</span></td></tr>`).join('')}</table></div>
    <h2>完了したタスク</h2>
    ${doneWeek.length ? `<ul class="tl">${doneWeek.map((t) => `<li class="f-${t.field}"><div class="tl-time">${md(new Date(t.doneAt)).replace(/（.）/, '')}</div><div class="tl-title">${esc(t.title)}</div><span class="tl-done">✓</span></li>`).join('')}</ul>` : '<div class="empty">この週はまだありません</div>'}
  `;
}

// ───────── 設定 ─────────
function renderSettings() {
  const el = $('#view-settings');
  const s = state.settings;
  const byDay = WD_ORDER.map((wd) => ({ wd, list: state.fixed.filter((f) => f.weekday === wd).sort((a, b) => toMin(a.start) - toMin(b.start)) }));
  const num = (k, label, unit = '分') => `<div class="num-row"><span>${label}</span><span class="row"><input type="number" data-set="${k}" value="${s[k]}" min="1" inputmode="numeric"><span class="muted small">${unit}</span></span></div>`;
  const tog = (k, label) => `<div class="num-row"><span>${label}</span><button class="toggle ${s[k] ? 'on' : ''}" data-act="toggle-set" data-k="${k}" aria-pressed="${!!s[k]}"></button></div>`;
  el.innerHTML = `
    <div class="set-head"><button class="icon-btn" data-act="back" aria-label="戻る">‹</button><h1>設定</h1></div>
    <h2>時間割・毎週の予定</h2>
    <div class="card">
      ${byDay.some((d) => d.list.length) ? `<ul class="set-list">${byDay.filter((d) => d.list.length).map((d) => d.list.map((f) => `<li><b>${WD[d.wd]}</b><span class="dot f-${f.field || 'other'}"></span><span style="flex:1">${esc(f.name)}<br><span class="muted small">${f.start}–${f.end}${f.type === 'class' ? '・授業' : ''}</span></span><button class="x" data-act="del-fixed" data-id="${f.id}" aria-label="削除">✕</button></li>`).join('')).join('')}</ul>` : '<p class="muted">まだありません。授業を登録すると、その時間を避けて予定を組みます。</p>'}
      <div class="two" style="margin-top:10px"><button class="btn" data-act="add-class">＋ 授業</button><button class="btn" data-act="add-fixed">＋ バイトなど</button></div>
    </div>
    <h2>勉強に使える時間帯（曜日ごと）</h2>
    <div class="card">
      ${WD_ORDER.map((wd) => `<div class="wd-row"><b>${WD[wd]}</b><input type="time" data-win="${wd}" data-p="start" value="${state.windows[wd].start}" step="300"><span>–</span><input type="time" data-win="${wd}" data-p="end" value="${state.windows[wd].end}" step="300"></div>`).join('')}
      <p class="muted small">この時間帯から授業などを引いた残りが「空き時間」です。終わりの時刻の前に、だらだら時間が入ります。</p>
    </div>
    <h2>ポモドーロ</h2>
    <div class="card">${num('focusMin', '集中')}${num('breakMin', '休憩')}${num('longBreakMin', '長い休憩')}${num('longEvery', '長い休憩は何回ごと', '回')}</div>
    <h2>自動スケジュール</h2>
    <div class="card">${num('rewardMin', 'だらだら時間（毎日）')}${num('blockMin', '1コマの長さ')}${num('minBlockMin', 'これより短い空きは使わない')}${num('gapMin', 'コマの間の余白')}${num('maxPerTaskDay', '1つのタスクは1日まで')}${num('days', '何日先まで組む', '日')}</div>
    <h2>タイマーの合図</h2>
    <div class="card">${tog('sound', '音を鳴らす')}${tog('vibrate', '振動（Android）')}${tog('wakeLock', 'タイマー中は画面を消さない')}
      ${'Notification' in window ? `<div class="num-row"><span>通知<br><span class="muted small">${Notification.permission === 'granted' ? '許可済み' : 'ほかのアプリを見ているときに知らせる'}</span></span>${Notification.permission === 'granted' ? '' : '<button class="btn sm" data-act="notif">許可する</button>'}</div>` : ''}
    </div>
    <h2>データ</h2>
    <div class="card">
      <p class="muted small" style="margin-top:0">データはこのスマホのブラウザだけに保存されています。ブラウザのデータを消すと消えるので、ときどきバックアップしてください。</p>
      <div class="two"><button class="btn" data-act="export">バックアップを保存</button><button class="btn" data-act="import">バックアップから復元</button></div>
      <input type="file" id="importFile" accept="application/json,.json" hidden>
      <button class="btn danger block" style="margin-top:10px" data-act="reset">すべて消す</button>
    </div>
    <p class="muted small" style="text-align:center">べんきょう v1</p>`;
}

function classSheet(type) {
  const sel = new Set();
  const f = { field: 'other', period: 1 };
  const draw = () => {
    const days = WD_ORDER.map((wd) => `<button data-wd="${wd}" class="${sel.has(wd) ? 'on' : ''}">${WD[wd]}</button>`).join('');
    openSheet(`<h3>${type === 'class' ? '授業を登録' : '毎週の予定を登録'}</h3>
      <label class="field"><span>名前</span><input type="text" id="cName" value="${esc(f.name || '')}" placeholder="${type === 'class' ? '例：英語一列' : '例：バイト'}" maxlength="40"></label>
      <div class="field"><span>曜日（複数えらべます）</span><div class="chips">${days}</div></div>
      ${type === 'class' ? `<div class="field"><span>時限</span><div class="chips">${PERIODS.map(([p, a, b]) => `<button data-p="${p}" class="${f.period === p ? 'on' : ''}">${p}限</button>`).join('')}<button data-p="0" class="${f.period === 0 ? 'on' : ''}">時刻で</button></div></div>` : ''}
      <div class="two" ${type === 'class' && f.period ? 'hidden' : ''}>
        <label class="field"><span>開始</span><input type="time" id="cS" value="${f.s || '18:00'}" step="300"></label>
        <label class="field"><span>終了</span><input type="time" id="cE" value="${f.e || '21:00'}" step="300"></label></div>
      ${type === 'class' && f.period ? `<p class="muted small">${PERIODS[f.period - 1][1]}–${PERIODS[f.period - 1][2]}</p>` : ''}
      ${type === 'class' ? `<div class="field"><span>分野</span><div class="chips">${FIELDS.map((x) => `<button data-f="${x.id}" class="f-${x.id} ${f.field === x.id ? 'on' : ''}"><span class="dot"></span>${x.name}</button>`).join('')}</div></div>` : ''}
      <div class="actions"><button class="btn" data-close>やめる</button><button class="btn primary" id="cSave">追加</button></div>`);
    const sync = () => { f.name = $('#cName').value; if ($('#cS')) { f.s = $('#cS').value; f.e = $('#cE').value; } };
    $$('#sheet [data-wd]').forEach((b) => b.onclick = () => { sync(); const w = +b.dataset.wd; sel.has(w) ? sel.delete(w) : sel.add(w); draw(); });
    $$('#sheet [data-p]').forEach((b) => b.onclick = () => { sync(); f.period = +b.dataset.p; draw(); });
    $$('#sheet [data-f]').forEach((b) => b.onclick = () => { sync(); f.field = b.dataset.f; draw(); });
    $('#cSave').onclick = () => {
      sync();
      if (!sel.size) { toast('曜日をえらんでください'); return; }
      let st = f.s || '18:00', en = f.e || '21:00';
      if (type === 'class' && f.period) [, st, en] = PERIODS[f.period - 1];
      if (toMin(en) <= toMin(st)) { toast('終了は開始より後にしてください'); return; }
      for (const wd of sel) state.fixed.push({ id: uid(), weekday: wd, start: st, end: en, name: f.name.trim() || (type === 'class' ? '授業' : '予定'), field: type === 'class' ? f.field : null, type });
      closeSheet(); replan(); render(); toast('登録しました');
    };
  };
  draw();
}

// ───────── タイマー ─────────
let tick = null, wakeLock = null, audioCtx = null;
function phaseLen(p) { const s = state.settings; return (p === 'focus' ? s.focusMin : p === 'long' ? s.longBreakMin : s.breakMin) * 60000; }

function startFocus(taskId, blockId) {
  const t = taskById(taskId);
  if (!t) return;
  unlockAudio();
  if (t.status === 'todo') t.status = 'doing';
  const prev = state.timer && state.timer.taskId === taskId ? state.timer.cycle : (state.timer?.cycle || 0);
  const len = phaseLen('focus');
  state.timer = { taskId, blockId: blockId || null, phase: 'focus', len, endAt: Date.now() + len, startAt: Date.now(), paused: false, remain: 0, cycle: prev, ask: false, doneAsked: false };
  save();
  openTimer();
}
function logFocus(taskId, minutes, startAt, endAt) {
  minutes = Math.round(minutes);
  if (minutes < 1) return;
  const t = taskById(taskId);
  state.sessions.push({ id: uid(), taskId, title: t?.title || '', field: t?.field || 'other', startAt, endAt, minutes });
  if (t) t.spentMin = (t.spentMin || 0) + minutes;
}
function remainMs() { const tm = state.timer; if (!tm) return 0; return tm.paused ? tm.remain : Math.max(0, tm.endAt - Date.now()); }

// 時間がきたら次の段階へ。画面を消していた間の分もまとめて進める。
function advance() {
  const tm = state.timer;
  if (!tm || tm.paused || !tm.endAt) return false;
  let changed = false;
  if (tm.phase === 'focus' && Date.now() >= tm.endAt) {
    logFocus(tm.taskId, tm.len / 60000, tm.endAt - tm.len, tm.endAt);
    tm.cycle++;
    const p = tm.cycle % state.settings.longEvery === 0 ? 'long' : 'break';
    const len = phaseLen(p);
    Object.assign(tm, { phase: p, len, endAt: tm.endAt + len, ask: true });
    changed = true;
    alarm('集中おわり！休憩しよう');
  }
  if ((tm.phase === 'break' || tm.phase === 'long') && Date.now() >= tm.endAt) {
    Object.assign(tm, { phase: 'ready', endAt: null });
    changed = true;
    alarm('休憩おわり。次の集中へ');
  }
  if (changed) { save(); replan(); }
  return changed;
}

function openTimer() {
  $('#timer').hidden = false;
  document.body.style.overflow = 'hidden';
  requestWake();
  drawTimer();
  clearInterval(tick);
  tick = setInterval(() => { if (advance()) drawTimer(); else updateTimer(); }, 250);
}
function closeTimer() {
  $('#timer').hidden = true;
  document.body.style.overflow = '';
  clearInterval(tick); tick = null;
  releaseWake();
  document.title = 'べんきょう';
  render();
}

function drawTimer() {
  const tm = state.timer, el = $('#timer');
  if (!tm) { closeTimer(); return; }
  const t = taskById(tm.taskId);
  const brk = tm.phase !== 'focus';
  el.classList.toggle('brk', brk);
  const phaseName = { focus: '集中', break: '休憩', long: '長い休憩', ready: '休憩おわり' }[tm.phase];
  const C = 2 * Math.PI * 46;
  const askHtml = tm.ask && t && isActive(t) ? `<div class="ask"><p>「${esc(t.title)}」は完了した？</p><div class="row"><button class="btn" data-tact="not-done">まだ続ける</button><button class="btn primary" data-tact="done">✓ 完了</button></div></div>` : '';
  let actions;
  if (tm.phase === 'ready') {
    const nx = t && isActive(t) ? t : null;
    actions = `${nx ? `<div class="tm-actions" style="margin-bottom:10px"><button class="btn primary" data-tact="again">▶ 次の集中を始める</button></div>` : `<div class="tm-actions" style="margin-bottom:10px"><button class="btn primary" data-tact="next">▶ 次のタスクへ</button></div>`}
      <div class="tm-actions"><button class="btn" data-tact="change">タスクを変える</button><button class="btn" data-tact="end">おわる</button></div>`;
  } else if (brk) {
    actions = `<div class="tm-actions"><button class="btn" data-tact="skip">休憩をとばす</button><button class="btn" data-tact="end">おわる</button></div>`;
  } else {
    actions = `<div class="tm-actions"><button class="btn" data-tact="stop">中止</button><button class="btn primary" data-tact="pause">${tm.paused ? '▶ 再開' : 'Ⅱ 一時停止'}</button></div>`;
  }
  el.innerHTML = `
    <div class="tm-top"><span class="tm-phase">${phaseName}</span><button class="btn sm" data-tact="min">ホームへ</button></div>
    <div class="tm-center">
      <div class="tm-task">${esc(t?.title || '')}</div>
      ${t ? `<div>${fieldChip(t.field)}</div>` : ''}
      <div class="ring"><svg viewBox="0 0 100 100"><circle class="bg" cx="50" cy="50" r="46" fill="none" stroke-width="4"/><circle class="fg" id="ringFg" cx="50" cy="50" r="46" fill="none" stroke-width="4" stroke-dasharray="${C}" stroke-dashoffset="0"/></svg><div class="t" id="tmText"></div></div>
      <div class="tm-cycle">集中 ${tm.cycle}回目おわり・今日の合計 ${dur(todayFocus())}</div>
    </div>
    ${askHtml}${actions}`;
  updateTimer();
}
function updateTimer() {
  const tm = state.timer;
  if (!tm) return;
  const txt = $('#tmText'), fg = $('#ringFg');
  if (!txt) return;
  if (tm.phase === 'ready') { txt.textContent = '0:00'; if (fg) fg.style.strokeDashoffset = 2 * Math.PI * 46; document.title = '休憩おわり'; return; }
  const r = remainMs(), sec = Math.ceil(r / 1000);
  const str = `${Math.floor(sec / 60)}:${pad(sec % 60)}`;
  txt.textContent = str;
  if (fg) fg.style.strokeDashoffset = 2 * Math.PI * 46 * (1 - r / tm.len);
  document.title = `${str} ${tm.phase === 'focus' ? '集中' : '休憩'}`;
}

async function timerAction(a) {
  const tm = state.timer;
  if (!tm) return;
  const t = taskById(tm.taskId);
  if (a === 'pause') {
    if (tm.paused) { tm.endAt = Date.now() + tm.remain; tm.paused = false; }
    else { tm.remain = Math.max(0, tm.endAt - Date.now()); tm.paused = true; }
    save(); drawTimer();
  } else if (a === 'stop') {
    const done = tm.len - remainMs();
    const m = Math.round(done / 60000);
    const res = await ask(`中止します。集中した${m}分は記録します。${t && isActive(t) ? `\n「${t.title}」は完了した？` : ''}`, t && isActive(t) ? '✓ 完了' : 'OK', t && isActive(t) ? 'まだ' : null, true);
    if (res === null) return; // キャンセル
    logFocus(tm.taskId, done / 60000, Date.now() - done, Date.now());
    if (res === true && t && isActive(t)) { t.status = 'done'; t.doneAt = Date.now(); toast(`✓ 「${t.title}」完了！`); }
    state.timer = null; save(); replan(); closeTimer();
  } else if (a === 'done') {
    t.status = 'done'; t.doneAt = Date.now(); tm.ask = false;
    save(); replan(); toast(`✓ 「${t.title}」完了！`); drawTimer();
  } else if (a === 'not-done') {
    tm.ask = false; save(); drawTimer();
  } else if (a === 'skip') {
    Object.assign(tm, { phase: 'ready', endAt: null, ask: false }); save(); drawTimer();
  } else if (a === 'again') {
    startFocus(tm.taskId, tm.blockId);
  } else if (a === 'next') {
    const { item } = nextUp();
    const nt = item && item.task && isActive(item.task) ? item.task : urgentTask();
    if (nt) startFocus(nt.id, item?.id); else { state.timer = null; save(); closeTimer(); toast('やることは全部おわりました！'); }
  } else if (a === 'change') {
    pickTask((id) => startFocus(id));
  } else if (a === 'end') {
    state.timer = null; save(); closeTimer();
  } else if (a === 'min') {
    closeTimer();
  }
}

function unlockAudio() {
  try { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch (e) {}
}
function alarm(msg) {
  const s = state.settings;
  if (s.vibrate && navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);
  if (s.sound && audioCtx) {
    try {
      const t0 = audioCtx.currentTime;
      [0, 0.35, 0.7].forEach((d) => {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.frequency.value = 880; o.type = 'sine';
        g.gain.setValueAtTime(0.0001, t0 + d); g.gain.exponentialRampToValueAtTime(0.3, t0 + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.28);
        o.connect(g).connect(audioCtx.destination); o.start(t0 + d); o.stop(t0 + d + 0.3);
      });
    } catch (e) {}
  }
  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    try {
      navigator.serviceWorker?.getRegistration().then((r) => r ? r.showNotification('べんきょう', { body: msg, tag: 'timer' }) : new Notification('べんきょう', { body: msg }));
    } catch (e) {}
  }
}
async function requestWake() {
  if (!state.settings.wakeLock || !('wakeLock' in navigator)) return;
  try { wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {}
}
function releaseWake() { try { wakeLock?.release(); } catch (e) {} wakeLock = null; }

// ───────── シート・確認・お知らせ ─────────
let sheetResolve = null;
function openSheet(html) {
  $('#sheet').innerHTML = `<div class="grab"></div>${html}`;
  $('#sheetWrap').hidden = false;
}
function closeSheet() {
  $('#sheetWrap').hidden = true;
  $('#sheet').innerHTML = '';
  if (sheetResolve) { const r = sheetResolve; sheetResolve = null; r(null); }
}
// 確認：OK→true、2つ目のボタン→false、閉じる→null（twoWayでないときは OK→true / それ以外→false）
function ask(msg, okLabel = 'OK', noLabel = null, twoWay = false) {
  return new Promise((resolve) => {
    openSheet(`<p style="white-space:pre-line;font-weight:600;margin:6px 0 4px">${esc(msg)}</p>
      <div class="actions">${noLabel ? `<button class="btn" id="askNo">${esc(noLabel)}</button>` : '<button class="btn" id="askCancel">やめる</button>'}<button class="btn primary" id="askOk">${esc(okLabel)}</button></div>
      ${noLabel ? '<div style="text-align:center"><button class="link" id="askCancel">やめる</button></div>' : ''}`);
    sheetResolve = (v) => resolve(twoWay ? v : !!v);
    const fin = (v) => { const r = sheetResolve; sheetResolve = null; $('#sheetWrap').hidden = true; r(v); };
    $('#askOk').onclick = () => fin(true);
    if ($('#askNo')) $('#askNo').onclick = () => fin(false);
    $('#askCancel').onclick = () => fin(null);
  });
}
function pickTask(cb) {
  const list = state.tasks.filter(isActive).sort((a, b) => (b.kind === 'must') - (a.kind === 'must') || (a.deadline || '9999').localeCompare(b.deadline || '9999'));
  if (!list.length) { toast('タスクがありません。リストに追加してください'); return; }
  openSheet(`<h3>どれをやる？</h3><ul class="pick">${list.map((t) => `<li><button data-pick="${t.id}" class="f-${t.field}"><span class="dot"></span><span style="flex:1">${esc(t.title)}<br><span class="muted small">${t.kind === 'must' ? 'やらなきゃ' : 'やりたい'}${t.deadline ? '・' + deadlineText(t) : ''}</span></span><span>▶</span></button></li>`).join('')}</ul>`);
  $$('#sheet [data-pick]').forEach((b) => b.onclick = () => { closeSheet(); cb(b.dataset.pick); });
}
let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 2400);
}

// ───────── 操作 ─────────
document.addEventListener('click', async (e) => {
  const close = e.target.closest('[data-close]');
  if (close) { closeSheet(); return; }
  const tb = e.target.closest('[data-tact]');
  if (tb) { timerAction(tb.dataset.tact); return; }
  const nav = e.target.closest('#tabs button');
  if (nav) { setView(nav.dataset.view); return; }
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const a = el.dataset.act;
  switch (a) {
    case 'start': startFocus(el.dataset.task, el.dataset.block); break;
    case 'open-timer': openTimer(); break;
    case 'pick-start': pickTask((id) => startFocus(id)); break;
    case 'add-task': taskSheet(null); break;
    case 'edit-task': taskSheet(taskById(el.dataset.id)); break;
    case 'toggle-done': { const t = taskById(el.dataset.id); if (t) setDone(t, t.status !== 'done'); break; }
    case 'list-tab': listTab = el.dataset.tab; renderLists(); break;
    case 'go-settings': setView('settings'); break;
    case 'plan-day': planDay = el.dataset.key; renderPlan(); break;
    case 'replan': replan(); render(); toast('組み直しました'); break;
    case 'add-event': eventSheet(planDay); break;
    case 'edit-block': blockSheet(el.dataset.key, el.dataset.id); break;
    case 'week': weekOffset = Math.min(0, weekOffset + +el.dataset.d); selDay = null; renderStats(); break;
    case 'sel-day': selDay = el.dataset.key; renderStats(); break;
    case 'back': setView('home'); break;
    case 'add-class': classSheet('class'); break;
    case 'add-fixed': classSheet('other'); break;
    case 'del-fixed': state.fixed = state.fixed.filter((f) => f.id !== el.dataset.id); replan(); renderSettings(); break;
    case 'toggle-set': state.settings[el.dataset.k] = !state.settings[el.dataset.k]; save(); renderSettings(); break;
    case 'notif': try { await Notification.requestPermission(); } catch (e2) {} renderSettings(); break;
    case 'export': exportJson(); break;
    case 'import': $('#importFile').click(); break;
    case 'reset':
      if (await ask('すべてのデータを消します。元に戻せません。', '消す')) { state = defaults(); save(); replan(); setView('home'); toast('消しました'); }
      break;
  }
});
$('#btnSettings').onclick = () => setView('settings');

document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.set) {
    const v = Math.max(1, Math.round(+t.value || 1));
    state.settings[t.dataset.set] = t.dataset.set === 'days' ? Math.min(14, v) : v;
    replan(); toast('保存しました');
  } else if (t.dataset.win != null) {
    const w = state.windows[t.dataset.win];
    const nv = { ...w, [t.dataset.p]: t.value };
    if (!t.value || toMin(nv.end) <= toMin(nv.start)) { toast('終わりは始まりより後にしてください'); renderSettings(); return; }
    state.windows[t.dataset.win] = nv; replan(); toast('保存しました');
  } else if (t.id === 'importFile') importJson(t.files[0]);
});

function exportJson() {
  const blob = new Blob([JSON.stringify({ ...state, timer: null, exportedAt: new Date().toISOString() }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `benkyo-${ymd(new Date())}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
async function importJson(file) {
  if (!file) return;
  try {
    const d = JSON.parse(await file.text());
    if (!Array.isArray(d.tasks) || !Array.isArray(d.sessions)) throw new Error('形式がちがいます');
    if (!(await ask(`${file.name} から復元します。いまのデータは置き換わります。`, '復元'))) return;
    const base = defaults();
    state = { ...base, ...d, settings: { ...base.settings, ...(d.settings || {}) }, windows: { ...base.windows, ...(d.windows || {}) }, timer: null };
    replan(); setView('home'); toast('復元しました');
  } catch (err) { toast('読み込めませんでした：' + err.message); }
  $('#importFile').value = '';
}

// 画面に戻ってきたら、時間を進めて予定を最新に
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  advance();
  if (!state.lastPlan || Date.now() - state.lastPlan > 60000 || ymd(new Date(state.lastPlan)) !== ymd(new Date())) replan();
  if (!$('#timer').hidden) { requestWake(); drawTimer(); } else render();
});
// 開いている間、1分ごとに「次にやること」を更新
setInterval(() => { if ($('#timer').hidden && $('#sheetWrap').hidden) { if (advance()) {} ; renderHeader(); if (view === 'home') renderHome(); } }, 60000);

// ───────── 起動 ─────────
advance();
replan();
render();
if (state.timer) openTimer();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
