"use strict";
/* カードの引き落とし：締め日と引き落とし日から、次に引き落とされる金額を出す。
   settings.cards = [{method, close(締め日 0=月末), pay(翌月の引き落とし日 0=月末), from(引き落とし口座)}] */
const cardList=()=>optOn('card')?(settings().cards||[]).filter(c=>c.method):[];
const paidAmount=t=>Math.max(0,toInt(t.amount)-toInt(t.refunded)); // カードで実際に払った額（立て替え分も含む）
function cardNextPay(c,fromDs=today()){const d=parseD(fromDs);let p=dayIn(d.getFullYear(),d.getMonth(),c.pay);if(ymd(p)<fromDs)p=dayIn(d.getFullYear(),d.getMonth()+1,c.pay);return p}
function cardStatement(c,pay){ // 引き落とし日 pay（Date）に払う分：前々月の締め日の翌日〜前月の締め日
  const close=dayIn(pay.getFullYear(),pay.getMonth()-1,c.close),prev=dayIn(pay.getFullYear(),pay.getMonth()-2,c.close);
  const from=new Date(prev);from.setDate(from.getDate()+1);const f=ymd(from),t=ymd(close);
  const amt=S.txns.filter(x=>x.type==='expense'&&x.status!=='cancelled'&&x.status!=='draft'&&x.method===c.method&&x.date>=f&&x.date<=t).reduce((a,x)=>a+paidAmount(x),0);
  return {from:f,to:t,pay:ymd(pay),amt};
}
function cardNow(c){ // 次の引き落とし（確定分）と、締め前でまだ増える分
  const next=cardStatement(c,cardNextPay(c));const after=new Date(parseD(next.to));after.setDate(after.getDate()+1);const f=ymd(after);
  const open=S.txns.filter(x=>x.type==='expense'&&x.status!=='cancelled'&&x.status!=='draft'&&x.method===c.method&&x.date>=f&&x.date<=today()).reduce((a,x)=>a+paidAmount(x),0);
  return {next,open,openFrom:f};
}
OPTIONS.push({
  id:'card',name:'カードの引き落とし',icon:'card',
  desc:'締め日と引き落とし日を入れると、次にいくら引き落とされるかがわかります。',
  section(){
    const cs=cardList();if(!cs.length)return `<div class="card sm"><b>カードの引き落とし</b><p class="sub" style="margin:6px 0 0">設定でカードの締め日と引き落とし日を入れてください。</p></div>`;
    return cs.map(c=>{const n=cardNow(c);const dl=daysUntil(n.next.pay);return `<div class="card sm"><div class="between"><b class="ell">${esc(c.method)}</b><span class="sub">締め ${dayLabel(c.close)}・引き落とし ${dayLabel(c.pay)}</span></div>
     <div class="between" style="margin-top:8px"><span>${fmtDay(n.next.pay)}に引き落とし${dl===0?'（今日）':dl>0?`（あと${dl}日）`:''}</span><b class="num" style="font-size:18px">${yen(n.next.amt)}</b></div>
     <div class="sub">${fmtShort(n.next.from)}〜${fmtShort(n.next.to)}に使った分${c.from?`・${esc(c.from)}から`:''}</div>
     <div class="between" style="margin-top:8px"><span class="sub">締め前（${fmtShort(n.openFrom)}〜今日）</span><span class="num sub">${yen(n.open)}</span></div></div>`}).join('');
  },
  dotLines(){
    const out=[];for(const c of cardList()){const n=cardNow(c);const dl=daysUntil(n.next.pay);
      if(n.next.amt&&dl>=0&&dl<=5){let warn='';if(optOn('accounts')&&c.from){const b=accountBalances()[c.from];if(b!=null&&b<n.next.amt)warn=`${c.from}の残高が${yen(n.next.amt-b)}足りないかも。`}
        out.push({mood:warn?'worried':'calm',text:`${dl===0?'今日':`${dl}日後`}に${c.method}の引き落とし${yen(n.next.amt)}があるよ。${warn}`})}}
    return out;
  },
  sheet(){
    const st=settings();const cs=st.cards||[];const ms=st.methods;
    const row=(c,i)=>`<div class="card sm" style="margin-bottom:8px"><div class="grid2"><label class="field"><span>カード（支払い方法）</span><select class="input" data-cd="method" data-i="${i}">${ms.map(m=>`<option ${c.method===m?'selected':''}>${esc(m)}</option>`).join('')}</select></label><label class="field"><span>引き落とし口座</span><select class="input" data-cd="from" data-i="${i}"><option value="">未選択</option>${ms.map(m=>`<option ${c.from===m?'selected':''}>${esc(m)}</option>`).join('')}</select></label>
      <label class="field"><span>締め日（0=月末）</span><input class="input num" inputmode="numeric" data-cd="close" data-i="${i}" value="${toInt(c.close)}"></label><label class="field"><span>翌月の引き落とし日（0=月末）</span><input class="input num" inputmode="numeric" data-cd="pay" data-i="${i}" value="${toInt(c.pay)}"></label></div></div>`;
    const list=cs.length?cs:[{method:ms.find(m=>/カード/.test(m))||ms[0],close:15,pay:10,from:ms.find(m=>/銀行|口座/.test(m))||''}];
    optSheet(this,`<div id="cd-list">${list.map(row).join('')}</div><p class="sub" style="margin:0">よくある例：15日締め・翌月10日払い、月末締め・翌月27日払い。カードの明細で確認してください。</p>`);
    wireOptSheet(this,()=>{const out=list.map(()=>({}));document.querySelectorAll('[data-cd]').forEach(el=>{const o=out[+el.dataset.i];o[el.dataset.cd]=['close','pay'].includes(el.dataset.cd)?clamp(toInt(el.value),0,31):el.value});return {cards:out.filter(c=>c.method)}});
  },
});
