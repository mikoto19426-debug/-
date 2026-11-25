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
//                          menu: [{id,name,price,soldOut?,createdAt,updatedAt,deleted?}] }
// local（この端末だけ）: { lastBackup, lastSync, clientId, fileId, token, tokenExp, posAccount }
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
  return { accounts, categories, menu };
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
  if (!confirm('この取引を削除しますか？')) return;
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
  const meta = [TYPE_LABEL[t.type], t.type === 'transfer' ? '' : accName(t.account), t.memo].filter(Boolean).map(esc).join(' ・ ');
  return `<div class="tx">
    <div><div>${title}</div><div class="meta">${meta}</div></div>
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
  $('#storageInfo').textContent = `取引 ${txs.length}件 ・ 使用量 約${Math.ceil((est.usage || 0) / 1024)}KB ・ ` +
    (persisted ? '永続保存: 有効（ブラウザに自動削除されません）' : '永続保存: 未許可');
}

function render() {
  const active = $('.tab.active').id.slice(4);
  if (active === 'pos') renderPos();
  if (active === 'entry') renderRecent();
  if (active === 'list') renderList();
  if (active === 'report') renderReport();
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
function nextTicket() {
  const nums = todayOrders().map((o) => o.ticket).filter(Number.isFinite);
  return nums.length ? Math.max(...nums) + 1 : 1;
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
  $('#todayStats').textContent = all.length ? `${all.length}件 ・ ${yen(all.reduce((s, o) => s + o.amount, 0))} ・ 未お渡し ${waiting}件` : '';
  $('#orders').innerHTML = list.length
    ? `<div class="card">${list.map((o) => `<div class="order ${o.served ? 'served' : ''}">
        <div class="ticket ${o.ticket ? '' : 'none'}">${o.ticket ?? '番号なし'}</div>
        <div class="oitems">${esc((o.items || []).map((l) => `${l.name}×${l.qty}`).join('、'))}
          <div class="meta">${new Date(o.createdAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} ・ ${yen(o.amount)}</div></div>
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
      !confirm(`整理券 ${ticket} 番は、まだお渡ししていない注文で使われています。このまま追加しますか？`)) return;
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
  $('#lastOrder').innerHTML = `<div class="muted">会計しました</div>
    <div class="big-ticket">${ticket ? `整理券 ${ticket} 番` : '番号なし'}</div>
    <div>${esc(lines.map((l) => `${l.name}×${l.qty}`).join('、'))}</div>
    <div class="change">合計 ${yen(total)}${change != null ? `　おつり <span class="inc">${yen(change)}</span>` : ''}</div>`;
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
  if (!m || !confirm(`「${m.name}」をメニューから削除しますか？（これまでの売上記録は残ります）`)) return;
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
    if (!confirm('この口座を削除しますか？')) return;
    const a = settings.accounts.find((x) => x.id === id);
    Object.assign(a, { deleted: true, updatedAt: now });
  } else if (t.dataset.accEdit) {
    const a = settings.accounts.find((x) => x.id === t.dataset.accEdit);
    const v = prompt(`${a.name} の期首残高（円）`, a.opening || 0);
    if (v == null) return;
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
  if (!confirm(`${count}件の取引で置き換えます。この端末の今のデータは消えます。よろしいですか？\n（データを残したい場合は「合体して取り込む」を使ってください）`)) return;
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
  if (!confirm('この端末のすべての取引と設定を削除します。元に戻せません。先にバックアップを取りましたか？')) return;
  if (prompt('確認のため「削除」と入力してください') !== '削除') return;
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
    settings.menu.filter((m) => m.updatedAt > since).length;
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
    if (n) msg += `　・　未同期の変更 ${n}件` + (navigator.onLine ? '' : '（ネットにつながると同期します）');
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
  if (!confirm('この端末とGoogleドライブの連携を解除しますか？（この端末のデータは残ります）')) return;
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
