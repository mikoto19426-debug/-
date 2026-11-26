"use strict";
/* オプション機能のしくみ。使う人だけオンにする。
   各機能は OPTIONS に1つ登録し、必要なところだけを持つ:
   { id, name, desc, icon,
     section()      ふりかえりの「お金の流れ」に出す中身（HTML）
     heroLine()     ホームの予算カードに足す1行（HTML。なければ省略）
     dotLines()     ドットのひとこと [{mood,text,btn?}]
     detailExtra(t) 記録の詳細シートに足す部分（HTML）
     sheet()        設定シート（オン・オフと細かい設定）
     act(name,el)   data-opt="id" data-oact="name" のボタンが押されたとき }
   画面側は optOn() で絞って呼ぶだけ。機能の中身は各 opt-*.js にまとめる。 */
const OPTIONS=[];
const optOn=id=>!!(settings().modules||{})[id];
const optsOn=()=>OPTIONS.filter(o=>optOn(o.id));
const optCall=(fn,...a)=>optsOn().map(o=>o[fn]?o[fn](...a):'').filter(Boolean);
// 月の d 日（0 や月の日数より大きい日は月末）。m は 0 始まり、はみ出しは Date が直す
const dayIn=(y,m,d)=>{const last=new Date(y,m+1,0).getDate();return new Date(y,m,!d||d>last?last:d)};
const daysUntil=ds=>Math.round((parseD(ds)-parseD(today()))/864e5);
const dayLabel=d=>!d?'月末':`${d}日`;
async function saveModule(id,on,patch={}){const st=settings();await saveSettings({...patch,modules:{...(st.modules||{}),[id]:on}})}
// 設定シートの共通の形：オン・オフのチェック＋各機能の設定欄
function optSheet(o,body){
  openSheet(`${sheetHead(o.name)}<div class="stack"><p class="sub" style="margin:0">${o.desc}</p>
   <label class="check" style="font-weight:600"><input type="checkbox" id="op-on" ${optOn(o.id)?'checked':''}><span>この機能を使う</span></label>
   ${body}<div id="op-err" class="sub" role="alert" style="color:var(--danger)"></div><button class="btn primary block" id="op-save">保存する</button></div>`,{label:o.name});
}
function wireOptSheet(o,collect){
  $('#op-save').onclick=async e=>{const patch=collect();if(!patch)return;busy(e.currentTarget,true);
    try{await saveModule(o.id,$('#op-on').checked,patch);closeSheet();toast(`${o.name}を${$('#op-on')?.checked===false?'オフに':'保存'}しました`)}catch(err){busy(e.currentTarget,false);toast(writeErr(err),{err:true})}};
}
// ふりかえりの「お金の流れ」
function optionSections(){
  const parts=optCall('section');if(!parts.length)return '';
  return `<section class="section"><div class="sec-h"><h2 class="s">お金の流れ</h2><a class="link" href="#settings">機能の設定${ic('right','sm')}</a></div><div class="stack">${parts.join('')}</div></section>`;
}
// 設定画面の一覧
function optionRows(){
  return OPTIONS.map(o=>`<button class="tx" data-opt="${o.id}" data-oact="open"><span class="cat-ic" style="background:var(--primary-light);color:var(--primary)">${ic(o.icon,'sm')}</span><span class="mid"><span class="t1" style="display:block">${esc(o.name)}</span><span class="t2"><span>${optOn(o.id)?'オン':'オフ'}</span></span></span>${ic('right','sm')}</button>`).join('');
}
function optClick(el){const o=OPTIONS.find(x=>x.id===el.dataset.opt);if(!o)return;if(el.dataset.oact==='open')o.sheet();else o.act&&o.act(el.dataset.oact,el)}
