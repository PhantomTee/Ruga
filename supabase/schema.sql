create extension if not exists pgcrypto;

create table if not exists markets (
  id bigint primary key,
  on_chain_id integer not null unique,
  token_symbol text not null,
  token_name text,
  coingecko_id text,
  commit_sha text,
  commit_message text,
  groq_reasoning text,
  groq_confidence integer,
  price_at_creation numeric,
  yes_pool numeric default 0,
  no_pool numeric default 0,
  created_at timestamptz default now(),
  resolves_at timestamptz,
  resolved boolean default false,
  outcome boolean,
  final_price numeric
);

create table if not exists bets (
  id uuid primary key default gen_random_uuid(),
  market_id bigint references markets(id),
  wallet_address text not null,
  side text check (side in ('yes', 'no')),
  amount numeric not null,
  tx_hash text unique,
  created_at timestamptz default now()
);

create table if not exists commits_processed (
  sha text primary key,
  commit_message text,
  tokens_found text[],
  status text default 'processing' check (status in ('processing', 'scanned', 'signal_found', 'market_created', 'ignored', 'failed')),
  error_message text,
  processed_at timestamptz default now()
);

alter table markets add column if not exists on_chain_id integer;
alter table markets add column if not exists token_name text;
alter table markets add column if not exists coingecko_id text;
alter table markets add column if not exists commit_sha text;
alter table markets add column if not exists commit_message text;
alter table markets add column if not exists groq_reasoning text;
alter table markets add column if not exists groq_confidence integer;
alter table markets add column if not exists price_at_creation numeric;
alter table markets add column if not exists yes_pool numeric default 0;
alter table markets add column if not exists no_pool numeric default 0;
alter table markets add column if not exists resolves_at timestamptz;
alter table markets add column if not exists resolved boolean default false;
alter table markets add column if not exists outcome boolean;
alter table markets add column if not exists final_price numeric;

alter table commits_processed add column if not exists status text default 'processing';
alter table commits_processed add column if not exists error_message text;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'commits_processed'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%status%'
  loop
    execute format('alter table commits_processed drop constraint if exists %I', constraint_name);
  end loop;
end $$;

alter table commits_processed
  add constraint commits_processed_status_check
  check (status in ('processing', 'scanned', 'signal_found', 'market_created', 'ignored', 'failed'));

create table if not exists market_creation_locks (
  token_symbol text primary key,
  created_at timestamptz default now()
);

create unique index if not exists markets_token_symbol_unique on markets (token_symbol);
create unique index if not exists markets_token_symbol_upper_unique on markets (upper(token_symbol));
create unique index if not exists bets_tx_hash_unique on bets (tx_hash);

alter table markets enable row level security;
alter table bets enable row level security;
alter table commits_processed enable row level security;
alter table market_creation_locks enable row level security;

drop policy if exists "public read markets" on markets;
create policy "public read markets" on markets for select using (true);

drop policy if exists "public read bets" on bets;
create policy "public read bets" on bets for select using (true);

drop policy if exists "public read commits" on commits_processed;
create policy "public read commits" on commits_processed for select using (true);

drop policy if exists "service write markets" on markets;
create policy "service write markets" on markets for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "service write bets" on bets;
create policy "service write bets" on bets for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "service write commits" on commits_processed;
create policy "service write commits" on commits_processed for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "service write market locks" on market_creation_locks;
create policy "service write market locks" on market_creation_locks for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
