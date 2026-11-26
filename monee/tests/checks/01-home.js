// 段階1：ホームは3つまで。お知らせはドットが行動つきで伝える。
module.exports = ({ check, open, go, sleep, count, expect }) => {
  check('ホームの中身は3つまで（ドット＋予算／記録する／今日の問いかけ）', async (b) => {
    const pg = await open(b);
    const n = await pg.$$eval('#view .homegrid section', (els) => els.length);
    expect(n <= 3, `ホームに${n}個の区画がある`);
    expect(await pg.$('#view .dothero'), 'ドットがいない');
    for (const gone of ['がまん貯金', '最近の記録', '今月の内訳', 'お知らせ']) {
      expect(!(await pg.textContent('#view')).includes(gone), `ホームに「${gone}」が残っている`);
    }
    return pg;
  });
  check('ドットの行動ボタン：定期の支払いを記録できる', async (b) => {
    const pg = await open(b);
    await pg.evaluate(() => saveSettings({ recurring: [{ id: 'r1', name: 'スマホ代', amount: 2980, day: 1, category: 'phone', method: '' }] }));
    await sleep(150);
    await pg.click('#view .bubble [data-act="recur"]'); await sleep(150);
    expect(await pg.evaluate(() => location.hash) === '#add-manual', '記録画面に移らない');
    expect(await pg.inputValue('#f-amount') === '2980', '金額が入っていない');
    return pg;
  });
  check('ふりかえりにお知らせとがまん貯金がある', async (b) => {
    const pg = await open(b);
    await go(pg, '#insights');
    const txt = await pg.textContent('#view');
    expect(txt.includes('がまん貯金'), 'がまん貯金がない');
    expect(txt.includes('予算の'), 'お知らせ（カテゴリ予算）がない');
    return pg;
  });
};
