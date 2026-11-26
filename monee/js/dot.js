"use strict";
/* 相棒キャラ「ドット」 */
/* ドットの記憶：実際の記録から作る「覚えていること」。作り話はしない */
function recordedDates(){const s=new Set();for(const t of S.txns)if(t.status!=='draft'&&t.date)s.add(t.date);for(const [d,v] of Object.entries(S.days))if(v?.zero)s.add(d);return s}
function dotStats(){
  const set=recordedDates();const t0=today();const days=[...set].filter(d=>d<=t0).sort();
  let streak=0;const d=parseD(t0);if(!set.has(t0))d.setDate(d.getDate()-1);while(set.has(ymd(d))){streak++;d.setDate(d.getDate()-1)}
  let best=0,run=0,prev=null;for(const x of days){run=prev&&Math.round((parseD(x)-parseD(prev))/864e5)===1?run+1:1;best=Math.max(best,run);prev=x}
  const n=days.length;const stage=n>=100?3:n>=30?2:n>=7?1:0;const next=[7,30,100][stage]||null;
  return {n,streak,best,first:days[0]||null,stage,next,toNext:next?next-n:0};
}
const DOT_STAGE=['はじめまして','芽が出た','葉っぱが2枚','花が咲いた'];
function dotMemories(){
  const out=[];const st=dotStats();if(!st.first)return out;
  out.push(`はじめて記録したのは${fmtDay(st.first)}。`);
  if(st.best>=2)out.push(`いちばん長く続いた記録は${st.best}日連続。`);
  const zc=Object.values(S.days).filter(v=>v?.zero).length;if(zc)out.push(`「0円でした」の日はこれまでに${zc}日。`);
  const gm=skipTotals('','');if(gm.moved)out.push(`がまんして本当に貯金できたのは合計${yen(gm.moved)}。`);
  const fav={},bad={};for(const t of S.txns){if(!t.merchant)continue;if(t.feel==='good')fav[t.merchant]=(fav[t.merchant]||0)+1;if(t.feel==='bad')bad[t.merchant]=(bad[t.merchant]||0)+1}
  const g=Object.entries(fav).sort((a,b)=>b[1]-a[1])[0];if(g&&g[1]>=2)out.push(`「${g[0]}」には${g[1]}回「よかった」って言ってた。お気に入りだね。`);
  const b=Object.entries(bad).sort((a,b)=>b[1]-a[1])[0];if(b&&b[1]>=2)out.push(`「${b[0]}」は${b[1]}回「モヤっと」してた。`);
  const w=rangeOf('week',-1);const sk={};S.skips.filter(x=>inRange(x,w.from,w.to)).forEach(x=>sk[x.name]=(sk[x.name]||0)+1);const s1=Object.entries(sk).sort((a,b)=>b[1]-a[1])[0];if(s1)out.push(`先週は「${s1[0]}」を${s1[1]}回がまんした。`);
  return out;
}
function dotSVG(mood,s=68,stage=dotStats().stage){
  const eyes=mood==='happy'?'<path d="M33 47q5-6.5 10 0M57 47q5-6.5 10 0"/>':'<circle cx="38" cy="46" r="3.8" fill="#fff" stroke="none"/><circle cx="62" cy="46" r="3.8" fill="#fff" stroke="none"/>';
  const mouth=mood==='happy'?'<path d="M39 59q11 11 22 0"/>':mood==='worried'?'<path d="M40 63q5-4 10 0t10 0"/>':'<path d="M43 60q7 5.5 14 0"/>';
  const brows=mood==='worried'?'<path d="M31 36l9 3.5M69 36l-9 3.5"/>':'';
  const sweat=mood==='worried'?'<path d="M81 27q4.5 7.5 0 10.5q-4.5-3 0-10.5z" fill="#C9DCE4" stroke="none"/>':'';
  const hop=Date.now()-(S.dotHopAt||0)<900?'hop':'';
  // 成長：記録した日数で頭の上が変わる（芽→葉っぱ2枚→花）
  const leaf=(x,y,r)=>`<ellipse cx="${x}" cy="${y}" rx="7" ry="3.6" fill="var(--sage)" stroke="var(--dot)" stroke-width="1.2" transform="rotate(${r} ${x} ${y})"/>`;
  const top=stage<1?'':`<path d="M50 13V${stage>=3?-4:2}" stroke="var(--dot)" stroke-width="2.6" stroke-linecap="round"/>${leaf(57,3,-25)}${stage>=2?leaf(43,6,25):''}${stage>=3?`<circle cx="50" cy="-6" r="5" fill="#F2C9A8" stroke="var(--dot)" stroke-width="1.2"/><circle cx="50" cy="-6" r="1.8" fill="var(--dot)"/>`:''}`;
  return `<svg class="dot-svg ${mood} ${hop}" viewBox="0 0 100 100" width="${s}" height="${s}" aria-hidden="true"><ellipse cx="50" cy="96" rx="24" ry="3.5" fill="rgba(38,61,53,.12)"/><g class="body">${top}<circle cx="50" cy="52" r="40" fill="var(--dot)"/><ellipse cx="33" cy="31" rx="10" ry="6" fill="rgba(255,255,255,.16)" transform="rotate(-28 33 31)"/><ellipse cx="27" cy="58" rx="5.5" ry="3.2" fill="#E8A99A" opacity=".6"/><ellipse cx="73" cy="58" rx="5.5" ry="3.2" fill="#E8A99A" opacity=".6"/><g fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">${eyes}${mouth}${brows}</g>${sweat}</g></svg>`;
}
function dotLines(){ // 先頭ほど大事。行動が必要なものは btn:[ラベル, 属性] を付ける
  const st=settings();const out=[];const m=rangeOf('month');const {exp}=totals(m.from,m.to);const t0=today();const hr=new Date().getHours();
  if(!S.txns.length&&!S.skips.length)return [{mood:'happy',text:'はじめまして、ドットです。monee.の「.」だよ。なんとなく使っちゃうお金に、いっしょにピリオドを打とう。'}];
  const b=toInt(st.budget);const dl=m.b.getDate()-new Date().getDate()+1;
  // やることがあるとき
  const pend=pendingInbox();if(pend.length)out.push({mood:'calm',text:`メールなどから支出の候補が${pend.length}件届いてるよ。確認してから保存しよう。`,btn:['確認する','data-go="add"']});
  const dr=S.txns.filter(t=>t.status==='draft').length;if(dr)out.push({mood:'calm',text:`下書きが${dr}件あるよ。確定するまで集計に入らないから気をつけてね。`,btn:['下書きを見る','data-act="drafts"']});
  const dn=new Date().getDate();const miss=st.recurring.find(r=>toInt(r.day)<=dn&&!S.txns.some(t=>t.recurringId===r.id&&inRange(t,m.from,m.to)));
  if(miss)out.push({mood:'calm',text:`毎月${toInt(miss.day)}日の「${miss.name}」（${yen(miss.amount)}）が、今月まだ記録されてないよ。`,btn:['記録する',`data-act="recur" data-id="${esc(miss.id)}"`]});
  // 気をつけたいこと
  if(b&&exp>b)out.push({mood:'worried',text:`予算を${yen(exp-b)}オーバーしちゃった…。残りの日は「がまんした」で取りかえそう。`});
  else if(b&&exp/b*100>=st.alertAt)out.push({mood:'worried',text:`予算の${Math.round(exp/b*100)}%まで来たよ。残り${dl}日、1日${yen(Math.floor((b-exp)/dl))}ならいけるよ。`});
  const over=catBudgets(m.from,m.to).find(x=>x.used>x.bud);if(over)out.push({mood:'worried',text:`「${over.c.name}」が予算を${yen(over.used-over.bud)}こえてるよ。今月はちょっとおやすみしよう。`});
  // ほめる・気づき
  const ds=dotStats();if(ds.streak>=3)out.push({mood:'happy',text:`今日で${ds.streak}日続けて記録してるよ。${ds.next?`あと${ds.toNext}日でドットが育つよ。`:'すっかり習慣だね。'}`});
  const mem=dotMemories();if(mem.length){const i=parseD(t0).getDate()%mem.length;out.push({mood:'calm',text:`覚えてるよ。${mem[i]}`})}
  const zc=dayCounts(m.from,m.to).zero;if(zc)out.push({mood:'happy',text:`今月の「0円でした」は${zc}日。使わない日をちゃんと作れてるね。`});
  const sk=skipTotals(m.from,m.to);if(sk.n)out.push({mood:'happy',text:`今月は${sk.n}回がまんしたね。そのうち${yen(sk.moved)}は本当に貯金できてるよ。`});
  const gp=skipTotals('','');if(gp.nPending)out.push({mood:'calm',text:`まだ貯金に移していないがまんが${yen(gp.pending)}あるよ。本当に移したら「移した」を押してね。`,btn:['移した','data-act="gmove"']});
  const ft=feelTotals(m.from,m.to);if(ft.bad)out.push({mood:'calm',text:`今月のモヤっと出費は${yen(ft.bad)}。同じ場面が来たら、ひと呼吸おいてみよう。`});
  out.push({mood:'calm',text:hr<5?'夜ふかしさん、おつかれさま。今日の出費は記録できた？':hr<11?'おはよう。今日もいっしょにいこう。':hr<18?'こんにちは。使ったらすぐ記録がいちばんラクだよ。':'おつかれさま。今日の出費、記録し忘れてない？'});
  return out;
}
function dotInfoSheet(){
  const st=dotStats();const mem=dotMemories();
  openSheet(`${sheetHead('ドットのこと')}<div class="row" style="gap:16px;margin:8px 0 14px">${dotSVG('happy',88,st.stage)}<div><div class="label">いまの姿</div><div style="font-size:18px;font-weight:600">${DOT_STAGE[st.stage]}</div><div class="sub">${st.next?`あと${st.toNext}日記録すると「${DOT_STAGE[st.stage+1]}」`:'これ以上は育ちません。ずっといっしょ。'}</div></div></div>
   <div class="stat3"><div><div class="label">記録した日</div><div class="v num">${st.n}<span style="font-size:13px">日</span></div></div><div><div class="label">いまの連続</div><div class="v num">${st.streak}<span style="font-size:13px">日</span></div></div><div><div class="label">最長の連続</div><div class="v num">${st.best}<span style="font-size:13px">日</span></div></div></div>
   <p class="sub" style="margin:10px 0 0">支出・収入を記録した日と「0円でした」の日を数えています。</p>
   <h3 class="s" style="font-size:16px;margin:18px 0 6px">ドットが覚えていること</h3>${mem.length?`<ul style="margin:0;padding-left:20px;line-height:1.9">${mem.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<p class="sub">記録が増えると、ここに思い出がたまっていきます。</p>'}`,{label:'ドットのこと'});
}
function dotHero(){const L=dotLines();const i=S.dotI%L.length;const x=L[i];return `<div class="dothero enter"><button class="dotbtn" data-act="dot" aria-label="ドットの次のひとことを聞く">${dotSVG(x.mood)}</button><div class="bubble" aria-live="polite"><div class="who">ドット${L.length>1?`<span class="sub num" style="font-weight:500;letter-spacing:0">${i+1}/${L.length}</span>`:''}<button class="link" data-act="dotinfo" style="margin-left:auto;min-height:28px;padding:0;font-size:12px">ドットのこと${ic('right','sm')}</button></div><p>${esc(x.text)}</p>${x.btn?`<button class="btn soft sm" style="margin-top:8px" ${x.btn[1]}>${esc(x.btn[0])}</button>`:''}</div></div>`}
