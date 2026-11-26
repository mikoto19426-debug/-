'use strict';
// オフライン会計 — データはすべて端末内の IndexedDB に保存されます。
// 同期のしくみ：取引・口座・科目はそれぞれ updatedAt（最終更新時刻）を持ち、
// 削除も「deleted: true の記録」として残します。2つのデータを合わせるときは
// 同じIDごとに新しい方を採用するので、どちらの端末の入力も消えません。

const DB_NAME = 'offline-kaikei';
const DB_VERSION = 1;
const DEFAULT_CATEGORIES = {
  expense: ['仕入', '消耗品費', '通信費', '水道光熱費', '旅費交通費', '地代家賃', '広告宣伝費', '接待交際費', '支払手数料', '食費', '雑費'],
  income: ['売上', '給与', '雑収入'],
};
const DEFAULT_ACCOUNTS = [
  { id: 'cash', name: '現金', opening: 0, updatedAt: 0 },
  { id: 'bank', name: '普通預金', opening: 0, updatedAt: 0 },
];

// ---------- IndexedDB ----------
let db;
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('tx')) {
        const s = d.createObjectStore('tx', { keyPath: 'id' });
        s.createIndex('date', 'date');
      }
      if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
const store = (name, mode = 'readonly') => db.transaction(name, mode).objectStore(name);
function reqP(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function txDone(t) {
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}
const getAllTx = () => reqP(store('tx').getAll());
const putTx = (t) => reqP(store('tx', 'readwrite').put(t));

// ---------- データ形式 ----------
// settings（同期される）: { accounts: [{id,name,opening,updatedAt,deleted?}], categories: [{id,kind,name,updatedAt,deleted?}],
//                          menu: [{id,name,price,soldOut?,cost?,planQty?,createdAt,updatedAt,deleted?}],
//                          costs: [{id,name,amount,updatedAt,deleted?}]（出店料などの固定費）,
//                          event: {name,start,end,partyPeople,partyPerPerson,updatedAt}（計画・打ち上げ目標） }
// local（この端末だけ）: { lastBackup, lastSync, clientId, fileId, token, tokenExp, posAccount, deviceId, ticketStart }
// レジの注文は type:'income' の取引として保存し、items（明細）・ticket（整理券番号）・served（お渡し済み）を持つ
function normalizeSettings(s) {
  s = s || {};
  let categories = s.categories;
  if (!Array.isArray(categories)) {
    // 旧形式 { expense: [...], income: [...] } からの移行
    const src = categories || DEFAULT_CATEGORIES;
    categories = [];
    for (const kind of ['expense', 'income']) {
      for (const name of src[kind] || []) categories.push({ id: `${kind}:${name}`, kind, name, updatedAt: 0 });
    }
  }
  const accounts = (Array.isArray(s.accounts) ? s.accounts : structuredClone(DEFAULT_ACCOUNTS)).map((a) => ({ updatedAt: 0, ...a }));
  const menu = (Array.isArray(s.menu) ? s.menu : []).map((m) => ({ updatedAt: 0, ...m }));
  const costs = (Array.isArray(s.costs) ? s.costs : []).map((c) => ({ updatedAt: 0, ...c }));
  const event = { name: '', start: '', end: '', partyPeople: 7, partyPerPerson: 3000, updatedAt: 0, ...(s.event || {}) };
  return { accounts, categories, menu, costs, event };
}
function normalizeTx(t) {
  return { ...t, updatedAt: t.updatedAt ?? t.createdAt ?? 0 };
}
function parseData(data) {
  if (!data || data.app !== 'offline-kaikei' || !Array.isArray(data.transactions) || !data.settings) {
    throw new Error('このアプリのデータではありません');
  }
  return { settings: normalizeSettings(data.settings), transactions: data.transactions.filter((t) => t && t.id).map(normalizeTx) };
}
// y が x より新しければ true（同時刻なら内容で決めて、どの端末でも同じ結果になるようにする）
function newer(y, x) {
  const a = y.updatedAt || 0, b = x.updatedAt || 0;
  return a !== b ? a > b : JSON.stringify(y) > JSON.stringify(x);
}
function mergeRecords(a, b) {
  const m = new Map(a.map((x) => [x.id, x]));
  for (const y of b) {
    const x = m.get(y.id);
    if (!x || newer(y, x)) m.set(y.id, y);
  }
  return [...m.values()];
}

// ---------- 状態 ----------
let settings;   // 同期される設定
let local;      // 端末ごとの設定
let allTx = []; // 削除記録を含む全取引
let txs = [];   // 表示用（削除済みを除く、新しい順）

const accounts = () => settings.accounts.filter((a) => !a.deleted);
const menuItems = () => settings.menu.filter((m) => !m.deleted).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
const categories = (kind) => settings.categories.filter((c) => c.kind === kind && !c.deleted).map((c) => c.name);
const saveSettings = () => reqP(store('meta', 'readwrite').put(settings, 'settings'));
const saveLocal = () => reqP(store('meta', 'readwrite').put(local, 'local'));
function refreshVisible() {
  txs = allTx.filter((t) => !t.deleted).sort((x, y) => y.date.localeCompare(x.date) || (y.createdAt - x.createdAt));
}

// ---------- ユーティリティ ----------
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const yen = (n) => (n < 0 ? '-' : '') + '¥' + Math.abs(Math.round(n)).toLocaleString('ja-JP');
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const pad = (n) => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const thisMonth = () => today().slice(0, 7);
const fmtTime = (ms) => new Date(ms).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const TYPE_LABEL = { income: '収入', expense: '支出', transfer: '振替' };
const accName = (id) => settings.accounts.find((a) => a.id === id)?.name ?? '(不明な口座)';
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

// 確認・入力のダイアログ（ブラウザ標準の confirm / prompt の代わり。使えない環境があるため）
// キャンセルなら null、OKなら入力欄の値の配列（入力欄がなければ空配列）を返す
function ask({ message, fields = [], ok = 'OK', danger = false }) {
  const dlg = $('#ask');
  $('#askMsg').textContent = message;
  $('#askFields').innerHTML = fields.map((f, i) => `<label>${esc(f.label)}<input id="askField${i}" type="${f.type || 'text'}"
    ${f.type === 'number' ? 'inputmode="decimal" step="any"' : ''} value="${esc(f.value ?? '')}" placeholder="${esc(f.placeholder || '')}" autocomplete="off"></label>`).join('');
  const okBtn = $('#askOk');
  okBtn.textContent = ok;
  okBtn.className = danger ? 'danger-fill' : 'primary';
  return new Promise((resolve) => {
    const form = $('#askForm');
    const cancelBtn = $('#askCancel');
    const finish = (value) => {
      form.removeEventListener('submit', onSubmit);
      cancelBtn.removeEventListener('click', onCancel);
      dlg.removeEventListener('cancel', onCancel);
      if (dlg.open) dlg.close();
      resolve(value);
    };
    const onSubmit = (e) => { e.preventDefault(); finish(fields.map((_, i) => $('#askField' + i).value)); };
    const onCancel = (e) => { e.preventDefault(); finish(null); };
    form.addEventListener('submit', onSubmit);
    cancelBtn.addEventListener('click', onCancel);
    dlg.addEventListener('cancel', onCancel);
    dlg.showModal();
    (fields.length ? $('#askField0') : okBtn).focus();
  });
}

// ---------- タブ ----------
function showTab(name) {
  $$('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  $$('.tab').forEach((t) => t.classList.toggle('active', t.id === 'tab-' + name));
  render();
}
$('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]');
  if (b) showTab(b.dataset.tab);
});

// ---------- 入力フォーム ----------
const form = $('#entryForm');
function fillSelect(sel, items, current) {
  sel.innerHTML = items.map((i) => `<option value="${esc(i.value)}">${esc(i.label)}</option>`).join('');
  if (current != null && items.some((i) => i.value === current)) sel.value = current;
}
function refreshFormOptions() {
  const type = form.type.value;
  const isTr = type === 'transfer';
  form.classList.toggle('transfer', isTr);
  const accs = accounts().map((a) => ({ value: a.id, label: a.name }));
  fillSelect(form.account, accs, form.account.value);
  fillSelect(form.toAccount, accs, form.toAccount.value);
  if (form.toAccount.value === form.account.value) {
    const other = accs.find((a) => a.value !== form.account.value);
    if (other) form.toAccount.value = other.value;
  }
  if (!isTr) fillSelect(form.category, categories(type).map((c) => ({ value: c, label: c })), form.category.value);
  form.category.required = !isTr;
}
form.addEventListener('change', (e) => { if (e.target.name === 'type') refreshFormOptions(); });

