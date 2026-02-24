import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import dotenv from 'dotenv';

// Load env vars
dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

async function updateStands() {
  try {
    // First, let's see what stands we have
    const allStands = await prisma.stand.findMany({
      where: { developmentId: 'dev-stlucia-demo' },
      select: { id: true, standNumber: true, status: true },
      orderBy: { standNumber: 'asc' }
    });
    
    console.log('Total stands found:', allStands.length);
    console.log('Current status distribution:');
    
    const statusCount = allStands.reduce((acc, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1;
      return acc;
    }, {});
    console.log(statusCount);

    // Find 3 non-available stands to update
    const standsToUpdate = allStands
      .filter(s => s.status !== 'AVAILABLE')
      .slice(0, 3);
    
    if (standsToUpdate.length === 0) {
      console.log('All stands are already AVAILABLE or no stands found');
      return;
    }

    console.log('Updating stands:', standsToUpdate.map(s => s.standNumber));

    // Update each stand individually
    for (const stand of standsToUpdate) {
      await prisma.stand.update({
        where: { id: stand.id },
        data: { status: 'AVAILABLE' }
      });
      console.log(`Updated stand ${stand.standNumber} to AVAILABLE`);
    }

    // Show updated status
    const updatedStands = await prisma.stand.findMany({
      where: { developmentId: 'dev-stlucia-demo' },
      select: { standNumber: true, status: true },
      orderBy: { standNumber: 'asc' },
      take: 15
    });
    
    console.log('\nUpdated stands (first 15):');
    console.log(updatedStands);

    const newStatusCount = updatedStands.reduce((acc, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1;
      return acc;
    }, {});
    console.log('\nNew status distribution (of first 15):', newStatusCount);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateStands();
