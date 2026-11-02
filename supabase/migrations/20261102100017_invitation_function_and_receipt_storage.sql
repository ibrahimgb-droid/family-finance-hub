/*
# Invitation acceptance function and private receipt storage

1. Plain-English summary
- Adds the function that lets a signed-in user join a group with an invitation link. It checks the invitation is valid, not expired, not used, and for the right email.
- Creates the private "receipts" storage bucket and lets each user read, upload and delete only files in their own folder.

2. Changes
- Function accept_invitation(token) (security definer): joins the group, binds the invitee to a family member, marks the invitation accepted.
- Storage bucket "receipts": private, no public access.
- Storage policies on storage.objects: owner-only read, insert and delete, keyed on the user id folder prefix.

3. Security
- The function is callable only by signed-in users; anonymous access is revoked.
- Files are stored under the owner's user id folder, so other users cannot read them.
*/

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

insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false) on conflict (id) do nothing;

drop policy if exists "own receipt files read" on storage.objects;
create policy "own receipt files read" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "own receipt files write" on storage.objects;
create policy "own receipt files write" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "own receipt files delete" on storage.objects;
create policy "own receipt files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
