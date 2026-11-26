"use strict";
/* 買ってよかった？（満足度） */
const FEEL={good:{l:'よかった',c:'var(--feel-good)',bg:'var(--feel-good-bg)',bar:'#83B49D'},meh:{l:'ふつう',c:'var(--feel-meh)',bg:'var(--feel-meh-bg)',bar:'#C3CFC8'},bad:{l:'モヤっと',c:'var(--feel-bad)',bg:'var(--feel-bad-bg)',bar:'#D99A8B'}};
function faceSVG(k,s=22){const f=FEEL[k];if(!f)return '';const m=k==='good'?'<path d="M8 14.2q4 3.6 8 0"/>':k==='meh'?'<path d="M8.6 15h6.8"/>':'<path d="M8 16.2q4-3 8 0"/>';const eyes=k==='good'?'<path d="M7.4 10.4q1.6-1.8 3.2 0M13.4 10.4q1.6-1.8 3.2 0"/>':'<circle cx="9" cy="10" r=".7"/><circle cx="15" cy="10" r=".7"/>';return `<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true" style="flex:none;color:${f.c}"><circle cx="12" cy="12" r="11" fill="${f.bg}"/><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">${eyes}${m}</g></svg>`}
const feelButtons=t=>['good','meh','bad'].map(k=>`<button type="button" class="feelb" data-act="feel" data-id="${esc(t.id)}" data-v="${k}" aria-pressed="${t.feel===k}">${faceSVG(k,24)}<span>${FEEL[k].l}</span></button>`).join('');
function feelTotals(from,to){const o={good:0,meh:0,bad:0,none:0,n:{good:0,meh:0,bad:0}};for(const t of S.txns){if(!inRange(t,from,to))continue;const e=netExpense(t);if(!e)continue;if(FEEL[t.feel]){o[t.feel]+=e;o.n[t.feel]++}else o.none+=e}return o}
const unratedRecent=()=>{const since=ymd(new Date(Date.now()-6*864e5)),t0=today();return S.txns.filter(t=>t.date>=since&&t.date<=t0&&t.type==='expense'&&live(t)&&!t.feel&&!t.recurringId)};
function feelSection(r){
  const f=feelTotals(r.from,r.to);const rated=f.good+f.meh+f.bad;const all=rated+f.none;if(!all)return '';
  if(!rated)return `<section class="section"><div class="sec-h"><h2 class="s">買ってよかった？</h2></div><div class="card"><div class="row" style="align-items:flex-start">${faceSVG('meh',32)}<p class="sub" style="margin:0;font-size:14px">ホームや記録の詳細で「よかった／ふつう／モヤっと」を答えると、この期間のモヤっと出費がここにまとまります。</p></div></div></section>`;
  const bads=S.txns.filter(t=>inRange(t,r.from,r.to)&&t.feel==='bad'&&netExpense(t)).sort((a,b)=>netExpense(b)-netExpense(a));
  const bc={};bads.forEach(t=>bc[t.category]=(bc[t.category]||0)+netExpense(t));const topc=Object.entries(bc).sort((a,b)=>b[1]-a[1])[0];
  return `<section class="section"><div class="sec-h"><h2 class="s">買ってよかった？</h2><span class="sub num">評価済み ${Math.round(rated/all*100)}%</span></div><div class="card">
   <div class="row" style="gap:12px">${faceSVG('bad',40)}<div style="min-width:0"><div class="label">モヤっと出費</div><div class="num" style="font-size:24px;font-weight:600;line-height:1.25">${yen(f.bad)} <span class="sub" style="font-size:13px">${f.n.bad}件</span></div></div></div>
   <div class="feelseg" role="img" aria-label="${['good','meh','bad'].map(k=>`${FEEL[k].l} ${Math.round(f[k]/rated*100)}%`).join('、')}">${['good','meh','bad'].filter(k=>f[k]).map(k=>`<i style="width:${f[k]/rated*100}%;background:${FEEL[k].bar}"></i>`).join('')}</div>
   <div style="margin-top:6px">${['good','meh','bad'].map(k=>`<div class="between" style="padding:7px 0;border-bottom:1px solid var(--border)"><span class="row" style="gap:8px">${faceSVG(k,20)}${FEEL[k].l}</span><span class="num"><span class="sub">${rated?Math.round(f[k]/rated*100):0}%</span> <b style="display:inline-block;min-width:76px;text-align:right">${yen(f[k])}</b></span></div>`).join('')}</div>
   ${topc?`<p class="sub" style="margin:12px 0 4px;font-size:13px">モヤっとがいちばん多いのは「${esc(catBy(topc[0]).name)}」（${yen(topc[1])}）。次に同じ場面が来たら、ひと呼吸おいてみよう。</p>`:''}
   ${bads.length?`<div>${bads.slice(0,3).map(txRow).join('')}</div>`:''}
  </div></section>`;
}
