// オフライン会計アプリ用：撮影前に画面操作でサンプルデータを入れる。
// 撮影ツールの --eval で渡す（node .claude/design-review/shoot.js index.html --eval .claude/design-review/sample-data.js ...）
// 入るもの: メニュー5品、会計済みの注文2件（最後の会計の整理券が表示された状態）、
//           計画（原価・予定の個数・打ち上げ目標・その他の費用）
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const set = (el, v) => { if (!el) return; el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };

// メニュー
const form = document.querySelector('#menuForm');
if (form && !document.querySelector('.menu-btn')) {
  for (const [name, price] of [['焼きそば', 400], ['フランクフルト', 200], ['ラムネ', 150], ['チョコバナナ', 250], ['たこ焼き（8個）', 350]]) {
    form.name.value = name;
    form.price.value = price;
    form.requestSubmit();
    await wait(150);
  }
}
document.querySelector('#menuEdit')?.removeAttribute('open');

// 計画（原価・予定の個数）— 入力のたびに画面が描き直されるので、毎回カードを探し直して1欄ずつ入れる
document.querySelector('[data-tab=plan]')?.click(); // 計画タブは開いている間だけ描き直されるので開いて入れる
await wait(200);
const plan = [[120, 300], [80, 200], [60, 150], [90, 120]]; // 最後の1品は未設定のまま（未設定の表示を見るため）
const pids = [...document.querySelectorAll('#planMenus .plan-item')].map((c) => c.dataset.pid);
for (const [i, pid] of pids.entries()) {
  if (!plan[i]) continue;
  for (const [cls, v] of [['.p-cost', plan[i][0]], ['.p-qty', plan[i][1]]]) {
    set(document.querySelector(`#planMenus [data-pid="${CSS.escape(pid)}"] ${cls}`), v);
    await wait(120);
  }
}
set(document.querySelector('#evName'), '学園祭');
set(document.querySelector('#partyPeople'), 12);
set(document.querySelector('#partyPer'), 3000);
const cost = document.querySelector('#costForm');
if (cost && !document.querySelector('#costList .cost-row')) {
  for (const [name, amount] of [['出店料', 5000], ['ガス代', 2000]]) {
    cost.name.value = name; cost.amount.value = amount; cost.requestSubmit(); await wait(150);
  }
}

document.querySelector('[data-tab=pos]')?.click();
await wait(200);

// 注文を2件会計する。最後の会計の整理券が出たままの状態で撮影される
const btn = (i) => document.querySelectorAll('.menu-btn')[i];
for (const order of [[1, 3], [0, 0, 4]]) {
  for (const i of order) { btn(i)?.click(); await wait(80); }
  document.querySelector('#checkout')?.click();
  await wait(300);
}
