// Optional bounded historical backfill for ten TWSE tickers, two months.
// Invoke manually from GitHub Actions; do not run on every scheduled sync.
const base=process.env.SUPABASE_URL?.replace(/\/$/,'');
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!base||!key)throw new Error('Missing Supabase environment secrets');
const headers={apikey:key,'Content-Type':'application/json'};
const tickers=['2330','2308','2317','2383','3017','3037','2327','6669','2345','3711'];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const num=v=>{const s=String(v??'').replaceAll(',','').trim();if(!s||s==='--'||s==='-')return null;const n=Number(s);return Number.isFinite(n)?n:null};
const rocDate=v=>{const m=String(v).match(/^(\d{3})\/(\d{2})\/(\d{2})$/);return m?`${Number(m[1])+1911}-${m[2]}-${m[3]}`:null};
async function upsert(table,rows,conflict){if(!rows.length)return;const r=await fetch(`${base}/rest/v1/${table}?on_conflict=${encodeURIComponent(conflict)}`,{method:'POST',headers:{...headers,Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(rows),signal:AbortSignal.timeout(25000)});if(!r.ok)throw new Error(`${table} ${r.status}: ${(await r.text()).slice(0,250)}`)}
const now=new Date();const months=[0,1].map(delta=>{const d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-delta,1));return `${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,'0')}01`});
let inserted=0, failures=0;
for(const ticker of tickers){
  for(const month of months){
    try{
      const url=`https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=${month}&stockNo=${ticker}`;
      const r=await fetch(url,{headers:{'User-Agent':'GlobalMarketIntelligence/1.9 (personal research)'},signal:AbortSignal.timeout(25000)});
      if(!r.ok)throw new Error(`TWSE HTTP ${r.status}`);
      const j=await r.json();
      if(j.stat!=='OK'||!Array.isArray(j.data))throw new Error(`TWSE status: ${j.stat??'missing'}`);
      const rows=j.data.map(x=>({ticker,trade_date:rocDate(x[0]),volume:num(x[1]),open:num(x[3]),high:num(x[4]),low:num(x[5]),close:num(x[6])})).filter(x=>x.trade_date);
      await upsert('stock_prices',rows,'ticker,trade_date');inserted+=rows.length;
      console.log(`${ticker} ${month}: ${rows.length} daily rows`);
    }catch(e){failures++;console.error(`${ticker} ${month}: ${e.message}`)}
    await sleep(1200); // modest request pace; TWSE may still limit access
  }
}
console.log(`Backfill completed: ${inserted} rows submitted; ${failures} failed month/ticker requests`);
if(failures)process.exitCode=1;
