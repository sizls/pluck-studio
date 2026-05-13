// ---------------------------------------------------------------------------
// validatePublicUrl — hardened SSRF guard
// ---------------------------------------------------------------------------
//
// Used by:
//   - lib/v1/watch-validators.ts (POST-time URL validation)
//   - lib/watch/store.ts (FETCH-time validation, including redirect Location)
//   - future webhook / slack dispatch (re-validate operator-supplied URLs)
//
// R1 hardening over the pre-existing `request-guards.isPrivateOrLocalHost`:
//   1. Trailing-dot stripping (`localhost.` was a bypass)
//   2. IPv6 literal handling (`[::1]`, `[::ffff:127.0.0.1]`, ULA, link-local)
//   3. Numeric-IPv4 normalization (WHATWG URL normalizes `2130706433` →
//      `127.0.0.1`; this catches the cases it does not normalize)
//   4. `0` and `0.0.0` shorthand
//   5. `.local` (mDNS) / `.internal` (informal RFC8375) suffix block
//   6. `userinfo@host` is rejected by URL parser when used to mask host,
//      but we re-extract `parsed.hostname` to drop it explicitly
//
// What this is NOT:
//   - DNS resolution. A public-host validator cannot defeat DNS rebinding
//     on its own — the caller MUST re-resolve at fetch time and verify the
//     resolved IP. `validateResolvedIp` below is the second half.
// ---------------------------------------------------------------------------

import { isIP } from "node:net";

export type UrlGuardResult =
  | { readonly ok: true; readonly url: string; readonly hostname: string }
  | { readonly ok: false; readonly error: string };

const HOSTNAME_BLOCK_LIST: ReadonlySet<string> = new Set([
  "localhost",
  "ip6-localhost",
  "ip6-loopback",
  // WHATWG URL normalizes `0`, `0.0.0`, `0.0.0.0` → `0.0.0.0` for the host.
  // Belt-and-suspenders: literal match on every variant we have seen in the wild.
  "0",
  "0.0.0",
  "0.0.0.0",
  "127.0.0.1",
  "::1",
  "::",
  "::ffff:0:0",
  "::ffff:127.0.0.1",
]);

const FORBIDDEN_TLDS: ReadonlyArray<string> = [
  ".local", // mDNS
  ".internal", // RFC8375 home-network informal
  ".localhost", // RFC2606 reserved
  ".test", // RFC2606
  ".invalid", // RFC2606
];

/**
 * Validate a user-supplied URL for safe server-side fetch. Returns the
 * canonical form (`url`) plus the parsed hostname for downstream callers
 * that need to re-validate after a redirect.
 *
 * Same posture is appropriate for:
 *   - watched URLs (POST-time + fetch-time)
 *   - webhook / slack delivery targets (POST-time + dispatch-time)
 */