function resetForm() {
  const keepType = form.type.value;
  const keepDate = form.date.value;
  form.reset();
  form.id.value = '';
  form.type.value = keepType;
  form.date.value = keepDate || today();
  $('#saveBtn').textContent = '保存';
  $('#cancelEdit').hidden = true;
  refreshFormOptions();
}
$('#cancelEdit').addEventListener('click', resetForm);

async function writeTx(t) {
  await putTx(t);
  const i = allTx.findIndex((x) => x.id === t.id);
  if (i >= 0) allTx[i] = t; else allTx.push(t);
  refreshVisible();
  changed();
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const type = form.type.value;
  const amount = Math.round(Number(form.amount.value));
  if (!(amount > 0)) return toast('金額を入力してください');
  if (!accounts().length) return toast('先に設定で口座を追加してください');
  if (type === 'transfer' && form.account.value === form.toAccount.value) return toast('振替元と振替先が同じです');
  const existing = txs.find((t) => t.id === form.id.value);
  const now = Date.now();
  const t = {
    id: existing?.id ?? uid(),
    type,
    date: form.date.value,
    amount,
    category: type === 'transfer' ? '' : form.category.value,
    account: form.account.value,
    toAccount: type === 'transfer' ? form.toAccount.value : '',
    memo: form.memo.value.trim(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  // レジの注文を手で直した場合も、明細・整理券番号は残す
  if (existing?.pos && type === 'income') Object.assign(t, { pos: true, items: existing.items, ticket: existing.ticket, served: existing.served });
  try {
    await writeTx(t);
  } catch (err) {
    return toast('保存に失敗しました: ' + err.message);
  }
  toast(existing ? '更新しました' : '保存しました');
  resetForm();
  form.amount.focus();
  render();
});

function editTx(id) {
  const t = txs.find((x) => x.id === id);
  if (!t) return;
  showTab('entry');
  form.type.value = t.type;
  refreshFormOptions();
  form.id.value = t.id;
  form.date.value = t.date;
  form.amount.value = t.amount;
  if (t.type !== 'transfer') {
    if (![...form.category.options].some((o) => o.value === t.category)) form.category.add(new Option(t.category, t.category));
    form.category.value = t.category;
  }
  for (const [sel, id2] of [[form.account, t.account], [form.toAccount, t.toAccount]]) {
    if (id2 && ![...sel.options].some((o) => o.value === id2)) sel.add(new Option(accName(id2), id2));
    if (id2) sel.value = id2;
  }
  form.memo.value = t.memo;
  $('#saveBtn').textContent = '更新';
  $('#cancelEdit').hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
async function removeTx(id) {
  if (!(await ask({ message: 'この取引を削除しますか？', ok: '削除する', danger: true }))) return;
  // 他の端末にも削除を伝えるため、削除記録として残す
  await writeTx({ id, deleted: true, updatedAt: Date.now() });
  if (form.id.value === id) resetForm();
  toast('削除しました');
  render();
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  if (b.dataset.act === 'edit') editTx(b.dataset.id);
  if (b.dataset.act === 'del') removeTx(b.dataset.id);
});

// ---------- 描画 ----------
function txHTML(t) {
  const sign = t.type === 'income' ? '+' : t.type === 'expense' ? '-' : '';
  const cls = t.type === 'income' ? 'inc' : t.type === 'expense' ? 'exp' : 'tr';
  const title = t.type === 'transfer' ? `${esc(accName(t.account))} → ${esc(accName(t.toAccount))}` : esc(t.category);
  const meta = [TYPE_LABEL[t.type], t.type === 'transfer' ? '' : accName(t.account), t.memo].filter(Boolean).map((x) => `<span>${esc(x)}</span>`).join('');
  return `<div class="tx">
    <div><div class="title">${title}</div><div class="meta">${meta}</div></div>
    <div class="amt ${cls}">${sign}${yen(t.amount)}</div>
    <div class="meta"></div>
    <div class="acts"><button data-act="edit" data-id="${esc(t.id)}">編集</button> <button data-act="del" data-id="${esc(t.id)}">削除</button></div>
  </div>`;
}
function groupedHTML(list) {
  if (!list.length) return '<div class="empty">取引はありません</div>';
  let html = '', day = '';
  for (const t of list) {
    if (t.date !== day) {
      if (day) html += '</div>';
      day = t.date;
      const d = new Date(day + 'T00:00:00');
      html += `<div class="day">${day.replace(/-/g, '/')}（${'日月火水木金土'[d.getDay()]}）</div><div class="card">`;
    }
    html += txHTML(t);
  }
  return html + '</div>';
}
function totals(list) {
  let income = 0, expense = 0;
  for (const t of list) {
    if (t.type === 'income') income += t.amount;
    else if (t.type === 'expense') expense += t.amount;
  }
  return { income, expense, net: income - expense };
}

function renderRecent() {
  $('#recent').innerHTML = groupedHTML(txs.slice(0, 10));
}

function renderList() {
  const m = $('#listMonth').value;
  const type = $('#listType').value;
  const q = $('#listQuery').value.trim().toLowerCase();
  const list = txs.filter((t) =>
    (!m || t.date.startsWith(m)) &&
    (!type || t.type === type) &&
    (!q || `${t.memo} ${t.category} ${accName(t.account)} ${t.toAccount ? accName(t.toAccount) : ''}`.toLowerCase().includes(q)));
  const s = totals(list);
  $('#listSummary').innerHTML = `${list.length}件　収入 <span class="inc">${yen(s.income)}</span>　支出 <span class="exp">${yen(s.expense)}</span>　収支 ${yen(s.net)}`;
  $('#list').innerHTML = groupedHTML(list);
}

function barsHTML(map, cls) {
  const rows = Object.entries(map).sort((a, b) => b[1] - a[1]);
  if (!rows.length) return '<div class="empty">データなし</div>';
  const max = rows[0][1];
  const sum = rows.reduce((s, r) => s + r[1], 0);
  return rows.map(([k, v]) => `<div class="bar-row">
    <span class="name" title="${esc(k)}">${esc(k)}</span>
    <span class="bar ${cls}"><i style="width:${(v / max) * 100}%"></i></span>
    <span class="num">${yen(v)} <span class="muted">${Math.round((v / sum) * 100)}%</span></span>
  </div>`).join('');
}
function balances() {
  const bal = Object.fromEntries(settings.accounts.map((a) => [a.id, Number(a.opening) || 0]));
  for (const t of txs) {
    if (t.type === 'income') bal[t.account] = (bal[t.account] ?? 0) + t.amount;
    else if (t.type === 'expense') bal[t.account] = (bal[t.account] ?? 0) - t.amount;
    else { bal[t.account] = (bal[t.account] ?? 0) - t.amount; bal[t.toAccount] = (bal[t.toAccount] ?? 0) + t.amount; }
  }
  return bal;
}
function renderReport() {
  const mode = $('#reportMode').value;
  $('#reportMonthWrap').hidden = mode !== 'month';
  $('#reportYearWrap').hidden = mode !== 'year';
  const prefix = mode === 'month' ? $('#reportMonth').value : String($('#reportYear').value);
  const list = txs.filter((t) => t.date.startsWith(prefix));
  const s = totals(list);
  $('#sumIncome').textContent = yen(s.income);
  $('#sumExpense').textContent = yen(s.expense);
  $('#sumNet').textContent = yen(s.net);
  $('#sumNet').className = 'num ' + (s.net >= 0 ? 'inc' : 'exp');
  const byCat = { income: {}, expense: {} };
  for (const t of list) if (t.type !== 'transfer') byCat[t.type][t.category] = (byCat[t.type][t.category] ?? 0) + t.amount;
  $('#byCatExpense').innerHTML = barsHTML(byCat.expense, 'exp');
  $('#byCatIncome').innerHTML = barsHTML(byCat.income, 'inc');
  const byMenu = {};
  for (const t of list) for (const l of t.items || []) {
    const m = (byMenu[l.name] ??= { qty: 0, amount: 0 });
    m.qty += l.qty;
    m.amount += l.qty * l.price;
  }
  const menuRows = Object.entries(byMenu).sort((a, b) => b[1].amount - a[1].amount);
  $('#byMenu').innerHTML = menuRows.length
    ? `<table><thead><tr><th>メニュー</th><th>個数</th><th>売上</th></tr></thead><tbody>${menuRows.map(([k, v]) =>
      `<tr><td>${esc(k)}</td><td>${v.qty.toLocaleString('ja-JP')}</td><td>${yen(v.amount)}</td></tr>`).join('')}</tbody></table>`
    : '<div class="empty">レジの売上はありません</div>';

  const showMonthly = mode === 'year';
  $('#monthlyTitle').hidden = $('#monthly').hidden = !showMonthly;
  if (showMonthly) {
    let rows = '';
    for (let m = 1; m <= 12; m++) {
      const ms = totals(list.filter((t) => t.date.startsWith(`${prefix}-${pad(m)}`)));
      rows += `<tr><td>${m}月</td><td class="inc">${yen(ms.income)}</td><td class="exp">${yen(ms.expense)}</td><td>${yen(ms.net)}</td></tr>`;
    }
    $('#monthly').innerHTML = `<table><thead><tr><th>月</th><th>収入</th><th>支出</th><th>収支</th></tr></thead><tbody>${rows}</tbody>
      <tfoot><tr><th>合計</th><th class="inc">${yen(s.income)}</th><th class="exp">${yen(s.expense)}</th><th>${yen(s.net)}</th></tr></tfoot></table>`;
  }

  const bal = balances();
  const accs = accounts();
  const total = accs.reduce((sum, a) => sum + (bal[a.id] ?? 0), 0);
  $('#balances').innerHTML = `<table><tbody>${accs.map((a) => `<tr><td>${esc(a.name)}</td><td>${yen(bal[a.id] ?? 0)}</td></tr>`).join('')}</tbody>
    <tfoot><tr><th>合計</th><th>${yen(total)}</th></tr></tfoot></table>`;
}

function renderSettings() {
  const bal = balances();
  $('#accountList').innerHTML = accounts().map((a) => `<div class="acc-row">
      <span>${esc(a.name)} <span class="muted">期首 ${yen(a.opening || 0)} / 残高 ${yen(bal[a.id] ?? 0)}</span></span>
      <button data-acc-edit="${esc(a.id)}">期首残高</button>
      <button data-acc-del="${esc(a.id)}">削除</button>
    </div>`).join('') || '<div class="empty">口座がありません</div>';
  for (const kind of ['expense', 'income']) {
    $('#cat' + (kind === 'expense' ? 'Expense' : 'Income')).innerHTML = categories(kind)
      .map((c) => `<span class="chip">${esc(c)}<button data-cat-del="${kind}" data-name="${esc(c)}" aria-label="${esc(c)}を削除">×</button></span>`).join('');
  }
  $('#lastBackup').textContent = local.lastBackup
    ? '最終バックアップ: ' + new Date(local.lastBackup).toLocaleString('ja-JP')
    : 'まだバックアップしていません';
  const cid = $('#clientIdForm').clientId;
  if (document.activeElement !== cid) cid.value = local.clientId || '';
  $('#syncSetup').open = !local.clientId;
  renderStorageInfo();
}
async function renderStorageInfo() {
  if (!navigator.storage?.estimate) return;
  const [est, persisted] = await Promise.all([navigator.storage.estimate(), navigator.storage.persisted?.()]);
  $('#storageInfo').textContent = `取引 ${txs.length}件、使用量 約${Math.ceil((est.usage || 0) / 1024)}KB、` +
    (persisted ? '永続保存: 有効（ブラウザに自動削除されません）' : '永続保存: 未許可');
}

function render() {
  const active = $('.tab.active').id.slice(4);
  if (active === 'pos') renderPos();
  if (active === 'entry') renderRecent();
  if (active === 'list') renderList();
  if (active === 'report') renderReport();
  if (active === 'plan') renderPlan();
  if (active === 'settings') renderSettings();
  renderSync();
}
['#listMonth', '#listType', '#listQuery', '#reportMode', '#reportMonth', '#reportYear'].forEach((s) =>
  $(s).addEventListener('input', render));

// ---------- レジ ----------
const cart = new Map(); // menuId -> 個数
let ticketEdited = false; // 整理券番号を手で変えたか

const isOrder = (t) => t.pos && t.date === today();
const todayOrders = () => txs.filter(isOrder).sort((a, b) => b.createdAt - a.createdAt);
// 整理券番号：この端末で今日出した番号の続き（2台で会計しても重ならないよう、端末ごとに始まり番号を決められる）
function nextTicket() {
  const start = Number(local.ticketStart) || 1;
  const nums = todayOrders().filter((o) => o.device === local.deviceId).map((o) => o.ticket).filter(Number.isFinite);
  return nums.length ? Math.max(...nums) + 1 : start;
}
function posAccountId() {
  const accs = accounts();
  return accs.find((a) => a.id === local.posAccount)?.id ?? accs.find((a) => a.id === 'cash')?.id ?? accs[0]?.id;
}
function cartLines() {
  const byId = new Map(settings.menu.map((m) => [m.id, m]));
  return [...cart].filter(([id, q]) => q > 0 && byId.has(id)).map(([id, qty]) => {
    const m = byId.get(id);
    return { menuId: id, name: m.name, price: Number(m.price) || 0, qty };
  });
}
const cartTotal = () => cartLines().reduce((s, l) => s + l.price * l.qty, 0);

function renderPos() {
  renderMenuGrid();
  renderCart();
  renderOrders();
  renderMenuEdit();
  if (!ticketEdited && document.activeElement !== $('#ticketNo')) $('#ticketNo').value = nextTicket();
}
function renderMenuGrid() {
  const items = menuItems();
  $('#menuGrid').innerHTML = items.length
    ? items.map((m) => {
      const q = cart.get(m.id);
      return `<button type="button" class="menu-btn" data-menu="${esc(m.id)}" ${m.soldOut ? 'disabled' : ''}>
        <span class="mname">${esc(m.name)}</span>
        <span class="mprice">${m.soldOut ? '売り切れ' : yen(m.price)}</span>
        ${q ? `<span class="mcount">${q}</span>` : ''}
      </button>`;
    }).join('')
    : '<div class="empty">メニューがまだありません。上の「メニューの追加・値段の設定」から登録してください。</div>';
  if (!items.length) $('#menuEdit').open = true;
}
function renderCart() {
  const lines = cartLines();
  $('#cartLines').innerHTML = lines.length
    ? lines.map((l) => `<div class="cart-line" data-line="${esc(l.menuId)}">
        <div><div class="lname">${esc(l.name)}</div><div class="lunit">${yen(l.price)} × ${l.qty}</div></div>
        <div class="lsub">${yen(l.price * l.qty)}</div>
        <div class="stepper">
          <button type="button" data-dec aria-label="減らす">−</button>
          <input type="number" class="qty" min="0" step="1" inputmode="numeric" value="${l.qty}" aria-label="${esc(l.name)}の個数">
          <button type="button" data-inc aria-label="増やす">＋</button>
          <button type="button" class="rm" data-rm>削除</button>
        </div>
      </div>`).join('')
    : '<div class="empty">メニューをタップして追加</div>';
  updateTotals();
}
function updateTotals() {
  const total = cartTotal();
  $('#cartTotal').textContent = yen(total);
  const paidRaw = $('#paid').value;
  const paid = Number(paidRaw);
  const el = $('#change');
  if (paidRaw === '' || !total) { el.textContent = '—'; el.className = 'num'; }
  else if (paid < total) { el.textContent = `${yen(total - paid)} 足りません`; el.className = 'num exp'; }
  else { el.textContent = yen(paid - total); el.className = 'num inc'; }
  $('#checkout').disabled = !total;
}
function renderOrders() {
  const all = todayOrders();
  const hide = $('#hideServed').checked;
  const list = hide ? all.filter((o) => !o.served) : all;
  const waiting = all.filter((o) => !o.served).length;
  $('#todayStats').innerHTML = all.length
    ? `<span><b>${all.length}</b>件</span><span><b>${yen(all.reduce((s, o) => s + o.amount, 0))}</b></span><span>お渡し待ち <b>${waiting}</b>件</span>` : '';
  $('#orders').innerHTML = list.length
    ? `<div class="card">${list.map((o) => `<div class="order ${o.served ? 'served' : ''}">
        <div class="ticket ${o.ticket ? '' : 'none'}">${o.ticket ?? '番号なし'}</div>
        <div class="oitems">${esc((o.items || []).map((l) => `${l.name}×${l.qty}`).join('、'))}
          <div class="meta"><span>${new Date(o.createdAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</span><span class="num">${yen(o.amount)}</span></div></div>
        <div class="oacts">
          <button type="button" data-serve="${esc(o.id)}" class="${o.served ? '' : 'primary'}">${o.served ? '戻す' : 'お渡し'}</button>
          <button type="button" data-act="del" data-id="${esc(o.id)}">取消</button>
        </div>
      </div>`).join('')}</div>`
    : `<div class="empty">${all.length ? 'お渡し待ちの注文はありません' : '今日の注文はまだありません'}</div>`;
}
function renderMenuEdit() {
  // 入力中に書き換えないようにする
  if ($('#menuList').contains(document.activeElement)) return;
  $('#menuList').innerHTML = menuItems().map((m) => `<div class="menu-row" data-mid="${esc(m.id)}">
      <input type="text" class="m-name" value="${esc(m.name)}" maxlength="40" aria-label="メニュー名">
      <input type="number" class="m-price" value="${Number(m.price) || 0}" min="0" step="1" inputmode="numeric" aria-label="値段">
      <label class="inline"><input type="checkbox" class="m-sold" ${m.soldOut ? 'checked' : ''}>売切</label>
      <button type="button" class="del" data-mdel>削除</button>
    </div>`).join('');
  const accs = accounts().map((a) => ({ value: a.id, label: a.name }));
  fillSelect($('#posAccount'), accs, posAccountId());
  if (document.activeElement !== $('#ticketStart')) $('#ticketStart').value = Number(local.ticketStart) || 1;
}

// メニューをタップ → 1個追加
$('#menuGrid').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-menu]');
  if (!b) return;
  cart.set(b.dataset.menu, (cart.get(b.dataset.menu) || 0) + 1);
  navigator.vibrate?.(10);
  $('#lastOrder').hidden = true;
  renderMenuGrid();
  renderCart();
});
// ＋／−／削除
$('#cartLines').addEventListener('click', (e) => {
  const line = e.target.closest('[data-line]');
  if (!line) return;
  const id = line.dataset.line;
  const q = cart.get(id) || 0;
  if (e.target.closest('[data-inc]')) cart.set(id, q + 1);
  else if (e.target.closest('[data-dec]')) { if (q <= 1) cart.delete(id); else cart.set(id, q - 1); }
  else if (e.target.closest('[data-rm]')) cart.delete(id);
  else return;
  renderMenuGrid();
  renderCart();
});
// 個数を直接入力（入力中は書き換えず、確定したら反映）
$('#cartLines').addEventListener('input', (e) => {
  if (!e.target.classList.contains('qty')) return;
  const id = e.target.closest('[data-line]').dataset.line;
  const v = Math.floor(Number(e.target.value));
  if (e.target.value !== '' && v >= 0) {
    cart.set(id, v);
    const l = cartLines().find((x) => x.menuId === id);
    if (l) {
      const line = e.target.closest('[data-line]');
      line.querySelector('.lsub').textContent = yen(l.price * l.qty);
      line.querySelector('.lunit').textContent = `${yen(l.price)} × ${l.qty}`;
    }
    updateTotals();
  }
});
$('#cartLines').addEventListener('change', (e) => {
  if (!e.target.classList.contains('qty')) return;
  const id = e.target.closest('[data-line]').dataset.line;
  const v = Math.floor(Number(e.target.value));
  if (!(v > 0)) cart.delete(id); else cart.set(id, v);
  renderMenuGrid();
  renderCart();
});
$('#paid').addEventListener('input', updateTotals);
$('#paidQuick').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-paid]');
  if (!b) return;
  $('#paid').value = b.dataset.paid === 'exact' ? cartTotal() : b.dataset.paid;
  updateTotals();
});
$('#ticketNo').addEventListener('input', () => { ticketEdited = true; });
$('#hideServed').addEventListener('change', renderOrders);
$('#clearCart').addEventListener('click', () => {
  cart.clear();
  $('#paid').value = '';
  renderMenuGrid();
  renderCart();
});

