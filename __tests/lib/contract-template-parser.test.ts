import { describe, it, expect } from '@jest/globals';
import { parseDocxTemplate, parseDocxTemplateFromStream } from '@/lib/contract-template-parser';
import { Readable } from 'stream';

describe('Contract Template Parser', () => {
  describe('parseDocxTemplate', () => {
    it('should parse a simple DOCX template', async () => {
      // Create a minimal valid DOCX buffer for testing
      const minimalDocxBuffer = Buffer.from(`
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
          <w:body>
            <w:p>
              <w:r>
                <w:t>Test document with {{client.fullName}} and {{stand.price}}</w:t>
              </w:r>
            </w:p>
          </w:body>
        </w:document>
      `);

      const parsed = await parseDocxTemplate(minimalDocxBuffer);

      expect(parsed.htmlContent).toBeDefined();
      expect(parsed.textContent).toBeDefined();
      expect(parsed.mergeTags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            fullTag: '{{client.fullName}}',
            namespace: 'client',
            field: 'fullName'
          }),
          expect.objectContaining({
            fullTag: '{{stand.price}}',
            namespace: 'stand',
            field: 'price'
          })
        ])
      );
    });

    it('should validate file size', async () => {
      // Create a buffer larger than the default max size (20MB)
      const largeBuffer = Buffer.alloc(21 * 1024 * 1024);

      await expect(parseDocxTemplate(largeBuffer)).rejects.toThrow(
        'File size exceeds maximum'
      );
    });

    it('should handle invalid DOCX', async () => {
      const invalidBuffer = Buffer.from('invalid docx content');

      await expect(parseDocxTemplate(invalidBuffer)).rejects.toThrow(
        'Failed to parse DOCX'
      );
    });
  });

  describe('parseDocxTemplateFromStream', () => {
    it('should parse a DOCX template from a stream', async () => {
      // Create a minimal valid DOCX buffer for testing
      const minimalDocxBuffer = Buffer.from(`
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
          <w:body>
            <w:p>
              <w:r>
                <w:t>Test document with {{client.fullName}} and {{stand.price}}</w:t>
              </w:r>
            </w:p>
          </w:body>
        </w:document>
      `);

      // Create a readable stream from the buffer
      const stream = new Readable();
      stream.push(minimalDocxBuffer);
      stream.push(null); // End of stream

      const parsed = await parseDocxTemplateFromStream(stream);

      expect(parsed.htmlContent).toBeDefined();
      expect(parsed.textContent).toBeDefined();
      expect(parsed.mergeTags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            fullTag: '{{client.fullName}}',
            namespace: 'client',
            field: 'fullName'
          }),
          expect.objectContaining({
            fullTag: '{{stand.price}}',
            namespace: 'stand',
            field: 'price'
          })
        ])
      );
    });
  });
});
