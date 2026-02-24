import { Development } from '../types';

export async function generateDevelopmentOverview(dev: Partial<Development>): Promise<string> {
  // Compose AI prompt
  const region = dev.branch || 'Harare';
  const amenities = (dev.infrastructureJson && Object.entries(dev.infrastructureJson)
    .map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`)
    .join('; ')) || 'modern amenities';
  const standSizes = dev.statistics?.find(s => s.toLowerCase().includes('stand')) || '';
  const prompt = `Act as a luxury real estate marketer for Fine & Country. Write a persuasive, 150-word overview for a new development in ${region} with ${amenities}. Use a sophisticated, professional tone.`;

  // Simulate AI call (replace with real API call in production)
  return `Welcome to an exclusive new address in ${region}. This development offers ${amenities} and ${standSizes}. Experience refined living with Fine & Country's signature attention to detail, security, and lifestyle. Secure your investment today.`;
}