// 会計 → 売上として保存
$('#checkout').addEventListener('click', async () => {
  const lines = cartLines();
  if (!lines.length) return toast('メニューを選んでください');
  const total = cartTotal();
  const paidRaw = $('#paid').value;
  const paid = Number(paidRaw);
  if (paidRaw !== '' && paid < total) return toast('お預かりが足りません');
  const account = posAccountId();
  if (!account) return toast('先に設定で口座を追加してください');
  const tRaw = $('#ticketNo').value.trim();
  const ticket = tRaw === '' ? null : Math.floor(Number(tRaw));
  if (tRaw !== '' && !(ticket > 0)) return toast('整理券番号は1以上の数字にしてください');
  if (ticket && todayOrders().some((o) => o.ticket === ticket && !o.served) &&
      !(await ask({ message: `整理券 ${ticket} 番は、まだお渡ししていない注文で使われています。このまま追加しますか？`, ok: 'このまま追加' }))) return;
  const now = Date.now();
  const t = {
    id: uid(),
    type: 'income',
    date: today(),
    amount: total,
    category: '売上',
    account,
    toAccount: '',
    memo: (ticket ? `#${ticket} ` : '') + lines.map((l) => `${l.name}×${l.qty}`).join('、'),
    pos: true,
    device: local.deviceId,
    items: lines,
    ticket,
    served: false,
    createdAt: now,
    updatedAt: now,
  };
  try {
    await writeTx(t);
  } catch (err) {
    return toast('保存に失敗しました: ' + err.message);
  }
  const change = paidRaw === '' ? null : paid - total;
  // 整理券の形で、お客さんに伝える番号を大きく出す
  $('#lastOrder').innerHTML = `<div class="ticket-stub" role="status" aria-label="${ticket ? `整理券 ${ticket} 番` : '整理券なし'}">
    <div class="stub-top">
      <div class="stub-label">整理券</div>
      <div class="stub-no big-ticket ${ticket ? '' : 'none'}">${ticket ?? '番号なし'}</div>
    </div>
    <div class="stub-bottom">
      <div class="stub-items">${esc(lines.map((l) => `${l.name}×${l.qty}`).join('、'))}</div>
      <div class="stub-sum"><span>合計<b>${yen(total)}</b></span>${change != null ? `<span>おつり<b>${yen(change)}</b></span>` : ''}</div>
    </div>
  </div>`;
  $('#lastOrder').hidden = false;
  cart.clear();
  $('#paid').value = '';
  ticketEdited = false;
  $('#ticketNo').value = nextTicket();
  render();
  $('#lastOrder').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});
