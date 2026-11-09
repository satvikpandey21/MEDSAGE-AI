-- Patient-only projection of approved caretaker contact details.
-- Run in the Supabase SQL Editor as the database administrator.
-- Requires existing public.caretaker_links and public.patient_profiles tables.
-- Approval authorizes sharing the linked caretaker's profile name and phone
-- with that patient only. No profile SELECT policy or table grant is added.
begin;

create or replace function public.get_my_approved_caretakers()
returns table (
  link_id text,
  full_name text,
  phone text,
  connection_date text,
  date_source text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    link.id::text,
    nullif(btrim(profile.full_name::text), ''),
    nullif(btrim(profile.phone::text), ''),
    coalesce(
      to_jsonb(link)->>'approved_at',
      to_jsonb(link)->>'created_at'
    ),
    case
      when to_jsonb(link)->>'approved_at' is not null then 'approved_at'
      else 'created_at'
    end
  from public.caretaker_links as link
  left join public.patient_profiles as profile on profile.id = link.caretaker_id
  where auth.uid() is not null
    and link.patient_id = auth.uid()
    and link.status = 'approved'
  order by link.id;
$$;

revoke all on function public.get_my_approved_caretakers() from public;
revoke all on function public.get_my_approved_caretakers() from anon;
grant execute on function public.get_my_approved_caretakers() to authenticated;

comment on function public.get_my_approved_caretakers() is
  'Returns only the authenticated patient''s approved caretaker names and phones; accepts no patient or caretaker ID.';

commit;
