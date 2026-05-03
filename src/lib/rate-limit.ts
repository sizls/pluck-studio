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

const buckets = new Map<string, Bucket>();

export function checkRateLimit(
  key: string,
  config: RateLimitConfig = DEFAULT_CONFIG,
  now: number = Date.now(),
): boolean {
  const bucket = buckets.get(key);

  if (bucket === undefined || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + config.windowMs });
    return true;
  }
  if (bucket.count >= config.max) {
    return false;
  }
  bucket.count += 1;

  return true;
}

export function resetRateLimit(): void {
  buckets.clear();
}
