"use strict";
/* ---------- Add ---------- */
function pendingInbox(){return S.inbox.filter(x=>x.status==='pending'||(x.status==='snoozed'&&(x.snoozeUntil||'')<=today())).sort((a,b)=>(b.date||'').localeCompare(a.date||''))}
function addView(){
  const pend=pendingInbox();
  return `<div class="topbar"><span class="logo">monee.</span></div><h1 class="h" style="margin-bottom:6px">記録する</h1><p class="sub" style="margin:0 0 18px">いちばん楽な方法を選んでください。保存の前に必ず内容を確認できます。</p>
  <div class="stack">
   <button class="entry primary" data-act="quick"><span class="ic">${ic('plus','lg')}</span><span style="flex:1"><span class="t" style="display:block">すばやく記録</span><span class="sub">金額とカテゴリだけ。いちばん早い方法です</span></span>${ic('right')}</button>
   ${(()=>{const fv=favorites();return fv.length?`<div><div class="label" style="margin-bottom:6px">いつもの（タップで今日の記録に追加）</div><div class="favs">${fv.map(favBtn).join('')}</div></div>`:''})()}
   <a href="#add-scan" class="entry" style="text-decoration:none;color:inherit"><span class="ic">${ic('camera','lg')}</span><span style="flex:1"><span class="t" style="display:block">レシートを読み取る</span><span class="sub">撮るだけで店名・品目・金額を読み取ります</span></span>${ic('right')}</a>
   <a href="#add-chat" class="entry" style="text-decoration:none;color:inherit"><span class="ic">${ic('chat','lg')}</span><span style="flex:1"><span class="t" style="display:block">ドットに話して記録</span><span class="sub">「カフェで680円」と送るだけ。集計の質問もOK</span></span>${ic('right')}</a>
   <button class="entry" data-act="newform"><span class="ic">${ic('pencil','lg')}</span><span style="flex:1"><span class="t" style="display:block">手入力</span><span class="sub">支出・収入・振替・返金を細かく入力</span></span>${ic('right')}</button>
  </div>
  <section class="section"><div class="sec-h"><h2 class="s">確認待ちの候補</h2>${pend.length?`<span class="pill">${pend.length}件</span>`:''}</div>${inboxSection(pend)}</section>
  <p class="sub" style="margin-top:20px;display:flex;gap:8px">${ic('info','sm')}<span>Claudeアプリのチャットで「ランチ900円つけて」と頼んでも、ここに記録されます。</span></p>`;
}
function inboxSection(pend){
  const gm=`<div class="notice plain" style="margin-bottom:12px">${ic('mail')}<div style="flex:1"><b>Gmail：アプリからの自動連携は未接続</b><div class="sub">Claudeのチャットで「Gmailから先週の購入を取り込んで」と頼むと、見つかった支出がここに候補として届きます。自動では保存されません。</div></div></div>`;
  if(!S.ready.inbox)return gm+`<div class="sk" style="height:90px"></div>`;
  if(!pend.length)return gm+`<div class="card sm">${emptyState('check','確認待ちはありません','新しい候補が届くとここに表示されます。')}</div>`;
  return gm+`<div class="stack">${pend.map(emailCard).join('')}</div>`;
}
function emailCard(x){
  const dup=findDuplicates({amount:x.amount,date:x.date,merchant:x.merchant,type:'expense'});
  return `<article class="card sm" aria-label="${esc(x.merchant||'候補')}">
   <div class="between" style="align-items:flex-start"><div style="min-width:0"><div class="row" style="gap:6px;flex-wrap:wrap"><span class="badge-src">${esc(SRC_L[x.source]||'候補')}</span>${x.kind==='order'?'<span class="pill warn">注文確認（未決済の可能性）</span>':x.kind==='payment'?'<span class="pill">支払い通知</span>':''}${x.confidence==='low'?'<span class="pill warn">読み取りに不確かさあり</span>':''}</div>
   <div style="font-weight:600;margin-top:6px" class="ell">${esc(x.merchant||'不明な店舗')}</div><div class="sub ell">${x.sender?esc(x.sender)+' · ':''}${x.date?fmtDay(x.date):'日付不明'}</div>${x.subject?`<div class="sub ell">件名：${esc(x.subject)}</div>`:''}</div><div class="num" style="font-weight:600;font-size:18px">${x.amount!=null?yen(x.amount):'金額不明'}</div></div>
   ${(x.items||[]).length?`<div class="sub" style="margin-top:6px">${x.items.slice(0,4).map(i=>esc(i.name)).join('、')}${x.items.length>4?` ほか${x.items.length-4}点`:''}</div>`:''}
   ${dup.length?`<div class="notice warn" style="margin-top:10px;padding:10px 12px">${ic('alert','sm')}<div>記録済みの可能性：${dup.map(t=>`${esc(t.merchant||'')} ${fmtShort(t.date)} ${yen(t.amount)}`).join('、')}</div></div>`:''}
   <div class="grid2" style="margin-top:12px"><button class="btn primary sm" data-act="ibsave" data-id="${esc(x.id)}">確認して保存</button><button class="btn ghost sm" data-act="ibdone" data-id="${esc(x.id)}">記録済み</button><button class="btn ghost sm" data-act="ibno" data-id="${esc(x.id)}">支出ではない</button><button class="btn ghost sm" data-act="ibsnooze" data-id="${esc(x.id)}">あとで</button></div>
  </article>`;
}
async function setInbox(id,patch,msg){const x=S.inbox.find(i=>i.id===id);if(!x)return;const next={...x,...patch};delete next.id;try{await S.db.collection('inbox').doc(id).set(next);toast(msg)}catch(e){toast(writeErr(e),{err:true})}}

