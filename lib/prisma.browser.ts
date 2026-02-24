/**
 * Browser-safe stub for lib/prisma
 * 
 * This file is used when lib/prisma is imported in client-side code.
 * It prevents @prisma/client from being bundled in the browser.
 */

console.warn('[PRISMA] Browser stub loaded. Use API routes for database access.');

export const prisma = null;
export default prisma;
