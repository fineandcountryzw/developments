import prisma from './lib/prisma.js';

(async () => {
  try {
    const allStands = await prisma.stand.findMany({
      select: {
        id: true,
        standNumber: true,
        branch: true,
        developmentId: true,
        status: true
      }
    });

    console.log('\n=== STANDS DATABASE AUDIT ===\n');
    console.log('Total stands in database:', allStands.length);

    if (allStands.length > 0) {
      console.log('\nSample stand:', JSON.stringify(allStands[0], null, 2));
      
      const byBranch = allStands.reduce((acc, s) => {
        const key = s.branch || 'NULL';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      
      console.log('\nStands by branch:', byBranch);
    } else {
      console.log('\n⚠️  No stands found in database.');
      console.log('This is why the Inventory module is empty.');
    }

    await prisma.$disconnect();
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
