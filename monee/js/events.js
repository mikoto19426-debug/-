"use strict";
/* ================= Events ================= */
document.addEventListener('click',async e=>{
  const go=e.target.closest('[data-go]');if(go){location.hash='#'+go.dataset.go;return}
  const el=e.target.closest('[data-act]');if(!el)return;const a=el.dataset.act;const id=el.dataset.id;
  if(a==='scrim'||a==='cfscrim'){if(e.target===el){if(a==='cfscrim')$('#cfn')?.click();else closeSheet()}return}
  if(a==='close'){closeSheet();return}
  if(a==='detail'){detailSheet(id);return}
  if(a==='quick'){quickSheet({});return}
  if(a==='dot'){S.dotI++;S.dotHopAt=Date.now();render();return}
  if(a==='dotinfo'){dotInfoSheet();return}
  if(a==='copyremind'){try{await navigator.clipboard.writeText(el.dataset.v);toast('コピーしました')}catch(err){toast('コピーできませんでした。文を長押ししてコピーしてください',{err:true})}return}
  if(a==='gaman'){gamanSheet();return}
  if(a==='gmove'){gamanMoveSheet();return}
  if(a==='gmoveok'){confirmMove(el);return}
  if(a==='zeroday'||a==='unzeroday'){const d=el.dataset.d,on=a==='zeroday';try{await setZeroDay(d,on);if(on){S.dotHopAt=Date.now();toast('ドット：0円の日、ちゃんと記録できたね',{undo:()=>setZeroDay(d,false)})}else toast('取り消しました')}catch(err){toast(writeErr(err),{err:true})}return}
  if(a==='gamanlist'){gamanList();return}
  if(a==='gpick'){$('#g-name').value=el.dataset.n;$('#g-amt').value=el.dataset.a;$('#g-err').textContent='';return}
  if(a==='gsave'){saveGaman(el);return}
  if(a==='gdel'){const x=S.skips.find(i=>i.id===id);if(!x)return;const prev={...x};delete prev.id;try{await S.db.collection('skips').doc(x.id).delete();el.closest('.between')?.remove();toast('削除しました',{undo:()=>S.db.collection('skips').doc(x.id).set(prev)})}catch(err){toast(writeErr(err),{err:true})}return}
  if(a==='feel'){const t=S.txns.find(x=>x.id===id);if(!t)return;const v=t.feel===el.dataset.v?null:el.dataset.v;const next={...t,feel:v,updatedAt:new Date().toISOString()};delete next.id;
    document.querySelectorAll(`[data-act="feel"][data-id="${CSS.escape(id)}"]`).forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===v));
    try{await saveTxn(t.id,next);if(v){S.dotHopAt=Date.now();toast(v==='good'?'ドット：いい買い物だったね':v==='bad'?'ドット：気づけたのがえらい。次はひと呼吸だね':'ドット：記録したよ')}}catch(err){toast(writeErr(err),{err:true})}return}
  if(a==='quickday'){quickSheet({date:el.dataset.d});return}
  if(a==='qtype'&&S.q){S.q.type=el.dataset.v;S.q.category=S.q.merchant?guessCat(S.q.merchant,S.q.type):'';S.q.catAuto=!!S.q.category;document.querySelectorAll('[data-act="qtype"]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===S.q.type));drawQuick();return}
  if(a==='qcat'&&S.q){S.q.category=el.dataset.v;S.q.catAuto=false;$('#q-err').textContent='';if(S.q.type==='expense'&&!$('#q-method').value){const m=lastMethod(S.q.category);if(m){S.q.method=m;$('#q-method').value=m}}drawQuick();return}
  if(a==='qdate'&&S.q){S.q.date=el.dataset.v;S.q.dupAck=false;drawQuick();return}
  if(a==='qsave'){saveQuick(el);return}
  if(a==='qmore'&&S.q){const q=S.q;closeSheet();startForm({type:q.type,amount:q.amount,merchant:q.merchant,category:q.category,method:q.method,date:q.date,catAuto:q.catAuto});return}
  if(a==='fav'){const t=S.txns.find(x=>x.id===id);if(!t||el.disabled)return;el.disabled=true;const nid=uid();
    try{await saveTxn(nid,buildTxn({type:'expense',amount:toInt(t.amount),date:today(),merchant:t.merchant,category:t.category,method:t.method},'quick'));toast(`${t.merchant} ${yen(t.amount)}を今日の記録に追加しました`,{undo:()=>S.db.collection('txns').doc(nid).delete()})}catch(err){toast(writeErr(err),{err:true})}
    el.disabled=false;return}
  if(a==='again'){const t=S.txns.find(x=>x.id===id);if(!t)return;closeSheet();quickSheet({type:t.type,amount:toInt(t.amount)-toInt(t.refunded),merchant:t.merchant,category:t.category,method:t.method});return}
  if(a==='hmore'){S.hist.limit=(S.hist.limit||120)+200;render();return}
  if(a==='iday'){S.ins.day=S.ins.day===el.dataset.d?null:el.dataset.d;render();return}
  if(a==='catfilter'){const r=S.route==='insights'?rangeOf(S.ins.unit,S.ins.offset):null;S.hist={...S.hist,q:'',type:'all',method:'',cat:el.dataset.cat,limit:120,...(r&&S.ins.offset!==0||r&&S.ins.unit!=='month'?{period:'custom',from:r.from,to:r.to}:{period:'month'})};location.hash='#history';return}
  if(a==='hp'){S.hist.period=el.dataset.v;S.hist.limit=120;if(el.dataset.v==='custom'&&!S.hist.from){const m=rangeOf('month');S.hist.from=m.from;S.hist.to=m.to}render();return}
  if(a==='hreset'){S.hist={q:'',period:'all',type:'all',cat:'',method:'',from:'',to:''};render();return}
  if(a==='budget'){settingsSheet('budget');return}
  if(a==='drafts'){S.hist={...S.hist,period:'all',q:'',type:'all',cat:'',method:'',limit:120};location.hash='#history';return}
  if(a==='newform'){startForm({});return}
  if(a==='edit'){const t=S.txns.find(x=>x.id===id);if(!t)return;closeSheet();S.form=formFromTxn(t);location.hash='#add-manual';if(S.route==='add-manual')render();return}
  if(a==='refund'){refundSheet(id);return}
  if(a==='cancel'||a==='uncancel'||a==='confirmdraft'){const t=S.txns.find(x=>x.id===id);if(!t)return;
    if(a==='cancel'&&!await confirmDialog({title:'取消にしますか？',body:`「${esc(t.merchant||'この記録')}」を取消扱いにします。記録は残りますが、集計には含まれません。`,ok:'取消にする'}))return;
    const prev={...t};delete prev.id;const next={...prev,status:a==='cancel'?'cancelled':'confirmed',updatedAt:new Date().toISOString()};if(a==='uncancel')next.status=toInt(t.refunded)?(toInt(t.refunded)>=toInt(t.amount)?'refunded':'partial'):'confirmed';
    if(a==='confirmdraft'){S.form=formFromTxn(t);const errs=validateForm(false);S.form=null;if(errs.length){closeSheet();S.form=formFromTxn(t);location.hash='#add-manual';toast('確定する前に、足りない項目を入力してください',{err:true});return}}
    try{await saveTxn(t.id,next);closeSheet();toast(a==='cancel'?'取消にしました':a==='confirmdraft'?'確定しました':'取消を戻しました',{undo:()=>saveTxn(t.id,prev)})}catch(err){toast(writeErr(err),{err:true})}return}
  if(a==='delete'){const t=S.txns.find(x=>x.id===id);if(!t)return;
    if(!await confirmDialog({title:'削除しますか？',body:`「${esc(t.merchant||'この記録')}」（${yen(t.amount)}）を削除します。`,ok:'削除する',danger:true}))return;
    const prev={...t};delete prev.id;let undone=false;try{await S.db.collection('txns').doc(t.id).delete();toast('削除しました',{undo:()=>{undone=true;return saveTxn(t.id,prev)}});deleteReceiptLater(t.receiptAssetId,()=>undone)}catch(err){toast(writeErr(err),{err:true})}return}
  if(a==='ftype'){S.form.type=el.dataset.v;S.form.category='';render();return}
  if(a==='fcat'){S.form.category=el.dataset.v;S.form.catAuto=false;$('#cat-hint')&&($('#cat-hint').innerHTML='');document.querySelectorAll('[data-act="fcat"]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===S.form.category));$('#err-cat')&&($('#err-cat').textContent='');return}
  if(a==='additem'){S.form.items.push({name:'',qty:1,unit:'',total:'',category:''});render();document.getElementById(`it-${S.form.items.length-1}-name`)?.focus();return}
  if(a==='rmitem'){S.form.items.splice(+el.dataset.i,1);S.form.uncertain=(S.form.uncertain||[]).filter(k=>!k.startsWith('items.'));render();return}
  if(a==='savedraft'){submitForm(true,el);return}
  if(a==='scanretry'){runExtraction();return}
  if(a==='scanreset'){S.scan=null;render();return}
  if(a==='scanback'){e.preventDefault();if(await confirmDialog({title:'読み取り結果を破棄しますか？',body:'保存していない内容は失われます。',ok:'破棄する',danger:true})){const aid=S.scan?.assetId;S.scan=null;S.form=null;render();deleteReceiptLater(aid,()=>false)}return}
  if(a==='scanmanual'){const s=S.scan;S.form=blankForm({receiptAssetId:s?.assetId||null,source:'receipt'});S.scan={...s,phase:'review'};render();return}
  if(a==='sugg'){sendChat(el.dataset.v);return}
  if(a==='psave'||a==='pedit'||a==='pdrop'){const p=S.chat.proposals[el.dataset.pid];if(!p||p.state!=='open')return;
    if(a==='pdrop'){p.state='discarded';render();return}
    if(p.kind==='zero'||p.kind==='gaman'){busy(el,true);try{
      if(p.kind==='zero')await setZeroDay(p.data.date,true);
      else{const now=new Date().toISOString();await S.db.collection('skips').doc(uid()).set({name:p.data.name,amount:p.data.amount,date:today(),status:'pending',movedAt:null,goalId:null,createdAt:now})}
      p.state='saved';S.dotHopAt=Date.now();render();toast(p.kind==='zero'?'0円の日を記録しました':'がまんを記録しました')}catch(err){busy(el,false);toast(writeErr(err),{err:true})}return}
    if(a==='pedit'){S.form=blankForm({...p.data,amount:String(p.data.amount),source:'chat',chatProposal:el.dataset.pid});location.hash='#add-manual';return}
    busy(el,true);const now=new Date().toISOString();const d=p.data;const obj={...d,status:'confirmed',source:'chat',discount:0,tax:0,taxIncluded:true,receiptAssetId:null,refunded:0,refunds:[],createdAt:now,updatedAt:now};const nid=uid();
    try{await saveTxn(nid,obj);p.state='saved';render();toast('保存しました',{undo:async()=>{await S.db.collection('txns').doc(nid).delete();p.state='open';render()}})}catch(err){busy(el,false);toast(writeErr(err),{err:true})}return}
  if(a==='recur'){const r=settings().recurring.find(x=>x.id===id);if(r)startForm({type:'expense',amount:String(r.amount),merchant:r.name,category:r.category,method:r.method||'',source:'recurring',recurringId:r.id,date:(()=>{const d=new Date();d.setDate(toInt(r.day));return ymd(d)})()});return}
  if(a==='ibsave'){const x=S.inbox.find(i=>i.id===id);if(!x)return;startForm({type:'expense',amount:x.amount!=null?String(x.amount):'',date:x.date||today(),merchant:x.merchant||'',category:cats('expense').some(c=>c.id===x.category)?x.category:'',method:x.method||'',note:x.subject?`メール：${x.subject}`:'',items:(x.items||[]).map(i=>({name:i.name||'',qty:toInt(i.qty)||1,unit:i.unit??'',total:toInt(i.total),category:''})),source:x.source||'gmail',inboxId:x.id,uncertain:x.confidence==='low'?['amount','date']:[]});return}
  if(a==='ibdone'){setInbox(id,{status:'done'},'記録済みにしました');return}
  if(a==='ibno'){setInbox(id,{status:'dismissed'},'候補から外しました');return}
  if(a==='ibsnooze'){const d=new Date();d.setDate(d.getDate()+3);setInbox(id,{status:'snoozed',snoozeUntil:ymd(d)},'3日後にもう一度表示します');return}
  if(a==='iunit'){S.ins.unit=el.dataset.v;S.ins.offset=0;S.ins.sel=null;S.ins.day=null;S.ins.ai=null;render();return}
  if(a==='ioff'){S.ins.offset=Math.min(0,S.ins.offset+Number(el.dataset.v));S.ins.sel=null;S.ins.day=null;S.ins.ai=null;render();return}
  if(a==='isel'){S.ins.sel=S.ins.sel===+el.dataset.i?null:+el.dataset.i;render();return}
  if(a==='iai'){runInsightAI();return}
  if(a==='ifam'){S.ins.exFam=!S.ins.exFam;render();return}
  if(a.startsWith('s-')&&a!=='s-wipe'){settingsSheet(a);return}
  if(a==='restore'){restoreSheet();return}
  if(a==='rsok'){applyRestore(el);return}
  if(a==='exp'){const {data,name}=exportData(el.dataset.v);if(S.downloads){try{await S.downloads.save({filename:name,data});closeSheet();toast('書き出しました')}catch(err){toast('書き出しを中止しました',{err:true})}}else{try{await navigator.clipboard.writeText(data);toast('内容をコピーしました')}catch(err){toast('コピーできませんでした',{err:true})}}return}
  if(a==='s-wipe'){if(!S.txns.length){toast('削除する記録はありません');return}
    if(!await confirmDialog({title:'すべての記録を削除',body:`${S.txns.length}件の記録と、がまん貯金・0円の日・レシート画像をすべて削除します。この操作は元に戻せません。必要なら先にデータを書き出してください。`,ok:'すべて削除',danger:true,typeWord:'削除'}))return;
    const ids=S.txns.map(t=>t.id);const txnsBefore=Object.fromEntries(S.txns.map(t=>[t.id,t.receiptAssetId||null]));let n=0;toast('削除しています…');try{for(const i of ids){await S.db.collection('txns').doc(i).delete();n++}for(const x of S.skips.slice()){await S.db.collection('skips').doc(x.id).delete()}for(const d of Object.keys(S.days)){await S.db.collection('days').doc(d).delete()}const imgs=[...new Set(ids.map(i=>txnsBefore[i]).filter(Boolean))];for(const a of imgs){try{await S.assets?.delete(a)}catch(e){}}toast(`${n}件の記録を削除しました`)}catch(err){toast(`${n}件まで削除しました。${writeErr(err)}`,{err:true})}return}
});
document.addEventListener('input',e=>{
  const t=e.target;
  if(S.q&&t.id==='q-amount'){S.q.amount=t.value;S.q.dupAck=false;$('#q-err').textContent='';return}
  if(S.q&&t.id==='q-merchant'){S.q.merchant=t.value;S.q.dupAck=false;if(!S.q.category||S.q.catAuto){const g=guessCat(t.value,S.q.type);S.q.category=g;S.q.catAuto=!!g;drawQuick()}return}
  if(S.form&&t.dataset.f==='merchant'&&(S.form.type==='expense'||S.form.type==='income')&&(!S.form.category||S.form.catAuto)){const g=guessCat(t.value,S.form.type);S.form.category=g;S.form.catAuto=!!g;document.querySelectorAll('[data-act="fcat"]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===g));const h=$('#cat-hint');if(h)h.innerHTML=g?ic('sparkles','sm')+'自動で選びました':'';if(g&&$('#err-cat'))$('#err-cat').textContent=''}
  if(t.id==='hq'){S.hist.q=t.value;S.hist.limit=120;clearTimeout(S._hq);S._hq=setTimeout(render,180);return}
  if(S.form&&t.dataset.f){const k=t.dataset.f;S.form[k]=k==='taxIncluded'?t.value==='1':t.value;if(t.classList.contains('uncertain')){t.classList.remove('uncertain');S.form.uncertain=(S.form.uncertain||[]).filter(x=>x!==(k==='amount'?'amount':k)&&!(k==='amount'&&x==='total'))}updateDerived();return}
  if(S.form&&t.dataset.i!=null&&t.dataset.k){const it=S.form.items[+t.dataset.i];const k=t.dataset.k;it[k]=t.value;
    if(k==='qty'||k==='unit'){if(it.unit!==''&&it.unit!=null){it.total=toInt(it.qty||1)*toInt(it.unit);const tot=document.getElementById(`it-${t.dataset.i}-total`);if(tot)tot.value=it.total}}
    if(t.classList.contains('uncertain')){t.classList.remove('uncertain')}updateDerived();return}
});
document.addEventListener('change',e=>{
  const t=e.target;
  if(S.q&&t.id==='q-method'){S.q.method=t.value;return}
  if(S.q&&t.id==='q-date'){S.q.date=t.value||today();S.q.dupAck=false;drawQuick();return}
  if(/^h(type|cat|method|from|to)$/.test(t.id))S.hist.limit=120;
  if(t.id==='htype'){S.hist.type=t.value;render()}if(t.id==='hcat'){S.hist.cat=t.value;render()}if(t.id==='hmethod'){S.hist.method=t.value;render()}
  if(t.id==='hfrom'){S.hist.from=t.value;render()}if(t.id==='hto'){S.hist.to=t.value;render()}
  if(S.form&&(t.tagName==='SELECT')&&t.dataset.f){S.form[t.dataset.f]=t.dataset.f==='taxIncluded'?t.value==='1':t.value;if(t.dataset.f==='refundOf'){const x=S.txns.find(i=>i.id===t.value);if(x&&!S.form.amount)S.form.amount=String(toInt(x.amount)-toInt(x.refunded));render()}updateDerived()}
  if(t.dataset.restore){const f=t.files&&t.files[0];if(f)previewRestore(f);return}
  if(t.dataset.scan){const f=t.files&&t.files[0];t.value='';if(!f)return;if(t.dataset.scan==='chat'){location.hash='#add-scan';setTimeout(()=>handleScanFile(f),0)}else handleScanFile(f)}
});
document.addEventListener('submit',e=>{
  e.preventDefault();
  if(e.target.id==='txform')submitForm(false,$('#fsave'));
  if(e.target.id==='chatform'){const i=$('#chat-in');const v=i.value;i.value='';sendChat(v)}
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&$('#layer').innerHTML){const c=$('#cfn');if(c)c.click();else closeSheet()}
  if(e.target.id==='q-amount'&&e.key==='Enter'&&!e.isComposing){e.preventDefault();saveQuick($('#q-save'));return}
  if(e.target.id==='chat-in'&&e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('#chatform').requestSubmit()}
});
const ROUTES=['home','history','add','add-scan','add-chat','add-manual','insights','settings'];
function onHash(){const h=location.hash.slice(1);const r=ROUTES.includes(h)?h:'home';
  if(S.route==='add-manual'&&r!=='add-manual')S.form=null;
  if(S.route==='add-scan'&&r!=='add-scan'){S.scan=null;S.form=null}
  if(r==='add-manual'&&!S.form)S.form=blankForm();
  S.route=r;closeSheet();render();$('#main').focus({preventScroll:true})}
window.addEventListener('hashchange',onHash);
const net=()=>{S.online=navigator.onLine;const o=$('#offline');o.hidden=S.online;o.innerHTML=S.online?'':`${ic('cloudoff','sm')}オフラインです。接続が戻るまで保存できません。`};
window.addEventListener('online',net);window.addEventListener('offline',net);net();
S.route=ROUTES.includes(location.hash.slice(1))?location.hash.slice(1):'home';
boot();
