-- Cashier role, per-member collector assignment, and cashier RLS.

alter table public.user_roles drop constraint if exists user_roles_pkey;
alter table public.user_roles drop constraint if exists user_roles_role_check;
alter table public.user_roles add constraint user_roles_role_check
  check (role in ('admin', 'member', 'cashier'));
alter table public.user_roles add primary key (user_id, role);

alter table public.scheme_members
  add column if not exists collector_person_id uuid references public.people (id);
create index if not exists scheme_members_collector_idx on public.scheme_members (collector_person_id);

alter table public.payments
  add column if not exists recorded_by_person_id uuid references public.people (id);
alter table public.payouts
  add column if not exists recorded_by_person_id uuid references public.people (id);

create or replace function public.is_cashier()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'cashier'
  );
$$;

create or replace function public.refresh_round_totals(p_round_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (
    public.is_admin()
    or (
      public.is_cashier()
      and exists (
        select 1
        from public.payments p
        join public.scheme_members sm
          on sm.scheme_id = p.scheme_id and sm.person_id = p.person_id
        where p.round_id = p_round_id
          and sm.collector_person_id = public.my_person_id()
      )
    )
  ) then
    raise exception 'Not allowed to refresh this round.';
  end if;

  update public.rounds
  set
    actual_collection = coalesce((
      select sum(amount_paid) from public.payments where round_id = p_round_id
    ), 0),
    pending_amount = coalesce((
      select sum(case when status = 'waived' then 0 else amount_due - amount_paid end)
      from public.payments
      where round_id = p_round_id
    ), 0),
    updated_at = now()
  where id = p_round_id;
end;
$$;

create or replace function public.cashier_mark_payout_paid(
  p_payout_id uuid,
  p_paid_date date,
  p_method text,
  p_reference text,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payout public.payouts%rowtype;
begin
  if not public.is_cashier() then
    raise exception 'Only a cashier can mark this handover.';
  end if;

  select * into v_payout from public.payouts where id = p_payout_id;
  if not found then
    raise exception 'Payout not found.';
  end if;

  if not exists (
    select 1 from public.scheme_members sm
    where sm.scheme_id = v_payout.scheme_id
      and sm.person_id = v_payout.person_id
      and sm.collector_person_id = public.my_person_id()
  ) then
    raise exception 'This payout is not assigned to you.';
  end if;

  update public.payouts
  set
    status = 'paid',
    paid_date = coalesce(p_paid_date, current_date),
    method = nullif(p_method, ''),
    reference = nullif(p_reference, ''),
    notes = nullif(p_notes, ''),
    recorded_by_person_id = public.my_person_id(),
    updated_at = now()
  where id = p_payout_id;

  update public.rounds
  set
    recipient_person_id = v_payout.person_id,
    status = 'payout_complete',
    updated_at = now()
  where id = v_payout.round_id;
end;
$$;

drop policy if exists people_cashier_read on public.people;
create policy people_cashier_read on public.people
  for select using (
    public.is_cashier()
    and (
      id = public.my_person_id()
      or exists (
        select 1 from public.scheme_members sm
        where sm.person_id = people.id
          and sm.collector_person_id = public.my_person_id()
      )
    )
  );

drop policy if exists schemes_member_read on public.schemes;
create policy schemes_member_read on public.schemes
  for select using (
    exists (
      select 1 from public.scheme_members sm
      where sm.scheme_id = schemes.id
        and sm.person_id = public.my_person_id()
    )
    or exists (
      select 1 from public.scheme_members sm
      where sm.scheme_id = schemes.id
        and sm.collector_person_id = public.my_person_id()
        and public.is_cashier()
    )
  );

drop policy if exists scheme_members_self_read on public.scheme_members;
create policy scheme_members_self_read on public.scheme_members
  for select using (
    person_id = public.my_person_id()
    or (public.is_cashier() and collector_person_id = public.my_person_id())
  );

drop policy if exists rounds_member_read on public.rounds;
create policy rounds_member_read on public.rounds
  for select using (
    exists (
      select 1 from public.scheme_members sm
      where sm.scheme_id = rounds.scheme_id
        and (
          sm.person_id = public.my_person_id()
          or (public.is_cashier() and sm.collector_person_id = public.my_person_id())
        )
    )
  );

drop policy if exists payments_cashier_read on public.payments;
create policy payments_cashier_read on public.payments
  for select using (
    public.is_cashier()
    and exists (
      select 1 from public.scheme_members sm
      where sm.scheme_id = payments.scheme_id
        and sm.person_id = payments.person_id
        and sm.collector_person_id = public.my_person_id()
    )
  );

drop policy if exists payments_cashier_update on public.payments;
create policy payments_cashier_update on public.payments
  for update using (
    public.is_cashier()
    and exists (
      select 1 from public.scheme_members sm
      where sm.scheme_id = payments.scheme_id
        and sm.person_id = payments.person_id
        and sm.collector_person_id = public.my_person_id()
    )
  ) with check (
    public.is_cashier()
    and exists (
      select 1 from public.scheme_members sm
      where sm.scheme_id = payments.scheme_id
        and sm.person_id = payments.person_id
        and sm.collector_person_id = public.my_person_id()
    )
  );

drop policy if exists payouts_cashier_read on public.payouts;
create policy payouts_cashier_read on public.payouts
  for select using (
    public.is_cashier()
    and exists (
      select 1 from public.scheme_members sm
      where sm.scheme_id = payouts.scheme_id
        and sm.person_id = payouts.person_id
        and sm.collector_person_id = public.my_person_id()
    )
  );

grant execute on function public.is_cashier() to authenticated, anon;
grant execute on function public.refresh_round_totals(uuid) to authenticated;
grant execute on function public.cashier_mark_payout_paid(uuid, date, text, text, text) to authenticated;
