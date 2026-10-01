import type { Request, Response, NextFunction } from 'express';
import { logToFile } from './logger.ts';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max allowed requests in this window
  name: string; // Identifier for logging/admin
  blockDurationMs?: number; // Optional penalty block time
}

interface ClientRecord {
  count: number;
  resetTime: number;
  blockedUntil?: number;
  lastAttempt: string;
}

// In-memory buckets for various endpoint groups
class RateLimiterStore {
  private stores: Map<string, Map<string, ClientRecord>> = new Map();
  private stats: {
    totalBlocked: number;
    topBlockedIps: Map<string, number>;
  } = {
    totalBlocked: 0,
    topBlockedIps: new Map()
  };

  private getStore(name: string): Map<string, ClientRecord> {
    if (!this.stores.has(name)) {
      this.stores.set(name, new Map());
    }
    return this.stores.get(name)!;
  }

  // Extract client IP address accurately
  public getClientIp(req: Request): string {
    const xForwarded = req.headers['x-forwarded-for'];
    if (typeof xForwarded === 'string') {
      return xForwarded.split(',')[0].trim();
    }
    return req.socket.remoteAddress || req.ip || '127.0.0.1';
  }

  public checkLimit(name: string, ip: string, config: RateLimitConfig): {
    allowed: boolean;
    remaining: number;
    retryAfterSeconds: number;
    currentCount: number;
  } {
    const store = this.getStore(name);
    const now = Date.now();
    let record = store.get(ip);

    // If client is under penalty block
    if (record?.blockedUntil && record.blockedUntil > now) {
      const retryAfterSeconds = Math.ceil((record.blockedUntil - now) / 1000);
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds,
        currentCount: record.count
      };
    }

    // If no record or window expired, reset
    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + config.windowMs,
        lastAttempt: new Date().toISOString()
      };
      store.set(ip, record);
      return {
        allowed: true,
        remaining: Math.max(0, config.maxRequests - 1),
        retryAfterSeconds: 0,
        currentCount: 1
      };
    }

    // Increment count
    record.count++;
    record.lastAttempt = new Date().toISOString();

    if (record.count > config.maxRequests) {
      // Exceeded limit!
      const blockDuration = config.blockDurationMs || config.windowMs;
      record.blockedUntil = now + blockDuration;
      
      this.stats.totalBlocked++;
      const currentIpBlocks = this.stats.topBlockedIps.get(ip) || 0;
      this.stats.topBlockedIps.set(ip, currentIpBlocks + 1);

      const retryAfterSeconds = Math.ceil(blockDuration / 1000);
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds,
        currentCount: record.count
      };
    }

    return {
      allowed: true,
      remaining: Math.max(0, config.maxRequests - record.count),
      retryAfterSeconds: 0,
      currentCount: record.count
    };
  }

  public getStats() {
    const activeIps: Array<{ ip: string; limiter: string; count: number; blockedUntil?: string }> = [];

    this.stores.forEach((store, limiterName) => {
      const now = Date.now();
      store.forEach((record, ip) => {
        if (record.resetTime > now || (record.blockedUntil && record.blockedUntil > now)) {
          activeIps.push({
            ip,
            limiter: limiterName,
            count: record.count,
            blockedUntil: record.blockedUntil ? new Date(record.blockedUntil).toISOString() : undefined
          });
        }
      });
    });

    const topBlocked = Array.from(this.stats.topBlockedIps.entries())
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalBlockedEvents: this.stats.totalBlocked,
      activeRateLimitedClients: activeIps,
      topBlockedIps: topBlocked
    };
  }

  public resetLimits(targetIp?: string): void {
    if (targetIp) {
      this.stores.forEach(store => store.delete(targetIp));
      this.stats.topBlockedIps.delete(targetIp);
    } else {
      this.stores.forEach(store => store.clear());
      this.stats.topBlockedIps.clear();
      this.stats.totalBlocked = 0;
    }
  }
}

export const rateLimiterStore = new RateLimiterStore();

/**
 * Express middleware factory for rate limiting
 */
export function createRateLimiter(config: RateLimitConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = rateLimiterStore.getClientIp(req);
    const result = rateLimiterStore.checkLimit(config.name, ip, config);

    // Set standard rate limit headers
    res.setHeader('X-RateLimit-Limit', config.maxRequests);
    res.setHeader('X-RateLimit-Remaining', result.remaining);

    if (!result.allowed) {
      res.setHeader('Retry-After', result.retryAfterSeconds);

      // Log security event in app_errors.log
      logToFile(
        'RATE_LIMIT',
        `Rate limit exceeded on [${config.name}]. IP: ${ip} attempted request (${result.currentCount} hits). Blocked for ${result.retryAfterSeconds}s.`,
        { req, ip, route: req.originalUrl || req.url, method: req.method }
      );

      return res.status(429).json({
        error: `Rate limit exceeded for ${config.name}. Please wait ${result.retryAfterSeconds} seconds before trying again.`,
        retryAfterSeconds: result.retryAfterSeconds,
        limit: config.maxRequests,
        limiterName: config.name
      });
    }

    next();
  };
}

// Pre-configured rate limiters for key application boundaries:

// 1. Strict admin brute-force protection: 5 attempts per 15 mins
export const adminLoginLimiter = createRateLimiter({
  name: 'Admin Passkey Authentication',
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
  blockDurationMs: 15 * 60 * 1000
});

// 2. Chant creation limit: 12 chants per 5 minutes per IP
export const chantCreateLimiter = createRateLimiter({
  name: 'Anonymous Chant Creation',
  windowMs: 5 * 60 * 1000,
  maxRequests: 12,
  blockDurationMs: 5 * 60 * 1000
});

// 3. Comment post limit: 25 comments per 5 minutes per IP
export const commentCreateLimiter = createRateLimiter({
  name: 'Whisper Comments',
  windowMs: 5 * 60 * 1000,
  maxRequests: 25,
  blockDurationMs: 3 * 60 * 1000
});

// 4. Encrypted Group creation limit: 8 groups per 10 minutes
export const groupCreateLimiter = createRateLimiter({
  name: 'Encrypted Group Creation',
  windowMs: 10 * 60 * 1000,
  maxRequests: 8,
  blockDurationMs: 5 * 60 * 1000
});

// 5. Message sending limit: 45 messages per minute
export const messageSendLimiter = createRateLimiter({
  name: 'Encrypted Message Sending',
  windowMs: 60 * 1000,
  maxRequests: 45,
  blockDurationMs: 60 * 1000
});

// 6. Report / Flag limit: 10 reports per 5 minutes
export const reportFlagLimiter = createRateLimiter({
  name: 'Content Reporting',
  windowMs: 5 * 60 * 1000,
  maxRequests: 10,
  blockDurationMs: 5 * 60 * 1000
});

// 7. General API anti-scraping / anti-DDoS limit: 200 req / minute
export const generalApiLimiter = createRateLimiter({
  name: 'General API Traffic',
  windowMs: 60 * 1000,
  maxRequests: 200,
  blockDurationMs: 30 * 1000
});
