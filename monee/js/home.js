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
/* ホームは3つだけ：①ドット＋予算 ②記録する ③今日の問いかけ（ひとつ） */
function quickCard(){
  const fv=favorites();const t0=today();const td=S.txns.filter(t=>t.date===t0&&netExpense(t));const sum=td.reduce((a,t)=>a+netExpense(t),0);
  return `<section class="card sm quick enter" aria-labelledby="qh"><div class="between"><h2 class="s" id="qh" style="font-size:16px">記録する</h2><a class="link" href="#history">今日 <span class="num">${yen(sum)}</span>・${td.length}件${ic('right','sm')}</a></div>
  <div class="grid2"><button class="btn primary" data-act="quick">${ic('plus','sm')}金額を入れる</button><button class="btn ghost" data-act="gaman">${ic('piggy','sm')}がまんした</button></div>
  ${fv.length?`<div><div class="label" style="margin-bottom:6px">いつもの（タップで今日の記録に追加）</div><div class="favs">${fv.map(favBtn).join('')}</div></div>`:''}</section>`;
}
function todayQuestion(){ // 問いかけは1つだけ。①昨日の記録 ②夕方以降の今日の記録 ③数日前の「買ってよかった？」
  const t0=today(),y=ymd(new Date(Date.now()-864e5)),first=firstRecordDate();
  const askDay=(ds,label)=>`<section class="card sm ask enter" aria-labelledby="ah"><h2 class="label" id="ah" style="margin:0 0 4px">今日の問いかけ</h2><div style="font-weight:600">${label}は何か買った？</div><div class="sub">まだ記録がありません。使っていなければ「0円でした」を押してください。</div><div class="grid2" style="margin-top:10px"><button class="btn soft" data-act="zeroday" data-d="${ds}">${ic('check','sm')}0円でした</button><button class="btn ghost" data-act="quickday" data-d="${ds}">${ic('plus','sm')}記録する</button></div></section>`;
  if(first&&first<=y&&dayState(y)==='none')return askDay(y,'昨日');
  if(new Date().getHours()>=17&&dayState(t0)==='none')return askDay(t0,'今日');
  const t=unratedRecent()[0];if(!t)return '';
  const ago=Math.round((parseD(t0)-parseD(t.date))/864e5);
  return `<section class="card sm ask enter" aria-labelledby="ah"><h2 class="label" id="ah" style="margin:0 0 4px">今日の問いかけ</h2>
   <div class="between" style="align-items:flex-start"><div style="min-width:0"><div style="font-weight:600">${ago}日前の「${esc(t.merchant||catBy(t.category).name)}」、買ってよかった？</div><div class="sub">${fmtDay(t.date)}　${esc(catBy(t.category).name)}</div></div><b class="num" style="flex:none">${yen(netExpense(t))}</b></div>
   <div class="feels">${feelButtons(t)}</div></section>`;
}
function homeView(){
  const st=settings();const d=new Date();
  const head=`<div class="topbar"><span class="logo">monee.</span></div><div style="margin-bottom:16px"><div class="sub">${d.getMonth()+1}月${d.getDate()}日（${WD[d.getDay()]}）</div><h1 class="h">${greet()}${st.name?`、${esc(st.name)}さん`:''}</h1></div>`;
  if(!ready()&&!S.txns.length)return head+slowNote()+skeleton();
  return head+slowNote()+dotHero()+`<div class="homegrid"><div>${budgetCard()}</div><div class="stack">${quickCard()}${todayQuestion()}</div></div>`;
}
