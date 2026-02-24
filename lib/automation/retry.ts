/**
 * Retry Logic with Exponential Backoff
 * 
 * @module lib/automation/retry
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface RetryPolicy {
  maxRetries: number;
  backoff: 'exponential' | 'linear' | 'fixed';
  initialDelay: number;      // milliseconds
  maxDelay: number;          // milliseconds
}

// ─────────────────────────────────────────────────────────────────────────────
// RETRY FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retry a function with exponential backoff
 * 
 * @param fn - Function to retry
 * @param retryCount - Current retry count (0 = first attempt)
 * @param policy - Retry policy
 * @returns Result of function execution
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retryCount: number,
  policy: RetryPolicy
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retryCount >= policy.maxRetries) {
      throw error; // Max retries reached
    }
    
    // Calculate delay based on backoff strategy
    const delay = calculateDelay(retryCount, policy);
    
    // Wait before retrying
    await sleep(delay);
    
    // Retry
    return retryWithBackoff(fn, retryCount + 1, policy);
  }
}

/**
 * Calculate delay based on retry count and policy
 */
function calculateDelay(retryCount: number, policy: RetryPolicy): number {
  let delay: number;
  
  switch (policy.backoff) {
    case 'exponential':
      delay = policy.initialDelay * Math.pow(2, retryCount);
      break;
    
    case 'linear':
      delay = policy.initialDelay * (retryCount + 1);
      break;
    
    case 'fixed':
    default:
      delay = policy.initialDelay;
      break;
  }
  
  // Cap at max delay
  return Math.min(delay, policy.maxDelay);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
