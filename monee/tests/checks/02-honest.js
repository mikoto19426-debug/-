// 段階2：数字を正直に（0円の日は明示、評価は数日後、がまんは移してから確定、ムダは本人の評価から）
module.exports = ({ check, open, go, sleep, count, expect }) => {
  check('昨日の記録がないと「0円でした」を聞き、押すと0円の日になる', async (b) => {
    const pg = await open(b);
    await pg.evaluate(() => { const y = ymd(new Date(Date.now() - 864e5)); for (const [k, v] of Object.entries(__store.txns)) if (v.date === y) delete __store.txns[k]; S.db.collection('txns').doc('x').delete(); });
    await sleep(150);
    expect((await pg.textContent('#view')).includes('昨日は何か買った？'), '昨日の問いかけが出ない');
    await pg.click('#view [data-act="zeroday"]'); await sleep(150);
    expect(await pg.evaluate(() => dayState(ymd(new Date(Date.now() - 864e5)))) === 'zero', '0円の日にならない');
    expect(!(await pg.textContent('#view')).includes('昨日は何か買った？'), '答えたのに問いかけが残る');
    return pg;
  });
  check('記録のない日は0円の日に数えない', async (b) => {
    const pg = await open(b);
    const r = await pg.evaluate(() => { const m = rangeOf('month'); return dayCounts(m.from, today()); });
    expect(r.zero === 0, `何もしていないのに0円の日が${r.zero}日ある`);
    expect(r.none > 0, '記録なしの日が数えられていない');
    return pg;
  });
  check('買ってよかった？は買った当日には聞かない（2〜7日後）', async (b) => {
    const pg = await open(b);
    const dates = await pg.evaluate(() => unratedRecent().map((t) => t.date));
    const t0 = await pg.evaluate(() => today()), y = await pg.evaluate(() => ymd(new Date(Date.now() - 864e5)));
    expect(!dates.includes(t0) && !dates.includes(y), '当日・昨日の出費を聞いている');
    expect(dates.length > 0, '2〜7日前の出費を聞いていない');
    return pg;
  });
  check('がまんは「まだ」で記録され、「移した」で確定し目標に足される', async (b) => {
    const pg = await open(b);
    await pg.evaluate(() => gamanSheet()); await sleep(80);
    await pg.fill('#g-name', 'お菓子'); await pg.fill('#g-amt', '300');
    await pg.click('[data-act="gsave"]'); await sleep(150);
    expect(await count(pg, 'skips', "x.status==='pending'") === 1, '「まだ」で保存されない');
    await pg.evaluate(() => gamanMoveSheet()); await sleep(80);
    await pg.selectOption('#gm-goal', 'g1');
    await pg.click('[data-act="gmoveok"]'); await sleep(250);
    expect(await count(pg, 'skips', "x.status==='moved'") === 1, '「移した」にならない');
    expect(await pg.evaluate(() => __store.config.settings.goals[0].saved) === 8300, '目標に足されない');
    return pg;
  });
  check('ムダの判定は本人の「モヤっと」から（評価がなければ判定しない）', async (b) => {
    const pg = await open(b);
    const before = await pg.evaluate(() => { const M = moyattoModel(); return S.txns.filter((t) => wasteType(t, M)).length; });
    expect(before === 0, '評価がないのにムダと判定している');
    await pg.evaluate(async () => { for (const t of S.txns.filter((t) => t.merchant === 'スターバックス').slice(0, 2)) { const o = { ...t, feel: 'bad' }; delete o.id; await saveTxn(t.id, o); } });
    await sleep(150);
    const after = await pg.evaluate(() => { const M = moyattoModel(); return S.txns.filter((t) => wasteType(t, M)).map((t) => t.merchant); });
    expect(after.filter((m) => m === 'スターバックス').length === 3, '同じ店の未評価の出費が判定されない');
    return pg;
  });
};