// お渡し済みの切り替え
$('#orders').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-serve]');
  if (!b) return;
  const o = txs.find((x) => x.id === b.dataset.serve);
  if (!o) return;
  await writeTx({ ...o, served: !o.served, updatedAt: Date.now() });
  render();
});

// メニューの追加・編集
$('#menuForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const name = f.name.value.trim();
  const price = Math.round(Number(f.price.value));
  if (!name) return;
  if (!(price >= 0)) return toast('値段を入力してください');
  if (menuItems().some((m) => m.name === name)) return toast('同じ名前のメニューがあります');
  const now = Date.now();
  settings.menu.push({ id: uid(), name, price, soldOut: false, createdAt: now, updatedAt: now });
  // 保存を待つ間に次の入力が始まっても消えないよう、先に入力欄を空にする
  f.reset();
  f.name.focus();
  await saveSettings();
  changed();
  renderPos();
});
$('#menuList').addEventListener('change', async (e) => {
  const row = e.target.closest('[data-mid]');
  if (!row) return;
  const m = settings.menu.find((x) => x.id === row.dataset.mid);
  if (!m) return;
  if (e.target.classList.contains('m-name')) {
    const v = e.target.value.trim();
    if (!v) { e.target.value = m.name; return toast('メニュー名を入力してください'); }
    m.name = v;
  } else if (e.target.classList.contains('m-price')) {
    const v = Math.round(Number(e.target.value));
    if (e.target.value === '' || !(v >= 0)) { e.target.value = m.price; return toast('値段を入力してください'); }
    m.price = v;
  } else if (e.target.classList.contains('m-sold')) {
    m.soldOut = e.target.checked;
    if (m.soldOut) cart.delete(m.id);
  } else return;
  m.updatedAt = Date.now();
  await saveSettings();
  changed();
  renderMenuGrid();
  renderCart();
});
$('#menuList').addEventListener('click', async (e) => {
  if (!e.target.closest('[data-mdel]')) return;
  const row = e.target.closest('[data-mid]');
  const m = settings.menu.find((x) => x.id === row.dataset.mid);
  if (!m || !(await ask({ message: `「${m.name}」をメニューから削除しますか？これまでの売上の記録は残ります。`, ok: '削除する', danger: true }))) return;
  Object.assign(m, { deleted: true, updatedAt: Date.now() });
  cart.delete(m.id);
  await saveSettings();
  changed();
  row.remove();
  renderPos();
});
$('#posAccount').addEventListener('change', async (e) => {
  local.posAccount = e.target.value;
  await saveLocal();
});
$('#ticketStart').addEventListener('change', async (e) => {
  const v = Math.floor(Number(e.target.value));
  if (!(v >= 1)) { e.target.value = Number(local.ticketStart) || 1; return toast('1以上の数字にしてください'); }
  local.ticketStart = v;
  await saveLocal();
  ticketEdited = false;
  renderPos();
});

