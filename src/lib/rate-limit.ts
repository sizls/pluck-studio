// ---------------------------------------------------------------------------
// In-memory token-bucket rate limiter (stub for the day-1 commit)
// ---------------------------------------------------------------------------
//
// Sized for the v0 Studio activation flow: a per-IP+session bucket of
// 10 requests / 60s. The real edge / Kite-substrate limiter replaces
// this when the v1 /v1/runs endpoint lands. Until then, this prevents
// log-spam DoS from a single client and gives the eventual idempotency
// story (C5) a clear seam to slot into.
//
// Lives in `lib/` rather than alongside the route because Next.js Route
// Handler files only allow HTTP-method exports; auxiliary helpers must
// live elsewhere or they trip the build's strict export check.
//
// SECURITY TRADE-OFFS:
//   - The bucket map is capped at MAX_BUCKETS to prevent memory-exhaustion
//     DoS by a client rotating arbitrary keys (e.g. spoofed
//     X-Forwarded-For header, in environments where there's no upstream
//     proxy stripping client-supplied values). On overflow the oldest
//     bucket is evicted (FIFO). Same approach Directive uses for
//     resolversByType + retryAttempts. NB: an attacker who fills the
//     bucket can still cause OWN traffic to be evicted-and-reset,
//     trading "I get rate-limited" for "I get to make exactly 10 reqs".
//     Acceptable for a stub; real defence is the edge limiter.
//   - The caller is expected to derive `key` from a trustworthy client
//     identity. In production behind Vercel / Cloudflare, X-Forwarded-For
//     is normalised by the upstream proxy; in dev or in a misconfigured
//     deployment, an attacker can spoof XFF per request to rotate keys.
//     `__resetRateLimitForTests` exists so tests aren't affected by
//     bucket carryover between runs.
// ---------------------------------------------------------------------------

export interface RateLimitConfig {
  max: number;
  windowMs: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  max: 10,
  windowMs: 60_000,
};

const MAX_BUCKETS = 10_000;

const buckets = new Map<string, Bucket>();

export function checkRateLimit(
  key: string,
  config: RateLimitConfig = DEFAULT_CONFIG,
  now: number = Date.now(),
): boolean {
  const bucket = buckets.get(key);

  if (bucket === undefined || bucket.resetAt <= now) {
    enforceCap();
    // Re-insert (or insert) to mark as the most recently active key.
    buckets.delete(key);
    buckets.set(key, { count: 1, resetAt: now + config.windowMs });

    return true;
  }
  if (bucket.count >= config.max) {
    return false;
  }
  bucket.count += 1;

  return true;
}

function enforceCap(): void {
  while (buckets.size >= MAX_BUCKETS) {
    // Map iterates in insertion order; first key is the oldest. FIFO eviction.
    const oldest = buckets.keys().next().value;

    if (oldest === undefined) {
      return;
    }
    buckets.delete(oldest);
  }
}

export function resetRateLimit(): void {
  buckets.clear();
}

/** @internal — for tests asserting the cap behaviour */
export function __rateLimitBucketCount(): number {
  return buckets.size;
}
