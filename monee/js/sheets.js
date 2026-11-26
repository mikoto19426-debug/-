"use strict";
/* ================= Quick sheet ================= */
function quickSheet(p={}){
  const type=p.type==='income'?'income':'expense';
  const q={type,amount:p.amount?String(toInt(p.amount)):'',merchant:p.merchant||'',category:p.category||'',method:'',date:p.date||today(),catAuto:false,dupAck:false};
  q.method=p.method||(type==='expense'?lastMethod(q.category):'');
  openSheet(`${sheetHead('すばやく記録')}<div class="stack" style="gap:14px">
   <div class="seg" role="group" aria-label="種類">${['expense','income'].map(k=>`<button type="button" aria-pressed="${q.type===k}" data-act="qtype" data-v="${k}">${TYPE_L[k]}</button>`).join('')}</div>
   <label class="field"><span class="sr-only">金額</span><div class="amount-wrap"><input id="q-amount" class="input amount-in qamt num" inputmode="numeric" autocomplete="off" placeholder="0" enterkeyhint="done" value="${esc(q.amount)}"></div></label>
   <div class="field"><span id="qcl">カテゴリ<span id="q-hint" class="hint"></span></span><div class="chips" id="q-cats" role="group" aria-labelledby="qcl"></div></div>
   <label class="field"><span>店名・内容（任意）</span><input id="q-merchant" class="input" list="dl-m" maxlength="80" autocomplete="off" placeholder="例：スターバックス" value="${esc(q.merchant)}">${merchantDL()}</label>
   <div class="grid2"><label class="field"><span>支払い方法</span><select id="q-method" class="input"><option value="">未選択</option>${settings().methods.map(x=>`<option ${q.method===x?'selected':''}>${esc(x)}</option>`).join('')}</select></label><label class="field"><span>日付</span><input id="q-date" class="input" type="date" value="${esc(q.date)}"></label></div>
   <div class="chips" role="group" aria-label="日付をすばやく選ぶ" id="q-dates"></div>
   <div id="q-err" class="sub" role="alert" style="color:var(--danger)"></div>
   <button class="btn primary block" id="q-save" data-act="qsave" style="min-height:52px">${ic('check','sm')}記録する</button>
   <button class="link" data-act="qmore" style="align-self:center">${ic('pencil','sm')}品目やメモも入力する</button>
  </div>`,{label:'すばやく記録'});
  S.q=q;drawQuick();$('#q-amount')?.focus();
}
function drawQuick(){
  const q=S.q;if(!q)return;
  const freq={};S.txns.forEach(t=>{if(t.type===q.type&&t.category)freq[t.category]=(freq[t.category]||0)+1});
  const list=cats(q.type).slice().sort((a,b)=>(freq[b.id]||0)-(freq[a.id]||0));
  const el=$('#q-cats');if(el)el.innerHTML=list.map(c=>`<button type="button" class="chip" aria-pressed="${q.category===c.id}" data-act="qcat" data-v="${esc(c.id)}"><span class="dot" style="background:${esc(c.color)}"></span>${esc(c.name)}</button>`).join('');
  const h=$('#q-hint');if(h)h.innerHTML=q.catAuto&&q.category?`${ic('sparkles','sm')}自動で選びました`:'';
  const ds=$('#q-dates');if(ds)ds.innerHTML=[[0,'今日'],[1,'昨日'],[2,'おととい']].map(([n,l])=>{const d=new Date();d.setDate(d.getDate()-n);const v=ymd(d);return `<button type="button" class="chip" aria-pressed="${q.date===v}" data-act="qdate" data-v="${v}">${l}</button>`}).join('');
  const di=$('#q-date');if(di&&di.value!==q.date)di.value=q.date;
}
async function saveQuick(btn){
  const q=S.q;if(!q)return;const err=$('#q-err');const amt=toInt(q.amount);
  if(amt<=0){err.textContent='金額を入力してください。';$('#q-amount').focus();return}
  if(!q.category){err.textContent='カテゴリを選んでください。';return}
  const d={type:q.type,amount:amt,date:q.date||today(),merchant:q.merchant,category:q.category,method:q.method};
  const dup=findDuplicates(d);
  if(dup.length&&!q.dupAck){q.dupAck=true;err.innerHTML=`同じような記録があります：${dup.map(t=>`${fmtShort(t.date)} ${esc(t.merchant||'')} ${yen(t.amount)}`).join('、')}<br>重複でなければ、もう一度「記録する」を押してください。`;return}
  const id=uid();busy(btn,true);
  try{await saveTxn(id,buildTxn(d,'quick'));closeSheet();toast(`${yen(amt)}を記録しました`,{undo:()=>S.db.collection('txns').doc(id).delete()})}catch(e){busy(btn,false);toast(writeErr(e),{err:true})}
}

