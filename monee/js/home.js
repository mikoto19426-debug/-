"use strict";
/* ---------- Home ---------- */
function greet(){const h=new Date().getHours();return h<5?'こんばんは':h<11?'おはようございます':h<18?'こんにちは':'こんばんは'}
function budgetCard(){
  const st=settings();const m=rangeOf('month');const {exp}=totals(m.from,m.to);
  if(!st.budget)return `<section class="card budget enter" aria-labelledby="bh"><div class="between"><h2 class="s" id="bh">今月の予算</h2>${ic('wallet')}</div><p class="muted" style="margin:8px 0 14px;font-size:14px">予算を決めると、残りの金額と使ったペースがひと目でわかります。今月の支出は <b class="num">${yen(exp)}</b> です。</p><button class="btn primary" data-act="budget">${ic('plus','sm')}予算を設定する</button></section>`;
  const b=toInt(st.budget);const pct=b?exp/b*100:0;const over=exp>b;const warn=!over&&pct>=st.alertAt;
  const left=b-exp;const daysLeft=m.b.getDate()-new Date().getDate()+1;
  return `<section class="card budget ${over?'over':warn?'warn':''} enter" aria-labelledby="bh">
    <div class="between"><h2 class="label" id="bh" style="margin:0;font-size:13px">${over?'今月の予算を超過':'今月の残り予算'}</h2>${over?`<span class="pill danger">${ic('alert','sm')}超過</span>`:warn?`<span class="pill warn">${ic('alert','sm')}${Math.round(pct)}%使用</span>`:`<span class="pill">${Math.round(pct)}%使用</span>`}</div>
    <div class="big num">${over?`${yen(-left)} <span style="font-size:16px;font-weight:600">オーバー</span>`:yen(left)}</div>
    <div class="bar" role="progressbar" aria-label="予算の使用率" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100,Math.round(pct))}" aria-valuetext="${Math.round(pct)}%"><i style="width:${clamp(pct,0,100)}%"></i></div>
    <div class="between sub num"><span>使った金額 ${yen(exp)}</span><span>予算 ${yen(b)}</span></div>
    ${!over&&left>0&&daysLeft>0?`<div class="sub" style="margin-top:6px">残り${daysLeft}日・1日あたり約 <span class="num">${yen(Math.floor(left/daysLeft))}</span></div>`:''}
    ${!over?(()=>{const dim=m.b.getDate(),dn=new Date().getDate();const pd=exp-Math.round(b*dn/dim);return `<div class="sub ${pd>0?'pace-warn':'pace-ok'}" style="margin-top:2px">${pd>0?`理想のペースより <span class="num">${yen(pd)}</span> 多めです`:`理想のペースより <span class="num">${yen(-pd)}</span> 少なめ。いい調子です`}</div>`})():''}
  </section>`;
}
function summaryCards(){
  const m=rangeOf('month'),p=prevSameElapsed('month',0);const c=totals(m.from,m.to),l=totals(p.from,p.to);
  const cmp=(a,b,goodUp)=>{if(!b)return '<span class="sub">先月の記録なし</span>';const d=a-b;const bad=goodUp?d<0:d>0;return `<span class="sub" style="display:inline-flex;align-items:center;gap:2px;${!d?'':bad?'color:var(--warn-text)':'color:var(--primary)'}">${ic(d>0?'up':'down','sm')}先月の同じ日まで比 ${syen(d,d>0?1:d<0?-1:0)}</span>`};
  return `<div class="grid2 enter"><div class="sum in"><div class="label">今月の収入</div><div class="v num">${yen(c.inc)}</div>${cmp(c.inc,l.inc,true)}</div><div class="sum out"><div class="label">今月の支出</div><div class="v num">${yen(c.exp)}</div>${cmp(c.exp,l.exp,false)}</div></div>`;
}
function breakdown(list,total,linkMonth=true){
  if(!total)return emptyState('chart','まだ支出がありません','記録すると、カテゴリごとの内訳がここに表示されます。');
  return `<div class="segbar" role="img" aria-label="${esc(list.map(x=>`${x.c.name} ${Math.round(x.amt/total*100)}%`).join('、'))}">${list.map(x=>`<i style="width:${x.amt/total*100}%;background:${esc(x.c.color)}"></i>`).join('')}</div>
  <ul class="legend">${list.map(x=>`<li><button data-act="catfilter" data-cat="${esc(x.c.id)}" ${linkMonth?'':'data-keep="1"'}><span class="dot" style="background:${esc(x.c.color)}"></span><span class="ell" style="flex:1">${esc(x.c.name)}</span><span class="sub num" style="width:44px;text-align:right">${Math.round(x.amt/total*100)}%</span><span class="num" style="font-weight:600;min-width:84px;text-align:right">${yen(x.amt)}</span>${ic('right','sm')}</button></li>`).join('')}</ul>`;
}
function notices(){
  const st=settings();const out=[];const m=rangeOf('month');const {exp}=totals(m.from,m.to);
  const pend=S.inbox.filter(x=>x.status==='pending'||(x.status==='snoozed'&&(x.snoozeUntil||'')<=today()));
  if(pend.length)out.push(`<button class="notice info" style="width:100%;text-align:left;border:1px solid var(--info-border)" data-go="add">${ic('mail')}<div style="flex:1"><b>確認待ちの候補が${pend.length}件</b><div class="sub">メールなどから見つかった支出です。確認してから保存されます。</div></div>${ic('right','sm')}</button>`);
  if(st.budget&&exp>toInt(st.budget))out.push(`<div class="notice danger">${ic('alert')}<div><b>予算を${yen(exp-toInt(st.budget))}超えています</b><div class="sub">残りの日は大きな出費を控えめに。</div></div></div>`);
  else if(st.budget&&exp/toInt(st.budget)*100>=st.alertAt)out.push(`<div class="notice warn">${ic('alert')}<div><b>予算の${Math.round(exp/toInt(st.budget)*100)}%を使いました</b><div class="sub">残りは ${yen(toInt(st.budget)-exp)} です。</div></div></div>`);
  for(const x of catBudgets(m.from,m.to).slice(0,3)){if(x.used>x.bud)out.push(`<div class="notice danger">${ic('alert')}<div><b>${esc(x.c.name)}が予算を${yen(x.used-x.bud)}超えました</b><div class="sub num">${yen(x.used)} ／ 予算 ${yen(x.bud)}</div></div></div>`);else if(x.pct>=st.alertAt)out.push(`<div class="notice warn">${ic('alert')}<div><b>${esc(x.c.name)}が予算の${Math.round(x.pct)}%に達しました</b><div class="sub num">残り ${yen(x.bud-x.used)}</div></div></div>`)}
  const drafts=S.txns.filter(t=>t.status==='draft');
  if(drafts.length)out.push(`<button class="notice warn" style="width:100%;text-align:left" data-act="drafts">${ic('pencil')}<div style="flex:1"><b>下書きが${drafts.length}件あります</b><div class="sub">確定するまで集計には入りません。</div></div>${ic('right','sm')}</button>`);
  const d=new Date().getDate();
  for(const r of st.recurring){if(toInt(r.day)>d)continue;const has=S.txns.some(t=>t.recurringId===r.id&&inRange(t,m.from,m.to));if(!has)out.push(`<div class="notice plain">${ic('repeat')}<div style="flex:1"><b>${esc(r.name)}（${yen(r.amount)}）</b><div class="sub">毎月${toInt(r.day)}日の定期支払いが今月まだ記録されていません。</div></div><button class="btn soft sm" data-act="recur" data-id="${esc(r.id)}">記録</button></div>`)}
  // simple observation from real data
  const p=rangeOf('month',-1);const cur=totals(m.from,m.to).byCat,prev=totals(p.from,p.to).byCat;
  const dayN=new Date().getDate(),dim=m.b.getDate();
  for(const x of cur){const pv=prev.find(y=>y.cat===x.cat);if(pv&&x.amt>pv.amt&&x.amt>=3000){out.push(`<div class="notice plain">${ic('sparkles')}<div><b>${esc(x.c.name)}が先月の合計を上回りました</b><div class="sub num">今月 ${yen(x.amt)} ／ 先月 ${yen(pv.amt)}（${dayN}日目時点）</div></div></div>`);break}}
  return out;
}
function txRow(t){
  const c=catBy(t.type==='expense'||t.type==='income'?t.category:'');const isT=t.type==='transfer';
  const cls=t.status==='cancelled'?'strike':t.type==='income'?'in':isT?'tr':'out';
  const sign=isT?0:t.type==='income'?1:-1;
  const shown=t.type==='expense'?toInt(t.amount)-toInt(t.refunded):toInt(t.amount);
  const n=(t.items||[]).length;
  const meta=[isT?`${esc(t.method||'')} → ${esc(t.toMethod||'')}`:esc(c.name),t.time?esc(t.time):'',!isT&&t.method?esc(t.method):'',n?`${n}点`:''].filter(Boolean).map(x=>`<span>${x}</span>`).join('');
  const st=(STATUS_L[t.status]?`<span class="pill ${t.status==='draft'?'warn':'gray'}" style="padding:1px 7px">${STATUS_L[t.status]}</span>`:'')+(FEEL[t.feel]&&t.type==='expense'?faceSVG(t.feel,15):'');
  return `<button class="tx" data-act="detail" data-id="${esc(t.id)}">${isT?`<span class="cat-ic" style="background:#C3CFC8" aria-hidden="true">${ic('transfer','sm')}</span>`:catIcon(c)}<span class="mid"><span class="t1 ell" style="display:block">${esc(t.merchant||TYPE_L[t.type]||'記録')}</span><span class="t2">${meta}${st}</span></span><span class="amt num ${cls}">${syen(shown,t.status==='cancelled'?0:sign)}</span></button>`;
}
const favBtn=t=>{const c=catBy(t.category);return `<button class="fav" data-act="fav" data-id="${esc(t.id)}" aria-label="${esc(t.merchant)} ${yen(t.amount)}を今日の記録に追加">${catIcon(c)}<span style="min-width:0"><span class="fn ell" style="display:block">${esc(t.merchant)}</span><span class="fa num">${yen(t.amount)}</span></span></button>`};
function quickCard(){
  const fv=favorites();
  return `<section class="card sm quick enter" aria-labelledby="qh"><div class="between"><h2 class="s" id="qh" style="font-size:16px">すばやく記録</h2><button class="btn primary sm" data-act="quick">${ic('plus','sm')}金額を入れる</button></div>
  ${fv.length?`<div><div class="label" style="margin-bottom:6px">いつもの（タップで今日の記録に追加）</div><div class="favs">${fv.map(favBtn).join('')}</div></div>`:`<p class="sub" style="margin:0">同じ店・同じ金額を2回以上記録すると、ここからワンタップで記録できるようになります。</p>`}</section>`;
}
function homeView(){
  const st=settings();const d=new Date();
  const head=`<div class="topbar"><span class="logo">monee.</span></div><div style="margin-bottom:20px"><div class="sub">${d.getMonth()+1}月${d.getDate()}日（${WD[d.getDay()]}）</div><h1 class="h">${greet()}${st.name?`、${esc(st.name)}さん`:''}</h1>${S.txns.length?'':'<p class="tagline" style="margin:8px 0 0">Your money bestie. A period on mindless spending.</p>'}</div>`;
  if(!ready()&&!S.txns.length)return head+slowNote()+skeleton();
  const m=rangeOf('month');const t=totals(m.from,m.to);const ns=notices();
  const recent=S.txns.slice(0,6);
  return head+slowNote()+dotHero()+`<div class="cols home"><div><div class="stack">${budgetCard()}${quickCard()}${gamanCard()}${summaryCards()}</div>
  <section class="section"><div class="sec-h"><h2 class="s">今月の内訳</h2><a class="link" href="#insights">分析${ic('right','sm')}</a></div><div class="card enter">${breakdown(t.byCat,t.exp)}</div></section></div>
  <div>${ns.length?`<section class="section"><div class="sec-h"><h2 class="s">お知らせ</h2></div><div class="stack">${ns.join('')}</div></section>`:''}
  ${feelCard()}
  <section class="section"><div class="sec-h"><h2 class="s">最近の記録</h2>${S.txns.length?`<a class="link" href="#history">すべて見る${ic('right','sm')}</a>`:''}</div><div class="card enter" style="padding:6px 16px">${recent.length?recent.map(txRow).join(''):emptyState('receipt','まだ記録がありません','レシートを撮るか、AIチャットに「カフェで680円」と送るだけで記録できます。',`<a class="btn primary" href="#add">${ic('plus','sm')}最初の記録をする</a>`)}</div></section></div></div>`;
}

