// 段階6：仕上げで見つけたこと
module.exports = ({ check, open, go, sleep, expect }) => {
  check('週の評価：比べようのない「モヤっと」について増えた・減ったと言わない', async (b) => {
    const pg = await open(b);
    await go(pg, '#insights');
    const txt = await pg.textContent('#view');
    expect(!/モヤっとしやすい出費も(増え|減っ)/.test(txt), '評価がないのに、モヤっとが増えた・減ったと言っている');
    return pg;
  });
  check('ホームのボタンやリンクは指で押せる大きさ（高さ44px以上）', async (b) => {
    const pg = await open(b);
    const small = await pg.$$eval('#view button, #view a[href]', (els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.height > 0 && r.height < 44; }).map((e) => e.textContent.trim().slice(0, 12)));
    expect(!small.length, '小さい：' + small.join('、'));
    return pg;
  });
};
