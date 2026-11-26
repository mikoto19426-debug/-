"use strict";
/* ---------- Weekly review ---------- */
const isFam=t=>/かぞくのおさいふ/.test(t.note||'');
function wasteType(t){
  if(t.recurringId)return null;const txt=(t.merchant||'')+' '+(t.note||'');const e=netExpense(t);if(!e)return null;
  if(t.category==='cafe')return 'カフェ';
  if(t.category==='transport'&&/タクシー|uber/i.test(txt))return 'タクシー';
  if(/解約/.test(t.note||''))return '解約したサブスク';
  if(t.category==='food'&&e<1000&&/ファミリーマート|ファミマ|セブン|ローソン|まいばすけっと|自動販売機|自販機|物販|生協|購買/.test(txt))return 'コンビニ・自販機・購買';
  return null;
}
function weekStat(from,to,exFam){
  let exp=0,waste=0,wn=0,days=new Set();const byType={},items=[];
  for(const t of S.txns){if(!inRange(t,from,to))continue;if(exFam&&isFam(t))continue;const e=netExpense(t);if(!e)continue;exp+=e;days.add(t.date);const w=wasteType(t);if(w){waste+=e;wn++;byType[w]=byType[w]||{n:0,amt:0};byType[w].n++;byType[w].amt+=e;items.push({t,e,w})}}
  return {exp,waste,wn,byType,items:items.sort((a,b)=>b.e-a.e),days:days.size};
}
const WASTE_TIP={'コンビニ・自販機・購買':'飲み物は水筒やペットボトルを家から持っていくと、ここがいちばん減らしやすいよ。','カフェ':'カフェは「週◯回まで」と回数を決めておくと、楽しみは残したまま減らせるよ。','タクシー':'タクシーは出発を15分早めるだけで、電車に置きかえられることが多いよ。','解約したサブスク':'無料体験やお試しの終了日をカレンダーに入れておくと、うっかり課金を防げるよ。'};
function weeklyReview(I){
  const r=rangeOf('week',I.offset),pv=prevSameElapsed('week',I.offset);const ex=!!I.exFam;
  const cur=weekStat(r.from,r.to,ex),prev=weekStat(pv.from,pv.to,ex);
  const partial=I.offset===0;const hasPrev=S.txns.some(t=>t.date<r.from&&netExpense(t));
  const d=cur.exp-prev.exp,wd=cur.waste-prev.waste;
  const pc=(a,b)=>b?`（${a-b>0?'+':''}${Math.round((a-b)/b*100)}%）`:'';
  let grade,gl,msg;
  if(!hasPrev||!prev.exp){grade='—';gl='';msg='先週の記録がまだないので、比較は来週からだよ。まずは今週の数字を基準にしよう。'}
  else{const sc=(d<0?1:0)+(wd<0?1:0)+(d<0&&wd<=0&&cur.wn<=prev.wn?0:0);
    if(sc===2){grade='◎';gl='いい感じ！';msg=`支出も無駄遣いっぽい出費も${partial?'先週の同じ曜日まで':'先週'}より減ってるよ。`}
    else if(sc===1){grade='○';gl='まずまず';msg=d<0?`支出全体は減ったけど、無駄遣いっぽい出費は${wd>0?'少し増えたよ':'横ばいだよ'}。`:`支出全体は増えたけど、無駄遣いっぽい出費は減ってるよ。大きな出費は必要なものだったか見直してみよう。`}
    else{grade='△';gl='来週がんばろう';msg=`${partial?'先週の同じ曜日まで':'先週'}と比べて、支出も無駄遣いっぽい出費も増えてるよ。`}}
  const topW=Object.entries(cur.byType).sort((a,b)=>b[1].amt-a[1].amt)[0];
  const tip=topW?WASTE_TIP[topW[0]]:'';
  // 8-week trend
  const wk=[];for(let k=7;k>=0;k--){const rr=rangeOf('week',I.offset-k);const s=weekStat(rr.from,rr.to,ex);wk.push({label:fmtShort(rr.from),from:rr.from,to:rr.to,...s})}
  const first=wk.findIndex(w=>w.exp>0);const ws=first<0?wk.slice(-1):wk.slice(Math.max(0,first));
  const max=Math.max(1,...ws.map(w=>w.exp));const W=640,H=200,pb=30,n=ws.length,bw=W/Math.max(n,4);
  const svg=`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="週ごとの支出の推移"><line x1="0" x2="${W}" y1="${H-pb}" y2="${H-pb}" stroke="var(--border)"/>${ws.map((w,i)=>{const h=w.exp/max*(H-pb-18),hw=w.waste/max*(H-pb-18);const x=i*bw;const last=i===n-1;return `<rect class="b ${last?'cur':''}" x="${x+bw*.2}" y="${H-pb-h}" width="${bw*.6}" height="${Math.max(h,w.exp?2:0)}" rx="4"/>${w.waste?`<rect x="${x+bw*.2}" y="${H-pb-hw}" width="${bw*.6}" height="${Math.max(hw,2)}" rx="3" style="fill:#D99A8B"/>`:''}<text x="${x+bw/2}" y="${H-9}" text-anchor="middle">${w.label}〜</text><text x="${x+bw/2}" y="${Math.max(12,H-pb-h-5)}" text-anchor="middle" style="font-size:12px">${w.exp>=10000?(w.exp/10000).toFixed(1)+'万':w.exp.toLocaleString('ja-JP')}</text><title>${w.label}〜 支出${yen(w.exp)}・無駄遣いっぽい${yen(w.waste)}</title>`}).join('')}</svg>`;
  const row=(l,a,b)=>`<div class="between" style="padding:8px 0;border-bottom:1px solid var(--border)"><span>${l}</span><span class="num" style="text-align:right"><b>${yen(a)}</b>${prev.exp&&hasPrev?`<span class="sub" style="display:block;font-size:12px">${partial?'先週同時点':'先週'} ${yen(b)} → ${syen(a-b,a-b>0?1:a-b<0?-1:0)}${pc(a,b)}</span>`:''}</span></div>`;
  const famN=S.txns.filter(t=>inRange(t,r.from,r.to)&&isFam(t)&&netExpense(t)).length;
  return `<section class="section"><div class="sec-h"><h2 class="s">今週の評価</h2>${partial?'<span class="pill">途中経過</span>':''}</div><div class="card">
   <div class="row" style="gap:14px;align-items:center;margin-bottom:10px"><div style="font-size:40px;line-height:1;font-weight:700;color:var(--primary)">${grade}</div><div><b>${gl||'今週の記録'}</b><div class="sub" style="font-size:14px">${esc(msg)}</div></div></div>
   ${row('支出の合計',cur.exp,prev.exp)}${row(`無駄遣いっぽい出費（${cur.wn}回）`,cur.waste,prev.waste)}
   <div class="between" style="padding:8px 0"><span>記録した日</span><span class="num">${cur.days}日 · 1日平均 ${yen(cur.days?cur.exp/Math.max(1,Math.round((parseD(partial?today():r.to)-parseD(r.from))/864e5)+1):0)}</span></div>
   ${famN?`<label class="check" style="margin-top:6px"><input type="checkbox" data-act="ifam" ${ex?'checked':''}> かぞくのおさいふの支出（${famN}件）を除いて計算する</label>`:''}
   ${tip?`<div class="notice" style="margin-top:10px;padding:12px">${ic('info','sm')}<div style="font-size:14px">${esc(tip)}</div></div>`:''}
  </div></section>
  <section class="section"><div class="sec-h"><h2 class="s">週ごとの推移</h2><span class="sub" style="display:inline-flex;align-items:center;gap:4px"><span class="dot" style="background:#D99A8B"></span>無駄遣いっぽい出費</span></div><div class="card">${svg}<table class="sr-only"><caption>週ごとの支出</caption>${ws.map(w=>`<tr><th>${w.label}〜</th><td>${yen(w.exp)}</td><td>${yen(w.waste)}</td></tr>`).join('')}</table></div></section>
  <section class="section"><div class="sec-h"><h2 class="s">無駄遣いっぽい出費の内訳</h2></div><div class="card" style="padding:8px 16px">${Object.keys(cur.byType).length?Object.entries(cur.byType).sort((a,b)=>b[1].amt-a[1].amt).map(([k,v])=>{const p=prev.byType[k];return `<div class="between" style="padding:10px 0;border-bottom:1px solid var(--border)"><span class="ell">${esc(k)}</span><span class="sub num" style="flex:none">${v.n}回 · <b style="color:var(--text-primary)">${yen(v.amt)}</b>${hasPrev&&prev.exp?` <span style="font-size:12px">(先週 ${p?p.n:0}回)</span>`:''}</span></div>`}).join(''):emptyState('check','無駄遣いっぽい出費はなし','この週はコンビニ・カフェ・タクシーなどの出費がありませんでした。')}<p class="sub" style="font-size:12px;margin:10px 0 4px">コンビニ・自販機・購買での1,000円未満の食費、カフェ、タクシー、解約したサブスクを集計しています。定期の支払いは含みません。</p></div></section>`;
}

