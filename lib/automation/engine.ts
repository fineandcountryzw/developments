/**
 * Automation Engine (Legacy Wrapper)
 * 
 * @deprecated Use engine-optimized.ts instead
 * This file is kept for backward compatibility.
 * All new code should use engine-optimized.ts
 * 
 * @module lib/automation/engine
 */

// Re-export from optimized engine for backward compatibility
export { 
  processEvent, 
  invalidateAutomationCache, 
  clearAutomationCache 
} from './engine-optimized';
