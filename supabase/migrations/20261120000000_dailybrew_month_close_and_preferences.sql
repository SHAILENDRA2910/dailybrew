-- DailyBrew — month-end close, display preferences and receipt metadata
--
-- Companion to 20261119000000_dailybrew_schema.sql. The local-first app stores
-- receipts as blobs in IndexedDB; this blueprint stores the object path so the
-- same photo can live in Supabase Storage when remote sync is wired up.

begin;

alter table public.workspaces
  add column if not exists date_format text not null default 'dmy'
  check (date_format in ('dmy', 'medium'));

create table if not exists public.month_closures (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  month text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  closing_total bigint not null check (closing_total >= 0),
  entry_count integer not null check (entry_count >= 0),
  closed_at timestamptz not null default now(),
  unique (workspace_id, month)
);

create index if not exists month_closures_workspace_idx
  on public.month_closures (workspace_id, month desc);

create table if not exists public.expense_receipts (
  expense_id uuid primary key,
  workspace_id uuid not null,
  storage_path text not null,
  mime_type text not null default 'image/jpeg',
  created_at timestamptz not null default now(),
  constraint expense_receipts_transaction_fk
    foreign key (expense_id, workspace_id)
    references public.transactions (id, workspace_id)
    on delete cascade
);

alter table public.month_closures enable row level security;
alter table public.expense_receipts enable row level security;

drop policy if exists month_closures_select_member on public.month_closures;
create policy month_closures_select_member on public.month_closures
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists month_closures_write_admin on public.month_closures;
create policy month_closures_write_admin on public.month_closures
  for all to authenticated
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

drop policy if exists expense_receipts_select_member on public.expense_receipts;
create policy expense_receipts_select_member on public.expense_receipts
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists expense_receipts_write_admin on public.expense_receipts;
create policy expense_receipts_write_admin on public.expense_receipts
  for all to authenticated
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

grant select, insert, update, delete on public.month_closures to authenticated;
grant select, insert, update, delete on public.expense_receipts to authenticated;

-- A closed month rejects changes at the database boundary as well as in the app.
create or replace function public.guard_closed_month()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_workspace uuid;
  target_month text;
begin
  if tg_op in ('INSERT', 'UPDATE') then
    target_workspace := new.workspace_id;
    target_month := to_char(new.expense_date, 'YYYY-MM');
    if exists (
      select 1 from public.month_closures
      where workspace_id = target_workspace and month = target_month
    ) then
      raise exception 'That month is closed. Reopen it before changing expenses.'
        using errcode = '55000';
    end if;
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    target_workspace := old.workspace_id;
    target_month := to_char(old.expense_date, 'YYYY-MM');
    if exists (
      select 1 from public.month_closures
      where workspace_id = target_workspace and month = target_month
    ) then
      raise exception 'That month is closed. Reopen it before changing expenses.'
        using errcode = '55000';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists transactions_guard_closed_month on public.transactions;
create trigger transactions_guard_closed_month
  before insert or update or delete on public.transactions
  for each row execute function public.guard_closed_month();

commit;
