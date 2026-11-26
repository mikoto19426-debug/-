"use strict";
/* ================= Quick-entry helpers ================= */
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
function catBudgets(from,to){const b=settings().catBudgets||{};const t=totals(from,to);return Object.entries(b).filter(([id,v])=>toInt(v)>0&&cats('expense').some(c=>c.id===id)).map(([id,v])=>{const used=t.byCat.find(x=>x.cat===id)?.amt||0;const bud=toInt(v);return {id,c:catBy(id),bud,used,pct:used/bud*100}}).sort((a,b)=>b.pct-a.pct)}

/* ================= Dot / Feel / Gaman helpers ================= */
const FEEL={good:{l:'よかった',c:'var(--feel-good)',bg:'var(--feel-good-bg)',bar:'#83B49D'},meh:{l:'ふつう',c:'var(--feel-meh)',bg:'var(--feel-meh-bg)',bar:'#C3CFC8'},bad:{l:'モヤっと',c:'var(--feel-bad)',bg:'var(--feel-bad-bg)',bar:'#D99A8B'}};
function faceSVG(k,s=22){const f=FEEL[k];if(!f)return '';const m=k==='good'?'<path d="M8 14.2q4 3.6 8 0"/>':k==='meh'?'<path d="M8.6 15h6.8"/>':'<path d="M8 16.2q4-3 8 0"/>';const eyes=k==='good'?'<path d="M7.4 10.4q1.6-1.8 3.2 0M13.4 10.4q1.6-1.8 3.2 0"/>':'<circle cx="9" cy="10" r=".7"/><circle cx="15" cy="10" r=".7"/>';return `<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true" style="flex:none;color:${f.c}"><circle cx="12" cy="12" r="11" fill="${f.bg}"/><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">${eyes}${m}</g></svg>`}
const feelButtons=t=>['good','meh','bad'].map(k=>`<button type="button" class="feelb" data-act="feel" data-id="${esc(t.id)}" data-v="${k}" aria-pressed="${t.feel===k}">${faceSVG(k,24)}<span>${FEEL[k].l}</span></button>`).join('');
function feelTotals(from,to){const o={good:0,meh:0,bad:0,none:0,n:{good:0,meh:0,bad:0}};for(const t of S.txns){if(!inRange(t,from,to))continue;const e=netExpense(t);if(!e)continue;if(FEEL[t.feel]){o[t.feel]+=e;o.n[t.feel]++}else o.none+=e}return o}
const unratedRecent=()=>{const since=ymd(new Date(Date.now()-6*864e5)),t0=today();return S.txns.filter(t=>t.date>=since&&t.date<=t0&&t.type==='expense'&&live(t)&&!t.feel&&!t.recurringId)};
function skipTotals(from,to){let amt=0,n=0;for(const x of S.skips){if(inRange(x,from,to)){amt+=toInt(x.amount);n++}}return {amt,n}}
function dotSVG(mood,s=68){
  const eyes=mood==='happy'?'<path d="M33 47q5-6.5 10 0M57 47q5-6.5 10 0"/>':'<circle cx="38" cy="46" r="3.8" fill="#fff" stroke="none"/><circle cx="62" cy="46" r="3.8" fill="#fff" stroke="none"/>';
  const mouth=mood==='happy'?'<path d="M39 59q11 11 22 0"/>':mood==='worried'?'<path d="M40 63q5-4 10 0t10 0"/>':'<path d="M43 60q7 5.5 14 0"/>';
  const brows=mood==='worried'?'<path d="M31 36l9 3.5M69 36l-9 3.5"/>':'';
  const sweat=mood==='worried'?'<path d="M81 27q4.5 7.5 0 10.5q-4.5-3 0-10.5z" fill="#C9DCE4" stroke="none"/>':'';
  const hop=Date.now()-(S.dotHopAt||0)<900?'hop':'';
  return `<svg class="dot-svg ${mood} ${hop}" viewBox="0 0 100 100" width="${s}" height="${s}" aria-hidden="true"><ellipse cx="50" cy="96" rx="24" ry="3.5" fill="rgba(38,61,53,.12)"/><g class="body"><circle cx="50" cy="52" r="40" fill="var(--dot)"/><ellipse cx="33" cy="31" rx="10" ry="6" fill="rgba(255,255,255,.16)" transform="rotate(-28 33 31)"/><ellipse cx="27" cy="58" rx="5.5" ry="3.2" fill="#E8A99A" opacity=".6"/><ellipse cx="73" cy="58" rx="5.5" ry="3.2" fill="#E8A99A" opacity=".6"/><g fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">${eyes}${mouth}${brows}</g>${sweat}</g></svg>`;
}
function dotLines(){
  const st=settings();const out=[];const m=rangeOf('month');const {exp}=totals(m.from,m.to);const t0=today();const hr=new Date().getHours();
  if(!S.txns.length&&!S.skips.length)return [{mood:'happy',text:'はじめまして、ドットです。monee.の「.」だよ。なんとなく使っちゃうお金に、いっしょにピリオドを打とう。'}];
  const b=toInt(st.budget);const dl=m.b.getDate()-new Date().getDate()+1;
  if(b&&exp>b)out.push({mood:'worried',text:`予算を${yen(exp-b)}オーバーしちゃった…。残りの日は「がまんした！」で取りかえそう。`});
  else if(b&&exp/b*100>=st.alertAt)out.push({mood:'worried',text:`予算の${Math.round(exp/b*100)}%まで来たよ。残り${dl}日、1日${yen(Math.floor((b-exp)/dl))}ならいけるよ。`});
  const over=catBudgets(m.from,m.to).find(x=>x.used>x.bud);if(over)out.push({mood:'worried',text:`「${over.c.name}」が予算を${yen(over.used-over.bud)}こえてるよ。今月はちょっとおやすみしよう。`});
  const todayExp=S.txns.filter(t=>t.date===t0).reduce((a,t)=>a+netExpense(t),0);
  if(!todayExp&&hr>=12)out.push({mood:'happy',text:'今日はまだ0円！このまま「なにも買わない日」にしちゃう？'});
  const sk=skipTotals(m.from,m.to);if(sk.n)out.push({mood:'happy',text:`今月は${sk.n}回がまんして、${yen(sk.amt)}守ったね。えらい！`});
  const un=unratedRecent();if(un.length)out.push({mood:'calm',text:`「${un[0].merchant||catBy(un[0].category).name}」の${yen(netExpense(un[0]))}、買ってよかった？下で教えてね。`});
  const ft=feelTotals(m.from,m.to);if(ft.bad)out.push({mood:'calm',text:`今月のモヤっと出費は${yen(ft.bad)}。同じ場面が来たら、ひと呼吸おいてみよう。`});
  if(b&&exp<=b){const pd=exp-Math.round(b*new Date().getDate()/m.b.getDate());if(pd<0)out.push({mood:'happy',text:`理想のペースより${yen(-pd)}少なめ。いい調子だよ！`})}
  const fv=favorites()[0];if(fv)out.push({mood:'calm',text:`${fv.merchant}によく行ってるね。「いつもの」からワンタップで記録できるよ。`});
  out.push({mood:'calm',text:hr<5?'夜ふかしさん、おつかれさま。今日の出費は記録できた？':hr<11?'おはよう。今日もいっしょにいこう。':hr<18?'こんにちは。使ったらすぐ記録がいちばんラクだよ。':'おつかれさま。今日の出費、記録し忘れてない？'});
  return out;
}
function dotHero(){const L=dotLines();const i=S.dotI%L.length;const x=L[i];return `<div class="dothero enter"><button class="dotbtn" data-act="dot" aria-label="ドットの次のひとことを聞く">${dotSVG(x.mood)}</button><div class="bubble" aria-live="polite"><div class="who">ドット${L.length>1?`<span class="sub num" style="font-weight:500;letter-spacing:0">${i+1}/${L.length}</span>`:''}</div><p>${esc(x.text)}</p></div></div>`}
function jarSVG(n){
  const k=Math.min(n,15);const pos=[];for(let r=0;r<3;r++)for(let c=0;c<5;c++)pos.push([24+c*13,82-r*13]);
  return `<svg class="jar" viewBox="0 0 100 100" width="76" height="76" aria-hidden="true"><rect x="28" y="6" width="44" height="10" rx="4" fill="var(--sage)"/><path d="M22 18h56a6 6 0 0 1 6 6v62a8 8 0 0 1-8 8H24a8 8 0 0 1-8-8V24a6 6 0 0 1 6-6z" fill="var(--surface)" stroke="var(--sage)" stroke-width="2.5"/>${pos.slice(0,k).map(([x,y],i)=>`<circle class="coin" cx="${x}" cy="${y}" r="5.6" fill="${i%3===2?'var(--sage)':'var(--primary)'}" style="animation-delay:${i*40}ms"/>`).join('')}${n>15?`<text x="50" y="40" text-anchor="middle" font-size="13" font-weight="700" fill="var(--primary)">+${n-15}</text>`:''}</svg>`;
}
function gamanCard(){
  const m=rangeOf('month');const s=skipTotals(m.from,m.to),all=skipTotals('','');
  return `<section class="card sm gaman enter" aria-labelledby="gh"><div class="row" style="gap:16px">${jarSVG(s.n)}<div style="flex:1;min-width:0"><h2 class="label" id="gh" style="margin:0">今月のがまん貯金</h2><div class="num" style="font-size:28px;font-weight:600;line-height:1.25">${yen(s.amt)}</div><div class="sub num">${all.n?`${s.n}回 · これまでの合計 ${yen(all.amt)}`:'買うのをやめたら「がまんした！」。その金額がここに貯まります。'}</div></div></div>
  <div class="${all.n?'grid2':''}" style="margin-top:12px"><button class="btn primary sm ${all.n?'':'block'}" data-act="gaman">${ic('piggy','sm')}がまんした！</button>${all.n?`<button class="btn ghost sm" data-act="gamanlist">記録を見る</button>`:''}</div></section>`;
}
function feelCard(){
  const list=unratedRecent().slice(0,3);if(!list.length)return '';
  return `<section class="section"><div class="sec-h"><h2 class="s">買ってよかった？</h2><span class="sub">答えるとムダに気づけます</span></div><div class="card enter" style="padding:4px 16px">${list.map(t=>`<div class="feelrow"><div class="between" style="gap:8px"><div style="min-width:0"><div class="ell" style="font-weight:600">${esc(t.merchant||catBy(t.category).name)}</div><div class="sub">${fmtDay(t.date)} · ${esc(catBy(t.category).name)}</div></div><b class="num" style="flex:none">${yen(netExpense(t))}</b></div><div class="feels">${feelButtons(t)}</div></div>`).join('')}</div></section>`;
}
function feelSection(r){
  const f=feelTotals(r.from,r.to);const rated=f.good+f.meh+f.bad;const all=rated+f.none;if(!all)return '';
  if(!rated)return `<section class="section"><div class="sec-h"><h2 class="s">買ってよかった？</h2></div><div class="card"><div class="row" style="align-items:flex-start">${faceSVG('meh',32)}<p class="sub" style="margin:0;font-size:14px">ホームや記録の詳細で「よかった／ふつう／モヤっと」を答えると、この期間のモヤっと出費がここにまとまります。</p></div></div></section>`;
  const bads=S.txns.filter(t=>inRange(t,r.from,r.to)&&t.feel==='bad'&&netExpense(t)).sort((a,b)=>netExpense(b)-netExpense(a));
  const bc={};bads.forEach(t=>bc[t.category]=(bc[t.category]||0)+netExpense(t));const topc=Object.entries(bc).sort((a,b)=>b[1]-a[1])[0];
  return `<section class="section"><div class="sec-h"><h2 class="s">買ってよかった？</h2><span class="sub num">評価済み ${Math.round(rated/all*100)}%</span></div><div class="card">
   <div class="row" style="gap:12px">${faceSVG('bad',40)}<div style="min-width:0"><div class="label">モヤっと出費</div><div class="num" style="font-size:24px;font-weight:600;line-height:1.25">${yen(f.bad)} <span class="sub" style="font-size:13px">${f.n.bad}件</span></div></div></div>
   <div class="feelseg" role="img" aria-label="${['good','meh','bad'].map(k=>`${FEEL[k].l} ${Math.round(f[k]/rated*100)}%`).join('、')}">${['good','meh','bad'].filter(k=>f[k]).map(k=>`<i style="width:${f[k]/rated*100}%;background:${FEEL[k].bar}"></i>`).join('')}</div>
   <div style="margin-top:6px">${['good','meh','bad'].map(k=>`<div class="between" style="padding:7px 0;border-bottom:1px solid var(--border)"><span class="row" style="gap:8px">${faceSVG(k,20)}${FEEL[k].l}</span><span class="num"><span class="sub">${rated?Math.round(f[k]/rated*100):0}%</span> <b style="display:inline-block;min-width:76px;text-align:right">${yen(f[k])}</b></span></div>`).join('')}</div>
   ${topc?`<p class="sub" style="margin:12px 0 4px;font-size:13px">モヤっとがいちばん多いのは「${esc(catBy(topc[0]).name)}」（${yen(topc[1])}）。次に同じ場面が来たら、ひと呼吸おいてみよう。</p>`:''}
   ${bads.length?`<div>${bads.slice(0,3).map(txRow).join('')}</div>`:''}
  </div></section>`;
}

