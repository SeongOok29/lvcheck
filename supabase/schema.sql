create table if not exists trade_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  exchange text not null,
  symbol text not null,
  direction text not null check (direction in ('Long', 'Short')),
  entry_price numeric not null,
  stop_price numeric not null,
  take_profit numeric,
  exposure_mode text not null,
  risk_mode text not null,
  margin_capital numeric,
  position_size numeric,
  risk_value numeric,
  price_delta numeric,
  price_delta_pct numeric,
  theoretical_max_leverage numeric,
  max_leverage numeric,
  max_position_size numeric,
  allowed_loss numeric,
  loss_at_stop numeric,
  risk_percent_of_capital numeric,
  risk_reward_ratio numeric,
  expected_profit numeric,
  expected_return_pct numeric,
  notes text
);

alter table trade_entries enable row level security;

drop policy if exists "Users can insert own trades" on trade_entries;
create policy "Users can insert own trades"
  on trade_entries
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can read own trades" on trade_entries;
create policy "Users can read own trades"
  on trade_entries
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can update own trades" on trade_entries;
create policy "Users can update own trades"
  on trade_entries
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own trades" on trade_entries;
create policy "Users can delete own trades"
  on trade_entries
  for delete
  using (auth.uid() = user_id);

create index if not exists trade_entries_user_id_created_at_idx
  on trade_entries(user_id, created_at desc);
