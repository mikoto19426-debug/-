"use strict";
/* がまん貯金：買うのをやめた金額。実際に貯金箱や口座へ「移した」ときだけ貯金として数える。
   status: pending=まだ移していない / moved=移した（古い記録で goalId があるものは移した扱い） */
const gState=x=>x.status||(x.goalId?'moved':'pending');
function skipTotals(from,to){
  const o={amt:0,n:0,moved:0,pending:0,nPending:0};
  for(const x of S.skips){if(!inRange(x,from,to))continue;const a=toInt(x.amount);o.amt+=a;o.n++;if(gState(x)==='moved')o.moved+=a;else{o.pending+=a;o.nPending++}}
  return o;
}
const pendingSkips=()=>S.skips.filter(x=>gState(x)==='pending');
function jarSVG(list){ // 移した分は塗りつぶしの玉、まだの分は輪郭だけの玉
  const sorted=[...list].sort((a,b)=>(gState(a)==='moved'?0:1)-(gState(b)==='moved'?0:1));
  const k=Math.min(sorted.length,15);const pos=[];for(let r=0;r<3;r++)for(let c=0;c<5;c++)pos.push([24+c*13,82-r*13]);
  const coin=(x,[cx,cy],i)=>gState(x)==='moved'?`<circle class="coin" cx="${cx}" cy="${cy}" r="5.6" fill="var(--primary)" style="animation-delay:${i*40}ms"/>`:`<circle class="coin" cx="${cx}" cy="${cy}" r="4.8" fill="none" stroke="var(--primary)" stroke-width="1.8" style="animation-delay:${i*40}ms"/>`;
  return `<svg class="jar" viewBox="0 0 100 100" width="76" height="76" aria-hidden="true"><rect x="28" y="6" width="44" height="10" rx="4" fill="var(--sage)"/><path d="M22 18h56a6 6 0 0 1 6 6v62a8 8 0 0 1-8 8H24a8 8 0 0 1-8-8V24a6 6 0 0 1 6-6z" fill="var(--surface)" stroke="var(--sage)" stroke-width="2.5"/>${sorted.slice(0,k).map((x,i)=>coin(x,pos[i],i)).join('')}${sorted.length>15?`<text x="50" y="40" text-anchor="middle" font-size="13" font-weight="700" fill="var(--primary)">+${sorted.length-15}</text>`:''}</svg>`;
}
function gamanCard(){
  const m=rangeOf('month');const s=skipTotals(m.from,m.to),all=skipTotals('','');
  const list=S.skips.filter(x=>inRange(x,m.from,m.to));
  return `<div class="card sm gaman enter"><div class="row" style="gap:16px">${jarSVG(list)}<div style="flex:1;min-width:0"><div class="label">今月、がまんした金額</div><div class="num" style="font-size:28px;font-weight:600;line-height:1.25">${yen(s.amt)}</div>
   <div class="sub num">${all.n?`貯金に移した ${yen(s.moved)}　まだ ${yen(s.pending)}`:'買うのをやめたら「がまんした」。本当に貯金へ移したら「移した」で確定します。'}</div></div></div>
   <div class="grid2" style="margin-top:12px"><button class="btn primary sm" data-act="gaman">${ic('piggy','sm')}がまんした</button>${all.nPending?`<button class="btn ghost sm" data-act="gmove">移した（<span class="num">${yen(all.pending)}</span>）</button>`:`<button class="btn ghost sm" data-act="gamanlist" ${all.n?'':'disabled'}>記録を見る</button>`}</div>
   ${all.nPending&&all.n?`<button class="link" data-act="gamanlist" style="margin-top:4px">記録を見る${ic('right','sm')}</button>`:''}</div>`;
}

