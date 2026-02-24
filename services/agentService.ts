import { Agent } from '../types';

// Mock agent list for demo; replace with API call in production
export const getAgents = async (): Promise<Agent[]> => {
  return [
    { id: '1', name: 'Alice Moyo', email: 'alice@fineandcountry.com', phone: '0771234567' },
    { id: '2', name: 'Brian Ncube', email: 'brian@fineandcountry.com', phone: '0779876543' },
    // ...add more agents as needed
  ];
};
