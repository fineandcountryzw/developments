/**
 * Backfill GeneratedContractSigner rows for existing DocuSeal contracts.
 *
 * Goal:
 * - Ensure client/developer/lawyer/principal_agent signer rows exist for contracts that have a DocuSeal submission.
 * - Preserve existing signer rows if already present (upsert by contractId+role).
 *
 * Usage:
 *   npx tsx scripts/backfill-generated-contract-signers.ts
 */

import { config } from 'dotenv';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

config({ path: join(process.cwd(), '.env.local') });
config({ path: join(process.cwd(), '.env') });

let prisma: PrismaClient;

async function initializePrisma() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL environment variable is not set');

  const pool = new Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  prisma = new PrismaClient({ adapter, log: ['info', 'warn', 'error'] });
}

function normalizeOldStatus(status?: string | null): string {
  const s = (status || '').toLowerCase();
  if (!s) return 'pending';
  if (s === 'completed') return 'signed';
  return s;
}

async function upsertSigner(params: {
  contractId: string;
  role: string;
  name: string;
  email: string;
  status: string;
  docusealSignerId?: number | null;
  invitedAt?: Date | null;
  openedAt?: Date | null;
  signedAt?: Date | null;
  declinedAt?: Date | null;
}) {
  const { contractId, role, ...rest } = params;

  // Compound unique is @@unique([contractId, role]) in prisma/schema.prisma
  await prisma.generatedContractSigner.upsert({
    where: { contractId_role: { contractId, role } } as any,
    create: { contractId, role, ...rest } as any,
    update: { ...rest } as any,
  });
}

async function main() {
  await initializePrisma();

  const contracts = await prisma.generatedContract.findMany({
    where: { docusealSubmissionId: { not: null } },
    include: {
      client: true,
      stand: { include: { development: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Found ${contracts.length} GeneratedContract records with DocuSeal submissions.`);

  let updated = 0;
  let skipped = 0;

  for (const contract of contracts) {
    const dev = contract.stand?.development || null;
    const branchSettings = await prisma.companySettings.findFirst({ where: { branch: contract.branch } });

    const clientEmail = contract.client?.email || '';
    const clientName = contract.client?.name || contract.client?.firstName || 'Client';
    const developerEmail = contract.developerEmail || dev?.developerEmail || '';
    const developerName = contract.developerName || dev?.developerName || dev?.name || 'Developer';
    const lawyerEmail = (dev as any)?.lawyerEmail || '';
    const lawyerName = (dev as any)?.lawyerName || 'Lawyer';
    const principalAgentEmail = (branchSettings as any)?.principalAgentEmail || '';
    const principalAgentName = (branchSettings as any)?.principalAgentName || 'Principal Agent';

    if (!clientEmail || !developerEmail) {
      skipped++;
      console.warn(`[SKIP] Missing client/developer email for contract ${contract.id}`);
      continue;
    }

    const derivedDefaultStatus =
      contract.docusealStatus === 'SIGNED'
        ? 'signed'
        : contract.docusealStatus === 'EXPIRED'
          ? 'expired'
          : contract.docusealStatus === 'DECLINED'
            ? 'declined'
            : 'pending';

    await upsertSigner({
      contractId: contract.id,
      role: 'client',
      name: clientName,
      email: clientEmail,
      status: normalizeOldStatus(contract.docusealSignerClientStatus) || derivedDefaultStatus,
      docusealSignerId: contract.docusealSignerClientId,
      signedAt: contract.docusealStatus === 'SIGNED' ? contract.fullySignedAt || new Date() : null,
    });

    await upsertSigner({
      contractId: contract.id,
      role: 'developer',
      name: developerName,
      email: developerEmail,
      status: normalizeOldStatus(contract.docusealSignerDevStatus) || derivedDefaultStatus,
      docusealSignerId: contract.docusealSignerDevId,
      signedAt: contract.docusealStatus === 'SIGNED' ? contract.fullySignedAt || new Date() : null,
    });

    // Lawyer/principal agent did not exist in the earlier 2-signer workflow.
    // We backfill them with a best-effort email snapshot if available.
    if (lawyerEmail) {
      await upsertSigner({
        contractId: contract.id,
        role: 'lawyer',
        name: lawyerName,
        email: lawyerEmail,
        status: derivedDefaultStatus,
      });
    }

    if (principalAgentEmail) {
      await upsertSigner({
        contractId: contract.id,
        role: 'principal_agent',
        name: principalAgentName,
        email: principalAgentEmail,
        status: derivedDefaultStatus,
      });
    }

    updated++;
    if (updated % 25 === 0) {
      console.log(`Progress: ${updated}/${contracts.length} contracts processed...`);
    }
  }

  console.log(`Done. Processed=${contracts.length} Updated=${updated} Skipped=${skipped}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
