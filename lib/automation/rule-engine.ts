/**
 * Rule Evaluation Engine
 * Evaluates conditions against event payloads
 * 
 * @module lib/automation/rule-engine
 */

import { AutomationEvent } from './event-emitter';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface AutomationCondition {
  field: string;
  operator: 'equals' | 'greater' | 'less' | 'contains' | 'in' | 'not_in' | 'not_equals';
  value: any;
  logic?: 'AND' | 'OR';
  conditions?: AutomationCondition[]; // Nested conditions
}

// ─────────────────────────────────────────────────────────────────────────────
// RULE EVALUATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evaluate a condition against an event
 * 
 * @param condition - Condition to evaluate (null = always true)
 * @param event - Event to evaluate against
 * @returns true if condition matches, false otherwise
 */
export function evaluateCondition(
  condition: AutomationCondition | null,
  event: AutomationEvent
): boolean {
  // No condition = always true
  if (!condition) {
    return true;
  }
  
  // Handle nested conditions (AND/OR logic)
  if (condition.conditions && condition.conditions.length > 0) {
    const results = condition.conditions.map(c => evaluateCondition(c, event));
    
    if (condition.logic === 'OR') {
      return results.some(r => r);
    } else {
      // Default to AND
      return results.every(r => r);
    }
  }
  
  // Get field value from event payload
  const fieldValue = getFieldValue(condition.field, event.payload);
  
  // Compare based on operator
  return compare(condition.operator, fieldValue, condition.value);
}

/**
 * Get field value from payload (supports nested fields)
 * 
 * @param field - Field path (e.g., 'status', 'stand.status', 'client.email')
 * @param payload - Event payload
 * @returns Field value or null if not found
 */
function getFieldValue(field: string, payload: Record<string, any>): any {
  // Support nested fields: 'stand.status', 'client.email'
  const parts = field.split('.');
  let value = payload;
  
  for (const part of parts) {
    if (value === null || value === undefined) {
      return null;
    }
    
    value = value[part];
    
    if (value === undefined) {
      return null;
    }
  }
  
  return value;
}

/**
 * Compare field value with condition value using operator
 * 
 * @param operator - Comparison operator
 * @param fieldValue - Value from event payload
 * @param conditionValue - Value from condition
 * @returns true if comparison matches
 */
function compare(
  operator: string,
  fieldValue: any,
  conditionValue: any
): boolean {
  switch (operator) {
    case 'equals':
      return fieldValue === conditionValue;
    
    case 'not_equals':
      return fieldValue !== conditionValue;
    
    case 'greater':
      return Number(fieldValue) > Number(conditionValue);
    
    case 'less':
      return Number(fieldValue) < Number(conditionValue);
    
    case 'contains':
      return String(fieldValue).includes(String(conditionValue));
    
    case 'in':
      return Array.isArray(conditionValue) && conditionValue.includes(fieldValue);
    
    case 'not_in':
      return Array.isArray(conditionValue) && !conditionValue.includes(fieldValue);
    
    default:
      // Unknown operator = false (fail safe)
      return false;
  }
}
