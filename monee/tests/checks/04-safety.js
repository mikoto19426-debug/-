// 段階4：安心（バックアップから戻す、レシート画像の後始末）
module.exports = ({ check, open, go, sleep, count, expect }) => {
  check('書き出したJSONから戻す：消えた記録が戻り、今ある記録は消えない', async (b) => {
    const pg = await open(b);
    const json = await pg.evaluate(() => exportData('json').data);
    // 1件消して、1件新しく足す
    await pg.evaluate(async () => { await S.db.collection('txns').doc('t0').delete(); await saveTxn('new1', { type: 'expense', status: 'confirmed', amount: 100, date: today(), merchant: '新しい記録', category: 'food', items: [] }); });
    await sleep(150);
    const before = await count(pg, 'txns');
    await go(pg, '#settings');
    await pg.click('[data-act="restore"]'); await sleep(80);
    await pg.evaluate((t) => previewRestore(new File([t], 'monee.json')), json); await sleep(100);
    expect((await pg.textContent('#rs-preview')).includes('1件'), 'プレビューに件数が出ない');
    await pg.click('[data-act="rsok"]'); await sleep(250);
    expect(await count(pg, 'txns') === before + 1, '消えた記録が戻らない');
    expect(await count(pg, 'txns', "x.merchant==='新しい記録'") === 1, '今ある記録が消えた');
    return pg;
  });
  check('monee.以外のファイルは戻さない', async (b) => {
    const pg = await open(b);
    await go(pg, '#settings');
    await pg.click('[data-act="restore"]'); await sleep(80);
    await pg.evaluate(() => previewRestore(new File(['{"hello":1}'], 'x.json'))); await sleep(80);
    expect((await pg.textContent('#rs-preview')).includes('バックアップではない'), 'エラーが出ない');
    return pg;
  });
  check('記録を消すとレシート画像も消える（元に戻したら消さない）', async (b) => {
    const pg = await open(b);
    await pg.evaluate(async () => {
      await saveTxn('r1', { type: 'expense', status: 'confirmed', amount: 500, date: today(), merchant: 'レシートA', category: 'food', items: [], receiptAssetId: 'imgA' });
      await saveTxn('r2', { type: 'expense', status: 'confirmed', amount: 600, date: today(), merchant: 'レシートB', category: 'food', items: [], receiptAssetId: 'imgB' });
    });
    await sleep(150);
    for (const [id, undo] of [['r1', false], ['r2', true]]) {
      await pg.evaluate((i) => detailSheet(i), id); await sleep(80);
      await pg.click('#layer [data-act="delete"]'); await sleep(80);
      await pg.click('#cfy'); await sleep(150);
      if (undo) { await pg.click('.toast:last-child button'); await sleep(150); }
    }
    await sleep(7500);
    const del = await pg.evaluate(() => window.__deletedAssets || []);
    expect(del.includes('imgA'), '消した記録の画像が残っている');
    expect(!del.includes('imgB'), '元に戻した記録の画像まで消えた');
    return pg;
  });
};
