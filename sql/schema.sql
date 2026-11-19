-- Run in Supabase SQL editor. Public read, service-role-only writes.
create table if not exists public.sources (
 id text primary key, name text not null, url text not null, enabled boolean not null default true,
 last_success_at timestamptz
);
create table if not exists public.news_articles (
 id text primary key, source_id text references public.sources(id), title text not null,
 url text not null unique, published_at timestamptz, fetched_at timestamptz not null default now(),
 summary text, category text, created_at timestamptz not null default now()
);
create index if not exists news_published_idx on public.news_articles (published_at desc);
create table if not exists public.companies (
 ticker text primary key, name text not null, market text not null default 'TWSE', updated_at timestamptz not null default now()
);
create table if not exists public.stock_prices (
 ticker text not null references public.companies(ticker), trade_date date not null,
 open numeric, high numeric, low numeric, close numeric, volume bigint,
 updated_at timestamptz not null default now(), primary key(ticker,trade_date)
);
create index if not exists stock_prices_date_idx on public.stock_prices (trade_date desc);
create table if not exists public.mops_disclosures (
 id text primary key, ticker text, title text not null, published_at timestamptz,
 url text, disclosure_type text, fetched_at timestamptz not null default now()
);
create index if not exists disclosures_time_idx on public.mops_disclosures(published_at desc);
create table if not exists public.sync_logs (
 id bigint generated always as identity primary key, source_id text not null,
 started_at timestamptz not null default now(), finished_at timestamptz,
 status text not null, records_count integer not null default 0, detail text
);
insert into public.sources(id,name,url,enabled) values
 ('technews','科技新報','https://technews.tw/feed/',true),
 ('cnyes','鉅亨網','https://news.cnyes.com/news/cat/headline?exp=a',false),
 ('twse','臺灣證券交易所','https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL',true)
on conflict(id) do nothing;
-- Explicitly enable RLS; no public write policies. Service role bypasses RLS.
alter table public.sources enable row level security;
alter table public.news_articles enable row level security;
alter table public.companies enable row level security;
alter table public.stock_prices enable row level security;
alter table public.mops_disclosures enable row level security;
alter table public.sync_logs enable row level security;
drop policy if exists "public read sources" on public.sources;
create policy "public read sources" on public.sources for select to anon, authenticated using (true);
drop policy if exists "public read news" on public.news_articles;
create policy "public read news" on public.news_articles for select to anon, authenticated using (true);
drop policy if exists "public read companies" on public.companies;
create policy "public read companies" on public.companies for select to anon, authenticated using (true);
drop policy if exists "public read prices" on public.stock_prices;
create policy "public read prices" on public.stock_prices for select to anon, authenticated using (true);
drop policy if exists "public read disclosures" on public.mops_disclosures;
create policy "public read disclosures" on public.mops_disclosures for select to anon, authenticated using (true);
drop policy if exists "public read logs" on public.sync_logs;
create policy "public read logs" on public.sync_logs for select to anon, authenticated using (true);