// ---------- 計画（原価率・予定と実績・打ち上げ目標） ----------
const eventRange = () => {
  const ev = settings.event;
  const start = ev.start || today();
  const end = ev.end && ev.end >= start ? ev.end : start;
  return { start, end };
};
// イベント期間中のレジの注文
function eventOrders() {
  const { start, end } = eventRange();
  return txs.filter((t) => t.pos && t.date >= start && t.date <= end);
}
const unitCost = (m) => Number(m?.cost) || 0;
const margin = (m) => (Number(m.price) || 0) - unitCost(m);
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null);
const fixedCostTotal = () => settings.costs.filter((c) => !c.deleted).reduce((s, c) => s + (Number(c.amount) || 0), 0);
const goalAmount = () => (Number(settings.event.partyPeople) || 0) * (Number(settings.event.partyPerPerson) || 0);

function planNumbers() {
  const menu = menuItems();
  const byId = new Map(settings.menu.map((m) => [m.id, m]));
  const sold = {}; // menuId -> { qty, revenue }
  const daily = {}; // date -> menuId -> qty
  let actualRevenue = 0, actualCost = 0;
  for (const o of eventOrders()) {
    for (const l of o.items || []) {
      const s = (sold[l.menuId] ??= { qty: 0, revenue: 0 });
      s.qty += l.qty;
      s.revenue += l.qty * l.price;
      actualRevenue += l.qty * l.price;
      actualCost += l.qty * unitCost(byId.get(l.menuId));
      ((daily[o.date] ??= {})[l.menuId] = (daily[o.date]?.[l.menuId] || 0) + l.qty);
    }
  }
  let planRevenue = 0, planCost = 0;
  for (const m of menu) {
    const q = Number(m.planQty) || 0;
    planRevenue += q * (Number(m.price) || 0);
    planCost += q * unitCost(m);
  }
  const fixed = fixedCostTotal();
  return {
    menu, sold, daily, fixed,
    plan: { revenue: planRevenue, cost: planCost, profit: planRevenue - planCost - fixed },
    actual: { revenue: actualRevenue, cost: actualCost, profit: actualRevenue - actualCost - fixed },
  };
}

function setIfIdle(el, v) {
  if (document.activeElement !== el) el.value = v ?? '';
}
function renderPlan() {
  const ev = settings.event;
  setIfIdle($('#evName'), ev.name);
  setIfIdle($('#evStart'), ev.start || today());
  setIfIdle($('#evEnd'), ev.end || ev.start || today());
  setIfIdle($('#partyPeople'), ev.partyPeople);
  setIfIdle($('#partyPer'), ev.partyPerPerson);
  const n = planNumbers();
  renderGoal(n);
  renderPlanMenus(n);
  renderCosts();
  renderPlanSummary(n);
  renderPlanDaily(n);
}

function renderGoal(n) {
  const goal = goalAmount();
  const profit = n.actual.profit;
  const need = goal - profit;
  let html = `<div class="goal-head"><span>今の利益 <span class="big ${profit >= 0 ? 'inc' : 'exp'}">${yen(profit)}</span></span>
    <span class="muted">目標 ${yen(goal)}</span></div>`;
  if (goal > 0) html += `<div class="progress"><i style="width:${Math.max(0, Math.min(100, (profit / goal) * 100))}%"></i></div>`;
  if (goal <= 0) {
    html += '<p class="muted small">人数と1人あたりの金額を入れると、目標までの残りが出ます。</p>';
  } else if (need <= 0) {
    html += `<p class="goal-msg inc">目標達成！ 打ち上げできます（目標より ${yen(-need)} 多い）</p>`;
  } else {
    html += `<p class="goal-msg">目標まであと ${yen(need)}</p>`;
    const items = n.menu.filter((m) => margin(m) > 0 && !m.soldOut);
    if (items.length) {
      html += `<div class="muted small">1種類だけで売るなら、あと何個？</div><div class="chips need">${items
        .map((m) => `<span class="chip">${esc(m.name)} あと<b>${Math.ceil(need / margin(m)).toLocaleString('ja-JP')}</b>個</span>`).join('')}</div>`;
    } else if (n.menu.length) {
      html += '<p class="muted small">原価を入れると、あと何個売ればいいかが出ます。</p>';
    }
  }
  if (goal > 0 && n.menu.some((m) => Number(m.planQty) > 0)) {
    const diff = n.plan.profit - goal;
    html += `<p class="small" style="margin-top:10px">予定どおり全部売れたら利益 <b>${yen(n.plan.profit)}</b>
      。${diff >= 0 ? `<span class="inc">目標に届きます（${yen(diff)} 余る）</span>` : `<span class="exp">目標に ${yen(-diff)} 足りません</span>`}</p>`;
  }
  $('#goalView').innerHTML = html;
}

