"use strict";
/* ---------- History ---------- */
function histRange(){const h=S.hist;if(h.period==='month')return rangeOf('month');if(h.period==='last')return rangeOf('month',-1);if(h.period==='3m'){const a=rangeOf('month',-2);return {from:a.from,to:rangeOf('month').to}}if(h.period==='custom')return {from:h.from,to:h.to};return {from:'',to:''}}
function historyView(){
  const h=S.hist;const st=settings();
  const head=`<div class="topbar"><span class="logo">monee.</span></div><h1 class="h" style="margin-bottom:16px">履歴</h1>`;
  const controls=`<div class="stack" style="gap:10px">
   <label style="display:block;position:relative"><span class="sr-only">店名・品名・メモで検索</span><span style="position:absolute;left:12px;top:13px;color:var(--text-secondary)">${ic('search')}</span><input id="hq" class="input" style="padding-left:42px" type="search" placeholder="店名・品名・メモで検索" value="${esc(h.q)}"></label>
   <div class="chips" role="group" aria-label="期間">${[['month','今月'],['last','先月'],['3m','3か月'],['all','すべて'],['custom','期間指定']].map(([k,l])=>`<button class="chip" aria-pressed="${h.period===k}" data-act="hp" data-v="${k}">${l}</button>`).join('')}</div>
   ${h.period==='custom'?`<div class="grid2"><label class="field"><span>開始日</span><input id="hfrom" class="input" type="date" value="${esc(h.from)}"></label><label class="field"><span>終了日</span><input id="hto" class="input" type="date" value="${esc(h.to)}"></label></div>`:''}
   <div class="grid2 hsel">
    <label class="field"><span class="sr-only">種類</span><select id="htype" class="input"><option value="all">すべての種類</option>${['expense','income','transfer'].map(k=>`<option value="${k}" ${h.type===k?'selected':''}>${TYPE_L[k]}</option>`).join('')}</select></label>
    <label class="field"><span class="sr-only">カテゴリ</span><select id="hcat" class="input"><option value="">すべてのカテゴリ</option>${st.categories.map(c=>`<option value="${esc(c.id)}" ${h.cat===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label>
    <label class="field"><span class="sr-only">支払い方法</span><select id="hmethod" class="input"><option value="">すべての支払い方法</option>${st.methods.map(x=>`<option ${h.method===x?'selected':''}>${esc(x)}</option>`).join('')}</select></label>
   </div></div>`;
  if(!ready()&&!S.txns.length)return head+controls+`<div style="margin-top:16px">`+skeleton()+'</div>';
  const {from,to}=histRange();const q=norm(h.q);
  const list=S.txns.filter(t=>inRange(t,from,to)&&(h.type==='all'||t.type===h.type)&&(!h.cat||t.category===h.cat||(t.items||[]).some(i=>i.category===h.cat))&&(!h.method||t.method===h.method||t.toMethod===h.method)&&(!q||norm(t.merchant).includes(q)||norm(t.note).includes(q)||(t.items||[]).some(i=>norm(i.name).includes(q))));
  const exp=list.reduce((a,t)=>a+netExpense(t),0),inc=list.reduce((a,t)=>a+incomeOf(t),0);
  const lim=h.limit||120;const groups={};list.slice(0,lim).forEach(t=>(groups[t.date]=groups[t.date]||[]).push(t));
  const body=list.length?`<div class="row sub num" style="margin:14px 4px 0;gap:16px"><span>${list.length}件</span><span>支出 ${yen(exp)}</span><span>収入 ${yen(inc)}</span></div>`+Object.entries(groups).map(([d,ts])=>{const de=ts.reduce((a,t)=>a+netExpense(t),0);return `<div class="daygrp"><div class="dh"><span>${fmtDay(d)}</span>${de?`<span class="num">−${yen(de)}</span>`:''}</div><div class="card" style="padding:4px 14px">${ts.map(txRow).join('')}</div></div>`}).join('')+(list.length>lim?`<button class="btn ghost block more" data-act="hmore">さらに表示（残り${list.length-lim}件）</button>`:'')
   :`<div class="card" style="margin-top:16px">${S.txns.length?emptyState('search','見つかりませんでした','条件を変えるか、検索ワードを短くしてみてください。',`<button class="btn ghost sm" data-act="hreset">条件をリセット</button>`):emptyState('receipt','まだ記録がありません','記録すると、日付ごとにここへ並びます。',`<a class="btn primary" href="#add">${ic('plus','sm')}記録する</a>`)}</div>`;
  return head+slowNote()+controls+body;
}
function detailSheet(id){
  const t=S.txns.find(x=>x.id===id);if(!t)return;
  const c=catBy(t.category);const its=t.items||[];
  const statusTxt=STATUS_L[t.status]||'確定';
  const html=`${sheetHead(t.merchant||TYPE_L[t.type])}
  <div class="row" style="margin-bottom:16px">${t.type==='transfer'?'':catIcon(c)}<div style="flex:1;min-width:0"><div class="big num" style="font-size:30px">${syen(t.amount,t.type==='income'?1:t.type==='transfer'?0:-1)}</div>${toInt(t.refunded)?`<div class="sub num">返金 ${yen(t.refunded)} ／ 実質 ${yen(toInt(t.amount)-toInt(t.refunded))}</div>`:''}</div><span class="pill ${t.status==='draft'?'warn':t.status&&t.status!=='confirmed'?'gray':''}">${statusTxt}</span></div>
  <dl class="kv"><dt>種類</dt><dd>${TYPE_L[t.type]||'—'}</dd><dt>日時</dt><dd>${fmtDay(t.date)}${t.time?' '+esc(t.time):''}</dd>${t.type!=='transfer'?`<dt>カテゴリ</dt><dd>${esc(c.name)}</dd>`:''}<dt>${t.type==='transfer'?'移動':'支払い方法'}</dt><dd>${esc(t.method||'—')}${t.type==='transfer'?' → '+esc(t.toMethod||'—'):''}</dd>${t.note?`<dt>メモ</dt><dd>${esc(t.note)}</dd>`:''}<dt>記録元</dt><dd>${esc(SRC_L[t.source]||'手入力')}</dd></dl>
  ${t.type==='expense'&&live(t)?`<div style="margin-top:16px"><div class="label" style="margin-bottom:2px">買ってよかった？</div><div class="feels" style="margin-top:6px">${feelButtons(t)}</div></div>`:''}
  ${optCall('detailExtra',t).join('')}
  ${t.receiptAssetId?`<div style="margin-top:16px"><img class="receipt-img" alt="レシート画像" src="/_blob/${encodeURIComponent(t.receiptAssetId)}"></div>`:''}
  ${its.length?`<h3 class="s" style="font-size:15px;margin:18px 0 6px">明細（${its.length}点）</h3><table class="items-t"><thead><tr><th>品名</th><th style="text-align:right">数量</th><th style="text-align:right">単価</th><th style="text-align:right">小計</th></tr></thead><tbody>${its.map(i=>`<tr><td><div class="ell" style="max-width:150px">${esc(i.name)}</div>${i.category&&i.category!==t.category?`<span class="sub">${esc(catBy(i.category).name)}</span>`:''}</td><td class="num" style="text-align:right">${toInt(i.qty)||1}</td><td class="num" style="text-align:right">${i.unit!=null&&i.unit!==''?yen(i.unit):'—'}</td><td class="num" style="text-align:right">${yen(i.total)}</td></tr>`).join('')}</tbody></table>
   <table class="recon" style="margin-top:6px">${toInt(t.discount)?`<tr><td>値引き</td><td class="num">−${yen(t.discount)}</td></tr>`:''}${toInt(t.tax)?`<tr><td>消費税${t.taxIncluded?'（内税）':'（外税）'}</td><td class="num">${yen(t.tax)}</td></tr>`:''}<tr><td><b>合計</b></td><td class="num"><b>${yen(t.amount)}</b></td></tr></table>`:''}
  ${(t.refunds||[]).length?`<h3 class="s" style="font-size:15px;margin:18px 0 6px">返金履歴</h3>${t.refunds.map(r=>`<div class="between sub num"><span>${fmtDay(r.date)}</span><span>${yen(r.amount)}</span></div>`).join('')}`:''}
  <div class="stack" style="margin-top:20px;gap:10px">
   ${t.status==='draft'?`<button class="btn primary block" data-act="confirmdraft" data-id="${esc(t.id)}">${ic('check','sm')}確定して集計に入れる</button>`:''}
   ${t.type==='expense'||t.type==='income'?`<button class="btn soft block" data-act="again" data-id="${esc(t.id)}">${ic('repeat','sm')}同じ内容でもう一度記録</button>`:''}
   <button class="btn ghost block" data-act="edit" data-id="${esc(t.id)}">${ic('pencil','sm')}編集する</button>
   ${t.type==='expense'&&t.status!=='cancelled'&&toInt(t.refunded)<toInt(t.amount)?`<div class="grid2"><button class="btn ghost" data-act="refund" data-id="${esc(t.id)}">${ic('undo','sm')}返金を記録</button><button class="btn ghost" data-act="cancel" data-id="${esc(t.id)}">${ic('x','sm')}取消にする</button></div>`:''}
   ${t.status==='cancelled'?`<button class="btn ghost block" data-act="uncancel" data-id="${esc(t.id)}">${ic('undo','sm')}取消を戻す</button>`:''}
   <button class="btn danger block" data-act="delete" data-id="${esc(t.id)}">${ic('trash','sm')}削除する</button>
  </div>`;
  openSheet(html,{label:'記録の詳細'});
}
function refundSheet(id){
  const t=S.txns.find(x=>x.id===id);if(!t)return;const max=toInt(t.amount)-toInt(t.refunded);
  openSheet(`${sheetHead('返金を記録')}<p class="sub" style="margin-top:0">${esc(t.merchant||'')}（${yen(t.amount)}）への返金です。一部だけの返金にも対応しています。</p>
  <div class="stack"><label class="field"><span>返金額（最大 ${yen(max)}）</span><div class="amount-wrap"><input id="rfa" class="input amount-in num" inputmode="numeric" value="${max}"></div></label><label class="field"><span>返金日</span><input id="rfd" class="input" type="date" value="${today()}"></label>
  <div id="rferr" class="sub" style="color:var(--danger)" role="alert"></div><button class="btn primary block" id="rfok">返金を保存</button></div>`,{narrow:true,label:'返金を記録'});
  $('#rfok').onclick=async e=>{const a=toInt($('#rfa').value);if(a<=0||a>max){$('#rferr').textContent=`1〜${yen(max)}の範囲で入力してください。`;return}
    const refunded=toInt(t.refunded)+a;const next={...t,refunded,refunds:[...(t.refunds||[]),{amount:a,date:$('#rfd').value||today()}],status:refunded>=toInt(t.amount)?'refunded':'partial',updatedAt:new Date().toISOString()};delete next.id;
    busy(e.currentTarget,true);try{await saveTxn(t.id,next);closeSheet();toast(`${yen(a)}の返金を記録しました`)}catch(err){busy(e.currentTarget,false);toast(writeErr(err),{err:true})}};
}

