#!/usr/bin/env node
// 見た目の確認用：偽データ入りで主な画面を撮る。
// 使い方: node tests/shoot.js <出力先> [画面...]   例: node tests/shoot.js /tmp/shots home insights
// スマホ(390)のライト・ダーク、PC(1280)のライトを撮る。画像はリポジトリの外に出すこと。
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const out = process.argv[2];
if (!out) { console.error('出力先を指定してください'); process.exit(1); }
const routes = process.argv.slice(3).length ? process.argv.slice(3) : ['home', 'history', 'add', 'insights', 'settings'];
const PAGE = 'file://' + path.resolve(__dirname, '..', 'index.html');
const MOCK = fs.readFileSync(path.join(__dirname, 'mock.js'), 'utf8');
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  for (const [name, w, scheme] of [['phone', 390, 'light'], ['phone', 390, 'dark'], ['pc', 1280, 'light']]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 844 }, colorScheme: scheme });
    const pg = await ctx.newPage();
    pg.on('pageerror', (e) => console.log('JSエラー:', e.message));
    await pg.addInitScript(MOCK);
    await pg.goto(PAGE); await pg.waitForTimeout(400);
    for (const r of routes) {
      await pg.evaluate((h) => { location.hash = '#' + h; }, r); await pg.waitForTimeout(250);
      await pg.screenshot({ path: path.join(out, `${r}-${name}-${scheme}.png`), fullPage: true });
    }
    await ctx.close();
  }
  await b.close();
  console.log('撮影しました →', out);
})();
