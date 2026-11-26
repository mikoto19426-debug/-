"use strict";
/* ================= Icons (Lucide paths) ================= */
const IC={
home:'<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
receipt:'<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
plus:'<path d="M5 12h14"/><path d="M12 5v14"/>',
chart:'<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
settings:'<path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>',
camera:'<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
chat:'<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
pencil:'<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>',
search:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
right:'<path d="m9 18 6-6-6-6"/>',left:'<path d="m15 18-6-6 6-6"/>',
x:'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
trash:'<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
mail:'<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
check:'<path d="M20 6 9 17l-5-5"/>',
alert:'<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
sparkles:'<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>',
wallet:'<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
image:'<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
send:'<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
clip:'<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
up:'<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',down:'<path d="m7 7 10 10"/><path d="M17 7v10H7"/>',
undo:'<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
repeat:'<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
target:'<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
shield:'<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
user:'<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
tag:'<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5"/>',
card:'<rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/>',
transfer:'<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>',
calendar:'<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
clock:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
cloudoff:'<path d="m2 2 20 20"/><path d="M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193"/><path d="M21.532 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7.008 7.008 0 0 0 10 5.07"/>',
loader:'<path d="M21 12a9 9 0 1 1-6.219-8.56"/>',
info:'<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
minus:'<path d="M5 12h14"/>',
piggy:'<path d="M11 17h3v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3a3.16 3.16 0 0 0 2-2h1a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-1a5 5 0 0 0-2-4V3a4 4 0 0 0-3.2 1.6l-.3.4H11a6 6 0 0 0-6 6v1a5 5 0 0 0 2 4v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1z"/><path d="M16 10h.01"/><path d="M2 8v1a2 2 0 0 0 2 2h1"/>',
copy:'<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
};
const ic=(n,c='')=>`<svg class="i ${c}" viewBox="0 0 24 24" aria-hidden="true">${IC[n]||''}</svg>`;

/* ================= Helpers ================= */
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const yen=n=>'¥'+Math.round(Math.abs(n||0)).toLocaleString('ja-JP');
const syen=(n,sign)=>(sign<0?'−':sign>0?'+':'')+yen(n);
const pad=n=>String(n).padStart(2,'0');
const ymd=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parseD=s=>{const [y,m,d]=String(s||'').split('-').map(Number);return new Date(y,(m||1)-1,d||1)};
const today=()=>ymd(new Date());
const WD=['日','月','火','水','木','金','土'];
const fmtDay=s=>{const d=parseD(s);return `${d.getMonth()+1}月${d.getDate()}日（${WD[d.getDay()]}）`};
const fmtShort=s=>{const d=parseD(s);return `${d.getMonth()+1}/${d.getDate()}`};
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const z2h=v=>String(v??'').replace(/[０-９．－，]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0)); // 全角数字も受け付ける
const toInt=v=>{const n=Number(z2h(v).replace(/[^\d.\-]/g,''));return Number.isFinite(n)?Math.round(n):0};
const norm=s=>String(s||'').toLowerCase().replace(/[\s　・\-_.,()（）]/g,'');
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));

/* ================= Defaults ================= */
const PALETTE=['#83B49D','#B9AED0','#D9B99C','#A4BAC7','#A6C8B5','#C9A6A0','#B7C49A','#9DB3B8','#D4BE8E','#B8A48F','#9FAFC9','#C4B5A5'];
const DEFAULTS={
  name:'',budget:null,alertAt:80,weekStart:1,
  categories:[
    {id:'food',name:'食費',color:'#83B49D',kind:'expense'},
    {id:'cafe',name:'外食・カフェ',color:'#B9AED0',kind:'expense'},
    {id:'daily',name:'日用品',color:'#D9B99C',kind:'expense'},
    {id:'transport',name:'交通',color:'#9DB3B8',kind:'expense'},
    {id:'social',name:'交際費',color:'#C9A6A0',kind:'expense'},
    {id:'hobby',name:'趣味',color:'#B7C49A',kind:'expense'},
    {id:'study',name:'学び',color:'#9FAFC9',kind:'expense'},
    {id:'beauty',name:'衣服・美容',color:'#D4BE8E',kind:'expense'},
    {id:'phone',name:'通信',color:'#B8A48F',kind:'expense'},
    {id:'other',name:'その他',color:'#A4BAC7',kind:'expense'},
    {id:'allow',name:'仕送り・お小遣い',color:'#83B49D',kind:'income'},
    {id:'job',name:'アルバイト',color:'#A6C8B5',kind:'income'},
    {id:'inc_other',name:'その他収入',color:'#A4BAC7',kind:'income'},
  ],
  methods:['現金','クレジットカード','交通系IC','QR決済','銀行口座'],
  recurring:[],goals:[],catBudgets:{},
};
const TYPE_L={expense:'支出',income:'収入',transfer:'振替',refund:'返金'};
const STATUS_L={draft:'下書き',cancelled:'取消',refunded:'返金済み',partial:'一部返金'};
const SRC_L={manual:'手入力',chat:'AIチャット',receipt:'レシート',claude:'Claude',gmail:'メール',recurring:'定期',quick:'クイック記録'};

