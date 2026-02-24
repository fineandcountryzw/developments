import fs from 'fs';
import { parseDocxTemplate } from './lib/contract-template-parser';

// Create a simple DOCX file using the contract-template-parser
async function testDocxParsing() {
  try {
    // Create a test DOCX file (simplified version)
    const testDocxContent = `
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p>
            <w:r>
              <w:t>Test document with {{client.fullName}} and {{stand.price}}</w:t>
            </w:r>
          </w:p>
        </w:body>
      </w:document>
    `;

    // Create a temporary DOCX file for testing
    const tempDocxPath = 'temp-test.docx';
    
    // Since we can't create a full DOCX file from scratch, let's use the existing parseDocxTemplate function
    // with a minimal valid DOCX buffer
    const minimalDocxBuffer = Buffer.from(testDocxContent);
    
    // Test parsing the minimal DOCX buffer
    const parsed = await parseDocxTemplate(minimalDocxBuffer);
    
    console.log('DOCX parsing successful!');
    console.log('HTML Content:', parsed.htmlContent);
    console.log('Merge Tags:', parsed.mergeTags);
    console.log('Metadata:', parsed.metadata);
    
    return parsed;
  } catch (error) {
    console.error('DOCX parsing failed:', error);
  }
}

// Run the test
testDocxParsing();
