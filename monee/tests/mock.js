// テスト用の偽データ層。window.claude.use('db') などを、メモリ上のストアで置き換える。
// ページより先に読み込む（Playwright の addInitScript で注入）。
(() => {
  const pad = (n) => String(n).padStart(2, '0');
  const ago = (n) => { const x = new Date(); x.setDate(x.getDate() - n); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
  const store = { txns: {}, inbox: {}, skips: {}, config: {}, days: {}, splits: {} };
  const seed = window.__MONEE_EMPTY ? [] : [
    [0, 'スターバックス', 680, 'cafe', 'QR決済'], [1, 'スターバックス', 680, 'cafe', 'QR決済'], [3, 'スターバックス', 680, 'cafe', 'QR決済'],
    [0, 'セブンイレブン', 320, 'food', '交通系IC'], [2, 'セブンイレブン', 320, 'food', '交通系IC'], [5, 'ドラッグストア', 1480, 'daily', '現金'],
    [8, '映画館', 1900, 'hobby', 'クレジットカード'], [12, 'サイゼリヤ', 900, 'cafe', '現金'], [35, 'スーパー', 4200, 'food', '現金'],
    [40, 'カフェ', 5200, 'cafe', '現金'], [20, '飲み会', 4000, 'social', '現金'],
  ];
  seed.forEach((s, i) => { store.txns['t' + i] = { type: 'expense', status: 'confirmed', amount: s[2], date: ago(s[0]), merchant: s[1], category: s[3], method: s[4], items: [], createdAt: new Date(Date.now() - s[0] * 864e5).toISOString() }; });
  if (!window.__MONEE_EMPTY) {
    store.txns.inc = { type: 'income', status: 'confirmed', amount: 32000, date: ago(4), merchant: 'バイト代', category: 'job', method: '銀行口座', items: [] };
    store.config.settings = { name: 'テスト', budget: 60000, alertAt: 80, catBudgets: { cafe: 3000 }, goals: [{ id: 'g1', name: '旅行', target: 50000, saved: 8000 }] };
  }
  const subs = [];
  const fire = () => setTimeout(() => subs.forEach((f) => f()), 0);
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const snap = (c) => {
    const docs = Object.entries(store[c] || (store[c] = {})).map(([id, v]) => ({ id, exists: true, data: () => clone(v) }));
    return { docs, size: docs.length, metadata: { fromCache: false } };
  };
  const coll = (c) => ({
    onSnapshot: (cb) => { const f = () => cb(snap(c)); subs.push(f); setTimeout(f, 5); return () => {}; },
    doc: (id) => ({
      set: async (v) => { (store[c] || (store[c] = {}))[id] = clone(v); fire(); },
      delete: async () => { delete (store[c] || {})[id]; fire(); },
    }),
  });
  const db = {
    collection: coll,
    doc: (p) => {
      const [c, id] = p.split('/');
      return {
        onSnapshot: (cb) => { const f = () => cb({ exists: !!(store[c] || {})[id], data: () => clone(store[c][id]), metadata: { fromCache: false } }); subs.push(f); setTimeout(f, 5); return () => {}; },
        set: async (v) => { (store[c] || (store[c] = {}))[id] = clone(v); fire(); },
      };
    },
  };
  const assets = { upload: async () => ({ id: 'a1', url: '' }), delete: async (id) => { (window.__deletedAssets = window.__deletedAssets || []).push(id); } };
  window.__store = store;
  window.claude = { use: async (n) => (n === 'db' ? db : n === 'user' ? { can: async () => true } : n === 'assets' ? assets : null) };
})();
