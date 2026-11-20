-- DailyBrew — Supabase / PostgreSQL schema
--
-- This migration mirrors the app's local domain model. The shipped frontend is
-- local-first and does not call Supabase until a project URL and anon key are
-- configured, so applying this file does not affect the running application.
--
-- Apply with: supabase db push (or paste into the Supabase SQL editor).
-- Amounts are stored as integer paise, never floating point.

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default 'Owner',
  email text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, workspace_id)
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  category_id uuid not null,
  name text not null check (char_length(name) between 1 and 80),
  default_rate bigint not null default 0 check (default_rate >= 0),
  unit text not null default 'piece',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  constraint items_category_workspace_fk
    foreign key (category_id, workspace_id)
    references public.categories (id, workspace_id)
    on delete restrict
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  expense_date date not null,
  note text not null default '' check (char_length(note) <= 240),
  import_fingerprint text,
  import_source text,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);

create table if not exists public.transaction_items (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null,
  workspace_id uuid not null,
  item_id uuid not null,
  item_name_snapshot text not null,
  quantity numeric(10, 3) not null check (quantity > 0),
  unit_rate bigint not null check (unit_rate >= 0),
  line_total bigint generated always as (round(quantity * unit_rate)::bigint) stored,
  created_at timestamptz not null default now(),
  constraint transaction_items_transaction_fk
    foreign key (transaction_id, workspace_id)
    references public.transactions (id, workspace_id)
    on delete cascade,
  constraint transaction_items_item_fk
    foreign key (item_id, workspace_id)
    references public.items (id, workspace_id)
    on delete restrict
);

create table if not exists public.monthly_budgets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  year integer not null check (year between 2000 and 2100),
  month integer not null check (month between 1 and 12),
  budget_amount bigint not null check (budget_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, year, month)
);

create table if not exists public.item_price_history (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  old_rate bigint not null check (old_rate >= 0),
  new_rate bigint not null check (new_rate >= 0),
  effective_date date not null default current_date,
  changed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create unique index if not exists categories_workspace_name_unique
  on public.categories (workspace_id, lower(name));
create unique index if not exists items_workspace_name_unique
  on public.items (workspace_id, lower(name));
create index if not exists items_workspace_category_idx
  on public.items (workspace_id, category_id, is_active);
create index if not exists transactions_workspace_date_idx
  on public.transactions (workspace_id, expense_date desc);
create unique index if not exists transactions_import_fingerprint_unique
  on public.transactions (workspace_id, import_fingerprint)
  where import_fingerprint is not null;
create index if not exists transaction_items_transaction_idx
  on public.transaction_items (transaction_id);
create index if not exists transaction_items_workspace_item_idx
  on public.transaction_items (workspace_id, item_id);
create index if not exists item_price_history_item_idx
  on public.item_price_history (item_id, effective_date desc);
create index if not exists workspace_members_user_idx
  on public.workspace_members (user_id);

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(new.email, ''), '@', 1), 'Owner'),
    coalesce(new.email, '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_admin(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace
      and user_id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.shares_workspace(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members me
    join public.workspace_members them using (workspace_id)
    where me.user_id = auth.uid()
      and them.user_id = target_user
  );
$$;

revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.is_workspace_admin(uuid) from public;
revoke all on function public.shares_workspace(uuid) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_admin(uuid) to authenticated;
grant execute on function public.shares_workspace(uuid) to authenticated;

-- New auth users receive a profile row.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Price history is append-only and written by the database, not the client.
-- ---------------------------------------------------------------------------

create or replace function public.log_item_price_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  changed uuid := auth.uid();
begin
  if new.default_rate is distinct from old.default_rate then
    if changed is not null and not exists (select 1 from public.profiles where id = changed) then
      changed := null;
    end if;
    insert into public.item_price_history (
      item_id, old_rate, new_rate, effective_date, changed_by
    )
    values (new.id, old.default_rate, new.default_rate, current_date, changed);
  end if;
  return new;
end;
$$;

drop trigger if exists item_price_history_trigger on public.items;
create trigger item_price_history_trigger
  after update of default_rate on public.items
  for each row execute function public.log_item_price_change();

drop trigger if exists items_touch_updated_at on public.items;
create trigger items_touch_updated_at
  before update on public.items
  for each row execute function public.touch_updated_at();

drop trigger if exists budgets_touch_updated_at on public.monthly_budgets;
create trigger budgets_touch_updated_at
  before update on public.monthly_budgets
  for each row execute function public.touch_updated_at();

drop trigger if exists transactions_touch_updated_at on public.transactions;
create trigger transactions_touch_updated_at
  before update on public.transactions
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.workspaces enable row level security;
alter table public.profiles enable row level security;
alter table public.workspace_members enable row level security;
alter table public.categories enable row level security;
alter table public.items enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_items enable row level security;
alter table public.monthly_budgets enable row level security;
alter table public.item_price_history enable row level security;

drop policy if exists workspaces_select_member on public.workspaces;
create policy workspaces_select_member on public.workspaces
  for select to authenticated
  using (public.is_workspace_member(id));

drop policy if exists workspaces_update_admin on public.workspaces;
create policy workspaces_update_admin on public.workspaces
  for update to authenticated
  using (public.is_workspace_admin(id))
  with check (public.is_workspace_admin(id));

drop policy if exists workspaces_delete_admin on public.workspaces;
create policy workspaces_delete_admin on public.workspaces
  for delete to authenticated
  using (public.is_workspace_admin(id));

drop policy if exists profiles_select_shared on public.profiles;
create policy profiles_select_shared on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.shares_workspace(id));

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists members_select_workspace on public.workspace_members;
create policy members_select_workspace on public.workspace_members
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists members_insert_admin on public.workspace_members;
create policy members_insert_admin on public.workspace_members
  for insert to authenticated
  with check (public.is_workspace_admin(workspace_id));

