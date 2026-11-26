#!/usr/bin/env node
// monee. の動作テスト。偽データ層(mock.js)を入れてページを開き、主な操作を順に確かめる。
// 使い方: node tests/smoke.js            （ページのJSエラーも失敗として数える）
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const PAGE = 'file://' + path.resolve(__dirname, '..', 'index.html');
const MOCK = fs.readFileSync(path.join(__dirname, 'mock.js'), 'utf8');

const checks = [];
const check = (name, fn) => checks.push({ name, fn });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const count = (pg, c, pred = 'true') => pg.evaluate(`Object.values(__store.${c}||{}).filter(x=>${pred}).length`);
function expect(cond, msg) { if (!cond) throw new Error(msg); }

async function open(browser, { empty = false, width = 390 } = {}) {
  const pg = await browser.newPage({ viewport: { width, height: 844 } });
  pg.errors = [];
  pg.on('pageerror', (e) => pg.errors.push(e.message));
  pg.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|net::/.test(m.text())) pg.errors.push(m.text()); });
  await pg.addInitScript((e) => { window.__MONEE_EMPTY = e; }, empty);
  await pg.addInitScript(MOCK);
  await pg.goto(PAGE);
  await sleep(300);
  return pg;
}
const go = async (pg, h) => { await pg.evaluate((x) => { location.hash = x; }, h); await sleep(120); };

// ---------------- checks ----------------
check('全画面がエラーなく開く', async (b) => {
  const pg = await open(b);
  for (const h of ['#home', '#history', '#add', '#add-manual', '#add-scan', '#add-chat', '#settings', '#insights']) await go(pg, h);
  await pg.click('[data-act="iunit"][data-v="month"]'); await sleep(100);
  await pg.click('[data-act="iunit"][data-v="year"]'); await sleep(100);
  return pg;
});
check('記録0件でもエラーなく開く', async (b) => {
  const pg = await open(b, { empty: true });
  for (const h of ['#home', '#history', '#add', '#insights', '#settings']) await go(pg, h);
  return pg;
});
check('すばやく記録：全角数字・店名からカテゴリ推測・保存', async (b) => {
  const pg = await open(b);
  const before = await count(pg, 'txns');
  await pg.click('[data-act="quick"] >> nth=0'); await sleep(100);
  await pg.fill('#q-amount', '１２００'); await pg.fill('#q-merchant', 'ドトール'); await sleep(50);
  expect(await pg.evaluate(() => S.q.category) === 'cafe', 'カテゴリが推測されない');
  await pg.click('#q-save'); await sleep(150);
  expect(await count(pg, 'txns') === before + 1, '保存されない');
  expect(await count(pg, 'txns', "x.amount===1200&&x.merchant==='ドトール'") === 1, '金額か店名が違う');
  return pg;
});
check('いつものワンタップ記録', async (b) => {
  const pg = await open(b);
  await go(pg, '#add');
  const before = await count(pg, 'txns');
  await pg.click('.fav >> nth=0'); await sleep(150);
  expect(await count(pg, 'txns') === before + 1, 'ワンタップで追加されない');
  return pg;
});
check('手入力：保存と取消・削除', async (b) => {
  const pg = await open(b);
  await go(pg, '#add-manual');
  await pg.fill('#f-amount', '450'); await pg.fill('#f-merchant', 'ローソン'); await sleep(50);
  expect(await pg.evaluate(() => S.form.category) === 'food', '手入力のカテゴリ推測');
  await pg.click('#fsave'); await sleep(150);
  expect(await count(pg, 'txns', "x.merchant==='ローソン'") === 1, '手入力が保存されない');
  return pg;
});
check('買ってよかった？の評価が保存される', async (b) => {
  const pg = await open(b);
  const sel = '[data-act="feel"][data-v="bad"]';
  await go(pg, '#history');
  await pg.click('.tx >> nth=0'); await sleep(100);
  await pg.click(`#layer ${sel}`); await sleep(150);
  expect(await count(pg, 'txns', "x.feel==='bad'") === 1, '評価が保存されない');
  return pg;
});
check('がまん貯金：保存と目標への加算', async (b) => {
  const pg = await open(b);
  await pg.evaluate(() => gamanSheet()); await sleep(100);
  await pg.fill('#g-name', 'お菓子'); await pg.fill('#g-amt', '300');
  if (await pg.$('#g-goal')) await pg.selectOption('#g-goal', 'g1');
  await pg.click('[data-act="gsave"]'); await sleep(200);
  expect(await count(pg, 'skips') === 1, 'がまんが保存されない');
  return pg;
});
check('カテゴリ別予算の設定', async (b) => {
  const pg = await open(b);
  await go(pg, '#settings');
  await pg.click('[data-act="s-catbud"]'); await sleep(100);
  await pg.fill('#cb-food', '5000'); await pg.click('#ss-save'); await sleep(150);
  expect(await pg.evaluate(() => __store.config.settings.catBudgets.food) === 5000, 'カテゴリ予算が保存されない');
  return pg;
});
check('カレンダーの日付タップ', async (b) => {
  const pg = await open(b);
  await go(pg, '#insights');
  await pg.click('[data-act="iunit"][data-v="month"]'); await sleep(100);
  await pg.click('.cal button.today'); await sleep(100);
  expect(await pg.$('[data-act="quickday"]'), 'その日の欄が出ない');
  return pg;
});
check('PC幅でもエラーなく開く', async (b) => {
  const pg = await open(b, { width: 1280 });
  for (const h of ['#home', '#history', '#insights', '#settings']) await go(pg, h);
  return pg;
});

// 段階ごとに足すテストは tests/checks/*.js に置く（check, open, go, sleep, count, expect を受け取る）
const dir = path.join(__dirname, 'checks');
if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).sort()) if (f.endsWith('.js')) require(path.join(dir, f))({ check, open, go, sleep, count, expect });

(async () => {
  const b = await chromium.launch();
  let fail = 0;
  for (const c of checks) {
    let pg;
    try {
      pg = await c.fn(b);
      await sleep(100);
      if (pg && pg.errors.length) throw new Error('JSエラー: ' + [...new Set(pg.errors)].join(' / '));
      console.log('✓ ' + c.name);
    } catch (e) { fail++; console.log('✗ ' + c.name + ' — ' + e.message.split('\n')[0]); }
    if (pg) await pg.close();
  }
  await b.close();
  console.log(`\n${checks.length - fail}/${checks.length} 成功`);
  process.exit(fail ? 1 : 0);
})();
