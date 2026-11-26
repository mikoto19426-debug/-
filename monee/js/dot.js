"use strict";
/* 相棒キャラ「ドット」 */
function dotSVG(mood,s=68){
  const eyes=mood==='happy'?'<path d="M33 47q5-6.5 10 0M57 47q5-6.5 10 0"/>':'<circle cx="38" cy="46" r="3.8" fill="#fff" stroke="none"/><circle cx="62" cy="46" r="3.8" fill="#fff" stroke="none"/>';
  const mouth=mood==='happy'?'<path d="M39 59q11 11 22 0"/>':mood==='worried'?'<path d="M40 63q5-4 10 0t10 0"/>':'<path d="M43 60q7 5.5 14 0"/>';
  const brows=mood==='worried'?'<path d="M31 36l9 3.5M69 36l-9 3.5"/>':'';
  const sweat=mood==='worried'?'<path d="M81 27q4.5 7.5 0 10.5q-4.5-3 0-10.5z" fill="#C9DCE4" stroke="none"/>':'';
  const hop=Date.now()-(S.dotHopAt||0)<900?'hop':'';
  return `<svg class="dot-svg ${mood} ${hop}" viewBox="0 0 100 100" width="${s}" height="${s}" aria-hidden="true"><ellipse cx="50" cy="96" rx="24" ry="3.5" fill="rgba(38,61,53,.12)"/><g class="body"><circle cx="50" cy="52" r="40" fill="var(--dot)"/><ellipse cx="33" cy="31" rx="10" ry="6" fill="rgba(255,255,255,.16)" transform="rotate(-28 33 31)"/><ellipse cx="27" cy="58" rx="5.5" ry="3.2" fill="#E8A99A" opacity=".6"/><ellipse cx="73" cy="58" rx="5.5" ry="3.2" fill="#E8A99A" opacity=".6"/><g fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">${eyes}${mouth}${brows}</g>${sweat}</g></svg>`;
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
  const zc=dayCounts(m.from,m.to).zero;if(zc)out.push({mood:'happy',text:`今月の「0円でした」は${zc}日。使わない日をちゃんと作れてるね。`});
  const sk=skipTotals(m.from,m.to);if(sk.n)out.push({mood:'happy',text:`今月は${sk.n}回がまんしたね。そのうち${yen(sk.moved)}は本当に貯金できてるよ。`});
  const gp=skipTotals('','');if(gp.nPending)out.push({mood:'calm',text:`まだ貯金に移していないがまんが${yen(gp.pending)}あるよ。本当に移したら「移した」を押してね。`,btn:['移した','data-act="gmove"']});
  const ft=feelTotals(m.from,m.to);if(ft.bad)out.push({mood:'calm',text:`今月のモヤっと出費は${yen(ft.bad)}。同じ場面が来たら、ひと呼吸おいてみよう。`});
  out.push({mood:'calm',text:hr<5?'夜ふかしさん、おつかれさま。今日の出費は記録できた？':hr<11?'おはよう。今日もいっしょにいこう。':hr<18?'こんにちは。使ったらすぐ記録がいちばんラクだよ。':'おつかれさま。今日の出費、記録し忘れてない？'});
  return out;
}
function dotHero(){const L=dotLines();const i=S.dotI%L.length;const x=L[i];return `<div class="dothero enter"><button class="dotbtn" data-act="dot" aria-label="ドットの次のひとことを聞く">${dotSVG(x.mood)}</button><div class="bubble" aria-live="polite"><div class="who">ドット${L.length>1?`<span class="sub num" style="font-weight:500;letter-spacing:0">${i+1}/${L.length}</span>`:''}</div><p>${esc(x.text)}</p>${x.btn?`<button class="btn soft sm" style="margin-top:8px" ${x.btn[1]}>${esc(x.btn[0])}</button>`:''}</div></div>`}
