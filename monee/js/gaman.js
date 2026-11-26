"use strict";
/* がまん貯金 */
function skipTotals(from,to){let amt=0,n=0;for(const x of S.skips){if(inRange(x,from,to)){amt+=toInt(x.amount);n++}}return {amt,n}}
function jarSVG(n){
  const k=Math.min(n,15);const pos=[];for(let r=0;r<3;r++)for(let c=0;c<5;c++)pos.push([24+c*13,82-r*13]);
  return `<svg class="jar" viewBox="0 0 100 100" width="76" height="76" aria-hidden="true"><rect x="28" y="6" width="44" height="10" rx="4" fill="var(--sage)"/><path d="M22 18h56a6 6 0 0 1 6 6v62a8 8 0 0 1-8 8H24a8 8 0 0 1-8-8V24a6 6 0 0 1 6-6z" fill="var(--surface)" stroke="var(--sage)" stroke-width="2.5"/>${pos.slice(0,k).map(([x,y],i)=>`<circle class="coin" cx="${x}" cy="${y}" r="5.6" fill="${i%3===2?'var(--sage)':'var(--primary)'}" style="animation-delay:${i*40}ms"/>`).join('')}${n>15?`<text x="50" y="40" text-anchor="middle" font-size="13" font-weight="700" fill="var(--primary)">+${n-15}</text>`:''}</svg>`;
}
function gamanCard(){
  const m=rangeOf('month');const s=skipTotals(m.from,m.to),all=skipTotals('','');
  return `<section class="card sm gaman enter" aria-labelledby="gh"><div class="row" style="gap:16px">${jarSVG(s.n)}<div style="flex:1;min-width:0"><h2 class="label" id="gh" style="margin:0">今月のがまん貯金</h2><div class="num" style="font-size:28px;font-weight:600;line-height:1.25">${yen(s.amt)}</div><div class="sub num">${all.n?`${s.n}回 · これまでの合計 ${yen(all.amt)}`:'買うのをやめたら「がまんした！」。その金額がここに貯まります。'}</div></div></div>
  <div class="${all.n?'grid2':''}" style="margin-top:12px"><button class="btn primary sm ${all.n?'':'block'}" data-act="gaman">${ic('piggy','sm')}がまんした！</button>${all.n?`<button class="btn ghost sm" data-act="gamanlist">記録を見る</button>`:''}</div></section>`;
}

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

