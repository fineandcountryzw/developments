/**
 * Stand Range Parser Utility
 * 
 * Parses stand number range specifications like "1-10,12,15-18" into sets of stand numbers.
 * Used for applying discounts to stand series.
 * 
 * Supports:
 * - Single numbers: "5"
 * - Ranges: "1-10" (inclusive)
 * - Multiple ranges: "1-10,12,15-18"
 * - Whitespace tolerance
 * - Stand numbers can be numeric strings (e.g., "001", "SL001", "1")
 */

export interface RangeParseResult {
  standNumbers: Set<string>;
  ranges: Array<{ from: number; to: number }>;
  errors: string[];
}

/**
 * Extract numeric part from stand number string
 * Examples:
 * - "SL001" -> 1
 * - "001" -> 1
 * - "45" -> 45
 * - "stand-12" -> 12
 */
function extractNumericValue(standNumber: string): number | null {
  // Remove all non-digit characters and parse
  const numericStr = standNumber.replace(/\D/g, '');
  if (!numericStr) return null;
  
  const num = parseInt(numericStr, 10);
  return isNaN(num) ? null : num;
}

/**
 * Normalize stand number to numeric string for comparison
 * Preserves original format but extracts numeric value for range matching
 */
function normalizeStandNumber(standNumber: string): { numeric: number; original: string } | null {
  const numeric = extractNumericValue(standNumber);
  if (numeric === null) return null;
  
  return { numeric, original: standNumber };
}

/**
 * Parse a range specification string into stand numbers
 * 
 * @param rangeSpec - Range specification (e.g., "1-10,12,15-18")
 * @param existingStandNumbers - Optional: existing stand numbers in development for validation
 * @returns ParseResult with standNumbers set, ranges array, and any errors
 * 
 * @example
 * parseRangeSpec("1-10,12,15-18")
 * // Returns: { standNumbers: Set(["1","2",...,"10","12","15",...,"18"]), ranges: [...], errors: [] }
 */
export function parseRangeSpec(
  rangeSpec: string,
  existingStandNumbers?: string[]
): RangeParseResult {
  const standNumbers = new Set<string>();
  const ranges: Array<{ from: number; to: number }> = [];
  const errors: string[] = [];

  if (!rangeSpec || typeof rangeSpec !== 'string') {
    errors.push('Range specification must be a non-empty string');
    return { standNumbers, ranges, errors };
  }

  // Normalize: trim whitespace
  const normalized = rangeSpec.trim();
  if (!normalized) {
    errors.push('Range specification cannot be empty');
    return { standNumbers, ranges, errors };
  }

  // Split by comma
  const parts = normalized.split(',').map(p => p.trim()).filter(p => p.length > 0);

  if (parts.length === 0) {
    errors.push('No valid range parts found');
    return { standNumbers, ranges, errors };
  }

  // Process each part
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    
    // Check if it's a range (contains dash)
    if (part.includes('-')) {
      const rangeParts = part.split('-').map(p => p.trim());
      
      if (rangeParts.length !== 2) {
        errors.push(`Invalid range format at position ${i + 1}: "${part}" (expected "from-to")`);
        continue;
      }

      const fromStr = rangeParts[0];
      const toStr = rangeParts[1];

      // Extract numeric values
      const fromNum = extractNumericValue(fromStr);
      const toNum = extractNumericValue(toStr);

      if (fromNum === null) {
        errors.push(`Invalid start value in range "${part}": "${fromStr}" is not numeric`);
        continue;
      }

      if (toNum === null) {
        errors.push(`Invalid end value in range "${part}": "${toStr}" is not numeric`);
        continue;
      }

      if (fromNum > toNum) {
        errors.push(`Invalid range "${part}": start (${fromNum}) must be <= end (${toNum})`);
        continue;
      }

      // Add range
      ranges.push({ from: fromNum, to: toNum });

      // Add all numbers in range (inclusive)
      for (let num = fromNum; num <= toNum; num++) {
        standNumbers.add(num.toString());
      }
    } else {
      // Single number
      const num = extractNumericValue(part);
      
      if (num === null) {
        errors.push(`Invalid stand number at position ${i + 1}: "${part}" is not numeric`);
        continue;
      }

      standNumbers.add(num.toString());
    }
  }

  // Validate against existing stand numbers if provided
  if (existingStandNumbers && existingStandNumbers.length > 0) {
    const existingNumeric = new Map<number, string>();
    
    // Build map of numeric -> original stand numbers
    for (const standNum of existingStandNumbers) {
      const normalized = normalizeStandNumber(standNum);
      if (normalized) {
        existingNumeric.set(normalized.numeric, standNum);
      }
    }

    // Check if parsed numbers match any existing stands
    const matchedStands = new Set<string>();
    const unmatchedNumbers: number[] = [];

    for (const numStr of standNumbers) {
      const num = parseInt(numStr, 10);
      if (existingNumeric.has(num)) {
        matchedStands.add(existingNumeric.get(num)!);
      } else {
        unmatchedNumbers.push(num);
      }
    }

    // If we have unmatched numbers, they're not errors (stands might not exist yet)
    // But we can log them as warnings
    if (unmatchedNumbers.length > 0 && matchedStands.size === 0) {
      errors.push(
        `Warning: None of the specified stand numbers (${unmatchedNumbers.slice(0, 5).join(', ')}${unmatchedNumbers.length > 5 ? '...' : ''}) match existing stands in this development`
      );
    }

    // Replace numeric strings with actual stand number formats if matched
    if (matchedStands.size > 0) {
      standNumbers.clear();
      matchedStands.forEach(standNum => standNumbers.add(standNum));
    }
  }

  return { standNumbers, ranges, errors };
}

/**
 * Check if a stand number matches any range specification
 * 
 * @param standNumber - Stand number to check (e.g., "SL001", "5", "001")
 * @param rangeSpec - Range specification (e.g., "1-10,12,15-18")
 * @returns true if stand number matches the range spec
 */
export function standNumberMatchesRange(standNumber: string, rangeSpec: string): boolean {
  const result = parseRangeSpec(rangeSpec);
  if (result.errors.length > 0) return false;

  const normalized = normalizeStandNumber(standNumber);
  if (!normalized) return false;

  // Check if numeric value is in the set
  return result.standNumbers.has(normalized.numeric.toString());
}

/**
 * Format range specification for display
 * 
 * @param ranges - Array of range objects
 * @returns Formatted string (e.g., "1-10, 12, 15-18")
 */
export function formatRangeSpec(ranges: Array<{ from: number; to: number }>): string {
  if (ranges.length === 0) return '';
  
  return ranges
    .map(r => r.from === r.to ? r.from.toString() : `${r.from}-${r.to}`)
    .join(', ');
}
