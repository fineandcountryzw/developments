/**
 * Security Context Utilities
 * 
 * Captures IP address, device type, user agent for fraud prevention.
 * Used in activity logging to track suspicious patterns.
 */

export interface SecurityContext {
  ipAddress: string;
  deviceType: 'mobile' | 'tablet' | 'desktop' | 'unknown';
  userAgent: string;
  browser: string;
  os: string;
  timestamp: string;
}

/**
 * Get security context from request (for server actions)
 * NOTE: This is a placeholder - actual implementation depends on your auth setup
 */
export async function getSecurityContext(): Promise<SecurityContext> {
  // In a real server action, you would access request headers here
  // For now, return a default context
  // TODO: Integrate with your actual request handling
  
  return {
    ipAddress: 'unknown',
    deviceType: 'unknown',
    userAgent: 'unknown',
    browser: 'Unknown',
    os: 'Unknown',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Detect device type from user agent
 */
function detectDeviceType(userAgent: string): SecurityContext['deviceType'] {
  const ua = userAgent.toLowerCase();
  
  // Mobile devices
  if (/(android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini)/i.test(ua)) {
    // Tablets
    if (/(ipad|android(?!.*mobile)|tablet)/i.test(ua)) {
      return 'tablet';
    }
    return 'mobile';
  }
  
  // Desktop
  if (/(windows|macintosh|linux|x11)/i.test(ua)) {
    return 'desktop';
  }
  
  return 'unknown';
}

/**
 * Parse user agent to extract browser and OS
 */
function parseUserAgent(userAgent: string): { browser: string; os: string } {
  const ua = userAgent;
  
  // Browser detection
  let browser = 'Unknown';
  if (ua.includes('Firefox/')) {
    browser = 'Firefox';
  } else if (ua.includes('Chrome/')) {
    browser = 'Chrome';
  } else if (ua.includes('Safari/') && !ua.includes('Chrome/')) {
    browser = 'Safari';
  } else if (ua.includes('Edg/')) {
    browser = 'Edge';
  } else if (ua.includes('Opera/') || ua.includes('OPR/')) {
    browser = 'Opera';
  }
  
  // OS detection
  let os = 'Unknown';
  if (ua.includes('Windows')) {
    os = 'Windows';
  } else if (ua.includes('Mac OS')) {
    os = 'macOS';
  } else if (ua.includes('Linux')) {
    os = 'Linux';
  } else if (ua.includes('Android')) {
    os = 'Android';
  } else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) {
    os = 'iOS';
  }
  
  return { browser, os };
}

/**
 * Format security context for display
 */
export function formatSecurityContext(context: SecurityContext): string {
  return `${context.deviceType} · ${context.browser} on ${context.os} · ${context.ipAddress}`;
}

/**
 * Check if IP address looks suspicious (simple heuristics)
 */
export function isSuspiciousIP(ipAddress: string): boolean {
  // Check for localhost/private IPs (shouldn't appear in production)
  if (ipAddress === 'unknown' || ipAddress === '127.0.0.1' || ipAddress.startsWith('192.168.')) {
    return false; // Not suspicious in dev
  }
  
  // Add your own IP blacklist logic here
  // For example, check against known VPN/proxy ranges
  
  return false;
}

/**
 * Detect if multiple reservations from same IP (fraud detection)
 */
export async function detectMultipleReservationsFromIP(
  ipAddress: string,
  timeWindowMinutes: number = 60
): Promise<{ count: number; suspicious: boolean }> {
  // This would query your activity logs
  // For now, return a placeholder
  
  // In production:
  // 1. Query activities table for RESERVATION type
  // 2. Filter by metadata.ipAddress = ipAddress
  // 3. Filter by createdAt within last N minutes
  // 4. Count results
  // 5. Flag as suspicious if count > 3
  
  return {
    count: 0,
    suspicious: false,
  };
}
