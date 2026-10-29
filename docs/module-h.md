# H. Groups and shared expenses

## Delivered
- Group list/create, family units, guest participants and full/half/zero weights.
- Inclusion controls; equal, family count, weighted family, fixed, percentage, shares and consumption-unit previews.
- Invitation creation, copy, acceptance, revocation and return to invitation after sign-in.
- Per-currency balances and append-only payment entry/history.

## Blocked before release
Lovable Cloud reported that it was starting; both session minting and migration application failed. No schema changes were applied. Shared expense saving deliberately fails closed.

Apply an authenticated SECURITY INVOKER `save_group_expense(jsonb,jsonb)` RPC that inserts a draft, inserts all allocation snapshots and confirms the expense in one transaction. Use server-derived creator identity and bigint decimal strings. Add same-group reference triggers for expense payer, allocation expense/member/family, settlement endpoints and invitation guest. Freeze expense/allocation ownership and all confirmed fields; enforce append-only settlements with a trigger. Do not allow a sequential client-write fallback.

## Acceptance criteria and checks
- Create a group and see the owner membership created by the existing trigger.
- Admin creates families/guests; regular members cannot edit families.
- Split 10.000 KWD three ways into 3.334, 3.333 and 3.333; allocations sum exactly.
- Include/exclude participants; family weights retain integer arithmetic.
- Reject wrong percentage/fixed totals, zero weight, zero expense and invalid participants.
- Invite a second real account; verify expiry, email binding, reuse and revocation.
- Confirm an expense, reload it and see the exact immutable allocations.
- Record a partial payment and verify balances change only in its currency.
- Reject cross-group references and all nonmember reads/writes.
- Confirmed expenses/allocations cannot be changed; settlements cannot be updated/deleted.

## Tests
`src/domain/group-split.test.ts`: seven concrete rounding/input tests, all passed alongside the existing seventeen split tests.

Authenticated UI flows and new database guards remain unverified until Cloud is ready. Invitation links and public invitation rendering can be checked without exposing private group data.