/* ---------- Monthly review & calendar ---------- */
function monthlyReview(r,pv,cur,prev){
  const isCur=S.ins.offset===0;const end=isCur?today():r.to;
  const spent=new Set(S.txns.filter(t=>inRange(t,r.from,end)&&netExpense(t)).map(t=>t.date));
  const elapsed=Math.round((parseD(end)-parseD(r.from))/864e5)+1;
  const zero=Math.max(0,elapsed-spent.size);const avg=cur.exp/Math.max(1,elapsed);
  const big=S.txns.filter(t=>inRange(t,r.from,r.to)&&netExpense(t)).sort((a,b)=>netExpense(b)-netExpense(a)).slice(0,3);
  const ids=new Set([...cur.byCat.map(x=>x.cat),...prev.byCat.map(x=>x.cat)]);
  const ch=[...ids].map(id=>({c:catBy(id),d:(cur.byCat.find(x=>x.cat===id)?.amt||0)-(prev.byCat.find(x=>x.cat===id)?.amt||0)}));
  const ups=ch.filter(x=>x.d>0).sort((a,b)=>b.d-a.d).slice(0,2),downs=ch.filter(x=>x.d<0).sort((a,b)=>a.d-b.d).slice(0,2);
  const hasPrev=prev.exp>0;const lbl=pv.partial?'先月の同じ日まで':'先月';
  const chRow=x=>`<div class="between" style="padding:8px 0;border-bottom:1px solid var(--border)"><span class="row" style="gap:8px;min-width:0"><span class="dot" style="background:${esc(x.c.color)}"></span><span class="ell">${esc(x.c.name)}</span></span><span class="num" style="font-weight:600;flex:none;color:${x.d>0?'var(--warn-text)':'var(--primary)'}">${syen(x.d,x.d>0?1:-1)}</span></div>`;
  let msg;
  if(!cur.exp)msg='この月の支出はまだありません。';
  else if(!hasPrev)msg='先月の記録がないので、比較は来月からです。今月の数字を基準にしましょう。';
  else{const d=cur.exp-prev.exp;msg=d<=0?`${lbl}より ${yen(-d)} 少なく済んでいます。この調子！`:`${lbl}より ${yen(d)} 多く使っています。${ups[0]?`いちばん増えたのは「${ups[0].c.name}」です。`:''}`}
  return `<section class="section"><div class="sec-h"><h2 class="s">${isCur?'今月':'この月'}のふりかえり</h2>${isCur?'<span class="pill">途中経過</span>':''}</div><div class="card">
   <p style="margin:0 0 12px;font-size:15px">${esc(msg)}</p>
   <div class="stat3"><div><div class="label">支出0円の日</div><div class="v num">${zero}<span style="font-size:13px">日</span></div></div><div><div class="label">1日平均</div><div class="v num">${yen(avg)}</div></div><div><div class="label">支出の件数</div><div class="v num">${cur.count}<span style="font-size:13px">件</span></div></div></div>
   ${hasPrev&&(ups.length||downs.length)?`<div class="grid2" style="margin-top:14px;align-items:start;grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">${ups.length?`<div><div class="label">${lbl}より増えた</div>${ups.map(chRow).join('')}</div>`:''}${downs.length?`<div><div class="label">${lbl}より減った</div>${downs.map(chRow).join('')}</div>`:''}</div>`:''}
   ${(()=>{const sk=skipTotals(r.from,r.to),ft=feelTotals(r.from,r.to);return sk.n||ft.bad?`<div style="margin-top:12px">${sk.n?`<div class="between" style="padding:7px 0;border-bottom:1px solid var(--border)"><span class="row" style="gap:8px;color:var(--primary)">${ic('piggy','sm')}<span style="color:var(--text-primary)">がまん貯金</span></span><span class="num"><b>${yen(sk.amt)}</b> <span class="sub">${sk.n}回</span></span></div>`:''}${ft.bad?`<div class="between" style="padding:7px 0;border-bottom:1px solid var(--border)"><span class="row" style="gap:8px">${faceSVG('bad',18)}モヤっと出費</span><span class="num"><b>${yen(ft.bad)}</b> <span class="sub">${ft.n.bad}件</span></span></div>`:''}</div>`:''})()}
   ${big.length?`<div class="label" style="margin-top:16px">大きな出費</div><div>${big.map(txRow).join('')}</div>`:''}
  </div></section>`;
}
function calendarSection(r){
  const ws=settings().weekStart;const t0=today();
  const vals={};S.txns.forEach(t=>{if(inRange(t,r.from,r.to)){const e=netExpense(t);if(e)vals[t.date]=(vals[t.date]||0)+e}});
  const max=Math.max(1,...Object.values(vals));
  const lead=(r.a.getDay()-ws+7)%7;const dim=r.b.getDate();
  const short=v=>v>=100000?Math.round(v/10000)+'万':v.toLocaleString('ja-JP');
  let cells=[...Array(7)].map((_,i)=>`<div class="wd" aria-hidden="true">${WD[(i+ws)%7]}</div>`).join('')+'<div aria-hidden="true"></div>'.repeat(lead);
  for(let d=1;d<=dim;d++){const ds=`${r.a.getFullYear()}-${pad(r.a.getMonth()+1)}-${pad(d)}`;const v=vals[ds]||0;const fut=ds>t0;const q=v/max;const lv=v?(q<=.25?1:q<=.5?2:q<=.75?3:4):0;
    cells+=`<button type="button" class="${lv?'l'+lv:''}${!v&&!fut?' zero':''}${fut?' fut':''}${ds===t0?' today':''}" data-act="iday" data-d="${ds}" aria-pressed="${S.ins.day===ds}" aria-label="${fmtDay(ds)} ${v?yen(v):fut?'':'支出なし'}"><span class="dn">${d}</span><span class="da">${v?short(v):fut?'&nbsp;':'0'}</span></button>`}
  const sel=S.ins.day&&S.ins.day>=r.from&&S.ins.day<=r.to?S.ins.day:null;
  const dayList=sel?S.txns.filter(t=>t.date===sel):[];const dayTot=dayList.reduce((a,t)=>a+netExpense(t),0);
  return `<section class="section"><div class="sec-h"><h2 class="s">カレンダー</h2><span class="sub">日付をタップで記録を表示</span></div><div class="card"><div class="cal">${cells}</div>
   <div class="cal-leg"><span>少</span><i style="background:var(--heat1)"></i><i style="background:var(--heat2)"></i><i style="background:var(--heat3)"></i><i style="background:var(--heat4)"></i><span>多</span><span style="margin-left:10px;color:var(--primary);font-weight:700">0</span><span>= 支出なし</span></div>
   ${sel?`<div style="margin-top:14px;border-top:1px solid var(--border);padding-top:10px"><div class="between" style="margin-bottom:2px"><b>${fmtDay(sel)}</b><span class="num sub">${dayTot?'支出 '+yen(dayTot):''}</span></div>${dayList.length?dayList.map(txRow).join(''):`<p class="sub" style="margin:6px 0 10px">この日の記録はありません。</p>`}<button class="btn soft sm" style="margin-top:8px" data-act="quickday" data-d="${sel}">${ic('plus','sm')}この日の記録を追加</button></div>`:''}
  </div></section>`;
}

