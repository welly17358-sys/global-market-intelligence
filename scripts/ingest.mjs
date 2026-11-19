import { XMLParser } from 'fast-xml-parser';
import { createHash } from 'node:crypto';

const base = process.env.SUPABASE_URL?.replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!base || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
const parser = new XMLParser({ ignoreAttributes: false, processEntities: false });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function request(url, options = {}) {
  const r = await fetch(url, { signal: AbortSignal.timeout(25000), ...options });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}: ${url}`);
  return r;
}
async function upsert(table, rows, conflict) {
  for (let i = 0; i < rows.length; i += 200) {
    const response = await request(`${base}/rest/v1/${table}?on_conflict=${encodeURIComponent(conflict)}`, {
      method: 'POST', headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows.slice(i, i + 200))
    });
    await response.arrayBuffer();
  }
}
async function mark(source, status, count, detail = '') {
  await request(`${base}/rest/v1/sync_logs`, { method: 'POST', headers,
    body: JSON.stringify({ source_id: source, status, records_count: count, detail: detail.slice(0,500), finished_at: new Date().toISOString() }) });
  if (status === 'success') await request(`${base}/rest/v1/sources?id=eq.${source}`, {
    method: 'PATCH', headers, body: JSON.stringify({ last_success_at: new Date().toISOString() }) });
}
function array(v) { return v == null ? [] : Array.isArray(v) ? v : [v]; }
function plain(v) { return String(typeof v === 'object' ? (v?.['#text'] ?? '') : (v ?? '')).replace(/<[^>]*>/g, '').trim(); }
function numeric(v) {
  const s = String(v ?? '').replaceAll(',', '').trim();
  if (!s || ['--','-','N/A'].includes(s)) return null;
  const n = Number(s); return Number.isFinite(n) ? n : null;
}
function dateOf(raw) {
  const s = String(raw ?? '').trim();
  let iso = null;
  if (/^\d{7}$/.test(s)) iso = `${Number(s.slice(0,3))+1911}-${s.slice(3,5)}-${s.slice(5,7)}`;
  else if (/^\d{8}$/.test(s)) iso = `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
  else if (/^\d{4}-\d\d-\d\d$/.test(s)) iso = s;
  if (!iso || Number.isNaN(Date.parse(iso+'T00:00:00Z'))) return null;
  return iso;
}
async function technews() {
  const xml = await (await request('https://technews.tw/feed/', { headers: {'User-Agent':'GlobalMarketIntelligence/1.7'} })).text();
  const feed = parser.parse(xml);
  const entries = array(feed?.rss?.channel?.item ?? feed?.feed?.entry);
  if (!entries.length) throw new Error('RSS contains no entries');
  const rows = entries.slice(0,100).map(e => {
    const title = plain(e.title).slice(0,500);
    const url = plain(e.link?.['@_href'] ?? e.link);
    if (!title || !/^https?:\/\//.test(url)) return null;
    const stamp = e.pubDate ?? e.published ?? e.updated;
    const parsedDate = stamp ? new Date(stamp) : null;
    return { id: createHash('sha256').update(url).digest('hex').slice(0,32),
      source_id:'technews', title, url, category:'科技',
      published_at: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : null };
  }).filter(Boolean);
  if (!rows.length) throw new Error('RSS has no usable articles');
  await upsert('news_articles',rows,'id');
  return rows.length;
}
async function twse() {
  const data = await (await request('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL')).json();
  if (!Array.isArray(data) || !data.length) throw new Error('TWSE returned no stock list');
  const companies = [], prices = [];
  for (const item of data) {
    const ticker = String(item.Code ?? '').trim();
    if (!/^\d{4,6}$/.test(ticker)) continue;
    const tradeDate = dateOf(item.Date);
    if (!tradeDate) continue; // never invent trading dates
    companies.push({ticker, name: String(item.Name ?? ticker).trim(), market:'TWSE'});
    prices.push({ticker, trade_date:tradeDate, open:numeric(item.OpeningPrice),
      high:numeric(item.HighestPrice), low:numeric(item.LowestPrice),
      close:numeric(item.ClosingPrice), volume:numeric(item.TradeVolume)});
  }
  if (!prices.length) throw new Error('TWSE response lacks valid Date rows; inspect endpoint fields before adapting');
  await upsert('companies',companies,'ticker');
  await upsert('stock_prices',prices,'ticker,trade_date');
  return prices.length;
}
let failures = 0;
for (const [id, fn] of [['technews',technews],['twse',twse]]) {
  try {
    const n = await fn();
    await mark(id,'success',n);
    console.log(`${id}: ${n} records`);
  } catch(e) {
    failures++;
    console.error(`${id}: ${e.message}`);
    try { await mark(id,'error',0,e.message); } catch(logError) { console.error('log:',logError.message); }
  }
}
if (failures) process.exitCode = 1;
