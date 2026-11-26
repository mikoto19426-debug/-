"use strict";
/* ================= Platform ================= */
async function cap(n){try{return window.claude?.use?await window.claude.use(n):null}catch(e){return null}}
async function boot(){
  render();
  const [db,user,sample,assets,downloads]=await Promise.all(['db','user','sample','assets','downloads'].map(cap));
  Object.assign(S,{db,user,sample,assets,downloads});
  if(user){try{S.canWrite=await user.can('data.write')}catch(e){}}
  if(!db){S.fatal='nodb';render();return}
  const timer=setTimeout(()=>{if(!S.ready.txns||!S.ready.settings){S.slow=true;render()}},10000);
  const done=()=>{if(S.ready.txns&&S.ready.settings){clearTimeout(timer);S.slow=false}};
  const onErr=e=>{clearTimeout(timer);S.fatal=e?.code||'error';render()};
  db.collection('txns').onSnapshot(snap=>{
    S.txns=snap.docs.filter(d=>d.exists).map(d=>({...d.data(),id:d.id})).sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.time||'').localeCompare(a.time||'')||(b.createdAt||'').localeCompare(a.createdAt||''));
    if(!snap.metadata.fromCache){S.ready.txns=true;done()}else if(!S.ready.txns&&snap.size){S.ready.txns=true}
    render();
  },onErr);
  db.doc('config/settings').onSnapshot(snap=>{S.settingsDoc=snap.exists?snap.data():null;if(!snap.metadata.fromCache){S.ready.settings=true;done()}render()},onErr);
  db.collection('inbox').onSnapshot(snap=>{S.inbox=snap.docs.filter(d=>d.exists).map(d=>({...d.data(),id:d.id}));S.ready.inbox=true;render()},()=>{S.ready.inbox=true});
  db.collection('days').onSnapshot(snap=>{const o={};snap.docs.forEach(d=>{if(d.exists)o[d.id]=d.data()});S.days=o;render()},()=>{});
  db.collection('skips').onSnapshot(snap=>{S.skips=snap.docs.filter(d=>d.exists).map(d=>({...d.data(),id:d.id})).sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.createdAt||'').localeCompare(a.createdAt||''));render()},()=>{});
}
const ready=()=>S.ready.txns&&S.ready.settings;
async function saveTxn(id,obj){await S.db.collection('txns').doc(id).set(obj)}
async function saveSettings(patch){const next={...settings(),...patch};delete next.id;await S.db.doc('config/settings').set(next)}
function writeErr(e){
  if(e?.code==='quota_exceeded')return '保存容量の上限に達しました。古い記録を削除してください。';
  if(e?.code==='invalid_argument'&&S.canWrite===false)return 'このページを編集する権限がありません。';
  if(!navigator.onLine)return 'オフラインのため保存できませんでした。接続を確認してもう一度お試しください。';
  return '保存できませんでした。もう一度お試しください。';
}

/* ================= UI primitives ================= */
function toast(msg,{err=false,undo=null}={}){
  const el=document.createElement('div');el.className='toast'+(err?' err':'');el.setAttribute('role',err?'alert':'status');
  el.innerHTML=`${ic(err?'alert':'check','sm')}<span>${esc(msg)}</span>${undo?'<button type="button">元に戻す</button>':''}`;
  if(undo)el.querySelector('button').onclick=async()=>{el.remove();try{await undo();toast('元に戻しました')}catch(e){toast(writeErr(e),{err:true})}};
  $('#toasts').appendChild(el);setTimeout(()=>el.remove(),undo?6500:3200);
}
let lastFocus=null;
function openSheet(html,{narrow=false,label='詳細'}={}){
  lastFocus=document.activeElement;
  $('#layer').innerHTML=`<div class="scrim" data-act="scrim"><div class="sheet ${narrow?'narrow':''}" role="dialog" aria-modal="true" aria-label="${esc(label)}"><div class="grab"></div>${html}</div></div>`;
  const f=$('#layer .sheet').querySelector('input,select,textarea,button:not([data-act="close"])')||$('#layer .sheet button');f&&f.focus({preventScroll:true});
}
function closeSheet(){$('#layer').innerHTML='';S.q=null;lastFocus&&lastFocus.focus?.({preventScroll:true})}
const sheetHead=t=>`<div class="sheet-h"><h2 class="s">${esc(t)}</h2><button class="iconbtn" data-act="close" aria-label="閉じる">${ic('x')}</button></div>`;
function confirmDialog({title,body,ok='OK',danger=false,typeWord=null}){
  return new Promise(res=>{
    openSheet(`${sheetHead(title)}<p style="margin:0 0 16px">${body}</p>${typeWord?`<label class="field" style="margin-bottom:16px"><span>確認のため「${esc(typeWord)}」と入力</span><input class="input" id="cfw" autocomplete="off"></label>`:''}
    <div class="grid2"><button class="btn ghost" id="cfn">キャンセル</button><button class="btn ${danger?'danger':'primary'}" id="cfy" ${typeWord?'disabled':''}>${esc(ok)}</button></div>`,{narrow:true,label:title});
    if(typeWord)$('#cfw').oninput=e=>$('#cfy').disabled=e.target.value.trim()!==typeWord;
    $('#cfn').onclick=()=>{closeSheet();res(false)};$('#cfy').onclick=()=>{closeSheet();res(true)};
    $('#layer .scrim').dataset.act='cfscrim';
  });
}
function busy(btn,on,label){if(!btn)return;if(on){btn.dataset.l=btn.innerHTML;btn.disabled=true;btn.innerHTML=`${ic('loader','sm spin')}${label||'保存中…'}`}else{btn.disabled=false;if(btn.dataset.l)btn.innerHTML=btn.dataset.l}}
const emptyState=(icon,t,d,action='')=>`<div class="empty">${`<div class="ic">${ic(icon,'lg')}</div>`}<div class="t">${t}</div><div style="font-size:13px">${d}</div>${action?`<div style="margin-top:14px">${action}</div>`:''}</div>`;
const catIcon=c=>`<span class="cat-ic" style="background:${esc(c.color)}" aria-hidden="true">${esc((c.name||'?').slice(0,1))}</span>`;

