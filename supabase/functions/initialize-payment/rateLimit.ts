/**
 * Rate Limiting Utility for Supabase Edge Functions
 * Uses in-memory storage with automatic cleanup
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store for rate limiting
// Key format: "identifier:window" (e.g., "ip:123.456.789.0:60" or "user:uuid:60")
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

function cleanupExpiredEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) {
    return;
  }
  
  lastCleanup = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Get client identifier from request
 * Uses IP address or user ID if authenticated
 */
function getClientIdentifier(req: Request, userId: string | null): string {
  if (userId) {
    return `user:${userId}`;
  }
  
  // Try to get IP from various headers (for proxy/load balancer scenarios)
  const forwardedFor = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const cfConnectingIp = req.headers.get('cf-connecting-ip'); // Cloudflare
  
  const ip = cfConnectingIp || realIp || (forwardedFor ? forwardedFor.split(',')[0].trim() : null) || 'unknown';
  return `ip:${ip}`;
}

export interface RateLimitOptions {
  maxRequests: number; // Maximum requests allowed
  windowSeconds: number; // Time window in seconds
  identifier?: string; // Optional custom identifier (overrides auto-detection)
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number; // Seconds until rate limit resets
}

/**
 * Check if request should be rate limited
 * @param req - Request object
 * @param userId - Authenticated user ID (if available)
 * @param options - Rate limit configuration
 * @returns Rate limit result
 */
export function checkRateLimit(
  req: Request,
  userId: string | null,
  options: RateLimitOptions
): RateLimitResult {
  cleanupExpiredEntries();
  
  const identifier = options.identifier || getClientIdentifier(req, userId);
  const key = `${identifier}:${options.windowSeconds}`;
  const now = Date.now();
  const resetAt = now + (options.windowSeconds * 1000);
  
  const entry = rateLimitStore.get(key);
  
  if (!entry || entry.resetAt < now) {
    // Create new entry or reset expired entry
    rateLimitStore.set(key, {
      count: 1,
      resetAt: resetAt
    });
    
    return {
      allowed: true,
      remaining: options.maxRequests - 1,
      resetAt: resetAt
    };
  }
  
  // Entry exists and is still valid
  if (entry.count >= options.maxRequests) {
    // Rate limit exceeded
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfter: retryAfter
    };
  }
  
  // Increment count
  entry.count++;
  rateLimitStore.set(key, entry);
  
  return {
    allowed: true,
    remaining: options.maxRequests - entry.count,
    resetAt: entry.resetAt
  };
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.resetAt.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(result.resetAt / 1000).toString(),
    ...(result.retryAfter ? { 'Retry-After': result.retryAfter.toString() } : {})
  };
}

