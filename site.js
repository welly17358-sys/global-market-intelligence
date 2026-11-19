import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const config=window.GMI_CONFIG||{};
const notice=document.getElementById('notice'),content=document.getElementById('content');
const configured=config.supabaseUrl?.startsWith('https://')&&!config.supabaseUrl.includes('YOUR-PROJECT')&&config.supabaseAnonKey&&!config.supabaseAnonKey.includes('YOUR-');
const db=configured?createClient(config.supabaseUrl,config.supabaseAnonKey):null;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=v=>v?new Date(v).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'}):'未提供';
const validUrl=u=>{try{const x=new URL(u);return ['https:','http:'].includes(x.protocol)?x.href:'#'}catch{return '#'}};
const fmt=n=>n==null?'—':Number(n).toLocaleString('zh-TW',{maximumFractionDigits:2});
let active='news';
async function query(table,select='*',limit=50,order){let q=db.from(table).select(select).limit(limit);if(order)q=q.order(order,{ascending:false});const r=await q;if(r.error)throw r.error;return r.data||[]}
async function count(table){const {count,error}=await db.from(table).select('*',{count:'exact',head:true});if(error)throw error;return count??0}
async function refresh(){
 if(!db){notice.textContent='尚未設定 Supabase：請確認 config.js 的公開金鑰。';content.textContent='請依 README 完成部署。';return}
 notice.textContent='正在讀取 Supabase 已儲存資料…';
 try{
  const [newsCount,stockCount,logs]=await Promise.all([count('news_articles'),count('stock_prices'),query('sync_logs','source_id,status,finished_at',1,'finished_at')]);
  document.getElementById('newsCount').textContent=fmt(newsCount);
  document.getElementById('stockCount').textContent=fmt(stockCount);
  document.getElementById('syncStatus').textContent=logs[0]?.status==='success'?'成功':logs[0]?.status==='error'?'失敗':'尚無紀錄';
  notice.textContent=`最近同步：${date(logs[0]?.finished_at)}。重新讀取僅查詢資料庫，不會觸發新聞或股價擷取。`;
  await show(active);
 }catch(e){notice.textContent='讀取失敗：'+e.message;content.textContent='請檢查 Supabase 網址、RLS 和資料表設定。'}
}
async function stockView(){
 content.innerHTML='<h2>台股行情查詢</h2><p class="subnote">可查詢完整資料庫中的股票代號；漲跌幅與均量依已儲存交易日計算，資料不足時顯示「—」。</p><input id="tickerSearch" placeholder="輸入股票代號（例如 2330）" maxlength="6"><div id="stockTable" class="tablewrap">載入中…</div>';
 const input=document.getElementById('tickerSearch'),target=document.getElementById('stockTable');
 let seq=0;
 async function render(){
  const id=++seq,needle=input.value.trim();
  if(needle&&!/^\d{1,6}$/.test(needle)){target.textContent='請輸入數字股票代號';return}
  target.textContent='查詢中…';
  try{
   let q=db.from('companies').select('ticker,name').eq('market','TWSE').order('ticker').limit(needle?100:60);
   if(needle)q=q.like('ticker',`${needle}%`);
   const r=await q;if(r.error)throw r.error;
   const companies=r.data||[],tickers=companies.map(c=>c.ticker);
   if(!tickers.length){target.textContent='沒有符合的股票代號';return}
   // One query per ticker ensures accurate latest-date history; cap 60 default, 100 search.
   const history=await Promise.all(tickers.map(async ticker=>{
    const res=await db.from('stock_prices').select('trade_date,close,volume').eq('ticker',ticker).order('trade_date',{ascending:false}).limit(21);
    if(res.error)throw res.error;return res.data||[];
   }));
   if(id!==seq)return;
   const rows=companies.map((c,i)=>{
    const h=history[i],today=h[0],previous=h[1];
    const pct=today?.close!=null&&previous?.close>0?(Number(today.close)/Number(previous.close)-1)*100:null;
    const avg=n=>h.length>=n&&h.slice(0,n).every(x=>x.volume!=null)?h.slice(0,n).reduce((s,x)=>s+Number(x.volume),0)/n:null;
    const a5=avg(5),a20=avg(20),ratio=a20>0&&today?.volume!=null?Number(today.volume)/a20:null;
    return `<tr><td>${esc(c.ticker)}</td><td>${esc(c.name)}</td><td>${esc(today?.trade_date??'—')}</td><td>${fmt(today?.close)}</td><td class="${pct>0?'pos':pct<0?'neg':''}">${pct==null?'—':(pct>0?'+':'')+pct.toFixed(2)+'%'}</td><td>${fmt(today?.volume)}</td><td>${fmt(a5)}</td><td>${fmt(a20)}</td><td>${ratio==null?'—':ratio.toFixed(2)+'×'}</td></tr>`;
   });
   target.innerHTML='<table><thead><tr><th>代號</th><th>名稱</th><th>交易日</th><th>收盤價</th><th>日漲跌幅*</th><th>成交量(股)</th><th>5日均量</th><th>20日均量</th><th>量/20日均量</th></tr></thead><tbody>'+rows.join('')+'</tbody></table><p class="subnote">* 以資料庫中相鄰兩筆交易日收盤價計算；若缺漏交易日，可能不是實際單日漲跌幅。歷史不足不估算。預設前60檔，可輸入代號查詢。</p>';
  }catch(e){if(id===seq)target.textContent='讀取失敗：'+e.message}
 }
 let t;input.addEventListener('input',()=>{clearTimeout(t);t=setTimeout(render,300)});await render();
}
async function show(tab){active=tab;document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));content.textContent='載入中…';
 try{
 if(tab==='news'){
  const rows=await query('news_articles','title,url,published_at,source_id',60,'published_at');
  content.innerHTML='<h2>全球新聞</h2><p class="subnote">目前來源：科技新報。鉅亨網尚未接入；點標題可開啟原始新聞。</p>'+(rows.length?rows.map(x=>`<div class="item"><a href="${esc(validUrl(x.url))}" target="_blank" rel="noopener noreferrer">${esc(x.title)}</a><small>${esc(x.source_id)} · ${esc(date(x.published_at))}</small></div>`).join(''):'尚無新聞資料。');
 }else if(tab==='stocks')await stockView();
 else if(tab==='mops'){
  const rows=await query('mops_disclosures','ticker,title,url,published_at',60,'published_at');
  content.innerHTML='<h2>MOPS 重大訊息</h2><p class="muted">資料接入尚未實作；以下僅顯示資料庫現有紀錄。</p>'+(rows.length?rows.map(x=>`<div class="item"><a href="${esc(validUrl(x.url))}" target="_blank" rel="noopener noreferrer">${esc(x.title)}</a><small>${esc(x.ticker)} · ${esc(date(x.published_at))}</small></div>`).join(''):'目前無資料。');
 }else{
  const rows=await query('sync_logs','source_id,status,records_count,finished_at,detail',30,'finished_at');
  content.innerHTML='<h2>同步紀錄</h2><p class="muted">擷取新資料：GitHub → Actions → Manual market data sync → Run workflow。此頁的重新讀取按鈕只重新查詢 Supabase。</p>'+rows.map(x=>`<div class="item"><strong>${esc(x.source_id)} · ${esc(x.status)}</strong><small>${esc(date(x.finished_at))} · ${esc(x.records_count)} 筆 · ${esc(x.detail||'')}</small></div>`).join('');
 }
 }catch(e){content.textContent='讀取失敗：'+e.message}
}
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.tab)));
document.getElementById('reloadData').addEventListener('click',refresh);
refresh();