/* ================= Nav ================= */
const NAV=[['home','ホーム','home'],['history','履歴','receipt'],['add','追加','plus'],['insights','ふりかえり','chart'],['settings','設定','settings']];
function navHTML(){
  const top=S.route.split('-')[0];
  $('#bnav').innerHTML=NAV.map(([r,l,i])=>r==='add'?`<a href="#add" class="add" ${top==='add'?'aria-current="page"':''} aria-label="追加"><span class="fab">${ic('plus')}</span><span>${l}</span></a>`:`<a href="#${r}" ${top===r?'aria-current="page"':''}>${ic(i)}<span>${l}</span></a>`).join('');
  $('#sidebar').innerHTML=`<div class="logo">monee.</div><div class="tagline">Your money bestie.<br>A period on mindless spending.</div>`+NAV.filter(n=>n[0]!=='add').map(([r,l,i])=>`<a href="#${r}" ${top===r?'aria-current="page"':''}>${ic(i)}<span>${l}</span></a>`).join('')+`<a href="#add" class="addbtn" ${top==='add'?'aria-current="page"':''}>${ic('plus')}<span>記録する</span></a><div class="foot">データはこのページ専用の保存先にあり、共有しない限りあなたとClaudeだけが読めます。</div>`;
}

/* ================= Render ================= */
let lastRoute=null;
function render(){
  navHTML();
  const v=$('#view');const r=S.route;
  let html='';
  if(S.fatal)html=fatalView();
  else if(r==='home')html=homeView();
  else if(r==='history')html=historyView();
  else if(r==='add')html=addView();
  else if(r==='add-scan')html=scanView();
  else if(r==='add-chat')html=chatView();
  else if(r==='add-manual')html=formView();
  else if(r==='insights')html=insightsView();
  else if(r==='settings')html=settingsView();
  else html=homeView();
  // preserve focus/selection within inputs during live re-render
  const a=document.activeElement;const key=a&&a.id&&v.contains(a)?a.id:null;const sel=key&&a.selectionStart!=null?[a.selectionStart,a.selectionEnd]:null;
  const sy=window.scrollY;const changed=lastRoute!==r;
  v.innerHTML=html;
  if(key){const n=document.getElementById(key);if(n){n.focus({preventScroll:true});if(sel)try{n.setSelectionRange(...sel)}catch(e){}}}
  if(lastRoute!==r){window.scrollTo(0,0);lastRoute=r;if(r==='add-chat')requestAnimationFrame(()=>window.scrollTo(0,document.body.scrollHeight))}else window.scrollTo(0,sy);
  if(r==='add-manual'||r==='add-scan')updateDerived();
  if(changed&&r==='add-manual'&&S.form&&!S.form.editId&&!S.form.amount)requestAnimationFrame(()=>$('#f-amount')?.focus({preventScroll:true}));
}
function fatalView(){
  const msg=S.fatal==='nodb'?'データの保存先に接続できませんでした。Claudeにサインインした状態でこのページを開いているか確認してください。':S.fatal==='revoked'?'このページへのアクセスが変更されました。':'データを読み込めませんでした。少し時間をおいてから開き直してください。';
  return `<div class="topbar"><span class="logo">monee.</span></div><div class="card enter">${emptyState('cloudoff','接続できません',msg)}</div>`;
}
const skeleton=()=>`<div class="stack"><div class="sk" style="height:150px;border-radius:20px"></div><div class="grid2"><div class="sk" style="height:84px"></div><div class="sk" style="height:84px"></div></div><div class="sk" style="height:180px;border-radius:20px"></div></div>`;
const slowNote=()=>S.slow?`<div class="notice warn" style="margin-bottom:14px">${ic('cloudoff')}<div>データの読み込みに時間がかかっています。表示が最新でない可能性があります。</div></div>`:'';

