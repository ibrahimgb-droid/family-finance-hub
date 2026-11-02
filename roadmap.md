# Roadmap
- [x] Repair category loading and saving: added missing visibility column and refreshed schema types; signed-in add, rename, hide/show, reload persistence and manual/receipt selectors verified; six category calculation tests passed. Temporary test category removed.
- [ ] Apply neon dark redesign, finance bento dashboard, streak tracker, filter pills, loading skeletons and floating navigation; verify mobile and desktop.
- [x] Add item price-change Insights page: confirmed-receipt comparisons, search, direction/currency filters and receipt history; 14 tests passed and signed-in confirmation → insight → receipt history verified. Temporary test purchases removed.
- [x] Extract and categorize receipt line items; editable draft review, exact amounts, signed-in scan → category edit → confirm → read-back verified with a labeled test receipt.
- [x] A. Architecture & assumptions (docs/architecture.md)
- [x] B. Repository structure
- [x] C. Migrations, constraints, indexes, RLS + test script
- [x] D. Domain models & calculation engine + unit tests
- [x] E. Backend client & server functions (auth, invitations, extraction)
- [x] F. Navigation & screens (sign-in, ledger, review draft, groups)
- [x] G. Receipt capture / OCR adapter / extraction schema
- [ ] H. Group, family, invitation, split, settlement UI: screens and calculation tests added; blocked on Cloud readiness for atomic expense RPC, same-group guards, and authenticated end-to-end verification. Saving fails closed until applied.
- [ ] I. Analytics events, ad slots, premium checks
- [ ] J. CI/CD, environments, test plan, release checklist

## Improvement phases (ordered; each phase ships with tests and a passing build)

### Phase 1 - Categories foundation
- [ ] Default category set per user, created on sign-up; users can add, rename and hide categories on a Categories screen.
- [ ] Expenses (manual and receipt) carry a category via the existing category field; the category is never a free-text value.
- [ ] Derive a suggested expense category from the largest item category on a receipt; user can override on review.
- [ ] Merchant memory: remember the category a user chose for a merchant and suggest it next time (new user-owned table, RLS with four per-verb policies, explicit grants).
- [ ] Pure domain helper for suggestion logic in src/domain with unit tests (ties, no items, unknown merchant).
- [ ] Ledger: filter by category; monthly category breakdown card using confirmed rows only.

### Phase 2 - Manual entry
- [ ] Manual expense form: category chips, note field, default currency from the profile instead of hard-coded KWD.
- [ ] Recent merchants as one-tap chips.
- [ ] Pure duplicate check (same merchant, date and total) that warns before saving; user can still save.
- [ ] Manual entry moves to its own sheet or screen, opened from the ledger.

### Phase 3 - Receipt scanning
- [ ] On-device crop, straighten and compression before upload; keep the 10 MB limit.
- [ ] Extraction returns a confidence level per field (total, date, merchant, currency); low-confidence fields are highlighted on review.
- [ ] Review screen shows the original photo beside the editable fields.
- [ ] Duplicate warning on scan, using the same check as Phase 2.
- [ ] Failed extraction keeps a draft with the photo so the user can enter it by hand.
- [ ] Batch scan queue: several receipts scanned in one session, reviewed one at a time.

### Phase 4 - AI item categorization
- [ ] Send the user's own category list to the extraction model; map results back to user categories, with fallback to Other.
- [ ] Per-item confidence; low-confidence items are flagged.
- [ ] "Apply to similar items" action on review.
- [ ] Item memory: remember corrected categories per normalized item name for the user; applied as a suggestion on future receipts.
- [ ] Pure tests for normalization, mapping and memory precedence.

### Phase 5 - Ledger screen structure
- [ ] Split the ledger into Overview, Activity and Add/Scan views with one purpose each.
- [ ] Activity: search, date, status and category filters; paging with keyset ordering on date and id instead of a fixed 100-row limit.
- [ ] Extract a shared transaction row component used by activity, insights and review.
- [ ] Progressive disclosure: secondary actions open in sheets.

### Phase 6 - Group screen structure
- [ ] Split the group page into one component per tab and one per form, with no behaviour change.
- [ ] Blocked: shared expense saving still depends on the atomic expense function and same-group guards described in docs/module-h.md. Do not change saving behaviour in this phase.

### Phase 7 - Code quality
- [ ] Replace the `as unknown as number` money casts with typed helpers that keep amounts as strings until the database boundary.
- [ ] Break up the longest route and component files by purpose; keep one responsibility per file.
- [ ] Remove unused UI components and dead code, checking references first.

### Phase 8 - Account and onboarding
- [ ] Password reset and email confirmation messages on sign-in.
- [ ] Profile settings: display name, default currency, language.
- [ ] Replace the demo home page with a real landing page that links to sign-in.
- [ ] Insights: category price trend, reusing the pure insight helpers.

### Dependencies
- Phase 1 comes before Phases 2, 4 and 5 (they use categories).
- Phase 3 can run in parallel with Phase 2 once the duplicate check exists.
- Phase 6 is independent but waits on the module H backend work.
- Phase 7 runs after Phases 1 to 5 so refactors touch stable code.
