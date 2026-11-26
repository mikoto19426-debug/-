"use strict";
/* 口座ごとの残高：ある日の残高を入れておき、その翌日からの記録で増減させる。
   settings.accounts = {支払い方法: 残高}, settings.accountsAsOf = 'YYYY-MM-DD'（この日の終わりの残高）
   カードの引き落とし機能がオンなら、カードは残高を持たず、引き落とし日に引き落とし口座から減らす。 */
function accountBalances(){
  if(!optOn('accounts'))return {};
  const st=settings();const cfg=st.accounts||{};const asOf=st.accountsAsOf||today();
  const cards=new Set(cardList().map(c=>c.method));const bal={};
  for(const m of st.methods)if(cfg[m]!=null&&cfg[m]!==''&&!cards.has(m))bal[m]=toInt(cfg[m]);
  const add=(m,v)=>{if(m in bal)bal[m]+=v};
  for(const t of S.txns){if(t.status==='cancelled'||t.status==='draft'||!(t.date>asOf))continue;
    if(t.type==='expense'){add(t.method,-paidAmount(t));if(t.lend?.settled&&(t.lend.settledAt||t.date)>asOf)add(t.method,toInt(t.lend.amount))}
    else if(t.type==='income')add(t.method,toInt(t.amount));
    else if(t.type==='transfer'){add(t.method,-toInt(t.amount));add(t.toMethod,toInt(t.amount))}}
  for(const c of cardList()){if(!(c.from in bal))continue;const next=new Date(parseD(asOf));next.setDate(next.getDate()+1);
    for(let p=cardNextPay(c,ymd(next)),k=0;ymd(p)<=today()&&k<60;k++){bal[c.from]-=cardStatement(c,p).amt;p=dayIn(p.getFullYear(),p.getMonth()+1,c.pay)}}
  return bal;
}
OPTIONS.push({
  id:'accounts',name:'口座ごとの残高',icon:'wallet',
  desc:'ある日の残高を入れておくと、そのあとの記録から、現金・銀行・交通系ICなどの今の残高を計算します。',
  section(){
    const b=accountBalances();const ks=Object.keys(b);
    if(!ks.length)return `<div class="card sm"><b>口座の残高</b><p class="sub" style="margin:6px 0 0">設定で、ある日の残高を入れてください。</p></div>`;
    const total=ks.reduce((a,k)=>a+b[k],0);
    return `<div class="card sm"><div class="between"><b>口座の残高</b><span class="num" style="font-weight:600">${total<0?'−':''}${yen(total)}</span></div>
     ${ks.map(k=>`<div class="between" style="padding:8px 0;border-bottom:1px solid var(--border)"><span>${esc(k)}</span><span class="num" style="${b[k]<0?'color:var(--danger);font-weight:600':''}">${b[k]<0?'−':''}${yen(b[k])}</span></div>`).join('')}
     <p class="sub" style="margin:8px 0 0">${fmtDay(settings().accountsAsOf||today())}の残高から計算。ずれてきたら設定で入れ直してください。</p></div>`;
  },
  dotLines(){const b=accountBalances();const neg=Object.entries(b).find(([,v])=>v<0);return neg?[{mood:'worried',text:`${neg[0]}の残高がマイナスになってるよ。記録もれか、入れた残高を確かめてみて。`}]:[]},
  sheet(){
    const st=settings();const cfg=st.accounts||{};const cards=new Set(cardList().map(c=>c.method));
    optSheet(this,`<label class="field"><span>この日の終わりの残高</span><input id="ac-asof" class="input" type="date" value="${esc(st.accountsAsOf||today())}"></label>
     <div class="stack" style="gap:8px">${st.methods.map(m=>cards.has(m)?`<div class="between sub"><span>${esc(m)}</span><span>カード（引き落としで計算）</span></div>`:`<div class="row" style="gap:10px"><label for="ac-${esc(m)}" style="flex:1;min-width:0" class="ell">${esc(m)}</label><div class="amount-wrap sm" style="width:150px;flex:none"><input id="ac-${esc(m)}" class="input num" style="padding-left:28px" inputmode="numeric" placeholder="使わない" data-ac="${esc(m)}" value="${cfg[m]!=null&&cfg[m]!==''?toInt(cfg[m]):''}"></div></div>`).join('')}</div>`);
    wireOptSheet(this,()=>{const o={};document.querySelectorAll('[data-ac]').forEach(i=>{if(i.value.trim()!=='')o[i.dataset.ac]=toInt(i.value)});return {accounts:o,accountsAsOf:$('#ac-asof').value||today()}});
  },
});
