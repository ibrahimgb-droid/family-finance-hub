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
- Money is integer minor units (bigint); never floats. Why: exact KWD (3-decimal) maths.
- `src/domain/` is pure TypeScript with no React/router/backend imports. Why: reused by the future Expo client.
- Splits use `allocateLargestRemainder` (ties by input order) and must sum exactly to the total. Why: determinism.
- Group membership is created only by `accept_invitation()` or the owner trigger; no client INSERT policy on `group_members`. Why: prevents cross-group access.
- Confirmed expenses/allocations are immutable (DB triggers); settlements are append-only. Why: audit trail.
- Entitlements are server-written only. Why: premium can't be self-granted.
- Extracted receipts always create `draft` transactions; only `confirmed` rows count in summaries.
- Architecture details: docs/architecture.md. Task status: roadmap.md.
