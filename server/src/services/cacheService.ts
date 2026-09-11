/**
 * ============================================================================
 * GlobeTrotter & TrekAI - Multi-Tier Universal Cache Service
 * Provides L1 (High-Speed In-Memory RAM) & L2 (MongoDB Atlas Persistent Cloud)
 * ============================================================================
 */

import { getMongoDb } from '../db/mongoService';

export interface CacheEntry<T = any> {
  value: T;
  expiresAt: number; // Unix timestamp in ms
  tag?: string;
  createdAt: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  keysCount: number;
  memoryUsageEstimateBytes: number;
  l2Enabled: boolean;
}

class UniversalCacheService {
  // L1 In-Memory Fast Cache
  private memoryCache = new Map<string, CacheEntry>();
  private readonly MAX_ENTRIES = 2000;
  private readonly PRUNE_COUNT = 500;
  private hits = 0;
  private misses = 0;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanupInterval();
  }

  private startCleanupInterval(intervalMs = 60 * 1000) {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.cleanupTimer = setInterval(() => {
      this.pruneExpired();
    }, intervalMs);
    if (this.cleanupTimer.unref) this.cleanupTimer.unref();
  }

  private pruneExpired() {
    const now = Date.now();
    for (const [key, entry] of this.memoryCache.entries()) {
      if (now >= entry.expiresAt) {
        this.memoryCache.delete(key);
      }
    }
    // If still oversized, prune oldest
    if (this.memoryCache.size > this.MAX_ENTRIES) {
      const sorted = [...this.memoryCache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt);
      const toDelete = sorted.slice(0, this.PRUNE_COUNT);
      toDelete.forEach(([k]) => this.memoryCache.delete(k));
    }
  }

  /**
   * Set a key-value pair into cache with TTL in seconds.
   */
  async set<T>(key: string, value: T, ttlSeconds = 300, tag?: string): Promise<void> {
    const now = Date.now();
    const expiresAt = now + ttlSeconds * 1000;
    const entry: CacheEntry<T> = {
      value,
      expiresAt,
      tag,
      createdAt: now,
    };

    // 1. Write L1 (RAM) instantly
    this.memoryCache.set(key, entry);

    // 2. Write L2 (MongoDB Atlas Cloud in background without blocking)
    getMongoDb().then((mongo) => {
      if (mongo) {
        mongo.collection('generic_cache').updateOne(
          { key },
          {
            $set: {
              key,
              value,
              tag: tag || null,
              created_at: new Date(now),
              expires_at: new Date(expiresAt),
            },
          },
          { upsert: true }
        ).catch(() => {});
      }
    }).catch(() => {});
  }

  /**
   * Get value from L1 (RAM) or fallback to L2 (MongoDB Atlas).
   */
  async get<T>(key: string): Promise<T | null> {
    const now = Date.now();

    // 1. Check L1 Memory
    const local = this.memoryCache.get(key);
    if (local) {
      if (now < local.expiresAt) {
        this.hits++;
        return local.value as T;
      }
      this.memoryCache.delete(key);
    }

    // 2. Check L2 MongoDB Atlas Cloud
    try {
      const mongo = await getMongoDb();
      if (mongo) {
        const coll = mongo.collection('generic_cache');
        const doc = await coll.findOne({ key, expires_at: { $gt: new Date(now) } });
        if (doc && doc.value !== undefined) {
          this.hits++;
          // Repopulate L1
          const remainingTtl = (new Date(doc.expires_at).getTime() - now) / 1000;
          if (remainingTtl > 0) {
            this.memoryCache.set(key, {
              value: doc.value,
              expiresAt: new Date(doc.expires_at).getTime(),
              tag: doc.tag,
              createdAt: new Date(doc.created_at).getTime(),
            });
          }
          return doc.value as T;
        }
      }
    } catch {
      // Non-blocking fallback
    }

    this.misses++;
    return null;
  }

  /**
   * Fetch from cache or compute if missing/expired.
   */
  async getOrSet<T>(key: string, fetcher: () => Promise<T>, ttlSeconds = 300, tag?: string): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const fresh = await fetcher();
    if (fresh !== undefined && fresh !== null) {
      await this.set(key, fresh, ttlSeconds, tag);
    }
    return fresh;
  }

  /**
   * Invalidate a single key from both L1 and L2.
   */
  async delete(key: string): Promise<void> {
    this.memoryCache.delete(key);
    try {
      const mongo = await getMongoDb();
      if (mongo) {
        await mongo.collection('generic_cache').deleteOne({ key });
      }
    } catch {}
  }

  /**
   * Invalidate all keys matching a prefix or pattern (e.g. "trip:123:*").
   */
  async invalidatePattern(prefix: string): Promise<number> {
    let count = 0;
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(prefix)) {
        this.memoryCache.delete(key);
        count++;
      }
    }

    try {
      const mongo = await getMongoDb();
      if (mongo) {
        const regex = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
        const res = await mongo.collection('generic_cache').deleteMany({ key: { $regex: regex } });
        count += res.deletedCount || 0;
      }
    } catch {}

    return count;
  }

  /**
   * Invalidate all keys associated with a specific tag (e.g. tag "trips").
   */
  async invalidateTag(tag: string): Promise<number> {
    let count = 0;
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.tag === tag) {
        this.memoryCache.delete(key);
        count++;
      }
    }

    try {
      const mongo = await getMongoDb();
      if (mongo) {
        const res = await mongo.collection('generic_cache').deleteMany({ tag });
        count += res.deletedCount || 0;
      }
    } catch {}

    return count;
  }

  /**
   * Flush the entire cache.
   */
  async flush(): Promise<void> {
    this.memoryCache.clear();
    try {
      const mongo = await getMongoDb();
      if (mongo) {
        await mongo.collection('generic_cache').deleteMany({});
      }
    } catch {}
  }

  /**
   * Get operational stats and cache efficiency metrics.
   */
  getStats(): CacheStats {
    let approxBytes = 0;
    for (const [k, v] of this.memoryCache) {
      approxBytes += (k.length + 32) * 2;
      try {
        approxBytes += JSON.stringify(v.value).length * 2;
      } catch {}
    }

    return {
      hits: this.hits,
      misses: this.misses,
      keysCount: this.memoryCache.size,
      memoryUsageEstimateBytes: approxBytes,
      l2Enabled: true,
    };
  }
}

export const cacheService = new UniversalCacheService();
