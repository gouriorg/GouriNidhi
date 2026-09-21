-- Public/member read of contact, organizers and terms stored in settings.
drop policy if exists settings_public_organizer_photos on public.settings;
drop policy if exists settings_public_site_content on public.settings;
create policy settings_public_site_content on public.settings
  for select
  to anon, authenticated
  using (
    key in (
      'site.organizer_photos',
      'site.contact',
      'site.organizers',
      'site.terms'
    )
  );

grant select on public.settings to anon, authenticated;