drop policy if exists members_update_admin on public.workspace_members;
create policy members_update_admin on public.workspace_members
  for update to authenticated
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

drop policy if exists members_delete_admin on public.workspace_members;
create policy members_delete_admin on public.workspace_members
  for delete to authenticated
  using (public.is_workspace_admin(workspace_id) and user_id <> auth.uid());

drop policy if exists categories_select_member on public.categories;
create policy categories_select_member on public.categories
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists categories_write_admin on public.categories;
create policy categories_write_admin on public.categories
  for all to authenticated
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

drop policy if exists items_select_member on public.items;
create policy items_select_member on public.items
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists items_write_admin on public.items;
create policy items_write_admin on public.items
  for all to authenticated
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

drop policy if exists budgets_select_member on public.monthly_budgets;
create policy budgets_select_member on public.monthly_budgets
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists budgets_write_admin on public.monthly_budgets;
create policy budgets_write_admin on public.monthly_budgets
  for all to authenticated
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

drop policy if exists transactions_select_member on public.transactions;
create policy transactions_select_member on public.transactions
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists transactions_insert_member on public.transactions;
create policy transactions_insert_member on public.transactions
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());

drop policy if exists transactions_update_admin on public.transactions;
create policy transactions_update_admin on public.transactions
  for update to authenticated
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

drop policy if exists transactions_delete_admin on public.transactions;
create policy transactions_delete_admin on public.transactions
  for delete to authenticated
  using (public.is_workspace_admin(workspace_id));

drop policy if exists transaction_items_select_member on public.transaction_items;
create policy transaction_items_select_member on public.transaction_items
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists transaction_items_insert_member on public.transaction_items;
create policy transaction_items_insert_member on public.transaction_items
  for insert to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and exists (
      select 1 from public.transactions t
      where t.id = transaction_items.transaction_id
        and t.workspace_id = transaction_items.workspace_id
        and (
          t.created_by = auth.uid()
          or public.is_workspace_admin(transaction_items.workspace_id)
        )
    )
  );

drop policy if exists transaction_items_update_admin on public.transaction_items;
create policy transaction_items_update_admin on public.transaction_items
  for update to authenticated
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

drop policy if exists transaction_items_delete_admin on public.transaction_items;
create policy transaction_items_delete_admin on public.transaction_items
  for delete to authenticated
  using (public.is_workspace_admin(workspace_id));

