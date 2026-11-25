// オフライン会計アプリ用：撮影前に画面操作でサンプルのメニューと注文を入れる。
// 撮影ツールの --eval で渡す（node .claude/design-review/shoot.js index.html --eval .claude/design-review/sample-data.js ...）
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
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
// 注文を2件入れて、カートにも1件残す
const btn = (i) => document.querySelectorAll('.menu-btn')[i];
for (const order of [[0, 0, 2], [1, 3]]) {
  for (const i of order) { btn(i)?.click(); await wait(80); }
  [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '会計して追加')?.click();
  await wait(250);
}
btn(0)?.click(); btn(4)?.click();
await wait(150);
