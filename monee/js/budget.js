"use strict";
/* カテゴリ別の予算 */
function catBudgets(from,to){const b=settings().catBudgets||{};const t=totals(from,to);return Object.entries(b).filter(([id,v])=>toInt(v)>0&&cats('expense').some(c=>c.id===id)).map(([id,v])=>{const used=t.byCat.find(x=>x.cat===id)?.amt||0;const bud=toInt(v);return {id,c:catBy(id),bud,used,pct:used/bud*100}}).sort((a,b)=>b.pct-a.pct)}
