// Simple test script to verify CSV template generation and toggle functionality

import fs from 'fs';
import path from 'path';

// Test 1: Check if CSV template generation function exists and works
console.log('=== Test 1: CSV Template Generation ===');
const csvTemplatePath = path.join(process.cwd(), 'components/DevelopmentWizardV2.tsx');
if (fs.existsSync(csvTemplatePath)) {
  const content = fs.readFileSync(csvTemplatePath, 'utf8');
  
  // Check if CSV template generation function exists
  if (content.includes('downloadCSVTemplate')) {
    console.log('✓ CSV template generation function found');
    
    // Check if all required fields are present
    const requiredFields = [
      'stand_number',
      'size',
      'price'
    ];
    
    let allFieldsFound = true;
    requiredFields.forEach(field => {
      if (!content.includes(field)) {
        console.error(`✗ Field '${field}' not found in template generation`);
        allFieldsFound = false;
      }
    });
    
    if (allFieldsFound) {
      console.log('✓ All required fields included in CSV template');
    }
  } else {
    console.error('✗ CSV template generation function not found');
  }
  
  // Check if UI button exists for downloading template
  if (content.includes('Download Template')) {
    console.log('✓ CSV template download button found in UI');
  } else {
    console.error('✗ CSV template download button not found');
  }
} else {
  console.error('✗ DevelopmentWizardV2.tsx not found');
}

// Test 2: Check if toggle functionality exists
console.log('\n=== Test 2: Map/Table View Toggle ===');
const developmentDetailViewPath = path.join(process.cwd(), 'components/DevelopmentDetailView.tsx');
if (fs.existsSync(developmentDetailViewPath)) {
  const content = fs.readFileSync(developmentDetailViewPath, 'utf8');
  
  // Check if map view check exists
  if (content.includes('disable_map_view')) {
    console.log('✓ Map view disable check found');
    
    // Check if table view is rendered as alternative
    if (content.includes('grid')) {
      console.log('✓ Table view component found');
    } else {
      console.error('✗ Table view component not found');
    }
  } else {
    console.error('✗ Map view disable toggle not found');
  }
} else {
  console.error('✗ DevelopmentDetailView.tsx not found');
}

// Test 3: Check if schema migration exists
console.log('\n=== Test 3: Database Migration ===');
const migrationPath = path.join(process.cwd(), 'add-disable-map-view-column.sql');
if (fs.existsSync(migrationPath)) {
  const content = fs.readFileSync(migrationPath, 'utf8');
  
  if (content.includes('ALTER TABLE developments ADD COLUMN IF NOT EXISTS disable_map_view')) {
    console.log('✓ Migration script for disableMapView column found');
  } else {
    console.error('✗ Migration script does not contain required column');
  }
} else {
  console.error('✗ Migration script not found');
}

// Test 4: Check if validation schema includes the new field
console.log('\n=== Test 4: Validation Schema ===');
const validationSchemaPath = path.join(process.cwd(), 'lib/validation/schemas.ts');
if (fs.existsSync(validationSchemaPath)) {
  const content = fs.readFileSync(validationSchemaPath, 'utf8');
  
  if (content.includes('disableMapView')) {
    console.log('✓ Validation schema includes disableMapView field');
  } else {
    console.error('✗ Validation schema does not include disableMapView field');
  }
} else {
  console.error('✗ Validation schemas file not found');
}

// Test 5: Check if API endpoint includes the field
console.log('\n=== Test 5: API Endpoint ===');
const apiRoutePath = path.join(process.cwd(), 'app/api/admin/developments/route.ts');
if (fs.existsSync(apiRoutePath)) {
  const content = fs.readFileSync(apiRoutePath, 'utf8');
  
  if (content.includes('disable_map_view')) {
    console.log('✓ API endpoint includes disable_map_view field');
  } else {
    console.error('✗ API endpoint does not include disable_map_view field');
  }
} else {
  console.error('✗ API route file not found');
}

console.log('\n=== Test Completed ===');
