-- Open collection for the current calendar month and every older month.
-- Future months stay upcoming until an admin opens them by hand.

create or replace function public.open_due_collections()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_round public.rounds%rowtype;
  v_scheme public.schemes%rowtype;
begin
  if not (public.is_admin() or public.is_cashier()) then
    raise exception 'Not allowed to open collection.';
  end if;

  for v_round in
    select r.*
    from public.rounds r
    join public.schemes s on s.id = r.scheme_id
    where r.status = 'upcoming'
      and s.status = 'active'
      and date_trunc('month', r.due_date::timestamp) <= date_trunc('month', current_date::timestamp)
    order by r.due_date
  loop
    if not exists (
      select 1
      from public.scheme_members sm
      where sm.scheme_id = v_round.scheme_id
        and sm.status = 'active'
    ) then
      continue;
    end if;

    select * into v_scheme from public.schemes where id = v_round.scheme_id;

    insert into public.payments (
      scheme_id, round_id, person_id, amount_due, amount_paid, status, created_at, updated_at
    )
    select
      v_round.scheme_id,
      v_round.id,
      sm.person_id,
      v_scheme.monthly_amount,
      0,
      'pending',
      now(),
      now()
    from public.scheme_members sm
    where sm.scheme_id = v_round.scheme_id
      and sm.status = 'active'
      and not exists (
        select 1
        from public.payments p
        where p.round_id = v_round.id
          and p.person_id = sm.person_id
      );

    update public.rounds
    set
      status = 'collection_open',
      actual_collection = coalesce((
        select sum(amount_paid) from public.payments where round_id = v_round.id
      ), 0),
      pending_amount = coalesce((
        select sum(case when status = 'waived' then 0 else amount_due - amount_paid end)
        from public.payments
        where round_id = v_round.id
      ), 0),
      updated_at = now()
    where id = v_round.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.open_due_collections() to authenticated;
