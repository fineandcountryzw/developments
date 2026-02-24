require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');
const { PrismaNeon } = require('@prisma/adapter-neon');

const connectionString = process.env.DATABASE_URL;
const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const invitationId = 'cmknw9yaq0000yobnedmc4tb3'; // test invitation
  
  console.log('Testing deletion of invitation:', invitationId);
  
  // First verify it exists
  const invitation = await prisma.invitation.findUnique({
    where: { id: invitationId }
  });
  
  if (!invitation) {
    console.log('Invitation not found!');
    return;
  }
  
  console.log('Found invitation:', invitation.email, invitation.status);
  
  // Get admin user for audit
  const adminUser = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    select: { id: true }
  });
  
  // Create audit trail
  await prisma.auditTrail.create({
    data: {
      action: 'INVITATION_DELETED',
      resourceType: 'INVITATION',
      resourceId: invitationId,
      userId: adminUser.id,
      details: {
        email: invitation.email,
        role: invitation.role,
        branch: invitation.branch,
        status: invitation.status,
        deletedAt: new Date().toISOString(),
      },
      branch: invitation.branch,
    },
  });
  
  console.log('Audit trail created');
  
  // Delete the invitation
  await prisma.invitation.delete({
    where: { id: invitationId }
  });
  
  console.log('Invitation deleted successfully!');
  
  // Verify it's gone
  const check = await prisma.invitation.findUnique({
    where: { id: invitationId }
  });
  
  console.log('Verification - invitation exists:', !!check);
}

main().catch(console.error).finally(() => prisma.$disconnect());
