-- Exercise the production initializer using a temporary profile-shaped table.
-- No auth users are created; all category changes roll back.
begin;
create temporary table category_test_profiles (id uuid);
create trigger test_initialize_categories after insert on category_test_profiles
for each row execute function public.initialize_profile_categories();
insert into public.categories(user_id, name, is_hidden)
values ('00000000-0000-0000-0000-00000000ca02', 'Groceries', true),
       ('00000000-0000-0000-0000-00000000ca02', 'Custom test', false);
insert into category_test_profiles values ('00000000-0000-0000-0000-00000000ca02');
do $$ begin
  if (select count(*) from public.categories where user_id = '00000000-0000-0000-0000-00000000ca02' and name in ('Groceries','Dining','Household','Personal care','Health','Clothing','Electronics','Transport','Utilities','Entertainment','Education','Other')) <> 12 then
    raise exception 'Initializer must create all twelve defaults';
  end if;
end $$;
insert into category_test_profiles values ('00000000-0000-0000-0000-00000000ca02');
do $$ begin
  if (select count(*) from public.categories where user_id = '00000000-0000-0000-0000-00000000ca02') <> 13 then
    raise exception 'Repeated initialization must not duplicate categories or remove custom categories';
  end if;
  if not exists (select 1 from public.categories where user_id = '00000000-0000-0000-0000-00000000ca02' and name = 'Groceries' and is_hidden) then
    raise exception 'Existing hidden categories must remain hidden';
  end if;
end $$;
rollback;