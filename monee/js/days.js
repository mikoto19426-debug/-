"use strict";
/* 日ごとの状態：「0円でした」をはっきり記録する。つけ忘れと「使わなかった」を混ぜない。
   spent=支出あり / zero=0円でしたと記録 / other=収入などの記録だけ / none=何も記録なし */
function dayState(ds){
  if(S.txns.some(t=>t.date===ds&&netExpense(t)))return 'spent';
  if(S.days[ds]?.zero)return 'zero';
  if(S.txns.some(t=>t.date===ds&&t.status!=='draft'))return 'other';
  return 'none';
}
function dayCounts(from,to){ // 今日より先は数えない
  const end=to>today()?today():to;const o={zero:0,none:0,spent:0,other:0,days:0};
  for(const d=parseD(from);ymd(d)<=end;d.setDate(d.getDate()+1)){o[dayState(ymd(d))]++;o.days++}
  return o;
}
const firstRecordDate=()=>S.txns.length?S.txns[S.txns.length-1].date:null; // S.txns は新しい順
async function setZeroDay(ds,on){
  const ref=S.db.collection('days').doc(ds);
  if(on)await ref.set({zero:true,at:new Date().toISOString()});else await ref.delete();
}
