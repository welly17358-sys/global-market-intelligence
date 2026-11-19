import { createHash } from 'node:crypto';
const base=process.env.SUPABASE_URL?.replace(/\/$/,'');
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!base||!key)throw Error('Missing Supabase credentials');
const headers={apikey:key,'Content-Type':'application/json'};
async function api(path,opts={}) {
  const r = await fetch(`${base}/rest/v1/${path}`, {
    headers, ...opts, signal: AbortSignal.timeout(25000)
  });
  const body = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status} ${path}: ${body.slice(0,1000)}`);
  if (!body.trim()) return null; // POST with Prefer: return=minimal may return 201 + empty body
  try { return JSON.parse(body); }
  catch (err) { throw new Error(`Invalid JSON from ${path} (HTTP ${r.status}): ${body.slice(0,300)}`, {cause:err}); }
}
const categories=[
 ['政策與總體經濟',/聯準會|fed|利率|通膨|cpi|關稅|出口管制|制裁|央行|非農|匯率|貿易戰|關稅|財政|美中/i],
 ['半導體與記憶體',/台積電|晶圓|半導體|晶片|封裝|hbm|dram|nand|記憶體|先進製程|gpu|輝達|nvidia/i],
 ['AI 與資料中心',/人工智慧|\bai\b|資料中心|伺服器|算力|雲端|模型|anthropic|openai/i],
 ['車用電子',/電動車|車用|自駕|adas|tcu|sdv|汽車|車廠|電池/i],
 ['能源與電網',/能源|電網|儲能|太陽能|風電|核能|電力/i],
 ['生技與醫療',/生技|製藥|新藥|醫療|臨床試驗/i]
];
const strong=/財報|法說|營收|獲利|上修|下修|停產|禁令|出口管制|關稅|降息|升息|併購|破產|重大|裁員|缺貨|供應中斷/i;
const trend=/技術|趨勢|研發|突破|架構|製程|量產|產能|需求|供應|路線圖|轉型|布局/i;
function normalize(s){return s.toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'').replace(/\d+/g,'#')}
function grams(s){const n=normalize(s),out=new Set();for(let i=0;i<n.length-1;i++)out.add(n.slice(i,i+2));return out}
function similar(a,b){const A=grams(a),B=grams(b);let intersection=0;for(const v of A)if(B.has(v))intersection++;return intersection/Math.max(1,Math.min(A.size,B.size))}
function classify(title){return categories.find(([_,re])=>re.test(title))?.[0]??'其他市場動態'}
function score(title,category){let s=25;if(strong.test(title))s+=30;if(trend.test(title))s+=15;if(category==='政策與總體經濟')s+=15;if(category!=='其他市場動態')s+=10;return Math.min(s,95)}
function dayTaipei(d){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)}
const now=new Date(),since=new Date(now.getTime()-72*3600*1000).toISOString();
const articles=await api(`news_articles?select=id,title,url,source_id,published_at&published_at=gte.${encodeURIComponent(since)}&order=published_at.desc&limit=500`);
const clusters=[];
for(const a of articles){if(!a.title||!a.url)continue;let match=clusters.find(c=>similar(c[0].title,a.title)>=0.78);if(match)match.push(a);else clusters.push([a])}
const candidates=clusters.map(group=>{const a=group[0],category=classify(a.title);return {group,category,score:score(a.title,category)+Math.min(5,(group.length-1)*2),kind:strong.test(a.title)||category==='政策與總體經濟'?'event':'trend'}}).filter(x=>x.category!=='其他市場動態'||x.score>=60);
const events=candidates.filter(x=>x.kind==='event').sort((a,b)=>b.score-a.score).slice(0,10);
const trends=candidates.filter(x=>x.kind==='trend').sort((a,b)=>b.score-a.score).slice(0,5);
const rows=[...events,...trends].map(x=>{const a=x.group[0];return {id:createHash('sha256').update(`${dayTaipei(now)}:${a.id}`).digest('hex').slice(0,32),brief_date:dayTaipei(now),kind:x.kind,category:x.category,title:a.title,summary:`${x.category}相關動態：${a.title}。此為依新聞標題產生的事件提示，尚未驗證內文或實際股價影響。`,importance_score:x.score,source_urls:x.group.map(z=>({title:z.title,url:z.url,source:z.source_id,published_at:z.published_at})).slice(0,5),generated_at:now.toISOString()}});
if(rows.length)await api('market_briefs?on_conflict=id',{method:'POST',headers:{...headers,Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(rows)});
console.log(`brief: scanned=${articles.length}, clusters=${clusters.length}, selected=${rows.length}, events=${events.length}, trends=${trends.length}`);