function gamanSheet(){
  const fv=favorites();
  openSheet(`${sheetHead('がまんした')}<p class="sub" style="margin-top:0">買うのをやめたものを記録します。実際に貯金箱や口座へ移すまでは「まだ」として分けて数えます。</p>
  <div class="stack" style="gap:14px">
   ${fv.length?`<div><div class="label" style="margin-bottom:6px">いつものをがまん</div><div class="favs">${fv.map(t=>`<button type="button" class="fav" data-act="gpick" data-n="${esc(t.merchant)}" data-a="${toInt(t.amount)}">${catIcon(catBy(t.category))}<span style="min-width:0"><span class="fn ell" style="display:block">${esc(t.merchant)}</span><span class="fa num">${yen(t.amount)}</span></span></button>`).join('')}</div></div>`:''}
   <label class="field"><span>がまんしたもの</span><input id="g-name" class="input" maxlength="40" list="dl-m" autocomplete="off" placeholder="例：コンビニのお菓子">${merchantDL()}</label>
   <label class="field"><span>金額</span><div class="amount-wrap"><input id="g-amt" class="input amount-in num" inputmode="numeric" autocomplete="off" placeholder="0"></div></label>
   <label class="check"><input type="checkbox" id="g-moved"><span>もう貯金箱や口座に移した</span></label>
   <div id="g-err" class="sub" role="alert" style="color:var(--danger)"></div>
   <button class="btn primary block" data-act="gsave" style="min-height:52px">${ic('piggy','sm')}記録する</button>
  </div>`,{label:'がまんした'});
  $('#g-name')?.focus();
}
async function saveGaman(btn){
  const n=$('#g-name').value.trim(),a=toInt($('#g-amt').value),moved=$('#g-moved').checked;
  if(a<=0){$('#g-err').textContent='金額を入力してください。';$('#g-amt').focus();return}
  const id=uid();const now=new Date().toISOString();busy(btn,true);
  try{
    await S.db.collection('skips').doc(id).set({name:n||'がまん',amount:a,date:today(),status:moved?'moved':'pending',movedAt:moved?now:null,goalId:null,createdAt:now});
    closeSheet();S.dotI=0;S.dotHopAt=Date.now();render();
    toast(moved?`ドット：${yen(a)} 貯金できたね！`:`ドット：${yen(a)} がまんできたね。移したら教えてね`,{undo:()=>S.db.collection('skips').doc(id).delete()});
  }catch(e){busy(btn,false);toast(writeErr(e),{err:true})}
}
function gamanMoveSheet(){
  const pend=pendingSkips();const sum=pend.reduce((a,x)=>a+toInt(x.amount),0);const goals=settings().goals;
  if(!pend.length){toast('まだ移していないがまんはありません');return}
  openSheet(`${sheetHead('貯金に移した')}<p style="margin-top:0">まだ移していないがまんが <b class="num">${pend.length}件・${yen(sum)}</b> あります。実際に貯金箱や口座へ移したら、ここで確定してください。</p>
   <div class="stack" style="gap:14px">${goals.length?`<label class="field"><span>貯金の目標に足す（任意）</span><select id="gm-goal" class="input"><option value="">足さない</option>${goals.map(g=>`<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('')}</select></label>`:''}
   <button class="btn primary block" data-act="gmoveok" style="min-height:52px">${ic('check','sm')}<span class="num">${yen(sum)}</span> を移した</button></div>`,{narrow:true,label:'貯金に移した'});
}
async function confirmMove(btn){
  const pend=pendingSkips();const sum=pend.reduce((a,x)=>a+toInt(x.amount),0);const gid=$('#gm-goal')?.value||'';const now=new Date().toISOString();
  busy(btn,true);const before=pend.map(x=>{const o={...x};delete o.id;return [x.id,o]});let prevGoals=null;
  try{
    for(const [id,o] of before)await S.db.collection('skips').doc(id).set({...o,status:'moved',movedAt:now,goalId:gid||null});
    if(gid){const st=settings();prevGoals=st.goals;await saveSettings({goals:st.goals.map(g=>g.id===gid?{...g,saved:toInt(g.saved)+sum}:g)})}
    closeSheet();S.dotHopAt=Date.now();
    toast(`ドット：${yen(sum)} 貯金できたね！`,{undo:async()=>{for(const [id,o] of before)await S.db.collection('skips').doc(id).set(o);if(prevGoals)await saveSettings({goals:prevGoals})}});
  }catch(e){busy(btn,false);toast(writeErr(e),{err:true})}
}
function gamanList(){
  const all=skipTotals('','');
  openSheet(`${sheetHead('がまん貯金の記録')}<div class="row" style="gap:14px;margin-bottom:8px">${jarSVG(S.skips)}<div><div class="label">これまでにがまんした金額</div><div class="num" style="font-size:28px;font-weight:600">${yen(all.amt)}</div><div class="sub num">貯金に移した ${yen(all.moved)}　まだ ${yen(all.pending)}</div></div></div>
  <div>${S.skips.slice(0,60).map(x=>`<div class="between" style="padding:10px 0;border-bottom:1px solid var(--border)"><div style="min-width:0"><div class="ell" style="font-weight:500">${esc(x.name)}</div><div class="sub">${fmtDay(x.date)}　${gState(x)==='moved'?'移した':'まだ'}</div></div><div class="row" style="gap:4px;flex:none"><b class="num">${yen(x.amount)}</b><button class="iconbtn" data-act="gdel" data-id="${esc(x.id)}" aria-label="${esc(x.name)}を削除">${ic('trash','sm')}</button></div></div>`).join('')}</div>
  <p class="sub" style="margin-bottom:0">削除しても、貯金の目標に足した金額はそのままです（設定の「貯金の目標」で直せます）。</p>`,{label:'がまん貯金の記録'});
}