export function validatePublicUrl(raw: string): UrlGuardResult {
  if (typeof raw !== "string") {
    return { ok: false, error: "URL must be a string." };
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "URL is required." };
  }
  if (trimmed.length > 2048) {
    return { ok: false, error: "URL must be 2048 characters or fewer." };
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "URL must be valid (include https://)." };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "URL must use http:// or https://." };
  }
  // The WHATWG URL parser preserves `user:pass@` in `parsed.username`/`password`
  // and DOES NOT include it in `parsed.hostname` — so an attacker writing
  // `http://attacker.com@127.0.0.1` ends up with `hostname = "127.0.0.1"`,
  // not "attacker.com". The pre-existing comment elsewhere had this right
  // — we re-assert here.
  if (parsed.username.length > 0 || parsed.password.length > 0) {
    return { ok: false, error: "URL must not include userinfo (no `user:pass@`)." };
  }

  // Normalize: lowercase, strip surrounding [ ] from IPv6 literals, strip
  // trailing dot. The WHATWG URL parser keeps brackets on `parsed.hostname`
  // for IPv6 (`new URL("http://[::1]/").hostname === "[::1]"`), which would
  // make `node:net.isIP` return 0 (not an IP) and our IPv6 ULA / link-local
  // checks would silently fall through.
  let hostnameRaw = parsed.hostname.toLowerCase();
  if (hostnameRaw.startsWith("[") && hostnameRaw.endsWith("]")) {
    hostnameRaw = hostnameRaw.slice(1, -1);
  }
  const hostname = hostnameRaw.endsWith(".")
    ? hostnameRaw.slice(0, -1)
    : hostnameRaw;

  if (hostname.length === 0) {
    return { ok: false, error: "URL hostname is missing." };
  }

  if (HOSTNAME_BLOCK_LIST.has(hostname)) {
    return { ok: false, error: "URL cannot point at localhost or loopback addresses." };
  }

  // IPv6 literals come out of `parsed.hostname` WITHOUT the surrounding
  // brackets. `net.isIP("::1")` returns 6.
  const ipFamily = isIP(hostname);

  if (ipFamily === 4) {
    if (isPrivateOrLoopbackIPv4(hostname)) {
      return { ok: false, error: "URL cannot point at private/loopback IPs." };
    }
  } else if (ipFamily === 6) {
    if (isPrivateOrLoopbackIPv6(hostname)) {
      return { ok: false, error: "URL cannot point at private/loopback IPv6 addresses." };
    }
  } else {
    // It's a DNS hostname. Apply suffix block list.
    for (const tld of FORBIDDEN_TLDS) {
      if (hostname.endsWith(tld) || hostname === tld.slice(1)) {
        return { ok: false, error: `URL must not target the reserved \`${tld}\` namespace.` };
      }
    }
    // Catch "localhost.example.com" — only the bare label was being checked
    // before, but ANY label of `localhost` between dots is suspicious.
    const labels = hostname.split(".");
    if (labels[0] === "localhost") {
      return { ok: false, error: "URL cannot point at localhost." };
    }
  }

  return { ok: true, url: trimmed, hostname };
}

/**
 * Re-validate a hostname-or-IP after fetch-time DNS resolution. Used to
 * defeat DNS rebinding: the POST-time validator only sees the textual
 * hostname; at fetch time we look up its A/AAAA records and pass each
 * resolved IP through here.
 *
 * Returns null on success or a human-readable error message.
 */
export function validateResolvedIp(ip: string): string | null {
  const family = isIP(ip);
  if (family === 4) {
    if (isPrivateOrLoopbackIPv4(ip)) {
      return "resolved IP is private/loopback";
    }
    return null;
  }
  if (family === 6) {
    if (isPrivateOrLoopbackIPv6(ip)) {
      return "resolved IPv6 is private/loopback";
    }
    return null;
  }
  return "resolved address is not a valid IP";
}

function isPrivateOrLoopbackIPv4(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) {
    // Should not happen if net.isIP said 4, but guard anyway.
    return true;
  }
  const a = Number(parts[0]);
  const b = Number(parts[1]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return true;
  }
  if (a === 0) return true; // "this network"
  if (a === 10) return true; // RFC1918
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 100 && b >= 64 && b <= 127) return true; // RFC6598 CGN
  if (a >= 224) return true; // multicast + reserved (224.0.0.0/4) + 240.0.0.0/4

  return false;
}

function isPrivateOrLoopbackIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  // Loopback / unspecified.
  if (lower === "::1" || lower === "::" || lower === "::ffff:0:0") return true;
  // IPv4-mapped IPv6 — apply the IPv4 ruleset to the embedded address.
  // Forms: `::ffff:127.0.0.1`, `::ffff:7f00:1`, `64:ff9b::127.0.0.1`.
  const mapped = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) {
    const inner = mapped[1];
    if (inner !== undefined && isPrivateOrLoopbackIPv4(inner)) return true;
  }
  // Hex-form mapped — `::ffff:7f00:1` (127.0.0.1).
  const hexMapped = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hexMapped) {
    const hi = Number.parseInt(hexMapped[1]!, 16);
    const lo = Number.parseInt(hexMapped[2]!, 16);
    if (Number.isFinite(hi) && Number.isFinite(lo)) {
      const a = (hi >> 8) & 0xff;
      const b = hi & 0xff;
      const c = (lo >> 8) & 0xff;
      const d = lo & 0xff;
      if (isPrivateOrLoopbackIPv4(`${a}.${b}.${c}.${d}`)) return true;
    }
  }
  // fc00::/7 ULA.
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  // fe80::/10 link-local.
  if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) {
    return true;
  }
  // Multicast ff00::/8.
  if (lower.startsWith("ff")) return true;
  // Discard prefix 100::/64.
  if (lower.startsWith("100:")) return true;

  return false;
}