function planItemStats(m, n) {
  const price = Number(m.price) || 0;
  const cost = unitCost(m);
  const rate = pct(cost, price);
  const planQty = Number(m.planQty) || 0;
  const s = n.sold[m.id] || { qty: 0 };
  const achieve = pct(s.qty, planQty);
  const highRate = rate != null && rate >= 50;
  return `<div class="row2">
      <span>原価率 <b class="${highRate ? 'warn-text' : ''}">${cost ? `${rate}%` : '—'}</b></span>
      <span>1個の利益 <b>${cost ? yen(price - cost) : '—'}</b></span>
      ${planQty ? `<span>予定どおりなら利益 ${cost ? yen((price - cost) * planQty) : '—'}</span>` : ''}
    </div>
    ${highRate ? '<div class="small warn-text">原価率が50%以上です。値段か原価を見直す余地があるかもしれません。</div>' : ''}
    <div class="row2" style="margin-top:6px">
      <span>売れた <b>${s.qty.toLocaleString('ja-JP')}</b>${planQty ? ` / 予定 ${planQty.toLocaleString('ja-JP')}個` : '個'}</span>
      ${planQty ? `<span>${achieve}%</span><span>${s.qty >= planQty ? `<span class="inc">予定数を達成${s.qty > planQty ? `（+${s.qty - planQty}）` : ''}</span>` : `残り ${(planQty - s.qty).toLocaleString('ja-JP')}個`}</span>` : ''}
    </div>
    ${planQty ? `<div class="progress small"><i style="width:${Math.min(100, achieve)}%"></i></div>` : ''}`;
}
function renderPlanMenus(n) {
  const box = $('#planMenus');
  const ids = n.menu.map((m) => m.id).join(',');
  // 入力中は作り直さず、数字の表示だけ更新する
  if (box.dataset.ids === ids && box.contains(document.activeElement)) {
    for (const m of n.menu) {
      const el = box.querySelector(`[data-pid="${CSS.escape(m.id)}"] .pi-stats`);
      if (el) el.innerHTML = planItemStats(m, n);
    }
    return;
  }
  box.dataset.ids = ids;
  box.innerHTML = n.menu.length
    ? n.menu.map((m) => `<div class="card plan-item" data-pid="${esc(m.id)}">
        <div class="pi-head"><b>${esc(m.name)}</b><span class="num">${yen(m.price)}</span></div>
        <div class="pi-inputs">
          <label>原価（1個あたり・円）<input type="number" class="p-cost" min="0" step="1" inputmode="decimal" value="${m.cost ?? ''}" placeholder="例：120"></label>
          <label>予定の個数<input type="number" class="p-qty" min="0" step="1" inputmode="numeric" value="${m.planQty ?? ''}" placeholder="例：300"></label>
        </div>
        <button type="button" class="link p-calc">材料費の合計から原価を計算</button>
        <div class="pi-stats">${planItemStats(m, n)}</div>
      </div>`).join('')
    : '<div class="card empty">メニューがまだありません。レジ画面の「メニューの追加・値段の設定」から追加してください。</div>';
}
function renderCosts() {
  const list = settings.costs.filter((c) => !c.deleted);
  $('#costList').innerHTML = list.map((c) => `<div class="cost-row" data-cid="${esc(c.id)}">
      <span>${esc(c.name)}</span><span class="num">${yen(c.amount)}</span><button type="button" data-cdel>削除</button>
    </div>`).join('') + (list.length ? `<div class="cost-row"><b>合計</b><b class="num">${yen(fixedCostTotal())}</b><span></span></div>` : '');
}
function renderPlanSummary(n) {
  const row = (label, a, b, cls = '') => `<tr><td>${label}</td><td class="${cls}">${a}</td><td class="${cls}">${b}</td></tr>`;
  const rate = (x) => (x.revenue ? `${pct(x.cost, x.revenue)}%` : '—');
  $('#planSummary').innerHTML = `<table><thead><tr><th></th><th>予定</th><th>実績</th></tr></thead><tbody>
    ${row('売上', yen(n.plan.revenue), yen(n.actual.revenue), 'inc')}
    ${row('材料の原価', yen(n.plan.cost), yen(n.actual.cost), 'exp')}
    ${row('その他の費用', yen(n.fixed), yen(n.fixed), 'exp')}
    ${row('<b>利益</b>', `<b>${yen(n.plan.profit)}</b>`, `<b>${yen(n.actual.profit)}</b>`)}
    ${row('原価率（全体）', rate(n.plan), rate(n.actual))}
  </tbody></table>
  <p class="muted small">実績の原価は「売れた個数 × 今設定している1個あたりの原価」で計算しています。</p>`;
}
function renderPlanDaily(n) {
  const { start, end } = eventRange();
  const days = [];
  for (let d = new Date(start + 'T00:00:00'); days.length < 14; d.setDate(d.getDate() + 1)) {
    const s = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if (s > end) break;
    days.push(s);
  }
  if (!n.menu.length) { $('#planDaily').innerHTML = '<div class="empty">メニューがありません</div>'; return; }
  const head = days.map((d) => { const x = new Date(d + 'T00:00:00'); return `<th>${x.getMonth() + 1}/${x.getDate()}(${'日月火水木金土'[x.getDay()]})</th>`; }).join('');
  const body = n.menu.map((m) => `<tr><td>${esc(m.name)}</td>${days.map((d) => `<td>${(n.daily[d]?.[m.id] || 0).toLocaleString('ja-JP')}</td>`).join('')}<td><b>${(n.sold[m.id]?.qty || 0).toLocaleString('ja-JP')}</b></td></tr>`).join('');
  const revenue = days.map((d) => {
    const sum = eventOrders().filter((o) => o.date === d).reduce((s, o) => s + o.amount, 0);
    return `<td>${yen(sum)}</td>`;
  }).join('');
  $('#planDaily').innerHTML = `<div class="scroll-x"><table><thead><tr><th>メニュー</th>${head}<th>合計</th></tr></thead><tbody>${body}</tbody>
    <tfoot><tr><th>売上</th>${revenue}<th>${yen(n.actual.revenue)}</th></tr></tfoot></table></div>`;
}

// --- 計画の入力 ---
async function saveEvent(patch) {
  Object.assign(settings.event, patch, { updatedAt: Date.now() });
  await saveSettings();
  changed();
  renderPlan();
}
$('#evName').addEventListener('change', (e) => saveEvent({ name: e.target.value.trim() }));
$('#evStart').addEventListener('change', (e) => {
  const start = e.target.value || today();
  const end = settings.event.end && settings.event.end >= start ? settings.event.end : start;
  $('#evEnd').value = end;
  saveEvent({ start, end });
});
$('#evEnd').addEventListener('change', (e) => {
  const start = settings.event.start || today();
  let end = e.target.value || start;
  if (end < start) { end = start; e.target.value = end; toast('最終日は初日より後にしてください'); }
  saveEvent({ start, end });
});
for (const [sel, key] of [['#partyPeople', 'partyPeople'], ['#partyPer', 'partyPerPerson']]) {
  $(sel).addEventListener('input', (e) => {
    const v = Math.max(0, Math.round(Number(e.target.value) || 0));
    settings.event[key] = v;
    renderGoal(planNumbers());
  });
  $(sel).addEventListener('change', (e) => saveEvent({ [key]: Math.max(0, Math.round(Number(e.target.value) || 0)) }));
}
async function updateMenu(id, patch) {
  const m = settings.menu.find((x) => x.id === id);
  if (!m) return;
  Object.assign(m, patch, { updatedAt: Date.now() });
  await saveSettings();
  changed();
}
$('#planMenus').addEventListener('input', (e) => {
  const card = e.target.closest('[data-pid]');
  if (!card) return;
  const m = settings.menu.find((x) => x.id === card.dataset.pid);
  if (!m) return;
  const raw = e.target.value;
  const v = raw === '' ? null : Number(raw);
  if (raw !== '' && !(v >= 0)) return;
  // 入力しながら数字を更新（保存は確定時）
  if (e.target.classList.contains('p-cost')) m.cost = v == null ? null : Math.round(v * 100) / 100;
  if (e.target.classList.contains('p-qty')) m.planQty = v == null ? null : Math.round(v);
  const n = planNumbers();
  card.querySelector('.pi-stats').innerHTML = planItemStats(m, n);
  renderGoal(n);
  renderPlanSummary(n);
});
$('#planMenus').addEventListener('change', (e) => {
  const card = e.target.closest('[data-pid]');
  if (!card) return;
  const m = settings.menu.find((x) => x.id === card.dataset.pid);
  if (!m) return;
  if (e.target.classList.contains('p-cost')) updateMenu(m.id, { cost: m.cost });
  if (e.target.classList.contains('p-qty')) updateMenu(m.id, { planQty: m.planQty });
});
$('#planMenus').addEventListener('click', async (e) => {
  if (!e.target.closest('.p-calc')) return;
  const card = e.target.closest('[data-pid]');
  const m = settings.menu.find((x) => x.id === card.dataset.pid);
  if (!m) return;
  const res = await ask({
    message: `${m.name}の材料費から、1個あたりの原価を計算します。`,
    fields: [
      { label: '材料費の合計（円）', type: 'number', placeholder: '例：36000' },
      { label: 'その材料で作れる個数', type: 'number', placeholder: '例：300' },
    ],
    ok: '計算する',
  });
  if (!res) return;
  const [total, count] = res;
  const t = Number(total), c = Number(count);
  if (!(t >= 0) || !(c > 0)) return toast('数字を入れてください');
  const cost = Math.round((t / c) * 100) / 100;
  await updateMenu(m.id, { cost });
  card.querySelector('.p-cost').value = cost;
  toast(`1個あたりの原価：${cost.toLocaleString('ja-JP')}円`);
  renderPlan();
});
$('#costForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const name = f.name.value.trim();
  const amount = Math.round(Number(f.amount.value));
  if (!name || !(amount >= 0)) return toast('名前と金額を入れてください');
  f.reset();
  f.name.focus();
  settings.costs.push({ id: uid(), name, amount, updatedAt: Date.now() });
  await saveSettings();
  changed();
  renderPlan();
});
$('#costList').addEventListener('click', async (e) => {
  if (!e.target.closest('[data-cdel]')) return;
  const c = settings.costs.find((x) => x.id === e.target.closest('[data-cid]').dataset.cid);
  if (!c || !(await ask({ message: `「${c.name}」を削除しますか？`, ok: '削除する', danger: true }))) return;
  Object.assign(c, { deleted: true, updatedAt: Date.now() });
  await saveSettings();
  changed();
  renderPlan();
});

