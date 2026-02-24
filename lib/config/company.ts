/**
 * Company Configuration
 * Single source of truth for company contact details
 * Used by Footer, Client Dashboard, and other components
 */

export interface CompanyContact {
  label: string;
  address: string;
  phone: string;
  email: string;
  whatsapp?: string; // Optional WhatsApp number (may differ from phone)
}

export interface CompanyConfig {
  name: string;
  tagline: string;
  trustStatement: string;
  supportEmail?: string; // Primary support email for developments
  contacts: CompanyContact[];
  defaultContact: CompanyContact; // Primary contact for fallback
}

/**
 * Company configuration
 * This is the single source of truth for company contact information
 */
export const COMPANY_CONFIG: CompanyConfig = {
  name: 'Fine & Country Zimbabwe',
  tagline: 'Secure land investments with transparent pricing and verified developments.',
  trustStatement: 'Operated under the cyber and data protection act [chapter 12:07]',
  supportEmail: 'developments.zw@fineandcountry.com', // Primary support email for developments
  contacts: [
    {
      label: 'Harare HQ',
      address: '15 Nigels Lane, Ballantyne Park Borrowdale Harare',
      phone: '08644 253731',
      email: 'zimbabwe@fineandcountry.com',
      whatsapp: '2638644253731', // WhatsApp format: country code + number (no spaces, no +)
    },
    {
      label: 'Bulawayo Branch',
      address: '6 Kingsley Crescent, Malindela, Bulawayo',
      phone: '08644 253731',
      email: 'zimbabwe@fineandcountry.com',
      whatsapp: '2638644253731', // Same WhatsApp for both branches
    },
  ],
  defaultContact: {
    label: 'Support',
    address: '15 Nigels Lane, Ballantyne Park Borrowdale Harare',
    phone: '08644 253731',
    email: 'developments.zw@fineandcountry.com',
    whatsapp: '2638644253731',
  },
};

/**
 * Get primary company contact (for fallback scenarios)
 */
export function getPrimaryContact(): CompanyContact {
  return COMPANY_CONFIG.defaultContact;
}

/**
 * Format phone number for WhatsApp link
 * Removes all non-numeric characters and ensures proper format
 */
export function formatPhoneForWhatsApp(phone: string): string {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');
  
  // If starts with country code (263), return as is
  if (cleaned.startsWith('263')) {
    return cleaned;
  }
  
  // If starts with 0, replace with 263 (Zimbabwe country code)
  if (cleaned.startsWith('0')) {
    return '263' + cleaned.substring(1);
  }
  
  // Otherwise, assume it's already formatted or add 263
  return cleaned.length > 9 ? cleaned : '263' + cleaned;
}

/**
 * Generate WhatsApp link with prefilled message
 */
export function generateWhatsAppLink(
  phone: string,
  message?: string
): string {
  const formattedPhone = formatPhoneForWhatsApp(phone);
  const encodedMessage = message ? encodeURIComponent(message) : '';
  return `https://wa.me/${formattedPhone}${encodedMessage ? `?text=${encodedMessage}` : ''}`;
}

/**
 * Format phone number for tel: link
 * Removes spaces and ensures proper format
 */
export function formatPhoneForTel(phone: string): string {
  return phone.replace(/\s/g, '');
}
