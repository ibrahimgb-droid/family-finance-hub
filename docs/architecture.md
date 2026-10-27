# Personal Finance App — A. Architecture & B. Structure

## A. Decisions
| # | Decision | Why |
|---|---|---|
| 1 | Web app first (mobile-first, installable), on this platform's stack; Expo client later | Native Expo can't be built here. The domain engine in `src/domain` is plain TS with no framework imports, so Expo can reuse it unchanged |
| 2 | Postgres + RLS on every user/group table; joining a group only through the `accept_invitation()` security-definer function | No client-side path can insert itself into a group |
| 3 | Money stored as `bigint` minor units; currency precision in `currencies.minor_digits` (KWD/BHD/OMR = 3) | No float drift; KWD-aware |
| 4 | Largest-remainder allocation, ties broken by input order | Deterministic and reproducible; sum always equals total |
| 5 | Family weights stored as integer milli-units (1000 = 1.0) | Keeps weighted maths integer-only |
| 6 | A confirmed expense locks its allocations (trigger); a DB trigger re-checks that the sum equals the total | Snapshots can't be changed and every split balances, even if the client is buggy |
| 7 | Settlements are append-only | Audit trail; corrections are reversing entries |
| 8 | Entitlements only writable by the server (no client write grant) | Premium can't be granted by the client |
| 9 | Receipts in a private bucket, path `<user_id>/...`, signed URLs only; `retain_until` for retention | Least privilege, deletion workflow |
| 10 | Invitation tokens stored as SHA-256 hashes, 7-day expiry, optional email binding | A leaked DB row can't be redeemed; the invite can be bound to the intended invitee |
| 11 | Extracted transactions always land as `status='draft'`; ledger summaries use `confirmed` only | User confirmation is required before posting |
| 12 | No card data columns exist; OCR text is scrubbed of PAN-like sequences before storage (module G) | PCI scope avoidance |

## Assumptions / NEEDS VERIFICATION
- Accuracy of on-device OCR on the web (e.g. a WASM engine) and on Expo — **verify** with real GCC receipts (Arabic + English).
- Cloud OCR fallback provider capabilities and pricing — **not chosen; verify before use**.
- Ad network (web vs mobile SDKs), policy and revenue — **verify**; placeholders only.
- App store / in-app purchase flow for premium on Expo — **verify** store rules; web uses a payment provider TBD.
- FX conversion between group currencies is out of MVP scope; each expense keeps its own currency.
- Rounding goes to the currency's minor unit (e.g. 0.001 KWD). Cash rounding (e.g. to 0.005) is not applied.

## B. Repository structure
```text
src/
  domain/          pure TS: money, split engine, balances (+ *.test.ts)
  routes/          screens (TanStack file routes)
  components/      UI
  integrations/    auto-generated backend client (do not edit)
  server/          server functions (AI extraction, invitations, entitlements)  [module E]
drizzle/migrations/ applied SQL migrations
supabase/tests/    RLS test script
docs/              architecture + module specs
```

## C. Database summary
Tables: currencies, profiles, entitlements, categories, receipts, transactions, groups, group_members,
family_units, family_members, invitations, group_expenses, expense_allocations, settlements.
Helpers: `is_group_member`, `is_group_admin` (security definer, avoids RLS recursion).
Guards: family_member↔group consistency, confirm-sum check, allocation immutability, owner auto-add.

### Acceptance criteria
- A user can't read or write another user's ledger, receipts or categories.
- A non-member gets 0 rows from any group table, and an insert into another group is rejected.
- No client can insert into `group_members` directly.
- An expense can't be confirmed unless its allocations equal the total; once confirmed it can't be edited.
- An expired, revoked, reused or wrong-email invitation is rejected.

### Error cases
Unsupported currency, too many decimals, zero total weight, percentages ≠ 100%, fixed ≠ total,
negative weight, cross-group family unit, editing a confirmed expense, an expired invitation.