// ---------- 設定操作 ----------
$('#accountForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const name = f.name.value.trim();
  if (!name) return;
  settings.accounts.push({ id: uid(), name, opening: Math.round(Number(f.opening.value) || 0), updatedAt: Date.now() });
  f.reset();
  await saveSettings();
  changed();
  refreshFormOptions();
  render();
});
$('#catForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const kind = f.kind.value;
  const name = f.name.value.trim();
  if (!name) return;
  if (categories(kind).includes(name)) return toast('同じ科目があります');
  const id = `${kind}:${name}`;
  settings.categories = settings.categories.filter((c) => c.id !== id);
  settings.categories.push({ id, kind, name, updatedAt: Date.now() });
  await saveSettings();
  f.name.value = '';
  changed();
  refreshFormOptions();
  render();
});
$('#tab-settings').addEventListener('click', async (e) => {
  const t = e.target;
  const now = Date.now();
  if (t.dataset.accDel) {
    const id = t.dataset.accDel;
    const used = txs.some((x) => x.account === id || x.toAccount === id);
    if (used) return toast('取引で使われている口座は削除できません');
    if (!(await ask({ message: `「${accName(id)}」を削除しますか？`, ok: '削除する', danger: true }))) return;
    const a = settings.accounts.find((x) => x.id === id);
    Object.assign(a, { deleted: true, updatedAt: now });
  } else if (t.dataset.accEdit) {
    const a = settings.accounts.find((x) => x.id === t.dataset.accEdit);
    const res = await ask({ message: `${a.name}の期首残高を変更します。`, fields: [{ label: '期首残高（円）', type: 'number', value: a.opening || 0 }], ok: '保存' });
    if (!res) return;
    const v = res[0];
    if (v.trim() === '' || !Number.isFinite(Number(v))) return toast('数値を入力してください');
    Object.assign(a, { opening: Math.round(Number(v)), updatedAt: now });
  } else if (t.dataset.catDel) {
    const c = settings.categories.find((x) => x.id === `${t.dataset.catDel}:${t.dataset.name}`);
    if (!c) return;
    Object.assign(c, { deleted: true, updatedAt: now });
  } else return;
  await saveSettings();
  changed();
  refreshFormOptions();
  render();
});

// ---------- バックアップ / 復元 / 合体 ----------
function exportData() {
  return { app: 'offline-kaikei', version: 2, exportedAt: new Date().toISOString(), settings, transactions: allTx };
}
function download(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('#exportJson').addEventListener('click', async () => {
  local.lastBackup = Date.now();
  await saveLocal();
  download(`kaikei-backup-${today()}.json`, JSON.stringify(exportData(), null, 2), 'application/json');
  render();
});
$('#exportCsv').addEventListener('click', () => {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['日付', '種類', '科目', '口座', '振替先', '金額', '摘要']];
  for (const t of [...txs].reverse()) {
    rows.push([t.date, TYPE_LABEL[t.type], t.category, accName(t.account), t.toAccount ? accName(t.toAccount) : '', t.amount, t.memo]);
  }
  // BOM付きUTF-8（Excelで文字化けしないように）
  download(`kaikei-${today()}.csv`, '﻿' + rows.map((r) => r.map(q).join(',')).join('\r\n'), 'text/csv');
});
async function readJsonFile(input) {
  const file = input.files[0];
  input.value = '';
  if (!file) return null;
  try {
    return parseData(JSON.parse(await file.text()));
  } catch (err) {
    toast('読み込めませんでした: ' + err.message);
    return null;
  }
}
// 他のデータを取り込んで合体する（同じIDは新しい方を採用）。変わった件数を返す
async function mergeIn(data) {
  const byId = new Map(allTx.map((x) => [x.id, x]));
  const incoming = data.transactions.filter((y) => !byId.has(y.id) || newer(y, byId.get(y.id)));
  const nextSettings = {
    accounts: mergeRecords(settings.accounts, data.settings.accounts),
    categories: mergeRecords(settings.categories, data.settings.categories),
    menu: mergeRecords(settings.menu, data.settings.menu),
    costs: mergeRecords(settings.costs, data.settings.costs),
    event: newer(data.settings.event, settings.event) ? data.settings.event : settings.event,
  };
  const settingsChanged = JSON.stringify(nextSettings) !== JSON.stringify(settings);
  if (!incoming.length && !settingsChanged) return 0;
  const t = db.transaction(['tx', 'meta'], 'readwrite');
  for (const y of incoming) t.objectStore('tx').put(y);
  t.objectStore('meta').put(nextSettings, 'settings');
  await txDone(t);
  settings = nextSettings;
  for (const y of incoming) byId.set(y.id, y);
  allTx = [...byId.values()];
  refreshVisible();
  refreshFormOptions();
  render();
  return incoming.length + (settingsChanged ? 1 : 0);
}
$('#mergeJson').addEventListener('change', async (e) => {
  const data = await readJsonFile(e.target);
  if (!data) return;
  const n = await mergeIn(data);
  if (n) changed();
  toast(n ? '合体しました' : '新しいデータはありませんでした');
});
$('#importJson').addEventListener('change', async (e) => {
  const data = await readJsonFile(e.target);
  if (!data) return;
  const count = data.transactions.filter((t) => !t.deleted).length;
  if (!(await ask({ message: `${count}件の取引で置き換えます。この端末の今のデータは消えます。データを残したい場合は「合体して取り込む」を使ってください。`, ok: '置き換える', danger: true }))) return;
  const t = db.transaction(['tx', 'meta'], 'readwrite');
  const txStore = t.objectStore('tx');
  txStore.clear();
  for (const x of data.transactions) txStore.put(x);
  t.objectStore('meta').put(data.settings, 'settings');
  await txDone(t);
  await reload();
  toast('復元しました');
});
$('#wipe').addEventListener('click', async () => {
  const res = await ask({
    message: 'この端末のすべての取引と設定を削除します。元に戻せません。先にバックアップを取ってください。',
    fields: [{ label: '確認のため「削除」と入力', type: 'text' }],
    ok: 'すべて削除', danger: true,
  });
  if (!res) return;
  if (res[0].trim() !== '削除') return toast('「削除」と入力されていないので、やめました');
  const t = db.transaction(['tx', 'meta'], 'readwrite');
  t.objectStore('tx').clear();
  t.objectStore('meta').clear();
  await txDone(t);
  accessToken = null;
  await reload();
  toast('削除しました');
});

// ---------- Googleドライブ同期 ----------
const SYNC_FILE = 'kaikei-sync.json';
const DRIVE = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UP = 'https://www.googleapis.com/upload/drive/v3/files';
let accessToken = null;
let syncing = false;
let syncError = '';
let syncTimer;

// この端末で前回の同期以降に変わったもの（未同期の変更）の数
function pendingCount() {
  const since = local.lastSync || 0;
  return allTx.filter((t) => t.updatedAt > since).length +
    settings.accounts.filter((a) => a.updatedAt > since).length +
    settings.categories.filter((c) => c.updatedAt > since).length +
    settings.menu.filter((m) => m.updatedAt > since).length +
    settings.costs.filter((c) => c.updatedAt > since).length +
    (settings.event.updatedAt > since ? 1 : 0);
}
// Googleログインは https（または開発用の localhost）でしか動かない
const syncReady = () => !!local.clientId && (location.protocol === 'https:' || location.hostname === 'localhost');