/* ---------- お知らせ（ふりかえりの先頭に出す） ---------- */
function notices(){
  const st=settings();const out=[];const m=rangeOf('month');const {exp}=totals(m.from,m.to);
  const pend=S.inbox.filter(x=>x.status==='pending'||(x.status==='snoozed'&&(x.snoozeUntil||'')<=today()));
  if(pend.length)out.push(`<button class="notice info" style="width:100%;text-align:left;border:1px solid var(--info-border)" data-go="add">${ic('mail')}<div style="flex:1"><b>確認待ちの候補が${pend.length}件</b><div class="sub">メールなどから見つかった支出です。確認してから保存されます。</div></div>${ic('right','sm')}</button>`);
  if(st.budget&&exp>toInt(st.budget))out.push(`<div class="notice danger">${ic('alert')}<div><b>予算を${yen(exp-toInt(st.budget))}超えています</b><div class="sub">残りの日は大きな出費を控えめに。</div></div></div>`);
  else if(st.budget&&exp/toInt(st.budget)*100>=st.alertAt)out.push(`<div class="notice warn">${ic('alert')}<div><b>予算の${Math.round(exp/toInt(st.budget)*100)}%を使いました</b><div class="sub">残りは ${yen(toInt(st.budget)-exp)} です。</div></div></div>`);
  for(const x of catBudgets(m.from,m.to).slice(0,3)){if(x.used>x.bud)out.push(`<div class="notice danger">${ic('alert')}<div><b>${esc(x.c.name)}が予算を${yen(x.used-x.bud)}超えました</b><div class="sub num">${yen(x.used)} ／ 予算 ${yen(x.bud)}</div></div></div>`);else if(x.pct>=st.alertAt)out.push(`<div class="notice warn">${ic('alert')}<div><b>${esc(x.c.name)}が予算の${Math.round(x.pct)}%に達しました</b><div class="sub num">残り ${yen(x.bud-x.used)}</div></div></div>`)}
  const drafts=S.txns.filter(t=>t.status==='draft');
  if(drafts.length)out.push(`<button class="notice warn" style="width:100%;text-align:left" data-act="drafts">${ic('pencil')}<div style="flex:1"><b>下書きが${drafts.length}件あります</b><div class="sub">確定するまで集計には入りません。</div></div>${ic('right','sm')}</button>`);
  const d=new Date().getDate();
  for(const r of st.recurring){if(toInt(r.day)>d)continue;const has=S.txns.some(t=>t.recurringId===r.id&&inRange(t,m.from,m.to));if(!has)out.push(`<div class="notice plain">${ic('repeat')}<div style="flex:1"><b>${esc(r.name)}（${yen(r.amount)}）</b><div class="sub">毎月${toInt(r.day)}日の定期支払いが今月まだ記録されていません。</div></div><button class="btn soft sm" data-act="recur" data-id="${esc(r.id)}">記録</button></div>`)}
  // simple observation from real data
  const p=rangeOf('month',-1);const cur=totals(m.from,m.to).byCat,prev=totals(p.from,p.to).byCat;
  const dayN=new Date().getDate(),dim=m.b.getDate();
  for(const x of cur){const pv=prev.find(y=>y.cat===x.cat);if(pv&&x.amt>pv.amt&&x.amt>=3000){out.push(`<div class="notice plain">${ic('sparkles')}<div><b>${esc(x.c.name)}が先月の合計を上回りました</b><div class="sub num">今月 ${yen(x.amt)} ／ 先月 ${yen(pv.amt)}（${dayN}日目時点）</div></div></div>`);break}}
  return out;
}

