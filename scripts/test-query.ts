import { prisma } from '../lib/prisma';

async function main() {
  try {
    // Find a development with stands
    const developmentWithStands = await prisma.$queryRaw`
      SELECT d.id, d.name, COUNT(s.id) as stand_count
      FROM developments d
      LEFT JOIN stands s ON d.id = s.development_id
      GROUP BY d.id, d.name
      HAVING COUNT(s.id) > 0
      LIMIT 1
    `;

    if (developmentWithStands.length > 0) {
      const [development] = developmentWithStands;
      console.log('Development with stands:', development);

      // Get all stands for this development
      const stands = await prisma.stand.findMany({
        where: { developmentId: development.id },
      });

      console.log('Stands in development:', stands);
    } else {
      console.log('No developments with stands found');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
