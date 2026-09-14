alter table public.packages
  add column if not exists venue_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'packages_venue_id_fkey'
  ) then
    alter table public.packages
      add constraint packages_venue_id_fkey
      foreign key (venue_id)
      references public.venues(id)
      on delete set null;
  end if;
end
$$;

create index if not exists packages_venue_id_idx
  on public.packages (venue_id);
