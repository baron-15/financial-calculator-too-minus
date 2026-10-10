/**
 * Simple in-memory sliding-window rate limiter, keyed by client IP.
 *
 * Best-effort only: on serverless platforms (Vercel, Netlify) each warm instance has its own memory,
 * instances are recycled at will, and traffic may be spread across several of them, so the effective
 * limit can be higher than configured. For a hard limit use a shared store (e.g. Redis / Upstash KV)
 * or the platform's firewall rules. It is still useful against a single client hammering one instance,
 * and in local development it behaves exactly as configured.
 */

export interface RateLimitDecision {
  allowed: boolean;
  /** Requests left in the current window after this one. */
  remaining: number;
  /** Seconds until the next request would be allowed (0 when allowed). */
  retryAfterSeconds: number;
}

export interface RateLimiterOptions {
  /** Maximum requests per window. */
  limit: number;
  windowMs: number;
  /** Cap on tracked clients, so a flood of distinct IPs cannot grow memory without bound. */
  maxKeys?: number;
}

export class RateLimiter {
  private readonly hits = new Map<string, number[]>();
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly maxKeys: number;

  constructor(opts: RateLimiterOptions) {
    this.limit = opts.limit;
    this.windowMs = opts.windowMs;
    this.maxKeys = opts.maxKeys ?? 10_000;
  }

  check(key: string, now: number = Date.now()): RateLimitDecision {
    const cutoff = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      const oldest = recent[0] ?? now;
      return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000)) };
    }
    recent.push(now);
    // Re-insert so Map iteration order approximates least-recently-seen first.
    this.hits.delete(key);
    this.hits.set(key, recent);
    if (this.hits.size > this.maxKeys) this.evict(cutoff);
    return { allowed: true, remaining: this.limit - recent.length, retryAfterSeconds: 0 };
  }

  /** Number of clients currently tracked (for tests and diagnostics). */
  get size(): number {
    return this.hits.size;
  }

  private evict(cutoff: number): void {
    for (const [k, ts] of this.hits) if (!ts.some((t) => t > cutoff)) this.hits.delete(k);
    for (const k of this.hits.keys()) {
      if (this.hits.size <= this.maxKeys) break;
      this.hits.delete(k);
    }
  }
}

/** Best guess at the caller's IP from common proxy headers (Vercel, Netlify, Cloudflare, the dev adapter). */
export function clientKey(req: Request): string {
  const h = req.headers;
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwarded ||
    h.get("x-real-ip")?.trim() ||
    h.get("x-nf-client-connection-ip")?.trim() ||
    h.get("cf-connecting-ip")?.trim() ||
    "anonymous"
  );
}
