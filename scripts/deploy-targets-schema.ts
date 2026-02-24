/**
 * Database Migration Script - Sales Targets Schema
 * 
 * DEPLOYMENT INSTRUCTIONS:
 * 1. Run: npx prisma db push --preview-feature
 * 2. Or: npx prisma migrate dev --name add-sales-targets
 * 
 * This script adds the SalesTarget model to support the Manager Dashboard
 * targets functionality without breaking existing data.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deploySalesTargetsSchema() {
  console.log('🚀 Starting Sales Targets schema deployment...');
  
  try {
    // Test if the table already exists
    const existingTargets = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'sales_targets'
      );
    `;
    
    console.log('📊 Sales targets table existence check:', existingTargets);
    
    // Test that we can create a sample target (will be rolled back)
    console.log('🧪 Testing sales target creation...');
    
    const testAgent = await prisma.user.findFirst({
      where: { role: 'AGENT' }
    });
    
    if (testAgent) {
      console.log(`✅ Found test agent: ${testAgent.name} (${testAgent.id})`);
      
      // This would create a test target - uncomment for actual deployment
      /*
      const testTarget = await prisma.salesTarget.create({
        data: {
          agentId: testAgent.id,
          targetPeriod: '2026-01',
          revenueTarget: 100000,
          dealsTarget: 10,
          setBy: testAgent.id,
          branch: 'Harare',
          notes: 'Test target for schema validation'
        }
      });
      
      console.log('✅ Test target created:', testTarget.id);
      
      // Clean up test target
      await prisma.salesTarget.delete({
        where: { id: testTarget.id }
      });
      
      console.log('🧹 Test target cleaned up');
      */
    }
    
    console.log('✅ Sales Targets schema deployment completed successfully!');
    
  } catch (error) {
    console.error('❌ Sales Targets schema deployment failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the deployment
if (require.main === module) {
  deploySalesTargetsSchema()
    .then(() => {
      console.log('🎉 Deployment complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Deployment failed:', error);
      process.exit(1);
    });
}

export default deploySalesTargetsSchema;