/* ---------- Form (manual / edit / review) ---------- */
function blankForm(p={}){return {type:'expense',amount:'',date:today(),time:'',merchant:'',category:'',method:(p.type||'expense')==='expense'?lastMethod(''):'',toMethod:'',note:'',items:[],discount:'',tax:'',taxIncluded:true,refundOf:'',source:'manual',ack:false,dupAck:false,...p}}
function startForm(p,route='add-manual'){S.form=blankForm(p);if(!S.form.category&&S.form.type==='expense')S.form.category='';location.hash=route===S.route?location.hash:'#'+route;if(route===S.route)render()}
function formFromTxn(t){return blankForm({...JSON.parse(JSON.stringify(t)),editId:t.id,amount:String(t.amount??''),discount:t.discount?String(t.discount):'',tax:t.tax?String(t.tax):'',items:(t.items||[]).map(i=>({...i})),ack:false,dupAck:false})}
function itemsCalc(f){const sum=(f.items||[]).reduce((a,i)=>a+toInt(i.total),0);const calc=sum-toInt(f.discount)+(f.taxIncluded?0:toInt(f.tax));return {sum,calc,diff:toInt(f.amount)-calc}}
function formView(review=false){
  const f=S.form;if(!f)return `<div class="topbar"><a class="iconbtn" href="#add" aria-label="戻る">${ic('left')}</a></div>`+emptyState('pencil','フォームを開けませんでした','追加画面からやり直してください。',`<a class="btn primary" href="#add">追加へ</a>`);
  const st=settings();const unc=f.uncertain||[];const U=k=>unc.includes(k)?' uncertain':'';const UT=k=>unc.includes(k)?'<span class="unc-tag">要確認</span>':'';
  const kind=f.type==='income'?'income':'expense';
  const title=f.editId?'記録を編集':review?'読み取り結果の確認':'手入力';
  const types=['expense','income','transfer','refund'];
  const refundTargets=S.txns.filter(t=>t.type==='expense'&&t.status!=='cancelled'&&toInt(t.refunded)<toInt(t.amount)).slice(0,60);
  return `<div class="topbar"><a class="iconbtn" href="${review?'#add-scan':'#add'}" data-act="${review?'scanback':''}" aria-label="戻る">${ic('left')}</a><span class="logo">monee.</span><span style="width:44px"></span></div>
  <h1 class="h" style="margin-bottom:16px">${title}</h1>
  ${review&&S.scan?.url?`<details class="card sm" style="margin-bottom:14px" ${unc.length?'open':''}><summary style="cursor:pointer;font-weight:600;min-height:28px">レシート画像を見る</summary><img class="receipt-img" style="margin-top:10px" alt="アップロードしたレシート" src="${esc(S.scan.url)}"></details>`:''}
  ${unc.length?`<div class="notice warn" style="margin-bottom:14px">${ic('alert')}<div><b>読み取りが不確かな項目があります</b><div class="sub">「要確認」の欄をレシートと見比べてください。読めなかった欄は空欄のままです。</div></div></div>`:''}
  <form id="txform" class="stack" novalidate>
   ${f.editId||review?'':`<div class="seg" role="group" aria-label="種類">${types.map(k=>`<button type="button" aria-pressed="${f.type===k}" data-act="ftype" data-v="${k}">${TYPE_L[k]}</button>`).join('')}</div>`}
   ${f.type==='refund'?`<label class="field"><span>返金される元の支出</span><select id="f-refundOf" class="input" data-f="refundOf"><option value="">選んでください</option>${refundTargets.map(t=>`<option value="${esc(t.id)}" ${f.refundOf===t.id?'selected':''}>${fmtShort(t.date)} ${esc(t.merchant||'')} ${yen(toInt(t.amount)-toInt(t.refunded))}</option>`).join('')}</select>${refundTargets.length?'':'<span class="sub">返金できる支出がありません。元の記録がない場合は「収入」で記録してください。</span>'}</label>`:''}
   <label class="field"><span>${f.type==='refund'?'返金額':'金額'}${review?'（レシートの合計）':''}${UT('amount')}</span><div class="amount-wrap"><input id="f-amount" class="input amount-in num${U('amount')}" inputmode="numeric" autocomplete="off" placeholder="0" data-f="amount" value="${esc(f.amount)}" aria-describedby="err-amount"></div><span id="err-amount" class="sub" style="color:var(--danger)"></span></label>
   <div class="grid2"><label class="field"><span>日付${UT('date')}</span><input id="f-date" class="input${U('date')}" type="date" data-f="date" value="${esc(f.date)}"></label><label class="field"><span>時刻（任意）${UT('time')}</span><input id="f-time" class="input${U('time')}" type="time" data-f="time" value="${esc(f.time)}"></label></div>
   ${f.type==='refund'?'':`<label class="field"><span>${f.type==='transfer'?'内容':f.type==='income'?'内容・入金元':'店名・内容'}${UT('merchant')}</span><input id="f-merchant" class="input${U('merchant')}" data-f="merchant" maxlength="80" list="dl-m" autocomplete="off" placeholder="${f.type==='transfer'?'例：Suicaにチャージ':f.type==='income'?'例：バイト代':'例：スターバックス'}" value="${esc(f.merchant)}">${merchantDL()}</label>`}
   ${f.type==='expense'||f.type==='income'?`<div class="field"><span id="catl">カテゴリ${UT('category')}<span id="cat-hint" class="hint">${f.catAuto&&f.category?ic('sparkles','sm')+'自動で選びました':''}</span></span><div class="chips" role="group" aria-labelledby="catl">${cats(kind).map(c=>`<button type="button" class="chip" aria-pressed="${f.category===c.id}" data-act="fcat" data-v="${esc(c.id)}"><span class="dot" style="background:${esc(c.color)}"></span>${esc(c.name)}</button>`).join('')}</div><span id="err-cat" class="sub" style="color:var(--danger)"></span></div>`:''}
   ${f.type==='refund'?'':`<div class="${f.type==='transfer'?'grid2':''}"><label class="field"><span>${f.type==='transfer'?'移動元':f.type==='income'?'入金先':'支払い方法'}${UT('method')}</span><select id="f-method" class="input${U('method')}" data-f="method"><option value="">未選択</option>${st.methods.map(x=>`<option ${f.method===x?'selected':''}>${esc(x)}</option>`).join('')}</select></label>${f.type==='transfer'?`<label class="field"><span>移動先</span><select id="f-toMethod" class="input" data-f="toMethod"><option value="">未選択</option>${st.methods.map(x=>`<option ${f.toMethod===x?'selected':''}>${esc(x)}</option>`).join('')}</select></label>`:''}</div>`}
   ${f.type==='transfer'?'<p class="sub" style="margin:0">振替（チャージや口座間の移動）は支出に数えません。チャージ後の買い物を記録すれば二重計上になりません。</p>':''}
   ${f.type==='expense'?`<div class="field"><div class="between"><span style="font-size:13px;font-weight:600">品目（任意）</span><button type="button" class="link" data-act="additem">${ic('plus','sm')}品目を追加</button></div>
     <div class="stack" style="gap:8px">${f.items.map((it,i)=>`<div class="item-card"><label class="field name"><span>品名${unc.includes('items.'+i)?'<span class="unc-tag">要確認</span>':''}</span><input id="it-${i}-name" class="input${unc.includes('items.'+i)?' uncertain':''}" data-i="${i}" data-k="name" value="${esc(it.name)}" maxlength="60"></label><button type="button" class="iconbtn rm" data-act="rmitem" data-i="${i}" aria-label="${esc(it.name||'品目')}を削除">${ic('x','sm')}</button>
       <label class="field"><span>数量</span><input id="it-${i}-qty" class="input num" inputmode="numeric" data-i="${i}" data-k="qty" value="${esc(it.qty??1)}"></label><label class="field"><span>単価</span><input id="it-${i}-unit" class="input num" inputmode="numeric" data-i="${i}" data-k="unit" value="${esc(it.unit??'')}"></label><label class="field"><span>小計</span><input id="it-${i}-total" class="input num" inputmode="numeric" data-i="${i}" data-k="total" value="${esc(it.total??'')}"></label>
       <label class="field" style="grid-column:1/-1"><span>この品目のカテゴリ</span><select id="it-${i}-cat" class="input" data-i="${i}" data-k="category"><option value="">記録と同じ</option>${cats('expense').map(c=>`<option value="${esc(c.id)}" ${it.category===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label></div>`).join('')}</div>
     ${f.items.length?`<div class="grid2" style="grid-template-columns:1fr 1fr 1fr;gap:8px"><label class="field"><span>値引き${UT('discount')}</span><input id="f-discount" class="input num${U('discount')}" inputmode="numeric" data-f="discount" value="${esc(f.discount)}" placeholder="0"></label><label class="field"><span>消費税${UT('tax')}</span><input id="f-tax" class="input num${U('tax')}" inputmode="numeric" data-f="tax" value="${esc(f.tax)}" placeholder="0"></label><label class="field"><span>税の扱い</span><select id="f-taxinc" class="input" data-f="taxIncluded"><option value="1" ${f.taxIncluded?'selected':''}>内税</option><option value="0" ${!f.taxIncluded?'selected':''}>外税</option></select></label></div>
     <div id="recon"></div>`:''}</div>`:''}
   ${f.type==='refund'?'':`<label class="field"><span>メモ（任意）</span><textarea id="f-note" class="input" data-f="note" maxlength="300">${esc(f.note)}</textarea></label>`}
   <div id="dupbox"></div>
   <div id="formerr" role="alert" class="sub" style="color:var(--danger)"></div>
   <div class="${f.editId?'':'grid2'}">${f.editId?'':`<button type="button" class="btn ghost" data-act="savedraft">下書き保存</button>`}<button type="submit" class="btn primary" id="fsave">${ic('check','sm')}${f.editId?'変更を保存':'保存する'}</button></div>
  </form>`;
}
function updateDerived(){
  const f=S.form;if(!f)return;
  const rb=$('#recon');
  if(rb){const {sum,calc,diff}=itemsCalc(f);const ok=!toInt(f.amount)||Math.abs(diff)<1;
    rb.innerHTML=`<table class="recon" aria-label="合計の照合"><tr><td>品目の合計</td><td class="num">${yen(sum)}</td></tr>${toInt(f.discount)?`<tr><td>値引き</td><td class="num">−${yen(f.discount)}</td></tr>`:''}${!f.taxIncluded&&toInt(f.tax)?`<tr><td>外税</td><td class="num">+${yen(f.tax)}</td></tr>`:''}<tr><td>計算上の合計</td><td class="num">${yen(calc)}</td></tr><tr><td>${S.route==='add-scan'?'レシートの合計':'入力した金額'}</td><td class="num">${yen(f.amount)}</td></tr><tr class="diff"><td>${ok?'一致しています':'差額'}</td><td class="num" style="color:${ok?'var(--primary)':'var(--danger)'}">${ok?ic('check','sm'):syen(diff,diff>0?1:-1)}</td></tr></table>
    ${ok?'':`<div class="notice warn" style="margin-top:10px;padding:12px">${ic('alert','sm')}<div><div>品目の合計と金額が合いません。値引き・税・数量を確認してください。</div><label class="check" style="margin-top:4px"><input type="checkbox" id="f-ack" ${f.ack?'checked':''}><span>確認しました。金額（${yen(f.amount)}）を正としてこのまま保存する</span></label></div></div>`}`;
    const ack=$('#f-ack');if(ack)ack.onchange=e=>f.ack=e.target.checked;}
  const db=$('#dupbox');
  if(db){const dup=(f.type==='expense'||f.type==='income')?findDuplicates(f,f.editId):[];
    db.innerHTML=dup.length?`<div class="notice warn">${ic('alert')}<div style="flex:1"><b>同じような記録がすでにあります</b>${dup.map(t=>`<div class="sub num">${fmtDay(t.date)} ${esc(t.merchant||'')} ${yen(t.amount)}</div>`).join('')}<label class="check"><input type="checkbox" id="f-dupack" ${f.dupAck?'checked':''}><span>重複ではないので保存する</span></label></div></div>`:'';
    const da=$('#f-dupack');if(da)da.onchange=e=>f.dupAck=e.target.checked;}
}
function validateForm(asDraft){
  const f=S.form;const err=[];const amt=toInt(f.amount);
  $('#err-amount')&&($('#err-amount').textContent='');$('#err-cat')&&($('#err-cat').textContent='');
  if(amt<=0){err.push('金額を入力してください。');$('#err-amount')&&($('#err-amount').textContent='1円以上の金額を入力してください。')}
  if(!f.date)err.push('日付を入力してください。');
  if(asDraft)return err;
  if((f.type==='expense'||f.type==='income')&&!f.category){err.push('カテゴリを選んでください。');$('#err-cat')&&($('#err-cat').textContent='カテゴリを選んでください。')}
  if(f.type==='transfer'&&(!f.method||!f.toMethod))err.push('移動元と移動先を選んでください。');
  if(f.type==='refund'){const t=S.txns.find(x=>x.id===f.refundOf);if(!t)err.push('返金の元になる支出を選んでください。');else if(amt>toInt(t.amount)-toInt(t.refunded))err.push(`返金額は${yen(toInt(t.amount)-toInt(t.refunded))}以下にしてください。`)}
  if(f.type==='expense'&&f.items.length&&amt){const {diff}=itemsCalc(f);if(Math.abs(diff)>=1&&!f.ack)err.push('品目の合計と金額の差を確認し、チェックを入れてください。')}
  if((f.type==='expense'||f.type==='income')&&findDuplicates(f,f.editId).length&&!f.dupAck)err.push('重複の可能性を確認し、チェックを入れてください。');
  return err;
}
async function submitForm(asDraft,btn){
  const f=S.form;const errs=validateForm(asDraft);
  if(errs.length){$('#formerr').textContent=errs.join(' ');$('#formerr').scrollIntoView({block:'center',behavior:'smooth'});return}
  $('#formerr').textContent='';
  const now=new Date().toISOString();
  busy(btn,true);
  try{
    if(f.type==='refund'){
      const t=S.txns.find(x=>x.id===f.refundOf);const a=toInt(f.amount);const refunded=toInt(t.refunded)+a;
      const next={...t,refunded,refunds:[...(t.refunds||[]),{amount:a,date:f.date}],status:refunded>=toInt(t.amount)?'refunded':'partial',updatedAt:now};delete next.id;
      await saveTxn(t.id,next);toast(`${yen(a)}の返金を記録しました`);
    }else{
      const prev=f.editId?S.txns.find(x=>x.id===f.editId):null;
      const items=f.type==='expense'?f.items.filter(i=>i.name||toInt(i.total)).map(i=>({name:String(i.name||'').trim(),qty:toInt(i.qty)||1,unit:i.unit===''||i.unit==null?null:toInt(i.unit),total:toInt(i.total),category:i.category||''})):[];
      const obj={type:f.type,status:asDraft?'draft':(prev&&prev.status&&prev.status!=='draft'?prev.status:'confirmed'),amount:toInt(f.amount),date:f.date,time:f.time||'',merchant:String(f.merchant||'').trim(),category:(f.type==='expense'||f.type==='income')?f.category:'',method:f.method||'',toMethod:f.type==='transfer'?f.toMethod:'',note:String(f.note||'').trim(),items,discount:items.length?toInt(f.discount):0,tax:items.length?toInt(f.tax):0,taxIncluded:!!f.taxIncluded,receiptAssetId:f.receiptAssetId||null,source:f.source||'manual',refunded:prev?toInt(prev.refunded):0,refunds:prev?.refunds||[],recurringId:f.recurringId||prev?.recurringId||null,inboxId:f.inboxId||null,paydayId:f.paydayId||prev?.paydayId||null,feel:prev?.feel||null,lend:f.type==='expense'?(prev?.lend||null):null,createdAt:prev?.createdAt||now,updatedAt:now};
      const id=f.editId||uid();
      await saveTxn(id,obj);
      if(f.inboxId){const x=S.inbox.find(i=>i.id===f.inboxId);if(x){const n={...x,status:'done',txnId:id};delete n.id;try{await S.db.collection('inbox').doc(x.id).set(n)}catch(e){}}}
      if(f.chatProposal&&S.chat.proposals[f.chatProposal])S.chat.proposals[f.chatProposal].state='saved';
      toast(asDraft?'下書きを保存しました':f.editId?'変更を保存しました':'保存しました',{undo:f.editId?null:async()=>{await S.db.collection('txns').doc(id).delete()}});
    }
    const back=f.chatProposal?'#add-chat':f.editId?'#history':'#home';
    S.form=null;S.scan=null;location.hash=back;
  }catch(e){busy(btn,false);toast(writeErr(e),{err:true})}
}

/* ---------- Receipt scan ---------- */
function scanView(){
  const s=S.scan;
  const head=`<div class="topbar"><a class="iconbtn" href="#add" aria-label="戻る">${ic('left')}</a><span class="logo">monee.</span><span style="width:44px"></span></div>`;
  if(s&&s.phase==='review')return formView(true);
  let body='';
  if(!s||s.phase==='pick'){
    body=`<h1 class="h" style="margin-bottom:6px">レシートを読み取る</h1><p class="sub" style="margin:0 0 18px">1枚ずつ撮影または選択してください。読み取り結果は保存前にすべて確認・修正できます。</p>
    <div class="card" style="text-align:center;padding:28px 20px"><div class="empty" style="padding:0 0 16px"><div class="ic">${ic('receipt','lg')}</div><div class="t">レシート全体が写るように</div><div style="font-size:13px">明るい場所で、平らにして撮ると読み取りやすくなります。</div></div>
     <div class="stack" style="gap:10px"><label class="btn primary block" for="scan-cam">${ic('camera','sm')}カメラで撮る</label><input id="scan-cam" type="file" accept="image/*" capture="environment" class="sr-only" data-scan="1">
     <label class="btn ghost block" for="scan-file">${ic('image','sm')}画像を選ぶ</label><input id="scan-file" type="file" accept="image/*" class="sr-only" data-scan="1"></div></div>
    ${!S.sample?`<div class="notice warn" style="margin-top:14px">${ic('info')}<div>この表示ではAIの読み取りを使えません。画像を添付して手入力で記録できます。</div></div>`:''}`;
  }else if(s.phase==='busy'){
    body=`<h1 class="h" style="margin-bottom:16px">読み取り中…</h1><div class="card">${s.url?`<img class="receipt-img" alt="選んだレシート" src="${esc(s.url)}">`:''}<div class="row" style="margin-top:14px" role="status">${ic('loader','spin')}<span>${esc(s.step||'処理しています')}</span></div><div class="stack" style="margin-top:14px;gap:8px"><div class="sk" style="height:18px;width:60%"></div><div class="sk" style="height:18px;width:80%"></div><div class="sk" style="height:18px;width:45%"></div></div></div>`;
  }else if(s.phase==='error'){
    body=`<h1 class="h" style="margin-bottom:16px">読み取れませんでした</h1><div class="card">${s.url?`<img class="receipt-img" alt="選んだレシート" src="${esc(s.url)}">`:''}<div class="notice danger" style="margin-top:14px">${ic('alert')}<div>${esc(s.error||'うまく読み取れませんでした。')}<div class="sub">画像は保持しています。もう一度試すか、手入力で記録できます。</div></div></div>
    <div class="grid2" style="margin-top:14px">${S.sample&&s.blob?`<button class="btn primary" data-act="scanretry">${ic('undo','sm')}再試行</button>`:''}<button class="btn ghost" data-act="scanmanual">${ic('pencil','sm')}手入力で記録</button></div><button class="btn ghost block" style="margin-top:10px" data-act="scanreset">別の画像を選ぶ</button></div>`;
  }
  return head+body;
}
async function shrink(file){
  try{const bmp=await createImageBitmap(file);const max=1600;const sc=Math.min(1,max/Math.max(bmp.width,bmp.height));const c=document.createElement('canvas');c.width=Math.round(bmp.width*sc);c.height=Math.round(bmp.height*sc);c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);
    return await new Promise(r=>c.toBlob(b=>r(b||file),'image/jpeg',.85));}catch(e){return file}
}
async function handleScanFile(file){
  if(!file)return;
  if(!/^image\//.test(file.type)){toast('画像ファイルを選んでください',{err:true});return}
  S.scan={phase:'busy',step:'画像を準備しています',url:URL.createObjectURL(file)};render();
  const blob=await shrink(file);S.scan.blob=blob;
  if(S.assets){S.scan.step='レシートを保存しています';render();try{const a=await S.assets.upload(blob);S.scan.assetId=a.id;S.scan.url=a.url||S.scan.url}catch(e){S.scan.assetErr=true}}
  if(!S.sample){S.scan.phase='error';S.scan.error='この表示ではAIの読み取りを使えません。';render();return}
  await runExtraction();
}
async function runExtraction(){
  const s=S.scan;s.phase='busy';s.step='AIが内容を読み取っています';render();
  try{
    const lim=S.sample.limits?await S.sample.limits().catch(()=>null):null;if(lim&&!lim.images)throw {message:'この表示では画像を読み取れません。'};
    const catList=cats('expense').map(c=>`${c.id}=${c.name}`).join(', ');
    const prompt=`あなたは日本のレシートを読み取るアシスタントです。画像から以下のJSONだけを返してください。説明文は不要です。
読めない・確信がない値は推測で埋めずに null にし、そのキー名を uncertain に入れてください。金額は円の整数。
{"merchant":string|null,"date":"YYYY-MM-DD"|null,"time":"HH:MM"|null,"items":[{"name":string,"qty":number,"unit_price":number|null,"total":number,"category":string|null,"uncertain":boolean}],"discount":number|null,"tax":number|null,"tax_included":boolean,"total":number|null,"payment_method":"現金"|"クレジットカード"|"交通系IC"|"QR決済"|null,"category":string|null,"uncertain":[string],"is_receipt":boolean}
- discount は値引き・クーポンの合計（正の数）。
- tax は記載の消費税額。税込価格で品目が書かれていれば tax_included=true。
- category と items[].category は次のIDから選ぶ: ${catList}
- 今日は ${today()}。年が省略されていれば今年と判断し、その場合 date を uncertain に入れる。
- レシートでない画像なら is_receipt=false。`;
    const v=await S.sample.json(prompt,{images:[s.blob],modelTier:'default'});
    if(!v||v.is_receipt===false)throw {message:'レシートとして読み取れませんでした。'};
    const unc=new Set(Array.isArray(v.uncertain)?v.uncertain:[]);
    const validCat=id=>cats('expense').some(c=>c.id===id)?id:'';
    const items=(v.items||[]).filter(i=>i&&(i.name||i.total)).map((i,ix)=>{if(i.uncertain)unc.add('items.'+ix);return {name:String(i.name||''),qty:Number(i.qty)||1,unit:i.unit_price==null?'':toInt(i.unit_price),total:toInt(i.total),category:validCat(i.category)}});
    ['merchant','date','total','time'].forEach(k=>{if(v[k]==null&&k!=='time')unc.add(k)});
    if(v.total==null)unc.add('amount');if(unc.has('total'))unc.add('amount');
    const methods=settings().methods;
    S.form=blankForm({type:'expense',amount:v.total==null?'':String(toInt(v.total)),date:v.date||today(),time:v.time||'',merchant:v.merchant||'',category:validCat(v.category),method:methods.includes(v.payment_method)?v.payment_method:'',items,discount:v.discount?String(toInt(v.discount)):'',tax:v.tax?String(toInt(v.tax)):'',taxIncluded:v.tax_included!==false,receiptAssetId:s.assetId||null,source:'receipt',uncertain:[...unc]});
    s.phase='review';render();
  }catch(e){s.phase='error';s.error=e?.code==='rate_limited'?'混み合っています。少し待ってから再試行してください。':e?.code==='not_granted'?'AIの利用が許可されていません。':(e?.message&&!e.code?e.message:'うまく読み取れませんでした。');render()}
}

