// 段階3：続く仕組み（ドットの記憶・成長、ドットに話して記録）
module.exports = ({ check, open, go, sleep, count, expect }) => {
  check('ドットの成長と連続記録の数え方', async (b) => {
    const pg = await open(b);
    const st = await pg.evaluate(() => dotStats());
    expect(st.streak >= 4, `連続記録が少なすぎる（${st.streak}）`); // 今日〜5日前まで記録あり（モック）
    expect(st.stage === 1, `記録${st.n}日なのに成長段階が${st.stage}`);
    await pg.click('[data-act="dotinfo"]'); await sleep(100);
    const txt = await pg.textContent('#layer');
    expect(txt.includes('芽が出た') && txt.includes('覚えていること'), 'ドットのことシートの中身');
    return pg;
  });
  check('ドットの記憶は実際の記録だけから作る', async (b) => {
    const pg = await open(b, { empty: true });
    expect((await pg.evaluate(() => dotMemories())).length === 0, '記録がないのに思い出がある');
    return pg;
  });
  check('ドットに話して：0円の日とがまんを確認カードから記録', async (b) => {
    const pg = await open(b);
    await pg.evaluate(() => { S.sample = async () => ({ text: '' }); });
    await go(pg, '#add-chat');
    await pg.evaluate(() => { const T = chatTools(); const y = ymd(new Date(Date.now() - 6 * 864e5)); T.find((t) => t.name === 'propose_no_spend_day').execute({ date: y }); T.find((t) => t.name === 'propose_gaman').execute({ name: 'スタバ', amount: 680 }); });
    await sleep(100);
    expect(await count(pg, 'days') === 0 && await count(pg, 'skips') === 0, 'カードを押す前に保存された');
    await pg.click('[data-act="psave"] >> nth=0'); await sleep(150);
    await pg.click('[data-act="psave"] >> nth=0'); await sleep(150);
    expect(await count(pg, 'days') === 1, '0円の日が記録されない');
    expect(await count(pg, 'skips', "x.status==='pending'&&x.amount===680") === 1, 'がまんが記録されない');
    return pg;
  });
  check('支出のある日は0円の日にしない（チャット）', async (b) => {
    const pg = await open(b);
    const r = await pg.evaluate(() => chatTools().find((t) => t.name === 'propose_no_spend_day').execute({ date: today() }));
    expect(r.shown === false, '支出がある日なのに0円カードを出した');
    return pg;
  });
};
