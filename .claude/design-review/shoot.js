#!/usr/bin/env node
// デザインチェック用：ページを撮影し、機械的に分かる問題を測る。
//
// 使い方:
//   node .claude/design-review/shoot.js <ファイルのパス or URL> [--out 出力先] [--eval "JS"] [--click "CSSセレクタ"]...
//
// 例（タブを順に押して全画面を撮る）:
//   node .claude/design-review/shoot.js index.html --out /tmp/shots \
//     --click '[data-tab=pos]' --click '[data-tab=entry]'
//
// --click を付けないと、最初の画面だけ撮る。
// --eval は読み込み後・撮影前にページ内で実行するJS（サンプルデータを入れる等）。複数可、順に実行。
//   JSファイルのパスを渡してもよい（例: --eval sample-data.js）。
// 撮る幅: スマホ(390) / タブレット(820) / PC(1280)、ライトとダークの両方。
// 結果: 出力先に PNG と report.json。標準出力に要約。

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

function parseArgs(argv) {
  const args = { target: null, out: 'design-shots', clicks: [], evals: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') args.out = argv[++i];
    else if (a === '--click') args.clicks.push(argv[++i]);
    else if (a === '--eval') { const v = argv[++i]; args.evals.push(fs.existsSync(v) ? fs.readFileSync(v, 'utf8') : v); }
    else if (!args.target) args.target = a;
  }
  if (!args.target) {
    console.error('使い方: node shoot.js <ファイル or URL> [--out dir] [--click selector]...');
    process.exit(1);
  }
  if (!/^https?:|^file:/.test(args.target)) {
    args.target = 'file://' + path.resolve(args.target);
  }
  return args;
}

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'desktop', width: 1280, height: 800 },
];
const SCHEMES = ['light', 'dark'];

