-- More than one member can take the same month. The same person still
-- cannot be recorded twice in that month.
alter table public.payouts
  drop constraint if exists payouts_scheme_id_round_id_key;

alter table public.payouts
  drop constraint if exists payouts_scheme_id_round_id_person_id_key;

alter table public.payouts
  add constraint payouts_scheme_id_round_id_person_id_key
  unique (scheme_id, round_id, person_id);
