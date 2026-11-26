"use strict";
/* ---------- AI Chat ---------- */
function chatView(){
  const c=S.chat;
  const head=`<div class="topbar"><a class="iconbtn" href="#add" aria-label="戻る">${ic('left')}</a><span class="logo">monee.</span><span style="width:44px"></span></div><h1 class="h" style="margin-bottom:4px">ドットと話す</h1><p class="sub" style="margin:0 0 16px">「ランチ900円」「今日は0円だった」「スタバがまんした」のように送ると、記録の案を出します。保存はあなたが確認してからです。</p>`;
  if(!S.sample)return head+`<div class="card">${emptyState('chat','この表示ではドットと話せません','手入力やレシートの読み取りで記録できます。Claudeアプリのチャットで頼むこともできます。',`<button class="btn primary" data-act="newform">手入力する</button>`)}</div>`;
  const msgs=c.msgs.map(m=>{
    if(m.role==='user')return `<div class="bub u">${esc(m.text)}</div>`;
    if(m.role==='action')return actionCard(m.pid);
    if(m.role==='error')return `<div class="notice danger" style="align-self:flex-start">${ic('alert','sm')}<div>${esc(m.text)}</div></div>`;
    return `<div class="bub a"><div class="who">${ic('sparkles','sm')}ドット</div>${esc(m.text)||`<span class="row" style="gap:6px">${ic('loader','sm spin')}考えています…</span>`}</div>`;
  }).join('');
  const sugg=['今日カフェで680円使った','今日は何も買わなかった','スタバをがまんした','今月の食費はいくら？','先月と比べて使いすぎてる？'];
  return head+`<div class="chat" aria-live="polite">${msgs||`<div class="card sm">${emptyState('sparkles','何でも話しかけてください','「ランチ900円」のような記録や、「今月いくら使った？」といった質問ができます。集計はアプリ内の実際の記録から計算します。')}</div>`}</div>
  ${c.msgs.length?'':`<div class="suggest" role="group" aria-label="例文">${sugg.map(s=>`<button class="chip" data-act="sugg" data-v="${esc(s)}">${esc(s)}</button>`).join('')}</div>`}
  <form class="composer" id="chatform"><label for="chat-in" class="sr-only">メッセージ</label><label class="iconbtn" for="chat-img" title="レシートを添付" style="background:var(--surface);border:1px solid var(--border);width:48px;height:48px;border-radius:14px">${ic('clip')}<span class="sr-only">レシートを添付</span></label><input id="chat-img" type="file" accept="image/*" class="sr-only" data-scan="chat"><textarea id="chat-in" class="input" rows="1" placeholder="メッセージを入力" ${c.busy?'disabled':''}></textarea><button class="btn primary" style="width:48px;padding:0;min-height:48px" aria-label="送信" ${c.busy?'disabled':''}>${c.busy?ic('loader','spin'):ic('send')}</button></form>`;
}
function actionCard(pid){
  const p=S.chat.proposals[pid];if(!p)return '';const d=p.data;const c=catBy(d.category);
  const stateTxt=p.state==='saved'?`<span class="pill">${ic('check','sm')}保存済み</span>`:p.state==='discarded'?'<span class="pill gray">破棄しました</span>':'';
  if(p.kind==='zero'||p.kind==='gaman'){const btns=p.state==='open'?`<div class="row" style="gap:8px"><button class="btn primary sm" data-act="psave" data-pid="${pid}">${ic('check','sm')}記録する</button><button class="btn ghost sm" data-act="pdrop" data-pid="${pid}">やめる</button></div>`:stateTxt;
    return p.kind==='zero'?`<div class="action" role="group" aria-label="0円の日の提案"><div class="k">${ic('check','sm')}0円の日 — まだ記録されていません</div><p style="margin:8px 0 10px">${fmtDay(d.date)}を「0円でした」として記録します。</p>${btns}</div>`
     :`<div class="action" role="group" aria-label="がまんの提案"><div class="k">${ic('piggy','sm')}がまん — まだ記録されていません</div><dl><dt>がまんしたもの</dt><dd class="ell">${esc(d.name)}</dd><dt>金額</dt><dd class="num" style="font-weight:700">${yen(d.amount)}</dd></dl><p class="sub" style="margin:0 0 8px">貯金に移すまでは「まだ」として数えます。</p>${btns}</div>`}
  return `<div class="action" role="group" aria-label="記録の提案"><div class="k">${ic('pencil','sm')}記録の提案 — まだ保存されていません</div>
   <dl><dt>種類</dt><dd>${TYPE_L[d.type]||'支出'}</dd><dt>金額</dt><dd class="num" style="font-weight:700">${yen(d.amount)}</dd><dt>日付</dt><dd>${fmtDay(d.date)}${d.time?' '+esc(d.time):''}</dd><dt>内容</dt><dd class="ell">${esc(d.merchant||'—')}</dd>${d.type==='transfer'?'':`<dt>カテゴリ</dt><dd>${esc(d.category?c.name:'未選択')}</dd>`}${d.method?`<dt>支払い</dt><dd>${esc(d.method)}</dd>`:''}${(d.items||[]).length?`<dt>品目</dt><dd>${d.items.map(i=>esc(i.name)).join('、')}</dd>`:''}</dl>
   ${p.dup?.length?`<div class="sub" style="color:var(--warn-text);margin-bottom:8px">${ic('alert','sm')} 同じ金額の記録があります：${p.dup.map(t=>`${fmtShort(t.date)} ${esc(t.merchant||'')}`).join('、')}</div>`:''}
   ${p.state==='open'?`<div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn primary sm" data-act="psave" data-pid="${pid}" ${!d.category&&d.type!=='transfer'?'disabled title="カテゴリを選ぶには修正してください"':''}>${ic('check','sm')}保存する</button><button class="btn ghost sm" data-act="pedit" data-pid="${pid}">修正</button><button class="btn ghost sm" data-act="pdrop" data-pid="${pid}">破棄</button></div>${!d.category&&d.type!=='transfer'?'<div class="sub" style="margin-top:6px">カテゴリが決まっていないため「修正」から選んでください。</div>':''}`:stateTxt}</div>`;
}
function chatTools(){
  const periods=['today','this_week','this_month','last_month','last_7_days','last_30_days','this_year','all'];
  const pr=k=>{const t=today();if(k==='today')return{from:t,to:t};if(k==='this_week')return rangeOf('week');if(k==='last_month')return rangeOf('month',-1);if(k==='this_year')return rangeOf('year');if(k==='all')return{from:'',to:''};if(k==='last_7_days'||k==='last_30_days'){const d=new Date();d.setDate(d.getDate()-(k==='last_7_days'?6:29));return{from:ymd(d),to:t}}return rangeOf('month')};
  return [
   {name:'get_spending_summary',description:'記録済みデータから期間の支出・収入の合計とカテゴリ別内訳を計算して返す。金額の質問には必ずこれを使う。',inputSchema:{type:'object',properties:{period:{type:'string',enum:periods},category:{type:'string',description:'カテゴリID（任意）'}},required:['period']},
    execute:({period,category})=>{const r=pr(period);const t=totals(r.from,r.to);const st=settings();const out={period,from:r.from||'(最初)',to:r.to||'(最新)',expense_total:t.exp,income_total:t.inc,expense_count:t.count,by_category:t.byCat.slice(0,10).map(x=>({category:x.c.name,amount:x.amt}))};if(category){const x=t.byCat.find(y=>y.cat===category);out.category_total=x?x.amt:0}if(period==='this_month'&&st.budget){out.monthly_budget=toInt(st.budget);out.budget_remaining=toInt(st.budget)-t.exp}{const ft=feelTotals(r.from,r.to);out.regret_total=ft.bad;out.good_total=ft.good;const sk=skipTotals(r.from,r.to);out.gaman_total=sk.amt;out.gaman_moved_to_savings=sk.moved;out.gaman_not_yet_moved=sk.pending;out.gaman_count=sk.n;const dc=dayCounts(r.from||firstRecordDate()||today(),r.to||today());out.no_spend_days_marked=dc.zero;out.days_without_any_record=dc.none}if(period==='this_month'){const cb=catBudgets(r.from,r.to);if(cb.length)out.category_budgets=cb.map(x=>({category:x.c.name,budget:x.bud,used:x.used,remaining:x.bud-x.used}))}return out}},
   {name:'find_transactions',description:'店名・品名・メモで記録を検索し、最大10件の概要を返す。',inputSchema:{type:'object',properties:{query:{type:'string'},period:{type:'string',enum:periods}}},
    execute:({query,period})=>{const r=pr(period||'all');const q=norm(query);const l=S.txns.filter(t=>inRange(t,r.from,r.to)&&live(t)&&(!q||norm(t.merchant).includes(q)||norm(t.note).includes(q)||(t.items||[]).some(i=>norm(i.name).includes(q))));return {count:l.length,total_expense:l.reduce((a,t)=>a+netExpense(t),0),examples:l.slice(0,10).map(t=>({date:t.date,merchant:t.merchant,type:t.type,amount:toInt(t.amount)-toInt(t.refunded),category:catBy(t.category).name}))}}},
   {name:'propose_transaction',description:'ユーザーが記録を頼んだときに、保存前の確認カードを表示する。これ自体は保存しない。ユーザーが画面で保存を押すと保存される。',inputSchema:{type:'object',properties:{type:{type:'string',enum:['expense','income','transfer']},amount:{type:'integer'},date:{type:'string',description:'YYYY-MM-DD'},time:{type:'string'},merchant:{type:'string'},category:{type:'string',description:'カテゴリID。判断できなければ空'},method:{type:'string'},toMethod:{type:'string'},note:{type:'string'},items:{type:'array',items:{type:'object',properties:{name:{type:'string'},qty:{type:'integer'},total:{type:'integer'}}}}},required:['type','amount','date']},
    execute:(d)=>{const amount=toInt(d.amount);if(amount<=0)throw new Error('amount must be positive');const kind=d.type==='income'?'income':'expense';const category=cats(kind).some(c=>c.id===d.category)?d.category:'';
      const data={type:d.type||'expense',amount,date:/^\d{4}-\d{2}-\d{2}$/.test(d.date||'')?d.date:today(),time:d.time||'',merchant:d.merchant||'',category:d.type==='transfer'?'':category,method:settings().methods.includes(d.method)?d.method:'',toMethod:d.toMethod||'',note:d.note||'',items:(d.items||[]).map(i=>({name:i.name||'',qty:toInt(i.qty)||1,unit:'',total:toInt(i.total),category:''}))};
      const pid=uid();S.chat.proposals[pid]={data,state:'open',dup:findDuplicates(data)};S.chat.msgs.push({role:'action',pid});render();return {shown:true,saved:false,note:'確認カードを表示しました。まだ保存されていません。'}}},
   {name:'propose_no_spend_day',description:'ユーザーが「今日は何も買わなかった」など、その日にお金を使わなかったと言ったときに、0円の日として記録する確認カードを出す。これ自体は保存しない。その日に支出の記録があるときは使わない。',inputSchema:{type:'object',properties:{date:{type:'string',description:'YYYY-MM-DD'}},required:['date']},
    execute:({date})=>{const ds=/^\d{4}-\d{2}-\d{2}$/.test(date||'')?date:today();if(ds>today())throw new Error('未来の日は記録できません');if(dayState(ds)==='spent')return {shown:false,note:'その日には支出の記録があるため、0円の日にはできません。'};const pid=uid();S.chat.proposals[pid]={kind:'zero',data:{date:ds},state:'open'};S.chat.msgs.push({role:'action',pid});render();return {shown:true,saved:false}}},
   {name:'propose_gaman',description:'ユーザーが「買うのをやめた」「がまんした」と言ったときに、がまん貯金に記録する確認カードを出す。これ自体は保存しない。',inputSchema:{type:'object',properties:{name:{type:'string',description:'がまんしたもの'},amount:{type:'integer'}},required:['name','amount']},
    execute:({name,amount})=>{const a=toInt(amount);if(a<=0)throw new Error('amount must be positive');const pid=uid();S.chat.proposals[pid]={kind:'gaman',data:{name:String(name||'がまん').slice(0,40),amount:a},state:'open'};S.chat.msgs.push({role:'action',pid});render();return {shown:true,saved:false}}},
  ];
}
async function sendChat(text){
  text=String(text||'').trim();if(!text||S.chat.busy)return;
  const c=S.chat;c.msgs.push({role:'user',text});const ans={role:'assistant',text:''};c.busy=true;render();
  const st=settings();
  const sys=`あなたは家計簿アプリ「monee.」の相棒キャラ「ドット」です（ロゴのピリオドが由来）。日本語で、友だちのように短くやさしく、前向きに答えてください。説教はしないこと。今日は${today()}（${WD[new Date().getDay()]}）。
ルール：
- 使わなかった日の話なら propose_no_spend_day、買うのをやめた話なら propose_gaman で確認カードを出す。
- 記録を頼まれたら propose_transaction で確認カードを出す。あなたは保存できない。「保存しました」と言わず「内容を確認して保存を押してください」と伝える。
- 金額・合計・比較の質問には必ず get_spending_summary か find_transactions の結果だけを使う。自分で推測した数字を言わない。
- カテゴリID：${st.categories.map(x=>`${x.id}=${x.name}(${x.kind==='income'?'収入':'支出'})`).join(', ')}
- 支払い方法の候補：${st.methods.join('、')}
- 金額の表記は「¥1,234」。マークダウンの記号は使わない。`;
  const hist=c.msgs.filter(m=>m.role==='user'||(m.role==='assistant'&&m.text)).slice(-12).map(m=>({role:m.role,content:m.text}));
  while(hist.length&&hist[0].role!=='user')hist.shift(); // 先頭はユーザー発言にそろえる
  if(hist[0])hist[0]={role:'user',content:sys+'\n\n---\n'+hist[0].content};
  c.msgs.push(ans);render();
  try{
    const r=await S.sample(hist,{tools:chatTools(),cache:false,modelTier:'default',onText:({text})=>{ans.text=text;const els=document.querySelectorAll('.bub.a');const el=els[els.length-1];if(el&&S.route==='add-chat'){el.innerHTML=`<div class="who">${ic('sparkles','sm')}ドット</div>${esc(text)}`}}});
    ans.text=r?.text||ans.text||'（回答がありませんでした）';
  }catch(e){c.msgs=c.msgs.filter(m=>m!==ans);c.msgs.push({role:'error',text:e?.code==='rate_limited'?'混み合っています。少し待ってからもう一度送ってください。':e?.code==='not_granted'?'AIの利用が許可されていません。':'送信できませんでした。もう一度お試しください。'})}
  c.busy=false;render();requestAnimationFrame(()=>window.scrollTo(0,document.body.scrollHeight));
}


