import { prisma } from '@/lib/prisma';

async function checkSylvainePayments() {
  try {
    console.log('Searching for client containing "Sylvaine" or "Tendere"');
    
    const clients = await prisma.client.findMany({
      where: {
        OR: [
          { name: { contains: 'Sylvaine', mode: 'insensitive' } },
          { name: { contains: 'Tendere', mode: 'insensitive' } }
        ]
      }
    });
    
    if (clients.length === 0) {
      console.log('Client not found');
      await prisma.$disconnect();
      return;
    }
    
    console.log(`Found ${clients.length} client(s)`);
    clients.forEach(client => {
      console.log(`- ${client.name} (ID: ${client.id})`);
    });
    
    console.log();
    
    let totalOfflineAmount = 0;
    let totalMainAmount = 0;
    
    for (const client of clients) {
      console.log(`=== Checking payments for: ${client.name} ===`);
      
      // Check offline payments via offlineSales
      const offlineSales = await prisma.offlineSale.findMany({
        where: { clientId: client.id }
      });
      
      const offlinePayments = await prisma.offlinePayment.findMany({
        where: { offlineSaleId: { in: offlineSales.map(sale => sale.id) } }
      });
      
      // Check main payment table
      const mainPayments = await prisma.payment.findMany({
        where: { clientId: client.id }
      });
      
      console.log(`\nOffline Sales: ${offlineSales.length}`);
      console.log(`Offline Payments: ${offlinePayments.length}`);
      
      const offlineAmount = offlinePayments.reduce((sum, p) => sum + Number(p.amount), 0);
      const mainAmount = mainPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      
      console.log(`Main Payment Table: ${mainPayments.length}`);
      
      totalOfflineAmount += offlineAmount;
      totalMainAmount += mainAmount;
      
      console.log(`\nAmounts:`);
      console.log(`- Offline payments: $${offlineAmount.toLocaleString()}`);
      console.log(`- Main payment table: $${mainAmount.toLocaleString()}`);
      
      if (offlineAmount !== mainAmount) {
        console.log(`⚠️  Discrepancy detected: $${(offlineAmount - mainAmount).toLocaleString()}`);
      }
      
      console.log('');
      
      // Show details of main payments
      if (mainPayments.length > 0) {
        console.log('Main payments details:');
        mainPayments.forEach(p => {
          console.log(`- ${new Date(p.createdAt).toLocaleDateString()}: $${Number(p.amount).toLocaleString()} (${p.method}) - ${p.reference}`);
        });
        console.log('');
      }
      
      // Show details of offline payments
      if (offlinePayments.length > 0) {
        console.log('Offline payments details:');
        offlinePayments.forEach(p => {
          console.log(`- ${new Date(p.paymentDate).toLocaleDateString()}: $${Number(p.amount).toLocaleString()} (${p.paymentMethod}) - ${p.reference}`);
        });
        console.log('');
      }
    }
    
    console.log('=== Summary ===');
    console.log(`Total offline payments: $${totalOfflineAmount.toLocaleString()}`);
    console.log(`Total main payments: $${totalMainAmount.toLocaleString()}`);
    const difference = totalOfflineAmount - totalMainAmount;
    console.log(`Difference: $${difference.toLocaleString()}`);
    
    if (difference === 0) {
      console.log('\n✅ All payments are in sync');
    } else {
      console.log('\n⚠️  Payments are not in sync!');
    }
    
  } catch (error) {
    console.error('Error checking payments:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSylvainePayments();
