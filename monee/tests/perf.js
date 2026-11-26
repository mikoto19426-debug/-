#!/usr/bin/env node
// 重さの確認：記録を5,000件入れて、各画面を描くのにかかる時間を測る。
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const N = +process.argv[2] || 5000;
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  pg.on('pageerror', (e) => console.log('JSエラー:', e.message));
  await pg.addInitScript((n) => { window.__BIG = n; }, N);
  await pg.addInitScript(fs.readFileSync(path.join(__dirname, 'mock.js'), 'utf8') + `
    ;(() => { const st = window.__store, cats = ['food','cafe','daily','transport','hobby'], ms = ['現金','QR決済','交通系IC','クレジットカード'];
      for (let i = 0; i < window.__BIG; i++) { const d = new Date(Date.now() - (i % 700) * 864e5); const ds = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
        st.txns['b' + i] = { type: 'expense', status: 'confirmed', amount: 100 + (i * 37) % 3000, date: ds, merchant: '店' + (i % 60), category: cats[i % 5], method: ms[i % 4], items: [], feel: i % 7 ? null : 'bad' }; } })();`);
  await pg.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await pg.waitForTimeout(1500);
  const res = {};
  for (const h of ['home', 'history', 'insights', 'insights-month', 'settings']) {
    res[h] = await pg.evaluate(async (h) => {
      if (h === 'insights-month') { S.ins.unit = 'month'; location.hash = '#insights'; } else location.hash = '#' + h;
      await new Promise((r) => setTimeout(r, 200));
      const t = performance.now(); for (let i = 0; i < 5; i++) render(); return Math.round((performance.now() - t) / 5);
    }, h);
  }
  console.log(`記録 ${N}件：1回描くのにかかる時間（ミリ秒）`, res);
  await b.close();
})();
