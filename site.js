import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const config=window.GMI_CONFIG||{};
const notice=document.getElementById('notice'),content=document.getElementById('content');
const configured=config.supabaseUrl?.startsWith('https://')&&!config.supabaseUrl.includes('YOUR-PROJECT')&&config.supabaseAnonKey&&!config.supabaseAnonKey.includes('YOUR-');
const db=configured?createClient(config.supabaseUrl,config.supabaseAnonKey):null;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=v=>v?new Date(v).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'}):'未提供';
const validUrl=u=>{try{const x=new URL(u);return ['https:','http:'].includes(x.protocol)?x.href:'#'}catch{return '#'}};
let active='news';
async function query(table,select='*',limit=50,order){let q=db.from(table).select(select).limit(limit);if(order)q=q.order(order,{ascending:false});const r=await q;if(r.error)throw r.error;return r.data||[]}
async function refresh(){
 if(!db){notice.textContent='尚未設定 Supabase：請複製 config.example.js 為 config.js 並填入公開金鑰。';content.textContent='請依 README 完成部署。';return}
 notice.textContent='讀取資料中…';
 try{
  const [news,prices,logs]=await Promise.all([query('news_articles','id',1000),query('stock_prices','ticker',1000),query('sync_logs','source_id,status,finished_at',1,'finished_at')]);
  document.getElementById('newsCount').textContent=news.length>=1000?'≥1,000':news.length;
  document.getElementById('stockCount').textContent=prices.length>=1000?'≥1,000':prices.length;
  document.getElementById('syncStatus').textContent=logs[0]?.status==='success'?'成功':logs[0]?.status==='error'?'失敗':'尚無紀錄';
  notice.textContent=`最近同步：${date(logs[0]?.finished_at)}。網站讀取已儲存資料；更新需手動執行 GitHub Actions。`;
  await show(active);
 }catch(e){notice.textContent='讀取失敗：'+e.message;content.textContent='請檢查 Supabase 網址、RLS 和資料表設定。'}
}
async function show(tab){active=tab;document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));content.textContent='載入中…';
 try{
 if(tab==='news'){
  const rows=await query('news_articles','title,url,published_at,source_id',60,'published_at');
  content.innerHTML='<h2>全球新聞</h2>'+(rows.length?rows.map(x=>`<div class="item"><a href="${esc(validUrl(x.url))}" target="_blank" rel="noopener noreferrer">${esc(x.title)}</a><small>${esc(x.source_id)} · ${esc(date(x.published_at))}</small></div>`).join(''):'尚無新聞資料。');
 }else if(tab==='stocks'){
  const rows=await query('stock_prices','ticker,trade_date,close,volume',100,'trade_date');
  content.innerHTML='<h2>台股最新行情（前 100 筆）</h2><input id="filter" placeholder="搜尋股票代號"><div id="stockTable"></div>';
  const render=s=>{const filtered=rows.filter(x=>x.ticker.includes(s));document.getElementById('stockTable').innerHTML='<table><thead><tr><th>代號</th><th>日期</th><th>收盤價</th><th>成交量（股）</th></tr></thead><tbody>'+filtered.map(x=>`<tr><td>${esc(x.ticker)}</td><td>${esc(x.trade_date)}</td><td>${esc(x.close)}</td><td>${esc(x.volume)}</td></tr>`).join('')+'</tbody></table>'};render('');document.getElementById('filter').oninput=e=>render(e.target.value.trim());
 }else if(tab==='mops'){
  const rows=await query('mops_disclosures','ticker,title,url,published_at',60,'published_at');
  content.innerHTML='<h2>MOPS 重大訊息</h2><p class="muted">資料接入尚未實作；以下僅顯示資料庫現有紀錄。</p>'+(rows.length?rows.map(x=>`<div class="item"><a href="${esc(validUrl(x.url))}" target="_blank" rel="noopener noreferrer">${esc(x.title)}</a><small>${esc(x.ticker)} · ${esc(date(x.published_at))}</small></div>`).join(''):'目前無資料。');
 }else{
  const rows=await query('sync_logs','source_id,status,records_count,finished_at,detail',30,'finished_at');
  content.innerHTML='<h2>同步紀錄</h2><p class="muted">更新方式：GitHub → Actions → Manual market data sync → Run workflow。</p>'+rows.map(x=>`<div class="item"><strong>${esc(x.source_id)} · ${esc(x.status)}</strong><small>${esc(date(x.finished_at))} · ${esc(x.records_count)} 筆 · ${esc(x.detail||'')}</small></div>`).join('');
 }
 }catch(e){content.textContent='讀取失敗：'+e.message}
}
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.tab)));refresh();