// ページの中で実行する検査。見える要素だけを対象にする。
function audit() {
  const issues = [];
  const visible = (el) => {
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    const closed = el.closest('details:not([open])');
    if (closed && !el.closest('summary')) return false;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity !== 0;
  };
  const label = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    else if (el.classList.length) s += '.' + [...el.classList].slice(0, 2).join('.');
    if (!el.id && el.name) s += `[name=${el.name}]`;
    const form = el.closest('form[id], section[id]');
    if (form && !el.id) s = `#${form.getAttribute('id')} ` + s;
    const t = (el.innerText || el.value || el.getAttribute('aria-label') || el.placeholder || '').trim().replace(/\s+/g, ' ');
    return t ? `${s}「${t.slice(0, 20)}」` : s;
  };

  // 色のコントラスト比（WCAG）
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const bgOf = (el) => {
    // 背景色を親までたどって重ねる（画像やグラデーションは判定しない）
    const layers = [];
    for (let e = el; e; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.backgroundImage && s.backgroundImage !== 'none') return null;
      const c = parse(s.backgroundColor);
      if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; }
    }
    let out = { r: 255, g: 255, b: 255 };
    for (const c of layers.reverse()) {
      out = { r: c.r * c.a + out.r * (1 - c.a), g: c.g * c.a + out.g * (1 - c.a), b: c.b * c.a + out.b * (1 - c.a) };
    }
    return out;
  };

  const seen = new Set();
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el)) continue;
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!hasText) continue;
    const s = getComputedStyle(el);
    const size = parseFloat(s.fontSize);
    const fg = parse(s.color);
    const bg = bgOf(el);
    if (fg && bg) {
      const a = fg.a;
      const mixed = { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a) };
      const L1 = lum(mixed), L2 = lum(bg);
      const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const large = size >= 24 || (size >= 18.66 && +s.fontWeight >= 700);
      const need = large ? 3 : 4.5;
      if (ratio < need) {
        const key = 'contrast' + label(el);
        if (!seen.has(key)) { seen.add(key); issues.push({ type: '文字が読みにくい（コントラスト不足）', el: label(el), detail: `比 ${ratio.toFixed(2)}（必要 ${need}）` }); }
      }
    }
    if (size < 12) {
      const key = 'small' + label(el);
      if (!seen.has(key)) { seen.add(key); issues.push({ type: '文字が小さすぎる', el: label(el), detail: `${size}px（12px以上を推奨）` }); }
    }
  }

  // 押せる部品の大きさ（指で押すには44px程度ほしい）
  for (const el of document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button]')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 44 || r.height < 44) {
      if (el.type === 'checkbox' || el.type === 'radio') {
        if (el.closest('label')) continue; // ラベルごと押せるならOK
      }
      issues.push({ type: '押す部分が小さい', el: label(el), detail: `${Math.round(r.width)}×${Math.round(r.height)}px（44×44px以上を推奨）` });
    }
  }

  // はみ出し
  const docW = document.documentElement.clientWidth;
  if (document.documentElement.scrollWidth > docW + 1) {
    issues.push({ type: '横にはみ出している（横スクロールが出る）', el: 'ページ全体', detail: `幅 ${document.documentElement.scrollWidth}px > 画面 ${docW}px` });
  }
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right > docW + 1 && getComputedStyle(el).position !== 'fixed') {
      const overflowParent = el.parentElement && ['auto', 'scroll', 'hidden'].includes(getComputedStyle(el.parentElement).overflowX);
      if (!overflowParent) { issues.push({ type: '画面の右にはみ出した部品', el: label(el), detail: `右端 ${Math.round(r.right)}px` }); break; }
    }
    if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === 'hidden' && getComputedStyle(el).textOverflow !== 'ellipsis' && el.innerText) {
      issues.push({ type: '文字が切れている可能性', el: label(el), detail: '中身が枠より広く、隠れています' });
    }
  }

  // 画像の代替テキスト、ラベルのない入力欄
  for (const img of document.querySelectorAll('img')) {
    if (visible(img) && !img.hasAttribute('alt')) issues.push({ type: '画像にalt（説明文）がない', el: label(img) });
  }
  for (const inp of document.querySelectorAll('input:not([type=hidden]):not([type=button]):not([type=submit]), select, textarea')) {
    if (!visible(inp)) continue;
    const named = inp.labels?.length || inp.getAttribute('aria-label') || inp.getAttribute('aria-labelledby') || inp.title;
    if (!named) issues.push({ type: '入力欄に名前（label）がない', el: label(inp), detail: inp.placeholder ? `placeholderのみ「${inp.placeholder}」` : '' });
  }

  // 使われている書体と色の数（多すぎると散らかって見える）
  const fonts = new Set(), sizes = new Set(), colors = new Set();
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el)) continue;
    const s = getComputedStyle(el);
    fonts.add(s.fontFamily.split(',')[0].trim());
    sizes.add(s.fontSize);
    colors.add(s.color);
    if (parse(s.backgroundColor)?.a > 0) colors.add(s.backgroundColor);
  }
  return {
    issues,
    stats: { 書体: [...fonts], 文字サイズの種類: sizes.size, 文字サイズ: [...sizes].sort((a, b) => parseFloat(a) - parseFloat(b)), 色の種類: colors.size },
  };
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  fs.mkdirSync(args.out, { recursive: true });
  const browser = await chromium.launch();
  const report = { target: args.target, shots: [] };
  const steps = args.clicks.length ? args.clicks : [null];

  for (const scheme of SCHEMES) {
    for (const vp of VIEWPORTS) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, colorScheme: scheme, deviceScaleFactor: 1, locale: 'ja-JP', timezoneId: 'Asia/Tokyo' });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e.message || e)));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      await page.goto(args.target, { waitUntil: 'networkidle' }).catch(() => page.goto(args.target));
      await page.waitForTimeout(400);
      for (const code of args.evals) {
        try { await page.evaluate(`(async () => { ${code}\n })()`); await page.waitForTimeout(300); }
        catch (e) { errors.push('--eval の実行に失敗: ' + e.message); }
      }

      for (const [i, sel] of steps.entries()) {
        let stepName = 'initial';
        if (sel) {
          stepName = sel.replace(/[^\w぀-ヿ一-鿿-]+/g, '_').replace(/^_|_$/g, '') || `step${i}`;
          try { await page.click(sel, { timeout: 3000 }); await page.waitForTimeout(300); }
          catch (e) { report.shots.push({ scheme, viewport: vp.name, step: stepName, error: `クリックできません: ${sel}` }); continue; }
        }
        const base = path.join(args.out, `${String(i).padStart(2, '0')}-${stepName}-${vp.name}-${scheme}`);
        const file = base + '.png';          // 操作した直後に実際に見える1画面（スクロール位置もそのまま）
        const full = base + '-full.png';     // ページ全体（固定・追従する部品はページの流れに戻して、隠れる部分が出ないようにする）
        await page.screenshot({ path: file });
        const pos = await page.evaluate(() => {
          const y = window.scrollY;
          const changed = [];
          for (const el of document.querySelectorAll('body *')) {
            const p = getComputedStyle(el).position;
            if (p === 'fixed' || p === 'sticky') { changed.push([el, el.style.position]); el.style.position = 'static'; }
          }
          window.__restore = () => { for (const [el, v] of changed) el.style.position = v; window.scrollTo(0, y); };
          return changed.length;
        });
        await page.screenshot({ path: full, fullPage: true });
        await page.evaluate(() => window.__restore());
        void pos;
        const result = await page.evaluate(audit);
        report.shots.push({ scheme, viewport: vp.name, step: stepName, file, full, ...result });
      }
      if (errors.length) report.shots.push({ scheme, viewport: vp.name, consoleErrors: [...new Set(errors)] });
      await ctx.close();
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(args.out, 'report.json'), JSON.stringify(report, null, 2));

  // 要約（同じ問題はまとめる）
  const tally = new Map();
  for (const s of report.shots) {
    for (const iss of s.issues || []) {
      const k = `${iss.type} | ${iss.el}`;
      const e = tally.get(k) || { ...iss, where: new Set() };
      e.where.add(`${s.viewport}/${s.scheme}${s.step !== 'initial' ? '/' + s.step : ''}`);
      tally.set(k, e);
    }
  }
  console.log(`撮影: ${report.shots.filter((s) => s.file).length}枚 → ${path.resolve(args.out)}`);
  for (const s of report.shots) if (s.error) console.log('⚠ ' + s.error);
  for (const s of report.shots) if (s.consoleErrors) console.log(`⚠ JSエラー(${s.viewport}/${s.scheme}): ${s.consoleErrors.join(' / ')}`);
  console.log(`\n機械チェックで見つかった問題: ${tally.size}件`);
  for (const e of tally.values()) {
    const total = report.shots.filter((s) => s.file).length;
    const where = e.where.size === total ? '全画面' : [...e.where].slice(0, 4).join(', ') + (e.where.size > 4 ? ` 他${e.where.size - 4}` : '');
    console.log(`- ${e.type}: ${e.el}${e.detail ? ' — ' + e.detail : ''} [${where}]`);
  }
  console.log('\n画面ごとの書体・文字サイズ・色の数（スマホ・ライト）:');
  for (const s of report.shots) {
    if (!s.stats || s.viewport !== 'phone' || s.scheme !== 'light') continue;
    const st = s.stats;
    console.log(`- ${s.step}: 書体 ${st.書体.join(', ')} / 文字サイズ ${st.文字サイズの種類}種類 (${st.文字サイズ.join(' ')}) / 色 ${st.色の種類}種類`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
