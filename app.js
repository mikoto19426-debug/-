'use strict';
// オフライン会計 — データはすべて端末内の IndexedDB に保存されます。

const DB_NAME = 'offline-kaikei';
const DB_VERSION = 1;
const DEFAULT_SETTINGS = {
  accounts: [
    { id: 'cash', name: '現金', opening: 0 },
    { id: 'bank', name: '普通預金', opening: 0 },
  ],
  categories: {
    expense: ['仕入', '消耗品費', '通信費', '水道光熱費', '旅費交通費', '地代家賃', '広告宣伝費', '接待交際費', '支払手数料', '食費', '雑費'],
    income: ['売上', '給与', '雑収入'],
  },
  lastBackup: null,
};

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
function store(name, mode = 'readonly') {
  return db.transaction(name, mode).objectStore(name);
}
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
const deleteTx = (id) => reqP(store('tx', 'readwrite').delete(id));
async function loadSettings() {
  const s = await reqP(store('meta').get('settings'));
  return s ? { ...structuredClone(DEFAULT_SETTINGS), ...s } : structuredClone(DEFAULT_SETTINGS);
}
const saveSettings = () => reqP(store('meta', 'readwrite').put(settings, 'settings'));

// ---------- 状態 ----------
let settings;
let txs = [];

// ---------- ユーティリティ ----------
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const yen = (n) => (n < 0 ? '-' : '') + '¥' + Math.abs(Math.round(n)).toLocaleString('ja-JP');
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const pad = (n) => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const thisMonth = () => today().slice(0, 7);
const TYPE_LABEL = { income: '収入', expense: '支出', transfer: '振替' };
const accName = (id) => settings.accounts.find((a) => a.id === id)?.name ?? '(削除済み口座)';
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}
const sortTx = (a) => a.sort((x, y) => (y.date.localeCompare(x.date)) || (y.createdAt - x.createdAt));

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
  const accs = settings.accounts.map((a) => ({ value: a.id, label: a.name }));
  fillSelect(form.account, accs, form.account.value);
  fillSelect(form.toAccount, accs, form.toAccount.value);
  if (form.toAccount.value === form.account.value) {
    const other = accs.find((a) => a.value !== form.account.value);
    if (other) form.toAccount.value = other.value;
  }
  if (!isTr) {
    const cats = settings.categories[type].map((c) => ({ value: c, label: c }));
    fillSelect(form.category, cats, form.category.value);
  }
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

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const type = form.type.value;
  const amount = Math.round(Number(form.amount.value));
  if (!(amount > 0)) return toast('金額を入力してください');
  if (!settings.accounts.length) return toast('先に設定で口座を追加してください');
  if (type === 'transfer' && form.account.value === form.toAccount.value) return toast('振替元と振替先が同じです');
  const existing = txs.find((t) => t.id === form.id.value);
  const t = {
    id: existing?.id ?? uid(),
    type,
    date: form.date.value,
    amount,
    category: type === 'transfer' ? '' : form.category.value,
    account: form.account.value,
    toAccount: type === 'transfer' ? form.toAccount.value : '',
    memo: form.memo.value.trim(),
    createdAt: existing?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
  };
  try {
    await putTx(t);
  } catch (err) {
    return toast('保存に失敗しました: ' + err.message);
  }
  if (existing) Object.assign(existing, t); else txs.push(t);
  sortTx(txs);
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
  form.account.value = t.account;
  form.toAccount.value = t.toAccount;
  form.memo.value = t.memo;
  $('#saveBtn').textContent = '更新';
  $('#cancelEdit').hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
async function removeTx(id) {
  if (!confirm('この取引を削除しますか？')) return;
  await deleteTx(id);
  txs = txs.filter((t) => t.id !== id);
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
    <div class="acts"><button data-act="edit" data-id="${t.id}">編集</button> <button data-act="del" data-id="${t.id}">削除</button></div>
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
    (!q || `${t.memo} ${t.category} ${accName(t.account)} ${accName(t.toAccount)}`.toLowerCase().includes(q)));
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
  const total = settings.accounts.reduce((sum, a) => sum + (bal[a.id] ?? 0), 0);
  $('#balances').innerHTML = `<table><tbody>${settings.accounts.map((a) => `<tr><td>${esc(a.name)}</td><td>${yen(bal[a.id] ?? 0)}</td></tr>`).join('')}</tbody>
    <tfoot><tr><th>合計</th><th>${yen(total)}</th></tr></tfoot></table>`;
}