/* ---------- Insights ---------- */
function insightsView(){
  const I=S.ins;const r=rangeOf(I.unit,I.offset);const pv=prevSameElapsed(I.unit,I.offset);
  const head=`<div class="topbar"><span class="logo">monee.</span></div><h1 class="h" style="margin-bottom:16px">ふりかえり</h1>
  <div class="seg" role="group" aria-label="期間の単位" style="margin-bottom:12px">${[['week','週'],['month','月'],['year','年']].map(([k,l])=>`<button aria-pressed="${I.unit===k}" data-act="iunit" data-v="${k}">${l}</button>`).join('')}</div>
  <div class="between" style="margin-bottom:16px"><button class="iconbtn" data-act="ioff" data-v="-1" aria-label="前の期間">${ic('left')}</button><b class="num">${esc(r.label)}</b><button class="iconbtn" data-act="ioff" data-v="1" aria-label="次の期間" ${I.offset>=0?'disabled style="opacity:.3"':''}>${ic('right')}</button></div>`;
  if(!ready()&&!S.txns.length)return head+skeleton();
  const cur=totals(r.from,r.to),prev=totals(pv.from,pv.to);
  if(!S.txns.length)return head+`<div class="card">${emptyState('chart','ふりかえる記録がまだありません','いくつか記録すると、推移や内訳がここに表示されます。',`<a class="btn primary" href="#add">${ic('plus','sm')}記録する</a>`)}</div>`;
  const diff=cur.exp-prev.exp;const pct=prev.exp?Math.round(diff/prev.exp*100):null;
  const unitL={week:'先週',month:'先月',year:'昨年'}[I.unit]+(pv.partial?'の同時点':'');
  // trend
  let buckets=[];
  if(I.unit==='year'){for(let m=0;m<12;m++){const a=new Date(r.a.getFullYear(),m,1),b=new Date(r.a.getFullYear(),m+1,0);buckets.push({label:`${m+1}`,full:`${m+1}月`,from:ymd(a),to:ymd(b)})}}
  else{const d=new Date(r.a);while(ymd(d)<=r.to){const s=ymd(d);buckets.push({label:I.unit==='week'?WD[d.getDay()]:String(d.getDate()),full:fmtDay(s),from:s,to:s});d.setDate(d.getDate()+1)}}
  buckets.forEach(b=>b.v=S.txns.filter(t=>inRange(t,b.from,b.to)).reduce((a,t)=>a+netExpense(t),0));
  const max=Math.max(1,...buckets.map(b=>b.v));const W=640,H=240,pl=4,pb=32,n=buckets.length,bw=(W-pl*2)/n;const t0=today();
  const sel=I.sel!=null&&buckets[I.sel]?buckets[I.sel]:null;
  const svg=`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="支出の推移グラフ"><line x1="0" x2="${W}" y1="${H-pb}" y2="${H-pb}" stroke="var(--border)"/>${buckets.map((b,i)=>{const h=b.v/max*(H-pb-14);const x=pl+i*bw;const curB=t0>=b.from&&t0<=b.to;const showL=n<=12||i%5===0||i===n-1;return `<rect class="b ${curB?'cur':''} ${I.sel===i?'sel':''}" x="${x+bw*.18}" y="${H-pb-h}" width="${bw*.64}" height="${Math.max(h,b.v?2:0)}" rx="${Math.min(4,bw*.3)}"/>${showL?`<text x="${x+bw/2}" y="${H-8}" text-anchor="middle">${b.label}</text>`:''}<rect class="hit" x="${x}" y="0" width="${bw}" height="${H}" data-act="isel" data-i="${i}"><title>${b.full} ${yen(b.v)}</title></rect>`}).join('')}</svg>`;
  // items
  const im={};S.txns.filter(t=>inRange(t,r.from,r.to)&&netExpense(t)).forEach(t=>(t.items||[]).forEach(i=>{const k=String(i.name||'').trim();if(!k)return;im[k]=im[k]||{n:0,amt:0,name:k};im[k].n+=toInt(i.qty)||1;im[k].amt+=toInt(i.total)}));
  const topItems=Object.values(im).sort((a,b)=>b.amt-a.amt).slice(0,6);
  const st=settings();
  const budgetBlock=I.unit==='month'&&st.budget?(()=>{const b=toInt(st.budget);const p=cur.exp/b*100;const isCur=I.offset===0;const dn=new Date().getDate(),dim=r.b.getDate();const proj=isCur&&dn?Math.round(cur.exp/dn*dim):null;return `<section class="section"><div class="sec-h"><h2 class="s">予算の使用状況</h2></div><div class="card"><div class="between"><span class="num" style="font-weight:600">${yen(cur.exp)} / ${yen(b)}</span><span class="pill ${p>100?'danger':p>=st.alertAt?'warn':''}">${Math.round(p)}%</span></div><div class="prog" style="margin:10px 0" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100,Math.round(p))}" aria-label="予算使用率"><i style="width:${clamp(p,0,100)}%;${p>100?'background:var(--danger)':''}"></i></div>${proj!=null?`<div class="sub num">このペースだと月末には約 ${yen(proj)}（予算${proj>b?`を${yen(proj-b)}超過`:`内、残り${yen(b-proj)}`}）</div>`:''}</div></section>`})():'';
  const cbs=I.unit==='month'?catBudgets(r.from,r.to):[];
  const catBudBlock=I.unit!=='month'?'':`<section class="section"><div class="sec-h"><h2 class="s">カテゴリ別の予算</h2><button class="link" data-act="s-catbud">${cbs.length?'編集':'設定'}${ic('right','sm')}</button></div><div class="card">${cbs.length?`<div class="stack">${cbs.map(x=>`<div><div class="between"><span class="row" style="gap:8px;min-width:0"><span class="dot" style="background:${esc(x.c.color)}"></span><b class="ell">${esc(x.c.name)}</b></span><span class="num sub" style="flex:none">${yen(x.used)} / ${yen(x.bud)}</span></div><div class="prog" style="margin:6px 0 4px" role="progressbar" aria-label="${esc(x.c.name)}の予算使用率" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(clamp(x.pct,0,100))}"><i style="width:${clamp(x.pct,0,100)}%;${x.pct>100?'background:var(--danger)':x.pct>=st.alertAt?'background:var(--warning)':''}"></i></div><div class="sub num" style="${x.used>x.bud?'color:var(--danger)':''}">${x.used>x.bud?`${yen(x.used-x.bud)} オーバー`:`残り ${yen(x.bud-x.used)}`}</div></div>`).join('')}</div>`:`<p class="sub" style="margin:0 0 12px">外食やカフェなど、使いすぎやすいカテゴリだけ上限を決めておくと、超えそうなときにホームでお知らせします。</p><button class="btn soft sm" data-act="s-catbud">${ic('plus','sm')}予算を決める</button>`}</div></section>`;
  const goals=st.goals.length?`<section class="section"><div class="sec-h"><h2 class="s">貯金の目標</h2><a class="link" href="#settings">編集${ic('right','sm')}</a></div><div class="card stack">${st.goals.map(g=>{const p=toInt(g.target)?toInt(g.saved)/toInt(g.target)*100:0;return `<div><div class="between"><b class="ell">${esc(g.name)}</b><span class="num sub">${yen(g.saved)} / ${yen(g.target)}</span></div><div class="prog" style="margin-top:6px" role="progressbar" aria-label="${esc(g.name)}の達成率" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(clamp(p,0,100))}"><i style="width:${clamp(p,0,100)}%"></i></div></div>`}).join('')}</div></section>`:'';
  const ns=I.offset===0&&I.unit!=='year'?notices():[];
  return head+(ns.length?`<section style="margin-bottom:20px"><h2 class="sr-only">お知らせ</h2><div class="stack" style="gap:10px">${ns.join('')}</div></section>`:'')+`<div class="grid2 enter"><div class="sum out"><div class="label">支出</div><div class="v num">${yen(cur.exp)}</div><span class="sub" style="display:inline-flex;gap:2px;align-items:center">${prev.exp?`${ic(diff>0?'up':'down','sm')}${unitL}比 ${syen(diff,diff>0?1:diff<0?-1:0)}${pct!=null?`（${pct>0?'+':''}${pct}%）`:''}`:`${unitL}の記録なし`}</span></div><div class="sum in"><div class="label">収入</div><div class="v num">${yen(cur.inc)}</div><span class="sub">収支 <span class="num">${syen(cur.inc-cur.exp,cur.inc-cur.exp>0?1:cur.inc-cur.exp<0?-1:0)}</span></span></div></div>
  ${I.unit==='week'?weeklyReview(I):I.unit==='month'?monthlyReview(r,pv,cur,prev):''}
  <div class="cols"><div>
  ${I.unit==='month'?calendarSection(r):`<section class="section"><div class="sec-h"><h2 class="s">支出の推移</h2><span class="sub num" aria-live="polite">${sel?`${esc(sel.full)}：${yen(sel.v)}`:'棒をタップで金額表示'}</span></div><div class="card">${svg}<table class="sr-only"><caption>支出の推移</caption>${buckets.map(b=>`<tr><th>${b.full}</th><td>${yen(b.v)}</td></tr>`).join('')}</table></div></section>`}
  <section class="section"><div class="sec-h"><h2 class="s">カテゴリ別</h2></div><div class="card">${breakdown(cur.byCat,cur.exp,false)}</div></section>
  ${budgetBlock}${catBudBlock}</div><div>
  ${I.offset===0?`<section class="section"><div class="sec-h"><h2 class="s">がまん貯金</h2></div>${gamanCard()}</section>`:''}
  ${feelSection(r)}
  <section class="section"><div class="sec-h"><h2 class="s">AIの気づき</h2></div><div class="card">${S.ins.ai?`<div style="white-space:pre-wrap;font-size:15px">${esc(S.ins.ai)}</div><p class="sub" style="margin:10px 0 0;display:flex;gap:6px">${ic('info','sm')}アプリで集計した数値だけをもとにしています。</p>`:`<p class="sub" style="margin:0 0 12px">この期間の集計結果（合計・カテゴリ別・前期間比）だけをAIに渡して、気づきをまとめます。個々の記録は送りません。</p>`}${S.sample?`<button class="btn ${S.ins.ai?'ghost':'soft'} sm" data-act="iai" ${S.ins.aiBusy||!cur.exp?'disabled':''}>${S.ins.aiBusy?ic('loader','sm spin')+'分析中…':ic('sparkles','sm')+(S.ins.ai?'もう一度分析':'分析してもらう')}</button>`:'<p class="sub">この表示ではAI分析を使えません。</p>'}</div></section>
  <section class="section"><div class="sec-h"><h2 class="s">よく買っているもの</h2></div><div class="card" style="padding:8px 16px">${topItems.length?topItems.map(x=>`<div class="between" style="padding:10px 0;border-bottom:1px solid var(--border)"><span class="ell">${esc(x.name)}</span><span class="sub num" style="flex:none">${x.n}点 · <b style="color:var(--text-primary)">${yen(x.amt)}</b></span></div>`).join(''):emptyState('receipt','品目のデータがありません','レシートを読み取ると、品目ごとの支出がわかります。')}</div></section>
  ${goals}</div></div>`;
}
async function runInsightAI(){
  const I=S.ins;const r=rangeOf(I.unit,I.offset),pv=prevSameElapsed(I.unit,I.offset);const cur=totals(r.from,r.to),prev=totals(pv.from,pv.to);const st=settings();
  const data={period:r.label,expense:cur.exp,income:cur.inc,previous_expense:prev.exp,by_category:cur.byCat.map(x=>({name:x.c.name,amount:x.amt,previous:prev.byCat.find(y=>y.cat===x.cat)?.amt||0})),budget:I.unit==='month'?toInt(st.budget)||null:null};
  I.aiBusy=true;render();
  try{const res=await S.sample(`次の家計簿の集計データから、気づきを3つ、日本語で短い箇条書き（「・」始まり）で書いてください。数値はデータにあるものだけを使い、計算や推測で新しい数字を作らないこと。説教口調は避け、具体的で前向きな提案を1つ含めてください。\n${JSON.stringify(data)}`,{modelTier:'quick',cache:false});I.ai=res.text.trim()}
  catch(e){toast(e?.code==='rate_limited'?'混み合っています。少し待ってからお試しください':'分析できませんでした',{err:true})}
  I.aiBusy=false;render();
}

