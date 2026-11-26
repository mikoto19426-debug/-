// 段階5：オプション機能（最初はすべてオフ。オンにした人にだけ出る）
module.exports = ({ check, open, go, sleep, count, expect }) => {
  const on = (pg, patch) => pg.evaluate(async (p) => { await saveSettings(p); }, patch).then(() => sleep(150));

  check('オプションは最初すべてオフで、ふりかえりに何も足されない', async (b) => {
    const pg = await open(b);
    await go(pg, '#insights');
    expect(!(await pg.textContent('#view')).includes('お金の流れ'), 'オフなのに「お金の流れ」が出ている');
    await go(pg, '#settings');
    const rows = await pg.$$eval('[data-opt][data-oact="open"]', (els) => els.map((e) => e.textContent));
    expect(rows.length === 4 && rows.every((t) => t.includes('オフ')), '設定の一覧がおかしい');
    await pg.click('[data-opt="split"][data-oact="open"]'); await sleep(80);
    await pg.check('#op-on'); await pg.click('#op-save'); await sleep(150);
    expect(await pg.evaluate(() => __store.config.settings.modules.split) === true, '設定からオンにできない');
    return pg;
  });
  check('立て替え・割り勘：自分の分だけが支出に入り、返してもらったら精算済み', async (b) => {
    const pg = await open(b);
    await on(pg, { modules: { split: true } });
    const before = await pg.evaluate(() => { const m = rangeOf('month'); return totals(m.from, m.to).exp; });
    await pg.evaluate(() => detailSheet('t5')); await sleep(80); // ドラッグストア ¥1,480
    await pg.click('#layer [data-oact="lendform"]'); await sleep(80);
    await pg.fill('#ln-who', 'さくら'); await pg.fill('#ln-amt', '740');
    await pg.click('#layer [data-oact="lendsave"]'); await sleep(150);
    const after = await pg.evaluate(() => { const m = rangeOf('month'); return totals(m.from, m.to).exp; });
    expect(before - after === 740, `支出が${before - after}円しか減らない`);
    await go(pg, '#insights');
    expect((await pg.textContent('#view')).includes('立て替え中'), 'ふりかえりに出ない');
    await pg.click('[data-oact="settle"]'); await sleep(150);
    expect(await pg.evaluate(() => __store.txns.t5.lend.settled) === true, '精算できない');
    // 編集しても立て替えと評価が消えない
    await pg.evaluate(async () => { const t = S.txns.find((x) => x.id === 't5'); const o = { ...t, feel: 'good' }; delete o.id; await saveTxn('t5', o); });
    await sleep(100);
    await pg.evaluate(() => { S.form = formFromTxn(S.txns.find((x) => x.id === 't5')); location.hash = '#add-manual'; }); await sleep(150);
    await pg.fill('#f-note', 'メモを追加'); await pg.click('#fsave'); await sleep(200);
    const t5 = await pg.evaluate(() => __store.txns.t5);
    expect(t5.lend && t5.feel === 'good' && t5.note === 'メモを追加', '編集で立て替えか評価が消えた');
    return pg;
  });
  check('カードの引き落とし：締め日で区切った金額を出す', async (b) => {
    const pg = await open(b);
    await on(pg, { modules: { card: true }, cards: [{ method: 'クレジットカード', close: 15, pay: 10, from: '銀行口座' }] });
    const r = await pg.evaluate(() => { const c = settings().cards[0]; const n = cardNow(c); const exp = S.txns.filter((t) => t.method === c.method && t.type === 'expense' && t.date >= n.next.from && t.date <= n.next.to).reduce((a, t) => a + t.amount, 0); const open = S.txns.filter((t) => t.method === c.method && t.type === 'expense' && t.date >= n.openFrom && t.date <= today()).reduce((a, t) => a + t.amount, 0); return { n, exp, open }; });
    expect(r.n.next.amt === r.exp, '確定分の金額が合わない');
    expect(r.n.open === r.open, '締め前の金額が合わない');
    expect(r.n.next.to.endsWith('-15'), `締め日が15日になっていない（${r.n.next.to}）`);
    await go(pg, '#insights');
    expect((await pg.textContent('#view')).includes('引き落とし'), 'ふりかえりに出ない');
    return pg;
  });
  check('口座ごとの残高：入れた日のあとの記録で増減する', async (b) => {
    const pg = await open(b);
    const asOf = await pg.evaluate(() => ymd(new Date(Date.now() - 10 * 864e5)));
    await on(pg, { modules: { accounts: true }, accounts: { 現金: 10000, 銀行口座: 50000 }, accountsAsOf: asOf });
    const bal = await pg.evaluate(() => accountBalances());
    expect(bal['現金'] === 10000 - 1480, `現金の残高が違う（${bal['現金']}）`); // 5日前のドラッグストアだけ
    expect(bal['銀行口座'] === 50000 + 32000, `銀行の残高が違う（${bal['銀行口座']}）`); // 4日前のバイト代
    return pg;
  });
  check('収入の予定：次の入金までの日数がホームに出る', async (b) => {
    const pg = await open(b);
    const day = await pg.evaluate(() => new Date(Date.now() + 3 * 864e5).getDate());
    await on(pg, { modules: { income: true }, paydays: [{ id: 'p1', name: 'バイト代', day, amount: 30000, method: '銀行口座' }] });
    await go(pg, '#home');
    expect((await pg.textContent('#view')).includes('バイト代'), 'ホームに次の入金が出ない');
    expect(await pg.evaluate(() => nextPaydays()[0].days) === 3, '日数が違う');
    return pg;
  });
};
