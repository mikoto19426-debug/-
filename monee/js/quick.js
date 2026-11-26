"use strict";
/* すばやく記録：カテゴリ推測・いつもの・店名候補・シート */
function lastMethod(cat){const ms=settings().methods;const t=S.txns.find(x=>x.type!=='transfer'&&x.method&&ms.includes(x.method)&&(!cat||x.category===cat));return t?t.method:(cat?lastMethod(''):'')}
const KW=[
 [/スタバ|スターバックス|ドトール|タリーズ|コメダ|カフェ|喫茶|coffee|cafe|マクドナルド|マック|モスバーガー|ケンタッキー|すき家|松屋|吉野家|なか卯|ラーメン|うどん|そば|定食|レストラン|ランチ|ディナー|居酒屋|サイゼ|ガスト|学食|食堂/i,'cafe'],
 [/セブン|ローソン|ファミリーマート|ファミマ|ミニストップ|スーパー|まいばすけっと|イオン|西友|成城石井|業務スーパー|生協|購買|弁当|食材|自販機|自動販売機/i,'food'],
 [/suica|pasmo|icoca|電車|バス代|タクシー|メトロ|地下鉄|新幹線|uber|定期券|交通費/i,'transport'],
 [/マツキヨ|マツモトキヨシ|ダイソー|セリア|キャンドゥ|無印|ドラッグ|薬局|ニトリ|ロフト|ハンズ|日用品|洗剤|ティッシュ/i,'daily'],
 [/docomo|ドコモ|ソフトバンク|楽天モバイル|ahamo|povo|linemo|ワイモバイル|wi-?fi|通信費|スマホ代|携帯代/i,'phone'],
 [/書店|本屋|紀伊國屋|ジュンク|丸善|教科書|参考書|udemy|講座|検定|受験|文房具/i,'study'],
 [/ユニクロ|ジーユー|zara|美容院|美容室|ヘアサロン|コスメ|化粧品/i,'beauty'],
 [/飲み会|プレゼント|ギフト|誕生日|お祝い|割り勘/i,'social'],
 [/映画|ゲーム|steam|netflix|spotify|ライブ|チケット|カラオケ|推し|グッズ/i,'hobby'],
 [/バイト代|給料|給与|アルバイト/i,'job'],
 [/仕送り|お小遣い|おこづかい/i,'allow'],
];
function guessCat(merchant,kind){ // 過去の同じ店の記録 → キーワードの順で推測
  const k=norm(merchant);if(!k)return '';
  const ok=id=>cats(kind).some(c=>c.id===id);
  const cnt={};for(const t of S.txns){if(t.type!==kind||!t.category||!ok(t.category))continue;const m=norm(t.merchant);if(m&&(m===k||(k.length>=2&&m.startsWith(k))))cnt[t.category]=(cnt[t.category]||0)+1}
  const best=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0];if(best)return best[0];
  for(const [re,id] of KW)if(re.test(merchant)&&ok(id))return id;
  return '';
}
function favorites(){ // 直近120日で2回以上つけた「店＋カテゴリ＋金額」
  const since=ymd(new Date(Date.now()-120*864e5));const m={};
  for(const t of S.txns){if(t.date<since||t.type!=='expense'||!live(t)||!t.merchant||!t.category)continue;const k=norm(t.merchant)+'|'+t.category+'|'+toInt(t.amount);if(!m[k])m[k]={n:0,t};m[k].n++}
  return Object.values(m).filter(x=>x.n>=2).sort((a,b)=>b.n-a.n||(b.t.date||'').localeCompare(a.t.date||'')).slice(0,8).map(x=>x.t);
}
function merchantList(){const m={};S.txns.forEach(t=>{const v=String(t.merchant||'').trim();if(v&&t.type!=='transfer')m[v]=(m[v]||0)+1});return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,40).map(x=>x[0])}
const merchantDL=()=>`<datalist id="dl-m">${merchantList().map(v=>`<option value="${esc(v)}"></option>`).join('')}</datalist>`;
function buildTxn(d,source){const now=new Date().toISOString();return {type:d.type,status:'confirmed',amount:toInt(d.amount),date:d.date||today(),time:d.time||'',merchant:String(d.merchant||'').trim(),category:d.type==='transfer'?'':(d.category||''),method:d.method||'',toMethod:d.toMethod||'',note:d.note||'',items:d.items||[],discount:0,tax:0,taxIncluded:true,receiptAssetId:null,source,refunded:0,refunds:[],recurringId:null,inboxId:null,createdAt:now,updatedAt:now}}
function quickSheet(p={}){
  const type=p.type==='income'?'income':'expense';
  const q={type,amount:p.amount?String(toInt(p.amount)):'',merchant:p.merchant||'',category:p.category||'',method:'',date:p.date||today(),catAuto:false,dupAck:false};
  q.method=p.method||(type==='expense'?lastMethod(q.category):'');
  openSheet(`${sheetHead('すばやく記録')}<div class="stack" style="gap:14px">
   <div class="seg" role="group" aria-label="種類">${['expense','income'].map(k=>`<button type="button" aria-pressed="${q.type===k}" data-act="qtype" data-v="${k}">${TYPE_L[k]}</button>`).join('')}</div>
   <label class="field"><span class="sr-only">金額</span><div class="amount-wrap"><input id="q-amount" class="input amount-in qamt num" inputmode="numeric" autocomplete="off" placeholder="0" enterkeyhint="done" value="${esc(q.amount)}"></div></label>
   <div class="field"><span id="qcl">カテゴリ<span id="q-hint" class="hint"></span></span><div class="chips" id="q-cats" role="group" aria-labelledby="qcl"></div></div>
   <label class="field"><span>店名・内容（任意）</span><input id="q-merchant" class="input" list="dl-m" maxlength="80" autocomplete="off" placeholder="例：スターバックス" value="${esc(q.merchant)}">${merchantDL()}</label>
   <div class="grid2"><label class="field"><span>支払い方法</span><select id="q-method" class="input"><option value="">未選択</option>${settings().methods.map(x=>`<option ${q.method===x?'selected':''}>${esc(x)}</option>`).join('')}</select></label><label class="field"><span>日付</span><input id="q-date" class="input" type="date" value="${esc(q.date)}"></label></div>
   <div class="chips" role="group" aria-label="日付をすばやく選ぶ" id="q-dates"></div>
   <div id="q-err" class="sub" role="alert" style="color:var(--danger)"></div>
   <button class="btn primary block" id="q-save" data-act="qsave" style="min-height:52px">${ic('check','sm')}記録する</button>
   <button class="link" data-act="qmore" style="align-self:center">${ic('pencil','sm')}品目やメモも入力する</button>
  </div>`,{label:'すばやく記録'});
  S.q=q;drawQuick();$('#q-amount')?.focus();
}
function drawQuick(){
  const q=S.q;if(!q)return;
  const freq={};S.txns.forEach(t=>{if(t.type===q.type&&t.category)freq[t.category]=(freq[t.category]||0)+1});
  const list=cats(q.type).slice().sort((a,b)=>(freq[b.id]||0)-(freq[a.id]||0));
  const el=$('#q-cats');if(el)el.innerHTML=list.map(c=>`<button type="button" class="chip" aria-pressed="${q.category===c.id}" data-act="qcat" data-v="${esc(c.id)}"><span class="dot" style="background:${esc(c.color)}"></span>${esc(c.name)}</button>`).join('');
  const h=$('#q-hint');if(h)h.innerHTML=q.catAuto&&q.category?`${ic('sparkles','sm')}自動で選びました`:'';
  const ds=$('#q-dates');if(ds)ds.innerHTML=[[0,'今日'],[1,'昨日'],[2,'おととい']].map(([n,l])=>{const d=new Date();d.setDate(d.getDate()-n);const v=ymd(d);return `<button type="button" class="chip" aria-pressed="${q.date===v}" data-act="qdate" data-v="${v}">${l}</button>`}).join('');
  const di=$('#q-date');if(di&&di.value!==q.date)di.value=q.date;
}
async function saveQuick(btn){
  const q=S.q;if(!q)return;const err=$('#q-err');const amt=toInt(q.amount);
  if(amt<=0){err.textContent='金額を入力してください。';$('#q-amount').focus();return}
  if(!q.category){err.textContent='カテゴリを選んでください。';return}
  const d={type:q.type,amount:amt,date:q.date||today(),merchant:q.merchant,category:q.category,method:q.method};
  const dup=findDuplicates(d);
  if(dup.length&&!q.dupAck){q.dupAck=true;err.innerHTML=`同じような記録があります：${dup.map(t=>`${fmtShort(t.date)} ${esc(t.merchant||'')} ${yen(t.amount)}`).join('、')}<br>重複でなければ、もう一度「記録する」を押してください。`;return}
  const id=uid();busy(btn,true);
  try{await saveTxn(id,buildTxn(d,'quick'));closeSheet();toast(`${yen(amt)}を記録しました`,{undo:()=>S.db.collection('txns').doc(id).delete()})}catch(e){busy(btn,false);toast(writeErr(e),{err:true})}
}

