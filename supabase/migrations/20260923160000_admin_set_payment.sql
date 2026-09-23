-- Admins may record paid/unpaid for any active scheme member on any unclosed month.

create or replace function public.admin_set_payment(
  p_scheme_id uuid,
  p_round_id uuid,
  p_person_id uuid,
  p_paid boolean,
  p_paid_date date default current_date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round public.rounds%rowtype;
  v_scheme public.schemes%rowtype;
  v_payment_id uuid;
  v_due bigint;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can record this payment.';
  end if;

  if not exists (
    select 1 from public.scheme_members sm
    where sm.scheme_id = p_scheme_id
      and sm.person_id = p_person_id
      and sm.status = 'active'
  ) then
    raise exception 'This person is not an active member of the scheme.';
  end if;

  select * into v_round from public.rounds where id = p_round_id and scheme_id = p_scheme_id;
  if not found then
    raise exception 'Round not found.';
  end if;
  if v_round.status = 'closed' then
    raise exception 'This month is closed.';
  end if;

  select * into v_scheme from public.schemes where id = p_scheme_id;
  if not found then
    raise exception 'Scheme not found.';
  end if;

  select id, amount_due into v_payment_id, v_due
  from public.payments
  where round_id = p_round_id and person_id = p_person_id;

  if v_payment_id is null then
    insert into public.payments (
      scheme_id, round_id, person_id, amount_due, amount_paid, status,
      recorded_by_person_id, created_at, updated_at
    )
    values (
      p_scheme_id, p_round_id, p_person_id, v_scheme.monthly_amount, 0, 'pending',
      public.my_person_id(), now(), now()
    )
    returning id, amount_due into v_payment_id, v_due;
  end if;

  if p_paid then
    update public.payments
    set
      amount_paid = v_due,
      status = 'paid',
      paid_date = coalesce(p_paid_date, current_date),
      method = 'cash',
      recorded_by_person_id = public.my_person_id(),
      updated_at = now()
    where id = v_payment_id;
  else
    update public.payments
    set
      amount_paid = 0,
      status = 'pending',
      paid_date = null,
      method = null,
      reference = null,
      recorded_by_person_id = public.my_person_id(),
      updated_at = now()
    where id = v_payment_id;
  end if;

  perform public.refresh_round_totals(p_round_id);
end;
$$;

grant execute on function public.admin_set_payment(uuid, uuid, uuid, boolean, date) to authenticated;
