# Family Finance Hub

You are a senior mobile architect, PostgreSQL/Supabase engineer, security engineer, UX designer and test engineer. Build a production-oriented MVP named “Personal Finance App” for GCC consumers and families. STACK - React Native with Expo and TypeScript - Supabase Auth, PostgreSQL, Storage and Edge Functions - Local-first OCR with an adapter for cloud fallback - Server-side AI extraction using strict versioned JSON Schemas - Integer minor-unit money calculations with currency precision support CORE CAPABILITIES 1. Registration, login, password reset and profile preferences. 2. Manual transaction entry and receipt capture. 3. On-device crop, perspective correction and compression. 4. OCR and structured extraction for merchant, date, total, tax, currency, category and document reference. 5. Draft review: every extracted transaction requires user confirmation before ledger posting. 6. Personal ledger, categories, search, filtering and monthly summaries. 7. Groups, family units, non-user family members, invitations and guest-to-user conversion. 8. Split methods: equal, fixed amount, percentage, shares, family member count, weighted family and custom consumption units. 9. Deterministic KWD-aware rounding using integer minor units and largest-remainder distribution. 10. Balances, manual settlements, partial-settlement status and immutable confirmed split snapshots. 11. Free tier with restrained ads; premium tier removes ads and increases limits. FAMILY RULES - A group contains one or more family_units. - A family_unit contains zero or more family_members. - Each family_member has a configurable non-negative weight. - Member-count split = total x family included count / total included count. - Weighted-family split = total x family effective weight / total effective weight. - Historical allocations store count and weight snapshots. - Allocation totals must exactly equal the transaction total after currency-aware rounding. SECURITY - Generate and test Row-Level Security policies for every user- and group-owned table. - Keep all provider keys server-side. - Use signed storage access, least privilege, retention controls and deletion workflows. - Do not store full payment-card data. - Validate invitation authorization and prevent cross-group access. DELIVERABLE ORDER A. Architecture decisions and assumptions. B. Repository and folder structure. C. PostgreSQL migrations, constraints, indexes and RLS tests. D. TypeScript domain models and calculation engine with unit tests. E. Supabase client and edge functions. F. Mobile navigation and screen specifications. G. Receipt/OCR adapter and extraction schema. H. Group, family, invitation, split and settlement modules. I. Analytics events, ad placements and premium entitlement checks. J. CI/CD, environment configuration, test plan and release checklist. Do not generate the entire application in one response. Start with architecture and database migrations, then proceed module by module. For every module, provide acceptance criteria, tests, error cases and security checks. Never invent provider capabilities or pricing; mark items requiring verification.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/bb098c06-2b15-5c53-8e4b-3bc732754db8).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
