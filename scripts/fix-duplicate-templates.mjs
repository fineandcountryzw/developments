import prisma from '@/lib/prisma';

async function fixDuplicateTemplates() {
  console.log('Checking for duplicate active templates...');
  
  try {
    // Get all active templates grouped by development and branch
    const activeTemplates = await prisma.$queryRaw`
      SELECT 
        development_id, 
        branch, 
        ARRAY_AGG(id) as template_ids,
        COUNT(*) as count
      FROM 
        contract_templates 
      WHERE 
        is_active = true AND status = 'ACTIVE' AND development_id IS NOT NULL
      GROUP BY 
        development_id, branch
      HAVING 
        COUNT(*) > 1
    `;
    
    console.log(`Found ${activeTemplates.length} developments with duplicate active templates`);
    
    for (const group of activeTemplates) {
      console.log(`\nDevelopment ${group.development_id} (${group.branch}): ${group.count} active templates`);
      
      // Keep only the latest template, deactivate the rest
      const templates = await prisma.contractTemplate.findMany({
        where: {
          id: { in: group.template_ids },
          developmentId: group.development_id,
          branch: group.branch
        },
        orderBy: { createdAt: 'desc' }
      });
      
      // Keep the first (latest) template active, deactivate others
      const templatesToDeactivate = templates.slice(1);
      
      console.log(`Deactivating ${templatesToDeactivate.length} templates...`);
      
      for (const template of templatesToDeactivate) {
        await prisma.contractTemplate.update({
          where: { id: template.id },
          data: { 
            isActive: false,
            status: 'ARCHIVED'
          }
        });
        
        console.log(`Deactivated template: ${template.id} - ${template.name}`);
      }
    }
    
    console.log('\n✅ Duplicate templates fixed!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixDuplicateTemplates();
