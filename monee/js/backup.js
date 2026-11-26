"use strict";
/* バックアップから戻す：今ある記録は消さずに「合体」する。同じ記録は新しく更新された方を残す。 */
const isYmd=s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s||''));
function parseBackup(text){
  let j;try{j=JSON.parse(text)}catch(e){throw new Error('JSONとして読めませんでした。monee.で書き出したファイルを選んでください。')}
  if(!j||!Array.isArray(j.transactions))throw new Error('monee.のバックアップではないようです（記録の一覧が見つかりません）。');
  const clean=o=>{const x={...o};delete x.id;return x};
  const txns=j.transactions.filter(t=>t&&t.id&&isYmd(t.date)&&['expense','income','transfer'].includes(t.type)&&Number.isFinite(Number(t.amount))).map(t=>[String(t.id),clean(t)]);
  const skips=(Array.isArray(j.gaman)?j.gaman:[]).filter(x=>x&&x.id&&isYmd(x.date)&&Number.isFinite(Number(x.amount))).map(x=>[String(x.id),clean(x)]);
  const days=Object.entries(j.days&&typeof j.days==='object'?j.days:{}).filter(([d,v])=>isYmd(d)&&v&&v.zero);
  return {txns,skips,days,settings:j.settings&&typeof j.settings==='object'?j.settings:null,skipped:j.transactions.length-txns.length,exportedAt:j.exportedAt||''};
}
function planRestore(b){ // 何件増える・更新される・同じか
  const cur=new Map(S.txns.map(t=>[t.id,t]));const p={add:[],update:[],same:0,skips:[],days:[]};
  for(const [id,t] of b.txns){const c=cur.get(id);if(!c)p.add.push([id,t]);else if((t.updatedAt||'')>(c.updatedAt||''))p.update.push([id,t]);else p.same++}
  const sk=new Set(S.skips.map(x=>x.id));p.skips=b.skips.filter(([id])=>!sk.has(id));
  p.days=b.days.filter(([d])=>!S.days[d]);
  return p;
}
function restoreSheet(){
  openSheet(`${sheetHead('バックアップから戻す')}<div class="stack"><p class="sub" style="margin:0">monee.で書き出したJSONファイルを選びます。今ある記録は消えません。同じ記録は、新しく更新された方を残します。</p>
   <label class="btn ghost block" for="rs-file">${ic('download','sm')}ファイルを選ぶ</label><input id="rs-file" type="file" accept="application/json,.json" class="sr-only" data-restore="1">
   <div id="rs-preview"></div></div>`,{label:'バックアップから戻す'});
}
async function previewRestore(file){
  const box=$('#rs-preview');if(!box)return;
  try{
    const b=parseBackup(await file.text());const p=planRestore(b);S._restore={b,p};
    const nothing=!p.add.length&&!p.update.length&&!p.skips.length&&!p.days.length;
    box.innerHTML=`<div class="card sm"><b>${esc(file.name)}</b>${b.exportedAt?`<div class="sub">${esc(b.exportedAt.slice(0,10))} に書き出したもの</div>`:''}
     <dl class="kv" style="margin-top:10px"><dt>新しく加わる記録</dt><dd class="num">${p.add.length}件</dd><dt>新しい内容で更新</dt><dd class="num">${p.update.length}件</dd><dt>すでに同じ</dt><dd class="num">${p.same}件</dd><dt>がまん貯金</dt><dd class="num">${p.skips.length}件</dd><dt>0円の日</dt><dd class="num">${p.days.length}日</dd></dl>
     ${b.skipped?`<p class="sub" style="margin:8px 0 0">読めなかった記録が${b.skipped}件あり、飛ばします。</p>`:''}</div>
     ${b.settings?`<label class="check"><input type="checkbox" id="rs-settings"><span>設定（予算・カテゴリなど）も、バックアップの内容に置き換える</span></label>`:''}
     <button class="btn primary block" data-act="rsok" ${nothing&&!b.settings?'disabled':''}>${nothing?'加わる記録はありません':'合体して戻す'}</button>`;
  }catch(e){S._restore=null;box.innerHTML=`<div class="notice danger">${ic('alert')}<div>${esc(e.message||'読めませんでした。')}</div></div>`}
}
async function applyRestore(btn){
  const r=S._restore;if(!r)return;const {b,p}=r;const withSettings=$('#rs-settings')?.checked;
  busy(btn,true,'戻しています…');let n=0;
  try{
    for(const [id,t] of [...p.add,...p.update]){await saveTxn(id,t);n++}
    for(const [id,x] of p.skips)await S.db.collection('skips').doc(id).set(x);
    for(const [d,v] of p.days)await S.db.collection('days').doc(d).set(v);
    if(withSettings&&b.settings){const s={...b.settings};delete s.id;await S.db.doc('config/settings').set({...DEFAULTS,...s})}
    S._restore=null;closeSheet();toast(`${n}件の記録を戻しました`);
  }catch(e){busy(btn,false);toast(`${n}件まで戻しました。${writeErr(e)}`,{err:true})}
}
/* レシート画像：記録を消したら画像も消す。「元に戻す」の間は待つ。ほかの記録が同じ画像を使っていれば消さない */
function deleteReceiptLater(assetId,isUndone){
  if(!assetId||!S.assets)return;
  setTimeout(()=>{if(isUndone())return;if(S.txns.some(t=>t.receiptAssetId===assetId))return;S.assets.delete(assetId).catch(()=>{})},7000);
}