/* ================= Gaman sheets ================= */
function gamanSheet(){
  const fv=favorites();const goals=settings().goals;
  openSheet(`${sheetHead('がまんした！')}<p class="sub" style="margin-top:0">買うのをやめたものを記録すると、その金額が「がまん貯金」に貯まります。</p>
  <div class="stack" style="gap:14px">
   ${fv.length?`<div><div class="label" style="margin-bottom:6px">いつものをがまん</div><div class="favs">${fv.map(t=>`<button type="button" class="fav" data-act="gpick" data-n="${esc(t.merchant)}" data-a="${toInt(t.amount)}">${catIcon(catBy(t.category))}<span style="min-width:0"><span class="fn ell" style="display:block">${esc(t.merchant)}</span><span class="fa num">${yen(t.amount)}</span></span></button>`).join('')}</div></div>`:''}
   <label class="field"><span>がまんしたもの</span><input id="g-name" class="input" maxlength="40" list="dl-m" autocomplete="off" placeholder="例：コンビニのお菓子">${merchantDL()}</label>
   <label class="field"><span>金額</span><div class="amount-wrap"><input id="g-amt" class="input amount-in num" inputmode="numeric" autocomplete="off" placeholder="0"></div></label>
   ${goals.length?`<label class="field"><span>貯金の目標にも足す（任意）</span><select id="g-goal" class="input"><option value="">足さない</option>${goals.map(g=>`<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('')}</select><span class="sub">実際に貯金箱や口座へ移したときだけ選んでください。</span></label>`:''}
   <div id="g-err" class="sub" role="alert" style="color:var(--danger)"></div>
   <button class="btn primary block" data-act="gsave" style="min-height:52px">${ic('piggy','sm')}がまん貯金に入れる</button>
  </div>`,{label:'がまんした'});
  $('#g-name')?.focus();
}
async function saveGaman(btn){
  const n=$('#g-name').value.trim(),a=toInt($('#g-amt').value),gid=$('#g-goal')?.value||'';
  if(a<=0){$('#g-err').textContent='金額を入力してください。';$('#g-amt').focus();return}
  const id=uid();busy(btn,true);let prevGoals=null;
  try{
    await S.db.collection('skips').doc(id).set({name:n||'がまん',amount:a,date:today(),goalId:gid||null,createdAt:new Date().toISOString()});
    if(gid){const st=settings();prevGoals=st.goals;await saveSettings({goals:st.goals.map(g=>g.id===gid?{...g,saved:toInt(g.saved)+a}:g)})}
    closeSheet();S.dotI=0;S.dotHopAt=Date.now();render();
    toast(`ドット：${yen(a)} 守ったね！`,{undo:async()=>{await S.db.collection('skips').doc(id).delete();if(prevGoals)await saveSettings({goals:prevGoals})}});
  }catch(e){busy(btn,false);toast(writeErr(e),{err:true})}
}
function gamanList(){
  const all=skipTotals('','');
  openSheet(`${sheetHead('がまん貯金の記録')}<div class="row" style="gap:14px;margin-bottom:8px">${jarSVG(all.n)}<div><div class="label">これまでの合計</div><div class="num" style="font-size:28px;font-weight:600">${yen(all.amt)}</div><div class="sub">${all.n}回がまんしました</div></div></div>
  <div>${S.skips.slice(0,60).map(x=>`<div class="between" style="padding:10px 0;border-bottom:1px solid var(--border)"><div style="min-width:0"><div class="ell" style="font-weight:500">${esc(x.name)}</div><div class="sub">${fmtDay(x.date)}${x.goalId?' · 目標に追加済み':''}</div></div><div class="row" style="gap:4px;flex:none"><b class="num">${yen(x.amount)}</b><button class="iconbtn" data-act="gdel" data-id="${esc(x.id)}" aria-label="${esc(x.name)}を削除">${ic('trash','sm')}</button></div></div>`).join('')}</div>
  <p class="sub" style="margin-bottom:0">削除しても、貯金の目標に足した金額はそのままです（設定の「貯金の目標」で直せます）。</p>`,{label:'がまん貯金の記録'});
}

