/**
 * ============================================================================
 * GlobeTrotter & TrekAI - API Route Cache Middleware
 * Provides automatic HTTP Cache-Control, ETag headers, and Multi-Tier Cache
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { cacheService } from '../services/cacheService';

export interface CacheOptions {
  ttlSeconds?: number;
  tag?: string;
  scope?: 'user' | 'public';
}

/**
 * Express middleware to automatically cache GET endpoints.
 * Returns cached responses with X-Cache: HIT and sets proper ETag headers.
 */
export function cacheResponse(options: CacheOptions = {}) {
  const ttl = options.ttlSeconds || 60;
  const tag = options.tag || 'general';
  const scope = options.scope || 'user';

  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const userId = (req as any).user?.id || (req as any).session?.userId || 'anon';
    const cacheKey = scope === 'user'
      ? `http:${userId}:${req.originalUrl || req.url}`
      : `http:public:${req.originalUrl || req.url}`;

    try {
      const cached = await cacheService.get<{ body: any; headers: Record<string, string>; etag: string }>(cacheKey);

      if (cached) {
        // Check If-None-Match for 304 Not Modified
        const clientEtag = req.headers['if-none-match'];
        if (clientEtag && clientEtag === cached.etag) {
          res.setHeader('X-Cache', 'HIT');
          res.setHeader('ETag', cached.etag);
          return res.status(304).end();
        }

        res.setHeader('X-Cache', 'HIT');
        res.setHeader('ETag', cached.etag);
        res.setHeader('Cache-Control', `private, max-age=${ttl}`);
        return res.json(cached.body);
      }
    } catch {
      // Proceed to original route handler on error
    }

    // Intercept res.json to populate cache
    const originalJson = res.json.bind(res);

    res.json = (body: any) => {
      // Only cache successful 200 responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const bodyStr = JSON.stringify(body);
          const etag = `"${crypto.createHash('md5').update(bodyStr).digest('hex')}"`;

          res.setHeader('X-Cache', 'MISS');
          res.setHeader('ETag', etag);
          res.setHeader('Cache-Control', `private, max-age=${ttl}`);

          // Save asynchronously to cacheService
          cacheService.set(
            cacheKey,
            {
              body,
              etag,
            },
            ttl,
            tag
          ).catch(() => {});
        } catch {}
      }

      return originalJson(body);
    };

    next();
  };
}

/**
 * Invalidate API cache by tag or user (e.g. after a trip update or creation).
 */
export async function invalidateApiCache(tagOrPrefix: string): Promise<void> {
  await Promise.all([
    cacheService.invalidateTag(tagOrPrefix),
    cacheService.invalidatePattern(`http:${tagOrPrefix}`),
  ]);
}
