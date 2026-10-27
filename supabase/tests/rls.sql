-- RLS test script. Run inside a transaction against a non-production backend; rolls back.
-- Simulates two users (A, B) by setting the JWT claims Postgres policies read.
begin;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
set local role authenticated;

-- A creates a group (owner auto-added)
insert into public.groups(name, base_currency, created_by)
values ('A family', 'KWD', '00000000-0000-0000-0000-00000000000a');

-- EXPECT FAIL: A cannot insert itself as a member of anything directly
do $$ begin
  begin
    insert into public.group_members(group_id, user_id) select id, auth.uid() from public.groups limit 1;
    raise exception 'TEST FAILED: direct group_members insert allowed';
  exception when insufficient_privilege then null; end;
end $$;

-- Switch to B
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);

-- EXPECT 0 rows: B cannot see A's group
do $$ begin
  if (select count(*) from public.groups) <> 0 then raise exception 'TEST FAILED: cross-group read'; end if;
end $$;

-- EXPECT FAIL: B cannot add a family unit to A's group
do $$ begin
  begin
    insert into public.family_units(group_id, name)
      select id, 'x' from public.groups;  -- sees none
    if found then raise exception 'TEST FAILED'; end if;
  exception when insufficient_privilege or check_violation then null; end;
end $$;

-- EXPECT FAIL: B cannot write A's ledger
do $$ begin
  begin
    insert into public.transactions(user_id, occurred_on, currency, total_minor)
      values ('00000000-0000-0000-0000-00000000000a', current_date, 'KWD', 1000);
    raise exception 'TEST FAILED: cross-user tx insert';
  exception when insufficient_privilege then null; end;
end $$;

-- EXPECT FAIL: B cannot grant itself premium
do $$ begin
  begin
    update public.entitlements set tier = 'premium';
    if found then raise exception 'TEST FAILED: entitlement write'; end if;
  exception when insufficient_privilege then null; end;
end $$;

-- EXPECT FAIL: invalid invitation token
do $$ begin
  begin
    perform public.accept_invitation('not-a-real-token');
    raise exception 'TEST FAILED: bogus invite accepted';
  exception when raise_exception then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
  end;
end $$;

rollback;
