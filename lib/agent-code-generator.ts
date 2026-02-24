import prisma from '@/lib/prisma';

/**
 * Agent Code Generator
 * 
 * Generates unique 4-character alphanumeric codes for agents.
 * Uses collision detection to ensure uniqueness in the database.
 * 
 * Character set: A-Z, 0-9 (36 characters)
 * Possible combinations: 36^4 = 1,679,616 unique codes
 */

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CODE_LENGTH = 4;
const MAX_ATTEMPTS = 100;

/**
 * Generate a random 4-character alphanumeric code
 */
function generateRandomCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CHARSET.charAt(Math.floor(Math.random() * CHARSET.length));
  }
  return code;
}

/**
 * Check if a code already exists in the database
 */
async function codeExists(code: string): Promise<boolean> {
  const existing = await prisma.agent.findUnique({
    where: { code },
    select: { id: true }
  });
  return !!existing;
}

/**
 * Generate a unique 4-character code that doesn't exist in the database
 * Uses collision detection with retry logic
 */
export async function generateUniqueAgentCode(): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = generateRandomCode();
    
    const exists = await codeExists(code);
    if (!exists) {
      return code;
    }
  }
  
  // If we've exhausted all attempts, find the gap in existing codes
  // This is a fallback mechanism for extreme cases
  throw new Error('Failed to generate unique agent code after maximum attempts');
}

/**
 * Validate if a code is in the correct format (4 alphanumeric characters)
 */
export function isValidAgentCodeFormat(code: string): boolean {
  if (!code || code.length !== CODE_LENGTH) {
    return false;
  }
  const validPattern = new RegExp(`^[${CHARSET}]+$`);
  return validPattern.test(code);
}

/**
 * Reserve a specific code for an agent (used during import)
 * Returns false if the code is already taken
 */
export async function reserveAgentCode(code: string, agentId: string): Promise<boolean> {
  // Check if code is already taken
  const existing = await prisma.agent.findUnique({
    where: { code },
    select: { id: true }
  });
  
  if (existing) {
    return false;
  }
  
  // Update the agent with the reserved code
  await prisma.agent.update({
    where: { id: agentId },
    data: { code }
  });
  
  return true;
}

/**
 * Generate multiple unique codes for bulk operations
 */
export async function generateUniqueAgentCodes(count: number): Promise<string[]> {
  const codes: string[] = [];
  const existingCodes = new Set<string>();
  
  // Get existing codes to avoid duplicates in the same batch
  const agents = await prisma.agent.findMany({
    where: { code: { not: null } }
  });
  
  agents.forEach(agent => {
    if (agent.code) existingCodes.add(agent.code);
  });
  
  for (let i = 0; i < count; i++) {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const code = generateRandomCode();
      if (!existingCodes.has(code)) {
        codes.push(code);
        existingCodes.add(code);
        break;
      }
    }
  }
  
  if (codes.length !== count) {
    throw new Error('Failed to generate enough unique agent codes');
  }
  
  return codes;
}
