"use strict";
/* いくつかの画面で使う部品 */
function breakdown(list,total,linkMonth=true){
  if(!total)return emptyState('chart','まだ支出がありません','記録すると、カテゴリごとの内訳がここに表示されます。');
  return `<div class="segbar" role="img" aria-label="${esc(list.map(x=>`${x.c.name} ${Math.round(x.amt/total*100)}%`).join('、'))}">${list.map(x=>`<i style="width:${x.amt/total*100}%;background:${esc(x.c.color)}"></i>`).join('')}</div>
  <ul class="legend">${list.map(x=>`<li><button data-act="catfilter" data-cat="${esc(x.c.id)}" ${linkMonth?'':'data-keep="1"'}><span class="dot" style="background:${esc(x.c.color)}"></span><span class="ell" style="flex:1">${esc(x.c.name)}</span><span class="sub num" style="width:44px;text-align:right">${Math.round(x.amt/total*100)}%</span><span class="num" style="font-weight:600;min-width:84px;text-align:right">${yen(x.amt)}</span>${ic('right','sm')}</button></li>`).join('')}</ul>`;
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
