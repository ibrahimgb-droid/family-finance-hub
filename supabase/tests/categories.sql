-- Regression: categories can be created, hidden and read only by their owner.
-- Run transactionally; all test data is rolled back.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
insert into public.categories (id, user_id, name)
values ('00000000-0000-0000-0000-00000000ca01', '00000000-0000-0000-0000-00000000000a', 'Category regression');
do $$ begin
  if not exists (select 1 from public.categories where id = '00000000-0000-0000-0000-00000000ca01' and is_hidden = false) then
    raise exception 'New category must be visible and readable';
  end if;
end $$;
update public.categories set is_hidden = true where id = '00000000-0000-0000-0000-00000000ca01';
do $$ begin
  if not exists (select 1 from public.categories where id = '00000000-0000-0000-0000-00000000ca01' and is_hidden = true) then
    raise exception 'Owner must still read hidden categories';
  end if;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
do $$ begin
  if exists (select 1 from public.categories where id = '00000000-0000-0000-0000-00000000ca01') then
    raise exception 'Categories must not be readable by another user';
  end if;
end $$;
rollback;