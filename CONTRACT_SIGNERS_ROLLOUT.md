# Contract Signers Rollout (4 Signatories, Parallel)

This rollout adds normalized signer tracking for `GeneratedContract` and enables DocuSeal parallel invitations for:

1. Client
2. Developer
3. Lawyer
4. Principal Agent (Fine & Country)

## 1) Apply Database Migration

Run the SQL migration in:

`prisma/migrations/20260204_add_contract_signers_and_principal_agent/migration.sql`

It:

1. Adds `principal_agent_name` and `principal_agent_email` to `company_settings`
2. Creates `generated_contract_signers`

## 2) Configure Principal Agent Email (Per Branch)

In the Admin UI:

1. Go to Settings
2. Select a branch (Harare / Bulawayo)
3. Fill in `Principal Agent (Fine & Country) email`
4. Optionally fill in `Principal Agent name`
5. Save

## 3) Ensure Developments Have Lawyer Email

For any development expected to generate/send contracts, ensure:

1. `lawyerEmail` is set (required for the 4-signatory send step)

## 4) Backfill Existing DocuSeal Contracts (Optional)

If there are already DocuSeal submissions created before this change (2-signatory era), run:

`scripts/backfill-generated-contract-signers.ts`

Recommended runner:

`npx tsx scripts/backfill-generated-contract-signers.ts`

Notes:

1. Client/Developer signer rows are backfilled from existing `GeneratedContract.docusealSigner*` fields.
2. Lawyer/Principal Agent signer rows are best-effort snapshots (development lawyer + current branch settings).

## 5) Verification Checklist

1. Open Admin Contracts list
2. Send a draft contract for e-signature
3. Confirm 4 signer dots appear (Client/Developer/Lawyer/Principal Agent)
4. Confirm webhook updates change dots/status as signers open/sign
