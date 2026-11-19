-- V2.0: run ONCE in Supabase SQL Editor before enabling briefing generation.
create table if not exists public.market_briefs (
 id text primary key,
 brief_date date not null,
 kind text not null check (kind in ('event','trend')),
 category text not null,
 title text not null,
 summary text not null,
 importance_score integer not null check (importance_score between 0 and 100),
 source_urls jsonb not null default '[]'::jsonb,
 generated_at timestamptz not null default now()
);
create index if not exists market_briefs_date_idx on public.market_briefs(brief_date desc,importance_score desc);
alter table public.market_briefs enable row level security;
grant usage on schema public to anon;
grant select on public.market_briefs to anon;
drop policy if exists "public read market briefs" on public.market_briefs;
create policy "public read market briefs" on public.market_briefs for select to anon using (true);
-- Keep writes limited to the privileged GitHub Actions secret key.