function renderSettings() {
  const bal = balances();
  $('#accountList').innerHTML = settings.accounts.map((a) => `<div class="acc-row">
      <span>${esc(a.name)} <span class="muted">期首 ${yen(a.opening || 0)} / 残高 ${yen(bal[a.id] ?? 0)}</span></span>
      <button data-acc-edit="${a.id}">期首残高</button>
      <button data-acc-del="${a.id}">削除</button>
    </div>`).join('') || '<div class="empty">口座がありません</div>';
  for (const kind of ['expense', 'income']) {
    $('#cat' + (kind === 'expense' ? 'Expense' : 'Income')).innerHTML = settings.categories[kind]
      .map((c) => `<span class="chip">${esc(c)}<button data-cat-del="${kind}" data-name="${esc(c)}" aria-label="${esc(c)}を削除">×</button></span>`).join('');
  }
  $('#lastBackup').textContent = settings.lastBackup
    ? '最終バックアップ: ' + new Date(settings.lastBackup).toLocaleString('ja-JP')
    : 'まだバックアップしていません';
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
  if (active === 'entry') renderRecent();
  if (active === 'list') renderList();
  if (active === 'report') renderReport();
  if (active === 'settings') renderSettings();
}
['#listMonth', '#listType', '#listQuery', '#reportMode', '#reportMonth', '#reportYear'].forEach((s) =>
  $(s).addEventListener('input', render));

// ---------- 設定操作 ----------
$('#accountForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const name = f.name.value.trim();
  if (!name) return;
  settings.accounts.push({ id: uid(), name, opening: Math.round(Number(f.opening.value) || 0) });
  await saveSettings();
  f.reset();
  refreshFormOptions();
  render();
});
$('#catForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const name = f.name.value.trim();
  const list = settings.categories[f.kind.value];
  if (!name || list.includes(name)) return toast('同じ科目があります');
  list.push(name);
  await saveSettings();
  f.name.value = '';
  refreshFormOptions();
  render();
});
$('#tab-settings').addEventListener('click', async (e) => {
  const t = e.target;
  if (t.dataset.accDel) {
    const id = t.dataset.accDel;
    const used = txs.some((x) => x.account === id || x.toAccount === id);
    if (used) return toast('取引で使われている口座は削除できません');
    if (!confirm('この口座を削除しますか？')) return;
    settings.accounts = settings.accounts.filter((a) => a.id !== id);
  } else if (t.dataset.accEdit) {
    const a = settings.accounts.find((x) => x.id === t.dataset.accEdit);
    const v = prompt(`${a.name} の期首残高（円）`, a.opening || 0);
    if (v == null) return;
    if (!Number.isFinite(Number(v))) return toast('数値を入力してください');
    a.opening = Math.round(Number(v));
  } else if (t.dataset.catDel) {
    const kind = t.dataset.catDel;
    settings.categories[kind] = settings.categories[kind].filter((c) => c !== t.dataset.name);
  } else return;
  await saveSettings();
  refreshFormOptions();
  render();
});

// ---------- バックアップ / 復元 ----------
function download(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('#exportJson').addEventListener('click', async () => {
  settings.lastBackup = Date.now();
  await saveSettings();
  const data = { app: 'offline-kaikei', version: 1, exportedAt: new Date().toISOString(), settings, transactions: txs };
  download(`kaikei-backup-${today()}.json`, JSON.stringify(data, null, 2), 'application/json');
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
$('#importJson').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  let data;
  try {
    data = JSON.parse(await file.text());
    if (data.app !== 'offline-kaikei' || !Array.isArray(data.transactions) || !data.settings) throw new Error('形式が違います');
  } catch (err) {
    return toast('読み込めませんでした: ' + err.message);
  }
  if (!confirm(`${data.transactions.length}件の取引を復元します。現在のデータは置き換えられます。よろしいですか？`)) return;
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
  if (!confirm('すべての取引と設定を削除します。元に戻せません。先にバックアップを取りましたか？')) return;
  if (prompt('確認のため「削除」と入力してください') !== '削除') return;
  const t = db.transaction(['tx', 'meta'], 'readwrite');
  t.objectStore('tx').clear();
  t.objectStore('meta').clear();
  await txDone(t);
  await reload();
  toast('削除しました');
});

// ---------- オンライン表示 ----------
function updateNet() {
  const el = $('#netStatus');
  el.textContent = navigator.onLine ? 'オンライン' : 'オフライン（保存OK）';
  el.classList.toggle('off', !navigator.onLine);
}
addEventListener('online', updateNet);
addEventListener('offline', updateNet);

// ---------- 起動 ----------
async function reload() {
  settings = await loadSettings();
  txs = sortTx(await getAllTx());
  resetForm();
  render();
}
(async function init() {
  updateNet();
  $('#listMonth').value = thisMonth();
  $('#reportMonth').value = thisMonth();
  $('#reportYear').value = new Date().getFullYear();
  $('#entryForm').date.value = today();
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
})();
