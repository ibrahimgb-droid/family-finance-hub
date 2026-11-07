<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules
- Default expense categories are initialized by a profile-insert database trigger, never on page load; backfills skip existing names without changing visibility. Why: reliable signup defaults without duplicating or overwriting user categories.
- Shared visual theming lives in CSS semantic tokens; the root shell supplies the finance navigation dock and dashboard widgets derive only from existing user data. Why: consistent styling without changing ledger or authorization behavior.
- Money is integer minor units (bigint); never floats. Why: exact KWD (3-decimal) maths.
- `src/domain/` is pure TypeScript with no React/router/backend imports. Why: reused by the future Expo client.
- Splits use `allocateLargestRemainder` (ties by input order) and must sum exactly to the total. Why: determinism.
- Group membership is created only by `accept_invitation()` or the owner trigger; no client INSERT policy on `group_members`. Why: prevents cross-group access.
- Confirmed expenses/allocations are immutable (DB triggers); settlements are append-only. Why: audit trail.
- Entitlements are server-written only. Why: premium can't be self-granted.
- Extracted receipts always create `draft` transactions; only `confirmed` rows count in summaries.
- Architecture details: docs/architecture.md. Task status: roadmap.md.
- Receipt line items are an atomic JSON snapshot on the parent transaction, with money stored as integer strings; items never post separately. Why: editable drafts without double-counting or partial item writes.
- Price insights use a pure integer-money adapter and exact normalized item descriptions within one currency, comparing distinct confirmed receipts. Why: avoid fuzzy product matches, currency mixing, or quantity-driven false changes.
- Shared expense previews and server validation use the pure group split adapter; saving must remain fail-closed until an atomic user-scoped expense RPC and same-group reference guards are applied. Why: consistent rounding without partially posted or cross-group expenses.
- Account transfers live in their own `account_transfers` table with an amount per side, never in `transactions`; debt kinds (credit_card, loan_borrowed) store the opening balance as the positive amount owed and show negative balances; balances are computed (`accountBalance` / `account_balances` view), never stored. Why: spending summaries and insights must never count transfers, and cross-currency moves need no stored exchange rate.