/* ================= State ================= */
const S={
  db:null,user:null,sample:null,assets:null,downloads:null,canWrite:null,
  txns:[],settingsDoc:null,inbox:[],skips:[],dotI:0,dotHopAt:0,
  ready:{txns:false,settings:false,inbox:false},slow:false,fatal:null,
  route:'home',
  hist:{q:'',period:'month',type:'all',cat:'',method:'',from:'',to:'',limit:120},
  ins:{unit:'week',offset:0,sel:null,ai:null,aiBusy:false,exFam:false,day:null},q:null,
  form:null,scan:null,chat:{msgs:[],busy:false,proposals:{}},
  online:navigator.onLine,
};
const settings=()=>{const d=S.settingsDoc||{};return {...DEFAULTS,...d,categories:d.categories?.length?d.categories:DEFAULTS.categories,methods:d.methods?.length?d.methods:DEFAULTS.methods,recurring:d.recurring||[],goals:d.goals||[],catBudgets:d.catBudgets||{}}};
const cats=kind=>settings().categories.filter(c=>!kind||c.kind===kind);
const catBy=id=>settings().categories.find(c=>c.id===id||c.name===id)||{id:id||'other',name:id||'未分類',color:'#A4BAC7'};

/* ================= Money logic ================= */
const live=t=>t.status!=='cancelled'&&t.status!=='draft';
const netExpense=t=>(t.type==='expense'&&live(t))?Math.max(0,toInt(t.amount)-toInt(t.refunded)):0;
const incomeOf=t=>(t.type==='income'&&live(t))?toInt(t.amount):0;
function alloc(t){ // splits net expense across item categories; always sums exactly to netExpense
  const net=netExpense(t);if(!net)return[];
  const its=(t.items||[]).filter(i=>toInt(i.total)>0&&i.category&&i.category!==t.category);
  if(!its.length)return[{cat:t.category||'other',amt:net}];
  const all=(t.items||[]).filter(i=>toInt(i.total)>0);const base=all.reduce((a,i)=>a+toInt(i.total),0);
  if(!base)return[{cat:t.category||'other',amt:net}];
  const m={};let used=0;
  all.forEach(i=>{const c=i.category||t.category||'other';const a=Math.floor(net*toInt(i.total)/base);m[c]=(m[c]||0)+a;used+=a});
  const main=t.category||'other';m[main]=(m[main]||0)+(net-used);
  return Object.entries(m).filter(([,a])=>a>0).map(([cat,amt])=>({cat,amt}));
}
function inRange(t,from,to){return (!from||t.date>=from)&&(!to||t.date<=to)}
function rangeOf(unit,offset=0){
  const now=new Date();let a,b,label;
  if(unit==='week'){const ws=settings().weekStart;const d=new Date(now);const diff=(d.getDay()-ws+7)%7;d.setDate(d.getDate()-diff+offset*7);a=new Date(d);b=new Date(d);b.setDate(b.getDate()+6);label=`${fmtShort(ymd(a))}〜${fmtShort(ymd(b))}`}
  else if(unit==='year'){const y=now.getFullYear()+offset;a=new Date(y,0,1);b=new Date(y,11,31);label=`${y}年`}
  else{a=new Date(now.getFullYear(),now.getMonth()+offset,1);b=new Date(a.getFullYear(),a.getMonth()+1,0);label=`${a.getFullYear()}年${a.getMonth()+1}月`}
  return {from:ymd(a),to:ymd(b),label,a,b};
}
function prevSameElapsed(unit,offset){const r=rangeOf(unit,offset),p=rangeOf(unit,offset-1);if(offset!==0)return {...p,partial:false};const days=Math.round((parseD(today())-parseD(r.from))/864e5);const e=parseD(p.from);e.setDate(e.getDate()+days);const to=ymd(e)>p.to?p.to:ymd(e);return {...p,to,partial:true}}
function totals(from,to){
  let exp=0,inc=0,count=0;const byCat={};
  for(const t of S.txns){if(!inRange(t,from,to))continue;const e=netExpense(t);if(e){exp+=e;count++;for(const x of alloc(t))byCat[x.cat]=(byCat[x.cat]||0)+x.amt}inc+=incomeOf(t)}
  const list=Object.entries(byCat).map(([cat,amt])=>({cat,amt,c:catBy(cat)})).sort((a,b)=>b.amt-a.amt);
  return {exp,inc,count,byCat:list};
}
function findDuplicates(c,excludeId){
  const amt=toInt(c.amount);if(!amt)return[];
  const d0=parseD(c.date||today()).getTime();const day=864e5;
  return S.txns.filter(t=>t.id!==excludeId&&t.status!=='cancelled'&&t.type===(c.type||'expense')).filter(t=>{
    const dd=Math.abs(parseD(t.date).getTime()-d0)/day;const same=toInt(t.amount)===amt;
    const nm=norm(c.merchant)&&norm(t.merchant)&&(norm(t.merchant).includes(norm(c.merchant))||norm(c.merchant).includes(norm(t.merchant)));
    return (same&&dd<=1)||(same&&nm&&dd<=4);
  }).slice(0,3);
}

