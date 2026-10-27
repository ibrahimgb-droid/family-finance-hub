create or replace function public.accept_invitation(_token text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare inv public.invitations; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select * into inv from public.invitations
    where token_hash = encode(extensions.digest(_token,'sha256'),'hex') for update;
  if not found or inv.status <> 'pending' then raise exception 'invalid invitation'; end if;
  if inv.expires_at < now() then
    update public.invitations set status='expired' where id = inv.id;
    raise exception 'invitation expired';
  end if;
  if inv.email is not null and lower(inv.email) <> lower((select email from auth.users where id = uid)) then
    raise exception 'invitation is for a different email';
  end if;
  insert into public.group_members(group_id, user_id, role) values (inv.group_id, uid, 'member') on conflict do nothing;
  if inv.family_member_id is not null then
    update public.family_members set user_id = uid
      where id = inv.family_member_id and group_id = inv.group_id and user_id is null;
  end if;
  update public.invitations set status='accepted', accepted_by=uid where id = inv.id;
  return inv.group_id;
end $$;
revoke all on function public.accept_invitation(text) from public, anon;
grant execute on function public.accept_invitation(text) to authenticated;

-- Private receipts bucket policies (bucket created via storage tool)
create policy "own receipt files read" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own receipt files write" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own receipt files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);