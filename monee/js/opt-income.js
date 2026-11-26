"use strict";
/* 収入の予定：給料日・仕送り日を入れると、次の入金まであと何日かを出す。
   settings.paydays = [{id, name, day(0=月末), amount, method}] */
function nextPaydays(){
  if(!optOn('income'))return [];
  const t0=today(),d=parseD(t0);
  return (settings().paydays||[]).map(p=>{let x=dayIn(d.getFullYear(),d.getMonth(),p.day);if(ymd(x)<t0)x=dayIn(d.getFullYear(),d.getMonth()+1,p.day);return {...p,date:ymd(x),days:daysUntil(ymd(x))}}).sort((a,b)=>a.days-b.days);
}
const receivedThisMonth=p=>{const m=rangeOf('month');return S.txns.some(t=>t.type==='income'&&live(t)&&inRange(t,m.from,m.to)&&(t.paydayId===p.id||norm(t.merchant)===norm(p.name)))};
OPTIONS.push({
  id:'income',name:'収入の予定',icon:'calendar',
  desc:'給料日や仕送り日を入れると、次の入金まであと何日か、それまで1日いくら使えるかがわかります。',
  heroLine(){const n=nextPaydays()[0];if(!n)return '';return `<div class="sub" style="margin-top:2px">次の入金：${esc(n.name)}（${fmtShort(n.date)}）${n.days?`まであと${n.days}日`:'は今日'}</div>`},
  section(){
    const ns=nextPaydays();if(!ns.length)return `<div class="card sm"><b>収入の予定</b><p class="sub" style="margin:6px 0 0">設定で、給料日や仕送り日を入れてください。</p></div>`;
    const b=accountBalances();const cash=Object.values(b).reduce((a,v)=>a+v,0);const n=ns[0];
    return `<div class="card sm"><div class="between"><b>収入の予定</b><span class="sub">次は${n.days?`あと${n.days}日`:'今日'}</span></div>
     ${ns.map(p=>`<div class="between" style="padding:8px 0;border-bottom:1px solid var(--border)"><span>${esc(p.name)}　<span class="sub">${fmtDay(p.date)}</span></span><span class="num">${p.amount?yen(p.amount):''}</span></div>`).join('')}
     ${optOn('accounts')&&Object.keys(b).length&&n.days>0?`<p style="margin:10px 0 0">${esc(n.name)}まで、残高から <b class="num">1日 ${yen(Math.max(0,Math.floor(cash/n.days)))}</b> 使えます。</p>`:''}</div>`;
  },
  dotLines(){const n=nextPaydays().find(p=>p.days===0&&!receivedThisMonth(p));
    return n?[{mood:'happy',text:`今日は${n.name}の日！入ったら記録しておこう。`,btn:['記録する',`data-opt="income" data-oact="record" data-id="${esc(n.id)}"`]}]:[]},
  sheet(){
    const ps=(settings().paydays||[]).map(p=>({...p}));const ms=settings().methods;
    const row=(p,i)=>`<div class="card sm" style="margin-bottom:8px"><label class="field"><span>名前</span><input class="input" maxlength="20" data-pd="name" data-i="${i}" value="${esc(p.name||'')}" placeholder="例：バイト代"></label>
      <div class="grid2" style="margin-top:8px"><label class="field"><span>毎月何日（0=月末）</span><input class="input num" inputmode="numeric" data-pd="day" data-i="${i}" value="${toInt(p.day)}"></label><label class="field"><span>金額（任意）</span><input class="input num" inputmode="numeric" data-pd="amount" data-i="${i}" value="${p.amount?toInt(p.amount):''}"></label></div>
      <label class="field" style="margin-top:8px"><span>入金先</span><select class="input" data-pd="method" data-i="${i}"><option value="">未選択</option>${ms.map(m=>`<option ${p.method===m?'selected':''}>${esc(m)}</option>`).join('')}</select></label></div>`;
    const list=ps.length?ps:[{id:uid(),name:'',day:25,amount:'',method:''}];list.push({id:uid(),name:'',day:25,amount:'',method:''});
    optSheet(this,`<div>${list.map(row).join('')}</div><p class="sub" style="margin:0">名前を空にした行は保存されません。</p>`);
    wireOptSheet(this,()=>{document.querySelectorAll('[data-pd]').forEach(el=>{const p=list[+el.dataset.i];const k=el.dataset.pd;p[k]=k==='day'?clamp(toInt(el.value),0,31):k==='amount'?(el.value.trim()?toInt(el.value):''):el.value.trim()});return {paydays:list.filter(p=>p.name)}});
  },
  act(a,el){if(a==='record'){const p=(settings().paydays||[]).find(x=>x.id===el.dataset.id);if(p)startForm({type:'income',amount:p.amount?String(p.amount):'',merchant:p.name,method:p.method||'',category:cats('income').some(c=>c.id==='job')&&/バイト|給/.test(p.name)?'job':cats('income').some(c=>c.id==='allow')&&/仕送り|小遣/.test(p.name)?'allow':'',paydayId:p.id})}},
});