drop policy if exists price_history_select_member on public.item_price_history;
create policy price_history_select_member on public.item_price_history
  for select to authenticated
  using (
    exists (
      select 1 from public.items i
      where i.id = item_id and public.is_workspace_member(i.workspace_id)
    )
  );

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- ---------------------------------------------------------------------------
-- Atomic RPCs
-- ---------------------------------------------------------------------------

create or replace function public.create_workspace(workspace_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace uuid;
  member_id uuid := auth.uid();
  display_name text;
  display_email text;
begin
  if member_id is null then
    raise exception 'Sign in to create a workspace.' using errcode = '42501';
  end if;
  if char_length(trim(workspace_name)) < 1 or char_length(trim(workspace_name)) > 80 then
    raise exception 'Workspace names must be 1–80 characters.';
  end if;

  select coalesce(nullif(raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(email, ''), '@', 1), 'Owner'), coalesce(email, '')
    into display_name, display_email
    from auth.users where id = member_id;

  insert into public.profiles (id, full_name, email)
  values (member_id, display_name, display_email)
  on conflict (id) do nothing;

  insert into public.workspaces (name) values (trim(workspace_name)) returning id into new_workspace;
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace, member_id, 'admin');

  insert into public.categories (workspace_id, name)
  values (new_workspace, 'Tea'),
         (new_workspace, 'Coffee'),
         (new_workspace, 'Snacks'),
         (new_workspace, 'Food'),
         (new_workspace, 'Other');

  insert into public.items (workspace_id, category_id, name, default_rate, unit)
  select new_workspace, c.id, seed.name, seed.rate, seed.unit
  from (values
    ('Coffee', 'Black Coffee', 2000::bigint, 'cup'),
    ('Coffee', 'Milk Coffee', 2500::bigint, 'cup'),
    ('Coffee', 'Coffee', 2000::bigint, 'cup'),
    ('Tea', 'Tea Medium', 1800::bigint, 'cup'),
    ('Tea', 'Tea Small', 1500::bigint, 'cup'),
    ('Tea', 'Lemon Tea', 2000::bigint, 'cup'),
    ('Snacks', 'Biscuit', 500::bigint, 'piece'),
    ('Snacks', 'Toast', 500::bigint, 'piece'),
    ('Snacks', 'Donut', 1500::bigint, 'piece')
  ) as seed(category, name, rate, unit)
  join public.categories c on c.workspace_id = new_workspace and c.name = seed.category;

  return new_workspace;
end;
$$;

create or replace function public.create_expense(
  p_workspace_id uuid,
  p_expense_date date,
  p_note text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_transaction uuid;
  affected integer;
  expected integer;
begin
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'You do not have access to this workspace.' using errcode = '42501';
  end if;
  if p_expense_date is null then
    raise exception 'Choose an expense date.';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one item.';
  end if;
  expected := jsonb_array_length(p_items);

  insert into public.transactions (workspace_id, expense_date, note, created_by)
  values (p_workspace_id, p_expense_date, coalesce(trim(p_note), ''), auth.uid())
  returning id into new_transaction;

  insert into public.transaction_items (
    transaction_id, workspace_id, item_id, item_name_snapshot, quantity, unit_rate
  )
  select new_transaction, p_workspace_id, i.id, i.name, line.quantity, line.unit_rate
  from jsonb_to_recordset(p_items) as line(item_id uuid, quantity numeric, unit_rate bigint)
  join public.items i on i.id = line.item_id and i.workspace_id = p_workspace_id
  where line.quantity > 0
    and line.quantity <= 100000
    and line.unit_rate >= 0
    and line.unit_rate <= 100000000;

  get diagnostics affected = row_count;

  if affected <> expected then
    raise exception 'One or more items are invalid or outside this workspace.';
  end if;

  return new_transaction;
end;
$$;

revoke all on function public.create_workspace(text) from public;
revoke all on function public.create_expense(uuid, date, text, jsonb) from public;
grant execute on function public.create_workspace(text) to authenticated;
grant execute on function public.create_expense(uuid, date, text, jsonb) to authenticated;

commit;