function renderSync() {
  const badge = $('#syncBadge');
  const n = pendingCount();
  if (!local.clientId) {
    badge.hidden = true;
  } else {
    badge.hidden = false;
    badge.className = 'badge ' + (syncing ? '' : syncError || n ? 'warn' : 'ok');
    badge.textContent = syncing ? '同期中…' : syncError ? '同期エラー' : n ? `未同期 ${n}` : '同期済み';
  }
  const el = $('#syncStatus');
  if (!el) return;
  let msg;
  if (!local.clientId) msg = '未設定です。下の「初回設定」を行ってください。';
  else if (!syncReady()) msg = 'この開き方では同期できません。HTTPS で公開したURLから開いてください。';
  else if (syncing) msg = '同期中…';
  else {
    msg = local.lastSync ? `最終同期: ${fmtTime(local.lastSync)}` : 'まだ同期していません。「今すぐ同期」を押してGoogleにログインしてください。';
    if (n) msg += `\n未同期の変更 ${n}件` + (navigator.onLine ? '' : '（ネットにつながると同期します）');
    if (syncError) msg += `\n${syncError}`;
  }
  el.textContent = msg;
  el.style.whiteSpace = 'pre-line';
  $('#syncNow').disabled = !syncReady() || syncing;
  $('#syncUnlink').hidden = !local.clientId;
}

function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = resolve;
    s.onerror = () => { s.remove(); reject(new Error('Googleに接続できませんでした')); };
    document.head.appendChild(s);
  });
}
function validToken() {
  if (accessToken) return accessToken;
  if (local.token && Date.now() < (local.tokenExp || 0) - 60_000) return (accessToken = local.token);
  return null;
}
// interactive=true のときだけGoogleのログイン画面を出す（ボタンを押したとき）
async function getToken(interactive) {
  const tok = validToken();
  if (tok) return tok;
  if (!interactive) throw Object.assign(new Error('ログインが必要です。「今すぐ同期」を押してください。'), { needsLogin: true });
  await loadGis();
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: local.clientId,
      scope: 'https://www.googleapis.com/auth/drive.appdata',
      callback: async (r) => {
        if (r.error) return reject(new Error('ログインできませんでした: ' + r.error));
        accessToken = r.access_token;
        local.token = r.access_token;
        local.tokenExp = Date.now() + Number(r.expires_in || 3600) * 1000;
        await saveLocal();
        resolve(accessToken);
      },
      error_callback: (err) => reject(new Error(err?.type === 'popup_closed' ? 'ログインがキャンセルされました' : 'ログインできませんでした')),
    });
    client.requestAccessToken({ prompt: local.lastSync ? '' : 'consent' });
  });
}
async function api(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { Authorization: 'Bearer ' + accessToken, ...(opts.headers || {}) } });
  if (res.status === 401) {
    accessToken = null;
    local.token = null;
    await saveLocal();
    throw Object.assign(new Error('ログインの有効期限が切れました。「今すぐ同期」を押してください。'), { needsLogin: true });
  }
  if (!res.ok && res.status !== 404) throw new Error(`Googleドライブのエラー（${res.status}）`);
  return res;
}

async function syncNow(interactive = false) {
  if (syncing || !syncReady()) return;
  if (!navigator.onLine) { renderSync(); return; }
  syncing = true;
  syncError = '';
  renderSync();
  try {
    await getToken(interactive);
    // 1) ドライブ上の同期ファイルを探す
    let fileId = local.fileId;
    if (!fileId) {
      const q = encodeURIComponent(`name='${SYNC_FILE}' and trashed=false`);
      const r = await api(`${DRIVE}?spaces=appDataFolder&q=${q}&fields=files(id)&orderBy=modifiedTime desc`);
      fileId = (await r.json()).files?.[0]?.id || null;
    }
    // 2) あれば読み込んで、この端末のデータと合体
    let pulled = 0;
    if (fileId) {
      const r = await api(`${DRIVE}/${fileId}?alt=media`);
      if (r.status === 404) fileId = null;
      else pulled = await mergeIn(parseData(await r.json()));
    }
    // 3) 合体した結果をドライブに書き戻す
    const startedAt = Date.now();
    const body = JSON.stringify(exportData());
    if (fileId) {
      await api(`${DRIVE_UP}/${fileId}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body });
    } else {
      const boundary = 'kaikei' + startedAt;
      const meta = JSON.stringify({ name: SYNC_FILE, parents: ['appDataFolder'] });
      const multipart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
        `--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;
      const r = await api(`${DRIVE_UP}?uploadType=multipart&fields=id`, {
        method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body: multipart,
      });
      fileId = (await r.json()).id;
    }
    local.fileId = fileId;
    local.lastSync = startedAt;
    await saveLocal();
    if (interactive || pulled) toast(pulled ? '同期しました（他の端末の変更を反映）' : '同期しました');
  } catch (err) {
    syncError = err.message;
    if (interactive) toast(err.message);
  } finally {
    syncing = false;
    render();
  }
}
// 変更があったら少し待ってから自動同期（ログイン済み・オンラインのときだけ）
function changed() {
  renderSync();
  if (!local.clientId) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => { if (validToken()) syncNow(false); }, 3000);
}
$('#syncNow').addEventListener('click', () => syncNow(true));
$('#syncUnlink').addEventListener('click', async () => {
  if (!(await ask({ message: 'この端末とGoogleドライブの連携を解除しますか？この端末のデータは残ります。', ok: '解除する', danger: true }))) return;
  if (accessToken && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(accessToken, () => {});
  Object.assign(local, { clientId: '', fileId: null, token: null, tokenExp: 0, lastSync: 0 });
  accessToken = null;
  syncError = '';
  await saveLocal();
  render();
});
$('#clientIdForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const v = e.target.clientId.value.trim();
  if (v && !/\.apps\.googleusercontent\.com$/.test(v)) return toast('クライアントIDの形式が違います');
  if (v !== local.clientId) Object.assign(local, { clientId: v, fileId: null, token: null, tokenExp: 0 });
  accessToken = null;
  await saveLocal();
  toast(v ? '保存しました。「今すぐ同期」を押してください' : '解除しました');
  if (v && navigator.onLine) loadGis().catch(() => {});
  render();
});

// ---------- オンライン表示 ----------
function updateNet() {
  const el = $('#netStatus');
  el.textContent = navigator.onLine ? 'オンライン' : 'オフライン（保存OK）';
  el.classList.toggle('off', !navigator.onLine);
}
addEventListener('online', () => {
  updateNet();
  if (local?.clientId) { loadGis().catch(() => {}); if (validToken()) syncNow(false); }
  renderSync();
});
addEventListener('offline', () => { updateNet(); renderSync(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && local?.clientId && validToken()) syncNow(false);
});

// ---------- 起動 ----------
async function reload() {
  const [s, l, all] = await Promise.all([reqP(store('meta').get('settings')), reqP(store('meta').get('local')), getAllTx()]);
  settings = normalizeSettings(s);
  local = l || { lastBackup: s?.lastBackup ?? null, lastSync: 0, clientId: '', fileId: null };
  if (!local.deviceId) { local.deviceId = uid(); await saveLocal(); }
  allTx = all.map(normalizeTx);
  refreshVisible();
  resetForm();
  ticketEdited = false;
  render();
}
(async function init() {
  updateNet();
  $('#listMonth').value = thisMonth();
  $('#reportMonth').value = thisMonth();
  $('#reportYear').value = new Date().getFullYear();
  form.date.value = today();
  try {
    db = await openDB();
  } catch (err) {
    document.querySelector('main').innerHTML = `<div class="card">データベースを開けませんでした（${esc(err?.message)}）。プライベートモードでは使えない場合があります。</div>`;
    return;
  }
  await reload();
  // ブラウザに自動削除されないよう永続保存を要求
  if (navigator.storage?.persist) navigator.storage.persist().then(() => renderStorageInfo());
  // オフライン用キャッシュ（http/https で開いたときのみ有効）
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  // 同期の準備（ログイン済みなら起動時に同期）
  if (local.clientId && navigator.onLine) {
    loadGis().catch(() => {});
    if (validToken()) syncNow(false);
  }
})();
