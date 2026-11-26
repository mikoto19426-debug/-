"use strict";
/* 立て替え・割り勘：自分が払った支出のうち、あとで返してもらう分。
   記録に lend:{who, amount, settled, settledAt} を付ける。集計の支出は「自分の分」だけ（core.js の netExpense）。 */
const lendOpen=()=>S.txns.filter(t=>t.lend&&!t.lend.settled&&live(t));
OPTIONS.push({
  id:'split',name:'立て替え・割り勘',icon:'transfer',
  desc:'みんなの分をまとめて払ったとき、返してもらう金額を記録します。支出の集計には自分の分だけが入ります。',
  section(){
    const l=lendOpen();const sum=l.reduce((a,t)=>a+toInt(t.lend.amount),0);
    return `<div class="card sm"><div class="between"><b>立て替え中</b><span class="num" style="font-weight:600">${yen(sum)}</span></div>
     ${l.length?l.map(t=>`<div class="between" style="padding:10px 0;border-bottom:1px solid var(--border)"><div style="min-width:0"><div class="ell">${esc(t.lend.who||'だれか')}さん　<span class="sub">${esc(t.merchant||'')}・${fmtShort(t.date)}</span></div></div><div class="row" style="gap:8px;flex:none"><b class="num">${yen(t.lend.amount)}</b><button class="btn soft sm" data-opt="split" data-oact="settle" data-id="${esc(t.id)}">返してもらった</button></div></div>`).join(''):'<p class="sub" style="margin:6px 0 0">返してもらう予定のお金はありません。記録の詳細から「立て替え・割り勘にする」を選べます。</p>'}</div>`;
  },
  dotLines(){
    const old=lendOpen().filter(t=>daysUntil(t.date)<=-7)[0];
    return old?[{mood:'calm',text:`${old.lend.who||'だれか'}さんに立て替えた${yen(old.lend.amount)}、まだ返してもらってないよ。言いにくかったら、軽く聞いてみよう。`}]:[];
  },
  detailExtra(t){
    if(t.type!=='expense'||!live(t))return '';
    if(t.lend)return `<div class="notice plain" style="margin-top:14px">${ic('transfer','sm')}<div style="flex:1"><b>${esc(t.lend.who||'だれか')}さんから ${yen(t.lend.amount)} 返してもらう</b><div class="sub">${t.lend.settled?'返してもらいました':'まだ返してもらっていません'}。自分の分は ${yen(netExpense(t))} です。</div>
      <div class="row" style="gap:8px;margin-top:8px">${t.lend.settled?'':`<button class="btn soft sm" data-opt="split" data-oact="settle" data-id="${esc(t.id)}">返してもらった</button>`}<button class="btn ghost sm" data-opt="split" data-oact="unlend" data-id="${esc(t.id)}">やめる</button></div></div></div>`;
    return `<button class="btn ghost block" style="margin-top:14px" data-opt="split" data-oact="lendform" data-id="${esc(t.id)}">${ic('transfer','sm')}立て替え・割り勘にする</button>`;
  },
  sheet(){optSheet(this,'');wireOptSheet(this,()=>({}))},
  async act(a,el){
    const t=S.txns.find(x=>x.id===el.dataset.id);if(!t)return;const prev={...t};delete prev.id;
    const save=async(next,msg)=>{try{await saveTxn(t.id,next);closeSheet();toast(msg,{undo:()=>saveTxn(t.id,prev)})}catch(err){toast(writeErr(err),{err:true})}};
    if(a==='lendform'){const half=Math.floor((toInt(t.amount)-toInt(t.refunded))/2);
      openSheet(`${sheetHead('立て替え・割り勘にする')}<div class="stack"><p class="sub" style="margin:0">${esc(t.merchant||'')}（${yen(t.amount)}）のうち、返してもらう金額を入れます。</p>
       <label class="field"><span>だれから</span><input id="ln-who" class="input" maxlength="20" placeholder="例：さくら"></label>
       <label class="field"><span>返してもらう金額</span><div class="amount-wrap"><input id="ln-amt" class="input amount-in num" inputmode="numeric" value="${half}"></div></label>
       <div id="ln-err" class="sub" role="alert" style="color:var(--danger)"></div><button class="btn primary block" data-opt="split" data-oact="lendsave" data-id="${esc(t.id)}">保存する</button></div>`,{narrow:true,label:'立て替え・割り勘'});return}
    if(a==='lendsave'){const amt=toInt($('#ln-amt').value),max=toInt(t.amount)-toInt(t.refunded);if(amt<=0||amt>max){$('#ln-err').textContent=`1〜${yen(max)}の範囲で入れてください。`;return}
      return save({...prev,lend:{who:$('#ln-who').value.trim(),amount:amt,settled:false,settledAt:null},updatedAt:new Date().toISOString()},'立て替えを記録しました')}
    if(a==='settle')return save({...prev,lend:{...t.lend,settled:true,settledAt:today()},updatedAt:new Date().toISOString()},'返してもらったことを記録しました');
    if(a==='unlend'){const n={...prev,updatedAt:new Date().toISOString()};delete n.lend;return save(n,'立て替えをやめました')}
  },
});
