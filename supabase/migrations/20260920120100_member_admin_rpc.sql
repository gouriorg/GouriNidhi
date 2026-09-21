-- Admin member create/update/disable without an Edge Function.
-- Called as: select public.member_admin('{"action":"create", ...}'::jsonb);

create or replace function public.member_admin(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_action text := coalesce(payload->>'action', '');
  v_full_name text;
  v_mobile text;
  v_address text;
  v_notes text;
  v_id uuid;
  v_status text;
  v_user_id uuid;
  v_email text;
  v_person public.people%rowtype;
  v_clash public.people%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can manage members.';
  end if;

  if v_action = 'create' then
    v_full_name := trim(coalesce(payload->>'fullName', ''));
    v_mobile := trim(coalesce(payload->>'mobile', ''));
    v_address := nullif(trim(coalesce(payload->>'address', '')), '');
    v_notes := nullif(trim(coalesce(payload->>'notes', '')), '');

    if v_mobile !~ '^[6-9][0-9]{9}$' then
      raise exception 'Enter a valid 10-digit Indian mobile number.';
    end if;
    if char_length(v_full_name) < 2 then
      raise exception 'Name must be at least 2 characters.';
    end if;

    select * into v_clash from public.people where mobile = v_mobile;
    if found then
      raise exception '% already uses mobile %.', v_clash.full_name, v_mobile;
    end if;

    v_email := v_mobile || '@members.gourinidhi.local';
    v_user_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, reauthentication_token, phone_change, phone_change_token,
      is_sso_user, is_anonymous
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      crypt(v_mobile, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('role', 'member', 'mobile', v_mobile, 'fullName', v_full_name),
      now(), now(),
      '', '', '', '',
      '', '', '', '',
      false, false
    );

    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) values (
      v_user_id, v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
      'email', v_user_id::text, now(), now(), now()
    );

    insert into public.people (
      id, full_name, mobile, address, notes, status, auth_user_id, created_at, updated_at
    ) values (
      v_user_id, v_full_name, v_mobile, v_address, v_notes, 'active', v_user_id, now(), now()
    ) returning * into v_person;

    insert into public.user_roles (user_id, role) values (v_user_id, 'member');

    return jsonb_build_object('ok', true, 'person', to_jsonb(v_person));
  end if;

  if v_action = 'update' then
    v_id := (payload->>'id')::uuid;
    select * into v_person from public.people where id = v_id;
    if not found then
      raise exception 'Member not found.';
    end if;

    v_full_name := coalesce(nullif(trim(payload->>'fullName'), ''), v_person.full_name);
    v_address := case when payload ? 'address' then nullif(trim(payload->>'address'), '') else v_person.address end;
    v_notes := case when payload ? 'notes' then nullif(trim(payload->>'notes'), '') else v_person.notes end;
    v_mobile := v_person.mobile;

    if payload ? 'mobile' then
      v_mobile := trim(payload->>'mobile');
      if v_mobile !~ '^[6-9][0-9]{9}$' then
        raise exception 'Enter a valid 10-digit Indian mobile number.';
      end if;
    end if;

    update public.people
    set full_name = v_full_name,
        mobile = v_mobile,
        address = v_address,
        notes = v_notes,
        updated_at = now()
    where id = v_id
    returning * into v_person;

    if v_person.auth_user_id is not null then
      v_email := v_mobile || '@members.gourinidhi.local';
      update auth.users
      set email = v_email,
          encrypted_password = crypt(v_mobile, gen_salt('bf')),
          raw_user_meta_data = jsonb_build_object('role', 'member', 'mobile', v_mobile, 'fullName', v_full_name),
          updated_at = now()
      where id = v_person.auth_user_id;
      update auth.identities
      set identity_data = jsonb_build_object('sub', v_person.auth_user_id::text, 'email', v_email, 'email_verified', true),
          provider_id = v_person.auth_user_id::text,
          updated_at = now()
      where user_id = v_person.auth_user_id and provider = 'email';
    end if;

    return jsonb_build_object('ok', true, 'person', to_jsonb(v_person));
  end if;

  if v_action = 'setStatus' then
    v_id := (payload->>'id')::uuid;
    v_status := case when payload->>'status' = 'inactive' then 'inactive' else 'active' end;
    select * into v_person from public.people where id = v_id;
    if not found then
      raise exception 'Member not found.';
    end if;

    update public.people
    set status = v_status, updated_at = now()
    where id = v_id
    returning * into v_person;

    if v_person.auth_user_id is not null then
      update auth.users
      set banned_until = case when v_status = 'inactive' then now() + interval '100 years' else null end,
          updated_at = now()
      where id = v_person.auth_user_id;
    end if;

    return jsonb_build_object('ok', true, 'person', to_jsonb(v_person));
  end if;

  if v_action = 'ensureAuth' then
    v_id := (payload->>'id')::uuid;
    select * into v_person from public.people where id = v_id;
    if not found then
      raise exception 'Member not found.';
    end if;
    if v_person.auth_user_id is not null then
      return jsonb_build_object('ok', true, 'person', to_jsonb(v_person));
    end if;

    v_mobile := v_person.mobile;
    v_email := v_mobile || '@members.gourinidhi.local';
    v_user_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, reauthentication_token, phone_change, phone_change_token,
      is_sso_user, is_anonymous
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_user_id, 'authenticated', 'authenticated', v_email,
      crypt(v_mobile, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('role', 'member', 'mobile', v_mobile, 'fullName', v_person.full_name),
      now(), now(), '', '', '', '', '', '', '', '', false, false
    );
    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) values (
      v_user_id, v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
      'email', v_user_id::text, now(), now(), now()
    );
    update public.people
    set auth_user_id = v_user_id, updated_at = now()
    where id = v_id
    returning * into v_person;
    insert into public.user_roles (user_id, role) values (v_user_id, 'member')
    on conflict (user_id) do nothing;

    return jsonb_build_object('ok', true, 'person', to_jsonb(v_person));
  end if;

  raise exception 'Unknown action.';
end;
$$;

revoke all on function public.member_admin(jsonb) from public;
grant execute on function public.member_admin(jsonb) to authenticated;
